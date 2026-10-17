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
//      fecha y la app los tiene guardados para ese día. Desde
//      la AD-2 también viven acá los FALLIDOS (Rudy marca
//      fallido porque NO sabe si ventas lo reprogramará →
//      quedan "esperando" en la listita hasta que vuelvan en
//      el Excel, él los pase con ➕ o se limpien solos).
//   B) LOS NO ENTREGADOS DE LA ÚLTIMA RUTA CERRADA — la app
//      cruza solita: quiénes de ayer YA VOLVIERON en la lista
//      de hoy (🔁 reincidentes, vienen del Excel nuevo) y
//      quiénes NO VOLVIERON (botón ➕ para pasarlos a hoy sin
//      bajar nada).
//
// 🆕 AD-2 (pedido 18 oct): "cuando pongo fallido porque yo no sé
// si lo van a reprogramar o no... los clientes fallidos también
// que estén en la listita" + "se iba acumulando... darle un
// tiempo prudencial, no sé, tres cinco días... si no sale el
// programa el cliente se borra automáticamente". → los fallidos
// entran a la cola SIN fecha (origen 'fallido') al cerrar la
// ruta, y la cola se AUTO-LIMPIA: lo que ya volvió en la ruta de
// hoy se quita, y lo que lleva más de EXPIRA_DIAS días sin
// volver se borra (no acumula espacio).
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
  /** Para cuándo lo agendó — YYYY-MM-DD ('' = fallido esperando) */
  para: string;
  /** Fecha de la ruta original de donde salió — YYYY-MM-DD */
  desde: string;
  /** Cuándo se agendó — ISO */
  creadoAt?: string;
  /** 🆕 AD-2: entró por ser FALLIDO (sin fecha, esperando que
   *  ventas lo reprograme) — se muestra como "fallido del [fecha]"
   *  con botón ➕ para pasarlo a hoy cuando Rudy confirma. */
  origen?: 'fallido';
}

/** 🆕 AD-2: días que un pedido puede vivir en la listita sin
 *  volver al programa antes de borrarse solo (Rudy: "tres cinco
 *  días... se borra automáticamente para no acumular espacio"). */
export const EXPIRA_DIAS = 5;

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

// ── Estados FALLIDOS (espejo de stats.ST_FALLIDOS, local para
//    mantener el módulo puro). 'reprogramar' NO va acá: tiene su
//    propia rama (se agenda con fecha). ──
const ST_FALLIDOS = ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'];

/** 🆕 AD-2: ¿lo marcó como fallido? (entrará a la listita al cerrar) */
export function esFallido(st: string | undefined): boolean {
  return ST_FALLIDOS.includes((st || '').trim());
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
 * Divide la cola: lo que toca HOY (para <= hoy), los FALLIDOS
 * esperando que ventas los reprograme (sin fecha — AD-2), lo
 * que es para más adelante, y lo que YA está en la lista de hoy
 * (el Excel ya lo trajo — se muestra como "ya en tu ruta" y no
 * se ofrece agregarlo dos veces).
 */
export function dividirCola(
  cola: Reprogramado[],
  hoy: string,
  hoyLista: Cliente[]
): {
  paraHoy: Reprogramado[];
  esperando: Reprogramado[];
  futuro: Reprogramado[];
  yaEnLista: Reprogramado[];
} {
  const paraHoy: Reprogramado[] = [];
  const esperando: Reprogramado[] = [];
  const futuro: Reprogramado[] = [];
  const yaEnLista: Reprogramado[] = [];
  for (const item of cola || []) {
    if (!item || !item.cliente || !normalizar(item.cliente.nombre)) continue;
    if (estaEnLista(item.cliente, hoyLista)) yaEnLista.push(item);
    // 🆕 AD-2: fallido sin fecha → "esperando reprogramación"
    else if (item.origen === 'fallido' || !(item.para || '')) esperando.push(item);
    else if ((item.para || '') <= hoy) paraHoy.push(item);
    else futuro.push(item);
  }
  return { paraHoy, esperando, futuro, yaEnLista };
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
 * fecha). 🆕 AD-2: los FALLIDOS también pasan a la listita —
 * SIN fecha (origen 'fallido', "esperando") porque Rudy no sabe
 * si ventas los reprogramará: quedan a la vista hasta que
 * vuelvan en el Excel, él los pase con ➕ o se limpien solos.
 * Dedupe contra lo que ya esté en la cola — cerrar la ruta dos
 * veces no duplica nada.
 */
export function autoColaAlCerrar(
  clientes: Cliente[],
  hoy: string,
  colaActual: Reprogramado[]
): Reprogramado[] {
  const nuevos: Reprogramado[] = [];
  for (const c of clientes || []) {
    if (!normalizar(c.nombre)) continue;
    const st = (c.st || '').trim();
    if (st === 'reprogramar') {
      nuevos.push({
        cliente: c,
        para: c.reprogramadoPara || sumaDiasISO(hoy, 1),
        desde: hoy,
        creadoAt: new Date().toISOString(),
      });
    } else if (esFallido(st)) {
      // 🆕 AD-2: fallido → esperando (sin fecha)
      nuevos.push({
        cliente: c,
        para: '',
        desde: hoy,
        creadoAt: new Date().toISOString(),
        origen: 'fallido',
      });
    }
  }
  return fusionarCola(colaActual, nuevos);
}

// ── 🆕 AD-2: la listita se limpia SOLA ─────────────────────

/**
 * 🧹 Purga de la cola (la listita no acumula espacio):
 *   1) RESUELTOS — el cliente YA volvió en la lista de hoy (el
 *      Excel nuevo lo trajo o Rudy lo pasó con ➕): fuera de la
 *      lista, ya está en la ruta.
 *   2) EXPIRADOS — lleva más de EXPIRA_DIAS días sin volver al
 *      programa (Rudy: "si no sale en ese lapso, se borra
 *      automáticamente"). El plazo corre desde el MÁS lejano
 *      entre cuándo falló/agendó (desde) y para cuándo era
 *      (para): un agendado para dentro de 10 días no expira
 *      antes de su fecha.
 */
export function purgarCola(
  cola: Reprogramado[],
  hoy: string,
  hoyLista: Cliente[]
): { vivos: Reprogramado[]; expirados: number; resueltos: number } {
  let expirados = 0;
  let resueltos = 0;
  const vivos = (cola || []).filter((item) => {
    if (!item || !item.cliente) return false; // basura → fuera
    if (estaEnLista(item.cliente, hoyLista)) {
      resueltos++;
      return false;
    }
    const desde = item.desde || '';
    const para = item.para || '';
    const base = desde > para ? desde : para; // el más lejano
    if (base && hoy > sumaDiasISO(base, EXPIRA_DIAS)) {
      expirados++;
      return false;
    }
    return true;
  });
  return { vivos, expirados, resueltos };
}

/**
 * 🆕 AD-2 · migración: los FALLIDOS de la última ruta cerrada
 * (rutas cerradas con versiones anteriores a la AD-2, que solo
 * los recordaba el banner B de "última ruta") entran UNA vez a
 * la listita — desde ahí viven hasta resolverse o expirar, y no
 * dependen de que la última ruta cerrada los recuerde. Devuelve
 * la MISMA referencia si no hay nada que migrar (para no
 * disparar escrituras en un efecto).
 */
export function migrarFallidos(
  ultima: UltimaCerrada | null,
  cola: Reprogramado[]
): Reprogramado[] {
  if (!ultima || !(ultima.noEntregados || []).length) return cola || [];
  const yaEstan = (c: Cliente) =>
    (cola || []).some((e) => e && e.cliente && coinciden(e.cliente, c));
  const faltantes = (ultima.noEntregados || []).filter(
    (c) => c && normalizar(c.nombre) && esFallido(c.st) && !yaEstan(c)
  );
  if (!faltantes.length) return cola || [];
  return fusionarCola(
    cola || [],
    faltantes.map((c) => ({
      cliente: c,
      para: '',
      desde: ultima.fecha,
      creadoAt: new Date().toISOString(),
      origen: 'fallido' as const,
    }))
  );
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
