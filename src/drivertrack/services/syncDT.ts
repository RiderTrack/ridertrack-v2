// ═══════════════════════════════════════════════════════════
// ☁️ FASE C: Sincronización en la nube de DriverTrack (inDrive)
// ═══════════════════════════════════════════════════════════
// Antes: viajes, gastos y ajustes vivían SOLO en el localStorage
// del teléfono → en otro cel no se veía NADA. Ahora, con sesión
// de RiderTrack abierta, todo se respalda SOLO en Firestore
// (doc dt_sync/{uid}) y baja al toque en cualquier dispositivo:
//
//   [cambio en la app] → localStorage → (2.5 seg) → nube
//   [otro cel / esta app] ← onSnapshot ← nube → localStorage
//        → evento 'dt:sync-remoto' → las vistas se recargan
//
// Decisiones de diseño:
//   · ÚLTIMO ESCRIBE GANA (actualizadoEn): sos vos en 2 cels,
//     lo que guardaste último pisa lo anterior. Simple y seguro
//     para un solo driver.
//   · 🛡️ v0.9.2 BLINDAJE ANTI-PÉRDIDA (3 protecciones):
//       1) PRIMER SYNC (este cel nunca sincronizó) o CAMBIOS SIN
//          SUBIR → lo que baja se UNE con lo local (unión por id),
//          NUNCA lo pisa. Así un cel 2 recién instalado (vacío)
//          no puede borrar los registros del cel 1, y lo que
//          agregaste sin internet no se pierde aunque el otro cel
//          haya subido cosas mientras tanto. La unión se vuelve a
//          subir para que la nube quede con TODO.
//       2) ANTI ECO: mientras se aplica lo que bajó de la nube,
//          los guardar* NO re-disparan la subida → dos cels
//          abiertos a la vez no se pasan el mismo doc eternamente
//          (antes: ping-pong infinito de pushes, batería/data).
//       3) PENDIENTE persistente (dt_pendiente): un cambio que no
//          pudo subir (sin internet / sin reglas todavía) queda
//          marcado en el localStorage y se sube solo en cuanto
//          vuelve la conexión o reabrís la app (antes: si cerrabas
//          la app antes del reintento, ese cambio no subía nunca).
//   · Las RUTAS GPS (el dibujo del mapa) NO viajan: pesan mucho
//     y son del teléfono que grabó — los km y duración SÍ viajan
//     (son números). Se suben los últimos 1000 viajes.
//   · v0.9.3: la config viaja COMPLETA (clave de Claude, Yapes/
//     Plin con QR, comisiones, meta, plantillas…) dentro del doc
//     PRIVADO del rider (reglas isOwner: solo él entra). Al bajar,
//     regla de oro: un valor VACÍO de la nube nunca pisa un valor
//     LLENO del teléfono (un cel nuevo no te borra nada).
//   · El doc propio + rules isOwner → nadie más ve tus números.
// ═══════════════════════════════════════════════════════════

import { doc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ConfigDT, Gasto, Viaje } from '../types';
import { cargarConfig, guardarConfig, guardarGastos, guardarViajes, normalizarConfig } from '../storage';

const K_SYNC_EN = 'dt_sync_en'; // última marca de tiempo que YO escribí (local o nube)
const K_PENDIENTE = 'dt_pendiente'; // '1' → hay cambios locales que aún no llegaron a la nube
const MAX_VIAJES_SYNC = 1000; // tope para no pasarse del doc de 1 MB
const DELAY_PUSH = 2500; // debounce: si seguís editando, espera

/** Id del dispositivo (por carga de la app) — para ignorar mi propio eco */
const DISPOSITIVO = Math.random().toString(36).slice(2, 10);

export type EstadoSync = 'sin-sesion' | 'sincronizado' | 'pendiente' | 'error';

let uidActual: string | null = null;
let unsubscribe: Unsubscribe | null = null;
let pushTimer: number | null = null;
let estado: EstadoSync = 'sin-sesion';
let ultimoPushEn = 0;
// 🛡️ anti eco: true mientras aplico lo que bajó de la nube →
// los guardar* llaman avisarCambioDT y ese aviso se ignora (si no,
// dos cels abiertos se re-envían el mismo doc para siempre)
let aplicandoRemoto = false;
const oyentes = new Set<(e: EstadoSync) => void>();

function notificar(nuevo: EstadoSync) {
  estado = nuevo;
  oyentes.forEach(cb => {
    try {
      cb(nuevo);
    } catch {
      /* un oyente roto no frena a los demás */
    }
  });
}

/** Estado actual del sync (para el indicador de Ajustes) */
export function estadoSyncDT(): EstadoSync {
  return estado;
}

/** Suscribirse a cambios de estado — devuelve la función para desuscribirse */
export function suscribirEstadoSyncDT(cb: (e: EstadoSync) => void): () => void {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

/**
 * v0.9.3: la config que viaja a la nube va COMPLETA (clave de
 * Claude, Yape/Plin con QR, plantillas…) — pedido de Rudy: lo que
 * configura en un cel tiene que aparecer en el otro. Viaja dentro
 * de SU doc dt_sync/{uid}, que las reglas limitan al dueño (isOwner).
 */
function configParaNube(c: ConfigDT): Partial<ConfigDT> {
  return { ...c };
}

function viajesParaNube(v: Viaje[]): Viaje[] {
  // Sin rutas GPS ni FOTOS de evidencia (pesan) y solo los últimos
  // MAX — los km/duración SÍ viajan. La foto queda en el teléfono
  // que la sacó (como la ruta GPS del mapa).
  // ⚠️ La clave ruta se ELIMINA (destructuring), NO se pone en undefined:
  // un campo undefined hace que el SDK de Firestore rechaze el documento
  // ENTERO con invalid-argument (mismo bug que la FASE B2.1 en el robot).
  return v
    .slice(-MAX_VIAJES_SYNC)
    .map(({ ruta: _ruta, fotoEntrega: _foto, fotoEntregaHora: _fotoHora, ...x }) => x as Viaje);
}

/** FASE H: versión "comparable" de un viaje (sin ruta GPS ni foto)
 * — para decidir si la nube tenía lo local SIN que la foto local
 * (que nunca sube) haga creer que hay cambios nuevos eternamente. */
function viajeComparable(v: Viaje): string {
  const { ruta: _r, fotoEntrega: _f, fotoEntregaHora: _fh, ...resto } = v;
  return JSON.stringify(resto);
}

/**
 * ⚠️ Cinturón de seguridad: elimina RECURSIVAMENTE cualquier campo
 * undefined del payload (el SDK de Firestore v10 sin
 * ignoreUndefinedProperties rechaza el doc entero si encuentra uno —
 * bug de la FASE B2.1 que acá se colaba por `ruta: undefined`).
 */
function limpiarUndefined<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map(x => limpiarUndefined(x)) as unknown as T;
  if (valor && typeof valor === 'object') {
    const limpio: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v !== undefined) limpio[k] = limpiarUndefined(v);
    }
    return limpio as T;
  }
  return valor;
}

/**
 * 🛡️ Unión por id de dos listas (viajes o gastos). En colisión gana
 * la versión LOCAL (es la que todavía no se respaldó, o la que
 * editaste sin internet). Devuelve si la nube NO tenía algo de lo
 * local → en ese caso hay que volver a subir para que no se pierda.
 * FASE H: comparador opcional — para viajes se compara SIN la ruta
 * GPS ni la foto (que nunca suben) para no re-subir eternamente.
 */
function unirPorId<T extends { id: string }>(
  locales: T[],
  remotos: T[],
  sonIguales: (a: T, b: T) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b),
): { lista: T[]; laNubeNoTenia: boolean } {
  const porId = new Map<string, T>();
  for (const r of remotos) porId.set(r.id, r);
  let laNubeNoTenia = false;
  for (const l of locales) {
    const r = porId.get(l.id);
    if (!r || !sonIguales(r, l)) laNubeNoTenia = true;
    porId.set(l.id, l); // colisión → gana lo local
  }
  return { lista: [...porId.values()], laNubeNoTenia };
}

async function empujar() {
  if (!uidActual) return;
  const actualizadoEn = Date.now();
  ultimoPushEn = actualizadoEn;
  try {
    // Se lee DIRECTO del localStorage (fuente de verdad que ya guardaron
    // las vistas) — así el sync nunca depende de quién lo dispara
    const viajes = viajesParaNube(JSON.parse(localStorage.getItem('dt_viajes_v1') || '[]') as Viaje[]);
    const gastos = JSON.parse(localStorage.getItem('dt_gastos_v1') || '[]') as Gasto[];
    const config = configParaNube(cargarConfig());
    await setDoc(
      doc(db, 'dt_sync', uidActual),
      limpiarUndefined({
        viajes,
        gastos,
        config,
        actualizadoEn,
        dispositivo: DISPOSITIVO,
        origen: 'ridertrack-v2',
      }),
    );
    localStorage.setItem(K_SYNC_EN, String(actualizadoEn));
    localStorage.removeItem(K_PENDIENTE); // 🛡️ todo lo local ya está en la nube
    notificar('sincronizado');
  } catch (e) {
    console.warn('☁️ [DT sync] No pude subir:', e);
    notificar('error');
    // queda marcado como pendiente (dt_pendiente) → se reintenta solo
    // al volver la conexión o al reabrir la app; reintento lento además
    if (pushTimer) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(empujar, 20000);
  }
}

function programarPush() {
  if (!uidActual) return;
  // 🛡️ queda marcado AHORA: si la app se cierra antes del debounce,
  // al reabrirla el snapshot ve el pendiente y sube igual
  localStorage.setItem(K_PENDIENTE, '1');
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(empujar, DELAY_PUSH);
}

/**
 * v0.9.3: mezcla la config que bajó de la nube con la local.
 * REGLA DE ORO: un valor VACÍO de la nube NUNCA pisa un valor
 * LLENO local (si no, un cel sin configurar te borraría la clave
 * de Claude o el QR de Yape del otro cel). Números, booleanos y
 * campos nuevos: gana la nube (así la meta, las comisiones y las
 * plantillas editadas SÍ se propagan).
 */
function mergeConfigRemota(local: Record<string, unknown>, remota: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...local };
  for (const [k, vRemoto] of Object.entries(remota)) {
    if (vRemoto === undefined || vRemoto === null) continue; // la nube no lo mandó → queda el local
    const vLocal = out[k];
    if (typeof vRemoto === 'string') {
      out[k] = vRemoto === '' && typeof vLocal === 'string' && vLocal ? vLocal : vRemoto;
    } else if (vRemoto && typeof vRemoto === 'object' && !Array.isArray(vRemoto)
      && vLocal && typeof vLocal === 'object' && !Array.isArray(vLocal)) {
      out[k] = mergeConfigRemota(vLocal as Record<string, unknown>, vRemoto as Record<string, unknown>);
    } else {
      out[k] = vRemoto;
    }
  }
  return out;
}

/** Aplica lo que bajó de la nube al localStorage y avisa a las vistas */
function aplicarRemoto(data: {
  viajes?: Viaje[];
  gastos?: Gasto[];
  config?: Partial<ConfigDT>;
  actualizadoEn?: number;
}) {
  let hayQueSubir = false; // la unión tiene cosas que la nube no tenía
  aplicandoRemoto = true; // 🛡️ anti eco (ver arriba)
  try {
    // ¿este teléfono tiene datos SIN respaldar? → unir, jamás pisar:
    //   · primeraSync: este cel NUNCA sincronizó (acá están los registros
    //     del cel 1 que todavía no subieron a ningún lado)
    //   · pendiente: hubo cambios que no pudieron subir (sin internet…)
    const primeraSync = Number(localStorage.getItem(K_SYNC_EN) || 0) === 0;
    const protegerLocal = primeraSync || localStorage.getItem(K_PENDIENTE) === '1';

    if (Array.isArray(data.viajes)) {
      const locales = JSON.parse(localStorage.getItem('dt_viajes_v1') || '[]') as Viaje[];
      // merge: las rutas GPS y las FOTOS de evidencia locales se
      // conservan para los viajes que ya tenía (nunca suben: pesan)
      const pesadosLocales = new Map(
        locales.map(v => [v.id, { ruta: v.ruta, foto: v.fotoEntrega, fotoHora: v.fotoEntregaHora }]),
      );
      const conLocalPesado = (v: Viaje): Viaje => {
        const p = pesadosLocales.get(v.id);
        if (!p) return v;
        const conRuta = p.ruta && p.ruta.length >= 2 ? { ...v, ruta: p.ruta } : v;
        return p.foto ? { ...conRuta, fotoEntrega: p.foto, fotoEntregaHora: p.fotoHora } : conRuta;
      };
      if (protegerLocal) {
        // 🛡️ UNIÓN por id: lo que solo existe en este teléfono NUNCA se borra
        const remotos = data.viajes.map(conLocalPesado);
        const union = unirPorId(
          locales,
          remotos,
          (a, b) => viajeComparable(a) === viajeComparable(b), // sin ruta/foto
        );
        hayQueSubir = union.laNubeNoTenia;
        guardarViajes(union.lista);
      } else {
        // flujo normal (todo lo local ya está respaldado): la nube manda el
        // estado completo → así los viajes BORRADOS en el otro cel acá también se van
        guardarViajes(data.viajes.map(conLocalPesado));
      }
    }
    if (Array.isArray(data.gastos)) {
      if (protegerLocal) {
        const locales = JSON.parse(localStorage.getItem('dt_gastos_v1') || '[]') as Gasto[];
        const union = unirPorId(locales, data.gastos);
        if (union.laNubeNoTenia) hayQueSubir = true;
        guardarGastos(union.lista);
      } else {
        guardarGastos(data.gastos);
      }
    }
    if (data.config) {
      // v0.9.3: la config viaja COMPLETA — merge con la regla de oro
      // (un valor VACÍO de la nube no pisa un valor LLENO local)
      const merge = normalizarConfig(
        mergeConfigRemota(
          cargarConfig() as unknown as Record<string, unknown>,
          data.config as unknown as Record<string, unknown>,
        ) as Partial<ConfigDT>,
      );
      guardarConfig(merge);
    }
    localStorage.setItem(K_SYNC_EN, String(data.actualizadoEn || Date.now()));
    // las vistas (shell DT + paneles del panel general) se recargan solas
    window.dispatchEvent(new CustomEvent('dt:sync-remoto'));
    notificar('sincronizado');
  } catch (e) {
    console.warn('☁️ [DT sync] No pude aplicar lo de la nube:', e);
    notificar('error');
  } finally {
    aplicandoRemoto = false;
  }
  if (hayQueSubir && uidActual) {
    // la unión tiene viajes/gastos que la nube no conocía → subirla (1 sola vez)
    programarPush();
  } else {
    // quedó todo igual a la nube → nada pendiente por subir
    localStorage.removeItem(K_PENDIENTE);
  }
}

/**
 * Arranca/para el sync según la sesión. Llamar con el uid del rider
 * logueado (o null al cerrar sesión). Idempotente: si el uid no
 * cambió, no hace nada.
 */
export function iniciarSyncDT(uid: string | null) {
  if (uid === uidActual) return;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (pushTimer) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
  }
  uidActual = uid;
  if (!uid) {
    notificar('sin-sesion');
    return;
  }
  notificar('pendiente');
  try {
    unsubscribe = onSnapshot(
      doc(db, 'dt_sync', uid),
      snap => {
        if (!uidActual) return;
        const data = snap.data() as
          | { viajes?: Viaje[]; gastos?: Gasto[]; config?: Partial<ConfigDT>; actualizadoEn?: number; dispositivo?: string }
          | undefined;
        if (!data || !data.actualizadoEn) {
          // no hay nada en la nube todavía → subo lo local (primer cel)
          programarPush();
          return;
        }
        if (data.dispositivo === DISPOSITIVO) return; // mi propio eco
        const localEn = Number(localStorage.getItem(K_SYNC_EN) || 0);
        if (Number(data.actualizadoEn) > localEn) {
          aplicarRemoto(data);
          return;
        }
        // la nube no tiene nada nuevo… pero si ME QUEDÓ algo sin subir
        // (🛡️ sin internet / la app se cerró antes del debounce), subilo ya
        if (localStorage.getItem(K_PENDIENTE) === '1') programarPush();
      },
      err => {
        console.warn('☁️ [DT sync] listener:', err);
        notificar('error');
      },
    );
  } catch (e) {
    console.warn('☁️ [DT sync] no pude suscribirme:', e);
    notificar('error');
  }
}

/**
 * Lo llaman guardarViajes/guardarGastos/guardarConfig (storage.ts)
 * cada vez que algo cambia → programa la subida con debounce.
 */
export function avisarCambioDT() {
  // 🛡️ anti eco: si el guardado viene de aplicar lo de la nube,
  // re-subirlo sería un ping-pong infinito entre dos cels abiertos
  if (!uidActual || aplicandoRemoto) return;
  notificar('pendiente');
  programarPush();
}

/** Fuerza una subida ya (botón "sincronizar ahora" en Ajustes) */
export function forzarSyncDT() {
  if (!uidActual) return false;
  if (pushTimer) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
  }
  localStorage.setItem(K_PENDIENTE, '1'); // si falla, queda marcado para reintentar
  void empujar();
  return true;
}
