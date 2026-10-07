// ═══════════════════════════════════════════════════════════
// 🛣️ FASE H: RutaModal — TODO lo de la RUTA de un viaje agrupado
// en UN solo modal (pedido de Rudy, siguiendo al ContactoModal:
// "ahora lo que es la ruta también vamos a agruparlo en un modal").
//
// Adentro vive todo lo que "va al lugar" de un viaje:
//   🅰️ Recojo (A):  🧭 Navegar (Waze/Google) · 📋 Copiar dirección
//   📍 Entrega (B): 🧭 Navegar · 📋 Copiar
//   📍 GPS: grabar los km del viaje / detener (en vivo) / lo grabado
//   🛣️ los km A→B calculados (si no hay GPS real todavía)
//
// La tarjeta queda con UN solo botón 🛣️ Ruta (antes: A + B + GPS).
// Patrón visual del ContactoModal (FASE G): hoja de abajo, blur, pop.
// ═══════════════════════════════════════════════════════════
import { Fragment, useState } from 'react';
import { Check, Copy, Navigation, Route, Square, X } from 'lucide-react';
import type { Viaje } from '../types';
import { vibrar } from '../utils';
import { abrirNavegacion, tieneDestino } from '../services/navegacion';
import { formatearDuracion } from '../services/gps';
import NavegarMenu from './NavegarMenu';

// 📋 copiar con respaldo (WebViews de Android sin clipboard API)
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* sigue al plan B */
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

interface Props {
  viaje: Viaje;
  onCerrar: () => void;
  /** ¿se está grabando el GPS de ESTE viaje? (punto verde en vivo) */
  grabando?: boolean;
  onIniciarGPS?: () => void;
  onDetenerGPS?: () => void;
}

/** Un bloque de dirección: la dirección a la vista + Navegar y Copiar */
function BloqueDireccion({
  emoji,
  titulo,
  direccion,
  destino,
  color,
  testid,
  onNavegar,
}: {
  emoji: string;
  titulo: string;
  direccion: string;
  destino: { lat?: number; lng?: number; direccion?: string };
  color: 'amber' | 'sky' | 'violet';
  testid: string;
  onNavegar: (destino: { lat?: number; lng?: number; direccion?: string }) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const puedeNavegar = tieneDestino(destino);
  const colores =
    color === 'amber'
      ? {
          borde: 'border-amber-500/30',
          chip: 'text-amber-300',
          nav: 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
        }
      : color === 'violet'
        ? {
            // FASE M: las PARADAS del multi-punto (C, D, E)
            borde: 'border-violet-500/30',
            chip: 'text-violet-300',
            nav: 'border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25',
          }
        : {
            borde: 'border-sky-500/30',
            chip: 'text-sky-300',
            nav: 'border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25',
          };

  async function copiar() {
    const ok = await copiarTexto(direccion.trim());
    if (ok) {
      setCopiado(true);
      vibrar(40);
      setTimeout(() => setCopiado(false), 1600);
    }
  }

  return (
    <div className={`rounded-xl border ${colores.borde} bg-slate-800/60 p-3`} data-testid={testid}>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {emoji} {titulo}
      </p>
      <p className="mt-0.5 text-sm font-bold leading-snug text-slate-100" title={direccion}>
        {direccion.trim() || '—'}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => puedeNavegar && onNavegar(destino)}
          disabled={!puedeNavegar}
          className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[12px] font-black transition-all active:scale-[0.97] disabled:opacity-40 ${colores.nav}`}
          aria-label={`Navegar a ${titulo}`}
          data-testid={`${testid}-navegar`}
        >
          <Navigation size={15} /> Navegar
        </button>
        <button
          onClick={copiar}
          disabled={!direccion.trim()}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-700/40 py-2.5 text-[12px] font-black text-slate-200 transition-all active:scale-[0.97] hover:bg-slate-700/70 disabled:opacity-40"
          aria-label={`Copiar la dirección de ${titulo}`}
          data-testid={`${testid}-copiar`}
        >
          {copiado ? (
            <>
              <Check size={15} className="text-emerald-400" /> Copiada
            </>
          ) : (
            <>
              <Copy size={15} /> Copiar
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function RutaModal({ viaje, onCerrar, grabando = false, onIniciarGPS, onDetenerGPS }: Props) {
  const dirA = (viaje.dirA ?? '').trim();
  const dirB = (viaje.direccion ?? '').trim();
  const destinoA = viaje.coordenadasA ?? { direccion: dirA };
  const destinoB = viaje.coordenadas ?? { direccion: dirB };
  // FASE M: las PARADAS del multi-punto (C, D, E) — se navegan por
  // dirección de texto (los pines del mapa son solo de A y B)
  const paradas = (viaje.paradas ?? []).map(p => p.trim()).filter(Boolean).slice(0, 3);

  // mini-selector Waze/Google cuando la preferencia es "Preguntar"
  const [navPara, setNavPara] = useState<'a' | 'b' | number | null>(null);

  function navegar(destino: { lat?: number; lng?: number; direccion?: string }, cual: 'a' | 'b' | number) {
    if (!tieneDestino(destino)) return;
    if (!abrirNavegacion(destino)) setNavPara(cual);
  }

  return (
    <>
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
      data-testid="modal-ruta"
    >
      <div
        className="dt-anim-pop w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* encabezado */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-black text-slate-100">
              <Route size={16} className="text-indigo-300" /> Ruta del viaje
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {viaje.cliente || viaje.zona || 'recojo y entrega'} — navegá, copiá la dirección o grabá los km
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
            data-testid="ruta-cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* 🛣️ los km que ya se saben: GPS real > estimado A→B */}
        {viaje.kmGPS > 0 ? (
          <p
            className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-bold text-sky-300"
            data-testid="ruta-km-reales"
          >
            📍 {viaje.kmGPS.toFixed(1)} km reales · {formatearDuracion(viaje.duracionSeg)}
          </p>
        ) : viaje.kmEstimado != null && viaje.kmEstimado > 0 ? (
          <p
            className="mt-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-bold text-indigo-300"
            title="Distancia A → B calculada con los pines del mapa (Google por calles, o estimado sin conexión)"
            data-testid="ruta-km-estimado"
          >
            🛣️ A→B ~{viaje.kmEstimado.toFixed(1)} km{viaje.minEstimados ? ` · ~${viaje.minEstimados} min` : ''}
          </p>
        ) : null}

        {/* los bloques de dirección */}
        <div className="mt-3 space-y-2">
          {dirA && (
            <BloqueDireccion
              emoji="🅰️"
              titulo="Recojo (A)"
              direccion={dirA}
              destino={destinoA}
              color="amber"
              testid="ruta-bloque-a"
              onNavegar={d => navegar(d, 'a')}
            />
          )}
          <BloqueDireccion
            emoji="📍"
            titulo={dirA ? 'Entrega (B)' : 'Entrega'}
            direccion={dirB}
            destino={destinoB}
            color="sky"
            testid="ruta-bloque-b"
            onNavegar={d => navegar(d, 'b')}
          />
          {/* FASE M: 🅾️ las PARADAS del multi-punto — un bloque por
              entrega extra, en orden de ruta (C, D, E) */}
          {paradas.map((p, i) => (
            <Fragment key={`parada-${i}`}>
              <BloqueDireccion
                emoji="🅾️"
                titulo={`Parada (${String.fromCharCode(67 + i)})`}
                direccion={p}
                destino={{ direccion: p }}
                color="violet"
                testid={`ruta-bloque-c${i}`}
                onNavegar={d => navegar(d, i)}
              />
            </Fragment>
          ))}
        </div>

        {/* 📍 GPS: grabar los km del viaje */}
        {(onIniciarGPS || onDetenerGPS) && (
          <div className="mt-2">
            {grabando && onDetenerGPS ? (
              <button
                onClick={() => {
                  onDetenerGPS();
                  vibrar(90);
                }}
                className="relative flex w-full items-center gap-3 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-3 py-3 text-left text-emerald-300 transition-all active:scale-[0.99] hover:bg-emerald-500/25"
                data-testid="ruta-gps-detener"
              >
                <span className="absolute right-3 top-3 h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                <Square size={20} className="shrink-0" fill="currentColor" />
                <span className="min-w-0">
                  <span className="block text-xs font-black">■ Detener la grabación</span>
                  <span className="block text-[10px] font-medium opacity-70">
                    los km y el tiempo quedan guardados en este viaje
                  </span>
                </span>
              </button>
            ) : onIniciarGPS ? (
              <button
                onClick={() => {
                  onIniciarGPS();
                  onCerrar();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-3 text-left text-sky-300 transition-all active:scale-[0.99] hover:bg-sky-500/20"
                data-testid="ruta-gps-iniciar"
              >
                <Navigation size={20} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-black">📍 Grabar los km con GPS</span>
                  <span className="block text-[10px] font-medium opacity-70">
                    arrancás, manejás, y al llegar quedan los km reales
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>

    {/* mini-selector Waze / Google Maps del punto elegido —
        HERMANO del overlay (adentro el click burbujearía y
        cerraría los dos modales de un solo toque) */}
    {navPara === 'a' && dirA && (
      <NavegarMenu destino={destinoA} etiqueta={dirA} onCerrar={() => setNavPara(null)} />
    )}
    {navPara === 'b' && (
      <NavegarMenu destino={destinoB} etiqueta={dirB} onCerrar={() => setNavPara(null)} />
    )}
    {typeof navPara === 'number' && paradas[navPara] && (
      <NavegarMenu
        destino={{ direccion: paradas[navPara] }}
        etiqueta={paradas[navPara]}
        onCerrar={() => setNavPara(null)}
      />
    )}
    </>
  );
}
