// ═══════════════════════════════════════════════════════════
// 📍 UBICAR EN EL MAPA — DriverTrack (F-ID3.2 → FASE E)
// Modal estilo RiderTrack v2 (UbicarClienteModal) para poner el
// punto A (recojo) y el punto B (entrega) EN EL MAPA:
//   • 🔍 buscador por DIRECCIÓN con autocompletado (el mismo del
//     panel de trabajo: escribís "av sucre" y elegís de la lista,
//     o pegás coordenadas / link de Google Maps → pin EXACTO)
//   • 📋 copiar la dirección registrada (para pegarla donde sea)
//   • 🔄 convertir la dirección registrada en pin (geocodificación)
//   • pin ARRASTRABLE + toque en el mapa para afinar
//   • 📌 "Usar mi GPS" → pin donde estás parado ahora
//   • también podés TIBIAR las coordenadas a mano (lat/lng)
//   • tiles con el MISMO look del mapa de la app (oscuro/claro/
//     satélite, el que tengas elegido)
// FASE E: el mismo modal sirve para el RECOJO (A) y la ENTREGA
// (B) — cambia el título y el color del pin (ámbar / celeste).
// Al confirmar, el viaje queda con `coordenadasA`/`coordenadas`
// → pins 🅰️📍 en la pestaña Mapa para siempre.
// ═══════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Copy, Crosshair, Loader2, MapPin, Move, RefreshCw, X } from 'lucide-react';
import { agregarTiles, leerEstilo } from '../services/tiles';
// FASE E: buscador por dirección del panel de trabajo + geocodificación
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { geocodificarDireccion } from '../../services/geocoding';

interface Props {
  coordenadasIniciales?: { lat: number; lng: number } | null;
  onGuardar: (coords: { lat: number; lng: number }, nombre?: string) => void;
  onCerrar: () => void;
  /** FASE E: qué punto se está ubicando — 'A' recojo (ámbar) o 'B' entrega (celeste) */
  punto?: 'A' | 'B';
  /** FASE E: la dirección escrita/escaneada del punto — para copiarla
   *  o convertirla en pin, igual que en el panel de trabajo */
  direccionRegistrada?: string;
  /** FASE E: distrito/zona del viaje — ayuda al geocodificador */
  distrito?: string;
}

const LIMA: [number, number] = [-12.046374, -77.042793];

function esCoordValida(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

// 📋 copiar con respaldo (WebViews de Android sin clipboard API)
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // sigue al plan B
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function UbicarModal({
  coordenadasIniciales,
  onGuardar,
  onCerrar,
  punto = 'B',
  direccionRegistrada = '',
  distrito = '',
}: Props) {
  const [latStr, setLatStr] = useState(
    coordenadasIniciales ? String(coordenadasIniciales.lat) : '',
  );
  const [lngStr, setLngStr] = useState(
    coordenadasIniciales ? String(coordenadasIniciales.lng) : '',
  );
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [aviso, setAviso] = useState('');
  // FASE E: estado de la dirección — copiar y sincronizar
  const [copiado, setCopiado] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  /** etiqueta de la dirección elegida (buscador o geocodificación) */
  const [nombreElegido, setNombreElegido] = useState('');

  const esPuntoA = punto === 'A';
  const colorPin = esPuntoA ? '#f59e0b' : '#38bdf8';

  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const pinRef = useRef<L.Marker | null>(null);
  // El pin se mueve MUCHO mientras arrastrás → el estado React va
  // con throttle (solo al soltar); el input en vivo sale de acá
  const [arrastre, setArrastre] = useState(false);

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  const hayCoord = esCoordValida(lat, lng);
  const direccionTrim = direccionRegistrada.trim();

  const centroInicial: [number, number] = useMemo(
    () => (coordenadasIniciales ? [coordenadasIniciales.lat, coordenadasIniciales.lng] : LIMA),
    [coordenadasIniciales], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Crear el mapa UNA vez ──────────────────────────────────
  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;
    const mapa = L.map(contenedorRef.current, {
      center: centroInicial,
      zoom: coordenadasIniciales ? 16 : 11,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(mapa);
    agregarTiles(mapa, leerEstilo());

    // Toque en el mapa → mover el pin ahí
    mapa.on('click', (e: L.LeafletMouseEvent) => {
      setLatStr(String(+e.latlng.lat.toFixed(5)));
      setLngStr(String(+e.latlng.lng.toFixed(5)));
      setAviso('');
      setNombreElegido('');
    });
    mapaRef.current = mapa;
    setTimeout(() => mapa.invalidateSize(), 60);

    return () => {
      mapa.remove();
      mapaRef.current = null;
      pinRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dibujar/mover el pin cuando cambian las coordenadas ────
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    if (!hayCoord) {
      if (pinRef.current) {
        mapa.removeLayer(pinRef.current);
        pinRef.current = null;
      }
      return;
    }
    const pos: [number, number] = [lat, lng];

    if (!pinRef.current) {
      // Pin estilo RiderTrack: gota con borde blanco, arrastrable
      // FASE E: ámbar para el recojo (A), celeste para la entrega (B)
      pinRef.current = L.marker(pos, {
        draggable: true,
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: '',
          html:
            `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);` +
            `background:${colorPin};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);` +
            `display:flex;align-items:center;justify-content:center">` +
            `<div style="transform:rotate(45deg);width:10px;height:10px;border-radius:50%;background:#fff"></div>` +
            `</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30], // la punta de la gota toca el punto
        }),
      })
        .on('dragstart', () => setArrastre(true))
        .on('dragend', (e) => {
          const p = (e.target as L.Marker).getLatLng();
          setLatStr(String(+p.lat.toFixed(5)));
          setLngStr(String(+p.lng.toFixed(5)));
          setArrastre(false);
          setNombreElegido('');
        })
        .addTo(mapa);
    } else {
      pinRef.current.setLatLng(pos);
    }
    // El pin siempre visible: si está fuera de pantalla, centrar
    if (!mapa.getBounds().contains(pos)) mapa.setView(pos, Math.max(mapa.getZoom(), 15));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latStr, lngStr]);

  /** 📌 Usa la posición GPS actual como coordenada */
  function usarMiGps() {
    if (!('geolocation' in navigator)) {
      setAviso('Tu navegador no soporta GPS');
      return;
    }
    setBuscandoGps(true);
    setAviso('');
    navigator.geolocation.getCurrentPosition(
      p => {
        setLatStr(String(+p.coords.latitude.toFixed(5)));
        setLngStr(String(+p.coords.longitude.toFixed(5)));
        setBuscandoGps(false);
        setNombreElegido('');
      },
      () => {
        setBuscandoGps(false);
        setAviso('No se pudo obtener tu ubicación — mové el pin a mano');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  }

  /** 📋 FASE E: copiar la dirección registrada (como el panel de trabajo) */
  async function copiarDireccion() {
    if (!direccionTrim) return;
    const ok = await copiarTexto(direccionTrim);
    if (ok) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } else {
      setAviso('No se pudo copiar — usá toque largo sobre el texto');
    }
  }

  /** 🔄 FASE E: convertir la DIRECCIÓN REGISTRADA en pin — la misma
   *  geocodificación del panel de trabajo (Google + respaldo). Si
   *  la dirección trae coordenadas pegadas, salen EXACTAS. */
  async function sincronizarDireccion() {
    if (!direccionTrim || sincronizando) return;
    setSincronizando(true);
    setAviso('');
    try {
      const coords = await geocodificarDireccion(direccionTrim, distrito || undefined);
      if (!coords) {
        setAviso(`"${direccionTrim}" no devolvió coordenadas — buscá abajo o mové el pin a mano`);
        return;
      }
      setLatStr(String(+coords.lat.toFixed(5)));
      setLngStr(String(+coords.lng.toFixed(5)));
      setNombreElegido(direccionTrim);
    } catch {
      setAviso('No se pudo buscar la dirección — mové el pin o escribí las coordenadas');
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
      data-testid="modal-ubicar"
      onClick={e => e.target === e.currentTarget && onCerrar()}
    >
      <style>{`
        .dtmap-modal .leaflet-container { background: #0f172a; font-family: inherit; }
        .dtmap-modal .leaflet-bar a { background: #1e293b; color: #e2e8f0; border-color: #334155; }
        .dtmap-modal .leaflet-bar a:hover { background: #334155; }
      `}</style>

      <div className="dtmap-modal flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className="rounded-xl border p-2"
              style={{
                borderColor: `${colorPin}33`,
                background: `${colorPin}1a`,
                color: colorPin,
              }}
            >
              <MapPin size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {esPuntoA ? '¿Dónde es el recojo? (A)' : '¿Dónde es la entrega? (B)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Buscá la dirección, mové el pin o escribí las coordenadas
              </p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
            data-testid="cerrar-ubicar"
          >
            <X size={18} />
          </button>
        </div>

        {/* El mapa */}
        <div className="relative h-52 w-full shrink-0">
          <div ref={contenedorRef} className="absolute inset-0" data-testid="modal-mapa-hoja" />
          <div className="pointer-events-none absolute left-2 top-2 z-[500] flex items-center gap-1 rounded-lg bg-slate-900/85 px-2 py-1 text-[10px] font-bold text-slate-300">
            <Move size={11} /> arrastrá el pin · tocá el mapa
          </div>
        </div>

        {/* Controles */}
        <div className="space-y-2.5 overflow-y-auto p-4">
          {/* FASE E: dirección registrada + 📋 copiar (como el panel
              de trabajo) — para pegarla en WhatsApp, inDrive, etc. */}
          {direccionTrim && (
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-2.5" data-testid="box-direccion-registrada">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Dirección registrada</p>
                <button
                  onClick={copiarDireccion}
                  className="flex items-center gap-1 rounded-lg bg-slate-700/60 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 transition-all hover:bg-slate-600/70 hover:text-white active:scale-95"
                  title="Copiar la dirección (para pegarla donde quieras)"
                  data-testid="boton-copiar-dir"
                >
                  {copiado ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copiado ? 'Copiada' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-slate-200">{direccionTrim}</p>
              <button
                onClick={sincronizarDireccion}
                disabled={sincronizando}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500/15 py-2 text-[11px] font-bold text-sky-300 transition-all hover:bg-sky-500/25 active:scale-[0.98] disabled:opacity-40"
                title="Buscar en el mapa la dirección registrada (geocodificación)"
                data-testid="boton-sincronizar-dir"
              >
                {sincronizando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Ubicar esta dirección en el mapa
              </button>
            </div>
          )}

          {/* FASE E: 🔍 buscador por dirección — el MISMO del panel
              de trabajo (autocompletado + coordenadas pegadas exactas) */}
          <div data-testid="ubicar-buscador">
            <AddressAutocomplete
              label={`Buscar la dirección ${esPuntoA ? 'del recojo (A)' : 'de la entrega (B)'}`}
              placeholder="av sucre 523, jr cuzco… o pegá -12.046,-77.042"
              icono={esPuntoA ? 'inicio' : 'cliente'}
              valorGuardado={null}
              onElegir={d => {
                setLatStr(String(+d.lat.toFixed(5)));
                setLngStr(String(+d.lng.toFixed(5)));
                setNombreElegido(d.nombre);
                setAviso('');
                vibrarSuave();
              }}
              ayuda="Escribí la avenida y elegí de la lista — o pegá coordenadas / link de Google Maps: caen EXACTO."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Latitud</label>
              <input
                value={latStr}
                onChange={e => setLatStr(e.target.value.replace(',', '.'))}
                inputMode="decimal"
                placeholder="-12.04637"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-lat"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Longitud</label>
              <input
                value={lngStr}
                onChange={e => setLngStr(e.target.value.replace(',', '.'))}
                inputMode="decimal"
                placeholder="-77.04279"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400"
                data-testid="input-lng"
              />
            </div>
          </div>

          <button
            onClick={usarMiGps}
            disabled={buscandoGps}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 py-2.5 text-xs font-bold text-sky-300 transition-all active:scale-[0.98] disabled:opacity-50"
            data-testid="boton-mi-gps"
          >
            {buscandoGps ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Buscando tu ubicación…
              </>
            ) : (
              <>
                <Crosshair size={14} /> 📌 Usar mi ubicación actual (GPS)
              </>
            )}
          </button>

          {aviso && <p className="text-center text-[11px] text-amber-400" data-testid="ubicar-aviso">{aviso}</p>}
          {hayCoord && (
            <div
              className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-[11px] font-semibold text-emerald-300"
              data-testid="ubicar-vista-coords"
            >
              📍 {lat.toFixed(5)}, {lng.toFixed(5)}
              {nombreElegido && (
                <span className="block truncate text-[10px] font-medium text-emerald-400/80" data-testid="ubicar-nombre-elegido">
                  {nombreElegido}
                </span>
              )}
            </div>
          )}

          <button
            onClick={() => hayCoord && onGuardar({ lat: +lat.toFixed(5), lng: +lng.toFixed(5) }, nombreElegido || undefined)}
            disabled={!hayCoord || arrastre}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all active:scale-[0.98] ${
              hayCoord
                ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                : 'bg-slate-700 text-slate-500'
            }`}
            data-testid="boton-confirmar-ubicar"
          >
            <Check size={16} /> Usar esta ubicación
          </button>
        </div>
      </div>
    </div>
  );
}

/** vibración cortita (best effort — en web no hace nada) */
function vibrarSuave(): void {
  try {
    navigator.vibrate?.(40);
  } catch {
    /* nada */
  }
}
