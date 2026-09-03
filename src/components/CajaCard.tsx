// ═══════════════════════════════════════════════════════════
// 💰 CAJA DEL DÍA — UI (Fase 3.39 · paso 3 del plan)
// Cierre de caja + gastos. Dos piezas (patrón F3.36/3.38):
//   · CajaCard       → gestor COMPLETO: fondo inicial, resumen
//                      vivo del día, gastos rápidos, cierre con
//                      conteo físico (esperado vs contado), envío
//                      del cierre al grupo MATE e historial.
//                      Vive en el MODAL del menú hamburguesa ☰ —
//                      NO satura Mi ruta ni el Seguimiento.
//   · CajaMenuStats  → bloque del menú ☰: esperado en caja +
//                      gastos de hoy + candado si ya cerraste.
//                      Al tocarlo abre el gestor completo.
//
// La plata de los clientes NO se guarda aquí: se lee VIVO de la
// ruta (ruta_activa) + los registros de hoy (historial_rutas),
// así la caja siempre cuadra con lo que la app ya sabe. Aquí
// solo viven fondo, gastos y cierres (usuarios/{uid}.caja).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Wallet, Plus, Trash2, Lock, Unlock, Send, RefreshCw, ChevronDown, ChevronUp, Coins } from 'lucide-react';
import {
  arrancarCaja,
  recargarCaja,
  snapshotCaja,
  suscribirCaja,
  agregarGasto,
  eliminarGasto,
  fijarFondo,
  cerrarCaja,
  reabrirCaja,
  gastosDeHoy,
  cierreDeHoy,
  EstadoCaja,
} from '../services/caja';
import { Cliente, leerHistorial, subscribeToRutaActiva } from '../services/firestore';
import { hoyISO } from '../utils/stats'; // ⚡ F3.48: hoy en hora de Lima
import { enviarAGrupoMate } from '../utils/chatBaileys';
import {
  CATEGORIAS_GASTO,
  Gasto,
  ResumenCaja,
  armarMensajeCierre,
  categoriaInfo,
  etiquetaDiferencia,
  fechaCorta,
  formatearSoles,
  horaCorta,
  resumenCajaDia,
} from '../utils/cajaCore';

type OnShowToast = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

// ── Hooks ─────────────────────────────────────────────────

/** Store de la caja en vivo */
function useCaja(): EstadoCaja {
  return useSyncExternalStore(suscribirCaja, snapshotCaja);
}

// ── Clientes de HOY (cache compartido — 1 lectura por sesión) ──

/** Cache módulo-level: los registros de HOY se leen UNA vez por
 *  sesión (leerHistorial lee hasta 40 docs — no lo repetimos en
 *  cada montaje del bloque del menú). Se invalida al finalizar
 *  una ruta (evento rt-ruta-finalizada). */
let _cacheCerrados: { uid: string; clientes: Cliente[] } | null = null;
let _cargandoCerrados: Promise<Cliente[]> | null = null;

async function asegurarCerrados(uid: string): Promise<Cliente[]> {
  if (_cacheCerrados?.uid === uid) return _cacheCerrados.clientes;
  if (_cargandoCerrados) return _cargandoCerrados;
  _cargandoCerrados = (async () => {
    try {
      const hoy = hoyISO(); // ⚡ F3.48: hoy en Lima (antes UTC: la caja de "hoy" cambiaba de día después de 7pm)
      const registros = await leerHistorial(uid, 40);
      const deHoy: Cliente[] = [];
      for (const r of registros) {
        if (r.fecha !== hoy) continue;
        for (const c of r.clientes || []) {
          deHoy.push({
            id: `${r.id}_${c.id}`,
            num: c.num || 0,
            nombre: c.nombre || '',
            cel: c.cel || '',
            prod: c.prod || '',
            precio: 0,
            cobrar: parseFloat(String(c.cobrar || 0)),
            dir: c.dir || '',
            dist: c.dist || '',
            obs: '',
            st: c.st || 'pendiente',
            mEf: parseFloat(String(c.mEf || 0)),
            mYp: parseFloat(String(c.mYp || 0)),
            mEmp: parseFloat(String(c.mEmp || 0)),
            mVt: parseFloat(String(c.mVt || 0)),
            mEM: '',
            hora: c.hora || '',
            nota: '',
          });
        }
      }
      _cacheCerrados = { uid, clientes: deHoy };
      return deHoy;
    } catch {
      // sin internet → la ruta viva igual muestra el día
      return _cacheCerrados?.uid === uid ? _cacheCerrados.clientes : [];
    } finally {
      _cargandoCerrados = null;
    }
  })();
  return _cargandoCerrados;
}

/** Invalida y vuelve a leer (al finalizar una ruta) */
async function refrescarCerrados(uid: string): Promise<Cliente[]> {
  _cacheCerrados = null;
  return asegurarCerrados(uid);
}

/**
 * Clientes de HOY para la caja: la ruta VIVA (ruta_activa, en
 * tiempo real) + los snapshots de las rutas cerradas HOY
 * (historial_rutas, cache de 1 lectura por sesión). Si cerraste
 * la ruta y la lista quedó vacía, el cierre de caja sigue
 * teniendo los números del día.
 */
function useClientesDeHoy(uid?: string | null): { clientes: Cliente[]; cargando: boolean } {
  const [vivos, setVivos] = useState<Cliente[]>([]);
  const [cerrados, setCerrados] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);

  // 1. Ruta viva (tiempo real — incluye los cobros de hace un minuto)
  useEffect(() => {
    const unsub = subscribeToRutaActiva((clientes) => {
      setVivos(clientes || []);
    });
    return () => unsub();
  }, []);

  // 2. Registros de HOY: cache compartido (1 lectura por sesión),
  //    refrescado al finalizar una ruta
  useEffect(() => {
    let vivo = true;
    if (!uid) {
      setCargando(false);
      return;
    }
    void asegurarCerrados(uid).then((lista) => {
      if (vivo) {
        setCerrados(lista);
        setCargando(false);
      }
    });
    const alFinalizar = () => {
      void refrescarCerrados(uid).then((lista) => {
        if (vivo) setCerrados(lista);
      });
    };
    window.addEventListener('rt-ruta-finalizada', alFinalizar);
    return () => {
      vivo = false;
      window.removeEventListener('rt-ruta-finalizada', alFinalizar);
    };
  }, [uid]);

  return { clientes: [...vivos, ...cerrados], cargando };
}

/** Resumen vivo: caja + clientes + gastos → todo junto */
export function useResumenCaja(uid?: string | null): {
  caja: EstadoCaja;
  gastosHoy: Gasto[];
  resumen: ResumenCaja;
  cierreHoy: ReturnType<typeof cierreDeHoy>;
  cargando: boolean;
  /** clientes de HOY (ruta viva + cerradas hoy) — F3.41: el
   *  resumen diario los cuenta para el mensaje de WhatsApp */
  clientes: Cliente[];
} {
  const caja = useCaja();
  const { clientes, cargando } = useClientesDeHoy(uid);

  // arranca el servicio al montar (una sola vez por uid)
  useEffect(() => {
    if (uid) arrancarCaja(uid);
  }, [uid]);

  const gastosHoy = useMemo(() => gastosDeHoy(caja), [caja]);
  const resumen = useMemo(
    () => resumenCajaDia(clientes, gastosHoy, caja.fondo),
    [clientes, gastosHoy, caja.fondo]
  );
  const cierreHoy = useMemo(() => cierreDeHoy(caja), [caja]);

  return { caja, gastosHoy, resumen, cierreHoy, cargando, clientes };
}

// ── Estilos compartidos ───────────────────────────────────

const inputNum =
  'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-cyan-500 tabular-nums placeholder:font-normal placeholder:text-slate-600';
const inputTexto =
  'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 placeholder:text-slate-600';
const btnChip = (activo: boolean) =>
  `px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
    activo ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
  }`;

/** parsea "12,50" / "12.50" / "S/12" → 12.5 */
function parsearSoles(texto: string): number {
  const limpio = texto.replace(/[^0-9.,]/g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? Math.max(0, n) : NaN;
}

// ═══════════════════════════════════════════════════════════
// 💰 GESTOR COMPLETO (vive en el modal del menú ☰)
// ═══════════════════════════════════════════════════════════

interface CajaCardProps {
  uid?: string | null;
  riderName?: string;
  onShowToast?: OnShowToast;
}

export const CajaCard: React.FC<CajaCardProps> = ({ uid, riderName, onShowToast }) => {
  const { caja, gastosHoy, resumen, cierreHoy, cargando } = useResumenCaja(uid);
  const cerrada = !!cierreHoy;

  const [fondoInput, setFondoInput] = useState<string | null>(null); // null = usa el guardado
  const [gastoCat, setGastoCat] = useState('gasolina');
  const [gastoMonto, setGastoMonto] = useState('');
  const [gastoPago, setGastoPago] = useState<'efectivo' | 'yape'>('efectivo');
  const [gastoConcepto, setGastoConcepto] = useState('');
  const [contadoInput, setContadoInput] = useState('');
  const [notaCierre, setNotaCierre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);

  const fondoEfectivo = fondoInput != null ? parsearSoles(fondoInput) : caja.fondo;

  // ── fondo ──
  const aplicarFondo = async (monto: number) => {
    if (!uid || isNaN(monto)) return;
    setFondoInput(null);
    await fijarFondo(uid, monto);
  };

  // ── gastos ──
  const agregar = async () => {
    if (!uid || guardando) return;
    const monto = parsearSoles(gastoMonto);
    if (isNaN(monto) || monto <= 0) {
      onShowToast?.('Monto inválido', 'Escribe cuánto gastaste (ej: 20 o 12.50)', 'warning');
      return;
    }
    setGuardando(true);
    try {
      const cat = categoriaInfo(gastoCat);
      await agregarGasto(uid, { categoria: gastoCat, concepto: gastoConcepto, monto, pago: gastoPago });
      setGastoMonto('');
      setGastoConcepto('');
      onShowToast?.('💸 Gasto anotado', `${cat.icono} ${cat.nombre} — ${formatearSoles(monto)} (${gastoPago})`, 'success');
    } catch (e: any) {
      onShowToast?.('No se pudo anotar', e?.message || 'Quedó en el teléfono — reintenta', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (id: string) => {
    if (!uid) return;
    try {
      await eliminarGasto(uid, id);
    } catch {
      onShowToast?.('No se pudo borrar', 'Quedó en el teléfono — reintenta', 'warning');
    }
  };

  // ── cierre ──
  const cerrar = async () => {
    if (!uid || guardando) return;
    const contado = parsearSoles(contadoInput);
    if (isNaN(contado)) {
      onShowToast?.('Cuéntalo primero', 'Escribe cuánta plata tienes ENCIMA al final del día', 'warning');
      return;
    }
    setGuardando(true);
    try {
      const cierre = await cerrarCaja(uid, { contado, resumen, nota: notaCierre });
      const et = etiquetaDiferencia(cierre.diferencia);
      setContadoInput('');
      setNotaCierre('');
      onShowToast?.(
        Math.abs(cierre.diferencia) <= 0.01 ? '🔒 Caja cerrada' : cierre.diferencia > 0 ? '🔒 Caja cerrada — sobró plata' : '🔒 Caja cerrada — faltó plata',
        `Contado ${formatearSoles(cierre.contado)} · ${et.texto}`,
        Math.abs(cierre.diferencia) <= 0.01 ? 'success' : cierre.diferencia > 0 ? 'info' : 'warning'
      );
    } catch (e: any) {
      onShowToast?.('No se pudo cerrar', e?.message || 'Quedó en el teléfono — reintenta', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  const reabrir = async () => {
    if (!uid || !cierreHoy) return;
    if (!confirm('¿Reabrir la caja de hoy?\n\nEl cierre se borra para que corrijas el conteo o los gastos.')) return;
    try {
      await reabrirCaja(uid);
      setContadoInput(String(cierreHoy.contado || '')); // pre-carga el conteo viejo
      onShowToast?.('🔓 Caja reabierta', 'Corrige lo que necesites y vuelve a cerrar', 'info');
    } catch {
      onShowToast?.('No se pudo reabrir', 'Quedó en el teléfono — reintenta', 'warning');
    }
  };

  const mandarAMate = async () => {
    if (!cierreHoy) return;
    try {
      onShowToast?.('📤 MATE', 'Enviando el cierre al grupo…', 'info');
      await enviarAGrupoMate(armarMensajeCierre(cierreHoy, riderName));
      onShowToast?.('✅ Cierre enviado', 'El grupo MATE recibe el resumen de tu caja', 'success');
    } catch (e: any) {
      onShowToast?.('No se pudo enviar', e?.message || 'Revisa tu internet e inténtalo de nuevo', 'error');
    }
  };

  // ── render helpers ──
  const fila = (icono: string, etiqueta: string, valor: string, claseValor = 'text-white') => (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-400 flex items-center gap-1.5 min-w-0">
        <span className="w-4 text-center flex-shrink-0">{icono}</span>
        <span className="truncate">{etiqueta}</span>
      </span>
      <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${claseValor}`}>{valor}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* ── Encabezado ── */}
      <div
        className={`rounded-2xl border p-3.5 ${
          cerrada
            ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-slate-900/80 to-slate-900/80'
            : 'border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 via-slate-900/80 to-slate-900/80'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
              cerrada ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-cyan-500/15 border-cyan-500/40'
            }`}
          >
            {cerrada ? <Lock className="w-5 h-5 text-emerald-400" /> : <Wallet className="w-5 h-5 text-cyan-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Caja del día</p>
            <p className="text-xl font-black text-white leading-tight">
              {cerrada ? `Cerrada · neto ${formatearSoles(cierreHoy!.netoDelDia)}` : `${resumen.entregas} entregas · ${formatearSoles(resumen.cobradoTotal)}`}
            </p>
            <p className="text-[10px] text-slate-500">
              {cerrada
                ? `contado ${formatearSoles(cierreHoy!.contado)} · ${etiquetaDiferencia(cierreHoy!.diferencia).texto}`
                : cargando
                  ? 'cargando el día…'
                  : 'esperado en caja abajo · cuadra al final'}
            </p>
          </div>
          <button
            onClick={async () => {
              if (!uid) return;
              await recargarCaja(uid);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
            title="Recargar desde la nube"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Fondo inicial ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 flex items-center gap-1">
          <Coins className="w-3 h-3 text-amber-400" /> Fondo inicial (cambio para vueltos)
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {[20, 50, 100].map((f) => (
            <button key={f} disabled={cerrada} onClick={() => void aplicarFondo(f)} className={btnChip(fondoEfectivo === f && fondoInput == null)}>
              S/ {f}
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-bold">Otro:</span>
            <input
              className={`${inputNum} w-24 py-1.5`}
              placeholder="S/"
              inputMode="decimal"
              disabled={cerrada}
              value={fondoInput != null ? fondoInput : caja.fondo > 0 ? String(caja.fondo) : ''}
              onChange={(e) => setFondoInput(e.target.value)}
              onBlur={() => {
                if (fondoInput != null && !isNaN(parsearSoles(fondoInput))) void aplicarFondo(parsearSoles(fondoInput));
                else setFondoInput(null);
              }}
            />
          </div>
        </div>
        <p className="text-[9px] text-slate-600 leading-tight mt-1.5">
          Con cuánta plata abriste el día. Ese dinero ES TUYO — no cuenta como ganancia, solo sirve para dar vueltos.
        </p>
      </div>

      {/* ── Resumen del día ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">📋 Resumen del día (vivo)</p>
        {fila('💵', 'Efectivo cobrado (en tu caja)', formatearSoles(resumen.efectivoCobrado), 'text-emerald-300')}
        {resumen.digitalRider !== 0 && fila('📱', 'Yape digital (no está en tu caja)', formatearSoles(resumen.digitalRider), 'text-violet-300')}
        {resumen.empresa !== 0 && fila('🏪', 'Cobra la empresa directo', formatearSoles(resumen.empresa), 'text-slate-300')}
        {fila('🧾', 'Total del día', formatearSoles(resumen.cobradoTotal), 'text-white')}
        {fila('💸', `Gastos hoy (${resumen.nGastos})`, formatearSoles(resumen.gastosEfectivo + resumen.gastosDigital), 'text-orange-300')}
        <div className="border-t border-slate-700/60 my-1.5" />
        {fila('🧮', 'Deberías tener en el bolsillo', formatearSoles(resumen.esperado), 'text-cyan-300 text-base')}
        <p className="text-[9px] text-slate-600 leading-tight mt-1.5">
          fondo {formatearSoles(caja.fondo)} + efectivo cobrado {formatearSoles(resumen.efectivoCobrado)} − gastos en efectivo {formatearSoles(resumen.gastosEfectivo)}. El yape y lo de la empresa NO está en tu bolsillo.
        </p>
      </div>

      {/* ── Gastos de hoy ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">💸 Gastos de hoy</p>

        {/* categorías */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {CATEGORIAS_GASTO.map((c) => (
            <button
              key={c.id}
              disabled={cerrada}
              onClick={() => setGastoCat(c.id)}
              className={btnChip(gastoCat === c.id)}
              title={c.nombre}
            >
              {c.icono} {c.nombre}
            </button>
          ))}
        </div>

        {/* fila de alta rápida */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            className={`${inputNum} w-24 py-1.5`}
            placeholder="S/"
            inputMode="decimal"
            disabled={cerrada}
            value={gastoMonto}
            onChange={(e) => setGastoMonto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void agregar();
            }}
          />
          <div className="flex rounded-lg border border-slate-700 overflow-hidden">
            <button
              disabled={cerrada}
              onClick={() => setGastoPago('efectivo')}
              className={`px-2 py-1.5 text-[11px] font-bold transition-colors ${gastoPago === 'efectivo' ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-700'}`}
              title="Sale de tu caja física"
            >
              💵 efectivo
            </button>
            <button
              disabled={cerrada}
              onClick={() => setGastoPago('yape')}
              className={`px-2 py-1.5 text-[11px] font-bold transition-colors ${gastoPago === 'yape' ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-700'}`}
              title="Pagado con yape — no sale de tu caja física"
            >
              📱 yape
            </button>
          </div>
          <input
            className={`${inputTexto} flex-1 min-w-28 py-1.5`}
            placeholder="de qué fue (opcional)"
            disabled={cerrada}
            value={gastoConcepto}
            onChange={(e) => setGastoConcepto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void agregar();
            }}
          />
          <button
            disabled={cerrada || guardando || !gastoMonto.trim()}
            onClick={() => void agregar()}
            className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-30 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> anotar
          </button>
        </div>

        {/* lista */}
        {gastosHoy.length === 0 ? (
          <p className="text-[10px] text-slate-600 mt-2">Sin gastos anotados hoy.</p>
        ) : (
          <div className="mt-2 space-y-1 max-h-36 overflow-y-auto custom-scrollbar pr-0.5">
            {gastosHoy.map((g) => {
              const cat = categoriaInfo(g.categoria);
              return (
                <div key={g.id} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-2 py-1.5">
                  <span className="text-sm w-5 text-center flex-shrink-0">{cat.icono}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">{horaCorta(g.ts)}</span>
                  <span className="text-xs text-slate-200 font-medium truncate flex-1 min-w-0">
                    {cat.nombre}
                    {g.concepto ? <span className="text-slate-500"> · {g.concepto}</span> : null}
                  </span>
                  <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${g.pago === 'yape' ? 'text-violet-300' : 'text-orange-300'}`}>
                    {g.pago === 'yape' ? '📱' : '💵'} {formatearSoles(g.monto)}
                  </span>
                  {!cerrada && (
                    <button
                      onClick={() => void quitar(g.id)}
                      className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700/50 transition-colors flex-shrink-0"
                      title="Borrar gasto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {cerrada && <p className="text-[9px] text-slate-600 mt-1.5">🔒 Caja cerrada — reábrela para editar gastos.</p>}
      </div>

      {/* ── Cierre ── */}
      {cerrada ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-slate-900/80 to-slate-900/80 p-3.5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">🔒 Caja de hoy cerrada</p>
          {fila('🤲', 'Contado', formatearSoles(cierreHoy!.contado))}
          {fila('🧮', 'Esperado', formatearSoles(cierreHoy!.esperado))}
          {(() => {
            const et = etiquetaDiferencia(cierreHoy!.diferencia);
            const color = et.clase === 'ok' ? 'text-emerald-300' : et.clase === 'sobra' ? 'text-amber-300' : 'text-red-300';
            return (
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-400">⚖️ Diferencia</span>
                <span className={`text-base font-black ${color}`}>{et.texto}</span>
              </div>
            );
          })()}
          {fila('🏷️', 'Neto del día (− gastos)', formatearSoles(cierreHoy!.netoDelDia), 'text-emerald-300')}
          {cierreHoy!.nota && <p className="text-[10px] text-slate-500 mt-1 italic">📝 {cierreHoy!.nota}</p>}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => void mandarAMate()}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Enviar a MATE
            </button>
            <button
              onClick={() => void reabrir()}
              className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-bold transition-all active:scale-[0.98] flex items-center gap-1.5"
              title="Borrar el cierre de hoy para corregirlo"
            >
              <Unlock className="w-4 h-4" /> Reabrir
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 via-slate-900/80 to-slate-900/80 p-3.5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">🔒 Cerrar la caja</p>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2.5">
            Al final del día, cuenta la plata que tienes encima y escríbela. La app la compara con lo que <b>deberías</b> tener ({formatearSoles(resumen.esperado)}).
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-bold">Contado:</span>
            <input
              className={`${inputNum} w-32`}
              placeholder="S/"
              inputMode="decimal"
              value={contadoInput}
              onChange={(e) => setContadoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void cerrar();
              }}
            />
            {(() => {
              const contado = parsearSoles(contadoInput);
              if (contadoInput.trim() === '' || isNaN(contado)) return null;
              const et = etiquetaDiferencia(contado - resumen.esperado);
              const color = et.clase === 'ok' ? 'text-emerald-300' : et.clase === 'sobra' ? 'text-amber-300' : 'text-red-300';
              return <span className={`text-sm font-black ${color}`}>{et.texto}</span>;
            })()}
          </div>
          <input
            className={`${inputTexto} w-full mt-2`}
            placeholder="nota del cierre (opcional — ej: faltó 2 porque di vuelto mal)"
            value={notaCierre}
            onChange={(e) => setNotaCierre(e.target.value)}
          />
          <button
            onClick={() => void cerrar()}
            disabled={guardando || contadoInput.trim() === ''}
            className="w-full mt-2.5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" /> Cerrar caja de hoy
          </button>
          <p className="text-[9px] text-slate-600 leading-tight mt-1.5">
            El cierre congela los números del día (gastos incluidos). Después puedes mandarlo al grupo MATE. ¿Te equivocaste? Reábrela.
          </p>
        </div>
      )}

      {/* ── Historial de cierres ── */}
      {caja.cierres.length > 0 && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
          <button
            onClick={() => setHistorialAbierto((v) => !v)}
            className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span>📊 Últimos cierres ({caja.cierres.length})</span>
            {historialAbierto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {historialAbierto && (
            <div className="mt-2 space-y-1">
              {caja.cierres.slice(0, 10).map((c) => {
                const et = etiquetaDiferencia(c.diferencia);
                const color = et.clase === 'ok' ? 'text-emerald-300' : et.clase === 'sobra' ? 'text-amber-300' : 'text-red-300';
                return (
                  <div key={`${c.fecha}_${c.at}`} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-2 py-1.5">
                    <span className="text-[11px] text-slate-400 tabular-nums w-12 flex-shrink-0">{fechaCorta(c.fecha)}</span>
                    <span className="text-[11px] text-slate-500 flex-shrink-0">{c.entregas} ent.</span>
                    <span className="text-xs font-bold text-emerald-300 tabular-nums flex-shrink-0">neto {formatearSoles(c.netoDelDia)}</span>
                    <span className={`text-[10px] font-bold truncate flex-1 min-w-0 ${color}`}>{et.texto}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 🔘 BOTÓN DE MENÚ (F3.40) — fila IGUAL a las demás opciones del
// ☰ (icono + "Caja" + badge con el esperado en caja / candado).
// Reemplaza al bloque grande que saturaba el menú. Toca → gestor.
// ═══════════════════════════════════════════════════════════

interface CajaMenuBotonProps {
  uid?: string | null;
  /** Sidebar colapsado → solo el icono */
  colapsado?: boolean;
  onAbrir?: () => void;
}

export const CajaMenuBoton: React.FC<CajaMenuBotonProps> = ({ uid, colapsado, onAbrir }) => {
  const { caja, resumen, cierreHoy } = useResumenCaja(uid);
  const [cargando, setCargando] = useState(true);
  const cerrada = !!cierreHoy;

  useEffect(() => {
    if (!uid) {
      setCargando(false);
      return;
    }
    let vivo = true;
    recargarCaja(uid).finally(() => {
      if (vivo) setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [uid]);

  const badge = cargando
    ? { texto: '…', clase: 'bg-slate-800 text-slate-400 border-slate-700' }
    : cerrada
      ? { texto: formatearSoles(cierreHoy!.netoDelDia), clase: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
      : { texto: formatearSoles(resumen.esperado), clase: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };

  return (
    <button
      onClick={onAbrir}
      title={
        colapsado
          ? 'Caja del día'
          : cerrada
            ? `Caja CERRADA · ${etiquetaDiferencia(cierreHoy!.diferencia).texto} — toca para ver el cierre`
            : `En caja 💵 ${formatearSoles(resumen.esperado)}${resumen.nGastos > 0 ? ` · ${resumen.nGastos} gastos` : ''} — toca para anotar / cerrar`
      }
      className="group relative flex items-center w-full px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 active:scale-[0.98]"
    >
      {cerrada ? (
        <Lock className="w-5 h-5 flex-shrink-0 text-emerald-400 transition-transform duration-200 group-hover:scale-105" />
      ) : (
        <Wallet className="w-5 h-5 flex-shrink-0 text-cyan-400 transition-transform duration-200 group-hover:scale-105" />
      )}
      {!colapsado && <span className="ml-3 truncate font-medium">Caja</span>}
      {!colapsado && (
        <span className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full border tabular-nums ${badge.clase}`}>
          {badge.texto}
        </span>
      )}
      {colapsado && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
          Caja del día
        </div>
      )}
    </button>
  );
};
