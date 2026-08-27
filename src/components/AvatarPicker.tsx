// ═══════════════════════════════════════════════════════════
// 👤 AVATAR PICKER — Fase 1.5
// Galería estilo Netflix/streaming: "¿Quién está repartiendo hoy?"
// Se abre desde el menú hamburguesa (tocando tu avatar) y desde
// Perfil. La elección se guarda en Firestore (usuarios/{uid}.avatar)
// y aparece en header, sidebar y GPS del motorizado.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { X, Check, Sparkles, Loader2 } from 'lucide-react';
import { AVATARES, AvatarSvg, avatarPorId } from '../data/avatars';

interface AvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  avatarActual?: string;
  onSeleccionar: (avatarId: string) => Promise<void> | void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  isOpen,
  onClose,
  avatarActual,
  onSeleccionar,
  onShowToast,
}) => {
  const [seleccionado, setSeleccionado] = useState<string>(avatarActual || 'rider');
  const [guardando, setGuardando] = useState(false);

  if (!isOpen) return null;

  const confirmar = async () => {
    setGuardando(true);
    try {
      await onSeleccionar(seleccionado);
      onShowToast?.(
        '✨ Avatar actualizado',
        `Ahora eres ${avatarPorId(seleccionado).nombre} — se ve en toda la app`,
        'success'
      );
      onClose();
    } catch (e: any) {
      onShowToast?.('❌ No se pudo guardar', e?.message || 'Intenta de nuevo', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="relative p-5 bg-gradient-to-br from-indigo-600/30 via-slate-900 to-slate-900 border-b border-slate-700/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-white">¿Quién reparte hoy?</h2>
              <p className="text-[11px] text-slate-400">
                Elige tu personaje — se muestra en el menú, el header y el GPS
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Grid de avatares */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {AVATARES.map((av) => {
              const activo = seleccionado === av.id;
              return (
                <button
                  key={av.id}
                  onClick={() => setSeleccionado(av.id)}
                  className={`group relative flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all active:scale-95 ${
                    activo
                      ? 'bg-indigo-500/20 border-indigo-400 shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-800/70 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <AvatarSvg
                    id={av.id}
                    className={`w-14 h-14 sm:w-16 sm:h-16 transition-transform group-hover:scale-105 ${activo ? 'rt-pulso' : ''}`}
                    anillo={activo ? 'ring-2 ring-indigo-400' : 'ring-1 ring-slate-600'}
                  />
                  <span
                    className={`text-[10px] font-bold truncate w-full text-center ${
                      activo ? 'text-indigo-300' : 'text-slate-400'
                    }`}
                  >
                    {av.emoji} {av.nombre}
                  </span>
                  {activo && (
                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-indigo-500 border-2 border-slate-900 flex items-center justify-center shadow-lg">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-[10px] text-slate-500 text-center leading-relaxed">
            Ilustraciones propias de RiderTrack — más personajes vendrán en futuras
            versiones 🎨
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/95">
          <button
            onClick={confirmar}
            disabled={guardando}
            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {guardando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Guardando…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> Usar {avatarPorId(seleccionado).nombre}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
