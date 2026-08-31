import React, { useState } from 'react';
import {
  Copy,
  StickyNote,
  History,
  Code,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Order } from '../../types';
import { Button, Card, Badge } from '../ui';
import { ETIQUETAS_ESTADO, horaLimpia } from '../../utils/realData';

interface MoreActionsPanelProps {
  order: Order;
  onDuplicateOrder: (order: Order) => void;
  onCambiarEstado: (st: string) => void;
  onShowToast?: (title: string, desc?: string, type?: any) => void;
}

export const MoreActionsPanel: React.FC<MoreActionsPanelProps> = ({
  order,
  onDuplicateOrder,
  onCambiarEstado,
  onShowToast,
}) => {
  const [copiado, setCopiado] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const handleDuplicate = () => {
    onDuplicateOrder(order);
    if (onShowToast) {
      onShowToast('Pedido Duplicado', `Nuevo pedido con los datos de ${order.cliente}`, 'success');
    }
  };

  const fichaPedido = () =>
    [
      `🧾 Ficha de Pedido #${order.num ?? order.id}`,
      `👤 Cliente: ${order.cliente}`,
      order.clienteTelefono ? `📱 Teléfono: ${order.clienteTelefono}` : '',
      `📍 Dirección: ${order.direccion || '—'}, ${order.distrito || '—'}`,
      `📦 Productos: ${order.productos.join(', ') || '—'}`,
      `💵 Monto: S/ ${order.monto.toFixed(2)}`,
      `🔖 Estado: ${ETIQUETAS_ESTADO[order.stReal || ''] || order.stReal || 'Pendiente'}`,
      order.hora ? `🕒 Entregado: ${order.hora}` : '',
    ]
      .filter(Boolean)
      .join('\n');

  const handleCopiarFicha = async () => {
    try {
      await navigator.clipboard.writeText(fichaPedido());
    } catch {
      // Fallback para WebView
      const ta = document.createElement('textarea');
      ta.value = fichaPedido();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiado(true);
    if (onShowToast) {
      onShowToast('Ficha Copiada', 'Lista para pegar en WhatsApp o notas', 'success');
    }
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Utilities Grid — acciones reales */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={handleDuplicate}
          className="p-3 rounded-2xl bg-slate-900 border border-slate-700/80 hover:border-blue-500 hover:bg-slate-800 flex flex-col items-center justify-center gap-2 transition-all group"
        >
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
            <Copy className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white text-center">Duplicar Pedido</span>
        </button>

        <button
          onClick={handleCopiarFicha}
          className="p-3 rounded-2xl bg-slate-900 border border-slate-700/80 hover:border-emerald-500 hover:bg-slate-800 flex flex-col items-center justify-center gap-2 transition-all group"
        >
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            {copiado ? <Check className="w-5 h-5" /> : <StickyNote className="w-5 h-5" />}
          </div>
          <span className="text-xs font-bold text-white text-center">
            {copiado ? '¡Copiado!' : 'Copiar Ficha'}
          </span>
        </button>
      </div>

      {/* Reabrir pedido (solo si no está pendiente) */}
      {order.estado !== 'pendiente' && (
        <button
          onClick={() => {
            onCambiarEstado('pendiente');
            if (onShowToast) {
              onShowToast('Pedido Reabierto', `${order.cliente} volvió a estado Pendiente`, 'info');
            }
          }}
          className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-700/80 hover:border-blue-500 hover:bg-slate-800 flex items-center justify-center gap-2 transition-all group"
        >
          <RotateCcw className="w-4 h-4 text-blue-400 group-hover:rotate-[-180deg] transition-transform" />
          <span className="text-xs font-bold text-white">Reabrir Pedido (volver a Pendiente)</span>
        </button>
      )}

      {/* Datos del pedido (reales) */}
      <Card padding="sm" className="space-y-2 bg-slate-900 border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-purple-400" /> Datos del Pedido
          </span>
          <Badge variant="purple" size="sm">Firestore</Badge>
        </div>

        <div className="space-y-1.5 text-[11px] font-mono text-slate-400 pt-1">
          <div className="flex items-center justify-between">
            <span>• Orden en ruta: #{order.num ?? '—'}</span>
            <span className="text-blue-400">ruta_activa</span>
          </div>
          <div className="flex items-center justify-between">
            <span>• Estado actual: {ETIQUETAS_ESTADO[order.stReal || ''] || order.stReal || 'pendiente'}</span>
            <span className="text-emerald-400">sincronizado</span>
          </div>
          <div className="flex items-center justify-between">
            <span>• Hora de entrega: {order.hora ? horaLimpia(order.hora) : '—'}</span>
            <span className="text-slate-500">{order.hora ? 'registrada' : 'pendiente'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>• Evidencia foto: {order.fotoUrl ? 'sí' : 'no'}</span>
            <span className="text-slate-500">{order.fotoUrl ? 'guardada' : 'sin foto'}</span>
          </div>
        </div>
      </Card>

      {/* Información técnica / JSON (datos reales) */}
      <div>
        <button
          onClick={() => setShowJson(!showJson)}
          className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <Code className="w-3.5 h-3.5 text-cyan-400" />
          {showJson ? 'Ocultar Información Técnica' : 'Ver Información Técnica (JSON real)'}
        </button>

        {showJson && (
          <pre className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-300 overflow-x-auto max-h-40 custom-scrollbar">
            {JSON.stringify(order, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};
