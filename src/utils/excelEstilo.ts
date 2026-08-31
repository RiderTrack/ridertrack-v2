// ═══════════════════════════════════════════════════════════
// 🎨 EXCEL ESTILO v1 — Fase 3.8
//
// El usuario reportó: "en la versión 1 cuando descargaba el Excel
// salía todo con sus cuadros, colores, ordenado, todo bonito".
// La v1 lo hacía con EXCELJS (cdnjs 4.3.0) — la v2 usaba SheetJS
// plano que NO soporta estilos. Este módulo es el PUERTO EXACTO
// de los helpers de la v1 (js/main.js → _xlsFill/_xlsBorde/
// _xlsFB/_xlsFN + la paleta de colores) para que los Excel de la
// v2 salgan IDÉNTICOS a los de la v1.
// ═══════════════════════════════════════════════════════════

import ExcelJS from 'exceljs';

// ── Paleta de la v1 (js/main.js → var C={...}) ──
export const PALETA_V1 = {
  titBg: '1A237E',      // azul oscuro — título
  hdrBg: '283593',      // azul — encabezado de tabla
  loTuyoBg: '1B5E20',   // verde oscuro — sección LO TUYO
  totTuyoBg: 'F57F17',  // naranja — total lo tuyo
  empresaBg: '0D47A1',  // azul — sección EMPRESA
  fallidoBg: 'B71C1C',  // rojo — sección FALLIDOS
  granTotBg: '263238',  // gris oscuro — gran total
  alt1: 'E8F5E9',       // verde claro — fila par (lo tuyo)
  alt2: 'C8E6C9',       // verde — fila impar (lo tuyo)
  empRow: 'E3F2FD',     // azul claro — fila empresa
  fal1: 'FFEBEE',       // rojo claro — fila par (fallidos)
  fal2: 'FFCDD2',       // rojo — fila impar (fallidos)
  fg: 'FFFFFF',         // blanco — texto sobre fondos oscuros
  dark: '000000',       // negro — texto normal
  border: 'BDBDBD',     // gris — bordes
};

// ── Helpers (idénticos a la v1) ──

/** Relleno sólido con color hex (sin #) */
export function xlsFill(hex: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } };
}

/** Borde fino en los 4 lados */
export function xlsBorde(color: string): Partial<ExcelJS.Borders> {
  const s: ExcelJS.Border = { style: 'thin', color: { argb: 'FF' + color } };
  return { top: s, bottom: s, left: s, right: s };
}

/** Fuente en negrita (títulos, totales) */
export function xlsFB(hex: string, size = 10): Partial<ExcelJS.Font> {
  return { bold: true, color: { argb: 'FF' + hex }, size, name: 'Calibri' };
}

/** Fuente normal (celdas de datos) */
export function xlsFN(hex: string, size = 10): Partial<ExcelJS.Font> {
  return { color: { argb: 'FF' + hex }, size, name: 'Calibri' };
}

/** Formato de moneda de la v1: S/ 1,234.56 */
export const FMT_SOL = '"S/ "#,##0.00';

/** Celdas combinadas de una fila completa (1..totalCols) */
export function combinarFila(ws: ExcelJS.Worksheet, row: ExcelJS.Row, totalCols: number): void {
  ws.mergeCells(row.number, 1, row.number, totalCols);
}

/**
 * Fila de TÍTULO grande (como el "RUTA DEL DÍA — fecha" de la v1):
 * combinada, fondo azul oscuro, texto blanco centrado.
 */
export function filaTitulo(ws: ExcelJS.Worksheet, texto: string, totalCols: number, altura = 24): ExcelJS.Row {
  const row = ws.addRow([texto, ...Array(totalCols - 1).fill('')]);
  row.height = altura;
  combinarFila(ws, row, totalCols);
  const c = row.getCell(1);
  c.fill = xlsFill(PALETA_V1.titBg);
  c.font = xlsFB(PALETA_V1.fg, 16);
  c.alignment = { horizontal: 'center', vertical: 'middle' };
  return row;
}

/**
 * Fila de SECCIÓN (como "💚 LO TUYO — Cobros del día" de la v1):
 * combinada, fondo de color, texto blanco en negrita a la izquierda.
 */
export function filaSeccion(ws: ExcelJS.Worksheet, texto: string, bg: string, totalCols: number, altura = 18): ExcelJS.Row {
  const row = ws.addRow([texto, ...Array(totalCols - 1).fill('')]);
  row.height = altura;
  combinarFila(ws, row, totalCols);
  const c = row.getCell(1);
  c.fill = xlsFill(bg);
  c.font = xlsFB(PALETA_V1.fg, 12);
  c.alignment = { horizontal: 'left', vertical: 'middle' };
  return row;
}

/** Fila de encabezado de tabla: fondo azul, blanco, centrado, bordes */
export function filaEncabezado(ws: ExcelJS.Worksheet, headers: string[], altura = 20): ExcelJS.Row {
  const row = ws.addRow(headers);
  row.height = altura;
  row.eachCell((cell) => {
    cell.fill = xlsFill(PALETA_V1.hdrBg);
    cell.font = xlsFB(PALETA_V1.fg, 10);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = xlsBorde(PALETA_V1.border);
  });
  return row;
}

/** Fila de TOTAL: combinada 1..(cols-1), monto en la última col pasada */
export function filaTotal(
  ws: ExcelJS.Worksheet,
  label: string,
  monto: number,
  bg: string,
  totalCols: number,
  colMonto = totalCols,
  altura = 17,
  fmt = FMT_SOL,
): ExcelJS.Row {
  const vacios = Array(totalCols - 1).fill('');
  const row = ws.addRow([label, ...vacios.slice(0, colMonto - 2), monto, ...Array(totalCols - colMonto).fill('')]);
  row.height = altura;
  if (colMonto > 1) ws.mergeCells(row.number, 1, row.number, colMonto - 1);
  row.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill = xlsFill(bg);
    cell.font = xlsFB(PALETA_V1.fg, 11);
    cell.border = xlsBorde(PALETA_V1.border);
    cell.alignment = { horizontal: cn === colMonto ? 'right' : 'left', vertical: 'middle' };
    if (cn === colMonto) cell.numFmt = fmt;
  });
  return row;
}

/** Autoajuste de anchos por contenido (con topes, como la v1) */
export function autoAjustarColumnas(ws: ExcelJS.Worksheet, maxWidths: number[]): void {
  ws.columns.forEach((col, idx) => {
    let max = 8;
    col.eachCell({ includeEmpty: false }, (cell) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((cell as any).isMerged) return;
      const v = cell.value ? String(cell.value).replace(/[^\x00-\x7F]/g, '') : '';
      if (v.length > max) max = v.length;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (col as any).width = Math.min(max + 2, maxWidths[idx] || 30);
  });
}

/** Blob listo para descargar/compartir */
export function excelABlob(buffer: ExcelJS.Buffer): Blob {
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export { ExcelJS };
