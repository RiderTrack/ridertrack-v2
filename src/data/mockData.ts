// ═══════════════════════════════════════════════════════════
// 📝 PLANTILLAS WHATSAPP - RiderTrack V2
//
// Fase 1.2: este archivo antes contenía TODOS los datos demo
// (pedidos, repartidores, clientes, actividades, notificaciones
// falsas). Fueron eliminados: ahora toda la UI consume datos
// reales de Firestore vía useClientes + utils/realData.
// Solo sobreviven las plantillas de mensaje, que son editables
// y se usan como base para el editor de WhatsApp.
// ═══════════════════════════════════════════════════════════

import { WhatsAppTemplate } from '../types';

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'TPL-01',
    nombre: 'Confirmación de Pedido',
    categoria: 'Operacional',
    contenido: '¡Hola {{cliente}}! 👋 Confirmamos tu pedido. Te avisaremos cuando esté en camino hacia tu dirección. ¡Gracias por tu compra! 💚',
    variables: ['{{cliente}}'],
  },
  {
    id: 'TPL-02',
    nombre: 'Voy en Camino',
    categoria: 'Despacho',
    contenido: '🛵 ¡Hola {{cliente}}! Tu pedido ya está en camino. En minutos llegamos a tu dirección. ¡Gracias por la espera!',
    variables: ['{{cliente}}'],
  },
  {
    id: 'TPL-03',
    nombre: 'Recordatorio de Pago',
    categoria: 'Cobranza',
    contenido: 'Hola {{cliente}}, te recuerdo el pago pendiente de tu pedido. Puedes pagar con Yape, Plin o efectivo al recibir. ¡Gracias! 💚',
    variables: ['{{cliente}}'],
  },
  {
    id: 'TPL-04',
    nombre: 'Entrega Completada',
    categoria: 'Operacional',
    contenido: '✅ ¡Gracias {{cliente}}! Tu pedido fue entregado con éxito. Cualquier cosa me escribes por aquí. ¡Esperamos verte pronto! 🎉',
    variables: ['{{cliente}}'],
  },
];
