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

import { ETIQUETAS_ESTADO } from './realData';
import { descargarArchivo } from './descargaArchivo';
import {
  PALETA_V1 as C,
  xlsFill,
  xlsBorde,
  xlsFB,
  xlsFN,
  filaTitulo,
  filaEncabezado,
  autoAjustarColumnas,
  excelABlob,
  FMT_SOL,
  ExcelJS,
} from './excelEstilo';

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
 * Construye el libro del MES con los COLORES de la v1 (Fase 3.8).
 * Función pura (testable en Node) — exportarExcelMes la envuelve
 * con el guardar/compartir nativo.
 */
export function buildWorkbookMes(
  registros: RegistroMes[],
  anio: number,
  mes: number,
): { wb: ExcelJS.Workbook; resumen: ResumenMes } | null {
  const built = buildAoaMes(registros, anio, mes);
  if (!built) return null;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'RiderTrack';

  try {
    // ═══ HOJA 1: RESUMEN (con colores v1) ═══
    const wsR = wb.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 3 }] });
    const CR = 6;
    wsR.columns = [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }];
    filaTitulo(wsR, `📊  MENSUAL  —  ${MESES_ES[mes - 1].toUpperCase()} ${anio}`, CR);
    wsR.addRow([]).height = 4;

    // KPIs con colores por tipo (estilo resumen de la v1)
    const kpis: { l: string; v: number | string; fmt: string; bg: string; fg: string }[] = [
      { l: '🛵  Rutas cerradas', v: built.resumen.rutas, fmt: '#,##0', bg: 'E8EAF6', fg: '1A237E' },
      { l: '✅  Entregas totales', v: built.resumen.entregados, fmt: '#,##0', bg: 'E8F5E9', fg: '1B5E20' },
      { l: '❌  Fallidos', v: built.resumen.fallidos, fmt: '#,##0', bg: 'FFEBEE', fg: 'B71C1C' },
      { l: '💚  Total lo tuyo', v: built.resumen.tuyo, fmt: FMT_SOL, bg: 'E8F5E9', fg: '1B5E20' },
      { l: '🏢  Total empresa', v: built.resumen.empresa, fmt: FMT_SOL, bg: 'E3F2FD', fg: '0D47A1' },
      { l: '💰  TOTAL COBRADO', v: built.resumen.total, fmt: FMT_SOL, bg: '263238', fg: 'FFFFFF' },
      { l: '📅  Días con ruta', v: built.resumen.dias, fmt: '#,##0', bg: 'F3E5F5', fg: '6A1B9A' },
      { l: '💵  S/ por día (promedio)', v: built.resumen.dias > 0 ? built.resumen.total / built.resumen.dias : 0, fmt: FMT_SOL, bg: 'FFF3E0', fg: 'E65100' },
      { l: '📦  S/ por entrega (promedio)', v: built.resumen.entregados > 0 ? built.resumen.total / built.resumen.entregados : 0, fmt: FMT_SOL, bg: 'FFF3E0', fg: 'E65100' },
    ];
    kpis.forEach((k) => {
      const row = wsR.addRow([k.l, '', '', '', '', k.v]);
      wsR.mergeCells(row.number, 1, row.number, 5);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        cell.fill = xlsFill(k.bg);
        cell.font = xlsFB(k.fg, 11);
        cell.border = xlsBorde(C.border);
        cell.alignment = { horizontal: cn === CR ? 'right' : 'left', vertical: 'middle' };
        if (cn === CR && k.fmt !== '@') cell.numFmt = k.fmt;
      });
    });
    wsR.addRow([]).height = 6;

    // Tabla DÍA POR DÍA
    filaTitulo(wsR, '📅  DÍA POR DÍA', CR, 20);
    filaEncabezado(wsR, ['FECHA', 'ENTREGAS', 'FALLIDOS', '💚 TUYO', '🏢 EMPRESA', '💰 TOTAL']);
    let idxDia = 0;
    built.aoaResumen.forEach((fila) => {
      if (fila.length < 6) return; // saltar títulos/vacíos
      const esTotal = String(fila[0]).includes('TOTAL DEL MES');
      if (String(fila[0]) === 'FECHA') return; // header ya puesto
      const row = wsR.addRow(fila);
      row.height = 15;
      if (esTotal) {
        row.eachCell({ includeEmpty: true }, (cell, cn) => {
          cell.fill = xlsFill(C.granTotBg);
          cell.font = xlsFB(C.fg, 11);
          cell.border = xlsBorde('000000');
          cell.alignment = { horizontal: cn >= 2 ? 'center' : 'left', vertical: 'middle' };
          if (cn >= 4) cell.numFmt = FMT_SOL;
        });
      } else {
        idxDia++;
        const bg = idxDia % 2 === 0 ? 'E8EAF6' : 'FFFFFF';
        row.eachCell({ includeEmpty: true }, (cell, cn) => {
          cell.fill = xlsFill(bg);
          cell.font = xlsFN(C.dark, 10);
          cell.border = xlsBorde(C.border);
          cell.alignment = { horizontal: cn >= 2 ? 'center' : 'left', vertical: 'middle' };
          if (cn === 2) cell.font = xlsFB('1B5E20', 10);
          if (cn === 3) cell.font = xlsFB('B71C1C', 10);
          if (cn >= 4) cell.numFmt = FMT_SOL;
        });
      }
    });

    // ═══ HOJA 2: DETALLE (coloreado por caja, como el diario) ═══
    const wsD = wb.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 3 }] });
    const CD = 13;
    wsD.columns = [{ width: 12 }, { width: 5 }, { width: 24 }, { width: 32 }, { width: 14 }, { width: 12 }, { width: 28 }, { width: 10 }, { width: 14 }, { width: 16 }, { width: 8 }, { width: 30 }, { width: 24 }];
    filaTitulo(wsD, `📋  DETALLE DE CLIENTES  —  ${MESES_ES[mes - 1].toUpperCase()} ${anio}`, CD);
    wsD.addRow([]).height = 4;
    filaEncabezado(wsD, ['FECHA', 'N°', 'CLIENTE', 'DIRECCIÓN', 'DISTRITO', 'CELULAR', 'PRODUCTO', 'MONTO', 'CAJA', 'FORMA DE PAGO', 'HORA', 'OBSERVACIONES', 'MOTIVO/REPORTE']);

    let idxDet = 0;
    built.aoaDetalle.forEach((fila) => {
      if (fila.length < 8) return; // saltar título/vacíos (la fila TOTAL tiene 8)
      if (String(fila[0]) === 'FECHA') return;
      const caja = String(fila[8] || '');
      const esTotal = String(fila[0]).includes('TOTAL COBRADO DEL MES');
      const row = wsD.addRow(fila);
      row.height = 15;

      if (esTotal) {
        row.eachCell({ includeEmpty: true }, (cell, cn) => {
          cell.fill = xlsFill(C.granTotBg);
          cell.font = xlsFB(C.fg, 12);
          cell.border = xlsBorde('000000');
          cell.alignment = { horizontal: cn === 8 ? 'right' : 'left', vertical: 'middle' };
          if (cn === 8) cell.numFmt = FMT_SOL;
        });
        return;
      }

      idxDet++;
      let bg: string;
      if (caja.includes('Mixto')) bg = idxDet % 2 === 0 ? 'F3E5F5' : 'EDE2F4';
      else if (caja.includes('💚')) bg = idxDet % 2 === 0 ? C.alt2 : C.alt1;
      else if (caja.includes('🏢')) bg = C.empRow;
      else bg = idxDet % 2 === 0 ? C.fal2 : C.fal1;

      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        cell.fill = xlsFill(bg);
        cell.border = xlsBorde(C.border);
        if (cn === 2) {
          cell.font = { bold: false, color: { argb: 'FF' + C.dark }, size: 9, name: 'Calibri' };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (cn === 8) {
          const entregado = !caja.includes('⏳');
          cell.font = xlsFB(entregado ? '1B5E20' : 'B71C1C', 10);
          cell.alignment = { vertical: 'middle' };
          cell.numFmt = FMT_SOL;
        } else {
          cell.font = xlsFN(C.dark, 10);
          cell.alignment = { vertical: 'middle', wrapText: cn === 4 || cn === 12 || cn === 13 };
        }
      });
    });

    autoAjustarColumnas(wsR, [30, 12, 12, 14, 14, 14]);
    autoAjustarColumnas(wsD, [12, 5, 24, 32, 16, 13, 30, 10, 14, 20, 8, 30, 24]);

    return { wb, resumen: built.resumen };
  } catch (e: any) {
    console.error('❌ Error construyendo Excel del mes:', e);
    return null;
  }
}

/**
 * Genera y comparte el Excel del MES EN CURSO (Resumen + Detalle).
 * Debe llamarse directo desde el tap del usuario (gesto) para que
 * el compartir nativo funcione.
 *
 * FASE 3.8 — con los COLORES de la v1 (ExcelJS): misma paleta del
 * Excel diario (títulos azules, KPIs con colores por tipo, tabla
 * día por día con filas alternadas y detalle coloreado por caja
 * 💚/🏢/⏳). La lógica de datos sigue siendo buildAoaMes (testada).
 */
export async function exportarExcelMes(
  registros: RegistroMes[],
  onShowToast?: ToastFn,
): Promise<boolean> {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth() + 1;
  const nombreMes = `${MESES_ES[mes - 1]} ${anio}`;

  try {
    const built = buildWorkbookMes(registros, anio, mes);
    if (!built) {
      onShowToast?.('📅 Sin datos este mes', `No hay rutas guardadas en ${nombreMes} todavía`, 'warning');
      return false;
    }

    const buffer = await built.wb.xlsx.writeBuffer();
    const blob = excelABlob(buffer as ExcelJS.Buffer);

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
