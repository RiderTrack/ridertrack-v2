import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Clock,
  Menu,
  Check,
  X,
  ShieldCheck,
  Camera,
  MessageCircle,
  ArrowRight,
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
  /** Fase 3.17: click en una notificación de chat → abre el chat */
  onNotificationClick?: (n: AppNotification) => void;
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
  onNotificationClick,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [currentDateShort, setCurrentDateShort] = useState<string>('');
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
      // Fase 2.5: versión corta para MÓVIL (como el reloj del topbar de la v1:
      // "VIE 28/08") — compacta, no rompe la armonía del header chico
      const dias = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      setCurrentDateShort(`${dias[now.getDay()]} ${d}/${m}`);
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

  // Fase 2.2: eliminado el selector de idioma decorativo y los badges
  // falsos ("Server 12ms", "WhatsApp v16.0") — solo controles reales.

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
              {/* Fase 3.4: en pantallas angostas (<400px) el wordmark se
                  oculta y queda solo el logo RT — antes el header desbordaba
                  ~20px y recortaba el avatar (invis. en teléfonos ≥412px). */}
              <span className="font-black text-base sm:text-lg tracking-tight text-white group-hover:text-blue-400 transition-colors max-[400px]:hidden">
                RiderTrack
              </span>
              {/* Fase 2.5: oculto en pantallas muy chicas para darle
                  espacio al reloj en el header móvil */}
              {/* Fase 3.5: el número de FASE visible en el badge — así
                  siempre sabemos qué build estás probando (F3.14 = fase 3.14) */}
              <span className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-black rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                V2.4 · F3.21
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

      {/* Right Controls & Status Indicators (Fase 2.2: limpio — solo real) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Clock & Date — Fase 2.5: también visible en MÓVIL
            (antes estaba oculto con hidden sm:flex y en el celular
            nunca se veía la hora). En móvil: compacto (hora + día corto,
            como el topbar de la v1). */}
        {/* Versión móvil (compacta) */}
        <div className="flex sm:hidden flex-col items-center px-2 py-0.5 rounded-lg bg-slate-800/60 border border-slate-700/50 leading-none">
          <span className="text-[11px] text-white font-bold font-mono flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5 text-blue-400" /> {currentTime.slice(0, 5)}
          </span>
          <span className="text-[8px] text-slate-400 uppercase tracking-wider mt-0.5">{currentDateShort}</span>
        </div>
        {/* Versión desktop (completa) */}
        <div className="hidden sm:flex flex-col items-end px-2.5 py-0.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs font-mono">
          <span className="text-white font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-400" /> {currentTime || '17:10:00'}
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
                  notifications.map((n) => {
                    // Fase 3.17: las de chat son clickeables → abren el chat
                    const esChat = !!n.canalChat && !!n.telChat;
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (esChat && onNotificationClick) {
                            onNotificationClick(n);
                            setShowNotifications(false);
                          }
                        }}
                        className={`p-3.5 transition-colors ${
                          esChat ? 'cursor-pointer hover:bg-emerald-500/10' : ''
                        } ${
                          !n.leido
                            ? esChat
                              ? 'bg-emerald-500/5'
                              : 'bg-blue-500/5 hover:bg-blue-500/10'
                            : 'hover:bg-slate-700/30'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {esChat ? (
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                n.canalChat === 'baileys'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}
                              title={
                                n.canalChat === 'baileys'
                                  ? 'Chat Baileys (bot Rudy)'
                                  : 'Rider Chat (WhatsApp Oficial)'
                              }
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{n.titulo}</p>
                            <p className="text-xs text-slate-300 mt-0.5 leading-snug">{n.mensaje}</p>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="text-[10px] text-slate-400 font-mono">{n.tiempo}</span>
                              {esChat && (
                                <span className="flex items-center gap-0.5 text-[10px] font-black text-emerald-400">
                                  Abrir chat <ArrowRight className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
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
    </header>
  );
};
