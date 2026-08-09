import React, { useState } from 'react';
import {
  Users,
  Search,
  MessageSquare,
  MapPin,
  Mail,
  Phone,
} from 'lucide-react';
import { Customer } from '../types';
import { Card, Badge, Button, Input } from './ui';

interface CustomersViewProps {
  customers: Customer[];
  onOpenWhatsAppModal: (phone?: string, name?: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onOpenWhatsAppModal,
}) => {
  const [search, setSearch] = useState('');

  const filtered = customers.filter(
    (c) =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.distrito.toLowerCase().includes(search.toLowerCase()) ||
      c.telefono.includes(search)
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Directorio de Clientes VIP & Frecuentes
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Historial consolidado de compras, segmentación de valor y mensajería WhatsApp directa
          </p>
        </div>
      </Card>

      {/* Search Bar */}
      <div className="max-w-md">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente por nombre, distrito o celular..."
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cust) => {
          const badgeVariant =
            cust.estado === 'VIP'
              ? 'purple'
              : cust.estado === 'Frecuente'
              ? 'blue'
              : 'green';

          return (
            <Card
              key={cust.id}
              hoverable
              className="flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-white">{cust.nombre}</h3>
                    <span className="text-xs text-slate-400 font-mono">{cust.telefono}</span>
                  </div>
                  <Badge variant={badgeVariant} size="sm">
                    {cust.estado}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-slate-300 pt-1">
                  <p className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {cust.email}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    {cust.direccionFrecuente} ({cust.distrito})
                  </p>
                </div>
              </div>

              {/* Stats & Action */}
              <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Histórico Total</span>
                  <span className="text-sm font-black text-emerald-400">
                    S/ {cust.totalGastado.toFixed(2)} ({cust.totalPedidos} pedidos)
                  </span>
                </div>

                <Button
                  variant="whatsapp"
                  size="xs"
                  icon={<MessageSquare className="w-3.5 h-3.5" />}
                  onClick={() => onOpenWhatsAppModal(cust.telefono, cust.nombre)}
                >
                  WhatsApp
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
