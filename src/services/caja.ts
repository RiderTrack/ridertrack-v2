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
// 🔄 FASE W — CAJA EN VIVO ENTRE CELULARES: además de guardar,
// el servicio ESCUCHA el doc (onSnapshot) → cerrás la caja en un
// cel y el otro la ve SIN recargar. Anti-eco (ignora su propio
// write por el `at`) y merge-antes-de-escribir (nunca pisa el
// cierre del otro cel con datos viejos).
//
// La PLATA de los clientes NO vive aquí: la caja lee la ruta
// viva (ruta_activa) + los registros de hoy (historial_rutas)
// al momento de mostrar/cerrar — así siempre cuadra con lo que
// la app ya sabe. Aquí solo viven gastos, fondo y cierres.
// ═══════════════════════════════════════════════════════════

import { db } from './firebase';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { hoyLocal } from '../utils/odometroCore';
import {
  BorradoCaja,
  BORRADO_VACIO,
  CierreCaja,
  Gasto,
  MAX_CIERRES,
  MAX_DIAS_GASTO,
  PagoRutaCierre,
  cierreDeFecha,
  fechaLocalDe,
  filtrarBorrados,
  fusionarBorrados,
  fusionarCierres,
  fusionarGastos,
  gastosDeFecha,
  nuevoGastoId,
  podarBorrados,
  ResumenCaja,
  tombstoneCierre,
  tombstoneGasto,
} from '../utils/cajaCore';

// ── Tipos ─────────────────────────────────────────────────

export interface EstadoCaja {
  /** S/ con los que abriste el día (cambio para vueltos) */
  fondo: number;
  /** gastos de los últimos días (se podan) */
  gastos: Gasto[];
  /** cierres guardados — uno por fecha (más reciente primero) */
  cierres: CierreCaja[];
  /** 🔄 FASE W: qué se borró (gastos/cierres) y cuándo — para
   * que el merge con la nube no resucite lo eliminado */
  borrados?: BorradoCaja;
}

// ── Constantes ────────────────────────────────────────────

const EVENTO = 'rt-caja-cambio';

/** 🔄 FASE W: se dispara cuando la caja cambió desde OTRO celular
 * (el listener de la nube trajo algo nuevo). La UI lo usa para
 * avisar "🔄 Caja actualizada" sin recargar nada. */
export const EVENTO_CAJA_REMOTA = 'rt-caja-remota';

const CLAVE_LOCAL = (uid: string) => `rt_caja_${uid}`;

const ESTADO_INICIAL: EstadoCaja = { fondo: 0, gastos: [], cierres: [] };

// ── Store módulo-level (mismo patrón del odómetro) ────────

let estado: EstadoCaja = { ...ESTADO_INICIAL };
let uidActual: string | null = null;
const oyentes = new Set<() => void>();
let snapshotTick = 0;
let snapCache: EstadoCaja | null = null;
let snapTickCache = -1;

// 🔄 FASE W: escucha en vivo del doc usuarios/{uid} + anti-eco
let desuscribirEscucha: (() => void) | null = null;
/** `at` de nuestro último write (la nube nos devuelve nuestro
 * propio cambio como snapshot → ese eco se ignora) */
let atEscrito = 0;

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
          ...(p.borrados ? { borrados: p.borrados } : {}),
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
  const borrados = podarBorrados(e.borrados || BORRADO_VACIO, MAX_DIAS_GASTO);
  // 🔄 FASE W: aplicar los tombstones a lo que ya está (algo
  // borrado no puede seguir en la lista)
  const vivos = filtrarBorrados(fusionarGastos(e.gastos, []), fusionarCierres(e.cierres, []), borrados);
  const gastos = podarGastos(vivos.gastos, vivos.cierres);
  const cierres = vivos.cierres.slice(0, MAX_CIERRES);
  return { fondo: Number(e.fondo) || 0, gastos, cierres, ...(borrados.gastos.length || borrados.cierres.length ? { borrados } : {}) };
}

// ── Firestore ────────────────────────────────────────────

/** 🔄 FASE W — parsea el campo `caja` crudo del doc (lo que sea
 * que venga de la nube) a EstadoCaja; null si no hay nada */
function parsearRemoto(c: unknown): EstadoCaja | null {
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  const borradosBruto = o.borrados as Record<string, unknown> | undefined;
  const gastosBorrados = Array.isArray(borradosBruto?.gastos)
    ? (borradosBruto!.gastos as { id: string; ts: number }[]).filter((t) => t && t.id)
    : [];
  const cierresBorrados = Array.isArray(borradosBruto?.cierres)
    ? (borradosBruto!.cierres as { fecha: string; ts: number }[]).filter((t) => t && t.fecha)
    : [];
  return {
    fondo: Number(o.fondo) || 0,
    gastos: Array.isArray(o.gastos) ? (o.gastos as Gasto[]) : [],
    cierres: Array.isArray(o.cierres) ? (o.cierres as CierreCaja[]) : [],
    ...(gastosBorrados.length || cierresBorrados.length
      ? { borrados: { gastos: gastosBorrados.slice(0, 150), cierres: cierresBorrados.slice(0, 150) } }
      : {}),
  };
}

/** 🔄 FASE W — merge-antes-de-escribir: lee la nube, fusiona lo
 * de allá con lo nuestro (gastos y cierres por unión, fondo por
 * el más nuevo, borrados por unión + filtro) y devuelve lo que
 * hay que subir. Así NUNCA un write con datos viejos pisa el
 * cierre del otro celular — y lo que se borró no resucita. */
async function fusionarConNube(uid: string): Promise<EstadoCaja> {
  let remoto: EstadoCaja | null = null;
  let remotoAt = 0;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (snap.exists()) {
      const c = (snap.data() as any)?.caja;
      remoto = parsearRemoto(c);
      remotoAt = Number((c as Record<string, unknown> | undefined)?.at) || 0;
    }
  } catch {
    // sin internet (o reglas) → subimos lo local tal cual
  }
  if (!remoto) return estado;
  return normalizar({
    // el fondo manda el más nuevo: el remoto solo si lo cambió
    // OTRO teléfono después de nuestro último guardado local
    fondo: remotoAt > ultimoGuardoLocal(uid) ? remoto.fondo : estado.fondo,
    gastos: fusionarGastos(estado.gastos, remoto.gastos),
    cierres: fusionarCierres(estado.cierres, remoto.cierres),
    borrados: fusionarBorrados(estado.borrados, remoto.borrados),
  });
}

async function guardarRemoto(uid: string): Promise<void> {
  if (!uid || !db) return;
  try {
    // 🔄 FASE W: primero fundir con lo que haya en la nube —
    // cerrás la caja en este cel y el otro había agregado un
    // gasto: el write sube las DOS cosas (nada se pisa)
    const fusion = await fusionarConNube(uid);
    const at = Date.now();
    atEscrito = at; // anti-eco: nuestro propio snapshot se ignora
    await setDoc(
      doc(db, 'usuarios', uid),
      {
        caja: {
          fondo: fusion.fondo,
          gastos: fusion.gastos.slice(0, 200),
          cierres: fusion.cierres.slice(0, MAX_CIERRES),
          // 🔄 FASE W: los tombstones viajan con la caja → el otro
          // celular sabe qué no tiene que resucitar al fusionar
          ...(fusion.borrados && (fusion.borrados.gastos.length || fusion.borrados.cierres.length)
            ? { borrados: fusion.borrados }
            : {}),
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
    const remoto = parsearRemoto(c);
    if (!remoto) return;
    aplicarRemoto(uid, remoto, Number((c as Record<string, unknown>)?.at) || 0);
  } catch (e) {
    console.warn('⚠️ Caja: no se pudo sincronizar desde Firestore', e);
  }
}

/** 🔄 FASE W — merge de lo remoto en el estado local. Devuelve
 * true si cambió algo (para que la UI avise). NUNCA borra: solo
 * une gastos/cierres, une tombstones y aplica la regla del
 * fondo — lo que se borró en otro celular queda borrado acá. */
function aplicarRemoto(uid: string, remoto: EstadoCaja, remotoAt: number): boolean {
  const fusionado = normalizar({
    // el fondo manda el remoto (lo último que guardó cualquier
    // teléfono) solo si es más nuevo que nuestro último cambio
    // local; si el local nunca guardó, 0 no pisa nada
    fondo: remotoAt >= ultimoGuardoLocal(uid) ? remoto.fondo : estado.fondo,
    gastos: fusionarGastos(estado.gastos, remoto.gastos),
    cierres: fusionarCierres(estado.cierres, remoto.cierres),
    borrados: fusionarBorrados(estado.borrados, remoto.borrados),
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
          if (!snap.exists()) return; // doc sin caja → no pisamos nada local
          const c = (snap.data() as any)?.caja;
          const remoto = parsearRemoto(c);
          if (!remoto) return;
          const remotoAt = Number((c as Record<string, unknown>)?.at) || 0;
          // anti-eco: esto es nuestro propio write volviendo
          if (atEscrito > 0 && remotoAt === atEscrito) return;
          const cambio = aplicarRemoto(uid, remoto, remotoAt);
          if (cambio) {
            window.dispatchEvent(
              new CustomEvent(EVENTO_CAJA_REMOTA, { detail: { at: remotoAt } })
            );
          }
        } catch {
          // snapshot raro → la próxima lo vuelve a intentar
        }
      },
      (err) => {
        // sin internet / permiso: queda el pull del arranque y el
        // botón refrescar; Firestore reintenta solo al reconectar
        console.warn('⚠️ Caja: escucha en vivo caída (reintenta sola)', err?.message || err);
      }
    );
  } catch {
    // db roto → seguimos con el pull del arranque
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
 * toque, sincroniza con la nube en segundo plano y 🔄 FASE W
 * queda ESCUCHANDO el doc en vivo — lo que otro celular con la
 * misma cuenta guarde (cierre, gasto, fondo) aparece acá sin
 * recargar. Mientras el Sidebar esté montado, vive.
 */
export function arrancarCaja(uid: string): () => void {
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

/** Elimina un gasto por id — 🔄 FASE W: deja tombstone para que
 * la nube no lo resucite (ni acá ni en el otro celular) */
export async function eliminarGasto(uid: string, id: string): Promise<void> {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;

  if (!estado.gastos.some((g) => g.id === id)) return;
  estado = {
    ...estado,
    gastos: estado.gastos.filter((g) => g.id !== id),
    borrados: fusionarBorrados(estado.borrados, { gastos: [tombstoneGasto(id)], cierres: [] }),
  };
  estado = normalizar(estado);
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
  /** 🛵 FASE Q: tu paga por pedidos del día (S/9 normal / S/12
   *  lejano — temporada FASE D). Se congela en el cierre para que
   *  el cuadre al jefe la descuadre siempre con los números del
   *  día, aunque después cambies la config. Sin esto → cuadre de
   *  la FASE O/P (sin descuento). */
  pagoRuta?: PagoRutaCierre;
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
    // 💜 FASE BC: los pedidos FALLIDOS del día viajan congelados en el
    // cierre → el cuadre al jefe los muestra ({fallidos} / {detallePedidos})
    fallidos: r.fallidos || 0,
    // 🛵 FASE Q: la paga del día viaja DENTRO del cierre (a la
    // nube por el mismo doc usuarios/{uid}.caja — sin reglas nuevas)
    ...(datos.pagoRuta ? { pagoRuta: datos.pagoRuta } : {}),
  };

  // un cierre por fecha: el de hoy se reemplaza
  const cierres = [cierre, ...estado.cierres.filter((c) => c.fecha !== cierre.fecha)].slice(0, MAX_CIERRES);
  // 🔄 FASE W: normalizar aplica tombstones (p. ej. si el otro cel
  // reabrió después — y un re-cierre nuevo siempre sobrevive)
  estado = normalizar({ ...estado, cierres });
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

/** Reabre la caja de hoy (borra el cierre para corregirlo) —
 * 🔄 FASE W: tombstone por fecha → el merge no lo resucita, y
 * si volvés a cerrar el nuevo cierre (at posterior) sobrevive */
export async function reabrirCaja(uid: string): Promise<void> {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;

  const hoy = hoyLocal();
  const cierreViejo = cierreDeFecha(estado.cierres, hoy);
  if (!cierreViejo) return;
  estado = {
    ...estado,
    cierres: estado.cierres.filter((c) => c.fecha !== hoy),
    borrados: fusionarBorrados(estado.borrados, { gastos: [], cierres: [tombstoneCierre(hoy)] }),
  };
  estado = normalizar(estado);
  persistirLocal();
  marcarGuardoLocal(uid);
  emitir();
  await guardarRemoto(uid);
}
