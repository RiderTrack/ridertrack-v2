import React from 'react';
import {
  QrCode,
  Bike,
  Clock,
  MapPin,
  Phone,
  MessageSquare,
  Camera,
  Package,
  Headphones,
  Building2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Order } from '../../types';
import { Button } from '../ui';

interface WhatsAppPanelProps {
  order: Order;
  onOpenWhatsAppModal: (phone?: string, name?: string) => void;
  onSendPresetWhatsApp: (title: string, message: string) => void;
  onShowToast?: (title: string, desc?: string, type?: any) => void;
}

export const WhatsAppPanel: React.FC<WhatsAppPanelProps> = ({
  order,
  onOpenWhatsAppModal,
  onSendPresetWhatsApp,
  onShowToast,
}) => {
  const actions = [
    {
      id: 'qr_yape',
      label: 'Enviar QR de Yape',
      desc: 'Plantilla con código QR e instrucciones de transferencia',
      icon: QrCode,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      message: `Hola ${order.cliente}, aquí tienes nuestro QR de Yape para el pago de S/ ${order.monto.toFixed(2)} correspondiente a tu pedido ${order.id}.`,
    },
    {
      id: 'en_camino',
      label: 'Voy en camino',
      desc: 'Aviso de salida del repartidor y tiempo estimado de llegada',
      icon: Bike,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      message: `🚀 Hola ${order.cliente}, tu pedido ${order.id} está en camino hacia ${order.direccion}. Tiempo estimado: 15-20 min.`,
    },
    {
      id: 'avisar_posicion',
      label: 'Avisar posición GPS',
      desc: 'Compartir enlace de rastreo en vivo y distancia aproximada',
      icon: Clock,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      message: `📍 Hola ${order.cliente}, tu repartidor se encuentra cerca de tu zona. Sigue su trayecto en vivo aquí: https://ridertrack.app/track/${order.id}`,
    },
    {
      id: 'pedir_ubicacion',
      label: 'Pedir ubicación exacta',
      desc: 'Solicita pin de WhatsApp o referencia de fachada',
      icon: MapPin,
      color: 'text-red-400 bg-red-500/10 border-red-500/30',
      message: `hola ${order.cliente}, ¿podrías compartirnos tu ubicación exacta por WhatsApp o alguna referencia adicional de tu domicilio (${order.direccion})?`,
    },
    {
      id: 'llamar',
      label: 'Llamada telefónica',
      desc: 'Llamar directamente al número del cliente',
      icon: Phone,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      isCall: true,
    },
    {
      id: 'abrir_chat',
      label: 'Abrir Chat Directo',
      desc: 'Abre la conversación oficial en WhatsApp Web/App',
      icon: MessageSquare,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      isDirectChat: true,
    },
    {
      id: 'reportar_pago',
      label: 'Reportar pago',
      desc: 'Notificar comprobante o voucher recibido',
      icon: Camera,
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      message: `✅ Comprobante de pago verificado para el pedido ${order.id} por el monto de S/ ${order.monto.toFixed(2)}. ¡Gracias por tu compra!`,
    },
    {
      id: 'reportar_mate',
      label: 'Reportar a MATE',
      desc: 'Centro de despacho logístico automatizado MATE',
      icon: Package,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      message: `[MATE SYNC] Pedido ${order.id} despachado a la unidad ${order.repartidorNombre || 'S/A'}.`,
    },
    {
      id: 'chicos_venta',
      label: 'Chicos de Venta',
      desc: 'Canal de comunicación directa con equipo comercial',
      icon: Headphones,
      color: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
      message: `Soporte Ventas: Consulta sobre estado especial del cliente ${order.cliente} (${order.clienteTelefono}).`,
    },
    {
      id: 'cuentas_empresa',
      label: 'Cuentas Empresa',
      desc: 'Enviar números de cuenta BCP, BBVA, Interbank e CCI',
      icon: Building2,
      color: 'text-slate-300 bg-slate-700/50 border-slate-600',
      message: `🏦 Cuentas BCP / BBVA para transferencia del pedido ${order.id}:\n- BCP Cta Cte: 193-9821831-0-21\n- CCI: 00219300982183102114\nTitular: Logistics Express SAC`,
    },
    {
      id: 'otros_temas',
      label: 'Otros Temas',
      desc: 'Abrir editor personalizado de plantilla',
      icon: Sparkles,
      color: 'text-purple-300 bg-purple-950/40 border-purple-500/30',
      isCustomModal: true,
    },
  ];

  const handleActionClick = (act: typeof actions[0]) => {
    if (act.isCall) {
      window.open(`tel:${order.clienteTelefono.replace(/\s+/g, '')}`);
      return;
    }

    if (act.isDirectChat) {
      const cleanPhone = order.clienteTelefono.replace(/[^0-9]/g, '');
      const waUrl = `https://wa.me/${cleanPhone.length === 9 ? '51' + cleanPhone : cleanPhone}?text=Hola%20${encodeURIComponent(order.cliente)}%20de%20RiderTrack`;
      window.open(waUrl, '_blank');
      return;
    }

    if (act.isCustomModal) {
      onOpenWhatsAppModal(order.clienteTelefono, order.cliente);
      return;
    }

    if (act.message) {
      onSendPresetWhatsApp(act.label, act.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Cliente Vinculado</span>
          <span className="text-sm font-black text-white">{order.cliente}</span>
          <span className="text-xs text-emerald-400 block font-mono">{order.clienteTelefono}</span>
        </div>
        <Button
          variant="whatsapp"
          size="xs"
          icon={<ExternalLink className="w-3.5 h-3.5" />}
          onClick={() => onOpenWhatsAppModal(order.clienteTelefono, order.cliente)}
        >
          Editor Libre
        </Button>
      </div>

      {/* Grid of Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              onClick={() => handleActionClick(act)}
              className="p-3 rounded-2xl bg-slate-900 border border-slate-700/80 hover:border-emerald-500/50 hover:bg-slate-800 text-left flex items-start gap-3 transition-all group"
            >
              <div className={`p-2.5 rounded-xl border ${act.color} shrink-0 group-hover:scale-105 transition-transform`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-white block group-hover:text-emerald-400 transition-colors truncate">
                  {act.label}
                </span>
                <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                  {act.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
