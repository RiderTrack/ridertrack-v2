import React, { useState } from 'react';
import {
  Send,
  MessageSquare,
  CheckCircle2,
  Sparkles,
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
  defaultPhone = '+51 998 123 456',
  defaultName = 'Gastón Acurio',
  onSendMessage,
}) => {
  const [phone, setPhone] = useState(defaultPhone);
  const [recipientName, setRecipientName] = useState(defaultName);
  const [selectedTemplate, setSelectedTemplate] = useState(WHATSAPP_TEMPLATES[0].id);
  const [customMessage, setCustomMessage] = useState(
    '🛵 Tu repartidor Carlos Mendoza está en camino con tu pedido #PED-4092. ¡Tiempo estimado de entrega 18 min!'
  );
  const [isSentSuccess, setIsSentSuccess] = useState(false);

  const currentTpl = WHATSAPP_TEMPLATES.find((t) => t.id === selectedTemplate) || WHATSAPP_TEMPLATES[0];

  const handleApplyTemplate = (tpl: typeof WHATSAPP_TEMPLATES[0]) => {
    setSelectedTemplate(tpl.id);
    let msg = tpl.contenido;
    msg = msg.replace('{{cliente}}', recipientName || 'Cliente');
    msg = msg.replace('{{pedido_id}}', '#PED-4092');
    msg = msg.replace('{{monto}}', '145.50');
    msg = msg.replace('{{tiempo_est}}', '18');
    msg = msg.replace('{{repartidor_nombre}}', 'Carlos Mendoza');
    msg = msg.replace('{{direccion}}', 'Av. Larco 742');
    msg = msg.replace('{{link_tracking}}', 'https://ridertrack.app/track/PED-4092');
    setCustomMessage(msg);
  };

  const handleSend = () => {
    if (!phone || !customMessage) return;
    onSendMessage(recipientName, phone, customMessage, currentTpl.nombre);
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
      title="Notificación WhatsApp API"
      subtitle="Infraestructura WhatsApp Business API Oficial v2.44"
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
            {isSentSuccess ? '¡Enviado Con Éxito!' : 'Despachar WhatsApp'}
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
            placeholder="Ej: Gastón Acurio"
          />
          <Input
            label="Teléfono WhatsApp (+51)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+51 987 654 321"
          />
        </div>

        {/* Preset Templates */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Plantillas Verificadas Meta</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> WhatsApp Official
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
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
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
          />
        </div>

        {/* WhatsApp Preview Card */}
        <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
            <Smartphone className="w-3.5 h-3.5" /> Vista Previa en Celular
          </div>
          <p className="text-slate-300 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/50 leading-relaxed font-sans">
            {customMessage}
          </p>
        </div>
      </div>
    </Modal>
  );
};
