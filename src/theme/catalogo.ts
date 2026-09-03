// ═══════════════════════════════════════════════════════════
// 🎨 ESTUDIO DE TEMAS — RiderTrack V2 · F3.51
// Módulo: catalogo.ts — SOLO DATOS, cero lógica
// ═══════════════════════════════════════════════════════════
// Aquí viven las opciones que muestra el Estudio. Si mañana
// quieres un acento nuevo o una fuente más, se agrega a ESTE
// archivo (y su CSS en index.css) sin tocar nada más.
// ═══════════════════════════════════════════════════════════

import type { AcentoId, ConfigTema, FondoId, FuenteId, RadioId } from './tipos';

// ─────────────────────────────────────────────
// 🎨 ACENTOS — el color que remapea la paleta azul
// ─────────────────────────────────────────────
export interface DefAcento {
  id: AcentoId;
  nombre: string;
  /** Color representativo (para el círculo del estudio). */
  muestra: string;
}

export const ACENTOS: DefAcento[] = [
  { id: 'azul', nombre: 'Azul', muestra: '#3b82f6' },
  { id: 'turquesa', nombre: 'Turquesa', muestra: '#14b8a6' },
  { id: 'esmeralda', nombre: 'Esmeralda', muestra: '#10b981' },
  { id: 'violeta', nombre: 'Violeta', muestra: '#8b5cf6' },
  { id: 'rosa', nombre: 'Rosa', muestra: '#f43f5e' },
  { id: 'ambar', nombre: 'Ámbar', muestra: '#f59e0b' },
];

// ─────────────────────────────────────────────
// 🔤 FUENTES — tipografías de toda la app
// ─────────────────────────────────────────────
export interface DefFuente {
  id: FuenteId;
  nombre: string;
  descripcion: string;
  /** Stack CSS con fallbacks (si no hay red, cae a la del sistema). */
  stack: string;
  /** Requiere descarga desde Google Fonts (se inyecta 1 sola vez). */
  web: boolean;
}

export const FUENTES: DefFuente[] = [
  {
    id: 'sistema',
    nombre: 'Del sistema',
    descripcion: 'La de fábrica del teléfono · sin descarga',
    stack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    web: false,
  },
  {
    id: 'inter',
    nombre: 'Inter',
    descripcion: 'Moderna y limpia · la reina de las apps',
    stack: "'Inter', ui-sans-serif, system-ui, sans-serif",
    web: true,
  },
  {
    id: 'roboto',
    nombre: 'Roboto',
    descripcion: 'Android puro · la de siempre de Google',
    stack: "'Roboto', ui-sans-serif, system-ui, sans-serif",
    web: true,
  },
  {
    id: 'montserrat',
    nombre: 'Montserrat',
    descripcion: 'Geométrica y con carácter',
    stack: "'Montserrat', ui-sans-serif, system-ui, sans-serif",
    web: true,
  },
  {
    id: 'nunito',
    nombre: 'Nunito',
    descripcion: 'Redondita y amigable · fácil de leer',
    stack: "'Nunito', ui-sans-serif, system-ui, sans-serif",
    web: true,
  },
  {
    id: 'raleway',
    nombre: 'Raleway',
    descripcion: 'Elegante, estilo editorial',
    stack: "'Raleway', ui-sans-serif, system-ui, sans-serif",
    web: true,
  },
];

/** URL única de Google Fonts con TODAS las familias del catálogo
 *  (así cambiar de fuente en el estudio es instantáneo: ya están
 *  descargadas). `display=swap` = primero sale con la fuente del
 *  sistema y cambia sola cuando llega la buena. */
export const URL_GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2' +
  '?family=Inter:wght@400;500;600;700;800;900' +
  '&family=Montserrat:wght@400;600;700;800' +
  '&family=Nunito:wght@400;600;700;800' +
  '&family=Raleway:wght@400;600;700' +
  '&family=Roboto:wght@400;500;700;900' +
  '&display=swap';

// ─────────────────────────────────────────────
// 🖼️ FONDOS — textura detrás de las tarjetas
// ─────────────────────────────────────────────
export interface DefFondo {
  id: FondoId;
  nombre: string;
  descripcion: string;
  /** Vista miniatura dentro del estudio (clases utilitarias). */
  mini: string;
}

export const FONDOS: DefFondo[] = [
  {
    id: 'solido',
    nombre: 'Sólido',
    descripcion: 'Plano, el de siempre',
    mini: 'bg-slate-800',
  },
  {
    id: 'degradado',
    nombre: 'Degradado',
    descripcion: 'Brillo suave del acento abajo',
    mini: 'bg-gradient-to-br from-slate-800 to-blue-900/60',
  },
  {
    id: 'puntos',
    nombre: 'Puntos',
    descripcion: 'Textura de puntitos sutiles',
    mini: 'bg-slate-800 bg-[radial-gradient(rgba(148,163,184,0.35)_1px,transparent_1.5px)] bg-[length:10px_10px]',
  },
  {
    id: 'cuadricula',
    nombre: 'Cuadrícula',
    descripcion: 'Retícula fina tipo mapa',
    mini: 'bg-slate-800 bg-[linear-gradient(rgba(148,163,184,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.25)_1px,transparent_1px)] bg-[length:12px_12px]',
  },
];

// ─────────────────────────────────────────────
// 📐 REDONDEO — esquinas de tarjetas y botones
// ─────────────────────────────────────────────
export interface DefRadio {
  id: RadioId;
  nombre: string;
}

export const RADIOS: DefRadio[] = [
  { id: 'sutil', nombre: 'Sutil' },
  { id: 'estandar', nombre: 'Estándar' },
  { id: 'redondeado', nombre: 'Redondeado' },
];

// ─────────────────────────────────────────────
// ✨ PRESETS — looks completos de UN toque
// ─────────────────────────────────────────────
export interface PresetTema {
  id: string;
  nombre: string;
  emoji: string;
  descripcion: string;
  config: ConfigTema;
}

export const PRESETS: PresetTema[] = [
  {
    id: 'medianoche',
    nombre: 'Medianoche',
    emoji: '🌙',
    descripcion: 'El de siempre — oscuro y azul',
    config: { modo: 'dark', acento: 'azul', fuente: 'sistema', escala: 1, fondo: 'solido', radio: 'estandar' },
  },
  {
    id: 'dia-claro',
    nombre: 'Día Claro',
    emoji: '☀️',
    descripcion: 'Para el sol de mediodía',
    config: { modo: 'light', acento: 'azul', fuente: 'sistema', escala: 1, fondo: 'solido', radio: 'estandar' },
  },
  {
    id: 'oceano',
    nombre: 'Océano',
    emoji: '🌊',
    descripcion: 'Oscuro con acento turquesa y brillo',
    config: { modo: 'dark', acento: 'turquesa', fuente: 'inter', escala: 1, fondo: 'degradado', radio: 'estandar' },
  },
  {
    id: 'bosque',
    nombre: 'Bosque',
    emoji: '🌲',
    descripcion: 'Verde esmeralda, redondito y calmado',
    config: { modo: 'dark', acento: 'esmeralda', fuente: 'nunito', escala: 1, fondo: 'puntos', radio: 'redondeado' },
  },
  {
    id: 'amanecer',
    nombre: 'Amanecer',
    emoji: '🌅',
    descripcion: 'Claro con energía ámbar y Montserrat',
    config: { modo: 'light', acento: 'ambar', fuente: 'montserrat', escala: 1, fondo: 'solido', radio: 'estandar' },
  },
  {
    id: 'elegante',
    nombre: 'Elegante',
    emoji: '💜',
    descripcion: 'Violeta premium con Raleway y brillo',
    config: { modo: 'dark', acento: 'violeta', fuente: 'raleway', escala: 1, fondo: 'degradado', radio: 'redondeado' },
  },
  {
    id: 'fresco',
    nombre: 'Fresco',
    emoji: '🍉',
    descripcion: 'Claro, rosa y amigable',
    config: { modo: 'light', acento: 'rosa', fuente: 'nunito', escala: 1, fondo: 'puntos', radio: 'redondeado' },
  },
  {
    id: 'tecnico',
    nombre: 'Técnico',
    emoji: '🖥️',
    descripcion: 'Oscuro, verde Roboto y cuadrícula',
    config: { modo: 'dark', acento: 'esmeralda', fuente: 'roboto', escala: 1, fondo: 'cuadricula', radio: 'sutil' },
  },
];

/** Busca un preset por id (para marcar el activo en la grilla). */
export const presetPorId = (id: string): PresetTema | undefined =>
  PRESETS.find((p) => p.id === id);
