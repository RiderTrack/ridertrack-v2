// ═══════════════════════════════════════════════════════════
// 🔔 NOTIFICACIONES — RiderTrack V2 (Fase 3.14)
//
// Configuración de SONIDOS y alertas de la app, persistida en
// localStorage (sobrevive al reinicio). Tres avisos:
//
//   1. 💬 Nuevo mensaje del Rider chat → doble beep agudo
//   2. 📳 Vibración junto con el beep (si el teléfono lo soporta)
//   3. 💰 Al registrar un pago en Mi Ruta → beep de caja
//      registrado (la v1 "hablaba" al marcar entregado; esto es
//      la versión corta y silenciable)
//
// Los sonidos se generan con Web Audio API (osciladores) — sin
// archivos de audio que bajar, siempre disponibles. Si el toggle
// está apagado (o el AudioContext falla), no suena nada y la
// app sigue normal.
// ═══════════════════════════════════════════════════════════

const KEY = 'rt_notif_v1';

export interface ConfigNotificaciones {
  /** 💬 Sonido al llegar mensaje nuevo del Rider chat */
  sonidoChat: boolean;
  /** 📳 Vibrar al llegar mensaje nuevo (si el celular lo soporta) */
  vibracion: boolean;
  /** 💰 Sonido al registrar un pago en Mi Ruta */
  sonidoPago: boolean;
}

export const NOTIF_DEFAULT: ConfigNotificaciones = {
  sonidoChat: true,
  vibracion: true,
  sonidoPago: true,
};

export function leerNotif(): ConfigNotificaciones {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...NOTIF_DEFAULT };
    const data = JSON.parse(raw);
    return {
      sonidoChat: data.sonidoChat !== false,
      vibracion: data.vibracion !== false,
      sonidoPago: data.sonidoPago !== false,
    };
  } catch {
    return { ...NOTIF_DEFAULT };
  }
}

export function guardarNotif(cfg: ConfigNotificaciones): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    // sin localStorage — la config dura lo que viva la app
  }
}

// ── Motor de sonido (Web Audio, sin archivos) ──────────────

let ctxAudio: AudioContext | null = null;

function contexto(): AudioContext | null {
  try {
    if (!ctxAudio) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctxAudio = new AC();
    }
    // En móviles el contexto arranca "suspended" hasta que el
    // usuario toca algo — reanudar si hace falta
    if (ctxAudio.state === 'suspended') ctxAudio.resume().catch(() => {});
    return ctxAudio;
  } catch {
    return null;
  }
}

/** Un beep simple: frecuencia (Hz), duración (s) y retraso (s) */
function beep(freq: number, duracion = 0.09, retraso = 0, volumen = 0.12): void {
  const ctx = contexto();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + retraso);
    gain.gain.linearRampToValueAtTime(volumen, ctx.currentTime + retraso + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + retraso + duracion);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + retraso);
    osc.stop(ctx.currentTime + retraso + duracion + 0.02);
  } catch {
    // sin audio — seguir como si nada
  }
}

// ── Inyectable para los tests (scripts/test-fase-3-14.ts) ──
let _beep: (f: number, d?: number, r?: number, v?: number) => void = beep;
export const _testsNotif = {
  setBeep(fn: (f: number, d?: number, r?: number, v?: number) => void) {
    _beep = fn;
  },
  restaurar() {
    _beep = beep;
  },
};

/** 💬 Mensaje nuevo del chat: dos beeps agudos tipo "notificación" */
export function sonarMensaje(): void {
  if (!leerNotif().sonidoChat) return;
  _beep(880, 0.08, 0);
  _beep(1175, 0.1, 0.11);
  vibrarSiConfig([80, 60, 80]);
}

/** 💰 Pago registrado: beep de "caja" (agudo + grave corto) */
export function sonarPago(): void {
  if (!leerNotif().sonidoPago) return;
  _beep(1318, 0.07, 0);
  _beep(988, 0.12, 0.09);
}

/** 📳 Vibra si el toggle está activo y el celular lo soporta */
export function vibrarSiConfig(patron: number[] = [120]): void {
  if (!leerNotif().vibracion) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(patron);
    }
  } catch {
    // sin vibración — seguir
  }
}
