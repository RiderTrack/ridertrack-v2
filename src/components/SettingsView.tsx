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
  MapPin,
  KeyRound,
  Trash2,
  Navigation,
} from 'lucide-react';
import { ConfigCuentasModal } from './ConfigCuentasModal';
import {
  getGoogleApiKey,
  setGoogleApiKey,
  tamanoCache,
  limpiarCacheGeocodificacion,
} from '../services/geocoding';
import { getEstiloMapa, setEstiloMapa, EstiloMapa } from '../services/mapStyle';
import { getAppNavegacion, setAppNavegacion, AppNavegacion, nombreAppNavegacion } from '../services/navPrefs';

interface SettingsViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onShowToast }) => {
  const [modalAbierto, setModalAbierto] = useState<'cuentas' | null>(null);

  // ── Mapas y Rutas (Fase 1.3) ──
  const [mapasAbierto, setMapasAbierto] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getGoogleApiKey());
  const [motor, setMotor] = useState<'google' | 'nominatim'>(
    getGoogleApiKey() ? 'google' : 'nominatim'
  );
  const [cacheN, setCacheN] = useState(0);
  const [estiloMapa, setEstiloMapaState] = useState<EstiloMapa>(getEstiloMapa());
  const [navApp, setNavApp] = useState<AppNavegacion>(getAppNavegacion());

  const cambiarEstiloMapa = (e: EstiloMapa) => {
    setEstiloMapa(e);
    setEstiloMapaState(e);
    onShowToast?.(
      '🎨 Estilo de mapa cambiado',
      e === 'oscuro' ? 'Mapa oscuro (bonito, combina con la app)' : e === 'claro' ? 'Mapa claro' : 'Mapa estándar OpenStreetMap',
      'success'
    );
  };

  const cambiarNavApp = (app: AppNavegacion) => {
    setAppNavegacion(app);
    setNavApp(app);
    onShowToast?.(
      `🧭 Navegación con ${nombreAppNavegacion(app)}`,
      'Todos los botones "Navegar" de la app abrirán esa app',
      'success'
    );
  };

  const abrirMapas = () => {
    setApiKeyInput(getGoogleApiKey());
    setMotor(getGoogleApiKey() ? 'google' : 'nominatim');
    setCacheN(tamanoCache());
    setMapasAbierto((v) => !v);
  };

  const guardarApiKey = () => {
    setGoogleApiKey(apiKeyInput);
    const nuevoMotor = apiKeyInput.trim() ? 'google' : 'nominatim';
    setMotor(nuevoMotor);
    if (apiKeyInput.trim()) {
      onShowToast?.(
        '🗺️ Google Geocoding activado',
        'Las direcciones se ubicarán con Google (más precisión). Funciona en la próxima optimización de ruta.',
        'success'
      );
    } else {
      onShowToast?.('🌐 Google desactivado', 'Se vuelve al motor gratis Nominatim (OpenStreetMap)', 'info');
    }
  };

  const limpiarCache = () => {
    const n = limpiarCacheGeocodificacion();
    setCacheN(0);
    onShowToast?.(
      '🧹 Caché limpiada',
      n === 0 ? 'No había direcciones en caché' : `${n} direcciones borradas — se ubicarán de nuevo al optimizar`,
      'info'
    );
  };

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
        {/* Mapas y Rutas (Fase 1.3 — geocodificación y optimización) */}
        <button
          onClick={abrirMapas}
          className="text-left p-4 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all active:scale-95 group sm:col-span-2"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Mapas y Rutas</div>
              <div className="text-[11px] text-slate-400">
                Motor: {motor === 'google' ? 'Google Geocoding (activo)' : 'Nominatim gratis (OpenStreetMap)'} · Caché: {cacheN} direcciones
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-all ${mapasAbierto ? 'rotate-90' : ''}`} />
          </div>
        </button>
      </div>

      {/* Panel Mapas y Rutas */}
      {mapasAbierto && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-800 border border-indigo-500/30 space-y-4">
          {/* Motor activo */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-sm">Motor de ubicación de direcciones</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Convierte “Av. Larco 123, Miraflores” en coordenadas para optimizar tu ruta y dibujarla en el mapa.
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border ${
                motor === 'google'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
              }`}
            >
              {motor === 'google' ? 'Google activo' : 'Nominatim (gratis)'}
            </span>
          </div>

          {/* Estilo del mapa (skin) — Fase 1.4 */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              Estilo del mapa de entregas
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'oscuro', label: 'Oscuro', desc: 'bonito, combina con la app', emoji: '🌙' },
                { id: 'claro', label: 'Claro', desc: 'día, alto contraste', emoji: '☀️' },
                { id: 'estandar', label: 'Estándar', desc: 'OpenStreetMap clásico', emoji: '🗺️' },
              ] as Array<{ id: EstiloMapa; label: string; desc: string; emoji: string }>).map((op) => (
                <button
                  key={op.id}
                  onClick={() => cambiarEstiloMapa(op.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all active:scale-95 ${
                    estiloMapa === op.id
                      ? 'bg-indigo-500/20 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="text-lg leading-none mb-1">{op.emoji}</div>
                  <div className="text-[11px] font-bold">{op.label}</div>
                  <div className="text-[9px] opacity-70 leading-tight mt-0.5">{op.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Los 3 usan mapas gratuitos sin API key (el oscuro y el claro son de CARTO sobre
              datos de OpenStreetMap). También puedes cambiarlo al toque desde el botón 🎨 del mapa.
            </p>
          </div>

          {/* App de navegación preferida — Fase 1.5 */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-blue-400" />
              App de navegación (botón “Navegar”)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'google', label: 'Google Maps', desc: 'modo moto, calcetín de tráfico', emoji: '🗺️' },
                { id: 'waze', label: 'Waze', desc: 'alertas de ruta en vivo', emoji: '🚨' },
              ] as Array<{ id: AppNavegacion; label: string; desc: string; emoji: string }>).map((op) => (
                <button
                  key={op.id}
                  onClick={() => cambiarNavApp(op.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all active:scale-95 ${
                    navApp === op.id
                      ? 'bg-blue-500/20 border-blue-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="text-lg leading-none mb-1">{op.emoji}</div>
                  <div className="text-[11px] font-bold">{op.label}</div>
                  <div className="text-[9px] opacity-70 leading-tight mt-0.5">{op.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Elige con qué app abrir la navegación a cada parada. Google usa modo moto
              (two_wheeler); Waze arranca la navegación directo. Puedes cambiarlo cuando quieras.
            </p>
          </div>

          {/* API Key de Google */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Google Maps API Key (opcional)
            </label>
            <div className="flex gap-2">
              <input
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIza… (vacío = Nominatim gratis)"
                className="flex-1 bg-slate-900 text-white text-xs rounded-lg px-3 py-2.5 border border-slate-700 focus:border-indigo-500 outline-none font-mono"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                onClick={guardarApiKey}
                className="flex items-center gap-1 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
              >
                <Save className="w-3.5 h-3.5" /> Guardar
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Con key: Google ubica direcciones peruanas con mayor precisión (Geocoding API — se habilita en{' '}
              <a href="https://console.cloud.google.com/apis/library/geocodingapi" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">
                Google Cloud
              </a>
              , tiene capa gratuita mensual y requiere tarjeta). Sin key: Nominatim/OpenStreetMap gratis — ya funciona, solo un poco menos preciso.
              La key se guarda únicamente en este dispositivo.
            </p>
          </div>

          {/* Caché de direcciones */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <div>
              <p className="text-xs font-bold text-white">Caché de direcciones</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {cacheN === 0 ? 'Sin direcciones en caché todavía' : `${cacheN} ${cacheN === 1 ? 'dirección guardada' : 'direcciones guardadas'} — evita volver a ubicar las mismas direcciones.`}
              </p>
            </div>
            <button
              onClick={limpiarCache}
              className="flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-red-600/80 text-white rounded-lg text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpiar
            </button>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            ℹ️ El mapa de entregas usa OpenStreetMap (gratis, sin key). La optimización de ruta ordena tus paradas
            por distancia real con tu GPS: <b className="text-slate-400">Mi Ruta → botón “Ruta”</b>.
          </p>
        </div>
      )}

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
