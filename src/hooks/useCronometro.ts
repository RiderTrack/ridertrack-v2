// ═══════════════════════════════════════════════════════════
// ⏱️ CRONÓMETRO DE RUTA + AVISO SILENCIOSO — Fase 1.5
// Recupera la función del Rider modular: al activar el cronómetro
// se enciende el "aviso silencioso" → el estado se publica en
// Firestore (ruta_activa/{uid}.cronometro) para que el bot de
// WhatsApp sepa que estás EN RUTA y así saludar al cliente por su
// NOMBRE con la info de su pedido ("Hola José, tu pedido…").
//
// El estado vive en un store módulo-level: así el cronómetro SIGUE
// CORRIENDO al navegar entre pantallas y el pill flotante siempre
// está al día. El tiempo se calcula desde iniciadoAt (preciso
// aunque la app pase a segundo plano).
// ═══════════════════════════════════════════════════════════

import { useState, useSyncExternalStore } from 'react';

export interface EstadoCronometro {
  /** 'idle' | 'corriendo' | 'pausado' */
  fase: 'idle' | 'corriendo' | 'pausado';
  /** ISO del momento del último arranque/reanudación */
  iniciadoAt: string | null;
  /** segundos acumulados en pausas anteriores */
  acumuladoSeg: number;
  /** aviso silencioso activado (lo lee el bot) */
  avisoSilencioso: boolean;
}

const ESTADO_INICIAL: EstadoCronometro = {
  fase: 'idle',
  iniciadoAt: null,
  acumuladoSeg: 0,
  avisoSilencioso: true,
};

const STORAGE_KEY = 'rt_crono_v1';

// ── Store mínimo con suscripción ──────────────────────────
// snapshot se RECONSTRUYE en cada tick/acción para que
// useSyncExternalStore detecte el cambio (nueva referencia)
// y la UI refresque el tiempo cada segundo.
let estado: EstadoCronometro = cargar();
let tick = 0;
let snapshot = { estado, tick };
const oyentes = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | null = null;

function cargar(): EstadoCronometro {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as EstadoCronometro;
      // Si la app se cerró con el cronómetro corriendo, sigue corriendo
      return { ...ESTADO_INICIAL, ...p };
    }
  } catch {
    // sin storage
  }
  return { ...ESTADO_INICIAL };
}

function persistir() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch {
    // sin storage
  }
}

function emitir() {
  tick++;
  snapshot = { estado, tick };
  oyentes.forEach((fn) => fn());
}

function setEstado(nuevo: EstadoCronometro) {
  estado = nuevo;
  persistir();
  emitir();
}

function asegurarTicker() {
  if (tickTimer) return;
  // El ticker refresca la UI cada segundo MIENTRAS CORRE; el
  // tiempo real siempre se calcula desde iniciadoAt.
  tickTimer = setInterval(() => {
    if (estado.fase === 'corriendo') emitir();
  }, 1000);
}

export function useCronometroRuta() {
  const snap = useSyncExternalStore(
    (cb) => {
      oyentes.add(cb);
      asegurarTicker();
      return () => oyentes.delete(cb);
    },
    () => snapshot
  );

  const [errorSync, setErrorSync] = useState<string | null>(null);

  // ── Acciones ──
  const arrancar = async (syncFn?: (e: EstadoCronometro) => Promise<void>) => {
    const nuevo: EstadoCronometro = {
      ...estado,
      fase: 'corriendo',
      iniciadoAt: new Date().toISOString(),
    };
    setEstado(nuevo);
    setErrorSync(null);
    try {
      await syncFn?.(nuevo);
    } catch (e: any) {
      setErrorSync(e?.message || 'No se pudo avisar al bot');
    }
  };

  const pausar = async (syncFn?: (e: EstadoCronometro) => Promise<void>) => {
    const nuevo: EstadoCronometro = {
      ...estado,
      fase: 'pausado',
      acumuladoSeg: segundosTranscurridos(),
      iniciadoAt: null,
    };
    setEstado(nuevo);
    try {
      await syncFn?.(nuevo);
    } catch (e: any) {
      setErrorSync(e?.message || 'No se pudo avisar al bot');
    }
  };

  const reanudar = arrancar;

  const detener = async (syncFn?: (e: EstadoCronometro) => Promise<void>) => {
    const nuevo: EstadoCronometro = {
      ...estado,
      fase: 'idle',
      acumuladoSeg: 0,
      iniciadoAt: null,
    };
    setEstado(nuevo);
    setErrorSync(null);
    try {
      await syncFn?.(nuevo);
    } catch (e: any) {
      setErrorSync(e?.message || 'No se pudo avisar al bot');
    }
  };

  const alternarAviso = async (syncFn?: (e: EstadoCronometro) => Promise<void>) => {
    const nuevo: EstadoCronometro = {
      ...estado,
      avisoSilencioso: !estado.avisoSilencioso,
    };
    setEstado(nuevo);
    try {
      await syncFn?.(nuevo);
    } catch (e: any) {
      setErrorSync(e?.message || 'No se pudo avisar al bot');
    }
  };

  return {
    estado: snap.estado,
    corriendo: snap.estado.fase === 'corriendo',
    activo: snap.estado.fase !== 'idle',
    segundos: segundosTranscurridosCon(snap.estado),
    errorSync,
    arrancar,
    pausar,
    reanudar,
    detener,
    alternarAviso,
  };
}

/** Segundos transcurridos del estado dado (para render) */
function segundosTranscurridosCon(e: EstadoCronometro): number {
  if (e.fase === 'corriendo' && e.iniciadoAt) {
    const desde = new Date(e.iniciadoAt).getTime();
    if (!isNaN(desde)) {
      return e.acumuladoSeg + Math.max(0, (Date.now() - desde) / 1000);
    }
  }
  return e.acumuladoSeg;
}

/** Segundos transcurridos del estado actual (para acciones) */
function segundosTranscurridos(): number {
  return segundosTranscurridosCon(estado);
}

// ── Formato HH:MM:SS ─────────────────────────────────────
export function formatearTiempo(seg: number): string {
  const s = Math.floor(seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(r)}`;
}
