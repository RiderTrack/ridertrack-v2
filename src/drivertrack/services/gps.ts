// ═══════════════════════════════════════════════════════════
// 📍 DriverTrack — Servicio GPS (F-ID3)
// Graba los km REALES de cada viaje mientras manejás:
//   ▶ apretás 📍 en un viaje → watchPosition empieza a sumar
//     distancia entre puntos (haversine) con filtros anti-ruido
//   ■ Detener → los km + el tiempo + el trazado quedan guardados
//     EN ese viaje y se dibujan en la pestaña Mapa
// El estado vive en localStorage → si la app se recarga (o el
// teléfono la mata por memoria), al volver SIGUE grabando.
// ═══════════════════════════════════════════════════════════
import type { PuntoRuta } from '../types';

const K_GPS = 'dt_gps_activo';

/** El seguimiento en curso (o null si no hay ninguno) */
export interface EstadoGPS {
  viajeId: string;   // a qué viaje se le están grabando los km
  inicioTs: number;  // epoch ms — cuándo arrancó (para el cronómetro)
  km: number;        // km acumulados (haversine entre puntos aceptados)
  puntos: PuntoRuta[]; // el trazado para el mapa
}

export function leerEstadoGPS(): EstadoGPS | null {
  try {
    const raw = localStorage.getItem(K_GPS);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoGPS;
    if (!e?.viajeId || typeof e.km !== 'number' || !Array.isArray(e.puntos)) return null;
    return e;
  } catch {
    return null;
  }
}

export function guardarEstadoGPS(e: EstadoGPS): void {
  try {
    localStorage.setItem(K_GPS, JSON.stringify(e));
  } catch {
    /* sin espacio: la app sigue andando, solo pierde el redraw */
  }
}

export function borrarEstadoGPS(): void {
  try {
    localStorage.removeItem(K_GPS);
  } catch {
    /* nada */
  }
}

// ── Geometría ──────────────────────────────────────────────

/** Distancia Haversine en km entre dos coordenadas */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // radio terrestre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── Filtros anti-ruido ─────────────────────────────────────
// El GPS del teléfono "tiembla": sin filtros, un viaje parado en
// un semáforo sumaría cientos de metros fantasma.
const PRECISION_MAX_M = 40;   // fix con precisión peor a 40 m: se ignora
const PASO_MIN_KM = 0.008;    // menos de 8 m desde el último punto: quieto
const SALTO_MAX_KM = 5;       // más de 5 km de un golpe: teletransporte (glitch), se ignora
const MAX_PUNTOS = 1500;      // tope del trazado (~50 KB en localStorage)

/**
 * Procesa una posición nueva del GPS. Devuelve el estado actualizado
 * (o el mismo si el punto se descartó) y si se aceptó.
 */
export function registrarPunto(
  est: EstadoGPS,
  lat: number,
  lng: number,
  precisionM: number,
): { estado: EstadoGPS; aceptado: boolean } {
  if (precisionM > PRECISION_MAX_M) return { estado: est, aceptado: false };

  const ultimo = est.puntos[est.puntos.length - 1];
  let km = est.km;
  if (ultimo) {
    const d = haversineKm(ultimo.lat, ultimo.lng, lat, lng);
    if (d < PASO_MIN_KM) return { estado: est, aceptado: false }; // quieto / jitter
    if (d > SALTO_MAX_KM) return { estado: est, aceptado: false }; // glitch
    km = est.km + d;
  }

  let puntos: PuntoRuta[] = [
    ...est.puntos,
    { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, t: Math.floor(Date.now() / 1000) },
  ];
  // ¿Tope? Se decima a la mitad (queda el doble de espacio, no se
  // pierde ni el arranque ni la llegada)
  if (puntos.length > MAX_PUNTOS) puntos = puntos.filter((_, i) => i % 2 === 0 || i === puntos.length - 1);

  return { estado: { ...est, km, puntos }, aceptado: true };
}

/** Duración de movimiento real: del primer al último punto aceptado */
export function duracionMovimientoSeg(est: EstadoGPS): number {
  if (est.puntos.length >= 2) {
    return Math.max(1, est.puntos[est.puntos.length - 1].t - est.puntos[0].t);
  }
  return Math.max(1, Math.round((Date.now() - est.inicioTs) / 1000));
}

// ── Formato ────────────────────────────────────────────────

/** "12 min" · "1 h 5 min" · "45 s" */
export function formatearDuracion(seg: number): string {
  if (seg < 60) return `${Math.round(seg)} s`;
  const m = Math.round(seg / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** "MM:SS" o "H:MM:SS" para el cronómetro en vivo */
export function formatearReloj(ms: number): string {
  const totalSeg = Math.floor(ms / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
