// ═══════════════════════════════════════════════════════════
// ⚡ VELOCIDAD GPS — RiderTrack V2 (Fase 3.36)
// ───────────────────────────────────────────────────────────
// La matemática del velocímetro y el odómetro, PURA (sin React)
// para poder testearla con node a solas.
//
// ⚠️ HISTORIA DEL BUG: hasta la 3.35 la app calculaba la
// velocidad con √(a³ + b³) en vez de Pitágoras √(a² + b²) y
// medía el tiempo con Date.now() de RECEPCIÓN (no el timestamp
// del fix). Además descartaba `coords.speed` (doppler del chip,
// la medición EXACTA que usan Waze/Google Maps). Resultado:
// marcaba 5-10 km/h cuando el rider iba a 40-50.
//
// AHORA, en orden de confianza:
//   1. coords.speed (doppler) → ×3.6, exacta
//   2. Pitágoras correcto entre fixes + Δt del timestamp del fix
// Y todo pasa por un suavizado EMA para que el número no tiemble.
// ═══════════════════════════════════════════════════════════

import type { Coordenadas } from '../services/geocoding';

export interface Fix {
  c: Coordenadas;
  t: number; // ms epoch — el timestamp DEL FIX (c.ts), no de recepción
}

export interface LecturaVelocidad {
  /** km/h suavizada y lista para mostrar (0-120) */
  kmh: number;
  /** km/h cruda de esta medición (antes del EMA) */
  kmhCruda: number;
  /** metros entre el fix anterior y este (Pitágoras) */
  distM: number;
  /** segundos entre fixes (por timestamp del fix) */
  dt: number;
  /** de dónde salió el número */
  tipo: 'doppler' | 'haversine' | 'parado' | 'ignorado';
}

// ── Constantes afinadas para moto en ciudad ──
export const VELO_MAX_KMH = 120;
/** Fixes más juntos que esto = ráfaga/cache repetido → se ignoran */
export const DT_MIN_S = 0.4;
/** Hueco mayor a esto sin fixes → no se calcula velocidad (GPS dormido) */
export const DT_MAX_S = 30;
/** Menos de esto entre fixes = parado (ruido GPS), velocidad → 0 */
export const DIST_QUIETO_M = 2;
/** Salto mayor a esto = teletransporte GPS (no cuenta para el odómetro) */
export const DIST_SALTO_M = 400;
/** Fix con precisión peor que esto no alimenta velocidad ni odómetro */
export const ACCURACY_MAX_M = 60;

/** Metros entre dos coordenadas (aprox local — Pitágoras CORRECTO) */
export function metrosEntre(a: Coordenadas, b: Coordenadas): number {
  const mLat = (a.lat - b.lat) * 111320;
  const cosLat = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const mLng = (a.lng - b.lng) * 111320 * cosLat;
  return Math.hypot(mLat, mLng);
}

/** Grados de rumbo de a→b (0 = norte, 90 = este) */
export function rumboEntre(a: Coordenadas, b: Coordenadas): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  const grados = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  return (grados + 360) % 360;
}

/**
 * Evalúa un fix nuevo contra el anterior y devuelve la lectura de
 * velocidad. `velActual` entra solo para que el EMA viva aquí.
 * No muta nada — el hook decide qué hacer con el resultado.
 */
export function evaluarFix(prev: Fix | null, actual: Fix, velActualKmh: number): LecturaVelocidad {
  const dt = prev ? (actual.t - prev.t) / 1000 : 0;
  const distM = prev ? metrosEntre(actual.c, prev.c) : 0;

  // Sin anterior, o fixes en ráfaga (cache entregado varias veces):
  // nada que calcular — que el caller conserve la velocidad actual.
  if (!prev || dt < DT_MIN_S) {
    return { kmh: velActualKmh, kmhCruda: velActualKmh, distM, dt, tipo: 'ignorado' };
  }

  // ⚡ 1) DOPPLER del chip GPS — exacta (m/s → km/h)
  if (typeof actual.c.speed === 'number' && actual.c.speed >= 0) {
    const cruda = actual.c.speed * 3.6;
    return {
      kmh: ema(velActualKmh, cruda, 0.5),
      kmhCruda: cruda,
      distM,
      dt,
      tipo: 'doppler',
    };
  }

  // GPS dormido / pantallazo de fondo: no inventar velocidad
  if (dt > DT_MAX_S) {
    return { kmh: 0, kmhCruda: 0, distM, dt, tipo: 'ignorado' };
  }

  // 🅿️ Parado (menos de DIST_QUIETO_M entre fixes = ruido)
  if (distM < DIST_QUIETO_M) {
    return { kmh: ema(velActualKmh, 0, 0.4), kmhCruda: 0, distM, dt, tipo: 'parado' };
  }

  // 📐 2) Pitágoras correcto con Δt del timestamp del fix
  const cruda = (distM / dt) * 3.6;
  return {
    kmh: ema(velActualKmh, cruda, 0.35),
    kmhCruda: cruda,
    distM,
    dt,
    tipo: 'haversine',
  };
}

/** Media móvil exponencial — suaviza sin retrasar como un promedio */
export function ema(actual: number, nuevo: number, alfa: number): number {
  return actual + (nuevo - actual) * alfa;
}

/** ¿Este fix es confiable para ACUMULAR kilómetros? */
export function fixContable(f: Fix, prev: Fix | null, distM: number, dt: number): boolean {
  if (typeof f.c.accuracy === 'number' && f.c.accuracy > ACCURACY_MAX_M) return false;
  if (!prev) return false;
  if (dt > DT_MAX_S) return false; // GPS dormido: hay hueco, no es distancia continua
  if (distM > DIST_SALTO_M) return false; // teletransporte
  if (distM < 1) return false; // ruido puro
  return true;
}

/** Suaviza el rumbo para que la flecha no salte (interp. angular) */
export function suavizarRumbo(prev: number | null, nuevo: number): number {
  if (prev == null) return nuevo;
  let diff = nuevo - prev;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return (prev + diff * 0.6 + 360) % 360;
}

/** Fecha local YYYY-MM-DD (para el odómetro que se resetea cada día) */
export function claveDia(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const capKmh = (v: number): number => Math.max(0, Math.min(VELO_MAX_KMH, v));
