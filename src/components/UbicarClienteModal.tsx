// ═══════════════════════════════════════════════════════════
// 📍 UBICAR CLIENTE - RiderTrack V2 (Fase 1.4 → fix Fase 2.8)
// Modal para ubicar manualmente a un cliente en el mapa:
//   • Buscas su dirección con autocompletado (estilo Circuit)
//   • Ves el punto en el mini-mapa de verificación — AHORA SE
//     VE SIEMPRE (Fase 2.8: antes el mapa nunca se inicializaba
//     porque el div se creaba DESPUÉS del useEffect de init →
//     quedaba un bloque negro/blanco vacío)
//   • Tiles según el tema de la app (claro/oscuro)
//   • Pin ARRASTRABLE y toque en el mapa para afinar la posición
//   • Guardas → coordenada EXACTA (src: 'manual') para siempre
//
// Cuándo usarlo: cuando la geocodificación automática solo
// encontró el centro del distrito (marcado "aprox") o no encontró
// nada. Una vez ubicado a mano, nunca más se pierde.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin, Loader2, Save, Home, AlertTriangle, CheckCircle2, Move } from 'lucide-react';
import { Cliente } from '../services/firestore';
import { AddressAutocomplete, DireccionElegida } from './AddressAutocomplete';
import { tilesDeEstilo } from '../services/mapStyle';

interface UbicarClienteModalProps {
  cliente: Cliente;
  onClose: () => void;
  onGuardar: (clienteId: string | number, coords: { lat: number; lng: number; src: 'manual' }, nombreLugar: string) => void;
  /** Toast opcional */
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

/** Selección actual: dirección elegida + marca si el pin se movió a mano */
type Seleccion = DireccionElegida & { ajustadoAMano?: boolean };

export const UbicarClienteModal: React.FC<UbicarClienteModalProps> = ({
  cliente,
  onClose,
  onGuardar,
  onShowToast,
}) => {
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [guardando, setGuardando] = useState(false);

  const yaTieneCoords =
    typeof cliente.lat === 'number' && typeof cliente.lng === 'number';
  const esAprox = cliente.latSrc === 'aprox';

  // Si ya tiene coordenadas, empezar mostrándolas
  useEffect(() => {
    if (yaTieneCoords) {
      setSeleccion({
        nombre: `${cliente.dir || 'Ubicación actual'}${cliente.dist ? `, ${cliente.dist}` : ''}`,
        distrito: cliente.dist,
        lat: cliente.lat!,
        lng: cliente.lng!,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mini-mapa de verificación (SIEMPRE visible) ─────────
  // Fase 2.8: el div del mapa se renderiza desde el primer
  // pintado (ya no depende de `seleccion`), así el useEffect de
  // inicialización SÍ encuentra el nodo y el mapa carga.
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Centro inicial: coordenadas del cliente si ya tiene, si no Lima
  const centroInicial: [number, number] = yaTieneCoords
    ? [cliente.lat!, cliente.lng!]
    : [-12.046374, -77.042793];

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      center: centroInicial,
      zoom: yaTieneCoords ? 16 : 11,
      zoomControl: true,
      attributionControl: false,
    });
    // Tiles según el TEMA de la app (html.light → tiles claros),
    // con la misma config gratuita ESRI del mapa de entregas.
    const esTemaClaro =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('light');
    const conf = tilesDeEstilo(esTemaClaro ? 'claro' : 'oscuro');
    L.tileLayer(conf.url, { maxZoom: conf.maxZoom }).addTo(map);
    if (conf.refUrl) L.tileLayer(conf.refUrl, { maxZoom: conf.maxZoom }).addTo(map);

    // Toque en el mapa → mover el pin ahí (precisión a mano)
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setSeleccion((prev) =>
        prev
          ? { ...prev, lat, lng, ajustadoAMano: true }
          : {
              nombre: 'Punto elegido en el mapa',
              distrito: cliente.dist,
              lat,
              lng,
              ajustadoAMano: true,
            }
      );
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mover el marcador cuando cambia la selección
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !seleccion) return;

    const icon = L.divIcon({
      className: '',
      html:
        `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);` +
        `background:#6366f1;border:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.6);` +
        `display:flex;align-items:center;justify-content:center;cursor:grab;">` +
        `<span style="transform:rotate(45deg);color:#fff;font-weight:900;font-size:14px">📍</span></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([seleccion.lat, seleccion.lng]);
      markerRef.current.setIcon(icon);
    } else {
      const m = L.marker([seleccion.lat, seleccion.lng], { icon, draggable: true }).addTo(map);
      // Arrastrar el pin → nueva posición exacta
      m.on('dragend', () => {
        const p = m.getLatLng();
        setSeleccion((prev) =>
          prev ? { ...prev, lat: p.lat, lng: p.lng, ajustadoAMano: true } : prev
        );
      });
      // Evitar que tocar el pin dispare el click del mapa
      m.on('click', (e) => L.DomEvent.stopPropagation(e as unknown as Event));
      markerRef.current = m;
    }
    map.setView([seleccion.lat, seleccion.lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [seleccion]);

  const guardar = async () => {
    if (!seleccion) return;
    setGuardando(true);
    try {
      onGuardar(cliente.id, { lat: seleccion.lat, lng: seleccion.lng, src: 'manual' }, seleccion.nombre);
      onShowToast?.('📍 Cliente ubicado', `${cliente.nombre}: ${seleccion.nombre}`, 'success');
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[900] flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              📍 Ubicar en el mapa
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {cliente.nombre} · {cliente.dist || 'sin distrito'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Dirección registrada */}
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Dirección registrada</p>
            <p className="text-xs text-slate-200">{cliente.dir || '(sin dirección)'}</p>
            {cliente.obs && (
              <p className="text-[10px] text-amber-400/80 mt-1">📝 {cliente.obs}</p>
            )}
            {esAprox && (
              <p className="text-[10px] text-amber-400 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Ahora mismo solo tiene el centro del distrito (aprox.)
              </p>
            )}
          </div>

          {/* Buscador con autocompletado */}
          <AddressAutocomplete
            label="Buscar dirección exacta"
            placeholder="ej: av sucre 523, jr cuzco…"
            icono="cliente"
            valorGuardado={null}
            onElegir={(d) => setSeleccion({ ...d })}
            ayuda="Escribe la avenida o calle y elige la opción correcta de la lista."
          />

          {/* Mini-mapa de verificación — SIEMPRE visible (Fase 2.8) */}
          <div className="space-y-2">
            <div className="rounded-xl overflow-hidden border border-slate-700 relative">
              <div ref={mapDivRef} className="h-44 w-full bg-slate-950 z-0" />
              {!seleccion && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-[1px] pointer-events-none px-6 text-center">
                  <MapPin className="w-5 h-5 text-indigo-400 mb-1.5" />
                  <p className="text-[11px] font-bold text-slate-200">
                    {yaTieneCoords
                      ? 'Esta es su ubicación guardada'
                      : 'Sin ubicación todavía'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Busca la dirección abajo o toca el mapa para poner el pin
                  </p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <Move className="w-3 h-3 shrink-0" />
              Toca el mapa o arrastra el pin 📍 para afinar la posición exacta
            </p>
            {seleccion && (
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-indigo-300 truncate">
                    {seleccion.nombre}
                    {seleccion.ajustadoAMano ? ' · ajustado a mano' : ''}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {seleccion.distrito ? `${seleccion.distrito} · ` : ''}
                    verifica el punto en el mapa de arriba
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={!seleccion || guardando}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar ubicación
            </button>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5">
            <Home className="w-3 h-3 mt-0.5 shrink-0" />
            La ubicación queda guardada para siempre en este cliente (Firestore + caché del
            dispositivo): el mapa, la optimización de ruta y la navegación la usarán automáticamente.
          </p>
        </div>
      </div>
    </div>
  );
};
