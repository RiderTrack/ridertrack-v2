import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  CheckCheck,
} from 'lucide-react';
import { WhatsAppMessage } from '../types';
import { WHATSAPP_TEMPLATES } from '../data/mockData';

interface WhatsAppViewProps {
  messages: WhatsAppMessage[];
  onOpenWhatsAppModal: (phone?: string, name?: string) => void;
}

export const WhatsAppView: React.FC<WhatsAppViewProps> = ({
  messages,
  onOpenWhatsAppModal,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState(WHATSAPP_TEMPLATES[0]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              Mensajería WhatsApp
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500 text-slate-950">
                wa.me
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Plantillas rápidas e historial de mensajes despachados desde la app.
              El bot Rudy atiende los mensajes entrantes.
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenWhatsAppModal()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all"
        >
          <Send className="w-4 h-4" /> Enviar Mensaje
        </button>
      </div>

      {/* Templates & Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates Panel */}
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Plantillas Rápidas
          </h3>

          <div className="space-y-2.5">
            {WHATSAPP_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => {
                  setSelectedTemplate(tpl);
                  onOpenWhatsAppModal();
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedTemplate.id === tpl.id
                    ? 'bg-emerald-950/40 border-emerald-500 text-white'
                    : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">{tpl.nombre}</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {tpl.categoria}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {tpl.contenido}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-slate-400">
            Toca una plantilla para abrir el editor con el mensaje precargado.
          </p>
        </div>

        {/* Message History Logs (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700">
            <h3 className="font-bold text-sm text-white">Mensajes Enviados Desde la App</h3>
            <span className="text-xs font-mono text-slate-400">
              {messages.length} {messages.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Send className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="font-bold text-white text-sm">Aún no envías mensajes hoy</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Cuando despaches un WhatsApp desde la app (Pedidos, Clientes o el botón
                Enviar Mensaje), aparecerá aquí como registro de la sesión.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">
                        {msg.destinatarioNombre}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ({msg.destinatarioTelefono})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">{msg.hora}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                        <CheckCheck className="w-3 h-3" /> {msg.estado}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 leading-relaxed font-sans">
                    {msg.mensaje}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                    <span>Plantilla: {msg.plantilla}</span>
                    <span>Vía: wa.me</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
