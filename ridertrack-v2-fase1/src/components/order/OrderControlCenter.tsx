import React, { useState } from 'react';
import {
  Package,
  MapPin,
  Clock,
  User,
  Phone,
  DollarSign,
  Bike,
  Sparkles,
  Zap,
  ArrowLeft,
  ChevronRight,
  MessageSquare,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Send,
  X,
  CreditCard,
  FileText,
  Navigation,
  Camera,
  Layers,
} from 'lucide-react';
import { Order, Driver } from '../../types';
import { Modal, Button, Badge, Card, BottomSheet } from '../ui';
import { PaymentPanel } from './PaymentPanel';
import { WhatsAppPanel } from './WhatsAppPanel';
import { RoutePanel } from './RoutePanel';
import { EvidencePanel } from './EvidencePanel';
import { MoreActionsPanel } from './MoreActionsPanel';

interface OrderControlCenterProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  drivers: Driver[];
  onUpdateOrderStatus: (orderId: string, newStatus: any) => void;
  onUpdatePaymentMethod: (orderId: string, newMethod: string) => void;
  onOpenWhatsAppModal: (phone?: string, name?: string) => void;
  onDeleteOrder: (orderId: string) => void;
  onDuplicateOrder: (order: Order) => void;
  onShowToast?: (title: string, desc?: string, type?: any) => void;
}

type PanelCategory = 'categories' | 'pago' | 'whatsapp' | 'ruta' | 'evidencias' | 'mas_acciones';

export const OrderControlCenter: React.FC<OrderControlCenterProps> = ({
  order,
  isOpen,
  onClose,
  drivers,
  onUpdateOrderStatus,
  onUpdatePaymentMethod,
  onOpenWhatsAppModal,
  onDeleteOrder,
  onDuplicateOrder,
  onShowToast,
}) => {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<PanelCategory>('categories');

  if (!order) return null;

  const assignedDriver = drivers.find((d) => d.id === order.repartidorId);

  const handleOpenCategory = (cat: PanelCategory) => {
    setActiveCategory(cat);
  };

  const handleBackToCategories = () => {
    setActiveCategory('categories');
  };

  const handlePresetWhatsApp = (title: string, message: string) => {
    const cleanPhone = order.clienteTelefono.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.length === 9 ? '51' + cleanPhone : cleanPhone;
    const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    if (onShowToast) {
      onShowToast(`WhatsApp Enviado: ${title}`, `Mensaje preparado para ${order.cliente}`, 'success');
    }
  };

  return (
    <>
      {/* Primary Detail Inspector Modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Centro de Control de Pedido: ${order.id}`}
        subtitle="Panel operativo consolidado • Telemetría y gestión en tiempo real"
        maxWidth="2xl"
        footer={
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  order.estado === 'en_camino'
                    ? 'blue'
                    : order.estado === 'entregado'
                    ? 'green'
                    : order.estado === 'pendiente'
                    ? 'amber'
                    : 'red'
                }
                size="md"
                dot
                pulse={order.estado === 'en_camino'}
              >
                {order.estado === 'en_camino'
                  ? 'En Camino'
                  : order.estado === 'entregado'
                  ? 'Entregado'
                  : order.estado === 'pendiente'
                  ? 'Pendiente'
                  : 'Cancelado'}
              </Badge>
              <span className="text-xs text-slate-400 font-mono">{order.hora}</span>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={<Zap className="w-4 h-4 fill-current text-amber-300" />}
              onClick={() => {
                setActiveCategory('categories');
                setIsBottomSheetOpen(true);
              }}
            >
              Abrir Panel de Acciones
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Top Banner with Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-500/20 shadow-xl">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cliente</span>
              <p className="text-sm font-black text-white truncate">{order.cliente}</p>
              <p className="text-xs text-blue-400 font-mono flex items-center gap-1">
                <Phone className="w-3 h-3" /> {order.clienteTelefono}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Ubicación</span>
              <p className="text-xs font-bold text-white line-clamp-1">{order.direccion}</p>
              <p className="text-xs text-slate-300 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-red-400" /> {order.distrito}
              </p>
            </div>

            <div className="space-y-0.5 sm:text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cobro Total</span>
              <p className="text-lg font-black text-emerald-400">S/ {order.monto.toFixed(2)}</p>
              <Badge variant="purple" size="sm">
                {order.metodoPago}
              </Badge>
            </div>
          </div>

          {/* Assigned Driver Card */}
          <Card padding="sm" className="bg-slate-900 border-slate-700/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Repartidor Asignado</span>
                  <span className="font-bold text-sm text-white">
                    {assignedDriver ? assignedDriver.nombre : order.repartidorNombre || 'Sin Repartidor Asignado'}
                  </span>
                  {assignedDriver && (
                    <span className="text-xs text-slate-400 block font-mono">
                      {assignedDriver.vehiculo} • Placa: {assignedDriver.placa}
                    </span>
                  )}
                </div>
              </div>

              {assignedDriver && (
                <Badge variant="green" size="sm" dot pulse>
                  GPS {assignedDriver.velocidadActual} km/h
                </Badge>
              )}
            </div>
          </Card>

          {/* Products / Items List */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider flex items-center justify-between">
              <span>Detalle de Productos ({order.productos.length})</span>
              <span className="text-[10px] text-slate-400">Verificado</span>
            </label>
            <div className="space-y-1.5 rounded-xl bg-slate-900 p-3 border border-slate-700/60">
              {order.productos.map((prod, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800 last:border-0"
                >
                  <span className="font-medium text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    {prod}
                  </span>
                  <span className="text-slate-400 font-mono">1x</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Floating Action Button (FAB) for Instant Order Operations */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => {
              setActiveCategory('categories');
              setIsBottomSheetOpen(true);
            }}
            className="group relative flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white font-extrabold text-sm shadow-2xl hover:shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 border border-blue-400/40"
          >
            {/* Soft Ripple Glow Effect */}
            <span className="absolute -inset-1 rounded-full bg-blue-500/30 blur-md group-hover:bg-blue-400/50 transition-all pointer-events-none animate-pulse" />
            
            <Zap className="w-5 h-5 relative z-10 fill-current text-amber-300 animate-bounce" />
            <span className="relative z-10 tracking-tight">Acciones del Pedido</span>
            <Badge variant="purple" size="sm" className="relative z-10 ml-1">
              PRO
            </Badge>
          </button>
        </div>
      )}

      {/* Categorized Bottom Sheet Drawer */}
      <BottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        title={
          activeCategory === 'categories'
            ? `Acciones de Pedido ${order.id}`
            : activeCategory === 'pago'
            ? '💰 Panel de Pago & Estado'
            : activeCategory === 'whatsapp'
            ? '💬 Panel de WhatsApp API'
            : activeCategory === 'ruta'
            ? '📍 Panel de Navegación & Ruta'
            : activeCategory === 'evidencias'
            ? '📷 Panel de Evidencias de Entrega'
            : '⚙ Panel de Más Acciones'
        }
        subtitle={
          activeCategory === 'categories'
            ? 'Selecciona una categoría para desplegar herramientas rápidas'
            : `Cliente: ${order.cliente} • Monto: S/ ${order.monto.toFixed(2)}`
        }
      >
        {/* Top Back Navigation if inside a sub-category */}
        {activeCategory !== 'categories' && (
          <button
            onClick={handleBackToCategories}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-bold text-blue-400 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a Categorías
          </button>
        )}

        {/* 1. CATEGORIES MAIN MENU */}
        {activeCategory === 'categories' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: Pago */}
            <button
              onClick={() => handleOpenCategory('pago')}
              className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 hover:border-emerald-500/50 text-left flex items-center justify-between transition-all group hover:scale-[1.02]"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white group-hover:text-emerald-400 transition-colors">
                    💰 Pago & Resoluciones
                  </h4>
                  <p className="text-xs text-slate-400">Efectivo, Yape, POS, Vuelto y Cancelaciones</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
            </button>

            {/* Card 2: WhatsApp */}
            <button
              onClick={() => handleOpenCategory('whatsapp')}
              className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 hover:border-teal-500/50 text-left flex items-center justify-between transition-all group hover:scale-[1.02]"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-teal-500/15 text-teal-400 border border-teal-500/30 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white group-hover:text-teal-400 transition-colors">
                    💬 WhatsApp Rápidos
                  </h4>
                  <p className="text-xs text-slate-400">QR Yape, Voy en camino, Llamar y Chat</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
            </button>

            {/* Card 3: Ruta */}
            <button
              onClick={() => handleOpenCategory('ruta')}
              className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 hover:border-blue-500/50 text-left flex items-center justify-between transition-all group hover:scale-[1.02]"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/30 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Navigation className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white group-hover:text-blue-400 transition-colors">
                    📍 Ruta & GPS
                  </h4>
                  <p className="text-xs text-slate-400">Google Maps, Waze, Compartir Link</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
            </button>

            {/* Card 4: Evidencias */}
            <button
              onClick={() => handleOpenCategory('evidencias')}
              className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 hover:border-purple-500/50 text-left flex items-center justify-between transition-all group hover:scale-[1.02]"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white group-hover:text-purple-400 transition-colors">
                    📷 Evidencias & Firma
                  </h4>
                  <p className="text-xs text-slate-400">Fotos de entrega, Firma digital, Boleta</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
            </button>

            {/* Card 5: Más Acciones */}
            <button
              onClick={() => handleOpenCategory('mas_acciones')}
              className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 hover:border-amber-500/50 text-left flex items-center justify-between sm:col-span-2 transition-all group hover:scale-[1.01]"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white group-hover:text-amber-400 transition-colors">
                    ⚙ Más Acciones & Herramientas
                  </h4>
                  <p className="text-xs text-slate-400">Duplicar, Exportar PDF/Excel, Imprimir Ticket, Auditoría</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
            </button>
          </div>
        )}

        {/* 2. SUB-PANEL: PAGO */}
        {activeCategory === 'pago' && (
          <PaymentPanel
            order={order}
            onUpdatePaymentMethod={(m) => onUpdatePaymentMethod(order.id, m)}
            onUpdateOrderStatus={(s) => onUpdateOrderStatus(order.id, s)}
            onUploadPhoto={() => {
              setIsBottomSheetOpen(false);
              setActiveCategory('evidencias');
              setIsBottomSheetOpen(true);
            }}
            onDeleteOrder={(id) => {
              onDeleteOrder(id);
              setIsBottomSheetOpen(false);
              onClose();
            }}
            onShowToast={onShowToast}
          />
        )}

        {/* 3. SUB-PANEL: WHATSAPP */}
        {activeCategory === 'whatsapp' && (
          <WhatsAppPanel
            order={order}
            onOpenWhatsAppModal={(phone, name) => {
              setIsBottomSheetOpen(false);
              onOpenWhatsAppModal(phone, name);
            }}
            onSendPresetWhatsApp={handlePresetWhatsApp}
            onShowToast={onShowToast}
          />
        )}

        {/* 4. SUB-PANEL: RUTA */}
        {activeCategory === 'ruta' && (
          <RoutePanel
            order={order}
            drivers={drivers}
            onShowToast={onShowToast}
          />
        )}

        {/* 5. SUB-PANEL: EVIDENCIAS */}
        {activeCategory === 'evidencias' && (
          <EvidencePanel
            order={order}
            onShowToast={onShowToast}
          />
        )}

        {/* 6. SUB-PANEL: MÁS ACCIONES */}
        {activeCategory === 'mas_acciones' && (
          <MoreActionsPanel
            order={order}
            onDuplicateOrder={(ord) => {
              onDuplicateOrder(ord);
              setIsBottomSheetOpen(false);
            }}
            onShowToast={onShowToast}
          />
        )}
      </BottomSheet>
    </>
  );
};
