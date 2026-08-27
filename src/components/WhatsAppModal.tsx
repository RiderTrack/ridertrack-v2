import React, { useState, useEffect } from 'react';
import {
  Send,
  MessageSquare,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { WHATSAPP_TEMPLATES } from '../data/mockData';
import { Modal, Button, Input } from './ui';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPhone?: string;
  defaultName?: string;
  onSendMessage: (destName: string, phone: string, text: string, templateName: string) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  defaultPhone,
  defaultName,
  onSendMessage,
}) => {
  const [phone, setPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(WHATSAPP_TEMPLATES[0].id);
  const [customMessage, setCustomMessage] = useState('');
  const [isSentSuccess, setIsSentSuccess] = useState(false);
  const [error, setError] = useState('');

  // 🔄 Sincronizar destinatario real cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setPhone(defaultPhone || '');
      setRecipientName(defaultName || '');
      setError('');
      setIsSentSuccess(false);
      // Precargar primera plantilla con el nombre del cliente
      const tpl = WHATSAPP_TEMPLATES[0];
      setSelectedTemplate(tpl.id);
      setCustomMessage(
        tpl.contenido.replace(/\{\{cliente\}\}/g, defaultName || 'cliente')
      );
    }
  }, [isOpen, defaultPhone, defaultName]);

  const handleApplyTemplate = (tpl: typeof WHATSAPP_TEMPLATES[0]) => {
    setSelectedTemplate(tpl.id);
    let msg = tpl.contenido;
    msg = msg.replace(/\{\{cliente\}\}/g, recipientName || 'cliente');
    setCustomMessage(msg);
  };

  const currentTplNombre = () =>
    WHATSAPP_TEMPLATES.find((t) => t.id === selectedTemplate)?.nombre || 'Personalizado';

  const handleSend = () => {
    const digits = (phone || '').replace(/[^0-9]/g, '');
    if (!digits) {
      setError('Ingresa un número de WhatsApp (9 dígitos)');
      return;
    }
    if (digits.length !== 9 && digits.length !== 11) {
      setError('El número debe tener 9 dígitos (ej: 987654321)');
      return;
    }
    if (!customMessage.trim()) {
      setError('Escribe el mensaje a enviar');
      return;
    }
    setError('');
    onSendMessage(recipientName, phone, customMessage, currentTplNombre());
    setIsSentSuccess(true);
    setTimeout(() => {
      setIsSentSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enviar WhatsApp"
      subtitle="Se abre WhatsApp con el mensaje listo para confirmar el envío"
      maxWidth="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="whatsapp"
            size="sm"
            icon={isSentSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            onClick={handleSend}
            isLoading={isSentSuccess}
          >
            {isSentSuccess ? '¡Abierto en WhatsApp!' : 'Enviar por WhatsApp'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Recipient inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Nombre Destinatario"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Ej: María Flores"
          />
          <Input
            label="Teléfono (9 dígitos)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="987654321"
          />
        </div>

        {/* Preset Templates */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Plantillas Rápidas</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> wa.me
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {WHATSAPP_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleApplyTemplate(tpl)}
                className={`p-2.5 text-left rounded-xl border text-xs font-medium transition-all ${
                  selectedTemplate === tpl.id
                    ? 'bg-blue-600/20 border-blue-500 text-white'
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                <span className="block font-bold truncate">{tpl.nombre}</span>
                <span className="text-[10px] text-slate-400">{tpl.categoria}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message Area */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Contenido del Mensaje
          </label>
          <textarea
            rows={4}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="w-full p-3 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 resize-none"
            placeholder="Escribe tu mensaje..."
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5">
            ⚠️ {error}
          </p>
        )}

        {/* WhatsApp Preview Card */}
        <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
            <Smartphone className="w-3.5 h-3.5" /> Vista Previa
          </div>
          <p className="text-slate-300 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/50 leading-relaxed font-sans">
            {customMessage || 'Tu mensaje aparecerá aquí...'}
          </p>
        </div>
      </div>
    </Modal>
  );
};
