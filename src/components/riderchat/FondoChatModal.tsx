// ═══════════════════════════════════════════════════════════
// 🖼️ FondoChatModal — fondo del chat del Rider Chat (F3.16)
//
// Igual que el del Chat Baileys (Fase 3.3) pero con llaves
// propias: 8 presets (doodle oscuro/claro, papel, bosque, noche,
// carbon, vino) + "Mi foto" de la galería (comprimida a 1080px
// para no reventar el localStorage). Se aplica a TODOS los chats
// del Rider Chat y queda guardado en el teléfono.
// ═══════════════════════════════════════════════════════════

import React, { useRef, useState } from 'react';
import { Palette, X, Check, ImageIcon, Loader2 } from 'lucide-react';
import {
  FondoChatRider,
  FONDOS_RIDERCHAT_PRESET,
  comprimirImagenFondo,
} from '../../utils/riderChatUtils';

interface FondoChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fondo actualmente aplicado (para el check) */
  fondoActual: FondoChatRider;
  /** Aplica un fondo (preset o foto propia ya comprimida) */
  onAplicar: (fondo: FondoChatRider) => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const FondoChatModal: React.FC<FondoChatModalProps> = ({
  isOpen,
  onClose,
  fondoActual,
  onAplicar,
  onShowToast,
}) => {
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const [procesandoFoto, setProcesandoFoto] = useState(false);

  if (!isOpen) return null;

  const aplicarPreset = (f: FondoChatRider) => {
    onAplicar(f);
    onShowToast?.('🖼️ Fondo cambiado', 'Se aplicó a todos tus chats del Rider Chat', 'success');
  };

  /** Foto de la galería → comprimida → fondo personalizado */
  const usarFotoDeFondo = async (file: File | undefined) => {
    if (!file) return;
    setProcesandoFoto(true);
    try {
      const { base64, mimetype } = await comprimirImagenFondo(file);
      const nuevo: FondoChatRider = {
        id: 'personalizada',
        css: `url("data:${mimetype};base64,${base64}") center/cover fixed no-repeat`,
        oscuro: true,
      };
      onAplicar(nuevo);
      onShowToast?.('🖼️ Fondo cambiado', 'Tu foto ya es el fondo de tus chats', 'success');
    } catch (e: any) {
      onShowToast?.('Error con la foto', e?.message || 'Intenta con otra imagen', 'error');
    } finally {
      setProcesandoFoto(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
      onClick={() => !procesandoFoto && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-black text-white">Fondo del chat</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={procesandoFoto}
            title="Cerrar"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grilla de presets + Mi foto */}
        <div className="p-4">
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              usarFotoDeFondo(e.target.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          <div className="grid grid-cols-3 gap-2.5">
            {FONDOS_RIDERCHAT_PRESET.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => aplicarPreset(f)}
                className={`relative h-24 rounded-xl border-2 overflow-hidden transition-all ${
                  fondoActual.id === f.id
                    ? 'border-emerald-500 shadow-lg shadow-emerald-500/20'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
                style={f.css ? { background: f.css } : { background: '#0f172a' }}
                title={f.id === 'por_defecto' ? 'Predeterminado' : f.id.replace(/_/g, ' ')}
              >
                {f.id === 'por_defecto' && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase text-center px-1.5 leading-tight tracking-normal">
                    Predeterminado
                  </span>
                )}
                {fondoActual.id === f.id && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                )}
              </button>
            ))}
            {/* Mi foto */}
            <button
              type="button"
              onClick={() => inputFotoRef.current?.click()}
              disabled={procesandoFoto}
              className={`relative h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50 ${
                fondoActual.id === 'personalizada'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-600 hover:border-slate-400 bg-slate-800/60'
              }`}
              title="Elegir una foto de tu teléfono"
            >
              {procesandoFoto ? (
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              ) : (
                <ImageIcon className="w-5 h-5 text-slate-300" />
              )}
              <span className="text-[10px] font-bold text-slate-300">Mi foto</span>
              {fondoActual.id === 'personalizada' && (
                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </span>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            El fondo se aplica a todos tus chats del Rider Chat y queda guardado en este teléfono
            (como el fondo de WhatsApp). Con <b className="text-slate-300">Mi foto</b> eliges
            cualquier imagen de tu galería.
          </p>
        </div>
      </div>
    </div>
  );
};
