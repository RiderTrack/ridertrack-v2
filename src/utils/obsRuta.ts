// ═══════════════════════════════════════════════════════════
// 📝 OBSERVACIONES DE LA RUTA — núcleo PURO (FASE W)
//
// Pedido literal: "en la parte de rutas hay una sección de
// observaciones... cuando deslizo un cliente ahí aparecen las
// observaciones pero con varios pedidos me demoraría buscando
// (hay pedidos que requieren horario u otra cosa)". Esto arma
// la lista de TODOS los clientes con observación de una — para
// leerlas juntas, copiarlas a WhatsApp o saltar al cliente.
//
// Puro como cajaCore/odometroCore: sin React ni Firebase → se
// testea directo con Node. El tipo "Like" evita importar el
// Cliente de services/firestore (que pesa Firebase).
// ═══════════════════════════════════════════════════════════

/** Lo mínimo que hace falta de un cliente para el panel de obs */
export interface ClienteObsLike {
  id: string | number;
  num?: number;
  nombre?: string;
  dist?: string;
  obs?: string;
  st?: string;
}

/**
 * Clientes con observación, en orden de ruta (num asc). Las obs
 * en blanco/solo espacios no cuentan (Excel a veces manda celdas
 * vacías con espacios).
 */
export function clientesConObs(clientes: ClienteObsLike[]): ClienteObsLike[] {
  return (clientes || [])
    .filter((c) => c && (c.obs || '').trim().length > 0)
    .sort((a, b) => (a.num || 9999) - (b.num || 9999));
}

/**
 * Texto plano para COPIAR (WhatsApp, notas, lo que sea):
 *   📝 OBSERVACIONES DE RUTA — 13 oct
 *   4 clientes con observación
 *
 *   3. María López (San Miguel) — entregar después de las 5pm
 *   7. Jorge Ramírez — dejar en recepción, no llamar
 */
export function armarTextoObservaciones(
  clientes: ClienteObsLike[],
  fechaBonita?: string
): string {
  const lista = clientesConObs(clientes);
  const L: string[] = [];
  L.push(`📝 OBSERVACIONES DE RUTA${fechaBonita ? ` — ${fechaBonita}` : ''}`);
  if (lista.length === 0) {
    L.push('Nadie tiene observaciones');
    return L.join('\n');
  }
  L.push(
    `${lista.length} ${lista.length === 1 ? 'cliente' : 'clientes'} con observación`
  );
  L.push('');
  for (const c of lista) {
    const dist = (c.dist || '').trim() ? ` (${(c.dist || '').trim()})` : '';
    L.push(`${c.num || '·'}. ${(c.nombre || 'Cliente').trim()}${dist} — ${(c.obs || '').trim()}`);
  }
  return L.join('\n');
}

/** fecha "13 oct" (es-PE) para el texto copiado */
export function fechaBonitaObs(d: Date = new Date()): string {
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
