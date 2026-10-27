// ═══════════════════════════════════════════════════════════
// ✏️ EDITAR VIAJE — RiderTrack v2 · sección 🏍️ Viajes inDrive
// ═══════════════════════════════════════════════════════════
// Pedido de Rudy: "a veces los teléfonos de los clientes son
// otros — ya había puesto el teléfono del que envía, pero el
// mensaje de inDrive me manda un teléfono a donde tengo que
// comunicarme" → antes un viaje cargado quedaba congelado (lo
// único era borrarlo y cargarlo de nuevo). Ahora: ✏️ en la
// tarjeta → este modal corrige los TRES teléfonos (cliente,
// quien envía, quien recibe) y el resto de los datos: cliente,
// zona, direcciones A/B, yape del pedido, tarifa (recalcula
// comisión y neto EN VIVO) y notas.
//
// Lo que NO se toca: fecha, hora, origen, paradas C/D/E, GPS
// (km reales, duración, trazado), pines del mapa, km/min A→B
// estimados, el ✓ de entrega y la foto de evidencia — eso es
// historial real, no un typo. Al guardar, el viaje editado
// viaja a la nube por el sync de siempre (aparece igual en el
// otro celular).
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { CanceladoPor, Viaje } from '../types';
import { fmtSoles } from '../utils';

interface Props {
  viaje: Viaje;
  onGuardar: (v: Viaje) => void;
  onCerrar: () => void;
}

export default function EditarViajeModal({ viaje, onGuardar, onCerrar }: Props) {
  const [cliente, setCliente] = useState(viaje.cliente);
  const [zona, setZona] = useState(viaje.zona);
  const [celular, setCelular] = useState(viaje.celular);
  const [celularEnvia, setCelularEnvia] = useState(viaje.celularEnvia ?? '');
  const [celularRecibe, setCelularRecibe] = useState(viaje.celularRecibe ?? '');
  const [dirA, setDirA] = useState(viaje.dirA ?? '');
  const [direccion, setDireccion] = useState(viaje.direccion);
  const [yapeNombre, setYapeNombre] = useState(viaje.yapeNombre ?? '');
  const [yapeNumero, setYapeNumero] = useState(viaje.yapeNumero ?? '');
  const [tarifa, setTarifa] = useState(String(viaje.tarifa));
  const [comisionPct, setComisionPct] = useState(String(viaje.comisionPct));
  const [observacion, setObservacion] = useState(viaje.observacion ?? '');
  const [notas, setNotas] = useState(viaje.notas);
  // FASE AT: ❌ marcar el pedido como CANCELADO después de aceptarlo
  // (el caso real: ya lo habías registrado y el cliente te lo canceló —
  // o tuviste que cancelarlo vos). inDrive igual te cobró la comisión
  // del saldo → el contador la sigue descontando; la Caja no la cuenta.
  const [canceladoPor, setCanceladoPor] = useState<CanceladoPor | ''>(viaje.canceladoPor ?? '');
  const [error, setError] = useState('');

  // Cálculo EN VIVO igual al formulario: coma o punto, comisión
  // sobre la tarifa, neto con 2 decimales.
  const t = parseFloat(tarifa.replace(',', '.'));
  const p = parseFloat(comisionPct.replace(',', '.')) || 0;
  const comision = Number.isFinite(t) ? +(t * (p / 100)).toFixed(2) : 0;
  const cancelado = canceladoPor === 'cliente' || canceladoPor === 'yo'; // FASE AT
  const neto = cancelado ? 0 : Number.isFinite(t) ? +(t - comision).toFixed(2) : 0; // FASE AT: cancelado → S/ 0
  const puedeGuardar = Number.isFinite(t) && t > 0;

  function guardar() {
    if (!puedeGuardar) {
      setError('Poné la tarifa del viaje');
      return;
    }
    setError('');
    onGuardar({
      // historial que NO se edita (fecha, hora, origen, paradas,
      // GPS, pines, estimados, ✓ entrega, foto de evidencia)
      ...viaje,
      // correcciones
      cliente: cliente.trim(),
      zona: zona.trim(),
      celular: celular.trim(),
      celularEnvia: celularEnvia.trim(),
      celularRecibe: celularRecibe.trim(),
      dirA: dirA.trim(),
      direccion: direccion.trim(),
      yapeNombre: yapeNombre.trim(),
      yapeNumero: yapeNumero.trim(),
      observacion: observacion.trim(),
      tarifa: t,
      comisionPct: p,
      comision: cancelado ? 0 : comision, // FASE AT: cancelado → la comisión la lleva el contador del saldo
      neto: cancelado ? 0 : neto, // FASE AT: cancelado → no entró plata
      notas: notas.trim(),
      ...(cancelado
        ? { canceladoPor: canceladoPor as CanceladoPor }
        : { canceladoPor: undefined }), // FASE AT: des-marcar también se puede
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
      data-testid="modal-editar"
    >
      <div className="dt-anim-pop flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-amber-400">
              <Pencil size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Editar viaje</h3>
              <p className="text-[11px] text-slate-400">
                Corregí los teléfonos o lo que sea — fecha, hora y GPS quedan como están
              </p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
            data-testid="cerrar-editar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Campos */}
        <div className="space-y-2.5 overflow-y-auto p-4">
          {/* 📱 TELÉFONOS — protagonistas: el caso real es "inDrive
              me manda a llamar a OTRO número distinto del que
              escaneé". Tres campos, FASE C: cliente (el de siempre,
              fallback), quien envía y quien recibe. */}
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-2.5">
            <label className="mb-1 block text-[11px] font-bold text-emerald-300">
              📱 Celular del cliente
            </label>
            <input
              value={celular}
              onChange={e => setCelular(e.target.value)}
              inputMode="tel"
              placeholder="987 654 321"
              className="w-full rounded-xl border border-emerald-500/40 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-emerald-100 placeholder-slate-600 outline-none focus:border-emerald-400"
              data-testid="input-edit-celular"
            />
            <p className="mt-1 text-[10px] leading-snug text-slate-400">
              El de siempre: con él salen los botones de Contacto/cobro cuando no hay
              envía ni recibe cargados.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                📤 Celular de quien envía
              </label>
              <input
                value={celularEnvia}
                onChange={e => setCelularEnvia(e.target.value)}
                inputMode="tel"
                placeholder="987 111 111"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-edit-envia"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                📥 Celular de quien recibe
              </label>
              <input
                value={celularRecibe}
                onChange={e => setCelularRecibe(e.target.value)}
                inputMode="tel"
                placeholder="987 222 222"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-edit-recibe"
              />
            </div>
          </div>
          <p className="-mt-1 text-[10px] leading-snug text-slate-500">
            Si el escáner agarró el número que no era, corregilo acá — el menú de Contacto
            y el cobro van al que corresponde.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Cliente</label>
              <input
                value={cliente}
                onChange={e => setCliente(e.target.value)}
                placeholder="Nombre"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-edit-cliente"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Zona</label>
              <input
                value={zona}
                onChange={e => setZona(e.target.value)}
                placeholder="Surco"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-edit-zona"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                🅰️ Recojo
              </label>
              <input
                value={dirA}
                onChange={e => setDirA(e.target.value)}
                placeholder="De dónde salís"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-edit-dira"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                📍 Entrega
              </label>
              <input
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Dónde lo entregás"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-edit-direccion"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                💜 Yape (nombre)
              </label>
              <input
                value={yapeNombre}
                onChange={e => setYapeNombre(e.target.value)}
                placeholder="Mk"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-edit-yape-nombre"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                💜 Yape (número)
              </label>
              <input
                value={yapeNumero}
                onChange={e => setYapeNumero(e.target.value)}
                inputMode="tel"
                placeholder="980811297"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-edit-yape-numero"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                Tarifa (S/)
              </label>
              <input
                value={tarifa}
                onChange={e => setTarifa(e.target.value)}
                inputMode="decimal"
                placeholder="12.50"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-edit-tarifa"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Comisión %</label>
              <input
                value={comisionPct}
                onChange={e => setComisionPct(e.target.value)}
                inputMode="decimal"
                placeholder="18"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-edit-comision"
              />
            </div>
          </div>

          {/* Neto en vivo — mismo look de la tarjeta (tarifa tachada + neto) */}
          {puedeGuardar && (
            cancelado ? (
              <p
                className="flex items-baseline justify-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-xs"
                data-testid="editar-neto-vivo"
              >
                <span className="font-bold text-red-300">❌ Cancelado — no entró plata (S/ 0.00)</span>
                <span className="text-[10px] font-semibold text-amber-300">
                  🪫 la comisión ({p}%) se descuenta igual del saldo
                </span>
              </p>
            ) : (
              <p
                className="flex items-baseline justify-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-xs"
                data-testid="editar-neto-vivo"
              >
                <span className="text-slate-500 line-through">{fmtSoles(t)}</span>
                <span className="font-bold text-emerald-400">{fmtSoles(neto)}</span>
                <span className="text-[10px] text-red-400/80">
                  −{fmtSoles(comision)} ({p}%)
                </span>
              </p>
            )
          )}

          {/* FASE AT: ❌ marcar como CANCELADO — el pedido que ya habías
              registrado y se cayó después de aceptarlo */}
          <div
            className={`rounded-xl border px-3 py-2.5 ${
              cancelado ? 'border-red-500/50 bg-red-500/[0.07]' : 'border-slate-700 bg-slate-950/60'
            }`}
            data-testid="box-editar-cancelado"
          >
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
              <input
                type="checkbox"
                checked={cancelado}
                onChange={e => setCanceladoPor(e.target.checked ? 'cliente' : '')}
                className="h-4 w-4 accent-red-500"
                data-testid="toggle-editar-cancelado"
              />
              ❌ Este pedido se canceló (después de aceptarlo)
            </label>
            {cancelado && (
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCanceladoPor('cliente')}
                  className={`flex-1 rounded-lg border py-1.5 text-[11px] font-bold transition-all active:scale-[0.97] ${
                    canceladoPor === 'cliente'
                      ? 'border-red-400 bg-red-500/20 text-red-200'
                      : 'border-slate-600 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                  data-testid="chip-editar-cancelado-cliente"
                >
                  😞 Me lo cancelaron
                </button>
                <button
                  type="button"
                  onClick={() => setCanceladoPor('yo')}
                  className={`flex-1 rounded-lg border py-1.5 text-[11px] font-bold transition-all active:scale-[0.97] ${
                    canceladoPor === 'yo'
                      ? 'border-red-400 bg-red-500/20 text-red-200'
                      : 'border-slate-600 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                  data-testid="chip-editar-cancelado-yo"
                >
                  🤚 Lo cancelé yo
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">
              📦 Observación del pedido
            </label>
            <input
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Una bolsa, un artefacto…"
              className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
              data-testid="input-edit-observacion"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">📝 Notas</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Referencias, detalle del pedido…"
              className="w-full resize-none rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
              data-testid="textarea-edit-notas"
            />
          </div>

          {error && <p className="text-center text-[11px] font-semibold text-amber-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCerrar}
              className="flex-1 rounded-xl bg-slate-700 py-3 text-sm font-bold text-slate-300 transition-all active:scale-[0.98]"
              data-testid="boton-cancelar-edicion"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={!puedeGuardar}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all active:scale-[0.98] ${
                puedeGuardar
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-slate-700 text-slate-500'
              }`}
              data-testid="boton-guardar-edicion"
            >
              <Check size={16} /> Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
