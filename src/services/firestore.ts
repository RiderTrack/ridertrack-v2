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
import * as XLSX from 'xlsx';

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
 * FINALIZAR RUTA:
 * Marca la ruta como finalizada, guarda un resumen en historial_rutas
 * y MANTIENE los clientes visibles en ruta_activa para consulta.
 * Útil cuando terminaste todas las entregas del día.
 */
export async function finalizarRuta(userId: string, clientes: Cliente[]): Promise<void> {
  if (!db || !userId) return;
  try {
    // 1. Calcular resumen del día
    const total = clientes.length;
    const entregados = clientes.filter(c =>
      ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st)
    ).length;
    const fallidos = clientes.filter(c =>
      ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'].includes(c.st)
    ).length;

    // 2. Guardar resumen en historial_rutas
    // (Fase 2.5: ID único por cierre con timestamp — antes era
    //  `${uid}_${fecha}` con merge y dos cierres el mismo día se
    //  fusionaban. Se agregan desgloses por método y rider/empresa.)
    // (Fase 2.6: mixto se divide como en la v1 — mEf para ti, mEmp
    //  para la empresa — y yape-efectivo descuenta el vuelto. El
    //  snapshot de clientes ahora guarda mEf/mYp/mEmp/mVt para el
    //  Excel y el detalle.)
    const fechaHoy = new Date().toISOString().split('T')[0];

    // Desglose por método de pago (reglas del cierre de la v1)
    const porMetodo: Record<string, number> = {};
    const ST_ENTREGADOS = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'];
    const ST_EMPRESA = ['empresa', 'pos', 'transferencia', 'pago-link', 'jose-smith'];
    let totalEmpresa = 0;
    let totalRider = 0;
    for (const c of clientes) {
      if (!ST_ENTREGADOS.includes(c.st)) continue;
      const cobrar = parseFloat(String(c.cobrar || 0));
      if (c.st === 'mixto') {
        // Como la v1: la parte en efectivo es tuya, la parte
        // digital la paga la empresa (tE += mEmp)
        const mEf = parseFloat(String(c.mEf || 0));
        const mEmp = parseFloat(String(c.mEmp || 0));
        porMetodo['mixto'] = (porMetodo['mixto'] || 0) + mEf;
        totalRider += mEf;
        totalEmpresa += mEmp;
      } else if (c.st === 'yape-efectivo') {
        // Como la v1: efectivo + yape − vuelto entregado
        const m = Math.max(0, parseFloat(String(c.mEf || 0)) + parseFloat(String(c.mYp || 0)) - parseFloat(String(c.mVt || 0)));
        porMetodo['yape-efectivo'] = (porMetodo['yape-efectivo'] || 0) + m;
        totalRider += m;
      } else if (ST_EMPRESA.includes(c.st)) {
        porMetodo[c.st] = (porMetodo[c.st] || 0) + cobrar;
        totalEmpresa += cobrar;
      } else {
        porMetodo[c.st] = (porMetodo[c.st] || 0) + cobrar;
        totalRider += cobrar;
      }
    }
    const cobrado = totalRider + totalEmpresa;

    await setDoc(doc(db, 'historial_rutas', `${userId}_${Date.now()}`), {
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
      clientes: clientes.map(c => ({
        id: c.id,
        num: c.num || null,
        nombre: c.nombre,
        cel: c.cel,
        prod: c.prod,
        cobrar: parseFloat(String(c.cobrar || 0)),
        mEf: parseFloat(String(c.mEf || 0)),
        mYp: parseFloat(String(c.mYp || 0)),
        mEmp: parseFloat(String(c.mEmp || 0)),
        mVt: parseFloat(String(c.mVt || 0)),
        dir: c.dir,
        dist: c.dist,
        st: c.st || 'pendiente',
        hora: c.hora || '',
        obs: c.obs || '',
        nota: c.nota || '',
        // ✅ Fase 2.6: el check de verificación con la empresa viaja
        // al historial (null nunca — Firestore lo acepta, pero por
        // orden se guarda siempre como boolean)
        webReg: c.webReg === true,
      })),
    });

    // 3. Marcar ruta_activa como finalizada (pero MANTENER los clientes)
    await setDoc(doc(db, 'ruta_activa', 'K8wx9X5GGOfindI1RGtIIQN3UGr1'), {
      activa: false,
      finalizadaAt: new Date().toISOString(),
      actualizadaAt: new Date().toISOString(),
      resumen: { total, entregados, fallidos, cobradoTotal: cobrado },
    }, { merge: true });

    console.log('🏁 Ruta finalizada y guardada en historial');
  } catch (e) {
    console.error('❌ Error finalizando ruta:', e);
    throw e;
  }
}

/**
 * GUARDAR Y CERRAR RUTA:
 * Guarda los clientes actuales en ruta_activa y en clientes_registrados
 * (como respaldo histórico) y marca la ruta como inactiva.
 * Los clientes siguen visibles en el panel para consulta.
 */
export async function guardarYCerrarRuta(userId: string, clientes: Cliente[]): Promise<void> {
  if (!db || !userId) return;
  try {
    // 1. Guardar en ruta_activa
    await publicarClientesEnRutaActiva(userId, clientes);

    // 2. Guardar cada cliente en clientes_registrados (respaldo histórico)
    const batch = writeBatch(db);
    clientes.forEach((c) => {
      const tel = String(c.cel || '').replace(/\D/g, '');
      if (tel) {
        const ref = doc(db, 'clientes_registrados', tel);
        batch.set(ref, {
          telefono: tel,
          nombre: c.nombre || '',
          prod: c.prod || '',
          cobrar: parseFloat(String(c.cobrar || 0)),
          dir: c.dir || '',
          dist: c.dist || '',
          st: c.st || 'pendiente',
          ultimaVisita: new Date().toISOString(),
        }, { merge: true });
      }
    });
    await batch.commit();

    // 3. Marcar ruta como inactiva pero manteniendo los clientes
    await setDoc(doc(db, 'ruta_activa', 'K8wx9X5GGOfindI1RGtIIQN3UGr1'), {
      activa: false,
      guardadaAt: new Date().toISOString(),
      actualizadaAt: new Date().toISOString(),
    }, { merge: true });

    console.log('💾 Ruta guardada y cerrada (clientes preservados)');
  } catch (e) {
    console.error('❌ Error guardando ruta:', e);
    throw e;
  }
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
  onUpdate: (clientes: Cliente[]) => void,
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
          const clientes: Cliente[] = clientesData.map((c: any, idx: number) => ({
            id: c.id || (Date.now() + idx),
            num: c.num || (idx + 1),
            nombre: c.nombre || '',
            cel: c.cel || '',
            prod: c.prod || '',
            precio: parseFloat(String(c.precio || c.cobrar || 0)),
            cobrar: parseFloat(String(c.cobrar || 0)),
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
            // Coordenadas geocodificadas (Fase 1.3/1.4) — viajan con
            // el cliente para no volver a geocodificar nunca
            ...(typeof c.lat === 'number' && typeof c.lng === 'number'
              ? { lat: c.lat, lng: c.lng }
              : {}),
            ...(c.latSrc ? { latSrc: c.latSrc } : {}),
          }));
          console.log('🔄 Clientes del Modular cargados:', clientes.length);
          onUpdate(clientes);
        } else {
          onUpdate([]);
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
      ...(typeof c.lat === 'number' && typeof c.lng === 'number'
        ? { lat: c.lat, lng: c.lng }
        : {}),
      ...(c.latSrc ? { latSrc: c.latSrc } : {}),
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
  empresa?: { nombre: string; telefono: string; direccion: string; };
  /** Inicio/fin de ruta para optimizar y dibujar en el mapa (Fase 1.4) */
  ruta?: ConfigRuta;
}

export const CONFIG_CUENTAS_DEFAULT: ConfigCuentas = {
  yape: { nombre: 'Rudy Alen', telefono: '999999999', qrUrl: '' },
  bcp: { titular: 'Rudy Alen', cci: '002-999-999999999999-99', numero: '999-99999999-9-99' },
  bbva: { titular: 'Rudy Alen', cci: '011-999-000000000000-00', numero: '0011-9999-9900000000' },
  interbank: { titular: 'Rudy Alen', cci: '003-000-999999999-99', numero: '999-999999999-99' },
  plin: { nombre: 'Rudy Alen', telefono: '999999999', qrUrl: '' },
  empresa: { nombre: 'MATE', telefono: '+51999999999', direccion: 'Lima, Perú' },
  ruta: { inicio: null, fin: null, volverAlInicio: false },
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
    empresa: { ...CONFIG_CUENTAS_DEFAULT.empresa, ...data?.empresa },
    ruta: { ...CONFIG_CUENTAS_DEFAULT.ruta, ...data?.ruta },
  };
}

/**
 * Carga la config (Fase 2.1 — NUNCA se cuelga):
 *   1. Caché local de Firestore (instantáneo, funciona SIN internet)
 *   2. Servidor con tope de 9 s
 *   3. Defaults — la pantalla siempre se muestra
 */
export async function cargarConfigCuentas(userId: string): Promise<ConfigCuentas> {
  if (!db || !userId) return CONFIG_CUENTAS_DEFAULT;

  const ref = doc(db, 'config_empresa', userId);

  // 1) Caché local primero — instantáneo y offline
  try {
    const snapCache = await getDocFromCache(ref);
    if (snapCache.exists()) return fusionarConfig(snapCache.data());
  } catch {
    // No está en caché todavía (primera vez) — seguir al servidor
  }

  // 2) Servidor con tope de tiempo
  try {
    const snap = await conTimeout(getDoc(ref), 9000);
    if (snap.exists()) return fusionarConfig(snap.data());
    return CONFIG_CUENTAS_DEFAULT;
  } catch (e: any) {
    console.warn('⚠️ Config sin conexión al servidor (usando defaults):', e?.message || e);
    return CONFIG_CUENTAS_DEFAULT;
  }
}

/**
 * Guarda la config (Fase 2.1): con red muerta el setDoc queda
 * pendiente indefinidamente → tope de 9 s. Firestore encola la
 * escritura localmente (IndexedDB) y la sincroniza solo cuando
 * vuelve la conexión, así que tras el tope el guardado SE CONSIDERA
 * hecho (llegará al servidor al reconectar).
 */
export async function guardarConfigCuentas(userId: string, config: ConfigCuentas): Promise<void> {
  if (!db || !userId) return;
  try {
    const ref = doc(db, 'config_empresa', userId);
    await conTimeout(
      setDoc(ref, { ...config, actualizadoEn: serverTimestamp() }, { merge: true }),
      9000,
      'guardado-local'
    );
    console.log('🏦 Config de cuentas guardada');
  } catch (e: any) {
    if (e?.message === 'guardado-local') {
      console.warn('🏦 Config guardada LOCALMENTE — se sincronizará al reconectar');
      return; // optimista: Firestore la envía cuando haya red
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
export async function sincronizarYapeAlBot(userId: string, yape: YapeBotConfig): Promise<void> {
  if (!db || !userId) throw new Error('Firebase no disponible');
  try {
    await conTimeout(
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
      9000,
      'guardado-local'
    );
  } catch (e: any) {
    if (e?.message === 'guardado-local') {
      console.warn('💜 Yape sincronizado LOCALMENTE — llegará al bot al reconectar');
      return; // optimista: se envía cuando vuelva la red
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

  // 2) Servidor con tope de tiempo
  try {
    const snap = await conTimeout(getDoc(ref), 9000);
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
export async function sincronizarPlinAlBot(userId: string, plin: PlinBotConfig): Promise<void> {
  if (!db || !userId) throw new Error('Firebase no disponible');
  try {
    await conTimeout(
      setDoc(doc(db, 'ruta_activa', userId), {
        plin: {
          qrBase64: plin.qrBase64 || '',
          qrUrl: plin.qrUrl || '',
          numero: plin.numero || '',
          titular: plin.titular || '',
        },
        actualizadaAt: new Date().toISOString(),
      }, { merge: true }),
      9000,
      'guardado-local'
    );
  } catch (e: any) {
    if (e?.message === 'guardado-local') {
      console.warn('🔷 Plin sincronizado LOCALMENTE — llegará al bot al reconectar');
      return; // optimista: se envía cuando vuelva la red
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

  // 2) Servidor con tope de tiempo
  try {
    const snap = await conTimeout(getDoc(ref), 9000);
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
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
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
          precio: findCol(['precio']),
          cobrar: findCol(['cobrar']),
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

          const precio = parseFloat(row[cols.precio]) || 0;
          if (!nombre && precio === 0) continue;

          clientes.push({
            id: Date.now() + i,
            num: cols.num >= 0 ? (parseInt(row[cols.num]) || num) : num,
            precio: precio,
            cobrar: parseFloat(row[cols.cobrar]) || precio,
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
    const q = query(ref, limit(400));
    const snap = await getDocs(q);
    const registros: RegistroHistorial[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      // Solo docs de este usuario (ID empieza con su uid o campo uid igual)
      if (data?.uid !== userId && !d.id.startsWith(`${userId}_`)) return;
      registros.push({
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
      });
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
    const snap = await getDocs(query(collection(db, 'historial_rutas'), limit(400)));
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
    fecha: ahora.toISOString().split('T')[0],
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

/** Lista los backups del usuario (los últimos 40) */
export async function listarBackupsNube(userId: string, max = 40): Promise<BackupNube[]> {
  if (!db || !userId) return [];
  try {
    const ref = collection(db, 'backups_v2');
    const q = query(ref, limit(200));
    const snap = await getDocs(q);
    const backups: BackupNube[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (data?.uid !== userId && !d.id.startsWith(`${userId}_`)) return;
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
        auto: data.auto,
      });
    });
    backups.sort((a, b) => (b.creadoAt || '').localeCompare(a.creadoAt || ''));
    return backups.slice(0, max);
  } catch (e) {
    console.error('❌ Error listando backups:', e);
    return [];
  }
}

/** Elimina un backup de la nube */
export async function eliminarBackupNube(backupId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'backups_v2', backupId));
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
