// ═══════════════════════════════════════════════════════════
// 🔍 ADDRESS AUTOCOMPLETE - RiderTrack V2 (Fase 2.0)
// Buscador de direcciones con autocompletado — estilo Circuit:
// escribes "av sucre" y aparecen candidatos con su distrito:
//   "Avenida Sucre — San Miguel"
//   "Avenida Sucre — Bellavista"
//   ...
// Seleccionas uno y queda guardado con coordenadas exactas.
//
// Motor (Fase 2.0): GOOGLE PLACES AUTOCOMPLETE (New) — el mismo
// que usa Circuit, con sesiones agrupadas (autocomplete +
// detalle = 1 sesión). Si Google no responde, respaldo gratis
// con Nominatim (OpenStreetMap).
//
// Debounce de 450ms y mínimo 3 caracteres.
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2, X, CheckCircle2, Navigation } from 'lucide-react';
import {
  buscarDirecciones,
  resolverDireccionElegida,
  iniciarSesionAutocomplete,
  DireccionSugerida,
} from '../services/geocoding';
import { getGoogleApiKey } from '../services/googleMaps';
import { detectarCoordenadas } from '../utils/direcciones';
import { ClipboardPaste, Crosshair } from 'lucide-react';

export interface DireccionElegida {
  nombre: string;      // etiqueta completa "Avenida Sucre 523, San Miguel"
  distrito?: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  /** Etiqueta del campo (ej: "Dirección de inicio") */
  label: string;
  /** Placeholder del input */
  placeholder?: string;
  /** Valor ya guardado (se muestra como chip), si existe */
  valorGuardado?: DireccionElegida | null;
  /** Cuando el usuario elige una dirección del buscador */
  onElegir: (d: DireccionElegida) => void;
  /** Cuando el usuario limpia el valor guardado */
  onLimpiar?: () => void;
  /** Icono a la izquierda */
  icono?: 'inicio' | 'fin' | 'cliente';
  /** Texto de ayuda bajo el campo */
  ayuda?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  label,
  placeholder = 'Escribe una dirección o avenida…',
  valorGuardado,
  onElegir,
  onLimpiar,
  icono = 'inicio',
  ayuda,
}) => {
  const [texto, setTexto] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [sugerencias, setSugerencias] = useState<DireccionSugerida[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const [detalleCargando, setDetalleCargando] = useState(false);
  /** ¿Las sugerencias vienen de Google Places? (para el badge) */
  const [deGoogle, setDeGoogle] = useState(false);
  /** ⚡ F3.49: aviso del pegado desde el portapapeles */
  const [avisoPegado, setAvisoPegado] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  // Sesión de Places: agrupa autocomplete + detalle (facturación)
  const sesionRef = useRef<string>(iniciarSesionAutocomplete());
  // Fase 2.1: si el usuario da Enter mientras la búsqueda está en
  // vuelo, al llegar las sugerencias se elige la 1ª automáticamente
  const autoElegirRef = useRef(false);
  // Ref siempre fresca a `elegir` (evita closures obsoletas al
  // auto-elegir desde el debounce, que corre render atrás)
  const elegirRef = useRef<(s: DireccionSugerida) => void>(() => {});

  /** ⚡ F3.49 — Detección INSTANTÁNEA de coordenadas en lo escrito:
   *  si pegaste "-11.988690,-77.078981" o un link de Google Maps,
   *  se muestra el aviso verde al toque (sin esperar al buscador)
   *  y Enter elige el punto EXACTO, no una búsqueda difusa. */
  const coordsDetectadas = texto.trim().length >= 3 ? detectarCoordenadas(texto) : null;

  /** ⚡ F3.49 — Botón 📋 pegar: lee el portapapeles directo al campo
   *  (dirección copiada de Circuit/Excel/WhatsApp, o coordenadas). */
  const pegarDesdePortapapeles = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      const limpio = (clip || '').trim();
      if (!limpio) {
        setAvisoPegado('El portapapeles está vacío');
        setTimeout(() => setAvisoPegado(''), 2500);
        return;
      }
      setTexto(limpio);
      setAvisoPegado('📋 Pegado — busca o dale Enter');
      setTimeout(() => setAvisoPegado(''), 2500);
    } catch {
      setAvisoPegado('Tu sistema no dejó leer el portapapeles — pega con toque largo ✋');
      setTimeout(() => setAvisoPegado(''), 3500);
    }
  };

  // Cerrar sugerencias al tocar fuera
  useEffect(() => {
    const clicFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', clicFuera);
    return () => document.removeEventListener('mousedown', clicFuera);
  }, []);

  // Búsqueda con debounce (450ms) — mínimo 3 caracteres
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const t = texto.trim();

    if (t.length < 3) {
      setSugerencias([]);
      setBuscando(false);
      setError('');
      return;
    }

    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await buscarDirecciones(t, 6, sesionRef.current);
        setSugerencias(res);
        setDeGoogle(res.length > 0 && res[0].origen === 'google');
        setAbierto(true);
        setError(
          res.length === 0
            ? 'Sin resultados — prueba con el nombre de la avenida o el distrito'
            : ''
        );
        // Fase 2.1: Enter durante la búsqueda → elegir la 1ª al llegar
        if (autoElegirRef.current) {
          autoElegirRef.current = false;
          if (res.length > 0) {
            elegirRef.current(res[0]);
          }
        }
      } catch {
        setError('No se pudo buscar — revisa tu conexión');
        setSugerencias([]);
      } finally {
        setBuscando(false);
      }
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [texto]);

  /** Elegir una sugerencia: con placeId de Google se resuelven sus
   *  coordenadas con reintentos y fallback (Fase 2.1 — antes un
   *  golpe de red lenta dejaba "No se pudieron obtener las
   *  coordenadas" y el campo sin guardar) */
  const elegir = useCallback(
    async (s: DireccionSugerida) => {
      setAbierto(false);
      setError('');

      // Sugerencia de Google: pedir coordenadas (Place Details +
      // reintento + geocodificación del texto como respaldo)
      if (s.placeId) {
        setDetalleCargando(true);
        try {
          const detalle = await resolverDireccionElegida(s, sesionRef.current);
          // Nueva sesión para la próxima búsqueda (la actual ya cerró)
          sesionRef.current = iniciarSesionAutocomplete();
          if (detalle) {
            onElegir({
              nombre: detalle.direccion || `${s.etiqueta}, ${s.detalle}`,
              distrito: s.distrito || detalle.distrito,
              lat: detalle.lat,
              lng: detalle.lng,
            });
            setTexto('');
            setSugerencias([]);
            return;
          }
          setError('Tu conexión está muy lenta — vuelve a intentar elegir la dirección');
          setAbierto(true);
          return;
        } finally {
          setDetalleCargando(false);
        }
      }

      // Sugerencia de Nominatim: ya trae coordenadas
      const nombreCompleto = s.detalle ? `${s.etiqueta}, ${s.detalle}` : s.etiqueta;
      onElegir({ nombre: nombreCompleto, distrito: s.distrito, lat: s.lat, lng: s.lng });
      setTexto('');
      setSugerencias([]);
    },
    [onElegir]
  );

  // Mantener la ref fresca en cada render
  useEffect(() => {
    elegirRef.current = elegir;
  }, [elegir]);

  /** Fase 2.1 — Enter en el campo: elige la 1ª sugerencia, o espera
   *  a que termine la búsqueda y elige, o geocodifica el texto crudo.
   *  Antes Enter no hacía NADA y el usuario perdía el tiempo. */
  const manejarEnter = async () => {
    const t = texto.trim();
    if (!t || detalleCargando) return;

    // ¿Hay sugerencias a la vista? → elegir la primera (la más relevante)
    if (abierto && sugerencias.length > 0) {
      elegir(sugerencias[0]);
      return;
    }

    // ¿La búsqueda está en vuelo (debounce)? → que elija al llegar
    if (buscando) {
      autoElegirRef.current = true;
      return;
    }

    // Sin sugerencias: geocodificar el texto tal cual (Google → Nominatim)
    setDetalleCargando(true);
    setError('');
    try {
      const detalle = await resolverDireccionElegida({
        etiqueta: t,
        detalle: '',
        distrito: undefined,
        lat: 0,
        lng: 0,
      });
      if (detalle) {
        onElegir({
          nombre: detalle.direccion || t,
          distrito: detalle.distrito,
          lat: detalle.lat,
          lng: detalle.lng,
        });
        setTexto('');
        setSugerencias([]);
        return;
      }
      setError('No se pudo ubicar "' + t + '" — escribe avenida + número + distrito, o elige una opción de la lista');
    } finally {
      setDetalleCargando(false);
    }
  };

  const iconoIzq =
    icono === 'inicio' ? <Navigation className="w-4 h-4 text-emerald-400" />
    : icono === 'fin' ? <MapPin className="w-4 h-4 text-rose-400" />
    : <MapPin className="w-4 h-4 text-indigo-400" />;

  const usaGoogle = !!getGoogleApiKey();

  return (
    <div ref={contenedorRef} className="relative">
      <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
        {iconoIzq} {label}
      </label>

      {/* Valor ya guardado: chip con check + botón quitar */}
      {valorGuardado ? (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-300 truncate">{valorGuardado.nombre}</p>
            {valorGuardado.distrito && (
              <p className="text-[10px] text-emerald-400/70">Distrito: {valorGuardado.distrito}</p>
            )}
          </div>
          {onLimpiar && (
            <button
              onClick={onLimpiar}
              className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-all"
              title="Quitar esta dirección"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Input de búsqueda */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus-within:border-indigo-500 transition-colors">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  manejarEnter();
                }
              }}
              onFocus={() => sugerencias.length > 0 && setAbierto(true)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none min-w-0"
              autoCapitalize="sentences"
              autoCorrect="off"
            />
            {/* ⚡ F3.49 — botón 📋 pegar (dirección o coordenadas del
                portapapeles — copiada de Circuit, Excel, WhatsApp…) */}
            {!buscando && !detalleCargando && (
              <button
                onClick={pegarDesdePortapapeles}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-all shrink-0"
                title="Pegar desde el portapapeles (dirección o coordenadas)"
                aria-label="Pegar desde el portapapeles"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
              </button>
            )}
            {(buscando || detalleCargando) && (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
            )}
            {!buscando && !detalleCargando && texto && (
              <button
                onClick={() => {
                  setTexto('');
                  setSugerencias([]);
                  setAbierto(false);
                }}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ⚡ F3.49 — Coordenadas exactas detectadas al toque: el pin
              caerá EXACTO ahí (geocodificación inversa solo para la
              etiqueta). Antes este texto iba a búsqueda difusa y el
              punto salía en OTRO distrito. */}
          {coordsDetectadas && !abierto && (
            <div className="mt-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-[10px] font-bold text-emerald-300 leading-tight">
                📍 Coordenadas exactas detectadas — Enter o la 1ª opción pone el pin AHÍ MISMO
                <span className="text-emerald-400/80 font-normal">
                  {' '}(lat {coordsDetectadas.lat.toFixed(6)}, lng {coordsDetectadas.lng.toFixed(6)})
                </span>
              </p>
            </div>
          )}

          {/* ⚡ F3.49 — aviso del pegado (éxito o bloqueo del sistema) */}
          {avisoPegado && !coordsDetectadas && (
            <p className="text-[10px] text-indigo-300/90 mt-1">{avisoPegado}</p>
          )}

          {/* Error / sin resultados */}
          {error && !abierto && !coordsDetectadas && (
            <p className="text-[10px] text-amber-400/80 mt-1">{error}</p>
          )}

          {/* Lista de sugerencias con distrito */}
          {abierto && sugerencias.length > 0 && (
            <div className="absolute z-[700] left-0 right-0 mt-1 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
              {deGoogle && usaGoogle && (
                <div className="px-3 py-1.5 bg-slate-800/80 border-b border-slate-700 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500 border border-white/40" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                    Google Places — como Circuit
                  </span>
                </div>
              )}
              {sugerencias.map((s, i) => (
                <button
                  key={`${s.lat}-${s.lng}-${s.placeId || ''}-${i}`}
                  onClick={() => elegir(s)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-indigo-500/10 border-b border-slate-800/60 last:border-0 transition-colors flex items-start gap-2 ${
                    i === 0 ? 'bg-indigo-500/5' : ''
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{s.etiqueta}</p>
                    {s.distrito && (
                      <p className="text-[10px] text-emerald-400/90 truncate">
                        📍 {s.distrito}
                        {s.detalle && s.detalle !== s.distrito ? ` · ${s.detalle}` : ''}
                      </p>
                    )}
                    {!s.distrito && s.detalle && (
                      <p className="text-[10px] text-slate-400 truncate">{s.detalle}</p>
                    )}
                  </div>
                  {i === 0 && (
                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                      ⏎ Enter
                    </span>
                  )}
                </button>
              ))}
              <div className="px-3 py-1.5 bg-slate-900/80 border-t border-slate-800 text-[9px] text-slate-500 text-center">
                Toca una opción o presiona Enter para elegir la primera
              </div>
            </div>
          )}

          {ayuda && !abierto && sugerencias.length === 0 && (
            <p className="text-[10px] text-slate-500 mt-1">{ayuda}</p>
          )}
        </>
      )}
    </div>
  );
};
