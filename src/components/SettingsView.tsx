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
} from 'lucide-react';
import { ConfigCuentasModal } from './ConfigCuentasModal';
import {
  getGoogleApiKey,
  setGoogleApiKey,
  clavePersonalizada,
  DEFAULT_GOOGLE_MAPS_API_KEY,
} from '../services/googleMaps';
import { tamanoCache, limpiarCacheGeocodificacion } from '../services/geocoding';
import { getEstiloMapa, setEstiloMapa, EstiloMapa } from '../services/mapStyle';
import {
  AppNavegacion,
  getAppNavegacion,
  setAppNavegacion,
} from '../services/navegacion';
import { Compass } from 'lucide-react';

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

  // ── Navegación GPS (Fase 2.2 — Google / Waze / Preguntar) ──
  const [navAbierto, setNavAbierto] = useState(false);
  const [appNav, setAppNavState] = useState<AppNavegacion>(getAppNavegacion());

  const cambiarAppNavegacion = (app: AppNavegacion) => {
    setAppNavegacion(app);
    setAppNavState(app);
    onShowToast?.(
      '🧭 Navegación actualizada',
      app === 'google' ? 'Los botones “Navegar” abrirán Google Maps (modo moto)'
      : app === 'waze' ? 'Los botones “Navegar” abrirán Waze'
      : 'Al tocar “Navegar” te preguntará con cuál app ir',
      'success'
    );
  };

  const cambiarEstiloMapa = (e: EstiloMapa) => {
    setEstiloMapa(e);
    setEstiloMapaState(e);
    onShowToast?.(
      '🎨 Estilo de mapa cambiado',
      e === 'oscuro' ? 'Mapa oscuro (bonito, combina con la app)' : e === 'claro' ? 'Mapa claro' : 'Mapa estándar OpenStreetMap',
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
    // Con la clave de fábrica o una propia, el motor es Google
    setMotor(apiKeyInput.trim() ? 'google' : 'google');
    onShowToast?.(
      '🗺️ Google Maps activo',
      apiKeyInput.trim()
        ? 'Mapa, búsqueda de direcciones y optimización por calles reales con Google. Funciona en la próxima optimización.'
        : 'Se restauró la clave de fábrica del proyecto RiderTrack.',
      'success'
    );
  };

  const restaurarClaveFabrica = () => {
    setApiKeyInput(DEFAULT_GOOGLE_MAPS_API_KEY);
    setGoogleApiKey(''); // borra la personalizada → vuelve la de fábrica
    setMotor('google');
    onShowToast?.(
      '🔄 Clave de fábrica restaurada',
      'Se volvió a la clave del proyecto RiderTrack en Google Cloud.',
      'info'
    );
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

        {/* Navegación GPS (Fase 2.2 — elegir Google o Waze) */}
        <button
          onClick={() => setNavAbierto((v) => !v)}
          className="text-left p-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all active:scale-95 group sm:col-span-2"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Compass className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Navegación GPS</div>
              <div className="text-[11px] text-slate-400">
                App preferida: {appNav === 'google' ? 'Google Maps' : appNav === 'waze' ? 'Waze' : 'Preguntar (ambas)'}
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-all ${navAbierto ? 'rotate-90' : ''}`} />
          </div>
        </button>
      </div>

      {/* Panel Mapas y Rutas */}
      {mapasAbierto && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-800 border border-indigo-500/30 space-y-4">
          {/* Motor activo */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-sm">Google Maps Platform</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Mapa de entregas, búsqueda de direcciones (como Circuit) y optimización de ruta por
                calles reales — todo con Google. Activo con la clave de fábrica del proyecto RiderTrack.
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
                { id: 'estandar', label: 'Estándar', desc: 'limpio, sin locales', emoji: '🗺️' },
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
              El mapa usa GOOGLE MAPS con estos 3 estilos (la clave del proyecto ya está configurada).
              Si Google no carga (sin internet), la app cae sola a mapas gratis sin key. También puedes
              cambiarlo al toque desde el botón 🎨 del mapa.
            </p>
          </div>

          {/* API Key de Google */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Google Maps API Key {clavePersonalizada() ? '(personalizada)' : '(de fábrica — ya configurada)'}
            </label>
            <div className="flex gap-2">
              <input
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIza… (la de fábrica ya funciona)"
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
              {clavePersonalizada() && (
                <button
                  onClick={restaurarClaveFabrica}
                  className="flex items-center gap-1 px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
                  title="Volver a la clave del proyecto RiderTrack"
                >
                  🔄 Fábrica
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              La clave de fábrica (proyecto <b className="text-slate-400">RiderTrack</b> en Google Cloud) ya viene
              configurada y habilitada para Maps, Geocoding, Places y Directions. Solo cambia esta clave si quieres
              usar otra cuenta de Google Cloud. Si la borras, vuelve la de fábrica.
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
            ℹ️ Todo el sistema de mapas usa <b className="text-slate-400">Google Maps Platform</b> (clave de fábrica):
            el mapa de entregas con skin oscuro, el motito GPS, la búsqueda de direcciones estilo Circuit y la
            optimización <b className="text-slate-400">por calles reales</b>: <b className="text-slate-400">Mi Ruta → botón “Ruta”</b>.
            Google incluye US$200 de crédito mensual — para un rider ese uso queda dentro de lo gratis.
          </p>
        </div>
      )}

      {/* Panel Navegación GPS (Fase 2.2) */}
      {navAbierto && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-800 border border-blue-500/30 space-y-4">
          <div>
            <h3 className="font-bold text-white text-sm">🧭 ¿Con qué app quieres navegar?</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Se aplica a TODOS los botones “Navegar” de la app: la ficha del cliente en el mapa,
              el banner de siguiente parada y los pedidos. Se guarda en este celular.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              { id: 'preguntar', emoji: '❓', label: 'Preguntar', desc: 'al tocar Navegar, elige Google o Waze' },
              { id: 'google', emoji: '🛵', label: 'Google Maps', desc: 'abre directo en modo moto' },
              { id: 'waze', emoji: '🚗', label: 'Waze', desc: 'abre directo con alertas de tráfico' },
            ] as Array<{ id: AppNavegacion; emoji: string; label: string; desc: string }>).map((op) => (
              <button
                key={op.id}
                onClick={() => cambiarAppNavegacion(op.id)}
                className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${
                  appNav === op.id
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="text-lg leading-none mb-1">{op.emoji}</div>
                <div className="text-xs font-bold">{op.label}</div>
                <div className="text-[10px] opacity-70 leading-tight mt-0.5">{op.desc}</div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            ℹ️ Al igual que Circuit, la navegación guiada por voz corre en la app de Google Maps o Waze
            (ninguna app puede hacer navegación guiada por dentro). Al tocar “Navegar” se abre la app
            elegida ya con el destino puesto — listo para partir.
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
