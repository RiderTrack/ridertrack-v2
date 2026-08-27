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
  /** Coordenadas geocodificadas (Fase 1.3) — se persisten para
   *  no volver a geocodificar la misma dirección nunca más */
  lat?: number;
  lng?: number;
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
    const cobrado = clientes
      .filter(c => ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st))
      .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

    // 2. Guardar resumen en historial_rutas
    const fechaHoy = new Date().toISOString().split('T')[0];
    await setDoc(doc(db, 'historial_rutas', `${userId}_${fechaHoy}`), {
      uid: userId,
      fecha: fechaHoy,
      iniciadaAt: new Date().toISOString(),
      finalizadaAt: new Date().toISOString(),
      totalClientes: total,
      entregados: entregados,
      fallidos: fallidos,
      pendientes: total - entregados - fallidos,
      cobradoTotal: cobrado,
      clientes: clientes.map(c => ({
        id: c.id,
        nombre: c.nombre,
        cel: c.cel,
        prod: c.prod,
        cobrar: parseFloat(String(c.cobrar || 0)),
        dir: c.dir,
        dist: c.dist,
        st: c.st || 'pendiente',
        hora: c.hora || '',
      })),
    }, { merge: true });

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
    const clientesFormateados = clientes.map((c, idx) => ({
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

export interface ConfigCuentas {
  yape?: { nombre: string; telefono: string; qrUrl?: string; qrBase64?: string; };
  bcp?: { titular: string; cci: string; numero: string; };
  bbva?: { titular: string; cci: string; numero: string; };
  interbank?: { titular: string; cci: string; numero: string; };
  plin?: { nombre: string; telefono: string; };
  empresa?: { nombre: string; telefono: string; direccion: string; };
}

export const CONFIG_CUENTAS_DEFAULT: ConfigCuentas = {
  yape: { nombre: 'Rudy Alen', telefono: '999999999', qrUrl: '' },
  bcp: { titular: 'Rudy Alen', cci: '002-999-999999999999-99', numero: '999-99999999-9-99' },
  bbva: { titular: 'Rudy Alen', cci: '011-999-000000000000-00', numero: '0011-9999-9900000000' },
  interbank: { titular: 'Rudy Alen', cci: '003-000-999999999-99', numero: '999-999999999-99' },
  plin: { nombre: 'Rudy Alen', telefono: '999999999' },
  empresa: { nombre: 'MATE', telefono: '+51999999999', direccion: 'Lima, Perú' },
};

export async function cargarConfigCuentas(userId: string): Promise<ConfigCuentas> {
  if (!db || !userId) return CONFIG_CUENTAS_DEFAULT;
  try {
    const ref = doc(db, 'config_empresa', userId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        ...CONFIG_CUENTAS_DEFAULT,
        ...data,
        yape: { ...CONFIG_CUENTAS_DEFAULT.yape, ...data.yape },
        bcp: { ...CONFIG_CUENTAS_DEFAULT.bcp, ...data.bcp },
        bbva: { ...CONFIG_CUENTAS_DEFAULT.bbva, ...data.bbva },
        interbank: { ...CONFIG_CUENTAS_DEFAULT.interbank, ...data.interbank },
        plin: { ...CONFIG_CUENTAS_DEFAULT.plin, ...data.plin },
        empresa: { ...CONFIG_CUENTAS_DEFAULT.empresa, ...data.empresa },
      };
    }
    return CONFIG_CUENTAS_DEFAULT;
  } catch (e: any) {
    console.error('❌ Error cargando config de cuentas:', e);
    return CONFIG_CUENTAS_DEFAULT;
  }
}

export async function guardarConfigCuentas(userId: string, config: ConfigCuentas): Promise<void> {
  if (!db || !userId) return;
  try {
    const ref = doc(db, 'config_empresa', userId);
    await setDoc(ref, { ...config, actualizadoEn: serverTimestamp() }, { merge: true });
    console.log('🏦 Config de cuentas guardada');
  } catch (e: any) {
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
 */
export async function sincronizarYapeAlBot(userId: string, yape: YapeBotConfig): Promise<void> {
  if (!db || !userId) throw new Error('Firebase no disponible');
  try {
    await setDoc(doc(db, 'ruta_activa', userId), {
      yape: {
        qrBase64: yape.qrBase64 || '',
        qrUrl: yape.qrUrl || '',
        numero: yape.numero || '',
        titular: yape.titular || '',
        cci: yape.cci || '',
        bancos: yape.bancos || '',
      },
      actualizadaAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e: any) {
    console.error('❌ Error sincronizando Yape al bot:', e);
    throw e;
  }
}

/**
 * Lee la config de Yape que el bot ve (ruta_activa/{uid}.yape).
 * Sirve para mostrar el estado de sincronización en la pantalla de QR.
 */
export async function obtenerYapeDelBot(userId: string): Promise<YapeBotConfig | null> {
  if (!db || !userId) return null;
  try {
    const snap = await getDoc(doc(db, 'ruta_activa', userId));
    if (snap.exists() && snap.data().yape) {
      const y = snap.data().yape;
      return {
        qrBase64: y.qrBase64 || '',
        qrUrl: y.qrUrl || '',
        numero: y.numero || '',
        titular: y.titular || '',
        cci: y.cci || '',
        bancos: y.bancos || '',
      };
    }
    return null;
  } catch (e: any) {
    console.error('❌ Error leyendo Yape del bot:', e);
    return null;
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
