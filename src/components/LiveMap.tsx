// ═══════════════════════════════════════════════════════════
// 🗺️ LIVE MAP - RiderTrack V2 (Fase 1.4)
// Mapa REAL (Leaflet, sin API key) con el "skin bonito":
//   • Tiles oscuros CARTO (combina con el tema de la app)
//   • Tu motito 🛵 en el mapa (posición GPS real, en vivo)
//   • Marcadores numerados con color por estado; la siguiente
//     parada pulsa; los "aprox." se ven punteados
//   • Bandera de INICIO y punto de FIN de ruta (si los
//     configuraste en Mi Ruta → Inicio y fin de ruta)
//   • Línea de ruta animada (guiones en movimiento)
//   • Popups con WhatsApp directo y navegación en moto
//
// Fase 1.4: el mapa NUNCA queda tapado — los estados vacíos
// son un banner compacto, así siempre ves el mapa y tu GPS.
// Aquí todo es real: si un cliente no tiene ubicación, se dice
// — no se inventa nada.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Crosshair,
  Loader2,
  MessageSquare,
  Navigation,
  RefreshCw,
  Route as RouteIcon,
  Flag,
} from 'lucide-react';
import { Order, NavigationTab } from '../types';
import { Coordenadas, vigilarPosicion } from '../services/geocoding';
import { distanciaRutaKm, LIMA_CENTRO } from '../services/routeOptimizer';
import { linkWhatsApp, ETIQUETAS_ESTADO } from '../utils/realData';
import { useConfig } from '../hooks/useConfig';
import { getEstiloMapa, tilesDeEstilo, EstiloMapa } from '../services/mapStyle';
import { linkNavegacion, nombreAppNavegacion, getAppNavegacion } from '../services/navPrefs';

interface LiveMapProps {
  orders: Order[];
  riderName?: string;
  onOpenWhatsApp?: (telefono: string, nombre: string) => void;
  /** Para el botón "Ir a Mi Ruta" del banner (Fase 1.4) */
  onNavigateTab?: (tab: NavigationTab) => void;
}

/** Escapa texto para incrustarlo en el HTML del popup (seguridad) */
function esc(texto: string | undefined | null): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** SVG del rider (moto estilo lucide) para el marcador 🛵 */
const SVG_MOTO =
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ffffff" stroke-width="2.2" ` +
  `stroke-linecap="round" stroke-linejoin="round">` +
  `<circle cx="18.5" cy="17.5" r="3.4"></circle>` +
  `<circle cx="5.5" cy="17.5" r="3.4"></circle>` +
  `<circle cx="15" cy="5" r="1"></circle>` +
  `<path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>` +
  `</svg>`;

export const LiveMap: React.FC<LiveMapProps> = ({
  orders,
  riderName,
  onOpenWhatsApp,
  onNavigateTab,
}) => {
  // ── Config de ruta (inicio/fin) ───────────────────────────
  const { config } = useConfig();
  const rutaInicio = config?.ruta?.inicio ?? null;
  const rutaFin = config?.ruta?.fin ?? null;
  const volverAlInicio = !!config?.ruta?.volverAlInicio;

  // ── Estilo de mapa ────────────────────────────────────────
  const [estilo, setEstilo] = useState<EstiloMapa>(() => getEstiloMapa());

  // El mapa sigue al tema de la app (Fase 1.5): al alternar
  // claro/oscuro, App avisa con el evento rt_theme y los tiles
  // se cambian AL INSTANTE sin recargar la vista.
  useEffect(() => {
    const onTema = () => setEstilo(getEstiloMapa());
    window.addEventListener('rt_theme', onTema);
    return () => window.removeEventListener('rt_theme', onTema);
  }, []);

  // ── Estado GPS ────────────────────────────────────────────
  const [gpsEstado, setGpsEstado] = useState<'buscando' | 'ok' | 'no'>('buscando');
  const [miPosicion, setMiPosicion] = useState<Coordenadas | null>(null);
  const [reintentosGPS, setReintentosGPS] = useState(0);

  // ── Refs del mapa Leaflet ─────────────────────────────────
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const clientesLayerRef = useRef<L.LayerGroup | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const rutaLineRef = useRef<L.Polyline | null>(null);
  const inicioMarkerRef = useRef<L.Marker | null>(null);
  const finMarkerRef = useRef<L.Marker | null>(null);
  const numMarcadoresRef = useRef(-1);

  // ── Datos derivados ───────────────────────────────────────
  const ubicados = useMemo(
    () =>
      orders
        .filter(
          (o) => typeof o.lat === 'number' && typeof o.lng === 'number' && !isNaN(o.lat!) && !isNaN(o.lng!)
        )
        .sort((a, b) => (a.num ?? 999) - (b.num ?? 999)),
    [orders]
  );

  const sinUbicar = orders.length - ubicados.length;
  const pendientes = orders.filter((o) => o.estado === 'pendiente').length;
  const entregados = orders.filter((o) => o.estado === 'entregado').length;
  const fallidos = orders.filter((o) => o.estado === 'cancelado').length;
  const aproxCount = ubicados.filter((o) => o.latSrc === 'aprox').length;

  const inicioRuta = miPosicion ?? LIMA_CENTRO;

  const estimacion = useMemo(() => {
    if (ubicados.length === 0) return { km: 0, min: 0 };
    const km = distanciaRutaKm(
      ubicados.map((o) => ({ lat: o.lat!, lng: o.lng! })),
      inicioRuta,
      { fin: rutaFin ? { lat: rutaFin.lat, lng: rutaFin.lng } : null, cerrarCiclo: !rutaFin && volverAlInicio }
    );
    return { km, min: Math.round((km / 22) * 60) };
  }, [ubicados, inicioRuta, rutaFin, volverAlInicio]);

  /** Siguiente parada pendiente (por nº de orden) */
  const siguienteParada = useMemo(
    () =>
      orders
        .filter((o) => o.estado === 'pendiente')
        .sort((a, b) => (a.num ?? 999) - (b.num ?? 999))[0] || null,
    [orders]
  );

  // ── Inicializar mapa (una sola vez) ───────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: [LIMA_CENTRO.lat, LIMA_CENTRO.lng],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    const t = tilesDeEstilo(getEstiloMapa());
    tileRef.current = L.tileLayer(t.url, {
      maxZoom: t.maxZoom,
      subdomains: (t.subdomains as string) || 'abc',
      attribution: t.attribution,
    }).addTo(map);

    clientesLayerRef.current = L.layerGroup().addTo(map);
    rutaLineRef.current = L.polyline([], {
      color: '#6366f1',
      weight: 3.5,
      dashArray: '6 9',
      opacity: 0.9,
      className: 'rtmap-ruta',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      clientesLayerRef.current = null;
      riderMarkerRef.current = null;
      rutaLineRef.current = null;
      inicioMarkerRef.current = null;
      finMarkerRef.current = null;
      numMarcadoresRef.current = -1;
    };
  }, []);

  // ── Cambiar tiles cuando cambia el estilo ────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) {
      map.removeLayer(tileRef.current);
    }
    const t = tilesDeEstilo(estilo);
    tileRef.current = L.tileLayer(t.url, {
      maxZoom: t.maxZoom,
      subdomains: (t.subdomains as string) || 'abc',
      attribution: t.attribution,
    }).addTo(map);
    tileRef.current.bringToBack();
  }, [estilo]);

  // ── GPS en vivo ───────────────────────────────────────────
  useEffect(() => {
    setGpsEstado('buscando');
    const detener = vigilarPosicion(
      (c) => {
        setMiPosicion(c);
        setGpsEstado('ok');
      },
      () => {
        setGpsEstado((prev) => (prev === 'ok' ? 'ok' : 'no'));
      }
    );
    return detener;
  }, [reintentosGPS]);

  // ── Marcadores de clientes ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const layer = clientesLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    for (const o of ubicados) {
      const color =
        o.estado === 'entregado'
          ? '#10b981' // verde
          : o.estado === 'cancelado'
          ? '#ef4444' // rojo
          : '#f59e0b'; // ámbar

      const esAprox = o.latSrc === 'aprox';
      const esSiguiente =
        !!siguienteParada && siguienteParada.id === o.id;

      // Marcador numerado; el siguiente pendiente PULSA; los
      // aproximados van punteados y semitransparentes
      const anillo = esSiguiente
        ? `<span style="position:absolute;inset:-7px;border-radius:50%;border:2px solid ${color};opacity:0.9;animation:rtmapPing 1.6s ease-out infinite"></span>`
        : '';
      const cuerpo =
        `<div style="position:relative;width:30px;height:30px;">${anillo}` +
        `<div style="width:30px;height:30px;border-radius:50%;background:${color};` +
        `${esAprox ? 'opacity:0.75;border:2px dashed #ffffff;' : 'border:2px solid #ffffff;'}` +
        `box-shadow:0 2px 6px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;` +
        `color:#fff;font-weight:800;font-size:12px;font-family:system-ui;">${o.num ?? '•'}</div>` +
        `${esAprox ? `<span style="position:absolute;top:-6px;right:-8px;background:#f59e0b;color:#fff;font-size:8px;font-weight:900;border-radius:6px;padding:0 3px;border:1px solid #fff">≈</span>` : ''}` +
        `</div>`;

      const icon = L.divIcon({
        className: '',
        html: cuerpo,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
      });

      const waUrl = linkWhatsApp(
        o.clienteTelefono,
        `Hola ${o.cliente} 👋 Te escribo desde ${riderName ? esc(riderName) : 'RiderTrack'} por tu entrega de hoy.`
      );
      const navUrl =
        o.lat != null && o.lng != null
          ? linkNavegacion({ lat: o.lat, lng: o.lng })
          : '';

      const popupHtml =
        `<div style="min-width:190px">` +
        `<div style="font-weight:800;font-size:13px;margin-bottom:2px">#${o.num ?? '·'} ${esc(o.cliente)}</div>` +
        `<div style="opacity:0.75;font-size:11px;margin-bottom:6px">${esc(o.direccion)}${o.distrito ? `, ${esc(o.distrito)}` : ''}</div>` +
        (esAprox
          ? `<div style="font-size:10.5px;background:#78350f;color:#fbbf24;padding:3px 6px;border-radius:6px;margin-bottom:6px">⚠️ Ubicación aproximada (centro del distrito). Precísala en Mi Ruta → Ubicar.</div>`
          : '') +
        `<div style="font-size:11.5px;line-height:1.6">` +
        `<div><b>Estado:</b> ${esc(ETIQUETAS_ESTADO[o.stReal || ''] || o.stReal || o.estado)}</div>` +
        `<div><b>Monto:</b> S/ ${(o.monto || 0).toFixed(2)}</div>` +
        (o.hora ? `<div><b>Hora:</b> ${esc(o.hora)}</div>` : '') +
        `</div>` +
        `<div style="display:flex;gap:6px;margin-top:8px">` +
        (o.clienteTelefono
          ? `<a href="${waUrl}" target="_blank" rel="noopener" style="text-decoration:none;background:#059669;color:#fff;padding:5px 9px;border-radius:8px;font-size:11px;font-weight:700">💬 WhatsApp</a>`
          : '') +
        (navUrl
          ? `<a href="${navUrl}" target="_blank" rel="noopener" style="text-decoration:none;background:#2563eb;color:#fff;padding:5px 9px;border-radius:8px;font-size:11px;font-weight:700">🛵 Navegar</a>`
          : '') +
        `</div>` +
        `</div>`;

      L.marker([o.lat!, o.lng!], { icon })
        .bindPopup(popupHtml, { className: 'rtmap-popup', closeButton: true })
        .addTo(layer);
    }

    // Ajustar vista SOLO cuando cambia la cantidad de marcadores
    // (para no robar el zoom al usuario mientras se mueve)
    const claveVista = `${ubicados.length}-${!!rutaInicio}-${!!rutaFin}`;
    if (claveVista !== numMarcadoresRef.current) {
      numMarcadoresRef.current = claveVista;
      if (ubicados.length > 0 || rutaInicio || rutaFin) {
        const puntos: [number, number][] = ubicados.map((o) => [o.lat!, o.lng!] as [number, number]);
        if (rutaInicio) puntos.push([rutaInicio.lat, rutaInicio.lng]);
        if (rutaFin) puntos.push([rutaFin.lat, rutaFin.lng]);
        if (miPosicion) puntos.push([miPosicion.lat, miPosicion.lng]);
        const bounds = L.latLngBounds(puntos);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, ubicados, rutaInicio, rutaFin]);

  // ── Marcador del rider (¡el motito!) + inicio/fin + línea ─
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 🛵 Motito del rider (GPS real, se mueve en vivo)
    if (miPosicion) {
      const icon = L.divIcon({
        className: '',
        html:
          `<div style="position:relative;width:38px;height:38px">` +
          `<span style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.35;animation:rtmapPing 1.8s ease-out infinite"></span>` +
          `<div style="position:absolute;inset:3px;border-radius:50%;background:#2563eb;border:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center">` +
          SVG_MOTO +
          `</div>` +
          `</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng([miPosicion.lat, miPosicion.lng]);
        riderMarkerRef.current.setIcon(icon);
      } else {
        riderMarkerRef.current = L.marker([miPosicion.lat, miPosicion.lng], { icon, zIndexOffset: 1000 })
          .bindTooltip(riderName || 'Tú', { className: 'rtmap-tooltip', direction: 'top', offset: [0, -18] })
          .addTo(map);
      }
    }

    // 🏁 Inicio de ruta (bandera verde)
    if (rutaInicio) {
      const icon = L.divIcon({
        className: '',
        html:
          `<div style="width:32px;height:32px;border-radius:50%;background:#10b981;border:3px solid #fff;` +
          `box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center">` +
          `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
          `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>` +
          `<line x1="4" y1="22" x2="4" y2="15"></line>` +
          `</svg></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      if (inicioMarkerRef.current) {
        inicioMarkerRef.current.setLatLng([rutaInicio.lat, rutaInicio.lng]);
      } else {
        inicioMarkerRef.current = L.marker([rutaInicio.lat, rutaInicio.lng], { icon, zIndexOffset: 900 })
          .bindTooltip(`🏁 Inicio: ${rutaInicio.nombre}`, {
            className: 'rtmap-tooltip', direction: 'top', offset: [0, -16],
          })
          .addTo(map);
      }
    } else if (inicioMarkerRef.current) {
      map.removeLayer(inicioMarkerRef.current);
      inicioMarkerRef.current = null;
    }

    // 🏁 Fin de ruta (bandera roja/cuadros)
    if (rutaFin) {
      const icon = L.divIcon({
        className: '',
        html:
          `<div style="width:32px;height:32px;border-radius:50%;background:#f43f5e;border:3px solid #fff;` +
          `box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center">` +
          `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
          `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>` +
          `<line x1="4" y1="22" x2="4" y2="15"></line>` +
          `</svg></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      if (finMarkerRef.current) {
        finMarkerRef.current.setLatLng([rutaFin.lat, rutaFin.lng]);
      } else {
        finMarkerRef.current = L.marker([rutaFin.lat, rutaFin.lng], { icon, zIndexOffset: 900 })
          .bindTooltip(`🏁 Fin: ${rutaFin.nombre}`, {
            className: 'rtmap-tooltip', direction: 'top', offset: [0, -16],
          })
          .addTo(map);
      }
    } else if (finMarkerRef.current) {
      map.removeLayer(finMarkerRef.current);
      finMarkerRef.current = null;
    }

    // Línea de ruta animada: inicio → parada 1 → … → fin
    const puntos: [number, number][] = [];
    if (rutaInicio) puntos.push([rutaInicio.lat, rutaInicio.lng]);
    else if (miPosicion) puntos.push([miPosicion.lat, miPosicion.lng]);
    for (const o of ubicados) puntos.push([o.lat!, o.lng!]);
    if (rutaFin) puntos.push([rutaFin.lat, rutaFin.lng]);
    rutaLineRef.current?.setLatLngs(puntos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miPosicion, ubicados, rutaInicio, rutaFin]);

  const centrarEnMi = () => {
    if (miPosicion && mapRef.current) {
      mapRef.current.setView([miPosicion.lat, miPosicion.lng], 16, { animate: true });
    }
  };

  /** Ciclar estilo de mapa: oscuro → claro → estándar */
  const cambiarEstilo = () => {
    const orden: EstiloMapa[] = ['oscuro', 'claro', 'estandar'];
    const siguiente = orden[(orden.indexOf(estilo) + 1) % orden.length];
    setEstilo(siguiente);
    import('../services/mapStyle').then(({ setEstiloMapa }) => setEstiloMapa(siguiente));
  };

  const nombreEstilo = estilo === 'oscuro' ? 'Oscuro' : estilo === 'claro' ? 'Claro' : 'Estándar';

  return (
    <div className="relative rounded-2xl bg-slate-800 dark:bg-slate-800 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-200 overflow-hidden shadow-xl flex flex-col">
      {/* Estilos para popups/tooltip oscuros + animaciones sobre el mapa Leaflet */}
      <style>{`
        @keyframes rtmapPing { 0% { transform: scale(1); opacity: 0.6 } 100% { transform: scale(2.6); opacity: 0 } }
        @keyframes rtmapFlujo { to { stroke-dashoffset: -300; } }
        .rtmap-ruta { animation: rtmapFlujo 18s linear infinite; }
        .rtmap-popup .leaflet-popup-content-wrapper { background: #1e293b; color: #f1f5f9; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
        .rtmap-popup .leaflet-popup-tip { background: #1e293b; border: 1px solid #334155; }
        .rtmap-popup .leaflet-popup-content { margin: 12px 14px; font-size: 12px; line-height: 1.5; }
        .rtmap-tooltip.leaflet-tooltip { background: #1e293b; color: #f1f5f9; border: 1px solid #334155; font-size: 11px; font-weight: 700; }
        .rtmap-tooltip.leaflet-tooltip::before { border-top-color: #1e293b; }
        .leaflet-container { background: #0f172a; font-family: inherit; }
        .leaflet-bar a { background: #1e293b; color: #e2e8f0; border-color: #334155; }
        .leaflet-bar a:hover { background: #334155; }
        .leaflet-control-attribution { background: rgba(15,23,42,.75) !important; color: #94a3b8 !important; font-size: 9px !important; }
        .leaflet-control-attribution a { color: #cbd5e1 !important; }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 px-5 bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-100 border-b border-slate-700/70 dark:border-slate-700/70 light:border-slate-200 z-[500]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white dark:text-white light:text-slate-900 flex items-center gap-2">
              Mapa de Entregas
              {gpsEstado === 'ok' && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {ubicados.length} de {orders.length} clientes ubicados
              {sinUbicar > 0 && ` · ${sinUbicar} sin ubicación`}
              {aproxCount > 0 && ` · ${aproxCount} aprox.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Chips de estado reales */}
          <div className="flex gap-1 text-[11px] font-bold">
            <span className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
              {pendientes} pend.
            </span>
            <span className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              {entregados} entreg.
            </span>
            {fallidos > 0 && (
              <span className="px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400">
                {fallidos} fallidos
              </span>
            )}
          </div>

          {/* Botón estilo de mapa (skin) */}
          <button
            onClick={cambiarEstilo}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
            title="Cambiar el estilo del mapa (oscuro / claro / estándar)"
          >
            🎨 {nombreEstilo}
          </button>

          {/* Estado GPS real */}
          {gpsEstado === 'buscando' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando GPS…
            </span>
          )}
          {gpsEstado === 'ok' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
              <Crosshair className="w-3.5 h-3.5" /> GPS activo
            </span>
          )}
          {gpsEstado === 'no' && (
            <button
              onClick={() => setReintentosGPS((n) => n + 1)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all"
              title="Sin señal GPS — tocar para reintentar"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sin GPS · Reintentar
            </button>
          )}
        </div>
      </div>

      {/* Mapa Leaflet real — SIEMPRE visible (Fase 1.4) */}
      <div className="relative h-[420px] sm:h-[520px]">
        <div ref={mapDivRef} className="absolute inset-0 z-0" />

        {/* Botón centrar en mi posición */}
        <button
          onClick={centrarEnMi}
          disabled={!miPosicion}
          className="absolute bottom-4 right-3 z-[500] p-2.5 rounded-xl bg-slate-900/90 text-white hover:bg-slate-800 border border-slate-700 shadow-lg disabled:opacity-40 transition-all"
          title="Centrar mapa en mi posición"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Leyenda */}
        <div className="absolute top-3 left-3 z-[500] flex flex-col gap-1 px-2.5 py-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-[10px] font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white/60" /> Tú (GPS)
          </span>
          {rutaInicio && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Inicio
            </span>
          )}
          {rutaFin && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Fin
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pendiente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Entregado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Fallido
          </span>
        </div>

        {/* Banner compacto: ruta vacía (NO tapa el mapa) */}
        {orders.length === 0 && (
          <div className="absolute bottom-4 left-3 right-16 z-[600] p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl flex items-center gap-3">
            <MapPin className="w-6 h-6 text-slate-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">La ruta de hoy está vacía</p>
              <p className="text-[10px] text-slate-400">Importa tu Excel o agrega clientes en Mi Ruta.</p>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('ruta')}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shrink-0 transition-all active:scale-95"
              >
                Ir a Mi Ruta
              </button>
            )}
          </div>
        )}

        {/* Banner compacto: clientes sin ubicación (NO tapa el mapa) */}
        {orders.length > 0 && sinUbicar > 0 && (
          <div className="absolute bottom-4 left-3 right-16 z-[600] p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-amber-500/40 shadow-2xl flex items-center gap-3">
            <RouteIcon className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">
                {textoSinUbicar(sinUbicar)} aún sin ubicación
              </p>
              <p className="text-[10px] text-slate-400">
                Mi Ruta → botón “Ruta” las ubica, o ubícalas a mano con “📍 Ubicar”.
              </p>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('ruta')}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold shrink-0 transition-all active:scale-95"
              >
                Ubicar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Barra inferior: siguiente parada + estimación de ruta */}
      <div className="p-3.5 px-5 bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-100 border-t border-slate-700/70 dark:border-slate-700/70 light:border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {siguienteParada ? (
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">
              Siguiente parada
            </p>
            <p className="text-sm font-bold text-white dark:text-white light:text-slate-900 truncate">
              #{siguienteParada.num ?? '·'} {siguienteParada.cliente}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {siguienteParada.direccion}
              {siguienteParada.distrito ? `, ${siguienteParada.distrito}` : ''}
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Ruta</p>
            <p className="text-sm font-bold text-white dark:text-white light:text-slate-900">
              {orders.length === 0
                ? 'Sin clientes'
                : entregados === orders.length
                ? '¡Ruta completada! 🎉'
                : 'Sin paradas pendientes'}
            </p>
            {rutaInicio && (
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                <Flag className="w-3 h-3 text-emerald-400" /> Desde: {rutaInicio.nombre}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {/* Estimación real de la ruta */}
          {ubicados.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[11px] font-bold">
              <RouteIcon className="w-3.5 h-3.5" />
              ~{estimacion.km} km · {estimacion.min} min
            </span>
          )}

          {siguienteParada?.clienteTelefono && onOpenWhatsApp && (
            <button
              onClick={() => onOpenWhatsApp(siguienteParada.clienteTelefono, siguienteParada.cliente)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
            </button>
          )}

          {siguienteParada?.lat != null && siguienteParada.lng != null && (
            <a
              href={linkNavegacion({ lat: siguienteParada.lat, lng: siguienteParada.lng })}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all"
              title={`Navegar con ${nombreAppNavegacion(getAppNavegacion())}`}
            >
              <Navigation className="w-3.5 h-3.5" /> Navegar
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

/** "1 cliente aún sin ubicación" / "N clientes aún sin ubicación" */
function textoSinUbicar(n: number): string {
  return n === 1 ? '1 cliente' : `${n} clientes`;
}
