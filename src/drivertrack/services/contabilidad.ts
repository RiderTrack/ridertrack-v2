// ═══════════════════════════════════════════════════════════
// 💰 FASE AC: CONTABILIDAD — ¿voy bien o voy bajo?
// Motor PURO de la sección Contabilidad (sin DOM ni Firebase,
// mismo patrón que stats.ts → fácil de testear).
//
// Las DOS fuentes de plata del rider:
//   · 🟢 Viajes LIBRES (DriverTrack): inDrive, Rappi, PedidosYa,
//     Directo → el NETO ya viene después de la comisión de la
//     plataforma (esa es tu plata).
//   · 🏢 EMPRESA (pago por pedido, 🛵 FASE D): el historial del
//     trabajo congela pagoPedidos.total de cada día (S/9 normal
//     + S/12 lejos); el día EN VIVO se suma desde la ruta activa.
//
// Semanas CONTABLES de LUNES a domingo (la peruana): Rudy
// trabaja lun–sáb y el domingo descansa — y si un domingo
// labura, cae en SU misma semana, no en la siguiente.
//
// Regla heredada de la Caja DT: los gastos (gasolina, comida,
// recarga de saldo…) se descuentan del total → "en mano" es
// lo que queda de verdad en el bolsillo.
// ═══════════════════════════════════════════════════════════

import { OrigenViaje, TipoGasto, Viaje, Gasto } from '../types';
import { sumarDias } from './stats';

// ── Fechas (ISO YYYY-MM-DD, hora local — igual que DT) ─────

/** Lunes de la semana a la que pertenece la fecha (semana peruana lun→dom) */
export function lunesDeISO(f: string): string {
  const [y, m, d] = f.split('-').map(Number);
  const dia = new Date(y, m - 1, d).getDay(); // 0=domingo … 6=sábado
  const offset = (dia + 6) % 7;               // lunes=0 … domingo=6
  return sumarDias(f, -offset);
}

export interface Rango { desde: string; hasta: string }

/** Semana contable (lun→dom) a la que pertenece la fecha */
export function rangoSemanaDe(f: string): Rango {
  const lunes = lunesDeISO(f);
  return { desde: lunes, hasta: sumarDias(lunes, 6) };
}

function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rangoMes(clave: string): Rango {
  const [y, m] = clave.split('-').map(Number);
  return { desde: `${clave}-01`, hasta: aISO(new Date(y, m, 0)) };
}

function mesAnterior(clave: string): string {
  const [y, m] = clave.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

// ── Plata de la EMPRESA desde el historial ─────────────────

/** Registro mínimo que necesita la contabilidad del historial
 *  (RegistroHistorial encaixa sin tocar nada). */
export interface RegistroEmpresaLike {
  fecha?: string;
  pagoPedidos?: { total?: number } | null;
}

/** Monto de EMPRESA por día (S/ de pago por pedido). Varias
 *  rutas el mismo día se ACUMULAN (dos vueltas = dos pagas).
 *  Los días de jornal (sin pagoPedidos) no suman — la paga fija
 *  nunca se guardó como número, no se inventa. */
export function empresaPorDiaDesdeRegistros(
  registros: RegistroEmpresaLike[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of registros) {
    const t = Number(r?.pagoPedidos?.total) || 0;
    if (t > 0 && r.fecha) m.set(r.fecha, (m.get(r.fecha) ?? 0) + t);
  }
  return m;
}

// ── Resúmenes por rango ────────────────────────────────────

export interface OrigenStat { origen: OrigenViaje; n: number; neto: number }
export interface GastoStat { tipo: TipoGasto; monto: number }

export interface ResumenContable {
  /** viajes LIBRES del rango (todas las plataformas) */
  n: number;
  /** plata de los viajes libres (neto, tras comisión) */
  netoLibre: number;
  /** desglose de los viajes libres por plataforma (mayor primero) */
  porOrigen: OrigenStat[];
  /** plata de la EMPRESA (pago por pedido) en el rango */
  empresa: number;
  /** días del rango con paga de empresa */
  diasEmpresa: number;
  /** netoLibre + empresa */
  total: number;
  /** gastos anotados (gasolina, comida…) */
  gastos: number;
  /** desglose de gastos (mayor primero) */
  gastosPorTipo: GastoStat[];
  /** total − gastos: lo que queda en el bolsillo */
  enMano: number;
}

export function resumenEntre(
  viajes: Viaje[],
  gastos: Gasto[],
  empresaPorDia: Map<string, number>,
  desde: string,
  hasta: string
): ResumenContable {
  const vs = viajes.filter(v => v.fecha >= desde && v.fecha <= hasta);
  const gs = gastos.filter(g => g.fecha >= desde && g.fecha <= hasta);
  const netoLibre = vs.reduce((s, v) => s + v.neto, 0);

  const porOrigen = new Map<OrigenViaje, { n: number; neto: number }>();
  for (const v of vs) {
    const a = porOrigen.get(v.origen) ?? { n: 0, neto: 0 };
    a.n++;
    a.neto += v.neto;
    porOrigen.set(v.origen, a);
  }

  const gastosPorTipo = new Map<TipoGasto, number>();
  for (const g of gs) gastosPorTipo.set(g.tipo, (gastosPorTipo.get(g.tipo) ?? 0) + g.monto);
  const totalGastos = gs.reduce((s, g) => s + g.monto, 0);

  let empresa = 0;
  let diasEmpresa = 0;
  for (const [f, monto] of empresaPorDia) {
    if (monto > 0 && f >= desde && f <= hasta) {
      empresa += monto;
      diasEmpresa++;
    }
  }

  return {
    n: vs.length,
    netoLibre,
    porOrigen: [...porOrigen.entries()]
      .sort((a, b) => b[1].neto - a[1].neto)
      .map(([origen, x]) => ({ origen, ...x })),
    empresa,
    diasEmpresa,
    total: netoLibre + empresa,
    gastos: totalGastos,
    gastosPorTipo: [...gastosPorTipo.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tipo, monto]) => ({ tipo, monto })),
    enMano: netoLibre + empresa - totalGastos,
  };
}

// ── Semanas contables (la de Rudy: lun–sáb + dom por si labura) ──

export interface SemanaContable extends ResumenContable {
  desde: string;   // lunes
  hasta: string;   // domingo — o HOY si es la semana en curso
  esActual: boolean;
}

/** Las últimas n semanas contables, la ACTUAL primero.
 *  La actual solo cuenta hasta hoy (lo que no llegó, no llegó);
 *  las pasadas van completas (lun→dom). */
export function semanasContables(
  viajes: Viaje[],
  gastos: Gasto[],
  empresaPorDia: Map<string, number>,
  hoy: string,
  n = 6
): SemanaContable[] {
  const out: SemanaContable[] = [];
  let lunes = lunesDeISO(hoy);
  for (let i = 0; i < n; i++) {
    const hasta = i === 0 ? hoy : sumarDias(lunes, 6);
    out.push({
      desde: lunes,
      hasta,
      esActual: i === 0,
      ...resumenEntre(viajes, gastos, empresaPorDia, lunes, hasta),
    });
    lunes = sumarDias(lunes, -7);
  }
  return out;
}

// ── Mes calendario ─────────────────────────────────────────

export interface MesContable {
  claveActual: string;       // YYYY-MM
  claveAnterior: string;
  actual: ResumenContable;   // del 1º hasta HOY
  anterior: ResumenContable; // mes anterior completo
  /** null = mes anterior sin plata (no se puede comparar) */
  diffPct: number | null;
}

export function resumenMes(
  viajes: Viaje[],
  gastos: Gasto[],
  empresaPorDia: Map<string, number>,
  hoy: string
): MesContable {
  const claveActual = hoy.slice(0, 7);
  const claveAnterior = mesAnterior(claveActual);
  const rA = rangoMes(claveActual);
  const rB = rangoMes(claveAnterior);
  const actual = resumenEntre(viajes, gastos, empresaPorDia, rA.desde, hoy < rA.hasta ? hoy : rA.hasta);
  const anterior = resumenEntre(viajes, gastos, empresaPorDia, rB.desde, rB.hasta);
  const diffPct = anterior.total > 0 ? ((actual.total - anterior.total) / anterior.total) * 100 : null;
  return { claveActual, claveAnterior, actual, anterior, diffPct };
}

// ── Barritas día por día de la semana actual ───────────────

export interface DiaBarra {
  fecha: string;
  netoLibre: number;
  empresa: number;
  total: number;
  /** todavía no llegó (se pinta apagado) */
  futuro: boolean;
}

/** Las 7 fechas lun→dom de la semana actual */
export function diasSemanaActual(hoy: string): string[] {
  const lunes = lunesDeISO(hoy);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

export function netoPorDia(
  viajes: Viaje[],
  empresaPorDia: Map<string, number>,
  dias: string[],
  hoy: string
): DiaBarra[] {
  return dias.map(f => {
    const netoLibre = viajes
      .filter(v => v.fecha === f)
      .reduce((s, v) => s + v.neto, 0);
    const empresa = empresaPorDia.get(f) ?? 0;
    return { fecha: f, netoLibre, empresa, total: netoLibre + empresa, futuro: f > hoy };
  });
}

// ── Meta y ritmo ("¿voy bien o voy bajo?") ─────────────────

/** Meta de la SEMANA: la diaria × 6 días trabajados (lun–sáb) */
export function metaSemanal(metaDiaria: number): number {
  return Math.max(0, metaDiaria) * 6;
}

/** Ritmo esperado A HOY: meta diaria × días ya transcurridos
 *  de la semana (lun..hoy, máximo 6 — el domingo es descanso).
 *  Si llevás MENOS que esto → "voy bajo"; más → "voy bien". */
export function ritmoAlDia(metaDiaria: number, hoy: string): number {
  const lunes = lunesDeISO(hoy);
  let dias = 0;
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(lunes, i);
    if (f > hoy) break;
    dias++;
  }
  return Math.max(0, metaDiaria) * Math.min(dias, 6);
}

// ── Etiquetas para los chips de método ─────────────────────

export const ETIQUETA_METODO: Record<OrigenViaje, string> = {
  indrive: 'inDrive',
  rappi: 'Rappi',
  pedidosya: 'PedidosYa',
  directo: 'Directo',
};
