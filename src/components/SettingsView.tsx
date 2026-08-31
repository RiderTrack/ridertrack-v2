// ═══════════════════════════════════════════════════════════
// ⚙️ SETTINGS VIEW - RiderTrack V2
// Sección de configuración con tarjetas
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
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
  Volume2,
  Vibrate,
  Coins,
  Compass,
  LogOut,
  User,
  Mail,
  Image as ImageIcon,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { ConfigCuentasModal } from './ConfigCuentasModal';
import { WhatsAppApiModal } from './WhatsAppApiModal';
import { useAuth } from '../hooks/useAuth';
import { cerrarSesion } from '../services/firebase';
import {
  cargarConfigCuentas,
  guardarConfigCuentas,
  ConfigCuentas,
} from '../services/firestore';
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
// Fase 3.14: botones vivos
import {
  ConfigNotificaciones,
  leerNotif,
  guardarNotif,
} from '../services/notificaciones';
import {
  PreferenciasNav,
  leerPreferenciasNav,
  guardarPreferenciasNav,
  PREFERENCIAS_NAV_DEFAULT,
} from '../services/navegacionGps';

interface SettingsViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  /** Fase 3.14: para que la tarjeta Medios abra la pestaña de Medios */
  onNavigateTab?: (tab: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onShowToast, onNavigateTab }) => {
  const { user, profile } = useAuth();
  const [modalAbierto, setModalAbierto] = useState<'cuentas' | 'whatsapp' | null>(null);

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

  // ── Notificaciones (Fase 3.14) ──
  const [notifAbierto, setNotifAbierto] = useState(false);
  const [notif, setNotif] = useState<ConfigNotificaciones>(leerNotif());

  const cambiarNotif = (campo: keyof ConfigNotificaciones, valor: boolean) => {
    const nueva = { ...notif, [campo]: valor };
    setNotif(nueva);
    guardarNotif(nueva);
  };

  // ── Reglas de Despacho (Fase 3.14 — navegación GPS) ──
  const [reglasAbierto, setReglasAbierto] = useState(false);
  const [reglas, setReglas] = useState<PreferenciasNav>(leerPreferenciasNav());

  const cambiarRegla = (campo: keyof PreferenciasNav, valor: number | boolean) => {
    const nueva = { ...reglas, [campo]: valor } as PreferenciasNav;
    setReglas(nueva);
    guardarPreferenciasNav(nueva);
  };

  // ── Seguridad (Fase 3.14 — sesión) ──
  const [segAbierto, setSegAbierto] = useState(false);

  // ── Icono de la App (Fase 3.21 — logo que representa a RiderTrack V2) ──
  const [iconoAbierto, setIconoAbierto] = useState(false);
  const [logoApp, setLogoApp] = useState<string>('');
  const [logoGuardado, setLogoGuardado] = useState<string>('');
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [guardandoLogo, setGuardandoLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Al abrir la tarjeta: primero localStorage (instantáneo — así lo ve el
  // login antes de entrar) y luego Firestore (fuente de verdad)
  useEffect(() => {
    if (!iconoAbierto) return;
    try {
      setLogoApp(localStorage.getItem('rt2_logo_app') || '');
    } catch { /* sin storage */ }
    if (!user) return;
    cargarConfigCuentas(user.uid)
      .then((cfg) => {
        const logo = cfg.apariencia?.logoBase64 || '';
        setLogoApp(logo);
        setLogoGuardado(logo);
        try {
          if (logo) localStorage.setItem('rt2_logo_app', logo);
          else localStorage.removeItem('rt2_logo_app');
        } catch { /* sin storage */ }
      })
      .catch(() => { /* sin conexión — queda lo local */ });
  }, [iconoAbierto, user]);

  // Comprime una imagen a JPEG base64 (mismo approach del QR de Yape/Plin)
  const comprimirLogo = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagen inválida'));
        img.onload = () => {
          const MAX = 512; // cuadrado pequeño: es un logo, no una foto
          let { width, height } = img;
          const escala = Math.min(1, MAX / Math.max(width, height));
          width = Math.round(width * escala);
          height = Math.round(height * escala);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas no disponible')); return; }
          ctx.fillStyle = '#020617'; // slate-950 (fondo de la app)
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = String(e.target?.result || '');
      };
      reader.readAsDataURL(file);
    });

  const elegirLogo = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onShowToast?.('⚠️ No es una imagen', 'Elige una foto o un PNG/JPG del logo', 'warning');
      return;
    }
    setSubiendoLogo(true);
    try {
      const b64 = await comprimirLogo(file);
      setLogoApp(b64);
      onShowToast?.('✅ Logo cargado', 'Se ve en la vista previa — toca “Guardar logo” para confirmarlo', 'success');
    } catch (err: any) {
      onShowToast?.('❌ Error', err.message || 'No se pudo procesar la imagen', 'error');
    } finally {
      setSubiendoLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const guardarLogo = async () => {
    if (!user) {
      onShowToast?.('⚠️ Sin sesión', 'Inicia sesión para guardar el logo en la nube', 'warning');
      return;
    }
    setGuardandoLogo(true);
    try {
      // merge:true → solo se escribe apariencia, el resto de la config no se toca
      await guardarConfigCuentas(user.uid, { apariencia: { logoBase64: logoApp } } as ConfigCuentas);
      setLogoGuardado(logoApp);
      try {
        if (logoApp) localStorage.setItem('rt2_logo_app', logoApp);
        else localStorage.removeItem('rt2_logo_app');
      } catch { /* sin storage */ }
      onShowToast?.(
        logoApp ? '🛡️ Logo guardado' : '🔄 Logo restaurado',
        logoApp
          ? 'Ya aparece en el login de este dispositivo y quedará en la nube'
          : 'Vuelve al logo de fábrica de RiderTrack V2',
        'success'
      );
    } catch (e: any) {
      onShowToast?.('❌ Error al guardar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setGuardandoLogo(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('¿Cerrar sesión de RiderTrack?')) {
      await cerrarSesion();
    }
  };

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

        {/* Medios (Fase 3.14: YA existe desde la 3.11 — antes decía
            "próximamente" y estaba muerto; ahora abre la pestaña) */}
        <button
          onClick={() => {
            if (onNavigateTab) {
              onNavigateTab('medios');
            } else {
              onShowToast?.('🎵 Medios', 'Abre la pestaña Medios del menú', 'info');
            }
          }}
          className="text-left p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Music className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Medios</div>
              <div className="text-[11px] text-slate-400">Radio, Spotify y YouTube</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
        </button>

        {/* Icono de la App (Fase 3.21 — el logo que representa a
            RiderTrack V2: se ve en el login y se guarda en la nube) */}
        <button
          onClick={() => setIconoAbierto((v) => !v)}
          className="text-left p-4 rounded-2xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center overflow-hidden">
              {logoGuardado ? (
                <img src={logoGuardado} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-5 h-5 text-orange-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Icono de la App</div>
              <div className="text-[11px] text-slate-400">
                {logoGuardado ? 'Logo personalizado activo' : 'Logo de fábrica · escudo RiderTrack'}
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-500 group-hover:text-orange-400 transition-colors ${iconoAbierto ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {/* WhatsApp API (Fase 3.14: YA vivo — configuración del
            canal oficial de Meta con prueba de conexión real) */}
        <button
          onClick={() => setModalAbierto('whatsapp')}
          className="text-left p-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">WhatsApp Oficial</div>
              <div className="text-[11px] text-slate-400">Meta Cloud API — configurar y probar</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </div>
        </button>

        {/* Notificaciones (Fase 3.14: YA vivo — sonidos reales) */}
        <button
          onClick={() => setNotifAbierto((v) => !v)}
          className="text-left p-4 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Notificaciones</div>
              <div className="text-[11px] text-slate-400">
                {notif.sonidoChat || notif.sonidoPago
                  ? `Sonidos activados — ${[notif.sonidoChat ? '💬 chat' : '', notif.sonidoPago ? '💰 pagos' : ''].filter(Boolean).join(' · ')}`
                  : 'Todo en silencio'}
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-all ${notifAbierto ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {/* Reglas de Despacho (Fase 3.14: YA vivo — controla la
            navegación GPS: avisos de voz, llegada y recálculo) */}
        <button
          onClick={() => setReglasAbierto((v) => !v)}
          className="text-left p-4 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Reglas de Despacho</div>
              <div className="text-[11px] text-slate-400">Avisos GPS: giros, llegada y recálculo</div>
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-all ${reglasAbierto ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {/* Seguridad (Fase 3.14: YA vivo — sesión y permisos) */}
        <button
          onClick={() => setSegAbierto((v) => !v)}
          className="text-left p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Seguridad</div>
              <div className="text-[11px] text-slate-400">Sesión, cuenta y permisos</div>
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-500 group-hover:text-red-400 transition-all ${segAbierto ? 'rotate-90' : ''}`} />
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

      {/* Panel Notificaciones (Fase 3.14) */}
      {notifAbierto && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-800 border border-purple-500/30 space-y-3">
          <div>
            <h3 className="font-bold text-white text-sm">🔔 Sonidos y alertas</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Se guardan en este celular. Los sonidos se generan en la app (sin descargas).
            </p>
          </div>

          {([
            {
              key: 'sonidoChat' as const,
              icon: Volume2,
              emoji: '💬',
              titulo: 'Mensaje nuevo del Rider chat',
              desc: 'Doble beep cuando llega un mensaje de un cliente',
            },
            {
              key: 'vibracion' as const,
              icon: Vibrate,
              emoji: '📳',
              titulo: 'Vibración al llegar mensaje',
              desc: 'Para notar el mensaje con el celular en el bolsillo',
            },
            {
              key: 'sonidoPago' as const,
              icon: Coins,
              emoji: '💰',
              titulo: 'Al registrar un pago',
              desc: 'Beep de caja al marcar Efectivo / Yape / POS en Mi Ruta',
            },
          ]).map((op) => (
            <button
              key={op.key}
              onClick={() => cambiarNotif(op.key, !notif[op.key])}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-95 ${
                notif[op.key]
                  ? 'bg-purple-500/15 border-purple-500/40'
                  : 'bg-slate-900 border-slate-700'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base ${
                notif[op.key] ? 'bg-purple-500/25' : 'bg-slate-800'
              }`}>
                {op.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">{op.titulo}</p>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{op.desc}</p>
              </div>
              {/* Switch visual */}
              <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
                notif[op.key] ? 'bg-purple-500' : 'bg-slate-700'
              }`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                  notif[op.key] ? 'left-[18px]' : 'left-0.5'
                }`} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Panel Reglas de Despacho (Fase 3.14 — controla la navegación GPS) */}
      {reglasAbierto && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-800 border border-cyan-500/30 space-y-4">
          <div>
            <h3 className="font-bold text-white text-sm">🌐 Avisos de la navegación GPS</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ajusta la navegación de Mi Ruta → 🧭 GPS a tu forma de manejar. Aplica desde el
              próximo inicio de navegación.
            </p>
          </div>

          {/* Aviso temprano de maniobra */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">📢 Aviso temprano de giro</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  La voz dice "En N metros, gira…" — mientras más metros, más tiempo para ubicarte en el carril.
                </p>
              </div>
              <span className="text-lg font-black text-cyan-400 shrink-0">{reglas.avisoLejosM} m</span>
            </div>
            <input
              type="range"
              min={100}
              max={800}
              step={50}
              value={reglas.avisoLejosM}
              onChange={(e) => cambiarRegla('avisoLejosM', parseInt(e.target.value))}
              className="w-full mt-2.5 accent-cyan-500"
            />
            <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
              <span>100 m (justo)</span>
              <span>800 m (tranquilo)</span>
            </div>
          </div>

          {/* Llegada */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">🎯 Aviso de llegada</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  A cuántos metros de la parada suena "¡Llegaste!". En calles con edificios altos
                  conviene más metros (el GPS se dispersa).
                </p>
              </div>
              <span className="text-lg font-black text-cyan-400 shrink-0">{reglas.llegadaM} m</span>
            </div>
            <input
              type="range"
              min={20}
              max={150}
              step={5}
              value={reglas.llegadaM}
              onChange={(e) => cambiarRegla('llegadaM', parseInt(e.target.value))}
              className="w-full mt-2.5 accent-cyan-500"
            />
            <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
              <span>20 m (exacto)</span>
              <span>150 m (calles estrechas)</span>
            </div>
          </div>

          {/* Auto-recálculo */}
          <button
            onClick={() => cambiarRegla('autoRecalcular', !reglas.autoRecalcular)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-95 ${
              reglas.autoRecalcular
                ? 'bg-cyan-500/15 border-cyan-500/40'
                : 'bg-slate-900 border-slate-700'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
              <Compass className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">🔄 Recalcular al desviarse</p>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                Si te sales de la ruta, la app busca el nuevo camino sola. Apágalo si prefieres
                volver por tu cuenta.
              </p>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
              reglas.autoRecalcular ? 'bg-cyan-500' : 'bg-slate-700'
            }`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                reglas.autoRecalcular ? 'left-[18px]' : 'left-0.5'
              }`} />
            </div>
          </button>

          <button
            onClick={() => {
              cambiarRegla('avisoLejosM', PREFERENCIAS_NAV_DEFAULT.avisoLejosM);
              cambiarRegla('avisoCercaM', PREFERENCIAS_NAV_DEFAULT.avisoCercaM);
              cambiarRegla('llegadaM', PREFERENCIAS_NAV_DEFAULT.llegadaM);
              cambiarRegla('autoRecalcular', PREFERENCIAS_NAV_DEFAULT.autoRecalcular);
              onShowToast?.('🔄 Reglas restauradas', 'Volvieron los valores afinados para moto en Lima', 'info');
            }}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors"
          >
            🔄 Restaurar valores de fábrica (moto en Lima)
          </button>
        </div>
      )}

      {/* Panel Icono de la App (Fase 3.21) */}
      {iconoAbierto && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-800 border border-orange-500/30 space-y-4">
          <div>
            <h3 className="font-bold text-white text-sm">🛡️ Icono de la App</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              La imagen que representa a RiderTrack V2. Se muestra en el login y queda
              guardada en la nube (config_empresa).
            </p>
          </div>

          {/* Vista previa: cuadrada (launcher) + redonda (adaptativa) */}
          <div className="flex items-center gap-5 justify-center py-2">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-600 shadow-lg bg-slate-900 flex items-center justify-center">
                {logoApp ? (
                  <img src={logoApp} alt="Logo app" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-emerald-600 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-slate-500 mt-1">Cuadrada</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 rounded-full overflow-hidden border border-slate-600 shadow-lg bg-slate-900 flex items-center justify-center">
                {logoApp ? (
                  <img src={logoApp} alt="Logo app redondo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-emerald-600 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-slate-500 mt-1">Redonda</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-slate-950 flex flex-col items-center justify-center gap-1 p-2">
                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                  {logoApp ? (
                    <img src={logoApp} alt="Logo mini" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-emerald-600" />
                  )}
                </div>
                <div className="text-[8px] font-black text-white leading-none">RiderTrack V2</div>
                <div className="text-[7px] text-slate-400 leading-none">Panel de entregas</div>
              </div>
              <p className="text-[9px] text-slate-500 mt-1">En el login</p>
            </div>
          </div>

          {/* Botones */}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => elegirLogo(e.target.files?.[0])}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={subiendoLogo}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition-all active:scale-95"
            >
              {subiendoLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              {subiendoLogo ? 'Procesando…' : 'Subir imagen'}
            </button>
            <button
              onClick={() => setLogoApp('')}
              disabled={!logoApp}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs font-bold transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Quitar logo
            </button>
          </div>
          <button
            onClick={guardarLogo}
            disabled={guardandoLogo || logoApp === logoGuardado}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition-all active:scale-95"
          >
            {guardandoLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {guardandoLogo ? 'Guardando…' : logoApp === logoGuardado ? 'Guardado ✓' : 'Guardar logo'}
          </button>

          {/* Nota: qué es fijo y qué es dinámico */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-1.5">
            <p className="text-[10px] leading-relaxed text-slate-400">
              📱 <b className="text-slate-300">Icono del APK (en el escritorio del celular):</b> el escudo
              de RiderTrack v1 ya viene integrado en el build (carpeta android-icons del repo) — ese se
              pone al compilar la app.
            </p>
            <p className="text-[10px] leading-relaxed text-slate-400">
              🖼️ <b className="text-slate-300">Este logo:</b> la imagen que verás DENTRO de la app (login),
              editable aquí mismo sin recompilar. Se guarda comprimida (máx 512 px) en tu cuenta.
            </p>
          </div>
        </div>
      )}

      {/* Panel Seguridad (Fase 3.14) */}
      {segAbierto && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-800 border border-red-500/30 space-y-3">
          <div>
            <h3 className="font-bold text-white text-sm">🛡️ Sesión y seguridad</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Tu cuenta, el dispositivo y los permisos de la app.</p>
          </div>

          {/* Cuenta */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-blue-400 shrink-0" />
              <p className="text-xs font-bold text-white">{profile?.nombre || 'Rider'}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-slate-500 shrink-0" />
              <p className="text-[11px] text-slate-400 truncate">
                {user?.email || 'Sesión anónima (invitado)'}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-[11px] text-slate-400">
                Datos en Firebase <span className="font-mono text-[10px]">{user?.uid?.slice(0, 8) || '—'}…</span>
                {profile?.rol ? ` · rol: ${profile.rol}` : ''}
              </p>
            </div>
          </div>

          {/* Dispositivo / permisos */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-1.5">
            <p className="text-xs font-bold text-white">📱 Este dispositivo</p>
            <p className="text-[11px] text-slate-400">
              Plataforma: <b className="text-slate-300">{Capacitor.isNativePlatform() ? 'APK (Android nativo)' : 'Navegador web'}</b>
            </p>
            <p className="text-[11px] text-slate-400">
              Los permisos de <b className="text-slate-300">ubicación</b> y{' '}
              <b className="text-slate-300">notificaciones</b> se gestionan en Ajustes del teléfono →
              Apps → RiderTrack (así los ve Android, con más detalle que cualquier app).
            </p>
          </div>

          {/* Cerrar sesión */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold transition-colors"
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      )}

      {/* Modal de cuentas bancarias */}
      {modalAbierto === 'cuentas' && (
        <ConfigCuentasModal
          onClose={() => setModalAbierto(null)}
          onShowToast={onShowToast}
        />
      )}

      {/* Modal WhatsApp Oficial (Fase 3.14) */}
      {modalAbierto === 'whatsapp' && (
        <WhatsAppApiModal
          onClose={() => setModalAbierto(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
