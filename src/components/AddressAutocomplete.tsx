// ═══════════════════════════════════════════════════════════
// 🔍 ADDRESS AUTOCOMPLETE - RiderTrack V2 (Fase 1.4)
// Buscador de direcciones con autocompletado (estilo Circuit):
// escribes "av sucre" y aparecen candidatos con su distrito:
//   "Avenida Sucre — San Miguel"
//   "Avenida Sucre — Bellavista"
//   ...
// Seleccionas uno y queda guardado con coordenadas exactas.
//
// Motor: Nominatim (OpenStreetMap, gratis) con viewbox de Lima
// Metropolitana + Callao para priorizar resultados locales.
// Debounce de 550ms y mínimo 3 caracteres para no gastar la
// cuota de 1 req/segundo.
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2, X, CheckCircle2, Navigation } from 'lucide-react';
import { buscarDirecciones, DireccionSugerida } from '../services/geocoding';

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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

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

  // Búsqueda con debounce (550ms) — mínimo 3 caracteres
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
        const res = await buscarDirecciones(t, 6);
        setSugerencias(res);
        setAbierto(true);
        setError(res.length === 0 ? 'Sin resultados — prueba con el nombre de la avenida o el distrito' : '');
      } catch {
        setError('No se pudo buscar — revisa tu conexión');
        setSugerencias([]);
      } finally {
        setBuscando(false);
      }
    }, 550);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [texto]);

  const elegir = useCallback(
    (s: DireccionSugerida) => {
      const nombreCompleto = s.detalle ? `${s.etiqueta}, ${s.detalle}` : s.etiqueta;
      onElegir({ nombre: nombreCompleto, distrito: s.distrito, lat: s.lat, lng: s.lng });
      setTexto('');
      setSugerencias([]);
      setAbierto(false);
      setError('');
    },
    [onElegir]
  );

  const iconoIzq =
    icono === 'inicio' ? <Navigation className="w-4 h-4 text-emerald-400" />
    : icono === 'fin' ? <MapPin className="w-4 h-4 text-rose-400" />
    : <MapPin className="w-4 h-4 text-indigo-400" />;

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
            {buscando && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />}
            {!buscando && texto && (
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
              {sugerencias.map((s, i) => (
                <button
                  key={`${s.lat}-${s.lng}-${i}`}
                  onClick={() => elegir(s)}
                  className="w-full text-left px-3 py-2.5 hover:bg-indigo-500/10 border-b border-slate-800/60 last:border-0 transition-colors flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{s.etiqueta}</p>
                    {s.detalle && <p className="text-[10px] text-slate-400 truncate">{s.detalle}</p>}
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
