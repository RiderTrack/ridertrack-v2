// ═══════════════════════════════════════════════════════════
// 🎨 ESTUDIO DE TEMAS — RiderTrack V2 · F3.51
// Módulo: TemaProvider.tsx — contexto React (estado vivo)
// ═══════════════════════════════════════════════════════════
// Monta UNA vez en main.tsx alrededor de <App/>. Mantiene la
// config en estado, la aplica al <html> al instante (sin botón
// "aplicar": se ve el cambio en vivo) y la guarda en localStorage.
// También escucha el modo AUTO del teléfono.
// ═══════════════════════════════════════════════════════════

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  aplicarTemaEnDocumento,
  cargarTemaGuardado,
  guardarTema,
  normalizarConfig,
  resolverModo,
} from './motor';
import { CONFIG_DEFECTO, type ConfigTema } from './tipos';
import type { PresetTema } from './catalogo';
import type { ThemeMode } from '../types';

export interface ContextoTema {
  /** Config completa actual (persistida). */
  config: ConfigTema;
  /** Modo ya resuelto (auto → según el teléfono). 'dark'|'light'. */
  modoEfectivo: ThemeMode;
  /** Cambia campos puntuales: actualizarConfig({ acento: 'rosa' }). */
  actualizarConfig: (parcial: Partial<ConfigTema>) => void;
  /** Aplica un preset completo de un toque. */
  aplicarPreset: (preset: PresetTema) => void;
  /** Vuelve a los valores de fábrica (look de la F3.50). */
  restaurarFabrica: () => ConfigTema;
  /** ¿El teléfono prefiere claro? (para el modo auto). */
  sistemaPrefiereClaro: boolean;
}

export const TemaCtx = createContext<ContextoTema | null>(null);

export const TemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ConfigTema>(() =>
    typeof window === 'undefined'
      ? { ...CONFIG_DEFECTO }
      : cargarTemaGuardado(window.localStorage)
  );

  const [sistemaPrefiereClaro, setSistemaPrefiereClaro] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: light)').matches;
    } catch {
      return false;
    }
  });

  // Aplicar + persistir en cada cambio (instantáneo)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    aplicarTemaEnDocumento(config, document);
    if (typeof window !== 'undefined') guardarTema(config, window.localStorage);
  }, [config]);

  // Modo AUTO: seguir al teléfono en vivo (si activas claro en
  // el sistema mientras la app está abierta, cambia sola)
  useEffect(() => {
    if (config.modo !== 'auto' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    setSistemaPrefiereClaro(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSistemaPrefiereClaro(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [config.modo]);

  const actualizarConfig = useCallback((parcial: Partial<ConfigTema>) => {
    setConfig((prev) =>
      // normalizarConfig valida TODO (escala dentro de rango, ids
      // del catálogo) — nunca entra basura al documento
      normalizarConfig({ ...prev, ...parcial })
    );
  }, []);

  const aplicarPreset = useCallback((preset: PresetTema) => {
    setConfig({ ...preset.config });
  }, []);

  const restaurarFabrica = useCallback(() => {
    const fabrica = { ...CONFIG_DEFECTO };
    setConfig(fabrica);
    return fabrica;
  }, []);

  const modoEfectivo = useMemo(
    () => resolverModo(config.modo, sistemaPrefiereClaro),
    [config.modo, sistemaPrefiereClaro]
  );

  const valor = useMemo<ContextoTema>(
    () => ({
      config,
      modoEfectivo,
      actualizarConfig,
      aplicarPreset,
      restaurarFabrica,
      sistemaPrefiereClaro,
    }),
    [config, modoEfectivo, actualizarConfig, aplicarPreset, restaurarFabrica, sistemaPrefiereClaro]
  );

  return <TemaCtx.Provider value={valor}>{children}</TemaCtx.Provider>;
};
