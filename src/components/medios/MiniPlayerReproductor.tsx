// ═══════════════════════════════════════════════════════════
// 🔊 MINI-REPRODUCTOR GLOBAL (Fase 3.11)
// Barra fija abajo con lo que está sonando (radio / Spotify /
// YouTube) — aparece en TODAS las pestañas y permite pausar o
// cortar sin volver a Medios. Incluye el contenedor PERSISTENTE
// del iframe de YouTube (mini video PiP arriba de la barra).
//
// ⚠️ Nota técnica: el contenedor del iframe de YouTube vive
// SIEMPRE en el DOM (aunque oculto) — si se desmontara, el
// video se cortaría. El div interno nunca cambia de props para
// no pelearse con el iframe que crea la API de YouTube.
// ═══════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { Pause, Play, X, Music2, Youtube } from 'lucide-react';
import { useMedios, YT_CONTAINER_ID } from './MediosProvider';

export const MiniPlayerReproductor: React.FC<{ mediosVisible?: boolean }> = ({ mediosVisible = false }) => {
  const m = useMedios();
  const { radio, spotify, youtube, fuenteActiva, algoCargado } = m;

  // Reserva espacio abajo para que la barra no tape contenido
  useEffect(() => {
    document.body.style.paddingBottom = algoCargado ? '4.5rem' : '';
    return () => { document.body.style.paddingBottom = ''; };
  }, [algoCargado]);

  // ── Clases del contenedor de YouTube (siempre montado) ──
  const pipActivo = fuenteActiva === 'youtube' && !!youtube.videoId && !youtube.error;
  const clasesContenedor = !youtube.videoId
    // sin video: invisible pero en el DOM
    ? 'fixed bottom-0 right-0 w-px h-px overflow-hidden opacity-0 pointer-events-none'
    : pipActivo
      ? `fixed z-40 overflow-hidden rounded-xl border border-slate-700 bg-black shadow-2xl transition-all bottom-[4.75rem] right-3 ${
          mediosVisible ? 'w-[calc(100%-1.5rem)] max-w-[340px] aspect-video' : 'w-40 aspect-video'
        }`
      // video cargado pero otra fuente activa o con error: escondido, sin destruirlo
      : 'fixed bottom-0 right-0 w-px h-px overflow-hidden opacity-0 pointer-events-none';

  // ── Qué mostrar en la barra según la fuente activa ──
  let icono: React.ReactNode = <Music2 className="w-4 h-4" />;
  let titulo = '';
  let subtitulo = '';
  let sonando = false;

  if (fuenteActiva === 'radio' && radio.estacion) {
    icono = <span className="text-base leading-none">{radio.estacion.emoji}</span>;
    titulo = radio.estacion.name;
    subtitulo = radio.cargando ? 'Conectando…' : radio.reproduciendo ? `En vivo · ${radio.estacion.freq}` : `Pausada · ${radio.estacion.freq}`;
    sonando = radio.reproduciendo;
  } else if (fuenteActiva === 'spotify' && spotify.track) {
    icono = <Music2 className="w-4 h-4 text-emerald-400" />;
    titulo = spotify.track.nombre || 'Spotify';
    subtitulo = spotify.track.artista || '';
    sonando = spotify.track.reproduciendo;
  } else if (fuenteActiva === 'youtube' && youtube.videoId) {
    icono = <Youtube className="w-4 h-4 text-red-500" />;
    titulo = youtube.titulo || 'YouTube';
    subtitulo = youtube.cargando ? 'Cargando…' : youtube.reproduciendo ? 'Reproduciendo' : 'Pausado';
    sonando = youtube.reproduciendo;
  }

  const toggle = () => {
    if (fuenteActiva === 'radio') m.radioToggle();
    else if (fuenteActiva === 'spotify') m.spotifyToggle();
    else if (fuenteActiva === 'youtube') m.youtubeToggle();
  };
  const detener = () => {
    if (fuenteActiva === 'radio') m.radioDetener();
    else if (fuenteActiva === 'spotify') m.spotifyDesconectar();
    else if (fuenteActiva === 'youtube') m.youtubeDetener();
  };

  return (
    <>
      {/* Contenedor PERSISTENTE del iframe de YouTube */}
      <div data-testid="yt-pip-container" className={clasesContenedor}>
        {/* div interno estable: la API de YouTube lo reemplaza por el iframe */}
        <div id={YT_CONTAINER_ID} className="w-full h-full" />
      </div>

      {/* Barra del mini-reproductor (solo cuando algo está cargado) */}
      {algoCargado && (
        <div data-testid="mini-player-bar" className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-700 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
          <div className="max-w-7xl mx-auto flex items-center gap-2 px-3 py-2">
            {/* Icono + info */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${sonando ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                {icono}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate leading-tight">{titulo}</div>
                <div className="text-[10px] text-slate-400 truncate leading-tight">{subtitulo}</div>
              </div>
              {sonando && (
                <div className="flex items-end gap-0.5 h-4 shrink-0">
                  <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: '60%', animation: 'rtEq 0.9s ease-in-out infinite' }} />
                  <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: '100%', animation: 'rtEq 0.7s ease-in-out infinite 0.1s' }} />
                  <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: '40%', animation: 'rtEq 1.1s ease-in-out infinite 0.2s' }} />
                </div>
              )}
            </div>

            {/* Play / Pausa */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center active:scale-95 transition-all shrink-0"
              aria-label={sonando ? 'Pausar' : 'Reproducir'}
            >
              {sonando ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            {/* Detener / cerrar */}
            <button
              onClick={detener}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all shrink-0"
              aria-label="Detener"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
