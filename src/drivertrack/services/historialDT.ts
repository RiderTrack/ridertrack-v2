// ═══════════════════════════════════════════════════════════
// 📜 FASE T: Historial de DriverTrack — NÚCLEO PURO
// ═══════════════════════════════════════════════════════════
// Pedido de Rudy: "driver track no tiene su historial — cuántos
// viajes hice el día anterior, cuánto hice ayer y antes de ayer,
// igualito que rider track, para tener control de mi dinero
// también de libre".
//
// Los viajes (dt_viajes_v1) y los gastos (dt_gastos_v1) YA se
// guardan todos con su fecha — nunca se borran cuando empieza un
// día nuevo. Lo que faltaba era VERLOS: este núcleo arma un
// renglón por día (viajes · bruto · neto · gastos · en mano) y
// los resúmenes por período (7 días / 30 días / todo).
//
// 100% puro (sin Firebase, sin React) → testeable con Node,
// mismo patrón que cajaCore/pagoPedidosCore.
// ═══════════════════════════════════════════════════════════
import { Gasto, OrigenViaje, Viaje } from '../types';

/** Un día del historial: todo lo que se movió ese día */
export interface DiaHistorial {
  fecha: string; // YYYY-MM-DD
  n: number; // cuántos viajes
  bruto: number; // S/ tarifa total
  comision: number; // S/ comisión total
  neto: number; // S/ neto del día
  gastos: number; // S/ gastos del día (recargas, gasolina…)
  enMano: number; // neto − gastos (lo que queda REAL)
  porOrigen: Partial<Record<OrigenViaje, { n: number; neto: number }>>;
  /** día con gastos pero SIN viajes (igual cuenta para el dinero) */
  soloGastos: boolean;
}

/** Fecha YYYY-MM-DD ± N días (hora local — mismo formato que Viaje.fecha) */
export function moverDia(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Todos los días con movimiento (viajes O gastos), del más nuevo
 * al más viejo. Los números salen de lo que ya vive en el
 * teléfono — nada nuevo que guardar ni mantener.
 */
export function diasHistorial(viajes: Viaje[], gastos: Gasto[]): DiaHistorial[] {
  const fechas = new Set<string>();
  for (const v of viajes) if (v && v.fecha) fechas.add(v.fecha);
  for (const g of gastos) if (g && g.fecha) fechas.add(g.fecha);

  return [...fechas]
    .sort()
    .reverse()
    .map(fecha => {
      const delDia = viajes.filter(v => v.fecha === fecha);
      const gastosDia = gastos
        .filter(g => g.fecha === fecha)
        .reduce((s, g) => s + (Number(g.monto) || 0), 0);
      const porOrigen: DiaHistorial['porOrigen'] = {};
      for (const v of delDia) {
        const o = porOrigen[v.origen] ?? { n: 0, neto: 0 };
        o.n += 1;
        o.neto += v.neto;
        porOrigen[v.origen] = o;
      }
      // FASE AT: los pedidos CANCELADOS no generaron plata → no cuentan
      // en el bruto del día (la comisión que te cobró inDrive la lleva
      // el contador del saldo, no la Caja)
      const bruto = delDia.reduce((s, v) => s + (v.canceladoPor ? 0 : v.tarifa), 0);
      const comision = delDia.reduce((s, v) => s + v.comision, 0);
      const neto = delDia.reduce((s, v) => s + v.neto, 0);
      return {
        fecha,
        n: delDia.length,
        bruto: round2(bruto),
        comision: round2(comision),
        neto: round2(neto),
        gastos: round2(gastosDia),
        enMano: round2(neto - gastosDia),
        porOrigen,
        soloGastos: delDia.length === 0 && gastosDia > 0,
      };
    });
}

/** Resumen de un período de días */
export interface ResumenPeriodo {
  n: number; // viajes del período
  dias: number; // días CON viajes (los de solo gastos no cuentan)
  bruto: number;
  neto: number;
  gastos: number;
  enMano: number;
}

/**
 * Suma los últimos `cantidad` días (7 = hoy + 6 anteriores) o
 * TODO el historial si cantidad === 'todo'. `hoy` entra como
 * parámetro para que los tests no dependan de la fecha real.
 */
export function resumenPeriodo(
  dias: DiaHistorial[],
  hoy: string,
  cantidad: 7 | 30 | 'todo',
): ResumenPeriodo {
  const desde = cantidad === 'todo' ? null : moverDia(hoy, -(cantidad - 1));
  const dentro = dias.filter(d => !desde || d.fecha >= desde);
  const conViajes = dentro.filter(d => d.n > 0);
  return {
    n: dentro.reduce((s, d) => s + d.n, 0),
    dias: conViajes.length,
    bruto: round2(dentro.reduce((s, d) => s + d.bruto, 0)),
    neto: round2(dentro.reduce((s, d) => s + d.neto, 0)),
    gastos: round2(dentro.reduce((s, d) => s + d.gastos, 0)),
    enMano: round2(dentro.reduce((s, d) => s + d.enMano, 0)),
  };
}

const DIAS_TXT = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_TXT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

/** "jueves 9 oct" — local y pura (la de storage.ts pesa Firebase) */
export function fechaBonitaDT(f: string): string {
  const [y, m, d] = f.split('-').map(Number);
  if (!y || !m || !d) return f;
  const dt = new Date(y, m - 1, d);
  return `${DIAS_TXT[dt.getDay()]} ${d} ${MESES_TXT[m - 1]}`;
}

/** "Hoy" · "Ayer" · "Anteayer" · "jueves 9 oct" — para el renglón del día */
export function etiquetaDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === moverDia(hoy, -1)) return 'Ayer';
  if (fecha === moverDia(hoy, -2)) return 'Anteayer';
  return fechaBonitaDT(fecha);
}
