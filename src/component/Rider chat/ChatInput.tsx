// ═══════════════════════════════════════════════════════════
// ⌨️ ChatInput — barra de escritura (Fase 3.15)
// Botones rápidos con PLANTILLAS APROBADAS de Meta (un toque =
// enviadas), plantillas rápidas con variables, adjuntos (foto/
// documento/ubicación GPS) y textarea autoexpandible.
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  MapPin,
  Zap,
  X,
  Loader2,
} from 'lucide-react';
import {
  PlantillaRapida,
} from '../../utils/riderChatUtils';
import {
  PlantillaMeta,
  PLANTILLAS_BOTONES_RAPIDOS,
} from '../../services/riderChatApi';

interface ChatInputProps {
  draft: string;
  onDraftChange: (text: string) => void;
  onSendMessage: (text: string) => Promise<boolean>;
  /** El view sube el archivo a Storage y lo manda por Meta */
  onAdjuntarArchivo?: (file: File) => void;
  onEnviarUbicacion?: () => void;
  /** Plantilla aprobada de Meta (un toque = enviada) */
  onEnviarPlantilla?: (plantilla: PlantillaMeta, minutosEta?: string) => void;
  /** Nombre de la plantilla que está saliendo (spinner) */
  enviandoPlantilla?: string | null;
  plantillasRapidas: PlantillaRapida[];
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
  onEnviarPlantilla,
  enviandoPlantilla,
  plantillasRapidas,
  clientName = 'Cliente',
  isSending = false,
  modoDemo = false,
}) => {
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showTemplatesMenu, setShowTemplatesMenu] = useState(false);
  const [etaPidiendo, setEtaPidiendo] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autoresize del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [draft]);

  const handleSend = async () => {
    if (!draft.trim() || isSending) return;
    const textToSend = draft;
    onDraftChange('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** Plantillas rápidas (texto con variables → al borrador) */
  const aplicarPlantillaRapida = (template: PlantillaRapida) => {
    let content = template.content;
    content = content.replace(/\{\{cliente\}\}/g, clientName);
    content = content.replace(/\{\{rider\}\}/g, 'Rudy');
    onDraftChange(draft ? `${draft}\n${content}` : content);
    setShowTemplatesMenu(false);
    textareaRef.current?.focus();
  };

  /** Plantillas aprobadas de Meta (un toque = enviada directo) */
  const tocarPlantillaMeta = (plantilla: PlantillaMeta) => {
    if (!onEnviarPlantilla) return;
    if (plantilla.name === 'eta_actualizada') {
      setEtaPidiendo(true);
      return;
    }
    onEnviarPlantilla(plantilla);
  };

  const enviarEta = (minutos: string) => {
    setEtaPidiendo(false);
    if (onEnviarPlantilla) onEnviarPlantilla(
      PLANTILLAS_BOTONES_RAPIDOS.find((p) => p.name === 'eta_actualizada')!,
      minutos
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAdjuntarArchivo) return;
    onAdjuntarArchivo(file);
    setShowAttachmentMenu(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const botonPlantilla = (plantilla: PlantillaMeta) => {
    const cargando = enviandoPlantilla === plantilla.name;
    const bloqueado = isSending || enviandoPlantilla !== null;
    return (
      <button
        key={plantilla.name}
        onClick={() => tocarPlantillaMeta(plantilla)}
        disabled={bloqueado}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors active:scale-95 disabled:opacity-50 shrink-0 ${
          plantilla.name === 'qr_metodo_de_pago'
            ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/30'
            : plantilla.name === 'eta_actualizada'
            ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/30'
            : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
        }`}
        title={plantilla.descripcion + (modoDemo ? ' (modo demo)' : '')}
      >
        {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>{plantilla.emoji}</span>}
        <span>{plantilla.label}</span>
      </button>
    );
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

      {/* Botones rápidos con plantillas aprobadas */}
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
        {PLANTILLAS_BOTONES_RAPIDOS.map(botonPlantilla)}
      </div>

      {/* Popover: ¿en cuántos minutos llegas? (ETA) */}
      {etaPidiendo && (
        <div className="absolute bottom-full left-2 mb-2 p-3 bg-slate-800 rounded-2xl shadow-xl border border-slate-700 z-30 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-bold text-slate-200">¿En cuántos minutos llegas?</span>
            <button
              onClick={() => setEtaPidiendo(false)}
              className="p-1 text-slate-400 hover:text-white rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {['5', '10', '15', '20', '30'].map((m) => (
              <button
                key={m}
                onClick={() => enviarEta(m)}
                className="px-3 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Popover: plantillas rápidas (texto al borrador) */}
      {showTemplatesMenu && (
        <div className="absolute bottom-full left-2 sm:left-4 right-2 sm:right-auto mb-2 w-full sm:w-96 max-h-72 overflow-y-auto bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-3 z-30 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 fill-current" /> Plantillas Rápidas
            </span>
            <button
              onClick={() => setShowTemplatesMenu(false)}
              className="p-1 hover:bg-slate-700 rounded-full text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {plantillasRapidas.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => aplicarPlantillaRapida(tmpl)}
                className="w-full text-left p-2 rounded-xl bg-slate-700/40 hover:bg-emerald-500/10 border border-slate-600/60 transition-colors"
              >
                <div className="text-xs font-semibold text-slate-200">{tmpl.title}</div>
                <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{tmpl.content}</div>
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

      {/* Barra principal */}
      <div className="flex items-end gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-full transition-colors"
          title="Adjuntar"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setShowTemplatesMenu(!showTemplatesMenu)}
          className="p-2.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-full transition-colors hidden sm:flex"
          title="Plantillas de respuesta rápida"
        >
          <Zap className="w-5 h-5" />
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
