// ═══════════════════════════════════════════════════════════
// 🛍️ CATÁLOGO VIEW — RiderTrack V2 (Fase 3.3)
// Mudanza del catálogo de ClienteTrack v1 con UI profesional:
//   - Productos con foto, oferta, destacado, estados y SKU
//   - Identidad de la tienda (nombre, logo, color, contactos)
//   - Enviar producto por WhatsApp:
//       🤖 POR EL BOT (imagen + mensaje directo al chat, sin
//          salir de la app — canal verificado respuestas_manuales)
//       📤 Compartir (hoja nativa del teléfono)
//       📋 Copiar mensaje / wa.me
//   - Exportar el catálogo completo como imagen para compartir
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Store,
  ImageIcon,
  Send,
  Copy,
  Share2,
  Star,
  Package,
  Loader2,
  X,
  Trash2,
  Pencil,
  Bot,
  Download,
  Flame,
  ChevronDown,
} from 'lucide-react';
import {
  ProductoCatalogo,
  ConfigTienda,
  EstadoProducto,
  ESTADOS_PRODUCTO,
  TIENDA_DEFAULT,
  precioTxt,
  calcularDescuento,
  escucharProductos,
  guardarProducto,
  eliminarProducto,
  cambiarEstadoProducto,
  toggleDestacadoProducto,
  cargarTienda,
  guardarTienda,
  mensajeProducto,
  exportarCatalogoImagen,
} from '../utils/catalogo';
import { comprimirImagen, enviarAdjuntoChat, enviarMensajeChat, telKey, colorAvatar } from '../utils/chatBaileys';
import { subscribeToRutaActiva, subscribeToClientesRegistrados, Cliente } from '../services/firestore';
import { descargarArchivo } from '../utils/descargaArchivo';

interface CatalogoViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const PRODUCTO_VACIO: ProductoCatalogo = {
  id: 'nuevo_' + Date.now(),
  nombre: '',
  precio: 0,
  categoria: '',
  desc: '',
  descCorta: '',
  estado: 'activo',
  sku: '',
  fotoBase64: '',
  destacado: false,
  oferta: false,
  precioOferta: 0,
};

// ─────────────────────────────────────────────────────────────
// MODAL: editor de producto
// ─────────────────────────────────────────────────────────────

const ModalEditor: React.FC<{
  producto: ProductoCatalogo | null;
  categorias: string[];
  onClose: () => void;
  onGuardar: (p: ProductoCatalogo) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
  onShowToast?: CatalogoViewProps['onShowToast'];
}> = ({ producto, categorias, onClose, onGuardar, onEliminar, onShowToast }) => {
  const [p, setP] = useState<ProductoCatalogo>(producto || PRODUCTO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  if (!producto) return null;
  const esNuevo = producto.id.startsWith('nuevo_');

  const set = (campos: Partial<ProductoCatalogo>) => setP((prev) => ({ ...prev, ...campos }));

  const elegirFoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { base64, mimetype } = await comprimirImagen(file);
      set({ fotoBase64: `data:${mimetype};base64,${base64}` });
    } catch (e: any) {
      onShowToast?.('Error con la foto', e.message || 'Intenta con otra imagen', 'error');
    }
  };

  const guardar = async () => {
    if (!p.nombre.trim()) { onShowToast?.('Falta el nombre', 'Ponle un nombre al producto', 'warning'); return; }
    if (isNaN(p.precio) || p.precio < 0) { onShowToast?.('Precio inválido', 'Revisa el precio del producto', 'warning'); return; }
    if (p.oferta && p.precioOferta && p.precioOferta >= p.precio) {
      onShowToast?.('Oferta inválida', 'El precio de oferta debe ser menor al normal', 'warning');
      return;
    }
    setGuardando(true);
    try {
      await onGuardar({ ...p, nombre: p.nombre.trim(), categoria: p.categoria.trim(), sku: p.sku.trim() });
      onClose();
    } catch (e: any) {
      onShowToast?.('Error al guardar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !guardando && onClose()}>
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70 flex-shrink-0">
          <span className="text-sm font-black text-white">{esNuevo ? '➕ Nuevo producto' : '✏️ Editar producto'}</span>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Foto */}
          <input ref={inputFotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { elegirFoto(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          <button
            type="button"
            onClick={() => inputFotoRef.current?.click()}
            className={`relative w-full h-40 rounded-2xl border-2 border-dashed overflow-hidden transition-all ${
              p.fotoBase64 ? 'border-emerald-500/60' : 'border-slate-600 hover:border-slate-400 bg-slate-800/60'
            }`}
          >
            {p.fotoBase64 ? (
              <>
                <img src={p.fotoBase64} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-slate-950/80 text-[10px] font-bold text-slate-200">Toca para cambiar</span>
              </>
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400">
                <ImageIcon className="w-7 h-7" />
                <span className="text-xs font-semibold">Toca para agregar foto</span>
                <span className="text-[10px] opacity-70">(se comprime automáticamente)</span>
              </span>
            )}
          </button>

          {/* Nombre + precio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Nombre *</label>
              <input
                value={p.nombre}
                onChange={(e) => set({ nombre: e.target.value })}
                placeholder="Ej: Rodillera deportiva"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Precio (S/) *</label>
              <input
                type="number"
                step="0.10"
                min="0"
                value={p.precio || ''}
                onChange={(e) => set({ precio: parseFloat(e.target.value) || 0 })}
                placeholder="89.90"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
          </div>

          {/* Categoría + SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Categoría</label>
              <input
                list="cats_catalogo"
                value={p.categoria}
                onChange={(e) => set({ categoria: e.target.value })}
                placeholder="Ej: Ortopedia"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
              <datalist id="cats_catalogo">
                {categorias.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">SKU / código</label>
              <input
                value={p.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder="Ej: ORT-001"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
          </div>

          {/* Descripciones */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Descripción corta (una línea)</label>
            <input
              value={p.descCorta}
              onChange={(e) => set({ descCorta: e.target.value })}
              placeholder="La que se ve al enviar el producto"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Descripción completa · <span className="text-emerald-400 normal-case">*negrita* _cursiva_</span>
            </label>
            <textarea
              value={p.desc}
              onChange={(e) => set({ desc: e.target.value })}
              rows={4}
              placeholder={'- Material transpirable\n- Talle único\n- *Garantía 3 meses*'}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 resize-none custom-scrollbar"
            />
          </div>

          {/* Estado */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Estado</label>
            <div className="grid grid-cols-4 gap-1.5">
              {ESTADOS_PRODUCTO.map((es) => (
                <button
                  key={es.id}
                  type="button"
                  onClick={() => set({ estado: es.id as EstadoProducto })}
                  className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${
                    p.estado === es.id
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <span className="block text-base leading-none mb-0.5">{es.icono}</span>
                  {es.label}
                </button>
              ))}
            </div>
          </div>

          {/* Oferta */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-3 space-y-2.5">
            <button type="button" onClick={() => set({ oferta: !p.oferta })} className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Flame className={`w-4 h-4 ${p.oferta ? 'text-rose-400' : 'text-slate-500'}`} /> Poner en OFERTA 🔥
              </span>
              <span className={`w-10 h-5.5 rounded-full border transition-all relative ${p.oferta ? 'bg-rose-500/80 border-rose-400' : 'bg-slate-700 border-slate-600'}`}>
                <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all ${p.oferta ? 'left-5' : 'left-0.5'}`} />
              </span>
            </button>
            {p.oferta && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Precio de oferta (S/)</label>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={p.precioOferta || ''}
                  onChange={(e) => set({ precioOferta: parseFloat(e.target.value) || 0 })}
                  placeholder="69.90"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/60"
                />
                {!!p.precioOferta && p.precioOferta < p.precio && (
                  <p className="text-[10px] text-emerald-400 font-bold mt-1">
                    💎 {calcularDescuento(p.precio, p.precioOferta)}% OFF · ahorra S/ {(p.precio - p.precioOferta).toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Destacado */}
          <button
            type="button"
            onClick={() => set({ destacado: !p.destacado })}
            className="flex items-center justify-between w-full rounded-2xl border border-slate-700 bg-slate-800/50 p-3"
          >
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Star className={`w-4 h-4 ${p.destacado ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} /> Producto destacado ⭐
            </span>
            <span className={`w-10 h-5.5 rounded-full border transition-all relative ${p.destacado ? 'bg-amber-500/80 border-amber-400' : 'bg-slate-700 border-slate-600'}`}>
              <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all ${p.destacado ? 'left-5' : 'left-0.5'}`} />
            </span>
          </button>
        </div>

        <div className="flex gap-2 p-4 pt-3 border-t border-slate-700/70 flex-shrink-0">
          {!esNuevo && (
            <button
              type="button"
              disabled={eliminando || guardando}
              onClick={async () => {
                if (!window.confirm('¿Eliminar este producto del catálogo? No se puede deshacer.')) return;
                setEliminando(true);
                try {
                  await onEliminar(producto.id);
                  onClose();
                } catch (e: any) {
                  onShowToast?.('Error', e.message || 'No se pudo eliminar', 'error');
                } finally {
                  setEliminando(false);
                }
              }}
              className="p-2.5 rounded-xl bg-rose-600/15 text-rose-400 border border-rose-500/30 hover:bg-rose-600/25 transition-colors disabled:opacity-40"
              title="Eliminar producto"
            >
              {eliminando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-bold transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-40"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {esNuevo ? 'Crear producto' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MODAL: configuración de tienda
// ─────────────────────────────────────────────────────────────

const ModalTienda: React.FC<{
  tienda: ConfigTienda;
  onClose: () => void;
  onGuardar: (t: ConfigTienda) => Promise<void>;
  onShowToast?: CatalogoViewProps['onShowToast'];
}> = ({ tienda, onClose, onGuardar, onShowToast }) => {
  const [t, setT] = useState<ConfigTienda>(tienda);
  const [guardando, setGuardando] = useState(false);
  const inputLogoRef = useRef<HTMLInputElement>(null);

  const set = (campos: Partial<ConfigTienda>) => setT((prev) => ({ ...prev, ...campos }));

  const elegirLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { base64, mimetype } = await comprimirImagen(file);
      set({ logo: `data:${mimetype};base64,${base64}` });
    } catch (e: any) {
      onShowToast?.('Error con el logo', e.message || 'Intenta con otra imagen', 'error');
    }
  };

  const campo = (label: string, key: keyof ConfigTienda, placeholder: string, tipo: string = 'text') => (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</label>
      <input
        type={tipo}
        value={String(t[key] || '')}
        onChange={(e) => set({ [key]: e.target.value } as Partial<ConfigTienda>)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !guardando && onClose()}>
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70 flex-shrink-0">
          <span className="text-sm font-black text-white">🏪 Configurar tienda</span>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <input ref={inputLogoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { elegirLogo(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => inputLogoRef.current?.click()}
              className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-600 hover:border-emerald-500/60 overflow-hidden flex-shrink-0 bg-slate-800/60"
            >
              {t.logo ? <img src={t.logo} alt="logo" className="w-full h-full object-cover" /> : (
                <span className="flex flex-col items-center justify-center gap-0.5 text-slate-400 h-full">
                  <Store className="w-5 h-5" />
                  <span className="text-[9px] font-bold">Logo</span>
                </span>
              )}
            </button>
            <div className="flex-1 space-y-2.5">
              {campo('Nombre de la tienda *', 'nombre', 'Ej: Tiendas MATE')}
              {campo('Eslogan', 'eslogan', 'Ej: Productos ortopédicos y de salud')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Color de marca</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={t.color || '#10b981'}
                  onChange={(e) => set({ color: e.target.value })}
                  className="w-11 h-10 rounded-xl border border-slate-700 bg-slate-800 cursor-pointer"
                />
                <input
                  value={t.color || ''}
                  onChange={(e) => set({ color: e.target.value })}
                  placeholder="#10b981"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>
            </div>
            {campo('WhatsApp / teléfono', 'telefono', '907 565 569')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campo('Página web', 'web', 'www.tutienda.com')}
            {campo('Instagram', 'instagram', '@tu_tienda')}
            {campo('Facebook', 'facebook', 'facebook.com/tutienda')}
            {campo('Mensaje de envío', 'envio', 'Entrega a domicilio en Lima')}
            {campo('Yape/Plin número', 'yapeNum', '980 811 297')}
            {campo('Yape/Plin titular', 'yapeTitular', 'Lorenzo N. Tarazona T.')}
            {campo('Cuenta bancaria', 'banco', 'BCP Soles: 194-1234567890-0-12')}
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Estos datos se usan en la cabecera del catálogo compartido. Se guardan en la nube (como en la
            v1) con respaldo local.
          </p>
        </div>

        <div className="flex gap-2 p-4 pt-3 border-t border-slate-700/70 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-bold transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || !t.nombre.trim()}
            onClick={async () => {
              setGuardando(true);
              try {
                await onGuardar({ ...t, nombre: t.nombre.trim() });
                onClose();
              } catch (e: any) {
                onShowToast?.('Error al guardar', e.message || 'Intenta de nuevo', 'error');
              } finally {
                setGuardando(false);
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-40"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Guardar tienda
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MODAL: enviar producto a un cliente
// ─────────────────────────────────────────────────────────────

interface CliEnviar {
  tel: string;
  nombre: string;
  dist: string;
}

const ModalEnviar: React.FC<{
  producto: ProductoCatalogo;
  clientes: CliEnviar[];
  onClose: () => void;
  onShowToast?: CatalogoViewProps['onShowToast'];
}> = ({ producto, clientes, onClose, onShowToast }) => {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<CliEnviar | null>(null);
  const [enviandoBot, setEnviandoBot] = useState(false);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const qd = t.replace(/\D/g, '');
    let arr = [...clientes];
    if (t) {
      arr = arr.filter(
        (c) =>
          c.nombre.toLowerCase().includes(t) ||
          (qd.length > 2 && c.tel.includes(qd)) ||
          c.dist.toLowerCase().includes(t)
      );
    }
    return arr.sort((a, b) => a.nombre.localeCompare(b.nombre)).slice(0, 30);
  }, [q, clientes]);

  const mensaje = mensajeProducto(producto, sel?.nombre);
  const base64 = producto.fotoBase64.includes(',') ? producto.fotoBase64.split(',')[1] : '';

  const enviarPorBot = async () => {
    if (!sel) { onShowToast?.('Elige un cliente', 'Selecciona a quién le envías el producto', 'warning'); return; }
    setEnviandoBot(true);
    try {
      if (base64) {
        // Foto del producto + el mensaje — mismo canal verificado del chat
        await enviarAdjuntoChat(sel.tel, sel.nombre, 'imagen', base64, 'image/jpeg', `${producto.nombre.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`, '🛍️ ' + producto.nombre);
      }
      await enviarMensajeChat(sel.tel, sel.nombre, mensaje);
      onShowToast?.('🤖 Enviado al bot', `${sel.nombre} recibirá ${base64 ? 'la foto y ' : ''}el mensaje en segundos`, 'success');
      onClose();
    } catch (e: any) {
      onShowToast?.('Error al enviar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setEnviandoBot(false);
    }
  };

  const compartir = async () => {
    try {
      if (base64) {
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        await descargarArchivo(blob, `${producto.nombre.replace(/[^a-zA-Z0-9]/g, '_') || 'producto'}.jpg`, onShowToast, '📤 Producto compartido', 'Elige WhatsApp y al cliente', true);
      } else {
        await navigator.clipboard?.writeText(mensaje);
        onShowToast?.('📋 Mensaje copiado', 'El producto no tiene foto — el texto ya está en tu portapapeles', 'info');
      }
    } catch {
      onShowToast?.('Error', 'No se pudo compartir el producto', 'error');
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard?.writeText(mensaje);
      onShowToast?.('📋 Mensaje copiado', 'Pégalo donde quieras', 'success');
    } catch { /* noop */ }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70 flex-shrink-0">
          <span className="text-sm font-black text-white truncate">📤 Enviar · {producto.nombre}</span>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {/* Preview del mensaje */}
          <div className="rounded-2xl rounded-tr-md bg-emerald-600/90 text-white px-3 py-2.5 shadow-lg max-h-64 overflow-y-auto custom-scrollbar">
            {producto.fotoBase64 && (
              <img src={producto.fotoBase64} alt="" className="w-full max-h-36 object-cover rounded-xl mb-2" />
            )}
            <span className="text-sm whitespace-pre-wrap break-words">{mensaje}</span>
          </div>

          {/* Buscador de clientes */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente por nombre, número o distrito…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Lista de clientes */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
            {filtrados.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Sin resultados. Tus clientes aparecen cuando escriben al bot o están en tu ruta.
              </div>
            ) : (
              filtrados.map((c) => {
                const col = colorAvatar(c.tel);
                const activo = sel?.tel === c.tel;
                return (
                  <button
                    key={c.tel}
                    type="button"
                    onClick={() => setSel(activo ? null : c)}
                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${
                      activo ? 'bg-emerald-600/15 border-emerald-500/50' : 'bg-slate-800/60 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-full ${col.bg} ${col.texto} flex items-center justify-center text-sm font-black flex-shrink-0`}>
                      {(c.nombre || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-bold text-white truncate">{c.nombre}</span>
                      <span className="text-[10px] text-slate-400 font-mono">+51 {c.tel}{c.dist ? ' · ' + c.dist : ''}</span>
                    </span>
                    {activo && <span className="text-emerald-400 text-xs font-black flex-shrink-0">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="p-4 pt-3 border-t border-slate-700/70 flex-shrink-0 space-y-2">
          <button
            type="button"
            onClick={enviarPorBot}
            disabled={enviandoBot || !sel}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black transition-colors disabled:opacity-40"
          >
            {enviandoBot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            🤖 Enviar por el bot {sel ? `a ${sel.nombre.split(' ')[0]}` : ''}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={compartir}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold transition-colors"
            >
              <Share2 className="w-4 h-4 text-sky-400" /> Compartir
            </button>
            <button
              type="button"
              onClick={copiar}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold transition-colors"
            >
              <Copy className="w-4 h-4 text-violet-400" /> Copiar
            </button>
            <a
              href={sel ? `https://wa.me/51${sel.tel}?text=${encodeURIComponent(mensaje)}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!sel) { e.preventDefault(); onShowToast?.('Elige un cliente', 'Selecciona primero a quién le envías', 'warning'); } }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-colors ${sel ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-800/40 border-slate-700 text-slate-500 pointer-events-none'}`}
            >
              <Send className="w-4 h-4 text-emerald-400" /> wa.me
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// VISTA PRINCIPAL
// ─────────────────────────────────────────────────────────────

export const CatalogoView: React.FC<CatalogoViewProps> = ({ onShowToast }) => {
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [tienda, setTienda] = useState<ConfigTienda>(TIENDA_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCat, setFiltroCat] = useState<string>('todas');
  const [soloOfertas, setSoloOfertas] = useState(false);
  const [editando, setEditando] = useState<ProductoCatalogo | null>(null);
  const [modalTienda, setModalTienda] = useState(false);
  const [enviando, setEnviando] = useState<ProductoCatalogo | null>(null);
  const [clientesEnvio, setClientesEnvio] = useState<CliEnviar[]>([]);
  const [exportando, setExportando] = useState(false);

  const toast = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') =>
    onShowToast?.(title, desc, type);

  // ── Suscripciones ──
  useEffect(() => {
    const unsub = escucharProductos((lista) => {
      setProductos(lista);
      setCargando(false);
    });
    cargarTienda().then(setTienda);
    return unsub;
  }, []);

  useEffect(() => {
    // Clientes para el envío: los de la ruta de hoy + los registrados
    const mapa = new Map<string, CliEnviar>();
    const agregar = (tel: string, nombre: string, dist: string) => {
      const t = telKey(tel);
      if (!t) return;
      if (!mapa.has(t)) mapa.set(t, { tel: t, nombre: nombre || 'Cliente', dist: dist || '' });
    };
    const unsubRuta = subscribeToRutaActiva((clientes) => {
      clientes.forEach((c: Cliente) => agregar(c.cel || '', c.nombre || '', c.dist || ''));
      setClientesEnvio(Array.from(mapa.values()));
    });
    const unsubRegs = subscribeToClientesRegistrados((clientes) => {
      clientes.forEach((c: Cliente) => agregar(c.cel || '', c.nombre || '', c.dist || ''));
      setClientesEnvio(Array.from(mapa.values()));
    });
    return () => { unsubRuta(); unsubRegs(); };
  }, []);

  // ── Categorías dinámicas ──
  const categorias = useMemo(() => {
    const cats = new Map<string, number>();
    productos.forEach((p) => { if (p.categoria) cats.set(p.categoria, (cats.get(p.categoria) || 0) + 1); });
    return Array.from(cats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [productos]);

  const hayOfertas = productos.some((p) => p.oferta && p.precioOferta);

  // ── Filtrado ──
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let arr = productos;
    if (soloOfertas) arr = arr.filter((p) => p.oferta && p.precioOferta);
    else if (filtroCat !== 'todas') arr = arr.filter((p) => p.categoria === filtroCat);
    if (q) {
      arr = arr.filter((p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    }
    return arr;
  }, [productos, busqueda, filtroCat, soloOfertas]);

  const stats = useMemo(() => ({
    total: productos.length,
    activos: productos.filter((p) => p.estado === 'activo').length,
    ofertas: productos.filter((p) => p.oferta && p.precioOferta).length,
    destacados: productos.filter((p) => p.destacado).length,
  }), [productos]);

  // ── Acciones ──
  const nuevoProducto = () => setEditando({ ...PRODUCTO_VACIO, id: 'nuevo_' + Date.now() });

  const guardar = async (p: ProductoCatalogo) => {
    await guardarProducto(p);
    toast(p.id.startsWith('nuevo_') ? '✅ Producto creado' : '✅ Producto actualizado', p.nombre, 'success');
  };

  const eliminar = async (id: string) => {
    await eliminarProducto(id);
    toast('🗑️ Producto eliminado', undefined, 'success');
  };

  const exportar = async () => {
    setExportando(true);
    try {
      const blob = await exportarCatalogoImagen(productos, tienda);
      const fecha = new Date().toLocaleDateString('es-PE').replace(/\//g, '-');
      const res = await descargarArchivo(blob, `Catalogo_${tienda.nombre.replace(/\s+/g, '_')}_${fecha}.jpg`, onShowToast, '🛍️ Catálogo listo', 'Compártelo por WhatsApp o guárdalo', true);
      if (res === null) toast('Error al exportar', 'No se pudo generar el catálogo', 'error');
    } catch (e: any) {
      toast('Error al exportar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* ═══ CABECERA ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 rounded-2xl bg-violet-500/20 text-violet-300 border border-violet-500/30 flex-shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              Catálogo
              <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-bold rounded bg-violet-500 text-white">MUDANZA v1</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              {tienda.nombre} · tus productos con foto, ofertas y envío por el bot
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setModalTienda(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-600 text-slate-300 text-xs font-bold hover:border-slate-400 transition-colors"
            title="Configurar tienda"
          >
            <Store className="w-4 h-4" /> <span className="hidden sm:inline">Tienda</span>
          </button>
          <button
            type="button"
            onClick={exportar}
            disabled={exportando || productos.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600/20 border border-sky-500/40 text-sky-300 text-xs font-bold hover:bg-sky-600/30 transition-colors disabled:opacity-40"
            title="Exportar catálogo como imagen para compartir"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} <span className="hidden sm:inline">Exportar</span>
          </button>
          <button
            type="button"
            onClick={nuevoProducto}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
      </div>

      {/* ═══ STATS ═══ */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Productos', valor: stats.total, color: 'text-white' },
          { label: 'Activos', valor: stats.activos, color: 'text-emerald-400' },
          { label: 'Ofertas 🔥', valor: stats.ofertas, color: 'text-rose-400' },
          { label: 'Top ⭐', valor: stats.destacados, color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="p-2.5 sm:p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 text-center">
            <div className={`text-lg sm:text-xl font-black ${s.color}`}>{s.valor}</div>
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ BUSCADOR + FILTROS ═══ */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto, categoría o SKU…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => { setFiltroCat('todas'); setSoloOfertas(false); }}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
              filtroCat === 'todas' && !soloOfertas ? 'bg-violet-600 text-white' : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:text-slate-200'
            }`}
          >
            Todas
          </button>
          {hayOfertas && (
            <button
              type="button"
              onClick={() => setSoloOfertas((v) => !v)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                soloOfertas ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20'
              }`}
            >
              🔥 Ofertas
            </button>
          )}
          {categorias.map(([c, n]) => (
            <button
              key={c}
              type="button"
              onClick={() => { setFiltroCat(c); setSoloOfertas(false); }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                filtroCat === c && !soloOfertas ? 'bg-violet-600 text-white' : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:text-slate-200'
              }`}
            >
              {c} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ GRID DE PRODUCTOS ═══ */}
      {cargando ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-emerald-400" />
          <span className="text-sm font-semibold">Cargando catálogo…</span>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-400 rounded-2xl border border-dashed border-slate-700">
          <Package className="w-12 h-12 mb-3 opacity-40" />
          <div className="text-sm font-bold text-slate-300">
            {productos.length === 0 ? 'Tu catálogo está vacío' : 'Nada por aquí'}
          </div>
          <div className="text-xs mt-1 max-w-sm">
            {productos.length === 0
              ? 'Crea tu primer producto con foto, precio y oferta. Cuando un cliente te pida el catálogo lo envías por el bot sin salir de la app.'
              : 'Prueba con otra búsqueda o filtro'}
          </div>
          {productos.length === 0 && (
            <button
              type="button"
              onClick={nuevoProducto}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
            >
              <Plus className="w-4 h-4" /> Crear el primer producto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtrados.map((p) => {
            const tieneOferta = p.oferta && p.precioOferta && p.precioOferta < p.precio;
            return (
              <div key={p.id} className={`rounded-2xl border overflow-hidden bg-slate-800/70 transition-all group ${p.estado === 'oculto' ? 'border-slate-700 opacity-60' : 'border-slate-700 hover:border-emerald-500/40'}`}>
                {/* Foto */}
                <div className="relative h-40 bg-slate-900">
                  {p.fotoBase64 ? (
                    <img src={p.fotoBase64} alt={p.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    {tieneOferta && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                        🔥 {calcularDescuento(p.precio, p.precioOferta)}% OFF
                      </span>
                    )}
                    {p.destacado && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">⭐ TOP</span>
                    )}
                  </div>
                  {p.estado !== 'activo' && (
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                      p.estado === 'agotado' ? 'bg-slate-950/85 text-rose-300 border-rose-500/50' :
                      p.estado === 'proximo' ? 'bg-slate-950/85 text-amber-300 border-amber-500/50' :
                      'bg-slate-950/85 text-slate-400 border-slate-600'
                    }`}>
                      {ESTADOS_PRODUCTO.find((e) => e.id === p.estado)?.icono} {ESTADOS_PRODUCTO.find((e) => e.id === p.estado)?.label}
                    </span>
                  )}
                  {/* Acciones rápidas hover */}
                  <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setEditando(p)}
                      className="p-1.5 rounded-lg bg-slate-950/85 border border-slate-600 text-slate-300 hover:text-white transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-white truncate">{p.nombre}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {p.categoria || 'Sin categoría'}{p.sku ? ' · ' + p.sku : ''}
                      </div>
                    </div>
                    {p.destacado && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                  </div>

                  <div className="flex items-baseline gap-2 mt-1.5">
                    {tieneOferta ? (
                      <>
                        <span className="text-xs text-slate-500 line-through">{precioTxt(p.precio)}</span>
                        <span className="text-lg font-black text-emerald-400">{precioTxt(p.precioOferta)}</span>
                      </>
                    ) : (
                      <span className="text-lg font-black text-emerald-400">{precioTxt(p.precio)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-2.5">
                    <button
                      type="button"
                      onClick={() => setEnviando(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-600/25 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" /> Enviar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDestacadoProducto(p)}
                      className={`p-2 rounded-xl border transition-colors ${p.destacado ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-amber-300'}`}
                      title={p.destacado ? 'Quitar de destacados' : 'Marcar como destacado'}
                    >
                      <Star className={`w-3.5 h-3.5 ${p.destacado ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarEstadoProducto(p.id, p.estado === 'agotado' ? 'activo' : 'agotado')}
                      className={`p-2 rounded-xl border transition-colors ${p.estado === 'agotado' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-rose-300'}`}
                      title={p.estado === 'agotado' ? 'De vuelta en stock' : 'Marcar como agotado'}
                    >
                      <Package className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ MODALES ═══ */}
      {editando && (
        <ModalEditor
          producto={editando}
          categorias={categorias.map(([c]) => c)}
          onClose={() => setEditando(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
          onShowToast={onShowToast}
        />
      )}

      {modalTienda && (
        <ModalTienda
          tienda={tienda}
          onClose={() => setModalTienda(false)}
          onGuardar={async (t) => {
            await guardarTienda(t);
            setTienda(t);
            toast('🏪 Tienda guardada', 'La identidad de tu catálogo quedó actualizada', 'success');
          }}
          onShowToast={onShowToast}
        />
      )}

      {enviando && (
        <ModalEnviar
          producto={enviando}
          clientes={clientesEnvio}
          onClose={() => setEnviando(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};

