// ═══════════════════════════════════════════════════════════
// 🤖 DriverTrack — Menú del robot (FASE B)
// ═══════════════════════════════════════════════════════════
// Apretás el botón 🤖 de un viaje y se abre este menú con los
// avisos que el rudy-bot le manda AL CLIENTE por WhatsApp sin
// que abras nada:
//
//   🛣️ Voy en camino · 🏁 Ya llegué · ✅ Entregado
//   📍 Pedir su ubicación · 💜 Cobrar (con tu QR)
//
// El robot manda cada aviso UNA sola vez por botón — nada de
// respuestas automáticas (esas siguen desactivadas como siempre).
// Si el robot está apagado, cada opción cae al wa.me de siempre.
// Patrón visual del NavegarMenu (F-ID3.3).
// ═══════════════════════════════════════════════════════════
import { Bot, CheckCircle2, Flag, MapPin, Send, Wallet, X } from 'lucide-react';
import { Viaje } from '../types';
import { TipoAviso } from '../services/robotBot';

interface Props {
  viaje: Viaje;
  robotActivo: boolean;
  onCerrar: () => void;
  onAviso: (viaje: Viaje, tipo: TipoAviso) => Promise<void> | void;
  onPedirUbicacion: (viaje: Viaje) => Promise<void> | void;
  onCobrar: (datos: { cliente: string; monto: number; direccion: string }, celular: string) => Promise<void> | void;
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

export default function RobotMenu({ viaje, robotActivo, onCerrar, onAviso, onPedirUbicacion, onCobrar }: Props) {
  const quien = viaje.cliente.trim() || 'el cliente';

  function elegir(tipo: TipoAviso) {
    onAviso(viaje, tipo);
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

        {/* 🛣️🏁✅ los 3 avisos de siempre */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {OPCIONES.map(o => {
            const Icon = o.icon;
            return (
              <button
                key={o.tipo}
                onClick={() => elegir(o.tipo)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-4 transition-all active:scale-[0.98] ${o.color}`}
                data-testid={`robot-opcion-${o.tipo}`}
              >
                <Icon size={22} />
                <span className="text-[11px] font-black leading-tight">{o.titulo}</span>
                <span className="text-center text-[9px] font-medium leading-tight opacity-70">{o.detalle}</span>
              </button>
            );
          })}
        </div>

        {/* 📍 pedir ubicación + 💜 cobrar — filas anchas */}
        <div className="mt-2 space-y-2">
          <button
            onClick={() => {
              onPedirUbicacion(viaje);
              onCerrar();
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-3 text-left text-cyan-300 transition-all active:scale-[0.99] hover:bg-cyan-500/20"
            data-testid="robot-opcion-ubicacion"
          >
            <MapPin size={20} className="shrink-0" />
            <span className="min-w-0">
              <span className="block text-xs font-black">Pedirle su ubicación</span>
              <span className="block text-[10px] font-medium opacity-70">
                que te mande dónde está por el chat 📡
              </span>
            </span>
          </button>
          <button
            onClick={() => {
              onCobrar(
                { cliente: viaje.cliente, monto: viaje.tarifa, direccion: viaje.direccion },
                viaje.celular,
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
                mensaje + tu QR de Yape 💜 (S/ {viaje.tarifa.toFixed(2)})
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
