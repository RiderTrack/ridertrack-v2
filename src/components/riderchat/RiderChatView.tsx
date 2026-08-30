// ═══════════════════════════════════════════════════════════
// 💬 RiderChatView — el RiderChat acoplado al panel (F3.15 · 3.16)
//
// La app RiderChat V2 completa vive aquí: lista de chats +
// ventana de conversación + plantillas aprobadas de Meta +
// broadcast a la ruta activa. Mismas colecciones Firestore que
// el RiderChat original (chats/) → lo que mandes de un lado se
// ve en el otro.
//
// FASE 3.16 — nivel WhatsApp Web (como el Chat Baileys):
//   ✅ CHATS FIJADOS: sección propia arriba + botón 📌 en cada
//      fila y en el menú ⋮ del chat abierto
//   ✅ FONDO DEL CHAT personalizable: 8 presets + Mi foto
//   ✅ MENSAJES RÁPIDOS DESPLEGABLES: la pastilla ⚡ Rápido
//      reemplaza las tiras fijas (plantillas + sugerencias)
//   ✅ polish profesional: aviso ventana 24 h de Meta, emojis,
//      cabecera con menú ⋮ ordenado
//
// La credencial es la MISMA de ⚙️ Configuración → WhatsApp
// Oficial (config_empresa, compartida entre dispositivos). Sin
// credencial → MODO DEMO: los envíos se simulan para que puedas
// probar el chat mientras configuras Meta.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Settings,
  Zap,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  BadgeCheck,
} from 'lucide-react';
import type { Cliente } from '../../services/firestore';
import { useConfig } from '../../hooks/useConfig';
import { useAuth } from '../../hooks/useAuth';
import {
  ChatRider,
  MensajeRider,
  PlantillaRapida,
  FiltrosChat,
  MediaMensaje,
  EstadoChat,
  FondoChatRider,
  leerBorrador,
  guardarBorrador,
  leerChatActivo,
  guardarChatActivo,
  leerPlantillasRapidas,
  guardarPlantillasRapidas,
  leerFijadosRider,
  toggleFijadoRider,
  ordenarChatsConFijados,
  leerFondoChatRider,
  guardarFondoChatRider,
  leerRapidoAbierto,
  guardarRapidoAbierto,
} from '../../utils/riderChatUtils';
import {
  sendWhatsAppMessage,
  enviarPlantillaMeta,
  normalizarTelefono,
  PlantillaMeta,
  CredencialRiderChat,
} from '../../services/riderChatApi';
import {
  subscribeToChats,
  subscribeToMessages,
  sendMessageToFirestore,
  updateMessageStatus,
  updateMessageMetaId,
  markChatAsRead,
  crearOActualizarChat,
  simularMensajeCliente,
  subirMediaChat,
} from '../../services/riderChatFirestore';
import { sonarMensaje } from '../../services/notificaciones';
import { suscribirFotosPerfil, normalizarTelFoto } from '../../services/fotosPerfil';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { NewChatModal } from './NewChatModal';
import { QuickTemplatesModal } from './QuickTemplatesModal';
import { BroadcastModal } from './BroadcastModal';
import { FondoChatModal } from './FondoChatModal';
import { WhatsAppApiModal } from '../WhatsAppApiModal';

interface RiderChatViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  /** Clientes de la ruta activa (para el broadcast) */
  clientes?: Cliente[];
  /** Aviso al panel: total de no leídos (badge del menú) */
  onUnreadChange?: (total: number) => void;
  /** Fase 3.17: teléfono del chat a abrir al montar (aviso/campanita) */
  abrirChatTel?: string;
  /** Fase 3.17: la vista ya abrió el chat pedido (App limpia el pendiente) */
  onAbrirChatConsumido?: () => void;
  /** Fase 3.17: reporta qué chat está abierto (para no avisar lo que ya ves) */
  onActiveChatChange?: (tel: string | null) => void;
}

export const RiderChatView: React.FC<RiderChatViewProps> = ({
  onShowToast,
  clientes = [],
  onUnreadChange,
  abrirChatTel,
  onAbrirChatConsumido,
  onActiveChatChange,
}) => {
  const { user } = useAuth();
  const { config } = useConfig();

  // Credencial del WhatsApp Oficial (compartida, Fase 3.14)
  const credencial: CredencialRiderChat = useMemo(
    () => ({
      phoneNumberId: config?.whatsappMeta?.phoneNumberId || '',
      token: config?.whatsappMeta?.token || '',
    }),
    [config?.whatsappMeta?.phoneNumberId, config?.whatsappMeta?.token]
  );
  const modoDemo = !credencial.phoneNumberId || !credencial.token;

  // ── Estado del chat ─────────────────────────────────────
  const [chats, setChats] = useState<ChatRider[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [activePhone, setActivePhone] = useState<string | null>(() => leerChatActivo());
  const [messages, setMessages] = useState<MensajeRider[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [enviandoPlantilla, setEnviandoPlantilla] = useState<string | null>(null);

  const [plantillasRapidas, setPlantillasRapidas] = useState<PlantillaRapida[]>(() =>
    leerPlantillasRapidas()
  );
  const [filter, setFilter] = useState<FiltrosChat>({ search: '', status: 'all', sortBy: 'recent' });

  // Fase 3.16 — fijados, fondo y panel rápido desplegable
  const [fijados, setFijados] = useState<Set<string>>(() => leerFijadosRider());
  const [fondo, setFondo] = useState<FondoChatRider>(() => leerFondoChatRider());
  const [rapidoAbierto, setRapidoAbierto] = useState<boolean>(() => leerRapidoAbierto());

  // Modales
  const [showNewChat, setShowNewChat] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showFondo, setShowFondo] = useState(false);

  // Fase 3.17: fotos de perfil reales (clientes_registrados.foto_perfil)
  const [fotosPerfil, setFotosPerfil] = useState<Map<string, string>>(() => new Map());
  useEffect(() => suscribirFotosPerfil(setFotosPerfil), []);

  // Fase 3.17: reportar el chat abierto (avisos globales)
  useEffect(() => {
    onActiveChatChange?.(activePhone);
  }, [activePhone, onActiveChatChange]);

  // ── Suscripción a la lista de chats ──────────────────────
  useEffect(() => {
    const unsub = subscribeToChats(
      (updatedChats) => {
        setChats(updatedChats);
        setIsLoadingChats(false);
      },
      () => setIsLoadingChats(false)
    );
    return () => unsub();
  }, []);

  // Total de no leídos → badge del menú + sonido
  const totalUnread = useMemo(
    () => chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [chats]
  );
  const unreadPrevio = useRef<number>(-1);
  useEffect(() => {
    onUnreadChange?.(totalUnread);
    // Sonido solo cuando SUBE (no en la primera carga)
    if (unreadPrevio.current >= 0 && totalUnread > unreadPrevio.current) {
      sonarMensaje();
    }
    unreadPrevio.current = totalUnread;
  }, [totalUnread, onUnreadChange]);

  // ── Suscripción a los mensajes del chat activo ───────────
  useEffect(() => {
    if (!activePhone) {
      setMessages([]);
      return;
    }
    setIsLoadingMessages(true);
    const unsub = subscribeToMessages(
      activePhone,
      (updatedMessages) => {
        setMessages(updatedMessages);
        setIsLoadingMessages(false);
      },
      () => setIsLoadingMessages(false)
    );
    return () => unsub();
  }, [activePhone]);

  // Borrador por chat
  useEffect(() => {
    setDraft(activePhone ? leerBorrador(activePhone) : '');
  }, [activePhone]);

  const updateDraft = useCallback(
    (text: string) => {
      setDraft(text);
      if (activePhone) guardarBorrador(activePhone, text);
    },
    [activePhone]
  );

  // Chat activo (objeto)
  const activeChat = useMemo(
    () => (activePhone ? chats.find((c) => c.clientPhone === activePhone) || null : null),
    [chats, activePhone]
  );

  // Lista filtrada — con los FIJADOS arriba (Fase 3.16)
  const chatsFiltrados = useMemo(
    () =>
      ordenarChatsConFijados(
        chats.filter((chat) => {
          if (filter.status !== 'all' && chat.status !== filter.status) return false;
          if (filter.search.trim()) {
            const q = filter.search.toLowerCase().trim();
            const nombre = chat.clientName.toLowerCase().includes(q);
            const tel = chat.clientPhone.includes(q);
            const tags = chat.tags?.some((t) => t.toLowerCase().includes(q));
            return nombre || tel || tags;
          }
          return true;
        }),
        fijados
      ),
    [chats, filter, fijados]
  );

  // ── Fase 3.16: fijar / desfijar un chat ────────────────
  const handleToggleFijado = useCallback(
    (phone: string) => {
      const nombreChat = chats.find((c) => c.clientPhone === phone)?.clientName || phone;
      const ahoraFijado = toggleFijadoRider(phone);
      setFijados(leerFijadosRider());
      onShowToast?.(
        ahoraFijado ? '📌 Chat fijado' : '📌 Fijado quitado',
        ahoraFijado
          ? `${nombreChat} se queda arriba de la lista`
          : `${nombreChat} vuelve a su orden normal`,
        'info'
      );
    },
    [chats, onShowToast]
  );

  // ── Fase 3.16: aplicar fondo ───────────────────────────
  const handleAplicarFondo = useCallback((nuevoFondo: FondoChatRider) => {
    guardarFondoChatRider(nuevoFondo);
    setFondo(nuevoFondo);
  }, []);

  // ── Fase 3.16: plegar / desplegar el panel rápido ──────
  const handleToggleRapido = useCallback((abierto: boolean) => {
    setRapidoAbierto(abierto);
    guardarRapidoAbierto(abierto);
  }, []);

  const selectChat = useCallback(async (phone: string) => {
    setActivePhone(phone);
    guardarChatActivo(phone);
    markChatAsRead(phone);
  }, []);

  // Desktop (≥640px): auto-abrir el primer chat como el RiderChat
  // original — así la ventana derecha nunca nace vacía en pantallas
  // grandes (en móvil se mantiene la lista hasta que eliges uno).
  useEffect(() => {
    if (!activePhone && chats.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 640) {
      selectChat(chats[0].clientPhone);
    }
  }, [chats, activePhone, selectChat]);

  // ── Fase 3.17: abrir el chat pedido por el aviso flotante / campanita.
  //    El tel llega en 9 dígitos y los chats usan 51… — se busca normalizado
  //    y el effect reintenta solo cuando la lista termine de cargar. ──
  useEffect(() => {
    if (!abrirChatTel) return;
    const objetivo = chats.find(
      (c) => normalizarTelFoto(c.clientPhone) === normalizarTelFoto(abrirChatTel)
    );
    if (objetivo) {
      if (activePhone !== objetivo.clientPhone) {
        selectChat(objetivo.clientPhone);
      }
      onAbrirChatConsumido?.();
    }
  }, [abrirChatTel, chats, activePhone, selectChat, onAbrirChatConsumido]);

  // ── Envío de texto ───────────────────────────────────────
  const handleSendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      if (!activePhone || !text.trim()) return false;
      setIsSending(true);
      try {
        const firestoreMsgId = await sendMessageToFirestore(activePhone, {
          direction: 'sent',
          text: text.trim(),
          status: 'pending',
          timestamp: Date.now(),
          senderId: 'rider-meta',
        });

        const res = await sendWhatsAppMessage(credencial, {
          toPhone: activePhone,
          type: 'text',
          text: text.trim(),
        });

        if (res.success) {
          await updateMessageStatus(activePhone, firestoreMsgId, 'sent');
          await updateMessageMetaId(activePhone, firestoreMsgId, res.messageId || '');

          if (modoDemo) {
            // Demo: simula entregado/leído y a veces una respuesta
            setTimeout(() => updateMessageStatus(activePhone, firestoreMsgId, 'delivered'), 1500);
            setTimeout(() => updateMessageStatus(activePhone, firestoreMsgId, 'read'), 3500);
            const t = text.toLowerCase();
            if (/lleg|puerta|camino|ubicac/.test(t)) {
              setTimeout(() => {
                simularMensajeCliente(
                  activePhone,
                  '¡Genial! Gracias por avisar. Ya estoy pendiente de la entrega. 👍'
                );
              }, 6000);
            }
          }
          return true;
        }
        await updateMessageStatus(activePhone, firestoreMsgId, 'failed', res.error || 'Falló el envío');
        onShowToast?.('❌ No se pudo enviar', res.error || 'Revisa tu conexión', 'error');
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [activePhone, credencial, modoDemo, onShowToast]
  );

  // ── Adjuntar archivo (sube a Storage → manda por Meta) ──
  const handleAdjuntarArchivo = useCallback(
    async (file: File) => {
      if (!activePhone) return;
      setIsSending(true);
      try {
        const esImagen = file.type.startsWith('image/');
        const tipo: 'image' | 'document' = esImagen ? 'image' : 'document';

        // Subir a Storage y obtener URL pública (Meta necesita un link)
        let urlPublica = '';
        try {
          urlPublica = await subirMediaChat(user?.uid || 'rider', activePhone, file, file.name, tipo);
        } catch (e: any) {
          onShowToast?.(
            '⚠️ No se pudo subir el archivo',
            e?.message || 'Sin conexión con Storage — intenta de nuevo',
            'warning'
          );
          return;
        }

        const media: MediaMensaje = {
          type: tipo,
          url: urlPublica,
          fileName: file.name,
          fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          caption: file.name,
        };

        const firestoreMsgId = await sendMessageToFirestore(activePhone, {
          direction: 'sent',
          text: tipo === 'image' ? '📷 Imagen' : `📄 ${file.name}`,
          media,
          status: 'pending',
          timestamp: Date.now(),
          senderId: 'rider-meta',
        });

        const res = await sendWhatsAppMessage(credencial, {
          toPhone: activePhone,
          type: tipo,
          mediaUrl: urlPublica,
          caption: file.name,
          filename: file.name,
        });

        if (res.success) {
          await updateMessageStatus(activePhone, firestoreMsgId, 'sent');
          await updateMessageMetaId(activePhone, firestoreMsgId, res.messageId || '');
          if (modoDemo) {
            setTimeout(() => updateMessageStatus(activePhone, firestoreMsgId, 'delivered'), 1200);
            setTimeout(() => updateMessageStatus(activePhone, firestoreMsgId, 'read'), 3000);
          }
        } else {
          await updateMessageStatus(activePhone, firestoreMsgId, 'failed', res.error || 'Falló el envío');
          onShowToast?.('❌ No se pudo enviar', res.error || '', 'error');
        }
      } finally {
        setIsSending(false);
      }
    },
    [activePhone, credencial, modoDemo, user?.uid, onShowToast]
  );

  // ── Enviar ubicación GPS ─────────────────────────────────
  const handleEnviarUbicacion = useCallback(() => {
    if (!activePhone) return;
    const enviar = (lat: number, lng: number, nombre: string) => {
      const media: MediaMensaje = {
        type: 'location',
        url: `https://maps.google.com/?q=${lat},${lng}`,
        latitude: lat,
        longitude: lng,
        locationName: nombre,
      };
      sendMessageToFirestore(activePhone, {
        direction: 'sent',
        text: `📍 ${nombre}`,
        media,
        status: 'sent',
        timestamp: Date.now(),
        senderId: 'rider-meta',
      }).then((id) =>
        sendWhatsAppMessage(credencial, {
          toPhone: activePhone,
          type: 'text',
          text: `📍 Mi ubicación en vivo: https://maps.google.com/?q=${lat},${lng}`,
        }).then((res) => {
          if (res.success && res.messageId) updateMessageMetaId(activePhone, id, res.messageId);
        })
      );
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => enviar(pos.coords.latitude, pos.coords.longitude, 'Mi ubicación actual'),
        () => enviar(-12.046374, -77.042793, 'Ubicación Lima Centro')
      );
    }
  }, [activePhone, credencial]);

  // ── Plantillas aprobadas de Meta (un toque = enviada) ────
  const handleEnviarPlantilla = useCallback(
    async (plantilla: PlantillaMeta, minutosEta?: string) => {
      if (!activePhone) return;
      setEnviandoPlantilla(plantilla.name);
      try {
        const telActivo = normalizarTelefono(activePhone);
        const cliente = clientes.find(
          (c) => normalizarTelefono(String(c.cel || '')) === telActivo
        );

        const resultado = await enviarPlantillaMeta(
          credencial,
          activePhone,
          plantilla,
          cliente
            ? {
                id: cliente.id,
                nombre: cliente.nombre,
                cel: activePhone,
                prod: cliente.prod,
                cobrar: Number(cliente.cobrar || 0),
                dir: cliente.dir,
                dist: cliente.dist,
              }
            : undefined,
          { minutosEta }
        );

        if (resultado.success && resultado.messageId) {
          const firestoreMsgId = await sendMessageToFirestore(activePhone, {
            direction: 'sent',
            text: `${plantilla.emoji} ${plantilla.label} (plantilla${modoDemo ? ' demo' : ''})`,
            status: 'sent',
            timestamp: Date.now(),
            senderId: 'rider-meta',
            templateName: plantilla.name,
          });
          await updateMessageMetaId(activePhone, firestoreMsgId, resultado.messageId);
        } else {
          onShowToast?.('❌ No se pudo enviar', resultado.error || 'Error de Meta', 'error');
        }
      } finally {
        setEnviandoPlantilla(null);
      }
    },
    [activePhone, credencial, clientes, modoDemo, onShowToast]
  );

  // ── Reintentar mensaje fallido ───────────────────────────
  const handleRetryMessage = useCallback(
    async (msg: MensajeRider) => {
      if (!activePhone) return;
      await updateMessageStatus(activePhone, msg.id, 'pending');
      const res = await sendWhatsAppMessage(credencial, {
        toPhone: activePhone,
        type: msg.media ? (msg.media.type as any) : 'text',
        text: msg.text,
        mediaUrl: msg.media?.url,
      });
      if (res.success) {
        await updateMessageStatus(activePhone, msg.id, 'sent');
        await updateMessageMetaId(activePhone, msg.id, res.messageId || '');
      } else {
        await updateMessageStatus(activePhone, msg.id, 'failed', res.error || 'Falló de nuevo');
      }
    },
    [activePhone, credencial]
  );

  // ── Nuevo chat / cambiar estado ──────────────────────────
  const handleCreateNewChat = useCallback(
    async (phone: string, name: string, tags?: string[], notes?: string) => {
      await crearOActualizarChat({
        clientPhone: phone,
        clientName: name,
        status: 'active',
        tags: tags || ['Nuevo'],
        notes: notes || '',
      });
      selectChat(phone);
      onShowToast?.('💬 Chat creado', `${name} — ya puedes escribirle`, 'success');
    },
    [selectChat, onShowToast]
  );

  const handleUpdateStatus = useCallback(
    async (status: EstadoChat) => {
      if (!activeChat) return;
      await crearOActualizarChat({
        clientPhone: activeChat.clientPhone,
        clientName: activeChat.clientName,
        status,
        tags: activeChat.tags,
        notes: activeChat.notes,
      });
    },
    [activeChat]
  );

  const handleSaveTemplates = useCallback((nuevas: PlantillaRapida[]) => {
    setPlantillasRapidas(nuevas);
    guardarPlantillasRapidas(nuevas);
  }, []);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-3 pb-2">
      {/* Cabecera de la vista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 flex-wrap">
              Rider Chat — WhatsApp Oficial
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500 text-slate-950">
                FASE 3.17
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {config?.whatsappMeta?.nombreVerificado ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5 inline" />
                  {config.whatsappMeta.nombreVerificado} ({config.whatsappMeta.numero || 'conectado'})
                </span>
              ) : (
                'El canal oficial de Meta — convive con el Chat Baileys del bot Rudy'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Estado de la conexión */}
          {modoDemo ? (
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-colors"
              title="Configurar el WhatsApp Oficial de Meta"
            >
              <ShieldAlert className="w-4 h-4" />
              Modo demo — configurar
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              Canal oficial activo
            </span>
          )}
          <button
            onClick={() => setShowTemplates(true)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 transition-colors"
            title="Plantillas rápidas"
          >
            <Zap className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Configuración del WhatsApp Oficial (Phone Number ID + token)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Aviso modo demo */}
      {modoDemo && (
        <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200/90 leading-relaxed">
          <b>Modo demo:</b> todavía no hay credencial del WhatsApp Oficial guardada, así que los envíos
          se <b>simulan</b> (quedan en el historial del chat, no le llegan al cliente). Configura el{' '}
          <b>Phone Number ID + token</b> con el botón ⚙️ y todo sale por el canal real de Meta.
        </div>
      )}

      {/* Cuerpo del chat: lista + ventana */}
      <div className="flex rounded-2xl border border-slate-700 overflow-hidden shadow-xl bg-slate-950 h-[calc(100vh-13.5rem)] min-h-[480px]">
        {/* Lista — en móvil se esconde cuando hay un chat abierto */}
        <div className={`${activePhone ? 'hidden sm:flex' : 'flex'} w-full sm:w-80 lg:w-96 flex-col shrink-0`}>
          <ChatList
            chats={chatsFiltrados}
            activePhone={activePhone}
            onSelectChat={selectChat}
            onNewChat={() => setShowNewChat(true)}
            onOpenBroadcast={() => setShowBroadcast(true)}
            filter={filter}
            onFilterChange={setFilter}
            isLoading={isLoadingChats}
            modoDemo={modoDemo}
            fijados={fijados}
            onToggleFijado={handleToggleFijado}
            fotosPerfil={fotosPerfil}
          />
        </div>

        {/* Ventana del chat — en móvil ocupa todo */}
        <div className={`${activePhone ? 'flex' : 'hidden sm:flex'} flex-1 min-w-0`}>
          <ChatWindow
            chat={activeChat}
            messages={messages}
            draft={draft}
            onDraftChange={updateDraft}
            onSendMessage={handleSendMessage}
            onAdjuntarArchivo={handleAdjuntarArchivo}
            onEnviarUbicacion={handleEnviarUbicacion}
            onEnviarPlantilla={handleEnviarPlantilla}
            enviandoPlantilla={enviandoPlantilla}
            onRetryMessage={handleRetryMessage}
            onBack={() => {
              setActivePhone(null);
              guardarChatActivo(null);
            }}
            onUpdateStatus={handleUpdateStatus}
            plantillasRapidas={plantillasRapidas}
            isSending={isSending}
            isLoadingMessages={isLoadingMessages}
            modoDemo={modoDemo}
            fondo={fondo}
            fijado={activePhone ? fijados.has(activePhone) : false}
            onToggleFijado={() => activePhone && handleToggleFijado(activePhone)}
            onAbrirFondo={() => setShowFondo(true)}
            rapidoAbierto={rapidoAbierto}
            onToggleRapido={handleToggleRapido}
            foto={activePhone ? fotosPerfil.get(normalizarTelFoto(activePhone)) : undefined}
          />
        </div>
      </div>

      {/* Modales */}
      <NewChatModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        onCreateChat={handleCreateNewChat}
      />

      <QuickTemplatesModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        templates={plantillasRapidas}
        onSaveTemplates={handleSaveTemplates}
      />

      <BroadcastModal
        isOpen={showBroadcast}
        onClose={() => setShowBroadcast(false)}
        config={credencial}
        clientes={clientes}
        onShowToast={onShowToast}
      />

      <FondoChatModal
        isOpen={showFondo}
        onClose={() => setShowFondo(false)}
        fondoActual={fondo}
        onAplicar={handleAplicarFondo}
        onShowToast={onShowToast}
      />

      {showConfig && (
        <WhatsAppApiModal
          onClose={() => setShowConfig(false)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
