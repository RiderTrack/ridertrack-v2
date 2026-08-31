// ═══════════════════════════════════════════════════════════
// 📢 BroadcastModal — envío masivo con plantillas (Fase 3.15)
// Toma los clientes de la RUTA ACTIVA del panel, elige una
// plantilla APROBADA por Meta, delay anti-baneo y progreso en
// vivo. Cada envío queda guardado en el chat del cliente.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Rocket,
  Clock,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { Cliente } from '../../services/firestore';
import {
  ClienteBroadcast,
  CredencialRiderChat,
  PLANTILLAS_APROBADAS,
  PlantillaMeta,
  clientesParaBroadcast,
  enviarPlantillaMeta,
  normalizarTelefono,
} from '../../services/riderChatApi';
import { sendMessageToFirestore, updateMessageMetaId } from '../../services/riderChatFirestore';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CredencialRiderChat;
  /** Clientes de la ruta activa (vienen de useClientes en App) */
  clientes: Cliente[];
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

interface EnvioEstado {
  telefono: string;
  estado: 'pendiente' | 'enviando' | 'enviado' | 'fallido';
  error?: string;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  isOpen,
  onClose,
  config,
  clientes,
  onShowToast,
}) => {
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaMeta>(PLANTILLAS_APROBADAS[0]);
  const [delay, setDelay] = useState<number>(30);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [mostrarClientes, setMostrarClientes] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [estadosEnvio, setEstadosEnvio] = useState<Record<string, EnvioEstado>>({});
  const [progreso, setProgreso] = useState({ enviados: 0, fallidos: 0, total: 0 });
  const cancelarRef = useRef(false);

  const modoDemo = !config.phoneNumberId || !config.token;

  // Clientes de la ruta con teléfono válido, ordenados por entrega
  const clientesRuta: ClienteBroadcast[] = useMemo(
    () => clientesParaBroadcast(clientes),
    [clientes]
  );

  // Seleccionar todos al abrir
  useEffect(() => {
    if (!isOpen) return;
    const nuevos = new Set<string>();
    clientesRuta.forEach((c) => {
      if (c.cel) nuevos.add(c.cel);
    });
    setSeleccionados(nuevos);
  }, [isOpen, clientesRuta]);

  // Reset al cerrar
  useEffect(() => {
    if (!isOpen) {
      setEstadosEnvio({});
      setProgreso({ enviados: 0, fallidos: 0, total: 0 });
      setEnviando(false);
      cancelarRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSeleccion = (tel: string) => {
    if (enviando) return;
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(tel)) nuevo.delete(tel);
      else nuevo.add(tel);
      return nuevo;
    });
  };

  const seleccionarTodos = () => {
    if (enviando) return;
    const todos = new Set<string>();
    clientesRuta.forEach((c) => {
      if (c.cel) todos.add(c.cel);
    });
    setSeleccionados(todos);
  };

  const deseleccionarTodos = () => {
    if (enviando) return;
    setSeleccionados(new Set());
  };

  const iniciarBroadcast = async () => {
    if (seleccionados.size === 0 || enviando) return;
    setEnviando(true);
    cancelarRef.current = false;
    const total = seleccionados.size;
    setProgreso({ enviados: 0, fallidos: 0, total });

    const estadosIniciales: Record<string, EnvioEstado> = {};
    seleccionados.forEach((tel) => {
      estadosIniciales[tel] = { telefono: tel, estado: 'pendiente' };
    });
    setEstadosEnvio(estadosIniciales);

    let enviados = 0;
    let fallidos = 0;

    for (const tel of Array.from<string>(seleccionados)) {
      if (cancelarRef.current) break;

      setEstadosEnvio((prev) => ({
        ...prev,
        [tel]: { telefono: tel, estado: 'enviando' },
      }));

      // Datos del cliente (posición en la ruta para las plantillas)
      const idx = clientesRuta.findIndex((c) => normalizarTelefono(c.cel) === normalizarTelefono(tel));
      const clienteActual = idx >= 0 ? clientesRuta[idx] : undefined;
      const posicion = idx + 1;

      const resultado = await enviarPlantillaMeta(
        config,
        tel,
        plantillaSeleccionada,
        clienteActual,
        { posicion, total: clientesRuta.length }
      );

      if (resultado.success) {
        enviados++;
        // Guardar en el chat del cliente para que quede el historial
        if (resultado.messageId) {
          try {
            const firestoreMsgId = await sendMessageToFirestore(tel, {
              direction: 'sent',
              text: `${plantillaSeleccionada.emoji} ${plantillaSeleccionada.label} (plantilla${modoDemo ? ' demo' : ' broadcast'})`,
              status: 'sent',
              timestamp: Date.now(),
              senderId: 'broadcast',
              templateName: plantillaSeleccionada.name,
            });
            await updateMessageMetaId(tel, firestoreMsgId, resultado.messageId);
          } catch (e) {
            console.warn('[RiderChat] guardando broadcast:', e);
          }
        }
        setEstadosEnvio((prev) => ({ ...prev, [tel]: { telefono: tel, estado: 'enviado' } }));
      } else {
        fallidos++;
        setEstadosEnvio((prev) => ({
          ...prev,
          [tel]: { telefono: tel, estado: 'fallido', error: resultado.error },
        }));
      }

      setProgreso({ enviados, fallidos, total });

      // Delay anti-baneo antes del siguiente
      if (!cancelarRef.current && enviados + fallidos < total) {
        await new Promise((r) => setTimeout(r, delay * 1000));
      }
    }

    setEnviando(false);
    onShowToast?.(
      fallidos === 0 ? '📢 Broadcast listo' : '📢 Broadcast terminado',
      `${enviados} enviados${fallidos > 0 ? `, ${fallidos} fallidos` : ''}${modoDemo ? ' (modo demo)' : ''}`,
      fallidos === 0 ? 'success' : 'warning'
    );
  };

  const cancelarBroadcast = () => {
    cancelarRef.current = true;
    setEnviando(false);
  };

  const porcentaje =
    progreso.total > 0 ? Math.round(((progreso.enviados + progreso.fallidos) / progreso.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[2050] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Broadcast con Plantillas</h2>
              <p className="text-xs text-white/80">
                Envío masivo anti-baneo por el canal oficial {modoDemo ? '(MODO DEMO)' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            disabled={enviando}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Ruta activa */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm text-slate-200">Ruta activa de hoy</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-emerald-500/15 text-emerald-300 rounded-full">
                {clientesRuta.length} clientes
              </span>
            </div>
            {clientesRuta.length === 0 && (
              <p className="text-xs text-amber-400 mt-2">
                No hay clientes con celular válido en la ruta activa. Carga tu Excel en Mi Ruta primero.
              </p>
            )}
          </div>

          {/* Plantilla */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wide">
              Plantilla aprobada por Meta
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PLANTILLAS_APROBADAS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setPlantillaSeleccionada(p)}
                  disabled={enviando}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    plantillaSeleccionada.name === p.name
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  } ${enviando ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{p.emoji}</span>
                    <span className="font-bold text-sm text-slate-100">{p.label}</span>
                    {plantillaSeleccionada.name === p.name && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{p.descripcion}</p>
                  <p className="text-[10px] text-emerald-400 mt-1 font-mono">{p.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Delay anti-baneo */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wide">
              Delay entre mensajes (anti-baneo)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDelay(d)}
                  disabled={enviando}
                  className={`p-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                    delay === d
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  } ${enviando ? 'opacity-50' : ''}`}
                >
                  {d}s
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Recomendado: 30s para evitar bloqueos de Meta
            </p>
          </div>

          {/* Selección de clientes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setMostrarClientes(!mostrarClientes)}
                className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wide"
              >
                {mostrarClientes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Clientes ({seleccionados.size}/{clientesRuta.length})
              </button>
              <div className="flex gap-1.5">
                <button
                  onClick={seleccionarTodos}
                  disabled={enviando || clientesRuta.length === 0}
                  className="text-[11px] px-2.5 py-1 bg-emerald-500/15 text-emerald-300 rounded-lg font-semibold hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  Todos
                </button>
                <button
                  onClick={deseleccionarTodos}
                  disabled={enviando}
                  className="text-[11px] px-2.5 py-1 bg-slate-800 text-slate-400 rounded-lg font-semibold hover:bg-slate-700 disabled:opacity-50"
                >
                  Ninguno
                </button>
              </div>
            </div>

            {mostrarClientes && (
              <div className="max-h-64 overflow-y-auto border border-slate-700 rounded-xl divide-y divide-slate-800">
                {clientesRuta.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">No hay clientes en la ruta</div>
                ) : (
                  clientesRuta.map((c, i) => {
                    const tel = normalizarTelefono(c.cel);
                    const isSelected = seleccionados.has(tel);
                    const estado = estadosEnvio[tel];
                    return (
                      <div
                        key={`${c.id}-${tel}`}
                        className={`flex items-center gap-3 p-2.5 cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-500/5' : 'hover:bg-slate-800/40'
                        } ${enviando ? 'cursor-not-allowed' : ''}`}
                        onClick={() => toggleSeleccion(tel)}
                      >
                        <div className="shrink-0">
                          {estado?.estado === 'enviado' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : estado?.estado === 'enviando' ? (
                            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                          ) : estado?.estado === 'fallido' ? (
                            <AlertCircle className="w-5 h-5 text-red-400" />
                          ) : isSelected ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-500">{i + 1}.</span>
                            <span className="text-sm font-semibold text-slate-100 truncate">
                              {c.nombre || 'Cliente'}
                            </span>
                            {c.st && c.st !== 'pendiente' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold shrink-0">
                                {c.st}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>{tel}</span>
                            {c.dir && <span className="truncate">· {String(c.dir).substring(0, 28)}</span>}
                          </div>
                          {estado?.estado === 'fallido' && estado.error && (
                            <div className="text-[11px] text-red-400 mt-1 p-2 bg-red-500/10 rounded-lg border border-red-500/20 break-words">
                              {estado.error}
                            </div>
                          )}
                        </div>
                        {c.cobrar !== undefined && c.cobrar > 0 && (
                          <span className="text-xs font-bold text-emerald-400 shrink-0">
                            S/ {c.cobrar.toFixed(2)}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Progreso */}
          {enviando || progreso.total > 0 ? (
            <div className="bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-300">Progreso del broadcast</span>
                <span className="text-xs font-bold text-blue-300">
                  {progreso.enviados + progreso.fallidos}/{progreso.total}
                </span>
              </div>
              <div className="w-full bg-blue-500/20 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
              <div className="flex items-center gap-4 mt-2 text-[11px]">
                <span className="text-emerald-400">✅ {progreso.enviados} enviados</span>
                <span className="text-red-400">❌ {progreso.fallidos} fallidos</span>
                <span className="text-blue-400">{porcentaje}%</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Pie */}
        <div className="border-t border-slate-800 p-4 flex items-center justify-between gap-3 bg-slate-900">
          <div className="text-xs text-slate-500">
            {seleccionados.size > 0 ? (
              <>
                <span className="font-bold text-slate-300">{seleccionados.size} clientes</span>{' '}
                seleccionados · ~{Math.ceil((seleccionados.size * delay) / 60)} min total
              </>
            ) : (
              'Selecciona al menos 1 cliente'
            )}
          </div>
          <div className="flex gap-2">
            {enviando ? (
              <button
                onClick={cancelarBroadcast}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Detener
              </button>
            ) : (
              <button
                onClick={iniciarBroadcast}
                disabled={seleccionados.size === 0 || clientesRuta.length === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100"
              >
                <Send className="w-4 h-4" />
                Iniciar Broadcast
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
