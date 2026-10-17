// ═══════════════════════════════════════════════════════════
// 📜 FASE T: HistorialModal — TODOS tus días, uno por renglón
// ═══════════════════════════════════════════════════════════
// "Driver track no tiene su historial — cuántos viajes hice el
// día anterior, cuánto hice ayer y antes de ayer, igualito que
// rider track, para tener control de mi dinero también libre."
//
// Se abre desde el botón 📜 de la Caja de inDrive: cada día con
// movimiento (viajes o gastos) es un renglón con sus números —
// y arriba el resumen de los últimos 7 días, 30 días y todo.
// Tocás un día y la Caja SALTA a esa fecha para ver el detalle
// completo (los viajes de ese día, uno por uno).
// Patrón visual del RobotMenu/ContactoModal (hoja de abajo).
// ═══════════════════════════════════════════════════════════
import { FC, useMemo } from 'react';
import { CalendarDays, History, X } from 'lucide-react';
import { emojiGasto, Gasto, ORIGENES, Viaje } from '../types';
import { fechaHoy } from '../storage';
import { fmtSoles, vibrar } from '../utils';
import { DiaHistorial, diasHistorial, etiquetaDia, resumenPeriodo } from '../services/historialDT';

interface Props {
  viajes: Viaje[];
  gastos: Gasto[];
  onCerrar: () => void;
  /** tocó un día → la Caja lo muestra entero (viajes de ese día) */
  onIrAFecha: (fecha: string) => void;
}

/** El renglón de un día: fecha + viajes + neto (+ gastos → en mano) */
const RenglonDia: FC<{
  dia: DiaHistorial;
  hoy: string;
  activo: boolean;
  onIr: () => void;
}> = ({
  dia,
  hoy,
  activo,
  onIr,
}) => {
  const esHoy = dia.fecha === hoy;
  // los emojis de cada app (🟢🟠🔴🔵) — solo las que tuvieron viajes
  const emojis = ORIGENES.filter(o => dia.porOrigen[o.id]).map(o => o.emoji).join('');
  return (
    <button
      onClick={() => {
        vibrar(30);
        onIr();
      }}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.99] ${
        esHoy
          ? 'border-emerald-500/50 bg-emerald-500/[0.08]'
          : activo
            ? 'border-sky-500/40 bg-sky-500/[0.06]'
            : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800'
      }`}
      data-testid="historial-dia"
      data-fecha={dia.fecha}
    >
      {/* izquierda: la fecha + cuántos viajes */}
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black capitalize ${esHoy ? 'text-emerald-300' : 'text-slate-100'}`}>
          {etiquetaDia(dia.fecha, hoy)}
          {esHoy && ' · así vas'}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
          {dia.soloGastos ? (
            <span className="text-amber-400/90">📦 solo gastos — día sin viajes</span>
          ) : (
            <>
              {dia.n} {dia.n === 1 ? 'viaje' : 'viajes'} {emojis && <span>{emojis}</span>}
            </>
          )}
        </p>
      </div>
      {/* derecha: la plata */}
      <div className="shrink-0 text-right">
        <p className={`text-sm font-black tabular-nums ${dia.neto > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
          {fmtSoles(dia.neto)}
        </p>
        {dia.gastos > 0 && (
          <p className="text-[10px] font-bold tabular-nums text-amber-300/90" title="neto − gastos del día">
            −{fmtSoles(dia.gastos)} · ✋ {fmtSoles(dia.enMano)}
          </p>
        )}
      </div>
    </button>
  );
};

export default function HistorialModal({ viajes, gastos, onCerrar, onIrAFecha }: Props) {
  const hoy = fechaHoy();
  const dias = useMemo(() => diasHistorial(viajes, gastos), [viajes, gastos]);
  const r7 = useMemo(() => resumenPeriodo(dias, hoy, 7), [dias, hoy]);
  const r30 = useMemo(() => resumenPeriodo(dias, hoy, 30), [dias, hoy]);
  const todo = useMemo(() => resumenPeriodo(dias, hoy, 'todo'), [dias, hoy]);

  const totalGastosHistoria = todo.gastos;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
      data-testid="modal-historial-dt"
    >
      <div
        className="dt-anim-pop max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* encabezado */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-black text-slate-100">
              <History size={16} className="text-emerald-300" /> 📜 Tus días
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              cuánto hiciste cada día — tocá uno y la Caja te lo muestra entero
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
            data-testid="historial-cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {dias.length === 0 ? (
          <div
            className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-6 text-center"
            data-testid="historial-vacio"
          >
            <p className="text-3xl">📜</p>
            <p className="mt-2 text-sm font-bold text-slate-200">Todavía no hay días guardados</p>
            <p className="mt-1 text-xs text-slate-400">
              Cuando cargues viajes (o anotes gastos) acá van a aparecer, uno por día — como el
              historial del trabajo.
            </p>
          </div>
        ) : (
          <>
            {/* resúmenes: 7 días · 30 días · todo */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2 text-center"
                data-testid="historial-resumen-7d"
              >
                <p className="flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wide text-emerald-500/90">
                  <CalendarDays size={10} /> 7 días
                </p>
                <p className="mt-0.5 text-sm font-black tabular-nums text-emerald-300">
                  {fmtSoles(r7.enMano)}
                </p>
                <p className="text-[9px] font-semibold text-emerald-500/70">
                  {r7.n} viajes · {r7.dias} días
                </p>
              </div>
              <div
                className="rounded-xl border border-slate-700 bg-slate-800/60 p-2 text-center"
                data-testid="historial-resumen-30d"
              >
                <p className="flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wide text-slate-500">
                  <CalendarDays size={10} /> 30 días
                </p>
                <p className="mt-0.5 text-sm font-black tabular-nums text-slate-100">
                  {fmtSoles(r30.enMano)}
                </p>
                <p className="text-[9px] font-semibold text-slate-500">
                  {r30.n} viajes · {r30.dias} días
                </p>
              </div>
              <div
                className="rounded-xl border border-slate-700 bg-slate-800/60 p-2 text-center"
                data-testid="historial-resumen-todo"
              >
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">♾️ Todo</p>
                <p className="mt-0.5 text-sm font-black tabular-nums text-slate-100">
                  {fmtSoles(todo.enMano)}
                </p>
                <p className="text-[9px] font-semibold text-slate-500">
                  {todo.n} viajes · {todo.dias} días
                </p>
              </div>
            </div>

            {/* nota si hay gastos en la historia (por qué en mano ≠ neto) */}
            {totalGastosHistoria > 0 && (
              <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] font-semibold text-slate-500">
                <span className="text-amber-400/80">{emojiGasto('otro')}</span>
                en mano = neto − gastos ({fmtSoles(totalGastosHistoria)} gastados en toda la historia)
              </p>
            )}

            {/* la lista de días — del más nuevo al más viejo */}
            <div className="mt-3 space-y-1.5" data-testid="historial-lista">
              {dias.map(d => (
                <RenglonDia
                  key={d.fecha}
                  dia={d}
                  hoy={hoy}
                  activo={false}
                  onIr={() => onIrAFecha(d.fecha)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
