// ═══════════════════════════════════════════════════════════
// 🧭 NAVEGAR BUTTON - RiderTrack V2 (Fase 2.2)
// Botón "Navegar" reutilizable que respeta la app preferida:
//   • Google Maps → abre directo (azul)
//   • Waze        → abre directo (cian)
//   • Preguntar   → muestra un mini-selector con ambas apps
//
// Se usa en la ficha del cliente del mapa, en el banner de
// "siguiente parada" y donde haga falta llevar al cliente.
//
// (Fase 2.12) FIX mini-selector CORTADO: antes el menú se alineaba
// SIEMPRE con right-0 + bottom-full (pensado para un botón en la
// esquina inferior derecha). Pero en la FICHA del cliente el botón
// Navegar vive a la IZQUIERDA (WhatsApp | Navegar | Directo) → el
// menú de 176px salía disparado fuera de pantalla: se veía "comido"
// por el borde izquierdo (left = -57px en un celular de 360px).
// Ahora el menú mide el espacio disponible al abrirse y se voltea
// solo hacia donde SÍ cabe: izquierda/derecha y arriba/abajo.
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
  // (Fase 2.12) Alineación inteligente del mini-selector: hacia
  // qué lado desplegar para NO salirse de la pantalla.
  const [lado, setLado] = useState<'izq' | 'der'>('der');
  const [vertical, setVertical] = useState<'arriba' | 'abajo'>('arriba');

  // Medir al abrir: ¿hacia dónde hay espacio para el menú?
  useEffect(() => {
    if (!abierto || !contRef.current) return;
    const r = contRef.current.getBoundingClientRect();
    const ANCHO_MENU = 190; // w-44 (176px) + aire
    const ALTO_MENU = 140;  // alto real del menú + aire
    // Horizontal: por defecto el borde DERECHO del menú coincide con
    // el del botón (right-0, se extiende a la izquierda). Si el botón
    // está pegado a la izquierda (como en la ficha), se voltea para
    // extenderse a la derecha desde su borde izquierdo (left-0).
    const cabeHaciaIzquierda = r.right >= ANCHO_MENU;
    const cabeHaciaDerecha = r.left + ANCHO_MENU <= window.innerWidth - 8;
    setLado(cabeHaciaIzquierda ? 'der' : cabeHaciaDerecha ? 'izq' : 'der');
    // Vertical: por defecto se abre hacia ARRIBA (bottom-full). Si el
    // botón está muy arriba de la pantalla, se abre hacia abajo.
    setVertical(r.top >= ALTO_MENU ? 'arriba' : 'abajo');
  }, [abierto]);

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
        <div
          className={`absolute ${vertical === 'arriba' ? 'bottom-full mb-2' : 'top-full mt-2'} ${
            lado === 'der' ? 'right-0' : 'left-0'
          } z-30 w-44 max-w-[calc(100vw-1rem)] rounded-xl bg-slate-900/98 backdrop-blur-md border border-slate-700 shadow-2xl overflow-hidden`}
        >
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
