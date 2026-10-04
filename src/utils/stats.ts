// ═══════════════════════════════════════════════════════════
// 🧮 STATS CORE — RiderTrack V2 (Fase 2.16)
// Motor de cálculo puro de las Estadísticas y la Galería.
// Vive separado de la vista para poder testearlo con Node
// sin Firebase ni React (mismo patrón que etaRuta.ts).
// ═══════════════════════════════════════════════════════════

// ─── Estados oficiales (listas de RutaView) ───
export const ST_ENTREGADOS = [
  'efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos',
  'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio',
];

/** st que fallaron (nunca se cobraron) */
export const ST_FALLIDOS = ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'];

/** ⚡ F3.50 — st que cobra la EMPRESA directa: NUNCA pasan por el
 *  bolsillo del rider. La regla del usuario es EXPLÍCITA:
 *  "solo efectivo y yape son míos, TODAS las demás son de empresa".
 *  El bug del que nació esta fase: 'yape-plin' faltaba en las listas
 *  de firestore.ts y stats.ts → al finalizar la ruta, la plata del
 *  yape-plin de la empresa se sumaba como EFECTIVO DEL RIDER y le
 *  descuadraba la caja (le "faltaban" S/ 60 al cuadrar). */
export const ST_EMPRESA = ['empresa', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith'];

/** st que la cobra el RIDER (efectivo en caja, su yape, o cambio) */
export const ST_RIDER = ['efectivo', 'yape-rudy', 'cambio'];

export const ETIQUETAS_METODO: Record<string, string> = {
  'efectivo': '💵 Efectivo',
  'yape-rudy': '📱 Yape Rudy',
  'yape-efectivo': '💜 Yape+Efectivo',
  'mixto': '🔀 Mixto',
  'pos': '💳 POS',
  'transferencia': '🏦 Transferencia',
  'yape-plin': '📲 Yape/Plin',
  'pago-link': '🔗 Pago Link',
  'jose-smith': '🤝 José Smith',
  'empresa': '🏪 Empresa',
  'cambio': '🔄 Cambio',
};

// ─── Tipos ───
export interface RegistroLike {
  id: string;
  uid?: string;
  fecha?: string;             // YYYY-MM-DD
  cobradoTotal?: number;
  entregados?: number;
  totalRider?: number;
  totalEmpresa?: number;
  porMetodo?: Record<string, number>;
  km?: number;
  tiempoRuta?: number;        // ms
  clientes?: any[];
}

/** Registro virtual "hoy en curso" que arma la vista con la ruta viva */
export function registroHoyVivo(
  uid: string,
  entregas: number,
  tuyo: number,
  empresa: number,
): RegistroLike {
  return {
    id: '_hoy_vivo_',
    uid,
    fecha: hoyISO(),
    cobradoTotal: tuyo + empresa,
    entregados: entregas,
    totalRider: tuyo,
    totalEmpresa: empresa,
    clientes: [],
  };
}

// ── ⚡ F3.50: DESGLOSE DE COBROS — única fuente de verdad ──

export interface DesgloseCobros {
  entregados: number;
  fallidos: number;
  /** S/ que pasan por el RIDER (efectivo, yape-rudy, cambio, parte
   *  efectivo del mixto, yape-efectivo con vuelto descontado) */
  totalRider: number;
  /** S/ que cobra la EMPRESA directa (pos, transferencia, yape-plin,
   *  pago-link, jose-smith, empresa, parte digital del mixto) */
  totalEmpresa: number;
  /** S/ por método ('efectivo': 120, 'yape-plin': 60, …) */
  porMetodo: Record<string, number>;
  /** totalRider + totalEmpresa */
  cobradoTotal: number;
}

/**
 * ⚡ F3.50 — Calcula el desglose tuyo/empresa de una lista de
 * clientes con las REGLAS CORRECTAS. Es la ÚNICA fuente de verdad:
 * la usan finalizarRuta (firestore.ts, al cerrar la ruta),
 * resumenDiaVivo (estadísticas en vivo) y conTotalesCorregidos
 * (repara rutas viejas mal guardadas al leerlas).
 *
 * Reglas (las de siempre + el fix del yape-plin):
 *   · mixto        → la parte efectivo (mEf) es tuya, la digital
 *                    (mEmp) la cobra la empresa (como la v1)
 *   · yape-efectivo→ mEf + mYp − vuelto (mVt), lo que queda es tuyo
 *   · ST_EMPRESA   → TODO a la empresa (pos, transferencia,
 *                    YAPE-PLIN ← el fix, pago-link, jose-smith, empresa)
 *   · ST_RIDER     → todo tuyo (efectivo, yape-rudy, cambio)
 *   · entregado desconocido → a la empresa: NUNCA inventamos
 *     efectivo del rider (misma regla de seguridad de cajaCore)
 */
export function desglosarCobros(clientes: any[]): DesgloseCobros {
  let entregados = 0, fallidos = 0;
  let totalRider = 0, totalEmpresa = 0;
  const porMetodo: Record<string, number> = {};

  for (const c of clientes || []) {
    const st = String(c?.st || '');
    if (ST_FALLIDOS.includes(st)) { fallidos++; continue; }
    if (!ST_ENTREGADOS.includes(st)) continue; // pendientes y otros
    entregados++;
    const cobrar = parseFloat(String(c.cobrar || 0));

    if (st === 'mixto') {
      // Como la v1: la parte en efectivo es tuya, la parte digital
      // la cobra la empresa
      const mEf = parseFloat(String(c.mEf || 0));
      const mEmp = parseFloat(String(c.mEmp || 0));
      porMetodo['mixto'] = (porMetodo['mixto'] || 0) + mEf;
      totalRider += mEf;
      totalEmpresa += mEmp;
    } else if (st === 'yape-efectivo') {
      // Como la v1: efectivo + yape − vuelto entregado
      const m = Math.max(0, parseFloat(String(c.mEf || 0)) + parseFloat(String(c.mYp || 0)) - parseFloat(String(c.mVt || 0)));
      porMetodo['yape-efectivo'] = (porMetodo['yape-efectivo'] || 0) + m;
      totalRider += m;
    } else if (ST_EMPRESA.includes(st)) {
      porMetodo[st] = (porMetodo[st] || 0) + cobrar;
      totalEmpresa += cobrar;
    } else if (ST_RIDER.includes(st)) {
      porMetodo[st] = (porMetodo[st] || 0) + cobrar;
      totalRider += cobrar;
    } else {
      // Entregado con método desconocido → empresa (no inventar
      // efectivo del rider: que no le vuelva a "faltar" plata)
      porMetodo[st] = (porMetodo[st] || 0) + cobrar;
      totalEmpresa += cobrar;
    }
  }

  return {
    entregados,
    fallidos,
    totalRider,
    totalEmpresa,
    porMetodo,
    cobradoTotal: totalRider + totalEmpresa,
  };
}

/**
 * ⚡ F3.50 — REPARA rutas viejas mal guardadas (al leerlas).
 * Las rutas cerradas ANTES de esta fase guardaron totalRider/
 * totalEmpresa/porMetodo con el bug del yape-plin (contado como
 * efectivo del rider). Este función recalcula la PLATA desde el
 * snapshot de clientes de cada ruta — que siempre estuvo completo
 * — y devuelve el registro con los totales CORREGIDOS. Así la ruta
 * de HOY que ya cerraste se ve bien en Historial y Estadísticas sin
 * tocar la base de datos. Los conteos (entregados/fallidos/
 * pendientes) se respetan del documento original.
 */
export function conTotalesCorregidos<T extends RegistroLike>(reg: T): T {
  const cl = reg?.clientes;
  if (!Array.isArray(cl) || cl.length === 0) return reg;
  const d = desglosarCobros(cl);
  return {
    ...reg,
    totalRider: d.totalRider,
    totalEmpresa: d.totalEmpresa,
    porMetodo: d.porMetodo,
    cobradoTotal: d.cobradoTotal,
  };
}

export interface DiaAgregado {
  fecha: string;          // YYYY-MM-DD
  etiqueta: string;       // "28 ago"
  soles: number;
  entregas: number;
  tuyo: number;
  empresa: number;
  enCurso?: boolean;      // incluye la ruta de HOY sin cerrar
}

export interface FotoHistorial {
  url: string;
  nombre: string;
  prod: string;
  cobrar: number;
  st: string;
  hora: string;
  dist: string;
  fecha: string; // YYYY-MM-DD
  /** celular del cliente (Fase 3.9 — enviar la foto por el bot) */
  cel?: string;
}

// ─── Fechas ───
// ⚡ F3.48 — FIX "EL DÍA COMIDO": antes se usaba new Date().toISOString()
// que devuelve la fecha en UTC (hora de Londres). Lima está 5 horas
// atrás, así que desde las 7:00 pm la app "creía" que ya era MAÑANA:
// una ruta cerrada a las 8 pm del miércoles se guardaba como jueves.
// La v1 nunca tuvo este bug porque usaba la hora del celular.
// Ahora TODO el app pregunta la fecha en HORA DE LIMA (America/Lima).
const _fmtLima = (() => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return null; // WebView muy viejo → usar respaldo local
  }
})();

/** Fecha ISO (YYYY-MM-DD) de un Date en HORA DE LIMA — nunca UTC */
export function fechaLimaISO(d: Date = new Date()): string {
  if (_fmtLima) {
    try {
      const s = _fmtLima.format(d); // 'en-CA' da "YYYY-MM-DD"
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    } catch { /* cae al respaldo */ }
  }
  // Respaldo: hora del dispositivo (lo que hacía la v1 — nunca come un día)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** HOY en Lima (YYYY-MM-DD) — la única forma correcta de preguntar el día */
export function hoyISO(): string {
  return fechaLimaISO(new Date());
}

/** lunes de la semana de la fecha dada (semana peruana: lunes a domingo) */
export function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0=domingo
  const dif = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + dif);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES_CORTOS[(m || 1) - 1]}`;
}

export function fechaLarga(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const f = new Date(y, (m || 1) - 1, d);
    // NaN o fecha inválida → devolver tal cual (toLocaleDateString
    // NO lanza con NaN, devuelve "Invalid Date")
    if (!y || !m || !d || isNaN(f.getTime())) return iso;
    return f.toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  } catch {
    return iso;
  }
}

// ─── Agregación por día ───
/**
 * Suma los registros por fecha (varias rutas el mismo día se acumulan)
 * dentro del periodo [desdeISO .. hoy]. Los registros sin fecha se
 * ignoran. Marca `enCurso` el día que tiene el registro virtual _hoy_vivo_.
 */
export function agregarPorDias(registros: RegistroLike[], desdeISO: string): DiaAgregado[] {
  const mapa = new Map<string, DiaAgregado>();
  for (const r of registros) {
    if (!r.fecha || r.fecha < desdeISO) continue;
    const actual = mapa.get(r.fecha) || {
      fecha: r.fecha,
      etiqueta: fechaCorta(r.fecha),
      soles: 0, entregas: 0, tuyo: 0, empresa: 0, enCurso: false,
    };
    actual.soles += Number(r.cobradoTotal) || 0;
    actual.entregas += Number(r.entregados) || 0;
    actual.tuyo += Number(r.totalRider) || 0;
    actual.empresa += Number(r.totalEmpresa) || 0;
    if (r.id === '_hoy_vivo_') actual.enCurso = true;
    mapa.set(r.fecha, actual);
  }
  return Array.from(mapa.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Suma km y tiempo de los registros cuyas fechas están en `dias` */
export function sumarKmYTiempo(registros: RegistroLike[], dias: DiaAgregado[]): { km: number; tiempoMs: number } {
  const fechas = new Set(dias.map(d => d.fecha));
  let km = 0, tiempoMs = 0;
  for (const r of registros) {
    if (!r.fecha || !fechas.has(r.fecha)) continue;
    km += Number(r.km) || 0;
    tiempoMs += Number(r.tiempoRuta) || 0;
  }
  return { km, tiempoMs };
}

// ─── Comparativa semana vs semana ───
export interface ComparativaSemanas {
  esta: { soles: number; entregas: number };
  anterior: { soles: number; entregas: number };
  deltaSoles: number | null;    // % (null = sin datos previos)
  deltaEntregas: number | null;
  primeraSemana: boolean;       // no hay semana anterior con datos
}

function rangoDe(dias: DiaAgregado[], ini: Date, fin: Date) {
  // ⚡ F3.48: límites de la semana en hora de Lima (antes UTC)
  const iniISO = fechaLimaISO(ini);
  const finISO = fechaLimaISO(fin);
  const delRango = dias.filter(d => d.fecha >= iniISO && d.fecha <= finISO);
  return {
    soles: delRango.reduce((s, d) => s + d.soles, 0),
    entregas: delRango.reduce((s, d) => s + d.entregas, 0),
  };
}

/**
 * Compara la semana en curso (lunes → hoy) contra la semana pasada
 * completa. delta = (esta-anterior)/anterior*100; null si anterior=0.
 */
export function compararSemanas(dias: DiaAgregado[]): ComparativaSemanas {
  const lunesEsta = lunesDe(new Date());
  const lunesAnterior = new Date(lunesEsta);
  lunesAnterior.setDate(lunesAnterior.getDate() - 7);

  const hoy = new Date(); hoy.setHours(23, 59, 59, 999);
  const esta = rangoDe(dias, lunesEsta, hoy);
  const anterior = rangoDe(dias, lunesAnterior, new Date(lunesEsta.getTime() - 1));

  const delta = (a: number, b: number): number | null => (b > 0 ? ((a - b) / b) * 100 : null);
  return {
    esta,
    anterior,
    deltaSoles: delta(esta.soles, anterior.soles),
    deltaEntregas: delta(esta.entregas, anterior.entregas),
    primeraSemana: anterior.soles === 0 && anterior.entregas === 0 && esta.soles > 0,
  };
}

// ─── Métodos de pago acumulados ───
export function acumularMetodos(
  registros: RegistroLike[],
  desdeISO: string,
): { name: string; value: number }[] {
  const acumulado: Record<string, number> = {};
  for (const r of registros) {
    if (!r.fecha || r.fecha < desdeISO) continue;
    const pm = (r.porMetodo as Record<string, number>) || {};
    for (const [metodo, montoRaw] of Object.entries(pm)) {
      const monto = Number(montoRaw) || 0;
      if (monto > 0) acumulado[metodo] = (acumulado[metodo] || 0) + monto;
    }
  }
  return Object.entries(acumulado)
    .map(([metodo, monto]) => ({ name: ETIQUETAS_METODO[metodo] || metodo, value: parseFloat(monto.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

// ─── Récords ───
export interface Records {
  mejorDia: DiaAgregado;
  masEntregas: DiaAgregado;
  /** [lunesISO, {soles, entregas, fin}] de la mejor semana CERRADA */
  mejorSemana: [string, { soles: number; entregas: number; fin: string }] | null;
}

export function calcularRecords(dias: DiaAgregado[]): Records | null {
  if (dias.length === 0) return null;
  const mejorDia = [...dias].sort((a, b) => b.soles - a.soles)[0];
  const masEntregas = [...dias].sort((a, b) => b.entregas - a.entregas)[0];

  // semanas completas (lunes a domingo) — la semana EN CURSO no compite
  const semanasMap = new Map<string, { soles: number; entregas: number; fin: string }>();
  for (const d of dias) {
    const [y, m, dd] = d.fecha.split('-').map(Number);
    const lunes = lunesDe(new Date(y, m - 1, dd));
    const clave = fechaLimaISO(lunes); // ⚡ F3.48: lunes en Lima, no UTC
    const actual = semanasMap.get(clave) || { soles: 0, entregas: 0, fin: d.fecha };
    actual.soles += d.soles;
    actual.entregas += d.entregas;
    if (d.fecha > actual.fin) actual.fin = d.fecha;
    semanasMap.set(clave, actual);
  }
  const lunesActual = fechaLimaISO(lunesDe(new Date())); // ⚡ F3.48
  const cerradas = Array.from(semanasMap.entries()).filter(([clave]) => clave !== lunesActual);
  const mejorSemana = cerradas.length > 0
    ? cerradas.sort((a, b) => b[1].soles - a[1].soles)[0]
    : null;

  return { mejorDia, masEntregas, mejorSemana };
}

// ─── Galería: fotos de la ruta viva (hoy) ───
export interface FotoHoy {
  conFoto: FotoHistorial[];
  sinFoto: any[];   // clientes entregados sin foto (objetos Cliente tal cual)
}

/** Separa los clientes entregados de HOY en con foto / sin foto */
export function partirHoy(clientes: any[]): FotoHoy {
  const conFoto: FotoHistorial[] = [];
  const sinFoto: any[] = [];
  for (const c of clientes || []) {
    if (!ST_ENTREGADOS.includes(c?.st)) continue;
    const base = {
      nombre: c.nombre || 'Cliente',
      prod: c.prod || '',
      cobrar: parseFloat(String(c.cobrar || 0)),
      st: c.st,
      hora: c.hora || '',
      dist: c.dist || '',
      fecha: hoyISO(),
      cel: c.cel || '',
    };
    if (c.fotoUrl) conFoto.push({ ...base, url: c.fotoUrl });
    else sinFoto.push(c);
  }
  return { conFoto, sinFoto };
}

/** Colecciona las fotos de los registros cerrados, agrupadas por fecha (desc) */
export function fotosDeHistorial(
  registros: RegistroLike[],
  tope = 300,
): { grupos: Map<string, FotoHistorial[]>; fechas: string[]; total: number } {
  const grupos = new Map<string, FotoHistorial[]>();
  let total = 0;
  for (const r of registros) {
    if (!r.clientes || !r.fecha) continue;
    for (const c of r.clientes) {
      if (!c?.fotoUrl) continue;
      total++;
      if (total > tope) break;
      const lista = grupos.get(r.fecha) || [];
      lista.push({
        url: c.fotoUrl,
        nombre: c.nombre || 'Cliente',
        prod: c.prod || '',
        cobrar: parseFloat(String(c.cobrar || 0)),
        st: c.st || '',
        hora: c.hora || '',
        dist: c.dist || '',
        fecha: r.fecha,
        cel: c.cel || '',
      });
      grupos.set(r.fecha, lista);
    }
  }
  const fechas = Array.from(grupos.keys()).sort((a, b) => b.localeCompare(a));
  return { grupos, fechas, total: Math.min(total, tope) };
}

/** S/ del día vivo (tuyo / empresa) desde la lista de clientes en curso */
export function resumenDiaVivo(clientes: any[]): { entregas: number; tuyo: number; empresa: number } {
  // ⚡ F3.50: usa desglosarCobros — misma fuente de verdad que el
  // cierre de ruta. ANTES tenía su propia lista de empresa SIN
  // 'yape-plin' → las estadísticas en vivo contaban el yape-plin de
  // la empresa como plata TUYA.
  const d = desglosarCobros(clientes);
  return { entregas: d.entregados, tuyo: d.totalRider, empresa: d.totalEmpresa };
}
