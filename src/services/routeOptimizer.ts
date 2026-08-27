// ═══════════════════════════════════════════════════════════
// 🧭 OPTIMIZADOR DE RUTA - RiderTrack V2 (Fase 1.4)
// Ordena puntos de entrega por DISTANCIA REAL (Haversine sobre
// coordenadas geocodificadas).
//
// Algoritmo (clásico y probado para reparto urbano):
//   1. Vecino más cercano: desde el punto de inicio, ir siempre
//      al cliente pendiente más próximo.
//   2. Mejora 2-opt: detectar cruces en la ruta y deshacerlos.
//      Para rutas de reparto en Lima (10-50 paradas) baja la
//      distancia total entre 10% y 30% frente al vecino cercano.
//
// Fase 1.4 — RUTA CON INICIO Y FIN:
//   • inicio: dirección de inicio configurada (o GPS del rider)
//   • fin:    opcional. Si se define, la ruta TERMINA ahí
//             (última parada fija, el 2-opt no la mueve).
//   • cerrarCiclo: si true, la distancia incluye el regreso al
//     inicio (ruta cerrada: "terminar donde empecé").
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

/** Opciones de ruta de la Fase 1.4 */
export interface OpcionesRuta {
  /** Punto final fijo de la ruta (opcional) */
  fin?: PuntoGeo | null;
  /** Incluir el regreso al inicio en la distancia (ruta cerrada) */
  cerrarCiclo?: boolean;
}

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
 * al punto de inicio (inicio configurado o tu GPS).
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
 *
 * Soporta (Fase 1.4):
 *   • inicio fijo (primer punto de referencia)
 *   • fin fijo (endpoint DESPUÉS de la última parada — el fin no
 *     es una parada, nunca se mueve ni consume clientes)
 *   • ciclo cerrado (la última parada conecta con el inicio)
 */
export function mejoraTwoOpt<T extends PuntoGeo>(
  puntos: T[],
  inicio: PuntoGeo,
  opciones?: OpcionesRuta
): T[] {
  if (puntos.length < 2) return puntos;

  const fin = opciones?.fin ?? null;
  const cerrar = !!opciones?.cerrarCiclo;
  const ruta = [...puntos];
  const dist = (a: PuntoGeo, b: PuntoGeo) => haversineKm(a, b);

  /** Punto que sigue después del índice j (endpoint fijo o inicio si es ciclo) */
  const siguienteDe = (j: number): PuntoGeo | null => {
    if (j + 1 < ruta.length) return ruta[j + 1];
    if (fin) return fin;
    if (cerrar) return inicio;
    return null; // ruta abierta sin fin: la última arista no cuenta
  };

  let huboMejora = true;
  let pasadas = 0;
  const MAX_PASADAS = 30;

  while (huboMejora && pasadas < MAX_PASADAS) {
    huboMejora = false;
    pasadas++;

    for (let i = 0; i < ruta.length - 1; i++) {
      for (let j = i + 1; j < ruta.length; j++) {
        // Aristas afectadas antes del swap
        const a1 = i === 0 ? inicio : ruta[i - 1];
        const b1 = ruta[i];
        const a2 = ruta[j];
        const b2 = siguienteDe(j);

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
  distanciaKm: number;        // distancia estimada total (inicio → paradas → fin)
  distanciaDirectaKm: number; // línea recta sin factor vial
  tiempoMin: number;          // minutos estimados de traslado
}

/**
 * Optimización completa: vecino más cercano + 2-opt.
 * `inicio` es de dónde partes (dirección de inicio configurada,
 * tu GPS o LIMA_CENTRO). TODOS los `puntos` son paradas de
 * entrega; `opciones.fin` es un endpoint DESPUÉS de la última
 * parada (tu casa, el almacén…) — la ruta termina ahí pero el
 * fin no consume ninguna parada. Con `cerrarCiclo` la distancia
 * incluye el regreso al inicio.
 */
export function optimizarOrden<T extends PuntoGeo>(
  puntos: T[],
  inicio: PuntoGeo = LIMA_CENTRO,
  opciones?: OpcionesRuta
): ResultadoOptimizacion<T> {
  if (puntos.length === 0) {
    return { orden: [], distanciaKm: 0, distanciaDirectaKm: 0, tiempoMin: 0 };
  }

  const fin = opciones?.fin ?? null;
  const cerrar = !!opciones?.cerrarCiclo;

  // Vecino más cercano sobre TODAS las paradas
  let orden = vecinoMasCercano(puntos, inicio);

  // 2-opt con inicio fijo, endpoint fijo y ciclo opcional
  if (puntos.length <= 80) {
    orden = mejoraTwoOpt(orden, inicio, opciones);
  }

  // Distancias (línea recta): inicio → paradas → fin (o inicio)
  let directa = haversineKm(inicio, orden[0]);
  for (let i = 0; i < orden.length - 1; i++) {
    directa += haversineKm(orden[i], orden[i + 1]);
  }
  if (fin) {
    directa += haversineKm(orden[orden.length - 1], fin);
  } else if (cerrar) {
    directa += haversineKm(orden[orden.length - 1], inicio);
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
export function distanciaRutaKm<T extends PuntoGeo>(
  puntos: T[],
  inicio: PuntoGeo,
  opciones?: OpcionesRuta
): number {
  if (puntos.length === 0) return 0;
  let d = haversineKm(inicio, puntos[0]);
  for (let i = 0; i < puntos.length - 1; i++) {
    d += haversineKm(puntos[i], puntos[i + 1]);
  }
  if (opciones?.fin) {
    d += haversineKm(puntos[puntos.length - 1], opciones.fin);
  } else if (opciones?.cerrarCiclo) {
    d += haversineKm(puntos[puntos.length - 1], inicio);
  }
  return Math.round(d * FACTOR_VIAL * 10) / 10;
}
