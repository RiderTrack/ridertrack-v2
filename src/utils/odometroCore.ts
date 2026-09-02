// ═══════════════════════════════════════════════════════════
// 🛣️ ODÓMETRO GPS — NÚCLEO PURO (Fase 3.35)
// Matemática y filtros SIN dependencias (ni React ni Firebase):
// así se puede probar con Node directo y se puede reusar donde sea.
//
// CÓMO CUENTA LOS KILÓMETROS:
//   1. Cada punto GPS que llega se compara con el ANCLA (último
//      punto aceptado). La distancia entre ambos es Haversine
//      (fórmula de la Tierra esférica, error < 0.3% en Lima).
//   2. La distancia SOLO se suma si pasa TODOS los filtros:
//        · precisión: accuracy > 50 m → el punto es basura GPS
//        · ruido:     d < 8 m → la moto está quieta (el GPS
//                     "flota" ±10 m parado y sumaría km falsos)
//        · salto:     velocidad implícita > 140 km/h → teleport
//                     (perdió señal y reapareció en otro lado)
//        · lento:     velocidad < 2 km/h y ya pasó el umbral →
//                     deriva lenta del GPS, no movimiento real
//        · hueco:    dt > 8 min sin puntos → la línea recta
//                     entre ambos no es confiable (pantalla
//                     apagada / app en segundo plano) → no suma
//   3. Con el FACTOR DE CALIBRACIÓN el rider corrige el sesgo:
//      kmMostrados = metrosCrudos × factor. Si el marcador de
//      la moto dice 30 km y la app 28 → factor 30/28 ≈ 1.07.
//
// PRECISIÓN ESPERADA: ±1-3% con GPS de teléfono en moto urbana.
// ═══════════════════════════════════════════════════════════

/** Un punto GPS crudo tal como llega del watch */
export interface PuntoGPS {
  lat: number;
  lng: number;
  /** epoch ms del momento de la lectura */
  t: number;
  /** precisión en metros (si el watch la da) */
  accuracy?: number;
}

/** Filtros — constantes afinadas para moto urbana */
export const FILTROS_ODOMETRO = {
  /** Distancia mínima entre puntos para contar (m) */
  MIN_METROS: 8,
  /** Velocidad máxima creíble en moto (km/h) — más = salto GPS */
  MAX_VELOCIDAD_KMH: 140,
  /** Velocidad mínima creíble moviéndose (km/h) — menos = deriva */
  MIN_VELOCIDAD_KMH: 2,
  /** Hueco máximo entre puntos confiable (ms) — 8 minutos */
  GAP_MS: 8 * 60 * 1000,
  /** Precisión máxima aceptable (m) */
  MAX_ACCURACY: 50,
} as const;

export type MotivoPunto =
  | 'primero' // no había ancla — solo fija el ancla
  | 'movimiento' // ✅ distancia válida sumada
  | 'ruido' // muy cerca (moto quieta) — no suma
  | 'salto' // velocidad imposible — no suma
  | 'lento' // deriva lenta — no suma
  | 'gap' // hueco largo sin señal — no suma
  | 'precision' // accuracy pésima — no suma
  | 'invalido'; // coordenadas imposibles — no suma

export interface ResultadoPunto {
  /** ¿Se sumó distancia? (solo 'movimiento') */
  contar: boolean;
  /** Metros válidos sumados (0 si no contó) */
  metros: number;
  motivo: MotivoPunto;
  /** Nuevo ancla que el caller debe guardar (null = conservar la actual) */
  nuevoAncla: PuntoGPS | null;
}

/** Radio terrestre en metros (media esférica) */
const R_TIERRA_M = 6371008.8;

/**
 * Distancia Haversine entre dos puntos, en METROS.
 * Fórmula clásica: error < 0.3% frente a la elipse real en Lima.
 */
export function haversineMetros(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(aLat * rad) * Math.cos(bLat * rad) * sinLng * sinLng;
  // clamp anti-numérico por si lat/lng vienen rarísimos
  const c = 2 * Math.atan2(Math.sqrt(Math.min(1, Math.max(0, h))), Math.sqrt(Math.min(1, Math.max(0, 1 - h))));
  return c * R_TIERRA_M;
}

/** ¿El punto tiene coordenadas válidas? */
function coordenadasValidas(p: PuntoGPS): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    Number.isFinite(p.t)
  );
}

/**
 * Evalúa un punto GPS contra el ancla actual.
 * NO muta nada — devuelve el resultado y el caller decide.
 *
 * @param ancla   último punto aceptado (null al inicio del día)
 * @param p       punto nuevo que llegó del watch
 */
export function evaluarPunto(ancla: PuntoGPS | null, p: PuntoGPS): ResultadoPunto {
  // 0. Coordenadas imposibles → basura, ni siquiera re-anclar
  if (!coordenadasValidas(p)) {
    return { contar: false, metros: 0, motivo: 'invalido', nuevoAncla: null };
  }

  // 1. Primer punto del día → solo fija el ancla
  if (!ancla) {
    return { contar: false, metros: 0, motivo: 'primero', nuevoAncla: { ...p } };
  }

  // 2. Precisión pésima → descartar SIN tocar el ancla (el punto
  //    no sirve ni como referencia)
  if (p.accuracy != null && p.accuracy > FILTROS_ODOMETRO.MAX_ACCURACY) {
    return { contar: false, metros: 0, motivo: 'precision', nuevoAncla: null };
  }

  const dt = p.t - ancla.t;

  // 3. Reloj invertido / puntos duplicados del mismo tick → ruido
  if (dt <= 0) {
    return { contar: false, metros: 0, motivo: 'ruido', nuevoAncla: null };
  }

  // 4. Hueco largo (pantalla apagada, app muerta) → la línea recta
  //    no representa el camino real → no suma, pero RE-ANCLA aquí
  //    para empezar un tramo nuevo limpio
  if (dt > FILTROS_ODOMETRO.GAP_MS) {
    return { contar: false, metros: 0, motivo: 'gap', nuevoAncla: { ...p } };
  }

  const d = haversineMetros(ancla.lat, ancla.lng, p.lat, p.lng);

  // 5. Muy cerca = moto quieta (flotación del GPS) → no suma,
  //    pero refresca el ancla (nueva hora, misma posición)
  if (d < FILTROS_ODOMETRO.MIN_METROS) {
    return { contar: false, metros: 0, motivo: 'ruido', nuevoAncla: { ...p } };
  }

  // 6. Velocidad implícita: d metros en dt ms → km/h
  const velocidadKmh = (d / dt) * 3600;

  if (velocidadKmh > FILTROS_ODOMETRO.MAX_VELOCIDAD_KMH) {
    // Teleport del GPS (perdió señal y reapareció lejos) → no suma,
    // re-ancla en la posición nueva (que es la real ahora)
    return { contar: false, metros: 0, motivo: 'salto', nuevoAncla: { ...p } };
  }

  if (velocidadKmh < FILTROS_ODOMETRO.MIN_VELOCIDAD_KMH) {
    // Deriva lenta: 20 m en 60 s = 1.2 km/h — la moto no va a 1 km/h
    return { contar: false, metros: 0, motivo: 'lento', nuevoAncla: { ...p } };
  }

  // ✅ Movimiento real: suma y re-ancla
  return { contar: true, metros: d, motivo: 'movimiento', nuevoAncla: { ...p } };
}

/** 'YYYY-MM-DD' de un epoch ms en hora LOCAL (el día del rider) */
export function fechaLocal(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Fecha local de AHORA */
export function hoyLocal(): string {
  return fechaLocal(Date.now());
}

/**
 * Suma los kilómetros de los últimos N días (incluye hoy) desde
 * un mapa día → metros calibrados.
 */
export function sumarDias(dias: Record<string, number>, nDias: number, ahoraMs = Date.now()): number {
  let total = 0;
  for (let i = 0; i < nDias; i++) {
    const f = fechaLocal(ahoraMs - i * 86400000);
    total += dias[f] || 0;
  }
  return total;
}
