// ═══════════════════════════════════════════════════════════
// 👤 ChatClientHeader — cabecera del chat abierto (F3.15 · 3.16)
// Avatar con paleta por nombre, pill de estado (activo/cerrado/
// bloqueado), teléfono, abrir en wa.me, llamar, detalles y el
// menú ⋮ con FIJAR CHAT + FONDO DEL CHAT (como el Chat Baileys).
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
  Phone,
  ChevronLeft,
  ExternalLink,
  Copy,
  CheckCircle2,
  XCircle,
  Ban,
  Info,
  Check,
  Pin,
  Palette,
  MoreVertical,
} from 'lucide-react';
import { ChatRider, EstadoChat } from '../../utils/riderChatUtils';
import { formatPhoneNumber, getInitials, getAvatarPalette } from '../../utils/riderChatUtils';

interface ChatClientHeaderProps {
  chat: ChatRider;
  onBack?: () => void;
  onUpdateStatus?: (status: EstadoChat) => void;
  onToggleInfoPanel?: () => void;
  /** ¿El chat está fijado? (Fase 3.16) */
  fijado?: boolean;
  /** Fija / desfija este chat (Fase 3.16) */
  onToggleFijado?: () => void;
  /** Abre el selector de fondo del chat (Fase 3.16) */
  onAbrirFondo?: () => void;
}

export const ChatClientHeader: React.FC<ChatClientHeaderProps> = ({
  chat,
  onBack,
  onUpdateStatus,
  onToggleInfoPanel,
  fijado = false,
  onToggleFijado,
  onAbrirFondo,
}) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const mainMenuRef = useRef<HTMLDivElement>(null);

  const whatsappUrl = `https://wa.me/${chat.clientPhone}`;
  const avatarPalette = getAvatarPalette(chat.clientName);

  // Cerrar dropdowns al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
      if (mainMenuRef.current && !mainMenuRef.current.contains(event.target as Node)) {
        setShowMainMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyPhone = () => {
    try {
      navigator.clipboard.writeText(chat.clientPhone);
    } catch {
      // nada
    }
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const isOnline = chat.status === 'active';

  return (
    <header className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Volver (móvil) */}
        {onBack && (
          <button
            onClick={onBack}
            className="sm:hidden p-2 -ml-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            title="Volver a la lista"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Avatar */}
        <div className="relative shrink-0">
          {chat.avatar ? (
            <img
              src={chat.avatar}
              alt={chat.clientName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/30"
            />
          ) : (
            <div
              className={`w-10 h-10 rounded-full ${avatarPalette.bg} ${avatarPalette.text} font-bold text-sm flex items-center justify-center ring-2 ring-emerald-500/30`}
            >
              {getInitials(chat.clientName)}
            </div>
          )}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-slate-900 ${
              isOnline ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
        </div>

        {/* Nombre + estado + teléfono */}
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-white truncate leading-tight flex items-center gap-1.5">
            <span className="truncate">{chat.clientName}</span>
            {fijado && <Pin className="w-3.5 h-3.5 text-emerald-400 shrink-0 rotate-45" title="Chat fijado" />}
          </h2>

          {/* Fila 2: pill de estado + teléfono (el pill ya dice el estado,
              así el nombre tiene todo el ancho en móvil) */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 min-w-0">
            <div className="relative shrink-0" ref={statusRef}>
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border transition-all ${
                  chat.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : chat.status === 'closed'
                    ? 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}
              >
                {chat.status === 'active' ? 'Activo' : chat.status === 'closed' ? 'Cerrado' : 'Bloqueado'}
              </button>

              {showStatusMenu && (
                <div className="absolute top-full left-0 mt-1 w-36 bg-slate-800 rounded-2xl shadow-xl border border-slate-700 py-1.5 z-30">
                  <button
                    onClick={() => {
                      onUpdateStatus?.('active');
                      setShowStatusMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-400 hover:bg-slate-700/50 font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Activo</span>
                  </button>
                  <button
                    onClick={() => {
                      onUpdateStatus?.('closed');
                      setShowStatusMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/50 font-medium"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cerrado</span>
                  </button>
                  <button
                    onClick={() => {
                      onUpdateStatus?.('blocked');
                      setShowStatusMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700/50 font-medium"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Bloqueado</span>
                  </button>
                </div>
              )}
            </div>

            <span className="font-mono truncate">{formatPhoneNumber(chat.clientPhone)}</span>
            <button
              onClick={handleCopyPhone}
              className="p-0.5 hover:text-emerald-400 transition-colors shrink-0"
              title={copiedPhone ? '¡Copiado!' : 'Copiar número'}
            >
              {copiedPhone ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded-full transition-colors"
          title="Abrir en WhatsApp (app del teléfono)"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <a
          href={`tel:+${chat.clientPhone}`}
          className="hidden sm:block p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          title="Llamar por teléfono"
        >
          <Phone className="w-4 h-4" />
        </a>
        <button
          onClick={onToggleInfoPanel}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          title="Detalles del cliente"
        >
          <Info className="w-4 h-4" />
        </button>

        {/* Menú ⋮ — Fijar chat + Fondo del chat (Fase 3.16, como el Chat Baileys) */}
        <div className="relative" ref={mainMenuRef}>
          <button
            onClick={() => setShowMainMenu(!showMainMenu)}
            className={`p-2 rounded-full transition-colors ${
              showMainMenu
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Más opciones"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMainMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-slate-800 rounded-2xl shadow-xl border border-slate-700 py-1.5 z-30">
              <button
                onClick={() => {
                  onToggleFijado?.();
                  setShowMainMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-700/50 font-medium text-left"
              >
                <Pin className={`w-4 h-4 shrink-0 ${fijado ? 'text-emerald-400' : 'text-slate-300'}`} />
                <span>{fijado ? 'Quitar de fijados' : 'Fijar chat'}</span>
              </button>
              <button
                onClick={() => {
                  onAbrirFondo?.();
                  setShowMainMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-700/50 font-medium text-left"
              >
                <Palette className="w-4 h-4 shrink-0 text-violet-300" />
                <span>Fondo del chat</span>
              </button>
              <div className="mx-3 my-1 border-t border-slate-700/60" />
              <a
                href={`tel:+${chat.clientPhone}`}
                className="sm:hidden w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-700/50 font-medium"
              >
                <Phone className="w-4 h-4 shrink-0 text-slate-300" />
                <span>Llamar por teléfono</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
