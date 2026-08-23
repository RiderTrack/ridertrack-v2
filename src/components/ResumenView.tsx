// ═══════════════════════════════════════════════════════════
// 📊 RESUMEN VIEW - RiderTrack V2
// Resumen del día con datos REALES de Firestore + gráficos
// ═══════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
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
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useClientes } from '../hooks/useClientes';

// Colores para los gráficos
const COLORES_METODOS = [
  '#10b981', // emerald - efectivo
  '#a855f7', // purple - yape-rudy
  '#c084fc', // purple-light - yape-efectivo
  '#9333ea', // purple-dark - yape-plin
  '#3b82f6', // blue - transferencia
  '#06b6d4', // cyan - pos
  '#f59e0b', // amber - pago-link
  '#ef4444', // red - jose-smith
  '#6366f1', // indigo - empresa
  '#eab308', // yellow - cambio
  '#64748b', // slate - mixto
];

export const ResumenView: React.FC = () => {
  const { clientes, loading } = useClientes();

  // Calcular estadísticas REALES desde los clientes
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

    // Datos para gráfico de pie (métodos de pago)
    const metodosData: { name: string; value: number; count: number }[] = [];
    const metodosInfo: Record<string, { label: string; emoji: string }> = {
      'efectivo': { label: 'Efectivo', emoji: '💵' },
      'yape-rudy': { label: 'Yape Rudy', emoji: '📲' },
      'yape-efectivo': { label: 'Yape+Efectivo', emoji: '💜' },
      'yape-plin': { label: 'Yape/Plin', emoji: '📲' },
      'transferencia': { label: 'Transferencia', emoji: '🏦' },
      'pos': { label: 'POS', emoji: '💳' },
      'pago-link': { label: 'Pago Link', emoji: '🔗' },
      'jose-smith': { label: 'José Smith', emoji: '🤝' },
      'empresa': { label: 'Empresa', emoji: '🏪' },
      'cambio': { label: 'Cambio', emoji: '💱' },
      'mixto': { label: 'Mixto', emoji: '🔀' },
    };

    const porMetodoCounts: Record<string, number> = {};
    entregados.forEach(c => {
      const st = c.st || '';
      if (porMetodoCounts[st]) porMetodoCounts[st]++;
      else porMetodoCounts[st] = 1;
    });

    Object.entries(porMetodoCounts).forEach(([key, count]) => {
      const monto = entregados
        .filter(c => c.st === key)
        .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);
      if (metodosInfo[key]) {
        metodosData.push({
          name: `${metodosInfo[key].emoji} ${metodosInfo[key].label}`,
          value: parseFloat(monto.toFixed(2)),
          count,
        });
      }
    });

    // Datos para gráfico de barras (entregas por distrito)
    const distritosCounts: Record<string, { count: number; monto: number }> = {};
    entregados.forEach(c => {
      const dist = (c.dist || 'Sin distrito').trim();
      if (!distritosCounts[dist]) distritosCounts[dist] = { count: 0, monto: 0 };
      distritosCounts[dist].count++;
      distritosCounts[dist].monto += parseFloat(String(c.cobrar || 0));
    });

    const distritosData = Object.entries(distritosCounts)
      .map(([distrito, data]) => ({
        distrito: distrito.length > 12 ? distrito.substring(0, 12) + '...' : distrito,
        entregas: data.count,
        monto: parseFloat(data.monto.toFixed(2)),
      }))
      .sort((a, b) => b.entregas - a.entregas)
      .slice(0, 8);

    // Pagos para ti (Yape Rudy, Yape+Efectivo, José Smith)
    const pagosTuyos = ['yape-rudy', 'yape-efectivo', 'jose-smith'];
    const montoTuyo = entregados
      .filter(c => pagosTuyos.includes(c.st || ''))
      .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

    // Pagos para empresa
    const pagosEmpresa = ['empresa', 'transferencia', 'pos', 'pago-link'];
    const montoEmpresa = entregados
      .filter(c => pagosEmpresa.includes(c.st || ''))
      .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

    // Efectivo en mano
    const montoEfectivo = entregados
      .filter(c => c.st === 'efectivo' || c.st === 'yape-efectivo' || c.st === 'mixto')
      .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

    return {
      total,
      entregadosCount: entregados.length,
      fallidosCount: fallidos.length,
      pendientesCount: pendientes.length,
      cobradoTotal,
      porCobrarTotal,
      metodosData,
      distritosData,
      montoTuyo,
      montoEmpresa,
      montoEfectivo,
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
            <div className="text-xs text-slate-400 mt-1">
              de S/ {resumen.totalDia.toFixed(2)} totales
            </div>
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

      {/* 3 Cards: Pagos tuyos, Empresa, Efectivo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-purple-400" />
            <div className="text-[10px] text-purple-400 uppercase font-bold">Para ti</div>
          </div>
          <div className="text-xl font-black text-white">S/ {resumen.montoTuyo.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 mt-1">Yape Rudy, José Smith</div>
        </div>
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <div className="text-[10px] text-blue-400 uppercase font-bold">Para empresa</div>
          </div>
          <div className="text-xl font-black text-white">S/ {resumen.montoEmpresa.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 mt-1">Transferencia, POS</div>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <div className="text-[10px] text-emerald-400 uppercase font-bold">Efectivo</div>
          </div>
          <div className="text-xl font-black text-white">S/ {resumen.montoEfectivo.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 mt-1">En mano</div>
        </div>
      </div>

      {/* 📊 GRÁFICO: Métodos de pago (Pie Chart) */}
      {resumen.metodosData.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
          <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-400" />
            Distribución por método de pago
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={resumen.metodosData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => percent && percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {resumen.metodosData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORES_METODOS[index % COLORES_METODOS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: any) => [`S/ ${Number(value).toFixed(2)}`, 'Monto']}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 📊 GRÁFICO: Entregas por distrito (Bar Chart) */}
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
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              <Bar dataKey="entregas" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Entregas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detalle por método de pago (lista) */}
      {resumen.metodosData.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
          <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Detalle por método de pago
          </h3>
          <div className="space-y-2">
            {resumen.metodosData.map((data, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORES_METODOS[idx % COLORES_METODOS.length] }}></span>
                  <div>
                    <div className="text-sm font-bold text-white">{data.name}</div>
                    <div className="text-[10px] text-slate-400">{data.count} {data.count === 1 ? 'entrega' : 'entregas'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-emerald-400">S/ {data.value.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">{((data.value / resumen.cobradoTotal) * 100).toFixed(0)}% del total</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Por cobrar */}
      {resumen.porCobrarTotal > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-amber-400 uppercase font-bold">⏳ Por cobrar</div>
              <div className="text-2xl font-black text-amber-400 mt-1">S/ {resumen.porCobrarTotal.toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase">Pendientes</div>
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
