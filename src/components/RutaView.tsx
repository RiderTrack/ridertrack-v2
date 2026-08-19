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
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Cliente } from '../services/firestore';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-slate-400">Cargando clientes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportarExcel}
        accept=".xlsx,.xls"
        className="hidden"
      />

      {/* Header con stats */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <MapPin className="w-6 h-6 text-emerald-400" />
              Mi Ruta de Hoy
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })} · {stats.total} clientes
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importando}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="hidden sm:inline">Importar Excel</span>
              <span className="sm:hidden">Excel</span>
            </button>
            <button
              onClick={() => setMostrarAgregar(!mostrarAgregar)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Agregar</span>
            </button>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/50">
            <div className="text-[10px] text-slate-500 uppercase">Total</div>
            <div className="text-lg font-black text-white">{stats.total}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-[10px] text-emerald-400/70 uppercase">Entregados</div>
            <div className="text-lg font-black text-emerald-400">{stats.entregados}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="text-[10px] text-amber-400/70 uppercase">Pendientes</div>
            <div className="text-lg font-black text-amber-400">{stats.pendientes}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="text-[10px] text-blue-400/70 uppercase">Cobrado</div>
            <div className="text-lg font-black text-blue-400">S/ {stats.cobrado.toFixed(2)}</div>
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

      {/* Buscador y filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, producto, distrito..."
            className="w-full bg-slate-800 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 border border-slate-700 focus:border-emerald-500 outline-none"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: 'todos', label: 'Todos', count: stats.total },
            { id: 'pendientes', label: 'Pendientes', count: stats.pendientes },
            { id: 'entregados', label: 'Entregados', count: stats.entregados },
            { id: 'fallidos', label: 'Fallidos', count: stats.fallidos },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFiltroEstado(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
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
                className={`rounded-xl border-l-4 ${getEstadoClase(c.st)} bg-slate-800 border-y border-r border-slate-700 overflow-hidden`}
              >
                {/* Fila principal */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setClienteExpandido(expandido ? null : c.id)}
                >
                  {/* Número de posición */}
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                    {c.num || idx + 1}
                  </div>

                  {/* Info del cliente */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">{c.nombre || 'Cliente'}</span>
                      {c.hora && <span className="text-[10px] text-slate-500">🕐 {c.hora}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.prod && <span className="text-[11px] text-slate-400 truncate">📦 {c.prod}</span>}
                      {c.dist && <span className="text-[11px] text-slate-500">· 📍 {c.dist}</span>}
                    </div>
                  </div>

                  {/* Monto */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-emerald-400">S/ {parseFloat(String(c.cobrar || 0)).toFixed(2)}</div>
                    <div className="text-[10px] text-slate-500">{getEstadoTexto(c.st)}</div>
                  </div>

                  {/* Botón expandir */}
                  <button className="text-slate-400 shrink-0">
                    {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Panel expandido */}
                {expandido && (
                  <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50 pt-3">
                    {/* Datos del cliente */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {c.dir && (
                        <div className="text-slate-400">
                          <span className="text-slate-500">📍 Dirección:</span>
                          <div className="text-slate-300">{c.dir}</div>
                        </div>
                      )}
                      {c.cel && (
                        <div className="text-slate-400">
                          <span className="text-slate-500">📱 Celular:</span>
                          <div className="text-slate-300">{c.cel}</div>
                        </div>
                      )}
                      {c.obs && (
                        <div className="text-slate-400 col-span-2">
                          <span className="text-slate-500">📝 Obs:</span>
                          <div className="text-amber-400">{c.obs}</div>
                        </div>
                      )}
                    </div>

                    {/* Botones de pago */}
                    {(c.st === 'pendiente' || !c.st) && (
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase mb-1.5">Forma de pago</div>
                        <div className="flex flex-wrap gap-1.5">
                          {pagosList.map(([id, emoji, label]) => (
                            <button
                              key={id}
                              onClick={() => {
                                cambiarEstado(c.id, id);
                                onShowToast?.('Pago registrado', `${c.nombre}: ${label}`, 'success');
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                                id === 'efectivo' ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                                : id === 'yape-rudy' || id === 'yape-efectivo' || id === 'yape-plin' ? 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30'
                                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                              }`}
                            >
                              {emoji} {label}
                            </button>
                          ))}
                        </div>

                        {/* Estados fallidos */}
                        <div className="text-[10px] text-slate-500 uppercase mt-2.5 mb-1.5">No entregado</div>
                        <div className="flex flex-wrap gap-1.5">
                          {estadosFallidos.map(([id, emoji, label]) => (
                            <button
                              key={id}
                              onClick={() => {
                                cambiarEstado(c.id, id);
                                onShowToast?.('Estado actualizado', `${c.nombre}: ${label}`, 'warning');
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all active:scale-95"
                            >
                              {emoji} {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex gap-1.5 pt-1">
                      {c.cel && (
                        <button
                          onClick={() => abrirWhatsApp(c)}
                          className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          WhatsApp
                        </button>
                      )}
                      <button
                        onClick={() => onShowToast?.('🎯 Control', 'Próximamente: Control de mensajes', 'info')}
                        className="flex items-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                      >
                        <Target className="w-3.5 h-3.5" />
                        Control
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('¿Eliminar este cliente?')) {
                            eliminarCliente(c.id);
                            onShowToast?.('Cliente eliminado', c.nombre, 'info');
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold border border-red-500/20 transition-all active:scale-95 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen del día */}
      {clientes.length > 0 && (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Total Día</div>
              <div className="text-lg font-black text-white">S/ {stats.totalDia.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] text-emerald-400/70 uppercase">Cobrado</div>
              <div className="text-lg font-black text-emerald-400">S/ {stats.cobrado.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] text-amber-400/70 uppercase">Por Cobrar</div>
              <div className="text-lg font-black text-amber-400">S/ {stats.porCobrar.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Progreso</div>
              <div className="text-lg font-black text-white">
                {stats.total > 0 ? Math.round((stats.entregados / stats.total) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
