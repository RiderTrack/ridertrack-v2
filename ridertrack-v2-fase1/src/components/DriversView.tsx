import React from 'react';
import {
  Bike,
  MessageSquare,
  MapPin,
  Star,
} from 'lucide-react';
import { Driver } from '../types';
import { Card, Badge, Button } from './ui';

interface DriversViewProps {
  drivers: Driver[];
  onOpenWhatsAppModal: (phone?: string, name?: string) => void;
  onToggleDriverStatus: (driverId: string) => void;
}

export const DriversView: React.FC<DriversViewProps> = ({
  drivers,
  onOpenWhatsAppModal,
  onToggleDriverStatus,
}) => {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Bike className="w-6 h-6 text-blue-500" />
            Flota de Repartidores & Telemetría
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Monitoreo en tiempo real de velocidad GPS, carga de batería, rating y disponibilidad
          </p>
        </div>
      </Card>

      {/* Driver Cards Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {drivers.map((drv) => {
          const isEnCamino = drv.estado === 'en_camino';
          return (
            <Card
              key={drv.id}
              hoverable
              className="space-y-4"
            >
              <div className="flex items-start gap-3">
                <img
                  src={drv.foto}
                  alt={drv.nombre}
                  className="w-12 h-12 rounded-xl object-cover ring-2 ring-blue-500/50"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-white">{drv.nombre}</h3>
                    <Badge variant={isEnCamino ? 'green' : 'blue'} size="sm" dot pulse={isEnCamino}>
                      {isEnCamino ? 'En Ruta' : 'Disponible'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    {drv.vehiculo} • Placa: {drv.placa}
                  </p>
                  <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                    <Star className="w-3 h-3 fill-emerald-400 text-emerald-400" /> {drv.calificacion} Rating
                  </p>
                </div>
              </div>

              {/* Telemetry Grid */}
              <div className="grid grid-cols-3 gap-2 py-2 bg-slate-900/60 rounded-xl p-2.5 border border-slate-700/60 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block">Velocidad</span>
                  <span className="text-sm font-black text-blue-400">{drv.velocidadActual} km/h</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Batería</span>
                  <span className="text-sm font-black text-emerald-400">{drv.bateria}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Entregas Hoy</span>
                  <span className="text-sm font-black text-white">{drv.entregasHoy}</span>
                </div>
              </div>

              {/* District & Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
                <span className="text-xs text-slate-300 flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-red-400" /> {drv.distritoActual}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => onToggleDriverStatus(drv.id)}
                  >
                    {drv.estado === 'disponible' ? 'Pausar' : 'Activar'}
                  </Button>
                  <Button
                    variant="whatsapp"
                    size="xs"
                    icon={<MessageSquare className="w-3.5 h-3.5" />}
                    onClick={() => onOpenWhatsAppModal(drv.telefono, drv.nombre)}
                    title="WhatsApp"
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
