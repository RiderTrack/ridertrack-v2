// ═══════════════════════════════════════════════════════════
// 🎧 PODCASTS RSS — SERVICIO (Fase 3.43)
// El reproductor de podcasts "de verdad" (novelas, audiolibros,
// ciencia ficción): listas públicas de episodios vía RSS, sin
// cuenta y sin pago. Núcleo puro → utils/podcastRssCore.ts.
//
// DÓNDE VIVE TODO (mismo patrón que caja/odómetro):
//   · Reproducción → un <audio> propio (como la radio, pero con
//     VELOCIDAD variable y memoria de posición por episodio)
//   · Suscripciones + posiciones → localStorage
//     `rt_pod_subs_{uid}` / `rt_pod_pos_{uid}` (instantáneo)
//   · Nube → Firestore usuarios/{uid}.podcasts
//     { subs, posiciones, velocidad, at } — MISMO doc con reglas
//     ya publicadas → cero reglas nuevas, cero bot.
//   · Feeds → cache en memoria + localStorage (45 min de TTL,
//     y si no hay red se usa aunque esté vencido)
//   · Descargas offline → Cache API del WebView (clave = URL
//     del mp3) → se escucha SIN GASTAR DATOS.
//
// La red usa CapacitorHttp del APK (salta CORS — el WebView
// no puede leer RSS ajeno por fetch); en web usa fetch con
// proxy público de respaldo. El buscador es la API pública de
// iTunes (sin llave).
//
// Cortesía con la navegación: cuando la voz de la app habla
// (evento 'rt-voz-nav'), el episodio se auto-pausa y vuelve
// solo 10 s después del último aviso (mismo criterio F3.42).
// ═══════════════════════════════════════════════════════════

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  EpisodioPodcast,
  FeedPodcast,
  SuscripcionPodcast,
  PosicionEpisodio,
  PosicionesEpisodios,
  ResultadoBusquedaPodcast,
  MAX_SUSCRIPCIONES,
  MAX_EPISODIOS_FEED_PERSIST,
  claveEpisodio,
  feedTTLVigente,
  formatearMB,
  fusionarPosiciones,
  fusionarSuscripciones,
  mapearResultadoITunes,
  normalizarVelocidad,
  parsearFeedRss,
  podarPosiciones,
  segundosIniciales,
  urlBusquedaITunes,
} from '../utils/podcastRssCore';

// ── Tipos ─────────────────────────────────────────────────

/** Episodio en reproducción (episode del feed + datos del podcast) */
export interface EpisodioRSS extends EpisodioPodcast {
  feedUrl: string;
  podcastTitulo: string;
  imagen: string;
}

export type FasePodcastRSS = 'nada' | 'cargando' | 'reproduciendo' | 'pausado' | 'error';

export interface EstadoPodcastsRSS {
  episodio: EpisodioRSS | null;
  fase: FasePodcastRSS;
  /** segundos escuchados */
  seg: number;
  /** duración conocida */
  durSeg: number;
  /** velocidad (persistida — las novelas a 2× avanzan solas) */
  velocidad: number;
  /** >0 si retomó donde quedó (para el aviso "sigues donde lo dejaste") */
  retomoSeg: number;
  /** url del mp3 → 'bajando' | 'lista' */
  descargas: Record<string, 'bajando' | 'lista'>;
  error: string | null;
}

// ── Constantes ────────────────────────────────────────────

const EVENTO = 'rt-podcasts-cambio';
const NOMBRE_CACHE = 'rt-podcasts-v1';
const CLAVE_SUBS = (uid: string) => `rt_pod_subs_${uid}`;
const CLAVE_POS = (uid: string) => `rt_pod_pos_${uid}`;
const CLAVE_GUARDO = (uid: string) => `rt_pod_guardo_${uid}`;
const CLAVE_VEL = 'rt_pod_velocidad';
const CLAVE_FEED = (uid: string, url: string) => `rt_pod_feed_${uid}_${hashUrl(url)}`;
/** límite de descarga: 250 MB */
export const MAX_BYTES_DESCARGA = 250 * 1024 * 1024;
/** guarda la posición cada 5 s mientras suena */
const INTERVALO_GUARDADO_MS = 5000;
/** sube a la nube a lo más cada 45 s */
const DELAY_REMOTO_MS = 45_000;
/** la voz de navegación pausa; vuelve 10 s después del último aviso */
const DELAY_AUTO_REANUDAR_MS = 10_000;

// ── Globals defensivas (Node no tiene navegador) ──────────

function win(): any | null {
  try { return typeof window !== 'undefined' ? window : null; } catch { return null; }
}
function ls(): any | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
function cachesOK(): boolean {
  try { return typeof caches !== 'undefined' && typeof (caches as any).open === 'function'; } catch { return false; }
}
function hashUrl(url: string): string {
  let h = 5381;
  const s = String(url || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ── Estado interno ────────────────────────────────────────

let _uid: string | null = null;
let _episodio: EpisodioRSS | null = null;
let _fase: FasePodcastRSS = 'nada';
let _seg = 0;
let _durSeg = 0;
let _velocidad = 1;
let _retomoSeg = 0;
let _error: string | null = null;
let _descargas: Record<string, 'bajando' | 'lista'> = {};
let _subs: SuscripcionPodcast[] = [];
let _posiciones: PosicionesEpisodios = {};
/** feedUrl → { feed, at } (memoria; en localStorage por feed) */
let _feeds: Record<string, { feed: FeedPodcast; at: number }> = {};

let _audio: HTMLAudioElement | null = null;
let _blobUrl: string | null = null;
let _tickGuardado: ReturnType<typeof setInterval> | null = null;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let _vozTimer: ReturnType<typeof setTimeout> | null = null;
let _autoPausaPorVoz = false;
let _onVoz: (() => void) | null = null;
let _onOcultar: (() => void) | null = null;

const _oyentes = new Set<() => void>();
let _tick = 0;
let _snapCache: EstadoPodcastsRSS | null = null;
let _snapTick = -1;

// ── Emisión (patrón caja) ─────────────────────────────────

function emitir(): void {
  _tick++;
  const w = win();
  if (w && typeof w.dispatchEvent === 'function') {
    try {
      if (typeof CustomEvent === 'function') w.dispatchEvent(new CustomEvent(EVENTO));
    } catch { /* sin eventos */ }
  }
  _oyentes.forEach((fn) => fn());
}

/** Snapshot ESTABLE para useSyncExternalStore */
export function snapshotPodcastsRSS(): EstadoPodcastsRSS {
  if (!_snapCache || _snapTick !== _tick) {
    _snapCache = {
      episodio: _episodio,
      fase: _fase,
      seg: _seg,
      durSeg: _durSeg,
      velocidad: _velocidad,
      retomoSeg: _retomoSeg,
      descargas: { ..._descargas },
      error: _error,
    };
    _snapTick = _tick;
  }
  return _snapCache;
}

export function suscribirPodcastsRSS(cb: () => void): () => void {
  _oyentes.add(cb);
  return () => { _oyentes.delete(cb); };
}

// ── Persistencia local ────────────────────────────────────

function cargarSubsLocal(uid: string): SuscripcionPodcast[] {
  const store = ls();
  if (!store) return [];
  try {
    const p = JSON.parse(store.getItem(CLAVE_SUBS(uid)) || '[]');
    return Array.isArray(p) ? p.filter((x: any) => x && typeof x.feedUrl === 'string') : [];
  } catch { return []; }
}

function cargarPosLocal(uid: string): PosicionesEpisodios {
  const store = ls();
  if (!store) return {};
  try {
    const p = JSON.parse(store.getItem(CLAVE_POS(uid)) || '{}');
    return p && typeof p === 'object' ? p : {};
  } catch { return {}; }
}

function leerVelocidadLocal(): number {
  const store = ls();
  if (!store) return 1;
  try { return normalizarVelocidad(parseFloat(store.getItem(CLAVE_VEL) || '')); } catch { return 1; }
}

function persistirLocal(): void {
  const store = ls();
  if (!store || !_uid) return;
  try {
    store.setItem(CLAVE_SUBS(_uid), JSON.stringify(_subs));
    store.setItem(CLAVE_POS(_uid), JSON.stringify(_posiciones));
    store.setItem(CLAVE_VEL, String(_velocidad));
  } catch { /* sin storage */ }
}

function persistirFeedLocal(feedUrl: string): void {
  const store = ls();
  if (!store || !_uid) return;
  try {
    const cache = _feeds[feedUrl];
    if (!cache) return;
    const recortado: FeedPodcast = { ...cache.feed, episodios: cache.feed.episodios.slice(0, MAX_EPISODIOS_FEED_PERSIST) };
    store.setItem(CLAVE_FEED(_uid, feedUrl), JSON.stringify({ feed: recortado, at: cache.at }));
  } catch { /* cache opcional */ }
}

function cargarFeedPersistido(feedUrl: string): { feed: FeedPodcast; at: number } | null {
  const store = ls();
  if (!store || !_uid) return null;
  try {
    const raw = store.getItem(CLAVE_FEED(_uid, feedUrl));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.feed && Array.isArray(p.feed.episodios)) return { feed: p.feed, at: Number(p.at) || 0 };
    return null;
  } catch { return null; }
}

function ultimoGuardoLocal(uid: string): number {
  const store = ls();
  if (!store) return 0;
  try { return Number(store.getItem(CLAVE_GUARDO(uid))) || 0; } catch { return 0; }
}

function marcarGuardoLocal(uid: string): void {
  const store = ls();
  if (!store) return;
  try { store.setItem(CLAVE_GUARDO(uid), String(Date.now())); } catch { /* sin storage */ }
}

// ── Firestore (usuarios/{uid}.podcasts — doc con reglas ya existentes) ──

async function guardarRemoto(): Promise<void> {
  if (!_uid || !db) return;
  try {
    await setDoc(
      doc(db, 'usuarios', _uid),
      {
        podcasts: {
          subs: _subs.slice(0, MAX_SUSCRIPCIONES),
          posiciones: podarPosiciones(_posiciones),
          velocidad: _velocidad,
          at: Date.now(),
        },
      },
      { merge: true }
    );
    marcarGuardoLocal(_uid);
  } catch (e) {
    console.warn('⚠️ Podcasts: no se pudo guardar en la nube (queda en el teléfono)', e);
  }
}

function programarGuardoRemoto(): void {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    void guardarRemoto();
  }, DELAY_REMOTO_MS);
}

async function sincronizarRemoto(uid: string): Promise<void> {
  if (!uid || !db) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return;
    const c = (snap.data() as any)?.podcasts;
    if (!c || typeof c !== 'object') return;

    const remotoSubs: SuscripcionPodcast[] = Array.isArray(c.subs) ? c.subs : [];
    const remotoPos: PosicionesEpisodios = c.posiciones && typeof c.posiciones === 'object' ? c.posiciones : {};
    const velRemota = Number(c.velocidad) || 1;

    const subsFusion = fusionarSuscripciones(_subs, remotoSubs);
    const posFusion = podarPosiciones(fusionarPosiciones(_posiciones, remotoPos));
    // la velocidad remota manda si se guardó después que la local
    const velFusion = (c.at || 0) >= ultimoGuardoLocal(uid) ? normalizarVelocidad(velRemota) : _velocidad;

    if (
      JSON.stringify(subsFusion) !== JSON.stringify(_subs) ||
      JSON.stringify(posFusion) !== JSON.stringify(_posiciones) ||
      velFusion !== _velocidad
    ) {
      _subs = subsFusion;
      _posiciones = posFusion;
      _velocidad = velFusion;
      if (_audio) { try { _audio.playbackRate = _velocidad; } catch {} }
      persistirLocal();
      emitir();
    }
  } catch (e) {
    console.warn('⚠️ Podcasts: no se pudo sincronizar desde la nube', e);
  }
}

// ── Red (CapacitorHttp en el APK salta CORS) ──────────────

function esNativo(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

/** XML/JSON crudo como texto (RSS o respuesta cruda) */
async function pedirExterno(url: string): Promise<any> {
  if (esNativo()) {
    const r = await CapacitorHttp.get({ url, responseType: 'text' });
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    return r.data;
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.text();
  } catch (e) {
    // web: proxy público sin llave (solo para probar en navegador)
    const resp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.text();
  }
}

async function obtenerTextoExterno(url: string): Promise<string> {
  const data = await pedirExterno(url);
  return typeof data === 'string' ? data : String(data ?? '');
}

async function obtenerJSONExterno(url: string): Promise<any> {
  // CapacitorHttp/web parsean solos el JSON por content-type
  if (esNativo()) {
    const r = await CapacitorHttp.get({ url, responseType: 'text' });
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    if (r.data && typeof r.data === 'object') return r.data;
    try { return JSON.parse(String(r.data)); } catch { return null; }
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  try { return await resp.json(); } catch { return null; }
}

function base64ABuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** mp3 como ArrayBuffer — en nativo el puente devuelve base64 */
async function obtenerBinarioExterno(url: string): Promise<ArrayBuffer> {
  if (esNativo()) {
    const r = await CapacitorHttp.get({ url, responseType: 'arraybuffer' });
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    const data: any = r.data;
    if (data instanceof ArrayBuffer) return data;
    if (typeof Blob !== 'undefined' && data instanceof Blob) return await data.arrayBuffer();
    if (typeof data === 'string' && data.length) return base64ABuffer(data);
    throw new Error('binario no soportado');
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.arrayBuffer();
}

// ── Buscador (iTunes Search API — pública, sin llave) ──────

/** F3.45: 50 resultados por defecto (antes 25) — biblioteca más amplia */
export const LIMITE_BUSQUEDA_ITUNES = 50;

export async function buscarPodcastsRSS(q: string, limite: number = LIMITE_BUSQUEDA_ITUNES): Promise<ResultadoBusquedaPodcast[]> {
  const term = String(q || '').trim();
  if (term.length < 2) return [];
  const datos = await obtenerJSONExterno(urlBusquedaITunes(term, limite));
  const resultados = Array.isArray(datos?.results) ? datos.results : [];
  const vistos = new Set<string>();
  const salida: ResultadoBusquedaPodcast[] = [];
  for (const r of resultados) {
    const m = mapearResultadoITunes(r);
    if (m && !vistos.has(m.feedUrl)) { vistos.add(m.feedUrl); salida.push(m); }
  }
  return salida;
}

// ── Suscripciones ─────────────────────────────────────────

export function suscripcionesRSS(): SuscripcionPodcast[] {
  return _subs.map((s) => ({ ...s }));
}

export function posicionDeRSS(url: string): PosicionEpisodio | undefined {
  return _posiciones[claveEpisodio(url)];
}

/** posición leída del <audio> en vivo (para la barra del player) */
export function posicionVivaRSS(): number {
  try { return Math.max(0, Math.floor(_audio?.currentTime || _seg || 0)); } catch { return _seg; }
}

/** duración leída del <audio> en vivo (0 si aún no carga metadata) */
export function duracionVivaRSS(): number {
  try {
    const d = _audio?.duration;
    return Number.isFinite(d) && d > 0 ? Math.floor(d) : (_durSeg || 0);
  } catch { return _durSeg; }
}

/** seguir un podcast (desde el buscador o desde su feed ya parseado) */
export function agregarSuscripcionRSS(datos: { feedUrl: string; titulo: string; autor?: string; imagen?: string }): SuscripcionPodcast {
  const feedUrl = String(datos.feedUrl || '').trim();
  if (!/^https?:\/\//i.test(feedUrl)) throw new Error('URL del feed no válida');
  const ahora = Date.now();
  const nueva: SuscripcionPodcast = {
    feedUrl,
    titulo: (datos.titulo || 'Podcast').trim(),
    autor: (datos.autor || '').trim(),
    imagen: (datos.imagen || '').trim(),
    agregadoAt: ahora,
    ultimoVistoAt: ahora,
  };
  _subs = fusionarSuscripciones([nueva], _subs);
  persistirLocal();
  programarGuardoRemoto();
  emitir();
  return _subs.find((s) => s.feedUrl === feedUrl) || nueva;
}

export function quitarSuscripcionRSS(feedUrl: string): void {
  _subs = _subs.filter((s) => s.feedUrl !== feedUrl);
  const store = ls();
  if (store && _uid) {
    try { store.removeItem(CLAVE_FEED(_uid, feedUrl)); } catch {}
  }
  delete _feeds[feedUrl];
  persistirLocal();
  programarGuardoRemoto();
  emitir();
}

/** se llama al ABRIR la lista de episodios (limpia el badge de nuevos) */
export function marcarFeedVistoRSS(feedUrl: string): void {
  const sub = _subs.find((s) => s.feedUrl === feedUrl);
  if (!sub) return;
  sub.ultimoVistoAt = Date.now();
  persistirLocal();
  emitir();
}

// ── Feeds ─────────────────────────────────────────────────

/** feed en cache de memoria (para el badge de NUEVOS sin red) */
export function feedCacheRSS(feedUrl: string): FeedPodcast | null {
  const c = _feeds[feedUrl];
  return c ? c.feed : null;
}

/**
 * Feed de un podcast: cache 45 min → red → cache vencida si no
 * hay red (la lista abre igual, sin gastar datos).
 */
export async function obtenerFeedRSS(feedUrl: string, forzar = false): Promise<FeedPodcast> {
  const url = String(feedUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('URL no válida');
  const cache = _feeds[url] || cargarFeedPersistido(url);
  if (cache) _feeds[url] = cache;
  if (!forzar && cache && feedTTLVigente(cache.at)) return cache.feed;

  let xml: string;
  try {
    xml = await obtenerTextoExterno(url);
  } catch (e) {
    // sin red (o feed caído) → cache vencido mejor que nada
    if (cache) return cache.feed;
    throw e;
  }
  const feed = parsearFeedRss(xml, url);
  if (!feed) throw new Error('No parece un feed de podcast (RSS)');
  const sub = _subs.find((s) => s.feedUrl === url);
  if (sub) {
    if (!feed.imagen && sub.imagen) feed.imagen = sub.imagen;
    if (!feed.autor && sub.autor) feed.autor = sub.autor;
  }
  _feeds[url] = { feed, at: Date.now() };
  persistirFeedLocal(url);
  emitir();
  return feed;
}

/** seguir un podcast pegando la URL de su RSS */
export async function agregarPorURLRSS(url: string): Promise<{ sub: SuscripcionPodcast; feed: FeedPodcast }> {
  const feed = await obtenerFeedRSS(url);
  const sub = agregarSuscripcionRSS({
    feedUrl: url,
    titulo: feed.titulo,
    autor: feed.autor,
    imagen: feed.imagen,
  });
  return { sub, feed };
}

// ── Descargas offline (Cache API) ─────────────────────────

async function respuestaDescarga(url: string): Promise<Blob | null> {
  if (!cachesOK()) return null;
  try {
    const c = await (caches as any).open(NOMBRE_CACHE);
    const r = await c.match(url);
    if (!r) return null;
    return await r.blob();
  } catch { return null; }
}

export async function estaDescargadoRSS(url: string): Promise<boolean> {
  return !!(await respuestaDescarga(url));
}

/** marca en el estado las urls que ya están descargadas (al abrir la lista) */
export async function refrescarDescargasRSS(urls: string[]): Promise<void> {
  if (!Array.isArray(urls) || !urls.length) return;
  let cambio = false;
  for (const u of urls) {
    if (_descargas[u] === 'bajando') continue;
    if (await estaDescargadoRSS(u)) {
      if (_descargas[u] !== 'lista') { _descargas[u] = 'lista'; cambio = true; }
    } else if (_descargas[u] === 'lista') {
      delete _descargas[u]; cambio = true;
    }
  }
  if (cambio) emitir();
}

export async function descargarEpisodioRSS(ep: EpisodioRSS): Promise<void> {
  const url = ep.url;
  if (_descargas[url] === 'bajando') return;
  if (await estaDescargadoRSS(url)) { _descargas[url] = 'lista'; emitir(); return; }

  const tam = Number(ep.tamanoBytes) || 0;
  if (tam > MAX_BYTES_DESCARGA) {
    throw new Error(`Episodio muy grande (${formatearMB(tam)}) — queda en streaming`);
  }
  _descargas[url] = 'bajando';
  _error = null;
  emitir();
  try {
    const buffer = await obtenerBinarioExterno(url);
    if (!buffer || !buffer.byteLength) throw new Error('respuesta vacía');
    if (buffer.byteLength > MAX_BYTES_DESCARGA) throw new Error('Episodio muy grande — queda en streaming');
    if (!cachesOK()) throw new Error('Este equipo no guarda descargas');
    const c = await (caches as any).open(NOMBRE_CACHE);
    await c.put(url, new Response(buffer, { headers: { 'Content-Type': 'audio/mpeg' } }));
    _descargas[url] = 'lista';
    emitir();
  } catch (e: any) {
    delete _descargas[url];
    _error = e?.message ? String(e.message) : 'No se pudo descargar';
    emitir();
    throw e;
  }
}

export async function eliminarDescargaRSS(url: string): Promise<void> {
  delete _descargas[url];
  if (cachesOK()) {
    try {
      const c = await (caches as any).open(NOMBRE_CACHE);
      await c.delete(url);
    } catch { /* cache opcional */ }
  }
  emitir();
}

// ── El <audio> del podcast ────────────────────────────────

function asegurarAudio(): HTMLAudioElement {
  if (_audio) return _audio;
  const A = (typeof Audio !== 'undefined' ? Audio : null) as any;
  const a: HTMLAudioElement = A ? new A() : ({} as HTMLAudioElement);
  try { a.preload = 'metadata'; } catch {}
  try { (a as any).preservesPitch = true; } catch {}
  try { a.playbackRate = _velocidad; } catch {}

  a.addEventListener?.('timeupdate', () => {
    // ⚠️ sin emitir: el seg se lee con posicionVivaRSS() — así el
    // timeupdate NO re-renderiza toda la app cada segundo
    const seg = Math.floor(a.currentTime || 0);
    if (seg !== _seg) _seg = seg;
  });
  a.addEventListener?.('loadedmetadata', () => {
    if (Number.isFinite(a.duration) && a.duration > 0) {
      _durSeg = Math.floor(a.duration);
      emitir();
    }
  });
  a.addEventListener?.('playing', () => {
    _fase = 'reproduciendo';
    _error = null;
    iniciarGuardado();
    fijarMediaPlaybackState('playing');
    emitir();
  });
  a.addEventListener?.('pause', () => {
    if (_fase === 'nada') return; // detener() ya limpió
    _fase = 'pausado';
    pararGuardado();
    guardarPosicion(false);
    fijarMediaPlaybackState('paused');
    emitir();
  });
  a.addEventListener?.('ended', () => {
    guardarPosicion(true);
    pararGuardado();
    _fase = 'nada';
    _episodio = null;
    _seg = 0;
    _retomoSeg = 0;
    programarGuardoRemoto();
    emitir();
  });
  a.addEventListener?.('error', () => {
    if (!_episodio) return;
    _fase = 'error';
    _error = '⚠️ El episodio no respondió — prueba de nuevo';
    pararGuardado();
    emitir();
  });

  _audio = a;
  return a;
}

function iniciarGuardado(): void {
  if (_tickGuardado) return;
  _tickGuardado = setInterval(() => {
    if (_fase === 'reproduciendo') guardarPosicion(false);
  }, INTERVALO_GUARDADO_MS);
}
function pararGuardado(): void {
  if (_tickGuardado) { clearInterval(_tickGuardado); _tickGuardado = null; }
}

/** "recordar posición": guarda dónde vas de ESTE episodio */
function guardarPosicion(fin: boolean): void {
  if (!_episodio) return;
  const a = _audio;
  const clave = claveEpisodio(_episodio.url);
  const dur = a && Number.isFinite(a.duration) && a.duration > 0
    ? Math.floor(a.duration)
    : (Number(_durSeg) || _episodio.duracionSeg || 0);
  const seg = fin ? dur : (a && Number.isFinite(a.currentTime) ? Math.max(0, Math.floor(a.currentTime)) : _seg);
  _posiciones[clave] = {
    guid: _episodio.guid,
    titulo: _episodio.titulo,
    feedUrl: _episodio.feedUrl,
    seg,
    durSeg: dur,
    fin,
    at: Date.now(),
  };
  _posiciones = podarPosiciones(_posiciones);
  persistirLocal();
  programarGuardoRemoto();
}

// ── Controles del reproductor ─────────────────────────────

export async function tocarEpisodioRSS(ep: EpisodioRSS): Promise<void> {
  const clave = claveEpisodio(ep.url);
  // mismo episodio tocado de nuevo → solo reanudar
  if (_episodio && claveEpisodio(_episodio.url) === clave && _fase !== 'error') {
    if (_fase === 'pausado' || _fase === 'cargando') reanudarEpisodioRSS();
    return;
  }

  const a = asegurarAudio();
  _episodio = { ...ep };
  _fase = 'cargando';
  _seg = 0;
  _durSeg = Number(ep.duracionSeg) || 0;
  _retomoSeg = 0;
  _error = null;
  pararGuardado();
  emitir();

  // ¿está descargado? → blob local (cero datos)
  let src = ep.url;
  const local = await respuestaDescarga(ep.url);
  if (local) {
    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        if (_blobUrl) { try { URL.revokeObjectURL(_blobUrl); } catch {} }
        _blobUrl = URL.createObjectURL(local);
        src = _blobUrl;
        _descargas[ep.url] = 'lista';
        emitir();
      }
    } catch { src = ep.url; }
  }

  const { seg, retomo } = segundosIniciales(_posiciones[clave], ep.duracionSeg);
  _retomoSeg = retomo ? seg : 0;

  try { a.playbackRate = _velocidad; } catch {}
  try { (a as any).preservesPitch = true; } catch {}
  a.src = src;
  if (seg > 0) {
    const alMeta = () => { try { a.currentTime = seg; } catch {} };
    a.addEventListener?.('loadedmetadata', alMeta, { once: true } as any);
  }
  try {
    await a.play();
  } catch {
    // reintentos: sin seek (algunos servers sin ranges) y de cero
    try { a.currentTime = 0; await a.play(); }
    catch {
      _fase = 'error';
      _error = 'No se pudo reproducir el episodio';
      emitir();
      return;
    }
  }
  if (seg > 0 && (a.currentTime || 0) < 1) { try { a.currentTime = seg; } catch {} }
  _seg = Math.floor(a.currentTime || 0);
  actualizarMediaSession();
  emitir();
}

export function pausarEpisodioRSS(porVoz = false): void {
  if (!_audio || !_episodio) return;
  if (!porVoz) {
    // pausa MANUAL → cancela el auto-reanudar
    _autoPausaPorVoz = false;
    if (_vozTimer) { clearTimeout(_vozTimer); _vozTimer = null; }
  }
  try { _audio.pause(); } catch {}
}

export function reanudarEpisodioRSS(): void {
  if (!_audio || !_episodio) return;
  _autoPausaPorVoz = false;
  if (_vozTimer) { clearTimeout(_vozTimer); _vozTimer = null; }
  const a = _audio;
  _fase = 'cargando';
  emitir();
  a.play?.().catch(() => {
    _fase = 'error';
    _error = 'No se pudo reanudar — toca el episodio de nuevo';
    emitir();
  });
}

export function toggleEpisodioRSS(): void {
  if (_fase === 'reproduciendo') pausarEpisodioRSS();
  else reanudarEpisodioRSS();
}

export function detenerEpisodioRSS(): void {
  guardarPosicion(false);
  pararGuardado();
  _autoPausaPorVoz = false;
  if (_vozTimer) { clearTimeout(_vozTimer); _vozTimer = null; }
  const a = _audio;
  if (a) {
    try { a.pause(); } catch {}
    try { a.removeAttribute('src'); a.load(); } catch {}
  }
  if (_blobUrl) { try { URL.revokeObjectURL(_blobUrl); } catch {} _blobUrl = null; }
  _episodio = null;
  _fase = 'nada';
  _seg = 0;
  _retomoSeg = 0;
  programarGuardoRemoto();
  emitir();
}

export function saltarEpisodioRSS(segDestino: number): void {
  if (!_audio || !_episodio) return;
  const a = _audio;
  const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : _durSeg;
  let seg = Math.max(0, Math.floor(segDestino));
  if (dur > 0) seg = Math.min(seg, Math.floor(dur) - 1);
  try { a.currentTime = seg; } catch { return; }
  _seg = seg;
  guardarPosicion(false);
  emitir();
}

export function avanzarEpisodioRSS(deltaSeg = 15): void {
  saltarEpisodioRSS(_seg + deltaSeg);
}

export function fijarVelocidadRSS(v: number): void {
  _velocidad = normalizarVelocidad(v);
  if (_audio) { try { _audio.playbackRate = _velocidad; } catch {} }
  persistirLocal();
  emitir();
}

// ── MediaSession (controles de la pantalla de bloqueo) ────

function actualizarMediaSession(): void {
  const w = win();
  const ms = w?.navigator?.mediaSession;
  if (!ms || !_episodio) return;
  try {
    const MM = (w as any).MediaMetadata;
    if (MM) {
      ms.metadata = new MM({
        title: _episodio.titulo,
        artist: _episodio.podcastTitulo,
        album: 'RiderTrack Podcasts',
        artwork: _episodio.imagen ? [{ src: _episodio.imagen, sizes: '512x512' }] : [],
      });
    }
    const set = (accion: string, fn: (d?: any) => void) => {
      try { ms.setActionHandler(accion, fn); } catch { /* acción no soportada */ }
    };
    set('play', () => reanudarEpisodioRSS());
    set('pause', () => pausarEpisodioRSS());
    set('stop', () => detenerEpisodioRSS());
    set('seekbackward', () => avanzarEpisodioRSS(-15));
    set('seekforward', () => avanzarEpisodioRSS(15));
    set('seekto', (d: any) => { if (d && Number.isFinite(d.seekTime)) saltarEpisodioRSS(d.seekTime); });
  } catch { /* sin mediaSession */ }
}

function fijarMediaPlaybackState(estado: 'playing' | 'paused'): void {
  const w = win();
  try { w?.navigator?.mediaSession && (w.navigator.mediaSession.playbackState = estado); } catch {}
}

// ── Cortesía con la voz de navegación (F3.42) ──────────────

function autoPausaPorVoz(): void {
  if (_fase !== 'reproduciendo') return;
  _autoPausaPorVoz = true;
  pausarEpisodioRSS(true);
  if (_vozTimer) clearTimeout(_vozTimer);
  _vozTimer = setTimeout(() => {
    _vozTimer = null;
    if (_autoPausaPorVoz && _fase === 'pausado') {
      _autoPausaPorVoz = false;
      reanudarEpisodioRSS();
    }
  }, DELAY_AUTO_REANUDAR_MS);
}

// ── Arranque ──────────────────────────────────────────────

/**
 * Arranca el servicio para este usuario: local al toque + nube
 * en segundo plano + cortesía con la voz de navegación.
 */
export function arrancarPodcastsRSS(uid: string): () => void {
  if (_uid === uid && _uid !== null) return () => undefined;

  // usuario distinto → reset de reproducción
  if (_uid && _uid !== uid) detenerEpisodioRSS();

  _uid = uid;
  _subs = cargarSubsLocal(uid);
  _posiciones = cargarPosLocal(uid);
  _velocidad = leerVelocidadLocal();
  if (_audio) { try { _audio.playbackRate = _velocidad; } catch {} }
  _feeds = {};
  emitir();
  void sincronizarRemoto(uid);

  const w = win();
  if (w && typeof w.addEventListener === 'function') {
    _onVoz = () => autoPausaPorVoz();
    w.addEventListener('rt-voz-nav', _onVoz);
    _onOcultar = () => {
      guardarPosicion(false);
      persistirLocal();
      void guardarRemoto();
    };
    w.addEventListener('pagehide', _onOcultar);
  }
  return () => {
    if (w && typeof w.removeEventListener === 'function') {
      if (_onVoz) w.removeEventListener('rt-voz-nav', _onVoz);
      if (_onOcultar) w.removeEventListener('pagehide', _onOcultar);
    }
    _onVoz = null;
    _onOcultar = null;
  };
}

/** Re-sincroniza desde la nube (prueba de merge o futuro botón ↻) */
export async function recargarPodcastsRSS(): Promise<void> {
  if (!_uid) return;
  await sincronizarRemoto(_uid);
}
