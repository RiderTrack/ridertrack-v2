// ═══════════════════════════════════════════════════════════
// 🪟 ChatWindow — ventana del chat abierto (F3.15 · 3.16)
// Burbujas agrupadas por día ("Hoy", "Ayer", "12 ago") sobre el
// FONDO elegido por el rider (como WhatsApp), panel de detalles
// del cliente, aviso profesional de la ventana de 24 h de Meta
// y los MENSAJES RÁPIDOS DESPLEGABLES encima de la barra de
// escritura (antes eran dos tiras fijas que comían espacio).
// ═══════════════════════════════════════════════════════════

import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, Tag, FileText, X, Clock } from 'lucide-react';
import {
  ChatRider,
  MensajeRider,
  PlantillaRapida,
  EstadoChat,
  FondoChatRider,
  formatPhoneNumber,
  getAvatarPalette,
  groupMessagesByDate,
  ventana24hCerrada,
} from '../../utils/riderChatUtils';
import { PlantillaMeta } from '../../services/riderChatApi';
import { ChatClientHeader } from './ChatClientHeader';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInput } from './ChatInput';
import { QuickMessagesPanel } from './QuickMessagesPanel';

interface ChatWindowProps {
  chat: ChatRider | null;
  messages: MensajeRider[];
  draft: string;
  onDraftChange: (text: string) => void;
  onSendMessage: (text: string) => Promise<boolean>;
  onAdjuntarArchivo?: (file: File) => void;
  onEnviarUbicacion?: () => void;
  onEnviarPlantilla?: (plantilla: PlantillaMeta, minutosEta?: string) => void;
  enviandoPlantilla?: string | null;
  onRetryMessage?: (msg: MensajeRider) => void;
  onBack?: () => void;
  onUpdateStatus?: (status: EstadoChat) => void;
  plantillasRapidas: PlantillaRapida[];
  isSending?: boolean;
  isLoadingMessages?: boolean;
  modoDemo?: boolean;
  /** Fondo del chat elegido por el rider (Fase 3.16) */
  fondo: FondoChatRider;
  /** ¿El chat está fijado? (Fase 3.16) */
  fijado?: boolean;
  /** Fija / desfija este chat (Fase 3.16) */
  onToggleFijado?: () => void;
  /** Abre el selector de fondo (Fase 3.16) */
  onAbrirFondo?: () => void;
  /** ¿El panel de mensajes rápidos está desplegado? (Fase 3.16) */
  rapidoAbierto: boolean;
  onToggleRapido: (abierto: boolean) => void;
  /** Foto de perfil real de WhatsApp (Fase 3.17) */
  foto?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chat,
  messages,
  draft,
  onDraftChange,
  onSendMessage,
  onAdjuntarArchivo,
  onEnviarUbicacion,
  onEnviarPlantilla,
  enviandoPlantilla,
  onRetryMessage,
  onBack,
  onUpdateStatus,
  plantillasRapidas,
  isSending = false,
  isLoadingMessages = false,
  modoDemo = false,
  fondo,
  fijado = false,
  onToggleFijado,
  onAbrirFondo,
  rapidoAbierto,
  onToggleRapido,
  foto,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chat?.isTyping]);

  if (!chat) {
    return (
      <div className="hidden sm:flex flex-1 flex-col items-center justify-center p-6 bg-slate-950 text-slate-500 select-none">
        <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
          <MessageSquare className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-bold text-slate-300">Rider Chat — WhatsApp Oficial</h3>
        <p className="text-xs text-center max-w-sm mt-1 leading-relaxed">
          Elige una conversación de la lista para ver el historial y responder. O crea un chat nuevo
          con el botón + de arriba.
        </p>
      </div>
    );
  }

  // Agrupar mensajes por fecha
  const groupedMessages = groupMessagesByDate(messages);

  // Sugerencias según el último mensaje recibido (van al panel rápido)
  const ultimoRecibido = [...messages].reverse().find((m) => m.direction === 'received');
  const sugerencias = ultimoRecibido
    ? [
        `¡Hola ${chat.clientName.split(' ')[0]}! Ya voy en camino con tu pedido. 🛵`,
        `Entendido. ¿Alguna referencia de la fachada para ubicar mejor? 🏠`,
        `¡Conforme! Comprobante recibido correctamente. 👍`,
      ]
    : [
        `¡Hola ${chat.clientName.split(' ')[0]}! ¿En qué puedo ayudarte hoy?`,
        `Por favor confírmame si el pago será en efectivo o Yape/Plin. 📲`,
      ];

  // Ventana de 24 h de Meta: fuera de ella solo plantillas aprobadas
  const fueraDeVentana = !modoDemo && ventana24hCerrada(messages);

  const avatarPalette = getAvatarPalette(chat.clientName);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Cabecera (con ⋮ → fijar chat + fondo del chat) */}
      <ChatClientHeader
        chat={chat}
        onBack={onBack}
        onUpdateStatus={onUpdateStatus}
        onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
        fijado={fijado}
        onToggleFijado={onToggleFijado}
        onAbrirFondo={onAbrirFondo}
        foto={foto}
      />

      {/* Mensajes — con el fondo elegido (como WhatsApp) */}
      <div
        className={`flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 transition-colors ${
          fondo.css ? '' : 'bg-slate-950'
        }`}
        style={fondo.css ? { background: fondo.css } : undefined}
      >
        {isLoadingMessages ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xs text-slate-300/90 bg-slate-950/60 px-3 py-1.5 rounded-full inline-block border border-slate-700/60 font-medium backdrop-blur-sm">
              Inicio de la conversación por WhatsApp Cloud API
            </p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.dateLabel} className="space-y-3">
              {/* Separador de fecha */}
              <div className="flex items-center justify-center my-3">
                <span className="px-3 py-1 bg-slate-950/75 text-slate-300 text-[11px] font-bold rounded-full border border-slate-700/60 backdrop-blur-sm mx-auto">
                  {group.dateLabel}
                </span>
              </div>

              {group.messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  clientPhone={chat.clientPhone}
                  onRetry={onRetryMessage}
                />
              ))}
            </div>
          ))
        )}

        {/* Aviso ventana de 24 h (Meta) — profesional: fuera de la
            ventana los mensajes libres no llegan, solo plantillas */}
        {fueraDeVentana && messages.length > 0 && (
          <div className="flex items-center justify-center my-2">
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-600/30 backdrop-blur-sm max-w-md">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Pasaron más de <b>24 h</b> desde el último mensaje del cliente — Meta solo deja
                enviar <b>plantillas aprobadas</b> (⚡ Rápido) hasta que él te vuelva a escribir.
              </p>
            </div>
          </div>
        )}

        {/* Escribiendo… */}
        {chat.isTyping && (
          <div className="flex items-center gap-2 my-2">
            <div className="flex items-center gap-1 px-3.5 py-2 rounded-full bg-slate-800 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
            </div>
            <span className="text-[11px] text-slate-500 italic">{chat.clientName} está escribiendo...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Mensajes rápidos DESPLEGABLES (Fase 3.16) — reemplaza las
          tiras fijas de plantillas y sugerencias */}
      <QuickMessagesPanel
        clientName={chat.clientName}
        draft={draft}
        sugerencias={sugerencias}
        plantillasRapidas={plantillasRapidas}
        onEnviarPlantilla={onEnviarPlantilla}
        enviandoPlantilla={enviandoPlantilla}
        onDraftChange={onDraftChange}
        abierto={rapidoAbierto}
        onToggle={onToggleRapido}
        isSending={isSending}
        modoDemo={modoDemo}
      />

      {/* Barra de escritura */}
      <ChatInput
        draft={draft}
        onDraftChange={onDraftChange}
        onSendMessage={onSendMessage}
        onAdjuntarArchivo={onAdjuntarArchivo}
        onEnviarUbicacion={onEnviarUbicacion}
        clientName={chat.clientName}
        isSending={isSending}
        modoDemo={modoDemo}
      />

      {/* Panel de detalles (deslizable) */}
      {showInfoPanel && (
        <div className="absolute top-0 right-0 bottom-0 w-72 sm:w-80 bg-slate-900 border-l border-slate-800 shadow-2xl p-5 z-30 overflow-y-auto animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-slate-200 text-sm">Detalles del Cliente</h3>
            <button
              onClick={() => setShowInfoPanel(false)}
              className="p-1 hover:bg-slate-800 rounded-full text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-4 space-y-5">
            <div className="text-center">
              {chat.avatar ? (
                <img
                  src={chat.avatar}
                  alt={chat.clientName}
                  className="w-16 h-16 rounded-full object-cover mx-auto mb-2 border-2 border-emerald-500"
                />
              ) : (
                <div
                  className={`w-16 h-16 rounded-full ${avatarPalette.bg} ${avatarPalette.text} font-black text-xl flex items-center justify-center mx-auto mb-2 border-2 ${avatarPalette.border}`}
                >
                  {chat.clientName.substring(0, 2).toUpperCase()}
                </div>
              )}
              <h4 className="font-bold text-white text-base">{chat.clientName}</h4>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{formatPhoneNumber(chat.clientPhone)}</p>
            </div>

            {/* Etiquetas */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-400" /> Etiquetas
              </label>
              <div className="flex flex-wrap gap-1.5">
                {chat.tags && chat.tags.length > 0 ? (
                  chat.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">Sin etiquetas</span>
                )}
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" /> Notas de Entrega
              </label>
              <p className="text-xs text-slate-300 bg-slate-800 p-3 rounded-2xl border border-slate-700 leading-relaxed">
                {chat.notes || 'Sin notas registradas para este cliente.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
