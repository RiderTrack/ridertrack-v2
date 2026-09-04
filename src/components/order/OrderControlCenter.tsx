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
import { ETIQUETAS_ESTADO } from '../../utils/realData';

interface OrderControlCenterProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  drivers: Driver[];
  onRegistrarPago: (orderId: string, metodoPanel: string) => void;
  onCambiarEstado: (orderId: string, st: string) => void;
  onOpenWhatsAppModal: (phone?: string, name?: string) => void;
  onDeleteOrder: (orderId: string) => void;
  onDuplicateOrder: (order: Order) => void;
  onGuardarFoto: (orderId: string, blob: Blob, dataUrl: string) => void;
  onGuardarNota: (orderId: string, nota: string) => void;
  onShowToast?: (title: string, desc?: string, type?: any) => void;
}

type PanelCategory = 'categories' | 'pago' | 'whatsapp' | 'ruta' | 'evidencias' | 'mas_acciones';

export const OrderControlCenter: React.FC<OrderControlCenterProps> = ({
  order,
  isOpen,
  onClose,
  drivers,
  onRegistrarPago,
  onCambiarEstado,
  onOpenWhatsAppModal,
  onDeleteOrder,
  onDuplicateOrder,
  onGuardarFoto,
  onGuardarNota,
  onShowToast,
}) => {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<PanelCategory>('categories');

  if (!order) return null;

  const assignedDriver = drivers.find((d) => d.id === order.repartidorId) || drivers[0];

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
      onShowToast(`WhatsApp Preparado: ${title}`, `Mensaje listo para ${order.cliente} — confírmalo en WhatsApp`, 'success');
    }
  };

  const estadoBadgeVariant =
    order.estado === 'entregado' ? 'green' : order.estado === 'pendiente' ? 'amber' : 'red';

  return (
    <>
      {/* Primary Detail Inspector Modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Pedido #${order.num ?? order.id} — ${order.cliente}`}
        subtitle="Panel operativo con acciones que se guardan en tu ruta"
        maxWidth="2xl"
        footer={
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={estadoBadgeVariant} size="md" dot>
                {ETIQUETAS_ESTADO[order.stReal || ''] || order.stReal || 'Pendiente'}
              </Badge>
              <span className="text-xs text-slate-400 font-mono">
                {order.hora ? `Entregado ${order.hora}` : 'Sin hora de entrega'}
              </span>
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
                <Phone className="w-3 h-3" /> {order.clienteTelefono || 'sin teléfono'}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Ubicación</span>
              <p className="text-xs font-bold text-white line-clamp-1">{order.direccion || 'sin dirección'}</p>
              <p className="text-xs text-slate-300 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-red-400" /> {order.distrito || '—'}
              </p>
            </div>

            <div className="space-y-0.5 sm:text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                {order.estado === 'entregado' ? 'Cobrado' : 'Por Cobrar'}
              </span>
              <p className="text-lg font-black text-emerald-400">S/ {order.monto.toFixed(2)}</p>
              <Badge variant="purple" size="sm">
                {order.estado === 'entregado' ? order.metodoPago : 'Pendiente de pago'}
              </Badge>
            </div>
          </div>

          {/* Rider Card */}
          <Card padding="sm" className="bg-slate-900 border-slate-700/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Repartidor</span>
                  <span className="font-bold text-sm text-white">
                    {assignedDriver ? assignedDriver.nombre : order.repartidorNombre || 'RiderTrack'}
                  </span>
                  {assignedDriver && (
                    <span className="text-xs text-slate-400 block">
                      Entregas hoy: {assignedDriver.entregasHoy}
                    </span>
                  )}
                </div>
              </div>

              <Badge variant="blue" size="sm">
                Ruta activa
              </Badge>
            </div>
          </Card>

          {/* Products / Items List */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider flex items-center justify-between">
              <span>Productos del Pedido ({order.productos.length})</span>
            </label>
            <div className="space-y-1.5 rounded-xl bg-slate-900 p-3 border border-slate-700/60">
              {order.productos.length === 0 && (
                <p className="text-xs text-slate-400 py-2 text-center">
                  Sin detalle de productos registrado
                </p>
              )}
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

      {/* ⚡ F3.59: se QUITÓ el botón flotante "Acciones del Pedido"
          que aparecía duplicado (abajo a la derecha) junto al del
          footer del modal. Queda UNO solo: "Abrir Panel de Acciones"
          del pie del pedido. */}

      {/* Categorized Bottom Sheet Drawer */}
      <BottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        title={
          activeCategory === 'categories'
            ? `Acciones de Pedido #${order.num ?? order.id}`
            : activeCategory === 'pago'
            ? '💰 Panel de Pago & Estado'
            : activeCategory === 'whatsapp'
            ? '💬 Panel de WhatsApp'
            : activeCategory === 'ruta'
            ? '📍 Panel de Navegación & Ruta'
            : activeCategory === 'evidencias'
            ? '📷 Evidencias de Entrega'
            : '⚙ Más Acciones'
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
                  <p className="text-xs text-slate-400">Cobrar, cambiar método o marcar incidencia</p>
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
                  <p className="text-xs text-slate-400">Cuentas banco, en camino, llamar y chat</p>
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
                  <p className="text-xs text-slate-400">Google Maps, Waze, Copiar y Compartir</p>
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
                    📷 Evidencias & Notas
                  </h4>
                  <p className="text-xs text-slate-400">Foto de entrega (cámara) y notas del pedido</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
            </button>

            {/* Card 5: Más Acciones */}
            <button
              onClick={() => handleOpenCategory('mas_acciones')}
              className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 hover:border-amber-500/50 text-left flex items-center justify-between transition-all group hover:scale-[1.01] sm:col-span-2"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white group-hover:text-amber-400 transition-colors">
                    ⚙ Más Acciones & Herramientas
                  </h4>
                  <p className="text-xs text-slate-400">Duplicar, copiar ficha, reabrir, ver datos técnicos</p>
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
            onRegistrarPago={(m) => onRegistrarPago(order.id, m)}
            onCambiarEstado={(s) => onCambiarEstado(order.id, s)}
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
            onGuardarFoto={(orderId, blob, dataUrl) => onGuardarFoto(orderId, blob, dataUrl)}
            onGuardarNota={(orderId, nota) => onGuardarNota(orderId, nota)}
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
            onCambiarEstado={(st) => onCambiarEstado(order.id, st)}
            onShowToast={onShowToast}
          />
        )}
      </BottomSheet>
    </>
  );
};
