// ═══════════════════════════════════════════════════════════
// 🛍️ CATÁLOGO — Capa de datos (Fase 3.3 · Mudanza de ClienteTrack)
// ═══════════════════════════════════════════════════════════
// Mismo contrato Firestore que el catálogo de la v1:
//   - catalogo_productos      → productos (fotoBase64, oferta,
//                               destacado, estados, sku...)
//   - configuracion/tienda_X  → identidad de la tienda (nombre,
//                               logo, color, contacto, yape...)
//
// MEJORA sobre la v1: además de wa.me, un producto se puede
// enviar POR EL BOT desde el chat (imagen + mensaje) usando el
// canal verificado de respuestas_manuales.
// ═══════════════════════════════════════════════════════════

import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  QuerySnapshot,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { UID_BOT } from './chatBaileys';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type EstadoProducto = 'activo' | 'agotado' | 'proximo' | 'oculto';

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  precio: number;
  categoria: string;
  desc: string;
  descCorta: string;
  estado: EstadoProducto;
  sku: string;
  fotoBase64: string;
  destacado: boolean;
  oferta: boolean;
  precioOferta: number;
  actualizado?: number;
  creado?: number;
}

export interface ConfigTienda {
  nombre: string;
  eslogan: string;
  logo: string;
  color: string;
  telefono: string;
  web: string;
  instagram: string;
  facebook: string;
  yapeNum: string;
  yapeTitular: string;
  banco: string;
  envio: string;
}

export const TIENDA_DEFAULT: ConfigTienda = {
  nombre: 'Tiendas MATE',
  eslogan: '',
  logo: '',
  color: '#10b981',
  telefono: '',
  web: '',
  instagram: '',
  facebook: '',
  yapeNum: '',
  yapeTitular: '',
  banco: '',
  envio: 'Entrega a domicilio en Lima Metropolitana',
};

export const ESTADOS_PRODUCTO: { id: EstadoProducto; label: string; icono: string }[] = [
  { id: 'activo', label: 'Activo', icono: '✅' },
  { id: 'agotado', label: 'Agotado', icono: '⛔' },
  { id: 'proximo', label: 'Próximamente', icono: '🔄' },
  { id: 'oculto', label: 'Oculto', icono: '🙈' },
];

// ─────────────────────────────────────────────────────────────
// HELPERS DE PRECIO (idénticos a la v1)
// ─────────────────────────────────────────────────────────────

export function precioTxt(p: unknown): string {
  const n = parseFloat(String(p));
  return isNaN(n) ? '' : 'S/ ' + n.toFixed(2).replace(/\.00$/, '');
}

export function calcularDescuento(precio: unknown, oferta: unknown): number {
  const p = parseFloat(String(precio));
  const o = parseFloat(String(oferta));
  if (!p || !o || o >= p) return 0;
  return Math.round(((p - o) / p) * 100);
}

export function ahorroTxt(precio: unknown, oferta: unknown): string {
  const p = parseFloat(String(precio));
  const o = parseFloat(String(oferta));
  if (!p || !o || o >= p) return '';
  return 'Ahorra S/ ' + (p - o).toFixed(2).replace(/\.00$/, '') + ' (' + calcularDescuento(p, o) + '% OFF)';
}

/** Orden de la lista: destacados → activos → agotados → próximos → ocultos */
export function ordenarProductos(arr: ProductoCatalogo[]): ProductoCatalogo[] {
  const peso: Record<string, number> = { activo: 0, agotado: 1, proximo: 2, oculto: 3 };
  return [...arr].sort((a, b) => {
    if (!!a.destacado !== !!b.destacado) return a.destacado ? -1 : 1;
    const ea = peso[a.estado] ?? 0;
    const eb = peso[b.estado] ?? 0;
    if (ea !== eb) return ea - eb;
    const ca = (a.categoria || 'ZZZ').toLowerCase();
    const cb = (b.categoria || 'ZZZ').toLowerCase();
    if (ca !== cb) return ca.localeCompare(cb);
    return (a.nombre || '').localeCompare(b.nombre || '');
  });
}

// ─────────────────────────────────────────────────────────────
// PRODUCTOS (tiempo real)
// ─────────────────────────────────────────────────────────────

export function escucharProductos(
  cb: (lista: ProductoCatalogo[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  if (!db) {
    cb([]);
    return () => undefined;
  }
  return onSnapshot(
    collection(db, 'catalogo_productos'),
    (snap: QuerySnapshot<DocumentData>) => {
      const lista: ProductoCatalogo[] = [];
      snap.forEach((d) => {
        const m = d.data() || {};
        lista.push({
          id: d.id,
          nombre: String(m.nombre || ''),
          precio: parseFloat(String(m.precio || 0)) || 0,
          categoria: String(m.categoria || ''),
          desc: String(m.desc || ''),
          descCorta: String(m.descCorta || ''),
          estado: (m.estado as EstadoProducto) || 'activo',
          sku: String(m.sku || ''),
          fotoBase64: String(m.fotoBase64 || ''),
          destacado: m.destacado === true,
          oferta: m.oferta === true,
          precioOferta: parseFloat(String(m.precioOferta || 0)) || 0,
          actualizado: m.actualizado,
          creado: m.creado,
        });
      });
      cb(ordenarProductos(lista));
    },
    (err) => {
      console.warn('[catalogo] listener:', err.message);
      onError && onError(err as Error);
    }
  );
}

export async function guardarProducto(p: ProductoCatalogo): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  const data = {
    nombre: p.nombre,
    precio: p.precio,
    categoria: p.categoria,
    desc: p.desc,
    descCorta: p.descCorta,
    estado: p.estado,
    sku: p.sku,
    fotoBase64: p.fotoBase64 || '',
    destacado: p.destacado,
    oferta: p.oferta,
    precioOferta: p.oferta ? p.precioOferta : 0,
    actualizado: Date.now(),
  };
  if (p.id && !p.id.startsWith('nuevo_')) {
    await setDoc(doc(db, 'catalogo_productos', p.id), data, { merge: true });
  } else {
    const ref = doc(collection(db, 'catalogo_productos'));
    await setDoc(ref, { ...data, creado: Date.now() });
  }
}

export async function eliminarProducto(id: string): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  await deleteDoc(doc(db, 'catalogo_productos', id));
}

export async function cambiarEstadoProducto(id: string, estado: EstadoProducto): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'catalogo_productos', id), { estado }, { merge: true });
}

export async function toggleDestacadoProducto(p: ProductoCatalogo): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'catalogo_productos', p.id), { destacado: !p.destacado }, { merge: true });
}

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE TIENDA (Firestore + fallback localStorage, como la v1)
// ─────────────────────────────────────────────────────────────

const KEY_TIENDA_LOCAL = 'cfg_tienda';
const DOC_TIENDA = 'tienda_' + UID_BOT;

export function tiendaDesdeDoc(d: DocumentData | undefined): ConfigTienda {
  return {
    ...TIENDA_DEFAULT,
    ...(d || {}),
  };
}

export async function cargarTienda(): Promise<ConfigTienda> {
  if (!db) return leerTiendaLocal();
  try {
    const snap = await getDoc(doc(db, 'configuracion', DOC_TIENDA));
    if (snap.exists()) return tiendaDesdeDoc(snap.data());
  } catch (e) {
    console.warn('[catalogo] cargarTienda:', e);
  }
  return leerTiendaLocal();
}

function leerTiendaLocal(): ConfigTienda {
  try {
    const local = JSON.parse(localStorage.getItem(KEY_TIENDA_LOCAL) || 'null');
    if (local) return { ...TIENDA_DEFAULT, ...local };
  } catch { /* noop */ }
  return TIENDA_DEFAULT;
}

export async function guardarTienda(cfg: ConfigTienda): Promise<void> {
  // 1. Siempre local (para cuando Firestore no responda)
  try {
    localStorage.setItem(KEY_TIENDA_LOCAL, JSON.stringify(cfg));
  } catch { /* sin espacio */ }
  // 2. Firestore (merge, como la v1)
  if (!db) return;
  await setDoc(doc(db, 'configuracion', DOC_TIENDA), { ...cfg }, { merge: true });
}

// ─────────────────────────────────────────────────────────────
// MENSAJE DE WHATSAPP (idéntico al de la v1)
// ─────────────────────────────────────────────────────────────

/** Mensaje que acompaña a un producto al enviarlo por WhatsApp */
export function mensajeProducto(p: ProductoCatalogo, nombreCli?: string): string {
  const tieneOferta = p.oferta && p.precioOferta && parseFloat(String(p.precioOferta)) < parseFloat(String(p.precio));
  let m = '🛍️ ¡Hola' + (nombreCli ? ', *' + nombreCli + '*' : '') + '! 👋\n\n';
  m += 'Te comparto este producto:\n\n';
  m += '📦 *' + (p.nombre || '') + '*\n';
  if (p.sku) m += '🔖 SKU: `' + p.sku + '`\n';
  let descCorta = p.descCorta;
  if (!descCorta && p.desc) {
    descCorta = p.desc.split('\n')[0].replace(/\*([^*]+)\*/g, '$1').replace(/^-\s*/, '');
    if (descCorta.length > 80) descCorta = descCorta.substring(0, 77) + '...';
  }
  if (descCorta) m += '_' + descCorta + '_\n';
  m += '\n';
  if (tieneOferta) {
    m += '💰 Precio normal: ~S/ ' + parseFloat(String(p.precio)).toFixed(2) + '~\n';
    m += '🔥 *OFERTA: S/ ' + parseFloat(String(p.precioOferta)).toFixed(2) + '*\n';
    m += '💎 ' + ahorroTxt(p.precio, p.precioOferta) + '\n';
  } else {
    m += '💰 Precio: *' + precioTxt(p.precio) + '*\n';
  }
  if (p.estado === 'agotado') m += '\n⚠️ _Por ahora agotado — puedo avisarte cuando llegue._\n';
  if (p.estado === 'proximo') m += '\n🔄 _Próximamente disponible — te aviso cuando esté listo._\n';
  if (p.destacado) m += '\n⭐ _Producto destacado de nuestro catálogo_\n';
  m += '\n¿Te interesa? Escríbeme y coordinamos la entrega 🚚';
  return m;
}

/** Contar productos (para el badge del sidebar si hiciera falta) */
export async function contarProductos(): Promise<number> {
  if (!db) return 0;
  try {
    const snap = await getDocs(query(collection(db, 'catalogo_productos'), orderBy('actualizado', 'desc')));
    return snap.size;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────
// EXPORTAR CATÁLOGO COMO IMAGEN (canvas — sin librerías extra)
// Reemplaza el PDF de la v1: la imagen se comparte directo por
// WhatsApp con la hoja nativa (descargarArchivo).
// ─────────────────────────────────────────────────────────────

/** Carga una imagen base64/dataURL en un <img> para dibujarla en canvas */
function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src.startsWith('data:') ? src : src;
  });
}

/**
 * Genera el catálogo completo como imagen PNG (grid 2 columnas con
 * fotos, precios y ofertas + cabecera de la tienda). Devuelve un Blob.
 * Máx 24 productos por imagen (los primeros según el orden oficial).
 */
export async function exportarCatalogoImagen(
  productos: ProductoCatalogo[],
  tienda: ConfigTienda
): Promise<Blob> {
  const visibles = productos.filter((p) => p.estado !== 'oculto').slice(0, 24);
  if (visibles.length === 0) throw new Error('No hay productos para el catálogo');

  const COLS = 2;
  const CARD_W = 340;
  const CARD_H = 420;
  const GAP = 24;
  const MARGEN = 32;
  const CABECERA = 190;
  const PIE = 70;
  const filas = Math.ceil(visibles.length / COLS);
  const W = MARGEN * 2 + COLS * CARD_W + (COLS - 1) * GAP;
  const H = CABECERA + filas * CARD_H + (filas - 1) * GAP + PIE + MARGEN;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const color = tienda.color || '#10b981';

  // Fondo
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  // Cabecera
  const logo = await cargarImagen(tienda.logo);
  let textoX = MARGEN + 20;
  if (logo) {
    const s = Math.min(110 / logo.width, 110 / logo.height);
    ctx.drawImage(logo, MARGEN + 10, 40, logo.width * s, logo.height * s);
    textoX = MARGEN + 10 + logo.width * s + 24;
  } else {
    ctx.font = '64px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛍️', MARGEN + 65, 115);
    textoX = MARGEN + 140;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 40px Inter, Arial, sans-serif';
  ctx.fillText(tienda.nombre || 'Catálogo', textoX, 95);
  if (tienda.eslogan) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px Inter, Arial, sans-serif';
    ctx.fillText(tienda.eslogan, textoX, 132);
  }
  ctx.fillStyle = color;
  ctx.font = 'bold 22px Inter, Arial, sans-serif';
  const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillText('Catálogo · ' + fecha, textoX, 168);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(MARGEN, CABECERA - 26);
  ctx.lineTo(W - MARGEN, CABECERA - 26);
  ctx.stroke();

  // Tarjetas
  for (let i = 0; i < visibles.length; i++) {
    const p = visibles[i];
    const col = i % COLS;
    const fila = Math.floor(i / COLS);
    const x = MARGEN + col * (CARD_W + GAP);
    const y = CABECERA + fila * (CARD_H + GAP);

    // tarjeta
    ctx.fillStyle = '#1e293b';
    const r = 18;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD_W, CARD_H, r);
    ctx.fill();

    // foto
    const foto = await cargarImagen(p.fotoBase64);
    const fotoH = 240;
    if (foto) {
      const s = Math.max(CARD_W / foto.width, fotoH / foto.height);
      const dw = foto.width * s;
      const dh = foto.height * s;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_W, fotoH, [r, r, 0, 0]);
      ctx.clip();
      ctx.drawImage(foto, x + (CARD_W - dw) / 2, y + (fotoH - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_W, fotoH, [r, r, 0, 0]);
      ctx.fill();
      ctx.font = '48px serif';
      ctx.textAlign = 'center';
      ctx.fillText('📦', x + CARD_W / 2, y + fotoH / 2 + 16);
      ctx.textAlign = 'left';
    }

    // badges sobre la foto
    let badgeX = x + 12;
    if (p.oferta && p.precioOferta) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(badgeX, y + 12, 92, 32, 16);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Inter, Arial, sans-serif';
      ctx.fillText(calcularDescuento(p.precio, p.precioOferta) + '% OFF', badgeX + 10, y + 34);
      badgeX += 100;
    }
    if (p.destacado) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(badgeX, y + 12, 88, 32, 16);
      ctx.fill();
      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 18px Inter, Arial, sans-serif';
      ctx.fillText('⭐ TOP', badgeX + 12, y + 34);
    }

    // nombre
    const ty = y + fotoH + 34;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px Inter, Arial, sans-serif';
    let nombre = p.nombre || '';
    while (ctx.measureText(nombre).width > CARD_W - 24 && nombre.length > 4) nombre = nombre.slice(0, -2);
    ctx.fillText(nombre, x + 12, ty);

    // categoría
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px Inter, Arial, sans-serif';
    ctx.fillText(p.categoria || '', x + 12, ty + 26);

    // precio
    const tieneOferta = p.oferta && p.precioOferta && p.precioOferta < p.precio;
    if (tieneOferta) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px Inter, Arial, sans-serif';
      ctx.fillText('S/ ' + p.precio.toFixed(2), x + 12, ty + 58);
      const wNormal = ctx.measureText('S/ ' + p.precio.toFixed(2)).width;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 12, ty + 52);
      ctx.lineTo(x + 12 + wNormal, ty + 52);
      ctx.stroke();
      ctx.fillStyle = '#34d399';
      ctx.font = '900 30px Inter, Arial, sans-serif';
      ctx.fillText('S/ ' + p.precioOferta.toFixed(2), x + 12 + wNormal + 14, ty + 60);
    } else {
      ctx.fillStyle = '#34d399';
      ctx.font = '900 30px Inter, Arial, sans-serif';
      ctx.fillText(precioTxt(p.precio), x + 12, ty + 60);
    }

    // estado
    if (p.estado === 'agotado' || p.estado === 'proximo') {
      ctx.fillStyle = p.estado === 'agotado' ? '#f87171' : '#fbbf24';
      ctx.font = 'bold 18px Inter, Arial, sans-serif';
      ctx.fillText(p.estado === 'agotado' ? '⛔ Agotado' : '🔄 Próximamente', x + 12, ty + 90);
    }
  }

  // Pie
  ctx.fillStyle = '#94a3b8';
  ctx.font = '20px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  const contacto = tienda.telefono ? '📱 ' + tienda.telefono : '';
  const total = productos.filter((p) => p.estado !== 'oculto').length;
  ctx.fillText(
    (contacto ? contacto + ' · ' : '') + total + ' productos' + (visibles.length < total ? ` (se muestran ${visibles.length})` : ''),
    W / 2,
    H - 40
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/jpeg', 0.9);
  });
}
