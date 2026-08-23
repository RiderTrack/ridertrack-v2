// ═══════════════════════════════════════════════════════════
// 🏦 HOOK useConfig - RiderTrack V2
// Maneja la configuración de cuentas bancarias
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import {
  ConfigCuentas,
  CONFIG_CUENTAS_DEFAULT,
  cargarConfigCuentas,
  guardarConfigCuentas,
} from '../services/firestore';
import { useAuth } from './useAuth';

export function useConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ConfigCuentas>(CONFIG_CUENTAS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!user) {
      setConfig(CONFIG_CUENTAS_DEFAULT);
      setLoading(false);
      return;
    }

    setLoading(true);
    cargarConfigCuentas(user.uid)
      .then((configData) => {
        setConfig(configData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando config:', err);
        setConfig(CONFIG_CUENTAS_DEFAULT);
        setLoading(false);
      });
  }, [user]);

  const guardar = useCallback(async (nuevaConfig: ConfigCuentas) => {
    if (!user) return;
    setGuardando(true);
    try {
      await guardarConfigCuentas(user.uid, nuevaConfig);
      setConfig(nuevaConfig);
      return true;
    } catch (e: any) {
      console.error('Error guardando config:', e);
      throw e;
    } finally {
      setGuardando(false);
    }
  }, [user]);

  const actualizarSeccion = useCallback((seccion: keyof ConfigCuentas, datos: any) => {
    setConfig(prev => ({
      ...prev,
      [seccion]: { ...prev[seccion], ...datos },
    }));
  }, []);

  return {
    config,
    loading,
    guardando,
    guardar,
    actualizarSeccion,
  };
}
