// ═══════════════════════════════════════════════════════════
// 📢 BROADCAST VIEW — RiderTrack V2 (Fase 2.5 / fix 2.6)
// Envío masivo por WhatsApp mediante el bot de Baileys, EXACTAMENTE
// como en el Rider Modular v1 (bot-baileys.js → botBroadcastEnviar
//Seleccionados):
//   1. Seleccionas todos los clientes (o solo algunos)
//   2. El DELAY entre envíos (20-30 seg) evita el baneo
//   3. La app encola las acciones UNO POR UNO y el BOT manda cada
//      una con SU PLANTILLA OFICIAL + IMAGEN de inicio de ruta
//      (imagenes_bot/inicio_ruta.jpg del rudy-bot).
// ⚠️ Fix 2.6: el payload es AHORA IDÉNTICO al de la v1 — el bot
// ya tiene su propia plantilla con imagen y arma el mensaje él
// mismo. La app SOLO manda los datos del cliente (no un mensaje
// armado). También se corrigió rider.telefono: ahora es el
// celular DEL RIDER (v1: _botCel(D.myCel)), no el de la empresa.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone,
  Search,
  CheckSquare,
  Square,
  Send,
  Pause,
  Play,
  StopCircle,
  Loader2,
  AlertTriangle,
  Bot,
  Timer,
  Check,
  RefreshCw,
  ImageIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useClientes } from '../hooks/useClientes';
import { useConfig } from '../hooks/useConfig';
import { Cliente, encolarAccionBot, _botCel } from '../services/firestore';
import { direccionIncompleta } from '../utils/direcciones';

interface BroadcastViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const DELAY_KEY = 'rt_broadcast_delay';

type FaseBroadcast = 'config' | 'enviando' | 'completado';

interface ColaItem {
  cliente: Cliente;
  telefono: string;
}

export const BroadcastView: React.FC<BroadcastViewProps> = ({ onShowToast }) => {
  const { user, profile } = useAuth();
  const { clientes, loading } = useClientes();
  const { config } = useConfig();

  // ── Configuración persistente ──
  const [delaySeg, setDelaySeg] = useState<number>(() => {
    try {
      const v = parseInt(localStorage.getItem(DELAY_KEY) || '');
      return !isNaN(v) && v >= 5 && v <= 120 ? v : 25;
    } catch {
      return 25;
    }
  });

  // ── Selección ──
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');

  // ── Envío ──
  const [fase, setFase] = useState<FaseBroadcast>('config');
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [idxActual, setIdxActual] = useState(0);
  const [enviados, setEnviados] = useState(0);
  const [fallidos, setFallidos] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [enviandoAhora, setEnviandoAhora] = useState(false);

  const pausadoRef = useRef(false);
  const detenidoRef = useRef(false);

  // Clientes con celular válido
  const clientesConCel = useMemo(
    () => clientes.filter((c) => _botCel(c.cel || '')),
    [clientes]
  );

  // Filtrados por búsqueda
  const clientesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return clientesConCel;
    const q = busqueda.toLowerCase();
    return clientesConCel.filter(
      (c) =>
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.dist || '').toLowerCase().includes(q) ||
        (c.dir || '').toLowerCase().includes(q)
    );
  }, [clientesConCel, busqueda]);

  // Persistir configuración
  useEffect(() => {
    try {
      localStorage.setItem(DELAY_KEY, String(delaySeg));
    } catch { /* sin storage */ }
  }, [delaySeg]);

  // ── Selección masiva ──
  const seleccionarTodos = () => {
    setSeleccion(new Set(clientesFiltrados.map((c) => String(c.id))));
  };
  const deseleccionarTodos = () => setSeleccion(new Set());
  const toggleCliente = (id: string | number) => {
    const key = String(id);
    setSeleccion((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(key)) nuevo.delete(key);
      else nuevo.add(key);
      return nuevo;
    });
  };

  // ── Envío UNO POR UNO con delay ──
  const procesarSiguiente = async (items: ColaItem[], desde: number) => {
    if (detenidoRef.current) return;

    if (desde >= items.length) {
      setFase('completado');
      setCountdown(0);
      onShowToast?.(
        '📢 Broadcast terminado',
        `${enviados + fallidos > 0 ? enviados : 0} mensajes encolados para el bot · ${fallidos} fallidos`,
        fallidos > 0 ? 'warning' : 'success'
      );
      return;
    }

    if (pausadoRef.current) return;

    const item = items[desde];
    setIdxActual(desde);
    setEnviandoAhora(true);

    try {
      // Orden de la ruta completa (para que el bot sepa la posición)
      const ordenados = [...clientesConCel].sort((a, b) => (a.num || 999) - (b.num || 999));
      const rutaClientes = ordenados.map((c) => ({
        nombre: c.nombre || 'Cliente',
        dist: c.dist || '',
        pos: c.num || 0,
      }));
      const distritosOrden: string[] = [];
      const vistos = new Set<string>();
      ordenados.forEach((c) => {
        const d = (c.dist || '').trim();
        if (d && !vistos.has(d)) {
          vistos.add(d);
          distritosOrden.push(d);
        }
      });

      // ── PAYLOAD IDÉNTICO A LA V1 (bot-baileys.js) ──
      // El bot (rudy-bot) recibe `broadcast_inicio` y él mismo arma
      // su plantilla oficial con la imagen de inicio de ruta.
      // v1: rider = {nombre, telefono (celular DEL RIDER), fotoUrl, empresa}
      const celRider = _botCel(config?.yape?.telefono || '') || '';
      await encolarAccionBot(user!.uid, {
        tipo: 'broadcast_inicio',
        clienteId: item.cliente.id,
        telefono: item.telefono,
        nombre: item.cliente.nombre || 'Cliente',
        prod: item.cliente.prod || '',
        cobrar: parseFloat(String(item.cliente.cobrar || 0)),
        dir: item.cliente.dir || '',
        dist: item.cliente.dist || '',
        rider: {
          nombre: profile?.nombre || 'Rider',
          telefono: celRider || config?.empresa?.telefono || '',
          fotoUrl: '',
          empresa: config?.empresa?.nombre || 'MATE',
        },
        rutaDistritos: distritosOrden,
        rutaClientes,
        miPosicion: item.cliente.num || 0,
      } as any);

      setEnviados((n) => n + 1);
    } catch {
      setFallidos((n) => n + 1);
    } finally {
      setEnviandoAhora(false);
    }

    // Countdown antes del siguiente
    const siguiente = desde + 1;
    if (siguiente < items.length && !detenidoRef.current) {
      setIdxActual(siguiente);
      for (let seg = delaySeg; seg > 0; seg--) {
        if (detenidoRef.current) return;
        setCountdown(seg);
        // Esperar 1s revisando pausa
        await new Promise<void>((resolve) => {
          const chequear = () => {
            if (detenidoRef.current || !pausadoRef.current) resolve();
            else setTimeout(chequear, 300);
          };
          setTimeout(() => {
            if (pausadoRef.current && !detenidoRef.current) chequear();
            else resolve();
          }, 1000);
        });
      }
      setCountdown(0);
      await procesarSiguiente(items, siguiente);
    } else {
      setFase('completado');
      onShowToast?.(
        '📢 Broadcast terminado',
        `${enviados + 1} mensajes encolados · ${fallidos} fallidos`,
        fallidos > 0 ? 'warning' : 'success'
      );
    }
  };

  const iniciarBroadcast = () => {
    if (seleccion.size === 0) {
      onShowToast?.('Nada seleccionado', 'Marca al menos a un cliente', 'warning');
      return;
    }
    const items: ColaItem[] = clientesConCel
      .filter((c) => seleccion.has(String(c.id)))
      .sort((a, b) => (a.num || 999) - (b.num || 999))
      .map((c) => ({ cliente: c, telefono: _botCel(c.cel || '')! }));

    if (!confirm(
      `¿Enviar broadcast a ${items.length} cliente${items.length !== 1 ? 's' : ''}?\n\n` +
      `⏱️ Delay entre mensajes: ${delaySeg} segundos\n` +
      `⏳ Duración total aprox: ~${Math.ceil((items.length * delaySeg) / 60)} min\n\n` +
      `El bot de WhatsApp (Termux) debe estar CONECTADO.`
    )) return;

    detenidoRef.current = false;
    pausadoRef.current = false;
    setPausado(false);
    setCola(items);
    setIdxActual(0);
    setEnviados(0);
    setFallidos(0);
    setFase('enviando');
    procesarSiguiente(items, 0);
  };

  const togglePausa = () => {
    pausadoRef.current = !pausadoRef.current;
    setPausado(pausadoRef.current);
  };

  const detener = () => {
    if (!confirm('¿DETENER el broadcast?\n\nLos ya encolados igual saldrán por el bot, pero no se enviará el resto.')) return;
    detenidoRef.current = true;
    pausadoRef.current = false;
    setPausado(false);
    setCountdown(0);
    setFase('completado');
  };

  const reiniciar = () => {
    setFase('config');
    setCola([]);
    setIdxActual(0);
    setEnviados(0);
    setFallidos(0);
    setCountdown(0);
    detenidoRef.current = false;
    pausadoRef.current = false;
    setPausado(false);
  };

  // ─────────────────────────────────────────────
  // PANTALLA DE ENVÍO (progreso)
  // ─────────────────────────────────────────────
  if (fase === 'enviando' || fase === 'completado') {
    const total = cola.length;
    const pendientes = Math.max(0, total - enviados - fallidos);
    const pct = total > 0 ? Math.round(((enviados + fallidos) / total) * 100) : 0;
    const actual = cola[idxActual];

    return (
      <div className="max-w-md mx-auto space-y-4 pb-8">
        <div className="rounded-2xl bg-slate-800 border-2 border-purple-500/40 p-5 shadow-xl">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mb-3">
              <Megaphone className="w-7 h-7 text-purple-400" />
            </div>
            <h1 className="text-lg font-black text-white">
              {fase === 'enviando' ? '📢 Enviando Broadcast' : pendientes === 0 && detenidoRef.current ? '⛔ Broadcast detenido' : '✅ Broadcast completado'}
            </h1>
            <p className="text-[11px] text-slate-400 mt-1">
              {fase === 'enviando'
                ? 'El bot manda los mensajes uno por uno'
                : `${enviados} mensajes encolados para el bot`}
            </p>
          </div>

          {/* Progreso */}
          <div className="mt-4">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-slate-400">📊 Progreso</span>
              <span className="text-purple-400 font-bold">{enviados + fallidos} / {total}</span>
            </div>
            <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-fuchsia-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Cliente actual */}
          <div className="mt-4 rounded-xl bg-slate-900/70 border border-slate-700 p-3 text-center">
            <div className="text-[9px] text-slate-500 uppercase mb-1">
              {fase === 'enviando' ? '👤 Enviando a' : 'Último cliente'}
            </div>
            <div className="text-sm font-bold text-white">
              {actual?.cliente?.nombre || '—'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">📱 {actual?.telefono || ''}</div>
          </div>

          {/* Countdown */}
          {fase === 'enviando' && !pausado && countdown > 0 && (
            <div className="mt-4 text-center">
              <div className="text-[9px] text-slate-500 uppercase mb-1">⏳ Próximo envío en</div>
              <div className="text-4xl font-black text-purple-400 font-mono tabular-nums">{countdown}s</div>
              <div className="h-1 bg-slate-900 rounded-full overflow-hidden mt-2 border border-slate-700">
                <div
                  className="h-full bg-purple-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${((delaySeg - countdown) / delaySeg) * 100}%` }}
                />
              </div>
            </div>
          )}
          {fase === 'enviando' && pausado && (
            <div className="mt-4 text-center py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="text-sm font-bold text-amber-400">⏸️ Pausado</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Toca ▶️ Continuar para retomar</div>
            </div>
          )}
          {fase === 'enviando' && enviandoAhora && (
            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-purple-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Encolando en el bot…
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
              <div className="text-lg font-black text-emerald-400">{enviados}</div>
              <div className="text-[9px] text-slate-500 uppercase">✅ Enviados</div>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-center">
              <div className="text-lg font-black text-amber-400">{pendientes}</div>
              <div className="text-[9px] text-slate-500 uppercase">⏳ Pendientes</div>
            </div>
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-center">
              <div className="text-lg font-black text-red-400">{fallidos}</div>
              <div className="text-[9px] text-slate-500 uppercase">❌ Fallidos</div>
            </div>
          </div>

          {/* Controles */}
          {fase === 'enviando' ? (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={togglePausa}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  pausado
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-500/90 hover:bg-amber-500 text-white'
                }`}
              >
                {pausado ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {pausado ? 'Continuar' : 'Pausar'}
              </button>
              <button
                onClick={detener}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 transition-all active:scale-95"
              >
                <StopCircle className="w-4 h-4" />
                Detener
              </button>
            </div>
          ) : (
            <button
              onClick={reiniciar}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Nuevo broadcast
            </button>
          )}
        </div>

        <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-3">
          <div className="flex items-start gap-2">
            <Bot className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Los mensajes ya encolados salen aunque cierres la app — el bot (rudy-bot en Termux) los envía
              a su propio ritmo. Verifica en Termux que esté conectado antes de confiar un broadcast largo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // PANTALLA DE CONFIGURACIÓN (selección)
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-white leading-tight">Broadcast WhatsApp</h1>
            <p className="text-[11px] text-slate-400">Avisa a todos tus clientes con el bot — uno por uno, sin riesgo de baneo</p>
          </div>
        </div>

        {/* Aviso bot */}
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-purple-500/10 border border-purple-500/25 p-2.5">
          <Bot className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-300 leading-relaxed">
            Requiere el <strong className="text-purple-300">bot de WhatsApp conectado</strong> (rudy-bot en Termux).
            Los envíos van uno por uno con pausa de <strong className="text-purple-300">{delaySeg}s</strong> —
            configurable abajo.
          </p>
        </div>
      </div>

      {/* Cómo funciona el mensaje (plantilla oficial del bot) */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold text-white">El mensaje lo arma el bot 🤖</h2>
        </div>

        <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 space-y-2">
          <div className="flex items-start gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xs shrink-0">🖼️</span>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-white">Con imagen y texto ya listo</div>
              <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                Igual que en la versión 1: el bot envía a cada cliente su
                <strong className="text-emerald-400"> plantilla oficial de inicio de ruta</strong> con la
                <strong className="text-emerald-400"> imagen</strong> incluida, con los datos de cada cliente
                (producto, monto, dirección y tu nombre). Acá solo eliges <strong>a quién</strong> y <strong>con cuánta pausa</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Delay */}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 border border-slate-700 p-3">
          <div className="flex items-center gap-2 min-w-0">
            <Timer className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">Espera entre envíos</div>
              <div className="text-[10px] text-slate-400">20-30s es lo seguro — evita el baneo</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="number"
              min={5}
              max={120}
              value={delaySeg}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 25;
                setDelaySeg(Math.min(120, Math.max(5, v)));
              }}
              className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-xs text-center outline-none focus:border-amber-500"
            />
            <span className="text-[10px] text-slate-400 font-bold">seg</span>
          </div>
        </div>
      </div>

      {/* Selección de clientes */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="p-4 pb-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white">
              Clientes con celular <span className="text-purple-400">({clientesConCel.length})</span>
            </h2>
            <span className="text-[11px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 rounded-full px-2.5 py-0.5">
              {seleccion.size} marcados
            </span>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, distrito o dirección…"
              className="w-full bg-slate-900 text-white text-xs rounded-lg pl-8 pr-3 py-2 border border-slate-700 focus:border-purple-500 outline-none"
            />
          </div>

          {/* Botones rápidos */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={seleccionarTodos}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all active:scale-95"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Seleccionar todos
            </button>
            <button
              onClick={deseleccionarTodos}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all active:scale-95"
            >
              <Square className="w-3.5 h-3.5" />
              Quitar todos
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="max-h-80 overflow-y-auto custom-scrollbar border-t border-slate-700/60">
          {loading ? (
            <div className="p-6 text-center">
              <Loader2 className="w-6 h-6 text-slate-600 mx-auto animate-spin" />
              <p className="text-xs text-slate-400 mt-2">Cargando clientes…</p>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                {clientes.length === 0
                  ? 'No hay clientes en la ruta — importa tu Excel en Mi Ruta'
                  : clientesConCel.length === 0
                  ? 'Ningún cliente tiene celular válido'
                  : 'Nada coincide con la búsqueda'}
              </p>
            </div>
          ) : (
            clientesFiltrados.map((c) => {
              const marcado = seleccion.has(String(c.id));
              const mzsn = direccionIncompleta(c.dir, c.obs);
              return (
                <button
                  key={String(c.id)}
                  onClick={() => toggleCliente(c.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-slate-700/40 ${
                    marcado ? 'bg-purple-500/10' : 'hover:bg-slate-700/30'
                  }`}
                >
                  {marcado ? (
                    <CheckSquare className="w-4.5 h-4.5 text-purple-400 shrink-0" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-slate-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{c.nombre || 'Cliente'}</span>
                      {mzsn && (
                        <span className="px-1.5 py-0.5 rounded bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[8px] font-bold shrink-0">
                          ⚠️ dir.
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {c.dist || 'Sin distrito'} · 📱 {c.cel} · S/ {parseFloat(String(c.cobrar || 0)).toFixed(0)}
                    </div>
                  </div>
                  {marcado && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Botón enviar */}
        <div className="p-4 border-t border-slate-700/60 bg-slate-800">
          <button
            onClick={iniciarBroadcast}
            disabled={seleccion.size === 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-600/25"
          >
            <Send className="w-4 h-4" />
            {seleccion.size > 0 ? `ENVIAR A ${seleccion.size} SELECCIONADO${seleccion.size !== 1 ? 'S' : ''}` : 'Selecciona al menos 1'}
          </button>
          {seleccion.size > 1 && (
            <p className="text-center text-[10px] text-slate-400 mt-2">
              ⏳ Duración aprox: ~{Math.ceil((seleccion.size * delaySeg) / 60)} min con pausa de {delaySeg}s
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
