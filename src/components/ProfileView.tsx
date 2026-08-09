import React from 'react';
import { User, ShieldCheck, Mail, Phone, Lock, CheckCircle2 } from 'lucide-react';

export const ProfileView: React.FC = () => {
  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
            alt="Alejandro Ruiz"
            className="w-16 h-16 rounded-2xl object-cover ring-4 ring-blue-500/50 shadow-xl"
          />
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              Alejandro Ruiz
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                ADMIN
              </span>
            </h1>
            <p className="text-xs text-slate-400">Jefe de Operaciones & Logística de Despacho</p>
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Estado: En línea (Acceso Total)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-700 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80">
            <span className="text-slate-400 block">Correo Electrónico</span>
            <span className="font-bold text-white mt-0.5 block">a.ruiz@ridertrack.pe</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80">
            <span className="text-slate-400 block">Teléfono Verificado</span>
            <span className="font-bold text-white mt-0.5 block">+51 987 000 111</span>
          </div>
        </div>
      </div>
    </div>
  );
};
