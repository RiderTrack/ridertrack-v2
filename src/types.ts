export type NavigationTab =
  | 'dashboard'
  | 'ruta'
  | 'pedidos'
  | 'clientes'
  | 'repartidores'
  | 'mapa'
  | 'whatsapp'
  | 'reportes'
  | 'estadisticas'
  | 'configuracion'
  | 'perfil';

export type ThemeMode = 'dark' | 'light';

export type OrderStatus = 'pendiente' | 'en_camino' | 'entregado' | 'cancelado';

export interface Order {
  id: string;
  cliente: string;
  clienteTelefono: string;
  distrito: string;
  direccion: string;
  estado: OrderStatus;
  repartidorId?: string;
  repartidorNombre?: string;
  repartidorFoto?: string;
  hora: string;
  monto: number;
  metodoPago: 'Efectivo' | 'Yape/Plin' | 'Tarjeta' | 'Transferencia';
  productos: string[];
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
  email: string;
  distrito: string;
  direccionFrecuente: string;
  totalPedidos: number;
  totalGastado: number;
  ultimoPedido: string;
  estado: 'Activo' | 'Frecuente' | 'Nuevo' | 'VIP';
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
