// ═══════════════════════════════════════════════════════════
// 🚀 useVelocimetro — RiderTrack V2 (Fase 3.36)
// ───────────────────────────────────────────────────────────
// UN solo velocímetro para toda la app:
//   · ⚡ km/h en vivo (doppler del chip GPS; si no, Pitágoras
//     correcto entre fixes) — suavizada EMA, sin saltitos
//   · 🛣️ Odómetro del DÍA (km recorridos acumulados) — se guarda
//     en localStorage y se resetea solo al cambiar de fecha
//     local. Es el "kilometraje" que la v1 contaba bien.
//   · 📍 Posición, rumbo y precisión del fix
//
// Lo usan: GPS del Motorizado (siempre encendido) y el chip
// chiquito de Seguimiento de Ruta (se enciende a mano).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { Coordenadas, vigilarPosicion } from '../services/geocoding';
import type { Fix } from '../utils/velocidad';
import { evaluarFix, fixContable, suavizarRumbo, rumboEntre, capKmh, claveDia } from '../utils/velocidad';

export type EstadoVelocimetro = 'off' | 'buscando' | 'ok' | 'no';

const KEY_ODO = 'rt_odometro_hoy';

interface OdometroDia {
  fecha: string; // YYYY-MM-DD local
  km: number;
}

function leerOdometro(): OdometroDia {
  try {
    const raw = localStorage.getItem(KEY_ODO);
    if (raw) {
      const o = JSON.parse(raw) as OdometroDia;
      // Solo vale si es de HOY — si no, arranca en 0 (reset diario)
      if (o && typeof o.km === 'number' && o.fecha === claveDia()) return { fecha: claveDia(), km: o.km };
    }
  } catch {}
  return { fecha: claveDia(), km: 0 };
}

export interface Velocimetro {
  estado: EstadoVelocimetro;
  posicion: Coordenadas | null;
  /** km/h suavizada, lista para mostrar */
  kmh: number;
  /** km recorridos HOY (odómetro, sobrevive recargas y vistas) */
  kmHoy: number;
  rumbo: number | null;
  /** precisión del último fix (m) — menor = mejor */
  precision: number | null;
  /** ¿el chip GPS entrega velocidad doppler? (info de diagnóstico) */
  usaDoppler: boolean;
  reintentar: () => void;
}

export function useVelocimetro(activar: boolean): Velocimetro {
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<EstadoVelocimetro>(activar ? 'buscando' : 'off');
  const [posicion, setPosicion] = useState<Coordenadas | null>(null);
  const [kmh, setKmh] = useState(0);
  const [kmHoy, setKmHoy] = useState(() => leerOdometro().km);
  const [rumbo, setRumbo] = useState<number | null>(null);
  const [precision, setPrecision] = useState<number | null>(null);
  const [usaDoppler, setUsaDoppler] = useState(false);

  const velRef = useRef(0);
  const prevFixRef = useRef<Fix | null>(null);
  const odoRef = useRef<OdometroDia>(leerOdometro());
  const ultimoGuardoRef = useRef(0);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    if (!activar) {
      setEstado('off');
      setKmh(0);
      velRef.current = 0;
      prevFixRef.current = null;
      return;
    }

    setEstado('buscando');
    // Si el odómetro guardado es de otro día → reset silencioso
    if (odoRef.current.fecha !== claveDia()) {
      odoRef.current = { fecha: claveDia(), km: 0 };
      setKmHoy(0);
    }

    const persistir = () => {
      try {
        localStorage.setItem(KEY_ODO, JSON.stringify(odoRef.current));
        ultimoGuardoRef.current = Date.now();
      } catch {}
    };

    const detener = vigilarPosicion(
      (c) => {
        const fix: Fix = { c, t: c.ts ?? Date.now() };
        const prev = prevFixRef.current;
        prevFixRef.current = fix;

        setPosicion(c);
        setPrecision(typeof c.accuracy === 'number' ? c.accuracy : null);
        setEstado('ok');

        // ⚡ la lectura (doppler o pitágoras + EMA)
        const lect = evaluarFix(prev, fix, velRef.current);
        if (lect.tipo === 'doppler') setUsaDoppler(true);
        velRef.current = capKmh(lect.kmh);
        setKmh(velRef.current);

        // 🧭 rumbo: del chip si lo da, sino del movimiento
        if (typeof c.heading === 'number' && c.heading >= 0 && c.heading < 360) {
          setRumbo((r) => suavizarRumbo(r, c.heading as number));
        } else if (prev && lect.distM >= 3) {
          setRumbo((r) => suavizarRumbo(r, rumboEntre(prev.c, c)));
        }

        // 🛣️ odómetro: solo distancias confiables
        if (fixContable(fix, prev, lect.distM, lect.dt)) {
          odoRef.current.km += lect.distM / 1000;
          setKmHoy(odoRef.current.km);
          if (Date.now() - ultimoGuardoRef.current > 5000) persistir();
        }
      },
      () => setEstado((p) => (p === 'ok' ? 'ok' : 'no'))
    );

    // 🕒 decay: sin fixes por 6 s (túnel / pantalla bloqueada) → apaga suave
    const decay = setInterval(() => {
      const ultimo = prevFixRef.current?.t ?? 0;
      if (Date.now() - ultimo > 6000 && velRef.current > 0.5) {
        velRef.current = Math.max(0, velRef.current * 0.5);
        setKmh(velRef.current);
      }
    }, 2000);

    return () => {
      clearInterval(decay);
      detener();
      persistir();
    };
  }, [activar, intento]);

  return { estado, posicion, kmh, kmHoy, rumbo, precision, usaDoppler, reintentar };
}
