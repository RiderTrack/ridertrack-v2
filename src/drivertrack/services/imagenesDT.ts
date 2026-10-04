// ═══════════════════════════════════════════════════════════
// 🖼️ IMÁGENES DEL ROBOT — DriverTrack (FASE B2)
// ═══════════════════════════════════════════════════════════
// Lo mismo que tenés en el TRABAJO (Imágenes de los mensajes
// del bot), pero para tus viajes LIBRES de inDrive:
//
//   subís una imagen acá (Ajustes → 🖼️ Imágenes del robot) →
//   queda en la nube → el robot la manda CON el mensaje cuando
//   apretás 🛣️ Voy en camino · ⏱️ Llegando en X min · 🏁 Ya
//   llegué · ✅ Entregado · 📍 Pedir ubicación
//
// La imagen NO viaja pegada al mensaje: la app solo pone la URL
// en la acción (acciones_dt) y el bot la baja de la nube en el
// momento del envío — igual que el trabajo con imagenes_bot.
// Si no subís imagen (o la bajada falla), el robot manda SOLO
// el texto — nunca se rompe nada.
//
// Colección PROPIA `imagenes_dt` (los docs del trabajo en
// imagenes_bot quedan intactos). Storage: familia campanas/
// (ya permitida en producción — cero cambios de reglas de
// Storage).
// ═══════════════════════════════════════════════════════════

import {
  db,
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL,
} from '../../services/firebase';
import {
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  Unsubscribe,
} from 'firebase/firestore';

/** Imagen personalizada de un mensaje del robot inDrive */
export interface ImagenDT {
  tipo: string;
  url: string;
  storagePath: string;
  mimetype: string;
  nombre: string;
  actualizadoEn: string;
}

/** Definición de cada imagen que puede mandar el robot inDrive */
export interface DefTipoImagenDT {
  /** id del doc en Firestore `imagenes_dt/{tipo}` */
  tipo: string;
  /** nombre bonito para la UI */
  etiqueta: string;
  /** qué mensaje la usa */
  desc: string;
  /** qué botón la dispara (referencia en la UI) */
  boton: string;
}

/**
 * Los 5 mensajes del robot inDrive que pueden llevar imagen.
 * El 💜 Cobrar NO está acá: ese siempre usa tu QR de Yape
 * (vive en "Mi QR Yape/Plin" y viaja pegado al mensaje).
 */
export const TIPOS_IMAGEN_DT: DefTipoImagenDT[] = [
  {
    tipo: 'camino',
    etiqueta: '🛣️ Voy en camino',
    desc: 'La imagen que acompaña el aviso de que saliste hacia la entrega.',
    boton: '🤖 → Voy en camino',
  },
  {
    tipo: 'llegando',
    etiqueta: '⏱️ Llegando en X minutos',
    desc: 'La imagen del aviso con minutos ("estoy a 10 minutos de tu ubicación").',
    boton: '🤖 → Llegando en X min',
  },
  {
    tipo: 'llegada',
    etiqueta: '🏁 Ya llegué',
    desc: 'La imagen cuando ya estás afuera esperando al cliente.',
    boton: '🤖 → Ya llegué',
  },
  {
    tipo: 'entregado',
    etiqueta: '✅ Entregado · gracias',
    desc: 'La imagen de agradecimiento al cerrar el viaje (con las 5 estrellitas).',
    boton: '🤖 → Entregado',
  },
  {
    tipo: 'ubicacion',
    etiqueta: '📍 Pedir ubicación',
    desc: 'Cuando le pedís al cliente que te mande su ubicación por el chat.',
    boton: '🤖 → Pedirle su ubicación',
  },
];

// ─────────────────────────────────────────────────────────────
// Subir imagen personalizada
// ─────────────────────────────────────────────────────────────

const MIME_POR_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB — WhatsApp comprime igual

/**
 * Sube la imagen de un mensaje del robot inDrive a Storage y la
 * registra en Firestore `imagenes_dt/{tipo}` — el cambio aplica
 * AL TOQUE en el siguiente mensaje (no hay que reiniciar nada).
 *
 * Ruta de Storage: `campanas/imagenes_dt/{uid}/{tipo}_{ts}.{ext}`
 * (misma familia campanas/ que ya permiten las reglas de Storage
 * en producción — cero cambios de reglas de Storage).
 */
export async function subirImagenDT(uid: string, tipo: string, file: File): Promise<string> {
  if (!db) throw new Error('Firestore no inicializado');
  if (!storage) throw new Error('Storage no inicializado');

  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo tiene que ser una imagen (JPG, PNG o WebP)');
  }
  if (file.size > MAX_BYTES) {
    throw new Error(
      `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB — máximo 3 MB (WhatsApp la comprime igual)`,
    );
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const mimetype = MIME_POR_EXT[ext] || file.type || 'image/jpeg';
  const timestamp = Date.now();
  const storagePath = `campanas/imagenes_dt/${uid}/${tipo}_${timestamp}.${ext || 'jpg'}`;

  // 1) Subir a Storage (familia campanas/ — ya permitida en producción)
  const refImg = storageRef(storage, storagePath);
  await uploadBytes(refImg, file, {
    contentType: mimetype,
    customMetadata: { uid, tipo, fase: 'B2' },
  });

  // 2) URL de descarga (token largo — el bot la baja con fetch)
  const url = await getDownloadURL(refImg);

  // 3) Registrar en Firestore: `imagenes_dt/{tipo}` — el doc id ES
  //    el tipo, y la app lo consulta al armar cada mensaje
  await setDoc(doc(db, 'imagenes_dt', tipo), {
    url,
    storagePath,
    mimetype,
    nombre: file.name,
    subidoPor: uid,
    actualizadoEn: new Date().toISOString(),
  });

  console.log('🖼️ [DT] Imagen del robot actualizada:', tipo, '→', storagePath);
  return url;
}

// ─────────────────────────────────────────────────────────────
// Escuchar imágenes personalizadas (tiempo real)
// ─────────────────────────────────────────────────────────────

/**
 * Suscripción en vivo a `imagenes_dt` — mapa { tipo → ImagenDT }.
 * Lo usa la galería de Ajustes y también el armado de mensajes
 * (para saber qué URL ponerle a cada aviso).
 */
export function escucharImagenesDT(
  callback: (imagenes: Record<string, ImagenDT>) => void,
): Unsubscribe {
  if (!db) {
    callback({});
    return () => undefined;
  }
  return onSnapshot(
    collection(db, 'imagenes_dt'),
    (snap) => {
      const mapa: Record<string, ImagenDT> = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data?.url) {
          mapa[d.id] = {
            tipo: d.id,
            url: String(data.url),
            storagePath: String(data.storagePath || ''),
            mimetype: String(data.mimetype || 'image/jpeg'),
            nombre: String(data.nombre || ''),
            actualizadoEn: String(data.actualizadoEn || ''),
          };
        }
      });
      callback(mapa);
    },
    (e) => {
      // Reglas sin publicar todavía → colección vacía (no rompe
      // nada: los mensajes salen solo con texto)
      console.warn('[imagenesDT] listener:', e.message);
      callback({});
    },
  );
}

// ─────────────────────────────────────────────────────────────
// Quitar (el robot vuelve a mandar solo el texto)
// ─────────────────────────────────────────────────────────────

/** Borra la imagen del tipo → el robot manda ese mensaje sin imagen. */
export async function quitarImagenDT(tipo: string): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado');
  await deleteDoc(doc(db, 'imagenes_dt', tipo));
  console.log('↩️ [DT] Imagen quitada — el mensaje va en texto:', tipo);
}
