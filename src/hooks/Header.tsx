import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Clock,
  Menu,
  Check,
} from 'lucide-react';
import { ThemeMode, AppNotification } from '../types';
import { UserProfile } from '../hooks/useAuth';

interface HeaderProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onToggleMobileMenu: () => void;
  notifications: AppNotification[];
  onMarkNotificationsRead: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning') => void;
  /** Perfil REAL del usuario logueado (Fase 2.1 — antes mostraba una
   *  foto falsa de Unsplash de "Alejandro Ruiz") */
  profile?: UserProfile | null;
  /** Al tocar el avatar/nombre → abrir la pantalla Mi Perfil */
  onOpenProfile?: () => void;
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
  profile,
  onOpenProfile,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);

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

  // Cerrar notificaciones al tocar fuera
  useEffect(() => {
    const clicFuera = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-notif-toggle]') && !target.closest('[data-notif-panel]')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', clicFuera);
    return () => document.removeEventListener('mousedown', clicFuera);
  }, []);

  // Datos REALES del usuario (Fase 2.1)
  const nombreUsuario = profile?.nombre || 'Repartidor';
  const iniciales = nombreUsuario
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || 'R';

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 md:px-6 border-b bg-[#0f172a]/95 text-slate-100 border-slate-800/80 backdrop-blur-xl shadow-lg transition-colors duration-200 select-none">
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
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
            <span className="font-black text-lg tracking-tighter">RT</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0f172a] animate-pulse" />
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
              Despacho & Entregas
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
            placeholder="Buscar pedido, cliente o distrito... (⌘K)"
            className="w-full pl-10 pr-16 py-1.5 text-xs rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/80 transition-all shadow-inner"
          />
          <kbd className="absolute right-3 top-2 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-slate-700/60 rounded border border-slate-600/80 shadow-sm">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Controls & Status Indicators (Fase 2.1: limpio — sin
          botón de idioma decorativo, sin badges "Server 12ms" ni
          "WhatsApp v16.0" falsos; perfil REAL clicable) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Clock & Date */}
        <div className="hidden sm:flex flex-col items-end px-2.5 py-0.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs font-mono">
          <span className="text-white font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-400" /> {currentTime || '--:--:--'}
          </span>
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">{currentDate}</span>
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
            data-notif-toggle
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Notificaciones"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#0f172a]">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {showNotifications && (
            <div
              data-notif-panel
              className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-sm text-white">Notificaciones</span>
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

        {/* Perfil REAL (Fase 2.1): foto del usuario o iniciales; al
            tocarlo abre "Mi Perfil". Antes era una foto falsa de
            Unsplash ("Alejandro Ruiz") que casi nunca cargaba en el
            APK y se veía como un cuadrito roto. */}
        <div className="flex items-center gap-2.5 pl-1.5 sm:pl-2 border-l border-slate-800">
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 p-1 pr-2 rounded-xl hover:bg-slate-800/80 transition-colors group"
            title="Ver mi perfil"
          >
            {profile?.foto ? (
              <img
                src={profile.foto}
                alt={nombreUsuario}
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-blue-500/50 shadow-md"
              />
            ) : (
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white font-black text-sm shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
                {iniciales}
              </span>
            )}
            <span className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-white leading-none max-w-[140px] truncate">
                {nombreUsuario}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                Rider
              </span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
