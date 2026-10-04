// ═══════════════════════════════════════════════════════════
// 🧭 PREFERENCIA DE NAVEGACIÓN — Fase 1.5
// El rider escoge con qué app navegar a cada parada:
//   • google → Google Maps (modo moto: travelmode=two_wheeler)
//   • waze   → Waze (abre directamente la navegación)
// Se guarda en localStorage y TODOS los botones "Navegar" de la
// app (mapa, panel de pedido, popups) la respetan.
// ═══════════════════════════════════════════════════════════

export type AppNavegacion = 'google' | 'waze';

const NAV_KEY = 'rt_nav_app';

export function getAppNavegacion(): AppNavegacion {
  try {
    const v = localStorage.getItem(NAV_KEY);
    if (v === 'google' || v === 'waze') return v;
  } catch {
    // sin storage
  }
  return 'google';
}

export function setAppNavegacion(app: AppNavegacion): void {
  try {
    localStorage.setItem(NAV_KEY, app);
  } catch {
    // sin storage — se usa el default en esta sesión
  }
}

export interface DestinoNav {
  lat?: number | null;
  lng?: number | null;
  /** Texto de la dirección (se usa si no hay coordenadas) */
  query?: string;
}

/**
 * Construye el link de navegación según la app preferida.
 * Con coordenadas usa el formato exacto de cada app (mejor precisión);
 * sin coordenadas cae a búsqueda por texto.
 */
export function linkNavegacion(dest: DestinoNav): string {
  const app = getAppNavegacion();
  const tieneCoords =
    typeof dest.lat === 'number' && typeof dest.lng === 'number' &&
    !isNaN(dest.lat!) && !isNaN(dest.lng!);

  if (app === 'waze') {
    if (tieneCoords) {
      return `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes&zoom=17`;
    }
    const q = encodeURIComponent(dest.query || 'Lima, Perú');
    return `https://waze.com/ul?q=${q}&navigate=yes`;
  }

  // Google Maps (default)
  if (tieneCoords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=two_wheeler`;
  }
  const q = encodeURIComponent(dest.query || 'Lima, Perú');
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Nombre corto para toasts y settings */
export function nombreAppNavegacion(app: AppNavegacion): string {
  return app === 'waze' ? 'Waze' : 'Google Maps';
}
