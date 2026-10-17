// ═══════════════════════════════════════════════════════════
// 💰 S/ — parseo de montos PERUANOS robusto (FASE Z)
//
// POR QUÉ EXISTE: el Excel de la ruta cambia de formato entre
// días — columnas renombradas ("MONTO" en vez de "COBRAR"),
// celdas con "S/ 89.90", "S/.89,90", "1,234.56", "89,90" con
// coma decimal, o espacios. parseFloat() a secas devuelve NaN
// con cualquiera de esas formas → el cliente quedaba con
// monto 0 → el QR por cliente salía "sin monto cargado"
// (el reporte literal de Rudy al día siguiente de FASE Y).
//
// PURA (sin DOM — testeable con Node): la usan importarExcel
// y cualquier lectura de plata que venga de celdas/texto.
// ═══════════════════════════════════════════════════════════

/**
 * Parsea un monto al estilo Perú. Acepta (y limpia):
 *   · Prefijos: "S/", "S/.", "S/.", "s/", soles, espacios
 *   · 89.9 · "89.90" · 89,9 · "89,90"        (coma decimal)
 *   · "1,234.56" · "1.234,56"               (miles + decimales)
 *   · "S/ 1 234.56"                          (espacio de miles)
 *   · null / undefined / "" / "abc" → 0
 *
 * Regla de coma: si la celda tiene coma Y punto, el ÚLTIMO
 * separador es el decimal (formato peruano "1,234.56" y el
 * europeo "1.234,56" — ambos se interpretan bien). Si solo
 * hay coma, es decimal ("89,90" → 89.90).
 */
export function parseMonedaPeru(valor: unknown): number {
  if (typeof valor === 'number') {
    // number ya parseado (viene directo de XLSX o Firestore)
    return Number.isFinite(valor) ? valor : 0;
  }
  let s = String(valor ?? '').trim();
  if (!s) return 0;

  // quitar moneda/símbolos/espacios (S/ S/. soles ¢ $)
  s = s.replace(/s\/\.?\s*/gi, '').replace(/soles?/gi, '').replace(/[$]/gi, '');
  s = s.replace(/\s+/g, '').replace(/'/g, '');

  if (!s || s === '-' || s === '.' || s === ',') return 0;

  const tieneComa = s.includes(',');
  const tienePunto = s.includes('.');

  if (tieneComa && tienePunto) {
    // el ÚLTIMO separador es el decimal; el otro es de miles
    const posComa = s.lastIndexOf(',');
    const posPunto = s.lastIndexOf('.');
    if (posPunto > posComa) {
      // "1,234.56" → miles con coma, decimal con punto
      s = s.replace(/,/g, '');
    } else {
      // "1.234,56" → miles con punto, decimal con coma
      s = s.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (tieneComa) {
    // solo coma → decimal ("89,90" o miles enteros "1,234")
    // si hay MÁS de una coma son miles: "1,234,567"
    const partes = s.split(',');
    s = partes.length > 2 ? partes.join('') : s.replace(',', '.');
  }
  // solo punto → parseFloat normal ("89.90" / "1.234" ya raro, lo tomamos tal cual)

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Mapea los montos de una fila cruda del Excel (o de cualquier
 * objeto cliente) con la CADENA DE RESPALDO de la app:
 *   cobrar = celda COBRAR (o alias) ─┐ si falla/0 ─→ celda PRECIO
 *   precio = celda PRECIO (o alias) ─┘ si falla/0 ─→ celda COBRAR
 *
 * Así el monto NUNCA queda en 0 si una de las dos columnas
 * trae la plata (el bug de Rudy: hoy una columna, mañana otra).
 */
export function montosConRespaldo(
  crudoCobrar: unknown,
  crudoPrecio: unknown
): { cobrar: number; precio: number } {
  const cobrar = parseMonedaPeru(crudoCobrar);
  const precio = parseMonedaPeru(crudoPrecio);
  return {
    cobrar: cobrar > 0 ? cobrar : precio,
    precio: precio > 0 ? precio : cobrar,
  };
}

/** Nombres de columna que la app acepta para el MONTO A COBRAR
 *  (además de 'cobrar'): el Excel de la empresa los renombra
 *  entre días — 'total', 'monto', 'pagar'… todos significan
 *  lo mismo: la plata que ese cliente debe. */
export const ALIAS_COL_COBRAR = ['cobrar', 'monto', 'total', 'pagar', 'deuda', 'importe', 'a cobrar', 'por cobrar', 'pagará'];

/** Nombres aceptados para PRECIO (alias de siempre + rescue). */
export const ALIAS_COL_PRECIO = ['precio', 'costo', 'valor', 'unitario', 'precio unitario'];
