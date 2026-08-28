// ═══════════════════════════════════════════════════════════
// 📖 HISTORIAL VIEW — RiderTrack V2 (Fase 2.5 → 2.6)
// Historial de rutas cerradas, guiado del Rider Modular v1:
//   · 📅 CALENDARIO mensual (como la v1): los días con ruta
//     quedan marcados; tocas la fecha y aparecen SOLO las rutas
//     de ese día — sin acumular tarjetas (para no ocupar espacio).
//   · Detalle expandible estilo v1: caja 💚 LO TUYO (efectivo,
//     yape, mixto… → TOTAL TUYO) y caja 🏢 EMPRESA (POS,
//     transferencia… → TOTAL EMPRESA).
//   · 📥 Excel (.xlsx real con las secciones de la v1),
//     📊 Reporte (texto corporativo copiable / WhatsApp),
//     📅 Cambiar fecha (si cerraste después de medianoche),
//     📋 Copiar listado para verificar con la empresa.
//   · 📥 IMPORTAR HISTORIAL V1: la v1 guardaba todo su historial
//     en la nube (usuarios/{uid}.hist + backups) — acá se lee la
//     fuente más completa y se convierte al formato V2 una sola
//     vez (docs v1_{id}, sin repetir).
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  History,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Copy,
  Check,
  CalendarDays,
  Download,
  BarChart3,
  CalendarClock,
  CloudDownload,
  Loader2,
  X,
  MessageCircle,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useConfig } from '../hooks/useConfig';
import {
  RegistroHistorial,
  leerHistorial,
  eliminarRutaHistorial,
  cambiarFechaHistorial,
  importarHistorialV1,
} from '../services/firestore';
import { ETIQUETAS_ESTADO } from '../utils/realData';
import { exportarExcelRuta } from '../utils/exportarExcel';

type PeriodoFiltro = 'hoy' | '7d' | '30d' | 'todo';

interface HistorialViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const ST_ENTREGADOS = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'];
const ST_FALLIDOS = ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'];

/** Métodos que pagan el rider (caja 💚 LO TUYO) — orden de la v1 */
const METODOS_RIDER = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'cambio'];
/** Métodos que paga la empresa (caja 🏢 EMPRESA) — orden de la v1 */
const METODOS_EMPRESA = ['pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa'];

/** Ícono por método (como el detalle de la v1) */
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
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEM = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // domingo primero (como la v1)

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

function fmtS(n: number): string {
  return `S/ ${Number(n || 0).toFixed(2)}`;
}

/** Cajas de métodos con monto > 0 (para el detalle y el reporte) */
function metodosCaja(r: RegistroHistorial, caja: 'rider' | 'empresa') {
  const lista = caja === 'rider' ? METODOS_RIDER : METODOS_EMPRESA;
  const pm = r.porMetodo || {};
  const filas: { st: string; monto: number }[] = [];
  let suma = 0;
  for (const st of lista) {
    const v = Number(pm[st] || 0);
    if (v > 0) {
      filas.push({ st, monto: v });
      suma += v;
    }
  }
  return { filas, suma };
}

function totalTuyoR(r: RegistroHistorial): number {
  if (typeof r.totalRider === 'number') return r.totalRider;
  return metodosCaja(r, 'rider').suma;
}

function totalEmpresaR(r: RegistroHistorial): number {
  if (typeof r.totalEmpresa === 'number') return r.totalEmpresa;
  return metodosCaja(r, 'empresa').suma;
}

export const HistorialView: React.FC<HistorialViewProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const { config } = useConfig();

  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('todo');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  // ── Calendario (como la v1) ──
  const hoy = new Date();
  const [calMes, setCalMes] = useState(hoy.getMonth());
  const [calAno, setCalAno] = useState(hoy.getFullYear());
  const [fechaSel, setFechaSel] = useState<string | null>(null);

  // ── Importar v1 ──
  const [importando, setImportando] = useState(false);

  // ── Reporte modal ──
  const [reporte, setReporte] = useState<{ ruta: RegistroHistorial; texto: string } | null>(null);
  const [copiadoRep, setCopiadoRep] = useState(false);

  // ── Ver todas (cuando no hay fecha seleccionada) ──
  const [verTodas, setVerTodas] = useState(false);

  // ── Modal de cambiar fecha (Fase 2.7: calendario nativo
  //    en vez del cuadro de texto) ──
  const [fechaModal, setFechaModal] = useState<{ ruta: RegistroHistorial; valor: string } | null>(null);

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

  // Filtrar por periodo (afecta los totales de arriba)
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
    const tuyo = registrosFiltrados.reduce((s, r) => s + totalTuyoR(r), 0);
    const empresa = registrosFiltrados.reduce((s, r) => s + totalEmpresaR(r), 0);
    return { rutas: registrosFiltrados.length, soles, tuyo, empresa };
  }, [registrosFiltrados]);

  // Mapa de fechas con ruta (para marcar el calendario)
  const fechasConRuta = useMemo(() => {
    const m = new Map<string, number>();
    registros.forEach((r) => {
      if (!r.fecha) return;
      m.set(r.fecha, (m.get(r.fecha) || 0) + 1);
    });
    return m;
  }, [registros]);

  // Rutas visibles: las del día elegido, o las últimas
  const rutasVisibles = useMemo(() => {
    if (fechaSel) return registrosFiltrados.filter((r) => r.fecha === fechaSel);
    return verTodas ? registrosFiltrados : registrosFiltrados.slice(0, 10);
  }, [fechaSel, registrosFiltrados, verTodas]);

  // ── Calendario: celdas del mes ──
  const celdasCal = useMemo(() => {
    const primerDia = new Date(calAno, calMes, 1).getDay(); // 0=domingo (como la v1)
    const diasMes = new Date(calAno, calMes + 1, 0).getDate();
    const celdas: ({ fid: string; dia: number } | null)[] = [];
    for (let i = 0; i < primerDia; i++) celdas.push(null);
    for (let d = 1; d <= diasMes; d++) {
      const fid = `${calAno}-${String(calMes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      celdas.push({ fid, dia: d });
    }
    return celdas;
  }, [calMes, calAno]);

  const calCambiar = (dir: number) => {
    let m = calMes + dir;
    let a = calAno;
    if (m > 11) { m = 0; a++; }
    if (m < 0) { m = 11; a--; }
    setCalMes(m);
    setCalAno(a);
  };

  const hoyFid = useMemo(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  }, []);

  // ── Copiar listado de una ruta (para verificar con la empresa) ──
  const copiarTexto = async (texto: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Fallback móvil: textarea temporal
      try {
        const ta = document.createElement('textarea');
        ta.value = texto;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  };

  const copiarListado = async (r: RegistroHistorial) => {
    const lineas: string[] = [
      `📋 RUTA ${fechaCorta(r.fecha)} — RiderTrack`,
      `Total: ${fmtS(r.cobradoTotal)} · ${r.entregados}/${r.totalClientes} entregados${r.fallidos ? ` · ${r.fallidos} fallidos` : ''}`,
      '',
    ];
    (r.clientes || []).forEach((c: any) => {
      const st = ETIQUETAS_ESTADO[c.st] || c.st || 'Pendiente';
      const monto = parseFloat(String(c.cobrar || 0)).toFixed(2);
      const hora = c.hora ? ` (${c.hora})` : '';
      lineas.push(`${c.nombre || 'Cliente'} — S/ ${monto} — ${st}${hora}`);
    });
    const ok = await copiarTexto(lineas.join('\n'));
    if (ok) {
      setCopiado(r.id);
      setTimeout(() => setCopiado(null), 2000);
      onShowToast?.('📋 Listado copiado', `${(r.clientes || []).length} clientes listos para pegar`, 'success');
    } else {
      onShowToast?.('No se pudo copiar', 'Inténtalo de nuevo', 'error');
    }
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

  // ── Cambiar fecha de una ruta (Fase 2.7: abre un CALENDARIO,
  //    ya no el cuadro de texto — el input date abre el picker
  //    nativo del celular: rápido y sin errores de tipeo) ──
  const cambiarFecha = (r: RegistroHistorial) => {
    setFechaModal({ ruta: r, valor: r.fecha || '' });
  };

  const guardarFechaModal = async () => {
    if (!fechaModal) return;
    const limpia = (fechaModal.valor || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(limpia)) {
      onShowToast?.('Elige una fecha', 'Toca el calendario y escoge el día de la ruta', 'warning');
      return;
    }
    try {
      await cambiarFechaHistorial(fechaModal.ruta.id, limpia);
      onShowToast?.('📅 Fecha actualizada', `La ruta ahora pertenece al ${limpia}`, 'success');
      setFechaModal(null);
      setFechaSel(null);
      await cargar();
    } catch (e: any) {
      onShowToast?.('Error', e?.message || 'No se pudo cambiar la fecha', 'error');
    }
  };

  // ── Importar historial de la v1 ──
  const importarV1 = async () => {
    if (!user || importando) return;
    if (!confirm(
      '📥 Importar el historial de la versión 1?\n\n' +
      'Se buscan tus rutas guardadas en la nube por la v1 (desde mayo) y se agregan a este historial.\n\n' +
      '· Las rutas que ya importaste NO se repiten\n' +
      '· Puedes volver a correrlo cuando quieras'
    )) return;
    setImportando(true);
    try {
      const res = await importarHistorialV1(user.uid);
      if (res.totalV1 === 0) {
        onShowToast?.('Sin historial v1', 'No se encontraron rutas de la versión 1 en la nube', 'info');
      } else if (res.importadas === 0) {
        onShowToast?.('Ya está al día', `Las ${res.totalV1} rutas de la v1 ya estaban importadas`, 'info');
      } else {
        onShowToast?.(
          '📥 Historial v1 importado',
          `${res.importadas} de ${res.totalV1} rutas agregadas (${res.fuente})`,
          'success'
        );
        const lista = await leerHistorial(user.uid);
        setRegistros(lista);
        // Saltar el calendario al mes más antiguo para VER las rutas importadas
        const masVieja = lista
          .filter((x) => x.origen === 'v1' && x.fecha)
          .map((x) => x.fecha)
          .sort()[0];
        if (masVieja) {
          const [y, m] = masVieja.split('-').map(Number);
          if (y && m) {
            setCalAno(y);
            setCalMes(m - 1);
          }
        }
      }
    } catch (e: any) {
      onShowToast?.('Error al importar', e?.message || 'Revisa tu conexión', 'error');
    } finally {
      setImportando(false);
    }
  };

  // ── Reporte corporativo (como el "📊 Reporte" de la v1) ──
  const abrirReporte = (r: RegistroHistorial) => {
    const cl: any[] = r.clientes || [];
    const cuenta = (st: string) => cl.filter((c) => (c.st || '').toLowerCase() === st).length;
    const tuyo = totalTuyoR(r);
    const emp = totalEmpresaR(r);
    const L: string[] = [];

    L.push('📊 REPORTE DE ENTREGAS — ' + fechaBonita(r.fecha));
    if (config?.empresa?.nombre) L.push('Empresa: ' + config.empresa.nombre);
    L.push('──────────────────────────');
    L.push(`📦 Total clientes: ${r.totalClientes}`);
    L.push(`✅ Entregados: ${r.entregados}`);
    L.push(`⏳ Sin atender: ${r.pendientes}`);
    L.push(`❌ Fallidos: ${r.fallidos}`);
    if (r.fallidos > 0) {
      const reprog = cuenta('reprogramar');
      const nc = cuenta('no-contesta') + cuenta('no-contasta');
      const au = cuenta('ausente');
      const re = cuenta('rechazado');
      const ca = cuenta('cancelado');
      const sub: string[] = [];
      if (reprog) sub.push(`🔄 Reprogramados: ${reprog}`);
      if (nc) sub.push(`📞 No contesta: ${nc}`);
      if (au) sub.push(`🚶 Ausente: ${au}`);
      if (re) sub.push(`❌ Rechazo: ${re}`);
      if (ca) sub.push(`✖ Cancelado: ${ca}`);
      if (sub.length) L.push('   ' + sub.join(' · '));
    }
    L.push('──────────────────────────');
    L.push(`💚 LO TUYO: ${fmtS(tuyo)}`);
    metodosCaja(r, 'rider').filas.forEach((f) => {
      L.push(`   ${ICONO_METODO[f.st] || '•'} ${ETIQUETAS_ESTADO[f.st] || f.st}: ${fmtS(f.monto)}`);
    });
    L.push(`🏢 EMPRESA: ${fmtS(emp)}`);
    metodosCaja(r, 'empresa').filas.forEach((f) => {
      L.push(`   ${ICONO_METODO[f.st] || '•'} ${ETIQUETAS_ESTADO[f.st] || f.st}: ${fmtS(f.monto)}`);
    });
    L.push('──────────────────────────');
    L.push(`💰 TOTAL COBRADO: ${fmtS(tuyo + emp)}`);
    if (r.km) L.push(`🛣️ km recorridos: ${parseFloat(String(r.km)).toFixed(1)}`);
    L.push('Generado por RiderTrack ✅');

    setReporte({ ruta: r, texto: L.join('\n') });
  };

  const copiarReporte = async () => {
    if (!reporte) return;
    const ok = await copiarTexto(reporte.texto);
    if (ok) {
      setCopiadoRep(true);
      setTimeout(() => setCopiadoRep(false), 2000);
      onShowToast?.('📋 Reporte copiado', 'Listo para pegar donde quieras', 'success');
    }
  };

  const enviarReporteWhatsApp = () => {
    if (!reporte) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(reporte.texto)}`, '_blank');
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
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
              <p className="text-[11px] text-slate-400">Tu calendario de rutas, con su plata y sus entregas</p>
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
          <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
            <div className="text-[9px] text-emerald-300/70 uppercase">💚 Tuyo</div>
            <div className="text-sm font-black text-emerald-300">{totales.tuyo.toFixed(0)}</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
            <div className="text-[9px] text-blue-400/70 uppercase">🏢 Empresa</div>
            <div className="text-sm font-black text-blue-400">{totales.empresa.toFixed(0)}</div>
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

      {/* Importar historial v1 */}
      <div className="rounded-2xl bg-slate-800 border border-violet-500/30 p-4">
        <div className="flex items-center gap-2">
          <CloudDownload className="w-4 h-4 text-violet-300 shrink-0" />
          <h2 className="text-sm font-bold text-white">Historial de la versión 1</h2>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed mt-1.5">
          ¿Trabajaste con la versión 1? Tus rutas desde mayo están guardadas en su nube
          (mismo Firebase, mismo usuario). Impórtalas una vez y quedarán para siempre en este
          calendario — sin repetirse.
        </p>
        <button
          onClick={importarV1}
          disabled={importando || loading}
          className="mt-2.5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white transition-all active:scale-95 disabled:opacity-50"
        >
          {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
          {importando ? 'Importando…' : '📥 Importar historial v1'}
        </button>
      </div>

      {/* Calendario (como la v1) */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 text-indigo-400 shrink-0" />
            <h2 className="text-sm font-bold text-white truncate">Calendario</h2>
          </div>
          {fechaSel && (
            <button
              onClick={() => setFechaSel(null)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-[10px] font-bold text-indigo-300 shrink-0"
            >
              {fechaCorta(fechaSel)} ✕
            </button>
          )}
        </div>

        {/* Navegación de mes */}
        <div className="flex items-center justify-between mb-2.5">
          <button
            onClick={() => calCambiar(-1)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-sm font-black text-white capitalize">{MESES[calMes]} {calAno}</div>
          <button
            onClick={() => calCambiar(1)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DIAS_SEM.map((d, i) => (
            <div key={i} className="text-center text-[9px] font-black text-slate-500 uppercase py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Días */}
        <div className="grid grid-cols-7 gap-1">
          {celdasCal.map((c, i) => {
            if (!c) return <div key={`v-${i}`} />;
            const tieneRuta = fechasConRuta.get(c.fid) || 0;
            const esHoy = c.fid === hoyFid;
            const sel = fechaSel === c.fid;
            return (
              <button
                key={c.fid}
                onClick={() => setFechaSel(sel ? null : c.fid)}
                className={`
                  relative h-10 rounded-lg text-xs font-bold transition-all active:scale-95
                  ${sel
                    ? 'bg-white text-slate-900 ring-2 ring-indigo-400'
                    : tieneRuta > 0
                    ? 'bg-indigo-600/90 text-white hover:bg-indigo-500'
                    : esHoy
                    ? 'bg-slate-900 text-slate-300 ring-1 ring-amber-400/60 hover:bg-slate-700'
                    : 'text-slate-400 hover:bg-slate-700/50'}
                `}
                title={tieneRuta > 0 ? `${tieneRuta} ruta${tieneRuta !== 1 ? 's' : ''}` : ''}
              >
                {c.dia}
                {tieneRuta > 0 && !sel && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-300" />
                )}
              </button>
            );
          })}
        </div>

        <p className="text-[9px] text-slate-500 mt-2.5 text-center">
          {registros.length} ruta{registros.length !== 1 ? 's' : ''} en el historial · toca un día marcado para ver sus rutas
        </p>
      </div>

      {/* Lista de rutas */}
      {loading ? (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-8 text-center">
          <RefreshCw className="w-8 h-8 text-slate-600 mx-auto mb-3 animate-spin" />
          <p className="text-xs text-slate-400">Cargando historial…</p>
        </div>
      ) : (
        <>
          {/* Título de la sección */}
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-black text-white capitalize">
              {fechaSel ? `Rutas del ${fechaBonita(fechaSel)}` : 'Últimas rutas'}
            </h2>
            {!fechaSel && registrosFiltrados.length > 10 && (
              <button
                onClick={() => setVerTodas((v) => !v)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-bold text-indigo-300 hover:border-indigo-500/50 transition-colors"
              >
                {verTodas ? 'Ver menos' : `Ver todas (${registrosFiltrados.length})`}
              </button>
            )}
          </div>

          {rutasVisibles.length === 0 ? (
            <div className="rounded-2xl bg-slate-800 border border-slate-700 p-8 text-center">
              <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">
                {fechaSel
                  ? 'Ese día no tiene rutas guardadas'
                  : registros.length === 0
                  ? 'Sin rutas aún — finaliza una ruta en Mi Ruta y aparecerá aquí'
                  : 'No hay rutas en este periodo'}
              </p>
              {fechaSel && (
                <button
                  onClick={() => setFechaSel(null)}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors"
                >
                  Ver las últimas rutas
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {rutasVisibles.map((r) => {
                const abierto = expandido === r.id;
                const tuyo = totalTuyoR(r);
                const empresa = totalEmpresaR(r);
                const cajaRider = metodosCaja(r, 'rider');
                const cajaEmpresa = metodosCaja(r, 'empresa');
                return (
                  <div key={r.id} className={`rounded-xl bg-slate-800 border overflow-hidden ${fechaSel && abierto ? 'border-indigo-500/50' : 'border-slate-700'}`}>
                    {/* Cabecera clickeable */}
                    <button
                      onClick={() => setExpandido(abierto ? null : r.id)}
                      className="w-full p-3 text-left hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white capitalize">
                              {fechaSel ? fechaCorta(r.fecha) : fechaBonita(r.fecha)}
                            </span>
                            {horaCierre(r.finalizadaAt) && (
                              <span className="text-[10px] text-slate-500">cerrada {horaCierre(r.finalizadaAt)}</span>
                            )}
                            {r.origen === 'v1' && (
                              <span className="px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[8px] font-black uppercase">
                                v1
                              </span>
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
                            <div className="text-base font-black text-emerald-400">{fmtS(r.cobradoTotal)}</div>
                            <div className="text-[9px] text-slate-400">
                              💚 {tuyo.toFixed(0)} · 🏢 {empresa.toFixed(0)}
                            </div>
                          </div>
                          {abierto ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Stats compactos (como la v1: Entreg/Fallidos/Total/km) */}
                      <div className={`grid gap-1.5 mt-2.5 ${r.km ? 'grid-cols-4' : 'grid-cols-4'}`}>
                        <div className="py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-center">
                          <div className="text-xs font-black text-emerald-400">{r.entregados}</div>
                          <div className="text-[8px] text-emerald-400/70 uppercase">Entreg</div>
                        </div>
                        <div className="py-1 rounded-md bg-red-500/10 border border-red-500/20 text-center">
                          <div className="text-xs font-black text-red-400">{r.fallidos}</div>
                          <div className="text-[8px] text-red-400/70 uppercase">Fallidos</div>
                        </div>
                        <div className="py-1 rounded-md bg-slate-700/40 border border-slate-600 text-center">
                          <div className="text-xs font-black text-white">{r.totalClientes}</div>
                          <div className="text-[8px] text-slate-400 uppercase">Total</div>
                        </div>
                        <div className="py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-center">
                          <div className="text-xs font-black text-violet-300">
                            {r.km ? parseFloat(String(r.km)).toFixed(1) : (r.pendientes || 0)}
                          </div>
                          <div className="text-[8px] text-violet-300/70 uppercase">{r.km ? 'km' : 'Sin atender'}</div>
                        </div>
                      </div>

                      {/* Resumen tuyo/empresa (línea de la v1) */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-400">
                          Tuyo: <strong className="text-emerald-300">{fmtS(tuyo)}</strong> · Empresa:{' '}
                          <strong className="text-blue-300">{fmtS(empresa)}</strong>
                        </span>
                        <span className="text-[10px] font-bold text-indigo-300">
                          {abierto ? '▲ Ocultar detalle' : '▼ Ver detalle'}
                        </span>
                      </div>
                    </button>

                    {/* Detalle expandido (estilo v1) */}
                    {abierto && (
                      <div className="border-t border-slate-700/60 px-3 pb-3 pt-2 space-y-2">
                        {/* 💚 LO TUYO */}
                        {cajaRider.filas.length > 0 && (
                          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2.5">
                            <div className="text-[9px] text-emerald-400 uppercase font-black mb-1.5">💚 Lo tuyo</div>
                            <div className="space-y-0.5">
                              {cajaRider.filas.map((f) => (
                                <div key={f.st} className="flex justify-between text-[10px]">
                                  <span className="text-slate-400">
                                    {ICONO_METODO[f.st] || '•'} {ETIQUETAS_ESTADO[f.st] || f.st}
                                  </span>
                                  <span className="text-slate-200 font-bold">{fmtS(f.monto)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between border-t border-emerald-500/20 mt-1.5 pt-1.5">
                              <span className="text-[10px] font-black text-emerald-400 uppercase">Total tuyo</span>
                              <span className="text-sm font-black text-emerald-400">{fmtS(tuyo)}</span>
                            </div>
                          </div>
                        )}

                        {/* 🏢 EMPRESA */}
                        {cajaEmpresa.filas.length > 0 && (
                          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-2.5">
                            <div className="text-[9px] text-blue-400 uppercase font-black mb-1.5">🏢 Empresa</div>
                            <div className="space-y-0.5">
                              {cajaEmpresa.filas.map((f) => (
                                <div key={f.st} className="flex justify-between text-[10px]">
                                  <span className="text-slate-400">
                                    {ICONO_METODO[f.st] || '•'} {ETIQUETAS_ESTADO[f.st] || f.st}
                                  </span>
                                  <span className="text-slate-200 font-bold">{fmtS(f.monto)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between border-t border-blue-500/20 mt-1.5 pt-1.5">
                              <span className="text-[10px] font-black text-blue-400 uppercase">Total empresa</span>
                              <span className="text-sm font-black text-blue-400">{fmtS(empresa)}</span>
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

                        {/* Acciones (paridad con la v1: Excel · Nube→ya vive en la nube · Fecha · Reporte) */}
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => exportarExcelRuta(r, onShowToast)}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 transition-all active:scale-95"
                          >
                            <Download className="w-3.5 h-3.5" />
                            📥 Excel
                          </button>
                          <button
                            onClick={() => abrirReporte(r)}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 transition-all active:scale-95"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            📊 Reporte
                          </button>
                          <button
                            onClick={() => cambiarFecha(r)}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-400 transition-all active:scale-95"
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            📅 Fecha
                          </button>
                          <button
                            onClick={() => copiarListado(r)}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-200 transition-all active:scale-95"
                          >
                            {copiado === r.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiado === r.id ? 'Copiado' : '📋 Copiar'}
                          </button>
                          <button
                            onClick={() => eliminarRuta(r)}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-all active:scale-95 col-span-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            🗑️ Eliminar del historial
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Ayuda */}
      <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-3">
        <div className="flex items-start gap-2">
          <Wallet className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Las rutas entran al historial con <strong className="text-slate-200">🏁 FINALIZAR RUTA</strong> en Mi Ruta
            (o con <strong className="text-slate-200">📥 Importar historial v1</strong>). El <strong className="text-slate-200">📊 Reporte</strong> y el{' '}
            <strong className="text-slate-200">📋 Copiar</strong> te dan el detalle exacto para verificar con la página
            de la empresa. Todo queda guardado en la nube automáticamente — no necesitas subir nada a mano.
          </p>
        </div>
      </div>

      {/* Modal de Reporte (como el de la v1: editable + copiar + WhatsApp) */}
      {reporte && (
        <div
          className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setReporte(null); }}
        >
          <div className="w-full sm:max-w-md bg-slate-800 border border-slate-600 rounded-t-2xl sm:rounded-2xl p-4 space-y-3 max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white leading-tight">📊 Reporte de la ruta</h3>
                  <p className="text-[10px] text-slate-400 truncate capitalize">{fechaBonita(reporte.ruta.fecha)}</p>
                </div>
              </div>
              <button
                onClick={() => setReporte(null)}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vista previa estilo WhatsApp */}
            <div className="rounded-xl bg-emerald-600/15 border border-emerald-500/20 p-2.5">
              <div className="text-[9px] text-emerald-300/70 mb-1.5 font-bold uppercase">Así lo verá el destinatario</div>
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/15 p-2.5 text-[10px] text-slate-200 whitespace-pre-wrap leading-relaxed font-sans max-h-40 overflow-y-auto custom-scrollbar">
                {reporte.texto}
              </div>
            </div>

            {/* Texto editable */}
            <div>
              <div className="text-[9px] text-slate-500 uppercase font-bold mb-1.5">📝 Reporte (editable)</div>
              <textarea
                value={reporte.texto}
                onChange={(e) => setReporte((prev) => (prev ? { ...prev, texto: e.target.value } : null))}
                rows={10}
                className="w-full bg-slate-900 text-white text-[10px] rounded-lg p-3 border border-slate-700 focus:border-blue-500 outline-none resize-none font-mono leading-relaxed"
              />
            </div>

            {/* Botones */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={copiarReporte}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100 transition-all active:scale-95"
              >
                {copiadoRep ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiadoRep ? '¡Copiado!' : '📋 Copiar'}
              </button>
              <button
                onClick={enviarReporteWhatsApp}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                💬 Enviar por WhatsApp
              </button>
            </div>
            <p className="text-[9px] text-slate-500 text-center">
              En WhatsApp elige el chat (grupo de la empresa, jefe…). El texto va listo para enviar.
            </p>
          </div>
        </div>
      )}
      {/* Modal de Cambiar fecha (Fase 2.7 — calendario nativo) */}
      {fechaModal && (
        <div
          className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setFechaModal(null); }}
        >
          <div className="w-full sm:max-w-sm bg-slate-800 border border-slate-600 rounded-t-2xl sm:rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-4 h-4 text-violet-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white leading-tight">📅 Cambiar fecha de la ruta</h3>
                  <p className="text-[10px] text-slate-400 truncate capitalize">
                    Hoy está: {fechaBonita(fechaModal.ruta.fecha)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFechaModal(null)}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[10px] text-slate-400 leading-snug">
              Útil si cerraste la ruta después de medianoche: la mueves al día que realmente hiciste las entregas.
            </p>

            {/* Calendario nativo */}
            <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
              <label className="text-[9px] uppercase font-bold text-slate-500 mb-1.5 block">
                Escoge el nuevo día
              </label>
              <input
                type="date"
                value={fechaModal.valor}
                max="2100-12-31"
                onChange={(e) => setFechaModal((prev) => (prev ? { ...prev, valor: e.target.value } : null))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 [color-scheme:dark]"
              />
            </div>

            {/* Atajos */}
            <div className="flex gap-2">
              {[
                { label: 'Hoy', dias: 0 },
                { label: 'Ayer', dias: -1 },
                { label: 'Anteayer', dias: -2 },
              ].map((atajo) => {
                const d = new Date();
                d.setDate(d.getDate() + atajo.dias);
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return (
                  <button
                    key={atajo.label}
                    onClick={() => setFechaModal((prev) => (prev ? { ...prev, valor: iso } : null))}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
                      fechaModal.valor === iso
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {atajo.label}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setFechaModal(null)}
                className="flex-1 py-3 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100 transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={guardarFechaModal}
                disabled={!fechaModal.valor || fechaModal.valor === fechaModal.ruta.fecha}
                className="flex-1 py-3 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Guardar fecha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
