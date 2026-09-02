// ═══════════════════════════════════════════════════════════
// 🏍️ MODO MOTO — Fase 3.40 (paso 4 del plan)
// Pantalla de CONDUCCIÓN: botones gigantes y alto contraste para
// usar con la app montada en el manubrio (o guantes puestos).
//
//   · Se activa con el botón 🏍️ del Header (siempre visible) o
//     desde el hero del Seguimiento de ruta.
//   · Un cliente a la vez: nombre grande, monto ENORME, ETA y
//     dirección — lo único que importa mientras manejas.
//   · Botones gigantes: NAVEGAR (Google modo moto / Waze, con la
//     preferencia de siempre), 💵 EFECTIVO, 📲 YAPE, ❌ NO PUDO,
//     ➕ OTRO MÉTODO, 📞 LLAMAR, 💬 WHATSAPP.
//   · Marcar = un toque: el siguiente cliente aparece solito.
//   · Pie: cronómetro de ruta (▶/⏸) + km de hoy del odómetro.
//   · Ruta terminada: 🎉 + botón FINALIZAR RUTA gigante.
//
// Es un overlay fijo (z-[1300]) — cubre todo menos los toasts.
// El estado vive en App.tsx (localStorage rt_modo_moto → sobrevive
// recargas: si la app se cierra en plena ruta, vuelve en moto).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  X,
  Navigation,
  Phone,
  MessageCircle,
  Check,
  Loader2,
  Play,
  Pause,
  Flag,
  MapPin,
  Clock,
  Package,
  ChevronRight,
  Gauge,
} from 'lucide-react';
import { useClientes } from '../hooks/useClientes';
import type { Cliente } from '../services/firestore';
import { iniciarRutaConBot } from '../services/firestore';
import { useCronoRuta, persistirCrono, leerCronoRuta, formatearDuracion, horaDe } from '../utils/refrigerio';
import { planificarRuta, leerVelocidadKmh } from '../utils/etaRuta';
import {
  AppNavegacion,
  getAppNavegacion,
  urlNavegacionGoogle,
  urlNavegacionWaze,
  EVENTO_NAV_CHANGED,
} from '../services/navegacion';
import { snapshotOdometro, suscribirOdometro, formatearKm } from '../services/odometro';

type OnShowToast = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

const MIN_PARADA_KEY = 'rt_min_por_parada';

/** Estados de pago que se pueden marcar con UN toque (sin montos extra) */
const METODOS_OTROS: Array<{ st: string; emoji: string; label: string }> = [
  { st: 'pos', emoji: '💳', label: 'POS' },
  { st: 'transferencia', emoji: '🏦', label: 'Transferencia' },
  { st: 'empresa', emoji: '🏪', label: 'Empresa' },
  { st: 'yape-plin', emoji: '📲', label: 'Yape/Plin' },
  { st: 'pago-link', emoji: '🔗', label: 'Pago Link' },
  { st: 'jose-smith', emoji: '🤝', label: 'José Smith' },
];

const FALLIDOS: Array<{ st: string; emoji: string; label: string }> = [
  { st: 'fallida', emoji: '❌', label: 'Fallida' },
  { st: 'ausente', emoji: '🚪', label: 'Ausente' },
  { st: 'no-contesta', emoji: '📵', label: 'No contesta' },
];

/** Celular normalizado a formato internacional para llamar/WA */
function celNormalizado(cel: string | number | undefined | null): string {
  const digitos = String(cel || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length === 9) return `51${digitos}`;
  if (digitos.length === 11 && digitos.startsWith('51')) return digitos;
  return digitos;
}

function montoCliente(c: Cliente): number {
  return parseFloat(String(c.cobrar || 0)) || 0;
}

function soles(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

interface ModoMotoOverlayProps {
  uid?: string | null;
  riderName?: string;
  onCerrar: () => void;
  onShowToast?: OnShowToast;
}

export const ModoMotoOverlay: React.FC<ModoMotoOverlayProps> = ({
  uid,
  riderName = 'Rider',
  onCerrar,
  onShowToast,
}) => {
  const { clientes, loading, stats, cambiarEstado, finalizarRutaActual } = useClientes();
  const { crono, rutaMs } = useCronoRuta(uid);
  const odo = useSyncExternalStore(suscribirOdometro, snapshotOdometro);

  const [panel, setPanel] = useState<'ninguno' | 'fallido' | 'otros'>('ninguno');
  const [appNav, setAppNav] = useState<AppNavegacion>(getAppNavegacion());
  const [finalizando, setFinalizando] = useState(false);
  const [recienFinalizada, setRecienFinalizada] = useState(false);

  // Preferencia de navegación en vivo (Configuración la puede cambiar)
  useEffect(() => {
    const onUpdate = () => setAppNav(getAppNavegacion());
    window.addEventListener(EVENTO_NAV_CHANGED, onUpdate);
    return () => window.removeEventListener(EVENTO_NAV_CHANGED, onUpdate);
  }, []);

  // Min por parada (misma clave que el Seguimiento) para el ETA
  const minPorParada = useMemo(() => {
    try {
      const v = Number(localStorage.getItem(MIN_PARADA_KEY));
      return v >= 3 && v <= 60 ? v : 10;
    } catch {
      return 10;
    }
  }, []);

  const velocidadKmh = useMemo(() => leerVelocidadKmh(), []);

  // ── Cálculo: orden, pendientes y ETA simple de cada parada ──
  const calculo = useMemo(() => {
    const orden = [...clientes].sort((a, b) => (a.num || 0) - (b.num || 0));
    const pendientes = orden.filter((c) => c.st === 'pendiente' || !c.st);
    const plan = planificarRuta(orden, minPorParada, velocidadKmh);
    const etas = new Map<string, number>();
    let t = Date.now();
    for (const p of plan.paradas) {
      const c = p.cliente;
      if (!(c.st === 'pendiente' || !c.st)) continue;
      t += (p.viajeSeg + p.servicioSeg) * 1000;
      etas.set(String(c.id), t);
    }
    return { orden, pendientes, etas };
  }, [clientes, minPorParada, velocidadKmh]);

  const proximo = calculo.pendientes[0] || null;
  const siguiente = calculo.pendientes[1] || null;
  const rutaVacia = clientes.length === 0;
  const rutaTerminada = calculo.pendientes.length === 0 && clientes.length > 0;

  // ── Acciones ──
  const llamar = (c: Cliente) => {
    const tel = celNormalizado(c.cel);
    if (!tel) {
      onShowToast?.('Sin celular', `${c.nombre || 'El cliente'} no tiene número guardado`, 'warning');
      return;
    }
    const a = document.createElement('a');
    a.href = `tel:+${tel}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const escribir = (c: Cliente) => {
    const tel = celNormalizado(c.cel);
    if (!tel) {
      onShowToast?.('Sin celular', `${c.nombre || 'El cliente'} no tiene número guardado`, 'warning');
      return;
    }
    window.open(`https://wa.me/${tel}`, '_blank');
  };

  const urlsNavegacion = (c: Cliente): { google: string; waze: string; conCoords: boolean } => {
    const conCoords =
      typeof c.lat === 'number' && typeof c.lng === 'number' && !isNaN(c.lat) && !isNaN(c.lng);
    const dirCompleta = `${c.dir || ''}${c.dist ? `, ${c.dist}` : ''}`.trim();
    const query = encodeURIComponent(dirCompleta || c.nombre || 'destino');
    return {
      google: conCoords ? urlNavegacionGoogle(c.lat!, c.lng!) : `https://www.google.com/maps/search/?api=1&query=${query}`,
      waze: conCoords ? urlNavegacionWaze(c.lat!, c.lng!) : `https://waze.com/ul?q=${query}&navigate=yes`,
      conCoords,
    };
  };

  const abrirUrl = (url: string) => {
    try {
      window.open(url, '_blank', 'noopener');
    } catch {
      window.location.href = url;
    }
  };

  /** Navegación con la preferencia guardada (google/waze directo) */
  const navegarPreferido = (c: Cliente) => {
    const urls = urlsNavegacion(c);
    if (appNav === 'waze') abrirUrl(urls.waze);
    else if (appNav === 'google') abrirUrl(urls.google);
    // 'preguntar' → el render muestra los dos botones grandes
  };

  const marcar = (c: Cliente, st: string, etiqueta: string) => {
    cambiarEstado(c.id, st);
    setPanel('ninguno');
    onShowToast?.(
      st === 'efectivo' || st === 'yape-rudy' ? '✅ Cobrado' : '📌 Registrado',
      `${c.nombre || 'Cliente'} · ${soles(montoCliente(c))} · ${etiqueta}`,
      st === 'efectivo' || st === 'yape-rudy' ? 'success' : 'info'
    );
  };

  // ── Cronómetro: iniciar / pausar / continuar (desde la moto) ──
  const toggleCrono = async () => {
    if (!uid) return;
    const actual = leerCronoRuta(uid);
    if (!actual || !actual.activo) {
      const esInicioRuta = !actual || actual.acumulado === 0;
      persistirCrono(uid, { activo: true, inicio: Date.now(), acumulado: actual?.acumulado || 0 });
      if (esInicioRuta) {
        // Aviso silencioso al bot (mismo comportamiento que Mi Ruta)
        try {
          await iniciarRutaConBot(clientes, { nombre: riderName, telefono: '', empresa: 'MATE' });
          onShowToast?.('⏱️ Ruta iniciada', 'El bot ya conoce a tus clientes — el cronómetro corre', 'success');
        } catch {
          onShowToast?.('⏱️ Cronómetro iniciado', 'No pude avisar al bot (revisa internet)', 'warning');
        }
        // Voz (como el modular)
        try {
          const pendientes = clientes.filter((c) => c.st === 'pendiente' || !c.st).length;
          const msg = `Ruta iniciada, tenés ${clientes.length} pedidos, ${pendientes} pendientes`;
          // F3.42: avisa al podcast que la app va a hablar (se auto-pausa)
          try {
            window.dispatchEvent(new CustomEvent('rt-voz-nav'));
          } catch {}
          const TTS = (window as any).Capacitor?.Plugins?.TextToSpeech;
          if (TTS) {
            TTS.speak({ text: msg, lang: 'es-PE', rate: 1.0, pitch: 1.0, volume: 1.0 }).catch(() => {});
          } else if (window.speechSynthesis) {
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-PE';
            u.rate = 0.95;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
          }
        } catch {}
      } else {
        onShowToast?.('⏱️ Cronómetro corriendo', 'La ruta sigue donde la dejaste', 'info');
      }
    } else {
      persistirCrono(uid, {
        activo: false,
        inicio: null,
        acumulado: actual.acumulado + (Date.now() - (actual.inicio || Date.now())),
      });
      onShowToast?.('⏸️ Pausado', 'Toca ▶ para continuar — la ruta sigue activa para el bot', 'info');
    }
  };

  const finalizar = async () => {
    if (finalizando) return;
    if (!confirm('¿Finalizar la ruta de hoy?\n\nSe guarda en el historial y la lista queda limpia para mañana.')) return;
    setFinalizando(true);
    try {
      await finalizarRutaActual();
      setRecienFinalizada(true);
      // F3.41: aviso del resumen diario — la última milla del día
      onShowToast?.('🏁 Ruta finalizada', 'Buen trabajo — manda tu resumen (☰ → Resumen WhatsApp) y escúchalo (☰ → Jornada hablada)', 'success');
    } finally {
      setFinalizando(false);
    }
  };

  // ══════════════════ RENDER ══════════════════
  return (
    <div className="fixed inset-0 z-[1300] bg-slate-950 text-white flex flex-col select-none">
      {/* ── Barra superior: progreso + salida ── */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-800 bg-black/60 flex-shrink-0">
        <span className="text-2xl" role="img" aria-label="moto">🏍️</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black tracking-widest text-amber-400 uppercase leading-none">Modo Moto</p>
          <p className="text-[11px] text-slate-400 font-bold tabular-nums leading-none mt-1">
            {rutaVacia
              ? 'sin ruta'
              : `${calculo.orden.length - calculo.pendientes.length}/${calculo.orden.length} hechas · ${soles(stats.cobrado)} cobrados`}
          </p>
        </div>
        <button
          onClick={onCerrar}
          className="w-14 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 flex flex-col items-center justify-center transition-all flex-shrink-0"
          title="Salir del Modo Moto (volver a la app normal)"
        >
          <X className="w-6 h-6" />
          <span className="text-[9px] font-bold text-slate-400 mt-0.5">SALIR</span>
        </button>
      </div>

      {/* ── Contenido principal ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
            <p className="text-slate-400 font-bold">Cargando tu ruta…</p>
          </div>
        ) : rutaVacia ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4">
            {recienFinalizada ? (
              <>
                <span className="text-6xl">🏁</span>
                <p className="text-3xl font-black text-emerald-400">¡Ruta finalizada!</p>
                <p className="text-slate-400">Descansa — mañana importas tu Excel y arrancas de nuevo</p>
              </>
            ) : (
              <>
                <span className="text-6xl">🏝️</span>
                <p className="text-2xl font-black">No tienes clientes en la ruta</p>
                <p className="text-slate-400">Importa tu Excel en “Mi Ruta” y vuelve al Modo Moto</p>
              </>
            )}
            <button
              onClick={onCerrar}
              className="mt-4 px-8 h-16 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-xl font-black transition-all"
            >
              Volver a la app
            </button>
          </div>
        ) : rutaTerminada ? (
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center px-2">
            <span className="text-6xl">🎉</span>
            <p className="text-4xl font-black text-emerald-400">¡Ruta completada!</p>
            <p className="text-lg text-slate-300">
              {stats.entregados} entregas · {soles(stats.cobrado)} cobrados
            </p>
            <button
              onClick={finalizar}
              disabled={finalizando}
              className="w-full max-w-md h-20 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/50 transition-all disabled:opacity-60"
            >
              {finalizando ? <Loader2 className="w-7 h-7 animate-spin" /> : <Flag className="w-7 h-7" />}
              {finalizando ? 'Guardando…' : '🏁 FINALIZAR RUTA'}
            </button>
            <p className="text-xs text-slate-500">
              Se guarda en el historial, limpia la lista y cierra tu cronómetro
            </p>
            <button
              onClick={onCerrar}
              className="px-6 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-sm font-bold text-slate-300 transition-all"
            >
              Volver a la app sin finalizar
            </button>
          </div>
        ) : proximo ? (
          <>
            {/* ════ TARJETA DEL SIGUIENTE CLIENTE ════ */}
            <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-slate-900 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">
                Parada {calculo.orden.length - calculo.pendientes.length + 1} de {calculo.orden.length}
              </p>
              <p className="text-3xl sm:text-4xl font-black leading-tight break-words">{proximo.nombre || 'Cliente'}</p>
              <p className="text-base text-slate-300 mt-2 flex items-start gap-1.5 break-words">
                <MapPin className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{proximo.dir || 'Sin dirección'}{proximo.dist ? `, ${proximo.dist}` : ''}</span>
              </p>
              {proximo.prod && (
                <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                  <Package className="w-4 h-4 flex-shrink-0" /> {proximo.prod}
                </p>
              )}
              <p className="text-lg text-amber-400 font-bold mt-2 flex items-center gap-1.5 tabular-nums">
                <Clock className="w-5 h-5" />
                llegas ~{horaDe(calculo.etas.get(String(proximo.id)) || Date.now())}
              </p>
              <p className="text-5xl sm:text-6xl font-black text-emerald-400 mt-3 tabular-nums leading-none">
                {soles(montoCliente(proximo))}
              </p>
            </div>

            {/* ════ NAVEGAR (gigante) ════ */}
            {appNav === 'preguntar' ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => abrirUrl(urlsNavegacion(proximo).google)}
                  className="h-20 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 flex flex-col items-center justify-center shadow-xl shadow-blue-900/40 transition-all"
                  title="Google Maps (modo moto)"
                >
                  <Navigation className="w-7 h-7 mb-1" />
                  <span className="text-lg font-black">GOOGLE</span>
                </button>
                <button
                  onClick={() => abrirUrl(urlsNavegacion(proximo).waze)}
                  className="h-20 rounded-2xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 flex flex-col items-center justify-center shadow-xl shadow-cyan-900/40 transition-all"
                  title="Waze (abre directo)"
                >
                  <span className="text-2xl font-black leading-none mb-0.5">Waze</span>
                  <span className="text-xs font-bold text-cyan-100">tráfico en vivo</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => navegarPreferido(proximo)}
                className="w-full h-20 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] flex items-center justify-center gap-3 text-2xl font-black shadow-xl shadow-blue-900/40 transition-all"
                title={appNav === 'waze' ? 'Abrir Waze' : 'Abrir Google Maps (modo moto)'}
              >
                <Navigation className="w-8 h-8" />
                NAVEGAR
                <span className="text-sm font-bold text-blue-200">
                  {appNav === 'waze' ? 'Waze' : 'Google · moto'}
                </span>
              </button>
            )}

            {/* ════ PANELES: fallido / otros métodos ════ */}
            {panel === 'ninguno' ? (
              <>
                {/* Cobros de un toque */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => marcar(proximo, 'efectivo', 'efectivo')}
                    className="h-20 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 flex flex-col items-center justify-center shadow-xl shadow-emerald-900/40 transition-all"
                    title="Marcar como cobrado en efectivo"
                  >
                    <span className="text-2xl leading-none mb-1">💵</span>
                    <span className="text-xl font-black">EFECTIVO</span>
                  </button>
                  <button
                    onClick={() => marcar(proximo, 'yape-rudy', 'yape rudy')}
                    className="h-20 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 flex flex-col items-center justify-center shadow-xl shadow-purple-900/40 transition-all"
                    title="Marcar como cobrado por Yape (tu yape)"
                  >
                    <span className="text-2xl leading-none mb-1">📲</span>
                    <span className="text-xl font-black">YAPE</span>
                  </button>
                </div>

                {/* Fallido / otro método */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPanel('fallido')}
                    className="h-16 rounded-2xl bg-red-600/90 hover:bg-red-500 active:scale-95 flex items-center justify-center gap-2 text-lg font-black shadow-lg shadow-red-900/40 transition-all"
                  >
                    <X className="w-6 h-6" /> NO PUDO
                  </button>
                  <button
                    onClick={() => setPanel('otros')}
                    className="h-16 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-95 flex items-center justify-center gap-2 text-lg font-black transition-all"
                  >
                    <Check className="w-6 h-6" /> OTRO MÉTODO
                  </button>
                </div>

                {/* Llamar / WhatsApp */}
                {celNormalizado(proximo.cel) && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => llamar(proximo)}
                      className="h-16 rounded-2xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 flex items-center justify-center gap-2 text-lg font-black transition-all"
                      title={`Llamar a ${proximo.nombre}`}
                    >
                      <Phone className="w-6 h-6" /> LLAMAR
                    </button>
                    <button
                      onClick={() => escribir(proximo)}
                      className="h-16 rounded-2xl bg-teal-700 hover:bg-teal-600 active:scale-95 flex items-center justify-center gap-2 text-lg font-black transition-all"
                      title="Escribir por WhatsApp"
                    >
                      <MessageCircle className="w-6 h-6" /> WHATSAPP
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black uppercase tracking-wide text-slate-300">
                    {panel === 'fallido' ? '❌ ¿Qué pasó?' : '💰 ¿Cómo cobraste?'}
                  </p>
                  <button
                    onClick={() => setPanel('ninguno')}
                    className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center transition-all"
                    title="Cancelar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {(panel === 'fallido' ? FALLIDOS : METODOS_OTROS).map((op) => (
                    <button
                      key={op.st}
                      onClick={() => marcar(proximo, op.st, op.label.toLowerCase())}
                      className="h-16 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 flex flex-col items-center justify-center border border-slate-700 transition-all"
                    >
                      <span className="text-2xl leading-none mb-1">{op.emoji}</span>
                      <span className="text-base font-black">{op.label}</span>
                    </button>
                  ))}
                </div>
                {panel === 'otros' && (
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Para mixto o yape+efectivo (con vuelto) usa la vista normal — aquí van los métodos de un toque.
                  </p>
                )}
              </div>
            )}

            {/* ════ Después sigue… ════ */}
            {siguiente && (
              <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-4 py-3 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <p className="text-sm text-slate-400 min-w-0 flex-1">
                  Después sigue <span className="font-bold text-slate-200">{siguiente.nombre || 'otro cliente'}</span>
                  <span className="text-slate-500"> · </span>
                  <span className="font-bold text-emerald-400 tabular-nums">{soles(montoCliente(siguiente))}</span>
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* ── Pie: cronómetro + odómetro ── */}
      <div className="border-t border-slate-800 bg-black/70 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex items-center gap-3 flex-shrink-0">
        <button
          onClick={toggleCrono}
          className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-xl ${
            crono?.activo
              ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-900/50'
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50'
          }`}
          title={crono?.activo ? 'Pausar cronómetro de ruta' : 'Iniciar/continuar cronómetro de ruta'}
        >
          {crono?.activo ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
        </button>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold leading-none">Ruta</p>
          <p className="text-2xl font-black font-mono tabular-nums leading-none mt-1">
            {formatearDuracion(rutaMs / 1000)}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold leading-none flex items-center justify-end gap-1">
            <Gauge className={`w-3 h-3 ${odo.contando ? 'text-cyan-400' : 'text-slate-600'}`} /> Hoy
          </p>
          <p className={`text-2xl font-black tabular-nums leading-none mt-1 ${odo.contando ? 'text-cyan-400' : 'text-slate-300'}`}>
            {formatearKm(odo.hoyM)}
          </p>
        </div>
      </div>
    </div>
  );
};
