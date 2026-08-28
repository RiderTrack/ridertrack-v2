// ═══════════════════════════════════════════════════════════
// 🗺️ SEGUIMIENTO DE RUTA — Fase 2.7 (estilo Circuit)
// Vista de progreso de la ruta del día:
//   · 🏁 "A qué hora terminas": hora estimada de finalización
//     calculada con tu RITMO REAL (cronómetro ÷ entregas) —
//     con suavizado para el arranque de la ruta.
//   · ⏰ Hora estimada de llegada a CADA cliente pendiente.
//   · 📞 Botón rápido para LLAMAR al cliente (como Circuit) y
//     WhatsApp directo.
//   · 🍽️ Refrigerio: programa hora y duración, inícialo cuando
//     toca (pausa el cronómetro de ruta con cuenta regresiva) —
//     el tiempo se descuenta automáticamente de tu hora final.
//   · Lista completa: dirección, distrito, precio, método y
//     estado de cada cliente, en orden de entrega.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import {
  Phone,
  MessageCircle,
  Check,
  X,
  UtensilsCrossed,
  Clock,
  Loader2,
  Timer,
  ChevronDown,
  Navigation,
  Play,
  Square,
  Settings2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useClientes } from '../hooks/useClientes';
import type { Cliente } from '../services/firestore';
import { useRefrigerio, useCronoRuta, formatearDuracion, horaDe, hoyHoraAMs } from '../utils/refrigerio';

interface SeguimientoViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const ST_ENTREGADOS = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'];
const ST_FALLIDOS = ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'];

/** Ícono por método (igual que el Historial) */
const ICONO_METODO: Record<string, string> = {
  efectivo: '💵',
  'yape-rudy': '📲',
  'yape-efectivo': '💜',
  mixto: '🔀',
  cambio: '🔄',
  pos: '💳',
  transferencia: '🏦',
  'yape-plin': '📲',
  'pago-link': '🔗',
  'jose-smith': '🤝',
  empresa: '🏪',
  fallida: '❌',
  rechazado: '❌',
  cancelado: '❌',
  ausente: '❌',
  'no-contesta': '❌',
};

const MIN_PARADA_KEY = 'rt_min_por_parada';
const MIN_PARADA_OPCIONES = [5, 8, 10, 12, 15, 20];
const DURACION_REFRI_OPCIONES = [15, 20, 30, 45, 60];

/** Celular normalizado a formato internacional para llamar/WA */
function celNormalizado(cel: string | number | undefined | null): string {
  const digitos = String(cel || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length === 9) return `51${digitos}`;
  if (digitos.length === 11 && digitos.startsWith('51')) return digitos;
  return digitos;
}

type Filtro = 'todos' | 'pendientes' | 'entregados' | 'fallidos';

export const SeguimientoView: React.FC<SeguimientoViewProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const { clientes, loading, stats } = useClientes();
  const { crono, rutaMs } = useCronoRuta(user?.uid);
  const refri = useRefrigerio(user?.uid);

  const [minPorParada, setMinPorParada] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(MIN_PARADA_KEY));
      return v >= 3 && v <= 60 ? v : 10;
    } catch {
      return 10;
    }
  });

  const [ajusteRitmoAbierto, setAjusteRitmoAbierto] = useState(false);
  const [refriPanelAbierto, setRefriPanelAbierto] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [horaProg, setHoraProg] = useState<string>('');
  const [duracionProg, setDuracionProg] = useState<number>(30);

  // Cargar valores programados al panel
  useEffect(() => {
    setHoraProg(refri.refri.programadoHora || '');
    setDuracionProg(refri.refri.duracionMin || 30);
  }, [refri.refri.programadoHora, refri.refri.duracionMin]);

  // ── Cálculo del ETA (cada segundo via tick del hook) ──
  const calculo = useMemo(() => {
    const ahora = Date.now();
    const entregados = clientes.filter((c) => ST_ENTREGADOS.includes(c.st));
    const fallidos = clientes.filter((c) => ST_FALLIDOS.includes(c.st));
    const pendientes = clientes.filter((c) => c.st === 'pendiente' || !c.st);

    // ⏱ Ritmo real suavizado: mientras arranca la ruta mezcla el
    // ritmo por defecto con el real (factor bayesiano simple),
    // para no pronosticar 2 min/parada con la primera entrega.
    const FACTOR = 2;
    const segRuta = rutaMs / 1000;
    const ritmoSeg = (segRuta + minPorParada * 60 * FACTOR) / (entregados.length + FACTOR);

    // 🍽️ Refrigerio: tiempo extra que entra en la ventana restante
    const durMs = refri.refri.duracionMin * 60 * 1000;
    let refriExtraMs = 0;
    if (refri.refri.estado === 'activo') {
      refriExtraMs = refri.segundosRestantes * 1000;
    } else if (refri.refri.estado === 'pendiente' && refri.refri.programadoHora) {
      const horaProgMs = hoyHoraAMs(refri.refri.programadoHora);
      if (horaProgMs !== null) {
        const etaBaseMs = ahora + pendientes.length * ritmoSeg * 1000;
        // ¿La hora del refrigerio cae antes de terminar la ruta?
        if (horaProgMs < etaBaseMs && horaProgMs + durMs > ahora) {
          refriExtraMs = Math.max(0, Math.min(durMs, horaProgMs + durMs - ahora));
        }
      }
    }

    const etaFinalMs = ahora + pendientes.length * ritmoSeg * 1000 + refriExtraMs;

    // ⏰ ETA de llegada por cliente pendiente (en orden de ruta)
    const etas = new Map<string, number>();
    let t = ahora;
    let refriAplicado = refri.refri.estado !== 'pendiente'; // activo/terminado ya no se aplican
    if (refri.refri.estado === 'activo') {
      t += refri.segundosRestantes * 1000; // lo que falta del refri actual
    }
    for (const c of pendientes) {
      t += ritmoSeg * 1000;
      if (!refriAplicado && refri.refri.programadoHora) {
        const hp = hoyHoraAMs(refri.refri.programadoHora);
        if (hp !== null && hp <= t) {
          t += durMs;
          refriAplicado = true;
        }
      }
      etas.set(String(c.id), t);
    }

    return {
      ahora,
      entregados,
      fallidos,
      pendientes,
      ritmoSeg,
      refriExtraMs,
      etaFinalMs,
      etas,
      segundosRestantes: Math.max(0, (etaFinalMs - ahora) / 1000),
      progreso: clientes.length > 0 ? entregados.length / clientes.length : 0,
    };
  }, [clientes, rutaMs, refri.refri, refri.segundosRestantes, minPorParada]);

  // ── Acciones ──
  const llamarCliente = (c: Cliente) => {
    const tel = celNormalizado(c.cel);
    if (!tel) {
      onShowToast?.('Sin celular', `${c.nombre || 'El cliente'} no tiene celular guardado`, 'warning');
      return;
    }
    const a = document.createElement('a');
    a.href = `tel:+${tel}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const escribirCliente = (c: Cliente) => {
    const tel = celNormalizado(c.cel);
    if (!tel) {
      onShowToast?.('Sin celular', `${c.nombre || 'El cliente'} no tiene celular guardado`, 'warning');
      return;
    }
    window.open(`https://wa.me/${tel}`, '_blank');
  };

  const guardarMinParada = (v: number) => {
    setMinPorParada(v);
    try {
      localStorage.setItem(MIN_PARADA_KEY, String(v));
    } catch {}
    setAjusteRitmoAbierto(false);
  };

  const guardarProgramacionRefri = () => {
    refri.programar(horaProg, duracionProg);
    setRefriPanelAbierto(false);
    onShowToast?.(
      '🍽️ Refrigerio programado',
      horaProg ? `${horaProg} · ${duracionProg} min — se descuenta de tu hora de fin` : `${duracionProg} min — cuando lo inicies`,
      'success'
    );
  };

  const iniciarRefrigerio = () => {
    refri.iniciarAhora();
    onShowToast?.(
      '🍽️ Refrigerio iniciado',
      `Reloj de ruta en pausa — termina cuando quieras y sigue automáticamente`,
      'info'
    );
  };

  const terminarRefrigerio = () => {
    const seg = refri.terminarAhora();
    onShowToast?.(
      '✅ Refrigerio terminado',
      seg > 0 ? `Tomaste ${formatearDuracion(seg)} — la ruta sigue corriendo` : 'La ruta sigue corriendo',
      'success'
    );
  };

  // ── Filtros de la lista ──
  const listaFiltrada = useMemo(() => {
    const orden = [...clientes].sort((a, b) => (a.num || 0) - (b.num || 0));
    if (filtro === 'pendientes') return orden.filter((c) => c.st === 'pendiente' || !c.st);
    if (filtro === 'entregados') return orden.filter((c) => ST_ENTREGADOS.includes(c.st));
    if (filtro === 'fallidos') return orden.filter((c) => ST_FALLIDOS.includes(c.st));
    return orden;
  }, [clientes, filtro]);

  const proximo = calculo.pendientes[0] || null;
  const rutaVacia = clientes.length === 0;
  const rutaTerminada = calculo.pendientes.length === 0 && clientes.length > 0;

  // ── Anillo de progreso (estilo Circuit) ──
  const R = 26;
  const C = 2 * Math.PI * R;
  const pct = Math.round(calculo.progreso * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-slate-400">Cargando tu ruta...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-12">
      {/* ══════ 🏁 HERO: A QUÉ HORA TERMINAS ══════ */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-600/20 via-slate-900 to-slate-900 p-4">
        <div className="flex items-center gap-4">
          {/* Anillo de progreso */}
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
              <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" className="text-slate-700" strokeWidth="6" />
              <circle
                cx="32" cy="32" r={R} fill="none" stroke="currentColor"
                className={rutaTerminada ? 'text-emerald-400' : 'text-indigo-400'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - calculo.progreso)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-black text-white leading-none">{pct}%</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {rutaTerminada ? 'Ruta completada' : 'Terminas aprox. a las'}
            </p>
            {rutaVacia ? (
              <>
                <p className="text-3xl font-black text-white leading-tight">— : —</p>
                <p className="text-xs text-slate-400">Importa tu Excel en Mi Ruta para empezar</p>
              </>
            ) : rutaTerminada ? (
              <>
                <p className="text-2xl font-black text-emerald-400 leading-tight">¡Listo! 🎉</p>
                <p className="text-xs text-slate-400">
                  {calculo.entregados.length} entregas · S/ {stats.cobrado.toFixed(2)} cobrados
                </p>
              </>
            ) : (
              <>
                <p className="text-4xl font-black text-white leading-tight tabular-nums">{horaDe(calculo.etaFinalMs)}</p>
                <p className="text-xs text-slate-400">
                  faltan ~{formatearDuracion(calculo.segundosRestantes)} · {calculo.pendientes.length}{' '}
                  {calculo.pendientes.length === 1 ? 'parada' : 'paradas'} por hacer
                </p>
              </>
            )}
          </div>
        </div>

        {/* Cómo se calcula */}
        {!rutaVacia && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] font-bold text-slate-300">
              ⏱️ ~{Math.max(1, Math.round(calculo.ritmoSeg / 60))} min por parada
            </span>
            {crono ? (
              <span
                className={`px-2 py-1 rounded-full border text-[10px] font-bold ${
                  crono.activo
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}
              >
                {crono.activo ? '▶ Cronómetro activo' : '⏸ Cronómetro pausado'}
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[10px] font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Inicia el cronómetro en Mi Ruta para medir tu ritmo real
              </span>
            )}
            {calculo.refriExtraMs > 0 && (
              <span className="px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300 text-[10px] font-bold">
                🍽️ +{Math.round(calculo.refriExtraMs / 60000)} min de refrigerio
              </span>
            )}
            <button
              onClick={() => setAjusteRitmoAbierto(!ajusteRitmoAbierto)}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-300 transition-colors"
            >
              <Settings2 className="w-3 h-3" />
              Ajustar ritmo
            </button>
          </div>
        )}

        {/* Ajuste de ritmo */}
        {ajusteRitmoAbierto && !rutaVacia && (
          <div className="mt-2.5 rounded-xl bg-slate-800/80 border border-slate-700 p-2.5">
            <p className="text-[10px] text-slate-400 mb-2">
              ¿Cuánto tardas por parada? (se usa mientras no haya suficiente ritmo real)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MIN_PARADA_OPCIONES.map((m) => (
                <button
                  key={m}
                  onClick={() => guardarMinParada(m)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
                    minPorParada === m
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════ 🍽️ REFRIGERIO ══════ */}
      <div className={`rounded-2xl border p-3.5 transition-colors ${
        refri.activo
          ? 'border-orange-500/50 bg-orange-500/10'
          : 'border-slate-700/60 bg-slate-900/60'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
            refri.activo
              ? 'bg-orange-500/20 border-orange-500/40 animate-pulse'
              : 'bg-slate-800 border-slate-700'
          }`}>
            <UtensilsCrossed className={`w-5 h-5 ${refri.activo ? 'text-orange-400' : 'text-slate-400'}`} />
          </div>

          <div className="flex-1 min-w-0">
            {refri.activo ? (
              <>
                <p className="text-xs font-bold text-orange-300">Refrigerio en curso 🍽️</p>
                <p className="text-2xl font-black text-white tabular-nums leading-tight">
                  {formatearDuracion(refri.segundosRestantes)}
                  <span className="text-xs font-medium text-slate-400 ml-1.5">restantes</span>
                </p>
                <p className="text-[10px] text-slate-500">Reloj de ruta pausado — reanuda solo al terminar</p>
              </>
            ) : refri.refri.estado === 'terminado' ? (
              <>
                <p className="text-xs font-bold text-white">Refrigerio tomado ✓</p>
                <p className="text-sm text-slate-400">
                  {formatearDuracion(refri.totalTomadoSeg)} en total
                  {refri.refri.sesiones.length > 1 ? ` · ${refri.refri.sesiones.length} pausas` : ''}
                </p>
              </>
            ) : refri.refri.programadoHora ? (
              <>
                <p className="text-xs font-bold text-white">Refrigerio programado</p>
                <p className="text-sm text-slate-400">
                  🕐 {refri.refri.programadoHora} · {refri.refri.duracionMin} min
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-white">Horario de refrigerio</p>
                <p className="text-sm text-slate-400">Programa tu pausa y se descuenta de tu hora de fin</p>
              </>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {refri.activo ? (
              <button
                onClick={terminarRefrigerio}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all active:scale-95"
              >
                <Square className="w-3.5 h-3.5" /> Terminar
              </button>
            ) : (
              <>
                {calculo.pendientes.length > 0 && (
                  <button
                    onClick={iniciarRefrigerio}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold transition-all active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5" /> Iniciar
                  </button>
                )}
                <button
                  onClick={() => setRefriPanelAbierto(!refriPanelAbierto)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold transition-all active:scale-95"
                >
                  {refriPanelAbierto ? 'Cerrar' : 'Programar'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${refriPanelAbierto ? 'rotate-180' : ''}`} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Panel de programación */}
        {refriPanelAbierto && !refri.activo && (
          <div className="mt-3 rounded-xl bg-slate-800/80 border border-slate-700 p-3 space-y-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">¿A qué hora piensas tomarlo?</p>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={horaProg}
                  onChange={(e) => setHoraProg(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500">(opcional)</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">¿Cuánto tiempo?</p>
              <div className="flex flex-wrap gap-1.5">
                {DURACION_REFRI_OPCIONES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuracionProg(d)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
                      duracionProg === d
                        ? 'bg-orange-600 border-orange-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={guardarProgramacionRefri}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-95"
              >
                Guardar
              </button>
              {refri.refri.estado === 'terminado' && (
                <button
                  onClick={() => {
                    refri.reiniciar();
                    setHoraProg('');
                    onShowToast?.('Refrigerio reiniciado', 'Puedes programar otro horario', 'info');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-all active:scale-95"
                >
                  Reiniciar día
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 leading-snug">
              Al pulsar "Iniciar", el cronómetro de ruta se pausa automáticamente y arranca la cuenta regresiva
              del refrigerio. Al terminar, la ruta sigue corriendo donde la dejaste.
            </p>
          </div>
        )}
      </div>

      {/* ══════ 🚀 SIGUIENTE PARADA ══════ */}
      {proximo && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1 mb-2">
            <Navigation className="w-3 h-3" /> Siguiente parada
          </p>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-black text-white truncate">{proximo.nombre || 'Cliente'}</p>
              <p className="text-[11px] text-slate-400 truncate">
                📍 {proximo.dir || 'Sin dirección'}
                {proximo.dist ? `, ${proximo.dist}` : ''}
              </p>
              {proximo.prod && <p className="text-[10px] text-slate-500 truncate">📦 {proximo.prod}</p>}
              <p className="text-lg font-black text-emerald-400 mt-0.5">
                S/ {parseFloat(String(proximo.cobrar || 0)).toFixed(2)}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-slate-400">llegas aprox.</p>
              <p className="text-xl font-black text-amber-400 tabular-nums">
                ~{horaDe(calculo.etas.get(String(proximo.id)) || calculo.etaFinalMs)}
              </p>
              <div className="flex gap-1.5 mt-2">
                {celNormalizado(proximo.cel) && (
                  <>
                    <button
                      onClick={() => llamarCliente(proximo)}
                      className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-all active:scale-90 shadow-lg shadow-emerald-600/30"
                      title={`Llamar a ${proximo.nombre}`}
                    >
                      <Phone className="w-4.5 h-4.5" />
                    </button>
                    <button
                      onClick={() => escribirCliente(proximo)}
                      className="w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-500 flex items-center justify-center text-white transition-all active:scale-90 shadow-lg shadow-teal-600/30"
                      title="Escribir por WhatsApp"
                    >
                      <MessageCircle className="w-4.5 h-4.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ 📋 LISTA DE LA RUTA ══════ */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">
        {/* Header con filtros */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <p className="text-xs font-bold text-white truncate">
              Tu ruta de hoy
              <span className="text-slate-500 font-medium">
                {' '}· {calculo.entregados.length}/{clientes.length} hechas
              </span>
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {(['todos', 'pendientes', 'entregados'] as Filtro[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase transition-colors ${
                  filtro === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f === 'todos' ? 'Todos' : f === 'pendientes' ? `Faltan ${calculo.pendientes.length}` : 'Hechas'}
              </button>
            ))}
          </div>
        </div>

        {/* Filas */}
        {rutaVacia ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-slate-400">Aún no hay clientes en tu ruta 🏝️</p>
            <p className="text-xs text-slate-500 mt-1">Importa tu Excel en "Mi Ruta" y vuelve aquí</p>
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-400">
              {filtro === 'pendientes' ? '¡No te queda nada pendiente! 🎉' : 'Nada con este filtro'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {listaFiltrada.map((c) => {
              const entregado = ST_ENTREGADOS.includes(c.st);
              const fallido = ST_FALLIDOS.includes(c.st);
              const pendiente = !entregado && !fallido;
              const eta = calculo.etas.get(String(c.id));
              const tel = celNormalizado(c.cel);
              return (
                <div
                  key={String(c.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
                    entregado ? 'opacity-55' : fallido ? 'opacity-70' : ''
                  }`}
                >
                  {/* Número / check / X */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black border ${
                      entregado
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : fallido
                        ? 'bg-red-500/20 border-red-500/40 text-red-400'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    {entregado ? <Check className="w-4 h-4" /> : fallido ? <X className="w-3.5 h-3.5" /> : c.num || '·'}
                  </div>

                  {/* Datos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[13px] font-bold truncate ${
                        fallido ? 'text-red-300' : 'text-white'
                      }`}>
                        {c.nombre || 'Cliente'}
                      </span>
                      {c.st && c.st !== 'pendiente' && (
                        <span className="text-[10px] flex-shrink-0" title={c.st}>
                          {ICONO_METODO[c.st] || '•'}
                        </span>
                      )}
                      {pendiente && (
                        <span className="ml-auto sm:ml-0 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] font-bold text-slate-400 flex-shrink-0 tabular-nums">
                          ~{eta ? horaDe(eta) : '—'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      📍 {c.dir || 'Sin dirección'}
                      {c.dist ? `, ${c.dist}` : ''}
                    </p>
                  </div>

                  {/* Monto y hora */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-[13px] font-black tabular-nums ${
                      fallido ? 'text-red-400 line-through' : 'text-emerald-400'
                    }`}>
                      S/ {parseFloat(String(c.cobrar || 0)).toFixed(2)}
                    </p>
                    <p className="text-[9px] text-slate-500 tabular-nums">
                      {entregado || fallido ? (c.hora ? `✓ ${c.hora}` : '✓') : 'por cobrar'}
                    </p>
                  </div>

                  {/* Botones rápidos 📞 WA */}
                  {tel && (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => llamarCliente(c)}
                        className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-all active:scale-90"
                        title={`Llamar a ${c.nombre}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => escribirCliente(c)}
                        className="w-8 h-8 rounded-full bg-slate-700 hover:bg-teal-600 flex items-center justify-center text-slate-200 hover:text-white transition-all active:scale-90"
                        title="Escribir por WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nota al pie */}
      {!rutaVacia && !rutaTerminada && (
        <p className="text-[10px] text-slate-500 text-center px-4 leading-snug">
          La hora de finalización se recalcula con tu ritmo real: cada entrega que registras hace el cálculo
          más preciso (como Circuit). El refrigerio programado se descuenta automáticamente.
        </p>
      )}
    </div>
  );
};
