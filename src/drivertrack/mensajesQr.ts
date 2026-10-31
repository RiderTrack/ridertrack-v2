// ═══════════════════════════════════════════════════════════
// 💜🔷 FASE BC: MENSAJES DEL COBRO POR QR — helpers puros
// ═══════════════════════════════════════════════════════════
// Pedido de Rudy (31-oct): "cuando pongo enviar QR me sale enviar
// QR por yape o enviar QR por plin y cada uno tiene su propio
// mensaje — es ahí donde tenemos que atacar: modificar, editar y
// también poder guardar como una LIBRERÍA". El ✏️ de la FASE BB
// quedó en el mensaje genérico del formulario (que ya no se usa);
// los que DE VERDAD viajan al cliente son los dos mensajes por
// billetera. Ahora:
//
//   • cada billetera (💜 Yape / 🔷 Plin) tiene SU mensaje, editable
//     con etiquetas — lo guardás una vez y sale en TODOS los
//     caminos de cobro (QR del viaje, "¿cómo le cobrás?", caja);
//   • LIBRERÍA propia por billetera: guardás las variantes que
//     usás seguido (corto, formal, con dirección…) y las tocás
//     para cargarlas — viven en la config de inDrive → viajan a
//     tu otro celular y a los backups;
//   • los PRESETS de fábrica (acá abajo) siempre están a mano:
//     "De siempre" (el automático de toda la vida, ahora editable)
//     y "Corto";
//   • ↩️ Volvés al automático de siempre cuando quieras.
//
// Módulo 100% autocontenido (sin Firebase, sin React) → se testea
// con Node directo, igual que ventaMensajes.
// ═══════════════════════════════════════════════════════════

/** Una variante guardada en la librería de una billetera */
export interface MensajeQr {
  id: string;
  /** nombre corto que ves en el chip: "Corto", "Con dirección"… */
  nombre: string;
  /** el texto (con etiquetas {cliente} {monto}…) */
  texto: string;
}

/** Las etiquetas disponibles (para el hint de la UI) */
export const ETIQUETAS_QR: { clave: string; ej: string }[] = [
  { clave: 'cliente', ej: 'Carlos' },
  { clave: 'monto', ej: '16.00' },
  { clave: 'direccion', ej: '📍 Entrega en: Av. Siempreviva 742 (se omite si no hay)' },
  { clave: 'numero', ej: '987 654 321 (el de la billetera)' },
  { clave: 'titular', ej: ' (Rudy) — entre paréntesis si lo configuraste' },
];

/**
 * La plantilla de FÁBRICA por billetera — dice EXACTAMENTE lo mismo
 * que el automático de siempre (armarMensajeCobro), pero escrita
 * con etiquetas para que la puedas retocar. Si nunca guardás nada,
 * el cobro sigue saliendo con el automático (cero cambios).
 */
export const PLANTILLA_QR_DEF: Record<'yape' | 'plin', string> = {
  yape: [
    'Hola {cliente}! 👋',
    '',
    '🛵 Monto a pagar por tu pedido: *S/ {monto}*',
    '{direccion}',
    '',
    '💜 Puedes pagarme por Yape:',
    '📱 *{numero}*{titular}',
    '💵 O en efectivo al recibir',
    '',
    '¡Gracias! 💚',
  ].join('\n'),
  plin: [
    'Hola {cliente}! 👋',
    '',
    '🛵 Monto a pagar por tu pedido: *S/ {monto}*',
    '{direccion}',
    '',
    '🔷 Puedes pagarme por Plin:',
    '📱 *{numero}*{titular}',
    '💵 O en efectivo al recibir',
    '',
    '¡Gracias! 💚',
  ].join('\n'),
};

/** Presets de fábrica — SIEMPRE visibles (no se pueden borrar) */
export const PRESETS_QR: Record<'yape' | 'plin', MensajeQr[]> = {
  yape: [
    { id: 'preset-yape-siempre', nombre: '🤖 De siempre', texto: PLANTILLA_QR_DEF.yape },
    {
      id: 'preset-yape-corto',
      nombre: '📏 Corto',
      texto: 'Hola {cliente}! 👋 Te comparto mi Yape 💜 para pagar *S/ {monto}*:\n📱 *{numero}*{titular}\n\n¡Gracias! 💚',
    },
  ],
  plin: [
    { id: 'preset-plin-siempre', nombre: '🤖 De siempre', texto: PLANTILLA_QR_DEF.plin },
    {
      id: 'preset-plin-corto',
      nombre: '📏 Corto',
      texto: 'Hola {cliente}! 👋 Te comparto mi Plin 🔷 para pagar *S/ {monto}*:\n📱 *{numero}*{titular}\n\n¡Gracias! 💚',
    },
  ],
};

/** Los datos que entran en las etiquetas de un cobro */
export interface VarsMensajeQr {
  cliente?: string;
  monto?: number | string;
  direccion?: string;
  /** el número de LA billetera del mensaje */
  numero?: string;
  /** el titular de la billetera */
  titular?: string;
}

/**
 * Reemplaza las etiquetas del texto con los datos reales del cobro.
 *   {cliente}   → el nombre del cliente (o "estimado cliente")
 *   {monto}     → 16.00 (sin "S/", lo escribís vos en el texto)
 *   {direccion} → "📍 Entrega en: …" o '' (la línea se colapsa sola)
 *   {numero}    → el número de la billetera, TAL CUAL lo configuraste
 *                 (igual que el automático — así la plantilla de
 *                 fábrica dice EXACTAMENTE lo mismo que el de siempre)
 *   {titular}   → " (Rudy)" o '' (con el espacio y los paréntesis)
 * Las líneas que quedan vacías se colapsan (igual que el cuadre
 * del jefe) y las etiquetas desconocidas quedan literales.
 */
export function resolverMensajeQr(texto: string, vars: VarsMensajeQr): string {
  const cliente = (vars.cliente ?? '').trim() || 'estimado cliente';
  const m = typeof vars.monto === 'number' ? vars.monto : parseFloat(String(vars.monto ?? '0'));
  const monto = (Number.isFinite(m) ? m : 0).toFixed(2);
  const dir = (vars.direccion ?? '').trim();
  const numero = (vars.numero ?? '').trim();
  const titular = (vars.titular ?? '').trim();
  const resuelto = String(texto ?? '')
    .replaceAll('{cliente}', cliente)
    .replaceAll('{monto}', monto)
    .replaceAll('{direccion}', dir ? `📍 Entrega en: ${dir}` : '')
    .replaceAll('{numero}', numero)
    .replaceAll('{titular}', titular ? ` (${titular})` : '');
  return resuelto
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Normaliza la librería que viene del storage/nube (lo que sea que
 *  haya quedado guardado): solo objetos con id/nombre/texto, sin
 *  ids duplicados, máximo 30 por billetera, textos recortados. */
export function sanearLibreriaQr(crudo: unknown): MensajeQr[] {
  if (!Array.isArray(crudo)) return [];
  const vistos = new Set<string>();
  const limpios: MensajeQr[] = [];
  for (const item of crudo) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Partial<MensajeQr>;
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

/** Id corto para una variante nueva (fecha + random, sin dependencias) */
export function idMensajeQr(): string {
  return 'mq-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
