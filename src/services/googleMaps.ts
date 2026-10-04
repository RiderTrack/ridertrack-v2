// ═══════════════════════════════════════════════════════════
// 🗺️ GOOGLE MAPS - RiderTrack V2 (Fase 2.0)
// Núcleo de Google Maps Platform para toda la app:
//
//   • Clave API: viene PRE-CONFIGURADA de fábrica (la clave del
//     proyecto RiderTrack en Google Cloud). El usuario puede
//     cambiarla en Configuración → Mapas y Rutas (se guarda en
//     este dispositivo y tiene prioridad).
//
//   • cargarGoogleMaps(): carga el script de la Maps JavaScript
//     API UNA sola vez (con promesa en caché). Todos los que lo
//     necesitan (mapa, autocompletado, rutas) esperan la misma
//     promesa — no hay cargas dobles.
//
//   • ESTILOS_GOOGLE: los mismos 3 "skins" de siempre (oscuro /
//     claro / estándar) pero sobre los mapas de Google. El oscuro
//     es el "skin bonito" estilo CARTO dark que usa la app.
//
//   • HtmlMarker: marcador HTML sobre Google Maps (OverlayView).
//     Permite los mismos círculos numerados con anillo pulsante,
//     el motito SVG y las banderas de inicio/fin que ya usaba la
//     versión Leaflet — mismo look, motor Google.
//
//   • decodificarPolyline(): decodifica la geometría de ruta que
//     devuelve Directions API (formato encoded polyline) a una
//     lista de {lat, lng}.
// ═══════════════════════════════════════════════════════════

import type { EstiloMapa } from './mapStyle';

// ── Clave API de Google Maps ───────────────────────────────

/**
 * Clave de fábrica (proyecto RiderTrack en Google Cloud).
 * Habilitada para: Maps JavaScript, Geocoding, Places y Directions.
 * Es la misma cuenta de Firebase del usuario (ridertrack-93c8a).
 */
export const DEFAULT_GOOGLE_MAPS_API_KEY = 'AIzaSyAJQ75hW6TLIEKz07Efes90Wof2QIMmrZM';

const GOOGLE_KEY_STORAGE = 'rt_google_maps_key';

/** Clave efectiva: la guardada por el usuario o la de fábrica */
export function getGoogleApiKey(): string {
  try {
    const guardada = localStorage.getItem(GOOGLE_KEY_STORAGE);
    if (guardada && guardada.trim()) return guardada.trim();
  } catch {
    // sin localStorage — usar la de fábrica
  }
  return DEFAULT_GOOGLE_MAPS_API_KEY;
}

/** Guarda (o borra, con vacío) la clave personalizada del usuario */
export function setGoogleApiKey(key: string): void {
  try {
    const limpia = key.trim();
    // Si escribió la clave de fábrica o la borró → volver al default
    if (!limpia || limpia === DEFAULT_GOOGLE_MAPS_API_KEY) {
      localStorage.removeItem(GOOGLE_KEY_STORAGE);
    } else {
      localStorage.setItem(GOOGLE_KEY_STORAGE, limpia);
    }
  } catch {
    // localStorage no disponible — seguir con la de fábrica
  }
}

/** ¿El usuario personalizó la clave? (para mostrarla en Configuración) */
export function clavePersonalizada(): boolean {
  try {
    const guardada = localStorage.getItem(GOOGLE_KEY_STORAGE);
    return !!(guardada && guardada.trim() && guardada.trim() !== DEFAULT_GOOGLE_MAPS_API_KEY);
  } catch {
    return false;
  }
}

/** Motor de ubicación activo (Google siempre que haya clave) */
export function motorActivo(): 'google' | 'nominatim' {
  return getGoogleApiKey() ? 'google' : 'nominatim';
}

// ── Carga del script de Maps JavaScript API ────────────────

declare global {
  interface Window {
    google?: any;
    __rtGmapsListos?: () => void;
  }
}

let promesaCarga: Promise<any> | null = null;

/**
 * Carga (una sola vez) la Maps JavaScript API con la biblioteca
 * geometry (decodifica polylines sin red extra). Resuelve con el
 * namespace google.maps. Rechaza si no hay clave o sin internet.
 */
export function cargarGoogleMaps(apiKey?: string): Promise<any> {
  const key = apiKey || getGoogleApiKey();
  if (!key) {
    return Promise.reject(new Error('Sin Google Maps API key'));
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Sin DOM'));
  }

  // ¿Ya estaba cargado (por otra parte de la app)?
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  // ¿Ya hay una carga en curso? → todos esperan la misma promesa
  if (promesaCarga) return promesaCarga;

  promesaCarga = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&libraries=geometry&loading=async&language=es&region=PE` +
      `&callback=__rtGmapsListos`;
    script.async = true;
    script.onerror = () => {
      promesaCarga = null; // permitir reintentar
      reject(new Error('No se pudo descargar Google Maps (¿sin internet?)'));
    };
    window.__rtGmapsListos = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        promesaCarga = null;
        reject(new Error('Google Maps cargó sin el namespace maps'));
      }
    };
    document.head.appendChild(script);
  });

  return promesaCarga;
}

// ── Estilos (skins) de mapa para Google Maps ───────────────

/**
 * El "skin bonito" oscuro de siempre, ahora sobre Google Maps:
 * fondo azul-noche, calles grises tenues, POIs silenciados.
 */
export const ESTILO_OSCURO: Array<Record<string, any>> = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec9f0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a2340' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2c5282' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6cb7' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6cb7' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#20335c' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283a6b' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9dd4' }] },
  { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2a4d' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#234233' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#7ac79f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a47' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c5fac' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#2a3f77' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#9ec9ff' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#3c5fac' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#5f7ea8' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#2f4c85' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#34497a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6a8f' }] },
];

/** Skin claro: el estilo default de Google (día, alto contraste) */
export const ESTILO_CLARO: Array<Record<string, any>> = [];

/** Skin estándar: Google default pero sin POIs (mapa más limpio) */
export const ESTILO_ESTANDAR: Array<Record<string, any>> = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

/** Devuelve los estilos JSON de Google para cada skin de la app */
export function estilosGoogleDe(estilo: EstiloMapa): Array<Record<string, any>> {
  if (estilo === 'claro') return ESTILO_CLARO;
  if (estilo === 'estandar') return ESTILO_ESTANDAR;
  return ESTILO_OSCURO;
}

// ── Marcador HTML sobre Google Maps ────────────────────────

/**
 * Fábrica de la clase HtmlMarker. Hay que crearla DESPUÉS de que
 * cargue la API (extiende google.maps.OverlayView). El componente
 * que la use debe hacer:
 *   const HtmlMarker = HtmlMarkerClass(await cargarGoogleMaps());
 *
 * El marcador renderiza HTML arbitrario (divIcon estilo Leaflet):
 * círculos numerados con anillo pulsante, el motito SVG, banderas…
 * y opcionalmente responde a clicks (para abrir la ficha del cliente).
 */
export function HtmlMarkerClass(gmaps: any): any {
  if ((HtmlMarkerClass as any)._cls) return (HtmlMarkerClass as any)._cls;

  const cls = class extends gmaps.OverlayView {
    private div: HTMLDivElement | null = null;
    private listenerClick: any = null;
    public position: any; // google.maps.LatLng
    public html: string;
    public interactivos: boolean;
    public onClick?: () => void;

    constructor(opts: {
      position: { lat: number; lng: number };
      html: string;
      interactivos?: boolean;
      onClick?: () => void;
    }) {
      super();
      this.position = new gmaps.LatLng(opts.position.lat, opts.position.lng);
      this.html = opts.html;
      this.interactivos = opts.interactivos !== false;
      this.onClick = opts.onClick;
    }

    onAdd(): void {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.pointerEvents = this.interactivos ? 'auto' : 'none';
      if (!this.interactivos) {
        this.div.style.opacity = '1';
      }
      this.div.innerHTML = this.html;
      // overlayMouseTarget: los clicks funcionan (encima del mapa)
      const panes = this.getPanes();
      panes.overlayMouseTarget.appendChild(this.div);

      if (this.onClick && this.div.firstElementChild) {
        this.listenerClick = gmaps.event.addDomListener(
          this.div.firstElementChild,
          'click',
          (ev: Event) => {
            ev.stopPropagation();
            this.onClick?.();
          }
        );
      }
    }

    draw(): void {
      if (!this.div) return;
      const proyeccion = this.getProjection();
      if (!proyeccion) return;
      const punto = proyeccion.fromLatLngToDivPixel(this.position);
      if (!punto) return;
      this.div.style.left = `${punto.x}px`;
      this.div.style.top = `${punto.y}px`;
      // El HTML se centra en el punto (igual que iconAnchor en Leaflet)
      this.div.style.transform = 'translate(-50%, -50%)';
    }

    onRemove(): void {
      if (this.listenerClick) {
        gmaps.event.removeListener(this.listenerClick);
        this.listenerClick = null;
      }
      if (this.div) {
        this.div.parentNode?.removeChild(this.div);
        this.div = null;
      }
    }

    /** Mover el marcador (animación suave opcional) */
    setPosition(lat: number, lng: number): void {
      this.position = new gmaps.LatLng(lat, lng);
      this.draw();
    }

    /** Cambiar el contenido HTML */
    setHtml(html: string): void {
      this.html = html;
      if (this.div) this.div.innerHTML = html;
    }
  };

  (HtmlMarkerClass as any)._cls = cls;
  return cls;
}

// ── Decodificador de polylines (Directions API) ────────────

/**
 * Decodifica una "encoded polyline" de Google (formato estándar
 * de la API de Directions) a una lista de coordenadas.
 * Así dibujamos la ruta REAL por calles que devuelve Google.
 */
export function decodificarPolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const puntos: Array<{ lat: number; lng: number }> = [];
  if (!encoded) return puntos;

  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // latitud
    let resultado = 1;
    let corrimiento = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      resultado += b << corrimiento;
      corrimiento += 5;
    } while (b >= 0x1f);
    lat += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

    // longitud
    resultado = 1;
    corrimiento = 0;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      resultado += b << corrimiento;
      corrimiento += 5;
    } while (b >= 0x1f);
    lng += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

    puntos.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }

  return puntos;
}
