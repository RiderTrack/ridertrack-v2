// ═══════════════════════════════════════════════════════════
// ⚙️ SETTINGS VIEW - RiderTrack V2
// Sección de configuración con tarjetas
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Bell,
  Smartphone,
  Globe,
  Save,
  Building2,
  Music,
  Radio,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { ConfigCuentasModal } from './ConfigCuentasModal';

interface SettingsViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onShowToast }) => {
  const [modalAbierto, setModalAbierto] = useState<'cuentas' | null>(null);

  return (
    <div className="space-y-4 pb-12 max-w-3xl">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-500" />
          Configuración
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Gestiona tus cuentas bancarias, medios y parámetros del sistema
        </p>
      </div>

      {/* Tarjetas de configuración */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Cuentas Bancarias */}
        <button
          onClick={() => setModalAbierto('cuentas')}
          className="text-left p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Cuentas Bancarias</div>
              <div className="text-[11px] text-slate-400">Yape, Plin, BCP, BBVA, Interbank</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
          </div>
        </button>

        {/* Medios (Spotify + Radio) - Placeholder */}
        <button
          onClick={() => onShowToast?.('🎵 Medios', 'Próximamente: Spotify y Radio integrados', 'info')}
          className="text-left p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all active:scale-95 group opacity-60"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Music className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Medios</div>
              <div className="text-[11px] text-slate-400">Spotify y Radio (próximamente)</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
        </button>

        {/* WhatsApp API */}
        <button
          onClick={() => onShowToast?.('💬 WhatsApp', 'Configuración de WhatsApp API', 'info')}
          className="text-left p-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">WhatsApp API</div>
              <div className="text-[11px] text-slate-400">Meta Cloud API</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </div>
        </button>

        {/* Notificaciones */}
        <button
          onClick={() => onShowToast?.('🔔 Notificaciones', 'Configuración de notificaciones', 'info')}
          className="text-left p-4 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Notificaciones</div>
              <div className="text-[11px] text-slate-400">Alertas y sonidos</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
          </div>
        </button>

        {/* Reglas de Despacho */}
        <button
          onClick={() => onShowToast?.('🌐 Reglas', 'Configuración de reglas de despacho', 'info')}
          className="text-left p-4 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Reglas de Despacho</div>
              <div className="text-[11px] text-slate-400">Radio GPS y tiempos</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
          </div>
        </button>

        {/* Seguridad */}
        <button
          onClick={() => onShowToast?.('🛡️ Seguridad', 'Configuración de seguridad', 'info')}
          className="text-left p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Seguridad</div>
              <div className="text-[11px] text-slate-400">Permisos y accesos</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
          </div>
        </button>
      </div>

      {/* Modal de cuentas bancarias */}
      {modalAbierto === 'cuentas' && (
        <ConfigCuentasModal
          onClose={() => setModalAbierto(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
