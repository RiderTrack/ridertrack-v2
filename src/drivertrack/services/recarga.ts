// ═══════════════════════════════════════════════════════════
// 🎯 FASE F: Recarga semanal — lógica PURA (sin React, sin storage)
// ═══════════════════════════════════════════════════════════
// La idea de Rudy: en inDrive el cliente le paga DIRECTO (efectivo/
// yape) y la comisión sale del SALDO inDrive que hay que recargar.
// Recargando una sola vez por semana el monto calculado, la app ya
// NO descuenta el % en cada carrera: la tarifa completa es ganancia.
//
//   "quiero hacer 60 diarios que me lo calcule con el porcentaje
//    cuánto debería recargar para la semana"        — Rudy, FASE F
//
// Este archivo es 100% testeable (mismo patrón que pagoPedidosCore):
// la UI de Ajustes arma los números y la Caja/el shell muestran el
// saldo con las funciones de acá.
// ═══════════════════════════════════════════════════════════

import { RecargaSemanal, Viaje } from '../types';

export interface CalculoRecarga {
  /** Comisión que inDrive te va debitando por día (meta × %). */
  comisionDia: number;
  /** Lo que vas a facturar en la semana (meta × días). */
  brutoSemana: number;
  /** ⭐ Lo que tenés que RECARGAR una sola vez para cubrir la semana. */
  recargaSugerida: number;
  /** Lo que queda en el bolsillo la semana (bruto − recarga). */
  bolsilloReal: number;
}

/**
 * El corazón de la calculadora: meta diaria + % de comisión + días
 * → cuánto recargar para TODA la semana.
 *   Ej: 60 diarios × 15% × 7 días → comisión 9/día → recarga S/63.
 */
export function calcularRecarga(metaDiaria: number, pct: number, dias: number): CalculoRecarga {
  const meta = Math.max(0, metaDiaria || 0);
  const p = Math.min(Math.max(0, pct || 0), 100);
  const d = dias >= 1 && dias <= 7 ? Math.round(dias) : 7;
  const comisionDia = +(meta * (p / 100)).toFixed(2);
  const brutoSemana = +(meta * d).toFixed(2);
  const recargaSugerida = +(comisionDia * d).toFixed(2);
  const bolsilloReal = +(brutoSemana - recargaSugerida).toFixed(2);
  return { comisionDia, brutoSemana, recargaSugerida, bolsilloReal };
}

/**
 * Clave de orden de un viaje para comparar contra la fecha de la
 * recarga: 'YYYY-MM-DD HH:MM' — comparación de strings directa
 * (misma zona horaria Lima, sin vueltas con Date parse).
 */
export function claveOrdenViaje(v: { fecha: string; hora: string }): string {
  const [h = '00', m = '00'] = (v.hora || '00:00').split(':');
  return `${v.fecha} ${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/**
 * Cuánta comisión acumuló inDrive desde la última recarga: suma el
 * % sobre la tarifa de cada viaje INDRIVE posterior a la fecha de la
 * recarga (los viajes guardados con el modo activo traen comisión 0,
 * así que se recalcula acá con el % configurado).
 */
export function comisionAcumulada(viajes: Viaje[], pct: number, desdeFecha: string): number {
  const p = Math.min(Math.max(0, pct || 0), 100);
  if (!desdeFecha || p <= 0) return 0;
  const total = viajes
    .filter(v => v.origen === 'indrive')
    .filter(v => claveOrdenViaje(v) > desdeFecha)
    .reduce((s, v) => s + v.tarifa * (p / 100), 0);
  return +total.toFixed(2);
}

export interface EstadoSaldo {
  /** Recarga registrada (S/). */
  monto: number;
  /** Comisión consumida por tus viajes desde la recarga. */
  usado: number;
  /** Lo que le queda a la recarga (puede ser negativo = te pasaste). */
  saldo: number;
  /** 0..1 cuánto consumiste de la recarga. */
  pctUsado: number;
  /** true = queda menos del 15% → avisar que recargue. */
  casiAgotada: boolean;
}

/** El estado del saldo de la recarga: usaste X de Y, te queda Z. */
export function estadoSaldo(viajes: Viaje[], recarga: RecargaSemanal): EstadoSaldo | null {
  if (!recarga.monto || recarga.monto <= 0 || !recarga.fecha) return null;
  const usado = comisionAcumulada(viajes, recarga.pct, recarga.fecha);
  const saldo = +(recarga.monto - usado).toFixed(2);
  const pctUsado = Math.min(1, recarga.monto > 0 ? usado / recarga.monto : 0);
  return {
    monto: recarga.monto,
    usado,
    saldo,
    pctUsado,
    casiAgotada: saldo <= recarga.monto * 0.15,
  };
}
