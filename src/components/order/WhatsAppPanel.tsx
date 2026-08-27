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
  UserCheck,
} from 'lucide-react';
import { Order } from '../../types';
import { Button } from '../ui';
import { useConfig } from '../../hooks/useConfig';

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
  // 🏦 Cuentas bancarias REALES desde config_empresa (Firestore)
  const { config } = useConfig();

  const construirMensajeCuentas = (): string => {
    const lineas: string[] = [
      `🏦 Cuentas para transferir S/ ${order.monto.toFixed(2)} de tu pedido:`,
    ];
    const bancos: Array<[string, any]> = [
      ['BCP', config.bcp],
      ['BBVA', config.bbva],
      ['Interbank', config.interbank],
    ];
    let hayCuentas = false;
    for (const [nombre, b] of bancos) {
      if (b && (b.numero || b.cci)) {
        hayCuentas = true;
        lineas.push(`\n▪️ ${nombre}`);
        if (b.numero) lineas.push(`   Cuenta: ${b.numero}`);
        if (b.cci) lineas.push(`   CCI: ${b.cci}`);
        if (b.titular) lineas.push(`   Titular: ${b.titular}`);
      }
    }
    if (!hayCuentas) {
      return `Hola ${order.cliente}, para transferir el pago de S/ ${order.monto.toFixed(2)} escríbeme por aquí y te paso los números de cuenta. 🙌`;
    }
    lineas.push(`\n¡Gracias por tu compra! 💚`);
    return lineas.join('\n');
  };

  const actions = [
    {
      id: 'qr_yape',
      label: 'Enviar saludo de pago',
      desc: 'Recordatorio amable del monto pendiente',
      icon: QrCode,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      message: `Hola ${order.cliente}! 👋 Te recuerdo el pago de S/ ${order.monto.toFixed(2)} de tu pedido. Puedes pagar con Yape o efectivo al recibir. ¡Gracias! 💚`,
    },
    {
      id: 'en_camino',
      label: 'Voy en camino',
      desc: 'Aviso de salida hacia la dirección de entrega',
      icon: Bike,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      message: `🚀 Hola ${order.cliente}, ya voy en camino con tu pedido hacia ${order.direccion || 'tu dirección'}. ¡En minutos llego!`,
    },
    {
      id: 'llegando',
      label: 'Ya estoy llegando',
      desc: 'Aviso final para que el cliente se prepare',
      icon: Clock,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      message: `📍 Hola ${order.cliente}, ya estoy llegando a tu dirección (${order.direccion || order.distrito}). ¡Por favor prepárate para recibir tu pedido! 🛵`,
    },
    {
      id: 'pedir_ubicacion',
      label: 'Pedir ubicación exacta',
      desc: 'Solicitar pin de WhatsApp o referencia de fachada',
      icon: MapPin,
      color: 'text-red-400 bg-red-500/10 border-red-500/30',
      message: `Hola ${order.cliente}, ¿podrías compartirme tu ubicación exacta por WhatsApp o alguna referencia adicional de tu domicilio (${order.direccion || 'dirección'})? 📍`,
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
      desc: 'Abre la conversación en WhatsApp',
      icon: MessageSquare,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      isDirectChat: true,
    },
    {
      id: 'cuentas_banco',
      label: 'Cuentas de Banco',
      desc: 'Envía TUS cuentas reales configuradas (BCP/BBVA/Interbank)',
      icon: Building2,
      color: 'text-slate-300 bg-slate-700/50 border-slate-600',
      message: construirMensajeCuentas(),
    },
    {
      id: 'confirmar_entrega',
      label: 'Confirmar entrega',
      desc: 'Mensaje de cierre y agradecimiento',
      icon: UserCheck,
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      message: `✅ ¡Gracias ${order.cliente}! Tu pedido fue entregado. Cualquier cosa me escribes por aquí. ¡Esperamos verte pronto! 🎉`,
    },
    {
      id: 'otros_temas',
      label: 'Mensaje personalizado',
      desc: 'Abrir editor libre de mensaje',
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
      const waUrl = `https://wa.me/${cleanPhone.length === 9 ? '51' + cleanPhone : cleanPhone}`;
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
          <span className="text-xs text-emerald-400 block font-mono">{order.clienteTelefono || 'sin teléfono'}</span>
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

      <p className="text-[10px] text-slate-400">
        Los mensajes se preparan y se abren en WhatsApp (wa.me) para que confirmes el envío.
        Las cuentas de banco salen de tu Configuración → Cuentas Bancarias.
      </p>
    </div>
  );
};
