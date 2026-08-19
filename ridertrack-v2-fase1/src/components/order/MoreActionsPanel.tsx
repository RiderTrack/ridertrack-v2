import React, { useState } from 'react';
import {
  Copy,
  FileText,
  FileSpreadsheet,
  Printer,
  StickyNote,
  History,
  ShieldCheck,
  Code,
  Check,
} from 'lucide-react';
import { Order } from '../../types';
import { Button, Card, Badge } from '../ui';

interface MoreActionsPanelProps {
  order: Order;
  onDuplicateOrder: (order: Order) => void;
  onShowToast?: (title: string, desc?: string, type?: any) => void;
}

export const MoreActionsPanel: React.FC<MoreActionsPanelProps> = ({
  order,
  onDuplicateOrder,
  onShowToast,
}) => {
  const [internalNotes, setInternalNotes] = useState('Cliente solicitó entrega sin timbre.');
  const [showJson, setShowJson] = useState(false);

  const handleDuplicate = () => {
    onDuplicateOrder(order);
    if (onShowToast) {
      onShowToast('Pedido Duplicado', `Nuevo borrador generado con los datos de ${order.cliente}`, 'success');
    }
  };

  const handleExportPDF = () => {
    if (onShowToast) {
      onShowToast('Exportando PDF', `Generando Guía de Remisión #${order.id}.pdf`, 'info');
    }
  };

  const handleExportExcel = () => {
    if (onShowToast) {
      onShowToast('Exportando Excel', `Hoja de despacho de ${order.id}.xlsx`, 'info');
    }
  };

  const handlePrintTicket = () => {
    if (onShowToast) {
      onShowToast('Imprimiendo Ticket', 'Enviado a impresora térmica POS 80mm', 'info');
    }
  };

  return (
    <div className="space-y-4">
      {/* Utilities Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={handleDuplicate}
          className="p-3 rounded-2xl bg-slate-900 border border-slate-700/80 hover:border-blue-500 hover:bg-slate-800 text-left flex flex-col items-center justify-center gap-2 transition-all group"
        >
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
            <Copy className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white text-center">Duplicar Pedido</span>
        </button>

        <button
          onClick={handleExportPDF}
          className="p-3 rounded-2xl bg-slate-900 border border-slate-700/80 hover:border-red-500 hover:bg-slate-800 text-left flex flex-col items-center justify-center gap-2 transition-all group"
        >
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 group-hover:scale-110 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white text-center">Guía PDF</span>
        </button>

        <button
          onClick={handleExportExcel}
          className="p-3 rounded-2xl bg-slate-900 border border-slate-700/80 hover:border-emerald-500 hover:bg-slate-800 text-left flex flex-col items-center justify-center gap-2 transition-all group"
        >
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white text-center">Excel Export</span>
        </button>

        <button
          onClick={handlePrintTicket}
          className="p-3 rounded-2xl bg-slate-900 border border-slate-700/80 hover:border-amber-500 hover:bg-slate-800 text-left flex flex-col items-center justify-center gap-2 transition-all group"
        >
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
            <Printer className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white text-center">Ticket Térmico</span>
        </button>
      </div>

      {/* Internal Notes Section */}
      <Card padding="sm" className="space-y-2 bg-slate-900 border-slate-700">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5 text-blue-400" /> Notas Internas de Administración
        </span>
        <textarea
          rows={2}
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Notas visibles únicamente para despachadores y administradores..."
          className="w-full p-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
        />
      </Card>

      {/* Audit Log / History Summary */}
      <Card padding="sm" className="space-y-2 bg-slate-900 border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-purple-400" /> Audit Log & Trazabilidad
          </span>
          <Badge variant="purple" size="sm">Sistema v2.4</Badge>
        </div>

        <div className="space-y-1.5 text-[11px] font-mono text-slate-400 pt-1">
          <div className="flex items-center justify-between">
            <span>• Registro inicial: {order.hora}</span>
            <span className="text-slate-500">Despachador Admin</span>
          </div>
          <div className="flex items-center justify-between">
            <span>• Asignación repartidor: {order.repartidorNombre || 'S/A'}</span>
            <span className="text-blue-400">AutoDispatch</span>
          </div>
          <div className="flex items-center justify-between">
            <span>• Estado actual: {order.estado.toUpperCase()}</span>
            <span className="text-emerald-400">OK</span>
          </div>
        </div>
      </Card>

      {/* Technical Information / JSON */}
      <div>
        <button
          onClick={() => setShowJson(!showJson)}
          className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <Code className="w-3.5 h-3.5 text-cyan-400" />
          {showJson ? 'Ocultar Información Técnica JSON' : 'Ver Información Técnica & Telemetría Raw'}
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
