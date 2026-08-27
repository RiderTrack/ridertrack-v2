// ═══════════════════════════════════════════════════════════
// 🗺️ GOOGLE LIVE MAP - RiderTrack V2 (Fase 2.0)
// El mapa de entregas sobre GOOGLE MAPS, con la visualización
// de la demo que le gustó al usuario — pero FUNCIONAL:
//
//   • Skin oscuro estilo noche (combina con la app)
//   • Ruta REAL por calles (Directions API): la línea sigue
//     las calles de verdad, con puntitos fluyendo (animación)
//   • 🛵 MOTITO ANIMADO: botón "▶ Recorrer ruta" — una moto
//     recorre la ruta real parada por parada, como GPS en vivo
//     (la visualización de la demo, ahora con TU ruta)
//   • Tu posición GPS real (el mismo motito, en vivo)
//   • Marcadores numerados por estado; la siguiente parada
//     pulsa; los "aprox." van punteados
//   • Banderas de INICIO (verde) y FIN (roja)
//   • Ficha del cliente al tocar un marcador (WhatsApp/Navegar)
//
// Todo dentro de un contenedor AISLADO (isolate) — el mapa
// nunca más tapa el menú hamburguesa (bug de la Fase 1.4).
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MapPin,
  Crosshair,
  Loader2,
  MessageSquare,
  RefreshCw,
  Route as RouteIcon,
  Flag,
  X,
  Play,
  Square,
  Bike,
} from 'lucide-react';
import { Order, NavigationTab } from '../types';
import { Coordenadas, vigilarPosicion } from '../services/geocoding';
import { distanciaRutaKm, LIMA_CENTRO, haversineKm } from '../services/routeOptimizer';
import { linkWhatsApp, ETIQUETAS_ESTADO } from '../utils/realData';
import { useConfig } from '../hooks/useConfig';
import { getEstiloMapa, EstiloMapa } from '../services/mapStyle';
import {
  cargarGoogleMaps,
  estilosGoogleDe,
  HtmlMarkerClass,
} from '../services/googleMaps';
import { obtenerRutaGoogle, firmaRuta } from '../services/googleDirections';
import { NavegarButton } from './NavegarButton';

interface GoogleLiveMapProps {
  orders: Order[];
  riderName?: string;
  onOpenWhatsApp?: (telefono: string, nombre: string) => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  apiKey: string;
}

/** Escapa texto para incrustarlo en HTML (seguridad) */
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

const SVG_BANDERA =
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ffffff" stroke-width="2.4" ` +
  `stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>` +
  `<line x1="4" y1="22" x2="4" y2="15"></line>` +
  `</svg>`;

/** HTML del marcador de una parada (mismo look que la versión Leaflet) */
function htmlParada(o: Order, esSiguiente: boolean): string {
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

/** HTML del motito del rider (posición GPS real / simulación) */
function htmlMotito(): string {
  return (
    `<div style="position:relative;width:38px;height:38px">` +
    `<span style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.35;animation:rtgPing 1.8s ease-out infinite"></span>` +
    `<div style="position:absolute;inset:3px;border-radius:50%;background:#2563eb;border:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center">` +
    SVG_MOTO +
    `</div>` +
    `</div>`
  );
}

function htmlBandera(color: string): string {
  return (
    `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #fff;` +
    `box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center">` +
    SVG_BANDERA +
    `</div>`
  );
}

/** Interpola un punto a una "distancia a lo largo de la ruta" */
function puntoEnRuta(
  puntos: Array<{ lat: number; lng: number }>,
  acumulada: number[],
  distObjetivo: number
): { lat: number; lng: number } {
  const total = acumulada[acumulada.length - 1] || 0;
  const d = Math.max(0, Math.min(distObjetivo, total));
  // búsqueda binaria del segmento
  let lo = 0;
  let hi = acumulada.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (acumulada[mid] <= d) lo = mid;
    else hi = mid;
  }
  const segIni = acumulada[lo];
  const segFin = acumulada[hi];
  const t = segFin > segIni ? (d - segIni) / (segFin - segIni) : 0;
  const a = puntos[lo];
  const b = puntos[hi];
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

export const GoogleLiveMap: React.FC<GoogleLiveMapProps> = ({
  orders,
  riderName,
  onOpenWhatsApp,
  onNavigateTab,
  apiKey,
}) => {
  // ── Config de ruta (inicio/fin) ───────────────────────────
  const { config } = useConfig();
  const rutaInicio = config?.ruta?.inicio ?? null;
  const rutaFin = config?.ruta?.fin ?? null;
  const volverAlInicio = !!config?.ruta?.volverAlInicio;

  // ── Estado ────────────────────────────────────────────────
  const [estilo, setEstilo] = useState<EstiloMapa>(() => getEstiloMapa());
  const [mapaListo, setMapaListo] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [gpsEstado, setGpsEstado] = useState<'buscando' | 'ok' | 'no'>('buscando');
  const [miPosicion, setMiPosicion] = useState<Coordenadas | null>(null);
  const [reintentosGPS, setReintentosGPS] = useState(0);
  const [seleccionado, setSeleccionado] = useState<Order | null>(null);
  const [rutaReal, setRutaReal] = useState<{ km: number; min: number } | null>(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [inicioEstable, setInicioEstable] = useState<{ lat: number; lng: number } | null>(null);

  // ── Refs ──────────────────────────────────────────────────
  const mapDivRef = useRef<HTMLDivElement>(null);
  const gmapsRef = useRef<any>(null);            // namespace google.maps
  const mapRef = useRef<any>(null);              // el mapa
  const HtmlMarkerRef = useRef<any>(null);       // clase de marcadores HTML
  const paradasMarkersRef = useRef<Map<string, any>>(new Map());
  const riderMarkerRef = useRef<any>(null);
  const inicioMarkerRef = useRef<any>(null);
  const finMarkerRef = useRef<any>(null);
  const rutaLineRef = useRef<any>(null);         // polyline principal
  const flujoLineRef = useRef<any>(null);        // polyline de puntitos animados
  const rutaPuntosRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const acumuladaRef = useRef<number[]>([]);
  const flujoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flujoOffsetRef = useRef(0);
  const simRafRef = useRef<number | null>(null);
  const simPausaRef = useRef(false);
  const boundsKeyRef = useRef('');
  const gpsPrimeroRef = useRef(false);
  const clickListenerRef = useRef<any>(null);

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

  /** Inicio ESTABLE para la geometría de ruta (no cambia con cada tick de GPS) */
  const inicioRuta = useMemo(
    () => (rutaInicio ? { lat: rutaInicio.lat, lng: rutaInicio.lng } : inicioEstable ?? LIMA_CENTRO),
    [rutaInicio, inicioEstable]
  );

  /** Firma de la ruta actual (caché de Directions: la misma ruta no se repite) */
  const firmaActual = useMemo(
    () =>
      firmaRuta(
        inicioRuta,
        ubicados.map((o) => ({ lat: o.lat!, lng: o.lng! })),
        rutaFin ? { lat: rutaFin.lat, lng: rutaFin.lng } : null
      ),
    [inicioRuta, ubicados, rutaFin]
  );

  const siguienteParada = useMemo(
    () =>
      orders
        .filter((o) => o.estado === 'pendiente')
        .sort((a, b) => (a.num ?? 999) - (b.num ?? 999))[0] || null,
    [orders]
  );

  /** Estimación de respaldo (línea recta ×1.35) si Google no dio ruta */
  const estimacionFallback = useMemo(() => {
    if (ubicados.length === 0) return { km: 0, min: 0 };
    const km = distanciaRutaKm(
      ubicados.map((o) => ({ lat: o.lat!, lng: o.lng! })),
      inicioRuta,
      { fin: rutaFin ? { lat: rutaFin.lat, lng: rutaFin.lng } : null, cerrarCiclo: !rutaFin && volverAlInicio }
    );
    return { km, min: Math.round((km / 22) * 60) };
  }, [ubicados, inicioRuta, rutaFin, volverAlInicio]);

  const estimacion = rutaReal ?? estimacionFallback;

  // ── Efecto 1: cargar Google Maps + crear el mapa ─────────
  useEffect(() => {
    let cancelado = false;
    cargarGoogleMaps(apiKey)
      .then((gmaps: any) => {
        if (cancelado || !mapDivRef.current) return;
        gmapsRef.current = gmaps;
        HtmlMarkerRef.current = HtmlMarkerClass(gmaps);

        const map = new gmaps.Map(mapDivRef.current, {
          center: { lat: LIMA_CENTRO.lat, lng: LIMA_CENTRO.lng },
          zoom: 12,
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

        // Tocar el mapa deselecciona la parada
        clickListenerRef.current = gmaps.event.addListener(map, 'click', () => {
          setSeleccionado(null);
        });

        setMapaListo(true);
      })
      .catch((e: any) => {
        if (!cancelado) setErrorCarga(String(e?.message || e));
      });

    return () => {
      cancelado = true;
      if (clickListenerRef.current && gmapsRef.current) {
        gmapsRef.current.event.removeListener(clickListenerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // ── Efecto 2: cambiar el skin (estilos) ──────────────────
  useEffect(() => {
    if (mapRef.current && gmapsRef.current) {
      mapRef.current.setOptions({ styles: estilosGoogleDe(estilo) });
    }
  }, [estilo, mapaListo]);

  // ── Efecto 3: GPS en vivo ────────────────────────────────
  useEffect(() => {
    setGpsEstado('buscando');
    const detener = vigilarPosicion(
      (c) => {
        setMiPosicion(c);
        setGpsEstado('ok');
        // Fijar el inicio de la ruta con la PRIMERA posición GPS
        // (para no re-pedir la ruta en cada movimiento)
        if (!gpsPrimeroRef.current && !rutaInicio) {
          gpsPrimeroRef.current = true;
          setInicioEstable({ lat: c.lat, lng: c.lng });
        }
      },
      () => setGpsEstado((prev) => (prev === 'ok' ? 'ok' : 'no'))
    );
    return detener;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reintentosGPS]);

  // ── Efecto 4: marcadores de paradas ──────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const HtmlMarker = HtmlMarkerRef.current;
    if (!mapaListo || !map || !HtmlMarker) return;

    // Limpiar anteriores
    for (const m of paradasMarkersRef.current.values()) m.setMap(null);
    paradasMarkersRef.current.clear();

    for (const o of ubicados) {
      const esSiguiente = !!siguienteParada && siguienteParada.id === o.id;
      const marker = new HtmlMarker({
        position: { lat: o.lat!, lng: o.lng! },
        html: htmlParada(o, esSiguiente),
        interactivos: true,
        onClick: () => setSeleccionado(o),
      });
      marker.setMap(map);
      paradasMarkersRef.current.set(String(o.id), marker);
    }

    // Ajustar vista SOLO cuando cambia la composición de la ruta
    const claveVista = `${ubicados.length}-${!!rutaInicio}-${!!rutaFin}`;
    if (claveVista !== boundsKeyRef.current && ubicados.length > 0) {
      boundsKeyRef.current = claveVista;
      const gmaps = gmapsRef.current;
      const bounds = new gmaps.LatLngBounds();
      for (const o of ubicados) bounds.extend({ lat: o.lat!, lng: o.lng! });
      if (rutaInicio) bounds.extend({ lat: rutaInicio.lat, lng: rutaInicio.lng });
      if (rutaFin) bounds.extend({ lat: rutaFin.lat, lng: rutaFin.lng });
      if (miPosicion) bounds.extend({ lat: miPosicion.lat, lng: miPosicion.lng });
      map.fitBounds(bounds, 48);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapaListo, ubicados, siguienteParada, rutaInicio, rutaFin]);

  // ── Efecto 5: motito (GPS) + banderas inicio/fin ─────────
  useEffect(() => {
    const map = mapRef.current;
    const HtmlMarker = HtmlMarkerRef.current;
    if (!mapaListo || !map || !HtmlMarker) return;

    // 🛵 Motito del rider — en vivo con GPS (o quieto si no hay)
    if (miPosicion && !simulando) {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setPosition(miPosicion.lat, miPosicion.lng);
      } else {
        const m = new HtmlMarker({
          position: { lat: miPosicion.lat, lng: miPosicion.lng },
          html: htmlMotito(),
          interactivos: false,
        });
        m.setMap(map);
        riderMarkerRef.current = m;
      }
    }

    // 🏁 Inicio (bandera verde)
    if (rutaInicio) {
      const pos = { lat: rutaInicio.lat, lng: rutaInicio.lng };
      if (inicioMarkerRef.current) {
        inicioMarkerRef.current.setPosition(pos.lat, pos.lng);
      } else {
        const m = new HtmlMarker({ position: pos, html: htmlBandera('#10b981'), interactivos: false });
        m.setMap(map);
        inicioMarkerRef.current = m;
      }
    } else if (inicioMarkerRef.current) {
      inicioMarkerRef.current.setMap(null);
      inicioMarkerRef.current = null;
    }

    // 🏁 Fin (bandera roja)
    if (rutaFin) {
      const pos = { lat: rutaFin.lat, lng: rutaFin.lng };
      if (finMarkerRef.current) {
        finMarkerRef.current.setPosition(pos.lat, pos.lng);
      } else {
        const m = new HtmlMarker({ position: pos, html: htmlBandera('#f43f5e'), interactivos: false });
        m.setMap(map);
        finMarkerRef.current = m;
      }
    } else if (finMarkerRef.current) {
      finMarkerRef.current.setMap(null);
      finMarkerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapaListo, miPosicion, rutaInicio, rutaFin, simulando]);

  // ── Efecto 6: geometría de ruta REAL (Directions API) ────
  useEffect(() => {
    if (!mapaListo) return;
    if (ubicados.length === 0) {
      rutaPuntosRef.current = [];
      setRutaReal(null);
      return;
    }

    let cancelado = false;
    setCargandoRuta(true);

    const inicio = inicioRuta;
    const paradas = ubicados.map((o) => ({ lat: o.lat!, lng: o.lng! }));
    const fin = rutaFin ? { lat: rutaFin.lat, lng: rutaFin.lng } : null;

    obtenerRutaGoogle(inicio, paradas, fin)
      .then((ruta) => {
        if (cancelado || !mapRef.current || !gmapsRef.current) return;
        const gmaps = gmapsRef.current;

        // Limpiar líneas anteriores
        if (rutaLineRef.current) { rutaLineRef.current.setMap(null); rutaLineRef.current = null; }
        if (flujoLineRef.current) { flujoLineRef.current.setMap(null); flujoLineRef.current = null; }

        let puntos: Array<{ lat: number; lng: number }>;

        if (ruta && ruta.puntos.length > 1) {
          // ✅ Ruta REAL por calles de Google
          puntos = ruta.puntos;
          setRutaReal({ km: ruta.distanciaKm, min: ruta.tiempoMin });
        } else {
          // ⚠️ Respaldo: línea recta entre paradas
          puntos = [inicio, ...paradas];
          if (fin) puntos.push(fin);
          setRutaReal(null);
        }

        rutaPuntosRef.current = puntos;
        // distancias acumuladas (para la simulación del motito)
        const acum: number[] = [0];
        for (let i = 1; i < puntos.length; i++) {
          acum.push(acum[i - 1] + haversineKm(puntos[i - 1], puntos[i]));
        }
        acumuladaRef.current = acum;

        // Línea principal (la ruta por calles)
        rutaLineRef.current = new gmaps.Polyline({
          path: puntos,
          strokeColor: '#6366f1',
          strokeOpacity: 0.85,
          strokeWeight: 5,
          map: mapRef.current,
        });

        // Puntitos fluyendo encima (la animación "viva" de la demo)
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
      })
      .finally(() => {
        if (!cancelado) setCargandoRuta(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapaListo, firmaActual]);

  // ── Efecto 7: animación de los puntitos (flujo) ──────────
  useEffect(() => {
    if (!mapaListo) return;
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
    return () => {
      if (flujoIntervalRef.current) clearInterval(flujoIntervalRef.current);
    };
  }, [mapaListo, firmaActual]);

  // ── Simulación: el motito recorriendo la ruta (¡la demo!) ─
  const detenerSimulacion = useCallback(() => {
    if (simRafRef.current != null) cancelAnimationFrame(simRafRef.current);
    simRafRef.current = null;
    simPausaRef.current = false;
    setSimulando(false);
    // El motito vuelve a su posición GPS real
    if (riderMarkerRef.current && miPosicion) {
      riderMarkerRef.current.setPosition(miPosicion.lat, miPosicion.lng);
    }
  }, [miPosicion]);

  const iniciarSimulacion = useCallback(() => {
    const puntos = rutaPuntosRef.current;
    const acum = acumuladaRef.current;
    if (puntos.length < 2 || !mapRef.current || !HtmlMarkerRef.current) return;

    const gmaps = gmapsRef.current;
    const map = mapRef.current;
    setSimulando(true);
    setSeleccionado(null);

    const totalKm = acum[acum.length - 1] || 0;
    if (totalKm <= 0) { setSimulando(false); return; }

    // Duración: ~2.2 s por km, entre 15 y 55 s (recorrido "GPS")
    const duracionMs = Math.max(15000, Math.min(55000, totalKm * 2200));

    // Crear el motito de la simulación (si no existe ya por GPS)
    if (!riderMarkerRef.current) {
      const m = new HtmlMarkerRef.current({
        position: puntos[0],
        html: htmlMotito(),
        interactivos: false,
      });
      m.setMap(map);
      riderMarkerRef.current = m;
    }

    // Distancias de las paradas a lo largo de la ruta (para pausar)
    const paradasDist = ubicados
      .map((o) => {
        // índice del punto de ruta más cercano a la parada
        let mejorIdx = 0;
        let mejorD = Infinity;
        for (let i = 0; i < puntos.length; i++) {
          const d = haversineKm({ lat: o.lat!, lng: o.lng! }, puntos[i]);
          if (d < mejorD) { mejorD = d; mejorIdx = i; }
        }
        return acum[mejorIdx];
      })
      .sort((a, b) => a - b);

    const t0 = performance.now();
    let pausas = 0;
    const PAUSA_MS = 650;

    const paso = (ahora: number) => {
      if (!riderMarkerRef.current) return;
      const transcurrido = ahora - t0 - pausas * PAUSA_MS;
      const progreso = Math.min(1, Math.max(0, transcurrido / duracionMs));
      const distObjetivo = progreso * totalKm;

      // ¿Pasamos por una parada? → pausa breve (como entregando)
      if (pausas < paradasDist.length && distObjetivo >= paradasDist[pausas]) {
        pausas++;
        simPausaRef.current = true;
        const pos = puntoEnRuta(puntos, acum, paradasDist[pausas - 1]);
        riderMarkerRef.current.setPosition(pos.lat, pos.lng);
        // seguir tras la pausa
        simRafRef.current = requestAnimationFrame((t2) => {
          setTimeout(() => {
            simPausaRef.current = false;
            simRafRef.current = requestAnimationFrame(paso);
          }, PAUSA_MS);
        });
        return;
      }

      const pos = puntoEnRuta(puntos, acum, distObjetivo);
      riderMarkerRef.current.setPosition(pos.lat, pos.lng);

      // la cámara sigue al motito (como un GPS de verdad)
      if (progreso > 0.01) map.panTo(pos);

      if (progreso < 1) {
        simRafRef.current = requestAnimationFrame(paso);
      } else {
        // fin del recorrido
        detenerSimulacion();
      }
    };

    simRafRef.current = requestAnimationFrame(paso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicados, detenerSimulacion, simulando]);

  // Detener simulación al desmontar
  useEffect(() => {
    return () => {
      if (simRafRef.current != null) cancelAnimationFrame(simRafRef.current);
    };
  }, []);

  // ── Acciones ──────────────────────────────────────────────
  const centrarEnMi = () => {
    if (miPosicion && mapRef.current) {
      mapRef.current.panTo({ lat: miPosicion.lat, lng: miPosicion.lng });
      mapRef.current.setZoom(16);
    }
  };

  const cambiarEstilo = () => {
    const orden: EstiloMapa[] = ['oscuro', 'claro', 'estandar'];
    const siguiente = orden[(orden.indexOf(estilo) + 1) % orden.length];
    setEstilo(siguiente);
    import('../services/mapStyle').then(({ setEstiloMapa }) => setEstiloMapa(siguiente));
  };

  const nombreEstilo = estilo === 'oscuro' ? 'Oscuro' : estilo === 'claro' ? 'Claro' : 'Estándar';

  const puedeSimular =
    ubicados.length >= 2 && rutaPuntosRef.current.length > 1 && !cargandoRuta && mapaListo;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="relative rounded-2xl bg-slate-800 dark:bg-slate-800 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-200 overflow-hidden shadow-xl flex flex-col isolate">
      {/* Animaciones y ajustes visuales sobre Google Maps */}
      <style>{`
        @keyframes rtgPing { 0% { transform: scale(1); opacity: 0.6 } 100% { transform: scale(2.6); opacity: 0 } }
        .rtgmap-container { position: absolute; inset: 0; z-index: 0; background: #0f172a; }
        .rtgmap-container .gm-style .gm-style-mtc, .rtgmap-container .gm-svpc { display: none !important; }
        @media (max-width: 640px) { .rtgmap-container { filter: saturate(1.05); } }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 px-5 bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-100 border-b border-slate-700/70 dark:border-slate-700/70 light:border-slate-200 z-10">
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

          <button
            onClick={cambiarEstilo}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
            title="Cambiar el estilo del mapa (oscuro / claro / estándar)"
          >
            🎨 {nombreEstilo}
          </button>

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

      {/* Mapa Google — SIEMPRE visible */}
      <div className="relative h-[420px] sm:h-[520px]">
        {/* Contenedor del mapa (z-0, aislado dentro del componente) */}
        <div ref={mapDivRef} className="rtgmap-container" />

        {/* Estado de carga del mapa */}
        {!mapaListo && !errorCarga && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-xs text-slate-300 font-semibold">Cargando Google Maps…</p>
          </div>
        )}

        {/* Error de carga (no debería pasar — el wrapper ya cayó a Leaflet) */}
        {errorCarga && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/90 gap-2 px-6 text-center">
            <p className="text-sm font-bold text-red-400">No se pudo cargar Google Maps</p>
            <p className="text-[11px] text-slate-400">{errorCarga}</p>
          </div>
        )}

        {/* Cargando ruta real */}
        {mapaListo && cargandoRuta && ubicados.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 shadow-lg">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span className="text-[11px] font-bold text-slate-200">Trazando ruta por calles…</span>
          </div>
        )}

        {/* Botón Recorrer ruta (¡la simulación de la demo!) */}
        {puedeSimular && (
          <button
            onClick={simulando ? detenerSimulacion : iniciarSimulacion}
            className={`absolute bottom-16 right-3 z-10 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border shadow-lg text-xs font-bold transition-all active:scale-95 ${
              simulando
                ? 'bg-red-600 hover:bg-red-500 border-red-400 text-white'
                : 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white'
            }`}
            title={
              simulando
                ? 'Detener el recorrido'
                : 'Ver el motito recorriendo la ruta completa, parada por parada'
            }
          >
            {simulando ? (
              <>
                <Square className="w-3.5 h-3.5" /> Detener
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Recorrer ruta
              </>
            )}
          </button>
        )}

        {/* Botón centrar en mi posición */}
        <button
          onClick={centrarEnMi}
          disabled={!miPosicion}
          className="absolute bottom-4 right-3 z-10 p-2.5 rounded-xl bg-slate-900/90 text-white hover:bg-slate-800 border border-slate-700 shadow-lg disabled:opacity-40 transition-all"
          title="Centrar mapa en mi posición"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Leyenda */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 px-2.5 py-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-[10px] font-bold text-slate-300">
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

        {/* Ficha del cliente seleccionado (al tocar un marcador) */}
        {seleccionado && (
          <div className="absolute bottom-4 left-3 right-16 z-10 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-blue-500/40 shadow-2xl">
            <button
              onClick={() => setSeleccionado(null)}
              className="absolute top-2 right-2 p-1 rounded-lg hover:bg-slate-800 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="pr-6">
              <p className="text-xs font-bold text-white truncate">
                #{seleccionado.num ?? '·'} {seleccionado.cliente}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {seleccionado.direccion}
                {seleccionado.distrito ? `, ${seleccionado.distrito}` : ''}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-300">
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold">
                  {esc(ETIQUETAS_ESTADO[seleccionado.stReal || ''] || seleccionado.estado)}
                </span>
                <span>S/ {(seleccionado.monto || 0).toFixed(2)}</span>
                {seleccionado.hora && <span>· {seleccionado.hora}</span>}
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              {seleccionado.clienteTelefono && onOpenWhatsApp && (
                <button
                  onClick={() =>
                    onOpenWhatsApp(seleccionado.clienteTelefono, seleccionado.cliente)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all active:scale-95"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                </button>
              )}
              {seleccionado.lat != null && seleccionado.lng != null && (
                <NavegarButton lat={seleccionado.lat} lng={seleccionado.lng} />
              )}
              {seleccionado.clienteTelefono && (
                <a
                  href={linkWhatsApp(
                    seleccionado.clienteTelefono,
                    `Hola ${seleccionado.cliente} 👋 Te escribo desde ${
                      riderName || 'RiderTrack'
                    } por tu entrega de hoy.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold transition-all active:scale-95"
                >
                  💬 Directo
                </a>
              )}
            </div>
          </div>
        )}

        {/* Banner compacto: ruta vacía */}
        {orders.length === 0 && (
          <div className="absolute bottom-4 left-3 right-16 z-10 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl flex items-center gap-3">
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

        {/* Banner compacto: clientes sin ubicación */}
        {orders.length > 0 && sinUbicar > 0 && (
          <div className="absolute bottom-4 left-3 right-16 z-10 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-amber-500/40 shadow-2xl flex items-center gap-3">
            <RouteIcon className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">
                {sinUbicar === 1 ? '1 cliente aún' : `${sinUbicar} clientes aún`} sin ubicación
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

      {/* Barra inferior: siguiente parada + estimación real */}
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
          {ubicados.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[11px] font-bold">
              <RouteIcon className="w-3.5 h-3.5" />
              ~{estimacion.km} km · {estimacion.min} min
              {rutaReal && <span className="text-emerald-400">· calles reales</span>}
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
            <NavegarButton lat={siguienteParada.lat} lng={siguienteParada.lng} size="md" />
          )}
        </div>
      </div>

      {/* Motín indicador cuando el recorrido está en marcha */}
      {simulando && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-2 rounded-full bg-blue-600/95 border border-blue-300/40 shadow-2xl">
          <Bike className="w-4 h-4 text-white animate-pulse" />
          <span className="text-[11px] font-bold text-white">
            Recorriendo la ruta… ({ubicados.length} paradas)
          </span>
        </div>
      )}
    </div>
  );
};
