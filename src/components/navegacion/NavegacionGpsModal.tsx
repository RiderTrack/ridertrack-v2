// ═══════════════════════════════════════════════════════════
// 🧭 NAVEGACIÓN GPS CON VOZ (MODAL) - RiderTrack V2 (Fase 3.12)
// La navegación propia de RiderTrack, adentro de la app:
//
//   • Mapa Leaflet a PANTALLA COMPLETA con la ruta de Google
//     (fondo gris atrás tuyo, azul lo que falta)
//   • FLECHITA azul que rota con tu rumbo real (GPS)
//   • CARTEL de maniobra arriba: ícono + distancia + "Gira a
//     la izquierda hacia Av. Arequipa" (+ "Luego: …")
//   • VOZ EN ESPAÑOL que anuncia cada giro (TTS nativo)
//   • RECALCULA sola si te desvías ("Ruta recalculada")
//   • Detecta la LLEGADA a cada parada y pasa a la siguiente
//   • Escape: botones Waze / Google Maps por si quieres salir
//
// El motor (voz, proyección, desvíos) vive en
// services/navegacionGps.ts — puro y testeado.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  X,
  Volume2,
  VolumeX,
  LocateFixed,
  Loader2,
  ChevronRight,
  Flag,
  AlertTriangle,
  RotateCw,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  RotateCcw,
  Undo2,
  GitMerge,
  Ship,
} from 'lucide-react';
import { obtenerPosicionActual, vigilarPosicion, Coordenadas } from '../../services/geocoding';
import { getEstiloMapa, tilesDeEstilo, EstiloMapa } from '../../services/mapStyle';
import { obtenerInstruccionesGoogle, RutaInstrucciones } from '../../services/googleDirections';
import { urlNavegacionGoogle, urlNavegacionWaze } from '../../services/navegacion';
import {
  ParadaNav,
  Punto,
  UMBRAL_LLEGADA_M,
  formatearDistancia,
  iconoManiobra,
  esPasoDestino,
  proximoPaso,
  proyectarSobreRuta,
  rumbo,
  rumboSuavizado,
  distanciaMetros,
  MotorVoz,
  DetectorFueraRuta,
  elegirVozEspanol,
  vozHabilitada,
  setVozHabilitada,
  hablar,
  detenerVoz,
  construirRutaRecta,
  fraseInicio,
  fraseLlegada,
  fraseFueraRuta,
  fraseRecalculada,
  fraseSiguiente,
  fraseFin,
  IconoManiobra,
} from '../../services/navegacionGps';

interface NavegacionGpsModalProps {
  /** Paradas pendientes ORDENADAS por nº de ruta */
  paradas: ParadaNav[];
  onClose: () => void;
  onShowToast?: (titulo: string, msg: string, tipo?: 'success' | 'error' | 'info' | 'warning') => void;
}

type FaseNav = 'preparando' | 'navegando' | 'recalculando' | 'llegada' | 'fin' | 'error';

/** Ícono del cartel según la maniobra (con rotaciones extra para giros cerrados) */
const ICONOS_MANIOBRA: Record<IconoManiobra, React.ComponentType<{ className?: string }>> = {
  recto: ArrowUp,
  izquierda: CornerUpLeft,
  derecha: CornerUpRight,
  'leve-izq': ArrowUpLeft,
  'leve-der': ArrowUpRight,
  'cerrada-izq': (p) => <CornerUpLeft {...p} className={`${p.className ?? ''} -rotate-45`} />,
  'cerrada-der': (p) => <CornerUpRight {...p} className={`${p.className ?? ''} rotate-45`} />,
  uturn: Undo2,
  'rotonda-izq': RotateCcw,
  'rotonda-der': RotateCw,
  'rampa-izq': ArrowUpLeft,
  'rampa-der': ArrowUpRight,
  'mantente-izq': ArrowUpLeft,
  'mantente-der': ArrowUpRight,
  'bifurcacion-izq': ArrowUpLeft,
  'bifurcacion-der': ArrowUpRight,
  merge: GitMerge,
  ferry: Ship,
  destino: Flag,
};

/** Flechita del rider que rota con el rumbo (norte = arriba) */
function iconoFlecha(heading: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      `<div style="position:relative;width:46px;height:46px">` +
      `<span style="position:absolute;inset:0;border-radius:50%;background:#2563eb;opacity:.3;animation:rtNavPing 1.8s ease-out infinite"></span>` +
      `<div style="position:absolute;inset:4px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border:3px solid #ffffff;box-shadow:0 3px 14px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center">` +
      `<svg viewBox="0 0 24 24" width="22" height="22" style="transform:rotate(${heading.toFixed(0)}deg);transition:transform .35s" fill="#ffffff" stroke="none">` +
      `<path d="M12 2.6 L18.4 19.4 L12 15.8 L5.6 19.4 Z"></path>` +
      `</svg>` +
      `</div>` +
      `</div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

/** Pin de la parada destino (gota ámbar con su número) */
function iconoParada(num: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      `<div style="position:relative;width:38px;height:38px">` +
      `<span style="position:absolute;inset:-6px;border-radius:50%;background:#f59e0b;opacity:.35;animation:rtNavPing 1.8s ease-out infinite"></span>` +
      `<div style="position:absolute;inset:0;width:38px;height:38px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#f59e0b;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.55)"></div>` +
      `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:13px;font-family:system-ui">${num}</div>` +
      `</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
  });
}

/** Capa de tiles según el estilo (mismo respaldo del mapa en vivo) */
function capaTiles(map: L.Map, estilo: EstiloMapa): L.LayerGroup {
  const t = tilesDeEstilo(estilo);
  const grupo = L.layerGroup();
  // maxNativeZoom: ESRI (oscuro/claro) solo tiene tiles hasta z16 —
  // arriba de eso Leaflet ESCALA los z16 en vez de pedir z17+ (que
  // ESRI responde con el feo placeholder "Map data not yet available").
  const opts: L.TileLayerOptions = {
    maxZoom: 19,
    maxNativeZoom: t.maxZoom,
    subdomains: (t.subdomains as string) || 'abc',
    attribution: t.attribution,
  };
  L.tileLayer(t.url, opts).addTo(grupo);
  if (t.refUrl) {
    L.tileLayer(t.refUrl, { ...opts, attribution: '' }).addTo(grupo);
  }
  grupo.addTo(map);
  return grupo;
}

export const NavegacionGpsModal: React.FC<NavegacionGpsModalProps> = ({
  paradas,
  onClose,
  onShowToast,
}) => {
  // ── Estado visible ────────────────────────────────────────
  const [fase, setFase] = useState<FaseNav>('preparando');
  const [msg, setMsg] = useState('Buscando tu posición GPS…');
  const [idxParada, setIdxParada] = useState(0);
  const [maniobraActual, setManiobraActual] = useState<{
    instruccion: string;
    maniobra: string | null;
    distanciaM: number;
  } | null>(null);
  const [luego, setLuego] = useState<string | null>(null);
  const [restanteM, setRestanteM] = useState<number | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [voz, setVoz] = useState(() => vozHabilitada());
  const [siguiendo, setSiguiendo] = useState(true);
  const [modoRecta, setModoRecta] = useState(false);
  const [gpsPerdido, setGpsPerdido] = useState(false);

  // ── Refs (la navegación vive fuera del render) ───────────
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.LayerGroup | null>(null);
  const casingRef = useRef<L.Polyline | null>(null);
  const baseRef = useRef<L.Polyline | null>(null);
  const glowRef = useRef<L.Polyline | null>(null);
  const restoRef = useRef<L.Polyline | null>(null);
  const flechaRef = useRef<L.Marker | null>(null);
  const paradaMarkerRef = useRef<L.Marker | null>(null);

  const rutaRef = useRef<RutaInstrucciones | null>(null);
  const totalRutaMRef = useRef(0);
  const idxProyRef = useRef(0);
  const posPrevRef = useRef<Punto | null>(null);
  const rumboRef = useRef<number | null>(null);
  const faseRef = useRef<FaseNav>('preparando');
  const paradaIdxRef = useRef(0);
  const siguiendoRef = useRef(true);
  const vozRef = useRef(vozHabilitada());
  const motorVozRef = useRef(new MotorVoz(!vozHabilitada()));
  const detectorRef = useRef(new DetectorFueraRuta());
  const detenerWatchRef = useRef<(() => void) | null>(null);
  const recalculandoRef = useRef(false);
  const vivoRef = useRef(true);

  const parada = paradas.length > 0 ? paradas[Math.min(idxParada, paradas.length - 1)] : undefined;

  const setFaseNav = (f: FaseNav) => {
    faseRef.current = f;
    setFase(f);
  };

  const decir = (texto: string | null | undefined, interrumpir = false) => {
    if (!texto || !vozRef.current) return;
    hablar(texto, interrumpir);
  };

  // ── Dibujo de la ruta (4 capas: borde, base gris, brillo, resto azul) ──
  const dibujarRuta = (ruta: RutaInstrucciones) => {
    const map = mapRef.current;
    if (!map) return;
    const pts = ruta.puntos.map((p) => [p.lat, p.lng] as [number, number]);

    casingRef.current?.setLatLngs(pts);
    baseRef.current?.setLatLngs(pts);
    glowRef.current?.setLatLngs(pts);
    restoRef.current?.setLatLngs(pts);

    // Largo total para el ETA proporcional
    let total = 0;
    for (let i = 1; i < ruta.puntos.length; i++) {
      total += distanciaMetros(ruta.puntos[i - 1], ruta.puntos[i]);
    }
    totalRutaMRef.current = total;
  };

  /** Actualiza solo el tramo AZUL (lo que falta) desde la proyección */
  const pintarResto = (desde: Punto, idx: number) => {
    const ruta = rutaRef.current;
    if (!ruta) return;
    const pts: [number, number][] = [[desde.lat, desde.lng]];
    for (let i = idx + 1; i < ruta.puntos.length; i++) {
      pts.push([ruta.puntos[i].lat, ruta.puntos[i].lng]);
    }
    restoRef.current?.setLatLngs(pts);
    glowRef.current?.setLatLngs(pts);
  };

  const dibujarParada = (p: ParadaNav) => {
    const map = mapRef.current;
    if (!map) return;
    if (paradaMarkerRef.current) {
      map.removeLayer(paradaMarkerRef.current);
    }
    paradaMarkerRef.current = L.marker([p.lat, p.lng], { icon: iconoParada(p.num), zIndexOffset: 800 })
      .bindTooltip(`Parada ${p.num}: ${p.nombre}`, {
        className: 'rtnav-tooltip',
        direction: 'top',
        offset: [0, -34],
      })
      .addTo(map);
  };

  // ── Refresca el cartel + voz con la proyección actual ────
  const actualizarCartel = (avanzadoM: number, restanteMetros: number) => {
    const ruta = rutaRef.current;
    if (!ruta) return;
    const pp = proximoPaso(ruta, avanzadoM);
    if (pp) {
      setManiobraActual({
        instruccion: pp.paso.instruccion,
        maniobra: pp.paso.maniobra,
        distanciaM: pp.distanciaM,
      });
      setLuego(ruta.pasos[pp.idx + 1]?.instruccion ?? null);
      const frase = motorVozRef.current.evaluar(pp.idx, pp.paso.instruccion, pp.distanciaM);
      if (frase) decir(frase, pp.distanciaM <= 25);
    }
    setRestanteM(restanteMetros);
    const total = totalRutaMRef.current;
    const proporcion = total > 0 ? restanteMetros / total : 0;
    const eta = ruta.tiempoMin * proporcion;
    setEtaMin(eta >= 1 ? Math.round(eta) : restanteMetros > 60 ? 1 : null);
  };

  // ── RECALCULAR (desviado): nueva ruta desde donde estás ──
  const recalcular = async (desde: Punto) => {
    const ruta = rutaRef.current;
    if (recalculandoRef.current || !ruta) return;
    recalculandoRef.current = true;
    const paradaActual = paradas[paradaIdxRef.current];
    if (!paradaActual) {
      recalculandoRef.current = false;
      return;
    }
    setFaseNav('recalculando');
    decir(fraseFueraRuta(), true);
    motorVozRef.current.reiniciar();
    detectorRef.current.reset();

    try {
      const obtenida = await obtenerInstruccionesGoogle(desde, paradaActual);
      if (!vivoRef.current) return;
      const nueva = obtenida ?? construirRutaRecta(desde, paradaActual);
      setModoRecta(!obtenida);

      rutaRef.current = nueva;
      idxProyRef.current = 0;
      dibujarRuta(nueva);
      dibujarParada(paradaActual);

      const proy = proyectarSobreRuta(desde, nueva.puntos, 0);
      if (proy) {
        idxProyRef.current = proy.idx;
        pintarResto(proy.punto, proy.idx);
        actualizarCartel(proy.avanzadoMetros, proy.restanteMetros);
      }
      decir(fraseRecalculada());
      if (faseRef.current === 'recalculando') setFaseNav('navegando');
    } finally {
      recalculandoRef.current = false;
    }
  };

  // ── Tick del GPS: flechita, cartel, llegada y desvío ────
  const alPosicion = (c: Coordenadas) => {
    const map = mapRef.current;
    const ruta = rutaRef.current;
    const paradaActual = paradas[paradaIdxRef.current];
    if (!map || !ruta || !paradaActual) return;

    setGpsPerdido(false);
    const pos: Punto = { lat: c.lat, lng: c.lng };

    // Rumbo por defecto: hacia un punto de la ruta más adelante
    let porDefecto = rumboRef.current ?? 0;
    const idxAdelante = Math.min(ruta.puntos.length - 1, idxProyRef.current + 4);
    if (idxAdelante > idxProyRef.current) {
      porDefecto = rumbo(pos, ruta.puntos[idxAdelante]);
    } else {
      porDefecto = rumbo(pos, { lat: paradaActual.lat, lng: paradaActual.lng });
    }
    rumboRef.current = rumboSuavizado(posPrevRef.current, pos, rumboRef.current, porDefecto);
    posPrevRef.current = pos;

    // Flechita
    if (flechaRef.current) {
      flechaRef.current.setLatLng([pos.lat, pos.lng]);
      flechaRef.current.setIcon(iconoFlecha(rumboRef.current));
    } else {
      flechaRef.current = L.marker([pos.lat, pos.lng], {
        icon: iconoFlecha(rumboRef.current),
        zIndexOffset: 1000,
      }).addTo(map);
    }

    // Cámara siguiéndote
    if (siguiendoRef.current) {
      map.setView([pos.lat, pos.lng], Math.max(map.getZoom() || 16, 16), { animate: true });
    }

    // Proyección sobre la ruta → cartel + resto azul
    const proy = proyectarSobreRuta(pos, ruta.puntos, idxProyRef.current);
    if (proy) {
      idxProyRef.current = proy.idx;
      pintarResto(proy.punto, proy.idx);
      if (faseRef.current === 'navegando') {
        actualizarCartel(proy.avanzadoMetros, proy.restanteMetros);
      }
    }

    if (faseRef.current !== 'navegando' && faseRef.current !== 'recalculando') return;

    // ¿Llegaste a la parada? (línea recta: más fiable que la ruta)
    const distParada = distanciaMetros(pos, { lat: paradaActual.lat, lng: paradaActual.lng });
    if (distParada <= UMBRAL_LLEGADA_M) {
      setFaseNav('llegada');
      motorVozRef.current.silenciar();
      decir(fraseLlegada(paradaActual.nombre, paradaActual.num), true);
      map.setView([paradaActual.lat, paradaActual.lng], 17, { animate: true });
      onShowToast?.('🎉 ¡Llegaste!', `Parada ${paradaActual.num}: ${paradaActual.nombre}`, 'success');
      return;
    }

    // ¿Desviado? → recalcular
    if (detectorRef.current.reportar(proy?.distMetros ?? null)) {
      recalcular(pos);
    }
  };

  // ── Arrancar un tramo (parada i): GPS + ruta + voz inicial ──
  const arrancarTramo = async (i: number, desdePos?: Punto) => {
    if (!vivoRef.current || paradas.length === 0) return;
    paradaIdxRef.current = i;
    setIdxParada(i);
    setFaseNav('preparando');
    setMsg(desdePos ? 'Calculando la mejor ruta…' : 'Buscando tu posición GPS…');
    setManiobraActual(null);
    setLuego(null);
    setRestanteM(null);
    setEtaMin(null);
    motorVozRef.current.reiniciar();
    detectorRef.current.reset();

    const paradaDestino = paradas[i];

    let pos = desdePos ?? null;
    if (!pos) {
      setMsg('Buscando tu posición GPS…');
      pos = (await obtenerPosicionActual(9000)) as Punto | null;
    }
    if (!vivoRef.current) return;
    if (!pos) {
      setMsg('No se pudo obtener tu ubicación. Revisa que el GPS esté activo y que RiderTrack tenga permiso de ubicación.');
      setFaseNav('error');
      return;
    }

    setMsg('Calculando la mejor ruta…');
    let ruta: RutaInstrucciones | null = null;
    try {
      ruta = await obtenerInstruccionesGoogle(pos, paradaDestino);
    } catch {
      ruta = null;
    }
    if (!vivoRef.current) return;
    const esRecta = !ruta;
    if (!ruta) ruta = construirRutaRecta(pos, paradaDestino);

    rutaRef.current = ruta;
    idxProyRef.current = 0;
    posPrevRef.current = null;
    rumboRef.current = null;
    setModoRecta(esRecta);

    dibujarRuta(ruta);
    dibujarParada(paradaDestino);

    // Flechita inicial + cámara siguiendo
    const map = mapRef.current;
    if (map) {
      if (flechaRef.current) {
        map.removeLayer(flechaRef.current);
        flechaRef.current = null;
      }
      flechaRef.current = L.marker([pos.lat, pos.lng], { icon: iconoFlecha(0), zIndexOffset: 1000 }).addTo(map);
      siguiendoRef.current = true;
      setSiguiendo(true);
      map.setView([pos.lat, pos.lng], 16, { animate: false });
    }

    decir(fraseInicio(paradaDestino.nombre, ruta.distanciaKm * 1000), true);
    setFaseNav('navegando');

    // Empezar a vigilar el GPS (una sola vez en toda la navegación)
    if (!detenerWatchRef.current) {
      detenerWatchRef.current = vigilarPosicion(alPosicion, () => setGpsPerdido(true));
    }
  };

  // ── Inicializar mapa + arrancar (una sola vez) ───────────
  useEffect(() => {
    vivoRef.current = true;

    // Precargar las voces del sintetizador (el WebView las registra tarde)
    try {
      elegirVozEspanol();
      window.speechSynthesis?.getVoices?.();
    } catch {}

    if (mapDivRef.current && !mapRef.current) {
      const map = L.map(mapDivRef.current, {
        center: [-12.046, -77.043],
        zoom: 13,
        zoomControl: false,
        attributionControl: true,
      });
      mapRef.current = map;
      tileRef.current = capaTiles(map, getEstiloMapa());

      casingRef.current = L.polyline([], { color: '#020617', weight: 11, opacity: 0.95 }).addTo(map);
      baseRef.current = L.polyline([], { color: '#64748b', weight: 6, opacity: 0.95 }).addTo(map);
      glowRef.current = L.polyline([], { color: '#3b82f6', weight: 15, opacity: 0.22 }).addTo(map);
      restoRef.current = L.polyline([], { color: '#3b82f6', weight: 6, opacity: 1, lineCap: 'round' }).addTo(map);

      map.on('dragstart', () => {
        siguiendoRef.current = false;
        setSiguiendo(false);
      });
    }

    if (paradas.length === 0) {
      setFaseNav('fin');
    } else {
      arrancarTramo(0);
    }

    return () => {
      vivoRef.current = false;
      detenerWatchRef.current?.();
      detenerWatchRef.current = null;
      detenerVoz();
      try {
        mapRef.current?.remove();
      } catch {}
      mapRef.current = null;
      flechaRef.current = null;
      paradaMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Botones ───────────────────────────────────────────────
  const alternarVoz = () => {
    const nueva = !voz;
    vozRef.current = nueva;
    setVoz(nueva);
    setVozHabilitada(nueva);
    motorVozRef.current.setMudo(!nueva);
    if (nueva) hablar('Voz activada.', false);
  };

  const centrar = () => {
    siguiendoRef.current = true;
    setSiguiendo(true);
    const p = posPrevRef.current;
    if (p && mapRef.current) {
      mapRef.current.setView([p.lat, p.lng], Math.max(mapRef.current.getZoom() || 16, 16), { animate: true });
    }
  };

  const siguienteParada = () => {
    const siguiente = paradaIdxRef.current + 1;
    if (siguiente >= paradas.length) {
      setFaseNav('fin');
      decir(fraseFin(), true);
      return;
    }
    const pos = posPrevRef.current ?? undefined;
    decir(fraseSiguiente(paradas[siguiente].nombre, null), true);
    arrancarTramo(siguiente, pos);
  };

  const reintentar = () => {
    arrancarTramo(paradaIdxRef.current);
  };

  const cerrar = () => {
    detenerVoz();
    onClose();
  };

  // ── Render ────────────────────────────────────────────────
  const IconoMani = maniobraActual
    ? esPasoDestino(maniobraActual.instruccion)
      ? ICONOS_MANIOBRA.destino
      : ICONOS_MANIOBRA[iconoManiobra(maniobraActual.maniobra)]
    : ArrowUp;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 isolate" data-testid="nav-gps-modal">
      {/* CSS del mapa + animaciones (mismo idioma que el mapa en vivo) */}
      <style>{`
        @keyframes rtNavPing { 0% { transform: scale(1); opacity: 0.6 } 100% { transform: scale(2.6); opacity: 0 } }
        @keyframes rtNavSlide { from { transform: translateY(-14px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .rtnav-tooltip.leaflet-tooltip { background: #1e293b; color: #f1f5f9; border: 1px solid #334155; font-size: 11px; font-weight: 700; }
        .rtnav-tooltip.leaflet-tooltip::before { border-top-color: #1e293b; }
        .leaflet-container { background: #0f172a; font-family: inherit; }
        .leaflet-control-attribution { background: rgba(15,23,42,.75) !important; color: #94a3b8 !important; font-size: 9px !important; }
        .leaflet-control-attribution a { color: #cbd5e1 !important; }
        .rt-nav-banner { animation: rtNavSlide .28s ease-out; }
      `}</style>

      {/* Mapa */}
      <div ref={mapDivRef} className="absolute inset-0 z-0" />

      {/* ── Botonera lateral derecha ── */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <button
          onClick={cerrar}
          data-testid="nav-cerrar"
          className="w-11 h-11 rounded-full bg-slate-900/90 backdrop-blur border border-slate-600/80 text-white flex items-center justify-center shadow-xl active:scale-95 transition"
          title="Cerrar navegación"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          onClick={alternarVoz}
          data-testid="nav-voz"
          className={`w-11 h-11 rounded-full backdrop-blur border flex items-center justify-center shadow-xl active:scale-95 transition ${
            voz
              ? 'bg-blue-600 border-blue-400 text-white'
              : 'bg-slate-900/90 border-slate-600/80 text-slate-400'
          }`}
          title={voz ? 'Silenciar la voz' : 'Activar la voz'}
        >
          {voz ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
        <button
          onClick={centrar}
          data-testid="nav-centrar"
          className={`w-11 h-11 rounded-full backdrop-blur border flex items-center justify-center shadow-xl active:scale-95 transition ${
            siguiendo
              ? 'bg-emerald-600 border-emerald-400 text-white'
              : 'bg-slate-900/90 border-slate-600/80 text-slate-400'
          }`}
          title={siguiendo ? 'Siguiéndote (arrastra el mapa para soltar la cámara)' : 'Centrar en mi posición'}
        >
          <LocateFixed className="w-5 h-5" />
        </button>
      </div>

      {/* ── CARTEL DE MANIOBRA (arriba) ── */}
      {fase === 'navegando' && maniobraActual && (
        <div className="absolute top-3 left-3 right-[4.25rem] z-10 rt-nav-banner" data-testid="nav-maniobra">
          <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 border border-blue-400/60 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center flex-shrink-0">
                <IconoMani className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white leading-none tracking-tight">
                    {formatearDistancia(maniobraActual.distanciaM)}
                  </span>
                  <span className="text-[10px] font-bold text-blue-200 uppercase">próximo giro</span>
                </div>
                <p className="text-[13px] font-bold text-white leading-snug mt-0.5 line-clamp-2">
                  {maniobraActual.instruccion}
                </p>
              </div>
            </div>
            {luego && (
              <div className="px-4 py-1.5 bg-blue-900/40 border-t border-blue-500/30">
                <p className="text-[11px] text-blue-100 truncate">
                  <span className="font-bold text-blue-300">Luego:</span> {luego}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Recalculando (banner ámbar) ── */}
      {fase === 'recalculando' && (
        <div className="absolute top-3 left-3 right-[4.25rem] z-10 rt-nav-banner" data-testid="nav-recalculando">
          <div className="rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 border border-amber-300/60 shadow-2xl px-4 py-3.5 flex items-center gap-3">
            <RotateCw className="w-6 h-6 text-white animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-white">Recalculando ruta…</p>
              <p className="text-[11px] text-amber-100">Te desviaste — buscando el mejor camino desde donde estás</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Preparando / Error GPS (centro) ── */}
      {(fase === 'preparando' || fase === 'error') && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6" data-testid="nav-preparando">
          <div className="rounded-2xl bg-slate-900/95 backdrop-blur border border-slate-700 shadow-2xl p-6 max-w-sm w-full text-center">
            {fase === 'preparando' ? (
              <>
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                <p className="mt-3 text-white font-bold text-sm">{msg}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Navegando a la parada {parada?.num ?? 1}: {parada?.nombre ?? '…'}
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
                <p className="mt-3 text-white font-bold text-sm">GPS no disponible</p>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{msg}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={reintentar}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold active:scale-95 transition"
                  >
                    Reintentar
                  </button>
                  <button
                    onClick={cerrar}
                    className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold active:scale-95 transition"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CARTA INFERIOR: la parada actual ── */}
      {(fase === 'navegando' || fase === 'recalculando' || fase === 'llegada') && parada && (
        <div className="absolute bottom-3 left-3 right-3 z-10" data-testid="nav-parada">
          {fase === 'llegada' ? (
            /* ¡Llegaste! */
            <div className="rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 border border-emerald-400/60 shadow-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl flex-shrink-0">🎉</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wide">
                    Parada {parada.num} · {idxParada + 1} de {paradas.length}
                  </p>
                  <p className="text-base font-black text-white truncate">¡Llegaste: {parada.nombre}!</p>
                  <p className="text-[11px] text-emerald-100 truncate">
                    {parada.dir}
                    {parada.dist ? `, ${parada.dist}` : ''}
                    {parada.cobrar > 0 ? ` · Por cobrar S/ ${parada.cobrar.toFixed(0)}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={siguienteParada}
                  data-testid="nav-siguiente"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white text-emerald-700 text-xs font-black active:scale-95 transition"
                >
                  {idxParada + 1 >= paradas.length ? '🏁 Terminar ruta' : 'Siguiente parada'}
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={cerrar}
                  className="px-4 py-2.5 rounded-xl bg-emerald-900/50 border border-emerald-300/30 text-white text-xs font-bold active:scale-95 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            /* Navegando */
            <div className="rounded-2xl bg-slate-900/95 backdrop-blur border border-slate-700 shadow-2xl overflow-hidden">
              <div className="px-4 pt-3 pb-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Parada {parada.num} · {idxParada + 1} de {paradas.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {gpsPerdido && (
                      <span className="px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/40 text-red-300 text-[9px] font-bold">
                        señal GPS perdida
                      </span>
                    )}
                    {modoRecta && (
                      <span
                        className="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[9px] font-bold"
                        title="Google no respondió: línea directa, sin giros anunciados"
                      >
                        modo básico
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm font-black text-white truncate mt-0.5">{parada.nombre}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {parada.dir}
                  {parada.dist ? `, ${parada.dist}` : ''}
                </p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-bold">
                    <Flag className="w-3 h-3" />
                    {restanteM != null ? formatearDistancia(restanteM) : '…'}
                  </span>
                  {etaMin != null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-[11px] font-bold">
                      ⏱ ~{etaMin} min
                    </span>
                  )}
                  {parada.cobrar > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                      S/ {parada.cobrar.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
              {/* Escape: por si en algún giro prefieres tu app de siempre */}
              <div className="px-4 py-2 bg-slate-900/80 border-t border-slate-700/70 flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide flex-shrink-0">
                  Escapar a
                </span>
                <a
                  href={urlNavegacionWaze(parada.lat, parada.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-white text-[11px] font-bold active:scale-95 transition"
                >
                  🚗 Waze
                </a>
                <a
                  href={urlNavegacionGoogle(parada.lat, parada.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-white text-[11px] font-bold active:scale-95 transition"
                >
                  🛵 Google
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fin de ruta ── */}
      {fase === 'fin' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6" data-testid="nav-fin">
          <div className="rounded-2xl bg-slate-900/95 backdrop-blur border border-emerald-500/40 shadow-2xl p-6 max-w-sm w-full text-center">
            <div className="text-5xl">🏆</div>
            <p className="mt-3 text-lg font-black text-white">¡Ruta completada!</p>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Llegaste a las {paradas.length} parada{paradas.length === 1 ? '' : 's'} pendiente
              {paradas.length === 1 ? '' : 's'} de hoy. Buen trabajo 🛵💨
            </p>
            <button
              onClick={cerrar}
              className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold active:scale-95 transition"
            >
              Volver a Mi Ruta
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
