// ═══════════════════════════════════════════════════════════
// 🛣️ ODÓMETRO GPS — NÚCLEO PURO (Fase 3.35 · fix 3.37)
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
//        · lento:     velocidad < 1.2 km/h y ya pasó el umbral →
//                     deriva lenta del GPS, no movimiento real
//   3. 🌉 PUENTE (Fase 3.37 — fix del conteo bajo): si hay un
//      HUECO > 8 min sin puntos (pantalla apagada, app en segundo
//      plano — el caso típico: navegas con Waze y RiderTrack
//      queda atrás, Android congela su GPS), ANTES esos km se
//      botaban completos. Ahora: si el desplazamiento recto
//      ancla→punto tiene velocidad media creíble (≤ 80 km/h)
//      y el hueco no pasa de 90 min, la moto SÍ se movió de A
//      a B → se cuenta como PUENTE. Línea recta = subestima un
//      poco el camino real, pero no pierde el tramo. El salto
//      telepórtico o el hueco eterno sigue sin contar.
//   4. Con el FACTOR DE CALIBRACIÓN el rider corrige el sesgo:
//      kmMostrados = metrosCrudos × factor. Si el marcador de
//      la moto dice 30 km y la app 28 → factor 30/28 ≈ 1.07.
//
// PRECISIÓN ESPERADA: ±1-3% con la app abierta en moto urbana;
// con tramos recuperados por puente es algo menor — se calibra.
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
  /** Velocidad mínima creíble moviéndose (km/h) — menos = deriva.
   *  F3.37: bajada de 2 → 1.2 para no perder tráfico pesado
   *  (avanzone a paso de persona = km reales, no deriva). */
  MIN_VELOCIDAD_KMH: 1.2,
  /** Hueco a partir del cual se intenta PUENTE en vez de descartar (ms) */
  GAP_MS: 8 * 60 * 1000,
  /** F3.37: hueco máximo que un puente puede cubrir (ms) — 90 min */
  GAP_PUENTE_MS: 90 * 60 * 1000,
  /** F3.37: velocidad MEDIA máxima para confiar en un puente (km/h) */
  MAX_MEDIA_KMH: 80,
  /** Precisión máxima aceptable (m) */
  MAX_ACCURACY: 50,
} as const;

export type MotivoPunto =
  | 'primero' // no había ancla — solo fija el ancla
  | 'movimiento' // ✅ distancia válida sumada
  | 'puente' // 🌉 F3.37: km recuperados tras hueco de señal
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

  // 4. 🌉 Hueco largo (pantalla apagada / app en segundo plano /
  //    Android congeló el GPS del WebView). F3.37: ANTES se botaba
  //    el tramo completo — causa del conteo bajo (12 km en la app
  //    vs 30+ km reales). AHORA se intenta un PUENTE: si el rider
  //    se movió de A a B con velocidad media creíble (≤ 80 km/h
  //    en ≤ 90 min), ese desplazamiento ES REAL → se cuenta (línea
  //    recta: subestima el camino, pero no lo pierde). El salto
  //    telepórtico o el hueco eterno sigue sin contar y re-ancla.
  if (dt > FILTROS_ODOMETRO.GAP_MS) {
    const dGap = haversineMetros(ancla.lat, ancla.lng, p.lat, p.lng);
    const vMediaKmh = (dGap / dt) * 3600;
    const puenteValido =
      dt <= FILTROS_ODOMETRO.GAP_PUENTE_MS &&
      vMediaKmh <= FILTROS_ODOMETRO.MAX_MEDIA_KMH;
    if (puenteValido) {
      return { contar: true, metros: dGap, motivo: 'puente', nuevoAncla: { ...p } };
    }
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
