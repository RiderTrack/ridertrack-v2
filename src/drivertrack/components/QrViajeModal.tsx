// ═══════════════════════════════════════════════════════════
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
//
// 💜 FASE BC: "✏️ Mensaje del cobro" — el mensaje de ESTA billetera
// (el que de verdad viaja al cliente) ahora se EDITA y se GUARDA
// para siempre, con su LIBRERÍA de variantes propia por billetera
// (chips 💾). Antes (FASE BB) solo se podía retocar el texto de un
// envío suelto y la edición no llegaba a los demás caminos.
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { Bot, Check, Loader2, MessageCircle, Pencil, QrCode, Save, Trash2, X } from 'lucide-react';
import { ConfigDT, Viaje } from '../types';
import { MetodoCobro, DatosCobro, fmtSoles, vibrar } from '../utils';
import { MensajeQr, PRESETS_QR, PLANTILLA_QR_DEF, idMensajeQr, resolverMensajeQr, sanearLibreriaQr } from '../mensajesQr';

interface Props {
  viaje: Viaje;
  config: ConfigDT;
  onCerrar: () => void;
  /** 💜 FASE AA: el cobro por el flujo COMPARTIDO de siempre —
   *  con la billetera del chip ya elegida viaja directo (el shell
   *  ya no vuelve a preguntar Yape/Plin/ambos).
   *  💜 FASE BC: sin `mensajeEditado` → viaja TU plantilla guardada
   *  de esta billetera (o el automático si nunca guardaste nada). */
  onMandarCobro?: (
    datos: DatosCobro,
    celular: string,
    metodo?: MetodoCobro,
  ) => Promise<void> | void;
  cobroEnCurso?: boolean;
  /** 💜 FASE BC: persiste TU mensaje de la billetera y la librería
   *  (viaja a tu otro celular con el sync de la config). */
  onGuardarConfig?: (c: ConfigDT) => void;
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
  onGuardarConfig,
  onToggleEntregado,
  onToast,
}: Props) {
  // default inteligente (patrón FASE Y): Yape salvo que solo haya Plin
  const hayYape = !!(config.yape.qrBase64 || config.yape.numero.trim());
  const hayPlin = !!(config.plin.qrBase64 || config.plin.numero.trim());
  const [wallet, setWallet] = useState<'yape' | 'plin'>(!hayYape && hayPlin ? 'plin' : 'yape');
  // 💜 FASE BC: el editor del mensaje — `texto` null = mostrá el
  // activo (TU plantilla guardada de esta billetera, o la de
  // fábrica si nunca guardaste). Cambiás de chip de billetera →
  // el editor arranca limpio con SU mensaje.
  const [msgAbierto, setMsgAbierto] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [activoId, setActivoId] = useState<string>('');
  const [guardandoLib, setGuardandoLib] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');

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

  // ── 💜 FASE BC: el mensaje de ESTA billetera ──
  // 1. TU plantilla guardada (config, viaja al otro cel); si no →
  // 2. la de FÁBRICA (dice lo mismo que el automático de siempre);
  // lo que ves en el editor es lo que va a salir.
  const plantillaGuardada = ((esYape ? config.mensajeQrYape : config.mensajeQrPlin) ?? '').trim();
  const textoBase = plantillaGuardada || PLANTILLA_QR_DEF[wallet];
  const textoEditor = texto ?? textoBase;
  const tocado = texto !== null && textoEditor.trim() !== textoBase.trim();
  const varsViaje = {
    cliente: viaje.cliente,
    monto,
    direccion: viaje.direccion,
    numero: billetera.numero,
    titular: billetera.titular,
  };
  const preview = resolverMensajeQr(textoEditor, varsViaje);
  const guardados: MensajeQr[] = sanearLibreriaQr(
    (esYape ? config.libreriaQr?.yape : config.libreriaQr?.plin) ?? [],
  );

  function cambiarWallet(w: 'yape' | 'plin') {
    setWallet(w);
    setTexto(null); // 💜 FASE BC: cada billetera tiene SU mensaje
    setActivoId('');
    setGuardandoLib(false);
    setNuevoNombre('');
    vibrar(30);
  }

  /** 💜 FASE BC: guarda el texto del editor como TU mensaje de esta
   *  billetera → de ahora en más TODOS los cobros de Yape/Plin salen
   *  con él (QR del viaje, "¿cómo le cobrás?", Contacto, Caja). */
  function guardarComoMio() {
    if (!onGuardarConfig) return;
    if (!textoEditor.trim()) {
      onToast?.('El mensaje está vacío — escribí algo o tocá ↩️ Automático');
      return;
    }
    onGuardarConfig({
      ...config,
      ...(esYape ? { mensajeQrYape: textoEditor } : { mensajeQrPlin: textoEditor }),
    });
    setTexto(null);
    setActivoId('');
    vibrar(60);
    onToast?.(
      `✓ Guardado — todos tus cobros por ${esYape ? 'Yape 💜' : 'Plin 🔷'} salen con este mensaje (también en tu otro cel)`,
    );
  }

  /** 💜 FASE BC: vuelve al automático de siempre (borra TU plantilla
   *  de esta billetera — la librería queda intacta). */
  function volverAlAutomatico() {
    if (!onGuardarConfig) return;
    onGuardarConfig({
      ...config,
      ...(esYape ? { mensajeQrYape: '' } : { mensajeQrPlin: '' }),
    });
    setTexto(PLANTILLA_QR_DEF[wallet]);
    setActivoId('');
    vibrar(30);
    onToast?.('↩️ Vuelve el mensaje automático de siempre');
  }

  /** 💜 FASE BC: guarda el texto del editor en la LIBRERÍA de esta
   *  billetera (para cargarlo en un toque otra vez). */
  function guardarEnLibreria() {
    if (!onGuardarConfig) return;
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      onToast?.('Ponle un nombre a la variante (ej: "Corto")');
      return;
    }
    if (!textoEditor.trim()) {
      onToast?.('El mensaje está vacío');
      return;
    }
    const nuevo: MensajeQr = { id: idMensajeQr(), nombre: nombre.slice(0, 40), texto: textoEditor.slice(0, 1500) };
    onGuardarConfig({
      ...config,
      libreriaQr: {
        ...(config.libreriaQr ?? {}),
        [wallet]: [...guardados, nuevo].slice(0, 30),
      },
    });
    setActivoId(nuevo.id);
    setNuevoNombre('');
    setGuardandoLib(false);
    vibrar(60);
    onToast?.(`📚 Guardado "${nuevo.nombre}" en la librería de ${esYape ? 'Yape' : 'Plin'}`);
  }

  function borrarDeLibreria(id: string) {
    if (!onGuardarConfig) return;
    onGuardarConfig({
      ...config,
      libreriaQr: {
        ...(config.libreriaQr ?? {}),
        [wallet]: guardados.filter((m) => m.id !== id),
      },
    });
    if (activoId === id) setActivoId('');
    vibrar(30);
    onToast?.('Variante borrada de la librería');
  }

  /** 🤖/💬 mandar el cobro — viaja la billetera que estás mostrando
   *  💜 FASE BC: y el mensaje del editor. Si lo retocaste (o cargaste
   *  una variante) va ESO, ya resuelto con los datos del viaje; si no
   *  lo tocaste, sale TU plantilla guardada de la billetera (o el
   *  automático) — el mismo texto en TODOS los caminos de cobro. */
  function mandarWhatsApp() {
    if (!onMandarCobro) return;
    onMandarCobro(
      {
        cliente: viaje.cliente,
        monto,
        direccion: viaje.direccion,
        // FASE BC: solo viaja como edición si RETOCASTE algo — lo que
        // ves resuelto en la vista previa es lo que sale
        mensajeEditado: tocado ? resolverMensajeQr(textoEditor, varsViaje) : undefined,
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
      <div className="relative max-w-sm w-full max-h-[94vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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

        {/* 💜 FASE BC — ✏️ el MENSAJE de ESTA billetera: editable,
            guardable para siempre y con SU librería de variantes.
            Colapsado por defecto para no tapar el QR. */}
        {onMandarCobro && (
          <div className="mt-2.5 rounded-xl border border-slate-700 bg-slate-900/80 p-2.5" data-testid="qr-viaje-mensaje">
            <button
              onClick={() => setMsgAbierto(!msgAbierto)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-slate-200">
                <Pencil size={12} className={esYape ? 'text-purple-400' : 'text-cyan-400'} />
                <span className="truncate">
                  Mensaje del cobro — {esYape ? '💜 Yape' : '🔷 Plin'}
                </span>
                {plantillaGuardada && (
                  <span className="shrink-0 rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-px text-[8px] font-black text-emerald-300">
                    TUYO
                  </span>
                )}
                {tocado && (
                  <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-px text-[8px] font-black text-amber-300">
                    EDITADO
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[10px] font-bold text-slate-500">{msgAbierto ? 'ocultar ▲' : 'editar ▼'}</span>
            </button>

            {msgAbierto && (
              <div className="mt-2">
                {/* 📚 la librería de esta billetera: presets de fábrica + 💾 guardados */}
                {onGuardarConfig && (
                  <div className="mb-2" data-testid="qr-viaje-libreria">
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                      📚 Librería {esYape ? 'Yape' : 'Plin'} — tocá para cargar
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESETS_QR[wallet].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setTexto(m.texto); setActivoId(m.id); vibrar(20); }}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95 ${
                            activoId === m.id
                              ? esYape
                                ? 'border-purple-400 bg-purple-500/30 text-purple-200'
                                : 'border-cyan-400 bg-cyan-500/30 text-cyan-200'
                              : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                          data-testid={`qr-viaje-preset-${m.id}`}
                          title="Mensaje de fábrica (siempre disponible)"
                        >
                          {m.nombre}
                        </button>
                      ))}
                      {guardados.map((m) => (
                        <span
                          key={m.id}
                          className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all ${
                            activoId === m.id
                              ? esYape
                                ? 'border-purple-400 bg-purple-500/30 text-purple-200'
                                : 'border-cyan-400 bg-cyan-500/30 text-cyan-200'
                              : 'border-slate-500 bg-slate-700/60 text-slate-200'
                          }`}
                          data-testid={`qr-viaje-guardado-${m.id}`}
                        >
                          <button onClick={() => { setTexto(m.texto); setActivoId(m.id); vibrar(20); }} className="max-w-[110px] truncate" title={m.texto}>
                            💾 {m.nombre}
                          </button>
                          <button
                            onClick={() => borrarDeLibreria(m.id)}
                            className="text-slate-400 hover:text-red-400"
                            aria-label={`Borrar ${m.nombre}`}
                            data-testid={`qr-viaje-borrar-${m.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* el mensaje (plantilla con etiquetas) */}
                <textarea
                  value={textoEditor}
                  onChange={e => { setTexto(e.target.value); setActivoId(''); }}
                  rows={8}
                  className="w-full resize-none rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-[11px] leading-relaxed text-slate-200 outline-none focus:border-slate-400"
                  data-testid="qr-viaje-input-msg"
                />
                <p className="mt-1 text-[9px] leading-snug text-slate-500">
                  Etiquetas: <code className={esYape ? 'text-purple-300' : 'text-cyan-300'}>{'{cliente}'}</code>{' '}
                  <code className={esYape ? 'text-purple-300' : 'text-cyan-300'}>{'{monto}'}</code>{' '}
                  <code className={esYape ? 'text-purple-300' : 'text-cyan-300'}>{'{direccion}'}</code>{' '}
                  <code className={esYape ? 'text-purple-300' : 'text-cyan-300'}>{'{numero}'}</code>{' '}
                  <code className={esYape ? 'text-purple-300' : 'text-cyan-300'}>{'{titular}'}</code> — se cambian solas al enviar
                </p>

                {/* vista previa con los datos de ESTE viaje */}
                <div className="mt-1.5 rounded-xl rounded-tl-sm bg-[#005C4B] px-3 py-2 text-[11px] leading-relaxed text-white siempre-blanco" data-testid="qr-viaje-preview">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-emerald-200/80">
                    👀 Así le va a llegar
                  </p>
                  <p className="whitespace-pre-wrap">{preview}</p>
                </div>

                {onGuardarConfig ? (
                  <>
                    {/* guardar como TU mensaje de esta billetera */}
                    <button
                      onClick={guardarComoMio}
                      className={`mt-1.5 w-full rounded-lg py-2 text-[11px] font-bold text-white transition-all active:scale-95 ${
                        esYape ? 'bg-purple-600 hover:bg-purple-700' : 'bg-cyan-600 hover:bg-cyan-700'
                      }`}
                      data-testid="qr-viaje-guardar-siempre"
                      title="De ahora en más, todos los cobros de esta billetera salen con este mensaje"
                    >
                      ✓ Guardar como MI mensaje de {esYape ? 'Yape' : 'Plin'} (sale en todos lados)
                    </button>

                    {/* guardar en la librería */}
                    {guardandoLib ? (
                      <div className="mt-1.5 flex gap-1.5">
                        <input
                          value={nuevoNombre}
                          onChange={e => setNuevoNombre(e.target.value)}
                          placeholder="Nombre (ej: Corto)"
                          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-slate-400"
                          data-testid="qr-viaje-input-nombre"
                          autoFocus
                        />
                        <button
                          onClick={guardarEnLibreria}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                          data-testid="qr-viaje-guardar-lib-ok"
                        >
                          <Save className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setGuardandoLib(false); setNuevoNombre(''); }}
                          className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-600"
                          aria-label="Cancelar"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setGuardandoLib(true)}
                        className="mt-1.5 w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[10px] font-bold text-emerald-300 transition-all hover:bg-emerald-500/20 active:scale-95"
                        data-testid="qr-viaje-guardar-libreria"
                      >
                        💾 Guardar en la librería (variante para otra vez)
                      </button>
                    )}

                    {/* volver al automático */}
                    {plantillaGuardada && (
                      <button
                        onClick={volverAlAutomatico}
                        className="mt-1.5 w-full rounded-lg bg-slate-800 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:bg-slate-700 active:scale-95"
                        data-testid="qr-viaje-auto-msg"
                        title="Borra TU mensaje guardado de esta billetera y vuelve al de siempre"
                      >
                        ↩️ Volver al mensaje automático de siempre
                      </button>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-[9px] leading-snug text-slate-500">
                    Lo que ve arriba es lo que sale en este cobro
                  </p>
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
