// ═══════════════════════════════════════════════════════════
// 📖 HISTORIAL VIEW — RiderTrack V2 (Fase 2.5)
// Historial de rutas cerradas, guiado del Rider Modular v1:
// tarjetas por día con S/ cobrado, entregados/fallidos/total,
// desglose tuyo vs empresa y listado de clientes expandible
// con copia al portapapeles para verificar con la página de
// la empresa.
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  History,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  Check,
  Package,
  XCircle,
  Clock,
  Wallet,
  Building2,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { RegistroHistorial, leerHistorial, eliminarRutaHistorial } from '../services/firestore';
import { ETIQUETAS_ESTADO } from '../utils/realData';

type PeriodoFiltro = 'hoy' | '7d' | '30d' | 'todo';

interface HistorialViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const ST_ENTREGADOS = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'];
const ST_FALLIDOS = ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'];

function fechaBonita(fechaISO?: string): string {
  if (!fechaISO) return '—';
  try {
    const d = new Date(fechaISO.length === 10 ? `${fechaISO}T12:00:00` : fechaISO);
    return d.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return fechaISO;
  }
}

function fechaCorta(fechaISO?: string): string {
  if (!fechaISO) return '—';
  try {
    const d = new Date(fechaISO.length === 10 ? `${fechaISO}T12:00:00` : fechaISO);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  } catch {
    return fechaISO;
  }
}

function horaCierre(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const HistorialView: React.FC<HistorialViewProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('todo');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const lista = await leerHistorial(user.uid);
      setRegistros(lista);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Filtrar por periodo
  const registrosFiltrados = useMemo(() => {
    if (periodo === 'todo') return registros;
    const ahora = Date.now();
    const dias = periodo === 'hoy' ? 0 : periodo === '7d' ? 7 : 30;
    return registros.filter((r) => {
      const clave = r.finalizadaAt || r.iniciadaAt || (r.fecha ? `${r.fecha}T23:59:59` : '');
      if (!clave) return false;
      const t = new Date(clave).getTime();
      if (isNaN(t)) return false;
      if (periodo === 'hoy') {
        const hoyStr = new Date().toISOString().split('T')[0];
        return r.fecha === hoyStr;
      }
      return ahora - t <= dias * 24 * 60 * 60 * 1000;
    });
  }, [registros, periodo]);

  // Totales del periodo filtrado
  const totales = useMemo(() => {
    const soles = registrosFiltrados.reduce((s, r) => s + (r.cobradoTotal || 0), 0);
    const entregas = registrosFiltrados.reduce((s, r) => s + (r.entregados || 0), 0);
    const fallas = registrosFiltrados.reduce((s, r) => s + (r.fallidos || 0), 0);
    return { rutas: registrosFiltrados.length, soles, entregas, fallas };
  }, [registrosFiltrados]);

  // Copiar listado de una ruta (para verificar con la empresa)
  const copiarListado = async (r: RegistroHistorial) => {
    const lineas: string[] = [
      `📋 RUTA ${fechaCorta(r.fecha)} — RiderTrack`,
      `Total: S/ ${(r.cobradoTotal || 0).toFixed(2)} · ${r.entregados}/${r.totalClientes} entregados${r.fallidos ? ` · ${r.fallidos} fallidos` : ''}`,
      '',
    ];
    (r.clientes || []).forEach((c: any) => {
      const st = ETIQUETAS_ESTADO[c.st] || c.st || 'Pendiente';
      const monto = parseFloat(String(c.cobrar || 0)).toFixed(2);
      const hora = c.hora ? ` (${c.hora})` : '';
      lineas.push(`${c.nombre || 'Cliente'} — S/ ${monto} — ${st}${hora}`);
    });
    const texto = lineas.join('\n');
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Fallback móvil: textarea temporal
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiado(r.id);
    setTimeout(() => setCopiado(null), 2000);
    onShowToast?.('📋 Listado copiado', `${(r.clientes || []).length} clientes listos para pegar`, 'success');
  };

  const eliminarRuta = async (r: RegistroHistorial) => {
    if (!user) return;
    if (!confirm(`¿Eliminar del historial la ruta del ${fechaCorta(r.fecha)}?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await eliminarRutaHistorial(user.uid, r.id);
      setRegistros((prev) => prev.filter((x) => x.id !== r.id));
      onShowToast?.('🗑️ Ruta eliminada', `Ruta del ${fechaCorta(r.fecha)} borrada del historial`, 'info');
    } catch (e: any) {
      onShowToast?.('Error', e?.message || 'No se pudo eliminar', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <History className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-tight">Historial de Rutas</h1>
              <p className="text-[11px] text-slate-400">Cada ruta que finalizaste, con su plata y sus entregas</p>
            </div>
          </div>
          <button
            onClick={cargar}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 transition-colors disabled:opacity-50"
            title="Refrescar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Totales del periodo */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/50 text-center">
            <div className="text-[9px] text-slate-500 uppercase">Rutas</div>
            <div className="text-sm font-black text-white">{totales.rutas}</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="text-[9px] text-emerald-400/70 uppercase">S/ cobrado</div>
            <div className="text-sm font-black text-emerald-400">{totales.soles.toFixed(0)}</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
            <div className="text-[9px] text-blue-400/70 uppercase">Entregas</div>
            <div className="text-sm font-black text-blue-400">{totales.entregas}</div>
          </div>
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <div className="text-[9px] text-red-400/70 uppercase">Fallidos</div>
            <div className="text-sm font-black text-red-400">{totales.fallas}</div>
          </div>
        </div>

        {/* Filtros de periodo */}
        <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-none">
          {([
            ['hoy', 'Hoy'],
            ['7d', '7 días'],
            ['30d', '30 días'],
            ['todo', 'Todo'],
          ] as [PeriodoFiltro, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPeriodo(id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                periodo === id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de rutas */}
      {loading ? (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-8 text-center">
          <RefreshCw className="w-8 h-8 text-slate-600 mx-auto mb-3 animate-spin" />
          <p className="text-xs text-slate-400">Cargando historial…</p>
        </div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-8 text-center">
          <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">
            {registros.length === 0
              ? 'Sin rutas aún — finaliza una ruta en Mi Ruta y aparecerá aquí'
              : 'No hay rutas en este periodo'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {registrosFiltrados.map((r) => {
            const abierto = expandido === r.id;
            return (
              <div key={r.id} className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
                {/* Cabecera clickeable */}
                <button
                  onClick={() => setExpandido(abierto ? null : r.id)}
                  className="w-full p-3 text-left hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white capitalize">{fechaBonita(r.fecha)}</span>
                        {horaCierre(r.finalizadaAt) && (
                          <span className="text-[10px] text-slate-500">cerrada {horaCierre(r.finalizadaAt)}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {r.totalClientes} clientes · {r.entregados} entregados
                        {r.fallidos > 0 ? ` · ${r.fallidos} fallidos` : ''}
                        {r.pendientes > 0 ? ` · ${r.pendientes} sin atender` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-base font-black text-emerald-400">S/ {(r.cobradoTotal || 0).toFixed(2)}</div>
                        {typeof r.totalEmpresa === 'number' && r.totalEmpresa > 0 && (
                          <div className="text-[9px] text-blue-400">
                            🏢 S/ {r.totalEmpresa.toFixed(0)} · tuyo S/ {(r.totalRider ?? (r.cobradoTotal - r.totalEmpresa)).toFixed(0)}
                          </div>
                        )}
                      </div>
                      {abierto ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Stats compactos */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2.5">
                    <div className="py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <div className="text-xs font-black text-emerald-400">{r.entregados}</div>
                      <div className="text-[8px] text-emerald-400/70 uppercase">Entreg</div>
                    </div>
                    <div className="py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-center">
                      <div className="text-xs font-black text-amber-400">{r.pendientes}</div>
                      <div className="text-[8px] text-amber-400/70 uppercase">Sin atender</div>
                    </div>
                    <div className="py-1 rounded-md bg-red-500/10 border border-red-500/20 text-center">
                      <div className="text-xs font-black text-red-400">{r.fallidos}</div>
                      <div className="text-[8px] text-red-400/70 uppercase">Fallidos</div>
                    </div>
                    <div className="py-1 rounded-md bg-slate-700/40 border border-slate-600 text-center">
                      <div className="text-xs font-black text-white">{r.totalClientes}</div>
                      <div className="text-[8px] text-slate-400 uppercase">Total</div>
                    </div>
                  </div>
                </button>

                {/* Detalle expandido */}
                {abierto && (
                  <div className="border-t border-slate-700/60 px-3 pb-3 pt-2 space-y-2">
                    {/* Desglose por método */}
                    {r.porMetodo && Object.keys(r.porMetodo).length > 0 && (
                      <div className="rounded-lg bg-slate-900/60 border border-slate-700/60 p-2">
                        <div className="text-[9px] text-slate-500 uppercase font-bold mb-1.5">Desglose por método</div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {Object.entries(r.porMetodo)
                            .sort((a, b) => Number(b[1]) - Number(a[1]))
                            .map(([metodo, monto]) => (
                              <div key={metodo} className="flex justify-between text-[10px]">
                                <span className="text-slate-400">{ETIQUETAS_ESTADO[metodo] || metodo}</span>
                                <span className="text-slate-200 font-bold">S/ {Number(monto).toFixed(2)}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Clientes */}
                    {(r.clientes || []).length > 0 ? (
                      <div className="space-y-1 max-h-72 overflow-y-auto custom-scrollbar">
                        {(r.clientes || []).map((c: any, i: number) => {
                          const esEntregado = ST_ENTREGADOS.includes(c.st);
                          const esFallido = ST_FALLIDOS.includes(c.st);
                          return (
                            <div
                              key={`${r.id}-${i}`}
                              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border-l-2 ${
                                esEntregado
                                  ? 'border-l-emerald-500 bg-emerald-500/5'
                                  : esFallido
                                  ? 'border-l-red-500 bg-red-500/5'
                                  : 'border-l-amber-500 bg-amber-500/5'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-white truncate">{c.nombre || 'Cliente'}</span>
                                  {c.hora && <span className="text-[9px] text-slate-500">{c.hora}</span>}
                                </div>
                                {c.dist && <div className="text-[9px] text-slate-500 truncate">{c.dist}</div>}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[11px] font-black text-slate-200">S/ {parseFloat(String(c.cobrar || 0)).toFixed(0)}</div>
                                <div className={`text-[9px] ${esEntregado ? 'text-emerald-400' : esFallido ? 'text-red-400' : 'text-amber-400'}`}>
                                  {ETIQUETAS_ESTADO[c.st] || c.st || 'Pendiente'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 text-center py-2">
                        Este registro viejo no guardó el detalle de clientes
                      </p>
                    )}

                    {/* Acciones */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => copiarListado(r)}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 transition-all active:scale-95"
                      >
                        {copiado === r.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiado === r.id ? 'Copiado' : '📋 Copiar listado'}
                      </button>
                      <button
                        onClick={() => eliminarRuta(r)}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-all active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ayuda */}
      <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-3">
        <div className="flex items-start gap-2">
          <Wallet className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Las rutas entran al historial cuando presionas <strong className="text-slate-200">🏁 FINALIZAR RUTA</strong> en Mi Ruta.
            El botón <strong className="text-slate-200">📋 Copiar listado</strong> te da el detalle exacto (cliente, S/, método y hora)
            para pegarlo y verificarlo con la página de la empresa.
          </p>
        </div>
      </div>
    </div>
  );
};
