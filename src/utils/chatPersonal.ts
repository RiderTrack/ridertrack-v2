// ═══════════════════════════════════════════════════════════
// 📱 chatPersonal.ts — capa de datos del WhatsApp PERSONAL
// (FASE 4.1) · habla con bot-personal.js v1.3 (Termux 2)
//
// Colecciones (100% nuevas, separadas del bot de clientes):
//   mensajes_personal    → conversación completa (📥 + lo tuyo)
//   media_personal       → adjuntos base64 (on-demand)
//   contactos_personal   → lista + etiquetas + archivado + presencia
//   respuestas_personal  → outbox manual (la app escribe, el bot manda)
//   respuestas_rapidas_personal → plantillas ⚡ (motor apagado 4.1)
//   sistema/estado_personal      → conectado + QR + latido + eventos
// ═══════════════════════════════════════════════════════════

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  limit as fsLimit,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
// Reutilizamos utilidades PROBADAS del Chat Baileys (mismo look & feel)
// ⚠️ NO usamos telKey acá: corta a 9 dígitos y MUTILA los LIDs — el bot
// ya guarda `telefono` normalizado (dígitos completos o jid @g.us).
import {
  colorAvatar,
  comprimirImagen,
  leerDocumento,
  iniciarGrabacionAudio,
  descargarBase64,
} from './chatBaileys';

export { colorAvatar, comprimirImagen, iniciarGrabacionAudio, descargarBase64 };

/** Formato bonito para mostrar: +51 9XX XXX XXX (LIDs quedan tal cual). */
export function telBonitoPersonal(tel: string): string {
  const d = String(tel || '');
  if (d.includes('@')) return d.split('@')[0];
  const digitos = d.replace(/\D/g, '');
  if (digitos.length === 11 && digitos.startsWith('51')) {
    return '+51 ' + digitos.slice(2, 5) + ' ' + digitos.slice(5, 8) + ' ' + digitos.slice(8);
  }
  if (digitos.length === 12 && digitos.startsWith('51')) {
    return '+51 ' + digitos.slice(2, 6) + ' ' + digitos.slice(6, 9) + ' ' + digitos.slice(9);
  }
  return d;
}

// ── Tipos ──────────────────────────────────────────────────

export type TipoContenidoPersonal =
  | 'texto' | 'imagen' | 'video' | 'audio' | 'sticker'
  | 'documento' | 'ubicacion' | 'contacto' | 'llamada';

export type OrigenPersonal = 'personal' | 'yo' | 'auto';

export interface MensajePersonal {
  id: string;
  telefono: string;          // grupo: jid @g.us · persona: dígitos
  jidOriginal?: string;      // jid real (para LIDs)
  nombre?: string;           // pushName
  texto: string;
  tipoContenido: TipoContenidoPersonal;
  esGrupo: boolean;
  participante?: string;     // jid del que habla (grupos)
  participanteNombre?: string;
  origen: OrigenPersonal;
  leido: boolean;
  timestamp: number;
  tieneMedia?: boolean;      // media en media_personal/{id}
  mime?: string;
  nombreArchivo?: string;
  bytes?: number;
  adjuntoGrande?: boolean;   // >900 KB: no se guarda el archivo
  llamadaEstado?: string;    // entrante | perdida | contestada | rechazada | terminada
  esVideo?: boolean;
  desdePanel?: boolean;
}

export type EtiquetaPersonal = 'familia' | 'amigo' | 'pareja' | 'trabajo' | 'otro';

export const ETIQUETAS_PERSONAL: {
  id: EtiquetaPersonal;
  nombre: string;
  icono: string;
  chip: string;
  punto: string;
}[] = [
  { id: 'familia', nombre: 'Familia', icono: '👨‍👩‍👧‍👦', chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30', punto: 'bg-sky-400' },
  { id: 'amigo', nombre: 'Amigo', icono: '🤝', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30', punto: 'bg-amber-400' },
  { id: 'pareja', nombre: 'Pareja', icono: '❤️', chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30', punto: 'bg-rose-400' },
  { id: 'trabajo', nombre: 'Trabajo', icono: '💼', chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30', punto: 'bg-violet-400' },
  { id: 'otro', nombre: 'Otro', icono: '🏷️', chip: 'bg-slate-500/15 text-slate-300 border-slate-500/30', punto: 'bg-slate-400' },
];

export interface ContactoPersonal {
  telefono: string;
  jidOriginal?: string;
  nombre: string;
  esGrupo?: boolean;
  ultimaVez?: number;
  etiqueta?: EtiquetaPersonal;
  archivado?: boolean;
  restringido?: boolean;
  enLinea?: boolean;
  escribiendo?: boolean;
  grabando?: boolean;
  presenciaEstado?: string;
  presenciaTs?: number;
  ultimaVezVisto?: number;
}

export interface EventoConexionPersonal {
  estado: string;
  detalle?: string;
  ts: number;
}

export interface EstadoPersonal {
  conectado?: boolean;
  telefonoPropio?: string;
  qrTexto?: string;
  qrAt?: number;
  latidoAt?: number;
  version?: string;
  estadoConexion?: string;
  eventos?: EventoConexionPersonal[];
  entrantesHoy?: number;
  sesionDesde?: number;
}

/** Respuesta escrita en la app (outbox) — pendiente hasta que el bot la mande */
export interface RespuestaPendientePersonal {
  id: string;
  telefono: string;
  nombre?: string;
  texto: string;
  tipo?: 'texto' | 'imagen' | 'audio' | 'documento';
  base64?: string;
  mimetype?: string;
  nombreArchivo?: string;
  processed?: boolean;
  idWa?: string;
  error?: string;
  createdAt?: string;
}

export interface RespuestaRapidaPersonal {
  id: string;
  nombre: string;
  texto: string;
  icono?: string;
  atajos?: string;
  activa?: boolean;
  orden?: number;
}

export interface ConversacionPersonal {
  telefono: string;
  jidOriginal: string;
  nombre: string;
  esGrupo: boolean;
  mensajes: MensajePersonal[];
  noLeidos: number;
  ultimoTimestamp: number;
  ultimo: MensajePersonal | null;
  etiqueta?: EtiquetaPersonal;
  archivado?: boolean;
  restringido?: boolean;
  enLinea?: boolean;
  escribiendo?: boolean;
  grabando?: boolean;
  ultimaVezVisto?: number;
}

export interface StatsPersonal {
  total: number;
  noLeidos: number;
  archivados: number;
  grupos: number;
  hoy: number;
}

// ── Conversión teléfono ↔ jid ─────────────────────────────

/** jid completo al que mandarle (respeta grupos y LIDs). */
export function jidDeConversacion(conv: { telefono: string; jidOriginal?: string }): string {
  if (conv.jidOriginal && (conv.jidOriginal.includes('@s.whatsapp.net') || conv.jidOriginal.includes('@g.us') || conv.jidOriginal.includes('@lid'))) {
    return conv.jidOriginal;
  }
  const tel = String(conv.telefono || '');
  if (tel.includes('@g.us')) return tel;
  return tel + '@s.whatsapp.net';
}

/** Texto de preview para la lista de chats. */
export function previewPersonal(m: MensajePersonal | null): string {
  if (!m) return '';
  const prefijo = m.origen === 'yo' ? 'Tú: ' : '';
  switch (m.tipoContenido) {
    case 'imagen': return prefijo + '📷 Imagen' + (m.texto ? ' · ' + m.texto.slice(0, 24) : '');
    case 'video': return prefijo + '🎬 Video';
    case 'audio': return prefijo + '🎙️ Nota de voz';
    case 'sticker': return prefijo + '🎭 Sticker';
    case 'documento': return prefijo + '📄 ' + (m.nombreArchivo || 'Documento');
    case 'ubicacion': return prefijo + '📍 Ubicación';
    case 'contacto': return prefijo + '👤 Contacto';
    case 'llamada': return '📞 Llamada ' + (m.llamadaEstado || '');
    default: return prefijo + (m.texto || '');
  }
}

// ── Suscripción maestra (chats) ───────────────────────────

/** Escucha mensajes + contactos + outbox → conversaciones armadas.
 *  Sin `where` (solo orderBy+limit) → sin índices compuestos.
 *  `pendientes` = burbujas ⏳/⚠️ del outbox (aún sin procesar por el bot). */
export function suscribirChatPersonal(
  callback: (conversaciones: ConversacionPersonal[], stats: StatsPersonal, pendientes: RespuestaPendientePersonal[]) => void
): { cancelar: () => void } {
  const ignorar = (e: unknown) => console.warn('[chatPersonal] listener:', e);
  const canceladores: (() => void)[] = [];
  let mensajes: MensajePersonal[] = [];
  let contactos = new Map<string, ContactoPersonal>();
  let pendientes: RespuestaPendientePersonal[] = [];

  const reconstruir = () => {
    const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
    const porTel = new Map<string, MensajePersonal[]>();
    for (const m of mensajes) {
      const arr = porTel.get(m.telefono) || [];
      arr.push(m);
      porTel.set(m.telefono, arr);
    }
    const convs: ConversacionPersonal[] = [];
    let noLeidos = 0;
    let archivados = 0;
    let grupos = 0;
    let hoy = 0;
    for (const [tel, lista] of porTel) {
      lista.sort((a, b) => a.timestamp - b.timestamp);
      const c = contactos.get(tel);
      const ultimo = lista[lista.length - 1] || null;
      const nl = lista.filter((m) => m.origen !== 'yo' && !m.leido && m.tipoContenido !== 'llamada').length;
      noLeidos += nl;
      if (c?.archivado) archivados++;
      if (c?.esGrupo || ultimo?.esGrupo) grupos++;
      hoy += lista.filter((m) => m.timestamp >= hoy0.getTime()).length;
      convs.push({
        telefono: tel,
        jidOriginal: c?.jidOriginal || ultimo?.jidOriginal || '',
        nombre: c?.nombre || ultimo?.nombre || tel,
        esGrupo: !!(c?.esGrupo || ultimo?.esGrupo),
        mensajes: lista,
        noLeidos: nl,
        ultimoTimestamp: ultimo?.timestamp || 0,
        ultimo,
        etiqueta: c?.etiqueta,
        archivado: c?.archivado,
        restringido: c?.restringido,
        enLinea: c?.enLinea,
        escribiendo: c?.escribiendo,
        grabando: c?.grabando,
        ultimaVezVisto: c?.ultimaVezVisto,
      });
    }
    convs.sort((a, b) => b.ultimoTimestamp - a.ultimoTimestamp);
    // copias nuevas para que React re-renderice (fix useMemo f3.19)
    callback([...convs], { total: convs.length, noLeidos, archivados, grupos, hoy }, pendientes.map((p) => ({ ...p })));
  };

  // 1. mensajes_personal (ventana móvil de 500)
  canceladores.push(
    onSnapshot(
      query(collection(db!, 'mensajes_personal'), orderBy('timestamp', 'desc'), fsLimit(500)),
      (snap) => {
        const map = new Map<string, MensajePersonal>();
        for (const d of snap.docs) {
          const datos = d.data() as Partial<MensajePersonal>;
          map.set(d.id, {
            id: d.id,
            telefono: String(datos.telefono || ''),
            jidOriginal: datos.jidOriginal,
            nombre: datos.nombre,
            texto: String(datos.texto || ''),
            tipoContenido: (datos.tipoContenido || 'texto') as TipoContenidoPersonal,
            esGrupo: !!datos.esGrupo,
            participante: datos.participante,
            participanteNombre: datos.participanteNombre,
            origen: (datos.origen || 'personal') as OrigenPersonal,
            leido: !!datos.leido,
            timestamp: Number(datos.timestamp || 0),
            tieneMedia: !!datos.tieneMedia,
            mime: datos.mime,
            nombreArchivo: datos.nombreArchivo,
            bytes: datos.bytes,
            adjuntoGrande: !!datos.adjuntoGrande,
            llamadaEstado: datos.llamadaEstado,
            esVideo: datos.esVideo,
            desdePanel: datos.desdePanel,
          });
        }
        mensajes = Array.from(map.values());
        reconstruir();
      },
      ignorar
    )
  );

  // 2. contactos_personal (lista + etiquetas + presencia)
  canceladores.push(
    onSnapshot(
      query(collection(db!, 'contactos_personal'), fsLimit(500)),
      (snap) => {
        const map = new Map<string, ContactoPersonal>();
        for (const d of snap.docs) {
          const datos = d.data() as Partial<ContactoPersonal>;
          map.set(d.id, {
            telefono: String(datos.telefono || d.id),
            jidOriginal: datos.jidOriginal,
            nombre: String(datos.nombre || ''),
            esGrupo: !!datos.esGrupo,
            ultimaVez: datos.ultimaVez,
            etiqueta: datos.etiqueta,
            archivado: !!datos.archivado,
            restringido: !!datos.restringido,
            enLinea: !!datos.enLinea,
            escribiendo: !!datos.escribiendo,
            grabando: !!datos.grabando,
            presenciaEstado: datos.presenciaEstado,
            presenciaTs: datos.presenciaTs,
            ultimaVezVisto: datos.ultimaVezVisto,
          });
        }
        contactos = map;
        reconstruir();
      },
      ignorar
    )
  );

  // 3. respuestas_personal (pendientes ⏳ + errores recientes)
  canceladores.push(
    onSnapshot(
      query(collection(db!, 'respuestas_personal'), orderBy('createdAt', 'desc'), fsLimit(80)),
      (snap) => {
        const lista: RespuestaPendientePersonal[] = [];
        for (const d of snap.docs) {
          const datos = d.data() as Partial<RespuestaPendientePersonal>;
          lista.push({
            id: d.id,
            telefono: String(datos.telefono || ''),
            nombre: datos.nombre,
            texto: String(datos.texto || ''),
            tipo: datos.tipo || 'texto',
            base64: datos.base64,
            mimetype: datos.mimetype,
            nombreArchivo: datos.nombreArchivo,
            processed: !!datos.processed,
            idWa: datos.idWa,
            error: datos.error,
            createdAt: datos.createdAt,
          });
        }
        pendientes = lista;
        reconstruir();
      },
      ignorar
    )
  );

  return {
    cancelar: () => canceladores.forEach((c) => {
      try { c(); } catch { /* nada */ }
    }),
  };
}

// ── Estado del bot (conexión + QR + eventos) ──────────────

export function suscribirEstadoPersonal(cb: (estado: EstadoPersonal | null) => void): { cancelar: () => void } {
  const cancelar = onSnapshot(
    doc(db!, 'sistema', 'estado_personal'),
    (snap) => cb(snap.exists() ? (snap.data() as EstadoPersonal) : null),
    () => cb(null)
  );
  return { cancelar };
}

// ── Media (on-demand) ─────────────────────────────────────

export interface MediaPersonal {
  base64: string;
  mimetype: string;
  nombreArchivo?: string;
}

const cacheMedia = new Map<string, MediaPersonal | null>();

export async function leerMediaPersonal(idMensaje: string): Promise<MediaPersonal | null> {
  if (cacheMedia.has(idMensaje)) return cacheMedia.get(idMensaje) || null;
  try {
    const snap = await getDoc(doc(db!, 'media_personal', idMensaje));
    if (!snap.exists()) {
      cacheMedia.set(idMensaje, null);
      return null;
    }
    const datos = snap.data() as Partial<MediaPersonal>;
    const media: MediaPersonal = {
      base64: String(datos.base64 || ''),
      mimetype: String(datos.mimetype || 'application/octet-stream'),
      nombreArchivo: datos.nombreArchivo,
    };
    cacheMedia.set(idMensaje, media.base64 ? media : null);
    return media.base64 ? media : null;
  } catch {
    return null;
  }
}

// ── Envíos (outbox → bot v1.3) ────────────────────────────

interface BaseEnvio {
  telefono: string;      // dígitos o jid @g.us
  jidOriginal?: string;  // jid real (LIDs)
  nombre?: string;
}

async function aOutbox(datos: BaseEnvio & Record<string, unknown>): Promise<string> {
  const ref = await addDoc(collection(db!, 'respuestas_personal'), {
    telefono: datos.telefono,
    jidOriginal: datos.jidOriginal || '',
    nombre: datos.nombre || '',
    texto: '',
    tipo: 'texto',
    processed: false,
    createdAt: new Date().toISOString(),
    creadoPor: 'panelPersonal',
    ...datos,
  });
  return ref.id;
}

/** ✍️ Texto → lo manda el bot con TU número personal. */
export async function enviarMensajePersonal(
  conv: { telefono: string; jidOriginal?: string; nombre?: string },
  texto: string
): Promise<string> {
  const t = String(texto || '').trim();
  if (!t) throw new Error('Mensaje vacío');
  return aOutbox({ telefono: conv.telefono, jidOriginal: conv.jidOriginal, nombre: conv.nombre, texto: t, tipo: 'texto' });
}

/** 🖼️ Imagen (comprimida igual que el Chat Baileys) → base64. */
export async function enviarImagenPersonal(
  conv: { telefono: string; jidOriginal?: string; nombre?: string },
  file: File,
  caption?: string
): Promise<string> {
  const { base64, mimetype } = await comprimirImagen(file);
  return aOutbox({
    telefono: conv.telefono,
    jidOriginal: conv.jidOriginal,
    nombre: conv.nombre,
    texto: caption || '📷 Imagen',
    tipo: 'imagen',
    base64,
    mimetype,
    nombreArchivo: 'imagen.jpg',
  });
}

/** 🎙️ Nota de voz (Blob del MediaRecorder) → base64 ptt. */
export async function enviarAudioPersonal(
  conv: { telefono: string; jidOriginal?: string; nombre?: string },
  blob: Blob,
  mimetype: string
): Promise<string> {
  const base64: string = await new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = String(lector.result || '');
      resolver(resultado.includes(',') ? resultado.split(',')[1] : resultado);
    };
    lector.onerror = () => rechazar(new Error('No pude leer el audio'));
    lector.readAsDataURL(blob);
  });
  return aOutbox({
    telefono: conv.telefono,
    jidOriginal: conv.jidOriginal,
    nombre: conv.nombre,
    texto: '🎙️ Nota de voz',
    tipo: 'audio',
    base64,
    mimetype: mimetype || 'audio/webm',
    nombreArchivo: 'nota-de-voz.webm',
  });
}

/** 📄 Documento (≤700 KB igual que el Chat Baileys). */
export async function enviarDocumentoPersonal(
  conv: { telefono: string; jidOriginal?: string; nombre?: string },
  file: File,
  caption?: string
): Promise<string> {
  const { base64, mimetype } = await leerDocumento(file);
  return aOutbox({
    telefono: conv.telefono,
    jidOriginal: conv.jidOriginal,
    nombre: conv.nombre,
    texto: caption || '📄 ' + file.name,
    tipo: 'documento',
    base64,
    mimetype,
    nombreArchivo: file.name,
  });
}

// ── Reintentar un pendiente fallido (reencola tal cual) ────

export async function reencolarPendientePersonal(
  p: RespuestaPendientePersonal,
  jidOriginal?: string,
  nombre?: string
): Promise<void> {
  if (p.tipo && p.tipo !== 'texto' && p.base64) {
    await addDoc(collection(db!, 'respuestas_personal'), {
      telefono: p.telefono,
      jidOriginal: jidOriginal || '',
      nombre: nombre || p.nombre || '',
      texto: p.texto,
      tipo: p.tipo,
      base64: p.base64,
      mimetype: p.mimetype || '',
      nombreArchivo: p.nombreArchivo || '',
      processed: false,
      createdAt: new Date().toISOString(),
      creadoPor: 'panelPersonal-reintento',
    });
  } else {
    await addDoc(collection(db!, 'respuestas_personal'), {
      telefono: p.telefono,
      jidOriginal: jidOriginal || '',
      nombre: nombre || p.nombre || '',
      texto: p.texto,
      tipo: 'texto',
      processed: false,
      createdAt: new Date().toISOString(),
      creadoPor: 'panelPersonal-reintento',
    });
  }
}

// ── Presencia: chat abierto / escribiendo (app → bot) ──────

/** La app avisa qué chat tenés abierto → el bot subscribe la
 *  presencia del contacto y actualiza "en línea". */
export async function abrirChatPersonal(tel: string, jidOriginal?: string): Promise<void> {
  try {
    await setDoc(
      doc(db!, 'sistema', 'estado_personal'),
      { chatAbierto: tel, chatAbiertoJid: jidOriginal || '', chatAbiertoAt: Date.now() },
      { merge: true }
    );
  } catch { /* decorativo */ }
}

/** Mientras escribís en el panel, el contacto ve "escribiendo…". */
export async function avisarEscribiendoPersonal(tel: string, jidOriginal?: string): Promise<void> {
  try {
    await setDoc(
      doc(db!, 'sistema', 'estado_personal'),
      { escribiendoEn: tel, escribiendoJid: jidOriginal || '', escribiendoAt: Date.now() },
      { merge: true }
    );
  } catch { /* decorativo */ }
}

export async function dejarDeEscribirPersonal(): Promise<void> {
  try {
    await setDoc(
      doc(db!, 'sistema', 'estado_personal'),
      { escribiendoEn: '', escribiendoJid: '', escribiendoAt: 0 },
      { merge: true }
    );
  } catch { /* decorativo */ }
}

// ── Marcar leído ───────────────────────────────────────────

export async function marcarLeidoPersonal(tel: string): Promise<number> {
  try {
    const snap = await getDocs(
      query(collection(db!, 'mensajes_personal'), where('telefono', '==', tel), where('leido', '==', false))
    );
    if (snap.empty) return 0;
    const lote = writeBatch(db!);
    snap.docs.forEach((d) => lote.update(d.ref, { leido: true }));
    await lote.commit();
    return snap.size;
  } catch {
    return 0;
  }
}

// ── Contactos: etiqueta / archivar / restringir ────────────

export async function actualizarContactoPersonal(
  tel: string,
  cambios: Partial<Pick<ContactoPersonal, 'etiqueta' | 'archivado' | 'restringido' | 'nombre'>>
): Promise<void> {
  const idDoc = String(tel).replace(/[/\\]/g, '_');
  await setDoc(doc(db!, 'contactos_personal', idDoc), { telefono: tel, ...cambios, actualizadoEn: Date.now() }, { merge: true });
}

// ── 🧹 Limpiar chat ───────────────────────────────────────

export async function borrarChatPersonal(tel: string): Promise<{ mensajes: number; media: number; salidas: number }> {
  // mensajes del chat
  const snapMsgs = await getDocs(query(collection(db!, 'mensajes_personal'), where('telefono', '==', tel)));
  let media = 0;
  const lote1 = writeBatch(db!);
  for (const d of snapMsgs.docs) {
    lote1.delete(d.ref);
    try {
      const m = await getDoc(doc(db!, 'media_personal', d.id));
      if (m.exists) media++;
    } catch { /* media opcional */ }
  }
  await lote1.commit();

  // media asociada (por id de mensaje)
  if (snapMsgs.size > 0) {
    const lote2 = writeBatch(db!);
    for (const d of snapMsgs.docs) {
      lote2.delete(doc(db!, 'media_personal', d.id));
    }
    try { await lote2.commit(); } catch { /* alguna ya borrada */ }
  }

  // respuestas ya enviadas de ese chat (las pendientes NO: van en camino)
  const snapSal = await getDocs(query(collection(db!, 'respuestas_personal'), where('telefono', '==', tel), where('processed', '==', true)));
  let salidas = 0;
  for (let i = 0; i < snapSal.docs.length; i += 450) {
    const lote = writeBatch(db!);
    snapSal.docs.slice(i, i + 450).forEach((d) => { lote.delete(d.ref); salidas++; });
    await lote.commit();
  }
  return { mensajes: snapMsgs.size, media, salidas };
}

// ── ⚡ Respuestas rápidas (manual · motor AUTO apagado 4.1) ─

export function suscribirRapidasPersonal(cb: (rapidas: RespuestaRapidaPersonal[]) => void): { cancelar: () => void } {
  const cancelar = onSnapshot(
    collection(db!, 'respuestas_rapidas_personal'),
    (snap) => {
      const lista: RespuestaRapidaPersonal[] = snap.docs.map((d) => {
        const datos = d.data() as Partial<RespuestaRapidaPersonal>;
        return {
          id: d.id,
          nombre: String(datos.nombre || ''),
          texto: String(datos.texto || ''),
          icono: datos.icono,
          atajos: datos.atajos,
          activa: datos.activa !== false,
          orden: Number(datos.orden || 0),
        };
      });
      lista.sort((a, b) => (b.orden || 0) - (a.orden || 0));
      cb(lista);
    },
    (e) => console.warn('[chatPersonal] rápidas:', e)
  );
  return { cancelar };
}

export async function guardarRapidaPersonal(rapida: Omit<RespuestaRapidaPersonal, 'id'> & { id?: string }): Promise<void> {
  if (rapida.id) {
    await updateDoc(doc(db!, 'respuestas_rapidas_personal', rapida.id), {
      nombre: rapida.nombre,
      texto: rapida.texto,
      icono: rapida.icono || '⚡',
      atajos: rapida.atajos || '',
      activa: rapida.activa !== false,
      orden: rapida.orden || 0,
      actualizadoEn: serverTimestamp(),
    });
  } else {
    await addDoc(collection(db!, 'respuestas_rapidas_personal'), {
      nombre: rapida.nombre,
      texto: rapida.texto,
      icono: rapida.icono || '⚡',
      atajos: rapida.atajos || '',
      activa: rapida.activa !== false,
      orden: Date.now(),
      creadoEn: serverTimestamp(),
    });
  }
}

export async function borrarRapidaPersonal(id: string): Promise<void> {
  await deleteDoc(doc(db!, 'respuestas_rapidas_personal', id));
}
