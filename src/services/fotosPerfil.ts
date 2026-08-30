// ═══════════════════════════════════════════════════════════
// 🖼️ fotosPerfil — FOTOS DE PERFIL de los clientes (Fase 3.17)
//
// UNA sola fuente de fotos para TODA la app: escucha la colección
// clientes_registrados (campo foto_perfil) y mantiene un mapa
// teléfono → URL vivo. La escribió el parche del bot
// (bot-patch/foto_perfil.js): cada vez que un cliente le escribe
// al bot, Baileys le pide a WhatsApp su foto de perfil actual y
// la guarda en Firestore — así la URL firmada nunca está vieja.
//
// ¿Quién lo usa?
//   • Chat Baileys (ya tenía su propio listener — no se toca)
//   • Rider Chat (lista + cabecera del chat): fotos de los mismos
//     clientes aunque escriban por el canal oficial de Meta
//   • Avisos flotantes de la campanita: el avatar del aviso
//
// Es SINGLETON: aunque 5 componentes se suscriban, hay UN solo
// onSnapshot contra Firestore (los demás viven del mismo mapa).
// ═══════════════════════════════════════════════════════════

import { db } from './firebase';
import { collection, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';

/** Mapa vivo tel (9 dígitos) → URL de la foto */
let fotosActuales = new Map<string, string>();
const listeners = new Set<(fotos: Map<string, string>) => void>();
let unsub: (() => void) | null = null;

/**
 * Normaliza cualquier teléfono a 9 dígitos (la clave del mapa).
 * "51987654321" → "987654321" · "+51 987 654 321" → "987654321" ·
 * "987654321" → "987654321" (misma regla que telKey del Chat Baileys)
 */
export function normalizarTelFoto(tel: unknown): string {
  const d = String(tel ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9) return d;
  if (d.length >= 11 && d.startsWith('51')) return d.slice(2, 11);
  return d.slice(-9);
}

/** La foto actual de un teléfono (cualquier formato que mandes) */
export function fotoDeCliente(tel: unknown): string | undefined {
  const k = normalizarTelFoto(tel);
  return k ? fotosActuales.get(k) : undefined;
}

/** El mapa completo (copiado, para render sin sorpresas) */
export function mapaFotos(): Map<string, string> {
  return new Map(fotosActuales);
}

/**
 * Se suscribe al mapa de fotos. Arranca el listener de Firestore
 * la primera vez (singleton) y lo comparte. Devuelve unsubscribe.
 */
export function suscribirFotosPerfil(
  callback: (fotos: Map<string, string>) => void
): () => void {
  listeners.add(callback);

  if (!unsub && db) {
    try {
      unsub = onSnapshot(
        collection(db, 'clientes_registrados'),
        (snap: QuerySnapshot<DocumentData>) => {
          const nuevo = new Map<string, string>();
          snap.forEach((d) => {
            const url = d.data()?.foto_perfil;
            if (!url) return;
            const tel = normalizarTelFoto(d.id) || normalizarTelFoto(d.data()?.telefono);
            if (tel) nuevo.set(tel, String(url));
          });
          fotosActuales = nuevo;
          listeners.forEach((cb) => cb(mapaFotos()));
        },
        (err) => console.warn('[fotosPerfil] listener:', err.message)
      );
    } catch (e: any) {
      console.warn('[fotosPerfil] sub:', e?.message);
    }
  }

  // Entrega inmediata de lo que ya hay (primera pintada sin esperar)
  callback(mapaFotos());

  return () => {
    listeners.delete(callback);
  };
}

/** Solo para tests: simular el mapa desde fuera */
export const _testsFotosPerfil = {
  setear(mapa: Record<string, string>) {
    fotosActuales = new Map(Object.entries(mapa));
    listeners.forEach((cb) => cb(mapaFotos()));
  },
  resetear() {
    fotosActuales = new Map();
    listeners.clear();
  },
};
