// ═══════════════════════════════════════════════════════════
// 🛵 RUTA VIEW - RiderTrack V2
// Pantalla principal de la ruta del día
// Con importar Excel, lista de clientes, botones de pago y control
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import { Cliente, encolarAccionBot, _botCel, subirFotoPago, ConfigRuta } from '../services/firestore';
import { useClientes } from '../hooks/useClientes';
import { useAuth } from '../hooks/useAuth';
import { useConfig } from '../hooks/useConfig';
import { FotoEntregaModal } from './FotoEntregaModal';
import { AddressAutocomplete, DireccionElegida } from './AddressAutocomplete';
import { UbicarClienteModal } from './UbicarClienteModal';
import { recordarCoordenadasCliente } from '../services/geocoding';
import { compartirQRWhatsApp } from '../utils/shareQR';
import { Flag, MapPinned } from 'lucide-react';

interface RutaViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const RutaView: React.FC<RutaViewProps> = ({ onShowToast }) => {
  const { user, profile } = useAuth();
  const { clientes, loading, sincronizando, stats, cambiarEstado, agregarCliente, eliminarCliente, importarDesdeExcel, sincronizarDesdeModular, finalizarRutaActual, guardarYCerrarRutaActual, limpiarRuta, optimizarRuta, moverCliente, editarNumeroOrden, actualizarCliente } = useClientes();
  const { config, guardar: guardarConfig } = useConfig();

  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendientes' | 'entregados' | 'fallidos'>('todos');
  const [filtroDistrito, setFiltroDistrito] = useState<string>('');
  const [filtroProducto, setFiltroProducto] = useState<string>('');
  const [clienteExpandido, setClienteExpandido] = useState<string | number | null>(null);
  const [controlModalId, setControlModalId] = useState<string | number | null>(null);
  const [importando, setImportando] = useState(false);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado de optimización en curso (Fase 1.3 — progreso real)
  const [optimizando, setOptimizando] = useState(false);
  const [optimizandoMsg, setOptimizandoMsg] = useState('');

  // 🚩 Inicio y fin de ruta (Fase 1.4)
  const [rutaCardAbierta, setRutaCardAbierta] = useState(false);
  const [guardandoRuta, setGuardandoRuta] = useState(false);

  // 📍 Ubicar cliente manualmente (Fase 1.4)
  const [ubicarClienteId, setUbicarClienteId] = useState<string | number | null>(null);
  const ubicarCliente = ubicarClienteId != null ? clientes.find((c) => c.id === ubicarClienteId) || null : null;

  // Estado para edición del número de orden (input local)
  const [editandoNumId, setEditandoNumId] = useState<string | number | null>(null);
  const [numTemporal, setNumTemporal] = useState('');

  // Estado para modal de foto de entrega
  const [fotoEntregaCliente, setFotoEntregaCliente] = useState<Cliente | null>(null);

  // Estados modal 🤖 Bot (12 botones)
  const [botModalId, setBotModalId] = useState<string | number | null>(null);

  // Estados modal 🚀 Voy en camino (minutos)
  const [llegadaModalId, setLlegadaModalId] = useState<string | number | null>(null);

  // Estados modal 🩷 Chicos de Venta
  const [ventaModalId, setVentaModalId] = useState<string | number | null>(null);

  // Estados modal 🏦 Cuentas de la Empresa
  const [cuentasModalId, setCuentasModalId] = useState<string | number | null>(null);

  // Estados modal 💬 Otros temas a MATE
  const [otrosMateModalId, setOtrosMateModalId] = useState<string | number | null>(null);
  const [otrosMateTexto, setOtrosMateTexto] = useState('');

  // Estados modal 📸 Reportar pago con foto
  const [pagoFotoModalId, setPagoFotoModalId] = useState<string | number | null>(null);
  const [pagoFotoArchivo, setPagoFotoArchivo] = useState<File | null>(null);
  const [pagoFotoPreview, setPagoFotoPreview] = useState<string | null>(null);
  const [pagoFotoMonto, setPagoFotoMonto] = useState('');
  const [pagoFotoMetodo, setPagoFotoMetodo] = useState<'yape' | 'plin' | 'efectivo' | 'transferencia' | 'pos' | 'mixto'>('yape');
  const [pagoFotoSubiendo, setPagoFotoSubiendo] = useState(false);
  const [pagoFotoTipo, setPagoFotoTipo] = useState<'comprobante' | 'entregado' | 'otro'>('comprobante');
  const pagoFotoInputRef = useRef<HTMLInputElement>(null);
  const pagoFotoGaleriaRef = useRef<HTMLInputElement>(null);

  // Estados modal 📤 Enviar reporte a MATE (Modal completo tipo Modular)
  const [reporteMateModalId, setReporteMateModalId] = useState<string | number | null>(null);
  const [mateTab, setMateTab] = useState<'estado' | 'mensaje'>('estado');
  const [mateEstadoSel, setMateEstadoSel] = useState<string>('');
  const [mateReprogramar, setMateReprogramar] = useState<string>('');
  const [mateMinutos, setMateMinutos] = useState<number | null>(null);
  const [mateMinutosCustom, setMateMinutosCustom] = useState('');
  const [matePlantillaSel, setMatePlantillaSel] = useState<string>('');
  const [mateMensaje, setMateMensaje] = useState('');
  const [mateMotivo, setMateMotivo] = useState('');
  const [mateFrases, setMateFrases] = useState<string[]>([]);
  const [mateNuevaFrase, setMateNuevaFrase] = useState('');
  const [mateMostrarAgregarFrase, setMateMostrarAgregarFrase] = useState(false);
  const [matePlantillas, setMatePlantillas] = useState<{ nombre: string; texto: string }[]>([]);
  const [mateMostrarGuardarPlantilla, setMateMostrarGuardarPlantilla] = useState(false);
  const [mateNuevoNombrePlantilla, setMateNuevoNombrePlantilla] = useState('');

  // Plantillas predefinidas (siempre disponibles en el dropdown)
  const PLANTILLAS_PREDEF = [
    { nombre: '📋 Cliente no contesta', texto: 'Cliente no contesta al teléfono ni responde WhatsApp. [motivo]' },
    { nombre: '👤 Cliente ausente', texto: 'El cliente no se encuentra en la dirección indicada. [motivo]' },
    { nombre: '❌ Entrega fallida', texto: 'No se pudo completar la entrega. [motivo]' },
    { nombre: '📦 Producto dañado', texto: 'El producto llegó dañado y el cliente lo rechazó. [motivo]' },
    { nombre: '📦 Producto equivocado', texto: 'El producto entregado no corresponde al pedido. [motivo]' },
    { nombre: '📍 Dirección incorrecta', texto: 'La dirección registrada no existe o es incorrecta. [motivo]' },
    { nombre: '📅 Reprogramar entrega', texto: 'El cliente solicita reprogramar la entrega. [motivo]' },
    { nombre: '💵 Pago parcial', texto: 'El cliente pagó solo una parte. Falta completar el pago. [motivo]' },
    { nombre: '🚫 Cliente rechazó', texto: 'El cliente rechazó el pedido. [motivo]' },
    { nombre: '💬 Cliente requiere atención', texto: 'El cliente solicita atención especial. [motivo]' },
    { nombre: '🔄 Cliente pide cambio', texto: 'El cliente desea cambiar el producto. [motivo]' },
    { nombre: '⏳ Pendiente de confirmar', texto: 'Pendiente de confirmar con el cliente. [motivo]' },
    { nombre: '✅ Entrega exitosa', texto: 'Entrega completada exitosamente. [motivo]' },
    { nombre: '🚀 En camino', texto: 'Rider en camino a la dirección del cliente. [motivo]' },
  ];

  // Cargar plantillas y frases de localStorage al montar
  useEffect(() => {
    if (!user) return;
    try {
      const pls = localStorage.getItem(`mate_plantillas_${user.uid}`);
      if (pls) setMatePlantillas(JSON.parse(pls));
      const frs = localStorage.getItem(`mate_frases_${user.uid}`);
      if (frs) setMateFrases(JSON.parse(frs));
    } catch (e) {
      console.error('Error cargando plantillas MATE:', e);
    }
  }, [user]);

  // Nuevo cliente manual
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoCel, setNuevoCel] = useState('');
  const [nuevoProd, setNuevoProd] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [nuevoDir, setNuevoDir] = useState('');
  const [nuevoDist, setNuevoDist] = useState('');

  // 🚩 Guardar cambios parciales de la config de ruta (inicio/fin)
  const guardarRuta = async (parcial: Partial<ConfigRuta>) => {
    setGuardandoRuta(true);
    try {
      const nuevaRuta = { ...(config?.ruta ?? { inicio: null, fin: null, volverAlInicio: false }), ...parcial };
      await guardarConfig({ ...config, ruta: nuevaRuta });
      onShowToast?.(
        '🚩 Ruta actualizada',
        parcial.inicio ? 'Dirección de inicio guardada' :
        parcial.fin ? 'Dirección de fin guardada' :
        parcial.volverAlInicio !== undefined ? 'Preferencia de regreso guardada' :
        'Dirección quitada',
        'success'
      );
    } catch (e: any) {
      onShowToast?.('❌ Error', 'No se pudo guardar. Revisa tu conexión.', 'error');
    } finally {
      setGuardandoRuta(false);
    }
  };

  // 📍 Guardar la ubicación manual de un cliente (exacta para siempre)
  const guardarUbicacion = (
    clienteId: string | number,
    coords: { lat: number; lng: number; src: 'manual' }
  ) => {
    actualizarCliente(clienteId, { lat: coords.lat, lng: coords.lng, latSrc: 'manual' });
    // Recordarla también en el caché local anti-borrado
    recordarCoordenadasCliente(clienteId, { ...coords, src: 'manual' });
  };

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

    // Filtro por distrito
    if (filtroDistrito) {
      filtrados = filtrados.filter(c => (c.dist || '').toLowerCase().trim() === filtroDistrito.toLowerCase().trim());
    }

    // Filtro por producto
    if (filtroProducto) {
      filtrados = filtrados.filter(c => (c.prod || '').toLowerCase().trim() === filtroProducto.toLowerCase().trim());
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
  }, [clientes, filtroEstado, filtroDistrito, filtroProducto, search]);

  // Listas únicas de distritos y productos para los dropdowns
  const distritosUnicos = useMemo(() => {
    const distritos = clientes.map(c => (c.dist || '').trim()).filter(Boolean);
    return [...new Set(distritos)].sort();
  }, [clientes]);

  const productosUnicos = useMemo(() => {
    const productos = clientes.map(c => (c.prod || '').trim()).filter(Boolean);
    return [...new Set(productos)].sort();
  }, [clientes]);

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

  // 💚 Enviar QR de Plin DIRECTO (Fase 1.6)
  // Comparte la imagen del QR + mensaje por WhatsApp desde el celular.
  // No depende del bot (que aún no tiene el comando Plin) — es el
  // respaldo para cuando Yape se cae o el bot no está corriendo.
  const enviarPlinDirecto = async (cliente: Cliente) => {
    const plin = config.plin;
    const numero = (plin?.telefono || '').replace(/\D/g, '');
    if (!numero || !plin?.nombre) {
      onShowToast?.('💚 Plin sin configurar', 'Configura tu número y QR en "Mis QR" → pestaña 💚 Plin', 'warning');
      return;
    }
    const monto = parseFloat(String(cliente.cobrar || 0)) || 0;
    const lineas = [
      `Hola ${cliente.nombre} 💚`,
      '',
      'Puedes pagarme por *Plin*:',
      `📱 Número: *${numero}*`,
      `👤 Titular: ${plin.nombre}`,
    ];
    if (monto > 0) lineas.push(`💰 Monto: S/ ${monto.toFixed(2)}`);
    lineas.push('', 'Escanea el QR que te adjunto desde la app de tu banco 🙏 ¡Gracias!');

    await compartirQRWhatsApp({
      dataUrl: plin.qrBase64 || '',
      texto: lineas.join('\n'),
      telefono: cliente.cel,
      onShowToast,
    });
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
              {/* Badge de sincronización con Modular */}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[9px] text-emerald-400 font-bold">
                <span className={`w-1.5 h-1.5 rounded-full ${sincronizando ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></span>
                {sincronizando ? 'Sync...' : 'Sync Modular'}
              </span>
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
              onClick={async () => {
                const count = await sincronizarDesdeModular();
                onShowToast?.('🔄 Sincronizado', `${count} clientes sincronizados con el Modular`, 'success');
              }}
              disabled={sincronizando}
              className="flex items-center gap-1 px-2.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50"
              title="Sincronizar con RiderTrack Modular"
            >
              {sincronizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
              <span>Sync</span>
            </button>
            <button
              onClick={async () => {
                const tieneInicio = !!(config?.ruta?.inicio);
                const tieneFin = !!(config?.ruta?.fin);
                const origenTxt = tieneInicio
                  ? `2. Se ordenarán por distancia real desde tu INICIO configurado${tieneFin ? ' y terminando en tu FIN' : ''}`
                  : '2. Se ordenarán por distancia real desde tu posición GPS (configura un Inicio en "🚩 Inicio y fin de ruta" para partir siempre del mismo lugar)';
                if (!confirm(`🚀 ¿Optimizar ruta por distancia real?\n\n1. Se ubicarán las direcciones que falten (la 1ª vez tarda; usa varias estrategias y si no halla la calle exacta, pone el centro del distrito marcado "aprox.")\n${origenTxt}\n3. Se reasignarán los números de orden (1, 2, 3...)\n\nLas paradas "aprox." puedes precisarlas luego con el botón 📍 Ubicar de cada cliente.`)) return;
                setOptimizando(true);
                setOptimizandoMsg('Preparando…');
                try {
                  const res = await optimizarRuta((msg) => setOptimizandoMsg(msg), config?.ruta ?? null);
                  if (!res) return;
                  const partes: string[] = [];
                  partes.push(`${res.conUbicacion} paradas ordenadas`);
                  if (res.geocodificadosAhora > 0) partes.push(`${res.geocodificadosAhora} ubicadas ahora`);
                  if (res.desdeCache > 0) partes.push(`${res.desdeCache} de caché`);
                  if (res.aproximados > 0) partes.push(`${res.aproximados} aprox. (distrito)`);
                  if (res.distanciaDespuesKm > 0) partes.push(`~${res.distanciaDespuesKm} km · ${res.tiempoEstimadoMin} min`);
                  if (res.ahorroPct > 0) partes.push(`${res.ahorroPct}% menos que el orden anterior`);
                  if (res.sinUbicacion > 0) partes.push(`⚠️ ${res.sinUbicacion} sin ubicar (van al final)`);
                  partes.push(
                    res.origen === 'inicio' ? 'Partiste de tu dirección de INICIO' :
                    res.origen === 'gps' ? 'Partiste de tu posición GPS' :
                    'Sin GPS ni inicio: partiste del centro de Lima'
                  );
                  onShowToast?.(
                    '🚀 Ruta optimizada',
                    partes.join(' · '),
                    res.sinUbicacion > 0 ? 'warning' : 'success'
                  );
                } catch (e: any) {
                  onShowToast?.('❌ Error', e.message || 'No se pudo optimizar', 'error');
                } finally {
                  setOptimizando(false);
                  setOptimizandoMsg('');
                }
              }}
              disabled={sincronizando || optimizando || clientes.length === 0}
              className="flex items-center gap-1 px-2.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50"
              title="Optimizar ruta por distancia real (inicio/GPS + geocodificación)"
            >
              {optimizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
              <span className="max-w-[120px] truncate">{optimizando ? (optimizandoMsg || 'Optimizando…') : 'Ruta'}</span>
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

      {/* 🚩 Inicio y fin de ruta (Fase 1.4) — autocompletado estilo Circuit */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
        <button
          onClick={() => setRutaCardAbierta(!rutaCardAbierta)}
          className="w-full flex items-center gap-2.5 p-3 hover:bg-slate-700/40 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Flag className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white flex items-center gap-2">
              Inicio y fin de ruta
              {(config?.ruta?.inicio || config?.ruta?.fin) && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold">
                  configurado
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {config?.ruta?.inicio
                ? `Desde: ${config.ruta.inicio.nombre}`
                : 'Sin inicio — se usa tu GPS al optimizar'}
              {config?.ruta?.volverAlInicio && !config?.ruta?.fin ? ' · termina donde empezaste' : ''}
              {config?.ruta?.fin ? ` · Hasta: ${config.ruta.fin.nombre}` : ''}
            </p>
          </div>
          {rutaCardAbierta ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {rutaCardAbierta && (
          <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50 pt-3">
            <AddressAutocomplete
              label="🟢 Dirección de INICIO (tu casa o almacén)"
              placeholder="ej: av sucre 523…"
              icono="inicio"
              valorGuardado={
                config?.ruta?.inicio
                  ? {
                      nombre: config.ruta.inicio.nombre,
                      distrito: undefined,
                      lat: config.ruta.inicio.lat,
                      lng: config.ruta.inicio.lng,
                    }
                  : null
              }
              onElegir={(d) => guardarRuta({ inicio: { nombre: d.nombre, lat: d.lat, lng: d.lng } })}
              onLimpiar={() => guardarRuta({ inicio: null })}
              ayuda="Escribe la avenida/calle y elige de la lista. Se usa como punto de partida de la optimización y aparece en el mapa."
            />

            <AddressAutocomplete
              label="🔴 Dirección de FIN (opcional)"
              placeholder="ej: plaza vea bellavista…"
              icono="fin"
              valorGuardado={
                config?.ruta?.fin
                  ? {
                      nombre: config.ruta.fin.nombre,
                      distrito: undefined,
                      lat: config.ruta.fin.lat,
                      lng: config.ruta.fin.lng,
                    }
                  : null
              }
              onElegir={(d) => guardarRuta({ fin: { nombre: d.nombre, lat: d.lat, lng: d.lng } })}
              onLimpiar={() => guardarRuta({ fin: null })}
              ayuda="Si la defines, la ruta optimizada TERMINA ahí (última parada fija)."
            />

            {/* Toggle: terminar donde empezaste */}
            <button
              onClick={() => guardarRuta({ volverAlInicio: !config?.ruta?.volverAlInicio })}
              disabled={!!config?.ruta?.fin}
              className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all active:scale-[0.98] disabled:opacity-40 ${
                config?.ruta?.volverAlInicio
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-slate-900 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="text-left">
                <p className="text-xs font-bold text-white">🔁 Terminar donde empezaste</p>
                <p className="text-[10px] text-slate-400">
                  {config?.ruta?.fin
                    ? 'Desactivado: hay una dirección de FIN configurada'
                    : 'La optimización cuenta el regreso a tu inicio'}
                </p>
              </div>
              <div
                className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
                  config?.ruta?.volverAlInicio ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    config?.ruta?.volverAlInicio ? 'translate-x-4' : ''
                  }`}
                />
              </div>
            </button>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              💡 El inicio/fin queda guardado en tu cuenta y lo usan la optimización de ruta
              (botón “Ruta”) y el Mapa de Entregas. Ejemplo: escribe “av sucre” y elige
              “Avenida Sucre — San Miguel”.
            </p>
          </div>
        )}
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

        {/* Filtros por estado (chips) */}
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

        {/* Filtros por distrito y producto */}
        {clientes.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={filtroDistrito}
              onChange={e => setFiltroDistrito(e.target.value)}
              className="bg-slate-800 text-white text-[11px] rounded-lg px-2 py-1.5 border border-slate-700 focus:border-emerald-500 outline-none appearance-none cursor-pointer"
            >
              <option value="">📍 Todos los distritos</option>
              {distritosUnicos.map(d => (
                <option key={d} value={d}>📍 {d}</option>
              ))}
            </select>
            <select
              value={filtroProducto}
              onChange={e => setFiltroProducto(e.target.value)}
              className="bg-slate-800 text-white text-[11px] rounded-lg px-2 py-1.5 border border-slate-700 focus:border-emerald-500 outline-none appearance-none cursor-pointer"
            >
              <option value="">📦 Todos los productos</option>
              {productosUnicos.map(p => (
                <option key={p} value={p}>📦 {p.length > 25 ? p.substring(0, 25) + '...' : p}</option>
              ))}
            </select>
          </div>
        )}
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
                  {/* Número de posición (editable cuando está expandido) */}
                  {expandido ? (
                    <input
                      type="number"
                      value={editandoNumId === c.id ? numTemporal : String(c.num || idx + 1)}
                      min="1"
                      max={clientes.length}
                      onClick={e => e.stopPropagation()}
                      onFocus={e => {
                        setEditandoNumId(c.id);
                        setNumTemporal(String(c.num || idx + 1));
                        e.target.select();
                      }}
                      onChange={e => setNumTemporal(e.target.value)}
                      onBlur={() => {
                        const nuevoNum = parseInt(numTemporal);
                        if (nuevoNum > 0 && nuevoNum <= clientes.length && nuevoNum !== (c.num || idx + 1)) {
                          editarNumeroOrden(c.id, nuevoNum);
                          onShowToast?.('🔢 Orden cambiado', `${c.nombre} ahora es #${nuevoNum}`, 'info');
                        }
                        setEditandoNumId(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="w-12 h-7 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[11px] font-bold text-center outline-none focus:bg-purple-500/30 focus:border-purple-500 shrink-0"
                      title="Editar número de orden"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-md bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0">
                      {c.num || idx + 1}
                    </div>
                  )}

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
                          {typeof c.lat === 'number' && typeof c.lng === 'number' ? (
                            c.latSrc === 'aprox' ? (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-bold">≈ aprox. (distrito)</span>
                            ) : (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold">✓ ubicado</span>
                            )
                          ) : (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-700/60 border border-slate-600 text-slate-400 text-[9px] font-bold">sin ubicar</span>
                          )}
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

                    {/* Botón Foto de entrega */}
                    <button
                      onClick={() => setFotoEntregaCliente(c)}
                      className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-md text-[10px] font-bold transition-all active:scale-95"
                    >
                      <Camera className="w-3 h-3" />
                      {c.fotoUrl ? '📷 Ver/Cambiar foto de entrega' : '📷 Foto de entrega'}
                    </button>

                    {/* Botón 📍 Ubicar en el mapa (Fase 1.4) */}
                    <button
                      onClick={() => setUbicarClienteId(c.id)}
                      className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all active:scale-95 border ${
                        typeof c.lat === 'number' && c.latSrc !== 'aprox'
                          ? 'bg-slate-700/40 hover:bg-slate-700/70 border-slate-600 text-slate-300'
                          : 'bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/40 text-indigo-300'
                      }`}
                      title="Buscar la dirección exacta y guardarla (autocompletado con distritos)"
                    >
                      <MapPinned className="w-3 h-3" />
                      {typeof c.lat === 'number'
                        ? c.latSrc === 'aprox'
                          ? '📍 Precisar ubicación (está aprox.)'
                          : '📍 Cambiar ubicación en el mapa'
                        : '📍 Ubicar en el mapa'}
                    </button>

                    {/* Botones de acción */}
                    <div className="flex gap-1 pt-1">
                      {/* Botones de mover (arriba/abajo) */}
                      <div className="flex gap-0.5 mr-1">
                        <button
                          onClick={() => moverCliente(c.id, 'arriba')}
                          disabled={clientesFiltrados.findIndex(cc => cc.id === c.id) === 0}
                          className="flex items-center px-1.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-md border border-purple-500/20 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover arriba"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moverCliente(c.id, 'abajo')}
                          disabled={clientesFiltrados.findIndex(cc => cc.id === c.id) === clientesFiltrados.length - 1}
                          className="flex items-center px-1.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-md border border-purple-500/20 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover abajo"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
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

                    {/* ═══ Modal 🤖 Bot (12 botones translúcidos) ═══ */}
                    {botModalId === c.id && (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setBotModalId(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-white">🤖 Bot WhatsApp</h3>
                            <button onClick={() => setBotModalId(null)} className="text-slate-400 hover:text-white">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-400 mb-2">
                            Cliente: <span className="text-white font-bold">{c.nombre}</span> · 📱 {c.cel}
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={async () => { onShowToast?.('📲 Yape', 'Enviando QR...', 'info'); await enviarAccionBot(c, 'enviar_yape'); setBotModalId(null); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">📲</span> Enviar Yape
                            </button>
                            <button onClick={() => { setBotModalId(null); enviarPlinDirecto(c); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">💚</span> Enviar Plin
                            </button>
                            <button onClick={() => { setBotModalId(null); setLlegadaModalId(c.id); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">🚀</span> Voy en camino
                            </button>
                            <button onClick={async () => { onShowToast?.('⏰ Posición', 'Enviando...', 'info'); await enviarAccionBot(c, 'avisar_posicion'); setBotModalId(null); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">⏰</span> Posición ruta
                            </button>
                            <button onClick={async () => { onShowToast?.('📍 Ubicación', 'Enviando...', 'info'); await enviarAccionBot(c, 'solicitar_ubicacion'); setBotModalId(null); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">📍</span> Pedir ubicación
                            </button>
                            <button onClick={async () => { onShowToast?.('✅ Entrega', 'Enviando...', 'info'); await enviarAccionBot(c, 'avisar_entrega', { enviar_imagen: true, modo_entrega: 'auto_imagen' }); setBotModalId(null); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">✅</span> Entrega forzado
                            </button>
                            <button onClick={() => { const cel = String(c.cel || '').replace(/\D/g, ''); const t = cel.length === 9 ? `51${cel}` : cel; window.open(`tel:+${t}`, '_self'); setBotModalId(null); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">📞</span> Llamar directo
                            </button>
                            <button onClick={() => { abrirWhatsApp(c); setBotModalId(null); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">💬</span> Abrir WhatsApp
                            </button>
                            <button onClick={() => { setBotModalId(null); setPagoFotoMonto(String(parseFloat(String(c.cobrar || 0)) || '')); setPagoFotoArchivo(null); setPagoFotoPreview(null); setPagoFotoMetodo('yape'); setPagoFotoTipo('comprobante'); setPagoFotoModalId(c.id); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">📸</span> Pago con foto
                            </button>
                            <button onClick={() => { setBotModalId(null); setMateTab('estado'); setMateEstadoSel(''); setMateReprogramar(''); setMateMinutos(null); setMateMinutosCustom(''); setMatePlantillaSel(''); setMateMensaje(''); setMateMotivo(''); setMateMostrarAgregarFrase(false); setMateMostrarGuardarPlantilla(false); setMateNuevaFrase(''); setMateNuevoNombrePlantilla(''); setReporteMateModalId(c.id); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">📤</span> Reporte a MATE
                            </button>
                            <button onClick={() => { setBotModalId(null); setVentaModalId(c.id); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">🩷</span> Chicos de venta
                            </button>
                            <button onClick={() => { setBotModalId(null); setCuentasModalId(c.id); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">🏦</span> Cuentas empresa
                            </button>
                            <button onClick={() => { setBotModalId(null); setOtrosMateModalId(c.id); setOtrosMateTexto(''); }} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-400 text-[11px] font-bold transition-all active:scale-95">
                              <span className="text-lg">💬</span> Otros a MATE
                            </button>
                          </div>

                          <button onClick={() => setBotModalId(null)} className="w-full mt-2 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all">
                            Cerrar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ═══ Modal 🎯 Control (3 botones translúcidos) ═══ */}
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

                          <div className="space-y-2">
                            <button
                              onClick={async () => {
                                onShowToast?.('📷 Imagen', 'Enviando entrega con imagen...', 'info');
                                await enviarAccionBot(c, 'avisar_entrega', { enviar_imagen: true, modo_entrega: 'auto_imagen' });
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
                                onShowToast?.('📝 Texto', 'Enviando entrega (solo texto)...', 'info');
                                await enviarAccionBot(c, 'avisar_entrega', { enviar_imagen: false, modo_entrega: 'auto_texto' });
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
                              onClick={() => { setControlModalId(null); setLlegadaModalId(c.id); }}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-bold transition-all"
                            >
                              <span className="text-lg">⏱️</span>
                              <div className="text-left">
                                <div>Voy en camino</div>
                                <div className="text-[10px] text-slate-500">Avisa en cuántos minutos llegás</div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ═══ Modal 🚀 Voy en camino (minutos) ═══ */}
                    {llegadaModalId === c.id && (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setLlegadaModalId(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="text-base font-bold text-white">🚀 Voy a: {c.nombre}</h3>
                              <p className="text-[11px] text-slate-400 mt-0.5">El bot le va a avisar que vas en camino</p>
                            </div>
                            <button onClick={() => setLlegadaModalId(null)} className="text-slate-400 hover:text-white">
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Botones de tiempo rápido */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {['5', '10', '15', '20', '30', '45'].map(m => (
                              <button
                                key={m}
                                onClick={async () => {
                                  onShowToast?.('⏱️ En camino', `Avisando a ${c.nombre}: ${m} minutos`, 'info');
                                  await enviarAccionBot(c, 'avisar_siguiente', { minutos: parseInt(m) });
                                  setLlegadaModalId(null);
                                }}
                                className="py-3 rounded-xl border-2 border-blue-500/30 bg-blue-500/10 text-blue-400 font-black text-lg hover:bg-blue-500/20 transition-all active:scale-95"
                              >
                                {m} <span className="text-xs">min</span>
                              </button>
                            ))}
                          </div>

                          {/* Input personalizado */}
                          <div className="flex gap-2 mb-3">
                            <input
                              type="number"
                              id={`min-input-${c.id}`}
                              placeholder="Otro..."
                              min="1"
                              max="120"
                              className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none text-center"
                            />
                            <button
                              onClick={async () => {
                                const input = document.getElementById(`min-input-${c.id}`) as HTMLInputElement;
                                const val = input?.value;
                                if (val && parseInt(val) > 0) {
                                  onShowToast?.('⏱️ En camino', `Avisando: ${val} minutos`, 'info');
                                  await enviarAccionBot(c, 'avisar_siguiente', { minutos: parseInt(val) });
                                  setLlegadaModalId(null);
                                } else {
                                  onShowToast?.('⚠️ Error', 'Ingresa un número válido', 'warning');
                                }
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                            >
                              Enviar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ═══ Modal 🩷 Chicos de Venta ═══ */}
                    {ventaModalId === c.id && (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setVentaModalId(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-white">🩷 Chicos de Venta</h3>
                            <button onClick={() => setVentaModalId(null)} className="text-slate-400 hover:text-white">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 mb-3">El bot le enviará el contacto al cliente</p>

                          <div className="space-y-2">
                            <button onClick={async () => { onShowToast?.('🩷 Venta', 'Enviando contacto de Fabiana...', 'info'); await enviarAccionBot(c, 'chicos_venta', { ventas_persona: 'fabiana' }); setVentaModalId(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-400 text-sm font-bold transition-all active:scale-95">
                              <span className="text-lg">👩</span>
                              <div className="text-left">
                                <div>Fabiana</div>
                                <div className="text-[10px] text-slate-500">Ejecutiva de ventas</div>
                              </div>
                            </button>
                            <button onClick={async () => { onShowToast?.('🩷 Venta', 'Enviando contacto de Karla...', 'info'); await enviarAccionBot(c, 'chicos_venta', { ventas_persona: 'karla' }); setVentaModalId(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-400 text-sm font-bold transition-all active:scale-95">
                              <span className="text-lg">👩</span>
                              <div className="text-left">
                                <div>Karla</div>
                                <div className="text-[10px] text-slate-500">Ejecutiva de ventas</div>
                              </div>
                            </button>
                            <button onClick={async () => { onShowToast?.('🩷 Venta', 'Enviando contacto de Tocho...', 'info'); await enviarAccionBot(c, 'chicos_venta', { ventas_persona: 'tocho' }); setVentaModalId(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-400 text-sm font-bold transition-all active:scale-95">
                              <span className="text-lg">👨</span>
                              <div className="text-left">
                                <div>Tocho</div>
                                <div className="text-[10px] text-slate-500">Ejecutivo de ventas</div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ═══ Modal 🏦 Cuentas de la Empresa ═══ */}
                    {cuentasModalId === c.id && (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setCuentasModalId(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-white">🏦 Cuentas de la Empresa</h3>
                            <button onClick={() => setCuentasModalId(null)} className="text-slate-400 hover:text-white">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 mb-3">El bot le enviará los datos bancarios al cliente</p>

                          <div className="space-y-2">
                            <button onClick={async () => { onShowToast?.('🏦 BCP', 'Enviando cuenta BCP...', 'info'); await enviarAccionBot(c, 'cuentas_banco', { banco: 'bcp' }); setCuentasModalId(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-bold transition-all active:scale-95">
                              <span className="text-lg">🔵</span>
                              <div className="text-left">
                                <div>BCP</div>
                                <div className="text-[10px] text-slate-500">Banco de Crédito del Perú</div>
                              </div>
                            </button>
                            <button onClick={async () => { onShowToast?.('🏦 BBVA', 'Enviando cuenta BBVA...', 'info'); await enviarAccionBot(c, 'cuentas_banco', { banco: 'bbva' }); setCuentasModalId(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm font-bold transition-all active:scale-95">
                              <span className="text-lg">🔷</span>
                              <div className="text-left">
                                <div>BBVA</div>
                                <div className="text-[10px] text-slate-500">Banco BBVA Continental</div>
                              </div>
                            </button>
                            <button onClick={async () => { onShowToast?.('🏦 Interbank', 'Enviando cuenta Interbank...', 'info'); await enviarAccionBot(c, 'cuentas_banco', { banco: 'interbank' }); setCuentasModalId(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-bold transition-all active:scale-95">
                              <span className="text-lg">🟢</span>
                              <div className="text-left">
                                <div>Interbank</div>
                                <div className="text-[10px] text-slate-500">Banco Interbank</div>
                              </div>
                            </button>
                            <button onClick={async () => { onShowToast?.('🏦 Todas', 'Enviando todas las cuentas...', 'info'); await enviarAccionBot(c, 'cuentas_banco', { banco: 'todas' }); setCuentasModalId(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold transition-all active:scale-95">
                              <span className="text-lg">📋</span>
                              <div className="text-left">
                                <div>Todas las cuentas</div>
                                <div className="text-[10px] text-slate-500">Envía BCP + BBVA + Interbank + Yape</div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ═══ Modal 💬 Otros temas a MATE ═══ */}
                    {otrosMateModalId === c.id && (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setOtrosMateModalId(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-white">💬 Otros temas a MATE</h3>
                            <button onClick={() => setOtrosMateModalId(null)} className="text-slate-400 hover:text-white">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 mb-3">Este mensaje se enviará al grupo MATE</p>

                          <div className="bg-slate-800 rounded-lg p-3 mb-3 text-[11px]">
                            <div className="font-bold text-white">{c.nombre}</div>
                            <div className="text-slate-400">{c.prod} · S/ {parseFloat(String(c.cobrar || 0)).toFixed(2)}</div>
                          </div>

                          <textarea
                            value={otrosMateTexto}
                            onChange={e => setOtrosMateTexto(e.target.value)}
                            placeholder="Escribe el mensaje para MATE..."
                            rows={4}
                            className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-purple-500 outline-none resize-none mb-3"
                          />

                          {otrosMateTexto.trim() && (
                            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2 mb-3">
                              <div className="text-[9px] text-purple-400/70 uppercase mb-1">Vista previa</div>
                              <div className="text-[11px] text-slate-300 whitespace-pre-wrap">
                                📢 Reporte de {c.nombre}{'\n'}{'\n'}{otrosMateTexto}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {[
                              'Cliente no sabe la dirección exacta',
                              'Producto en mal estado',
                              'Cliente pide cambio de producto',
                              'Dirección incorrecta en el sistema',
                              'Cliente quiere hablar con ventas',
                            ].map(frase => (
                              <button
                                key={frase}
                                onClick={() => setOtrosMateTexto(frase)}
                                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-400 border border-slate-700"
                              >
                                {frase}
                              </button>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <button onClick={() => setOtrosMateModalId(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold">
                              Cancelar
                            </button>
                            <button
                              onClick={async () => {
                                if (!otrosMateTexto.trim()) {
                                  onShowToast?.('⚠️ Vacío', 'Escribe un mensaje', 'warning');
                                  return;
                                }
                                onShowToast?.('💬 MATE', 'Enviando mensaje al grupo MATE...', 'info');
                                await enviarAccionBot(c, 'otros_temas_mate', { mensaje: otrosMateTexto });
                                setOtrosMateModalId(null);
                                setOtrosMateTexto('');
                              }}
                              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold"
                            >
                              📤 Enviar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ═══ Modal 📸 Reportar pago con foto ═══ */}
                    {pagoFotoModalId === c.id && (() => {
                      // Construir mensaje según tipo seleccionado
                      // 📌 IMPORTANTE: Esta función genera el caption EXACTAMENTE igual
                      // a como lo construye el bot Baileys en enviarFotoGrupoMATE().
                      // Así la vista previa coincide con lo que llega al grupo MATE.
                      const construirMensajeFoto = () => {
                        const precio = parseFloat(String(c.cobrar || 0)).toFixed(2);
                        const nombre = c.nombre || '—';
                        const producto = c.prod || '—';
                        const direccion = c.dir || '—';
                        const distrito = c.dist || '—';
                        const montoRecibido = parseFloat(pagoFotoMonto || '0').toFixed(2);

                        // Título según tipo (igual que el bot)
                        let titulo = '';
                        if (pagoFotoTipo === 'comprobante') {
                          titulo = '📸 COMPROBANTE DE PAGO';
                        } else if (pagoFotoTipo === 'entregado') {
                          titulo = '✅ ENTREGA CONFIRMADA';
                        } else {
                          titulo = '📦 REPORTE FOTO';
                        }

                        // Caption IGUAL al del bot
                        const partes: string[] = [];
                        partes.push(`*${titulo}*`);
                        if (nombre) partes.push(`👤 Cliente: ${nombre}`);
                        if (producto) partes.push(`📦 Producto: ${producto}`);
                        if (precio && precio !== '0.00') partes.push(`💵 Monto: S/ ${precio}`);
                        if (direccion) partes.push(`📍 Dirección: ${direccion}`);
                        if (distrito) partes.push(`🏘️ Distrito: ${distrito}`);

                        // Comentario (igual al que mandamos al bot)
                        let comentario = '';
                        if (pagoFotoTipo === 'comprobante') {
                          comentario = `Método: ${pagoFotoMetodo.toUpperCase()} · Monto recibido: S/ ${montoRecibido}`;
                        }
                        if (comentario) partes.push(`📝 ${comentario}`);

                        return partes.join('\n');
                      };

                      const mensajeFoto = construirMensajeFoto();

                      return (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => !pagoFotoSubiendo && setPagoFotoModalId(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-white">📸 Reporte con foto a MATE</h3>
                            <button onClick={() => !pagoFotoSubiendo && setPagoFotoModalId(null)} disabled={pagoFotoSubiendo} className="text-slate-400 hover:text-white disabled:opacity-30">
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Card del cliente */}
                          <div className="bg-slate-800 rounded-lg p-3 mb-3 text-xs">
                            <div className="font-bold text-white text-sm">{c.nombre}</div>
                            <div className="text-slate-400 mt-0.5">{c.prod || 'Sin producto'} · 📱 {c.cel || '—'}</div>
                            <div className="mt-1 text-emerald-400 font-bold">S/ {parseFloat(String(c.cobrar || 0)).toFixed(2)}</div>
                          </div>

                          {/* Tipo de reporte (Comprobante / Entregado / Otro) */}
                          <div className="mb-3">
                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Tipo de reporte</label>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button onClick={() => setPagoFotoTipo('comprobante')} disabled={pagoFotoSubiendo} className={`flex flex-col items-center gap-0.5 p-2 rounded-lg text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50 ${pagoFotoTipo === 'comprobante' ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-300' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
                                <span className="text-base">📸</span>
                                Comprobante
                              </button>
                              <button onClick={() => setPagoFotoTipo('entregado')} disabled={pagoFotoSubiendo} className={`flex flex-col items-center gap-0.5 p-2 rounded-lg text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50 ${pagoFotoTipo === 'entregado' ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
                                <span className="text-base">✅</span>
                                Entregado
                              </button>
                              <button onClick={() => setPagoFotoTipo('otro')} disabled={pagoFotoSubiendo} className={`flex flex-col items-center gap-0.5 p-2 rounded-lg text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50 ${pagoFotoTipo === 'otro' ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-300' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
                                <span className="text-base">📦</span>
                                Otro
                              </button>
                            </div>
                          </div>

                          {/* Input de cámara (oculto) */}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            ref={pagoFotoInputRef}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setPagoFotoArchivo(file);
                              const reader = new FileReader();
                              reader.onload = ev => setPagoFotoPreview(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }}
                            className="hidden"
                          />
                          {/* Input de galería (oculto) - SIN capture para que abra la galería */}
                          <input
                            type="file"
                            accept="image/*"
                            ref={pagoFotoGaleriaRef}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setPagoFotoArchivo(file);
                              const reader = new FileReader();
                              reader.onload = ev => setPagoFotoPreview(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }}
                            className="hidden"
                          />

                          {/* Preview de la foto */}
                          {pagoFotoPreview ? (
                            <div className="relative mb-3">
                              <img src={pagoFotoPreview} alt="Comprobante" className="w-full max-h-64 object-contain rounded-lg border border-slate-700" />
                              <button onClick={() => { setPagoFotoArchivo(null); setPagoFotoPreview(null); if (pagoFotoInputRef.current) pagoFotoInputRef.current.value = ''; if (pagoFotoGaleriaRef.current) pagoFotoGaleriaRef.current.value = ''; }} disabled={pagoFotoSubiendo} className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 transition-all disabled:opacity-50">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <button onClick={() => pagoFotoInputRef.current?.click()} className="flex flex-col items-center gap-1 p-4 rounded-xl border-2 border-dashed border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 transition-all active:scale-95">
                                <Camera className="w-6 h-6" />
                                <div className="text-[11px] font-bold">📷 Tomar foto</div>
                                <div className="text-[9px] text-slate-500">Abre la cámara</div>
                              </button>
                              <button onClick={() => pagoFotoGaleriaRef.current?.click()} className="flex flex-col items-center gap-1 p-4 rounded-xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 transition-all active:scale-95">
                                <Upload className="w-6 h-6" />
                                <div className="text-[11px] font-bold">🖼️ Subir imagen</div>
                                <div className="text-[9px] text-slate-500">De la galería</div>
                              </button>
                            </div>
                          )}

                          {/* Monto y método (solo si es comprobante) */}
                          {pagoFotoTipo === 'comprobante' && (
                            <>
                              <div className="mb-3">
                                <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Monto recibido (S/)</label>
                                <input type="number" value={pagoFotoMonto} onChange={e => setPagoFotoMonto(e.target.value)} placeholder="0.00" step="0.01" min="0" disabled={pagoFotoSubiendo} className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-rose-500 outline-none disabled:opacity-50" />
                              </div>

                              <div className="mb-3">
                                <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Método de pago</label>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {([
                                    ['yape', '📲', 'Yape'],
                                    ['plin', '🔵', 'Plin'],
                                    ['efectivo', '💵', 'Efectivo'],
                                    ['transferencia', '🏦', 'Transf.'],
                                    ['pos', '💳', 'POS'],
                                    ['mixto', '🔀', 'Mixto'],
                                  ] as const).map(([id, emoji, label]) => (
                                    <button key={id} onClick={() => setPagoFotoMetodo(id)} disabled={pagoFotoSubiendo} className={`flex flex-col items-center gap-0.5 p-2 rounded-lg text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50 ${pagoFotoMetodo === id ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-300' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
                                      <span className="text-base">{emoji}</span>
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          {/* Vista previa del mensaje */}
                          <div className="mb-3">
                            <label className="text-[10px] text-emerald-400 uppercase font-bold mb-1 block">👁️ Vista previa (lo que recibirá MATE)</label>
                            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-3 max-h-40 overflow-y-auto">
                              <pre className="text-[10px] text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{mensajeFoto}</pre>
                            </div>
                          </div>

                          {/* Botones */}
                          <div className="flex gap-2">
                            <button onClick={() => !pagoFotoSubiendo && setPagoFotoModalId(null)} disabled={pagoFotoSubiendo} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                              Cancelar
                            </button>
                            <button
                              onClick={async () => {
                                if (!pagoFotoArchivo) { onShowToast?.('⚠️ Falta foto', 'Toma una foto primero', 'warning'); return; }
                                if (pagoFotoTipo === 'comprobante' && (!pagoFotoMonto || parseFloat(pagoFotoMonto) <= 0)) { onShowToast?.('⚠️ Monto', 'Ingresa el monto recibido', 'warning'); return; }
                                if (!user) { onShowToast?.('Error', 'No hay sesión activa', 'error'); return; }
                                setPagoFotoSubiendo(true);
                                onShowToast?.('📸 Subiendo', 'Subiendo foto a la nube...', 'info');
                                try {
                                  const fotoUrl = await subirFotoPago(user.uid, c.id, pagoFotoArchivo);
                                  onShowToast?.('📤 Enviando', 'Enviando al grupo MATE...', 'info');
                                  // 📌 Usamos el tipo 'enviar_foto_grupo_mate' que el bot YA conoce
                                  // El bot construye el caption con: titulo, nombre, prod, cobrar, dir, distrito, comentario
                                  // Por eso NO pasamos el mensaje completo en comentario (se duplicaría)
                                  await enviarAccionBot(c, 'enviar_foto_grupo_mate', {
                                    imagenUrl: fotoUrl,
                                    nombre: c.nombre,
                                    prod: c.prod,
                                    cobrar: parseFloat(String(c.cobrar || 0)),
                                    dir: c.dir,
                                    distrito: c.dist,
                                    titulo: pagoFotoTipo === 'comprobante' ? '📸 Comprobante de pago'
                                      : pagoFotoTipo === 'entregado' ? '✅ Entrega confirmada'
                                      : '📦 Reporte foto',
                                    // Comentario breve (NO el mensaje completo, sino se duplica)
                                    comentario: pagoFotoTipo === 'comprobante'
                                      ? `Método: ${pagoFotoMetodo.toUpperCase()} · Monto recibido: S/ ${parseFloat(pagoFotoMonto || '0').toFixed(2)}`
                                      : '',
                                  });
                                  // Cambiar estado del cliente según tipo
                                  if (pagoFotoTipo === 'entregado') {
                                    cambiarEstado(c.id, 'efectivo');
                                  } else if (pagoFotoTipo === 'comprobante') {
                                    const estadoMap: Record<string, string> = { yape: 'yape-rudy', plin: 'yape-plin', efectivo: 'efectivo', transferencia: 'transferencia', pos: 'pos', mixto: 'mixto' };
                                    cambiarEstado(c.id, estadoMap[pagoFotoMetodo] || 'efectivo');
                                  }
                                  onShowToast?.('✅ Enviado', `Reporte de ${pagoFotoTipo} enviado a MATE`, 'success');
                                  setPagoFotoModalId(null);
                                  setPagoFotoArchivo(null);
                                  setPagoFotoPreview(null);
                                  setPagoFotoMonto('');
                                  setPagoFotoMetodo('yape');
                                  setPagoFotoTipo('comprobante');
                                } catch (e: any) {
                                  console.error('❌ Error subiendo foto:', e);
                                  onShowToast?.('❌ Error', e.message || 'No se pudo subir la foto', 'error');
                                } finally {
                                  setPagoFotoSubiendo(false);
                                }
                              }}
                              disabled={pagoFotoSubiendo || !pagoFotoArchivo}
                              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {pagoFotoSubiendo ? (<><Loader2 className="w-3 h-3 animate-spin" /> Subiendo...</>) : (<>📤 Enviar a MATE</>)}
                            </button>
                          </div>

                          <div className="mt-2 text-[10px] text-slate-500 text-center">
                            La foto y el mensaje se enviarán al grupo MATE
                          </div>
                        </div>
                      </div>
                      );
                    })()}

                    {/* ═══ Modal 📤 Enviar reporte a MATE (completo tipo Modular) ═══ */}
                    {reporteMateModalId === c.id && (() => {
                      const estadosModular = [
                        ['pendiente', '⏳', 'Pendiente'],
                        ['entregado', '✅', 'Entregado'],
                        ['fallido', '❌', 'Fallido'],
                        ['reprogramar', '📅', 'Reprogramar'],
                        ['ausente', '👤', 'Ausente'],
                        ['rechazo', '🚫', 'Rechazó'],
                        ['no_contesta', '📵', 'No contesta'],
                        ['en_camino', '🚀', 'En camino'],
                        ['devolucion', '📦', 'Devolución'],
                        ['cancelado', '⛔', 'Cancelado'],
                      ] as const;
                      const minutosOpciones = [5, 10, 15, 20, 25, 30, 45, 60];

                      const construirMensajeFinal = () => {
                        const ahora = new Date();
                        const fechaStr = ahora.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
                        const horaStr = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                        const precio = parseFloat(String(c.cobrar || 0)).toFixed(2);
                        const producto = c.prod || '—';
                        const nombre = c.nombre || '—';
                        const direccion = c.dir || '—';
                        const distrito = c.dist || '—';
                        const telefono = c.cel || '—';

                        // Título según estado
                        let titulo = '📦 *REPORTE DE PEDIDO*';
                        let emojiEstado = '⏳';
                        let labelEstado = 'Pendiente';

                        if (mateEstadoSel) {
                          const est = estadosModular.find(e => e[0] === mateEstadoSel);
                          if (est) { emojiEstado = est[1]; labelEstado = est[2]; }
                          if (mateEstadoSel === 'entregado') titulo = '✅ *PEDIDO ENTREGADO*';
                          else if (['fallido', 'rechazo', 'devolucion', 'cancelado'].includes(mateEstadoSel)) titulo = '❌ *PEDIDO NO ENTREGADO*';
                          else if (mateEstadoSel === 'en_camino') titulo = '🚀 *PEDIDO EN CAMINO*';
                          else if (mateEstadoSel === 'reprogramar') titulo = '📅 *PEDIDO REPROGRAMADO*';
                          else if (mateEstadoSel === 'ausente') titulo = '👤 *CLIENTE AUSENTE*';
                          else if (mateEstadoSel === 'no_contesta') titulo = '📵 *CLIENTE NO CONTESTA*';
                        }

                        const partes: string[] = [];
                        partes.push(titulo);
                        partes.push('');
                        partes.push(`📅 _${fechaStr} · ${horaStr}_`);
                        partes.push(`⚠️ *Estado:* ${emojiEstado} ${labelEstado}`);
                        partes.push('');
                        partes.push(`👤 *Cliente:* ${nombre}`);
                        partes.push(`📦 *Producto:* ${producto}`);
                        partes.push(`💰 *Precio:* S/ ${precio}`);
                        partes.push(`💵 *A cobrar:* S/ ${precio}`);
                        partes.push(`📍 *Dirección:* ${direccion}`);
                        partes.push(`🏘️ *Distrito:* ${distrito}`);
                        partes.push(`📞 *Teléfono:* ${telefono}`);

                        if (mateReprogramar) {
                          try {
                            const fecha = new Date(mateReprogramar);
                            const fechaRep = fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
                            const horaRep = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                            partes.push(`📅 *Reprogramado para:* ${fechaRep} · ${horaRep}`);
                          } catch { partes.push(`📅 *Reprogramado:* ${mateReprogramar}`); }
                        }

                        if (mateMinutos || (mateMinutosCustom && parseInt(mateMinutosCustom) > 0)) {
                          const min = mateMinutos || parseInt(mateMinutosCustom);
                          partes.push(`⏱️ *Llego en:* ~${min} minutos~`);
                        }

                        // Motivo (textarea) - siempre se incluye
                        const motivoTexto = mateMotivo.trim() || mateMensaje.trim();
                        if (motivoTexto) {
                          partes.push('');
                          partes.push(`📝 *Motivo:* \`${motivoTexto}\``);
                        }

                        partes.push('');
                        partes.push('— _Reporte automático desde RiderTrack_');
                        return partes.join('\n');
                      };

                      const mensajeFinal = construirMensajeFinal();
                      const tieneContenido = mateEstadoSel || mateReprogramar || mateMinutos || mateMinutosCustom || mateMensaje.trim() || mateMotivo.trim();

                      return (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setReporteMateModalId(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                          <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10">
                            <div>
                              <h3 className="text-base font-bold text-white">📦 MENSAJE PARA EMPRESA</h3>
                              <p className="text-[10px] text-slate-400">Envía directo al grupo MATE — sin abrir WhatsApp</p>
                            </div>
                            <button onClick={() => setReporteMateModalId(null)} className="text-slate-400 hover:text-white p-1">
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="p-4 space-y-4">
                            <div className="bg-slate-800 rounded-lg p-3 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-white text-sm">{c.nombre}</div>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${c.st === 'pendiente' ? 'bg-amber-500/20 text-amber-400' : ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st || '') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{c.st || 'pendiente'}</span>
                              </div>
                              {c.prod && <div className="text-slate-400">📦 {c.prod}</div>}
                              <div className="mt-1 text-emerald-400 font-bold">💰 S/ {parseFloat(String(c.cobrar || 0)).toFixed(2)}</div>
                              {c.dir && <div className="text-slate-500 mt-1 text-[10px]">📍 {c.dir} · {c.dist}</div>}
                            </div>

                            <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
                              <button onClick={() => setMateTab('estado')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${mateTab === 'estado' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>⚡ Estado rápido</button>
                              <button onClick={() => setMateTab('mensaje')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${mateTab === 'mensaje' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>✏️ Mensaje</button>
                            </div>

                            {mateTab === 'estado' && (
                              <div className="space-y-3">
                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold mb-1.5 block">⚡ ESTADO RÁPIDO</label>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {estadosModular.map(([id, emoji, label]) => (
                                      <button key={id} onClick={() => setMateEstadoSel(mateEstadoSel === id ? '' : id)} className={`flex items-center gap-1.5 p-2 rounded-lg text-[10px] font-bold transition-all active:scale-95 border ${mateEstadoSel === id ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                        <span className="text-sm">{emoji}</span>
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block flex items-center gap-1">📅 Reprogramar para <span className="text-slate-500 normal-case font-normal">(opcional)</span></label>
                                  <input type="datetime-local" value={mateReprogramar} onChange={e => setMateReprogramar(e.target.value)} className="w-full bg-slate-800 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-orange-500 outline-none" />
                                  {mateReprogramar && (<button onClick={() => setMateReprogramar('')} className="mt-1 text-[10px] text-red-400 hover:text-red-300">✕ Quitar fecha</button>)}
                                </div>

                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block flex items-center gap-1">🕐 Minutos para llegar <span className="text-slate-500 normal-case font-normal">(opcional)</span></label>
                                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                                    {minutosOpciones.map(m => (
                                      <button key={m} onClick={() => { setMateMinutos(mateMinutos === m ? null : m); setMateMinutosCustom(''); }} className={`py-2 rounded-lg text-xs font-bold transition-all active:scale-95 border ${mateMinutos === m && !mateMinutosCustom ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{m}</button>
                                    ))}
                                  </div>
                                  <input type="number" value={mateMinutosCustom} onChange={e => { setMateMinutosCustom(e.target.value); setMateMinutos(null); }} placeholder="Ej: 15" min="1" max="180" className="w-full bg-slate-800 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none text-center" />
                                </div>
                              </div>
                            )}

                            {mateTab === 'mensaje' && (
                              <div className="space-y-3">
                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">📄 Plantillas predefinidas</label>
                                  <select
                                    value={matePlantillaSel}
                                    onChange={e => {
                                      setMatePlantillaSel(e.target.value);
                                      // Buscar en predefinidas primero
                                      const plPre = PLANTILLAS_PREDEF.find(p => p.nombre === e.target.value);
                                      if (plPre) {
                                        setMateMensaje(plPre.texto);
                                        return;
                                      }
                                      // Si no, buscar en plantillas guardadas del usuario
                                      const plUser = matePlantillas.find(p => p.nombre === e.target.value);
                                      if (plUser) setMateMensaje(plUser.texto);
                                    }}
                                    className="w-full bg-slate-800 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-indigo-500 outline-none"
                                  >
                                    <option value="">-- Selecciona una plantilla --</option>
                                    <optgroup label="📋 Predefinidas">
                                      {PLANTILLAS_PREDEF.map(p => (
                                        <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                                      ))}
                                    </optgroup>
                                    {matePlantillas.length > 0 && (
                                      <optgroup label="💾 Mis plantillas guardadas">
                                        {matePlantillas.map(p => (
                                          <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                  <div className="text-[9px] text-slate-500 mt-1">
                                    💡 Las predefinidas usan [motivo] que se reemplaza con el campo de abajo
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">✏️ Mensaje</label>
                                  <textarea value={mateMensaje} onChange={e => { setMateMensaje(e.target.value); setMatePlantillaSel(''); }} placeholder="Escribe tu mensaje o selecciona una plantilla... Usa [motivo] donde quieras que aparezca el motivo." rows={5} className="w-full bg-slate-800 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-indigo-500 outline-none resize-none" />
                                </div>

                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">📝 Motivo / Nota <span className="text-slate-500 normal-case font-normal">(se reemplaza en [motivo])</span></label>
                                  <input type="text" value={mateMotivo} onChange={e => setMateMotivo(e.target.value)} placeholder="Ej: Falta poner la direccion exacta / Cliente no estaba / etc..." className="w-full bg-slate-800 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-indigo-500 outline-none" />
                                </div>

                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">💬 Frases predefinidas</label>
                                  {mateFrases.length === 0 ? (<div className="text-[10px] text-slate-500 mb-2">Aún no tienes frases. Toca ➕ para crear la primera.</div>) : (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {mateFrases.map((frase, i) => (
                                        <div key={i} className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-md overflow-hidden">
                                          <button onClick={() => { const nuevoMsg = mateMensaje ? `${mateMensaje}\n${frase}` : frase; setMateMensaje(nuevoMsg); }} className="px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700">{frase.length > 30 ? frase.substring(0, 30) + '...' : frase}</button>
                                          <button onClick={() => { const nuevas = mateFrases.filter((_, idx) => idx !== i); setMateFrases(nuevas); if (user) localStorage.setItem(`mate_frases_${user.uid}`, JSON.stringify(nuevas)); }} className="px-1 py-1 text-red-400 hover:bg-red-500/10"><X className="w-3 h-3" /></button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {mateMostrarAgregarFrase ? (
                                    <div className="flex gap-1.5">
                                      <input type="text" value={mateNuevaFrase} onChange={e => setMateNuevaFrase(e.target.value)} placeholder="Nueva frase..." className="flex-1 bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 border border-slate-700 focus:border-emerald-500 outline-none" autoFocus />
                                      <button onClick={() => { if (!mateNuevaFrase.trim()) return; const nuevas = [...mateFrases, mateNuevaFrase.trim()]; setMateFrases(nuevas); if (user) localStorage.setItem(`mate_frases_${user.uid}`, JSON.stringify(nuevas)); setMateNuevaFrase(''); setMateMostrarAgregarFrase(false); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold">✓</button>
                                      <button onClick={() => { setMateMostrarAgregarFrase(false); setMateNuevaFrase(''); }} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold">✕</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setMateMostrarAgregarFrase(true)} className="px-2 py-1 rounded-md border border-emerald-500/30 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/10">➕ Agregar</button>
                                  )}
                                </div>

                                {mateMostrarGuardarPlantilla ? (
                                  <div className="flex gap-1.5">
                                    <input type="text" value={mateNuevoNombrePlantilla} onChange={e => setMateNuevoNombrePlantilla(e.target.value)} placeholder="Nombre de la plantilla..." className="flex-1 bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 border border-slate-700 focus:border-blue-500 outline-none" autoFocus />
                                    <button onClick={() => { if (!mateNuevoNombrePlantilla.trim() || !mateMensaje.trim()) return; const nuevas = [...matePlantillas, { nombre: mateNuevoNombrePlantilla.trim(), texto: mateMensaje }]; setMatePlantillas(nuevas); if (user) localStorage.setItem(`mate_plantillas_${user.uid}`, JSON.stringify(nuevas)); setMateNuevoNombrePlantilla(''); setMateMostrarGuardarPlantilla(false); onShowToast?.('💾 Plantilla', 'Guardada correctamente', 'success'); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">✓</button>
                                    <button onClick={() => { setMateMostrarGuardarPlantilla(false); setMateNuevoNombrePlantilla(''); }} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold">✕</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setMateMostrarGuardarPlantilla(true)} disabled={!mateMensaje.trim()} className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-bold transition-all disabled:opacity-30">💾 Guardar mensaje actual como plantilla</button>
                                )}
                              </div>
                            )}

                            {tieneContenido && (
                              <div>
                                <label className="text-[10px] text-emerald-400 uppercase font-bold mb-1 block">👁️ Vista previa (lo que recibirá MATE)</label>
                                <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                                  <pre className="text-[11px] text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{mensajeFinal}</pre>
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <button
                                onClick={async () => {
                                  onShowToast?.('📤 MATE', 'Enviando reporte al grupo MATE...', 'info');
                                  // 📌 Usamos 'enviar_grupo_mate' que el bot YA conoce
                                  // No necesitamos tocar el bot Baileys
                                  await enviarAccionBot(c, 'enviar_grupo_mate', {
                                    texto: mensajeFinal,
                                  });
                                  if (mateEstadoSel) {
                                    const mapeoEstado: Record<string, string> = { pendiente: 'pendiente', entregado: 'efectivo', fallido: 'fallida', reprogramar: 'pendiente', ausente: 'ausente', rechazo: 'rechazado', no_contesta: 'no-contesta', en_camino: 'pendiente', devolucion: 'cambio', cancelado: 'cancelado' };
                                    if (mapeoEstado[mateEstadoSel]) { cambiarEstado(c.id, mapeoEstado[mateEstadoSel]); }
                                  }
                                  setReporteMateModalId(null);
                                }}
                                disabled={!tieneContenido}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                              >📦 ENVIAR AL GRUPO MATE</button>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    navigator.clipboard?.writeText(mensajeFinal).then(() => {
                                      onShowToast?.('📋 Copiado', 'Mensaje copiado al portapapeles', 'success');
                                    }).catch(() => { onShowToast?.('⚠️ Error', 'No se pudo copiar', 'warning'); });
                                  }}
                                  disabled={!tieneContenido}
                                  className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                                >📋 Copiar</button>
                                <button onClick={() => setReporteMateModalId(null)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold transition-all">Cancelar</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })()}

                    {/* NOTE: El modal de Control viejo fue eliminado (duplicado).
                        El modal correcto está arriba, línea ~646, y usa enviarAccionBot. */}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 🏁 BOTONES DE GESTIÓN DE RUTA (Finalizar, Guardar, Limpiar) */}
      {clientes.length > 0 && (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-3 space-y-2">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">🏁 Gestión de ruta</div>

          {/* Finalizar Ruta */}
          <button
            onClick={async () => {
              if (!confirm('¿Finalizar ruta?\n\nSe guardará un resumen en el historial y la ruta se marcará como finalizada.\nLos clientes seguirán visibles para consulta.')) return;
              try {
                await finalizarRutaActual();
                onShowToast?.('🏁 Ruta finalizada', 'Resumen guardado en historial', 'success');
              } catch (e: any) {
                onShowToast?.('❌ Error', e.message || 'No se pudo finalizar', 'error');
              }
            }}
            disabled={sincronizando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 disabled:opacity-50 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
          >
            {sincronizando ? <Loader2 className="w-4 h-4 animate-spin" /> : '🏁'}
            FINALIZAR RUTA
          </button>

          {/* Guardar y Cerrar Ruta */}
          <button
            onClick={async () => {
              if (!confirm('¿Guardar y cerrar ruta?\n\nSe guardarán los clientes en clientes_registrados como respaldo histórico.\nLos clientes seguirán visibles en el panel.')) return;
              try {
                await guardarYCerrarRutaActual();
                onShowToast?.('💾 Ruta guardada', 'Clientes guardados en historial', 'success');
              } catch (e: any) {
                onShowToast?.('❌ Error', e.message || 'No se pudo guardar', 'error');
              }
            }}
            disabled={sincronizando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 disabled:opacity-50 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400"
          >
            {sincronizando ? <Loader2 className="w-4 h-4 animate-spin" /> : '💾'}
            GUARDAR Y CERRAR RUTA
          </button>

          {/* Limpiar sin Guardar */}
          <button
            onClick={async () => {
              if (!confirm('⚠️ ¿Limpiar ruta SIN GUARDAR?\n\nSe borrarán TODOS los clientes de ruta_activa y del panel.\nNo se guardará nada en historial.\n\nEsta acción NO se puede deshacer.')) return;
              if (!confirm('Última confirmación: ¿Estás SEGURO de borrar todo?')) return;
              try {
                await limpiarRuta();
                onShowToast?.('🗑️ Ruta limpiada', 'Todos los clientes eliminados', 'info');
              } catch (e: any) {
                onShowToast?.('❌ Error', e.message || 'No se pudo limpiar', 'error');
              }
            }}
            disabled={sincronizando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 disabled:opacity-50 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400"
          >
            {sincronizando ? <Loader2 className="w-4 h-4 animate-spin" /> : '🗑️'}
            LIMPIAR SIN GUARDAR
          </button>
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
      {/* 📷 Modal de foto de entrega */}
      {fotoEntregaCliente && (
        <FotoEntregaModal
          cliente={fotoEntregaCliente}
          onClose={() => setFotoEntregaCliente(null)}
          onShowToast={onShowToast}
        />
      )}

      {/* 📍 Ubicar cliente en el mapa (Fase 1.4) */}
      {ubicarCliente && (
        <UbicarClienteModal
          cliente={ubicarCliente}
          onClose={() => setUbicarClienteId(null)}
          onGuardar={guardarUbicacion}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
