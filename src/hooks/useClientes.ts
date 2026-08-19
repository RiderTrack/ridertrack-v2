// ═══════════════════════════════════════════════════════════
// 📋 HOOK useClientes - RiderTrack V2
// Maneja la lista de clientes del día desde Firestore
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Cliente, subscribeToClientes, guardarClientes, importarExcel } from '../services/firestore';
import { useAuth } from './useAuth';

export function useClientes() {
  const { user, profile } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Suscribirse a cambios de clientes en Firestore
  useEffect(() => {
    if (!user) {
      setClientes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToClientes(
      user.uid,
      (clientesData) => {
        setClientes(clientesData);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [user]);

  // Guardar clientes en Firestore
  const guardar = useCallback(async (nuevosClientes: Cliente[]) => {
    if (!user) return;
    setClientes(nuevosClientes);
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

  // Cambiar estado (pago)
  const cambiarEstado = useCallback((id: string | number, estado: string) => {
    const nuevos = clientes.map(c => {
      if (c.id === id) {
        const hora = estado !== 'pendiente' ? new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';
        return { ...c, st: estado, hora };
      }
      return c;
    });
    guardar(nuevos);
  }, [clientes, guardar]);

  // Importar desde Excel
  const importarDesdeExcel = useCallback(async (file: File): Promise<number> => {
    const nuevos = await importarExcel(file);
    const todos = [...clientes, ...nuevos];
    await guardar(todos);
    return nuevos.length;
  }, [clientes, guardar]);

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
    stats,
    guardar,
    agregarCliente,
    actualizarCliente,
    eliminarCliente,
    cambiarEstado,
    importarDesdeExcel,
  };
}
