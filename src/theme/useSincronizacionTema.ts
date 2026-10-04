// ═══════════════════════════════════════════════════════════
// 🎨 ESTUDIO DE TEMAS — RiderTrack V2 · F3.52
// Módulo: useSincronizacionTema.ts — enganche sync ↔ sesión
// ═══════════════════════════════════════════════════════════
// Se llama UNA vez en App.tsx con el uid de la sesión:
//   const { user } = useAuth();
//   useSincronizacionTema(user?.uid);
//
// Qué hace:
//   1) AL INICIAR SESIÓN: baja el tema de Firestore. Si existe,
//      gana el de la nube (así un rider que reinstala o cambia
//      de celular recupera su look automáticamente).
//   2) AL CAMBIAR ALGO DEL TEMA: lo sube con debounce de 900 ms
//      (mover el slider no dispara 50 escrituras).
//   3) SIN SESIÓN: no hace nada — el tema vive en localStorage
//      exactamente como en la F3.51 (cero regresión).
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useTema } from './useTema';
import { cargarTemaRemoto, guardarTemaRemoto } from './remoto';

/** Milisegundos de espera antes de subir un cambio (debounce). */
const DEMORA_SUBIDA_MS = 900;

export interface EstadoSincronizacion {
  /** ¿Hay sesión activa (y por tanto respaldo en la nube)? */
  activo: boolean;
  /** ¿Ya terminó el intento inicial de bajar el tema? */
  listo: boolean;
}

export function useSincronizacionTema(uid?: string): EstadoSincronizacion {
  const { config, actualizarConfig } = useTema();
  const [listo, setListo] = useState(false);

  // 1) Al arrancar sesión (o cambiar de usuario): bajar el tema
  //    remoto UNA vez. Si la nube no tiene nada, el local manda.
  useEffect(() => {
    if (!uid) {
      setListo(true);
      return;
    }
    let vivo = true;
    setListo(false);
    cargarTemaRemoto(uid).then((remoto) => {
      if (!vivo) return;
      if (remoto) actualizarConfig(remoto);
      setListo(true);
    });
    return () => {
      vivo = false;
    };
    // actualizarConfig es estable (useCallback) — no relanza el pull
  }, [uid, actualizarConfig]);

  // 2) Cada cambio del tema: subirlo con debounce. El pull inicial
  //    dispara esto una vez (sube lo mismo que bajó — inofensivo).
  useEffect(() => {
    if (!uid) return;
    const t = window.setTimeout(() => {
      void guardarTemaRemoto(uid, config);
    }, DEMORA_SUBIDA_MS);
    return () => window.clearTimeout(t);
  }, [uid, config]);

  return { activo: !!uid, listo };
}
