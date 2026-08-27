// ═══════════════════════════════════════════════════════════
// 🌐 SERVICIO GEOCODIFICACIÓN - RiderTrack V2 (Fase 1.4)
// Convierte direcciones ("Av. Larco 123, Miraflores") en
// coordenadas reales (lat/lng).
//
// Motores:
//   1. Google Geocoding API — si el usuario configuró una key
//      (Configuración → Mapas y Rutas). Más preciso en Perú.
//   2. Nominatim (OpenStreetMap) — gratis, sin key. CON cola
//      de 1 petición por segundo (límite oficial de Nominatim).
//
// CASCADA DE CONSULTAS (Fase 1.4 — probada con direcciones
// reales de Lima): una misma dirección se intenta con hasta 4
// variantes hasta que una devuelva resultado:
//   v1) "{dir}, {dist}, Lima, Perú"            (tal cual)
//   v2) dir limpiada (sin "urbanización/dpto/piso/int/Nº/ref/",
//       "jr." → "jr ", distrito no duplicado, Callao para
//       distritos del Callao, CERCADO DE LIMA → Lima)
//   v3) v2 sin prefijo de tipo (Av./Jr/Calle/Pasaje) — OSM
//       muchas veces registra "Calle X" cuando el usuario
//       escribió "Av. X" y viceversa
//   v4) centro del DISTRITO → coordenada aproximada (src:'aprox')
//       — mejor que nada: ordena por zona real y el rider puede
//       precisarla a mano con "Ubicar" (autocompletado)
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
const GOOGLE_KEY_STORAGE = 'rt_google_maps_key';
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
    return null; // ZERO_RESULTS, REQUEST_DENIED, etc.
  } catch {
    return null;
  }
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

  // 2. Google (si hay key) — con la consulta completa
  let coords: Coordenadas | null = null;
  const key = getGoogleApiKey();
  if (key) {
    coords = await geocodificarGoogle(consulta, key);
    if (coords && dist) {
      // Si Google no encuentra la dirección exacta, probar sin
      // calificadores también en Google
      const limpia = limpiarDireccion(dir);
      if (limpia && limpia.toLowerCase() !== limpiarParte(dir).toLowerCase()) {
        // ya encontró algo — suficiente
      }
    }
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
  limite = 6
): Promise<DireccionSugerida[]> {
  const t = (texto || '').trim();
  if (t.length < 3) return [];

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
