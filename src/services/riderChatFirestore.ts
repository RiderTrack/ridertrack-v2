// ═══════════════════════════════════════════════════════════
// 💾 RIDER CHAT — persistencia Firestore (Fase 3.15)
//
// Port de riderchat-v2/services/firestore.ts adaptado a
// RiderTrack: usa el db del PROYECTO (ridertrack-93c8a, el
// mismo del RiderChat original) → los chats que ya tenías en
// la app RiderChat aparecen aquí automáticamente, y los que
// mandes desde el panel los verá la app. Misma colección:
//
//   chats/{telefono}                       → metadatos del chat
//   chats/{telefono}/messages/{idMensaje}  → mensajes
//
// Mejoras sobre el original:
//   • createOrUpdateChat ya NO pisa el lastMessage al cambiar
//     el estado/etiquetas (ahi había un bug silencioso)
//   • Los mensajes se piden DESC + reverse → en chats largos
//     muestra los ÚLTIMOS 200 (el original traía los primeros)
//   • increment() atómico para los no leídos
//   • Respaldo en memoria: si Firestore falla (sin red), la
//     UI sigue viva con lo último conocido
// ═══════════════════════════════════════════════════════════

import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import {
  ChatRider,
  MensajeRider,
  EstadoMensaje,
  EstadoChat,
} from '../utils/riderChatUtils';

// ── Respaldo en memoria (offline / sin permisos) ───────────
// Última data conocida por teléfono para que la UI no muera.
const espejoChats = new Map<string, ChatRider>();
const espejoMensajes = new Map<string, MensajeRider[]>();

function aChat(id: string, data: any): ChatRider {
  return {
    clientPhone: id,
    clientName: data.clientName || 'Cliente WhatsApp',
    lastMessage: data.lastMessage || '',
    lastMessageTime: data.lastMessageTime?.toMillis
      ? data.lastMessageTime.toMillis()
      : data.lastMessageTime || Date.now(),
    lastMessageType: data.lastMessageType || 'text',
    unreadCount: data.unreadCount || 0,
    status: data.status || 'active',
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt || Date.now(),
    avatar: data.avatar,
    tags: data.tags || [],
    notes: data.notes || '',
  };
}

function aMensaje(id: string, data: any): MensajeRider {
  return {
    id,
    direction: data.direction || 'sent',
    text: data.text || '',
    media: data.media || null,
    status: data.status || 'sent',
    timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : data.timestamp || Date.now(),
    senderId: data.senderId || 'meta-api',
    errorMessage: data.errorMessage,
    templateName: data.templateName,
    metaMessageId: data.metaMessageId,
  };
}

// ── Suscripciones en tiempo real ───────────────────────────

/** Escucha la lista de chats (ordenada por el más reciente) */
export function subscribeToChats(
  onUpdate: (chats: ChatRider[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db) {
    onUpdate([...espejoChats.values()].sort((a, b) => b.lastMessageTime - a.lastMessageTime));
    return () => {};
  }
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, orderBy('lastMessageTime', 'desc'), limit(100));
    return onSnapshot(
      q,
      (snapshot) => {
        const chats: ChatRider[] = [];
        snapshot.forEach((d) => {
          const chat = aChat(d.id, d.data());
          chats.push(chat);
          espejoChats.set(d.id, chat);
        });
        onUpdate(chats);
      },
      (error) => {
        console.warn('[RiderChat] lista de chats:', error.message);
        onError?.(error);
        // Respaldo: lo último conocido
        onUpdate([...espejoChats.values()].sort((a, b) => b.lastMessageTime - a.lastMessageTime));
      }
    );
  } catch (e: any) {
    console.warn('[RiderChat] sub chats:', e?.message);
    onUpdate([]);
    return () => {};
  }
}

/** Escucha los mensajes de un cliente (los últimos 200) */
export function subscribeToMessages(
  clientPhone: string,
  onUpdate: (messages: MensajeRider[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!clientPhone) {
    onUpdate([]);
    return () => {};
  }
  if (!db) {
    onUpdate(espejoMensajes.get(clientPhone) || []);
    return () => {};
  }
  try {
    const messagesRef = collection(db, 'chats', clientPhone, 'messages');
    // DESC + reverse → siempre los ÚLTIMOS 200 en orden cronológico
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(200));
    return onSnapshot(
      q,
      (snapshot) => {
        const msgs: MensajeRider[] = [];
        snapshot.forEach((d) => msgs.push(aMensaje(d.id, d.data())));
        msgs.reverse();
        espejoMensajes.set(clientPhone, msgs);
        onUpdate(msgs);
      },
      (error) => {
        console.warn('[RiderChat] mensajes:', error.message);
        onError?.(error);
        onUpdate(espejoMensajes.get(clientPhone) || []);
      }
    );
  } catch (e: any) {
    console.warn('[RiderChat] sub mensajes:', e?.message);
    onUpdate([]);
    return () => {};
  }
}

// ── Escrituras ─────────────────────────────────────────────

/**
 * Guarda un mensaje y actualiza la vista previa del chat.
 * Devuelve el ID generado (o uno local si Firestore falla).
 */
export async function sendMessageToFirestore(
  clientPhone: string,
  message: Omit<MensajeRider, 'id'> & { id?: string }
): Promise<string> {
  const msgId = message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const textoPreview =
    message.text || (message.media ? `[${String(message.media.type).toUpperCase()}]` : '');

  if (db) {
    try {
      await setDoc(doc(db, 'chats', clientPhone, 'messages', msgId), {
        direction: message.direction,
        text: message.text || '',
        media: message.media || null,
        status: message.status,
        timestamp: serverTimestamp(),
        senderId: message.senderId,
        errorMessage: message.errorMessage || null,
        templateName: message.templateName || null,
      });

      // Vista previa del chat + no leídos si entró un mensaje del cliente
      await setDoc(
        doc(db, 'chats', clientPhone),
        {
          lastMessage: textoPreview,
          lastMessageTime: serverTimestamp(),
          lastMessageType: message.media ? message.media.type : 'text',
          ...(message.direction === 'received' ? { unreadCount: increment(1) } : {}),
        },
        { merge: true }
      );
    } catch (e: any) {
      console.warn('[RiderChat] guardando mensaje:', e?.message);
    }
  }

  // Respaldo local (para que la UI se vea al instante igual)
  const fullMsg: MensajeRider = { ...message, id: msgId } as MensajeRider;
  const actuales = espejoMensajes.get(clientPhone) || [];
  espejoMensajes.set(clientPhone, [...actuales, fullMsg]);
  const chat = espejoChats.get(clientPhone);
  if (chat) {
    chat.lastMessage = textoPreview;
    chat.lastMessageTime = message.timestamp || Date.now();
    chat.lastMessageType = message.media ? message.media.type : 'text';
    if (message.direction === 'received') chat.unreadCount += 1;
  }

  return msgId;
}

/** Actualiza el estado de un mensaje (pending → sent → delivered/read/failed) */
export async function updateMessageStatus(
  clientPhone: string,
  messageId: string,
  status: EstadoMensaje,
  errorMessage?: string
): Promise<void> {
  if (db) {
    try {
      await updateDoc(doc(db, 'chats', clientPhone, 'messages', messageId), {
        status,
        ...(errorMessage ? { errorMessage } : {}),
      });
    } catch (e: any) {
      console.warn('[RiderChat] update status:', e?.message);
    }
  }
  const msgs = espejoMensajes.get(clientPhone);
  const target = msgs?.find((m) => m.id === messageId);
  if (target) {
    target.status = status;
    if (errorMessage) target.errorMessage = errorMessage;
  }
}

/** Guarda el metaMessageId (para conciliar estados del webhook después) */
export async function updateMessageMetaId(
  clientPhone: string,
  messageId: string,
  metaMessageId: string
): Promise<void> {
  if (!metaMessageId) return;
  if (db) {
    try {
      await updateDoc(doc(db, 'chats', clientPhone, 'messages', messageId), {
        metaMessageId,
      });
    } catch (e: any) {
      console.warn('[RiderChat] update meta id:', e?.message);
    }
  }
  const target = espejoMensajes.get(clientPhone)?.find((m) => m.id === messageId);
  if (target) target.metaMessageId = metaMessageId;
}

/** Marca el chat como leído (unread = 0) */
export async function markChatAsRead(clientPhone: string): Promise<void> {
  if (db) {
    try {
      await updateDoc(doc(db, 'chats', clientPhone), { unreadCount: 0 });
    } catch (e: any) {
      console.warn('[RiderChat] marcar leído:', e?.message);
    }
  }
  const chat = espejoChats.get(clientPhone);
  if (chat) chat.unreadCount = 0;
}

/**
 * Crea un chat NUEVO. Si ya existía, solo actualiza el nombre
 * (sin pisar el lastMessage — bug del original corregido).
 */
export async function crearOActualizarChat(chatData: {
  clientPhone: string;
  clientName: string;
  status?: EstadoChat;
  tags?: string[];
  notes?: string;
}): Promise<void> {
  const { clientPhone, clientName, status = 'active', tags = [], notes = '' } = chatData;
  const yaExistia = espejoChats.has(clientPhone);

  if (db) {
    try {
      if (yaExistia) {
        // Solo metadatos — la vista previa queda intacta
        await updateDoc(doc(db, 'chats', clientPhone), { clientName, status, tags, notes });
      } else {
        await setDoc(
          doc(db, 'chats', clientPhone),
          {
            clientName,
            clientPhone,
            status,
            tags,
            notes,
            unreadCount: 0,
            createdAt: serverTimestamp(),
            lastMessage: 'Chat creado',
            lastMessageTime: serverTimestamp(),
            lastMessageType: 'text',
          },
          { merge: true }
        );
      }
    } catch (e: any) {
      console.warn('[RiderChat] crear/actualizar chat:', e?.message);
    }
  }

  // Respaldo local
  const existente = espejoChats.get(clientPhone);
  if (existente) {
    existente.clientName = clientName;
    existente.status = status;
    existente.tags = tags;
    existente.notes = notes;
  } else {
    espejoChats.set(clientPhone, {
      clientPhone,
      clientName,
      lastMessage: 'Chat creado',
      lastMessageTime: Date.now(),
      lastMessageType: 'text',
      unreadCount: 0,
      status,
      createdAt: Date.now(),
      tags,
      notes,
    });
    espejoMensajes.set(clientPhone, []);
  }
}

/**
 * Simula la respuesta de un cliente (para el modo demo y para
 * probar el flujo sin webhook). NO se usa en producción real.
 */
export function simularMensajeCliente(clientPhone: string, texto: string): void {
  sendMessageToFirestore(clientPhone, {
    direction: 'received',
    text: texto,
    status: 'read',
    timestamp: Date.now(),
    senderId: 'client',
  });
}

// ── Subida de media a Storage ──────────────────────────────

/**
 * Sube una imagen/documento del chat a Storage y devuelve la
 * URL PÚBLICA (la Cloud API necesita un link que Meta pueda
 * descargar — un blob local no le sirve).
 *
 * Usa las carpetas que las reglas de Storage ya permiten:
 *   • imagenes/documentos → entregas/{uid}/chat_…
 *   • audios              → campanas/chat_audios/{uid}/…
 */
export async function subirMediaChat(
  uid: string,
  clientPhone: string,
  archivo: Blob,
  nombreOriginal: string,
  tipo: 'image' | 'document' | 'audio'
): Promise<string> {
  if (!storage) throw new Error('Storage no disponible');
  const extension = (nombreOriginal.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const tel = String(clientPhone).replace(/[^0-9]/g, '').slice(-9);
  const ruta =
    tipo === 'audio'
      ? `campanas/chat_audios/${uid}/${tel}_${Date.now()}.${extension}`
      : `entregas/${uid}/chat_${tel}_${Date.now()}.${extension}`;
  const ref = storageRef(storage, ruta);
  await uploadBytes(ref, archivo, {
    contentType: archivo.type || 'application/octet-stream',
    customMetadata: { uid, tel, tipo: 'media_riderchat' },
  });
  return getDownloadURL(ref);
}
