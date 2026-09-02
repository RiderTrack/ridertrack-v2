// ═══════════════════════════════════════════════════════════
// 🙏 AVISO DE ENTREGA — Fase 3.44 → 3.46
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

// ═══════════════════════════════════════════════════════════
// 🙏 FASE 3.46 — DECISIÓN ÚNICA DEL DISPARO (con motivo)
//
// BUG que arregla esta versión: el disparo de la 3.44 exigía
// la transición "no entregado → entregado". Si el cliente ya
// venía entregado (repetiste la prueba con el mismo cliente,
// corregiste el método efectivo→yape, o la data venía vieja),
// el disparo NUNCA ocurría — y tocabas todo a mano.
//
// REGLA NUEVA (la que pediste): CADA VEZ que marques un método
// de pago, el robot manda el "gracias por tu compra"… UNA SOLA
// VEZ por cliente. Lo que evita repetidos ya no es la transición
// del st sino el campo `graciasEnviado` en la FICHA del cliente
// (persistente: sobrevive reinicios y cambios de método). Para
// re-mandarlo existe "Mandar ahora" (siempre dispara).
//
// El motivo del silencio se devuelve para explicarlo con un
// toast — nunca más un disparo mudo.
// ═══════════════════════════════════════════════════════════

/** Por qué el disparo se calló (para el toast informativo) */
export type MotivoSkip =
  | 'no-entregado' // marcaste pendiente/fallido — nada que avisar
  | 'sin-cel'      // el cliente no tiene celular guardado
  | 'manual'       // el cliente está en modo manual (botoncito 🙏)
  | 'ya-enviado'   // ya recibió su gracias (campo graciasEnviado)
  | 'guard';       // se le mandó hace menos de 5 min (anti doble)

/** Resultado de la decisión */
export interface DecisionGracias {
  dispara: boolean;
  motivo?: MotivoSkip;
}

/** Datos mínimos de la ficha del cliente para decidir */
export interface ClienteGracias {
  cel?: string | number | null;
  aviso?: string | null;
  /** true = este cliente ya recibió su "gracias por tu compra" */
  graciasEnviado?: boolean;
}

/**
 * ¿El bot debe mandar el "gracias por tu compra" al marcar este
 * estado? Pure function — un solo lugar, un solo criterio, con
 * el motivo del silencio para mostrárselo al rider.
 *
 * `entregados` = lista de st que cuentan como entrega (la pasa
 * el llamador para mantener este archivo sin imports).
 * `guardActivo` = si se mandó un aviso a este teléfono hace
 * menos de 5 minutos (anti doble-envío).
 */
export function decidirGracias(
  previa: ClienteGracias | null | undefined,
  estado: string,
  entregados: readonly string[],
  guardActivo: boolean
): DecisionGracias {
  // Marcaste algo que no es un método de pago → nada que avisar
  if (!entregados.includes(estado)) return { dispara: false, motivo: 'no-entregado' };
  // Sin ficha previa (no debería pasar) → silencio
  if (!previa) return { dispara: false, motivo: 'no-entregado' };
  // Sin celular no hay a quién mandarle el mensajito
  if (!previa.cel) return { dispara: false, motivo: 'sin-cel' };
  // El rider pidió modo manual para este cliente
  if (modoAvisoDe(previa.aviso) === 'manual') return { dispara: false, motivo: 'manual' };
  // Ya recibió su gracias (ficha persistente) — no repetimos
  if (previa.graciasEnviado === true) return { dispara: false, motivo: 'ya-enviado' };
  // Se acaba de mandar (a mano o por disparo) — anti doble
  if (guardActivo) return { dispara: false, motivo: 'guard' };
  // 🎉 Dispara: el robot manda el gracias con imagen
  return { dispara: true };
}

/** Textos del toast para cada motivo (App.tsx los usa) */
export const TEXTO_MOTIVO: Record<MotivoSkip, { titulo: string; detalle: (nombre: string) => string }> = {
  'no-entregado': { titulo: '', detalle: () => '' },
  'sin-cel': {
    titulo: '📱 Sin celular',
    detalle: (n) => `${n} no tiene celular guardado — no puedo avisarle`,
  },
  'manual': {
    titulo: '✋ Modo manual',
    detalle: (n) => `${n} está en MANUAL — el bot no le manda el gracias (cámbialo con el botoncito 🙏)`,
  },
  'ya-enviado': {
    titulo: '🙏 Ya le llegó',
    detalle: (n) => `${n} ya recibió su "gracias por tu compra" — no se repite`,
  },
  'guard': {
    titulo: '🙏 Anti doble',
    detalle: (n) => `Hace un momento ya se le mandó a ${n} — el disparo se calla 5 min`,
  },
};
