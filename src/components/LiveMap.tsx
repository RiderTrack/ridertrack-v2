import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Bike,
  Navigation2,
  Zap,
  BatteryCharging,
  Maximize2,
  RotateCcw,
  MessageSquare,
  Eye,
  SlidersHorizontal,
  Clock,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Driver, Order } from '../types';

interface LiveMapProps {
  drivers: Driver[];
  orders: Order[];
  onSelectDriver?: (driver: Driver) => void;
  onOpenWhatsApp?: (telefono: string, nombre: string) => void;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  drivers,
  orders,
  onSelectDriver,
  onOpenWhatsApp,
}) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(drivers[0]?.id || null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'en_camino' | 'disponible'>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isLiveSimulating, setIsLiveSimulating] = useState<boolean>(true);
  const [driverPositions, setDriverPositions] = useState<Driver[]>(drivers);

  // Sync state if props change
  useEffect(() => {
    setDriverPositions(drivers);
  }, [drivers]);

  // Subtle live position oscillation simulation for realism
  useEffect(() => {
    if (!isLiveSimulating) return;
    const interval = setInterval(() => {
      setDriverPositions((prev) =>
        prev.map((d) => {
          if (d.estado === 'en_camino') {
            const dx = (Math.random() - 0.48) * 1.2;
            const dy = (Math.random() - 0.48) * 1.2;
            return {
              ...d,
              lat: Math.max(10, Math.min(90, d.lat + dy)),
              lng: Math.max(10, Math.min(90, d.lng + dx)),
              velocidadActual: Math.max(15, Math.min(55, Math.round(d.velocidadActual + (Math.random() - 0.5) * 4))),
              ultimaActualizacion: 'Hace 1s',
            };
          }
          return d;
        })
      );
    }, 2500);
    return () => clearInterval(interval);
  }, [isLiveSimulating]);

  const activeDriver = driverPositions.find((d) => d.id === selectedDriverId) || driverPositions[0];

  const filteredDrivers = driverPositions.filter((d) => {
    if (filterStatus === 'en_camino') return d.estado === 'en_camino';
    if (filterStatus === 'disponible') return d.estado === 'disponible';
    return true;
  });

  return (
    <div className="relative rounded-2xl bg-slate-800 dark:bg-slate-800 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-200 overflow-hidden shadow-xl flex flex-col h-[520px]">
      {/* Map Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between p-3.5 px-5 bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-100 border-b border-slate-700/70 dark:border-slate-700/70 light:border-slate-200 z-10 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white dark:text-white light:text-slate-900 flex items-center gap-2">
              Telemetría y Mapa en Tiempo Real
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {driverPositions.length} Repartidores rastreados por GPS diferencial
            </p>
          </div>
        </div>

        {/* Controls & Status Filter */}
        <div className="flex items-center gap-2">
          {/* Status filter pill */}
          <div className="flex p-1 rounded-xl bg-slate-800 dark:bg-slate-800 light:bg-slate-200 border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-xs font-medium">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({driverPositions.length})
            </button>
            <button
              onClick={() => setFilterStatus('en_camino')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterStatus === 'en_camino'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              En Ruta
            </button>
            <button
              onClick={() => setFilterStatus('disponible')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterStatus === 'disponible'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Disponibles
            </button>
          </div>

          {/* Live Simulation Switch */}
          <button
            onClick={() => setIsLiveSimulating(!isLiveSimulating)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isLiveSimulating
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Pausar/Reanudar simulación GPS en vivo"
          >
            <Zap className={`w-3.5 h-3.5 ${isLiveSimulating ? 'animate-bounce text-amber-400' : ''}`} />
            <span className="hidden sm:inline">{isLiveSimulating ? 'GPS Vivo ON' : 'Pausado'}</span>
          </button>
        </div>
      </div>

      {/* Main Vector Map Body */}
      <div className="relative flex-1 bg-slate-950 dark:bg-slate-950 light:bg-slate-900 overflow-hidden select-none">
        {/* Vector City Map SVG Background */}
        <svg
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
          style={{ transform: `scale(${zoomLevel})` }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Water bay area */}
          <path
            d="M 0 0 L 25 0 Q 20 40 10 70 Q 5 85 0 100 Z"
            fill="#0f172a"
            opacity="0.6"
          />
          <path
            d="M 0 0 L 23 0 Q 18 38 8 68 Q 3 83 0 98 Z"
            fill="#0284c7"
            opacity="0.1"
          />

          {/* Main Road Grid Networks */}
          <g stroke="#334155" strokeWidth="0.4" opacity="0.6" strokeDasharray="none">
            {/* Major Avenues */}
            <line x1="10" y1="20" x2="90" y2="20" stroke="#475569" strokeWidth="0.8" />
            <line x1="10" y1="45" x2="95" y2="45" stroke="#475569" strokeWidth="1.2" />
            <line x1="5" y1="75" x2="95" y2="75" stroke="#475569" strokeWidth="0.9" />

            <line x1="25" y1="5" x2="25" y2="95" stroke="#475569" strokeWidth="1" />
            <line x1="50" y1="5" x2="50" y2="95" stroke="#475569" strokeWidth="1.4" />
            <line x1="75" y1="5" x2="75" y2="95" stroke="#475569" strokeWidth="1" />

            {/* Secondary Diagonal Expressways */}
            <line x1="20" y1="10" x2="80" y2="85" stroke="#3b82f6" strokeWidth="0.8" opacity="0.4" />
            <line x1="85" y1="15" x2="15" y2="80" stroke="#f59e0b" strokeWidth="0.6" opacity="0.3" />

            {/* Grid blocks */}
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={`h-${i}`} x1="10" y1={10 + i * 11} x2="90" y2={10 + i * 11} />
            ))}
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={`v-${i}`} x1={15 + i * 9} y1="10" x2={15 + i * 9} y2="90" />
            ))}
          </g>

          {/* District Labels */}
          <g textAnchor="middle" fill="#64748b" fontSize="2.2" fontWeight="700">
            <text x="28" y="28">MIRAFLORES</text>
            <text x="58" y="22">SAN ISIDRO</text>
            <text x="42" y="62">SURCO</text>
            <text x="75" y="55">SAN BORJA</text>
            <text x="22" y="80">BARRANCO</text>
            <text x="78" y="82">LA MOLINA</text>
          </g>

          {/* Active Route Polylines to active delivery points */}
          {filteredDrivers.map((driver) => {
            if (driver.estado !== 'en_camino') return null;
            // Target order
            const activeOrder = orders.find((o) => o.repartidorId === driver.id);
            const targetX = driver.lng + 12;
            const targetY = driver.lat - 8;

            return (
              <g key={`route-${driver.id}`}>
                <line
                  x1={driver.lng}
                  y1={driver.lat}
                  x2={targetX}
                  y2={targetY}
                  stroke={driver.id === selectedDriverId ? '#3b82f6' : '#10b981'}
                  strokeWidth="0.7"
                  strokeDasharray="1.5 1"
                  opacity="0.8"
                />
                {/* Destination Drop Pin */}
                <circle cx={targetX} cy={targetY} r="1.5" fill="#ef4444" opacity="0.8" />
                <circle cx={targetX} cy={targetY} r="3" fill="none" stroke="#ef4444" strokeWidth="0.4" opacity="0.5" />
              </g>
            );
          })}
        </svg>

        {/* Driver Pins Layer */}
        <div className="absolute inset-0">
          {filteredDrivers.map((driver) => {
            const isSelected = driver.id === selectedDriverId;
            const statusColor =
              driver.estado === 'en_camino'
                ? 'bg-emerald-500 text-emerald-950 border-emerald-300'
                : driver.estado === 'disponible'
                ? 'bg-blue-500 text-blue-950 border-blue-300'
                : 'bg-amber-500 text-amber-950 border-amber-300';

            return (
              <div
                key={driver.id}
                onClick={() => {
                  setSelectedDriverId(driver.id);
                  if (onSelectDriver) onSelectDriver(driver);
                }}
                style={{
                  left: `${driver.lng}%`,
                  top: `${driver.lat}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute cursor-pointer group transition-all duration-300 z-20"
              >
                {/* Pulse halo */}
                <span
                  className={`absolute -inset-2 rounded-full opacity-60 animate-ping pointer-events-none ${
                    isSelected ? 'bg-blue-500' : driver.estado === 'en_camino' ? 'bg-emerald-500' : 'bg-blue-400'
                  }`}
                />

                {/* Driver Pin Marker */}
                <div
                  className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-xl font-bold text-xs transition-transform ${statusColor} ${
                    isSelected ? 'scale-125 ring-4 ring-blue-500/50 z-30' : 'group-hover:scale-110'
                  }`}
                >
                  <Bike className="w-4 h-4" />
                </div>

                {/* Mini Driver Label Box */}
                <div
                  className={`absolute left-1/2 -bottom-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900/90 text-white text-[10px] font-bold whitespace-nowrap border border-slate-700 shadow-md backdrop-blur-md pointer-events-none transition-all ${
                    isSelected ? 'bg-blue-900 border-blue-500 text-white scale-105' : ''
                  }`}
                >
                  {driver.nombre.split(' ')[0]} ({driver.velocidadActual} km/h)
                </div>
              </div>
            );
          })}
        </div>

        {/* Zoom & View Controls Overlay */}
        <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-20">
          <button
            onClick={() => setZoomLevel((z) => Math.min(1.8, z + 0.2))}
            className="p-2 rounded-xl bg-slate-900/90 text-white hover:bg-slate-800 border border-slate-700 shadow-lg text-xs font-bold"
            title="Acercar mapa"
          >
            +
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-2 rounded-xl bg-slate-900/90 text-white hover:bg-slate-800 border border-slate-700 shadow-lg text-xs"
            title="Restablecer vista"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.9, z - 0.2))}
            className="p-2 rounded-xl bg-slate-900/90 text-white hover:bg-slate-800 border border-slate-700 shadow-lg text-xs font-bold"
            title="Alejar mapa"
          >
            -
          </button>
        </div>

        {/* Active Driver Floating Telemetry Card Overlay (Bottom Left) */}
        {activeDriver && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-80 p-4 rounded-2xl bg-slate-900/95 dark:bg-slate-900/95 light:bg-slate-900 border border-slate-700/80 shadow-2xl backdrop-blur-md z-30 transition-all">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={activeDriver.foto}
                  alt={activeDriver.nombre}
                  className="w-11 h-11 rounded-xl object-cover ring-2 ring-blue-500/50"
                />
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                    {activeDriver.nombre}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                      ⭐ {activeDriver.calificacion}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    {activeDriver.vehiculo} • Placa: {activeDriver.placa}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                  activeDriver.estado === 'en_camino'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}
              >
                {activeDriver.estado === 'en_camino' ? 'En Ruta' : 'Disponible'}
              </span>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-2 py-3 text-center">
              <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Velocidad</span>
                <span className="text-sm font-black text-blue-400 flex items-center justify-center gap-0.5">
                  <Navigation2 className="w-3 h-3 animate-pulse" /> {activeDriver.velocidadActual} km/h
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Batería GPS</span>
                <span className="text-sm font-black text-emerald-400 flex items-center justify-center gap-0.5">
                  <BatteryCharging className="w-3 h-3" /> {activeDriver.bateria}%
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Último Ping</span>
                <span className="text-xs font-bold text-slate-200 mt-0.5 block truncate">
                  {activeDriver.ultimaActualizacion}
                </span>
              </div>
            </div>

            {/* Location & Quick Action */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-red-400" />
                <span className="font-medium">{activeDriver.distritoActual}</span>
              </div>

              {onOpenWhatsApp && (
                <button
                  onClick={() => onOpenWhatsApp(activeDriver.telefono, activeDriver.nombre)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
