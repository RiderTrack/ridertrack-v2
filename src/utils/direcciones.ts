// ═══════════════════════════════════════════════════════════
// 🏚️ DETECTOR DE DIRECCIONES INCOMPLETAS — RiderTrack V2
// (Fase 2.5 — portado del Rider Modular v1 direcciones-ia.js)
//
// Detecta direcciones que NO especifican un número exacto:
//   - 'mz'  → por MANZANA ("mz c 12", "manzana b", "mz. 15 lote 3")
//   - 'sn'  → SIN NÚMERO ("s/n", "sn", "sin número", "sin numero")
//   - 'ref' → SOLO REFERENCIA (campo dirección vacío pero hay obs,
//             o la dirección no contiene ningún dígito)
// El rider puede filtrarlos con el chip "⚠️ Mz/SN" en Mi Ruta y
// pedirles su ubicación exacta por WhatsApp con un toque.
// ═══════════════════════════════════════════════════════════

export type TipoDireccion = 'ok' | 'mz' | 'sn' | 'ref';

/** Normaliza: minúsculas, sin acentos, espacios simples */
function normalizar(dir: string): string {
  return (dir || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clasifica una dirección. Orden de chequeo:
 * 1. mz   → contiene "mz", "mz." o "manzana"
 * 2. sn   → contiene "s/n", "sn" suelto, "sin numero"
 * 3. ref  → no tiene NINGÚN dígito en la dirección (solo referencia)
 */
export function tipoDireccion(dir: string, obs?: string): TipoDireccion {
  const d = normalizar(dir);

  // 1) Por manzana — igual que la v1 (\bmz\b|manzana)
  if (/\bmz\b/.test(d) || /\bmanzana\b/.test(d) || /\bmz\s*[a-z0-9]/.test(d)) {
    return 'mz';
  }

  // 2) Sin número — v1: /s\.?n\.?\b|sin\s*n[uú]m/
  if (/s\s*\/\s*n/.test(d) || /\bs\.?n\.?\b/.test(d) || /sin\s*numero/.test(d)) {
    return 'sn';
  }

  // 3) Solo referencia: sin ningún dígito en la dirección
  //    (una dirección real de Lima siempre tiene número:
  //     "av sucre 523", "jr unite 456"...)
  if (d.length > 0 && !/\d/.test(d)) {
    return 'ref';
  }

  // Dirección vacía pero con observación → referencia
  if (!d && (obs || '').trim().length > 0) {
    return 'ref';
  }

  return 'ok';
}

/** Etiqueta corta para el badge del cliente */
export function etiquetaDireccion(t: TipoDireccion): string {
  switch (t) {
    case 'mz': return '🏚️ Mz';
    case 'sn': return '❓ S/N';
    case 'ref': return '📝 Ref';
    default: return '';
  }
}

/** Clase Tailwind del badge según tipo */
export function claseBadgeDireccion(t: TipoDireccion): string {
  switch (t) {
    case 'mz': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'sn': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'ref': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default: return '';
  }
}

/** ¿Este cliente necesita que le pidan su dirección exacta? */
export function direccionIncompleta(dir: string, obs?: string): boolean {
  return tipoDireccion(dir, obs) !== 'ok';
}

/**
 * Mensaje de WhatsApp para pedir la ubicación exacta
 * (mismo espíritu que la v1 enviarMsgDirIA).
 */
export function mensajePedirUbicacion(nombre: string, empresa?: string): string {
  const primerNombre = (nombre || '').split(' ')[0] || '';
  return (
    `Hola ${primerNombre}, soy tu motorizado de ${empresa || 'el delivery'} 🛵\n` +
    `Tengo tu pedido pero necesito que me confirmes tu dirección EXACTA ` +
    `(número de casa/departamento) o me mandes tu 📍 ubicación por WhatsApp ` +
    `para llegar sin perderte. ¡Gracias! 🙏`
  );
}
