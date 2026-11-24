// ═══════════════════════════════════════════════════════════
// 💜 MI YAPE — UI (FASE BH · v0.11.34)
// Tus dos Yapes vigilados sin abrir la app de Yape: el
// PERSONAL (tu cuenta) y el de la EMPRESA. Dos piezas (patrón
// F3.39/3.40 de la caja):
//   · YapeCard      → gestor COMPLETO: saldos de las dos
//                     cuentas, lo que pasó HOY (yapes de
//                     inDriver / de tu trabajo / de clientes,
//                     depósitos, gastos), anotar en 2 toques y
//                     el historial de movimientos. Vive en el
//                     MODAL del menú hamburguesa ☰.
//   · YapeMenuBoton → fila del menú ☰ (icono + "Mi Yape" +
//                     badge con tu saldo) — toca y abre.
//
// 💜 FASE BH: se dice «me yapearon» (el typo corregido), el depósito a la
// empresa se DESCUENTA del Yape de la empresa, el chape lleva
// origen (inDriver / tu trabajo / cliente) y los números van
// BLANCOS y GRANDES para verse al sol.
//
// La plata vive en usuarios/{uid}.yape (servicio FASE W: se
// sincroniza EN VIVO entre tus celulares, sin reglas nuevas).
// El saldo SIEMPRE sale de la suma de movimientos → si algo no
// cuadra con la app de Yape, "fijar saldo" lo clava al número
// real con un ajuste.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Smartphone, RefreshCw, Trash2, Coins } from 'lucide-react';
import {
  arrancarYape,
  recargarYape,
  snapshotYape,
  suscribirYape,
  agregarMovimiento,
  eliminarMovimiento,
  fijarSaldo,
  EstadoYape,
  EVENTO_YAPE_REMOTA,
} from '../services/yape';
import {
  CuentaYape,
  MovimientoYape,
  OrigenYape,
  ResumenYape,
  TipoMovYape,
  infoTipoYape,
  movsDeFecha,
  resumenYape,
  saldosYape,
} from '../utils/yapeCore';
import { fechaCorta, fechaLocalDe, formatearSoles, horaCorta } from '../utils/cajaCore';

type OnShowToast = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

// ── Hooks ─────────────────────────────────────────────────

/** Store del yape en vivo */
function useYape(): EstadoYape {
  return useSyncExternalStore(suscribirYape, snapshotYape);
}

// ── Estilos compartidos (los mismos de CajaCard) ──────────

const inputNum =
  'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-violet-500 tabular-nums placeholder:font-normal placeholder:text-slate-600';
const inputTexto =
  'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 placeholder:text-slate-600';
const btnChip = (activo: boolean) =>
  `px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
    activo ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
  }`;

/** parsea "12,50" / "12.50" / "S/12" → 12.5 */
function parsearSoles(texto: string): number {
  const limpio = texto.replace(/[^0-9.,-]/g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? n : NaN;
}

/** fila icono + label + valor (la misma de la caja) — 💜 FASE
 *  BH: labels más claros y valores con color -400 (al sol los
 *  -300 pastel se lavaban) */
const fila = (icono: string, label: string, valor: string, extra = '') => (
  <div className="flex items-center justify-between py-1">
    <span className="text-xs text-slate-200 truncate">{icono} {label}</span>
    <span className={`text-sm font-black tabular-nums ${extra || 'text-white'}`}>{valor}</span>
  </div>
);

/** 💜 FASE BH: sub-fila del split de HOY (inDriver / trabajo /
 *  clientes) — más chica e indentada, con número BLANCO y
 *  negrita para verse al sol */
const filaSub = (label: string, valor: string, extra = '') => (
  <div className="flex items-center justify-between py-0.5 pl-1">
    <span className="text-[11px] text-slate-300 truncate">{label}</span>
    <span className={`text-xs font-black tabular-nums ${extra || 'text-white'}`}>{valor}</span>
  </div>
);

// ── La tarjeta de un Yape (saldo + fijar) ─────────────────

const TarjetaCuenta: React.FC<{
  cuenta: CuentaYape;
  saldo: number;
  fijando: boolean;
  saldoInput: string;
  onAbrirFijar: () => void;
  onCambiarSaldo: (v: string) => void;
  onConfirmarFijar: () => void;
  onCancelarFijar: () => void;
}> = ({ cuenta, saldo, fijando, saldoInput, onAbrirFijar, onCambiarSaldo, onConfirmarFijar, onCancelarFijar }) => {
  const esEmpresa = cuenta === 'empresa';
  return (
    <div
      className={`rounded-2xl border p-3 ${
        esEmpresa
          ? 'border-sky-500/40 bg-gradient-to-br from-sky-500/10 via-slate-900/80 to-slate-900/80'
          : 'border-violet-500/40 bg-gradient-to-br from-violet-500/10 via-slate-900/80 to-slate-900/80'
      }`}
      data-testid={`yape-card-${cuenta}`}
    >
      <p className={`text-[10px] uppercase tracking-wider font-bold ${esEmpresa ? 'text-sky-400' : 'text-violet-400'}`}>
        {esEmpresa ? '🔷 Yape de la empresa' : '💜 Tu Yape (personal)'}
      </p>
      {/* 💜 FASE BH: el saldo BLANCO y GRANDE — al sol se tiene
          que ver de una (los pastel -200 se lavaban) */}
      <p className="text-3xl font-black tabular-nums mt-1 text-white" data-testid={`yape-saldo-${cuenta}`}>
        {formatearSoles(saldo)}
      </p>
      {fijando ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            className={`${inputNum} flex-1 min-w-0 py-1.5`}
            placeholder="S/ que muestra Yape"
            inputMode="decimal"
            autoFocus
            value={saldoInput}
            onChange={(e) => onCambiarSaldo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmarFijar();
            }}
            data-testid={`yape-input-saldo-${cuenta}`}
          />
          <button
            onClick={onConfirmarFijar}
            disabled={saldoInput.trim() === '' || isNaN(parsearSoles(saldoInput))}
            className="px-2.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black transition-all active:scale-95 disabled:opacity-30 flex-shrink-0"
            data-testid={`yape-boton-fijar-${cuenta}`}
          >
            ✓ fijar
          </button>
          <button
            onClick={onCancelarFijar}
            className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 text-xs font-bold transition-colors flex-shrink-0"
          >
            ✖
          </button>
        </div>
      ) : (
        <button
          onClick={onAbrirFijar}
          className="mt-2 text-[10px] text-slate-400 hover:text-slate-200 underline transition-colors"
          title="Cuadra este saldo con lo que muestra la app de Yape (crea un ajuste, el historial no se toca)"
          data-testid={`yape-abrir-fijar-${cuenta}`}
        >
          ✏️ fijar saldo
        </button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 💜 GESTOR COMPLETO (vive en el modal del menú ☰)
// ═══════════════════════════════════════════════════════════

interface YapeCardProps {
  uid?: string | null;
  onShowToast?: OnShowToast;
}

export const YapeCard: React.FC<YapeCardProps> = ({ uid, onShowToast }) => {
  const yape = useYape();
  // el «hoy» del yape sale de la MISMA fuente que fecha los
  // movimientos (fechaLocalDe) → nunca se des-cuadra por zona
  const hoyStr = fechaLocalDe(Date.now());
  const resumen = useMemo<ResumenYape>(() => resumenYape(yape.movs, hoyStr), [yape, hoyStr]);
  const saldos = useMemo(() => saldosYape(yape.movs), [yape]);
  const movsHoy = useMemo(() => movsDeFecha(yape.movs, hoyStr), [yape, hoyStr]);
  const movsAnteriores = useMemo(
    () => yape.movs.filter((m) => m.ts > 0 && fechaLocalDe(m.ts) !== hoyStr).slice(0, 30),
    [yape, hoyStr]
  );

  // arranca el servicio al montar (una sola vez por uid)
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    if (!uid) {
      setCargando(false);
      return;
    }
    let vivo = true;
    arrancarYape(uid);
    recargarYape(uid).finally(() => {
      if (vivo) setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [uid]);

  // 🔄 FASE W: el yape se sincroniza EN VIVO entre celulares —
  // cuando algo llega desde el otro, avisá sin asustar: los
  // números de abajo ya se actualizaron solos.
  useEffect(() => {
    const alCambiarRemoto = () => {
      onShowToast?.('🔄 Yape actualizado', 'Se sincronizó desde tu otro celular', 'info');
    };
    window.addEventListener(EVENTO_YAPE_REMOTA, alCambiarRemoto);
    return () => window.removeEventListener(EVENTO_YAPE_REMOTA, alCambiarRemoto);
  }, [onShowToast]);

  // ── form de anotar ──
  const [tipo, setTipo] = useState<TipoMovYape>('chape');
  const [cuentaGasto, setCuentaGasto] = useState<CuentaYape>('personal');
  // 💜 FASE BH: el chape también elige cuenta (¿te yapearon al
  // tuyo o PAGÓ UN CLIENTE al de la empresa?) y, si es al
  // tuyo, de dónde vino la plata (inDriver / tu trabajo)
  const [cuentaChape, setCuentaChape] = useState<CuentaYape>('personal');
  const [origenChape, setOrigenChape] = useState<OrigenYape>('indriver');
  const [montoInput, setMontoInput] = useState('');
  const [notaInput, setNotaInput] = useState('');
  const [guardando, setGuardando] = useState(false);

  // ── fijar saldo ──
  const [fijandoCuenta, setFijandoCuenta] = useState<CuentaYape | null>(null);
  const [saldoInput, setSaldoInput] = useState('');

  const anotar = async () => {
    if (!uid || guardando) return;
    const monto = parsearSoles(montoInput);
    if (isNaN(monto) || monto <= 0) {
      onShowToast?.('Monto inválido', 'Escribe la plata (ej: 15 o 20.50)', 'warning');
      return;
    }
    setGuardando(true);
    try {
      const info = infoTipoYape(tipo);
      // 💜 FASE BH: cuenta/origen según lo que se está anotando:
      //   · chape    → la cuenta elegida (+ origen si es personal)
      //   · gasto    → la cuenta elegida
      //   · deposito → SIEMPRE empresa (se descuenta del Yape
      //                de la empresa — la plata es de ellos)
      const cuentaFinal: CuentaYape =
        tipo === 'gasto' ? cuentaGasto : tipo === 'chape' ? cuentaChape : tipo === 'deposito' ? 'empresa' : 'personal';
      const origenFinal: OrigenYape | undefined =
        tipo === 'chape' && cuentaChape === 'personal' ? origenChape : undefined;
      await agregarMovimiento(uid, {
        tipo,
        cuenta: cuentaFinal,
        monto,
        origen: origenFinal,
        nota: notaInput,
      });
      setMontoInput('');
      setNotaInput('');
      const detalle =
        tipo === 'chape'
          ? cuentaChape === 'empresa'
            ? ' · cliente al Yape de la empresa'
            : origenChape === 'indriver'
              ? ' · de inDriver'
              : ' · de tu trabajo'
          : tipo === 'deposito'
            ? ' · se descontó del Yape de la empresa'
            : '';
      onShowToast?.(`${info.icono} Anotado`, `${info.nombre}${detalle} — ${formatearSoles(monto)}`, 'success');
    } catch (e: any) {
      onShowToast?.('No se pudo anotar', e?.message || 'Quedó en el teléfono — reintenta', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarFijar = async (cuenta: CuentaYape) => {
    if (!uid) return;
    const real = parsearSoles(saldoInput);
    if (isNaN(real) || real < 0) {
      onShowToast?.('Saldo inválido', 'Escribe lo que muestra la app de Yape (ej: 150)', 'warning');
      return;
    }
    try {
      const aj = await fijarSaldo(uid, cuenta, real);
      setFijandoCuenta(null);
      setSaldoInput('');
      if (aj) {
        onShowToast?.(
          cuenta === 'empresa' ? '🔷 Empresa cuadrada' : '💜 Yape cuadrado',
          `Quedó en ${formatearSoles(real)} (ajuste ${aj.monto >= 0 ? '+' : '−'} ${formatearSoles(Math.abs(aj.monto))})`,
          'success'
        );
      } else {
        onShowToast?.('Ya cuadraba', 'El saldo ya era exactamente ese', 'info');
      }
    } catch (e: any) {
      onShowToast?.('No se pudo fijar', e?.message || 'Quedó en el teléfono — reintenta', 'warning');
    }
  };

  const quitar = async (id: string) => {
    if (!uid) return;
    try {
      await eliminarMovimiento(uid, id);
    } catch {
      onShowToast?.('No se pudo borrar', 'Quedó en el teléfono — reintenta', 'warning');
    }
  };

  /** una fila del historial — 💜 FASE BH: colores -400 y
   *  nombres BLANCOS (al sol los pastel se lavaban) */
  const filaMov = (m: MovimientoYape, esHoy: boolean) => {
    const info = infoTipoYape(m.tipo);
    const monto = Math.abs(Number(m.monto) || 0);
    let montoTxt = '';
    let color = 'text-white';
    if (m.tipo === 'chape') {
      montoTxt = `+ ${formatearSoles(monto)}`;
      color = 'text-emerald-400';
    } else if (m.tipo === 'gasto') {
      montoTxt = `− ${formatearSoles(monto)}`;
      color = 'text-red-400';
    } else if (m.tipo === 'deposito') {
      montoTxt = `− ${formatearSoles(monto)}`;
      color = 'text-amber-400';
    } else if (m.tipo === 'retiro') {
      montoTxt = `+ ${formatearSoles(monto)}`;
      color = 'text-sky-400';
    } else {
      montoTxt = `${m.monto >= 0 ? '+' : '−'} ${formatearSoles(monto)}`;
      color = 'text-white';
    }
    const sub =
      m.tipo === 'deposito'
        ? m.cuenta === 'empresa'
          ? ' · del Yape de la empresa'
          : ' · (versión anterior: −tuyo / +empresa)'
        : m.tipo === 'retiro'
          ? ' · −empresa / +tu Yape'
          : m.tipo === 'gasto' && m.cuenta === 'empresa'
            ? ' · del Yape de la empresa'
            : '';
    // 💜 FASE BH: el chape muestra de dónde vino
    const origenTxt =
      m.tipo === 'chape'
        ? m.cuenta === 'empresa'
          ? ' · 🛍 cliente'
          : m.origen === 'indriver'
            ? ' · 🚗 inDriver'
            : m.origen === 'empresa'
              ? ' · 🏢 tu trabajo'
              : ''
        : '';
    return (
      <div key={m.id} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-2 py-1.5" data-testid={`yape-mov-${m.id}`}>
        <span className="text-sm w-5 text-center flex-shrink-0">{info.icono}</span>
        <span className="text-[11px] text-slate-300 tabular-nums flex-shrink-0">
          {esHoy ? horaCorta(m.ts) : fechaCorta(fechaLocalDe(m.ts))}
        </span>
        <span className="text-xs text-white font-medium truncate flex-1 min-w-0">
          {m.tipo === 'gasto' ? (m.cuenta === 'empresa' ? 'Gasto empresa' : 'Gasto') : info.nombre}
          {origenTxt && <span className="text-slate-400 font-bold">{origenTxt}</span>}
          {sub && <span className="text-slate-400">{sub}</span>}
          {m.nota ? <span className="text-slate-400"> · {m.nota}</span> : null}
        </span>
        <span className={`text-xs font-black tabular-nums flex-shrink-0 ${color}`}>{montoTxt}</span>
        <button
          onClick={() => void quitar(m.id)}
          className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700/50 transition-colors flex-shrink-0"
          title="Borrar movimiento"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  };

  const vacio = yape.movs.filter((m) => m.ts > 0).length === 0;

  return (
    <div className="space-y-3" data-testid="yape-gestor">
      {/* ── encabezado ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border bg-violet-500/15 border-violet-500/40">
            <Smartphone className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white leading-tight">Tus Yapes</p>
            <p className="text-[10px] text-slate-500">
              {cargando
                ? 'sincronizando con la nube…'
                : vacio
                  ? 'la plata de tus dos cuentas, al día'
                  : `en vivo · ${movsHoy.length} movimientos hoy · 🔄 se sincroniza entre tus celulares`}
            </p>
          </div>
          <button
            onClick={async () => {
              if (!uid) return;
              await recargarYape(uid);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-slate-800 transition-colors"
            title="Recargar desde la nube · 🔄 el yape ya se sincroniza solo entre tus celulares"
            data-testid="yape-refrescar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── los dos saldos ── */}
      <div className="grid grid-cols-2 gap-2.5">
        <TarjetaCuenta
          cuenta="personal"
          saldo={saldos.personal}
          fijando={fijandoCuenta === 'personal'}
          saldoInput={saldoInput}
          onAbrirFijar={() => {
            setFijandoCuenta('personal');
            setSaldoInput(saldos.personal ? String(saldos.personal) : '');
          }}
          onCambiarSaldo={setSaldoInput}
          onConfirmarFijar={() => void confirmarFijar('personal')}
          onCancelarFijar={() => {
            setFijandoCuenta(null);
            setSaldoInput('');
          }}
        />
        <TarjetaCuenta
          cuenta="empresa"
          saldo={saldos.empresa}
          fijando={fijandoCuenta === 'empresa'}
          saldoInput={saldoInput}
          onAbrirFijar={() => {
            setFijandoCuenta('empresa');
            setSaldoInput(saldos.empresa ? String(saldos.empresa) : '');
          }}
          onCambiarSaldo={setSaldoInput}
          onConfirmarFijar={() => void confirmarFijar('empresa')}
          onCancelarFijar={() => {
            setFijandoCuenta(null);
            setSaldoInput('');
          }}
        />
      </div>
      <p className="text-[9px] text-slate-600 leading-tight -mt-1 px-0.5">
        El saldo sale de la suma de los movimientos. ¿No cuadra con la app de Yape? Tocá <b>fijar saldo</b> y queda clavado al número real.
      </p>

      {/* ── lo que pasó HOY ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-300 mb-1.5">📆 Hoy</p>
        {resumen.hoyN === 0 ? (
          <p className="text-[10px] text-slate-500">Todavía no anotaste nada hoy.</p>
        ) : (
          <>
            {/* 💜 FASE BH: "me llamaron, ¿de inDriver o de la
                empresa?" — el split al toque */}
            {resumen.hoyNChapes > 0 && (
              <>
                {fila('💜', `Te yapearon (${resumen.hoyNChapes})`, `+ ${formatearSoles(resumen.hoyChapes)}`, 'text-emerald-400')}
                <div className="rounded-lg bg-slate-800/60 px-2 py-0.5 my-0.5">
                  {filaSub('🚗 de inDriver', `+ ${formatearSoles(resumen.hoyChapesIndriver)}`, 'text-emerald-400')}
                  {filaSub('🏢 de tu trabajo', `+ ${formatearSoles(resumen.hoyChapesTrabajo)}`, 'text-emerald-400')}
                  {resumen.hoyChapesClientes > 0 &&
                    filaSub('🛍 clientes → Yape empresa', `+ ${formatearSoles(resumen.hoyChapesClientes)}`, 'text-emerald-400')}
                </div>
              </>
            )}
            {resumen.hoyDepositado > 0 &&
              fila('🏦', 'Depositaste a la empresa', formatearSoles(resumen.hoyDepositado), 'text-amber-400')}
            {resumen.hoyRetirado > 0 &&
              fila('💵', 'Retiraste de la empresa', formatearSoles(resumen.hoyRetirado), 'text-sky-400')}
            {resumen.hoyGastoPersonal > 0 &&
              fila('💸', 'Gastaste (tu Yape)', `− ${formatearSoles(resumen.hoyGastoPersonal)}`, 'text-red-400')}
            {resumen.hoyGastoEmpresa > 0 &&
              fila('💸', 'Gastaste (empresa)', `− ${formatearSoles(resumen.hoyGastoEmpresa)}`, 'text-red-400')}
          </>
        )}
      </div>

      {/* ── anotar ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-300 mb-2 flex items-center gap-1">
          <Coins className="w-3 h-3 text-violet-400" /> Anotar en 2 toques
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTipo('chape')} className={btnChip(tipo === 'chape')} data-testid="yape-chip-chape">
            💜 Me yapearon
          </button>
          <button onClick={() => setTipo('gasto')} className={btnChip(tipo === 'gasto')} data-testid="yape-chip-gasto">
            💸 Gasté
          </button>
          <button onClick={() => setTipo('deposito')} className={btnChip(tipo === 'deposito')} data-testid="yape-chip-deposito">
            🏦 Deposité a la empresa
          </button>
          <button onClick={() => setTipo('retiro')} className={btnChip(tipo === 'retiro')} data-testid="yape-chip-retiro">
            💵 Retiré de la empresa
          </button>
        </div>
        {/* 💜 FASE BH — el yape elige cuenta: ¿te yapearon al
            tuyo o PAGÓ UN CLIENTE al Yape de la empresa? Y si
            es al tuyo, ¿de inDriver o de tu trabajo? */}
        {tipo === 'chape' && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold">¿a cuál Yape?</span>
              <button
                onClick={() => setCuentaChape('personal')}
                className={cuentaChape === 'personal' ? 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-violet-600 border-violet-500 text-white' : 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-slate-900 border-slate-700 text-slate-300'}
                data-testid="yape-chape-cuenta-personal"
              >
                💜 el tuyo
              </button>
              <button
                onClick={() => setCuentaChape('empresa')}
                className={cuentaChape === 'empresa' ? 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-sky-600 border-sky-500 text-white' : 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-slate-900 border-slate-700 text-slate-300'}
                data-testid="yape-chape-cuenta-empresa"
              >
                🔷 empresa (clientes)
              </button>
            </div>
            {cuentaChape === 'personal' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-bold">¿de dónde?</span>
                <button
                  onClick={() => setOrigenChape('indriver')}
                  className={origenChape === 'indriver' ? 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-emerald-600 border-emerald-500 text-white' : 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-slate-900 border-slate-700 text-slate-300'}
                  data-testid="yape-chape-origen-indriver"
                >
                  🚗 inDriver
                </button>
                <button
                  onClick={() => setOrigenChape('empresa')}
                  className={origenChape === 'empresa' ? 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-600 border-amber-500 text-white' : 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-slate-900 border-slate-700 text-slate-300'}
                  data-testid="yape-chape-origen-empresa"
                >
                  🏢 mi trabajo
                </button>
              </div>
            )}
          </div>
        )}
        {/* 💜 FASE BH: el depósito sale del Yape de la EMPRESA */}
        {tipo === 'deposito' && (
          <p className="text-[10px] text-slate-400 mt-2">
            🔷 Se descuenta del <b>Yape de la empresa</b> (la plata de los clientes es de ellos — al final de la ruta le pasás lo juntado)
          </p>
        )}
        {tipo === 'gasto' && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] text-slate-500 font-bold">¿de cuál Yape?</span>
            <button
              onClick={() => setCuentaGasto('personal')}
              className={cuentaGasto === 'personal' ? 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-violet-600 border-violet-500 text-white' : 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-slate-900 border-slate-700 text-slate-300'}
              data-testid="yape-gasto-cuenta-personal"
            >
              💜 el tuyo
            </button>
            <button
              onClick={() => setCuentaGasto('empresa')}
              className={cuentaGasto === 'empresa' ? 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-sky-600 border-sky-500 text-white' : 'px-2 py-1 rounded-lg text-[10px] font-bold border bg-slate-900 border-slate-700 text-slate-300'}
              data-testid="yape-gasto-cuenta-empresa"
            >
              🔷 empresa
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-2">
          <input
            className={`${inputNum} w-28`}
            placeholder="S/"
            inputMode="decimal"
            value={montoInput}
            onChange={(e) => setMontoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void anotar();
            }}
            data-testid="yape-form-monto"
          />
          <input
            className={`${inputTexto} flex-1 min-w-0`}
            placeholder={
              tipo === 'chape'
                ? cuentaChape === 'empresa'
                  ? '¿qué pagó el cliente? (opcional)'
                  : origenChape === 'indriver'
                    ? '¿de qué carrera? (opcional)'
                    : '¿qué te pagó la empresa? (opcional)'
                : tipo === 'gasto'
                  ? '¿en qué? (opcional — gasolina, comida…)'
                  : 'nota (opcional)'
            }
            value={notaInput}
            onChange={(e) => setNotaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void anotar();
            }}
            data-testid="yape-form-nota"
          />
          <button
            onClick={() => void anotar()}
            disabled={guardando || montoInput.trim() === ''}
            className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-black transition-all active:scale-[0.98] disabled:opacity-30 flex-shrink-0"
            data-testid="yape-boton-anotar"
          >
            Anotar
          </button>
        </div>
      </div>

      {/* ── movimientos de hoy ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">💜 Movimientos de hoy</p>
        {vacio ? (
          <p className="text-[10px] text-slate-600 leading-relaxed">
            Sin movimientos aún. Empezá con <b>✏️ fijar saldo</b> (lo que tenés ahora en la app de Yape) y después anotá cada yape, gasto o depósito — el balance se arma solo.
          </p>
        ) : movsHoy.length === 0 ? (
          <p className="text-[10px] text-slate-600">Nada anotado hoy — abajo están los días anteriores.</p>
        ) : (
          <div className="space-y-1 max-h-44 overflow-y-auto custom-scrollbar pr-0.5">
            {movsHoy.map((m) => filaMov(m, true))}
          </div>
        )}
      </div>

      {/* ── días anteriores ── */}
      {movsAnteriores.length > 0 && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">📅 Días anteriores</p>
          <div className="space-y-1 max-h-44 overflow-y-auto custom-scrollbar pr-0.5">
            {movsAnteriores.map((m) => filaMov(m, false))}
          </div>
        </div>
      )}

      <p className="text-[9px] text-slate-600 leading-tight px-0.5">
        Los movimientos viven en tu cuenta (usuarios/…/yape) y se sincronizan en vivo entre tus celulares. Los días muy viejos se compactan en un «saldo base» — el saldo nunca se rompe.
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 🔘 BOTÓN DE MENÚ (F3.40) — fila IGUAL a las demás opciones del
// ☰ (icono + "Mi Yape" + badge con tu saldo). Toca → gestor.
// ═══════════════════════════════════════════════════════════

interface YapeMenuBotonProps {
  uid?: string | null;
  /** Sidebar colapsado → solo el icono */
  colapsado?: boolean;
  onAbrir?: () => void;
}

export const YapeMenuBoton: React.FC<YapeMenuBotonProps> = ({ uid, colapsado, onAbrir }) => {
  const yape = useYape();
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!uid) {
      setCargando(false);
      return;
    }
    let vivo = true;
    arrancarYape(uid);
    recargarYape(uid).finally(() => {
      if (vivo) setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [uid]);

  const saldos = useMemo(() => saldosYape(yape.movs), [yape]);

  const badge = cargando
    ? { texto: '…', clase: 'bg-slate-800 text-slate-400 border-slate-700' }
    : { texto: formatearSoles(saldos.personal), clase: 'bg-violet-500/20 text-violet-400 border-violet-500/30' };

  return (
    <button
      onClick={onAbrir}
      title={
        colapsado
          ? 'Mi Yape'
          : `Tu Yape 💜 ${formatearSoles(saldos.personal)} · empresa 🔷 ${formatearSoles(saldos.empresa)} — toca para anotar yapes, gastos y depósitos`
      }
      className="group relative flex items-center w-full px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 active:scale-[0.98]"
      data-testid="yape-menu-boton"
    >
      <Smartphone className="w-5 h-5 flex-shrink-0 text-violet-400 transition-transform duration-200 group-hover:scale-105" />
      {!colapsado && <span className="ml-3 truncate font-medium">Mi Yape</span>}
      {!colapsado && (
        <span className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full border tabular-nums ${badge.clase}`}>
          {badge.texto}
        </span>
      )}
      {colapsado && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
          Mi Yape
        </div>
      )}
    </button>
  );
};
