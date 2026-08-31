// ═══════════════════════════════════════════════════════════
// 💜🔷 QR VIEW (YAPE + PLIN) - RiderTrack V2 (Fase 2.2)
// Pantalla para que el rider configure sus QR de cobro:
//   1. Sus datos (número + titular) → config_empresa/{uid}
//   2. La imagen del QR (subida desde la app Yape/Plin) → comprimida
//   3. Sincronización con el bot → ruta_activa/{uid}.yape / .plin
//      (el bot las lee y manda el QR por WhatsApp)
//
// Fase 2.2: ahora con PESTAÑAS — 💜 Yape y 🔷 Plin comparten la
// misma pantalla; cada billetera guarda su propio QR y sus datos.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode, Smartphone, User, Upload, Trash2, Maximize2, Copy, Share2,
  RefreshCw, Save, CheckCircle2, XCircle, AlertTriangle, Loader2,
  Bot, Info, X, Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useConfig } from '../hooks/useConfig';
import { compartirQRWhatsApp } from '../utils/shareQR';
import {
  ConfigCuentas,
  sincronizarYapeAlBot,
  obtenerYapeDelBot,
  sincronizarPlinAlBot,
  obtenerPlinDelBot,
} from '../services/firestore';

interface YapeQRViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

// ── Utilidad: comprime una imagen a JPEG base64 (mismo approach del Modular) ──
// máx 800px de lado, calidad 0.8; si pasa ~900KB (límite Firestore) baja a 0.5
function comprimirImagen(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagen inválida'));
      img.onload = () => {
        const MAX_SIZE = 800;
        let { width, height } = img;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas no disponible')); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let base64 = canvas.toDataURL('image/jpeg', 0.8);
        if (base64.length > 900 * 1024) base64 = canvas.toDataURL('image/jpeg', 0.5);
        resolve(base64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── Utilidad: copiar al portapapeles con fallback para WebView ──
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 🎨 Tema por billetera (clases completas para Tailwind JIT)
// ═══════════════════════════════════════════════════════════

type WalletId = 'yape' | 'plin';

interface WalletTema {
  id: WalletId;
  nombre: string;
  emoji: string;
  /** Encabezado de la pantalla */
  gradHeader: string;
  iconBg: string;
  iconColor: string;
  /** Acentos */
  accentText: string;
  inputFocus: string;
  inputOk: string;
  qrBorder: string;
  btnMain: string;
  btnWa: string;
  stepChip: string;
  tipBox: string;
  /** Textos */
  titulo: string;
  subtitulo: string;
  accionBoton: string;   // "Enviar Yape" / "Enviar Plin"
  ayudaPaso2: string;    // cómo conseguir el QR en la app
  notaBot?: string;      // nota extra (solo Plin por ahora)
}

const TEMAS: Record<WalletId, WalletTema> = {
  yape: {
    id: 'yape',
    nombre: 'Yape',
    emoji: '💜',
    gradHeader: 'bg-gradient-to-br from-purple-600/20 via-slate-800 to-slate-800 border border-purple-500/30 shadow-xl',
    iconBg: 'bg-purple-500/20 border border-purple-500/40',
    iconColor: 'text-purple-300',
    accentText: 'text-purple-400',
    inputFocus: 'focus:border-purple-500',
    inputOk: 'border-emerald-600/50 focus:border-emerald-500',
    qrBorder: 'border-purple-500/40',
    btnMain: 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-600/30',
    btnWa: 'bg-green-600/15 hover:bg-green-600/25 border border-green-600/30 text-green-400',
    stepChip: 'bg-purple-500/20 text-purple-300',
    tipBox: 'bg-purple-500/10 border border-purple-500/20',
    titulo: 'Mi QR de Yape',
    subtitulo: 'Configura tu QR una vez — el bot lo envía por WhatsApp en cada cobro',
    accionBoton: '“Enviar Yape”',
    ayudaPaso2: 'Entra a “Cobrar” y busca tu código QR',
  },
  plin: {
    id: 'plin',
    nombre: 'Plin',
    emoji: '🔷',
    gradHeader: 'bg-gradient-to-br from-cyan-600/20 via-slate-800 to-slate-800 border border-cyan-500/30 shadow-xl',
    iconBg: 'bg-cyan-500/20 border border-cyan-500/40',
    iconColor: 'text-cyan-300',
    accentText: 'text-cyan-400',
    inputFocus: 'focus:border-cyan-500',
    inputOk: 'border-emerald-600/50 focus:border-emerald-500',
    qrBorder: 'border-cyan-500/40',
    btnMain: 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-lg shadow-cyan-600/30',
    btnWa: 'bg-green-600/15 hover:bg-green-600/25 border border-green-600/30 text-green-400',
    stepChip: 'bg-cyan-500/20 text-cyan-300',
    tipBox: 'bg-cyan-500/10 border border-cyan-500/20',
    titulo: 'Mi QR de Plin',
    subtitulo: 'Sube el QR de tu Plin — el bot lo tendrá listo para enviarlo por WhatsApp',
    accionBoton: '“Enviar Plin”',
    ayudaPaso2: 'Busca “Recibir dinero” / “Cobrar” y tu código QR',
    notaBot: '🔐 El bot (index.js en Termux) necesita el pequeño handler “enviar_plin” para mandar este QR solo — tus datos ya quedan listos en Firebase mientras tanto. También puedes compartirlo al toque con el botón verde.',
  },
};

// ═══════════════════════════════════════════════════════════
// 🧩 PANEL DE UNA BILLETERA (Yape o Plin)
// ═══════════════════════════════════════════════════════════

interface WalletPanelProps {
  wallet: WalletId;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const WalletPanel: React.FC<WalletPanelProps> = ({ wallet, onShowToast }) => {
  const T = TEMAS[wallet];
  const { user } = useAuth();
  const { config, loading, guardando, guardar } = useConfig();

  // Datos de la billetera (config_empresa)
  const [numero, setNumero] = useState('');
  const [titular, setTitular] = useState('');
  const [qrBase64, setQrBase64] = useState('');

  // Estado de sincronización con el bot (ruta_activa.{wallet})
  const [botSync, setBotSync] = useState<'cargando' | 'sincronizado' | 'desactualizado' | 'no_sincronizado'>('cargando');
  const [botDatos, setBotDatos] = useState<{ qrBase64?: string; numero?: string; titular?: string } | null>(null);

  // UI
  const [subiendo, setSubiendo] = useState(false);
  const [guardandoTodo, setGuardandoTodo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const [hayCambios, setHayCambios] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Leer de la config según la billetera activa
  const cfgWallet = wallet === 'yape' ? config?.yape : config?.plin;

  // Cargar datos de config_empresa al montar / cambiar config
  useEffect(() => {
    if (!config) return;
    setNumero(cfgWallet?.telefono || '');
    setTitular(cfgWallet?.nombre || '');
    setQrBase64((cfgWallet as any)?.qrBase64 || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, wallet]);

  // Ver estado de sincronización con el bot
  const verificarSyncBot = useCallback(async () => {
    if (!user) return;
    setBotSync('cargando');
    const botCfg = wallet === 'yape'
      ? await obtenerYapeDelBot(user.uid)
      : await obtenerPlinDelBot(user.uid);
    setBotDatos(botCfg);
    if (!botCfg || (!botCfg.qrBase64 && !botCfg.numero)) {
      setBotSync('no_sincronizado');
    } else {
      const igualQR = (botCfg.qrBase64 || '') === (qrBase64 || '');
      const igualDatos = (botCfg.numero || '') === (numero || '') && (botCfg.titular || '') === (titular || '');
      setBotSync(igualQR && igualDatos ? 'sincronizado' : 'desactualizado');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, wallet, qrBase64, numero, titular]);

  useEffect(() => {
    if (!loading && user) {
      verificarSyncBot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, wallet]);

  // Marcar cambios pendientes
  useEffect(() => {
    if (loading || !config) return;
    const cambio =
      (cfgWallet?.telefono || '') !== numero ||
      (cfgWallet?.nombre || '') !== titular ||
      ((cfgWallet as any)?.qrBase64 || '') !== qrBase64;
    setHayCambios(cambio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numero, titular, qrBase64, config, loading, wallet]);

  // ── Subir QR ──
  const handleSubirQR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onShowToast?.('❌ Archivo inválido', 'Sube una imagen (screenshot del QR)', 'error');
      return;
    }
    setSubiendo(true);
    try {
      const base64 = await comprimirImagen(file);
      setQrBase64(base64);
      const kb = Math.round(base64.length / 1024);
      onShowToast?.('✅ QR cargado', `${kb} KB — toca “Guardar y sincronizar” para confirmar`, 'success');
    } catch (err: any) {
      onShowToast?.('❌ Error', err.message || 'No se pudo procesar la imagen', 'error');
    } finally {
      setSubiendo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Guardar TODO: config_empresa + ruta_activa (bot) ──
  const handleGuardarYSincronizar = async () => {
    if (!user) return;
    const numLimpio = numero.replace(/\D/g, '');
    if (!numLimpio) {
      onShowToast?.('⚠️ Falta el número', `Escribe tu número asociado a ${T.nombre} (9 dígitos)`, 'warning');
      return;
    }
    if (numLimpio.length !== 9) {
      onShowToast?.('⚠️ Número inválido', `El número de ${T.nombre} debe tener 9 dígitos`, 'warning');
      return;
    }
    if (!titular.trim()) {
      onShowToast?.('⚠️ Falta el titular', 'Escribe el nombre del titular de la cuenta', 'warning');
      return;
    }
    setGuardandoTodo(true);
    try {
      // 1. Guardar en config_empresa/{uid} (fuente de verdad de v2)
      const nuevaConfig: ConfigCuentas = { ...config };
      if (wallet === 'yape') {
        nuevaConfig.yape = {
          ...config.yape,
          nombre: titular.trim(),
          telefono: numLimpio,
          qrBase64: qrBase64,
          qrUrl: '',
        };
      } else {
        nuevaConfig.plin = {
          ...config.plin,
          nombre: titular.trim(),
          telefono: numLimpio,
          qrBase64: qrBase64,
          qrUrl: '',
        };
      }
      await guardar(nuevaConfig);
      // 2. Sincronizar a ruta_activa/{uid}.{wallet} (lo que lee el bot)
      if (wallet === 'yape') {
        await sincronizarYapeAlBot(user.uid, { qrBase64, qrUrl: '', numero: numLimpio, titular: titular.trim() });
      } else {
        await sincronizarPlinAlBot(user.uid, { qrBase64, qrUrl: '', numero: numLimpio, titular: titular.trim() });
      }
      onShowToast?.(
        `${T.emoji} ${T.nombre} sincronizado`,
        qrBase64 ? 'El bot ya puede enviar tu QR por WhatsApp' : 'Datos guardados (sin imagen de QR)',
        'success'
      );
      setHayCambios(false);
      await verificarSyncBot();
    } catch (e: any) {
      onShowToast?.('❌ Error al guardar', e.message || 'Intenta de nuevo', 'error');
    } finally {
      setGuardandoTodo(false);
    }
  };

  // ── Solo re-sincronizar con el bot (sin tocar config_empresa) ──
  const handleSoloSincronizar = async () => {
    if (!user) return;
    setSincronizando(true);
    try {
      const datos = {
        qrBase64: qrBase64,
        qrUrl: '',
        numero: numero.replace(/\D/g, ''),
        titular: titular.trim(),
      };
      if (wallet === 'yape') {
        await sincronizarYapeAlBot(user.uid, datos);
      } else {
        await sincronizarPlinAlBot(user.uid, datos);
      }
      onShowToast?.('🤖 Bot actualizado', `El bot ya ve tu config de ${T.nombre} actual`, 'success');
      await verificarSyncBot();
    } catch (e: any) {
      onShowToast?.('❌ Error', e.message || 'No se pudo sincronizar', 'error');
    } finally {
      setSincronizando(false);
    }
  };

  // ── Eliminar QR ──
  const handleEliminarQR = () => {
    if (!qrBase64) return;
    if (!confirm(`¿Eliminar tu QR de ${T.nombre}?\n\nEl bot volverá a enviar SOLO el mensaje de texto (sin imagen).`)) return;
    setQrBase64('');
    onShowToast?.('🗑️ QR eliminado', 'Guarda para que el bot deje de usar la imagen', 'info');
  };

  // ── Compartir por WhatsApp (Fase 2.3: ahora con la IMAGEN del QR) ──
  const handleCompartirWhatsApp = async () => {
    const texto = `📲 Pago por ${T.nombre}\n\n📱 Número: *${numero || '—'}*\n👤 Titular: ${titular || '—'}`;
    await compartirQRWhatsApp({
      dataUrl: qrBase64 || '',
      texto,
      onShowToast,
    });
  };

  const handleCopiarDatos = async () => {
    const texto = `${T.nombre}: ${numero} — Titular: ${titular}`;
    const ok = await copiarTexto(texto);
    if (ok) onShowToast?.('📋 Copiado', texto, 'success');
    else onShowToast?.('❌ No se pudo copiar', 'Cópielo manualmente: ' + texto, 'warning');
  };

  const kbQR = qrBase64 ? Math.round(qrBase64.length / 1024) : 0;
  const numLimpioLen = numero.replace(/\D/g, '').length;

  // ── Loading (Fase 2.1: nunca infinito) ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className={`w-8 h-8 animate-spin ${T.iconColor}`} />
        <p className="text-xs text-slate-400">Cargando tu configuración de {T.nombre}…</p>
        <p className="text-[10px] text-slate-500">
          Si demora, tu conexión está lenta — la pantalla se abrirá sola en unos segundos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ ESTADO GENERAL (3 indicadores) ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${numero && titular ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
          {numero && titular
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            : <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />}
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold text-slate-400">Datos {T.nombre}</div>
            <div className={`text-xs font-bold truncate ${numero && titular ? 'text-emerald-400' : 'text-amber-400'}`}>
              {numero && titular ? 'Completos' : 'Faltan datos'}
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${qrBase64 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
          {qrBase64
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            : <ImageIcon className="w-5 h-5 text-amber-400 flex-shrink-0" />}
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold text-slate-400">Imagen QR</div>
            <div className={`text-xs font-bold truncate ${qrBase64 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {qrBase64 ? `Cargada (${kbQR} KB)` : 'Sin subir'}
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
          botSync === 'sincronizado' ? 'bg-emerald-500/10 border-emerald-500/30'
          : botSync === 'desactualizado' ? 'bg-amber-500/10 border-amber-500/30'
          : botSync === 'cargando' ? 'bg-slate-800 border-slate-700'
          : 'bg-rose-500/10 border-rose-500/30'}`}>
          {botSync === 'sincronizado' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          : botSync === 'cargando' ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin flex-shrink-0" />
          : botSync === 'desactualizado' ? <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          : <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />}
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold text-slate-400">Bot (RudyBot)</div>
            <div className={`text-xs font-bold truncate ${
              botSync === 'sincronizado' ? 'text-emerald-400'
              : botSync === 'desactualizado' ? 'text-amber-400'
              : botSync === 'cargando' ? 'text-slate-400'
              : 'text-rose-400'}`}>
              {botSync === 'sincronizado' ? 'Sincronizado'
              : botSync === 'desactualizado' ? 'Desactualizado'
              : botSync === 'cargando' ? 'Verificando…'
              : 'Sin sincronizar'}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CUERPO: 2 columnas ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ═══ COLUMNA IZQUIERDA: Datos + QR ═══ */}
        <div className="space-y-4">
          {/* ── Datos ── */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className={`w-4 h-4 ${T.accentText}`} />
              <h3 className="text-sm font-bold text-white">Mis datos {T.nombre}</h3>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Número {T.nombre} (9 dígitos)</label>
              <input
                type="tel"
                inputMode="numeric"
                value={numero}
                onChange={(e) => setNumero(e.target.value.replace(/[^\d\s]/g, ''))}
                placeholder="980811297"
                maxLength={11}
                className={`w-full bg-slate-900 text-white text-base font-mono rounded-lg px-3 py-2.5 border outline-none transition-colors ${
                  numLimpioLen === 9 ? T.inputOk : `border-slate-700 ${T.inputFocus}`
                }`}
              />
              {numero && numLimpioLen !== 9 && (
                <p className="text-[10px] text-amber-400 mt-1">⚠️ Debe tener 9 dígitos (tienes {numLimpioLen})</p>
              )}
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Titular de la cuenta</label>
              <input
                type="text"
                value={titular}
                onChange={(e) => setTitular(e.target.value)}
                placeholder={`Nombre completo como aparece en ${T.nombre}`}
                className={`w-full bg-slate-900 text-white text-sm rounded-lg px-3 py-2.5 border border-slate-700 ${T.inputFocus} outline-none`}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCompartirWhatsApp}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 ${T.btnWa} rounded-lg text-xs font-bold transition-all active:scale-95`}
              >
                <Share2 className="w-3.5 h-3.5" /> Compartir por WhatsApp
              </button>
              <button
                onClick={handleCopiarDatos}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all active:scale-95"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar
              </button>
            </div>
          </div>

          {/* ── QR de cobro ── */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className={`w-4 h-4 ${T.accentText}`} />
                <h3 className="text-sm font-bold text-white">QR de cobro</h3>
              </div>
              {qrBase64 && (
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  {kbQR} KB
                </span>
              )}
            </div>

            {/* Preview */}
            <div className="relative">
              {qrBase64 ? (
                <div className={`relative rounded-xl overflow-hidden border-2 ${T.qrBorder} bg-white`}>
                  <img src={qrBase64} alt={`QR ${T.nombre}`} className="w-full max-w-[260px] mx-auto block" />
                  <button
                    onClick={() => setAmpliado(true)}
                    className="absolute top-2 right-2 p-2 bg-slate-900/80 hover:bg-slate-900 rounded-lg text-white transition-colors"
                    title="Ampliar QR"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-slate-600 bg-slate-900/50 p-8 text-center">
                  <QrCode className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Sin QR cargado</p>
                  <p className="text-[10px] text-slate-500 mt-1">Sube el screenshot de tu QR desde la app {T.nombre}</p>
                </div>
              )}
            </div>

            {/* Acciones QR */}
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={subiendo}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 ${wallet === 'yape' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-cyan-600 hover:bg-cyan-700'} text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50`}
              >
                {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {qrBase64 ? 'Cambiar QR' : 'Subir QR'}
              </button>
              {qrBase64 && (
                <button
                  onClick={handleEliminarQR}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-bold transition-all active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleSubirQR}
              className="hidden"
            />

            {/* Botón principal */}
            <button
              onClick={handleGuardarYSincronizar}
              disabled={guardandoTodo || guardando}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
                hayCambios ? T.btnMain : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}
            >
              {guardandoTodo ? (<><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>) : (<><Save className="w-4 h-4" /> Guardar y sincronizar</>)}
            </button>
            {hayCambios && (
              <p className="text-[10px] text-amber-400 text-center font-medium">⚠️ Tienes cambios sin guardar</p>
            )}
          </div>
        </div>

        {/* ═══ COLUMNA DERECHA: Bot + ayuda ═══ */}
        <div className="space-y-4">
          {/* ── Estado del bot ── */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className={`w-4 h-4 ${T.accentText}`} />
              <h3 className="text-sm font-bold text-white">Sincronización con RudyBot</h3>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">QR que ve el bot:</span>
                {botDatos?.qrBase64 ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Imagen cargada</span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Sin imagen</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Datos que ve el bot:</span>
                {botDatos?.numero ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {botDatos.numero}</span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Sin datos</span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              El bot lee tu QR desde <span className="text-slate-300 font-mono">ruta_activa</span> en Firebase.
              Con el QR cargado, cuando toques <span className={`${T.accentText} font-bold`}>{T.accionBoton}</span> en un cliente,
              el bot le mandará <span className="text-slate-300">la imagen del QR + el mensaje de cobro</span>.
              Sin QR, el bot manda solo el mensaje de texto.
            </p>

            {T.notaBot && (
              <div className={`${T.tipBox} rounded-lg p-2.5`}>
                <p className="text-[10px] text-slate-300/90 leading-relaxed">{T.notaBot}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSoloSincronizar}
                disabled={sincronizando}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                {sincronizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Re-sincronizar bot
              </button>
              <button
                onClick={verificarSyncBot}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all active:scale-95"
                title="Verificar estado"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Cómo conseguir tu QR ── */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info className={`w-4 h-4 ${T.accentText}`} />
              <h3 className="text-sm font-bold text-white">¿Cómo consigo mi QR?</h3>
            </div>
            <ol className="space-y-2 text-[11px] text-slate-400">
              <li className="flex gap-2">
                <span className={`w-4 h-4 rounded-full ${T.stepChip} text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>1</span>
                Abre la app de <span className="text-slate-300 font-bold">{T.nombre}</span> en tu celular
              </li>
              <li className="flex gap-2">
                <span className={`w-4 h-4 rounded-full ${T.stepChip} text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>2</span>
                {T.ayudaPaso2}
              </li>
              <li className="flex gap-2">
                <span className={`w-4 h-4 rounded-full ${T.stepChip} text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>3</span>
                Toma un <span className="text-slate-300 font-bold">screenshot</span> del QR (que se vea completo y nítido)
              </li>
              <li className="flex gap-2">
                <span className={`w-4 h-4 rounded-full ${T.stepChip} text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>4</span>
                Vuelve aquí y toca <span className="text-slate-300 font-bold">“Subir QR”</span>
              </li>
              <li className="flex gap-2">
                <span className={`w-4 h-4 rounded-full ${T.stepChip} text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>5</span>
                Toca <span className="text-slate-300 font-bold">“Guardar y sincronizar”</span> — listo ✨
              </li>
            </ol>
            <div className={`${T.tipBox} rounded-lg p-2.5`}>
              <p className="text-[10px] text-slate-300/80 leading-relaxed">
                💡 El QR se guarda en Firebase una sola vez y queda sincronizado con el bot.
                Solo necesitas cambiarlo si cambias de número {T.nombre}.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MODAL: QR AMPLIADO (para mostrar en persona) ═══ */}
      {ampliado && qrBase64 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setAmpliado(false)}
        >
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setAmpliado(false)}
              className="absolute -top-11 right-0 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="bg-white rounded-2xl p-4">
              <img src={qrBase64} alt={`QR ${T.nombre} ampliado`} className="w-full block rounded-lg" />
              <div className="text-center mt-3 pb-1">
                <p className="text-sm font-black text-slate-900">{titular || T.nombre}</p>
                <p className={`text-xl font-black font-mono tracking-wider ${wallet === 'yape' ? 'text-purple-700' : 'text-cyan-700'}`}>{numero}</p>
                <p className="text-[10px] text-slate-500 mt-1">Escanea con tu app de {T.nombre} para pagar</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 📱 VISTA PRINCIPAL: pestañas Yape / Plin + header
// ═══════════════════════════════════════════════════════════

export const YapeQRView: React.FC<YapeQRViewProps> = ({ onShowToast }) => {
  const [wallet, setWallet] = useState<WalletId>('yape');
  const T = TEMAS[wallet];

  return (
    <div className="space-y-4 pb-12">
      {/* ═══ HEADER con pestañas ═══ */}
      <div className={`p-5 rounded-2xl ${T.gradHeader}`}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${T.iconBg} flex items-center justify-center flex-shrink-0`}>
            <QrCode className={`w-6 h-6 ${T.iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-white">Mis QR de cobro</h1>
            <p className="text-xs text-slate-400">Yape y Plin — configúralos una vez y el bot los envía por WhatsApp</p>
          </div>
        </div>

        {/* Pestañas de billetera */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setWallet('yape')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
              wallet === 'yape'
                ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
            }`}
          >
            💜 Yape
          </button>
          <button
            onClick={() => setWallet('plin')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
              wallet === 'plin'
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-600/30'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
            }`}
          >
            🔷 Plin
          </button>
        </div>
      </div>

      {/* Panel de la billetera activa */}
      <WalletPanel key={wallet} wallet={wallet} onShowToast={onShowToast} />
    </div>
  );
};
