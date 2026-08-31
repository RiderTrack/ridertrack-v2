// ═══════════════════════════════════════════════════════════
// 🎛️ MEDIOS PROVIDER (Fase 3.11)
// Estado GLOBAL de radio + Spotify + YouTube, montado en App:
//   • El <audio> de radio, el player de Spotify y el iframe de
//     YouTube viven AQUÍ (no en la vista) → la música sigue
//     sonando al cambiar de pestaña (Mi Ruta, Chat, etc.)
//   • Solo una fuente suena a la vez: al arrancar una, pausa
//     las demás (igual que la v1).
//   • Captura el deep link ridertrack://callback de Spotify
//     (evento appUrlOpen) y restaura la sesión guardada.
// ═══════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  RadioEngine, RadioEstado, RADIOS,
} from '../../services/mediosRadio';
import {
  SpotifyEstado, subscribeSpotify, spotifyLogin, spotifyExchangeCode,
  spotifyTogglePlay, spotifyNext, spotifyPrev, spotifyVolume, spotifySeek,
  spotifyShuffle, spotifyRepeat, spotifyToggleLike, spotifyLogout,
  spotifyMisPlaylists, SpotifyPlaylist, spotifyTocarPlaylist, spotifyTocarMeGusta,
  tokenGuardadoFresco, hayRefreshToken, spotifyRefreshToken, iniciarSpotify, getAccessToken,
} from '../../services/spotify';
import {
  YouTubeEstado, subscribeYouTube, tocarYouTube, ytTogglePlay, ytDetener,
  extraerVideoId, getEstadoYouTube,
} from '../../services/mediosYouTube';

/** ID del contenedor persistente del iframe de YouTube */
export const YT_CONTAINER_ID = 'rt-yt-player-container';

export type FuenteMedia = 'radio' | 'spotify' | 'youtube';

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
}> = ({ children, onShowToast }) => {
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

  // ── Suscripciones a los 3 motores ──
  useEffect(() => {
    engine.onCambio = (e) => setRadio({ ...e });
    const offSp = subscribeSpotify((e) => setSpotify(e));
    const offYt = subscribeYouTube((e) => setYouTube(e));
    return () => { engine.onCambio = null; offSp(); offYt(); };
  }, [engine]);

  // ── Restaurar sesión de Spotify (token fresco o refresh) ──
  useEffect(() => {
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

  // ── Deep link de Spotify (ridertrack://callback?code=…) ──
  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    async function registrar() {
      try {
        if (!Capacitor.isNativePlatform?.()) return;
        sub = await CapApp.addListener('appUrlOpen', (data: any) => {
          try {
            const url = new URL(data?.url || '');
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');
            if (error) {
              onShowToast?.('⚠️ Spotify', 'No aceptaste el permiso', 'warning');
              return;
            }
            if (code) {
              spotifyExchangeCode(code).then((ok) => {
                if (ok) onShowToast?.('🎵 Spotify conectado', 'Elige una playlist y dale play', 'success');
                else onShowToast?.('⚠️ Spotify', 'No se pudo completar la conexión', 'warning');
              });
            }
          } catch { /* URL rara — ignorar */ }
        });
      } catch { /* plugin no disponible en esta plataforma */ }
    }
    registrar();
    return () => { try { sub?.remove?.(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Acciones radio ──
  const radioPlay = useCallback((idEstacion: string) => {
    const est = RADIOS.find((r) => r.id === idEstacion);
    if (!est) return;
    setUltimaFuente('radio');
    // corta las otras fuentes si estaban sonando
    if (spotify?.track?.reproduciendo) spotifyTogglePlay();
    if (youtube?.reproduciendo) ytTogglePlay();
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
    spotifyTocarPlaylist(uri).then((ok) => {
      if (!ok) onShowToast?.('⚠️ Spotify', 'El dispositivo aún no está listo — espera unos segundos', 'warning');
    });
  }, [engine, onShowToast]);

  const spotifyTocarMegusta = useCallback(() => {
    setUltimaFuente('spotify');
    if (engine.reproduciendo) engine.pausar();
    if (getEstadoYouTube().reproduciendo) ytTogglePlay();
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
    tocarYouTube(id, YT_CONTAINER_ID);
    return true;
  }, [engine, spotify?.track?.reproduciendo]);

  const youtubeToggle = useCallback(() => {
    setUltimaFuente('youtube');
    ytTogglePlay();
  }, []);
  const youtubeDetener = useCallback(() => ytDetener(), []);

  // ── Fuente activa para el mini-reproductor ──
  const fuenteActiva: FuenteMedia | null =
    (ultimaFuente === 'radio' && radio.estacion) ? 'radio'
    : (ultimaFuente === 'spotify' && spotify?.track) ? 'spotify'
    : (ultimaFuente === 'youtube' && youtube?.videoId) ? 'youtube'
    : radio.estacion ? 'radio'
    : spotify?.track ? 'spotify'
    : youtube?.videoId ? 'youtube'
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
    fuenteActiva, algoCargado,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
};
