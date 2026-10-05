// ═══════════════════════════════════════════════════════════
// 🏍️ DriverTrack — Tipos centrales (F-ID1 + F-ID2 + F-ID3)
// ═══════════════════════════════════════════════════════════

export type OrigenViaje = 'indrive' | 'rappi' | 'pedidosya' | 'directo';

// F-ID3: un punto del recorrido GPS grabado durante un viaje
export interface PuntoRuta {
  lat: number;  // redondeado a 5 decimales (~1 m)
  lng: number;
  t: number;    // epoch en SEGUNDOS (cuándo pasó por acá)
}

export interface Viaje {
  id: string;
  fecha: string;       // YYYY-MM-DD (hora local Lima)
  hora: string;        // HH:MM
  origen: OrigenViaje;
  cliente: string;
  zona: string;
  direccion: string;   // F-ID2.5: dirección de ENTREGA propia (antes vivía perdida en notas)
                         // FASE C: es la dirección B (entrega); la A (recojo) va en dirA
  dirA?: string;       // FASE C: dirección de RECOJO (A) — de dónde salís a buscar el pedido
  celular: string;     // F-ID2.5: WhatsApp del cliente → botón de cobro
  celularEnvia?: string;  // FASE C: teléfono de QUIEN ENVÍA el paquete (si es delivery)
  celularRecibe?: string; // FASE C: teléfono de QUIEN RECIBE el paquete en destino
  yapeNombre: string;  // F-ID2.6: nombre de la cuenta yape del pedido (ej: "Mk" en "Mk yape 980811297")
  yapeNumero: string;  // F-ID2.6: número yape/plin del pedido — para saber QUIÉN pagó
  kmGPS: number;       // F-ID3: km REALES grabados con GPS mientras manejabas (0 = sin grabar)
  duracionSeg: number; // F-ID3: cuánto duró el trayecto grabado (segundos de movimiento)
  ruta?: PuntoRuta[];  // F-ID3: el trazado para el mapa (se guarda comprimido, máx ~1500 puntos)
  coordenadas?: { lat: number; lng: number }; // F-ID3.2: dónde es la ENTREGA (pin en el mapa, se pone a mano o por GPS)
  coordenadasA?: { lat: number; lng: number }; // FASE C: pin del RECOJO (dirección A)
  kmEstimado?: number;   // FASE F: km A→B calculados SOLOS (Google por calles, o recta ×1.35 de respaldo)
  minEstimados?: number; // FASE F: minutos estimados de manejo A→B
  entregado?: boolean;   // FASE F: ✓ entrega completada — para saber cuántos quedan pendientes
  entregadoHora?: string; // FASE F: HH:MM de cuándo marcaste la entrega
  fotoEntrega?: string;   // FASE H: 📷 evidencia de la entrega (dataURL comprimido ~50-90 KB)
                           // NO viaja a la nube (pesa, como la ruta GPS): queda en el teléfono que la sacó
  fotoEntregaHora?: string; // FASE H: HH:MM de cuándo se guardó la evidencia
  tarifa: number;      // lo que cobra la app / el cliente
  comisionPct: number; // % que se queda la plataforma
  comision: number;    // monto de la comisión
  neto: number;        // tarifa - comisión
  notas: string;
}

// ═══ F-ID6: 💸 Gastos del día ═══
// "Hice varios viajes, me quedé sin saldo y recargué — que me descuente."
// Todo lo que sale del bolsillo (recarga de saldo, gasolina, comida…)
// se anota como gasto y se descuenta del neto → lo que queda EN MANO.
export type TipoGasto = 'saldo' | 'gasolina' | 'comida' | 'otro';

export interface Gasto {
  id: string;
  fecha: string;      // YYYY-MM-DD — el día que salió del bolsillo
  hora: string;       // HH:MM
  tipo: TipoGasto;
  monto: number;      // lo que se gastó (S/), siempre positivo
  nota: string;       // opcional — ej: "recarga completa"
}

export const TIPOS_GASTO: { id: TipoGasto; nombre: string; emoji: string }[] = [
  { id: 'saldo', nombre: 'Recarga', emoji: '📶' },
  { id: 'gasolina', nombre: 'Gasolina', emoji: '⛽' },
  { id: 'comida', nombre: 'Comida', emoji: '🍔' },
  { id: 'otro', nombre: 'Otro', emoji: '📦' },
];

export function nombreGasto(t: TipoGasto): string {
  return TIPOS_GASTO.find(x => x.id === t)?.nombre ?? t;
}

export function emojiGasto(t: TipoGasto): string {
  return TIPOS_GASTO.find(x => x.id === t)?.emoji ?? '📦';
}

export interface Billetera {
  numero: string;
  titular: string;
  qrBase64: string;    // imagen del QR comprimida (JPEG base64)
}

export interface ConfigDT {
  metaDiaria: number;                       // S/ objetivo del día
  comisiones: Record<OrigenViaje, number>;  // % default por origen
  yape: Billetera;
  plin: Billetera;
  geminiKey: string;                        // F-ID2: key de AI Studio para el escáner (vive solo en el teléfono)
  claudeKey: string;                        // F-ID2.5: token de Anthropic — el escáner lo usa de RESPALDO si Gemini falla
  miNombre: string;                         // F-ID3.3: TU nombre — sale grande en tu QR para los clientes
  miCelular: string;                        // F-ID3.3: TU WhatsApp — el QR lo abre directo (una vez, como tu Yape)
  robotActivo: boolean;                     // F-ID5: el botón Cobrar manda el cobro por el robot (automático, con tu QR)
  robotUrl: string;                         // F-ID5: dónde escucha el puente del robot (mismo teléfono → localhost)
  robotToken: string;                       // F-ID5: secreto compartido con el puente (tiene que ser IGUAL en el bot)
  /** FASE C: textos editables de los avisos del robot (si un tipo no
   * está, se usa el original). Se editan en Ajustes → 💬 Mensajes
   * del robot y viajan en el backup y la sincronización en la nube. */
  plantillas?: Record<string, string>;
  /** FASE H: mensaje que va CON la foto de la entrega (Ajustes →
   * 📷 Foto de entrega). Etiquetas {cliente} {direccion} {hora}
   * {miNombre} {firma}. Vacío → MENSAJE_FOTO_DEF de utils. */
  mensajeFoto?: string;
}

export interface ResumenDia {
  n: number;
  bruto: number;
  comision: number;
  neto: number;
  porOrigen: Record<OrigenViaje, { n: number; neto: number }>;
}

export const ORIGENES: { id: OrigenViaje; nombre: string; emoji: string }[] = [
  { id: 'indrive', nombre: 'inDrive', emoji: '🟢' },
  { id: 'rappi', nombre: 'Rappi', emoji: '🟠' },
  { id: 'pedidosya', nombre: 'PedidosYa', emoji: '🔴' },
  { id: 'directo', nombre: 'Directo', emoji: '🔵' },
];

export function nombreOrigen(o: OrigenViaje): string {
  return ORIGENES.find(x => x.id === o)?.nombre ?? o;
}
