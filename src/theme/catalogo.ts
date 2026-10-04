// ═══════════════════════════════════════════════════════════
// 🎨 ESTUDIO DE TEMAS — RiderTrack V2 · F3.52
// Módulo: catalogo.ts — SOLO DATOS, cero lógica
// ═══════════════════════════════════════════════════════════
// Aquí viven las opciones que muestra el Estudio. Si mañana
// quieres un acento nuevo o una fuente más, se agrega a ESTE
// archivo (y su CSS en index.css) sin tocar nada más.
// ═══════════════════════════════════════════════════════════

import type {
  AcentoId,
  ConfigTema,
  DensidadId,
  FondoId,
  FuenteId,
  PesoId,
  RadioId,
  TonoTextoId,
} from './tipos';

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
  {
    id: 'atkinson',
    nombre: 'Atkinson',
    descripcion: 'Hyperlegible · letras que no se confunden',
    stack: "'Atkinson Hyperlegible', ui-sans-serif, system-ui, sans-serif",
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
  '&family=Atkinson+Hyperlegible:wght@400;700' +
  '&display=swap';

// ─────────────────────────────────────────────
// ✍️ PESO DE LETRA (F3.52) — grosor del texto
// ─────────────────────────────────────────────
export interface DefPeso {
  id: PesoId;
  nombre: string;
  descripcion: string;
  /** Muestra del chip en el estudio. */
  css: number;
}

export const PESOS: DefPeso[] = [
  { id: 'normal', nombre: 'Normal', descripcion: 'El grosor de fábrica', css: 400 },
  { id: 'medio', nombre: 'Medio', descripcion: 'Un punto más de cuerpo', css: 500 },
  { id: 'fuerte', nombre: 'Fuerte', descripcion: 'Negrita marcada, imposible perderla', css: 600 },
];

// ─────────────────────────────────────────────
// 🎨 TONO DE LETRA (F3.52) — color / intensidad
// ─────────────────────────────────────────────
export interface DefTono {
  id: TonoTextoId;
  nombre: string;
  descripcion: string;
  /** Color del punto de muestra según modo actual. */
  muestraDark: string;
  muestraLight: string;
}

export const TONOS_TEXTO: DefTono[] = [
  {
    id: 'neutro',
    nombre: 'Neutro',
    descripcion: 'El gris azulado de siempre',
    muestraDark: '#cbd5e1',
    muestraLight: '#3a4a63',
  },
  {
    id: 'intenso',
    nombre: 'Intenso',
    descripcion: 'Blanco/negro puro — máximo brillo',
    muestraDark: '#ffffff',
    muestraLight: '#050e20',
  },
  {
    id: 'suave',
    nombre: 'Suave',
    descripcion: 'Tenue, descansa la vista',
    muestraDark: '#9aa7bc',
    muestraLight: '#76839b',
  },
  {
    id: 'calido',
    nombre: 'Cálido',
    descripcion: 'Tinta crema/sepia, no cansa de noche',
    muestraDark: '#e6dcc3',
    muestraLight: '#4a4034',
  },
];

// ─────────────────────────────────────────────
// 📏 DENSIDAD (F3.52) — apretado o con aire
// ─────────────────────────────────────────────
export interface DefDensidad {
  id: DensidadId;
  nombre: string;
  descripcion: string;
}

export const DENSIDADES: DefDensidad[] = [
  {
    id: 'compacta',
    nombre: 'Compacta',
    descripcion: 'Más pedidos por pantalla · −12% de aire',
  },
  { id: 'normal', nombre: 'Normal', descripcion: 'El balance de fábrica' },
  { id: 'comoda', nombre: 'Cómoda', descripcion: 'Todo más aireado · +12%' },
];

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
    config: { modo: 'dark', acento: 'azul', fuente: 'sistema', escala: 1, fondo: 'solido', radio: 'estandar', densidad: 'normal', altoContraste: false, animaciones: true, peso: 'normal', tonoTexto: 'neutro', horaClaro: 6, horaOscuro: 18 },
  },
  {
    id: 'dia-claro',
    nombre: 'Día Claro',
    emoji: '☀️',
    descripcion: 'Para el sol de mediodía',
    config: { modo: 'light', acento: 'azul', fuente: 'sistema', escala: 1, fondo: 'solido', radio: 'estandar', densidad: 'normal', altoContraste: false, animaciones: true, peso: 'normal', tonoTexto: 'neutro', horaClaro: 6, horaOscuro: 18 },
  },
  {
    id: 'oceano',
    nombre: 'Océano',
    emoji: '🌊',
    descripcion: 'Oscuro con acento turquesa y brillo',
    config: { modo: 'dark', acento: 'turquesa', fuente: 'inter', escala: 1, fondo: 'degradado', radio: 'estandar', densidad: 'normal', altoContraste: false, animaciones: true, peso: 'normal', tonoTexto: 'neutro', horaClaro: 6, horaOscuro: 18 },
  },
  {
    id: 'bosque',
    nombre: 'Bosque',
    emoji: '🌲',
    descripcion: 'Verde esmeralda, redondito y calmado',
    config: { modo: 'dark', acento: 'esmeralda', fuente: 'nunito', escala: 1, fondo: 'puntos', radio: 'redondeado', densidad: 'normal', altoContraste: false, animaciones: true, peso: 'normal', tonoTexto: 'neutro', horaClaro: 6, horaOscuro: 18 },
  },
  {
    id: 'amanecer',
    nombre: 'Amanecer',
    emoji: '🌅',
    descripcion: 'Claro con energía ámbar y Montserrat',
    config: { modo: 'light', acento: 'ambar', fuente: 'montserrat', escala: 1, fondo: 'solido', radio: 'estandar', densidad: 'normal', altoContraste: false, animaciones: true, peso: 'normal', tonoTexto: 'neutro', horaClaro: 6, horaOscuro: 18 },
  },
  {
    id: 'elegante',
    nombre: 'Elegante',
    emoji: '💜',
    descripcion: 'Violeta premium con Raleway y brillo',
    config: { modo: 'dark', acento: 'violeta', fuente: 'raleway', escala: 1, fondo: 'degradado', radio: 'redondeado', densidad: 'normal', altoContraste: false, animaciones: true, peso: 'normal', tonoTexto: 'neutro', horaClaro: 6, horaOscuro: 18 },
  },
  {
    id: 'fresco',
    nombre: 'Fresco',
    emoji: '🍉',
    descripcion: 'Claro, rosa y amigable',
    config: { modo: 'light', acento: 'rosa', fuente: 'nunito', escala: 1, fondo: 'puntos', radio: 'redondeado', densidad: 'normal', altoContraste: false, animaciones: true, peso: 'normal', tonoTexto: 'neutro', horaClaro: 6, horaOscuro: 18 },
  },
  {
    id: 'tecnico',
    nombre: 'Técnico',
    emoji: '🖥️',
    descripcion: 'Oscuro, verde Roboto y cuadrícula',
    config: { modo: 'dark', acento: 'esmeralda', fuente: 'roboto', escala: 1, fondo: 'cuadricula', radio: 'sutil', densidad: 'normal', altoContraste: false, animaciones: true, peso: 'normal', tonoTexto: 'neutro', horaClaro: 6, horaOscuro: 18 },
  },
  {
    id: 'lectura',
    nombre: 'Lectura',
    emoji: '📖',
    descripcion: 'Claro cálido con Atkinson y letra gruesa',
    config: { modo: 'light', acento: 'azul', fuente: 'atkinson', escala: 1.1, fondo: 'solido', radio: 'estandar', densidad: 'normal', altoContraste: false, animaciones: true, peso: 'medio', tonoTexto: 'calido', horaClaro: 6, horaOscuro: 18 },
  },
  {
    id: 'carretera',
    nombre: 'Carretera',
    emoji: '🕶️',
    descripcion: 'Contraste reforzado para leer con sol de frente',
    config: { modo: 'light', acento: 'azul', fuente: 'sistema', escala: 1.05, fondo: 'solido', radio: 'estandar', densidad: 'normal', altoContraste: true, animaciones: true, peso: 'medio', tonoTexto: 'intenso', horaClaro: 6, horaOscuro: 18 },
  },
  {
    id: 'nocturno',
    nombre: 'Nocturno',
    emoji: '🌃',
    descripcion: 'Oscuro apagado, cálido y sin movimientos',
    config: { modo: 'dark', acento: 'violeta', fuente: 'sistema', escala: 1, fondo: 'solido', radio: 'estandar', densidad: 'normal', altoContraste: false, animaciones: false, peso: 'normal', tonoTexto: 'calido', horaClaro: 6, horaOscuro: 18 },
  },
];

/** ¿La config actual es EXACTAMENTE este preset? (ignora la escala:
 *  si solo moviste el tamaño de letra, el look del preset sigue
 *  siendo el activo). Compara todos los campos F3.51 + F3.52. */
export const mismoLook = (a: ConfigTema, b: ConfigTema): boolean =>
  a.modo === b.modo &&
  a.acento === b.acento &&
  a.fuente === b.fuente &&
  a.fondo === b.fondo &&
  a.radio === b.radio &&
  a.densidad === b.densidad &&
  a.altoContraste === b.altoContraste &&
  a.animaciones === b.animaciones &&
  a.peso === b.peso &&
  a.tonoTexto === b.tonoTexto &&
  a.horaClaro === b.horaClaro &&
  a.horaOscuro === b.horaOscuro;

/** Busca un preset por id (para marcar el activo en la grilla). */
export const presetPorId = (id: string): PresetTema | undefined =>
  PRESETS.find((p) => p.id === id);
