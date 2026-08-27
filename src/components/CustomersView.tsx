import React, { useState } from 'react';
import {
  Users,
  Search,
  MessageSquare,
  MapPin,
  Phone,
  ExternalLink,
  Package,
} from 'lucide-react';
import { Customer } from '../types';
import { Card, Badge, Button, Input } from './ui';
import { ETIQUETAS_ESTADO, linkGoogleMaps } from '../utils/realData';

interface CustomersViewProps {
  customers: Customer[];
  onOpenWhatsAppModal: (phone?: string, name?: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onOpenWhatsAppModal,
}) => {
  const [search, setSearch] = useState('');

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.distrito.toLowerCase().includes(q) ||
      c.telefono.includes(search) ||
      (ETIQUETAS_ESTADO[c.estadoDelDia] || c.estadoDelDia).toLowerCase().includes(q)
    );
  });

  const badgePara = (st: string): { variant: 'green' | 'amber' | 'red' | 'blue'; label: string } => {
    if (['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(st)) {
      return { variant: 'green', label: ETIQUETAS_ESTADO[st] || st };
    }
    if (['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'].includes(st)) {
      return { variant: 'red', label: ETIQUETAS_ESTADO[st] || st };
    }
    return { variant: 'amber', label: 'Pendiente' };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Clientes de la Ruta
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {customers.length} {customers.length === 1 ? 'cliente' : 'clientes'} en tu ruta de hoy —
            datos en vivo desde Firestore
          </p>
        </div>
        <Badge variant="blue" size="sm" dot pulse>
          En vivo
        </Badge>
      </Card>

      {/* Search Bar */}
      <div className="max-w-md">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, distrito, teléfono o estado..."
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Customer Cards Grid */}
      {filtered.length === 0 && (
        <Card className="text-center py-10">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="font-bold text-white mb-1">
            {customers.length === 0 ? 'Tu ruta no tiene clientes todavía' : 'Sin resultados para tu búsqueda'}
          </p>
          <p className="text-xs text-slate-400">
            {customers.length === 0
              ? 'Agrega clientes desde Mi Ruta o con el botón Agregar Pedido'
              : 'Prueba con otro nombre, distrito o estado'}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cust) => {
          const badge = badgePara(cust.estadoDelDia);
          const mapsUrl = linkGoogleMaps(cust.direccionFrecuente, cust.distrito);

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
                    <span className="text-xs text-slate-400 font-mono">
                      {cust.telefono || 'sin teléfono'}
                    </span>
                  </div>
                  <Badge variant={badge.variant} size="sm">
                    {badge.label}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-slate-300 pt-1">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="truncate">
                      {cust.direccionFrecuente || 'sin dirección'} ({cust.distrito || '—'})
                    </span>
                  </p>
                  {cust.productos && (
                    <p className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{cust.productos}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Monto & Acciones */}
              <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    {badge.variant === 'green' ? 'Cobrado' : 'Por cobrar'}
                  </span>
                  <span className="text-sm font-black text-emerald-400">
                    S/ {cust.monto.toFixed(2)}
                    {cust.hora && (
                      <span className="text-[10px] text-slate-400 font-normal ml-1.5">· {cust.hora}</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {cust.telefono && (
                    <>
                      <Button
                        variant="whatsapp"
                        size="xs"
                        icon={<MessageSquare className="w-3.5 h-3.5" />}
                        onClick={() => onOpenWhatsAppModal(cust.telefono, cust.nombre)}
                        title="WhatsApp"
                      />
                      <Button
                        variant="secondary"
                        size="xs"
                        icon={<Phone className="w-3.5 h-3.5" />}
                        onClick={() => window.open(`tel:${cust.telefono.replace(/\s+/g, '')}`)}
                        title="Llamar"
                      />
                    </>
                  )}
                  {cust.direccionFrecuente && (
                    <Button
                      variant="outline"
                      size="xs"
                      icon={<ExternalLink className="w-3.5 h-3.5" />}
                      onClick={() => window.open(mapsUrl, '_blank')}
                      title="Ver en Google Maps"
                    />
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
