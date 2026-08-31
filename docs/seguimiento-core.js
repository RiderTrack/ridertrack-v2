// ═══════════════════════════════════════════════════════════
// 🛵 SEGUIMIENTO CLIENTE — Lógica pura (Fase 2.15)
// La comparten docs/index.html (GitHub Pages) y los tests de Node.
// Sin DOM ni Firebase aquí: solo cálculos.
// ═══════════════════════════════════════════════════════════

/** Distancia entre 2 puntos en km (fórmula de Haversine) */
export function haversineKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ¿El estado del cliente cuenta como entrega completada?
 * (lista oficial de la app — RutaView: métodos de pago = entregado) */
export function estaEntregado(st) {
  return [
    'efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia',
    'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio', 'entregado',
  ].includes(st);
}

/** ¿Falló la entrega? (lista oficial de la app — RutaView) */
export function estaFallido(st) {
  return ['fallida', 'fallido', 'rechazado', 'cancelado', 'ausente', 'no-contesta'].includes(st);
}

/** Estados macro de la entrega del cliente */
export const ESTADO = {
  ENTREGADO: 'entregado',
  FALLIDO: 'fallido',
  REPROGRAMADA: 'reprogramada',
  LLEGANDO: 'llegando',
  EN_CAMINO: 'en_camino',
};

/**
 * Estado macro de la entrega de MI cliente según su st y la distancia
 * de la moto a su parada.
 */
export function estadoDe(miCliente, distanciaKm) {
  if (!miCliente) return ESTADO.EN_CAMINO;
  if (estaEntregado(miCliente.st)) return ESTADO.ENTREGADO;
  if (estaFallido(miCliente.st)) return ESTADO.FALLIDO;
  if (miCliente.st === 'reprogramar') return ESTADO.REPROGRAMADA;
  if (typeof distanciaKm === 'number' && distanciaKm <= 0.4) return ESTADO.LLEGANDO;
  return ESTADO.EN_CAMINO;
}

/** Velocidad por defecto (km/h) si no hay publicación del GPS */
const VEL_DEFECTO_KMH = 16;
/** Factor de ruta por calles vs línea recta (Lima ~1.35) */
const FACTOR_CALLE = 1.35;
/** Minutos de atención por parada anterior a la mía */
const MIN_POR_PARADA = 4;

/**
 * Calcula el resumen del seguimiento para MI cliente.
 * @param posicion  {lat,lng,velocidadKmh?,actualizadoAt?} de la moto (o null)
 * @param clientes  lista completa de clientes de la ruta (con num, st, lat, lng)
 * @param miId      id de MI cliente
 * @returns resumen o null si mi cliente no está en la ruta
 */
export function calcular(posicion, clientes, miId) {
  if (!Array.isArray(clientes) || clientes.length === 0) return null;
  const miStr = String(miId);
  const yo = clientes.find((c) => String(c.id) === miStr);
  if (!yo) return null;

  const conNum = [...clientes].sort((a, b) => (a.num ?? 0) - (b.num ?? 0));
  const miNum = yo.num ?? conNum.indexOf(yo) + 1;

  // Paradas pendientes ANTES que yo (orden de ruta, aún sin entregar)
  const antes = conNum.filter(
    (c) =>
      c !== yo &&
      (c.num ?? 0) < miNum &&
      !estaEntregado(c.st) &&
      !estaFallido(c.st) &&
      typeof c.lat === 'number'
  );

  // Distancia total: moto → pendientes en orden → mi parada
  let distanciaKm = 0;
  let cursor = posicion && typeof posicion.lat === 'number' ? posicion : null;
  for (const p of antes) {
    if (cursor) distanciaKm += haversineKm(cursor, p);
    cursor = p;
  }
  if (cursor && typeof yo.lat === 'number' && typeof yo.lng === 'number') {
    distanciaKm += haversineKm(cursor, { lat: yo.lat, lng: yo.lng });
  }
  distanciaKm = Math.round(distanciaKm * 10) / 10;

  const vel =
    posicion && typeof posicion.velocidadKmh === 'number' && posicion.velocidadKmh > 8
      ? Math.min(posicion.velocidadKmh, 45)
      : VEL_DEFECTO_KMH;

  const viajeMin = (distanciaKm * FACTOR_CALLE * 60) / vel;
  const etaMin = Math.max(
    1,
    Math.round((viajeMin + antes.length * MIN_POR_PARADA) / 5) * 5
  );

  // Hora aproximada de llegada
  const llegada = new Date(Date.now() + etaMin * 60000);
  const etaHora = `${String(llegada.getHours()).padStart(2, '0')}:${String(
    llegada.getMinutes()
  ).padStart(2, '0')}`;

  const distanciaDirectaKm =
    posicion && typeof yo.lat === 'number' && typeof yo.lng === 'number'
      ? haversineKm(posicion, { lat: yo.lat, lng: yo.lng })
      : null;

  return {
    estado: estadoDe(yo, distanciaDirectaKm),
    pendientesAntes: antes.length,
    etaMin,
    etaHora,
    distanciaKm,
    distanciaDirectaKm,
    orden: miNum,
    total: conNum.length,
  };
}

/** "hace 3 min" / "hace 45 s" / null si no hay timestamp */
export function haceRato(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}

/** ¿La posición está desactualizada (rider en otra app / sin señal)? */
export function posicionStale(iso, segundos = 180) {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > segundos * 1000;
}

/** Normaliza celular peruano a wa.me (519…) */
export function telWhatsApp(tel) {
  if (!tel) return '';
  let d = String(tel).replace(/[^0-9]/g, '');
  if (d.length === 9) d = '51' + d;
  if (d.length === 10 && d.startsWith('0')) d = '51' + d.slice(1);
  return d;
}
