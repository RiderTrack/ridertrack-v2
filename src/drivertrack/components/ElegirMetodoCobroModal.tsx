// ═════════════════════════════════════════════════════════════
// 🟣 FASE R: 💜🔷 ¿Cómo le cobrás? — elegir el método del mensaje
// ═════════════════════════════════════════════════════════════
// Pedido de Rudy: "en el mensaje podemos separar uno que sea solo
// el mensaje Yape y el otro que sea solo mensaje Plim, porque
// cuando mando mensaje sale envíame a este número tanto Yape como
// Plim — que sea separado".
//
// Este modal aparece SOLO si tenés configurados los DOS números
// (Yape y Plin). Al elegir:
//   • 💜 Solo Yape  → el mensaje habla ÚNICAMENTE de tu Yape y
//                     viaja TU QR de Yape pegado
//   • 🔷 Solo Plin  → únicamente tu Plin + SU QR
//   • 💙 Ambos      → el mensaje de siempre (los dos juntos)
// Si solo tenés un número configurado, ni se pregunta: el cobro
// sale directo con ese.
// ═════════════════════════════════════════════════════════════
import { X } from 'lucide-react';
import { ConfigDT } from '../types';
import { MetodoCobro, fmtSoles } from '../utils';

interface Props {
  datos: { cliente: string; monto: number; direccion: string };
  config: ConfigDT;
  /** undefined = "Ambos" (el mensaje de siempre) */
  onElegir: (metodo?: MetodoCobro) => void;
  onCerrar: () => void;
}

export default function ElegirMetodoCobroModal({ datos, config, onElegir, onCerrar }: Props) {
  const yape = config.yape.numero.trim();
  const plin = config.plin.numero.trim();
  const qrYape = config.yape.qrBase64;
  const qrPlin = config.plin.qrBase64;
  const cliente = datos.cliente.trim() || 'el cliente';

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
      data-testid="elegir-metodo-modal"
    >
      <div
        className="dt-anim-pop flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-100">💜 ¿Cómo le cobrás?</p>
            <p className="truncate text-[11px] text-slate-400">
              {cliente}
              {datos.monto > 0 ? ` · ${fmtSoles(datos.monto)}` : ''} — el mensaje sale SOLO con lo que elijas
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
            data-testid="elegir-metodo-cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Las 3 opciones */}
        <div className="space-y-2 p-4">
          <button
            onClick={() => onElegir('yape')}
            className="flex w-full items-center gap-3 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-3 text-left transition-all hover:bg-violet-500/20 active:scale-[0.99]"
            data-testid="elegir-metodo-yape"
          >
            {qrYape ? (
              <img
                src={qrYape}
                alt="Tu QR de Yape"
                className="h-12 w-12 shrink-0 rounded-lg border border-violet-500/40 bg-white object-contain p-0.5"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-violet-500/40 bg-slate-900 text-xl">💜</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-black text-violet-200">Solo Yape 💜</span>
              <span className="block truncate text-[10px] font-medium text-slate-400">
                {yape || 'sin número'} {qrYape ? '· con tu QR de Yape' : '· sin QR subido'}
              </span>
            </span>
          </button>

          <button
            onClick={() => onElegir('plin')}
            className="flex w-full items-center gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-3 text-left transition-all hover:bg-sky-500/20 active:scale-[0.99]"
            data-testid="elegir-metodo-plin"
          >
            {qrPlin ? (
              <img
                src={qrPlin}
                alt="Tu QR de Plin"
                className="h-12 w-12 shrink-0 rounded-lg border border-sky-500/40 bg-white object-contain p-0.5"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-sky-500/40 bg-slate-900 text-xl">🔷</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-black text-sky-200">Solo Plin 🔷</span>
              <span className="block truncate text-[10px] font-medium text-slate-400">
                {plin || 'sin número'} {qrPlin ? '· con tu QR de Plin' : '· sin QR subido'}
              </span>
            </span>
          </button>

          <button
            onClick={() => onElegir(undefined)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-3 text-left transition-all hover:bg-slate-800 active:scale-[0.99]"
            data-testid="elegir-metodo-ambos"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 text-xl">💙</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-black text-slate-200">Ambos</span>
              <span className="block truncate text-[10px] font-medium text-slate-400">
                los dos en un solo mensaje — como siempre
              </span>
            </span>
          </button>
        </div>

        <p className="border-t border-slate-800 px-4 py-2.5 text-center text-[10px] leading-snug text-slate-500">
          Cada mensaje lleva ÚNICAMENTE el número (y el QR) del método que elijas — ya no le llega
          "yape y plin revueltos" al cliente.
        </p>
      </div>
    </div>
  );
}
