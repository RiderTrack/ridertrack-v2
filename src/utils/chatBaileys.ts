// ═══════════════════════════════════════════════════════════
// 🤖 CHAT BAILEYS — Capa de datos (Fase 3.1 · Mudanza ClienteTrack)
// ═══════════════════════════════════════════════════════════
// Unifica en UNA línea de tiempo por cliente las 4 fuentes que
// maneja el robot de Baileys (rudy-bot):
//
//   1. mensajes_clientes    → entrantes del cliente (texto, imagen,
//                             audio, documento, ubicación)
//   2. respuestas_manuales  → salientes manuales tuyos (outbox con
//                             estado enviado/pendiente)
//   3. acciones_bot/{uid}/pendientes → lo que el BOT envió por ti
//                             (avisar_entrega, avisar_siguiente,
//                             solicitar_ubicacion, enviar_yape,
//                             broadcast_inicio...) — procesadas y
//                             NO procesadas
//   4. cola_envio           → mensajes de CAMPAÑA masiva con su
//                             estado (pendiente/enviado/fallido)
//
// + campanas  (lista de campañas con stats para el panel Broadcast)
// + bot_silenciado (chats donde apagaste el bot)
//
// La app SOLO escribe en las colas; el robot de Baileys es el único
// que toca WhatsApp (igual que la v1). Cero riesgo de baneo extra.
// ═══════════════════════════════════════════════════════════

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  limit,
  query,
  addDoc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  where,
  QuerySnapshot,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../services/firebase';

/** UID del rider dueño del bot (mismo que usa la v1 y la v2) */
export const UID_BOT = 'K8wx9X5GGOfindI1RGtIIQN3UGr1';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type OrigenMensaje = 'cliente' | 'rudy' | 'bot' | 'campana';
export type TipoContenido = 'texto' | 'imagen' | 'audio' | 'documento' | 'ubicacion' | 'yape_qr';

/** Mensaje unificado de la línea de tiempo */
export interface MensajeChat {
  id: string;
  /** clave de conversación: celular de 9 dígitos (sin 51) */
  tel: string;
  origen: OrigenMensaje;
  tipoContenido: TipoContenido;
  texto: string;
  timestamp: number;
  /** entrante sin leer */
  leido: boolean;
  /** saliente: null = n/a, false = pendiente, true = enviado */
  enviado: boolean | null;
  /** etiqueta de la acción del bot (avisar_entrega, solicitar_ubicacion...) */
  accionBot?: string;
  /** estado de campaña (cola_envio) */
  estadoCampana?: 'pendiente' | 'procesando' | 'enviado' | 'fallido';
  nombreCampana?: string;
  /** adjuntos */
  base64?: string;
  mimetype?: string;
  nombreArchivo?: string;
  /** ubicación */
  lat?: number | null;
  lng?: number | null;
  /** para poder borrar entradas de mensajes_clientes */
  borrableDocId?: string;
  nombre?: string;
}

export interface Conversacion {
  tel: string;
  nombre: string;
  mensajes: MensajeChat[];
  noLeidos: number;
  ultimoTimestamp: number;
  ultimoMensaje: MensajeChat | null;
  silenciado: boolean;
  detalleSilencio?: string;
}

export interface CampanaBot {
  id: string;
  nombre: string;
  mensaje: string;
  estado: string;
  creadaEn: string;
  velocidad: number;
  esPrueba?: boolean;
  stats: { total: number; enviados: number; fallidos: number; pendientes: number };
  tieneMultimedia: boolean;
}

// ─────────────────────────────────────────────────────────────
// NORMALIZACIÓN DE TELÉFONOS
// ─────────────────────────────────────────────────────────────

/**
 * Clave canónica de conversación: 9 dígitos sin el 51 de Perú.
 * mensajes_clientes guarda "985294454", acciones_bot guarda
 * "51985294454", bot_silenciado usa id "51985294454" — esto
 * unifica todo.
 */
export function telKey(cel: unknown): string {
  const d = String(cel ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9) return d;
  if (d.length >= 11 && d.startsWith('51')) return d.slice(2, 11);
  return d.slice(-9);
}

/** Celular completo con 51 (para acciones del bot y bot_silenciado) */
export function telCompleto(tel9: string): string {
  const d = String(tel9 ?? '').replace(/\D/g, '');
  return d.length === 9 ? '51' + d : d;
}

/** Variantes de un mismo número (9 dígitos y con 51) para buscar */
export function telVariants(tel9: string): string[] {
  const t = telKey(tel9);
  if (!t) return [];
  const full = '51' + t;
  return [t, full, '+51' + t];
}

// ─────────────────────────────────────────────────────────────
// SUSCRIPCIONES (tiempo real)
// ─────────────────────────────────────────────────────────────

type ChatDataListener = (conversaciones: Conversacion[], stats: ChatStats) => void;

export interface ChatStats {
  total: number;
  noLeidos: number;
  mensajesHoy: number;
  silenciados: number;
}

interface SuscripcionesChat {
  cancelar: () => void;
}

/**
 * Suscripción combinada a las 4 fuentes de la línea de tiempo.
 * Devuelve las conversaciones ordenadas por última actividad.
 */
export function suscribirChat(callback: ChatDataListener): SuscripcionesChat {
  const convs = new Map<string, Conversacion>();
  let silenciados = new Set<string>();
  const detallesSilencio = new Map<string, string>();
  let unsubs: Unsubscribe[] = [];

  const emitir = () => {
    // recontar no leídos + silencio
    let noLeidos = 0;
    let mensajesHoy = 0;
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const lista = Array.from(convs.values());
    lista.forEach((c) => {
      c.noLeidos = c.mensajes.filter((m) => m.origen === 'cliente' && !m.leido).length;
      c.mensajes.sort((a, b) => a.timestamp - b.timestamp);
      c.ultimoMensaje = c.mensajes.length ? c.mensajes[c.mensajes.length - 1] : null;
      c.ultimoTimestamp = c.ultimoMensaje ? c.ultimoMensaje.timestamp : 0;
      c.silenciado = silenciados.has(c.tel);
      c.detalleSilencio = detallesSilencio.get(c.tel);
      noLeidos += c.noLeidos;
      mensajesHoy += c.mensajes.filter((m) => m.timestamp >= inicioHoy.getTime()).length;
    });

    lista.sort((a, b) => b.ultimoTimestamp - a.ultimoTimestamp);

    callback(lista, {
      total: lista.length,
      noLeidos,
      mensajesHoy,
      silenciados: silenciados.size,
    });
  };

  const asegurarConv = (tel: string, nombre?: string): Conversacion => {
    const key = telKey(tel);
    let c = convs.get(key);
    if (!c) {
      c = {
        tel: key,
        nombre: nombre && nombre !== 'Cliente' ? nombre : 'Cliente ' + key.slice(-4),
        mensajes: [],
        noLeidos: 0,
        ultimoTimestamp: 0,
        ultimoMensaje: null,
        silenciado: false,
      };
      convs.set(key, c);
    }
    // Mezclar el mejor nombre disponible
    if (nombre && nombre !== 'Cliente' && (c.nombre.startsWith('Cliente ') || !c.nombre)) {
      c.nombre = nombre;
    }
    return c;
  };

  const ignorar = (e: Error) => console.warn('[chatBaileys] listener:', e.message);

  // 1. Entrantes del cliente
  unsubs.push(
    onSnapshot(
      query(collection(db!, 'mensajes_clientes'), orderBy('timestamp', 'desc'), limit(300)),
      (snap: QuerySnapshot<DocumentData>) => {
        // Reconstruir mensajes entrantes (los salientes NO se loggean aquí)
        convs.forEach((c) => {
          c.mensajes = c.mensajes.filter((m) => m.origen !== 'cliente');
        });
        snap.forEach((d) => {
          const m = d.data();
          const tel = telKey(m.telefono);
          if (!tel) return;
          const conv = asegurarConv(tel, m.nombre);
          conv.mensajes.push({
            id: 'mc_' + d.id,
            tel,
            origen: 'cliente',
            tipoContenido: (m.tipoContenido as TipoContenido) || 'texto',
            texto: m.texto || '',
            timestamp: Number(m.timestamp) || 0,
            leido: !!m.leido,
            enviado: null,
            base64: m.base64 || undefined,
            mimetype: m.mimetype || undefined,
            nombreArchivo: m.nombreArchivo || undefined,
            lat: m.lat ?? null,
            lng: m.lng ?? null,
            borrableDocId: d.id,
            nombre: m.nombre,
          });
        });
        convs.forEach((c) => {
          if (c.mensajes.length === 0 && c.ultimoTimestamp === 0) convs.delete(c.tel);
        });
        emitir();
      },
      ignorar
    )
  );

  // 2. Salientes manuales (outbox → el bot los manda y marca enviado)
  unsubs.push(
    onSnapshot(
      query(collection(db!, 'respuestas_manuales'), orderBy('timestamp', 'desc'), limit(120)),
      (snap: QuerySnapshot<DocumentData>) => {
        convs.forEach((c) => {
          c.mensajes = c.mensajes.filter((m) => m.origen !== 'rudy');
        });
        snap.forEach((d) => {
          const m = d.data();
          const tel = telKey(m.telefono);
          if (!tel) return;
          const conv = asegurarConv(tel, m.nombre);
          conv.mensajes.push({
            id: 'rm_' + d.id,
            tel,
            origen: 'rudy',
            tipoContenido: (m.tipoContenido as TipoContenido) || 'texto',
            texto: m.texto || '',
            timestamp: Number(m.timestamp) || 0,
            leido: true,
            enviado: !!m.enviado,
            base64: m.base64 || undefined,
            mimetype: m.mimetype || undefined,
            nombreArchivo: m.nombreArchivo || undefined,
            nombre: m.nombre,
          });
        });
        emitir();
      },
      ignorar
    )
  );

  // 3. Acciones del bot (avisos, ubicación, yape, broadcast inicio)
  unsubs.push(
    onSnapshot(
      query(collection(db!, 'acciones_bot', UID_BOT, 'pendientes'), orderBy('createdAt', 'desc'), limit(80)),
      (snap: QuerySnapshot<DocumentData>) => {
        convs.forEach((c) => {
          c.mensajes = c.mensajes.filter((m) => m.origen !== 'bot');
        });
        snap.forEach((d) => {
          const m = d.data();
          const tel = telKey(m.telefono);
          if (!tel) return;
          const conv = asegurarConv(tel, m.nombre);
          const ts = m.createdAt ? Date.parse(m.createdAt) : 0;
          conv.mensajes.push({
            id: 'ab_' + d.id,
            tel,
            origen: 'bot',
            tipoContenido: 'texto',
            texto: etiquetaAccionBot(m.tipo as string),
            timestamp: ts || (m.processedAt ? Date.parse(m.processedAt) : 0),
            leido: true,
            enviado: m.processed === undefined ? null : !!m.processed,
            accionBot: m.tipo,
            nombre: m.nombre,
          });
        });
        emitir();
      },
      ignorar
    )
  );

  // 4. Campañas masivas (cola_envio con estado por destinatario)
  unsubs.push(
    onSnapshot(
      query(collection(db!, 'cola_envio'), limit(80)),
      (snap: QuerySnapshot<DocumentData>) => {
        convs.forEach((c) => {
          c.mensajes = c.mensajes.filter((m) => m.origen !== 'campana');
        });
        snap.forEach((d) => {
          const m = d.data();
          const tel = telKey(m.celular);
          if (!tel) return;
          const conv = asegurarConv(tel, m.nombre);
          const ts = m.enviado_en
            ? Date.parse(m.enviado_en)
            : m.procesado_en
              ? Date.parse(m.procesado_en)
              : m.creada_en
                ? Date.parse(m.creada_en)
                : 0;
          conv.mensajes.push({
            id: 'ce_' + d.id,
            tel,
            origen: 'campana',
            tipoContenido: 'texto',
            texto: m.mensaje || '',
            timestamp: ts,
            leido: true,
            enviado: m.status === 'enviado',
            estadoCampana: m.status,
            nombreCampana: m.campaign_id,
            nombre: m.nombre,
          });
        });
        emitir();
      },
      ignorar
    )
  );

  // 5. Bot silenciado
  unsubs.push(
    onSnapshot(
      collection(db!, 'bot_silenciado'),
      (snap: QuerySnapshot<DocumentData>) => {
        silenciados = new Set<string>();
        detallesSilencio.clear();
        snap.forEach((d) => {
          const tel = telKey(d.id || d.data()?.celular);
          if (d.data()?.activo === false) return;
          if (tel) {
            silenciados.add(tel);
            detallesSilencio.set(tel, d.data()?.detalle || '');
          }
        });
        emitir();
      },
      ignorar
    )
  );

  return {
    cancelar: () => unsubs.forEach((u) => { try { u(); } catch { /* noop */ } }),
  };
}

/** Texto amigable para las acciones del bot */
export function etiquetaAccionBot(tipo?: string): string {
  switch (tipo) {
    case 'avisar_entrega': return '✅ Aviso de entrega enviado';
    case 'avisar_siguiente': return '🛵 Aviso: motorizado en camino';
    case 'avisar_posicion': return '📍 Posición del rider compartida';
    case 'solicitar_ubicacion': return '📍 Pedido de ubicación enviado';
    case 'enviar_yape': return '💰 QR de Yape enviado';
    case 'broadcast_inicio': return '📢 Aviso de inicio de ruta';
    case 'enviar_texto_directo': return '💬 Mensaje del bot';
    case 'enviar_grupo_mate': return '👥 Reporte al grupo MATE';
    case 'sincronizar_lids': return '🔄 Contactos sincronizados';
    default: return '🤖 Acción del bot' + (tipo ? ` (${tipo})` : '');
  }
}

/**
 * Suscripción a las campañas (panel Broadcast dentro del chat).
 */
export function suscribirCampanas(callback: (campanas: CampanaBot[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db!, 'campanas'), orderBy('creada_en', 'desc'), limit(15)),
    (snap: QuerySnapshot<DocumentData>) => {
      const lista: CampanaBot[] = [];
      snap.forEach((d) => {
        const m = d.data();
        lista.push({
          id: d.id,
          nombre: m.nombre || 'Sin nombre',
          mensaje: m.mensaje || '',
          estado: m.estado || '?',
          creadaEn: m.creada_en || '',
          velocidad: m.velocidad || 8,
          esPrueba: !!m.es_prueba,
          stats: m.stats || { total: 0, enviados: 0, fallidos: 0, pendientes: 0 },
          tieneMultimedia: !!m.multimedia?.url,
        });
      });
      callback(lista);
    },
    (e) => console.warn('[chatBaileys] campanas:', e.message)
  );
}

// ─────────────────────────────────────────────────────────────
// ACCIONES (escribir — el bot de Baileys hace el envío real)
// ─────────────────────────────────────────────────────────────

interface RiderInfo {
  nombre: string;
  telefono: string;
  empresa: string;
}

/**
 * Enviar mensaje de texto manual → respuestas_manuales.
 * Payload idéntico al de la v1 (clienteTrack) para que el bot lo
 * procese igual.
 */
export async function enviarMensajeChat(
  tel: string,
  nombre: string,
  texto: string,
  rider?: RiderInfo
): Promise<void> {
  const t9 = telKey(tel);
  if (!t9 || !texto.trim()) throw new Error('Mensaje vacío o número inválido');
  await addDoc(collection(db!, 'respuestas_manuales'), {
    telefono: t9,
    nombre: nombre || 'Cliente',
    texto: texto.trim(),
    enviado: false,
    timestamp: Date.now(),
    creadoPor: 'clienteTrack',
    jidOriginal: '',
    uid: UID_BOT,
    ...(rider ? { rider } : {}),
  });
}

/** Enviar adjunto (imagen comprimida o documento <700KB) → respuestas_manuales */
export async function enviarAdjuntoChat(
  tel: string,
  nombre: string,
  tipoContenido: 'imagen' | 'documento',
  base64: string,
  mimetype: string,
  nombreArchivo: string,
  textoPreview: string
): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  await addDoc(collection(db!, 'respuestas_manuales'), {
    telefono: t9,
    nombre: nombre || 'Cliente',
    texto: textoPreview,
    tipoContenido,
    base64,
    mimetype,
    nombreArchivo,
    enviado: false,
    timestamp: Date.now(),
    creadoPor: 'clienteTrack',
    jidOriginal: '',
    uid: UID_BOT,
  });
}

/**
 * 📍 PEDIR UBICACIÓN → el bot manda la plantilla oficial con la
 * imagen solicitar_ubicacion.jpg y espera las coordenadas del
 * cliente (que llegarán a mensajes_clientes como ubicacion).
 */
export async function pedirUbicacionBot(
  tel: string,
  nombre: string,
  rider: RiderInfo
): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  await addDoc(collection(db!, 'acciones_bot', UID_BOT, 'pendientes'), {
    tipo: 'solicitar_ubicacion',
    clienteId: 'chat_' + t9,
    telefono: telCompleto(t9),
    nombre: nombre || 'Cliente',
    prod: '',
    cobrar: 0,
    dir: '',
    dist: '',
    rider,
    createdAt: new Date().toISOString(),
    processed: false,
  });
}

/** 💰 Enviar QR de Yape (el bot lo saca de ruta_activa y lo manda) */
export async function enviarYapeQRChat(tel: string, nombre: string): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  await addDoc(collection(db!, 'respuestas_manuales'), {
    telefono: t9,
    nombre: nombre || 'Cliente',
    texto: '📲 QR de Yape',
    tipoContenido: 'yape_qr',
    enviado: false,
    timestamp: Date.now(),
    creadoPor: 'clienteTrack',
    jidOriginal: '',
    uid: UID_BOT,
  });
}

/**
 * 🔇 Silenciar el bot para un cliente (el bot no le responde
 * automáticamente hasta que lo reactives).
 */
export async function silenciarBot(tel: string, detalle: string): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  await setDoc(doc(db!, 'bot_silenciado', telCompleto(t9)), {
    celular: telCompleto(t9),
    detalle: detalle || 'silenciado desde RiderTrack V2',
    expira_en: null,
    activo: true,
    creado_en: new Date().toISOString(),
  });
}

/** 🔔 Reactivar el bot para un cliente */
export async function reactivarBot(tel: string): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  await deleteDoc(doc(db!, 'bot_silenciado', telCompleto(t9)));
}

/** Marcar como leídos los entrantes de una conversación */
export async function marcarLeidoChat(tel: string): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) return;
  const variantes = telVariants(t9);
  try {
    const snap = await getDocs(
      query(collection(db!, 'mensajes_clientes'), where('telefono', 'in', variantes), where('leido', '==', false))
    );
    if (snap.empty) return;
    const batch = writeBatch(db!);
    snap.forEach((d) => batch.update(d.ref, { leido: true }));
    await batch.commit();
  } catch (e: any) {
    console.warn('[chatBaileys] marcarLeido:', e.message);
  }
}

/** Eliminar un mensaje entrante (spam / foto pesada) */
export async function eliminarMensajeChat(docId: string): Promise<void> {
  await deleteDoc(doc(db!, 'mensajes_clientes', docId));
}

// ─────────────────────────────────────────────────────────────
// HELPERS DE UI
// ─────────────────────────────────────────────────────────────

/** Color determinístico para el avatar según el teléfono */
export function colorAvatar(tel: string): { bg: string; texto: string } {
  const paleta = [
    { bg: 'bg-emerald-600', texto: 'text-white' },
    { bg: 'bg-sky-600', texto: 'text-white' },
    { bg: 'bg-violet-600', texto: 'text-white' },
    { bg: 'bg-amber-600', texto: 'text-white' },
    { bg: 'bg-rose-600', texto: 'text-white' },
    { bg: 'bg-teal-600', texto: 'text-white' },
    { bg: 'bg-indigo-600', texto: 'text-white' },
    { bg: 'bg-orange-600', texto: 'text-white' },
  ];
  let h = 0;
  for (let i = 0; i < tel.length; i++) h = (h * 31 + tel.charCodeAt(i)) >>> 0;
  return paleta[h % paleta.length];
}

/** Formato corto de hora para la lista */
export function horaCorta(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

/** Etiqueta de día para separadores: HOY / AYER / 12 AGO */
export function etiquetaDia(ts: number): string {
  const d = new Date(ts);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const mismoDia = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (mismoDia(d, hoy)) return 'HOY';
  if (mismoDia(d, ayer)) return 'AYER';
  const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

/** Hora completa dentro de la burbuja */
export function horaBurbuja(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return horaCorta(ts) + ' · ' + etiquetaDia(ts).toLowerCase();
}

/** Comprimir imagen a JPEG base64 (mismo límite que la v1: 1280px / 0.72) */
export function comprimirImagen(file: File): Promise<{ base64: string; mimetype: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const MAX = 1280;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
          else { w = Math.round((w * MAX) / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        URL.revokeObjectURL(url);
        resolve({ base64: dataUrl.split(',')[1], mimetype: 'image/jpeg' });
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

/** Leer documento como base64 con límite de 700KB (Firestore 1MB/doc) */
export function leerDocumento(file: File): Promise<{ base64: string; mimetype: string }> {
  const LIMITE = 700 * 1024;
  if (file.size > LIMITE) {
    return Promise.reject(new Error(`Archivo muy pesado (${Math.round(file.size / 1024)} KB). Máximo 700 KB.`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1];
      resolve({ base64, mimetype: file.type || 'application/octet-stream' });
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/** Descargar un adjunto base64 */
export function descargarBase64(base64: string, mimetype: string, nombre: string): void {
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimetype });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre || 'archivo';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  } catch (e) {
    console.warn('[chatBaileys] descargar:', e);
  }
}
