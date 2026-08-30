// ═══════════════════════════════════════════════════════════
// 🧭 GOOGLE DIRECTIONS - RiderTrack V2 (Fase 2.0)
// Optimización de ruta POR CALLES REALES y geometría de ruta.
//
// Antes (Fase 1.3/1.4): las distancias eran "línea recta × 1.35"
// — un buen estimado, pero no sabía de sentidos de calle, vías
// expresas ni vueltas obligatorias de Lima. Ahora:
//
//   • optimizarConDirections(): manda TODAS las paradas a la
//     Directions API con optimize:true → Google devuelve el mejor
//     ORDEN midiendo por calles reales. Además entrega:
//       - km reales y minutos reales de manejo (sumando legs)
//       - la geometría de la ruta (puntos de la polyline) para
//         dibujarla en el mapa siguiendo las calles
//
//   • obtenerRutaGoogle(): geometría de ruta para el MAPA cuando
//     el orden ya está decidido (ruta ya optimizada, editada a
//     mano, o cuando la optimización fue local). Con caché por
//     "firma" de ruta — la misma ruta no se vuelve a pedir NUNCA.
//
// Límite de la API: 25 waypoints por request → rutas de hasta 23
// paradas se optimizan de UNA sola vez; más grandes usan el
// optimizador local (vecino cercano + 2-opt) y solo se trae la
// geometría por tramos.
//
// Si Google falla (sin internet, API deshabilitada, cuota): el
// llamador cae al optimizador local de routeOptimizer.ts — la
// app NUNCA se queda sin ruta.
//
// ── Fase 3.13: FIX DEL TRANSPORTE (CORS) ─────────────────────
// El endpoint REST de Directions NO manda cabeceras CORS
// (Geocoding y Places SÍ las mandan — verificado). Llamado con
// fetch() desde el WebView del APK (origen http://localhost) el
// navegador BLOQUEA la respuesta → la navegación GPS, los mapas
// y la optimización caían SIEMPRE al respaldo (línea recta /
// optimizador local) aunque Google hubiera contestado bien.
// Ahora directionsFetch usa, en orden:
//   1. APK  → CapacitorHttp (HTTP nativo OkHttp, NO pasa por el
//             navegador → sin CORS; viene registrado de fábrica
//             en el bridge de Capacitor 6, sin configurar nada)
//   2. Web  → fetch directo (mantine los mocks de los tests)
//   3. Web  → Maps JavaScript API DirectionsService (el SDK
//             oficial de Google para navegadores — sin CORS)
// ═══════════════════════════════════════════════════════════

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { getGoogleApiKey, decodificarPolyline, cargarGoogleMaps } from './googleMaps';
import { haversineKm } from './routeOptimizer';

const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

/** Máx paradas que se optimizan en un solo request (límite API: 25 waypoints) */
export const MAX_PARADAS_DIRECTIONS = 23;

const TIMEOUT_MS = 12000;

export interface PuntoGeoSimple {
  lat: number;
  lng: number;
}

export interface OpcionesDirections {
  /** Punto final fijo (la ruta TERMINA ahí) */
  fin?: PuntoGeoSimple | null;
  /** Incluir regreso al inicio (ciclo cerrado) */
  cerrarCiclo?: boolean;
}

export interface ResultadoDirectionsOrden<T extends PuntoGeoSimple> {
  /** Paradas en el orden óptimo según calles reales */
  orden: T[];
  /** km REALES de manejo (suma de todos los tramos) */
  distanciaKm: number;
  /** minutos REALES de manejo (según Google) */
  tiempoMin: number;
  /** Geometría de la ruta por calles (puntos decodificados) */
  puntos: Array<{ lat: number; lng: number }>;
}

// ── Transporte del request (Fase 3.13: fix CORS del WebView) ─

/** ¿Estamos dentro del APK? (WebView de Capacitor) */
function esNativoDefault(): boolean {
  try {
    return Capacitor.isNativePlatform() === true;
  } catch {
    return false;
  }
}

/**
 * GET nativo (APK). CapacitorHttp corre en Java (OkHttp), fuera
 * del WebView → CORS no aplica. Devuelve el JSON de Google o
 * null si falló la red. En errores HTTP (400 clave mala…)
 * devuelve igual el cuerpo: trae status/error_message y así el
 * warn de directionsFetch explica el motivo real.
 */
async function httpNativoDefault(url: string): Promise<any | null> {
  try {
    const resp = await CapacitorHttp.get({
      url,
      connectTimeout: TIMEOUT_MS,
      readTimeout: TIMEOUT_MS,
    });
    // resp = { status, headers, data } — data ya viene parseado (JSON)
    if (resp && resp.status >= 200 && resp.status < 300) return resp.data ?? null;
    return resp?.data ?? null;
  } catch {
    return null; // sin internet / timeout — el llamador cae al respaldo
  }
}

/**
 * fetch del navegador. Devuelve el JSON si el navegador dejó
 * leer la respuesta (aunque el status HTTP sea error, Google
 * responde un JSON con status/error_message), o null si la red,
 * el timeout o CORS bloquearon la lectura.
 */
async function fetchDirecto(url: string): Promise<any | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } catch {
    return null; // CORS bloqueado (Directions no manda ACAO), sin internet, timeout
  } finally {
    clearTimeout(t);
  }
}

/** "12.046374,-77.042793" → { lat, lng } (o tal cual si no es punto) */
function paramALugar(s: string): { lat: number; lng: number } | string {
  const [lat, lng] = String(s).split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : s;
}

/**
 * Directions vía Maps JavaScript API (fallback de WEB). El SDK
 * se carga por <script> y sus requests van por el canal oficial
 * — sin CORS. Traduce los params REST (origin/destination/
 * waypoints "optimize:true|…") al formato del SDK y normaliza la
 * respuesta a la misma forma del REST ({ status, routes }).
 */
async function directionsViaSdk(params: Record<string, string>): Promise<any | null> {
  try {
    const gmaps = await cargarGoogleMaps();
    if (!gmaps?.DirectionsService) return null;

    const req: any = { travelMode: gmaps.TravelMode?.DRIVING ?? 'DRIVING' };
    if (params.origin) req.origin = paramALugar(params.origin);
    if (params.destination) req.destination = paramALugar(params.destination);
    if (params.waypoints) {
      const partes = String(params.waypoints).split('|');
      const optimizar = partes[0] === 'optimize:true';
      const lista = (optimizar ? partes.slice(1) : partes).filter(Boolean);
      req.waypoints = lista.map((w) => ({ location: paramALugar(w), stopover: true }));
      req.optimizeWaypoints = optimizar;
    }

    return await new Promise<any | null>((resolve) => {
      const reloj = setTimeout(() => resolve(null), TIMEOUT_MS);
      new gmaps.DirectionsService().route(req, (respuesta: any, estado: string) => {
        clearTimeout(reloj);
        if (estado === 'OK' && respuesta?.routes?.length) {
          // Misma forma que el REST: los consumidores solo leen
          // routes[0] (legs/steps/polyline/waypoint_order), que el
          // SDK entrega idéntico.
          resolve({ status: 'OK', routes: respuesta.routes });
        } else {
          console.warn('[Directions SDK] estado:', estado);
          resolve(null);
        }
      });
    });
  } catch {
    return null; // sin DOM (tests en Node), clave sin JS API, sin internet…
  }
}

// Inyectables para los tests (scripts/test-fase-3-13.ts)
let _esNativo: () => boolean = esNativoDefault;
let _httpNativo: (url: string) => Promise<any | null> = httpNativoDefault;
export const _transporteTests = {
  setEsNativo(fn: () => boolean) {
    _esNativo = fn;
  },
  setHttpNativo(fn: (url: string) => Promise<any | null>) {
    _httpNativo = fn;
  },
  restaurar() {
    _esNativo = esNativoDefault;
    _httpNativo = httpNativoDefault;
  },
};

// ── Fetch con timeout ──────────────────────────────────────

async function directionsFetch(params: Record<string, string>): Promise<any | null> {
  const key = getGoogleApiKey();
  if (!key) return null;

  const url = new URL(DIRECTIONS_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', key);
  // mode=driving es lo más estable en Lima (el servicio web no
  // soporta two_wheeler; para moto las calles son las mismas).
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('language', 'es');

  let data: any = null;

  if (_esNativo()) {
    // APK: HTTP nativo (sin CORS); si no se pudo, el SDK
    data = await _httpNativo(url.toString());
    if (!data) data = await directionsViaSdk(params);
  } else {
    // Web: fetch directo y, si CORS lo bloqueó, el SDK oficial
    data = await fetchDirecto(url.toString());
    if (!data) data = await directionsViaSdk(params);
  }

  if (data?.status !== 'OK' || !Array.isArray(data.routes) || data.routes.length === 0) {
    if (data?.status && data.status !== 'ZERO_RESULTS') {
      console.warn('[Directions] estado:', data.status, data?.error_message || '');
    }
    return null;
  }
  return data;
}

const wp = (p: PuntoGeoSimple) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Suma distancia (km) y duración (min) de todos los legs de una ruta */
function sumarLegs(ruta: any): { km: number; min: number } {
  let metros = 0;
  let segundos = 0;
  for (const leg of ruta.legs || []) {
    metros += Number(leg?.distance?.value || 0);
    segundos += Number(leg?.duration?.value || 0);
  }
  return {
    km: Math.round((metros / 1000) * 10) / 10,
    min: Math.round(segundos / 60),
  };
}

/** Redondea puntos para que el caché no pese (5 decimales ≈ 1m) */
const redondear = (p: { lat: number; lng: number }) => ({
  lat: Math.round(p.lat * 100000) / 100000,
  lng: Math.round(p.lng * 100000) / 100000,
});

// ── Optimización TSP por calles reales ─────────────────────

/**
 * Optimiza el orden de las paradas midiendo CALLES REALES.
 *
 * Estrategia (según la configuración de ruta):
 *   • con FIN fijo:    inicio → [paradas optimizadas] → fin
 *   • ciclo cerrado:   inicio → [paradas optimizadas] → inicio
 *   • ruta abierta:    la parada MÁS LEJANA del inicio se fija
 *     como destino (heurística clásica: el extremo lejano casi
 *     siempre es el final de la ruta óptima) y el resto se
 *     optimiza entre el inicio y ese destino.
 *
 * Devuelve null si no se pudo (el llamador cae al optimizador
 * local de routeOptimizer.ts).
 */
export async function optimizarConDirections<T extends PuntoGeoSimple>(
  paradas: T[],
  inicio: PuntoGeoSimple,
  opciones?: OpcionesDirections,
  onProgress?: (msg: string) => void
): Promise<ResultadoDirectionsOrden<T> | null> {
  if (paradas.length < 2 || paradas.length > MAX_PARADAS_DIRECTIONS) return null;

  onProgress?.(`Google Maps está ordenando ${paradas.length} paradas por calles reales…`);

  const fin = opciones?.fin ?? null;
  const cerrar = !!opciones?.cerrarCiclo;

  let destino: PuntoGeoSimple;
  let waypoints: T[];

  if (fin) {
    destino = fin;
    waypoints = paradas;
  } else if (cerrar) {
    destino = inicio;
    waypoints = paradas;
  } else {
    // Ruta abierta sin fin: fijar la parada más lejana como destino
    let idxLejos = 0;
    let distLejos = -1;
    for (let i = 0; i < paradas.length; i++) {
      const d = haversineKm(inicio, paradas[i]);
      if (d > distLejos) {
        distLejos = d;
        idxLejos = i;
      }
    }
    destino = paradas[idxLejos];
    waypoints = paradas.filter((_, i) => i !== idxLejos);
  }

  const waypointsParam = waypoints.map(wp).join('|');

  const data = await directionsFetch({
    origin: wp(inicio),
    destination: wp(destino),
    waypoints: waypoints.length > 1 ? `optimize:true|${waypointsParam}` : waypointsParam,
  });
  if (!data) return null;

  const ruta = data.routes[0];
  const { km, min } = sumarLegs(ruta);

  // Orden devuelto por Google: índices dentro del array waypoints
  const ordenIndices: number[] =
    Array.isArray(ruta.waypoint_order) && ruta.waypoint_order.length > 0
      ? ruta.waypoint_order
      : waypoints.map((_, i) => i);

  const ordenadas: T[] = ordenIndices.map((i) => waypoints[i]).filter(Boolean);

  // En ruta abierta, el destino fijo (parada más lejana) va al final
  const orden: T[] = fin || cerrar ? ordenadas : [...ordenadas, destino as T];

  // Verificación de sanidad: no perder ni duplicar paradas
  if (orden.length !== paradas.length) {
    console.warn('[Directions] orden incompleto — se usará el optimizador local');
    return null;
  }

  const puntos = decodificarPolyline(String(ruta.overview_polyline?.points || '')).map(redondear);

  return { orden, distanciaKm: km, tiempoMin: min, puntos };
}

// ── Geometría de ruta para el mapa (orden ya fijado) ───────

export interface RutaObtenida {
  /** Geometría por calles ya decodificada (lista de puntos) */
  puntos: Array<{ lat: number; lng: number }>;
  distanciaKm: number;
  tiempoMin: number;
  firma: string;
  ts: number;
}

/**
 * "Firma" de una ruta: identifica de forma única una secuencia
 * inicio → paradas → fin. Se usa como clave de caché para no
 * volver a pedir a Google la misma ruta dos veces.
 */
export function firmaRuta(
  inicio: PuntoGeoSimple | null,
  paradas: PuntoGeoSimple[],
  fin?: PuntoGeoSimple | null
): string {
  const p = (x: PuntoGeoSimple) => `${x.lat.toFixed(5)},${x.lng.toFixed(5)}`;
  return [
    inicio ? p(inicio) : '-',
    paradas.length,
    paradas.slice(0, 60).map(p).join(';'),
    fin ? p(fin) : '-',
  ].join('|');
}

const CACHE_RUTA_KEY = 'rt_dirruta_v1';

function leerCacheRuta(): Record<string, RutaObtenida> {
  try {
    const raw = localStorage.getItem(CACHE_RUTA_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function escribirCacheRuta(cache: Record<string, RutaObtenida>): void {
  try {
    // Máximo 6 rutas en caché (la del día y las recientes)
    const claves = Object.keys(cache);
    if (claves.length > 6) {
      const ordenadas = claves.sort((a, b) => (cache[b]?.ts || 0) - (cache[a]?.ts || 0)).slice(0, 6);
      const nueva: Record<string, RutaObtenida> = {};
      for (const k of ordenadas) nueva[k] = cache[k];
      localStorage.setItem(CACHE_RUTA_KEY, JSON.stringify(nueva));
      return;
    }
    localStorage.setItem(CACHE_RUTA_KEY, JSON.stringify(cache));
  } catch {
    // sin espacio — funciona sin caché
  }
}

/**
 * Trae (o reusa del caché) la geometría REAL por calles de una
 * ruta ya ordenada, para dibujarla en el mapa + mostrar km/min
 * reales. Rutas de más de 23 paradas se piden por tramos y se
 * concatenan (cada tramo respeta el límite de waypoints).
 */
export async function obtenerRutaGoogle(
  inicio: PuntoGeoSimple,
  paradas: PuntoGeoSimple[],
  fin?: PuntoGeoSimple | null
): Promise<RutaObtenida | null> {
  if (paradas.length === 0) return null;

  const firma = firmaRuta(inicio, paradas, fin || null);

  // 1. Caché (la misma ruta no se vuelve a pedir)
  const cache = leerCacheRuta();
  const hit = cache[firma];
  if (hit && Date.now() - hit.ts < 7 * 24 * 60 * 60 * 1000 && hit.puntos?.length > 1) {
    return hit;
  }

  // 2. Pedir a Google por tramos de ≤ 23 waypoints
  const tramos: Array<{ desde: PuntoGeoSimple; intermedias: PuntoGeoSimple[]; hasta: PuntoGeoSimple }> = [];
  let cursor = inicio;
  for (let i = 0; i < paradas.length; i += MAX_PARADAS_DIRECTIONS) {
    const grupo = paradas.slice(i, i + MAX_PARADAS_DIRECTIONS);
    const ultima = grupo[grupo.length - 1];
    // Si es el último grupo y hay fin: el tramo termina en el fin
    const esUltimo = i + MAX_PARADAS_DIRECTIONS >= paradas.length;
    const hasta = esUltimo && fin ? fin : ultima;
    const intermedias = hasta === ultima ? grupo.slice(0, -1) : grupo;
    tramos.push({ desde: cursor, intermedias, hasta });
    cursor = hasta;
  }

  const puntosTotales: Array<{ lat: number; lng: number }> = [];
  let kmTotal = 0;
  let minTotal = 0;

  for (const tramo of tramos) {
    const params: Record<string, string> = {
      origin: wp(tramo.desde),
      destination: wp(tramo.hasta),
    };
    if (tramo.intermedias.length > 0) {
      params.waypoints = tramo.intermedias.map(wp).join('|');
    }
    const data = await directionsFetch(params);
    if (!data) return null; // sin geometría — el llamador dibuja línea recta
    const ruta = data.routes[0];
    const { km, min } = sumarLegs(ruta);
    kmTotal += km;
    minTotal += min;

    const puntosTramo = decodificarPolyline(String(ruta.overview_polyline?.points || ''));
    // Evitar duplicar el punto de unión entre tramos
    const desde = puntosTotales.length > 0 ? 1 : 0;
    for (let i = desde; i < puntosTramo.length; i++) {
      puntosTotales.push(redondear(puntosTramo[i]));
    }
  }

  if (puntosTotales.length < 2) return null;

  const resultado: RutaObtenida = {
    puntos: puntosTotales,
    distanciaKm: Math.round(kmTotal * 10) / 10,
    tiempoMin: Math.round(minTotal),
    firma,
    ts: Date.now(),
  };

  cache[firma] = resultado;
  escribirCacheRuta(cache);
  return resultado;
}

/**
 * Guarda la ruta obtenida durante la optimización (useClientes)
 * para que el mapa la tenga lista al instante, sin pedir nada.
 */
export function guardarRutaOptimizada(ruta: RutaObtenida): void {
  const cache = leerCacheRuta();
  cache[ruta.firma] = ruta;
  escribirCacheRuta(cache);
}

// ── Instrucciones turno a turno (Fase 3.12 — Navegación GPS) ─

/**
 * Un paso de la ruta tal como lo necesita la navegación: la
 * instrucción YA LIMPIA en español ("Gira a la izquierda hacia
 * Av. Arequipa"), la maniobra de Google (turn-left…) para el
 * ícono del cartel, metros/segundos del paso y su geometría.
 */
export interface PasoInstruccion {
  /** Texto limpio en español (sin etiquetas HTML de Google) */
  instruccion: string;
  /** Maniobra de Google: turn-left, roundabout-right, straight… (null en salida/llegada) */
  maniobra: string | null;
  /** Metros de este paso */
  distanciaM: number;
  /** Segundos de este paso */
  duracionS: number;
  /** Geometría del paso (para dibujar y proyectar la posición) */
  puntos: Array<{ lat: number; lng: number }>;
}

export interface RutaInstrucciones {
  /** Pasos de TODOS los legs concatenados, en orden */
  pasos: PasoInstruccion[];
  /** Geometría completa de la ruta (pasos encadenados sin duplicar vértices) */
  puntos: Array<{ lat: number; lng: number }>;
  distanciaKm: number;
  tiempoMin: number;
}

/**
 * Limpia el html_instructions de Google: quita <b>/<div> y
 * entidades (&nbsp;) y colapsa espacios. "Gira a la izquierda
 * hacia <b>Av. Arequipa</b>" → "Gira a la izquierda hacia Av.
 * Arequipa".
 */
export function limpiarInstruccion(html: string): string {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trae de Google la ruta de un tramo con TODOS sus pasos
 * (instrucciones + maniobras) para la navegación turno a turno.
 * Un solo origen → destino (la navegación va parada por parada,
 * así el cartel y la voz siempre hablan del tramo actual).
 *
 * Devuelve null si Google no responde (el llamador cae a la
 * ruta recta de emergencia de navegacionGps.ts).
 */
export async function obtenerInstruccionesGoogle(
  origen: PuntoGeoSimple,
  destino: PuntoGeoSimple
): Promise<RutaInstrucciones | null> {
  const data = await directionsFetch({
    origin: wp(origen),
    destination: wp(destino),
  });
  if (!data) return null;

  const ruta = data.routes[0];
  const pasos: PasoInstruccion[] = [];
  const puntos: Array<{ lat: number; lng: number }> = [];

  for (const leg of ruta.legs || []) {
    for (const paso of leg.steps || []) {
      const pts = decodificarPolyline(String(paso?.polyline?.points || '')).map(redondear);
      if (pts.length === 0) continue;
      pasos.push({
        instruccion: limpiarInstruccion(String(paso?.html_instructions || '')),
        maniobra: paso?.maneuver || null,
        distanciaM: Math.round(Number(paso?.distance?.value || 0)),
        duracionS: Math.round(Number(paso?.duration?.value || 0)),
        puntos: pts,
      });
      // Encadenar sin duplicar el vértice de unión entre pasos
      const desde = puntos.length > 0 ? 1 : 0;
      for (let i = desde; i < pts.length; i++) puntos.push(pts[i]);
    }
  }

  if (pasos.length === 0 || puntos.length < 2) return null;

  const { km, min } = sumarLegs(ruta);
  return { pasos, puntos, distanciaKm: km, tiempoMin: min };
}
