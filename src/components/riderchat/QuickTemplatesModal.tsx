// ═══════════════════════════════════════════════════════════
// ⚡ QuickTemplatesModal — editor de plantillas rápidas (F3.15)
// Las plantillas de TEXTO con variables ({{cliente}}, {{monto}})
// que llenan el borrador. Se guardan en localStorage.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { X, Zap, Plus, Trash2, RotateCcw } from 'lucide-react';
import { PlantillaRapida, PLANTILLAS_RAPIDAS_DEFAULT } from '../../utils/riderChatUtils';

interface QuickTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: PlantillaRapida[];
  onSaveTemplates: (templates: PlantillaRapida[]) => void;
}

export const QuickTemplatesModal: React.FC<QuickTemplatesModalProps> = ({
  isOpen,
  onClose,
  templates,
  onSaveTemplates,
}) => {
  const [items, setItems] = useState<PlantillaRapida[]>(templates);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newTmpl: PlantillaRapida = {
      id: `tmpl_${Date.now()}`,
      title: newTitle.trim(),
      category: 'delivery',
      content: newContent.trim(),
    };

    const updated = [newTmpl, ...items];
    setItems(updated);
    onSaveTemplates(updated);

    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const updated = items.filter((t) => t.id !== id);
    setItems(updated);
    onSaveTemplates(updated);
  };

  const handleResetDefaults = () => {
    setItems(PLANTILLAS_RAPIDAS_DEFAULT);
    onSaveTemplates(PLANTILLAS_RAPIDAS_DEFAULT);
  };

  return (
    <div className="fixed inset-0 z-[2050] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-700 p-6 relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="p-3 bg-amber-500/15 text-amber-400 rounded-2xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Plantillas de Respuesta Rápida</h3>
            <p className="text-xs text-slate-400">
              Variables: <code className="text-emerald-400">{'{{cliente}}'}</code>,{' '}
              <code className="text-emerald-400">{'{{monto}}'}</code>,{' '}
              <code className="text-emerald-400">{'{{minutos}}'}</code>
            </p>
          </div>
        </div>

        {/* Formulario nueva plantilla */}
        {isAdding ? (
          <form
            onSubmit={handleAdd}
            className="mb-4 p-3.5 bg-slate-800 rounded-2xl border border-slate-700 space-y-3 shrink-0"
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título (ej. 🛵 Llegando)"
              className="w-full bg-slate-900 text-white text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-emerald-500"
              required
            />
            <textarea
              rows={2}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Mensaje (ej. ¡Hola {{cliente}}! Ya estoy en la puerta.)"
              className="w-full bg-slate-900 text-white text-xs sm:text-sm p-3 rounded-xl border border-slate-700 outline-none focus:border-emerald-500 resize-none"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold"
              >
                Guardar
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-3 flex justify-between items-center shrink-0">
            <button
              onClick={() => setIsAdding(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva
            </button>
            <button
              onClick={handleResetDefaults}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Restablecer
            </button>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {items.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-200">{tmpl.title}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed whitespace-pre-wrap">
                  {tmpl.content}
                </p>
              </div>
              <button
                onClick={() => handleDelete(tmpl.id)}
                className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
                title="Eliminar plantilla"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
