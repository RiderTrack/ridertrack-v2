// ═════════════════════════════════════════════════════════════
// 💜 FASE AA: QR POR VIAJE — el mismo modal del APK de trabajo,
// ahora en cada viaje de inDrive.
// Pedido literal de Rudy: "cuando acepta un viaje ahí están el
// cliente el monto y todo eso… en cada cliente ponerle su
// botoncito de QR para que pueda fácilmente solo escanear con el
// monto y todo".
//
// Patrón VALIDADO del trabajo (FASE Y + Z + Z-2 de RutaView):
//   • tarjeta BLANCA (el QR se escanea mejor) con tinta FIJA zinc
//     (la paleta zinc NO se remapea en ningún tema → legible en
//     claro y oscuro, lección Z-2);
//   • el MONTO en GRANDE — acá es la TARIFA del viaje (lo que el
//     cliente le paga al conductor en inDrive: el neto es tuyo,
//     la comisión es de la plataforma);
//   • chips 💜 Yape / 🔷 Plin si las DOS billeteras tienen algo;
//   • el QR mostrado es el PERSONAL de inDrive (config.yape/plin —
//     el que se sube en "Mi QR Yape/Plin → 🏍️ inDrive"), NO el del
//     trabajo: esta plata la cobra el conductor, no la empresa;
//   • overlay bg-slate-950/70 → se invierte con el tema (lección
//     Z-3, igual que el panel de cobro Yape/Plin);
//   • botones de acción con colores SÓLIDOS (purple-600/cyan-600)
//     protegidos por la regla global .light .bg-*-600 → letra
//     blanca SIEMPRE (lección Z-2).
// Y el cierre en la puerta sin salir (patrón FASE Z del trabajo):
//   • 🤖/💬 mandar el cobro por WhatsApp — con la billetera que
//     estás MOSTRANDO ya elegida (no vuelve a preguntar);
//   • ✓ marcar la ENTREGA ahí mismo y que cierre solo.
// ═════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Bot, Check, Loader2, MessageCircle, Pencil, QrCode, X } from 'lucide-react';
import { ConfigDT, Viaje } from '../types';
import { MetodoCobro, DatosCobro, armarMensajeCobro, fmtSoles, vibrar } from '../utils';

interface Props {
  viaje: Viaje;
  config: ConfigDT;
  onCerrar: () => void;
  /** 💜 FASE AA: el cobro por el flujo COMPARTIDO de siempre —
   *  con la billetera del chip ya elegida viaja directo (el shell
   *  ya no vuelve a preguntar Yape/Plin/ambos).
   *  💜 FASE BB: puede viajar `mensajeEditado` (lo que retocaste en
   *  ✏️ Mensaje) — ese texto sale tal cual. */
  onMandarCobro?: (
    datos: DatosCobro,
    celular: string,
    metodo?: MetodoCobro,
  ) => Promise<void> | void;
  cobroEnCurso?: boolean;
  /** ✓ FASE AA: marcar la entrega sin salir del QR (como el
   *  "cobró efectivo" del trabajo — cierra el modal solo). */
  onToggleEntregado?: (id: string) => void;
  onToast?: (msg: string) => void;
}

export default function QrViajeModal({
  viaje,
  config,
  onCerrar,
  onMandarCobro,
  cobroEnCurso = false,
  onToggleEntregado,
  onToast,
}: Props) {
  // default inteligente (patrón FASE Y): Yape salvo que solo haya Plin
  const hayYape = !!(config.yape.qrBase64 || config.yape.numero.trim());
  const hayPlin = !!(config.plin.qrBase64 || config.plin.numero.trim());
  const [wallet, setWallet] = useState<'yape' | 'plin'>(!hayYape && hayPlin ? 'plin' : 'yape');
  // 💜 FASE BB: el mensaje del cobro — editable acá mismo antes de
  // mandar. null = automático (el de siempre con la billetera que
  // estás mostrando); string = tu texto retocado.
  const [msgAbierto, setMsgAbierto] = useState(false);
  const [mensajeEditado, setMensajeEditado] = useState<string | null>(null);

  const esYape = wallet === 'yape';
  const billetera = esYape ? config.yape : config.plin;
  const walletQR = (billetera.qrBase64 || '').trim();
  const walletNum = (billetera.numero || '').replace(/\D/g, '');
  const walletTit = (billetera.titular || '').trim();
  // 💰 la TARIFA es lo que el cliente paga (el neto queda para
  // vos y la comisión es de la plataforma — el QR es para ÉL)
  const monto = Number(viaje.tarifa) || 0;
  const numBonito = walletNum ? walletNum.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : '';
  // el cobro va al que ENVÍA por defecto (mismo criterio de la
  // tarjeta y el ContactoModal); si solo cargaste el que recibe, a él
  const telCobro = ((viaje.celularEnvia ?? '').trim() || viaje.celular.trim() || (viaje.celularRecibe ?? '').trim()).trim();
  const yaEntregado = viaje.entregado === true;

  function cambiarWallet(w: 'yape' | 'plin') {
    setWallet(w);
    vibrar(30);
  }

  /** 🤖/💬 mandar el cobro — viaja la billetera que estás mostrando
   *  💜 FASE BB: y TU mensaje si lo retocaste (✏️) */
  function mandarWhatsApp() {
    if (!onMandarCobro) return;
    onMandarCobro(
      {
        cliente: viaje.cliente,
        monto,
        direccion: viaje.direccion,
        mensajeEditado: mensajeEditado ?? undefined,
      },
      telCobro,
      wallet, // FASE AA: ya elegiste acá — no vuelve a preguntar
    );
  }

  /** ✓ marcar la entrega y cerrar (todo en la puerta, sin salir) */
  function marcarEntrega() {
    if (!onToggleEntregado) return;
    onToggleEntregado(viaje.id);
    onToast?.(
      `✓ ${viaje.cliente || 'Viaje'} entregado${viaje.entregadoHora ? '' : ''} — sigue el siguiente 🛵`,
    );
    onCerrar();
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onCerrar}
      data-testid="qr-viaje-modal"
    >
      <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <button
          onClick={onCerrar}
          data-testid="qr-viaje-cerrar"
          className="absolute -top-11 right-0 rounded-lg bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-slate-700"
          title="Cerrar"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Chips de billetera — solo si las DOS tienen algo (patrón FASE Y) */}
        {hayYape && hayPlin && (
          <div className="mb-2.5 flex justify-center gap-2">
            <button
              onClick={() => cambiarWallet('yape')}
              data-testid="qr-viaje-chip-yape"
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                esYape
                  ? 'border-purple-400 bg-purple-600 text-white'
                  : 'border-slate-600 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              💜 Yape
            </button>
            <button
              onClick={() => cambiarWallet('plin')}
              data-testid="qr-viaje-chip-plin"
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                !esYape
                  ? 'border-cyan-400 bg-cyan-600 text-white'
                  : 'border-slate-600 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              🔷 Plin
            </button>
          </div>
        )}

        {/* Tarjeta blanca — el QR se escanea mejor (patrón FASE Y,
            tinta zinc FIJA del Z-2 + shadow del Z-2 para el modo claro) */}
        <div className="dt-anim-pop rounded-2xl bg-white p-4 shadow-2xl" data-testid="qr-viaje-card">
          {/* Cliente + MONTO — el motivo de esta pantalla */}
          <div className="mb-3 border-b border-slate-200 pb-2.5 text-center">
            <p className="truncate text-[11px] font-medium text-zinc-500">
              🛵 {viaje.cliente || 'Cliente'}
              {viaje.zona ? ` · ${viaje.zona}` : ''}
            </p>
            <p className="mt-0.5 text-3xl font-black leading-tight text-zinc-900" data-testid="qr-viaje-monto">
              S/ {monto.toFixed(2)}
            </p>
            {viaje.observacion?.trim() && (
              <p className="mt-0.5 truncate text-[10px] text-zinc-500" title={viaje.observacion}>
                📦 {viaje.observacion}
              </p>
            )}
          </div>

          {/* La imagen del QR (o el aviso si no la subiste) */}
          {walletQR ? (
            <img
              src={walletQR}
              alt={`QR ${esYape ? 'Yape' : 'Plin'}`}
              data-testid="qr-viaje-imagen"
              className={`mx-auto block w-full max-w-[280px] rounded-lg border-2 ${
                esYape ? 'border-purple-300' : 'border-cyan-300'
              }`}
            />
          ) : (
            <div className="mx-auto max-w-[280px] rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
              <QrCode className="mx-auto mb-1.5 h-9 w-9 text-zinc-400" />
              <p className="text-xs font-bold text-zinc-600">Sin QR de {esYape ? 'Yape' : 'Plin'} cargado</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                Subilo en <b>Mi QR Yape/Plin</b> → pestaña <b>🏍️ inDrive</b> y va a aparecer acá
              </p>
            </div>
          )}

          {/* Titular + número — por si prefiere mandar la plata al número */}
          <div className="mt-3 pb-0.5 text-center">
            {walletTit && <p className="text-sm font-black text-zinc-900">{walletTit}</p>}
            {numBonito && (
              <p
                className={`text-xl font-black font-mono tracking-wider ${
                  esYape ? 'text-purple-700' : 'text-cyan-700'
                }`}
                data-testid="qr-viaje-numero"
              >
                {numBonito}
              </p>
            )}
            {walletQR && (
              <p className="mt-1 text-[10px] text-slate-500">
                Escaneá con {esYape ? 'Yape' : 'tu app de banco con Plin'} para pagar
              </p>
            )}
          </div>
        </div>

        {/* 💜 FASE BB — ✏️ el MENSAJE del cobro, editable acá mismo:
            tocá, retocá y mandá TU versión (el automático queda para
            los demás). Colapsado por defecto para no tapar el QR. */}
        {onMandarCobro && (
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-2.5" data-testid="qr-viaje-mensaje">
            <button
              onClick={() => setMsgAbierto(!msgAbierto)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
                <Pencil size={12} className="text-emerald-400" />
                Mensaje del cobro
                {mensajeEditado !== null && (
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-px text-[8px] font-black text-emerald-300">
                    EDITADO
                  </span>
                )}
              </span>
              <span className="text-[10px] font-bold text-slate-500">{msgAbierto ? 'ocultar ▲' : 'editar ▼'}</span>
            </button>

            {msgAbierto && (
              <div className="mt-2">
                {mensajeEditado === null ? (
                  <>
                    <div className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-xl rounded-tl-sm bg-[#005C4B] px-3 py-2 text-[11px] leading-relaxed text-white siempre-blanco">
                      {armarMensajeCobro(
                        { cliente: viaje.cliente, monto, direccion: viaje.direccion },
                        config,
                        wallet,
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setMensajeEditado(
                          armarMensajeCobro(
                            { cliente: viaje.cliente, monto, direccion: viaje.direccion },
                            config,
                            wallet,
                          ),
                        );
                        vibrar(30);
                      }}
                      className="mt-1.5 w-full rounded-lg bg-emerald-500/15 py-1.5 text-[10px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25 active:scale-95"
                      data-testid="qr-viaje-editar-msg"
                    >
                      ✏️ Editar este mensaje
                    </button>
                  </>
                ) : (
                  <>
                    <textarea
                      value={mensajeEditado}
                      onChange={e => setMensajeEditado(e.target.value)}
                      rows={6}
                      className="w-full resize-none rounded-xl border border-emerald-500/40 bg-slate-950 px-3 py-2 text-[11px] leading-relaxed text-slate-200 outline-none focus:border-emerald-400"
                      data-testid="qr-viaje-input-msg"
                    />
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-[9px] leading-snug text-emerald-400/90">
                        Tu edición sale con este cobro
                      </p>
                      <button
                        onClick={() => { setMensajeEditado(null); vibrar(30); }}
                        className="shrink-0 rounded-lg bg-slate-800 px-2 py-1 text-[9px] font-bold text-slate-300 transition-colors hover:bg-slate-700"
                        data-testid="qr-viaje-auto-msg"
                      >
                        ↩️ Automático
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 💜 FASE AA — todo el cobro en la puerta SIN salir del QR
            (patrón FASE Z del trabajo): mandarle el mensaje por
            WhatsApp con la billetera que ya estás mostrando, y
            marcar la entrega ahí mismo. */}
        <div className="mt-3 space-y-2">
          {onMandarCobro && (
            <button
              onClick={mandarWhatsApp}
              disabled={cobroEnCurso}
              data-testid="qr-viaje-btn-wsp"
              className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
                esYape
                  ? 'border-purple-400 bg-purple-600 text-white hover:bg-purple-700'
                  : 'border-cyan-400 bg-cyan-600 text-white hover:bg-cyan-700'
              }`}
              title={
                telCobro
                  ? `${config.robotActivo ? 'El robot le manda' : 'Se abre el WhatsApp de'} el cliente con tu ${esYape ? 'Yape' : 'Plin'} y el monto`
                  : 'Cargale el celular al viaje para poder mandarle el cobro'
              }
            >
              {cobroEnCurso ? (
                <Loader2 size={16} className="animate-spin" />
              ) : config.robotActivo ? (
                <Bot size={16} />
              ) : (
                <MessageCircle size={16} />
              )}
              {cobroEnCurso
                ? 'Mandando…'
                : `${config.robotActivo ? 'Mandar por el robot' : 'Mandar por WhatsApp'}${monto > 0 ? ` — ${fmtSoles(monto)}` : ''}`}
            </button>
          )}
          {onToggleEntregado &&
            (yaEntregado ? (
              <p
                className="text-center text-[11px] font-bold text-emerald-300"
                data-testid="qr-viaje-ya-entregado"
              >
                ✓ ya marcado: entregado{viaje.entregadoHora ? ` ${viaje.entregadoHora}` : ''}
              </p>
            ) : (
              <button
                onClick={marcarEntrega}
                data-testid="qr-viaje-marcar-entrega"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-600/20 py-2 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-600/30 active:scale-95"
                title="El cliente pagó y recibió — queda marcado con la hora (cierra el QR solo)"
              >
                <Check size={14} /> Pagó y recibió — marcar entrega
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
