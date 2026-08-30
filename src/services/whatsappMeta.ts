// ═══════════════════════════════════════════════════════════
// 💬 WHATSAPP OFICIAL DE META (Cloud API) — RiderTrack V2
// (Fase 3.14 — base del canal oficial)
//
// Qué es esto: la API oficial de WhatsApp Business Platform
// (Meta). A diferencia del Rider chat (Baileys, que usa el
// WhatsApp del BOT en Termux), este canal sale del número de
// NEGOCIO verificado de la empresa — con plantillas oficiales,
// sin riesgo de ban y con la calidad de Meta.
//
// Qué hace ESTA fase (la base):
//   • guardar la credencial (Phone Number ID + token) en
//     config_empresa → la comparten todos los dispositivos
//   • probar la conexión (GET al número → nombre verificado)
//   • enviar mensajes de texto directos (POST /messages)
//
// El transporte es el mismo patrón blindado de Fase 3.13:
//   1. APK  → CapacitorHttp (HTTP nativo, sin CORS)
//   2. Web  → fetch directo (Graph API sí permite CORS)
//
// Lo que viene DESPUÉS (próximas fases): bandeja de entrada
// (necesita webhook con servidor), plantillas, envío masivo.
// ═══════════════════════════════════════════════════════════

import { Capacitor, CapacitorHttp } from '@capacitor/core';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const TIMEOUT_MS = 12000;

export interface ConfigWhatsAppMeta {
  phoneNumberId: string;
  token: string;
  numero?: string;
  nombreVerificado?: string;
}

/** Normaliza un celular peruano al formato de la API (51…, sin +) */
export function normalizarDestino(cel: string): string {
  const d = String(cel || '').replace(/[^0-9]/g, '');
  if (d.length === 9) return '51' + d;
  if (d.length >= 11 && d.startsWith('51')) return d.slice(0, 13);
  if (d.length === 12 && d.startsWith('51')) return d;
  return d;
}

// ── Transporte (nativo en APK, fetch en web) ───────────────
// Inyectables para los tests (scripts/test-fase-3-14.ts)

let _getJson: (url: string) => Promise<{ status: number; data: any } | null> = getJsonDefault;
let _postJson: (
  url: string,
  body: any,
  token: string
) => Promise<{ status: number; data: any } | null> = postJsonDefault;

export const _testsWhatsappMeta = {
  setGetJson(fn: typeof _getJson) {
    _getJson = fn;
  },
  setPostJson(fn: typeof _postJson) {
    _postJson = fn;
  },
  restaurar() {
    _getJson = getJsonDefault;
    _postJson = postJsonDefault;
  },
};

async function getJsonDefault(url: string): Promise<{ status: number; data: any } | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const resp = await CapacitorHttp.get({
        url,
        connectTimeout: TIMEOUT_MS,
        readTimeout: TIMEOUT_MS,
      });
      return { status: resp.status ?? 0, data: resp.data };
    } catch (e: any) {
      // Los errores HTTP del Graph vienen con body — CapacitorHttp
      // los lanza, pero a veces trae la data
      if (e?.data) return { status: e?.status ?? 400, data: e.data };
      return null; // sin red / timeout
    }
  }
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch {
    return null;
  }
}

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
      return { status: resp.status ?? 0, data: resp.data };
    } catch (e: any) {
      if (e?.data) return { status: e?.status ?? 400, data: e.data };
      return null;
    }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch {
    return null;
  }
}

// ── Operaciones ────────────────────────────────────────────

export interface ResultadoMeta {
  ok: boolean;
  /** Mensaje listo para mostrar en la UI */
  mensaje: string;
  /** Nombre verificado del negocio (solo en probarConexion) */
  nombreVerificado?: string;
  /** Número con formato de la API (solo en probarConexion) */
  numero?: string;
}

/**
 * Prueba la conexión: pide los datos del número a Meta.
 * Si el token y el Phone Number ID son válidos, devuelve el
 * nombre VERIFICADO del negocio y el número.
 */
export async function probarConexion(cfg: ConfigWhatsAppMeta): Promise<ResultadoMeta> {
  if (!cfg.phoneNumberId || !cfg.token) {
    return { ok: false, mensaje: 'Falta el Phone Number ID o el token' };
  }
  const r = await _getJson(`${GRAPH_URL}/${cfg.phoneNumberId}?access_token=${encodeURIComponent(cfg.token)}`);
  if (!r) return { ok: false, mensaje: 'Sin conexión con Meta — revisa tu internet' };

  const data = r.data || {};
  if (r.status === 200 && (data.display_phone_number || data.verified_name)) {
    return {
      ok: true,
      mensaje: `Conectado: ${data.verified_name || 'negocio'} (${data.display_phone_number || 'número ok'})`,
      nombreVerificado: data.verified_name,
      numero: data.display_phone_number,
    };
  }
  const err = data?.error;
  return {
    ok: false,
    mensaje: err
      ? `Meta dice: ${err.message || err.code || 'error'}${err.type ? ` (${err.type})` : ''}`
      : `Meta respondió ${r.status} — revisa el Phone Number ID y el token`,
  };
}

/**
 * Envía un mensaje de TEXTO por el canal oficial.
 * (Dentro de la ventana de 24h de respuesta del cliente se puede
 * texto libre; fuera de ella Meta exige plantillas — eso viene
 * en la próxima fase.)
 */
export async function enviarTexto(
  cfg: ConfigWhatsAppMeta,
  destino: string,
  texto: string
): Promise<ResultadoMeta> {
  if (!cfg.phoneNumberId || !cfg.token) {
    return { ok: false, mensaje: 'Primero guarda el Phone Number ID y el token' };
  }
  const para = normalizarDestino(destino);
  if (para.length < 10) {
    return { ok: false, mensaje: 'Número inválido — escríbelo como 51 + 9 dígitos' };
  }
  if (!texto.trim()) {
    return { ok: false, mensaje: 'Escribe el mensaje a enviar' };
  }

  const r = await _postJson(
    `${GRAPH_URL}/${cfg.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { body: texto },
    },
    cfg.token
  );
  if (!r) return { ok: false, mensaje: 'Sin conexión con Meta — revisa tu internet' };

  const data = r.data || {};
  if (r.status === 200 && data?.messages?.[0]?.id) {
    return { ok: true, mensaje: `Mensaje enviado a +${para} ✅` };
  }
  const err = data?.error;
  return {
    ok: false,
    mensaje: err
      ? `Meta dice: ${err.message || err.code || 'error'}${err.error_data?.msg ? ` — ${err.error_data.msg}` : ''}`
      : `Meta respondió ${r.status}`,
  };
}
