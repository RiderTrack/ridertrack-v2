// ═══════════════════════════════════════════════════════════
// 🧭 NAVEGAR BUTTON - RiderTrack V2 (Fase 2.2)
// Botón "Navegar" reutilizable que respeta la app preferida:
//   • Google Maps → abre directo (azul)
//   • Waze        → abre directo (cian)
//   • Preguntar   → muestra un mini-selector con ambas apps
//
// Se usa en la ficha del cliente del mapa, en el banner de
// "siguiente parada" y donde haga falta llevar al cliente.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from 'lucide-react';
import {
  AppNavegacion,
  getAppNavegacion,
  urlNavegacionGoogle,
  urlNavegacionWaze,
  EVENTO_NAV_CHANGED,
} from '../services/navegacion';

interface NavegarButtonProps {
  lat: number;
  lng: number;
  /** Tamaño visual: sm para fichas del mapa, md para banners */
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
}

export const NavegarButton: React.FC<NavegarButtonProps> = ({
  lat,
  lng,
  size = 'sm',
  className = '',
  label = 'Navegar',
}) => {
  const [app, setApp] = useState<AppNavegacion>(getAppNavegacion());
  const [abierto, setAbierto] = useState(false);
  const contRef = useRef<HTMLDivElement>(null);

  // Reaccionar al cambio de preferencia desde Configuración
  useEffect(() => {
    const onUpdate = () => {
      setApp(getAppNavegacion());
      setAbierto(false);
    };
    window.addEventListener(EVENTO_NAV_CHANGED, onUpdate);
    return () => window.removeEventListener(EVENTO_NAV_CHANGED, onUpdate);
  }, []);

  // Cerrar el mini-selector al tocar fuera
  useEffect(() => {
    if (!abierto) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (contRef.current && !contRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [abierto]);

  const pad = size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-3 py-1.5 text-[11px]';
  const icon = size === 'md' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5';

  // Preferencia fija → link directo a la app elegida
  if (app === 'google' || app === 'waze') {
    const esGoogle = app === 'google';
    return (
      <a
        href={esGoogle ? urlNavegacionGoogle(lat, lng) : urlNavegacionWaze(lat, lng)}
        target="_blank"
        rel="noopener noreferrer"
        title={`Navegar con ${esGoogle ? 'Google Maps' : 'Waze'}`}
        className={`flex items-center gap-1.5 ${pad} rounded-xl font-bold text-white shadow-md transition-all active:scale-95 ${
          esGoogle
            ? 'bg-blue-600 hover:bg-blue-500'
            : 'bg-cyan-600 hover:bg-cyan-500'
        } ${className}`}
      >
        <Navigation className={icon} /> {label}
        <span className="opacity-70 font-medium">· {esGoogle ? 'Google' : 'Waze'}</span>
      </a>
    );
  }

  // "Preguntar" → botón que despliega el mini-selector
  return (
    <div className="relative inline-block" ref={contRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className={`flex items-center gap-1.5 ${pad} rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition-all active:scale-95 ${className}`}
      >
        <Navigation className={icon} /> {label}
      </button>

      {abierto && (
        <div className="absolute bottom-full mb-2 right-0 z-30 w-44 rounded-xl bg-slate-900/98 backdrop-blur-md border border-slate-700 shadow-2xl overflow-hidden">
          <p className="px-3 pt-2.5 pb-1 text-[9px] uppercase font-bold text-slate-500">
            Navegar con…
          </p>
          <a
            href={urlNavegacionGoogle(lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAbierto(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-blue-600/20 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-black">G</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">Google Maps</p>
              <p className="text-[9px] text-slate-400">modo moto</p>
            </div>
          </a>
          <a
            href={urlNavegacionWaze(lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAbierto(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-cyan-600/20 transition-colors border-t border-slate-700/60"
          >
            <span className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center text-white text-sm">🚗</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">Waze</p>
              <p className="text-[9px] text-slate-400">alertas de tráfico</p>
            </div>
          </a>
        </div>
      )}
    </div>
  );
};
