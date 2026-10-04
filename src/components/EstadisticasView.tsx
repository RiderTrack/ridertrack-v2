// ═══════════════════════════════════════════════════════════
// 📊 ESTADÍSTICAS VIEW — RiderTrack V2 (Fase 2.16)
// Estadísticas estilo Circuit con DATOS REALES de historial_rutas:
//   · Periodos: 7 días / 30 días / 90 días / Todo
//   · KPIs: S/ cobrado (tuyo vs empresa), entregas, km, días
//     trabajados, promedios por día
//   · 📅 Comparativa semana vs semana (S/ y entregas, % ▲▼)
//   · 📈 Curva animada de evolución (Fase 2.17: la curva con
//     gradiente azul de la vista vieja, ahora con datos reales)
//   · Gráficos: S/ por día, entregas por día, métodos de pago
//   · 🏆 Récords: mejor día, día con más entregas, mejor semana
//   · HOY EN CURSO: si la ruta del día está activa, sus entregas
//     ya suman a los gráficos (marcadas "en curso") aunque aún
//     no se cierre la ruta.
// Fuente de datos: leerHistorial() (historial_rutas, incluidas
// las rutas importadas de la v1) + useClientes() para el día vivo.
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  RefreshCw,
  DollarSign,
  Package,
  Map as MapIcon,
  CalendarDays,
  Wallet,
  Building2,
  Trophy,
  Zap,
  Bike,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  PieChart as PieIcon,
  BarChart3,
  Camera,
  Download,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { useClientes } from '../hooks/useClientes';
import { leerHistorial, RegistroHistorial } from '../services/firestore';
import { exportarExcelMes } from '../utils/excelMes';
import {
  DiaAgregado,
  fechaCorta,
  fechaLarga,
  fechaLimaISO,
  agregarPorDias,
  sumarKmYTiempo,
  compararSemanas,
  acumularMetodos,
  calcularRecords,
  registroHoyVivo,
  resumenDiaVivo,
} from '../utils/stats';

type Periodo = '7d' | '30d' | '90d' | 'todo';

const COLORES = ['#10b981', '#a855f7', '#f59e0b', '#3b82f6', '#06b6d4', '#ef4444', '#6366f1', '#eab308', '#64748b', '#ec4899'];

interface EstadisticasViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const PERIODOS: { id: Periodo; label: string; dias: number }[] = [
  { id: '7d', label: '7 días', dias: 7 },
  { id: '30d', label: '30 días', dias: 30 },
  { id: '90d', label: '90 días', dias: 90 },
  { id: 'todo', label: 'Todo', dias: 0 },
];

const fmtSoles = (n: number) => `S/ ${n.toFixed(2)}`;
const fmtInt = (n: number) => new Intl.NumberFormat('es-PE').format(Math.round(n));

export const EstadisticasView: React.FC<EstadisticasViewProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const { clientes, loading: cargandoClientes } = useClientes();
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [exportandoExcel, setExportandoExcel] = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!user?.uid) return;
    if (silencioso) setRefrescando(true); else setCargando(true);
    try {
      const regs = await leerHistorial(user.uid, 300);
      setRegistros(regs);
    } catch (e) {
      console.error('❌ Error cargando historial para estadísticas:', e);
      if (!silencioso) onShowToast?.('⚠️ Error', 'No se pudo cargar el historial', 'warning');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [user?.uid, onShowToast]);

  useEffect(() => {
    if (user?.uid) cargar();
    else setCargando(false);
  }, [user?.uid, cargar]);

  // ── HOY EN VIVO: entregas del día actual (ruta sin cerrar) ──
  const hoyVivo = useMemo(() => {
    const r = resumenDiaVivo(clientes);
    return { ...r, soles: r.tuyo + r.empresa, hay: r.entregas > 0 };
  }, [clientes]);

  // ── Registros + hoy vivo → lista base ──
  const registrosConHoy = useMemo<RegistroHistorial[]>(() => {
    const base = [...registros];
    if (hoyVivo.hay) {
      // Si HOY ya tiene rutas cerradas, igual agregamos las entregas en curso
      base.push(registroHoyVivo(user?.uid || '', hoyVivo.entregas, hoyVivo.tuyo, hoyVivo.empresa) as RegistroHistorial);
    }
    return base;
  }, [registros, hoyVivo, user?.uid]);

  // ── Excel del mes (Fase 2.17-C): exporta el mes en curso ──
  const exportarMes = useCallback(async () => {
    if (exportandoExcel) return;
    setExportandoExcel(true);
    try {
      // registrosConHoy: el mes en curso incluye HOY vivo si hay entregas
      await exportarExcelMes(registrosConHoy, onShowToast);
    } finally {
      setExportandoExcel(false);
    }
  }, [exportandoExcel, registrosConHoy, onShowToast]);

  // ── Agregado por día dentro del periodo ──
  const dias = useMemo<DiaAgregado[]>(() => {
    const limite = PERIODOS.find(p => p.id === periodo)?.dias || 0;
    const desde = limite > 0 ? fechaLimaISO(new Date(Date.now() - limite * 86400000)) : '0000';
    return agregarPorDias(registrosConHoy, desde);
  }, [registrosConHoy, periodo]);

  // ── KPIs del periodo ──
  const kpis = useMemo(() => {
    const soles = dias.reduce((s, d) => s + d.soles, 0);
    const entregas = dias.reduce((s, d) => s + d.entregas, 0);
    const tuyo = dias.reduce((s, d) => s + d.tuyo, 0);
    const empresa = dias.reduce((s, d) => s + d.empresa, 0);
    const diasTrabajados = dias.length;
    const { km, tiempoMs } = sumarKmYTiempo(registrosConHoy, dias);
    return {
      soles, entregas, tuyo, empresa, km, diasTrabajados,
      tieneKm: km > 0,
      horasRuta: tiempoMs / 3600000,
      solesPorDia: diasTrabajados > 0 ? soles / diasTrabajados : 0,
      entregasPorDia: diasTrabajados > 0 ? entregas / diasTrabajados : 0,
      solesPorEntrega: entregas > 0 ? soles / entregas : 0,
    };
  }, [dias, registrosConHoy]);

  // ── Comparativa semana vs semana ──
  const semanas = useMemo(() => compararSemanas(dias), [dias]);

  // ── Métodos de pago acumulados (pie) ──
  const datosPie = useMemo(() => {
    const limite = PERIODOS.find(p => p.id === periodo)?.dias || 0;
    const desde = limite > 0 ? fechaLimaISO(new Date(Date.now() - limite * 86400000)) : '0000';
    return acumularMetodos(registrosConHoy, desde);
  }, [registrosConHoy, periodo]);

  // ── Récords ──
  const records = useMemo(() => calcularRecords(dias), [dias]);

  // ── Datos para gráfico de barras (máx 31 días visibles) ──
  const chartDias = useMemo(() => {
    if (periodo === 'todo' && dias.length > 31) return dias.slice(-31);
    return dias;
  }, [dias, periodo]);

  const cargandoTodo = cargando || (cargandoClientes && registros.length === 0);

  const Delta: React.FC<{ valor: number | null }> = ({ valor }) => {
    if (valor === null) return <span className="text-[10px] text-slate-400">sin datos previos</span>;
    const positivo = valor >= 0;
    const Icono = Math.abs(valor) < 0.5 ? Minus : positivo ? ArrowUpRight : ArrowDownRight;
    const color = Math.abs(valor) < 0.5 ? 'text-slate-400' : positivo ? 'text-emerald-400' : 'text-red-400';
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-black ${color}`}>
        <Icono className="w-3.5 h-3.5" />
        {Math.abs(valor) < 0.5 ? 'igual' : `${positivo ? '+' : ''}${valor.toFixed(0)}%`}
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-12 max-w-4xl">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
              Estadísticas
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Tu rendimiento con los datos reales de tus rutas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportarMes}
              disabled={exportandoExcel || dias.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold text-xs border border-emerald-500/50 transition-colors"
              title="Descargar Excel con todo el mes en curso"
            >
              {exportandoExcel ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Excel del mes</span>
            </button>
            <button
              onClick={() => cargar(true)}
              disabled={refrescando}
              className="p-2 rounded-xl bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
              title="Actualizar"
            >
              <RefreshCw className={`w-4 h-4 ${refrescando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Selector de periodo */}
        <div className="grid grid-cols-4 gap-1.5 mt-4 p-1 rounded-xl bg-slate-900/60 border border-slate-700">
          {PERIODOS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              className={`py-2 px-1 rounded-lg text-xs font-bold transition-all ${
                periodo === p.id
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {cargandoTodo ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-3 border-slate-700 border-t-emerald-500 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
          <div className="text-slate-400 text-sm">Calculando tus números…</div>
        </div>
      ) : dias.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-800 border border-slate-700 text-center">
          <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-bold">Aún no hay datos en este periodo</p>
          <p className="text-xs text-slate-500 mt-2">
            Cierra tu primera ruta con 🏁 FINALIZAR Y GUARDAR — o importa tu historial de la v1 desde el Historial — y acá verás tus números.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30">
              <DollarSign className="w-5 h-5 text-emerald-400 mb-2" />
              <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">💰 Cobrado</div>
              <div className="text-2xl font-black text-white mt-0.5">{fmtSoles(kpis.soles)}</div>
              <div className="text-[10px] text-slate-400 mt-1">💜 {fmtSoles(kpis.tuyo)} · 🏢 {fmtSoles(kpis.empresa)}</div>
            </div>
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
              <Package className="w-5 h-5 text-blue-400 mb-2" />
              <div className="text-[10px] text-blue-400 uppercase font-bold tracking-wider">📦 Entregas</div>
              <div className="text-2xl font-black text-white mt-0.5">{fmtInt(kpis.entregas)}</div>
              <div className="text-[10px] text-slate-400 mt-1">{kpis.entregasPorDia.toFixed(1)} por día</div>
            </div>
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30">
              {kpis.tieneKm ? (
                <>
                  <MapIcon className="w-5 h-5 text-purple-400 mb-2" />
                  <div className="text-[10px] text-purple-400 uppercase font-bold tracking-wider">🛵 Km recorridos</div>
                  <div className="text-2xl font-black text-white mt-0.5">{fmtInt(kpis.km)}<span className="text-sm font-bold"> km</span></div>
                  <div className="text-[10px] text-slate-400 mt-1">{kpis.horasRuta > 0 ? `${kpis.horasRuta.toFixed(1)} h en ruta` : 'total del periodo'}</div>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 text-purple-400 mb-2" />
                  <div className="text-[10px] text-purple-400 uppercase font-bold tracking-wider">⚡ S/ por entrega</div>
                  <div className="text-2xl font-black text-white mt-0.5">{fmtSoles(kpis.solesPorEntrega)}</div>
                  <div className="text-[10px] text-slate-400 mt-1">promedio del periodo</div>
                </>
              )}
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <CalendarDays className="w-5 h-5 text-amber-400 mb-2" />
              <div className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">📅 Días activos</div>
              <div className="text-2xl font-black text-white mt-0.5">{kpis.diasTrabajados}</div>
              <div className="text-[10px] text-slate-400 mt-1">{fmtSoles(kpis.solesPorDia)} por día</div>
            </div>
          </div>

          {/* Comparativa semana vs semana */}
          <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-400" />
              Esta semana vs semana pasada
            </h3>
            {semanas.primeraSemana ? (
              <div className="text-center py-3 text-xs text-slate-400">
                🎉 ¡Tu primera semana con datos! La próxima semana acá verás la comparación.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">💰 S/ cobrado</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-black text-white">{fmtSoles(semanas.esta.soles)}</span>
                    <Delta valor={semanas.deltaSoles} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">antes: {fmtSoles(semanas.anterior.soles)}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">📦 Entregas</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-black text-white">{fmtInt(semanas.esta.entregas)}</span>
                    <Delta valor={semanas.deltaEntregas} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">antes: {fmtInt(semanas.anterior.entregas)}</div>
                </div>
              </div>
            )}
          </div>

          {/* 📈 CURVA ANIMADA de evolución (Fase 2.17-E — la curva de la vista vieja, con datos reales) */}
          <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Curva de evolución — S/ cobrados
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Cómo se movieron tus cobros día a día{hoyVivo.hay ? ' · HOY en curso al final' : ''}
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px] shrink-0">
                {PERIODOS.find(p => p.id === periodo)?.label}
              </span>
            </div>
            {/* key={periodo} en el wrapper → la curva se re-dibuja animada al cambiar de periodo */}
            <div key={periodo} style={{ height: 220 }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartDias} margin={{ top: 10, right: 10, left: -18, bottom: 5 }}>
                <defs>
                  <linearGradient id="curvaSoles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="etiqueta"
                  stroke="#94a3b8"
                  fontSize={10}
                  interval="preserveStartEnd"
                  angle={chartDias.length > 12 ? -45 : 0}
                  textAnchor={chartDias.length > 12 ? 'end' : 'middle'}
                  height={chartDias.length > 12 ? 40 : 30}
                />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  formatter={(v: any, _n: any, p: any) => {
                    const d: DiaAgregado = p?.payload;
                    return [`${fmtSoles(Number(v))}${d?.enCurso ? ' (en curso)' : ''}`, 'Cobrado'];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="soles"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#curvaSoles)"
                  activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                  dot={chartDias.length <= 2 ? { r: 4, fill: '#3b82f6' } : false}
                />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico S/ por día */}
          <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
            <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              S/ cobrados por día
            </h3>
            {hoyVivo.hay && (
              <p className="text-[10px] text-slate-500 mb-2">
                Incluye HOY en curso ({hoyVivo.entregas} entregas · {fmtSoles(hoyVivo.soles)}) — se ajusta al cierre de la ruta
              </p>
            )}
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartDias} margin={{ top: 5, right: 5, left: -18, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="etiqueta" stroke="#94a3b8" fontSize={10} interval="preserveStartEnd" angle={chartDias.length > 12 ? -45 : 0} textAnchor={chartDias.length > 12 ? 'end' : 'middle'} height={chartDias.length > 12 ? 40 : 30} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  formatter={(v: any, _n: any, p: any) => {
                    const d: DiaAgregado = p?.payload;
                    return [`${fmtSoles(Number(v))}${d?.enCurso ? ' (en curso)' : ''}`, 'Cobrado'];
                  }}
                />
                <Bar dataKey="soles" name="S/" radius={[4, 4, 0, 0]}>
                  {chartDias.map((d, i) => (
                    <Cell key={`cell-${i}`} fill={d.enCurso ? '#6ee7b7' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico entregas por día */}
          <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Entregas por día
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartDias} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="etiqueta" stroke="#94a3b8" fontSize={10} interval="preserveStartEnd" angle={chartDias.length > 12 ? -45 : 0} textAnchor={chartDias.length > 12 ? 'end' : 'middle'} height={chartDias.length > 12 ? 40 : 30} />
                <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  formatter={(v: any, _n: any, p: any) => {
                    const d: DiaAgregado = p?.payload;
                    return [`${v} entrega${Number(v) === 1 ? '' : 's'}${d?.enCurso ? ' (en curso)' : ''}`, 'Entregas'];
                  }}
                />
                <Bar dataKey="entregas" name="Entregas" radius={[4, 4, 0, 0]}>
                  {chartDias.map((d, i) => (
                    <Cell key={`cell-e-${i}`} fill={d.enCurso ? '#93c5fd' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Métodos de pago acumulados */}
          {datosPie.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
              <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-amber-400" />
                Métodos de pago ({PERIODOS.find(p => p.id === periodo)?.label.toLowerCase()})
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={datosPie}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }: any) => percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {datosPie.map((_, index) => (
                      <Cell key={`cell-pie-${index}`} fill={COLORES[index % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    formatter={(value: any) => [`S/ ${Number(value).toFixed(2)}`, 'Monto']}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Récords */}
          {records && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30">
              <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Tus récords del periodo
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">🏆 Mejor día en S/</div>
                      <div className="text-[10px] text-slate-400 capitalize truncate">{fechaLarga(records.mejorDia.fecha)}</div>
                    </div>
                  </div>
                  <div className="text-sm font-black text-amber-400 shrink-0 ml-2">{fmtSoles(records.mejorDia.soles)}</div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">📦 Día con más entregas</div>
                      <div className="text-[10px] text-slate-400 capitalize truncate">{fechaLarga(records.masEntregas.fecha)}</div>
                    </div>
                  </div>
                  <div className="text-sm font-black text-blue-400 shrink-0 ml-2">{fmtInt(records.masEntregas.entregas)}</div>
                </div>
                {records.mejorSemana && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Bike className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">🛵 Mejor semana cerrada</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          del {fechaCorta(records.mejorSemana[0])} al {fechaCorta(records.mejorSemana[1].fin)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-black text-emerald-400 shrink-0 ml-2">{fmtSoles(records.mejorSemana[1].soles)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nota de fuentes */}
          <div className="px-4 text-[10px] text-slate-500 leading-relaxed">
            📊 Datos: historial de rutas cerradas{registros.some(r => r.origen === 'v1') ? ' + rutas importadas de la v1' : ''}
            {hoyVivo.hay ? ' + hoy en curso' : ''}. Rutas sin cerrar no cuentan (solo HOY).
          </div>
        </>
      )}
    </div>
  );
};
