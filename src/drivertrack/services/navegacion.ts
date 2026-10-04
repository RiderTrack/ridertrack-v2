// ═══════════════════════════════════════════════════════════
// 🧭 NAVEGACIÓN A LA ENTREGA — DriverTrack (F-ID3.3)
// El driver elige CON QUÉ APP viajar hasta cada entrega:
//   • Google Maps (modo moto: two_wheeler, como RiderTrack)
//   • Waze (abre la app con navigate=yes)
//   • Preguntar (muestra ambos botones al tocar "Navegar")
//
// Acepta COORDENADAS (las que marcaste con 📍 Ubicar — lo más
// preciso) o la DIRECCIÓN escrita/escaneada como texto de
// búsqueda. La preferencia vive en localStorage (instantánea,
// offline) y se anuncia con un evento para que los botones ya
// renderizados se actualicen al toque (patrón de RiderTrack v2).
// ═══════════════════════════════════════════════════════════

export type AppNavegacion = 'google' | 'waze' | 'preguntar';

/** A dónde navegar: coordenadas (preciso) y/o dirección (texto) */
export interface DestinoNav {
  lat?: number;
  lng?: number;
  direccion?: string;
}

const STORAGE_KEY = 'dt_nav_app_v1';
export const EVENTO_NAV_CHANGED = 'dt-nav-changed';

export function getAppNavegacion(): AppNavegacion {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'google' || v === 'waze' || v === 'preguntar') return v;
  } catch {}
  return 'preguntar'; // por defecto: mostrar ambas apps
}

export function setAppNavegacion(app: AppNavegacion): void {
  try {
    localStorage.setItem(STORAGE_KEY, app);
  } catch {}
  // Avisar a los componentes montados (form, lista, ajustes…)
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_NAV_CHANGED, { detail: app }));
  } catch {}
}

function destinoQuery(d: DestinoNav): string {
  // coordenadas > texto: si marcaste el pin, navegás al pin exacto
  if (typeof d.lat === 'number' && typeof d.lng === 'number' && isFinite(d.lat) && isFinite(d.lng)) {
    return `${d.lat},${d.lng}`;
  }
  return encodeURIComponent((d.direccion ?? '').trim());
}

/** Link de navegación con Google Maps (modo moto, como RiderTrack v2) */
export function urlNavegacionGoogle(d: DestinoNav): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destinoQuery(d)}&travelmode=two_wheeler`;
}

/** Link de navegación con Waze (abre la app y arranca el viaje) */
export function urlNavegacionWaze(d: DestinoNav): string {
  // Waze: ll=coordenadas para llegar directo, q=texto para buscar
  if (typeof d.lat === 'number' && typeof d.lng === 'number' && isFinite(d.lat) && isFinite(d.lng)) {
    return `https://waze.com/ul?ll=${d.lat},${d.lng}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${destinoQuery(d)}&navigate=yes`;
}

/** Link según la app indicada (o la preferencia guardada) */
export function urlNavegacion(d: DestinoNav, app?: AppNavegacion): string {
  const a = app ?? getAppNavegacion();
  return a === 'waze' ? urlNavegacionWaze(d) : urlNavegacionGoogle(d);
}

/**
 * Abre la app de navegación con la preferencia del driver.
 * Devuelve true si abrió directo, false si la preferencia es
 * "preguntar" (el componente debe mostrar el mini-selector).
 */
export function abrirNavegacion(d: DestinoNav, app?: AppNavegacion): boolean {
  const a = app ?? getAppNavegacion();
  if (a === 'preguntar') return false;
  try {
    window.open(urlNavegacion(d, a), '_blank', 'noopener');
  } catch {
    // último recurso en WebViews raros
    window.location.href = urlNavegacion(d, a);
  }
  return true;
}

/** ¿Hay algo a dónde navegar? (pin marcado o dirección escrita) */
export function tieneDestino(d: DestinoNav): boolean {
  if (typeof d.lat === 'number' && typeof d.lng === 'number' && isFinite(d.lat) && isFinite(d.lng)) return true;
  return !!(d.direccion ?? '').trim();
}
