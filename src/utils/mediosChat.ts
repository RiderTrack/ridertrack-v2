// ═══════════════════════════════════════════════════════════
// 🎵 mediosChat.ts — MEDIOS POR CHAT PERSONAL (FASE 5.1)
//
// Controla la MÚSICA DE LA APP desde tu WhatsApp personal:
//   • La app escucha `mensajes_personal` (lo que le llega al
//     celular 2). Si un texto empieza con "!" (o "pon …") lo
//     ejecuta con los 4 motores de Medios:
//         📻 radio · 🎵 spotify · 🎙️ podcast · ▶️ youtube
//   • La confirmación se escribe en `respuestas_personal`
//     (outbox) → el bot-personal v1.3 la manda TAL CUAL, sin
//     tocar NADA en Termux.
//   • Config en localStorage: interruptor general + qué medios
//     se permiten + quiénes pueden mandar comandos.
//   • Montado en MediosProvider → escucha en TODA la app.
//
// Comandos (ver AYUDA abajo): !estado · !radio <nombre> ·
// !spotify <playlist> · !podcast <nombre> · !yt <link> ·
// !pausa · !play · !volumen 50 · !mas · !menos · !ayuda …
// ═══════════════════════════════════════════════════════════

import {
  collection, query, orderBy, limit as fsLimit, onSnapshot, addDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { RadioEngine, RADIOS, RadioEstacion, leerUltima } from '../services/mediosRadio';
import {
  subscribeSpotify, spotifyTogglePlay, spotifyNext, spotifyPrev, spotifyVolume,
  spotifyMisPlaylists, spotifyTocarPlaylist, spotifyTocarMeGusta,
  type SpotifyEstado,
} from '../services/spotify';
import {
  getEstadoYouTube, tocarYouTube, ytTogglePlay, ytDetener, ytSetVolumen,
  extraerVideoId, YT_CONTAINER_ID,
} from '../services/mediosYouTube';
import {
  snapshotPodcastsRSS, suscripcionesRSS, feedCacheRSS, obtenerFeedRSS,
  tocarEpisodioRSS, pausarEpisodioRSS, reanudarEpisodioRSS, detenerEpisodioRSS,
  type EpisodioRSS,
} from '../services/podcastRSS';

// ── Config (localStorage) ─────────────────────────────────

export interface CfgMediosChat {
  /** interruptor general */
  activo: boolean;
  /** qué medios aceptan comandos */
  radio: boolean;
  spotify: boolean;
  podcast: boolean;
  youtube: boolean;
  /** mandar la confirmación al chat (outbox) */
  responder: boolean;
  /** si hay números, SOLO ellos pueden mandar comandos */
  permitidos: string[];
}

const CLAVE_CFG = 'rt_medios_chat_v1';

function cfgBase(): CfgMediosChat {
  return { activo: true, radio: true, spotify: true, podcast: true, youtube: true, responder: true, permitidos: [] };
}

let _cfg: CfgMediosChat = cfgBase();
try {
  const crudo = localStorage.getItem(CLAVE_CFG);
  if (crudo) _cfg = { ...cfgBase(), ...JSON.parse(crudo) };
} catch { /* primera vez */ }

const _oyentesCfg = new Set<() => void>();
function emitirCfg() { _oyentesCfg.forEach((c) => { try { c(); } catch {} }); }

export function leerCfgMediosChat(): CfgMediosChat { return { ..._cfg }; }

export function guardarCfgMediosChat(parcial: Partial<CfgMediosChat>): CfgMediosChat {
  _cfg = { ..._cfg, ...parcial };
  try { localStorage.setItem(CLAVE_CFG, JSON.stringify(_cfg)); } catch { /* sin espacio */ }
  emitirCfg();
  return { ..._cfg };
}

export function suscribirCfgMediosChat(cb: () => void): () => void {
  _oyentesCfg.add(cb);
  return () => { _oyentesCfg.delete(cb); };
}

// ── Dedup (ids ya procesados) ─────────────────────────────

const CLAVE_HECHOS = 'rt_medios_chat_hechos';
const MAX_HECHOS = 400;

function leerHechos(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(CLAVE_HECHOS) || '[]')); } catch { return new Set(); }
}
function marcarHecho(id: string) {
  try {
    const lista = Array.from(leerHechos());
    lista.push(id);
    localStorage.setItem(CLAVE_HECHOS, JSON.stringify(lista.slice(-MAX_HECHOS)));
  } catch { /* sin espacio */ }
}

// ── Normalizador de texto ─────────────────────────────────

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿Este texto es un comando de medios? (para no gastar nada si no) */
export function esComandoMedios(texto: string): boolean {
  const t = norm(texto);
  if (!t) return false;
  if (t.startsWith('!')) return true;
  if (/^(pon|pone|pones|poner|ponga|poneme)\b/.test(t)) return true;
  if (/^(para|parar|deten[e]|detente)\s+(la\s+)?(musica|radio|podcast|video)/.test(t)) return true;
  if (/^(sube|baja)\s+el\s+volumen/.test(t)) return true;
  return false;
}

/** Quita el prefijo ("!" o "pon …") y devuelve el comando pelado. */
function desvestir(texto: string): string {
  let t = norm(texto);
  if (t.startsWith('!')) return t.slice(1).trim();
  t = t.replace(/^pon(er|ga|e)?\s+/, '').replace(/^pon\s+/, '').trim();
  // "pon la radio" / "pon el podcast" → "pon radio" / "pon podcast"
  t = t.replace(/^(la|el|los|las|un|una|mi|mis)\s+/, '');
  if (/^(para|parar|deten[e]|detente)\s+(la\s+)?(musica|radio|podcast|video)/.test(norm(texto))) return 'parar';
  if (/^(sube|baja)\s+el\s+volumen/.test(norm(texto))) return t.includes('sube') ? 'mas' : 'menos';
  return t;
}

// ── Ayuda ─────────────────────────────────────────────────

export function ayudaMediosChat(): string {
  return [
    '🎵 *Medios por chat* — comandos:',
    '• !estado → qué está sonando',
    '• !radios → lista de emisoras',
    '• !radio [nombre] → suena la radio',
    '• !spotify [playlist] → tu música',
    '• !playlists → tus listas',
    '• !megusta → tus me gusta',
    '• !siguiente / !anterior',
    '• !podcasts → tus podcasts',
    '• !podcast [nombre] → último episodio',
    '• !yt <link> → toca ese video',
    '• !pausa / !play / !parar',
    '• !volumen 50 · !mas · !menos',
    '',
    'También podés escribir natural: "pon la radio", "pon musica", "pon podcast <nombre>"…',
  ].join('\n');
}

// ── Motor de ejecución ────────────────────────────────────

interface DepsMediosChat {
  engine: RadioEngine;
  onShowToast?: (titulo: string, desc?: string, tipo?: 'success' | 'info' | 'warning' | 'error') => void;
}

let _deps: DepsMediosChat | null = null;
let _spotify: SpotifyEstado | null = null;
let _offSpotify: (() => void) | null = null;
let _activo = false;

function seg2mmss(seg: number): string {
  if (!Number.isFinite(seg) || seg <= 0) return '';
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function ms2mmss(ms: number): string {
  return seg2mmss(Math.floor(ms / 1000));
}

function nombreEstacion(e: RadioEstacion): string {
  return `📻 ${e.emoji} ${e.name} · ${e.freq} · ${e.genre}`;
}

/** estado textual de todo lo que puede estar sonando */
export function estadoMediosTexto(): string {
  const radio = _deps?.engine?.estacionActual;
  const yt = getEstadoYouTube();
  const pod = snapshotPodcastsRSS();
  const sp = _spotify;

  const partes: string[] = [];
  if (radio && _deps?.engine?.reproduciendo) partes.push(nombreEstacion(radio));
  if (sp?.track?.reproduciendo) partes.push(`🎵 Spotify: ${sp.track.nombre} — ${sp.track.artista}`);
  if (yt?.reproduciendo && yt.titulo) partes.push(`▶️ YouTube: ${yt.titulo}`);
  if (pod.fase === 'reproduciendo' && pod.episodio) {
    partes.push(`🎙️ Podcast: ${pod.episodio.podcastTitulo} — ${pod.episodio.titulo}`);
  }

  if (partes.length > 0) return `*Ahora suena:*\n${partes.join('\n')}`;

  const cargado: string[] = [];
  if (radio) cargado.push(nombreEstacion(radio) + ' (pausada)');
  if (sp?.track) cargado.push(`🎵 Spotify: ${sp.track.nombre} — ${sp.track.artista} (pausada)`);
  if (yt?.videoId) cargado.push(`▶️ YouTube: ${yt.titulo || 'video'} (pausado)`);
  if (pod.episodio && (pod.fase === 'pausado' || pod.fase === 'cargando')) {
    cargado.push(`🎙️ Podcast: ${pod.episodio.titulo} (${pod.fase === 'pausado' ? 'pausado' : 'cargando'})`);
  }
  if (cargado.length > 0) return `*Cargado (en pausa):*\n${cargado.join('\n')}\n\nMandá !play para seguir. 💪`;

  return '😴 Nada está sonando.\nProbá: !radio · !spotify · !podcast · !yt <link> · !ayuda';
}

/** pausa lo que suena (fuente activa primero) */
function cmdPausar(): string {
  const radio = _deps?.engine;
  const sp = _spotify;
  const yt = getEstadoYouTube();
  const pod = snapshotPodcastsRSS();
  let cual = '';
  if (radio?.reproduciendo) { radio.pausar(); cual = 'radio'; }
  else if (sp?.track?.reproduciendo) { void spotifyTogglePlay(); cual = 'Spotify'; }
  else if (yt?.reproduciendo) { ytTogglePlay(); cual = 'YouTube'; }
  else if (pod.fase === 'reproduciendo') { pausarEpisodioRSS(); cual = 'podcast'; }
  return cual ? `⏸️ Pausado (${cual}).` : '⚠️ Nada estaba sonando — mandá !radio o !spotify primero.';
}

function cmdSeguir(): string {
  const radio = _deps?.engine;
  const sp = _spotify;
  const yt = getEstadoYouTube();
  const pod = snapshotPodcastsRSS();
  let cual = '';
  if (radio?.estacionActual && !radio.reproduciendo) { radio.reanudar(); cual = 'radio'; }
  else if (sp?.track && !sp.track.reproduciendo) { void spotifyTogglePlay(); cual = 'Spotify'; }
  else if (yt?.videoId && !yt.reproduciendo) { ytTogglePlay(); cual = 'YouTube'; }
  else if (pod.fase === 'pausado') { reanudarEpisodioRSS(); cual = 'podcast'; }
  return cual ? `▶️ Seguimos (${cual}). 🎶` : '⚠️ No hay nada cargado para seguir — mandá !radio, !spotify o !podcast.';
}

function cmdParar(): string {
  const radio = _deps?.engine;
  const sp = _spotify;
  const yt = getEstadoYouTube();
  const pod = snapshotPodcastsRSS();
  try { if (radio?.estacionActual) radio.detener(); } catch { /* sin radio */ }
  try { if (sp?.track?.reproduciendo) void spotifyTogglePlay(); } catch { /* sin token */ }
  try { if (yt?.videoId) ytDetener(); } catch { /* sin player */ }
  try { if (pod.episodio) detenerEpisodioRSS(); } catch { /* sin episodio */ }
  return '⏹️ Todo detenido. Hasta la próxima vuelta. 🤝';
}

function cmdVolumen(arg: string): string {
  let pct: number;
  if (arg === 'mas' || arg === 'menos') {
    const actual = Math.round(((_deps?.engine?.volumen ?? 0.8)) * 100);
    pct = Math.max(0, Math.min(100, actual + (arg === 'mas' ? 10 : -10)));
  } else {
    const n = parseInt(arg.replace(/\D/g, ''), 10);
    if (!Number.isFinite(n)) return '⚠️ Decime un número del 0 al 100 — así: !volumen 50';
    pct = Math.max(0, Math.min(100, n));
  }
  try { _deps?.engine?.setVolumen(pct / 100); } catch { /* sin radio */ }
  try { ytSetVolumen(pct); } catch { /* sin player */ }
  if (_spotify?.track?.reproduciendo) { try { void spotifyVolume(pct); } catch { /* sin token */ } }
  return `🔊 Volumen al ${pct}%.`;
}

// ── Radio ─────────────────────────────────────────────────

function cmdRadios(): string {
  const lista = RADIOS.map((r) => `${r.emoji} ${r.name} · ${r.freq} · ${r.genre}`);
  return `📻 *Mis ${RADIOS.length} emisoras:*\n${lista.join('\n')}\n\nMandá !radio <nombre> para sintonizar.`;
}

function buscarEstacion(q: string): RadioEstacion | null {
  const nq = norm(q).replace(/^!/, '');
  if (!nq) return null;
  let mejor: { est: RadioEstacion; puntos: number } | null = null;
  for (const r of RADIOS) {
    const nombre = norm(r.name);
    const genero = norm(r.genre);
    let puntos = 0;
    if (nombre === nq) puntos = 100;
    else if (nombre.startsWith(nq)) puntos = 70;
    else if (nombre.includes(nq)) puntos = 50;
    else if (genero.includes(nq)) puntos = 30;
    else if (norm(r.freq).replace(/\s/g, '').includes(nq.replace(/\s/g, ''))) puntos = 25;
    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { est: r, puntos };
  }
  return mejor?.est || null;
}

function tocarRadio(est: RadioEstacion): string {
  try { _deps?.engine?.play(est); } catch { /* ya sonaba */ }
  return `${nombreEstacion(est)}\n\n🎶 ¡Listo!`;
}

function cmdRadio(arg: string): string {
  if (!arg) {
    const ultima = leerUltima();
    const est = RADIOS.find((r) => r.id === ultima) || RADIOS[0];
    return tocarRadio(est);
  }
  const est = buscarEstacion(arg);
  if (!est) {
    return `⚠️ No encontré "${arg}".\nMandá !radios para ver la lista completa.`;
  }
  return tocarRadio(est);
}

// ── Spotify ───────────────────────────────────────────────

function avisoSpotify(): string | null {
  const sp = _spotify;
  if (!sp?.conectado) return '⚠️ Spotify no está conectado en la app.\nConectalo una sola vez: *Medios → Spotify → Conectar* (pedís Premium).';
  if (!sp?.listo) return '⏳ El reproductor de Spotify todavía está conectando… esperá unos segundos y reintentá.';
  return null;
}

async function cmdSpotify(arg: string): Promise<string> {
  const aviso = avisoSpotify();
  if (aviso) return aviso;

  if (!arg) {
    const sp = _spotify;
    if (sp?.track) {
      void spotifyTogglePlay();
      return sp.track.reproduciendo
        ? `⏸️ Pausado: *${sp.track.nombre}* — ${sp.track.artista}`
        : `▶️ Seguimos con *${sp.track.nombre}* — ${sp.track.artista} 🎵`;
    }
    const ok = await spotifyTocarMeGusta().catch(() => false);
    return ok ? '❤️ Tus *Me gusta* en Spotify, sonando. 🎵' : '⏳ El dispositivo no respondió — reintentá en unos segundos.';
  }

  let listas: { nombre: string; uri: string }[] = [];
  try { listas = (await spotifyMisPlaylists()).map((p) => ({ nombre: p.nombre, uri: p.uri })); } catch { /* sin listas */ }
  if (!listas.length) return '⚠️ No pude leer tus playlists (¿hay red?). Mandá !spotify sin nada para tocar tus me gusta.';

  const nq = norm(arg);
  let elegida: { nombre: string; uri: string } | undefined = listas.find((l) => norm(l.nombre) === nq);
  if (!elegida) elegida = listas.find((l) => norm(l.nombre).startsWith(nq));
  if (!elegida) elegida = listas.find((l) => norm(l.nombre).includes(nq));
  if (!elegida) {
    const muestra = listas.slice(0, 8).map((l) => `• ${l.nombre}`).join('\n');
    return `⚠️ No encontré la playlist "${arg}".\nTus listas:\n${muestra}`;
  }
  const ok = await spotifyTocarPlaylist(elegida.uri).catch(() => false);
  return ok ? `▶️ Playlist *${elegida.nombre}*, sonando. 🎧` : '⏳ El dispositivo no respondió — reintentá en unos segundos.';
}

async function cmdPlaylists(): Promise<string> {
  const aviso = avisoSpotify();
  if (aviso) return aviso;
  let listas: string[] = [];
  try { listas = (await spotifyMisPlaylists()).map((p) => p.nombre); } catch { /* sin listas */ }
  if (!listas.length) return '⚠️ No encontré playlists en tu cuenta.';
  return `🎵 *Tus playlists (${listas.length}):*\n${listas.slice(0, 12).map((n) => `• ${n}`).join('\n')}\n\nMandá !spotify <nombre>.`;
}

async function cmdSpotifyControl(que: 'next' | 'prev' | 'megusta'): Promise<string> {
  const aviso = avisoSpotify();
  if (aviso) return aviso;
  const sp = _spotify;
  if (que === 'megusta') {
    const ok = await spotifyTocarMeGusta().catch(() => false);
    return ok ? '❤️ Tus *Me gusta* en Spotify, sonando. 🎵' : '⏳ El dispositivo no respondió — reintentá en unos segundos.';
  }
  if (!sp?.track) return '⚠️ No hay nada sonando en Spotify — mandá !spotify primero.';
  try {
    if (que === 'next') void spotifyNext();
    else void spotifyPrev();
  } catch { /* sin red */ }
  return que === 'next' ? '⏭️ Siguiente canción… 🎵' : '⏮️ Anterior canción… 🎵';
}

// ── Podcast ───────────────────────────────────────────────

function cmdPodcasts(): string {
  const subs = suscripcionesRSS();
  if (!subs.length) {
    return '🎙️ Todavía no seguís ningún podcast.\nAgregálos en la app: *Medios → Podcasts* ( buscá o pegá el RSS) y los controlás por acá.';
  }
  return `🎙️ *Tus podcasts (${subs.length}):*\n${subs.slice(0, 10).map((s) => `• ${s.titulo}`).join('\n')}\n\nMandá !podcast <nombre> para oír el último episodio.`;
}

async function cmdPodcast(arg: string): Promise<string> {
  const subs = suscripcionesRSS();
  if (!subs.length) return cmdPodcasts();

  // sin argumento: sigue/retoma lo que había
  if (!arg) {
    const pod = snapshotPodcastsRSS();
    if (pod.episodio) {
      if (pod.fase === 'reproduciendo') { pausarEpisodioRSS(); return `⏸️ Pausado: *${pod.episodio.titulo}*`; }
      reanudarEpisodioRSS();
      const donde = seg2mmss(pod.seg);
      return `▶️ Seguimos con *${pod.episodio.titulo}*${donde ? ` (en ${donde})` : ''} 🎧`;
    }
    // nada cargado → el episodio más nuevo de la última suscripción
    return tocarFeed(subs[0]);
  }

  const nq = norm(arg);
  let sub = subs.find((s) => norm(s.titulo) === nq);
  if (!sub) sub = subs.find((s) => norm(s.titulo).startsWith(nq));
  if (!sub) sub = subs.find((s) => norm(s.titulo).includes(nq) || norm(s.autor || '').includes(nq));
  if (!sub) return `⚠️ No encontré el podcast "${arg}".\nMandá !podcasts para ver los que seguís.`;
  return tocarFeed(sub);
}

async function tocarFeed(sub: { feedUrl: string; titulo: string }): Promise<string> {
  let feed = feedCacheRSS(sub.feedUrl);
  if (!feed) {
    try { feed = await obtenerFeedRSS(sub.feedUrl); } catch {
      return `⚠️ No pude bajar el feed de *${sub.titulo}* (¿hay red en la app?). Reintentá en un rato.`;
    }
  }
  const eps = feed?.episodios || [];
  if (!eps.length) return `⚠️ *${sub.titulo}* no tiene episodios disponibles.`;
  const ep = eps[0];
  const episodio: EpisodioRSS = { ...ep, feedUrl: sub.feedUrl, podcastTitulo: sub.titulo, imagen: feed?.imagen || '' };
  try { await tocarEpisodioRSS(episodio); } catch {
    return `⚠️ No pude reproducir *${ep.titulo}* — probá de nuevo o elegí otro con !podcasts.`;
  }
  const dur = seg2mmss(ep.duracionSeg);
  return `🎙️ *${sub.titulo}*\n▶️ ${ep.titulo}${dur ? ` (${dur})` : ''}\n\nSe abre donde lo dejaste si ya lo venías oyendo. 🎧`;
}

// ── YouTube ───────────────────────────────────────────────

/** Argumento de YouTube CON mayúsculas (los ids de video son
 *  case-sensitive y el normalizador los mataría). */
function argYoutubeCrudo(texto: string): string {
  const s = String(texto || '');
  const mUrl = s.match(/https?:\/\/[^\s]+/i);
  if (mUrl) return mUrl[0];
  // id pelado después del comando (!yt XXXXXXXXXXX o "pon youtube XXXXXXXXXXX")
  const mTok = s.match(/(?:^|\s)(?:!)?(?:yt|youtube|video)\s+([A-Za-z0-9_-]{11})(?:\s|$)/i);
  if (mTok) return mTok[1];
  return '';
}

function cmdYouTube(arg: string): string {
  const yt = getEstadoYouTube();
  if (!arg) {
    if (yt?.videoId) {
      const estado = yt.reproduciendo ? 'sonando' : 'en pausa';
      return `▶️ YouTube (${estado}): ${yt.titulo || 'video'}\nMandá !yt <link> para cambiar de video.`;
    }
    return '▶️ Mandame un link de YouTube y lo toco en la app:\n!yt https://youtu.be/xxxxxxx';
  }
  const id = extraerVideoId(arg);
  if (!id) return '⚠️ Ese link no lo reconocí como video de YouTube.\nUsá el link completo (youtube.com/watch?v=… o youtu.be/…).';
  tocarYouTube(id, YT_CONTAINER_ID);
  return '▶️ Abriendo el video en la app… 🎬\n( el audio suena en el teléfono con la app RiderTrack )';
}

// ── Despachador ───────────────────────────────────────────

/** Ejecuta un comando (texto crudo) y devuelve la respuesta. */
export async function ejecutarComandoMedios(texto: string): Promise<string> {
  const t = desvestir(texto);
  if (!t) return '';
  const [primera, ...resto] = t.split(' ');
  const cmd = norm(primera);
  const arg = resto.join(' ').trim();

  switch (cmd) {
    case 'ayuda': case 'comandos': case 'medios': case '?':
      return ayudaMediosChat();

    case 'estado': case 'suena':
      return estadoMediosTexto();

    case 'que':
      return arg.startsWith('suen') ? estadoMediosTexto() : '';

    case 'pausa': case 'pausar': case 'mute':
      return cmdPausar();

    case 'play': case 'seguir': case 'reanudar': case 'continuar':
      return cmdSeguir();

    case 'parar': case 'stop': case 'detener': case 'chau':
      return cmdParar();

    case 'volumen': case 'vol':
      return cmdVolumen(arg || '50');

    case 'mas': case 'sube':
      return cmdVolumen('mas');

    case 'menos': case 'baja':
      return cmdVolumen('menos');

    case 'radios': case 'emisoras': case 'estaciones':
      if (!_cfg.radio) return avisoApagado('radio');
      return cmdRadios();

    case 'radio': case 'emisora': case 'fm': {
      if (!_cfg.radio) return avisoApagado('radio');
      return cmdRadio(arg);
    }

    case 'spotify': case 'musica': {
      if (!_cfg.spotify) return avisoApagado('Spotify');
      return cmdSpotify(arg);
    }

    case 'playlists': case 'listas': case 'playlist':
      if (!_cfg.spotify) return avisoApagado('Spotify');
      return cmdPlaylists();

    case 'megusta':
      if (!_cfg.spotify) return avisoApagado('Spotify');
      return cmdSpotifyControl('megusta');

    case 'siguiente': case 'next':
      if (!_cfg.spotify) return avisoApagado('Spotify');
      return cmdSpotifyControl('next');

    case 'anterior': case 'prev': case 'back':
      if (!_cfg.spotify) return avisoApagado('Spotify');
      return cmdSpotifyControl('prev');

    case 'podcasts': case 'feeds': case 'feeds-podcast':
      if (!_cfg.podcast) return avisoApagado('podcast');
      return cmdPodcasts();

    case 'podcast': case 'episodio': {
      if (!_cfg.podcast) return avisoApagado('podcast');
      return cmdPodcast(arg);
    }

    case 'yt': case 'youtube': case 'video':
      if (!_cfg.youtube) return avisoApagado('YouTube');
      // el link se saca del texto ORIGINAL (mayúsculas intactas)
      return cmdYouTube(argYoutubeCrudo(texto) || arg);

    default:
      // "pon <algo>" natural sin verbo reconocido → no responder
      return '';
  }
}

function avisoApagado(nombre: string): string {
  return `⚠️ El control de ${nombre} está apagado en *Medios por chat* (configuración de la app).`;
}

// ── Respuesta por WhatsApp (outbox del bot personal) ──────

interface DatosComando {
  telefono: string;
  jidOriginal?: string;
  nombre?: string;
  idMensaje: string;
}

async function responderPorChat(destino: DatosComando, texto: string): Promise<void> {
  if (!_cfg.responder || !texto) return;
  try {
    await addDoc(collection(db!, 'respuestas_personal'), {
      telefono: destino.telefono,
      jidOriginal: destino.jidOriginal || '',
      nombre: destino.nombre || '',
      texto,
      tipo: 'texto',
      processed: false,
      createdAt: new Date().toISOString(),
      creadoPor: 'medios-chat',
    });
  } catch (e) {
    console.warn('[mediosChat] no pude encolar la respuesta:', e);
  }
}

// ── Arranque global (lo monta MediosProvider) ─────────────

const VENTANA_MS = 4 * 60 * 1000; // solo comandos recientes

export function arrancarMediosChat(deps: DepsMediosChat): () => void {
  _deps = deps;
  if (_activo) return () => { /* ya andaba: nada que apagar acá */ };
  _activo = true;

  // estado de Spotify siempre fresco (para !estado / !spotify)
  _offSpotify = subscribeSpotify((e) => { _spotify = e; });

  const ignorar = (e: unknown) => console.warn('[mediosChat] listener:', e);
  let cola: Promise<void> = Promise.resolve();

  const cancelar = onSnapshot(
    query(collection(db!, 'mensajes_personal'), orderBy('timestamp', 'desc'), fsLimit(12)),
    (snap) => {
      if (!_cfg.activo) return;
      const hechos = leerHechos();
      const ahora = Date.now();
      // del más viejo al más nuevo
      const nuevos = snap.docs
        .map((d) => ({ d, datos: d.data() as Record<string, unknown> }))
        .filter(({ d, datos }) => {
          const texto = String(datos.texto || '');
          const origen = String(datos.origen || '');
          const tipo = String(datos.tipoContenido || 'texto');
          const ts = Number(datos.timestamp || 0);
          return (
            !hechos.has(d.id) &&
            tipo === 'texto' &&
            origen === 'personal' &&
            ts > 0 &&
            ahora - ts <= VENTANA_MS &&
            esComandoMedios(texto)
          );
        })
        .reverse();

      for (const { d, datos } of nuevos) {
        marcarHecho(d.id);
        const telefono = String(datos.telefono || '');
        if (!telefono) continue;
        // restricción por números permitidos
        if (_cfg.permitidos.length > 0) {
          const tel = telefono.replace(/\D/g, '');
          const ok = _cfg.permitidos.some((p) => {
            const pn = norm(p).replace(/\D/g, '');
            return pn && (tel.endsWith(pn) || telefono.includes(pn) || norm(telefono).includes(norm(p)));
          });
          if (!ok) continue;
        }
        const destino: DatosComando = {
          telefono,
          jidOriginal: (datos.jidOriginal as string) || undefined,
          nombre: (datos.nombre as string) || undefined,
          idMensaje: d.id,
        };
        const texto = String(datos.texto || '');
        cola = cola.then(async () => {
          try {
            const respuesta = await ejecutarComandoMedios(texto);
            if (!respuesta) return;
            const corto = respuesta.split('\n')[0].slice(0, 60);
            _deps?.onShowToast?.('🎵 Medios por chat', corto, 'success');
            await responderPorChat(destino, respuesta);
          } catch (e) {
            console.warn('[mediosChat] comando falló:', e);
          }
        });
      }
    },
    ignorar
  );

  return () => {
    _activo = false;
    try { cancelar(); } catch { /* ya cerrado */ }
    try { _offSpotify?.(); } catch { /* ya cerrado */ }
    _offSpotify = null;
  };
}

/** Prueba local de un comando (panel de configuración) — sin WhatsApp. */
export async function probarComandoMedios(texto: string): Promise<string> {
  const respuesta = await ejecutarComandoMedios(texto);
  return respuesta || '⚠️ Ese texto no parece un comando de medios — probá con !ayuda.';
}
