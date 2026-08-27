import React from 'react';
import {
  Bike,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  MapPin,
  BarChart3,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { UserProfile } from '../hooks/useAuth';
import { Card, Badge, Button } from './ui';

interface DriversViewProps {
  profile: UserProfile | null;
  stats: {
    total: number;
    entregados: number;
    pendientes: number;
    fallidos: number;
    cobrado: number;
    porCobrar: number;
    totalDia: number;
  };
  onNavigateTab: (tab: any) => void;
}

export const DriversView: React.FC<DriversViewProps> = ({
  profile,
  stats,
  onNavigateTab,
}) => {
  const nombre = profile?.nombre || 'Rider';
  const iniciales = nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Bike className="w-6 h-6 text-blue-500" />
            Mi Perfil de Rider
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Tu rendimiento de hoy, en vivo desde la ruta activa
          </p>
        </div>
        <Badge variant="blue" size="sm" dot pulse>
          En vivo
        </Badge>
      </Card>

      {/* Tarjeta principal del rider */}
      <Card className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar */}
          {profile?.foto ? (
            <img
              src={profile.foto}
              alt={nombre}
              className="w-20 h-20 rounded-2xl object-cover ring-2 ring-blue-500/50 mx-auto sm:mx-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center ring-2 ring-blue-500/50 mx-auto sm:mx-0">
              {iniciales || 'R'}
            </div>
          )}

          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-black text-white">{nombre}</h2>
            <p className="text-xs text-slate-400 font-mono">{profile?.email || '—'}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2 justify-center sm:justify-start">
              <Badge variant="green" size="sm" dot>
                En ruta
              </Badge>
              <Badge variant="blue" size="sm">
                RiderTrack V2
              </Badge>
            </div>
          </div>
        </div>

        {/* Estadísticas reales del día */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 text-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-400 block">Entregas Hoy</span>
            <span className="text-lg font-black text-emerald-400">{stats.entregados}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 text-center">
            <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-400 block">Pendientes</span>
            <span className="text-lg font-black text-amber-400">{stats.pendientes}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 text-center">
            <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-400 block">Incidencias</span>
            <span className="text-lg font-black text-red-400">{stats.fallidos}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 text-center">
            <DollarSign className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-400 block">Cobrado</span>
            <span className="text-lg font-black text-emerald-400">S/ {stats.cobrado.toFixed(0)}</span>
          </div>
        </div>

        {/* Resumen financiero */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Cobranza del día
              </span>
              <span className="text-sm font-black text-white">
                S/ {stats.cobrado.toFixed(2)} cobrados
                <span className="text-slate-400 font-normal"> de S/ {stats.totalDia.toFixed(2)}</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Por cobrar</span>
              <span className="text-sm font-black text-amber-400">
                S/ {stats.porCobrar.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all"
              style={{
                width: `${stats.totalDia > 0 ? Math.min(100, (stats.cobrado / stats.totalDia) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Button
            variant="primary"
            size="sm"
            icon={<Route className="w-4 h-4" />}
            onClick={() => onNavigateTab('ruta')}
          >
            Mi Ruta
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<BarChart3 className="w-4 h-4" />}
            onClick={() => onNavigateTab('estadisticas')}
          >
            Estadísticas
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<MapPin className="w-4 h-4" />}
            onClick={() => onNavigateTab('mapa')}
          >
            Mapa
          </Button>
        </div>
      </Card>

      {/* Nota honesta sobre telemetría */}
      <Card className="flex items-start gap-3 bg-slate-900 border-slate-700">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold text-white mb-1">
            Sobre telemetría GPS y flota
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            RiderTrack V2 es tu panel personal de un solo rider (tú), sincronizado con el bot Rudy.
            La telemetría GPS en vivo (velocidad, batería, posición real) llega con la fase del
            mapa interactivo. Por ahora aquí ves tus métricas reales de entregas y cobranza del día.
          </p>
        </div>
      </Card>
    </div>
  );
};
