import React, { useState } from 'react';
import {
  Package,
  Plus,
  CheckCircle2,
  Clock,
  MessageSquare,
  MapPin,
  List,
  Columns,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Copy,
  ArrowUpDown,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { Order, Driver } from '../types';
import { ETIQUETAS_ESTADO, linkGoogleMaps } from '../utils/realData';
import { OrderControlCenter } from './order/OrderControlCenter';

interface OrdersViewProps {
  orders: Order[];
  drivers: Driver[];
  loading?: boolean;
  onOpenNewOrderModal: () => void;
  onOpenWhatsAppModal: (phone?: string, name?: string) => void;
  onRegistrarPago: (orderId: string, metodoPanel: string) => void;
  onCambiarEstado: (orderId: string, st: string) => void;
  onDeleteOrder: (orderId: string) => void;
  onDuplicateOrder: (order: Order) => void;
  onGuardarFoto: (orderId: string, blob: Blob, dataUrl: string) => void;
  onGuardarNota: (orderId: string, nota: string) => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning') => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  drivers,
  loading,
  onOpenNewOrderModal,
  onOpenWhatsAppModal,
  onRegistrarPago,
  onCambiarEstado,
  onDeleteOrder,
  onDuplicateOrder,
  onGuardarFoto,
  onGuardarNota,
  onShowToast,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendiente' | 'entregado' | 'cancelado'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'grid'>('table');
  const [sortField, setSortField] = useState<'num' | 'hora' | 'monto' | 'cliente'>('num');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [controlCenterOpen, setControlCenterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filter & Sorting logic
  const filteredOrders = orders
    .filter((o) => {
      const q = search.toLowerCase();
      const matchesSearch =
        String(o.num || '').includes(q) ||
        o.cliente.toLowerCase().includes(q) ||
        o.distrito.toLowerCase().includes(q) ||
        (o.stReal || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || o.estado === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'monto') {
        cmp = a.monto - b.monto;
      } else if (sortField === 'cliente') {
        cmp = a.cliente.localeCompare(b.cliente);
      } else if (sortField === 'num') {
        cmp = (a.num ?? 0) - (b.num ?? 0);
      } else {
        cmp = a.hora.localeCompare(b.hora);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenOrderCenter = (ord: Order) => {
    setSelectedOrder(ord);
    setControlCenterOpen(true);
  };

  const handleCopyAddress = (ord: Order) => {
    const url = linkGoogleMaps(ord.direccion, ord.distrito);
    navigator.clipboard.writeText(url).catch(() => {});
    if (onShowToast) {
      onShowToast(
        'Enlace de Ubicación Copiado',
        `${ord.direccion}, ${ord.distrito} — listo para pegar en WhatsApp`,
        'success'
      );
    }
  };

  const estadoBadge = (ord: Order) => {
    const classes =
      ord.estado === 'entregado'
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        : ord.estado === 'pendiente'
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        : 'bg-red-500/20 text-red-400 border-red-500/30';
    const label = ETIQUETAS_ESTADO[ord.stReal || ''] || ord.stReal || 'Pendiente';
    return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${classes}`}>{label}</span>;
  };

  const sortLabels: Record<string, string> = {
    num: 'orden de ruta',
    hora: 'hora de entrega',
    monto: 'monto',
    cliente: 'cliente',
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
              Ruta del Día
            </span>
            <span className="text-xs text-slate-400 font-mono">{orders.length} pedidos en ruta</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2 mt-1">
            <Package className="w-6 h-6 text-blue-500" />
            Centro de Pedidos
          </h1>
          <p className="text-xs text-slate-400">
            Toca cualquier pedido para cobrar, cambiar estado, enviar WhatsApp o subir evidencia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switches */}
          <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Tabla
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'kanban' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" /> Tablero
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Tarjetas
            </button>
          </div>

          <button
            onClick={onOpenNewOrderModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Agregar Pedido
          </button>
        </div>
      </div>

      {/* Filter & Sorting Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por Nº, cliente, distrito o estado..."
            className="w-full pl-4 pr-4 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {(['all', 'pendiente', 'entregado', 'cancelado'] as const).map((st) => {
            const count = st === 'all' ? orders.length : orders.filter((o) => o.estado === st).length;
            return (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                {st === 'all'
                  ? `Todos (${orders.length})`
                  : st === 'entregado'
                  ? `Entregados (${count})`
                  : st === 'pendiente'
                  ? `Pendientes (${count})`
                  : `Fallidos (${count})`}
              </button>
            );
          })}

          {/* Sort Selector */}
          <button
            onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
            title={`Ordenar por ${sortLabels[sortField]} (${sortDirection === 'asc' ? 'ascendente' : 'descendente'})`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-center text-slate-400 text-sm py-2">Cargando pedidos de tu ruta...</p>
      )}

      {!loading && orders.length === 0 && (
        <div className="p-8 text-center text-slate-400 bg-slate-800 rounded-2xl border border-slate-700">
          <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="font-bold text-white mb-1">Tu ruta no tiene pedidos todavía</p>
          <p className="text-xs">Agrega el primero con el botón "Agregar Pedido" o desde Mi Ruta.</p>
        </div>
      )}

      {/* MAIN VIEW MODE: TABLE / KANBAN / GRID */}
      {viewMode === 'table' && orders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table Container */}
          <div className="lg:col-span-2 rounded-2xl bg-slate-800 border border-slate-700/80 overflow-hidden shadow-xl flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="p-3.5 pl-4">Nº</th>
                    <th className="p-3.5">Cliente & Teléfono</th>
                    <th className="p-3.5">Distrito / Dirección</th>
                    <th className="p-3.5">Cobrar</th>
                    <th className="p-3.5">Estado</th>
                    <th className="p-3.5 text-right pr-4">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {paginatedOrders.map((ord) => {
                    const isSelected = selectedOrder?.id === ord.id;
                    return (
                      <tr
                        key={ord.id}
                        onClick={() => {
                          setSelectedOrder(ord);
                          handleOpenOrderCenter(ord);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-600/15 border-l-4 border-l-blue-500'
                            : 'hover:bg-slate-700/40'
                        }`}
                      >
                        <td className="p-3.5 pl-4 font-mono font-bold text-blue-400">#{ord.num ?? '—'}</td>
                        <td className="p-3.5 font-bold text-white">
                          {ord.cliente}
                          <span className="block text-[10px] text-slate-400 font-mono">{ord.clienteTelefono || 'sin teléfono'}</span>
                        </td>
                        <td className="p-3.5 text-slate-300">
                          <span className="font-bold block">{ord.distrito || '—'}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[160px] block">
                            {ord.direccion || 'sin dirección'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-400">
                          S/ {ord.monto.toFixed(2)}
                        </td>
                        <td className="p-3.5">{estadoBadge(ord)}</td>
                        <td className="p-3.5 text-right pr-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenOrderCenter(ord);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow flex items-center gap-1 ml-auto"
                          >
                            <Zap className="w-3 h-3 fill-amber-300 text-amber-300" /> Operar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        No hay pedidos que coincidan con la búsqueda o el filtro
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-700/80 bg-slate-900/50 flex items-center justify-between text-xs text-slate-400">
              <span>
                Mostrando {paginatedOrders.length} de {filteredOrders.length} pedidos
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-40 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-white font-bold">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-40 hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Inspector Detail Panel */}
          {selectedOrder ? (
            <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                <div>
                  <span className="text-[10px] uppercase font-mono text-blue-400 font-bold">
                    Ficha del Pedido
                  </span>
                  <h3 className="text-xl font-black text-white">#{selectedOrder.num ?? selectedOrder.id}</h3>
                </div>
                <button
                  onClick={() => handleCopyAddress(selectedOrder)}
                  className="p-2 rounded-xl bg-slate-700/80 text-blue-400 hover:text-white hover:bg-slate-700 border border-slate-600 transition-colors"
                  title="Copiar enlace de Google Maps de la dirección"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              {/* Customer Card */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Cliente</span>
                <p className="text-sm font-bold text-white">{selectedOrder.cliente}</p>
                <p className="text-xs text-slate-300 font-mono">{selectedOrder.clienteTelefono || 'sin teléfono'}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  {selectedOrder.direccion || 'sin dirección'} ({selectedOrder.distrito || '—'})
                </p>
                {selectedOrder.productos.length > 0 && (
                  <p className="text-xs text-slate-400 pt-1 border-t border-slate-800">
                    <span className="font-bold text-slate-300">Productos:</span> {selectedOrder.productos.join(', ')}
                  </p>
                )}
              </div>

              {/* Payment Summary */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Estado</span>
                  {estadoBadge(selectedOrder)}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-semibold">
                    {selectedOrder.estado === 'entregado' ? 'Cobrado' : 'Por Cobrar'}
                  </span>
                  <span className="text-base font-black text-emerald-400">S/ {selectedOrder.monto.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleOpenOrderCenter(selectedOrder)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-amber-300 text-amber-300" /> Abrir Centro de Operaciones
                </button>
                {selectedOrder.clienteTelefono && (
                  <button
                    onClick={() => onOpenWhatsAppModal(selectedOrder.clienteTelefono, selectedOrder.cliente)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" /> WhatsApp al Cliente
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 bg-slate-800 rounded-2xl border border-slate-700">
              Selecciona un pedido para abrir su Centro de Control
            </div>
          )}
        </div>
      )}

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'kanban' && orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['pendiente', 'entregado', 'cancelado'] as const).map((st) => {
            const colOrders = filteredOrders.filter((o) => o.estado === st);
            const titleMap = {
              pendiente: 'Pendientes',
              entregado: 'Entregados',
              cancelado: 'Fallidos',
            };
            const colorMap = {
              pendiente: 'border-t-amber-500 text-amber-400',
              entregado: 'border-t-emerald-500 text-emerald-400',
              cancelado: 'border-t-red-500 text-red-400',
            };

            return (
              <div
                key={st}
                className={`p-4 rounded-2xl bg-slate-800 border border-slate-700/80 border-t-4 ${colorMap[st]} space-y-3 min-h-[420px]`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <h3 className="font-bold text-sm text-white">{titleMap[st]}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-900 text-xs font-bold text-slate-300">
                    {colOrders.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {colOrders.map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => handleOpenOrderCenter(ord)}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-blue-500/50 cursor-pointer shadow-lg space-y-2 transition-all hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-blue-400 font-mono">#{ord.num ?? '—'}</span>
                        <span className="text-emerald-400 font-mono">S/ {ord.monto.toFixed(2)}</span>
                      </div>
                      <p className="text-xs font-bold text-white">{ord.cliente}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                        {ord.distrito || '—'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {ETIQUETAS_ESTADO[ord.stReal || ''] || ord.stReal}
                        {ord.hora ? ` · ${ord.hora}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CARDS GRID VIEW */}
      {viewMode === 'grid' && orders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((ord) => (
            <div
              key={ord.id}
              onClick={() => handleOpenOrderCenter(ord)}
              className="p-5 rounded-2xl bg-slate-800 border border-slate-700/80 hover:border-blue-500/50 shadow-xl space-y-3 cursor-pointer transition-all hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-blue-400">#{ord.num ?? '—'}</span>
                {estadoBadge(ord)}
              </div>

              <div>
                <h4 className="text-sm font-black text-white">{ord.cliente}</h4>
                <p className="text-xs text-slate-300 font-mono">{ord.clienteTelefono || 'sin teléfono'}</p>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" /> {ord.direccion || '—'} ({ord.distrito || '—'})
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {ord.estado === 'entregado' ? 'Cobrado' : 'Total a Cobrar'}
                </span>
                <span className="text-base font-black text-emerald-400">S/ {ord.monto.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Control Center Modal & Bottom Sheet */}
      <OrderControlCenter
        order={selectedOrder}
        isOpen={controlCenterOpen}
        onClose={() => setControlCenterOpen(false)}
        drivers={drivers}
        onRegistrarPago={onRegistrarPago}
        onCambiarEstado={onCambiarEstado}
        onOpenWhatsAppModal={onOpenWhatsAppModal}
        onDeleteOrder={onDeleteOrder}
        onDuplicateOrder={onDuplicateOrder}
        onGuardarFoto={onGuardarFoto}
        onGuardarNota={onGuardarNota}
        onShowToast={onShowToast}
      />
    </div>
  );
};
