// ═══════════════════════════════════════════════════════════
// 💜 YAPE — SERVICIO (FASE BH · v0.11.34)
// Tus dos Yapes (el personal y el de la empresa) en un toque.
//
// DÓNDE VIVE TODO (mismo patrón que caja.ts):
//   · Núcleo puro de cálculo → utils/yapeCore.ts (testeable
//     con Node, sin Firebase)
//   · Estado en el teléfono → localStorage `rt_yape_{uid}`
//     (instantáneo, sobrevive sin internet)
//   · Nube → Firestore usuarios/{uid}.yape
//     { movs, borrados?, at }
//     ⚠️ USA EL DOC usuarios/{uid} QUE YA TIENE REGLAS → NO hay
//     que publicar reglas nuevas ni tocar el bot.
//
// 🔄 FASE W (copiado del servicio de la caja): además de
// guardar, ESCUCHA el doc (onSnapshot) → anotás un chape en un
// cel y el otro lo ve SIN recargar. Anti-eco (ignora su propio
// write por el `at`) y merge-antes-de-escribir (nunca pisa los
// movimientos del otro cel con datos viejos). Lo que se borró
// (tombstones) no resucita.
// ═══════════════════════════════════════════════════════════

import { db } from './firebase';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { hoyLocal } from '../utils/odometroCore';
import {
  BorradoYape,
  BORRADO_YAPE_VACIO,
  CuentaYape,
  MovimientoYape,
  OrigenYape,
  TipoMovYape,
  compactarMovs,
  filtrarBorradosYape,
  fusionarBorradosYape,
  fusionarMovs,
  MAX_DIAS_BORRADO_YAPE,
  MAX_MOVS,
  normalizarMovs,
  nuevoMovId,
  podarBorradosYape,
  saldosYape,
  tombstoneMov,
} from '../utils/yapeCore';

// ── Tipos ─────────────────────────────────────────────────

export interface EstadoYape {
  /** todos los movimientos (orden desc, compactados) */
  movs: MovimientoYape[];
  /** 🔄 FASE W: qué se borró y cuándo — para que el merge con
   * la nube no resucite lo eliminado */
  borrados?: BorradoYape;
}

// ── Constantes ────────────────────────────────────────────

const EVENTO = 'rt-yape-cambio';

/** 🔄 FASE W: se dispara cuando el yape cambió desde OTRO
 * celular (el listener de la nube trajo algo nuevo). La UI lo
 * usa para avisar "🔄 Yape actualizado" sin recargar nada. */
export const EVENTO_YAPE_REMOTA = 'rt-yape-remota';

const CLAVE_LOCAL = (uid: string) => `rt_yape_${uid}`;

const ESTADO_INICIAL: EstadoYape = { movs: [] };

// ── Store módulo-level (mismo patrón del odómetro/caja) ────

let estado: EstadoYape = { ...ESTADO_INICIAL };
let uidActual: string | null = null;
const oyentes = new Set<() => void>();
let snapshotTick = 0;
let snapCache: EstadoYape | null = null;
let snapTickCache = -1;

// 🔄 FASE W: escucha en vivo del doc usuarios/{uid} + anti-eco
let desuscribirEscucha: (() => void) | null = null;
/** `at` de nuestro último write (la nube nos devuelve nuestro
 * propio cambio como snapshot → ese eco se ignora) */
let atEscrito = 0;

function cargarLocal(uid: string): EstadoYape | null {
  try {
    const raw = localStorage.getItem(CLAVE_LOCAL(uid));
    if (raw) {
      const p = JSON.parse(raw) as EstadoYape;
      if (p && typeof p === 'object') {
        return {
          movs: normalizarMovs(p.movs),
          ...(p.borrados?.movs?.length ? { borrados: p.borrados } : {}),
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

function normalizar(e: EstadoYape): EstadoYape {
  const borrados = podarBorradosYape(e.borrados || BORRADO_YAPE_VACIO, MAX_DIAS_BORRADO_YAPE);
  // 🔄 FASE W: aplicar los tombstones a lo que ya está (algo
  // borrado no puede seguir en la lista) + compactar (el saldo
  // queda exacto: lo viejo se pliega en las bases)
  const movs = compactarMovs(filtrarBorradosYape(normalizarMovs(e.movs), borrados));
  return { movs, ...(borrados.movs.length ? { borrados } : {}) };
}

// ── Firestore ────────────────────────────────────────────

/** 🔄 FASE W — parsea el campo `yape` crudo del doc (lo que sea
 * que venga de la nube) a EstadoYape; null si no hay nada */
function parsearRemoto(c: unknown): EstadoYape | null {
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  const borrados = o.borrados as Record<string, unknown> | undefined;
  const movsBorrados = Array.isArray(borrados?.movs)
    ? (borrados!.movs as { id: string; ts: number }[]).filter((t) => t && t.id)
    : [];
  return {
    movs: normalizarMovs(o.movs),
    ...(movsBorrados.length ? { borrados: { movs: movsBorrados.slice(0, 200) } } : {}),
  };
}

/** 🔄 FASE W — merge-antes-de-escribir: lee la nube, fusiona lo
 * de allá con lo nuestro (movs por unión, borrados por unión)
 * y devuelve lo que hay que subir. Así NUNCA un write con datos
 * viejos pisa el movimiento del otro celular — y lo que se
 * borró no resucita. */
async function fusionarConNube(uid: string): Promise<EstadoYape> {
  let remoto: EstadoYape | null = null;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (snap.exists()) {
      const c = (snap.data() as any)?.yape;
      remoto = parsearRemoto(c);
    }
  } catch {
    // sin internet (o reglas) → subimos lo local tal cual
  }
  if (!remoto) return estado;
  return normalizar({
    movs: fusionarMovs(estado.movs, remoto.movs),
    borrados: fusionarBorradosYape(estado.borrados, remoto.borrados),
  });
}

async function guardarRemoto(uid: string): Promise<void> {
  if (!uid || !db) return;
  try {
    // 🔄 FASE W: primero fundir con lo que haya en la nube —
    // anotás un chape en este cel y el otro había anotado un
    // gasto: el write sube las DOS cosas (nada se pisa)
    const fusion = await fusionarConNube(uid);
    const at = Date.now();
    atEscrito = at; // anti-eco: nuestro propio snapshot se ignora
    await setDoc(
      doc(db, 'usuarios', uid),
      {
        yape: {
          movs: fusion.movs.slice(0, MAX_MOVS),
          // 🔄 FASE W: los tombstones viajan con el yape → el otro
          // celular sabe qué no tiene que resucitar al fusionar
          ...(fusion.borrados?.movs.length ? { borrados: fusion.borrados } : {}),
          at,
        },
      },
      { merge: true }
    );
    // lo fusionado también queda en el teléfono (por si la nube
    // tenía algo que acá no llegó todavía — p. ej. tombstones)
    if (JSON.stringify(fusion) !== JSON.stringify(estado)) {
      estado = fusion;
      persistirLocal();
      emitir();
    }
  } catch (e) {
    console.warn('⚠️ Yape: no se pudo guardar en Firestore (queda en el teléfono)', e);
  }
}

/**
 * Arranque: mezcla el local (rápido) con el remoto (verdad
 * histórica) — los movimientos se fusionan.
 */
async function sincronizarRemoto(uid: string): Promise<void> {
  if (!uid || !db) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return;
    const c = (snap.data() as any)?.yape;
    const remoto = parsearRemoto(c);
    if (!remoto) return;
    aplicarRemoto(uid, remoto);
  } catch (e) {
    console.warn('⚠️ Yape: no se pudo sincronizar desde Firestore', e);
  }
}

/** 🔄 FASE W — merge de lo remoto en el estado local. Devuelve
 * true si cambió algo (para que la UI avise). NUNCA borra: solo
 * une movimientos, une tombstones y los aplica — lo que se
 * borró en otro celular queda borrado acá. */
function aplicarRemoto(uid: string, remoto: EstadoYape): boolean {
  const fusionado = normalizar({
    movs: fusionarMovs(estado.movs, remoto.movs),
    borrados: fusionarBorradosYape(estado.borrados, remoto.borrados),
  });
  if (JSON.stringify(fusionado) !== JSON.stringify(estado)) {
    estado = fusionado;
    persistirLocal();
    emitir();
    return true;
  }
  return false;
}

/**
 * 🔄 FASE W — la escucha en vivo: cualquier cambio del doc
 * usuarios/{uid} (hecho por OTRO celular con esta misma cuenta)
 * entra acá y se funde al toque. El eco de nuestro propio write
 * (mismo `at`) se ignora → no hay ping-pong.
 */
function suscribirRemoto(uid: string): void {
  if (!db) return;
  desuscribirEscucha?.();
  try {
    desuscribirEscucha = onSnapshot(
      doc(db, 'usuarios', uid),
      (snap) => {
        try {
          if (!snap.exists()) return; // doc sin yape → no pisamos nada local
          const c = (snap.data() as any)?.yape;
          const remoto = parsearRemoto(c);
          if (!remoto) return;
          const remotoAt = Number((c as Record<string, unknown>)?.at) || 0;
          // anti-eco: esto es nuestro propio write volviendo
          if (atEscrito > 0 && remotoAt === atEscrito) return;
          const cambio = aplicarRemoto(uid, remoto);
          if (cambio) {
            window.dispatchEvent(
              new CustomEvent(EVENTO_YAPE_REMOTA, { detail: { at: remotoAt } })
            );
          }
        } catch {
          // snapshot raro → la próxima lo vuelve a intentar
        }
      },
      (err) => {
        // sin internet / permiso: queda el pull del arranque y el
        // botón refrescar; Firestore reintenta solo al reconectar
        console.warn('⚠️ Yape: escucha en vivo caída (reintenta sola)', err?.message || err);
      }
    );
  } catch {
    // db roto → seguimos con el pull del arranque
  }
}

// ── API pública ──────────────────────────────────────────

/**
 * Arranca el servicio para este usuario: carga el local al
 * toque, sincroniza con la nube en segundo plano y 🔄 FASE W
 * queda ESCUCHANDO el doc en vivo — lo que otro celular con la
 * misma cuenta anote (chape, gasto, depósito) aparece acá sin
 * recargar. Mientras el Sidebar esté montado, vive.
 */
export function arrancarYape(uid: string): () => void {
  if (uidActual === uid) return () => undefined; // ya corriendo

  // uid distinto (cambio de cuenta) → reset total + re-suscripción
  desuscribirEscucha?.();
  desuscribirEscucha = null;
  atEscrito = 0;

  uidActual = uid;
  const local = cargarLocal(uid);
  estado = local ? normalizar(local) : { ...ESTADO_INICIAL };
  if (!local) persistirLocal();
  emitir();
  void sincronizarRemoto(uid);
  suscribirRemoto(uid);

  return () => undefined; // el store vive mientras la app viva
}

/** Snapshot ESTABLE para useSyncExternalStore */
export function snapshotYape(): EstadoYape {
  if (!snapCache || snapTickCache !== snapshotTick) {
    snapCache = { movs: estado.movs };
    snapTickCache = snapshotTick;
  }
  return snapCache;
}

/** Suscripción a cambios (para useSyncExternalStore) */
export function suscribirYape(cb: () => void): () => void {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

/** Re-sincroniza desde la nube (botón refrescar) */
export async function recargarYape(uid: string): Promise<void> {
  if (uidActual !== uid) arrancarYape(uid);
  await sincronizarRemoto(uid);
}

// ── Movimientos ──────────────────────────────────────────

export interface DatosMovimiento {
  tipo: TipoMovYape;
  /** cuenta afectada (chape/gasto/ajuste); deposito/retiro
   * mueven las dos — la cuenta se ignora */
  cuenta?: CuentaYape;
  monto: number;
  /** 💜 FASE BH: origen del chape personal (inDriver / empresa
   * — "me llamaron, ¿de dónde?"). Se ignora en los demás tipos. */
  origen?: OrigenYape;
  nota?: string;
}

/** Anota un movimiento de HOY. Devuelve lo creado. */
export async function agregarMovimiento(uid: string, datos: DatosMovimiento): Promise<MovimientoYape> {
  if (uidActual !== uid) arrancarYape(uid);
  uidActual = uidActual || uid;

  const monto = Number(datos.monto) || 0;
  // el ajuste puede ser negativo (cuadre hacia abajo); todo lo
  // demás es plata que se mueve → tiene que ser > 0
  if (datos.tipo !== 'ajuste' && monto <= 0) throw new Error('El monto debe ser mayor a cero');
  if (datos.tipo === 'ajuste' && Math.abs(monto) < 0.005) throw new Error('Nada que ajustar');

  const mov: MovimientoYape = {
    id: nuevoMovId(),
    ts: Date.now(),
    cuenta: datos.cuenta === 'empresa' ? 'empresa' : 'personal',
    tipo: datos.tipo,
    monto,
  };
  // 💜 FASE BH: el origen solo viaja en los chapes personales
  if (datos.tipo === 'chape' && mov.cuenta === 'personal' &&
      (datos.origen === 'indriver' || datos.origen === 'empresa')) {
    mov.origen = datos.origen;
  }
  const nota = (datos.nota || '').trim().slice(0, 80);
  if (nota) mov.nota = nota;

  estado = normalizar({ ...estado, movs: [mov, ...estado.movs] });
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
  return mov;
}

/**
 * ⚙️ FASE BG — "fijar saldo": cuadra una cuenta con lo que
 * muestra la app de Yape. Crea el ajuste exacto (lo que falta o
 * lo que sobra) → el saldo queda CLAVADO en el número real.
 * Devuelve el ajuste creado, o null si ya cuadraba.
 */
export async function fijarSaldo(uid: string, cuenta: CuentaYape, saldoReal: number): Promise<MovimientoYape | null> {
  if (uidActual !== uid) arrancarYape(uid);
  uidActual = uidActual || uid;

  const real = Number(saldoReal) || 0;
  const actual = saldosYape(estado.movs)[cuenta];
  const delta = Math.round((real - actual) * 100) / 100;
  if (Math.abs(delta) < 0.005) return null; // ya cuadra

  return agregarMovimiento(uid, {
    tipo: 'ajuste',
    cuenta,
    monto: delta,
    nota: 'cuadré con la app de Yape',
  });
}

/** Elimina un movimiento por id — 🔄 FASE W: deja tombstone
 * para que la nube no lo resucite (ni acá ni en el otro celular) */
export async function eliminarMovimiento(uid: string, id: string): Promise<void> {
  if (uidActual !== uid) arrancarYape(uid);
  uidActual = uidActual || uid;

  if (!estado.movs.some((m) => m.id === id)) return;
  estado = {
    ...estado,
    movs: estado.movs.filter((m) => m.id !== id),
    borrados: fusionarBorradosYape(estado.borrados, { movs: [tombstoneMov(id)] }),
  };
  estado = normalizar(estado);
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
}

/** ¿el usuario ya anotó algo alguna vez? (para vaciar bonito) */
export function tieneMovimientos(caja: EstadoYape): boolean {
  return (caja.movs || []).some((m) => m.ts > 0);
}

/** hoy en hora local (re-export de conveniencia para la UI) */
export { hoyLocal };
