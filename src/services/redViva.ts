// ═══════════════════════════════════════════════════════════
// 🩺 RED VIVA — FASE AK (v0.11.10): la conexión ZOMBI, nunca más
// ═══════════════════════════════════════════════════════════
// EL PROBLEMA REAL (reporte de Rudy, 22 oct): «mando "estoy
// llegando" y se demora un montón… si le llega, llega después de
// 15 minutos… ayer funcionaba muy bien». No era la cuota ni su
// línea: cuando la app pasa a SEGUNDO PLANO, Android le congela la
// red al WebView. Al reabrirla, la conexión larga (long-polling)
// que tenía con Firebase está MUERTA pero la app no se entera:
// espera a que el reloj interno de la red la declare muerta
// (~10-15 minutos). Hasta entonces todo lo que mandás queda
// atascado en el cel: mensajes, plantillas que no bajan, QR que
// no aparece, guardados «sin sincronizar».
//
// LA VACUNA: cada vez que la app VUELVE del fondo (o vuelve la
// señal), CORTAMOS la conexión muerta y abrimos una fresca al
// instante (disableNetwork → enableNetwork). Firestore re-engancha
// todos los listeners y manda lo que quedó pendiente EN SEGUNDOS.
// La caché persistente (FASE AK) no se toca: solo se refresca el
// TRANSPORTE. Con debounce (mínimo 15 s entre ciclos) para no
// sacudir la red si el usuario cambia de app seguido.
// ═══════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';
import { App as CapApp, AppState } from '@capacitor/app';
import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from './firebase';

/** Mínimo entre ciclos de refresco — mutable para los tests */
export const LIMITES_RED_VIVA = {
  /** debounce: no refrescar más seguido que esto */
  entreCiclosMs: 15_000,
  /** cuánto tiempo escondida cuenta como «volvió del fondo» */
  escondidaMinimaMs: 15_000,
};

let _ultimoCiclo = 0;
let _ocupado = false;
let _escondidaDesde = 0;
let _instalado = false;
/** últimos refrescos — para los tests y debug */
export const registroRefrescos: Array<{ motivo: string; en: number }> = [];

/**
 * Corta la conexión (zombi o sana) y abre una fresca. Es rápido e
 * indoloro: Firestore re-sincroniza todos los listeners y manda
 * los writes pendientes. Con la caché persistente los datos no se
 * pierden: solo se cambia el «tubo».
 */
export async function refrescarConexion(motivo: string): Promise<boolean> {
  if (!db) return false;
  const ahora = Date.now();
  if (_ocupado) return false; // ya hay un ciclo andando
  if (ahora - _ultimoCiclo < LIMITES_RED_VIVA.entreCiclosMs) return false; // debounce
  _ultimoCiclo = ahora;
  _ocupado = true;
  try {
    await disableNetwork(db);
    await enableNetwork(db);
    registroRefrescos.push({ motivo, en: ahora });
    if (registroRefrescos.length > 20) registroRefrescos.shift();
    console.log(`🩺 [red] Conexión refrescada (${motivo}) — lo pendiente sale en segundos`);
    return true;
  } catch (e) {
    console.warn('🩺 [red] No pude refrescar la conexión:', e);
    return false;
  } finally {
    _ocupado = false;
  }
}

/** ¿La app estuvo escondida el tiempo suficiente como para refrescar? */
export function estuvoEscondidaSuficiente(ahora = Date.now()): boolean {
  return !!_escondidaDesde && ahora - _escondidaDesde >= LIMITES_RED_VIVA.escondidaMinimaMs;
}

/** Test-only: resetear el estado interno */
export function _resetRedViva() {
  _ultimoCiclo = 0;
  _ocupado = false;
  _escondidaDesde = 0;
  registroRefrescos.length = 0;
}

/**
 * Instala los ganchos globales — SE LLAMA UNA VEZ (App.tsx):
 *   · visibilitychange → al volver de otra app
 *   · Capacitor appStateChange → idem pero nativo (APK)
 *   · window 'online' → cuando vuelve la señal del cel
 */
export function instalarRedViva(): () => void {
  if (!db || _instalado) return () => undefined;
  _instalado = true;

  const limpiadores: Array<() => void> = [];

  // 1) Navegador/WebView: visible ↔ hidden
  const onVisibilidad = () => {
    if (document.visibilityState === 'visible') {
      if (estuvoEscondidaSuficiente()) void refrescarConexion('app reabierta');
      _escondidaDesde = 0;
    } else {
      _escondidaDesde = Date.now();
    }
  };
  document.addEventListener('visibilitychange', onVisibilidad);
  limpiadores.push(() => document.removeEventListener('visibilitychange', onVisibilidad));

  // 2) APK nativo (Capacitor): foreground ↔ background
  try {
    const escucha = CapApp.addListener('appStateChange', (estado: AppState) => {
      if (estado.isActive) {
        if (estuvoEscondidaSuficiente()) void refrescarConexion('app activa (APK)');
        _escondidaDesde = 0;
      } else {
        _escondidaDesde = Date.now();
      }
    });
    // then/catch: en la versión vieja del plugin devuelve promesa
    if (escucha && typeof (escucha as any)?.then === 'function') {
      (escucha as any).then((h: any) => h && limpiadores.push(() => h.remove())).catch(() => undefined);
    } else {
      limpiadores.push(() => {
        try {
          (escucha as any)?.remove?.();
        } catch {
          /* nada */
        }
      });
    }
  } catch {
    // Sin Capacitor (navegador puro): el visibilitychange de arriba alcanza
  }

  // 3) Volvió la señal del celular → refrescar SIEMPRE (la conexión
  //    murió con el bache; aunque la app no estuviera escondida).
  //    El evento 'online' del WebView también sirve en el APK.
  const onOnline = () => void refrescarConexion('volvió la señal');
  window.addEventListener('online', onOnline);
  limpiadores.push(() => window.removeEventListener('online', onOnline));

  console.log('🩺 [red] Red viva instalada — al reabrir la app, la conexión se refresca sola');
  return () => {
    _instalado = false;
    limpiadores.forEach((quitar) => {
      try {
        quitar();
      } catch {
        /* nada */
      }
    });
  };
}
