// ═══════════════════════════════════════════════════════════
// 📱 WhatsAppPersonalView.tsx — FASE 4.1
// Tu WhatsApp PERSONAL (celular 2 · bot-personal v1.3) dentro
// del panel, con TODO lo del Chat Baileys: burbujas, emojis,
// cámara, galería, documentos, notas de voz, QR de re-vinculación
// + etiquetas (familia/amigos/pareja), archivados, restringidos,
// llamadas, archivos y ⚡ respuestas rápidas (motor apagado).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode, type FC } from 'react';
import {
  Send, Camera, Paperclip, Mic, Trash2, Loader2, Search, Users,
  PhoneIncoming, PhoneMissed, PhoneCall, PhoneOff, FileText, Image as ImageIcon,
  X, ChevronLeft, MoreVertical, Pin, Archive, Tag, Ban, Eraser, Smile,
  Zap, Plus, Pencil, QrCode, Clock, Check, AlertTriangle, Lock, Bot,
  Smartphone, MessageCircle, Video as VideoIcon, User, File, RefreshCw, Music,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import {
  type ConversacionPersonal, type MensajePersonal, type EstadoPersonal,
  type RespuestaPendientePersonal, type RespuestaRapidaPersonal,
  type EtiquetaPersonal, type MediaPersonal, type StatsPersonal,
  ETIQUETAS_PERSONAL,
  suscribirChatPersonal, suscribirEstadoPersonal, suscribirRapidasPersonal,
  enviarMensajePersonal, enviarImagenPersonal, enviarAudioPersonal, enviarDocumentoPersonal,
  abrirChatPersonal, avisarEscribiendoPersonal, dejarDeEscribirPersonal,
  marcarLeidoPersonal, actualizarContactoPersonal, borrarChatPersonal,
  guardarRapidaPersonal, borrarRapidaPersonal,
  colorAvatar, iniciarGrabacionAudio, descargarBase64, telBonitoPersonal,
  leerMediaPersonal, reencolarPendientePersonal,
} from '../utils/chatPersonal';
import { horaCorta, etiquetaDia } from '../utils/chatBaileys';
// F5.1: 🎵 apartado de configuración de medios por chat
import { PanelMediosChat } from './medios/PanelMediosChat';
import { esComandoMedios, ejecutarComandoMedios } from '../utils/mediosChat';

// ── Emojis del composer (familia/amor/trabajo — mundo personal) ──
const EMOJIS = [
  '😊', '😂', '❤️', '🥰', '😘', '👍', '🙏', '🎉', '✅', '🔥',
  '👌', '😅', '🤝', '💪', '🚀', '📍', '💰', '⏰', '🙌', '😉',
  '🥳', '😎', '🤗', '☕', '🍀', '⚡', '🎁', '📸', '👏', '🫡',
  '👨‍👩‍👧‍👦', '🏠', '🍕', '🎶', '🌙', '☀️', '🐶', '⚽', '😴', '🤔',
];

const MAX_SEG_AUDIO = 120;
const CLAVE_FIJADOS = 'rt_personal_fijados_v1';

type Pestana = 'chats' | 'grupos' | 'llamadas' | 'archivos' | 'rapidas' | 'medios';

interface WhatsAppPersonalViewProps {
  onShowToast?: (titulo: string, desc?: string, tipo?: 'success' | 'info' | 'warning' | 'error') => void;
}

type ItemConv = { tipo: 'msg'; m: MensajePersonal } | { tipo: 'pend'; p: RespuestaPendientePersonal };

function leerFijados(): Set<string> {
  try {
    const crudo = localStorage.getItem(CLAVE_FIJADOS);
    return crudo ? new Set(JSON.parse(crudo) as string[]) : new Set();
  } catch { return new Set(); }
}
function guardarFijados(set: Set<string>) {
  try { localStorage.setItem(CLAVE_FIJADOS, JSON.stringify(Array.from(set))); } catch { /* nada */ }
}

// ── Avatar con puntito de presencia ───────────────────────
function AvatarPersonal({ tel, nombre, esGrupo, enLinea, tamano = 44 }: {
  tel: string; nombre: string; esGrupo?: boolean; enLinea?: boolean; tamano?: number;
}) {
  const { bg, texto } = colorAvatar(tel);
  const inicial = String(nombre || tel).trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="relative shrink-0">
      <div
        className={`${bg} ${texto} rounded-full flex items-center justify-center font-black shadow-lg`}
        style={{ width: tamano, height: tamano, fontSize: tamano * 0.4 }}
      >
        {esGrupo ? <Users size={tamano * 0.45} /> : inicial}
      </div>
      {enLinea && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-800 animate-pulse" />
      )}
    </div>
  );
}

// ── Ticks (⏳ pendiente · ✓ enviado · ⚠️ falló) ────────────
// ── Burbuja de llamada ────────────────────────────────────
function BurbujaLlamada({ m, esMio }: { m: MensajePersonal; esMio: boolean }) {
  const perdida = m.llamadaEstado === 'perdida';
  const rechazada = m.llamadaEstado === 'rechazada';
  const contestada = m.llamadaEstado === 'contestada';
  const color = perdida || rechazada
    ? 'text-rose-300 bg-rose-500/10 border-rose-500/30'
    : contestada
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
      : 'text-sky-300 bg-sky-500/10 border-sky-500/30';
  const Icono = perdida ? PhoneMissed : rechazada ? PhoneOff : contestada ? PhoneCall : PhoneIncoming;
  const estadoTxt = perdida ? 'Llamada perdida' : rechazada ? 'Llamada rechazada' : contestada ? 'Llamada contestada' : 'Llamada entrante';
  return (
    <div className={`flex ${esMio ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border shadow-lg ${color} ${esMio ? 'rounded-tr-md' : 'rounded-tl-md'}`}>
        <Icono size={18} />
        <div className="text-sm font-semibold">
          {estadoTxt}
          {m.esVideo && <span className="ml-1 opacity-80">(video)</span>}
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de documento (descargable) ────────────────────
function TarjetaDocPersonal({ m, media, cargando, onDescargar }: {
  m: MensajePersonal; media: MediaPersonal | null; cargando: boolean; onDescargar: () => void;
}) {
  const nombre = m.nombreArchivo || media?.nombreArchivo || 'documento';
  const mime = m.mime || media?.mimetype || '';
  const emoji = /\.pdf$/i.test(nombre) ? '📕' : /\.(xlsx?|csv)$/i.test(nombre) ? '📊' : /\.(docx?)$/i.test(nombre) ? '📘' : '📄';
  const pesoKB = m.bytes ? Math.round(m.bytes / 1024) : 0;
  return (
    <button
      onClick={onDescargar}
      disabled={!media}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/20 border border-white/10 hover:bg-black/30 transition-colors text-left"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate">{nombre}</span>
        <span className="block text-[11px] opacity-70">
          {m.adjuntoGrande
            ? `archivo grande${pesoKB ? ' · ' + Math.round(pesoKB / 1024) + ' MB' : ''} — no guardado`
            : cargando ? 'descargando…' : pesoKB ? pesoKB + ' KB' : mime || 'documento'}
        </span>
      </span>
      {media && !m.adjuntoGrande && <FileText size={16} className="opacity-60 shrink-0" />}
    </button>
  );
}

// ── Burbuja con media (imagen/video/audio/sticker) ─────────
function BurbujaMedia({ m, media, cargando, onAbrirLightbox }: {
  m: MensajePersonal; media: MediaPersonal | null; cargando: boolean;
  onAbrirLightbox: (src: string, nombre: string, esVideo: boolean) => void;
}) {
  const dataUrl = media ? `data:${media.mimetype};base64,${media.base64}` : '';

  if (m.tipoContenido === 'audio') {
    return (
      <div className="flex items-center gap-2.5 py-1">
        <div className="w-9 h-9 rounded-full bg-emerald-500/30 border border-emerald-400/40 flex items-center justify-center shrink-0">
          <Mic size={16} className="text-emerald-200" />
        </div>
        {cargando || !media ? (
          <span className="flex items-center gap-2 text-xs opacity-70 py-2"><Loader2 size={13} className="animate-spin" /> nota de voz…</span>
        ) : (
          <audio controls preload="metadata" src={dataUrl} className="max-w-[200px] h-9" />
        )}
      </div>
    );
  }

  if (m.tipoContenido === 'sticker') {
    if (cargando || !media) {
      return <div className="w-[140px] h-[140px] rounded-xl bg-black/30 animate-pulse flex items-center justify-center"><span className="text-3xl">🎭</span></div>;
    }
    return (
      <img
        src={dataUrl}
        alt="sticker"
        className="max-w-[160px] max-h-[160px] object-contain drop-shadow-lg"
        loading="lazy"
      />
    );
  }

  if (m.tipoContenido === 'video') {
    if (cargando || !media) {
      return <div className="w-[210px] h-[150px] rounded-xl bg-black/30 animate-pulse flex items-center justify-center"><VideoIcon size={22} className="opacity-60" /></div>;
    }
    return <video controls preload="metadata" src={dataUrl} className="max-w-[240px] max-h-[240px] rounded-xl" />;
  }

  // imagen
  if (cargando || !media) {
    return (
      <div className="relative w-[210px] h-[150px] rounded-xl bg-black/30 animate-pulse flex items-center justify-center">
        <ImageIcon size={22} className="opacity-60" />
        {m.adjuntoGrande && <span className="absolute bottom-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60">imagen grande no guardada</span>}
      </div>
    );
  }
  return (
    <img
      src={dataUrl}
      alt={m.texto || 'imagen'}
      className="max-w-[260px] max-h-[260px] rounded-xl object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
      style={{ maxHeight: 240 }}
      loading="lazy"
      onClick={() => onAbrirLightbox(dataUrl, m.texto || 'imagen', false)}
    />
  );
}

// ── Burbuja principal ─────────────────────────────────────
function BurbujaPersonal({ m, esMio, esGrupo, media, cargandoMedia, onAbrirLightbox, onDescargarDoc }: {
  m: MensajePersonal;
  esMio: boolean;
  esGrupo: boolean;
  media: MediaPersonal | null;
  cargandoMedia: boolean;
  onAbrirLightbox: (src: string, nombre: string, esVideo: boolean) => void;
  onDescargarDoc: () => void;
}) {
  const burbujaBase = esMio
    ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-md border border-emerald-500/40'
    : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl rounded-tl-md';
  const nombreParticipante = esGrupo && !esMio ? m.participanteNombre || m.participante || '' : '';

  if (m.tipoContenido === 'llamada') {
    return <BurbujaLlamada m={m} esMio={esMio} />;
  }

  const tiposMedia = ['imagen', 'video', 'audio', 'sticker'];
  const esDoc = m.tipoContenido === 'documento';
  const soloPreview = m.texto === '📷 Imagen' || m.texto === '🎙️ Nota de voz' || m.texto === '🎬 Video';
  const conTexto = !!m.texto && !soloPreview && m.tipoContenido !== 'sticker';

  return (
    <div className={`flex ${esMio ? 'justify-end' : 'justify-start'} mb-2 group`}>
      <div className={`relative max-w-[85%] sm:max-w-[70%] px-3 py-2 shadow-lg ${burbujaBase} ${m.tipoContenido === 'sticker' ? 'bg-transparent border-0 shadow-none p-0' : ''}`}>
        {nombreParticipante && (
          <div className="text-[11px] font-bold text-sky-300 mb-0.5 truncate">{nombreParticipante}</div>
        )}
        {m.tipoContenido === 'contacto' && (
          <div className="flex items-center gap-2.5 py-1">
            <div className="w-9 h-9 rounded-full bg-slate-600/60 flex items-center justify-center"><User size={16} /></div>
            <div>
              <div className="text-sm font-semibold">Tarjeta de contacto</div>
              <div className="text-[11px] opacity-70">{m.texto || ''}</div>
            </div>
          </div>
        )}
        {m.tipoContenido === 'ubicacion' && (
          <div className="py-1 flex items-center gap-2.5">
            <span className="text-xl">📍</span>
            <span className="text-sm">Ubicación compartida</span>
          </div>
        )}
        {tiposMedia.includes(m.tipoContenido) && (
          <BurbujaMedia m={m} media={media} cargando={cargandoMedia} onAbrirLightbox={onAbrirLightbox} />
        )}
        {esDoc && (
          <TarjetaDocPersonal m={m} media={media} cargando={cargandoMedia} onDescargar={onDescargarDoc} />
        )}
        {conTexto && (
          <div className={`text-sm leading-relaxed break-words whitespace-pre-wrap ${tiposMedia.includes(m.tipoContenido) || esDoc ? 'mt-1.5' : ''} ${m.tipoContenido === 'sticker' ? 'text-center text-xs opacity-70' : ''}`}>
            {m.texto}
          </div>
        )}
        <div className={`flex items-center gap-1 justify-end ${m.tipoContenido === 'sticker' ? 'mt-1' : 'mt-0.5'} text-[10px] ${esMio ? 'text-white/75' : 'text-slate-400'}`}>
          <span>{horaCorta(m.timestamp)}</span>
          {esMio && <Check size={13} className="text-white/80" />}
        </div>
      </div>
    </div>
  );
}

// ── Burbuja de respuesta PENDIENTE del outbox (⏳/⚠️) ──────
function BurbujaPendiente({ p, onReintentar }: { p: RespuestaPendientePersonal; onReintentar: () => void }) {
  const falla = !!p.error;
  return (
    <div className="flex justify-end mb-2">
      <div className={`relative max-w-[85%] sm:max-w-[70%] px-3 py-2 shadow-lg rounded-2xl rounded-tr-md border ${
        falla ? 'bg-rose-900/70 border-rose-500/40 text-white' : 'bg-emerald-700/60 border-emerald-500/30 text-white'
      }`}>
        {p.tipo === 'imagen' && p.base64 && (
          <img src={`data:${p.mimetype || 'image/jpeg'};base64,${p.base64}`} alt="adjunto" className="max-w-[220px] max-h-[220px] rounded-xl object-cover mb-1.5" />
        )}
        {p.tipo === 'audio' && (
          <div className="flex items-center gap-2 py-1 text-xs font-semibold"><Mic size={14} /> Nota de voz</div>
        )}
        {p.tipo === 'documento' && (
          <div className="flex items-center gap-2 py-1 text-xs font-semibold">📄 {p.nombreArchivo || 'documento'}</div>
        )}
        {p.texto && p.tipo === 'texto' && (
          <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">{p.texto}</div>
        )}
        <div className="flex items-center gap-1.5 justify-end mt-0.5 text-[10px] text-white/75">
          {falla ? (
            <>
              <span className="mr-1 text-rose-200 truncate max-w-[140px]" title={p.error}>{p.error}</span>
              <button
                onClick={onReintentar}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/30 hover:bg-rose-500/50 border border-rose-400/40 text-[10px] font-bold"
              >
                <RefreshCw size={10} /> Reintentar
              </button>
            </>
          ) : (
            <>
              <span>enviando…</span>
              <Clock size={12} className="animate-pulse" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════

export function WhatsAppPersonalView({ onShowToast }: WhatsAppPersonalViewProps) {
  const toast = useCallback((titulo: string, desc?: string, tipo?: 'success' | 'info' | 'warning' | 'error') => {
    onShowToast?.(titulo, desc, tipo);
  }, [onShowToast]);

  // ── Estados ────────────────────────────────────────────
  const [conversaciones, setConversaciones] = useState<ConversacionPersonal[]>([]);
  const [stats, setStats] = useState<StatsPersonal>({ total: 0, noLeidos: 0, archivados: 0, grupos: 0, hoy: 0 });
  const [pendientes, setPendientes] = useState<RespuestaPendientePersonal[]>([]);
  const [estado, setEstado] = useState<EstadoPersonal | null>(null);
  const [rapidas, setRapidas] = useState<RespuestaRapidaPersonal[]>([]);
  const [telActivo, setTelActivo] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>('chats');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<EtiquetaPersonal | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const [menuAdjuntos, setMenuAdjuntos] = useState(false);
  const [menuChat, setMenuChat] = useState(false);
  const [menuRapidos, setMenuRapidos] = useState(false);
  const [verEventos, setVerEventos] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; nombre: string; esVideo: boolean } | null>(null);
  const [confirmBorrar, setConfirmBorrar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [etiquetaModal, setEtiquetaModal] = useState(false);
  const [fijados, setFijados] = useState<Set<string>>(() => leerFijados());
  // media on-demand
  const [mediaCache, setMediaCache] = useState<Map<string, MediaPersonal | null>>(new Map());
  const [cargandoMedia, setCargandoMedia] = useState<Set<string>>(new Set());
  // grabación
  const [grabando, setGrabando] = useState(false);
  const [grabSeg, setGrabSeg] = useState(0);
  const [enviandoAudio, setEnviandoAudio] = useState(false);
  const grabadorRef = useRef<{ parar: () => Promise<{ blob: Blob; mimetype: string; duracionSeg: number }>; cancelar: () => void } | null>(null);
  const timerGrabRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // typing
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisandoTypingRef = useRef(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputImgRef = useRef<HTMLInputElement | null>(null);
  const inputFotoRef = useRef<HTMLInputElement | null>(null);
  const inputDocRef = useRef<HTMLInputElement | null>(null);
  const menuChatRef = useRef<HTMLDivElement | null>(null);
  const menuRapidosRef = useRef<HTMLDivElement | null>(null);
  const telAnteriorRef = useRef<string | null>(null);
  const pegadoAbajoRef = useRef(true);

  // ── Suscripciones ──────────────────────────────────────
  useEffect(() => {
    const sub = suscribirChatPersonal((convs, st, pends) => {
      setConversaciones(convs);
      setStats(st);
      setPendientes(pends);
    });
    const subEstado = suscribirEstadoPersonal(setEstado);
    const subRapidas = suscribirRapidasPersonal(setRapidas);
    return () => { sub.cancelar(); subEstado.cancelar(); subRapidas.cancelar(); };
  }, []);

  // ── Conversación activa + abrir chat ───────────────────
  const convActiva = useMemo(
    () => conversaciones.find((c) => c.telefono === telActivo) || null,
    [conversaciones, telActivo]
  );

  const abrirConv = useCallback((tel: string) => {
    setTelActivo(tel);
    setEmojiAbierto(false);
    setMenuAdjuntos(false);
    setMenuChat(false);
    setMenuRapidos(false);
  }, []);

  // al abrir: aviso al bot (presencia) + marcar leído
  useEffect(() => {
    if (!convActiva) return;
    abrirChatPersonal(convActiva.telefono, convActiva.jidOriginal || undefined);
    marcarLeidoPersonal(convActiva.telefono);
    dejarDeEscribirPersonal();
    return () => { dejarDeEscribirPersonal(); };
  }, [convActiva?.telefono]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll inteligente (patrón Chat Baileys f3.33) ─
  const itemsConv: ItemConv[] = useMemo(() => {
    if (!convActiva) return [];
    const lista: ItemConv[] = convActiva.mensajes.map((m) => ({ tipo: 'msg' as const, m }));
    for (const p of pendientes) {
      if (p.telefono !== convActiva.telefono) continue;
      if (p.processed && !p.error) continue; // ya está espejado en mensajes
      lista.push({ tipo: 'pend' as const, p });
    }
    lista.sort((a, b) => {
      const ta = a.tipo === 'msg' ? a.m.timestamp : Date.parse(a.p.createdAt || '') || 0;
      const tb = b.tipo === 'msg' ? b.m.timestamp : Date.parse(b.p.createdAt || '') || 0;
      return ta - tb;
    });
    return lista;
  }, [convActiva, pendientes]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cambioDeChat = telAnteriorRef.current !== telActivo;
    if (cambioDeChat) { telAnteriorRef.current = telActivo; pegadoAbajoRef.current = true; }
    const cercaDelFinal = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (pegadoAbajoRef.current || cercaDelFinal || itemsConv.length === 0) {
      el.scrollTop = el.scrollHeight;
      if (itemsConv.length > 0) {
        requestAnimationFrame(() => {
          if (pegadoAbajoRef.current) el.scrollTop = el.scrollHeight;
          pegadoAbajoRef.current = false;
        });
      }
    }
  }, [itemsConv.length, telActivo]);

  // ── Media on-demand ────────────────────────────────────
  const pedirMedia = useCallback(async (id: string) => {
    if (mediaCache.has(id) || cargandoMedia.has(id)) return;
    setCargandoMedia((prev) => new Set<string>(Array.from(prev)).add(id));
    try {
      const media = await leerMediaPersonal(id);
      setMediaCache((prev) => new Map(prev).set(id, media));
    } finally {
      setCargandoMedia((prev) => { const s = new Set<string>(Array.from(prev)); s.delete(id); return s; });
    }
  }, [mediaCache, cargandoMedia]);

  useEffect(() => {
    if (!convActiva) return;
    for (const item of itemsConv) {
      if (item.tipo === 'msg' && item.m.tieneMedia && !item.m.adjuntoGrande && !mediaCache.has(item.m.id)) {
        pedirMedia(item.m.id);
      }
    }
  }, [itemsConv, convActiva, mediaCache, pedirMedia]);

  // ── Typing → el contacto ve "escribiendo…" ─────────────
  useEffect(() => {
    if (!convActiva) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (texto.trim()) {
      if (!avisandoTypingRef.current) {
        avisandoTypingRef.current = true;
        avisarEscribiendoPersonal(convActiva.telefono, convActiva.jidOriginal || undefined);
      }
      typingTimerRef.current = setTimeout(() => {
        avisandoTypingRef.current = false;
        if (texto.trim()) avisarEscribiendoPersonal(convActiva.telefono, convActiva.jidOriginal || undefined);
      }, 4000);
    } else {
      avisandoTypingRef.current = false;
    }
    return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
  }, [texto, convActiva?.telefono]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Envío de texto ─────────────────────────────────────
  const enviar = useCallback(async () => {
    if (!convActiva || !texto.trim() || enviando) return;
    // F5.1: si es un comando de medios (!radio, pon musica…) se
    // ejecuta AHORA en la app y NO se manda como mensaje de WhatsApp.
    if (esComandoMedios(texto)) {
      const antes = texto;
      setTexto('');
      setEmojiAbierto(false);
      setMenuRapidos(false);
      try {
        const res = await ejecutarComandoMedios(antes);
        if (res) toast('🎵 Medios por chat', res.split('\n')[0].slice(0, 70), 'success');
        else toast('🎵 No entendí ese comando', 'Probá con !ayuda para ver la lista', 'warning');
      } catch {
        toast('🎵 Falló el comando', 'Probá de nuevo o usá !ayuda', 'error');
      }
      return;
    }
    setEnviando(true);
    try {
      await enviarMensajePersonal(convActiva, texto);
      setTexto('');
      setEmojiAbierto(false);
      setMenuRapidos(false);
      dejarDeEscribirPersonal();
      avisandoTypingRef.current = false;
    } catch (e) {
      toast('No pude encolar el mensaje', (e as Error).message, 'error');
    } finally {
      setEnviando(false);
    }
  }, [convActiva, texto, enviando, toast]);

  // ── Adjuntos: cámara / galería / documento ─────────────
  const manejarArchivo = useCallback(async (file: File | undefined, origen: 'camara' | 'galeria' | 'doc') => {
    if (!file || !convActiva) return;
    try {
      if (file.type.startsWith('image/')) {
        await enviarImagenPersonal(convActiva, file);
        toast('Imagen en cola', origen === 'camara' ? 'Foto de cámara' : 'De tu galería');
      } else {
        await enviarDocumentoPersonal(convActiva, file);
        toast('Documento en cola', file.name);
      }
    } catch (e) {
      toast('No pude adjuntar', (e as Error).message, 'error');
    }
  }, [convActiva, toast]);

  // ── Grabación de nota de voz (MediaRecorder) ───────────
  const empezarGrabacion = useCallback(async () => {
    if (grabando || enviandoAudio || !convActiva) return;
    try {
      grabadorRef.current = await iniciarGrabacionAudio();
      setGrabando(true);
      setGrabSeg(0);
      timerGrabRef.current = setInterval(() => {
        setGrabSeg((s) => {
          if (s + 1 >= MAX_SEG_AUDIO) { detenerYEnviarAudio(); return s; }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      const msg = (e as Error).message || '';
      if (/permission|denied|NotAllowed/i.test(msg)) toast('Permiso de micrófono', 'Activalo en ajustes del navegador/APK', 'warning');
      else toast('No pude grabar', msg, 'error');
    }
  }, [grabando, enviandoAudio, convActiva, toast]);

  const detenerYEnviarAudio = useCallback(async () => {
    const grab = grabadorRef.current;
    if (!grab) return;
    grabadorRef.current = null;
    if (timerGrabRef.current) { clearInterval(timerGrabRef.current); timerGrabRef.current = null; }
    setGrabando(false);
    setEnviandoAudio(true);
    try {
      const res = await grab.parar();
      if (res.blob.size < 1200) { toast('Nota muy corta', 'Mantené apretado el micrófono un poco más', 'info'); return; }
      if (!convActiva) return;
      await enviarAudioPersonal(convActiva, res.blob, res.mimetype);
      toast('Nota de voz en cola', Math.round(res.duracionSeg) + 's');
    } catch (e) {
      toast('No pude mandar el audio', (e as Error).message, 'error');
    } finally {
      setEnviandoAudio(false);
      setGrabSeg(0);
    }
  }, [convActiva, toast]);

  const cancelarGrabacion = useCallback(() => {
    if (timerGrabRef.current) { clearInterval(timerGrabRef.current); timerGrabRef.current = null; }
    try { grabadorRef.current?.cancelar(); } catch { /* nada */ }
    grabadorRef.current = null;
    setGrabando(false);
    setGrabSeg(0);
  }, []);

  // ── Acciones de contacto ───────────────────────────────
  const toggleFijado = useCallback((tel: string) => {
    setFijados((prev) => {
      const nuevo = new Set<string>(Array.from(prev));
      if (nuevo.has(tel)) nuevo.delete(tel); else nuevo.add(tel);
      guardarFijados(nuevo);
      return nuevo;
    });
  }, []);

  const cambiarEtiqueta = useCallback(async (etiqueta: EtiquetaPersonal | null) => {
    if (!convActiva) return;
    try {
      await actualizarContactoPersonal(convActiva.telefono, etiqueta ? { etiqueta } : { etiqueta: 'otro' });
      toast('Etiqueta guardada', ETIQUETAS_PERSONAL.find((e) => e.id === (etiqueta || 'otro'))?.nombre);
      setEtiquetaModal(false);
    } catch (e) {
      toast('No pude etiquetar', (e as Error).message, 'error');
    }
  }, [convActiva, toast]);

  const toggleArchivado = useCallback(async () => {
    if (!convActiva) return;
    const nuevo = !convActiva.archivado;
    try {
      await actualizarContactoPersonal(convActiva.telefono, { archivado: nuevo });
      toast(nuevo ? 'Chat archivado 🗄️' : 'Chat desarchivado', convActiva.nombre);
      if (nuevo) setTelActivo(null); else setMostrarArchivados(true);
      setMenuChat(false);
    } catch (e) {
      toast('No pude archivar', (e as Error).message, 'error');
    }
  }, [convActiva, toast]);

  const toggleRestringido = useCallback(async () => {
    if (!convActiva) return;
    const nuevo = !convActiva.restringido;
    try {
      await actualizarContactoPersonal(convActiva.telefono, { restringido: nuevo });
      toast(
        nuevo ? 'Contacto restringido 🚫' : 'Restricción quitada ✅',
        nuevo ? 'El bot no le mandará tus respuestas' : undefined,
        nuevo ? 'warning' : 'success'
      );
      setMenuChat(false);
    } catch (e) {
      toast('No pude cambiar la restricción', (e as Error).message, 'error');
    }
  }, [convActiva, toast]);

  const borrarChat = useCallback(async () => {
    if (!convActiva || borrando) return;
    setBorrando(true);
    try {
      const res = await borrarChatPersonal(convActiva.telefono);
      toast('Chat limpiado 🧹', res.mensajes + ' mensajes · ' + res.salidas + ' enviados');
      setTelActivo(null);
      setConfirmBorrar(false);
    } catch (e) {
      toast('No pude limpiar', (e as Error).message, 'error');
    } finally {
      setBorrando(false);
    }
  }, [convActiva, borrando, toast]);

  // ── Reintentar pendiente fallido ───────────────────────
  const reintentarPendiente = useCallback(async (p: RespuestaPendientePersonal) => {
    if (!convActiva) return;
    try {
      await reencolarPendientePersonal(p, convActiva.jidOriginal || undefined, convActiva.nombre);
      toast('Reintentando', 'El bot lo manda en segundos');
    } catch (e) {
      toast('No pude reintentar', (e as Error).message, 'error');
    }
  }, [convActiva, toast]);

  // ── Listas derivadas ───────────────────────────────────
  const listaChats = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return conversaciones
      .filter((c) => !c.esGrupo)
      .filter((c) => (mostrarArchivados ? c.archivado : !c.archivado))
      .filter((c) => !filtroEtiqueta || c.etiqueta === filtroEtiqueta)
      .filter((c) => !q || c.nombre.toLowerCase().includes(q) || c.telefono.includes(q.replace(/\D/g, '')))
      .sort((a, b) => {
        const fa = fijados.has(a.telefono) ? 1 : 0;
        const fb = fijados.has(b.telefono) ? 1 : 0;
        if (fa !== fb) return fb - fa;
        return b.ultimoTimestamp - a.ultimoTimestamp;
      });
  }, [conversaciones, busqueda, filtroEtiqueta, mostrarArchivados, fijados]);

  const listaGrupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return conversaciones
      .filter((c) => c.esGrupo)
      .filter((c) => (mostrarArchivados ? c.archivado : !c.archivado))
      .filter((c) => !q || c.nombre.toLowerCase().includes(q))
      .sort((a, b) => {
        const fa = fijados.has(a.telefono) ? 1 : 0;
        const fb = fijados.has(b.telefono) ? 1 : 0;
        if (fa !== fb) return fb - fa;
        return b.ultimoTimestamp - a.ultimoTimestamp;
      });
  }, [conversaciones, busqueda, mostrarArchivados, fijados]);

  const listaLlamadas = useMemo(() => {
    const llamadas: { m: MensajePersonal; conv: ConversacionPersonal }[] = [];
    for (const c of conversaciones) {
      for (const m of c.mensajes) {
        if (m.tipoContenido === 'llamada') llamadas.push({ m, conv: c });
      }
    }
    llamadas.sort((a, b) => b.m.timestamp - a.m.timestamp);
    return llamadas;
  }, [conversaciones]);

  const listaArchivos = useMemo(() => {
    const archivos: { m: MensajePersonal; conv: ConversacionPersonal }[] = [];
    const tipos = ['imagen', 'video', 'audio', 'documento', 'sticker'];
    for (const c of conversaciones) {
      for (const m of c.mensajes) {
        if (tipos.includes(m.tipoContenido)) archivos.push({ m, conv: c });
      }
    }
    archivos.sort((a, b) => b.m.timestamp - a.m.timestamp);
    return archivos.slice(0, 300);
  }, [conversaciones]);

  // ── Presencia viva (30s) ───────────────────────────────
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const presenciaConv = useMemo(() => {
    if (!convActiva || convActiva.esGrupo) return null;
    const ahora = Date.now();
    if (convActiva.escribiendo) return { texto: 'escribiendo…', activo: true };
    if (convActiva.grabando) return { texto: 'grabando audio…', activo: true };
    if (convActiva.enLinea) return { texto: 'en línea', activo: true };
    if (convActiva.ultimaVezVisto && ahora - convActiva.ultimaVezVisto < 30 * 24 * 60 * 60 * 1000) {
      const mins = Math.round((ahora - convActiva.ultimaVezVisto) / 60000);
      const texto = mins < 1 ? 'última vez hace instantes'
        : mins < 60 ? `última vez hace ${mins} min`
        : mins < 1440 ? `última vez hace ${Math.round(mins / 60)} h`
        : `última vez ${etiquetaDia(convActiva.ultimaVezVisto).toLowerCase()}`;
      return { texto, activo: false };
    }
    return null;
  }, [convActiva, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Estado del bot (vivo/muerto) ───────────────────────
  const latidoVivo = useMemo(() => {
    if (!estado?.latidoAt) return false;
    return Date.now() - estado.latidoAt < 5 * 60 * 1000;
  }, [estado?.latidoAt, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const conectado = !!(estado?.conectado && latidoVivo);

  const minutosLatido = estado?.latidoAt ? Math.max(0, Math.round((Date.now() - estado.latidoAt) / 60000)) : null;

  // ── Formulario de respuesta rápida ─────────────────────
  const [editandoRapida, setEditandoRapida] = useState<{ id?: string; nombre: string; icono: string; texto: string; atajos: string } | null>(null);

  const abrirEditorRapida = useCallback((r?: RespuestaRapidaPersonal) => {
    setEditandoRapida(r
      ? { id: r.id, nombre: r.nombre, icono: r.icono || '⚡', texto: r.texto, atajos: r.atajos || '' }
      : { nombre: '', icono: '⚡', texto: '', atajos: '' });
  }, []);

  const guardarRapida = useCallback(async () => {
    if (!editandoRapida) return;
    if (!editandoRapida.nombre.trim() || !editandoRapida.texto.trim()) {
      toast('Faltan datos', 'Poné nombre y texto', 'warning');
      return;
    }
    try {
      await guardarRapidaPersonal({
        id: editandoRapida.id,
        nombre: editandoRapida.nombre.trim(),
        icono: editandoRapida.icono || '⚡',
        texto: editandoRapida.texto.trim(),
        atajos: editandoRapida.atajos.trim(),
        activa: true,
        orden: editandoRapida.id ? undefined : Date.now(),
      } as RespuestaRapidaPersonal);
      toast('Respuesta rápida guardada ⚡');
      setEditandoRapida(null);
    } catch (e) {
      toast('No pude guardar', (e as Error).message, 'error');
    }
  }, [editandoRapida, toast]);

  const aplicarRapidaAlTexto = useCallback((r: RespuestaRapidaPersonal) => {
    setTexto((t) => (t ? t + ' ' + r.texto : r.texto));
    setMenuRapidos(false);
  }, []);

  const mandarRapidaYa = useCallback(async (r: RespuestaRapidaPersonal) => {
    if (!convActiva || enviando) return;
    setEnviando(true);
    try {
      await enviarMensajePersonal(convActiva, r.texto);
      setMenuRapidos(false);
      toast('Enviada ⚡', r.nombre);
    } catch (e) {
      toast('No pude enviar', (e as Error).message, 'error');
    } finally {
      setEnviando(false);
    }
  }, [convActiva, enviando, toast]);

  // cerrar menús al tocar afuera
  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (menuChatRef.current && !menuChatRef.current.contains(t)) setMenuChat(false);
      if (menuRapidosRef.current && !menuRapidosRef.current.contains(t)) setMenuRapidos(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  const iconoTipoArchivo = (tipo: string) => {
    switch (tipo) {
      case 'imagen': return <ImageIcon size={16} className="text-sky-300" />;
      case 'video': return <VideoIcon size={16} className="text-violet-300" />;
      case 'audio': return <Mic size={16} className="text-emerald-300" />;
      case 'sticker': return <Smile size={16} className="text-amber-300" />;
      default: return <FileText size={16} className="text-rose-300" />;
    }
  };

  const Pestanas = () => (
    <div className="grid grid-cols-6 border-b border-slate-700/60">
      {([
        { id: 'chats', icono: <MessageCircle size={15} />, texto: 'Chats' },
        { id: 'grupos', icono: <Users size={15} />, texto: 'Grupos' },
        { id: 'llamadas', icono: <PhoneIncoming size={15} />, texto: 'Llamadas' },
        { id: 'archivos', icono: <File size={15} />, texto: 'Archivos' },
        { id: 'rapidas', icono: <Zap size={15} />, texto: 'Rápidas' },
        { id: 'medios', icono: <Music size={15} />, texto: 'Medios' },
      ] as { id: Pestana; icono: ReactNode; texto: string }[]).map((p) => (
        <button
          key={p.id}
          onClick={() => { setPestana(p.id); setTelActivo(null); }}
          className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition-colors ${
            pestana === p.id ? 'text-emerald-300 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {p.icono}
          <span>{p.texto}</span>
          {p.id === 'chats' && stats.noLeidos > 0 && (
            <span className="absolute top-1 right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center">
              {stats.noLeidos > 99 ? '99+' : stats.noLeidos}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  const ItemConversacion: FC<{ conv: ConversacionPersonal }> = ({ conv }) => {
    const activo = conv.telefono === telActivo;
    const etiqueta = ETIQUETAS_PERSONAL.find((e) => e.id === conv.etiqueta);
    const escribiendo = conv.escribiendo || conv.grabando;
    return (
      <button
        onClick={() => abrirConv(conv.telefono)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border ${
          activo ? 'bg-emerald-600/15 border-emerald-500/40' : 'border-transparent hover:bg-slate-800/60'
        }`}
      >
        <AvatarPersonal tel={conv.telefono} nombre={conv.nombre} esGrupo={conv.esGrupo} enLinea={conv.enLinea} tamano={42} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-white truncate flex-1">{conv.nombre}</span>
            {fijados.has(conv.telefono) && <Pin size={12} className="text-amber-300 rotate-45 shrink-0" />}
            {conv.restringido && <Ban size={12} className="text-rose-400 shrink-0" />}
            {conv.archivado && <Archive size={12} className="text-slate-400 shrink-0" />}
            {etiqueta && <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${etiqueta.punto}`} title={etiqueta.nombre} />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {escribiendo ? (
              <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1 truncate">
                escribiendo…
                <span className="flex gap-0.5">
                  <span className="w-1 h-2.5 bg-emerald-300 rounded-sm animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-2.5 bg-emerald-300 rounded-sm animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1 h-2.5 bg-emerald-300 rounded-sm animate-bounce" style={{ animationDelay: '240ms' }} />
                </span>
              </span>
            ) : (
              <span className="text-xs text-slate-400 truncate flex-1">
                {conv.esGrupo && conv.ultimo && conv.ultimo.origen !== 'yo' && conv.ultimo.participanteNombre
                  ? conv.ultimo.participanteNombre.split(' ')[0] + ': ' : ''}
                {conv.ultimo
                  ? (conv.ultimo.tipoContenido === 'texto' ? conv.ultimo.texto : previewIcono(conv.ultimo))
                  : 'sin mensajes'}
              </span>
            )}
            {conv.noLeidos > 0 && (
              <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">
                {conv.noLeidos > 99 ? '99+' : conv.noLeidos}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-[10px] text-slate-500">{horaCorta(conv.ultimoTimestamp)}</span>
        </div>
      </button>
    );
  };

  const previewIcono = (m: MensajePersonal): string => {
    switch (m.tipoContenido) {
      case 'imagen': return '📷 Imagen';
      case 'video': return '🎬 Video';
      case 'audio': return '🎙️ Nota de voz';
      case 'sticker': return '🎭 Sticker';
      case 'documento': return '📄 ' + (m.nombreArchivo || 'Documento');
      case 'ubicacion': return '📍 Ubicación';
      case 'contacto': return '👤 Contacto';
      case 'llamada': return '📞 Llamada';
      default: return m.texto || '';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-11.5rem)] lg:h-[calc(100dvh-8.5rem)] min-h-[540px] pb-12 gap-3">

      {/* ══ Header del módulo ══ */}
      <div className="flex items-center gap-2.5 p-3 sm:p-4 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
          <Smartphone size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-white">WhatsApp Personal</h1>
            <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">F4.1</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {estado?.telefonoPropio ? telBonitoPersonal(estado.telefonoPropio) : 'celular 2'} · tu número, tus chats
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setVerEventos(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
            conectado
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
          }`}
          title={conectado ? 'Conectado — ver eventos' : 'Desconectado — ver diagnóstico'}
        >
          <span className={`w-2 h-2 rounded-full ${conectado ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          <span className="hidden sm:inline">
            {conectado
              ? (estado?.estadoConexion === 'reconectando' ? 'reconectando…' : 'conectado')
              : 'desconectado'}
          </span>
          {minutosLatido !== null && (
            <span className="hidden md:inline text-[10px] opacity-60">· {minutosLatido === 0 ? 'latido ahora' : 'hace ' + minutosLatido + ' min'}</span>
          )}
        </button>
        <button
          onClick={() => setQrModal(true)}
          className="p-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-200 transition-colors"
          title="Vinculación / QR"
        >
          <QrCode size={18} />
        </button>
      </div>

      {/* banner de desconexión con QR disponible */}
        {!conectado && estado?.qrTexto && (
        <button
          onClick={() => setQrModal(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm font-semibold hover:bg-amber-500/20 transition-colors"
        >
          <AlertTriangle size={16} />
          Tu WhatsApp personal se desconectó — el QR de re-vinculación está listo. Tocá para escanear.
        </button>
      )}

      <div className="flex flex-1 gap-3 min-h-0">

        {/* ══ Panel izquierdo: tabs + lista ══ */}
        <div className={`${telActivo ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[350px] xl:w-[380px] rounded-2xl bg-slate-800 border border-slate-700 shadow-xl overflow-hidden`}>
          <Pestanas />

          {(pestana === 'chats' || pestana === 'grupos') && (
            <>
              <div className="p-2.5 space-y-2 border-b border-slate-700/60">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar nombre o número…"
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                  {busqueda && (
                    <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setFiltroEtiqueta(null)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                      !filtroEtiqueta ? 'bg-slate-600/50 border-slate-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todos
                  </button>
                  {ETIQUETAS_PERSONAL.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setFiltroEtiqueta(filtroEtiqueta === e.id ? null : e.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                        filtroEtiqueta === e.id ? e.chip : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {e.icono} {e.nombre}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setMostrarArchivados((v) => !v)}
                  className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${
                    mostrarArchivados ? 'bg-amber-500/15 text-amber-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Archive size={12} />
                  {mostrarArchivados ? 'Ver chats activos' : `Archivados (${stats.archivados})`}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {(pestana === 'chats' ? listaChats : listaGrupos).length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    {pestana === 'chats' ? 'Sin chats todavía' : 'Sin grupos con mensajes'}
                    <div className="text-[11px] mt-1 opacity-70">Cuando te escriban al WhatsApp del celular 2, aparecen acá solos.</div>
                  </div>
                ) : (
                  (pestana === 'chats' ? listaChats : listaGrupos).map((conv) => (
                    <ItemConversacion key={conv.telefono} conv={conv} />
                  ))
                )}
              </div>
            </>
          )}

          {pestana === 'llamadas' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {listaLlamadas.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  Sin llamadas registradas
                  <div className="text-[11px] mt-1 opacity-70">Las llamadas que entran al celular 2 quedan acá (perdidas, contestadas…).</div>
                </div>
              ) : listaLlamadas.map(({ m, conv }) => {
                const perdida = m.llamadaEstado === 'perdida';
                const contestada = m.llamadaEstado === 'contestada';
                return (
                  <button
                    key={m.id}
                    onClick={() => abrirConv(conv.telefono)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-800/60 text-left"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      perdida ? 'bg-rose-500/15 text-rose-300' : contestada ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'
                    }`}>
                      {perdida ? <PhoneMissed size={16} /> : contestada ? <PhoneCall size={16} /> : <PhoneIncoming size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{conv.nombre}</div>
                      <div className="text-[11px] text-slate-400">
                        {m.llamadaEstado || 'entrante'}{m.esVideo ? ' · video' : ''}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">{horaCorta(m.timestamp)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {pestana === 'archivos' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {listaArchivos.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  Sin archivos todavía
                  <div className="text-[11px] mt-1 opacity-70">Imágenes, audios, videos, stickers y documentos que te manden (≤900 KB).</div>
                </div>
              ) : listaArchivos.map(({ m, conv }) => (
                <button
                  key={m.id}
                  onClick={() => abrirConv(conv.telefono)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-800/60 text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-700/60 flex items-center justify-center shrink-0">
                    {iconoTipoArchivo(m.tipoContenido)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {m.nombreArchivo || (m.tipoContenido === 'audio' ? 'Nota de voz' : m.tipoContenido === 'sticker' ? 'Sticker' : m.tipoContenido === 'imagen' ? 'Imagen' : m.tipoContenido === 'video' ? 'Video' : 'Documento')}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{conv.nombre}{m.bytes ? ' · ' + Math.round(m.bytes / 1024) + ' KB' : ''}</div>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{horaCorta(m.timestamp)}</span>
                </button>
              ))}
            </div>
          )}

          {pestana === 'rapidas' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
              {/* 🤖 modo automático — construido, APAGADO (fase 4.2) */}
              <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-3.5">
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-violet-300" />
                  <span className="text-sm font-black text-violet-200">Contestaciones automáticas</span>
                  <span className="ml-auto px-1.5 py-0.5 text-[9px] font-black rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">FASE 4.2</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  El motor ya está construido (bot + plantillas con atajos), pero quedó <b>apagado a propósito</b>: nada se contesta solo. Cuando lo habilitemos, elegís qué respuestas se mandan solas y cuáles no.
                </p>
                <div className="flex items-center gap-2 mt-2.5 opacity-60 cursor-not-allowed">
                  <div className="w-9 h-5 rounded-full bg-slate-700 border border-slate-600 relative">
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-slate-500" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Lock size={11} /> Deshabilitado</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">⚡ Mensajes rápidos ({rapidas.length})</span>
                <button
                  onClick={() => abrirEditorRapida()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                >
                  <Plus size={13} /> Nueva
                </button>
              </div>
              {rapidas.length === 0 && (
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/60 text-center text-slate-500 text-xs">
                  Creá tus respuestas de siempre («ya voy», «en 5 min», «gracias ❤️») y mandalas con un toque desde el chat.
                </div>
              )}
              {rapidas.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{r.icono || '⚡'}</span>
                    <span className="text-sm font-bold text-white truncate flex-1">{r.nombre}</span>
                    <button onClick={() => abrirEditorRapida(r)} className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white" title="Editar">
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => borrarRapidaPersonal(r.id).catch((e) => toast('No pude borrar', (e as Error).message, 'error'))}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300"
                      title="Borrar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="text-xs text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">{r.texto}</div>
                  {r.atajos && <div className="text-[10px] text-slate-500 mt-1">atajos: {r.atajos}</div>}
                </div>
              ))}
            </div>
          )}
          {pestana === 'medios' && (
            <PanelMediosChat onShowToast={toast} />
          )}
        </div>

        {/* ══ Panel derecho: conversación ══ */}
        <div className={`${telActivo ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 flex-col rounded-2xl bg-slate-800 border border-slate-700 shadow-xl overflow-hidden`}>

          {!convActiva ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-slate-500">
              <Smartphone size={40} className="opacity-40" />
              <div className="text-sm font-semibold">Elegí un chat de tu WhatsApp personal</div>
              <div className="text-xs text-center opacity-70 max-w-[260px]">
                Todo lo que llega al celular 2 aparece acá. Respondés con tu número, a mano, cuando quieras.
              </div>
            </div>
          ) : (
            <>
              {/* header de la conversación */}
              <div className="flex items-center gap-2.5 p-2.5 sm:p-3 border-b border-slate-700/60 bg-slate-800/80">
                <button onClick={() => setTelActivo(null)} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-300">
                  <ChevronLeft size={20} />
                </button>
                <AvatarPersonal tel={convActiva.telefono} nombre={convActiva.nombre} esGrupo={convActiva.esGrupo} enLinea={convActiva.enLinea} tamano={38} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm text-white truncate">{convActiva.nombre}</span>
                    {(() => {
                      const et = ETIQUETAS_PERSONAL.find((e) => e.id === convActiva.etiqueta);
                      return et ? (
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black border ${et.chip}`}>{et.icono} {et.nombre}</span>
                      ) : null;
                    })()}
                  </div>
                  <div className="text-[11px] truncate">
                    {presenciaConv ? (
                      <span className={presenciaConv.activo ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>{presenciaConv.texto}</span>
                    ) : convActiva.esGrupo ? (
                      <span className="text-slate-400">grupo de WhatsApp</span>
                    ) : (
                      <span className="text-slate-400">{telBonitoPersonal(convActiva.telefono)}</span>
                    )}
                  </div>
                </div>
                <div className="relative" ref={menuChatRef}>
                  <button
                    onClick={() => { setMenuChat((v) => !v); setMenuRapidos(false); setMenuAdjuntos(false); }}
                    className="p-2 rounded-xl hover:bg-slate-700/60 text-slate-300"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {menuChat && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
                      <button onClick={() => { toggleFijado(convActiva.telefono); setMenuChat(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-200 hover:bg-slate-800/80">
                        <Pin size={14} className="text-amber-300" /> {fijados.has(convActiva.telefono) ? 'Desfijar chat' : 'Fijar chat'}
                      </button>
                      <button onClick={() => { setEtiquetaModal(true); setMenuChat(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-200 hover:bg-slate-800/80">
                        <Tag size={14} className="text-sky-300" /> Etiquetar contacto
                      </button>
                      <button onClick={toggleArchivado} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-200 hover:bg-slate-800/80">
                        <Archive size={14} className="text-slate-300" /> {convActiva.archivado ? 'Desarchivar' : 'Archivar chat'}
                      </button>
                      <button onClick={toggleRestringido} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-200 hover:bg-slate-800/80">
                        <Ban size={14} className={convActiva.restringido ? 'text-emerald-300' : 'text-rose-300'} />
                        {convActiva.restringido ? 'Quitar restricción' : 'Restringir contacto'}
                      </button>
                      <button onClick={() => { setConfirmBorrar(true); setMenuChat(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 border-t border-slate-700/60">
                        <Eraser size={14} /> Limpiar chat
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* banner restringido */}
              {convActiva.restringido && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-rose-500/10 border-b border-rose-500/30 text-rose-200 text-xs font-semibold">
                  <Ban size={14} />
                  Contacto restringido — el bot se niega a mandarle tus respuestas.
                  <button onClick={toggleRestringido} className="ml-auto px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 font-bold">
                    Quitar
                  </button>
                </div>
              )}

              {/* mensajes */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 bg-slate-900/40">
                {itemsConv.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">Sin mensajes todavía</div>
                ) : itemsConv.map((item, i) => {
                  const anterior = i > 0 ? itemsConv[i - 1] : null;
                  const ts = item.tipo === 'msg' ? item.m.timestamp : Date.parse(item.p.createdAt || '') || 0;
                  const tsPrev = anterior
                    ? (anterior.tipo === 'msg' ? anterior.m.timestamp : Date.parse(anterior.p.createdAt || '') || 0)
                    : 0;
                  const separador = !tsPrev || etiquetaDia(ts) !== etiquetaDia(tsPrev);
                  return (
                    <div key={item.tipo === 'msg' ? item.m.id : 'pend-' + item.p.id}>
                      {separador && (
                        <div className="flex justify-center my-3">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-[10px] font-bold text-slate-400">
                            {etiquetaDia(ts)}
                          </span>
                        </div>
                      )}
                      {item.tipo === 'msg' ? (
                        <BurbujaPersonal
                          m={item.m}
                          esMio={item.m.origen === 'yo'}
                          esGrupo={item.m.esGrupo}
                          media={mediaCache.get(item.m.id) || null}
                          cargandoMedia={cargandoMedia.has(item.m.id)}
                          onAbrirLightbox={(src, nombre, esVideo) => setLightbox({ src, nombre, esVideo })}
                          onDescargarDoc={() => {
                            const media = mediaCache.get(item.m.id);
                            if (media) descargarBase64(media.base64, media.mimetype, item.m.nombreArchivo || media.nombreArchivo || 'documento');
                          }}
                        />
                      ) : (
                        <BurbujaPendiente p={item.p} onReintentar={() => reintentarPendiente(item.p)} />
                      )}
                    </div>
                  );
                })}
                {(convActiva.escribiendo || convActiva.grabando) && (
                  <div className="flex justify-start mb-2">
                    <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-slate-800 border border-slate-700 flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-300 font-semibold mr-1">{convActiva.grabando ? 'grabando audio…' : 'escribiendo…'}</span>
                      <span className="flex gap-0.5">
                        <span className="w-1.5 h-3 bg-slate-400 rounded-sm animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-3 bg-slate-400 rounded-sm animate-bounce" style={{ animationDelay: '120ms' }} />
                        <span className="w-1.5 h-3 bg-slate-400 rounded-sm animate-bounce" style={{ animationDelay: '240ms' }} />
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* barra de emojis */}
              {emojiAbierto && (
                <div className="p-2 border-t border-slate-700/60 bg-slate-800/90">
                  <div className="grid grid-cols-10 gap-1">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setTexto((t) => t + e)}
                        className="w-8 h-8 rounded-lg hover:bg-slate-700 text-lg flex items-center justify-center active:scale-95 transition-transform"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* menú de adjuntos (3 columnas) */}
              {menuAdjuntos && (
                <div className="p-2.5 border-t border-slate-700/60 bg-slate-800/90">
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => inputFotoRef.current?.click()} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 transition-colors">
                      <Camera size={20} />
                      <span className="text-[10px] font-bold">Tomar foto</span>
                    </button>
                    <button onClick={() => inputImgRef.current?.click()} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors">
                      <ImageIcon size={20} />
                      <span className="text-[10px] font-bold">Galería</span>
                    </button>
                    <button onClick={() => inputDocRef.current?.click()} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 transition-colors">
                      <FileText size={20} />
                      <span className="text-[10px] font-bold">Documento</span>
                    </button>
                  </div>
                </div>
              )}

              {/* menú de mensajes rápidos ⚡ */}
              {menuRapidos && (
                <div className="p-2.5 border-t border-slate-700/60 bg-slate-800/90 max-h-[38vh] overflow-y-auto custom-scrollbar" ref={menuRapidosRef}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-300">⚡ Mensajes rápidos</span>
                    <button onClick={() => { setPestana('rapidas'); setMenuRapidos(false); }} className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200">
                      gestionar →
                    </button>
                  </div>
                  {rapidas.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 py-3">No tenés rápidas — crealas en la pestaña ⚡</div>
                  ) : rapidas.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 py-1.5">
                      <button
                        onClick={() => aplicarRapidaAlTexto(r)}
                        className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-900/60 border border-slate-700 hover:border-amber-500/40 text-left"
                      >
                        <span className="text-base">{r.icono || '⚡'}</span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-white truncate">{r.nombre}</span>
                          <span className="block text-[10px] text-slate-400 truncate">{r.texto}</span>
                        </span>
                      </button>
                      <button
                        onClick={() => mandarRapidaYa(r)}
                        disabled={enviando}
                        className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 shrink-0"
                        title="Mandar ya"
                      >
                        <Send size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* composer / grabación */}
              {convActiva.restringido ? (
                <div className="p-3 border-t border-slate-700/60 bg-slate-800/90 flex items-center gap-2 text-xs text-slate-400">
                  <Lock size={13} /> No podés escribirle a un contacto restringido.
                </div>
              ) : grabando ? (
                <div className="p-3 border-t border-slate-700/60 bg-slate-800/90 flex items-center gap-3">
                  <button onClick={cancelarGrabacion} className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25" title="Cancelar">
                    <Trash2 size={16} />
                  </button>
                  <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-sm font-bold text-rose-200 font-mono">
                      {Math.floor(grabSeg / 60)}:{String(grabSeg % 60).padStart(2, '0')}
                    </span>
                    <span className="text-xs text-rose-300/80">Grabando nota de voz… (máx {MAX_SEG_AUDIO / 60} min)</span>
                  </div>
                  <button
                    onClick={detenerYEnviarAudio}
                    disabled={enviandoAudio}
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
                    title="Enviar"
                  >
                    {enviandoAudio ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              ) : (
                <div className="p-2.5 sm:p-3 border-t border-slate-700/60 bg-slate-800/90">
                  <input type="file" accept="image/*" ref={inputImgRef} className="hidden"
                    onChange={(e) => { manejarArchivo(e.target.files?.[0], 'galeria'); e.currentTarget.value = ''; }} />
                  <input type="file" accept="image/*" capture="environment" ref={inputFotoRef} className="hidden"
                    onChange={(e) => { manejarArchivo(e.target.files?.[0], 'camara'); e.currentTarget.value = ''; }} />
                  <input type="file" ref={inputDocRef} className="hidden"
                    onChange={(e) => { manejarArchivo(e.target.files?.[0], 'doc'); e.currentTarget.value = ''; }} />
                  <div className="flex items-end gap-1.5">
                    <button
                      onClick={() => { setEmojiAbierto((v) => !v); setMenuAdjuntos(false); setMenuRapidos(false); }}
                      className={`p-2.5 rounded-xl border transition-colors ${emojiAbierto ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                      title="Emojis"
                    >
                      <Smile size={18} />
                    </button>
                    <button
                      onClick={() => { setMenuAdjuntos((v) => !v); setEmojiAbierto(false); setMenuRapidos(false); }}
                      className={`p-2.5 rounded-xl border transition-colors ${menuAdjuntos ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                      title="Adjuntar"
                    >
                      <Paperclip size={18} />
                    </button>
                    <button
                      onClick={() => { setMenuRapidos((v) => !v); setEmojiAbierto(false); setMenuAdjuntos(false); }}
                      className={`p-2.5 rounded-xl border transition-colors relative ${menuRapidos ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                      title="Mensajes rápidos"
                    >
                      <Zap size={18} />
                      {rapidas.length > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                          {rapidas.length}
                        </span>
                      )}
                    </button>
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                      rows={1}
                      placeholder={convActiva.esGrupo ? 'Escribe al grupo…' : 'Escribe con tu número…'}
                      className="flex-1 resize-none px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 max-h-28 custom-scrollbar"
                    />
                    <button
                      onClick={empezarGrabacion}
                      disabled={enviandoAudio}
                      className="p-2.5 rounded-xl bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                      title="Nota de voz"
                    >
                      <Mic size={18} />
                    </button>
                    <button
                      onClick={enviar}
                      disabled={enviando || !texto.trim()}
                      className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 shadow-md active:scale-95 transition-transform"
                      title="Enviar"
                    >
                      {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ Modal QR ══ */}
      {qrModal && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setQrModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-3">
              <QrCode size={18} className="text-emerald-300" />
              <span className="font-black text-white">Vinculación del celular 2</span>
              <button onClick={() => setQrModal(false)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button>
            </div>
            {conectado ? (
              <div className="text-center py-6 space-y-2">
                <span className="text-4xl">✅</span>
                <div className="text-sm font-bold text-emerald-300">Todo conectado</div>
                <div className="text-xs text-slate-400">{estado?.telefonoPropio ? telBonitoPersonal(estado.telefonoPropio) : ''} · {estado?.version || ''}</div>
              </div>
            ) : estado?.qrTexto ? (
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-3 flex justify-center">
                  <QRCode value={estado.qrTexto} size={230} />
                </div>
                <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside">
                  <li>Abrí WhatsApp en tu <b>celular 2</b></li>
                  <li>Ajustes → <b>Dispositivos vinculados</b></li>
                  <li>En tu celular 1 borrá la vinculación vieja de «RiderTrack Panel» si aparece</li>
                  <li>En el celular 2: <b>Vincular un dispositivo</b> → escaneá este QR</li>
                </ol>
                <div className="text-[10px] text-slate-500 text-center">Si el QR no pasa: esperá 30s (se renueva solo) y volvé a escanear.</div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <Loader2 size={24} className="animate-spin text-emerald-300 mx-auto" />
                <div className="text-sm font-bold text-white">Generando QR…</div>
                <div className="text-xs text-slate-400">El bot del celular 2 está armando el código. Si no aparece en 1 min, revisá que pm2 esté corriendo.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Eventos de conexión (diagnóstico) ══ */}
      {verEventos && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setVerEventos(false)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 max-h-[70vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-3">
              <Smartphone size={18} className="text-emerald-300" />
              <span className="font-black text-white">Estado del bot (celular 2)</span>
              <button onClick={() => setVerEventos(false)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Conectado</span><span className={conectado ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>{conectado ? 'sí ✅' : 'no ❌'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Estado</span><span className="text-white font-semibold">{estado?.estadoConexion || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Latido</span><span className="text-white font-semibold">{minutosLatido === null ? '—' : minutosLatido === 0 ? 'ahora' : 'hace ' + minutosLatido + ' min'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Versión</span><span className="text-white font-semibold">{estado?.version || '—'}</span></div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-bold text-slate-300 mb-2">Últimos eventos</div>
              {(estado?.eventos || []).length === 0 ? (
                <div className="text-xs text-slate-500">Sin eventos registrados.</div>
              ) : (estado?.eventos || []).map((ev, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 text-xs">
                  <span className={`font-bold shrink-0 ${
                    ev.estado === 'conectado' ? 'text-emerald-300' : ev.estado === 'desconectado' ? 'text-rose-300' : 'text-amber-300'
                  }`}>{ev.estado}</span>
                  <span className="text-slate-400 shrink-0">{horaCorta(ev.ts)}</span>
                  <span className="text-slate-300 truncate" title={ev.detalle}>{ev.detalle || ''}</span>
                </div>
              ))}
              <div className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                Si se desconecta seguido: en Termux corrige con <code className="bg-slate-800 px-1 rounded">termux-wake-lock</code> (el bot ya lo intenta solo) y revisá que Android no optimize la batería de Termux.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal etiqueta ══ */}
      {etiquetaModal && convActiva && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setEtiquetaModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-3">
              <Tag size={18} className="text-sky-300" />
              <span className="font-black text-white">Etiquetar a {convActiva.nombre}</span>
              <button onClick={() => setEtiquetaModal(false)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ETIQUETAS_PERSONAL.map((e) => (
                <button
                  key={e.id}
                  onClick={() => cambiarEtiqueta(e.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                    convActiva.etiqueta === e.id ? e.chip : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="text-base">{e.icono}</span> {e.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ Editor de respuesta rápida ══ */}
      {editandoRapida && (
        <div className="fixed inset-0 z-[2050] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setEditandoRapida(null)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <Zap size={18} className="text-amber-300" />
              <span className="font-black text-white">{editandoRapida.id ? 'Editar rápida' : 'Nueva respuesta rápida'}</span>
              <button onClick={() => setEditandoRapida(null)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={editandoRapida.icono}
                  onChange={(e) => setEditandoRapida((r) => r ? { ...r, icono: e.target.value.slice(0, 2) } : r)}
                  className="w-14 text-center px-2 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-lg focus:outline-none focus:border-amber-500/60"
                  title="Icono (emoji)"
                />
                <input
                  value={editandoRapida.nombre}
                  onChange={(e) => setEditandoRapida((r) => r ? { ...r, nombre: e.target.value.slice(0, 30) } : r)}
                  placeholder="Nombre (ej: Ya voy)"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <textarea
                value={editandoRapida.texto}
                onChange={(e) => setEditandoRapida((r) => r ? { ...r, texto: e.target.value.slice(0, 500) } : r)}
                rows={3}
                placeholder="Texto del mensaje (ej: Ya voy en camino, dame 5 min 🙌)"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 resize-none custom-scrollbar"
              />
              <input
                value={editandoRapida.atajos}
                onChange={(e) => setEditandoRapida((r) => r ? { ...r, atajos: e.target.value.slice(0, 60) } : r)}
                placeholder="Atajos para el modo automático (ej: hola, buenas) — opcional"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
              <div className="text-[10px] text-slate-500 leading-relaxed">
                Los atajos solo se usan en el <b>modo automático</b> (fase 4.2, apagado). Hoy las rápidas se mandan a mano con un toque.
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditandoRapida(null)} className="flex-1 py-2.5 rounded-xl bg-slate-700/60 border border-slate-600 text-slate-200 text-sm font-bold hover:bg-slate-700">
                  Cancelar
                </button>
                <button onClick={guardarRapida} className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-md">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Confirmar borrar ══ */}
      {confirmBorrar && convActiva && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setConfirmBorrar(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-2">
              <Eraser size={18} className="text-rose-300" />
              <span className="font-black text-white">Limpiar chat con {convActiva.nombre}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Borra del panel los mensajes de esta conversación (incluye lo que mandaste desde la app). <b>No borra nada en WhatsApp</b>: los mensajes siguen en tu celular.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmBorrar(false)} className="flex-1 py-2.5 rounded-xl bg-slate-700/60 border border-slate-600 text-slate-200 text-sm font-bold hover:bg-slate-700">
                Cancelar
              </button>
              <button onClick={borrarChat} disabled={borrando} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {borrando ? <Loader2 size={14} className="animate-spin" /> : <Eraser size={14} />} Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Lightbox ══ */}
      {lightbox && (
        <div className="fixed inset-0 z-[2100] bg-slate-950/95 flex flex-col items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="flex items-center gap-2 mb-3 max-w-full">
            <span className="text-sm text-slate-300 truncate">{lightbox.nombre}</span>
            {lightbox.src.startsWith('data:image') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const base64 = lightbox.src.split(',')[1] || '';
                  descargarBase64(base64, 'image/jpeg', 'imagen-personal.jpg');
                }}
                className="p-2 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700"
                title="Descargar"
              >
                <FileText size={16} />
              </button>
            )}
            <button onClick={() => setLightbox(null)} className="p-2 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700"><X size={16} /></button>
          </div>
          {lightbox.esVideo ? (
            <video src={lightbox.src} controls autoPlay className="max-w-full max-h-[80vh] rounded-xl" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={lightbox.src} alt={lightbox.nombre} className="max-w-full max-h-[80vh] rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
}
