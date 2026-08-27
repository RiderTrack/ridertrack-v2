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
  UserX,
  PhoneOff,
} from 'lucide-react';
import { Order } from '../../types';
import { ETIQUETAS_ESTADO } from '../../utils/realData';
import { Button, Badge, Card } from '../ui';

interface PaymentPanelProps {
  order: Order;
  /** Registra el cobro: método del panel → st real en Firestore */
  onRegistrarPago: (metodoPanel: string) => void;
  /** Cambia el estado real (fallida, rechazado, ausente, pendiente...) */
  onCambiarEstado: (st: string) => void;
  onUploadPhoto: () => void;
  onDeleteOrder: (orderId: string) => void;
  onShowToast?: (title: string, desc?: string, type?: any) => void;
}

export const PaymentPanel: React.FC<PaymentPanelProps> = ({
  order,
  onRegistrarPago,
  onCambiarEstado,
  onUploadPhoto,
  onDeleteOrder,
  onShowToast,
}) => {
  const esPendiente = order.estado === 'pendiente';
  const [selectedMethod, setSelectedMethod] = useState(
    order.estado === 'entregado' ? order.metodoPago : 'Efectivo'
  );
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

  // Estados de resolución REALES del ecosistema (st de Firestore)
  const resolutionStatuses = [
    { id: 'cancelado', label: 'Cancelado por Cliente', icon: XCircle },
    { id: 'rechazado', label: 'Rechazado en Puerta', icon: AlertTriangle },
    { id: 'fallida', label: 'Entrega Fallida', icon: AlertTriangle },
    { id: 'ausente', label: 'Cliente Ausente', icon: UserX },
    { id: 'no-contesta', label: 'No Contesta', icon: PhoneOff },
  ];

  const handleSelectMethod = (mId: string) => {
    setSelectedMethod(mId);
    onRegistrarPago(mId);
    if (onShowToast) {
      onShowToast(
        esPendiente ? 'Cobro Registrado' : 'Método Actualizado',
        `${order.cliente}: S/ ${order.monto.toFixed(2)} vía ${mId}`,
        'success'
      );
    }
  };

  const handleResolveStatus = (statusId: string, label: string) => {
    onCambiarEstado(statusId);
    if (onShowToast) {
      onShowToast('Estado Actualizado', `${order.cliente}: ${label}`, 'warning');
    }
  };

  return (
    <div className="space-y-5">
      {/* Resumen actual */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-slate-400 font-semibold block">
            {esPendiente ? 'Monto Total a Cobrar' : 'Monto Cobrado'}
          </span>
          <span className="text-2xl font-black text-emerald-400">S/ {order.monto.toFixed(2)}</span>
        </div>
        <Badge variant={esPendiente ? 'amber' : 'green'} size="md">
          {ETIQUETAS_ESTADO[order.stReal || ''] || order.stReal || 'Pendiente'}
          {order.hora && !esPendiente ? ` · ${order.hora}` : ''}
        </Badge>
      </div>

      {/* Métodos de pago: tocar = REGISTRAR COBRO real */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
          {esPendiente ? 'Registrar Cobro Con...' : 'Corregir Método de Pago'}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {paymentMethods.map((pm) => {
            const Icon = pm.icon;
            const isSelected = selectedMethod === pm.id;
            const yaCobradoAsi = order.estado === 'entregado' && order.stReal !== 'pendiente' &&
              (pm.id === 'Efectivo' ? ['efectivo', 'cambio', 'yape-efectivo'].includes(order.stReal || '') :
               pm.id === 'Yape Rudy' ? order.stReal === 'yape-rudy' :
               pm.id === 'Yape/Plin' ? order.stReal === 'yape-plin' :
               pm.id === 'Transferencia' ? order.stReal === 'transferencia' :
               pm.id === 'POS' ? order.stReal === 'pos' :
               pm.id === 'Pago Link' ? order.stReal === 'pago-link' :
               pm.id === 'Cambio' ? order.stReal === 'cambio' :
               pm.id === 'Mixto' ? order.stReal === 'mixto' :
               pm.id === 'Empresa' ? order.stReal === 'empresa' : false);
            return (
              <button
                key={pm.id}
                onClick={() => handleSelectMethod(pm.id)}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  isSelected || yaCobradoAsi
                    ? 'bg-emerald-600/20 border-emerald-500 shadow-md ring-1 ring-emerald-500'
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
        {esPendiente && (
          <p className="text-[10px] text-slate-400 mt-2">
            Toca el método con el que el cliente pagó — se registra en la ruta al instante y el bot lo ve.
          </p>
        )}
      </div>

      {/* Calculadora de vuelto (real, solo con Cambio) */}
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

      {/* Resolución de incidencias — estados reales */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
          Resolución de Incidencias / Cancelaciones
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {resolutionStatuses.map((rs) => {
            const Icon = rs.icon;
            const isActive = order.stReal === rs.id;
            return (
              <button
                key={rs.id}
                onClick={() => handleResolveStatus(rs.id, rs.label)}
                className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-red-500/20 border-red-500 text-red-300'
                    : 'bg-slate-900 border-slate-700 hover:border-red-500/50 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-red-400" />
                  <span>{rs.label}</span>
                </div>
                {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-red-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Acciones adicionales */}
      <div className="pt-3 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Camera className="w-4 h-4 text-emerald-400" />}
            onClick={onUploadPhoto}
          >
            Foto de Evidencia
          </Button>

          {!esPendiente && (
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw className="w-4 h-4 text-blue-400" />}
              onClick={() => {
                onCambiarEstado('pendiente');
                if (onShowToast) {
                  onShowToast('Pedido Reabierto', `${order.cliente} volvió a Pendiente`, 'info');
                }
              }}
            >
              Reabrir
            </Button>
          )}
        </div>

        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 className="w-4 h-4" />}
          onClick={() => {
            if (confirm(`¿Eliminar a ${order.cliente} de la ruta? Esta acción no se puede deshacer.`)) {
              onDeleteOrder(order.id);
            }
          }}
        >
          Eliminar de la Ruta
        </Button>
      </div>
    </div>
  );
};
