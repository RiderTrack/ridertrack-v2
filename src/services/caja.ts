// ═══════════════════════════════════════════════════════════
// 💰 CAJA — SERVICIO (Fase 3.39 · paso 3 del plan acordado)
// Cierre de caja + gastos del día.
//
// DÓNDE VIVE TODO (mismo patrón que odómetro/mantenimiento):
//   · Núcleo puro de cálculo → utils/cajaCore.ts (testeable
//     con Node, sin Firebase)
//   · Estado en el teléfono → localStorage `rt_caja_{uid}`
//     (instantáneo, sobrevive sin internet)
//   · Nube → Firestore usuarios/{uid}.caja
//     { fondo, gastos, cierres, at }
//     ⚠️ USA EL DOC usuarios/{uid} QUE YA TIENE REGLAS → NO hay
//     que publicar reglas nuevas ni tocar el bot.
//
// La PLATA de los clientes NO vive aquí: la caja lee la ruta
// viva (ruta_activa) + los registros de hoy (historial_rutas)
// al momento de mostrar/cerrar — así siempre cuadra con lo que
// la app ya sabe. Aquí solo viven gastos, fondo y cierres.
// ═══════════════════════════════════════════════════════════

import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { hoyLocal } from '../utils/odometroCore';
import {
  CierreCaja,
  Gasto,
  MAX_CIERRES,
  MAX_DIAS_GASTO,
  cierreDeFecha,
  fechaLocalDe,
  fusionarCierres,
  fusionarGastos,
  gastosDeFecha,
  nuevoGastoId,
  ResumenCaja,
} from '../utils/cajaCore';

// ── Tipos ─────────────────────────────────────────────────

export interface EstadoCaja {
  /** S/ con los que abriste el día (cambio para vueltos) */
  fondo: number;
  /** gastos de los últimos días (se podan) */
  gastos: Gasto[];
  /** cierres guardados — uno por fecha (más reciente primero) */
  cierres: CierreCaja[];
}

// ── Constantes ────────────────────────────────────────────

const EVENTO = 'rt-caja-cambio';
const CLAVE_LOCAL = (uid: string) => `rt_caja_${uid}`;

const ESTADO_INICIAL: EstadoCaja = { fondo: 0, gastos: [], cierres: [] };

// ── Store módulo-level (mismo patrón del odómetro) ────────

let estado: EstadoCaja = { ...ESTADO_INICIAL };
let uidActual: string | null = null;
const oyentes = new Set<() => void>();
let snapshotTick = 0;
let snapCache: EstadoCaja | null = null;
let snapTickCache = -1;

function cargarLocal(uid: string): EstadoCaja | null {
  try {
    const raw = localStorage.getItem(CLAVE_LOCAL(uid));
    if (raw) {
      const p = JSON.parse(raw) as EstadoCaja;
      if (p && typeof p === 'object') {
        return {
          fondo: Number(p.fondo) || 0,
          gastos: Array.isArray(p.gastos) ? p.gastos : [],
          cierres: Array.isArray(p.cierres) ? p.cierres : [],
        };
      }
    }
  } catch {
    // sin storage o JSON roto
  }
  return null;
}

function persistirLocal() {
  if (!uidActual) return;
  try {
    localStorage.setItem(CLAVE_LOCAL(uidActual), JSON.stringify(estado));
  } catch {
    // sin storage
  }
}

function emitir() {
  snapshotTick++;
  window.dispatchEvent(new CustomEvent(EVENTO));
  oyentes.forEach((fn) => fn());
}

/** Tira los gastos viejos (salvo los que ya viajaron en un cierre) */
function podarGastos(gastos: Gasto[], cierres: CierreCaja[]): Gasto[] {
  const limite = Date.now() - MAX_DIAS_GASTO * 24 * 60 * 60 * 1000;
  const fechasConCierre = new Set(cierres.map((c) => c.fecha));
  return gastos.filter((g) => {
    if ((g.ts || 0) >= limite) return true; // reciente → se queda
    // viejo: se queda solo si tiene cierre guardado ese día
    return fechasConCierre.has(fechaLocalDe(g.ts || 0));
  });
}

function normalizar(e: EstadoCaja): EstadoCaja {
  const gastos = fusionarGastos(e.gastos, []);
  const cierres = fusionarCierres(e.cierres, []).slice(0, MAX_CIERRES);
  return { fondo: Number(e.fondo) || 0, gastos: podarGastos(gastos, cierres), cierres };
}

// ── Firestore ────────────────────────────────────────────

async function guardarRemoto(uid: string): Promise<void> {
  if (!uid || !db) return;
  try {
    await setDoc(
      doc(db, 'usuarios', uid),
      {
        caja: {
          fondo: estado.fondo,
          gastos: estado.gastos.slice(0, 200),
          cierres: estado.cierres.slice(0, MAX_CIERRES),
          at: Date.now(),
        },
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('⚠️ Caja: no se pudo guardar en Firestore (queda en el teléfono)', e);
  }
}

/**
 * Arranque: mezcla el local (rápido) con el remoto (verdad
 * histórica) — gastos y cierres se fusionan, el fondo gana el
 * remoto si es más nuevo (at).
 */
async function sincronizarRemoto(uid: string): Promise<void> {
  if (!uid || !db) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return;
    const c = (snap.data() as any)?.caja;
    if (!c || typeof c !== 'object') return;

    const remoto: EstadoCaja = {
      fondo: Number(c.fondo) || 0,
      gastos: Array.isArray(c.gastos) ? c.gastos : [],
      cierres: Array.isArray(c.cierres) ? c.cierres : [],
    };
    const fusionado = normalizar({
      // el fondo manda el remoto (lo último que guardó cualquier
      // teléfono); si el local nunca guardó, 0 no pisa nada
      fondo: (c.at || 0) >= ultimoGuardoLocal(uid) ? remoto.fondo : estado.fondo,
      gastos: fusionarGastos(estado.gastos, remoto.gastos),
      cierres: fusionarCierres(estado.cierres, remoto.cierres),
    });
    if (
      JSON.stringify(fusionado) !== JSON.stringify(estado)
    ) {
      estado = fusionado;
      persistirLocal();
      emitir();
    }
  } catch (e) {
    console.warn('⚠️ Caja: no se pudo sincronizar desde Firestore', e);
  }
}

/** marca de tiempo del último guardado local (para el merge del fondo) */
const CLAVE_GUARDO = (uid: string) => `rt_caja_guardo_${uid}`;
function ultimoGuardoLocal(uid: string): number {
  try {
    return Number(localStorage.getItem(CLAVE_GUARDO(uid))) || 0;
  } catch {
    return 0;
  }
}
function marcarGuardoLocal(uid: string) {
  try {
    localStorage.setItem(CLAVE_GUARDO(uid), String(Date.now()));
  } catch {
    // sin storage
  }
}

// ── API pública ──────────────────────────────────────────

/**
 * Arranca el servicio para este usuario: carga el local al
 * toque y sincroniza con la nube en segundo plano.
 */
export function arrancarCaja(uid: string): () => void {
  if (uidActual === uid) return () => undefined; // ya corriendo

  uidActual = uid;
  const local = cargarLocal(uid);
  estado = local ? normalizar(local) : { ...ESTADO_INICIAL };
  if (!local) persistirLocal();
  emitir();
  void sincronizarRemoto(uid);

  return () => undefined; // el store vive mientras la app viva
}

/** Snapshot ESTABLE para useSyncExternalStore */
export function snapshotCaja(): EstadoCaja {
  if (!snapCache || snapTickCache !== snapshotTick) {
    snapCache = { fondo: estado.fondo, gastos: estado.gastos, cierres: estado.cierres };
    snapTickCache = snapshotTick;
  }
  return snapCache;
}

/** Suscripción a cambios (para useSyncExternalStore) */
export function suscribirCaja(cb: () => void): () => void {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

/** Re-sincroniza desde la nube (botón refrescar) */
export async function recargarCaja(uid: string): Promise<void> {
  if (uidActual !== uid) arrancarCaja(uid);
  await sincronizarRemoto(uid);
}

// ── Fondo ────────────────────────────────────────────────

/** Fija el fondo inicial del día (S/ con los que abriste) */
export async function fijarFondo(uid: string, monto: number): Promise<void> {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;

  const limpio = Math.max(0, Number(monto) || 0);
  if (limpio === estado.fondo) return;

  estado = { ...estado, fondo: limpio };
  persistirLocal();
  marcarGuardoLocal(uid);
  emitir();
  await guardarRemoto(uid);
}

// ── Gastos ───────────────────────────────────────────────

export interface DatosGasto {
  categoria: string;
  concepto?: string;
  monto: number;
  pago?: 'efectivo' | 'yape';
}

/** Agrega un gasto de HOY. Devuelve el gasto creado. */
export async function agregarGasto(uid: string, datos: DatosGasto): Promise<Gasto> {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;

  const monto = Math.abs(Number(datos.monto) || 0);
  if (monto <= 0) throw new Error('El monto debe ser mayor a cero');

  const gasto: Gasto = {
    id: nuevoGastoId(),
    ts: Date.now(),
    categoria: datos.categoria || 'otros',
    concepto: (datos.concepto || '').trim().slice(0, 60),
    monto,
    pago: datos.pago === 'yape' ? 'yape' : 'efectivo',
  };

  estado = { ...estado, gastos: [gasto, ...estado.gastos] };
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
  return gasto;
}

/** Elimina un gasto por id (solo existe hoy → sin drama) */
export async function eliminarGasto(uid: string, id: string): Promise<void> {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;

  if (!estado.gastos.some((g) => g.id === id)) return;
  estado = { ...estado, gastos: estado.gastos.filter((g) => g.id !== id) };
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
}

/** Gastos de HOY (para la UI y para el cierre) */
export function gastosDeHoy(caja: EstadoCaja): Gasto[] {
  return gastosDeFecha(caja.gastos, hoyLocal());
}

// ── Cierre ───────────────────────────────────────────────

export interface DatosCierre {
  /** S/ contados físicamente al final del día */
  contado: number;
  /** resumen calculado con los clientes de hoy + gastos */
  resumen: ResumenCaja;
  nota?: string;
}

/**
 * Cierra la caja de HOY: congela el resumen, guarda la
 * diferencia y el snapshot de gastos. Si hoy ya había un
 * cierre, lo REEMPLAZA (nuevo at).
 */
export async function cerrarCaja(uid: string, datos: DatosCierre): Promise<CierreCaja> {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;

  const r = datos.resumen;
  const contado = Math.max(0, Number(datos.contado) || 0);

  const cierre: CierreCaja = {
    fecha: hoyLocal(),
    at: Date.now(),
    fondoInicial: estado.fondo,
    entregas: r.entregas,
    efectivoCobrado: r.efectivoCobrado,
    digitalRider: r.digitalRider,
    empresa: r.empresa,
    gastosEfectivo: r.gastosEfectivo,
    gastosDigital: r.gastosDigital,
    esperado: r.esperado,
    contado,
    diferencia: contado - r.esperado,
    netoDelDia: r.netoDelDia,
    gastos: gastosDeHoy(estado),
    nota: (datos.nota || '').trim().slice(0, 200) || undefined,
  };

  // un cierre por fecha: el de hoy se reemplaza
  const cierres = [cierre, ...estado.cierres.filter((c) => c.fecha !== cierre.fecha)].slice(0, MAX_CIERRES);
  estado = { ...estado, cierres };
  persistirLocal();
  marcarGuardoLocal(uid);
  emitir();
  await guardarRemoto(uid);
  return cierre;
}

/** El cierre de HOY (si ya se cerró) */
export function cierreDeHoy(caja: EstadoCaja): CierreCaja | null {
  return cierreDeFecha(caja.cierres, hoyLocal());
}

/** Reabre la caja de hoy (borra el cierre para corregirlo) */
export async function reabrirCaja(uid: string): Promise<void> {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;

  const hoy = hoyLocal();
  if (!estado.cierres.some((c) => c.fecha === hoy)) return;
  estado = { ...estado, cierres: estado.cierres.filter((c) => c.fecha !== hoy) };
  persistirLocal();
  marcarGuardoLocal(uid);
  emitir();
  await guardarRemoto(uid);
}
