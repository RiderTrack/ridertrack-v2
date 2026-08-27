// ═══════════════════════════════════════════════════════════
// ⏱️ CRONÓMETRO DE RUTA — Fase 1.5
// Dos presentaciones del mismo estado global:
//   • CronometroCard   → tarjeta completa (viva en "GPS del
//                        Motorizado"): play/pausa/detener, toggle
//                        de aviso silencioso y explicación del bot.
//   • CronometroPill   → pill flotante que aparece abajo a la
//                        derecha cuando el cronómetro corre y
//                        navegas por otras pantallas (como el
//                        temporizador de Circuit).
// La sincronización con el bot (ruta_activa/{uid}.cronometro)
// va por sincronizarCronometroAlBot.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Play, Pause, Square, Timer, BellOff, Bell, Bot, Loader2, AlertTriangle } from 'lucide-react';
import { useCronometroRuta, formatearTiempo } from '../hooks/useCronometro';

type SyncFn = (e: {
  fase: 'idle' | 'corriendo' | 'pausado';
  iniciadoAt: string | null;
  acumuladoSeg: number;
  avisoSilencioso: boolean;
}) => Promise<void>;

interface CardProps {
  onSync: SyncFn;
  sincronizando?: boolean;
}

export const CronometroCard: React.FC<CardProps> = ({ onSync }) => {
  const { estado, corriendo, activo, segundos, errorSync, arrancar, pausar, reanudar, detener, alternarAviso } =
    useCronometroRuta();

  return (
    <div className="rounded-2xl bg-slate-800 border border-slate-700 shadow-xl overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-700/70 bg-gradient-to-r from-emerald-500/10 to-transparent">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              activo
                ? 'bg-emerald-500/20 border-emerald-500/40 rt-pulso'
                : 'bg-slate-700/60 border-slate-600'
            }`}
          >
            <Timer className={`w-5 h-5 ${activo ? 'text-emerald-400' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white">Cronómetro de ruta</h3>
            <p className="text-[10px] text-slate-400 truncate">
              {estado.fase === 'idle' && 'Detenido — arráncalo al salir a repartir'}
              {estado.fase === 'corriendo' && 'Corriendo — el bot sabe que estás en ruta'}
              {estado.fase === 'pausado' && 'En pausa (almuerzo, trámite…)'}
            </p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${
            estado.fase === 'corriendo'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : estado.fase === 'pausado'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              : 'bg-slate-700/50 border-slate-600 text-slate-400'
          }`}
        >
          {estado.fase === 'corriendo' ? '● En ruta' : estado.fase === 'pausado' ? '⏸ Pausa' : '■ Detenido'}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Display del tiempo */}
        <div className="flex items-center justify-center">
          <div
            className={`px-8 py-4 rounded-2xl border-2 font-mono font-black text-4xl sm:text-5xl tabular-nums tracking-wider transition-all ${
              estado.fase === 'corriendo'
                ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                : estado.fase === 'pausado'
                ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                : 'border-slate-600 text-slate-300 bg-slate-900/60'
            }`}
          >
            {formatearTiempo(segundos)}
          </div>
        </div>

        {/* Controles */}
        <div className="grid grid-cols-2 gap-2">
          {estado.fase !== 'corriendo' ? (
            <button
              onClick={() => (estado.fase === 'pausado' ? reanudar(onSync) : arrancar(onSync))}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.97]"
            >
              <Play className="w-4 h-4" />
              {estado.fase === 'pausado' ? 'Reanudar' : 'Arrancar'}
            </button>
          ) : (
            <button
              onClick={() => pausar(onSync)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-600/25 transition-all active:scale-[0.97]"
            >
              <Pause className="w-4 h-4" /> Pausar
            </button>
          )}
          <button
            onClick={() => detener(onSync)}
            disabled={!activo}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-red-600 text-white font-bold text-sm transition-all active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-slate-700"
          >
            <Square className="w-4 h-4" /> Detener
          </button>
        </div>

        {/* Aviso silencioso */}
        <button
          onClick={() => alternarAviso(onSync)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.99] ${
            estado.avisoSilencioso
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-slate-900/60 border-slate-700'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              estado.avisoSilencioso
                ? 'bg-emerald-500/20 border-emerald-500/40'
                : 'bg-slate-700/60 border-slate-600'
            }`}
          >
            {estado.avisoSilencioso ? (
              <Bell className="w-5 h-5 text-emerald-400" />
            ) : (
              <BellOff className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">Aviso silencioso al bot</p>
            <p className="text-[10px] text-slate-400 leading-snug">
              {estado.avisoSilencioso
                ? 'Encendido: el bot saluda al cliente por su nombre y le dice su pedido'
                : 'Apagado: el bot responde genérico ("hola cliente")'}
            </p>
          </div>
          <div
            className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
              estado.avisoSilencioso ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                estado.avisoSilencioso ? 'translate-x-5' : ''
              }`}
            />
          </div>
        </button>

        {/* Nota del bot */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
          <Bot className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-300 leading-relaxed">
            Con el cronómetro activo, RudyBot reconoce al cliente que escribe por WhatsApp y
            responde <b className="text-indigo-300">"Hola José, tu pedido es…"</b> con su número
            de parada y su monto. Funciona porque el estado se publica en{' '}
            <code className="text-[9px] bg-slate-900/80 px-1 py-0.5 rounded">ruta_activa</code> junto
            a tu lista de clientes.
          </p>
        </div>

        {errorSync && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-[10px] text-amber-300">
              El cronómetro corre normal, pero no se pudo avisar al bot: {errorSync}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 💊 PILL FLOTANTE — visible en cualquier pantalla mientras corre
// ═══════════════════════════════════════════════════════════

interface PillProps {
  onSync: SyncFn;
  onAbrir?: () => void;
}

export const CronometroPill: React.FC<PillProps> = ({ onSync, onAbrir }) => {
  const { estado, activo, segundos, pausar, reanudar, detener } = useCronometroRuta();

  if (!activo) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[90] flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 shadow-2xl shadow-emerald-900/20">
      <button
        onClick={onAbrir}
        className="flex items-center gap-2 min-w-0"
        title="Abrir GPS del Motorizado"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            estado.fase === 'corriendo' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`}
        />
        <span className="font-mono font-black text-sm tabular-nums text-emerald-400">
          {formatearTiempo(segundos)}
        </span>
        {estado.avisoSilencioso && <Timer className="w-3.5 h-3.5 text-emerald-500/70 hidden sm:block" />}
      </button>
      <div className="flex items-center gap-1">
        {estado.fase === 'corriendo' ? (
          <button
            onClick={() => pausar(onSync)}
            className="p-1.5 rounded-xl hover:bg-slate-700/80 text-amber-400 transition-colors"
            title="Pausar cronómetro"
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => reanudar(onSync)}
            className="p-1.5 rounded-xl hover:bg-slate-700/80 text-emerald-400 transition-colors"
            title="Reanudar cronómetro"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => detener(onSync)}
          className="p-1.5 rounded-xl hover:bg-slate-700/80 text-red-400 transition-colors"
          title="Detener cronómetro"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
