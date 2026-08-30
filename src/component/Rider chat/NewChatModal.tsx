// ═══════════════════════════════════════════════════════════
// ➕ NewChatModal — crear conversación nueva (Fase 3.15)
// Teléfono (9 dígitos o 51…), nombre, etiquetas y notas.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { X, User, Phone, Tag, FileText, Send } from 'lucide-react';
import { isValidWhatsAppPhone, sanitizePhone } from '../../utils/riderChatUtils';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChat: (phone: string, name: string, tags?: string[], notes?: string) => Promise<void>;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ isOpen, onClose, onCreateChat }) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('Pedido Delivery');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const clean = sanitizePhone(phone);
    if (!isValidWhatsAppPhone(clean)) {
      setError('Número inválido. Ingresa 9 dígitos (ej. 987654321) o con código país (51987654321).');
      return;
    }
    if (!name.trim()) {
      setError('Escribe el nombre del cliente.');
      return;
    }

    setIsSubmitting(true);
    try {
      const tagsArray = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onCreateChat(clean, name.trim(), tagsArray, notes.trim());
      setPhone('');
      setName('');
      setNotes('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2050] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-700 p-6 relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-2xl">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Nuevo Chat</h3>
            <p className="text-xs text-slate-400">Conversación por el WhatsApp Oficial (Meta)</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Teléfono WhatsApp *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 987 654 321 o 51987654321"
                inputMode="numeric"
                className="w-full bg-slate-800 text-white text-xs sm:text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Nombre del cliente *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Carlos Mendoza (San Isidro)"
                className="w-full bg-slate-800 text-white text-xs sm:text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Etiquetas (separadas por coma)
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Ej. Miraflores, Yape, Urgente"
                className="w-full bg-slate-800 text-white text-xs sm:text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Notas / referencia de entrega
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Dejar en recepción con el vigilante."
                className="w-full bg-slate-800 text-white text-xs sm:text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none resize-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Abrir conversación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
