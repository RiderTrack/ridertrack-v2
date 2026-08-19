import React from 'react';
import { User, ShieldCheck, Mail, Phone, Lock, CheckCircle2, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cerrarSesion } from '../services/firebase';

export const ProfileView: React.FC = () => {
  const { profile, user } = useAuth();

  const handleLogout = async () => {
    if (confirm('¿Cerrar sesión?')) {
      await cerrarSesion();
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          {profile?.foto ? (
            <img
              src={profile.foto}
              alt={profile.nombre}
              className="w-16 h-16 rounded-2xl object-cover ring-4 ring-blue-500/50 shadow-xl"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-emerald-600 flex items-center justify-center text-white text-2xl font-black shadow-xl">
              {(profile?.nombre || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              {profile?.nombre || 'Repartidor'}
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                RIDER
              </span>
            </h1>
            <p className="text-xs text-slate-400">Motorizado de entregas</p>
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Estado: En línea
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-700 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80">
            <span className="text-slate-400 block flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> Correo Electrónico
            </span>
            <span className="font-bold text-white mt-0.5 block">{profile?.email || user?.email || 'Sin email'}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80">
            <span className="text-slate-400 block flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> ID de Usuario
            </span>
            <span className="font-bold text-white mt-0.5 block text-[10px] font-mono">{user?.uid?.substring(0, 20) || 'Sin ID'}...</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full mt-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};
