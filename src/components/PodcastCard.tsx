// ═══════════════════════════════════════════════════════════
// 🎙️ EL PODCAST DE TU JORNADA — UI (Fase 3.42 · paso 6 FINAL)
// "Tu día (y tu semana), contados como un programa de radio".
// Dos piezas (patrón F3.39/3.40/3.41):
//   · PodcastCard → el REPRODUCTOR completo: episodio de hoy /
//     de la semana, capítulos, barra de progreso, velocidad,
//     pausa que retoma por la frase, salto de capítulo. Vive
//     en el MODAL del menú hamburguesa ☰, sección Jornada.
//   · PodcastMenuBoton → botón del menú ☰ igual a los demás
//     (icono + "Podcast" + badge: AL AIRE / PAUSA / ~min).
//
// La voz es la del teléfono (el mismo TTS nativo de la
// navegación). Los NÚMEROS salen del mismo ResumenDia del
// resumen de WhatsApp (F3.41) — imposible que digan distinto.
// Cero motores nuevos: el guion se arma con data viva y el
// reproductor es el único servicio nuevo (services/podcast.ts).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import {
  Podcast as PodcastIcon,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Loader2,
  ChevronDown,
  ChevronUp,
  Radio,
} from 'lucide-react';
import { useResumenCaja } from './CajaCard';
import { useResumenDiario } from './ResumenDiarioCard';
import {
  snapshotCaja,
  suscribirCaja,
} from '../services/caja';
import {
  snapshotOdometro,
  suscribirOdometro,
  diasUltimosKm,
} from '../services/odometro';
import {
  snapshotMantenimiento,
  suscribirMantenimiento,
} from '../services/mantenimiento';
import { evaluarLista, resumenMant } from '../utils/mantenimientoCore';
import { armarResumenDia } from '../utils/resumenCore';
import {
  DiaKm,
  GuionPodcast,
  MotoLite,
  armarGuionHoy,
  armarGuionSemana,
  duracionEstimadaSeg,
  estimarSegundos,
} from '../utils/podcastCore';
import {
  EstadoPodcast,
  detenerPodcast,
  fijarRatePodcast,
  pausarPodcast,
  reanudarPodcast,
  reproducirGuion,
  saltarASegmento,
  snapshotPodcast,
  suscribirPodcast,
} from '../services/podcast';
// F3.43: si está sonando un episodio RSS, se pausa cortésmente
import { pausarEpisodioRSS } from '../services/podcastRSS';

type OnShowToast = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

// ── Hooks de data ─────────────────────────────────────────

/** El reproductor (estado vivo del servicio) */
function usePodcast(): EstadoPodcast {
  const [pod, setPod] = useState<EstadoPodcast>(() => snapshotPodcast());
  useEffect(() => {
    setPod(snapshotPodcast());
    return suscribirPodcast(() => setPod(snapshotPodcast()));
  }, []);
  return pod;
}

/** Mantenimiento simplificado para el capítulo "La moto" */
function useMotoLite(): MotoLite | null {
  const [mant, setMant] = useState(() => snapshotMantenimiento());
  const [odo, setOdo] = useState(() => snapshotOdometro());
  useEffect(() => {
    setMant(snapshotMantenimiento());
    setOdo(snapshotOdometro());
    const a = suscribirMantenimiento(() => setMant(snapshotMantenimiento()));
    const b = suscribirOdometro(() => setOdo(snapshotOdometro()));
    return () => {
      a();
      b();
    };
  }, []);

  return useMemo<MotoLite | null>(() => {
    const items = mant?.items;
    if (!items || Object.keys(items).length === 0) return null;
    const kmTotal = Math.round((odo?.totalM || 0) / 1000);
    try {
      const evals = evaluarLista(items, mant.estados, kmTotal, Date.now());
      const r = resumenMant(evals);
      const lite = (x: any) => ({
        nombre: String(x?.nombre || ''),
        kmRestantes: x?.kmRestantes ?? null,
        diasRestantes: x?.diasRestantes ?? null,
      });
      return {
        vencidos: (r.vencidos || []).map(lite),
        porVencer: (r.acerca || []).map(lite),
        proximo: r.proximo ? lite(r.proximo) : null,
      };
    } catch {
      return null;
    }
  }, [mant, odo]);
}

/** Episodio de HOY (versión completa: crono + refri + moto) */
export function useGuionHoy(uid?: string | null, riderNombre?: string): {
  guion: GuionPodcast | null;
  cierreHoy: ReturnType<typeof useResumenDiario>['cierreHoy'];
  cargando: boolean;
} {
  const { resumen, cierreHoy, cargando } = useResumenDiario(uid, riderNombre);
  const moto = useMotoLite();
  const guion = useMemo(
    () => (cargando ? null : armarGuionHoy(resumen, cierreHoy, riderNombre, moto)),
    [resumen, cierreHoy, riderNombre, moto, cargando]
  );
  return { guion, cierreHoy, cargando };
}

/** Episodio de la SEMANA (cierres de caja + km del odómetro) */
export function useGuionSemana(uid?: string | null, riderNombre?: string): GuionPodcast {
  const [caja, setCaja] = useState(() => snapshotCaja());
  const [odoTick, setOdoTick] = useState(() => snapshotOdometro());
  useEffect(() => {
    setCaja(snapshotCaja());
    setOdoTick(snapshotOdometro());
    const a = suscribirCaja(() => setCaja(snapshotCaja()));
    const b = suscribirOdometro(() => setOdoTick(snapshotOdometro()));
    return () => {
      a();
      b();
    };
  }, [uid]);

  const diasKm = useMemo<DiaKm[]>(() => {
    try {
      return diasUltimosKm(7);
    } catch {
      return [];
    }
  }, [odoTick]);

  return useMemo(
    () => armarGuionSemana(caja?.cierres || [], diasKm, riderNombre),
    [caja, diasKm, riderNombre]
  );
}

// ── Formato ───────────────────────────────────────────────

function fmtMinSeg(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const RATES = [0.8, 1.0, 1.15, 1.3];

// ═══════════════════════════════════════════════════════════
// 🎛️ REPRODUCTOR COMPLETO (vive en el modal del menú ☰)
// ═══════════════════════════════════════════════════════════

interface PodcastCardProps {
  uid?: string | null;
  riderName?: string;
  onShowToast?: OnShowToast;
}

export const PodcastCard: React.FC<PodcastCardProps> = ({ uid, riderName }) => {
  const [tipo, setTipo] = useState<'hoy' | 'semana'>('hoy');
  const [verGuion, setVerGuion] = useState(false);

  const { guion: guionHoy, cargando } = useGuionHoy(uid, riderName);
  const guionSemana = useGuionSemana(uid, riderName);
  const pod = usePodcast();

  const guion = tipo === 'hoy' ? guionHoy : guionSemana;
  const sonandoEste = pod.fase !== 'detenido' && pod.guion?.tipo === tipo;

  if (cargando || !guion) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Preparando tu episodio…
      </div>
    );
  }

  const durGuion = duracionEstimadaSeg(guion, pod.rate);
  const idx = sonandoEste ? pod.segmentoIdx : 0;
  const capActual = guion.segmentos[Math.min(idx, guion.segmentos.length - 1)];
  const progreso = sonandoEste ? pod.progreso : 0;
  const transcurrido = sonandoEste ? pod.transcurridoSeg : 0;

  const reproducir = () => {
    if (sonandoEste && pod.fase === 'reproduciendo') pausarPodcast();
    else if (sonandoEste && pod.fase === 'pausado') reanudarPodcast();
    else {
      try { pausarEpisodioRSS(); } catch { /* sin episodio sonando */ }
      reproducirGuion(guion);
    }
  };

  const irACapitulo = (i: number) => {
    const lim = Math.min(Math.max(0, i), guion.segmentos.length - 1);
    if (sonandoEste) saltarASegmento(lim);
    else {
      try { pausarEpisodioRSS(); } catch { /* sin episodio sonando */ }
      reproducirGuion(guion, lim);
    }
  };

  const otroSonando = pod.fase !== 'detenido' && pod.guion?.tipo !== tipo;

  return (
    <div className="space-y-3">
      {/* ── Selector de episodio ── */}
      <div className="grid grid-cols-2 gap-2">
        {([
          { t: 'hoy' as const, label: '📻 Tu día', sub: fechaCorta(guionHoy?.fechaISO) },
          { t: 'semana' as const, label: '📆 Tu semana', sub: 'últimos 7 días' },
        ]).map((op) => (
          <button
            key={op.t}
            onClick={() => setTipo(op.t)}
            className={`p-2.5 rounded-xl border text-left transition-all active:scale-[0.98] ${
              tipo === op.t
                ? 'bg-purple-600/20 border-purple-500/50 text-white'
                : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <div className="text-xs font-bold">{op.label}</div>
            <div className="text-[10px] text-slate-500">{op.sub}</div>
          </button>
        ))}
      </div>

      {/* ── Portada del episodio ── */}
      <div className="relative p-4 rounded-2xl bg-gradient-to-br from-purple-600/25 via-fuchsia-600/15 to-slate-900 border border-purple-500/30 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/20 flex-shrink-0">
            🎙️
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold tracking-wider text-purple-300">
              RiderTrack FM
            </div>
            <div className="text-lg font-black text-white truncate">{guion.titulo}</div>
            <div className="text-[11px] text-slate-400 truncate">{guion.subtitulo}</div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1 tabular-nums">
            <Radio className="w-3.5 h-3.5 text-purple-400" />
            ~{Math.max(1, Math.round(durGuion / 60))} min · {guion.segmentos.length} capítulos
          </span>
          {sonandoEste && pod.fase === 'reproduciendo' && (
            <span className="flex items-center gap-1 text-fuchsia-300 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" /> AL AIRE
            </span>
          )}
        </div>
      </div>

      {/* ── Avisos ── */}
      {guion.vacio && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 leading-relaxed">
          Hoy todavía no hay nada que contar. Cuando muevas la ruta, la caja o los kilómetros, tu
          episodio se arma solo.
        </div>
      )}
      {otroSonando && (
        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-300 leading-relaxed">
          Está sonando el episodio <b>{pod.guion?.tipo === 'hoy' ? 'de hoy' : 'de la semana'}</b>.
          Si le das ▶ aquí, cambia a este.
        </div>
      )}

      {/* ── Reproductor ── */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-purple-300 truncate">
            {sonandoEste || pod.fase === 'detenido' ? `${capActual.icono} ${capActual.titulo}` : '—'}
          </span>
          <span className="tabular-nums text-slate-500">
            {fmtMinSeg(transcurrido)} / {fmtMinSeg(durGuion)}
          </span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-500"
            style={{ width: `${Math.round(progreso * 100)}%` }}
          />
        </div>

        {/* Controles */}
        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            onClick={() => irACapitulo((sonandoEste ? pod.segmentoIdx : 0) - 1)}
            disabled={!sonandoEste || pod.segmentoIdx <= 0}
            className="p-3 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all active:scale-90"
            title="Capítulo anterior"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={reproducir}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white shadow-lg shadow-purple-600/30 flex items-center justify-center transition-all active:scale-95"
            title={sonandoEste && pod.fase === 'reproduciendo' ? 'Pausar' : 'Reproducir'}
          >
            {sonandoEste && pod.fase === 'reproduciendo' ? (
              <Pause className="w-7 h-7" />
            ) : (
              <Play className="w-7 h-7 translate-x-0.5" />
            )}
          </button>
          <button
            onClick={() => detenerPodcast()}
            disabled={!sonandoEste}
            className="p-3 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all active:scale-90"
            title="Detener"
          >
            <Square className="w-5 h-5" />
          </button>
          <button
            onClick={() => irACapitulo((sonandoEste ? pod.segmentoIdx : 0) + 1)}
            disabled={!sonandoEste || pod.segmentoIdx >= guion.segmentos.length - 1}
            className="p-3 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all active:scale-90"
            title="Capítulo siguiente"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Velocidad */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span className="text-[10px] text-slate-500 mr-1">Velocidad</span>
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => fijarRatePodcast(r)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border tabular-nums transition-all ${
                Math.abs(pod.rate - r) < 0.01
                  ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-700/60'
              }`}
            >
              {r === 1.0 ? '1×' : `${r.toString().replace('0.', '.')}×`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Capítulos ── */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 overflow-hidden">
        <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-800">
          Capítulos
        </div>
        {guion.segmentos.map((s, i) => {
          const activo = sonandoEste && i === pod.segmentoIdx;
          return (
            <button
              key={s.id + i}
              onClick={() => irACapitulo(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                activo ? 'bg-purple-600/15' : 'hover:bg-slate-800/60'
              } ${i > 0 ? 'border-t border-slate-800/70' : ''}`}
            >
              <span className="text-base w-6 text-center flex-shrink-0">{s.icono}</span>
              <span className={`flex-1 text-xs font-semibold truncate ${activo ? 'text-purple-200' : 'text-slate-300'}`}>
                {s.titulo}
              </span>
              {activo && pod.fase === 'reproduciendo' && (
                <span className="flex items-end gap-[3px] h-3.5 flex-shrink-0">
                  <span className="w-[3px] h-2 bg-fuchsia-400 rounded-full animate-pulse" />
                  <span className="w-[3px] h-3.5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-[3px] h-2.5 bg-fuchsia-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </span>
              )}
              <span className="text-[10px] text-slate-600 tabular-nums flex-shrink-0">
                ~{fmtMinSeg(estimarSegundos(s.texto, pod.rate))}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Guion ── */}
      <button
        onClick={() => setVerGuion((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-1"
      >
        {verGuion ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {verGuion ? 'Ocultar guion' : 'Ver guion (lo que va a decir)'}
      </button>
      {verGuion && (
        <div className="p-3 rounded-xl bg-[#0b141a] border border-slate-700 max-h-56 overflow-auto">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#e9edef] m-0">
            {guion.segmentos.map((s) => `${s.icono} ${s.titulo.toUpperCase()}\n${s.texto}`).join('\n\n')}
          </pre>
        </div>
      )}

      <p className="text-[10px] text-slate-500 leading-relaxed">
        La voz es la de tu teléfono (la misma de la navegación GPS). El podcast se pausa solo
        cuando la navegación tiene algo que anunciarte y vuelve después. Los números son los
        mismos del resumen de WhatsApp — cierra tu caja antes para el episodio final.
      </p>
    </div>
  );
};

function fechaCorta(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  return `${d} ${meses[m - 1]} ${y}`;
}

// ═══════════════════════════════════════════════════════════
// 🔘 BOTÓN DE MENÚ (F3.42) — fila IGUAL a las demás opciones del
// ☰ (icono + "Podcast" + badge). SIN tick de cronómetro (usa el
// cache de caja + odómetro directo — cero lecturas extra): el
// badge muestra AL AIRE / PAUSA mientras suena, y ~min del
// episodio de hoy cuando está quieto.
// ═══════════════════════════════════════════════════════════

interface PodcastMenuBotonProps {
  uid?: string | null;
  /** Sidebar colapsado → solo el icono */
  colapsado?: boolean;
  onAbrir?: () => void;
}

export const PodcastMenuBoton: React.FC<PodcastMenuBotonProps> = ({ uid, colapsado, onAbrir }) => {
  const { caja, gastosHoy, cierreHoy, cargando, clientes } = useResumenCaja(uid);
  const [odo, setOdo] = useState(() => snapshotOdometro());
  useEffect(() => {
    setOdo(snapshotOdometro());
    return suscribirOdometro(() => setOdo(snapshotOdometro()));
  }, []);
  const pod = usePodcast();

  // guion LIGERO para el badge (sin crono ni mantenimiento — el
  // ~min del episodio no necesita el dato exacto del capítulo moto)
  const guionLite = useMemo(() => {
    if (cargando) return null;
    const r = armarResumenDia({
      clientes,
      gastos: gastosHoy,
      fondo: caja.fondo,
      kmHoyM: odo?.hoyM || 0,
    });
    return armarGuionHoy(r, cierreHoy, undefined, null);
  }, [cargando, clientes, gastosHoy, caja.fondo, odo, cierreHoy]);

  const badge = (() => {
    if (pod.fase === 'reproduciendo') {
      return { texto: 'AL AIRE', clase: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40 animate-pulse' };
    }
    if (pod.fase === 'pausado') {
      return { texto: 'PAUSA', clase: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    }
    if (guionLite && !guionLite.vacio) {
      const min = Math.max(1, Math.round(duracionEstimadaSeg(guionLite) / 60));
      return { texto: `~${min} min`, clase: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    }
    return { texto: '🎙️', clase: 'bg-slate-800 text-slate-400 border-slate-700' };
  })();

  return (
    <button
      onClick={onAbrir}
      title={
        colapsado
          ? 'Jornada hablada'
          : 'Tu día y tu semana, contados en voz alta — toca para escuchar'
      }
      className="group relative flex items-center w-full px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 active:scale-[0.98]"
    >
      <PodcastIcon className="w-5 h-5 flex-shrink-0 text-purple-400 transition-transform duration-200 group-hover:scale-105" />
      {!colapsado && <span className="ml-3 truncate font-medium">Jornada hablada</span>}
      {!colapsado && (
        <span className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full border tabular-nums ${badge.clase}`}>
          {badge.texto}
        </span>
      )}
      {colapsado && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
          Jornada hablada
        </div>
      )}
    </button>
  );
};

// helpers del guion ligero (no importa el contenido exacto —
// solo la DURACIÓN para el badge)
