// ═══════════════════════════════════════════════════════════
// 📍 DriverTrack — Barra de grabación GPS en vivo (F-ID3)
// Flota arriba de la barra inferior mientras grabás los km de
// un viaje: km en vivo + cronómetro + botón para terminar.
// El cronómetro se calcula solo (interval de 1 s) para que
// siga corriendo aunque no lleguen puntos del GPS.
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { Square } from 'lucide-react';
import type { EstadoGPS } from '../services/gps';
import { formatearReloj } from '../services/gps';

interface Props {
  estado: EstadoGPS;
  cliente: string; // nombre del viaje que se está grabando
  onDetener: () => void;
}

export default function GpsBar({ estado, cliente, onDetener }: Props) {
  const [transcurrido, setTranscurrido] = useState(() => Date.now() - estado.inicioTs);

  useEffect(() => {
    const t = window.setInterval(() => setTranscurrido(Date.now() - estado.inicioTs), 1000);
    return () => window.clearInterval(t);
  }, [estado.inicioTs]);

  return (
    <div
      className="fixed bottom-[76px] left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4"
      data-testid="gps-bar"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/50 bg-slate-900/95 p-3 shadow-2xl backdrop-blur">
        {/* Punto pulsante */}
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black leading-none text-emerald-400 tabular-nums" data-testid="gps-km">
              {estado.km.toFixed(1)} km
            </span>
            <span className="font-mono text-[11px] font-bold text-slate-400 tabular-nums" data-testid="gps-tiempo">
              {formatearReloj(transcurrido)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
            grabando viaje de <span className="text-slate-200">{cliente || 'cliente'}</span>
          </p>
        </div>

        <button
          onClick={onDetener}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-[11px] font-bold text-white transition-transform active:scale-95"
          data-testid="boton-detener-gps"
        >
          <Square size={13} fill="currentColor" /> Terminar
        </button>
      </div>
    </div>
  );
}
