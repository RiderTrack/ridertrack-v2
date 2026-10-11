// ═══════════════════════════════════════════════════════════
// 🤖 DriverTrack — Menú del robot (FASE B + B2)
// ═══════════════════════════════════════════════════════════
// Apretás el botón 🤖 de un viaje y se abre este menú con los
// avisos que el rudy-bot le manda AL CLIENTE por WhatsApp sin
// que abras nada:
//
//   🛣️ Voy en camino · ⏱️ Llegando en X min · 🏁 Ya llegué
//   ✅ Entregado · 📍 Pedir su ubicación · 💜 Cobrar (con tu QR)
//
// FASE B2: "Llegando en X minutos" — como el del trabajo: elegís
// cuántos minutos (5/10/15/20 o el que quieras) y si subiste una
// imagen en Ajustes → 🖼️ Imágenes del robot, va CON ESA IMAGEN.
//
// 👥 FASE U: tercera opción en "¿a quién?" — AMBOS. Igual que la
// foto de entrega (FASE T): los avisos les llegan a los DOS chats
// (el robot manda 2 mensajes). El cobro sigue yendo a UN solo
// chat (con 👥 va a quien recibe) — nadie recibe el pedido de
// pago dos veces.
//
// El robot manda cada aviso UNA sola vez por botón — nada de
// respuestas automáticas (esas siguen desactivadas como siempre).
// Si el robot está apagado, cada opción cae al wa.me de siempre.
// Patrón visual del NavegarMenu (F-ID3.3).
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { Bot, CheckCircle2, Flag, MapPin, Send, Timer, Wallet, X } from 'lucide-react';
import { Viaje } from '../types';
import { TipoAviso } from '../services/robotBot';

interface Props {
  viaje: Viaje;
  robotActivo: boolean;
  onCerrar: () => void;
  onAviso: (
    viaje: Viaje,
    tipo: TipoAviso,
    minutos?: number,
    telefono?: string | string[],
  ) => Promise<void> | void;
  onPedirUbicacion: (viaje: Viaje, telefono?: string | string[]) => Promise<void> | void;
  onCobrar: (datos: { cliente: string; monto: number; direccion: string }, celular: string) => Promise<void> | void;
  /** FASE B2: qué tipos tienen imagen subida (para el badge 🖼️) */
  tiposConImagen?: string[];
}

const OPCIONES: {
  tipo: TipoAviso;
  titulo: string;
  detalle: string;
  icon: typeof Send;
  color: string;
}[] = [
  {
    tipo: 'camino',
    titulo: 'Voy en camino',
    detalle: 'salgo hacia la entrega',
    icon: Send,
    color: 'border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20',
  },
  {
    tipo: 'llegando',
    titulo: 'Llegando en…',
    detalle: 'elegís los minutos ⏱️',
    icon: Timer,
    color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20',
  },
  {
    tipo: 'llegada',
    titulo: 'Ya llegué',
    detalle: 'estoy afuera esperando',
    icon: Flag,
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
  },
  {
    tipo: 'entregado',
    titulo: 'Entregado',
    detalle: 'gracias + 5 estrellitas',
    icon: CheckCircle2,
    color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
  },
];

const MINUTOS_RAPIDOS = [5, 10, 15, 20];

export default function RobotMenu({
  viaje,
  robotActivo,
  onCerrar,
  onAviso,
  onPedirUbicacion,
  onCobrar,
  tiposConImagen,
}: Props) {
  const [pidiendoMinutos, setPidiendoMinutos] = useState(false);
  const [minCustom, setMinCustom] = useState('');
  const quien = viaje.cliente.trim() || 'el cliente';
  const conImagen = (t: string) => tiposConImagen?.includes(t) ?? false;

  // ── FASE C.2: ¿a quién le mandamos el aviso? El viaje puede tener
  // DOS números: quien ENVÍA (el celular viejo del cliente cuenta
  // como quien envía) y quien RECIBE. Si hay uno solo (o son el
  // mismo número), ni se pregunta — va directo.
  // 👥 FASE U: tercera opción AMBOS — los avisos salen a los DOS
  // chats (mismo criterio que la foto de entrega FASE T).
  const telEnvia = (viaje.celularEnvia ?? '').trim() || viaje.celular.trim();
  const telRecibe = (viaje.celularRecibe ?? '').trim();
  const dosNumeros = Boolean(telEnvia && telRecibe && telEnvia !== telRecibe);
  // FASE M (fix comprobante): el default era quien RECIBE. 📣 FASE V:
  // el pedido LITERAL de Rudy era "que le llegue a los dos" — ahora el
  // default es 👥 AMBOS cuando hay dos números (los avisos salen a los
  // DOS chats sin tocar nada); si querés solo uno, tocás el chip. El
  // COBRO sigue yendo a UNO (quien recibe) pase lo que pase.
  const [destino, setDestino] = useState<'envia' | 'recibe' | 'ambos'>(() =>
    telRecibe && telRecibe !== telEnvia ? 'ambos' : 'envia',
  );

  /** los números elegidos — 1, o los 2 con 👥 Ambos (FASE U):
  *  el aviso sale UNA vez por chat, igual que la foto */
  function telefonosElegidos(): string[] {
    if (destino === 'ambos' && dosNumeros) return [telEnvia, telRecibe];
    if (destino === 'envia') return [telEnvia];
    return [telRecibe || telEnvia];
  }

  /** el chat del COBRO: siempre UNO — con 👥 Ambos va a quien
  *  RECIBE (FASE M) para que el pedido de pago no salga dos veces */
  const celCobro = destino === 'envia' ? telEnvia : telRecibe || telEnvia;

  function elegir(tipo: TipoAviso) {
    if (tipo === 'llegando') {
      // ⏱️ FASE B2: primero elegís los minutos, después se manda
      setPidiendoMinutos(true);
      return;
    }
    onAviso(viaje, tipo, undefined, telefonosElegidos());
    onCerrar();
  }

  function mandarLlegando(min: number) {
    onAviso(viaje, 'llegando', min, telefonosElegidos());
    onCerrar();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
      data-testid="robot-menu"
    >
      <div
        className="dt-anim-pop w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-black text-slate-100">
              <Bot size={16} className="text-violet-300" /> ¿Qué le aviso a {quien}?
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {robotActivo
                ? 'El robot se lo manda por WhatsApp al toque 🤖'
                : 'Robot apagado — se abre WhatsApp para enviarlo vos'}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* FASE C.2: ¿a quién? — Envía · Recibe · 👥 Ambos (solo si el
            viaje tiene los DOS teléfonos distintos). FASE M: aplica a
            los avisos Y al cobro (mismo destinatario que la foto de
            entrega). FASE U: con 👥 Ambos los AVISOS salen a los 2
            chats; el cobro va a quien RECIBE (el botón lo dice). */}
        {dosNumeros && (
          <div className="mt-2.5" data-testid="robot-destinatarios">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">¿A quién le aviso y le cobro?</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {([
                { id: 'envia', label: 'Envía 📤', title: `Va al chat de quien hace el pedido: ${telEnvia}` },
                { id: 'recibe', label: 'Recibe 📥', title: `Va al chat de quien recibe: ${telRecibe}` },
                { id: 'ambos', label: 'Ambos 👥', title: 'Los avisos les llegan a los DOS chats' },
              ] as { id: 'envia' | 'recibe' | 'ambos'; label: string; title: string }[]).map(o => (
                <button
                  key={o.id}
                  onClick={() => setDestino(o.id)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-all active:scale-[0.97] ${
                    destino === o.id
                      ? 'bg-violet-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title={o.title}
                  data-testid={`robot-dest-${o.id}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              {destino === 'ambos'
                ? 'Los avisos les llegan a los DOS chats (el cobro va a 📥 Recibe)'
                : destino === 'envia'
                  ? `Va al chat de quien hace el pedido: ${telEnvia}`
                  : `Va al chat de quien recibe: ${telRecibe}`}
            </p>
          </div>
        )}

        {!pidiendoMinutos ? (
          <>
            {/* 🛣️⏱️🏁✅ los 4 avisos (grilla 2x2) */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {OPCIONES.map(o => {
                const Icon = o.icon;
                return (
                  <button
                    key={o.tipo}
                    onClick={() => elegir(o.tipo)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3.5 transition-all active:scale-[0.98] ${o.color}`}
                    data-testid={`robot-opcion-${o.tipo}`}
                  >
                    <Icon size={20} />
                    <span className="flex items-center gap-1 text-[11px] font-black leading-tight">
                      {o.titulo}
                      {conImagen(o.tipo) && <span title="tiene imagen subida" className="text-[9px]">🖼️</span>}
                    </span>
                    <span className="text-center text-[9px] font-medium leading-tight opacity-70">{o.detalle}</span>
                  </button>
                );
              })}
            </div>

            {/* 📍 pedir ubicación + 💜 cobrar — filas anchas */}
            <div className="mt-2 space-y-2">
              <button
                onClick={() => {
                  onPedirUbicacion(viaje, telefonosElegidos());
                  onCerrar();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-3 text-left text-cyan-300 transition-all active:scale-[0.99] hover:bg-cyan-500/20"
                data-testid="robot-opcion-ubicacion"
              >
                <MapPin size={20} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-black">
                    Pedirle su ubicación {conImagen('ubicacion') ? '🖼️' : ''}
                  </span>
                  <span className="block text-[10px] font-medium opacity-70">
                    que te mande dónde está por el chat 📡
                  </span>
                </span>
              </button>
              <button
                onClick={() => {
                  // FASE M (fix comprobante): el cobro le va al
                  // DESTINATARIO ELEGIDO arriba (antes ignoraba el
                  // selector y mandaba SIEMPRE al que envía → la foto
                  // llegaba a uno y el comprobante al chat del otro).
                  // 👥 FASE U: con Ambos el cobro va a UN solo chat
                  // (quien RECIBE) — el pedido de pago no sale doble.
                  onCobrar(
                    { cliente: viaje.cliente, monto: viaje.tarifa, direccion: viaje.direccion },
                    celCobro,
                  );
                  onCerrar();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-3 text-left text-violet-300 transition-all active:scale-[0.99] hover:bg-violet-500/20"
                data-testid="robot-opcion-cobro"
              >
                <Wallet size={20} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-black">Cobrar este viaje</span>
                  <span className="block text-[10px] font-medium opacity-70">
                    {dosNumeros
                      ? `a ${destino === 'envia' ? 'Envía 📤' : 'Recibe 📥'} · mensaje + tu QR 💜/🔷 (S/ ${viaje.tarifa.toFixed(2)})`
                      : `mensaje + tu QR 💜/🔷 (S/ ${viaje.tarifa.toFixed(2)})`}
                  </span>
                </span>
              </button>
            </div>
          </>
        ) : (
          /* ⏱️ FASE B2: paso 2 — ¿en cuántos minutos llegás? */
          <div className="mt-3" data-testid="robot-minutos">
            <p className="flex items-center gap-1.5 text-xs font-black text-indigo-300">
              <Timer size={14} /> ¿En cuántos minutos llegás?
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {MINUTOS_RAPIDOS.map(m => (
                <button
                  key={m}
                  onClick={() => mandarLlegando(m)}
                  className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 py-3 text-sm font-black text-indigo-300 transition-all active:scale-[0.97] hover:bg-indigo-500/20"
                  data-testid={`robot-min-${m}`}
                >
                  {m}
                  <span className="block text-[9px] font-medium opacity-70">min</span>
                </button>
              ))}
            </div>
            {/* minutos a mano */}
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                value={minCustom}
                onChange={e => setMinCustom(e.target.value)}
                placeholder="Otro…"
                className="w-full rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2.5 text-sm font-bold text-slate-100 placeholder:font-medium placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                data-testid="robot-min-input"
              />
              <button
                onClick={() => {
                  const m = parseInt(minCustom, 10);
                  if (m > 0 && m <= 120) mandarLlegando(m);
                }}
                disabled={!minCustom || parseInt(minCustom, 10) <= 0}
                className="shrink-0 rounded-xl bg-indigo-500/20 px-4 py-2.5 text-xs font-black text-indigo-300 disabled:opacity-50"
                data-testid="robot-min-enviar"
              >
                Mandar
              </button>
            </div>
            {conImagen('llegando') && (
              <p className="mt-2 text-center text-[10px] font-semibold text-slate-400">
                🖼️ va con tu imagen de "Llegando" (la que subiste en Ajustes)
              </p>
            )}
            <button
              onClick={() => setPidiendoMinutos(false)}
              className="mt-2 w-full rounded-xl bg-slate-800 py-2 text-[11px] font-bold text-slate-300"
            >
              ← Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
