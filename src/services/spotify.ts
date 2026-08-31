// ═══════════════════════════════════════════════════════════
// 🎵 MEDIOS — SPOTIFY (Fase 3.11 · fix redirect Fase 3.23)
// Port fiel de la v1 (main.js L4199-4700) a TypeScript:
//   • OAuth Authorization Code + PKCE (mismo client_id de la v1)
//   • F3.23 FIX: en la APK la v2 ya NO usa ridertrack://callback —
//     ese deep link lo resuelve Android abriendo la V1 (que es su
//     dueña) y la v2 se quedaba esperando el código para siempre.
//     Ahora, en nativo, el redirect es el scheme PROPIO de la v2:
//     com.ridertrack.v2://callback (el que la APK ya escucha vía
//     appUrlOpen). Solo falta añadirlo 1 vez en el dashboard de
//     Spotify (Redirect URIs) — ver LEEME-FASE-3-23.md.
//   • Web Playback SDK: la app se vuelve un dispositivo Spotify
//     Connect ("RiderTrack 🛵") y reproduce DIRECTO (Premium)
//   • El login abre Spotify en el navegador del sistema; al
//     aceptar, Android re-abre la app (deep link) y el código
//     llega por el evento appUrlOpen de @capacitor/app
//   • Refresh token automático (el token dura ~1 hora)
//   • NUEVO vs v1: lista de playlists + "Tus me gusta" para
//     empezar a sonar desde la propia app
// ═══════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';

export const SPOTIFY_CLIENT_ID = '9542b79ff46f44aa9ce31a7450497af6';

// En la APK (nativo) → scheme propio de la v2, que Android ya resuelve
// a ESTA app. En web (dev/navegador) se mantiene el de la v1 por
// compatibilidad con lo que ya pudiera estar registrado.
export const SPOTIFY_REDIRECT: string = Capacitor.isNativePlatform()
  ? 'com.ridertrack.v2://callback'
  : 'ridertrack://callback';
export const SPOTIFY_SCOPES =
  'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state user-library-read user-library-modify';

const KEY_TOKEN = 'SPOTIFY_TOKEN';
const KEY_TOKEN_TIME = 'SPOTIFY_TOKEN_TIME';
const KEY_REFRESH = 'SPOTIFY_REFRESH';
const KEY_VERIFIER = 'SPOTIFY_VERIFIER';

// ── Estado interno ──
let _accessToken: string | null = null;
let _deviceId: string | null = null;
let _sdkCargado = false;
let _cargandoSdk = false;

export interface SpotifyTrackInfo {
  id: string | null;
  nombre: string;
  artista: string;
  album: string;
  imagen: string | null;
  duracionMs: number;
  posicionMs: number;
  reproduciendo: boolean;
}

export interface SpotifyEstado {
  conectado: boolean;         // hay token
  listo: boolean;             // el dispositivo SDK está ready
  estado: 'desconectado' | 'conectando' | 'listo' | 'error' | 'requiere-premium';
  mensaje: string;
  track: SpotifyTrackInfo | null;
  shuffle: boolean;
  repeat: 0 | 1 | 2;          // off / context / track
  liked: boolean;
}

type Listener = (e: SpotifyEstado) => void;
const _listeners = new Set<Listener>();

function _estadoBase(): SpotifyEstado {
  return {
    conectado: false, listo: false, estado: 'desconectado',
    mensaje: '', track: null, shuffle: false, repeat: 0, liked: false,
  };
}
let _estado: SpotifyEstado = _estadoBase();

export function subscribeSpotify(cb: Listener): () => void {
  _listeners.add(cb);
  cb(_estado); // emite el estado actual al suscribirse
  return () => { _listeners.delete(cb); };
}
function emitir(patch: Partial<SpotifyEstado> = {}) {
  _estado = { ..._estado, ...patch };
  _listeners.forEach((l) => l(_estado));
}

export function getAccessToken(): string | null { return _accessToken; }
export function getDeviceId(): string | null { return _deviceId; }

// ── PKCE (idéntico a la v1) ──
function generateCodeVerifier(): string {
  const array = new Uint8Array(56);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function generateCodeChallenge(verifier: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Login: abre Spotify en el navegador del sistema ──
export async function spotifyLogin(): Promise<void> {
  const verifier = generateCodeVerifier();
  localStorage.setItem(KEY_VERIFIER, verifier);
  const challenge = await generateCodeChallenge(verifier);
  const url =
    'https://accounts.spotify.com/authorize' +
    '?client_id=' + SPOTIFY_CLIENT_ID +
    '&response_type=code' +
    '&redirect_uri=' + encodeURIComponent(SPOTIFY_REDIRECT) +
    '&scope=' + encodeURIComponent(SPOTIFY_SCOPES) +
    '&code_challenge_method=S256' +
    '&code_challenge=' + challenge;
  // El WebView de Capacitor abre las URLs externas en el navegador
  // del sistema (comportamiento por defecto) → la app sigue viva
  // y recibe el código por appUrlOpen al volver.
  window.location.href = url;
}

// ── Intercambio code → token ──
async function tokenRequest(body: Record<string, string>): Promise<any> {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const data = await r.json();
  if (!data || !data.access_token) throw new Error(data?.error_description || 'respuesta sin token');
  return data;
}

export async function spotifyExchangeCode(code: string): Promise<boolean> {
  const verifier = localStorage.getItem(KEY_VERIFIER);
  if (!verifier) return false;
  try {
    const data = await tokenRequest({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT,
      code_verifier: verifier,
    });
    _guardarToken(data);
    localStorage.removeItem(KEY_VERIFIER);
    await iniciarSpotify(data.access_token);
    return true;
  } catch (e: any) {
    console.warn('Spotify exchange error:', e?.message || e);
    return false;
  }
}

export async function spotifyRefreshToken(): Promise<boolean> {
  const refresh = localStorage.getItem(KEY_REFRESH);
  if (!refresh) return false;
  try {
    const data = await tokenRequest({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    });
    _guardarToken(data);
    return true;
  } catch (e) {
    console.warn('Spotify refresh falló — se requiere login de nuevo');
    return false;
  }
}

function _guardarToken(data: any): void {
  _accessToken = data.access_token;
  localStorage.setItem(KEY_TOKEN, data.access_token);
  localStorage.setItem(KEY_TOKEN_TIME, Date.now().toString());
  if (data.refresh_token) localStorage.setItem(KEY_REFRESH, data.refresh_token);
}

/** ¿El token guardado sigue fresco? (dura ~1h, margen de 2 min) */
export function tokenGuardadoFresco(): string | null {
  const t = localStorage.getItem(KEY_TOKEN);
  const ts = parseInt(localStorage.getItem(KEY_TOKEN_TIME) || '0', 10);
  if (t && Date.now() - ts < 58 * 60 * 1000) return t;
  return null;
}
export function hayRefreshToken(): boolean {
  return !!localStorage.getItem(KEY_REFRESH);
}

// ── Web Playback SDK ──
declare global {
  interface Window { Spotify?: any; onSpotifyWebPlaybackSDKReady?: () => void; }
}

function cargarSdk(): Promise<void> {
  if (_sdkCargado || _cargandoSdk) return Promise.resolve();
  _cargandoSdk = true;
  return new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => { _sdkCargado = true; resolve(); };
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.onerror = () => { _cargandoSdk = false; resolve(); };
    document.head.appendChild(s);
  });
}

let _player: any = null;
export function getPlayer(): any { return _player; }

/** Arranca el SDK + player con el token dado (idéntico a la v1) */
export async function iniciarSpotify(token: string): Promise<void> {
  _accessToken = token;
  emitir({ conectado: true, estado: 'conectando', mensaje: '🟡 Conectando...' });

  await cargarSdk();
  if (!window.Spotify) {
    emitir({ estado: 'error', mensaje: '⚠️ No se pudo cargar el SDK de Spotify (revisa tu conexión)' });
    return;
  }
  crearPlayer(token);
}

function crearPlayer(token: string): void {
  if (_player) { try { _player.disconnect(); } catch {} _player = null; }
  _player = new window.Spotify.Player({
    name: 'RiderTrack 🛵',
    getOAuthToken: (cb: (t: string) => void) => { cb(_accessToken || token); },
    volume: 0.8,
  });

  _player.addListener('ready', (e: any) => {
    _deviceId = e.device_id;
    emitir({ estado: 'listo', listo: true, mensaje: '🟢 Listo · RiderTrack 🛵' });
    transferirPlayback(e.device_id);
  });
  _player.addListener('not_ready', () => {
    emitir({ listo: false, mensaje: '🔴 Desconectado' });
  });
  _player.addListener('player_state_changed', (state: any) => {
    if (!state) return;
    const t = state.track_window?.current_track;
    if (t) {
      emitir({
        track: {
          id: t.id || null,
          nombre: t.name || '',
          artista: (t.artists || []).map((a: any) => a.name).join(', '),
          album: t.album?.name || '',
          imagen: t.album?.images?.[0]?.url || null,
          duracionMs: state.duration || 0,
          posicionMs: state.position || 0,
          reproduciendo: !state.paused,
        },
        liked: false,
      });
      if (t.id) chequearLike(t.id);
    }
  });
  _player.addListener('initialization_error', (e: any) => console.warn('SP init error:', e));
  _player.addListener('authentication_error', async (e: any) => {
    console.warn('SP auth error:', e);
    const ok = await spotifyRefreshToken();
    if (!ok) emitir({ estado: 'error', mensaje: 'Sesión vencida — vuelve a conectar Spotify' });
  });
  _player.addListener('account_error', () => {
    emitir({ estado: 'requiere-premium', mensaje: '⚠️ Spotify Premium requerido para reproducir en la app' });
  });
  _player.connect();
}

/** Mueve la reproducción de Spotify a este dispositivo (sin arrancarla) */
export async function transferirPlayback(deviceId: string): Promise<void> {
  if (!_accessToken || !deviceId) return;
  try {
    await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + _accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    });
  } catch {}
}

/** Asegura token vivo antes de llamar a la API */
async function _token(): Promise<string | null> {
  if (_accessToken) return _accessToken;
  const fresco = tokenGuardadoFresco();
  if (fresco) { _accessToken = fresco; return fresco; }
  if (await spotifyRefreshToken()) return _accessToken;
  return null;
}

async function _api(path: string, opts: RequestInit = {}): Promise<any> {
  const token = await _token();
  if (!token) throw new Error('sin token');
  const r = await fetch('https://api.spotify.com/v1' + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (r.status === 204) return null;
  return r.json();
}

// ── Controles (misma lógica robusta de la v1) ──
export async function spotifyTogglePlay(): Promise<void> {
  const p = _player;
  if (p) {
    try {
      const state = await p.getCurrentState();
      if (!state && _accessToken && _deviceId) {
        // el player se desconectó (llamada/WhatsApp lo pausó) → forzar por API
        try {
          await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${_deviceId}`, {
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + _accessToken },
          });
        } catch { p.togglePlay(); }
        return;
      }
      await p.togglePlay();
    } catch { try { p.togglePlay(); } catch {} }
    return;
  }
  try {
    const d = await _api('/me/player');
    if (!d || !d.is_playing) await _api('/me/player/play', { method: 'PUT' });
    else await _api('/me/player/pause', { method: 'PUT' });
  } catch {}
}

export async function spotifyNext(): Promise<void> {
  if (_player) { try { _player.nextTrack(); return; } catch {} }
  try { await _api('/me/player/next', { method: 'POST' }); } catch {}
}
export async function spotifyPrev(): Promise<void> {
  if (_player) { try { _player.previousTrack(); return; } catch {} }
  try { await _api('/me/player/previous', { method: 'POST' }); } catch {}
}
export async function spotifyVolume(pct: number): Promise<void> {
  if (_player) { try { _player.setVolume(Math.max(0, Math.min(1, pct / 100))); return; } catch {} }
  try { await _api(`/me/player/volume?volume_percent=${Math.round(pct)}`, { method: 'PUT' }); } catch {}
}
export async function spotifySeek(ms: number): Promise<void> {
  if (_player) { try { await _player.seek(Math.round(ms)); return; } catch {} }
  try { await _api(`/me/player/seek?position_ms=${Math.round(ms)}`, { method: 'PUT' }); } catch {}
}
export async function spotifyShuffle(on: boolean): Promise<boolean> {
  try { await _api(`/me/player/shuffle?state=${on}`, { method: 'PUT' }); return on; } catch { return !on; }
}
export async function spotifyRepeat(mode: 0 | 1 | 2): Promise<0 | 1 | 2> {
  const estados = ['off', 'context', 'track'];
  try { await _api(`/me/player/repeat?state=${estados[mode]}`, { method: 'PUT' }); return mode; } catch { return 0; }
}

async function chequearLike(trackId: string): Promise<void> {
  try {
    const d = await _api(`/me/tracks/contains?ids=${trackId}`);
    emitir({ liked: Array.isArray(d) ? !!d[0] : false });
  } catch {}
}
export async function spotifyToggleLike(): Promise<boolean> {
  const trackId = _estado.track?.id;
  if (!trackId) return false;
  try {
    if (_estado.liked) {
      await _api(`/me/tracks?ids=${trackId}`, { method: 'DELETE' });
      emitir({ liked: false });
      return false;
    }
    await _api(`/me/tracks?ids=${trackId}`, { method: 'PUT' });
    emitir({ liked: true });
    return true;
  } catch { return _estado.liked; }
}

// ── Playlists (NUEVO vs v1 — para arrancar la música desde la app) ──
export interface SpotifyPlaylist {
  id: string;
  nombre: string;
  imagen: string | null;
  total: number;
  uri: string;
}

export async function spotifyMisPlaylists(): Promise<SpotifyPlaylist[]> {
  const d = await _api('/me/playlists?limit=30');
  return (d?.items || [])
    .filter((p: any) => p && p.uri)
    .map((p: any) => ({
      id: p.id,
      nombre: p.name || 'Sin nombre',
      imagen: p.images?.[0]?.url || null,
      total: p.tracks?.total || 0,
      uri: p.uri,
    }));
}

/** Suena una playlist en ESTE dispositivo (RiderTrack 🛵) */
export async function spotifyTocarPlaylist(uri: string): Promise<boolean> {
  const token = await _token();
  if (!token || !_deviceId) return false;
  try {
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${_deviceId}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_uri: uri }),
    });
    return true;
  } catch { return false; }
}

/** "Tus me gusta" no tiene context_uri → se toca por uris de temas */
export async function spotifyTocarMeGusta(): Promise<boolean> {
  const token = await _token();
  if (!token || !_deviceId) return false;
  try {
    const d = await _api('/me/tracks?limit=50');
    const uris = (d?.items || []).map((i: any) => i?.track?.uri).filter(Boolean);
    if (!uris.length) return false;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${_deviceId}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris }),
    });
    return true;
  } catch { return false; }
}

// ── Logout ──
export function spotifyLogout(): void {
  if (_player) { try { _player.disconnect(); } catch {} _player = null; }
  _accessToken = null;
  _deviceId = null;
  [KEY_TOKEN, KEY_TOKEN_TIME, KEY_REFRESH, KEY_VERIFIER].forEach((k) => localStorage.removeItem(k));
  _estado = _estadoBase();
  _listeners.forEach((l) => l(_estado));
}
