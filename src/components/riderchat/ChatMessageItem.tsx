// ═══════════════════════════════════════════════════════════
// 💬 ChatMessageItem — burbuja de mensaje (Fase 3.15)
// Port del MessageItem del RiderChat adaptado al panel oscuro:
// ticks de estado (⏳ ✓ ✓✓ ✓✓azul ❌), media (imagen/audio/
// documento/ubicación), copiar y lightbox.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  Maximize2,
  X,
} from 'lucide-react';
import { MensajeRider } from '../../utils/riderChatUtils';
import { formatMessageTime } from '../../utils/riderChatUtils';

interface ChatMessageItemProps {
  message: MensajeRider;
  clientPhone: string;
  onRetry?: (msg: MensajeRider) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, onRetry }) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isSent = message.direction === 'sent';

  const handleCopy = () => {
    if (message.text) {
      try {
        navigator.clipboard.writeText(message.text);
      } catch {
        // clipboard bloqueado — no crítico
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderStatusTicks = () => {
    if (!isSent) return null;
    switch (message.status) {
      case 'pending':
        return (
          <span title="Enviando...">
            <Clock className="w-3.5 h-3.5 text-emerald-200 animate-pulse" />
          </span>
        );
      case 'sent':
        return (
          <span title="Enviado a WhatsApp">
            <Check className="w-3.5 h-3.5 text-emerald-200 stroke-[2.5]" />
          </span>
        );
      case 'delivered':
        return (
          <span title="Entregado al cliente">
            <CheckCheck className="w-4 h-4 text-emerald-200 stroke-[2.5]" />
          </span>
        );
      case 'read':
        return (
          <span title="Leído por el cliente">
            <CheckCheck className="w-4 h-4 text-sky-300 stroke-[3]" />
          </span>
        );
      case 'failed':
        return (
          <button
            onClick={() => onRetry && onRetry(message)}
            className="inline-flex items-center gap-1 text-red-200 hover:text-white bg-red-800/40 px-1.5 py-0.5 rounded text-xs transition-colors"
            title="Falló — toca para reintentar"
          >
            <AlertCircle className="w-3.5 h-3.5 text-red-300" />
            <span className="text-[10px]">Falló — Reintentar</span>
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`group relative flex w-full my-1.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%]">
        {/* Burbuja */}
        <div
          className={`relative rounded-2xl px-3.5 py-2.5 transition-all ${
            isSent
              ? 'bg-emerald-700 text-white rounded-tr-none'
              : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-none'
          }`}
        >
          {/* Copiar (hover) */}
          <button
            onClick={handleCopy}
            className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md ${
              isSent
                ? 'bg-emerald-800/80 hover:bg-emerald-900 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
            title={copied ? '¡Copiado!' : 'Copiar mensaje'}
          >
            {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
          </button>

          {/* Media */}
          {message.media && (
            <div className="mb-2 overflow-hidden rounded-xl">
              {/* Imagen */}
              {message.media.type === 'image' && (
                <div className="relative group/media cursor-pointer">
                  <img
                    src={message.media.url}
                    alt={message.media.caption || 'Imagen adjunta'}
                    className="w-full max-h-64 object-cover rounded-xl border border-black/10"
                    onClick={() => setIsLightboxOpen(true)}
                    loading="lazy"
                  />
                  <button
                    onClick={() => setIsLightboxOpen(true)}
                    className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Audio */}
              {message.media.type === 'audio' && (
                <div className={`flex items-center gap-3 p-2.5 rounded-xl ${isSent ? 'bg-emerald-800/50' : 'bg-slate-700/60'}`}>
                  <div className="p-2.5 rounded-full bg-emerald-600 text-white">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-24">
                    <div className="flex items-center gap-1 h-5">
                      {[40, 70, 30, 90, 50, 80, 20, 60, 100, 40, 75, 30].map((h, idx) => (
                        <span
                          key={idx}
                          className={`w-1 rounded-full ${isSent ? 'bg-emerald-200/60' : 'bg-slate-400'}`}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <div className="text-[10px] opacity-80 mt-1">Nota de voz</div>
                  </div>
                  {message.media.url && (
                    <a
                      href={message.media.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-white/70 hover:text-white"
                      title="Reproducir (abre en pestaña)"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}

              {/* Documento */}
              {message.media.type === 'document' && (
                <a
                  href={message.media.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                    isSent
                      ? 'bg-emerald-800/40 border-emerald-500/30 hover:bg-emerald-800/70'
                      : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {message.media.fileName || 'Documento adjunto'}
                    </p>
                    <p className="text-[10px] opacity-75">Toca para abrir</p>
                  </div>
                  <ExternalLink className="w-4 h-4 opacity-70" />
                </a>
              )}

              {/* Ubicación */}
              {message.media.type === 'location' && (
                <a
                  href={`https://maps.google.com/?q=${message.media.latitude},${message.media.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${
                    isSent
                      ? 'bg-emerald-800/50 border-emerald-500/30 hover:bg-emerald-800/80'
                      : 'bg-slate-700/60 border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  <div className="p-2 rounded-full bg-emerald-500 text-white">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-semibold">Ubicación GPS</p>
                    <p className="text-[10px] opacity-80 truncate">
                      {message.media.locationName || `${message.media.latitude}, ${message.media.longitude}`}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              )}
            </div>
          )}

          {/* Texto */}
          {message.text && (
            <p className="text-[13.5px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words select-text">
              {message.text}
            </p>
          )}

          {/* Error */}
          {message.status === 'failed' && message.errorMessage && (
            <p className="mt-1 text-[11px] text-red-200 bg-red-900/40 p-1.5 rounded border border-red-500/30 break-words">
              {message.errorMessage}
            </p>
          )}

          {/* Hora + ticks */}
          <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] opacity-80">
            <span>{formatMessageTime(message.timestamp)}</span>
            {renderStatusTicks()}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {isLightboxOpen && message.media?.url && (
        <div
          className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(false);
            }}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={message.media.url}
            alt="Vista completa"
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
