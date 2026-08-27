import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Wifi,
  Radio,
  Clock,
  Menu,
  Check,
  X,
  ShieldCheck,
  Globe,
  Server,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  Camera,
} from 'lucide-react';
import { ThemeMode, AppNotification } from '../types';
import { AvatarSvg } from '../data/avatars';

interface HeaderProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onToggleMobileMenu: () => void;
  notifications: AppNotification[];
  onMarkNotificationsRead: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning') => void;
  /** Nombre real del rider (Fase 1.5) */
  riderName?: string;
  /** Avatar ilustrado elegido (Fase 1.5) */
  riderAvatar?: string;
  onAbrirAvatarPicker?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  onToggleMobileMenu,
  notifications,
  onMarkNotificationsRead,
  searchQuery,
  onSearchChange,
  onShowToast,
  riderName = 'Rider',
  riderAvatar,
  onAbrirAvatarPicker,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [language, setLanguage] = useState<'ES' | 'EN'>('ES');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const unreadCount = notifications.filter((n) => !n.leido).length;

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setCurrentDate(
        now.toLocaleDateString('es-PE', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleLang = (lang: 'ES' | 'EN') => {
    setLanguage(lang);
    setShowLangDropdown(false);
    if (onShowToast) {
      onShowToast(
        lang === 'ES' ? 'Idioma cambiado a Español' : 'Language switched to English',
        lang === 'ES' ? 'Interfaz configurada en Español' : 'System localized to English',
        'info'
      );
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 md:px-6 border-b bg-slate-950/95 text-slate-100 border-slate-800/80 backdrop-blur-xl shadow-lg transition-colors duration-200 select-none">
      {/* Left side: Mobile Menu Trigger & Brand Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 rounded-xl lg:hidden text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
          title="Abrir menú de navegación"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 group cursor-pointer">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 siempre-blanco shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
            <span className="font-black text-lg tracking-tighter">RT</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight text-white group-hover:text-blue-400 transition-colors">
                RiderTrack
              </span>
              <span className="px-1.5 py-0.2 text-[10px] font-black rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                V2.4 PRO
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:block">
              Despacho & Telemetría Logística
            </span>
          </div>
        </div>
      </div>

      {/* Center: Smart Search Input */}
      <div className="flex-1 max-w-lg mx-4 hidden md:block">
        <div className="relative group">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar pedido #ID, cliente, repartidor o distrito... (⌘K)"
            className="w-full pl-10 pr-16 py-1.5 text-xs rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/80 transition-all shadow-inner"
          />
          <kbd className="absolute right-3 top-2 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-slate-700/60 rounded border border-slate-600/80 shadow-sm">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Controls & Status Indicators */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Network & Server Health Indicator */}
        <button
          onClick={() => setShowStatusModal(!showStatusModal)}
          className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-medium hover:border-blue-500/50 transition-colors cursor-pointer"
          title="Ver estado de la infraestructura"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Server className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-emerald-400 font-bold text-[11px]">Server: 12ms</span>
        </button>

        {/* WhatsApp Cloud API Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
          <Wifi className="w-3.5 h-3.5" />
          <span>WhatsApp v16.0</span>
        </div>

        {/* Live Clock & Date */}
        <div className="hidden sm:flex flex-col items-end px-2.5 py-0.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs font-mono">
          <span className="text-white font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-400" /> {currentTime || '17:10:00'}
          </span>
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">{currentDate}</span>
        </div>

        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>{language}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showLangDropdown && (
            <div className="absolute right-0 mt-2 w-36 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl z-50 overflow-hidden py-1">
              <button
                onClick={() => handleToggleLang('ES')}
                className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between ${
                  language === 'ES' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <span>🇵🇪 Español</span>
                {language === 'ES' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => handleToggleLang('EN')}
                className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between ${
                  language === 'EN' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <span>🇺🇸 English</span>
                {language === 'EN' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Dark/Light Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
        </button>

        {/* Notifications Dropdown Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Notificaciones"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-slate-950">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-sm text-white">Notificaciones de Sistema</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-400">
                      {unreadCount} nuevas
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkNotificationsRead}
                    className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Check className="w-3.5 h-3.5" /> Marcar leídas
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-700/50 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">Sin notificaciones pendientes</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 transition-colors ${
                        !n.leido ? 'bg-blue-500/5 hover:bg-blue-500/10' : 'hover:bg-slate-700/30'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-white">{n.titulo}</p>
                          <p className="text-xs text-slate-300 mt-0.5 leading-snug">{n.mensaje}</p>
                          <span className="text-[10px] text-slate-400 font-mono mt-1 block">{n.tiempo}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Admin Pill — avatar ilustrado + nombre real (Fase 1.5) */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <button
            onClick={onAbrirAvatarPicker}
            className="relative rounded-2xl focus:outline-none group"
            title="Cambiar mi avatar"
          >
            <AvatarSvg id={riderAvatar} className="w-8 h-8" anillo="ring-2 ring-blue-500/50 shadow-md" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-slate-950 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-2 h-2 text-white" />
            </span>
          </button>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-bold text-white leading-none truncate max-w-[120px]">{riderName}</span>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-2.5 h-2.5" /> Admin Logística
            </span>
          </div>
        </div>
      </div>

      {/* Infrastructure Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base text-white">Estado del Servidor & APIs</h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">Servidores Cloud Run</span>
                  <span className="text-slate-400 text-[11px]">Región us-west2 • HTTP/2</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  12ms Operativo
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">API WhatsApp Cloud Meta</span>
                  <span className="text-slate-400 text-[11px]">v16.0 Webhook Status</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  Verificado 100%
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">GPS Telemetría Flota</span>
                  <span className="text-slate-400 text-[11px]">Precision ±1.8 metros</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  Activo (6 nodos)
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowStatusModal(false)}
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors"
            >
              Cerrar Diagnóstico
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
