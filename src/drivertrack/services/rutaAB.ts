// ═══════════════════════════════════════════════════════════
// 🛣️ FASE F: Ruta A → B de un viaje inDrive — km/min SOLOS
// ═══════════════════════════════════════════════════════════
// Rudy ubicó el punto A (recojo) y el punto B (entrega) en el
// mapa → ahora la app le dice SOLA cuántos km hay entre los dos
// (y cuántos minutos), sin abrir Google Maps a mirar:
//
//   • Si Google Directions responde (misma API del panel de
//     trabajo, con su respaldo CapacitorHttp → fetch → SDK):
//     km y minutos REALES por calles + la GEOMETRÍA de la ruta
//     para dibujar la línea de recorrido en el mapa igual que
//     la del trabajo.
//   • Si Google no contesta (sin internet, sin API): el mismo
//     estimado que usaba el trabajo antes de Google — línea
//     recta (haversine) × 1.35 de factor de calles, y minutos
//     a ritmo de moto en Lima (~22 km/h).
//
// Caché en localStorage (clave dt_ruta_ab_v1): la misma pareja
// de pines NUNCA se vuelve a pedir. Las rutas de Google se
// guardan 30 días; los estimados de emergencia solo 30 minutos
// — así, cuando vuelva el internet, la próxima pasada la
// refina con los km reales de Google.
// ═══════════════════════════════════════════════════════════
import { obtenerInstruccionesGoogle } from '../../services/googleDirections';
import { haversineKm } from '../../services/routeOptimizer';

export interface PuntoAB {
  lat: number;
  lng: number;
}

export interface RutaAB {
  /** km entre A y B (por calles si Google contestó, estimado si no) */
  km: number;
  /** minutos estimados de manejo */
  min: number;
  /** geometría por calles para dibujar la línea (null = línea recta) */
  puntos: Array<{ lat: number; lng: number }> | null;
  /** 'google' = km reales por calles · 'estimado' = recta × 1.35 */
  fuente: 'google' | 'estimado';
}

const K_CACHE = 'dt_ruta_ab_v1';
const MAX_CACHE = 40; // viajes recientes — liviano para el localStorage
const TTL_GOOGLE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const TTL_ESTIMADO_MS = 30 * 60 * 1000; // 30 min → reintenta Google después
const FACTOR_CALLES = 1.35; // el mismo estimado del trabajo pre-Google
const KM_H_MOTO = 22; // ritmo promedio de moto en el tráfico de Lima
const MAX_PUNTOS = 400; // la geometría no pesa ni medio KB comprimida

/** La clave del caché: los dos pines redondeados (5 dec ≈ 1 m) */
export function claveAB(a: PuntoAB, b: PuntoAB): string {
  const p = (x: PuntoAB) => `${x.lat.toFixed(5)},${x.lng.toFixed(5)}`;
  return `${p(a)}>${p(b)}`;
}

// ── Storage inyectable (los tests corren en Node sin localStorage) ──
interface StorageSimple {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}
function storageReal(): StorageSimple | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
    return null;
  } catch {
    return null;
  }
}
let _storage: StorageSimple | null = storageReal();

// ── Google inyectable para los tests (mismo patrón que googleDirections) ──
let _obtenerInstrucciones: typeof obtenerInstruccionesGoogle = obtenerInstruccionesGoogle;

export const __rutaABTests = {
  setStorage(s: StorageSimple | null) {
    _storage = s;
  },
  setObtenerInstrucciones(fn: typeof obtenerInstruccionesGoogle) {
    _obtenerInstrucciones = fn;
  },
  restaurar() {
    _storage = storageReal();
    _obtenerInstrucciones = obtenerInstruccionesGoogle;
    _enVuelo.clear();
  },
};

interface EntradaCache {
  km: number;
  min: number;
  puntos: Array<{ lat: number; lng: number }> | null;
  fuente: 'google' | 'estimado';
  ts: number;
}

function leerCache(): Record<string, EntradaCache> {
  try {
    const raw = _storage?.getItem(K_CACHE);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function escribirCache(cache: Record<string, EntradaCache>): void {
  if (!_storage) return;
  try {
    const claves = Object.keys(cache);
    if (claves.length > MAX_CACHE) {
      // se quedan las más recientes
      const ordenadas = claves.sort((x, y) => (cache[y]?.ts || 0) - (cache[x]?.ts || 0)).slice(0, MAX_CACHE);
      const nueva: Record<string, EntradaCache> = {};
      for (const k of ordenadas) nueva[k] = cache[k];
      _storage.setItem(K_CACHE, JSON.stringify(nueva));
      return;
    }
    _storage.setItem(K_CACHE, JSON.stringify(cache));
  } catch {
    // sin espacio → se vive sin caché
  }
}

// Una misma pareja de pines nunca se pide dos veces en simultáneo
const _enVuelo = new Map<string, Promise<RutaAB | null>>();

/** El estimado de emergencia: recta × 1.35 + minutos a ritmo de moto */
export function estimarRectaAB(a: PuntoAB, b: PuntoAB): RutaAB {
  const recta = haversineKm(a, b);
  const km = Math.round(recta * FACTOR_CALLES * 10) / 10;
  const min = Math.max(1, Math.round((km / KM_H_MOTO) * 60));
  return { km, min, puntos: null, fuente: 'estimado' };
}

/**
 * Calcula (o reusa del caché) la ruta A → B de un viaje.
 * Devuelve null si los pines son inválidos o caen en el mismo punto.
 * NUNCA rechaza: sin internet cae al estimado de la recta.
 */
export async function calcularRutaAB(a: PuntoAB | null | undefined, b: PuntoAB | null | undefined): Promise<RutaAB | null> {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) {
    return null;
  }
  const clave = claveAB(a, b);
  if (claveAB(a, b) === claveAB(a, a)) return null; // A y B en el mismo punto

  // 1. Caché vigente
  const cache = leerCache();
  const hit = cache[clave];
  if (hit) {
    const ttl = hit.fuente === 'google' ? TTL_GOOGLE_MS : TTL_ESTIMADO_MS;
    if (Date.now() - hit.ts < ttl && hit.km > 0) {
      return { km: hit.km, min: hit.min, puntos: hit.puntos ?? null, fuente: hit.fuente };
    }
  }

  // 2. ¿Ya hay un pedido en curso para esta misma pareja? → úsalo
  const enVuelo = _enVuelo.get(clave);
  if (enVuelo) return enVuelo;

  // 3. Pedir la ruta (con su respaldo de emergencia)
  const promesa = (async (): Promise<RutaAB | null> => {
    let resultado: RutaAB | null = null;
    try {
      const google = await _obtenerInstrucciones(a, b);
      if (google && google.distanciaKm > 0 && google.puntos?.length) {
        resultado = {
          km: google.distanciaKm,
          min: Math.max(1, Math.round(google.tiempoMin)),
          // la geometría se recorta para que el caché no pese
          puntos: google.puntos.slice(0, MAX_PUNTOS),
          fuente: 'google',
        };
      }
    } catch {
      // sin Google → estimado
    }
    if (!resultado) resultado = estimarRectaAB(a, b);

    // guardar en caché (google = 30 días, estimado = 30 min)
    const cacheNueva = leerCache();
    cacheNueva[clave] = { ...resultado, puntos: resultado.puntos, ts: Date.now() };
    escribirCache(cacheNueva);
    return resultado;
  })();

  _enVuelo.set(clave, promesa);
  try {
    return await promesa;
  } finally {
    _enVuelo.delete(clave);
  }
}
