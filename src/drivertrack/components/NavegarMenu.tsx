// ═══════════════════════════════════════════════════════════
// 🧭 DriverTrack — Mini-selector de navegación (F-ID3.3)
// Aparece al apretar "Navegar" cuando la preferencia es
// "Preguntar" (la default): Google Maps o Waze, con la opción
// de RECORDAR la elección para que la próxima abra directo.
// Patrón del selector de RiderTrack v2 (services/navegacion).
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { Compass, MapPin, X } from 'lucide-react';
import {
  AppNavegacion,
  DestinoNav,
  setAppNavegacion,
  urlNavegacionGoogle,
  urlNavegacionWaze,
} from '../services/navegacion';

interface Props {
  destino: DestinoNav;
  /** Etiqueta de dónde se navega (ej: "C.1 Barrio XV") */
  etiqueta?: string;
  onCerrar: () => void;
}

export default function NavegarMenu({ destino, etiqueta, onCerrar }: Props) {
  const [recordar, setRecordar] = useState(true);

  function elegir(app: AppNavegacion) {
    if (recordar) setAppNavegacion(app); // la próxima abre directo
    const url = app === 'waze' ? urlNavegacionWaze(destino) : urlNavegacionGoogle(destino);
    try {
      window.open(url, '_blank', 'noopener');
    } catch {
      window.location.href = url; // WebViews raros
    }
    onCerrar();
  }

  const nombreDestino =
    etiqueta?.trim() ||
    (destino.lat != null && destino.lng != null
      ? `${destino.lat.toFixed(5)}, ${destino.lng.toFixed(5)}`
      : destino.direccion?.trim() || 'la entrega');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
      data-testid="nav-menu"
    >
      <div
        className="dt-anim-pop w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-black text-slate-100">
              <Compass size={16} className="text-sky-400" /> ¿Con qué app viajás?
            </p>
            <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400" title={nombreDestino}>
              <MapPin size={11} className="shrink-0 text-sky-400" /> {nombreDestino}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => elegir('google')}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-4 text-sky-300 transition-all active:scale-[0.98] hover:bg-sky-500/20"
            data-testid="nav-opcion-google"
          >
            {/* Google Maps: pin multicolor simplificado */}
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
              />
              <circle cx="12" cy="9" r="2.6" fill="#fff" />
            </svg>
            <span className="text-xs font-black">Google Maps</span>
            <span className="text-[9px] font-medium text-sky-400/70">modo moto</span>
          </button>
          <button
            onClick={() => elegir('waze')}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-4 text-cyan-300 transition-all active:scale-[0.98] hover:bg-cyan-500/20"
            data-testid="nav-opcion-waze"
          >
            {/* Waze: hombrecito burbuja */}
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
              <circle cx="12" cy="10" r="7.2" fill="#33CCFF" />
              <circle cx="9.4" cy="9.6" r="1.15" fill="#0f172a" />
              <circle cx="14.6" cy="9.6" r="1.15" fill="#0f172a" />
              <path d="M9.5 12.6c.8.9 4.2.9 5 0" stroke="#0f172a" strokeWidth="1.3" strokeLinecap="round" fill="none" />
              <path d="M9.8 16.4l-.6 2.6a1.6 1.6 0 0 0 2.7 1.4l3.3-2.5" fill="#33CCFF" />
            </svg>
            <span className="text-xs font-black">Waze</span>
            <span className="text-[9px] font-medium text-cyan-400/70">arranca el viaje</span>
          </button>
        </div>

        <label
          className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-400"
          data-testid="nav-recordar"
        >
          <input
            type="checkbox"
            checked={recordar}
            onChange={e => setRecordar(e.target.checked)}
            className="h-3.5 w-3.5 accent-emerald-500"
          />
          Siempre usar esta app (podés cambiarlo en Ajustes 🧭)
        </label>
      </div>
    </div>
  );
}
