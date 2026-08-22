// ═══════════════════════════════════════════════════════════
// 📋 HOOK useClientes - RiderTrack V2
// Maneja la lista de clientes del día desde Firestore
// CON SINCRONIZACIÓN BIDIRECCIONAL CON RIDERTRACK MODULAR
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Cliente,
  subscribeToClientes,
  guardarClientes,
  importarExcel,
  subscribeToRutaActiva,
  actualizarClienteEnRutaActiva,
  publicarClientesEnRutaActiva,
} from '../services/firestore';
import { useAuth } from './useAuth';

export function useClientes() {
  const { user, profile } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  // Flag para evitar loop infinito: cuando V2 actualiza, no queremos
  // que el listener de ruta_activa sobrescriba inmediatamente
  const actualizandoDesdeV2 = useRef(false);

  // 🔄 Suscribirse a cambios en ruta_activa (donde guarda el Modular)
  // Si el Modular cambia algo, V2 lo ve automáticamente
  useEffect(() => {
    if (!user) {
      setClientes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Escuchar usuarios/{uid}/clientes (propio de V2)
    const unsubV2 = subscribeToClientes(
      user.uid,
      (clientesData) => {
        // Si hay clientes en V2 pero ruta_activa está vacío, publicarlos
        if (clientesData.length > 0 && !actualizandoDesdeV2.current) {
          publicarClientesEnRutaActiva(user.uid, clientesData);
        }
        setClientes(clientesData);
        setLoading(false);
      },
      () => setLoading(false)
    );

    // 2. Escuchar ruta_activa (donde guarda el Modular)
    // Si el Modular cambia algo, V2 lo ve automáticamente
    const unsubModular = subscribeToRutaActiva(
      (clientesModular) => {
        if (actualizandoDesdeV2.current) {
          actualizandoDesdeV2.current = false;
          return;
        }

        // Si el Modular tiene clientes y V2 no, cargarlos del Modular
        setClientes(clientesPrev => {
          if (clientesModular.length > 0 && clientesPrev.length === 0) {
            // Copiar clientes del Modular a V2
            guardarClientes(user.uid, clientesModular);
            return clientesModular;
          }
          // Si ambos tienen clientes, fusionar manteniendo estados actualizados del Modular
          if (clientesModular.length > 0 && clientesPrev.length > 0) {
            const clientesFusionados = clientesPrev.map(cV2 => {
              const cMod = clientesModular.find(c => String(c.id) === String(cV2.id));
              if (cMod && cMod.st !== cV2.st) {
                // El Modular actualizó el estado, usar ese
                return { ...cV2, st: cMod.st, hora: cMod.hora };
              }
              return cV2;
            });
            return clientesFusionados;
          }
          return clientesPrev;
        });
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubV2();
      unsubModular();
    };
  }, [user]);

  // Guardar clientes en V2 Y sincronizar con Modular
  const guardar = useCallback(async (nuevosClientes: Cliente[]) => {
    if (!user) return;
    actualizandoDesdeV2.current = true;
    setClientes(nuevosClientes);
    await guardarClientes(user.uid, nuevosClientes);
    // También publicar en ruta_activa para que el Modular lo vea
    await publicarClientesEnRutaActiva(user.uid, nuevosClientes);
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
    // También actualizar en ruta_activa (para que el Modular lo vea al instante)
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

  // 🔄 Sincronización manual (botón "Importar del Modular")
  const sincronizarDesdeModular = useCallback(async () => {
    if (!user) return 0;
    setSincronizando(true);
    try {
      // Como ya escuchamos ruta_activa, los clientes del Modular ya están cargados
      // Solo necesitamos guardarlos en V2 si no estaban
      if (clientes.length > 0) {
        await guardarClientes(user.uid, clientes);
        await publicarClientesEnRutaActiva(user.uid, clientes);
      }
      return clientes.length;
    } finally {
      setSincronizando(false);
    }
  }, [user, clientes]);

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
  };
}
