// ═══════════════════════════════════════════════════════════
// 📸 GALERÍA VIEW — RiderTrack V2 (Fase 2.16)
// Galería de fotos de entrega + revisión en lote:
//   · HOY (en curso): grid con las fotos del día + lightbox
//     (ver grande, descargar, compartir) + alerta de entregados
//     SIN foto con botón 📷 para tomarla al toque (reusa el
//     FotoEntregaModal de siempre).
//   · HISTÓRICO: fotos de las rutas cerradas (historial_rutas
//     guarda fotoUrl desde esta versión) agrupadas por fecha.
//   · Al cerrar la ruta la foto ya viaja al historial (fix
//     finalizarRuta: el snapshot ahora incluye fotoUrl).
//
// FASE 3.8 — 📲 ENVIAR POR WHATSAPP COMO IMAGEN:
//   El "Compartir" viejo a veces terminaba abriendo la PÁGINA de
//   Firestore (URL) en vez de mandar la imagen. Ahora hay un botón
//   WhatsApp que comparte la FOTO REAL (archivo) + un mensajito de
//   verificación editable — para cuando un cliente dice "no me
//   entregaste": buscas la foto y la mandas de frente.
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Images,
  RefreshCw,
  Camera,
  AlertTriangle,
  CheckCircle2,
  X,
  Download,
  Share2,
  Package,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useClientes } from '../hooks/useClientes';
import { leerHistorial, RegistroHistorial, Cliente } from '../services/firestore';
import { FotoEntregaModal } from './FotoEntregaModal';
import { ETIQUETAS_ESTADO } from '../utils/realData';
import { partirHoy, fotosDeHistorial, FotoHistorial } from '../utils/stats';
import { descargarArchivo, compartirArchivoConTexto } from '../utils/descargaArchivo';

interface GaleriaViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

function fechaLarga(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return iso;
  }
}
export const GaleriaView: React.FC<GaleriaViewProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const { clientes, loading: cargandoClientes } = useClientes();
  const [tab, setTab] = useState<'hoy' | 'historico'>('hoy');
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [cargandoHist, setCargandoHist] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [lightbox, setLightbox] = useState<FotoHistorial | null>(null);
  const [clienteAFotografiar, setClienteAFotografiar] = useState<Cliente | null>(null);
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>({});

  // ── Fase 3.8: enviar por WhatsApp como IMAGEN + mensajito ──
  const [waPanel, setWaPanel] = useState(false);
  const [waMensaje, setWaMensaje] = useState('');
  const [waEnviando, setWaEnviando] = useState(false);

  /** Mensajito de verificación pre-llenado (editable) */
  const mensajeVerificacion = (foto: FotoHistorial): string =>
    `📷 *Verificación de entrega*\n\nHola ${foto.nombre}, te comparto la foto de tu pedido entregado ✅${foto.prod ? `\n📦 ${foto.prod}` : ''}\n\n¡Gracias por tu compra! 🙏`;

  const abrirWhatsApp = (foto: FotoHistorial) => {
    setWaMensaje(mensajeVerificacion(foto));
    setWaPanel(true);
  };

  const enviarPorWhatsApp = async (foto: FotoHistorial) => {
    if (waEnviando) return;
    setWaEnviando(true);
    try {
      const blob = await fotoABlob(foto);
      await compartirArchivoConTexto(
        blob,
        nombreFoto(foto),
        waMensaje.trim() || mensajeVerificacion(foto),
        onShowToast,
        '📲 Foto + mensajito listos',
      );
      setWaPanel(false);
    } catch {
      // último recurso: compartir la foto sola
      try {
        await compartirFoto(foto);
      } catch {
        onShowToast?.('❌ No se pudo enviar', 'Intenta con Descargar y adjuntarla en WhatsApp', 'error');
      }
    } finally {
      setWaEnviando(false);
    }
  };

  const cargarHistorial = useCallback(async (silencioso = false) => {
    if (!user?.uid) return;
    if (silencioso) setRefrescando(true); else setCargandoHist(true);
    try {
      const regs = await leerHistorial(user.uid, 300);
      setRegistros(regs);
    } catch (e) {
      console.error('❌ Error cargando historial para galería:', e);
    } finally {
      setCargandoHist(false);
      setRefrescando(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (tab === 'historico' && registros.length === 0 && !cargandoHist) {
      cargarHistorial();
    }
  }, [tab, registros.length, cargandoHist, cargarHistorial]);

  // ── HOY: fotos y faltantes de la ruta en curso ──
  const hoy = useMemo(() => partirHoy(clientes), [clientes]);

  // ── HISTÓRICO: fotos de rutas cerradas, agrupadas por fecha ──
  const historico = useMemo(() => fotosDeHistorial(registros), [registros]);

  // ── Lightbox: descargar / compartir ──
  // Fix 2.18: usan descargarArchivo() — en el APK el <a download> y
  // el navigator.share del WebView no existen; ahora la foto se
  // comparte por la hoja nativa (o se guarda en Documentos).
  const fotoABlob = async (foto: FotoHistorial): Promise<Blob> => {
    const res = await fetch(foto.url);
    return res.blob();
  };

  const nombreFoto = (foto: FotoHistorial): string =>
    `entrega_${foto.nombre.replace(/\s+/g, '_')}.jpg`;

  const compartirFoto = async (foto: FotoHistorial) => {
    try {
      const blob = await fotoABlob(foto);
      const res = await descargarArchivo(
        blob,
        nombreFoto(foto),
        onShowToast,
        '📷 Foto compartida',
        '',
        true, // APK: abrir primero la hoja de compartir
      );
      if (res === null) descargarFoto(foto, true); // último recurso
    } catch {
      descargarFoto(foto, true);
    }
  };

  const descargarFoto = async (foto: FotoHistorial, silencioso = false) => {
    try {
      const blob = await fotoABlob(foto);
      const res = await descargarArchivo(
        blob,
        nombreFoto(foto),
        silencioso ? undefined : onShowToast,
        '📷 Foto guardada',
      );
      if (res === null && !silencioso) {
        window.open(foto.url, '_blank');
        onShowToast?.('📷 Foto abierta', 'Mantén presionada o usa el menú para guardar', 'info');
      }
    } catch {
      if (!silencioso) {
        window.open(foto.url, '_blank');
        onShowToast?.('📷 Foto abierta', 'Mantén presionada o usa el menú para guardar', 'info');
      }
    }
  };

  const toggleSeccion = (fecha: string) => {
    setSeccionesAbiertas(s => ({ ...s, [fecha]: !s[fecha] }));
  };

  const totalFotosHoy = hoy.conFoto.length;
  const faltanFotos = hoy.sinFoto.length;

  const EstadoBadge: React.FC<{ st: string }> = ({ st }) => (
    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30 truncate max-w-[90px]">
      {ETIQUETAS_ESTADO[st] || st}
    </span>
  );

  return (
    <div className="space-y-4 pb-12 max-w-4xl">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Images className="w-6 h-6 text-emerald-400" />
              Galería de Entregas
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Evidencias del día y de tus rutas cerradas
            </p>
          </div>
          <button
            onClick={() => { cargarHistorial(true); }}
            disabled={refrescando}
            className="p-2 rounded-xl bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${refrescando ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1.5 mt-4 p-1 rounded-xl bg-slate-900/60 border border-slate-700">
          <button
            onClick={() => setTab('hoy')}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              tab === 'hoy' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Hoy · en curso {totalFotosHoy > 0 && `(${totalFotosHoy})`}
          </button>
          <button
            onClick={() => setTab('historico')}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              tab === 'historico' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Histórico {historico.total > 0 && `(${historico.total})`}
          </button>
        </div>
      </div>

      {/* ═══════════ TAB HOY ═══════════ */}
      {tab === 'hoy' && (
        cargandoClientes ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-slate-400 text-sm">Cargando tu ruta de hoy…</div>
          </div>
        ) : (
          <>
            {/* Estado de evidencias */}
            <div className={`p-4 rounded-2xl border ${
              faltanFotos > 0
                ? 'bg-amber-500/10 border-amber-500/30'
                : totalFotosHoy > 0
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-slate-800 border-slate-700'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {faltanFotos > 0 ? (
                    <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className={`w-8 h-8 shrink-0 ${totalFotosHoy > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-black text-white">
                      {faltanFotos > 0
                        ? `⚠️ ${faltanFotos} entrega${faltanFotos === 1 ? '' : 's'} sin foto`
                        : totalFotosHoy > 0
                          ? '✅ Todas tus entregas tienen foto'
                          : 'Sin entregas todavía hoy'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {totalFotosHoy > 0 && `${totalFotosHoy} con evidencia`}
                      {totalFotosHoy > 0 && faltanFotos > 0 && ' · '}
                      {faltanFotos > 0 && 'revísalas antes de cerrar la ruta'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid de fotos de hoy */}
            {totalFotosHoy > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {hoy.conFoto.map((f, i) => (
                  <button
                    key={`hoy-${i}`}
                    onClick={() => setLightbox(f)}
                    className="group relative rounded-xl overflow-hidden border border-slate-700 bg-slate-800 hover:border-emerald-500/50 transition-colors text-left"
                  >
                    <img
                      src={f.url}
                      alt={`Entrega ${f.nombre}`}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
                      <div className="text-[11px] font-bold text-white truncate">{f.nombre}</div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[10px] text-slate-300">{f.hora || '—'}</span>
                        <span className="text-[10px] font-black text-emerald-400">S/ {f.cobrar.toFixed(2)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Entregados SIN foto — revisión en lote */}
            {faltanFotos > 0 && (
              <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
                <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-400" />
                  Faltan {faltanFotos} foto{faltanFotos === 1 ? '' : 's'} de evidencia
                </h3>
                <p className="text-[11px] text-slate-400 mb-3">
                  Entregas marcadas como entregadas sin foto. Tócala al toque y queda guardada al instante.
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {hoy.sinFoto.map(c => (
                    <div key={String(c.id)} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/50 border border-slate-700/50">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{c.nombre || 'Cliente'}</div>
                        <div className="text-[10px] text-slate-400 truncate">{c.prod || 'Sin producto'} · S/ {parseFloat(String(c.cobrar || 0)).toFixed(2)} · {c.hora || '—'}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <EstadoBadge st={c.st || ''} />
                        <button
                          onClick={() => setClienteAFotografiar(c)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-[10px] font-black hover:bg-amber-400 transition-colors flex items-center gap-1"
                        >
                          <Camera className="w-3 h-3" />
                          Tomar foto
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalFotosHoy === 0 && faltanFotos === 0 && (
              <div className="p-8 rounded-2xl bg-slate-800 border border-slate-700 text-center">
                <Images className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-bold">Sin entregas todavía</p>
                <p className="text-xs text-slate-500 mt-2">
                  Cuando marques entregas en Mi Ruta y les tomes foto 📷, aparecerán acá.
                </p>
              </div>
            )}
          </>
        )
      )}

      {/* ═══════════ TAB HISTÓRICO ═══════════ */}
      {tab === 'historico' && (
        cargandoHist ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 rounded-full animate-spin border-slate-700 border-t-emerald-500" style={{ borderWidth: '3px' }} />
            <div className="text-slate-400 text-sm">Buscando fotos de tus rutas…</div>
          </div>
        ) : historico.total === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-800 border border-slate-700 text-center">
            <Images className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-bold">Sin fotos en el historial</p>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              Las rutas cerradas antes de esta versión no guardaban la foto en el historial (las fotos viejas siguen en la nube, solo que no están referenciadas). Desde ahora, al cerrar tu ruta cada foto queda registrada acá para siempre.
            </p>
          </div>
        ) : (
          <>
            <div className="px-1 text-[11px] text-slate-400">
              {historico.total} foto{historico.total === 1 ? '' : 's'} de rutas cerradas
            </div>
            {historico.fechas.map(fecha => {
              const fotos = historico.grupos.get(fecha) || [];
              const abierta = seccionesAbiertas[fecha] !== false; // abiertas por defecto
              return (
                <div key={fecha} className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
                  <button
                    onClick={() => toggleSeccion(fecha)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="text-sm font-bold text-white capitalize truncate">{fechaLarga(fecha)}</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold border border-indigo-500/30 shrink-0">
                        {fotos.length} 📷
                      </span>
                    </div>
                    {abierta ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>
                  {abierta && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 pt-0">
                      {fotos.map((f, i) => (
                        <button
                          key={`${fecha}-${i}`}
                          onClick={() => setLightbox(f)}
                          className="group relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 hover:border-emerald-500/50 transition-colors text-left"
                        >
                          <img
                            src={f.url}
                            alt={`Entrega ${f.nombre}`}
                            className="w-full aspect-square object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
                            <div className="text-[11px] font-bold text-white truncate">{f.nombre}</div>
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <span className="text-[10px] text-slate-300">{f.hora || '—'}</span>
                              <span className="text-[10px] font-black text-emerald-400">S/ {f.cobrar.toFixed(2)}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )
      )}

      {/* ═══════════ LIGHTBOX ═══════════ */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => { setLightbox(null); setWaPanel(false); }}
        >
          <div
            className="w-full max-w-md max-h-[92vh] flex flex-col gap-3 overflow-y-auto no-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            {/* Foto */}
            <img
              src={lightbox.url}
              alt={`Entrega ${lightbox.nombre}`}
              className="w-full max-h-[52vh] object-contain rounded-2xl border border-slate-700 bg-slate-900 shrink-0"
            />

            {/* Info */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-black text-white truncate">{lightbox.nombre}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {lightbox.prod || 'Sin producto'} · S/ {lightbox.cobrar.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 capitalize">
                    {lightbox.hora ? `${lightbox.hora} · ` : ''}{fechaLarga(lightbox.fecha)}
                  </div>
                </div>
                <EstadoBadge st={lightbox.st} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => descargarFoto(lightbox)}
                  className="py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/40 text-blue-400 text-xs font-black hover:bg-blue-500/25 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </button>
                <button
                  onClick={() => compartirFoto(lightbox)}
                  className="py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-black hover:bg-emerald-500/25 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir
                </button>
              </div>

              {/* 📲 Fase 3.8: enviar por WhatsApp como IMAGEN + mensajito */}
              <button
                onClick={() => (waPanel ? setWaPanel(false) : abrirWhatsApp(lightbox))}
                className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-xs font-black hover:from-emerald-500 hover:to-green-500 transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/40"
              >
                <MessageCircle className="w-4 h-4" />
                {waPanel ? 'Cerrar mensajito' : '📲 Enviar por WhatsApp'}
              </button>

              {waPanel && (
                <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Mensajito que acompaña a la foto
                  </div>
                  <textarea
                    value={waMensaje}
                    onChange={(e) => setWaMensaje(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-600 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-emerald-500/60 resize-none"
                    placeholder="Escribe el mensajito…"
                  />
                  <button
                    onClick={() => enviarPorWhatsApp(lightbox)}
                    disabled={waEnviando}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black transition-colors flex items-center justify-center gap-2"
                  >
                    {waEnviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                    {waEnviando ? 'Preparando…' : 'Enviar foto + mensajito'}
                  </button>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    La foto sale como <b className="text-slate-300">imagen de frente</b> (no como enlace) — elige el chat del cliente en la hoja de compartir.
                  </p>
                </div>
              )}
            </div>

            {/* Botón cerrar */}
            <button
              onClick={() => setLightbox(null)}
              className="mx-auto p-2.5 rounded-full bg-slate-800 border border-slate-600 text-slate-300 hover:text-white transition-colors shrink-0"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL TOMAR FOTO (faltantes) ═══════════ */}
      {clienteAFotografiar && (
        <FotoEntregaModal
          cliente={clienteAFotografiar}
          onClose={() => setClienteAFotografiar(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
