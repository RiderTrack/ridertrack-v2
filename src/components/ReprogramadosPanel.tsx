// ═══════════════════════════════════════════════════════════
// 📅 FASE AD: PANEL DE REPROGRAMADOS (Mi Ruta, arriba de la lista)
//
// Dos banners que resuelven el pedido literal de Rudy:
//   A) 📅 AGENDADOS — pedidos que ÉL agendó (botón 🔄 Reprog. de la
//      tarjeta o el tilde del reporte MATE): llegan a la ruta del
//      día elegido sin bajar el Excel completo.
//   B) 📋 NO ENTREGADOS DE LA ÚLTIMA RUTA — el flujo real de la
//      empresa: un pedido falla → ventas llama al cliente y lo
//      reprograma para el día siguiente → Rudy NO lo sabe en el
//      momento, lo descubre AL DÍA SIGUIENTE. La app cruza solita:
//      los que YA VOLVIERON en el Excel nuevo llevan el badge 🔁
//      en su tarjeta, y los que NO VOLVIERON tienen botón ➕ para
//      pasarlos a la ruta de hoy.
//
// Solo LECTURA + acciones de agregar: no cambia el flujo de la
// caja, del bot ni del Excel. Colores del sistema de Mi Ruta.
// ═══════════════════════════════════════════════════════════
import React, { useMemo, useState } from 'react';
import { CalendarClock, ClipboardList, Plus, X, ChevronDown, ChevronUp, Check, AlertTriangle } from 'lucide-react';
import type { Cliente } from '../services/firestore';
import type { Reprogramado, UltimaCerrada } from '../services/reprog';
import { dividirCola, dividirNoEntregados, coinciden, EXPIRA_DIAS } from '../services/reprog';

interface ReprogramadosPanelProps {
  /** cola de agendados (usuarios/{uid}, tiempo real) */
  cola: Reprogramado[];
  /** snapshot de la última ruta cerrada */
  ultimaCerrada: UltimaCerrada | null;
  /** clientes de la ruta de HOY (para el cruce de quiénes volvieron) */
  clientesHoy: Cliente[];
  hoy: string;
  onAgregarDeCola: (item: Reprogramado) => void;
  onAgregarNoEntregado: (cliente: Cliente, desde: string) => void;
  onDescartarDeCola: (item: Reprogramado) => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

/** fecha ISO → "lun 20 oct" (español corto, como el resto de Mi Ruta) */
function fechaCorta(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch {
    return iso;
  }
}

const sSoles = (n: number | string | undefined) =>
  'S/ ' + parseFloat(String(n || 0)).toFixed(2);

export const ReprogramadosPanel: React.FC<ReprogramadosPanelProps> = ({
  cola,
  ultimaCerrada,
  clientesHoy,
  hoy,
  onAgregarDeCola,
  onAgregarNoEntregado,
  onDescartarDeCola,
  onShowToast,
}) => {
  const [abiertoA, setAbiertoA] = useState(true);
  const [abiertoB, setAbiertoB] = useState(true);

  // ── Banner A: la cola ──
  const { paraHoy, esperando, futuro, yaEnLista } = useMemo(
    () => dividirCola(cola, hoy, clientesHoy),
    [cola, hoy, clientesHoy]
  );
  const colaVisible = paraHoy.length + esperando.length + futuro.length + yaEnLista.length;

  // ── Banner B: no entregados de la última ruta cerrada ──
  const noEnt = useMemo(
    () => (ultimaCerrada?.noEntregados || []).filter((c) => c && c.nombre),
    [ultimaCerrada]
  );
  const { volvieron, faltan } = useMemo(
    () => dividirNoEntregados(noEnt, clientesHoy),
    [noEnt, clientesHoy]
  );
  // 🆕 AD-2: lo que YA vive en la listita de arriba (fallidos
  // migrados) no se repite acá con otro botón ➕ — un solo lugar
  // por pedido. El banner B queda para el resto (pendientes
  // colgando, reprogramados de rutas viejas no migrados).
  const faltanUnicos = useMemo(
    () => faltan.filter((c) => !cola.some((e) => e && e.cliente && coinciden(e.cliente, c))),
    [faltan, cola]
  );
  const ayerVisible = noEnt.length;

  if (colaVisible === 0 && ayerVisible === 0) return null;

  return (
    <div data-testid="reprog-panel" className="space-y-2">
      {/* ═══ Banner A: 📅 agendados ═══ */}
      {colaVisible > 0 && (
        <div data-testid="reprog-cola" className="rounded-xl bg-slate-800 border border-violet-500/30 overflow-hidden">
          <button
            onClick={() => setAbiertoA(!abiertoA)}
            className="w-full flex items-center gap-2.5 p-3 hover:bg-slate-700/40 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
              <CalendarClock className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                Reprogramados y fallidos
                {paraHoy.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[9px] font-bold" data-testid="reprog-cola-hoy">
                    {paraHoy.length} para hoy
                  </span>
                )}
                {esperando.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-bold" data-testid="reprog-cola-esperando">
                    {esperando.length} fallido{esperando.length === 1 ? '' : 's'} esperando
                  </span>
                )}
                {futuro.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-500/15 border border-slate-500/30 text-slate-300 text-[9px] font-bold">
                    {futuro.length} más adelante
                  </span>
                )}
                {yaEnLista.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold">
                    {yaEnLista.length} ya en tu ruta
                  </span>
                )}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                Agendados con 🔄 y fallidos esperando reprogramación — se limpian solos a los {EXPIRA_DIAS} días
              </p>
            </div>
            {abiertoA ? (
              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>

          {abiertoA && (
            <div className="px-3 pb-3 space-y-1.5 border-t border-slate-700/50 pt-2">
              {[...paraHoy, ...esperando, ...futuro, ...yaEnLista].map((item) => {
                const enLista = yaEnLista.includes(item);
                const esFallido = esperando.includes(item);
                const atrasado = !enLista && !esFallido && (item.para || '') < hoy;
                return (
                  <div
                    key={`${item.para}-${item.cliente.id ?? item.cliente.nombre}`}
                    data-testid="reprog-cola-item"
                    className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/60 rounded-lg px-2.5 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-white truncate">{item.cliente.nombre}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold shrink-0 flex items-center gap-0.5 ${
                          enLista
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : esFallido
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : atrasado
                                ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                                : (item.para || '') === hoy
                                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                                  : 'bg-slate-500/15 text-slate-300 border border-slate-500/30'
                        }`}>
                          {enLista
                            ? '✓ ya en tu ruta'
                            : esFallido
                              ? (<><AlertTriangle className="w-2.5 h-2.5" /> fallido del {fechaCorta(item.desde)}</>)
                              : (item.para || '') === hoy
                                ? 'hoy'
                                : atrasado
                                  ? `atrasado (${fechaCorta(item.para)})`
                                  : fechaCorta(item.para)}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-500 truncate mt-0.5">
                        {esFallido && 'espera reprogramación · '}{item.cliente.dir || item.cliente.dist || ''} · {sSoles(item.cliente.cobrar || item.cliente.precio)}
                      </div>
                    </div>
                    {!enLista && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            onAgregarDeCola(item);
                            onShowToast?.(
                              esFallido ? '📅 Fallido pasado a hoy' : '📅 Pasado a hoy',
                              `${item.cliente.nombre} ya está en tu ruta como pendiente`,
                              'success'
                            );
                          }}
                          title={esFallido ? 'Ventas lo reprogramó para hoy: pásalo a tu ruta' : 'Pasar a la ruta de hoy'}
                          className={`px-2 py-1.5 text-white rounded-md text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 ${
                            esFallido ? 'bg-amber-600 hover:bg-amber-500' : 'bg-violet-600 hover:bg-violet-500'
                          }`}
                        >
                          <Plus className="w-3 h-3" /> Hoy
                        </button>
                        <button
                          onClick={() => onDescartarDeCola(item)}
                          title="Quitar de la cola"
                          className="px-1.5 py-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Banner B: 📋 no entregados de la última ruta cerrada ═══ */}
      {ayerVisible > 0 && ultimaCerrada && (
        <div data-testid="reprog-ayer" className="rounded-xl bg-slate-800 border border-amber-500/30 overflow-hidden">
          <button
            onClick={() => setAbiertoB(!abiertoB)}
            className="w-full flex items-center gap-2.5 p-3 hover:bg-slate-700/40 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                Última ruta cerrada ({fechaCorta(ultimaCerrada.fecha)})
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-bold" data-testid="reprog-ayer-n">
                  {noEnt.length} no entregados
                </span>
                {volvieron.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold">
                    {volvieron.length} volvió{volvieron.length === 1 ? '' : 'eron'} 🔁
                  </span>
                )}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                Los que ventas reprogramó: los que volvieron en el Excel llevan 🔁 — los demás pásalos con ➕
              </p>
            </div>
            {abiertoB ? (
              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>

          {abiertoB && (
            <div className="px-3 pb-3 space-y-1.5 border-t border-slate-700/50 pt-2">
              {faltanUnicos.map((c) => (
                <div
                  key={`ne-${c.id ?? c.nombre}`}
                  data-testid="reprog-ayer-item"
                  className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/60 rounded-lg px-2.5 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-white truncate">{c.nombre}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 text-[8px] font-bold shrink-0">
                        no volvió
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-500 truncate mt-0.5">
                      {c.dir || c.dist || ''} · {sSoles(c.cobrar || c.precio)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onAgregarNoEntregado(c, ultimaCerrada.fecha);
                      onShowToast?.('📋 Pasado a hoy', `${c.nombre} agregado a tu ruta como pendiente`, 'success');
                    }}
                    title="Pasar a la ruta de hoy"
                    className="px-2 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3 h-3" /> Hoy
                  </button>
                </div>
              ))}
              {faltanUnicos.length > 1 && (
                <button
                  onClick={() => {
                    faltanUnicos.forEach((c) => onAgregarNoEntregado(c, ultimaCerrada.fecha));
                    onShowToast?.('📋 Pasados a hoy', `${faltanUnicos.length} pedidos agregados como pendientes`, 'success');
                  }}
                  data-testid="reprog-ayer-addall"
                  className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Pasar los {faltanUnicos.length} a hoy
                </button>
              )}
              {faltan.length > 0 && faltanUnicos.length === 0 && (
                <div className="text-[10px] text-slate-500 bg-slate-900/40 border border-slate-700/50 rounded-lg px-2.5 py-2 text-center">
                  ↗ Los fallidos de esta ruta ya están en la listita de arriba
                </div>
              )}
              {volvieron.map((c) => (
                <div
                  key={`v-${c.id ?? c.nombre}`}
                  data-testid="reprog-ayer-volvio"
                  className="flex items-center gap-2 bg-slate-900/40 border border-emerald-500/20 rounded-lg px-2.5 py-2 opacity-80"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-200 truncate">{c.nombre}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[8px] font-bold shrink-0">
                        🔁 ya está en tu ruta
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-500 truncate mt-0.5">
                      {c.dir || c.dist || ''} · {sSoles(c.cobrar || c.precio)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
