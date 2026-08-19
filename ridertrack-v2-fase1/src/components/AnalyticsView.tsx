import React, { useState } from 'react';
import {
  BarChart2,
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  Bike,
  CheckCircle2,
  Award,
  PieChart as PieIcon,
  Filter,
  ArrowUpRight
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
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid
} from 'recharts';

const HOURLY_PERFORMANCE = [
  { hora: '08:00', entregas: 12, ingresos: 1420 },
  { hora: '10:00', entregas: 32, ingresos: 3680 },
  { hora: '12:00', entregas: 82, ingresos: 8900 },
  { hora: '14:00', entregas: 90, ingresos: 9800 },
  { hora: '16:00', entregas: 58, ingresos: 6200 },
  { hora: '18:00', entregas: 74, ingresos: 8100 },
  { hora: '20:00', entregas: 60, ingresos: 6900 },
];

const DISTRICT_DISTRIBUTION = [
  { distrito: 'Miraflores', pedidos: 84, tiempoMin: 18.2 },
  { distrito: 'San Isidro', pedidos: 68, tiempoMin: 19.5 },
  { distrito: 'Surco', pedidos: 52, tiempoMin: 22.1 },
  { distrito: 'San Borja', pedidos: 41, tiempoMin: 21.0 },
  { distrito: 'La Molina', pedidos: 35, tiempoMin: 26.4 },
  { distrito: 'Barranco', pedidos: 29, tiempoMin: 17.8 },
];

const PAYMENT_METHODS = [
  { name: 'Yape / Plin', value: 48, color: '#06b6d4' },
  { name: 'Tarjeta Crédito/Débito', value: 32, color: '#3b82f6' },
  { name: 'Efectivo', value: 12, color: '#f59e0b' },
  { name: 'Transferencia Directa', value: 8, color: '#10b981' },
];

export const AnalyticsView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
              Executive Analytics Engine
            </span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2 mt-1">
            <BarChart2 className="w-6 h-6 text-blue-500" />
            Reportes & Analítica de Rendimiento
          </h1>
          <p className="text-xs text-slate-400">
            Métricas de SLA, tiempos de entrega, volumen financiero y balance por distrito
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeRange === 'today' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeRange === 'week' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeRange === 'month' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Este Mes
            </button>
          </div>

          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs border border-slate-600 transition-colors">
            <Download className="w-4 h-4" /> Exportar CSV / PDF
          </button>
        </div>
      </div>

      {/* Analytics Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700/80 shadow-xl">
          <span className="text-xs font-semibold text-slate-400">Cumplimiento SLA (Sub 30 min)</span>
          <div className="text-3xl font-black text-emerald-400 mt-1">98.4%</div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> +1.8% superando meta
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700/80 shadow-xl">
          <span className="text-xs font-semibold text-slate-400">Ticket Promedio</span>
          <div className="text-3xl font-black text-blue-400 mt-1">S/ 114.80</div>
          <p className="text-xs text-slate-400 mt-2">Basado en 369 entregas</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700/80 shadow-xl">
          <span className="text-xs font-semibold text-slate-400">Satisfacción del Cliente</span>
          <div className="text-3xl font-black text-amber-400 mt-1">4.92 ⭐</div>
          <p className="text-xs text-slate-400 mt-2">480 encuestas en WhatsApp</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700/80 shadow-xl">
          <span className="text-xs font-semibold text-slate-400">Costo Operativo / Orden</span>
          <div className="text-3xl font-black text-purple-400 mt-1">S/ 4.20</div>
          <p className="text-xs text-slate-400 mt-2">-8.4% en combustible/rutas</p>
        </div>
      </div>

      {/* Recharts Row 1: Area Curve & Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Volume Area Chart (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-800 border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
            <div>
              <h3 className="font-bold text-sm text-white">Curva de Entregas e Ingresos Generados</h3>
              <p className="text-xs text-slate-400">Evolución en soles y número de despachos</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs">
              Live Feed
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={HOURLY_PERFORMANCE}>
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hora" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorIngresos)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Donut Chart */}
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700/80 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-cyan-400" /> Distribución de Métodos de Pago
            </h3>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PAYMENT_METHODS}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {PAYMENT_METHODS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-700/60 text-xs">
            {PAYMENT_METHODS.map((pm, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pm.color }} />
                  <span className="text-slate-300 font-medium">{pm.name}</span>
                </div>
                <span className="font-bold text-white">{pm.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recharts Row 2: District Bar Chart */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700/80 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div>
            <h3 className="font-bold text-sm text-white">Demanda Operativa por Distrito</h3>
            <p className="text-xs text-slate-400">Total de pedidos completados por zona metropolitana</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={DISTRICT_DISTRIBUTION}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="distrito" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
              />
              <Bar dataKey="pedidos" fill="#06b6d4" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Driver Efficiency Leaderboard Table */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700/80 shadow-xl space-y-4">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" /> Ranking de Eficiencia de Flota
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-700">
              <tr>
                <th className="p-3 pl-4">Repartidor</th>
                <th className="p-3">Vehículo</th>
                <th className="p-3">Entregas Hoy</th>
                <th className="p-3">Tiempo Prom.</th>
                <th className="p-3">Rating</th>
                <th className="p-3 text-right pr-4">Comisión Estimada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              <tr>
                <td className="p-3 pl-4 font-bold text-white">Ana María Torres</td>
                <td className="p-3 text-slate-300">Moto</td>
                <td className="p-3 text-emerald-400 font-bold">19 completadas</td>
                <td className="p-3 text-slate-300 font-mono">18.2 min</td>
                <td className="p-3 text-amber-400 font-bold">4.95 ⭐</td>
                <td className="p-3 text-right pr-4 font-mono font-bold text-emerald-400">S/ 152.00</td>
              </tr>
              <tr>
                <td className="p-3 pl-4 font-bold text-white">Carlos Mendoza</td>
                <td className="p-3 text-slate-300">Moto</td>
                <td className="p-3 text-emerald-400 font-bold">16 completadas</td>
                <td className="p-3 text-slate-300 font-mono">20.4 min</td>
                <td className="p-3 text-amber-400 font-bold">4.90 ⭐</td>
                <td className="p-3 text-right pr-4 font-mono font-bold text-emerald-400">S/ 128.00</td>
              </tr>
              <tr>
                <td className="p-3 pl-4 font-bold text-white">Mateo Benítez</td>
                <td className="p-3 text-slate-300">Moto</td>
                <td className="p-3 text-emerald-400 font-bold">15 completadas</td>
                <td className="p-3 text-slate-300 font-mono">22.1 min</td>
                <td className="p-3 text-amber-400 font-bold">4.75 ⭐</td>
                <td className="p-3 text-right pr-4 font-mono font-bold text-emerald-400">S/ 120.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
