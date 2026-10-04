// ═══════════════════════════════════════════════════════════
// 💾 DriverTrack — Persistencia local (localStorage) + helpers
// Local-first: los datos viven en el teléfono. Backup JSON en Ajustes.
// ═══════════════════════════════════════════════════════════

import { ConfigDT, Gasto, ResumenDia, TIPOS_GASTO, TipoGasto, Viaje } from './types';

const K_VIAJES = 'dt_viajes_v1';
const K_CONFIG = 'dt_config_v1';
const K_GASTOS = 'dt_gastos_v1'; // F-ID6: 💸 gastos que descuentan del neto
const K_META_FECHA = 'dt_meta_celebrada_fecha';

export const CONFIG_DEFECTO: ConfigDT = {
  metaDiaria: 100,
  comisiones: { indrive: 10, rappi: 25, pedidosya: 25, directo: 0 },
  yape: { numero: '', titular: '', qrBase64: '' },
  plin: { numero: '', titular: '', qrBase64: '' },
  geminiKey: '',
  claudeKey: '',
  miNombre: '',
  miCelular: '',
  robotActivo: false,
  robotUrl: 'http://127.0.0.1:3001',
  robotToken: 'rudy-drivertrack',
};

export function fechaHoy(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function horaAhora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fechaBonita(f: string): string {
  const [y, m, d] = f.split('-').map(Number);
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const dt = new Date(y, m - 1, d);
  return `${dias[dt.getDay()]} ${d} ${meses[m - 1]}`;
}

export function cargarViajes(): Viaje[] {
  try {
    const raw = localStorage.getItem(K_VIAJES);
    if (!raw) return [];
    const lista = JSON.parse(raw) as Partial<Viaje>[];
    // F-ID2.5/2.6: los viajes guardados antes no tienen
    // direccion/celular/yape → se completan vacíos para que no rompan nada
    // F-ID3: ídem con kmGPS/duracionSeg (los viejos no se grabaron con GPS)
    return lista.map(v => ({
      ...v,
      direccion: v.direccion ?? '',
      celular: v.celular ?? '',
      yapeNombre: v.yapeNombre ?? '',
      yapeNumero: v.yapeNumero ?? '',
      kmGPS: v.kmGPS ?? 0,
      duracionSeg: v.duracionSeg ?? 0,
    })) as Viaje[];
  } catch {
    return [];
  }
}

export function guardarViajes(v: Viaje[]): void {
  try {
    localStorage.setItem(K_VIAJES, JSON.stringify(v));
  } catch {
    // F-ID3: las RUTAS GPS (los trazados para el mapa) son lo más
    // pesado. Si el localStorage se llena, se sueltan las rutas de
    // los viajes MÁS VIEJOS (los km numéricos quedan, solo se
    // pierde el dibujo) y se reintenta.
    try {
      const alivianados = v.map((x, i) => (i < v.length / 2 ? { ...x, ruta: undefined } : x));
      localStorage.setItem(K_VIAJES, JSON.stringify(alivianados));
    } catch {
      // último recurso: sin rutas en absoluto, los números nunca se pierden
      try {
        localStorage.setItem(K_VIAJES, JSON.stringify(v.map(x => ({ ...x, ruta: undefined }))));
      } catch {
        /* sin espacio ni para eso: no hay mucho más que hacer */
      }
    }
  }
}

/** F-ID2.5: completa defaults y MIGRA la key de Claude si quedó pegada en el campo de Gemini. */
export function normalizarConfig(c: Partial<ConfigDT>): ConfigDT {
  // El campo geminiKey nació como "la key de IA que sea": si el usuario
  // pegó ahí su token de Claude (sk-ant-…), se pasa a su propio campo
  let geminiKey = (c.geminiKey ?? '').trim();
  let claudeKey = (c.claudeKey ?? '').trim();
  if (geminiKey.startsWith('sk-ant-') && !claudeKey) {
    claudeKey = geminiKey;
    geminiKey = '';
  }
  return {
    ...CONFIG_DEFECTO,
    ...c,
    geminiKey,
    claudeKey,
    comisiones: { ...CONFIG_DEFECTO.comisiones, ...(c.comisiones ?? {}) },
    yape: { ...CONFIG_DEFECTO.yape, ...(c.yape ?? {}) },
    plin: { ...CONFIG_DEFECTO.plin, ...(c.plin ?? {}) },
    miNombre: (c.miNombre ?? '').trim(),
    miCelular: (c.miCelular ?? '').trim(),
    robotActivo: c.robotActivo === true,
    robotUrl: (c.robotUrl ?? '').trim() || 'http://127.0.0.1:3001',
    robotToken: (c.robotToken ?? '').trim() || 'rudy-drivertrack',
  };
}

export function cargarConfig(): ConfigDT {
  try {
    const raw = localStorage.getItem(K_CONFIG);
    if (!raw) return { ...CONFIG_DEFECTO };
    const c = JSON.parse(raw) as Partial<ConfigDT>;
    const normalizada = normalizarConfig(c);
    // F-ID2.5: si la migración movió el token de Claude de campo (o
    // recortó espacios), se persiste en el ACTO — el storage se
    // autocura solo, sin esperar a que el usuario toque Ajustes
    if (
      normalizada.geminiKey !== (c.geminiKey ?? '').trim() ||
      normalizada.claudeKey !== (c.claudeKey ?? '').trim()
    ) {
      guardarConfig(normalizada);
    }
    return normalizada;
  } catch {
    return { ...CONFIG_DEFECTO };
  }
}

export function guardarConfig(c: ConfigDT): void {
  localStorage.setItem(K_CONFIG, JSON.stringify(c));
}

// ── F-ID6: 💸 Gastos (recargas, gasolina, comida…) ──

export function cargarGastos(): Gasto[] {
  try {
    const raw = localStorage.getItem(K_GASTOS);
    if (!raw) return [];
    const lista = JSON.parse(raw) as Partial<Gasto>[];
    // Migración defensiva: un gasto guardado raro (sin tipo, sin hora)
    // no rompe la Caja — se completa con defaults
    return lista
      .filter(g => g && typeof g.monto === 'number' && g.monto > 0)
      .map(g => ({
        ...g,
        id: g.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fecha: g.fecha ?? fechaHoy(),
        hora: g.hora ?? '',
        tipo: (TIPOS_GASTO.some(t => t.id === g.tipo) ? g.tipo : 'otro') as TipoGasto,
        monto: +Number(g.monto).toFixed(2),
        nota: g.nota ?? '',
      })) as Gasto[];
  } catch {
    return [];
  }
}

export function guardarGastos(g: Gasto[]): void {
  try {
    localStorage.setItem(K_GASTOS, JSON.stringify(g));
  } catch {
    /* si no hay espacio, se pierde el guardado pero no crashea la app */
  }
}

/** F-ID6: cuánto salió del bolsillo en un día (para descontarlo del neto) */
export function totalGastosDia(gastos: Gasto[], fecha: string): number {
  return gastos.filter(g => g.fecha === fecha).reduce((s, g) => s + g.monto, 0);
}

// ── Meta del día: se celebra 1 vez por día (no cada vez que abre la app) ──
export function metaYaCelebrada(): boolean {
  return localStorage.getItem(K_META_FECHA) === fechaHoy();
}
export function marcarMetaCelebrada(): void {
  localStorage.setItem(K_META_FECHA, fechaHoy());
}

// ── Resumen de un día ──
export function resumenDia(viajes: Viaje[], fecha: string): ResumenDia {
  const delDia = viajes.filter(v => v.fecha === fecha);
  const porOrigen = {} as ResumenDia['porOrigen'];
  for (const v of delDia) {
    if (!porOrigen[v.origen]) porOrigen[v.origen] = { n: 0, neto: 0 };
    porOrigen[v.origen].n += 1;
    porOrigen[v.origen].neto += v.neto;
  }
  return {
    n: delDia.length,
    bruto: delDia.reduce((s, v) => s + v.tarifa, 0),
    comision: delDia.reduce((s, v) => s + v.comision, 0),
    neto: delDia.reduce((s, v) => s + v.neto, 0),
    porOrigen,
  };
}

export function fechasConViajes(viajes: Viaje[]): string[] {
  return [...new Set(viajes.map(v => v.fecha))].sort().reverse();
}
