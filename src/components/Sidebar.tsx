import React from 'react';
import {
  LayoutDashboard,
  Route,
  Package,
  Users,
  Bike,
  MapPin,
  MessageSquare,
  BarChart2,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  Music,
  PieChart,
  QrCode,
} from 'lucide-react';
import { NavigationTab } from '../types';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  activeOrdersCount: number;
  activeDriversCount: number;
}

interface MenuItem {
  id: NavigationTab;
  label: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
}

interface MenuSection {
  titulo?: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  activeOrdersCount,
  activeDriversCount,
}) => {
  // Secciones del menú
  const secciones: MenuSection[] = [
    {
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        {
          id: 'ruta',
          label: 'Mi Ruta',
          icon: Route,
          badge: activeOrdersCount > 0 ? `${activeOrdersCount}` : undefined,
          badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        },
        { id: 'yape', label: 'Mi QR Yape', icon: QrCode },
        { id: 'pedidos', label: 'Pedidos', icon: Package },
        { id: 'clientes', label: 'Clientes', icon: Users },
        { id: 'repartidores', label: 'Mi Perfil Rider', icon: Bike },
      ],
    },
    {
      titulo: 'Operación',
      items: [
        { id: 'mapa', label: 'Mapa de Entregas', icon: MapPin },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
      ],
    },
    {
      titulo: 'Análisis',
      items: [
        { id: 'estadisticas', label: 'Resumen del día', icon: PieChart },
      ],
    },
    {
      titulo: 'Sistema',
      items: [
        { id: 'configuracion', label: 'Configuración', icon: Settings },
        { id: 'medios', label: 'Medios', icon: Music },
        { id: 'perfil', label: 'Perfil', icon: User },
      ],
    },
  ];

  const handleTabClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 dark:bg-slate-900 light:bg-slate-900 text-slate-300 select-none">
      {/* Top Collapse toggle header for desktop */}
      <div className="hidden lg:flex items-center justify-between p-4 border-b border-slate-800">
        {!isCollapsed && (
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Navegación
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-auto"
          title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile drawer header */}
      <div className="flex lg:hidden items-center justify-between p-4 border-b border-slate-800">
        <span className="font-bold text-white text-base">RiderTrack V2</span>
        <button
          onClick={onCloseMobile}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
        {secciones.map((seccion, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {seccion.titulo && !isCollapsed && (
              <div className="px-3 pt-3 pb-1 text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                {seccion.titulo}
              </div>
            )}
            {seccion.titulo && isCollapsed && (
              <div className="border-t border-slate-800 my-2 mx-2"></div>
            )}
            {seccion.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`group relative flex items-center w-full px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                      isActive ? 'scale-110 text-white' : 'group-hover:scale-105'
                    }`}
                  />

                  {!isCollapsed && (
                    <span className="ml-3 truncate font-medium">{item.label}</span>
                  )}

                  {!isCollapsed && item.badge && (
                    <span
                      className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Tooltip on collapse */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Profile Section */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/80">
        <div
          onClick={() => handleTabClick('perfil')}
          className={`flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
              alt="Alejandro Ruiz"
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-blue-500/40"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900 animate-pulse" />
          </div>

          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-bold text-white truncate">
                Alejandro Ruiz
              </span>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-400 font-medium text-[11px]">En línea</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden lg:block fixed left-0 top-16 bottom-0 z-30 transition-all duration-300 border-r border-slate-800 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay & Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
