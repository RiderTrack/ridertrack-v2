// ═══════════════════════════════════════════════════════════
// 💬 WHATSAPP API MODAL - RiderTrack V2 (Fase 3.14 → 3.15)
// Configuración del WhatsApp OFICIAL de Meta (Cloud API).
//
// Qué hace:
//   • Guarda Phone Number ID + token en config_empresa (lo ven
//     todos los dispositivos de la cuenta)
//   • "Probar conexión" → DIAGNÓSTICO POR PASOS (F3.15):
//     Paso 1 valida el token, Paso 2 valida el Phone Number ID.
//     Si pusiste el teléfono en vez del ID (el error 400 más
//     común), te lo dice con guía de dónde sacar el correcto.
//   • "Enviar mensaje de prueba" → manda un texto real por el
//     canal oficial (para probar de punta a punta)
//
// IMPORTANTE — el error 400 clásico:
//   Phone Number ID ≠ número de teléfono. El ID es un código
//   largo (13-17 dígitos) que sale en business.facebook.com →
//   WhatsApp Manager → API Setup, o en la config de tu robot
//   de Meta (phone_number_id).
//
// Este es el CANAL OFICIAL — convive con el Rider chat (Baileys,
// el WhatsApp del bot). El chat completo vive en la pestaña
// "Rider Chat Oficial" (Fase 3.15).
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
  CheckCircle2,
  XCircle,
  Lightbulb,
} from 'lucide-react';
import { ConfigCuentas } from '../services/firestore';
import { useConfig } from '../hooks/useConfig';
import {
  ConfigWhatsAppMeta,
  diagnosticarConexion,
  DiagnosticoMeta,
  enviarTexto,
  pareceTelefono,
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
  const [diagnostico, setDiagnostico] = useState<DiagnosticoMeta | null>(null);
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
    setDiagnostico(null);
    try {
      // Diagnóstico completo con lo escrito en pantalla (aún sin guardar)
      const d = await diagnosticarConexion(cfgActual());
      setDiagnostico(d);
      // Si conectó, guardar el nombre verificado que devolvió Meta
      if (d.ok) {
        await guardar({
          ...config,
          whatsappMeta: {
            phoneNumberId: d.idResuelto || cfgActual().phoneNumberId,
            token: cfgActual().token,
            numero: d.numero || config.whatsappMeta?.numero || '',
            nombreVerificado: d.nombreVerificado || config.whatsappMeta?.nombreVerificado || '',
          },
        });
        // Si Meta aceptó una variante del ID (ej: sin espacios/+), la dejamos puesta
        if (d.idResuelto && d.idResuelto !== phoneNumberId.trim()) {
          setPhoneNumberId(d.idResuelto);
        }
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

  const avisoTelefono = pareceTelefono(String(phoneNumberId || ''));

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
              <b>WhatsApp Manager → API Setup</b>: ahí está el <b>Phone Number ID</b> y el token de prueba.
              ⚠️ El Phone Number ID <b>NO es el número de teléfono</b>: es un código largo (13-17 dígitos).
              Si ya tienes un robot de Meta, el ID está en su configuración (búscalo como{' '}
              <i>phone_number_id</i>). Para el token permanente: <b>System Users</b> → generar token con
              permiso <i>whatsapp_business_messaging</i>.
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
                placeholder="Ej: 1272517762604297 (código largo, NO el 51…)"
                inputMode="numeric"
                className={`w-full px-3 py-2.5 rounded-xl bg-slate-800 border text-white text-sm placeholder:text-slate-500 focus:outline-none ${
                  avisoTelefono
                    ? 'border-amber-500/60 focus:border-amber-400'
                    : 'border-slate-700 focus:border-emerald-500/60'
                }`}
              />
              {avisoTelefono && (
                <p className="text-[10px] text-amber-400 mt-1 font-medium">
                  ⚠️ Eso parece un NÚMERO de teléfono — el Phone Number ID es un código largo distinto.
                </p>
              )}
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

          {/* Diagnóstico por pasos (F3.15) */}
          {diagnostico && (
            <div
              className={`p-3.5 rounded-xl border space-y-2.5 ${
                diagnostico.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-start gap-2">
                {diagnostico.ok ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <p
                  className={`text-xs leading-relaxed font-medium ${
                    diagnostico.ok ? 'text-emerald-200' : 'text-red-200'
                  }`}
                >
                  {diagnostico.mensaje}
                </p>
              </div>

              {/* Pasos */}
              {diagnostico.pasos.map((p, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60"
                >
                  {p.estado === 'ok' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-200">{p.titulo}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed break-words">{p.detalle}</p>
                  </div>
                </div>
              ))}

              {/* Pista accionable */}
              {diagnostico.pista && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">{diagnostico.pista}</p>
                </div>
              )}
            </div>
          )}

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
              <b className="text-slate-300">¿Y el Rider chat?</b> ¡Ya está acoplado al panel! 🎉 La pestaña{' '}
              <b className="text-emerald-400">Rider Chat Oficial</b> (menú → Operación) es el chat completo
              con este canal: conversaciones, plantillas y broadcast. El Chat Baileys (bot Rudy) sigue tal
              cual en su pestaña — es el canal del día a día.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
