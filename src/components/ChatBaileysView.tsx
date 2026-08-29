// ═══════════════════════════════════════════════════════════
// 🤖 CHAT BAILEYS VIEW — RiderTrack V2 (Fase 3.1)
// Mudanza del chat de ClienteTrack v1 → WhatsApp Web profesional
// manejado 100% por el robot de Baileys (rudy-bot).
//
// La app SOLO escribe en las colas de Firestore; el bot es el
// único que envía por WhatsApp:
//   - mensajes_clientes    → lo que los clientes escriben
//   - respuestas_manuales  → tus respuestas (⏳ → ✓✓)
//   - acciones_bot         → lo que el bot manda por ti (pedido
//                            de ubicación, avisos, QR Yape...)
//   - cola_envio/campanas  → los broadcasts masivos 📢
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Send,
  Loader2,
  Bot,
  Megaphone,
  MapPin,
  QrCode,
  BellOff,
  BellRing,
  ArrowLeft,
  Paperclip,
  Smile,
  X,
  Download,
  Trash2,
  MessageSquare,
  CheckCheck,
  Clock,
  FileText,
  ImageIcon,
  AlertTriangle,
  MapPinned,
  Phone,
  Radio,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  Conversacion,
  MensajeChat,
  CampanaBot,
  ChatStats,
  colorAvatar,
  horaCorta,
  horaBurbuja,
  etiquetaDia,
  suscribirChat,
  suscribirCampanas,
  enviarMensajeChat,
  enviarAdjuntoChat,
  pedirUbicacionBot,
  enviarYapeQRChat,
  silenciarBot,
  reactivarBot,
  marcarLeidoChat,
  eliminarMensajeChat,
  comprimirImagen,
  leerDocumento,
  descargarBase64,
  telCompleto,
} from '../utils/chatBaileys';

interface ChatBaileysViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const EMOJIS = ['😊', '😂', '👍', '🙏', '❤️', '🎉', '✅', '🔥', '👌', '😅', '🤝', '💪', '🚀', '📍', '📦', '💰', '⏰', '🙌', '😉', '🥳', '😎', '🤗', '☕', '🍀', '⚡', '🎁', '📸', '👏', '🫡', '🤖'];

// ─────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────

const AvatarChat: React.FC<{ tel: string; nombre: string; grande?: boolean }> = ({ tel, nombre, grande }) => {
  const c = colorAvatar(tel);
  const inicial = (nombre || '?').charAt(0).toUpperCase();
  return (
    <div
      className={`${grande ? 'w-11 h-11 text-base' : 'w-10 h-10 text-sm'} ${c.bg} ${c.texto} rounded-full flex items-center justify-center font-black flex-shrink-0 shadow-inner select-none`}
    >
      {inicial}
    </div>
  );
};

/** Ticks estilo WhatsApp: ⏳ pendiente / ✓✓ enviado */
const Ticks: React.FC<{ enviado: boolean | null }> = ({ enviado }) => {
  if (enviado === null) return null;
  if (enviado) return <CheckCheck className="w-3.5 h-3.5 text-emerald-100/90" />;
  return <Clock className="w-3.5 h-3.5 text-emerald-100/70 animate-pulse" />;
};

const SeparadorDia: React.FC<{ etiqueta: string }> = ({ etiqueta }) => (
  <div className="flex justify-center my-3">
    <span className="px-3 py-1 rounded-full bg-slate-900/80 text-[10px] font-bold tracking-widest text-slate-400 border border-slate-700/60">
      {etiqueta}
    </span>
  </div>
);

/** Burbuja de ubicación estilo WhatsApp */
const BurbujaUbicacion: React.FC<{ lat?: number | null; lng?: number | null }> = ({ lat, lng }) => {
  if (lat == null || lng == null) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <MapPinned className="w-4 h-4 flex-shrink-0" />
        <span>Ubicación compartida</span>
      </div>
    );
  }
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <div className="w-56 max-w-full">
      <div className="h-24 rounded-t-xl bg-gradient-to-br from-emerald-900/80 via-slate-800 to-slate-900 border-b border-slate-700/60 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(16,185,129,.5) 0, transparent 40%), radial-gradient(circle at 70% 70%, rgba(16,185,129,.35) 0, transparent 35%)' }} />
        <div className="relative flex flex-col items-center gap-1">
          <MapPin className="w-8 h-8 text-emerald-400 drop-shadow-lg" />
          <span className="text-[10px] font-mono text-slate-300">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-slate-900/70 rounded-b-xl transition-colors"
      >
        <MapPinned className="w-3.5 h-3.5" /> Abrir en Google Maps
      </a>
    </div>
  );
};

/** Tarjeta de documento adjunto */
const TarjetaDoc: React.FC<{ nombreArchivo?: string; mimetype?: string; base64?: string }> = ({ nombreArchivo, mimetype, base64 }) => {
  const ext = (nombreArchivo || '').split('.').pop()?.toLowerCase() || '';
  const icono = ext === 'pdf' ? '📕' : ext === 'xlsx' || ext === 'xls' || ext === 'csv' ? '📊' : ext === 'docx' || ext === 'doc' ? '📘' : '📄';
  const pesoKB = base64 ? Math.round((base64.length * 0.75) / 1024) : 0;
  return (
    <button
      type="button"
      onClick={() => base64 && descargarBase64(base64, mimetype || 'application/octet-stream', nombreArchivo || 'documento')}
      className="flex items-center gap-3 w-56 max-w-full p-2.5 rounded-xl bg-slate-900/70 border border-slate-600/40 hover:border-slate-500/60 transition-colors text-left"
    >
      <span className="text-2xl flex-shrink-0">{icono}</span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="text-xs font-bold truncate">{nombreArchivo || 'Documento'}</span>
        <span className="text-[10px] opacity-70">{ext ? ext.toUpperCase() + ' · ' : ''}{pesoKB} KB</span>
      </span>
      <Download className="w-4 h-4 opacity-70 flex-shrink-0" />
    </button>
  );
};

interface BurbujaProps {
  m: MensajeChat;
  desconocido: boolean;
  revelado: boolean;
  onRevelar: () => void;
  onVerImagen: (m: MensajeChat) => void;
  onEliminar?: () => void;
}

/** Burbuja individual de mensaje */
const BurbujaMensaje: React.FC<BurbujaProps> = ({ m, desconocido, revelado, onRevelar, onVerImagen, onEliminar }) => {
  const esEntrante = m.origen === 'cliente';
  const esBot = m.origen === 'bot';
  const esCampana = m.origen === 'campana';

  const burbujaBase = esEntrante
    ? 'bg-slate-800 border-slate-700 text-slate-100 rounded-2xl rounded-tl-md'
    : esBot
      ? 'bg-emerald-800/90 border-emerald-600/40 text-white rounded-2xl rounded-tr-md'
      : esCampana
        ? 'bg-teal-900/80 border-teal-600/40 text-white rounded-2xl rounded-tr-md'
        : 'bg-emerald-600 text-white rounded-2xl rounded-tr-md';

  return (
    <div className={`flex ${esEntrante ? 'justify-start' : 'justify-end'} mb-2 group`}>
      <div className={`relative max-w-[85%] sm:max-w-[70%] px-3 py-2 shadow-md ${burbujaBase}`}>
        {/* Etiqueta de origen para salientes especiales */}
        {esBot && (
          <div className="flex items-center gap-1 mb-1 text-[10px] font-bold text-emerald-200/90 uppercase tracking-wide">
            <Bot className="w-3 h-3" /> Bot · {(m.accionBot || '').replace(/_/g, ' ')}
          </div>
        )}
        {esCampana && (
          <div className="flex items-center gap-1 mb-1 text-[10px] font-bold text-teal-200/90 uppercase tracking-wide">
            <Megaphone className="w-3 h-3" /> Campaña
            {m.nombreCampana && m.nombreCampana !== 'desconocida' ? <span className="opacity-70 normal-case">· {m.nombreCampana}</span> : null}
            {m.estadoCampana === 'fallido' && <span className="ml-1 flex items-center gap-0.5 text-rose-300 normal-case">⚠ falló</span>}
            {m.estadoCampana === 'pendiente' && <span className="ml-1 normal-case opacity-75">en cola</span>}
            {m.estadoCampana === 'procesando' && <span className="ml-1 normal-case opacity-75">enviando…</span>}
          </div>
        )}

        {/* Contenido */}
        {m.tipoContenido === 'ubicacion' ? (
          <BurbujaUbicacion lat={m.lat} lng={m.lng} />
        ) : m.tipoContenido === 'imagen' && m.base64 ? (
          <div className="space-y-1.5">
            <div className="relative">
              <img
                src={`data:${m.mimetype || 'image/jpeg'};base64,${m.base64}`}
                alt="Imagen"
                className={`rounded-xl max-w-full cursor-pointer transition-all ${desconocido && !revelado ? 'blur-md' : ''}`}
                style={{ maxHeight: 240 }}
                onClick={() => (desconocido && !revelado ? onRevelar() : onVerImagen(m))}
              />
              {desconocido && !revelado && (
                <span className="absolute inset-x-0 bottom-2 mx-auto w-fit px-2 py-0.5 rounded-full bg-slate-950/80 text-[10px] font-semibold text-slate-200">
                  🛡️ Desconocido — toca para ver
                </span>
              )}
            </div>
            {m.texto && m.texto !== '📷 Imagen' && (
              <span className="block text-sm whitespace-pre-wrap break-words">{m.texto}</span>
            )}
          </div>
        ) : m.tipoContenido === 'audio' && m.base64 ? (
          <audio controls preload="metadata" src={`data:${m.mimetype || 'audio/ogg'};base64,${m.base64}`} className="max-w-[220px] h-9" />
        ) : m.tipoContenido === 'documento' && m.base64 ? (
          <TarjetaDoc nombreArchivo={m.nombreArchivo} mimetype={m.mimetype} base64={m.base64} />
        ) : m.tipoContenido === 'yape_qr' ? (
          <div className="flex items-center gap-2 py-0.5">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/30 border border-emerald-300/40 flex items-center justify-center text-base">💰</span>
            <div className="flex flex-col">
              <span className="text-sm font-bold">QR de Yape</span>
              <span className="text-[10px] opacity-80">El bot envía el QR de tu ruta</span>
            </div>
          </div>
        ) : (
          <span className="text-sm whitespace-pre-wrap break-words">{m.texto}</span>
        )}

        {/* Meta: hora + ticks */}
        <div className="flex items-center justify-end gap-1 mt-1">
          {esEntrante && m.borrableDocId && (
            <button
              type="button"
              onClick={onEliminar}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-rose-400"
              title="Eliminar mensaje"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[10px] opacity-70">{horaCorta(m.timestamp)}</span>
          {!esEntrante && <Ticks enviado={m.enviado} />}
        </div>
      </div>
    </div>
  );
};

/** Item de la lista de conversaciones */
const ItemConversacion: React.FC<{
  conv: Conversacion;
  activo: boolean;
  onAbrir: () => void;
}> = ({ conv, activo, onAbrir }) => {
  const ultimo = conv.ultimoMensaje;
  const prefijo = !ultimo ? '' : ultimo.origen === 'rudy' ? 'Tú: ' : ultimo.origen === 'bot' ? '🤖 ' : ultimo.origen === 'campana' ? '📢 ' : '';
  const preview =
    !ultimo ? 'Sin mensajes' :
    ultimo.tipoContenido === 'imagen' ? '📷 Imagen' :
    ultimo.tipoContenido === 'audio' ? '🎙️ Audio' :
    ultimo.tipoContenido === 'documento' ? '📄 Documento' :
    ultimo.tipoContenido === 'ubicacion' ? '📍 Ubicación' :
    ultimo.tipoContenido === 'yape_qr' ? '💰 QR de Yape' :
    ultimo.texto;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
        activo ? 'bg-emerald-600/15 border border-emerald-500/40' : 'border border-transparent hover:bg-slate-800/60'
      }`}
    >
      <div className="relative flex-shrink-0">
        <AvatarChat tel={conv.tel} nombre={conv.nombre} />
        {conv.noLeidos > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-slate-900">
            {conv.noLeidos > 99 ? '99+' : conv.noLeidos}
          </span>
        )}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm truncate ${conv.noLeidos > 0 ? 'font-black text-white' : 'font-semibold text-slate-200'}`}>
            {conv.nombre}
          </span>
          <span className="text-[10px] text-slate-500 flex-shrink-0">{horaCorta(conv.ultimoTimestamp)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {conv.silenciado && <BellOff className="w-3 h-3 text-amber-500 flex-shrink-0" />}
          <span className={`text-xs truncate ${conv.noLeidos > 0 ? 'font-semibold text-slate-300' : 'text-slate-500'}`}>
            {prefijo}{preview}
          </span>
        </div>
      </div>
    </button>
  );
};

/** Panel de campañas (broadcast) con progreso en vivo */
const PanelCampanas: React.FC<{ campanas: CampanaBot[] }> = ({ campanas }) => {
  if (campanas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 px-6 text-center text-slate-400">
        <Megaphone className="w-10 h-10 mb-3 opacity-40" />
        <div className="text-sm font-semibold text-slate-300">Sin campañas aún</div>
        <div className="text-xs mt-1">Los broadcasts masivos que envía el bot aparecerán aquí con su progreso en vivo</div>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {campanas.map((c) => {
        const pct = c.stats.total > 0 ? Math.round((c.stats.enviados / c.stats.total) * 100) : 0;
        const pctFallidos = c.stats.total > 0 ? Math.round((c.stats.fallidos / c.stats.total) * 100) : 0;
        const colorEstado =
          c.estado === 'completada' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
          c.estado === 'enviando' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse' :
          c.estado === 'borrador' ? 'bg-slate-500/20 text-slate-300 border-slate-500/40' :
          'bg-rose-500/20 text-rose-300 border-rose-500/40';
        return (
          <div key={c.id} className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {c.esPrueba && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">PRUEBA</span>}
                  <span className="text-sm font-bold text-white truncate">{c.nombre}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {c.creadaEn ? new Date(c.creadaEn).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''} · ⏱ {c.velocidad}s entre envíos
                </div>
              </div>
              <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full border flex-shrink-0 ${colorEstado}`}>{c.estado}</span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-2 mb-2">{c.mensaje}</p>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-700/60 mb-1.5">
              <div className="bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              <div className="bg-rose-500 transition-all" style={{ width: `${pctFallidos}%` }} />
            </div>
            <div className="flex items-center gap-3 text-[10px] font-semibold">
              <span className="text-emerald-400">✓ {c.stats.enviados}</span>
              <span className="text-rose-400">⚠ {c.stats.fallidos}</span>
              <span className="text-slate-400">⏳ {c.stats.pendientes}</span>
              <span className="text-slate-500 ml-auto">total {c.stats.total}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// VISTA PRINCIPAL
// ─────────────────────────────────────────────────────────────

export const ChatBaileysView: React.FC<ChatBaileysViewProps> = ({ onShowToast }) => {
  const { profile } = useAuth();

  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [stats, setStats] = useState<ChatStats>({ total: 0, noLeidos: 0, mensajesHoy: 0, silenciados: 0 });
  const [campanas, setCampanas] = useState<CampanaBot[]>([]);
  const [telActivo, setTelActivo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'noLeidos' | 'silenciados'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pestanaIzq, setPestanaIzq] = useState<'chats' | 'campanas'>('chats');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const [menuAdjuntos, setMenuAdjuntos] = useState(false);
  const [reveladas, setReveladas] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ base64: string; mimetype: string; nombre: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputImgRef = useRef<HTMLInputElement>(null);
  const inputDocRef = useRef<HTMLInputElement>(null);

  // ── Suscripciones en tiempo real ──
  useEffect(() => {
    const sub = suscribirChat((convs, st) => {
      setConversaciones(convs);
      setStats(st);
    });
    const unsubCampanas = suscribirCampanas(setCampanas);
    return () => { sub.cancelar(); unsubCampanas(); };
  }, []);

  // ── Marcar leído al abrir un chat ──
  useEffect(() => {
    if (telActivo) marcarLeidoChat(telActivo);
  }, [telActivo]);

  const convActiva = useMemo(
    () => conversaciones.find((c) => c.tel === telActivo) || null,
    [conversaciones, telActivo]
  );

  // ── Auto-scroll al último mensaje ──
  const cantidadMensajes = convActiva?.mensajes.length || 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cantidadMensajes, telActivo]);

  // ── Mapa campaign_id → nombre ──
  const nombreCampana = useMemo(() => {
    const m = new Map<string, string>();
    campanas.forEach((c) => m.set(c.id, c.nombre));
    return m;
  }, [campanas]);

  // ── Filtrado de la lista ──
  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return conversaciones.filter((c) => {
      if (filtro === 'noLeidos' && c.noLeidos === 0) return false;
      if (filtro === 'silenciados' && !c.silenciado) return false;
      if (q && !c.nombre.toLowerCase().includes(q) && !c.tel.includes(q.replace(/\D/g, ''))) return false;
      return true;
    });
  }, [conversaciones, filtro, busqueda]);

  // ── Acciones ──
  const toast = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') =>
    onShowToast?.(title, desc, type);

  const abrirChat = (tel: string) => setTelActivo(tel);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !convActiva || enviando) return;
    setEnviando(true);
    try {
      await enviarMensajeChat(convActiva.tel, convActiva.nombre, t);
      setTexto('');
      setEmojiAbierto(false);
    } catch (e: any) {
      toast('Error al enviar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const pedirUbicacion = async () => {
    if (!convActiva) return;
    try {
      await pedirUbicacionBot(convActiva.tel, convActiva.nombre, {
        nombre: profile?.nombre || 'Rudy',
        telefono: profile?.email || '',
        empresa: 'MATE',
      });
      toast('📍 Ubicación pedida', 'El bot le está pidiendo su ubicación a ' + convActiva.nombre, 'success');
    } catch (e: any) {
      toast('Error', e.message || 'No se pudo pedir la ubicación', 'error');
    }
  };

  const enviarYape = async () => {
    if (!convActiva) return;
    try {
      await enviarYapeQRChat(convActiva.tel, convActiva.nombre);
      toast('💰 QR de Yape', 'El bot enviará el QR de tu ruta activa', 'success');
    } catch (e: any) {
      toast('Error', e.message || 'No se pudo enviar el QR', 'error');
    }
  };

  const toggleSilencio = async () => {
    if (!convActiva) return;
    try {
      if (convActiva.silenciado) {
        await reactivarBot(convActiva.tel);
        toast('🔔 Bot reactivado', 'El bot volverá a responderle automáticamente', 'success');
      } else {
        await silenciarBot(convActiva.tel, 'silenciado desde RiderTrack V2');
        toast('🔇 Bot silenciado', 'El bot no le responderá hasta que lo reactives', 'info');
      }
    } catch (e: any) {
      toast('Error', e.message || 'No se pudo cambiar el silencio', 'error');
    }
  };

  const manejarArchivo = async (file: File | undefined, tipo: 'imagen' | 'documento') => {
    if (!file || !convActiva) return;
    try {
      if (tipo === 'imagen') {
        const { base64, mimetype } = await comprimirImagen(file);
        await enviarAdjuntoChat(convActiva.tel, convActiva.nombre, 'imagen', base64, mimetype, file.name || 'imagen.jpg', '📷 Imagen');
        toast('📷 Imagen en cola', 'El bot la enviará en segundos', 'success');
      } else {
        const { base64, mimetype } = await leerDocumento(file);
        await enviarAdjuntoChat(convActiva.tel, convActiva.nombre, 'documento', base64, mimetype, file.name || 'documento', '📄 ' + (file.name || 'Documento'));
        toast('📄 Documento en cola', 'El bot lo enviará en segundos', 'success');
      }
    } catch (e: any) {
      toast('Error con el archivo', e.message || 'Intenta con otro archivo', 'error');
    }
  };

  const borrarMensaje = async (docId: string) => {
    if (!window.confirm('¿Eliminar este mensaje del chat? Esta acción no se puede deshacer.')) return;
    try {
      await eliminarMensajeChat(docId);
      toast('Mensaje eliminado', undefined, 'success');
    } catch (e: any) {
      toast('Error', e.message || 'No se pudo eliminar', 'error');
    }
  };

  const insertarEmoji = (e: string) => {
    setTexto((t) => t + e);
  };

  // Agrupar mensajes por día para los separadores
  const mensajesAgrupados = useMemo(() => {
    if (!convActiva) return [];
    const grupos: { dia: string; mensajes: MensajeChat[] }[] = [];
    convActiva.mensajes.forEach((m) => {
      const dia = etiquetaDia(m.timestamp);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.dia === dia) ultimo.mensajes.push(m);
      else grupos.push({ dia, mensajes: [m] });
    });
    return grupos;
  }, [convActiva]);

  const conectado = conversaciones.length > 0 || stats.mensajesHoy > 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-11.5rem)] lg:h-[calc(100dvh-8.5rem)] min-h-[540px] pb-12 gap-3">
      {/* ═══ CABECERA ═══ */}
      <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
            <Bot className="w-6 h-6" />
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-800 ${conectado ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              Chat Baileys
              <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500 text-slate-950">WhatsApp Web</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              Todo lo que el robot envía y recibe: chats, broadcasts y pedidos de ubicación
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-700 text-xs font-bold text-slate-300">
            💬 {stats.total} chats
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-300">
            🔔 {stats.noLeidos} sin leer
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            🔇 {stats.silenciados}
          </span>
        </div>
      </div>

      {/* ═══ CUERPO: lista + conversación ═══ */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* ─── PANEL IZQUIERDO ─── */}
        <div className={`${telActivo ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[350px] xl:w-[380px] flex-shrink-0 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl overflow-hidden`}>
          {/* Tabs chats/campañas */}
          <div className="flex p-2 gap-1 border-b border-slate-700/70 flex-shrink-0">
            <button
              type="button"
              onClick={() => setPestanaIzq('chats')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                pestanaIzq === 'chats' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-slate-400 hover:bg-slate-700/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Chats
              {stats.noLeidos > 0 && pestanaIzq !== 'chats' && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black">{stats.noLeidos}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPestanaIzq('campanas')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                pestanaIzq === 'campanas' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30' : 'text-slate-400 hover:bg-slate-700/60'
              }`}
            >
              <Megaphone className="w-4 h-4" /> Campañas
            </button>
          </div>

          {pestanaIzq === 'chats' ? (
            <>
              {/* Búsqueda + filtros */}
              <div className="p-2.5 space-y-2 border-b border-slate-700/70 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre o número…"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div className="flex gap-1.5">
                  {([
                    { id: 'todos', label: 'Todos' },
                    { id: 'noLeidos', label: `Sin leer${stats.noLeidos ? ' · ' + stats.noLeidos : ''}` },
                    { id: 'silenciados', label: 'Silenciados' },
                  ] as const).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFiltro(f.id)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                        filtro === f.id ? 'bg-emerald-600 text-white' : 'bg-slate-900/60 text-slate-400 border border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Lista */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5">
                {listaFiltrada.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 px-6 text-center text-slate-400">
                    <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
                    <div className="text-sm font-semibold text-slate-300">
                      {conversaciones.length === 0 ? 'Sin conversaciones' : 'Nada por aquí'}
                    </div>
                    <div className="text-xs mt-1">
                      {conversaciones.length === 0
                        ? 'Cuando los clientes escriban al bot aparecerán aquí'
                        : 'Prueba con otro filtro o búsqueda'}
                    </div>
                  </div>
                ) : (
                  listaFiltrada.map((c) => (
                    <ItemConversacion
                      key={c.tel}
                      conv={c}
                      activo={c.tel === telActivo}
                      onAbrir={() => abrirChat(c.tel)}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5">
              <PanelCampanas campanas={campanas} />
            </div>
          )}
        </div>

        {/* ─── PANEL DERECHO: conversación ─── */}
        <div className={`${telActivo ? 'flex' : 'hidden lg:flex'} flex-col flex-1 min-w-0 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl overflow-hidden`}>
          {!convActiva ? (
            /* Estado vacío */
            <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
                <Bot className="w-10 h-10 text-emerald-400/80" />
              </div>
              <h2 className="text-lg font-black text-white mb-1">Chat del robot de Baileys</h2>
              <p className="text-sm text-slate-400 max-w-md">
                Selecciona una conversación para ver todo el historial: lo que el cliente escribe,
                tus respuestas, los avisos automáticos del bot y los broadcasts masivos.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-6 max-w-md w-full">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-700/60">
                  <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-[11px] text-slate-300 font-semibold">Mensajes del cliente</span>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-700/60">
                  <CheckCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-[11px] text-slate-300 font-semibold">Tus envíos con estado</span>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-700/60">
                  <MapPinned className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <span className="text-[11px] text-slate-300 font-semibold">Pedidos de ubicación</span>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-700/60">
                  <Megaphone className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  <span className="text-[11px] text-slate-300 font-semibold">Broadcasts 📢</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Cabecera del chat */}
              <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-700/70 bg-slate-800 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setTelActivo(null)}
                  className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                  title="Volver"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <AvatarChat tel={convActiva.tel} nombre={convActiva.nombre} grande />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-black text-white truncate">{convActiva.nombre}</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-400 font-mono">+{telCompleto(convActiva.tel)}</span>
                    {convActiva.silenciado ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 font-bold">
                        <BellOff className="w-2.5 h-2.5" /> Bot silenciado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-bold">
                        <Radio className="w-2.5 h-2.5" /> Bot activo
                      </span>
                    )}
                  </div>
                </div>
                {/* Acciones rápidas */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={pedirUbicacion}
                    className="p-2 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-colors"
                    title="📍 Pedir ubicación (el bot le pide su ubicación al cliente)"
                  >
                    <MapPinned className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={enviarYape}
                    className="p-2 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                    title="💰 Enviar QR de Yape"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleSilencio}
                    className={`p-2 rounded-xl border transition-colors ${
                      convActiva.silenciado
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                        : 'bg-slate-700/40 text-slate-300 border-slate-600 hover:bg-slate-700'
                    }`}
                    title={convActiva.silenciado ? '🔔 Reactivar bot para este cliente' : '🔇 Silenciar bot para este cliente'}
                  >
                    {convActiva.silenciado ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mensajes */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-3 bg-slate-900/40">
                {mensajesAgrupados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                    <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
                    <div className="text-sm font-semibold text-slate-400">Sin mensajes aún</div>
                    <div className="text-xs mt-1">Escribe el primero o pídele su ubicación al cliente</div>
                  </div>
                ) : (
                  mensajesAgrupados.map((g, gi) => (
                    <div key={gi}>
                      <SeparadorDia etiqueta={g.dia} />
                      {g.mensajes.map((m) => (
                        <BurbujaMensaje
                          key={m.id}
                          m={{
                            ...m,
                            nombreCampana: m.nombreCampana ? nombreCampana.get(m.nombreCampana) || m.nombreCampana : undefined,
                          }}
                          desconocido={convActiva.nombre.startsWith('Cliente ')}
                          revelado={reveladas.has(m.id)}
                          onRevelar={() => setReveladas((s) => new Set(s).add(m.id))}
                          onVerImagen={(mm) => setLightbox({ base64: mm.base64!, mimetype: mm.mimetype || 'image/jpeg', nombre: mm.nombreArchivo || 'imagen.jpg' })}
                          onEliminar={() => m.borrableDocId && borrarMensaje(m.borrableDocId)}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>

              {/* Barra de emojis */}
              {emojiAbierto && (
                <div className="p-2 border-t border-slate-700/70 bg-slate-900/80 flex-shrink-0">
                  <div className="grid grid-cols-10 gap-1">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => insertarEmoji(e)}
                        className="w-8 h-8 rounded-lg hover:bg-slate-700 text-lg flex items-center justify-center transition-colors"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Menú de adjuntos */}
              {menuAdjuntos && (
                <div className="p-2 border-t border-slate-700/70 bg-slate-900/80 flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => { setMenuAdjuntos(false); inputImgRef.current?.click(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 border border-slate-600 hover:border-emerald-500/50 text-xs font-bold text-slate-200 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-400" /> Imagen
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuAdjuntos(false); inputDocRef.current?.click(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 border border-slate-600 hover:border-sky-500/50 text-xs font-bold text-slate-200 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-sky-400" /> Documento (máx 700 KB)
                  </button>
                </div>
              )}

              {/* Barra de escritura */}
              <div className="flex items-end gap-1.5 p-2.5 border-t border-slate-700/70 bg-slate-800 flex-shrink-0">
                <input
                  ref={inputImgRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { manejarArchivo(e.target.files?.[0], 'imagen'); e.currentTarget.value = ''; }}
                />
                <input
                  ref={inputDocRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => { manejarArchivo(e.target.files?.[0], 'documento'); e.currentTarget.value = ''; }}
                />
                <button
                  type="button"
                  onClick={() => { setEmojiAbierto((v) => !v); setMenuAdjuntos(false); }}
                  className={`p-2.5 rounded-xl transition-colors ${emojiAbierto ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                  title="Emojis"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuAdjuntos((v) => !v); setEmojiAbierto(false); }}
                  className={`p-2.5 rounded-xl transition-colors ${menuAdjuntos ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                  title="Adjuntar"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
                  }}
                  rows={1}
                  placeholder="Escribe un mensaje…"
                  className="flex-1 resize-none px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 max-h-28 custom-scrollbar"
                />
                <button
                  type="button"
                  onClick={enviar}
                  disabled={!texto.trim() || enviando}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
                  title="Enviar"
                >
                  {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ LIGHTBOX ═══ */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={`data:${lightbox.mimetype};base64,${lightbox.base64}`}
            alt={lightbox.nombre}
            className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => descargarBase64(lightbox.base64, lightbox.mimetype, lightbox.nombre)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
            >
              <Download className="w-4 h-4" /> Descargar
            </button>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold border border-slate-600 transition-colors"
            >
              <X className="w-4 h-4" /> Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
