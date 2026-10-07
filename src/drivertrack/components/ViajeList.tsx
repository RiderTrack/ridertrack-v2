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
import { useEffect, useState } from 'react';
import { Camera, CheckCircle2, Phone, Route, Trash2 } from 'lucide-react';
import { ConfigDT, nombreOrigen, Viaje } from '../types';
import { fmtSoles, vibrar } from '../utils';
import { formatearDuracion } from '../services/gps';
// FASE H: 🛣️ TODO lo de la ruta (navegar A/B, copiar, GPS, km) vive
// ahora adentro del RutaModal — antes eran botoncitos A + B + GPS
// sueltos en la tarjeta (pedido de Rudy: agrupar como el contacto)
import RutaModal from './RutaModal';
// FASE G: todas las llamadas y WhatsApp de la tarjeta viven ahora
// adentro del ContactoModal — antes eran 6 botoncitos 📞💬 que
// ocupaban media tarjeta (pedido de Rudy: agruparlos en un modal)
import ContactoModal, { type Contacto } from './ContactoModal';
// FASE H: 📷 foto de la entrega — el cliente la pide para comprobar,
// se saca acá y se manda por WhatsApp con el mensaje configurable
import FotoEntregaModal from './FotoEntregaModal';
// FASE B: menú de avisos del robot (voy en camino · llegué · entregado…)
import RobotMenu from './RobotMenu';

// FASE E: 📋 copiar dirección con respaldo (WebView de Android sin
// clipboard API — el textarea viejo nunca falla)
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // sigue al plan B
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

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
  // FASE B: avisos al cliente por el robot (menú 🤖 de cada viaje)
  // FASE C: + telefono elegido en el menú (cliente · quien envía · quien recibe)
  onMandarAviso?: (viaje: Viaje, tipo: 'camino' | 'llegando' | 'llegada' | 'entregado', minutos?: number, telefono?: string) => Promise<void> | void;
  onPedirUbicacion?: (viaje: Viaje, telefono?: string) => Promise<void> | void;
  /** FASE B2: tipos de aviso con imagen subida (badge 🖼️ en el menú del robot) */
  tiposConImagen?: string[];
  /** FASE C.2: id del viaje recién agregado — se resalta (✨ NUEVO)
   *  y la lista se desliza hasta él para verlo completo con sus botones */
  destacadoId?: string | null;
  /** FASE F: ✓ marcar/desmarcar la ENTREGA COMPLETADA de un viaje */
  onToggleEntregado?: (id: string) => void;
  /** FASE H: 📷 guardar la foto de entrega (evidencia comprimida)
   *  en el viaje — el shell le pone la hora */
  onGuardarFoto?: (id: string, dataUrl: string) => void;
  /** FASE H: toasts del shell para el modal de la foto */
  onToast?: (msg: string) => void;
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
  onMandarAviso,
  onPedirUbicacion,
  tiposConImagen,
  destacadoId,
  onToggleEntregado,
  onGuardarFoto,
  onToast,
}: Props) {
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  // FASE B: qué viaje tiene abierto el menú del robot 🤖
  const [robotViajeId, setRobotViajeId] = useState<string | null>(null);
  // FASE G: qué viaje tiene abierto el modal de contacto (📞/💬/cobro/avisos)
  const [contactoViajeId, setContactoViajeId] = useState<string | null>(null);
  // FASE H: qué viaje tiene abierto el modal de la RUTA (A/B/GPS/km)
  const [rutaViajeId, setRutaViajeId] = useState<string | null>(null);
  // FASE H: qué viaje tiene abierto el modal de la FOTO de entrega
  const [fotoViajeId, setFotoViajeId] = useState<string | null>(null);
  // FASE E: qué dirección se acaba de copiar ("{id}-a" / "{id}-b") —
  // muestra el ✓ Copiada en la tarjeta
  const [copiadoKey, setCopiadoKey] = useState<string | null>(null);

  /** 📋 FASE E: tocar la dirección la copia (A, B o paradas C…) */
  async function copiarDireccion(viajeId: string, cual: string, texto: string) {
    const limpio = texto.trim();
    if (!limpio) return;
    const ok = await copiarTexto(limpio);
    if (ok) {
      setCopiadoKey(`${viajeId}-${cual}`);
      vibrar(40);
      setTimeout(() => setCopiadoKey(null), 1600);
    }
  }

  // FASE C.2: al agregar un viaje, la lista se desliza solita hasta su
  // tarjeta para verla completa (direcciones, teléfonos y botones)
  useEffect(() => {
    if (!destacadoId) return;
    const el = document.getElementById(`viaje-${destacadoId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destacadoId]);

  // FASE H: navegar/copiar/GPS se manejan adentro del RutaModal

  if (viajes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/30 p-6 text-center">
        <p className="text-sm text-slate-400">Todavía no hay viajes {titulo.toLowerCase()}</p>
        <p className="mt-1 text-xs text-slate-500">Agregá el primero con el formulario de arriba 👆</p>
      </div>
    );
  }

  // FASE C.2: el más reciente primero también cuando la hora empata
  // (el id arranca con Date.now() → el recién agregado queda arriba)
  const ordenados = [...viajes].sort((a, b) =>
    a.hora < b.hora ? 1 : a.hora > b.hora ? -1 : a.id < b.id ? 1 : -1,
  );

  return (
    <div className="space-y-2">
      {ordenados.map(v => {
        // FASE C.2: teléfonos del viaje — quien ENVÍA (el celular viejo
        // del cliente cuenta como quien envía) y quien RECIBE
        const telEnvia = (v.celularEnvia ?? '').trim() || v.celular.trim();
        const telRecibe = (v.celularRecibe ?? '').trim();
        const telCobro = telEnvia || telRecibe; // cobro/aviso por defecto
        const dosNumeros = telEnvia && telRecibe && telEnvia !== telRecibe;
        const esNuevo = destacadoId === v.id;
        // FASE F: ✓ entrega completada — la tarjeta se pinta de verde
        // suave y el horario queda guardado (para saber cuántos faltan)
        const yaEntregado = v.entregado === true;
        return (
        <div
          key={v.id}
          id={`viaje-${v.id}`}
          className={`flex items-center gap-3 rounded-xl border bg-slate-800/60 p-3 scroll-mt-24 ${
            esNuevo
              ? 'border-emerald-500/70 ring-2 ring-emerald-500/40'
              : yaEntregado
                ? 'border-emerald-500/50 bg-emerald-500/[0.06]'
                : 'border-slate-700'
          }`}
          data-testid="tarjeta-viaje"
          data-entregado={yaEntregado ? 'si' : 'no'}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                {v.hora}
              </span>
              {esNuevo && (
                <span
                  className="rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-950"
                  data-testid="badge-nuevo"
                >
                  ✨ Nuevo
                </span>
              )}
              {/* FASE F: ✓ entrega completada — a qué hora quedó entregado */}
              {yaEntregado && (
                <span
                  className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-300"
                  data-testid="badge-entregado"
                  title={v.entregadoHora ? `Marcado entregado a las ${v.entregadoHora}` : 'Entrega completada'}
                >
                  ✓ Entregado{v.entregadoHora ? ` ${v.entregadoHora}` : ''}
                </span>
              )}
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
            {/* FASE E: las direcciones ahora se TOCAN para COPIARLAS
                (A y B por separado — ✓ Copiada como feedback). Al lado
                siguen los botones A/B para navegar. */}
            {v.dirA?.trim() ? (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] leading-snug text-slate-400">
                <button
                  onClick={() => copiarDireccion(v.id, 'a', v.dirA || '')}
                  className="min-w-0 max-w-full truncate rounded px-0.5 py-0.5 text-left transition-colors hover:text-amber-300"
                  title="Tocá para copiar la dirección del recojo (A)"
                  data-testid="boton-copiar-a"
                >
                  {copiadoKey === `${v.id}-a` ? (
                    <span className="font-bold text-emerald-400">✓ Copiada 🅰️</span>
                  ) : (
                    <>🅰️ {v.dirA}</>
                  )}
                </button>
                <span className="shrink-0 text-slate-600">→</span>
                <button
                  onClick={() => copiarDireccion(v.id, 'b', v.direccion || '')}
                  className="min-w-0 max-w-full truncate rounded px-0.5 py-0.5 text-left text-slate-500 transition-colors hover:text-sky-300"
                  title="Tocá para copiar la dirección de entrega (B)"
                  data-testid="boton-copiar-b"
                >
                  {copiadoKey === `${v.id}-b` ? (
                    <span className="font-bold text-emerald-400">✓ Copiada 📍</span>
                  ) : (
                    <>📍 {v.direccion || '—'}</>
                  )}
                </button>
                {/* FASE M: 🅾️ las PARADAS del multi-punto (C, D, E) —
                    copiables igual que A y B, en orden de ruta */}
                {(v.paradas ?? []).map((p, i) =>
                  p.trim() ? (
                    <span key={`${v.id}-c${i}`} className="flex min-w-0 max-w-full items-center gap-1">
                      <span className="shrink-0 text-slate-600">→</span>
                      <button
                        onClick={() => copiarDireccion(v.id, `c${i}`, p)}
                        className="min-w-0 max-w-full truncate rounded px-0.5 py-0.5 text-left text-violet-300/90 transition-colors hover:text-violet-200"
                        title={`Tocá para copiar la parada ${String.fromCharCode(67 + i)}`}
                        data-testid="boton-copiar-c"
                      >
                        {copiadoKey === `${v.id}-c${i}` ? (
                          <span className="font-bold text-emerald-400">
                            ✓ Copiada 🅾️ {String.fromCharCode(67 + i)}
                          </span>
                        ) : (
                          <>🅾️ {String.fromCharCode(67 + i)} {p.trim()}</>
                        )}
                      </button>
                    </span>
                  ) : null,
                )}
              </div>
            ) : (
              v.direccion && (
                <button
                  onClick={() => copiarDireccion(v.id, 'b', v.direccion)}
                  className="mt-1 block max-w-full truncate rounded px-0.5 py-0.5 text-left text-[10px] leading-snug text-slate-400 transition-colors hover:text-sky-300"
                  title="Tocá para copiar la dirección de entrega"
                  data-testid="boton-copiar-b"
                >
                  {copiadoKey === `${v.id}-b` ? (
                    <span className="font-bold text-emerald-400">✓ Copiada 📍</span>
                  ) : (
                    <>📍 {v.direccion}</>
                  )}
                </button>
              )
            )}
            {/* FASE M: paradas del multi-punto cuando NO hay recojo (A)
                cargado — mismas copiables violeta que la fila de arriba */}
            {!v.dirA?.trim() &&
              (v.paradas ?? []).some(p => p.trim()) && (
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] leading-snug">
                  {(v.paradas ?? []).map((p, i) =>
                    p.trim() ? (
                      <span key={`${v.id}-s${i}`} className="flex min-w-0 max-w-full items-center gap-1">
                        <span className="shrink-0 text-slate-600">→</span>
                        <button
                          onClick={() => copiarDireccion(v.id, `c${i}`, p)}
                          className="min-w-0 max-w-full truncate rounded px-0.5 py-0.5 text-left text-violet-300/90 transition-colors hover:text-violet-200"
                          title={`Tocá para copiar la parada ${String.fromCharCode(67 + i)}`}
                          data-testid="boton-copiar-c"
                        >
                          {copiadoKey === `${v.id}-c${i}` ? (
                            <span className="font-bold text-emerald-400">
                              ✓ Copiada 🅾️ {String.fromCharCode(67 + i)}
                            </span>
                          ) : (
                            <>🅾️ {String.fromCharCode(67 + i)} {p.trim()}</>
                          )}
                        </button>
                      </span>
                    ) : null,
                  )}
                </div>
              )}
            {/* FASE I: 📦 OBSERVACIÓN del pedido — qué llevás ("una
                bolsa", "un artefacto"). La llena el escáner leyendo
                los Comentarios del pedido; ámbar para verla ANTES de
                pasar a buscar. */}
            {v.observacion?.trim() && (
              <p
                className="mt-1 truncate rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-amber-300/90"
                title={v.observacion}
                data-testid="observacion-viaje"
              >
                📦 {v.observacion}
              </p>
            )}
            {(v.celularEnvia?.trim() || v.celularRecibe?.trim()) ? (
              <p className="mt-1 truncate text-[10px] leading-snug text-slate-500">
                {v.celularEnvia?.trim() ? `📤 envía ${v.celularEnvia.trim()}` : ''}
                {v.celularEnvia?.trim() && v.celularRecibe?.trim() ? ' · ' : ''}
                {v.celularRecibe?.trim() ? `📥 recibe ${v.celularRecibe.trim()}` : ''}
              </p>
            ) : v.celular.trim() ? (
              <p className="mt-1 truncate text-[10px] leading-snug text-slate-500" title={v.celular}>
                📞 {v.celular}
              </p>
            ) : null}
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
            {/* FASE F: 🛣️ km A→B calculados solos — se muestran mientras
                no tengas los km reales del GPS grabado */}
            {v.kmGPS === 0 && v.kmEstimado != null && v.kmEstimado > 0 && (
              <p
                className="mt-1 truncate text-[10px] font-semibold leading-snug text-indigo-300/80"
                data-testid="km-estimado-viaje"
                title="Distancia A → B calculada con los pines del mapa (Google por calles, o estimado sin conexión)"
              >
                🛣️ A→B ~{v.kmEstimado.toFixed(1)} km{v.minEstimados ? ` · ~${v.minEstimados} min` : ''}
              </p>
            )}
            {v.notas && (
              <p className="mt-1 truncate text-[10px] leading-snug text-slate-500" title={v.notas}>
                📝 {v.notas.split('\n')[0]}
              </p>
            )}
            {/* FASE H: 📷 evidencia de la entrega guardada — tocá para
                verla, mandarla de nuevo o sacar otra */}
            {v.fotoEntrega && (
              <button
                onClick={() => setFotoViajeId(v.id)}
                className="mt-1 truncate rounded px-0.5 py-0.5 text-left text-[10px] font-semibold leading-snug text-emerald-300/90 transition-colors hover:text-emerald-200"
                title={`Foto de la entrega guardada${v.fotoEntregaHora ? ` a las ${v.fotoEntregaHora}` : ''} — tocá para verla o mandarla de nuevo`}
                data-testid="linea-evidencia"
              >
                📷 Foto de la entrega{v.fotoEntregaHora ? ` · ${v.fotoEntregaHora}` : ''}
              </button>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {/* FASE F: ✓ ENTREGA COMPLETADA — un toque y queda marcado con
                la hora; el contador del día suma. Tocá de nuevo para
                desmarcar (por si se apretó sin querer). */}
            <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
              {onToggleEntregado && (
                <button
                  onClick={() => {
                    onToggleEntregado(v.id);
                    vibrar(yaEntregado ? 30 : 90);
                  }}
                  className={`flex flex-col items-center rounded-lg p-2 transition-all active:scale-95 ${
                    yaEntregado
                      ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-400/60'
                      : 'bg-slate-700/40 text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-300'
                  }`}
                  aria-label={yaEntregado ? 'Desmarcar entrega' : 'Marcar entrega completada'}
                  title={
                    yaEntregado
                      ? `✓ Entregado${v.entregadoHora ? ` a las ${v.entregadoHora}` : ''} — tocá para DESMARCAR`
                      : 'Marcar como ENTREGADO — queda con la hora y el contador del día'
                  }
                  data-testid="boton-entregado"
                >
                  <CheckCircle2 size={16} fill={yaEntregado ? 'currentColor' : 'none'} />
                  <span className="text-[8px] font-black leading-none">
                    {yaEntregado ? v.entregadoHora ?? '✓' : 'Entrega'}
                  </span>
                </button>
              )}
              {/* FASE H: 🛣️ UN solo botón que abre el RutaModal con TODO
                  adentro: navegar al recojo (A) y a la entrega (B), copiar
                  las direcciones y grabar los km con GPS. Antes eran 3
                  botoncitos (GPS · B · A) sueltos en la tarjeta. Si está
                  grabando ESTE viaje, el puntito verde pulsa. */}
              <button
                onClick={() => setRutaViajeId(v.id)}
                className={`relative flex flex-col items-center rounded-lg p-2 transition-all active:scale-95 ${
                  viajeGPSActivo === v.id
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50'
                    : 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25'
                }`}
                aria-label="Ruta del viaje: navegar, copiar dirección, grabar km"
                title="Ruta del viaje — navegar a A y a B, copiar las direcciones y grabar los km con GPS"
                data-testid="boton-ruta"
              >
                {viajeGPSActivo === v.id && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
                )}
                <Route size={16} />
                <span className="text-[8px] font-black leading-none">Ruta</span>
              </button>
            </div>
            {/* FASE G: 📞 UN solo botón que abre el ContactoModal con
                TODO adentro: llamar/WhatsApp a A y a B, el cobro, los
                avisos del robot y la FOTO de la entrega. Antes eran 6
                botoncitos 📞💬 que se comían la tarjeta. */}
            {telCobro && (
              <button
                onClick={() => setContactoViajeId(v.id)}
                className="flex flex-col items-center rounded-lg bg-sky-500/15 p-2 text-sky-400 transition-colors hover:bg-sky-500/25"
                aria-label="Llamar o escribir por WhatsApp"
                title="Llamar o escribir — abre el contacto de A y B, el cobro, los avisos y la foto de la entrega"
                data-testid="boton-contacto"
              >
                <Phone size={16} />
                <span className="text-[8px] font-black leading-none">Contacto</span>
              </button>
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
        );
      })}

      {/* FASE H: 🛣️ modal de la RUTA — navegar a A y a B, copiar las
          direcciones, grabar los km con GPS (antes: 3 botoncitos) */}
      {rutaViajeId &&
        (() => {
          const v = ordenados.find(x => x.id === rutaViajeId);
          if (!v) return null;
          return (
            <RutaModal
              viaje={v}
              onCerrar={() => setRutaViajeId(null)}
              grabando={viajeGPSActivo === v.id}
              onIniciarGPS={onIniciarGPS ? () => onIniciarGPS(v.id) : undefined}
              onDetenerGPS={onDetenerGPS}
            />
          );
        })()}

      {/* FASE H: 📷 modal de la FOTO de entrega — sacar, mandar por
          WhatsApp con el mensaje y guardar la evidencia */}
      {fotoViajeId &&
        (() => {
          const v = ordenados.find(x => x.id === fotoViajeId);
          if (!v || !onGuardarFoto) return null;
          return (
            <FotoEntregaModal
              viaje={v}
              config={config}
              onCerrar={() => setFotoViajeId(null)}
              onGuardar={dataUrl => onGuardarFoto(v.id, dataUrl)}
              onToast={onToast ?? (() => {})}
            />
          );
        })()}

      {/* FASE G: modal de contacto — llamadas + WhatsApp + cobro +
          avisos, todo junto (antes: 6 botoncitos en la tarjeta) */}
      {contactoViajeId &&
        (() => {
          const v = ordenados.find(x => x.id === contactoViajeId);
          if (!v) return null;
          // mismos teléfonos que usaba la fila de botones vieja:
          // quien ENVÍA (el celular viejo del cliente cuenta como
          // quien envía) y quien RECIBE, si son dos números distintos
          const telE = (v.celularEnvia ?? '').trim() || v.celular.trim();
          const telR = (v.celularRecibe ?? '').trim();
          const dos = Boolean(telE && telR && telE !== telR);
          const contactos: Contacto[] = [];
          if (telE) contactos.push({ id: 'a', label: dos ? '📤 Envía (A)' : '📞 Cliente', numero: telE });
          else if (telR) contactos.push({ id: 'a', label: '📥 Recibe (B)', numero: telR });
          if (dos) contactos.push({ id: 'b', label: '📥 Recibe (B)', numero: telR });
          const puedeAvisar = Boolean(onMandarAviso && onPedirUbicacion);
          return (
            <ContactoModal
              contactos={contactos}
              onCerrar={() => setContactoViajeId(null)}
              onCobrar={
                // F-ID2.8 + F-ID5: MISMO mensaje del botón Cobrar de
                // siempre; con el robot activo lo manda el bot SOLO.
                // FASE M (fix comprobante): el ContactoModal le pasa
                // el NÚMERO elegido con los chips (default: quien
                // RECIBE — antes iba siempre al que envía).
                numero => {
                  onMandarCobro(
                    { cliente: v.cliente, monto: v.tarifa, direccion: v.direccion },
                    numero,
                  );
                  setContactoViajeId(null);
                }
              }
              cobrando={cobroEnCurso}
              cobroRobot={config.robotActivo}
              montoCobro={v.tarifa}
              onAvisos={
                puedeAvisar
                  ? () => {
                      // cerrá este y abrí el menú de avisos del robot
                      setContactoViajeId(null);
                      setRobotViajeId(v.id);
                    }
                  : undefined
              }
              onFoto={
                onGuardarFoto
                  ? () => {
                      // FASE H: cerrá el contacto y abrí la FOTO de
                      // la entrega (sacar/mirar/mandar al cliente)
                      setContactoViajeId(null);
                      setFotoViajeId(v.id);
                    }
                  : undefined
              }
            />
          );
        })()}

      {/* FASE B: menú del robot 🤖 — avisos al cliente de ESTE viaje */}
      {robotViajeId &&
        (() => {
          const v = ordenados.find(x => x.id === robotViajeId);
          if (!v || !onMandarAviso || !onPedirUbicacion) return null;
          return (
            <RobotMenu
              viaje={v}
              robotActivo={config.robotActivo}
              onCerrar={() => setRobotViajeId(null)}
              onAviso={onMandarAviso}
              onPedirUbicacion={onPedirUbicacion}
              onCobrar={onMandarCobro}
              tiposConImagen={tiposConImagen}
            />
          );
        })()}
    </div>
  );
}
