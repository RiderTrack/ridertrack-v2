// ═══════════════════════════════════════════════════════════
// 📊 DriverTrack — Motor de estadísticas (F-ID4)
// Funciones PURAS sobre la lista de viajes (fácil de testear):
//   · Zonas de oro: dónde ganás más (agrupa y normaliza zonas)
//   · Horas de oro: a qué hora sale la plata (24 baldes)
//   · Precio piso: tu S/ por km REAL → mínimo a aceptar
//   · Curva por día, comparativa semanal y récords
// Regla de honestidad (heredada de Caja/km): el S/ por km SOLO
// mezcla la plata de los viajes GRABADOS con GPS — mezclar los
// sin GPS infla el número y el precio piso te haría trabajar barato.
// ═══════════════════════════════════════════════════════════

import { Viaje } from '../types';

export type PeriodoStats = 'hoy' | '7d' | '30d' | 'todo';

/** Suma (o resta) días a una fecha YYYY-MM-DD → YYYY-MM-DD (hora local) */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Fecha mínima (inclusive) del período — null = todo */
export function desdePeriodo(p: PeriodoStats, hoy: string): string | null {
  if (p === 'hoy') return hoy;
  if (p === '7d') return sumarDias(hoy, -6);
  if (p === '30d') return sumarDias(hoy, -29);
  return null;
}

export function filtrarPeriodo(viajes: Viaje[], p: PeriodoStats, hoy: string): Viaje[] {
  const desde = desdePeriodo(p, hoy);
  if (!desde) return viajes;
  // YYYY-MM-DD compara bien como string (lexicográfico = cronológico)
  return viajes.filter(v => v.fecha >= desde && v.fecha <= hoy);
}

// ── 🏆 Zonas de oro ─────────────────────────────────────────

export interface ZonaStat {
  zona: string;      // como se muestra (la variante más usada)
  clave: string;     // clave de agrupación (minúsculas, sin puntos)
  n: number;
  neto: number;
  promedio: number;  // neto / n
  esSinZona: boolean;
}

/** "Surco", "surco " y "Surco." son LA MISMA zona — el escáner y
 *  el tipeo manual escriben distinto. Agrupa por clave normalizada
 *  y muestra la variante que más veces apareció. */
export function agregarZonas(viajes: Viaje[]): ZonaStat[] {
  const grupos = new Map<string, { variantes: Map<string, number>; n: number; neto: number }>();
  for (const v of viajes) {
    const clave = (v.zona ?? '').trim().toLowerCase().replace(/\.+$/, '').replace(/\s+/g, ' ');
    let g = grupos.get(clave);
    if (!g) {
      g = { variantes: new Map(), n: 0, neto: 0 };
      grupos.set(clave, g);
    }
    g.n++;
    g.neto += v.neto;
    const talCual = (v.zona ?? '').trim();
    if (talCual) g.variantes.set(talCual, (g.variantes.get(talCual) ?? 0) + 1);
  }
  const stats: ZonaStat[] = [];
  for (const [clave, g] of grupos) {
    // la variante más tipeada gana (empate → la primera que se vio)
    let zona = '';
    let max = -1;
    for (const [texto, veces] of g.variantes) {
      if (veces > max) {
        max = veces;
        zona = texto;
      }
    }
    stats.push({
      zona: clave === '' ? '(sin zona)' : zona,
      clave,
      n: g.n,
      neto: g.neto,
      promedio: g.neto / g.n,
      esSinZona: clave === '',
    });
  }
  // por neto descendente; "(sin zona)" siempre al fondo (no compite por la corona)
  stats.sort((a, b) =>
    a.esSinZona !== b.esSinZona ? (a.esSinZona ? 1 : -1) : b.neto - a.neto || b.n - a.n,
  );
  return stats;
}

// ── ⏰ Horas de oro ─────────────────────────────────────────

export interface HoraBucket {
  hora: number;   // 0..23
  neto: number;
  n: number;
}

/** 24 baldes SIEMPRE (0..23) — así el gráfico no cambia de forma */
export function agregarHoras(viajes: Viaje[]): HoraBucket[] {
  const buckets: HoraBucket[] = Array.from({ length: 24 }, (_, h) => ({ hora: h, neto: 0, n: 0 }));
  for (const v of viajes) {
    const h = parseInt((v.hora ?? '').split(':')[0] ?? '', 10);
    if (Number.isNaN(h) || h < 0 || h > 23) continue;
    buckets[h].neto += v.neto;
    buckets[h].n++;
  }
  return buckets;
}

/** Las 3 horas con más plata (solo baldes con neto > 0) */
export function horasDeOro(buckets: HoraBucket[]): number[] {
  return buckets
    .filter(b => b.neto > 0)
    .sort((a, b) => b.neto - a.neto)
    .slice(0, 3)
    .map(b => b.hora)
    .sort((a, b) => a - b);
}

// ── 📈 Curva por día ────────────────────────────────────────

export interface DiaStat {
  fecha: string; // YYYY-MM-DD
  neto: number;
  n: number;
}

/** Serie CONTINUA de días (llena los días sin viajes con 0) entre
 *  desde..hoy para que la curva no mienta con huecos. Si el rango
 *  es enorme (período "todo"), muestra los últimos máx 30 días. */
export function serieDias(viajes: Viaje[], desde: string, hoy: string, maxDias = 30): DiaStat[] {
  let inicio = desde;
  if (diasEntre(inicio, hoy) > maxDias) inicio = sumarDias(hoy, -(maxDias - 1));
  const porFecha = new Map<string, DiaStat>();
  for (const v of viajes) {
    const d = porFecha.get(v.fecha) ?? { fecha: v.fecha, neto: 0, n: 0 };
    d.neto += v.neto;
    d.n++;
    porFecha.set(v.fecha, d);
  }
  const serie: DiaStat[] = [];
  for (let f = inicio; f <= hoy; f = sumarDias(f, 1)) {
    serie.push(porFecha.get(f) ?? { fecha: f, neto: 0, n: 0 });
  }
  return serie;
}

function diasEntre(desde: string, hoy: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hoy.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000) + 1;
}

// ── 📊 Métricas del período ─────────────────────────────────

export interface MetricasStats {
  n: number;
  neto: number;
  km: number;            // km reales del período
  nConGps: number;       // viajes grabados con GPS
  sPorKm: number;        // HONESTO: solo neto de viajes CON km / sus km
  dias: number;          // días con al menos 1 viaje
  promedioDia: number;   // neto / dias
  sPorViaje: number;     // neto / n
  horasMov: number;      // horas en movimiento (duracionSeg de los grabados)
  sPorHora: number;      // neto de los grabados / horasMov
}

export function metricas(viajes: Viaje[]): MetricasStats {
  const n = viajes.length;
  const neto = viajes.reduce((s, v) => s + v.neto, 0);
  const conGps = viajes.filter(v => (v.kmGPS ?? 0) > 0);
  const km = conGps.reduce((s, v) => s + v.kmGPS, 0);
  const netoGps = conGps.reduce((s, v) => s + v.neto, 0);
  const horasMov = conGps.reduce((s, v) => s + (v.duracionSeg ?? 0), 0) / 3600;
  const dias = new Set(viajes.map(v => v.fecha)).size;
  return {
    n,
    neto,
    km,
    nConGps: conGps.length,
    sPorKm: km > 0 ? netoGps / km : 0,
    dias,
    promedioDia: dias > 0 ? neto / dias : 0,
    sPorViaje: n > 0 ? neto / n : 0,
    horasMov,
    sPorHora: horasMov > 0 ? netoGps / horasMov : 0,
  };
}

// ── 💰 Precio piso ──────────────────────────────────────────

/** Lo mínimo por un viaje de X km: tu S/ por km REAL redondeado
 *  hacia ARRIBA a S/ 0.50 (para que sea fácil de cobrar en la
 *  calle). Nunca menos de S/ 0.50. */
export function precioPiso(sPorKm: number, km: number): number {
  if (sPorKm <= 0 || km <= 0) return 0;
  return Math.max(0.5, Math.ceil(sPorKm * km * 2) / 2);
}

// ── 📅 Semana vs semana ─────────────────────────────────────

export interface ComparativaSemana {
  actual: { n: number; neto: number };
  previa: { n: number; neto: number };
  diffPct: number | null; // null = semana anterior sin plata
}

/** Fija en el tiempo: últimos 7 días vs los 7 anteriores (no
 *  depende del chip de período — siempre responde "¿voy mejor?") */
export function comparativaSemanal(viajes: Viaje[], hoy: string): ComparativaSemana {
  const actual = viajes.filter(v => v.fecha >= sumarDias(hoy, -6) && v.fecha <= hoy);
  const previa = viajes.filter(v => v.fecha >= sumarDias(hoy, -13) && v.fecha <= sumarDias(hoy, -7));
  const a = { n: actual.length, neto: actual.reduce((s, v) => s + v.neto, 0) };
  const p = { n: previa.length, neto: previa.reduce((s, v) => s + v.neto, 0) };
  return {
    actual: a,
    previa: p,
    diffPct: p.neto > 0 ? ((a.neto - p.neto) / p.neto) * 100 : null,
  };
}

// ── 🏆 Récords (sobre TODA la historia, no del chip) ────────

export interface RecordsStats {
  mejorDia: DiaStat | null;      // más plata en un día
  diaMasViajes: DiaStat | null;  // más viajes en un día
}

export function records(viajes: Viaje[]): RecordsStats {
  const porFecha = new Map<string, DiaStat>();
  for (const v of viajes) {
    const d = porFecha.get(v.fecha) ?? { fecha: v.fecha, neto: 0, n: 0 };
    d.neto += v.neto;
    d.n++;
    porFecha.set(v.fecha, d);
  }
  let mejorDia: DiaStat | null = null;
  let diaMasViajes: DiaStat | null = null;
  for (const d of porFecha.values()) {
    if (!mejorDia || d.neto > mejorDia.neto) mejorDia = d;
    if (!diaMasViajes || d.n > diaMasViajes.n) diaMasViajes = d;
  }
  return { mejorDia, diaMasViajes };
}
