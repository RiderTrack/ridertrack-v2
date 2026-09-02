// ═══════════════════════════════════════════════════════════
// 🎙️ SERVICIO DEL PODCAST — el REPRODUCTOR (Fase 3.42)
// Toca un GuionPodcast capítulo por capítulo con la voz del
// teléfono, igual que la navegación: TTS NATIVO del APK
// (@capacitor-community/text-to-speech — resuelve al terminar
// cada oración y emite onRangeStart por palabra) y, si no está,
// el speechSynthesis del WebView.
//
// Controles de reproductor real:
//   · ▶ reproducir  ⏸ pausar  ⏵ reanudar  ⏹ detener  ⏭ capítulos
//   · velocidad (0.8 – 1.3) con persistencia
//   · progreso por palabras (onRangeStart / onboundary)
//   · reanudar repite la FRASE donde iba, no el capítulo
//
// Anti-cuelgues (lecciones de la F3.29 del Spotify):
//   · Watchdog por capítulo: si el TTS muere en silencio (una
//     llamada o la voz de navegación lo mata), reintenta la
//     frase y a la segunda pasa al siguiente capítulo.
//   · Generación: cada control (play/pausa/stop/salto) invalida
//     las promesas viejas — nunca se adelanta solo.
//   · La voz de la NAVEGACIÓN manda: cuando habla (evento
//     'rt-voz-nav' de hablar()), el podcast se auto-pausa y
//     vuelve solo 10 s después del último anuncio.
// ═══════════════════════════════════════════════════════════

import {
  GuionPodcast,
  duracionEstimadaSeg,
  estimarSegundos,
  progresoGuion,
  recorteDesdeFrase,
} from '../utils/podcastCore';
import { detenerVoz, elegirVozEspanol } from './navegacionGps';

// ── Estado ────────────────────────────────────────────────

export type FasePodcast = 'detenido' | 'reproduciendo' | 'pausado';

export interface EstadoPodcast {
  fase: FasePodcast;
  guion: GuionPodcast | null;
  /** capítulo en curso */
  segmentoIdx: number;
  /** avance del guion completo 0..1 (para la barra) */
  progreso: number;
  /** segundos estimados ya hablados / del guion completo */
  transcurridoSeg: number;
  duracionSeg: number;
  /** velocidad de la voz */
  rate: number;
}

const RATE_KEY = 'rt_podcast_rate';
const RATE_MIN = 0.8;
const RATE_MAX = 1.3;

let _guion: GuionPodcast | null = null;
let _fase: FasePodcast = 'detenido';
let _segIdx = 0;
let _charIdx = 0;          // índice de caracteres dentro del capítulo ORIGINAL
let _baseOffset = 0;       // chars saltados al reanudar por frase
let _rate = 1.0;
let _generacion = 0;
let _tickId: ReturnType<typeof setInterval> | null = null;
let _vozTimer: ReturnType<typeof setTimeout> | null = null;
let _autoPausadoPorVoz = false;

const oyentes = new Set<(e: EstadoPodcast) => void>();

try {
  const r = parseFloat(localStorage.getItem(RATE_KEY) || '');
  if (Number.isFinite(r)) _rate = Math.min(RATE_MAX, Math.max(RATE_MIN, r));
} catch {}

function pluginTTS(): any | null {
  try {
    const t = (window as any).Capacitor?.Plugins?.TextToSpeech;
    return t && typeof t.speak === 'function' ? t : null;
  } catch {
    return null;
  }
}

/** largo en caracteres del capítulo en curso (para topear índices) */
function largoSegActual(): number {
  return Math.max(0, _guion?.segmentos?.[_segIdx]?.texto?.length || 0);
}

function recalcular(): EstadoPodcast {
  const progreso = _guion ? progresoGuion(_guion, _segIdx, _charIdx) : 0;
  const dur = _guion ? duracionEstimadaSeg(_guion, _rate) : 0;
  return {
    fase: _fase,
    guion: _guion,
    segmentoIdx: _segIdx,
    progreso,
    transcurridoSeg: Math.round(progreso * dur),
    duracionSeg: dur,
    rate: _rate,
  };
}

function emitir(): void {
  const snap = recalcular();
  oyentes.forEach((fn) => {
    try {
      fn(snap);
    } catch {}
  });
}

export function snapshotPodcast(): EstadoPodcast {
  return recalcular();
}

export function suscribirPodcast(cb: (e: EstadoPodcast) => void): () => void {
  oyentes.add(cb);
  cb(recalcular());
  return () => oyentes.delete(cb);
}

// ── Ticker del tiempo (solo mientras reproduce) ───────────

function arrancarTicker(): void {
  if (_tickId != null) return;
  _tickId = setInterval(() => {
    if (_fase === 'reproduciendo') emitir();
  }, 800);
}

function pararTicker(): void {
  if (_tickId != null) {
    clearInterval(_tickId);
    _tickId = null;
  }
}

// ── Progreso por palabra (solo SIEMPRE que el podcast suena;
//    el onRangeStart del plugin también dispara con la voz de
//    la navegación — si no estamos reproduciendo, se ignora) ─

let _listenerRangoInstalado = false;

function activarListenerRango(): void {
  if (_listenerRangoInstalado) return;
  const TTS = pluginTTS();
  if (!TTS?.addListener) return;
  try {
    TTS.addListener('onRangeStart', (info: { start?: number; end?: number }) => {
      if (_fase !== 'reproduciendo') return;
      const start = Math.max(0, Math.floor(Number(info?.start) || 0));
      // el índice es dentro del TEXTO hablado (que puede empezar
      // en la frase de reanudación) → se suma el offset
      _charIdx = Math.min(_baseOffset + start, largoSegActual());
    });
    _listenerRangoInstalado = true;
  } catch {}
}

// ── Hablar un capítulo (nativo → web, siempre con watchdog) ─

function esperarHabla(texto: string): Promise<'ok' | 'timeout'> {
  const est = estimarSegundos(texto, _rate);
  const esperaMs = Math.max(20000, est * 2600 + 20000);

  const TTS = pluginTTS();
  if (TTS) {
    const nativo = TTS.speak({ text: texto, lang: 'es-PE', rate: _rate, pitch: 1.0, volume: 1.0 })
      .then(() => 'ok' as const)
      .catch(() => 'ok' as const); // motor roto: avanza (nada que hacer)
    const timeout = new Promise<'timeout'>((res) => setTimeout(() => res('timeout'), esperaMs));
    return Promise.race([nativo, timeout]);
  }

  // ── Fallback web: en el APK el WebView suele no tener voces,
  //    pero en el navegador de desarrollo suena perfecto.
  return new Promise<'ok' | 'timeout'>((resolver) => {
    let resuelto = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cerrar = (v: 'ok' | 'timeout') => {
      if (resuelto) return;
      resuelto = true;
      if (timer != null) clearTimeout(timer);
      resolver(v);
    };
    try {
      const synth = window.speechSynthesis;
      if (!synth) {
        cerrar('ok');
        return;
      }
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'es-PE';
      const voz = elegirVozEspanol();
      if (voz) u.voice = voz;
      u.rate = Math.min(2, Math.max(0.5, _rate));
      u.pitch = 1.0;
      u.volume = 1.0;
      u.onend = () => cerrar('ok');
      u.onerror = () => cerrar('ok');
      u.onboundary = (ev: any) => {
        if (_fase !== 'reproduciendo') return;
        const i = Math.max(0, Math.floor(Number(ev?.charIndex) || 0));
        _charIdx = Math.min(_baseOffset + i, largoSegActual());
      };
      synth.speak(u);
      timer = setTimeout(() => cerrar('timeout'), esperaMs);
    } catch {
      cerrar('ok');
    }
  });
}

// ── Motor: cadena de capítulos con generación ─────────────

/**
 * Toca el guion desde idxInicial. `intento=1` significa "sigue
 * por la FRASE donde iba" (reanudar o reintentar tras un corte
 * silencioso). Cada control público (play/pausa/stop/salto)
 * sube la generación: las promesas viejas se ignoran.
 */
async function tocarGuion(gen: number, idxInicial: number, intento = 0): Promise<void> {
  while (gen === _generacion && _guion && idxInicial < _guion.segmentos.length) {
    const seg = _guion.segmentos[idxInicial];
    _segIdx = idxInicial;

    // texto a hablar: el capítulo entero, o la frase de reanudación
    let texto: string = seg.texto;
    _baseOffset = 0;
    if (intento > 0 && _charIdx > 0) {
      const recorte = recorteDesdeFrase(seg.texto, _charIdx);
      if (recorte) {
        const off = seg.texto.indexOf(recorte);
        _baseOffset = off >= 0 ? off : 0;
        texto = recorte;
      } else {
        // la frase ya estaba terminada → pasa al siguiente capítulo
        idxInicial++;
        intento = 0;
        _charIdx = 0;
        continue;
      }
    }

    emitir();
    const resultado = await esperarHabla(texto);
    if (gen !== _generacion) return; // llegó un control: fuera

    if (resultado === 'ok') {
      _charIdx = 0;
      _baseOffset = 0;
      idxInicial++;
      intento = 0;
      emitir();
    } else {
      // timeout silencioso (llamada / voz de navegación mató la
      // oración): reintenta la frase UNA vez, a la segunda salta
      if (intento < 1) {
        intento = 1;
      } else {
        _charIdx = 0;
        _baseOffset = 0;
        idxInicial++;
        intento = 0;
        emitir();
      }
    }
  }

  if (gen === _generacion && _guion && idxInicial >= _guion.segmentos.length) {
    // final del episodio 🎉
    _fase = 'detenido';
    _segIdx = 0;
    _charIdx = 0;
    _baseOffset = 0;
    pararTicker();
    detenerVoz();
    emitir();
  }
}

// ── API pública ───────────────────────────────────────────

/** ▶ Toca el guion desde el inicio (o desde un capítulo) */
export function reproducirGuion(guion: GuionPodcast, desdeSegmento = 0): void {
  if (!guion || guion.segmentos.length === 0) return;
  _generacion++;
  detenerVoz();
  _guion = guion;
  _fase = 'reproduciendo';
  _segIdx = Math.min(Math.max(0, desdeSegmento), guion.segmentos.length - 1);
  _charIdx = 0;
  _baseOffset = 0;
  _autoPausadoPorVoz = false;
  activarListenerRango();
  arrancarTicker();
  emitir();
  void tocarGuion(_generacion, _segIdx);
}

/** ⏸ Pausa: la nativa mata la oración → se recuerda la frase.
 * La pausa MANUAL siempre gana: cancela el auto-resume de la
 * voz de navegación aunque ya esté auto-pausado. */
export function pausarPodcast(): void {
  _autoPausadoPorVoz = false;
  if (_fase !== 'reproduciendo') return;
  _generacion++;
  _fase = 'pausado';
  detenerVoz();
  pararTicker();
  emitir();
}

/** ⏵ Sigue desde la FRASE donde iba (no repite el capítulo) */
export function reanudarPodcast(): void {
  if (_fase !== 'pausado' || !_guion) return;
  _generacion++;
  _fase = 'reproduciendo';
  _autoPausadoPorVoz = false;
  arrancarTicker();
  emitir();
  const seguirPorFrase = _charIdx > 0 ? 1 : 0;
  void tocarGuion(_generacion, _segIdx, seguirPorFrase);
}

/** ⏹ Corta todo y deja el reproductor en cero */
export function detenerPodcast(): void {
  _generacion++;
  _fase = 'detenido';
  _segIdx = 0;
  _charIdx = 0;
  _baseOffset = 0;
  _autoPausadoPorVoz = false;
  if (_vozTimer != null) {
    clearTimeout(_vozTimer);
    _vozTimer = null;
  }
  detenerVoz();
  pararTicker();
  emitir();
}

/** ⏭/⏮ Salta a un capítulo concreto (desde su inicio) */
export function saltarASegmento(idx: number): void {
  if (!_guion) return;
  _generacion++;
  detenerVoz();
  _fase = 'reproduciendo';
  _segIdx = Math.min(Math.max(0, idx), _guion.segmentos.length - 1);
  _charIdx = 0;
  _baseOffset = 0;
  _autoPausadoPorVoz = false;
  arrancarTicker();
  emitir();
  void tocarGuion(_generacion, _segIdx);
}

/**
 * Ajusta la velocidad (persiste). Si está sonando, reinicia el
 * capítulo actual a la nueva velocidad (el TTS no puede cambiar
 * la velocidad de una oración ya en el aire).
 */
export function fijarRatePodcast(r: number): void {
  const lim = Math.min(RATE_MAX, Math.max(RATE_MIN, Number.isFinite(r) ? r : 1));
  if (lim === _rate) return;
  _rate = lim;
  try {
    localStorage.setItem(RATE_KEY, String(lim));
  } catch {}
  if (_fase === 'reproduciendo') {
    saltarASegmento(_segIdx);
  } else {
    emitir();
  }
}

// ── La voz de la navegación MANDA: auto-pausa cortés ───────
// hablar() dispara 'rt-voz-nav' ANTES de hablar → el podcast se
// calla y vuelve 10 s después del último anuncio (si nadie lo
// pausó a mano). El evento también lo dispara el arranque de
// ruta del Modo Moto (voz de "ruta iniciada").

function instalarAutoPausa(): void {
  window.addEventListener('rt-voz-nav', () => {
    if (_fase !== 'reproduciendo') return;
    _generacion++;
    _fase = 'pausado';
    _autoPausadoPorVoz = true;
    detenerVoz();
    pararTicker();
    emitir();
    if (_vozTimer != null) clearTimeout(_vozTimer);
    _vozTimer = setTimeout(() => {
      _vozTimer = null;
      if (_autoPausadoPorVoz && _fase === 'pausado') {
        reanudarPodcast();
      }
    }, 10_000);
  });
}

try {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    instalarAutoPausa();
  }
} catch {}
