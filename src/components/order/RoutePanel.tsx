import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Navigation,
  Share2,
  Copy,
  Check,
  Clock,
  Bike,
  Smartphone,
} from 'lucide-react';
import { Order, Driver } from '../../types';
import { Button, Badge, Card } from '../ui';
import { suscribirPosicionRider, type PosicionRider } from '../../services/firestore';

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

  // ⚡ F3.36: velocidad REAL del rider — suscripción en vivo a su
  // posición publicada (ruta_activa/{uid}). Hasta la 3.35 aquí
  // salía un “0 km/h · GPS Activo” SIMULADO (velocidadActual: 0
  // hardcodeado) — de ahí el “0 km” que nunca se movía.
  const [posRider, setPosRider] = useState<PosicionRider | null>(null);
  const uidRider =
    assignedDriver && assignedDriver.id.length >= 20 ? assignedDriver.id : null;

  useEffect(() => {
    if (!uidRider) {
      setPosRider(null);
      return;
    }
    return suscribirPosicionRider(uidRider, setPosRider);
  }, [uidRider]);

  // Re-chequear la frescura del latido cada 15 s (para que “GPS
  // activo” se apague solo si el rider cerró su vista de GPS)
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const latidoFresco = (() => {
    if (!posRider?.actualizadoAt) return false;
    try {
      return Date.now() - new Date(posRider.actualizadoAt).getTime() < 45000;
    } catch {
      return false;
    }
  })();

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
              {latidoFresco ? (
                <span
                  className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono"
                  title="Velocidad en vivo del rider — publicada por su GPS (vista GPS del Motorizado o el velocímetro del Seguimiento)"
                >
                  ⚡ {Math.round(posRider?.velocidadKmh ?? 0)} km/h · GPS activo
                </span>
              ) : (
                <span
                  className="text-[10px] bg-slate-700/40 text-slate-400 px-2 py-0.5 rounded-full font-mono"
                  title="El rider no está publicando señal ahora. Se enciende solo cuando tiene abierto su GPS (vista GPS del Motorizado o el velocímetro del Seguimiento)"
                >
                  ⚪ Sin señal GPS
                </span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ⚡ F3.59: MAPA REAL (antes era un cuadradito decorativo
          "Simulated Map Visualizer" que no mostraba nada). Ahora
          un embed de Google Maps: usa las COORDENADAS del pedido
          si ya fueron geolocalizadas, y si no, busca la dirección.
          Se puede tocar, mover y hacer zoom como en Google Maps. */}
      <div className="relative h-44 w-full rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950">
        {order.lat != null && order.lng != null ? (
          <iframe
            title={`Mapa de ${order.cliente}`}
            src={`https://maps.google.com/maps?q=${order.lat},${order.lng}&z=16&output=embed`}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <iframe
            title={`Mapa de ${order.cliente}`}
            src={`https://maps.google.com/maps?q=${fullAddressQuery}&z=16&output=embed`}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
        {/* Etiqueta flotante con la dirección (para contexto) */}
        <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none">
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-sm border border-slate-700/60 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-red-400 shrink-0" />
            <p className="text-[10px] font-bold text-white truncate">
              {order.direccion || 'sin dirección'}
              {order.distrito ? ` · ${order.distrito}` : ''}
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
