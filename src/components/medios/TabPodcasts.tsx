// ═══════════════════════════════════════════════════════════
// 🎧 PODCASTS RSS — TAB DE MEDIOS (Fase 3.43)
// Los podcasts de verdad, pensados para tus novelas:
//   · Buscador (iTunes — sin cuenta ni pago) o pegando la URL
//     del RSS
//   · 🗂️ CATEGORÍAS para explorar (F3.45): 7 géneros con feeds
//     verificados a la carta + lo más escuchado en vivo
//   · Tus suscripciones + lista de episodios con NUEVOS
//   · Reproduce en el MISMO player de la app (mini-reproductor
//     abajo, como la radio y Spotify)
//   · Velocidad variable (1×–3×) — oro puro para novelas largas
//   · Recuerda la posición de cada episodio (sigues donde ibas)
//   · Descarga episodios y escúchalos SIN GASTAR DATOS
//
// La lógica vive en services/podcastRSS.ts + utils/podcastRssCore.
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Podcast as PodcastIcon, Search, Play, Pause, Download, Trash2, Loader2,
  RotateCcw, RotateCw, Gauge, ArrowLeft, RefreshCw, Rss, Link2, Check,
  Info, Square, LayoutGrid, TrendingUp, BadgeCheck,
} from 'lucide-react';
import { useMedios } from './MediosProvider';
import {
  EpisodioRSS,
  buscarPodcastsRSS,
  agregarSuscripcionRSS,
  agregarPorURLRSS,
  quitarSuscripcionRSS,
  marcarFeedVistoRSS,
  suscripcionesRSS,
  suscribirPodcastsRSS,
  obtenerFeedRSS,
  feedCacheRSS,
  posicionDeRSS,
  posicionVivaRSS,
  duracionVivaRSS,
  descargarEpisodioRSS,
  eliminarDescargaRSS,
  refrescarDescargasRSS,
  MAX_BYTES_DESCARGA,
} from '../../services/podcastRSS';
import {
  EpisodioPodcast,
  FeedPodcast,
  ResultadoBusquedaPodcast,
  SuscripcionPodcast,
  VELOCIDADES_PODCAST,
  contarNuevos,
  formatearDuracion,
  formatearFechaEpisodio,
  formatearMB,
  formatearTiempoPlayer,
} from '../../utils/podcastRssCore';
import {
  CATEGORIAS_PODCAST,
  CategoriaPodcast,
  FeedCurado,
  FECHA_VERIFICACION_CATALOGO,
  categoriaConSeguidas,
} from '../../utils/podcastCatalogo';

type Vista =
  | { tipo: 'mis' }
  | { tipo: 'buscar' }
  | { tipo: 'episodios'; sub: SuscripcionPodcast }
  | { tipo: 'categoria'; cat: CategoriaPodcast };

/** "3 set 2026" — cuando se verificaron los feeds del catálogo */
const FECHA_CATALOGO_LABEL = new Date(FECHA_VERIFICACION_CATALOGO + 'T12:00:00')
  .toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });

// ═══════════════════════════════════════════════════════════
// 🖼️ Portada con fallback (los feeds a veces tienen imágenes rotas)
// ═══════════════════════════════════════════════════════════
const Portada: React.FC<{ src?: string; className?: string; emoji?: string }> = ({ src, className = '', emoji = '🎧' }) => {
  const [rota, setRota] = useState(false);
  return src && !rota ? (
    <img src={src} alt="" loading="lazy" onError={() => setRota(true)} className={`object-cover shrink-0 ${className}`} />
  ) : (
    <div className={`flex items-center justify-center shrink-0 bg-violet-500/15 text-violet-300 ${className}`}>{emoji}</div>
  );
};

// ═══════════════════════════════════════════════════════════
// ▶️ PLAYER — "Ahora suena" (progreso vivo cada medio segundo)
// ═══════════════════════════════════════════════════════════
const PlayerCard: React.FC = () => {
  const m = useMedios();
  const pod = m.podcast;
  const ep = pod.episodio;
  const [vivo, setVivo] = useState(() => ({ seg: pod.seg, dur: pod.durSeg }));

  // progreso vivo: se lee directo del audio (sin re-render global)
  useEffect(() => {
    setVivo({ seg: pod.seg, dur: pod.durSeg });
    if (pod.fase !== 'reproduciendo') return;
    const t = setInterval(() => setVivo({ seg: posicionVivaRSS(), dur: duracionVivaRSS() || pod.durSeg }), 500);
    return () => clearInterval(t);
  }, [pod.fase, pod.episodio?.url, pod.seg, pod.durSeg]);

  if (!ep) return null;

  const dur = Math.max(vivo.dur, 1);
  const pct = Math.min(100, (vivo.seg / dur) * 100);
  const sonando = pod.fase === 'reproduciendo';

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-600/20 to-slate-800 border border-violet-500/40 shadow-xl">
      <div className="flex items-center gap-3">
        <Portada src={ep.imagen} className="w-14 h-14 rounded-2xl border border-violet-500/30" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-violet-300 bg-violet-500/20 px-1.5 py-0.5 rounded">
              {sonando ? 'SONANDO' : pod.fase === 'cargando' ? 'CARGANDO' : pod.fase === 'error' ? 'ERROR' : 'PAUSA'}
            </span>
            {(pod.fase === 'cargando' || pod.retomoSeg > 0) && pod.fase !== 'error' && (
              <Loader2 className={`w-3 h-3 text-violet-400 ${pod.fase === 'cargando' ? 'animate-spin' : ''}`} />
            )}
          </div>
          <div className="text-sm font-black text-white truncate mt-0.5" title={ep.titulo}>{ep.titulo}</div>
          <div className="text-[11px] text-slate-400 truncate">{ep.podcastTitulo}</div>
        </div>
      </div>

      {pod.retomoSeg > 0 && (
        <div className="mt-2 text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2 py-1.5">
          ⏱️ Sigues donde lo dejaste: {formatearTiempoPlayer(pod.retomoSeg)}
        </div>
      )}

      {/* Barra de progreso */}
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={dur}
          step={1}
          value={Math.min(vivo.seg, dur)}
          onChange={(e) => m.podcastSaltar(Number(e.target.value))}
          className="w-full accent-violet-500"
          aria-label="Posición del episodio"
        />
        <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
          <span>{formatearTiempoPlayer(vivo.seg)}</span>
          <span>{vivo.dur ? formatearTiempoPlayer(vivo.dur) : formatearDuracion(ep.duracionSeg)}</span>
        </div>
      </div>

      {/* Controles */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => m.podcastSaltar(vivo.seg - 15)}
          className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex flex-col items-center justify-center active:scale-95 transition-all"
          title="Retroceder 15 s"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-[8px] font-bold">15</span>
        </button>
        <button
          onClick={m.podcastToggle}
          className="w-14 h-14 rounded-full bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-violet-600/30"
          aria-label={sonando ? 'Pausar' : 'Reproducir'}
        >
          {pod.fase === 'cargando' ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : sonando ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </button>
        <button
          onClick={() => m.podcastSaltar(vivo.seg + 15)}
          className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex flex-col items-center justify-center active:scale-95 transition-all"
          title="Adelantar 15 s"
        >
          <RotateCw className="w-4 h-4" />
          <span className="text-[8px] font-bold">15</span>
        </button>

        {/* Velocidad — lo más valioso para novelas largas */}
        <button
          onClick={() => {
            const idx = VELOCIDADES_PODCAST.findIndex((v) => v === pod.velocidad);
            const siguiente = VELOCIDADES_PODCAST[(idx + 1 + VELOCIDADES_PODCAST.length) % VELOCIDADES_PODCAST.length];
            m.podcastVelocidad(siguiente);
          }}
          className="ml-auto px-3 h-10 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-black text-sm tabular-nums flex items-center gap-1.5 active:scale-95 transition-all"
          title="Velocidad de reproducción"
        >
          <Gauge className="w-4 h-4" />
          {pod.velocidad}×
        </button>

        <button
          onClick={m.podcastDetener}
          className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all"
          title="Cerrar episodio (guarda tu posición)"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>

      {pod.error && <div className="mt-2 text-[11px] text-amber-400">{pod.error}</div>}

      <div className="mt-2 text-[9px] text-slate-500 text-center">
        La velocidad y tu posición quedan guardadas aunque cierres la app
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 🔍 FILA DE EPISODIO
// ═══════════════════════════════════════════════════════════
interface FilaProps {
  ep: EpisodioPodcast;
  podcastTitulo: string;
  imagen: string;
  feedUrl: string;
  esActual: boolean;
  sonando: boolean;
  descarga?: 'bajando' | 'lista';
  alTocar: (ep: EpisodioRSS) => void;
  alToggle: () => void;
}

const FilaEpisodio: React.FC<FilaProps> = ({ ep, podcastTitulo, imagen, feedUrl, esActual, sonando, descarga, alTocar, alToggle }) => {
  const [bajando, setBajando] = useState(false);
  const [errDl, setErrDl] = useState<string | null>(null);
  const pos = posicionDeRSS(ep.url);
  const terminado = !!pos?.fin;
  const pct = pos && pos.durSeg > 0 ? Math.min(100, (pos.seg / pos.durSeg) * 100) : 0;

  const episodioRSS = (): EpisodioRSS => ({ ...ep, feedUrl, podcastTitulo, imagen });

  const descargar = async () => {
    if (descarga === 'bajando' || bajando) return;
    if (descarga === 'lista') return; // ya está
    setBajando(true);
    setErrDl(null);
    try {
      await descargarEpisodioRSS(episodioRSS());
    } catch (e: any) {
      setErrDl(e?.message || 'No se pudo descargar');
    } finally {
      setBajando(false);
    }
  };

  const borrarDescarga = async () => {
    await eliminarDescargaRSS(ep.url);
  };

  return (
    <div className={`px-3 py-2.5 border-b border-slate-700/40 last:border-0 transition-colors ${esActual ? 'bg-violet-500/10' : 'hover:bg-slate-700/30'}`}>
      <div className="flex items-center gap-2.5">
        {/* Play / Pausa */}
        <button
          onClick={() => (esActual ? alToggle() : alTocar(episodioRSS()))}
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-all ${
            esActual ? 'bg-violet-600 text-white' : 'bg-slate-700/60 text-violet-300 hover:bg-violet-600/40'
          }`}
          aria-label={esActual && sonando ? 'Pausar' : 'Reproducir'}
        >
          {esActual && sonando ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Datos */}
        <button onClick={() => (esActual ? alToggle() : alTocar(episodioRSS()))} className="min-w-0 flex-1 text-left">
          <div className={`text-xs font-bold truncate ${esActual ? 'text-white' : 'text-slate-200'} ${terminado ? 'opacity-60' : ''}`}>
            {terminado && <span className="text-emerald-400 mr-1">✓</span>}
            {ep.titulo}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
            {ep.fechaPub > 0 && <span>{formatearFechaEpisodio(ep.fechaPub)}</span>}
            {ep.duracionSeg > 0 && <span>· {formatearDuracion(ep.duracionSeg)}</span>}
            {pos && !terminado && pos.durSeg > 0 && pos.seg > 30 && (
              <span className="text-violet-300">· quedan {formatearDuracion(pos.durSeg - pos.seg)}</span>
            )}
          </div>
          {/* progreso guardado */}
          {pct > 1 && (
            <div className="mt-1 h-1 rounded-full bg-slate-700/60 overflow-hidden">
              <div className={`h-full ${terminado ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${terminado ? 100 : pct}%` }} />
            </div>
          )}
        </button>

        {/* Descarga (offline — sin datos) */}
        <div className="shrink-0 flex items-center gap-1">
          {descarga === 'bajando' || bajando ? (
            <div className="w-8 h-8 flex items-center justify-center" title="Descargando…">
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            </div>
          ) : descarga === 'lista' ? (
            <>
              <span className="text-[9px] font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Download className="w-2.5 h-2.5" /> OFF
              </span>
              <button
                onClick={borrarDescarga}
                className="w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 flex items-center justify-center"
                title="Borrar la descarga (libera espacio)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={descargar}
              className="w-8 h-8 rounded-lg text-slate-500 hover:text-amber-300 flex items-center justify-center"
              title={ep.tamanoBytes ? `Descargar para escuchar sin datos (${formatearMB(ep.tamanoBytes)})` : 'Descargar para escuchar sin datos'}
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {errDl && <div className="mt-1 text-[10px] text-amber-400 pl-12">⚠️ {errDl}</div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 🗂️ FILA DE CATÁLOGO — feed curado o resultado en vivo
// (misma anatomía que los resultados del buscador, + eps/idioma)
// ═══════════════════════════════════════════════════════════
interface FilaCatalogoProps {
  imagen?: string;
  emoji: string;
  titulo: string;
  sub: string;
  eps?: number;
  ingles?: boolean;
  yaSigue: boolean;
  cargando: boolean;
  alSeguir: () => void;
  alAbrir: () => void;
}

const FilaCatalogo: React.FC<FilaCatalogoProps> = ({ imagen, emoji, titulo, sub, eps, ingles, yaSigue, cargando, alSeguir, alAbrir }) => (
  <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-700/40 last:border-0 hover:bg-slate-700/30 transition-colors">
    <Portada src={imagen} emoji={emoji} className="w-10 h-10 rounded-lg border border-slate-700" />
    <div className="min-w-0 flex-1">
      <div className="text-xs font-bold text-white truncate">{titulo}</div>
      <div className="text-[10px] text-slate-400 line-clamp-2 leading-snug">{sub}</div>
      {(eps || ingles) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {!!eps && eps > 0 && (
            <span className="text-[9px] font-bold text-violet-300">▶ {eps} episodios</span>
          )}
          {ingles && (
            <span className="text-[9px] font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1 py-0.5 rounded">INGLÉS</span>
          )}
        </div>
      )}
    </div>
    {yaSigue ? (
      <button
        onClick={alAbrir}
        className="text-[9px] font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1.5 rounded flex items-center gap-1 shrink-0 hover:bg-emerald-500/25 active:scale-95 transition-all"
        title="Ya lo sigues — toca para ver sus episodios"
      >
        <Check className="w-3 h-3" /> SIGUES
      </button>
    ) : (
      <button
        onClick={alSeguir}
        disabled={cargando}
        className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 disabled:opacity-50 active:scale-95 transition-all"
      >
        {cargando ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        Seguir
      </button>
    )}
  </div>
);

// 🎧 TAB PRINCIPAL
// ═══════════════════════════════════════════════════════════
export const TabPodcasts: React.FC = () => {
  const m = useMedios();
  const pod = m.podcast;
  const [vista, setVista] = useState<Vista>({ tipo: 'mis' });
  const [subs, setSubs] = useState<SuscripcionPodcast[]>(() => suscripcionesRSS());

  // re-render cuando el servicio cambia (subs guardadas, etc.)
  useEffect(() => {
    const off = suscribirPodcastsRSS(() => setSubs(suscripcionesRSS()));
    return off;
  }, []);

  // ── buscador ──
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusquedaPodcast[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errBuscar, setErrBuscar] = useState<string | null>(null);
  const [seguirCargando, setSeguirCargando] = useState<string | null>(null);

  // ── categorías (F3.45) ──
  const catAbierta = vista.tipo === 'categoria' ? vista.cat : null;
  const [catResultados, setCatResultados] = useState<ResultadoBusquedaPodcast[] | null>(null);
  const [catCargando, setCatCargando] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const catIdRef = useRef<string | null>(null);

  /** busca en iTunes lo más escuchado del término de la categoría */
  const cargarMasEscuchado = async (cat: CategoriaPodcast) => {
    catIdRef.current = cat.id;
    setCatResultados(null);
    setCatError(null);
    setCatCargando(true);
    try {
      const res = await buscarPodcastsRSS(cat.termino);
      if (catIdRef.current !== cat.id) return; // cambió de categoría mientras buscaba
      setCatResultados(res);
    } catch {
      if (catIdRef.current === cat.id) setCatError('No se pudo cargar — revisa tu conexión');
    } finally {
      if (catIdRef.current === cat.id) setCatCargando(false);
    }
  };

  useEffect(() => {
    if (catAbierta) void cargarMasEscuchado(catAbierta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catAbierta?.id]);

  /** seguir un feed del catálogo curado (mismo flujo que el buscador) */
  const seguirCurado = async (f: FeedCurado, cat: CategoriaPodcast) => {
    if (seguirCargando) return;
    setSeguirCargando(f.url);
    setCatError(null);
    try {
      agregarSuscripcionRSS({ feedUrl: f.url, titulo: f.titulo, autor: cat.nombre, imagen: f.imagen || '' });
      setSubs(suscripcionesRSS());
      await abrirFeed({ feedUrl: f.url, titulo: f.titulo, autor: cat.nombre, imagen: f.imagen || '', agregadoAt: 0, ultimoVistoAt: 0 });
    } catch (err: any) {
      setCatError(err?.message || 'No se pudo seguir ese podcast — prueba otro de la carta');
    } finally {
      setSeguirCargando(null);
    }
  };

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setBuscando(true);
    setErrBuscar(null);
    setResultados(null);
    try {
      const res = await buscarPodcastsRSS(q);
      setResultados(res);
      if (!res.length) setErrBuscar('Sin resultados — prueba otras palabras o pega la URL del RSS abajo');
    } catch {
      setErrBuscar('No se pudo buscar — revisa tu conexión');
    } finally {
      setBuscando(false);
    }
  };

  const seguirResultado = async (r: ResultadoBusquedaPodcast) => {
    if (seguirCargando) return;
    setSeguirCargando(r.feedUrl);
    try {
      agregarSuscripcionRSS(r);
      setSubs(suscripcionesRSS());
      // intenta abrir el feed ya (si falla, la sub queda igual)
      await abrirFeed({ ...r, agregadoAt: 0, ultimoVistoAt: 0 });
    } catch (err: any) {
      setErrBuscar(err?.message || 'No se pudo seguir ese podcast');
    } finally {
      setSeguirCargando(null);
    }
  };

  // ── pegar URL ──
  const [urlPegada, setUrlPegada] = useState('');
  const [agregandoUrl, setAgregandoUrl] = useState(false);
  const [errUrl, setErrUrl] = useState<string | null>(null);
  const [modoUrl, setModoUrl] = useState(false);

  const seguirURL = async () => {
    const url = urlPegada.trim();
    if (!url || agregandoUrl) return;
    setAgregandoUrl(true);
    setErrUrl(null);
    try {
      const { sub } = await agregarPorURLRSS(url);
      setUrlPegada('');
      setSubs(suscripcionesRSS());
      await abrirFeed(sub);
    } catch (err: any) {
      setErrUrl(err?.message || 'No se pudo leer ese RSS — revisa la URL');
    } finally {
      setAgregandoUrl(false);
    }
  };

  // ── feed abierto ──
  const [feed, setFeed] = useState<FeedPodcast | null>(null);
  const [feedCargando, setFeedCargando] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'sin-escuchar' | 'off'>('todos');

  const abrirFeed = async (sub: SuscripcionPodcast, forzar = false) => {
    setVista({ tipo: 'episodios', sub });
    setFeed(null);
    setFeedError(null);
    setFiltro('todos');
    setFeedCargando(true);
    try {
      const f = await obtenerFeedRSS(sub.feedUrl, forzar);
      setFeed(f);
      marcarFeedVistoRSS(sub.feedUrl);
      setSubs(suscripcionesRSS());
      void refrescarDescargasRSS(f.episodios.slice(0, 80).map((x) => x.url));
    } catch (err: any) {
      setFeedError(err?.message || 'No se pudo cargar el feed — revisa tu conexión');
    } finally {
      setFeedCargando(false);
    }
  };

  const subAbierta = vista.tipo === 'episodios' ? vista.sub : null;

  const episodiosFiltrados = useMemo(() => {
    if (!feed) return [];
    if (filtro === 'sin-escuchar') return feed.episodios.filter((ep) => !posicionDeRSS(ep.url)?.fin);
    if (filtro === 'off') return feed.episodios.filter((ep) => pod.descargas[ep.url] === 'lista');
    return feed.episodios;
  }, [feed, filtro, pod.descargas, vista.tipo]);

  const alTocar = useCallback((ep: EpisodioRSS) => { m.podcastTocar(ep); }, [m]);
  const alToggle = useCallback(() => { m.podcastToggle(); }, [m]);

  // ═══════════════ VISTA EPISODIOS ═══════════════
  if (vista.tipo === 'episodios' && subAbierta) {
    return (
      <div className="space-y-3">
        <PlayerCard />

        {/* encabezado del podcast */}
        <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
          <div className="flex items-center gap-3 p-3 bg-slate-800/80">
            <button
              onClick={() => { setVista({ tipo: 'mis' }); setFeed(null); }}
              className="w-9 h-9 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 active:scale-95 transition-all"
              title="Volver a mis podcasts"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Portada src={feed?.imagen || subAbierta.imagen} className="w-12 h-12 rounded-xl border border-slate-600" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white truncate">{feed?.titulo || subAbierta.titulo}</div>
              <div className="text-[10px] text-slate-400 truncate">{feed?.autor || subAbierta.autor || '—'}</div>
              <div className="text-[10px] text-slate-500">
                {feed ? `${feed.episodios.length} episodios` : 'cargando…'}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => abrirFeed(subAbierta, true)}
                disabled={feedCargando}
                className="w-9 h-9 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
                title="Refrescar episodios"
              >
                <RefreshCw className={`w-4 h-4 ${feedCargando ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => {
                  quitarSuscripcionRSS(subAbierta.feedUrl);
                  setSubs(suscripcionesRSS());
                  setVista({ tipo: 'mis' });
                  setFeed(null);
                }}
                className="w-9 h-9 rounded-xl bg-slate-700/60 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center active:scale-95 transition-all"
                title="Dejar de seguir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* filtros */}
          <div className="flex gap-1.5 px-3 py-2 border-t border-slate-700/50 bg-slate-900/40">
            {([
              { id: 'todos', label: `Todos${feed ? ` (${feed.episodios.length})` : ''}` },
              { id: 'sin-escuchar', label: 'Sin escuchar' },
              { id: 'off', label: 'Descargados' },
            ] as const).map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  filtro === f.id
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* episodios */}
          {feedCargando && !feed && (
            <div className="p-8 flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              <div className="text-xs">Cargando episodios…</div>
            </div>
          )}
          {feedError && !feed && (
            <div className="p-5 text-center text-xs text-amber-400">
              ⚠️ {feedError}
              <button onClick={() => abrirFeed(subAbierta, true)} className="block mx-auto mt-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                Reintentar
              </button>
            </div>
          )}
          {feed && episodiosFiltrados.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500">
              {filtro === 'sin-escuchar' ? '🎉 ¡Escuchaste todo!' : filtro === 'off' ? 'Sin descargas todavía — toca ⬇ en un episodio' : 'Este feed no tiene episodios'}
            </div>
          )}
          {feed && episodiosFiltrados.map((ep) => (
            <FilaEpisodio
              key={ep.guid + ep.url}
              ep={ep}
              podcastTitulo={feed.titulo}
              imagen={feed.imagen || subAbierta.imagen}
              feedUrl={subAbierta.feedUrl}
              esActual={pod.episodio?.url === ep.url}
              sonando={pod.fase === 'reproduciendo'}
              descarga={pod.descargas[ep.url]}
              alTocar={alTocar}
              alToggle={alToggle}
            />
          ))}
        </div>

        <p className="text-[10px] text-slate-500 text-center px-2">
          Toca ⬇ para descargar y escuchar sin datos · el ✓ verde marca lo escuchado · la barra violeta es dónde quedaste
        </p>
      </div>
    );
  }

  // ═══════════════ VISTA CATEGORÍA (F3.45) ═══════════════
  if (catAbierta) {
    const seguidasUrls = subs.map((s) => s.feedUrl);
    const abrirSub = (url: string) => {
      const s = subs.find((x) => x.feedUrl === url);
      if (s) void abrirFeed(s);
    };
    return (
      <div className="space-y-3">
        <PlayerCard />

        {/* encabezado de la categoría */}
        <div className="rounded-2xl bg-gradient-to-br from-violet-600/15 to-slate-800 border border-violet-500/30 p-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setVista({ tipo: 'mis' }); setFeed(null); setCatResultados(null); setCatError(null); }}
              className="w-9 h-9 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 active:scale-95 transition-all"
              title="Volver a mis podcasts"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-2xl shrink-0">
              {catAbierta.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white truncate">{catAbierta.nombre}</div>
              <div className="text-[11px] text-slate-300 leading-snug">{catAbierta.descripcion}</div>
            </div>
          </div>
        </div>

        {/* A LA CARTA — verificados uno por uno */}
        <div>
          <div className="flex items-center gap-1.5 px-1 pb-1.5">
            <BadgeCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black text-white">A la carta</span>
            <span className="text-[10px] text-slate-500">revisados el {FECHA_CATALOGO_LABEL}</span>
          </div>
          <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
            {catAbierta.feeds.map((f) => (
              <FilaCatalogo
                key={f.url}
                imagen={f.imagen}
                emoji={catAbierta.emoji}
                titulo={f.titulo}
                sub={f.nota}
                eps={f.eps}
                ingles={f.idioma === 'en'}
                yaSigue={seguidasUrls.includes(f.url)}
                cargando={seguirCargando === f.url}
                alSeguir={() => void seguirCurado(f, catAbierta)}
                alAbrir={() => abrirSub(f.url)}
              />
            ))}
          </div>
        </div>

        {/* LO MÁS ESCUCHADO — búsqueda viva en iTunes */}
        <div>
          <div className="flex items-center gap-1.5 px-1 pb-1.5">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-black text-white">Lo más escuchado</span>
            <span className="text-[10px] text-slate-500 truncate">«{catAbierta.termino}»</span>
          </div>
          <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
            {catCargando && (
              <div className="p-6 flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                <div className="text-xs">Buscando en iTunes…</div>
              </div>
            )}
            {!catCargando && catError && (
              <div className="p-4 text-center text-xs text-amber-400">
                ⚠️ {catError}
                <button
                  onClick={() => void cargarMasEscuchado(catAbierta)}
                  className="block mx-auto mt-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold"
                >
                  Reintentar
                </button>
              </div>
            )}
            {!catCargando && !catError && catResultados && catResultados.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500">
                Sin resultados ahora — arriba tienes los verificados a la carta
              </div>
            )}
            {!catCargando && catResultados && catResultados.map((r) => (
              <FilaCatalogo
                key={r.feedUrl}
                imagen={r.imagen}
                emoji={catAbierta.emoji}
                titulo={r.titulo}
                sub={[r.autor, r.genero].filter(Boolean).join(' · ')}
                yaSigue={seguidasUrls.includes(r.feedUrl)}
                cargando={seguirCargando === r.feedUrl}
                alSeguir={() => void seguirResultado(r)}
                alAbrir={() => abrirSub(r.feedUrl)}
              />
            ))}
          </div>
        </div>

        {/* saltar al buscador con el término de la categoría */}
        <button
          onClick={() => { setVista({ tipo: 'mis' }); setQuery(catAbierta.termino); void buscarPorTexto(catAbierta.termino); }}
          className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-700/60 active:scale-[0.99] transition-all"
        >
          <Search className="w-4 h-4" />
          Buscar más «{catAbierta.termino}» con la lupa
        </button>

        <p className="text-[10px] text-slate-500 text-center px-2 leading-relaxed">
          <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
          Los «a la carta» se verificaron uno por uno el {FECHA_CATALOGO_LABEL}; «lo más escuchado»
          viene vivo de iTunes y siempre trae podcasts nuevos.
        </p>
      </div>
    );
  }

  // ═══════════════ VISTA BUSCAR ═══════════════
  return (
    <div className="space-y-3">
      <PlayerCard />

      {/* buscador + URL */}
      <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 space-y-2.5">
        <form onSubmit={buscar} className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar novelas, audiolibros, podcasts…"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
          />
        </form>

        {buscando && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" /> Buscando…
          </div>
        )}
        {errBuscar && !buscando && <div className="text-[11px] text-amber-400 text-center">{errBuscar}</div>}

        {/* resultados */}
        {resultados && !buscando && (
          <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 overflow-hidden">
            {resultados.map((r) => {
              const yaSigue = subs.some((s) => s.feedUrl === r.feedUrl);
              return (
                <div key={r.feedUrl} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-700/40 last:border-0">
                  <Portada src={r.imagen} className="w-10 h-10 rounded-lg border border-slate-700" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">{r.titulo}</div>
                    <div className="text-[10px] text-slate-400 truncate">{r.autor}{r.genero ? ` · ${r.genero}` : ''}</div>
                  </div>
                  {yaSigue ? (
                    <span className="text-[9px] font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded flex items-center gap-1 shrink-0">
                      <Check className="w-3 h-3" /> SIGUES
                    </span>
                  ) : (
                    <button
                      onClick={() => seguirResultado(r)}
                      disabled={seguirCargando === r.feedUrl}
                      className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {seguirCargando === r.feedUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Seguir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* pegar URL del RSS */}
        <button
          onClick={() => { setModoUrl((v) => !v); setErrUrl(null); }}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white transition-colors"
        >
          <Rss className="w-3.5 h-3.5" />
          {modoUrl ? 'Ocultar' : '¿Tienes la URL del RSS? Pégala aquí'}
        </button>
        {modoUrl && (
          <div className="space-y-2">
            <div className="relative">
              <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={urlPegada}
                onChange={(e) => setUrlPegada(e.target.value)}
                placeholder="https://…/feed.xml"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
              />
            </div>
            <button
              onClick={seguirURL}
              disabled={!urlPegada.trim() || agregandoUrl}
              className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
            >
              {agregandoUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rss className="w-4 h-4" />}
              Seguir este RSS
            </button>
            {errUrl && <div className="text-[11px] text-amber-400 text-center">{errUrl}</div>}
          </div>
        )}
      </div>

      {/* CATEGORÍAS — explorar la biblioteca (F3.45) */}
      <div>
        <div className="flex items-center gap-2 px-1 pb-1.5">
          <LayoutGrid className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-black text-white">Explorar por categorías</span>
          <span className="text-[10px] text-slate-500">({CATEGORIAS_PODCAST.length})</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1">
          {CATEGORIAS_PODCAST.map((c) => {
            const conSeguidas = categoriaConSeguidas(c.id, subs.map((s) => s.feedUrl));
            return (
              <button
                key={c.id}
                onClick={() => setVista({ tipo: 'categoria', cat: c })}
                className="shrink-0 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/25 text-violet-200 text-[11px] font-bold hover:bg-violet-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                title={c.descripcion}
              >
                <span className="text-sm leading-none">{c.emoji}</span>
                {c.nombre}
                {conSeguidas && <Check className="w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* MIS PODCASTS */}
      <div>
        <div className="flex items-center gap-2 px-1 pb-1.5">
          <PodcastIcon className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-black text-white">Mis podcasts</span>
          <span className="text-[10px] text-slate-500">({subs.length})</span>
        </div>

        {subs.length === 0 ? (
          <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-600/15 to-slate-800 border border-violet-500/30 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <PodcastIcon className="w-8 h-8 text-violet-300" />
            </div>
            <div>
              <div className="text-base font-black text-white">Podcasts para tus novelas 📖🎧</div>
              <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed max-w-xs mx-auto">
                Listas públicas de episodios (RSS) — <b>sin cuenta ni pago</b>. Lo que ya escuchas en Spotify
                sigue ahí; aquí ganas <b>velocidad 2×</b>, <b>recuerda dónde quedaste</b> y <b>descargas para
                escuchar sin datos</b>.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {['novela audio', 'audiolibro español', 'ciencia ficción', 'cuento'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); void buscarPorTexto(s); }}
                  className="px-2.5 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[10px] font-bold hover:bg-violet-500/25 active:scale-95 transition-all"
                >
                  🔍 {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
            {subs.map((s) => {
              const cacheFeed = feedCacheRSS(s.feedUrl);
              const nuevos = cacheFeed ? contarNuevos(cacheFeed.episodios, s.ultimoVistoAt) : 0;
              const esActual = pod.episodio?.feedUrl === s.feedUrl;
              return (
                <button
                  key={s.feedUrl}
                  onClick={() => abrirFeed(s)}
                  className={`w-full flex items-center gap-3 px-3 py-3 border-b border-slate-700/50 last:border-0 text-left transition-colors ${
                    esActual ? 'bg-violet-500/10' : 'hover:bg-slate-700/30'
                  }`}
                >
                  <Portada src={s.imagen} className="w-11 h-11 rounded-xl border border-slate-600" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">{s.titulo}</div>
                    <div className="text-[10px] text-slate-400 truncate">{s.autor || 'Podcast'}</div>
                  </div>
                  {nuevos > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-black rounded-full border bg-violet-500/20 text-violet-300 border-violet-500/40 shrink-0">
                      {nuevos} NUEVO{nuevos > 1 ? 'S' : ''}
                    </span>
                  )}
                  {esActual && pod.fase === 'reproduciendo' && (
                    <span className="text-[9px] text-violet-300 font-black shrink-0">SONANDO</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-500 text-center px-2 leading-relaxed">
        <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
        Busca con la lupa, toca una categoría o pega la URL del RSS · máx. {formatearMB(MAX_BYTES_DESCARGA)} por descarga
      </p>
    </div>
  );

  // helper: búsqueda desde un chip (sin depender del estado del input)
  async function buscarPorTexto(q: string) {
    setBuscando(true);
    setErrBuscar(null);
    setResultados(null);
    try {
      const res = await buscarPodcastsRSS(q);
      setResultados(res);
      if (!res.length) setErrBuscar('Sin resultados — prueba otras palabras');
    } catch {
      setErrBuscar('No se pudo buscar — revisa tu conexión');
    } finally {
      setBuscando(false);
    }
  }
};
