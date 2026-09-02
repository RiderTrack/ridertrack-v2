// ═══════════════════════════════════════════════════════════
// 🎛️ MEDIOS PROVIDER (Fase 3.11 · deeplink a App en F3.28)
// Estado GLOBAL de radio + Spotify + YouTube + Podcasts (F3.43),
// montado en App:
//   • El <audio> de radio, el player de Spotify y el iframe de
//     YouTube viven AQUÍ (no en la vista) → la música sigue
//     sonando al cambiar de pestaña (Mi Ruta, Chat, etc.)
//   • Solo una fuente suena a la vez: al arrancar una, pausa
//     las demás (igual que la v1).
//   • F3.28: el deep link de Spotify (com.ridertrack.v2://callback
//     ?code=…) ya NO se captura aquí — este componente se monta
//     SOLO cuando hay sesión y en el arranque en frío el evento
//     llegaba antes. Ahora lo captura App.tsx (siempre montado,
//     login incluido) y el intercambio lo hace el servicio
//     spotify.ts directamente. Aquí queda la restauración de
//     sesión y el resto del orquestador.
// ═══════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { RadioEngine, RadioEstado, RADIOS } from '../../services/mediosRadio';
import {
  SpotifyEstado, subscribeSpotify, spotifyLogin,
  spotifyTogglePlay, spotifyNext, spotifyPrev, spotifyVolume, spotifySeek,
  spotifyShuffle, spotifyRepeat, spotifyToggleLike, spotifyLogout,
  spotifyMisPlaylists, SpotifyPlaylist, spotifyTocarPlaylist, spotifyTocarMeGusta,
  tokenGuardadoFresco, hayRefreshToken, spotifyRefreshToken, iniciarSpotify, getAccessToken,
} from '../../services/spotify';
import {
  YouTubeEstado, subscribeYouTube, tocarYouTube, ytTogglePlay, ytDetener,
  extraerVideoId, getEstadoYouTube,
} from '../../services/mediosYouTube';
// F3.43: 🎧 podcasts RSS — mismo player de la app, pausa cortés
import {
  EpisodioRSS,
  EstadoPodcastsRSS,
  arrancarPodcastsRSS,
  snapshotPodcastsRSS,
  suscribirPodcastsRSS,
  tocarEpisodioRSS,
  toggleEpisodioRSS,
  detenerEpisodioRSS,
  saltarEpisodioRSS,
  fijarVelocidadRSS,
  pausarEpisodioRSS,
} from '../../services/podcastRSS';
// F3.42/F3.43: la jornada hablada (TTS) se corta cuando suena un episodio
import { detenerPodcast as detenerJornadaHablada } from '../../services/podcast';

/** ID del contenedor persistente del iframe de YouTube */
export const YT_CONTAINER_ID = 'rt-yt-player-container';

export type FuenteMedia = 'radio' | 'spotify' | 'youtube' | 'podcast';

interface MediosContexto {
  radio: RadioEstado;
  radioVolumen: number;
  radioPlay: (idEstacion: string) => void;
  radioToggle: () => void;
  radioDetener: () => void;
  radioSetVolumen: (v: number) => void;

  spotify: SpotifyEstado;
  playlists: SpotifyPlaylist[];
  playlistsCargando: boolean;
  recargarPlaylists: () => void;
  spotifyConectar: () => void;
  spotifyToggle: () => void;
  spotifySiguiente: () => void;
  spotifyAnterior: () => void;
  spotifySetVolumen: (pct: number) => void;
  spotifyBuscar: (ms: number) => void;
  spotifyAlternarShuffle: () => void;
  spotifyAlternarRepeat: () => void;
  spotifyLike: () => void;
  spotifyDesconectar: () => void;
  spotifyTocar: (uri: string) => void;
  spotifyTocarMegusta: () => void;

  youtube: YouTubeEstado;
  youtubeTocar: (urlOId: string) => boolean;
  youtubeToggle: () => void;
  youtubeDetener: () => void;

  // F3.43: 🎧 podcasts RSS (mismo player de la app)
  podcast: EstadoPodcastsRSS;
  podcastTocar: (ep: EpisodioRSS) => void;
  podcastToggle: () => void;
  podcastDetener: () => void;
  podcastSaltar: (seg: number) => void;
  podcastVelocidad: (v: number) => void;

  fuenteActiva: FuenteMedia | null;
  algoCargado: boolean;
}

const Ctx = createContext<MediosContexto | null>(null);

export function useMedios(): MediosContexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useMedios debe usarse dentro de <MediosProvider>');
  return c;
}

export const MediosProvider: React.FC<{
  children: React.ReactNode;
  onShowToast?: (titulo: string, desc?: string, tipo?: 'success' | 'info' | 'warning' | 'error') => void;
  /** F3.43: uid del rider — arranque del servicio de podcasts */
  uid?: string | null;
}> = ({ children, onShowToast, uid }) => {
  const engineRef = useRef<RadioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new RadioEngine();
  const engine = engineRef.current;

  const [radio, setRadio] = useState<RadioEstado>(engine.estado);
  const [radioVolumen, setRadioVolumen] = useState(engine.volumen);
  const [spotify, setSpotify] = useState<SpotifyEstado | null>(null);
  const [youtube, setYouTube] = useState<YouTubeEstado | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistsCargando, setPlaylistsCargando] = useState(false);
  const [ultimaFuente, setUltimaFuente] = useState<FuenteMedia | null>(null);
  // F3.43: 🎧 estado del podcast RSS
  const [podcast, setPodcast] = useState<EstadoPodcastsRSS>(() => snapshotPodcastsRSS());

  // ── Suscripciones a los 4 motores ──
  useEffect(() => {
    engine.onCambio = (e) => setRadio({ ...e });
    const offSp = subscribeSpotify((e) => setSpotify(e));
    const offYt = subscribeYouTube((e) => setYouTube(e));
    const offPod = suscribirPodcastsRSS(() => setPodcast(snapshotPodcastsRSS()));
    return () => { engine.onCambio = null; offSp(); offYt(); offPod(); };
  }, [engine]);

  // ── F3.43: arranque del servicio de podcasts con el uid ──
  useEffect(() => {
    if (!uid) return;
    const off = arrancarPodcastsRSS(uid);
    return off;
  }, [uid]);

  // ── Restaurar sesión de Spotify (token fresco o refresh) ──
  // F3.28: si el deep link YA intercambió el código (App.tsx lo
  // hace apenas abre, incluso antes de montar esto), el servicio
  // ya tiene token en memoria y su SDK ya está conectando → no
  // volver a arrancarlo (crearPlayer reemplaza al anterior, pero
  // sería un disconnect/connect innecesario y parpadeos de estado).
  useEffect(() => {
    if (getAccessToken()) return; // ya conectado por el deep link
    const fresco = tokenGuardadoFresco();
    if (fresco) { iniciarSpotify(fresco); return; }
    if (hayRefreshToken()) {
      spotifyRefreshToken().then((ok) => {
        if (ok && getAccessToken()) iniciarSpotify(getAccessToken()!);
      });
    }
  }, []);

  // ── Cargar playlists cuando el dispositivo queda listo ──
  const recargarPlaylists = useCallback(() => {
    setPlaylistsCargando(true);
    spotifyMisPlaylists()
      .then((l) => setPlaylists(l))
      .catch(() => setPlaylists([]))
      .finally(() => setPlaylistsCargando(false));
  }, []);

  useEffect(() => {
    if (spotify?.listo && !playlists.length && !playlistsCargando) {
      recargarPlaylists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotify?.listo]);

  // ── (F3.28) Deep link de Spotify → capturado en App.tsx ──
  // Antes vivía aquí: el componente solo se monta con sesión ya
  // restaurada y en el arranque en frío (Android re-abre la app
  // al volver de Spotify) el evento se perdía. Ver App.tsx.

  // ── Acciones radio ──
  const radioPlay = useCallback((idEstacion: string) => {
    const est = RADIOS.find((r) => r.id === idEstacion);
    if (!est) return;
    setUltimaFuente('radio');
    // corta las otras fuentes si estaban sonando
    if (spotify?.track?.reproduciendo) spotifyTogglePlay();
    if (youtube?.reproduciendo) ytTogglePlay();
    if (snapshotPodcastsRSS().fase === 'reproduciendo') pausarEpisodioRSS();
    engine.play(est);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, spotify?.track?.reproduciendo, youtube?.reproduciendo]);

  const radioToggle = useCallback(() => { setUltimaFuente('radio'); engine.toggle(); }, [engine]);
  const radioDetener = useCallback(() => engine.detener(), [engine]);
  const radioSetVolumen = useCallback((v: number) => {
    engine.setVolumen(v);
    setRadioVolumen(v);
  }, [engine]);

  // ── Acciones spotify ──
  const spotifyConectar = useCallback(() => { spotifyLogin(); }, []);
  const spotifyToggle = useCallback(() => {
    setUltimaFuente('spotify');
    if (engine.reproduciendo) engine.pausar();
    if (getEstadoYouTube().reproduciendo) ytTogglePlay();
    if (snapshotPodcastsRSS().fase === 'reproduciendo') pausarEpisodioRSS();
    spotifyTogglePlay();
  }, [engine]);

  const spotifySiguiente = useCallback(() => spotifyNext(), []);
  const spotifyAnterior = useCallback(() => spotifyPrev(), []);
  const spotifySetVolumen = useCallback((pct: number) => spotifyVolume(pct), []);
  const spotifyBuscar = useCallback((ms: number) => spotifySeek(ms), []);
  const spotifyAlternarShuffle = useCallback(async () => {
    const nuevo = await spotifyShuffle(!spotify?.shuffle);
    setSpotify((s) => (s ? { ...s, shuffle: nuevo } : s));
  }, [spotify?.shuffle]);
  const spotifyAlternarRepeat = useCallback(async () => {
    const siguiente = (((spotify?.repeat ?? 0) + 1) % 3) as 0 | 1 | 2;
    const res = await spotifyRepeat(siguiente);
    setSpotify((s) => (s ? { ...s, repeat: res } : s));
  }, [spotify?.repeat]);
  const spotifyLike = useCallback(async () => { await spotifyToggleLike(); }, []);
  const spotifyDesconectar = useCallback(() => {
    spotifyLogout();
    setPlaylists([]);
  }, []);

  const spotifyTocar = useCallback((uri: string) => {
    setUltimaFuente('spotify');
    if (engine.reproduciendo) engine.pausar();
    if (getEstadoYouTube().reproduciendo) ytTogglePlay();
    if (snapshotPodcastsRSS().fase === 'reproduciendo') pausarEpisodioRSS();
    spotifyTocarPlaylist(uri).then((ok) => {
      if (!ok) onShowToast?.('⚠️ Spotify', 'El dispositivo aún no está listo — espera unos segundos', 'warning');
    });
  }, [engine, onShowToast]);

  const spotifyTocarMegusta = useCallback(() => {
    setUltimaFuente('spotify');
    if (engine.reproduciendo) engine.pausar();
    if (getEstadoYouTube().reproduciendo) ytTogglePlay();
    if (snapshotPodcastsRSS().fase === 'reproduciendo') pausarEpisodioRSS();
    spotifyTocarMeGusta().then((ok) => {
      if (!ok) onShowToast?.('⚠️ Spotify', 'El dispositivo aún no está listo — espera unos segundos', 'warning');
    });
  }, [engine, onShowToast]);

  // ── Acciones youtube ──
  const youtubeTocar = useCallback((urlOId: string): boolean => {
    const id = extraerVideoId(urlOId);
    if (!id) return false;
    setUltimaFuente('youtube');
    if (engine.reproduciendo) engine.pausar();
    if (spotify?.track?.reproduciendo) spotifyTogglePlay();
    if (snapshotPodcastsRSS().fase === 'reproduciendo') pausarEpisodioRSS();
    tocarYouTube(id, YT_CONTAINER_ID);
    return true;
  }, [engine, spotify?.track?.reproduciendo]);

  const youtubeToggle = useCallback(() => {
    setUltimaFuente('youtube');
    ytTogglePlay();
  }, []);
  const youtubeDetener = useCallback(() => ytDetener(), []);

  // ── F3.43: acciones podcasts RSS ──
  const podcastTocar = useCallback((ep: EpisodioRSS) => {
    setUltimaFuente('podcast');
    // corta las otras fuentes + la jornada hablada (TTS F3.42)
    if (engine.reproduciendo) engine.pausar();
    if (spotify?.track?.reproduciendo) spotifyTogglePlay();
    if (getEstadoYouTube().reproduciendo) ytTogglePlay();
    try { detenerJornadaHablada(); } catch { /* sin jornada sonando */ }
    void tocarEpisodioRSS(ep);
  }, [engine, spotify?.track?.reproduciendo]);

  const podcastToggle = useCallback(() => {
    setUltimaFuente('podcast');
    toggleEpisodioRSS();
  }, []);

  const podcastDetener = useCallback(() => { detenerEpisodioRSS(); }, []);

  const podcastSaltar = useCallback((seg: number) => { saltarEpisodioRSS(seg); }, []);

  const podcastVelocidad = useCallback((v: number) => { fijarVelocidadRSS(v); }, []);

  // ── Fuente activa para el mini-reproductor ──
  const fuenteActiva: FuenteMedia | null =
    (ultimaFuente === 'radio' && radio.estacion) ? 'radio'
    : (ultimaFuente === 'spotify' && spotify?.track) ? 'spotify'
    : (ultimaFuente === 'youtube' && youtube?.videoId) ? 'youtube'
    : (ultimaFuente === 'podcast' && podcast.episodio) ? 'podcast'
    : radio.estacion ? 'radio'
    : spotify?.track ? 'spotify'
    : youtube?.videoId ? 'youtube'
    : podcast.episodio ? 'podcast'
    : null;

  const algoCargado = !!fuenteActiva;

  const valor: MediosContexto = {
    radio, radioVolumen, radioPlay, radioToggle, radioDetener, radioSetVolumen,
    spotify: spotify || { conectado: false, listo: false, estado: 'desconectado', mensaje: '', track: null, shuffle: false, repeat: 0, liked: false },
    playlists, playlistsCargando, recargarPlaylists,
    spotifyConectar, spotifyToggle, spotifySiguiente, spotifyAnterior,
    spotifySetVolumen, spotifyBuscar, spotifyAlternarShuffle, spotifyAlternarRepeat,
    spotifyLike, spotifyDesconectar, spotifyTocar, spotifyTocarMegusta,
    youtube: youtube || { videoId: null, titulo: '', reproduciendo: false, cargando: false, error: null },
    youtubeTocar, youtubeToggle, youtubeDetener,
    podcast, podcastTocar, podcastToggle, podcastDetener, podcastSaltar, podcastVelocidad,
    fuenteActiva, algoCargado,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
};
