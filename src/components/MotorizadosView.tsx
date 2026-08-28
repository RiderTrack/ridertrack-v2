// ═══════════════════════════════════════════════════════════
// 🛰️ GPS DEL MOTORIZADO — Fase 1.5
// Vista premium de seguimiento (pensada para crecer a flota):
//   • Mapa en vivo con tu motito GRANDE + halo pulsante + flecha
//     de rumbo, que te SIGUE mientras avanzas (modo seguir)
//   • Tarjeta del rider: avatar, velocidad en vivo, rumbo, última
//     actualización y botón compartir ubicación por WhatsApp
//   • La ruta del día dibujada al fondo (tenue) con la siguiente
//     parada resaltada
//   • Cronómetro de ruta + aviso silencioso (la función del Rider
//     modular que sincroniza con el bot de WhatsApp)
//   • Preparado multi-motorizado: publica tu posición en
//     ruta_activa/{uid}.posicion — base para el panel de flota
//     (cuando vendas RiderTrack, el jefe verá a todos sus riders)
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Radar,
  Crosshair,
  Loader2,
  RefreshCw,
  Share2,
  Gauge,
  Navigation as NavIcon,
  Lock,
  Unlock,
  MapPin,
  Bike,
} from 'lucide-react';
import { Order, NavigationTab } from '../types';
import { Coordenadas, vigilarPosicion } from '../services/geocoding';
import { getEstiloMapa, tilesDeEstilo, EstiloMapa } from '../services/mapStyle';
import { urlNavegacion } from '../services/navegacion';
import { AvatarSvg } from '../data/avatars';
import { useAuth } from '../hooks/useAuth';
import { publicarPosicionRider } from '../services/firestore';

interface MotorizadosViewProps {
  orders: Order[];
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

/** Moto grande con halo y flecha de rumbo (divIcon) */
function iconoMotoGrande(rumbo: number | null): L.DivIcon {
  const flecha =
    rumbo != null
      ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%) rotate(${rumbo}deg);
          width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
          border-bottom:10px solid #38bdf8;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))"></div>`
      : '';
  const html =
    `<div style="position:relative;width:54px;height:54px;">${flecha}` +
    `<div style="position:absolute;inset:0;border-radius:50%;background:#2563eb;opacity:0.25;
       animation:rtGpsPing 2s ease-out infinite"></div>` +
    `<div style="position:absolute;inset:6px;border-radius:50%;background:#2563eb;
       border:3px solid #ffffff;box-shadow:0 4px 14px rgba(37,99,235,0.55);
       display:flex;align-items:center;justify-content:center">` +
    `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2.2"
        stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="18.5" cy="17.5" r="3.4"></circle><circle cx="5.5" cy="17.5" r="3.4"></circle>` +
    `<circle cx="15" cy="5" r="1"></circle><path d="M12 17.5V14l-3-3 4-3 2 3h2"></path></svg>` +
    `</div></div>`;
  return L.divIcon({ className: '', html, iconSize: [54, 54], iconAnchor: [27, 27] });
}

export const MotorizadosView: React.FC<MotorizadosViewProps> = ({ orders, onShowToast }) => {
  const { user, profile } = useAuth();
  const riderNombre = profile?.nombre || user?.displayName || 'Rider';
  const avatarId = profile?.avatar;

  // ── Estado GPS ────────────────────────────────────────────
  const [gpsEstado, setGpsEstado] = useState<'buscando' | 'ok' | 'no'>('buscando');
  const [miPosicion, setMiPosicion] = useState<Coordenadas | null>(null);
  const [reintentosGPS, setReintentosGPS] = useState(0);
  const [velocidad, setVelocidad] = useState(0);
  const [rumbo, setRumbo] = useState<number | null>(null);
  const [ultimaVez, setUltimaVez] = useState<Date | null>(null);

  // Velocidad/rumbo calculados de los deltas entre posiciones
  const prevPosRef = useRef<{ c: Coordenadas; t: number } | null>(null);

  // ── Modo seguir ───────────────────────────────────────────
  const [seguir, setSeguir] = useState(true);

  // ── Estilo de mapa ────────────────────────────────────────
  const [estilo, setEstilo] = useState<EstiloMapa>(() => getEstiloMapa());

  // ── Refs del mapa ─────────────────────────────────────────
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const capaRutaRef = useRef<L.LayerGroup | null>(null);
  const rutaLineRef = useRef<L.Polyline | null>(null);

  // ── Datos de ruta (fondo tenue) ───────────────────────────
  const ubicados = useMemo(
    () =>
      orders
        .filter((o) => typeof o.lat === 'number' && typeof o.lng === 'number')
        .sort((a, b) => (a.num ?? 999) - (b.num ?? 999)),
    [orders]
  );
  const siguienteParada = useMemo(
    () => orders.filter((o) => o.estado === 'pendiente').sort((a, b) => (a.num ?? 999) - (b.num ?? 999))[0] || null,
    [orders]
  );

  const distanciaASiguiente = useMemo(() => {
    if (!miPosicion || !siguienteParada?.lat || !siguienteParada?.lng) return null;
    const R = 6371;
    const dLat = ((siguienteParada.lat - miPosicion.lat) * Math.PI) / 180;
    const dLng = ((siguienteParada.lng - miPosicion.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((miPosicion.lat * Math.PI) / 180) *
        Math.cos((siguienteParada.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [miPosicion, siguienteParada]);

  // ── Inicializar mapa ──────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      center: miPosicion ? [miPosicion.lat, miPosicion.lng] : [-12.046, -77.043],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });
    const t = tilesDeEstilo(getEstiloMapa());
    tileRef.current = L.tileLayer(t.url, {
      maxZoom: t.maxZoom,
      subdomains: (t.subdomains as string) || 'abc',
      attribution: t.attribution,
    }).addTo(map);

    capaRutaRef.current = L.layerGroup().addTo(map);
    rutaLineRef.current = L.polyline([], {
      color: '#6366f1',
      weight: 3,
      opacity: 0.45,
      dashArray: '5 8',
    }).addTo(map);
    mapRef.current = map;

    // Escuchar cambio de tema en vivo (el toggle de la app avisa)
    const onTema = () => setEstilo(getEstiloMapa());
    window.addEventListener('rt_theme', onTema);
    return () => {
      window.removeEventListener('rt_theme', onTema);
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      riderMarkerRef.current = null;
      capaRutaRef.current = null;
      rutaLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cambiar tiles al cambiar estilo ───────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    const t = tilesDeEstilo(estilo);
    tileRef.current = L.tileLayer(t.url, {
      maxZoom: t.maxZoom,
      subdomains: (t.subdomains as string) || 'abc',
      attribution: t.attribution,
    }).addTo(map);
    tileRef.current.bringToBack();
  }, [estilo]);

  // ── GPS en vivo + cálculo de velocidad/rumbo ──────────────
  useEffect(() => {
    setGpsEstado('buscando');
    const detener = vigilarPosicion(
      (c) => {
        const ahora = Date.now();
        const prev = prevPosRef.current;
        if (prev) {
          const dt = (ahora - prev.t) / 1000;
          if (dt > 0.5) {
            const dLat = ((c.lat - prev.c.lat) * Math.PI) / 180;
            const dLng = ((c.lng - prev.c.lng) * Math.PI) / 180;
            const mLat = dLat * 111320;
            const mLng = dLng * 111320 * Math.cos((c.lat * Math.PI) / 180);
            const distM = Math.sqrt(mLat * m2(mLat) + mLng * m2(mLng));
            const kmh = (distM / dt) * 3.6;
            if (distM > 4) {
              setVelocidad(Math.max(0, Math.min(120, kmh)));
              const grados = (Math.atan2(mLng, mLat) * 180) / Math.PI;
              setRumbo((r) => suavizarRumbo(r, grados));
            } else {
              setVelocidad(0);
            }
          }
        }
        prevPosRef.current = { c, t: ahora };
        setMiPosicion(c);
        setUltimaVez(new Date());
        setGpsEstado('ok');
      },
      () => setGpsEstado((p) => (p === 'ok' ? 'ok' : 'no'))
    );
    return detener;
  }, [reintentosGPS]);

  // ── Mover marcador + seguir ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !miPosicion) return;

    if (!riderMarkerRef.current) {
      riderMarkerRef.current = L.marker([miPosicion.lat, miPosicion.lng], {
        icon: iconoMotoGrande(rumbo),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      riderMarkerRef.current.setLatLng([miPosicion.lat, miPosicion.lng]);
    }

    if (seguir) {
      map.panTo([miPosicion.lat, miPosicion.lng], { animate: true, duration: 0.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miPosicion, seguir]);

  // ── Girar la flecha de rumbo (sin recrear el marcador) ────
  useEffect(() => {
    if (riderMarkerRef.current && rumbo != null) {
      riderMarkerRef.current.setIcon(iconoMotoGrande(rumbo));
    }
  }, [rumbo]);

  // ── Dibujar ruta tenue de fondo ───────────────────────────
  useEffect(() => {
    const capa = capaRutaRef.current;
    const linea = rutaLineRef.current;
    if (!capa || !linea) return;
    capa.clearLayers();

    for (const o of ubicados) {
      const esSiguiente = siguienteParada?.id === o.id;
      const color = esSiguiente ? '#f59e0b' : o.estado === 'entregado' ? '#10b981' : '#94a3b8';
      const tam = esSiguiente ? 12 : 9;
      L.circleMarker([o.lat!, o.lng!], {
        radius: tam / 2 + 2,
        color: '#ffffff',
        weight: esSiguiente ? 2 : 1,
        fillColor: color,
        fillOpacity: esSiguiente ? 1 : 0.65,
      })
        .bindTooltip(
          `<b>#${o.num ?? '·'} ${o.cliente}</b><br><span style="font-size:11px">${o.direccion || ''}</span>`,
          { direction: 'top' }
        )
        .addTo(capa);
    }
    if (ubicados.length > 1) {
      linea.setLatLngs(ubicados.map((o) => [o.lat!, o.lng!] as [number, number]));
    } else {
      linea.setLatLngs([]);
    }
  }, [ubicados, siguienteParada]);

  // ── Publicar posición para el futuro panel de flota ───────
  const ultimaPubRef = useRef(0);
  useEffect(() => {
    if (!user || !miPosicion) return;
    const ahora = Date.now();
    if (ahora - ultimaPubRef.current < 10000) return; // máx 1 cada 10 s
    ultimaPubRef.current = ahora;
    publicarPosicionRider(user.uid, {
      lat: miPosicion.lat,
      lng: miPosicion.lng,
      velocidadKmh: Math.round(velocidad),
      rumbo: rumbo ?? undefined,
      actualizadoAt: new Date().toISOString(),
    });
  }, [miPosicion, user, velocidad, rumbo]);

  // ── Acciones ──────────────────────────────────────────────
  const centrarEnMi = () => {
    if (miPosicion && mapRef.current) {
      setSeguir(true);
      mapRef.current.setView([miPosicion.lat, miPosicion.lng], 16, { animate: true });
    }
  };

  const compartirUbicacion = () => {
    if (!miPosicion) {
      onShowToast?.('📍 Sin GPS aún', 'Espera a que te ubique para compartir', 'warning');
      return;
    }
    const url = `https://www.google.com/maps?q=${miPosicion.lat},${miPosicion.lng}`;
    const texto = `📍 Mi ubicación en vivo (RiderTrack):\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const hace = (d: Date | null): string => {
    if (!d) return '—';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 5) return 'ahora mismo';
    if (s < 60) return `hace ${s} s`;
    return `hace ${Math.floor(s / 60)} min`;
  };

  const estadoRider =
    gpsEstado === 'ok' ? (velocidad > 2 ? 'En movimiento' : 'Detenido') : gpsEstado === 'buscando' ? 'Buscando señal…' : 'Sin señal GPS';

  return (
    <div className="space-y-4 pb-16">
      {/* Animación del ping del GPS */}
      <style>{`
        @keyframes rtGpsPing {
          0% { transform: scale(0.7); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-600/25 via-slate-800 to-slate-800 border border-blue-500/30 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
            <Radar className="w-6 h-6 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-white">GPS del Motorizado</h1>
            <p className="text-xs text-slate-400">
              Ubicación en vivo de tu flota — por ahora tú; lista para crecer 🚀
            </p>
          </div>
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-bold whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> EN VIVO
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ═══ COLUMNA IZQUIERDA (2/3): MAPA ═══ */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl bg-slate-800 border border-slate-700 shadow-xl overflow-hidden">
            {/* Barra superior del mapa */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-slate-700/70 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${
                    gpsEstado === 'ok'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : gpsEstado === 'buscando'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}
                >
                  {gpsEstado === 'buscando' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {gpsEstado === 'ok' && <Crosshair className="w-3.5 h-3.5" />}
                  {gpsEstado === 'no' && (
                    <button onClick={() => setReintentosGPS((n) => n + 1)} className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" /> Sin GPS · Reintentar
                    </button>
                  )}
                  {gpsEstado !== 'no' && (gpsEstado === 'ok' ? 'GPS activo' : 'Buscando GPS…')}
                </span>

                {/* Velocidad en vivo */}
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-bold tabular-nums">
                  <Gauge className="w-3.5 h-3.5" /> {Math.round(velocidad)} km/h
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Modo seguir */}
                <button
                  onClick={() => setSeguir((s) => !s)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    seguir
                      ? 'border-blue-500/40 bg-blue-500/15 text-blue-400'
                      : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                  }`}
                  title={seguir ? 'El mapa te sigue (tocar para liberar)' : 'Mapa libre (tocar para seguirte)'}
                >
                  {seguir ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  {seguir ? 'Siguiéndote' : 'Libre'}
                </button>
                <button
                  onClick={centrarEnMi}
                  disabled={!miPosicion}
                  className="p-2 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-white border border-slate-600 transition-all disabled:opacity-40"
                  title="Centrar en mi posición"
                >
                  <Crosshair className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* El mapa */}
            <div className="relative h-[380px] sm:h-[460px]">
              <div ref={mapDivRef} className="absolute inset-0 z-0" />

              {/* Chip de distancia a la siguiente parada */}
              {siguienteParada && distanciaASiguiente != null && (
                <div className="absolute top-3 left-3 z-[500] px-3 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-amber-500/40 shadow-lg">
                  <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Siguiente parada</p>
                  <p className="text-xs font-black text-white truncate max-w-[180px]">
                    #{siguienteParada.num ?? '·'} {siguienteParada.cliente}
                  </p>
                  <p className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    a {distanciaASiguiente < 1
                      ? `${Math.round(distanciaASiguiente * 1000)} m`
                      : `${distanciaASiguiente.toFixed(1)} km`}
                  </p>
                </div>
              )}

              {/* Botón navegar a la siguiente parada (respeta Google/Waze) */}
              {siguienteParada?.lat != null && siguienteParada.lng != null && (
                <a
                  href={urlNavegacion(siguienteParada.lat, siguienteParada.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 z-[500] flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95"
                >
                  <NavIcon className="w-4 h-4" /> Navegar
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ═══ COLUMNA DERECHA (1/3): RIDER + CRONÓMETRO ═══ */}
        <div className="space-y-4">
          {/* Tarjeta del rider */}
          <div className="rounded-2xl bg-slate-800 border border-slate-700 shadow-xl p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <AvatarSvg
                  id={avatarId}
                  className="w-14 h-14"
                  anillo={gpsEstado === 'ok' ? 'ring-2 ring-emerald-500/60' : 'ring-2 ring-slate-600'}
                />
                <span
                  className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-800 ${
                    gpsEstado === 'ok' ? 'bg-emerald-500' : gpsEstado === 'buscando' ? 'bg-amber-400' : 'bg-red-500'
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white truncate">{riderNombre}</p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Bike className="w-3 h-3" /> {estadoRider}
                </p>
                <p className="text-[10px] text-slate-500">Actualizado: {hace(ultimaVez)}</p>
              </div>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-700/60 text-center">
                <p className="text-[9px] uppercase font-bold text-slate-500">Velocidad</p>
                <p className="text-sm font-black text-indigo-400 tabular-nums">{Math.round(velocidad)}</p>
                <p className="text-[8px] text-slate-500">km/h</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-700/60 text-center">
                <p className="text-[9px] uppercase font-bold text-slate-500">Paradas</p>
                <p className="text-sm font-black text-amber-400 tabular-nums">
                  {orders.filter((o) => o.estado === 'pendiente').length}
                </p>
                <p className="text-[8px] text-slate-500">pendientes</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-700/60 text-center">
                <p className="text-[9px] uppercase font-bold text-slate-500">Entregas</p>
                <p className="text-sm font-black text-emerald-400 tabular-nums">
                  {orders.filter((o) => o.estado === 'entregado').length}
                </p>
                <p className="text-[8px] text-slate-500">de {orders.length}</p>
              </div>
            </div>

            {/* Compartir ubicación */}
            <button
              onClick={compartirUbicacion}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4" /> Compartir mi ubicación
            </button>
          </div>

          {/* Nota: el cronómetro de ruta vive en Mi Ruta (Fase 2.2) —
              CronometroRuta con aviso silencioso al bot y voz. */}
        </div>
      </div>
    </div>
  );
};

// ── helpers de velocidad/rumbo ──
function m2(x: number): number {
  return x * x;
}

/** Suaviza el rumbo para que la flecha no salte (interp. angular) */
function suavizarRumbo(prev: number | null, nuevo: number): number {
  if (prev == null) return nuevo;
  let diff = nuevo - prev;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return (prev + diff * 0.6 + 360) % 360;
}
