// ═══════════════════════════════════════════════════════════
// 🎨 ESTUDIO DE TEMAS — RiderTrack V2 · F3.52
// Módulo: tipos.ts — contratos de datos del sistema de temas
// ═══════════════════════════════════════════════════════════
// El Estudio de Temas está MODULARIZADO en src/theme/ para que
// nada se mezcle con la lógica de rutas:
//   tipos.ts         → este archivo (contratos)
//   catalogo.ts      → presets, acentos, fuentes, fondos (SOLO datos)
//   motor.ts         → aplicar al documento + guardar/cargar (testeable)
//   TemaProvider.tsx → contexto React (estado vivo)
//   useTema.ts       → hook de acceso desde cualquier componente
//   remoto.ts        → ☁️ F3.52: sync del tema con Firestore (usuarios/{uid})
//   useSincronizacionTema.ts → ☁️ F3.52: hook que engancha el sync con la sesión
// La UI vive aparte: src/components/ThemeStudioModal.tsx
//
// NOVEDADES F3.52 (todo retrocompatible con datos F3.51 guardados):
//   • modo 'horario' + horaClaro/horaOscuro (claro de día, oscuro de noche)
//   • densidad compacta/normal/cómoda (spacing sin tocar la letra)
//   • altoContraste (legibilidad reforzada, sol de la moto)
//   • animaciones on/off (ahorro de batería / menos movimiento)
//   • peso de letra normal/medio/fuerte (la tan pedida "más negrita")
//   • tonoTexto neutro/intenso/suave/cálido (color e intensidad de la letra)
//   • fuente 'atkinson' (Atkinson Hyperlegible, alta legibilidad)
//   • sincronización del tema con la cuenta (Firestore + localStorage)
// ═══════════════════════════════════════════════════════════

import type { ThemeMode } from '../types';

/** Modo de tema elegido por el rider.
 *  `auto` sigue al teléfono · `horario` (F3.52) sigue al reloj. */
export type ModoTema = ThemeMode | 'auto' | 'horario';

/** Color de acento principal (remapea la paleta azul de la app). */
export type AcentoId = 'azul' | 'turquesa' | 'esmeralda' | 'violeta' | 'rosa' | 'ambar';

/** Familia tipográfica. `sistema` = la del teléfono (sin descarga).
 *  `atkinson` = Atkinson Hyperlegible (F3.52, diseñada para leer
 *  de un vistazo — letras que no se confunden entre sí). */
export type FuenteId =
  | 'sistema'
  | 'inter'
  | 'roboto'
  | 'montserrat'
  | 'nunito'
  | 'raleway'
  | 'atkinson';

/** Textura del fondo de la app (detrás de las tarjetas). */
export type FondoId = 'solido' | 'degradado' | 'puntos' | 'cuadricula';

/** Redondeo de bordes de tarjetas y botones. */
export type RadioId = 'sutil' | 'estandar' | 'redondeado';

/** Densidad del layout (F3.52): spacing/padding SIN tocar la letra.
 *  `compacta` = más pedidos por pantalla · `comoda` = aire extra. */
export type DensidadId = 'compacta' | 'normal' | 'comoda';

/** Peso (grosor) de la letra (F3.52) — la "más negrita" pedida. */
export type PesoId = 'normal' | 'medio' | 'fuerte';

/** Tono/intensidad del color de la letra (F3.52). */
export type TonoTextoId = 'neutro' | 'intenso' | 'suave' | 'calido';

/** Configuración COMPLETA del tema — todo lo que el Estudio controla. */
export interface ConfigTema {
  /** Oscuro / Claro / Auto (teléfono) / Horario (por horas). */
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
  /** 🆕 F3.52: densidad del layout (spacing sin tocar la letra). */
  densidad: DensidadId;
  /** 🆕 F3.52: alto contraste (textos y bordes reforzados). */
  altoContraste: boolean;
  /** 🆕 F3.52: animaciones de la interfaz (false = todo estático). */
  animaciones: boolean;
  /** 🆕 F3.52: peso de la letra (normal / medio / fuerte). */
  peso: PesoId;
  /** 🆕 F3.52: tono de la letra (color / intensidad). */
  tonoTexto: TonoTextoId;
  /** 🆕 F3.52: a qué hora arranca el claro (modo horario). 0–23. */
  horaClaro: number;
  /** 🆕 F3.52: a qué hora arranca el oscuro (modo horario). 0–23. */
  horaOscuro: number;
}

/** Valores de fábrica — exactamente el look que tiene la app hoy
 *  (los campos F3.52 nuevos caen a su valor neutro). */
export const CONFIG_DEFECTO: ConfigTema = {
  modo: 'dark',
  acento: 'azul',
  fuente: 'sistema',
  escala: 1,
  fondo: 'solido',
  radio: 'estandar',
  densidad: 'normal',
  altoContraste: false,
  animaciones: true,
  peso: 'normal',
  tonoTexto: 'neutro',
  horaClaro: 6,
  horaOscuro: 18,
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

/** Rango permitido de las horas del modo horario. */
export const HORA_MIN = 0;
export const HORA_MAX = 23;
