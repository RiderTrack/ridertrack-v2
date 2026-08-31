// ═══════════════════════════════════════════════════════════
// 🗺️ LIVE MAP - RiderTrack V2 (Fase 2.0)
//WRAPPER INTELIGENTE: decide qué mapa mostrar.
//
//   • GOOGLE MAPS (predeterminado): mejor calidad de calles en
//     Lima, ruta real por calles, motito animado recorriendo
//     la ruta (la visualización de la demo, ahora funcional),
//     skin oscuro elegante. Usa la clave API de fábrica.
//
//   • LEAFLET (respaldo gratis): si Google no carga (sin
//     internet, clave inválida, cuota), el mapa SIEMPRE
//     funciona con tiles ESRI/OSM sin API key.
//
// FIX Fase 2.0 (bug reportado por el usuario): el mapa y su
// leyenda ya NO tapan el menú hamburguesa — ambos componentes
// viven en un contenedor AISLADO (isolate) y el drawer del
// Sidebar quedó por encima de todo (z-[1200]).
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { NavigationTab } from '../types';
import { getGoogleApiKey, cargarGoogleMaps } from '../services/googleMaps';
import { GoogleLiveMap } from './GoogleLiveMap';
import { LeafletLiveMap } from './LeafletLiveMap';

interface LiveMapProps {
  orders: any[];
  riderName?: string;
  onOpenWhatsApp?: (telefono: string, nombre: string) => void;
  /** Para el botón "Ir a Mi Ruta" del banner */
  onNavigateTab?: (tab: NavigationTab) => void;
}

export const LiveMap: React.FC<LiveMapProps> = (props) => {
  const [motor, setMotor] = useState<'google' | 'leaflet' | 'cargando'>('cargando');
  const apiKey = getGoogleApiKey();

  useEffect(() => {
    if (!apiKey) {
      setMotor('leaflet');
      return;
    }
    let vivo = true;
    cargarGoogleMaps(apiKey)
      .then(() => {
        if (vivo) setMotor('google');
      })
      .catch(() => {
        // Google no cargó (sin internet / clave) → mapa gratis
        if (vivo) setMotor('leaflet');
      });
    return () => {
      vivo = false;
    };
  }, [apiKey]);

  if (motor === 'cargando') {
    return (
      <div className="relative rounded-2xl bg-slate-800 border border-slate-700/80 overflow-hidden shadow-xl isolate">
        <div className="flex flex-col items-center justify-center gap-3 h-[420px] sm:h-[520px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-xs text-slate-400 font-semibold">Preparando el mapa…</p>
        </div>
      </div>
    );
  }

  if (motor === 'google') {
    return <GoogleLiveMap {...props} apiKey={apiKey} />;
  }

  return <LeafletLiveMap {...props} />;
};
