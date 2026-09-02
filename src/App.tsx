import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
// F3.28: deep link de Spotify capturado a NIVEL TOP (login incluido)
import { parsearCallbackSpotify, spotifyExchangeCode } from './services/spotify';
import { NavigationTab, ThemeMode, Order, Driver, OrderStatus, WhatsAppMessage, AppNotification, ActivityItem } from './types';
import { Cliente } from './services/firestore';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { OrdersView } from './components/OrdersView';
import { CustomersView } from './components/CustomersView';
import { DriversView } from './components/DriversView';
import { LiveMap } from './components/LiveMap';
import { MotorizadosView } from './components/MotorizadosView';
import { AvatarPicker } from './components/AvatarPicker';
import { WhatsAppModal } from './components/WhatsAppModal';
// Fase 3.1: Chat de Baileys estilo WhatsApp Web (mudanza ClienteTrack)
import { ChatBaileysView } from './components/ChatBaileysView';
// Fase 3.15: RiderChat (WhatsApp Oficial Meta) acoplado al panel —
// la app RiderChat V2 completa ahora vive en la pestaña chatapi
import { RiderChatView } from './components/riderchat/RiderChatView';
import { CatalogoView } from './components/CatalogoView';
import { BotControlView } from './components/BotControlView';
import { ResumenView } from './components/ResumenView';
import { SettingsView } from './components/SettingsView';
import { ProfileView } from './components/ProfileView';
import { MediosView } from './components/MediosView';
// Fase 3.11: Medios — radio/Spotify/YouTube globales (siguen sonando al cambiar de pestaña)
import { MediosProvider } from './components/medios/MediosProvider';
import { MiniPlayerReproductor } from './components/medios/MiniPlayerReproductor';
import { NewOrderModal } from './components/NewOrderModal';
import { ToastContainer, ToastMessage } from './components/Toast';
// Fase 3.17: avisos globales de chat (campanita + toast flotante)
import { AvisoChatToast } from './components/AvisoChatToast';
import {
  iniciarAvisosChat,
  suscribirAvisos,
  AvisoChat,
  CanalChat,
  formatearTiempoAviso,
} from './services/avisosChat';
import { sonarMensaje } from './services/notificaciones';
import { useAuth } from './hooks/useAuth';
import { useClientes } from './hooks/useClientes';
import { LoginScreen } from './components/LoginScreen';
import { RutaView } from './components/RutaView';
import { SeguimientoView } from './components/SeguimientoView';
import { YapeQRView } from './components/YapeQRView';
// Fase 2.5: vistas nuevas — historial, broadcast y backups
import { HistorialView } from './components/HistorialView';
import { BroadcastView } from './components/BroadcastView';
import { BackupsView } from './components/BackupsView';
import { EstadisticasView } from './components/EstadisticasView';
import { GaleriaView } from './components/GaleriaView';
import { guardarAvatarRider } from './services/firestore';
// Fase 3.35: 🛣️ motor del odómetro GPS — 1 solo mount a nivel App:
// cuenta km en TODAS las pestañas mientras el cronómetro de ruta corre
import { MotorOdometro } from './components/OdometroCard';
import { db } from './services/firebase';
import { collection, onSnapshot, query, where, limit as fsLimit } from 'firebase/firestore';
import { getEstiloMapa, setEstiloMapa, EstiloMapa } from './services/mapStyle';
import {
  clientesAOrdenes,
  clientesACustomers,
  riderADriver,
  construirActividades,
  construirNotificaciones,
  METODO_PANEL_A_ST,
  ETIQUETAS_ESTADO,
  linkWhatsApp,
} from './utils/realData';

// ═══════════════════════════════════════════════════════════
// 🛡️ Fase 3.5: ErrorBoundary de vistas — una sección que falle
// NUNCA más deja la pantalla en blanco: muestra tarjeta con el
// error y botón Reintentar. Al cambiar de pestaña se resetea sola
// (key={activeTab}). El menú y el resto de la app siguen vivos.
// ═══════════════════════════════════════════════════════════
const NOMBRES_TAB: Partial<Record<NavigationTab, string>> = {
  dashboard: 'Dashboard',
  ruta: 'Mi Ruta',
  seguimiento: 'Seguimiento',
  yape: 'Mi QR Yape',
  pedidos: 'Pedidos',
  clientes: 'Clientes',
  repartidores: 'Mi Perfil Rider',
  mapa: 'Mapa de Entregas',
  motorizados: 'GPS del Motorizado',
  whatsapp: 'Chat Baileys',
  chatapi: 'Rider Chat Oficial',
  catalogo: 'Catálogo',
  plantillas: 'Centro del Bot',
  broadcast: 'Broadcast',
  historial: 'Historial',
  stats: 'Estadísticas',
  galeria: 'Galería',
  estadisticas: 'Resumen del día',
  backups: 'Backups',
  configuracion: 'Configuración',
  medios: 'Medios',
  perfil: 'Perfil',
};

// Nota: este proyecto no usa @types/react (React se infiere desde JS),
// por eso el extends va con cast — mismo patrón runtime, sin pelear con tsc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactComponentBase: any = (React as any).Component;

class VistaBoundary extends ReactComponentBase {
  // Declaraciones de forma (no se inicializan: las llena React)
  props: { children?: React.ReactNode; nombre?: string };
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[VistaBoundary] ' + this.props.nombre + ':', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border border-red-500/30 bg-red-500/[0.06]">
          <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
          <div className="text-sm font-black text-white">
            «{this.props.nombre}» no pudo cargar
          </div>
          <p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed">
            {String(this.state.error.message || 'Error desconocido').slice(0, 160)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            El resto de la app sigue funcionando — reintenta o abre otra sección del menú.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // 🔐 Autenticación
  const { user, profile, loading: authLoading } = useAuth();

  // 📋 Datos REALES de la ruta (Firestore: ruta_activa + clientes_registrados)
  const {
    clientes,
    loading: clientesLoading,
    sincronizando,
    stats,
    agregarCliente,
    actualizarCliente,
    eliminarCliente,
    cambiarEstado,
    guardarFotoEntrega,
  } = useClientes();

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const guardado = localStorage.getItem('rt_theme');
      if (guardado === 'light' || guardado === 'dark') return guardado;
    } catch {
      // sin storage
    }
    return 'dark';
  });
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Picker de avatar (se abre desde header y sidebar) — Fase 1.5
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  // Log de mensajes WhatsApp despachados desde la app (sesión actual)
  const [whatsAppMessages, setWhatsAppMessages] = useState<WhatsAppMessage[]>([]);

  // Fase 3.1: contador de chats sin leer del bot (badge del Sidebar)
  const [chatNoLeidos, setChatNoLeidos] = useState(0);
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'mensajes_clientes'), where('leido', '==', false), fsLimit(200));
    const unsub = onSnapshot(
      q,
      (snap) => setChatNoLeidos(snap.size),
      (err) => console.warn('[ChatBaileys] badge no leídos:', err.message)
    );
    return () => unsub();
  }, []);

  // Fase 3.15: no leídos del Rider Chat (WhatsApp Oficial) → badge del menú
  const [riderChatNoLeidos, setRiderChatNoLeidos] = useState(0);

  // ═════════════════════════════════════════
  // 🔔 Fase 3.17: AVISOS GLOBALES DE CHAT — aunque estés en Mi Ruta,
  // Pedidos o donde sea, si un cliente te escribe al Chat Baileys
  // o al Rider Chat (Meta) aparece: toast flotante con "Ver chat",
  // notificación en la campanita del header y sonido.
  // ═════════════════════════════════════════
  const [avisosFlotantes, setAvisosFlotantes] = useState<AvisoChat[]>([]);
  const [notifsChat, setNotifsChat] = useState<AppNotification[]>([]);
  // chat que la app debe abrir en cuanto se monte la vista del canal
  const [chatPendiente, setChatPendiente] = useState<{ canal: CanalChat; tel: string } | null>(null);
  // qué chat está abierto en cada vista (para NO avisar lo que ya ves)
  const [chatActivoPorCanal, setChatActivoPorCanal] = useState<Partial<Record<CanalChat, string | null>>>({});

  // Refs de activeTab/chatActivo para leerlos dentro del handler
  // del aviso sin re-arrancar la suscripción en cada cambio
  const activeTabRef = useRef<NavigationTab>(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const chatActivoPorCanalRef = useRef(chatActivoPorCanal);
  useEffect(() => {
    chatActivoPorCanalRef.current = chatActivoPorCanal;
  }, [chatActivoPorCanal]);

  useEffect(() => {
    if (!user) return;
    iniciarAvisosChat();
    return suscribirAvisos((aviso) => {
      // 1) Notificación de la campanita (arriba de la lista)
      setNotifsChat((prev) =>
        [
          {
            id: 'NCHAT-' + aviso.id,
            titulo: `💬 ${aviso.nombre}`,
            mensaje: aviso.texto,
            tiempo: formatearTiempoAviso(aviso.timestamp),
            leido: false,
            tipo: 'whatsapp' as const,
            canalChat: aviso.canal,
            telChat: aviso.tel,
          },
          ...prev,
        ].slice(0, 8)
      );
      setNotificacionesLeidas(false);

      // 2) ¿Está viendo ESTE chat ahora? → ni toast ni sonido
      const tabDelCanal: NavigationTab = aviso.canal === 'baileys' ? 'whatsapp' : 'chatapi';
      const viendoEsteChat =
        activeTabRef.current === tabDelCanal && chatActivoPorCanalRef.current[aviso.canal] === aviso.tel;
      if (viendoEsteChat) return;

      // 3) Toast flotante con "Ver chat" (máx 3, los más recientes)
      setAvisosFlotantes((prev) => [...prev, aviso].slice(-3));
      const idAviso = aviso.id;
      setTimeout(() => {
        setAvisosFlotantes((prev) => prev.filter((a) => a.id !== idAviso));
      }, 9000);

      // 4) Sonido solo si NO estás en la pestaña del chat (la vista
      //    ya suena por su lado cuando está abierta — sin doble beep)
      if (activeTabRef.current !== tabDelCanal) {
        sonarMensaje();
      }
    });
  }, [user]);

  /** Ver un aviso (toast o campanita): pestaña del canal + abrir el chat */
  const handleVerAvisoChat = (canal: CanalChat, tel: string) => {
    setChatPendiente({ canal, tel });
    setActiveTab(canal === 'baileys' ? 'whatsapp' : 'chatapi');
    setIsMobileMenuOpen(false);
  };

  // Actividades en vivo (eventos de esta sesión, se fusionan con las derivadas)
  const [liveActivities, setLiveActivities] = useState<ActivityItem[]>([]);
  const [notificacionesLeidas, setNotificacionesLeidas] = useState(false);

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

  // ═════════════════════════════════════════
  // 🎵 FASE 3.28 — DEEP LINK DE SPOTIFY A NIVEL TOP
  // El listener vivía dentro de MediosProvider, que solo se monta
  // cuando Firebase YA restauró la sesión. Al volver de Spotify:
  //   • App viva (warm) → a veces andaba
  //   • App re-abierta en FRÍO (Android la mató mientras estabas en
  //     el navegador de Spotify — lo normal con "no mantener
  //     actividades" o falta de RAM) → el evento appUrlOpen llegaba
  //     ANTES de que existiera el listener → el código se perdía en
  //     silencio → "acepto en Spotify y no pasa nada".
  // Ahora App (siempre montado, también en el LoginScreen) captura
  // por DOS vías, con dedupe por código (algunos Androids disparan
  // ambas):
  //   1) getLaunchUrl() — la URL que LANZÓ la app (arranque en frío)
  //   2) appUrlOpen — la app ya estaba viva y vuelve del navegador
  // El intercambio lo hace el servicio directo (no necesita sesión
  // ni al Medios montado); cuando entras, MediosProvider encuentra
  // el token y arranca el reproductor.
  // ═════════════════════════════════════════
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; });

  const ultimoCodigoSpotifyRef = useRef<string | null>(null);
  useEffect(() => {
    async function procesarDeepLink(url: string) {
      const cb = parsearCallbackSpotify(url);
      if (!cb) return; // no era nuestro callback (maps, wa.me, etc.)
      if (cb.error) {
        showToastRef.current('⚠️ Spotify', 'No aceptaste el permiso de conexión', 'warning');
        return;
      }
      if (!cb.code || cb.code === ultimoCodigoSpotifyRef.current) return; // dedupe
      ultimoCodigoSpotifyRef.current = cb.code;
      const res = await spotifyExchangeCode(cb.code);
      if (res.ok) {
        showToastRef.current('🎵 Spotify conectado', 'Elige una playlist y dale play', 'success');
      } else if (res.motivo === 'redirect-uri') {
        showToastRef.current(
          '⚠️ Spotify',
          'Falta registrar com.ridertrack.v2://callback en el dashboard de Spotify (1 sola vez) — mira la guía en Medios → Spotify',
          'warning'
        );
      } else if (res.motivo === 'sin-verifier') {
        // Código repetido o login viejo — silencio, no es error del usuario
        ultimoCodigoSpotifyRef.current = null; // permite reintentar con un código nuevo
      } else {
        showToastRef.current('⚠️ Spotify', 'No se pudo completar la conexión — revisa tu internet y vuelve a conectar', 'warning');
      }
    }

    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        if (!Capacitor.isNativePlatform?.()) return; // solo APK
        sub = await CapApp.addListener('appUrlOpen', (data: any) => {
          procesarDeepLink(String(data?.url || ''));
        });
        // Arranque en frío: la app se ABRÓ por el deep link (no estaba
        // viva) → appUrlOpen puede no llegar → preguntar por la URL
        // que la lanzó.
        const lanzamiento = await CapApp.getLaunchUrl().catch(() => null);
        if (lanzamiento?.url) procesarDeepLink(String(lanzamiento.url));
      } catch { /* plugin no disponible — web/dev */ }
    })();
    return () => { try { sub?.remove?.(); } catch { /* ya removido */ } };
  }, []);

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const registrarActividad = (titulo: string, descripcion: string, tipo: ActivityItem['tipo'], tipoColor: ActivityItem['tipoColor'], icono: string) => {
    setLiveActivities((prev) => [
      {
        id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipo,
        titulo,
        descripcion,
        tiempo: 'Hace un instante',
        icono,
        tipoColor,
      },
      ...prev,
    ]);
  };

  // Theme Toggler effect — Fase 1.5: conversión COMPLETA (la
  // paleta se invierte por variables CSS en index.css) + el mapa
  // sigue al tema + se recuerda tu preferencia.
  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('rt_theme', nextTheme);
    } catch {
      // sin storage
    }

    // El mapa acompaña al tema (si usas un skin auto: oscuro/claro)
    const estiloActual = getEstiloMapa();
    if (estiloActual === 'oscuro' || estiloActual === 'claro') {
      const nuevoEstilo: EstiloMapa = nextTheme === 'light' ? 'claro' : 'oscuro';
      if (nuevoEstilo !== estiloActual) {
        setEstiloMapa(nuevoEstilo);
        window.dispatchEvent(new Event('rt_theme'));
      }
    }

    showToast(
      `Modo ${nextTheme === 'dark' ? 'Oscuro' : 'Claro'} Activado`,
      nextTheme === 'light'
        ? 'Ideal para el sol: todo se convierte (letras, botones y mapa)'
        : 'Tema oscuro de siempre',
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

  // 🔐 Inicializar GoogleAuth plugin (solo en APK)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      import('@codetrix-studio/capacitor-google-auth').then(({ GoogleAuth }) => {
        GoogleAuth.initialize();
      }).catch(err => {
        console.error('Error inicializando GoogleAuth:', err);
      });
    }
  }, []);

  // ═════════════════════════════════════════════════════════
  // 🔄 DERIVADOS: datos reales → formato de la UI
  // ═════════════════════════════════════════════════════════

  const riderName = profile?.nombre || 'Rider';

  const orders = useMemo(
    () => clientesAOrdenes(clientes, riderName),
    [clientes, riderName]
  );

  const customers = useMemo(() => clientesACustomers(clientes), [clientes]);

  const drivers = useMemo<Driver[]>(
    () => [riderADriver(user?.uid || 'rider', riderName, profile?.foto, stats.entregados)],
    [user, riderName, profile, stats.entregados]
  );

  const derivedActivities = useMemo(() => construirActividades(clientes), [clientes]);
  const activities = useMemo(
    () => [...liveActivities, ...derivedActivities].slice(0, 12),
    [liveActivities, derivedActivities]
  );

  const notifications = useMemo<AppNotification[]>(() => {
    const base = construirNotificaciones(clientes, stats);
    const baseFinal = notificacionesLeidas ? base.map((n) => ({ ...n, leido: true })) : base;
    // Fase 3.17: los mensajes de chat van PRIMERO (lo más fresco)
    const chatFinal = notificacionesLeidas
      ? notifsChat.map((n) => ({ ...n, leido: true }))
      : notifsChat;
    return [...chatFinal, ...baseFinal];
  }, [clientes, stats, notificacionesLeidas, notifsChat]);

  const pendientesCount = stats.pendientes;

  // ═════════════════════════════════════════════════════════
  // 🔎 HELPERS: buscar el Cliente real detrás de una Orden
  // ═════════════════════════════════════════════════════════

  const clientePorOrdenId = (orderId: string): Cliente | undefined =>
    clientes.find((c) => String(c.id) === orderId);

  // ═════════════════════════════════════════════════════════
  // ✅ HANDLERS: todos persisten en Firestore (ruta_activa)
  // ═════════════════════════════════════════════════════════

  // Crear pedido (= agregar cliente a la ruta actual)
  const handleCreateOrder = (draft: {
    nombre: string;
    cel: string;
    prod: string;
    monto: number;
    dir: string;
    dist: string;
    obs: string;
  }) => {
    const num = clientes.length > 0 ? Math.max(...clientes.map((c) => c.num || 0)) + 1 : 1;
    agregarCliente({
      id: Date.now(),
      num,
      nombre: draft.nombre,
      cel: draft.cel,
      prod: draft.prod,
      precio: draft.monto,
      cobrar: draft.monto,
      dir: draft.dir,
      dist: draft.dist,
      obs: draft.obs,
      st: 'pendiente',
      mEf: 0, mYp: 0, mEmp: 0, mVt: 0, mEM: '', hora: '', nota: '',
    });

    registrarActividad(
      'Pedido agregado a la ruta',
      `${draft.nombre} — S/ ${draft.monto.toFixed(2)} (${draft.dist || 'sin distrito'})`,
      'pedido',
      'blue',
      'ShoppingBag'
    );

    showToast(
      'Pedido Registrado',
      `${draft.nombre} agregado a la ruta como entrega #${num}`,
      'success'
    );
  };

  // Registrar pago: método del panel → st real + hora
  const handleRegistrarPago = (orderId: string, metodoPanel: string) => {
    const cliente = clientePorOrdenId(orderId);
    if (!cliente) return;
    const st = METODO_PANEL_A_ST[metodoPanel] || 'efectivo';
    cambiarEstado(cliente.id, st);

    registrarActividad(
      'Pago registrado',
      `${cliente.nombre} — S/ ${parseFloat(String(cliente.cobrar || 0)).toFixed(2)} vía ${ETIQUETAS_ESTADO[st] || st}`,
      'pedido',
      'green',
      'CheckCircle2'
    );

    showToast(
      'Pago Registrado',
      `${cliente.nombre}: S/ ${parseFloat(String(cliente.cobrar || 0)).toFixed(2)} vía ${ETIQUETAS_ESTADO[st] || st}`,
      'success'
    );
  };

  // Cambiar estado (resoluciones: fallida, rechazado, ausente, reabrir...)
  const handleCambiarEstado = (orderId: string, st: string) => {
    const cliente = clientePorOrdenId(orderId);
    if (!cliente) return;
    cambiarEstado(cliente.id, st);

    const esReapertura = st === 'pendiente';
    registrarActividad(
      esReapertura ? 'Pedido reabierto' : 'Estado actualizado',
      `${cliente.nombre} → ${ETIQUETAS_ESTADO[st] || st}`,
      'pedido',
      esReapertura ? 'blue' : 'amber',
      esReapertura ? 'RotateCcw' : 'AlertTriangle'
    );

    showToast(
      esReapertura ? 'Pedido Reabierto' : 'Estado Actualizado',
      `${cliente.nombre}: ${ETIQUETAS_ESTADO[st] || st}`,
      esReapertura ? 'info' : 'warning'
    );
  };

  // Compatibilidad con vistas que usan OrderStatus genérico
  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const stMap: Record<OrderStatus, string> = {
      pendiente: 'pendiente',
      en_camino: 'pendiente',
      entregado: 'efectivo',
      cancelado: 'cancelado',
    };
    handleCambiarEstado(orderId, stMap[newStatus]);
  };

  const handleUpdatePaymentMethod = (orderId: string, method: string) => {
    handleRegistrarPago(orderId, method);
  };

  const handleDeleteOrder = (orderId: string) => {
    const cliente = clientePorOrdenId(orderId);
    if (!cliente) return;
    eliminarCliente(cliente.id);
    showToast('Pedido Eliminado', `${cliente.nombre} removido de la ruta`, 'warning');
  };

  const handleDuplicateOrder = (orderToDuplicate: Order) => {
    const cliente = clientePorOrdenId(orderToDuplicate.id);
    if (!cliente) return;
    const num = clientes.length > 0 ? Math.max(...clientes.map((c) => c.num || 0)) + 1 : 1;
    agregarCliente({
      ...cliente,
      id: Date.now(),
      num,
      st: 'pendiente',
      hora: '',
      fotoUrl: undefined,
      nota: '',
    });
    showToast('Pedido Duplicado', `Nuevo pedido de ${cliente.nombre} como entrega #${num}`, 'success');
  };

  // 📷 Foto de evidencia (real: Storage con fallback base64)
  const handleGuardarFoto = async (orderId: string, blob: Blob, dataUrl: string) => {
    const cliente = clientePorOrdenId(orderId);
    if (!cliente) return;
    try {
      await guardarFotoEntrega(cliente.id, blob, dataUrl);
      registrarActividad(
        'Evidencia guardada',
        `Foto de entrega de ${cliente.nombre}`,
        'pedido',
        'purple',
        'Camera'
      );
      showToast('Evidencia Guardada', `Foto de entrega de ${cliente.nombre} guardada`, 'success');
    } catch (e: any) {
      showToast('Error al guardar foto', e?.message || 'Intenta de nuevo', 'error');
    }
  };

  // 📝 Nota del pedido (real: se guarda en el cliente)
  const handleGuardarNota = (orderId: string, nota: string) => {
    const cliente = clientePorOrdenId(orderId);
    if (!cliente) return;
    actualizarCliente(cliente.id, { nota });
    showToast('Nota Guardada', `Nota de ${cliente.nombre} actualizada`, 'success');
  };

  // WhatsApp Sender Handler (real: abre wa.me + registra en el log)
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
    const digits = (phone || '').replace(/[^0-9]/g, '');
    if (!digits) {
      showToast('Falta el número', 'Ingresa un número de WhatsApp válido', 'warning');
      return;
    }

    // Abrir WhatsApp real (wa.me)
    window.open(linkWhatsApp(phone, text), '_blank');

    const newMsg: WhatsAppMessage = {
      id: `WAM-${Date.now()}`,
      destinatarioNombre: destName || 'Cliente',
      destinatarioTelefono: phone,
      mensaje: text,
      plantilla: templateName,
      estado: 'enviado',
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setWhatsAppMessages((prev) => [newMsg, ...prev]);

    registrarActividad(
      'WhatsApp despachado',
      `Mensaje a ${destName || 'Cliente'} (${phone}) enviado vía wa.me`,
      'whatsapp',
      'emerald',
      'MessageSquare'
    );

    showToast(
      'WhatsApp Abierto',
      `Mensaje preparado para ${destName || 'Cliente'} — confírmalo en WhatsApp`,
      'success'
    );
  };

  const handleMarkNotificationsRead = () => {
    setNotificacionesLeidas(true);
    showToast('Notificaciones Leídas', 'Todas las notificaciones han sido marcadas', 'info');
  };

  // ═════════════════════════════════════════════════════
  // 🎭 AVATAR DEL RIDER (Fase 1.5)
  // ═════════════════════════════════════════════════════
  // Preferencia local instantánea + respaldo en Firestore
  // (profile.avatar llega por el listener de useAuth).
  const [avatarLocal, setAvatarLocal] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem('rt_avatar') || undefined;
    } catch {
      return undefined;
    }
  });

  const avatarEfectivo = profile?.avatar || avatarLocal;

  const handleSeleccionarAvatar = async (avatarId: string) => {
    if (!user) throw new Error('Sin sesión');
    // 1. Firestore (fuente de verdad, multi-dispositivo)
    await guardarAvatarRider(user.uid, avatarId);
    // 2. Local (instantáneo, sobrevive sin red)
    setAvatarLocal(avatarId);
    try {
      localStorage.setItem('rt_avatar', avatarId);
    } catch {
      // sin storage
    }
  };

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
    <MediosProvider onShowToast={showToast}>
    <div
      className="min-h-screen bg-slate-950 text-slate-100 font-sans transition-colors duration-200"
    >
      {/* Top Bar Header */}
      <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        onNotificationClick={(n) => {
          if (n.canalChat && n.telChat) handleVerAvisoChat(n.canalChat, n.telChat);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onShowToast={showToast}
        riderName={riderName}
        riderAvatar={avatarEfectivo}
        onAbrirAvatarPicker={() => setAvatarPickerOpen(true)}
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
          activeOrdersCount={pendientesCount}
          activeDriversCount={1}
          chatNoLeidos={chatNoLeidos}
          riderChatNoLeidos={riderChatNoLeidos}
          riderName={riderName}
          riderAvatar={avatarEfectivo}
          onSeleccionarAvatar={handleSeleccionarAvatar}
          onShowToast={showToast}
          uid={user?.uid}
        />

        {/* Content Area - Mobile first: full width, no left margin on mobile */}
        <main
          className={`flex-1 min-w-0 transition-all duration-300 p-2 sm:p-4 lg:p-6 lg:max-w-7xl lg:mx-auto ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
          }`}
        >
          {/* Fase 3.5: boundary por pestaña — un crash de vista no tumba
              la app ni deja la pantalla en blanco */}
          <VistaBoundary key={activeTab} nombre={NOMBRES_TAB[activeTab] || String(activeTab)}>
          {activeTab === 'dashboard' && (
            <DashboardView
              orders={orders}
              activities={activities}
              whatsAppMessages={whatsAppMessages}
              stats={stats}
              loading={clientesLoading}
              onOpenWhatsAppModal={handleOpenWhatsAppModal}
              onOpenNewOrderModal={() => setNewOrderModalOpen(true)}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'ruta' && (
            <RutaView onShowToast={showToast} />
          )}

          {activeTab === 'seguimiento' && (
            <SeguimientoView onShowToast={showToast} />
          )}

          {activeTab === 'yape' && (
            <YapeQRView onShowToast={showToast} />
          )}

          {activeTab === 'pedidos' && (
            <OrdersView
              orders={orders}
              drivers={drivers}
              loading={clientesLoading}
              onOpenNewOrderModal={() => setNewOrderModalOpen(true)}
              onOpenWhatsAppModal={handleOpenWhatsAppModal}
              onRegistrarPago={handleRegistrarPago}
              onCambiarEstado={handleCambiarEstado}
              onDeleteOrder={handleDeleteOrder}
              onDuplicateOrder={handleDuplicateOrder}
              onGuardarFoto={handleGuardarFoto}
              onGuardarNota={handleGuardarNota}
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
              profile={profile}
              stats={stats}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'mapa' && (
            <div className="space-y-4 pb-12">
              <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
                <h1 className="text-xl sm:text-2xl font-black text-white">Mapa Interactivo</h1>
                <p className="text-xs text-slate-400">Vista de tus entregas del día</p>
              </div>
              <LiveMap
                orders={orders}
                riderName={profile?.nombre || user?.displayName || 'Rider'}
                onOpenWhatsApp={(phone, name) => handleOpenWhatsAppModal(phone, name)}
                onNavigateTab={setActiveTab}
              />
            </div>
          )}

          {activeTab === 'motorizados' && (
            <MotorizadosView orders={orders} onShowToast={showToast} />
          )}

          {/* Fase 3.1: 🤖 Chat de Baileys estilo WhatsApp Web — todo lo que el
              robot envía y recibe (chats, broadcasts, pedidos de ubicación).
              Fase 3.3: fotos de perfil reales, notas de voz, botones rápidos,
              fijar/borrar chat, fondos y el Grupo MATE de trabajo.
              Fase 3.17: abre un chat puntual desde la campanita / aviso flotante. */}
          {activeTab === 'whatsapp' && (
            <ChatBaileysView
              onShowToast={showToast}
              abrirChatTel={chatPendiente?.canal === 'baileys' ? chatPendiente.tel : undefined}
              onAbrirChatConsumido={() => setChatPendiente(null)}
              onActiveChatChange={(tel) =>
                setChatActivoPorCanal((prev) => ({ ...prev, baileys: tel }))
              }
            />
          )}

          {/* Fase 3.15: 💬 RiderChat OFICIAL acoplado al panel — la app
              RiderChat V2 completa (lista, chat, plantillas aprobadas de
              Meta, broadcast a la ruta) corriendo con la MISMA credencial
              de ⚙️ Configuración → WhatsApp Oficial. Sin credencial arranca
              en MODO DEMO (envíos simulados).
              Fase 3.17: abre un chat puntual desde la campanita / aviso
              flotante + fotos de perfil reales de clientes_registrados. */}
          {activeTab === 'chatapi' && (
            <RiderChatView
              onShowToast={showToast}
              clientes={clientes}
              onUnreadChange={setRiderChatNoLeidos}
              abrirChatTel={chatPendiente?.canal === 'meta' ? chatPendiente.tel : undefined}
              onAbrirChatConsumido={() => setChatPendiente(null)}
              onActiveChatChange={(tel) =>
                setChatActivoPorCanal((prev) => ({ ...prev, meta: tel }))
              }
            />
          )}

          {/* Fase 3.3: 🛍️ Catálogo (mudanza de ClienteTrack) — productos con
              foto/ofertas, identidad de tienda, envío por el bot y exportación
              del catálogo completo como imagen. */}
          {activeTab === 'catalogo' && <CatalogoView onShowToast={showToast} />}

          {/* Fase 3.2: 🧰 Centro del Bot (mudanza de ClienteTrack) —
              Plantillas del bot + Automatizaciones (maestro, IA, horario,
              silenciados, palabras de enojo, registro) en una vista con tabs.
              Fase 3.4: UN solo ítem de menú — antes había 2 entradas
              (Plantillas del Bot / Automatizaciones) que abrían esta misma
              vista y se sentían como un clon; ahora las pestañas internas
              hacen el cambio */}
          {activeTab === 'plantillas' && (
            <BotControlView onShowToast={showToast} />
          )}

          {/* Fase 2.5: 📢 Broadcast masivo con el bot (delay anti-ban) */}
          {activeTab === 'broadcast' && <BroadcastView onShowToast={showToast} />}

          {/* Fase 2.5: 📖 Historial de rutas cerradas */}
          {activeTab === 'historial' && <HistorialView onShowToast={showToast} />}

          {/* Fase 2.5: 💾 Backups en la nube */}
          {activeTab === 'backups' && <BackupsView onShowToast={showToast} />}

          {/* Fase 2.16: 📊 Estadísticas estilo Circuit (datos reales del historial) */}
          {activeTab === 'stats' && <EstadisticasView onShowToast={showToast} />}

          {/* Fase 2.16: 📸 Galería de evidencias (hoy + histórico) */}
          {activeTab === 'galeria' && <GaleriaView onShowToast={showToast} />}

          {activeTab === 'estadisticas' && <ResumenView />}

          {activeTab === 'configuracion' && <SettingsView onShowToast={showToast} onNavigateTab={(t) => setActiveTab(t as NavigationTab)} />}
          {activeTab === 'medios' && <MediosView />}

          {activeTab === 'perfil' && <ProfileView />}
          </VistaBoundary>
        </main>
      </div>

      {/* Toast Notifications Overlay */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* 🔔 Fase 3.17: avisos flotantes de chat — "te escribieron" con
          botón Ver chat, funciona desde CUALQUIER pestaña */}
      <AvisoChatToast
        avisos={avisosFlotantes}
        onVer={(aviso) => {
          handleVerAvisoChat(aviso.canal, aviso.tel);
          setAvisosFlotantes((prev) => prev.filter((a) => a.id !== aviso.id));
        }}
        onCerrar={(id) => setAvisosFlotantes((prev) => prev.filter((a) => a.id !== id))}
      />

      {/* ⏱️ Nota: el cronómetro de ruta vive en Mi Ruta (CronometroRuta
          Fase 2.2) — integrado arriba de la lista de clientes, con
          aviso silencioso al bot y voz al iniciar. Sin pill flotante. */}

      {/* 🛣️ Fase 3.35: motor del odómetro GPS — invisible, 1 mount:
          abre el watch de posición SOLO con el cronómetro de ruta
          activo y guarda los km en usuarios/{uid}.odometro. */}
      <MotorOdometro uid={user?.uid} />

      {/* 🎭 Picker de avatar (desde el header) */}
      <AvatarPicker
        isOpen={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        avatarActual={avatarEfectivo}
        onSeleccionar={handleSeleccionarAvatar}
        onShowToast={showToast}
      />

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
        onCreateOrder={handleCreateOrder}
      />

      {/* 🎵 Fase 3.11: mini-reproductor global (radio/Spotify/YouTube) —
          acompaña en todas las pestañas; grande cuando estás en Medios */}
      <MiniPlayerReproductor mediosVisible={activeTab === 'medios'} />
    </div>
    </MediosProvider>
  );
}
