// ═══════════════════════════════════════════════════════════
// 💬 AvisoChatToast — el aviso flotante de "te escribieron"
// (Fase 3.17)
//
// Cuando un cliente escribe al Chat Baileys o al Rider Chat
// (Meta) y NO estás viendo ese chat, aparece esta tarjetita
// arriba a la derecha (arriba centrada en móvil): foto o inicial,
// quién te escribió, de qué canal viene, el mensaje completo
// recortado y el botón "Ver chat" que te lleva directo a la
// conversación (cambia de pestaña y abre el chat aunque estés
// en Mi Ruta, Pedidos o donde sea).
//
// La cola vive en App.tsx (máx. 3 visibles); este componente es
// presentación pura: sin timers ni efectos, solo pinta y avisa.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { X, MessageCircle, ArrowRight } from 'lucide-react';
import { AvisoChat, truncarPreview } from '../services/avisosChat';
import { fotoDeCliente, suscribirFotosPerfil } from '../services/fotosPerfil';
import { getAvatarPalette, getInitials } from '../utils/riderChatUtils';

interface AvisoChatToastProps {
  /** Avisos visibles (App ya recortó la cola a 3) */
  avisos: AvisoChat[];
  onVer: (aviso: AvisoChat) => void;
  onCerrar: (id: string) => void;
}

/** Avatar del aviso: foto real si existe, si no inicial con paleta.
 *  Se SUSCRIBE al mapa de fotos — si la foto llega un instante después
 *  (el listener de Firestore acaba de traerla), el aviso se repinta. */
const AvatarAviso: React.FC<{ aviso: AvisoChat }> = ({ aviso }) => {
  const [rota, setRota] = useState(false);
  const [foto, setFoto] = useState<string | undefined>(() =>
    aviso.tel !== 'GRUPO_MATE' ? fotoDeCliente(aviso.tel) : undefined
  );
  useEffect(() => {
    if (aviso.tel === 'GRUPO_MATE') return;
    // Re-pintar cuando el mapa vivo de fotos se actualice
    return suscribirFotosPerfil(() => setFoto(fotoDeCliente(aviso.tel)));
  }, [aviso.tel]);
  const palette = getAvatarPalette(aviso.nombre || '?');

  if (foto && !rota) {
    return (
      <img
        src={foto}
        alt={aviso.nombre}
        onError={() => setRota(true)}
        referrerPolicy="no-referrer"
        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-emerald-500/40 shadow-md bg-slate-700"
      />
    );
  }
  return (
    <div
      className={`w-10 h-10 rounded-full ${palette.bg} ${palette.text} font-black text-sm flex items-center justify-center flex-shrink-0 border-2 ${palette.border} shadow-inner select-none`}
    >
      {aviso.tel === 'GRUPO_MATE' ? '👥' : getInitials(aviso.nombre || '?')}
    </div>
  );
};

export const AvisoChatToast: React.FC<AvisoChatToastProps> = ({ avisos, onVer, onCerrar }) => {
  if (!avisos.length) return null;

  return (
    <div className="fixed top-20 right-2 sm:right-4 z-[70] flex flex-col gap-2 w-[calc(100vw-1rem)] sm:w-80 pointer-events-none">
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          role="alert"
          className="pointer-events-auto flex items-start gap-2.5 p-3 rounded-2xl border border-emerald-500/40 bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-emerald-500/10 animate-in slide-in-from-right-5 fade-in duration-300"
        >
          <AvatarAviso aviso={aviso} />

          <div className="flex-1 min-w-0">
            {/* Nombre + canal */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-white truncate">{aviso.nombre}</span>
              <span
                className={`flex items-center gap-0.5 px-1.5 py-px rounded-full text-[8px] font-black uppercase tracking-wide shrink-0 ${
                  aviso.canal === 'baileys'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                }`}
                title={aviso.canal === 'baileys' ? 'Chat Baileys (bot Rudy)' : 'Rider Chat (WhatsApp Oficial)'}
              >
                <MessageCircle className="w-2 h-2" />
                {aviso.canal === 'baileys' ? 'Baileys' : 'Meta'}
              </span>
            </div>

            {/* El mensaje */}
            <p className="text-[11px] text-slate-300 leading-snug mt-0.5 line-clamp-2 break-words">
              {truncarPreview(aviso.texto)}
            </p>

            {/* Ver chat */}
            <button
              onClick={() => onVer(aviso)}
              className="mt-1.5 flex items-center gap-1 text-[10px] font-black text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Ver chat
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={() => onCerrar(aviso.id)}
            className="text-slate-500 hover:text-white p-1 rounded-lg transition-colors shrink-0"
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
