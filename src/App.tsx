import React, { useState, useEffect } from 'react';
import { NavigationTab, ThemeMode, Order, Driver, OrderStatus, WhatsAppMessage } from './types';
import {
  INITIAL_DRIVERS,
  INITIAL_ORDERS,
  INITIAL_CUSTOMERS,
  INITIAL_ACTIVITIES,
  INITIAL_WHATSAPP_MESSAGES,
  INITIAL_NOTIFICATIONS,
} from './data/mockData';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { OrdersView } from './components/OrdersView';
import { CustomersView } from './components/CustomersView';
import { DriversView } from './components/DriversView';
import { LiveMap } from './components/LiveMap';
import { WhatsAppView } from './components/WhatsAppView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { ProfileView } from './components/ProfileView';
import { WhatsAppModal } from './components/WhatsAppModal';
import { NewOrderModal } from './components/NewOrderModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { useAuth } from './hooks/useAuth';
import { LoginScreen } from './components/LoginScreen';
import { RutaView } from './components/RutaView';

export default function App() {
  // 🔐 Autenticación
  const { user, profile, loading: authLoading } = useAuth();

  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Core Application Data States
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [drivers, setDrivers] = useState<Driver[]>(INITIAL_DRIVERS);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [activities, setActivities] = useState(INITIAL_ACTIVITIES);
  const [whatsAppMessages, setWhatsAppMessages] = useState<WhatsAppMessage[]>(INITIAL_WHATSAPP_MESSAGES);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  // Toasts system
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Search & Modals
  const [searchQuery, setSearchQuery] = useState('');
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [whatsAppModalDefault, setWhatsAppModalDefault] = useState<{ phone?: string; name?: string }>({});
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);

  const showToast = (title: string, description?: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, description, type }]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Theme Toggler effect
  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    showToast(
      `Modo ${nextTheme === 'dark' ? 'Oscuro' : 'Claro'} Activado`,
      'Preferencia visual actualizada',
      'info'
    );
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [theme]);

  // Order Handlers
  const handleCreateOrder = (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);

    // Append Activity Log
    setActivities((prev) => [
      {
        id: `ACT-${Date.now()}`,
        tipo: 'pedido',
        titulo: 'Nuevo Pedido Creado',
        descripcion: `Pedido ${newOrder.id} de ${newOrder.cliente} en ${newOrder.distrito}`,
        tiempo: 'Hace un instante',
        icono: 'ShoppingBag',
        tipoColor: 'blue',
      },
      ...prev,
    ]);

    showToast(
      'Pedido Registrado',
      `Orden #${newOrder.id} registrada exitosamente para ${newOrder.cliente}`,
      'success'
    );
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return { ...o, estado: newStatus };
        }
        return o;
      })
    );

    // Append Activity Log
    setActivities((prev) => [
      {
        id: `ACT-${Date.now()}`,
        tipo: 'pedido',
        titulo: `Pedido ${orderId} Actualizado`,
        descripcion: `Estado cambiado a "${newStatus}"`,
        tiempo: 'Hace un instante',
        icono: 'CheckCircle2',
        tipoColor: 'green',
      },
      ...prev,
    ]);

    showToast(
      'Estado de Pedido Actualizado',
      `Orden #${orderId} cambió a estado "${newStatus}"`,
      'info'
    );
  };

  const handleUpdatePaymentMethod = (orderId: string, method: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return { ...o, metodoPago: method as any };
        }
        return o;
      })
    );
    showToast('Método de Pago Actualizado', `Pedido ${orderId}: ${method}`, 'success');
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    showToast('Pedido Eliminado', `Orden ${orderId} removida del sistema`, 'warning');
  };

  const handleDuplicateOrder = (orderToDuplicate: Order) => {
    const dupId = `PED-${Math.floor(4000 + Math.random() * 900)}`;
    const duplicated: Order = {
      ...orderToDuplicate,
      id: dupId,
      estado: 'pendiente',
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    };
    setOrders((prev) => [duplicated, ...prev]);
    showToast('Pedido Duplicado', `Nuevo pedido generado: ${dupId}`, 'success');
  };

  // Driver Status Toggler
  const handleToggleDriverStatus = (driverId: string) => {
    let updatedDriverName = '';
    let nextStatus = '';
    setDrivers((prev) =>
      prev.map((d) => {
        if (d.id === driverId) {
          updatedDriverName = d.nombre;
          nextStatus = d.estado === 'disponible' ? 'inactivo' : 'disponible';
          return { ...d, estado: nextStatus as any };
        }
        return d;
      })
    );

    showToast(
      'Estado de Repartidor Cambiado',
      `${updatedDriverName} ahora está ${nextStatus}`,
      'info'
    );
  };

  // WhatsApp Sender Handler
  const handleOpenWhatsAppModal = (phone?: string, name?: string) => {
    setWhatsAppModalDefault({ phone, name });
    setWhatsAppModalOpen(true);
  };

  const handleSendWhatsAppMessage = (
    destName: string,
    phone: string,
    text: string,
    templateName: string
  ) => {
    const newMsg: WhatsAppMessage = {
      id: `WAM-${Math.floor(1000 + Math.random() * 9000)}`,
      destinatarioNombre: destName,
      destinatarioTelefono: phone,
      mensaje: text,
      plantilla: templateName,
      estado: 'leido',
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setWhatsAppMessages((prev) => [newMsg, ...prev]);

    // Append Activity
    setActivities((prev) => [
      {
        id: `ACT-${Date.now()}`,
        tipo: 'whatsapp',
        titulo: 'Notificación WhatsApp Enviada',
        descripcion: `Mensaje a ${destName} (${phone}) despachado con éxito`,
        tiempo: 'Hace un instante',
        icono: 'MessageSquare',
        tipoColor: 'emerald',
      },
      ...prev,
    ]);

    showToast(
      'Mensaje WhatsApp Despachado',
      `Notificación enviada con éxito a ${destName} (${phone})`,
      'success'
    );
  };

  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, leido: true })));
    showToast('Notificaciones Leídas', 'Todas las notificaciones han sido marcadas', 'info');
  };

  const activeOrdersCount = orders.filter((o) => o.estado === 'en_camino').length;
  const activeDriversCount = drivers.filter((d) => d.estado !== 'inactivo').length;

  // 🔄 Mostrar loading mientras verifica auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Cargando RiderTrack V2...</p>
        </div>
      </div>
    );
  }

  // 🔐 Mostrar login si no hay sesión
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div
      className={`min-h-screen ${
        theme === 'dark' ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-100 text-slate-900'
      } font-sans transition-colors duration-200`}
    >
      {/* Top Bar Header */}
      <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onShowToast={showToast}
      />

      {/* Main App Layout */}
      <div className="flex">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          activeOrdersCount={activeOrdersCount}
          activeDriversCount={activeDriversCount}
        />

        {/* Content Area - Mobile first: full width, no left margin on mobile */}
        <main
          className="flex-1 min-w-0 transition-all duration-300 p-2 sm:p-4 lg:p-6 lg:max-w-7xl lg:mx-auto ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
          }"
        >
          {activeTab === 'dashboard' && (
            <DashboardView
              orders={orders}
              drivers={drivers}
              activities={activities}
              whatsAppMessages={whatsAppMessages}
              onOpenWhatsAppModal={handleOpenWhatsAppModal}
              onOpenNewOrderModal={() => setNewOrderModalOpen(true)}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'ruta' && (
            <RutaView onShowToast={showToast} />
          )}

          {activeTab === 'pedidos' && (
            <OrdersView
              orders={orders}
              drivers={drivers}
              onOpenNewOrderModal={() => setNewOrderModalOpen(true)}
              onOpenWhatsAppModal={handleOpenWhatsAppModal}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdatePaymentMethod={handleUpdatePaymentMethod}
              onDeleteOrder={handleDeleteOrder}
              onDuplicateOrder={handleDuplicateOrder}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'clientes' && (
            <CustomersView
              customers={customers}
              onOpenWhatsAppModal={handleOpenWhatsAppModal}
            />
          )}

          {activeTab === 'repartidores' && (
            <DriversView
              drivers={drivers}
              onOpenWhatsAppModal={handleOpenWhatsAppModal}
              onToggleDriverStatus={handleToggleDriverStatus}
            />
          )}

          {activeTab === 'mapa' && (
            <div className="space-y-4 pb-12">
              <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
                <h1 className="text-xl sm:text-2xl font-black text-white">Mapa Interactivo y Telemetría GPS</h1>
                <p className="text-xs text-slate-400">Rastreo GPS diferencial de la flota de despachos en tiempo real</p>
              </div>
              <LiveMap
                drivers={drivers}
                orders={orders}
                onOpenWhatsApp={(phone, name) => handleOpenWhatsAppModal(phone, name)}
              />
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <WhatsAppView
              messages={whatsAppMessages}
              onOpenWhatsAppModal={handleOpenWhatsAppModal}
            />
          )}

          {(activeTab === 'reportes' || activeTab === 'estadisticas') && <AnalyticsView />}

          {activeTab === 'configuracion' && <SettingsView />}

          {activeTab === 'perfil' && <ProfileView />}
        </main>
      </div>

      {/* Toast Notifications Overlay */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* WhatsApp Message Modal */}
      <WhatsAppModal
        isOpen={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        defaultPhone={whatsAppModalDefault.phone}
        defaultName={whatsAppModalDefault.name}
        onSendMessage={handleSendWhatsAppMessage}
      />

      {/* New Order Creation Modal */}
      <NewOrderModal
        isOpen={newOrderModalOpen}
        onClose={() => setNewOrderModalOpen(false)}
        drivers={drivers}
        onCreateOrder={handleCreateOrder}
      />
    </div>
  );
}
