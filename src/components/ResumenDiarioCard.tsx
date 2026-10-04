// ═══════════════════════════════════════════════════════════
// 📊 RESUMEN DIARIO → WHATSAPP — UI (Fase 3.41 · paso 5)
// Dos piezas (patrón F3.39/3.40):
//   · ResumenDiarioCard → el gestor COMPLETO: vista previa del
//     día (ruta + plata + caja + km + tiempo) y el mensaje EXACTO
//     que llega al grupo MATE, con botón ENVIAR (el bot lo manda)
//     y COPIAR (respaldo si el bot está apagado). Vive en el
//     MODAL del menú hamburguesa ☰, sección Jornada.
//   · ResumenMenuBoton → botón del menú ☰ igual a los demás
//     (icono + "Resumen WhatsApp" + badge con el total del día).
//
// La plata y los clientes NO se guardan aquí: se leen VIVO de
// useResumenCaja (ruta_activa + historial de hoy + caja F3.39),
// el odómetro aporta los km y el cronómetro el tiempo en ruta.
// Cero motores nuevos — solo presentación y envío.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { Send, Copy, Check, Loader2, Lock, Package, Timer, Route as RouteIcon } from 'lucide-react';
import { useResumenCaja } from './CajaCard';
import { snapshotOdometro, StatsOdometro, suscribirOdometro } from '../services/odometro';
import { accionesRefrigerio, useCronoRuta } from '../utils/refrigerio';
import { enviarAGrupoMate } from '../utils/chatBaileys';
import {
  CierreCaja,
  ResumenCaja,
  formatearSoles,
  etiquetaDiferencia,
} from '../utils/cajaCore';
import {
  ResumenDia,
  armarMensajeResumen,
  armarResumenDia,
  fechaLargaLocal,
  formatearDuracionCorta,
  formatearKm,
} from '../utils/resumenCore';

type OnShowToast = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

// ── Hook: TODO el día en vivo ─────────────────────────────

/**
 * El resumen del día completo: clientes + plata + caja (viene
 * de useResumenCaja, cache compartido con la caja F3.39) +
 * km del odómetro + tiempo de ruta del cronómetro + refrigerio.
 * El tick de 1 s solo corre con el MODAL abierto (el botón del
 * menú usa useResumenCaja directo, sin crono).
 */
export function useResumenDiario(uid?: string | null, riderNombre?: string): {
  resumen: ResumenDia;
  mensaje: string;
  cierreHoy: CierreCaja | null;
  resumenCaja: ResumenCaja;
  cargando: boolean;
} {
  const { caja, gastosHoy, resumen: resumenCaja, cierreHoy, cargando, clientes } = useResumenCaja(uid);

  // 🛣️ km de hoy (odómetro GPS calibrado — en vivo)
  const [odo, setOdo] = useState<StatsOdometro>(() => snapshotOdometro());
  useEffect(() => {
    setOdo(snapshotOdometro());
    return suscribirOdometro(() => setOdo(snapshotOdometro()));
  }, []);

  // ⏱️ tiempo en ruta (cronómetro — tick 1 s mientras el modal
  // está abierto; es el MISMO que usa el Modo Moto)
  const { rutaMs } = useCronoRuta(uid);

  // 🍽️ refrigerio tomado hoy
  const [refriSeg, setRefriSeg] = useState(() => accionesRefrigerio(uid).obtener().tomadoSeg);
  useEffect(() => {
    setRefriSeg(accionesRefrigerio(uid).obtener().tomadoSeg);
    const on = () => setRefriSeg(accionesRefrigerio(uid).obtener().tomadoSeg);
    window.addEventListener('rt-refri-cambio', on);
    return () => window.removeEventListener('rt-refri-cambio', on);
  }, [uid]);

  const resumen = useMemo(
    () =>
      armarResumenDia({
        clientes,
        gastos: gastosHoy,
        fondo: caja.fondo,
        kmHoyM: odo?.hoyM,
        rutaMs,
        refriSeg,
      }),
    [clientes, gastosHoy, caja.fondo, odo, rutaMs, refriSeg]
  );

  const mensaje = useMemo(
    () => armarMensajeResumen(resumen, cierreHoy, riderNombre),
    [resumen, cierreHoy, riderNombre]
  );

  return { resumen, mensaje, cierreHoy, resumenCaja, cargando };
}

// ── Copiar con respaldo (WebView de Android a veces no tiene
//    navigator.clipboard — el textarea viejo nunca falla) ──
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // sigue al plan B
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ── Gestor completo (vive en el modal del menú ☰) ─────────

interface ResumenDiarioCardProps {
  uid?: string | null;
  riderName?: string;
  onShowToast?: OnShowToast;
}

export const ResumenDiarioCard: React.FC<ResumenDiarioCardProps> = ({ uid, riderName, onShowToast }) => {
  const { resumen, mensaje, cierreHoy, cargando } = useResumenDiario(uid, riderName);
  const [enviando, setEnviando] = useState(false);
  const [enviadoAt, setEnviadoAt] = useState<number | null>(null);
  const [copiado, setCopiado] = useState(false);

  const c = resumen.conteo;
  const caja = resumen.caja;
  const cerrada = !!cierreHoy;

  const enviar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      onShowToast?.('📤 MATE', 'Enviando el resumen del día…', 'info');
      await enviarAGrupoMate(mensaje);
      setEnviadoAt(Date.now());
      onShowToast?.('✅ Resumen enviado', 'El grupo MATE ya lo recibió', 'success');
    } catch (e: any) {
      onShowToast?.('No se pudo enviar', e?.message || 'Revisa tu internet o usa COPIAR y pégalo tú', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const copiar = async () => {
    const ok = await copiarTexto(mensaje);
    if (ok) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
      onShowToast?.('📋 Copiado', 'Pégalo donde quieras (WhatsApp, notas…)', 'success');
    } else {
      onShowToast?.('No se pudo copiar', 'Selecciona el texto del recuadro manualmente', 'warning');
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando tu día…
      </div>
    );
  }

  const hace = enviadoAt
    ? Math.max(1, Math.round((Date.now() - enviadoAt) / 60000))
    : null;

  return (
    <div className="space-y-3">
      {/* ── Ruta ── */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-emerald-400" /> Ruta
          </span>
          <span className="text-[10px] text-slate-500 font-medium">{fechaLargaLocal(resumen.fechaISO)}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-black text-white tabular-nums">
            {c.entregados}
            <span className="text-sm text-slate-500 font-bold">/{c.total}</span>
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            entregados · <span className="text-red-400 font-bold">{c.fallidos} fallidos</span>
            {c.pendientes > 0 && (
              <>
                {' · '}<span className="text-amber-400 font-bold">{c.pendientes} pendientes</span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-[11px] text-slate-400 tabular-nums">
          <span className="flex items-center gap-1">
            <RouteIcon className="w-3.5 h-3.5 text-cyan-400" /> {formatearKm(resumen.kmHoyM)}
          </span>
          <span className="flex items-center gap-1">
            <Timer className="w-3.5 h-3.5 text-blue-400" /> {formatearDuracionCorta(resumen.rutaMs)}
            {resumen.refriSeg >= 60 && (
              <span className="text-slate-500">(+{formatearDuracionCorta(resumen.refriSeg * 1000)} refri)</span>
            )}
          </span>
        </div>
      </div>

      {/* ── Plata ── */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
          <div className="text-[9px] uppercase font-bold text-emerald-400">Efectivo</div>
          <div className="text-sm font-black text-white tabular-nums mt-0.5">{formatearSoles(caja.efectivoCobrado)}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center">
          <div className="text-[9px] uppercase font-bold text-purple-400">Digital</div>
          <div className="text-sm font-black text-white tabular-nums mt-0.5">{formatearSoles(caja.digitalRider)}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center">
          <div className="text-[9px] uppercase font-bold text-blue-400">Empresa</div>
          <div className="text-sm font-black text-white tabular-nums mt-0.5">{formatearSoles(caja.empresa)}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-600 text-center">
          <div className="text-[9px] uppercase font-bold text-slate-300">Total</div>
          <div className="text-sm font-black text-white tabular-nums mt-0.5">{formatearSoles(caja.cobradoTotal)}</div>
        </div>
      </div>

      {/* ── Gastos + Caja ── */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">💸 Gastos ({caja.nGastos})</span>
          <span className="font-bold text-white tabular-nums">
            {formatearSoles(caja.gastosEfectivo + caja.gastosDigital)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1">
            {cerrada ? <Lock className="w-3 h-3 text-emerald-400" /> : '🧮'} Esperado en caja
          </span>
          <span className="font-bold text-white tabular-nums">{formatearSoles(cierreHoy ? cierreHoy.esperado : caja.esperado)}</span>
        </div>
        {cerrada && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">🤲 Contado</span>
            <span
              className={`font-bold tabular-nums ${
                etiquetaDiferencia(cierreHoy.diferencia).clase === 'falta' ? 'text-red-400'
                  : etiquetaDiferencia(cierreHoy.diferencia).clase === 'sobra' ? 'text-amber-400'
                    : 'text-emerald-400'
              }`}
            >
              {formatearSoles(cierreHoy.contado)} · {etiquetaDiferencia(cierreHoy.diferencia).texto}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
          <span className="text-slate-300 font-bold">🏷️ Neto del día</span>
          <span className="font-black text-emerald-400 tabular-nums">
            {formatearSoles(cierreHoy ? cierreHoy.netoDelDia : caja.netoDelDia)}
          </span>
        </div>
      </div>

      {/* ── Vista previa del mensaje ── */}
      <div>
        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
          📲 Así llega al grupo MATE
        </div>
        <div className="p-3 rounded-xl bg-[#0b141a] border border-slate-700 max-h-64 overflow-auto">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#e9edef] m-0">{mensaje}</pre>
        </div>
        {hace && (
          <div className="text-[10px] text-emerald-400 font-semibold mt-1">
            ✅ Enviado hace {hace} min — puedes reenviarlo si cambió algo
          </div>
        )}
      </div>

      {/* ── Botones ── */}
      <div className="flex gap-2">
        <button
          onClick={enviar}
          disabled={enviando}
          className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
        >
          {enviando ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Enviando…
            </>
          ) : (
            <>
              <Send className="w-5 h-5" /> ENVIAR AL GRUPO MATE
            </>
          )}
        </button>
        <button
          onClick={copiar}
          className="h-12 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
          title="Copiar el mensaje al portapapeles"
        >
          {copiado ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
          <span className="hidden sm:inline">{copiado ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed">
        Lo manda el bot Rudy al grupo MATE (igual que los avisos de ruta y el cierre de caja). Si el bot está
        apagado, usa <b>Copiar</b> y pégalo en cualquier chat. Los números se toman en vivo: cierra la caja
        primero para que salga con el conteo final.
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 🔘 BOTÓN DE MENÚ (F3.41) — fila IGUAL a las demás opciones del
// ☰ (icono + "Resumen WhatsApp" + badge con el total del día).
// SIN tick de cronómetro: usa useResumenCaja directo (el mismo
// cache compartido de la caja — cero lecturas extra).
// ═══════════════════════════════════════════════════════════

interface ResumenMenuBotonProps {
  uid?: string | null;
  /** Sidebar colapsado → solo el icono */
  colapsado?: boolean;
  onAbrir?: () => void;
}

export const ResumenMenuBoton: React.FC<ResumenMenuBotonProps> = ({ uid, colapsado, onAbrir }) => {
  const { resumen, cierreHoy, cargando } = useResumenCaja(uid);
  const cerrada = !!cierreHoy;

  const badge = cargando
    ? { texto: '…', clase: 'bg-slate-800 text-slate-400 border-slate-700' }
    : cerrada
      ? { texto: formatearSoles(cierreHoy!.netoDelDia), clase: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
      : { texto: formatearSoles(resumen.cobradoTotal), clase: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };

  return (
    <button
      onClick={onAbrir}
      title={
        colapsado
          ? 'Resumen del día → WhatsApp'
          : `${resumen.entregas} entregados · ${formatearSoles(resumen.cobradoTotal)}${cerrada ? ' · caja cerrada' : ''} — toca para ver y enviar a MATE`
      }
      className="group relative flex items-center w-full px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 active:scale-[0.98]"
    >
      <Send className={`w-5 h-5 flex-shrink-0 ${cerrada ? 'text-emerald-400' : 'text-indigo-400'} transition-transform duration-200 group-hover:scale-105`} />
      {!colapsado && <span className="ml-3 truncate font-medium">Resumen WhatsApp</span>}
      {!colapsado && (
        <span className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full border tabular-nums ${badge.clase}`}>
          {badge.texto}
        </span>
      )}
      {colapsado && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
          Resumen WhatsApp
        </div>
      )}
    </button>
  );
};
