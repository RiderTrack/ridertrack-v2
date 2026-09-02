// ═══════════════════════════════════════════════════════════
// 🔧 MANTENIMIENTO DE LA MOTO — NÚCLEO PURO (Fase 3.36)
// Lógica y matemática SIN dependencias (ni React ni Firebase):
// se puede probar con Node directo y reusar donde sea.
//
// CÓMO FUNCIONA (encima del odómetro de la Fase 3.35):
//   1. Cada mantenimiento (aceite, cadena, frenos…) tiene un
//      INTERVALO: cada cuántos km toca (y opcionalmente cada
//      cuántos días — gana el que llegue primero).
//   2. Cuando lo haces, se REGISTRA: se guarda el km del
//      odómetro ese día (el total histórico calibrado).
//   3. El recordatorio compara: kmActual - kmUltimo vs intervalo.
//        · < 85%  → ✅ al día (verde)
//        · ≥ 85%  → 🟡 por vencer (amarillo) — "faltan 150 km"
//        · ≥ 100% → 🔴 VENCIDO — "venció hace 120 km"
//   4. También cuenta por días para lo que no depende del km
//      (batería por carga, presión de llantas…).
//
// El km que entra aquí SIEMPRE es el TOTAL calibrado del
// odómetro (stats.totalM) — así la calibración de la moto
// se respeta en los mantenimientos también.
// ═══════════════════════════════════════════════════════════

// ── Tipos ─────────────────────────────────────────────────

/** Configuración de un mantenimiento (qué es y cada cuánto toca) */
export interface ItemMant {
  /** id fijo ('aceite', 'cadena', o generado para personalizados) */
  id: string;
  nombre: string;
  /** emoji para la fila */
  icono: string;
  /** cada cuántos km toca (null = solo controla por días) */
  intervaloKm?: number | null;
  /** cada cuántos días toca (null = solo controla por km) */
  intervaloDias?: number | null;
  /** desactivado → no aparece ni avisa (catálogo prearmado) */
  activo?: boolean;
  /** epoch ms de la última edición (para fusionar 2 dispositivos) */
  at?: number;
}

/** Estado de un mantenimiento que ya se hizo al menos 1 vez */
export interface EstadoItemMant {
  /** km del odómetro (total calibrado) cuando se hizo */
  kmUltimo: number;
  /** 'YYYY-MM-DD' local del registro */
  fechaUltima: string;
  /** epoch ms del registro (para fusionar) */
  at?: number;
}

/** Una entrada del historial de mantenimientos hechos */
export interface RegistroHistorial {
  /** id del item */
  id: string;
  /** nombre al momento del registro (los items se pueden renombrar) */
  nombre: string;
  /** km del odómetro al hacerlo */
  km: number;
  /** 'YYYY-MM-DD' local */
  fecha: string;
  /** costo en soles (opcional) */
  costo?: number | null;
  /** taller (opcional) */
  taller?: string | null;
  /** notas (opcional) */
  notas?: string | null;
  /** epoch ms (para deduplicar al fusionar) */
  at: number;
}

// ── Umbral ────────────────────────────────────────────────

/** A partir de qué fracción del intervalo se considera "por vencer" */
export const UMBRAL_AVISO = 0.85;

/** Máximo de entradas del historial que se conservan */
export const MAX_HISTORIAL = 60;

// ── Catálogo prearmado (moto de delivery en Lima) ─────────
// El rider lo ajusta a gusto: intervalos editables, items se
// pueden desactivar y se pueden agregar propios.

export const CATALOGO_DEFAULT: ItemMant[] = [
  { id: 'aceite', nombre: 'Aceite de motor', icono: '🛢️', intervaloKm: 1000, intervaloDias: 90 },
  { id: 'cadena', nombre: 'Cadena (tensión y lubricado)', icono: '⛓️', intervaloKm: 500, intervaloDias: null },
  { id: 'frenos', nombre: 'Pastillas de frenos', icono: '🛑', intervaloKm: 3000, intervaloDias: 180 },
  { id: 'llantas', nombre: 'Llantas (presión y desgaste)', icono: '🛞', intervaloKm: 2000, intervaloDias: 30 },
  { id: 'filtro_aire', nombre: 'Filtro de aire', icono: '🌀', intervaloKm: 1500, intervaloDias: null },
  { id: 'bujia', nombre: 'Bujía', icono: '⚡', intervaloKm: 5000, intervaloDias: null },
  { id: 'bateria', nombre: 'Batería (revisión de carga)', icono: '🔋', intervaloKm: null, intervaloDias: 60 },
  { id: 'servicio', nombre: 'Servicio general de taller', icono: '🔧', intervaloKm: 2500, intervaloDias: 120 },
];

// ── Evaluación ────────────────────────────────────────────

export type EstadoEval = 'nuevo' | 'ok' | 'acerca' | 'vencido';

/** Resultado de evaluar un item contra el km actual */
export interface EvaluacionItem {
  id: string;
  nombre: string;
  icono: string;
  /** estado visual del item */
  estado: EstadoEval;
  /** avance 0..1 hacia el próximo (el más apretado de km/días) */
  progreso: number;
  /** km recorridos desde el último mantenimiento (null = sin registrar) */
  kmDesdeUltimo: number | null;
  /** km que faltan (negativo = venció hace X km) */
  kmRestantes: number | null;
  /** días desde el último registro (null = sin registrar) */
  diasDesde: number | null;
  /** días que faltan (negativo = venció hace X días) */
  diasRestantes: number | null;
  /** km en el que toca el próximo */
  proximoKm: number | null;
  intervaloKm: number | null;
  intervaloDias: number | null;
  activo: boolean;
}

/** Días (fraccionarios) entre una fecha 'YYYY-MM-DD' y ahora */
export function diasDesde(fecha: string, ahoraMs: number): number {
  const [a, m, d] = fecha.split('-').map(Number);
  if (!a || !m || !d) return 0;
  const entonces = new Date(a, m - 1, d).getTime();
  return (ahoraMs - entonces) / 86400000;
}

/**
 * Evalúa un item: ¿al día, por vencer o vencido?
 *
 * @param item     configuración del mantenimiento
 * @param estado   último registro (null = nunca se hizo → 'nuevo')
 * @param kmTotal  km totales del odómetro (calibrado)
 * @param ahoraMs  epoch ms de ahora (para el control por días)
 */
export function evaluarItem(
  item: ItemMant,
  estado: EstadoItemMant | null | undefined,
  kmTotal: number,
  ahoraMs: number
): EvaluacionItem {
  const intervaloKm = item.intervaloKm ?? null;
  const intervaloDias = item.intervaloDias ?? null;

  const base: EvaluacionItem = {
    id: item.id,
    nombre: item.nombre,
    icono: item.icono,
    estado: 'nuevo',
    progreso: 0,
    kmDesdeUltimo: null,
    kmRestantes: null,
    diasDesde: null,
    diasRestantes: null,
    proximoKm: null,
    intervaloKm,
    intervaloDias,
    activo: item.activo !== false,
  };

  if (!estado) return base; // nunca registrado → "regístralo para empezar"

  const kmDesde = Math.max(0, kmTotal - estado.kmUltimo);
  base.kmDesdeUltimo = kmDesde;
  base.proximoKm = intervaloKm != null ? estado.kmUltimo + intervaloKm : null;

  // avance por kilómetros
  let progresoKm = 0;
  if (intervaloKm != null && intervaloKm > 0) {
    progresoKm = kmDesde / intervaloKm;
    base.kmRestantes = Math.round(intervaloKm - kmDesde);
  }

  // avance por días
  const d = diasDesde(estado.fechaUltima, ahoraMs);
  base.diasDesde = Math.round(d);
  let progresoDias = 0;
  if (intervaloDias != null && intervaloDias > 0) {
    progresoDias = d / intervaloDias;
    base.diasRestantes = Math.round(intervaloDias - d);
  }

  // gana el más avanzado (si un item tiene km Y días)
  const progreso = Math.max(progresoKm, progresoDias);
  base.progreso = Math.min(1.5, Math.max(0, progreso)); // 1.5 máx para "venció por mucho"

  if (progreso >= 1) base.estado = 'vencido';
  else if (progreso >= UMBRAL_AVISO) base.estado = 'acerca';
  else base.estado = 'ok';

  return base;
}

/**
 * Evalúa todos los items activos y los ORDENA por urgencia:
 * vencidos primero (el más vencido arriba), luego por vencer,
 * luego al día, y al final los sin registrar.
 */
export function evaluarLista(
  items: Record<string, ItemMant>,
  estados: Record<string, EstadoItemMant>,
  kmTotal: number,
  ahoraMs: number
): EvaluacionItem[] {
  const lista: EvaluacionItem[] = [];
  for (const item of Object.values(items || {})) {
    if (item.activo === false) continue;
    lista.push(evaluarItem(item, estados?.[item.id], kmTotal, ahoraMs));
  }
  const orden: Record<EstadoEval, number> = { vencido: 0, acerca: 1, ok: 2, nuevo: 3 };
  lista.sort((a, b) => {
    const r = (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9);
    if (r !== 0) return r;
    // dentro del mismo estado: más progreso = más urgente
    return (b.progreso || 0) - (a.progreso || 0);
  });
  return lista;
}

/** Resumen rápido para el menú y el motor de avisos */
export interface ResumenMant {
  /** items vencidos (rojo) */
  vencidos: EvaluacionItem[];
  /** items por vencer (amarillo) */
  acerca: EvaluacionItem[];
  /** el próximo que toca de los que están al día */
  proximo: EvaluacionItem | null;
  /** items sin registrar */
  nuevos: number;
}

export function resumenMant(evals: EvaluacionItem[]): ResumenMant {
  const vencidos = evals.filter((e) => e.estado === 'vencido');
  const acerca = evals.filter((e) => e.estado === 'acerca');
  const nuevos = evals.filter((e) => e.estado === 'nuevo').length;
  let proximo: EvaluacionItem | null = null;
  for (const e of evals) {
    if (e.estado !== 'ok') continue;
    if (!proximo || e.progreso > proximo.progreso) proximo = e;
  }
  return { vencidos, acerca, proximo, nuevos };
}

// ── Fusión remoto ↔ local (para 2 dispositivos) ───────────
// Gana el registro más NUEVO (por `at`); el historial se
// deduplica por `at` y se ordena del más reciente al más viejo.

export function fusionarEstados(
  a: Record<string, EstadoItemMant>,
  b: Record<string, EstadoItemMant>
): Record<string, EstadoItemMant> {
  const salida: Record<string, EstadoItemMant> = { ...(a || {}) };
  for (const [id, est] of Object.entries(b || {})) {
    const previo = salida[id];
    if (!previo || (est.at ?? 0) >= (previo.at ?? 0)) salida[id] = est;
  }
  return salida;
}

export function fusionarItems(
  a: Record<string, ItemMant>,
  b: Record<string, ItemMant>
): Record<string, ItemMant> {
  const salida: Record<string, ItemMant> = { ...(a || {}) };
  for (const [id, item] of Object.entries(b || {})) {
    const previo = salida[id];
    if (!previo || (item.at ?? 0) >= (previo.at ?? 0)) salida[id] = item;
  }
  return salida;
}

export function fusionarHistorial(a: RegistroHistorial[], b: RegistroHistorial[]): RegistroHistorial[] {
  // clave id|at|km: dos registros del MISMO ítem en el mismo ms
  // se conservan; solo se deduplican entradas idénticas (mismo
  // registro que llegó por local y por remoto)
  const vistos = new Map<string, RegistroHistorial>();
  for (const r of [...(a || []), ...(b || [])]) vistos.set(`${r.id}|${r.at}|${r.km}`, r);
  return [...vistos.values()].sort((x, y) => y.at - x.at).slice(0, MAX_HISTORIAL);
}

// ── Ids para items personalizados ─────────────────────────

/** '20260902-4821' — fecha + random: legible y no se repite */
export function nuevoItemId(ahoraMs = Date.now()): string {
  const d = new Date(ahoraMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ── Formatos para la UI ───────────────────────────────────

/** km cortos con separador de miles: 1500 → '1,500' */
export function formatearKmNum(km: number): string {
  const v = Math.round(km);
  return v.toLocaleString('es-PE');
}

/** "faltan 350 km" / "venció hace 120 km" según el signo */
export function textoKm(kmRestantes: number): string {
  if (kmRestantes >= 0) return `faltan ${formatearKmNum(kmRestantes)} km`;
  return `venció hace ${formatearKmNum(-kmRestantes)} km`;
}

/** "faltan 3 días" / "venció hace 2 días" */
export function textoDias(diasRestantes: number): string {
  if (diasRestantes >= 0) return `faltan ${diasRestantes} ${diasRestantes === 1 ? 'día' : 'días'}`;
  return `venció hace ${-diasRestantes} ${diasRestantes === -1 ? 'día' : 'días'}`;
}

/** 'YYYY-MM-DD' → '02 set' (bonito para la UI) */
export function fechaBonita(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  if (!a || !m || !d) return fecha;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  return `${String(d).padStart(2, '0')} ${meses[m - 1]}`;
}
