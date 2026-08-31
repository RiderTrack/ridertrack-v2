// ═══════════════════════════════════════════════════════════
// 📋 ChatList — lista de conversaciones (Fase 3.15 · 3.16)
// Búsqueda, tabs de estado (todos/activos/cerrados/bloqueados),
// badges de no leídos con pulso, avatar con paleta por nombre y
// CHATS FIJADOS: sección propia arriba + botón 📌 en cada fila
// (igual que el Chat Baileys / WhatsApp).
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Search, X, Plus, MessageSquare, Image as ImageIcon, FileText, MapPin, Tag, Rocket, Pin, PinOff } from 'lucide-react';
import { ChatRider, FiltrosChat } from '../../utils/riderChatUtils';
import { formatMessageTime, getInitials, truncateText, getAvatarPalette } from '../../utils/riderChatUtils';
import { normalizarTelFoto } from '../../services/fotosPerfil';

interface ChatListProps {
  chats: ChatRider[];
  activePhone: string | null;
  onSelectChat: (phone: string) => void;
  onNewChat: () => void;
  onOpenBroadcast: () => void;
  filter: FiltrosChat;
  onFilterChange: (newFilter: FiltrosChat) => void;
  isLoading?: boolean;
  modoDemo?: boolean;
  /** Teléfonos fijados (Fase 3.16) */
  fijados: Set<string>;
  /** Fija / desfija desde la fila de la lista */
  onToggleFijado: (phone: string) => void;
  /** Fotos de perfil reales por teléfono (Fase 3.17) */
  fotosPerfil?: Map<string, string>;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  activePhone,
  onSelectChat,
  onNewChat,
  onOpenBroadcast,
  filter,
  onFilterChange,
  isLoading = false,
  modoDemo = false,
  fijados,
  onToggleFijado,
  fotosPerfil,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filter, search: e.target.value });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 shrink-0 select-none">
      {/* Cabecera */}
      <div className="p-3.5 pb-2 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-2xl bg-emerald-600 text-white shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-white text-base leading-tight truncate">Rider Chat</h1>
              <p className="text-[11px] text-slate-500">
                {modoDemo ? 'Modo demo (sin configurar Meta)' : 'WhatsApp Oficial — Cloud API'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenBroadcast}
              className="p-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-95 text-white rounded-2xl transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Broadcast con plantillas aprobadas"
            >
              <Rocket className="w-4 h-4" />
              <span className="hidden md:inline">Broadcast</span>
            </button>
            <button
              onClick={onNewChat}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Nuevo chat"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">Nuevo</span>
            </button>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={filter.search}
            onChange={handleSearchChange}
            placeholder="Buscar por cliente o teléfono..."
            className="w-full bg-slate-800 text-slate-100 placeholder:text-slate-500 text-xs rounded-xl pl-9 pr-8 py-2.5 border border-transparent focus:border-emerald-500 focus:bg-slate-900 outline-none transition-all"
          />
          {filter.search && (
            <button
              onClick={() => onFilterChange({ ...filter, search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tabs de estado */}
        <div className="flex items-center gap-1 mt-2.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'active', label: 'Activos' },
            { id: 'closed', label: 'Cerrados' },
            { id: 'blocked', label: 'Bloqueados' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onFilterChange({ ...filter, status: tab.id as FiltrosChat['status'] })}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all shrink-0 ${
                filter.status === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversaciones — fijados arriba (sección propia) y el resto abajo */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : chats.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-sm font-medium">No hay conversaciones</p>
            <p className="text-xs mt-1">Crea un chat nuevo con el botón + o manda un broadcast.</p>
          </div>
        ) : (
          (() => {
            const fijadosList = chats.filter((c) => fijados.has(c.clientPhone));
            const resto = chats.filter((c) => !fijados.has(c.clientPhone));
            return (
              <>
                {fijadosList.length > 0 && (
                  <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
                    <Pin className="w-3 h-3 rotate-45" /> Fijados · {fijadosList.length}
                  </div>
                )}
                {fijadosList.map((chat) => (
                  <ItemChat
                    key={`f-${chat.clientPhone}`}
                    chat={chat}
                    isSelected={activePhone === chat.clientPhone}
                    fijado={true}
                    onSelectChat={onSelectChat}
                    onToggleFijado={onToggleFijado}
                    foto={fotosPerfil?.get(normalizarTelFoto(chat.clientPhone))}
                  />
                ))}
                {fijadosList.length > 0 && resto.length > 0 && (
                  <div className="mx-4 my-2 border-t border-slate-800" />
                )}
                {resto.length > 0 && fijadosList.length > 0 && (
                  <div className="px-4 pt-1 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Todos los chats · {resto.length}
                  </div>
                )}
                {resto.map((chat) => (
                  <ItemChat
                    key={chat.clientPhone}
                    chat={chat}
                    isSelected={activePhone === chat.clientPhone}
                    fijado={false}
                    onSelectChat={onSelectChat}
                    onToggleFijado={onToggleFijado}
                    foto={fotosPerfil?.get(normalizarTelFoto(chat.clientPhone))}
                  />
                ))}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
};

/** Fila de conversación (con botón 📌 para fijar sin abrir el chat) */
const ItemChat: React.FC<{
  chat: ChatRider;
  isSelected: boolean;
  fijado: boolean;
  onSelectChat: (phone: string) => void;
  onToggleFijado: (phone: string) => void;
  /** Foto de perfil real de WhatsApp (Fase 3.17) */
  foto?: string;
}> = ({ chat, isSelected, fijado, onSelectChat, onToggleFijado, foto }) => {
  const [fotoRota, setFotoRota] = useState(false);
  const iconoTipoMensaje = (type?: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-emerald-400 inline mr-1 shrink-0" />;
      case 'audio':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-400 inline mr-1 shrink-0" />;
      case 'document':
        return <FileText className="w-3.5 h-3.5 text-blue-400 inline mr-1 shrink-0" />;
      case 'location':
        return <MapPin className="w-3.5 h-3.5 text-red-400 inline mr-1 shrink-0" />;
      default:
        return null;
    }
  };

  const palette = getAvatarPalette(chat.clientName);
  const unread = chat.unreadCount > 99 ? '99+' : chat.unreadCount;

  return (
    <div
      onClick={() => onSelectChat(chat.clientPhone)}
      className={`group/row flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-emerald-500/10 border-l-4 border-emerald-500'
          : 'hover:bg-slate-800/60 border-l-4 border-transparent'
      }`}
    >
      {/* Avatar — foto real de WhatsApp si existe (Fase 3.17) */}
      <div className="relative shrink-0">
        {(chat.avatar || foto) && !fotoRota ? (
          <img
            src={chat.avatar || foto}
            alt={chat.clientName}
            onError={() => setFotoRota(true)}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/40 bg-slate-700"
          />
        ) : (
          <div
            className={`w-12 h-12 rounded-full ${palette.bg} ${palette.text} font-bold text-sm flex items-center justify-center border-2 ${palette.border}`}
          >
            {getInitials(chat.clientName)}
          </div>
        )}

        {chat.status === 'active' && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-slate-900" />
        )}

        {/* No leídos */}
        {chat.unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 z-20 flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex items-center justify-center bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 min-w-[20px] h-[20px] rounded-full shadow-md border-2 border-slate-900">
              {unread}
            </span>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1 min-w-0">
            <span className="truncate">{chat.clientName}</span>
            {fijado && <Pin className="w-3 h-3 text-emerald-400 shrink-0 rotate-45" />}
          </h3>
          <span className="text-[10px] text-slate-500 shrink-0 font-medium ml-1">
            {formatMessageTime(chat.lastMessageTime)}
          </span>
        </div>

        <p className="text-xs text-slate-400 truncate flex items-center">
          {iconoTipoMensaje(chat.lastMessageType)}
          <span>{truncateText(chat.lastMessage, 34)}</span>
        </p>

        {chat.tags && chat.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <Tag className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium truncate max-w-32 border border-slate-700/60">
              {chat.tags[0]}
            </span>
          </div>
        )}
      </div>

      {/* Botón fijar / desfijar (no abre el chat) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFijado(chat.clientPhone);
        }}
        className={`p-1.5 rounded-full transition-all shrink-0 self-center ${
          fijado
            ? 'text-emerald-400 bg-emerald-500/10'
            : 'text-slate-600 hover:text-amber-300 opacity-60 sm:opacity-40 group-hover/row:opacity-100 hover:bg-amber-500/10'
        }`}
        title={fijado ? 'Quitar de fijados' : 'Fijar chat (se queda arriba de la lista)'}
      >
        {fijado ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
      </button>
    </div>
  );
};
