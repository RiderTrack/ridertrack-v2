// ═══════════════════════════════════════════════════════════
// 🎧 PODCASTS RSS — NÚCLEO PURO (Fase 3.43)
// Los podcasts "de verdad": listas públicas de episodios (mp3)
// publicadas vía RSS — sin cuenta, sin pago. Este archivo es
// 100% puro (solo strings y números) para testearlo en Node:
//   · parsearFeedRss → lee un XML RSS/Atom y saca el podcast
//     (título, autor, imagen) y sus episodios (título, mp3,
//     duración, fecha, tamaño) — con CDATA, entidades y
//     itunes:duration en segundos o "1:02:03".
//   · Posiciones → "recordar posición": dónde quedaste de CADA
//     episodio, con fusión por marca de tiempo (teléfono nuevo
//     o segundo teléfono no pierde el avance).
//   · Suscripciones → fusión por feedUrl (gana el más nuevo).
//   · Formateadores → duración "1 h 02 m", tiempo "1:02:03",
//     fecha "hoy / ayer / 12 ago", tamaño "~42 MB".
// El reproductor y la red viven en services/podcastRSS.ts.
// ═══════════════════════════════════════════════════════════

// ── Tipos ─────────────────────────────────────────────────

/** Un episodio tal como sale del feed (o del cache del feed) */
export interface EpisodioPodcast {
  /** id estable del episodio en el feed (fallback: la URL del mp3) */
  guid: string;
  titulo: string;
  /** texto plano (HTML limpiado), truncado */
  descripcion: string;
  /** URL del mp3 (la clave de posiciones y descargas) */
  url: string;
  /** segundos (0 = el feed no lo dice) */
  duracionSeg: number;
  /** epoch ms (0 = desconocida) */
  fechaPub: number;
  /** bytes (0 = desconocido) — para avisar el tamaño de descarga */
  tamanoBytes: number;
}

/** El feed completo parseado */
export interface FeedPodcast {
  feedUrl: string;
  titulo: string;
  autor: string;
  descripcion: string;
  imagen: string;
  episodios: EpisodioPodcast[];
}

/** Una suscripción guardada (solo los metadatos, no los episodios) */
export interface SuscripcionPodcast {
  feedUrl: string;
  titulo: string;
  autor: string;
  imagen: string;
  /** cuándo la seguiste (epoch ms) */
  agregadoAt: number;
  /** cuándo abriste por última vez su lista (para el badge de NUEVOS) */
  ultimoVistoAt: number;
}

/** "Dónde quedé" de un episodio — la clave es la URL del mp3 */
export interface PosicionEpisodio {
  guid: string;
  titulo: string;
  feedUrl: string;
  /** segundos escuchados */
  seg: number;
  /** duración conocida al último guardado */
  durSeg: number;
  /** terminó de escucharlo */
  fin: boolean;
  /** epoch ms del último guardado */
  at: number;
}

export type PosicionesEpisodios = Record<string, PosicionEpisodio>;

/** Resultado del buscador (iTunes Search API) */
export interface ResultadoBusquedaPodcast {
  feedUrl: string;
  titulo: string;
  autor: string;
  imagen: string;
  genero: string;
}

// ── Constantes ────────────────────────────────────────────

export const MAX_SUSCRIPCIONES = 50;
export const MAX_POSICIONES = 300;
/** episodios por feed que se guardan en el teléfono (cache offline) */
export const MAX_EPISODIOS_FEED_PERSIST = 60;
/** un feed cacheado se considera fresco 45 min */
export const TTL_FEED_MS = 45 * 60 * 1000;
/** velocidades del reproductor (las novelas a 2× avanzan solas) */
export const VELOCIDADES_PODCAST = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];

// ── Limpieza de texto XML ─────────────────────────────────

/** Quita el envoltorio CDATA (y cualquiera que quede en el medio) */
function quitarCdata(s: string): string {
  let out = s;
  out = out.replace(/^\s*<!\[CDATA\[/i, '').replace(/\]\]>\s*$/i, '');
  out = out.replace(/<!\[CDATA\[/gi, '').replace(/\]\]>/gi, '');
  return out;
}

/** entidades con acento (las descripciones de novelas vienen llenas) */
const ENTIDADES_LATIN: Record<string, string> = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', uuml: 'ü', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Uuml: 'Ü', Ntilde: 'Ñ',
  iexcl: '¡', iquest: '¿', ndash: '–', mdash: '—', hellip: '…', ldquo: '“', rdquo: '”',
  lsquo: '\u2018', rsquo: '\u2019', apos: "'", quot: '"', nbsp: ' ', lt: '<', gt: '>', amp: '&',
};

/** Decodifica las entidades HTML más comunes */
export function decodificarEntidades(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ''; }
    })
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (todo, nombre: string) => {
      const val = ENTIDADES_LATIN[nombre] ?? ENTIDADES_LATIN[nombre.toLowerCase()];
      return val !== undefined ? val : todo; // desconocida → tal cual
    })
    .replace(/&#39;/g, "'");
}

/** texto de un tag: sin CDATA, sin entidades, recortado */
function textoTag(bruto: string): string {
  return decodificarEntidades(quitarCdata(bruto)).trim();
}

/** HTML → texto plano recortado (para descripciones) */
export function quitarHtml(s: string, max = 240): string {
  if (!s) return '';
  let out = quitarCdata(s);
  out = out.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  out = decodificarEntidades(out).replace(/\s+/g, ' ').trim();
  if (max > 0 && out.length > max) {
    out = out.slice(0, max).replace(/\s+\S*$/, '') + '…';
  }
  return out;
}

/** escapa una etiqueta para usarla en RegExp */
function escTag(t: string): string {
  return t.replace(/[^a-zA-Z0-9_:.-]/g, '\\$&');
}

/** Primer <etiqueta>…</etiqueta> del XML (con atributos, CDATA y entidades) */
export function extraerTag(xml: string, etiqueta: string): string | null {
  if (!xml) return null;
  const re = new RegExp(`<${escTag(etiqueta)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escTag(etiqueta)}>`, 'i');
  const m = xml.match(re);
  return m ? textoTag(m[1]) : null;
}

/** Valor de un atributo de la PRIMERA <etiqueta> que lo tenga */
export function extraerAtributo(xml: string, etiqueta: string, atributo: string): string | null {
  if (!xml) return null;
  const re = new RegExp(`<${escTag(etiqueta)}\\b[^>]*>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const am = m[0].match(new RegExp(`${escTag(atributo)}\\s*=\\s*["']([^"']*)["']`, 'i'));
    if (am) return decodificarEntidades(am[1]).trim();
  }
  return null;
}

// ── Fechas y duraciones ───────────────────────────────────

/** "3725" → 3725 · "1:02:03" → 3723 · "42:17" → 2537 · raro → 0 */
export function parsearDuracionITunes(v: string | null | undefined): number {
  const s = String(v == null ? '' : v).trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const partes = s.split(':').map((x) => parseInt(x, 10) || 0);
  if (partes.length === 2) return partes[0] * 60 + partes[1];
  if (partes.length >= 3) return partes[0] * 3600 + partes[1] * 60 + partes[2];
  return 0;
}

/** fecha RSS/Atom → epoch ms (0 si no se entiende) */
export function parsearFechaPub(v: string | null | undefined): number {
  const s = String(v == null ? '' : v).trim();
  if (!s) return 0;
  const t = Date.parse(s);
  if (Number.isFinite(t)) return t;
  // algunos feeds traen "Martes, 12 Set 2025 10:00:00 -0500" (set =
  // setiembre peruano) o acentos — se normaliza y reintenta
  const limpio = s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\bset\b/gi, 'Sep')
    .replace(/\babr\b/gi, 'Apr');
  const t2 = Date.parse(limpio);
  return Number.isFinite(t2) ? t2 : 0;
}

// ── Parser del feed ───────────────────────────────────────

function episodioDeItemRss(item: string): EpisodioPodcast | null {
  const url = extraerAtributo(item, 'enclosure', 'url');
  if (!url || !/^https?:\/\//i.test(url)) return null; // sin mp3 → no tocable
  const guid = extraerTag(item, 'guid') || url;
  const titulo = extraerTag(item, 'title') || 'Episodio';
  const duracionSeg = parsearDuracionITunes(extraerTag(item, 'itunes:duration'));
  const fechaPub = parsearFechaPub(
    extraerTag(item, 'pubDate') ||
    extraerTag(item, 'published') ||
    extraerTag(item, 'updated') ||
    extraerTag(item, 'dc:date')
  );
  const tamanoBytes = Number(extraerAtributo(item, 'enclosure', 'length')) || 0;
  const descripcion = quitarHtml(
    extraerTag(item, 'description') ||
    extraerTag(item, 'itunes:summary') ||
    extraerTag(item, 'content:encoded') || '',
    260
  );
  return { guid, titulo, descripcion, url, duracionSeg, fechaPub, tamanoBytes };
}

/** <link rel="enclosure" type="audio/…" href="…"> de un Atom */
function linkEnclosureAtom(xml: string): string | null {
  const re = /<link\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const tag = m[0];
    if (/rel\s*=\s*["']enclosure["']/i.test(tag) && /type\s*=\s*["']audio/i.test(tag)) {
      const h = tag.match(/href\s*=\s*["']([^"']+)["']/i);
      if (h && /^https?:\/\//i.test(h[1])) return h[1];
    }
  }
  return null;
}

function episodioDeEntryAtom(entry: string): EpisodioPodcast | null {
  const url = linkEnclosureAtom(entry);
  if (!url) return null;
  const guid = extraerTag(entry, 'id') || url;
  const titulo = extraerTag(entry, 'title') || 'Episodio';
  const duracionSeg = parsearDuracionITunes(extraerTag(entry, 'itunes:duration'));
  const fechaPub = parsearFechaPub(extraerTag(entry, 'published') || extraerTag(entry, 'updated'));
  const tamanoBytes = Number(extraerAtributo(entry, 'link', 'length')) || 0;
  const descripcion = quitarHtml(extraerTag(entry, 'summary') || extraerTag(entry, 'content') || '', 260);
  return { guid, titulo, descripcion, url, duracionSeg, fechaPub, tamanoBytes };
}

/** Ordena por fecha (más nuevo primero; sin fecha al final estable) */
export function ordenarEpisodios(eps: EpisodioPodcast[]): EpisodioPodcast[] {
  return [...eps].sort((a, b) => (b.fechaPub || 0) - (a.fechaPub || 0));
}

/**
 * XML (RSS o Atom) → FeedPodcast. null si no parece un feed de
 * podcast (sin canal/feed o sin NINGÚN episodio con audio).
 */
export function parsearFeedRss(xml: string, feedUrl: string): FeedPodcast | null {
  if (!xml || typeof xml !== 'string') return null;
  const tieneChannel = /<channel\b/i.test(xml);
  const esAtom = !tieneChannel && /<feed\b/i.test(xml);
  if (!tieneChannel && !esAtom) return null;

  // ── datos del canal ──
  let chXml = xml;
  if (tieneChannel) {
    const mCh = xml.match(/<channel\b[\s\S]*?<\/channel>/i);
    if (mCh) chXml = mCh[0];
  }
  const titulo = extraerTag(chXml, 'title') || 'Podcast';
  let autor = extraerTag(chXml, 'itunes:author') || '';
  if (!autor) {
    // <author><name>…</name></author> (Atom) o <author>mail (RSS)</author>
    const mAu = chXml.match(/<author\b[\s\S]*?<\/author>/i);
    if (mAu) autor = extraerTag(mAu[0], 'name') || quitarHtml(mAu[0], 60);
  }
  const imagen =
    extraerAtributo(chXml, 'itunes:image', 'href') ||
    (() => {
      const mIm = chXml.match(/<image\b[\s\S]*?<\/image>/i);
      return mIm ? extraerTag(mIm[0], 'url') || '' : '';
    })() ||
    '';
  const descripcion = quitarHtml(extraerTag(chXml, 'description') || extraerTag(chXml, 'itunes:summary') || extraerTag(chXml, 'subtitle') || '', 200);

  // ── episodios ──
  const episodios: EpisodioPodcast[] = [];
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const it of items) {
    const ep = episodioDeItemRss(it);
    if (ep) episodios.push(ep);
  }
  if (!episodios.length) {
    const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
    for (const en of entries) {
      const ep = episodioDeEntryAtom(en);
      if (ep) episodios.push(ep);
    }
  }
  if (!episodios.length) return null;

  return {
    feedUrl,
    titulo: titulo || 'Podcast',
    autor,
    descripcion,
    imagen,
    episodios: ordenarEpisodios(episodios),
  };
}

// ── iTunes Search (buscador sin cuenta) ───────────────────

export function urlBusquedaITunes(q: string, limite = 25): string {
  return `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=${limite}&term=${encodeURIComponent(q.trim())}`;
}

/** Un resultado crudo de iTunes → datos limpios (null si no tiene feedUrl) */
export function mapearResultadoITunes(r: any): ResultadoBusquedaPodcast | null {
  if (!r || typeof r !== 'object') return null;
  const feedUrl = typeof r.feedUrl === 'string' ? r.feedUrl.trim() : '';
  const titulo = String(r.collectionName || '').trim();
  if (!feedUrl || !titulo) return null;
  return {
    feedUrl,
    titulo,
    autor: String(r.artistName || '').trim(),
    imagen: String(r.artworkUrl600 || r.artworkUrl100 || '').trim(),
    genero: String(r.primaryGenreName || '').trim(),
  };
}

// ── Fusión local ↔ nube ───────────────────────────────────

/** union por feedUrl; en choque gana el más nuevo (agregadoAt), ultimoVistoAt = el mayor */
export function fusionarSuscripciones(a: SuscripcionPodcast[], b: SuscripcionPodcast[]): SuscripcionPodcast[] {
  const mapa = new Map<string, SuscripcionPodcast>();
  const poner = (s: SuscripcionPodcast) => {
    const previo = mapa.get(s.feedUrl);
    if (!previo) { mapa.set(s.feedUrl, { ...s }); return; }
    const gana = (previo.agregadoAt || 0) >= (s.agregadoAt || 0) ? previo : s;
    const agregadoMin = Math.min(previo.agregadoAt || Infinity, s.agregadoAt || Infinity);
    mapa.set(s.feedUrl, {
      ...gana,
      // cuándo lo seguiste DE VERDAD = la primera vez (la menor)
      agregadoAt: Number.isFinite(agregadoMin) ? agregadoMin : (gana.agregadoAt || 0),
      ultimoVistoAt: Math.max(previo.ultimoVistoAt || 0, s.ultimoVistoAt || 0),
    });
  };
  (Array.isArray(a) ? a : []).forEach(poner);
  (Array.isArray(b) ? b : []).forEach(poner);
  return [...mapa.values()]
    .sort((x, y) => (y.agregadoAt || 0) - (x.agregadoAt || 0))
    .slice(0, MAX_SUSCRIPCIONES);
}

/** union por clave de episodio; en choque gana el guardado más reciente (at) */
export function fusionarPosiciones(a: PosicionesEpisodios, b: PosicionesEpisodios): PosicionesEpisodios {
  const salida: PosicionesEpisodios = {};
  const norm = (p: PosicionesEpisodios | null | undefined): PosicionesEpisodios =>
    p && typeof p === 'object' ? p : {};
  for (const [k, v] of Object.entries(norm(a))) {
    if (v && typeof v === 'object') salida[k] = v;
  }
  for (const [k, v] of Object.entries(norm(b))) {
    if (!v || typeof v !== 'object') continue;
    const previo = salida[k];
    if (!previo || (v.at || 0) >= (previo.at || 0)) salida[k] = v;
  }
  return salida;
}

/** si hay más de max posiciones, se quedan con las más recientes */
export function podarPosiciones(p: PosicionesEpisodios, max = MAX_POSICIONES): PosicionesEpisodios {
  const claves = Object.keys(p);
  if (claves.length <= max) return p;
  const ordenadas = claves.sort((x, y) => (p[y].at || 0) - (p[x].at || 0)).slice(0, max);
  const salida: PosicionesEpisodios = {};
  for (const k of ordenadas) salida[k] = p[k];
  return salida;
}

// ── "Recordar posición" ───────────────────────────────────

/** clave estable de un episodio (la URL del mp3 sin #fragmento) */
export function claveEpisodio(url: string): string {
  return String(url || '').trim().split('#')[0];
}

/**
 * ¿Por dónde arranco este episodio?
 *   · sin posición / terminado / <30 s escuchado / al 97 % → desde 0
 *   · resto → exactamente donde lo dejaste (retomo = true)
 */
export function segundosIniciales(
  pos: PosicionEpisodio | undefined,
  durSeg: number
): { seg: number; retomo: boolean } {
  if (!pos || typeof pos !== 'object') return { seg: 0, retomo: false };
  const seg = Math.max(0, Math.floor(Number(pos.seg) || 0));
  const dur = Math.max(Math.floor(durSeg) || 0, Math.floor(Number(pos.durSeg)) || 0);
  if (pos.fin) return { seg: 0, retomo: false };
  if (seg < 30) return { seg: 0, retomo: false };
  if (dur > 0 && seg >= dur * 0.97) return { seg: 0, retomo: false };
  return { seg, retomo: true };
}

/** cuántos episodios del feed son posteriores al último visto */
export function contarNuevos(eps: EpisodioPodcast[], ultimoVistoAt: number): number {
  if (!ultimoVistoAt) return 0;
  return eps.reduce((n, ep) => n + ((ep.fechaPub || 0) > ultimoVistoAt && ep.fechaPub > 0 ? 1 : 0), 0);
}

// ── Formateadores ─────────────────────────────────────────

/** "1 h 02 m" / "45 m" / "—" (desconocida) */
export function formatearDuracion(seg: number): string {
  const s = Math.max(0, Math.floor(seg || 0));
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} m`;
  return `${Math.max(1, m)} m`;
}

/** "1:02:03" / "12:34" (para el reproductor) */
export function formatearTiempoPlayer(seg: number): string {
  const s = Math.max(0, Math.floor(seg || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const sss = String(ss).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${sss}` : `${mm}:${sss}`;
}

/** "hoy" / "ayer" / "12 ago" / "12 ago 2024" */
export function formatearFechaEpisodio(ts: number, ahora = Date.now()): string {
  if (!ts) return '';
  const d = new Date(ts);
  const a = new Date(ahora);
  const inicioHoy = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const DIA = 24 * 60 * 60 * 1000;
  if (ts >= inicioHoy) return 'hoy';
  if (ts >= inicioHoy - DIA) return 'ayer';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const base = `${d.getDate()} ${meses[d.getMonth()] || ''}`.trim();
  return d.getFullYear() === a.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** 44_971_520 → "~45 MB" */
export function formatearMB(bytes: number): string {
  const mb = (bytes || 0) / (1024 * 1024);
  if (mb <= 0) return '—';
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `~${mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

/** ¿el feed cacheado sigue fresco? (TTL 45 min) */
export function feedTTLVigente(at: number, ahora = Date.now()): boolean {
  return at > 0 && ahora - at < TTL_FEED_MS;
}

/** velocidad válida (0.5 – 3) */
export function normalizarVelocidad(v: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(3, Math.max(0.5, Math.round(n * 100) / 100));
}
