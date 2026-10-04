// ═══════════════════════════════════════════════════════════
// 📋 DriverTrack — Lista de viajes del día (F-ID2.5 → F-ID2.8)
// Muestra la dirección de entrega propia y, si hay celular,
// el botón 💬 para mandar el mensaje de cobro por WhatsApp.
// F-ID2.6: también el 💜 yape del pedido (quién pagó).
// F-ID2.8: el botón 💬 manda EXACTAMENTE el mismo mensaje del
// botón Cobrar de arriba (misma función compartida: saludo +
// monto + entrega + TU Yape + gracias) — antes mandaba una
// copia vieja sin el bloque de pago.
// ═══════════════════════════════════════════════════════════
// F-ID3: botón 📍 para GRABAR los km GPS del viaje + línea de
// km reales si ya se grabó.
// F-ID3.2: botón 📞 para LLAMAR directo al cliente (abre el
// marcador) — junto al 💬 de WhatsApp.
// F-ID3.3: botón 🧭 para VIAJAR a la entrega con Waze o Google
// Maps (junto al 📍 de GPS) + mini-selector de app.
// F-ID5: el 💬 pasa por el flujo compartido de cobro — con el robot
// activo manda el mensaje CON tu QR solo (🤖); si no, WhatsApp manual.
import { useState } from 'react';
import { Bot, Compass, Loader2, MessageCircle, Navigation, Phone, Square, Trash2 } from 'lucide-react';
import { ConfigDT, nombreOrigen, Viaje } from '../types';
import { fmtSoles, linkLlamada } from '../utils';
import { formatearDuracion } from '../services/gps';
import { abrirNavegacion, tieneDestino } from '../services/navegacion';
import NavegarMenu from './NavegarMenu';

interface Props {
  viajes: Viaje[]; // solo los del día mostrado
  onEliminar: (id: string) => void;
  titulo: string;
  config: ConfigDT; // F-ID2.8: tu Yape/Plin guardados van en el mensaje
  viajeGPSActivo?: string | null;      // F-ID3: id del viaje que se está grabando
  onIniciarGPS?: (id: string) => void; // F-ID3: arrancar la grabación
  onDetenerGPS?: () => void;           // F-ID3: terminar la grabación
  // F-ID5: flujo de cobro compartido del shell (robot si está activo,
  // WhatsApp manual si no — mismo mensaje por bloques en ambos casos)
  onMandarCobro: (datos: { cliente: string; monto: number; direccion: string }, celular: string) => Promise<void> | void;
  cobroEnCurso?: boolean; // F-ID5: hay un cobro del robot en vuelo
}

export default function ViajeList({
  viajes,
  onEliminar,
  titulo,
  config,
  viajeGPSActivo,
  onIniciarGPS,
  onDetenerGPS,
  onMandarCobro,
  cobroEnCurso = false,
}: Props) {
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  // F-ID3.3: qué viaje tiene abierto el mini-selector Waze/Google
  const [navViajeId, setNavViajeId] = useState<string | null>(null);

  /** 🧭 abrir Waze/Google hacia la entrega de ESTE viaje */
  function navegarViaje(v: Viaje) {
    const destino = v.coordenadas ?? { direccion: v.direccion.trim() };
    if (!tieneDestino(destino)) return;
    if (!abrirNavegacion(destino)) setNavViajeId(v.id);
  }

  if (viajes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/30 p-6 text-center">
        <p className="text-sm text-slate-400">Todavía no hay viajes {titulo.toLowerCase()}</p>
        <p className="mt-1 text-xs text-slate-500">Agregá el primero con el formulario de arriba 👆</p>
      </div>
    );
  }

  const ordenados = [...viajes].sort((a, b) => (a.hora < b.hora ? 1 : -1));

  return (
    <div className="space-y-2">
      {ordenados.map(v => (
        <div
          key={v.id}
          className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                {v.hora}
              </span>
              <span className="text-xs font-semibold text-emerald-300">{nombreOrigen(v.origen)}</span>
              {(v.cliente || v.zona) && (
                <span className="truncate text-xs text-slate-400">
                  {v.cliente}
                  {v.cliente && v.zona ? ' · ' : ''}
                  {v.zona}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xs text-slate-500 line-through">{fmtSoles(v.tarifa)}</span>
              <span className="text-sm font-bold text-emerald-400">{fmtSoles(v.neto)}</span>
              <span className="text-[10px] text-red-400/80">
                −{fmtSoles(v.comision)} ({v.comisionPct}%)
              </span>
            </div>
            {v.direccion && (
              <p className="mt-1 truncate text-[10px] leading-snug text-slate-400" title={v.direccion}>
                📍 {v.direccion}
              </p>
            )}
            {(v.yapeNombre || v.yapeNumero) && (
              <p
                className="mt-1 truncate text-[10px] leading-snug text-purple-300/80"
                title={`Yape del pedido: ${v.yapeNombre} ${v.yapeNumero}`.trim()}
                data-testid="yape-viaje"
              >
                💜 {v.yapeNombre} {v.yapeNumero}
              </p>
            )}
            {v.kmGPS > 0 && (
              <p
                className="mt-1 truncate text-[10px] font-semibold leading-snug text-sky-300/80"
                data-testid="km-viaje"
              >
                📍 {v.kmGPS.toFixed(1)} km reales · {formatearDuracion(v.duracionSeg)}
              </p>
            )}
            {v.notas && (
              <p className="mt-1 truncate text-[10px] leading-snug text-slate-500" title={v.notas}>
                📝 {v.notas.split('\n')[0]}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {/* F-ID3: 📍 grabar los km GPS de ESTE viaje + F-ID3.3:
                🧭 viajar a la entrega con Waze / Google Maps */}
            <div className="flex items-center gap-1">
              {viajeGPSActivo === v.id && onDetenerGPS ? (
                <button
                  onClick={onDetenerGPS}
                  className="relative flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-2 text-[10px] font-bold text-emerald-300"
                  aria-label="Terminar grabación GPS"
                  data-testid="boton-gps-activo"
                >
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
                  <Square size={11} fill="currentColor" /> GPS
                </button>
              ) : onIniciarGPS ? (
                <button
                  onClick={() => onIniciarGPS(v.id)}
                  className="rounded-lg bg-sky-500/15 p-2 text-sky-400 transition-colors hover:bg-sky-500/25"
                  aria-label="Grabar los km GPS de este viaje"
                  title="Grabar los km de este viaje"
                  data-testid="boton-gps"
                >
                  <Navigation size={16} />
                </button>
              ) : null}
              {/* F-ID3.3: 🧭 navegar a la entrega (solo si hay destino) */}
              {(v.coordenadas || v.direccion.trim()) && (
                <button
                  onClick={() => navegarViaje(v)}
                  className="rounded-lg bg-cyan-500/15 p-2 text-cyan-300 transition-colors hover:bg-cyan-500/25"
                  aria-label="Navegar a la entrega con Waze o Google Maps"
                  title="Navegar a la entrega (Waze / Google Maps)"
                  data-testid="boton-navegar-lista"
                >
                  <Compass size={16} />
                </button>
              )}
            </div>
            {v.celular.trim() && (
              <div className="flex items-center gap-1">
                {/* F-ID3.2: 📞 llamar directo — abre el marcador con +51 */}
                <button
                  onClick={() => window.open(linkLlamada(v.celular), '_self')}
                  className="rounded-lg bg-sky-500/15 p-2 text-sky-400 transition-colors hover:bg-sky-500/25"
                  aria-label="Llamar al cliente"
                  title="Llamar al cliente"
                  data-testid="boton-llamar-lista"
                >
                  <Phone size={16} />
                </button>
                <button
                  onClick={() =>
                    // F-ID2.8 + F-ID5: MISMO mensaje del botón Cobrar de
                    // arriba; con el robot activo lo manda el bot SOLO
                    onMandarCobro(
                      { cliente: v.cliente, monto: v.tarifa, direccion: v.direccion },
                      v.celular,
                    )
                  }
                  disabled={cobroEnCurso}
                  className={`rounded-lg p-2 transition-colors disabled:opacity-40 ${
                    config.robotActivo
                      ? 'bg-violet-500/15 text-violet-300 hover:bg-violet-500/25'
                      : 'bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25'
                  }`}
                  aria-label="Mandar mensaje de cobro al cliente"
                  title={config.robotActivo ? 'Mandar el cobro por el robot (con tu QR)' : 'Mandar el cobro por WhatsApp'}
                  data-testid="boton-whatsapp-lista"
                >
                  {cobroEnCurso ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : config.robotActivo ? (
                    <Bot size={16} />
                  ) : (
                    <MessageCircle size={16} />
                  )}
                </button>
              </div>
            )}
            {confirmarId === v.id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    onEliminar(v.id);
                    setConfirmarId(null);
                  }}
                  className="rounded-lg bg-red-500/20 px-2 py-1.5 text-[11px] font-bold text-red-400"
                >
                  Borrar
                </button>
                <button
                  onClick={() => setConfirmarId(null)}
                  className="rounded-lg bg-slate-700 px-2 py-1.5 text-[11px] font-bold text-slate-300"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmarId(v.id)}
                className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                aria-label="Eliminar viaje"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* F-ID3.3: mini-selector Waze / Google Maps del viaje elegido */}
      {navViajeId &&
        (() => {
          const v = ordenados.find(x => x.id === navViajeId);
          if (!v) return null;
          return (
            <NavegarMenu
              destino={v.coordenadas ?? { direccion: v.direccion.trim() }}
              etiqueta={v.direccion.trim()}
              onCerrar={() => setNavViajeId(null)}
            />
          );
        })()}
    </div>
  );
}
