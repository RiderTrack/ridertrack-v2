// ═══════════════════════════════════════════════════════════
// 💰 DriverTrack — Caja: resumen por día, exportar, cobrar
// F-ID6: 💸 los gastos del día (recargas, gasolina…) se anotan
// acá y se DESCUENTAN del neto → el número que queda es lo EN MANO.
// ═══════════════════════════════════════════════════════════
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, MessageCircle, Minus, QrCode, Trash2 } from 'lucide-react';
import { ConfigDT, emojiGasto, Gasto, nombreOrigen, nombreGasto, TIPOS_GASTO, TipoGasto, Viaje } from '../types';
import { fechaBonita, fechaHoy, horaAhora, resumenDia, totalGastosDia } from '../storage';
import { armarMensajeCobro, descargarArchivo, fmtSoles, linkWhatsApp, normalizarCelular } from '../utils';
import ViajeList from './ViajeList';

interface Props {
  viajes: Viaje[];
  config: ConfigDT;
  gastos: Gasto[];                       // F-ID6: todos los gastos guardados
  onAgregarGasto: (g: Gasto) => void;    // F-ID6
  onEliminarGasto: (id: string) => void; // F-ID6
  onEliminar: (id: string) => void;
  onCobrar: (monto: number) => void;
  onToast: (msg: string) => void;
  viajeGPSActivo?: string | null;         // F-ID3: pasa through a la lista
  onIniciarGPS?: (id: string) => void;    // F-ID3
  onDetenerGPS?: () => void;              // F-ID3
  // F-ID5: flujo de cobro compartido (robot si está activo) — pasa through
  onMandarCobro?: (datos: { cliente: string; monto: number; direccion: string }, celular: string) => Promise<void> | void;
  cobroEnCurso?: boolean;
}

function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function CajaView({
  viajes,
  config,
  gastos,
  onAgregarGasto,
  onEliminarGasto,
  onEliminar,
  onCobrar,
  onToast,
  viajeGPSActivo,
  onIniciarGPS,
  onDetenerGPS,
  onMandarCobro,
  cobroEnCurso = false,
}: Props) {
  const [fecha, setFecha] = useState(fechaHoy());
  const resumen = useMemo(() => resumenDia(viajes, fecha), [viajes, fecha]);
  const delDia = useMemo(() => viajes.filter(v => v.fecha === fecha), [viajes, fecha]);
  const esHoy = fecha === fechaHoy();
  // F-ID3: km reales del día + cuánto pagó cada km
  const kmDia = delDia.reduce((s, v) => s + (v.kmGPS ?? 0), 0);

  // ═══ F-ID6: 💸 gastos del día que se está mirando ═══
  const gastoDia = useMemo(() => gastos.filter(g => g.fecha === fecha), [gastos, fecha]);
  const totalGastos = useMemo(() => totalGastosDia(gastos, fecha), [gastos, fecha]);
  const enMano = resumen.neto - totalGastos; // lo que queda REAL en el bolsillo
  // Form del gasto (solo se anota HOY — igual que los viajes)
  const [gastoAbierto, setGastoAbierto] = useState(false);
  const [montoGasto, setMontoGasto] = useState('');
  const [tipoGasto, setTipoGasto] = useState<TipoGasto>('saldo');
  const [notaGasto, setNotaGasto] = useState('');
  const [confirmarGastoId, setConfirmarGastoId] = useState<string | null>(null);

  function guardarGasto() {
    // acepta coma o punto decimal — en el teclado del Perú sale las dos
    const monto = parseFloat(montoGasto.replace(',', '.')) || 0;
    if (monto <= 0) return onToast('Poné cuánto gastaste 💸');
    onAgregarGasto({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fecha, // acá fecha === hoy (el botón solo aparece en hoy)
      hora: horaAhora(),
      tipo: tipoGasto,
      monto: +monto.toFixed(2),
      nota: notaGasto.trim(),
    });
    setMontoGasto('');
    setNotaGasto('');
    setTipoGasto('saldo');
    setGastoAbierto(false);
  }

  function exportarCSV() {
    if (delDia.length === 0) return onToast('No hay viajes que exportar');
    const filas = [
      'hora,origen,cliente,zona,tarifa,comision %,comision,neto',
      ...delDia.map(v =>
        [v.hora, nombreOrigen(v.origen), `"${v.cliente}"`, `"${v.zona}"`, v.tarifa, v.comisionPct, v.comision, v.neto].join(','),
      ),
      `,,,"TOTAL",${resumen.bruto.toFixed(2)},,${resumen.comision.toFixed(2)},${resumen.neto.toFixed(2)}`,
    ];
    // F-ID6: los gastos van en el mismo CSV (tabla aparte, abajo)
    if (gastoDia.length > 0) {
      filas.push('', 'hora,gasto,monto');
      gastoDia.forEach(g =>
        filas.push(`${g.hora},"${nombreGasto(g.tipo)}${g.nota ? ` — ${g.nota}` : ''}",${g.monto.toFixed(2)}`),
      );
      filas.push(`,,"TOTAL GASTOS",${totalGastos.toFixed(2)}`);
      filas.push(`,,"EN MANO (neto − gastos)",${enMano.toFixed(2)}`);
    }
    descargarArchivo(`drivertrack-caja-${fecha}.csv`, filas.join('\n'), 'text/csv');
    onToast('CSV descargado 📄');
  }

  function compartirResumen() {
    if (delDia.length === 0) return onToast('No hay viajes para compartir');
    const porOrigen = Object.entries<{ n: number; neto: number }>(resumen.porOrigen)
      .map(([o, d]) => `• ${nombreOrigen(o as never)}: ${d.n} viajes — ${fmtSoles(d.neto)} netos`)
      .join('\n');
    const texto = [
      `🏍️ *DriverTrack — ${fechaBonita(fecha)}*`,
      ``,
      `🧾 Viajes: ${resumen.n}`,
      `💵 Bruto: ${fmtSoles(resumen.bruto)}`,
      `✂️ Comisiones: −${fmtSoles(resumen.comision)}`,
      // F-ID6: si hubo gastos, se muestran y el NETO pasa a ser lo EN MANO
      ...(totalGastos > 0 ? [`💸 Gastos: −${fmtSoles(totalGastos)}`] : []),
      `✅ *NETO DEL DÍA: ${fmtSoles(resumen.neto)}*`,
      ...(totalGastos > 0 ? [`💰 *EN MANO: ${fmtSoles(enMano)}*`] : []),
      ``,
      porOrigen,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  }

  return (
    <div className="space-y-3">
      {/* Navegador de fecha */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 p-2">
        <button
          onClick={() => setFecha(sumarDias(fecha, -1))}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-700"
          aria-label="Día anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold capitalize text-slate-100">{fechaBonita(fecha)}</p>
          {!esHoy && (
            <button onClick={() => setFecha(fechaHoy())} className="text-[11px] text-emerald-400 underline">
              ir a hoy
            </button>
          )}
        </div>
        <button
          onClick={() => setFecha(sumarDias(fecha, 1))}
          disabled={esHoy}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-700 disabled:opacity-30"
          aria-label="Día siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-center">
          <p className="text-lg font-black text-slate-100">{resumen.n}</p>
          <p className="text-[10px] text-slate-400">viajes</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-center">
          <p className="text-sm font-black text-slate-200">{fmtSoles(resumen.bruto)}</p>
          <p className="text-[10px] text-slate-400">bruto</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-center">
          <p className="text-sm font-black text-red-400">−{fmtSoles(resumen.comision)}</p>
          <p className="text-[10px] text-slate-400">comisión</p>
        </div>
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-center">
          <p className="text-sm font-black text-emerald-400">{fmtSoles(resumen.neto)}</p>
          <p className="text-[10px] text-emerald-500/80">neto</p>
        </div>
      </div>

      {/* F-ID3: cuánto te pagó cada km de hoy (solo la plata de los
          viajes grabados — mezclar los sin GPS infla el número) */}
      {kmDia > 0 && (
        <div
          className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 py-2 text-xs font-bold text-sky-300"
          data-testid="caja-km"
        >
          📍 {kmDia.toFixed(1)} km reales · S/ {(delDia.filter(v => (v.kmGPS ?? 0) > 0).reduce((s, v) => s + v.neto, 0) / kmDia).toFixed(2)} por km
        </div>
      )}

      {/* ═══ F-ID6: 💸 Gastos del día — lo que sale del bolsillo ═══ */}
      <div
        className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3"
        data-testid="caja-gastos"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-200">
            💸 Gastos{' '}
            {totalGastos > 0 && (
              <span className="font-black text-red-400" data-testid="caja-gastos-total">
                −{fmtSoles(totalGastos)}
              </span>
            )}
          </p>
          {/* El ➖ solo aparece en HOY — los gastos se anotan el día que
              salen del bolsillo (igual que los viajes) */}
          {esHoy && !gastoAbierto && (
            <button
              onClick={() => setGastoAbierto(true)}
              className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500/25"
              data-testid="boton-agregar-gasto"
            >
              <Minus size={12} /> Anotar gasto
            </button>
          )}
        </div>

        {/* Form rápido: cuánto + qué fue + (nota) */}
        {gastoAbierto && (
          <div className="mt-2.5 space-y-2 rounded-xl bg-slate-900/70 p-2.5" data-testid="form-gasto">
            <input
              value={montoGasto}
              onChange={e => setMontoGasto(e.target.value)}
              inputMode="decimal"
              placeholder="Cuánto salió (S/) — ej: 15"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-100 outline-none placeholder:font-normal placeholder:text-slate-500 focus:border-amber-500/60"
              data-testid="input-gasto-monto"
              autoFocus
            />
            <div className="grid grid-cols-4 gap-1.5">
              {TIPOS_GASTO.map(t => {
                const activo = tipoGasto === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTipoGasto(t.id)}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border py-1.5 text-[10px] font-bold transition-colors ${
                      activo
                        ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                        : 'border-slate-700 bg-slate-800/60 text-slate-400'
                    }`}
                    data-testid={`chip-gasto-${t.id}`}
                  >
                    <span className="text-base leading-none">{t.emoji}</span>
                    {t.nombre}
                  </button>
                );
              })}
            </div>
            <input
              value={notaGasto}
              onChange={e => setNotaGasto(e.target.value)}
              placeholder="Nota (opcional) — ej: recarga completa"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-500/60"
              data-testid="input-gasto-nota"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setGastoAbierto(false)}
                className="rounded-xl bg-slate-700 py-2.5 text-xs font-bold text-slate-300"
                data-testid="boton-gasto-cancelar"
              >
                Cancelar
              </button>
              <button
                onClick={guardarGasto}
                className="rounded-xl bg-amber-500 py-2.5 text-xs font-black text-slate-950"
                data-testid="boton-gasto-guardar"
              >
                ➖ Anotar
              </button>
            </div>
          </div>
        )}

        {/* Lista de gastos del día (borrables — te equivocaste, se arregla) */}
        {gastoDia.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {[...gastoDia]
              .sort((a, b) => (a.hora < b.hora ? 1 : -1))
              .map(g => (
                <div
                  key={g.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/50 px-2.5 py-2"
                  data-testid="gasto-item"
                >
                  <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                    {g.hora}
                  </span>
                  <span className="shrink-0 text-xs">{emojiGasto(g.tipo)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-slate-200">{nombreGasto(g.tipo)}</p>
                    {g.nota && (
                      <p className="truncate text-[10px] text-slate-500" title={g.nota}>
                        {g.nota}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-black text-red-400">−{fmtSoles(g.monto)}</span>
                  {confirmarGastoId === g.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => {
                          onEliminarGasto(g.id);
                          setConfirmarGastoId(null);
                        }}
                        className="rounded-lg bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-400"
                      >
                        Borrar
                      </button>
                      <button
                        onClick={() => setConfirmarGastoId(null)}
                        className="rounded-lg bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-300"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmarGastoId(g.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Eliminar gasto"
                      data-testid="boton-eliminar-gasto"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}

        {gastoDia.length === 0 && !gastoAbierto && (
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
            Recargas de saldo, gasolina, comida — lo que se te va del bolsillo te descuenta del neto
          </p>
        )}
      </div>

      {/* F-ID6: ✋ lo que queda REAL — el número que importa */}
      {totalGastos > 0 && (
        <div
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-center"
          data-testid="caja-en-mano"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-500/80">
            ✋ En mano (neto − gastos)
          </p>
          <p
            className={`text-lg font-black leading-tight ${
              enMano < 0 ? 'text-red-400' : 'text-amber-300'
            }`}
          >
            {enMano < 0 ? `−${fmtSoles(Math.abs(enMano))}` : fmtSoles(enMano)}
          </p>
          {enMano < 0 && (
            <p className="text-[10px] text-red-400/80">Gastaste más de lo que ganaste 🫣</p>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onCobrar(resumen.neto)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-500/15 py-2.5 text-xs font-bold text-violet-300"
        >
          <QrCode size={14} /> Cobrar Yape
        </button>
        <button
          onClick={compartirResumen}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 py-2.5 text-xs font-bold text-emerald-300"
        >
          <MessageCircle size={14} /> Resumen
        </button>
        <button
          onClick={exportarCSV}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-500/15 py-2.5 text-xs font-bold text-sky-300"
        >
          <Download size={14} /> CSV
        </button>
      </div>

      {/* Lista del día */}
      <ViajeList
        viajes={delDia}
        onEliminar={onEliminar}
        titulo={`del ${fechaBonita(fecha)}`}
        config={config}
        viajeGPSActivo={viajeGPSActivo}
        onIniciarGPS={onIniciarGPS}
        onDetenerGPS={onDetenerGPS}
        onMandarCobro={
          onMandarCobro ??
          ((datos, cel) => {
            // sin shell-passthrough (no debería pasar): WhatsApp manual
            window.open(linkWhatsApp(normalizarCelular(cel), armarMensajeCobro(datos, config)), '_blank');
          })
        }
        cobroEnCurso={cobroEnCurso}
      />
    </div>
  );
}
