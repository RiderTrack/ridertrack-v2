// ═══════════════════════════════════════════════════════════
// 🤖 FASE B: Robot WhatsApp por FIRESTORE — DriverTrack
// ═══════════════════════════════════════════════════════════
// El rudy-bot (Termux) ya escucha las acciones del TRABAJO en
// acciones_bot/{uid}/pendientes. Para inDrive usamos una cola
// PROPIA (acciones_dt) con un parche nuevo en el bot — así el
// flujo del trabajo queda INTACTO y los mensajes inDrive nunca
// se mezclan ni se marcan processed por equivocación.
//
//   apretás un botón → la app escribe en acciones_dt →
//   el bot lo manda por WhatsApp al cliente (1-2 seg)
//
// Ventajas sobre el puente localhost:3001 (F-ID5, que nunca se
// llegó a instalar): si el bot se reinicia o Termux muere, la
// acción queda ENCOLADA en la nube y sale apenas revive — un
// cobro nunca se pierde. Y no hay URL ni token que configurar.
//
// La app arma el TEXTO completo (plantillas de inDrive, TU nombre,
// TU estilo) — el bot solo envía. Texto + QR de Yape opcional.
// ═══════════════════════════════════════════════════════════

import { collection, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

export type TipoAccionDT =
  | 'dt_cobro' // 💜 mensaje de cobro (con QR de Yape adjunto si existe)
  | 'dt_aviso' // 🛣️ voy en camino / 🏁 ya llegué / ✅ entregado
  | 'dt_ubicacion' // 📍 pedirle al cliente su ubicación
  | 'dt_texto' // 💬 mensaje libre
  | 'dt_prueba'; // 🧪 mensaje de prueba a vos mismo (Ajustes)

export interface AccionDT {
  tipo: TipoAccionDT;
  telefono: string; // ya normalizado: 51 + 9 dígitos
  texto: string; // el mensaje COMPLETO (la app lo arma)
  imagenBase64?: string; // dataURL del QR de Yape — solo viaja en dt_cobro
  nombre?: string; // nombre del cliente (para los logs del bot)
  viajeId?: string; // trazabilidad: qué viaje lo disparó
}

/** ¿Hay sesión de RiderTrack? (necesaria para escribir en Firestore) */
export function uidDisponible(): string | null {
  try {
    return auth?.currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

/**
 * Encola una acción para el robot. El bot (con el parche
 * drivertrack_bot.js) la levanta en 1-2 segundos y la envía.
 * Si el bot está apagado, la acción queda esperando en la cola
 * y sale cuando revive — no se pierde.
 */
export async function encolarAccionDT(a: AccionDT): Promise<{ ok: boolean; error?: string }> {
  const uid = uidDisponible();
  if (!uid) {
    return { ok: false, error: 'Sin sesión — abrí sesión con tu cuenta de RiderTrack' };
  }
  try {
    const ref = doc(collection(db, 'acciones_dt', uid, 'pendientes'));
    await setDoc(ref, {
      ...a,
      processed: false,
      createdAt: new Date().toISOString(),
      origen: 'drivertrack',
      plataforma: 'ridertrack-v2',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'No se pudo encolar (¿sin internet?) — probá de nuevo' };
  }
}

// ═══════════════════════════════════════════════════════════
// 📝 Plantillas de inDrive (la app arma el texto acá — si
// mañana querés otra redacción, se cambia sin tocar el bot)
// ═══════════════════════════════════════════════════════════

export type TipoAviso = 'camino' | 'llegada' | 'entregado';

export function armarAviso(tipo: TipoAviso, v: { cliente: string; direccion: string }, miNombre: string): string {
  const nombre = v.cliente.trim() || 'estimado(a)';
  const dir = v.direccion.trim();
  const firma = miNombre.trim() ? `\n\n— ${miNombre.trim()} · tu conductor inDrive 🛵` : '\n\n— Tu conductor inDrive 🛵';

  if (tipo === 'camino') {
    return (
      `📍 ¡Voy en camino, ${nombre}! 🛵\n\n` +
      (dir ? `Salgo hacia *${dir}*` : 'Ya salí hacia tu ubicación') +
      ` y llego en unos minutos 🙌` +
      firma
    );
  }
  if (tipo === 'llegada') {
    return (
      `🏁 ¡Ya llegué, ${nombre}! 🛵\n\n` +
      (dir ? `Estoy afuera en *${dir}*` : 'Estoy afuera esperándote') +
      `. Cuando puedas salís y te veo 🙌` +
      firma
    );
  }
  // entregado
  return (
    `✅ ¡Viaje entregado! 🙏\n\n` +
      `Gracias por tu viaje, ${nombre}. Si te gustó el servicio, tu calificación me ayuda un montón ⭐⭐⭐⭐⭐\n\n` +
      `¡Nos vemos en la próxima! 🛵` +
      firma
  );
}

/** 📍 Pedirle al cliente que mande su ubicación por el chat */
export function armarPedirUbicacion(miNombre: string): string {
  return (
    `📍 ¿Me ayudás con tu ubicación exacta?\n\n` +
      `Mandámela por este chat: tocá el clip 📎 → *Ubicación* → *Ubicación en tiempo real* 📡 — así llego directo sin vueltas 🛵` +
      (miNombre.trim() ? `\n\n— ${miNombre.trim()} · tu conductor` : '')
  );
}
