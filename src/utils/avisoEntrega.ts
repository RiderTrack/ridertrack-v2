// ═══════════════════════════════════════════════════════════
// 🙏 AVISO DE ENTREGA — Fase 3.44 (restaura el flujo de la v1)
//
// El "botoncito" que iba en cada cliente (Control de mensajes
// de la v1) decidía CÓMO avisarle al cliente cuando su pedido
// pasa a ENTREGADO — por el método que sea (efectivo, yape,
// pos, transferencia…):
//
//   · auto_imagen → el bot le manda la tarjeta "gracias por tu
//     compra" CON IMAGEN apenas lo marcas cobrado (default,
//     como lo tenías en la v1)
//   · auto_texto  → igual pero solo texto
//   · manual      → la app no manda nada: tú decides cuándo
//
// El DISPARO vive en useClientes.cambiarEstado (un solo lugar →
// sirve para Mi Ruta, Seguimiento y Modo Moto). El botoncito
// para cambiar el modo vive en Seguimiento (fila del cliente),
// Modo Moto (tarjeta) y Mi Ruta (modal Control).
//
// PURO: cero imports — testeable con Node (scripts/test-aviso-core.js).
// ═══════════════════════════════════════════════════════════

/** Modo de aviso de entrega por cliente (campo Cliente.aviso) */
export type ModoAvisoEntrega = 'auto_imagen' | 'auto_texto' | 'manual';

/**
 * Modo cuando el cliente no tiene el campo (importado de Excel,
 * creado a mano, o data vieja): AUTOMÁTICO CON IMAGEN — como lo
 * tenías en la v1, que era justo lo que extrañabas.
 */
export const MODO_AVISO_DEFECTO: ModoAvisoEntrega = 'auto_imagen';

/** Etiquetas para la UI */
export const ETIQUETA_MODO: Record<ModoAvisoEntrega, { corto: string; largo: string; icono: string }> = {
  auto_imagen: { corto: 'AUTO 📷', largo: 'Automático con imagen', icono: '📷' },
  auto_texto: { corto: 'AUTO 📝', largo: 'Automático solo texto', icono: '📝' },
  manual: { corto: 'MANUAL', largo: 'Manual — yo lo mando', icono: '✋' },
};

/** Normaliza el campo aviso (data vieja / valores raros → default) */
export function modoAvisoDe(aviso: string | undefined | null): ModoAvisoEntrega {
  if (aviso === 'auto_imagen' || aviso === 'auto_texto' || aviso === 'manual') return aviso;
  return MODO_AVISO_DEFECTO;
}

/** ¿Este modo dispara el mensajito solo (sin tocar un botón)? */
export function esAutomatico(aviso: string | undefined | null): boolean {
  return modoAvisoDe(aviso) !== 'manual';
}

// ── Guard anti doble-envío ─────────────────────────────────
// Si mandaste el "gracias" a mano (Control / chat / Modo Moto)
// y JUSTO después marcas entregado, el disparo automático se
// calla 5 minutos — el cliente no debe recibir el mismo
// mensajito dos veces seguidas.

const AVISOS_ENVIADOS = new Map<string, number>();

/** Ventana en la que un segundo aviso al mismo cliente se suprime */
export const VENTANA_DEDUPE_MS = 5 * 60 * 1000;

/** Marca que acabas de encolar un aviso para este teléfono */
export function registrarAvisoEnviado(clave: string | number | null | undefined): void {
  if (!clave) return;
  AVISOS_ENVIADOS.set(String(clave), Date.now());
}

/** ¿Se encoló un aviso para este teléfono hace menos de `ms`? */
export function avisoEnviadoHacePoco(
  clave: string | number | null | undefined,
  ms: number = VENTANA_DEDUPE_MS
): boolean {
  if (!clave) return false;
  const t = AVISOS_ENVIADOS.get(String(clave));
  if (t == null) return false;
  if (Date.now() - t >= ms) {
    AVISOS_ENVIADOS.delete(String(clave));
    return false;
  }
  return true;
}

/** Solo para tests: limpia el registro */
export function _resetAvisosEnviados(): void {
  AVISOS_ENVIADOS.clear();
}

// ── Normalización de celular (clave del guard) ─────────────
// MISMA lógica que _botCel de services/firestore.ts (duplicada
// A PROPÓSITO: este archivo es puro y vive en Node para los
// tests; si un día cambia una, cambia la otra).

export function claveAviso(cel: string | number | undefined | null): string | null {
  const d = String(cel ?? '').replace(/[^0-9]/g, '');
  if (!d) return null;
  if (d.length === 9) return '51' + d;
  if (d.length === 11 && d.startsWith('51')) return d;
  if (d.length === 12 && d.startsWith('51')) return d;
  if (d.length === 13 && d.startsWith('0051')) return d.slice(2);
  return d.length >= 9 ? '51' + d.slice(-9) : null;
}
