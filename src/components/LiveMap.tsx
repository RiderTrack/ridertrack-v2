// ═══════════════════════════════════════════════════════════
// 🗺️ LIVE MAP - RiderTrack V2 (Fase 1.3)
// Mapa REAL (Leaflet + OpenStreetMap, sin API key) con:
//   • Tu posición GPS real (punto azul, se actualiza en vivo)
//   • Marcadores de clientes con nº de orden y color por estado
//   • Línea de la ruta en orden de entrega
//   • Popups con WhatsApp directo y navegación en moto hacia
//     la coordenada real del cliente
//
// Reemplaza al mapa SVG decorativo con repartidores ficticios
// que se movían con Math.random(). Aquí todo es real: si un
// cliente no tiene ubicación geocodificada, se dice — no se
// inventa nada.
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
} from 'lucide-react';
import { Order } from '../types';
import { Coordenadas, vigilarPosicion } from '../services/geocoding';
import { distanciaRutaKm, LIMA_CENTRO } from '../services/routeOptimizer';
import { linkWhatsApp, ETIQUETAS_ESTADO } from '../utils/realData';

interface LiveMapProps {
  orders: Order[];
  riderName?: string;
  onOpenWhatsApp?: (telefono: string, nombre: string) => void;
}

/** Escapa texto para incrustarlo en el HTML del popup (seguridad) */
function esc(texto: string | undefined | null): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const LiveMap: React.FC<LiveMapProps> = ({
  orders,
  riderName,
  onOpenWhatsApp,
}) => {
  // ── Estado GPS ────────────────────────────────────────────
  const [gpsEstado, setGpsEstado] = useState<'buscando' | 'ok' | 'no'>('buscando');
  const [miPosicion, setMiPosicion] = useState<Coordenadas | null>(null);
  const [reintentosGPS, setReintentosGPS] = useState(0);

  // ── Refs del mapa Leaflet ─────────────────────────────────
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clientesLayerRef = useRef<L.LayerGroup | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const rutaLineRef = useRef<L.Polyline | null>(null);
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

  const inicioRuta = miPosicion ?? LIMA_CENTRO;

  const estimacion = useMemo(() => {
    if (ubicados.length === 0) return { km: 0, min: 0 };
    const km = distanciaRutaKm(
      ubicados.map((o) => ({ lat: o.lat!, lng: o.lng! })),
      inicioRuta
    );
    return { km, min: Math.round((km / 22) * 60) };
  }, [ubicados, inicioRuta]);

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

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    clientesLayerRef.current = L.layerGroup().addTo(map);
    rutaLineRef.current = L.polyline([], {
      color: '#3b82f6',
      weight: 3,
      dashArray: '6 8',
      opacity: 0.85,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      clientesLayerRef.current = null;
      riderMarkerRef.current = null;
      rutaLineRef.current = null;
      numMarcadoresRef.current = -1;
    };
  }, []);

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

      const icon = L.divIcon({
        className: '',
        html:
          `<div style="width:30px;height:30px;border-radius:50%;background:${color};` +
          `border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.45);` +
          `display:flex;align-items:center;justify-content:center;` +
          `color:#fff;font-weight:800;font-size:12px;font-family:system-ui;">${o.num ?? '•'}</div>`,
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
          ? `https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}&travelmode=two_wheeler`
          : '';

      const popupHtml =
        `<div style="min-width:190px">` +
        `<div style="font-weight:800;font-size:13px;margin-bottom:2px">#${o.num ?? '·'} ${esc(o.cliente)}</div>` +
        `<div style="opacity:0.75;font-size:11px;margin-bottom:6px">${esc(o.direccion)}${o.distrito ? `, ${esc(o.distrito)}` : ''}</div>` +
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
    if (ubicados.length !== numMarcadoresRef.current) {
      numMarcadoresRef.current = ubicados.length;
      if (ubicados.length > 0) {
        const bounds = L.latLngBounds(ubicados.map((o) => [o.lat!, o.lng!] as [number, number]));
        if (miPosicion) bounds.extend([miPosicion.lat, miPosicion.lng]);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, ubicados]);

  // ── Marcador del rider + línea de ruta ────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Punto azul del rider
    if (miPosicion) {
      const icon = L.divIcon({
        className: '',
        html:
          `<span style="position:relative;display:flex;width:22px;height:22px">` +
          `<span style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.5;animation:rtmapPing 1.6s ease-out infinite"></span>` +
          `<span style="position:relative;width:16px;height:16px;margin:auto;border-radius:50%;background:#2563eb;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></span>` +
          `</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng([miPosicion.lat, miPosicion.lng]);
        riderMarkerRef.current.setIcon(icon);
      } else {
        riderMarkerRef.current = L.marker([miPosicion.lat, miPosicion.lng], { icon, zIndexOffset: 1000 })
          .bindTooltip(riderName || 'Tú', { className: 'rtmap-tooltip', direction: 'top', offset: [0, -12] })
          .addTo(map);
      }
    }

    // Línea de ruta (posición → parada 1 → parada 2 → ...)
    const puntos: [number, number][] = [];
    if (miPosicion) puntos.push([miPosicion.lat, miPosicion.lng]);
    for (const o of ubicados) puntos.push([o.lat!, o.lng!]);
    rutaLineRef.current?.setLatLngs(puntos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miPosicion, ubicados]);

  const centrarEnMi = () => {
    if (miPosicion && mapRef.current) {
      mapRef.current.setView([miPosicion.lat, miPosicion.lng], 16, { animate: true });
    }
  };

  return (
    <div className="relative rounded-2xl bg-slate-800 dark:bg-slate-800 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-200 overflow-hidden shadow-xl flex flex-col">
      {/* Estilos para popups/tooltip oscuros sobre el mapa Leaflet */}
      <style>{`
        @keyframes rtmapPing { 0% { transform: scale(1); opacity: 0.6 } 100% { transform: scale(2.4); opacity: 0 } }
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

      {/* Mapa Leaflet real */}
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

        {/* Estado vacío: sin clientes */}
        {orders.length === 0 && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-6">
            <div className="max-w-xs text-center p-5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
              <MapPin className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <h4 className="font-bold text-white text-sm">La ruta de hoy está vacía</h4>
              <p className="text-xs text-slate-400 mt-1">
                Importa tu Excel o agrega clientes en <b>Mi Ruta</b> y aparecerán aquí con su ubicación real.
              </p>
            </div>
          </div>
        )}

        {/* Estado vacío: clientes sin ubicación */}
        {orders.length > 0 && ubicados.length === 0 && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-6">
            <div className="max-w-xs text-center p-5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
              <RouteIcon className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <h4 className="font-bold text-white text-sm">
                {orders.length} clientes aún sin ubicación
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Ve a <b>Mi Ruta</b> y toca el botón <b>“Ruta”</b> para ubicar las direcciones.
                Después verás cada parada en el mapa y la línea de la ruta.
              </p>
            </div>
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
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {/* Estimación real de la ruta */}
          {ubicados.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-bold">
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
              href={`https://www.google.com/maps/dir/?api=1&destination=${siguienteParada.lat},${siguienteParada.lng}&travelmode=two_wheeler`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all"
            >
              <Navigation className="w-3.5 h-3.5" /> Navegar
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
