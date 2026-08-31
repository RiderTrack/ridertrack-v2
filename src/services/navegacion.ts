// ═══════════════════════════════════════════════════════════
// 🧭 NAVEGACIÓN GPS - RiderTrack V2 (Fase 2.2)
// El rider elige CON QUÉ APP navegar a cada parada:
//   • Google Maps (con modo moto: two_wheeler)
//   • Waze (abre la app directamente con navigate=yes)
//   • Preguntar (muestra ambos botones al tocar "Navegar")
//
// La preferencia vive en localStorage (instantánea, offline) y
// se anuncia con un evento para que los botones ya renderizados
// se actualicen al toque (mismo patrón que el estilo del mapa).
// ═══════════════════════════════════════════════════════════

export type AppNavegacion = 'google' | 'waze' | 'preguntar';

const STORAGE_KEY = 'rt_nav_app_v1';
export const EVENTO_NAV_CHANGED = 'rt-nav-changed';

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
  // Avisar a los componentes montados (mapa, fichas, banners…)
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_NAV_CHANGED, { detail: app }));
  } catch {}
}

/** Link de navegación a una coordenada con Google Maps (modo moto) */
export function urlNavegacionGoogle(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=two_wheeler`;
}

/** Link de navegación a una coordenada con Waze (abre la app) */
export function urlNavegacionWaze(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

/** Link según la app indicada (o la preferencia guardada) */
export function urlNavegacion(lat: number, lng: number, app?: AppNavegacion): string {
  const a = app ?? getAppNavegacion();
  return a === 'waze' ? urlNavegacionWaze(lat, lng) : urlNavegacionGoogle(lat, lng);
}

/**
 * Abre la app de navegación con la preferencia del rider.
 * Devuelve true si abrió directo, false si la preferencia es
 * "preguntar" (el componente debe mostrar el mini-selector).
 */
export function abrirNavegacion(lat: number, lng: number, app?: AppNavegacion): boolean {
  const a = app ?? getAppNavegacion();
  if (a === 'preguntar') return false;
  try {
    window.open(urlNavegacion(lat, lng, a), '_blank', 'noopener');
  } catch {
    // último recurso en WebViews raros
    window.location.href = urlNavegacion(lat, lng, a);
  }
  return true;
}
