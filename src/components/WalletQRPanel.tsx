// ═══════════════════════════════════════════════════════════
// 💳 WALLET QR PANEL — Fase 1.5
// Panel genérico de billetera (Yape 💜 / Plin 💚):
//   1. Datos (número + titular) → config_empresa/{uid}.{wallet}
//   2. Imagen del QR (screenshot desde la app del banco) → comprimida
//   3. Sincronización con el bot → ruta_activa/{uid}.{wallet}
// Antes era solo Yape; ahora la misma pantalla sirve para Plin.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode, Smartphone, User, Upload, Trash2, Maximize2, Copy, Share2,
  RefreshCw, Save, CheckCircle2, XCircle, AlertTriangle, Loader2,
  Bot, Info, X, Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useConfig } from '../hooks/useConfig';
import { ConfigCuentas } from '../services/firestore';

export interface WalletBotConfig {
  qrBase64?: string;
  qrUrl?: string;
  numero: string;
  titular: string;
}

export interface WalletTema {
  /** 'yape' | 'plin' — clave en config_empresa y ruta_activa */
  key: 'yape' | 'plin';
  nombreApp: string;
  emoji: string;
  /** texto del header */
  titulo: string;
  subtitulo: string;
  /** clases tailwind del acento */
  accentText: string;
  accentBgSolid: string;
  accentChip: string;
  accentBorder: string;
  headerGradient: string;
  botonPrincipal: string;
  pasos: string[];
  tipFinal: string;
  whatsappTexto: (numero: string, titular: string) => string;
}

interface PanelProps {
  tema: WalletTema;
  onSync: (userId: string, cfg: WalletBotConfig) => Promise<void>;
  onFetch: (userId: string) => Promise<WalletBotConfig | null>;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

// ── Utilidad: comprime una imagen a JPEG base64 ──
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
          if (width >= height) {
            height = Math.round(height * (MAX_SIZE / width));
            width = MAX_SIZE;
          } else {
            width = Math.round(width * (MAX_SIZE / height));
            height = MAX_SIZE;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas no disponible')); return; }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let base64 = canvas.toDataURL('image/jpeg', 0.8);
        if (base64.length > 900000) {
          base64 = canvas.toDataURL('image/jpeg', 0.5);
        }
        resolve(base64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── Utilidad: copiar al portapapeles con fallback WebView ──
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

export const WalletQRPanel: React.FC<PanelProps> = ({ tema, onSync, onFetch, onShowToast }) => {
  const { user } = useAuth();
  const { config, loading, guardando, guardar } = useConfig();

  const [numero, setNumero] = useState('');
  const [titular, setTitular] = useState('');
  const [qrBase64, setQrBase64] = useState('');

  const [botSync, setBotSync] = useState<'cargando' | 'sincronizado' | 'desactualizado' | 'no_sincronizado'>('cargando');
  const [botCfg, setBotCfg] = useState<WalletBotConfig | null>(null);

  const [subiendo, setSubiendo] = useState(false);
  const [guardandoTodo, setGuardandoTodo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const [hayCambios, setHayCambios] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const walletCfg = tema.key === 'yape' ? config.yape : config.plin;

  // Cargar datos de config_empresa
  useEffect(() => {
    if (!config) return;
    const w = tema.key === 'yape' ? config.yape : config.plin;
    setNumero(w?.telefono || '');
    setTitular(w?.nombre || '');
    setQrBase64(w?.qrBase64 || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, tema.key]);

  // Verificar sincronización con el bot
  const verificarSyncBot = useCallback(async () => {
    if (!user) return;
    setBotSync('cargando');
    const delBot = await onFetch(user.uid);
    setBotCfg(delBot);
    if (!delBot || (!delBot.qrBase64 && !delBot.numero)) {
      setBotSync('no_sincronizado');
    } else {
      const igualQR = (delBot.qrBase64 || '') === (qrBase64 || '');
      const igualDatos = (delBot.numero || '') === (numero || '') && (delBot.titular || '') === (titular || '');
      setBotSync(igualQR && igualDatos ? 'sincronizado' : 'desactualizado');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, qrBase64, numero, titular, tema.key]);

  useEffect(() => {
    if (!loading && user) {
      verificarSyncBot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, tema.key]);

  // Marcar cambios pendientes
  useEffect(() => {
    if (loading || !config) return;
    const w = tema.key === 'yape' ? config.yape : config.plin;
    const cambio =
      (w?.telefono || '') !== numero ||
      (w?.nombre || '') !== titular ||
      (w?.qrBase64 || '') !== qrBase64;
    setHayCambios(cambio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numero, titular, qrBase64, config, loading, tema.key]);

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
      onShowToast?.('✅ QR cargado', `${kb} KB — toca "Guardar y sincronizar" para confirmar`, 'success');
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
    if (!numLimpio || numLimpio.length !== 9) {
      onShowToast?.('⚠️ Número inválido', `El número ${tema.nombreApp} debe tener 9 dígitos`, 'warning');
      return;
    }
    if (!titular.trim()) {
      onShowToast?.('⚠️ Falta el titular', 'Escribe el nombre del titular de la cuenta', 'warning');
      return;
    }
    setGuardandoTodo(true);
    try {
      const nuevaConfig: ConfigCuentas = {
        ...config,
        [tema.key]: {
          nombre: titular.trim(),
          telefono: numLimpio,
          qrBase64: qrBase64,
          qrUrl: '',
        },
      } as ConfigCuentas;

      await guardar(nuevaConfig);
      await onSync(user.uid, {
        qrBase64: qrBase64,
        qrUrl: '',
        numero: numLimpio,
        titular: titular.trim(),
      });
      onShowToast?.(
        `${tema.emoji} ${tema.nombreApp} sincronizado`,
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

  // ── Solo re-sincronizar con el bot ──
  const handleSoloSincronizar = async () => {
    if (!user) return;
    setSincronizando(true);
    try {
      await onSync(user.uid, {
        qrBase64: qrBase64,
        qrUrl: '',
        numero: numero.replace(/\D/g, ''),
        titular: titular.trim(),
      });
      onShowToast?.('🤖 Bot actualizado', `El bot ya ve tu config de ${tema.nombreApp} actual`, 'success');
      await verificarSyncBot();
    } catch (e: any) {
      onShowToast?.('❌ Error', e.message || 'No se pudo sincronizar', 'error');
    } finally {
      setSincronizando(false);
    }
  };

  const handleEliminarQR = () => {
    if (!qrBase64) return;
    if (!confirm(`¿Eliminar tu QR de ${tema.nombreApp}?\n\nEl bot volverá a enviar SOLO el mensaje de texto.`)) return;
    setQrBase64('');
    onShowToast?.('🗑️ QR eliminado', 'Guarda para que el bot deje de usar la imagen', 'info');
  };

  const handleCompartirWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(tema.whatsappTexto(numero, titular))}`, '_blank');
  };

  const handleCopiarDatos = async () => {
    const texto = `${tema.nombreApp}: ${numero} — Titular: ${titular}`;
    const ok = await copiarTexto(texto);
    if (ok) onShowToast?.('📋 Copiado', texto, 'success');
    else onShowToast?.('❌ No se pudo copiar', 'Cópielo manualmente: ' + texto, 'warning');
  };

  const kbQR = qrBase64 ? Math.round(qrBase64.length / 1024) : 0;
  const numLimpioLen = numero.replace(/\D/g, '').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className={`w-8 h-8 animate-spin ${tema.accentText}`} />
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
            <div className="text-[10px] uppercase font-bold text-slate-400">Datos {tema.nombreApp}</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ═══ COLUMNA IZQUIERDA: Datos + QR ═══ */}
        <div className="space-y-4">
          {/* ── Datos ── */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className={`w-4 h-4 ${tema.accentText}`} />
              <h3 className="text-sm font-bold text-white">Mis datos {tema.nombreApp}</h3>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Número {tema.nombreApp} (9 dígitos)</label>
              <input
                type="tel"
                inputMode="numeric"
                value={numero}
                onChange={(e) => setNumero(e.target.value.replace(/[^\d\s]/g, ''))}
                placeholder="980811297"
                maxLength={11}
                className={`w-full bg-slate-900 text-white text-base font-mono rounded-lg px-3 py-2.5 border outline-none transition-colors ${
                  numLimpioLen === 9 ? 'border-emerald-600/50 focus:border-emerald-500' : 'border-slate-700 focus:border-purple-500'
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
                placeholder={`Nombre completo como aparece en ${tema.nombreApp}`}
                className="w-full bg-slate-900 text-white text-sm rounded-lg px-3 py-2.5 border border-slate-700 focus:border-purple-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCompartirWhatsApp}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600/15 hover:bg-green-600/25 border border-green-600/30 text-green-400 rounded-lg text-xs font-bold transition-all active:scale-95"
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
                <QrCode className={`w-4 h-4 ${tema.accentText}`} />
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
                <div className={`relative rounded-xl overflow-hidden border-2 ${tema.accentBorder} bg-white`}>
                  <img src={qrBase64} alt={`QR ${tema.nombreApp}`} className="w-full max-w-[260px] mx-auto block" />
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
                  <p className="text-[10px] text-slate-500 mt-1">{tema.subtitulo}</p>
                </div>
              )}
            </div>

            {/* Acciones QR */}
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={subiendo}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 ${tema.accentBgSolid} text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50`}
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
                hayCambios
                  ? `${tema.botonPrincipal} text-white shadow-lg`
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
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
              <Bot className={`w-4 h-4 ${tema.accentText}`} />
              <h3 className="text-sm font-bold text-white">Sincronización con RudyBot</h3>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">QR que ve el bot:</span>
                {botCfg?.qrBase64 ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Imagen cargada</span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Sin imagen</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Datos que ve el bot:</span>
                {botCfg?.numero ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {botCfg.numero}</span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Sin datos</span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              El bot lee tu QR desde <span className="text-slate-300 font-mono">ruta_activa</span> en Firebase.
              Con el QR cargado, cuando el cliente pida pagar por {tema.nombreApp}, el bot le mandará{' '}
              <span className="text-slate-300">la imagen del QR + el mensaje de cobro</span>.
              Sin QR, el bot manda solo el mensaje de texto.
            </p>

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
              <Info className={`w-4 h-4 ${tema.accentText}`} />
              <h3 className="text-sm font-bold text-white">¿Cómo consigo mi QR?</h3>
            </div>
            <ol className="space-y-2 text-[11px] text-slate-400">
              {tema.pasos.map((paso, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`w-4 h-4 rounded-full ${tema.accentChip} text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>{i + 1}</span>
                  <span dangerouslySetInnerHTML={{ __html: paso }} />
                </li>
              ))}
            </ol>
            <div className={`${tema.key === 'yape' ? 'bg-purple-500/10 border-purple-500/20' : 'bg-emerald-500/10 border-emerald-500/20'} border rounded-lg p-2.5`}>
              <p className={`text-[10px] leading-relaxed ${tema.key === 'yape' ? 'text-purple-200/80' : 'text-emerald-200/80'}`}>
                💡 {tema.tipFinal}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MODAL: QR AMPLIADO ═══ */}
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
              <img src={qrBase64} alt={`QR ${tema.nombreApp} ampliado`} className="w-full block rounded-lg" />
              <div className="text-center mt-3 pb-1">
                <p className="text-sm font-black text-slate-900">{titular || tema.nombreApp}</p>
                <p className={`text-xl font-black font-mono tracking-wider ${tema.key === 'yape' ? 'text-purple-700' : 'text-emerald-700'}`}>{numero}</p>
                <p className="text-[10px] text-slate-500 mt-1">Escanea con tu app para pagar</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
