// ═══════════════════════════════════════════════════════════
// 🎨 ESTUDIO DE TEMAS — RiderTrack V2 · F3.51
// Módulo: tipos.ts — contratos de datos del sistema de temas
// ═══════════════════════════════════════════════════════════
// El Estudio de Temas (theme studio) de la F3.51 está MODULARIZADO
// en src/theme/ para que nada se mezcle con la lógica de rutas:
//   tipos.ts        → este archivo (contratos)
//   catalogo.ts     → presets, acentos, fuentes, fondos (SOLO datos)
//   motor.ts        → aplicar al documento + guardar/cargar (testeable)
//   TemaProvider.tsx→ contexto React (estado vivo)
//   useTema.ts      → hook de acceso desde cualquier componente
// La UI vive aparte: src/components/ThemeStudioModal.tsx
// ═══════════════════════════════════════════════════════════

import type { ThemeMode } from '../types';

/** Modo de tema elegido por el rider. `auto` sigue al teléfono. */
export type ModoTema = ThemeMode | 'auto';

/** Color de acento principal (remapea la paleta azul de la app). */
export type AcentoId = 'azul' | 'turquesa' | 'esmeralda' | 'violeta' | 'rosa' | 'ambar';

/** Familia tipográfica. `sistema` = la del teléfono (sin descarga). */
export type FuenteId = 'sistema' | 'inter' | 'roboto' | 'montserrat' | 'nunito' | 'raleway';

/** Textura del fondo de la app (detrás de las tarjetas). */
export type FondoId = 'solido' | 'degradado' | 'puntos' | 'cuadricula';

/** Redondeo de bordes de tarjetas y botones. */
export type RadioId = 'sutil' | 'estandar' | 'redondeado';

/** Configuración COMPLETA del tema — todo lo que el Estudio controla. */
export interface ConfigTema {
  /** Oscuro / Claro / Auto (sigue al sistema del teléfono). */
  modo: ModoTema;
  /** Color de acento (botones, enlaces, badges, focos). */
  acento: AcentoId;
  /** Tipografía de toda la app. */
  fuente: FuenteId;
  /** Escala de letra: 1 = 100 % (diseño original). Rango 0.85 – 1.25. */
  escala: number;
  /** Textura del fondo. */
  fondo: FondoId;
  /** Redondeo de bordes. */
  radio: RadioId;
}

/** Valores de fábrica — exactamente el look que tiene la app hoy. */
export const CONFIG_DEFECTO: ConfigTema = {
  modo: 'dark',
  acento: 'azul',
  fuente: 'sistema',
  escala: 1,
  fondo: 'solido',
  radio: 'estandar',
};

/** Clave de localStorage con la configuración completa (JSON). */
export const CLAVE_TEMA = 'rt2_tema';

/** Clave LEGADO (fase 1.5): 'rt_theme' = 'light' | 'dark'.
 *  Se migra automáticamente la primera vez y se sigue escribiendo
 *  por si algo viejo la lee. */
export const CLAVE_TEMA_LEGADO = 'rt_theme';

/** Rango permitido de la escala de letra. */
export const ESCALA_MIN = 0.85;
export const ESCALA_MAX = 1.25;
export const ESCALA_PASO = 0.05;
