// ═══════════════════════════════════════════════════════════
// 💜 YAPE CORE — RiderTrack V2 (FASE BG · v0.11.33)
// Tus dos Yapes en un solo vistazo: el PERSONAL (tu cuenta) y
// el de la EMPRESA. Núcleo PURO de cálculo, sin Firebase ni
// React (mismo patrón que cajaCore) → se testea con Node
// directamente.
//
// La plata se anota como MOVIMIENTOS y el saldo SIEMPRE sale de
// la suma (nada se guarda suelto → nunca se des-cuadra):
//   · 💜 chape     → te yapearon plata (de una carrera…) → tu Yape +
//   · 💸 gasto     → gastaste de un Yape (gasolina, comida…) → −
//   · 🏦 deposito  → pasaste plata de TU Yape al de la empresa
//                    (lo que ganó la empresa contigo) → tú − / empresa +
//   · 💵 retiro    → sacaste plata del Yape de la empresa al tuyo
//   · ⚙️ ajuste    → "fijar saldo": cuadra con la app de Yape
//
//   saldo personal = chapes + retiros − gastos − depósitos + ajustes
//   saldo empresa  = depósitos − retiros − gastos + ajustes
// ═══════════════════════════════════════════════════════════

import { fechaLocalDe } from './cajaCore';

// ── Tipos ─────────────────────────────────────────────────

/** las dos cuentas que se vigilan */
export type CuentaYape = 'personal' | 'empresa';

/** qué le pasó a la plata */
export type TipoMovYape = 'chape' | 'gasto' | 'deposito' | 'retiro' | 'ajuste';

/** Un movimiento de plata en los Yapes */
export interface MovimientoYape {
  /** id único (prefijo anti-colisión con la nube) */
  id: string;
  /** ms epoch — orden y clave anti-dedupe */
  ts: number;
  /** a qué cuenta afecta (para deposito/retiro son las dos) */
  cuenta: CuentaYape;
  tipo: TipoMovYape;
  /** S/ del movimiento (positivo; el ajuste puede ser negativo) */
  monto: number;
  /** concepto libre corto ("de la carrera de San Juan", "gasolina") */
  nota?: string;
}

/** Resumen vivo de los Yapes (saldos + lo que pasó HOY) */
export interface ResumenYape {
  saldoPersonal: number;
  saldoEmpresa: number;
  /** 💜 S/ que te chapearon HOY */
  hoyChapes: number;
  /** cuántos chapes HOY */
  hoyNChapes: number;
  /** 🏦 S/ depositados a la empresa HOY */
  hoyDepositado: number;
  /** 💵 S/ retirados de la empresa HOY */
  hoyRetirado: number;
  /** 💸 S/ gastados HOY del Yape personal */
  hoyGastoPersonal: number;
  /** 💸 S/ gastados HOY del Yape de la empresa */
  hoyGastoEmpresa: number;
  /** movimientos de HOY (chapes + gastos + depósitos…) */
  hoyN: number;
}

// ── Efectos (la ÚNICA fuente de verdad de los signos) ─────

/** cuánto mueve un movimiento cada cuenta */
export function efectoDe(m: MovimientoYape): { personal: number; empresa: number } {
  const monto = Number(m.monto) || 0;
  switch (m.tipo) {
    case 'chape':
      // te yapearon → entra a TU Yape
      return { personal: monto, empresa: 0 };
    case 'gasto':
      // gastaste de esa cuenta
      return m.cuenta === 'empresa' ? { personal: 0, empresa: -monto } : { personal: -monto, empresa: 0 };
    case 'deposito':
      // pasaste plata de tu Yape al de la empresa
      return { personal: -monto, empresa: monto };
    case 'retiro':
      // sacaste plata del Yape de la empresa al tuyo
      return { personal: monto, empresa: -monto };
    case 'ajuste':
      // cuadre con la app de Yape (puede ser negativo)
      return m.cuenta === 'empresa' ? { personal: 0, empresa: monto } : { personal: monto, empresa: 0 };
  }
}

/** Saldos de las dos cuentas = suma de TODO el historial */
export function saldosYape(movs: MovimientoYape[]): { personal: number; empresa: number } {
  let personal = 0;
  let empresa = 0;
  for (const m of movs || []) {
    const e = efectoDe(m);
    personal += e.personal;
    empresa += e.empresa;
  }
  return { personal, empresa };
}

/** movimientos de una fecha YYYY-MM-DD */
export function movsDeFecha(movs: MovimientoYape[], fechaISO: string): MovimientoYape[] {
  return (movs || []).filter((m) => fechaLocalDe(m.ts || 0) === fechaISO);
}

/** Resumen de los Yapes (saldos + lo de HOY) */
export function resumenYape(movs: MovimientoYape[], hoyISO: string): ResumenYape {
  const saldos = saldosYape(movs);
  let hoyChapes = 0;
  let hoyNChapes = 0;
  let hoyDepositado = 0;
  let hoyRetirado = 0;
  let hoyGastoPersonal = 0;
  let hoyGastoEmpresa = 0;
  let hoyN = 0;
  for (const m of movsDeFecha(movs, hoyISO)) {
    hoyN++;
    const monto = Math.abs(Number(m.monto) || 0);
    if (m.tipo === 'chape') {
      hoyChapes += monto;
      hoyNChapes++;
    } else if (m.tipo === 'deposito') hoyDepositado += monto;
    else if (m.tipo === 'retiro') hoyRetirado += monto;
    else if (m.tipo === 'gasto') {
      if (m.cuenta === 'empresa') hoyGastoEmpresa += monto;
      else hoyGastoPersonal += monto;
    }
  }
  return {
    saldoPersonal: saldos.personal,
    saldoEmpresa: saldos.empresa,
    hoyChapes,
    hoyNChapes,
    hoyDepositado,
    hoyRetirado,
    hoyGastoPersonal,
    hoyGastoEmpresa,
    hoyN,
  };
}

// ── Info para la UI ───────────────────────────────────────

/** icono + nombre corto de cada tipo (para la lista) */
export function infoTipoYape(tipo: TipoMovYape): { icono: string; nombre: string } {
  switch (tipo) {
    case 'chape':
      return { icono: '💜', nombre: 'Te chapearon' };
    case 'gasto':
      return { icono: '💸', nombre: 'Gasto' };
    case 'deposito':
      return { icono: '🏦', nombre: 'Depositaste a la empresa' };
    case 'retiro':
      return { icono: '💵', nombre: 'Retiraste de la empresa' };
    case 'ajuste':
      return { icono: '⚙️', nombre: 'Ajuste (cuadre)' };
  }
}

// ── Compactación (el saldo nunca se rompe) ────────────────

/** máximo de movimientos que se guardan; los más viejos se
 *  FOLDAN en un ajuste base por cuenta (su efecto neto queda
 *  exacto → el saldo no cambia, el store no crece infinito) */
export const MAX_MOVS = 400;

/** ids fijos de los movimientos base (historial viejo compactado) */
export const ID_BASE_PERSONAL = 'ybase_p';
export const ID_BASE_EMPRESA = 'ybase_e';

/**
 * FASE BG — compacta el historial: se queda con los MAX_MOVS
 * movimientos más recientes y el resto (los más viejos) se
 * reemplaza por UN ajuste base por cuenta con el efecto neto
 * exacto de todo lo compactado (los base viejos incluidos).
 * El saldo queda IDÉNTICO antes y después — puro y testeable
 * con `ahora` inyectable.
 */
export function compactarMovs(movs: MovimientoYape[]): MovimientoYape[] {
  const lista = [...(movs || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (lista.length <= MAX_MOVS) return lista;
  const vivos = lista.slice(0, MAX_MOVS - 2); // 2 asientos para las bases
  const viejos = lista.slice(MAX_MOVS - 2);
  let netoP = 0;
  let netoE = 0;
  for (const m of viejos) {
    const e = efectoDe(m);
    netoP += e.personal;
    netoE += e.empresa;
  }
  const fuera: MovimientoYape[] = [...vivos];
  if (Math.abs(netoP) >= 0.005) {
    fuera.push({
      id: ID_BASE_PERSONAL,
      ts: 0,
      cuenta: 'personal',
      tipo: 'ajuste',
      monto: netoP,
      nota: 'Saldo base (historial viejo compactado)',
    });
  }
  if (Math.abs(netoE) >= 0.005) {
    fuera.push({
      id: ID_BASE_EMPRESA,
      ts: 0,
      cuenta: 'empresa',
      tipo: 'ajuste',
      monto: netoE,
      nota: 'Saldo base (historial viejo compactado)',
    });
  }
  return fuera.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

// ── Saneo defensivo (localStorage / nube pueden venir rotos) ──

const TIPOS_VALIDOS: TipoMovYape[] = ['chape', 'gasto', 'deposito', 'retiro', 'ajuste'];

/** id de movimiento aleatorio (prefijo anti-colisión con remoto) */
export function nuevoMovId(): string {
  return `y${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Sanea un movimiento crudo: id/ts/cuenta/tipo válidos, monto
 * finito; para TODO tipo salvo 'ajuste' el monto tiene que ser
 * > 0 (un gasto en 0 o negativo es basura → se TIRA, no se
 * inventa). Devuelve null si no hay nada utilizable.
 */
function sanearMov(bruto: unknown): MovimientoYape | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const o = bruto as Record<string, unknown>;
  const id = String(o.id || '').trim();
  if (!id) return null;
  const tipo = (TIPOS_VALIDOS as string[]).includes(String(o.tipo)) ? (o.tipo as TipoMovYape) : null;
  if (!tipo) return null;
  const monto = Number(o.monto);
  if (!Number.isFinite(monto)) return null;
  if (tipo !== 'ajuste' && monto <= 0) return null;
  const cuenta: CuentaYape = o.cuenta === 'empresa' ? 'empresa' : 'personal';
  const ts = Number(o.ts);
  const fuera: MovimientoYape = {
    id,
    ts: Number.isFinite(ts) ? ts : Date.now(),
    cuenta,
    tipo,
    monto,
  };
  const nota = String(o.nota || '').trim().slice(0, 80);
  if (nota) fuera.nota = nota;
  return fuera;
}

/** Sanea una lista cruda de movimientos (dedupe por id incluido) */
export function normalizarMovs(bruto: unknown): MovimientoYape[] {
  if (!Array.isArray(bruto)) return [];
  const mapa = new Map<string, MovimientoYape>();
  for (const crudo of bruto) {
    const m = sanearMov(crudo);
    if (!m) continue;
    const previo = mapa.get(m.id);
    if (!previo || (m.ts || 0) >= (previo.ts || 0)) mapa.set(m.id, m);
  }
  return Array.from(mapa.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

// ── Fusiones local vs remoto (patrón FASE W de la caja) ────

/** 🔄 FASE W — tombstones de yape: movimientos eliminados */
export interface BorradoYape {
  movs: { id: string; ts: number }[];
}

export const BORRADO_YAPE_VACIO: BorradoYape = { movs: [] };

/** tombstone de un movimiento que se está borrando ahora */
export function tombstoneMov(id: string): { id: string; ts: number } {
  return { id, ts: Date.now() };
}

/** Une dos sets de tombstones (por id, gana el más reciente) */
export function fusionarBorradosYape(a?: BorradoYape | null, b?: BorradoYape | null): BorradoYape {
  const mapa = new Map<string, { id: string; ts: number }>();
  for (const t of [...(a?.movs || []), ...(b?.movs || [])]) {
    if (!t?.id) continue;
    const previo = mapa.get(t.id);
    if (!previo || (t.ts || 0) >= (previo.ts || 0)) mapa.set(t.id, t);
  }
  return { movs: [...mapa.values()] };
}

/** Saca tombstones viejos (más de `dias` días) */
export function podarBorradosYape(b: BorradoYape, dias: number): BorradoYape {
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  return { movs: (b.movs || []).filter((t) => (t.ts || 0) >= limite) };
}

/**
 * Aplica los tombstones: fuera todo movimiento borrado DESPUÉS
 * de su propio ts (re-agregar crea id nuevo → sobrevive, que es
 * lo correcto). Los ids base NUNCA se reutilizan salvo por la
 * compactación → el tombstone gana y listo.
 */
export function filtrarBorradosYape(movs: MovimientoYape[], b?: BorradoYape | null): MovimientoYape[] {
  if (!b || !(b.movs || []).length) return movs;
  const fuera = new Map(b.movs.map((t) => [t.id, t.ts || 0]));
  return (movs || []).filter((m) => !m || (fuera.get(m.id) || 0) < (m.ts || 0));
}

/**
 * Fusiona movimientos locales y remotos: dedupe por id, gana el
 * más reciente si se repite (ts mayor). Ordenado desc por ts.
 */
export function fusionarMovs(a: MovimientoYape[], b: MovimientoYape[]): MovimientoYape[] {
  const mapa = new Map<string, MovimientoYape>();
  for (const m of [...(a || []), ...(b || [])]) {
    if (!m || !m.id) continue;
    const previo = mapa.get(m.id);
    if (!previo || (m.ts || 0) >= (previo.ts || 0)) mapa.set(m.id, m);
  }
  return Array.from(mapa.values()).sort((x, y) => (y.ts || 0) - (x.ts || 0));
}

/** días que vive un tombstone en el store */
export const MAX_DIAS_BORRADO_YAPE = 60;
