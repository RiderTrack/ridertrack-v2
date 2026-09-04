// ═══════════════════════════════════════════════════════════
// 🖼️ IMÁGENES DEL BOT — RiderTrack V2 (FASE 3.55)
//
// El bot (rudy-bot en Termux) manda 6 tipos de mensaje CON IMAGEN:
//   · inicio_ruta        → el DISPARO/broadcast de inicio de ruta
//   · ridertrack         → reporte de entrega completada
//   · mate               → mensajes al grupo MATE · Trabajo
//   · solicitar_ubicacion→ pedir la ubicación al cliente
//   · llegando_pronto    → aviso "ya estoy llegando"
//   · mi_posicion        → ⚡ F3.59: "mi posición en la ruta"
//                           (antes iba en texto pelado)
//
// HASTA HOY esas imágenes eran archivos LOCALES del Termux
// (~/bot-whatsapp/imagenes_bot/inicio_ruta.jpg …) — imposibles de
// cambiar desde la app.
//
// AHORA: si existe un doc en `imagenes_bot/{tipo}` con una URL de
// Storage, el bot manda ESA imagen (la baja de Storage en el
// momento del envío). Si NO hay doc, o falla la descarga, usa el
// archivo local de siempre → cero riesgo de romper nada.
//
// El TEXTO de cada mensaje sigue siendo la PLANTILLA editable en
// la pestaña 💬 Plantillas (iniciarRuta, entregaCompletada…):
// esta pestaña solo controla la IMAGEN que la acompaña.
// ═══════════════════════════════════════════════════════════

import {
  db,
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL,
} from './firebase';
import {
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  Unsubscribe,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// Tipos y constantes
// ─────────────────────────────────────────────────────────────

/** Imagen personalizada de un tipo de mensaje del bot */
export interface ImagenBot {
  tipo: string;
  url: string;
  storagePath: string;
  mimetype: string;
  nombre: string;
  subidoPor: string;
  actualizadoEn: string;
}

/** Definición de cada imagen que manda el bot (F3.55) */
export interface DefTipoImagenBot {
  /** id del doc en Firestore `imagenes_bot/{tipo}` — IGUAL al que usa el bot */
  tipo: string;
  /** nombre bonito para la UI */
  etiqueta: string;
  /** qué mensaje la usa */
  desc: string;
  /** el archivo local original del Termux (se muestra como referencia) */
  archivoOriginal: string;
  /** la plantilla del TEXTO que la acompaña (pestaña 💬 Plantillas) */
  plantillaVinculada: string;
}

/**
 * Los 5 tipos de imagen que manda el robot. Los `tipo` coinciden
 * EXACTAMENTE con el mapa `archivos` de `_mandarImagenConCaption`
 * en index.js del bot (L170): ridertrack, mate, inicio_ruta,
 * solicitar_ubicacion, llegando_pronto.
 */
export const TIPOS_IMAGEN_BOT: DefTipoImagenBot[] = [
  {
    tipo: 'inicio_ruta',
    etiqueta: '🚀 Disparo · inicio de ruta',
    desc: 'La imagen del broadcast: cuando disparas el inicio de ruta a los clientes seleccionados.',
    archivoOriginal: 'inicio_ruta.jpg',
    plantillaVinculada: 'iniciarRuta',
  },
  {
    tipo: 'ridertrack',
    etiqueta: '📦 Entrega completada',
    desc: 'El reporte con imagen que confirma la entrega al cliente.',
    archivoOriginal: 'ridertrack_reportes.png',
    plantillaVinculada: 'entregaCompletada',
  },
  {
    tipo: 'mate',
    etiqueta: '👷 Grupo MATE · Reportes',
    desc: 'La imagen que acompaña los REPORTES al grupo de trabajo (los mensajes normales del chat van sin imagen desde F3.59).',
    archivoOriginal: 'mate_gracias.png',
    plantillaVinculada: '—',
  },
  {
    tipo: 'solicitar_ubicacion',
    etiqueta: '📍 Pedir ubicación',
    desc: 'Cuando le pides al cliente que mande su ubicación.',
    archivoOriginal: 'solicitar_ubicacion.jpg',
    plantillaVinculada: 'solicitarUbicacion',
  },
  {
    tipo: 'llegando_pronto',
    etiqueta: '⏰ Llegando pronto',
    desc: 'El aviso de "ya estoy llegando" con imagen.',
    archivoOriginal: 'llegando_pronto.jpg',
    plantillaVinculada: 'avisarLlegada',
  },
  {
    // ⚡ FASE 3.59 — pedido del usuario: la plantilla de "mi
    // posición en la ruta" iba en texto pelado. Ahora puede llevar
    // imagen: sube una acá y el robot la manda con el texto de la
    // plantilla "a qué hora llegas" (horaLlegada).
    tipo: 'mi_posicion',
    etiqueta: '🧭 Mi posición en la ruta',
    desc: 'El mensaje que le dice al cliente en qué punto de tu ruta está hoy ("voy en el 3 de 8"). Sube una imagen y el bot la manda con el texto de la plantilla de la hora de llegada.',
    archivoOriginal: 'mi_posicion.jpg',
    plantillaVinculada: 'horaLlegada',
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
 * Sube una imagen para un tipo de mensaje del bot y la registra en
 * Firestore `imagenes_bot/{tipo}` (el bot la detecta en segundos
 * con su listener y la usa EN VIVO, sin reiniciar nada).
 *
 * Ruta de Storage: `campanas/imagenes_bot/{uid}/{tipo}_{ts}.{ext}`
 * (misma familia `campanas/` que ya permiten las reglas de Storage
 * en producción — cero cambios de reglas de Storage).
 */
export async function subirImagenBot(
  uid: string,
  tipo: string,
  file: File
): Promise<string> {
  if (!db) throw new Error('Firestore no inicializado');
  if (!storage) throw new Error('Storage no inicializado');

  // Validaciones amigables ANTES de subir nada
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo tiene que ser una imagen (JPG, PNG o WebP)');
  }
  if (file.size > MAX_BYTES) {
    throw new Error(
      `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB — máximo 3 MB (WhatsApp la comprime igual)`
    );
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const mimetype = MIME_POR_EXT[ext] || file.type || 'image/jpeg';
  const timestamp = Date.now();
  const storagePath = `campanas/imagenes_bot/${uid}/${tipo}_${timestamp}.${ext || 'jpg'}`;

  // 1) Subir a Storage (familia campanas/ — ya permitida en producción)
  const refImg = storageRef(storage, storagePath);
  await uploadBytes(refImg, file, {
    contentType: mimetype,
    customMetadata: {
      uid,
      tipo,
      fase: '3.55',
    },
  });

  // 2) URL de descarga (token largo — el bot la baja con fetch)
  const url = await getDownloadURL(refImg);

  // 3) Registrar en Firestore: `imagenes_bot/{tipo}`
  //    El doc id ES el tipo → el bot hace lookup directo por tipo.
  await setDoc(doc(db, 'imagenes_bot', tipo), {
    url,
    storagePath,
    mimetype,
    nombre: file.name,
    subidoPor: uid,
    actualizadoEn: new Date().toISOString(),
  });

  console.log('🖼️ Imagen del bot actualizada:', tipo, '→', storagePath);
  return url;
}

// ─────────────────────────────────────────────────────────────
// Escuchar imágenes personalizadas (tiempo real)
// ─────────────────────────────────────────────────────────────

/**
 * Suscripción en vivo a la colección `imagenes_bot`.
 * Devuelve un mapa { tipo → ImagenBot } para la UI.
 */
export function escucharImagenesBot(
  callback: (imagenes: Record<string, ImagenBot>) => void
): Unsubscribe {
  if (!db) {
    callback({});
    return () => undefined;
  }
  return onSnapshot(
    collection(db, 'imagenes_bot'),
    (snap) => {
      const mapa: Record<string, ImagenBot> = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data?.url) {
          mapa[d.id] = {
            tipo: d.id,
            url: String(data.url),
            storagePath: String(data.storagePath || ''),
            mimetype: String(data.mimetype || 'image/jpeg'),
            nombre: String(data.nombre || ''),
            subidoPor: String(data.subidoPor || ''),
            actualizadoEn: String(data.actualizadoEn || ''),
          };
        }
      });
      callback(mapa);
    },
    (e) => {
      console.warn('[imagenesBot] listener:', e.message);
      // Reglas sin publicar → colección vacía en la UI (no rompe nada)
      callback({});
    }
  );
}

// ─────────────────────────────────────────────────────────────
// Restablecer (volver a la imagen local del bot)
// ─────────────────────────────────────────────────────────────

/**
 * Borra la imagen personalizada → el bot vuelve a usar su archivo
 * local de siempre (~/bot-whatsapp/imagenes_bot/…).
 */
export async function restablecerImagenBot(tipo: string): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado');
  await deleteDoc(doc(db, 'imagenes_bot', tipo));
  console.log('↩️ Imagen del bot restablecida a la local:', tipo);
}
