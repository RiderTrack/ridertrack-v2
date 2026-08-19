import React, { useState } from 'react';
import {
  DollarSign,
  QrCode,
  CreditCard,
  Building2,
  ArrowRightLeft,
  Coins,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Camera,
  Trash2,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import { Order } from '../../types';
import { Button, Badge, Card } from '../ui';

interface PaymentPanelProps {
  order: Order;
  onUpdatePaymentMethod: (method: string) => void;
  onUpdateOrderStatus: (status: any) => void;
  onUploadPhoto: () => void;
  onDeleteOrder: (orderId: string) => void;
  onShowToast?: (title: string, desc?: string, type?: any) => void;
}

export const PaymentPanel: React.FC<PaymentPanelProps> = ({
  order,
  onUpdatePaymentMethod,
  onUpdateOrderStatus,
  onUploadPhoto,
  onDeleteOrder,
  onShowToast,
}) => {
  const [selectedMethod, setSelectedMethod] = useState(order.metodoPago || 'Yape/Plin');
  const [cashReturnAmount, setCashReturnAmount] = useState('100');

  const paymentMethods = [
    { id: 'Efectivo', label: 'Efectivo', icon: DollarSign, color: 'text-emerald-400 bg-emerald-500/10' },
    { id: 'Yape Rudy', label: 'Yape Rudy', icon: QrCode, color: 'text-purple-400 bg-purple-500/10' },
    { id: 'Yape/Plin', label: 'Yape / Plin', icon: QrCode, color: 'text-cyan-400 bg-cyan-500/10' },
    { id: 'Transferencia', label: 'Transferencia', icon: Building2, color: 'text-blue-400 bg-blue-500/10' },
    { id: 'POS', label: 'POS Tarjeta', icon: CreditCard, color: 'text-indigo-400 bg-indigo-500/10' },
    { id: 'Pago Link', label: 'Pago Link Online', icon: Receipt, color: 'text-teal-400 bg-teal-500/10' },
    { id: 'Cambio', label: 'Con Cambio ($)', icon: Coins, color: 'text-amber-400 bg-amber-500/10' },
    { id: 'Mixto', label: 'Pago Mixto', icon: ArrowRightLeft, color: 'text-pink-400 bg-pink-500/10' },
    { id: 'Empresa', label: 'Cuenta Empresa', icon: Building2, color: 'text-slate-300 bg-slate-700/50' },
  ];

  const resolutionStatuses = [
    { id: 'cancelado', label: 'Cancelado por Cliente', icon: XCircle, variant: 'red' as const },
    { id: 'rechazado', label: 'Rechazado en Puerta', icon: AlertTriangle, variant: 'amber' as const },
    { id: 'fallida', label: 'Entrega Fallida', icon: AlertTriangle, variant: 'red' as const },
    { id: 'reprogramado', label: 'Reprogramado', icon: RotateCcw, variant: 'blue' as const },
    { id: 'devuelto', label: 'Devuelto a Almacén', icon: RotateCcw, variant: 'purple' as const },
  ];

  const handleSelectMethod = (mId: string) => {
    setSelectedMethod(mId as any);
    onUpdatePaymentMethod(mId);
    if (onShowToast) {
      onShowToast('Método de Pago Actualizado', `Asignado: ${mId}`, 'info');
    }
  };

  const handleResolveStatus = (statusId: string, label: string) => {
    onUpdateOrderStatus('cancelado');
    if (onShowToast) {
      onShowToast('Pedido Finalizado con Estado:', label, 'warning');
    }
  };

  return (
    <div className="space-y-5">
      {/* Current Payment Summary Banner */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-slate-400 font-semibold block">Monto Total a Cobrar</span>
          <span className="text-2xl font-black text-emerald-400">S/ {order.monto.toFixed(2)}</span>
        </div>
        <Badge variant="blue" size="md">
          {selectedMethod}
        </Badge>
      </div>

      {/* Methods Grid */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
          Métodos de Pago & Cobranza
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {paymentMethods.map((pm) => {
            const Icon = pm.icon;
            const isSelected = selectedMethod === pm.id;
            return (
              <button
                key={pm.id}
                onClick={() => handleSelectMethod(pm.id)}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500 shadow-md ring-1 ring-blue-500'
                    : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600 text-slate-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${pm.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white">{pm.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cash Return Assistant */}
      {selectedMethod === 'Cambio' && (
        <Card padding="sm" className="space-y-2 bg-amber-950/20 border-amber-500/30">
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Coins className="w-4 h-4" /> Calculadora de Vuelto
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={cashReturnAmount}
              onChange={(e) => setCashReturnAmount(e.target.value)}
              placeholder="Paga con S/"
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
            <div className="shrink-0 text-right">
              <span className="text-[10px] text-slate-400 block">Vuelto a Entregar:</span>
              <span className="text-sm font-black text-emerald-400">
                S/ {Math.max(0, (parseFloat(cashReturnAmount) || 0) - order.monto).toFixed(2)}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Resolution & Exceptions */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
          Resolución de Incidencias / Cancelaciones
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {resolutionStatuses.map((rs) => {
            const Icon = rs.icon;
            return (
              <button
                key={rs.id}
                onClick={() => handleResolveStatus(rs.id, rs.label)}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-red-500/50 text-left flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition-all"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-red-400" />
                  <span>{rs.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Additional Quick Triggers */}
      <div className="pt-3 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="sm"
          icon={<Camera className="w-4 h-4 text-emerald-400" />}
          onClick={onUploadPhoto}
        >
          Agregar Foto de Pago
        </Button>

        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 className="w-4 h-4" />}
          onClick={() => {
            if (confirm(`¿Estás seguro de eliminar permanentemente el pedido ${order.id}?`)) {
              onDeleteOrder(order.id);
            }
          }}
        >
          Eliminar Pedido
        </Button>
      </div>
    </div>
  );
};
