// ═══════════════════════════════════════════════════════════
// 🎵 MEDIOS VIEW - RiderTrack V2
// Sección de medios (Spotify y Radio) - Placeholder
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Music, Radio, Radio as RadioIcon, Headphones, Volume2, Loader2 } from 'lucide-react';

export const MediosView: React.FC = () => {
  return (
    <div className="space-y-4 pb-12 max-w-3xl">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <Music className="w-6 h-6 text-emerald-500" />
          Medios
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Integra música y radio para tu ruta
        </p>
      </div>

      {/* Tarjetas de medios (placeholders) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Spotify */}
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Music className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="font-bold text-white">Spotify</div>
              <div className="text-[11px] text-emerald-400">Próximamente</div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Reproduce tus playlists favoritas mientras haces las entregas.
            Controla la música sin salir de la app.
          </p>
        </div>

        {/* Radio */}
        <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Radio className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="font-bold text-white">Radio</div>
              <div className="text-[11px] text-blue-400">Próximamente</div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Escucha tus emisoras de radio preferidas directamente desde el panel.
            Estaciones locales y nacionales.
          </p>
        </div>
      </div>

      {/* Mensaje informativo */}
      <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
        <Volume2 className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-xs text-slate-400">
          🎵 Estas funciones estarán disponibles próximamente.
          <br />
          Mientras tanto, puedes seguir usando las apps externas de Spotify y Radio.
        </p>
      </div>
    </div>
  );
};
