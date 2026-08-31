// ═══════════════════════════════════════════════════════════
// 🍽️ REFRIGERIO DE RUTA — Fase 2.7 (estilo Circuit)
// Horario de refrigerio del rider: se programa (hora + duración),
// se inicia cuando toca (pausa el cronómetro de la ruta), cuenta
// regresiva y al terminar reanuda la ruta automáticamente.
//
// El estado vive en localStorage `rt_refri_{uid}` y se comparte
// entre CronometroRuta y SeguimientoView mediante el evento
// 'rt-refri-cambio' — así ambas vistas siempre ven lo mismo.
//
// También expone useCronoRuta(): lectura en vivo (1 s) del
// cronómetro de ruta (`rt_crono_{uid}`) para calcular el ETA
// "a qué hora termino mi ruta" sin duplicar estado.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

export interface SesionRefrigerio {
  inicio: number;      // epoch ms
  fin: number;         // epoch ms
  duracionSeg: number;
}

export interface EstadoRefrigerio {
  /** Hora planeada del refrigerio, 'HH:MM' ('' = sin programar) */
  programadoHora: string;
  /** Duración planeada en minutos */
  duracionMin: number;
  /** pendiente = programado/esperando | activo = tomándolo | terminado = ya lo tomé hoy */
  estado: 'pendiente' | 'activo' | 'terminado';
  /** epoch ms del inicio del refrigerio en curso */
  inicioAt: number | null;
  /** Segundos de refrigerio tomados hoy (sesiones cerradas) */
  tomadoSeg: number;
  /** Si el cronómetro de ruta estaba corriendo al iniciar el refri
   *  (para reanudarlo automáticamente al terminar) */
  cronoEstabaActivo: boolean;
  /** Historial de sesiones del día */
  sesiones: SesionRefrigerio[];
  /** Día del estado (YYYY-MM-DD) — al cambiar de día se resetea */
  fecha: string;
}

const ESTADO_INICIAL: EstadoRefrigerio = {
  programadoHora: '',
  duracionMin: 30,
  estado: 'pendiente',
  inicioAt: null,
  tomadoSeg: 0,
  cronoEstabaActivo: false,
  sesiones: [],
  fecha: hoyStr(),
};

const EVENTO = 'rt-refri-cambio';

function hoyStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function clave(uid?: string | null): string {
  return `rt_refri_${uid || 'anon'}`;
}

/** Cambió el día → limpia lo ANDADO (estado, sesiones, minutos
 *  tomados) pero MANTIENE la programación (hora + duración):
 *  así el ETA de HOY sigue contando el refrigerio sin tener que
 *  reprogramarlo cada mañana — como Circuit, que guarda el
 *  horario de descanso en la configuración. (Fase 2.11) */
function resetDiario(e: EstadoRefrigerio): EstadoRefrigerio {
  return {
    ...e,
    estado: 'pendiente',
    inicioAt: null,
    tomadoSeg: 0,
    cronoEstabaActivo: false,
    sesiones: [],
    fecha: hoyStr(),
  };
}

function leer(uid?: string | null): EstadoRefrigerio {
  try {
    const raw = localStorage.getItem(clave(uid));
    if (raw) {
      const p = JSON.parse(raw) as EstadoRefrigerio;
      const base = { ...ESTADO_INICIAL, ...p };
      // Cambió el día → reset de lo andado, NO de la programación
      if (base.fecha !== hoyStr()) {
        return resetDiario(base);
      }
      return base;
    }
  } catch {
    // sin storage
  }
  return { ...ESTADO_INICIAL, fecha: hoyStr() };
}

function escribir(uid: string | null | undefined, e: EstadoRefrigerio) {
  try {
    localStorage.setItem(clave(uid), JSON.stringify(e));
  } catch {
    // sin storage
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: e }));
}

// ── Acciones puras (usables fuera de React) ──────────────

export function accionesRefrigerio(uid?: string | null) {
  const obtener = () => leer(uid);

  /** Programar hora y/o duración (desde SeguimientoView) */
  const programar = (hora: string, duracionMin: number) => {
    const e = obtener();
    escribir(uid, {
      ...e,
      programadoHora: hora,
      duracionMin: Math.max(5, Math.min(120, Math.round(duracionMin))),
      // reprogramar mientras está activo no cambia el curso actual
    });
  };

  /** Cambiar solo la duración (se usa desde el cronómetro) */
  const cambiarDuracion = (duracionMin: number) => {
    const e = obtener();
    escribir(uid, { ...e, duracionMin: Math.max(5, Math.min(120, Math.round(duracionMin))) });
  };

  /** Iniciar el refrigerio AHORA (pausa el reloj de ruta) */
  const iniciar = (cronoEstabaActivo: boolean) => {
    const e = obtener();
    if (e.estado === 'activo') return;
    escribir(uid, {
      ...e,
      estado: 'activo',
      inicioAt: Date.now(),
      cronoEstabaActivo,
    });
  };

  /** Terminar el refrigerio (devuelve los segundos que duró) */
  const terminar = (): number => {
    const e = obtener();
    if (e.estado !== 'activo' || !e.inicioAt) return 0;
    const fin = Date.now();
    const duracionSeg = Math.max(0, Math.round((fin - e.inicioAt) / 1000));
    escribir(uid, {
      ...e,
      estado: 'terminado',
      inicioAt: null,
      tomadoSeg: e.tomadoSeg + duracionSeg,
      sesiones: [...e.sesiones, { inicio: e.inicioAt, fin, duracionSeg }],
    });
    return duracionSeg;
  };

  /** 🍽️ Iniciar el refrigerio AHORA + pausar el cronómetro de ruta
   *  (si estaba corriendo). Funciona desde cualquier vista. */
  const iniciarAhora = () => {
    const crono = leerCronoRuta(uid);
    const estabaActivo = !!crono?.activo;
    if (estabaActivo && crono) {
      const acum = (crono.acumulado || 0) + (Date.now() - (crono.inicio || Date.now()));
      persistirCrono(uid, { activo: false, inicio: null, acumulado: acum });
    }
    iniciar(estabaActivo);
  };

  /** ✅ Terminar el refrigerio + reanudar el cronómetro de ruta
   *  automáticamente (si estaba corriendo antes del refrigerio). */
  const terminarAhora = (): number => {
    const e = obtener();
    const seg = terminar();
    if (e.estado === 'activo' && e.cronoEstabaActivo) {
      const crono = leerCronoRuta(uid);
      persistirCrono(uid, { activo: true, inicio: Date.now(), acumulado: crono?.acumulado || 0 });
    }
    return seg;
  };

  /** Reiniciar el día (por si quiere volver a programar) */
  const reiniciar = () => {
    escribir(uid, { ...ESTADO_INICIAL, fecha: hoyStr() });
  };

  return { obtener, programar, cambiarDuracion, iniciar, terminar, iniciarAhora, terminarAhora, reiniciar };
}

// ── Hook React: estado vivo + acciones ────────────────────

export function useRefrigerio(uid?: string | null) {
  const [estado, setEstado] = useState<EstadoRefrigerio>(() => leer(uid));
  const [ahora, setAhora] = useState(() => Date.now());

  // Refrescar al montar/cambiar uid
  useEffect(() => {
    setEstado(leer(uid));
  }, [uid]);

  // Sincronización entre vistas (CronometroRuta ↔ SeguimientoView)
  useEffect(() => {
    const onCambio = () => setEstado(leer(uid));
    window.addEventListener(EVENTO, onCambio);
    return () => window.removeEventListener(EVENTO, onCambio);
  }, [uid]);

  // Tick cada segundo (solo si está activo, para el countdown)
  useEffect(() => {
    if (estado.estado !== 'activo') return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [estado.estado]);

  // Reiniciar automático al cambiar de día (mantiene la programación)
  useEffect(() => {
    if (estado.fecha !== hoyStr()) {
      setEstado(resetDiario(estado));
    }
  }, [estado.fecha]);

  const acciones = accionesRefrigerio(uid);

  // Segundos transcurridos del refrigerio en curso
  const segundosActivo =
    estado.estado === 'activo' && estado.inicioAt
      ? Math.max(0, Math.round((ahora - estado.inicioAt) / 1000))
      : 0;

  // Segundos restantes del refrigerio en curso (countdown)
  const segundosRestantes =
    estado.estado === 'activo'
      ? Math.max(0, estado.duracionMin * 60 - segundosActivo)
      : 0;

  return {
    refri: estado,
    activo: estado.estado === 'activo',
    segundosActivo,
    segundosRestantes,
    totalTomadoSeg: estado.tomadoSeg + segundosActivo,
    ...acciones,
  };
}

// ── Sincronización con el cronómetro de ruta ───────────
// El cronómetro vive en CronometroRuta con localStorage
// `rt_crono_{uid}` = { activo, inicio, acumulado } (ms).
// Estas funciones lo pausan/reanudan DESDE CUALQUIER VISTA
// (el componente no necesita estar montado) y avisan con el
// evento 'rt-crono-cambio' para que CronometroRuta recargue.

function persistirCrono(uid: string | null | undefined, st: CronoRutaState) {
  try {
    localStorage.setItem(`rt_crono_${uid || 'anon'}`, JSON.stringify(st));
  } catch {
    // sin storage
  }
  window.dispatchEvent(new CustomEvent('rt-crono-cambio'));
}

export interface CronoRutaState {
  activo: boolean;
  inicio: number | null;
  acumulado: number;
}

export function leerCronoRuta(uid?: string | null): CronoRutaState | null {
  try {
    const raw = localStorage.getItem(`rt_crono_${uid || 'anon'}`);
    if (raw) return JSON.parse(raw) as CronoRutaState;
  } catch {
    // sin storage
  }
  return null;
}

/** Milisegundos de ruta (acumulado + tramo en curso) */
export function msRuta(c: CronoRutaState | null): number {
  if (!c) return 0;
  return (c.acumulado || 0) + (c.activo && c.inicio ? Date.now() - c.inicio : 0);
}

/** Hook en vivo (tick 1 s) del tiempo de ruta en ms */
export function useCronoRuta(uid?: string | null): { crono: CronoRutaState | null; rutaMs: number; tick: number } {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const crono = leerCronoRuta(uid);
  return { crono, rutaMs: msRuta(crono), tick };
}

// ── 🚀 HORA DE INICIO DE JORNADA (Fase 2.8) ──────────────
// "¿A qué hora empiezo a trabajar?" — el rider la define (ej:
// 10:00) y el ETA del Seguimiento arranca desde ahí mientras no
// haya ritmo real: así "terminas a las X" es de verdad aunque
// consulte la app a las 7 de la mañana. Vive en localStorage
// `rt_jornada_{uid}` (reset diario) + evento 'rt-jornada-cambio'.

export interface EstadoJornada {
  /** Hora planeada de salida, 'HH:MM' ('' = sin definir) */
  inicioHora: string;
  /** Día del estado (YYYY-MM-DD) — al cambiar de día se resetea */
  fecha: string;
}

const EVENTO_JORNADA = 'rt-jornada-cambio';
const JORNADA_INICIAL: EstadoJornada = { inicioHora: '', fecha: hoyStr() };

function claveJornada(uid?: string | null): string {
  return `rt_jornada_${uid || 'anon'}`;
}

function leerJornada(uid?: string | null): EstadoJornada {
  try {
    const raw = localStorage.getItem(claveJornada(uid));
    if (raw) {
      const p = JSON.parse(raw) as EstadoJornada;
      // Cambió el día → la hora de salida se MANTIENE (sueles salir
      // a la misma hora cada día, como en Circuit); solo se renueva
      // la fecha. (Fase 2.11 — antes se borraba y había que fijarla
      // otra vez cada mañana.)
      if (p.inicioHora) return { inicioHora: p.inicioHora, fecha: hoyStr() };
    }
  } catch {
    // sin storage
  }
  return { ...JORNADA_INICIAL, fecha: hoyStr() };
}

function escribirJornada(uid: string | null | undefined, e: EstadoJornada) {
  try {
    localStorage.setItem(claveJornada(uid), JSON.stringify(e));
  } catch {
    // sin storage
  }
  window.dispatchEvent(new CustomEvent(EVENTO_JORNADA, { detail: e }));
}

/** Hook React: hora de inicio de jornada del día + acciones */
export function useJornada(uid?: string | null) {
  const [estado, setEstado] = useState<EstadoJornada>(() => leerJornada(uid));

  useEffect(() => {
    setEstado(leerJornada(uid));
  }, [uid]);

  // Sincronización entre vistas
  useEffect(() => {
    const onCambio = () => setEstado(leerJornada(uid));
    window.addEventListener(EVENTO_JORNADA, onCambio);
    return () => window.removeEventListener(EVENTO_JORNADA, onCambio);
  }, [uid]);

  const definirInicio = (hhmm: string) => {
    escribirJornada(uid, { inicioHora: hhmm || '', fecha: hoyStr() });
  };

  const quitarInicio = () => {
    escribirJornada(uid, { ...JORNADA_INICIAL, fecha: hoyStr() });
  };

  return { inicioHora: estado.inicioHora, definirInicio, quitarInicio };
}

// ── Formato helpers ───────────────────────────────────────

export function formatearDuracion(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}h ${p(m)}m` : `${m}:${p(r)}`;
}

/** 'HH:MM' de un epoch ms, en hora local */
export function horaDe(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Convierte 'HH:MM' de HOY a epoch ms */
export function hoyHoraAMs(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  const d = new Date();
  d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return d.getTime();
}
