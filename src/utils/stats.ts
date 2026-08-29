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
}

// ─── Fechas ───
export function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
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
  const iniISO = ini.toISOString().split('T')[0];
  const finISO = fin.toISOString().split('T')[0];
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
    const clave = lunes.toISOString().split('T')[0];
    const actual = semanasMap.get(clave) || { soles: 0, entregas: 0, fin: d.fecha };
    actual.soles += d.soles;
    actual.entregas += d.entregas;
    if (d.fecha > actual.fin) actual.fin = d.fecha;
    semanasMap.set(clave, actual);
  }
  const lunesActual = lunesDe(new Date()).toISOString().split('T')[0];
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
      });
      grupos.set(r.fecha, lista);
    }
  }
  const fechas = Array.from(grupos.keys()).sort((a, b) => b.localeCompare(a));
  return { grupos, fechas, total: Math.min(total, tope) };
}

/** S/ del día vivo (tuyo / empresa) desde la lista de clientes en curso */
export function resumenDiaVivo(clientes: any[]): { entregas: number; tuyo: number; empresa: number } {
  let entregas = 0, tuyo = 0, empresa = 0;
  for (const c of clientes || []) {
    if (!ST_ENTREGADOS.includes(c?.st)) continue;
    entregas++;
    const cobrar = parseFloat(String(c.cobrar || 0));
    if (c.st === 'mixto') {
      tuyo += parseFloat(String(c.mEf || 0));
      empresa += parseFloat(String(c.mEmp || 0));
    } else if (['empresa', 'pos', 'transferencia', 'pago-link', 'jose-smith'].includes(c.st)) {
      empresa += cobrar;
    } else {
      tuyo += cobrar;
    }
  }
  return { entregas, tuyo, empresa };
}
