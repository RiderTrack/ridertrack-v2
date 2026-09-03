import React, { useState } from 'react';
import {
  LayoutDashboard,
  Route,
  Package,
  Users,
  Bike,
  MapPin,
  BarChart2,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  Music,
  PieChart,
  QrCode,
  Radar,
  Camera,
  History,
  Megaphone,
  Cloud,
  Navigation,
  TrendingUp,
  Images,
  Bot,
  SlidersHorizontal,
  MessageSquare,
  Store,
} from 'lucide-react';
import { NavigationTab } from '../types';
import { AvatarSvg } from '../data/avatars';
import { AvatarPicker } from './AvatarPicker';
// Fase 3.35/3.40: 🛣️ kilometraje en el menú — BOTÓN como las
// demás opciones (F3.40); el modal trae las stats + calibración
import { OdometroMenuBoton, OdometroMenuStats, OdometroCard } from './OdometroCard';
// F3.36/3.40: 🔧 mantenimiento de la moto — BOTÓN de menú (badge
// rojo si algo venció); el gestor completo vive en su modal
import { MantenimientoMenuBoton, MantenimientoCard } from './MantenimientoCard';
// F3.39/3.40: 💰 caja del día — BOTÓN de menú (badge con el
// esperado); el gestor completo vive en su modal
import { CajaMenuBoton, CajaCard } from './CajaCard';
// F3.41: 📊 resumen diario → WhatsApp (paso 5 del plan)
import { ResumenMenuBoton, ResumenDiarioCard } from './ResumenDiarioCard';
// F3.42: 🎙️ el podcast de la jornada (paso 6, el final del plan)
import { PodcastMenuBoton, PodcastCard } from './PodcastCard';
import { Modal } from './ui';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  activeOrdersCount: number;
  activeDriversCount: number;
  /** Fase 3.1: chats sin leer del bot de Baileys (badge del menú) */
  chatNoLeidos?: number;
  /** Fase 3.15: chats sin leer del Rider Chat Oficial (badge del menú) */
  riderChatNoLeidos?: number;
  /** Nombre real del rider (perfil) */
  riderName?: string;
  /** Avatar ilustrado elegido (Fase 1.5) */
  riderAvatar?: string;
  onSeleccionarAvatar?: (avatarId: string) => Promise<void>;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  /** Fase 3.35: uid del rider — para las stats del odómetro en el menú */
  uid?: string | null;
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
  chatNoLeidos = 0,
  riderChatNoLeidos = 0,
  riderName = 'Rider',
  riderAvatar,
  onSeleccionarAvatar,
  onShowToast,
  uid,
}) => {
  const [pickerAbierto, setPickerAbierto] = useState(false);
  // F3.38: 🔧 modal del gestor de mantenimiento (menú hamburguesa)
  const [mantGestionAbierto, setMantGestionAbierto] = useState(false);
  // F3.39: 💰 modal del gestor de caja (menú hamburguesa)
  const [cajaGestionAbierto, setCajaGestionAbierto] = useState(false);
  // F3.40: 🛣️ modal de kilometraje (stats + calibración) — antes
  // era un bloque grande abajo; ahora es un botón como los demás
  const [odoGestionAbierto, setOdoGestionAbierto] = useState(false);
  // F3.41: 📊 modal del resumen diario → WhatsApp
  const [resGestionAbierto, setResGestionAbierto] = useState(false);
  // F3.42: 🎙️ modal del podcast de la jornada
  const [podGestionAbierto, setPodGestionAbierto] = useState(false);

  // F3.40: abre un gestor cerrando el drawer móvil primero (el
  // drawer va en z-[1200], tapa los modales z-50)
  const abrirGestion = (cual: 'odo' | 'mant' | 'caja' | 'res' | 'pod') => {
    if (isMobileOpen) onCloseMobile();
    if (cual === 'odo') setOdoGestionAbierto(true);
    else if (cual === 'mant') setMantGestionAbierto(true);
    else if (cual === 'caja') setCajaGestionAbierto(true);
    else if (cual === 'res') setResGestionAbierto(true);
    else setPodGestionAbierto(true);
  };

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
        {
          id: 'seguimiento',
          label: 'Seguimiento de ruta',
          icon: Navigation,
          badge: activeOrdersCount > 0 ? `${activeOrdersCount}` : undefined,
          badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        },
        { id: 'yape', label: 'Mi QR Yape/Plin', icon: QrCode },
        { id: 'pedidos', label: 'Pedidos', icon: Package },
        { id: 'clientes', label: 'Clientes', icon: Users },
        { id: 'repartidores', label: 'Mi Perfil Rider', icon: Bike },
      ],
    },
    // F3.40: 🛣️🔧💰 LA JORNADA — antes eran 3 bloques grandes que
    // saturaban el final del menú; ahora son BOTONES como los
    // demás (icono + nombre + badge) y cada uno abre su gestor.
    {
      titulo: 'Jornada',
      items: [],
    },
    {
      titulo: 'Operación',
      items: [
        { id: 'mapa', label: 'Mapa de Entregas', icon: MapPin },
        { id: 'motorizados', label: 'GPS del Motorizado', icon: Radar },
        { id: 'broadcast', label: 'Broadcast WhatsApp', icon: Megaphone },
        { id: 'galeria', label: 'Galería de Entregas', icon: Images },
        {
          id: 'whatsapp',
          label: 'Chat Baileys',
          icon: Bot,
          badge: chatNoLeidos > 0 ? `${chatNoLeidos}` : undefined,
          badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        },
        {
          id: 'chatapi',
          label: 'Rider Chat Oficial',
          icon: MessageSquare,
          badge: riderChatNoLeidos > 0 ? `${riderChatNoLeidos}` : undefined,
          badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        },
        { id: 'catalogo', label: 'Catálogo', icon: Store },
        { id: 'plantillas', label: 'Centro del Bot', icon: SlidersHorizontal },
      ],
    },
    {
      titulo: 'Análisis',
      items: [
        { id: 'stats', label: 'Estadísticas', icon: TrendingUp },
        { id: 'estadisticas', label: 'Resumen del día', icon: PieChart },
        { id: 'historial', label: 'Historial de rutas', icon: History },
      ],
    },
    {
      titulo: 'Sistema',
      items: [
        { id: 'backups', label: 'Backups en la nube', icon: Cloud },
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
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 select-none">
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

      {/* Mobile drawer header — Fase 3.5: número de fase visible para
          saber SIEMPRE qué build se está probando en el teléfono */}
      <div className="flex lg:hidden items-center justify-between p-4 border-b border-slate-800">
        <div className="flex flex-col">
          <span className="font-bold text-white text-base">RiderTrack V2</span>
          <span className="text-[10px] text-blue-400 font-bold font-mono tracking-wider">FASE 3.48</span>
        </div>
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
            {/* F3.40: 🛣️🔧💰 JORNADA — botones IGUAL a las demás
                opciones del menú. Cada uno abre su gestor (modal);
                el badge muestra el dato clave al pasar la vista. */}
            {seccion.titulo === 'Jornada' ? (
              <>
                <OdometroMenuBoton uid={uid} colapsado={isCollapsed} onAbrir={() => abrirGestion('odo')} />
                <MantenimientoMenuBoton uid={uid} colapsado={isCollapsed} onAbrir={() => abrirGestion('mant')} />
                <CajaMenuBoton uid={uid} colapsado={isCollapsed} onAbrir={() => abrirGestion('caja')} />
                {/* F3.41: 📊 resumen del día → grupo MATE de un toque */}
                <ResumenMenuBoton uid={uid} colapsado={isCollapsed} onAbrir={() => abrirGestion('res')} />
                {/* F3.42: 🎙️ el podcast — tu día contado en voz alta */}
                <PodcastMenuBoton uid={uid} colapsado={isCollapsed} onAbrir={() => abrirGestion('pod')} />
              </>
            ) : (
              seccion.items.map((item) => {
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
              })
            )}
          </div>
        ))}
      </nav>

      {/* (F3.40) El kilometraje, mantenimiento y caja ya viven como
          BOTONES en la sección "Jornada" del menú — mismo look que
          las demás opciones, cero saturación. Sus gestores completos
          abren en modales (abajo, una sola renderización). */}

      {/* Bottom Profile Section — avatar ilustrado + picker (Fase 1.5) */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/80">
        <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition-colors`}>
          <div className="relative group/avatar">
            <button
              onClick={() => setPickerAbierto(true)}
              className="block rounded-2xl focus:outline-none"
              title="Cambiar mi avatar"
            >
              <AvatarSvg id={riderAvatar} className="w-10 h-10" anillo="ring-2 ring-blue-500/40" />
            </button>
            <button
              onClick={() => setPickerAbierto(true)}
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center hover:bg-blue-500 transition-colors"
              title="Cambiar avatar"
            >
              <Camera className="w-2.5 h-2.5 text-white" />
            </button>
            <span className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900 animate-pulse" />
          </div>

          {!isCollapsed && (
            <div
              className="flex flex-col min-w-0 flex-1 cursor-pointer"
              onClick={() => handleTabClick('perfil')}
            >
              <span className="text-sm font-bold text-white truncate">{riderName}</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-400 font-medium text-[11px]">En línea</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selector de avatar estilo Netflix */}
      <AvatarPicker
        isOpen={pickerAbierto}
        onClose={() => setPickerAbierto(false)}
        avatarActual={riderAvatar}
        onSeleccionar={async (id) => {
          if (onSeleccionarAvatar) await onSeleccionarAvatar(id);
        }}
        onShowToast={onShowToast}
      />
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

      {/* Mobile Overlay & Drawer — z-[1200]: por encima de los controles
          del mapa (Leaflet/Google), fix Fase 2.2 "la leyenda tapa la hamburguesa" */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[1200] flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-[1201]">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* 🔧 F3.38: GESTOR COMPLETO de mantenimiento — modal que abre
          desde el menú hamburguesa. Se renderiza UNA sola vez (fuera
          de sidebarContent, que existe doble: desktop + drawer) para
          no duplicar el backdrop. En móvil el drawer se cierra antes. */}
      <Modal
        isOpen={mantGestionAbierto}
        onClose={() => setMantGestionAbierto(false)}
        title="🔧 Mantenimiento de la moto"
        subtitle="Recordatorios con los km del odómetro GPS"
        maxWidth="lg"
      >
        <MantenimientoCard uid={uid} onShowToast={onShowToast} />
      </Modal>

      {/* 💰 F3.39: GESTOR de la caja del día — modal que abre desde
          el menú hamburguesa. Mismo patrón del de mantenimiento:
          UNA sola renderización fuera de sidebarContent. */}
      <Modal
        isOpen={cajaGestionAbierto}
        onClose={() => setCajaGestionAbierto(false)}
        title="💰 Caja del día"
        subtitle="Gastos + cierre con conteo físico"
        maxWidth="lg"
      >
        <CajaCard uid={uid} riderName={riderName} onShowToast={onShowToast} />
      </Modal>

      {/* 🛣️ F3.40: KILOMETRAJE — stats (Hoy/Ayer/7d/Total) + la
          tarjeta completa del odómetro (calibración por viaje,
          pantalla viva, reiniciar) en un solo modal. Antes el bloque
          de stats vivía fijo abajo del menú y lo saturaba. */}
      <Modal
        isOpen={odoGestionAbierto}
        onClose={() => setOdoGestionAbierto(false)}
        title="🛣️ Kilometraje (odómetro GPS)"
        subtitle="Stats del odómetro · calibración · pantalla viva"
        maxWidth="lg"
      >
        <div className="space-y-3">
          <OdometroMenuStats uid={uid} />
          <OdometroCard uid={uid} onShowToast={onShowToast} />
        </div>
      </Modal>

      {/* 📊 F3.41: RESUMEN DEL DÍA → WHATSAPP — vista previa del
          día completo (ruta + plata + caja + km + tiempo) y el
          mensaje EXACTO que llega al grupo MATE, con ENVIAR (el
          bot lo manda) y COPIAR de respaldo. */}
      <Modal
        isOpen={resGestionAbierto}
        onClose={() => setResGestionAbierto(false)}
        title="📊 Resumen del día → WhatsApp"
        subtitle="Vista previa + enviar al grupo MATE"
        maxWidth="md"
      >
        <ResumenDiarioCard uid={uid} riderName={riderName} onShowToast={onShowToast} />
      </Modal>

      {/* 🎙️ F3.42: EL PODCAST DE TU JORNADA — reproductor de radio
          con el episodio de hoy y el de la semana: capítulos,
          progreso, velocidad, pausa que retoma por la frase. La
          voz es la del teléfono (la misma de la navegación). */}
      <Modal
        isOpen={podGestionAbierto}
        onClose={() => setPodGestionAbierto(false)}
        title="🗣️ Jornada hablada"
        subtitle="Tu día y tu semana, contados en voz alta (radio F3.42)"
        maxWidth="md"
      >
        <PodcastCard uid={uid} riderName={riderName} />
      </Modal>
    </>
  );
};
