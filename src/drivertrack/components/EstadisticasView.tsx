// ═══════════════════════════════════════════════════════════
// 📊 DriverTrack — Estadísticas (F-ID4)
// La pestaña que responde las 3 preguntas del conductor:
//   🏆 ¿DÓNDE gano más?  → zonas de oro (barras + corona)
//   ⏰ ¿CUÁNDO gano más? → horas de oro (24 barras, top 3 dorado)
//   💰 ¿CUÁNTO cobrar?   → precio piso con tu S/ por km REAL
// Y de regalo: curva del período, ¿voy mejor que la semana
// pasada?, y tus récords de toda la historia.
// Gráficos hechos a mano (divs + un SVG) — sin librerías: la app
// sigue liviana para el teléfono del barrio (PWA offline).
// ═══════════════════════════════════════════════════════════
import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Coins,
  Crown,
  MapPin,
  Minus,
  Package,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { Viaje } from '../types';
import { fechaBonita, fechaHoy } from '../storage';
import { fmtSoles } from '../utils';
import {
  agregarHoras,
  agregarZonas,
  comparativaSemanal,
  desdePeriodo,
  filtrarPeriodo,
  horasDeOro,
  metricas,
  PeriodoStats,
  precioPiso,
  records,
  serieDias,
} from '../services/stats';

const PERIODOS: { id: PeriodoStats; nombre: string }[] = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: '7d', nombre: '7 días' },
  { id: '30d', nombre: '30 días' },
  { id: 'todo', nombre: 'Todo' },
];

/** Curva suave entre puntos (bezier por punto medio — estilo RiderTrack) */
function pathSuave(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const cx = (a.x + b.x) / 2;
    d += ` C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
function diaCorto(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

interface Props {
  viajes: Viaje[];
}

export default function EstadisticasView({ viajes }: Props) {
  const [periodo, setPeriodo] = useState<PeriodoStats>('7d');
  const [kmTexto, setKmTexto] = useState('5');
  const hoy = fechaHoy();

  const delPeriodo = useMemo(() => filtrarPeriodo(viajes, periodo, hoy), [viajes, periodo, hoy]);
  const m = useMemo(() => metricas(delPeriodo), [delPeriodo]);
  const zonas = useMemo(() => agregarZonas(delPeriodo), [delPeriodo]);
  const buckets = useMemo(() => agregarHoras(delPeriodo), [delPeriodo]);
  const oro = useMemo(() => horasDeOro(buckets), [buckets]);
  const comp = useMemo(() => comparativaSemanal(viajes, hoy), [viajes, hoy]);
  const recs = useMemo(() => records(viajes), [viajes]);

  // Curva: serie continua de días del período (tope 30 para "todo")
  const serie = useMemo(() => {
    const desde = desdePeriodo(periodo, hoy) ?? (viajes.length ? viajes.map(v => v.fecha).sort()[0] : hoy);
    return serieDias(delPeriodo, desde, hoy);
  }, [delPeriodo, periodo, viajes, hoy]);

  // 💰 Precio piso: usa el período; si no grabaste km ahí, se salva
  // con TODA tu historia (con su etiqueta, para no mentirte)
  const pisoUsaHistoria = m.nConGps === 0;
  const pisoM = useMemo(() => (pisoUsaHistoria ? metricas(viajes) : m), [pisoUsaHistoria, viajes, m]);
  const kmVal = parseFloat(kmTexto.replace(',', '.'));
  const piso = Number.isFinite(kmVal) && kmVal > 0 ? precioPiso(pisoM.sPorKm, kmVal) : 0;

  const hayDatos = delPeriodo.length > 0;
  const maxZona = zonas.length ? zonas[0].neto : 1;
  const maxHora = Math.max(...buckets.map(b => b.neto), 1);
  const netoOro = buckets.filter(b => oro.includes(b.hora)).reduce((s, b) => s + b.neto, 0);
  const pctOro = m.neto > 0 ? (netoOro / m.neto) * 100 : 0;
  const topZonas = zonas.slice(0, 6);
  const zonasExtra = zonas.length - topZonas.length;

  // puntos de la curva (svg 320×100)
  const W = 320;
  const baseY = 92;
  const maxCurva = Math.max(...serie.map(d => d.neto), 1);
  const puntos = serie.map((d, i) => ({
    x: serie.length === 1 ? W / 2 : (i / (serie.length - 1)) * W,
    y: baseY - (d.neto / maxCurva) * 80,
  }));
  const linea = pathSuave(puntos);
  const area = puntos.length
    ? `${linea} L ${puntos[puntos.length - 1].x} ${baseY} L ${puntos[0].x} ${baseY} Z`
    : '';

  function flecha(pct: number | null) {
    if (pct === null) return { Icon: Minus, color: 'text-slate-500', txt: 'sin datos' };
    if (pct > 0.5) return { Icon: ArrowUpRight, color: 'text-emerald-400', txt: `▲ ${pct.toFixed(0)}%` };
    if (pct < -0.5) return { Icon: ArrowDownRight, color: 'text-red-400', txt: `▼ ${Math.abs(pct).toFixed(0)}%` };
    return { Icon: Minus, color: 'text-slate-400', txt: 'igual' };
  }
  const fNeto = flecha(comp.diffPct);
  const fViajes = comp.previa.n > 0 ? flecha(((comp.actual.n - comp.previa.n) / comp.previa.n) * 100) : { Icon: Minus, color: 'text-slate-500', txt: 'sin datos' };

  return (
    <div className="space-y-3" data-testid="stats-view">
      {/* Chips de período */}
      <div className="grid grid-cols-4 gap-2" data-testid="stats-periodos">
        {PERIODOS.map(p => {
          const activo = periodo === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              data-testid={`chip-${p.id}`}
              aria-pressed={activo}
              className={`rounded-xl border py-2 text-xs font-bold transition-colors ${
                activo
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400'
              }`}
            >
              {p.nombre}
            </button>
          );
        })}
      </div>

      {!hayDatos ? (
        <div
          className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 text-center"
          data-testid="stats-vacio"
        >
          <p className="text-3xl">📊</p>
          <p className="mt-2 text-sm font-bold text-slate-200">No hay viajes en este período</p>
          <p className="mt-1 text-xs text-slate-400">
            Agregá viajes desde la pestaña Viajes y acá van a aparecer tus zonas de oro, tus horas
            de oro y tu precio piso.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs del período */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-center">
              <p className="text-sm font-black text-emerald-400" data-testid="stats-kpi-neto">{fmtSoles(m.neto)}</p>
              <p className="text-[10px] text-emerald-500/80">neto</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-center">
              <p className="text-lg font-black text-slate-100" data-testid="stats-kpi-viajes">{m.n}</p>
              <p className="text-[10px] text-slate-400">viajes</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-center">
              <p className="text-lg font-black text-slate-100" data-testid="stats-kpi-dias">{m.dias}</p>
              <p className="text-[10px] text-slate-400">días</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-center">
              <p className="text-sm font-black text-slate-200" data-testid="stats-kpi-promedio">{fmtSoles(m.promedioDia)}</p>
              <p className="text-[10px] text-slate-400">S/ por día</p>
            </div>
          </div>

          {/* 📍 km reales + S/ por hora moviéndote (solo con datos GPS) */}
          {m.km > 0 && (
            <div
              className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 py-2 text-center text-xs font-bold text-sky-300"
              data-testid="stats-linea-km"
            >
              📍 {m.km.toFixed(1)} km reales · S/ {m.sPorKm.toFixed(2)} por km
              {m.sPorHora > 0 && <> · S/ {m.sPorHora.toFixed(0)} por hora</>}
            </div>
          )}

          {/* 📈 Curva del período */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3" data-testid="stats-curva-card">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <TrendingUp size={14} className="text-emerald-400" /> Cómo venís
              </p>
              <p className="text-[10px] text-slate-400">
                máx {fmtSoles(maxCurva)}
                {serie.length === 30 && ' · últimos 30 días'}
              </p>
            </div>
            <svg
              viewBox={`0 0 ${W} 100`}
              preserveAspectRatio="none"
              className="h-24 w-full"
              data-testid="stats-curva"
              data-puntos={serie.length}
            >
              <defs>
                <linearGradient id="gradStats" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line x1="0" y1={baseY} x2={W} y2={baseY} stroke="#334155" strokeWidth="1" />
              {area && <path d={area} fill="url(#gradStats)" />}
              {linea && <path d={linea} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />}
              {puntos.length > 0 && (
                <>
                  <circle cx={puntos[puntos.length - 1].x} cy={puntos[puntos.length - 1].y} r="7" fill="#34d399" opacity="0.25" />
                  <circle
                    cx={puntos[puntos.length - 1].x}
                    cy={puntos[puntos.length - 1].y}
                    r="3.5"
                    fill="#34d399"
                    stroke="#022c22"
                    strokeWidth="1.5"
                  />
                </>
              )}
            </svg>
            {/* Etiquetas del eje X */}
            {serie.length <= 7 ? (
              <div className="mt-1 flex justify-between text-[9px] text-slate-400" data-testid="stats-curva-ejes">
                {serie.map(d => {
                  const [yy, mm, dd] = d.fecha.split('-').map(Number);
                  const dias = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
                  const dt = new Date(yy, mm - 1, dd);
                  return (
                    <span key={d.fecha} className={d.n > 0 ? 'font-bold text-slate-300' : ''}>
                      {dias[dt.getDay()]} {dd}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="mt-1 flex justify-between text-[9px] text-slate-400" data-testid="stats-curva-ejes">
                <span>{diaCorto(serie[0].fecha)}</span>
                <span>{diaCorto(serie[Math.floor(serie.length / 2)].fecha)}</span>
                <span>{diaCorto(serie[serie.length - 1].fecha)}</span>
              </div>
            )}
          </div>

          {/* 📅 ¿Voy mejor que la semana pasada? (fija: últimos 7 vs 7 anteriores) */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3" data-testid="stats-comparativa">
            <p className="mb-2 text-xs font-bold text-slate-200">
              📅 Últimos 7 días vs semana anterior
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-900/50 p-2.5" data-testid="stats-comp-neto">
                <p className="text-[10px] text-slate-400">Plata (neto)</p>
                <p className="flex items-center gap-1 text-sm font-black text-slate-100">
                  {fmtSoles(comp.actual.neto)}
                  <fNeto.Icon size={14} className={fNeto.color} />
                  <span className={`text-[10px] font-bold ${fNeto.color}`}>{fNeto.txt}</span>
                </p>
                <p className="text-[10px] text-slate-500">antes: {fmtSoles(comp.previa.neto)}</p>
              </div>
              <div className="rounded-xl bg-slate-900/50 p-2.5" data-testid="stats-comp-viajes">
                <p className="text-[10px] text-slate-400">Viajes</p>
                <p className="flex items-center gap-1 text-sm font-black text-slate-100">
                  {comp.actual.n}
                  <fViajes.Icon size={14} className={fViajes.color} />
                  <span className={`text-[10px] font-bold ${fViajes.color}`}>{fViajes.txt}</span>
                </p>
                <p className="text-[10px] text-slate-500">antes: {comp.previa.n}</p>
              </div>
            </div>
          </div>

          {/* 🏆 Zonas de oro */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3" data-testid="stats-zonas">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <MapPin size={14} className="text-emerald-400" /> Zonas de oro
              </p>
              {zonas[0] && !zonas[0].esSinZona && (
                <span className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300" data-testid="stats-zona-oro">
                  <Crown size={11} /> {zonas[0].zona} · S/ {zonas[0].promedio.toFixed(2)} c/u
                </span>
              )}
            </div>
            <div className="space-y-2.5">
              {topZonas.map((z, i) => {
                const esOro = i === 0 && !z.esSinZona;
                return (
                  <div key={z.clave || '__sinzona__'} data-testid="stats-zona" data-zona={z.zona}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <p className={`truncate text-xs font-bold ${esOro ? 'text-amber-300' : 'text-slate-200'}`}>
                        {esOro && '👑 '}
                        {z.zona}
                      </p>
                      <p className="shrink-0 text-[10px] text-slate-400" data-testid="stats-zona-detalle">
                        {fmtSoles(z.neto)} · {z.n} {z.n === 1 ? 'viaje' : 'viajes'}
                      </p>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-700/60">
                      <div
                        className={`h-full rounded-full ${
                          esOro
                            ? 'bg-gradient-to-r from-amber-300 to-amber-500'
                            : z.esSinZona
                              ? 'bg-slate-500'
                              : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                        }`}
                        style={{ width: `${Math.max(4, (z.neto / maxZona) * 100)}%` }}
                        data-testid="stats-zona-barra"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {zonasExtra > 0 && (
              <p className="mt-2 text-center text-[10px] text-slate-500">+ {zonasExtra} zona{zonasExtra > 1 ? 's' : ''} más</p>
            )}
          </div>

          {/* ⏰ Horas de oro */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3" data-testid="stats-horas">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Clock size={14} className="text-emerald-400" /> Horas de oro
            </p>
            <div className="flex h-28 items-end gap-[3px]">
              {buckets.map(b => {
                const esOro = oro.includes(b.hora);
                const pct = (b.neto / maxHora) * 100;
                return (
                  <div
                    key={b.hora}
                    className="flex h-full flex-1 flex-col justify-end"
                    title={`${b.hora}h — ${fmtSoles(b.neto)} · ${b.n} viajes`}
                  >
                    <div
                      data-testid="stats-hora-barra"
                      data-hora={b.hora}
                      data-neto={b.neto.toFixed(2)}
                      className={`w-full rounded-t-[3px] ${esOro ? 'bg-gradient-to-t from-amber-500 to-amber-300' : 'bg-emerald-500/50'}`}
                      style={{ height: b.neto > 0 ? `${Math.max(6, pct)}%` : '2px' }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-slate-400">
              <span>0h</span>
              <span>6h</span>
              <span>12h</span>
              <span>18h</span>
              <span>23h</span>
            </div>
            {oro.length > 0 && (
              <p className="mt-2 rounded-xl bg-slate-900/50 p-2 text-center text-xs text-slate-300" data-testid="stats-horas-insight">
                Tus horas de oro: <b className="text-amber-300">{oro.map(h => `${h}h`).join(' · ')}</b>
                {pctOro > 0 && (
                  <>
                    {' '}— el <b className="text-amber-300">{pctOro.toFixed(0)}%</b> de tu plata sale de ahí
                  </>
                )}
              </p>
            )}
          </div>

          {/* 💰 Precio piso */}
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-3" data-testid="stats-precio-piso">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Coins size={14} className="text-emerald-400" /> Tu precio piso
            </p>
            {pisoM.nConGps === 0 ? (
              <div className="rounded-xl bg-slate-900/50 p-3 text-center" data-testid="stats-piso-sin-gps">
                <p className="text-xs text-slate-300">
                  📍 Grabá tus viajes con el GPS (▶ en cada viaje) y acá te calculo tu precio piso
                  por km con tus km REALES.
                </p>
                {pisoM.n > 0 && (
                  <p className="mt-2 text-xs text-slate-400">
                    De mientras, tu promedio por viaje: <b className="text-slate-200">{fmtSoles(pisoM.sPorViaje)}</b>
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="text-[11px] text-slate-400" data-testid="stats-sporkm">
                  Tu km real vale{' '}
                  <b className="text-emerald-300">S/ {pisoM.sPorKm.toFixed(2)}</b>
                  {' '}({pisoM.nConGps} viajes grabados · {pisoM.km.toFixed(1)} km
                  {pisoUsaHistoria && ' de toda tu historia'})
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400">¿Cuántos km es el viaje?</label>
                    <input
                      value={kmTexto}
                      onChange={e => setKmTexto(e.target.value)}
                      inputMode="decimal"
                      placeholder="5"
                      data-testid="stats-input-km"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm font-bold text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex-1 rounded-xl bg-slate-900/50 p-2.5 text-center" data-testid="stats-piso-resultado">
                    <p className="text-[10px] text-slate-400">No lo tomes por menos de</p>
                    <p className="text-lg font-black text-emerald-400">
                      {piso > 0 ? fmtSoles(piso) : '—'}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Es tu promedio REAL por km — para no ganar menos que siempre. Si pagan menos,
                  negociá o pasá de largo.
                </p>
              </>
            )}
          </div>

          {/* 🏆 Récords (toda la historia) */}
          {recs.mejorDia && (
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3" data-testid="stats-records">
              <p className="mb-2 text-xs font-bold text-slate-200">🏆 Tus récords</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-slate-900/50 p-2.5" data-testid="stats-record-dia">
                  <p className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Trophy size={13} className="text-amber-400" /> Más plata en un día
                  </p>
                  <p className="text-xs font-black text-slate-100">
                    {fmtSoles(recs.mejorDia.neto)}{' '}
                    <span className="font-medium text-slate-500">{fechaBonita(recs.mejorDia.fecha)}</span>
                  </p>
                </div>
                {recs.diaMasViajes && (
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/50 p-2.5" data-testid="stats-record-viajes">
                    <p className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Package size={13} className="text-sky-400" /> Más viajes en un día
                    </p>
                    <p className="text-xs font-black text-slate-100">
                      {recs.diaMasViajes.n}{' '}
                      <span className="font-medium text-slate-500">{fechaBonita(recs.diaMasViajes.fecha)}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
