// ═══════════════════════════════════════════════════════════
// 👤 AVATAR PICKER — Fase 2.13
// Galería con los DISEÑOS PROPIOS del equipo en 4 categorías
// (Rider / Tecnología / Animales / Gaming) + los clásicos SVG.
// Se abre desde el menú hamburguesa (tocando tu avatar) y desde
// Perfil. La elección se guarda en Firestore (usuarios/{uid}.avatar)
// y aparece en header, sidebar y GPS del motorizado.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Sparkles, Loader2 } from 'lucide-react';
import {
  AVATARES,
  AVATAR_DEFAULT,
  CATEGORIAS,
  CategoriaAvatar,
  AvatarSvg,
  avatarPorId,
  categoriaDeAvatar,
} from '../data/avatars';

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
  const [seleccionado, setSeleccionado] = useState<string>(avatarActual || AVATAR_DEFAULT);
  // pestaña inicial = categoría del avatar actual (para verlo marcado)
  const [categoria, setCategoria] = useState<CategoriaAvatar>(categoriaDeAvatar(avatarActual));
  const [guardando, setGuardando] = useState(false);

  // Si la pestaña activa queda fuera de pantalla (fila scrolleable),
  // centrarla al abrir para que el rider vea su categoría marcada.
  const chipActivoRef = useRef<HTMLButtonElement | null>(null);
  const estabaAbierto = useRef(false);
  useEffect(() => {
    if (isOpen && !estabaAbierto.current) {
      // abrir siempre desde el avatar actual (el picker puede quedar
      // montado en cerrado y conservar estado viejo)
      setSeleccionado(avatarActual || AVATAR_DEFAULT);
      setCategoria(categoriaDeAvatar(avatarActual));
      requestAnimationFrame(() => {
        chipActivoRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
      });
    }
    estabaAbierto.current = isOpen;
  }, [isOpen, avatarActual]);

  if (!isOpen) return null;

  const deCategoria = AVATARES.filter((a) => a.categoria === categoria);
  const seleccionadoDef = avatarPorId(seleccionado);

  const confirmar = async () => {
    setGuardando(true);
    try {
      await onSeleccionar(seleccionado);
      onShowToast?.(
        '✨ Avatar actualizado',
        `Ahora eres ${seleccionadoDef.nombre} — se ve en toda la app`,
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
                32 diseños propios en 4 estilos — se muestra en el menú, el header y el GPS
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

        {/* Pestañas de categoría */}
        <div className="px-3 pt-3 pb-1 border-b border-slate-700/60">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 -mb-px">
            {CATEGORIAS.map((cat) => {
              const activo = categoria === cat.id;
              const n = AVATARES.filter((a) => a.categoria === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoria(cat.id)}
                  ref={categoria === cat.id ? chipActivoRef : undefined}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all active:scale-95 flex items-center gap-1.5 ${
                    activo
                      ? 'bg-indigo-500/25 border-indigo-400 text-indigo-200'
                      : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  <span className="text-sm leading-none">{cat.emoji}</span>
                  {cat.nombre}
                  <span
                    className={`px-1.5 py-px rounded-md text-[9px] ${
                      activo ? 'bg-indigo-400/30 text-indigo-100' : 'bg-slate-700/70 text-slate-500'
                    }`}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid de avatares de la categoría */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {deCategoria.map((av) => {
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
            {categoria === 'clasicos'
              ? 'Los clásicos SVG de la primera versión — siguen disponibles por si te encariñaste 🎨'
              : 'Ilustraciones diseñadas por el equipo RiderTrack 🎨 — incluidas en el APK, sin internet'}
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/95">
          {seleccionadoDef.categoria !== categoria && (
            <p className="mb-2 text-[10px] text-amber-400/90 text-center">
              ⚠️ Tu selección ({seleccionadoDef.nombre}) está en otra pestaña — igual se guardará
            </p>
          )}
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
                <AvatarSvg id={seleccionado} className="w-6 h-6 rounded-lg" />
                <span className="truncate">Usar {seleccionadoDef.nombre}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
