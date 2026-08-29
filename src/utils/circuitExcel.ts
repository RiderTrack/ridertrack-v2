// ═══════════════════════════════════════════════════════════
// 🛵 FILAS DEL EXCEL DE CIRCUIT — Fix 2.18
// Lógica PURA (sin XLSX ni DOM — testeable con Node) que arma las
// filas del archivo de importación de la app Circuit (getcircuit.com,
// ahora Spoke). exportarExcel.ts la envuelve con SheetJS + la
// descarga nativa.
//
// Fix 2.18 (reporte del usuario):
//   • Si el cliente tiene una COORDENADA pegada como dirección
//     ("-12.000013,-77.108397"), va en las columnas Latitude/
//     Longitude con la Address VACÍA — la doc oficial de Circuit
//     pide "coordenadas O dirección, no ambas" (help.spoke.com
//     "How to prepare your spreadsheet for import"). Antes la
//     coordenada caía en la columna de dirección, Circuit intentaba
//     geocodificarla como texto y mandaba la parada a otro
//     distrito (Callao → Carabayllo).
//   • El costo va con 2 decimales (S/ 89.90, no S/ 90 redondeado).
// ═══════════════════════════════════════════════════════════

import { extraerCoordenadas } from './direcciones';

/** Celular → '+51XXXXXXXXX' (como el cTel de la v1) */
export function celCircuit(cel: unknown): string {
  let d = String(cel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d.startsWith('51')) d = d.substring(2);
  return `+51${d}`;
}

/** Encabezado oficial del template de importación de Circuit
 *  (las 9 columnas de siempre + Latitude/Longitude según la doc:
 *  "add the latitude and longitude coordinates OR the address
 *   field, but not both"). Siempre presentes; van vacías cuando
 *  la parada se exporta por dirección. */
export const CIRCUIT_HEADER = [
  'Recipient Name', 'Address Line 1', 'City', 'State', 'Country',
  'Zip', 'Phone', 'Notes', 'Order Number', 'Latitude', 'Longitude',
];

/** Índices de columnas (para tests y para leer filas con claridad) */
export const COL = {
  NOMBRE: 0,
  ADDRESS: 1,
  CITY: 2,
  STATE: 3,
  COUNTRY: 4,
  ZIP: 5,
  PHONE: 6,
  NOTES: 7,
  ORDER: 8,
  LAT: 9,
  LNG: 10,
} as const;

/**
 * Construye las filas del Excel de Circuit. Una fila por cliente:
 *  - Dirección normal → Address Line 1 = "dir, dist" y lat/lng vacíos
 *  - "dir" = coordenadas → lat/lng en sus columnas y Address VACÍA
 *    (regla oficial de Circuit: coordenadas O dirección, no ambas)
 *  - Costo en notas con 2 decimales (89.90 ya no se redondea)
 */
export function buildCircuitRows(clientes: any[]): (string | number)[][] {
  const rows: (string | number)[][] = [[...CIRCUIT_HEADER]];

  clientes.forEach((c, i) => {
    const tel = celCircuit(c.cel);
    const coord = extraerCoordenadas(c.dir);
    const costo = parseFloat(String(c.cobrar ?? c.precio ?? 0)) || 0;
    const notas = [
      `Cliente: ${c.nombre || 'Cliente'}`,
      `Producto: ${c.prod || '–'}`,
      `Costo: S/ ${costo.toFixed(2)}`,
      coord ? `📍 Coordenadas exactas: ${coord.lat}, ${coord.lng}` : '',
      c.obs ? `⚠️ ${c.obs}` : '',
      c.nota ? `📝 ${c.nota}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    rows.push([
      c.nombre || 'Cliente',
      coord ? '' : (c.dir || '') + (c.dist ? `, ${c.dist}` : ''),
      c.dist || 'Lima',
      'Lima',
      'Peru',
      'Lima',
      tel,
      notas,
      String(c.num || i + 1),
      coord ? coord.lat : '',
      coord ? coord.lng : '',
    ]);
  });

  return rows;
}
