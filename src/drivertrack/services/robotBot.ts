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
  imagenUrl?: string; // URL en la nube de la imagen del aviso (FASE B2) — el bot la baja con fetch
  minutos?: number; // ⏱️ solo en dt_aviso llegando: en cuántos minutos llegás
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
    // FASE B2.1 (fix avisos): los campos opcionales viajan como undefined
    // cuando no aplican (imagenUrl sin imagen subida, minutos en avisos
    // sin minutos…) y el SDK de Firestore RECHAZA el documento entero con
    // "Unsupported field value: undefined" — por eso los avisos caían al
    // wa.me aunque el cobro y la prueba funcionaran. Se limpian acá, en
    // UN solo lugar, para todos los tipos de acción.
    const datos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(a)) {
      if (v !== undefined) datos[k] = v;
    }
    await setDoc(ref, {
      ...datos,
      processed: false,
      createdAt: new Date().toISOString(),
      origen: 'drivertrack',
      plataforma: 'ridertrack-v2',
    });
    return { ok: true };
  } catch (e) {
    // El motivo real al log + al toast: si vuelve a fallar, el código del
    // error (p.ej. permission-denied) aparece a la vista, no un "¿sin
    // internet?" genérico que despista.
    const raz =
      (e as { code?: string })?.code || (e as Error)?.message?.slice(0, 80) || 'sin detalle';
    console.error('[robotBot] No se pudo encolar:', e);
    return { ok: false, error: `No se pudo encolar (${raz})` };
  }
}

// ═══════════════════════════════════════════════════════════
// 📝 Plantillas de inDrive (la app arma el texto acá — si
// mañana querés otra redacción, se cambia sin tocar el bot)
// ═══════════════════════════════════════════════════════════

// FASE B2: 'llegando' = ⏱️ "estoy llegando en X minutos" (como
// el avisarLlegada del trabajo, pero con TU estilo inDrive)
export type TipoAviso = 'camino' | 'llegando' | 'llegada' | 'entregado';

// FASE C: los textos de los avisos son EDITABLES desde Ajustes →
// 💬 Mensajes del robot. Estos son los ORIGINALES de fábrica; lo
// que el usuario guarda en config.plantillas pisa el que sea.
// Placeholders: {cliente} {direccion} {dirA} {minutos} {miNombre} {firma}
export type TipoPlantilla = TipoAviso | 'ubicacion';

export const PLANTILLAS_DEF: Record<TipoPlantilla, string> = {
  camino:
    '📍 ¡Voy en camino, {cliente}! 🛵\n\nSalgo hacia *{direccion}* y llego en unos minutos 🙌{firma}',
  llegando:
    '⏱️ ¡{cliente}, estoy llegando! 🛵\n\nEstoy a *{minutos} minutos* de {direccion} — salí ya para que no te espera el tránsito 🙌{firma}',
  llegada:
    '🏁 ¡Ya llegué, {cliente}! 🛵\n\nEstoy afuera en *{direccion}*. Cuando puedas salís y te veo 🙌{firma}',
  entregado:
    '✅ ¡Viaje entregado! 🙏\n\nGracias por tu viaje, {cliente}. Si te gustó el servicio, tu calificación me ayuda un montón ⭐⭐⭐⭐⭐\n\n¡Nos vemos en la próxima! 🛵{firma}',
  ubicacion:
    '📍 ¿Me ayudás con tu ubicación exacta?\n\nMandámela por este chat: tocá el clip 📎 → *Ubicación* → *Ubicación en tiempo real* 📡 — así llego directo sin vueltas 🛵\n\n— {miNombre} · tu conductor',
};

/** Etiqueta linda de cada plantilla (para el editor de Ajustes) */
export const ETIQUETAS_PLANTILLA: Record<TipoPlantilla, string> = {
  camino: '🛣️ Voy en camino',
  llegando: '⏱️ Llegando en X minutos',
  llegada: '🏁 Ya llegué',
  entregado: '✅ Entregado · gracias',
  ubicacion: '📍 Pedir ubicación',
};

/** Reemplaza los {placeholders} de una plantilla con los datos reales */
export function resolverPlantilla(
  texto: string,
  vars: {
    cliente?: string;
    direccion?: string;
    dirA?: string;
    minutos?: number;
    miNombre?: string;
  },
): string {
  const nombre = (vars.cliente ?? '').trim() || 'estimado(a)';
  const dir = (vars.direccion ?? '').trim() || 'tu ubicación';
  const dirA = (vars.dirA ?? '').trim();
  const min = vars.minutos && vars.minutos > 0 ? vars.minutos : 10;
  const mi = (vars.miNombre ?? '').trim();
  const firma = mi
    ? `\n\n— ${mi} · tu conductor inDrive 🛵`
    : '\n\n— Tu conductor inDrive 🛵';
  return texto
    .replaceAll('{cliente}', nombre)
    .replaceAll('{direccion}', dir)
    .replaceAll('{dirA}', dirA || 'el punto de recojo')
    .replaceAll('{minutos}', String(min))
    .replaceAll('{miNombre}', mi || 'Tu conductor')
    .replaceAll('{firma}', firma);
}

export function armarAviso(
  tipo: TipoAviso,
  v: { cliente: string; direccion: string; dirA?: string },
  miNombre: string,
  minutos?: number,
  /** FASE C: plantillas editadas por el usuario (config.plantillas) */
  plantillas?: Record<string, string>,
): string {
  const texto = plantillas?.[tipo]?.trim() || PLANTILLAS_DEF[tipo];
  return resolverPlantilla(texto, {
    cliente: v.cliente,
    direccion: v.direccion,
    dirA: v.dirA,
    minutos,
    miNombre,
  });
}

/** 📍 Pedirle al cliente que mande su ubicación por el chat */
export function armarPedirUbicacion(miNombre: string, plantilla?: string): string {
  const texto = plantilla?.trim() || PLANTILLAS_DEF.ubicacion;
  return resolverPlantilla(texto, { miNombre });
}
