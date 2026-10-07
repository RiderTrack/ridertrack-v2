// ═══════════════════════════════════════════════════════════
// 🏍️ DriverTrack — Shell principal (F-ID1 → F-ID3)
// Pestañas: Viajes (form + meta + lista) · Caja · Mapa · Ajustes
// Local-first: todo en localStorage, backup JSON.
// F-ID3: la grabación GPS vive ACÁ (en el shell) para que siga
// corriendo aunque cambies de pestaña — la barra verde muestra
// los km en vivo y al terminar quedan guardados en el viaje.
//
// 🔗 FASE A (integración en RiderTrack): este archivo es el App.tsx
// de DriverTrack convertido en VISTA. FASE A2 (fusión de verdad):
//   1. TEMA FUSIONADO: ya NO hay sol/luna propio — inDrive acompaña
//      el modo claro/oscuro del TRABAJO (useTema → modoEfectivo).
//      Un solo toggle en el header de RiderTrack cambia TODA la app.
//   2. QR FUSIONADO: "Mi QR" y las billeteras personales ya no viven
//      acá — se configuran en la vista "Mi QR Yape/Plin" del menú
//      (pestaña 🏍️ inDrive). Al volver a esta sección la config se
//      recarga sola (por si la editaste allá).
//   3. Keep-alive: RiderTrack monta esta vista UNA vez y la oculta
//      con display:none al cambiar de sección → la grabación GPS de
//      un viaje en curso SIGUE VIVA aunque estés en otra pestaña.
//   4. Header sticky a top-16 (debajo del header de RiderTrack) y
//      resize del mapa Leaflet al volver (display:none lo deja en 0).
// Los localStorage (dt_viajes_v1, dt_config_v1, dt_gastos_v1,
// dt_tema_v1) son los MISMOS del APK standalone → tus viajes,
// gastos y config viajan solos, no se pierde NADA.
// ═══════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bike, Info } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { ConfigDT, Gasto, Viaje } from './types';
// 🛵 FASE E: lo que ganás HOY en el trabajo (cobro por pedido) —
// llega calculado desde App (que ya tiene los clientes de la ruta)
import { ResumenPagoPedidos } from '../utils/pagoPedidosCore';
import {
  cargarConfig,
  cargarGastos,
  cargarViajes,
  fechaBonita,
  fechaHoy,
  guardarConfig,
  guardarGastos,
  guardarViajes,
  horaAhora,
  marcarMetaCelebrada,
  metaYaCelebrada,
  resumenDia,
  totalGastosDia,
} from './storage';
import { armarMensajeCobro, linkWhatsApp, normalizarCelular, vibrar } from './utils';
// FASE B: 🤖 el robot ahora escucha por Firestore (acciones_dt) —
// cola propia de inDrive, sobrevive reinicios del bot. El viejo
// puente localhost:3001 (F-ID5) queda jubilado: nunca llegó a
// instalarse y exigía URL + token a mano.
import { encolarAccionDT, uidDisponible, armarAviso, armarPedirUbicacion, TipoAviso } from './services/robotBot';
// FASE B2: imágenes del robot — subís una imagen por aviso en
// Ajustes y el robot la manda CON el mensaje (como el trabajo)
import { escucharImagenesDT, ImagenDT } from './services/imagenesDT';
// FASE F: 🛣️ km A→B calculados solos para los viajes con ambos pines
import { calcularRutaAB } from './services/rutaAB';
// FASE K: saldo de la recarga semanal (chip comisión prepagada)
import { estadoSaldo } from './services/recarga';
// FASE A2: el tema viene del TRABAJO — mismo toggle para toda la app
import { useTema } from '../theme/useTema';
import {
  borrarEstadoGPS,
  duracionMovimientoSeg,
  EstadoGPS,
  guardarEstadoGPS,
  leerEstadoGPS,
  registrarPunto,
} from './services/gps';
import ViajeForm from './components/ViajeForm';
import ViajeList from './components/ViajeList';
import MetaBar from './components/MetaBar';
import GpsBar from './components/GpsBar';
import Confeti from './components/Confeti';

// ═══ FASE C: la sección inDrive del menú quedó SOLO en VIAJES ═══
// La Caja, el Mapa, las Stats y los Ajustes de inDrive ahora viven
// DENTRO de las secciones del panel general (junto a los del trabajo,
// bien separados):
//   💰 Caja del día (menú)  → Caja inDrive adentro
//   🗺️ Mapa de Entregas     → toggle Trabajo / 🏍️ Libre
//   📊 Estadísticas         → Stats inDrive al final
//   ⚙️ Configuración        → Ajustes inDrive adentro
// Así no hay DOS configuraciones ni DOS cajas en el menú — todo en
// su sección de siempre. Esta vista sigue siendo la dueña del estado
// (viajes, gastos, config y la grabación GPS) y las demás piezas
// leen/escriben el MISMO storage + sync de la nube (syncDT.ts).

interface PropsDTView {
  /** true cuando la sección inDrive está visible en RiderTrack */
  activa: boolean;
  /** FASE A2: salta a "Mi QR Yape/Plin" del menú (ahí vive la
   *  pestaña 🏍️ inDrive con tus billeteras personales) */
  onIrAYape?: () => void;
  /** FASE C: te manda a la Configuración del panel general (ahí
   *  viven los Ajustes de inDrive) — p.ej. si falta la key del escáner */
  onIrAAjustes?: () => void;
  /** 🛵 FASE E: lo que la empresa te paga HOY por pedidos entregados
   *  (temporada activa) — null con el modo apagado: el header queda
   *  100% como antes. Con esto el header pasa de "solo inDrive" a
   *  "💰 Ganado hoy (todo)" = trabajo + inDrive, como pidió Rudy. */
  pagoTrabajoHoy?: ResumenPagoPedidos | null;
}

export default function DriverTrackView({ activa, onIrAYape, onIrAAjustes, pagoTrabajoHoy }: PropsDTView) {
  const [viajes, setViajes] = useState<Viaje[]>(() => cargarViajes());
  // FASE C.2: id del último viaje aceptado — ViajeList lo resalta y
  // hace scroll hasta su tarjeta completa
  const [ultimoAgregadoId, setUltimoAgregadoId] = useState<string | null>(null);
  // F-ID6: 💸 gastos del día (recargas, gasolina…) — se descuentan del
  // neto para mostrar lo que queda EN MANO. Viven igual que los viajes:
  // en el teléfono, y entran en el backup.
  const [gastos, setGastos] = useState<Gasto[]>(() => cargarGastos());
  const [config, setConfig] = useState<ConfigDT>(() => cargarConfig());
  const [confeti, setConfeti] = useState(false);
  const [toast, setToast] = useState('');
  // F-ID3: seguimiento GPS en curso (sobrevive recargas: se lee de localStorage)
  const [estadoGPS, setEstadoGPS] = useState<EstadoGPS | null>(() => leerEstadoGPS());
  // FASE A2: TEMA FUSIONADO — inDrive ya no tiene sol/luna propio.
  // Acompaña el modo claro/oscuro del TRABAJO: un solo toggle en el
  // header de RiderTrack y TODA la app (trabajo + inDrive) cambia
  // junta. La clase 'light' sigue scopeada al contenedor .dt-app
  // (el Theme Studio no repinta inDrive), pero ahora la decide la app.
  const { modoEfectivo } = useTema();
  const temaClaro = modoEfectivo === 'light';
  const toastTimer = useRef<number | null>(null);
  // El watchPosition crea su callback UNA vez → necesita la última
  // versión del estado sin cerrar sobre una vieja: espejo en ref.
  // ⚠️ El ref es la FUENTE DE VERDAD: cada setEstadoGPS escribe el
  // ref PRIMERO y el estado después → NO hace falta (ni se puede)
  // sincronizar al revés. Un useEffect que copiara el estado al ref
  // puede dispararse TARDE con un valor viejo de render y pisar el
  // ref hacia ATRÁS → el GPS pierde puntos (bug de la ruta corta).
  const estadoRef = useRef<EstadoGPS | null>(estadoGPS);
  const watchRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const hoy = fechaHoy();
  const resumenHoy = useMemo(() => resumenDia(viajes, hoy), [viajes, hoy]);
  const delDia = useMemo(() => viajes.filter(v => v.fecha === hoy), [viajes, hoy]);
  // FASE F: ✓ cuántas entregas del día ya están completadas
  const viajesEntregados = useMemo(() => delDia.filter(v => v.entregado === true).length, [delDia]);
  // F-ID6: lo que quedó EN MANO hoy (neto de viajes − gastos anotados)
  const gastosHoy = useMemo(() => totalGastosDia(gastos, hoy), [gastos, hoy]);
  const enManoHoy = resumenHoy.neto - gastosHoy;

  // FASE K: 🟣 saldo de la recarga semanal (comisión prepagada) —
  // cuánto consumiste de la recarga con tus viajes inDrive
  const saldoRecarga = useMemo(
    () => (config.recarga ? estadoSaldo(viajes, config.recarga) : null),
    [viajes, config.recarga],
  );

  // Persistencia automática
  useEffect(() => {
    guardarViajes(viajes);
  }, [viajes]);

  // F-ID6: los gastos también se guardan solos
  useEffect(() => {
    guardarGastos(gastos);
  }, [gastos]);

  // 🎯 Detección de meta cumplida (1 celebración por día)
  useEffect(() => {
    if (config.metaDiaria > 0 && resumenHoy.neto >= config.metaDiaria && !metaYaCelebrada()) {
      marcarMetaCelebrada();
      setConfeti(true);
      vibrar(600);
      const t = window.setTimeout(() => setConfeti(false), 4500);
      return () => window.clearTimeout(t);
    }
  }, [resumenHoy.neto, config.metaDiaria]);

  function mostrarToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }

  // FASE A: al volver a la sección inDrive (venía oculta con
  // display:none) el mapa Leaflet quedó con tamaño 0 — un resize
  // dispara el invalidateSize interno de Leaflet y recalibra.
  // FASE A2: además recarga la config — pudo cambiar desde la
  // pestaña 🏍️ inDrive de "Mi QR Yape/Plin" (billeteras personales).
  // FASE C: ahora también recarga viajes y gastos — pudieron cambiar
  // desde los paneles de inDrive dentro de las secciones del trabajo
  // (Caja del día, Configuración…) o desde OTRO celular (sync nube).
  useEffect(() => {
    if (!activa) return;
    setConfig(cargarConfig());
    setViajes(cargarViajes());
    setGastos(cargarGastos());
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
    return () => window.clearTimeout(t);
  }, [activa]);

  // ☁️ FASE C: cuando la nube manda datos nuevos (los cambiaste desde
  // otro celular o desde los paneles del trabajo), se recargan acá —
  // la grabación GPS en curso NO se toca (vive en estadoGPS aparte)
  useEffect(() => {
    const alSync = () => {
      setViajes(cargarViajes());
      setGastos(cargarGastos());
      setConfig(cargarConfig());
    };
    window.addEventListener('dt:sync-remoto', alSync);
    return () => window.removeEventListener('dt:sync-remoto', alSync);
  }, []);

  function agregarViaje(v: Viaje) {
    setViajes(prev => [...prev, v]);
    // FASE C.2: la lista resalta el viaje recién aceptado (✨ Nuevo)
    // y se desliza solita hasta su tarjeta completa
    setUltimoAgregadoId(v.id);
    vibrar(120);
  }

  // FASE F: ✓ ENTREGA COMPLETADA — marca/desmarca con la hora en que
  // la hiciste. Viaja al otro cel por el sync de siempre (viajesParaNube
  // pasa el objeto completo) y alimenta el contador "X de Y" del día.
  function toggleEntregado(id: string) {
    setViajes(prev =>
      prev.map(v =>
        v.id === id
          ? v.entregado
            ? { ...v, entregado: false, entregadoHora: undefined }
            : { ...v, entregado: true, entregadoHora: horaAhora() }
          : v,
      ),
    );
  }

  // FASE H: 📷 guarda la FOTO de la entrega (evidencia comprimida)
  // en el viaje, con la hora. NO viaja a la nube (pesa, como la ruta
  // GPS) — queda en ESTE teléfono como comprobante, y la original
  // además quedó en la galería del teléfono al sacarla.
  function guardarFotoEntrega(id: string, dataUrl: string) {
    setViajes(prev =>
      prev.map(v =>
        v.id === id
          ? { ...v, fotoEntrega: dataUrl, fotoEntregaHora: horaAhora() }
          : v,
      ),
    );
  }

  // FASE F: 🛣️ los km A→B se calculan SOLOS — apenas aceptás un viaje
  // con los DOS pines (o cuando llega del otro cel sin el número),
  // Google mide la ruta por calles; sin internet queda el estimado
  // de la recta ×1.35 y a la próxima se refina. El número queda
  // PERSISTIDO en el viaje (viaja en el sync, sobrevive recargas).
  useEffect(() => {
    const pendientes = viajes.filter(
      v => v.coordenadasA && v.coordenadas && v.kmEstimado == null,
    );
    if (pendientes.length === 0) return;
    let cancelado = false;
    (async () => {
      for (const v of pendientes) {
        const r = await calcularRutaAB(v.coordenadasA, v.coordenadas);
        if (cancelado || !r) continue;
        // actualización por id (funcional) — nunca pisa cambios
        // concurrentes (GPS, entregado, borrados…)
        setViajes(prev =>
          prev.map(x =>
            x.id === v.id && x.kmEstimado == null
              ? { ...x, kmEstimado: r.km, minEstimados: r.min }
              : x,
          ),
        );
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [viajes]);

  // FASE C: agregarGasto/eliminarGasto se mudaron a PanelCajaDT (la
  // Caja de inDrive vive ahora en el 💰 Caja del día del panel general).
  // El estado `gastos` sigue ACÁ porque el número del header ("En mano
  // hoy" = neto − gastos) se calcula con él, y se recarga solo desde
  // el storage cuando cambia desde los paneles o la nube (dt:sync-remoto).

  // F-ID2.7: el Yape PROPIO del driver se guarda UNA vez (desde la
  // pestaña Viajes, sin ir a Ajustes) y sale en TODOS los mensajes de
  // cobro — antes lo terminaba escribiendo a mano por cada cliente
  function guardarMiYape(numero: string, titular: string) {
    const c: ConfigDT = {
      ...config,
      yape: { ...config.yape, numero: numero.trim(), titular: titular.trim() },
    };
    guardarConfig(c);
    setConfig(c);
    mostrarToast('💜 Tu Yape quedó guardado — ya sale en todos los cobros');
  }

  // FASE A2: "Mi QR" (nombre/celular/QR personal) ya no vive acá —
  // se configura en la vista "Mi QR Yape/Plin" del menú, pestaña
  // 🏍️ inDrive. El nombre/celular para el robot se edita en Ajustes
  // de inDrive (👤 Mis datos).

  // ═══ F-ID5: 🤖 cobro AUTOMÁTICO por el robot ═══
  // UN solo flujo compartido para el botón Cobrar del formulario y el
  // 💬/🤖 de la lista. Si el robot está activo, el bot (Termux, en este
  // mismo teléfono) le manda al cliente el mensaje de cobro CON LA
  // IMAGEN de tu QR de Yape — sin abrir WhatsApp. Si no responde, la
  // app cae SOLA al wa.me de siempre: el cobro nunca se traba.
  const [cobroEnCurso, setCobroEnCurso] = useState(false);

  async function mandarCobro(
    datos: { cliente: string; monto: number; direccion: string },
    celular: string,
  ): Promise<void> {
    const cel = normalizarCelular(celular);
    if (!cel) {
      mostrarToast('Poné el celular del cliente para mandarle el cobro');
      return;
    }
    const texto = armarMensajeCobro(datos, config);

    // Robot apagado → como siempre: WhatsApp manual (revisás y envía vos)
    if (!config.robotActivo) {
      window.open(linkWhatsApp(cel, texto), '_blank');
      vibrar(60);
      return;
    }

    // FASE B: robot activo → la acción va a la cola Firestore y el
    // rudy-bot la manda SOLO (mensaje + tu QR de Yape en la misma
    // torta). Si no hay sesión (no debería pasar dentro de RT),
    // caemos al wa.me de siempre — nunca te quedás sin cobrar.
    setCobroEnCurso(true);
    mostrarToast('🤖 Mandando el cobro por el robot…');
    const r = await encolarAccionDT({
      tipo: 'dt_cobro',
      telefono: cel,
      texto,
      imagenBase64: config.yape.qrBase64 || undefined,
      nombre: datos.cliente || undefined,
    });
    setCobroEnCurso(false);
    if (r.ok) {
      // FASE M: el toast te dice a QUÉ NÚMERO salió — si el viaje
      // tiene dos teléfonos (envía/recibe), ves al toque si el
      // comprobante le llegó a la persona que querías
      const ult = cel.slice(-4);
      mostrarToast(`✓ Cobro en camino (al …${ult}) — el cliente lo recibe ya 💜`);
      vibrar(120);
      return;
    }
    mostrarToast('⚠️ ' + r.error + ' · abro WhatsApp…');
    window.open(linkWhatsApp(cel, texto), '_blank');
  }

  // ═══ FASE B: 🛣️ AVISOS AL CLIENTE por el robot ═══
  // Voy en camino / Llegando en X min / Ya llegué / Entregado —
  // apretás el botón y el cliente lo recibe sin que abras WhatsApp.
  // FASE B2: si subiste una imagen para el aviso (Ajustes → 🖼️),
  // viaja la URL y el robot la manda como IMAGEN + texto, igual
  // que los avisos del trabajo. Si el robot está apagado o no hay
  // sesión → wa.me como respaldo (solo texto, sin imagen).
  const [imagenesDT, setImagenesDT] = useState<Record<string, ImagenDT>>({});
  useEffect(() => escucharImagenesDT(setImagenesDT), []);

  async function mandarAviso(
    viaje: Viaje,
    tipo: TipoAviso,
    minutos?: number,
    telefono?: string,
  ): Promise<void> {
    // FASE C: teléfono elegido en el menú 🤖 (cliente · quien envía ·
    // quien recibe) — si no viene, el cliente del viaje como siempre
    const cel = normalizarCelular(telefono ?? viaje.celular);
    if (!cel) {
      mostrarToast('Este viaje no tiene celular del cliente');
      return;
    }
    const texto = armarAviso(tipo, viaje, config.miNombre, minutos, config.plantillas);
    // FASE B2: la imagen del aviso (si subiste una) viaja como URL —
    // el bot la baja de la nube y la manda junto con el texto
    const imagen = imagenesDT[tipo === 'llegando' ? 'llegando' : tipo];
    if (!config.robotActivo || !uidDisponible()) {
      window.open(linkWhatsApp(cel, texto), '_blank');
      vibrar(60);
      return;
    }
    mostrarToast(
      tipo === 'camino'
        ? '🛣️ Avisando que vas en camino…'
        : tipo === 'llegando'
          ? `⏱️ Avisando que llegás en ${minutos || 10} min…`
          : tipo === 'llegada'
            ? '🏁 Avisando que ya llegaste…'
            : '✅ Avisando entrega…',
    );
    const r = await encolarAccionDT({
      tipo: 'dt_aviso',
      telefono: cel,
      texto,
      imagenUrl: imagen?.url,
      minutos: tipo === 'llegando' ? minutos : undefined,
      nombre: viaje.cliente || undefined,
      viajeId: viaje.id,
    });
    mostrarToast(
      r.ok
        ? imagen
          ? '✓ Aviso enviado con tu imagen 🖼️'
          : '✓ Aviso enviado'
        : '⚠️ ' + r.error + ' · abro WhatsApp…',
    );
    if (!r.ok) window.open(linkWhatsApp(cel, texto), '_blank');
    vibrar(r.ok ? 120 : 60);
  }

  // ═══ FASE B: 📍 pedirle al cliente su ubicación por el chat ═══
  async function pedirUbicacion(viaje: Viaje, telefono?: string): Promise<void> {
    const cel = normalizarCelular(telefono ?? viaje.celular);
    if (!cel) {
      mostrarToast('Este viaje no tiene celular del cliente');
      return;
    }
    const texto = armarPedirUbicacion(config.miNombre, config.plantillas?.ubicacion);
    if (!config.robotActivo || !uidDisponible()) {
      window.open(linkWhatsApp(cel, texto), '_blank');
      return;
    }
    const r = await encolarAccionDT({
      tipo: 'dt_ubicacion',
      telefono: cel,
      texto,
      imagenUrl: imagenesDT['ubicacion']?.url, // FASE B2: imagen opcional
      nombre: viaje.cliente || undefined,
      viajeId: viaje.id,
    });
    mostrarToast(r.ok ? '✓ Pedido de ubicación enviado' : '⚠️ ' + r.error + ' · abro WhatsApp…');
    if (!r.ok) window.open(linkWhatsApp(cel, texto), '_blank');
  }

  function eliminarViaje(id: string) {
    // F-ID3: si se borra el viaje que se estaba grabando, la
    // grabación se descarta (no hay dónde guardarla)
    if (estadoRef.current?.viajeId === id) {
      pararWatch();
      soltarWakeLock();
      borrarEstadoGPS();
      estadoRef.current = null;
      setEstadoGPS(null);
    }
    setViajes(prev => prev.filter(v => v.id !== id));
    mostrarToast('Viaje eliminado 🗑️');
  }

  // ═══ F-ID3: grabación de km GPS por viaje ═══

  /** F-ID3.2: en el APK, pide el permiso de UBICACIÓN nativo de
   * Android (diálogo del sistema, el mismo que cámara/micro).
   * Sin él, el GPS del WebView nunca entrega puntos — por eso en
   * Ajustes de la app solo aparecía el permiso de cámara. En la
   * web no hace falta (lo maneja el navegador). */
  async function pedirPermisoUbicacion(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true; // web/PWA: nada que pedir
    try {
      const res = await Geolocation.requestPermissions();
      return res.location === 'granted' || res.coarseLocation === 'granted';
    } catch {
      return false; // diálogo bloqueado o error — se informa al usuario
    }
  }

  /** Pide que la pantalla no se apague mientras graba (best effort) */
  async function pedirWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch {
      /* el navegador lo negó o no lo soporta: la grabación sigue igual */
    }
  }

  function soltarWakeLock() {
    try {
      wakeLockRef.current?.release();
    } catch {
      /* nada */
    }
    wakeLockRef.current = null;
  }

  function pararWatch() {
    if (watchRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
  }

  /** Arranca el watchPosition — el callback vive UNA vez y lee el ref */
  function iniciarWatchGPS() {
    if (watchRef.current !== null) return;
    if (!('geolocation' in navigator)) {
      mostrarToast('Tu navegador no soporta GPS 📍');
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const est = estadoRef.current;
        if (!est) return; // ya se detuvo
        const { coords } = pos;
        const { estado: nuevo, aceptado } = registrarPunto(
          est,
          coords.latitude,
          coords.longitude,
          coords.accuracy ?? 999,
        );
        if (!aceptado) return;
        guardarEstadoGPS(nuevo);
        estadoRef.current = nuevo;
        setEstadoGPS(nuevo);
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          // sin permiso no hay grabación: se corta limpio sin ensuciar el viaje
          pararWatch();
          soltarWakeLock();
          borrarEstadoGPS();
          estadoRef.current = null;
          setEstadoGPS(null);
          mostrarToast(
            Capacitor.isNativePlatform()
              ? 'Activá la UBICACIÓN para grabar tus km 📍 (Ajustes del teléfono → Apps → DriverTrack → Permisos)'
              : 'Activá la UBICACIÓN para grabar tus km 📍 (permiso del navegador)',
          );
        }
        // timeouts / posición no disponible: el watch sigue vivo, no pasa nada
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
  }

  /** ▶ Empieza a grabar los km de un viaje (si había otro, se cierra y guarda solo) */
  async function iniciarGPSViaje(viajeId: string) {
    if (estadoRef.current?.viajeId === viajeId) return;

    // F-ID3.2: en el APK, PRIMERO el permiso nativo de Android —
    // sin él el GPS nunca arranca (antes: solo salía el de cámara)
    const permisoOk = await pedirPermisoUbicacion();
    if (!permisoOk) {
      mostrarToast('Activá el permiso de UBICACIÓN para grabar 📍 (Ajustes → Apps → DriverTrack → Permisos)');
      return;
    }

    if (estadoRef.current) detenerGPS(true); // el anterior queda guardado

    const nuevo: EstadoGPS = { viajeId, inicioTs: Date.now(), km: 0, puntos: [] };
    guardarEstadoGPS(nuevo);
    estadoRef.current = nuevo;
    setEstadoGPS(nuevo);
    pedirWakeLock();
    iniciarWatchGPS();
    vibrar(60);
    mostrarToast('📍 Grabando los km de este viaje — manejá tranquilo');
  }

  /** ■ Termina la grabación: km + tiempo + trazado quedan EN el viaje */
  function detenerGPS(silencioso = false) {
    const est = estadoRef.current;
    if (!est) return;
    pararWatch();
    soltarWakeLock();
    borrarEstadoGPS();
    estadoRef.current = null;
    setEstadoGPS(null);

    if (est.puntos.length < 2) {
      // no se grabó nada útil (permiso recién dado, viaje cortado al toque)
      if (!silencioso) mostrarToast('No se grabó nada — probá de nuevo 📍');
      return;
    }

    const duracion = duracionMovimientoSeg(est);
    const km = +est.km.toFixed(2);
    setViajes(prev =>
      prev.map(v =>
        v.id === est.viajeId
          ? {
              ...v,
              kmGPS: +((v.kmGPS ?? 0) + km).toFixed(2), // si re-grabó el mismo viaje, se suma
              duracionSeg: (v.duracionSeg ?? 0) + duracion,
              ruta: v.ruta && v.ruta.length >= 2 ? [...v.ruta, ...est.puntos] : est.puntos,
            }
          : v,
      ),
    );
    if (!silencioso) {
      mostrarToast(`📍 Listo: ${km.toFixed(1)} km · ${Math.max(1, Math.round(duracion / 60))} min guardados`);
      vibrar(120);
    }
  }

  // ▶ RESUME: si la app se recargó (o Android la mató por memoria)
  // con una grabación en curso, al arrancar se retoma sola.
  useEffect(() => {
    const est = estadoRef.current;
    if (est?.viajeId) {
      pedirWakeLock();
      iniciarWatchGPS();
    }
    // El wake lock se suelta solo cuando la pestaña queda oculta; al
    // volver a verse se vuelve a pedir si la grabación sigue
    const alVolverVisible = () => {
      if (document.visibilityState === 'visible' && estadoRef.current) pedirWakeLock();
    };
    document.addEventListener('visibilitychange', alVolverVisible);
    return () => {
      document.removeEventListener('visibilitychange', alVolverVisible);
      pararWatch();
      soltarWakeLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FASE C: exportarBackup / importarBackup / borrarTodo se mudaron a
  // PanelAjustesDT (los Ajustes de inDrive viven ahora en la
  // Configuración del panel general).

  return (
    <div className={`dt-app ${temaClaro ? 'light' : ''} mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-950`}>
      <Confeti visible={confeti} />

      {/* Header */}
      {/* FASE A: sticky a top-16 para quedar DEBAJO del header de
          RiderTrack (que es sticky top-0 h-16) — sin superponerse */}
      <header className="sticky top-16 z-30 border-b border-slate-800 bg-slate-950/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700">
              <Bike size={18} className="text-slate-950" />
            </div>
            <div>
              <h1 className="text-base font-black leading-none text-slate-50">DriverTrack</h1>
              <p className="text-[10px] capitalize text-slate-400">{fechaBonita(hoy)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {/* FASE A2: el sol/luna y "Mi QR" ya no viven acá. El tema lo
                maneja el toggle del TRABAJO (toda la app cambia junta) y
                tus billeteras personales se configuran en "Mi QR Yape/
                Plin" → pestaña 🏍️ inDrive del menú. */}
            {/* F-ID6: el número del header es el REAL — cuando anotaste
                gastos pasa de "Neto hoy" a "En mano hoy" (neto − gastos) */}
            <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-right">
              <p className="text-[9px] font-medium uppercase tracking-wide text-emerald-500/80">
                {gastosHoy > 0 ? 'En mano hoy' : 'Neto hoy'}
              </p>
              <p
                className={`text-sm font-black leading-none ${
                  enManoHoy < 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
                data-testid="neto-header"
              >
                {enManoHoy < 0 ? `−S/ ${Math.abs(enManoHoy).toFixed(2)}` : `S/ ${enManoHoy.toFixed(2)}`}
              </p>
            </div>
            {/* 💰 FASE E: "cuánto gané HOY" con TODO junto — el trabajo
                (cobro por pedido, temporada) + lo de inDrive. Solo con
                la temporada ACTIVA (apagada = header como siempre). */}
            {pagoTrabajoHoy && (
              <div
                className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-right"
                data-testid="total-dia-header"
                title="Lo que ganaste hoy sumando el trabajo (pago por pedidos) y tus viajes libres"
              >
                <p className="text-[9px] font-medium uppercase tracking-wide text-violet-300/90">
                  💰 Ganado hoy (todo)
                </p>
                <p className="text-sm font-black leading-none text-violet-200">
                  S/ {(enManoHoy + pagoTrabajoHoy.total).toFixed(2)}
                </p>
                <p className="text-[8px] leading-tight text-slate-400">
                  🛵 S/ {pagoTrabajoHoy.total.toFixed(2)} trabajo + 🏍️ S/ {enManoHoy.toFixed(2)} libre
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Contenido — FASE C: esta sección es SOLO de VIAJES. La Caja,
          el Mapa, las Stats y los Ajustes de inDrive viven ahora en
          las secciones del panel general (junto a los del trabajo). */}
      <main className="flex-1 space-y-3 px-4 py-4 pb-24">
        <MetaBar neto={resumenHoy.neto} meta={config.metaDiaria} />
        {/* FASE K: chip del modo comisión prepagada — un toque y te
            lleva a la Configuración para ver el saldo/recargar */}
        {config.recarga?.activa && (
          <button
            onClick={() => onIrAAjustes?.()}
            className="w-full rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-left transition-colors hover:bg-violet-500/20"
            data-testid="chip-prepago"
            title="Ver el saldo de tu recarga en Configuración → inDrive → 🎯 Recarga semanal"
          >
            <span className="text-[11px] font-bold text-violet-200">🟣 Comisión prepagada</span>
            {saldoRecarga ? (
              <span className="text-[10px] font-semibold text-slate-400">
                {' '}· usaste S/ {saldoRecarga.usado.toFixed(2)} de S/ {saldoRecarga.monto.toFixed(2)} —{' '}
                <span
                  className={
                    saldoRecarga.saldo < 0 || saldoRecarga.casiAgotada ? 'text-amber-300' : 'text-emerald-400'
                  }
                >
                  queda S/ {saldoRecarga.saldo.toFixed(2)}
                </span>
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-slate-400">
                {' '}· cada carrera inDrive entra COMPLETA (registrá tu recarga en Configuración)
              </span>
            )}
          </button>
        )}
        <ViajeForm
          config={config}
          onAgregar={agregarViaje}
          onGuardarMiYape={guardarMiYape}
          onMandarCobro={mandarCobro}
          cobroEnCurso={cobroEnCurso}
          onNecesitaKey={() => {
            // FASE C: los Ajustes de inDrive viven en la Configuración
            // del panel general → te mando ahí
            onIrAAjustes?.();
            mostrarToast('Pegá tu key de IA en inDrive → 🤖 Escáner — Gemini gratis, 1 minuto');
          }}
        />

        {/* FASE F: ✓ contador de entregas del día — cuántas hiciste y
            cuántas te faltan (se marca con el botón ✓ de cada viaje) */}
        {delDia.length > 0 && (
          <div
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2"
            data-testid="chip-entregas-hoy"
          >
            <p className="flex items-baseline gap-2 text-xs font-bold text-emerald-300">
              ✓ Entregas de hoy
              <span className="tabular-nums text-emerald-200">
                {viajesEntregados} de {delDia.length}
              </span>
            </p>
            <p className="text-[10px] font-semibold text-slate-400">
              {viajesEntregados === delDia.length
                ? '¡día completo! 🎉'
                : `te faltan ${delDia.length - viajesEntregados}`}
            </p>
            {/* barrita de progreso — verde lleno sobre gris */}
            <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.round((viajesEntregados / delDia.length) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <ViajeList
          viajes={delDia}
          onEliminar={eliminarViaje}
          titulo="de hoy"
          config={config}
          viajeGPSActivo={estadoGPS?.viajeId ?? null}
          onIniciarGPS={iniciarGPSViaje}
          onDetenerGPS={() => detenerGPS()}
          onMandarCobro={mandarCobro}
          cobroEnCurso={cobroEnCurso}
          onMandarAviso={mandarAviso}
          onPedirUbicacion={pedirUbicacion}
          tiposConImagen={Object.keys(imagenesDT)}
          destacadoId={ultimoAgregadoId}
          onToggleEntregado={toggleEntregado}
          onGuardarFoto={guardarFotoEntrega}
          onToast={mostrarToast}
        />

        {/* FASE C: cartelito para que no busqués con el viejo hábito —
            tus Caja/Mapa/Stats/Ajustes de inDrive están en las secciones
            del trabajo, no acá */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5" data-testid="hint-secciones">
          <p className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-400">
            <Info size={12} className="mt-0.5 shrink-0 text-slate-500" />
            <span>
              💡 La <b className="text-slate-300">Caja</b>, el <b className="text-slate-300">Mapa</b>, las{' '}
              <b className="text-slate-300">Stats</b> y los <b className="text-slate-300">Ajustes</b> de inDrive
              ahora viven junto a los del trabajo, en el menú: <b className="text-slate-300">💰 Caja del día</b>,{' '}
              <b className="text-slate-300">🗺️ Mapa de Entregas</b>, <b className="text-slate-300">📊 Estadísticas</b> y{' '}
              <b className="text-slate-300">⚙️ Configuración</b> (adentro, sección 🏍️ inDrive).
            </span>
          </p>
        </div>
      </main>

      {/* F-ID3: barra de grabación GPS en vivo (en cualquier sección) */}
      {estadoGPS && (
        <GpsBar
          estado={estadoGPS}
          cliente={viajes.find(v => v.id === estadoGPS.viajeId)?.cliente ?? ''}
          onDetener={() => detenerGPS()}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="dt-anim-pop fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
