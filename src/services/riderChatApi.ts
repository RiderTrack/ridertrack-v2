// ═══════════════════════════════════════════════════════════
// 📡 RIDER CHAT — envío por WhatsApp Cloud API (Fase 3.15)
//
// Port de riderchat-v2/services/whatsapp.ts + broadcast.ts,
// con los blindajes de RiderTrack:
//   • Transporte dual: APK → CapacitorHttp (nativo OkHttp, sin
//     CORS — patrón Fase 3.13), Web → fetch directo
//   • Detección nativa CORRECTA (Capacitor.isNativePlatform(),
//     no el window.Capacitor.isNative roto del original)
//   • Modo demo determinístico (sin credencial → simula envío
//     exitoso, para probar el chat antes de configurar Meta)
//   • Plantillas aprobadas con parámetros nombrados + fallback
//     sin parámetros si Meta dice 132000
//   • Los errores de Meta se TRADUCEN al español (whatsappMeta)
// ═══════════════════════════════════════════════════════════

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { traducirErrorMeta } from './whatsappMeta';
import type { Cliente } from './firestore';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const TIMEOUT_MS = 12000;

export interface CredencialRiderChat {
  phoneNumberId: string;
  token: string;
}

export interface PayloadEnvio {
  toPhone: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template';
  text?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: any[];
}

export interface RespuestaEnvio {
  success: boolean;
  messageId?: string;
  error?: string;
  status: 'sent' | 'failed';
}

// ── Transporte dual (inyectable para tests) ────────────────

function parsearBody(data: any): any {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
}

let _postJson: (
  url: string,
  body: any,
  token: string
) => Promise<{ status: number; data: any } | null> = postJsonDefault;

export const _testsRiderChatApi = {
  setPostJson(fn: typeof _postJson) {
    _postJson = fn;
  },
  restaurar() {
    _postJson = postJsonDefault;
  },
};

async function postJsonDefault(
  url: string,
  body: any,
  token: string
): Promise<{ status: number; data: any } | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const resp = await CapacitorHttp.post({
        url,
        data: body,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        connectTimeout: TIMEOUT_MS,
        readTimeout: TIMEOUT_MS,
      });
      return { status: resp.status ?? 0, data: parsearBody(resp.data) };
    } catch (e: any) {
      if (e?.data) return { status: e?.status ?? 400, data: parsearBody(e.data) };
      return null;
    }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = parsearBody(await res.json().catch(() => null));
    return { status: res.status, data };
  } catch {
    return null;
  }
}

// ── Normalización de teléfonos ─────────────────────────────

/** Peruano → 51XXXXXXXXX; otros países quedan en dígitos */
export function normalizarTelefono(tel: string): string {
  let limpio = String(tel || '').replace(/\D/g, '');
  if (limpio.startsWith('51') && limpio.length === 11) return limpio;
  if (limpio.length === 9 && limpio.startsWith('9')) return '51' + limpio;
  return limpio;
}

// ── Envío de mensajes ──────────────────────────────────────

/**
 * Envía un mensaje por la Cloud API con reintentos.
 * Sin credencial → MODO DEMO: simula un envío exitoso (para
 * probar el chat mientras configuras Meta).
 */
export async function sendWhatsAppMessage(
  config: CredencialRiderChat,
  payload: PayloadEnvio,
  retries = 2
): Promise<RespuestaEnvio> {
  const para = normalizarTelefono(payload.toPhone);

  // Modo demo (sin credencial guardada)
  if (!config.phoneNumberId || !config.token) {
    await new Promise((res) => setTimeout(res, 700 + Math.random() * 400));
    return {
      success: true,
      messageId: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: 'sent',
    };
  }

  const url = `${GRAPH_URL}/${config.phoneNumberId}/messages`;

  const requestBody: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: para,
  };

  if (payload.type === 'text') {
    requestBody.type = 'text';
    requestBody.text = { preview_url: true, body: payload.text || '' };
  } else if (payload.type === 'image') {
    requestBody.type = 'image';
    requestBody.image = { link: payload.mediaUrl, caption: payload.caption || '' };
  } else if (payload.type === 'document') {
    requestBody.type = 'document';
    requestBody.document = {
      link: payload.mediaUrl,
      caption: payload.caption || '',
      filename: payload.filename || 'documento.pdf',
    };
  } else if (payload.type === 'audio') {
    requestBody.type = 'audio';
    requestBody.audio = { link: payload.mediaUrl };
  } else if (payload.type === 'template') {
    requestBody.type = 'template';
    requestBody.template = {
      name: payload.templateName || 'hello_world',
      language: { code: payload.templateLanguage || 'es' },
      components: payload.templateComponents || [],
    };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await _postJson(url, requestBody, config.token);
    if (!r) {
      // Sin red — reintenta (el último intento falla definitivo)
      if (attempt === retries) {
        return {
          success: false,
          error: 'Sin conexión con Meta — revisa tu internet',
          status: 'failed',
        };
      }
    } else {
      const data = parsearBody(r.data) || {};
      if (r.status === 200 && data?.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id, status: 'sent' };
      }
      // Error de Meta — los de token/parametro no se recuperan con retry
      const err = data?.error;
      const errMsg = err ? traducirErrorMeta(err) : `Meta respondió ${r.status}`;
      const recuperable = !err?.code || ![190, 100, 10, 131000, 132000].includes(Number(err.code));
      if (!recuperable || attempt === retries) {
        return { success: false, error: errMsg, status: 'failed' };
      }
    }
    // backoff exponencial antes del siguiente intento
    await new Promise((res2) => setTimeout(res2, 1000 * Math.pow(2, attempt)));
  }

  return { success: false, error: 'Se agotaron los intentos', status: 'failed' };
}

// ═══════════════════════════════════════════════════════════
// 📋 PLANTILLAS APROBADAS — Meta Cloud API
// Nombres EXACTOS como están en Meta (idioma es_PE)
// ═══════════════════════════════════════════════════════════

export interface PlantillaMeta {
  name: string;
  language: string;
  label: string;
  descripcion: string;
  emoji: string;
}

export const PLANTILLAS_APROBADAS: PlantillaMeta[] = [
  {
    name: 'inicio_ruta',
    language: 'es_PE',
    label: 'Inicio de Ruta',
    descripcion: 'Avisa al cliente que su pedido va en camino',
    emoji: '🚀',
  },
  {
    name: 'solicitar_ubicacion',
    language: 'es_PE',
    label: 'Solicitar Ubicación',
    descripcion: 'Pide al cliente su ubicación actual',
    emoji: '📍',
  },
  {
    name: 'qr_metodo_de_pago',
    language: 'es_PE',
    label: 'QR Método de Pago',
    descripcion: 'Envía el QR de Yape con el monto a pagar',
    emoji: '💳',
  },
  {
    name: 'eta_actualizada',
    language: 'es_PE',
    label: 'ETA Actualizada',
    descripcion: 'Avisa en cuántos minutos llegas',
    emoji: '⏱️',
  },
  {
    name: 'entrega_completada',
    language: 'es_PE',
    label: 'Entrega Completada',
    descripcion: 'Confirma que el pedido fue entregado',
    emoji: '✅',
  },
];

/** Las 4 estrella para los botones rápidos del chat */
export const PLANTILLAS_BOTONES_RAPIDOS: PlantillaMeta[] = PLANTILLAS_APROBADAS.filter((p) =>
  ['inicio_ruta', 'solicitar_ubicacion', 'qr_metodo_de_pago', 'eta_actualizada'].includes(p.name)
);

// Datos del Yape de la empresa (variables de las plantillas)
const YAPE_NUMBER = '980811297';
const YAPE_OWNER = 'Lorenzo N. Tarazona T.';

/** Cliente del broadcast (adaptación flexible de la ruta) */
export interface ClienteBroadcast {
  id: string | number;
  nombre: string;
  cel: string;
  prod?: string;
  cobrar?: number;
  dir?: string;
  dist?: string;
  st?: string;
  num?: number;
}

/**
 * Convierte los clientes de la ruta de RiderTrack al formato del
 * broadcast: solo los que tienen celular válido, ordenados por
 * número de entrega.
 */
export function clientesParaBroadcast(clientes: Cliente[]): ClienteBroadcast[] {
  return clientes
    .filter((c) => {
      const tel = normalizarTelefono(String(c.cel || ''));
      return tel.length >= 9;
    })
    .map((c) => ({
      id: c.id,
      num: c.num,
      nombre: c.nombre,
      cel: normalizarTelefono(String(c.cel || '')),
      prod: c.prod,
      cobrar: Number(c.cobrar || 0),
      dir: c.dir,
      dist: c.dist,
      st: c.st,
    }))
    .sort((a, b) => (a.num || 999) - (b.num || 999));
}

/**
 * Construye los parámetros (con NOMBRE) de cada plantilla.
 * delivery_number/total_deliveries = posición en la ruta.
 */
function construirParametros(
  nombrePlantilla: string,
  cliente: ClienteBroadcast | undefined,
  opts?: { posicion?: number; total?: number; minutosEta?: string }
): { name: string; value: string }[] {
  const customer_name = cliente?.nombre || 'Cliente';
  const order_product = cliente?.prod || 'Pedido';
  const order_amount = cliente?.cobrar ? cliente?.cobrar.toFixed(2) : '0.00';
  const address_district = cliente?.dist || 'Distrito';
  const address_street = cliente?.dir || 'Dirección';
  const eta_minutes = opts?.minutosEta || '15';
  const ahora = new Date();
  const start_time = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;
  const total_deliveries = String(opts?.total ?? 0);
  const delivery_number = String(opts?.posicion ?? 0);

  switch (nombrePlantilla) {
    case 'inicio_ruta':
      return [
        { name: 'customer_name', value: customer_name },
        { name: 'order_product', value: order_product },
        { name: 'order_amount', value: order_amount },
        { name: 'address_street', value: address_street },
        { name: 'address_district', value: address_district },
        { name: 'start_time', value: start_time },
        { name: 'total_deliveries', value: total_deliveries },
        { name: 'delivery_number', value: delivery_number },
      ];
    case 'solicitar_ubicacion':
      return [
        { name: 'customer_name', value: customer_name },
        { name: 'order_product', value: order_product },
        { name: 'order_amount', value: order_amount },
        { name: 'address_district', value: address_district },
      ];
    case 'qr_metodo_de_pago':
      return [
        { name: 'customer_name', value: customer_name },
        { name: 'yape_number', value: YAPE_NUMBER },
        { name: 'yape_owner_name', value: YAPE_OWNER },
        { name: 'order_product', value: order_product },
        { name: 'order_amount', value: order_amount },
      ];
    case 'eta_actualizada':
      return [
        { name: 'customer_name', value: customer_name },
        { name: 'eta_minutes', value: eta_minutes },
        { name: 'order_product', value: order_product },
        { name: 'order_amount', value: order_amount },
      ];
    case 'entrega_completada':
      return [
        { name: 'customer_name', value: customer_name },
        { name: 'order_product', value: order_product },
        { name: 'order_amount', value: order_amount },
      ];
    default:
      return [];
  }
}

/**
 * Envía una PLANTILLA APROBADA por la Cloud API.
 * Estrategia: primero CON parámetros del cliente; si Meta dice
 * 132000 (params no coinciden), reintenta SIN parámetros.
 */
export async function enviarPlantillaMeta(
  config: CredencialRiderChat,
  telefono: string,
  plantilla: PlantillaMeta,
  cliente?: ClienteBroadcast,
  opts?: { posicion?: number; total?: number; minutosEta?: string }
): Promise<RespuestaEnvio> {
  const telNormalizado = normalizarTelefono(telefono);

  // Modo demo
  if (!config.phoneNumberId || !config.token) {
    await new Promise((r) => setTimeout(r, 500));
    return {
      success: true,
      messageId: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: 'sent',
    };
  }

  // Componentes con parámetros nombrados
  let componentes: any[] = [];
  if (cliente) {
    const params = construirParametros(plantilla.name, cliente, opts);
    if (params.length > 0) {
      componentes = [
        {
          type: 'body',
          parameters: params.map((p) => ({
            type: 'text',
            text: p.value,
            parameter_name: p.name,
          })),
        },
      ];
    }
  }

  const enviar = async (comps: any[]): Promise<RespuestaEnvio> => {
    const r = await _postJson(
      `${GRAPH_URL}/${config.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: telNormalizado,
        type: 'template',
        template: {
          name: plantilla.name,
          language: { code: plantilla.language },
          components: comps,
        },
      },
      config.token
    );
    if (!r) {
      return { success: false, error: 'Sin conexión con Meta — revisa tu internet', status: 'failed' };
    }
    const data = parsearBody(r.data) || {};
    if (r.status === 200 && data?.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id, status: 'sent' };
    }
    return {
      success: false,
      error: data?.error ? traducirErrorMeta(data.error) : `Meta respondió ${r.status}`,
      status: 'failed',
    };
  };

  // Intento 1: CON parámetros
  if (componentes.length > 0) {
    const r1 = await enviar(componentes);
    if (r1.success) return r1;
    const err = String(r1.error || '');
    // 132000 = params no coinciden → probamos sin parámetros
    if (!err.includes('132000') && !err.includes('parameters does not match')) {
      return r1;
    }
  }

  // Intento 2: SIN parámetros
  return enviar([]);
}
