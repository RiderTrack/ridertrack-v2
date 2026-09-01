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
// FASE 3.3:
// + clientes_registrados.foto_perfil → FOTOS DE PERFIL reales de
//   WhatsApp (igual que la v1 — el bot las sube y actualiza)
// + notas de voz → se graban en la app, suben a Storage y el bot
//   las envía por la vía VERIFICADA de campañas (cola_envio +
//   multimedia {tipo:'audio'} → PTT), sin tocar el bot
// + Grupo MATE · Trabajo → conversación especial que reúne todo lo
//   que el bot reporta al grupo de trabajo (enviar_grupo_mate,
//   otros_temas_mate, enviar_foto_grupo_mate)
// + fijar chat / fondo del chat / borrar chat (preferencias locales)
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
  updateDoc,
  getDoc,
  getDocs,
  writeBatch,
  where,
  QuerySnapshot,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { db, storage, storageRef, uploadBytes, getDownloadURL } from '../services/firebase';
import { suscribirFotosPerfil } from '../services/fotosPerfil';

/** UID del rider dueño del bot (mismo que usa la v1 y la v2) */
export const UID_BOT = 'K8wx9X5GGOfindI1RGtIIQN3UGr1';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type OrigenMensaje = 'cliente' | 'rudy' | 'rudyAuto' | 'bot' | 'campana';
export type TipoContenido = 'texto' | 'imagen' | 'audio' | 'documento' | 'ubicacion' | 'yape_qr' | 'plin_qr';

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
  /** Fase 3.18 — estado REAL de WhatsApp del mensaje saliente:
   *  undefined/null = solo se envió al servidor · 'delivered' = entregado
   *  al teléfono · 'read' = lo leyeron (checks azules). Lo actualiza el
   *  parche estado_mensajes.js del bot con los receipts de Baileys. */
  estadoWa?: 'delivered' | 'read' | null;
  /** etiqueta de la acción del bot (avisar_entrega, solicitar_ubicacion...) */
  accionBot?: string;
  /** estado de campaña (cola_envio) */
  estadoCampana?: 'pendiente' | 'procesando' | 'enviado' | 'fallido';
  nombreCampana?: string;
  /** adjuntos */
  base64?: string;
  mimetype?: string;
  nombreArchivo?: string;
  /** nota de voz: URL en Storage para reproducirla */
  audioUrl?: string;
  /** imagen propia enviada por el chat: URL en Storage (Fase 3.7) */
  imageUrl?: string;
  /** ubicación */
  lat?: number | null;
  lng?: number | null;
  /** para poder borrar entradas de mensajes_clientes */
  borrableDocId?: string;
  nombre?: string;
  /** 🆕 F3.23 — @menciones del grupo de WhatsApp: cada una con el jid
   *  y el nombre bonito (@Lourdes en vez de @51987654321). El parche
   *  grupo_mate.js v1.1 las guarda en el doc de mensajes_clientes. */
  menciones?: { jid: string; nombre: string }[];
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
  /** foto de perfil REAL de WhatsApp (clientes_registrados.foto_perfil) */
  foto?: string;
  /** conversación especial del grupo de trabajo (MATE) */
  esGrupo?: boolean;
}

/** Clave de la conversación sintética del grupo de trabajo */
export const TEL_GRUPO_MATE = 'GRUPO_MATE';

/** Acciones del bot que van al grupo de trabajo MATE */
const TIPOS_GRUPO_MATE = [
  'enviar_grupo_mate',
  'otros_temas_mate',
  'enviar_foto_grupo_mate',
  'reporte_pago_mate',
];

function esAccionGrupoMate(tipo?: string): boolean {
  return !!tipo && TIPOS_GRUPO_MATE.includes(tipo);
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
 * Fase 3.18 — ¿es un mensaje saliente del bot (espejo en
 * mensajes_clientes)? El bot guarda AHÍ también lo que responde
 * (tus manuales y sus auto-replies) → sin este filtro tus propios
 * mensajes aparecerían DOS veces (una como tuyos con ticks y otra
 * como si el cliente te hubiera escrito).
 */
export function esEspejoSaliente(m: { tipo?: string; origen?: string }): boolean {
  return m.tipo === 'saliente' || m.origen === 'rudy';
}

/**
 * Fase 3.18 — ¿el espejo saliente corresponde a una respuesta manual
 * tuya (ya pintada desde respuestas_manuales con ticks)? Match por
 * mismo teléfono + mismo texto en una ventana de ±45s (F3.19: antes
 * ±20s — se amplía para tolerar el desfase de reloj entre el teléfono
 * del panel y el Termux donde corre el bot).
 */
export function esDuplicadoManual(
  m: { telefono?: unknown; texto?: string; timestamp?: unknown },
  manuales: { tel: string; texto: string; timestamp: number }[]
): boolean {
  const tel = telKey(m.telefono);
  const texto = String(m.texto || '').trim();
  if (!tel || !texto) return false;
  const ts = Number(m.timestamp) || 0;
  return manuales.some(
    (x) => x.tel === tel && x.texto === texto && Math.abs(x.timestamp - ts) <= 45_000
  );
}

/**
 * Fase 3.19 — Filtra ENTRANTES duplicados. El bot a veces guarda el
 * MISMO mensaje dos veces (Baileys entrega el mensaje por LID y por
 * PN casi a la vez → dos docs con el mismo texto a menos de 4 s) y
 * en el chat se veía "hola hola" pegado. Recibe los docs en orden
 * cronológico ASC y devuelve solo los únicos. En el grupo MATE la
 * clave incluye quién escribió (dos personas pueden decir "ok" a la
 * vez); en 1 a 1 la clave es teléfono + texto.
 */
export function filtrarDuplicadosEntrantes<
  T extends { telefono?: unknown; texto?: string; timestamp?: unknown; esGrupo?: unknown; nombre?: unknown }
>(docs: T[]): T[] {
  const ultimo = new Map<string, number>();
  return docs.filter((d) => {
    const tel = telKey(d.telefono);
    const texto = String(d.texto || '').trim();
    const ts = Number(d.timestamp) || 0;
    const esGrupo = d.esGrupo === true || String(d.telefono || '') === 'GRUPO_MATE';
    if (!texto) return true;
    if (!tel && !esGrupo) return true;
    const clave = esGrupo ? 'g|' + String(d.nombre || '') + '|' + texto : tel + '|' + texto;
    const previo = ultimo.get(clave);
    if (previo !== undefined && Math.abs(ts - previo) <= 4_000) return false;
    ultimo.set(clave, ts);
    return true;
  });
}

/**
 * Fase 3.18 — Ticks estilo WhatsApp (lógica pura, testeable):
 *   null        → no aplica (entrantes, auto-replies, campañas)
 *   'pendiente'  → ⏳ el bot aún no lo manda
 *   'enviado'   → ✓ llegó al servidor de WhatsApp
 *   'entregado' → ✓✓ sonó en el teléfono del cliente
 *   'leido'     → ✓✓ AZUL — lo leyeron
 * El estado delivered/read lo escribe el parche estado_mensajes.js
 * del bot en respuestas_manuales.estadoWa (receipts de Baileys).
 */
export function estadoTicks(
  enviado: boolean | null,
  estadoWa?: 'delivered' | 'read' | null
): 'pendiente' | 'enviado' | 'entregado' | 'leido' | null {
  if (enviado === null) return null;
  if (!enviado) return 'pendiente';
  if (estadoWa === 'read') return 'leido';
  if (estadoWa === 'delivered') return 'entregado';
  return 'enviado';
}

/**
 * Suscripción combinada a las fuentes de la línea de tiempo.
 * Devuelve las conversaciones ordenadas por última actividad.
 * (Incluye la conversación sintética "Grupo MATE · Trabajo" y las
 * fotos de perfil reales de clientes_registrados.foto_perfil.)
 */
export function suscribirChat(callback: ChatDataListener): SuscripcionesChat {
  const convs = new Map<string, Conversacion>();
  let silenciados = new Set<string>();
  const detallesSilencio = new Map<string, string>();
  const fotos = new Map<string, string>();
  let unsubs: Unsubscribe[] = [];

  // Conversación sintética del grupo de trabajo (siempre presente)
  const convGrupo: Conversacion = {
    tel: TEL_GRUPO_MATE,
    nombre: 'Grupo MATE · Trabajo',
    mensajes: [],
    noLeidos: 0,
    ultimoTimestamp: 0,
    ultimoMensaje: null,
    silenciado: false,
    esGrupo: true,
  };
  convs.set(TEL_GRUPO_MATE, convGrupo);

  const emitir = () => {
    // recontar no leídos + silencio + fotos
    let noLeidos = 0;
    let mensajesHoy = 0;
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    // 🐛 FIX Fase 3.18 ("tengo que salir del chat para ver si se mandó"):
    // antes se emitían los MISMOS objetos mutados en sitio → los useMemo
    // de la vista veían la misma referencia y NUNCA recalculaban la lista
    // de mensajes mientras el chat estaba abierto. Ahora cada emisión
    // entrega copias nuevas (la conversación y su array de mensajes):
    // mensajes, ticks ⏳→✓→✓✓→azul y fotos se pintan EN VIVO.
    const lista = Array.from(convs.values()).map((c) => ({ ...c, mensajes: [...c.mensajes] }));
    lista.forEach((c) => {
      c.noLeidos = c.mensajes.filter((m) => m.origen === 'cliente' && !m.leido).length;
      c.mensajes.sort((a, b) => a.timestamp - b.timestamp);
      c.ultimoMensaje = c.mensajes.length ? c.mensajes[c.mensajes.length - 1] : null;
      c.ultimoTimestamp = c.ultimoMensaje ? c.ultimoMensaje.timestamp : 0;
      c.silenciado = silenciados.has(c.tel);
      c.detalleSilencio = detallesSilencio.get(c.tel);
      if (!c.esGrupo) c.foto = fotos.get(c.tel) || undefined;
      noLeidos += c.noLeidos;
      mensajesHoy += c.mensajes.filter((m) => m.timestamp >= inicioHoy.getTime()).length;
    });

    lista.sort((a, b) => {
      // El grupo de trabajo siempre va primero (como un chat fijado)
      if (a.esGrupo) return -1;
      if (b.esGrupo) return 1;
      return b.ultimoTimestamp - a.ultimoTimestamp;
    });

    const clientes = lista.filter((c) => !c.esGrupo);
    callback(lista, {
      total: clientes.length,
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

  // ── Fase 3.19: RECONSTRUCCIÓN ATÓMICA anti-carrera ──
  // ANTES los listeners 1 (mensajes_clientes) y 2 (respuestas_manuales)
  // procesaban sus snapshots por separado y el dedupe de espejos
  // dependía de CUÁL llegara primero: en la carga inicial el listener 1
  // procesaba los espejos con manualesVivas VACÍO → TUS mensajes
  // aparecían otra vez como "Bot · respondió solo" (duplicados).
  // Ahora ambos guardan sus docs crudos y llaman a UNA sola función
  // que reconstruye TODO con los DOS datasets siempre al día — el
  // orden de llegada ya no importa.
  type DocCrudo = { id: string; data: DocumentData };
  let docsMensajesCrudos: DocCrudo[] = [];
  let docsManualesCrudos: DocCrudo[] = [];

  const reconstruirChat = () => {
    // 1) Limpiar SOLO los orígenes que reconstruimos aquí: cliente,
    //    rudyAuto y rudy de TEXTO. Las notas de voz / imágenes que
    //    pinta el listener 4 (cola_envio es_chat) se PRESERVAN —
    //    antes se borraban y volvían solo cuando la cola cambiaba
    //    (bug: las notas de voz desaparecían al mandar un manual).
    convs.forEach((c) => {
      c.mensajes = c.mensajes.filter(
        (m) =>
          m.origen !== 'cliente' &&
          m.origen !== 'rudyAuto' &&
          !(m.origen === 'rudy' && !m.audioUrl && !m.imageUrl)
      );
    });

    // 2) Tus manuales vivos (para el dedupe de espejos salientes)
    const manualesVivas: { tel: string; texto: string; timestamp: number }[] = [];
    docsManualesCrudos.forEach(({ data: m }) => {
      const tel = telKey(m.telefono);
      const texto = String(m.texto || '').trim();
      if (tel && texto) manualesVivas.push({ tel, texto, timestamp: Number(m.timestamp) || 0 });
    });

    // 3) Entrantes + espejos en orden cronológico ASC (para que el
    //    dedupe de entrantes duplicados vea primero el más antiguo)
    const ordenados = [...docsMensajesCrudos].sort(
      (a, b) => (Number(a.data.timestamp) || 0) - (Number(b.data.timestamp) || 0)
    );
    const unicos = filtrarDuplicadosEntrantes(
      ordenados.map(({ id, data }) => ({
        id,
        telefono: data.telefono,
        texto: data.texto as string | undefined,
        timestamp: data.timestamp,
        esGrupo: data.esGrupo,
        nombre: data.nombre,
        data,
      }))
    );
    unicos.forEach(({ id, data: m, telefono, texto }) => {
      // FASE 3.9 — mensajes que llegan AL GRUPO MATE (los guarda el
      // parche grupo_mate.js del bot en mensajes_clientes con
      // telefono='GRUPO_MATE'). Van a la conversación del grupo
      // como burbujas de la izquierda (con el nombre de quien escribió).
      if (String(m.telefono || '') === TEL_GRUPO_MATE || m.esGrupo === true) {
        convGrupo.mensajes.push({
          id: 'mc_' + id,
          tel: TEL_GRUPO_MATE,
          origen: 'cliente',
          tipoContenido: (m.tipoContenido as TipoContenido) || 'texto',
          texto: m.texto || '',
          timestamp: Number(m.timestamp) || 0,
          leido: !!m.leido,
          enviado: null,
          nombre: m.nombre || 'Grupo',
          // 🆕 F3.23 — @arrobas del grupo (píldoras azules en el chat)
          ...(Array.isArray(m.menciones) && m.menciones.length
            ? { menciones: m.menciones.slice(0, 20).map((x: any) => ({ jid: String(x.jid || ''), nombre: String(x.nombre || '').trim() || 'Miembro' })).filter((x: any) => x.jid) }
            : {}),
        });
        return;
      }
      const tel = telKey(telefono);
      if (!tel) return;
      void texto;

      // ── Fase 3.18: espejo SALIENTE del bot en mensajes_clientes ──
      if (esEspejoSaliente(m)) {
        // ¿Es el espejo de una respuesta manual tuya? → ya está
        // pintada (con ticks) desde respuestas_manuales: saltar.
        if (esDuplicadoManual(m, manualesVivas)) return;
        // Es un AUTO-REPLY del bot (IA / plantillas): burbuja tuya,
        // del lado derecho como en WhatsApp.
        const convAuto = asegurarConv(tel, m.nombre);
        convAuto.mensajes.push({
          id: 'mc_' + id,
          tel,
          origen: 'rudyAuto',
          tipoContenido: (m.tipoContenido as TipoContenido) || 'texto',
          texto: m.texto || '',
          timestamp: Number(m.timestamp) || 0,
          leido: true,
          enviado: null,
          nombre: 'Bot',
        });
        return;
      }

      const conv = asegurarConv(tel, m.nombre);
      conv.mensajes.push({
        id: 'mc_' + id,
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
        borrableDocId: id,
        nombre: m.nombre,
      });
    });

    // 4) Tus manuales con ticks ⏳→✓→✓✓→azul
    docsManualesCrudos.forEach(({ id, data: m }) => {
      const tel = telKey(m.telefono);
      if (!tel) return;
      const conv = asegurarConv(tel, m.nombre);
      conv.mensajes.push({
        id: 'rm_' + id,
        tel,
        origen: 'rudy',
        tipoContenido: (m.tipoContenido as TipoContenido) || 'texto',
        texto: m.texto || '',
        timestamp: Number(m.timestamp) || 0,
        leido: true,
        enviado: !!m.enviado,
        // Fase 3.18 — estado real de WhatsApp (checks azules): lo
        // escribe el parche estado_mensajes.js del bot con los
        // receipts de Baileys (delivered = ✓✓ gris, read = ✓✓ azul).
        estadoWa: m.estadoWa === 'delivered' || m.estadoWa === 'read' ? m.estadoWa : null,
        base64: m.base64 || undefined,
        mimetype: m.mimetype || undefined,
        nombreArchivo: m.nombreArchivo || undefined,
        nombre: m.nombre,
      });
    });

    // 5) Conversaciones que quedaron vacías (sin mensajes NINGUNO de
    //    ninguna fuente y sin historia) se limpian — las que tienen
    //    acciones del bot o audios de la cola siguen vivas.
    convs.forEach((c) => {
      if (c.esGrupo) return; // el grupo de trabajo siempre vive
      if (c.mensajes.length === 0 && c.ultimoTimestamp === 0) convs.delete(c.tel);
    });
    emitir();
  };

  // 1. Entrantes del cliente (+ espejos salientes del bot)
  unsubs.push(
    onSnapshot(
      query(collection(db!, 'mensajes_clientes'), orderBy('timestamp', 'desc'), limit(300)),
      (snap: QuerySnapshot<DocumentData>) => {
        docsMensajesCrudos = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        reconstruirChat();
      },
      ignorar
    )
  );

  // 2. Salientes manuales (outbox → el bot los manda y marca enviado)
  unsubs.push(
    onSnapshot(
      query(collection(db!, 'respuestas_manuales'), orderBy('timestamp', 'desc'), limit(120)),
      (snap: QuerySnapshot<DocumentData>) => {
        docsManualesCrudos = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        reconstruirChat();
      },
      ignorar
    )
  );

  // 3. Acciones del bot (avisos, ubicación, yape, broadcast inicio)
  //    Las acciones dirigidas al GRUPO MATE van a la conversación
  //    sintética del grupo (como WhatsApp: el mensaje vive en el grupo).
  //    FASE 3.9: ya NO se borran los demás mensajes del grupo — solo
  //    las burbujas 'bot' (los entrantes 'cliente' los reconstruye el
  //    listener 1 y deben sobrevivir a este snapshot).
  unsubs.push(
    onSnapshot(
      query(collection(db!, 'acciones_bot', UID_BOT, 'pendientes'), orderBy('createdAt', 'desc'), limit(80)),
      (snap: QuerySnapshot<DocumentData>) => {
        convs.forEach((c) => {
          c.mensajes = c.mensajes.filter((m) => m.origen !== 'bot');
        });
        convGrupo.mensajes = convGrupo.mensajes.filter((m) => m.origen !== 'bot');
        snap.forEach((d) => {
          const m = d.data();
          const ts = m.createdAt ? Date.parse(m.createdAt) : 0;

          // → Grupo de trabajo MATE
          if (esAccionGrupoMate(m.tipo as string)) {
            convGrupo.mensajes.push({
              id: 'ab_' + d.id,
              tel: TEL_GRUPO_MATE,
              origen: 'bot',
              tipoContenido: 'texto',
              texto: String(m.texto || m.mensaje || etiquetaAccionBot(m.tipo as string)),
              timestamp: ts || (m.processedAt ? Date.parse(m.processedAt) : 0),
              leido: true,
              enviado: m.processed === undefined ? null : !!m.processed,
              accionBot: m.tipo,
              nombre: m.nombre || 'Rudy',
            });
            return;
          }

          const tel = telKey(m.telefono);
          if (!tel) return;
          const conv = asegurarConv(tel, m.nombre);
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
  //    Los docs es_chat=true son envíos TUYOS del chat (Fase 3.3 notas de
  //    voz, Fase 3.7 imágenes): se renderizan como mensaje tuyo con
  //    audio/imagen, no como campaña.
  unsubs.push(
    onSnapshot(
      query(collection(db!, 'cola_envio'), limit(80)),
      (snap: QuerySnapshot<DocumentData>) => {
        convs.forEach((c) => {
          c.mensajes = c.mensajes.filter((m) => m.origen !== 'campana' && !(m.origen === 'rudy' && m.audioUrl) && !(m.origen === 'rudy' && m.imageUrl));
        });
        snap.forEach((d) => {
          const m = d.data();
          const tel = telKey(m.celular);
          if (!tel) return;
          const ts = m.enviado_en
            ? Date.parse(m.enviado_en)
            : m.procesado_en
              ? Date.parse(m.procesado_en)
              : m.creada_en
                ? Date.parse(m.creada_en)
                : 0;

          // 🖼️ Imagen del chat (Fase 3.7) — Gracias con imagen, etc.
          // Vía VERIFICADA: cola_envio + multimedia {tipo:'imagen'} + es_chat
          // → el bot la descarga de Storage y la manda con caption
          // (campanas_bot.js). Las imágenes de CAMPAÑAS (sin es_chat) siguen
          // su camino normal de campaña más abajo.
          if (m.es_chat === true && m.multimedia?.tipo === 'imagen' && (m.imagen_url || m.multimedia?.url)) {
            const conv = asegurarConv(tel, m.nombre);
            conv.mensajes.push({
              id: 'ce_' + d.id,
              tel,
              origen: 'rudy',
              tipoContenido: 'imagen',
              texto: m.mensaje || '📷 Imagen',
              timestamp: ts,
              leido: true,
              enviado: m.status === 'enviado',
              imageUrl: m.imagen_url || m.multimedia?.url,
              nombre: m.nombre,
            });
            return;
          }

          // Nota de voz del chat (enviada por esta app)
          if (m.es_chat === true) {
            const conv = asegurarConv(tel, m.nombre);
            conv.mensajes.push({
              id: 'ce_' + d.id,
              tel,
              origen: 'rudy',
              tipoContenido: 'audio',
              texto: '🎙️ Nota de voz',
              timestamp: ts,
              leido: true,
              enviado: m.status === 'enviado',
              audioUrl: m.audio_url || m.multimedia?.url,
              mimetype: 'audio/webm',
              nombreArchivo: m.multimedia?.nombre || 'nota_de_voz.webm',
              nombre: m.nombre,
            });
            return;
          }

          const conv = asegurarConv(tel, m.nombre);
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

  // 6. FOTOS DE PERFIL reales de WhatsApp (F3.19: se reutiliza el
  //    SINGLETON de services/fotosPerfil — antes este listener hacía
  //    su PROPIA suscripción a clientes_registrados y bajaba los mismos
  //    docs dos veces. El singleton además prefiere foto_perfil_data
  //    (base64 permanente que escribe el bot) sobre foto_perfil (URL
  //    de WhatsApp que expira en horas).
  unsubs.push(
    suscribirFotosPerfil((mapaFotos) => {
      fotos.clear();
      mapaFotos.forEach((url, tel) => fotos.set(tel, url));
      emitir();
    })
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
    case 'enviar_plin': return '💚 QR de Plin enviado';
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

/** 💚 Enviar QR de Plin (fase 3.20 — igual que el Yape: el bot saca el
 *  QR y el titular de ruta_activa.plin y lo manda con su plantilla).
 *  Requiere el parche extras_chat.js v1.0 en el bot. */
export async function enviarPlinQRChat(tel: string, nombre: string): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  await addDoc(collection(db!, 'respuestas_manuales'), {
    telefono: t9,
    nombre: nombre || 'Cliente',
    texto: '📲 QR de Plin',
    tipoContenido: 'plin_qr',
    enviado: false,
    timestamp: Date.now(),
    creadoPor: 'clienteTrack',
    jidOriginal: '',
    uid: UID_BOT,
  });
}

// ═══════════════════════════════════════════════════════════
// ✍️ PRESENCIA «escribiendo…» (fase 3.20)
// ═══════════════════════════════════════════════════════════
// Flujo (con el parche extras_chat.js instalado en el bot):
//   1. Al abrir un chat, el panel deja el teléfono observado en
//      presencia_watch/{UID_BOT} (el bot se suscribe a la
//      presencia de WhatsApp de ese número).
//   2. Cuando el cliente escribe, Baileys emite «presence.update»
//      y el bot lo guarda en presencia_chat/{tel}:
//        { estado: 'composing' | 'paused', actualizadoEn: ISO }
//   3. El panel escucha ese doc y muestra «escribiendo…».

export interface PresenciaChat {
  estado?: string;        // 'composing' | 'paused' | 'available'
  actualizadoEn?: string; // ISO
}

/** ¿La presencia dice que está escribiendo AHORA? (pura — testeable) */
export function presenciaViva(p: PresenciaChat | null | undefined, ahora: number = Date.now()): boolean {
  if (!p || p.estado !== 'composing') return false;
  const ts = Date.parse(p.actualizadoEn || '');
  if (!ts || isNaN(ts)) return false;
  return ahora - ts < 30_000; // 30 s de vida (margen generoso)
}

/** Dejar en Firestore el chat que estás viendo (para que el bot
 *  vigile si ese cliente empieza a escribir). */
export async function observarPresenciaChat(tel: string): Promise<void> {
  const t9 = telKey(tel);
  if (!t9 || !db) return;
  try {
    await setDoc(doc(db, 'presencia_watch', UID_BOT), {
      telefono: t9,
      actualizadoEn: new Date().toISOString(),
    }, { merge: true });
  } catch {
    // optimista: si no hay red, no hay «escribiendo…» y nada más pasa
  }
}

/** Escuchar la presencia del chat activo (escribiendo… / pausó). */
export function suscribirPresenciaChat(
  tel: string,
  cb: (p: PresenciaChat | null) => void
): () => void {
  const t9 = telKey(tel);
  if (!t9 || !db) {
    cb(null);
    return () => undefined;
  }
  try {
    const unsub = onSnapshot(
      doc(db, 'presencia_chat', t9),
      (snap) => cb(snap.exists() ? (snap.data() as PresenciaChat) : null),
      () => cb(null)
    );
    return unsub;
  } catch {
    cb(null);
    return () => undefined;
  }
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

// ═══════════════════════════════════════════════════════════
// FASE 3.3 — GRUPO DE TRABAJO MATE
// ═══════════════════════════════════════════════════════════

/** JID del grupo de trabajo MATE (el MISMO que usaba la v1) */
export const GRUPO_MATE_JID = '120363128461377751@g.us';

/**
 * ✍️ Escribir al grupo de trabajo MATE desde el chat.
 * Usa la acción 'enviar_grupo_mate' que el bot YA conoce.
 *
 * FASE 3.8 — FIX MENSAJES QUE NO LLEGABAN AL GRUPO:
 * el payload de la v1 (botOtrosMATEEnviar / botEmpresaEnviarMATE)
 * SIEMPRE incluía `grupoId` (el JID del grupo) y `estado`; la v2
 * no los mandaba y el bot marcaba el doc como procesado SIN
 * enviar nada a WhatsApp (verificado en Firestore: los "Hola" de
 * prueba quedaron processed=true pero nunca llegaron al grupo).
 * Ahora el payload es IDÉNTICO al de la v1.
 */
export async function enviarAGrupoMate(texto: string, rider?: RiderInfo): Promise<void> {
  const t = texto.trim();
  if (!t) throw new Error('Escribe un mensaje para el grupo');
  await addDoc(collection(db!, 'acciones_bot', UID_BOT, 'pendientes'), {
    tipo: 'enviar_grupo_mate',
    clienteId: 'grupo_mate',
    telefono: '',
    nombre: 'Grupo MATE',
    texto: t,
    grupoId: GRUPO_MATE_JID,
    estado: 'otros',
    ...(rider ? { rider } : {}),
    createdAt: new Date().toISOString(),
    processed: false,
  });
}

// ═══════════════════════════════════════════════════════════
// FASE 3.9 — RÁPIDOS CON LAS PLANTILLAS DEL ROBOT
// (voy en camino / mi posición — con imagen, como la v1)
// ═══════════════════════════════════════════════════════════

/** Posición de un cliente dentro de la ruta activa (cálculo v1) */
export interface PosicionRuta {
  miPosicion: number;
  totalRuta: number;
  entregados: number;
  faltanAntes: number;
}

/**
 * Calcula la posición de un cliente en la ruta activa con la MISMA
 * lógica de la v1 (botAvisarPosicion): "abierto" = sin estado o
 * 'pendiente'; los demás cuentan como entregados. Devuelve null si
 * el cliente no está en la ruta de hoy.
 */
export async function calcularPosicionRuta(t9: string): Promise<PosicionRuta | null> {
  try {
    const snap = await getDoc(doc(db!, 'ruta_activa', UID_BOT));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    const lista: any[] = Array.isArray(data.clientes) ? data.clientes : [];
    const idx = lista.findIndex((x) => telKey(x.cel) === t9);
    if (idx === -1) return null;
    const abierto = (x: any) => !x.st || x.st === 'pendiente';
    return {
      miPosicion: idx + 1,
      totalRuta: lista.length,
      entregados: lista.filter((x) => !abierto(x)).length,
      faltanAntes: lista.filter((x, i) => i < idx && abierto(x)).length,
    };
  } catch {
    return null;
  }
}

/**
 * 🚀 VOY EN CAMINO — plantilla del ROBOT con imagen.
 *
 * FASE 3.9: antes esto salía como texto plano tuyo (respuestas_manuales);
 * el usuario pidió que use la MISMA plantilla del robot (la del botón 🤖
 * de cada cliente en la v1) con su imagen llegando_pronto.jpg. Copia
 * EXACTA del payload v1 (botAvisarSiguiente): acción `avisar_siguiente`
 * con minutos + datos del cliente de la ruta activa. También actualiza
 * clienteActualIdx en ruta_activa (como la v1) para que el bot sepa
 * quién es tu cliente actual.
 */
export async function avisarSiguienteBot(
  tel: string,
  nombre: string,
  minutos: number,
  rider?: RiderInfo
): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  const datos = await buscarClienteEnRuta(t9);

  // La v1 también apuntaba al cliente actual en ruta_activa (merge)
  try {
    const snap = await getDoc(doc(db!, 'ruta_activa', UID_BOT));
    if (snap.exists()) {
      const lista: any[] = Array.isArray(snap.data()?.clientes) ? snap.data().clientes : [];
      const idx = lista.findIndex((x) => telKey(x.cel) === t9);
      if (idx !== -1) {
        await updateDoc(doc(db!, 'ruta_activa', UID_BOT), {
          clienteActualIdx: idx,
          clienteActualId: lista[idx]?.id ?? '',
          actualizadaAt: new Date().toISOString(),
        });
      }
    }
  } catch { /* no bloquear el envío si falla el puntero */ }

  await addDoc(collection(db!, 'acciones_bot', UID_BOT, 'pendientes'), {
    tipo: 'avisar_siguiente',
    clienteId: 'chat_' + t9,
    telefono: telCompleto(t9),
    nombre: nombre || 'Cliente',
    prod: datos.prod || '',
    cobrar: datos.cobrar || 0,
    dir: datos.dir || '',
    dist: datos.dist || '',
    minutos: Math.max(1, parseInt(String(minutos), 10) || 15),
    ...(rider ? { rider } : {}),
    createdAt: new Date().toISOString(),
    processed: false,
  });
}

/**
 * ⏰ MI POSICIÓN DE HOY — plantilla del ROBOT con imagen.
 *
 * FASE 3.9: copia EXACTA del payload v1 (botAvisarPosicion): acción
 * `avisar_posicion` con miPosicion / totalRuta / entregados /
 * faltanAntes. Si el cliente está en la ruta de hoy se calcula solo;
 * si no (o si pasas `forzarPos`), se usa el número que editó el rider.
 */
export async function avisarPosicionBot(
  tel: string,
  nombre: string,
  forzarPos: number | null,
  rider?: RiderInfo
): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  const datos = await buscarClienteEnRuta(t9);
  const pos = await calcularPosicionRuta(t9);
  const miPosicion = pos ? pos.miPosicion : Math.max(1, parseInt(String(forzarPos), 10) || 1);

  await addDoc(collection(db!, 'acciones_bot', UID_BOT, 'pendientes'), {
    tipo: 'avisar_posicion',
    clienteId: 'chat_' + t9,
    telefono: telCompleto(t9),
    nombre: nombre || 'Cliente',
    prod: datos.prod || '',
    cobrar: datos.cobrar || 0,
    dir: datos.dir || '',
    dist: datos.dist || '',
    miPosicion,
    totalRuta: pos ? pos.totalRuta : 0,
    entregados: pos ? pos.entregados : 0,
    faltanAntes: pos ? pos.faltanAntes : 0,
    ...(rider ? { rider } : {}),
    createdAt: new Date().toISOString(),
    processed: false,
  });
}

// ═══════════════════════════════════════════════════════════
// FASE 3.22 — FICHA DEL CLIENTE EN EL CHAT (en vivo)
// Posición en la ruta + dirección + producto + monto, sin salir
// de la conversación. Una SOLA suscripción a ruta_activa sirve
// para toda la lista de chats y para la ficha del chat abierto.
// ═══════════════════════════════════════════════════════════

/** Info de un cliente dentro de la ruta activa (para el chat) */
export interface InfoClienteRuta {
  /** posición 1-based dentro del orden de la ruta */
  posicion: number;
  /** total de clientes en la ruta de hoy */
  total: number;
  /** entregados/pagados hasta ahora */
  entregados: number;
  /** entregas pendientes ANTES de llegar a él */
  faltanAntes: number;
  /** estado bruto (st) — ''|pendiente|efectivo|yape-rudy|...|fallida */
  estado: string;
  /** estado bonito para pintar (⏳ Pendiente / 💵 Efectivo...) */
  estadoTexto: string;
  dir: string;
  dist: string;
  prod: string;
  cobrar: number;
  nombreRuta: string;
}

/** Estados que cuentan como PAGADO/entregado (mismo criterio que RutaView) */
const ST_PAGADOS = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio', 'entregado'];
/** Estados fallidos (borde rojo en RutaView) */
const ST_FALLIDOS = ['fallida', 'fallido', 'rechazado', 'cancelado', 'no_contesta', 'ausente', 'devolucion'];
/** Traducción corta de los estados conocidos */
const ST_TEXTO: Record<string, string> = {
  pendiente: '⏳ Pendiente',
  entregado: '✅ Entregado',
  efectivo: '💵 Efectivo',
  'yape-rudy': '💰 Yape (a mí)',
  'yape-efectivo': '💰 Yape+Efectivo',
  'yape-plin': '💚 Yape/Plin',
  mixto: '🔀 Mixto',
  pos: '💳 POS',
  transferencia: '🏦 Transferencia',
  'pago-link': '🔗 Pago Link',
  'jose-smith': '👤 José Smith',
  empresa: '🏢 Empresa',
  cambio: '🔄 Cambio',
  reprogramar: '🔁 Reprogramar',
  fallida: '❌ Fallida',
  fallido: '❌ Fallida',
  rechazado: '❌ Rechazado',
  cancelado: '🚫 Cancelado',
  no_contesta: '📵 No contesta',
  ausente: '🚪 Ausente',
  devolucion: '↩️ Devolución',
};

/** Normaliza el estado de un cliente de la ruta */
function stNormal(st: unknown): string {
  const s = String(st ?? '').trim();
  return !s || s === 'pendiente' ? 'pendiente' : s;
}

/** ¿El cliente está pagado/entregado? */
export function stEsPagado(st: string): boolean {
  return ST_PAGADOS.includes(st);
}

/** Color base del estado (para la ficha y la insignia de la lista) */
export function stColorRuta(st: string): 'pendiente' | 'pagado' | 'fallido' | 'otro' {
  if (!st || st === 'pendiente') return 'pendiente';
  if (ST_PAGADOS.includes(st)) return 'pagado';
  if (ST_FALLIDOS.includes(st)) return 'fallido';
  return 'otro';
}

/** Texto bonito del estado */
export function stTextoRuta(st: string): string {
  return ST_TEXTO[st] || st;
}

/**
 * Suscripción EN VIVO a toda la ruta activa → mapa t9 → InfoClienteRuta.
 * UNA sola suscripción alimenta la insignia de cada conversación de la
 * lista y la ficha del chat abierto. Se actualiza sola cuando marcas
 * entregado/pagado desde RutaView (mismo doc ruta_activa).
 */
export function suscribirRutaClientes(
  cb: (mapa: Map<string, InfoClienteRuta>, nombreRuta: string) => void
): Unsubscribe {
  return onSnapshot(
    doc(db!, 'ruta_activa', UID_BOT),
    (snap) => {
      const mapa = new Map<string, InfoClienteRuta>();
      if (!snap.exists()) {
        cb(mapa, '');
        return;
      }
      const data = snap.data() || ({} as DocumentData);
      const lista: any[] = Array.isArray(data.clientes) ? data.clientes : [];
      const nombreRuta = String(data.nombre || data.titulo || '');
      const abierto = (x: any) => {
        const s = stNormal(x.st);
        return s === 'pendiente' || s === 'reprogramar';
      };
      const entregados = lista.filter((x) => !abierto(x)).length;
      lista.forEach((x, idx) => {
        const t9 = telKey(x.cel);
        if (!t9) return;
        const st = stNormal(x.st);
        mapa.set(t9, {
          posicion: idx + 1,
          total: lista.length,
          entregados,
          faltanAntes: lista.filter((y, i) => i < idx && abierto(y)).length,
          estado: st,
          estadoTexto: stTextoRuta(st),
          dir: String(x.dir || ''),
          dist: String(x.dist || ''),
          prod: String(x.prod || ''),
          cobrar: parseFloat(String(x.cobrar || 0)) || 0,
          nombreRuta,
        });
      });
      cb(mapa, nombreRuta);
    },
    () => {
      /* sin ruta activa o sin permiso → lista vacía, el chat queda igual */
      cb(new Map(), '');
    }
  );
}

// ═══════════════════════════════════════════════════════════
// FASE 3.9 — GALERÍA: FOTO + MENSAJITO POR EL BOT
// (elige destino: cliente directo o grupo MATE)
// ═══════════════════════════════════════════════════════════

/**
 * 📲 Enviar una foto de la galería AL CLIENTE por WhatsApp.
 * Vía VERIFICADA (campanas_bot.js): doc en cola_envio con multimedia
 * {tipo:'imagen'} — el bot descarga la foto de Storage y la manda
 * como IMAGEN con el mensajito de caption. La foto ya está en Storage
 * (la subió el flujo de entrega), así que NO hay subida ni CORS.
 */
export async function enviarFotoGaleriaCliente(
  tel: string,
  nombre: string,
  fotoUrl: string,
  mensajito: string
): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  if (!fotoUrl) throw new Error('La foto no tiene URL');
  await setDoc(doc(db!, 'cola_envio', `${telCompleto(t9)}_galeria_${Date.now()}`), {
    celular: telCompleto(t9),
    nombre: nombre || 'Cliente',
    mensaje: mensajito,
    multimedia: { tipo: 'imagen', url: fotoUrl, nombre: 'entrega.jpg' },
    imagen_url: fotoUrl,
    es_chat: true,
    velocidad: 8,
    status: 'pendiente',
    creada_en: new Date().toISOString(),
    intentos: 0,
  });
}

/** Datos de la foto de entrega que viajan al grupo MATE (como la v1) */
export interface DatosFotoGaleria {
  nombre: string;
  prod?: string;
  cobrar?: number;
  dir?: string;
  distrito?: string;
}

/**
 * 📤 Enviar una foto de la galería AL GRUPO MATE.
 * Acción `enviar_foto_grupo_mate` — la MISMA que usaba la v1 en
 * "Reportar pago con foto", con la diferencia de que la imagen viaja
 * por URL (imagenUrl) en vez de base64: el parche grupo_mate.js del
 * bot la descarga desde el servidor (sin límite de 1MB por doc ni
 * CORS del WebView). El payload mantiene los campos v1 (distrito,
 * titulo, comentario, tipoFoto, tipoLabel, grupoId) para que el
 * parche también sirva si el bot viejo volviera a levantarlo.
 */
export async function enviarFotoGaleriaGrupo(
  foto: DatosFotoGaleria,
  fotoUrl: string,
  titulo: string,
  comentario: string,
  rider?: RiderInfo
): Promise<void> {
  if (!fotoUrl) throw new Error('La foto no tiene URL');
  const tituloFinal = (titulo || '').trim() || 'VERIFICACIÓN DE ENTREGA';
  await addDoc(collection(db!, 'acciones_bot', UID_BOT, 'pendientes'), {
    tipo: 'enviar_foto_grupo_mate',
    clienteId: 'galeria',
    nombre: foto.nombre || '',
    prod: foto.prod || '',
    cobrar: foto.cobrar || 0,
    dir: foto.dir || '',
    distrito: foto.distrito || '',
    imagenBase64: '',
    imagenUrl: fotoUrl,
    titulo: tituloFinal,
    comentario: (comentario || '').trim(),
    tipoFoto: 'entregado',
    tipoLabel: 'Verificación de entrega',
    grupoId: GRUPO_MATE_JID,
    // para la burbuja del chat del grupo:
    texto: `${tituloFinal}\n${(comentario || '').trim()}`.trim(),
    ...(rider ? { rider } : {}),
    createdAt: new Date().toISOString(),
    processed: false,
  });
}

// ═══════════════════════════════════════════════════════════
// FASE 3.9 — ESTADO DEL GRUPO (heartbeat del parche del bot)
// ═══════════════════════════════════════════════════════════

/** Estado que el parche grupo_mate.js escribe en sistema/estado_grupo */
export interface EstadoGrupo {
  ok: boolean;
  jid?: string;
  nombre?: string;
  participantes?: number;
  ts?: number;
  version?: string;
  error?: string;
  /** 🆕 F3.23 — miembros del grupo [{jid, nombre}] para los @arrobas */
  miembros?: { jid: string; nombre: string }[];
}

/** El estado se considera vivo si el bot latió hace menos de 15 min */
export function estadoGrupoVivo(e: EstadoGrupo | null): boolean {
  if (!e || !e.ok) return false;
  const ts = Number(e.ts) || 0;
  return ts > 0 && Date.now() - ts < 15 * 60 * 1000;
}

/** Suscripción en vivo al estado del grupo (null = sin parche aún) */
export function suscribirEstadoGrupo(cb: (e: EstadoGrupo | null) => void): () => void {
  try {
    return onSnapshot(
      doc(db!, 'sistema', 'estado_grupo'),
      (snap) => {
        if (!snap.exists()) return cb(null);
        const d = snap.data() || {};
        cb({
          ok: !!d.ok,
          jid: d.jid || '',
          nombre: d.nombre || '',
          participantes: Number(d.participantes) || 0,
          ts: Number(d.ts) || 0,
          version: d.version || '',
          error: d.error || '',
          miembros: Array.isArray(d.miembros)
            ? d.miembros
                .filter((x: any) => x && x.jid)
                .slice(0, 60)
                .map((x: any) => ({ jid: String(x.jid), nombre: String(x.nombre || '').trim() || 'Miembro' }))
            : undefined,
        });
      },
      () => cb(null)
    );
  } catch {
    cb(null);
    return () => undefined;
  }
}

/** Datos del cliente que viajan en la acción avisar_entrega (como la v1) */
export interface DatosClienteGracias {
  prod?: string;
  cobrar?: number;
  dir?: string;
  dist?: string;
  st?: string;
}

/** El mensaje que el bot manda con la tarjeta (idéntico al preview del Control de la v1) */
export const MENSAJE_GRACIAS_BOT =
  '✅ ¡Pedido entregado!\n\nGracias por confiar en MATE Pharmacy 🙏\n\n¿Tienes alguna consulta o reclamo?\n📱 WhatsApp: 956 203 893 (Fabiana)\n📞 Llamadas: 956 203 893\n\n¡Estamos para ayudarte! 😊';

/**
 * Busca los datos del cliente (prod, cobrar, dir, dist) en la ruta
 * activa para que la acción avisar_entrega lleve la misma info que
 * cuando se manda desde el Control de la v1. Si no lo encuentra
 * (cliente que no está en la ruta de hoy) devuelve vacíos — el bot
 * los tolera porque la v1 también mandaba '' cuando faltaban.
 */
async function buscarClienteEnRuta(t9: string): Promise<DatosClienteGracias> {
  try {
    const snap = await getDoc(doc(db!, 'ruta_activa', UID_BOT));
    if (!snap.exists()) return {};
    const data = snap.data() || {};
    const lista: any[] = Array.isArray(data.clientes) ? data.clientes : [];
    const c = lista.find((x) => telKey(x.cel) === t9);
    if (!c) return {};
    return {
      prod: String(c.prod || ''),
      cobrar: parseFloat(String(c.cobrar || 0)) || 0,
      dir: String(c.dir || ''),
      dist: String(c.dist || ''),
      st: String(c.st || ''),
    };
  } catch {
    return {};
  }
}

/**
 * 🙏 GRACIAS POR TU COMPRA — por la VÍA DEL ROBOT.
 *
 * FASE 3.8: la app ya NO manda su propia imagen embebida (llegaba
 * el logo equivocado — los archivos de imagenes_bot están
 * intercambiados). Copia EXACTA del Control de la v1
 * (controlAvisarEntrega): acción `avisar_entrega` con
 * enviar_imagen / modo_entrega → el bot manda SU tarjeta real
 * (mate_gracias) + el mensajito con el contacto de Fabiana.
 * `conImagen: false` = la opción "Solo texto" de la v1.
 */
export async function enviarGraciasBot(
  tel: string,
  nombre: string,
  conImagen: boolean,
  rider?: RiderInfo
): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  const datos = await buscarClienteEnRuta(t9);
  await addDoc(collection(db!, 'acciones_bot', UID_BOT, 'pendientes'), {
    tipo: 'avisar_entrega',
    clienteId: 'chat_' + t9,
    telefono: telCompleto(t9),
    nombre: nombre || 'Cliente',
    prod: datos.prod || '',
    cobrar: datos.cobrar || 0,
    dir: datos.dir || '',
    dist: datos.dist || '',
    st: datos.st || 'entregado',
    modo_entrega: conImagen ? 'auto_imagen' : 'auto_texto',
    enviar_imagen: conImagen,
    ...(rider ? { rider } : {}),
    createdAt: new Date().toISOString(),
    processed: false,
  });
}

// ═══════════════════════════════════════════════════════════
// FASE 3.3 — NOTAS DE VOZ (grabar → Storage → bot → WhatsApp)
// ═══════════════════════════════════════════════════════════

/** Tipos MIME de grabación soportados (el primero que el device soporte) */
function mimeTypeGrabacion(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const opciones = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return opciones.find((t) => MediaRecorder.isTypeSupported(t)) || null;
}

export interface Grabacion {
  blob: Blob;
  mimetype: string;
  duracionSeg: number;
}

/**
 * Inicia la grabación de una nota de voz.
 * Devuelve { parar, cancelar } — parar() resuelve con la grabación,
 * cancelar() descarta todo y libera el micrófono.
 */
export async function iniciarGrabacionAudio(): Promise<{
  parar: () => Promise<Grabacion>;
  cancelar: () => void;
}> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este dispositivo no soporta grabación de audio');
  }
  const mime = mimeTypeGrabacion();
  if (!mime) throw new Error('Formato de audio no soportado en este equipo');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const pedazos: Blob[] = [];
  const inicio = Date.now();

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) pedazos.push(e.data);
  };

  const liberar = () => stream.getTracks().forEach((t) => t.stop());
  recorder.start(250);

  return {
    parar: () =>
      new Promise<Grabacion>((resolve) => {
        recorder.onstop = () => {
          liberar();
          resolve({
            blob: new Blob(pedazos, { type: mime }),
            mimetype: mime,
            duracionSeg: Math.max(1, Math.round((Date.now() - inicio) / 1000)),
          });
        };
        try {
          recorder.stop();
        } catch {
          liberar();
          resolve({ blob: new Blob(pedazos, { type: mime }), mimetype: mime, duracionSeg: 1 });
        }
      }),
    cancelar: () => {
      try {
        recorder.onstop = null;
        recorder.stop();
      } catch { /* noop */ }
      liberar();
    },
  };
}

/**
 * Sube la nota de voz a Firebase Storage y devuelve la URL.
 * Ruta: campanas/chat_audios/{uid}/{tel}_{ts}.webm (misma familia que
 * usaba la v1 para las campañas — reglas de Storage ya la permiten).
 */
async function subirAudioStorage(uid: string, tel: string, grab: Grabacion): Promise<string> {
  if (!storage) throw new Error('Storage no disponible');
  const ext = grab.mimetype.includes('mp4') ? 'm4a' : grab.mimetype.includes('ogg') ? 'ogg' : 'webm';
  const ruta = `campanas/chat_audios/${uid}/${tel}_${Date.now()}.${ext}`;
  const ref = storageRef(storage, ruta);
  await uploadBytes(ref, grab.blob, {
    contentType: grab.mimetype,
    customMetadata: { uid, tel, tipo: 'nota_voz_chat' },
  });
  return getDownloadURL(ref);
}

/**
 * 🎙️ Enviar nota de voz por el chat.
 * Vía VERIFICADA del bot (campanas_bot.js): doc en cola_envio con
 * multimedia {tipo:'audio'} → el bot lo manda como nota de voz PTT.
 * Sin campaign_id → el bot no toca stats de campañas y borra el doc
 * al terminar. También queda en el historial local del teléfono.
 */
export async function enviarAudioNotaChat(
  uid: string,
  tel: string,
  nombre: string,
  grab: Grabacion
): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  const url = await subirAudioStorage(uid, t9, grab);
  const nombreArchivo = `nota_de_voz_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.${url.includes('.m4a') ? 'm4a' : 'webm'}`;

  await setDoc(doc(db!, 'cola_envio', `${telCompleto(t9)}_chat_${Date.now()}`), {
    celular: telCompleto(t9),
    nombre: nombre || 'Cliente',
    mensaje: '',
    multimedia: { tipo: 'audio', url, nombre: nombreArchivo },
    audio_url: url,
    es_chat: true,
    velocidad: 8,
    status: 'pendiente',
    creada_en: new Date().toISOString(),
    intentos: 0,
  });

  registrarAudioLocal({ tel: t9, ts: Date.now(), url, seg: grab.duracionSeg });
}

// ═══════════════════════════════════════════════════════════
// FASE 3.7 — IMÁGENES RÁPIDAS POR EL CHAT (Gracias con imagen)
// ═══════════════════════════════════════════════════════════

/**
 * 🖼️ Subir una imagen rápida a Storage (misma familia que los audios).
 */
async function subirImagenRapidaStorage(
  uid: string,
  tel: string,
  base64: string,
  mimetype: string,
  nombreArchivo: string
): Promise<string> {
  if (!storage) throw new Error('Storage no disponible');
  const ext = mimetype.includes('png') ? 'png' : 'jpg';
  const ruta = `campanas/chat_imagenes/${uid}/${tel}_${Date.now()}.${ext}`;
  const ref = storageRef(storage, ruta);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  await uploadBytes(ref, bytes, {
    contentType: mimetype,
    customMetadata: { uid, tel, tipo: 'imagen_rapida_chat', nombre: nombreArchivo },
  });
  return getDownloadURL(ref);
}

/**
 * 🖼️ Enviar una imagen por el chat (ej. la tarjeta de Gracias).
 * Vía VERIFICADA del bot (campanas_bot.js FASE 1): doc en cola_envio
 * con multimedia {tipo:'imagen', url} + mensaje como CAPTION → el bot
 * descarga la imagen de Storage y la manda con el texto encima.
 * Las imágenes por respuestas_manuales + base64 NO funcionan (el bot
 * principal solo manda el texto — por eso el Gracias salía sin foto).
 * También queda en el historial local del teléfono.
 */
export async function enviarImagenChat(
  uid: string,
  tel: string,
  nombre: string,
  base64: string,
  mimetype: string,
  nombreArchivo: string,
  caption: string
): Promise<void> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  const url = await subirImagenRapidaStorage(uid, t9, base64, mimetype, nombreArchivo);

  await setDoc(doc(db!, 'cola_envio', `${telCompleto(t9)}_chat_img_${Date.now()}`), {
    celular: telCompleto(t9),
    nombre: nombre || 'Cliente',
    mensaje: caption,
    multimedia: { tipo: 'imagen', url, nombre: nombreArchivo },
    imagen_url: url,
    es_chat: true,
    velocidad: 8,
    status: 'pendiente',
    creada_en: new Date().toISOString(),
    intentos: 0,
  });

  registrarImagenLocal({ tel: t9, ts: Date.now(), url, texto: caption });
}

// ── Historial local de imágenes rápidas (para que no "desaparezcan"
//    cuando el bot borra el doc de cola_envio al enviarlo) ──

export interface ImagenLocal {
  tel: string;
  ts: number;
  url: string;
  texto: string;
}

const KEY_IMAGENES = 'rt_chat_imagenes_v1';

export function leerImagenesLocales(): ImagenLocal[] {
  try {
    const lista = JSON.parse(localStorage.getItem(KEY_IMAGENES) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function registrarImagenLocal(img: ImagenLocal): void {
  try {
    const lista = leerImagenesLocales().filter((x) => x.url !== img.url);
    lista.unshift(img);
    localStorage.setItem(KEY_IMAGENES, JSON.stringify(lista.slice(0, 100)));
  } catch { /* sin espacio */ }
}

// ── Historial local de notas de voz (para que no "desaparezcan"
//    cuando el bot borra el doc de cola_envio al enviarlo) ──

export interface AudioLocal {
  tel: string;
  ts: number;
  url: string;
  seg: number;
}

const KEY_AUDIOS = 'rt_chat_audios_v1';

export function leerAudiosLocales(): AudioLocal[] {
  try {
    const lista = JSON.parse(localStorage.getItem(KEY_AUDIOS) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function registrarAudioLocal(a: AudioLocal): void {
  try {
    const lista = leerAudiosLocales().filter((x) => x.url !== a.url);
    lista.unshift(a);
    localStorage.setItem(KEY_AUDIOS, JSON.stringify(lista.slice(0, 200)));
  } catch { /* sin espacio */ }
}

// ═══════════════════════════════════════════════════════════
// FASE 3.3 — FIJAR CHAT (como WhatsApp)
// ═══════════════════════════════════════════════════════════

const KEY_FIJADOS = 'rt_chat_fijados_v1';

export function leerFijados(): Set<string> {
  try {
    const lista = JSON.parse(localStorage.getItem(KEY_FIJADOS) || '[]');
    return new Set(Array.isArray(lista) ? lista : []);
  } catch {
    return new Set();
  }
}

export function toggleFijado(tel: string): boolean {
  const fijados = leerFijados();
  if (fijados.has(tel)) fijados.delete(tel);
  else fijados.add(tel);
  try {
    localStorage.setItem(KEY_FIJADOS, JSON.stringify(Array.from(fijados)));
  } catch { /* noop */ }
  return fijados.has(tel);
}

// ═══════════════════════════════════════════════════════════
// FASE 3.3 — FONDO DEL CHAT (como WhatsApp)
// ═══════════════════════════════════════════════════════════

export interface FondoChat {
  /** id del preset o 'solido' | 'personalizada' */
  id: string;
  /** css background completo (imagen/gradiente/color) */
  css: string;
  /** versión oscura del fondo (para burbujas claras si hace falta) */
  oscuro: boolean;
}

export const FONDOS_CHAT_PRESET: FondoChat[] = [
  { id: 'por_defecto', css: '', oscuro: true },
  {
    id: 'doodle_oscuro',
    css:
      `radial-gradient(circle at 12% 20%, rgba(16,185,129,.10) 0 2px, transparent 3px),` +
      `radial-gradient(circle at 80% 15%, rgba(56,189,248,.08) 0 2px, transparent 3px),` +
      `radial-gradient(circle at 40% 70%, rgba(52,211,153,.09) 0 2px, transparent 3px),` +
      `radial-gradient(circle at 90% 80%, rgba(251,191,36,.07) 0 2px, transparent 3px),` +
      `radial-gradient(circle at 20% 85%, rgba(167,139,250,.08) 0 2px, transparent 3px),` +
      `#0b141a`,
    oscuro: true,
  },
  {
    id: 'doodle_claro',
    css:
      `radial-gradient(circle at 15% 25%, rgba(5,150,105,.12) 0 2px, transparent 3px),` +
      `radial-gradient(circle at 70% 10%, rgba(2,132,199,.10) 0 2px, transparent 3px),` +
      `radial-gradient(circle at 35% 60%, rgba(22,163,74,.10) 0 2px, transparent 3px),` +
      `radial-gradient(circle at 85% 75%, rgba(217,119,6,.10) 0 2px, transparent 3px),` +
      `#e7ded3`,
    oscuro: false,
  },
  { id: 'papel', css: 'linear-gradient(160deg, #1c2530 0%, #101820 100%)', oscuro: true },
  { id: 'bosque', css: 'linear-gradient(160deg, #0f2a1e 0%, #06120c 100%)', oscuro: true },
  { id: 'noche', css: 'linear-gradient(160deg, #141426 0%, #07070f 100%)', oscuro: true },
  { id: 'carbon', css: 'linear-gradient(160deg, #1f2937 0%, #0d1117 100%)', oscuro: true },
  { id: 'vino', css: 'linear-gradient(160deg, #2a1220 0%, #120810 100%)', oscuro: true },
];

const KEY_FONDO = 'rt_chat_fondo_v1';

export function leerFondoChat(): FondoChat {
  try {
    const f = JSON.parse(localStorage.getItem(KEY_FONDO) || 'null');
    if (f && f.id && typeof f.css === 'string') return f;
  } catch { /* noop */ }
  return FONDOS_CHAT_PRESET[0];
}

export function guardarFondoChat(f: FondoChat): void {
  try {
    localStorage.setItem(KEY_FONDO, JSON.stringify(f));
  } catch { /* sin espacio */ }
}

// ═══════════════════════════════════════════════════════════
// FASE 3.3 — BORRAR CHAT (como WhatsApp)
// ═══════════════════════════════════════════════════════════

/**
 * 🗑️ Borra el historial de una conversación:
 *  - TODOS los mensajes_clientes del cliente (sus mensajes)
 *  - las respuestas_manuales YA ENVIADAS (las pendientes se
 *    respetan porque el bot todavía las tiene en cola)
 * El chat desaparece de la lista al quedarse sin mensajes.
 */
export async function borrarChatCompleto(tel: string): Promise<{ entrantes: number; salientes: number }> {
  const t9 = telKey(tel);
  if (!t9) throw new Error('Número inválido');
  const variantes = telVariants(t9);
  let entrantes = 0;
  let salientes = 0;

  // 1. Mensajes del cliente
  const snapEntrantes = await getDocs(
    query(collection(db!, 'mensajes_clientes'), where('telefono', 'in', variantes))
  );
  if (!snapEntrantes.empty) {
    const batch1 = writeBatch(db!);
    snapEntrantes.forEach((d) => batch1.delete(d.ref));
    await batch1.commit();
    entrantes = snapEntrantes.size;
  }

  // 2. Respuestas tuyas YA enviadas (el historial saliente)
  const snapSalientes = await getDocs(
    query(collection(db!, 'respuestas_manuales'), where('telefono', 'in', variantes))
  );
  const enviadas = snapSalientes.docs.filter((d) => d.data()?.enviado === true);
  if (enviadas.length > 0) {
    // Firestore: máx 500 operaciones por batch
    for (let i = 0; i < enviadas.length; i += 450) {
      const batch = writeBatch(db!);
      enviadas.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    salientes = enviadas.length;
  }

  return { entrantes, salientes };
}

/**
 * 🗑️ F3.23 — Borra el historial de la conversación del GRUPO MATE:
 *  - TODOS los mensajes_clientes del grupo (los que escribió la gente:
 *    telefono='GRUPO_MATE' o esGrupo=true)
 *  - los REPORTES ya hechos del bot (acciones_bot pendientes con tipo
 *    de grupo y processed=true — el historial). Los reportes que el
 *    bot todavía tiene en cola NO se tocan.
 * Antes el menú del grupo ni siquiera tenía la opción "Borrar chat"
 * → "quise limpiar el del grupo pero nada".
 */
export async function borrarChatGrupo(): Promise<{ entrantes: number; reportes: number }> {
  if (!db) throw new Error('Sin conexión a la base de datos');

  let entrantes = 0;
  let reportes = 0;

  // 1. Mensajes recibidos del grupo (dos formas de identificarlos:
  //    telefono='GRUPO_MATE' o esGrupo=true → DOS consultas)
  const snaps = await Promise.all([
    getDocs(query(collection(db, 'mensajes_clientes'), where('telefono', '==', TEL_GRUPO_MATE))).catch(() => null),
    getDocs(query(collection(db, 'mensajes_clientes'), where('esGrupo', '==', true))).catch(() => null),
  ]);
  const idsVistos = new Set<string>();
  for (const snap of snaps) {
    if (!snap) continue;
    for (const d of snap.docs) {
      if (idsVistos.has(d.id)) continue; // puede estar en ambas consultas
      idsVistos.add(d.id);
    }
  }
  entrantes = idsVistos.size;
  const ids = [...idsVistos];
  for (let i = 0; i < ids.length; i += 450) {
    if (!ids.length) break;
    const batch = writeBatch(db);
    ids.slice(i, i + 450).forEach((id) => batch.delete(doc(db, 'mensajes_clientes', id)));
    await batch.commit();
  }

  // 2. Reportes del bot al grupo YA hechos (processed=true)
  const snapAcc = await getDocs(
    collection(db, 'acciones_bot', UID_BOT, 'pendientes')
  ).catch(() => null);
  if (snapAcc && !snapAcc.empty) {
    const aBorrar = snapAcc.docs.filter((d) => {
      const m = d.data() || {};
      return TIPOS_GRUPO_MATE.includes(String(m.tipo || '')) && m.processed === true;
    });
    reportes = aBorrar.length;
    for (let i = 0; i < aBorrar.length; i += 450) {
      const batch = writeBatch(db);
      aBorrar.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  return { entrantes, reportes };
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
