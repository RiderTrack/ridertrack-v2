// ═══════════════════════════════════════════════════════════
// 🏍️ FASE C: Lo que ganás en LIBRE — tarjeta para el panel general
// ═══════════════════════════════════════════════════════════
// El panel general solo mostraba lo del TRABAJO — ahora esta
// tarjeta agrega lo de tus viajes LIBRES (inDrive), bien
// separada: hoy, la semana y el mes, neto y lo que quedó EN
// MANO (neto − gastos anotados). Lee los mismos datos del
// storage de DriverTrack y refresca sola (nube u otro panel).
//
//   compacta → para el Dashboard (chiquita, con botón a inDrive)
//   completa → para el Resumen del día (hoy / 7d / 30d)
// ═══════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { Bike, TrendingUp, Wallet } from 'lucide-react';
import { Viaje } from '../drivertrack/types';
import { cargarGastos, cargarViajes, fechaHoy } from '../drivertrack/storage';
import { Gasto } from '../drivertrack/types';

function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function resumenEntre(viajes: Viaje[], gastos: Gasto[], desdeISO: string, hastaISO: string) {
  const delRango = viajes.filter(v => v.fecha >= desdeISO && v.fecha <= hastaISO);
  const gastosRango = gastos.filter(g => g.fecha >= desdeISO && g.fecha <= hastaISO);
  const neto = delRango.reduce((s, v) => s + v.neto, 0);
  const gastado = gastosRango.reduce((s, g) => s + g.monto, 0);
  return { n: delRango.length, neto, gastado, enMano: neto - gastado };
}

interface Props {
  /** true = tarjeta chiquita para el Dashboard; false = completa con hoy/7d/30d */
  compacta?: boolean;
  /** clic en "ver viajes" → te manda a la sección inDrive del menú */
  onIrAViajes?: () => void;
}

export default function ResumenLibreCard({ compacta = false, onIrAViajes }: Props) {
  const [viajes, setViajes] = useState<Viaje[]>(() => cargarViajes());
  const [gastos, setGastos] = useState<Gasto[]>(() => cargarGastos());

  // refresco solo: cambios desde el shell / paneles / la nube
  useEffect(() => {
    const alSync = () => {
      setViajes(cargarViajes());
      setGastos(cargarGastos());
    };
    window.addEventListener('dt:sync-remoto', alSync);
    return () => window.removeEventListener('dt:sync-remoto', alSync);
  }, []);

  const hoy = fechaHoy();
  const rangos = useMemo(
    () => ({
      hoy: resumenEntre(viajes, gastos, hoy, hoy),
      semana: resumenEntre(viajes, gastos, sumarDias(hoy, -6), hoy),
      mes: resumenEntre(viajes, gastos, sumarDias(hoy, -29), hoy),
    }),
    [viajes, gastos, hoy],
  );

  const soles = (n: number) => `S/ ${n.toFixed(2)}`;

  // ── versión compacta (Dashboard) ──
  if (compacta) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-transparent p-4" data-testid="resumen-libre-compacto">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
            <Bike size={14} /> inDrive (libre) — hoy
          </p>
          {onIrAViajes && (
            <button
              onClick={onIrAViajes}
              className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300 transition-colors hover:bg-emerald-500/25"
            >
              ver viajes →
            </button>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-emerald-400">{soles(rangos.hoy.enMano)}</span>
          <span className="text-[10px] font-semibold text-slate-400">
            en mano · {rangos.hoy.n} viaje{rangos.hoy.n === 1 ? '' : 's'}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Semana: <b className="text-slate-300">{soles(rangos.semana.enMano)}</b> · Mes:{' '}
          <b className="text-slate-300">{soles(rangos.mes.enMano)}</b>
        </p>
      </div>
    );
  }

  // ── versión completa (Resumen del día) ──
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-transparent p-5" data-testid="resumen-libre-completo">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-black text-emerald-300">
            <Bike size={16} /> Viajes libres (inDrive)
          </p>
          <p className="text-[11px] text-slate-400">
            Separado del trabajo — neto de tus viajes menos los gastos anotados en la Caja inDrive
          </p>
        </div>
        {onIrAViajes && (
          <button
            onClick={onIrAViajes}
            className="shrink-0 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[10px] font-black text-emerald-300 transition-colors hover:bg-emerald-500/25"
          >
            ver viajes →
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-slate-900/60 p-3">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-500/80">
            <TrendingUp size={11} /> Hoy
          </p>
          <p className="mt-1 text-lg font-black leading-none text-emerald-400">{soles(rangos.hoy.enMano)}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            {rangos.hoy.n} viaje{rangos.hoy.n === 1 ? '' : 's'} · neto {soles(rangos.hoy.neto)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-slate-900/60 p-3">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-500/80">
            <Wallet size={11} /> 7 días
          </p>
          <p className="mt-1 text-lg font-black leading-none text-emerald-300">{soles(rangos.semana.enMano)}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            {rangos.semana.n} viajes · neto {soles(rangos.semana.neto)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-slate-900/60 p-3">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-500/80">
            <Wallet size={11} /> 30 días
          </p>
          <p className="mt-1 text-lg font-black leading-none text-emerald-200">{soles(rangos.mes.enMano)}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            {rangos.mes.n} viajes · neto {soles(rangos.mes.neto)}
          </p>
        </div>
      </div>

      {(rangos.hoy.gastado > 0 || rangos.semana.gastado > 0) && (
        <p className="mt-2 text-[10px] text-slate-500">
          💸 Gastos anotados: hoy {soles(rangos.hoy.gastado)} · semana {soles(rangos.semana.gastado)} · mes{' '}
          {soles(rangos.mes.gastado)}
        </p>
      )}
    </div>
  );
}
