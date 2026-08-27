export type NavigationTab =
  | 'dashboard'
  | 'ruta'
  | 'yape'
  | 'pedidos'
  | 'clientes'
  | 'repartidores'
  | 'mapa'
  | 'motorizados'
  | 'whatsapp'
  | 'reportes'
  | 'estadisticas'
  | 'configuracion'
  | 'medios'
  | 'perfil';

export type ThemeMode = 'dark' | 'light';

export type OrderStatus = 'pendiente' | 'en_camino' | 'entregado' | 'cancelado';

export interface Order {
  id: string;
  num?: number;          // Nº de orden en la ruta (1, 2, 3...)
  cliente: string;
  clienteTelefono: string;
  distrito: string;
  direccion: string;
  estado: OrderStatus;
  stReal?: string;       // Estado real de Firestore (efectivo, yape-rudy, fallida...)
  repartidorId?: string;
  repartidorNombre?: string;
  repartidorFoto?: string;
  hora: string;          // Hora de entrega (cuando st != pendiente)
  monto: number;
  metodoPago: 'Efectivo' | 'Yape/Plin' | 'Tarjeta' | 'Transferencia';
  productos: string[];
  fotoUrl?: string;      // Foto de evidencia de entrega (Storage o base64)
  nota?: string;         // Nota del pedido (visible en Evidencias)
  obs?: string;          // Observación original del pedido
  lat?: number;          // Coordenada geocodificada (Fase 1.3, para el mapa)
  lng?: number;          // Coordenada geocodificada (Fase 1.3, para el mapa)
  latSrc?: 'google' | 'nominatim' | 'aprox' | 'manual'; // Origen de la coordenada (Fase 1.4)
}

export interface Driver {
  id: string;
  nombre: string;
  telefono: string;
  foto: string;
  vehiculo: 'Moto' | 'Bicicleta' | 'Van' | 'Auto';
  placa?: string;
  estado: 'en_camino' | 'disponible' | 'en_espera' | 'inactivo';
  pedidosAsignados: number;
  velocidadActual: number; // km/h
  bateria: number; // %
  lat: number;
  lng: number;
  distritoActual: string;
  ultimaActualizacion: string;
  entregasHoy: number;
  calificacion: number;
}

export interface Customer {
  id: string;
  nombre: string;
  telefono: string;
  distrito: string;
  direccionFrecuente: string;
  estadoDelDia: string;   // st real: pendiente, efectivo, fallida...
  productos: string;
  monto: number;
  hora: string;
}

export interface ActivityItem {
  id: string;
  tipo: 'pedido' | 'cliente' | 'whatsapp' | 'repartidor';
  titulo: string;
  descripcion: string;
  tiempo: string;
  icono: string;
  tipoColor: 'blue' | 'green' | 'amber' | 'purple' | 'emerald';
}

export interface WhatsAppMessage {
  id: string;
  destinatarioNombre: string;
  destinatarioTelefono: string;
  mensaje: string;
  plantilla: string;
  estado: 'enviado' | 'entregado' | 'leido' | 'fallido';
  hora: string;
  pedidoId?: string;
}

export interface WhatsAppTemplate {
  id: string;
  nombre: string;
  categoria: string;
  contenido: string;
  variables: string[];
}

export interface AppNotification {
  id: string;
  titulo: string;
  mensaje: string;
  tiempo: string;
  leido: boolean;
  tipo: 'order' | 'driver' | 'whatsapp' | 'system';
}
