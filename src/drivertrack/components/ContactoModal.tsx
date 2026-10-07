// ═══════════════════════════════════════════════════════════
// 📞 FASE G: ContactoModal — TODOS los botones de hablar con el
// cliente agrupados en UN solo modal (pedido de Rudy: la fila de
// la tarjeta tenía 6 botoncitos 📞💬 que ocupaban mucho lugar).
//
// Adentro vive todo lo que "habla" con el cliente de un viaje:
//   📤 Envía (A): 📞 Llamar · 💬 WhatsApp (chat vacío a mano)
//   📥 Recibe (B): 📞 Llamar · 💬 WhatsApp
//   (lista) 💬/🤖 Mandar el cobro (robot con QR o manual)
//   🤖 Avisos del robot (voy en camino · llegué · entregado…)
//
// Lo usan la tarjeta del viaje (ViajeList) y el formulario
// (ViajeForm, sin cobro ni avisos — esos ya tienen su botón ahí).
// Patrón visual del RobotMenu (FASE B): hoja de abajo, blur, pop.
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { Bot, Camera, Loader2, MessageCircle, Phone, Send, X } from 'lucide-react';
import { linkLlamada, normalizarCelular, vibrar } from '../utils';
import IconoWhatsApp from './IconoWhatsApp';

/** Un contacto del modal: quien ENVÍA (A) o quien RECIBE (B) */
export interface Contacto {
  /** para los data-testid y la key */
  id: string;
  /** 📤 Envía (A) · 📥 Recibe (B) · 📞 Cliente */
  label: string;
  /** el número tal como lo cargaron (se normaliza adentro) */
  numero: string;
}

interface Props {
  contactos: Contacto[];
  onCerrar: () => void;
  /** fila ancha: mandar el mensaje de COBRO (robot con QR o manual).
   *  FASE M (fix comprobante): recibe el NÚMERO elegido — cuando el
   *  viaje tiene DOS teléfonos, la fila muestra chips 📤/📥 para
   *  elegir a quién (default: quien RECIBE, el mismo destino de la
   *  📷 foto de entrega — antes iba SIEMPRE al que envía y el
   *  comprobante terminaba en el chat del otro pedido). */
  onCobrar?: (numero: string) => void;
  /** hay un cobro del robot en vuelo → spinner en la fila */
  cobrando?: boolean;
  /** robot activo → la fila de cobro va violeta; si no, verde WhatsApp */
  cobroRobot?: boolean;
  /** cuánto se cobra (para el subtítulo de la fila de cobro) */
  montoCobro?: number;
  /** fila ancha: abrir el menú de avisos del robot (lo abre el padre) */
  onAvisos?: () => void;
  /** FASE H: fila ancha — sacar/mirar la FOTO de la entrega y
   *  mandársela al cliente por WhatsApp con el mensaje configurable */
  onFoto?: () => void;
}

export default function ContactoModal({
  contactos,
  onCerrar,
  onCobrar,
  cobrando = false,
  cobroRobot = false,
  montoCobro,
  onAvisos,
  onFoto,
}: Props) {
  // solo los que de verdad tienen número cargado
  const conNumero = contactos.filter(c => normalizarCelular(c.numero.trim()));
  // FASE M: a quién le va el COBRO — con dos números se elige con
  // chips; default = quien RECIBE (id 'b'), el mismo destino de la
  // foto de entrega. Con un solo número ni se pregunta.
  const [cobroIdx, setCobroIdx] = useState(() =>
    conNumero.length > 1 ? Math.max(0, conNumero.findIndex(c => c.id === 'b')) : 0,
  );
  const cobroDestino = conNumero[cobroIdx] ?? conNumero[0];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
      data-testid="modal-contacto"
    >
      <div
        className="dt-anim-pop w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* encabezado */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-black text-slate-100">
              <Phone size={16} className="text-sky-300" /> Llamar o escribir
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              elegí a quién y cómo — el chat de WhatsApp abre vacío, escribís vos
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
            data-testid="contacto-cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* un bloque por contacto: número a la vista + 📞 y 💬 GRANDES */}
        <div className="mt-3 space-y-2">
          {conNumero.map(c => (
            <div
              key={c.id}
              className="rounded-xl border border-slate-700 bg-slate-800/60 p-3"
              data-testid={`contacto-fila-${c.id}`}
            >
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-slate-100" title={c.numero}>
                {c.numero.trim()}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    window.open(linkLlamada(c.numero), '_self');
                    vibrar(40);
                    onCerrar();
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 py-2.5 text-[12px] font-black text-sky-300 transition-all active:scale-[0.97] hover:bg-sky-500/25"
                  aria-label={`Llamar a ${c.label}`}
                  data-testid={`contacto-llamar-${c.id}`}
                >
                  <Phone size={16} /> Llamar
                </button>
                <button
                  onClick={() => {
                    const num = normalizarCelular(c.numero.trim());
                    if (num) window.open(`https://wa.me/${num}`, '_blank');
                    vibrar(40);
                    onCerrar();
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#25D366]/40 bg-[#25D366]/15 py-2.5 text-[12px] font-black text-[#25D366] transition-all active:scale-[0.97] hover:bg-[#25D366]/25"
                  aria-label={`WhatsApp a ${c.label}`}
                  data-testid={`contacto-wa-${c.id}`}
                >
                  <IconoWhatsApp size={16} /> WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* filas anchas abajo — cobro, FOTO de la entrega y avisos */}
        {(onCobrar || onFoto || onAvisos) && (
          <div className="mt-2 space-y-2">
            {onCobrar && (
              <div
                className={`rounded-xl border transition-all ${
                  cobroRobot
                    ? 'border-violet-500/40 bg-violet-500/10'
                    : 'border-[#25D366]/40 bg-[#25D366]/10'
                }`}
                data-testid="contacto-cobro"
              >
                {/* FASE M: chips 📤/📥 — a quién le mandás el cobro */}
                {conNumero.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
                    <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">¿A quién?</span>
                    {conNumero.map((c, i) => (
                      <button
                        key={c.id}
                        onClick={() => setCobroIdx(i)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black transition-all active:scale-[0.97] ${
                          i === cobroIdx
                            ? 'bg-slate-200 text-slate-900'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                        data-testid={`contacto-cobro-dest-${c.id}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => cobroDestino && onCobrar(cobroDestino.numero.trim())}
                  disabled={cobrando || !cobroDestino}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {cobrando ? (
                    <Loader2 size={20} className="shrink-0 animate-spin" />
                  ) : cobroRobot ? (
                    <Bot size={20} className="shrink-0" />
                  ) : (
                    <MessageCircle size={20} className="shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-xs font-black">Mandar el cobro</span>
                    <span className="block text-[10px] font-medium opacity-70">
                      {conNumero.length > 1 && cobroDestino
                        ? `${cobroDestino.label} · ${cobroDestino.numero.trim()}`
                        : cobroRobot
                          ? `el robot le manda el mensaje con tu QR${montoCobro != null ? ` (S/ ${montoCobro.toFixed(2)})` : ''}`
                          : `mensaje listo por WhatsApp${montoCobro != null ? ` (S/ ${montoCobro.toFixed(2)})` : ''}`}
                    </span>
                  </span>
                </button>
              </div>
            )}
            {onFoto && (
              <button
                onClick={() => onFoto()}
                className="flex w-full items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-left text-emerald-300 transition-all active:scale-[0.99] hover:bg-emerald-500/20"
                data-testid="contacto-foto"
              >
                <Camera size={20} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-black">📷 Foto de la entrega</span>
                  <span className="block text-[10px] font-medium opacity-70">
                    se la mandás por WhatsApp con tu mensaje (editable en Ajustes)
                  </span>
                </span>
              </button>
            )}
            {onAvisos && (
              <button
                onClick={() => onAvisos()}
                className="flex w-full items-center gap-3 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-3 text-left text-violet-300 transition-all active:scale-[0.99] hover:bg-violet-500/20"
                data-testid="contacto-avisos"
              >
                <Send size={20} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-black">Avisos del robot 🤖</span>
                  <span className="block text-[10px] font-medium opacity-70">
                    voy en camino · llegué · entregado · pedir ubicación
                  </span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
