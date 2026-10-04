// ═══════════════════════════════════════════════════════════
// ⚡ QuickMessagesPanel — mensajes rápidos DESPLEGABLES (F3.16)
//
// Igual que el "⚡ Rápido" del Chat Baileys (Fase 3.6): una
// pastilla plegable que reemplaza las tiras fijas de plantillas
// y sugerencias que comían espacio en la ventana del chat.
//
// Al desplegar tiene 3 secciones:
//   🚀 Plantillas aprobadas de Meta — un toque = enviadas
//      (con su popover de minutos para la ETA)
//   💡 Sugerencias — texto listo que cae al borrador
//   📝 Plantillas rápidas — las tuyas con {{variables}}
//
// El estado abierto/plegado se recuerda (localStorage) y la
// pastilla muestra un contador para que nunca se pierdan de vista.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  Zap,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  MessageSquareText,
  Lightbulb,
} from 'lucide-react';
import { PlantillaRapida } from '../../utils/riderChatUtils';
import { PlantillaMeta, PLANTILLAS_BOTONES_RAPIDOS } from '../../services/riderChatApi';

interface QuickMessagesPanelProps {
  /** Nombre del cliente (para las variables {{cliente}}) */
  clientName: string;
  /** Texto actual del borrador (para anexar sugerencias) */
  draft: string;
  /** Sugerencias de respuesta (caen al borrador) */
  sugerencias: string[];
  /** Plantillas rápidas propias del rider */
  plantillasRapidas: PlantillaRapida[];
  /** Plantilla aprobada de Meta (un toque = enviada) */
  onEnviarPlantilla?: (plantilla: PlantillaMeta, minutosEta?: string) => void;
  /** Nombre de la plantilla que está saliendo (spinner) */
  enviandoPlantilla?: string | null;
  /** Recibe el texto listo (sugerencia/plantilla rápida) */
  onDraftChange: (text: string) => void;
  /** ¿El panel está desplegado? (estado persistido en el padre) */
  abierto: boolean;
  onToggle: (abierto: boolean) => void;
  isSending?: boolean;
  modoDemo?: boolean;
}

export const QuickMessagesPanel: React.FC<QuickMessagesPanelProps> = ({
  clientName,
  draft,
  sugerencias,
  plantillasRapidas,
  onEnviarPlantilla,
  enviandoPlantilla,
  onDraftChange,
  abierto,
  onToggle,
  isSending = false,
  modoDemo = false,
}) => {
  const [etaPidiendo, setEtaPidiendo] = useState(false);

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
    if (onEnviarPlantilla) {
      onEnviarPlantilla(
        PLANTILLAS_BOTONES_RAPIDOS.find((p) => p.name === 'eta_actualizada')!,
        minutos
      );
    }
  };

  /** Plantillas rápidas (texto con variables → al borrador) */
  const aplicarPlantillaRapida = (template: PlantillaRapida) => {
    let content = template.content;
    content = content.replace(/\{\{cliente\}\}/g, clientName);
    content = content.replace(/\{\{rider\}\}/g, 'Rudy');
    onDraftChange(draft ? `${draft}\n${content}` : content);
  };

  const aplicarSugerencia = (texto: string) => {
    onDraftChange(texto);
  };

  const botonPlantilla = (plantilla: PlantillaMeta) => {
    const cargando = enviandoPlantilla === plantilla.name;
    const bloqueado = isSending || enviandoPlantilla !== null;
    return (
      <button
        key={plantilla.name}
        onClick={() => tocarPlantillaMeta(plantilla)}
        disabled={bloqueado}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 disabled:opacity-50 shrink-0 ${
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

  const total = PLANTILLAS_BOTONES_RAPIDOS.length + sugerencias.length;

  return (
    <div className="relative bg-slate-900/95 border-t border-slate-800 shrink-0 select-none">
      {/* ── Pastilla plegable ── */}
      <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5">
        <button
          type="button"
          onClick={() => onToggle(!abierto)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all active:scale-95 ${
            abierto
              ? 'bg-amber-500/25 text-amber-200 border-amber-400/60'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
          }`}
          title={abierto ? 'Ocultar los mensajes rápidos' : 'Mensajes rápidos: plantillas aprobadas, sugerencias y plantillas tuyas'}
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          Rápido
          <span className="hidden sm:inline opacity-70 font-normal">· {total}</span>
          {abierto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {!abierto && (
          <span className="hidden sm:block text-[10px] text-slate-500 truncate">
            plantillas aprobadas y sugerencias — toca para desplegar
          </span>
        )}
        {modoDemo && (
          <span className="ml-auto text-[10px] text-amber-300/80 font-semibold shrink-0">
            demo
          </span>
        )}
      </div>

      {/* ── Contenido desplegado ── */}
      {abierto && (
        <div className="px-2.5 sm:px-3 pb-2.5 space-y-2.5 max-h-[42vh] overflow-y-auto">
          {/* 1. Plantillas aprobadas de Meta */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Plantillas aprobadas de Meta
              <span className="font-normal normal-case tracking-normal opacity-80">
                — un toque y salen
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PLANTILLAS_BOTONES_RAPIDOS.map(botonPlantilla)}
            </div>

            {/* Popover ETA: ¿en cuántos minutos llegas? */}
            {etaPidiendo && (
              <div className="relative mt-2 p-3 bg-slate-800 rounded-2xl shadow-xl border border-slate-700 z-20 animate-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-bold text-slate-200">¿En cuántos minutos llegas?</span>
                  <button
                    onClick={() => setEtaPidiendo(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['5', '10', '15', '20', '30'].map((m) => (
                    <button
                      key={m}
                      onClick={() => enviarEta(m)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-bold transition-colors active:scale-95"
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Sugerencias de respuesta */}
          {sugerencias.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <Lightbulb className="w-3 h-3 text-amber-400" />
                Sugerencias — caen al borrador
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {sugerencias.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => aplicarSugerencia(sug)}
                    className="text-[11px] text-slate-300 bg-slate-800 hover:bg-emerald-500/15 hover:text-emerald-300 hover:border-emerald-500/40 border border-slate-700 px-3 py-1.5 rounded-full transition-colors font-medium active:scale-95"
                    title="Toca para ponerlo en el borrador"
                  >
                    {sug.length > 64 ? sug.slice(0, 61) + '…' : sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Plantillas rápidas propias */}
          {plantillasRapidas.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <MessageSquareText className="w-3 h-3 text-sky-400" />
                Mis plantillas — {plantillasRapidas.length}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {plantillasRapidas.slice(0, 6).map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => aplicarPlantillaRapida(tmpl)}
                    className="text-left p-2 rounded-xl bg-slate-800/70 hover:bg-emerald-500/10 hover:border-emerald-500/40 border border-slate-700/70 transition-colors"
                    title="Toca para ponerlo en el borrador (las {{variables}} se llenan solas)"
                  >
                    <div className="text-xs font-semibold text-slate-200 truncate">{tmpl.title}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{tmpl.content}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
