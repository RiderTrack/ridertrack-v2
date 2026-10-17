// ═══════════════════════════════════════════════════════════
// 🎛️ FASE AE: PANELES DE REPROGRAMADOS — detrás de los botoncitos
//
// Antes (FASE AD/AD-2) eran DOS banners grandes SIEMPRE abiertos
// arriba de la lista, que se comían la pantalla (pedido de Rudy,
// 18 oct: "estaba ocupando un poco de espacio… lo podemos hacer
// de la misma forma que verificación y observaciones, que todo
// esté armónico y serían como cuatro botoncitos").
//
// Ahora son DOS paneles CONTROLADOS que RutaView abre/cierra con
// los botoncitos de la barra del buscador (mismo lugar y mismo
// estilo que Verificación 📋 y Observaciones 📝):
//   A) 🔁 REPROGRAMADOS Y FALLIDOS (violeta) — la cola: pedidos
//      que Rudy agendó con 🔄 + fallidos esperando que ventas
//      los reprograme (AD-2).
//   B) 🕐 ÚLTIMA RUTA CERRADA (naranja) — los no entregados de
//      ayer: quiénes volvieron solos (🔁) y quiénes faltan (➕).
//
// El header es ESTÁTICO (el toggle vive en el botoncito de arriba,
// como verificación/observaciones) y la LISTA HACE SCROLL: se ven
// ~3 pedidos y el resto se scrolea (pedido de Rudy: "me gustaría
// que aparezca solo tres o dos clientes fallidos y vamos
// escroleando" — antes la lista se expandía sin límite).
//
// Solo LECTURA + acciones de agregar: no cambia el flujo de la
// caja, del bot ni del Excel. Colores del sistema de Mi Ruta.
// ═══════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import { CalendarClock, History, Plus, X, Check, AlertTriangle } from 'lucide-react';
import type { Cliente } from '../services/firestore';
import type { Reprogramado, UltimaCerrada } from '../services/reprog';
import { dividirCola, dividirNoEntregados, coinciden, EXPIRA_DIAS } from '../services/reprog';

/** ~3 pedidos visibles + el asomo del 4to (el resto con scroll —
 *  pedido de Rudy: "que aparezca solo tres o dos clientes fallidos
 *  y vamos escroleando") */
const MAX_SCROLL = 'max-h-44 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5';

/** nota de "hay más abajo" — solo cuando la lista desborda */
const HintScroll: React.FC<{ n: number }> = ({ n }) =>
  n > 3 ? (
    <p data-testid="reprog-scroll-hint" className="text-[9px] text-slate-500 text-center pt-1">
      ↓ {n} en la listita — desliza para verlos todos
    </p>
  ) : null;

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

// ═══════════════════════════════════════════════════════════
// 🔁 PANEL A — Reprogramados y fallidos (la cola, violeta)
// ═══════════════════════════════════════════════════════════
interface ColaReprogramadosProps {
  /** cola de agendados (usuarios/{uid}, tiempo real) */
  cola: Reprogramado[];
  /** clientes de la ruta de HOY (para el cruce de quiénes volvieron) */
  clientesHoy: Cliente[];
  hoy: string;
  onAgregarDeCola: (item: Reprogramado) => void;
  onDescartarDeCola: (item: Reprogramado) => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ColaReprogramados: React.FC<ColaReprogramadosProps> = ({
  cola,
  clientesHoy,
  hoy,
  onAgregarDeCola,
  onDescartarDeCola,
  onShowToast,
}) => {
  const { paraHoy, esperando, futuro, yaEnLista } = useMemo(
    () => dividirCola(cola, hoy, clientesHoy),
    [cola, hoy, clientesHoy]
  );
  const items = [...paraHoy, ...esperando, ...futuro, ...yaEnLista];
  const colaVisible = items.length;
  if (colaVisible === 0) return null;

  return (
    <div data-testid="reprog-cola" className="rounded-xl bg-slate-800 border border-violet-500/30 overflow-hidden">
      {/* header ESTÁTICO — el botoncito 🔁 de la barra lo abre/cierra */}
      <div className="flex items-center gap-2.5 p-3 border-b border-slate-700/50">
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
      </div>

      {/* 🎛️ FASE AE: la listita HACE SCROLL — ~3 pedidos visibles
          y el resto se baja deslizando (antes se expandía sin límite) */}
      <div className="px-3 pt-2 pb-3">
        <div data-testid="reprog-cola-scroll" className={MAX_SCROLL}>
          {items.map((item) => {
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
        <HintScroll n={colaVisible} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 🕐 PANEL B — Última ruta cerrada (no entregados, naranja)
// ═══════════════════════════════════════════════════════════
interface UltimaCerradaPanelProps {
  /** snapshot de la última ruta cerrada */
  ultimaCerrada: UltimaCerrada;
  /** clientes de la ruta de HOY (para el cruce de quiénes volvieron) */
  clientesHoy: Cliente[];
  /** cola de reprogramados (para no duplicar botones ➕ — AD-2) */
  cola: Reprogramado[];
  onAgregarNoEntregado: (cliente: Cliente, desde: string) => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const UltimaCerradaPanel: React.FC<UltimaCerradaPanelProps> = ({
  ultimaCerrada,
  clientesHoy,
  cola,
  onAgregarNoEntregado,
  onShowToast,
}) => {
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
  // por pedido. Este panel queda para el resto (pendientes
  // colgando, reprogramados de rutas viejas no migrados).
  const faltanUnicos = useMemo(
    () => faltan.filter((c) => !cola.some((e) => e && e.cliente && coinciden(e.cliente, c))),
    [faltan, cola]
  );
  if (noEnt.length === 0) return null;

  const nLista = faltanUnicos.length + volvieron.length;

  return (
    <div data-testid="reprog-ayer" className="rounded-xl bg-slate-800 border border-orange-500/30 overflow-hidden">
      {/* header ESTÁTICO — el botoncito 🕐 de la barra lo abre/cierra */}
      <div className="flex items-center gap-2.5 p-3 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
          <History className="w-4 h-4 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
            Última ruta cerrada ({fechaCorta(ultimaCerrada.fecha)})
            <span className="px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[9px] font-bold" data-testid="reprog-ayer-n">
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
      </div>

      <div className="px-3 pt-2 pb-3">
        {/* 🎛️ FASE AE: scroll — ~3 pedidos visibles, el resto deslizando */}
        <div data-testid="reprog-ayer-scroll" className={MAX_SCROLL}>
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
                className="px-2 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-md text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3 h-3" /> Hoy
              </button>
            </div>
          ))}
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
        <HintScroll n={nLista} />

        {faltanUnicos.length > 1 && (
          <button
            onClick={() => {
              faltanUnicos.forEach((c) => onAgregarNoEntregado(c, ultimaCerrada.fecha));
              onShowToast?.('📋 Pasados a hoy', `${faltanUnicos.length} pedidos agregados como pendientes`, 'success');
            }}
            data-testid="reprog-ayer-addall"
            className="w-full py-2 mt-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Pasar los {faltanUnicos.length} a hoy
          </button>
        )}
        {faltan.length > 0 && faltanUnicos.length === 0 && (
          <div className="text-[10px] text-slate-500 bg-slate-900/40 border border-slate-700/50 rounded-lg px-2.5 py-2 text-center mt-2">
            ↗ Los fallidos de esta ruta ya están en la listita de arriba
          </div>
        )}
      </div>
    </div>
  );
};
