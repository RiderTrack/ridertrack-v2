// ═══════════════════════════════════════════════════════════
// 💬 WHATSAPP OFICIAL DE META (Cloud API) — RiderTrack V2
// (Fase 3.14 base → Fase 3.15 diagnóstico pro del error 400)
//
// Qué es esto: la API oficial de WhatsApp Business Platform
// (Meta). A diferencia del Rider chat (Baileys, que usa el
// WhatsApp del BOT en Termux), este canal sale del número de
// NEGOCIO verificado de la empresa — con plantillas oficiales,
// sin riesgo de ban y con la calidad de Meta.
//
// NOVEDADES Fase 3.15 (fix del reporte del usuario):
//   • El error 400 casi siempre es porque se puso el NÚMERO
//     de teléfono en el campo "Phone Number ID" — ahora el
//     diagnóstico lo DETECTA y dice exactamente dónde sacar
//     el ID correcto.
//   • Diagnóstico por PASOS: primero valida el token (GET /me),
//     después el número (GET /{id}) — así sabes QUÉ falló.
//   • Los errores de Meta llegaban como TEXTO sin parsear desde
//     el APK (CapacitorHttp) → mensaje genérico "400". Ahora
//     se parsean y se TRADUCEN al español (con el original).
//   • Si el valor parece teléfono, también prueba la variante
//     solo-dígitos por si Meta la acepta.
//
// El transporte es el mismo patrón blindado de Fase 3.13:
//   1. APK  → CapacitorHttp (HTTP nativo, sin CORS)
//   2. Web  → fetch directo (Graph API sí permite CORS)
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

/**
 * ¿El valor parece un NÚMERO DE TELÉFONO y no un Phone Number ID?
 * La confusión más común (el error 400 del reporte): el teléfono
 * peruano tiene 9 dígitos (o 11 con el 51); el Phone Number ID
 * de Meta es un código LARGO (13-17 dígitos) que nada tiene que
 * ver con el número que ven los clientes.
 */
export function pareceTelefono(valor: string): boolean {
  const bruto = String(valor || '').trim();
  if (!bruto) return false;
  // Un + delante es unmistakable: es un teléfono
  if (bruto.startsWith('+')) return true;
  const digitos = bruto.replace(/[^0-9]/g, '');
  if (!digitos) return false;
  // Celular peruano sin código país: 9XX XXX XXX
  if (digitos.length === 9 && digitos.startsWith('9')) return true;
  // Con código país: 51 9XX XXX XXX (11 dígitos)
  if (digitos.length === 11 && digitos.startsWith('51')) return true;
  // 12 dígitos empezando en 51 (teléfono + un dígito de más, igual es teléfono)
  if (digitos.length === 12 && digitos.startsWith('51')) return true;
  return false;
}

/**
 * Traduce los errores típicos de Meta al español, PERO siempre
 * incluye el mensaje original entre paréntesis — así no se pierde
 * el detalle técnico cuando pasa algo raro.
 */
export function traducirErrorMeta(err: any): string {
  if (!err) return '';
  const code = Number(err.code || 0);
  const msg = String(err.message || '');
  const tipo = err.type ? ` (${err.type})` : '';
  const detalle = err.error_data?.msg ? ` — ${err.error_data.msg}` : '';
  const crudo = `${msg}${tipo}${detalle}`;

  // Token
  if (code === 190 || /Invalid OAuth|access token/i.test(msg)) {
    if (/expired|expir/i.test(msg + detalle)) {
      return `El token ya EXPIRÓ (los de prueba duran 24 h) — genera uno nuevo en Meta → System Users (${crudo})`;
    }
    return `El token no es válido: está mal copiado, ya cambió o es de otra cuenta (${crudo})`;
  }
  // Phone Number ID inexistente / sin acceso
  if (code === 100 || code === 803 || /Unsupported (get|post|request)/i.test(msg)) {
    return `Ese Phone Number ID no existe, o el token no tiene acceso a él (${crudo})`;
  }
  // Ventana de 24 h / re-engagement
  if (code === 131030 || code === 131047 || code === 470 || /24 hours|Re-engagement/i.test(msg + detalle)) {
    return `Fuera de la ventana de 24 h — Meta solo permite texto libre si el cliente te escribió en las últimas 24 h; fuera de eso hay que usar PLANTILLAS (${crudo})`;
  }
  if (code === 131026) {
    return `El número destino no tiene WhatsApp o no recibe mensajes (${crudo})`;
  }
  if (code === 131031 || /not in allowed list|allowed recipients/i.test(msg + detalle)) {
    return `El número de PRUEBA solo puede escribirle a los destinatarios permitidos — agrégalos en API Setup → To (${crudo})`;
  }
  if (code === 4 || code === 80007) {
    return `Límite de envíos alcanzado — espera un momento y reintenta (${crudo})`;
  }
  if (code === 10 || /permission/i.test(msg)) {
    return `El token no tiene el permiso whatsapp_business_messaging (${crudo})`;
  }
  if (code === 132000 || /parameters does not match/i.test(msg)) {
    return `Las variables de la plantilla no coinciden con las aprobadas (${crudo})`;
  }
  return `Meta dice: ${msg || code || 'error'}${tipo}${detalle}`;
}

// ── Transporte (nativo en APK, fetch en web) ───────────────
// Inyectables para los tests (scripts/test-fase-3-14.ts / 3-15)

/** CapacitorHttp a veces devuelve el body como STRING — esto lo
 *  convierte a objeto para que los errores de Meta nunca se
 *  traguen (era la causa del "Meta respondió 400" genérico). */
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
      return { status: resp.status ?? 0, data: parsearBody(resp.data) };
    } catch (e: any) {
      // Los errores HTTP del Graph vienen con body — CapacitorHttp
      // los lanza, pero a veces trae la data (como string o objeto)
      if (e?.data) return { status: e?.status ?? 400, data: parsearBody(e.data) };
      return null; // sin red / timeout
    }
  }
  try {
    const res = await fetch(url);
    const data = parsearBody(await res.json().catch(() => null));
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

/** Un paso del diagnóstico (Paso 1 token, Paso 2 número…) */
export interface PasoDiagnostico {
  titulo: string;
  estado: 'ok' | 'error';
  detalle: string;
}

export interface DiagnosticoMeta {
  ok: boolean;
  /** Resumen final listo para mostrar */
  mensaje: string;
  pasos: PasoDiagnostico[];
  /** El valor de Phone Number ID que funcionó (para auto-guardar) */
  idResuelto?: string;
  nombreVerificado?: string;
  numero?: string;
  /** Sugerencia accionable cuando detectamos el error típico */
  pista?: string;
}

const PISTA_TELEFONO =
  'Ese valor parece el NÚMERO DE TELÉFONO, no el Phone Number ID. Son cosas distintas: el Phone Number ID es un código largo (13-17 dígitos) que Meta le da a tu número por dentro. Dónde sacarlo: (1) en la CONFIGURACIÓN de tu robot de Meta — búscalo como "phone_number_id" o "phoneNumberId"; (2) en business.facebook.com → tu negocio → WhatsApp Manager → API Setup → "Phone number ID". Tip: el ID NO empieza con 51 y no lleva +.';

const PISTA_TOKEN_SIN_ACCESO =
  'El token funciona, pero no ve ese Phone Number ID: puede que el número esté en otra cuenta o negocio de Meta distinto al del token. Asegúrate de sacar AMBOS (token y Phone Number ID) del mismo negocio de business.facebook.com.';

/**
 * 🔍 DIAGNÓSTICO COMPLETO de la conexión (Fase 3.15):
 *   Paso 1 — valida el TOKEN con GET /me (190 = malo/expirado)
 *   Paso 2 — valida el PHONE NUMBER ID con GET /{id}
 * Si pusiste el teléfono en vez del ID, te lo dice con guía
 * de dónde sacar el correcto.
 */
export async function diagnosticarConexion(cfg: ConfigWhatsAppMeta): Promise<DiagnosticoMeta> {
  const vacio: DiagnosticoMeta = {
    ok: false,
    mensaje: '',
    pasos: [],
  };

  if (!cfg.phoneNumberId || !cfg.token) {
    return { ...vacio, mensaje: 'Falta el Phone Number ID o el token' };
  }

  const esTelefono = pareceTelefono(cfg.phoneNumberId);
  const pasos: PasoDiagnostico[] = [];

  // ── PASO 1: el token ────────────────────────────────────
  const rMe = await _getJson(
    `${GRAPH_URL}/me?fields=id,name&access_token=${encodeURIComponent(cfg.token)}`
  );
  if (rMe) rMe.data = parsearBody(rMe.data); // el body puede venir como texto
  let tokenOk = false;
  let errorToken = '';
  if (!rMe) {
    pasos.push({
      titulo: 'Paso 1 — Token',
      estado: 'error',
      detalle: 'Sin respuesta de Meta (¿sin internet?)',
    });
    return { ...vacio, mensaje: 'Sin conexión con Meta — revisa tu internet', pasos };
  }
  if (rMe.status === 200 && !rMe.data?.error) {
    tokenOk = true;
    const quien = rMe.data?.name ? `${rMe.data.name}` : 'token válido';
    pasos.push({ titulo: 'Paso 1 — Token', estado: 'ok', detalle: `Meta lo aceptó ✅ (${quien})` });
  } else {
    errorToken = traducirErrorMeta(rMe.data?.error) || `Meta respondió ${rMe.status}`;
    pasos.push({ titulo: 'Paso 1 — Token', estado: 'error', detalle: errorToken });
  }

  // ── PASO 2: el Phone Number ID ──────────────────────────
  // Candidatos: el valor tal cual + la variante solo-dígitos
  // (por si trajo espacios, + o guiones)
  const candidatos = [cfg.phoneNumberId.trim()];
  const digitos = cfg.phoneNumberId.replace(/[^0-9]/g, '');
  if (digitos && digitos !== cfg.phoneNumberId.trim()) candidatos.push(digitos);

  let exito: { id: string; data: any } | null = null;
  let ultimoError = '';
  for (const cand of candidatos) {
    const r = await _getJson(
      `${GRAPH_URL}/${encodeURIComponent(cand)}?fields=id,display_phone_number,verified_name,quality_rating&access_token=${encodeURIComponent(cfg.token)}`
    );
    if (r) r.data = parsearBody(r.data); // el body puede venir como texto
    if (!r) {
      return {
        ...vacio,
        mensaje: 'Sin conexión con Meta — revisa tu internet',
        pasos: [...pasos, { titulo: 'Paso 2 — Phone Number ID', estado: 'error', detalle: 'Sin respuesta de Meta' }],
      };
    }
    if (r.status === 200 && (r.data?.display_phone_number || r.data?.verified_name)) {
      exito = { id: cand, data: r.data };
      break;
    }
    ultimoError = traducirErrorMeta(r.data?.error) || `Meta respondió ${r.status}`;
  }

  if (exito) {
    const d = exito.data;
    pasos.push({
      titulo: 'Paso 2 — Phone Number ID',
      estado: 'ok',
      detalle: `Número reconocido: ${d.display_phone_number || 'ok'}${d.verified_name ? ` — negocio "${d.verified_name}"` : ''}${d.quality_rating ? ` (calidad ${d.quality_rating})` : ''}`,
    });
    return {
      ok: true,
      mensaje: `Conectado: ${d.verified_name || 'negocio'} (${d.display_phone_number || 'número ok'})`,
      pasos,
      idResuelto: exito.id,
      nombreVerificado: d.verified_name,
      numero: d.display_phone_number,
      pista: exito.id !== cfg.phoneNumberId.trim()
        ? `Guardamos el ID tal como funcionó: ${exito.id}`
        : undefined,
    };
  }

  // ── Falló el paso 2: armamos el mensaje con la pista útil ──
  pasos.push({ titulo: 'Paso 2 — Phone Number ID', estado: 'error', detalle: ultimoError });

  if (tokenOk) {
    return {
      ok: false,
      mensaje: esTelefono
        ? `El token está BIEN ✅, pero ese valor es el teléfono y no el Phone Number ID. ${ultimoError}`
        : `El token está BIEN ✅, pero el Phone Number ID no pasó. ${ultimoError}`,
      pasos,
      pista: esTelefono ? PISTA_TELEFONO : PISTA_TOKEN_SIN_ACCESO,
    };
  }

  return {
    ok: false,
    mensaje: errorToken || ultimoError,
    pasos,
    pista: esTelefono ? PISTA_TELEFONO : undefined,
  };
}

/**
 * Prueba la conexión (forma simple, mantiene la firma de la
 * Fase 3.14 — la usan los tests y el mensaje de prueba).
 */
export async function probarConexion(cfg: ConfigWhatsAppMeta): Promise<ResultadoMeta> {
  const d = await diagnosticarConexion(cfg);
  return {
    ok: d.ok,
    mensaje: d.mensaje,
    nombreVerificado: d.nombreVerificado,
    numero: d.numero,
  };
}

/**
 * Envía un mensaje de TEXTO por el canal oficial.
 * (Dentro de la ventana de 24h de respuesta del cliente se puede
 * texto libre; fuera de ella Meta exige plantillas.)
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

  const data = parsearBody(r.data) || {};
  if (r.status === 200 && data?.messages?.[0]?.id) {
    return { ok: true, mensaje: `Mensaje enviado a +${para} ✅` };
  }
  const err = data?.error;
  return {
    ok: false,
    mensaje: err
      ? traducirErrorMeta(err)
      : `Meta respondió ${r.status}`,
  };
}
