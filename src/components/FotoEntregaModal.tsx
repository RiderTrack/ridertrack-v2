// ═══════════════════════════════════════════════════════════
// 📷 FOTO ENTREGA MODAL - RiderTrack V2
// Modal para tomar/subir foto de evidencia de entrega
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Loader2, CheckCircle2, MapPin } from 'lucide-react';
import { Cliente } from '../services/firestore';
import { useClientes } from '../hooks/useClientes';
import { useAuth } from '../hooks/useAuth';

interface FotoEntregaModalProps {
  cliente: Cliente;
  onClose: () => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const FotoEntregaModal: React.FC<FotoEntregaModalProps> = ({ cliente, onClose, onShowToast }) => {
  const { user } = useAuth();
  const { guardarFotoEntrega } = useClientes();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [exito, setExito] = useState(false);
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    setArchivo(file);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubir = async () => {
    if (!archivo) {
      onShowToast?.('⚠️ Falta foto', 'Toma o sube una foto primero', 'warning');
      return;
    }
    if (!user) {
      onShowToast?.('❌ Error', 'No hay sesión activa', 'error');
      return;
    }

    setSubiendo(true);
    onShowToast?.('📸 Subiendo', 'Subiendo foto de entrega...', 'info');

    try {
      const fotoUrl = await guardarFotoEntrega(cliente.id, archivo);
      setExito(true);
      onShowToast?.('✅ Foto guardada', 'Evidencia de entrega registrada', 'success');

      // Cerrar después de 1.5s
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e: any) {
      console.error('❌ Error subiendo foto entrega:', e);
      onShowToast?.('❌ Error', e.message || 'No se pudo subir la foto', 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const limpiar = () => {
    setArchivo(null);
    setPreview(null);
    setExito(false);
    if (camaraRef.current) camaraRef.current.value = '';
    if (galeriaRef.current) galeriaRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => !subiendo && onClose()}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            Foto de Entrega
          </h3>
          <button onClick={() => !subiendo && onClose()} disabled={subiendo} className="text-slate-400 hover:text-white disabled:opacity-30">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card del cliente */}
        <div className="bg-slate-800 rounded-lg p-3 mb-3 text-xs">
          <div className="font-bold text-white text-sm">{cliente.nombre}</div>
          <div className="text-slate-400 mt-0.5">{cliente.prod || 'Sin producto'} · 📱 {cliente.cel || '—'}</div>
          <div className="mt-1 text-emerald-400 font-bold">S/ {parseFloat(String(cliente.cobrar || 0)).toFixed(2)}</div>
          {cliente.dir && <div className="text-slate-500 mt-1 text-[10px]">📍 {cliente.dir} · {cliente.dist}</div>}
        </div>

        {/* Inputs ocultos */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={camaraRef}
          onChange={e => handleFile(e.target.files?.[0] || null)}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*"
          ref={galeriaRef}
          onChange={e => handleFile(e.target.files?.[0] || null)}
          className="hidden"
        />

        {/* Preview o botones de cámara/galería */}
        {preview ? (
          <div className="relative mb-3">
            <img src={preview} alt="Evidencia" className="w-full max-h-64 object-contain rounded-lg border border-slate-700" />
            <button
              onClick={limpiar}
              disabled={subiendo}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 transition-all disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
            {exito && (
              <div className="absolute inset-0 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <div className="bg-slate-900/90 rounded-xl p-3 flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  <span className="text-white text-sm font-bold">¡Foto guardada!</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => camaraRef.current?.click()}
              disabled={subiendo}
              className="flex flex-col items-center gap-1 p-4 rounded-xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 transition-all active:scale-95 disabled:opacity-50"
            >
              <Camera className="w-6 h-6" />
              <div className="text-[11px] font-bold">📷 Tomar foto</div>
              <div className="text-[9px] text-slate-500">Abre la cámara</div>
            </button>
            <button
              onClick={() => galeriaRef.current?.click()}
              disabled={subiendo}
              className="flex flex-col items-center gap-1 p-4 rounded-xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 transition-all active:scale-95 disabled:opacity-50"
            >
              <Upload className="w-6 h-6" />
              <div className="text-[11px] font-bold">🖼️ Subir imagen</div>
              <div className="text-[9px] text-slate-500">De la galería</div>
            </button>
          </div>
        )}

        {/* Info */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 mb-3">
          <div className="text-[10px] text-emerald-400/70 uppercase font-bold mb-0.5">📌 Información</div>
          <div className="text-[10px] text-slate-300 leading-relaxed">
            La foto se guardará como evidencia de entrega del cliente y se sincronizará con el RiderTrack Modular automáticamente.
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          <button
            onClick={() => !subiendo && onClose()}
            disabled={subiendo}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubir}
            disabled={subiendo || !archivo || exito}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {subiendo ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Subiendo...
              </>
            ) : exito ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Guardado
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Guardar foto
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
