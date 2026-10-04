// ═══════════════════════════════════════════════════════════
// 🎨 ESTUDIO DE TEMAS — RiderTrack V2 · F3.51
// Módulo: useTema.ts — hook público de acceso
// ═══════════════════════════════════════════════════════════
// Úsalo en cualquier componente:
//   const { config, modoEfectivo, actualizarConfig } = useTema();
// Si se usa fuera del provider lanza error claro (no silencioso).
// ═══════════════════════════════════════════════════════════

import { useContext } from 'react';
import { TemaCtx, type ContextoTema } from './TemaProvider';

export function useTema(): ContextoTema {
  const ctx = useContext(TemaCtx);
  if (!ctx) {
    throw new Error(
      'useTema() debe usarse dentro de <TemaProvider> (montalo en main.tsx alrededor de <App/>)'
    );
  }
  return ctx;
}
