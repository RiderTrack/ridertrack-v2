// ═══════════════════════════════════════════════════════════
// 🤖 CENTRO DEL BOT — Capa de datos (Fase 3.2 · Mudanza ClienteTrack)
// ═══════════════════════════════════════════════════════════
// Migra los módulos PLANTILLAS y AUTOMATIZACIONES de la v1
// (Panel ClienteTrack) a RiderTrack V2.
//
// Fuentes en Firestore (el MISMO proyecto del robot de Baileys):
//
//   sistema/control_bot      → interruptor maestro, IA, horario y
//                              palabras de enojo del bot
//   bot_silenciado           → clientes con el bot callado
//                              (id = 51 + 9 dígitos)
//   registro_bot             → lo que el bot hizo SOLO hoy
//                              (IA / ETA / HANDOFF / MENÚ)
//   plantillas_mensajes      → plantillas de WhatsApp; las que
//                              tienen `clave` las usa el bot
//   sistema/puente_control   → sincronización con el bot
//                              (once / loop 10 min / off)
//
// La app SOLO escribe en Firestore; el robot de Baileys es el
// único que toca WhatsApp (igual que la v1). Cero riesgo extra.
// ═══════════════════════════════════════════════════════════

import {
  collection,
  doc,
  onSnapshot,
  limit,
  query,
  addDoc,
  setDoc,
  deleteDoc,
  getDocs,
  where,
  QuerySnapshot,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../services/firebase';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

/** Documento sistema/control_bot (defaults = los de la v1) */
export interface ControlBot {
  bot_activo: boolean;
  ia_activa: boolean;
  horario_activo: boolean;
  hora_inicio: number;
  hora_fin: number;
  palabras_enojo_extra: string[];
}

/** Cliente silenciado (bot_silenciado) */
export interface SilenciadoBot {
  id: string;
  celular: string;
  motivo: string;
  detalle: string;
  /** true = el bot lo calló por detectar enojo; false = lo silenciaste tú */
  porEnojo: boolean;
  creado_en?: string;
}

/** Entrada del registro del bot (registro_bot) */
export interface RegistroBotItem {
  id: string;
  fecha: string;
  ts: string;
  tipo: string;
  nombre: string;
  detalle: string;
}

/** Plantilla de mensaje (plantillas_mensajes) */
export interface PlantillaMensaje {
  id: string;
  nombre: string;
  categoria: string;
  mensaje: string;
  /** clave del bot (ej: menu_principal) — si existe, el bot la usa */
  clave?: string;
  /** plantilla con clave → conectada al bot */
  activa?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Estado del puente de sincronización (sistema/puente_control) */
export interface PuenteEstado {
  accion: 'once' | 'loop' | 'off' | '';
  expiraEn: number | null;
  ts: number | null;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

/** Categorías de plantillas (mismas de la v1) */
export const CATEGORIAS_PLANTILLA = [
  { id: 'todas', label: 'Todas', icono: '📋' },
  { id: 'saludos', label: 'Saludos', icono: '👋' },
  { id: 'pagos', label: 'Pagos', icono: '💳' },
  { id: 'entrega', label: 'Entrega', icono: '🚚' },
  { id: 'fallidos', label: 'Fallidos', icono: '⚠️' },
  { id: 'personalizado', label: 'Personal', icono: '✨' },
  { id: 'ridertrack', label: 'RiderTrack', icono: '🛵' },
] as const;

export const CATEGORIAS_SELECT: { id: string; label: string }[] = [
  { id: 'saludos', label: '👋 Saludos' },
  { id: 'pagos', label: '💳 Pagos' },
  { id: 'entrega', label: '🚚 Entrega' },
  { id: 'fallidos', label: '⚠️ Fallidos' },
  { id: 'personalizado', label: '✨ Personal' },
  { id: 'ridertrack', label: '🛵 RiderTrack' },
];

/** Variables simples (se reemplazan por datos del cliente) */
export const VARIABLES_PLANTILLA = [
  '{nombre}',
  '{producto}',
  '{monto}',
  '{cobrar}',
  '{direccion}',
  '{distrito}',
  '{telefono}',
  '{minutos_llegada}',
  '{hora}',
  '{fecha}',
] as const;

/** Variables de RUTA EN VIVO (el bot las llena con tu ruta del día) */
export const VARIABLES_RUTA = [
  '{mi_posicion}',
  '{total_ruta}',
  '{faltan_antes}',
  '{entregados_hoy}',
  '{distrito_actual}',
  '{eta_aprox}',
  '{ruta_lista}',
] as const;

/** Bloques condicionales: {sin_x}...{/sin_x} — se ocultan si falta el dato */
export const BLOQUES_CONDICIONALES = [
  'sin_eta',
  'sin_posicion',
  'sin_ruta',
  'sin_producto',
  'sin_cobrar',
  'sin_direccion',
  'sin_motivo',
] as const;

/** Etiquetas del registro del bot (mismas de la v1) */
export const ETIQUETAS_REGISTRO: Record<string, { label: string; clase: string }> = {
  respuesta_ia: { label: 'IA', clase: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  eta_automatico: { label: 'ETA', clase: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  handoff: { label: 'HANDOFF', clase: 'bg-red-500/15 text-red-300 border-red-500/30' },
  menu_ia_off: { label: 'MENÚ', clase: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};

/** Defaults del control del bot (idénticos a la v1) */
export const CONTROL_BOT_DEFAULT: ControlBot = {
  bot_activo: true,
  ia_activa: true,
  horario_activo: false,
  hora_inicio: 7,
  hora_fin: 22,
  palabras_enojo_extra: [],
};

// ─────────────────────────────────────────────────────────────
// CONTROL DEL BOT (sistema/control_bot · automatizaciones)
// ─────────────────────────────────────────────────────────────

/**
 * Escucha en vivo el documento de control del bot.
 * Mismos defaults de lectura que la v1:
 * bot_activo !== false · ia_activa !== false · horario_activo === true
 */
export function escucharControlBot(
  cb: (cfg: ControlBot) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  if (!db) {
    cb(CONTROL_BOT_DEFAULT);
    return () => undefined;
  }
  return onSnapshot(
    doc(db, 'sistema', 'control_bot'),
    (snap) => {
      const d = snap.exists() ? snap.data() || {} : {};
      cb({
        bot_activo: d.bot_activo !== false,
        ia_activa: d.ia_activa !== false,
        horario_activo: d.horario_activo === true,
        hora_inicio: typeof d.hora_inicio === 'number' ? d.hora_inicio : 7,
        hora_fin: typeof d.hora_fin === 'number' ? d.hora_fin : 22,
        palabras_enojo_extra: Array.isArray(d.palabras_enojo_extra) ? d.palabras_enojo_extra : [],
      });
    },
    (err) => onError && onError(err as Error)
  );
}

/** Guarda el control del bot (set merge — igual que la v1) */
export async function guardarControlBot(cfg: ControlBot): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  await setDoc(doc(db, 'sistema', 'control_bot'), cfg, { merge: true });
}

// ─────────────────────────────────────────────────────────────
// SILENCIADOS (bot_silenciado)
// ─────────────────────────────────────────────────────────────

/** Escucha los clientes silenciados (activo !== false, igual que la v1) */
export function escucharSilenciados(
  cb: (lista: SilenciadoBot[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  if (!db) {
    cb([]);
    return () => undefined;
  }
  return onSnapshot(
    collection(db, 'bot_silenciado'),
    (snap: QuerySnapshot<DocumentData>) => {
      const lista: SilenciadoBot[] = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        if (data.activo === false) return;
        lista.push({
          id: d.id,
          celular: String(data.celular || d.id),
          motivo: String(data.motivo || ''),
          detalle: String(data.detalle || ''),
          porEnojo: data.motivo === 'enojo_detectado',
          creado_en: data.creado_en,
        });
      });
      // más recientes primero
      lista.sort((a, b) => String(b.creado_en || '').localeCompare(String(a.creado_en || '')));
      cb(lista);
    },
    (err) => onError && onError(err as Error)
  );
}

/** Reactiva el bot para un cliente (borra el doc — igual que la v1) */
export async function reactivarSilenciado(docId: string): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  await deleteDoc(doc(db, 'bot_silenciado', docId));
}

// ─────────────────────────────────────────────────────────────
// REGISTRO DEL BOT (registro_bot — "qué mandó el bot hoy")
// ─────────────────────────────────────────────────────────────

/** Fecha local YYYY-MM-DD (misma regla que la v1 para `fecha`) */
export function fechaLocalISO(f = new Date()): string {
  const y = f.getFullYear();
  const m = String(f.getMonth() + 1).padStart(2, '0');
  const d = String(f.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Escucha en vivo el registro de hoy del bot.
 * v1: where('fecha','==',hoy).limit(40) + orden por ts desc.
 */
export function escucharRegistroHoy(
  cb: (lista: RegistroBotItem[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  if (!db) {
    cb([]);
    return () => undefined;
  }
  const q = query(
    collection(db, 'registro_bot'),
    where('fecha', '==', fechaLocalISO()),
    limit(40)
  );
  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      const lista: RegistroBotItem[] = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        lista.push({
          id: d.id,
          fecha: String(data.fecha || ''),
          ts: String(data.ts || ''),
          tipo: String(data.tipo || ''),
          nombre: String(data.nombre || 'Cliente'),
          detalle: String(data.detalle || ''),
        });
      });
      lista.sort((a, b) => b.ts.localeCompare(a.ts));
      cb(lista);
    },
    (err) => onError && onError(err as Error)
  );
}

// ─────────────────────────────────────────────────────────────
// PLANTILLAS (plantillas_mensajes)
// ─────────────────────────────────────────────────────────────

/** Escucha todas las plantillas ( igual que la v1: colección completa ) */
export function escucharPlantillas(
  cb: (lista: PlantillaMensaje[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  if (!db) {
    cb([]);
    return () => undefined;
  }
  return onSnapshot(
    collection(db, 'plantillas_mensajes'),
    (snap: QuerySnapshot<DocumentData>) => {
      const lista: PlantillaMensaje[] = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        lista.push({
          id: d.id,
          nombre: String(data.nombre || 'Sin nombre'),
          categoria: String(data.categoria || 'personalizado'),
          mensaje: String(data.mensaje || ''),
          clave: data.clave ? String(data.clave) : undefined,
          activa: data.activa === true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      lista.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      cb(lista);
    },
    (err) => onError && onError(err as Error)
  );
}

/**
 * Crea las 6 plantillas predefinidas de la v1 si la colección
 * está vacía (textos idénticos — el bot ya las conoce).
 */
export async function crearPlantillasPredefinidas(): Promise<number> {
  if (!db) throw new Error('Firestore no disponible');
  const snap = await getDocs(collection(db, 'plantillas_mensajes'));
  if (!snap.empty) return 0;

  const predef: { nombre: string; categoria: string; mensaje: string }[] = [
    {
      nombre: 'Menú Principal',
      categoria: 'saludos',
      mensaje:
        '🌞 ¡Hola, {nombre}! 👋\n\nSoy el asistente de *Rudy Alen*, tu motorizado de *MATE* 🚚\n\n¿En qué te puedo ayudar hoy?\n\n1️⃣ ¿Cuánto debo pagar?\n2️⃣ ¿A qué hora llega mi pedido?\n3️⃣ ¿Qué me están trayendo?\n4️⃣ Número de Yape / QR de pago\n5️⃣ Cuentas bancarias\n6️⃣ Ya realicé mi pago ✅\n7️⃣ Hablar con el motorizado 📞\n8️⃣ No puedo recibir mi pedido hoy 📅\n9️⃣ Problema con mi pedido ⚠️\n\n_Responde con el número de tu consulta_ 😊',
    },
    {
      nombre: 'Cuánto Pagar',
      categoria: 'pagos',
      mensaje:
        '💰 El monto de tu pedido es:\n*S/ {monto}*\n\n📦 Producto:\n> *{producto}*\n\n📲 Puedes pagar por:\n• *Yape / Plin* 📱\n• *Efectivo* 💵\n• *Transferencia* 🏦',
    },
    {
      nombre: 'Aviso de Llegada',
      categoria: 'entrega',
      mensaje:
        '🚚 Hola, *{nombre}* 👋\n\nLe informo que estaré llegando en *15 minutos* ⏱️\n\n📦 Pedido: *{producto}*\n💰 Monto: *S/ {monto}*\n\n📲 Por favor mantenerse atento(a) al teléfono.',
    },
    {
      nombre: 'Entrega Completada',
      categoria: 'entrega',
      mensaje:
        '✅ ¡*{nombre}*, tu pedido fue entregado!\n\n📦 *{producto}*\n💰 Monto cobrado: *S/ {monto}*\n\n¡Muchas gracias por tu preferencia! 🙌',
    },
    {
      nombre: 'No Se Entregó',
      categoria: 'fallidos',
      mensaje:
        '😔 Hola, *{nombre}*\n\nHoy *no pudimos realizar tu entrega* en:\n📍 *{direccion}*, {distrito}\n\nPara *reprogramar* comunícate con *MATE*:\n📞 *956 203 893*',
    },
    {
      nombre: 'Yape QR',
      categoria: 'pagos',
      mensaje:
        '📱 Número de *SOLO YAPE*:\n*980811297*\n\nA nombre de: `Lorenzo N. Tarazona T.`\n\n📦 Producto: *{producto}*\n💰 Monto: *S/ {monto}*\n\n📸 Envíame la captura del pago para confirmar.',
    },
  ];

  for (const p of predef) {
    await addDoc(collection(db, 'plantillas_mensajes'), {
      ...p,
      createdAt: new Date().toISOString(),
    });
  }
  return predef.length;
}

/**
 * Guarda (crea o edita) una plantilla — payload idéntico a la v1:
 * activa solo si tiene clave del bot.
 */
export async function guardarPlantilla(
  datos: { id?: string; nombre: string; categoria: string; mensaje: string; clave: string }
): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  const { id, nombre, categoria, mensaje, clave } = datos;
  if (id) {
    await setDoc(
      doc(db, 'plantillas_mensajes', id),
      {
        nombre,
        categoria,
        mensaje,
        clave,
        activa: clave ? true : false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } else {
    await addDoc(collection(db, 'plantillas_mensajes'), {
      nombre,
      categoria,
      mensaje,
      clave,
      activa: clave ? true : false,
      createdAt: new Date().toISOString(),
    });
  }
}

/** Duplica una plantilla (copia SIN clave → plantilla personal, igual que la v1) */
export async function duplicarPlantilla(p: PlantillaMensaje): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  await addDoc(collection(db, 'plantillas_mensajes'), {
    nombre: p.nombre + ' (copia)',
    categoria: p.categoria,
    mensaje: p.mensaje,
    createdAt: new Date().toISOString(),
  });
}

/** Elimina una plantilla */
export async function eliminarPlantilla(id: string): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  await deleteDoc(doc(db, 'plantillas_mensajes', id));
}

// ─────────────────────────────────────────────────────────────
// PUENTE DE SINCRONIZACIÓN CON EL BOT (sistema/puente_control)
// ─────────────────────────────────────────────────────────────

/**
 * Sincroniza una vez (barato — igual que la v1):
 * { accion:'once', ts: Date.now() }
 */
export async function sincronizarBotUnaVez(): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  await setDoc(doc(db, 'sistema', 'puente_control'), { accion: 'once', ts: Date.now() }, { merge: true });
}

/**
 * Activa el modo bucle por 10 minutos (consume lecturas — la v1
 * pide confirmación antes): { accion:'loop', expiraEn: +10min }
 */
export async function activarModoBucleBot(): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  const expira = Date.now() + 10 * 60 * 1000;
  await setDoc(doc(db, 'sistema', 'puente_control'), { accion: 'loop', expiraEn: expira }, { merge: true });
}

/** Detiene el modo bucle: { accion:'off' } */
export async function detenerModoBucleBot(): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  await setDoc(doc(db, 'sistema', 'puente_control'), { accion: 'off' }, { merge: true });
}

/** Escucha el estado del puente (para el contador del modo bucle) */
export function escucharPuente(
  cb: (estado: PuenteEstado) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  if (!db) {
    cb({ accion: '', expiraEn: null, ts: null });
    return () => undefined;
  }
  return onSnapshot(
    doc(db, 'sistema', 'puente_control'),
    (snap) => {
      const d = snap.exists() ? snap.data() || {} : {};
      cb({
        accion: (d.accion as PuenteEstado['accion']) || '',
        expiraEn: typeof d.expiraEn === 'number' ? d.expiraEn : null,
        ts: typeof d.ts === 'number' ? d.ts : null,
      });
    },
    (err) => onError && onError(err as Error)
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS DE VISTA PREVIA (formato WhatsApp)
// ─────────────────────────────────────────────────────────────

/** Datos de prueba para la vista previa (mismos de la v1) */
export const DATOS_PRUEBA: Record<string, string> = {
  nombre: 'Luis Vega',
  producto: 'Masajeador con Infrarrojo',
  monto: '89.90',
  cobrar: '89.90',
  direccion: 'Mz Z Lote 22, Urb Pro',
  distrito: 'San Martín de Porres',
  telefono: '981 480 520',
  minutos_llegada: '15',
};

/** Datos demo de RUTA EN VIVO (mismos de la v1) */
export const DATOS_RUTA_DEMO: Record<string, string> = {
  mi_posicion: '17',
  total_ruta: '19',
  faltan_antes: '3',
  entregados_hoy: '13',
  distrito_actual: 'Los Olivos',
  eta_aprox: '4:35 p. m.',
  ruta_lista:
    '1. San Isidro\n2. Magdalena del Mar\n3. Jesús María\n4. Jesús María\n5. Pueblo Libre\n6. Pueblo Libre\n7. Cercado de Lima\n8. San Miguel\n9. San Miguel\n10. La Perla\n11. Callao\n12. San Martín de Porres\n13. San Martín de Porres\n14. Los Olivos\n15. Los Olivos\n16. Independencia\n17. Comas ← 📍 *TÚ ESTÁS AQUÍ*\n18. Los Olivos\n19. Los Olivos',
};

/**
 * Procesa los bloques {sin_x}...{/sin_x} para la vista previa:
 * deja el contenido, quita las etiquetas (igual que la v1 —
 * en la vista previa siempre hay datos).
 */
export function procesarBloquesPreview(texto: string): string {
  let t = texto;
  for (const b of BLOQUES_CONDICIONALES) {
    const re = new RegExp('\\{' + b + '\\}([\\s\\S]*?)\\{\\/' + b + '\\}', 'g');
    t = t.replace(re, '$1');
  }
  return t;
}

/** Reemplaza las variables por los datos de prueba (vista previa) */
export function aplicarVariablesPreview(mensaje: string): string {
  const ahora = new Date();
  const datos: Record<string, string> = {
    ...DATOS_PRUEBA,
    hora: ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    fecha: ahora.toLocaleDateString('es-PE'),
    ...DATOS_RUTA_DEMO,
  };
  let t = procesarBloquesPreview(mensaje);
  for (const [k, v] of Object.entries(datos)) {
    t = t.split('{' + k + '}').join(v);
  }
  return t;
}

/** Escapa HTML */
export function escapeHtmlTexto(t: string): string {
  return String(t || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convierte texto con formato WhatsApp a HTML seguro:
 * *negrita* · _cursiva_ · ~tachado~ · `código` · saltos de línea.
 * (Mismo formato que la v1 — para la vista previa.)
 */
export function formatearWhatsAppHTML(texto: string): string {
  if (!texto) return '';
  let t = escapeHtmlTexto(texto);
  t = t.replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
  t = t.replace(/_([^_\n]+)_/g, '<i>$1</i>');
  t = t.replace(/~([^~\n]+)~/g, '<s>$1</s>');
  t = t.replace(/`([^`\n]+)`/g, '<code class="wa-code">$1</code>');
  t = t.replace(/\n/g, '<br>');
  return t;
}

/** Link wa.me para probar una plantilla (número de pruebas de la v1) */
export const TELEFONO_PRUEBA_DEFAULT = '51907565569';

export function linkProbarPlantilla(mensaje: string, telefono = TELEFONO_PRUEBA_DEFAULT): string {
  return 'https://wa.me/' + telefono.replace(/\D/g, '') + '?text=' + encodeURIComponent(aplicarVariablesPreview(mensaje));
}

/** Normaliza número para mostrar: 51985294454 → 985 294 454 */
export function celBonito(cel: string): string {
  const d = String(cel || '').replace(/\D/g, '');
  const t9 = d.length >= 11 && d.startsWith('51') ? d.slice(2, 11) : d.slice(-9);
  return t9.length === 9 ? `${t9.slice(0, 3)} ${t9.slice(3, 6)} ${t9.slice(6)}` : cel;
}
