// ═══════════════════════════════════════════════════════════
// 🔌 ADAPTADOR realData - RiderTrack V2 (Fase 1.2)
// Convierte los Clientes reales de Firestore (ruta_activa /
// clientes_registrados) al formato Order/Driver que usa la UI,
// y centraliza los mapeos de estado de pago del ecosistema
// (mismos valores de `st` que usan el Modular, el bot Rudy y
// ClienteTrack).
// ═══════════════════════════════════════════════════════════

import { Cliente } from '../services/firestore';
import {
  ActivityItem,
  AppNotification,
  Customer,
  Driver,
  Order,
  OrderStatus,
} from '../types';

// ── Estados reales de Firestore ─────────────────────────────

/** Estados de `st` que significan ENTREGA COMPLETADA + pago cobrado */
export const ESTADOS_PAGADO = [
  'efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos',
  'transferencia', 'yape-plin', 'pago-link', 'jose-smith',
  'empresa', 'cambio',
];

/** Estados de `st` que significan entrega FALLIDA / no concretada */
export const ESTADOS_FALLIDO = [
  'fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta',
];

/** Etiqueta legible para cada estado real */
export const ETIQUETAS_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente',
  efectivo: 'Efectivo',
  'yape-rudy': 'Yape Rudy',
  'yape-efectivo': 'Yape + Efectivo',
  mixto: 'Mixto',
  pos: 'POS',
  transferencia: 'Transferencia',
  'yape-plin': 'Yape/Plin',
  'pago-link': 'Pago Link',
  'jose-smith': 'José Smith',
  empresa: 'Empresa',
  cambio: 'Cambio',
  fallida: 'Fallida',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
  ausente: 'Ausente',
  'no-contasta': 'No contesta',
  'no-contesta': 'No contesta',
};

/** Mapa inverso: método del Panel de Pago → st real de Firestore */
export const METODO_PANEL_A_ST: Record<string, string> = {
  'Efectivo': 'efectivo',
  'Yape Rudy': 'yape-rudy',
  'Yape/Plin': 'yape-plin',
  'Transferencia': 'transferencia',
  'POS': 'pos',
  'Pago Link': 'pago-link',
  'Cambio': 'cambio',
  'Mixto': 'mixto',
  'Empresa': 'empresa',
};

// ── Mapeos de estado ────────────────────────────────────────

/** st real → estado de la UI (pendiente / entregado / cancelado) */
export function estadoClienteAOrden(st: string): OrderStatus {
  if (ESTADOS_PAGADO.includes(st)) return 'entregado';
  if (ESTADOS_FALLIDO.includes(st)) return 'cancelado';
  return 'pendiente';
}

/** st real → método de pago legible en la UI */
function metodoPagoUI(st: string): Order['metodoPago'] {
  switch (st) {
    case 'efectivo':
    case 'cambio':
    case 'yape-efectivo':
      return 'Efectivo';
    case 'pos':
      return 'Tarjeta';
    case 'transferencia':
      return 'Transferencia';
    default:
      return 'Yape/Plin';
  }
}

// ── Hora helpers ────────────────────────────────────────────

/**
 * Convierte "10:45", "10:45 a. m." o "8:05 p. m." a minutos
 * desde medianoche. Devuelve -1 si no puede parsear.
 */
export function horaAMinutos(hora: string): number {
  if (!hora) return -1;
  const m = hora.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return -1;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const esPM = /\bp\.?\s*m\.?\b/i.test(hora);
  const esAM = /\ba\.?\s*m\.?\b/i.test(hora);
  if (esPM && h < 12) h += 12;
  if (esAM && h === 12) h = 0;
  return h * 60 + min;
}

/** "10:45 a. m." → "10:45" (limpio para mostrar) */
export function horaLimpia(hora: string): string {
  if (!hora) return '';
  const m = hora.match(/(\d{1,2}:\d{2})/);
  return m ? m[1] : hora;
}

// ── Cliente → Order ─────────────────────────────────────────

export function clienteAOrden(c: Cliente, riderName?: string): Order {
  const st = c.st || 'pendiente';
  return {
    id: String(c.id),
    num: c.num,
    cliente: c.nombre || 'Sin nombre',
    clienteTelefono: c.cel || '',
    distrito: c.dist || '',
    direccion: c.dir || '',
    estado: estadoClienteAOrden(st),
    stReal: st,
    repartidorNombre: riderName,
    hora: horaLimpia(c.hora || ''),
    monto: parseFloat(String(c.cobrar ?? c.precio ?? 0)) || 0,
    metodoPago: metodoPagoUI(st),
    productos: (c.prod || '').split(',').map((p) => p.trim()).filter(Boolean),
    fotoUrl: c.fotoUrl,
    nota: c.nota || '',
    obs: c.obs || '',
    lat: typeof c.lat === 'number' ? c.lat : undefined,
    lng: typeof c.lng === 'number' ? c.lng : undefined,
  };
}

export function clientesAOrdenes(clientes: Cliente[], riderName?: string): Order[] {
  return clientes.map((c) => clienteAOrden(c, riderName));
}

// ── Cliente → Customer (directorio) ─────────────────────────

export function clientesACustomers(clientes: Cliente[]): Customer[] {
  return clientes.map((c) => ({
    id: String(c.id),
    nombre: c.nombre || 'Sin nombre',
    telefono: c.cel || '',
    distrito: c.dist || '',
    direccionFrecuente: c.dir || '',
    estadoDelDia: c.st || 'pendiente',
    productos: c.prod || '',
    monto: parseFloat(String(c.cobrar ?? c.precio ?? 0)) || 0,
    hora: horaLimpia(c.hora || ''),
  }));
}

// ── Perfil → Driver (el rider es su propio repartidor) ──────

export function riderADriver(
  uid: string,
  nombre: string,
  foto: string | undefined,
  entregasHoy: number
): Driver {
  return {
    id: uid,
    nombre: nombre || 'Rider',
    telefono: '',
    foto: foto || '',
    vehiculo: 'Moto',
    estado: 'disponible',
    pedidosAsignados: 0,
    velocidadActual: 0,
    bateria: 0,
    lat: -12.046374,
    lng: -77.042793,
    distritoActual: 'Lima',
    ultimaActualizacion: '',
    entregasHoy,
    calificacion: 0,
  };
}

// ── Actividades (bitácora del día, derivada de datos reales) ─

export function construirActividades(clientes: Cliente[]): ActivityItem[] {
  const acts: ActivityItem[] = [];

  // Entregas completadas (más recientes primero)
  const entregados = clientes
    .filter((c) => ESTADOS_PAGADO.includes(c.st || ''))
    .sort((a, b) => horaAMinutos(b.hora || '') - horaAMinutos(a.hora || ''));

  for (const c of entregados.slice(0, 5)) {
    acts.push({
      id: `ACT-ENT-${c.id}`,
      tipo: 'pedido',
      titulo: 'Entrega completada',
      descripcion: `${c.nombre || 'Cliente'} — S/ ${parseFloat(String(c.cobrar || 0)).toFixed(2)} (${ETIQUETAS_ESTADO[c.st] || c.st})`,
      tiempo: horaLimpia(c.hora || '') || 'Hoy',
      icono: 'CheckCircle2',
      tipoColor: 'green',
    });
  }

  // Entregas fallidas
  const fallidos = clientes.filter((c) => ESTADOS_FALLIDO.includes(c.st || ''));
  for (const c of fallidos.slice(0, 3)) {
    acts.push({
      id: `ACT-FAL-${c.id}`,
      tipo: 'pedido',
      titulo: 'Entrega fallida',
      descripcion: `${c.nombre || 'Cliente'} — ${ETIQUETAS_ESTADO[c.st] || c.st}`,
      tiempo: horaLimpia(c.hora || '') || 'Hoy',
      icono: 'AlertTriangle',
      tipoColor: 'amber',
    });
  }

  // Resumen de ruta
  const pendientes = clientes.filter(
    (c) => !c.st || c.st === 'pendiente'
  ).length;
  if (pendientes > 0) {
    acts.push({
      id: 'ACT-RUTA-PEND',
      tipo: 'cliente',
      titulo: 'Entregas pendientes',
      descripcion: `${pendientes} ${pendientes === 1 ? 'cliente espera' : 'clientes esperan'} su entrega hoy`,
      tiempo: 'Hoy',
      icono: 'Clock',
      tipoColor: 'blue',
    });
  }

  if (acts.length === 0 && clientes.length > 0) {
    acts.push({
      id: 'ACT-RUTA-OK',
      tipo: 'cliente',
      titulo: 'Ruta al día',
      descripcion: `${clientes.length} clientes en tu ruta, sin entregas pendientes`,
      tiempo: 'Hoy',
      icono: 'CheckCircle2',
      tipoColor: 'green',
    });
  }

  return acts;
}

// ── Notificaciones (derivadas de datos reales) ──────────────

export function construirNotificaciones(
  clientes: Cliente[],
  stats: { pendientes: number; fallidos: number; cobrado: number; porCobrar: number }
): AppNotification[] {
  const notifs: AppNotification[] = [];

  if (stats.pendientes > 0) {
    notifs.push({
      id: 'NOTIF-PEND',
      titulo: 'Entregas pendientes',
      mensaje: `Tienes ${stats.pendientes} ${stats.pendientes === 1 ? 'entrega pendiente' : 'entregas pendientes'} por S/ ${stats.porCobrar.toFixed(2)}`,
      tiempo: 'Ahora',
      leido: false,
      tipo: 'order',
    });
  }

  if (stats.fallidos > 0) {
    notifs.push({
      id: 'NOTIF-FALL',
      titulo: 'Entregas con incidencia',
      mensaje: `${stats.fallidos} ${stats.fallidos === 1 ? 'entrega marcada como fallida' : 'entregas marcadas como fallidas'} — considera reintentar`,
      tiempo: 'Ahora',
      leido: false,
      tipo: 'order',
    });
  }

  if (stats.cobrado > 0) {
    notifs.push({
      id: 'NOTIF-COBRADO',
      titulo: 'Cobranza del día',
      mensaje: `Llevas S/ ${stats.cobrado.toFixed(2)} cobrados en la ruta de hoy`,
      tiempo: 'Ahora',
      leido: false,
      tipo: 'order',
    });
  }

  return notifs;
}

// ── Gráfico horario (entregas por hora del día) ─────────────

export interface DatoHorario {
  hora: string;      // "08", "09", ...
  etiqueta: string;  // "8am", "1pm"
  pedidos: number;
  ingresos: number;
}

/**
 * Construye buckets horarios a partir de la hora de entrega real
 * de los pedidos pagados. Devuelve solo horas con datos; si no
 * hay datos devuelve [].
 */
export function construirGraficoHorario(orders: Order[]): DatoHorario[] {
  const buckets = new Map<number, { pedidos: number; ingresos: number }>();

  for (const o of orders) {
    if (o.estado !== 'entregado') continue;
    const min = horaAMinutos(o.hora || '');
    if (min < 0) continue;
    const hora = Math.floor(min / 60);
    const b = buckets.get(hora) || { pedidos: 0, ingresos: 0 };
    b.pedidos += 1;
    b.ingresos += o.monto || 0;
    buckets.set(hora, b);
  }

  const horas = [...buckets.keys()].sort((a, b) => a - b);
  return horas.map((h) => ({
    hora: String(h).padStart(2, '0'),
    etiqueta: h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
    pedidos: buckets.get(h)!.pedidos,
    ingresos: Math.round(buckets.get(h)!.ingresos * 100) / 100,
  }));
}

// ── Distritos de Lima (para el formulario de nuevo pedido) ──

export const DISTRITOS_LIMA = [
  'Ate', 'Barranco', 'Breña', 'Carabayllo', 'Chaclacayo', 'Chorrillos',
  'Cieneguilla', 'Comas', 'El Agustino', 'Independencia', 'Jesús María',
  'La Molina', 'La Victoria', 'Lince', 'Los Olivos', 'Lurigancho',
  'Lurín', 'Magdalena del Mar', 'Miraflores', 'Pachacámac', 'Pucusana',
  'Pueblo Libre', 'Puente Piedra', 'Punta Hermosa', 'Punta Negra',
  'Rímac', 'San Bartolo', 'San Borja', 'San Isidro', 'San Juan de Lurigancho',
  'San Juan de Miraflores', 'San Luis', 'San Martín de Porres', 'San Miguel',
  'Santa Anita', 'Santa María del Mar', 'Santa Rosa', 'Santiago de Surco',
  'Surquillo', 'Villa El Salvador', 'Villa María del Triunfo',
  'Callao', 'Bellavista', 'La Perla', 'Ventanilla', 'Mi Perú',
];

// ── Enlaces útiles ──────────────────────────────────────────

/** Link de Google Maps para una dirección de entrega */
export function linkGoogleMaps(direccion: string, distrito: string): string {
  const q = encodeURIComponent(`${direccion}, ${distrito}, Lima, Perú`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Link wa.me normalizado (9 dígitos → +51) */
export function linkWhatsApp(telefono: string, texto?: string): string {
  let digits = (telefono || '').replace(/[^0-9]/g, '');
  if (digits.length === 9) digits = '51' + digits;
  if (digits.length === 11 && digits.startsWith('0')) digits = '51' + digits.slice(1);
  const base = `https://wa.me/${digits}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
