import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Share2,
  Copy,
  Check,
  Compass,
  Clock,
  Bike,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import { Order, Driver } from '../../types';
import { Button, Badge, Card } from '../ui';

interface RoutePanelProps {
  order: Order;
  drivers: Driver[];
  onShowToast?: (title: string, desc?: string, type?: any) => void;
}

export const RoutePanel: React.FC<RoutePanelProps> = ({
  order,
  drivers,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);
  const assignedDriver = drivers.find((d) => d.id === order.repartidorId);

  const fullAddressQuery = encodeURIComponent(`${order.direccion}, ${order.distrito}, Lima, Peru`);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${fullAddressQuery}`;
  const wazeUrl = `https://waze.com/ul?q=${fullAddressQuery}&navigate=yes`;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(`${order.direccion}, ${order.distrito}`);
    setCopied(true);
    if (onShowToast) {
      onShowToast('Dirección Copiada', `${order.direccion}, ${order.distrito}`, 'success');
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLocation = () => {
    const shareData = {
      title: `Ruta de Entrega - Pedido ${order.id}`,
      text: `Dirección de entrega para ${order.cliente}: ${order.direccion} (${order.distrito})`,
      url: googleMapsUrl,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(googleMapsUrl);
      if (onShowToast) {
        onShowToast('Enlace de Mapa Copiado', 'Listo para pegar en chat', 'info');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Route Header Card */}
      <Card padding="md" className="bg-slate-900 border-slate-700/80 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Badge variant="blue" size="sm" dot pulse>
              Navegación GPS & Georreferencia
            </Badge>
            <h4 className="font-extrabold text-base text-white">{order.cliente}</h4>
            <p className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
              <MapPin className="w-4 h-4 text-red-400 shrink-0" />
              {order.direccion}
            </p>
            <p className="text-xs text-slate-400 font-mono">
              Distrito: <span className="text-white font-semibold">{order.distrito}</span>
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-400 block font-semibold">ETA Estimado</span>
            <span className="text-lg font-black text-purple-400 flex items-center justify-end gap-1">
              <Clock className="w-4 h-4" /> 18 min
            </span>
          </div>
        </div>

        {/* Assigned Rider Info */}
        <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Bike className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Repartidor Asignado</span>
              <span className="font-bold text-white">
                {assignedDriver ? assignedDriver.nombre : order.repartidorNombre || 'Sin Asignar'}
              </span>
            </div>
          </div>

          {assignedDriver && (
            <div className="text-right">
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
                {assignedDriver.velocidadActual} km/h • GPS Activo
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Simulated Map Visualizer Frame */}
      <div className="relative h-44 w-full rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative z-10 space-y-2">
          <div className="w-10 h-10 rounded-full bg-blue-600/30 border border-blue-500 flex items-center justify-center mx-auto text-blue-400 animate-pulse">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Telemetría Geográfica Activada</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Ruta optimizada vía algoritmo Waze/Google Maps Traffic Matrix
            </p>
          </div>
        </div>
      </div>

      {/* Quick Launch Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 rounded-xl bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-colors"
        >
          <Navigation className="w-4 h-4 text-blue-400" />
          <span>Google Maps</span>
        </a>

        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 rounded-xl bg-cyan-600/20 border border-cyan-500/40 hover:bg-cyan-600/30 text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-colors"
        >
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span>Waze GPS</span>
        </a>

        <button
          onClick={handleShareLocation}
          className="p-3 rounded-xl bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-colors"
        >
          <Share2 className="w-4 h-4 text-purple-400" />
          <span>Compartir Link</span>
        </button>

        <button
          onClick={handleCopyAddress}
          className="p-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
          <span>{copied ? '¡Copiado!' : 'Copiar Dirección'}</span>
        </button>
      </div>
    </div>
  );
};
