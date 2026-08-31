import React, { useState } from 'react';
import { User, ShieldCheck, Mail, Phone, Lock, CheckCircle2, LogOut, Camera, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cerrarSesion } from '../services/firebase';
import { AvatarSvg, avatarPorId } from '../data/avatars';
import { AvatarPicker } from './AvatarPicker';
import { guardarAvatarRider } from '../services/firestore';

export const ProfileView: React.FC = () => {
  const { profile, user } = useAuth();
  const [pickerAbierto, setPickerAbierto] = useState(false);

  const handleLogout = async () => {
    if (confirm('¿Cerrar sesión?')) {
      await cerrarSesion();
    }
  };

  const handleSeleccionarAvatar = async (avatarId: string) => {
    if (!user) throw new Error('Sin sesión');
    await guardarAvatarRider(user.uid, avatarId);
    try {
      localStorage.setItem('rt_avatar', avatarId);
    } catch {
      // sin storage
    }
    // refresco inmediato de la UI (el listener tarda un instante)
    window.location.reload();
  };

  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <AvatarSvg
              id={profile?.avatar}
              className="w-16 h-16"
              anillo="ring-4 ring-blue-500/50 shadow-xl"
            />
            <button
              onClick={() => setPickerAbierto(true)}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 border-2 border-slate-800 flex items-center justify-center hover:bg-blue-500 transition-colors"
              title="Cambiar avatar"
            >
              <Camera className="w-3 h-3 text-white" />
            </button>
          </div>
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

        {/* Sección de avatar — Fase 1.5 */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/25 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Mi avatar
              </p>
              <p className="text-[11px] text-slate-400">
                Ahora eres <b className="text-indigo-300">{avatarPorId(profile?.avatar).nombre}</b> —
                se muestra en el menú, el header y el GPS del motorizado
              </p>
            </div>
            <button
              onClick={() => setPickerAbierto(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95 whitespace-nowrap"
            >
              Cambiar
            </button>
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

      {/* Picker de avatares estilo Netflix */}
      <AvatarPicker
        isOpen={pickerAbierto}
        onClose={() => setPickerAbierto(false)}
        avatarActual={profile?.avatar}
        onSeleccionar={handleSeleccionarAvatar}
      />
    </div>
  );
};
