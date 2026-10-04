// ═══════════════════════════════════════════════════════════
// 🛵 EXPORTAR A CIRCUIT — Fase 2.8 (recuperado de la v1)
// Genera el .xlsx con el formato EXACTO de importación de la
// app Circuit (getcircuit.com): columna por columna igual que el
// dlCircuit() de la v1, para que "Importar desde Excel" en
// Circuit lo tome sin tocar nada:
//   Recipient Name | Address Line 1 | City | State | Country |
//   Zip | Phone | Notes | Order Number | Latitude | Longitude
// El teléfono va +51XXXXXXXXX y las notas juntan cliente,
// producto, costo, ⚠️ observación y 📝 nota.
//
// Fix 2.18 (reporte del usuario):
//   • Las coordenadas pegadas como dirección ("-12.000013,
//     -77.108397") van en las columnas Latitude/Longitude con la
//     Address VACÍA — la doc oficial de Circuit/Spoke pide
//     "coordenadas O dirección, no ambas". Antes Circuit intentaba
//     geocodificar el texto y mandaba la parada a otro distrito
//     (Callao → Carabayllo).
//   • El costo va con decimales (S/ 89.90, no S/ 90).
//   • La descarga usa descargarArchivo(): en el APK guarda en la
//     carpeta Documentos (el <a download> del WebView no baja NADA
//     — por eso "no funcionaba" y había que usar la v1).
// ═══════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import { RegistroHistorial } from '../services/firestore';
import { ETIQUETAS_ESTADO } from './realData';
import { buildCircuitRows } from './circuitExcel';
import { descargarArchivo } from './descargaArchivo';
import {
  PALETA_V1 as C,
  xlsFill,
  xlsBorde,
  xlsFB,
  xlsFN,
  filaTitulo,
  filaSeccion,
  filaEncabezado,
  filaTotal,
  autoAjustarColumnas,
  excelABlob,
  FMT_SOL,
  ExcelJS,
} from './excelEstilo';

export type ToastFn = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

export async function exportarCircuitRuta(
  clientes: any[],
  onShowToast?: ToastFn
): Promise<boolean> {
  if (!clientes || clientes.length === 0) {
    onShowToast?.('Sin clientes', 'No hay clientes en la ruta para exportar', 'warning');
    return false;
  }

  try {
    const rows = buildCircuitRows(clientes);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
      { wch: 8 }, { wch: 15 }, { wch: 60 }, { wch: 8 },
      { wch: 12 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stops');
    const salida = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const blob = new Blob([salida], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Circuit_28-08-2026.xlsx — mismo patrón de nombre que la v1
    const fecha = new Date().toLocaleDateString('es-PE').replace(/\//g, '-');
    const nombre = `Circuit_${fecha}.xlsx`;

    // ── Guardar/Compartir (APK: Documentos — Fix 2.18) ──
    const res = await descargarArchivo(
      blob,
      nombre,
      onShowToast,
      '🛵 Circuit listo',
      'en Circuit: Importar → desde Excel',
    );
    return res !== null && res !== 'cancelado';
  } catch (e: any) {
    console.error('❌ Error exportando Circuit:', e);
    onShowToast?.('Error al exportar', e?.message || 'No se pudo generar el archivo Circuit', 'error');
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// 📥 EXPORTAR EXCEL DE UNA RUTA DEL HISTORIAL — Fase 2.6
// Genera un .xlsx REAL (SheetJS ya viene en el proyecto para el
// importador) con las mismas secciones que el Excel de la v1:
//   💚 LO TUYO (cobros del día) → TOTAL LO TUYO
//   🏢 EMPRESA (transferencia/POS) → TOTAL EMPRESA
//   ⏳ FALLIDOS / SIN ATENDER → TOTAL
//   GRAN TOTAL + RESUMEN DEL DÍA
// Después lo guarda/comparte con descargarArchivo (APK:
// carpeta Documentos — Fix 2.18; web: share → descarga).
// ═══════════════════════════════════════════════════════════

/** Métodos que pagan el rider (caja 💚 LO TUYO) */
const METODOS_RIDER = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'cambio'];
/** Métodos que paga la empresa (caja 🏢 EMPRESA) */
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

/** Nombre de archivo, igual patrón que la v1: RutaDiaria_2026-08-28_20-30.xlsx */
function nombreArchivo(fecha: string): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `RutaDiaria_${fecha}_${hh}-${mm}.xlsx`;
}

/**
 * Construye el libro Excel CON LOS COLORES de la v1 (Fase 3.8).
 * Función pura (testable en Node) — exportarExcelRuta la envuelve
 * con el guardar/compartir nativo.
 */
export function buildWorkbookRuta(r: RegistroHistorial): ExcelJS.Workbook {
  const clientes: any[] = r.clientes || [];

  // ── Armar el libro con estilo v1 ──
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RiderTrack';
  const ws = wb.addWorksheet('Entregas', { views: [{ state: 'frozen', ySplit: 3 }] });

  const COLS = 13; // como la v1
  ws.columns = [{ width: 4 }, { width: 22 }, { width: 30 }, { width: 14 }, { width: 13 }, { width: 28 }, { width: 9 }, { width: 10 }, { width: 18 }, { width: 8 }, { width: 25 }, { width: 30 }, { width: 30 }];
  const HDRS = ['N°', 'NOMBRE CLIENTE', 'DIRECCIÓN', 'DISTRITO', 'CELULAR', 'PRODUCTO', 'PRECIO', 'A COBRAR', 'FORMA DE PAGO', 'HORA', 'NOTA', 'OBSERVACIONES', 'MOTIVO/REPORTE'];

  // Título + encabezado (como la v1)
  filaTitulo(ws, `RUTA DEL DÍA  —  ${r.fecha}`, COLS);
  ws.addRow([]).height = 4;
  filaEncabezado(ws, HDRS);
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: COLS } };

  let loIdx = 0;
  let falIdx = 0;
  const addCli = (c: any, monto: number, tipo: 'lo' | 'emp' | 'fal') => {
    let bg: string;
    if (tipo === 'lo') { loIdx++; bg = loIdx % 2 === 0 ? C.alt2 : C.alt1; }
    else if (tipo === 'emp') { bg = C.empRow; }
    else { falIdx++; bg = falIdx % 2 === 0 ? C.fal2 : C.fal1; }
    const motivoTxt = c.motivo || c.notaPendiente || '';
    const row = ws.addRow([
      c.num ?? '',
      c.nombre || 'Cliente',
      c.dir || '',
      c.dist || '',
      c.cel || '',
      c.prod || '',
      parseFloat(String(c.precio || 0)) || 0,
      monto,
      ETIQUETAS_ESTADO[c.st] || c.st || 'Pendiente',
      c.hora || '–',
      c.nota || '',
      c.obs || '',
      motivoTxt,
    ]);
    row.height = 15;
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = xlsFill(bg);
      cell.border = xlsBorde(C.border);
      if (cn === 1) {
        cell.font = { bold: false, color: { argb: 'FF' + C.dark }, size: 9, name: 'Calibri' };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (cn === 8) {
        cell.font = xlsFB('1B5E20', 10);
        cell.alignment = { vertical: 'middle' };
        cell.numFmt = FMT_SOL;
      } else if (cn === 7) {
        cell.font = xlsFN(C.dark, 10);
        cell.alignment = { vertical: 'middle' };
        cell.numFmt = FMT_SOL;
      } else {
        cell.font = xlsFN(C.dark, 10);
        cell.alignment = { vertical: 'middle', wrapText: cn === 3 || cn === 11 || cn === 12 || cn === 13 };
      }
    });
  };

  // 💚 LO TUYO — Cobros del día
  const clTuyo = clientes.filter((c) => METODOS_RIDER.includes(c.st));
  let totTuyo = 0;
  filaSeccion(ws, '💚  LO TUYO  —  Cobros del día', C.loTuyoBg, COLS);
  clTuyo.forEach((c) => {
    const m = montoRider(c);
    totTuyo += m;
    addCli(c, m, 'lo');
  });
  if (clTuyo.length === 0) {
    const nr = ws.addRow(['Sin entregas']);
    nr.getCell(1).font = xlsFN('999999', 10);
    nr.height = 14;
  }
  filaTotal(ws, 'TOTAL LO TUYO', totTuyo, C.totTuyoBg, COLS, 8);
  ws.addRow([]).height = 6;

  // 🏢 EMPRESA — Transferencia / POS
  const clEmpresa = clientes.filter((c) => METODOS_EMPRESA.includes(c.st) || (c.st === 'mixto' && parseFloat(String(c.mEmp || 0)) > 0));
  let totEmpresa = 0;
  filaSeccion(ws, '🏢  EMPRESA  —  Transferencia / POS', C.empresaBg, COLS);
  clEmpresa.forEach((c) => {
    const m = montoEmpresa(c);
    totEmpresa += m;
    addCli(c, m, 'emp');
  });
  if (clEmpresa.length === 0) {
    const nr2 = ws.addRow(['Sin entregas de empresa']);
    nr2.getCell(1).font = xlsFN('999999', 10);
    nr2.height = 14;
  }
  filaTotal(ws, 'TOTAL EMPRESA', totEmpresa, C.empresaBg, COLS, 8);
  ws.addRow([]).height = 6;

  // ⏳ FALLIDOS / SIN ATENDER — No entregados
  const clOtros = clientes.filter((c) => !METODOS_RIDER.includes(c.st) && !METODOS_EMPRESA.includes(c.st));
  let totOtros = 0;
  if (clOtros.length > 0) {
    filaSeccion(ws, '⏳  FALLIDOS / SIN ATENDER  —  No entregados', C.fallidoBg, COLS);
    clOtros.forEach((c) => {
      const m = parseFloat(String(c.cobrar || 0));
      totOtros += m;
      addCli(c, m, 'fal');
    });
    filaTotal(ws, 'TOTAL FALLIDOS', totOtros, C.fallidoBg, COLS, 8);
    ws.addRow([]).height = 6;
  }

  // GRAN TOTAL (como la v1)
  const totGen = totTuyo + totEmpresa;
  const gt = ws.addRow(['GRAN TOTAL DEL DÍA', '', '', '', '', '', '', totGen, '', '', '', '', '']);
  gt.height = 22;
  ws.mergeCells(gt.number, 1, gt.number, 7);
  gt.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill = xlsFill(C.granTotBg);
    cell.font = xlsFB(C.fg, 13);
    cell.border = xlsBorde('000000');
    cell.alignment = { horizontal: cn === 8 ? 'right' : 'left', vertical: 'middle' };
    if (cn === 8) cell.numFmt = FMT_SOL;
  });
  ws.addRow([]).height = 6;

  // 📊 RESUMEN DEL DÍA (colores por fila, como la v1)
  filaTitulo(ws, '📊  RESUMEN DEL DÍA', COLS, 20);
  const entregados = r.entregados || (clTuyo.length + clEmpresa.length);
  const resum: { l: string; v: number; fmt: string; bg: string; fg: string }[] = [
    { l: '👥  Clientes totales', v: clientes.length, fmt: '#,##0', bg: 'E8EAF6', fg: '1A237E' },
    { l: '✅  Entregados', v: entregados, fmt: '#,##0', bg: 'E8F5E9', fg: '1B5E20' },
    { l: '⏳  Pendientes / Fallidos', v: r.pendientes || r.fallidos || clOtros.length, fmt: '#,##0', bg: 'FFEBEE', fg: 'B71C1C' },
    { l: '💚  Total lo tuyo', v: totTuyo, fmt: FMT_SOL, bg: 'E8F5E9', fg: '1B5E20' },
    { l: '🏢  Total empresa', v: totEmpresa, fmt: FMT_SOL, bg: 'E3F2FD', fg: '0D47A1' },
    { l: '💰  TOTAL COBRADO', v: totGen, fmt: FMT_SOL, bg: '263238', fg: 'FFFFFF' },
  ];
  resum.forEach((item) => {
    const row = ws.addRow([item.l, '', '', '', '', '', '', item.v, '', '', '', '', '']);
    ws.mergeCells(row.number, 1, row.number, 7);
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = xlsFill(item.bg);
      cell.font = xlsFB(item.fg, 11);
      cell.border = xlsBorde(C.border);
      cell.alignment = { horizontal: cn === 8 ? 'right' : 'left', vertical: 'middle' };
      if (cn === 8) cell.numFmt = item.fmt;
    });
  });

  // Autoajuste inteligente por columna (como la v1)
  autoAjustarColumnas(ws, [4, 22, 32, 16, 13, 30, 9, 10, 20, 8, 28, 30, 30]);

  return wb;
}

/**
 * Genera y comparte el Excel de una ruta del historial.
 * Debe llamarse directo desde el tap del usuario (gesto) para que
 * el compartir nativo funcione.
 *
 * FASE 3.8 — con los COLORES de la v1 (ExcelJS): título azul,
 * secciones 💚/🏢/⏳ con sus totales, filas alternadas, gran total
 * y resumen del día — igual que el xlsData() de la v1.
 */
export async function exportarExcelRuta(
  r: RegistroHistorial,
  onShowToast?: ToastFn
): Promise<boolean> {
  const clientes: any[] = r.clientes || [];
  if (clientes.length === 0) {
    onShowToast?.('Sin clientes', 'Esta ruta no guardó el detalle de clientes para exportar', 'warning');
    return false;
  }

  try {
    const wb = buildWorkbookRuta(r);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = excelABlob(buffer as ExcelJS.Buffer);

    const nombre = nombreArchivo(r.fecha);

    // ── Guardar/Compartir (APK: Documentos — Fix 2.18) ──
    const res = await descargarArchivo(blob, nombre, onShowToast, '📥 Excel de la ruta listo');
    return res !== null && res !== 'cancelado';
  } catch (e: any) {
    console.error('❌ Error exportando Excel:', e);
    onShowToast?.('Error al exportar', e?.message || 'No se pudo generar el Excel', 'error');
    return false;
  }
}
