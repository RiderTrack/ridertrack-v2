import React, { useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { Order, Driver } from '../types';
import { Modal, Button, Input } from './ui';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: Driver[];
  onCreateOrder: (newOrder: Order) => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  drivers,
  onCreateOrder,
}) => {
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('+51 ');
  const [distrito, setDistrito] = useState('Miraflores');
  const [direccion, setDireccion] = useState('');
  const [monto, setMonto] = useState('75.00');
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Yape/Plin' | 'Tarjeta' | 'Transferencia'>('Yape/Plin');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [productoTexto, setProductoTexto] = useState('Burger Combo Doble, Papas, Gaseosa 500ml');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente || !direccion) return;

    const chosenDriver = drivers.find((d) => d.id === selectedDriverId);
    const newId = `PED-${Math.floor(4000 + Math.random() * 900)}`;

    const newOrder: Order = {
      id: newId,
      cliente,
      clienteTelefono: telefono || '+51 987 654 321',
      distrito,
      direccion,
      estado: chosenDriver ? 'en_camino' : 'pendiente',
      repartidorId: chosenDriver?.id,
      repartidorNombre: chosenDriver?.nombre,
      repartidorFoto: chosenDriver?.foto,
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      monto: parseFloat(monto) || 60,
      metodoPago,
      productos: productoTexto.split(',').map((p) => p.trim()),
    };

    onCreateOrder(newOrder);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear Nuevo Pedido"
      subtitle="Ingreso directo al sistema de despacho operativo"
      maxWidth="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleSubmit}
          >
            Registrar & Despachar
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cliente & Teléfono */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Cliente *"
            required
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Nombre del cliente"
          />
          <Input
            label="Teléfono WhatsApp"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+51 987 654 321"
          />
        </div>

        {/* Distrito & Dirección */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Distrito</label>
            <select
              value={distrito}
              onChange={(e) => setDistrito(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="Miraflores">Miraflores</option>
              <option value="San Isidro">San Isidro</option>
              <option value="Surco">Surco</option>
              <option value="San Borja">San Borja</option>
              <option value="San Miguel">San Miguel</option>
              <option value="Barranco">Barranco</option>
              <option value="La Molina">La Molina</option>
              <option value="Lince">Lince</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Dirección Completa *"
              required
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ej. Av. Larco 450, Dpto 802"
            />
          </div>
        </div>

        {/* Monto & Pago */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Monto Total (S/)"
            type="number"
            step="0.5"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Método de Pago</label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="Yape/Plin">Yape / Plin</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
              <option value="Transferencia">Transferencia Bancaria</option>
            </select>
          </div>
        </div>

        {/* Asignar Repartidor */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Asignar Repartidor
          </label>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Asignación Automática / Pendiente --</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre} ({d.vehiculo} - {d.distritoActual}) - {d.estado}
              </option>
            ))}
          </select>
        </div>

        {/* Productos */}
        <Input
          label="Detalle de Productos (separados por coma)"
          value={productoTexto}
          onChange={(e) => setProductoTexto(e.target.value)}
          placeholder="Ej: Burger Doble, Papas, Gaseosa"
        />
      </form>
    </Modal>
  );
};
