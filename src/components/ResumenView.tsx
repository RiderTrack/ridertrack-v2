// ═══════════════════════════════════════════════════════════
// 📊 RESUMEN VIEW - RiderTrack V2
// Resumen del día con datos REALES + gráficos como el Modular
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Building2,
  Wallet,
  PieChart as PieIcon,
  BarChart3,
  AreaChart as AreaIcon,
  Smartphone,
  CreditCard,
  Link as LinkIcon,
  RefreshCw,
  Banknote,
  Repeat,
  Ban,
  UserX,
  PhoneOff,
  XOctagon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { useClientes } from '../hooks/useClientes';

// Colores para gráficos
const COLORES = ['#10b981', '#a855f7', '#f59e0b', '#3b82f6', '#06b6d4', '#ef4444', '#6366f1', '#eab308', '#64748b', '#ec4899'];

export const ResumenView: React.FC = () => {
  const { clientes, loading } = useClientes();

  const resumen = useMemo(() => {
    const total = clientes.length;
    const entregados = clientes.filter(c =>
      ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st)
    );
    const fallidos = clientes.filter(c =>
      ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'].includes(c.st)
    );
    const pendientes = clientes.filter(c => c.st === 'pendiente' || !c.st);

    const cobradoTotal = entregados.reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);
    const porCobrarTotal = pendientes.reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

    // === SECCIÓN TUYO (pagos que te pertenecen) ===
    const seccionTuyo = [
      { key: 'efectivo', label: '💵 Efectivo', count: 0, monto: 0 },
      { key: 'yape-rudy', label: '📱 Yape Rudy', count: 0, monto: 0 },
      { key: 'cambio', label: '🔄 Cambio', count: 0, monto: 0 },
      { key: 'yape-efectivo', label: '💜 Yape+Efectivo', count: 0, monto: 0 },
      { key: 'mixto', label: '🔀 Mixto (tu parte)', count: 0, monto: 0 },
    ];

    // === SECCIÓN EMPRESA (pagos para la empresa) ===
    const seccionEmpresa = [
      { key: 'pos', label: '💳 POS', count: 0, monto: 0 },
      { key: 'pago-link', label: '🔗 Pago Link', count: 0, monto: 0 },
      { key: 'transferencia', label: '🏢 Transferencia', count: 0, monto: 0 },
      { key: 'yape-plin', label: '📱 Yape/Plin', count: 0, monto: 0 },
      { key: 'jose-smith', label: '🤝 José Smith', count: 0, monto: 0 },
      { key: 'empresa', label: '🏪 En Empresa', count: 0, monto: 0 },
    ];

    // === SECCIÓN NO ENTREGADOS ===
    const seccionNoEntregados = [
      { key: 'fallida', label: '❌ Fallida', count: 0, monto: 0 },
      { key: 'reprogramar', label: '🔄 Reprogramar', count: 0, monto: 0 },
      { key: 'rechazado', label: '🚫 Rechazado', count: 0, monto: 0 },
      { key: 'cambio', label: '↩️ Devuelto', count: 0, monto: 0 },
      { key: 'ausente', label: '🚶 Ausente', count: 0, monto: 0 },
      { key: 'no-contesta', label: '📵 No Contesta', count: 0, monto: 0 },
      { key: 'cancelado', label: '✖ Cancelado', count: 0, monto: 0 },
    ];

    // Contar y sumar
    clientes.forEach(c => {
      const st = c.st || 'pendiente';
      const cobrar = parseFloat(String(c.cobrar || 0));

      // Tuyo
      const tuyo = seccionTuyo.find(s => s.key === st);
      if (tuyo) { tuyo.count++; tuyo.monto += cobrar; }

      // Empresa
      const emp = seccionEmpresa.find(s => s.key === st);
      if (emp) { emp.count++; emp.monto += cobrar; }

      // No entregados
      const noEnt = seccionNoEntregados.find(s => s.key === st);
      if (noEnt) { noEnt.count++; noEnt.monto += cobrar; }
    });

    // Totales
    const totalTuyo = seccionTuyo.reduce((sum, s) => sum + s.monto, 0);
    const totalEmpresa = seccionEmpresa.reduce((sum, s) => sum + s.monto, 0);
    const totalNoEntregados = seccionNoEntregados.reduce((sum, s) => sum + s.monto, 0);

    // Datos para gráficos
    const datosPie = [
      ...seccionTuyo.filter(s => s.count > 0).map(s => ({ name: s.label, value: parseFloat(s.monto.toFixed(2)), count: s.count, tipo: 'tuyo' })),
      ...seccionEmpresa.filter(s => s.count > 0).map(s => ({ name: s.label, value: parseFloat(s.monto.toFixed(2)), count: s.count, tipo: 'empresa' })),
    ];

    // Entregas por distrito (top 8)
    const distritosCounts: Record<string, { count: number; monto: number }> = {};
    entregados.forEach(c => {
      const dist = (c.dist || 'Sin distrito').trim();
      if (!distritosCounts[dist]) distritosCounts[dist] = { count: 0, monto: 0 };
      distritosCounts[dist].count++;
      distritosCounts[dist].monto += parseFloat(String(c.cobrar || 0));
    });
    const distritosData = Object.entries(distritosCounts)
      .map(([distrito, d]) => ({
        distrito: distrito.length > 10 ? distrito.substring(0, 10) + '...' : distrito,
        entregas: d.count,
        monto: parseFloat(d.monto.toFixed(2)),
      }))
      .sort((a, b) => b.entregas - a.entregas)
      .slice(0, 8);

    // Datos para Area Chart (simulado por hora del día - en base a la hora de entrega)
    const horasData: { hora: string; entregas: number; monto: number }[] = [];
    const horasMap: Record<string, { entregas: number; monto: number }> = {};
    entregados.forEach(c => {
      const hora = c.hora || '';
      if (hora) {
        const h = hora.substring(0, 2) + ':00';
        if (!horasMap[h]) horasMap[h] = { entregas: 0, monto: 0 };
        horasMap[h].entregas++;
        horasMap[h].monto += parseFloat(String(c.cobrar || 0));
      }
    });
    Object.entries(horasMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([hora, data]) => {
        horasData.push({ hora, entregas: data.entregas, monto: parseFloat(data.monto.toFixed(2)) });
      });

    // Si no hay horas, mostrar datos vacíos
    if (horasData.length === 0) {
      horasData.push({ hora: '—', entregas: 0, monto: 0 });
    }

    return {
      total,
      entregadosCount: entregados.length,
      fallidosCount: fallidos.length,
      pendientesCount: pendientes.length,
      cobradoTotal,
      porCobrarTotal,
      seccionTuyo: seccionTuyo.filter(s => s.count > 0),
      seccionEmpresa: seccionEmpresa.filter(s => s.count > 0),
      seccionNoEntregados: seccionNoEntregados.filter(s => s.count > 0),
      totalTuyo,
      totalEmpresa,
      totalNoEntregados,
      datosPie,
      distritosData,
      horasData,
      totalDia: cobradoTotal + porCobrarTotal,
      progreso: total > 0 ? Math.round((entregados.length / total) * 100) : 0,
    };
  }, [clientes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-400">Cargando resumen...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 max-w-4xl">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <PieIcon className="w-6 h-6 text-emerald-500" />
          Resumen del día
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Card principal: Total generado */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">💰 Total generado hoy</div>
            <div className="text-3xl sm:text-4xl font-black text-white mt-1">S/ {resumen.cobradoTotal.toFixed(2)}</div>
            <div className="text-xs text-slate-400 mt-1">de S/ {resumen.totalDia.toFixed(2)} totales</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase">Progreso</div>
            <div className="text-3xl font-black text-emerald-400">{resumen.progreso}%</div>
            <div className="w-24 h-2 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all" style={{ width: `${resumen.progreso}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Cards: Entregados, Pendientes, Fallidos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-2" />
          <div className="text-2xl font-black text-white">{resumen.entregadosCount}</div>
          <div className="text-[10px] text-emerald-400 uppercase font-bold">Entregados</div>
        </div>
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <Clock className="w-6 h-6 text-amber-400 mb-2" />
          <div className="text-2xl font-black text-white">{resumen.pendientesCount}</div>
          <div className="text-[10px] text-amber-400 uppercase font-bold">Pendientes</div>
        </div>
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
          <XCircle className="w-6 h-6 text-red-400 mb-2" />
          <div className="text-2xl font-black text-white">{resumen.fallidosCount}</div>
          <div className="text-[10px] text-red-400 uppercase font-bold">Fallidos</div>
        </div>
      </div>

      {/* 📊 GRÁFICO AREA: Entregas por hora del día */}
      {resumen.horasData.length > 0 && resumen.horasData[0].hora !== '—' && (
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
          <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
            <AreaIcon className="w-4 h-4 text-blue-400" />
            Curva de entregas por hora
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={resumen.horasData}>
              <defs>
                <linearGradient id="colorEntregas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hora" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
              />
              <Area type="monotone" dataKey="entregas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEntregas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 📊 GRÁFICO PIE: Distribución por método */}
      {resumen.datosPie.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
          <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-400" />
            Distribución por método de pago
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={resumen.datosPie}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {resumen.datosPie.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#fff' }}
                formatter={(value: any) => [`S/ ${Number(value).toFixed(2)}`, 'Monto']}
              />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 📊 GRÁFICO BARRAS: Entregas por distrito */}
      {resumen.distritosData.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
          <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Entregas por distrito
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={resumen.distritosData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="distrito" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
              />
              <Bar dataKey="entregas" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Entregas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 💜 SECCIÓN TUYO */}
      <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-purple-400" />
            💜 Total Tuyo
          </h3>
          <div className="text-xl font-black text-purple-400">S/ {resumen.totalTuyo.toFixed(2)}</div>
        </div>
        {resumen.seccionTuyo.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-xs">No hay pagos tuyos registrados</div>
        ) : (
          <div className="space-y-2">
            {resumen.seccionTuyo.map(s => (
              <div key={s.key} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-xs font-bold text-white">{s.label}</div>
                  <div className="text-[10px] text-slate-400">{s.count} {s.count === 1 ? 'entrega' : 'entregas'}</div>
                </div>
                <div className="text-sm font-black text-purple-400">S/ {s.monto.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🏦 SECCIÓN EMPRESA */}
      <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            🏦 Total Empresa
          </h3>
          <div className="text-xl font-black text-blue-400">S/ {resumen.totalEmpresa.toFixed(2)}</div>
        </div>
        {resumen.seccionEmpresa.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-xs">No hay pagos de empresa registrados</div>
        ) : (
          <div className="space-y-2">
            {resumen.seccionEmpresa.map(s => (
              <div key={s.key} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-xs font-bold text-white">{s.label}</div>
                  <div className="text-[10px] text-slate-400">{s.count} {s.count === 1 ? 'entrega' : 'entregas'}</div>
                </div>
                <div className="text-sm font-black text-blue-400">S/ {s.monto.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ❌ SECCIÓN NO ENTREGADOS */}
      <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            ❌ No Entregados
          </h3>
          <div className="text-xl font-black text-red-400">S/ {resumen.totalNoEntregados.toFixed(2)}</div>
        </div>
        {resumen.seccionNoEntregados.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-xs">No hay entregas fallidas 🎉</div>
        ) : (
          <div className="space-y-2">
            {resumen.seccionNoEntregados.map(s => (
              <div key={s.key} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-xs font-bold text-white">{s.label}</div>
                  <div className="text-[10px] text-slate-400">{s.count} {s.count === 1 ? 'cliente' : 'clientes'}</div>
                </div>
                <div className="text-sm font-black text-red-400">S/ {s.monto.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ⏳ Por cobrar */}
      {resumen.porCobrarTotal > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-amber-400 uppercase font-bold">⏳ Por cobrar (pendientes)</div>
              <div className="text-2xl font-black text-amber-400 mt-1">S/ {resumen.porCobrarTotal.toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase">Clientes</div>
              <div className="text-xl font-bold text-white">{resumen.pendientesCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {resumen.total === 0 && (
        <div className="p-8 rounded-2xl bg-slate-800 border border-slate-700 text-center">
          <PieIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            No hay clientes cargados. Importá tu Excel o sincronizá con el Modular para ver el resumen.
          </p>
        </div>
      )}
    </div>
  );
};
