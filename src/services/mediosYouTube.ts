// ═══════════════════════════════════════════════════════════
// ▶️ MEDIOS — YOUTUBE (Fase 3.11)
// Reproductor embebido vía IFrame API de YouTube:
//   • El <iframe> vive en un contenedor PERSISTENTE a nivel App
//     (lo renderiza MediosProvider) → el audio NO se corta al
//     cambiar de pestaña. En otras pestañas se ve como mini
//     video (PiP) junto a la barra del reproductor.
//   • Pegas un link de YouTube (los que comparte la app oficial)
//     y suena; puedes guardarlo en favoritos con su título.
//   • Sin API key: el título sale del propio player.
// ═══════════════════════════════════════════════════════════

export interface VideoFavorito {
  id: string;
  titulo: string;
  agregadoEn: number;
}

export interface YouTubeEstado {
  videoId: string | null;
  titulo: string;
  reproduciendo: boolean;
  cargando: boolean;
  error: string | null;
}

const KEY_FAVS = 'rt_yt_favoritos';

export function leerFavoritosYT(): VideoFavorito[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_FAVS) || '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && typeof x.titulo === 'string') : [];
  } catch { return []; }
}
export function guardarFavoritosYT(list: VideoFavorito[]): void {
  try { localStorage.setItem(KEY_FAVS, JSON.stringify(list.slice(0, 50))); } catch {}
}

/**
 * Extrae el ID de video de cualquier forma de link de YouTube:
 *   youtube.com/watch?v=ID · youtu.be/ID · m.youtube.com/watch?v=ID
 *   youtube.com/shorts/ID · music.youtube.com/watch?v=ID · ID pelito (11 chars)
 */
export function extraerVideoId(url: string): string | null {
  const s = String(url || '').trim();
  if (!s) return null;
  // ID pelado (11 caracteres alfanuméricos con - y _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const patrones = [
    /(?:youtube\.com\/watch\?[^#]*\bv=)([a-zA-Z0-9_-]{11})/i,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/i,
  ];
  for (const p of patrones) {
    const m = s.match(p);
    if (m) return m[1];
  }
  return null;
}

// ── IFrame API (carga dinámica) ──
declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void; }
}

let _apiCargando: Promise<void> | null = null;
function cargarApiYT(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (_apiCargando) return _apiCargando;
  _apiCargando = new Promise((resolve) => {
    const previo = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previo?.();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => resolve(); // sin red → el error se ve al intentar tocar
    document.head.appendChild(s);
  });
  return _apiCargando;
}

type Listener = (e: YouTubeEstado) => void;
const _listeners = new Set<Listener>();
let _estado: YouTubeEstado = { videoId: null, titulo: '', reproduciendo: false, cargando: false, error: null };

export function subscribeYouTube(cb: Listener): () => void {
  _listeners.add(cb);
  cb(_estado);
  return () => { _listeners.delete(cb); };
}
function emitir(patch: Partial<YouTubeEstado> = {}) {
  _estado = { ..._estado, ...patch };
  _listeners.forEach((l) => l(_estado));
}
export function getEstadoYouTube(): YouTubeEstado { return _estado; }

let _player: any = null;

/**
 * Toca un video en el contenedor persistente.
 * El contenedor debe existir en el DOM (lo crea MediosProvider).
 */
export async function tocarYouTube(videoId: string, contenedorId: string): Promise<void> {
  emitir({ cargando: true, error: null, videoId });
  await cargarApiYT();
  if (!window.YT?.Player) {
    emitir({ cargando: false, reproduciendo: false, error: '⚠️ No se pudo cargar YouTube (revisa tu conexión)' });
    return;
  }
  if (!_player) {
    _player = new window.YT.Player(contenedorId, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, hl: 'es', cc_lang_pref: 'es' },
      events: {
        onReady: (ev: any) => { try { ev.target.playVideo(); } catch {} },
        onStateChange: (ev: any) => {
          const YTS = window.YT?.PlayerState;
          if (!YTS) return;
          if (ev.data === YTS.PLAYING) {
            const d = _player?.getVideoData?.() || {};
            emitir({ reproduciendo: true, cargando: false, error: null, titulo: d.title || _estado.titulo });
          } else if (ev.data === YTS.PAUSED) {
            emitir({ reproduciendo: false });
          } else if (ev.data === YTS.ENDED) {
            emitir({ reproduciendo: false });
          } else if (ev.data === YTS.BUFFERING) {
            emitir({ cargando: true });
          }
        },
        onError: () => {
          emitir({ reproduciendo: false, cargando: false, error: '⚠️ Ese video no se puede reproducir (privado o eliminado)' });
        },
      },
    });
  } else {
    try { _player.loadVideoById(videoId); } catch {}
  }
}

export function ytTogglePlay(): void {
  if (!_player) return;
  try {
    if (_estado.reproduciendo) _player.pauseVideo();
    else _player.playVideo();
  } catch {}
}

export function ytDetener(): void {
  if (_player) {
    try { _player.stopVideo(); } catch {}
  }
  emitir({ videoId: null, titulo: '', reproduciendo: false, cargando: false, error: null });
}

export function ytSetVolumen(pct: number): void {
  try { _player?.setVolume(Math.max(0, Math.min(100, Math.round(pct)))); } catch {}
}
