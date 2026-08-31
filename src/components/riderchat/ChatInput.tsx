// ═══════════════════════════════════════════════════════════
// ⌨️ ChatInput — barra de escritura (F3.15 · 3.16)
// Limpia y profesional: emojis (como el Chat Baileys), adjuntos
// (foto/documento/ubicación GPS) y textarea autoexpandible.
// Las plantillas aprobadas y sugerencias se mudaron al PANEL
// DESPLEGABLE ⚡ Rápido que vive justo arriba (QuickMessagesPanel)
// — antes eran tiras fijas que comían media ventana.
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  MapPin,
  Smile,
  Loader2,
} from 'lucide-react';

/** Emojis del rider (misma selección que el Chat Baileys) */
const EMOJIS = ['😊', '😂', '👍', '🙏', '❤️', '🎉', '✅', '🔥', '👌', '😅', '🤝', '💪', '🚀', '📍', '📦', '💰', '⏰', '🙌', '😉', '🥳', '😎', '🤗', '☕', '🍀', '⚡', '🎁', '📸', '👏', '🫡', '🤖'];

interface ChatInputProps {
  draft: string;
  onDraftChange: (text: string) => void;
  onSendMessage: (text: string) => Promise<boolean>;
  /** El view sube el archivo a Storage y lo manda por Meta */
  onAdjuntarArchivo?: (file: File) => void;
  onEnviarUbicacion?: () => void;
  clientName?: string;
  isSending?: boolean;
  modoDemo?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  draft,
  onDraftChange,
  onSendMessage,
  onAdjuntarArchivo,
  onEnviarUbicacion,
  isSending = false,
}) => {
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autoresize del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [draft]);

  // Al escribir con el teclado del teléfono, cerrar los menús
  useEffect(() => {
    setShowEmojis(false);
    setShowAttachmentMenu(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    if (!draft.trim() || isSending) return;
    const textToSend = draft;
    onDraftChange('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setShowEmojis(false);
    await onSendMessage(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertarEmoji = (emoji: string) => {
    onDraftChange(draft + emoji);
    textareaRef.current?.focus();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAdjuntarArchivo) return;
    onAdjuntarArchivo(file);
    setShowAttachmentMenu(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="relative bg-slate-900 border-t border-slate-800 p-2 sm:p-3 shrink-0">
      {/* Input de archivo oculto */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,application/pdf"
      />

      {/* Barra de emojis (como el Chat Baileys) */}
      {showEmojis && (
        <div className="mb-2 p-2 rounded-2xl bg-slate-800/70 border border-slate-700">
          <div className="grid grid-cols-10 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => insertarEmoji(e)}
                className="w-8 h-8 rounded-lg hover:bg-slate-700 text-lg flex items-center justify-center transition-colors active:scale-95"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Popover: adjuntos */}
      {showAttachmentMenu && (
        <div className="absolute bottom-full left-3 mb-2 flex items-center gap-2 p-2 bg-slate-800 rounded-2xl shadow-xl border border-slate-700 z-30 animate-in slide-in-from-bottom-2 duration-150">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded-xl transition-colors text-slate-300"
            title="Enviar foto"
          >
            <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">Foto</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded-xl transition-colors text-slate-300"
            title="Enviar documento PDF"
          >
            <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">Documento</span>
          </button>
          <button
            onClick={() => {
              onEnviarUbicacion?.();
              setShowAttachmentMenu(false);
            }}
            className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded-xl transition-colors text-slate-300"
            title="Enviar mi ubicación GPS"
          >
            <div className="p-2.5 rounded-full bg-red-500/10 text-red-400">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">Ubicación</span>
          </button>
        </div>
      )}

      {/* Barra principal — limpia: emojis + adjuntos + texto + enviar */}
      <div className="flex items-end gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => {
            setShowEmojis((v) => !v);
            setShowAttachmentMenu(false);
          }}
          className={`p-2.5 rounded-full transition-colors ${
            showEmojis ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
          }`}
          title="Emojis"
        >
          <Smile className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowAttachmentMenu((v) => !v);
            setShowEmojis(false);
          }}
          className={`p-2.5 rounded-full transition-colors ${
            showAttachmentMenu ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
          }`}
          title="Adjuntar (foto, documento o ubicación)"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0 bg-slate-800 rounded-2xl border border-slate-700 focus-within:border-emerald-500 transition-all flex items-center px-3 py-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje de WhatsApp..."
            className="w-full bg-transparent text-slate-100 text-xs sm:text-sm resize-none outline-none py-1.5 max-h-32"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || !draft.trim()}
          className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl shadow-md transition-all active:scale-95 shrink-0"
          title="Enviar mensaje"
        >
          {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};
