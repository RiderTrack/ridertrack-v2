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

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
  ConfigPagoPedidos,
  ResumenPagoPedidos,
  calcularPagoPedidos,
  cargarConfigPagoPedidos,
} from '../utils/pagoPedidosCore'; // 🛵 FASE D/Q
import {
  CATEGORIAS_GASTO,
  Gasto,
  MAX_PLANTILLAS_CUADRE,
  PagoRutaCierre,
  PlantillaCuadre,
  PLANTILLA_CUADRE_DEFECTO,
  ResumenCaja,
  VARIABLES_CUADRE,
  armarMensajeCierre,
  aplicarPlantillaCuadre,
  calcularCuadreEntrega,
  categoriaInfo,
  etiquetaDiferencia,
  fechaCorta,
  formatearSoles,
  horaCorta,
  normalizarCelJefe,
  normalizarPlantillasCuadre,
  nuevoPlantillaId,
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
            // 🛵 FASE Q: la marca lejos del cliente viaja al
            // historial (FASE D) — sin esto los pedidos cerrados
            // contarían siempre como S/9 en la paga de la caja
            ...(typeof c.lejos === 'boolean' ? { lejos: c.lejos } : {}),
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
  /** 🛵 FASE Q: tu paga por pedidos de HOY (S/9 normal / S/12
   *  lejano, temporada FASE D). Con la temporada APAGADA da 0 →
   *  la caja se ve y cuadra exactamente igual que siempre. */
  pagoRuta: ResumenPagoPedidos;
  /** 🛵 FASE Q: la config de la temporada (para el snapshot del cierre) */
  cfgPago: ConfigPagoPedidos;
} {
  const caja = useCaja();
  const { clientes, cargando } = useClientesDeHoy(uid);
  const cfgPago = useCfgPago();

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

  // 🛵 FASE Q: tu paga del día (misma cuenta que el header/Resumen)
  const pagoRuta = useMemo(() => calcularPagoPedidos(clientes, cfgPago), [clientes, cfgPago]);

  return { caja, gastosHoy, resumen, cierreHoy, cargando, clientes, pagoRuta, cfgPago };
}

/** 🛵 FASE Q: config del cobro por pedido (temporada FASE D) en
 * vivo — mismo patrón que App/RutaView: si la cambiás en
 * Configuración, la caja se refresca sola. */
function useCfgPago(): ConfigPagoPedidos {
  const [cfg, setCfg] = useState<ConfigPagoPedidos>(() => cargarConfigPagoPedidos());
  useEffect(() => {
    const refrescar = () => setCfg(cargarConfigPagoPedidos());
    window.addEventListener('pago-pedidos:changed', refrescar);
    return () => window.removeEventListener('pago-pedidos:changed', refrescar);
  }, []);
  return cfg;
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

// ── FASE O: WhatsApp del jefe (directo, sin robot) ─────────
const JEFE_KEY = 'rt_whatsapp_jefe';
function leerJefe(): string {
  try { return localStorage.getItem(JEFE_KEY) || ''; } catch { return ''; }
}

// ── FASE P: plantillas del mensaje al jefe (localStorage) ──
const PLANTILLAS_KEY = 'rt_plantillas_cuadre_v1';
const PLANTILLA_ACTIVA_KEY = 'rt_plantilla_cuadre_activa';

function leerPlantillas(): PlantillaCuadre[] {
  try {
    return normalizarPlantillasCuadre(JSON.parse(localStorage.getItem(PLANTILLAS_KEY) || '[]'));
  } catch { return []; }
}

function leerPlantillaActiva(): string {
  try { return localStorage.getItem(PLANTILLA_ACTIVA_KEY) || 'auto'; } catch { return 'auto'; }
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
  const { caja, gastosHoy, resumen, cierreHoy, cargando, pagoRuta, cfgPago } = useResumenCaja(uid);
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

  // ── FASE O: cuadre de entrega + WhatsApp del jefe ──
  const cuadreHoy = cierreHoy ? calcularCuadreEntrega(cierreHoy) : null;
  const [jefe, setJefe] = useState(leerJefe);
  const [jefeEdit, setJefeEdit] = useState(() => !leerJefe());

  // ── FASE P: plantillas + editor del mensaje al jefe ──
  const [plantillas, setPlantillas] = useState<PlantillaCuadre[]>(leerPlantillas);
  const [plantillaId, setPlantillaId] = useState<string>(leerPlantillaActiva);
  const [editandoMsg, setEditandoMsg] = useState(false);
  const [textoEdit, setTextoEdit] = useState('');
  const [pidiendoNombre, setPidiendoNombre] = useState(false);
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const plantillaActiva = plantillaId !== 'auto' ? plantillas.find((p) => p.id === plantillaId) : undefined;
  const textoActivo = plantillaActiva?.texto ?? PLANTILLA_CUADRE_DEFECTO;
  const mensajeJefe = cierreHoy ? aplicarPlantillaCuadre(textoActivo, cierreHoy, riderName) : '';
  const previewEditando = cierreHoy ? aplicarPlantillaCuadre(textoEdit, cierreHoy, riderName) : '';

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
      // 🛵 FASE Q: congela tu paga del día DENTRO del cierre (con
      // las tarifas con las que cerraste) para que el cuadre al
      // jefe siempre descuadre lo del día — aunque después cambies
      // la config o la ruta. Temporada OFF → sin snapshot → el
      // cuadre queda como en la FASE O/P (sin descuento).
      const pagoRutaSnap: PagoRutaCierre | undefined = cfgPago.activo
        ? {
            activo: true,
            cantidadNormal: pagoRuta.cantidadNormal,
            cantidadLejos: pagoRuta.cantidadLejos,
            tarifaNormal: cfgPago.tarifaNormal,
            tarifaLejos: cfgPago.tarifaLejos,
            total: pagoRuta.total,
          }
        : undefined;
      const cierre = await cerrarCaja(uid, { contado, resumen, nota: notaCierre, pagoRuta: pagoRutaSnap });
      const et = etiquetaDiferencia(cierre.diferencia);
      setContadoInput('');
      setNotaCierre('');
      onShowToast?.(
        Math.abs(cierre.diferencia) <= 0.01 ? '🔒 Caja cerrada' : cierre.diferencia > 0 ? '🔒 Caja cerrada — sobró plata' : '🔒 Caja cerrada — faltó plata',
        `Contado ${formatearSoles(cierre.contado)} · ${et.texto}` +
          (cierre.pagoRuta?.total ? ` · 🛵 tu paga ${formatearSoles(cierre.pagoRuta.total)} se queda contigo` : ''),
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

  // ── FASE O: guardar número / mandar cuadre al jefe ──
  const guardarJefe = () => {
    const tel = normalizarCelJefe(jefe);
    if (!tel) {
      onShowToast?.('Número inválido', 'Escribe el WhatsApp del jefe (ej: 987654321)', 'warning');
      return;
    }
    try { localStorage.setItem(JEFE_KEY, tel); } catch { /* sin storage: sigue en memoria */ }
    setJefe(tel);
    setJefeEdit(false);
    onShowToast?.('✓ Jefe guardado', `El cuadre irá a +${tel}`, 'success');
  };

  const mandarAlJefe = (texto?: string) => {
    if (!cierreHoy) return;
    const tel = normalizarCelJefe(jefe);
    if (!tel) {
      setJefeEdit(true);
      onShowToast?.('Falta el número', 'Escribe el WhatsApp de tu jefe (ej: 987654321)', 'warning');
      return;
    }
    // FASE P: usa la plantilla activa (o el texto del editor si viene)
    const textoFinal = aplicarPlantillaCuadre(texto ?? textoActivo, cierreHoy, riderName);
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(textoFinal)}`, '_blank');
    setEditandoMsg(false);
    onShowToast?.('📲 Cuadre listo', 'Se abrió tu WhatsApp con el mensaje — dale enviar', 'success');
  };

  // ── FASE P: plantillas del mensaje ──
  const elegirPlantilla = (id: string) => {
    setPlantillaId(id);
    setEditandoMsg(false);
    try { localStorage.setItem(PLANTILLA_ACTIVA_KEY, id); } catch { /* sin storage: en memoria */ }
  };

  const abrirEditorMsg = () => {
    setTextoEdit(textoActivo);
    setNombrePlantilla(plantillaActiva?.nombre ?? '');
    setPidiendoNombre(false);
    setEditandoMsg(true);
  };

  /** pega {variable} donde está el cursor del editor */
  const insertarVariable = (clave: string) => {
    const token = `{${clave}}`;
    const ta = textareaRef.current;
    if (!ta) {
      setTextoEdit((t) => t + token);
      return;
    }
    const ini = ta.selectionStart ?? textoEdit.length;
    const fin = ta.selectionEnd ?? textoEdit.length;
    setTextoEdit(textoEdit.slice(0, ini) + token + textoEdit.slice(fin));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(ini + token.length, ini + token.length);
    });
  };

  const confirmarGuardarPlantilla = () => {
    const nombre = nombrePlantilla.trim();
    if (!nombre) {
      onShowToast?.('Ponle un nombre', 'Ej: "Corto" o "Con gastos"', 'warning');
      return;
    }
    // mismo nombre (no distingue mayúsculas) → actualiza; si no → crea
    const idx = plantillas.findIndex((p) => p.nombre.toLowerCase() === nombre.toLowerCase());
    let nuevas: PlantillaCuadre[];
    let idActiva: string;
    if (idx >= 0) {
      nuevas = [...plantillas];
      nuevas[idx] = { ...nuevas[idx], nombre, texto: textoEdit, at: Date.now() };
      idActiva = nuevas[idx].id;
    } else {
      if (plantillas.length >= MAX_PLANTILLAS_CUADRE) {
        onShowToast?.('Llegaste al límite', `Máximo ${MAX_PLANTILLAS_CUADRE} plantillas — borra una primero`, 'warning');
        return;
      }
      const nueva: PlantillaCuadre = { id: nuevoPlantillaId(), nombre, texto: textoEdit, at: Date.now() };
      nuevas = [...plantillas, nueva];
      idActiva = nueva.id;
    }
    setPlantillas(nuevas);
    setPlantillaId(idActiva);
    try {
      localStorage.setItem(PLANTILLAS_KEY, JSON.stringify(nuevas));
      localStorage.setItem(PLANTILLA_ACTIVA_KEY, idActiva);
    } catch { /* sin storage: en memoria */ }
    setPidiendoNombre(false);
    setEditandoMsg(false);
    onShowToast?.('💾 Plantilla guardada', `"${nombre}" queda lista para los próximos días`, 'success');
  };

  const borrarPlantillaActiva = () => {
    if (!plantillaActiva) return;
    if (!confirm(`¿Borrar la plantilla "${plantillaActiva.nombre}"?`)) return;
    const nuevas = plantillas.filter((p) => p.id !== plantillaActiva.id);
    setPlantillas(nuevas);
    setPlantillaId('auto');
    try {
      localStorage.setItem(PLANTILLAS_KEY, JSON.stringify(nuevas));
      localStorage.setItem(PLANTILLA_ACTIVA_KEY, 'auto');
    } catch { /* sin storage: en memoria */ }
    setEditandoMsg(false);
    onShowToast?.('🗑 Plantilla borrada', 'Vuelve el mensaje automático de la app', 'info');
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
        {/* 🛵 FASE Q: tu paga por pedidos — solo con la temporada FASE D
            activa y entregas hechas; con S/0 la caja se ve igual que siempre */}
        {pagoRuta.total > 0 &&
          fila('🛵', `Tu paga (${pagoRuta.entregados} pedidos)`, formatearSoles(pagoRuta.total), 'text-amber-300')}
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
          {/* FASE P: aclaración — la diferencia compara SOLO el efectivo anotado */}
          {Math.abs(cierreHoy!.diferencia) > 0.01 && (
            <p className="text-[9px] text-slate-600 leading-tight">
              ⚖️ compara solo lo anotado como EFECTIVO — lo del Yape nunca pasó por tu bolsillo. Para tu jefe va lo que CONTASTE (abajo 👇).
            </p>
          )}
          {fila('🏷️', 'Neto del día (− gastos)', formatearSoles(cierreHoy!.netoDelDia), 'text-emerald-300')}
          {cierreHoy!.nota && <p className="text-[10px] text-slate-500 mt-1 italic">📝 {cierreHoy!.nota}</p>}
          {cuadreHoy && (
            <div className="mt-2.5 rounded-xl border border-violet-500/40 bg-violet-500/10 p-2.5">
              <p className="text-[10px] uppercase tracking-wider font-bold text-violet-300 mb-1">📲 Cuadre para tu jefe</p>
              {/* 🛵 FASE Q/S: tu paga se descuenta ANTES de entregar —
                  FASE S: del YAPE primero, el efectivo va completo */}
              {cuadreHoy.loTuyo > 0 &&
                fila('🛵', `Te quedás de tu ruta (${(cierreHoy!.pagoRuta?.cantidadNormal || 0) + (cierreHoy!.pagoRuta?.cantidadLejos || 0) || cierreHoy!.entregas} pedidos)`, formatearSoles(cuadreHoy.loTuyo), 'text-amber-300')}
              {fila('🤲', 'Le entregás en efectivo', formatearSoles(cuadreHoy.efectivo), 'text-emerald-300')}
              {fila('📲', cuadreHoy.loTuyo > 0 ? 'Depositás por Yape (tu paga ya restada)' : 'Depositás por Yape', formatearSoles(cuadreHoy.yape), 'text-violet-300')}
              {cuadreHoy.teDebe > 0 &&
                fila('⚠️', 'La empresa te queda debiendo', formatearSoles(cuadreHoy.teDebe), 'text-red-300')}
              {fila('🧾', 'Recibe en total', formatearSoles(cuadreHoy.total), 'text-white')}
              <p className="text-[9px] text-slate-600 leading-tight mt-1.5">
                {cuadreHoy.teDebe > 0
                  ? `Tu paga (${formatearSoles(cuadreHoy.loTuyo)}) es más que lo que pasó por tus manos — te quedás TODO el efectivo contado (${formatearSoles(cierreHoy!.contado)}) y la empresa te completa.`
                  : cuadreHoy.loTuyo > 0
                    ? cuadreHoy.pagaDelEfectivo <= 0
                      ? `El efectivo que contaste (${formatearSoles(cierreHoy!.contado)}${cierreHoy!.fondoInicial > 0 ? ` − tu fondo ${formatearSoles(cierreHoy!.fondoInicial)}` : ''}) va COMPLETO al jefe — tu paga de ruta (${formatearSoles(cuadreHoy.loTuyo)}) te la descuentás del Yape antes de depositar.`
                      : `Tu paga de ruta (${formatearSoles(cuadreHoy.loTuyo)}) salió del Yape (${formatearSoles(cuadreHoy.pagaDelYape)}) y de los billetes (${formatearSoles(cuadreHoy.pagaDelEfectivo)}) — eso es tuyo. El resto va al jefe.`
                    : `De lo que contaste (${formatearSoles(cierreHoy!.contado)}) se resta tu fondo (${formatearSoles(cierreHoy!.fondoInicial)}) — eso es tuyo. El resto sale por Yape.`}
              </p>
            </div>
          )}
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
          {/* ── FASE O/P: WhatsApp directo al jefe + plantillas ── */}
          <div className="mt-2.5 rounded-xl border border-violet-500/40 bg-slate-950/60 p-2.5">
            {jefe && !jefeEdit ? (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] text-slate-400 flex-1 truncate">👤 Tu jefe: +{jefe}</span>
                  <button
                    onClick={() => setJefeEdit(true)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white text-[10px] font-bold transition-colors"
                    title="Cambiar el número"
                  >
                    ✏️ editar
                  </button>
                </div>

                {/* FASE P: preview — así le llega al jefe */}
                <div className="rounded-xl bg-slate-900/80 border border-slate-700/60 p-2.5 mb-2">
                  <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1">💬 Así le llega a tu jefe</p>
                  <div className="max-h-40 overflow-y-auto custom-scrollbar">
                    <pre className="text-[11px] text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{mensajeJefe}</pre>
                  </div>
                </div>

                {/* FASE P: chips de plantillas */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button
                    onClick={() => elegirPlantilla('auto')}
                    className={btnChip(!plantillaActiva)}
                    title="El mensaje que arma la app con los números de hoy"
                  >
                    🤖 Automática
                  </button>
                  {plantillas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => elegirPlantilla(p.id)}
                      className={btnChip(plantillaId === p.id)}
                      title="Tu plantilla guardada"
                    >
                      📝 {p.nombre}
                    </button>
                  ))}
                </div>

                {!editandoMsg ? (
                  <>
                    <button
                      onClick={() => mandarAlJefe()}
                      className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      📲 Mandar el cuadre al jefe
                    </button>
                    <button
                      onClick={abrirEditorMsg}
                      className="w-full mt-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      ✏️ Ver / editar el mensaje
                    </button>
                    <p className="text-[9px] text-slate-600 leading-tight mt-1.5">
                      Se abre tu WhatsApp con el mensaje listo. Se arma con lo que CONTASTE — sin líos de "sobran/faltan". Va directo, el robot no participa.
                    </p>
                  </>
                ) : (
                  <>
                    {/* FASE P: editor del mensaje */}
                    <textarea
                      ref={textareaRef}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 leading-relaxed custom-scrollbar"
                      rows={8}
                      value={textoEdit}
                      onChange={(e) => setTextoEdit(e.target.value)}
                      placeholder="Escribe tu mensaje para el jefe…"
                    />
                    <p className="text-[9px] text-slate-600 leading-tight mt-1 mb-1.5">
                      Tocá una variable y se pega donde está el cursor — se llena sola con los números de HOY:
                    </p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {VARIABLES_CUADRE.map((v) => (
                        <button
                          key={v.clave}
                          onClick={() => insertarVariable(v.clave)}
                          className="px-2 py-1 rounded-lg bg-violet-500/15 border border-violet-500/40 text-violet-300 text-[10px] font-bold hover:bg-violet-500/30 transition-colors active:scale-95"
                          title={v.ej}
                        >
                          {'{'}{v.clave}{'}'}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-xl bg-slate-900/80 border border-slate-700/60 p-2.5 mb-2">
                      <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1">👀 Así queda con los números de hoy</p>
                      <div className="max-h-36 overflow-y-auto custom-scrollbar">
                        <pre className="text-[11px] text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{previewEditando}</pre>
                      </div>
                    </div>

                    {pidiendoNombre ? (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <input
                          className={`${inputTexto} flex-1 min-w-0 py-2`}
                          placeholder="nombre (ej: Corto)"
                          value={nombrePlantilla}
                          onChange={(e) => setNombrePlantilla(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmarGuardarPlantilla();
                          }}
                          autoFocus
                        />
                        <button
                          onClick={confirmarGuardarPlantilla}
                          className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all active:scale-[0.98] flex-shrink-0"
                        >
                          ✓ guardar
                        </button>
                        <button
                          onClick={() => setPidiendoNombre(false)}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 text-sm font-bold transition-colors flex-shrink-0"
                        >
                          ✖
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          onClick={() => mandarAlJefe(textoEdit)}
                          className="flex-1 min-w-32 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all active:scale-[0.98]"
                        >
                          📲 Enviar así
                        </button>
                        <button
                          onClick={() => {
                            setNombrePlantilla(plantillaActiva?.nombre ?? '');
                            setPidiendoNombre(true);
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold transition-colors"
                          title="Guardar este texto para reusarlo los próximos días"
                        >
                          💾 Guardar plantilla
                        </button>
                        {plantillaActiva && (
                          <button
                            onClick={borrarPlantillaActiva}
                            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-red-900/50 border border-slate-600 text-slate-400 hover:text-red-300 text-xs font-bold transition-colors"
                            title={`Borrar la plantilla "${plantillaActiva.nombre}"`}
                          >
                            🗑
                          </button>
                        )}
                        <button
                          onClick={() => setEditandoMsg(false)}
                          className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 text-xs font-bold transition-colors"
                        >
                          ✖
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  className={`${inputTexto} flex-1 min-w-0 py-2`}
                  placeholder="WhatsApp del jefe (ej: 987654321)"
                  inputMode="tel"
                  value={jefe}
                  onChange={(e) => setJefe(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') guardarJefe();
                  }}
                />
                <button
                  onClick={guardarJefe}
                  className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all active:scale-[0.98] flex-shrink-0"
                >
                  ✓ guardar
                </button>
              </div>
            )}
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
          {(() => {
            // FASE O/Q: preview del cuadre mientras escribís el conteo
            const contado = parsearSoles(contadoInput);
            if (contadoInput.trim() === '' || isNaN(contado)) return null;
            const q = calcularCuadreEntrega({ contado, fondoInicial: caja.fondo, netoDelDia: resumen.netoDelDia, pagoRuta: pagoRuta.total });
            return (
              <p className="text-[10px] text-slate-400 leading-relaxed mt-1.5">
                → cuadre:{' '}
                <b className="text-emerald-300">S/ {q.efectivo.toFixed(2)} en efectivo</b> +{' '}
                <b className="text-violet-300">S/ {q.yape.toFixed(2)} por Yape</b> para tu jefe
                {q.loTuyo > 0 ? (
                  <>
                    {' '}(tu paga{' '}
                    <b className="text-amber-300">S/ {q.loTuyo.toFixed(2)}</b>
                    {q.pagaDelEfectivo <= 0
                      ? ' te la descuentás del Yape — el efectivo va completo'
                      : q.pagaDelYape <= 0
                        ? ' sale de los billetes (no hubo Yape hoy)'
                        : `: S/ ${q.pagaDelYape.toFixed(2)} del Yape + S/ ${q.pagaDelEfectivo.toFixed(2)} de los billetes`}
                    ; tu fondo se queda afuera)
                  </>
                ) : (
                  ' (tu fondo se queda afuera)'
                )}
              </p>
            );
          })()}
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
