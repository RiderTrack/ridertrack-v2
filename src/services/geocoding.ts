// ═══════════════════════════════════════════════════════════
// 🌐 SERVICIO GEOCODIFICACIÓN - RiderTrack V2 (Fase 1.3)
// Convierte direcciones ("Av. Larco 123, Miraflores") en
// coordenadas reales (lat/lng).
//
// Motores:
//   1. Google Geocoding API — si el usuario configuró una key
//      (Configuración → Mapas y Rutas). Más preciso en Perú.
//   2. Nominatim (OpenStreetMap) — gratis, sin key. CON cola
//      de 1 petición por segundo (límite oficial de Nominatim).
//
// ⚠️ REGLA DE ORO (lección del Modular): NUNCA inventar
// coordenadas. Si la geocodificación falla, se devuelve null y
// la UI lo muestra honestamente. El Modular "optimizaba" rutas
// con coordenadas falsas generadas por un hash de la dirección
// cuando Nominatim lo bloqueaba por saturación — eso terminó
// aquí: este servicio respeta el rate limit y no miente.
//
// Caché: localStorage (las direcciones no se mudan). Geocodificar
// 20 clientes 1 vez y reutilizar para siempre.
// ═══════════════════════════════════════════════════════════

export interface Coordenadas {
  lat: number;
  lng: number;
  src?: 'google' | 'nominatim' | 'manual';
}

interface EntradaCache {
  lat: number;
  lng: number;
  src: 'google' | 'nominatim' | 'manual';
  ts: number;
}

// ── Constantes ──────────────────────────────────────────────

const CACHE_KEY = 'rt_geocache_v1';
const GOOGLE_KEY_STORAGE = 'rt_google_maps_key';
const CACHE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 días
const CACHE_MAX_ENTRADAS = 800;

/** Nominatim permite máx 1 req/segundo. Usamos 1.15s de margen. */
const NOMINATIM_INTERVALO_MS = 1150;
const TIMEOUT_FETCH_MS = 10000;
const REINTENTOS_MAX = 2;

// ── API Key de Google (opcional, guardada en el dispositivo) ─

export function getGoogleApiKey(): string {
  try {
    return localStorage.getItem(GOOGLE_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setGoogleApiKey(key: string): void {
  try {
    const limpia = key.trim();
    if (limpia) {
      localStorage.setItem(GOOGLE_KEY_STORAGE, limpia);
    } else {
      localStorage.removeItem(GOOGLE_KEY_STORAGE);
    }
  } catch {
    // localStorage no disponible — seguir sin Google
  }
}

export function motorActivo(): 'google' | 'nominatim' {
  return getGoogleApiKey() ? 'google' : 'nominatim';
}

// ── Caché persistente ───────────────────────────────────────

function leerCache(): Record<string, EntradaCache> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function escribirCache(cache: Record<string, EntradaCache>): void {
  try {
    // Purgar si crece demasiado: quedarse con las más recientes
    const claves = Object.keys(cache);
    if (claves.length > CACHE_MAX_ENTRADAS) {
      const ahora = Date.now();
      const ordenadas = claves
        .sort((a, b) => (cache[b]?.ts || 0) - (cache[a]?.ts || 0))
        .slice(0, CACHE_MAX_ENTRADAS);
      const nueva: Record<string, EntradaCache> = {};
      for (const k of ordenadas) nueva[k] = cache[k];
      void ahora;
      localStorage.setItem(CACHE_KEY, JSON.stringify(nueva));
      return;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Si el storage se llena, la geocodificación sigue funcionando sin caché
  }
}

/** Nº de direcciones en caché (para mostrar en Configuración) */
export function tamanoCache(): number {
  return Object.keys(leerCache()).length;
}

/** Borra la caché — fuerza re-geocodificar todo (útil al activar Google) */
export function limpiarCacheGeocodificacion(): number {
  const n = tamanoCache();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // nada
  }
  return n;
}

// ── Normalización de direcciones ────────────────────────────

/**
 * Normaliza dirección+distrito para usar como clave de caché y
 * para construir la consulta. Elimina puntuación duplicada,
 * espacios extra y mayúsculas.
 */
export function normalizarConsulta(dir: string, dist?: string): string {
  // Limpiar cada parte: colapsar espacios, quitar comas/puntos y coma
  // sobrantes al inicio y al final, y símbolos que estorban a Nominatim
  const limpiar = (s: string) =>
    s
      .replace(/\s+/g, ' ')
      .replace(/[º°]/g, ' ')
      .replace(/^[,\s.]+|[,\s.]+$/g, '')
      .trim();

  const partes = [limpiar(dir || ''), limpiar(dist || ''), 'Lima', 'Perú'].filter(Boolean);

  let q = partes.join(', ');
  q = q.replace(/\s+/g, ' ');
  // Colapsar comas múltiples (incluso solapadas: ",,," → ",")
  while (/,\s*,/.test(q)) {
    q = q.replace(/,\s*,/g, ',');
  }
  return q.trim();
}

function claveCache(dir: string, dist?: string): string {
  return normalizarConsulta(dir, dist).toLowerCase();
}

// ── Cola de rate limit para Nominatim ───────────────────────

let ultimaPeticionNominatim = 0;
let cadenaNominatim: Promise<void> = Promise.resolve();

/**
 * Encola una función respetando 1 req/1.15s hacia Nominatim.
 * TODAS las peticiones a Nominatim pasan por aquí — este era el
 * bug raíz del Modular: disparaba 20 fetch en paralelo,
 * Nominatim respondía 403/429 y el fallback inventaba puntos.
 */
function conRateLimitNominatim<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = cadenaNominatim.then(async () => {
    const espera = NOMINATIM_INTERVALO_MS - (Date.now() - ultimaPeticionNominatim);
    if (espera > 0) {
      await new Promise((r) => setTimeout(r, espera));
    }
    ultimaPeticionNominatim = Date.now();
    return fn();
  });
  // La cadena nunca se rompe aunque una petición falle
  cadenaNominatim = resultado.then(() => undefined, () => undefined);
  return resultado;
}

// ── Fetch con timeout ───────────────────────────────────────

async function fetchConTimeout(url: string, ms = TIMEOUT_FETCH_MS): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// ── Motor 1: Google Geocoding API ───────────────────────────

async function geocodificarGoogle(consulta: string, apiKey: string): Promise<Coordenadas | null> {
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(consulta)}` +
    `&region=pe&key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetchConTimeout(url, 8000);
    const data = await res.json();
    if (data && data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
      const loc = data.results[0].geometry?.location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return { lat: loc.lat, lng: loc.lng, src: 'google' };
      }
    }
    return null; // ZERO_RESULTS, REQUEST_DENIED, etc.
  } catch {
    return null;
  }
}

// ── Motor 2: Nominatim (OpenStreetMap, gratis) ──────────────

async function geocodificarNominatim(consulta: string): Promise<Coordenadas | null> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2&limit=1&countrycodes=pe` +
    `&q=${encodeURIComponent(consulta)}`;

  for (let intento = 0; intento <= REINTENTOS_MAX; intento++) {
    try {
      const res = await conRateLimitNominatim(() => fetchConTimeout(url));
      if (res.status === 429 || res.status === 403) {
        // Bloqueado por rate limit — esperar y reintentar
        if (intento < REINTENTOS_MAX) {
          await new Promise((r) => setTimeout(r, 2500 * (intento + 1)));
          continue;
        }
        return null;
      }
      if (!res.ok) {
        if (intento < REINTENTOS_MAX) {
          await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
          continue;
        }
        return null;
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng, src: 'nominatim' };
        }
      }
      return null; // Sin resultados — dirección no encontrada (honesto)
    } catch {
      if (intento < REINTENTOS_MAX) {
        await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ── GPS del rider (posición real) ───────────────────────────

/**
 * Obtiene la posición GPS actual UNA vez (para la optimización
 * de ruta). Devuelve null si no hay permiso/señal — en ese caso
 * el optimizador parte del centro de Lima.
 *
 * Funciona en APK (plugin @capacitor/geolocation) y en navegador
 * (navigator.geolocation).
 */
export async function obtenerPosicionActual(timeoutMs = 6000): Promise<Coordenadas | null> {
  // 1. Plugin nativo de Capacitor (APK)
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({ timeout: timeoutMs, enableHighAccuracy: true });
      if (pos?.coords && !isNaN(pos.coords.latitude) && !isNaN(pos.coords.longitude)) {
        return { lat: pos.coords.latitude, lng: pos.coords.longitude, src: 'manual' };
      }
    }
  } catch {
    // Sin permiso o sin plugin — caer al navegador
  }

  // 2. API del navegador (WebView / web)
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        resolve(
          !isNaN(latitude) && !isNaN(longitude)
            ? { lat: latitude, lng: longitude, src: 'manual' }
            : null
        );
      },
      () => resolve(null),
      { timeout: timeoutMs, enableHighAccuracy: true, maximumAge: 30000 }
    );
  });
}

/**
 * Vigila la posición GPS en tiempo real (para el mapa en vivo).
 * Devuelve una función para dejar de vigilar.
 */
export function vigilarPosicion(
  onPosicion: (c: Coordenadas) => void,
  onError?: (msg: string) => void
): () => void {
  let cancelado = false;
  let limpiarNativo: (() => void) | null = null;

  // 1. Plugin nativo (APK) — mejor precisión y manejo de permisos
  import('@capacitor/core')
    .then(async ({ Capacitor }) => {
      if (cancelado || !Capacitor.isNativePlatform()) return;
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
          (pos, err) => {
            if (cancelado) return;
            if (pos?.coords && !isNaN(pos.coords.latitude)) {
              onPosicion({ lat: pos.coords.latitude, lng: pos.coords.longitude, src: 'manual' });
            } else if (err) {
              onError?.(String(err?.message || err));
            }
          }
        );
        limpiarNativo = () => {
          Geolocation.clearWatch({ id }).catch(() => undefined);
        };
      } catch (e) {
        onError?.(String(e));
      }
    })
    .catch(() => undefined);

  // 2. Navegador / WebView — siempre activo como respaldo
  let watchId: number | null = null;
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelado) return;
        const { latitude, longitude } = pos.coords;
        if (!isNaN(latitude) && !isNaN(longitude)) {
          onPosicion({ lat: latitude, lng: longitude, src: 'manual' });
        }
      },
      (err) => {
        if (!cancelado) onError?.(err.message || 'GPS no disponible');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }

  return () => {
    cancelado = true;
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
    limpiarNativo?.();
  };
}

// ── API pública ─────────────────────────────────────────────

/**
 * Geocodifica una dirección. Orden:
 *   1. Caché local (instantáneo, gratis, sin red)
 *   2. Google (si hay key) → se guarda en caché
 *   3. Nominatim (con rate limit) → se guarda en caché
 *   4. null — falló todo. NUNCA se inventan coordenadas.
 */
export async function geocodificarDireccion(dir: string, dist?: string): Promise<Coordenadas | null> {
  if (!dir || !dir.trim()) return null;

  const consulta = normalizarConsulta(dir, dist);
  if (!consulta) return null;
  const clave = claveCache(dir, dist);

  // 1. Caché
  const cache = leerCache();
  const hit = cache[clave];
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return { lat: hit.lat, lng: hit.lng, src: hit.src };
  }

  // 2/3. Motores
  let coords: Coordenadas | null = null;
  const key = getGoogleApiKey();
  if (key) {
    coords = await geocodificarGoogle(consulta, key);
  }
  if (!coords) {
    coords = await geocodificarNominatim(consulta);
  }

  // 4. Guardar en caché si salió algo
  if (coords) {
    cache[clave] = { lat: coords.lat, lng: coords.lng, src: coords.src || 'nominatim', ts: Date.now() };
    escribirCache(cache);
  }

  return coords;
}

export interface itemBatch<T> {
  item: T;
  dir: string;
  dist?: string;
}

export interface resultadoBatch<T> {
  /** item → coordenadas (solo los exitosos) */
  resueltos: Map<T, Coordenadas>;
  /** Items que no se pudieron geocodificar */
  fallidos: T[];
  /** Cuántos vinieron de caché (sin gastar red) */
  desdeCache: number;
}

/**
 * Geocodifica una lista de direcciones en serie, con progreso.
 * Respeta el rate limit de Nominatim automáticamente (1.15s entre
 * peticiones): 20 direcciones nuevas tardan ~25s la primera vez,
 * y 0s para siempre después (caché + coords guardadas en Firestore).
 */
export async function batchGeocodificar<T>(
  items: itemBatch<T>[],
  onProgress?: (mensaje: string) => void
): Promise<resultadoBatch<T>> {
  const resueltos = new Map<T, Coordenadas>();
  const fallidos: T[] = [];
  let desdeCache = 0;

  // Pre-leer caché una sola vez
  const cache = leerCache();
  const pendientes: itemBatch<T>[] = [];

  for (const it of items) {
    if (!it.dir || !it.dir.trim()) {
      fallidos.push(it.item);
      continue;
    }
    const clave = claveCache(it.dir, it.dist);
    const hit = cache[clave];
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      resueltos.set(it.item, { lat: hit.lat, lng: hit.lng, src: hit.src });
      desdeCache++;
    } else {
      pendientes.push(it);
    }
  }

  const total = items.length;
  let procesados = desdeCache;

  for (const it of pendientes) {
    procesados++;
    onProgress?.(
      `Ubicando direcciones (${procesados}/${total})… ${it.dist || it.dir.slice(0, 20)}`
    );
    const coords = await geocodificarDireccion(it.dir, it.dist);
    if (coords) {
      resueltos.set(it.item, coords);
    } else {
      fallidos.push(it.item);
    }
  }

  return { resueltos, fallidos, desdeCache };
}
