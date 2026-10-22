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

/** 🩺 FASE AK: límites mutables (los tests los aceleran) */
export const LIMITES_IMAGEN_BOT = {
  /** tope por intento de subida (antes: colgado infinito) */
  topeMs: 75_000,
  /** espera entre el intento fallido y el reintento */
  reintentoMs: 2_000,
  /** presupuesto de la foto comprimida (~300 KB de JPEG) */
  presupuestoBytes: 300_000,
};

/** 🩺 FASE AK: con tope de tiempo — nunca más una subida colgada */
function conTope<T>(p: Promise<T>, ms: number, centinela: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(centinela)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

/**
 * 🩺 FASE AK: comprime ANTES de subir — escalones 1000→700 px con
 * calidad 0.82→0.52 hasta entrar en el presupuesto (~300 KB). Una
 * foto de 3 MB salía tan pesada que la subida se colgaba «para
 * siempre» en red débil; comprimida sube en segundos y WhatsApp la
 * termina recomprimiendo igual al enviarla.
 */
async function comprimirImagenBot(file: File): Promise<File> {
  if (file.size <= LIMITES_IMAGEN_BOT.presupuestoBytes) return file;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagen inválida'));
      img.onload = () => {
        let { width, height } = img;
        const escalones: Array<[number, number]> = [
          [1000, 0.82],
          [900, 0.72],
          [800, 0.62],
          [700, 0.52],
        ];
        let ultima = '';
        for (const [lado, calidad] of escalones) {
          let w = width;
          let h = height;
          if (w > lado || h > lado) {
            if (w >= h) {
              h = Math.round((h * lado) / w);
              w = lado;
            } else {
              w = Math.round((w * lado) / h);
              h = lado;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No se pudo comprimir (canvas)')); return; }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          ultima = canvas.toDataURL('image/jpeg', calidad);
          if (ultima.length <= LIMITES_IMAGEN_BOT.presupuestoBytes * 1.37) break; // base64 ≈ 1.37×
        }
        resolve(ultima);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
  if (!dataUrl) return file;
  const bin = atob(dataUrl.split(',')[1] || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const nombre = (file.name || 'imagen.jpg').replace(/\.[^.]+$/, '') + '.jpg';
  return new File([bytes], nombre, { type: 'image/jpeg' });
}

/** Resultado honesto de la subida (FASE AK) */
export interface SubidaImagenBot {
  url: string;
  pesoKb: number;
  comprimida: boolean;
}

/**
 * Sube una imagen para un tipo de mensaje del bot y la registra en
 * Firestore `imagenes_bot/{tipo}` (el bot la detecta en segundos
 * con su listener y la usa EN VIVO, sin reiniciar nada).
 *
 * 🩺 FASE AK: (1) COMPRIME antes de subir (presupuesto ~300 KB,
 * escalones 1000→700px / 0.82→0.52) — antes una foto de 3 MB se
 * colgaba «para siempre»; (2) tope de 75 s por intento + UN reintento
 * en errores de red (los definitivos storage/unauthorized|quota|
 * canceled NO se reintentan); (3) mensajes honestos: si Storage
 * recibió la foto pero el registro en Firestore no llegó, te lo
 * dice claro en vez de «subió» mentira.
 */
export async function subirImagenBot(
  uid: string,
  tipo: string,
  fileOriginal: File
): Promise<SubidaImagenBot> {
  if (!db) throw new Error('Firestore no inicializado');
  if (!storage) throw new Error('Storage no inicializado');

  // Validaciones amigables ANTES de subir nada
  if (!fileOriginal.type.startsWith('image/')) {
    throw new Error('El archivo tiene que ser una imagen (JPG, PNG o WebP)');
  }
  if (fileOriginal.size > MAX_BYTES) {
    throw new Error(
      `La imagen pesa ${(fileOriginal.size / 1024 / 1024).toFixed(1)} MB — máximo 3 MB (WhatsApp la comprime igual)`
    );
  }

  const file = await comprimirImagenBot(fileOriginal);

  const ext =
    file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp'
      ? (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      : 'jpg';
  const mimetype = file.type || 'image/jpeg';
  const timestamp = Date.now();
  const storagePath = `campanas/imagenes_bot/${uid}/${tipo}_${timestamp}.${ext}`;

  const intentar = async (): Promise<string> => {
    const refImg = storageRef(storage, storagePath);
    await conTope(
      uploadBytes(refImg, file, {
        contentType: mimetype,
        customMetadata: { uid, tipo, fase: 'AK' },
      }),
      LIMITES_IMAGEN_BOT.topeMs,
      'sin-conexion'
    );
    return await conTope(getDownloadURL(refImg), LIMITES_IMAGEN_BOT.topeMs, 'sin-conexion');
  };

  let url = '';
  try {
    url = await intentar();
  } catch (e1: any) {
    const msg = String(e1?.message || e1 || '');
    const esDefinitivo = /unauthorized|unauthenticated|quota|canceled|cancelled|retry-limit/i.test(msg);
    if (esDefinitivo) throw e1;
    // UN reintento tras un bache de red (la subida es idempotente:
    // mismo storagePath con timestamp propio)
    await new Promise((r) => setTimeout(r, LIMITES_IMAGEN_BOT.reintentoMs));
    try {
      url = await intentar();
    } catch (e2: any) {
      throw new Error(
        `La subida no llegó al servidor (${String(e2?.message || e2).slice(0, 60)}) — la señal anda floja. Ya está comprimida (${Math.round(file.size / 1024)} KB): probá otra vez con mejor señal`
      );
    }
  }

  // 3) Registrar en Firestore: `imagenes_bot/{tipo}` — el doc id ES el
  //    tipo → el bot hace lookup directo. Si ESTO falla (reglas, red)
  //    la imagen YA está en Storage pero el bot no la va a ver: hay
  //    que decirlo claro, no «subió».
  await conTope(
    setDoc(doc(db, 'imagenes_bot', tipo), {
      url,
      storagePath,
      mimetype,
      nombre: file.name,
      pesoKb: Math.round(file.size / 1024),
      subidoPor: uid,
      actualizadoEn: new Date().toISOString(),
    }),
    LIMITES_IMAGEN_BOT.topeMs,
    'sin-conexion'
  ).catch((e: any) => {
    throw new Error(
      `La imagen subió pero no pude avisarle al bot (${String(e?.message || e).slice(0, 60)}) — tocá Reintentar o volvé a subirla`
    );
  });

  console.log(
    `🖼️ Imagen del bot actualizada: ${tipo} → ${storagePath} (${Math.round(file.size / 1024)} KB${file.size < fileOriginal.size ? `, comprimida de ${Math.round(fileOriginal.size / 1024)} KB` : ''})`
  );
  return { url, pesoKb: Math.round(file.size / 1024), comprimida: file.size < fileOriginal.size };
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
