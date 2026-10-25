// ═══════════════════════════════════════════════════════════
// 📱 QR DE VINCULACIÓN DEL BOT DE TRABAJO — capa de datos
// (FASE AQ · v0.11.17 · bot v3.7-QRAPP)
//
// Cuando WhatsApp desvincula al bot del TRABAJO, Baileys genera
// un QR nuevo cada ~20s. Antes ese QR solo vivía en la terminal
// (pm2 logs) — había que meterse a Termux para re-vincular. El
// bot v3.7 lo publica acá y esta capa lo lleva al panel:
//
//   qr_bot/{uid}  (bot → app · merge)
//      qrTexto       el texto del QR (para dibujarlo)
//      qrAt          ms de cuándo nació (la app calcula la edad)
//      estadoConexion  'vinculando' | 'conectado' | 'desconectado'
//
// Al conectar, el bot lo limpia (qrTexto '' — nadie escanea un
// QR muerto por accidente). El MISMO patrón del bot personal
// (sistema/estado_personal · FASE AN), pero para el trabajo.
//
// Reglas Firestore: qr_bot/{userId} es SOLO del dueño (read/write
// isOwner — un QR vivo legible por cualquier rider sería
// regalarle el WhatsApp). Se publica con el script v5 del zip:
//   node actualizar_reglas.js
// ═══════════════════════════════════════════════════════════

import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

/** El QR de vinculación del bot de trabajo (qr_bot/{uid}) */
export interface QrTrabajo {
  /** el texto del QR ('' = no hay QR ahora) */
  qrTexto: string;
  /** ms de cuándo nació el QR (0 = nunca) */
  qrAt: number;
  /** 'vinculando' | 'conectado' | 'desconectado' */
  estadoConexion: string;
}

/**
 * Suscripción EN VIVO al QR del bot de trabajo. Llama con null
 * si el doc no existe (el bot v3.6 o más viejo no lo escribe, o
 * las reglas v5 todavía no se publicaron — el panel muestra el
 * aviso honesto en ese caso).
 */
export function subscribeQrTrabajo(
  userId: string,
  cb: (qr: QrTrabajo | null) => void
): Unsubscribe {
  if (!db || !userId) return () => undefined;
  try {
    return onSnapshot(
      doc(db, 'qr_bot', userId),
      (snap) => {
        if (!snap.exists()) {
          cb(null);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        cb({
          qrTexto: typeof d.qrTexto === 'string' ? d.qrTexto : '',
          qrAt: typeof d.qrAt === 'number' ? d.qrAt : 0,
          estadoConexion: typeof d.estadoConexion === 'string' ? d.estadoConexion : '',
        });
      },
      // permiso denegado = reglas v5 sin publicar todavía
      () => cb(null)
    );
  } catch {
    return () => undefined;
  }
}
