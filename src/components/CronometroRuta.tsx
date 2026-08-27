// ═══════════════════════════════════════════════════════════
// ⏱ CRONÓMETRO DE RUTA — AVISO SILENCIOSO AL BOT (Fase 2.2)
// Recuperado del Rider modular (togCronometro/publicarRutaActiva):
//
//   ▶ INICIAR  → publica la ruta completa en
//     ruta_activa/{UID_BOT} con activa:true + rider + clientes.
//     Desde ese momento, cuando un cliente te escriba por
//     WhatsApp, el BOT LO RECONOCE por su número y le habla
//     por su nombre ("Hola José, tu pedido es…") — el aviso
//     silencioso. También dice por voz cuántos pedidos tienes.
//
//   ⏸ PAUSAR / ▶ CONTINUAR → solo pausa el reloj (el bot
//     sigue viendo la ruta activa).
//
//   ⏹ TERMINAR → marca activa:false → el bot vuelve al modo
//     genérico ("Hola cliente…") y el reloj vuelve a 00:00.
//
// El estado del reloj sobrevive recargas (localStorage, igual
// que el cronómetro del modular).
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Bot, Loader2, TimerReset } from 'lucide-react';
import { Cliente, iniciarRutaConBot, finalizarRutaActivaBot } from '../services/firestore';

interface CronometroRutaProps {
  uid?: string | null;
  clientes: Cliente[];
  riderNombre?: string;
  riderTelefono?: string;
  empresa?: string;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

interface CronoState {
  activo: boolean;
  inicio: number | null;    // epoch ms del último arranque
  acumulado: number;        // ms acumulados en pausas previas
}

const CRONO_KEY = (uid: string) => `rt_crono_${uid}`;

function formatear(ms: number): string {
  const totalSeg = Math.floor(ms / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const CronometroRuta: React.FC<CronometroRutaProps> = ({
  uid,
  clientes,
  riderNombre,
  riderTelefono,
  empresa,
  onShowToast,
}) => {
  const [crono, setCrono] = useState<CronoState>({ activo: false, inicio: null, acumulado: 0 });
  const [transcurrido, setTranscurrido] = useState(0);
  const [publicando, setPublicando] = useState(false);
  const intervaloRef = useRef<number | null>(null);

  // Restaurar estado del cronómetro al montar / cambiar de cuenta
  useEffect(() => {
    if (!uid) return;
    try {
      const raw = localStorage.getItem(CRONO_KEY(uid));
      if (raw) {
        const st = JSON.parse(raw) as CronoState;
        setCrono(st);
      } else {
        setCrono({ activo: false, inicio: null, acumulado: 0 });
      }
    } catch {
      setCrono({ activo: false, inicio: null, acumulado: 0 });
    }
  }, [uid]);

  // Guardar cada cambio de estado
  useEffect(() => {
    if (!uid) return;
    try {
      if (!crono.activo && crono.acumulado === 0) {
        localStorage.removeItem(CRONO_KEY(uid));
      } else {
        localStorage.setItem(CRONO_KEY(uid), JSON.stringify(crono));
      }
    } catch {}
  }, [crono, uid]);

  // Tick del reloj
  useEffect(() => {
    if (crono.activo && crono.inicio) {
      const tick = () => setTranscurrido(crono.acumulado + (Date.now() - crono.inicio!));
      tick();
      intervaloRef.current = window.setInterval(tick, 1000);
      return () => {
        if (intervaloRef.current) window.clearInterval(intervaloRef.current);
      };
    }
    setTranscurrido(crono.acumulado);
  }, [crono.activo, crono.inicio, crono.acumulado]);

  // ── ▶ INICIAR / ⏸ PAUSAR / ▶ CONTINUAR ──
  const handleToggle = async () => {
    if (!crono.activo) {
      const esInicioRuta = crono.acumulado === 0; // sin tiempo acumulado = arranque de ruta
      setCrono({ activo: true, inicio: Date.now(), acumulado: crono.acumulado });

      if (esInicioRuta) {
        // ── AVISO SILENCIOSO: publicar la ruta para que el bot
        //    reconozca a los clientes por su nombre ──
        if (clientes.length === 0) {
          onShowToast?.(
            '⏱️ Cronómetro iniciado',
            'Tu ruta está vacía — importa tu Excel para que el bot conozca a tus clientes',
            'warning'
          );
        } else {
          setPublicando(true);
          try {
            await iniciarRutaConBot(clientes, {
              nombre: riderNombre || 'Rider',
              telefono: riderTelefono || '',
              empresa: empresa || 'MATE',
            });
            onShowToast?.(
              '🤖 Bot activado — aviso silencioso',
              `El bot ya conoce a tus ${clientes.length} clientes: cuando te escriban por WhatsApp los saludará por su nombre`,
              'success'
            );
          } catch {
            onShowToast?.(
              '⏱️ Cronómetro iniciado',
              'No se pudo avisar al bot (revisa tu conexión). Vuelve a iniciar para reintentar.',
              'warning'
            );
          } finally {
            setPublicando(false);
          }
        }

        // ── Voz al iniciar la ruta (como el modular) ──
        const pendientes = clientes.filter((c) => c.st === 'pendiente' || !c.st).length;
        const msgVoz = `Ruta iniciada, tenés ${clientes.length} pedido${clientes.length === 1 ? '' : 's'}, ${pendientes} pendiente${pendientes === 1 ? '' : 's'}`;
        try {
          const TTS = (window as any).Capacitor?.Plugins?.TextToSpeech;
          if (TTS) {
            TTS.speak({ text: msgVoz, lang: 'es-PE', rate: 1.0, pitch: 1.0, volume: 1.0 }).catch(() => {});
          } else if (window.speechSynthesis) {
            const u = new SpeechSynthesisUtterance(msgVoz);
            u.lang = 'es-PE';
            u.rate = 0.95;
            u.volume = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
          }
        } catch {}
      } else {
        onShowToast?.('⏱️ Cronómetro continuando', 'El bot sigue viendo tu ruta activa', 'info');
      }
    } else {
      // ── ⏸ PAUSAR ──
      setCrono({
        activo: false,
        inicio: null,
        acumulado: crono.acumulado + (Date.now() - (crono.inicio || Date.now())),
      });
      onShowToast?.('⏸️ Pausado', 'Toca ▶ para continuar — la ruta sigue activa para el bot', 'info');
    }
  };

  // ── ⏹ TERMINAR RUTA ──
  const handleTerminar = async () => {
    const tuvoTiempo = crono.activo || crono.acumulado > 0;
    if (!tuvoTiempo) return;
    if (
      !confirm(
        '⏹ ¿Terminar la ruta?\n\n' +
        'El cronómetro volverá a 00:00 y el bot dejará de reconocer a tus clientes por su nombre ' +
        '(volverá al modo genérico "Hola cliente…") hasta que inicies la próxima ruta.'
      )
    ) {
      return;
    }
    setCrono({ activo: false, inicio: null, acumulado: 0 });
    setTranscurrido(0);
    setPublicando(true);
    try {
      await finalizarRutaActivaBot();
      onShowToast?.('🏁 Ruta terminada', 'Bot en modo genérico — cronómetro en cero', 'info');
    } catch {
      onShowToast?.('🏁 Ruta terminada', 'No se pudo avisar al bot — se enviará al reconectar', 'warning');
    } finally {
      setPublicando(false);
    }
  };

  const enrutado = crono.activo || crono.acumulado > 0;

  return (
    <div className={`rounded-xl border p-2.5 sm:p-3 flex flex-wrap items-center gap-2 transition-colors ${
      crono.activo
        ? 'bg-emerald-500/10 border-emerald-500/40'
        : enrutado
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-slate-900 border-slate-700/60'
    }`}>
      {/* Display del reloj */}
      <div className="flex items-center gap-2 min-w-0">
        <TimerReset className={`w-4 h-4 flex-shrink-0 ${crono.activo ? 'text-emerald-400' : 'text-slate-400'}`} />
        <div className="min-w-0">
          <div className={`text-lg font-black leading-none font-mono tabular-nums ${
            crono.activo ? 'text-emerald-400' : enrutado ? 'text-amber-400' : 'text-slate-300'
          }`}>
            {formatear(transcurrido)}
          </div>
          <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wide">
            {crono.activo ? 'Ruta en curso' : enrutado ? 'Pausado' : 'Tiempo de ruta'}
          </div>
        </div>
      </div>

      {/* Estado del bot */}
      <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold flex-shrink-0 ${
        enrutado
          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          : 'bg-slate-800 border-slate-700 text-slate-500'
      }`}>
        <Bot className="w-3 h-3" />
        {enrutado ? `Bot activo · ${totalClientesTxt(clientes.length)}` : 'Bot en espera'}
      </div>

      {/* Botones */}
      <div className="flex items-center gap-1.5 ml-auto">
        {publicando && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
        <button
          onClick={handleToggle}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all active:scale-95 ${
            crono.activo
              ? 'bg-amber-600 hover:bg-amber-500'
              : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {crono.activo
            ? (<><Pause className="w-3.5 h-3.5" /> Pausar</>)
            : (<><Play className="w-3.5 h-3.5" /> {enrutado ? 'Continuar' : 'Iniciar ruta'}</>)}
        </button>
        {enrutado && (
          <button
            onClick={handleTerminar}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-[11px] font-bold transition-all active:scale-95"
          >
            <Square className="w-3.5 h-3.5" /> Terminar
          </button>
        )}
      </div>

      {/* Ayuda contextual (solo cuando está detenido) */}
      {!enrutado && (
        <p className="w-full text-[10px] text-slate-500 leading-snug">
          Al iniciar, el bot conocerá a tus clientes: si te escriben por WhatsApp, los saludará por su nombre (aviso silencioso).
        </p>
      )}
    </div>
  );
};

function totalClientesTxt(n: number): string {
  return `${n} ${n === 1 ? 'cliente' : 'clientes'}`;
}
