// ═══════════════════════════════════════════════════════════
// 🔧 MANTENIMIENTO DE LA MOTO — UI (Fase 3.36 · 3.38)
// Tres piezas (mismo patrón del odómetro F3.35):
//   · MotorMantenimiento   → invisible, App.tsx lo monta 1 vez:
//                            arranca el servicio y avisa con
//                            toast cuando algo VENCE (1 aviso
//                            por ítem y por día, sin molestar).
//   · MantenimientoCard    → (F3.38) gestor completo: lista de
//                            mantenimientos con barra de avance,
//                            ✓ registrar hecho, historial e
//                            intervalos editables. Vive en el
//                            MODAL del menú hamburguesa ☰ — ya
//                            NO satura el Seguimiento de ruta.
//   · MantenimientoMenuStats→ bloque del menú hamburguesa:
//                            estado rápido + al tocarlo abre
//                            el gestor completo (F3.38).
//
// Los km salen del ODÓMETRO GPS (F3.35): total calibrado →
// los recordatorios respetan la calibración de la moto.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Wrench, Check, Settings2, Plus, History, Trash2, ChevronDown } from 'lucide-react';
import {
  arrancarMantenimiento,
  recargarMantenimiento,
  registrarMantenimiento,
  ajustarItem,
  agregarItem,
  eliminarItem,
  snapshotMantenimiento,
  suscribirMantenimiento,
  yaAvisadoHoy,
  marcarAvisado,
  EstadoMantenimiento,
} from '../services/mantenimiento';
import { snapshotOdometro, suscribirOdometro, StatsOdometro, formatearKm } from '../services/odometro';
import {
  evaluarLista,
  resumenMant,
  EvaluacionItem,
  formatearKmNum,
  textoKm,
  textoDias,
  fechaBonita,
} from '../utils/mantenimientoCore';

type OnShowToast = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

/** Hook en vivo del odómetro (km total calibrado) */
function useStatsOdometro(): StatsOdometro {
  return useSyncExternalStore(suscribirOdometro, snapshotOdometro);
}

/** Hook del store de mantenimiento */
function useMantenimiento(): EstadoMantenimiento {
  return useSyncExternalStore(suscribirMantenimiento, snapshotMantenimiento);
}

/** Re-render cada N ms (para las evaluaciones por días) */
function useTick(ms: number): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

// ═══════════════════════════════════════════════════════════
// ⚙️ MOTOR — montar 1 vez en App.tsx (invisible)
// ═══════════════════════════════════════════════════════════

export const MotorMantenimiento: React.FC<{ uid?: string | null; onShowToast?: OnShowToast }> = ({ uid, onShowToast }) => {
  const mant = useMantenimiento();
  const stats = useStatsOdometro();

  // Arrancar el servicio (carga local + sync remota)
  useEffect(() => {
    if (!uid) return;
    const detener = arrancarMantenimiento(uid);
    return detener;
  }, [uid]);

  // Aviso cuando algo VENCE (o ya está vencido al abrir):
  // máximo 1 toast por día — sin spam
  const kmTotalMs = stats.totalM;
  useEffect(() => {
    if (!uid || kmTotalMs <= 0) return;
    const kmTotal = Math.round(kmTotalMs / 1000);
    const evals = evaluarLista(mant.items, mant.estados, kmTotal, Date.now());
    const vencidos = evals.filter((e) => e.estado === 'vencido' && !yaAvisadoHoy(uid, e.id));
    if (vencidos.length === 0) return;

    const partes = vencidos
      .slice(0, 3)
      .map((v) => {
        if (v.kmRestantes != null) return `${v.nombre} (${textoKm(v.kmRestantes)})`;
        if (v.diasRestantes != null) return `${v.nombre} (${textoDias(v.diasRestantes)})`;
        return v.nombre;
      })
      .join(' · ');
    const extra = vencidos.length > 3 ? ` y ${vencidos.length - 3} más` : '';

    onShowToast?.(
      '🔧 Mantenimiento vencido',
      `${partes}${extra} — regístralos cuando llegues al taller (menú ☰ → Mantenimiento)`,
      'warning'
    );
    for (const v of vencidos) marcarAvisado(uid, v.id);
  }, [uid, mant, kmTotalMs, onShowToast]);

  return null;
};

// ═══════════════════════════════════════════════════════════
// 🔧 GESTOR — modal del menú hamburguesa (F3.38)
// ═══════════════════════════════════════════════════════════

interface MantenimientoCardProps {
  uid?: string | null;
  onShowToast?: OnShowToast;
}

const CHIP_ESTADO: Record<string, { texto: string; clase: string }> = {
  vencido: { texto: 'VENCIDO', clase: 'bg-red-500/15 text-red-300 border-red-500/40' },
  acerca: { texto: 'POR VENCER', clase: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  ok: { texto: 'AL DÍA', clase: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
};

const CHIPS_KM = [250, 500, 1000, 2000, 3000, 5000];
const CHIPS_DIAS = [15, 30, 60, 90, 180];

export const MantenimientoCard: React.FC<MantenimientoCardProps> = ({ uid, onShowToast }) => {
  const mant = useMantenimiento();
  const stats = useStatsOdometro();
  const tick = useTick(60000); // refresca "faltan X días"
  const kmTotal = Math.round(stats.totalM / 1000);

  const [itemAbierto, setItemAbierto] = useState<string | null>(null);
  const [modoPanel, setModoPanel] = useState<'registro' | 'ajuste'>('registro');
  const [form, setForm] = useState({ km: '', costo: '', taller: '', notas: '' });
  const [formIntervalo, setFormIntervalo] = useState({ km: '', dias: '' });
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [nuevoItem, setNuevoItem] = useState({ nombre: '', icono: '🔧', intervaloKm: '', intervaloDias: '' });
  const [guardando, setGuardando] = useState(false);

  const evaluaciones = useMemo(
    () => evaluarLista(mant.items, mant.estados, kmTotal, Date.now()),
    [mant, kmTotal, tick]
  );
  const resumen = useMemo(() => resumenMant(evaluaciones), [evaluaciones]);

  // ── abrir/cerrar panel de un item ──
  const abrirItem = (id: string, modo: 'registro' | 'ajuste' = 'registro') => {
    if (itemAbierto === id && modoPanel === modo) {
      setItemAbierto(null);
      return;
    }
    setItemAbierto(id);
    setModoPanel(modo);
    const item = mant.items[id];
    setForm({ km: String(kmTotal || ''), costo: '', taller: '', notas: '' });
    setFormIntervalo({
      km: item?.intervaloKm != null ? String(item.intervaloKm) : '',
      dias: item?.intervaloDias != null ? String(item.intervaloDias) : '',
    });
  };

  // ── registrar mantenimiento hecho ──
  const confirmarRegistro = async (ev: EvaluacionItem) => {
    if (!uid || guardando) return;
    const km = parseInt(form.km.replace(/[^0-9]/g, ''), 10);
    if (isNaN(km) || km < 0) {
      onShowToast?.('Km inválido', 'Escribe el km del marcador (número entero)', 'warning');
      return;
    }
    const costoRaw = form.costo.trim();
    const costo = costoRaw ? parseFloat(costoRaw.replace(',', '.')) : null;

    setGuardando(true);
    try {
      const registro = await registrarMantenimiento(uid, ev.id, {
        km,
        costo: isNaN(costo ?? NaN) ? null : costo,
        taller: form.taller,
        notas: form.notas,
      });
      setItemAbierto(null);
      const item = mant.items[ev.id];
      const proximo = item?.intervaloKm != null ? registro.km + item.intervaloKm : null;
      onShowToast?.(
        `✅ ${ev.nombre} registrado`,
        proximo != null
          ? `hecho a ${formatearKmNum(registro.km)} km — próximo a ${formatearKmNum(proximo)} km`
          : `hecho el ${fechaBonita(registro.fecha)} — recordatorio reiniciado`,
        'success'
      );
    } catch {
      onShowToast?.('No se pudo guardar', 'Quedó en el teléfono — reintenta con internet', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  // ── guardar intervalos ──
  const guardarIntervalos = async (ev: EvaluacionItem) => {
    if (!uid || guardando) return;
    const km = formIntervalo.km.trim();
    const dias = formIntervalo.dias.trim();
    const intervaloKm = km ? parseInt(km, 10) : null;
    const intervaloDias = dias ? parseInt(dias, 10) : null;
    if (intervaloKm == null && intervaloDias == null) {
      onShowToast?.('Pon un intervalo', 'Al menos km o días (ej: cada 1000 km)', 'warning');
      return;
    }
    if (intervaloKm != null && (intervaloKm < 50 || intervaloKm > 50000)) {
      onShowToast?.('Intervalo raro', 'Los km deben estar entre 50 y 50,000', 'warning');
      return;
    }
    setGuardando(true);
    try {
      await ajustarItem(uid, ev.id, { intervaloKm, intervaloDias });
      onShowToast?.('⚙️ Intervalo guardado', `${ev.nombre}: ${intervaloKm ? `cada ${formatearKmNum(intervaloKm)} km` : ''}${intervaloKm && intervaloDias ? ' o ' : ''}${intervaloDias ? `cada ${intervaloDias} días` : ''}`, 'success');
      setItemAbierto(null);
    } catch {
      onShowToast?.('No se pudo guardar', 'Quedó en el teléfono — reintenta con internet', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  // ── desactivar / eliminar item ──
  const quitarItem = async (ev: EvaluacionItem) => {
    if (!uid || guardando) return;
    const esCustom = !['aceite', 'cadena', 'frenos', 'llantas', 'filtro_aire', 'bujia', 'bateria', 'servicio'].includes(ev.id);
    if (!confirm(esCustom ? `¿Eliminar "${ev.nombre}" de tus mantenimientos?` : `¿Desactivar "${ev.nombre}"?\n\nPodrás reactivarlo agregándolo de nuevo.`)) return;
    setGuardando(true);
    try {
      await eliminarItem(uid, ev.id);
      setItemAbierto(null);
      onShowToast?.(esCustom ? 'Item eliminado' : 'Item desactivado', ev.nombre, 'info');
    } catch {
      onShowToast?.('No se pudo guardar', 'Quedó en el teléfono — reintenta con internet', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  // ── agregar item propio ──
  const confirmarAgregar = async () => {
    if (!uid || guardando) return;
    const nombre = nuevoItem.nombre.trim();
    if (!nombre) {
      onShowToast?.('Ponle nombre', '¿Qué mantenimiento es? (ej: "Valvulitas")', 'warning');
      return;
    }
    const intervaloKm = nuevoItem.intervaloKm.trim() ? parseInt(nuevoItem.intervaloKm, 10) : null;
    const intervaloDias = nuevoItem.intervaloDias.trim() ? parseInt(nuevoItem.intervaloDias, 10) : null;
    if (intervaloKm == null && intervaloDias == null) {
      onShowToast?.('Pon un intervalo', 'Al menos km o días (ej: cada 800 km)', 'warning');
      return;
    }
    setGuardando(true);
    try {
      await agregarItem(uid, { nombre, icono: nuevoItem.icono.trim() || '🔧', intervaloKm, intervaloDias });
      setAgregarAbierto(false);
      setNuevoItem({ nombre: '', icono: '🔧', intervaloKm: '', intervaloDias: '' });
      onShowToast?.('➕ Mantenimiento agregado', `${nombre} — regístralo cuando lo hagas`, 'success');
    } catch {
      onShowToast?.('No se pudo guardar', 'Quedó en el teléfono — reintenta con internet', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  // ── helpers visuales ──
  const bordeCard =
    resumen.vencidos.length > 0
      ? 'border-red-500/50 bg-gradient-to-br from-red-500/10 via-slate-900/80 to-slate-900/80'
      : resumen.acerca.length > 0
        ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-slate-900/80 to-slate-900/80'
        : 'border-slate-700/60 bg-slate-900/60';

  const subItem = (e: EvaluacionItem): { texto: string; clase: string } => {
    if (e.estado === 'nuevo') {
      return { texto: 'regístralo para empezar a contar', clase: 'text-slate-500' };
    }
    const partes: string[] = [];
    if (e.kmRestantes != null) partes.push(textoKm(e.kmRestantes));
    if (e.diasRestantes != null) partes.push(e.kmRestantes != null ? `o ${textoDias(e.diasRestantes)}` : textoDias(e.diasRestantes));
    if (e.proximoKm != null && e.kmRestantes != null && e.kmRestantes >= 0) {
      partes.push(`próximo a ${formatearKmNum(e.proximoKm)} km`);
    }
    return {
      texto: partes.join(' · '),
      clase: e.estado === 'vencido' ? 'text-red-300 font-bold' : e.estado === 'acerca' ? 'text-amber-300' : 'text-slate-400',
    };
  };

  const inputClase =
    'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-cyan-500 tabular-nums placeholder:font-normal placeholder:text-slate-600';
  const inputTextoClase =
    'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 placeholder:text-slate-600';
  const btnChip = (activo: boolean) =>
    `px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
      activo ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
    }`;

  return (
    <div className={`rounded-2xl border p-3.5 transition-colors ${bordeCard}`}>
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
          resumen.vencidos.length > 0
            ? 'bg-red-500/20 border-red-500/40'
            : resumen.acerca.length > 0
              ? 'bg-amber-500/15 border-amber-500/40'
              : 'bg-slate-800 border-slate-700'
        }`}>
          <Wrench className={`w-5 h-5 ${
            resumen.vencidos.length > 0 ? 'text-red-400' : resumen.acerca.length > 0 ? 'text-amber-400' : 'text-slate-400'
          }`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Mantenimiento de la moto</p>
          <p className="text-xl font-black text-white leading-tight">
            {resumen.vencidos.length > 0 ? (
              <span className="text-red-300">{resumen.vencidos.length} vencido{resumen.vencidos.length > 1 ? 's' : ''}</span>
            ) : resumen.acerca.length > 0 ? (
              <span className="text-amber-300">{resumen.acerca.length} por vencer</span>
            ) : evaluaciones.some((e) => e.estado === 'ok') ? (
              <span className="text-emerald-300">todo al día</span>
            ) : (
              <span className="text-slate-300">regístralo y cuenta solo</span>
            )}
            {resumen.proximo && resumen.vencidos.length === 0 && (
              <span className="ml-2 text-xs font-bold text-slate-400">
                próximo: {resumen.proximo.icono} {resumen.proximo.nombre.split(' ')[0]}
                {resumen.proximo.kmRestantes != null ? ` · ${textoKm(resumen.proximo.kmRestantes)}` : ''}
              </span>
            )}
          </p>
          <p className="text-[10px] text-slate-500">
            cuenta con los km del odómetro ({formatearKm(stats.totalM)} totales) — calibración incluida
          </p>
        </div>
      </div>

      {/* Lista de items */}
      <div className="mt-3 space-y-1.5">
        {evaluaciones.map((e) => {
          const abierto = itemAbierto === e.id;
          const chip = CHIP_ESTADO[e.estado];
          const sub = subItem(e);
          const pct = Math.min(100, Math.round(e.progreso * 100));
          const colorBarra =
            e.estado === 'vencido' ? 'bg-red-500' : e.estado === 'acerca' ? 'bg-amber-400' : e.estado === 'nuevo' ? 'bg-slate-600' : 'bg-emerald-500';
          const est = mant.estados[e.id];

          return (
            <div key={e.id} className={`rounded-xl border transition-colors ${abierto ? 'border-slate-600 bg-slate-800/60' : 'border-transparent hover:bg-slate-800/40'}`}>
              {/* Fila */}
              <button
                onClick={() => abrirItem(e.id)}
                className="w-full flex items-center gap-2.5 p-2 text-left rounded-xl"
              >
                <span className="text-lg flex-shrink-0 w-7 text-center">{e.icono}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white truncate">{e.nombre}</span>
                    {chip && (
                      <span className={`px-1.5 py-0.5 text-[8px] font-black rounded border tracking-wide ${chip.clase}`}>
                        {chip.texto}
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] leading-tight mt-0.5 ${sub.clase}`}>{sub.texto}</p>
                  {/* Barra de avance */}
                  <div className="h-1 rounded-full bg-slate-800 mt-1.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${colorBarra}`} style={{ width: `${e.estado === 'nuevo' ? 0 : Math.max(3, pct)}%` }} />
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
              </button>

              {/* Panel expandido */}
              {abierto && (
                <div className="px-2 pb-2.5 space-y-2.5">
                  {/* Cambio registro/ajuste */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setModoPanel('registro')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all active:scale-95 ${
                        modoPanel === 'registro' ? 'bg-emerald-600/80 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Check className="w-3 h-3 inline mr-1" />Registrar hecho
                    </button>
                    <button
                      onClick={() => setModoPanel('ajuste')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all active:scale-95 ${
                        modoPanel === 'ajuste' ? 'bg-blue-600/80 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Settings2 className="w-3 h-3 inline mr-1" />Ajustar
                    </button>
                  </div>

                  {modoPanel === 'registro' ? (
                    <>
                      {est && (
                        <p className="text-[10px] text-slate-400 leading-snug">
                          último: <b className="text-slate-300">{fechaBonita(est.fechaUltima)}</b> · {formatearKmNum(est.kmUltimo)} km
                          {(() => {
                            const ult = mant.historial.find((h) => h.id === e.id);
                            if (ult?.taller) return ` · ${ult.taller}`;
                            return '';
                          })()}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">km del odómetro</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={form.km}
                            onChange={(ev) => setForm((f) => ({ ...f, km: ev.target.value }))}
                            placeholder={String(kmTotal || 0)}
                            className={inputClase + ' w-full'}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">costo S/ (opcional)</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={form.costo}
                            onChange={(ev) => setForm((f) => ({ ...f, costo: ev.target.value }))}
                            placeholder="40"
                            className={inputClase + ' w-full'}
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        value={form.taller}
                        onChange={(ev) => setForm((f) => ({ ...f, taller: ev.target.value }))}
                        placeholder="Taller (opcional)"
                        className={inputTextoClase + ' w-full'}
                      />
                      <input
                        type="text"
                        value={form.notas}
                        onChange={(ev) => setForm((f) => ({ ...f, notas: ev.target.value }))}
                        placeholder="Notas (opcional — ej: aceite 10W40 semi)"
                        className={inputTextoClase + ' w-full'}
                      />
                      <button
                        onClick={() => confirmarRegistro(e)}
                        disabled={guardando}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {guardando ? 'Guardando…' : `Registrar ${e.nombre.split(' ')[0].toLowerCase()}`}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-slate-400">
                        ¿Cada cuánto toca? <b className="text-slate-300">{e.nombre}</b> — gana el que llegue primero
                      </p>
                      <label className="space-y-1 block">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">cada X km</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={formIntervalo.km}
                          onChange={(ev) => setFormIntervalo((f) => ({ ...f, km: ev.target.value }))}
                          placeholder="1000"
                          className={inputClase + ' w-full'}
                        />
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {CHIPS_KM.map((k) => (
                            <button key={k} onClick={() => setFormIntervalo((f) => ({ ...f, km: String(k) }))} className={btnChip(formIntervalo.km === String(k))}>
                              {formatearKmNum(k)}
                            </button>
                          ))}
                        </div>
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">cada X días (opcional)</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={formIntervalo.dias}
                          onChange={(ev) => setFormIntervalo((f) => ({ ...f, dias: ev.target.value }))}
                          placeholder="90"
                          className={inputClase + ' w-full'}
                        />
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {CHIPS_DIAS.map((d) => (
                            <button key={d} onClick={() => setFormIntervalo((f) => ({ ...f, dias: String(d) }))} className={btnChip(formIntervalo.dias === String(d))}>
                              {d}d
                            </button>
                          ))}
                        </div>
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => guardarIntervalos(e)}
                          disabled={guardando}
                          className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all active:scale-95"
                        >
                          {guardando ? 'Guardando…' : 'Guardar intervalo'}
                        </button>
                        <button
                          onClick={() => quitarItem(e)}
                          disabled={guardando}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-500/40 text-slate-400 hover:text-red-300 text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
                          title="Desactivar o eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Quitar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Historial */}
      {mant.historial.length > 0 && (
        <div className="mt-2.5">
          <button
            onClick={() => setHistorialAbierto((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Historial ({mant.historial.length})
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${historialAbierto ? 'rotate-180' : ''}`} />
          </button>
          {historialAbierto && (
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 divide-y divide-slate-700/40 mt-1">
              {mant.historial.slice(0, 15).map((h) => (
                <div key={h.at} className="flex items-center gap-2 px-2.5 py-1.5 text-[10px]">
                  <span className="text-slate-300 font-bold tabular-nums w-12 flex-shrink-0">{fechaBonita(h.fecha)}</span>
                  <span className="flex-shrink-0">{mant.items[h.id]?.icono || '🔧'}</span>
                  <span className="text-slate-300 truncate flex-1">{h.nombre}</span>
                  <span className="text-slate-400 tabular-nums flex-shrink-0">{formatearKmNum(h.km)} km</span>
                  {h.costo != null && <span className="text-emerald-400/80 tabular-nums flex-shrink-0">S/ {h.costo}</span>}
                  {h.taller && <span className="text-slate-500 truncate hidden sm:block max-w-24" title={h.notas || ''}>{h.taller}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agregar propio */}
      <button
        onClick={() => setAgregarAbierto((v) => !v)}
        className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-slate-600 text-[10px] font-bold text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Agregar mantenimiento propio
      </button>
      {agregarAbierto && (
        <div className="mt-2 rounded-xl bg-slate-800/60 border border-slate-700 p-2.5 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={nuevoItem.icono}
              onChange={(e) => setNuevoItem((n) => ({ ...n, icono: e.target.value.slice(0, 2) }))}
              className={inputTextoClase + ' w-14 text-center text-lg'}
              title="Emoji"
            />
            <input
              type="text"
              value={nuevoItem.nombre}
              onChange={(e) => setNuevoItem((n) => ({ ...n, nombre: e.target.value }))}
              placeholder="Nombre (ej: Valvulitas)"
              className={inputTextoClase + ' flex-1'}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={nuevoItem.intervaloKm}
              onChange={(e) => setNuevoItem((n) => ({ ...n, intervaloKm: e.target.value }))}
              placeholder="cada X km"
              className={inputClase + ' w-full'}
            />
            <input
              type="number"
              inputMode="numeric"
              value={nuevoItem.intervaloDias}
              onChange={(e) => setNuevoItem((n) => ({ ...n, intervaloDias: e.target.value }))}
              placeholder="cada X días"
              className={inputClase + ' w-full'}
            />
          </div>
          <button
            onClick={confirmarAgregar}
            disabled={guardando}
            className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all active:scale-95"
          >
            {guardando ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 🔘 BOTÓN DE MENÚ (F3.40) — fila IGUAL a las demás opciones del
// ☰ (icono + "Mantenimiento" + badge rojo/ámbar). Reemplaza al
// bloque grande que saturaba el menú. Toca → gestor en modal.
// ═══════════════════════════════════════════════════════════

interface MantenimientoMenuBotonProps {
  uid?: string | null;
  /** Sidebar colapsado → solo el icono (badge rojo si hay vencidos) */
  colapsado?: boolean;
  onAbrir?: () => void;
}

export const MantenimientoMenuBoton: React.FC<MantenimientoMenuBotonProps> = ({ uid, colapsado, onAbrir }) => {
  const mant = useMantenimiento();
  const stats = useStatsOdometro();
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!uid) { setCargando(false); return; }
    let vivo = true;
    recargarMantenimiento(uid).finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [uid]);

  const kmTotal = Math.round(stats.totalM / 1000);
  const evaluaciones = useMemo(() => evaluarLista(mant.items, mant.estados, kmTotal, Date.now()), [mant, kmTotal]);
  const resumen = useMemo(() => resumenMant(evaluaciones), [evaluaciones]);

  // Texto corto para el tooltip
  const resumenTexto = cargando
    ? 'cargando…'
    : resumen.vencidos.length > 0
      ? `${resumen.vencidos.length} vencidos — toca para gestionar`
      : resumen.acerca.length > 0
        ? `${resumen.acerca.length} por vencer — toca para gestionar`
        : 'todo al día ✓ — toca para gestionar';

  const badge =
    resumen.vencidos.length > 0
      ? { texto: `${resumen.vencidos.length}`, clase: 'bg-red-500/20 text-red-400 border-red-500/30' }
      : resumen.acerca.length > 0
        ? { texto: `${resumen.acerca.length}`, clase: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
        : null;

  return (
    <button
      onClick={onAbrir}
      title={colapsado ? 'Mantenimiento' : `Mantenimiento: ${resumenTexto}`}
      className="group relative flex items-center w-full px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 active:scale-[0.98]"
    >
      <Wrench
        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${
          resumen.vencidos.length > 0 ? 'text-red-400' : resumen.acerca.length > 0 ? 'text-amber-400' : ''
        }`}
      />
      {!colapsado && <span className="ml-3 truncate font-medium">Mantenimiento</span>}
      {!colapsado && badge && (
        <span className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full border ${badge.clase}`}>
          {badge.texto}
        </span>
      )}
      {colapsado && resumen.vencidos.length > 0 && (
        <span className="absolute top-1 right-1.5 px-1 min-w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center border border-slate-900">
          {resumen.vencidos.length}
        </span>
      )}
      {colapsado && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
          Mantenimiento
        </div>
      )}
    </button>
  );
};
