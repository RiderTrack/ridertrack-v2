// ═══════════════════════════════════════════════════════════
// 🔧 MANTENIMIENTO — SERVICIO (Fase 3.36)
// Recordatorios de mantenimiento de la moto basados en los km
// reales del odómetro GPS (Fase 3.35).
//
// DÓNDE VIVE TODO:
//   · Núcleo puro (evaluación km/días) → utils/mantenimientoCore.ts
//   · Estado en el teléfono → localStorage `rt_mant_{uid}`
//     (instantáneo al abrir la app, sobrevive sin internet)
//   · Nube → Firestore usuarios/{uid}.mantenimiento
//     { items: {...}, estados: {...}, historial: [...], at }
//     ⚠️ USA EL DOC usuarios/{uid} QUE YA TIENE REGLAS → NO hay
//     que publicar reglas nuevas ni tocar el bot.
//   · El km ACTUAL no se guarda aquí: se lee del odómetro
//     (statsOdometro) al evaluar → calibración respetada.
//
// Sin motor GPS propio: los mantenimientos solo cambian cuando
// el rider registra o edita. La evaluación (faltan X km) se
// calcula en la UI combinando este store + el del odómetro.
// ═══════════════════════════════════════════════════════════

import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { hoyLocal } from '../utils/odometroCore';
import {
  CATALOGO_DEFAULT,
  MAX_HISTORIAL,
  fusionarEstados,
  fusionarHistorial,
  fusionarItems,
  nuevoItemId,
  ItemMant,
  EstadoItemMant,
  RegistroHistorial,
} from '../utils/mantenimientoCore';

// ── Tipos ─────────────────────────────────────────────────

export interface EstadoMantenimiento {
  /** catálogo: defaults + personalizados + intervalos editados */
  items: Record<string, ItemMant>;
  /** último registro por item */
  estados: Record<string, EstadoItemMant>;
  /** historial de mantenimientos hechos (más reciente primero) */
  historial: RegistroHistorial[];
}

export type CambiosItem = Partial<Pick<ItemMant, 'nombre' | 'icono' | 'intervaloKm' | 'intervaloDias' | 'activo'>>;

// ── Constantes ────────────────────────────────────────────

const EVENTO = 'rt-mant-cambio';

// ── Store módulo-level (mismo patrón del odómetro) ────────

function catalogoPorDefecto(): Record<string, ItemMant> {
  const items: Record<string, ItemMant> = {};
  for (const it of CATALOGO_DEFAULT) items[it.id] = { ...it };
  return items;
}

const ESTADO_INICIAL: EstadoMantenimiento = {
  items: catalogoPorDefecto(),
  estados: {},
  historial: [],
};

let estado: EstadoMantenimiento = { ...ESTADO_INICIAL, items: catalogoPorDefecto() };
let uidActual: string | null = null;
const oyentes = new Set<() => void>();
let snapshotTick = 0;
let snapCache: EstadoMantenimiento | null = null;
let snapTickCache = -1;

function clave(uid: string): string {
  return `rt_mant_${uid}`;
}

function cargarLocal(uid: string): EstadoMantenimiento | null {
  try {
    const raw = localStorage.getItem(clave(uid));
    if (raw) {
      const p = JSON.parse(raw) as EstadoMantenimiento;
      if (p && typeof p === 'object' && p.items && typeof p.items === 'object') {
        return {
          items: fusionarItems(catalogoPorDefecto(), p.items),
          estados: p.estados || {},
          historial: p.historial || [],
        };
      }
    }
  } catch {
    // sin storage o JSON roto
  }
  return null;
}

function persistirLocal() {
  if (!uidActual) return;
  try {
    localStorage.setItem(clave(uidActual), JSON.stringify(estado));
  } catch {
    // sin storage
  }
}

function emitir() {
  snapshotTick++;
  window.dispatchEvent(new CustomEvent(EVENTO));
  oyentes.forEach((fn) => fn());
}

// ── Firestore ────────────────────────────────────────────

async function guardarRemoto(uid: string): Promise<void> {
  if (!uid || !db) return;
  try {
    await setDoc(
      doc(db, 'usuarios', uid),
      {
        mantenimiento: {
          items: estado.items,
          estados: estado.estados,
          historial: estado.historial.slice(0, MAX_HISTORIAL),
          at: Date.now(),
        },
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('⚠️ Mantenimiento: no se pudo guardar en Firestore (queda en el teléfono)', e);
  }
}

/**
 * Arranque: mezcla el local (rápido) con el remoto (verdad
 * histórica) — gana el registro más nuevo por `at`, así dos
 * teléfonos no se pisan entre sí.
 */
async function sincronizarRemoto(uid: string): Promise<void> {
  if (!uid || !db) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return;
    const m = (snap.data() as any)?.mantenimiento;
    if (!m || typeof m !== 'object') return;

    const fusionado: EstadoMantenimiento = {
      items: fusionarItems(estado.items, m.items || {}),
      estados: fusionarEstados(estado.estados, m.estados || {}),
      historial: fusionarHistorial(estado.historial, m.historial || []),
    };
    if (
      JSON.stringify(fusionado.items) !== JSON.stringify(estado.items) ||
      JSON.stringify(fusionado.estados) !== JSON.stringify(estado.estados) ||
      JSON.stringify(fusionado.historial) !== JSON.stringify(estado.historial)
    ) {
      estado = fusionado;
      persistirLocal();
      emitir();
    }
  } catch (e) {
    console.warn('⚠️ Mantenimiento: no se pudo sincronizar desde Firestore', e);
  }
}

// ── API pública ──────────────────────────────────────────

/**
 * Arranca el servicio para este usuario: carga el local al
 * toque y sincroniza con la nube en segundo plano.
 * Devuelve la función para detener (cambio de cuenta).
 */
export function arrancarMantenimiento(uid: string): () => void {
  if (uidActual === uid) return () => undefined; // ya corriendo

  uidActual = uid;
  const local = cargarLocal(uid);
  if (local) {
    estado = local;
    emitir();
  } else {
    estado = { items: catalogoPorDefecto(), estados: {}, historial: [] };
    persistirLocal();
  }
  void sincronizarRemoto(uid);

  return () => undefined; // el store vive mientras la app viva
}

/** Snapshot ESTABLE para useSyncExternalStore */
export function snapshotMantenimiento(): EstadoMantenimiento {
  if (!snapCache || snapTickCache !== snapshotTick) {
    snapCache = {
      items: estado.items,
      estados: estado.estados,
      historial: estado.historial,
    };
    snapTickCache = snapshotTick;
  }
  return snapCache;
}

/** Suscripción a cambios (para useSyncExternalStore) */
export function suscribirMantenimiento(cb: () => void): () => void {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

/** Re-sincroniza desde la nube (botón refrescar del menú) */
export async function recargarMantenimiento(uid: string): Promise<void> {
  await sincronizarRemoto(uid);
}

// ── Registrar un mantenimiento hecho ─────────────────────

export interface DatosRegistro {
  /** km del odómetro al hacerlo (default: el actual total) */
  km: number;
  /** costo en soles (opcional) */
  costo?: number | null;
  /** taller (opcional) */
  taller?: string | null;
  /** notas (opcional) */
  notas?: string | null;
}

/**
 * Registra que se hizo un mantenimiento: guarda el km, la
 * fecha de hoy y lo agrega al historial. Devuelve el registro
 * creado (para el toast "próximo a X km").
 */
export async function registrarMantenimiento(
  uid: string,
  itemId: string,
  datos: DatosRegistro
): Promise<RegistroHistorial> {
  if (!uidActual) arrancarMantenimiento(uid);
  uidActual = uidActual || uid;

  const item = estado.items[itemId];
  const nombre = item?.nombre || itemId;
  const km = Math.max(0, Math.round(datos.km));
  // at estrictamente creciente: dos registros en el mismo ms no
  // se deduplican jamás (y el historial siempre queda ordenado)
  const ultimoAt = estado.historial[0]?.at ?? 0;
  const ahora = Math.max(Date.now(), ultimoAt + 1);

  const registro: RegistroHistorial = {
    id: itemId,
    nombre,
    km,
    fecha: hoyLocal(),
    costo: datos.costo ?? null,
    taller: datos.taller?.trim() || null,
    notas: datos.notas?.trim() || null,
    at: ahora,
  };

  estado = {
    ...estado,
    estados: {
      ...estado.estados,
      [itemId]: { kmUltimo: km, fechaUltima: registro.fecha, at: ahora },
    },
    historial: [registro, ...estado.historial].slice(0, MAX_HISTORIAL),
  };
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
  return registro;
}

// ── Editar items ─────────────────────────────────────────

/** Cambia intervalos / nombre / activo de un item */
export async function ajustarItem(uid: string, itemId: string, cambios: CambiosItem): Promise<void> {
  if (!uidActual) arrancarMantenimiento(uid);
  uidActual = uidActual || uid;

  const item = estado.items[itemId];
  if (!item) return;

  estado = {
    ...estado,
    items: {
      ...estado.items,
      [itemId]: { ...item, ...cambios, at: Date.now() },
    },
  };
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
}

/** Agrega un mantenimiento propio → devuelve el id nuevo */
export async function agregarItem(
  uid: string,
  datos: { nombre: string; icono?: string; intervaloKm?: number | null; intervaloDias?: number | null }
): Promise<string> {
  if (!uidActual) arrancarMantenimiento(uid);
  uidActual = uidActual || uid;

  const nombre = datos.nombre.trim();
  if (!nombre) throw new Error('El nombre no puede estar vacío');

  const id = nuevoItemId();
  const item: ItemMant = {
    id,
    nombre,
    icono: datos.icono?.trim() || '🔧',
    intervaloKm: datos.intervaloKm ?? null,
    intervaloDias: datos.intervaloDias ?? null,
    activo: true,
    at: Date.now(),
  };
  estado = { ...estado, items: { ...estado.items, [id]: item } };
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
  return id;
}

/**
 * Elimina un item PERSONALIZADO de raíz. Los del catálogo
 * prearmado solo se desactivan (activo: false).
 */
export async function eliminarItem(uid: string, itemId: string): Promise<void> {
  if (!uidActual) arrancarMantenimiento(uid);
  uidActual = uidActual || uid;

  const esDelCatalogo = CATALOGO_DEFAULT.some((c) => c.id === itemId);
  const items = { ...estado.items };
  const estados = { ...estado.estados };

  if (esDelCatalogo) {
    if (items[itemId]) items[itemId] = { ...items[itemId], activo: false, at: Date.now() };
  } else {
    delete items[itemId];
    delete estados[itemId];
  }

  estado = { ...estado, items, estados };
  persistirLocal();
  emitir();

  if (!uid || !db) return;
  try {
    await setDoc(
      doc(db, 'usuarios', uid),
      {
        'mantenimiento.items': items,
        'mantenimiento.estados': estados,
        'mantenimiento.at': Date.now(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('⚠️ Mantenimiento: no se pudo eliminar en Firestore', e);
  }
}

// ── Avisos: dedupe de 1 recordatorio por ítem y por día ──
// (lo usa el MotorMantenimiento para no molestar más de una
// vez al día con el mismo ítem)

const CLAVE_AVISO = (uid: string) => `rt_mant_aviso_${uid}`;

/** ¿Ya se avisó hoy de este item? */
export function yaAvisadoHoy(uid: string, itemId: string): boolean {
  try {
    const raw = localStorage.getItem(CLAVE_AVISO(uid));
    if (!raw) return false;
    const mapa = JSON.parse(raw) as Record<string, string>;
    return mapa[itemId] === hoyLocal();
  } catch {
    return false;
  }
}

/** Marca este item como avisado hoy */
export function marcarAvisado(uid: string, itemId: string): void {
  try {
    const raw = localStorage.getItem(CLAVE_AVISO(uid));
    const mapa = raw ? JSON.parse(raw) || {} : {};
    mapa[itemId] = hoyLocal();
    localStorage.setItem(CLAVE_AVISO(uid), JSON.stringify(mapa));
  } catch {
    // sin storage
  }
}
