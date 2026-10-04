// ═══════════════════════════════════════════════════════════
// 📊 RESUMEN DIARIO CORE — RiderTrack V2 (Fase 3.41 · paso 5)
// Resumen COMPLETO del día para mandarlo por WhatsApp al grupo
// MATE (lo envía el bot con la acción enviar_grupo_mate, igual
// que el cierre de caja de la F3.39).
//
// Núcleo PURO de cálculo, sin Firebase ni React (mismo patrón
// que odometroCore / mantenimientoCore / cajaCore) → se testea
// con Node directamente. La plata NO se recalcula aquí: se
// reusa resumenCajaDia de cajaCore (una sola fuente de verdad).
//
// El resumen junta TODO lo que la app ya sabe del día:
//   · Ruta: clientes, entregados, fallidos, pendientes
//   · Tiempo en ruta (cronómetro) + refrigerio tomado
//   · Kilometraje de hoy (odómetro GPS calibrado)
//   · Plata: efectivo / digital / empresa + gastos + caja
//   · Cierre de caja (si ya cerraste) → cuadra/sobra/falta
// ═══════════════════════════════════════════════════════════

import {
  ClienteCajaLike,
  CierreCaja,
  Gasto,
  ResumenCaja,
  ST_ENTREGADOS,
  categoriaInfo,
  resumenCajaDia,
} from './cajaCore';

// ── Estados ───────────────────────────────────────────────

/** st que NO se entregaron hoy (mismos que ResumenView) */
export const ST_FALLIDOS = [
  'fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta',
];

// ── Tipos ─────────────────────────────────────────────────

/** Conteo de clientes del día por resultado */
export interface ConteoEstados {
  total: number;
  entregados: number;
  fallidos: number;
  /** pendientes + cualquier estado raro sin clasificar */
  pendientes: number;
  /** S/ de los pendientes (por cobrar) */
  porCobrar: number;
}

/** Todo lo que lleva el resumen del día */
export interface ResumenDia {
  /** YYYY-MM-DD local */
  fechaISO: string;
  conteo: ConteoEstados;
  /** la plata (efectivo/digital/empresa/gastos/esperado) */
  caja: ResumenCaja;
  /** gastos de hoy (para el detalle del mensaje) */
  gastosDetalle: Gasto[];
  /** metros calibrados de hoy (odómetro) */
  kmHoyM: number;
  /** ms de cronómetro de ruta */
  rutaMs: number;
  /** segundos de refrigerio tomados hoy */
  refriSeg: number;
}

/** Entrada para armar el resumen (todo opcional salvo clientes) */
export interface ResumenDiaEntrada {
  clientes: ClienteCajaLike[];
  gastos: Gasto[];
  fondo: number | string;
  kmHoyM?: number;
  rutaMs?: number;
  refriSeg?: number;
  fechaISO?: string;
}

// ── Conteo ────────────────────────────────────────────────

function num(v: number | string | undefined | null): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function hoyISOLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Cuenta los clientes de hoy: entregados / fallidos / pendientes */
export function contarEstados(clientes: ClienteCajaLike[]): ConteoEstados {
  let entregados = 0;
  let fallidos = 0;
  let pendientes = 0;
  let porCobrar = 0;
  for (const c of clientes || []) {
    const st = c?.st || '';
    if (ST_ENTREGADOS.includes(st)) {
      entregados++;
    } else if (ST_FALLIDOS.includes(st)) {
      fallidos++;
    } else {
      pendientes++;
      porCobrar += num(c?.cobrar);
    }
  }
  return { total: (clientes || []).length, entregados, fallidos, pendientes, porCobrar };
}

// ── Resumen completo ──────────────────────────────────────

/** Arma el resumen del día: conteo + plata + km + tiempos */
export function armarResumenDia(e: ResumenDiaEntrada): ResumenDia {
  const clientes = e.clientes || [];
  const gastos = e.gastos || [];
  return {
    fechaISO: e.fechaISO || hoyISOLocal(),
    conteo: contarEstados(clientes),
    caja: resumenCajaDia(clientes, gastos, e.fondo),
    gastosDetalle: gastos,
    kmHoyM: Math.max(0, num(e.kmHoyM)),
    rutaMs: Math.max(0, num(e.rutaMs)),
    refriSeg: Math.max(0, num(e.refriSeg)),
  };
}

// ── Formato ───────────────────────────────────────────────

/** ms → "3h 12m" · "48m" · "0m" (para líneas compactas) */
export function formatearDuracionCorta(ms: number): string {
  const totalMin = Math.max(0, Math.round(num(ms) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** metros → "12.4 km" */
export function formatearKm(metros: number): string {
  const km = Math.max(0, num(metros)) / 1000;
  return `${km.toFixed(1)} km`;
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "2026-09-03" → "miércoles 3 de setiembre" */
export function fechaLargaLocal(iso: string): string {
  try {
    const [y, m, d] = (iso || '').split('-').map(Number);
    if (!y || !m || !d) return iso || '';
    const f = new Date(y, m - 1, d);
    if (isNaN(f.getTime())) return iso;
    return `${DIAS_SEMANA[f.getDay()]} ${d} de ${MESES_LARGOS[m - 1]}`;
  } catch {
    return iso || '';
  }
}

// ── Mensaje para el grupo MATE ────────────────────────────

/**
 * Arma el mensaje de WhatsApp del resumen del día (lo manda el
 * bot con la acción enviar_grupo_mate). Formato tipo v1:
 * compacto, secciones con negritas, líneas condicionales — lo
 * que no aplica no ocupa lugar (día sin yape → sin línea yape).
 *
 * @param r        resumen del día (armarResumenDia)
 * @param cierre   cierre de caja de HOY si ya cerraste (null = abierto)
 * @param riderNombre  tu nombre para el título (default "Rider")
 */
export function armarMensajeResumen(r: ResumenDia, cierre: CierreCaja | null, riderNombre?: string): string {
  const L: string[] = [];
  const quien = riderNombre?.trim() || 'Rider';
  const c = r.conteo;
  const caja = r.caja;
  const mon = (n: number) => `S/ ${n.toFixed(2)}`;

  L.push(`📊 *RESUMEN DEL DÍA — ${quien}*`);
  L.push(`📅 ${fechaLargaLocal(r.fechaISO)}`);
  L.push('');

  // ── Ruta ──
  L.push('📦 *Ruta*');
  L.push(`· Clientes: ${c.total} (${c.entregados} entregados, ${c.fallidos} fallidos, ${c.pendientes} pendientes)`);
  if (c.pendientes > 0) {
    L.push(`⏳ Por cobrar: ${mon(c.porCobrar)} (${c.pendientes})`);
  }
  if (r.rutaMs > 0) {
    const refri = r.refriSeg >= 60 ? ` (+ ${formatearDuracionCorta(r.refriSeg * 1000)} refrigerio)` : '';
    L.push(`⏱️ Tiempo en ruta: ${formatearDuracionCorta(r.rutaMs)}${refri}`);
  } else if (r.refriSeg >= 60) {
    L.push(`⏱️ Refrigerio: ${formatearDuracionCorta(r.refriSeg * 1000)}`);
  }
  if (r.kmHoyM > 0) {
    L.push(`🛣️ Kilometraje: ${formatearKm(r.kmHoyM)}`);
  }
  L.push('');

  // ── Cobrado ──
  L.push('💵 *Cobrado*');
  L.push(`· Efectivo: ${mon(caja.efectivoCobrado)}`);
  if (caja.digitalRider > 0) L.push(`· Yape digital: ${mon(caja.digitalRider)}`);
  if (caja.empresa > 0) L.push(`· Empresa: ${mon(caja.empresa)}`);
  L.push(`· Total del día: ${mon(caja.cobradoTotal)}`);
  L.push('');

  // ── Gastos ──
  if (caja.nGastos > 0) {
    L.push(`💸 *Gastos*: ${mon(caja.gastosEfectivo + caja.gastosDigital)} (${caja.nGastos})`);
    // detalle: el snapshot congelado del cierre si ya cerraste,
    // la lista viva si la caja sigue abierta
    const detalle: Gasto[] = (cierre && cierre.gastos?.length ? cierre.gastos : r.gastosDetalle) || [];
    for (const g of detalle) {
      const cat = categoriaInfo(g.categoria);
      const det = g.concepto?.trim() ? ` — ${g.concepto.trim()}` : '';
      L.push(`  ${cat.icono} ${cat.nombre}: ${mon(Math.abs(num(g.monto)))}${det}`);
    }
    L.push('');
  }

  // ── Caja ──
  const fondo = cierre ? cierre.fondoInicial : caja.esperado - caja.efectivoCobrado + caja.gastosEfectivo;
  if (fondo > 0) {
    L.push(`🔑 Fondo inicial: ${mon(fondo)}`);
  }
  L.push(`🧮 Esperado en caja: ${mon(cierre ? cierre.esperado : caja.esperado)}`);
  if (cierre) {
    const dif = cierre.diferencia;
    if (Math.abs(dif) <= 0.01) {
      L.push(`🤲 Contado: ${mon(cierre.contado)} — ✅ cuadra exacto`);
    } else if (dif > 0) {
      L.push(`🤲 Contado: ${mon(cierre.contado)} — ⚠️ sobran ${mon(dif)}`);
    } else {
      L.push(`🤲 Contado: ${mon(cierre.contado)} — 🔴 faltan ${mon(Math.abs(dif))}`);
    }
  } else {
    L.push('🔒 Caja aún abierta (sin cierre)');
  }
  L.push('');

  // ── Neto ──
  L.push(`🏷️ *Neto del día*: ${mon(cierre ? cierre.netoDelDia : caja.netoDelDia)}`);
  return L.join('\n');
}
