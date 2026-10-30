// ═══════════════════════════════════════════════════════════════
// 🩷 FASE BB: mensajes de los CHICOS DE VENTA — helpers puros
// ═══════════════════════════════════════════════════════════════
// Pedido de Rudy: el botón 🩷 de Mi Ruta mandaba el contacto SOLO,
// con un mensaje quemado en el bot y sin forma de cambiarlo. Ahora:
//
//   • el mensaje es EDITABLE en el propio modal (con etiquetas);
//   • tiene su BIBLIOTECA DE GUARDADOS propia: guardás los textos
//     que usás seguido (devolución, reclamo, pedir otra cosa…) y
//     los tocás para cargarlos — viven en config_empresa y viajan
//     a todos tus celulares;
//   • los PRESETS de fábrica (acá abajo) siempre están a mano.
//
// La APP resuelve las etiquetas y manda el texto PEGADO en la
// acción (lección AM/AN: lo que viaja EN la acción llega — el bot
// ni se entera de Firestore extra).
// ═══════════════════════════════════════════════════════════════

/** Un mensaje guardado en la biblioteca 🩷 */
export interface MensajeVenta {
  id: string;
  /** nombre corto que ves en el chip: "Devolución", "Reclamo"… */
  nombre: string;
  /** el texto (con etiquetas {cliente} {ventas_nombre}…) */
  texto: string;
}

/** Un chico de venta (de config_empresa.ventas) */
export interface PersonaVenta {
  clave: 'fabiana' | 'karla' | 'tocho';
  nombre: string;
  celular: string;
}

/** Presets de fábrica — SIEMPRE visibles en el modal (no se borren) */
export const PRESETS_VENTA: MensajeVenta[] = [
  {
    id: 'preset-productos',
    nombre: '💜 Más productos',
    texto:
      '💜 *{cliente}, ¿quieres más productos?*\nEscríbele a *{ventas_nombre}* por este mismo número — te atenderá rapidito 🙌',
  },
  {
    id: 'preset-devolucion',
    nombre: '📦 Devolución / reclamo',
    texto:
      'Hola {cliente} 🙌\n\nSi es por *devolución*, *reclamo* o cualquier duda con tu pedido, comunícate directo con *{ventas_nombre}* 📞 *{ventas_celular}*\n\nTe va a atender al toque 🙏',
  },
  {
    id: 'preset-dudas',
    nombre: '❓ Cualquier duda',
    texto:
      'Hola {cliente} 🙌\n\nPara *cualquier cosita* — dudas, cambios, pedir otra cosa — escríbele a *{ventas_nombre}* 📞 *{ventas_celular}*\n\n¡Estamos para ayudarte! 🩷',
  },
];

/** El mensaje por defecto cuando no hay nada elegido (el de siempre
 *  del bot, para que nada cambie para quien no toca nada) */
export const MENSAJE_VENTA_DEF = PRESETS_VENTA[0].texto;

/** Reemplaza las etiquetas del texto con los datos reales.
 *  Etiquetas: {cliente} {ventas_nombre} {ventas_celular} {empresa} */
export function resolverMensajeVenta(
  texto: string,
  vars: { cliente?: string; ventas_nombre?: string; ventas_celular?: string; empresa?: string },
): string {
  const cliente = (vars.cliente ?? '').trim();
  const nombre = (vars.ventas_nombre ?? '').trim() || 'ventas';
  const cel = (vars.ventas_celular ?? '').trim();
  const empresa = (vars.empresa ?? '').trim();
  return String(texto ?? '')
    .replaceAll('{cliente}', cliente)
    .replaceAll('{ventas_nombre}', nombre)
    .replaceAll('{ventas_celular}', cel)
    .replaceAll('{empresa}', empresa);
}

/** Normaliza la biblioteca que viene de Firestore (lo que sea que
 *  haya quedado guardado): solo objetos con id/nombre/texto, sin
 *  duplicados de id, máximo 30, textos recortados a 1500 chars. */
export function sanearBiblioteca(crudo: unknown): MensajeVenta[] {
  if (!Array.isArray(crudo)) return [];
  const vistos = new Set<string>();
  const limpios: MensajeVenta[] = [];
  for (const item of crudo) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Partial<MensajeVenta>;
    const id = String(m.id ?? '').trim();
    const nombre = String(m.nombre ?? '').trim().slice(0, 40);
    const texto = String(m.texto ?? '').slice(0, 1500);
    if (!id || !nombre || !texto.trim()) continue;
    if (vistos.has(id)) continue;
    vistos.add(id);
    limpios.push({ id, nombre, texto });
    if (limpios.length >= 30) break;
  }
  return limpios;
}

/** Id corto para un mensaje nuevo (fecha + random, sin dependencias) */
export function idMensajeVenta(): string {
  return 'mv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
