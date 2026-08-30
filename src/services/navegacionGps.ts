// ═══════════════════════════════════════════════════════════
// 🧭 NAVEGACIÓN GPS CON VOZ - RiderTrack V2 (Fase 3.12)
// El motor de la navegación propia turno a turno:
//
//   • VOZ EN ESPAÑOL: anuncia cada maniobra antes de llegar
//     ("En 200 metros, gira a la izquierda hacia Av. Arequipa").
//     Usa el TTS NATIVO del APK (@capacitor-community/
//     text-to-speech, ya incluido) y si no está, cae al
//     speechSynthesis del WebView eligiendo la mejor voz es-*.
//
//   • GEOMETRÍA: proyecta la posición GPS sobre la polyline de
//     la ruta → sabe a cuántos metros está la próxima maniobra
//     y cuánto queda para la parada (por calle, no en línea
//     recta).
//
//   • FLECHITA: calcula el rumbo (0-360°) entre fixes del GPS
//     para rotar el marcador; con ruido GPS no salta (solo
//     cambia si te moviste de verdad).
//
//   • DESVÍO: si te alejas de la ruta varios fixes seguidos,
//     avisa para RECALCULAR desde donde estás.
//
// Todo es lógica pura (sin React) para poder testearla con
// scripts/test-fase-3-12.ts. El dibujo del mapa vive en
// componentes/navegacion/NavegacionGpsModal.tsx.
// ═══════════════════════════════════════════════════════════

import type { PasoInstruccion, RutaInstrucciones } from './googleDirections';

// ── Tipos ──────────────────────────────────────────────────

export interface Punto {
  lat: number;
  lng: number;
}

/** Una parada de la navegación (derivada del Cliente de la ruta) */
export interface ParadaNav {
  id: string | number;
  num: number;
  nombre: string;
  dir: string;
  dist: string;
  /** Plata por cobrar en esta parada (S/) */
  cobrar: number;
  lat: number;
  lng: number;
}

// ── Umbrales de la navegación (afinados para moto en Lima) ──

/** "En 200 metros…" — aviso temprano */
export const UMBRAL_AVISO_LEJOS_M = 250;
/** "En 80 metros…" — aviso de preparación */
export const UMBRAL_AVISO_CERCA_M = 90;
/** "Ahora…" — la maniobra es inmediata */
export const UMBRAL_AVISO_AHORA_M = 25;
/** Metros al destino (línea recta) para considerar llegada */
export const UMBRAL_LLEGADA_M = 45;
/** Metros de la polyline para considerarte DESVIADO */
export const UMBRAL_FUERA_RUTA_M = 60;
/** Fixes seguidos desviado antes de disparar el recálculo */
export const FUEGO_FUERA_RUTA_VECES = 3;
/** Metros movidos para confiar un rumbo nuevo (anti-salto GPS) */
export const MIN_MOVIMIENTO_RUMBO_M = 3;
/** Velocidad promedio usada en las estimaciones de la ruta recta (km/h) */
export const VELOCIDAD_ESTIMADA_KMH = 22;

// ── Persistencia de la preferencia de voz ──────────────────

const VOZ_KEY = 'rt_navvoz_v1';

/** ¿La voz está activada? (por defecto SÍ — es el alma de la fase) */
export function vozHabilitada(): boolean {
  try {
    const v = localStorage.getItem(VOZ_KEY);
    if (v === '0') return false;
  } catch {}
  return true;
}

export function setVozHabilitada(activa: boolean): void {
  try {
    localStorage.setItem(VOZ_KEY, activa ? '1' : '0');
  } catch {}
  if (!activa) detenerVoz();
}

// ── Voz (TTS nativo → speechSynthesis del navegador) ───────

/** Cancela lo que esté diciendo (TTS nativo del APK + Web Speech) */
export function detenerVoz(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {}
  try {
    const TTS = (window as any).Capacitor?.Plugins?.TextToSpeech;
    TTS?.stop?.()?.catch?.(() => undefined);
  } catch {}
}

let vozCache: SpeechSynthesisVoice | null | undefined;

/**
 * Elige la mejor voz en español disponible en el dispositivo:
 * es-PE > es-419/es-MX/es-US > cualquier es-*. Se cachea (las
 * voces del WebView tardan un momento en aparecer).
 */
export function elegirVozEspanol(): SpeechSynthesisVoice | null {
  if (vozCache !== undefined) return vozCache;
  try {
    const voces = window.speechSynthesis?.getVoices?.() || [];
    const prioridad = (v: SpeechSynthesisVoice): number => {
      const l = String(v.lang || '').toLowerCase().replace('_', '-');
      if (l.startsWith('es-pe')) return 0;
      if (l.startsWith('es-419') || l.startsWith('es-mx') || l.startsWith('es-us')) return 1;
      if (l.startsWith('es')) return 2;
      return 99;
    };
    const espanoles = voces.filter((v) => prioridad(v) < 99).sort((a, b) => prioridad(a) - prioridad(b));
    vozCache = espanoles[0] || null;
  } catch {
    vozCache = null;
  }
  return vozCache;
}

function hablarWeb(texto: string, interrumpir: boolean): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (interrumpir) synth.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-PE';
    const voz = elegirVozEspanol();
    if (voz) u.voice = voz;
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1.0;
    synth.speak(u);
  } catch {}
}

/**
 * Dice un texto en voz alta. En el APK usa el TTS NATIVO de
 * Capacitor (suena aunque el WebView bloquee speechSynthesis);
 * en web/respaldo usa el sintetizador del navegador.
 */
export function hablar(texto: string, interrumpir = false): void {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!limpio) return;
  try {
    const TTS = (window as any).Capacitor?.Plugins?.TextToSpeech;
    if (TTS?.speak) {
      TTS.speak({ text: limpio, lang: 'es-PE', rate: 1.02, pitch: 1.0, volume: 1.0 }).catch(() => {
        hablarWeb(limpio, interrumpir);
      });
      return;
    }
  } catch {}
  hablarWeb(limpio, interrumpir);
}

// ── Frases de la navegación ────────────────────────────────

/** Primera letra en minúscula para engancharla tras "En 200 m, …" */
function minusculaInicial(t: string): string {
  if (!t) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** "1.2 km" / "300 m" — para el cartel de maniobra */
export function formatearDistancia(m: number): string {
  if (!isFinite(m) || m < 0) return '—';
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  const km = m / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
}

/** Distancia en palabras para la VOZ: "300 metros" / "1,2 kilómetros" */
export function distanciaEnPalabras(m: number): string {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} metros`;
  const km = m / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1).replace('.', ',')} kilómetros`;
}

/**
 * La frase completa de una maniobra:
 *   distancia ≤ AHORA  → "Ahora, gira a la izquierda…"
 *   con distancia      → "En 200 metros, gira a la izquierda…"
 */
export function fraseVoz(instruccion: string, distanciaM: number | null): string {
  const t = String(instruccion || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (distanciaM == null) return t + '.';
  if (distanciaM <= UMBRAL_AVISO_AHORA_M) return `Ahora, ${minusculaInicial(t)}.`;
  return `En ${distanciaEnPalabras(distanciaM)}, ${minusculaInicial(t)}.`;
}

/** Anuncio al arrancar un tramo: "Navegando a Carlos. A 1,2 kilómetros." */
export function fraseInicio(nombre: string, distanciaM: number | null): string {
  return distanciaM != null
    ? `Navegando a ${nombre}. A ${distanciaEnPalabras(distanciaM)}.`
    : `Navegando a ${nombre}.`;
}

/** Anuncio al llegar a la parada */
export function fraseLlegada(nombre: string, num: number): string {
  return `Llegaste a tu parada ${num}: ${nombre}.`;
}

/** Anuncio de desvío */
export function fraseFueraRuta(): string {
  return 'Parece que te saliste de la ruta. Recalculando.';
}

/** Anuncio tras recalcular */
export function fraseRecalculada(): string {
  return 'Ruta recalculada.';
}

/** Anuncio al pasar a la siguiente parada */
export function fraseSiguiente(nombre: string, distanciaM: number | null): string {
  return distanciaM != null
    ? `Siguiente parada: ${nombre}. A ${distanciaEnPalabras(distanciaM)}.`
    : `Siguiente parada: ${nombre}.`;
}

/** Anuncio final de ruta */
export function fraseFin(): string {
  return '¡Ruta completada! Llegaste a todas tus paradas. ¡Buen trabajo!';
}

/** ¿El paso es el de llegada al destino? ("Llega a tu destino…") */
export function esPasoDestino(instruccion: string): boolean {
  return /^(llega|has llegado|destino)/i.test(String(instruccion || '').trim());
}

// ── Maniobras → ícono del cartel ───────────────────────────

export type IconoManiobra =
  | 'izquierda' | 'derecha' | 'recto'
  | 'leve-izq' | 'leve-der'
  | 'cerrada-izq' | 'cerrada-der'
  | 'uturn'
  | 'rotonda-izq' | 'rotonda-der'
  | 'rampa-izq' | 'rampa-der'
  | 'mantente-izq' | 'mantente-der'
  | 'bifurcacion-izq' | 'bifurcacion-der'
  | 'merge' | 'ferry' | 'destino';

/** Traduce la maniobra de Google al ícono del cartel (siempre cae en algo) */
export function iconoManiobra(m: string | null | undefined): IconoManiobra {
  switch (m) {
    case 'turn-left': return 'izquierda';
    case 'turn-right': return 'derecha';
    case 'straight': return 'recto';
    case 'turn-slight-left': return 'leve-izq';
    case 'turn-slight-right': return 'leve-der';
    case 'turn-sharp-left': return 'cerrada-izq';
    case 'turn-sharp-right': return 'cerrada-der';
    case 'uturn-left':
    case 'uturn-right': return 'uturn';
    case 'roundabout-left': return 'rotonda-izq';
    case 'roundabout-right': return 'rotonda-der';
    case 'ramp-left': return 'rampa-izq';
    case 'ramp-right': return 'rampa-der';
    case 'keep-left': return 'mantente-izq';
    case 'keep-right': return 'mantente-der';
    case 'fork-left': return 'bifurcacion-izq';
    case 'fork-right': return 'bifurcacion-der';
    case 'merge': return 'merge';
    case 'ferry':
    case 'ferry-train': return 'ferry';
    default: return 'recto';
  }
}

// ── Geometría ──────────────────────────────────────────────

const RAD = Math.PI / 180;

/** Distancia haversine en METROS entre dos puntos */
export function distanciaMetros(a: Punto, b: Punto): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Rumbo (bearing) de a→b en grados 0-360 (0=N, 90=E, 180=S, 270=O) */
export function rumbo(a: Punto, b: Punto): number {
  const f1 = a.lat * RAD;
  const f2 = b.lat * RAD;
  const dl = (b.lng - a.lng) * RAD;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Parámetro t (0-1) de la proyección de p sobre el segmento a→b */
function proyeccionEscalar(p: Punto, a: Punto, b: Punto): number {
  // Proyección local en metros (escala cos(lat) para la longitud)
  const kx = Math.cos(a.lat * RAD) * 111320;
  const ky = 110540;
  const ax = a.lng * kx, ay = a.lat * ky;
  const bx = b.lng * kx, by = b.lat * ky;
  const px = p.lng * kx, py = p.lat * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  return Math.max(0, Math.min(1, t));
}

export interface ProyeccionRuta {
  /** Índice del SEGMENTO (puntos[idx] → puntos[idx+1]) más cercano */
  idx: number;
  /** Punto proyectado sobre la ruta */
  punto: Punto;
  /** Distancia perpendicular a la ruta en metros (para el desvío) */
  distMetros: number;
  /** Metros recorridos sobre la ruta desde el inicio */
  avanzadoMetros: number;
  /** Metros que quedan SOBRE la ruta hasta el final */
  restanteMetros: number;
}

/**
 * Proyecta la posición GPS sobre la polyline de la ruta.
 *
 * Busca el segmento más cercano SOLO desde `desdeIdx` hacia
 * adelante (con 3 de margen atrás): así el ruido del GPS no
 * puede "devolverte" a un tramo que ya pasaste.
 */
export function proyectarSobreRuta(pos: Punto, puntos: Punto[], desdeIdx = 0): ProyeccionRuta | null {
  if (!puntos || puntos.length < 2) return null;

  // Distancias acumuladas: acum[i] = metros desde puntos[0] hasta puntos[i]
  const acum: number[] = [0];
  for (let i = 1; i < puntos.length; i++) {
    acum.push(acum[i - 1] + distanciaMetros(puntos[i - 1], puntos[i]));
  }
  const total = acum[acum.length - 1];

  const inicio = Math.max(0, desdeIdx - 3);
  let mejorDist = Infinity;
  let mejorIdx = inicio;
  let mejorPunto: Punto = puntos[0];
  let mejorT = 0;

  for (let i = inicio; i < puntos.length - 1; i++) {
    const t = proyeccionEscalar(pos, puntos[i], puntos[i + 1]);
    const px = puntos[i].lat + (puntos[i + 1].lat - puntos[i].lat) * t;
    const py = puntos[i].lng + (puntos[i + 1].lng - puntos[i].lng) * t;
    const d = distanciaMetros(pos, { lat: px, lng: py });
    if (d < mejorDist) {
      mejorDist = d;
      mejorIdx = i;
      mejorPunto = { lat: px, lng: py };
      mejorT = t;
    }
  }

  const avanzado = acum[mejorIdx] + (acum[mejorIdx + 1] - acum[mejorIdx]) * mejorT;
  return {
    idx: mejorIdx,
    punto: mejorPunto,
    distMetros: mejorDist,
    avanzadoMetros: Math.min(avanzado, total),
    restanteMetros: Math.max(0, total - avanzado),
  };
}

/**
 * Rumbo suavizado para la flechita: solo confía en un rumbo
 * nuevo si el GPS se movió de verdad (> MIN_MOVIMIENTO_RUMBO_M);
 * si está casi quieto mantiene el anterior (o el de la ruta).
 */
export function rumboSuavizado(
  previa: Punto | null,
  actual: Punto,
  rumboPrevio: number | null,
  rumboPorDefecto: number
): number {
  if (previa) {
    const d = distanciaMetros(previa, actual);
    if (d >= MIN_MOVIMIENTO_RUMBO_M) return rumbo(previa, actual);
  }
  return rumboPrevio ?? rumboPorDefecto;
}

/**
 * Encuentra el PRÓXIMO PASO a anunciar según lo avanzado:
 * el cartel siempre muestra la maniobra que viene (la que ocurre
 * al INICIO de un paso que aún no pisas). Si ya pasaste todas
 * las maniobras, muestra el último paso (la llegada).
 */
export function proximoPaso(
  ruta: RutaInstrucciones,
  avanzadoMetros: number
): { paso: PasoInstruccion; idx: number; distanciaM: number } | null {
  if (!ruta?.pasos?.length) return null;
  // Inicio (en metros) de cada paso dentro de la geometría completa
  let acumulado = 0;
  const inicios: number[] = [];
  let idxPunto = 0;
  for (const paso of ruta.pasos) {
    inicios.push(acumulado);
    for (let i = 1; i < paso.puntos.length; i++) {
      acumulado += distanciaMetros(paso.puntos[i - 1], paso.puntos[i]);
    }
    idxPunto++;
  }
  for (let j = 0; j < ruta.pasos.length; j++) {
    const distAlInicio = inicios[j] - avanzadoMetros;
    // La maniobra de este paso está delante (o apenas pisada)
    if (distAlInicio >= -5) {
      return { paso: ruta.pasos[j], idx: j, distanciaM: Math.max(0, distAlInicio) };
    }
  }
  // Ya pasaste todas las maniobras → queda llegar al destino
  const ultimo = ruta.pasos.length - 1;
  return { paso: ruta.pasos[ultimo], idx: ultimo, distanciaM: 0 };
}

// ── Motor de voz (no repite avisos) ────────────────────────

/**
 * Estado que recuerda qué fases (lejos/cerca/ahora) ya fueron
 * dichas para cada paso, para no repetir como loro.
 */
export class MotorVoz {
  private dichos = new Map<string, Set<string>>();
  private ultimoIdx = -1;
  mudo: boolean;

  constructor(mudo = false) {
    this.mudo = mudo;
  }

  setMudo(mudo: boolean): void {
    this.mudo = mudo;
    if (mudo) this.silenciar();
  }

  /** Corta la voz en curso (al cerrar la navegación) */
  silenciar(): void {
    detenerVoz();
  }

  /**
   * Evalúa si corresponde HABLAR para la próxima maniobra.
   * Devuelve la frase a decir (o null si no toca / está mudo).
   */
  evaluar(idxPaso: number, instruccion: string, distanciaM: number): string | null {
    if (this.mudo || !instruccion) return null;

    const clave = `${idxPaso}|${instruccion}`;
    let fases = this.dichos.get(clave);
    if (!fases) {
      fases = new Set();
      this.dichos.set(clave, fases);
    }
    // Limpiar pasos ya muy atrás (no crece para siempre)
    if (idxPaso !== this.ultimoIdx) {
      this.ultimoIdx = idxPaso;
      for (const k of Array.from(this.dichos.keys())) {
        const idx = Number(k.split('|')[0]);
        if (idx < idxPaso - 2) this.dichos.delete(k);
      }
    }

    let fase: 'lejos' | 'cerca' | 'ahora' | null = null;
    if (distanciaM <= UMBRAL_AVISO_AHORA_M) fase = 'ahora';
    else if (distanciaM <= UMBRAL_AVISO_CERCA_M) fase = 'cerca';
    else if (distanciaM <= UMBRAL_AVISO_LEJOS_M) fase = 'lejos';
    if (!fase || fases.has(fase)) return null;

    fases.add(fase);
    return fraseVoz(instruccion, fase === 'ahora' ? UMBRAL_AVISO_AHORA_M : distanciaM);
  }

  /** Tras recalcular la ruta los pasos son otros: empezar de cero */
  reiniciar(): void {
    this.dichos.clear();
    this.ultimoIdx = -1;
  }
}

// ── Detector de desvío ─────────────────────────────────────

/**
 * Cuenta fixes consecutivos lejos de la ruta: dispara UNA vez
 * cuando llega al límite (recalcula), y se resetea al volver.
 */
export class DetectorFueraRuta {
  private seguidos = 0;

  constructor(
    private umbralM = UMBRAL_FUERA_RUTA_M,
    private veces = FUEGO_FUERA_RUTA_VECES
  ) {}

  /** Reporta la distancia a la ruta; true → hay que recalcular */
  reportar(distM: number | null): boolean {
    if (distM == null || !isFinite(distM)) return false;
    if (distM > this.umbralM) {
      this.seguidos++;
      return this.seguidos === this.veces;
    }
    this.seguidos = 0;
    return false;
  }

  reset(): void {
    this.seguidos = 0;
  }
}

// ── Ruta recta de emergencia (sin Google) ──────────────────

/**
 * Si Google Directions no responde (sin internet / sin clave /
 * cuota), la navegación NO muere: ruta en línea recta con una
 * sola instrucción y estimación a 22 km/h. Sin avisos de
 * maniobra, pero con flechita, voz de inicio/llegada y cartel.
 */
export function construirRutaRecta(origen: Punto, destino: Punto): RutaInstrucciones {
  const metros = distanciaMetros(origen, destino);
  const km = Math.round((metros / 1000) * 10) / 10;
  return {
    pasos: [
      {
        instruccion: 'Dirígete a tu parada',
        maniobra: null,
        distanciaM: Math.round(metros),
        duracionS: Math.round((metros / 1000 / VELOCIDAD_ESTIMADA_KMH) * 3600),
        puntos: [origen, destino],
      },
    ],
    puntos: [origen, destino],
    distanciaKm: km,
    tiempoMin: Math.round((metros / 1000 / VELOCIDAD_ESTIMADA_KMH) * 60),
  };
}
