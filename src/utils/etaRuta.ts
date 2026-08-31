// ═══════════════════════════════════════════════════════════
// ⏱️ ETA DE RUTA ESTILO CIRCUIT — Fase 2.9
// La hora de fin ya NO es solo "min por parada × paradas":
// ahora incluye el VIAJE ENTRE PARADAS (tramos), calculado con
// las coordenadas geocodificadas de cada cliente (haversine ×
// factor vial ÷ velocidad según tráfico) — igual que Circuit.
// Además, un FACTOR DE RITMO REAL compara lo que planeaste con
// lo que llevas: si vas más rápido, la hora de fin BAJA solita
// (5:00 → 4:30 → 3:00); si te retrasas, sube.
// ═══════════════════════════════════════════════════════════

import type { Cliente } from '../services/firestore';
import { haversineKm, FACTOR_VIAL } from '../services/routeOptimizer';

// ── Preferencias (localStorage) ─────────────────────────────

export const VELOCIDAD_KEY = 'rt_velocidad_kmh';
/** km/h: 15 = tranquilo con tráfico · 18 = normal Lima · 22 = fluido */
export const VELOCIDAD_OPCIONES = [15, 18, 22] as const;
export const VELOCIDAD_ETIQUETAS: Record<number, string> = {
  15: 'Tranquilo',
  18: 'Normal',
  22: 'Fluido',
};
export const VELOCIDAD_DEFECTO = 18;

/** Tramo asumido cuando NO hay coordenadas de ninguna parada (km) */
export const FALLBACK_LEG_KM = 3.5;

export function leerVelocidadKmh(): number {
  try {
    const v = Number(localStorage.getItem(VELOCIDAD_KEY));
    return (VELOCIDAD_OPCIONES as readonly number[]).includes(v) ? v : VELOCIDAD_DEFECTO;
  } catch {
    return VELOCIDAD_DEFECTO;
  }
}

export function guardarVelocidadKmh(v: number) {
  try {
    localStorage.setItem(VELOCIDAD_KEY, String(v));
  } catch {}
}

// ── Plan de ruta ────────────────────────────────────────────

export interface PlanParada {
  cliente: Cliente;
  /** segundos de MANEJO hasta esta parada (tramo desde la anterior) */
  viajeSeg: number;
  /** segundos de ATENCIÓN en la parada (lo que tardas cobrando) */
  servicioSeg: number;
  /** true si el tramo se midió con coordenadas reales */
  exacto: boolean;
}

export interface PlanRuta {
  /** paradas en orden de ruta (num ascendente) */
  paradas: PlanParada[];
  /** segundos totales de manejo */
  viajeTotalSeg: number;
  /** segundos totales de atención */
  servicioTotalSeg: number;
  /** minutos promedio de manejo por tramo */
  viajePromedioMin: number;
  /** km totales estimados de la ruta */
  kmEstimados: number;
  /** tramos medidos con coordenadas reales (de N-1 posibles) */
  tramosExactos: number;
  /** paradas sin coordenadas */
  sinUbicar: number;
}

function coordsDe(c: Cliente): { lat: number; lng: number } | null {
  return typeof c.lat === 'number' && typeof c.lng === 'number' && !Number.isNaN(c.lat) && !Number.isNaN(c.lng)
    ? { lat: c.lat, lng: c.lng }
    : null;
}

/**
 * Construye el plan de la ruta: por cada parada, cuánto se maneja
 * hasta ella y cuánto se atiende ahí.
 *
 * · Tramo con coordenadas (ambas paradas): haversine × FACTOR_VIAL
 *   ÷ velocidad del tráfico → minutos reales aproximados.
 * · Tramo sin coordenadas: si hay tramos medidos se usa el
 *   PROMEDIO de ellos (adaptativo); si no hay ninguno, 3 km.
 */
export function planificarRuta(
  clientesOrdenados: Cliente[],
  minPorParadaMin: number,
  velocidadKmh: number
): PlanRuta {
  const n = clientesOrdenados.length;
  const vacio: PlanRuta = {
    paradas: [],
    viajeTotalSeg: 0,
    servicioTotalSeg: 0,
    viajePromedioMin: 0,
    kmEstimados: 0,
    tramosExactos: 0,
    sinUbicar: 0,
  };
  if (n === 0) return vacio;

  const coords = clientesOrdenados.map(coordsDe);

  // Distancias reales de los tramos que SÍ tienen ambas puntas
  const distsReales: number[] = [];
  for (let i = 1; i < n; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    if (a && b) distsReales.push(haversineKm(a, b) * FACTOR_VIAL);
  }
  const kmFallback =
    distsReales.length > 0
      ? distsReales.reduce((s, d) => s + d, 0) / distsReales.length
      : FALLBACK_LEG_KM;

  const segPorKm = 3600 / Math.max(8, velocidadKmh);
  const paradas: PlanParada[] = [];
  let viajeTotalSeg = 0;
  let servicioTotalSeg = 0;
  let kmEstimados = 0;
  let tramosExactos = 0;
  let sinUbicar = 0;

  for (let i = 0; i < n; i++) {
    const c = clientesOrdenados[i];
    if (!coords[i]) sinUbicar++;

    let km = 0;
    let exacto = false;
    if (i > 0) {
      const a = coords[i - 1];
      const b = coords[i];
      if (a && b) {
        km = haversineKm(a, b) * FACTOR_VIAL;
        exacto = true;
        tramosExactos++;
      } else {
        km = kmFallback;
      }
    }
    // i === 0 → viaje 0: la salida de tu base hasta la 1ª parada
    // no se cuenta (no sabemos desde dónde partes).

    const viajeSeg = km * segPorKm;
    const servicioSeg = Math.max(1, minPorParadaMin) * 60;
    paradas.push({ cliente: c, viajeSeg, servicioSeg, exacto });
    viajeTotalSeg += viajeSeg;
    servicioTotalSeg += servicioSeg;
    kmEstimados += km;
  }

  const tramos = Math.max(0, n - 1);
  return {
    paradas,
    viajeTotalSeg,
    servicioTotalSeg,
    viajePromedioMin: tramos > 0 ? (viajeTotalSeg / tramos) / 60 : 0,
    kmEstimados: Math.round(kmEstimados * 10) / 10,
    tramosExactos,
    sinUbicar,
  };
}

// ── Factor de ritmo real (Circuit: la hora de fin baja solita) ──

/**
 * Compara lo que LLEVAS de ruta (cronómetro) con lo que se había
 * PLANIFICADO para las paradas ya atendidas:
 *
 *   factor = (crono + prior) / (planHecho + prior)
 *
 * · factor < 1 → vas más rápido que lo previsto → la hora de fin BAJA.
 * · factor > 1 → vas más lento / te demoraste → la hora de fin SUBE.
 * · prior (bayesiano) evita que la 1ª entrega rápida hunda el cálculo.
 * · Sin cronómetro → 1 (plan puro).
 */
export function factorRitmo(rutaMs: number, planHechoMs: number, priorMs: number): number {
  if (rutaMs <= 0) return 1;
  const prior = Math.max(60_000, priorMs);
  const f = (rutaMs + prior) / (Math.max(0, planHechoMs) + prior);
  return Math.min(2.5, Math.max(0.5, f));
}

/** Chip "vas más rápido/lento" — null si el ritmo va como lo previsto */
export function mensajeRitmo(factor: number): string | null {
  if (factor <= 0.93) return `⚡ Vas ${Math.round((1 - factor) * 100)}% más rápido que lo previsto`;
  if (factor >= 1.07) return `🐢 Vas ${Math.round((factor - 1) * 100)}% más lento que lo previsto`;
  return null;
}
