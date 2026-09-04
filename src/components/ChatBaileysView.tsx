// ═══════════════════════════════════════════════════════════
// 🤖 CHAT BAILEYS VIEW — RiderTrack V2 (Fase 3.1 · 3.3)
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
//                            (+ notas de voz 🎙️ Fase 3.3)
//
// FASE 3.22:
//   ✅ FICHA DEL CLIENTE EN EL CHAT — sin salir de la conversación ves
//      la posición del cliente en la ruta de hoy (3/12), su dirección,
//      el producto y el monto por cobrar. Tira colapsable bajo la
//      cabecera (abre sola en pantallas anchas, 1 línea en el móvil).
//      En VIVO: se actualiza al momento cuando marcas entregado/pagado
//      desde RutaView. Insignia 📍 3/12 · S/ x en cada conversación de
//      la lista, con color según estado (ámbar pendiente, verde pagado,
//      rojo fallido). UNA sola suscripción a ruta_activa alimenta todo.
//
// FASE 3.8:
//   ✅ Gracias por tu compra por la VÍA DEL ROBOT (avisar_entrega
//      con enviar_imagen — igual que el Control de la v1): el bot
//      manda SU tarjeta real con imagen + el mensajito de Fabiana.
//      Antes la app mandaba su propia imagen embebida y llegaba el
//      logo equivocado. También la opción "solo texto" de la v1.
//   ✅ FIX grupo MATE: payload con grupoId + estado (idéntico a la
//      v1) — antes el bot marcaba el doc como procesado sin enviar.
//
// FASE 3.6:
//   ✅ botones rápidos en MENÚ DESGLOSABLE — una pastilla "⚡ Rápido"
//      abre un menú flotante (mismo estilo que el ⋮ de la cabecera)
//      con Gracias + plantillas conectadas. Antes: tira de chips.
//
// FASE 3.3:
//   ✅ fotos de perfil REALES de WhatsApp por conversación
//   ✅ fondo del chat personalizable (como WhatsApp)
//   ✅ notas de voz (grabar → bot → PTT)
//   ✅ botones rápidos (Gracias con imagen + plantillas conectadas)
//   ✅ fijar chat / borrar chat
//   ✅ conversación del Grupo MATE (trabajo)
//   ✅ cabecera responsive (menú ⋮ — ya no se montan los botones)
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
  Mic,
  MoreVertical,
  Pin,
  Palette,
  Users,
  AtSign,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  Home,
  Package,
  Wallet,
  Navigation,
  Camera,
  PhoneCall,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  Conversacion,
  MensajeChat,
  CampanaBot,
  ChatStats,
  colorAvatar,
  horaCorta,
  etiquetaDia,
  suscribirChat,
  suscribirCampanas,
  enviarMensajeChat,
  enviarAdjuntoChat,
  pedirUbicacionBot,
  enviarYapeQRChat,
  enviarPlinQRChat,
  observarPresenciaChat,
  suscribirPresenciaChat,
  presenciaViva,
  PresenciaChat,
  silenciarBot,
  reactivarBot,
  marcarLeidoChat,
  eliminarMensajeChat,
  comprimirImagen,
  leerDocumento,
  descargarBase64,
  telCompleto,
  telKey,
  TEL_GRUPO_MATE,
  enviarAGrupoMate,
  enviarGraciasBot,
  MENSAJE_GRACIAS_BOT,
  avisarSiguienteBot,
  avisarPosicionBot,
  calcularPosicionRuta,
  suscribirEstadoGrupo,
  estadoGrupoVivo,
  EstadoGrupo,
  iniciarGrabacionAudio,
  enviarAudioNotaChat,
  leerAudiosLocales,
  leerImagenesLocales,
  AudioLocal,
  ImagenLocal,
  leerFijados,
  toggleFijado,
  FONDOS_CHAT_PRESET,
  leerFondoChat,
  guardarFondoChat,
  FondoChat,
  borrarChatCompleto,
  borrarChatGrupo,
  estadoTicks,
  suscribirRutaClientes,
  InfoClienteRuta,
  stColorRuta,
} from '../utils/chatBaileys';
import { sonarMensaje } from '../services/notificaciones';
// 🙏 F3.44: guard anti-doble-envío del "gracias por tu compra"
import { claveAviso, registrarAvisoEnviado } from '../utils/avisoEntrega';
import {
  escucharPlantillas,
  PlantillaMensaje,
  formatearWhatsAppHTML,
  procesarBloquesPreview,
} from '../utils/botControl';

interface ChatBaileysViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  /** Fase 3.17: teléfono (o 'GRUPO_MATE') del chat a abrir al montar —
   *  llega del aviso flotante o de la campanita del header */
  abrirChatTel?: string;
  /** Fase 3.17: la vista ya abrió el chat pedido (App limpia el pendiente) */
  onAbrirChatConsumido?: () => void;
  /** Fase 3.17: reporta qué chat está abierto (para no avisar lo que ya ves) */
  onActiveChatChange?: (tel: string | null) => void;
}

const EMOJIS = ['😊', '😂', '👍', '🙏', '❤️', '🎉', '✅', '🔥', '👌', '😅', '🤝', '💪', '🚀', '📍', '📦', '💰', '⏰', '🙌', '😉', '🥳', '😎', '🤗', '☕', '🍀', '⚡', '🎁', '📸', '👏', '🫡', '🤖'];

/** Duración máxima de una nota de voz (segundos) */
const MAX_SEG_AUDIO = 120;

// ─────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────

/** Avatar con FOTO REAL de WhatsApp (si existe) + fallback a inicial */
const AvatarChat: React.FC<{
  tel: string;
  nombre: string;
  grande?: boolean;
  foto?: string;
  grupo?: boolean;
}> = ({ tel, nombre, grande, foto, grupo }) => {
  const [rota, setRota] = useState(false);
  const c = colorAvatar(tel || 'x');
  const inicial = (nombre || '?').charAt(0).toUpperCase();

  if (grupo) {
    return (
      <div
        className={`${grande ? 'w-11 h-11' : 'w-10 h-10'} rounded-full flex items-center justify-center flex-shrink-0 shadow-inner select-none bg-gradient-to-br from-emerald-500 to-teal-600 border border-emerald-400/40`}
      >
        <Users className={`${grande ? 'w-5 h-5' : 'w-4.5 h-4.5'} text-white`} />
      </div>
    );
  }

  if (foto && !rota) {
    return (
      <img
        src={foto}
        alt={nombre}
        onError={() => setRota(true)}
        referrerPolicy="no-referrer"
        className={`${grande ? 'w-11 h-11' : 'w-10 h-10'} rounded-full object-cover flex-shrink-0 shadow-md select-none bg-slate-700`}
      />
    );
  }

  return (
    <div
      className={`${grande ? 'w-11 h-11 text-base' : 'w-10 h-10 text-sm'} ${c.bg} ${c.texto} rounded-full flex items-center justify-center font-black flex-shrink-0 shadow-inner select-none`}
    >
      {inicial}
    </div>
  );
};

/**
 * Fase 3.18 — Ticks estilo WhatsApp con 4 estados (componente):
 * elige el icono según estadoTicks() — la lógica pura vive en
 * utils/chatBaileys.ts para poder testearla sin cargar la vista.
 */
const Ticks: React.FC<{ enviado: boolean | null; estadoWa?: 'delivered' | 'read' | null }> = ({
  enviado,
  estadoWa,
}) => {
  const estado = estadoTicks(enviado, estadoWa);
  if (estado === null) return null;
  if (estado === 'leido')
    return <CheckCheck className="w-3.5 h-3.5 text-sky-300 drop-shadow-[0_0_1px_rgba(56,189,248,.8)]" />;
  if (estado === 'entregado') return <CheckCheck className="w-3.5 h-3.5 text-emerald-100/90" />;
  if (estado === 'enviado') return <Check className="w-3.5 h-3.5 text-emerald-100/90" />;
  return <Clock className="w-3.5 h-3.5 text-emerald-100/70 animate-pulse" />;
};

const SeparadorDia: React.FC<{ etiqueta: string }> = ({ etiqueta }) => (
  <div className="flex justify-center my-3">
    <span className="px-3 py-1 rounded-full bg-slate-950/75 text-[10px] font-bold tracking-widest text-slate-300 border border-slate-700/60 backdrop-blur-sm">
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
        className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-slate-950/70 rounded-b-xl transition-colors"
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
      className="flex items-center gap-3 w-56 max-w-full p-2.5 rounded-xl bg-slate-950/60 border border-slate-600/40 hover:border-slate-500/60 transition-colors text-left"
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

/**
 * 🆕 F3.23 — @ARROBAS del grupo: pinta el texto reemplazando los
 * "@51987654321" crudos de WhatsApp por píldoras bonitas con el
 * nombre ("@Lourdes"), igual que se ven en WhatsApp.
 */
const TextoConMenciones: React.FC<{ texto: string; menciones?: { jid: string; nombre: string }[] }> = ({ texto, menciones }) => {
  if (!texto) return null;
  if (!menciones || !menciones.length) {
    return <span className="text-sm whitespace-pre-wrap break-words">{texto}</span>;
  }
  // construir los reemplazos: "@<número>" → píldora "@<nombre>"
  const reemplazos = menciones
    .map((men) => {
      const numero = String(men.jid || '').split('@')[0].replace(/\D/g, '');
      if (!numero) return null;
      return { buscar: '@' + numero, nombre: men.nombre || 'Miembro' };
    })
    .filter(Boolean) as { buscar: string; nombre: string }[];

  if (!reemplazos.length) {
    return <span className="text-sm whitespace-pre-wrap break-words">{texto}</span>;
  }

  // partir el texto por la primera mención que aparezca, en orden
  const partes: React.ReactNode[] = [];
  let resto = texto;
  let clave = 0;
  while (resto && reemplazos.length) {
    // la mención más temprana en el texto
    let mejor: { idx: number; rep: { buscar: string; nombre: string } } | null = null;
    for (const rep of reemplazos) {
      const idx = resto.indexOf(rep.buscar);
      if (idx >= 0 && (!mejor || idx < mejor.idx)) mejor = { idx, rep };
    }
    if (!mejor) break;
    if (mejor.idx > 0) partes.push(<span key={clave++}>{resto.slice(0, mejor.idx)}</span>);
    partes.push(
      <span
        key={clave++}
        className="text-emerald-300 bg-emerald-400/10 rounded px-1 font-semibold"
        title={mejor.rep.buscar}
      >
        @{mejor.rep.nombre}
      </span>
    );
    resto = resto.slice(mejor.idx + mejor.rep.buscar.length);
  }
  if (resto) partes.push(<span key={clave++}>{resto}</span>);

  return <span className="text-sm whitespace-pre-wrap break-words">{partes}</span>;
};

/** 🆕 F3.23 — color del nombre de quien escribe en el grupo (como WhatsApp) */
const colorNombreGrupo = (nombre: string): string => {
  const paleta = ['text-emerald-300', 'text-sky-300', 'text-violet-300', 'text-amber-300', 'text-rose-300', 'text-teal-300', 'text-orange-300'];
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
  return paleta[h % paleta.length];
};

/** Burbuja individual de mensaje */
const BurbujaMensaje: React.FC<BurbujaProps> = ({ m, desconocido, revelado, onRevelar, onVerImagen, onEliminar }) => {
  const esEntrante = m.origen === 'cliente';
  const esBot = m.origen === 'bot';
  const esAuto = m.origen === 'rudyAuto';
  const esCampana = m.origen === 'campana';

  const burbujaBase = esEntrante
    ? 'bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl rounded-tl-md'
    : esBot
      ? 'bg-emerald-800/90 border border-emerald-600/40 text-white rounded-2xl rounded-tr-md'
      : esAuto
        ? 'bg-emerald-700/80 border border-emerald-500/30 text-white rounded-2xl rounded-tr-md'
        : esCampana
          ? 'bg-teal-900/80 border border-teal-600/40 text-white rounded-2xl rounded-tr-md'
          : 'bg-emerald-600 text-white rounded-2xl rounded-tr-md';

  const esAudio = m.tipoContenido === 'audio' && (m.base64 || m.audioUrl);

  return (
    <div className={`flex ${esEntrante ? 'justify-start' : 'justify-end'} mb-2 group`}>
      <div className={`relative max-w-[85%] sm:max-w-[70%] px-3 py-2 shadow-lg ${burbujaBase}`}>
        {/* 🆕 F3.23 — quién escribió en el grupo (etiqueta de color, como WhatsApp) */}
        {esEntrante && m.tel === TEL_GRUPO_MATE && m.nombre && (
          <div className={`mb-0.5 text-[11px] font-bold ${colorNombreGrupo(m.nombre)}`}>{m.nombre}</div>
        )}
        {/* Etiqueta de origen para salientes especiales */}
        {esBot && (
          <div className="flex items-center gap-1 mb-1 text-[10px] font-bold text-emerald-200/90 uppercase tracking-wide">
            <Bot className="w-3 h-3" /> Bot · {(m.accionBot || '').replace(/_/g, ' ')}
          </div>
        )}
        {esAuto && (
          <div className="flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded bg-slate-950/60 w-fit text-[10px] font-bold text-white uppercase tracking-wide">
            <Bot className="w-3 h-3 text-emerald-300" /> Bot · respondió solo
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
        ) : m.tipoContenido === 'imagen' && (m.base64 || m.imageUrl) ? (
          <div className="space-y-1.5">
            <div className="relative">
              <img
                src={m.base64 ? `data:${m.mimetype || 'image/jpeg'};base64,${m.base64}` : m.imageUrl}
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
        ) : esAudio ? (
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-emerald-500/25 border border-emerald-300/30 flex items-center justify-center flex-shrink-0">
              <Mic className="w-4 h-4" />
            </span>
            <audio
              controls
              preload="metadata"
              src={m.audioUrl ? m.audioUrl : `data:${m.mimetype || 'audio/ogg'};base64,${m.base64}`}
              className="max-w-[200px] h-9"
            />
          </div>
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
        ) : m.tipoContenido === 'plin_qr' ? (
          <div className="flex items-center gap-2 py-0.5">
            <span className="w-8 h-8 rounded-lg bg-cyan-500/30 border border-cyan-300/40 flex items-center justify-center text-base">💚</span>
            <div className="flex flex-col">
              <span className="text-sm font-bold">QR de Plin</span>
              <span className="text-[10px] opacity-80">El bot envía tu QR de Plin con plantilla</span>
            </div>
          </div>
        ) : (
          <TextoConMenciones texto={m.texto} menciones={m.menciones} />
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
          {!esEntrante && <Ticks enviado={m.enviado} estadoWa={m.estadoWa} />}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// FASE 3.22 — FICHA DEL CLIENTE EN EL CHAT
// Tira viva entre la cabecera y los mensajes: posición en la
// ruta, dirección, producto y monto. Colapsable a 1 línea para
// que no coma espacio en pantallas chicas.
// ═══════════════════════════════════════════════════════════

const TarjetaRutaCliente: React.FC<{
  info: InfoClienteRuta;
  /** colapsada por defecto en pantallas chicas */
}> = ({ info }) => {
  const [abierta, setAbierta] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 640 : true));
  const color = stColorRuta(info.estado);
  const colorChip =
    color === 'pagado'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      : color === 'fallido'
        ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
        : color === 'otro'
          ? 'bg-slate-500/15 text-slate-300 border-slate-500/40'
          : 'bg-amber-500/15 text-amber-300 border-amber-500/40';
  const dot =
    color === 'pagado' ? 'bg-emerald-400' : color === 'fallido' ? 'bg-rose-400' : color === 'otro' ? 'bg-slate-400' : 'bg-amber-400';
  const borde =
    color === 'pagado' ? 'border-emerald-500/40' : color === 'fallido' ? 'border-rose-500/40' : color === 'otro' ? 'border-slate-500/40' : 'border-amber-500/40';
  const monto = info.cobrar > 0 ? `S/ ${parseFloat(String(info.cobrar)).toFixed(2)}` : null;

  return (
    <div className={`flex-shrink-0 mx-2 sm:mx-3 mt-2 rounded-xl border overflow-hidden ${borde} bg-slate-900/70 backdrop-blur-sm`}>
      {/* Fila 1 — siempre visible: posición + estado + toggle */}
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-800/40 transition-colors"
        title={abierta ? 'Ocultar detalle de la ruta' : 'Ver dirección, producto y monto'}
      >
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <Navigation className={`w-3.5 h-3.5 ${color === 'pagado' ? 'text-emerald-400' : color === 'fallido' ? 'text-rose-400' : 'text-amber-400'}`} />
          <span className="text-[11px] font-black text-white tabular-nums">
            {info.posicion}/{info.total}
          </span>
        </span>
        <span className="text-[11px] text-slate-400 flex-shrink-0">en la ruta</span>
        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${colorChip}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          {info.estadoTexto}
        </span>
        <span className="flex-1" />
        {monto && !abierta && (
          <span className="text-[11px] font-black text-emerald-300 tabular-nums flex-shrink-0">{monto}</span>
        )}
        {abierta ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
      </button>

      {/* Detalle — dirección · producto · monto · contexto */}
      {abierta && (
        <div className="px-3 pb-2 pt-0.5 flex flex-col gap-1">
          {info.dir ? (
            <div className="flex items-start gap-2 text-[11px] text-slate-300 leading-snug">
              <Home className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-[1px]" />
              <span className="break-words min-w-0">
                {info.dir}
                {info.dist ? <span className="text-slate-500"> · {info.dist}</span> : null}
              </span>
            </div>
          ) : null}
          {info.prod ? (
            <div className="flex items-start gap-2 text-[11px] text-slate-300 leading-snug">
              <Package className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-[1px]" />
              <span className="break-words min-w-0">{info.prod}</span>
            </div>
          ) : null}
          {monto ? (
            <div className="flex items-center gap-2 text-[11px] text-slate-300">
              <Wallet className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="font-black text-emerald-300 tabular-nums">{monto}</span>
              <span className="text-slate-500">por cobrar</span>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5 flex-wrap">
            <span className="tabular-nums">{info.entregados} de {info.total} listos</span>
            <span>·</span>
            <span>
              {info.faltanAntes === 0
                ? 'eres el siguiente 🎯'
                : `faltan ${info.faltanAntes} entrega${info.faltanAntes === 1 ? '' : 's'} antes`}
            </span>
            {info.nombreRuta ? (
              <>
                <span>·</span>
                <span className="truncate max-w-[140px]">{info.nombreRuta}</span>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

/** Item de la lista de conversaciones */
const ItemConversacion: React.FC<{
  conv: Conversacion;
  activo: boolean;
  fijado: boolean;
  /** Fase 3.22 — insignia viva de la ruta (posición · monto) */
  infoRuta?: InfoClienteRuta;
  onAbrir: () => void;
}> = ({ conv, activo, fijado, infoRuta, onAbrir }) => {
  const ultimo = conv.ultimoMensaje;
  const prefijo = !ultimo
    ? ''
    : ultimo.origen === 'rudy' || ultimo.origen === 'rudyAuto'
      ? 'Tú: '
      : ultimo.origen === 'bot'
        ? '🤖 '
        : ultimo.origen === 'campana'
          ? '📢 '
          : '';
  const preview =
    !ultimo
      ? conv.esGrupo
        ? 'Aún no hay reportes del bot'
        : 'Sin mensajes'
      : ultimo.tipoContenido === 'imagen'
        ? '📷 Imagen'
        : ultimo.tipoContenido === 'audio'
          ? '🎙️ Nota de voz'
          : ultimo.tipoContenido === 'documento'
            ? '📄 Documento'
            : ultimo.tipoContenido === 'ubicacion'
              ? '📍 Ubicación'
              : ultimo.tipoContenido === 'yape_qr'
                ? '💰 QR de Yape'
                : ultimo.tipoContenido === 'plin_qr'
                  ? '💚 QR de Plin'
                  : ultimo.texto;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
        activo ? 'bg-emerald-600/15 border border-emerald-500/40' : 'border border-transparent hover:bg-slate-800/60'
      }`}
    >
      <div className="relative flex-shrink-0">
        <AvatarChat tel={conv.tel} nombre={conv.nombre} foto={conv.foto} grupo={conv.esGrupo} />
        {conv.noLeidos > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-slate-900">
            {conv.noLeidos > 99 ? '99+' : conv.noLeidos}
          </span>
        )}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm truncate flex items-center gap-1 ${conv.noLeidos > 0 ? 'font-black text-white' : 'font-semibold text-slate-200'}`}>
            <span className="truncate">{conv.nombre}</span>
            {fijado && <Pin className="w-3 h-3 text-emerald-400 flex-shrink-0 rotate-45" />}
          </span>
          <span className="text-[10px] text-slate-500 flex-shrink-0">{horaCorta(conv.ultimoTimestamp)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {conv.silenciado && <BellOff className="w-3 h-3 text-amber-500 flex-shrink-0" />}
          {conv.esGrupo && <Users className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
          {/* Fase 3.18 — mini-ticks junto al último mensaje tuyo (como WhatsApp) */}
          {ultimo && (ultimo.origen === 'rudy') && (
            <span className="flex-shrink-0">
              {estadoTicks(ultimo.enviado, ultimo.estadoWa) === 'leido' ? (
                <CheckCheck className="w-3 h-3 text-sky-400" />
              ) : estadoTicks(ultimo.enviado, ultimo.estadoWa) === 'entregado' ? (
                <CheckCheck className="w-3 h-3 text-slate-500" />
              ) : estadoTicks(ultimo.enviado, ultimo.estadoWa) === 'enviado' ? (
                <Check className="w-3 h-3 text-slate-500" />
              ) : (
                <Clock className="w-3 h-3 text-slate-500" />
              )}
            </span>
          )}
          <span className={`text-xs truncate ${conv.noLeidos > 0 ? 'font-semibold text-slate-300' : 'text-slate-500'}`}>
            {prefijo}{preview}
          </span>
          {/* Fase 3.22 — insignia viva de la ruta: posición · monto */}
          {infoRuta && (
            <span
              className={`ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${
                stColorRuta(infoRuta.estado) === 'pagado'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                  : stColorRuta(infoRuta.estado) === 'fallido'
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40'
                    : stColorRuta(infoRuta.estado) === 'otro'
                      ? 'bg-slate-500/15 text-slate-300 border border-slate-500/40'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
              }`}
              title={`Posición ${infoRuta.posicion} de ${infoRuta.total} en la ruta · ${infoRuta.estadoTexto}${infoRuta.dir ? ` · ${infoRuta.dir}` : ''}${infoRuta.prod ? ` · ${infoRuta.prod}` : ''}${infoRuta.cobrar > 0 ? ` · S/ ${parseFloat(String(infoRuta.cobrar)).toFixed(2)}` : ''}`}
            >
              <MapPin className="w-2.5 h-2.5" />
              <span className="tabular-nums">{infoRuta.posicion}/{infoRuta.total}</span>
              {infoRuta.cobrar > 0 && (
                <span className="tabular-nums opacity-80">· S/ {parseFloat(String(infoRuta.cobrar)).toFixed(0)}</span>
              )}
            </span>
          )}
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

/** Llena las variables de una plantilla con los datos del cliente real */
function llenarVariables(texto: string, nombre: string): string {
  const ahora = new Date();
  return texto
    .split('{nombre}').join(nombre || 'cliente')
    .split('{hora}').join(ahora.getHours().toString().padStart(2, '0') + ':' + ahora.getMinutes().toString().padStart(2, '0'))
    .split('{fecha}').join(ahora.toLocaleDateString('es-PE'));
}

export const ChatBaileysView: React.FC<ChatBaileysViewProps> = ({
  onShowToast,
  abrirChatTel,
  onAbrirChatConsumido,
  onActiveChatChange,
}) => {
  const { user, profile } = useAuth();

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
  // 🆕 F3.56 — menú de llamada (📞 en la cabecera del chat)
  const [menuLlamada, setMenuLlamada] = useState(false);
  const [reveladas, setReveladas] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ base64?: string; mimetype?: string; nombre: string; url?: string } | null>(null);

  // ── Fase 3.3 ──
  const [fijados, setFijados] = useState<Set<string>>(() => leerFijados());
  const [fondo, setFondo] = useState<FondoChat>(() => leerFondoChat());
  const [menuChat, setMenuChat] = useState(false);          // menú ⋮ del chat abierto
  const [panelFondo, setPanelFondo] = useState(false);      // selector de fondo
  const [confirmBorrar, setConfirmBorrar] = useState(false);// confirmar borrar chat
  const [borrando, setBorrando] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaMensaje[]>([]);
  const [rapidoAbierto, setRapidoAbierto] = useState<{ tipo: 'gracias' | 'gracias_texto' | 'plantilla' | 'eta' | 'posicion' | 'afuera'; plantilla?: PlantillaMensaje } | null>(null);
  const [enviandoRapido, setEnviandoRapido] = useState(false);
  const [menuRapidos, setMenuRapidos] = useState(false);  // menú desglosable ⚡ (Fase 3.6)
  const [rapidoMinutos, setRapidoMinutos] = useState(15);  // ETA editable (Fase 3.7)
  const [rapidoPosicion, setRapidoPosicion] = useState(3); // posición editable (Fase 3.7)
  // Fase 3.9 — estado del grupo MATE (heartbeat del parche del bot)
  const [estadoGrupo, setEstadoGrupo] = useState<EstadoGrupo | null>(null);
  // 🆕 F3.33 — por qué no hay datos: 'PERMISSION_DENIED' (reglas sin
  // publicar) / 'sin-conexion' / null (todo bien, solo falta el latido)
  const [errorEstadoGrupo, setErrorEstadoGrupo] = useState<string | null>(null);
  // 🆕 F3.23 — picker de @menciones del grupo (botón @ en el input)
  const [pickerArroba, setPickerArroba] = useState(false);
  const [buscaMiembro, setBuscaMiembro] = useState('');
  // Fase 3.20 — presencia «escribiendo…» del cliente del chat abierto
  const [presencia, setPresencia] = useState<PresenciaChat | null>(null);
  // Fase 3.22 — ficha viva de la ruta: t9 → posición/dirección/producto/monto
  const [mapaRuta, setMapaRuta] = useState<Map<string, InfoClienteRuta>>(new Map());

  // ── Grabación de nota de voz ──
  const [grabando, setGrabando] = useState(false);
  const [grabSeg, setGrabSeg] = useState(0);
  const [enviandoAudio, setEnviandoAudio] = useState(false);
  const grabadorRef = useRef<{ parar: () => Promise<{ blob: Blob; mimetype: string; duracionSeg: number }>; cancelar: () => void } | null>(null);
  const timerGrabRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [audiosLocales, setAudiosLocales] = useState<AudioLocal[]>(() => leerAudiosLocales());
  const [imagenesLocales, setImagenesLocales] = useState<ImagenLocal[]>(() => leerImagenesLocales());

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputImgRef = useRef<HTMLInputElement>(null);
  const inputDocRef = useRef<HTMLInputElement>(null);
  // 🆕 F3.56 — cámara directa: input oculto con capture="environment"
  // (abre la cámara del celu SIN pasar por la galería)
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const inputFondoRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuRapidosRef = useRef<HTMLDivElement>(null);
  // 🆕 F3.56 — contenedor del popover de llamada (para cerrar al tocar afuera)
  const menuLlamadaRef = useRef<HTMLDivElement>(null);

  // ── Suscripciones en tiempo real ──
  useEffect(() => {
    let sinLeerPrevio = -1; // -1 = primera carga (no beep)
    const sub = suscribirChat((convs, st) => {
      setConversaciones(convs);
      setStats(st);
      // 🔔 Fase 3.14: beep cuando LLEGA un mensaje nuevo de un cliente
      // (solo si subió la cantidad de sin leer y no es la primera carga)
      if (sinLeerPrevio >= 0 && st.noLeidos > sinLeerPrevio) {
        sonarMensaje();
      }
      sinLeerPrevio = st.noLeidos;
    });
    const unsubCampanas = suscribirCampanas(setCampanas);
    const unsubPlantillas = escucharPlantillas(setPlantillas, (e) =>
      console.warn('[ChatBaileys] plantillas:', e.message)
    );
    const unsubEstadoGrupo = suscribirEstadoGrupo((e, err) => {
      setEstadoGrupo(e);
      setErrorEstadoGrupo(err || null);
    });
    // Fase 3.22 — UNA suscripción a ruta_activa alimenta la insignia de la
    // lista y la ficha del chat abierto (se actualiza al marcar entregado)
    const unsubRutaClientes = suscribirRutaClientes((mapa) => setMapaRuta(mapa));
    return () => { sub.cancelar(); unsubCampanas(); unsubPlantillas(); unsubEstadoGrupo(); unsubRutaClientes(); };
  }, []);

  // ── Marcar leído al abrir un chat (y cerrar el menú de rápidos) ──
  useEffect(() => {
    if (telActivo) marcarLeidoChat(telActivo);
    setMenuRapidos(false);
  }, [telActivo]);

  // ── Fase 3.20: «escribiendo…» — pedirle al bot que vigile la
  //    presencia del chat abierto y escuchar lo que reporta ──
  useEffect(() => {
    setPresencia(null);
    if (!telActivo || telActivo === TEL_GRUPO_MATE) return undefined;
    observarPresenciaChat(telActivo);
    const unsub = suscribirPresenciaChat(telActivo, setPresencia);
    return () => { try { unsub(); } catch { /* noop */ } };
  }, [telActivo]);

  // La presencia «viva» caduca sola a los 30 s sin eventos nuevos
  // (revisión por segundo — barata y sin dependencias)
  const [ahoraTick, setAhoraTick] = useState(Date.now());
  useEffect(() => {
    if (!presencia || presencia.estado !== 'composing') return undefined;
    const t = setInterval(() => setAhoraTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [presencia]);
  const clienteEscribiendo = useMemo(
    () => presenciaViva(presencia, ahoraTick),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presencia, ahoraTick]
  );

  // ── Fase 3.17: abrir el chat pedido por el aviso/campanita ──
  useEffect(() => {
    if (!abrirChatTel) return;
    if (telActivo === abrirChatTel) {
      onAbrirChatConsumido?.();
      return;
    }
    // El chat puede tardar un instante en llegar (Firestore) — se abre
    // igual: el tel queda activo y los mensajes llegan al suscribirse.
    setTelActivo(abrirChatTel);
    setMenuChat(false);
    setEmojiAbierto(false);
    setMenuAdjuntos(false);
    onAbrirChatConsumido?.();
  }, [abrirChatTel]);

  // ── Fase 3.17: reportar el chat abierto (avisos globales) ──
  useEffect(() => {
    onActiveChatChange?.(telActivo);
  }, [telActivo, onActiveChatChange]);

  // ── Cerrar el menú ⋮ al hacer clic fuera ──
  useEffect(() => {
    if (!menuChat) return;
    const cerrar = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuChat(false);
    };
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('touchstart', cerrar);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('touchstart', cerrar);
    };
  }, [menuChat]);

  // ── Cerrar el menú de rápidos al hacer clic fuera (Fase 3.6) ──
  useEffect(() => {
    if (!menuRapidos) return;
    const cerrar = (ev: MouseEvent) => {
      if (menuRapidosRef.current && !menuRapidosRef.current.contains(ev.target as Node)) setMenuRapidos(false);
    };
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('touchstart', cerrar);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('touchstart', cerrar);
    };
  }, [menuRapidos]);

  // 🆕 F3.56 — cerrar el menú de llamada al hacer clic fuera
  useEffect(() => {
    if (!menuLlamada) return;
    const cerrar = (ev: MouseEvent) => {
      if (menuLlamadaRef.current && !menuLlamadaRef.current.contains(ev.target as Node)) setMenuLlamada(false);
    };
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('touchstart', cerrar);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('touchstart', cerrar);
    };
  }, [menuLlamada]);

  const convActiva = useMemo(
    () => conversaciones.find((c) => c.tel === telActivo) || null,
    [conversaciones, telActivo]
  );

  // Fase 3.22 — ficha de ruta del chat abierto (null si no está en la ruta
  // de hoy o es el grupo: no se pinta nada, el chat queda idéntico)
  const infoRutaActiva = useMemo(
    () => (!convActiva || convActiva.esGrupo ? undefined : mapaRuta.get(convActiva.tel)),
    [convActiva, mapaRuta]
  );

  // ── Mensajes + historial local de notas de voz e imágenes (merge) ──
  const mensajesConv = useMemo(() => {
    if (!convActiva) return [];
    const urlsVivas = new Set(convActiva.mensajes.filter((m) => m.audioUrl || m.imageUrl).map((m) => m.audioUrl || m.imageUrl));
    const historial = audiosLocales
      .filter((a) => a.tel === convActiva.tel && !urlsVivas.has(a.url))
      .map<MensajeChat>((a) => ({
        id: 'al_' + a.ts,
        tel: a.tel,
        origen: 'rudy',
        tipoContenido: 'audio',
        texto: '🎙️ Nota de voz',
        timestamp: a.ts,
        leido: true,
        enviado: true,
        audioUrl: a.url,
      }));
    const historialImg = imagenesLocales
      .filter((a) => a.tel === convActiva.tel && !urlsVivas.has(a.url))
      .map<MensajeChat>((a) => ({
        id: 'il_' + a.ts,
        tel: a.tel,
        origen: 'rudy',
        tipoContenido: 'imagen',
        texto: a.texto || '📷 Imagen',
        timestamp: a.ts,
        leido: true,
        enviado: true,
        imageUrl: a.url,
      }));
    return [...convActiva.mensajes, ...historial, ...historialImg];
  }, [convActiva, audiosLocales, imagenesLocales]);

  // ── Auto-scroll al último mensaje (Fase 3.18: inteligente) ──
  // Solo baja solo si estabas cerca del final (como WhatsApp): si
  // subiste a leer historial, un mensaje nuevo NO te salta el scroll.
  // 🆕 F3.23: al CAMBIAR de chat baja siempre — antes, si la
  // conversación ya tenía mensajes, el efecto veía "estás arriba"
  // y no bajaba: abrías un chat y te mostraba el INICIO del
  // historial en vez de lo último (bug).
  // 🆕 F3.33: "pegado abajo". El efecto corría ANTES de que la
  // conversación cargara sus mensajes (conexión lenta: el snapshot
  // de Firestore tarda) → bajaba el scroll de una lista VACÍA (nada)
  // y cuando por fin llegaban los mensajes ya no bajaba porque
  // estabas "arriba". Ahora, al abrir un chat, el scroll se queda
  // PEGADO abajo hasta que el contenido llegue de verdad.
  const telAnteriorRef = useRef<string | null>(null);
  const pegadoAbajoRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cambioDeChat = telAnteriorRef.current !== telActivo;
    if (cambioDeChat) {
      telAnteriorRef.current = telActivo;
      pegadoAbajoRef.current = true; // nuevo chat: pegarse abajo hasta que cargue
    }
    const cercaDelFinal = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (pegadoAbajoRef.current || cercaDelFinal || mensajesConv.length === 0) {
      el.scrollTop = el.scrollHeight;
      // El chat queda pegado mientras no haya contenido; cuando ya hay
      // mensajes, se confirma en el frame siguiente que quedamos abajo
      // y se suelta (recuperando el comportamiento WhatsApp normal).
      if (mensajesConv.length > 0) {
        requestAnimationFrame(() => {
          const el2 = scrollRef.current;
          if (el2 && el2.scrollHeight - el2.scrollTop - el2.clientHeight < 200) {
            pegadoAbajoRef.current = false;
          }
        });
      }
    }
  }, [mensajesConv.length, telActivo]);

  // ── Mapa campaign_id → nombre ──
  const nombreCampana = useMemo(() => {
    const m = new Map<string, string>();
    campanas.forEach((c) => m.set(c.id, c.nombre));
    return m;
  }, [campanas]);

  // ── Plantillas conectadas para los botones rápidos ──
  const plantillasConectadas = useMemo(
    () => plantillas.filter((p) => p.activa && p.clave).slice(0, 10),
    [plantillas]
  );

  // ── Filtrado y orden de la lista (grupo → fijados → resto) ──
  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtradas = conversaciones.filter((c) => {
      if (filtro === 'noLeidos' && c.noLeidos === 0) return false;
      if (filtro === 'silenciados' && !c.silenciado) return false;
      if (q && !c.nombre.toLowerCase().includes(q) && !c.tel.toLowerCase().includes(q.replace(/\D/g, ''))) return false;
      return true;
    });
    return filtradas.sort((a, b) => {
      if (a.esGrupo) return -1;
      if (b.esGrupo) return 1;
      const fa = fijados.has(a.tel) ? 1 : 0;
      const fb = fijados.has(b.tel) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return b.ultimoTimestamp - a.ultimoTimestamp;
    });
  }, [conversaciones, filtro, busqueda, fijados]);

  // ── Acciones ──
  const toast = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') =>
    onShowToast?.(title, desc, type);

  const abrirChat = (tel: string) => {
    setTelActivo(tel);
    setMenuChat(false);
    setEmojiAbierto(false);
    setMenuAdjuntos(false);
    setGrabando(false);
  };

  const esGrupo = !!convActiva?.esGrupo;

  /** 🆕 F3.23 — insertar una @mención del grupo en el mensaje */
  const insertarArroba = (nombre: string) => {
    const bonito = nombre.replace(/\s+/g, ' ').trim();
    if (!bonito) return;
    setTexto((t) => (t ? (t.endsWith(' ') ? t : t + ' ') : '') + '@' + bonito + ' ');
    setPickerArroba(false);
    setBuscaMiembro('');
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !convActiva || enviando) return;
    setEnviando(true);
    try {
      if (esGrupo) {
        // ✍️ Escribir al grupo de trabajo MATE (el bot lo manda)
        await enviarAGrupoMate(t, {
          nombre: profile?.nombre || 'Rudy',
          telefono: profile?.email || '',
          empresa: 'MATE',
        });
        toast(
          '👥 Enviado al grupo',
          estadoGrupoVivo(estadoGrupo)
            ? 'El bot está escribiendo tu mensaje al grupo MATE'
            : 'En cola — el bot necesita el parche grupo_mate.js para escribir en el grupo',
          estadoGrupoVivo(estadoGrupo) ? 'success' : 'warning'
        );
      } else {
        await enviarMensajeChat(convActiva.tel, convActiva.nombre, t);
      }
      setTexto('');
      setEmojiAbierto(false);
    } catch (e: any) {
      toast('Error al enviar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setEnviando(false);
    }
  };

  // ── 🆕 F3.56 — LLAMADAS ──
  // a) Llamada telefónica directa: abre el marcador del celu con el
  //    número del cliente ya marcado (1 toque, como WhatsApp).
  // b) Abrir su chat en WhatsApp: de ahí se toca el botón de llamada /
  //    videollamada del propio WhatsApp. (Una llamada "de WhatsApp"
  //    desde la app NO es posible técnicamente: solo la app oficial
  //    de WhatsApp puede marcar llamadas — la librería Baileys del
  //    bot no tiene esa puerta. Estas dos vías son lo más cerca.)
  const llamarTelefono = () => {
    if (!convActiva || esGrupo) return;
    const t9 = telKey(convActiva.tel);
    if (!t9) { toast('Sin número', 'Esta conversación no tiene un teléfono válido', 'warning'); return; }
    setMenuLlamada(false);
    toast('📞 Abriendo el marcador…', 'Llamando a +' + telCompleto(t9) + ' desde tu teléfono', 'info');
    window.location.href = 'tel:+' + telCompleto(t9);
  };

  const abrirWhatsAppParaLlamar = () => {
    if (!convActiva || esGrupo) return;
    const t9 = telKey(convActiva.tel);
    if (!t9) { toast('Sin número', 'Esta conversación no tiene un teléfono válido', 'warning'); return; }
    setMenuLlamada(false);
    toast('🟢 Abriendo WhatsApp…', 'Ahí toca el botón de llamada o videollamada de WhatsApp', 'info');
    window.open('https://wa.me/' + telCompleto(t9), '_blank');
  };

  const pedirUbicacion = async () => {
    if (!convActiva || esGrupo) return;
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
    if (!convActiva || esGrupo) return;
    try {
      await enviarYapeQRChat(convActiva.tel, convActiva.nombre);
      toast('💰 QR de Yape', 'El bot enviará el QR de tu ruta activa', 'success');
    } catch (e: any) {
      toast('Error', e.message || 'No se pudo enviar el QR', 'error');
    }
  };

  const enviarPlin = async () => {
    if (!convActiva || esGrupo) return;
    try {
      await enviarPlinQRChat(convActiva.tel, convActiva.nombre);
      toast('💚 QR de Plin', 'El bot enviará tu QR de Plin con la plantilla (parche extras_chat.js)', 'success');
    } catch (e: any) {
      toast('Error', e.message || 'No se pudo enviar el QR', 'error');
    }
  };

  const toggleSilencio = async () => {
    if (!convActiva || esGrupo) return;
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

  const alternarFijado = () => {
    if (!convActiva) return;
    const ahoraFijado = toggleFijado(convActiva.tel);
    setFijados(leerFijados());
    setMenuChat(false);
    toast(
      ahoraFijado ? '📌 Chat fijado' : '📌 Fijado quitado',
      ahoraFijado ? 'Esta conversación se queda arriba de la lista' : 'La conversación vuelve a su orden normal',
      'info'
    );
  };

  const borrarChat = async () => {
    if (!convActiva) return;
    setBorrando(true);
    try {
      if (esGrupo) {
        // 🗑️ F3.23 — borrar el historial del GRUPO (antes no existía la
        // opción y "quise limpiar el del grupo pero nada")
        const res = await borrarChatGrupo();
        toast('🗑️ Grupo limpiado', `${res.entrantes + res.reportes} mensajes eliminados del grupo MATE — la conversación sigue en la lista`, 'success');
      } else {
        const res = await borrarChatCompleto(convActiva.tel);
        toast('🗑️ Chat borrado', `${res.entrantes + res.salientes} mensajes eliminados — la conversación desapareció de la lista`, 'success');
      }
      setTelActivo(null);
      setConfirmBorrar(false);
    } catch (e: any) {
      toast('Error al borrar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setBorrando(false);
    }
  };

  const manejarArchivo = async (file: File | undefined, tipo: 'imagen' | 'documento') => {
    if (!file || !convActiva || esGrupo) return;
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

  // ── Botones rápidos ──
  // Fase 3.8: el Gracias YA NO manda una imagen embebida de la app
  // (llegaba el logo equivocado — los archivos de imagenes_bot están
  // intercambiados). Copia EXACTA del Control de la v1: acción
  // avisar_entrega con enviar_imagen/modo_entrega → el ROBOT manda su
  // tarjeta real (mate_gracias) + el mensajito con contacto de Fabiana.
  const enviarGracias = async () => {
    if (!convActiva || enviandoRapido) return;
    const conImagen = rapidoAbierto?.tipo !== 'gracias_texto';
    setEnviandoRapido(true);
    try {
      await enviarGraciasBot(convActiva.tel, convActiva.nombre, conImagen, {
        nombre: profile?.nombre || 'Rudy',
        telefono: profile?.email || '',
        empresa: 'MATE',
      });
      // 🙏 F3.44: si justo después marcas entregado, el disparo
      // automático se calla 5 min (no le llega dos veces)
      registrarAvisoEnviado(claveAviso(convActiva.tel));
      toast(
        '🙏 Gracias enviada',
        conImagen
          ? 'El robot manda su tarjeta con imagen + el mensajito (como el Control de la v1)'
          : 'El robot manda el mensajito de gracias (solo texto)',
        'success'
      );
      setRapidoAbierto(null);
    } catch (e: any) {
      toast('Error al enviar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setEnviandoRapido(false);
    }
  };

  // Fase 3.7 — mensajes del rider con dato editable (ETA y posición)
  const textoRapidoRider = (): string => {
    if (!convActiva) return '';
    if (rapidoAbierto?.tipo === 'eta') {
      return `Hola ${convActiva.nombre} 👋 Ya salí con tu pedido 🛵\nLlego a tu domicilio en aprox. *${rapidoMinutos} minutos*.`;
    }
    if (rapidoAbierto?.tipo === 'posicion') {
      return `Hola ${convActiva.nombre} 📍 Voy en la *posición ${rapidoPosicion}* de mis entregas de hoy 📦\nEn cuanto sea tu turno te aviso 😉`;
    }
    if (rapidoAbierto?.tipo === 'afuera') {
      return `Hola ${convActiva.nombre} 🏁 *Ya llegué a tu domicilio* 🏠\nEstoy afuera, acércate cuando puedas 🙏`;
    }
    return '';
  };

  // Fase 3.9 — Voy en camino y Mi posición usan las PLANTILLAS DEL ROBOT
  // (acciones avisar_siguiente / avisar_posicion con imagen, copia exacta
  // del botón 🤖 de cada cliente de la v1). "Ya llegué" sigue siendo texto
  // tuyo (no hay plantilla del robot para esa).
  const enviarRapidoRider = async () => {
    if (!convActiva || enviandoRapido) return;
    setEnviandoRapido(true);
    try {
      const rider = {
        nombre: profile?.nombre || 'Rudy',
        telefono: profile?.email || '',
        empresa: 'MATE',
      };
      if (rapidoAbierto?.tipo === 'eta') {
        await avisarSiguienteBot(convActiva.tel, convActiva.nombre, rapidoMinutos, rider);
        toast('🚀 Voy en camino', `El robot manda su tarjeta con imagen + tus ${rapidoMinutos} minutos a ${convActiva.nombre}`, 'success');
      } else if (rapidoAbierto?.tipo === 'posicion') {
        await avisarPosicionBot(convActiva.tel, convActiva.nombre, rapidoPosicion, rider);
        toast('⏰ Posición avisada', `El robot manda su plantilla con imagen a ${convActiva.nombre}`, 'success');
      } else {
        await enviarMensajeChat(convActiva.tel, convActiva.nombre, textoRapidoRider());
        toast('⚡ Enviado', 'El bot manda tu mensaje en segundos', 'success');
      }
      setRapidoAbierto(null);
    } catch (e: any) {
      toast('Error al enviar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setEnviandoRapido(false);
    }
  };

  // Fase 3.7 — REPORTES al grupo MATE (directo, sin preview)
  const REPORTES_GRUPO: { id: string; emoji: string; etiqueta: string; texto: string }[] = [
    { id: 'entrega', emoji: '✅', etiqueta: 'Entrega realizada', texto: '✅ *Entrega realizada* — sin novedades' },
    { id: 'noresponde', emoji: '📵', etiqueta: 'Cliente no responde', texto: '📵 *Cliente no responde* — intentaré más tarde' },
    { id: 'cobrado', emoji: '💰', etiqueta: 'Pago cobrado', texto: '💰 *Pago cobrado* ✅' },
    { id: 'reprogramado', emoji: '🔁', etiqueta: 'Entrega reprogramada', texto: '🔁 *Entrega reprogramada* — el cliente pidió otro horario' },
  ];

  const enviarReporteGrupo = async (texto: string, etiqueta: string) => {
    try {
      // ⚡ F3.59: los REPORTES a la empresa van CON imagen (como
      // siempre) — solo los mensajes normales del chat van limpios.
      await enviarAGrupoMate(texto, {
        nombre: profile?.nombre || 'Rudy',
        telefono: profile?.email || '',
        empresa: 'MATE',
      }, { conImagen: true });
      setMenuRapidos(false);
      toast(
        '👥 Reporte al grupo',
        estadoGrupoVivo(estadoGrupo)
          ? `"${etiqueta}" enviado al grupo MATE`
          : `"${etiqueta}" en cola — el bot necesita el parche grupo_mate.js para escribir en el grupo`,
        estadoGrupoVivo(estadoGrupo) ? 'success' : 'warning'
      );
    } catch (e: any) {
      toast('Error al enviar', e.message || 'Intenta de nuevo', 'error');
    }
  };

  const enviarPlantillaRapida = async () => {
    if (!convActiva || !rapidoAbierto?.plantilla || enviandoRapido) return;
    setEnviandoRapido(true);
    try {
      const mensaje = llenarVariables(procesarBloquesPreview(rapidoAbierto.plantilla.mensaje), convActiva.nombre);
      await enviarMensajeChat(convActiva.tel, convActiva.nombre, mensaje);
      toast('⚡ Enviado', `"${rapidoAbierto.plantilla.nombre}" está en cola para el bot`, 'success');
      setRapidoAbierto(null);
    } catch (e: any) {
      toast('Error al enviar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setEnviandoRapido(false);
    }
  };

  // ── Nota de voz ──
  const empezarGrabacion = async () => {
    if (!convActiva || esGrupo || grabando) return;
    try {
      grabadorRef.current = await iniciarGrabacionAudio();
      setGrabando(true);
      setGrabSeg(0);
      setEmojiAbierto(false);
      setMenuAdjuntos(false);
      setMenuRapidos(false);
      timerGrabRef.current = setInterval(() => {
        setGrabSeg((s) => {
          if (s + 1 >= MAX_SEG_AUDIO) {
            // tope de seguridad: detener y enviar
            detenerYEnviarAudio();
            return MAX_SEG_AUDIO;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      const msg = String(e.message || '');
      toast(
        '🎤 Micrófono no disponible',
        /permission|denied|NotAllowed/i.test(msg)
          ? 'Activa el permiso de micrófono para RiderTrack en los ajustes del teléfono'
          : msg || 'No se pudo iniciar la grabación',
        'error'
      );
    }
  };

  const limpiarTimerGrab = () => {
    if (timerGrabRef.current) {
      clearInterval(timerGrabRef.current);
      timerGrabRef.current = null;
    }
  };

  const detenerYEnviarAudio = async () => {
    const grabador = grabadorRef.current;
    if (!grabador || !convActiva || !user) return;
    limpiarTimerGrab();
    setEnviandoAudio(true);
    try {
      const grab = await grabador.parar();
      grabadorRef.current = null;
      setGrabando(false);
      if (grab.blob.size < 1200) {
        toast('Nota muy corta', 'Mantén presionado y habla un poquito más', 'warning');
        return;
      }
      await enviarAudioNotaChat(user.uid, convActiva.tel, convActiva.nombre, grab);
      setAudiosLocales(leerAudiosLocales());
      toast('🎙️ Nota de voz en cola', `${grab.duracionSeg}s — el bot la enviará como nota de voz`, 'success');
    } catch (e: any) {
      toast('Error al enviar audio', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setEnviandoAudio(false);
    }
  };

  const cancelarGrabacion = () => {
    limpiarTimerGrab();
    grabadorRef.current?.cancelar();
    grabadorRef.current = null;
    setGrabando(false);
    setGrabSeg(0);
  };

  useEffect(() => () => limpiarTimerGrab(), []);

  // ── Fondo personalizado desde la galería ──
  const usarFotoDeFondo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { base64, mimetype } = await comprimirImagen(file);
      const nuevo: FondoChat = {
        id: 'personalizada',
        css: `url("data:${mimetype};base64,${base64}") center/cover fixed no-repeat`,
        oscuro: true,
      };
      guardarFondoChat(nuevo);
      setFondo(nuevo);
      setPanelFondo(false);
      toast('🖼️ Fondo cambiado', 'Tu foto ya es el fondo de todos los chats', 'success');
    } catch (e: any) {
      toast('Error con la foto', e.message || 'Intenta con otra imagen', 'error');
    }
  };

  const aplicarFondoPreset = (f: FondoChat) => {
    guardarFondoChat(f);
    setFondo(f);
    toast('🖼️ Fondo cambiado', 'Se aplicó a todos tus chats', 'success');
  };

  // Agrupar mensajes por día para los separadores
  const mensajesAgrupados = useMemo(() => {
    const grupos: { dia: string; mensajes: MensajeChat[] }[] = [];
    mensajesConv.forEach((m) => {
      const dia = etiquetaDia(m.timestamp);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.dia === dia) ultimo.mensajes.push(m);
      else grupos.push({ dia, mensajes: [m] });
    });
    return grupos;
  }, [mensajesConv]);

  const conectado = conversaciones.length > 1 || stats.mensajesHoy > 0;

  const itemsMenu = convActiva && !esGrupo ? [
    { id: 'ubicacion', icono: MapPinned, etiqueta: 'Pedir ubicación', color: 'text-sky-300', accion: () => { setMenuChat(false); pedirUbicacion(); } },
    { id: 'yape', icono: QrCode, etiqueta: 'Enviar QR de Yape', color: 'text-emerald-300', accion: () => { setMenuChat(false); enviarYape(); } },
    { id: 'plin', icono: QrCode, etiqueta: 'Enviar QR de Plin', color: 'text-cyan-300', accion: () => { setMenuChat(false); enviarPlin(); } },
    {
      id: 'silencio',
      icono: convActiva.silenciado ? BellRing : BellOff,
      etiqueta: convActiva.silenciado ? 'Reactivar bot' : 'Silenciar bot',
      color: convActiva.silenciado ? 'text-emerald-300' : 'text-amber-300',
      accion: () => { setMenuChat(false); toggleSilencio(); },
    },
    { id: 'fijar', icono: Pin, etiqueta: fijados.has(convActiva.tel) ? 'Quitar de fijados' : 'Fijar chat', color: 'text-slate-200', accion: alternarFijado },
    { id: 'fondo', icono: Palette, etiqueta: 'Fondo del chat', color: 'text-violet-300', accion: () => { setMenuChat(false); setPanelFondo(true); } },
    { id: 'borrar', icono: Trash2, etiqueta: 'Borrar chat', color: 'text-rose-400', accion: () => { setMenuChat(false); setConfirmBorrar(true); } },
  ] : [
    { id: 'fijar', icono: Pin, etiqueta: fijados.has(TEL_GRUPO_MATE) ? 'Quitar de fijados' : 'Fijar chat', color: 'text-slate-200', accion: alternarFijado },
    { id: 'fondo', icono: Palette, etiqueta: 'Fondo del chat', color: 'text-violet-300', accion: () => { setMenuChat(false); setPanelFondo(true); } },
    // 🗑️ F3.23 — "Limpiar chat" del grupo (antes no existía)
    { id: 'borrar', icono: Trash2, etiqueta: 'Borrar chat', color: 'text-rose-400', accion: () => { setMenuChat(false); setConfirmBorrar(true); } },
  ];

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
              Chats, broadcasts, pedidos de ubicación, notas de voz y el grupo MATE
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
                      fijado={fijados.has(c.tel)}
                      infoRuta={c.esGrupo ? undefined : mapaRuta.get(c.tel)}
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
              {/* Cabecera del chat — ordenada: nombre+estado a la izquierda,
                  acciones rápidas (sm+) y menú ⋮ a la derecha. Ya nada se monta. */}
              <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2.5 border-b border-slate-700/70 bg-slate-800 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setTelActivo(null)}
                  className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 flex-shrink-0"
                  title="Volver"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <AvatarChat tel={convActiva.tel} nombre={convActiva.nombre} grande foto={convActiva.foto} grupo={convActiva.esGrupo} />
                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                  <span className="text-sm font-black text-white truncate">{convActiva.nombre}</span>
                  {convActiva.esGrupo ? (
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Users className="w-3 h-3 text-emerald-400" />
                      <span className="truncate">
                        Grupo de trabajo ·{' '}
                        {estadoGrupoVivo(estadoGrupo) ? (
                          <span className="text-emerald-300 font-bold" title={(estadoGrupo?.version || 'parche del grupo') + (estadoGrupo?.participantes ? ' · ' + estadoGrupo.participantes + ' participantes' : '')}>
                            bot conectado ✓
                          </span>
                        ) : (
                          <span className="text-red-300 font-bold" title="Instala el parche grupo_mate.js en el bot (fase 3.9)">
                            bot sin parche del grupo
                          </span>
                        )}
                      </span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] min-w-0">
                      {clienteEscribiendo ? (
                        <span className="flex items-center gap-1.5 text-emerald-300 font-bold min-w-0" title="El cliente está redactando un mensaje">
                          <span className="flex items-end gap-[3px] h-3 flex-shrink-0">
                            <span className="w-[4px] h-[5px] rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
                            <span className="w-[4px] h-[8px] rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }} />
                            <span className="w-[4px] h-[5px] rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }} />
                          </span>
                          <span className="truncate">escribiendo…</span>
                        </span>
                      ) : (
                        <>
                          <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span className="text-slate-400 font-mono truncate hidden xs:inline sm:inline">+{telCompleto(convActiva.tel)}</span>
                        </>
                      )}
                      {convActiva.silenciado ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 font-bold flex-shrink-0">
                          <BellOff className="w-2.5 h-2.5" /> Silenciado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-bold flex-shrink-0">
                          <Radio className="w-2.5 h-2.5" /> Bot activo
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Acciones rápidas (pantallas medianas en adelante) */}
                {!esGrupo && (
                  <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
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
                      onClick={enviarPlin}
                      className="p-2 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
                      title="💚 Enviar QR de Plin (fase 3.20 — requiere parche extras_chat.js en el bot)"
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
                )}

                {/* 🆕 F3.56 — LLAMAR (siempre visible, móvil incluido).
                    Popover con 2 vías: llamada telefónica directa o abrir
                    su chat en WhatsApp (para llamada/videollamada de WhatsApp,
                    que solo la app oficial puede marcar). */}
                {!esGrupo && (
                  <div className="relative flex-shrink-0" ref={menuLlamadaRef}>
                    <button
                      type="button"
                      onClick={() => { setMenuLlamada((v) => !v); setMenuChat(false); }}
                      className={`p-2 rounded-xl border transition-colors ${menuLlamada ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'}`}
                      title="📞 Llamar a este cliente (fase 3.56)"
                    >
                      <PhoneCall className="w-4 h-4" />
                    </button>
                    {menuLlamada && (
                      <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden py-1">
                        <div className="px-3.5 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          📞 Llamar a {convActiva.nombre}
                        </div>
                        <button
                          type="button"
                          onClick={llamarTelefono}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-800 transition-colors"
                        >
                          <span className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                            <PhoneCall className="w-4 h-4 text-emerald-300" />
                          </span>
                          <span className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-bold text-slate-200">Llamada telefónica</span>
                            <span className="text-[10px] text-slate-500 truncate">Abre el marcador — 1 toque</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={abrirWhatsAppParaLlamar}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-800 transition-colors"
                        >
                          <span className="w-7 h-7 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center flex-shrink-0 text-sm">🟢</span>
                          <span className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-bold text-slate-200">Llamada de WhatsApp</span>
                            <span className="text-[10px] text-slate-500 truncate">Abre su chat — de allá toca llamar</span>
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Menú ⋮ (siempre visible — móvil incluido) */}
                <div className="relative flex-shrink-0" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuChat((v) => !v)}
                    className={`p-2 rounded-xl border transition-colors ${menuChat ? 'bg-emerald-600 text-white border-emerald-500' : 'text-slate-300 border-slate-600 bg-slate-700/40 hover:bg-slate-700'}`}
                    title="Más opciones"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuChat && (
                    <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden py-1">
                      {itemsMenu.map((it) => {
                        const Icono = it.icono;
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={it.accion}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors text-left"
                          >
                            <Icono className={`w-4 h-4 flex-shrink-0 ${it.color}`} />
                            {it.etiqueta}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 🧭 Fase 3.22 — FICHA DEL CLIENTE: posición en la ruta,
                  dirección, producto y monto (viva, colapsable) */}
              {infoRutaActiva && <TarjetaRutaCliente info={infoRutaActiva} />}

              {/* Mensajes (con el fondo elegido) */}
              <div
                ref={scrollRef}
                className={`flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-3 ${fondo.css ? '' : 'bg-slate-900/40'}`}
                style={fondo.css ? { background: fondo.css } : undefined}
              >
                {esGrupo && (
                  <div className="mx-auto max-w-lg mb-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-200/90 leading-relaxed">
                    <b className="text-sky-300">👥 Grupo de trabajo MATE.</b> Lo que escribas aquí lo manda el bot
                    al grupo de WhatsApp de MATE. Ves los reportes del bot y lo que escriban los compañeros — con
                    sus <b className="text-sky-300">@menciones</b> incluidas. Usa el botón <b className="text-sky-300">@</b> del
                    teclado para mencionar a alguien (llega con píldora azul y notificación en WhatsApp).
                  </div>
                )}
                {mensajesAgrupados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                    <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
                    <div className="text-sm font-semibold text-slate-400">Sin mensajes aún</div>
                    <div className="text-xs mt-1">
                      {esGrupo ? 'Escribe algo para el grupo de trabajo' : 'Escribe el primero o pídele su ubicación al cliente'}
                    </div>
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
                          desconocido={!esGrupo && convActiva.nombre.startsWith('Cliente ')}
                          revelado={reveladas.has(m.id)}
                          onRevelar={() => setReveladas((s) => new Set(s).add(m.id))}
                          onVerImagen={(mm) => setLightbox(mm.base64 ? { base64: mm.base64, mimetype: mm.mimetype || 'image/jpeg', nombre: mm.nombreArchivo || 'imagen.jpg' } : { nombre: mm.nombreArchivo || 'imagen.jpg', url: mm.imageUrl })}
                          onEliminar={() => m.borrableDocId && borrarMensaje(m.borrableDocId)}
                        />
                      ))}
                    </div>
                  ))
                )}

                {/* ✍️ Fase 3.20: el cliente está escribiendo (burbujita viva) */}
                {clienteEscribiendo && !esGrupo && (
                  <div className="flex items-center gap-1.5 mt-1 px-3 py-2 w-fit rounded-2xl rounded-bl-md bg-slate-800 border border-slate-700 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }} />
                  </div>
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

              {/* Menú de adjuntos (🆕 F3.56: con cámara directa) */}
              {menuAdjuntos && (
                <div className="p-2 border-t border-slate-700/70 bg-slate-900/80 grid grid-cols-3 gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => { setMenuAdjuntos(false); inputFotoRef.current?.click(); }}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-slate-800 border border-slate-600 hover:border-emerald-500/50 text-xs font-bold text-slate-200 transition-colors"
                    title="📷 Abre la CÁMARA directa (fase 3.56) — la foto la envía el bot"
                  >
                    <Camera className="w-4 h-4 text-emerald-400" /> Tomar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuAdjuntos(false); inputImgRef.current?.click(); }}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-slate-800 border border-slate-600 hover:border-emerald-500/50 text-xs font-bold text-slate-200 transition-colors"
                    title="🖼️ Elegir una imagen de la galería"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-400" /> Galería
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuAdjuntos(false); inputDocRef.current?.click(); }}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-slate-800 border border-slate-600 hover:border-sky-500/50 text-xs font-bold text-slate-200 transition-colors"
                    title="📄 Documento (máx 700 KB)"
                  >
                    <FileText className="w-4 h-4 text-sky-400" /> Documento
                  </button>
                </div>
              )}

              {/* Botones rápidos DESGLOSABLES (Fase 3.6 + 3.7):
                  - chats de CLIENTE → Rápidos del rider (Gracias con imagen,
                    ETA, posición, ya llegué) + Plantillas conectadas
                  - GRUPO MATE → Reportes al grupo (directo, vía acciones_bot) */}
              {!grabando && (
                <div className="px-2.5 py-1.5 border-t border-slate-700/70 bg-slate-800/95 flex-shrink-0">
                  <div className="relative inline-block" ref={menuRapidosRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuRapidos((v) => !v);
                        setEmojiAbierto(false);
                        setMenuAdjuntos(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold transition-colors ${
                        menuRapidos
                          ? 'bg-amber-500/25 text-amber-200 border-amber-400/60'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                      }`}
                      title={esGrupo ? 'Reportes rápidos al grupo de trabajo' : 'Respuestas rápidas: Gracias con imagen, ETA, posición y plantillas'}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {esGrupo ? 'Reporte' : 'Rápido'}
                      {menuRapidos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <span className="hidden sm:inline ml-2 text-[10px] text-slate-500">
                      {esGrupo ? 'reportes al grupo MATE — los manda el bot' : 'gracias con imagen, ETA y plantillas — las envía el bot'}
                    </span>

                    {/* Menú flotante (mismo patrón que el ⋮ de la cabecera) */}
                    {menuRapidos && esGrupo ? (
                      /* ── GRUPO: reportes directos ── */
                      <div className="absolute left-0 bottom-full mb-1.5 z-50 w-72 max-h-[min(60vh,17rem)] overflow-y-auto custom-scrollbar rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl py-1">
                        <div className="px-3.5 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          👥 Reportes al grupo MATE
                        </div>
                        {REPORTES_GRUPO.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => enviarReporteGrupo(r.texto, r.etiqueta)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-800 transition-colors"
                          >
                            <span className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-sm flex-shrink-0">{r.emoji}</span>
                            <span className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-bold text-slate-200 truncate">{r.etiqueta}</span>
                              <span className="text-[10px] text-slate-500 truncate">Se envía directo al grupo</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : menuRapidos ? (
                      /* ── CLIENTE: rápidos del rider + plantillas ── */
                      <div className="absolute left-0 bottom-full mb-1.5 z-50 w-72 max-h-[min(60vh,17rem)] overflow-y-auto custom-scrollbar rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl py-1">
                        <div className="px-3.5 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          ⚡ Rápidos del rider
                        </div>

                        {/* Gracias CON imagen — la tarjeta del robot (v1) */}
                        <button
                          type="button"
                          onClick={() => { setMenuRapidos(false); setRapidoAbierto({ tipo: 'gracias' }); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-800 transition-colors"
                        >
                          <span className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-sm flex-shrink-0">🙏</span>
                          <span className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-bold text-amber-200 truncate">Gracias por tu compra</span>
                            <span className="text-[10px] text-slate-500 truncate">Con imagen — la tarjeta del robot + mensajito</span>
                          </span>
                        </button>

                        {/* Gracias SOLO TEXTO — la otra opción del Control v1 */}
                        <button
                          type="button"
                          onClick={() => { setMenuRapidos(false); setRapidoAbierto({ tipo: 'gracias_texto' }); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-800 transition-colors"
                        >
                          <span className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-sm flex-shrink-0">💬</span>
                          <span className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-semibold text-amber-100/90 truncate">Gracias — solo texto</span>
                            <span className="text-[10px] text-slate-500 truncate">Sin imagen — solo el mensajito del robot</span>
                          </span>
                        </button>

                        {/* ETA — plantilla del robot con imagen */}
                        <button
                          type="button"
                          onClick={() => { setMenuRapidos(false); setRapidoAbierto({ tipo: 'eta' }); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-800 transition-colors"
                        >
                          <span className="w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sm flex-shrink-0">⏱️</span>
                          <span className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-bold text-sky-200 truncate">Voy en camino</span>
                            <span className="text-[10px] text-slate-500 truncate">Plantilla del robot con imagen — minutos editable</span>
                          </span>
                        </button>

                        {/* Posición en la cola — plantilla del robot con imagen */}
                        <button
                          type="button"
                          onClick={() => {
                            setMenuRapidos(false);
                            setRapidoAbierto({ tipo: 'posicion' });
                            // Fase 3.9: pre-calcular la posición REAL desde la
                            // ruta activa (misma lógica v1); si no está en la ruta
                            // se queda el último valor del rider.
                            if (convActiva) {
                              calcularPosicionRuta(convActiva.tel).then((pos) => {
                                if (pos) setRapidoPosicion(pos.miPosicion);
                              });
                            }
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-800 transition-colors"
                        >
                          <span className="w-7 h-7 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-sm flex-shrink-0">📍</span>
                          <span className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-bold text-violet-200 truncate">Mi posición de hoy</span>
                            <span className="text-[10px] text-slate-500 truncate">Plantilla del robot con imagen — posición real de la ruta</span>
                          </span>
                        </button>

                        {/* Ya estoy afuera */}
                        <button
                          type="button"
                          onClick={() => { setMenuRapidos(false); setRapidoAbierto({ tipo: 'afuera' }); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-800 transition-colors"
                        >
                          <span className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-sm flex-shrink-0">🏁</span>
                          <span className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-bold text-emerald-200 truncate">Ya llegué a tu domicilio</span>
                            <span className="text-[10px] text-slate-500 truncate">Estoy afuera, acércate 🙏</span>
                          </span>
                        </button>

                        <div className="my-1 mx-3 border-t border-slate-700/70" />

                        {/* Plantillas conectadas */}
                        {plantillasConectadas.length > 0 ? (
                          <>
                            <div className="px-3.5 pt-1 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                              Plantillas conectadas
                            </div>
                            {plantillasConectadas.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => { setMenuRapidos(false); setRapidoAbierto({ tipo: 'plantilla', plantilla: p }); }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-800 transition-colors"
                              >
                                <span className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-center flex-shrink-0">
                                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                </span>
                                <span className="flex flex-col min-w-0 flex-1">
                                  <span className="text-sm font-semibold text-slate-200 truncate">{p.nombre}</span>
                                  <span className="text-[10px] text-slate-500 truncate">
                                    Clave <span className="text-emerald-400 font-mono">{p.clave}</span>
                                  </span>
                                </span>
                              </button>
                            ))}
                          </>
                        ) : (
                          <div className="px-3.5 py-2 text-[10px] text-slate-500 leading-relaxed">
                            Conecta plantillas en el <b className="text-slate-400">Centro del Bot</b> para tenerlas aquí a un toque.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Barra de escritura / grabación */}
              {grabando ? (
                <div className="flex items-center gap-2 p-2.5 border-t border-slate-700/70 bg-slate-900 flex-shrink-0">
                  <button
                    type="button"
                    onClick={cancelarGrabacion}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors flex-shrink-0"
                    title="Cancelar grabación"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
                    <span className="text-sm font-mono font-bold text-rose-300">
                      {Math.floor(grabSeg / 60)}:{String(grabSeg % 60).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] text-rose-200/70 truncate">Grabando nota de voz…</span>
                  </div>
                  <button
                    type="button"
                    onClick={detenerYEnviarAudio}
                    disabled={enviandoAudio}
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors flex-shrink-0"
                    title="Enviar nota de voz"
                  >
                    {enviandoAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-1.5 p-2.5 border-t border-slate-700/70 bg-slate-800 flex-shrink-0">
                  <input
                    ref={inputImgRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { manejarArchivo(e.target.files?.[0], 'imagen'); e.currentTarget.value = ''; }}
                  />
                  {/* 🆕 F3.56 — cámara DIRECTA: capture="environment" abre la
                      cámara trasera sin pasar por la galería. En PC cae al
                      selector normal de archivos (no rompe nada). */}
                  <input
                    ref={inputFotoRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => { manejarArchivo(e.target.files?.[0], 'imagen'); e.currentTarget.value = ''; }}
                  />
                  <input
                    ref={inputDocRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { manejarArchivo(e.target.files?.[0], 'documento'); e.currentTarget.value = ''; }}
                  />
                  {/* Fase 3.7: emojis TAMBIÉN en el grupo (antes el grupo era
                      el único chat sin herramientas). Mic/adjuntos siguen
                      solo para clientes: el bot no puede resolver el JID de
                      un grupo desde cola_envio (resolverJid espera un número). */}
                  <button
                    type="button"
                    onClick={() => { setEmojiAbierto((v) => !v); setMenuAdjuntos(false); setMenuRapidos(false); }}
                    className={`p-2.5 rounded-xl transition-colors ${emojiAbierto ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    title="Emojis"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  {/* 🆕 F3.23 — @arrobas al escribir en el grupo: abre la lista
                      de miembros y mete "@Nombre " en el mensaje. El parche
                      grupo_mate.js v1.1 lo convierte en mención REAL de
                      WhatsApp (píldora azul + notificación). */}
                  {esGrupo && (
                    <button
                      type="button"
                      onClick={() => { setPickerArroba(true); setEmojiAbierto(false); setMenuAdjuntos(false); setMenuRapidos(false); }}
                      className="p-2.5 rounded-xl text-emerald-300 hover:text-white hover:bg-emerald-600/40 transition-colors flex-shrink-0"
                      title="Mencionar a alguien del grupo (@)"
                    >
                      <AtSign className="w-5 h-5" />
                    </button>
                  )}
                  {!esGrupo && (
                    <>
                      {/* 🆕 F3.56 — 📷 cámara directa: 1 toque → foto → la
                          comprime y la manda el bot (mismo canal que la
                          galería: respuestas_manuales con imagen+base64). */}
                      <button
                        type="button"
                        onClick={() => { inputFotoRef.current?.click(); setMenuAdjuntos(false); setEmojiAbierto(false); setMenuRapidos(false); }}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0"
                        title="📷 Tomar foto y enviarla (fase 3.56 — la envía el bot)"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMenuAdjuntos((v) => !v); setEmojiAbierto(false); setMenuRapidos(false); }}
                        className={`p-2.5 rounded-xl transition-colors ${menuAdjuntos ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                        title="Adjuntar (galería o documento)"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={empezarGrabacion}
                        disabled={enviandoAudio}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition-colors flex-shrink-0"
                        title="🎙️ Grabar nota de voz (la envía el bot)"
                      >
                        {enviandoAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                      </button>
                    </>
                  )}
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
                    }}
                    rows={1}
                    placeholder={esGrupo ? 'Escribe al grupo MATE…' : 'Escribe un mensaje…'}
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
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══ MODAL: vista previa de botón rápido ═══ */}
      {rapidoAbierto && convActiva && (
        <div
          className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={() => !enviandoRapido && setRapidoAbierto(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-black text-white">
                  {rapidoAbierto.tipo === 'gracias'
                    ? '🙏 Gracias por tu compra — con imagen'
                    : rapidoAbierto.tipo === 'gracias_texto'
                      ? '💬 Gracias — solo texto'
                      : rapidoAbierto.tipo === 'eta'
                      ? '⏱️ Voy en camino'
                      : rapidoAbierto.tipo === 'posicion'
                        ? '📍 Mi posición de hoy'
                        : rapidoAbierto.tipo === 'afuera'
                          ? '🏁 Ya llegué a tu domicilio'
                          : rapidoAbierto.plantilla?.nombre}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRapidoAbierto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar">
              {rapidoAbierto.tipo === 'gracias' || rapidoAbierto.tipo === 'gracias_texto' ? (
                <>
                  {rapidoAbierto.tipo === 'gracias' && (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3">
                      <span className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-2xl flex-shrink-0">🖼️</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-emerald-200">Tarjeta con imagen del robot</div>
                        <div className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                          La MISMA tarjeta "¡Gracias por tu compra!" que manda el Control de la v1 — con la imagen real de MATE.
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl rounded-tr-md bg-emerald-600/90 text-white px-3 py-2.5 shadow-lg">
                    <span
                      className="text-sm whitespace-pre-wrap break-words"
                      dangerouslySetInnerHTML={{ __html: formatearWhatsAppHTML(MENSAJE_GRACIAS_BOT) }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {rapidoAbierto.tipo === 'gracias' ? (
                      <>El robot manda <b className="text-slate-300">su tarjeta con imagen</b> y este mensajito — idéntico al botón <b className="text-slate-300">Control → Con imagen</b> de la v1.</>
                    ) : (
                      <>Solo el mensajito, sin imagen — igual al botón <b className="text-slate-300">Control → Solo texto</b> de la v1.</>
                    )}
                  </p>
                </>
              ) : rapidoAbierto.tipo === 'eta' || rapidoAbierto.tipo === 'posicion' || rapidoAbierto.tipo === 'afuera' ? (
                <>
                  {(rapidoAbierto.tipo === 'eta' || rapidoAbierto.tipo === 'posicion') && (
                    <div className="flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-3">
                      <span className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-2xl flex-shrink-0">🤖</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-sky-200">Plantilla del robot con imagen</div>
                        <div className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                          La MISMA tarjeta que manda el botón 🤖 de la v1 — con su imagen oficial. No es un texto plano tuyo.
                        </div>
                      </div>
                    </div>
                  )}
                  {(rapidoAbierto.tipo === 'eta' || rapidoAbierto.tipo === 'posicion') && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-300 flex-shrink-0">
                        {rapidoAbierto.tipo === 'eta' ? '⏱️ Minutos:' : '📍 Posición:'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={rapidoAbierto.tipo === 'eta' ? 180 : 50}
                        value={rapidoAbierto.tipo === 'eta' ? rapidoMinutos : rapidoPosicion}
                        onChange={(e) => {
                          const v = Math.max(1, Number(e.target.value) || 1);
                          if (rapidoAbierto.tipo === 'eta') setRapidoMinutos(v);
                          else setRapidoPosicion(v);
                        }}
                        className="w-24 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-600 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/60"
                      />
                      {rapidoAbierto.tipo === 'posicion' && (
                        <span className="text-[10px] text-slate-500 leading-tight">calculada de tu ruta de hoy</span>
                      )}
                    </div>
                  )}
                  {rapidoAbierto.tipo === 'afuera' ? (
                    <>
                      <div className="rounded-2xl rounded-tr-md bg-emerald-600/90 text-white px-3 py-2.5 shadow-lg">
                        <span
                          className="text-sm whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{ __html: formatearWhatsAppHTML(textoRapidoRider()) }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Lo manda el bot a <b className="text-slate-300">{convActiva.nombre}</b> como mensaje tuyo.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {rapidoAbierto.tipo === 'eta' ? (
                        <>El robot le avisa a <b className="text-slate-300">{convActiva.nombre}</b> que vas en camino con su <b className="text-slate-300">tarjeta con imagen</b> y tus <b className="text-slate-300">{rapidoMinutos} minutos</b> — idéntico al botón 🤖 de la v1.</>
                      ) : (
                        <>El robot le avisa a <b className="text-slate-300">{convActiva.nombre}</b> su <b className="text-slate-300">posición en la ruta de hoy</b> con la plantilla con imagen del botón 🤖 de la v1.</>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-2xl rounded-tr-md bg-emerald-600/90 text-white px-3 py-2.5 shadow-lg">
                    <span
                      className="text-sm whitespace-pre-wrap break-words"
                      dangerouslySetInnerHTML={{
                        __html: formatearWhatsAppHTML(
                          llenarVariables(procesarBloquesPreview(rapidoAbierto.plantilla?.mensaje || ''), convActiva.nombre)
                        ),
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Plantilla conectada al bot · clave <code className="text-emerald-400">{rapidoAbierto.plantilla?.clave}</code>
                    {' '}· las variables se llenan con los datos de <b className="text-slate-300">{convActiva.nombre}</b>.
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-2 p-4 pt-0">
              <button
                type="button"
                onClick={() => setRapidoAbierto(null)}
                disabled={enviandoRapido}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-bold transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={
                  rapidoAbierto.tipo === 'gracias' || rapidoAbierto.tipo === 'gracias_texto'
                    ? enviarGracias
                    : rapidoAbierto.tipo === 'plantilla'
                      ? enviarPlantillaRapida
                      : enviarRapidoRider
                }
                disabled={enviandoRapido}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-40"
              >
                {enviandoRapido ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: fondo del chat ═══ */}
      {panelFondo && (
        <div
          className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={() => setPanelFondo(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-black text-white">Fondo de los chats</span>
              </div>
              <button
                type="button"
                onClick={() => setPanelFondo(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <input
                ref={inputFondoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { usarFotoDeFondo(e.target.files?.[0]); e.currentTarget.value = ''; }}
              />
              <div className="grid grid-cols-3 gap-2.5">
                {FONDOS_CHAT_PRESET.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => aplicarFondoPreset(f)}
                    className={`relative h-24 rounded-xl border-2 overflow-hidden transition-all ${
                      fondo.id === f.id ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-slate-700 hover:border-slate-500'
                    }`}
                    style={f.css ? { background: f.css } : { background: '#0f172a' }}
                    title={f.id === 'por_defecto' ? 'Predeterminado' : f.id.replace(/_/g, ' ')}
                  >
                    {f.id === 'por_defecto' && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Predeterminado
                      </span>
                    )}
                    {fondo.id === f.id && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </button>
                ))}
                {/* Foto propia */}
                <button
                  type="button"
                  onClick={() => inputFondoRef.current?.click()}
                  className={`relative h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all ${
                    fondo.id === 'personalizada' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 hover:border-slate-400 bg-slate-800/60'
                  }`}
                  title="Elegir una foto de tu teléfono"
                >
                  <ImageIcon className="w-5 h-5 text-slate-300" />
                  <span className="text-[10px] font-bold text-slate-300">Mi foto</span>
                  {fondo.id === 'personalizada' && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                El fondo se aplica a todos tus chats y queda guardado en este teléfono (como el fondo
                de WhatsApp). Con <b className="text-slate-300">Mi foto</b> eliges cualquier imagen de tu galería.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: picker de @menciones del grupo (F3.23) ═══ */}
      {pickerArroba && esGrupo && (
        <div
          className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={() => setPickerArroba(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70">
              <div className="flex items-center gap-2">
                <AtSign className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-black text-white">Mencionar en el grupo</span>
              </div>
              <button
                type="button"
                onClick={() => setPickerArroba(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-slate-700/70">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700">
                <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <input
                  value={buscaMiembro}
                  onChange={(e) => setBuscaMiembro(e.target.value)}
                  placeholder="Buscar miembro…"
                  className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[45vh] overflow-y-auto custom-scrollbar p-2">
              {(estadoGrupo?.miembros || []).length === 0 ? (
                <div className="p-4 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-600 mx-auto" />
                  {/* 🆕 F3.33 — el estado vacío ahora dice POR QUÉ está vacía:
                      permisos de Firestore, bot sin latido, o sin miembros —
                      antes solo decía "aún no tengo la lista" y no se podía
                      diagnosticar a distancia. */}
                  {errorEstadoGrupo && String(errorEstadoGrupo).includes('PERMISSION') ? (
                    <p className="text-[11px] text-rose-300 leading-relaxed">
                      No puedo leer <b className="text-rose-200">sistema/estado_grupo</b> (permiso denegado).<br />
                      Las <b className="text-rose-200">reglas de Firestore</b> no se publicaron bien: entra a
                      <b className="text-rose-200"> Firebase Console → Firestore → Reglas</b>, verifica que el
                      bloque <b className="text-rose-200">match /sistema/&#123;docId&#125;</b> esté y aprieta
                      <b className="text-rose-200"> Publicar</b>.
                    </p>
                  ) : !estadoGrupo ? (
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Sin señal del bot todavía.<br />
                      El bot escribe la lista <b className="text-slate-300">5 segundos</b> después de arrancar
                      (y la refresca cada 5 min) con el <b className="text-slate-300">grupo_mate.js v1.4</b>.
                      Si ya pasaron 5 min, reinicia el bot
                      (<b className="text-slate-300">pm2 restart rudy-bot</b>) y revisa que las
                      <b className="text-slate-300"> reglas 3.32</b> estén publicadas.
                      Mientras tanto puedes escribir el <b className="text-slate-300">@nombre</b> a mano.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      El bot latió{' '}
                      <b className="text-slate-300">
                        {estadoGrupo.ts ? `hace ${Math.max(1, Math.round((Date.now() - estadoGrupo.ts) / 60000))} min` : 'recién'}
                      </b>{' '}
                      pero sin miembros (<b className="text-slate-300">{estadoGrupo.version || 'versión ?'}</b>).<br />
                      Actualiza el bot al <b className="text-slate-300">grupo_mate.js v1.4</b> (fase 3.33): los
                      grupos nuevos de WhatsApp identifican a la gente con un ID interno que la versión
                      anterior descartaba. Mientras tanto puedes escribir el <b className="text-slate-300">@nombre</b> a mano.
                    </p>
                  )}
                </div>
              ) : (
                (estadoGrupo?.miembros || [])
                  .filter((x) => x.nombre.toLowerCase().includes(buscaMiembro.toLowerCase().trim()))
                  .map((x) => (
                    <button
                      key={x.jid}
                      type="button"
                      onClick={() => insertarArroba(x.nombre)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left transition-colors"
                    >
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 border ${x.admin ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'}`}>
                        {x.nombre.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-white truncate">
                          {x.admin && <span title="Admin del grupo" className="text-amber-300 mr-0.5">👑</span>}
                          {x.nombre}
                          {x.admin && <span className="ml-1 text-[9px] text-amber-400/80 font-black">ADMIN</span>}
                        </span>
                        {/* 🆕 F3.33 — los miembros con ID interno (@lid) no tienen
                            número visible: mostramos etiqueta en vez del número
                            larguísimo. El nombre se aprende cuando la persona
                            escribe en el grupo. */}
                        <span className="block text-[10px] text-slate-500 truncate">
                          {x.jid.endsWith('@lid')
                            ? 'ID interno · el nombre se aprende al escribir'
                            : '@' + x.jid.split('@')[0]}
                        </span>
                      </span>
                      <AtSign className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    </button>
                  ))
              )}
              {(estadoGrupo?.miembros || []).length > 0 &&
                (estadoGrupo?.miembros || []).filter((x) => x.nombre.toLowerCase().includes(buscaMiembro.toLowerCase().trim())).length === 0 && (
                  <p className="p-3 text-center text-[11px] text-slate-500">Nadie coincide con «{buscaMiembro}»</p>
                )}
            </div>
            {/* 🆕 F3.33 — pie de diagnóstico: versión del parche, antigüedad del
                latido y error de lectura. Sirve para saber qué está pasando sin
                tener que abrir Termux. */}
            <div className="px-4 py-2 border-t border-slate-700/70 bg-slate-900/60">
              <p className="text-[10px] text-slate-500 leading-relaxed truncate">
                {errorEstadoGrupo ? (
                  <span className="text-rose-300/80">⚠️ Lectura: {errorEstadoGrupo}</span>
                ) : estadoGrupo ? (
                  <>
                    <span className={estadoGrupoVivo(estadoGrupo) ? 'text-emerald-400/80' : 'text-amber-400/80'}>
                      {estadoGrupoVivo(estadoGrupo) ? '●' : '○'}
                    </span>{' '}
                    {estadoGrupo.version || 'sin versión'} · latido{' '}
                    {estadoGrupo.ts
                      ? `hace ${Math.max(0, Math.round((Date.now() - estadoGrupo.ts) / 60000))} min`
                      : '—'}
                    {' · '}
                    {(estadoGrupo?.miembros || []).length} miembro(s)
                  </>
                ) : (
                  'Esperando el primer latido del bot…'
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: confirmar borrar chat ═══ */}
      {confirmBorrar && convActiva && (
        <div
          className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !borrando && setConfirmBorrar(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-rose-500/30 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white">{esGrupo ? '¿Limpiar el chat del grupo?' : '¿Borrar este chat?'}</h3>
                  {esGrupo ? (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Se eliminará el historial de <b className="text-slate-200">{convActiva.nombre}</b>: los mensajes
                      que escribió la gente y los reportes ya enviados del bot. Los reportes que el bot aún tenga en
                      cola NO se tocan y el grupo sigue en la lista.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Se eliminará el historial de <b className="text-slate-200">{convActiva.nombre}</b> (sus
                      mensajes y tus respuestas ya enviadas). Es permanente, como borrar un chat de
                      WhatsApp. Los mensajes que el bot aún tenga en cola NO se tocan.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setConfirmBorrar(false)}
                disabled={borrando}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-bold transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={borrarChat}
                disabled={borrando}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-colors disabled:opacity-40"
              >
                {borrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {esGrupo ? 'Limpiar grupo' : 'Borrar chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LIGHTBOX ═══ */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.base64 ? `data:${lightbox.mimetype};base64,${lightbox.base64}` : lightbox.url}
            alt={lightbox.nombre}
            className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() =>
                lightbox.base64
                  ? descargarBase64(lightbox.base64, lightbox.mimetype || 'image/jpeg', lightbox.nombre)
                  : window.open(lightbox.url, '_blank')
              }
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
            >
              <Download className="w-4 h-4" /> {lightbox.base64 ? 'Descargar' : 'Abrir'}
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

