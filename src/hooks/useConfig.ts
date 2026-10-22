// ═══════════════════════════════════════════════════════════
// 🏦 HOOK useConfig - RiderTrack V2
// Maneja la configuración de cuentas bancarias
//
// 🩺 FASE AJ (v0.11.9): el hook ahora SABE de dónde vino la config
// ('servidor' | 'cache' | 'defaults-error') y puede RECARGARLA —
// la pantalla de Mi QR muestra un aviso honesto en vez de un
// vacío que parece «QR borrado». También recuerda si el último
// guardado llegó al servidor o quedó local (optimista).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import {
  ConfigCuentas,
  CONFIG_CUENTAS_DEFAULT,
  FuenteOperacion,
  cargarConfigCuentas,
  guardarConfigCuentas,
  estadoCargaConfig,
} from '../services/firestore';
import { useAuth } from './useAuth';

/** De dónde salió la config que está en pantalla */
export type FuenteConfig = 'cargando' | 'servidor' | 'cache' | 'vacio' | 'error';

/** Timestamp → ms (espejo del helper del servicio, para comparar frescura) */
function tiempoDe(v: any): number {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === 'function') return v.toDate().getTime();
    if (v instanceof Date) return v.getTime();
    const t = new Date(String(v)).getTime();
    return Number.isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}

export function useConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ConfigCuentas>(CONFIG_CUENTAS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  // FASE AJ: estado honesto de la carga + nonce para recargar a pedido
  const [fuente, setFuente] = useState<FuenteConfig>('cargando');
  const [errorCarga, setErrorCarga] = useState('');
  const [nonce, setNonce] = useState(0);
  const [ultimoGuardado, setUltimoGuardado] = useState<FuenteOperacion | null>(null);

  // 🌤️ FASE AL: la CARRERA CORTA del servicio avisa por evento cuando
  // la versión del servidor es MÁS NUEVA que la caché que se está
  // mostrando — la pantalla se refresca SOLA (el QR guardado en el
  // otro cel aparece sin reabrir la app). Nunca pisa un dato más nuevo
  // (guardado propio incluido): solo aplica si actualizadoEn creció.
  useEffect(() => {
    const alRefrescar = (e: Event) => {
      const nueva = (e as CustomEvent)?.detail as ConfigCuentas | undefined;
      if (!nueva) return;
      setConfig((prev) =>
        tiempoDe((nueva as any)?.actualizadoEn) > tiempoDe((prev as any)?.actualizadoEn) ? nueva : prev
      );
      setFuente('servidor');
      setErrorCarga('');
    };
    window.addEventListener('config-empresa:refrescada', alRefrescar as EventListener);
    return () => window.removeEventListener('config-empresa:refrescada', alRefrescar as EventListener);
  }, []);

  useEffect(() => {
    if (!user) {
      setConfig(CONFIG_CUENTAS_DEFAULT);
      setLoading(false);
      setFuente('vacio');
      setErrorCarga('');
      return;
    }

    let vivo = true;
    setLoading(true);
    setFuente('cargando');
    setErrorCarga('');
    cargarConfigCuentas(user.uid)
      .then((configData) => {
        if (!vivo) return;
        setConfig(configData);
        setLoading(false);
        // FASE AJ: el servicio marca QUÉ pasó — 'error' = ni caché
        // ni servidor contestaron (red débil): la UI lo AVISA en
        // vez de mostrar un vacío mudo («QR borrado»).
        setFuente(estadoCargaConfig.fuente);
        setErrorCarga(estadoCargaConfig.error || '');
      })
      .catch((err) => {
        if (!vivo) return;
        console.error('Error cargando config:', err);
        setConfig(CONFIG_CUENTAS_DEFAULT);
        setLoading(false);
        setFuente('error');
        setErrorCarga(String(err?.message || err));
      });
    return () => { vivo = false; };
  }, [user, nonce]);

  /** FASE AJ: vuelve a bajar la config del servidor (botón 🔄) */
  const recargar = useCallback(() => setNonce(n => n + 1), []);

  /** FASE AJ: guarda y devuelve CÓMO terminó — 'servidor' (llegó de
 * verdad) o 'local' (queda encolado en el SDK — optimista, avisar).
 * En errores de verdad REVIENTA (como siempre). */
  const guardar = useCallback(async (nuevaConfig: ConfigCuentas): Promise<FuenteOperacion> => {
    if (!user) return 'local';
    setGuardando(true);
    try {
      const como = await guardarConfigCuentas(user.uid, nuevaConfig);
      setConfig(nuevaConfig);
      setUltimoGuardado(como); // 'servidor' | 'local'
      return como;
    } catch (e: any) {
      console.error('Error guardando config:', e);
      setUltimoGuardado('local');
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
    // FASE AJ
    fuente,
    errorCarga,
    recargar,
    ultimoGuardado,
  };
}
