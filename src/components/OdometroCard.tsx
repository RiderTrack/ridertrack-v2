// ═══════════════════════════════════════════════════════════
// 🛣️ ODÓMETRO GPS — UI (Fase 3.35 · fix 3.37)
// Tres piezas:
//   · MotorOdometro    → componente INVISIBLE que App.tsx monta
//                        1 vez: abre el GPS mientras el crono
//                        de ruta corre. Cuenta en TODAS las tabs.
//   · OdometroCard     → tarjeta en vivo para Seguimiento de
//                        ruta: km de hoy, velocidad, calibración
//                        (F3.37: por viaje con Waze + ayuda +
//                        pantalla viva + km recuperados 🌉).
//   · OdometroMenuStats→ bloque compacto Hoy/Ayer/7d/Total para
//                        el menú hamburguesa (Sidebar).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Gauge, Settings2, RotateCcw, RefreshCw, Satellite, Check, HelpCircle, Zap, Route } from 'lucide-react';
import {
  snapshotOdometro,
  suscribirOdometro,
  arrancarMotorOdometro,
  ajustarFactor,
  reiniciarDia,
  recargarStatsRemotas,
  alternarPantallaViva,
  pantallaViva,
  formatearKm,
  StatsOdometro,
} from '../services/odometro';

/** Hook en vivo del odómetro (misma snapshot hasta que cambia el tick) */
function useStatsOdometro(): StatsOdometro {
  return useSyncExternalStore(suscribirOdometro, snapshotOdometro);
}

/** Hace re-render cada N ms (para "señal hace Xs" y no depender del tick) */
function useTick(ms: number): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

// ═══════════════════════════════════════════════════════════
// ⚙️ MOTOR — montar 1 vez en App.tsx (invisible)
// ═══════════════════════════════════════════════════════════

export const MotorOdometro: React.FC<{ uid?: string | null }> = ({ uid }) => {
  useEffect(() => {
    if (!uid) return;
    const detener = arrancarMotorOdometro(uid);
    return detener;
  }, [uid]);
  return null;
};

// ═══════════════════════════════════════════════════════════
// 🛣️ TARJETA — Seguimiento de ruta
// ═══════════════════════════════════════════════════════════

interface OdometroCardProps {
  uid?: string | null;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const OdometroCard: React.FC<OdometroCardProps> = ({ uid, onShowToast }) => {
  const stats = useStatsOdometro();
  useTick(4000); // refresca "señal hace Xs"
  const [calibrAbierto, setCalibrAbierto] = useState(false);
  const [ayudaAbierto, setAyudaAbierto] = useState(false);
  const [factorEdit, setFactorEdit] = useState('1.00');
  const [viajeKm, setViajeKm] = useState('');
  const [factorSugerido, setFactorSugerido] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [pantalla, setPantalla] = useState(false);
  const inicializado = useRef(false);

  // Estado del wake lock al montar (persistido por uid)
  useEffect(() => {
    if (uid) setPantalla(pantallaViva(uid));
  }, [uid]);

  // Al abrir el panel, cargar el factor actual
  useEffect(() => {
    if (calibrAbierto && !inicializado.current) {
      setFactorEdit(stats.factor.toFixed(2));
      inicializado.current = true;
    }
    if (!calibrAbierto) {
      inicializado.current = false;
      setFactorSugerido(null);
    }
  }, [calibrAbierto, stats.factor]);

  const haceSenal = stats.ultimaSenalAt
    ? Math.floor((Date.now() - stats.ultimaSenalAt) / 1000)
    : null;
  const sinSenal = stats.contando && (haceSenal == null || haceSenal > 45);

  const abrirCalibr = () => {
    setFactorEdit(stats.factor.toFixed(2));
    setAyudaAbierto(false);
    setCalibrAbierto(true);
  };

  // 🌉 MODO 1 — calibración POR VIAJE: el rider pone los km
  // reales del viaje (Waze / marcador de la moto) y la app
  // calcula el factor sola. F3.37.
  const calcularPorViaje = () => {
    const reales = parseFloat(viajeKm.replace(',', '.'));
    if (isNaN(reales) || reales <= 0) {
      onShowToast?.('Pon los km reales', 'Ej: 12.5 — lo que dice Waze o tu marcador', 'warning');
      return;
    }
    if (stats.hoyCrudoM < 500) {
      onShowToast?.('Muy pocos km hoy', 'Anda un tramo primero (mínimo 0.5 km) y vuelve a calibrar', 'warning');
      return;
    }
    const f = Math.round(((reales * 1000) / stats.hoyCrudoM) * 100) / 100;
    const fClamp = Math.min(2, Math.max(0.5, f));
    setFactorSugerido(fClamp);
    setFactorEdit(fClamp.toFixed(2));
    if (f !== fClamp) {
      onShowToast?.('Factor recortado', `Calculado ×${f.toFixed(2)} — el rango permitido es 0.50–2.00`, 'info');
    }
  };

  const guardarFactor = async () => {
    if (!uid) return;
    const f = parseFloat(factorEdit.replace(',', '.'));
    if (isNaN(f) || f < 0.5 || f > 2) {
      onShowToast?.('Factor inválido', 'Debe estar entre 0.50 y 2.00 (ej: 1.07)', 'warning');
      return;
    }
    setGuardando(true);
    try {
      const aplicado = await ajustarFactor(uid, f);
      setCalibrAbierto(false);
      onShowToast?.(
        '🛣️ Calibración guardada',
        `Factor ×${aplicado.toFixed(2)} — todo tu kilometraje se recalculó`,
        'success'
      );
    } catch {
      onShowToast?.('No se pudo guardar', 'Se guardó en el teléfono — reintenta con internet', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  // 🔆 PANTALLA VIVA — evita que la pantalla se apague mientras
  // el cronómetro corre (el GPS sigue fluyendo → conteo exacto).
  const togglePantalla = () => {
    if (!uid) return;
    const v = alternarPantallaViva(uid);
    setPantalla(v);
    onShowToast?.(
      v ? '🔆 Pantalla viva ON' : 'Pantalla viva OFF',
      v
        ? 'Mientras el cronómetro corra, la pantalla no se apaga (gasta más batería)'
        : 'La pantalla puede apagarse — los km se recuperan con puentes',
      v ? 'success' : 'info'
    );
  };

  const reiniciarHoy = async () => {
    if (!uid) return;
    if (!confirm('⚠️ ¿Reiniciar el odómetro de HOY?\n\nLos km de hoy vuelven a 0 (el histórico también se corrige).\nÚsalo solo si algo contó mal.')) return;
    await reiniciarDia(uid);
    onShowToast?.('Odómetro reiniciado', 'Hoy en 0 km — el histórico quedó corregido', 'info');
  };

  const kmHoy = formatearKm(stats.hoyM);
  const kmCrudos = stats.factor !== 1 ? stats.hoyCrudoM : null;
  const kmPuente = stats.puenteM >= 200 ? formatearKm(stats.puenteM) : null;

  return (
    <div className={`rounded-2xl border p-3.5 transition-colors ${
      stats.contando
        ? 'border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 via-slate-900/80 to-slate-900/80'
        : 'border-slate-700/60 bg-slate-900/60'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
          stats.contando ? 'bg-cyan-500/20 border-cyan-500/40' : 'bg-slate-800 border-slate-700'
        }`}>
          <Gauge className={`w-5 h-5 ${stats.contando ? 'text-cyan-400' : 'text-slate-400'}`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${
            stats.contando ? 'text-cyan-300' : 'text-slate-400'
          }`}>
            <Satellite className="w-3 h-3" />
            Odómetro GPS · hoy
          </p>
          <p className="text-3xl font-black text-white leading-tight tabular-nums">
            {kmHoy}
            {stats.contando && stats.velocidadKmh > 0 && (
              <span className="ml-2 text-sm font-bold text-cyan-400">{stats.velocidadKmh} km/h</span>
            )}
          </p>
          <p className="text-xs text-slate-400">
            {stats.contando ? (
              sinSenal ? (
                <span className="text-amber-400 font-bold">⚠️ sin señal GPS (ubícate al aire libre)</span>
              ) : (
                <>contando · señal hace {haceSenal}s</>
              )
            ) : (
              <span title="El odómetro cuenta mientras el cronómetro de ruta está activo">
                ⏸ pausado — inicia el cronómetro en Mi Ruta
              </span>
            )}
            {stats.factor !== 1 && kmCrudos != null && (
              <span className="text-slate-500"> · sin calibrar: {(kmCrudos / 1000).toFixed(1)} km ×{stats.factor.toFixed(2)}</span>
            )}
            {kmPuente && (
              <span className="text-cyan-500/80" title="Km rescatados de huecos de señal GPS (app en segundo plano o pantalla apagada)">
                {' '}· 🌉 {kmPuente} recuperados sin señal
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={abrirCalibr}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-300 transition-all active:scale-95"
            title="Calibrar contra el marcador de tu moto"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Calibrar
          </button>
          <button
            onClick={togglePantalla}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all active:scale-95 ${
              pantalla
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-400'
            }`}
            title={pantalla ? 'Pantalla viva activa: la pantalla no se apaga mientras cuenta km' : 'Activar pantalla viva (conteo más exacto, más batería)'}
          >
            <Zap className="w-3.5 h-3.5" />
            {pantalla ? 'Viva ON' : 'Viva'}
          </button>
          <button
            onClick={reiniciarHoy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-900/40 border border-slate-700 hover:border-red-500/40 text-[10px] font-bold text-slate-400 hover:text-red-300 transition-all active:scale-95"
            title="Reiniciar el conteo de hoy"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar
          </button>
        </div>
      </div>

      {/* Total histórico */}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-semibold">
          total histórico: <span className="text-slate-300 tabular-nums font-bold">{formatearKm(stats.totalM)}</span>
        </span>
        <span className="text-[10px] text-slate-500">
          🍽️ los km no suman mientras el refrigerio pausa el cronómetro
        </span>
      </div>

      {/* Panel de calibración F3.37: por viaje (auto) + manual + ayuda */}
      {calibrAbierto && (
        <div className="mt-2.5 rounded-xl bg-slate-800/80 border border-slate-700 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
              Calibración
              {factorSugerido != null && (
                <span className="text-cyan-300 font-mono">sugerido: ×{factorSugerido.toFixed(2)}</span>
              )}
            </p>
            <button
              onClick={() => setAyudaAbierto((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-400 transition-all"
              title="Cómo funciona la calibración"
            >
              <HelpCircle className="w-3 h-3" />
              ¿Cómo calibrar?
            </button>
          </div>

          {ayudaAbierto && (
            <div className="rounded-lg bg-slate-900/70 border border-slate-700/60 p-2 text-[10px] text-slate-400 leading-relaxed space-y-1">
              <p><b className="text-slate-300">¿Qué es?</b> La app une puntos GPS con líneas rectas; en
              ciudad eso pierde un poquito (las calles curvan y la app queda en segundo plano). El{' '}
              <b className="text-cyan-300">factor</b> corrige eso: km reales = km de la app × factor.</p>
              <p><b className="text-slate-300">Paso 1.</b> Arranca el cronómetro y anda tu jornada normal
              (Waze abierto si quieres — los km sin señal se recuperan 🌉).</p>
              <p><b className="text-slate-300">Paso 2.</b> Al final mira los km REALES (Waze o el marcador
              de la moto) y ponlos arriba: <b className="text-slate-300">km reales ÷ km de la app = factor</b>.</p>
              <p><b className="text-slate-300">Paso 3.</b> Guarda. El factor recalcula TODO el histórico y
              también los <b className="text-blue-300">recordatorios de mantenimiento</b> (usan estos km).</p>
              <p className="text-slate-500">Ajusta UNA vez, compara una semana y déjalo fijo.</p>
            </div>
          )}

          {/* 🌉 MODO 1 — por viaje (recomendado) */}
          <div className="flex items-center gap-2 flex-wrap">
            <Route className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <input
              type="number"
              inputMode="decimal"
              min="0.1"
              step="0.1"
              placeholder="km reales de hoy (Waze)"
              value={viajeKm}
              onChange={(e) => {
                setViajeKm(e.target.value);
                setFactorSugerido(null);
              }}
              className="w-40 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white placeholder:text-slate-600 placeholder:font-normal focus:outline-none focus:border-cyan-500 tabular-nums"
            />
            <button
              onClick={calcularPorViaje}
              className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-all active:scale-95"
              title="Calcula el factor solo: km reales ÷ km de la app"
            >
              Calcular
            </button>
            <span className="text-[10px] text-slate-500">
              hoy la app lleva <b className="text-slate-300 tabular-nums">{(stats.hoyCrudoM / 1000).toFixed(1)} km</b> sin calibrar
            </span>
          </div>

          {/* MODO 2 — manual */}
          <div className="flex items-center gap-2 flex-wrap border-t border-slate-700/60 pt-2">
            <input
              type="number"
              min="0.50"
              max="2.00"
              step="0.01"
              value={factorEdit}
              onChange={(e) => setFactorEdit(e.target.value)}
              className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-cyan-500 tabular-nums"
            />
            <div className="flex flex-wrap gap-1.5">
              {['0.95', '1.00', '1.05', '1.10', '1.15', '1.20'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFactorEdit(f)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
                    factorEdit === f
                      ? 'bg-cyan-600 border-cyan-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  ×{f}
                </button>
              ))}
            </div>
            <button
              onClick={guardarFactor}
              disabled={guardando}
              className="ml-auto flex items-center gap-1 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>

          <p className="text-[10px] text-slate-500 leading-snug">
            El factor recalcula TODO el histórico (no solo hoy). Ajusta una vez, compara contra tu
            marcador por una semana y déjalo fijo.
          </p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 📊 STATS — bloque del menú hamburguesa (Sidebar)
// ═══════════════════════════════════════════════════════════

interface OdometroMenuStatsProps {
  uid?: string | null;
  /** Sidebar colapsado → mini versión con solo el km de hoy */
  colapsado?: boolean;
}

export const OdometroMenuStats: React.FC<OdometroMenuStatsProps> = ({ uid, colapsado }) => {
  const stats = useStatsOdometro();
  const [cargando, setCargando] = useState(true);

  // Al montar: traer los días viejos de Firestore (ayer/7d/total)
  useEffect(() => {
    if (!uid) { setCargando(false); return; }
    let vivo = true;
    recargarStatsRemotas(uid).finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [uid]);

  if (colapsado) {
    return (
      <div className="px-3 py-2 border-t border-slate-800" title={`Odómetro: hoy ${formatearKm(stats.hoyM)}`}>
        <div className="flex flex-col items-center gap-0.5">
          <Gauge className={`w-4 h-4 ${stats.contando ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span className="text-[11px] font-black text-white tabular-nums leading-none">
            {(stats.hoyM / 1000).toFixed(1)}
          </span>
          <span className="text-[8px] font-bold text-slate-500 uppercase">km hoy</span>
        </div>
      </div>
    );
  }

  const fila = (etiqueta: string, valor: string, destacado = false) => (
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-[11px] ${destacado ? 'text-slate-200 font-bold' : 'text-slate-400'}`}>{etiqueta}</span>
      <span className={`text-[11px] font-bold tabular-nums ${destacado ? 'text-cyan-300' : 'text-slate-300'}`}>
        {cargando ? '…' : valor}
      </span>
    </div>
  );

  return (
    <div className="mx-2 mb-2 rounded-xl border border-slate-800 bg-slate-800/40 p-2.5 group/odo">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
          <Gauge className={`w-3 h-3 ${stats.contando ? 'text-cyan-400' : 'text-slate-500'}`} />
          Kilometraje
          {stats.contando && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-0.5" />}
        </span>
        <button
          onClick={async () => {
            if (!uid) return;
            setCargando(true);
            await recargarStatsRemotas(uid);
            setCargando(false);
          }}
          className="p-1 rounded text-slate-600 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors opacity-0 group-hover/odo:opacity-100"
          title="Recargar desde la nube"
        >
          <RefreshCw className={`w-3 h-3 ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {fila('Hoy', formatearKm(stats.hoyM), true)}
      {fila('Ayer', formatearKm(stats.ayerM))}
      {fila('7 días', formatearKm(stats.dias7M))}
      {fila('Total', formatearKm(stats.totalM))}
      <p className="text-[8px] text-slate-600 leading-tight mt-1">
        cuenta con el cronómetro de ruta activo · calibra en Seguimiento de ruta
      </p>
    </div>
  );
};
