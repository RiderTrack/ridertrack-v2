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
  detalleLugarGoogle,
  iniciarSesionAutocomplete,
  DireccionSugerida,
} from '../services/geocoding';
import { getGoogleApiKey } from '../services/googleMaps';

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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  // Sesión de Places: agrupa autocomplete + detalle (facturación)
  const sesionRef = useRef<string>(iniciarSesionAutocomplete());

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

  /** Elegir una sugerencia: si es de Google trae placeId → se piden
   *  sus coordenadas exactas (Place Details, misma sesión) */
  const elegir = useCallback(
    async (s: DireccionSugerida) => {
      setAbierto(false);
      setError('');

      // Sugerencia de Google: pedir coordenadas con Place Details
      if (s.placeId) {
        setDetalleCargando(true);
        try {
          const detalle = await detalleLugarGoogle(s.placeId, sesionRef.current);
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
          setError('No se pudieron obtener las coordenadas — inténtalo de nuevo');
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
              onFocus={() => sugerencias.length > 0 && setAbierto(true)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none min-w-0"
              autoCapitalize="sentences"
              autoCorrect="off"
            />
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

          {/* Error / sin resultados */}
          {error && !abierto && (
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
                  className="w-full text-left px-3 py-2.5 hover:bg-indigo-500/10 border-b border-slate-800/60 last:border-0 transition-colors flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
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
                </button>
              ))}
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
