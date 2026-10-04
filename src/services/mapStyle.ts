// ═══════════════════════════════════════════════════════════
// 🎨 ESTILOS DE MAPA - RiderTrack V2 (Fase 2.0)
// El mapa de entregas usa GOOGLE MAPS por defecto (clave de
// fábrica) con estos 3 "skins":
//   • oscuro   — Google con estilo noche (default: elegante,
//                combina con el tema oscuro de la app)
//   • claro    — Google estilo default (día, alto contraste)
//   • estandar — Google sin POIs (mapa limpio)
// (Los estilos JSON de Google están en googleMaps.ts)
//
// Este archivo define los TILES del MODO RESPALDO (Leaflet) que
// se usa solo si Google Maps no carga (sin internet / clave
// inválida). Fase 2.0: se eliminó CARTO — empezó a pedir API
// key y mostraba "API KEY REQUIRED" sobre el mapa. Ahora:
//   • oscuro   — ESRI World Dark Gray (+ capa de nombres)
//   • claro    — ESRI World Light Gray
//   • estandar — OpenStreetMap clásico
// Todos gratuitos y sin API key.
// ═══════════════════════════════════════════════════════════

export type EstiloMapa = 'oscuro' | 'claro' | 'estandar';

const ESTILO_KEY = 'rt_tile_style';

export function getEstiloMapa(): EstiloMapa {
  try {
    const v = localStorage.getItem(ESTILO_KEY);
    if (v === 'oscuro' || v === 'claro' || v === 'estandar') return v;
  } catch {
    // sin storage
  }
  return 'oscuro';
}

export function setEstiloMapa(estilo: EstiloMapa): void {
  try {
    localStorage.setItem(ESTILO_KEY, estilo);
  } catch {
    // sin storage — la app seguirá con el default
  }
}

export interface ConfigTile {
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
  /** Capa adicional con los NOMBRES de calles/lugares (ESRI
   *  separa el fondo de los labels en el tema dark gray) */
  refUrl?: string;
}

export function tilesDeEstilo(estilo: EstiloMapa): ConfigTile {
  switch (estilo) {
    case 'claro':
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        refUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      };
    case 'estandar':
      return {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      };
    case 'oscuro':
    default:
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        refUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      };
  }
}
