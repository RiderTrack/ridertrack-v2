// ═══════════════════════════════════════════════════════════
// 💬 WHATSAPP API MODAL - RiderTrack V2 (Fase 3.14)
// Configuración del WhatsApp OFICIAL de Meta (Cloud API).
//
// Qué hace:
//   • Guarda Phone Number ID + token en config_empresa (lo ven
//     todos los dispositivos de la cuenta)
//   • "Probar conexión" → Meta devuelve el nombre VERIFICADO del
//     negocio (así sabes que el token está bien)
//   • "Enviar mensaje de prueba" → manda un texto real por el
//     canal oficial (para probar de punta a punta)
//
// IMPORTANTE — cómo conseguir los datos (gratis):
//   1. business.facebook.com → crea el negocio de MATE
//   2. WhatsApp Manager → API Setup → ahí están el Phone Number
//      ID y el token de prueba (temporal 24h)
//   3. Para el token PERMANENTE: System Users → generar token
//      con permiso whatsapp_business_messaging
//   (La primera conversación de cada cliente es gratis; después
//    Meta cobra por conversación iniciada.)
//
// Este es el CANAL OFICIAL — convive con el Rider chat (Baileys,
// el WhatsApp del bot). La bandeja de entrada del canal oficial
// (leer respuestas) requiere un servidor webhook: próxima fase.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Send,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { ConfigCuentas, CONFIG_CUENTAS_DEFAULT } from '../services/firestore';
import { useConfig } from '../hooks/useConfig';
import {
  ConfigWhatsAppMeta,
  probarConexion,
  enviarTexto,
} from '../services/whatsappMeta';

interface WhatsAppApiModalProps {
  onClose: () => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const WhatsAppApiModal: React.FC<WhatsAppApiModalProps> = ({ onClose, onShowToast }) => {
  const { config, loading, guardando, guardar } = useConfig();

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [token, setToken] = useState('');
  const [verToken, setVerToken] = useState(false);
  const [probando, setProbando] = useState(false);
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [numPrueba, setNumPrueba] = useState('');
  const [textoPrueba, setTextoPrueba] = useState(
    'Hola! 🛵 Mensaje de prueba desde RiderTrack por el WhatsApp oficial de Meta.'
  );

  // Cargar lo guardado
  useEffect(() => {
    if (config?.whatsappMeta) {
      setPhoneNumberId(config.whatsappMeta.phoneNumberId || '');
      setToken(config.whatsappMeta.token || '');
    }
  }, [config]);

  const cfgActual = (): ConfigWhatsAppMeta => ({
    phoneNumberId: phoneNumberId.trim(),
    token: token.trim(),
  });

  const handleGuardar = async () => {
    if (!phoneNumberId.trim() || !token.trim()) {
      onShowToast?.('⚠️ Faltan datos', 'Escribe el Phone Number ID y el token', 'warning');
      return;
    }
    try {
      await guardar({
        ...config,
        whatsappMeta: { ...cfgActual(), numero: config.whatsappMeta?.numero || '' },
      });
      onShowToast?.('💾 Guardado', 'La credencial del WhatsApp oficial quedó guardada', 'success');
    } catch (e: any) {
      onShowToast?.('❌ Error', e.message || 'No se pudo guardar', 'error');
    }
  };

  const handleProbar = async () => {
    setProbando(true);
    setEstado(null);
    try {
      // Probar con lo escrito en pantalla (aún sin guardar)
      const r = await probarConexion(cfgActual());
      setEstado({ ok: r.ok, texto: r.mensaje });
      // Si conectó, guardar el nombre verificado que devolvió Meta
      if (r.ok && r.nombreVerificado) {
        await guardar({
          ...config,
          whatsappMeta: {
            ...cfgActual(),
            numero: r.numero || config.whatsappMeta?.numero || '',
            nombreVerificado: r.nombreVerificado,
          },
        });
      }
    } finally {
      setProbando(false);
    }
  };

  const handleEnviarPrueba = async () => {
    setEnviando(true);
    try {
      const r = await enviarTexto(cfgActual(), numPrueba, textoPrueba);
      onShowToast?.(r.ok ? '✅ Enviado' : '❌ No se pudo', r.mensaje, r.ok ? 'success' : 'error');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-slate-900 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-black text-white text-base leading-tight">WhatsApp Oficial (Meta)</h2>
              <p className="text-[11px] text-slate-400">Cloud API — canal oficial del negocio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cómo conseguir los datos */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 flex gap-2.5">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-200/90 leading-relaxed">
              <b>¿De dónde salen los datos?</b> En{' '}
              <span className="text-blue-300 font-semibold">business.facebook.com</span> → tu negocio →{' '}
              <b>WhatsApp Manager → API Setup</b>: ahí está el Phone Number ID y el token de prueba.
              Para el token permanente: <b>System Users</b> → generar token con permiso{' '}
              <i>whatsapp_business_messaging</i>.
            </div>
          </div>

          {/* Credenciales */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                Phone Number ID
              </label>
              <input
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="Ej: 123456789012345"
                inputMode="numeric"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                Token de acceso
              </label>
              <div className="relative">
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  type={verToken ? 'text' : 'password'}
                  placeholder="EAAG… (token del System User)"
                  className="w-full px-3 py-2.5 pr-11 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
                <button
                  onClick={() => setVerToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-slate-700/70 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                  title={verToken ? 'Ocultar token' : 'Ver token'}
                >
                  {verToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                El token vive en config_empresa de Firebase — privado de tu cuenta.
              </p>
            </div>
          </div>

          {/* Estado de conexión */}
          {estado && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 ${
                estado.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              {estado.ok ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <p className={`text-xs leading-relaxed ${estado.ok ? 'text-emerald-200' : 'text-red-200'}`}>
                {estado.texto}
              </p>
            </div>
          )}

          {/* Botones de credencial */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold transition-colors"
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
            <button
              onClick={handleProbar}
              disabled={probando}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-colors"
            >
              {probando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Probar conexión
            </button>
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="h-px bg-slate-700/70 flex-1" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prueba de punta a punta</span>
            <div className="h-px bg-slate-700/70 flex-1" />
          </div>

          {/* Enviar mensaje de prueba */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                Enviar mensaje de prueba a
              </label>
              <input
                value={numPrueba}
                onChange={(e) => setNumPrueba(e.target.value)}
                placeholder="51 + 9 dígitos (ej: 51987654321)"
                inputMode="numeric"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Meta solo permite escribirle a números que le hayan escrito antes (o usar plantillas).
              </p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                Mensaje
              </label>
              <textarea
                value={textoPrueba}
                onChange={(e) => setTextoPrueba(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 resize-none"
              />
            </div>
            <button
              onClick={handleEnviarPrueba}
              disabled={enviando || !numPrueba.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm font-bold transition-colors"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar mensaje de prueba
            </button>
          </div>

          {/* Aclaración de contexto */}
          <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 flex gap-2.5">
            <MessageCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <b className="text-slate-300">¿Y el Rider chat?</b> Sigue tal cual — es el WhatsApp del bot
              (Baileys) y es el canal del día a día. Este canal oficial es aparte: sale del número del
              NEGOCIO verificado, con la calidad y el respaldo de Meta. La bandeja para LEER respuestas
              por este canal (necesita un pequeño servidor webhook) viene en la próxima fase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
