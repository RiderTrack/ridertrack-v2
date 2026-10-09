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

// ── Cuadre de entrega (FASE O) ────────────────────────────

/** Cómo le entregás la plata a tu jefe al final del día */
export interface CuadreEntrega {
  /** lo que le das en billetes (lo que contaste − tu fondo, que es tuyo) */
  efectivo: number;
  /** lo que falta → lo depositás por Yape */
  yape: number;
  /** efectivo + yape = todo lo que recibe por tu mano */
  total: number;
}

/**
 * FASE O — el cuadre de la entrega. La app dice "te quedó S/400 en
 * efectivo y S/300 en yape", pero en la vida real (yapeos, cambios,
 * vueltos) a veces tenés OTRA plata en la mano. Este cálculo parte
 * de lo que CONTASTE al cerrar y reparte el total del día:
 *   · efectivo = contado − fondo (el fondo es tuyo, no se entrega)
 *   · yape = neto del día − efectivo (lo que falta para que la
 *     empresa reciba todo lo que pasó por tus manos, gastos ya
 *     descontados del neto)
 */
export function calcularCuadreEntrega(e: {
  contado: number;
  fondoInicial: number;
  netoDelDia: number;
}): CuadreEntrega {
  const efectivo = Math.max(0, e.contado - e.fondoInicial);
  const yape = Math.max(0, e.netoDelDia - efectivo);
  return { efectivo, yape, total: efectivo + yape };
}

/**
 * FASE O (redefinida en P) — mensaje directo para el WhatsApp del
 * jefe: ahora es la plantilla por defecto aplicada al cierre (ver
 * PLANTILLA_CUADRE_DEFECTO). SIN "sobran/faltan" y SIN el split
 * según la app — solo lo que entregás en efectivo y lo que
 * depositás por Yape, calculado desde lo que CONTASTE.
 */
export function armarMensajeCuadreJefe(cierre: CierreCaja, riderNombre?: string): string {
  return aplicarPlantillaCuadre(PLANTILLA_CUADRE_DEFECTO, cierre, riderNombre);
}

/** FASE O — normaliza el WhatsApp del jefe: solo dígitos; 9 dígitos → 51 (Perú) */
export function normalizarCelJefe(texto: string): string {
  const d = (texto || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9) return '51' + d;
  return d;
}

// ── Plantillas del cuadre (FASE P) ─────────────────────────

/** Una plantilla guardada del mensaje al jefe (FASE P) */
export interface PlantillaCuadre {
  id: string;
  /** nombre corto ("Corto", "Con gastos"…) */
  nombre: string;
  /** texto con variables {efectivo} {yape} {total}… */
  texto: string;
  /** ms epoch de creación/edición */
  at: number;
}

/** id de plantilla aleatorio (prefijo anti-colisión) */
export function nuevoPlantillaId(): string {
  return `pl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * FASE P — la plantilla por defecto del mensaje al jefe. LIMPIA:
 * sin "sobran/faltan" ni el split según la app (pedido de Rudy:
 * si la app calculó 150 pero contaste 270, el mensaje dice
 * directamente "te entrego 270" — sin comparaciones que confundan
 * al jefe). Los números salen de lo que CONTASTE.
 */
export const PLANTILLA_CUADRE_DEFECTO = [
  '💰 *CUADRE DEL DÍA — {nombre}*',
  '📅 {fecha}',
  '',
  '💵 *Cobrado del día: {cobrado}*',
  '{empresa}',
  '{gastos}',
  '',
  '🤲 *Te entrego en efectivo: {efectivo}*',
  '📲 *El resto te lo deposito por Yape: {yape}*',
  '',
  '📄 *Recibe en total: {total}*',
  '{nota}',
].join('\n');

/** Variables disponibles para las plantillas (para los chips de la UI) */
export const VARIABLES_CUADRE: { clave: string; ej: string }[] = [
  { clave: 'nombre', ej: 'Rudy' },
  { clave: 'fecha', ej: '8 oct' },
  { clave: 'entregas', ej: '12' },
  { clave: 'cobrado', ej: 'S/ 1182.37' },
  { clave: 'efectivo', ej: 'S/ 300.00' },
  { clave: 'yape', ej: 'S/ 882.37' },
  { clave: 'total', ej: 'S/ 1182.37' },
  { clave: 'gastos', ej: '· gastos de la ruta: S/ 20.00 (2) — ya descontados (vacío si no hay)' },
  { clave: 'empresa', ej: '· la empresa cobra directo: S/ 80.00 (vacío si no hay)' },
  { clave: 'nota', ej: '📝 tu nota del cierre (vacío si no hay)' },
];

/**
 * FASE P — aplica una plantilla al cierre: reemplaza las
 * variables {efectivo} {yape} {total}… por los números REALES del
 * día (calculados desde lo que contaste). Las variables
 * desconocidas quedan literal. Las líneas que quedan vacías
 * (gastos/empresa/nota cuando no hay) se colapsan.
 */
export function aplicarPlantillaCuadre(texto: string, cierre: CierreCaja, riderNombre?: string): string {
  const q = calcularCuadreEntrega(cierre);
  const mon = (n: number) => `S/ ${Math.max(0, n).toFixed(2)}`;
  const gastos = cierre.gastosEfectivo + cierre.gastosDigital;
  const mapa: Record<string, string> = {
    nombre: riderNombre?.trim() || 'Rider',
    fecha: fechaCorta(cierre.fecha),
    entregas: String(cierre.entregas),
    cobrado: mon(cierre.efectivoCobrado + cierre.digitalRider + cierre.empresa),
    efectivo: mon(q.efectivo),
    yape: mon(q.yape),
    total: mon(q.total),
    gastos: gastos > 0 ? `· gastos de la ruta: ${mon(gastos)} (${cierre.gastos.length}) — ya descontados` : '',
    empresa: cierre.empresa > 0 ? `· la empresa cobra directo: ${mon(cierre.empresa)} (no pasa por mis manos)` : '',
    nota: cierre.nota?.trim() ? `📝 ${cierre.nota.trim()}` : '',
  };
  const reemplazo = (texto || '').replace(/\{(\w+)\}/g, (m, k: string) => (k in mapa ? mapa[k] : m));
  // líneas: trim individual + colapsar vacías múltiples (variables vacías)
  return reemplazo
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** máximo de plantillas guardadas */
export const MAX_PLANTILLAS_CUADRE = 10;

/**
 * FASE P — saneo defensivo de las plantillas guardadas (viene de
 * localStorage / JSON que puede venir roto): filtra basura, corta
 * nombres/textos largos y respeta el máximo.
 */
export function normalizarPlantillasCuadre(bruto: unknown): PlantillaCuadre[] {
  if (!Array.isArray(bruto)) return [];
  const fuera: PlantillaCuadre[] = [];
  for (const p of bruto) {
    if (!p || typeof p !== 'object') continue;
    const nombre = String((p as Record<string, unknown>).nombre || '').trim().slice(0, 40);
    const texto = String((p as Record<string, unknown>).texto || '').slice(0, 4000);
    if (!nombre || !texto.trim()) continue;
    const id = String((p as Record<string, unknown>).id || '') || nuevoPlantillaId();
    const at = Number((p as Record<string, unknown>).at) || Date.now();
    fuera.push({ id, nombre, texto, at });
  }
  return fuera.slice(0, MAX_PLANTILLAS_CUADRE);
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
