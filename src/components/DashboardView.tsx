import React, { useState } from 'react';
import {
  Package,
  CheckCircle2,
  Clock,
  Timer,
  Users,
  MessageSquare,
  Bike,
  DollarSign,
  TrendingUp,
  Activity,
  Send,
  Plus,
  ShoppingBag,
  UserPlus,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Order, Driver, ActivityItem, WhatsAppMessage, OrderStatus } from '../types';
import { HOURLY_ORDERS_DATA } from '../data/mockData';
import { LiveMap } from './LiveMap';
import { KPIStatCard, Badge, Button, Card } from './ui';

interface DashboardViewProps {
  orders: Order[];
  drivers: Driver[];
  activities: ActivityItem[];
  whatsAppMessages: WhatsAppMessage[];
  onOpenWhatsAppModal: (phone?: string, name?: string) => void;
  onOpenNewOrderModal: () => void;
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  drivers,
  activities,
  whatsAppMessages,
  onOpenWhatsAppModal,
  onOpenNewOrderModal,
  onUpdateOrderStatus,
  onNavigateTab,
}) => {
  const [orderFilter, setOrderFilter] = useState<'all' | 'pendiente' | 'en_camino' | 'entregado'>('all');
  const [chartMode, setChartMode] = useState<'pedidos' | 'ingresos'>('pedidos');

  // Computed Key Metrics
  const activeOrdersCount = orders.filter((o) => o.estado === 'en_camino').length;
  const deliveredTodayCount = orders.filter((o) => o.estado === 'entregado').length + 182;
  const pendingOrdersCount = orders.filter((o) => o.estado === 'pendiente').length;
  const avgDeliveryMinutes = 23.4;
  const totalCustomersCount = 1420;
  const totalWhatsAppSent = 3850 + whatsAppMessages.length;
  const onlineDriversCount = drivers.filter((d) => d.estado !== 'inactivo').length;
  const totalRevenueToday = orders.reduce((acc, o) => acc + o.monto, 0) + 3840;

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'all') return true;
    return o.estado === orderFilter;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Dispatcher Command Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="blue" dot pulse size="sm">
              <Sparkles className="w-3 h-3" /> Dispatcher Center V2
            </Badge>
            <span className="text-xs text-slate-400 font-mono">31 de Julio, 2026</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Centro de Despacho & Telemetría
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Control operativo de flotas en tiempo real, asignaciones automáticas y comunicación omnicanal WhatsApp.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={onOpenNewOrderModal}
          >
            Nuevo Pedido
          </Button>
          <Button
            variant="whatsapp"
            size="md"
            icon={<Send className="w-4 h-4" />}
            onClick={() => onOpenWhatsAppModal()}
          >
            WhatsApp API
          </Button>
        </div>
      </div>

      {/* Standardized KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIStatCard
          title="Pedidos Activos"
          value={activeOrdersCount}
          change="+12.4%"
          trend="up"
          periodText="en tránsito"
          icon={<Package className="w-5 h-5" />}
          iconBgColor="bg-blue-500/15"
          iconColor="text-blue-400"
          progressPercent={82}
          progressColor="bg-blue-500"
          onClick={() => onNavigateTab('pedidos')}
        />

        <KPIStatCard
          title="Entregados Hoy"
          value={deliveredTodayCount}
          change="+8.2%"
          trend="up"
          periodText="98.2% efectividad"
          icon={<CheckCircle2 className="w-5 h-5" />}
          iconBgColor="bg-emerald-500/15"
          iconColor="text-emerald-400"
          progressPercent={98}
          progressColor="bg-emerald-500"
          onClick={() => onNavigateTab('pedidos')}
        />

        <KPIStatCard
          title="Pedidos Pendientes"
          value={pendingOrdersCount}
          change="En cola"
          trend="neutral"
          periodText="requieren asignación"
          icon={<Clock className="w-5 h-5" />}
          iconBgColor="bg-amber-500/15"
          iconColor="text-amber-400"
          progressPercent={35}
          progressColor="bg-amber-500"
          onClick={() => onNavigateTab('pedidos')}
        />

        <KPIStatCard
          title="Tiempo Prom. Entrega"
          value={`${avgDeliveryMinutes} min`}
          change="-3.2 min"
          trend="up"
          periodText="sub 30 min meta"
          icon={<Timer className="w-5 h-5" />}
          iconBgColor="bg-purple-500/15"
          iconColor="text-purple-400"
          progressPercent={92}
          progressColor="bg-purple-500"
          onClick={() => onNavigateTab('reportes')}
        />

        <KPIStatCard
          title="Clientes Registrados"
          value={totalCustomersCount.toLocaleString('es-PE')}
          change="+28 hoy"
          trend="up"
          periodText="base activa"
          icon={<Users className="w-5 h-5" />}
          iconBgColor="bg-cyan-500/15"
          iconColor="text-cyan-400"
          onClick={() => onNavigateTab('clientes')}
        />

        <KPIStatCard
          title="Notificaciones WhatsApp"
          value={totalWhatsAppSent.toLocaleString('es-PE')}
          change="99.9%"
          trend="up"
          periodText="tasa de entrega"
          icon={<MessageSquare className="w-5 h-5" />}
          iconBgColor="bg-teal-500/15"
          iconColor="text-teal-400"
          onClick={() => onNavigateTab('whatsapp')}
        />

        <KPIStatCard
          title="Repartidores Activos"
          value={`${onlineDriversCount} / ${drivers.length}`}
          change="100% GPS"
          trend="up"
          periodText="en servicio"
          icon={<Bike className="w-5 h-5" />}
          iconBgColor="bg-indigo-500/15"
          iconColor="text-indigo-400"
          onClick={() => onNavigateTab('repartidores')}
        />

        <KPIStatCard
          title="Ingresos del Día"
          value={`S/ ${totalRevenueToday.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
          change="+18.5%"
          trend="up"
          periodText="ticket alto"
          icon={<DollarSign className="w-5 h-5" />}
          iconBgColor="bg-emerald-500/15"
          iconColor="text-emerald-400"
          onClick={() => onNavigateTab('estadisticas')}
        />
      </div>

      {/* Row 2: Chart & Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Card */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  Flujo de Operación Horaria
                </h3>
                <p className="text-xs text-slate-400">Distribución de carga de pedidos e ingresos por hora</p>
              </div>
            </div>

            <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setChartMode('pedidos')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartMode === 'pedidos'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pedidos
              </button>
              <button
                onClick={() => setChartMode('ingresos')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartMode === 'ingresos'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ingresos (S/)
              </button>
            </div>
          </div>

          <div className="pt-4 h-64 w-full">
            <div className="flex h-48 items-end gap-2 sm:gap-3 px-2 border-b border-slate-700/60 pb-2">
              {HOURLY_ORDERS_DATA.map((item, idx) => {
                const maxVal = chartMode === 'pedidos' ? 120 : 3800;
                const val = chartMode === 'pedidos' ? item.pedidos : item.ingresos;
                const heightPct = Math.min(100, Math.max(12, (val / maxVal) * 100));

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] font-bold p-1.5 rounded-lg border border-slate-700 shadow-xl whitespace-nowrap z-20 pointer-events-none transition-opacity">
                      {item.hora}: {chartMode === 'pedidos' ? `${val} pedidos` : `S/ ${val}`}
                    </div>

                    <div className="w-full bg-slate-700/40 rounded-t-lg overflow-hidden flex items-end h-full">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-lg transition-all duration-500 group-hover:brightness-125 ${
                          chartMode === 'pedidos'
                            ? 'bg-gradient-to-t from-blue-600 to-indigo-500'
                            : 'bg-gradient-to-t from-emerald-600 to-teal-400'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 rotate-45 sm:rotate-0 mt-1">
                      {item.hora.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-3 text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Hora pico: 13:00 hrs (110 pedidos/hr)
              </span>
              <span className="text-emerald-400 font-semibold">Tasa de cumplimiento: 98.4%</span>
            </div>
          </div>
        </Card>

        {/* Live Activity Feed Card */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Actividad en Vivo</h3>
              </div>
              <Badge variant="blue" size="sm" dot pulse>Live</Badge>
            </div>

            <div className="mt-4 space-y-3.5">
              {activities.slice(0, 5).map((act) => (
                <div key={act.id} className="flex items-start gap-3 group">
                  <div className="p-2 rounded-xl bg-slate-700/60 border border-slate-700 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {act.tipo === 'pedido' ? (
                      <ShoppingBag className="w-4 h-4" />
                    ) : act.tipo === 'repartidor' ? (
                      <Bike className="w-4 h-4" />
                    ) : act.tipo === 'whatsapp' ? (
                      <MessageSquare className="w-4 h-4 text-emerald-400 group-hover:text-white" />
                    ) : (
                      <UserPlus className="w-4 h-4 text-amber-400 group-hover:text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {act.titulo}
                    </p>
                    <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">
                      {act.descripcion}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                      {act.tiempo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-4 justify-center text-blue-400 hover:text-blue-300 border border-blue-500/20"
            icon={<ChevronRight className="w-3.5 h-3.5" />}
            iconPosition="right"
            onClick={() => onNavigateTab('reportes')}
          >
            Ver Bitácora de Auditoría
          </Button>
        </Card>
      </div>

      {/* Live Map Panel */}
      <div className="space-y-2">
        <LiveMap
          drivers={drivers}
          orders={orders}
          onOpenWhatsApp={(phone, name) => onOpenWhatsAppModal(phone, name)}
        />
      </div>

      {/* WhatsApp Official API Section */}
      <Card className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-emerald-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">
                  WhatsApp Business Cloud API
                </h3>
                <Badge variant="green" size="sm" dot pulse>CONECTADO</Badge>
              </div>
              <p className="text-xs text-slate-300">
                Línea oficial Meta: +51 987 654 321 • Webhook respondieron en 12ms
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenWhatsAppModal()}
            >
              Plantillas
            </Button>
            <Button
              variant="whatsapp"
              size="sm"
              icon={<Send className="w-3 h-3" />}
              onClick={() => onOpenWhatsAppModal()}
            >
              Enviar Mensaje
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('whatsapp')}
            >
              Historial
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-700/50 mt-4">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80">
            <span className="text-[11px] text-slate-400 block">Mensajes Hoy</span>
            <span className="text-lg font-black text-emerald-400">3,850</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80">
            <span className="text-[11px] text-slate-400 block">Tasa de Lectura</span>
            <span className="text-lg font-black text-blue-400">96.8%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80">
            <span className="text-[11px] text-slate-400 block">Cola Pendiente</span>
            <span className="text-lg font-black text-slate-200">0 msgs</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80">
            <span className="text-[11px] text-slate-400 block">Plantillas Activas</span>
            <span className="text-lg font-black text-purple-400">4 / 4</span>
          </div>
        </div>
      </Card>

      {/* Recent Orders Panel */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                Monitoreo de Pedidos en Curso
              </h3>
              <p className="text-xs text-slate-400">
                Filtra y actualiza rápidamente el estado de despacho
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setOrderFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  orderFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({orders.length})
              </button>
              <button
                onClick={() => setOrderFilter('pendiente')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  orderFilter === 'pendiente'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setOrderFilter('en_camino')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  orderFilter === 'en_camino'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                En Camino
              </button>
              <button
                onClick={() => setOrderFilter('entregado')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  orderFilter === 'entregado'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Entregados
              </button>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-700/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-700/80">
              <tr>
                <th className="p-3.5 pl-4">ID Pedido</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Distrito / Zona</th>
                <th className="p-3.5">Estado</th>
                <th className="p-3.5">Repartidor</th>
                <th className="p-3.5">Hora</th>
                <th className="p-3.5 text-right pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredOrders.map((ord) => {
                const badgeVariant =
                  ord.estado === 'en_camino'
                    ? 'blue'
                    : ord.estado === 'entregado'
                    ? 'green'
                    : ord.estado === 'pendiente'
                    ? 'amber'
                    : 'red';

                return (
                  <tr
                    key={ord.id}
                    className="hover:bg-slate-700/40 transition-colors"
                  >
                    <td className="p-3.5 pl-4 font-mono font-bold text-blue-400">
                      {ord.id}
                    </td>
                    <td className="p-3.5 font-medium text-white">
                      {ord.cliente}
                      <span className="block text-[10px] text-slate-400 font-mono">
                        {ord.clienteTelefono}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300">
                      {ord.distrito}
                    </td>
                    <td className="p-3.5">
                      <Badge variant={badgeVariant} size="sm">
                        {ord.estado === 'en_camino'
                          ? 'En Camino'
                          : ord.estado === 'entregado'
                          ? 'Entregado'
                          : ord.estado === 'pendiente'
                          ? 'Pendiente'
                          : 'Cancelado'}
                      </Badge>
                    </td>
                    <td className="p-3.5">
                      {ord.repartidorNombre ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={ord.repartidorFoto}
                            alt={ord.repartidorNombre}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <span className="text-slate-200 font-medium">
                            {ord.repartidorNombre}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sin Asignar</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">{ord.hora}</td>
                    <td className="p-3.5 text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {ord.estado === 'pendiente' && (
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => onUpdateOrderStatus(ord.id, 'en_camino')}
                          >
                            Despachar
                          </Button>
                        )}
                        {ord.estado === 'en_camino' && (
                          <Button
                            variant="success"
                            size="xs"
                            onClick={() => onUpdateOrderStatus(ord.id, 'entregado')}
                          >
                            Completar
                          </Button>
                        )}
                        <Button
                          variant="whatsapp"
                          size="xs"
                          icon={<MessageSquare className="w-3.5 h-3.5" />}
                          onClick={() => onOpenWhatsAppModal(ord.clienteTelefono, ord.cliente)}
                          title="Enviar WhatsApp al cliente"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
