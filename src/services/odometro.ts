// ═══════════════════════════════════════════════════════════
// 🛣️ ODÓMETRO AUTOMÁTICO — SERVICIO (Fase 3.35)
// Cuenta los kilómetros reales de la jornada con el GPS del
// teléfono, sin tocar la API de Google (gratis para siempre).
//
// DÓNDE VIVE TODO:
//   · Núcleo puro (Haversine + filtros) → utils/odometroCore.ts
//   · Estado del día → localStorage `rt_odometro_{uid}`
//     (instantáneo al abrir la app, sobrevive reinicios)
//   · Histórico + calibración → Firestore usuarios/{uid}.odometro
//     { factor, totalMetros, dias: { '2026-09-02': {m,c,n,at} } }
//     ⚠️ USA EL DOC usuarios/{uid} QUE YA TIENE REGLAS → NO hay
//     que publicar reglas nuevas en Firebase Console.
//   · Motor GPS → arrancarMotorOdometro(uid): abre su propio
//     watch SOLO mientras el CRONÓMETRO DE RUTA está activo
//     (trabajas = cuenta; terminaste = para). Montado 1 vez en
//     App.tsx → funciona en CUALQUIER pestaña de la app.
//
// La calibración: km = metrosCrudos × factor. Si tu marcador
// de la moto dice 30 y la app 28 → factor 1.07 y listo.
//
// FASE 3.37 (fix conteo bajo):
//   · 🌉 PUENTES: huecos de señal (pantalla apagada / app en
//     segundo plano) ya no botan los km — se recuperan como
//     línea recta si la velocidad media es creíble.
//   · 📊 stats extra: hoyCrudoM (para calibrar por viaje) y
//     puenteM (km recuperados — para que veas cuándo el GPS
//     estuvo congelado y confíes en el número).
//   · 🔆 PANTALLA VIVA: opcional — evita que la pantalla se
//     apague mientras el cronómetro corre (mantiene el GPS
//     fluyendo sin puentes). Se activa desde la tarjeta.
//   · ⚖️ factor ahora 0.50 – 2.00.
// ═══════════════════════════════════════════════════════════

import { db } from './firebase';
import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore';
import { vigilarPosicion, Coordenadas } from './geocoding';
import { evaluarPunto, hoyLocal, PuntoGPS } from '../utils/odometroCore';
import { leerCronoRuta } from '../utils/refrigerio';

// ── Tipos ─────────────────────────────────────────────────

export interface EstadoOdometro {
  /** Día en curso 'YYYY-MM-DD' (para detectar el cambio de día) */
  fecha: string;
  /** Metros CRUDOS acumulados hoy (sin calibrar — la fuente de verdad) */
  crudos: number;
  /** F3.37: metros CRUDOS recuperados por PUENTES hoy (diagóstico) */
  puenteM: number;
  /** Puntos GPS contados hoy (segmentos válidos) */
  puntos: number;
  /** Histórico acumulado en metros crudos (nunca se resetea) */
  totalMetros: number;
  /** Factor de calibración (1.00 = sin ajustar) */
  factor: number;
  /** Última posición aceptada (ancla del filtro) */
  ancla: PuntoGPS | null;
}

export interface StatsOdometro {
  /** Metros calibrados de HOY (en vivo) */
  hoyM: number;
  /** Metros calibrados de AYER */
  ayerM: number;
  /** Suma de los últimos 7 días (incluye hoy) */
  dias7M: number;
  /** Histórico total en metros calibrados */
  totalM: number;
  /** Metros CRUDOS de hoy, sin calibrar (F3.37 — base de la calibración por viaje) */
  hoyCrudoM: number;
  /** F3.37: metros calibrados recuperados por puentes hoy (los
   *  km que el GPS tenía congelados y se rescataron) */
  puenteM: number;
  factor: number;
  /** ¿El motor está contando ahora? (cronómetro activo) */
  contando: boolean;
  /** Epoch ms de la última señal GPS recibida */
  ultimaSenalAt: number | null;
  /** Última velocidad medida entre puntos (km/h) */
  velocidadKmh: number;
}

interface DiaOdometro {
  /** metros calibrados del día */
  m: number;
  /** metros crudos del día */
  c: number;
  /** puntos contados */
  n: number;
  /** ISO de la última actualización */
  at?: string;
}

// ── Constantes ────────────────────────────────────────────

const EVENTO = 'rt-odometro-cambio';
const FACTOR_MIN = 0.5;
/** F3.37: rango ampliado 1.5 → 2.0 por si el puente deja el
 *  conteo por debajo de lo real (líneas rectas cortan curvas). */
const FACTOR_MAX = 2.0;
/** Cada cuánto se baja a Firestore (no cada punto — ahorra writes) */
const FLUSH_MS = 45 * 1000;
/** Re-chequeo del cronómetro por si se pierde el evento */
const CHEQUEO_CRONO_MS = 10 * 1000;
/** Días que se conservan en el doc de Firestore (poda al arrancar) */
const DIAS_CONSERVAR = 400;

// ── Store módulo-level (mismo patrón del cronómetro) ──────
// El servicio queda 100% libre de React: los componentes se
// enganchan con suscribirOdometro/snapshotOdometro.

const ESTADO_INICIAL: EstadoOdometro = {
  fecha: hoyLocal(),
  crudos: 0,
  puenteM: 0,
  puntos: 0,
  totalMetros: 0,
  factor: 1,
  ancla: null,
};

let estado: EstadoOdometro = { ...ESTADO_INICIAL };
let uidActual: string | null = null;
let ultimaSenalAt: number | null = null;
let velocidadUltima = 0;
let contando = false;
let sucio = false;
let ultimoFlushAt = 0;
let diasCache: Record<string, DiaOdometro> = {};
const oyentes = new Set<() => void>();
let snapshotTick = 0;
let snapCache: StatsOdometro | null = null;
let snapTickCache = -1;

function clave(uid: string): string {
  return `rt_odometro_${uid}`;
}

function cargarLocal(uid: string): EstadoOdometro {
  try {
    const raw = localStorage.getItem(clave(uid));
    if (raw) {
      const p = JSON.parse(raw) as Partial<EstadoOdometro>;
      // puenteM puede faltar en estados guardados por la 3.35/3.36
      return { ...ESTADO_INICIAL, ...p, puenteM: p.puenteM || 0 };
    }
  } catch {
    // sin storage
  }
  return { ...ESTADO_INICIAL, fecha: hoyLocal() };
}

function persistirLocal() {
  if (!uidActual) return;
  try {
    localStorage.setItem(clave(uidActual), JSON.stringify(estado));
  } catch {
    // sin storage
  }
}

function emitir() {
  snapshotTick++;
  window.dispatchEvent(new CustomEvent(EVENTO));
  oyentes.forEach((fn) => fn());
}

// ── Cambio de día ────────────────────────────────────────

function iniciarDiaSiCorresponde() {
  const hoy = hoyLocal();
  if (estado.fecha !== hoy) {
    // Nuevo día: el conteo de hoy arranca en cero. El total
    // acumulado NO se toca (ya incluye los km de ayer porque
    // se suman al momento de contarlos).
    estado = { ...estado, fecha: hoy, crudos: 0, puenteM: 0, puntos: 0 };
    persistirLocal();
    emitir();
  }
}

// ── Punto GPS ────────────────────────────────────────────

/**
 * Procesa un punto GPS del watch. Filtra ruido/saltos y suma
 * la distancia válida al día en curso. Expuesto para tests y
 * para alimentar el odómetro desde otros watches si algún día
 * hace falta (hoy lo alimenta SOLO el motor de App.tsx para
 * no contar doble).
 */
export function procesarPuntoGPS(uid: string, c: Coordenadas): void {
  if (!uid || uid !== uidActual) return;
  iniciarDiaSiCorresponde();

  const p: PuntoGPS = {
    lat: c.lat,
    lng: c.lng,
    t: c.t ?? Date.now(),
    accuracy: c.accuracy,
  };

  const res = evaluarPunto(estado.ancla, p);
  ultimaSenalAt = Date.now();

  if (res.nuevoAncla) {
    if (res.contar && res.metros > 0) {
      const anclaPrevia = estado.ancla;
      const dtMs = anclaPrevia ? p.t - anclaPrevia.t : 0;
      const dtHoras = anclaPrevia ? Math.max(0.001, dtMs / 3600000) : 1;
      // La velocidad en vivo solo con segmentos cortos — un puente
      // de 25 min mostraría "28 km/h" mientras estás parado.
      if (dtMs > 0 && dtMs < 120000) {
        velocidadUltima = Math.round((res.metros / 1000) / dtHoras);
      } else {
        velocidadUltima = 0;
      }
      // El total acumulado SIEMPRE incluye el día en curso (misma
      // convención local y en Firestore → sin dobles cuentas)
      estado = {
        ...estado,
        crudos: estado.crudos + res.metros,
        totalMetros: estado.totalMetros + res.metros,
        puntos: estado.puntos + 1,
        // 🌉 los km de puente se etiquetan aparte (diagnóstico)
        puenteM: res.motivo === 'puente' ? estado.puenteM + res.metros : estado.puenteM,
        ancla: res.nuevoAncla,
      };
      sucio = true;
    } else {
      estado = { ...estado, ancla: res.nuevoAncla };
    }
    persistirLocal();
  }

  emitir();
}

// ── Firestore ────────────────────────────────────────────

function metrosCalibradosHoy(): number {
  return Math.round(estado.crudos * estado.factor);
}

/**
 * Baja el día en curso + total + factor a Firestore (merge de
 * campos, no pisa nada más del doc usuarios/{uid}).
 */
async function flushOdometro(forzar = false): Promise<void> {
  if (!uidActual || !db) return;
  const ahora = Date.now();
  if (!sucio && !forzar) return;
  if (!forzar && ahora - ultimoFlushAt < FLUSH_MS) return;

  const uid = uidActual;
  const hoyM = metrosCalibradosHoy();
  const dia: DiaOdometro = {
    m: hoyM,
    c: Math.round(estado.crudos * 10) / 10,
    n: estado.puntos,
    at: new Date().toISOString(),
  };

  try {
    await setDoc(
      doc(db, 'usuarios', uid),
      {
        'odometro.factor': estado.factor,
        'odometro.totalMetros': Math.round(estado.totalMetros * 10) / 10,
        [`odometro.dias.${estado.fecha}`]: dia,
      },
      { merge: true }
    );
    sucio = false;
    ultimoFlushAt = Date.now();
    // mantener la cache de stats al día (sin releer Firestore)
    diasCache[estado.fecha] = dia;
  } catch (e) {
    console.warn('⚠️ Odómetro: no se pudo guardar en Firestore (se reintenta)', e);
  }
}

/**
 * Arranque: merge del local (rápido) con el remoto (verdad
 * histórica). Toma el MAYOR de hoy (por si se cerró la app sin
 * flush) y adopta factor/total/días del remoto.
 */
async function sincronizarRemoto(uid: string): Promise<void> {
  if (!uid || !db) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const odo = data?.odometro;
    if (!odo) return;

    if (typeof odo.factor === 'number' && odo.factor >= FACTOR_MIN && odo.factor <= FACTOR_MAX) {
      if (!estado.factor || estado.factor === 1) estado = { ...estado, factor: odo.factor };
    }
    if (typeof odo.totalMetros === 'number') {
      estado = { ...estado, totalMetros: Math.max(estado.totalMetros || 0, odo.totalMetros) };
    }
    if (odo.dias && typeof odo.dias === 'object') {
      diasCache = { ...odo.dias };
      const remotoHoy = diasCache[estado.fecha] as DiaOdometro | undefined;
      if (remotoHoy && typeof remotoHoy.c === 'number' && remotoHoy.c > estado.crudos) {
        // Otra sesión dejó más km hoy → adoptar la mayor
        estado = { ...estado, crudos: remotoHoy.c, puntos: remotoHoy.n || estado.puntos };
      }
    }
    persistirLocal();
    emitir();

    // Poda: si el doc acumuló demasiados días viejos (> DIAS_CONSERVAR),
    // borra los más antiguos (el totalMetros conserva la historia).
    const claves = Object.keys(diasCache).sort();
    if (claves.length > DIAS_CONSERVAR) {
      const aBorrar = claves.slice(0, claves.length - DIAS_CONSERVAR);
      const campos: Record<string, any> = {};
      for (const f of aBorrar) campos[`odometro.dias.${f}`] = deleteField();
      await setDoc(doc(db, 'usuarios', uid), campos, { merge: true });
      for (const f of aBorrar) delete diasCache[f];
    }
  } catch (e) {
    console.warn('⚠️ Odómetro: no se pudo sincronizar desde Firestore', e);
  }
}

// ── API pública: stats y calibración ─────────────────────

/** 'YYYY-MM-DD' de hace N días (N negativo = pasado) */
function fechaDia(diasAtras: number): string {
  const d = new Date();
  d.setDate(d.getDate() + diasAtras);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Lee las stats del día en vivo + histórico (cache local) */
export function statsOdometro(): StatsOdometro {
  const hoy = hoyLocal();
  const hoyM = hoy === estado.fecha ? metrosCalibradosHoy() : 0;
  const hoyCrudoM = hoy === estado.fecha ? Math.round(estado.crudos) : 0;
  const puenteM = hoy === estado.fecha ? Math.round(estado.puenteM * estado.factor) : 0;
  const ayerM = (diasCache[fechaDia(-1)] as DiaOdometro | undefined)?.m || 0;
  // 7 días: hoy en vivo + últimos 6 del cache
  let dias7M = hoyM;
  for (let i = 1; i < 7; i++) {
    dias7M += (diasCache[fechaDia(-i)] as DiaOdometro | undefined)?.m || 0;
  }
  const totalM = Math.round(estado.totalMetros * estado.factor);
  return {
    hoyM,
    hoyCrudoM,
    puenteM,
    ayerM,
    dias7M,
    totalM,
    factor: estado.factor,
    contando,
    ultimaSenalAt,
    velocidadKmh: velocidadUltima,
  };
}

/**
 * Snapshot ESTABLE para useSyncExternalStore (misma referencia
 * hasta que el tick cambia — si no, React entra en loop).
 */
export function snapshotOdometro(): StatsOdometro {
  if (!snapCache || snapTickCache !== snapshotTick) {
    snapCache = statsOdometro();
    snapTickCache = snapshotTick;
  }
  return snapCache;
}

/**
 * F3.42 (podcast): km calibrados de los últimos N días (hoy
 * incluido, del más viejo al más nuevo) — para el episodio
 * semanal. LECTURA pura del cache de días, sin side effects.
 */
export function diasUltimosKm(n: number): { fecha: string; m: number }[] {
  const total = Math.max(1, Math.round(n || 7));
  const out: { fecha: string; m: number }[] = [];
  for (let i = total - 1; i >= 0; i--) {
    const fecha = i === 0 ? hoyLocal() : fechaDia(-i);
    const m = i === 0
      ? (hoyLocal() === estado.fecha ? metrosCalibradosHoy() : 0)
      : (diasCache[fecha] as DiaOdometro | undefined)?.m || 0;
    out.push({ fecha, m });
  }
  return out;
}

/** Suscripción a cambios del odómetro (para useSyncExternalStore) */
export function suscribirOdometro(cb: () => void): () => void {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

/**
 * Fuerza una relectura de las stats desde Firestore (para el
 * menú: ayer/7días pueden venir de otra sesión).
 */
export async function recargarStatsRemotas(uid: string): Promise<void> {
  if (!uid || !db) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (snap.exists()) {
      const odo = (snap.data() as any)?.odometro;
      if (odo?.dias && typeof odo.dias === 'object') diasCache = { ...odo.dias };
    }
    emitir();
  } catch {
    // silencioso — el cache local sirve de respaldo
  }
}

/** Ajusta el factor de calibración (0.50 – 2.00) y baja a Firestore */
export async function ajustarFactor(uid: string, factor: number): Promise<number> {
  const f = Math.round(Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, factor)) * 100) / 100;
  estado = { ...estado, factor: f };
  sucio = true;
  persistirLocal();
  emitir();
  uidActual = uidActual || uid;
  await flushOdometro(true);
  return f;
}

/** Reinicia el conteo de HOY (por si algo salió mal) y corrige el total */
export async function reiniciarDia(uid: string): Promise<void> {
  iniciarDiaSiCorresponde();
  const crudoHoy = estado.crudos;
  estado = {
    ...estado,
    crudos: 0,
    puenteM: 0,
    puntos: 0,
    ancla: null,
    totalMetros: Math.max(0, estado.totalMetros - crudoHoy),
  };
  sucio = true;
  persistirLocal();
  emitir();
  uidActual = uidActual || uid;
  await flushOdometro(true);
}

// ── 🔆 PANTALLA VIVA (F3.37) ──────────────────────────
// Opcional: mientras el cronómetro corre, pide un WAKE LOCK al
// navegador para que la pantalla no se apague. Con la pantalla
// viva el GPS no se congela → cero puentes, conteo exacto.
// (Ideal si llevas el teléfono en el soporte de la moto.)

let wakeLock: any = null;

function clavePantalla(uid: string): string {
  return `rt_odo_pantalla_${uid}`;
}

/** ¿El rider activó "pantalla viva"? */
export function pantallaViva(uid: string): boolean {
  try {
    return localStorage.getItem(clavePantalla(uid)) === '1';
  } catch {
    return false;
  }
}

/** Activa/desactiva la pantalla viva. Devuelve el nuevo estado. */
export function alternarPantallaViva(uid: string): boolean {
  const nuevo = !pantallaViva(uid);
  try {
    localStorage.setItem(clavePantalla(uid), nuevo ? '1' : '0');
  } catch {
    // sin storage
  }
  if (nuevo) {
    void pedirWakeLock();
  } else {
    liberarWakeLock();
  }
  return nuevo;
}

async function pedirWakeLock(): Promise<void> {
  try {
    const nav = navigator as any;
    if (!nav?.wakeLock?.request) return; // WebView sin la API — silencio
    wakeLock = await nav.wakeLock.request('screen');
  } catch {
    // el sistema puede negarse (batería baja, etc.) — silencio
    wakeLock = null;
  }
}

function liberarWakeLock(): void {
  try {
    wakeLock?.release?.();
  } catch {
    // ya liberado
  }
  wakeLock = null;
}

// ── MOTOR GPS (montado 1 vez en App.tsx) ─────────────────

let detenerWatch: (() => void) | null = null;
let timerFlush: ReturnType<typeof setInterval> | null = null;
let timerCrono: ReturnType<typeof setInterval> | null = null;
let escuchaCrono: (() => void) | null = null;
let escuchaVisibilidad: (() => void) | null = null;

function setContando(v: boolean) {
  if (contando !== v) {
    contando = v;
    emitir();
  }
}

function chequearCrono(uid: string) {
  const crono = leerCronoRuta(uid);
  const queriendo = !!crono?.activo;

  if (queriendo && !detenerWatch) {
    // 🟢 Jornada activa → abrir el watch GPS del odómetro
    detenerWatch = vigilarPosicion(
      (c) => procesarPuntoGPS(uid, c),
      () => undefined // errores de GPS: silencio (el watchdog reintenta)
    );
    setContando(true);
    // 🔆 pantalla viva activada → evitar que se apague mientras cuenta
    if (pantallaViva(uid)) void pedirWakeLock();
  } else if (!queriendo && detenerWatch) {
    // ⏸ Jornada terminada/pausada → cerrar watch y guardar
    try { detenerWatch(); } catch { /* ya muerto */ }
    detenerWatch = null;
    liberarWakeLock(); // jornada parada → dejar que la pantalla duerma
    setContando(false);
    void flushOdometro(true);
  }
}

/**
 * Arranca el motor del odómetro para este usuario. Abre el GPS
 * SOLO mientras el cronómetro de ruta esté activo, guarda cada
 * 45 s y al pausar/terminar. Devuelve la función para detener.
 * Llamarlo 2 veces con el mismo uid no duplica nada (guard).
 */
export function arrancarMotorOdometro(uid: string): () => void {
  if (uidActual === uid && (detenerWatch || timerFlush)) {
    return () => undefined; // ya corriendo
  }

  // Reset del estado si cambia de usuario (cambio de cuenta)
  if (uidActual !== uid) {
    uidActual = uid;
    estado = cargarLocal(uid);
    iniciarDiaSiCorresponde();
    ultimaSenalAt = null;
    velocidadUltima = 0;
    void sincronizarRemoto(uid);
  } else {
    iniciarDiaSiCorresponde();
  }

  // Chequeo inicial (crono ya activo al abrir la app → cuenta ya)
  chequearCrono(uid);

  // Evento del cronómetro (arrancar/pausar desde Mi Ruta dispara
  // 'rt-crono-cambio' → el motor reacciona AL INSTANTE)
  const alEventoCrono = () => chequearCrono(uid);
  window.addEventListener('rt-crono-cambio', alEventoCrono as EventListener);
  escuchaCrono = () => window.removeEventListener('rt-crono-cambio', alEventoCrono as EventListener);

  // Re-chequeo periódico (por si el evento se pierde) + cambio de día
  timerCrono = setInterval(() => {
    iniciarDiaSiCorresponde();
    chequearCrono(uid);
  }, CHEQUEO_CRONO_MS);

  // Flush periódico de lo acumulado
  timerFlush = setInterval(() => {
    if (sucio) void flushOdometro();
  }, FLUSH_MS);

  // Al minimizar la app → guardar ya (Android puede matar la webview)
  // Al volver a primer plano → re-pedir el wake lock (el sistema
  // lo libera automáticamente cuando la página queda oculta)
  const alOcultar = () => {
    if (document.hidden) {
      void flushOdometro(true);
    } else if (contando && uidActual && pantallaViva(uidActual)) {
      void pedirWakeLock();
    }
  };
  document.addEventListener('visibilitychange', alOcultar);
  escuchaVisibilidad = () => document.removeEventListener('visibilitychange', alOcultar);

  return () => {
    if (escuchaCrono) escuchaCrono();
    if (escuchaVisibilidad) escuchaVisibilidad();
    if (timerCrono) clearInterval(timerCrono);
    if (timerFlush) clearInterval(timerFlush);
    timerCrono = null;
    timerFlush = null;
    escuchaCrono = null;
    escuchaVisibilidad = null;
    if (detenerWatch) {
      try { detenerWatch(); } catch { /* ya muerto */ }
      detenerWatch = null;
    }
    liberarWakeLock();
    setContando(false);
    void flushOdometro(true);
  };
}

// ── Formato para la UI ───────────────────────────────────

export function formatearKm(metros: number): string {
  if (metros >= 100000) return `${(metros / 1000).toFixed(0)} km`;
  return `${(metros / 1000).toFixed(1)} km`;
}
