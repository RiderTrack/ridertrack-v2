import React, { useState } from 'react';
import {
  Package,
  CheckCircle2,
  Clock,
  Users,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Activity,
  Send,
  Plus,
  ShoppingBag,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Target,
} from 'lucide-react';
import { Order, Driver, ActivityItem, WhatsAppMessage } from '../types';
import { construirGraficoHorario, ETIQUETAS_ESTADO } from '../utils/realData';
import { LiveMap } from './LiveMap';
import { KPIStatCard, Badge, Button, Card } from './ui';

interface DashboardStats {
  total: number;
  entregados: number;
  pendientes: number;
  fallidos: number;
  cobrado: number;
  porCobrar: number;
  totalDia: number;
}

interface DashboardViewProps {
  orders: Order[];
  drivers: Driver[];
  activities: ActivityItem[];
  whatsAppMessages: WhatsAppMessage[];
  stats: DashboardStats;
  loading: boolean;
  onOpenWhatsAppModal: (phone?: string, name?: string) => void;
  onOpenNewOrderModal: () => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  drivers,
  activities,
  whatsAppMessages,
  stats,
  loading,
  onOpenWhatsAppModal,
  onOpenNewOrderModal,
  onNavigateTab,
}) => {
  const [orderFilter, setOrderFilter] = useState<'all' | 'pendiente' | 'entregado' | 'cancelado'>('all');
  const [chartMode, setChartMode] = useState<'pedidos' | 'ingresos'>('pedidos');

  const hoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Métricas 100% reales desde la ruta activa
  const totalClientes = stats.total;
  const efectividad = totalClientes > 0
    ? Math.round((stats.entregados / totalClientes) * 100)
    : 0;
  const progresoCobro = stats.totalDia > 0
    ? Math.round((stats.cobrado / stats.totalDia) * 100)
    : 0;

  const datosHorarios = construirGraficoHorario(orders);
  const maxChartVal = chartMode === 'pedidos'
    ? Math.max(1, ...datosHorarios.map((d) => d.pedidos))
    : Math.max(1, ...datosHorarios.map((d) => d.ingresos));

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'all') return true;
    return o.estado === orderFilter;
  });

  // ── Estados de carga / vacío ─────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 pb-12">
        <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 animate-pulse">
          <div className="h-6 w-64 bg-slate-700 rounded mb-3" />
          <div className="h-4 w-96 bg-slate-700/60 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-800 border border-slate-700 animate-pulse" />
          ))}
        </div>
        <p className="text-center text-slate-400 text-sm py-4">
          Cargando datos de tu ruta desde Firestore...
        </p>
      </div>
    );
  }

  if (totalClientes === 0) {
    return (
      <div className="space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-500/20 shadow-2xl">
          <div className="space-y-1">
            <Badge variant="blue" dot pulse size="sm">
              <Sparkles className="w-3 h-3" /> Ruta del Día
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Panel de Operaciones
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {hoy} — Todavía no hay clientes en tu ruta.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              onClick={onOpenNewOrderModal}
            >
              Agregar Pedido
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => onNavigateTab('ruta')}
            >
              Ir a Mi Ruta
            </Button>
          </div>
        </div>
        <Card className="text-center py-12 space-y-3">
          <Package className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="font-bold text-white">Tu ruta está vacía</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Agrega clientes manualmente, impórtalos desde Excel o sincronízalos desde el
            bot en la pestaña <span className="text-blue-400 font-semibold">Mi Ruta</span>.
            Aquí verás tus KPIs en tiempo real apenas tengas entregas.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado del día */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="green" dot pulse size="sm">
              <Sparkles className="w-3 h-3" /> Datos en vivo
            </Badge>
            <span className="text-xs text-slate-400 font-mono capitalize">{hoy}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Panel de Operaciones
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            {totalClientes} clientes en ruta · sincronizado en tiempo real con Firestore y el bot Rudy.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={onOpenNewOrderModal}
          >
            Agregar Pedido
          </Button>
          <Button
            variant="whatsapp"
            size="md"
            icon={<Send className="w-4 h-4" />}
            onClick={() => onOpenWhatsAppModal()}
          >
            Enviar WhatsApp
          </Button>
        </div>
      </div>

      {/* KPI Grid — 100% datos reales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIStatCard
          title="Entregados Hoy"
          value={stats.entregados}
          change={`de ${totalClientes} en ruta`}
          trend="up"
          periodText={`${efectividad}% de efectividad`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          iconBgColor="bg-emerald-500/15"
          iconColor="text-emerald-400"
          progressPercent={efectividad}
          progressColor="bg-emerald-500"
          onClick={() => onNavigateTab('pedidos')}
        />

        <KPIStatCard
          title="Pendientes"
          value={stats.pendientes}
          change={`S/ ${stats.porCobrar.toFixed(2)} por cobrar`}
          trend={stats.pendientes > 0 ? 'neutral' : 'up'}
          periodText="esperando entrega"
          icon={<Clock className="w-5 h-5" />}
          iconBgColor="bg-amber-500/15"
          iconColor="text-amber-400"
          progressPercent={totalClientes > 0 ? Math.round((stats.pendientes / totalClientes) * 100) : 0}
          progressColor="bg-amber-500"
          onClick={() => onNavigateTab('pedidos')}
        />

        <KPIStatCard
          title="Con Incidencias"
          value={stats.fallidos}
          change={stats.fallidos > 0 ? 'considera reintentar' : 'sin incidencias'}
          trend={stats.fallidos > 0 ? 'down' : 'up'}
          periodText="fallidas / rechazadas"
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBgColor="bg-red-500/15"
          iconColor="text-red-400"
          onClick={() => onNavigateTab('pedidos')}
        />

        <KPIStatCard
          title="Cobrado Hoy"
          value={`S/ ${stats.cobrado.toFixed(2)}`}
          change={`de S/ ${stats.totalDia.toFixed(2)} del día`}
          trend="up"
          periodText={`${progresoCobro}% de la cobranza`}
          icon={<DollarSign className="w-5 h-5" />}
          iconBgColor="bg-emerald-500/15"
          iconColor="text-emerald-400"
          progressPercent={progresoCobro}
          progressColor="bg-emerald-500"
          onClick={() => onNavigateTab('estadisticas')}
        />

        <KPIStatCard
          title="Por Cobrar"
          value={`S/ ${stats.porCobrar.toFixed(2)}`}
          change={`${stats.pendientes} ${stats.pendientes === 1 ? 'entrega' : 'entregas'} pendientes`}
          trend="neutral"
          periodText="en la ruta"
          icon={<Target className="w-5 h-5" />}
          iconBgColor="bg-blue-500/15"
          iconColor="text-blue-400"
          onClick={() => onNavigateTab('pedidos')}
        />

        <KPIStatCard
          title="Clientes en Ruta"
          value={totalClientes}
          change="ruta activa"
          trend="neutral"
          periodText="total del día"
          icon={<Users className="w-5 h-5" />}
          iconBgColor="bg-cyan-500/15"
          iconColor="text-cyan-400"
          onClick={() => onNavigateTab('ruta')}
        />

        <KPIStatCard
          title="Efectividad"
          value={`${efectividad}%`}
          change={`${stats.entregados} de ${totalClientes}`}
          trend={efectividad >= 80 ? 'up' : efectividad >= 50 ? 'neutral' : 'down'}
          periodText="entregas completadas"
          icon={<TrendingUp className="w-5 h-5" />}
          iconBgColor="bg-purple-500/15"
          iconColor="text-purple-400"
          progressPercent={efectividad}
          progressColor="bg-purple-500"
          onClick={() => onNavigateTab('estadisticas')}
        />

        <KPIStatCard
          title="WhatsApp Enviados"
          value={whatsAppMessages.length}
          change="desde la app hoy"
          trend="neutral"
          periodText="vía wa.me"
          icon={<MessageSquare className="w-5 h-5" />}
          iconBgColor="bg-teal-500/15"
          iconColor="text-teal-400"
          onClick={() => onNavigateTab('whatsapp')}
        />
      </div>

      {/* Row 2: Chart & Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Card — entregas reales por hora */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  Entregas por Hora
                </h3>
                <p className="text-xs text-slate-400">Distribución real de tus entregas cobradas del día</p>
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
                Entregas
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

          {datosHorarios.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
              <Clock className="w-8 h-8 text-slate-600" />
              <p className="text-xs text-slate-400 max-w-xs">
                Aún no hay entregas con hora registrada. El gráfico se llena
                cuando marques pedidos como pagados.
              </p>
            </div>
          ) : (
            <div className="pt-4 h-64 w-full">
              <div className="flex h-48 items-end gap-2 sm:gap-3 px-2 border-b border-slate-700/60 pb-2">
                {datosHorarios.map((item, idx) => {
                  const val = chartMode === 'pedidos' ? item.pedidos : item.ingresos;
                  const heightPct = Math.min(100, Math.max(12, (val / maxChartVal) * 100));

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-12 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] font-bold p-1.5 rounded-lg border border-slate-700 shadow-xl whitespace-nowrap z-20 pointer-events-none transition-opacity">
                        {item.etiqueta}: {chartMode === 'pedidos' ? `${val} entregas` : `S/ ${val.toFixed(2)}`}
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
                      <span className="text-[10px] font-mono text-slate-400 mt-1">
                        {item.etiqueta}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-3 text-xs text-slate-400">
                <span className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${chartMode === 'pedidos' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  {datosHorarios.length} {datosHorarios.length === 1 ? 'hora con actividad' : 'horas con actividad'}
                </span>
                <span className="font-semibold">
                  Total: {chartMode === 'pedidos'
                    ? `${stats.entregados} entregas`
                    : `S/ ${stats.cobrado.toFixed(2)}`}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Live Activity Feed Card */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Actividad del Día</h3>
              </div>
              <Badge variant="blue" size="sm" dot pulse>Live</Badge>
            </div>

            <div className="mt-4 space-y-3.5">
              {activities.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Sin actividad registrada todavía.
                </p>
              )}
              {activities.slice(0, 6).map((act) => (
                <div key={act.id} className="flex items-start gap-3 group">
                  <div className={`p-2 rounded-xl bg-slate-700/60 border border-slate-700 group-hover:bg-blue-600 group-hover:text-white transition-colors ${
                    act.tipoColor === 'green' ? 'text-emerald-400' : act.tipoColor === 'amber' ? 'text-amber-400' : act.tipoColor === 'emerald' ? 'text-emerald-400' : 'text-blue-400'
                  }`}>
                    {act.tipo === 'pedido' ? (
                      act.icono === 'AlertTriangle' ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : act.icono === 'Camera' ? (
                        <ShoppingBag className="w-4 h-4" />
                      ) : (
                        <ShoppingBag className="w-4 h-4" />
                      )
                    ) : act.tipo === 'repartidor' ? (
                      <Users className="w-4 h-4" />
                    ) : act.tipo === 'whatsapp' ? (
                      <MessageSquare className="w-4 h-4 text-emerald-400 group-hover:text-white" />
                    ) : (
                      <Users className="w-4 h-4" />
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
            onClick={() => onNavigateTab('estadisticas')}
          >
            Ver Resumen del Día
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

      {/* WhatsApp — envíos directos reales */}
      <Card className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-emerald-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">
                  Mensajería WhatsApp
                </h3>
                <Badge variant="green" size="sm" dot pulse>wa.me</Badge>
              </div>
              <p className="text-xs text-slate-300">
                Envía mensajes directos a tus clientes desde la app. El bot Rudy atiende los mensajes entrantes.
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
            <span className="text-[11px] text-slate-400 block">Enviados hoy (app)</span>
            <span className="text-lg font-black text-emerald-400">{whatsAppMessages.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80">
            <span className="text-[11px] text-slate-400 block">Cobros Pendientes</span>
            <span className="text-lg font-black text-amber-400">{stats.pendientes}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80">
            <span className="text-[11px] text-slate-400 block">Cobrado Hoy</span>
            <span className="text-lg font-black text-emerald-400">S/ {stats.cobrado.toFixed(2)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80">
            <span className="text-[11px] text-slate-400 block">Efectividad</span>
            <span className="text-lg font-black text-blue-400">{efectividad}%</span>
          </div>
        </div>
      </Card>

      {/* Pedidos de la ruta — tabla real */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                Pedidos de la Ruta
              </h3>
              <p className="text-xs text-slate-400">
                Gestiona cobros y estados en la pestaña Pedidos
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
                Pendientes ({stats.pendientes})
              </button>
              <button
                onClick={() => setOrderFilter('entregado')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  orderFilter === 'entregado'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Entregados ({stats.entregados})
              </button>
              <button
                onClick={() => setOrderFilter('cancelado')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  orderFilter === 'cancelado'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Fallidos ({stats.fallidos})
              </button>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-700/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-700/80">
              <tr>
                <th className="p-3.5 pl-4">Nº</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Distrito</th>
                <th className="p-3.5">Estado</th>
                <th className="p-3.5">Cobrar</th>
                <th className="p-3.5">Hora</th>
                <th className="p-3.5 text-right pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No hay pedidos en este filtro
                  </td>
                </tr>
              )}
              {filteredOrders.map((ord) => {
                const badgeVariant =
                  ord.estado === 'entregado'
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
                      #{ord.num ?? '—'}
                    </td>
                    <td className="p-3.5 font-medium text-white">
                      {ord.cliente}
                      <span className="block text-[10px] text-slate-400 font-mono">
                        {ord.clienteTelefono || 'sin teléfono'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300">
                      {ord.distrito || '—'}
                    </td>
                    <td className="p-3.5">
                      <Badge variant={badgeVariant} size="sm">
                        {ETIQUETAS_ESTADO[ord.stReal || ''] || ord.stReal || 'Pendiente'}
                      </Badge>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400">
                      S/ {ord.monto.toFixed(2)}
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">{ord.hora || '—'}</td>
                    <td className="p-3.5 text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {ord.clienteTelefono && (
                          <Button
                            variant="whatsapp"
                            size="xs"
                            icon={<MessageSquare className="w-3.5 h-3.5" />}
                            onClick={() => onOpenWhatsAppModal(ord.clienteTelefono, ord.cliente)}
                            title="Enviar WhatsApp al cliente"
                          />
                        )}
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => onNavigateTab('pedidos')}
                          title="Gestionar en Pedidos"
                        >
                          Gestionar
                        </Button>
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
