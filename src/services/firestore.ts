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
