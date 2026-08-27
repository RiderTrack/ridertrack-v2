// ═══════════════════════════════════════════════════════════
// 🎨 ESTILOS DE MAPA - RiderTrack V2 (Fase 1.4)
// El mapa de entregas puede usar 3 "skins" de tiles, todos
// gratuitos y sin API key:
//   • oscuro   — CARTO dark_all (default: elegante, combina con
//                el tema oscuro de la app)
//   • claro    — CARTO light_all (día, contraste alto)
//   • estandar — OpenStreetMap clásico (calles detalladas)
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
}

export function tilesDeEstilo(estilo: EstiloMapa): ConfigTile {
  switch (estilo) {
    case 'claro':
      return {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        subdomains: 'abcd',
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        subdomains: 'abcd',
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      };
  }
}
