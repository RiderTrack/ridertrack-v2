// ═══════════════════════════════════════════════════════════
// 🛵 RUTA VIEW - RiderTrack V2
// Pantalla principal de la ruta del día
// Con importar Excel, lista de clientes, botones de pago y control
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  Plus,
  Search,
  Package,
  DollarSign,
  Clock,
  MapPin,
  Phone,
  Trash2,
  Bot,
  Target,
  Camera,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Cliente, encolarAccionBot, _botCel } from '../services/firestore';
import { useClientes } from '../hooks/useClientes';
import { useAuth } from '../hooks/useAuth';

interface RutaViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const RutaView: React.FC<RutaViewProps> = ({ onShowToast }) => {
  const { user, profile } = useAuth();
  const { clientes, loading, stats, cambiarEstado, agregarCliente, eliminarCliente, importarDesdeExcel } = useClientes();

  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendientes' | 'entregados' | 'fallidos'>('todos');
  const [clienteExpandido, setClienteExpandido] = useState<string | number | null>(null);
  const [controlModalId, setControlModalId] = useState<string | number | null>(null);
  const [botModalId, setBotModalId] = useState<string | number | null>(null);
  const [importando, setImportando] = useState(false);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Nuevo cliente manual
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoCel, setNuevoCel] = useState('');
  const [nuevoProd, setNuevoProd] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [nuevoDir, setNuevoDir] = useState('');
  const [nuevoDist, setNuevoDist] = useState('');

  // Filtrar clientes
  const clientesFiltrados = useMemo(() => {
    let filtrados = clientes;

    // Filtro por estado
    if (filtroEstado === 'pendientes') {
      filtrados = filtrados.filter(c => c.st === 'pendiente' || !c.st);
    } else if (filtroEstado === 'entregados') {
      filtrados = filtrados.filter(c =>
        ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st)
      );
    } else if (filtroEstado === 'fallidos') {
      filtrados = filtrados.filter(c =>
        ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'].includes(c.st)
      );
    }

    // Filtro por búsqueda
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtrados = filtrados.filter(c =>
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.cel || '').includes(q) ||
        (c.prod || '').toLowerCase().includes(q) ||
        (c.dist || '').toLowerCase().includes(q)
      );
    }

    return filtrados;
  }, [clientes, filtroEstado, search]);

  // Botones de pago (iguales que RiderTrack Modular)
  const pagosList = [
    ['efectivo', '💵', 'Efectivo'],
    ['yape-rudy', '📲', 'Yape Rudy'],
    ['yape-efectivo', '💜', 'Yape+Ef.'],
    ['yape-plin', '📲', 'Yape/Plin'],
    ['transferencia', '🏦', 'Transfer.'],
    ['pos', '💳', 'POS'],
    ['pago-link', '🔗', 'Pago Link'],
    ['jose-smith', '🤝', 'J.Smith'],
    ['cambio', '💱', 'Cambio'],
    ['mixto', '🔀', 'Mixto'],
    ['empresa', '🏪', 'Empresa'],
  ];

  const estadosFallidos = [
    ['fallida', '❌', 'Fallida'],
    ['reprogramar', '🔄', 'Reprog.'],
    ['rechazado', '🚫', 'Rechazado'],
    ['ausente', '🚶', 'Ausente'],
    ['no-contesta', '📵', 'N.Cont.'],
    ['cancelado', '✖', 'Cancelado'],
  ];

  // Obtener clase de color según estado
  const getEstadoClase = (st: string) => {
    if (!st || st === 'pendiente') return 'border-l-amber-500 bg-amber-500/5';
    if (['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(st))
      return 'border-l-emerald-500 bg-emerald-500/5';
    if (['fallida', 'rechazado', 'cancelado'].includes(st)) return 'border-l-red-500 bg-red-500/5';
    if (st === 'reprogramar') return 'border-l-blue-500 bg-blue-500/5';
    return 'border-l-slate-500';
  };

  const getEstadoTexto = (st: string) => {
    if (!st || st === 'pendiente') return '⏳ Pendiente';
    const found = pagosList.find(p => p[0] === st);
    if (found) return `${found[1]} ${found[2]}`;
    const failed = estadosFallidos.find(e => e[0] === st);
    if (failed) return `${failed[1]} ${failed[2]}`;
    return st;
  };

  // Importar Excel
  const handleImportarExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportando(true);
    try {
      const cantidad = await importarDesdeExcel(file);
      onShowToast?.('Excel importado', `${cantidad} clientes cargados`, 'success');
    } catch (err: any) {
      onShowToast?.('Error', err.message || 'No se pudo importar', 'error');
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Agregar cliente manual
  const handleAgregar = () => {
    if (!nuevoNombre.trim()) {
      onShowToast?.('Falta nombre', 'Ingresa el nombre del cliente', 'warning');
      return;
    }
    const num = clientes.length > 0 ? Math.max(...clientes.map(c => c.num || 0)) + 1 : 1;
    agregarCliente({
      id: Date.now(),
      num,
      nombre: nuevoNombre.trim(),
      cel: nuevoCel.trim(),
      prod: nuevoProd.trim(),
      precio: parseFloat(nuevoMonto) || 0,
      cobrar: parseFloat(nuevoMonto) || 0,
      dir: nuevoDir.trim(),
      dist: nuevoDist.trim(),
      obs: '',
      st: 'pendiente',
      mEf: 0, mYp: 0, mEmp: 0, mVt: 0, mEM: '', hora: '', nota: '',
    });
    setNuevoNombre(''); setNuevoCel(''); setNuevoProd('');
    setNuevoMonto(''); setNuevoDir(''); setNuevoDist('');
    setMostrarAgregar(false);
    onShowToast?.('Cliente agregado', nuevoNombre, 'success');
  };

  // Botón de WhatsApp (abre wa.me)
  const abrirWhatsApp = (cliente: Cliente) => {
    const cel = String(cliente.cel || '').replace(/\D/g, '');
    const telCompleto = cel.length === 9 ? `51${cel}` : cel;
    window.open(`https://wa.me/${telCompleto}`, '_blank');
  };

  // 🤖 Enviar acción al bot de Baileys vía Firestore
  const enviarAccionBot = async (cliente: Cliente, tipo: string, extra?: Record<string, any>) => {
    if (!user) {
      onShowToast?.('Error', 'No hay sesión activa', 'error');
      return;
    }

    const telefono = _botCel(cliente.cel || '');
    if (!telefono) {
      onShowToast?.('Sin celular', `${cliente.nombre} no tiene celular válido`, 'warning');
      return;
    }

    try {
      await encolarAccionBot(user.uid, {
        tipo: tipo,
        clienteId: cliente.id,
        telefono: telefono,
        nombre: cliente.nombre || 'Cliente',
        prod: cliente.prod || '',
        cobrar: parseFloat(String(cliente.cobrar || 0)),
        dir: cliente.dir || '',
        dist: cliente.dist || '',
        st: cliente.st || 'pendiente',
        rider: {
          nombre: profile?.nombre || 'Rudy',
          telefono: profile?.email || '',
          empresa: 'MATE',
        },
        ...extra,
      });
      onShowToast?.('🤖 Bot', `Acción enviada: ${tipo}`, 'success');
    } catch (e: any) {
      onShowToast?.('Error', e.message || 'No se pudo enviar', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-slate-400">Cargando clientes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-12">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportarExcel}
        accept=".xlsx,.xls"
        className="hidden"
      />

      {/* Header con stats - Mobile optimized */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
              Mi Ruta
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
              {new Date().toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })} · {stats.total} clientes
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importando}
              className="flex items-center gap-1 px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              {importando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Excel</span>
            </button>
            <button
              onClick={() => setMostrarAgregar(!mostrarAgregar)}
              className="flex items-center gap-1 px-2.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[11px] font-bold transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stats rápidas - 4 columnas en móvil */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/50 text-center">
            <div className="text-[9px] text-slate-500 uppercase">Total</div>
            <div className="text-sm font-black text-white">{stats.total}</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="text-[9px] text-emerald-400/70 uppercase">Entreg</div>
            <div className="text-sm font-black text-emerald-400">{stats.entregados}</div>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <div className="text-[9px] text-amber-400/70 uppercase">Pend</div>
            <div className="text-sm font-black text-amber-400">{stats.pendientes}</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
            <div className="text-[9px] text-blue-400/70 uppercase">S/</div>
            <div className="text-sm font-black text-blue-400">{stats.cobrado.toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* Formulario agregar manual */}
      {mostrarAgregar && (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Agregar Cliente Manual</h3>
            <button onClick={() => setMostrarAgregar(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nombre *" className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none" />
            <input value={nuevoCel} onChange={e => setNuevoCel(e.target.value)} placeholder="Celular" className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none" />
            <input value={nuevoProd} onChange={e => setNuevoProd(e.target.value)} placeholder="Producto" className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none" />
            <input value={nuevoMonto} onChange={e => setNuevoMonto(e.target.value)} type="number" placeholder="Monto S/" className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none" />
            <input value={nuevoDir} onChange={e => setNuevoDir(e.target.value)} placeholder="Dirección" className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none" />
            <input value={nuevoDist} onChange={e => setNuevoDist(e.target.value)} placeholder="Distrito" className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none" />
          </div>
          <button onClick={handleAgregar} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold">
            ✅ Agregar Cliente
          </button>
        </div>
      )}

      {/* Buscador y filtros - Mobile optimized */}
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-slate-800 text-white text-xs rounded-lg pl-8 pr-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'todos', label: 'Todos', count: stats.total },
            { id: 'pendientes', label: 'Pend', count: stats.pendientes },
            { id: 'entregados', label: 'Entreg', count: stats.entregados },
            { id: 'fallidos', label: 'Fall', count: stats.fallidos },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFiltroEstado(tab.id as any)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                filtroEstado === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Lista de clientes */}
      {clientesFiltrados.length === 0 ? (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-8 text-center">
          <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">
            {clientes.length === 0
              ? 'No hay clientes. Importá tu Excel para empezar.'
              : 'No se encontraron clientes con ese filtro.'}
          </p>
          {clientes.length === 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
            >
              📂 Importar Excel
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {clientesFiltrados.map((c, idx) => {
            const expandido = clienteExpandido === c.id;
            return (
              <div
                key={c.id}
                className={`rounded-lg border-l-4 ${getEstadoClase(c.st)} bg-slate-800 border-y border-r border-slate-700 overflow-hidden`}
              >
                {/* Fila principal - Mobile optimized */}
                <div
                  className="flex items-center gap-2 p-2 cursor-pointer"
                  onClick={() => setClienteExpandido(expandido ? null : c.id)}
                >
                  {/* Número de posición */}
                  <div className="w-7 h-7 rounded-md bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0">
                    {c.num || idx + 1}
                  </div>

                  {/* Info del cliente */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{c.nombre || 'Cliente'}</span>
                      {c.hora && <span className="text-[9px] text-slate-500">{c.hora}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {c.prod && <span className="text-[10px] text-slate-400 truncate">{c.prod}</span>}
                      {c.dist && <span className="text-[10px] text-slate-500">· {c.dist}</span>}
                    </div>
                  </div>

                  {/* Monto */}
                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-emerald-400">S/ {parseFloat(String(c.cobrar || 0)).toFixed(0)}</div>
                    <div className="text-[9px] text-slate-500">{getEstadoTexto(c.st)}</div>
                  </div>

                  {/* Botón expandir */}
                  <div className="text-slate-400 shrink-0">
                    {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* Panel expandido */}
                {expandido && (
                  <div className="px-2 pb-2 space-y-2 border-t border-slate-700/50 pt-2">
                    {/* Datos del cliente */}
                    <div className="grid grid-cols-1 gap-1 text-[11px]">
                      {c.dir && (
                        <div className="text-slate-400">
                          <span className="text-slate-500">📍</span> <span className="text-slate-300">{c.dir}</span>
                        </div>
                      )}
                      {c.cel && (
                        <div className="text-slate-400">
                          <span className="text-slate-500">📱</span> <span className="text-slate-300">{c.cel}</span>
                        </div>
                      )}
                      {c.obs && (
                        <div className="text-amber-400">
                          <span className="text-slate-500">📝</span> {c.obs}
                        </div>
                      )}
                    </div>

                    {/* Botones de pago - SIEMPRE visibles */}
                    <div>
                        <div className="text-[9px] text-slate-500 uppercase mb-1">Pago</div>
                        <div className="grid grid-cols-3 gap-1">
                          {pagosList.map(([id, emoji, label]) => (
                            <button
                              key={id}
                              onClick={() => {
                                cambiarEstado(c.id, id);
                                onShowToast?.('Pago registrado', `${c.nombre}: ${label}`, 'success');
                              }}
                              className={`px-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all active:scale-95 ${
                                id === 'efectivo' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : id === 'yape-rudy' || id === 'yape-efectivo' || id === 'yape-plin' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                              }`}
                            >
                              {emoji} {label}
                            </button>
                          ))}
                        </div>

                        {/* Estados fallidos */}
                        <div className="text-[9px] text-slate-500 uppercase mt-1.5 mb-1">No entregado</div>
                        <div className="grid grid-cols-3 gap-1">
                          {estadosFallidos.map(([id, emoji, label]) => (
                            <button
                              key={id}
                              onClick={() => {
                                cambiarEstado(c.id, id);
                                onShowToast?.('Estado actualizado', `${c.nombre}: ${label}`, 'warning');
                              }}
                              className="px-1.5 py-1.5 rounded-md text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 transition-all active:scale-95"
                            >
                              {emoji} {label}
                            </button>
                          ))}
                        </div>
                      </div>

                    {/* Botones de acción */}
                    <div className="flex gap-1 pt-1">
                      {c.cel && (
                        <>
                          <button
                            onClick={() => setBotModalId(botModalId === c.id ? null : c.id)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold transition-all active:scale-95"
                          >
                            <Bot className="w-3 h-3" />
                            Bot
                          </button>
                          <button
                            onClick={() => abrirWhatsApp(c)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold transition-all active:scale-95"
                          >
                            <MessageSquare className="w-3 h-3" />
                            WA
                          </button>
                          <button
                            onClick={() => setControlModalId(controlModalId === c.id ? null : c.id)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[10px] font-bold transition-all active:scale-95"
                          >
                            <Target className="w-3 h-3" />
                            Control
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('¿Eliminar?')) {
                            eliminarCliente(c.id);
                            onShowToast?.('Eliminado', c.nombre, 'info');
                          }
                        }}
                        className="flex items-center px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md border border-red-500/20 transition-all active:scale-95 ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Modal de Bot 🤖 */}
                    {botModalId === c.id && (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setBotModalId(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-sm space-y-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-bold text-white">🤖 Acciones del Bot</h3>
                            <button onClick={() => setBotModalId(null)} className="text-slate-400 hover:text-white">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-400 mb-2">
                            Cliente: <span className="text-white font-bold">{c.nombre}</span> · 📱 {c.cel}
                          </div>

                          {/* Grid de acciones rápidas */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={async () => {
                                onShowToast?.('📲 QR', 'Enviando QR de Yape...', 'info');
                                await enviarAccionBot(c, 'yape_qr');
                                setBotModalId(null);
                              }}
                              className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[11px] font-bold transition-all"
                            >
                              <span className="text-lg">📲</span>
                              QR Yape
                            </button>

                            <button
                              onClick={async () => {
                                onShowToast?.('🏦 Banco', 'Enviando cuentas bancarias...', 'info');
                                await enviarAccionBot(c, 'cuentas_banco');
                                setBotModalId(null);
                              }}
                              className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[11px] font-bold transition-all"
                            >
                              <span className="text-lg">🏦</span>
                              Cuentas
                            </button>

                            <button
                              onClick={async () => {
                                onShowToast?.('💰 Pago', 'Enviando monto a pagar...', 'info');
                                await enviarAccionBot(c, 'cuanto_pagar');
                                setBotModalId(null);
                              }}
                              className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold transition-all"
                            >
                              <span className="text-lg">💰</span>
                              ¿Cuánto pago?
                            </button>

                            <button
                              onClick={async () => {
                                onShowToast?.('🚚 ETA', 'Enviando hora de llegada...', 'info');
                                await enviarAccionBot(c, 'hora_llegada');
                                setBotModalId(null);
                              }}
                              className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[11px] font-bold transition-all"
                            >
                              <span className="text-lg">🚚</span>
                              ¿A qué hora?
                            </button>

                            <button
                              onClick={async () => {
                                onShowToast?.('📦 Pedido', 'Enviando info del producto...', 'info');
                                await enviarAccionBot(c, 'que_me_traen');
                                setBotModalId(null);
                              }}
                              className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold transition-all"
                            >
                              <span className="text-lg">📦</span>
                              ¿Qué me traen?
                            </button>

                            <button
                              onClick={async () => {
                                onShowToast?.('✅ Pago', 'Confirmando pago recibido...', 'info');
                                await enviarAccionBot(c, 'ya_pague');
                                setBotModalId(null);
                              }}
                              className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-[11px] font-bold transition-all"
                            >
                              <span className="text-lg">✅</span>
                              Ya pagué
                            </button>

                            <button
                              onClick={async () => {
                                onShowToast?.('🤝 Motorizado', 'Avisando que el motorizado llamará...', 'info');
                                await enviarAccionBot(c, 'hablar_motorizado');
                                setBotModalId(null);
                              }}
                              className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[11px] font-bold transition-all"
                            >
                              <span className="text-lg">🤝</span>
                              Hablar moto
                            </button>

                            <button
                              onClick={async () => {
                                onShowToast?.('📅 Reprog', 'Enviando opción de reprogramar...', 'info');
                                await enviarAccionBot(c, 'no_puedo_recibir');
                                setBotModalId(null);
                              }}
                              className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[11px] font-bold transition-all"
                            >
                              <span className="text-lg">📅</span>
                              No puedo recibir
                            </button>
                          </div>

                          {/* Botón de menú completo */}
                          <button
                            onClick={async () => {
                              onShowToast?.('📋 Menú', 'Enviando menú completo...', 'info');
                              await enviarAccionBot(c, 'menu');
                              setBotModalId(null);
                            }}
                            className="w-full mt-2 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold transition-all"
                          >
                            <span className="text-base">📋</span>
                            Enviar menú completo
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Modal de Control */}
                    {controlModalId === c.id && (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setControlModalId(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-bold text-white">🎯 Control de mensajes</h3>
                            <button onClick={() => setControlModalId(null)} className="text-slate-400 hover:text-white">
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="text-xs text-slate-400 mb-3">
                            Cliente: <span className="text-white font-bold">{c.nombre}</span>
                          </div>

                          {/* Opciones de Control */}
                          <div className="space-y-2">
                            <button
                              onClick={async () => {
                                onShowToast?.('🤖 Bot', 'Enviando aviso de entrega con imagen...', 'info');
                                await enviarAccionBot(c, 'avisar_entrega', {
                                  enviar_imagen: true,
                                  modo_entrega: 'auto_imagen',
                                });
                                setControlModalId(null);
                              }}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold transition-all"
                            >
                              <span className="text-lg">📷</span>
                              <div className="text-left">
                                <div>Con imagen</div>
                                <div className="text-[10px] text-slate-500">Manda "gracias por tu compra" con imagen</div>
                              </div>
                            </button>

                            <button
                              onClick={async () => {
                                onShowToast?.('📝 Texto', 'Enviando aviso de entrega (solo texto)...', 'info');
                                await enviarAccionBot(c, 'avisar_entrega', {
                                  enviar_imagen: false,
                                  modo_entrega: 'auto_texto',
                                });
                                setControlModalId(null);
                              }}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold transition-all"
                            >
                              <span className="text-lg">📝</span>
                              <div className="text-left">
                                <div>Solo texto</div>
                                <div className="text-[10px] text-slate-500">Manda "gracias por tu compra" sin imagen</div>
                              </div>
                            </button>

                            <button
                              onClick={async () => {
                                const minutos = prompt('¿En cuántos minutos llegás?', '15');
                                if (!minutos) return;
                                onShowToast?.('⏱️ Avisar llegada', `Enviando aviso: ${minutos} minutos`, 'info');
                                await enviarAccionBot(c, 'avisar_siguiente', {
                                  minutos: parseInt(minutos),
                                });
                                setControlModalId(null);
                              }}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-bold transition-all"
                            >
                              <span className="text-lg">⏱️</span>
                              <div className="text-left">
                                <div>Avisar llegada</div>
                                <div className="text-[10px] text-slate-500">Avisa en cuántos minutos llegás</div>
                              </div>
                            </button>

                            <button
                              onClick={async () => {
                                onShowToast?.('📍 Ubicación', 'Enviando solicitud de ubicación...', 'info');
                                await enviarAccionBot(c, 'solicitar_ubicacion');
                                setControlModalId(null);
                              }}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm font-bold transition-all"
                            >
                              <span className="text-lg">📍</span>
                              <div className="text-left">
                                <div>Solicitar ubicación</div>
                                <div className="text-[10px] text-slate-500">Pide al cliente su ubicación actual</div>
                              </div>
                            </button>

                            <button
                              onClick={async () => {
                                onShowToast?.('📢 Info empresa', 'Enviando pedido de info a empresa...', 'info');
                                await enviarAccionBot(c, 'pedir_info_empresa');
                                setControlModalId(null);
                              }}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-bold transition-all"
                            >
                              <span className="text-lg">📢</span>
                              <div className="text-left">
                                <div>Pedir info a empresa</div>
                                <div className="text-[10px] text-slate-500">Solicita información del pedido a la empresa</div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen del día */}
      {clientes.length > 0 && (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Total</div>
              <div className="text-sm font-black text-white">S/ {stats.totalDia.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-[9px] text-emerald-400/70 uppercase">Cobrado</div>
              <div className="text-sm font-black text-emerald-400">S/ {stats.cobrado.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-[9px] text-amber-400/70 uppercase">Por Cobrar</div>
              <div className="text-sm font-black text-amber-400">S/ {stats.porCobrar.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Progreso</div>
              <div className="text-sm font-black text-white">
                {stats.total > 0 ? Math.round((stats.entregados / stats.total) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
