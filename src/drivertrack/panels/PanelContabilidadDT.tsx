// ═══════════════════════════════════════════════════════════
// 💰 FASE AC: Panel de CONTABILIDAD — ¿voy bien o voy bajo?
// Sección propia del menú (Análisis). Junta las DOS fuentes de
// plata del rider en una sola pantalla:
//   · 🟢 Viajes libres (inDrive y otros) → DriverTrack local
//   · 🏢 Empresa (pago por pedido S/9/S/12) → historial del
//     trabajo (Firestore) + la ruta VIVA de hoy
// y les descuenta los gastos de la Caja (gasolina, comida…)
// → "en mano" de verdad. Semanas de lunes a domingo, meta del
// día y de la semana, comparación semana a semana y mes a mes.
// Refresca sola con los cambios (mismo patrón que PanelStatsDT).
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import {
  Target,
  Home,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  Wallet,
} from 'lucide-react';
import { useTema } from '../../theme/useTema';
import { useAuth } from '../../hooks/useAuth';
import { useClientes } from '../../hooks/useClientes';
import { Viaje, Gasto, ConfigDT, nombreGasto, emojiGasto, ORIGENES } from '../types';
import { cargarViajes, cargarGastos, cargarConfig, fechaBonita } from '../storage';
import { fmtSoles } from '../utils';
import { leerHistorial, RegistroHistorial } from '../../services/firestore';
import { calcularPagoPedidos, cargarConfigPagoPedidos } from '../../utils/pagoPedidosCore';
import {
  ResumenContable,
  SemanaContable,
  empresaPorDiaDesdeRegistros,
  resumenEntre,
  semanasContables,
  resumenMes,
  diasSemanaActual,
  netoPorDia,
  metaSemanal,
  ritmoAlDia,
  ETIQUETA_METODO,
} from '../services/contabilidad';

const LETRAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

/** "2026-10-12" → "12 oct" */
function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES_CORTOS[(m || 1) - 1]}`;
}

/** "2026-10" → "octubre 2026" */
function mesLargo(clave: string): string {
  const [y, m] = clave.split('-').map(Number);
  return `${MESES_LARGOS[(m || 1) - 1]} ${y}`;
}

function flechaSemana(pct: number | null) {
  if (pct === null) return { Icon: Minus, color: 'text-slate-500', txt: 'sin datos' };
  if (pct > 0.5) return { Icon: TrendingUp, color: 'text-emerald-400', txt: `▲ ${pct.toFixed(0)}%` };
  if (pct < -0.5) return { Icon: TrendingDown, color: 'text-red-400', txt: `▼ ${Math.abs(pct).toFixed(0)}%` };
  return { Icon: Minus, color: 'text-slate-400', txt: 'igual' };
}

export default function PanelContabilidadDT() {
  const [viajes, setViajes] = useState<Viaje[]>(() => cargarViajes());
  const [gastos, setGastos] = useState<Gasto[]>(() => cargarGastos());
  const [config, setConfig] = useState<ConfigDT>(() => cargarConfig());
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const { clientes } = useClientes();
  const { user } = useAuth();
  const { modoEfectivo } = useTema();
  const temaClaro = modoEfectivo === 'light';

  const hoy = fechaHoy_panel();
  const meta = config.metaDiaria || 0;

  // ── Historial de la EMPRESA (pago por pedido, Firestore) ──
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setCargandoHistorial(false);
      return;
    }
    let vivo = true;
    setCargandoHistorial(true);
    leerHistorial(uid, 200)
      .then(regs => { if (vivo) setRegistros(regs); })
      .catch(() => { if (vivo) setRegistros([]); })
      .finally(() => { if (vivo) setCargandoHistorial(false); });
    return () => { vivo = false; };
  }, [user?.uid]);

  // ── Refresco: cambios locales/nube (patrón de los paneles DT) ──
  useEffect(() => {
    const alSync = () => {
      setViajes(cargarViajes());
      setGastos(cargarGastos());
      setConfig(cargarConfig());
    };
    window.addEventListener('dt:sync-remoto', alSync);
    return () => window.removeEventListener('dt:sync-remoto', alSync);
  }, []);

  // ── Paga VIVA de hoy (la ruta del trabajo que aún no se cierra) ──
  const pagoVivoHoy = useMemo(() => {
    try {
      const cfg = cargarConfigPagoPedidos();
      return calcularPagoPedidos(clientes, cfg);
    } catch {
      return { cantidadNormal: 0, cantidadLejos: 0, entregados: 0, montoNormal: 0, montoLejos: 0, total: 0 };
    }
  }, [clientes]);

  // ── Plata de empresa por día (historial + hoy vivo) ──
  const empresaPorDia = useMemo(() => {
    const m = empresaPorDiaDesdeRegistros(registros);
    if (pagoVivoHoy.total > 0) {
      m.set(hoy, (m.get(hoy) ?? 0) + pagoVivoHoy.total);
    }
    return m;
  }, [registros, pagoVivoHoy.total, hoy]);

  const resHoy = useMemo(
    () => resumenEntre(viajes, gastos, empresaPorDia, hoy, hoy),
    [viajes, gastos, empresaPorDia, hoy]
  );
  const semanas = useMemo(
    () => semanasContables(viajes, gastos, empresaPorDia, hoy, 6),
    [viajes, gastos, empresaPorDia, hoy]
  );
  const semana = semanas[0];
  const barras = useMemo(
    () => netoPorDia(viajes, empresaPorDia, diasSemanaActual(hoy), hoy),
    [viajes, empresaPorDia, hoy]
  );
  const mes = useMemo(
    () => resumenMes(viajes, gastos, empresaPorDia, hoy),
    [viajes, gastos, empresaPorDia, hoy]
  );

  const metaSem = metaSemanal(meta);
  const ritmo = ritmoAlDia(meta, hoy);
  const maxBarra = Math.max(1, ...barras.map(b => b.total));
  const maxSemana = Math.max(1, ...semanas.map(s => s.total));
  const cumplidaHoy = meta > 0 && resHoy.total >= meta;
  const cumplidaSem = meta > 0 && semana.total >= metaSem;
  const voyBien = meta > 0 && ritmo > 0 && semana.total >= ritmo;

  return (
    <div
      className={`dt-app ${temaClaro ? 'light' : ''} w-full space-y-3 text-slate-200`}
      data-testid="panel-contabilidad"
    >
      {/* ── Título de la sección ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
            <Wallet size={18} />
          </span>
          <div>
            <p className="text-sm font-black text-slate-100">Contabilidad</p>
            <p className="text-[11px] text-slate-500">¿voy bien o voy bajo? — {fechaBonita(hoy)}</p>
          </div>
        </div>
        {cargandoHistorial && (
          <span className="text-[10px] text-slate-500" data-testid="cont-cargando">cargando empresa…</span>
        )}
      </div>

      {/* ════ 1️⃣ HOY ════ */}
      <section
        className={`rounded-2xl border p-4 transition-colors ${
          cumplidaHoy
            ? 'border-emerald-400/60 bg-emerald-500/10'
            : 'border-slate-700 bg-slate-800/60'
        }`}
        data-testid="cont-hoy"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {cumplidaHoy ? (
              <Home size={18} className="shrink-0 text-emerald-400" />
            ) : (
              <Target size={18} className="shrink-0 text-amber-400" />
            )}
            <p className="text-sm font-bold text-slate-200">
              {cumplidaHoy ? '¡META CUMPLIDA HOY! 🎉' : 'Hoy'}
            </p>
          </div>
          {meta > 0 && !cumplidaHoy && (
            <p className="text-[11px] text-slate-500">
              de <span className="font-bold tabular-nums text-slate-400" data-testid="cont-hoy-meta">{fmtSoles(meta)}</span>
            </p>
          )}
        </div>

        <p className="mt-1.5 text-3xl font-black tabular-nums text-emerald-300" data-testid="cont-hoy-total">
          {fmtSoles(resHoy.total)}
        </p>
        {meta > 0 && (
          <>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-700/80">
              <div
                className={`h-full rounded-full ${cumplidaHoy ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 'bg-gradient-to-r from-amber-500 to-amber-300'}`}
                style={{ width: `${Math.min(100, (resHoy.total / meta) * 100)}%` }}
              />
            </div>
            {!cumplidaHoy && (
              <p className="mt-1.5 text-xs text-slate-400" data-testid="cont-hoy-falta">
                Faltan <span className="font-bold tabular-nums text-amber-300">{fmtSoles(meta - resHoy.total)}</span> para la meta
              </p>
            )}
          </>
        )}
        {meta <= 0 && (
          <p className="mt-1.5 text-[11px] text-slate-500">
            Poné tu meta del día en Ajustes de inDrive (ej: S/ 150) y acá te aviso si vas bien o bajo
          </p>
        )}

        {/* Por método */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {resHoy.porOrigen.map(o => (
            <ChipMetodo key={o.origen} testid={`cont-chip-${o.origen}`} origen={o.origen} monto={o.neto} />
          ))}
          {resHoy.empresa > 0 && (
            <span
              className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-300"
              data-testid="cont-chip-empresa"
            >
              🏢 Empresa {fmtSoles(resHoy.empresa)}
            </span>
          )}
          {resHoy.total === 0 && (
            <span className="text-[11px] text-slate-500">todavía no hay plata hoy</span>
          )}
        </div>

        {/* Gastos de hoy */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-700/60 pt-3">
          <span className="text-[11px] text-slate-400">Gastos hoy:</span>
          {resHoy.gastosPorTipo.length > 0 ? (
            resHoy.gastosPorTipo.map(g => (
              <span key={g.tipo} className="rounded-full bg-slate-700/50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-300">
                {emojiGasto(g.tipo)} {nombreGasto(g.tipo)} {fmtSoles(g.monto)}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-slate-500">sin gastos anotados</span>
          )}
          <span className="ml-auto text-[11px] text-slate-400">
            En mano: <b className="tabular-nums text-emerald-300" data-testid="cont-hoy-enmano">{fmtSoles(resHoy.enMano)}</b>
          </span>
        </div>
        {pagoVivoHoy.total > 0 && (
          <p className="mt-1.5 text-[10px] text-sky-400/80">
            incluye {fmtSoles(pagoVivoHoy.total)} de la ruta de hoy en vivo ({pagoVivoHoy.entregados} pedidos)
          </p>
        )}
      </section>

      {/* ════ 2️⃣ ESTA SEMANA (lun–sáb) ════ */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4" data-testid="cont-semana">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-slate-400" />
            <p className="text-sm font-bold text-slate-200">
              Esta semana <span className="text-[11px] font-normal text-slate-500">{fechaCorta(semana.desde)} – {fechaCorta(semana.hasta)}</span>
            </p>
          </div>
          {meta > 0 && (
            <p className="text-[11px] text-slate-500">
              de <span className="font-bold tabular-nums text-slate-400" data-testid="cont-semana-meta">{fmtSoles(metaSem)}</span>
              <span className="text-slate-600"> (meta × 6)</span>
            </p>
          )}
        </div>

        <p className="mt-1.5 text-2xl font-black tabular-nums text-emerald-300" data-testid="cont-semana-total">
          {fmtSoles(semana.total)}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {semana.n} viaje{semana.n === 1 ? '' : 's'} libre{semana.n === 1 ? '' : 's'}
          {semana.diasEmpresa > 0 && ` + ${semana.diasEmpresa} día${semana.diasEmpresa === 1 ? '' : 's'} de empresa`}
        </p>

        {meta > 0 && (
          <>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-700/80">
              <div
                className={`h-full rounded-full ${cumplidaSem ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 'bg-gradient-to-r from-sky-500 to-sky-400'}`}
                style={{ width: `${Math.min(100, (semana.total / metaSem) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs font-bold" data-testid="cont-semana-ritmo">
              {cumplidaSem ? (
                <span className="text-emerald-300">¡META SEMANAL CUMPLIDA! 🔥 Sos libre el resto de la semana</span>
              ) : voyBien ? (
                <span className="text-emerald-400/90">🟢 Vas bien — llevás {fmtSoles(semana.total)} de {fmtSoles(ritmo)} esperados a hoy</span>
              ) : (
                <span className="text-amber-300">🟡 Vas bajo — al ritmo de hoy deberías llevar {fmtSoles(ritmo)}</span>
              )}
            </p>
          </>
        )}

        {/* Barritas día por día: verde = libre, celeste = empresa */}
        <div className="mt-4 flex items-end gap-1.5" data-testid="cont-barras">
          {barras.map((b, i) => {
            const pct = b.total > 0 ? (b.total / maxBarra) * 100 : 0;
            const pctEmp = b.total > 0 ? (b.empresa / b.total) * 100 : 0;
            return (
              <div key={b.fecha} className="flex flex-1 flex-col items-center gap-1">
                <span className="h-3.5 text-[9px] font-bold tabular-nums text-slate-400">
                  {b.total > 0 ? Math.round(b.total) : ''}
                </span>
                <div className="flex h-20 w-full flex-col justify-end overflow-hidden rounded-t-md bg-slate-700/25">
                  {b.futuro ? (
                    <div className="h-1 w-full border-t border-dashed border-slate-600/80" />
                  ) : b.total > 0 ? (
                    <div className="flex w-full flex-col" style={{ height: `${pct}%` }}>
                      <div className="w-full bg-sky-400/70" style={{ height: `${pctEmp}%` }} title="Empresa" />
                      <div className="w-full flex-1 bg-emerald-500" title="inDrive / libre" />
                    </div>
                  ) : (
                    <div className="h-1 w-full bg-slate-700/60" />
                  )}
                </div>
                <span
                  className={`text-[9px] font-black ${
                    b.fecha === hoy ? 'text-amber-300' : b.futuro ? 'text-slate-600' : 'text-slate-500'
                  }`}
                >
                  {LETRAS_SEMANA[i]}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-center text-[10px] text-slate-600">
          <span className="mr-2"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500" />libre</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-400/70" />empresa</span>
        </p>

        {/* Métodos y gastos de la semana */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {semana.porOrigen.map(o => (
            <ChipMetodo key={o.origen} testid={`cont-semana-chip-${o.origen}`} origen={o.origen} monto={o.neto} />
          ))}
          {semana.empresa > 0 && (
            <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-300">
              🏢 Empresa {fmtSoles(semana.empresa)}
            </span>
          )}
          {semana.total === 0 && (
            <span className="text-[11px] text-slate-500">todavía no hay plata esta semana</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-700/60 pt-2.5">
          <span className="text-[11px] text-slate-400">
            Gastos: <b className="tabular-nums text-slate-300">{fmtSoles(semana.gastos)}</b>
          </span>
          <span className="ml-auto text-[11px] text-slate-400">
            En mano: <b className="tabular-nums text-emerald-300" data-testid="cont-semana-enmano">{fmtSoles(semana.enMano)}</b>
          </span>
        </div>
      </section>

      {/* ════ 3️⃣ SEMANAS ANTERIORES ════ */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4" data-testid="cont-semanas">
        <p className="text-sm font-bold text-slate-200">Semanas — ¿cuánto ligué cada una?</p>
        <div className="mt-3 space-y-2" data-testid="cont-semanas-list">
          {semanas.map((s, i) => {
            const previa = semanas[i + 1];
            const diff = previa && previa.total > 0 ? ((s.total - previa.total) / previa.total) * 100 : null;
            const f = flechaSemana(diff);
            const Icon = f.Icon;
            return (
              <div
                key={s.desde}
                className={`rounded-xl border px-3 py-2.5 ${
                  s.esActual ? 'border-emerald-500/50 bg-emerald-500/[0.07]' : 'border-slate-700/60 bg-slate-800/40'
                }`}
                data-testid="cont-semana-fila"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-300">
                    {s.esActual && <span className="mr-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">ESTA</span>}
                    {fechaCorta(s.desde)} – {fechaCorta(s.hasta)}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-0.5 text-[11px] font-bold ${f.color}`}>
                      <Icon size={12} /> {f.txt}
                    </span>
                    <span className="text-sm font-black tabular-nums text-slate-100">{fmtSoles(s.total)}</span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-700/60">
                  <div
                    className={`h-full rounded-full ${s.esActual ? 'bg-emerald-400/80' : 'bg-slate-500/70'}`}
                    style={{ width: `${Math.min(100, (s.total / maxSemana) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {s.n} libre{s.n === 1 ? '' : 's'}{s.diasEmpresa > 0 && ` + ${s.diasEmpresa} empresa`} · gastos {fmtSoles(s.gastos)} · en mano <b className="tabular-nums text-slate-400">{fmtSoles(s.enMano)}</b>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ════ 4️⃣ DEL MES ════ */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4" data-testid="cont-mes">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <p className="text-sm font-bold text-slate-200 capitalize">{mesLargo(mes.claveActual)}</p>
          </div>
          {mes.diffPct !== null && (
            <span className={`text-[11px] font-bold ${flechaSemana(mes.diffPct).color}`}>
              {flechaSemana(mes.diffPct).txt} <span className="font-normal text-slate-500">vs {mesLargo(mes.claveAnterior).split(' ')[0]}</span>
            </span>
          )}
        </div>
        <p className="mt-1.5 text-2xl font-black tabular-nums text-emerald-300" data-testid="cont-mes-total">
          {fmtSoles(mes.actual.total)}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {mes.actual.n} viaje{mes.actual.n === 1 ? '' : 's'} libre{mes.actual.n === 1 ? '' : 's'}
          {mes.actual.diasEmpresa > 0 && ` + ${mes.actual.diasEmpresa} día${mes.actual.diasEmpresa === 1 ? '' : 's'} de empresa`}
          {' '}· gastos {fmtSoles(mes.actual.gastos)} · en mano <b className="tabular-nums text-slate-400">{fmtSoles(mes.actual.enMano)}</b>
        </p>
        {mes.anterior.total > 0 && (
          <p className="mt-1 text-[11px] text-slate-500 capitalize" data-testid="cont-mes-anterior">
            {mesLargo(mes.claveAnterior)}: {fmtSoles(mes.anterior.total)}
          </p>
        )}
      </section>

      {/* Nota al pie */}
      <p className="pb-2 text-center text-[10px] leading-relaxed text-slate-600">
        Libre = tus viajes inDrive/Rappi/PedidosYa/Directo (neto, tras comisión) · Empresa = pago por pedido del
        trabajo (S/9/S/12, los días de jornal no suman) · Gastos = la Caja de inDrive (gasolina, comida, recargas) ·
        Meta editable en Ajustes de inDrive
      </p>
    </div>
  );
}

/** Chip de método para los desgloses (🟢 inDrive · 🔵 Directo…) */
const ChipMetodo: React.FC<{ origen: Viaje['origen']; monto: number; testid: string }> = ({ origen, monto, testid }) => {
  const def = ORIGENES.find(o => o.id === origen);
  return (
    <span
      className="rounded-full bg-slate-700/50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-300"
      data-testid={testid}
    >
      {def?.emoji ?? '•'} {ETIQUETA_METODO[origen] ?? def?.nombre ?? origen} {fmtSoles(monto)}
    </span>
  );
}

/** HOY del panel — fecha local del dispositivo (la misma con la
 *  que el DT guarda los viajes; en el cel de Rudy = Lima). */
function fechaHoy_panel(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
