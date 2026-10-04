// ═══════════════════════════════════════════════════════════
// 🎯 DriverTrack — Barra de meta del día
// Muestra el neto acumulado vs la meta. Cuando llega → modo fiesta.
// ═══════════════════════════════════════════════════════════
import { Home, Target } from 'lucide-react';
import { fmtSoles } from '../utils';

interface Props {
  neto: number;
  meta: number;
}

export default function MetaBar({ neto, meta }: Props) {
  const metaValida = meta > 0;
  const pct = metaValida ? Math.min(100, (neto / meta) * 100) : 0;
  const cumplida = metaValida && neto >= meta;
  const falta = Math.max(0, meta - neto);

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        cumplida ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/60'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {cumplida ? (
            <Home size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <Target size={18} className="text-amber-400 shrink-0" />
          )}
          {cumplida ? (
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-300">¡META CUMPLIDA!</p>
              <p className="text-xs text-emerald-400/80 truncate">Vámonos a casa 🏍️🏠</p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200">
                Meta del día: <span className="text-amber-300">{fmtSoles(neto)}</span> / {fmtSoles(meta)}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {metaValida ? `Te faltan ${fmtSoles(falta)} netos` : 'Configurá tu meta en Ajustes ⚙️'}
              </p>
            </div>
          )}
        </div>
        <span className={`text-lg font-black shrink-0 ${cumplida ? 'text-emerald-400' : 'text-amber-400'}`}>
          {metaValida ? `${Math.floor(pct)}%` : '—'}
        </span>
      </div>

      {metaValida && (
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-700/70">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              cumplida
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-300'
                : 'bg-gradient-to-r from-amber-600 via-amber-500 to-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
