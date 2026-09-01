// ═══════════════════════════════════════════════════════════
// 🎵 MEDIOS VIEW (Fase 3.11 — antes placeholder)
// Tres pestañas:
//   📻 Radio — las 14 emisoras peruanas de la v1 (favoritos,
//       búsqueda, volumen) — sigue sonando en otras pestañas
//   🎵 Spotify — login Premium (PKCE, mismo client de la v1),
//       player completo + tus playlists para arrancar la música.
//       F3.28: guía de conexión visible en la tarjeta de login
//       (el paso 1 sola vez del dashboard de Spotify).
//       F3.29: banner "📞 ¿Te llamaron? Reconectando…" cuando la
//       llamada mató el player — el watchdog de spotify.ts lo
//       reconecta solo y la música vuelve donde estaba.
//   ▶️ YouTube — pega un link y suena; guárdalo en favoritos
// Todo el audio lo maneja MediosProvider (global) → el
// mini-reproductor (barra abajo) acompaña en toda la app.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect } from 'react';
import {
  Music, Radio as RadioIcon, Youtube, Search, Star, Play, Pause, Square,
  Volume2, Loader2, Heart, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  LogOut, Link2, Trash2, RefreshCw, ExternalLink, Check, Copy, ChevronDown, Info,
} from 'lucide-react';
import { useMedios } from './medios/MediosProvider';
import { RADIOS, RadioEstacion, leerFavoritos, guardarFavoritos } from '../services/mediosRadio';
import { leerFavoritosYT, guardarFavoritosYT, VideoFavorito, extraerVideoId } from '../services/mediosYouTube';

type TabMedios = 'radio' | 'spotify' | 'youtube';

const fmtTiempo = (ms: number): string => {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

export const MediosView: React.FC = () => {
  const m = useMedios();
  const [tab, setTab] = useState<TabMedios>('radio');

  return (
    <div className="space-y-4 pb-12 max-w-3xl">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <Music className="w-6 h-6 text-emerald-500" />
          Medios
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Música y radio para tu ruta — sigue sonando mientras usas el resto de la app 🎧
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setTab('radio')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
            tab === 'radio'
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700/50'
          }`}
        >
          <RadioIcon className="w-4 h-4" /> Radio
        </button>
        <button
          onClick={() => setTab('spotify')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
            tab === 'spotify'
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700/50'
          }`}
        >
          <Music className="w-4 h-4" /> Spotify
        </button>
        <button
          onClick={() => setTab('youtube')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
            tab === 'youtube'
              ? 'bg-red-600 border-red-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700/50'
          }`}
        >
          <Youtube className="w-4 h-4" /> YouTube
        </button>
      </div>

      {tab === 'radio' && <TabRadio />}
      {tab === 'spotify' && <TabSpotify />}
      {tab === 'youtube' && <TabYouTube />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 📻 RADIO
// ═══════════════════════════════════════════════════════════
const TabRadio: React.FC = () => {
  const m = useMedios();
  const { radio, radioVolumen } = m;
  const [busqueda, setBusqueda] = useState('');
  const [favoritos, setFavoritos] = useState<string[]>([]);

  useEffect(() => { setFavoritos(leerFavoritos()); }, []);

  const lista = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    const filtradas = q
      ? RADIOS.filter((r) => r.name.toLowerCase().includes(q) || r.genre.toLowerCase().includes(q) || r.freq.toLowerCase().includes(q))
      : RADIOS;
    return [...filtradas].sort((a, b) => {
      const fa = favoritos.includes(a.id) ? 0 : 1;
      const fb = favoritos.includes(b.id) ? 0 : 1;
      return fa - fb;
    });
  }, [busqueda, favoritos]);

  const toggleFav = (id: string) => {
    const nuevos = favoritos.includes(id) ? favoritos.filter((x) => x !== id) : [...favoritos, id];
    setFavoritos(nuevos);
    guardarFavoritos(nuevos);
  };

  const estacion = radio.estacion;

  return (
    <div className="space-y-3">
      {/* Ahora sonando */}
      {estacion && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/20 to-slate-800 border border-blue-500/40 shadow-xl">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-2xl shrink-0 ${radio.reproduciendo ? 'animate-pulse' : ''}`}>
              {estacion.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded">EN VIVO</span>
                {radio.cargando && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
              </div>
              <div className="text-base font-black text-white truncate mt-0.5">{estacion.name}</div>
              <div className="text-[11px] text-slate-400">{estacion.freq} · {estacion.genre}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={m.radioToggle}
                className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center active:scale-95 transition-all"
              >
                {radio.reproduciendo ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={m.radioDetener}
                className="w-11 h-11 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all"
                title="Apagar radio"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Volumen */}
          <div className="flex items-center gap-2 mt-3">
            <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range" min={0} max={100}
              value={Math.round(radioVolumen * 100)}
              onChange={(e) => m.radioSetVolumen(parseInt(e.target.value) / 100)}
              className="w-full accent-blue-500"
            />
          </div>
          {radio.error && <div className="mt-2 text-[11px] text-amber-400">{radio.error}</div>}
        </div>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar emisora o género…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
        />
      </div>

      {/* Lista de emisoras */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        {lista.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-500">🔍 Sin resultados para “{busqueda}”</div>
        )}
        {lista.map((r: RadioEstacion) => {
          const esActual = radio.estacion?.id === r.id;
          const sonandoEsta = esActual && radio.reproduciendo;
          return (
            <button
              key={r.id}
              onClick={() => (sonandoEsta ? m.radioToggle() : m.radioPlay(r.id))}
              className={`w-full flex items-center gap-3 px-3 py-3 border-b border-slate-700/50 last:border-0 text-left transition-colors ${
                esActual ? 'bg-blue-500/10' : 'hover:bg-slate-700/30'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${esActual ? 'bg-blue-500/20' : 'bg-slate-700/50'}`}>
                {sonandoEsta ? '🔊' : r.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{r.name}</div>
                <div className="text-[10px] text-slate-400">{r.freq} · {r.genre}</div>
              </div>
              {sonandoEsta && (
                <span className="text-[9px] text-blue-300 font-black shrink-0">SONANDO</span>
              )}
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); toggleFav(r.id); }}
                className={`shrink-0 px-1 text-lg leading-none ${favoritos.includes(r.id) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
              >
                {favoritos.includes(r.id) ? '⭐' : '☆'}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 text-center">
        {RADIOS.length} emisoras en vivo · las ⭐ favoritas suben al inicio
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 🎵 SPOTIFY
// ═══════════════════════════════════════════════════════════
const TabSpotify: React.FC = () => {
  const m = useMedios();
  const { spotify, playlists, playlistsCargando } = m;
  const [volumenSp, setVolumenSp] = useState(80);

  // F3.28: guía de conexión desplegable (el paso del dashboard)
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  const [uriCopiada, setUriCopiada] = useState(false);
  const copiarURI = () => {
    const uri = 'com.ridertrack.v2://callback';
    const done = () => { setUriCopiada(true); setTimeout(() => setUriCopiada(false), 2000); };
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(uri).then(done).catch(() => copiarFallback(uri, done));
      } else copiarFallback(uri, done);
    } catch { copiarFallback(uri, done); }
  };
  const copiarFallback = (texto: string, done: () => void) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch { /* sin portapapeles — copia a mano */ }
  };

  // posición progresiva del track (el SDK solo emite en cambios)
  const [posLocal, setPosLocal] = useState(0);
  useEffect(() => {
    setPosLocal(spotify.track?.posicionMs || 0);
  }, [spotify.track?.posicionMs, spotify.track?.id]);
  useEffect(() => {
    if (!spotify.track?.reproduciendo) return;
    const t = setInterval(() => setPosLocal((p) => p + 1000), 1000);
    return () => clearInterval(t);
  }, [spotify.track?.reproduciendo]);

  const track = spotify.track;
  const dur = track?.duracionMs || 0;
  const pct = dur ? Math.min(100, (posLocal / dur) * 100) : 0;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    m.spotifyBuscar(p * dur);
  };

  // ── No conectado ──
  if (!spotify.conectado) {
    return (
      <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <Music className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <div className="text-base font-black text-white">Conecta tu Spotify Premium</div>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed max-w-xs mx-auto">
            Tu música y playlists favoritas suenan directo en la app mientras haces tus entregas.
            Se abre Spotify para que aceptes, y luego vuelves solo a RiderTrack.
          </p>
        </div>
        <button
          onClick={m.spotifyConectar}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 mx-auto active:scale-95 transition-all"
        >
          <ExternalLink className="w-4 h-4" /> Conectar Spotify
        </button>
        <p className="text-[10px] text-slate-400">Requiere cuenta Premium (reproducción dentro de la app)</p>

        {/* F3.28 — Guía: el paso 1 sola vez del dashboard de Spotify */}
        <div className="border-t border-slate-700/50 pt-3 text-left">
          <button
            onClick={() => setGuiaAbierta((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            {guiaAbierta ? 'Ocultar guía' : '¿No vuelve a la app tras aceptar? Ver guía'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${guiaAbierta ? 'rotate-180' : ''}`} />
          </button>
          {guiaAbierta && (
            <div className="mt-2.5 space-y-2.5 text-left">
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-700">
                <div className="text-[11px] font-black text-emerald-400">PASO 1 · una sola vez</div>
                <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                  En el <b>dashboard de Spotify</b> (developer.spotify.com/dashboard → tu app → <b>Settings → Redirect URIs</b>)
                  agrega exactamente esta URI y guarda:
                </p>
                <button
                  onClick={copiarURI}
                  className="mt-1.5 w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:border-emerald-500/60 active:scale-[0.99] transition-all"
                  title="Copiar URI"
                >
                  <code className="flex-1 text-[10px] font-mono text-emerald-300 truncate">com.ridertrack.v2://callback</code>
                  {uriCopiada
                    ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    : <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                </button>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-700">
                <div className="text-[11px] font-black text-emerald-400">PASO 2 · siempre</div>
                <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                  Toca <b>Conectar Spotify</b> → se abre el navegador → inicia sesión y <b>acepta</b>.
                  Android te devuelve solo a RiderTrack y ya queda conectado (recuerda tu Premium).
                </p>
              </div>
              <p className="text-[9px] text-slate-500 px-1 leading-relaxed">
                Si ya aceptaste y no pasó nada: la APK actual ya escucha el regreso automático — revisa que el texto
                del Paso 1 esté idéntico (sin espacios) y vuelve a conectar. La radio y YouTube funcionan sin Spotify.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Conectando ──
  if (spotify.estado === 'conectando') {
    return (
      <div className="p-8 rounded-2xl bg-slate-800 border border-slate-700 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
        <div className="text-sm font-bold text-white">Conectando con Spotify…</div>
        <div className="text-[11px] text-slate-400">Preparando RiderTrack 🛵 como dispositivo</div>
      </div>
    );
  }

  // ── Requiere Premium ──
  if (spotify.estado === 'requiere-premium') {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
        <div className="text-2xl">⚠️</div>
        <div className="text-sm font-bold text-amber-300">Spotify Premium requerido</div>
        <p className="text-[11px] text-slate-400">
          Para reproducir dentro de la app, Spotify exige cuenta Premium.
          Con cuenta gratis puedes seguir usando la Radio y YouTube.
        </p>
        <button onClick={m.spotifyDesconectar} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold">
          Desconectar
        </button>
      </div>
    );
  }

  // ── Player + playlists ──
  return (
    <div className="space-y-3">
      {/* Player */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600/20 to-slate-800 border border-emerald-500/30 shadow-xl">
        {/* 📞 F3.29: la llamada mató el player → se reconecta solo */}
        {spotify.estado === 'reconectando' && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2" data-testid="banner-reconectando">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-amber-300 leading-tight">📞 ¿Te llamaron? Reconectando el reproductor…</div>
              <div className="text-[10px] text-slate-400 leading-tight">La música vuelve sola en unos segundos</div>
            </div>
          </div>
        )}
        {track ? (
          <>
            <div className="flex items-center gap-3">
              {track.imagen ? (
                <img src={track.imagen} alt={track.album} className={`w-16 h-16 rounded-xl object-cover shrink-0 ${track.reproduciendo ? '' : 'opacity-70'}`} />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Music className="w-8 h-8 text-emerald-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-white truncate">{track.nombre}</div>
                <div className="text-[11px] text-slate-400 truncate">{track.artista}</div>
                <div className="text-[10px] text-slate-500 truncate">{track.album}</div>
              </div>
              <button
                onClick={m.spotifyLike}
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-all ${
                  spotify.liked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Me gusta"
              >
                <Heart className={`w-4 h-4 ${spotify.liked ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Progreso */}
            <div className="mt-3">
              <div className="h-1.5 bg-slate-700 rounded-full cursor-pointer overflow-hidden" onClick={seek}>
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: pct + '%' }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>{fmtTiempo(posLocal)}</span>
                <span>{fmtTiempo(dur)}</span>
              </div>
            </div>

            {/* Controles */}
            <div className="flex items-center justify-center gap-3 mt-2">
              <button
                onClick={m.spotifyAlternarShuffle}
                className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${spotify.shuffle ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-white'}`}
                title="Aleatorio"
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button onClick={m.spotifyAnterior} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center active:scale-95 transition-all">
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={m.spotifyToggle} className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-emerald-600/30">
                {track.reproduciendo ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              <button onClick={m.spotifySiguiente} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center active:scale-95 transition-all">
                <SkipForward className="w-4 h-4" />
              </button>
              <button
                onClick={m.spotifyAlternarRepeat}
                className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${spotify.repeat ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-white'}`}
                title="Repetir"
              >
                {spotify.repeat === 2 ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-3">
            <div className="text-sm font-bold text-white">🟢 {spotify.mensaje || 'Spotify listo'}</div>
            <p className="text-[11px] text-slate-400 mt-1">Elige una playlist abajo para empezar</p>
          </div>
        )}

        {/* Volumen + estado + desconectar */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
          <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="range" min={0} max={100}
            value={volumenSp}
            onChange={(e) => { const v = parseInt(e.target.value); setVolumenSp(v); m.spotifySetVolumen(v); }}
            className="w-full accent-emerald-500"
          />
          <button
            onClick={() => { if (confirm('¿Desconectar Spotify?')) m.spotifyDesconectar(); }}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center shrink-0"
            title="Desconectar Spotify"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
        {spotify.estado === 'error' && <div className="mt-2 text-[11px] text-amber-400">{spotify.mensaje}</div>}
      </div>

      {/* Playlists */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-700/50 flex items-center justify-between">
          <div className="text-xs font-black text-white flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-emerald-400" /> Toca para sonar en RiderTrack 🛵
          </div>
          <button onClick={m.recargarPlaylists} className="text-slate-500 hover:text-white" title="Recargar">
            <RefreshCw className={`w-3.5 h-3.5 ${playlistsCargando ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tus me gusta */}
        <button
          onClick={m.spotifyTocarMegusta}
          className="w-full flex items-center gap-3 px-3 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 text-left transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-white fill-current" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">Tus me gusta</div>
            <div className="text-[10px] text-slate-400">Tus canciones favoritas</div>
          </div>
          <Play className="w-4 h-4 text-slate-500 shrink-0" />
        </button>

        {playlists.map((p) => (
          <button
            key={p.id}
            onClick={() => m.spotifyTocar(p.uri)}
            className="w-full flex items-center gap-3 px-3 py-3 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 text-left transition-colors"
          >
            {p.imagen ? (
              <img src={p.imagen} alt={p.nombre} className="w-10 h-10 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
                <Music className="w-5 h-5 text-slate-500" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{p.nombre}</div>
              <div className="text-[10px] text-slate-400">{p.total} canciones</div>
            </div>
            <Play className="w-4 h-4 text-slate-500 shrink-0" />
          </button>
        ))}

        {playlistsCargando && (
          <div className="p-3 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando tus playlists…
          </div>
        )}
        {!playlistsCargando && playlists.length === 0 && (
          <div className="p-4 text-center text-[11px] text-slate-500">No se encontraron playlists en tu cuenta</div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ▶️ YOUTUBE
// ═══════════════════════════════════════════════════════════
const TabYouTube: React.FC = () => {
  const m = useMedios();
  const { youtube } = m;
  const [url, setUrl] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [favoritos, setFavoritos] = useState<VideoFavorito[]>([]);
  const [yaGuardado, setYaGuardado] = useState(false);

  useEffect(() => {
    setFavoritos(leerFavoritosYT());
  }, []);

  useEffect(() => {
    setYaGuardado(!!youtube.videoId && favoritos.some((f) => f.id === youtube.videoId));
  }, [youtube.videoId, favoritos]);

  const tocar = () => {
    setErrorLocal(null);
    if (!url.trim()) { setErrorLocal('Pega un link de YouTube primero'); return; }
    const ok = m.youtubeTocar(url.trim());
    if (!ok) setErrorLocal('No reconocí ese link — copia el enlace con el botón "Compartir" de YouTube');
  };

  const guardarActual = () => {
    if (!youtube.videoId) return;
    const nuevos = [
      { id: youtube.videoId, titulo: youtube.titulo || 'Video de YouTube', agregadoEn: Date.now() },
      ...favoritos.filter((f) => f.id !== youtube.videoId),
    ];
    setFavoritos(nuevos);
    guardarFavoritosYT(nuevos);
  };

  const borrarFav = (id: string) => {
    const nuevos = favoritos.filter((f) => f.id !== id);
    setFavoritos(nuevos);
    guardarFavoritosYT(nuevos);
  };

  return (
    <div className="space-y-3">
      {/* Pegar link */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 space-y-3">
        <div className="text-xs font-black text-white flex items-center gap-1.5">
          <Youtube className="w-4 h-4 text-red-500" /> Toca un video o música
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setErrorLocal(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') tocar(); }}
              placeholder="https://youtu.be/… o youtube.com/watch?v=…"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500"
            />
          </div>
          <button
            onClick={tocar}
            className="px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
          >
            <Play className="w-3.5 h-3.5" /> Tocar
          </button>
        </div>
        {errorLocal && <div className="text-[11px] text-amber-400">{errorLocal}</div>}
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Pega el enlace que te da el botón “Compartir” de YouTube. El video sale en una
          ventana flotante (abajo a la derecha) y sigue sonando mientras usas la app.
        </p>
      </div>

      {/* Video activo */}
      {youtube.videoId && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 ${youtube.reproduciendo ? 'animate-pulse' : ''}`}>
              <Youtube className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{youtube.titulo || 'Cargando…'}</div>
              <div className="text-[10px] text-slate-400">{youtube.reproduciendo ? 'Sonando en la ventana flotante' : 'Pausado'}</div>
            </div>
            <button
              onClick={m.youtubeToggle}
              className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center active:scale-95 transition-all shrink-0"
            >
              {youtube.reproduciendo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              onClick={guardarActual}
              className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 ${
                yaGuardado ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={yaGuardado ? 'Guardado en favoritos' : 'Guardar en favoritos'}
            >
              {yaGuardado ? <Check className="w-4 h-4" /> : <Star className="w-4 h-4" />}
            </button>
            <button
              onClick={m.youtubeDetener}
              className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all shrink-0"
              title="Cerrar video"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>
          {youtube.error && <div className="text-[11px] text-amber-400">{youtube.error}</div>}
        </div>
      )}

      {/* Favoritos */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-700/50 text-xs font-black text-white flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-amber-400" /> Tus favoritos
        </div>
        {favoritos.length === 0 && (
          <div className="p-4 text-center text-[11px] text-slate-500">
            Aún no guardas videos — toca uno y pícale ⭐ para tenerlo siempre a mano
          </div>
        )}
        {favoritos.map((f) => {
          const esActual = youtube.videoId === f.id;
          return (
            <div key={f.id} className={`flex items-center gap-3 px-3 py-3 border-b border-slate-700/50 last:border-0 ${esActual ? 'bg-red-500/10' : 'hover:bg-slate-700/30'}`}>
              <button onClick={() => m.youtubeTocar(f.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                  <Youtube className="w-5 h-5 text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{f.titulo}</div>
                  {esActual && youtube.reproduciendo && <div className="text-[9px] text-red-300 font-black">SONANDO</div>}
                </div>
                <Play className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
              <button
                onClick={() => borrarFav(f.id)}
                className="w-8 h-8 rounded-lg bg-slate-900/50 hover:bg-red-500/20 text-slate-500 hover:text-red-400 flex items-center justify-center shrink-0"
                title="Quitar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
