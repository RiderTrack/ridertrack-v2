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

// ═══ FASE AS: recarga FLEXIBLE — cualquier monto (diario también) ═══

/**
 * FASE AS: número de días → texto listo para la UI.
 *   7.0 → '~7 días' · 1.7 → '~1 día y medio' · 1.0 → '~1 día'
 *   0.5 → 'menos de 1 día' · sin datos → '—'
 */
export function textoDias(dias: number): string {
  if (!(dias > 0)) return '—';
  if (dias >= 1.8) return `~${Math.round(dias)} días`;
  if (dias >= 1.3) return '~1 día y medio';
  if (dias >= 0.9) return '~1 día';
  return 'menos de 1 día';
}

export interface CalculoDuracion {
  /** Comisión por día según tu ritmo (meta × %). */
  comisionDia: number;
  /** Días que te dura el monto (0 = no estimable). */
  dias: number;
  /** Texto listo para mostrar: '~3 días', '~1 día y medio'… */
  diasTexto: string;
  /** false = falta meta o % (todavía no hay ritmo para estimar). */
  estimable: boolean;
}

/**
 * FASE AS: la INVERSA de la calculadora — «hoy recargué 15, ¿cuánto
 * me va a durar?» → monto ÷ comisión por día (meta × %).
 *   Ej: 15 soles con 60 diarios × 15% → comisión 9/día → 1.7 días.
 */
export function calcularDuracion(monto: number, metaDiaria: number, pct: number): CalculoDuracion {
  const m = Math.max(0, monto || 0);
  const meta = Math.max(0, metaDiaria || 0);
  const p = Math.min(Math.max(0, pct || 0), 100);
  const comisionDia = +(meta * (p / 100)).toFixed(2);
  const estimable = m > 0 && comisionDia > 0;
  const dias = estimable ? +(m / comisionDia).toFixed(1) : 0;
  return { comisionDia, dias, diasTexto: estimable ? textoDias(dias) : '—', estimable };
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
 * FASE AT: los pedidos CANCELADOS (te lo cancelaron / lo cancelaste)
 * también entran — inDrive igual te cobró esa comisión del saldo
 * (la tarifa del viaje queda guardada como referencia del pedido).
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
  /** Comisión consumida por tus viajes desde la recarga
   *  (FASE AT: cancelados incluidos — inDrive los cobra igual). */
  usado: number;
  /** Lo que le queda a la recarga (puede ser negativo = te pasaste). */
  saldo: number;
  /** 0..1 cuánto consumiste de la recarga. */
  pctUsado: number;
  /** true = queda menos del 15% → avisar que recargue. */
  casiAgotada: boolean;
  /** FASE AS: ~cuántos días de trabajo le quedan al saldo al ritmo
   *  configurado (saldo ÷ comisión por día). null = sin ritmo para
   *  estimar (falta meta o %) · 0 = ya no queda nada. */
  diasRestantes: number | null;
  /** FASE AT: ✏️ la corrección manual guardada al sincronizar el
   *  contador con el saldo REAL de tu inDrive (S/, firmada). */
  ajuste: number;
  /** FASE AT: true = el contador fue sincronizado a mano (muestra ✏️). */
  ajustado: boolean;
}

/** El estado del saldo de la recarga: usaste X de Y, te queda Z.
 * FASE AT: si sincronizaste el contador con tu inDrive real
 * («me queda 7.50 en la app»), recarga.ajuste guarda el delta y el
 * saldo sale clavado al aplicativo — los viajes nuevos siguen
 * descontando desde ahí. */
export function estadoSaldo(viajes: Viaje[], recarga: RecargaSemanal): EstadoSaldo | null {
  if (!recarga.monto || recarga.monto <= 0 || !recarga.fecha) return null;
  const usado = comisionAcumulada(viajes, recarga.pct, recarga.fecha);
  const ajuste = +(recarga.ajuste ?? 0); // FASE AT: corrección manual
  const saldo = +(recarga.monto - usado + ajuste).toFixed(2);
  const pctUsado = Math.min(
    1,
    Math.max(0, recarga.monto > 0 ? (recarga.monto - saldo) / recarga.monto : 0),
  );
  // FASE AS: días que le quedan al saldo — solo si configuraste ritmo
  const comisionDia = calcularDuracion(recarga.monto, recarga.metaDiaria, recarga.pct).comisionDia;
  const diasRestantes = comisionDia > 0 ? +(Math.max(0, saldo) / comisionDia).toFixed(1) : null;
  return {
    monto: recarga.monto,
    usado,
    saldo,
    pctUsado,
    diasRestantes,
    ajuste,
    ajustado: ajuste !== 0, // FASE AT
    casiAgotada: saldo <= recarga.monto * 0.15,
  };
}

/**
 * 🩹 FIX AW (reporte de Rudy, 28-oct): el saldo que le quedaba de la
 * recarga ANTERIOR ya no se pierde al registrar una nueva — se acumula.
 *   Tenías S/3 de resto + recargás S/10 → la nueva arranca en S/13
 *   (antes la nueva PISABA a la vieja y quedabas en 10: el resto se esfumaba).
 * Si el resto era NEGATIVO (comisión gastada de más) también se acumula:
 * igual que inDrive, la recarga nueva primero cubre lo que le debés.
 * FASE AT: el resto respeta la corrección manual del contador (ajuste)
 * → la recarga nueva arranca clavada al saldo REAL que marcaba el contador.
 * Con pagado 0 sirve de "consultor": te devuelve solo el resto anterior.
 */
export function acumularRecarga(
  pagado: number,
  previa: RecargaSemanal | null | undefined,
  viajes: Viaje[],
): { montoFinal: number; resto: number } {
  const p = Math.max(0, pagado || 0);
  const est = previa && previa.monto > 0 && previa.fecha ? estadoSaldo(viajes, previa) : null;
  const resto = est ? est.saldo : 0;
  return { montoFinal: +(p + resto).toFixed(2), resto };
}
