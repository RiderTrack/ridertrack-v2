import React, { useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  FileText,
  PenTool,
  CheckCircle2,
  Upload,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { Order } from '../../types';
import { Button, Card, Badge } from '../ui';

interface EvidencePanelProps {
  order: Order;
  onShowToast?: (title: string, desc?: string, type?: any) => void;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  order,
  onShowToast,
}) => {
  const [images, setImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=400&auto=format&fit=crop&q=80',
  ]);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [noteText, setNoteText] = useState('Entregado en recepción con recepcionista María Guardia.');

  const handleSimulatePhoto = () => {
    const mockPhotos = [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80',
    ];
    const newPic = mockPhotos[Math.floor(Math.random() * mockPhotos.length)];
    setImages((prev) => [...prev, newPic]);
    if (onShowToast) {
      onShowToast('Fotografía Adjuntada', 'Evidencia fotográfica de entrega subida con éxito', 'success');
    }
  };

  const handleSaveSignature = () => {
    setHasSignature(true);
    setIsSigning(false);
    if (onShowToast) {
      onShowToast('Firma Digital Guardada', 'Conformidad de entrega firmada por el cliente', 'success');
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload & Evidence Buttons Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Button
          variant="primary"
          size="sm"
          icon={<Camera className="w-4 h-4" />}
          onClick={handleSimulatePhoto}
        >
          Agregar Fotografía
        </Button>

        <Button
          variant="secondary"
          size="sm"
          icon={<PenTool className="w-4 h-4 text-purple-400" />}
          onClick={() => setIsSigning(!isSigning)}
        >
          {hasSignature ? 'Ver Firma Digital' : 'Capturar Firma'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          icon={<FileText className="w-4 h-4 text-cyan-400" />}
          onClick={() => {
            if (onShowToast) {
              onShowToast('Comprobante Generado', `Boleta Electrónica #B001-${order.id.replace('PED-', '')}`, 'info');
            }
          }}
        >
          Boleta Digital
        </Button>
      </div>

      {/* Signature Canvas Box */}
      {isSigning && (
        <Card padding="md" className="space-y-3 bg-purple-950/20 border-purple-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <PenTool className="w-4 h-4" /> Firma Digital del Cliente
            </span>
            <Badge variant="purple" size="sm">Captura Táctil</Badge>
          </div>

          <div
            onClick={handleSaveSignature}
            className="h-28 border-2 border-dashed border-purple-500/40 rounded-xl bg-slate-950/80 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 transition-colors"
          >
            {hasSignature ? (
              <div className="text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <span className="text-xs font-bold text-white block">Firma Registrada en Servidor</span>
                <span className="text-[10px] text-slate-400 font-mono">HASH: 8f9a2c-9821a</span>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <span className="text-xs text-purple-300 font-semibold block">Toca o dibuja aquí para firmar la entrega</span>
                <span className="text-[10px] text-slate-400">Captura la conformidad directa en pantalla</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Photos Gallery */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider flex items-center justify-between">
          <span>Fotografías Adjuntas ({images.length})</span>
          <span className="text-[10px] text-slate-400 font-normal">Georreferenciadas con marca de agua GPS</span>
        </label>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img, idx) => (
            <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-700 aspect-video bg-slate-900">
              <img src={img} alt={`Evidencia ${idx}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                <button
                  onClick={() => {
                    setImages(images.filter((_, i) => i !== idx));
                  }}
                  className="p-1.5 rounded-lg bg-red-600/80 text-white hover:bg-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes & Comments */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5 text-amber-400" /> Notas de Recepción
        </label>
        <textarea
          rows={2}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Añade observaciones sobre la entrega..."
          className="w-full p-3 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>
    </div>
  );
};
