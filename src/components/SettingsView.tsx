import React from 'react';
import { Settings, Shield, Bell, Smartphone, Globe, Save } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-500" />
          Configuración del Sistema RiderTrack V2
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Parámetros operativos, credenciales de WhatsApp API y reglas de despacho
        </p>
      </div>

      <div className="space-y-4">
        {/* API Settings */}
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" /> WhatsApp Cloud API Settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Phone Number ID</label>
              <input
                type="text"
                readOnly
                value="104928109281029"
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-slate-300"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">WhatsApp Business Account ID</label>
              <input
                type="text"
                readOnly
                value="293019283019283"
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Dispatch Rules */}
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" /> Reglas de Despacho y Radio GPS
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Radio Máximo de Asignación (km)</label>
              <input
                type="number"
                defaultValue={8}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Tiempo Límite Auto-Asignación (seg)</label>
              <input
                type="number"
                defaultValue={45}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold"
              />
            </div>
          </div>
        </div>

        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all">
          <Save className="w-4 h-4" /> Guardar Cambios
        </button>
      </div>
    </div>
  );
};
