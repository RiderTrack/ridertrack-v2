// ═══════════════════════════════════════════════════════════
// 🔔 avisosChat — AVISOS GLOBALES de mensajes de clientes (F3.17)
//
// ¿El problema? Las vistas de chat solo existen cuando las tienes
// abiertas: si estás en "Mi Ruta" o en el Dashboard, nadie está
// escuchando mensajes_clientes (Baileys) ni chats/ (Meta) y un
// cliente te puede escribir sin que te enteres.
//
// ¿La solución? Este servicio vive en App.tsx (siempre montado):
//
//   • Escucha mensajes_clientes → cada mensaje NUEVO de un cliente
//     (o del Grupo MATE) emite un AvisoChat canal "baileys"
//   • Escucha chats/ (Rider Chat) → cuando el unreadCount de un
//     chat SUBE emite un AvisoChat canal "meta" con el último
//     mensaje
//   • Dedupe duro: un doc ya visto jamás vuelve a avisar (aunque
//     Firestore re-emita el snapshot) + ventana de arranque: lo
//     escrito ANTES de abrir la app no bombardea con avisos viejos
//
// La app decide qué hacer con cada aviso: toast flotante con
// botón "Ver", notificación en la campanita y sonido (ver App.tsx).
// ═══════════════════════════════════════════════════════════

import { db } from './firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit as fsLimit,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';

/** Canal de donde viene el mensaje */
export type CanalChat = 'baileys' | 'meta';

export interface AvisoChat {
  /** id único de dedupe (id del doc o tel+timestamp) */
  id: string;
  canal: CanalChat;
  /** Teléfono normalizado (9 dígitos) o 'GRUPO_MATE' */
  tel: string;
  /** Nombre del cliente (o de quien escribió al grupo) */
  nombre: string;
  /** Preview del mensaje (texto plano o "📷 Foto") */
  texto: string;
  timestamp: number;
}

/** Callback que recibe cada aviso nuevo */
type AvisoListener = (aviso: AvisoChat) => void;

const listeners = new Set<AvisoListener>();
const vistos = new Set<string>();
const avisosRecientesLista: AvisoChat[] = [];
const MAX_RECIENTES = 20;

/** Ms tras el arranque desde donde SÍ se avisa (antes = historial viejo) */
const VENTANA_ARRANQUE_MS = 90 * 1000;
/** Anti-ráfaga Meta: mínimo entre avisos del mismo chat */
const THROTTLE_CHAT_MS = 8 * 1000;
const throttlePorChat = new Map<string, number>();

/** Timestamp de arranque del servicio (para la ventana) */
let arrancadoEn = 0;
let unsubs: Array<() => void> = [];
let activo = false;

function emitir(aviso: AvisoChat): void {
  // dedupe global por id
  if (vistos.has(aviso.id)) return;
  vistos.add(aviso.id);

  // anti-ráfaga por chat (solo Meta lo necesita: unreadCount sube
  // varias veces mientras Firestore re-emite)
  const clave = aviso.canal + ':' + aviso.tel;
  const ahora = Date.now();
  const ultimo = throttlePorChat.get(clave) || 0;
  if (ahora - ultimo < THROTTLE_CHAT_MS) {
    return;
  }
  throttlePorChat.set(clave, ahora);

  avisosRecientesLista.unshift(aviso);
  if (avisosRecientesLista.length > MAX_RECIENTES) avisosRecientesLista.length = MAX_RECIENTES;
  listeners.forEach((cb) => {
    try {
      cb(aviso);
    } catch (e: any) {
      console.warn('[avisosChat] listener:', e?.message);
    }
  });
}

/** Preview según el tipo de contenido (como WhatsApp) */
function previewContenido(tipo: string | undefined, texto: string): string {
  switch (tipo) {
    case 'imagen':
      return '📷 Foto' + (texto ? ` — ${texto}` : '');
    case 'audio':
      return '🎤 Nota de voz';
    case 'documento':
    case 'pdf':
      return '📄 Documento';
    case 'ubicacion':
    case 'location':
      return '📍 Ubicación';
    case 'contacto':
      return '👤 Contacto';
    default:
      return texto || 'Mensaje nuevo';
  }
}

/**
 * Arranca los listeners (una sola vez). Devuelve una función para
 * detener (útil en tests). Si ya está activo, no hace nada.
 */
export function iniciarAvisosChat(): () => void {
  if (activo || !db) return () => {};
  activo = true;
  arrancadoEn = Date.now();

  // ── 1. BAILEYS: mensajes_clientes (entrantes del bot) ──
  try {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'mensajes_clientes'), orderBy('timestamp', 'desc'), fsLimit(30)),
        (snap: QuerySnapshot<DocumentData>) => {
          const limite = arrancadoEn - VENTANA_ARRANQUE_MS;
          snap.forEach((d) => {
            const m = d.data();
            const ts = Number(m.timestamp) || 0;
            if (ts < limite) return; // historial viejo → silencio
            const esGrupo =
              String(m.telefono || '') === 'GRUPO_MATE' || m.esGrupo === true;
            const tel = esGrupo
              ? 'GRUPO_MATE'
              : String(m.telefono || '').replace(/\D/g, '').slice(-9);
            if (!tel) return;
            emitir({
              id: 'b_' + d.id,
              canal: 'baileys',
              tel,
              nombre: esGrupo
                ? `${m.nombre || 'Alguien'} · Grupo MATE`
                : m.nombre || 'Cliente',
              texto: previewContenido(m.tipoContenido, m.texto),
              timestamp: ts,
            });
          });
        },
        (err) => console.warn('[avisosChat] baileys:', err.message)
      )
    );
  } catch (e: any) {
    console.warn('[avisosChat] sub baileys:', e?.message);
  }

  // ── 2. META: chats/ (unreadCount sube = mensaje nuevo) ──
  const previoPorChat = new Map<string, { unread: number; ts: number }>();
  try {
    unsubs.push(
      onSnapshot(
        collection(db, 'chats'),
        (snap: QuerySnapshot<DocumentData>) => {
          const limite = arrancadoEn - VENTANA_ARRANQUE_MS;
          snap.forEach((d) => {
            const c = d.data();
            const unread = Number(c.unreadCount) || 0;
            const ts = c.lastMessageTime?.toMillis
              ? c.lastMessageTime.toMillis()
              : Number(c.lastMessageTime) || 0;
            const previo = previoPorChat.get(d.id);
            previoPorChat.set(d.id, { unread, ts });

            // Solo si SUBIÓ el contador de no leídos (llegó mensaje)
            if (!previo || unread <= previo.unread) return;
            if (ts < limite) return;

            emitir({
              id: `m_${d.id}_${ts}`,
              canal: 'meta',
              tel: String(d.id).replace(/\D/g, '').slice(-9),
              nombre: c.clientName || 'Cliente WhatsApp',
              texto: previewContenido(c.lastMessageType, c.lastMessage),
              timestamp: ts || Date.now(),
            });
          });
        },
        (err) => console.warn('[avisosChat] meta:', err.message)
      )
    );
  } catch (e: any) {
    console.warn('[avisosChat] sub meta:', e?.message);
  }

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {
        /* noop */
      }
    });
    unsubs = [];
    activo = false;
    previoPorChatClear();
  };
}

function previoPorChatClear() {
  // (los previos quedan para consultas; solo reset listeners externos)
}

/** Suscribirse a los avisos nuevos (App.tsx) */
export function suscribirAvisos(cb: AvisoListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Los últimos avisos (para pintar la campanita al vuelo) */
export function avisosRecientes(): AvisoChat[] {
  return [...avisosRecientesLista];
}

/** "Ahora" / "Hace 2 min" / "14:05" — para la campanita y el toast */
export function formatearTiempoAviso(ts: number): string {
  const dif = Date.now() - ts;
  if (dif < 45 * 1000) return 'Ahora';
  if (dif < 60 * 60 * 1000) return `Hace ${Math.max(1, Math.floor(dif / 60000))} min`;
  return new Date(ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

/** Trunca el preview para que no rompa el toast (lógica pura, testeable) */
export function truncarPreview(texto: string, max = 90): string {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

/** Para los tests: reset completo del estado del módulo */
export const _testsAvisos = {
  reset() {
    vistos.clear();
    avisosRecientesLista.length = 0;
    throttlePorChat.clear();
    listeners.clear();
  },
  marcarVisto(id: string) {
    vistos.add(id);
  },
  simularEmitir(aviso: AvisoChat) {
    emitir(aviso);
  },
  preview: previewContenido,
};
