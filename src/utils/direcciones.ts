// ═══════════════════════════════════════════════════════════
// 🏚️ DETECTOR DE DIRECCIONES INCOMPLETAS — RiderTrack V2
// (Fase 2.5 — portado del Rider Modular v1 direcciones-ia.js)
// (Fase 3.14 — SUPERDETECTOR: lote/lt, mza, manz., "entre
//  calle y calle" y "cuadra N". Caso real que lo motivó: un
//  cliente de Breña con "…entre Jr. 2 y Jr. 4" pasaba como
//  dirección BUENA porque el 2 y el 4 —nombres de calles—
//  engañaban al chequeo de dígitos)
//
// Detecta direcciones que NO especifican un número exacto:
//   - 'mz'  → por MANZANA/LOTE ("mz c 12", "manzana b", "mz. 15
//             lote 3", "mza-c", "lote 3", "lt 29")
//   - 'sn'  → SIN NÚMERO ("s/n", "sn", "sin número", "sin numero")
//   - 'ref' → SOLO REFERENCIA ("entre Jr. Quilca y Jr. Paruro",
//             "cuadra 5 de Av. Brasil", sin ningún dígito…)
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
 * 1. mz   → manzana o lote (mz, mza, manzana, manz., lt, lote)
 * 2. sn   → "s/n", "sn" suelto, "sin numero"
 * 3. ref  → sin NÚMERO DE CASA: se quita la cláusula "entre …"
 *           y las referencias "cuadra N" y quedan solo palabras
 *           ("av brasil") o nada → referencia, no un punto
 * 4. ok   → tiene número de casa ("av sucre 523")
 *
 * La clave del fix 3.14: en "entre Jr. 2 y Jr. 4" el 2 y el 4
 * son NOMBRES de calles, no el número de la casa. Se quita la
 * cláusula "entre…" ANTES de mirar los dígitos: "av arequipa
 * 123 entre jr 2 y jr 4" sigue OK (el 123 es de la casa), pero
 * "av brasil entre jr 2 y jr 4" queda como SOLO REFERENCIA.
 */
export function tipoDireccion(dir: string, obs?: string): TipoDireccion {
  const d = normalizar(dir);

  // 1) Por manzana/lote — familia completa de la v1:
  //    mz c | mz-c | mz.15 | mza c | mza5 | manzana b | manz. c
  //    lt 29 | lote 3 | lote-b | mz c lt 29
  if (
    /\bmz\b/.test(d) ||
    /\bmz[\s._:-]+\s*[a-z0-9]/.test(d) ||
    /\bmza\b/.test(d) ||
    /\bmza[\s._:-]?\s*[a-z0-9]/.test(d) ||
    /\bmanzana\b/.test(d) ||
    /\bmanz\.?\s*[-\s._:]?\s*[a-z0-9]/.test(d) ||
    /\blote\b/.test(d) ||
    /\blt[\s._:-]+\s*[a-z0-9]/.test(d)
  ) {
    return 'mz';
  }

  // 2) Sin número — v1: /s\.?n\.?\b|sin\s*n[uú]m/
  if (/s\s*\/\s*n/.test(d) || /\bs\.?n\.?\b/.test(d) || /sin\s*numero/.test(d)) {
    return 'sn';
  }

  // 3a. Sin NINGÚN dígito ("frente al mercado", "casa azul")
  if (d.length > 0 && !/\d/.test(d)) {
    return 'ref';
  }

  // 3b. Tiene dígitos… ¿pero son de la CASA o de referencias?
  //     Se quita "entre …" (hasta una coma o el final) y
  //     "cuadra/cdra N", y se vuelve a mirar:
  //     "av arequipa 123 entre jr 2 y jr 4" → "av arequipa 123" → OK
  //     "av brasil entre jr 2 y jr 4"      → "av brasil"      → REF
  //     "cuadra 5 de av brasil"            → "de av brasil"   → REF
  if (d.length > 0) {
    const sinReferencias = d
      .replace(/\bentre\b[^,]*/g, ' ')
      .replace(/\b(cuadra|cdra)\.?\s+\d+\b/g, ' ');
    if (!/\d/.test(sinReferencias)) {
      return 'ref';
    }
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
 * 📍 Detecta si un texto ES un par de coordenadas pegado
 * ("-12.000013,-77.108397"). Fix 2.18 — lo usan:
 *   - geocodificarDireccion(): vía rápida → la coordenada se usa
 *     TAL CUAL, exacta, sin llamar a ningún geocoder (el mapa y el
 *     optimizador clavan el pin donde es).
 *   - exportarCircuitRuta(): las manda en las columnas Latitude/
 *     Longitude del Excel — la doc oficial de Circuit/Spoke pide
 *     coordenadas O dirección, NUNCA ambas — así Circuit ya no
 *     "manda a Carabayllo" una parada que era del Callao.
 * Acepta coma o punto y coma, con o sin espacios alrededor.
 * Rango válido: latitud -90..90, longitud -180..180.
 */
export function extraerCoordenadas(texto: string | null | undefined): { lat: number; lng: number } | null {
  if (!texto) return null;
  const m = String(texto)
    .trim()
    .match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/**
 * 📍 (Fase 3.49) Detector FLEXIBLE de coordenadas — encuentra un par
 * lat,lng DENTRO de cualquier texto pegado, no solo cuando el texto
 * es puro el par:
 *
 *   • "-11.988690,-77.078981"                       (pegado directo)
 *   • "https://www.google.com/maps?q=-11.988690,-77.078981&z=17"
 *   • "...maps?q=-11.988690%2C-77.078981..."        (coma URL-encoded)
 *   • "...maps/@-11.988690,-77.078981,17z..."       (formato @ del navegador)
 *   • "...maps/place/...!3d-11.988690!4d-77.078981" (pin soltado en el mapa)
 *   • "Ubicación: -11.988690, -77.078981 (casa azul)"
 *
 * ¿POR QUÉ? extraerCoordenadas solo ve el par si TODO el texto es el
 * par. El caso real que rompía todo: el cliente manda su 📍 por
 * WhatsApp, el link de Google Maps queda guardado en la observación
 * del cliente, y cuando el rider lo pegaba en el buscador la app
 * mandaba el texto a búsqueda libre → Google devolvía 0 y Nominatim
 * basura difusa (Carabayllo, Villa El Salvador… a 77 km). Con este
 * detector el texto NUNCA llega al buscador: va directo a
 * geocodificación inversa (coordenadas → dirección exacta).
 *
 * Seguridad anti-falsos-positivos: exige 2+ decimales en ambos
 * números (una dirección nunca trae "-12.05,-77.04" suelto) y valida
 * rango lat ≤ 90 / lng ≤ 180. "Av. Larco 123, Miraflores" no matchea.
 */
export function detectarCoordenadas(texto: string | null | undefined): { lat: number; lng: number } | null {
  if (!texto) return null;
  const t = String(texto);

  // 1) ¿Todo el texto ES el par? (ruta rápida del Fix 2.18)
  const directo = extraerCoordenadas(t.trim());
  if (directo) return directo;

  // 2) Par con decimales dentro de un texto más largo (",", ";",
  //    "%2C" o " " como separador — el espacio solo si ambos traen
  //    4+ decimales, para no confundir con "jr 2.5 4.5")
  const patrones: RegExp[] = [
    /(-?\d{1,3}\.\d{2,})\s*(?:%2C|[,;])\s*(-?\d{1,3}\.\d{2,})/i,
    /(-?\d{1,3}\.\d{4,})\s+(-?\d{1,3}\.\d{4,})/,
    /!3d(-?\d{1,3}\.\d{2,})!4d(-?\d{1,3}\.\d{2,})/i,
  ];
  for (const re of patrones) {
    const m = t.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        if (lat !== 0 || lng !== 0) return { lat, lng };
      }
    }
  }
  return null;
}

/**
 * 📏 Distancia aprox. en metros entre dos puntos (Haversine
 * simplificado) — la usa UbicarClienteModal para saber si las
 * coordenadas detectadas en las observaciones del cliente son
 * DISTINTAS de las que ya tiene guardadas (y valen la pena mostrar).
 */
export function distanciaMetros(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000; // radio terrestre en metros
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
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
