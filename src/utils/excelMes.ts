// ═══════════════════════════════════════════════════════════
// 📅 EXCEL DEL MES COMPLETO — Fase 2.17-C
// Un solo .xlsx con TODO el mes en curso:
//   Hoja "Resumen": KPIs del mes + tabla día por día con totales
//   Hoja "Detalle": todos los clientes de todas las rutas del mes
//                   (fecha, cliente, monto, caja 💚/🏢, método...)
// La lógica pura (buildAoaMes) está separada para poder testearla
// con Node sin DOM ni Firebase; exportarExcelMes la envuelve con
// XLSX + el compartir nativo (cascada share → descargar).
// Incluye HOY EN CURSO si la ruta del día está activa (marcado).
// ═══════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import { ETIQUETAS_ESTADO } from './realData';
import { descargarArchivo } from './descargaArchivo';

export type ToastFn = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

/** Registro de historial (campos que usa el mensual — compatible con RegistroHistorial) */
export interface RegistroMes {
  id: string;
  fecha?: string;              // YYYY-MM-DD
  entregados?: number;
  fallidos?: number;
  pendientes?: number;
  cobradoTotal?: number;
  totalRider?: number;
  totalEmpresa?: number;
  clientes?: any[];
}

/** Métodos que pagan el rider (caja 💚 LO TUYO) — igual que exportarExcel.ts */
const METODOS_RIDER = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'cambio'];
/** Métodos que paga la empresa (caja 🏢 EMPRESA) — igual que exportarExcel.ts */
const METODOS_EMPRESA = ['pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa'];

/** Monto que queda para el RIDER de un cliente (reglas de la v1) */
function montoRider(c: any): number {
  if (c.st === 'mixto') return parseFloat(String(c.mEf || 0));
  if (c.st === 'yape-efectivo') {
    return Math.max(0, parseFloat(String(c.mEf || 0)) + parseFloat(String(c.mYp || 0)) - parseFloat(String(c.mVt || 0)));
  }
  return parseFloat(String(c.cobrar || 0));
}

/** Monto que paga la EMPRESA de un cliente (reglas de la v1) */
function montoEmpresa(c: any): number {
  if (c.st === 'mixto') return parseFloat(String(c.mEmp || 0));
  return parseFloat(String(c.cobrar || 0));
}

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Fecha YYYY-MM-DD → "vie 28 ago" (etiqueta corta para las tablas) */
function fechaCortaMes(fecha: string): string {
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const d = new Date(`${fecha}T12:00:00`);
  if (isNaN(d.getTime())) return fecha;
  return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
}

export interface ResumenMes {
  anio: number;
  mes: number;                 // 1-12
  prefijo: string;             // "YYYY-MM"
  rutas: number;               // registros del mes
  entregados: number;
  fallidos: number;
  tuyo: number;
  empresa: number;
  total: number;
  dias: number;                // días distintos con ruta
}

export interface AoaMes {
  resumen: ResumenMes;
  aoaResumen: (string | number)[][];
  aoaDetalle: (string | number)[][];
}

/**
 * LÓGICA PURA: arma las filas del Excel mensual.
 * Recibe TODOS los registros (solo filtra los del mes pedido) y
 * devuelve { resumen, aoaResumen, aoaDetalle } o null si el mes
 * no tiene ninguna ruta.
 */
export function buildAoaMes(
  registros: RegistroMes[],
  anio: number,
  mes: number,
): AoaMes | null {
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
  const delMes = registros
    .filter((r) => (r.fecha || '').startsWith(prefijo))
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

  if (delMes.length === 0) return null;

  // ── Acumular por registro (día) ──
  let tuyo = 0, empresa = 0, total = 0, entregados = 0, fallidos = 0;
  delMes.forEach((r) => {
    const rTuyo = r.totalRider ?? 0;
    const rEmp = r.totalEmpresa ?? 0;
    const rTotal = r.cobradoTotal ?? (rTuyo + rEmp);
    tuyo += rTuyo;
    empresa += rEmp;
    total += rTotal;
    entregados += r.entregados || 0;
    fallidos += r.fallidos || 0;
  });

  const fechasDistintas = new Set(delMes.map((r) => r.fecha || '').filter(Boolean));

  // Agrupar por FECHA (varias rutas el mismo día → una sola fila sumada)
  const porFecha = new Map<string, { entregados: number; fallidos: number; tuyo: number; empresa: number; total: number; enCurso: boolean }>();
  delMes.forEach((r) => {
    const key = r.fecha || '—';
    const prev = porFecha.get(key) || { entregados: 0, fallidos: 0, tuyo: 0, empresa: 0, total: 0, enCurso: false };
    const rTuyo = r.totalRider ?? 0;
    const rEmp = r.totalEmpresa ?? 0;
    prev.entregados += r.entregados || 0;
    prev.fallidos += r.fallidos || 0;
    prev.tuyo += rTuyo;
    prev.empresa += rEmp;
    prev.total += r.cobradoTotal ?? (rTuyo + rEmp);
    prev.enCurso = prev.enCurso || r.id === '_hoy_vivo_';
    porFecha.set(key, prev);
  });

  const resumen: ResumenMes = {
    anio, mes, prefijo,
    rutas: delMes.length,
    entregados, fallidos, tuyo, empresa, total,
    dias: fechasDistintas.size,
  };

  // ── Hoja 1: RESUMEN ──
  const aoaResumen: (string | number)[][] = [];
  aoaResumen.push([`📊 MENSUAL — ${MESES_ES[mes - 1]} ${anio}`]);
  aoaResumen.push([]);
  aoaResumen.push(['Rutas cerradas', resumen.rutas]);
  aoaResumen.push(['✅ Entregas totales', resumen.entregados]);
  aoaResumen.push(['❌ Fallidos', resumen.fallidos]);
  aoaResumen.push(['💚 Total lo tuyo', Number(tuyo.toFixed(2))]);
  aoaResumen.push(['🏢 Total empresa', Number(empresa.toFixed(2))]);
  aoaResumen.push(['💰 TOTAL COBRADO', Number(total.toFixed(2))]);
  aoaResumen.push(['📅 Días con ruta', resumen.dias]);
  aoaResumen.push(['S/ por día (promedio)', Number((resumen.dias > 0 ? total / resumen.dias : 0).toFixed(2))]);
  aoaResumen.push(['S/ por entrega (promedio)', Number((resumen.entregados > 0 ? total / resumen.entregados : 0).toFixed(2))]);
  aoaResumen.push([]);
  aoaResumen.push(['📅 DÍA POR DÍA']);
  aoaResumen.push(['FECHA', 'ENTREGAS', 'FALLIDOS', '💚 TUYO', '🏢 EMPRESA', '💰 TOTAL']);
  porFecha.forEach((v, fecha) => {
    aoaResumen.push([
      `${fechaCortaMes(fecha)}${v.enCurso ? ' (en curso)' : ''}`,
      v.entregados,
      v.fallidos,
      Number(v.tuyo.toFixed(2)),
      Number(v.empresa.toFixed(2)),
      Number(v.total.toFixed(2)),
    ]);
  });
  aoaResumen.push(['TOTAL DEL MES', resumen.entregados, resumen.fallidos, Number(tuyo.toFixed(2)), Number(empresa.toFixed(2)), Number(total.toFixed(2))]);

  // ── Hoja 2: DETALLE (todos los clientes del mes) ──
  const aoaDetalle: (string | number)[][] = [];
  aoaDetalle.push([`📋 DETALLE DE CLIENTES — ${MESES_ES[mes - 1]} ${anio}`]);
  aoaDetalle.push([]);
  aoaDetalle.push(['FECHA', 'N°', 'CLIENTE', 'DIRECCIÓN', 'DISTRITO', 'CELULAR', 'PRODUCTO', 'MONTO', 'CAJA', 'FORMA DE PAGO', 'HORA', 'OBSERVACIONES', 'MOTIVO/REPORTE']);

  /** Caja + monto de cada cliente según su método (reglas de la v1) */
  const cajaDe = (c: any): { caja: string; monto: number } => {
    const st = c.st || '';
    if (st === 'mixto') {
      return { caja: '💚+🏢 Mixto', monto: (parseFloat(String(c.mEf || 0)) || 0) + (parseFloat(String(c.mEmp || 0)) || 0) };
    }
    if (METODOS_RIDER.includes(st)) return { caja: '💚 Lo tuyo', monto: montoRider(c) };
    if (METODOS_EMPRESA.includes(st)) return { caja: '🏢 Empresa', monto: montoEmpresa(c) };
    return { caja: '⏳ No entregado', monto: parseFloat(String(c.cobrar || 0)) || 0 };
  };

  delMes.forEach((r) => {
    (r.clientes || []).forEach((c: any, i: number) => {
      const { caja, monto } = cajaDe(c);
      aoaDetalle.push([
        fechaCortaMes(r.fecha || ''),
        c.num ?? i + 1,
        c.nombre || 'Cliente',
        c.dir || '',
        c.dist || '',
        c.cel || '',
        c.prod || '',
        Number(monto.toFixed(2)),
        caja,
        ETIQUETAS_ESTADO[c.st] || c.st || 'Pendiente',
        c.hora || '–',
        c.obs || c.nota || '',
        c.motivo || '',
      ]);
    });
  });
  aoaDetalle.push([]);
  aoaDetalle.push(['TOTAL COBRADO DEL MES (💚 + 🏢)', '', '', '', '', '', '', Number(total.toFixed(2))]);

  return { resumen, aoaResumen, aoaDetalle };
}

/**
 * Genera y comparte el Excel del MES EN CURSO (Resumen + Detalle).
 * Debe llamarse directo desde el tap del usuario (gesto) para que
 * el compartir nativo funcione.
 */
export async function exportarExcelMes(
  registros: RegistroMes[],
  onShowToast?: ToastFn,
): Promise<boolean> {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth() + 1;
  const nombreMes = `${MESES_ES[mes - 1]} ${anio}`;

  const built = buildAoaMes(registros, anio, mes);
  if (!built) {
    onShowToast?.('📅 Sin datos este mes', `No hay rutas guardadas en ${nombreMes} todavía`, 'warning');
    return false;
  }

  try {
    // ── Hoja Resumen ──
    const wsResumen = XLSX.utils.aoa_to_sheet(built.aoaResumen);
    wsResumen['!cols'] = [
      { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];

    // ── Hoja Detalle ──
    const wsDetalle = XLSX.utils.aoa_to_sheet(built.aoaDetalle);
    wsDetalle['!cols'] = [
      { wch: 12 }, { wch: 5 }, { wch: 24 }, { wch: 32 }, { wch: 14 }, { wch: 12 },
      { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 30 }, { wch: 24 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle');
    const salida = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const blob = new Blob([salida], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const nombre = `RutaMensual_${built.resumen.prefijo}.xlsx`;

    // ── Guardar/Compartir (APK: Documentos — Fix 2.18) ──
    const res = await descargarArchivo(
      blob,
      nombre,
      onShowToast,
      '📅 Excel del mes listo',
      `${nombreMes}: ${built.resumen.rutas} rutas · S/ ${built.resumen.total.toFixed(2)}`,
    );
    return res !== null && res !== 'cancelado';
  } catch (e: any) {
    console.error('❌ Error exportando Excel del mes:', e);
    onShowToast?.('Error al exportar', e?.message || 'No se pudo generar el Excel del mes', 'error');
    return false;
  }
}
