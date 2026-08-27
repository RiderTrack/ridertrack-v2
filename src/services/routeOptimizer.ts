// ═══════════════════════════════════════════════════════════
// 🧭 OPTIMIZADOR DE RUTA - RiderTrack V2 (Fase 1.3)
// Ordena puntos de entrega por DISTANCIA REAL (Haversine sobre
// coordenadas geocodificadas), reemplazando el orden alfabético
// por distrito de la versión anterior.
//
// Algoritmo (clásico y probado para reparto urbano):
//   1. Vecino más cercano: desde tu posición GPS, ir siempre al
//      cliente pendiente más próximo.
//   2. Mejora 2-opt: detectar cruces en la ruta y deshacerlos.
//      Para rutas de reparto en Lima (10-50 paradas) baja la
//      distancia total entre 10% y 30% frente al vecino cercano.
//
// La distancia es línea recta × FACTOR_VIAL para aproximar km
// reales de calles (Lima es mayormente trazado de grilla).
// ═══════════════════════════════════════════════════════════

export interface PuntoGeo {
  lat: number;
  lng: number;
}

/** Plaza de Armas de Lima — centro por defecto cuando no hay GPS */
export const LIMA_CENTRO: PuntoGeo = { lat: -12.046374, lng: -77.042793 };

/**
 * Factor de corrección vial: la distancia real en calles es
 * mayor que la línea recta. ~1.35 es típico en trazado de grilla.
 */
export const FACTOR_VIAL = 1.35;

/** Velocidad promedio moto en ciudad (km/h) para estimar tiempo */
export const VELOCIDAD_URBANA_KMH = 22;

// ── Haversine ───────────────────────────────────────────────

const RADIO_TIERRA_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distancia en km entre dos puntos (línea recta) */
export function haversineKm(a: PuntoGeo, b: PuntoGeo): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(h));
}

// ── Optimización ────────────────────────────────────────────

/**
 * Heurística del vecino más cercano.
 * Devuelve los puntos reordenados empezando por el más cercano
 * al punto de inicio (tu posición GPS o LIMA_CENTRO).
 */
export function vecinoMasCercano<T extends PuntoGeo>(puntos: T[], inicio: PuntoGeo): T[] {
  const pendientes = [...puntos];
  const orden: T[] = [];
  let actual: PuntoGeo = inicio;

  while (pendientes.length > 0) {
    let mejorIdx = 0;
    let mejorDist = Infinity;
    for (let i = 0; i < pendientes.length; i++) {
      const d = haversineKm(actual, pendientes[i]);
      if (d < mejorDist) {
        mejorDist = d;
        mejorIdx = i;
      }
    }
    const siguiente = pendientes.splice(mejorIdx, 1)[0];
    orden.push(siguiente);
    actual = siguiente;
  }

  return orden;
}

/**
 * Mejora 2-opt: invierte segmentos de la ruta mientras reduzcan
 * la distancia total (deshace los "cruces" tipo lazo).
 */
export function mejoraTwoOpt<T extends PuntoGeo>(
  puntos: T[],
  inicio: PuntoGeo
): T[] {
  if (puntos.length < 4) return puntos;

  const ruta = [...puntos];
  const dist = (a: PuntoGeo, b: PuntoGeo) => haversineKm(a, b);

  let huboMejora = true;
  let pasadas = 0;
  const MAX_PASADAS = 30;

  while (huboMejora && pasadas < MAX_PASADAS) {
    huboMejora = false;
    pasadas++;

    for (let i = 0; i < ruta.length - 1; i++) {
      for (let j = i + 1; j < ruta.length; j++) {
        // Costo de las aristas afectadas antes del swap
        const a1 = i === 0 ? inicio : ruta[i - 1];
        const b1 = ruta[i];
        const a2 = ruta[j];
        const b2 = j + 1 < ruta.length ? ruta[j + 1] : null;

        const antes =
          dist(a1, b1) + (b2 ? dist(a2, b2) : 0);
        const despues =
          dist(a1, a2) + (b2 ? dist(b1, b2) : 0);

        if (despues + 1e-9 < antes) {
          // Invertir el segmento ruta[i..j]
          let izq = i;
          let der = j;
          while (izq < der) {
            const tmp = ruta[izq];
            ruta[izq] = ruta[der];
            ruta[der] = tmp;
            izq++;
            der--;
          }
          huboMejora = true;
        }
      }
    }
  }

  return ruta;
}

export interface ResultadoOptimizacion<T> {
  orden: T[];
  distanciaKm: number;        // distancia estimada total (inicio → último punto)
  distanciaDirectaKm: number; // línea recta sin factor vial
  tiempoMin: number;          // minutos estimados de traslado
}

/**
 * Optimización completa: vecino más cercano + 2-opt.
 * `inicio` es de dónde partes (tu GPS o LIMA_CENTRO).
 */
export function optimizarOrden<T extends PuntoGeo>(
  puntos: T[],
  inicio: PuntoGeo = LIMA_CENTRO
): ResultadoOptimizacion<T> {
  if (puntos.length === 0) {
    return { orden: [], distanciaKm: 0, distanciaDirectaKm: 0, tiempoMin: 0 };
  }

  // Con muchas paradas el 2-opt puro puede tardar en móvil —
  // seguir siendo correcto con vecino cercano + 2-opt limitado
  let orden = vecinoMasCercano(puntos, inicio);
  if (puntos.length <= 80) {
    orden = mejoraTwoOpt(orden, inicio);
  }

  let directa = haversineKm(inicio, orden[0]);
  for (let i = 0; i < orden.length - 1; i++) {
    directa += haversineKm(orden[i], orden[i + 1]);
  }

  const distanciaKm = directa * FACTOR_VIAL;
  const tiempoMin = (distanciaKm / VELOCIDAD_URBANA_KMH) * 60;

  return {
    orden,
    distanciaKm: Math.round(distanciaKm * 10) / 10,
    distanciaDirectaKm: Math.round(directa * 10) / 10,
    tiempoMin: Math.round(tiempoMin),
  };
}

/** Distancia total de una ruta ya ordenada (para comparar antes/después) */
export function distanciaRutaKm<T extends PuntoGeo>(puntos: T[], inicio: PuntoGeo): number {
  if (puntos.length === 0) return 0;
  let d = haversineKm(inicio, puntos[0]);
  for (let i = 0; i < puntos.length - 1; i++) {
    d += haversineKm(puntos[i], puntos[i + 1]);
  }
  return Math.round(d * FACTOR_VIAL * 10) / 10;
}
