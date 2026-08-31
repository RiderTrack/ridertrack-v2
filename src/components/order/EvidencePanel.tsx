import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  Image as ImageIcon,
  StickyNote,
  Trash2,
  Upload,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Order } from '../../types';
import { Button, Card, Badge } from '../ui';

interface EvidencePanelProps {
  order: Order;
  onGuardarFoto?: (orderId: string, blob: Blob, dataUrl: string) => void;
  onGuardarNota?: (orderId: string, nota: string) => void;
  onEliminarFoto?: (orderId: string) => void;
  onShowToast?: (title: string, desc?: string, type?: any) => void;
}

/**
 * Comprime una imagen con canvas (máx 800px, JPEG).
 * Igual que el Rider Modular y la pantalla Mi QR Yape.
 */
async function comprimirImagen(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  const dataUrlOriginal = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrlOriginal;
  });

  const maxLado = 800;
  const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
  const w = Math.round(img.width * escala);
  const h = Math.round(img.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.drawImage(img, 0, 0, w, h);

  let calidad = 0.8;
  let dataUrl = canvas.toDataURL('image/jpeg', calidad);
  // Si sigue muy pesado (>900KB), recomprimir más
  while (dataUrl.length > 900_000 * 1.37 && calidad > 0.4) {
    calidad -= 0.15;
    dataUrl = canvas.toDataURL('image/jpeg', calidad);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))),
      'image/jpeg',
      calidad
    );
  });

  return { blob, dataUrl };
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  order,
  onGuardarFoto,
  onGuardarNota,
  onEliminarFoto,
  onShowToast,
}) => {
  const inputCamaraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [nota, setNota] = useState(order.nota || '');
  const [notaGuardada, setNotaGuardada] = useState(false);

  // Sincronizar nota si el pedido cambia (foto/nota llegan por props)
  useEffect(() => {
    setNota(order.nota || '');
  }, [order.id, order.nota]);

  const foto = order.fotoUrl || '';
  const pesoKB = foto.startsWith('data:')
    ? Math.round((foto.length * 0.75) / 1024)
    : null;

  const procesarArchivo = async (file: File | undefined) => {
    if (!file || !onGuardarFoto) return;
    if (!file.type.startsWith('image/')) {
      onShowToast?.('Archivo no válido', 'Selecciona una imagen (JPG/PNG)', 'warning');
      return;
    }
    setSubiendo(true);
    try {
      const { blob, dataUrl } = await comprimirImagen(file);
      await onGuardarFoto(order.id, blob, dataUrl);
    } catch (e: any) {
      onShowToast?.('Error al procesar foto', e?.message || 'Intenta con otra imagen', 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const handleGuardarNota = () => {
    if (!onGuardarNota) return;
    onGuardarNota(order.id, nota);
    setNotaGuardada(true);
    setTimeout(() => setNotaGuardada(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Botones de captura */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Button
          variant="primary"
          size="sm"
          icon={subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          onClick={() => inputCamaraRef.current?.click()}
          disabled={subiendo}
        >
          {subiendo ? 'Guardando...' : 'Tomar Foto'}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          icon={<Upload className="w-4 h-4 text-blue-400" />}
          onClick={() => inputGaleriaRef.current?.click()}
          disabled={subiendo}
        >
          Subir de Galería
        </Button>

        {foto && onEliminarFoto && (
          <Button
            variant="outline"
            size="sm"
            icon={<Trash2 className="w-4 h-4 text-red-400" />}
            onClick={() => {
              if (confirm('¿Eliminar la foto de evidencia?')) {
                onEliminarFoto(order.id);
              }
            }}
          >
            Quitar Foto
          </Button>
        )}
      </div>

      {/* Inputs ocultos: cámara y galería */}
      <input
        ref={inputCamaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          procesarArchivo(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={inputGaleriaRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          procesarArchivo(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* Foto de evidencia */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-purple-400" /> Foto de Evidencia
          </span>
          {foto && (
            <Badge variant="purple" size="sm">
              Guardada{pesoKB ? ` · ${pesoKB} KB` : ''}
            </Badge>
          )}
        </label>

        {foto ? (
          <div className="grid grid-cols-1 gap-3">
            <div className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
              <img src={foto} alt={`Evidencia de ${order.cliente}`} className="w-full object-cover max-h-72" />
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <button
                  onClick={() => window.open(foto, '_blank')}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/90 text-white text-xs font-bold"
                >
                  Ver en grande
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              La foto queda guardada en Firestore y sincronizada con la ruta — el bot puede enviarla como comprobante.
            </p>
          </div>
        ) : (
          <div className="p-6 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/50 text-center space-y-2">
            <Camera className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              Sin foto todavía. Toma una foto de la entrega o sube una de tu galería —
              se comprime automáticamente para no pesar en Firestore.
            </p>
          </div>
        )}
      </div>

      {/* Nota de entrega (real: se guarda en el cliente) */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5 text-amber-400" /> Nota de Entrega
        </label>
        <textarea
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: entregado en recepción, firma de María..."
          className="w-full p-3 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            Se guarda en la ruta y la ve el bot Rudy.
          </span>
          <Button
            variant={notaGuardada ? 'success' : 'secondary'}
            size="xs"
            icon={notaGuardada ? <CheckCircle2 className="w-3.5 h-3.5" /> : undefined}
            onClick={handleGuardarNota}
            disabled={!onGuardarNota}
          >
            {notaGuardada ? 'Guardada' : 'Guardar Nota'}
          </Button>
        </div>
      </div>

      {/* Observación original del pedido (solo lectura) */}
      {order.obs && (
        <Card padding="sm" className="bg-slate-900 border-slate-700">
          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
            Observación del Pedido (original)
          </span>
          <p className="text-xs text-slate-300">{order.obs}</p>
        </Card>
      )}
    </div>
  );
};
