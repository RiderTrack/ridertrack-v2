// ═══════════════════════════════════════════════════════════
// 🎨 ESTUDIO DE TEMAS — RiderTrack V2 · F3.51
// Módulo: motor.ts — lógica pura + aplicación al documento
// ═══════════════════════════════════════════════════════════
// Todo lo que NO es React vive aquí (fácil de probar con el
// smoke test). Las funciones de DOM reciben `doc`/`storage`
// inyectables para poder testearlas sin navegador.
// ═══════════════════════════════════════════════════════════

import {
  ACENTOS,
  FUENTES,
  FONDOS,
  RADIOS,
  URL_GOOGLE_FONTS,
} from './catalogo';
import {
  CLAVE_TEMA,
  CLAVE_TEMA_LEGADO,
  CONFIG_DEFECTO,
  ESCALA_MAX,
  ESCALA_MIN,
  type AcentoId,
  type ConfigTema,
  type FondoId,
  type FuenteId,
  type ModoTema,
  type RadioId,
} from './tipos';
import type { ThemeMode } from '../types';

// ─────────────────────────────────────────────
// ✅ VALIDACIÓN / NORMALIZACIÓN
// ─────────────────────────────────────────────

const MODOS: ModoTema[] = ['dark', 'light', 'auto'];

/** ¿El valor es un acento del catálogo? */
export const esAcentoValido = (v: unknown): v is AcentoId =>
  ACENTOS.some((a) => a.id === v);

/** ¿El valor es una fuente del catálogo? */
export const esFuenteValida = (v: unknown): v is FuenteId =>
  FUENTES.some((f) => f.id === v);

/** ¿El valor es un fondo del catálogo? */
export const esFondoValido = (v: unknown): v is FondoId =>
  FONDOS.some((f) => f.id === v);

/** ¿El valor es un redondeo del catálogo? */
export const esRadioValido = (v: unknown): v is RadioId =>
  RADIOS.some((r) => r.id === v);

/**
 * Convierte "cualquier cosa" (JSON viejo, datos corruptos, un
 * parcial) en una ConfigTema COMPLETA y válida: lo desconocido
 * cae al valor de fábrica y la escala se recorta al rango.
 */
export function normalizarConfig(bruto: unknown): ConfigTema {
  const base = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>;
  const modo = MODOS.includes(base.modo as ModoTema) ? (base.modo as ModoTema) : CONFIG_DEFECTO.modo;
  const escalaCruda = typeof base.escala === 'number' ? base.escala : CONFIG_DEFECTO.escala;
  const escala = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, Math.round(escalaCruda * 100) / 100));
  return {
    modo,
    acento: esAcentoValido(base.acento) ? base.acento : CONFIG_DEFECTO.acento,
    fuente: esFuenteValida(base.fuente) ? base.fuente : CONFIG_DEFECTO.fuente,
    escala,
    fondo: esFondoValido(base.fondo) ? base.fondo : CONFIG_DEFECTO.fondo,
    radio: esRadioValido(base.radio) ? base.radio : CONFIG_DEFECTO.radio,
  };
}

/**
 * Modo efectivo: `auto` se resuelve con la preferencia del
 * teléfono (claro del sistema → light, si no → dark).
 */
export function resolverModo(modo: ModoTema, sistemaPrefiereClaro: boolean): ThemeMode {
  if (modo === 'auto') return sistemaPrefiereClaro ? 'light' : 'dark';
  return modo;
}

// ─────────────────────────────────────────────
// 💾 PERSISTENCIA (storage inyectable)
// ─────────────────────────────────────────────

/** Interfaz mínima de localStorage (para tests). */
export interface Almacenamiento {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** Lee la config guardada; migra la clave vieja rt_theme si es
 *  la primera vez y no existe rt2_tema. Siempre devuelve config
 *  válida (nunca rompe la app por datos corruptos). */
export function cargarTemaGuardado(storage: Almacenamiento): ConfigTema {
  try {
    const crudo = storage.getItem(CLAVE_TEMA);
    if (crudo) return normalizarConfig(JSON.parse(crudo));
    // Migración desde la fase 1.5: rt_theme='light' → modo claro
    const legado = storage.getItem(CLAVE_TEMA_LEGADO);
    if (legado === 'light') return normalizarConfig({ ...CONFIG_DEFECTO, modo: 'light' });
  } catch {
    // JSON corrupto / storage bloqueado → fábrica
  }
  return { ...CONFIG_DEFECTO };
}

/** Guarda la config completa Y la clave legado (por si algo
 *  viejo la lee). Nunca lanza. */
export function guardarTema(cfg: ConfigTema, storage: Almacenamiento): void {
  try {
    storage.setItem(CLAVE_TEMA, JSON.stringify(cfg));
    storage.setItem(CLAVE_TEMA_LEGADO, resolverModo(cfg.modo, false));
  } catch {
    // sin storage (modo privado): la app sigue funcionando
  }
}

// ─────────────────────────────────────────────
// 🖥️ APLICACIÓN AL DOCUMENTO (doc inyectable)
// ─────────────────────────────────────────────

/** Lo mínimo de document que el motor necesita (para tests). */
export interface DocumentoMinimo {
  documentElement: {
    classList: { add(...c: string[]): void; remove(...c: string[]): void };
    dataset: Record<string, string>;
    style: { setProperty(n: string, v: string): void };
  };
  querySelector(sel: string): { setAttribute(n: string, v: string): void } | null;
  createElement(tag: string): {
    id: string;
    rel: string;
    href: string;
    crossOrigin: string | null;
  };
  head: { appendChild(el: unknown): void; contains(el: unknown): boolean };
  getElementById(id: string): unknown | null;
}

/**
 * Aplica la configuración al documento: clase .light/.dark (el
 * sistema de la fase 1.5 sigue mandando), data-atributos para
 * acento/fuente/fondo/radio, var --escala-letra, meta
 * theme-color del navegador y la etiqueta de Google Fonts.
 */
export function aplicarTemaEnDocumento(cfg: ConfigTema, doc: DocumentoMinimo): void {
  const root = doc.documentElement;
  const modo = cfg.modo === 'light' ? 'light' : 'dark';

  // 1) Clases de modo (mismo mecanismo de la fase 1.5)
  root.classList.remove('light', 'dark');
  root.classList.add(modo);

  // 2) Data-atributos que el CSS de index.css (sección F3.51) lee
  root.dataset.acento = cfg.acento;
  root.dataset.fuente = cfg.fuente;
  root.dataset.fondo = cfg.fondo;
  root.dataset.radio = cfg.radio;

  // 3) Escala de letra (rem-based: TODO escala junto)
  root.style.setProperty('--escala-letra', String(cfg.escala));

  // 4) Barra del navegador/APK acompaña al modo
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', modo === 'light' ? '#e8eef6' : '#0f172a');

  // 5) Google Fonts: UNA sola etiqueta con todas las familias
  inyectarGoogleFonts(doc);
}

/** Inserta preconnect + link de fuentes una sola vez (id fijo). */
export function inyectarGoogleFonts(doc: DocumentoMinimo): void {
  const ID_LINK = 'rt-fuentes-web';
  if (doc.getElementById(ID_LINK)) return;

  const pre1 = doc.createElement('link');
  pre1.id = 'rt-fuentes-preconnect-1';
  pre1.rel = 'preconnect';
  pre1.href = 'https://fonts.googleapis.com';
  doc.head.appendChild(pre1);

  const pre2 = doc.createElement('link');
  pre2.id = 'rt-fuentes-preconnect-2';
  pre2.rel = 'preconnect';
  pre2.href = 'https://fonts.gstatic.com';
  pre2.crossOrigin = 'anonymous';
  doc.head.appendChild(pre2);

  const link = doc.createElement('link');
  link.id = ID_LINK;
  link.rel = 'stylesheet';
  link.href = URL_GOOGLE_FONTS;
  doc.head.appendChild(link);
}

// ─────────────────────────────────────────────
// 🚀 ARRANQUE SIN PARPADEO
// ─────────────────────────────────────────────
// Se ejecuta al importar este módulo (antes del primer render
// de React): así la app NUNCA arranca con el tema incorrecto
// ni "parpadea" blanca un segundo. En APK y web por igual.
// ─────────────────────────────────────────────
export function aplicarTemaInicial(): void {
  if (typeof document === 'undefined') return; // SSR / tests
  aplicarTemaEnDocumento(cargarTemaGuardado(localStorage), document);
}

aplicarTemaInicial();
