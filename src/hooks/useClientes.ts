// ═══════════════════════════════════════════════════════════
// 📋 HOOK useClientes - RiderTrack V2
// Maneja la lista de clientes del día desde Firestore
// CON SINCRONIZACIÓN BIDIRECCIONAL CON RIDERTRACK MODULAR
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Cliente,
  guardarClientes,
  importarExcel,
  subscribeToRutaActiva,
  subscribeToClientesRegistrados,
  actualizarClienteEnRutaActiva,
  publicarClientesEnRutaActiva,
  finalizarRuta,
  guardarYCerrarRuta,
  limpiarRutaSinGuardar,
  subirFotoEntrega,
} from '../services/firestore';
import {
  batchGeocodificar,
  obtenerPosicionActual,
  Coordenadas,
} from '../services/geocoding';
import {
  optimizarOrden,
  distanciaRutaKm,
  LIMA_CENTRO,
  PuntoGeo,
} from '../services/routeOptimizer';
import { useAuth } from './useAuth';

/** Resultado detallado de la optimización (para mostrar en UI) */
export interface ResultadoOptimizarRuta {
  total: number;              // clientes totales
  conUbicacion: number;       // clientes ordenados por distancia real
  sinUbicacion: number;       // clientes sin dirección geocodificable
  geocodificadosAhora: number;// direcciones ubicadas en esta corrida
  desdeCache: number;         // direcciones que ya estaban en caché
  distanciaAntesKm: number;
  distanciaDespuesKm: number;
  ahorroPct: number;          // % de km ahorrados
  tiempoEstimadoMin: number;
  conGPS: boolean;            // si se usó tu posición real como inicio
}

interface ClienteGeo extends PuntoGeo {
  cliente: Cliente;
}

export function useClientes() {
  const { user, profile } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  // Refs para guardar los datos de cada listener por separado
  const clientesRutaRef = useRef<Cliente[]>([]);
  const clientesRegistradosRef = useRef<Cliente[]>([]);
  const actualizandoDesdeV2 = useRef(false);

  // 🔄 Combinar clientes de ambas fuentes
  const combinarClientes = useCallback(() => {
    // Si hay clientes en ruta_activa (ruta del día actual), usar esos
    if (clientesRutaRef.current.length > 0) {
      setClientes(clientesRutaRef.current);
      setLoading(false);
      return;
    }
    // Si no, usar clientes_registrados (todos los históricos del Modular)
    if (clientesRegistradosRef.current.length > 0) {
      setClientes(clientesRegistradosRef.current);
      setLoading(false);
      return;
    }
    // Si no hay en ninguno, mantener vacío
    setClientes([]);
    setLoading(false);
  }, []);

  // 🔄 Escuchar AMBAS colecciones del Modular:
  // 1. ruta_activa (ruta del día actual)
  // 2. clientes_registrados (todos los clientes históricos)
  useEffect(() => {
    if (!user) {
      setClientes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Escuchar ruta_activa (clientes del día actual)
    const unsubRuta = subscribeToRutaActiva(
      (clientesModular) => {
        clientesRutaRef.current = clientesModular;
        if (!actualizandoDesdeV2.current) {
          combinarClientes();
        } else {
          actualizandoDesdeV2.current = false;
        }
      },
      () => setLoading(false)
    );

    // 2. Escuchar clientes_registrados (todos los clientes históricos)
    const unsubRegistrados = subscribeToClientesRegistrados(
      (clientesRegistrados) => {
        clientesRegistradosRef.current = clientesRegistrados;
        if (!actualizandoDesdeV2.current) {
          combinarClientes();
        }
      },
      () => setLoading(false)
    );

    return () => {
      unsubRuta();
      unsubRegistrados();
    };
  }, [user, combinarClientes]);

  // Guardar clientes en ruta_activa Y en V2 (respaldo)
  const guardar = useCallback(async (nuevosClientes: Cliente[]) => {
    if (!user) return;
    actualizandoDesdeV2.current = true;
    setClientes(nuevosClientes);
    // Publicar en ruta_activa PRIMERO (fuente de verdad del Modular)
    await publicarClientesEnRutaActiva(user.uid, nuevosClientes);
    // Guardar en V2 como respaldo
    await guardarClientes(user.uid, nuevosClientes);
  }, [user]);

  // Agregar un cliente
  const agregarCliente = useCallback((cliente: Cliente) => {
    const nuevos = [...clientes, cliente];
    guardar(nuevos);
  }, [clientes, guardar]);

  // Actualizar un cliente
  const actualizarCliente = useCallback((id: string | number, cambios: Partial<Cliente>) => {
    const nuevos = clientes.map(c => c.id === id ? { ...c, ...cambios } : c);
    guardar(nuevos);
  }, [clientes, guardar]);

  // Eliminar un cliente
  const eliminarCliente = useCallback((id: string | number) => {
    const nuevos = clientes.filter(c => c.id !== id);
    guardar(nuevos);
  }, [clientes, guardar]);

  // Cambiar estado (pago) - sincroniza con ruta_activa en tiempo real
  const cambiarEstado = useCallback((id: string | number, estado: string) => {
    const hora = estado !== 'pendiente' ? new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';
    const nuevos = clientes.map(c => {
      if (c.id === id) {
        return { ...c, st: estado, hora };
      }
      return c;
    });
    guardar(nuevos);
    // También actualizar en ruta_activa (optimistic update para que el Modular lo vea al instante)
    if (user) {
      actualizarClienteEnRutaActiva(user.uid, id, { st: estado, hora });
    }
  }, [clientes, guardar, user]);

  // Importar desde Excel - sincroniza con ruta_activa automáticamente
  const importarDesdeExcel = useCallback(async (file: File): Promise<number> => {
    if (!user) return 0;
    setSincronizando(true);
    try {
      const nuevos = await importarExcel(file);
      const todos = [...clientes, ...nuevos];
      await guardar(todos);
      return nuevos.length;
    } finally {
      setSincronizando(false);
    }
  }, [clientes, guardar, user]);

  // 🔄 Sincronización manual (botón "Sync")
  // Recarga forzada desde ruta_activa (donde está el Modular)
  const sincronizarDesdeModular = useCallback(async () => {
    if (!user) return 0;
    setSincronizando(true);
    try {
      // El listener de ruta_activa ya está activo, así que los clientes
      // del Modular ya están en el estado. Solo necesitamos forzar una
      // re-publicación para asegurar consistencia.
      if (clientes.length > 0) {
        await publicarClientesEnRutaActiva(user.uid, clientes);
        await guardarClientes(user.uid, clientes);
      }
      return clientes.length;
    } finally {
      setSincronizando(false);
    }
  }, [user, clientes]);

  // 🏁 FINALIZAR RUTA: guarda resumen en historial, marca como finalizada
  const finalizarRutaActual = useCallback(async () => {
    if (!user || clientes.length === 0) return;
    setSincronizando(true);
    try {
      await finalizarRuta(user.uid, clientes);
      return true;
    } finally {
      setSincronizando(false);
    }
  }, [user, clientes]);

  // 💾 GUARDAR Y CERRAR RUTA: guarda en clientes_registrados y ruta_activa
  const guardarYCerrarRutaActual = useCallback(async () => {
    if (!user || clientes.length === 0) return;
    setSincronizando(true);
    try {
      await guardarYCerrarRuta(user.uid, clientes);
      return true;
    } finally {
      setSincronizando(false);
    }
  }, [user, clientes]);

  // 🗑️ LIMPIAR SIN GUARDAR: vacía ruta_activa y estado local
  const limpiarRuta = useCallback(async () => {
    if (!user) return;
    setSincronizando(true);
    try {
      await limpiarRutaSinGuardar(user.uid);
      setClientes([]);
      return true;
    } finally {
      setSincronizando(false);
    }
  }, [user]);

  // 🚀 OPTIMIZAR RUTA (Fase 1.3 — distancia REAL)
  // 1. Geocodifica las direcciones que faltan (con caché y rate
  //    limit — nunca inventa coordenadas)
  // 2. Guarda las coordenadas en Firestore (no se vuelve a
  //    geocodificar la misma dirección jamás)
  // 3. Ordena con vecino-más-cercano + 2-opt desde tu posición
  //    GPS (o centro de Lima si no hay señal)
  // 4. Los que no se pudieron ubicar van al final, agrupados
  //    por distrito (comportamiento honesto, sin mentir)
  const optimizarRuta = useCallback(async (
    onProgress?: (mensaje: string) => void
  ): Promise<ResultadoOptimizarRuta | null> => {
    if (clientes.length === 0) return null;
    setSincronizando(true);
    try {
      // ── Paso 1: separar los que ya tienen coordenadas guardadas
      let conCoords: ClienteGeo[] = [];
      let sinCoords: Cliente[] = [];
      for (const c of clientes) {
        if (
          typeof c.lat === 'number' && typeof c.lng === 'number' &&
          !isNaN(c.lat) && !isNaN(c.lng)
        ) {
          conCoords.push({ lat: c.lat, lng: c.lng, cliente: c });
        } else {
          sinCoords.push(c);
        }
      }

      // ── Paso 2: geocodificar los que faltan
      let geocodificadosAhora = 0;
      let desdeCache = 0;
      if (sinCoords.length > 0) {
        const items = sinCoords.map((c) => ({
          item: c,
          dir: c.dir || '',
          dist: c.dist || '',
        }));
        const { resueltos, fallidos, desdeCache: nCache } = await batchGeocodificar<Cliente>(
          items,
          onProgress
        );
        desdeCache = nCache;
        geocodificadosAhora = resueltos.size;
        resueltos.forEach((coords: Coordenadas, c: Cliente) => {
          conCoords.push({ lat: coords.lat, lng: coords.lng, cliente: { ...c, lat: coords.lat, lng: coords.lng } });
        });
        sinCoords = fallidos;
      }

      // ── Paso 3: posición GPS actual como punto de partida
      onProgress?.('Obteniendo tu posición GPS…');
      const gps = await obtenerPosicionActual(5000);
      const inicio = gps ?? LIMA_CENTRO;

      // ── Paso 4: distancia ANTES (orden actual) vs optimizada
      onProgress?.('Calculando la mejor ruta…');
      const ordenActual = conCoords.map((cg) => cg.cliente);
      const distanciaAntesKm = ordenActual.length > 0
        ? distanciaRutaKm(conCoords, inicio)
        : 0;

      const optimizado = optimizarOrden<ClienteGeo>(conCoords, inicio);

      // ── Paso 5: sin ubicación al final, agrupados por distrito
      const sinUbicacionOrdenados = [...sinCoords].sort((a, b) => {
        const distA = (a.dist || '').toLowerCase().trim();
        const distB = (b.dist || '').toLowerCase().trim();
        if (distA && !distB) return -1;
        if (!distA && distB) return 1;
        return distA.localeCompare(distB);
      });

      const listaFinal: Cliente[] = [
        ...optimizado.orden.map((cg) => cg.cliente),
        ...sinUbicacionOrdenados,
      ].map((c, idx) => ({ ...c, num: idx + 1 }));

      // ── Paso 6: persistir (nuevo orden + coordenadas nuevas)
      await guardar(listaFinal);

      const conUbicacion = optimizado.orden.length;
      const ahorro = distanciaAntesKm > 0 && optimizado.distanciaKm > 0
        ? Math.max(0, Math.round((1 - optimizado.distanciaKm / distanciaAntesKm) * 100))
        : 0;

      return {
        total: listaFinal.length,
        conUbicacion,
        sinUbicacion: sinCoords.length,
        geocodificadosAhora,
        desdeCache,
        distanciaAntesKm,
        distanciaDespuesKm: optimizado.distanciaKm,
        ahorroPct: ahorro,
        tiempoEstimadoMin: optimizado.tiempoMin,
        conGPS: !!gps,
      };
    } finally {
      setSincronizando(false);
    }
  }, [clientes, guardar]);

  // ⬆️⬇️ MOVER CLIENTE: cambia el orden de un cliente (arriba/abajo)
  const moverCliente = useCallback((id: string | number, direccion: 'arriba' | 'abajo') => {
    const idx = clientes.findIndex(c => c.id === id);
    if (idx === -1) return;

    const nuevoIdx = direccion === 'arriba' ? idx - 1 : idx + 1;
    if (nuevoIdx < 0 || nuevoIdx >= clientes.length) return;

    const nuevos = [...clientes];
    const temp = nuevos[idx];
    nuevos[idx] = nuevos[nuevoIdx];
    nuevos[nuevoIdx] = temp;

    // Reasignar números de orden
    const conNuevoOrden = nuevos.map((c, i) => ({ ...c, num: i + 1 }));
    guardar(conNuevoOrden);
  }, [clientes, guardar]);

  // ✏️ EDITAR NÚMERO DE ORDEN: cambia manualmente el número de un cliente
  // y reorganiza los demás clientes según corresponda
  const editarNumeroOrden = useCallback((id: string | number, nuevoNum: number) => {
    if (!nuevoNum || nuevoNum < 1) return;
    const idx = clientes.findIndex(c => c.id === id);
    if (idx === -1) return;

    const maxNum = clientes.length;
    const numFinal = Math.min(Math.max(nuevoNum, 1), maxNum);

    // Si el nuevo número es igual al actual, no hacer nada
    if (numFinal === idx + 1) return;

    // Crear nueva lista: remover el cliente y reinsertarlo en la nueva posición
    const nuevos = [...clientes];
    const [clienteMovido] = nuevos.splice(idx, 1);
    nuevos.splice(numFinal - 1, 0, clienteMovido);

    // Reasignar números de orden
    const conNuevoOrden = nuevos.map((c, i) => ({ ...c, num: i + 1 }));
    guardar(conNuevoOrden);
  }, [clientes, guardar]);

  // 📷 GUARDAR FOTO DE ENTREGA: sube a Storage (o base64 de respaldo)
  // y actualiza el cliente con la URL de la foto
  const guardarFotoEntrega = useCallback(async (
    clienteId: string | number,
    file: File | Blob,
    dataUrlFallback?: string
  ): Promise<string> => {
    if (!user) throw new Error('No hay sesión activa');
    setSincronizando(true);
    try {
      // 1. Subir foto (Storage con fallback base64 si falla)
      const fotoUrl = await subirFotoEntrega(user.uid, clienteId, file, dataUrlFallback);

      // 2. Actualizar el cliente con la URL de la foto
      const nuevos = clientes.map(c =>
        c.id === clienteId ? { ...c, fotoUrl } : c
      );
      await guardar(nuevos);

      // 3. También actualizar en ruta_activa (sincronización con Modular)
      await actualizarClienteEnRutaActiva(user.uid, clienteId, { fotoUrl } as any);

      return fotoUrl;
    } finally {
      setSincronizando(false);
    }
  }, [user, clientes, guardar]);

  // Estadísticas
  const stats = useMemo(() => {
    const total = clientes.length;
    const entregados = clientes.filter(c =>
      ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st)
    ).length;
    const pendientes = clientes.filter(c => c.st === 'pendiente' || !c.st).length;
    const fallidos = clientes.filter(c =>
      ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'].includes(c.st)
    ).length;

    const cobrado = clientes
      .filter(c => ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st))
      .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

    const porCobrar = clientes
      .filter(c => c.st === 'pendiente' || !c.st)
      .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

    return { total, entregados, pendientes, fallidos, cobrado, porCobrar, totalDia: cobrado + porCobrar };
  }, [clientes]);

  return {
    clientes,
    loading,
    sincronizando,
    stats,
    guardar,
    agregarCliente,
    actualizarCliente,
    eliminarCliente,
    cambiarEstado,
    importarDesdeExcel,
    sincronizarDesdeModular,
    finalizarRutaActual,
    guardarYCerrarRutaActual,
    limpiarRuta,
    optimizarRuta,
    moverCliente,
    editarNumeroOrden,
    guardarFotoEntrega,
  };
}
