// ═══════════════════════════════════════════════════════════
// 🌐 SERVICIO GEOCODIFICACIÓN - RiderTrack V2 (Fase 2.0)
// Convierte direcciones ("Av. Larco 123, Miraflores") en
// coordenadas reales (lat/lng).
//
// Motores (Fase 2.0 — Google Maps Platform):
//   1. Google Geocoding + Places — PREDETERMINADO (la clave API
//      del proyecto RiderTrack ya viene de fábrica). Es el motor
//      que usa Circuit: encuentra números de puerta exactos en
//      Lima. El autocompletado es Places Autocomplete (New) con
//      sesiones: escribes "av sucre" y salen los distritos.
//   2. Nominatim (OpenStreetMap) — respaldo gratis sin key, CON
//      cola de 1 petición por segundo (límite oficial).
//
// CASCADA DE CONSULTAS (heredada de la Fase 1.4 — probada con
// direcciones reales de Lima): una misma dirección se intenta
// con hasta 4 variantes hasta que una devuelva resultado:
//   v1) "{dir}, {dist}, Lima, Perú"            (tal cual)
//   v2) dir limpiada (sin "urbanización/dpto/piso/int/Nº/ref/",
//       "jr." → "jr ", distrito no duplicado, Callao para
//       distritos del Callao, CERCADO DE LIMA → Lima)
//   v3) v2 sin prefijo de tipo (Av./Jr/Calle/Pasaje)
//   v4) centro del DISTRITO → coordenada aproximada (src:'aprox')
//
// ⚠️ REGLA DE ORO (lección del Modular): NUNCA inventar
// coordenadas. Si todo falla, null y la UI lo dice honesto.
// La v4 no "inventa": es el centro geocodificado REAL del
// distrito, marcado como aproximado.
//
// Cachés (localStorage):
//   • rt_geocache_v1 — por dirección normalizada (60 días)
//   • rt_coords_v1   — por ID de cliente: sobrevive a que el
//     Modular/bot reescriba la ruta sin coordenadas.
// ═══════════════════════════════════════════════════════════

import { getGoogleApiKey } from './googleMaps';

// Re-exports para compatibilidad (SettingsView y otros los usan)
export { getGoogleApiKey, setGoogleApiKey, motorActivo } from './googleMaps';

export interface Coordenadas {
  lat: number;
  lng: number;
  src?: 'google' | 'nominatim' | 'aprox' | 'manual';
}

interface EntradaCache {
  lat: number;
  lng: number;
  src: 'google' | 'nominatim' | 'aprox' | 'manual';
  ts: number;
}

// ── Constantes ──────────────────────────────────────────────

const CACHE_KEY = 'rt_geocache_v1';
const COORDS_CLIENTES_KEY = 'rt_coords_v1';
const CACHE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 días
const CACHE_MAX_ENTRADAS = 800;

/** Nominatim permite máx 1 req/segundo. Usamos 1.15s de margen. */
const NOMINATIM_INTERVALO_MS = 1150;
const TIMEOUT_FETCH_MS = 10000;
const REINTENTOS_MAX = 2;

/**
 * Cortacircuitos (Fase 1.4): si Nominatim responde 403/429 varias
 * veces seguidas, dejamos de martillarlo por 2 minutos y las
 * direcciones fallan rápido y honestas ("sin ubicar") en lugar de
 * colgar la optimización durante ~10 minutos. En el APK esto pasa
 * si el WebView se queda sin cuota o hay un bloqueo temporal de IP.
 */
const BLOQUEO_LIMITE_INTENTOS = 4;
const BLOQUEO_COOLDOWN_MS = 2 * 60 * 1000;
let bloqueosConsecutivos = 0;
let bloqueadoHasta = 0;

/** Distritos constitucionales del Callao (la provincia es Callao, no Lima) */
const DISTRITOS_CALLAO = [
  'bellavista', 'callao', 'carmen de la legua', 'la perla',
  'la punta', 'ventanilla', 'mi peru',
];

// ── API Key de Google (ver googleMaps.ts: viene de fábrica) ─

// ── Caché persistente por dirección ─────────────────────────

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
    const claves = Object.keys(cache);
    if (claves.length > CACHE_MAX_ENTRADAS) {
      const ordenadas = claves
        .sort((a, b) => (cache[b]?.ts || 0) - (cache[a]?.ts || 0))
        .slice(0, CACHE_MAX_ENTRADAS);
      const nueva: Record<string, EntradaCache> = {};
      for (const k of ordenadas) nueva[k] = cache[k];
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

// ── Caché de coordenadas POR CLIENTE (Fase 1.4) ─────────────
// El Modular/bot reescribe ruta_activa.clientes sin lat/lng;
// con esta caché V2 rehidrata las coordenadas al instante y
// offline, sin volver a geocodificar.

function leerCoordsClientes(): Record<string, EntradaCache> {
  try {
    const raw = localStorage.getItem(COORDS_CLIENTES_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function escribirCoordsClientes(cache: Record<string, EntradaCache>): void {
  try {
    localStorage.setItem(COORDS_CLIENTES_KEY, JSON.stringify(cache));
  } catch {
    // sin espacio — no es crítico
  }
}

/** Guarda las coordenadas de un cliente (por su id) */
export function recordarCoordenadasCliente(
  clienteId: string | number,
  coords: Coordenadas
): void {
  const cache = leerCoordsClientes();
  cache[String(clienteId)] = {
    lat: coords.lat,
    lng: coords.lng,
    src: coords.src || 'nominatim',
    ts: Date.now(),
  };
  escribirCoordsClientes(cache);
}

/** Recupera las coordenadas recordadas de un cliente (null si no hay) */
export function coordenadasRecordadas(clienteId: string | number): Coordenadas | null {
  const hit = leerCoordsClientes()[String(clienteId)];
  if (hit && typeof hit.lat === 'number' && typeof hit.lng === 'number') {
    return { lat: hit.lat, lng: hit.lng, src: hit.src };
  }
  return null;
}

/** Olvida las coordenadas recordadas de un cliente */
export function olvidarCoordenadasCliente(clienteId: string | number): void {
  const cache = leerCoordsClientes();
  delete cache[String(clienteId)];
  escribirCoordsClientes(cache);
}

// ── Normalización de direcciones ────────────────────────────

const limpiarParte = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/[º°]/g, ' ')
    .replace(/^[,\s.]+|[,\s.]+$/g, '')
    .trim();

/** ¿La provincia de este distrito es Callao (constitucional)? */
function esDistritoCallao(dist: string): boolean {
  const d = (dist || '').toLowerCase().trim();
  return DISTRITOS_CALLAO.some((c) => d === c || d.includes(c));
}

/** Provincia correcta para el distrito (Callao vs Lima) */
function provinciaDe(dist: string): string {
  return esDistritoCallao(dist) ? 'Callao' : 'Lima';
}

/** Calificadores que estorban a Nominatim y no aportan ubicación */
const CALIFICADORES = new RegExp(
  [
    '\\burbanizaci[oó]n\\b', '\\burbanizacion\\b', '\\burbaniz\\.?\\b',
    '\\bdepartamento\\s+\\w+\\b', '\\bdpto\\.?\\s*\\w*\\b', '\\bpiso\\s+\\w+\\b',
    '\\bint(?:erior)?\\.?\\s*\\w*\\b', '\\bn[º°]\\s*\\w*\\b', '\\bnro\\.?\\s*\\w*\\b',
    '\\bcuadra\\s+\\w+\\b', '\\bcdra\\.?\\s*\\w*\\b', '\\bref\\.?\\s*[^,]*',
    '\\balt\\.?\\s+\\w+\\b', '\\bentre\\s+[^,]*', '\\by\\s+esquina\\b', '\\besquina\\b',
    '\\bmanzana\\s+\\w+\\b', '\\blote\\s+\\w+\\b',
  ].join('|'),
  'gi'
);

/**
 * Limpia una dirección para la variante v2: quita calificadores,
 * arregla "jr." pegado, quita "/algo", y colapsa separadores.
 */
export function limpiarDireccion(dir: string): string {
  let d = limpiarParte(dir);
  d = d.replace(CALIFICADORES, ' ');
  // "jr.Jose" → "jr Jose" (el punto pegado rompe la tokenización)
  d = d.replace(/\b([a-zñáéíóú]+)\./gi, '$1 ');
  // "/Callao" y similares
  d = d.replace(/\s*\/\s*[\w\s]*/g, ' ');
  // números tipo "151.157" → "151"
  d = d.replace(/\b(\d+)\.(\d+)\b/g, '$1');
  return d.replace(/\s+/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
}

/** Quita el prefijo de tipo de vía (Av./Jr./Calle/Pasaje...) */
const PREFIJOS_VIA = /^(av|avenida|avda|jr|jir[oó]n|calle|cl|psje|pasaje|psj|carretera|cra|ca)\.?\s+/i;

/** Variante v3: sin prefijo de tipo de vía ("Av. Grimaldo" → "Grimaldo") */
function sinPrefijoVia(dir: string): string {
  return dir.replace(PREFIJOS_VIA, '').trim();
}

/**
 * Construye la consulta v1 (tal cual, con provincia correcta).
 * Si el distrito ya está dentro de la dirección, no se duplica.
 */
export function normalizarConsulta(dir: string, dist?: string): string {
  const d = limpiarParte(dir || '');
  const distL = limpiarParte(dist || '');
  const prov = provinciaDe(dist || '');

  // "CERCADO DE LIMA" → la provincia ya es Lima, el distrito se llama "Lima"
  const distFinal =
    distL.toLowerCase() === 'cercado de lima' ? 'Lima' : distL;

  const partes = distFinal && d.toLowerCase().includes(distFinal.toLowerCase())
    ? [d, prov, 'Perú']
    : [d, distFinal, prov, 'Perú'].filter(Boolean);

  let q = partes.join(', ');
  q = q.replace(/\s+/g, ' ');
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
    if (data?.status && data.status !== 'ZERO_RESULTS' && data.status !== 'OK') {
      console.warn('[GoogleGeocode]', data.status, data?.error_message || '');
    }
    return null; // ZERO_RESULTS, REQUEST_DENIED, etc.
  } catch {
    return null;
  }
}

/**
 * Geocodifica con Google probando 2 variantes (Fase 2.0):
 *   g1) consulta completa "{dir}, {dist}, Lima, Perú"
 *   g2) dirección limpiada (sin "urbanización/dpto/piso…")
 * Google entiende mejor los calificadores peruanos que OSM,
 * pero la variante limpia rescata direcciones raras.
 */
async function geocodificarGoogleCascada(
  dir: string,
  dist: string | undefined,
  apiKey: string
): Promise<Coordenadas | null> {
  // g1 — consulta completa normalizada
  const completa = normalizarConsulta(dir, dist);
  if (completa) {
    const r1 = await geocodificarGoogle(completa, apiKey);
    if (r1) return r1;
  }
  // g2 — dirección limpia (solo si es distinta)
  const limpia = limpiarDireccion(dir);
  if (limpia && limpia.toLowerCase() !== limpiarParte(dir).toLowerCase()) {
    const distL = (dist || '').trim();
    const distNormalizado = distL.toLowerCase() === 'cercado de lima' ? 'Lima' : distL;
    const prov = provinciaDe(dist || '');
    const partes =
      distNormalizado && !limpia.toLowerCase().includes(distNormalizado.toLowerCase())
        ? [limpia, distNormalizado, prov, 'Perú']
        : [limpia, prov, 'Perú'];
    const consulta = partes.filter(Boolean).join(', ');
    if (consulta) {
      return geocodificarGoogle(consulta, apiKey);
    }
  }
  return null;
}

// ── Motor 2: Nominatim (OpenStreetMap, gratis) ──────────────

async function nominatimUna(consulta: string): Promise<Coordenadas | null> {
  // Cortacircuitos abierto: ni intentarlo (falla rápido, honesto)
  if (Date.now() < bloqueadoHasta) {
    return null;
  }

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2&limit=1&countrycodes=pe` +
    `&q=${encodeURIComponent(consulta)}`;

  for (let intento = 0; intento <= REINTENTOS_MAX; intento++) {
    try {
      const res = await conRateLimitNominatim(() => fetchConTimeout(url));
      if (res.status === 429 || res.status === 403) {
        bloqueosConsecutivos++;
        if (bloqueosConsecutivos >= BLOQUEO_LIMITE_INTENTOS || intento === REINTENTOS_MAX) {
          // Abrir el cortacircuitos: 2 min sin tocar Nominatim
          bloqueadoHasta = Date.now() + BLOQUEO_COOLDOWN_MS;
          return null;
        }
        await new Promise((r) => setTimeout(r, 2000 * (intento + 1)));
        continue;
      }
      if (!res.ok) {
        if (intento < REINTENTOS_MAX) {
          await new Promise((r) => setTimeout(r, 1200 * (intento + 1)));
          continue;
        }
        return null;
      }
      const data = await res.json();
      bloqueosConsecutivos = 0; // respuesta sana → reiniciar contador
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng, src: 'nominatim' };
        }
      }
      return null; // Sin resultados para ESTA variante — se probará la siguiente
    } catch {
      if (intento < REINTENTOS_MAX) {
        await new Promise((r) => setTimeout(r, 1200 * (intento + 1)));
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
 * el optimizador parte de la dirección de inicio configurada o
 * del centro de Lima.
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

// ── API pública: geocodificar una dirección ─────────────────

/**
 * Geocodifica una dirección con la CASCADA v1→v4.
 * Orden:
 *   1. Caché local (instantáneo, gratis, sin red)
 *   2. Google (si hay key) con la consulta completa
 *   3. Nominatim v1 → v2 → v3 (cada una respeta el rate limit)
 *   4. Centro del distrito (src:'aprox') — real pero aproximado
 *   5. null — falló todo. NUNCA se inventan coordenadas.
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

  // 2. Google (clave de fábrica o personalizada) — cascada g1/g2
  let coords: Coordenadas | null = null;
  const key = getGoogleApiKey();
  if (key) {
    coords = await geocodificarGoogleCascada(dir, dist, key);
  }

  // 3. Nominatim en cascada
  if (!coords) {
    const dLimpia = limpiarDireccion(dir);
    const dSinPrefijo = sinPrefijoVia(dLimpia);
    const distL = (dist || '').trim();
    const distNormalizado =
      distL.toLowerCase() === 'cercado de lima' ? 'Lima' : distL;
    const prov = provinciaDe(dist || '');

    const variantes: Array<{ q: string; src: 'nominatim' | 'aprox' }> = [];

    // v1 — tal cual (con provincia correcta)
    variantes.push({ q: consulta, src: 'nominatim' });

    // v2 — limpia (solo si es distinta de v1)
    if (dLimpia && dLimpia.toLowerCase() !== limpiarParte(dir).toLowerCase()) {
      const partes =
        distNormalizado && !dLimpia.toLowerCase().includes(distNormalizado.toLowerCase())
          ? [dLimpia, distNormalizado, prov, 'Perú']
          : [dLimpia, prov, 'Perú'];
      variantes.push({ q: partes.filter(Boolean).join(', '), src: 'nominatim' });
    }

    // v3 — sin prefijo de vía (solo si es distinta de v2)
    if (dSinPrefijo && dSinPrefijo.toLowerCase() !== dLimpia.toLowerCase()) {
      const partes =
        distNormalizado && !dSinPrefijo.toLowerCase().includes(distNormalizado.toLowerCase())
          ? [dSinPrefijo, distNormalizado, prov, 'Perú']
          : [dSinPrefijo, prov, 'Perú'];
      variantes.push({ q: partes.filter(Boolean).join(', '), src: 'nominatim' });
    }

    // v4 — centro del distrito (aproximado)
    if (distNormalizado) {
      variantes.push({ q: `${distNormalizado}, ${prov}, Perú`, src: 'aprox' });
    }

    for (const v of variantes) {
      const r = await nominatimUna(v.q);
      if (r) {
        coords = { lat: r.lat, lng: r.lng, src: v.src };
        break;
      }
    }
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
  /** Items que no se pudieron geocodificar en absoluto */
  fallidos: T[];
  /** Cuántos vinieron de caché (sin gastar red) */
  desdeCache: number;
  /** Cuántos quedaron como aproximados (centro de distrito) */
  aproximados: number;
}

/**
 * Geocodifica una lista de direcciones en serie, con progreso.
 * Respeta el rate limit de Nominatim automáticamente: la primera
 * vez puede tardar (~1-5 s por dirección nueva según cuántas
 * variantes necesite), después 0 s para siempre (caché + coords
 * guardadas en Firestore).
 */
export async function batchGeocodificar<T>(
  items: itemBatch<T>[],
  onProgress?: (mensaje: string) => void
): Promise<resultadoBatch<T>> {
  const resueltos = new Map<T, Coordenadas>();
  const fallidos: T[] = [];
  let desdeCache = 0;
  let aproximados = 0;

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
      if (hit.src === 'aprox') aproximados++;
    } else {
      pendientes.push(it);
    }
  }

  const total = items.length;
  let procesados = desdeCache;

  for (const it of pendientes) {
    procesados++;
    onProgress?.(
      `Ubicando ${procesados}/${total}: ${it.dist || it.dir.slice(0, 22)}…`
    );
    const coords = await geocodificarDireccion(it.dir, it.dist);
    if (coords) {
      resueltos.set(it.item, coords);
      if (coords.src === 'aprox') aproximados++;
    } else {
      fallidos.push(it.item);
    }
  }

  return { resueltos, fallidos, desdeCache, aproximados };
}

// ── AUTOCOMPLETADO DE DIRECCIONES (Fase 1.4) ────────────────

export interface DireccionSugerida {
  etiqueta: string;      // "Avenida Sucre 523" (nombre corto)
  detalle: string;       // "San Miguel, Lima" (distrito + prov)
  distrito?: string;     // distrito detectado, si se pudo extraer
  lat: number;
  lng: number;
  /** placeId de Google (sugerencias de Places): las coords se
   *  obtienen al ELEGIR, con detalleLugarGoogle (así el
   *  autocompletado+detalle se factura como UNA sesión) */
  placeId?: string;
  /** ¿De qué motor salió esta sugerencia? */
  origen?: 'google' | 'nominatim';
}

// ── Google Places Autocomplete (New) ──────────────────────

const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETALLE_URL = 'https://places.googleapis.com/v1/places';

/** Centro y radio de sesgo para Lima Metropolitana + Callao
 *  (la API exige radio ≤ 50,000 m) */
const SESGO_LIMA = { lat: -12.046374, lng: -77.042793, radio: 50000 };

/** Genera un token de sesión — agrupa autocomplete+detalle en
 *  una sola sesión para facturación (Places API New) */
function nuevoTokenSesion(): string {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID();
    }
  } catch {
    // sin crypto.randomUUID
  }
  return `rt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Crea una sesión nueva de autocompletado (agrupa búsquedas) */
export function iniciarSesionAutocomplete(): string {
  return nuevoTokenSesion();
}

/** fetch POST/GET con timeout para Places API */
async function placesFetch(url: string, opciones: RequestInit, ms = 8000): Promise<Response | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opciones, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Autocompletado con Google Places (New) — el mismo motor que
 * usa Circuit: escribes "av sucre" y salen los distritos.
 * Las sugerencias NO traen coordenadas: se piden al elegir una
 * con detalleLugarGoogle (mismo token de sesión).
 */
export async function buscarDireccionesGoogle(
  texto: string,
  limite = 6,
  tokenSesion?: string
): Promise<DireccionSugerida[]> {
  const key = getGoogleApiKey();
  if (!key) return [];

  const res = await placesFetch(PLACES_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
    },
    body: JSON.stringify({
      input: texto,
      languageCode: 'es',
      regionCode: 'PE',
      locationBias: {
        circle: {
          center: { latitude: SESGO_LIMA.lat, longitude: SESGO_LIMA.lng },
          radius: SESGO_LIMA.radio,
        },
      },
      ...(tokenSesion ? { sessionToken: tokenSesion } : {}),
    }),
  });
  if (!res || !res.ok) return [];

  try {
    const data = await res.json();
    const sugerencias: DireccionSugerida[] = [];

    for (const s of data?.suggestions || []) {
      const p = s?.placePrediction;
      if (!p?.placeId || !p?.text?.text) continue;
      const principal = String(p.structuredFormat?.mainText?.text || p.text.text);
      const secundario = String(p.structuredFormat?.secondaryText?.text || '');
      // El distrito suele ser la 1ª parte del texto secundario
      const distrito = secundario ? secundario.split(',')[0].trim() : undefined;
      sugerencias.push({
        etiqueta: principal,
        detalle: secundario || 'Lima',
        distrito:
          distrito && !/^(peru|perú|lima|callao|lima metropolitana)$/i.test(distrito)
            ? distrito
            : undefined,
        lat: 0,
        lng: 0,
        placeId: p.placeId,
        origen: 'google',
      });
      if (sugerencias.length >= limite) break;
    }
    return sugerencias;
  } catch {
    return [];
  }
}

export interface DetalleLugar {
  lat: number;
  lng: number;
  direccion: string; // "Av. Sucre 523, San Miguel 15088, Peru"
  distrito?: string;
}

/**
 * Detalle de un lugar elegido del autocompletado (Places New):
 * coordenadas exactas + dirección formateada + distrito.
 * Usa el MISMO token de sesión del autocompletado.
 */
export async function detalleLugarGoogle(
  placeId: string,
  tokenSesion?: string
): Promise<DetalleLugar | null> {
  const key = getGoogleApiKey();
  if (!key || !placeId) return null;

  const url = `${PLACES_DETALLE_URL}/${encodeURIComponent(placeId)}?languageCode=es`;
  const res = await placesFetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'location,formattedAddress,addressComponents',
      ...(tokenSesion ? { 'X-Goog-SessionToken': tokenSesion } : {}),
    },
  });
  if (!res || !res.ok) return null;

  try {
    const data = await res.json();
    const loc = data?.location;
    if (
      loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number' &&
      !isNaN(loc.latitude) && !isNaN(loc.longitude)
    ) {
      // distrito: componente con type "locality" (en Lima es el distrito)
      let distrito: string | undefined;
      for (const comp of data?.addressComponents || []) {
        const tipos: string[] = comp?.types || [];
        if (tipos.includes('locality') || tipos.includes('administrative_area_level_3')) {
          distrito = String(comp.longText || comp.shortText || '');
          break;
        }
      }
      return {
        lat: loc.latitude,
        lng: loc.longitude,
        direccion: String(data?.formattedAddress || ''),
        distrito,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Respuesta cruda de Nominatim search */
interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

/** Extrae etiqueta/detalle/distrito de un display_name de Nominatim */
function aSugerencia(d: NominatimResult): DireccionSugerida | null {
  const partes = String(d.display_name || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const usaName = !!(d.name && d.name.length > 2);
  const etiqueta = usaName ? d.name! : partes[0] || '';

  // resto: todo menos la etiqueta (si la primera parte es la etiqueta)
  let resto = partes.slice(1);
  if (usaName && partes[0] && partes[0].toLowerCase() !== etiqueta.toLowerCase()) {
    resto = partes; // el name no es la 1ª parte (POI sobre una calle) → mantener todo
  }

  const limpio = resto.filter(
    (p) => !/^perú$/i.test(p) && !/^\d{4,6}$/.test(p) && !/^lima metropolitana$/i.test(p)
  );
  // El distrito suele ser la 1ª o 2ª parte del resto ("San Miguel, Lima")
  const distrito = limpio[0] && !/^(lima|callao)$/i.test(limpio[0]) ? limpio[0] : limpio[1];
  const detalle = limpio.slice(0, 3).join(', ');

  const lat = parseFloat(d.lat);
  const lng = parseFloat(d.lon);
  if (isNaN(lat) || isNaN(lng) || !etiqueta) return null;
  return { etiqueta, detalle, distrito: distrito || undefined, lat, lng };
}

/**
 * Buscador de direcciones con autocompletado (estilo Circuit):
 * escribes "av sucre" y devuelve candidatos con su distrito.
 *
 * Estrategia multi-consulta (cada una pasa por el rate limit):
 *   1) "{texto}, Lima" (o ", Callao" si mencionas un distrito del Callao)
 *   2) si salen pocas: texto limpio sin prefijo Av/Jr/Calle
 *   3) si aún pocas: texto tal cual sin sufijo de provincia
 * Los resultados se filtran a Lima/Callao y se deduplican.
 */
export async function buscarDirecciones(
  texto: string,
  limite = 6,
  tokenSesion?: string
): Promise<DireccionSugerida[]> {
  const t = (texto || '').trim();
  if (t.length < 3) return [];

  // ── Motor 1: Google Places Autocomplete (Fase 2.0) ──────
  // El mismo motor que usa Circuit — precisión total en Lima.
  const key = getGoogleApiKey();
  if (key) {
    const deGoogle = await buscarDireccionesGoogle(t, limite, tokenSesion);
    if (deGoogle.length > 0) return deGoogle;
    // Si Google no devolvió nada, caemos a Nominatim abajo
  }

  const mencionaCallao = DISTRITOS_CALLAO.some((d) => t.toLowerCase().includes(d));
  const prov = mencionaCallao ? 'Callao' : 'Lima';
  const yaTieneProv = /,\s*(lima|callao)\b/i.test(t);

  const consultas: string[] = [];
  if (yaTieneProv) {
    consultas.push(t);
  } else {
    consultas.push(`${t}, ${prov}`);
  }

  const buscarUna = async (q: string): Promise<DireccionSugerida[]> => {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=jsonv2&limit=8&countrycodes=pe` +
      `&q=${encodeURIComponent(q)}`;
    try {
      const res = await conRateLimitNominatim(() => fetchConTimeout(url, 8000));
      if (!res.ok) return [];
      const data: NominatimResult[] = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        // filtrar por el nombre COMPLETO (el detalle corto no
        // siempre incluye "Lima"/"Callao" en resultados de calle)
        .filter((d) => /(lima|callao)/i.test(String(d.display_name || '')))
        .map(aSugerencia)
        .filter((s): s is DireccionSugerida => !!s);
    } catch {
      return [];
    }
  };

  const vistos = new Set<string>();
  const acumuladas: DireccionSugerida[] = [];

  const agregar = (lista: DireccionSugerida[]) => {
    for (const s of lista) {
      const clave = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
      if (!vistos.has(clave)) {
        vistos.add(clave);
        acumuladas.push(s);
      }
    }
  };

  // Consulta 1: con provincia
  agregar(await buscarUna(consultas[0]));

  // Consulta 2 (si pocas): sin prefijo de vía, limpio
  if (acumuladas.length < 4) {
    const limpia = sinPrefijoVia(limpiarDireccion(t));
    if (limpia && limpia.length >= 3 && limpia.toLowerCase() !== t.toLowerCase()) {
      agregar(await buscarUna(yaTieneProv ? limpia : `${limpia}, ${prov}`));
    }
  }

  // Consulta 3 (si aún pocas): sin sufijo de provincia
  if (acumuladas.length < 4 && !yaTieneProv) {
    agregar(await buscarUna(t));
  }

  return acumuladas.slice(0, limite);
}
