import React, { useState, useEffect } from 'react';
import { Package, Plus, User, Phone, MapPin, Home, DollarSign, ShoppingBag, FileText } from 'lucide-react';
import { Modal, Button, Input } from './ui';
import { DISTRITOS_LIMA } from '../utils/realData';

export interface NewOrderDraft {
  nombre: string;
  cel: string;
  prod: string;
  monto: number;
  dir: string;
  dist: string;
  obs: string;
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder: (draft: NewOrderDraft) => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onCreateOrder,
}) => {
  const [nombre, setNombre] = useState('');
  const [cel, setCel] = useState('');
  const [distrito, setDistrito] = useState('');
  const [direccion, setDireccion] = useState('');
  const [monto, setMonto] = useState('');
  const [productoTexto, setProductoTexto] = useState('');
  const [obs, setObs] = useState('');
  const [error, setError] = useState('');

  // Limpiar formulario al abrir
  useEffect(() => {
    if (isOpen) {
      setNombre('');
      setCel('');
      setDistrito('');
      setDireccion('');
      setMonto('');
      setProductoTexto('');
      setObs('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!nombre.trim()) {
      setError('Ingresa el nombre del cliente');
      return;
    }
    if (!direccion.trim()) {
      setError('Ingresa la dirección de entrega');
      return;
    }
    const celLimpio = cel.replace(/[^0-9]/g, '');
    if (celLimpio && celLimpio.length !== 9) {
      setError('El teléfono debe tener 9 dígitos (ej: 987654321)');
      return;
    }

    onCreateOrder({
      nombre: nombre.trim(),
      cel: celLimpio,
      prod: productoTexto.trim(),
      monto: parseFloat(monto) || 0,
      dir: direccion.trim(),
      dist: distrito.trim(),
      obs: obs.trim(),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar Pedido a la Ruta"
      subtitle="Se guarda en tu ruta activa de Firestore — el bot lo ve al instante"
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
            onClick={() => handleSubmit()}
          >
            Agregar a la Ruta
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cliente & Teléfono */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Nombre del Cliente *"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: María Flores"
            icon={<User className="w-4 h-4" />}
            required
          />
          <Input
            label="Teléfono (9 dígitos)"
            value={cel}
            onChange={(e) => setCel(e.target.value)}
            placeholder="987654321"
            icon={<Phone className="w-4 h-4" />}
          />
        </div>

        {/* Distrito & Dirección */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" /> Distrito
            </label>
            <input
              list="distritos-lima"
              value={distrito}
              onChange={(e) => setDistrito(e.target.value)}
              placeholder="Ej: Miraflores"
              className="w-full px-3 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
            />
            <datalist id="distritos-lima">
              {DISTRITOS_LIMA.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <Input
            label="Dirección de Entrega *"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Ej: Av. Larco 742, dpto 301"
            icon={<Home className="w-4 h-4" />}
            required
          />
        </div>

        {/* Monto & Productos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Monto a Cobrar (S/)"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="75.00"
            type="number"
            step="0.10"
            min="0"
            icon={<DollarSign className="w-4 h-4" />}
          />
          <Input
            label="Productos (separados por comas)"
            value={productoTexto}
            onChange={(e) => setProductoTexto(e.target.value)}
            placeholder="Combo Doble, Papas, Gaseosa"
            icon={<ShoppingBag className="w-4 h-4" />}
          />
        </div>

        {/* Observación */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-400" /> Observación (opcional)
          </label>
          <textarea
            rows={2}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ej: dejar en recepción, llamar al llegar..."
            className="w-full px-3 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5">
            ⚠️ {error}
          </p>
        )}

        <p className="text-[10px] text-slate-400">
          El pedido se agrega con estado <span className="text-amber-400 font-bold">Pendiente</span> al
          final de tu ruta. Podrás cobrarlo, marcarlo como fallido o enviarle WhatsApp desde el
          Centro de Pedidos.
        </p>
      </form>
    </Modal>
  );
};
