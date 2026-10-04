// ═══════════════════════════════════════════════════════════
// 🗺️ DriverTrack — Mapa del día (F-ID3 → F-ID3.2)
// Dibuja las RUTAS GPS grabadas con el botón 📍 de la lista:
// cada viaje es una línea del color de su origen, con banderín 🏁
// de arranque (verde) y llegada (rojo). Abajo, los números que
// importan: km totales del día y cuánto te pagó cada km.
// Leaflet + tiles gratuitos — sin API key, sin costo.
//
// F-ID3.1 — MISMO LOOK que RiderTrack v2: tiles ESRI Dark Gray,
// rutas punteadas animadas, banderines, popups oscuros, leyenda
// flotante con blur.
//
// F-ID3.2 — SEGUIMIENTO DE RUTA EN VIVO (como RiderTrack):
//   • mientras grabás un viaje, la pestaña Mapa muestra el trazado
//     que se va dibujando EN VIVO + el motito 🛵 con tu posición
//   • botón "Seguirme": la cámara te persigue mientras manejás
//     (estilo Circuit) — arrastrar el mapa lo apaga
//   • 📍 pins de ENTREGA para viajes ubicados por coordenadas
// ═══════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronLeft, ChevronRight, LocateFixed, Palette } from 'lucide-react';
import { nombreOrigen, OrigenViaje, Viaje } from '../types';
import { fechaBonita, fechaHoy } from '../storage';
import { fmtSoles } from '../utils';
import { formatearDuracion } from '../services/gps';
import type { EstadoGPS } from '../services/gps';
import { agregarTiles, EstiloMapa, guardarEstilo, leerEstilo, ORDEN_ESTILOS, TILES } from '../services/tiles';

interface Props {
  viajes: Viaje[]; // TODOS los viajes (acá se filtra por día)
  estadoGPS?: EstadoGPS | null; // F-ID3.2: grabación en curso (seguimiento en vivo)
}

// Color de línea por origen (mismo código de colores del resto de la app)
const COLOR_ORIGEN: Record<OrigenViaje, string> = {
  indrive: '#10b981',   // emerald
  rappi: '#f97316',     // orange
  pedidosya: '#ef4444', // red
  directo: '#38bdf8',   // sky
};

// 🛵 El motito del rider (mismo SVG de RiderTrack v2)
const SVG_MOTO =
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ffffff" stroke-width="2.2" ` +
  `stroke-linecap="round" stroke-linejoin="round">` +
  `<circle cx="18.5" cy="17.5" r="3.4"></circle>` +
  `<circle cx="5.5" cy="17.5" r="3.4"></circle>` +
  `<circle cx="15" cy="5" r="1"></circle>` +
  `<path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>` +
  `</svg>`;

function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Escapa texto para los popups HTML (nombres de clientes, etc.) */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Banderín 🏁 estilo RiderTrack: círculo con borde blanco + icono */
function iconoBanderin(colorFondo: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      `<div style="width:32px;height:32px;border-radius:50%;background:${colorFondo};border:3px solid #fff;` +
      `box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center">` +
      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>` +
      `<line x1="4" y1="22" x2="4" y2="15"></line>` +
      `</svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/** 📍 Pin de gota para la ENTREGA (viajes ubicados por coordenadas) */
function iconoPinEntrega(): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);` +
      `background:#38bdf8;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);` +
      `display:flex;align-items:center;justify-content:center">` +
      `<div style="transform:rotate(45deg);width:10px;height:10px;border-radius:50%;background:#fff"></div>` +
      `</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30], // la punta de la gota toca el punto
  });
}

export default function MapView({ viajes, estadoGPS = null }: Props) {
  const [fecha, setFecha] = useState(fechaHoy());
  const [estilo, setEstilo] = useState<EstiloMapa>(leerEstilo);
  const [siguiendo, setSiguiendo] = useState(false); // F-ID3.2: cámara que persigue a la moto
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const capaTilesRef = useRef<L.LayerGroup | null>(null);
  const capaRutasRef = useRef<L.LayerGroup | null>(null);
  const capaVivaRef = useRef<L.LayerGroup | null>(null); // F-ID3.2: seguimiento en vivo
  const siguiendoRef = useRef(false);
  const grabacionVistaRef = useRef<string | null>(null); // viajeId ya "presentado" en cámara

  const delDia = useMemo(() => viajes.filter(v => v.fecha === fecha), [viajes, fecha]);
  const conRuta = useMemo(() => delDia.filter(v => v.ruta && v.ruta.length >= 2), [delDia]);
  const sinGPS = useMemo(() => delDia.filter(v => !v.ruta || v.ruta.length < 2), [delDia]);
  // F-ID3.2: entregas ubicadas por coordenadas (sin ruta grabada)
  const conCoordenadas = useMemo(
    () => delDia.filter(v => v.coordenadas && (!v.ruta || v.ruta.length < 2)),
    [delDia],
  );

  const kmTotal = delDia.reduce((s, v) => s + (v.kmGPS ?? 0), 0);
  const segTotal = delDia.reduce((s, v) => s + (v.duracionSeg ?? 0), 0);
  // S/ por km HONESTO: solo la plata de los viajes que SÍ se
  // grabaron (si se mezclara el neto de viajes sin GPS, el "por km"
  // saldría inflado y no significaría nada)
  const netoGrabado = conRuta.reduce((s, v) => s + v.neto, 0);
  const solesPorKm = kmTotal > 0 ? netoGrabado / kmTotal : 0;
  const esHoy = fecha === fechaHoy();

  // El viaje que se está grabando (para el color de la línea viva)
  const viajeVivo = estadoGPS ? viajes.find(v => v.id === estadoGPS.viajeId) ?? null : null;
  const colorVivo = viajeVivo ? COLOR_ORIGEN[viajeVivo.origen] ?? '#38bdf8' : '#38bdf8';

  // ── Crear el mapa UNA vez ─────────────────────────────────
  useEffect(() => {
    if (!contenedorRef.current) return;
    if (!mapaRef.current) {
      mapaRef.current = L.map(contenedorRef.current, {
        zoomControl: false,          // móvil: se hace zoom con los dedos
        attributionControl: false,   // la atribución va como texto chiquito abajo
        maxZoom: 19,
      }).setView([-12.046, -77.043], 11); // Lima por defecto hasta que haya rutas
      L.control.zoom({ position: 'bottomright' }).addTo(mapaRef.current);
      capaRutasRef.current = L.layerGroup().addTo(mapaRef.current);
      capaVivaRef.current = L.layerGroup().addTo(mapaRef.current);

      // F-ID3.2: arrastrar el mapa APAGA el seguimiento (el usuario
      // toma el control de la cámara — como en RiderTrack / Circuit)
      mapaRef.current.on('dragstart', () => {
        siguiendoRef.current = false;
        setSiguiendo(false);
      });

      // handle de diagnóstico/tests (centro de la cámara)
      (window as unknown as { __dtMapa?: L.Map }).__dtMapa = mapaRef.current;
    }
    const mapa = mapaRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tiles + rutas guardadas del día (se redibujan juntas) ─
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    // Tiles según el estilo elegido (base + capa de nombres si hay)
    capaTilesRef.current?.remove();
    capaTilesRef.current = agregarTiles(mapa, estilo);
    guardarEstilo(estilo);

    // (Re)dibujar las rutas del día
    const capa = capaRutasRef.current!;
    capa.clearLayers();
    const bounds = L.latLngBounds([]);

    for (const v of conRuta) {
      const puntos = v.ruta!.map(p => [p.lat, p.lng] as [number, number]);
      const color = COLOR_ORIGEN[v.origen] ?? '#38bdf8';

      // Línea punteada ANIMADA (los guiones fluyen a lo largo de
      // la ruta — mismo look que el mapa de RiderTrack v2)
      L.polyline(puntos, {
        color,
        weight: 3.5,
        dashArray: '6 9',
        opacity: 0.9,
        className: 'dtmap-ruta',
      })
        .bindPopup(
          `<div style="font-weight:800;font-size:13px;margin-bottom:2px">${esc(v.cliente || 'Cliente')}</div>` +
            `<div style="font-size:11px;color:#94a3b8">${esc(nombreOrigen(v.origen))} · ${fmtSoles(v.tarifa)}</div>` +
            `<div style="font-size:11px;color:#94a3b8">📍 ${(v.kmGPS ?? 0).toFixed(1)} km · ${formatearDuracion(v.duracionSeg ?? 0)}</div>`,
          { className: 'dtmap-popup' },
        )
        .addTo(capa);

      // 🏁 Banderines de arranque y llegada
      L.marker(puntos[0], { icon: iconoBanderin('#10b981'), zIndexOffset: 900 })
        .bindTooltip(`🏁 Arranque · ${v.cliente || 'Cliente'}`, {
          className: 'dtmap-tooltip',
          direction: 'top',
          offset: [0, -16],
        })
        .addTo(capa);
      L.marker(puntos[puntos.length - 1], { icon: iconoBanderin('#f43f5e'), zIndexOffset: 900 })
        .bindTooltip(`🏁 Llegada · ${v.cliente || 'Cliente'}`, {
          className: 'dtmap-tooltip',
          direction: 'top',
          offset: [0, -16],
        })
        .addTo(capa);

      bounds.extend(puntos);
    }

    // F-ID3.2: 📍 pins de ENTREGA (viajes ubicados por coordenadas)
    for (const v of conCoordenadas) {
      L.marker([v.coordenadas!.lat, v.coordenadas!.lng], {
        icon: iconoPinEntrega(),
        zIndexOffset: 800,
      })
        .bindPopup(
          `<div style="font-weight:800;font-size:13px;margin-bottom:2px">${esc(v.cliente || 'Cliente')}</div>` +
            `<div style="font-size:11px;color:#94a3b8">${esc(nombreOrigen(v.origen))} · ${fmtSoles(v.tarifa)}</div>` +
            (v.direccion ? `<div style="font-size:11px;color:#94a3b8">📍 ${esc(v.direccion)}</div>` : '') +
            `<div style="font-size:10px;color:#64748b;font-family:monospace">${v.coordenadas!.lat.toFixed(5)}, ${v.coordenadas!.lng.toFixed(5)}</div>`,
          { className: 'dtmap-popup' },
        )
        .addTo(capa);
      bounds.extend([v.coordenadas!.lat, v.coordenadas!.lng]);
    }

    if (bounds.isValid()) mapa.fitBounds(bounds.pad(0.15));
    setTimeout(() => mapa.invalidateSize(), 60); // el div aparece después del mount
  }, [conRuta, conCoordenadas, estilo]);

  // ── F-ID3.2: SEGUIMIENTO EN VIVO — la línea que se dibuja
  //    mientras manejás + el motito con tu posición ──────────
  useEffect(() => {
    const mapa = mapaRef.current;
    const capa = capaVivaRef.current;
    if (!mapa || !capa) return;
    capa.clearLayers();

    if (!estadoGPS || estadoGPS.puntos.length === 0) {
      grabacionVistaRef.current = null; // nueva grabación → se vuelve a presentar
      return;
    }

    const puntos = estadoGPS.puntos.map(p => [p.lat, p.lng] as [number, number]);
    const ultimo = puntos[puntos.length - 1];

    // Línea VIVA: sólida (las guardadas son punteadas) — se nota
    // cuál es la que se está grabando AHORA
    if (puntos.length >= 2) {
      L.polyline(puntos, {
        color: colorVivo,
        weight: 4.5,
        opacity: 0.95,
        className: 'dtmap-ruta-viva',
      }).addTo(capa);
    }

    // 🛵 Motito con ping (posición actual)
    L.marker(ultimo, {
      zIndexOffset: 1000,
      icon: L.divIcon({
        className: '',
        html:
          `<div style="position:relative;width:38px;height:38px">` +
          `<span style="position:absolute;inset:0;border-radius:50%;background:${colorVivo};opacity:0.35;animation:dtmapPing 1.8s ease-out infinite"></span>` +
          `<div style="position:absolute;inset:3px;border-radius:50%;background:${colorVivo};border:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center">` +
          SVG_MOTO +
          `</div></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      }),
    })
      .bindTooltip(`🛵 ${viajeVivo?.cliente || 'Tú'} — grabando`, {
        className: 'dtmap-tooltip',
        direction: 'top',
        offset: [0, -18],
      })
      .addTo(capa);

    // Cámara: primera vez que aparece la grabación → mostrarla;
    // después, solo si el modo Seguirme está prendido
    if (grabacionVistaRef.current !== estadoGPS.viajeId) {
      grabacionVistaRef.current = estadoGPS.viajeId;
      mapa.setView(ultimo, 15);
    } else if (siguiendoRef.current) {
      mapa.panTo(ultimo, { animate: true });
    }
  }, [estadoGPS, colorVivo, viajeVivo]);

  // Al desmontar la pestaña, el mapa se destruye (y el modo
  // seguimiento se apaga — al volver se re-presenta la grabación)
  useEffect(() => {
    return () => {
      mapaRef.current?.remove();
      mapaRef.current = null;
      capaVivaRef.current = null;
      capaRutasRef.current = null;
      capaTilesRef.current = null;
      grabacionVistaRef.current = null;
    };
  }, []);

  function alternarSeguimiento() {
    const nuevo = !siguiendo;
    siguiendoRef.current = nuevo;
    setSiguiendo(nuevo);
    // si se prende y hay grabación → pegar la cámara al motito
    const mapa = mapaRef.current;
    const puntos = estadoGPS?.puntos;
    if (nuevo && mapa && puntos && puntos.length > 0) {
      const u = puntos[puntos.length - 1];
      mapa.setView([u.lat, u.lng], Math.max(mapa.getZoom(), 16), { animate: true });
    }
  }

  const nombreEstilo = estilo === 'oscuro' ? 'Oscuro' : estilo === 'claro' ? 'Claro' : 'Satélite';
  const grabando = !!estadoGPS && estadoGPS.puntos.length > 0;

  return (
    <div className="space-y-3" data-testid="mapa-view">
      {/* Estilos del mapa (chroma oscuro estilo RiderTrack) + animaciones */}
      <style>{`
        @keyframes dtmapFlujo { to { stroke-dashoffset: -300; } }
        @keyframes dtmapPing { 0% { transform: scale(1); opacity: 0.6 } 100% { transform: scale(2.6); opacity: 0 } }
        .dtmap-ruta { animation: dtmapFlujo 18s linear infinite; }
        .dtmap-popup .leaflet-popup-content-wrapper { background: #1e293b; color: #f1f5f9; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
        .dtmap-popup .leaflet-popup-tip { background: #1e293b; border: 1px solid #334155; }
        .dtmap-popup .leaflet-popup-content { margin: 12px 14px; font-size: 12px; line-height: 1.5; }
        .dtmap-tooltip.leaflet-tooltip { background: #1e293b; color: #f1f5f9; border: 1px solid #334155; font-size: 11px; font-weight: 700; }
        .dtmap-tooltip.leaflet-tooltip::before { border-top-color: #1e293b; }
        .leaflet-container { background: #0f172a; font-family: inherit; }
        .leaflet-bar a { background: #1e293b; color: #e2e8f0; border-color: #334155; }
        .leaflet-bar a:hover { background: #334155; }
      `}</style>

      {/* Navegador de fecha */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 p-2">
        <button
          onClick={() => setFecha(sumarDias(fecha, -1))}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-700"
          aria-label="Día anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold capitalize text-slate-100">{fechaBonita(fecha)}</p>
          {!esHoy && (
            <button onClick={() => setFecha(fechaHoy())} className="text-[11px] text-emerald-400 underline">
              ir a hoy
            </button>
          )}
        </div>
        <button
          onClick={() => setFecha(sumarDias(fecha, 1))}
          disabled={esHoy}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-700 disabled:opacity-30"
          aria-label="Día siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-2.5 text-center">
          <p className="text-sm font-black text-sky-300 tabular-nums" data-testid="mapa-km-total">
            {kmTotal.toFixed(1)} km
          </p>
          <p className="text-[10px] text-sky-500/80">km reales GPS</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-center">
          <p className="text-sm font-black text-slate-200 tabular-nums">{formatearDuracion(segTotal)}</p>
          <p className="text-[10px] text-slate-400">manejando</p>
        </div>
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-center">
          <p className="text-sm font-black text-emerald-400 tabular-nums" data-testid="mapa-por-km">
            {kmTotal > 0 ? `S/ ${solesPorKm.toFixed(2)}` : '—'}
          </p>
          <p className="text-[10px] text-emerald-500/80">por km grabado</p>
        </div>
      </div>

      {/* El mapa — aislado (isolate) para que sus capas no se metan
          con la navegación de abajo, como en RiderTrack */}
      <div className="relative isolate overflow-hidden rounded-2xl border border-slate-700 shadow-xl">
        <div ref={contenedorRef} className="h-[340px] w-full" data-testid="mapa-hoja" />

        {/* Botón 🎨 estilo: Oscuro → Claro → Satélite (muestra el actual) */}
        <button
          onClick={() =>
            setEstilo(e => ORDEN_ESTILOS[(ORDEN_ESTILOS.indexOf(e) + 1) % ORDEN_ESTILOS.length])
          }
          className="absolute right-2 top-2 z-[500] flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900/90 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 shadow"
          title="Cambiar el estilo del mapa (oscuro / claro / satélite)"
          data-testid="boton-estilo-mapa"
        >
          <Palette size={12} /> {nombreEstilo}
        </button>

        {/* Leyenda flotante DENTRO del mapa (estilo RiderTrack) */}
        {(conRuta.length > 0 || grabando) && (
          <div
            className="absolute left-2 top-2 z-[500] flex flex-col gap-1 rounded-xl border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-[10px] font-bold text-slate-300 backdrop-blur-md"
            data-testid="mapa-leyenda"
          >
            {Object.entries(COLOR_ORIGEN).map(([o, color]) => {
              const hay = delDia.some(v => v.origen === o && v.ruta && v.ruta.length >= 2);
              if (!hay && !(grabando && viajeVivo?.origen === o)) return null;
              return (
                <span key={o} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-white/60"
                    style={{ background: color }}
                  />
                  {nombreOrigen(o as OrigenViaje)}
                </span>
              );
            })}
            {grabando && (
              <span className="flex items-center gap-1.5 text-sky-300">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/60"
                  style={{ background: colorVivo }}
                />
                grabando ahora
              </span>
            )}
            {conRuta.length > 0 && (
              <>
                <span className="mt-0.5 flex items-center gap-1.5 text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-full border border-white/60 bg-emerald-500" /> arranque
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-full border border-white/60 bg-rose-500" /> llegada
                </span>
              </>
            )}
          </div>
        )}

        {/* F-ID3.2: 🛵 SEGUIRME — la cámara persigue a la moto
            mientras grabás (estilo Circuit / RiderTrack) */}
        {grabando && (
          <button
            onClick={alternarSeguimiento}
            className={`absolute bottom-4 left-3 z-[500] flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-95 ${
              siguiendo
                ? 'animate-pulse border-emerald-400 bg-emerald-600 hover:bg-emerald-500'
                : 'border-slate-700 bg-slate-900/90 hover:bg-slate-800'
            }`}
            title={siguiendo ? 'Siguiéndote — arrastrá el mapa para soltar' : 'El mapa te sigue mientras manejás'}
            data-testid="boton-seguirme"
          >
            <LocateFixed size={14} />
            {siguiendo ? 'Siguiéndote' : 'Seguirme'}
          </button>
        )}

        <p className="pointer-events-none absolute bottom-1 left-2 z-[500] rounded bg-slate-950/60 px-1.5 text-[8px] text-slate-300">
          {TILES[estilo].atribucion}
        </p>
      </div>

      {/* Estado vacío */}
      {conRuta.length === 0 && conCoordenadas.length === 0 && !grabando ? (
        <div
          className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/30 p-6 text-center"
          data-testid="mapa-vacio"
        >
          <p className="text-sm text-slate-400">
            {sinGPS.length === 0
              ? 'Todavía no hay viajes este día'
              : 'Todavía no grabaste rutas este día'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {sinGPS.length > 0 &&
              `Apretá el botón 📍 azul de un viaje en la lista y tus km aparecen acá dibujados`}
          </p>
        </div>
      ) : (
        sinGPS.length > 0 && (
          <p
            className="truncate px-1 text-[10px] text-slate-500"
            title={sinGPS.map(v => v.cliente || 'cliente').join(', ')}
            data-testid="mapa-sin-gps"
          >
            🚫 sin GPS ({sinGPS.length}): {sinGPS.map(v => v.cliente || 'cliente').join(', ')}
          </p>
        )
      )}
    </div>
  );
}
