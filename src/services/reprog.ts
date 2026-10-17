// ═══════════════════════════════════════════════════════════
// 📅 FASE AD: REPROGRAMADOS — motor PURO (sin DOM ni Firebase)
//
// Pedido de Rudy (17 oct): "hay pedidos que no fueron entregados
// pero que los reprograman para el día siguiente… poder agregarlos
// para los pedidos de ese día que me toque, en vez de estar
// bajando el Excel completo… cuando veo que sí lo han reprogramado,
// tener una función allá en la lista: estos fueron fallidos ayer".
//
// El flujo real: un pedido falla → ventas LLAMA al cliente ese
// mismo día y decide reprogramarlo → Rudy NO lo sabe en el
// momento, lo descubre AL DÍA SIGUIENTE cuando el Excel nuevo
// trae al cliente de vuelta (o no lo trae). Por eso hay DOS
// fuentes de reprogramados:
//   A) LA COLA — pedidos que el MISMO Rudy agenda (botón 🔄
//      Reprog. o el tilde del reporte MATE): los marcó con
//      fecha y la app los tiene guardados para ese día.
//   B) LOS NO ENTREGADOS DE LA ÚLTIMA RUTA CERRADA — la app
//      cruza solita: quiénes de ayer YA VOLVIERON en la lista
//      de hoy (🔁 reincidentes, vienen del Excel nuevo) y
//      quiénes NO VOLVIERON (botón ➕ para pasarlos a hoy sin
//      bajar nada).
//
// Módulo 100% puro (patrón contabilidad.ts): recibe las fechas
// como parámetro — sin Date.now() en las decisiones, solo en el
// generador de ids. Compilable y testeable en Node sin Firebase.
// ═══════════════════════════════════════════════════════════
import type { Cliente } from './firestore';

/** 📅 Pedido en la cola de reprogramados del rider */
export interface Reprogramado {
  /** Snapshot del pedido (con coordenadas para no re-geocodificar) */
  cliente: Cliente;
  /** Para cuándo lo agendó — YYYY-MM-DD */
  para: string;
  /** Fecha de la ruta original de donde salió — YYYY-MM-DD */
  desde: string;
  /** Cuándo se agendó — ISO */
  creadoAt?: string;
}

/** Snapshot de la última ruta cerrada (viaja en usuarios/{uid}) */
export interface UltimaCerrada {
  fecha: string;            // YYYY-MM-DD
  noEntregados: Cliente[];
}

// ── Estados que cuentan como ENTREGADO (espejo de cajaCore,
//    local para mantener el módulo puro) ─────────────────────
const ST_ENTREGADOS = [
  'efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos',
  'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio',
];

/** ¿El cliente quedó entregado (pagó)? */
export function esEntregado(st: string | undefined): boolean {
  return ST_ENTREGADOS.includes((st || '').trim());
}

/** Cliente mínimo para las claves de cruce (nombre/dir/cel) */
interface ClavesCliente {
  nombre?: string | number;
  dir?: string | number;
  cel?: string | number;
}

// ── Fechas (ISO YYYY-MM-DD, sin Date — puras) ──────────────

/** Suma N días a un ISO (n puede ser negativo) */
export function sumaDiasISO(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + n);
  const dos = (x: number) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${dos(dt.getMonth() + 1)}-${dos(dt.getDate())}`;
}

// ── Claves de cruce (¿es EL MISMO cliente?) ────────────────
// El Excel de la empresa puede traer pequeñas variaciones
// (mayúsculas, doble espacio) → se normaliza. Un cliente es "el
// mismo" si coincide su CELULAR (fuerte) O su nombre+dirección.

const normalizar = (v: string | number | undefined): string =>
  String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

// 🇵🇪 El Excel de la empresa alterna "987654321" y "51-987654321"
// (prefijo de país) → se normaliza el celular como hace el bot:
// si tiene 11 dígitos y arranca con 51, se le quita el prefijo.
const celKey = (c: ClavesCliente): string => {
  const digitos = String(c.cel ?? '').replace(/\D/g, '');
  const cel = digitos.length === 11 && digitos.startsWith('51') ? digitos.slice(2) : digitos;
  return cel.length >= 8 ? `cel:${cel}` : '';
};

// Clave por nombre+dirección. Si el pedido viejo llegó SIN dirección
// (y sin celular), se cae a nombre solo — débil, pero evita que un
// reprogramado se duplique en la cola por no tener identidad.
const nombreDirKey = (c: ClavesCliente): string => {
  const n = normalizar(c.nombre);
  const d = normalizar(c.dir);
  if (n && d) return `nd:${n}|${d}`;
  if (n) return `n:${n}`;
  return '';
};

/** ¿Dos clientes son la misma persona (mismo cel o nombre+dir)? */
export function coinciden(a: ClavesCliente, b: ClavesCliente): boolean {
  const ka = celKey(a), kb = celKey(b);
  if (ka && ka === kb) return true;
  const na = nombreDirKey(a), nb = nombreDirKey(b);
  return !!(na && na === nb);
}

/** ¿El cliente ya está en la lista de hoy (vino del Excel)? */
export function estaEnLista(c: ClavesCliente, lista: Cliente[]): boolean {
  return lista.some((h) => coinciden(c, h));
}

// ── No entregados de una ruta cerrada ──────────────────────

/**
 * Los clientes que NO quedaron entregados en una ruta cerrada:
 * fallidos (fallida/rechazado/ausente/no-contesta/cancelado),
 * reprogramados (🔄) y pendientes que quedaron colgando al
 * cerrar. Todos son candidatos a volver al día siguiente.
 * Sin nombre no sirve para el cruce → se excluye.
 */
export function noEntregados(clientes: Cliente[]): Cliente[] {
  return (clientes || []).filter((c) => {
    if (!normalizar(c.nombre)) return false;
    return !esEntregado(c.st);
  });
}

/**
 * Divide los no entregados de la última ruta cerrada contra la
 * lista de HOY: los que ya VOLVIERON (vinieron en el Excel —
 * muestra el badge 🔁) y los que FALTAN (pasarlos a hoy con ➕).
 */
export function dividirNoEntregados(
  noEnt: Cliente[],
  hoyLista: Cliente[]
): { volvieron: Cliente[]; faltan: Cliente[] } {
  const volvieron: Cliente[] = [];
  const faltan: Cliente[] = [];
  for (const c of noEnt || []) {
    if (estaEnLista(c, hoyLista)) volvieron.push(c);
    else faltan.push(c);
  }
  return { volvieron, faltan };
}

/**
 * Los ids de los clientes de HOY que son reincidentes: estaban
 * como no entregados en la última ruta cerrada y volvieron
 * (el Excel de la empresa los trajo reprogramados). Es el
 * badge 🔁 "fallido ayer" que Rudy pidió ver EN la lista.
 */
export function reincidentesDeHoy(
  hoyLista: Cliente[],
  noEnt: Cliente[]
): Set<string | number> {
  const ids = new Set<string | number>();
  for (const h of hoyLista || []) {
    if ((noEnt || []).some((c) => coinciden(h, c))) ids.add(h.id);
  }
  return ids;
}

// ── La cola de agendados (fuente A) ────────────────────────

/**
 * Divide la cola: lo que toca HOY (para <= hoy), lo que es para
 * más adelante, y lo que YA está en la lista de hoy (el Excel
 * ya lo trajo — se muestra como "ya en tu ruta" y no se ofrece
 * agregarlo dos veces).
 */
export function dividirCola(
  cola: Reprogramado[],
  hoy: string,
  hoyLista: Cliente[]
): { paraHoy: Reprogramado[]; futuro: Reprogramado[]; yaEnLista: Reprogramado[] } {
  const paraHoy: Reprogramado[] = [];
  const futuro: Reprogramado[] = [];
  const yaEnLista: Reprogramado[] = [];
  for (const item of cola || []) {
    if (!item || !item.cliente || !normalizar(item.cliente.nombre)) continue;
    if (estaEnLista(item.cliente, hoyLista)) yaEnLista.push(item);
    else if ((item.para || '') <= hoy) paraHoy.push(item);
    else futuro.push(item);
  }
  return { paraHoy, futuro, yaEnLista };
}

/**
 * Fusiona la cola actual con entradas nuevas (dedupe: mismo
 * cliente + misma fecha no se agenda dos veces). Las entradas
 * nuevas van al final.
 */
export function fusionarCola(
  actual: Reprogramado[],
  agregar: Reprogramado[]
): Reprogramado[] {
  const out = [...(actual || [])];
  for (const nuevo of agregar || []) {
    const dup = out.some(
      (e) => e.para === nuevo.para && coinciden(e.cliente, nuevo.cliente)
    );
    if (!dup) out.push(nuevo);
  }
  return out;
}

/** Quita de la cola las entradas que apunten a este cliente */
export function quitarDeCola(
  cola: Reprogramado[],
  cliente: ClavesCliente
): Reprogramado[] {
  return (cola || []).filter((e) => !coinciden(e.cliente, cliente));
}

/**
 * FASE AD · cierre de ruta: los pedidos marcados 🔄 Reprogramado
 * pasan SOLOS a la cola para mañana (los que tienen fecha, a su
 * fecha). Dedupe contra lo que ya esté en la cola — cerrar la
 * ruta dos veces no duplica nada.
 */
export function autoColaAlCerrar(
  clientes: Cliente[],
  hoy: string,
  colaActual: Reprogramado[]
): Reprogramado[] {
  const nuevos: Reprogramado[] = (clientes || [])
    .filter((c) => (c.st || '') === 'reprogramar' && normalizar(c.nombre))
    .map((c) => ({
      cliente: c,
      para: c.reprogramadoPara || sumaDiasISO(hoy, 1),
      desde: hoy,
      creadoAt: new Date().toISOString(),
    }));
  return fusionarCola(colaActual, nuevos);
}

// ── Convertir un pedido viejo en cliente de la ruta de hoy ──

/**
 * Prepara un cliente reprogramado para reingresar a la ruta de
 * HOY: pendiente, sin hora, montos en cero, número siguiente, y
 * la marca `reprog` (badge 🔁 en la tarjeta). Conserva TODO lo
 * que ahorra trabajo: coordenadas geocodificadas (lat/lng/latSrc
 * — no se re-geocodifica nunca), la marca 🛵 lejos (S/9⇄S/12),
 * producto, observación y celular.
 */
export function clienteParaRuta(
  c: Cliente,
  num: number,
  desde: string
): Cliente {
  // ⚠️ Firestore RECHAZA valores `undefined` (lección F3.50): se
  // ELIMINAN las claves del runtime anterior (foto, webReg, tilde
  // de inicio de ruta) en vez de dejarlas en undefined — igual que
  // hace actualizarCliente con sus borrados.
  const {
    webReg,
    respondioInicioRuta,
    fotoUrl,
    reprogramadoPara,
    graciasEnviado,
    ...rest
  } = c as Record<string, unknown> & Cliente;
  return {
    ...rest,
    id: `rp-${Date.now()}-${num}`,
    num,
    st: 'pendiente',
    hora: '',
    mEf: 0,
    mYp: 0,
    mEmp: 0,
    mVt: 0,
    mEM: '',
    // 📅 FASE AD: marca para el badge 🔁 "reprogramado" en la tarjeta
    reprog: true,
    // fecha de donde viene (para mostrar "fallido ayer" con su fecha)
    reprogDesde: desde,
  };
}
