// ═══════════════════════════════════════════════════════════
// 📊 FIRESTORE SERVICE - RiderTrack V2
// Maneja carga/guardado de datos en Firestore
// Compatible con RiderTrack Modular (misma estructura)
// ═══════════════════════════════════════════════════════════

import { db, storage } from './firebase';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  getDocFromCache,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { hoyISO, desglosarCobros, conTotalesCorregidos } from '../utils/stats'; // ⚡ F3.48 fecha Lima · ⚡ F3.50 desglose único de cobros
// 📅 FASE AD: motor puro de reprogramados (noEntregados para el
// cierre) + tipos de la cola. `import type` se borra al compilar
// → sin ciclo runtime firestore↔reprog.
import { noEntregados, claveHistorial } from './reprog';
import type { Reprogramado, UltimaCerrada } from './reprog';
import { cargarConfigPagoPedidos, calcularPagoPedidos } from '../utils/pagoPedidosCore'; // 🛵 FASE D
// 🚀 FASE AB-2: la librería de Excel ya NO viaja en el paquete inicial
// (se cargaba SIEMPRE aunque nunca importaras un backup): ahora se trae
// SOLO cuando importarExcel() de verdad la necesita (import() dinámico).
import { montosConRespaldo, parseMonedaPeru } from '../utils/moneda'; // 💰 FASE Z — parseo S/ robusto

// ═══════════════════════════════════════════════════════════
// 📋 TIPOS DE CLIENTE
// ═══════════════════════════════════════════════════════════

export interface Cliente {
  id: string | number;
  num: number;
  nombre: string;
  cel: string;
  prod: string;
  precio: number;
  cobrar: number;
  dir: string;
  dist: string;
  obs: string;
  st: string;
  mEf: number;
  mYp: number;
  mEmp: number;
  mVt: number;
  mEM: string;
  hora: string;
  nota: string;
  fotoUrl?: string;
  respondioInicioRuta?: boolean;
  /** ✅ Registro en la web (Fase 2.6 — como la v1): ya pasó a la
   *  página de la empresa. Se marca desde el panel de Verificación. */
  webReg?: boolean;
  /** Coordenadas geocodificadas (Fase 1.3) — se persisten para
   *  no volver a geocodificar la misma dirección nunca más */
  lat?: number;
  lng?: number;
  /** Origen de la coordenada: google | nominatim | aprox | manual (Fase 1.4) */
  latSrc?: 'google' | 'nominatim' | 'aprox' | 'manual';
  /** 🛵 FASE D: marca manual del rider para el cobro por pedido —
   *  true = tarifa lejos (S/12), false = normal (S/9). undefined =
   *  lo decide la lista de distritos lejanos de la config. Viaja
   *  con el cliente (ruta_activa + usuarios) → aparece en el cel 2. */
  lejos?: boolean;
  /** 📅 FASE AD: para cuándo quedó reprogramado (YYYY-MM-DD) — se
   *  muestra en la tarjeta como “📅 para {fecha}” cuando st=reprogramar */
  reprogramadoPara?: string;
  /** 📅 FASE AD: true = este pedido ingresó a la ruta tras un
   *  reprogramado (agregado con ➕ o porque el Excel nuevo ya lo
   *  traía) → badge 🔁 en la tarjeta */
  reprog?: boolean;
  /** 📅 FASE AD: fecha de la ruta de la que vino (YYYY-MM-DD) —
   *  para mostrar “fallido el {fecha}” junto al badge */
  reprogDesde?: string;
}

export interface RutaActiva {
  activa: boolean;
  iniciadaAt?: string;
  actualizadaAt?: string;
  rider?: {
    nombre: string;
    telefono: string;
    empresa: string;
  };
  clientes?: any[];
  clienteActualIdx?: number;
  totalClientes?: number;
  pendientes?: number;
}

/** Registro del historial de rutas (Fase 2.5) — un doc por cierre de ruta */
export interface RegistroHistorial {
  id: string;
  uid: string;
  fecha: string;            // YYYY-MM-DD
  iniciadaAt?: string;
  finalizadaAt?: string;
  totalClientes: number;
  entregados: number;
  fallidos: number;
  pendientes: number;
  cobradoTotal: number;
  /** Desglose de S/ por método (efectivo, yape-rudy, empresa...) */
  porMetodo?: Record<string, number>;
  /** S/ pagados por empresa (st=empresa, pos, transferencia... + mEmp de mixto) */
  totalEmpresa?: number;
  /** S/ que quedan para el rider (efectivo, yape-rudy... + mEf de mixto) */
  totalRider?: number;
  clientes?: any[];
  /** Fase 2.6: ruta importada del historial de la versión 1 */
  origen?: 'v1';
  /** id original del registro v1 (timestamp ms) — para no importar 2 veces */
  v1Id?: number;
  /** km recorridos (solo rutas v1 — la v1 lo guardaba al cerrar) */
  km?: number;
  /** duración de la ruta en ms (solo rutas v1) */
  tiempoRuta?: number;
  /** 🛵 FASE D: cobro por pedido (temporada) — desglose del día si
   *  la ruta se cerró con el modo activo (null/ausente = jornal) */
  pagoPedidos?: {
    activo: boolean;
    tarifaNormal: number;
    tarifaLejos: number;
    distritosLejos: string[];
    cantidadNormal: number;
    cantidadLejos: number;
    entregados: number;
    montoNormal: number;
    montoLejos: number;
    total: number;
  };
}

/** Entrada del historial de la v1 (D.hist en el Rider Modular v1) */
export interface RutaV1 {
  id?: number;
  fechaId?: string;   // YYYY-MM-DD
  fecha?: string;     // "23 may. 2026"
  fechaL?: string;    // "sábado, 23 de mayo de 2026"
  total?: number;
  ent?: number;
  fal?: number;
  pen?: number;
  tT?: number;        // total LO TUYO (S/)
  tE?: number;        // total EMPRESA (S/)
  km?: number;
  tiempoRuta?: number;
  /** desglose v1: ef, yr, ye, mT, po, tr, yp, pl, js, em */
  dg?: Record<string, number>;
  cl?: any[];
}

/** Backup en la nube (Fase 2.5) — snapshot completo de la ruta */
export interface BackupNube {
  id: string;
  uid: string;
  creadoAt: string;
  fecha: string;            // YYYY-MM-DD
  hora: string;             // HH:MM
  totalClientes: number;
  entregados: number;
  pendientes: number;
  fallidos: number;
  cobradoTotal: number;
  clientes: Cliente[];
  /** ⚡ F3.53: 'cierre-ruta' (🏁 al finalizar) | 'auto-guardado' (respaldo vivo 15 min) */
  tipo?: string;
  /** ⚡ F3.53: 'v1' = viene de usuarios/{uid}/backups (Rider Modular v1 / legacy) */
  origen?: 'v1' | 'v2';
  auto?: boolean;           // creado automáticamente
}

// ═══════════════════════════════════════════════════════════
// 💾 GUARDAR/CARGAR CLIENTES
// ═══════════════════════════════════════════════════════════

// Guardar lista de clientes en Firestore
export async function guardarClientes(userId: string, clientes: Cliente[]): Promise<void> {
  if (!db || !userId) return;
  try {
    const userDocRef = doc(db, 'usuarios', userId);
    await setDoc(userDocRef, {
      clientes: clientes,
      actualizadoEn: serverTimestamp(),
    }, { merge: true });
    console.log('✅ Clientes guardados en Firestore:', clientes.length);
  } catch (e) {
    console.error('❌ Error guardando clientes:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// 📅 FASE AD: COLA DE REPROGRAMADOS + ÚLTIMA RUTA CERRADA
// Viven en el MISMO doc del usuario (usuarios/{uid}, merge-write
// → jamás toca `clientes` ni `config`): la cola en `reprogramados`
// y el snapshot del cierre en `ultimaCerrada`. Cero reglas nuevas:
// ese doc ya es lectura/escritura del dueño (guardarClientes igual).
// ═══════════════════════════════════════════════════════════

/** Guarda la cola completa de reprogramados (merge en usuarios) */
export async function guardarReprogramados(userId: string, items: Reprogramado[]): Promise<void> {
  if (!db || !userId) return;
  try {
    await setDoc(doc(db, 'usuarios', userId), {
      reprogramados: items,
      reprogActualizadoEn: serverTimestamp(),
    }, { merge: true });
    console.log('✅ Reprogramados guardados:', items.length);
  } catch (e) {
    console.error('❌ Error guardando reprogramados:', e);
  }
}

/**
 * 🆕 AE-2: guarda la cola Y el snapshot de la última cerrada en
 * UNA sola escritura atómica (merge). La ✕ de la listita necesita
 * tocar las DOS a la vez: si iban por separado, el efecto de
 * auto-cuidado veía el estado a medias (cola sin el ítem pero
 * ultimaCerrada todavía lo recuerda) y lo RE-MIGRABA al toque —
 * "apretás la ✕, desaparece el nombre y vuelve a aparecer en el
 * mismo lugar" (Rudy, 18 oct).
 */
export async function guardarColaYUltima(
  userId: string,
  items: Reprogramado[],
  ultima: UltimaCerrada | null
): Promise<void> {
  if (!db || !userId) return;
  try {
    const body: Record<string, unknown> = {
      reprogramados: items,
      reprogActualizadoEn: serverTimestamp(),
    };
    if (ultima) body.ultimaCerrada = ultima;
    await setDoc(doc(db, 'usuarios', userId), body, { merge: true });
    console.log('✅ Cola + última cerrada guardadas juntas:', items.length);
  } catch (e) {
    console.error('❌ Error guardando cola+última:', e);
  }
}

/**
 * 📅 FASE AD: persiste el snapshot de la última ruta cerrada. Se usa
 * en la MIGRACIÓN: las rutas cerradas con versiones anteriores no
 * escribieron `ultimaCerrada` — al leerla del historial (respaldo),
 * se guarda acá para que el snapshot en vivo no la pise con null
 * en cada escritura del doc (bug encontrado en el E2E: el banner
 * de "fallidos de ayer" desaparecía al primer guardar).
 */
export async function guardarUltimaCerrada(userId: string, ultima: UltimaCerrada): Promise<void> {
  if (!db || !userId) return;
  try {
    await setDoc(doc(db, 'usuarios', userId), { ultimaCerrada: ultima }, { merge: true });
  } catch (e) {
    console.error('❌ Error guardando ultimaCerrada:', e);
  }
}

/**
 * Escucha la cola de reprogramados + el snapshot de la última
 * ruta cerrada en TIEMPO REAL (mismo doc que subscribeToClientes
 * → el SDK comparte el watch, costo marginal cero).
 */
export function subscribeToReprogramados(
  userId: string,
  onUpdate: (reprogramados: Reprogramado[], ultimaCerrada: UltimaCerrada | null) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db || !userId) {
    onUpdate([], null);
    return () => {};
  }
  try {
    const userDocRef = doc(db, 'usuarios', userId);
    return onSnapshot(
      userDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          onUpdate([], null);
          return;
        }
        const data = snapshot.data();
        const cola = Array.isArray(data.reprogramados) ? (data.reprogramados as Reprogramado[]) : [];
        const uc = data.ultimaCerrada;
        const ultima =
          uc && typeof uc === 'object' && Array.isArray((uc as any).noEntregados)
            ? (uc as UltimaCerrada)
            : null;
        onUpdate(cola, ultima);
      },
      (err) => {
        console.warn('Error subscribe reprogramados:', err);
        onError?.(err);
        onUpdate([], null);
      }
    );
  } catch (e) {
    console.warn('Excepción subscribe reprogramados:', e);
    onUpdate([], null);
    return () => {};
  }
}

/**
 * 📅 FASE AD: la última ruta CERRADA del usuario — respaldo para
 * el cruce de “fallidos de ayer” cuando `usuarios.ultimaCerrada`
 * todavía no existe (rutas cerradas con versiones anteriores a
 * la FASE AD — al leerlo una vez, se migra al doc del usuario).
 * Light: máx 30 docs + orden local por HORA LIMA (🆕 AE-2: antes
 * ordenaba por timestamps UTC y una ruta cerrada a las 22:00 Lima
 * llevaba finalizadaAt del día siguiente en UTC → el respaldo
 * podía elegir UNA RUTA VIEJA y la listita quedaba atrás:
 * "registra del 15" con historial hasta el 16).
 */
export async function leerUltimaRuta(userId: string): Promise<RegistroHistorial | null> {
  if (!db || !userId) return null;
  try {
    const ref = collection(db, 'historial_rutas');
    const q = query(ref, where('uid', '==', userId), limit(30));
    const snap = await getDocs(q);
    const registros: RegistroHistorial[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (data?.uid !== userId && !d.id.startsWith(`${userId}_`)) return;
      registros.push({
        id: d.id,
        uid: data.uid || userId,
        fecha: data.fecha || '',
        iniciadaAt: data.iniciadaAt,
        finalizadaAt: data.finalizadaAt,
        totalClientes: data.totalClientes || 0,
        entregados: data.entregados || 0,
        fallidos: data.fallidos || 0,
        pendientes: data.pendientes || 0,
        cobradoTotal: data.cobradoTotal || 0,
        clientes: data.clientes || [],
      });
    });
    registros.sort((a, b) => claveHistorial(b).localeCompare(claveHistorial(a)));
    return registros[0] || null;
  } catch (e) {
    console.error('❌ Error leyendo última ruta:', e);
    return null;
  }
}

// Cargar clientes desde Firestore en tiempo real
export function subscribeToClientes(
  userId: string,
  onUpdate: (clientes: Cliente[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db || !userId) {
    console.warn('Firestore: no disponible o sin userId');
    onUpdate([]);
    return () => {};
  }

  try {
    const userDocRef = doc(db, 'usuarios', userId);
    return onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.clientes && Array.isArray(data.clientes)) {
            onUpdate(data.clientes as Cliente[]);
          } else {
            onUpdate([]);
          }
        } else {
          onUpdate([]);
        }
      },
      (err) => {
        console.warn('Error cargando clientes:', err);
        if (onError) onError(err);
        onUpdate([]);
      }
    );
  } catch (e) {
    console.warn('Excepción:', e);
    onUpdate([]);
    return () => {};
  }
}

// ═══════════════════════════════════════════════════════════
// 🚀 RUTA ACTIVA (para el bot de Baileys)
// ═══════════════════════════════════════════════════════════

// Publicar ruta activa (para que el bot de Baileys la lea)
export async function publicarRutaActiva(
  userId: string,
  clientes: Cliente[],
  riderConfig: { nombre: string; telefono: string; empresa: string }
): Promise<void> {
  if (!db || !userId) return;

  const datos = {
    activa: true,
    iniciadaAt: new Date().toISOString(),
    actualizadaAt: new Date().toISOString(),
    rider: riderConfig,
    clientes: clientes.map((c, idx) => ({
      idx: idx,
      id: c.id,
      nombre: c.nombre || 'Cliente',
      cel: _botCel(c.cel || ''),
      cobrar: parseFloat(String(c.cobrar || 0)),
      precio: parseFloat(String(c.precio || 0)),
      prod: c.prod || '',
      dir: c.dir || '',
      dist: c.dist || '',
      st: c.st || 'pendiente',
      nota: c.nota || '',
      obs: c.obs || '',
      hora: c.hora || '',
    })),
    clienteActualIdx: -1,
    totalClientes: clientes.length,
    pendientes: clientes.filter(c => c.st === 'pendiente' || !c.st).length,
  };

  try {
    await setDoc(doc(db, 'ruta_activa', userId), datos, { merge: true });
    console.log('🚀 Ruta activa publicada');
  } catch (e) {
    console.error('❌ Error publicando ruta:', e);
  }
}

// Actualizar ruta activa (cuando cambia el estado de un cliente)
export async function actualizarRutaActiva(userId: string, clientes: Cliente[]): Promise<void> {
  if (!db || !userId) return;

  const update = {
    actualizadaAt: new Date().toISOString(),
    clientes: clientes.map((c, idx) => ({
      idx: idx,
      id: c.id,
      nombre: c.nombre || 'Cliente',
      cel: _botCel(c.cel || ''),
      cobrar: parseFloat(String(c.cobrar || 0)),
      prod: c.prod || '',
      dir: c.dir || '',
      dist: c.dist || '',
      st: c.st || 'pendiente',
    })),
    pendientes: clientes.filter(c => c.st === 'pendiente' || !c.st).length,
  };

  try {
    await setDoc(doc(db, 'ruta_activa', userId), update, { merge: true });
  } catch (e) {
    console.warn('Error actualizando ruta:', e);
  }
}

// Finalizar ruta activa
export async function finalizarRutaActiva(userId: string): Promise<void> {
  if (!db || !userId) return;
  try {
    await setDoc(doc(db, 'ruta_activa', userId), {
      activa: false,
      finalizadaAt: new Date().toISOString(),
      actualizadaAt: new Date().toISOString(),
    }, { merge: true });
    console.log('✅ Ruta finalizada');
  } catch (e) {
    console.warn('Error finalizando ruta:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// 🏁 GESTIÓN DE RUTA (Finalizar, Guardar y Cerrar, Limpiar)
// ═══════════════════════════════════════════════════════════

/**
 * FINALIZAR Y GUARDAR RUTA (= cerrar() de la v1):
 * 1. Guarda el registro completo en historial_rutas (con tu plata
 *    y la de la empresa, como D.hist de la v1)
 * 2. Backup automático a la nube (usuarios/{uid}/backups/auto_{fecha},
 *    como _backupAutoAlCerrar de la v1)
 * 3. Registra los clientes en clientes_registrados (respaldo)
 * 4. LIMPIA ruta_activa y usuarios/{uid}.clientes → la lista queda
 *    vacía para el día siguiente (v1: D.cl=[] tras cerrar)
 * ⚠️ Fase 2.6 (fix): ANTES dejaba los clientes en ruta_activa “para
 * consulta” y “Guardar y cerrar” ni siquiera guardaba en historial —
 * el usuario se quedaba con la lista vieja y sin historial.
 */
export async function finalizarRuta(userId: string, clientes: Cliente[], tiempoRutaMs?: number): Promise<{ backupNube: boolean }> {
  if (!db || !userId) return { backupNube: false };
  try {
    // 1. Calcular resumen del día
    const total = clientes.length;

    // 2. Guardar registro en historial_rutas
    // (Fase 2.5: ID único por cierre con timestamp — antes era
    //  `${uid}_${fecha}` con merge y dos cierres el mismo día se
    //  fusionaban. Se agregan desgloses por método y rider/empresa.)
    // (Fase 2.6: mixto se divide como en la v1 — mEf para ti, mEmp
    //  para la empresa — y yape-efectivo descuenta el vuelto. El
    //  snapshot de clientes ahora guarda mEf/mYp/mEmp/mVt para el
    //  Excel y el detalle.)
    // ⚡ F3.50: el desglose tuyo/empresa sale de desglosarCobros
    //  (stats.ts) — ÚNICA fuente de verdad, las mismas reglas que
    //  las estadísticas en vivo y la caja. ANTES aquí había una
    //  lista propia ST_EMPRESA sin 'yape-plin' → al cerrar la ruta,
    //  el Yape/Plin de la EMPRESA se sumaba como efectivo del
    //  RIDER y descuadraba la caja al cuadrar (bug real reportado:
    //  José Smith sí se descontaba, Yape Plin no).
    const fechaHoy = hoyISO(); // ⚡ F3.48: HORA DE LIMA — antes usaba toISOString() (UTC) y después de las 7pm la ruta se guardaba como MAÑANA

    const desglose = desglosarCobros(clientes);
    const entregados = desglose.entregados;
    const fallidos = desglose.fallidos;
    const porMetodo = desglose.porMetodo;
    const totalEmpresa = desglose.totalEmpresa;
    const totalRider = desglose.totalRider;
    const cobrado = desglose.cobradoTotal;

    // 🛵 FASE D: pago por pedido (temporada) — si el modo estaba activo
    // al cerrar la ruta, el desglose 9/12 queda grabado en el historial
    // (los días de modo OFF no guardan nada = idénticos a antes).
    const cfgPago = cargarConfigPagoPedidos();
    const pagoPedidos = cfgPago.activo
      ? {
          activo: true,
          tarifaNormal: cfgPago.tarifaNormal,
          tarifaLejos: cfgPago.tarifaLejos,
          distritosLejos: cfgPago.distritosLejos,
          ...calcularPagoPedidos(clientes, cfgPago),
        }
      : null;

    // Snapshot de clientes (mismo formato que viaja al historial,
    // al backup de la nube y a clientes_registrados)
    const clientesSnapshot = clientes.map(c => ({
      id: c.id,
      num: c.num || null,
      nombre: c.nombre || 'Cliente',
      cel: c.cel || '',
      prod: c.prod || '',
      cobrar: parseFloat(String(c.cobrar || 0)),
      mEf: parseFloat(String(c.mEf || 0)),
      mYp: parseFloat(String(c.mYp || 0)),
      mEmp: parseFloat(String(c.mEmp || 0)),
      mVt: parseFloat(String(c.mVt || 0)),
      dir: c.dir || '',
      dist: c.dist || '',
      st: c.st || 'pendiente',
      hora: c.hora || '',
      obs: c.obs || '',
      nota: c.nota || '',
      // 📸 Fase 2.16: la foto de evidencia viaja al historial — así la
      // Galería de Entregas puede mostrar las fotos de rutas cerradas
      // (antes el snapshot la omitía y la foto quedaba huérfana en Storage)
      fotoUrl: c.fotoUrl,
      // ✅ el check de verificación con la empresa viaja al historial
      webReg: c.webReg === true,
      // 🛵 FASE D: la marca lejos viaja al historial (para re-ver el
      // desglose de 9/12 de rutas pasadas)
      ...(typeof c.lejos === 'boolean' ? { lejos: c.lejos } : {}),
    }));

    // 2a. Escribir el registro en historial_rutas
    // (limpiarUndefined: ningún campo `undefined` puede entrar — Firestore lo rechaza)
    await setDoc(doc(db, 'historial_rutas', `${userId}_${Date.now()}`), limpiarUndefined({
      uid: userId,
      fecha: fechaHoy,
      iniciadaAt: new Date().toISOString(),
      finalizadaAt: new Date().toISOString(),
      totalClientes: total,
      entregados: entregados,
      fallidos: fallidos,
      pendientes: total - entregados - fallidos,
      cobradoTotal: cobrado,
      porMetodo,
      totalEmpresa,
      totalRider,
      // ⏱ duración de la ruta medida por el cronómetro (como la v1)
      tiempoRuta: tiempoRutaMs && tiempoRutaMs > 0 ? tiempoRutaMs : null,
      clientes: clientesSnapshot,
      // 🛵 FASE D (solo días con modo activo — el spread con null
      // no agrega el campo, los días OFF quedan idénticos a antes)
      ...(pagoPedidos ? { pagoPedidos } : {}),
    }));

    // 2b. ☁️ Backup automático a la nube (v1: _backupAutoAlCerrar).
    //     ⚡ F3.48: ahora se guarda en DOS sitios y ya NO falla en silencio:
    //       · usuarios/{uid}/backups/auto_{fecha} → igual que la v1 (legacy)
    //       · backups_v2 → el que VE la pantalla ☁️ Backups (chip "auto")
    //     Si ambos fallan, NO bloquea el cierre — el historial ya está guardado,
    //     pero ahora el usuario se entera (toast en el cierre de la ruta).
    let backupNube = false;
    try {
      await setDoc(doc(db, 'usuarios', userId, 'backups', `auto_${fechaHoy}`), limpiarUndefined({
        cl: clientesSnapshot,
        registro: { fecha: fechaHoy, total, entregados, fallidos, cobradoTotal: cobrado, totalRider, totalEmpresa, porMetodo },
        fecha: fechaHoy,
        hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        clientes: total,
        auto: true,
        tipo: 'cierre-ruta',
        creadoAt: new Date().toISOString(),
      }), { merge: true });
      backupNube = true;
      console.log('☁️ Backup automático de cierre guardado (auto_' + fechaHoy + ') — ruta v1');
    } catch (e) {
      console.warn('⚠️ Backup de cierre (ruta v1) falló — el historial SÍ se guardó:', (e as Error).message);
    }
    try {
      await setDoc(doc(db, 'backups_v2', `${userId}_${Date.now()}`), limpiarUndefined({
        uid: userId,
        creadoAt: new Date().toISOString(),
        fecha: fechaHoy,
        hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        totalClientes: total,
        entregados,
        fallidos,
        pendientes: total - entregados - fallidos,
        cobradoTotal: cobrado,
        totalRider,
        totalEmpresa,
        clientes: clientesSnapshot,
        auto: true,
        tipo: 'cierre-ruta',
      }));
      backupNube = true;
      console.log('☁️ Backup automático de cierre guardado en backups_v2 (visible en ☁️ Backups)');
    } catch (e) {
      console.warn('⚠️ Backup de cierre (backups_v2) falló — el historial SÍ se guardó:', (e as Error).message);
    }

    // 2c. Registrar clientes (respaldo histórico — como hacía
    //     “Guardar y cerrar”). Si falla, no bloquea el cierre.
    try {
      const batch = writeBatch(db);
      let enBatch = 0;
      clientes.forEach((c) => {
        const tel = String(c.cel || '').replace(/\D/g, '');
        if (!tel) return;
        batch.set(doc(db, 'clientes_registrados', tel), {
          telefono: tel,
          nombre: c.nombre || '',
          prod: c.prod || '',
          cobrar: parseFloat(String(c.cobrar || 0)),
          dir: c.dir || '',
          dist: c.dist || '',
          st: c.st || 'pendiente',
          ultimaVisita: new Date().toISOString(),
          registradoAt: new Date().toISOString(),
        }, { merge: true });
        enBatch++;
      });
      if (enBatch > 0) await batch.commit();
    } catch (e) {
      console.warn('⚠️ clientes_registrados falló (no bloquea el cierre):', (e as Error).message);
    }

    // 3. 🧹 LIMPIAR la ruta para el día siguiente (v1: D.cl=[]).
    //    El bot también deja de reconocer clientes (ruta inactiva).
    await setDoc(doc(db, 'ruta_activa', UID_BOT_MODULAR), {
      clientes: [],
      totalClientes: 0,
      pendientes: 0,
      activa: false,
      finalizadaAt: new Date().toISOString(),
      actualizadaAt: new Date().toISOString(),
      resumen: { total, entregados, fallidos, cobradoTotal: cobrado },
    }, { merge: true });

    // 4. Limpiar también el respaldo local de clientes
    //    📅 FASE AD: en el MISMO merge viaja el snapshot de la última
    //    ruta cerrada (fecha + no entregados CON coordenadas) — al día
    //    siguiente Mi Ruta cruza solita quiénes volvieron reprogramados
    //    en el Excel nuevo (badge 🔁) y quiénes no volvieron (botón ➕
    //    Pasar a hoy, sin bajar el Excel completo de nuevo).
    //    Si falla, NO bloquea el cierre (mismo try/catch que antes).
    const noEntSnap = noEntregados(clientes).map((c) => ({
      id: c.id,
      num: c.num || null,
      nombre: c.nombre || 'Cliente',
      cel: c.cel || '',
      prod: c.prod || '',
      precio: parseFloat(String(c.precio || 0)),
      cobrar: parseFloat(String(c.cobrar || 0)),
      dir: c.dir || '',
      dist: c.dist || '',
      obs: c.obs || '',
      st: c.st || 'pendiente',
      hora: c.hora || '',
      nota: c.nota || '',
      ...(typeof c.lat === 'number' && typeof c.lng === 'number'
        ? { lat: c.lat, lng: c.lng, ...(c.latSrc ? { latSrc: c.latSrc } : {}) }
        : {}),
      ...(typeof c.lejos === 'boolean' ? { lejos: c.lejos } : {}),
      ...(c.reprogramadoPara ? { reprogramadoPara: c.reprogramadoPara } : {}),
    }));
    try {
      await setDoc(doc(db, 'usuarios', userId), {
        clientes: [],
        rutaLimpiadaAt: new Date().toISOString(),
        ultimaCerrada: {
          fecha: fechaHoy,
          noEntregados: noEntSnap,
        },
      }, { merge: true });
    } catch (e) {
      console.warn('⚠️ No se pudo limpiar usuarios/{uid}.clientes:', (e as Error).message);
    }

    console.log('🏁 Ruta finalizada: historial + backup nube + lista limpia');
    return { backupNube };
  } catch (e) {
    console.error('❌ Error finalizando ruta:', e);
    throw e;
  }
}

/**
 * GUARDAR Y CERRAR RUTA — ⚠️ Fase 2.6 (fix): ahora hace EXACTAMENTE
 * lo mismo que finalizarRuta (= cerrar() de la v1: historial + nube
 * + lista limpia). Antes guardaba en clientes_registrados pero NO en
 * el historial y dejaba la lista sucia — confundía al usuario.
 */
export async function guardarYCerrarRuta(userId: string, clientes: Cliente[], tiempoRutaMs?: number): Promise<{ backupNube: boolean }> {
  return finalizarRuta(userId, clientes, tiempoRutaMs);
}

/**
 * LIMPIAR SIN GUARDAR:
 * Elimina TODOS los clientes de ruta_activa y del estado local.
 * NO guarda nada en historial ni clientes_registrados.
 * Útil cuando quieres empezar de cero con un Excel nuevo.
 */
export async function limpiarRutaSinGuardar(userId: string): Promise<void> {
  if (!db || !userId) return;
  try {
    // Vaciar ruta_activa (eliminar el documento de clientes)
    await setDoc(doc(db, 'ruta_activa', 'K8wx9X5GGOfindI1RGtIIQN3UGr1'), {
      clientes: [],
      totalClientes: 0,
      pendientes: 0,
      activa: false,
      limpiadaAt: new Date().toISOString(),
      actualizadaAt: new Date().toISOString(),
    }, { merge: true });

    // También vaciar usuarios/{uid}/clientes
    await setDoc(doc(db, 'usuarios', userId), {
      clientes: [],
      limpiadaAt: new Date().toISOString(),
    }, { merge: true });

    console.log('🗑️ Ruta limpiada (sin guardar)');
  } catch (e) {
    console.error('❌ Error limpiando ruta:', e);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════
// 🔄 SINCRONIZACIÓN CON RIDERTRACK MODULAR (ruta_activa)
// ═══════════════════════════════════════════════════════════

// UID del bot (mismo que usa el Modular)
const UID_BOT_MODULAR = 'K8wx9X5GGOfindI1RGtIIQN3UGr1';

/**
 * Escuchar clientes del RiderTrack Modular en tiempo real.
 * El Modular guarda en: ruta_activa/{UID_BOT}/clientes
 *
 * Esto permite que RiderTrack V2 vea los clientes del Modular automáticamente.
 */
export function subscribeToRutaActiva(
  onUpdate: (clientes: Cliente[], meta?: { existe: boolean }) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db) {
    onUpdate([]);
    return () => {};
  }

  try {
    const rutaRef = doc(db, 'ruta_activa', UID_BOT_MODULAR);
    return onSnapshot(
      rutaRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const clientesData = data.clientes || [];
          // Convertir formato del Modular a formato V2
          // 💰 FASE Z: cobrar con RESPALDO en precio — si el doc
          // del bot/Excel trae solo `precio` (columna renombrada,
          // carga vieja), el monto ya NO se pierde: el QR por
          // cliente y la fila muestran la plata igual. Espejo del
          // fallback `precio: c.precio || c.cobrar` que ya existía.
          const clientes: Cliente[] = clientesData.map((c: any, idx: number) => ({
            id: c.id || (Date.now() + idx),
            num: c.num || (idx + 1),
            nombre: c.nombre || '',
            cel: c.cel || '',
            prod: c.prod || '',
            precio: parseMonedaPeru(c.precio) || parseMonedaPeru(c.cobrar),
            cobrar: parseMonedaPeru(c.cobrar) || parseMonedaPeru(c.precio),
            dir: c.dir || '',
            dist: c.dist || '',
            obs: c.obs || '',
            st: c.st || 'pendiente',
            mEf: c.mEf || 0,
            mYp: c.mYp || 0,
            mEmp: c.mEmp || 0,
            mVt: c.mVt || 0,
            mEM: c.mEM || '',
            hora: c.hora || '',
            nota: c.nota || '',
            fotoUrl: c.fotoUrl,
            respondioInicioRuta: c.respondioInicioRuta,
            // ✅ Registro web (verificación con la empresa — Fase 2.6)
            webReg: c.webReg === true,
            // 🛵 FASE X (fix S/12): la marca lejos VUELVE del doc del
            // bot — sin esto el snapshot la BORRABA en cada update y tu
            // paga contaba TODOS los pedidos como S/9 (2 de 12 + 4 de 9
            // → contaba 54 en vez de 60). El bot y el publish ya la
            // escribían: solo faltaba leerla de vuelta.
            ...(typeof c.lejos === 'boolean' ? { lejos: c.lejos } : {}),
            // Coordenadas geocodificadas (Fase 1.3/1.4) — viajan con
            // el cliente para no volver a geocodificar nunca
            ...(typeof c.lat === 'number' && typeof c.lng === 'number'
              ? { lat: c.lat, lng: c.lng }
              : {}),
            ...(c.latSrc ? { latSrc: c.latSrc } : {}),
            // 📅 FASE AD: la marca de reprogramado VUELVE del doc del
            // bot (misma lección del lejos — sin leerla de vuelta, el
            // publish la borra al primer update).
            ...(c.reprog === true ? { reprog: true } : {}),
            ...(c.reprogDesde ? { reprogDesde: c.reprogDesde } : {}),
            ...(c.reprogramadoPara ? { reprogramadoPara: c.reprogramadoPara } : {}),
          }));
          console.log('🔄 Clientes del Modular cargados:', clientes.length);
          onUpdate(clientes, { existe: true });
        } else {
          // El doc NO existe → la app puede mostrar el respaldo
          // (clientes_registrados) si lo hay
          onUpdate([], { existe: false });
        }
      },
      (err) => {
        console.error('❌ Error escuchando ruta_activa:', err);
        onError?.(err);
      }
    );
  } catch (e: any) {
    console.error('Error subscribeToRutaActiva:', e);
    onError?.(e);
    return () => {};
  }
}

/**
 * Escuchar TODOS los clientes registrados del Modular.
 * El Modular guarda en: clientes_registrados/{telefono}
 *
 * Esta colección tiene TODOS los clientes históricos (no solo los de hoy).
 * Útil cuando ruta_activa está vacío o la ruta ya terminó.
 */
export function subscribeToClientesRegistrados(
  onUpdate: (clientes: Cliente[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db) {
    onUpdate([]);
    return () => {};
  }

  try {
    const q = query(collection(db, 'clientes_registrados'), orderBy('registradoAt', 'desc'), limit(200));
    return onSnapshot(
      q,
      (snapshot) => {
        const clientes: Cliente[] = [];
        snapshot.forEach((docSnap) => {
          const c = docSnap.data();
          clientes.push({
            id: c.telefono || docSnap.id,
            num: clientes.length + 1,
            nombre: c.nombre || '',
            cel: c.telefono || '',
            prod: c.prod || '',
            precio: parseFloat(String(c.cobrar || 0)),
            cobrar: parseFloat(String(c.cobrar || 0)),
            dir: c.dir || '',
            dist: c.dist || '',
            obs: '',
            st: c.st || 'pendiente',
            mEf: 0, mYp: 0, mEmp: 0, mVt: 0, mEM: '',
            hora: '',
            nota: '',
            // 🛵 FASE X: idem subscribeToRutaActiva — si el respaldo
            // trae la marca lejos, se conserva
            ...(typeof c.lejos === 'boolean' ? { lejos: c.lejos } : {}),
          });
        });
        console.log('🔄 Clientes registrados del Modular cargados:', clientes.length);
        onUpdate(clientes);
      },
      (err) => {
        console.error('❌ Error escuchando clientes_registrados:', err);
        onError?.(err);
      }
    );
  } catch (e: any) {
    console.error('Error subscribeToClientesRegistrados:', e);
    onError?.(e);
    return () => {};
  }
}

/**
 * Actualizar un cliente específico en ruta_activa (para que el Modular lo vea).
 * Se llama cuando V2 cambia el estado de un cliente.
 */
export async function actualizarClienteEnRutaActiva(
  userId: string,
  clienteId: string | number,
  cambios: Partial<Cliente>
): Promise<void> {
  if (!db) return;
  try {
    const rutaRef = doc(db, 'ruta_activa', UID_BOT_MODULAR);
    const snap = await getDoc(rutaRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const clientes = data.clientes || [];
    const idx = clientes.findIndex((c: any) => String(c.id) === String(clienteId));

    if (idx >= 0) {
      // Actualizar el cliente en el array
      clientes[idx] = {
        ...clientes[idx],
        ...cambios,
        st: cambios.st || clientes[idx].st,
        hora: cambios.hora || clientes[idx].hora,
      };
      await setDoc(rutaRef, {
        clientes: clientes,
        actualizadaAt: new Date().toISOString(),
      }, { merge: true });
      console.log('🔄 Cliente actualizado en ruta_activa (sincronizado con Modular)');
    }
  } catch (e: any) {
    console.error('❌ Error actualizando cliente en ruta_activa:', e);
  }
}

/**
 * Sincronizar TODA la lista de clientes desde V2 hacia ruta_activa.
 * Útil cuando importas Excel en V2 y quieres que el Modular lo vea.
 */
export async function publicarClientesEnRutaActiva(
  userId: string,
  clientes: Cliente[]
): Promise<void> {
  if (!db) return;
  try {
    const rutaRef = doc(db, 'ruta_activa', UID_BOT_MODULAR);
    // ⚠️ FIX FASE 1.4: antes este formateo DESCARTABA num/lat/lng,
    // con lo cual la optimización de ruta se perdía al instante
    // (el mapa quedaba en "0 de N ubicados"). Ahora las
    // coordenadas viajan con el cliente. Los campos extra son
    // aditivos: el Modular y el bot los ignoran sin problema.
    const clientesFormateados = clientes.map((c, idx) => ({
      idx: idx,
      id: c.id,
      num: c.num || (idx + 1),
      nombre: c.nombre || 'Cliente',
      cel: _botCel(c.cel || ''),
      cobrar: parseFloat(String(c.cobrar || 0)),
      precio: parseFloat(String(c.precio || 0)),
      prod: c.prod || '',
      dir: c.dir || '',
      dist: c.dist || '',
      st: c.st || 'pendiente',
      nota: c.nota || '',
      obs: c.obs || '',
      hora: c.hora || '',
      ...(c.webReg != null ? { webReg: !!c.webReg } : {}),
      ...(typeof c.lejos === 'boolean' ? { lejos: c.lejos } : {}),
      ...(typeof c.lat === 'number' && typeof c.lng === 'number'
        ? { lat: c.lat, lng: c.lng }
        : {}),
      ...(c.latSrc ? { latSrc: c.latSrc } : {}),
      // 📅 FASE AD: la marca de reprogramado viaja con el cliente —
      // sin esto el snapshot del bot la BORRABA en cada update y el
      // badge 🔁 desaparecía al instante (misma lección del lejos).
      ...(c.reprog ? { reprog: true } : {}),
      ...(c.reprogDesde ? { reprogDesde: c.reprogDesde } : {}),
      ...(c.reprogramadoPara ? { reprogramadoPara: c.reprogramadoPara } : {}),
    }));

    await setDoc(rutaRef, {
      activa: true,
      actualizadaAt: new Date().toISOString(),
      clientes: clientesFormateados,
      totalClientes: clientes.length,
      pendientes: clientes.filter(c => c.st === 'pendiente' || !c.st).length,
    }, { merge: true });

    console.log('🔄 Clientes publicados en ruta_activa (sincronizados con Modular):', clientes.length);
  } catch (e: any) {
    console.error('❌ Error publicando clientes en ruta_activa:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// 🏦 CONFIGURACIÓN DE CUENTAS BANCARIAS
// ═══════════════════════════════════════════════════════════

/** Un punto de ruta guardado con autocompletado (Fase 1.4) */
export interface DireccionRuta {
  nombre: string;   // etiqueta legible: "Avenida Sucre 523, San Miguel"
  lat: number;
  lng: number;
}

/** Configuración de inicio/fin de ruta (Fase 1.4) */
export interface ConfigRuta {
  /** Dónde empieza la ruta (tu casa/almacén). Si no hay, se usa el GPS. */
  inicio?: DireccionRuta | null;
  /** Dónde termina la ruta. Si es null, termina en la última parada (o vuelve al inicio). */
  fin?: DireccionRuta | null;
  /** true = la ruta termina donde empezó (ciclo cerrado) */
  volverAlInicio?: boolean;
}

export interface ConfigCuentas {
  yape?: { nombre: string; telefono: string; qrUrl?: string; qrBase64?: string; };
  bcp?: { titular: string; cci: string; numero: string; };
  bbva?: { titular: string; cci: string; numero: string; };
  interbank?: { titular: string; cci: string; numero: string; };
  /** Fase 2.2: Plin ahora también admite QR (igual que Yape) */
  plin?: { nombre: string; telefono: string; qrUrl?: string; qrBase64?: string; };
  /** 🏪 FASE AG: QR de la EMPRESA — el que le dieron a Rudy para que
   *  los clientes del TRABAJO le paguen directo a la empresa. Se carga
   *  una vez en “Mi QR Yape/Plin → 🏪 Empresa” y sale en el modal del
   *  QR por cliente de Mi Ruta como tercera billetera. Distinto del
   *  Yape/Plin del trabajo (esa plata la cobra/transferita Rudy): lo que
   *  entra por acá va DIRECTO a la cuenta de la empresa. */
  qrEmpresa?: { nombre: string; telefono: string; qrUrl?: string; qrBase64?: string; };
  empresa?: { nombre: string; telefono: string; direccion: string; };
  /** Fase 3.10: equipo de ventas — contactos que envía el bot (chicos_venta) */
  ventas?: {
    fabiana?: { nombre: string; celular: string; };
    karla?: { nombre: string; celular: string; };
    tocho?: { nombre: string; celular: string; };
  };
  /** Inicio/fin de ruta para optimizar y dibujar en el mapa (Fase 1.4) */
  ruta?: ConfigRuta;
  /** Fase 3.14: WhatsApp oficial de Meta (Cloud API) — config del
   *  número de negocio para enviar mensajes por el canal oficial.
   *  Convive con el Rider chat (Baileys): el bot de WhatsApp sigue
   *  siendo el canal diario; esto es la base del canal oficial. */
  whatsappMeta?: {
    /** Phone Number ID que da Meta (WhatsApp Manager → API Setup) */
    phoneNumberId: string;
    /** Token de acceso permanente (System User del negocio) */
    token: string;
    /** Número verificado en formato internacional, ej. 51987654321 */
    numero?: string;
    /** Nombre verificado del negocio (lo devuelve la prueba de conexión) */
    nombreVerificado?: string;
  };
  /** Fase 3.21: apariencia — la imagen que representa a RiderTrack V2.
   *  Se configura en Configuración → “Icono de la App”; el login la
   *  muestra en lugar del logo por defecto. El icono del APK (escudo
   *  v1) va fijo en el build vía android-icons/ — esto es el logo
   *  interno de la app, editable al toque sin recompilar. */
  apariencia?: {
    /** Logo en base64 JPEG comprimido (~800px máx). Vacío = logo por defecto */
    logoBase64?: string;
  };
}

export const CONFIG_CUENTAS_DEFAULT: ConfigCuentas = {
  yape: { nombre: 'Rudy Alen', telefono: '999999999', qrUrl: '' },
  bcp: { titular: 'Rudy Alen', cci: '002-999-999999999999-99', numero: '999-99999999-9-99' },
  bbva: { titular: 'Rudy Alen', cci: '011-999-000000000000-00', numero: '0011-9999-9900000000' },
  interbank: { titular: 'Rudy Alen', cci: '003-000-999999999-99', numero: '999-999999999-99' },
  plin: { nombre: 'Rudy Alen', telefono: '999999999', qrUrl: '' },
  qrEmpresa: { nombre: '', telefono: '', qrUrl: '' },
  empresa: { nombre: 'MATE', telefono: '+51999999999', direccion: 'Lima, Perú' },
  ventas: {
    fabiana: { nombre: 'Fabiana', celular: '' },
    karla: { nombre: 'Karla', celular: '' },
    tocho: { nombre: 'Tocho', celular: '' },
  },
  ruta: { inicio: null, fin: null, volverAlInicio: false },
  whatsappMeta: { phoneNumberId: '', token: '', numero: '', nombreVerificado: '' },
  apariencia: { logoBase64: '' },
};

// ── Fase 2.1: utilidades a prueba de red muerta ─────────────
// Un getDoc/setDoc sin límite de tiempo queda PENDIENTE PARA SIEMPRE
// cuando la red está muerta (0 KB/s) — así se colgaba la pantalla
// del QR. Estas envolturas ponen tope y degradan con elegancia.

/** Carrera entre una promesa Firestore y un timeout */
function conTimeout<T>(promesa: Promise<T>, ms: number, mensaje = 'sin-conexion'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(mensaje)), ms);
    promesa.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

// ═══════════════════════════════════════════════════════════
// 🩺 FASE AJ (v0.11.9): LA CONFIG YA NO MIENTE
//
// REPORTE de Rudy (22 oct): «el QR en la sección QR no aparece…
// guardo la imagen, cambio de sección, vuelvo y desaparece».
// Los QR estaban SANOS en Firestore (verificado) — lo que fallaba
// era el TRANSPORTE: el doc de config pesa ~300KB (3 QR en base64)
// y TODAS estas operaciones tenían 9s de tope. En red móvil débil:
//   · leer  → 9s se pasan → DEFAULTS EN SILENCIO («no aparece el QR»)
//   · guardar → 9s se pasan → 'guardado-local' optimista → si el
//     WebView muere antes de sincronizar, EL GUARDADO SE PIERDE
//     («guardo, salgo, vuelvo y desaparece»)
// Arreglo: 30s + UN reintento + la fuente del dato queda EXPUESTA
// para que la UI avise en vez de mentir. Los timeouts viven en un
// objeto mutable para que los tests puedan acelerarlos.
// ═══════════════════════════════════════════════════════════

/** Límites del flujo config/QR — mutables para los tests */
export const LIMITES_CONFIG = {
  /** tope por intento de red (el doc pesa ~300KB) */
  timeoutMs: 30_000,
  /** espera entre el 1er intento fallido y el reintento */
  reintentoMs: 2_000,
  /** 🌤️ FASE AL: tope del refresco en segundo plano tras leer de
   * la caché — si el servidor no contesta a tiempo, la caché gana
   * y no pasa nada (la próxima apertura vuelve a intentar). */
  frescuraMs: 8_000,
};

/** Cómo terminó la última operación de config ('servidor' llegó al
 * servidor; 'local' quedó encolada en el SDK (optimista). */
export type FuenteOperacion = 'servidor' | 'local';

/** FASE AJ: qué pasó en la última CARGA de config — la UI lo usa
 * para avisar «no pude leer del servidor» en vez de mostrar un
 * vacío mudo que parece «QR borrado».
 *   'servidor' → datos frescos del servidor
 *   'cache'    → servidos por la caché local
 *   'vacio'    → el doc no existe (defaults legítimos)
 *   'error'    → ni caché ni servidor (defaults de emergencia) */
export const estadoCargaConfig: { fuente: 'servidor' | 'cache' | 'vacio' | 'error'; error: string } = {
  fuente: 'servidor',
  error: '',
};

/** Reintenta UNA vez una operación que falló de forma plausiblemente
 * temporal (red). Los errores definitivos (permission-denied y los
 * centinelas como 'guardado-local') NO se reintentan: reintentar un
 * write que el SDK ya dejó encolado lo duplicaría. */
async function conReintento<T>(
  fn: () => Promise<T>,
  msEntreReintentos: number,
  noReintentar: string[],
): Promise<T> {
  try {
    return await fn();
  } catch (e1: any) {
    const msg = String(e1?.message || e1 || '');
    if (noReintentar.includes(msg)) throw e1;
    if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED')) throw e1;
    await new Promise(r => setTimeout(r, msEntreReintentos));
    return await fn();
  }
}

/** Fusiona un doc crudo de config_empresa con los defaults */
function fusionarConfig(data: any): ConfigCuentas {
  return {
    ...CONFIG_CUENTAS_DEFAULT,
    ...data,
    yape: { ...CONFIG_CUENTAS_DEFAULT.yape, ...data?.yape },
    bcp: { ...CONFIG_CUENTAS_DEFAULT.bcp, ...data?.bcp },
    bbva: { ...CONFIG_CUENTAS_DEFAULT.bbva, ...data?.bbva },
    interbank: { ...CONFIG_CUENTAS_DEFAULT.interbank, ...data?.interbank },
    plin: { ...CONFIG_CUENTAS_DEFAULT.plin, ...data?.plin },
    qrEmpresa: { ...CONFIG_CUENTAS_DEFAULT.qrEmpresa, ...data?.qrEmpresa },
    empresa: { ...CONFIG_CUENTAS_DEFAULT.empresa, ...data?.empresa },
    ventas: {
      fabiana: { ...CONFIG_CUENTAS_DEFAULT.ventas!.fabiana, ...data?.ventas?.fabiana },
      karla: { ...CONFIG_CUENTAS_DEFAULT.ventas!.karla, ...data?.ventas?.karla },
      tocho: { ...CONFIG_CUENTAS_DEFAULT.ventas!.tocho, ...data?.ventas?.tocho },
    },
    ruta: { ...CONFIG_CUENTAS_DEFAULT.ruta, ...data?.ruta },
    whatsappMeta: { ...CONFIG_CUENTAS_DEFAULT.whatsappMeta, ...data?.whatsappMeta },
    apariencia: { ...CONFIG_CUENTAS_DEFAULT.apariencia, ...data?.apariencia },
  };
}

/** Timestamp → milisegundos (acepta Timestamp de Firestore, Date o ISO) */
function tiempoDe(v: any): number {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === 'function') return v.toDate().getTime();
    if (v instanceof Date) return v.getTime();
    const t = new Date(String(v)).getTime();
    return Number.isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}

/**
 * 🌤️ FASE AL: la CARRERA CORTA que faltaba. Con la caché tibia la
 * pantalla abre al instante… y hasta hoy se quedaba CONGELADA con
 * esa copia PARA SIEMPRE: guardabas el QR en un cel y el otro nunca
 * lo veía sin reabrir la app. Ahora, tras servir la caché, se baja
 * la versión del servidor por detrás (tope LIMITES_CONFIG.frescuraMs);
 * si es MÁS NUEVA (actualizadoEn) se avisa por el evento global
 * 'config-empresa:refrescada' y las pantallas que usan useConfig se
 * refrescan solas. Silencio total si falla — es best-effort.
 */
function refrescarConfigEnSegundoPlano(ref: any, configCache: ConfigCuentas): void {
  try {
    getDoc(ref)
      .then((snap) => {
        if (!snap || !snap.exists()) return;
        const nueva = fusionarConfig(snap.data());
        if (tiempoDe((nueva as any)?.actualizadoEn) > tiempoDe((configCache as any)?.actualizadoEn)) {
          estadoCargaConfig.fuente = 'servidor';
          estadoCargaConfig.error = '';
          try {
            window.dispatchEvent(new CustomEvent('config-empresa:refrescada', { detail: nueva }));
          } catch {
            /* sin window (tests): nada */
          }
        }
      })
      .catch(() => {
        /* red débil: la caché ya está sirviendo — silencio */
      });
  } catch {
    /* nada */
  }
}

/**
 * Carga la config (Fase 2.1 — NUNCA se cuelga):
 *   1. Caché local de Firestore (instantáneo, funciona SIN internet)
 *   2. Servidor con tope de 30 s y UN reintento (FASE AJ)
 *   3. Defaults — la pantalla siempre se muestra
 */
export async function cargarConfigCuentas(userId: string): Promise<ConfigCuentas> {
  if (!db || !userId) return CONFIG_CUENTAS_DEFAULT;

  const ref = doc(db, 'config_empresa', userId);

  // 1) Caché local primero — instantáneo y offline. 🌤️ FASE AL: al
  //    encontrarla se larga la carrera corta al servidor (frescura).
  try {
    const snapCache = await getDocFromCache(ref);
    if (snapCache.exists()) {
      estadoCargaConfig.fuente = 'cache';
      const configCache = fusionarConfig(snapCache.data());
      refrescarConfigEnSegundoPlano(ref, configCache);
      return configCache;
    }
  } catch {
    // No está en caché todavía (primera vez) — seguir al servidor
  }

  // 2) Servidor — FASE AJ: 30s + UN reintento (antes: 9s y a
  //    defaults EN SILENCIO — el doc de ~300KB no llegaba nunca en
  //    red débil y la pantalla mostraba «sin QR» mintiendo)
  const leer = () => conTimeout(getDoc(ref), LIMITES_CONFIG.timeoutMs, 'sin-conexion');
  try {
    const snap = await conReintento(leer, LIMITES_CONFIG.reintentoMs, []);
    estadoCargaConfig.fuente = snap.exists() ? 'servidor' : 'vacio';
    estadoCargaConfig.error = '';
    if (snap.exists()) return fusionarConfig(snap.data());
    return CONFIG_CUENTAS_DEFAULT;
  } catch (e: any) {
    estadoCargaConfig.fuente = 'error';
    estadoCargaConfig.error = String(e?.message || e);
    console.warn('⚠️ Config sin conexión al servidor (usando defaults):', e?.message || e);
    return CONFIG_CUENTAS_DEFAULT;
  }
}

/**
 * Guarda la config — FASE AJ: 30s por intento + UN reintento si el
 * write revienta. Si se pasa del tope, Firestore ya dejó el write
 * encolado en el SDK: se devuelve 'local' para que la UI AVISE que
 * el guardado es optimista (antes decía «guardado» mintiendo — y
 * si el WebView moría antes de sincronizar, el QR «desaparecía»).
 */
export async function guardarConfigCuentas(userId: string, config: ConfigCuentas): Promise<FuenteOperacion> {
  if (!db || !userId) return 'local';
  const ref = doc(db, 'config_empresa', userId);
  const escribir = () => conTimeout(
    setDoc(ref, { ...config, actualizadoEn: serverTimestamp() }, { merge: true }),
    LIMITES_CONFIG.timeoutMs,
    'guardado-local'
  );
  try {
    // FASE AJ: reintenta 1 vez si el write REVENTÓ (no si hizo
    // timeout — en ese caso el SDK ya lo dejó encolado)
    await conReintento(escribir, LIMITES_CONFIG.reintentoMs, ['guardado-local']);
    console.log('🏦 Config de cuentas guardada');
    return 'servidor';
  } catch (e: any) {
    if (e?.message === 'guardado-local') {
      console.warn('🏦 Config guardada LOCALMENTE — se sincronizará al reconectar');
      return 'local'; // optimista: Firestore la envía cuando haya red
    }
    console.error('❌ Error guardando config de cuentas:', e);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════
// 💜 QR YAPE — SINCRONIZACIÓN CON EL BOT
// ═══════════════════════════════════════════════════════════
// El bot (rudy-bot, index.js → enviarYapeConImagen) lee el QR
// desde Firestore: ruta_activa/{uid}.yape.qrBase64 / .qrUrl
// y lo envía como imagen + plantilla yapeQR por WhatsApp.
// Este shape es EXACTAMENTE el mismo que usaba el Rider modular.

export interface YapeBotConfig {
  qrBase64?: string;   // imagen del QR (data URI, máx ~900KB para Firestore)
  qrUrl?: string;      // alternativa: URL pública del QR
  numero: string;      // número Yape (9 dígitos)
  titular: string;     // nombre del titular
  cci?: string;        // CCI opcional (compatible con el modular)
  bancos?: string;     // info de bancos opcional (compatible con el modular)
}

/**
 * Sincroniza la config de Yape (QR + datos) a ruta_activa/{uid}.yape
 * para que el bot pueda enviar el QR por WhatsApp.
 * Usa merge:true → NO toca clientes ni otros campos de la ruta.
 * Fase 2.1: con tope de tiempo — offline queda encolada localmente.
 */
export async function sincronizarYapeAlBot(userId: string, yape: YapeBotConfig): Promise<FuenteOperacion> {
  if (!db || !userId) throw new Error('Firebase no disponible');
  const escribir = () => conTimeout(
    setDoc(doc(db, 'ruta_activa', userId), {
      yape: {
        qrBase64: yape.qrBase64 || '',
        qrUrl: yape.qrUrl || '',
        numero: yape.numero || '',
        titular: yape.titular || '',
        cci: yape.cci || '',
        bancos: yape.bancos || '',
      },
      actualizadaAt: new Date().toISOString(),
    }, { merge: true }),
    LIMITES_CONFIG.timeoutMs,
    'guardado-local'
  );
  try {
    await conReintento(escribir, LIMITES_CONFIG.reintentoMs, ['guardado-local']);
    return 'servidor';
  } catch (e: any) {
    if (e?.message === 'guardado-local') {
      console.warn('💜 Yape sincronizado LOCALMENTE — llegará al bot al reconectar');
      return 'local'; // optimista: se envía cuando vuelva la red
    }
    console.error('❌ Error sincronizando Yape al bot:', e);
    throw e;
  }
}

/**
 * Lee la config de Yape que el bot ve (ruta_activa/{uid}.yape).
 * Sirve para mostrar el estado de sincronización en la pantalla de QR.
 * Fase 2.1: caché primero + servidor con tope — NUNCA se cuelga
 * (antes, con red muerta, la pantallita de sync quedaba girando
 * para siempre).
 */
export async function obtenerYapeDelBot(userId: string): Promise<YapeBotConfig | null> {
  if (!db || !userId) return null;

  const ref = doc(db, 'ruta_activa', userId);
  const extraer = (data: any): YapeBotConfig | null => {
    if (!data?.yape) return null;
    const y = data.yape;
    return {
      qrBase64: y.qrBase64 || '',
      qrUrl: y.qrUrl || '',
      numero: y.numero || '',
      titular: y.titular || '',
      cci: y.cci || '',
      bancos: y.bancos || '',
    };
  };

  // 1) Caché local (instantáneo, offline)
  try {
    const snapCache = await getDocFromCache(ref);
    const yapeCache = extraer(snapCache.exists() ? snapCache.data() : null);
    if (yapeCache) return yapeCache;
  } catch {
    // sin caché todavía
  }

  // 2) Servidor con tope de tiempo — FASE AJ: 30s (el doc de la
  //    ruta pesa ~240KB; con 9s en red débil el estado de sync
  //    quedaba en «no sincronizado» mintiendo)
  try {
    const snap = await conTimeout(getDoc(ref), LIMITES_CONFIG.timeoutMs);
    return extraer(snap.exists() ? snap.data() : null);
  } catch (e: any) {
    console.warn('⚠️ Yape del bot no disponible (sin conexión):', e?.message || e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// 🔷 QR PLIN — SINCRONIZACIÓN CON EL BOT (Fase 2.2)
// ═══════════════════════════════════════════════════════════
// Mismo mecanismo que Yape, pero en ruta_activa/{uid}.plin:
// el bot podrá leer el QR de Plin y mandarlo por WhatsApp con
// la acción "enviar_plin" (cuando el bot tenga su handler —
// la app ya deja todo listo en Firebase).

export interface PlinBotConfig {
  qrBase64?: string;   // imagen del QR (data URI, máx ~900KB para Firestore)
  qrUrl?: string;      // alternativa: URL pública del QR
  numero: string;      // número de celular asociado a Plin (9 dígitos)
  titular: string;     // nombre del titular
}

/**
 * Sincroniza la config de Plin (QR + datos) a ruta_activa/{uid}.plin
 * Usa merge:true → NO toca clientes ni otros campos de la ruta.
 * Fase 2.2: con tope de tiempo — offline queda encolada localmente.
 */
export async function sincronizarPlinAlBot(userId: string, plin: PlinBotConfig): Promise<FuenteOperacion> {
  if (!db || !userId) throw new Error('Firebase no disponible');
  const escribir = () => conTimeout(
    setDoc(doc(db, 'ruta_activa', userId), {
      plin: {
        qrBase64: plin.qrBase64 || '',
        qrUrl: plin.qrUrl || '',
        numero: plin.numero || '',
        titular: plin.titular || '',
      },
      actualizadaAt: new Date().toISOString(),
    }, { merge: true }),
    LIMITES_CONFIG.timeoutMs,
    'guardado-local'
  );
  try {
    await conReintento(escribir, LIMITES_CONFIG.reintentoMs, ['guardado-local']);
    return 'servidor';
  } catch (e: any) {
    if (e?.message === 'guardado-local') {
      console.warn('🔷 Plin sincronizado LOCALMENTE — llegará al bot al reconectar');
      return 'local'; // optimista: se envía cuando vuelva la red
    }
    console.error('❌ Error sincronizando Plin al bot:', e);
    throw e;
  }
}

/**
 * Lee la config de Plin que el bot ve (ruta_activa/{uid}.plin).
 * Fase 2.2: caché primero + servidor con tope — NUNCA se cuelga.
 */
export async function obtenerPlinDelBot(userId: string): Promise<PlinBotConfig | null> {
  if (!db || !userId) return null;

  const ref = doc(db, 'ruta_activa', userId);
  const extraer = (data: any): PlinBotConfig | null => {
    if (!data?.plin) return null;
    const p = data.plin;
    return {
      qrBase64: p.qrBase64 || '',
      qrUrl: p.qrUrl || '',
      numero: p.numero || '',
      titular: p.titular || '',
    };
  };

  // 1) Caché local (instantáneo, offline)
  try {
    const snapCache = await getDocFromCache(ref);
    const plinCache = extraer(snapCache.exists() ? snapCache.data() : null);
    if (plinCache) return plinCache;
  } catch {
    // sin caché todavía
  }

  // 2) Servidor con tope de tiempo — FASE AJ: 30s (ídem Yape)
  try {
    const snap = await conTimeout(getDoc(ref), LIMITES_CONFIG.timeoutMs);
    return extraer(snap.exists() ? snap.data() : null);
  } catch (e: any) {
    console.warn('⚠️ Plin del bot no disponible (sin conexión):', e?.message || e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// ⏱ CRONÓMETRO DE RUTA → AVISO SILENCIOSO AL BOT (Fase 2.2)
// ═══════════════════════════════════════════════════════════
// Recuperado del Rider modular: al INICIAR el cronómetro se
// publica la ruta completa en ruta_activa/{UID_BOT} con
// activa:true + iniciadaAt + rider + clientes. Con eso, cuando
// un cliente escribe por WhatsApp, el bot lo reconoce por su
// número y le habla por su nombre ("Hola José…"). Al TERMINAR
// la ruta se marca activa:false y el bot vuelve al modo
// genérico ("Hola cliente…").

/**
 * Publica la ruta activa COMPLETA (al iniciar el cronómetro).
 * Mismo shape que usaba el Rider modular → el bot no necesita
 * ningún cambio. merge:true conserva yape/plin ya guardados.
 */
export async function iniciarRutaConBot(
  clientes: Cliente[],
  rider: { nombre: string; telefono: string; empresa: string }
): Promise<void> {
  if (!db) throw new Error('Firebase no disponible');
  await conTimeout(
    setDoc(doc(db, 'ruta_activa', UID_BOT_MODULAR), {
      activa: true,
      iniciadaAt: new Date().toISOString(),
      actualizadaAt: new Date().toISOString(),
      rider: rider,
      clientes: clientes.map((c, idx) => ({
        idx: idx,
        id: c.id,
        num: c.num || (idx + 1),
        nombre: c.nombre || 'Cliente',
        cel: _botCel(c.cel || ''),
        cobrar: parseFloat(String(c.cobrar || 0)),
        precio: parseFloat(String(c.precio || 0)),
        prod: c.prod || '',
        dir: c.dir || '',
        dist: c.dist || '',
        st: c.st || 'pendiente',
        nota: c.nota || '',
        obs: c.obs || '',
        hora: c.hora || '',
        ...(typeof c.lat === 'number' && typeof c.lng === 'number'
          ? { lat: c.lat, lng: c.lng }
          : {}),
        ...(c.latSrc ? { latSrc: c.latSrc } : {}),
      })),
      clienteActualIdx: -1,
      totalClientes: clientes.length,
      pendientes: clientes.filter(c => c.st === 'pendiente' || !c.st).length,
    }, { merge: true }),
    9000,
    'guardado-local'
  ).catch((e: any) => {
    if (e?.message === 'guardado-local') {
      console.warn('⏱ Ruta publicada LOCALMENTE — llegará al bot al reconectar');
      return;
    }
    console.error('❌ Error publicando ruta para el bot:', e);
    throw e;
  });
}

/**
 * Marca la ruta como finalizada para el bot (al terminar la ruta
 * desde el cronómetro). El bot deja de reconocer clientes por
 * nombre hasta la próxima publicación.
 */
export async function finalizarRutaActivaBot(): Promise<void> {
  if (!db) return;
  try {
    await conTimeout(
      setDoc(doc(db, 'ruta_activa', UID_BOT_MODULAR), {
        activa: false,
        finalizadaAt: new Date().toISOString(),
        actualizadaAt: new Date().toISOString(),
      }, { merge: true }),
      9000,
      'guardado-local'
    );
    console.log('✅ Ruta marcada como finalizada para el bot');
  } catch (e: any) {
    if (e?.message === 'guardado-local') {
      console.warn('⏱ Finalización guardada LOCALMENTE — llegará al bot al reconectar');
      return;
    }
    console.warn('Error finalizando ruta para el bot:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// 🤖 ACCIONES DEL BOT (para Baileys)
// ═══════════════════════════════════════════════════════════

// Encolar acción para el bot de Baileys
export async function encolarAccionBot(
  userId: string,
  accion: {
    tipo: string;
    clienteId: string | number;
    telefono: string;
    nombre: string;
    prod?: string;
    cobrar?: number;
    dir?: string;
    dist?: string;
    st?: string;
    rider?: any;
    enviar_imagen?: boolean;
    modo_entrega?: string;
    minutos?: number; // F-L: 🚀 "Estoy yendo en X min" desde Seguimiento de ruta
    // 🖼️ AM v0.11.12: la imagen VIAJA en la acción — el QR de Yape/Plin
    // para enviar_yape/enviar_plin, o el de la prueba 🖼️. El bot v3.4 la
    // usa al toque (sin leer ruta_activa) y la BORRA del doc tras mandarla.
    imagenBase64?: string;
    numero?: string;
    titular?: string;
  }
): Promise<void> {
  if (!db || !userId) return;

  const accionData = {
    ...accion,
    createdAt: new Date().toISOString(),
    processed: false,
  };

  try {
    const pendientesRef = collection(db, 'acciones_bot', userId, 'pendientes');
    // Usar setDoc con ID aleatorio
    const newDocRef = doc(pendientesRef);
    await setDoc(newDocRef, accionData);
    console.log('🤖 Acción encolada:', accion.tipo);
  } catch (e) {
    console.error('❌ Error encolando acción:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// 🩺 v0.11.7 — ESTADO DEL BOT (el latido que escribe el bot v3)
//
// El bot v3-blindado escribe estado_bot/{uid} cada 60 s con su
// señal de vida. La app solo LEE su propio doc y muestra 🟢/🔴 en
// Configuración → "Bot de WhatsApp" — así Rudy DEJA DE ADIVINAR
// si es su cel, la red o el robot (el fantasma del 21/10: el bot
// recibía mensajes de clientes pero la cola de acciones estaba
// muerta y nadie lo veía).
// ═══════════════════════════════════════════════════════════
export interface EstadoBot {
  vivo: boolean;
  lastSeen: string;      // ISO del último latido
  version: string;      // 'v3.1-DT'
  whatsapp: string;     // 'conectado' | 'desconectado'
  listenerAcciones: string; // 'vivo' | 'muerto'
  enCola: number;       // acciones esperando en la cola del bot
  procesando: string;   // tipo de la acción que está saliendo ahora
  // 🏍️ v0.11.8: ¿está cargado el parche del robot de inDrive?
  // (dt_cobro/dt_aviso/dt_ubicacion/dt_texto — si false, los botones
  // del robot de inDrive quedan "en cola" para siempre: el bot v3
  // desconectó el parche al reemplazar index.js — nunca más a ciegas)
  dtParche: boolean;
  // 🌡️ v0.11.8: modo calentamiento del bot (si true, el bot NO manda
  // mensajes a clientes — la tarjeta lo AVISA en vez de sufrirlo)
  calentamiento: boolean;
  // 🖼️ AM v0.11.12: el ÚLTIMO error de subida de imagen del bot
  // (Baileys 'media upload' — el clásico texto llega / imagen no).
  // Vacío = la última imagen salió bien. Lo escribe el bot v3.4 en
  // el latido; la app lo muestra en el cartel del bot.
  mediaUltimoError: string;
  // 🖼️ AM v0.11.12: resultado de la última «🖼️ Probar imagen» —
  // { resultado: 'ok' | 'error', motivo, cuando }
  pruebaImagen: { resultado: string; motivo: string; cuando: string } | null;
}

/**
 * Suscripción EN VIVO al latido del bot. Devuelve la función de
 * limpieza. Llama con null si el doc no existe (bot nunca corrió
 * la v3 o permisos del doc) para que la UI muestre "sin señal".
 */
export function subscribeEstadoBot(
  userId: string,
  cb: (estado: EstadoBot | null) => void
): () => void {
  if (!db || !userId) return () => {};
  try {
    const unsub = onSnapshot(
      doc(db, 'estado_bot', userId),
      (snap) => {
        if (!snap.exists()) { cb(null); return; }
        const d = snap.data() as Record<string, unknown>;
        cb({
          vivo: d.vivo === true,
          lastSeen: typeof d.lastSeen === 'string' ? d.lastSeen : '',
          version: typeof d.version === 'string' ? d.version : '?',
          whatsapp: typeof d.whatsapp === 'string' ? d.whatsapp : '?',
          listenerAcciones: typeof d.listenerAcciones === 'string' ? d.listenerAcciones : '?',
          enCola: typeof d.enCola === 'number' ? d.enCola : 0,
          procesando: typeof d.procesando === 'string' ? d.procesando : '',
          // v0.11.8: ausentes en bots v3.0 → false (defaults sanos)
          dtParche: d.dtParche === true,
          calentamiento: d.calentamiento === true,
          // 🖼️ AM v0.11.12: diagnóstico de imágenes del bot (v3.4)
          mediaUltimoError: typeof d.mediaUltimoError === 'string' ? d.mediaUltimoError : '',
          pruebaImagen:
            d.pruebaImagen && typeof d.pruebaImagen === 'object'
              ? {
                  resultado: String((d.pruebaImagen as any).resultado || ''),
                  motivo: String((d.pruebaImagen as any).motivo || ''),
                  cuando: String((d.pruebaImagen as any).cuando || ''),
                }
              : null,
        });
      },
      () => { cb(null); }
    );
    return unsub;
  } catch {
    return () => {};
  }
}

/**
 * 🧪 "Probar el bot": encola una acción probar_bot — el bot v3 le
 * manda un mensajito al WhatsApp de Rudy. Si llega, TODO el
 * circuito app → cola → bot → WhatsApp anda perfecto. Sin teléfono
 * en la acción: el bot usa el número de avisos de su config.
 */
export async function probarBot(userId: string): Promise<void> {
  await encolarAccionBot(userId, {
    tipo: 'probar_bot',
    clienteId: 'prueba',
    telefono: '',
    nombre: 'Rudy',
  });
}

/**
 * 🖼️ AM v0.11.12: "Probar imagen" — igual que probarBot pero con la
 * IMAGEN adjunta. El bot v3.4 le manda a tu propio WhatsApp el QR que
 * le pases (el de Yape del trabajo por defecto) con reintento reforzado,
 * y el resultado (ok + el motivo EXACTO del error si falla) queda en
 * estado_bot.pruebaImagen para que lo veas en el cartel del bot sin
 * mirar logs. Así la pelea de "mensajes sin imagen" deja de ser
 * adivinanza: la app te dice QUÉ pasó.
 */
export async function probarImagenBot(
  userId: string,
  imagenBase64: string,
  numero = '',
  titular = ''
): Promise<void> {
  await encolarAccionBot(userId, {
    tipo: 'probar_imagen',
    clienteId: 'prueba-imagen',
    telefono: '',
    nombre: 'Rudy',
    imagenBase64,
    numero,
    titular,
  });
}

// ═══════════════════════════════════════════════════════════
// 📊 ESTADÍSTICAS
// ═══════════════════════════════════════════════════════════

export function calcularEstadisticas(clientes: Cliente[]) {
  const total = clientes.length;
  const entregados = clientes.filter(c => ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st)).length;
  const pendientes = clientes.filter(c => c.st === 'pendiente' || !c.st).length;
  const fallidos = clientes.filter(c => ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'].includes(c.st)).length;

  const cobrado = clientes
    .filter(c => ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st))
    .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

  const porCobrar = clientes
    .filter(c => c.st === 'pendiente' || !c.st)
    .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

  return {
    total,
    entregados,
    pendientes,
    fallidos,
    cobrado,
    porCobrar,
    totalDia: cobrado + porCobrar,
  };
}

// ═══════════════════════════════════════════════════════════
// 📂 IMPORTAR EXCEL
// ═══════════════════════════════════════════════════════════

export function importarExcel(file: File): Promise<Cliente[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // 🚀 FASE AB-2: Excel bajo demanda — el trozo se trae recién
        // acá (solo al importar un .xlsx). El patrón default ?? mod
        // funciona igual en el navegador (Vite) que en Node (tests
        // con stub), que empaquetan el módulo distinto.
        const modXLSX: any = await import('xlsx');
        const XLSX = modXLSX.default ?? modXLSX;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

        // Buscar fila de encabezados
        let headerRow = 0;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const row = rows[i].map(c => String(c).toUpperCase());
          if (row.some(c => c.includes('NOMBRE') || c.includes('CLIENTE'))) {
            headerRow = i;
            break;
          }
        }

        const headers = rows[headerRow].map(h => String(h).toLowerCase().trim());

        // Encontrar columnas
        const findCol = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

        const cols = {
          num: findCol(['n°', 'num', '#']),
          // 💰 FASE Z: alias ampliados — el Excel de la empresa
          // renombra columnas entre días ('MONTO', 'TOTAL', 'PAGAR'…)
          // y el monto quedaba en 0 → QR "sin monto cargado".
          precio: findCol(['precio', 'costo', 'valor', 'unitario']),
          cobrar: findCol(['cobrar', 'monto', 'total', 'pagar', 'deuda', 'importe']),
          nombre: findCol(['nombre', 'cliente']),
          dir: findCol(['direcci']),
          dist: findCol(['distrito']),
          cel: findCol(['celular', 'tel']),
          prod: findCol(['producto']),
          obs: findCol(['observ', 'obs']),
        };

        const clientes: Cliente[] = [];
        let num = 1;

        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          const nombre = String(row[cols.nombre] || '').trim();
          if (!nombre || nombre.toUpperCase().includes('TOTAL') || nombre.toUpperCase().includes('VUELTO')) continue;

          // 💰 FASE Z: parseo PERUANO robusto — "S/ 89.90",
          // "S/.89,90", "1,234.56" o números ya parseados.
          // Antes: parseFloat("S/ 89.90") = NaN → 0 → QR sin monto.
          const crudoPrecio = cols.precio >= 0 ? row[cols.precio] : undefined;
          const crudoCobrar = cols.cobrar >= 0 ? row[cols.cobrar] : undefined;
          const { cobrar: cobrarNum, precio: precioNum } = montosConRespaldo(crudoCobrar, crudoPrecio);
          const precio = precioNum;
          if (!nombre && precio === 0) continue;

          clientes.push({
            id: Date.now() + i,
            num: cols.num >= 0 ? (parseInt(row[cols.num]) || num) : num,
            precio: precio,
            cobrar: cobrarNum,
            nombre: nombre,
            dir: String(row[cols.dir] || '').trim(),
            dist: String(row[cols.dist] || '').trim(),
            cel: String(row[cols.cel] || '').trim(),
            prod: String(row[cols.prod] || '').trim(),
            obs: String(row[cols.obs] || '').trim(),
            st: 'pendiente',
            mEf: 0, mYp: 0, mEmp: 0, mVt: 0, mEM: '', hora: '', nota: '',
          });
          num++;
        }

        resolve(clientes);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsArrayBuffer(file);
  });
}

// ═══════════════════════════════════════════════════════════
// 🔧 HELPERS
// ═══════════════════════════════════════════════════════════

function _botCel(cel: string): string | null {
  if (!cel) return null;
  const d = String(cel).replace(/[^0-9]/g, '');
  if (d.length === 9) return '51' + d;
  if (d.length === 11 && d.startsWith('51')) return d;
  if (d.length === 12 && d.startsWith('51')) return d;
  if (d.length === 13 && d.startsWith('0051')) return d.slice(2);
  return d.length >= 9 ? '51' + d.slice(-9) : null;
}

export { _botCel };

// ═══════════════════════════════════════════════════════════
// 📸 SUBIR FOTO A STORAGE (Reportar pago con foto)
// ═══════════════════════════════════════════════════════════

/**
 * Sube una foto del comprobante de pago a Firebase Storage.
 * Ruta: pagos/{uid}/{clienteId}_{timestamp}.jpg
 * @returns URL pública de la imagen subida
 */
export async function subirFotoPago(
  uid: string,
  clienteId: string | number,
  file: File | Blob
): Promise<string> {
  if (!storage) throw new Error('Storage no inicializado');

  const timestamp = Date.now();
  const safeId = String(clienteId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const ruta = `pagos/${uid}/${safeId}_${timestamp}.jpg`;
  const refImg = storageRef(storage, ruta);

  // Subir con metadata para optimizar cache
  await uploadBytes(refImg, file, {
    contentType: 'image/jpeg',
    customMetadata: {
      clienteId: String(clienteId),
      uid: uid,
      fecha: new Date().toISOString(),
    },
  });

  // Obtener URL de descarga
  const url = await getDownloadURL(refImg);
  console.log('✅ Foto subida a Storage:', ruta);
  return url;
}

/**
 * Sube una foto de evidencia de entrega a Firebase Storage.
 * Ruta: entregas/{uid}/{clienteId}_{timestamp}.jpg
 *
 * Fallback (Fase 1.2): si Storage no está disponible o las reglas
 * rechazan la escritura, devuelve el dataURL base64 comprimido para
 * guardar directo en Firestore (mismo patrón que usaba el Modular /
 * ClienteTrack con base64 inline).
 */
export async function subirFotoEntrega(
  uid: string,
  clienteId: string | number,
  file: File | Blob,
  dataUrlFallback?: string
): Promise<string> {
  const timestamp = Date.now();
  const safeId = String(clienteId).replace(/[^a-zA-Z0-9_-]/g, '_');

  if (storage) {
    try {
      const ruta = `entregas/${uid}/${safeId}_${timestamp}.jpg`;
      const refImg = storageRef(storage, ruta);

      await uploadBytes(refImg, file, {
        contentType: 'image/jpeg',
        customMetadata: {
          clienteId: String(clienteId),
          uid: uid,
          fecha: new Date().toISOString(),
          tipo: 'entrega',
        },
      });

      const url = await getDownloadURL(refImg);
      console.log('✅ Foto de entrega subida a Storage:', ruta);
      return url;
    } catch (e) {
      console.warn('⚠️ Storage no disponible, usando base64 en Firestore:', e);
    }
  }

  // Fallback: base64 directo en Firestore (como el Modular/ClienteTrack)
  if (dataUrlFallback) {
    return dataUrlFallback;
  }
  throw new Error('No se pudo subir la foto (Storage y base64 no disponibles)');
}

// ═══════════════════════════════════════════════════════════
// 🛵 AVATAR DEL RIDER + POSICIÓN GPS (Fase 1.5, re-integrada 2.3)
// Guarda el avatar elegido en usuarios/{uid} para que aparezca
// en todas las sesiones, y publica la posición GPS del motorizado
// en ruta_activa/{uid}.posicion — la base del panel de flota futuro
// y del seguimiento web para clientes (ambos en standby).
// ═══════════════════════════════════════════════════════════

export async function guardarAvatarRider(userId: string, avatarId: string): Promise<void> {
  try {
    const ref = doc(db, 'usuarios', userId);
    await setDoc(ref, { avatar: avatarId, avatarActualizadoAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.error('❌ Error guardando avatar del rider:', e);
    throw e;
  }
}

export interface PosicionRider {
  lat: number;
  lng: number;
  velocidadKmh?: number;
  rumbo?: number;
  /** ISO — cuándo se tomó la posición */
  timestamp?: string;
  /** ISO — cuándo se publicó por última vez en Firestore */
  actualizadoAt?: string;
}

export async function publicarPosicionRider(userId: string, pos: PosicionRider): Promise<void> {
  try {
    const ref = doc(db, 'ruta_activa', userId);
    await setDoc(ref, {
      posicion: {
        lat: pos.lat,
        lng: pos.lng,
        velocidadKmh: pos.velocidadKmh ?? 0,
        rumbo: pos.rumbo ?? null,
        timestamp: pos.timestamp || new Date().toISOString(),
        actualizadoAt: pos.actualizadoAt || new Date().toISOString(),
      },
    }, { merge: true });
  } catch (e) {
    // Silencioso: la posición es best-effort (se reintenta en el próximo tick)
    console.warn('⚠️ No se pudo publicar posición GPS:', e);
  }
}

/**
 * 📡 (F3.36) Suscripción EN VIVO a la posición publicada de un rider
 * (ruta_activa/{uid}.posicion). Devuelve null si no hay doc.
 * El caller decide si el latido es fresco (actualizadoAt).
 */
export function suscribirPosicionRider(
  userId: string,
  cb: (pos: PosicionRider | null) => void
): () => void {
  if (!db || !userId) {
    cb(null);
    return () => undefined;
  }
  try {
    const ref = doc(db, 'ruta_activa', userId);
    return onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as { posicion?: PosicionRider } | undefined;
        cb(data?.posicion ?? null);
      },
      () => cb(null)
    );
  } catch {
    cb(null);
    return () => undefined;
  }
}

// ═══════════════════════════════════════════════════════════
// 📖 HISTORIAL DE RUTAS (Fase 2.5)
// Colección: historial_rutas — un doc por cada ruta finalizada.
// Compatibilidad: los docs viejos ({uid}_{fecha}, sin finalizadaAt
// en algunos casos) también se listan — se ordenan por fecha desc.
// ═══════════════════════════════════════════════════════════

/**
 * Lee el historial de rutas del usuario (las últimas rutas).
 * Ordena localmente por finalizadaAt/fecha desc para soportar
 * docs viejos y nuevos sin depender de índices compuestos.
 * (2.6: max 300 por defecto — el calendario necesita todas las
 * fechas con ruta, incluidas las importadas de la v1.)
 */
export async function leerHistorial(userId: string, max = 300): Promise<RegistroHistorial[]> {
  if (!db || !userId) return [];
  try {
    const ref = collection(db, 'historial_rutas');
    // ⚡ FASE N: where('uid','==',userId) — OBLIGATORIO para que las
    // reglas dejen listar (allow list exige que el query filtre por
    // TU uid; ANTES el list sin where era permission-denied y la
    // lista salía VACÍA aunque las rutas se guardaban bien).
    const q = query(ref, where('uid', '==', userId), limit(400));
    const snap = await getDocs(q);
    const registros: RegistroHistorial[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      // Solo docs de este usuario (ID empieza con su uid o campo uid igual)
      if (data?.uid !== userId && !d.id.startsWith(`${userId}_`)) return;
      // ⚡ F3.50 — REPARACIÓN EN LECTURA: las rutas cerradas antes de
      // la F3.50 guardaron totalRider/totalEmpresa/porMetodo con el
      // bug del yape-plin (contado como efectivo del rider). El
      // snapshot de clientes SIEMPRE estuvo completo → se recalcula
      // la plata desde ahí con las reglas corregidas y la ruta se ve
      // bien en Historial/Estadísticas SIN tocar la base de datos.
      registros.push(conTotalesCorregidos<RegistroHistorial>({
        id: d.id,
        uid: data.uid || userId,
        fecha: data.fecha || d.id.replace(`${userId}_`, '').slice(0, 10),
        iniciadaAt: data.iniciadaAt,
        finalizadaAt: data.finalizadaAt,
        totalClientes: data.totalClientes || 0,
        entregados: data.entregados || 0,
        fallidos: data.fallidos || 0,
        pendientes: data.pendientes || 0,
        cobradoTotal: data.cobradoTotal || 0,
        porMetodo: data.porMetodo,
        totalEmpresa: data.totalEmpresa,
        totalRider: data.totalRider,
        clientes: data.clientes || [],
        origen: data.origen,
        v1Id: data.v1Id,
        km: data.km,
        tiempoRuta: data.tiempoRuta,
        // 💰 FASE AC (contabilidad): el desglose de pago por pedido
        // (S/9/S/12 del día) ya se guardaba desde la FASE D pero no
        // se leía — la Contabilidad lo necesita para sumar la plata
        // de la empresa por semana/mes. Campos viejos sin él → undefined.
        pagoPedidos: data.pagoPedidos,
      }));
    });
    registros.sort((a, b) => {
      const ka = a.finalizadaAt || a.iniciadaAt || a.fecha || '';
      const kb = b.finalizadaAt || b.iniciadaAt || b.fecha || '';
      return kb.localeCompare(ka);
    });
    return registros.slice(0, max);
  } catch (e) {
    console.error('❌ Error leyendo historial:', e);
    return [];
  }
}

/** Elimina una ruta del historial */
export async function eliminarRutaHistorial(userId: string, registroId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'historial_rutas', registroId));
    console.log('🗑️ Ruta eliminada del historial');
  } catch (e) {
    console.error('❌ Error eliminando ruta del historial:', e);
    throw e;
  }
}

/** Cambia la fecha de una ruta del historial (útil si cerraste después de medianoche) */
export async function cambiarFechaHistorial(registroId: string, nuevaFecha: string): Promise<void> {
  if (!db) throw new Error('Sin conexión');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nuevaFecha)) throw new Error('Fecha inválida (usa AAAA-MM-DD)');
  try {
    await updateDoc(doc(db, 'historial_rutas', registroId), { fecha: nuevaFecha });
    console.log('📅 Fecha de ruta actualizada:', registroId, '→', nuevaFecha);
  } catch (e) {
    console.error('❌ Error cambiando fecha del historial:', e);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════
// 📥 IMPORTAR HISTORIAL DE LA V1 (Fase 2.6)
// La v1 (Rider Modular) guardaba TODO su historial (D.hist) en
// el MISMO Firebase y con el MISMO usuario:
//   · usuarios/{uid}.hist              → auto-sync (sv(), autoSync:true)
//   · usuarios/{uid}/backups/{doc}.hist → backups manual + cierre de ruta
// Este módulo lee la fuente más completa, convierte cada ruta al
// formato de historial_rutas (docs `v1_{id}`) y NO repite las que
// ya se importaron (campo v1Id).
// ═══════════════════════════════════════════════════════════

/** Equivalencia desglose v1 (dg) → estados v2 (porMetodo) */
const MAPA_DG_V1: Record<string, string> = {
  ef: 'efectivo',
  yr: 'yape-rudy',
  ye: 'yape-efectivo',
  mT: 'mixto',
  po: 'pos',
  tr: 'transferencia',
  yp: 'yape-plin',
  pl: 'pago-link',
  js: 'jose-smith',
  em: 'empresa',
};

/**
 * Busca el historial v1 más completo en la nube:
 * doc vivo usuarios/{uid}.hist + los backups de usuarios/{uid}/backups.
 * Gana la fuente con MÁS rutas (el hist v1 era acumulativo).
 */
export async function leerHistorialV1(userId: string): Promise<{ entradas: RutaV1[]; fuente: string }> {
  if (!db || !userId) return { entradas: [], fuente: '' };
  let mejor: RutaV1[] = [];
  let fuente = '';

  // 1) Doc vivo (auto-sync de la v1)
  try {
    const snap = await getDoc(doc(db, 'usuarios', userId));
    if (snap.exists()) {
      const hist = (snap.data() as any)?.hist;
      if (Array.isArray(hist) && hist.length > mejor.length) {
        mejor = hist as RutaV1[];
        fuente = 'sincronización automática';
      }
    }
  } catch (e) {
    console.warn('⚠️ No se pudo leer usuarios/{uid}.hist:', (e as Error).message);
  }

  // 2) Backups de la v1 (cada uno trae el hist completo hasta su fecha)
  try {
    const snap = await getDocs(query(collection(db, 'usuarios', userId, 'backups'), limit(40)));
    snap.forEach((d) => {
      const hist = (d.data() as any)?.hist;
      if (Array.isArray(hist) && hist.length > mejor.length) {
        mejor = hist as RutaV1[];
        fuente = `backup ${d.id}`;
      }
    });
  } catch (e) {
    console.warn('⚠️ No se pudieron leer los backups v1:', (e as Error).message);
  }

  return { entradas: mejor, fuente };
}

/**
 * Limpia recursivamente los valores `undefined` de un objeto.
 * Firestore RECHAZA undefined en WriteBatch.set()/setDoc() con el error
 * "Unsupported field value: undefined" — por eso, antes de escribir
 * docs importados de la v1 (que traen huecos), se pasan por aquí.
 * Devuelve una copia nueva (no muta el original).
 */
function limpiarUndefined<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor
      .filter((v) => v !== undefined)
      .map((v) => limpiarUndefined(v)) as unknown as T;
  }
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    const limpio: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v === undefined) continue; // ← se omite la clave completa
      limpio[k] = limpiarUndefined(v);
    }
    return limpio as T;
  }
  return valor;
}

/** Convierte una ruta del historial v1 al formato de historial_rutas (v2) */
function convertirRutaV1(h: RutaV1, userId: string): Record<string, any> | null {
  const cl = Array.isArray(h.cl) ? h.cl : [];
  const id = Number(h.id) || 0;
  const fecha = h.fechaId || (id ? new Date(id).toISOString().slice(0, 10) : '');
  if (!id || !fecha) return null; // sin id/fecha no se puede deduplicar ni ubicar

  // Desglose: dg v1 → porMetodo v2 (si no hay dg, se calcula de cl)
  const porMetodo: Record<string, number> = {};
  if (h.dg && Object.keys(h.dg).length > 0) {
    for (const [k, v] of Object.entries(h.dg)) {
      const st = MAPA_DG_V1[k];
      if (st && Number(v) > 0) porMetodo[st] = (porMetodo[st] || 0) + Number(v);
    }
  } else {
    const ST_ENT = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'];
    for (const c of cl) {
      const k = c?.st;
      if (!k || !ST_ENT.includes(k)) continue;
      if (k === 'mixto') {
        porMetodo['mixto'] = (porMetodo['mixto'] || 0) + parseFloat(String(c.mEf || 0));
      } else {
        porMetodo[k] = (porMetodo[k] || 0) + parseFloat(String(c.cobrar || 0));
      }
    }
  }

  const totalRider = Number(h.tT) || 0;
  const totalEmpresa = Number(h.tE) || 0;

  return {
    uid: userId,
    origen: 'v1',
    v1Id: id,
    fecha,
    finalizadaAt: id ? new Date(id).toISOString() : '',
    totalClientes: Number(h.total) || cl.length,
    entregados: Number(h.ent) || 0,
    fallidos: Number(h.fal) || 0,
    pendientes: Number(h.pen) || 0,
    cobradoTotal: totalRider + totalEmpresa,
    porMetodo,
    totalEmpresa,
    totalRider,
    km: h.km || null,
    // ⚠️ FIX: antes era `|| undefined` y Firestore lo rechazaba con
    // "Unsupported field value: undefined (found in field tiempoRuta)"
    // al importar rutas de la v1 que nunca guardaron ese campo.
    // null SÍ es un valor válido para Firestore.
    tiempoRuta: h.tiempoRuta || null,
    clientes: cl.map((c: any, i: number) => ({
      id: c.id != null ? c.id : `v1c_${id}_${i}`,
      num: c.num != null ? c.num : i + 1,
      nombre: c.nombre || 'Cliente',
      cel: c.cel || '',
      prod: c.prod || '',
      cobrar: parseFloat(String(c.cobrar || 0)),
      mEf: parseFloat(String(c.mEf || 0)),
      mYp: parseFloat(String(c.mYp || 0)),
      mEmp: parseFloat(String(c.mEmp || 0)),
      mVt: parseFloat(String(c.mVt || 0)),
      dir: c.dir || '',
      dist: c.dist || '',
      st: c.st || 'pendiente',
      hora: c.hora || '',
      obs: c.obs || '',
      nota: c.nota || '',
      motivo: c.motivo || '',
    })),
  };
}

/**
 * IMPORTA el historial de la v1 a historial_rutas (docs `v1_{id}`).
 * No repite las que ya están (campo v1Id). Devuelve cuántas importó.
 */
export async function importarHistorialV1(userId: string): Promise<{ importadas: number; totalV1: number; fuente: string }> {
  if (!db || !userId) throw new Error('Sin conexión');
  const { entradas, fuente } = await leerHistorialV1(userId);
  if (entradas.length === 0) return { importadas: 0, totalV1: 0, fuente };

  // Qué v1Id ya están importadas
  const yaImportadas = new Set<number>();
  try {
    // ⚡ FASE N: where uid (mismo motivo que leerHistorial — el list
    // sin filtro es denegado por las reglas nuevas)
    const snap = await getDocs(query(collection(db, 'historial_rutas'), where('uid', '==', userId), limit(400)));
    snap.forEach((d) => {
      const data = d.data() as any;
      if (data?.uid !== userId && !d.id.startsWith(`${userId}_`)) return;
      if (data?.origen === 'v1' && typeof data.v1Id === 'number') yaImportadas.add(data.v1Id);
    });
  } catch (e) {
    console.warn('⚠️ No se pudo leer historial_rutas para deduplicar:', (e as Error).message);
  }

  // Convertir solo las nuevas
  const nuevas: Record<string, any>[] = [];
  for (const h of entradas) {
    if (yaImportadas.has(Number(h.id))) continue;
    const datos = convertirRutaV1(h, userId);
    if (datos) nuevas.push(datos);
  }

  // Escribir por lotes (batch máx 500 → usamos 400 por margen)
  let escritas = 0;
  for (let i = 0; i < nuevas.length; i += 400) {
    const lote = nuevas.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const datos of lote) {
      // Doble protección: ni un solo undefined puede entrar al batch
      // (la v1 guardaba huecos en cl, km, tiempoRuta...)
      batch.set(doc(db, 'historial_rutas', `v1_${datos.v1Id}`), limpiarUndefined(datos));
    }
    await batch.commit();
    escritas += lote.length;
  }

  console.log(`📥 Historial v1 importado: ${escritas} rutas nuevas de ${entradas.length} (fuente: ${fuente})`);
  return { importadas: escritas, totalV1: entradas.length, fuente };
}

// ═══════════════════════════════════════════════════════════
// 💾 BACKUPS EN LA NUBE (Fase 2.5)
// Colección: backups_v2 — snapshot completo de la ruta actual.
// El usuario puede guardarlo, verlo, volver a cargarlo o borrarlo
// desde el menú hamburguesa (como el backup de la v1, pero en
// la nube de Firebase — nada de archivos descargados).
// ═══════════════════════════════════════════════════════════

/** Guarda un backup de la ruta actual en la nube */
export async function guardarBackupNube(
  userId: string,
  clientes: Cliente[],
  opts?: { auto?: boolean }
): Promise<string> {
  if (!db || !userId) throw new Error('Sin conexión');
  const ST_ENTREGADOS = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'];
  const ST_FALLIDOS = ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta', 'reprogramar'];
  const ahora = new Date();
  const entregados = clientes.filter(c => ST_ENTREGADOS.includes(c.st)).length;
  const fallidos = clientes.filter(c => ST_FALLIDOS.includes(c.st)).length;
  const cobrado = clientes
    .filter(c => ST_ENTREGADOS.includes(c.st))
    .reduce((s, c) => s + parseFloat(String(c.cobrar || 0)), 0);

  const id = `${userId}_${ahora.getTime()}`;
  const backup: Omit<BackupNube, 'id'> & { id?: string } = {
    uid: userId,
    creadoAt: ahora.toISOString(),
    fecha: hoyISO(), // ⚡ F3.48: fecha de Lima (antes UTC: después de 7pm quedaba con fecha de mañana)
    hora: ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    totalClientes: clientes.length,
    entregados,
    pendientes: clientes.length - entregados - fallidos,
    fallidos,
    cobradoTotal: cobrado,
    clientes: JSON.parse(JSON.stringify(clientes)),
    auto: opts?.auto || false,
  };

  await setDoc(doc(db, 'backups_v2', id), backup);
  console.log('💾 Backup guardado en la nube:', id);
  return id;
}

/** Estados entregados para contarlos en backups v1 sin registro */
const ST_ENTREGADOS_NUBE = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'];

/** Lista los backups del usuario (los últimos 40) — ⚡ F3.48:
 *  ahora UNE los de backups_v2 (la pantalla) con los auto-cierres de
 *  usuarios/{uid}/backups (la ruta que usaba la v1 y que la pantalla
 *  nunca mostró). Si una colección falla (permisos), la otra sigue.
 *  ⚡ F3.53: el query de backups_v2 ahora filtra por uid en el
 *  SERVIDOR (where) — la regla nueva de firestore.rules exige que el
 *  campo uid sea del dueño, y un listado sin filtro sería rechazado
 *  (permission-denied). Además ya no solo se listan los auto-cierre
 *  de la v1: cualquier backup v1 con clientes restaurables (campo cl)
 *  aparece, marcado con origen 'v1' para el chip de la pantalla. */
export async function listarBackupsNube(userId: string, max = 40): Promise<BackupNube[]> {
  if (!db || !userId) return [];
  const backups: BackupNube[] = [];
  // 1) backups_v2 — manual + auto-cierre + auto-guardado vivo (F3.48/F3.53)
  try {
    const ref = collection(db, 'backups_v2');
    const q = query(ref, where('uid', '==', userId), limit(200));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const data = d.data() as any;
      backups.push({
        id: d.id,
        uid: data.uid || userId,
        creadoAt: data.creadoAt || '',
        fecha: data.fecha || '',
        hora: data.hora || '',
        totalClientes: data.totalClientes || 0,
        entregados: data.entregados || 0,
        pendientes: data.pendientes || 0,
        fallidos: data.fallidos || 0,
        cobradoTotal: data.cobradoTotal || 0,
        clientes: data.clientes || [],
        tipo: data.tipo || '',
        origen: 'v2',
        auto: data.auto,
      });
    });
  } catch (e) {
    console.error('❌ Error listando backups_v2:', e);
  }
  // 2) ⚡ F3.48/F3.53: backups de la ruta v1 (usuarios/{uid}/backups) —
  //    los que guardaba la v1 en la nube y que esta pantalla NUNCA mostró.
  //    Se incluyen TODOS los restaurables (campo cl con clientes): los
  //    auto-cierre (auto:true) y los manuales de la v1. Los docs .hist
  //    gigantes (hist sin cl) NO se listan: son para el importador del
  //    historial v1 (☰ → Historial → 📥 Importar v1).
  try {
    const snapV1 = await getDocs(query(collection(db, 'usuarios', userId, 'backups'), limit(80)));
    snapV1.forEach((d) => {
      const data = d.data() as any;
      // Restaurable = tiene clientes (cl). Sin cl → es un .hist de historial
      const cl = Array.isArray(data.cl) ? data.cl : [];
      if (cl.length === 0) return;
      const reg = data.registro || {};
      const regFecha = data.registro?.fecha || data.fecha || d.id.replace('auto_', '');
      const total = cl.length;
      // Des-duplicar: el mismo cierre se guarda en ambas colecciones desde F3.48
      const dupe = backups.some(
        (b) => b.origen === 'v2' && b.fecha === regFecha && b.hora === (data.hora || '') && b.totalClientes === total,
      );
      if (dupe) return;
      backups.push({
        id: d.id,
        uid: userId,
        creadoAt: data.creadoAt || `${regFecha}T${(data.hora || '00:00')}:00`,
        fecha: regFecha,
        hora: data.hora || '',
        totalClientes: total,
        entregados: Number(reg.entregados) || cl.filter((c: any) => ST_ENTREGADOS_NUBE.includes(c.st)).length,
        pendientes: Math.max(0, total - (Number(reg.entregados) || 0) - (Number(reg.fallidos) || 0)),
        fallidos: Number(reg.fallidos) || 0,
        cobradoTotal: Number(reg.cobradoTotal) || 0,
        clientes: cl,
        tipo: data.tipo || 'cierre-ruta',
        origen: 'v1',
        auto: data.auto || false,
      });
    });
  } catch (e) {
    console.warn('⚠️ No se pudieron leer los backups v1 (permisos o vacío):', (e as Error).message);
  }
  backups.sort((a, b) => (b.creadoAt || '').localeCompare(a.creadoAt || ''));
  return backups.slice(0, max);
}

/** Elimina un backup de la nube — ⚡ F3.48: prueba en las DOS rutas
 *  (backups_v2 y usuarios/{uid}/backups) porque el backup puede vivir
 *  en cualquiera de las dos. */
export async function eliminarBackupNube(backupId: string, userId?: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'backups_v2', backupId));
    // Si también existe la copia v1 del mismo cierre, borrarla
    if (userId) {
      try { await deleteDoc(doc(db, 'usuarios', userId, 'backups', backupId)); } catch { /* no existe o sin permiso → ok */ }
    }
    console.log('🗑️ Backup eliminado');
  } catch (e) {
    console.error('❌ Error eliminando backup:', e);
    throw e;
  }
}

/**
 * CARGAR un backup: restaura los clientes a ruta_activa + respaldo V2.
 * La ruta actual se PISA con los clientes del backup (por eso pide
 * confirmación en la UI antes de llamar).
 */
export async function cargarBackupNube(userId: string, backup: BackupNube): Promise<number> {
  if (!db || !userId) throw new Error('Sin conexión');
  const clientes = backup.clientes || [];
  if (clientes.length === 0) throw new Error('El backup no tiene clientes');
  // Publicar en ruta_activa (fuente de verdad del bot) + respaldo V2
  await publicarClientesEnRutaActiva(userId, clientes);
  await guardarClientes(userId, clientes);
  console.log('⬆️ Backup cargado:', backup.id, clientes.length, 'clientes');
  return clientes.length;
}

// ═══════════════════════════════════════════════════════════
// ⚡ F3.53 — RESPALDO VIVO EN LA NUBE (cada 15 min durante la ruta)
// ═══════════════════════════════════════════════════════════
/**
 * Guarda un ÚNICO doc por día (merge) con el estado ACTUAL de la ruta:
 *   backups_v2/{uid}_{fecha}_auto  →  tipo 'auto-guardado', auto: true
 * El id fijo hace que NO se acumulen docs: siempre el mismo, pisado con
 * lo último. Si el celular se pierde o muere a MEDIA RUTA, ese doc es
 * el que te salva (el cierre de ruta 🏁 ya tiene su propio backup).
 * Silencioso: devuelve false si falla (permisos/red) — el llamador
 * decide si avisar. No lanza nunca.
 */
export async function guardarAutoBackupVivo(userId: string, clientes: Cliente[]): Promise<boolean> {
  if (!db || !userId || clientes.length === 0) return false;
  try {
    const fecha = hoyISO(); // hora de Lima (F3.48)
    const entregados = clientes.filter(c => ST_ENTREGADOS_NUBE.includes(c.st)).length;
    const cobrado = clientes
      .filter(c => ST_ENTREGADOS_NUBE.includes(c.st))
      .reduce((s, c) => s + parseFloat(String(c.cobrar || 0)), 0);
    await setDoc(doc(db, 'backups_v2', `${userId}_${fecha}_auto`), limpiarUndefined({
      uid: userId,
      creadoAt: new Date().toISOString(),
      fecha,
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      totalClientes: clientes.length,
      entregados,
      pendientes: clientes.length - entregados,
      fallidos: 0,
      cobradoTotal: cobrado,
      clientes: JSON.parse(JSON.stringify(clientes)),
      auto: true,
      tipo: 'auto-guardado',
    }), { merge: true });
    return true;
  } catch (e) {
    console.warn('⚠️ Auto-guardado vivo falló (no bloquea nada):', (e as Error).message);
    return false;
  }
}
