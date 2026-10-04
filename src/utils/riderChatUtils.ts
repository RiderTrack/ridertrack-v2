// ═══════════════════════════════════════════════════════════
// 🧰 RIDER CHAT — utilidades y tipos (Fase 3.15)
//
// Port del RiderChat V2 (app aparte) al panel de RiderTrack.
// Aquí viven los tipos del chat + formateadores + paletas de
// avatar + agrupador de fechas + validadores + las plantillas
// rápidas con su persistencia local.
//
// Sin dependencias nuevas: localStorage con try/catch (en APK
// y web funciona igual — el Capacitor Preferences NO está en
// este proyecto y no lo vamos a agregar).
// ═══════════════════════════════════════════════════════════

// ── Tipos del chat (port de riderchat/types/chat.ts) ───────

export type DireccionMensaje = 'sent' | 'received';
export type EstadoMensaje = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type EstadoChat = 'active' | 'closed' | 'blocked';
export type TipoMedia = 'image' | 'video' | 'audio' | 'document' | 'location';

export interface MediaMensaje {
  type: TipoMedia;
  url: string;
  caption?: string;
  fileName?: string;
  fileSize?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
}

export interface MensajeRider {
  id: string;
  direction: DireccionMensaje;
  text: string;
  media?: MediaMensaje | null;
  status: EstadoMensaje;
  /** Unix ms */
  timestamp: number;
  senderId: string;
  errorMessage?: string;
  templateName?: string;
  replyToId?: string;
  metaMessageId?: string;
}

export interface ChatRider {
  /** Teléfono normalizado (51…), es el ID del doc en Firestore */
  clientPhone: string;
  clientName: string;
  lastMessage: string;
  lastMessageTime: number;
  lastMessageType?: TipoMedia | 'text';
  unreadCount: number;
  status: EstadoChat;
  createdAt: number;
  avatar?: string;
  tags?: string[];
  notes?: string;
  isTyping?: boolean;
}

export interface PlantillaRapida {
  id: string;
  title: string;
  category: 'delivery' | 'greeting' | 'issue' | 'payment' | 'location';
  content: string;
  variables?: string[];
}

export interface FiltrosChat {
  search: string;
  status: 'all' | 'active' | 'closed' | 'blocked';
  sortBy: 'recent' | 'unread';
}

// ── Formateadores (port de riderchat/utils/formatters.ts) ──

/** Hora estilo WhatsApp: hoy "14:32", ayer "Ayer 09:15", más viejo "12 ago 18:40" */
export function formatMessageTime(timestamp: number | string | Date | undefined): string {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) return timeStr;
  if (isYesterday) return `Ayer ${timeStr}`;

  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  if (date.getFullYear() === now.getFullYear()) return `${day} ${month} ${timeStr}`;
  return `${day}/${date.getMonth() + 1}/${date.getFullYear()} ${timeStr}`;
}

/** 51987654321 → +51 987 654 321 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('51') && clean.length === 11) {
    return `+51 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  if (clean.length === 9) {
    return `+51 ${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }
  return `+${clean}`;
}

/** Iniciales del nombre (máx 2 letras) */
export function getInitials(name: string): string {
  if (!name) return 'W';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Recorta texto con puntos suspensivos */
export function truncateText(text: string, maxLength: number = 38): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ── Paleta de avatar por hash del nombre ───────────────────

export interface PaletaAvatar {
  bg: string;
  text: string;
  border: string;
  hex: string;
}

const PALETAS_AVATAR: PaletaAvatar[] = [
  { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-500', hex: '#059669' },
  { bg: 'bg-teal-600', text: 'text-white', border: 'border-teal-500', hex: '#0d9488' },
  { bg: 'bg-indigo-600', text: 'text-white', border: 'border-indigo-500', hex: '#4f46e5' },
  { bg: 'bg-violet-600', text: 'text-white', border: 'border-violet-500', hex: '#7c3aed' },
  { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-500', hex: '#9333ea' },
  { bg: 'bg-cyan-600', text: 'text-white', border: 'border-cyan-500', hex: '#0891b2' },
  { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-500', hex: '#2563eb' },
  { bg: 'bg-amber-600', text: 'text-white', border: 'border-amber-500', hex: '#d97706' },
  { bg: 'bg-rose-600', text: 'text-white', border: 'border-rose-500', hex: '#e11d48' },
  { bg: 'bg-sky-600', text: 'text-white', border: 'border-sky-500', hex: '#0284c7' },
];

export function getAvatarPalette(name: string): PaletaAvatar {
  if (!name) return PALETAS_AVATAR[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETAS_AVATAR.length;
  return PALETAS_AVATAR[index];
}

// ── Agrupador de mensajes por fecha ────────────────────────

export interface MensajesPorFecha {
  dateLabel: string;
  messages: MensajeRider[];
}

/** Agrupa mensajes por día con etiquetas "Hoy", "Ayer", "12 ago" */
export function groupMessagesByDate(messages: MensajeRider[]): MensajesPorFecha[] {
  if (!messages || messages.length === 0) return [];

  const groups: { [key: string]: MensajeRider[] } = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  messages.forEach((msg) => {
    const msgDate = new Date(msg.timestamp);
    msgDate.setHours(0, 0, 0, 0);

    let dateLabel = '';
    if (msgDate.getTime() === today.getTime()) {
      dateLabel = 'Hoy';
    } else if (msgDate.getTime() === yesterday.getTime()) {
      dateLabel = 'Ayer';
    } else {
      const isSameYear = msgDate.getFullYear() === today.getFullYear();
      const options: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'short',
        ...(isSameYear ? {} : { year: 'numeric' }),
      };
      dateLabel = msgDate.toLocaleDateString('es-PE', options);
    }

    if (!groups[dateLabel]) groups[dateLabel] = [];
    groups[dateLabel].push(msg);
  });

  return Object.keys(groups).map((dateLabel) => ({
    dateLabel,
    messages: groups[dateLabel],
  }));
}

// ── Validadores de teléfono ────────────────────────────────

/** ¿Parace un WhatsApp válido? 8-15 dígitos */
export function isValidWhatsAppPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 8 && clean.length <= 15;
}

/** Estandariza a 51… (si es 9 dígitos peruanos) o dígitos internacionales */
export function sanitizePhone(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  if (clean.length === 9 && clean.startsWith('9')) {
    clean = `51${clean}`;
  }
  return clean;
}

// ── Plantillas rápidas (con persistencia local) ────────────

export const PLANTILLAS_RAPIDAS_DEFAULT: PlantillaRapida[] = [
  {
    id: 'tmpl_1',
    title: '🚀 Inicio de Ruta',
    category: 'delivery',
    content: '¡Hola {{cliente}}! 👋 Soy tu rider de MATE Pharmacy. Hoy te entrego tu pedido. ¿A qué hora te viene bien la entrega?',
    variables: ['cliente'],
  },
  {
    id: 'tmpl_2',
    title: '⏱️ Avisar llegada',
    category: 'delivery',
    content: '¡Hola {{cliente}}! Ya estoy cerca de tu ubicación. Llego en aproximadamente {{minutos}} minutos. 🛵💨',
    variables: ['cliente', 'minutos'],
  },
  {
    id: 'tmpl_3',
    title: '📍 Solicitar Ubicación',
    category: 'location',
    content: '¡Hola {{cliente}}! Por favor envíame tu ubicación actual por WhatsApp para llegar sin problemas. 📍',
    variables: ['cliente'],
  },
  {
    id: 'tmpl_4',
    title: '✅ Pedido Entregado',
    category: 'delivery',
    content: '✅ ¡Pedido entregado!\n\nGracias por confiar en MATE Pharmacy 🙏\n\n¿Tienes alguna consulta o reclamo?\n📱 WhatsApp: 956 203 893 (Fabiana)\n📞 Llamadas: 956 203 893\n\n¡Estamos para ayudarte! 😊',
  },
  {
    id: 'tmpl_5',
    title: '💳 Confirmar Pago',
    category: 'payment',
    content: 'Estimado/a {{cliente}}, el total a cancelar es S/ {{monto}}. Puedes Yapear o Plinear al número registrado. ¡Avisas cuando realices la transferencia! 📲',
    variables: ['cliente', 'monto'],
  },
];

// ── Persistencia local (borradores, chat activo, plantillas) ─

const LS_KEY = {
  BORRADORES: 'rt_riderchat_borradores_v1',
  CHAT_ACTIVO: 'rt_riderchat_activo_v1',
  PLANTILLAS: 'rt_riderchat_plantillas_v1',
};

function lsLeer(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsGuardar(key: string, valor: string): void {
  try {
    localStorage.setItem(key, valor);
  } catch {
    // sin storage (modo privado) — no pasa nada
  }
}

export function leerBorrador(phone: string): string {
  try {
    const json = lsLeer(LS_KEY.BORRADORES);
    if (!json) return '';
    const borradores = JSON.parse(json);
    return borradores[phone] || '';
  } catch {
    return '';
  }
}

export function guardarBorrador(phone: string, texto: string): void {
  try {
    const json = lsLeer(LS_KEY.BORRADORES);
    const borradores = json ? JSON.parse(json) : {};
    borradores[phone] = texto;
    lsGuardar(LS_KEY.BORRADORES, JSON.stringify(borradores));
  } catch {
    // nada
  }
}

export function leerChatActivo(): string | null {
  return lsLeer(LS_KEY.CHAT_ACTIVO);
}

export function guardarChatActivo(phone: string | null): void {
  if (phone) lsGuardar(LS_KEY.CHAT_ACTIVO, phone);
  else {
    try {
      localStorage.removeItem(LS_KEY.CHAT_ACTIVO);
    } catch {
      // nada
    }
  }
}

export function leerPlantillasRapidas(): PlantillaRapida[] {
  try {
    const saved = lsLeer(LS_KEY.PLANTILLAS);
    if (saved) return JSON.parse(saved);
  } catch {
    // nada
  }
  return PLANTILLAS_RAPIDAS_DEFAULT;
}

export function guardarPlantillasRapidas(plantillas: PlantillaRapida[]): void {
  lsGuardar(LS_KEY.PLANTILLAS, JSON.stringify(plantillas));
}

// ═══════════════════════════════════════════════════════════
// FASE 3.16 — CHATS FIJADOS (como el Chat Baileys / WhatsApp)
// Llaves PROPIAS del Rider Chat: fijar aquí no toca el chat del
// bot Rudy (cada chat guarda sus fijados por su lado).
// ═══════════════════════════════════════════════════════════

const KEY_FIJADOS_RIDER = 'rt_riderchat_fijados_v1';

/** Set de teléfonos fijados por el rider (persistido en el teléfono) */
export function leerFijadosRider(): Set<string> {
  try {
    const lista = JSON.parse(lsLeer(KEY_FIJADOS_RIDER) || '[]');
    return new Set(Array.isArray(lista) ? lista : []);
  } catch {
    return new Set();
  }
}

/** Fija / desfija un chat. Devuelve el nuevo estado (true = fijado) */
export function toggleFijadoRider(tel: string): boolean {
  const fijados = leerFijadosRider();
  if (fijados.has(tel)) fijados.delete(tel);
  else fijados.add(tel);
  lsGuardar(KEY_FIJADOS_RIDER, JSON.stringify(Array.from(fijados)));
  return fijados.has(tel);
}

/**
 * Ordena la lista como WhatsApp: fijados arriba (por su hora) y
 * el resto debajo (por su hora). No muta el array original.
 */
export function ordenarChatsConFijados(chats: ChatRider[], fijados: Set<string>): ChatRider[] {
  return [...chats].sort((a, b) => {
    const fa = fijados.has(a.clientPhone) ? 1 : 0;
    const fb = fijados.has(b.clientPhone) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
  });
}

// ═══════════════════════════════════════════════════════════
// FASE 3.16 — FONDO DEL CHAT (como WhatsApp / Chat Baileys)
// Se aplica al área de mensajes de TODOS los chats del Rider
// Chat y queda guardado en este teléfono.
// ═══════════════════════════════════════════════════════════

export interface FondoChatRider {
  /** id del preset o 'personalizada' */
  id: string;
  /** css background completo (imagen/gradiente/color) */
  css: string;
  /** true si el fondo es oscuro (para que las burbujas respiren) */
  oscuro: boolean;
}

export const FONDOS_RIDERCHAT_PRESET: FondoChatRider[] = [
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

const KEY_FONDO_RIDER = 'rt_riderchat_fondo_v1';

export function leerFondoChatRider(): FondoChatRider {
  try {
    const f = JSON.parse(lsLeer(KEY_FONDO_RIDER) || 'null');
    if (f && f.id && typeof f.css === 'string') return f as FondoChatRider;
  } catch {
    // nada
  }
  return FONDOS_RIDERCHAT_PRESET[0];
}

export function guardarFondoChatRider(f: FondoChatRider): void {
  lsGuardar(KEY_FONDO_RIDER, JSON.stringify(f));
}

/**
 * Comprime una foto de la galería para usarla de fondo sin
 * reventar el localStorage (máx 1080px, JPEG 80%). Canvas puro,
 * sin dependencias nuevas.
 */
export function comprimirImagenFondo(file: File): Promise<{ base64: string; mimetype: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagen no válida'));
      img.onload = () => {
        try {
          const MAX = 1080;
          const escala = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * escala));
          canvas.height = Math.max(1, Math.round(img.height * escala));
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas no disponible');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({ base64: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], mimetype: 'image/jpeg' });
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Error comprimiendo'));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════
// FASE 3.16 — PANEL DE MENSAJES RÁPIDOS PLEGABLE
// Recuerda si lo dejaste abierto o cerrado (por defecto cerrado,
// para que la ventana del chat respire como WhatsApp Web).
// ═══════════════════════════════════════════════════════════

const KEY_RAPIDO_ABIERTO = 'rt_riderchat_rapido_v1';

export function leerRapidoAbierto(): boolean {
  return lsLeer(KEY_RAPIDO_ABIERTO) === '1';
}

export function guardarRapidoAbierto(abierto: boolean): void {
  lsGuardar(KEY_RAPIDO_ABIERTO, abierto ? '1' : '0');
}

/**
 * ¿Hace más de 24 h que el cliente no escribe? (ventana de Meta)
 * Fuera de la ventana solo se pueden mandar PLANTILLAS aprobadas —
 * se usa para el aviso profesional dentro del chat.
 */
export function ventana24hCerrada(messages: MensajeRider[]): boolean {
  const ultimoRecibido = [...messages]
    .filter((m) => m.direction === 'received')
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
  if (!ultimoRecibido) return true; // nunca escribió → fuera de ventana
  return Date.now() - new Date(ultimoRecibido.timestamp).getTime() > 24 * 3600 * 1000;
}
