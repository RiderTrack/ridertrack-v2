// ═══════════════════════════════════════════════════════════
// 🤖 F-ID5: Robot WhatsApp — el cobro AUTOMÁTICO
// ═══════════════════════════════════════════════════════════
// El rudy-bot (Termux) corre en EL MISMO teléfono que DriverTrack.
// Con el parche F-ID5, el bot abre un puente privado en
// http://127.0.0.1:3001 (solo visible desde este teléfono) que
// manda el cobro por WhatsApp con la IMAGEN del QR de Yape:
//
//   apretás 🤖 Cobrar → el bot le escribe al cliente →
//   el cliente recibe el mensaje CON tu QR → te paga 💜
//
// Sin abrir WhatsApp, sin apretar enviar. Si el bot no responde
// (apagado, Termux muerto, sin parche), la app cae solita al
// wa.me de siempre — nunca te quedás sin cobrar.
// ═══════════════════════════════════════════════════════════

export const URL_ROBOT_DEFECTO = 'http://127.0.0.1:3001';
export const TOKEN_ROBOT_DEFECTO = 'rudy-drivertrack';

/** ¿Cómo está el robot? (para el semáforo de Ajustes) */
export interface EstadoRobot {
  enLinea: boolean; // el puente responde
  whatsapp?: boolean; // y además tiene WhatsApp conectado
}

/** GET /ping — ¿está vivo el bot? Timeout corto: es localhost. */
export async function pingRobot(url: string, timeoutMs = 3000): Promise<EstadoRobot> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url.replace(/\/$/, '') + '/ping', { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { enLinea: false };
    const data = (await res.json()) as { ok?: boolean; whatsapp?: boolean };
    return { enLinea: data.ok === true, whatsapp: data.whatsapp === true };
  } catch {
    return { enLinea: false };
  }
}

export interface ParamsEnvio {
  url: string;
  token: string;
  telefono: string; // ya normalizado (51 + 9 dígitos)
  texto: string; // el mensaje de cobro por bloques (armarMensajeCobro)
  imagenBase64?: string; // tu QR de Yape (dataURL) — viaja ADHERIDO al mensaje
  timeoutMs?: number; // default 20s: resolver el número + enviar puede tardar
}

export interface ResultadoEnvio {
  ok: boolean;
  error?: string; // texto listo para mostrar (ya en español)
}

/** POST /enviar — le dice al bot que mande el cobro. */
export async function enviarPorRobot(p: ParamsEnvio): Promise<ResultadoEnvio> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), p.timeoutMs ?? 20000);
    const res = await fetch(p.url.replace(/\/$/, '') + '/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: p.token,
        telefono: p.telefono,
        texto: p.texto,
        imagen: p.imagenBase64 || undefined,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res.ok && data?.ok) return { ok: true };
    if (res.status === 401) {
      return { ok: false, error: 'El token del robot no coincide — revisá Ajustes → 🤖 Robot' };
    }
    if (res.status === 503) {
      return { ok: false, error: 'El bot está conectando con WhatsApp — probá en unos segundos' };
    }
    return { ok: false, error: data?.error || 'El robot no pudo enviar el mensaje' };
  } catch {
    // fetch abortado (timeout) o conexión rechazada (bot apagado / sin parche)
    return { ok: false, error: 'El robot no responde — ¿está corriendo el bot en Termux?' };
  }
}
