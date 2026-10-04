// ═══════════════════════════════════════════════════════════
// 💜🔷 DriverTrack — Panel de cobro (Yape/Plin) — copiado del
// concepto de RiderTrack: QR + número + monto para mandar al cliente.
// (El envío automático por WhatsApp llega con el robot en F-ID5)
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { Copy, MessageCircle, X } from 'lucide-react';
import { Billetera } from '../types';
import { fmtSoles, linkWhatsApp } from '../utils';

interface Props {
  billetera: Billetera;
  tipo: 'yape' | 'plin';
  montoInicial: number;
  onCerrar: () => void;
  onToast: (msg: string) => void;
}

export default function YapePanel({ billetera, tipo, montoInicial, onCerrar, onToast }: Props) {
  const [monto, setMonto] = useState(montoInicial > 0 ? montoInicial.toFixed(2) : '');
  const esYape = tipo === 'yape';
  const color = esYape ? 'text-violet-300' : 'text-sky-300';
  const nombre = esYape ? 'Yape' : 'Plin';

  async function copiarNumero() {
    if (!billetera.numero) return;
    try {
      await navigator.clipboard.writeText(billetera.numero);
      onToast(`Número de ${nombre} copiado ✅`);
    } catch {
      onToast('No se pudo copiar 😕');
    }
  }

  function mandarWhatsApp() {
    const m = parseFloat(monto) || 0;
    const partes = [
      `¡Hola! 👋 Te comparto mis datos para el pago:`,
      ``,
      `${esYape ? '💜' : '🔷'} *${nombre}* — ${billetera.titular || 'DriverTrack'}`,
      `📱 Número: ${billetera.numero}`,
      m > 0 ? `💰 Monto: ${fmtSoles(m)}` : '',
      `¡Gracias por tu pago! 🙏`,
    ].filter(Boolean);
    window.open(linkWhatsApp('', partes.join('\n')), '_blank');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="dt-anim-pop w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-5">
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-bold ${color}`}>
            {esYape ? '💜' : '🔷'} Cobrar con {nombre}
          </h3>
          <button onClick={onCerrar} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {/* Monto */}
        <label className="mt-4 block text-xs font-medium text-slate-400">Monto a cobrar (editable)</label>
        <input
          type="number"
          inputMode="decimal"
          value={monto}
          onChange={e => setMonto(e.target.value)}
          placeholder="0.00"
          className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-2xl font-black text-emerald-300 outline-none focus:border-emerald-400"
        />

        {/* QR */}
        {billetera.qrBase64 ? (
          <div className="mt-4 rounded-2xl bg-white p-3">
            <img src={billetera.qrBase64} alt={`QR ${nombre}`} className="mx-auto w-56 rounded-lg" />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-600 bg-slate-800/60 p-5 text-center">
            <p className="text-xs text-slate-400">
              Sin QR de {nombre} configurado.
              <br />
              Cargalo en <span className="font-semibold text-slate-300">Ajustes → {nombre}</span> 📸
            </p>
          </div>
        )}

        {/* Datos */}
        {billetera.numero && (
          <div className="mt-3 rounded-xl bg-slate-800/80 p-3 text-center">
            <p className="text-sm font-bold text-slate-100">{billetera.titular || 'Titular'}</p>
            <p className="text-lg font-black tracking-wide text-slate-200">{billetera.numero}</p>
          </div>
        )}

        {/* Acciones */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={copiarNumero}
            disabled={!billetera.numero}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 py-3 text-sm font-bold text-slate-200 disabled:opacity-40"
          >
            <Copy size={15} /> Copiar número
          </button>
          <button
            onClick={mandarWhatsApp}
            disabled={!billetera.numero}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 disabled:opacity-40"
          >
            <MessageCircle size={15} /> WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
