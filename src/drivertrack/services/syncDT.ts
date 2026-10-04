// ═══════════════════════════════════════════════════════════
// ☁️ FASE C: Sincronización en la nube de DriverTrack (inDrive)
// ═══════════════════════════════════════════════════════════
// Antes: viajes, gastos y ajustes vivían SOLO en el localStorage
// del teléfono → en otro cel no se veía NADA. Ahora, con sesión
// de RiderTrack abierta, todo se respalda SOLO en Firestore
// (doc dt_sync/{uid}) y baja al toque en cualquier dispositivo:
//
//   [cambio en la app] → localStorage → (2.5 seg) → nube
//   [otro cel / esta app] ← onSnapshot ← nube → localStorage
//        → evento 'dt:sync-remoto' → las vistas se recargan
//
// Decisiones de diseño:
//   · ÚLTIMO ESCRIBE GANA (actualizadoEn): sos vos en 2 cels,
//     lo que guardaste último pisa lo anterior. Simple y seguro
//     para un solo driver.
//   · Las RUTAS GPS (el dibujo del mapa) NO viajan: pesan mucho
//     y son del teléfono que grabó — los km y duración SÍ viajan
//     (son números). Se suben los últimos 1000 viajes.
//   · Las KEYS de IA (geminiKey/claudeKey) NO viajan: quedan solo
//     en el teléfono (mismo criterio de siempre) y se conservan
//     al bajar la config de la nube (merge, no reemplazo).
//   · El doc propio + rules isOwner → nadie más ve tus números.
// ═══════════════════════════════════════════════════════════

import { doc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ConfigDT, Gasto, Viaje } from '../types';
import { cargarConfig, guardarConfig, guardarGastos, guardarViajes, normalizarConfig } from '../storage';

const K_SYNC_EN = 'dt_sync_en'; // última marca de tiempo que YO escribí (local o nube)
const MAX_VIAJES_SYNC = 1000; // tope para no pasarse del doc de 1 MB
const DELAY_PUSH = 2500; // debounce: si seguís editando, espera

/** Id del dispositivo (por carga de la app) — para ignorar mi propio eco */
const DISPOSITIVO = Math.random().toString(36).slice(2, 10);

export type EstadoSync = 'sin-sesion' | 'sincronizado' | 'pendiente' | 'error';

let uidActual: string | null = null;
let unsubscribe: Unsubscribe | null = null;
let pushTimer: number | null = null;
let estado: EstadoSync = 'sin-sesion';
let ultimoPushEn = 0;
const oyentes = new Set<(e: EstadoSync) => void>();

function notificar(nuevo: EstadoSync) {
  estado = nuevo;
  oyentes.forEach(cb => {
    try {
      cb(nuevo);
    } catch {
      /* un oyente roto no frena a los demás */
    }
  });
}

/** Estado actual del sync (para el indicador de Ajustes) */
export function estadoSyncDT(): EstadoSync {
  return estado;
}

/** Suscribirse a cambios de estado — devuelve la función para desuscribirse */
export function suscribirEstadoSyncDT(cb: (e: EstadoSync) => void): () => void {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

/** La config que viaja a la nube: SIN las keys de IA (quedan en el teléfono) */
function configParaNube(c: ConfigDT): Partial<ConfigDT> {
  const { geminiKey: _g, claudeKey: _c, robotUrl: _u, robotToken: _t, ...resto } = c;
  return resto;
}

function viajesParaNube(v: Viaje[]): Viaje[] {
  // sin rutas GPS (pesan) y solo los últimos MAX — los km/duración sí viajan
  return v.slice(-MAX_VIAJES_SYNC).map(x => ({ ...x, ruta: undefined }));
}

async function empujar() {
  if (!uidActual) return;
  const actualizadoEn = Date.now();
  ultimoPushEn = actualizadoEn;
  try {
    // Se lee DIRECTO del localStorage (fuente de verdad que ya guardaron
    // las vistas) — así el sync nunca depende de quién lo dispara
    const viajes = viajesParaNube(JSON.parse(localStorage.getItem('dt_viajes_v1') || '[]') as Viaje[]);
    const gastos = JSON.parse(localStorage.getItem('dt_gastos_v1') || '[]') as Gasto[];
    const config = configParaNube(cargarConfig());
    await setDoc(doc(db, 'dt_sync', uidActual), {
      viajes,
      gastos,
      config,
      actualizadoEn,
      dispositivo: DISPOSITIVO,
      origen: 'ridertrack-v2',
    });
    localStorage.setItem(K_SYNC_EN, String(actualizadoEn));
    notificar('sincronizado');
  } catch (e) {
    console.warn('☁️ [DT sync] No pude subir:', e);
    notificar('error');
    // reintento más lento (la app sigue andando local igual)
    if (pushTimer) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(empujar, 20000);
  }
}

function programarPush() {
  if (!uidActual) return;
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(empujar, DELAY_PUSH);
}

/** Aplica lo que bajó de la nube al localStorage y avisa a las vistas */
function aplicarRemoto(data: {
  viajes?: Viaje[];
  gastos?: Gasto[];
  config?: Partial<ConfigDT>;
  actualizadoEn?: number;
}) {
  try {
    if (Array.isArray(data.viajes)) {
      // merge: las rutas GPS locales se conservan para los viajes que ya tenía
      const locales = JSON.parse(localStorage.getItem('dt_viajes_v1') || '[]') as Viaje[];
      const rutasLocales = new Map(locales.map(v => [v.id, v.ruta]));
      const remotos = data.viajes.map(v => {
        const rutaLocal = rutasLocales.get(v.id);
        return rutaLocal && rutaLocal.length >= 2 ? { ...v, ruta: rutaLocal } : v;
      });
      guardarViajes(remotos);
    }
    if (Array.isArray(data.gastos)) guardarGastos(data.gastos);
    if (data.config) {
      // merge sobre la local → las keys de IA del teléfono se conservan
      const merge = normalizarConfig({ ...cargarConfig(), ...data.config } as Partial<ConfigDT>);
      guardarConfig(merge);
    }
    localStorage.setItem(K_SYNC_EN, String(data.actualizadoEn || Date.now()));
    // las vistas (shell DT + paneles del panel general) se recargan solas
    window.dispatchEvent(new CustomEvent('dt:sync-remoto'));
    notificar('sincronizado');
  } catch (e) {
    console.warn('☁️ [DT sync] No pude aplicar lo de la nube:', e);
    notificar('error');
  }
}

/**
 * Arranca/para el sync según la sesión. Llamar con el uid del rider
 * logueado (o null al cerrar sesión). Idempotente: si el uid no
 * cambió, no hace nada.
 */
export function iniciarSyncDT(uid: string | null) {
  if (uid === uidActual) return;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (pushTimer) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
  }
  uidActual = uid;
  if (!uid) {
    notificar('sin-sesion');
    return;
  }
  notificar('pendiente');
  try {
    unsubscribe = onSnapshot(
      doc(db, 'dt_sync', uid),
      snap => {
        if (!uidActual) return;
        const data = snap.data() as
          | { viajes?: Viaje[]; gastos?: Gasto[]; config?: Partial<ConfigDT>; actualizadoEn?: number; dispositivo?: string }
          | undefined;
        if (!data || !data.actualizadoEn) {
          // no hay nada en la nube todavía → subo lo local (primer cel)
          programarPush();
          return;
        }
        if (data.dispositivo === DISPOSITIVO) return; // mi propio eco
        const localEn = Number(localStorage.getItem(K_SYNC_EN) || 0);
        if (Number(data.actualizadoEn) <= localEn) return; // ya tengo algo más nuevo
        aplicarRemoto(data);
      },
      err => {
        console.warn('☁️ [DT sync] listener:', err);
        notificar('error');
      },
    );
  } catch (e) {
    console.warn('☁️ [DT sync] no pude suscribirme:', e);
    notificar('error');
  }
}

/**
 * Lo llaman guardarViajes/guardarGastos/guardarConfig (storage.ts)
 * cada vez que algo cambia → programa la subida con debounce.
 */
export function avisarCambioDT() {
  if (!uidActual) return; // sin sesión: todo queda local como siempre
  notificar('pendiente');
  programarPush();
}

/** Fuerza una subida ya (botón "sincronizar ahora" en Ajustes) */
export function forzarSyncDT() {
  if (!uidActual) return false;
  if (pushTimer) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
  }
  void empujar();
  return true;
}
