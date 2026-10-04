// ═══════════════════════════════════════════════════════════
// 🎨 ESTUDIO DE TEMAS — RiderTrack V2 · F3.52
// Módulo: remoto.ts — sync del tema con Firestore (☁️)
// ═══════════════════════════════════════════════════════════
// Guarda la config del tema como campo `tema` del propio perfil
// (usuarios/{uid}) — la MISMA colección que ya guarda nombre,
// avatar y fotos. Ventajas:
//   • No hay que tocar firestore.rules (el rider ya puede
//     escribir su propio doc).
//   • No crea colecciones nuevas ni toca al bot.
// Estrategia general (ver useSincronizacionTema.ts):
//   localStorage = fuente instantánea (arranque sin parpadeo)
//   Firestore    = respaldo que viaja con la cuenta (reinstalos,
//                   cambio de celular, varios dispositivos)
// NUNCA lanza hacia arriba: si Firestore falla, el tema sigue
// funcionando local como siempre (F3.51 puro).
// ═══════════════════════════════════════════════════════════

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { normalizarConfig } from './motor';
import type { ConfigTema } from './tipos';

/** Campo del doc usuarios/{uid} donde vive el tema. */
export const CAMPO_TEMA = 'tema';

/**
 * Baja el tema guardado en la cuenta. Devuelve null si no hay
 * (primera vez), si Firestore no está disponible o si falla la
 * lectura — en cualquiera de esos casos la app sigue con el
 * tema local y listo.
 */
export async function cargarTemaRemoto(uid: string): Promise<ConfigTema | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return null;
    const bruto = snap.data()?.[CAMPO_TEMA];
    if (!bruto || typeof bruto !== 'object') return null;
    // normalizarConfig valida TODO — un tema viejo/corrupto en la
    // nube jamás rompe la app
    return normalizarConfig(bruto);
  } catch (e) {
    console.warn('☁️ Tema remoto no se pudo leer (sigue el local):', (e as Error).message);
    return null;
  }
}

/**
 * Sube el tema a la cuenta (merge: no pisa nombre/avatar/etc.).
 * Con debounce desde el hook, mover el slider de tamaño no
 * dispara 50 escrituras — solo la última.
 */
export async function guardarTemaRemoto(uid: string, cfg: ConfigTema): Promise<void> {
  if (!db) return;
  try {
    await setDoc(
      doc(db, 'usuarios', uid),
      { [CAMPO_TEMA]: { ...cfg } },
      { merge: true }
    );
  } catch (e) {
    console.warn('☁️ Tema remoto no se pudo guardar (sigue el local):', (e as Error).message);
  }
}

/** Borra el tema de la cuenta (al cerrar sesión, si se pide). */
export async function borrarTemaRemoto(uid: string): Promise<void> {
  if (!db) return;
  try {
    await setDoc(
      doc(db, 'usuarios', uid),
      { [CAMPO_TEMA]: null },
      { merge: true }
    );
  } catch {
    // no crítico
  }
}
