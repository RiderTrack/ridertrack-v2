// ═══════════════════════════════════════════════════════════
// 🗺️ DriverTrack — Tiles de mapa compartidos (F-ID3.1 → F-ID3.2)
// Los mismos tiles gratuitos de RiderTrack v2 (sin API key):
//   • oscuro  — ESRI World Dark Gray + capa de NOMBRES (default)
//   • claro   — ESRI World Light Gray + capa de nombres
//   • satelite— Esri World Imagery (foto real)
// ESRI separa el FONDO de los NOMBRES en el tema gray: la capa
// refUrl va encima o el mapa queda sin nombres de calles.
// maxNativeZoom 16: ESRI gray no tiene zoom 17+ → Leaflet
// reescala el 16 en vez de mostrar vacío.
// Extraído de MapView para que el modal "Ubicar por coordenadas"
// use EXACTAMENTE el mismo look (F-ID3.2).
// ═══════════════════════════════════════════════════════════

import * as L from 'leaflet';

export type EstiloMapa = 'oscuro' | 'claro' | 'satelite';

export const ORDEN_ESTILOS: EstiloMapa[] = ['oscuro', 'claro', 'satelite'];

const K_ESTILO = 'dt_estilo_mapa';

export interface ConfigTile {
  url: string;
  refUrl?: string; // capa de nombres (labels)
  atribucion: string;
}

export const TILES: Record<EstiloMapa, ConfigTile> = {
  oscuro: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    refUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    atribucion: 'Esri',
  },
  claro: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    refUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    atribucion: 'Esri',
  },
  satelite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    atribucion: 'Esri, Maxar',
  },
};

export function leerEstilo(): EstiloMapa {
  try {
    const v = localStorage.getItem(K_ESTILO);
    if (v === 'satelite') return 'satelite';
    if (v === 'claro') return 'claro';
  } catch {
    /* nada */
  }
  return 'oscuro'; // el default con look RiderTrack (F-ID3.1)
}

export function guardarEstilo(estilo: EstiloMapa): void {
  try {
    localStorage.setItem(K_ESTILO, estilo);
  } catch {
    /* nada */
  }
}

/** Agrega la capa de tiles (base + nombres) al mapa y devuelve el
 *  grupo — guardalo para poder hacer grupo.remove() al cambiar */
export function agregarTiles(mapa: L.Map, estilo: EstiloMapa): L.LayerGroup {
  const t = TILES[estilo];
  const grupo = L.layerGroup();
  L.tileLayer(t.url, { maxZoom: 19, maxNativeZoom: 16, attribution: t.atribucion }).addTo(grupo);
  if (t.refUrl) {
    L.tileLayer(t.refUrl, { maxZoom: 19, maxNativeZoom: 16 }).addTo(grupo);
  }
  grupo.addTo(mapa);
  return grupo;
}
