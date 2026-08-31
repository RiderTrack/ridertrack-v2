// ═══════════════════════════════════════════════════════════
// 🛰️ GPS DEL MOTORIZADO — RiderTrack V2 (Fase 2.4)
// ───────────────────────────────────────────────────────────
// AHORA con la MISMA visualización premium que el mapa de
// optimización de ruta (Fase 2.0) — pedida "igualito":
//
//   • GOOGLE MAPS como motor principal: skin que sigue al tema,
//     ruta REAL por calles (Directions API) con puntitos
//     fluyendo encima (la animación "viva" del mapa de ruta),
//     marcadores numerados por estado — la siguiente parada
//     PULSA — banderas de INICIO (verde) y FIN (roja), y el
//     motito GRANDE con halo pulsante + flecha de rumbo.
//   • LEAFLET de respaldo gratis: si Google no carga (sin
//     internet / sin clave), el mapa SIEMPRE funciona.
//   • GPS en vivo: velocidad, rumbo suavizado, modo seguir,
//     siguiente parada con distancia, navegar (Google/Waze),
//     compartir ubicación por WhatsApp.
//   • Publica posición en ruta_activa/{uid}.posicion cada 10 s
//     (base del futuro panel de flota — cuando vendas
//     RiderTrack, el jefe verá a todos sus riders).
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
  Palette,
  Route as RouteIcon,
} from 'lucide-react';
import { Order } from '../types';
import { Coordenadas, vigilarPosicion } from '../services/geocoding';
import { getEstiloMapa, tilesDeEstilo, setEstiloMapa, EstiloMapa } from '../services/mapStyle';
import { urlNavegacion } from '../services/navegacion';
import { AvatarSvg } from '../data/avatars';
import { useAuth } from '../hooks/useAuth';
import { useConfig } from '../hooks/useConfig';
import { publicarPosicionRider } from '../services/firestore';
import {
  getGoogleApiKey,
  cargarGoogleMaps,
  estilosGoogleDe,
  HtmlMarkerClass,
} from '../services/googleMaps';
import { obtenerRutaGoogle, firmaRuta } from '../services/googleDirections';
import { LIMA_CENTRO } from '../services/routeOptimizer';

interface MotorizadosViewProps {
  orders: Order[];
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

/** Escapa texto para incrustarlo en HTML (seguridad) */
function esc(texto: string | undefined | null): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** SVG del rider (moto estilo lucide) — mismo del mapa de ruta */
const SVG_MOTO =
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2.2" ` +
  `stroke-linecap="round" stroke-linejoin="round">` +
  `<circle cx="18.5" cy="17.5" r="3.4"></circle>` +
  `<circle cx="5.5" cy="17.5" r="3.4"></circle>` +
  `<circle cx="15" cy="5" r="1"></circle>` +
  `<path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>` +
  `</svg>`;

const SVG_BANDERA =
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ffffff" stroke-width="2.4" ` +
  `stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>` +
  `<line x1="4" y1="22" x2="4" y2="15"></line>` +
  `</svg>`;

/** ═══ Marcadores GOOGLE — IGUALITOS a los del mapa de ruta ═══ */

/** Marcador de parada numerado (mismo look que GoogleLiveMap) */
function htmlParadaGps(o: Order, esSiguiente: boolean): string {
  const color =
    o.estado === 'entregado' ? '#10b981' : o.estado === 'cancelado' ? '#ef4444' : '#f59e0b';
  const esAprox = o.latSrc === 'aprox';
  const anillo = esSiguiente
    ? `<span style="position:absolute;inset:-7px;border-radius:50%;border:2px solid ${color};opacity:0.9;animation:rtgPing 1.6s ease-out infinite"></span>`
    : '';
  return (
    `<div style="position:relative;width:30px;height:30px;cursor:pointer;">${anillo}` +
    `<div style="width:30px;height:30px;border-radius:50%;background:${color};` +
    `${esAprox ? 'opacity:0.75;border:2px dashed #ffffff;' : 'border:2px solid #ffffff;'}` +
    `box-shadow:0 2px 6px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;` +
    `color:#fff;font-weight:800;font-size:12px;font-family:system-ui;">${o.num ?? '•'}</div>` +
    (esAprox
      ? `<span style="position:absolute;top:-6px;right:-8px;background:#f59e0b;color:#fff;font-size:8px;font-weight:900;border-radius:6px;padding:0 3px;border:1px solid #fff">≈</span>`
      : '') +
    `</div>`
  );
}

/** Bandera de inicio (verde) / fin (roja) — igual que el mapa de ruta */
function htmlBanderaGps(color: string): string {
  return (
    `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #fff;` +
    `box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center">` +
    SVG_BANDERA +
    `</div>`
  );
}

/** Motito GRANDE del GPS: halo pulsante + flecha de rumbo (54px) */
function htmlMotitoGps(rumbo: number | null): string {
  const flecha =
    rumbo != null
      ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%) rotate(${rumbo}deg);
          width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
          border-bottom:10px solid #38bdf8;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))"></div>`
      : '';
  return (
    `<div style="position:relative;width:54px;height:54px;">${flecha}` +
    `<span style="position:absolute;inset:0;border-radius:50%;background:#2563eb;opacity:0.3;
       animation:rtgPing 1.8s ease-out infinite"></span>` +
    `<div style="position:absolute;inset:6px;border-radius:50%;background:#2563eb;
       border:3px solid #ffffff;box-shadow:0 4px 14px rgba(37,99,235,0.55);
       display:flex;align-items:center;justify-content:center">` +
    SVG_MOTO +
    `</div></div>`
  );
}

/** ═══ Marcador LEAFLET (respaldo) — el mismo de la 1.5 ═══ */
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
  const { config } = useConfig();
  const riderNombre = profile?.nombre || user?.displayName || 'Rider';
  const avatarId = profile?.avatar;

  // ── Config de ruta (inicio/fin — igual que el mapa de ruta) ──
  const rutaInicio = config?.ruta?.inicio ?? null;
  const rutaFin = config?.ruta?.fin ?? null;

  // ── Motor del mapa: google | leaflet | cargando (como LiveMap) ──
  const [motor, setMotor] = useState<'google' | 'leaflet' | 'cargando'>('cargando');
  const [mapaListo, setMapaListo] = useState(false);
  const apiKey = getGoogleApiKey();

  // ── Estado GPS ────────────────────────────────────────────
  const [gpsEstado, setGpsEstado] = useState<'buscando' | 'ok' | 'no'>('buscando');
  const [miPosicion, setMiPosicion] = useState<Coordenadas | null>(null);
  const [reintentosGPS, setReintentosGPS] = useState(0);
  const [velocidad, setVelocidad] = useState(0);
  const [rumbo, setRumbo] = useState<number | null>(null);
  const [ultimaVez, setUltimaVez] = useState<Date | null>(null);
  const prevPosRef = useRef<{ c: Coordenadas; t: number } | null>(null);

  // ── Modo seguir ───────────────────────────────────────────
  const [seguir, setSeguir] = useState(true);

  // ── Estilo de mapa (oscuro/claro/estándar — sigue al tema) ──
  const [estilo, setEstilo] = useState<EstiloMapa>(() => getEstiloMapa());

  // ── Ruta real por calles (Google) ─────────────────────────
  const [rutaReal, setRutaReal] = useState<{ km: number; min: number } | null>(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);

  // ── Refs GOOGLE ───────────────────────────────────────────
  const mapDivRef = useRef<HTMLDivElement>(null);
  const gmapsRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const HtmlMarkerRef = useRef<any>(null);
  const paradasMarkersRef = useRef<Map<string, any>>(new Map());
  const riderMarkerRef = useRef<any>(null);
  const inicioMarkerRef = useRef<any>(null);
  const finMarkerRef = useRef<any>(null);
  const rutaLineRef = useRef<any>(null);
  const flujoLineRef = useRef<any>(null);
  const flujoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flujoOffsetRef = useRef(0);
  const boundsKeyRef = useRef('');

  // ── Refs LEAFLET (respaldo) ───────────────────────────────
  const mapLeafletDivRef = useRef<HTMLDivElement>(null);
  const mapLRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const riderLMarkerRef = useRef<L.Marker | null>(null);
  const capaRutaRef = useRef<L.LayerGroup | null>(null);
  const rutaLLineRef = useRef<L.Polyline | null>(null);

  // ── Datos derivados ───────────────────────────────────────
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

  /** Firma de la ruta (caché de Directions — la misma ruta no se repide) */
  const firmaActual = useMemo(
    () =>
      firmaRuta(
        rutaInicio ?? LIMA_CENTRO,
        ubicados.map((o) => ({ lat: o.lat!, lng: o.lng! })),
        rutaFin ? { lat: rutaFin.lat, lng: rutaFin.lng } : null
      ),
    [rutaInicio, ubicados, rutaFin]
  );

  // ── Efecto 1: decidir el motor (google → leaflet de respaldo) ──
  useEffect(() => {
    if (!apiKey) {
      setMotor('leaflet');
      return;
    }
    let vivo = true;
    cargarGoogleMaps(apiKey)
      .then(() => {
        if (vivo) setMotor('google');
      })
      .catch(() => {
        if (vivo) setMotor('leaflet');
      });
    return () => {
      vivo = false;
    };
  }, [apiKey]);

  // ── Efecto 2: crear el mapa GOOGLE ────────────────────────
  useEffect(() => {
    if (motor !== 'google') return;
    let cancelado = false;
    cargarGoogleMaps(apiKey)
      .then((gmaps: any) => {
        if (cancelado || !mapDivRef.current) return;
        gmapsRef.current = gmaps;
        HtmlMarkerRef.current = HtmlMarkerClass(gmaps);

        const map = new gmaps.Map(mapDivRef.current, {
          center: miPosicion
            ? { lat: miPosicion.lat, lng: miPosicion.lng }
            : { lat: LIMA_CENTRO.lat, lng: LIMA_CENTRO.lng },
          zoom: miPosicion ? 16 : 12,
          styles: estilosGoogleDe(getEstiloMapa()),
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          rotateControl: false,
          gestureHandling: 'greedy',
          clickableIcons: false,
          backgroundColor: '#0f172a',
        });
        mapRef.current = map;
        setMapaListo(true);
      })
      .catch(() => {
        // Google falló a mitad de camino → respaldo Leaflet
        if (!cancelado) setMotor('leaflet');
      });

    return () => {
      cancelado = true;
      // limpiar todo lo de Google
      if (flujoIntervalRef.current) {
        clearInterval(flujoIntervalRef.current);
        flujoIntervalRef.current = null;
      }
      for (const m of paradasMarkersRef.current.values()) m.setMap(null);
      paradasMarkersRef.current.clear();
      riderMarkerRef.current = null;
      inicioMarkerRef.current = null;
      finMarkerRef.current = null;
      if (rutaLineRef.current) { rutaLineRef.current.setMap(null); rutaLineRef.current = null; }
      if (flujoLineRef.current) { flujoLineRef.current.setMap(null); flujoLineRef.current = null; }
      mapRef.current = null;
      boundsKeyRef.current = '';
      setMapaListo(false);
      setRutaReal(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor]);

  // ── Efecto 3: skin del mapa (google + leaflet siguen al tema) ──
  useEffect(() => {
    // Escuchar cambio de tema en vivo (el toggle de la app avisa)
    const onTema = () => setEstilo(getEstiloMapa());
    window.addEventListener('rt_theme', onTema);
    return () => window.removeEventListener('rt_theme', onTema);
  }, []);

  useEffect(() => {
    if (motor === 'google' && mapRef.current && gmapsRef.current) {
      mapRef.current.setOptions({ styles: estilosGoogleDe(estilo) });
    }
    if (motor === 'leaflet' && mapLRef.current) {
      const map = mapLRef.current;
      if (tileRef.current) map.removeLayer(tileRef.current);
      const t = tilesDeEstilo(estilo);
      tileRef.current = L.tileLayer(t.url, {
        maxZoom: t.maxZoom,
        subdomains: (t.subdomains as string) || 'abc',
        attribution: t.attribution,
      }).addTo(map);
      tileRef.current.bringToBack();
    }
  }, [estilo, motor, mapaListo]);

  // ── Efecto 4: GPS en vivo + cálculo de velocidad/rumbo ────
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

  // ── Efecto 5 (GOOGLE): paradas + banderas + vista inicial ──
  useEffect(() => {
    if (motor !== 'google' || !mapaListo) return;
    const map = mapRef.current;
    const HtmlMarker = HtmlMarkerRef.current;
    if (!map || !HtmlMarker) return;

    // Limpiar anteriores
    for (const m of paradasMarkersRef.current.values()) m.setMap(null);
    paradasMarkersRef.current.clear();

    for (const o of ubicados) {
      const esSiguiente = !!siguienteParada && siguienteParada.id === o.id;
      const marker = new HtmlMarker({
        position: { lat: o.lat!, lng: o.lng! },
        html: htmlParadaGps(o, esSiguiente),
        interactivos: true,
        onClick: () =>
          onShowToast?.(
            `#${o.num ?? '·'} ${o.cliente}`,
            `${o.direccion || 'sin dirección'}${o.clienteTelefono ? ` · ${o.clienteTelefono}` : ''}`,
            'info'
          ),
      });
      marker.setMap(map);
      paradasMarkersRef.current.set(String(o.id), marker);
    }

    // 🏁 Banderas de inicio (verde) y fin (roja) — igual que el mapa de ruta
    if (rutaInicio) {
      const pos = { lat: rutaInicio.lat, lng: rutaInicio.lng };
      if (inicioMarkerRef.current) {
        inicioMarkerRef.current.setPosition(pos.lat, pos.lng);
      } else {
        const m = new HtmlMarker({ position: pos, html: htmlBanderaGps('#10b981'), interactivos: false });
        m.setMap(map);
        inicioMarkerRef.current = m;
      }
    } else if (inicioMarkerRef.current) {
      inicioMarkerRef.current.setMap(null);
      inicioMarkerRef.current = null;
    }
    if (rutaFin) {
      const pos = { lat: rutaFin.lat, lng: rutaFin.lng };
      if (finMarkerRef.current) {
        finMarkerRef.current.setPosition(pos.lat, pos.lng);
      } else {
        const m = new HtmlMarker({ position: pos, html: htmlBanderaGps('#f43f5e'), interactivos: false });
        m.setMap(map);
        finMarkerRef.current = m;
      }
    } else if (finMarkerRef.current) {
      finMarkerRef.current.setMap(null);
      finMarkerRef.current = null;
    }

    // Ajustar vista SOLO la primera vez (composición de la ruta)
    const claveVista = `${ubicados.length}-${!!rutaInicio}-${!!rutaFin}`;
    if (claveVista !== boundsKeyRef.current && ubicados.length > 0 && !miPosicion) {
      boundsKeyRef.current = claveVista;
      const gmaps = gmapsRef.current;
      const bounds = new gmaps.LatLngBounds();
      for (const o of ubicados) bounds.extend({ lat: o.lat!, lng: o.lng! });
      if (rutaInicio) bounds.extend({ lat: rutaInicio.lat, lng: rutaInicio.lng });
      if (rutaFin) bounds.extend({ lat: rutaFin.lat, lng: rutaFin.lng });
      map.fitBounds(bounds, 48);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor, mapaListo, ubicados, siguienteParada, rutaInicio, rutaFin, miPosicion]);

  // ── Efecto 6 (GOOGLE): motito en vivo + seguir ────────────
  useEffect(() => {
    if (motor !== 'google' || !mapaListo) return;
    const map = mapRef.current;
    const HtmlMarker = HtmlMarkerRef.current;
    if (!map || !HtmlMarker || !miPosicion) return;

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setPosition(miPosicion.lat, miPosicion.lng);
    } else {
      const m = new HtmlMarker({
        position: { lat: miPosicion.lat, lng: miPosicion.lng },
        html: htmlMotitoGps(rumbo),
        interactivos: false,
      });
      m.setMap(map);
      riderMarkerRef.current = m;
      map.setZoom(16);
    }

    if (seguir) {
      map.panTo({ lat: miPosicion.lat, lng: miPosicion.lng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor, mapaListo, miPosicion, seguir]);

  // ── Efecto 7 (GOOGLE): girar la flecha de rumbo ───────────
  useEffect(() => {
    if (motor !== 'google') return;
    if (riderMarkerRef.current && rumbo != null) {
      riderMarkerRef.current.setHtml(htmlMotitoGps(rumbo));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rumbo]);

  // ── Efecto 8 (GOOGLE): ruta REAL por calles + puntitos ────
  useEffect(() => {
    if (motor !== 'google' || !mapaListo) return;
    const map = mapRef.current;
    const gmaps = gmapsRef.current;
    if (!map || !gmaps) return;
    if (ubicados.length === 0) {
      setRutaReal(null);
      return;
    }

    let cancelado = false;
    setCargandoRuta(true);

    const inicio = rutaInicio ?? LIMA_CENTRO;
    const paradas = ubicados.map((o) => ({ lat: o.lat!, lng: o.lng! }));
    const fin = rutaFin ? { lat: rutaFin.lat, lng: rutaFin.lng } : null;

    obtenerRutaGoogle(inicio, paradas, fin)
      .then((ruta) => {
        if (cancelado || !mapRef.current || !gmapsRef.current) return;

        if (rutaLineRef.current) { rutaLineRef.current.setMap(null); rutaLineRef.current = null; }
        if (flujoLineRef.current) { flujoLineRef.current.setMap(null); flujoLineRef.current = null; }

        let puntos: Array<{ lat: number; lng: number }>;
        if (ruta && ruta.puntos.length > 1) {
          puntos = ruta.puntos;
          setRutaReal({ km: ruta.distanciaKm, min: ruta.tiempoMin });
        } else {
          puntos = [inicio, ...paradas];
          if (fin) puntos.push(fin);
          setRutaReal(null);
        }

        // Línea principal (la ruta por calles — igual que el mapa de ruta)
        rutaLineRef.current = new gmaps.Polyline({
          path: puntos,
          strokeColor: '#6366f1',
          strokeOpacity: 0.85,
          strokeWeight: 5,
          map: mapRef.current,
        });

        // Puntitos fluyendo encima (la animación "viva")
        flujoLineRef.current = new gmaps.Polyline({
          path: puntos,
          strokeOpacity: 0,
          icons: [{
            icon: {
              path: gmaps.SymbolPath.CIRCLE,
              scale: 3.5,
              fillColor: '#c7d2fe',
              fillOpacity: 0.95,
              strokeOpacity: 0,
            },
            offset: '0px',
            repeat: '52px',
          }],
          map: mapRef.current,
        });

        // Animación del flujo (igual: 2.2px cada 70ms)
        if (flujoIntervalRef.current) clearInterval(flujoIntervalRef.current);
        flujoIntervalRef.current = setInterval(() => {
          flujoOffsetRef.current = (flujoOffsetRef.current + 2.2) % 52;
          if (flujoLineRef.current) {
            const icons = flujoLineRef.current.get('icons');
            if (icons && icons[0]) {
              icons[0].offset = `${flujoOffsetRef.current.toFixed(1)}px`;
              flujoLineRef.current.set('icons', [...icons]);
            }
          }
        }, 70);
      })
      .finally(() => {
        if (!cancelado) setCargandoRuta(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor, mapaListo, firmaActual]);

  // ── Efecto 9 (LEAFLET respaldo): iniciar mapa ─────────────
  useEffect(() => {
    if (motor !== 'leaflet') return;
    if (!mapLeafletDivRef.current || mapLRef.current) return;
    const map = L.map(mapLeafletDivRef.current, {
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
    rutaLLineRef.current = L.polyline([], {
      color: '#6366f1',
      weight: 3,
      opacity: 0.45,
      dashArray: '5 8',
    }).addTo(map);
    mapLRef.current = map;

    return () => {
      map.remove();
      mapLRef.current = null;
      tileRef.current = null;
      riderLMarkerRef.current = null;
      capaRutaRef.current = null;
      rutaLLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor]);

  // ── Efecto 10 (LEAFLET): motito + seguir + ruta tenue ─────
  useEffect(() => {
    if (motor !== 'leaflet') return;
    const map = mapLRef.current;
    if (!map || !miPosicion) return;

    if (!riderLMarkerRef.current) {
      riderLMarkerRef.current = L.marker([miPosicion.lat, miPosicion.lng], {
        icon: iconoMotoGrande(rumbo),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      riderLMarkerRef.current.setLatLng([miPosicion.lat, miPosicion.lng]);
    }
    if (seguir) {
      map.panTo([miPosicion.lat, miPosicion.lng], { animate: true, duration: 0.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor, miPosicion, seguir]);

  useEffect(() => {
    if (motor !== 'leaflet') return;
    if (riderLMarkerRef.current && rumbo != null) {
      riderLMarkerRef.current.setIcon(iconoMotoGrande(rumbo));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rumbo]);

  useEffect(() => {
    if (motor !== 'leaflet') return;
    const capa = capaRutaRef.current;
    const linea = rutaLLineRef.current;
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
          `<b>#${o.num ?? '·'} ${esc(o.cliente)}</b><br><span style="font-size:11px">${esc(o.direccion)}</span>`,
          { direction: 'top' }
        )
        .addTo(capa);
    }
    if (ubicados.length > 1) {
      linea.setLatLngs(ubicados.map((o) => [o.lat!, o.lng!] as [number, number]));
    } else {
      linea.setLatLngs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor, ubicados, siguienteParada]);

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
    if (!miPosicion) return;
    setSeguir(true);
    if (motor === 'google' && mapRef.current) {
      mapRef.current.panTo({ lat: miPosicion.lat, lng: miPosicion.lng });
      mapRef.current.setZoom(16);
    } else if (motor === 'leaflet' && mapLRef.current) {
      mapLRef.current.setView([miPosicion.lat, miPosicion.lng], 16, { animate: true });
    }
  };

  const cambiarEstilo = () => {
    const orden: EstiloMapa[] = ['oscuro', 'claro', 'estandar'];
    const siguiente = orden[(orden.indexOf(estilo) + 1) % orden.length];
    setEstilo(siguiente);
    setEstiloMapa(siguiente);
  };
  const nombreEstilo = estilo === 'oscuro' ? 'Oscuro' : estilo === 'claro' ? 'Claro' : 'Estándar';

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
      {/* Animaciones de los marcadores (Google: rtgPing / Leaflet: rtGpsPing) */}
      <style>{`
        @keyframes rtgPing { 0% { transform: scale(1); opacity: 0.6 } 100% { transform: scale(2.6); opacity: 0 } }
        @keyframes rtGpsPing { 0% { transform: scale(0.7); opacity: 0.8 } 100% { transform: scale(2.2); opacity: 0 } }
        .rtgps-container { position: absolute; inset: 0; z-index: 0; background: #0f172a; }
        .rtgps-container .gm-style .gm-style-mtc, .rtgps-container .gm-svpc { display: none !important; }
        @media (max-width: 640px) { .rtgps-container { filter: saturate(1.05); } }
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
              {motor === 'google'
                ? 'Google Maps · misma visualización que tu ruta — por ahora tú; lista para crecer 🚀'
                : 'Ubicación en vivo de tu flota — por ahora tú; lista para crecer 🚀'}
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
              <div className="flex items-center gap-2 flex-wrap">
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

                {/* Ruta real por calles (como el mapa de ruta) */}
                {rutaReal && (
                  <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-bold tabular-nums">
                    <RouteIcon className="w-3.5 h-3.5" /> {rutaReal.km.toFixed(1)} km · {rutaReal.min} min
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Estilo del mapa (igual que el mapa de ruta) */}
                <button
                  onClick={cambiarEstilo}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                  title="Cambiar el estilo del mapa (oscuro / claro / estándar)"
                >
                  <Palette className="w-3.5 h-3.5" /> {nombreEstilo}
                </button>

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

            {/* El mapa: Google (igualito al de ruta) / Leaflet (respaldo) */}
            <div className="relative h-[380px] sm:h-[460px] isolate">
              {motor === 'cargando' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  <p className="text-xs text-slate-400 font-semibold">Preparando el mapa…</p>
                </div>
              )}
              {motor === 'google' && <div ref={mapDivRef} className="rtgps-container" />}

              {motor === 'leaflet' && <div ref={mapLeafletDivRef} className="absolute inset-0 z-0" />}

              {/* Trazando ruta por calles */}
              {motor === 'google' && cargandoRuta && ubicados.length > 0 && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 shadow-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span className="text-[11px] font-bold text-slate-200">Trazando ruta por calles…</span>
                </div>
              )}

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

        {/* ═══ COLUMNA DERECHA (1/3): RIDER ═══ */}
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
