// ═══════════════════════════════════════════════════════════
// 🪟 ChatWindow — ventana del chat abierto (Fase 3.15)
// Burbujas agrupadas por día ("Hoy", "Ayer", "12 ago"),
// sugerencias rápidas, panel de detalles del cliente y la
// barra de escritura con plantillas aprobadas.
// ═══════════════════════════════════════════════════════════

import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, Tag, FileText, X, Sparkles } from 'lucide-react';
import {
  ChatRider,
  MensajeRider,
  PlantillaRapida,
  MediaMensaje,
  EstadoChat,
} from '../../utils/riderChatUtils';
import {
  formatPhoneNumber,
  getAvatarPalette,
  groupMessagesByDate,
} from '../../utils/riderChatUtils';
import { PlantillaMeta } from '../../services/riderChatApi';
import { ChatClientHeader } from './ChatClientHeader';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInput } from './ChatInput';

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

  // Sugerencias según el último mensaje recibido
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

  const avatarPalette = getAvatarPalette(chat.clientName);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Cabecera */}
      <ChatClientHeader
        chat={chat}
        onBack={onBack}
        onUpdateStatus={onUpdateStatus}
        onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
      />

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
        {isLoadingMessages ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full inline-block border border-slate-800 font-medium">
              Inicio de la conversación por WhatsApp Cloud API
            </p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.dateLabel} className="space-y-3">
              {/* Separador de fecha */}
              <div className="flex items-center justify-center my-3">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="px-3 py-1 bg-slate-900 text-slate-400 text-[11px] font-bold rounded-full border border-slate-800 mx-2">
                  {group.dateLabel}
                </span>
                <div className="h-px bg-slate-800 flex-1" />
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

      {/* Sugerencias rápidas */}
      <div className="px-3 py-1.5 bg-slate-900/80 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 shrink-0">
          <Sparkles className="w-3.5 h-3.5 fill-current" /> Sugerencias:
        </span>
        {sugerencias.map((sug, idx) => (
          <button
            key={idx}
            onClick={() => onDraftChange(sug)}
            className="text-[11px] text-slate-300 bg-slate-800 hover:bg-emerald-500/15 hover:text-emerald-300 border border-slate-700 px-3 py-1 rounded-full shrink-0 transition-colors font-medium"
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Barra de escritura */}
      <ChatInput
        draft={draft}
        onDraftChange={onDraftChange}
        onSendMessage={onSendMessage}
        onAdjuntarArchivo={onAdjuntarArchivo}
        onEnviarUbicacion={onEnviarUbicacion}
        onEnviarPlantilla={onEnviarPlantilla}
        enviandoPlantilla={enviandoPlantilla}
        plantillasRapidas={plantillasRapidas}
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
