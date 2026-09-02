// ═══════════════════════════════════════════════════════════
// 💰 CAJA CORE — RiderTrack V2 (Fase 3.39 · Paso 3 del plan)
// Cierre de caja + gastos del día. Núcleo PURO de cálculo, sin
// Firebase ni React (mismo patrón que odometroCore y
// mantenimientoCore) → se testea con Node directamente.
//
// La caja física del rider se arma así:
//   · Efectivo / Cambio          → entra S/ cobrar a la caja 💵
//   · Yape + Efectivo            → entra mEf, SALE el vuelto mVt
//   · Mixto                      → entra la parte efectivo mEf
//   · Yape Rudy / Yape-Plin / POS / Empresa / Transferencia… →
//     plata DIGITAL o de la empresa: NO pasa por la caja física
//   · Gastos pagados en EFECTIVO → salen de la caja
//   · Gastos pagados por YAPE    → NO salen de la caja física
//
//   esperado = fondo inicial + efectivo cobrado − gastos efectivo
//   diferencia = contado (lo que cuentas al final) − esperado
//   (> 0 sobrante, < 0 faltante)
// ═══════════════════════════════════════════════════════════

// ── Tipos ─────────────────────────────────────────────────

/** Un gasto del día (gasolina, comida, reparación...) */
export interface Gasto {
  id: string;
  /** ms epoch — también sirve de orden y de clave anti-dedupe */
  ts: number;
  /** categoría del catálogo (gasolina, aceite, comida...) */
  categoria: string;
  /** concepto libre corto ("6 galones", "menú Chifa") */
  concepto: string;
  /** S/ del gasto (siempre positivo) */
  monto: number;
  /** ¿con qué pagaste? efectivo = sale de la caja física */
  pago: 'efectivo' | 'yape';
}

/** Cliente "like" — lo mínimo que la caja necesita de la ruta */
export interface ClienteCajaLike {
  st?: string;
  cobrar?: number | string;
  mEf?: number | string;
  mYp?: number | string;
  mEmp?: number | string;
  mVt?: number | string;
}

/** Resumen vivo de la caja del día */
export interface ResumenCaja {
  /** entregas cobradas (st entregado) */
  entregas: number;
  /** S/ que ENTRARON a la caja física (efectivo, mEf, − vuelto) */
  efectivoCobrado: number;
  /** S/ digitales A FAVOR DEL RIDER (yape-rudy + mYp de yape-efectivo) */
  digitalRider: number;
  /** S/ que cobra la empresa directo (empresa, pos, transferencia...) */
  empresa: number;
  /** total del día (efectivo + digital rider + empresa) */
  cobradoTotal: number;
  /** gastos de hoy pagados en efectivo */
  gastosEfectivo: number;
  /** gastos de hoy pagados por yape */
  gastosDigital: number;
  /** número de gastos de hoy */
  nGastos: number;
  /** fondo inicial + efectivoCobrado − gastosEfectivo */
  esperado: number;
  /** lo que el día te deja: efectivo + digital − gastos */
  netoDelDia: number;
}

/** Cierre guardado — snapshot inmutable del día */
export interface CierreCaja {
  fecha: string;            // YYYY-MM-DD
  at: number;               // ms epoch del cierre
  fondoInicial: number;
  entregas: number;
  efectivoCobrado: number;
  digitalRider: number;
  empresa: number;
  gastosEfectivo: number;
  gastosDigital: number;
  esperado: number;
  contado: number;
  /** contado − esperado: > 0 sobrante, < 0 faltante */
  diferencia: number;
  netoDelDia: number;
  /** snapshot de los gastos del día (para el detalle) */
  gastos: Gasto[];
  nota?: string;
}

// ── Catálogo de gastos ────────────────────────────────────

export interface CategoriaGasto {
  id: string;
  icono: string;
  nombre: string;
}

export const CATEGORIAS_GASTO: CategoriaGasto[] = [
  { id: 'gasolina', icono: '⛽', nombre: 'Gasolina' },
  { id: 'aceite', icono: '🛢️', nombre: 'Aceite' },
  { id: 'reparacion', icono: '🔧', nombre: 'Reparación' },
  { id: 'comida', icono: '🍽️', nombre: 'Comida' },
  { id: 'peaje', icono: '🛃', nombre: 'Peaje' },
  { id: 'pasaje', icono: '🚏', nombre: 'Pasaje' },
  { id: 'otros', icono: '📦', nombre: 'Otros' },
];

const CATEGORIA_FALLBACK: CategoriaGasto = { id: 'otros', icono: '📦', nombre: 'Otros' };

export function categoriaInfo(id: string): CategoriaGasto {
  return CATEGORIAS_GASTO.find((c) => c.id === id) || CATEGORIA_FALLBACK;
}

// ── Estados de pago (mismas listas que realData.ts / stats.ts) ──

/** st entregados (mismos que ST_ENTREGADOS de stats.ts) */
export const ST_ENTREGADOS = [
  'efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos',
  'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio',
];

/** st que cobran la EMPRESA directo (no pasan por la caja) */
const ST_EMPRESA = ['empresa', 'pos', 'transferencia', 'pago-link', 'jose-smith', 'yape-plin'];

// ── Cálculo principal ─────────────────────────────────────

function num(v: number | string | undefined | null): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Arma el resumen de la caja del día.
 * @param clientes  clientes de HOY: la ruta viva + los snapshots
 *                  de las rutas cerradas hoy (historial_rutas)
 * @param gastos    gastos de HOY (ya filtrados por fecha)
 * @param fondo     S/ con los que abriste el día (cambio/vuelto)
 */
export function resumenCajaDia(clientes: ClienteCajaLike[], gastos: Gasto[], fondo: number | string): ResumenCaja {
  let entregas = 0;
  let efectivoCobrado = 0;
  let digitalRider = 0;
  let empresa = 0;

  for (const c of clientes || []) {
    const st = c.st || '';
    if (!ST_ENTREGADOS.includes(st)) continue;
    entregas++;
    const cobrar = num(c.cobrar);
    const mEf = num(c.mEf);
    const mYp = num(c.mYp);
    const mVt = num(c.mVt);

    switch (st) {
      case 'efectivo':
      case 'cambio':
        // todo el cobro entra en billetes a la caja
        efectivoCobrado += cobrar;
        break;
      case 'yape-rudy':
        // el cliente yapea a Rudy → digital, nunca toca la caja
        digitalRider += cobrar;
        break;
      case 'yape-efectivo':
        // parte en billetes, parte yape; el vuelto sale de la caja
        efectivoCobrado += mEf - mVt;
        digitalRider += mYp;
        break;
      case 'mixto':
        // la parte efectivo es tuya, la digital la cobra la empresa
        efectivoCobrado += mEf;
        empresa += num(c.mEmp);
        break;
      default:
        if (ST_EMPRESA.includes(st)) {
          empresa += cobrar;
        } else {
          // estado entregado desconocido → lo menos sorpresivo:
          // contarlo como cobro de la empresa (no inventar efectivo)
          empresa += cobrar;
        }
    }
  }

  let gastosEfectivo = 0;
  let gastosDigital = 0;
  for (const g of gastos || []) {
    const monto = Math.abs(num(g.monto));
    if (g.pago === 'yape') gastosDigital += monto;
    else gastosEfectivo += monto;
  }

  const cobradoTotal = efectivoCobrado + digitalRider + empresa;
  const fondoNum = num(fondo);
  const esperado = fondoNum + efectivoCobrado - gastosEfectivo;
  const netoDelDia = efectivoCobrado + digitalRider - gastosEfectivo - gastosDigital;

  return {
    entregas,
    efectivoCobrado,
    digitalRider,
    empresa,
    cobradoTotal,
    gastosEfectivo,
    gastosDigital,
    nGastos: (gastos || []).length,
    esperado,
    netoDelDia,
  };
}

/** diferencia = contado − esperado (positivo = sobrante) */
export function calcularDiferencia(esperado: number, contado: number): number {
  return contado - esperado;
}

// ── Filtros y helpers de gastos ───────────────────────────

/** fecha local YYYY-MM-DD de un ts (ms) */
export function fechaLocalDe(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** se queda solo con los gastos de esa fecha YYYY-MM-DD */
export function gastosDeFecha(gastos: Gasto[], fechaISO: string): Gasto[] {
  return (gastos || []).filter((g) => fechaLocalDe(g.ts) === fechaISO);
}

/** ¿hay un cierre guardado de esa fecha? (el más reciente) */
export function cierreDeFecha(cierres: CierreCaja[], fechaISO: string): CierreCaja | null {
  const delDia = (cierres || []).filter((c) => c.fecha === fechaISO);
  if (delDia.length === 0) return null;
  return delDia.reduce((a, b) => (b.at > a.at ? b : a));
}

// ── Formato ───────────────────────────────────────────────

/** 12.5 → "S/ 12.50" (sin símbolo raro, siempre 2 decimales) */
export function formatearSoles(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const signo = v < 0 ? '− ' : '';
  return `${signo}S/ ${Math.abs(v).toFixed(2)}`;
}

/** S/ + etiqueta de la diferencia (sobrante/faltante/cuadra) */
export function etiquetaDiferencia(dif: number): { texto: string; clase: 'ok' | 'sobra' | 'falta' } {
  const e = 0.01; // tolerancia de centavos por redondeo
  if (Math.abs(dif) <= e) return { texto: '✓ cuadra exacto', clase: 'ok' };
  if (dif > 0) return { texto: `sobran ${formatearSoles(dif)}`, clase: 'sobra' };
  return { texto: `faltan ${formatearSoles(Math.abs(dif))}`, clase: 'falta' };
}

/** hora corta "18:42" de un ts */
export function horaCorta(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "23 ago" de un ISO YYYY-MM-DD */
export function fechaCorta(iso: string): string {
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const [, m, d] = iso.split('-').map(Number);
  if (!m || !d) return iso;
  return `${d} ${MESES[(m || 1) - 1]}`;
}

// ── Mensaje para el grupo MATE ────────────────────────────

/**
 * Arma el mensaje de WhatsApp del cierre (lo manda el bot con la
 * acción enviar_grupo_mate). Formato tipo v1: compacto y legible.
 */
export function armarMensajeCierre(cierre: CierreCaja, riderNombre?: string): string {
  const L: string[] = [];
  const quien = riderNombre?.trim() || 'Rider';
  L.push(`💰 *CIERRE DE CAJA — ${quien}*`);
  L.push(`📅 ${cierre.fecha}`);
  L.push('');
  L.push(`📦 Entregas: ${cierre.entregas}`);
  L.push(`💵 Efectivo cobrado: S/ ${cierre.efectivoCobrado.toFixed(2)}`);
  if (cierre.digitalRider > 0) {
    L.push(`📱 Yape digital: S/ ${cierre.digitalRider.toFixed(2)}`);
  }
  if (cierre.empresa > 0) {
    L.push(`🏪 Empresa: S/ ${cierre.empresa.toFixed(2)}`);
  }
  L.push(`🧾 Total día: S/ ${(cierre.efectivoCobrado + cierre.digitalRider + cierre.empresa).toFixed(2)}`);
  L.push('');
  if (cierre.gastos.length > 0) {
    L.push('💸 *Gastos:*');
    for (const g of cierre.gastos) {
      const cat = categoriaInfo(g.categoria);
      const det = g.concepto ? ` — ${g.concepto}` : '';
      L.push(`  ${cat.icono} ${cat.nombre}: S/ ${Math.abs(g.monto).toFixed(2)}${det}`);
    }
    L.push('');
  }
  L.push(`🔑 Fondo inicial: S/ ${cierre.fondoInicial.toFixed(2)}`);
  L.push(`🧮 Esperado en caja: S/ ${cierre.esperado.toFixed(2)}`);
  L.push(`🤲 Contado: S/ ${cierre.contado.toFixed(2)}`);
  const dif = cierre.diferencia;
  if (Math.abs(dif) <= 0.01) {
    L.push('✅ Caja cuadra exacto');
  } else if (dif > 0) {
    L.push(`⚠️ Sobran S/ ${dif.toFixed(2)}`);
  } else {
    L.push(`🔴 Faltan S/ ${Math.abs(dif).toFixed(2)}`);
  }
  L.push('');
  L.push(`🏷️ Neto del día (− gastos): S/ ${cierre.netoDelDia.toFixed(2)}`);
  if (cierre.nota?.trim()) {
    L.push('');
    L.push(`📝 ${cierre.nota.trim()}`);
  }
  return L.join('\n');
}

// ── Fusiones local vs remoto ──────────────────────────────

/** id de gasto aleatorio (prefijo anti-colisión con remoto) */
export function nuevoGastoId(): string {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Fusiona gastos locales y remotos: dedupe por id, gana el más
 * reciente si se repite (ts mayor). Ordenado desc por ts.
 */
export function fusionarGastos(a: Gasto[], b: Gasto[]): Gasto[] {
  const mapa = new Map<string, Gasto>();
  for (const g of [...(a || []), ...(b || [])]) {
    if (!g || !g.id) continue;
    const previo = mapa.get(g.id);
    if (!previo || (g.ts || 0) >= (previo.ts || 0)) mapa.set(g.id, g);
  }
  return Array.from(mapa.values()).sort((x, y) => (y.ts || 0) - (x.ts || 0));
}

/**
 * Fusiona cierres locales y remotos: un cierre por fecha (gana
 * el de `at` mayor). Ordenado desc por at.
 */
export function fusionarCierres(a: CierreCaja[], b: CierreCaja[]): CierreCaja[] {
  const mapa = new Map<string, CierreCaja>();
  for (const c of [...(a || []), ...(b || [])]) {
    if (!c || !c.fecha) continue;
    const previo = mapa.get(c.fecha);
    if (!previo || (c.at || 0) >= (previo.at || 0)) mapa.set(c.fecha, c);
  }
  return Array.from(mapa.values()).sort((x, y) => (y.at || 0) - (x.at || 0));
}

/** máximo de cierres que se guardan (historial) */
export const MAX_CIERRES = 90;

/** días que sobrevive un gasto suelto (sin cierre) en el store */
export const MAX_DIAS_GASTO = 45;
