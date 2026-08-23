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
import { useAuth } from './useAuth';

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

  // 🚀 OPTIMIZAR RUTA: ordena clientes por distrito (mismo distrito juntos)
  // Esto minimiza la distancia recorrida al agrupar entregas por zona
  const optimizarRuta = useCallback(async () => {
    if (clientes.length === 0) return 0;
    setSincronizando(true);
    try {
      // Ordenar por distrito (alfabético) manteniendo el orden original dentro de cada distrito
      const optimizados = [...clientes].sort((a, b) => {
        const distA = (a.dist || '').toLowerCase().trim();
        const distB = (b.dist || '').toLowerCase().trim();
        if (distA && !distB) return -1;  // a con distrito primero
        if (!distA && distB) return 1;   // b con distrito primero
        return distA.localeCompare(distB);
      });

      // Reasignar números de orden (1, 2, 3...)
      const conNuevoOrden = optimizados.map((c, idx) => ({
        ...c,
        num: idx + 1,
      }));

      await guardar(conNuevoOrden);
      return conNuevoOrden.length;
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

  // 📷 GUARDAR FOTO DE ENTREGA: sube a Storage y actualiza el cliente
  const guardarFotoEntrega = useCallback(async (clienteId: string | number, file: File | Blob): Promise<string> => {
    if (!user) throw new Error('No hay sesión activa');
    setSincronizando(true);
    try {
      // 1. Subir foto a Storage
      const fotoUrl = await subirFotoEntrega(user.uid, clienteId, file);

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
