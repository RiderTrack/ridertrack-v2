// ═══════════════════════════════════════════════════════════
// 🛵 PAGO PEDIDOS CORE — RiderTrack V2 (FASE D)
// Cobro por pedido (temporada): la empresa le paga al rider un
// monto fijo por cada pedido ENTREGADO — S/9 normal, S/12 cuando
// el distrito es lejano (Chorrillos, Carabayllo...).
//
// Núcleo PURO de cálculo, sin Firebase ni React (mismo patrón
// que cajaCore) → se testea con Node directamente.
//
// Reglas:
//   · Solo cuentan los pedidos ENTREGADOS (ST_ENTREGADOS):
//     pendientes y fallidos no pagan.
//   · "Lejos" se decide así:
//       1. Marca MANUAL del rider (cliente.lejos === true|false)
//          → manda sobre todo lo demás.
//       2. Sin marca manual → lista de distritos lejanos de la
//          config (comparación sin mayúsculas/tildes/espacios).
//       3. Sin lista ni marca → tarifa normal.
//   · Con activo=false el cálculo devuelve cero y la app se ve
//     exactamente igual que antes de la FASE D (temporada OFF).
//
//   total = normales × tarifaNormal + lejanos × tarifaLejos
//   aEntregar = efectivoCobrado − total   (si < 0: la empresa
//   te debe la diferencia)
// ═══════════════════════════════════════════════════════════

// ── Tipos ─────────────────────────────────────────────────

/** Configuración del modo (viaja en localStorage rt_pago_pedidos) */
export interface ConfigPagoPedidos {
  /** temporada activa — false = todo como antes de la FASE D */
  activo: boolean;
  /** S/ por pedido entregado normal (default 9) */
  tarifaNormal: number;
  /** S/ por pedido entregado en distrito lejano (default 12) */
  tarifaLejos: number;
  /** distritos que marcan "lejos" solos (opcional, vacía = manual) */
  distritosLejos: string[];
}

export const PAGO_PEDIDOS_DEFAULT: ConfigPagoPedidos = {
  activo: false,
  tarifaNormal: 9,
  tarifaLejos: 12,
  distritosLejos: [],
};

/** Cliente "like" — lo mínimo que el cálculo necesita de la ruta */
export interface ClientePagoLike {
  id?: string | number;
  st?: string;
  dist?: string;
  /** marca manual del rider: true=lejos, false=normal, undefined=auto por distrito */
  lejos?: boolean;
}

/** Resultado del cálculo del día */
export interface ResumenPagoPedidos {
  /** pedidos entregados que cobran tarifa normal */
  cantidadNormal: number;
  /** pedidos entregados que cobran tarifa lejos */
  cantidadLejos: number;
  /** entregados totales (normal + lejos) */
  entregados: number;
  /** S/ de los normales */
  montoNormal: number;
  /** S/ de los lejanos */
  montoLejos: number;
  /** S/ total que te corresponde por pedidos hoy */
  total: number;
}

// st entregados — mismos que ST_ENTREGADOS de stats.ts/cajaCore.ts
// (duplicado a propósito: el core no importa nada de la app)
const ST_ENTREGADOS = [
  'efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos',
  'transferencia', 'yape-plin', 'pago-link', 'jose-smith',
  'empresa', 'cambio',
];

// ── Normalización de distritos ────────────────────────────
// "Chorrillos " == "chorrillos" == "CHORRILLOS" == "Chorrillos,"
// (minúsculas, sin tildes, sin espacios de sobra, sin puntuación)
export function normalizarDistrito(dist: string): string {
  return String(dist || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tildes
    .replace(/[^a-z0-9ñ\s]/g, ' ')   // puntuación fuera
    .trim()
    .replace(/\s+/g, ' ');
}

/** ¿El distrito del cliente está en la lista de lejanos? */
export function distritoEsLejos(dist: string, distritosLejos: string[]): boolean {
  const objetivo = normalizarDistrito(dist);
  if (!objetivo) return false;
  return distritosLejos.some((d) => normalizarDistrito(d) === objetivo && normalizarDistrito(d) !== '');
}

/**
 * ¿Este cliente cuenta como LEJOS?
 * 1. marca manual (lejos true/false) → manda
 * 2. si no → lista de distritos
 * 3. si no → normal
 */
export function esLejos(cliente: ClientePagoLike, config: ConfigPagoPedidos): boolean {
  if (typeof cliente.lejos === 'boolean') return cliente.lejos;
  return distritoEsLejos(cliente.dist || '', config.distritosLejos || []);
}

/**
 * Calcular el pago por pedidos del día.
 * Solo ENTREGADOS pagan; con activo=false devuelve todo en cero.
 */
export function calcularPagoPedidos(
  clientes: ClientePagoLike[],
  config: ConfigPagoPedidos
): ResumenPagoPedidos {
  const res: ResumenPagoPedidos = {
    cantidadNormal: 0, cantidadLejos: 0, entregados: 0,
    montoNormal: 0, montoLejos: 0, total: 0,
  };
  if (!config.activo) return res;

  const tarifaNormal = numeroValido(config.tarifaNormal) ? config.tarifaNormal : PAGO_PEDIDOS_DEFAULT.tarifaNormal;
  const tarifaLejos = numeroValido(config.tarifaLejos) ? config.tarifaLejos : PAGO_PEDIDOS_DEFAULT.tarifaLejos;

  for (const c of clientes || []) {
    const st = String(c?.st || 'pendiente');
    if (!ST_ENTREGADOS.includes(st)) continue; // pendientes/fallidos no pagan
    res.entregados++;
    if (esLejos(c, config)) {
      res.cantidadLejos++;
      res.montoLejos += tarifaLejos;
    } else {
      res.cantidadNormal++;
      res.montoNormal += tarifaNormal;
    }
  }
  res.montoNormal = redondear(res.montoNormal);
  res.montoLejos = redondear(res.montoLejos);
  res.total = redondear(res.montoNormal + res.montoLejos);
  return res;
}

/**
 * Liquidación con la empresa al final del día:
 * lo que cobraste en EFECTIVO (tu caja física) menos lo que te
 * corresponde por pedidos = lo que entregás.
 *   > 0 → entregás ese monto a la empresa
 *   < 0 → la empresa te debe la diferencia
 */
export function calcularLiquidacion(
  efectivoCobrado: number,
  pagoPedidos: ResumenPagoPedidos
): { aEntregar: number; empresaTeDebe: number } {
  const neto = redondear(efectivoCobrado - pagoPedidos.total);
  return {
    aEntregar: neto >= 0 ? neto : 0,
    empresaTeDebe: neto < 0 ? redondear(-neto) : 0,
  };
}

// ── Persistencia (localStorage, por dispositivo) ──────────
// La marca "lejos" de cada cliente NO vive acá: viaja dentro
// del cliente (ruta_activa/usuarios) → aparece en el cel 2 solo.
// Acá solo vive la config de temporada (toggle + tarifas +
// distritos). Con try/catch porque el storage puede no existir.

const LS_KEY = 'rt_pago_pedidos';

export function cargarConfigPagoPedidos(): ConfigPagoPedidos {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...PAGO_PEDIDOS_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<ConfigPagoPedidos>;
    return {
      activo: parsed.activo === true,
      tarifaNormal: numeroValido(parsed.tarifaNormal) ? Number(parsed.tarifaNormal) : PAGO_PEDIDOS_DEFAULT.tarifaNormal,
      tarifaLejos: numeroValido(parsed.tarifaLejos) ? Number(parsed.tarifaLejos) : PAGO_PEDIDOS_DEFAULT.tarifaLejos,
      distritosLejos: Array.isArray(parsed.distritosLejos)
        ? parsed.distritosLejos.filter((d) => typeof d === 'string' && d.trim()).map((d) => d.trim())
        : [],
    };
  } catch {
    return { ...PAGO_PEDIDOS_DEFAULT };
  }
}

export function guardarConfigPagoPedidos(config: ConfigPagoPedidos): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {
    // sin storage — la config vive solo en memoria esta sesión
  }
}

// ── Helpers ───────────────────────────────────────────────

function numeroValido(n: unknown): boolean {
  return typeof n === 'number' && isFinite(n) && n > 0;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
