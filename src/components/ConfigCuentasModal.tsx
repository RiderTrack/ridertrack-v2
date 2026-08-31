// ═══════════════════════════════════════════════════════════
// 🏦 CONFIG CUENTAS MODAL - RiderTrack V2
// Modal para editar números de cuenta bancarios
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { X, Save, Building2, Smartphone, Phone, MapPin, Loader2, Heart } from 'lucide-react';
import { ConfigCuentas, CONFIG_CUENTAS_DEFAULT } from '../services/firestore';
import { useConfig } from '../hooks/useConfig';

interface ConfigCuentasModalProps {
  onClose: () => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ConfigCuentasModal: React.FC<ConfigCuentasModalProps> = ({ onClose, onShowToast }) => {
  const { config, loading, guardando, guardar } = useConfig();
  const [configLocal, setConfigLocal] = useState<ConfigCuentas>(CONFIG_CUENTAS_DEFAULT);

  useEffect(() => {
    if (config) setConfigLocal(config);
  }, [config]);

  const actualizarCampo = (seccion: keyof ConfigCuentas, campo: string, valor: string) => {
    setConfigLocal(prev => ({
      ...prev,
      [seccion]: { ...(prev[seccion] as any), [campo]: valor },
    }));
  };

  // Fase 3.10: sección anidada ventas.{persona}.{campo}
  const actualizarVentas = (persona: 'fabiana' | 'karla' | 'tocho', campo: string, valor: string) => {
    setConfigLocal(prev => ({
      ...prev,
      ventas: {
        ...prev.ventas,
        [persona]: { ...(prev.ventas?.[persona] as any), [campo]: valor },
      },
    }));
  };

  const handleGuardar = async () => {
    try {
      await guardar(configLocal);
      onShowToast?.('🏦 Configuración guardada', 'Las cuentas bancarias se actualizaron', 'success');
      onClose();
    } catch (e: any) {
      onShowToast?.('❌ Error', e.message || 'No se pudo guardar', 'error');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              Configurar Cuentas Bancarias
            </h3>
            <p className="text-[10px] text-slate-400">Estos datos se usarán al enviar cuentas a los clientes</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* EMPRESA */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-emerald-400 uppercase font-bold flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Datos de la Empresa
            </div>
            <CampoInput label="Nombre empresa" value={configLocal.empresa?.nombre || ''} onChange={v => actualizarCampo('empresa', 'nombre', v)} placeholder="MATE" color="emerald" />
            <CampoInput label="Teléfono empresa" value={configLocal.empresa?.telefono || ''} onChange={v => actualizarCampo('empresa', 'telefono', v)} placeholder="+51999999999" color="emerald" />
            <CampoInput label="Dirección empresa" value={configLocal.empresa?.direccion || ''} onChange={v => actualizarCampo('empresa', 'direccion', v)} placeholder="Lima, Perú" color="emerald" />
          </div>

          {/* YAPE */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-purple-400 uppercase font-bold flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Yape
            </div>
            <CampoInput label="Titular" value={configLocal.yape?.nombre || ''} onChange={v => actualizarCampo('yape', 'nombre', v)} placeholder="Nombre del titular" color="purple" />
            <CampoInput label="Teléfono Yape" value={configLocal.yape?.telefono || ''} onChange={v => actualizarCampo('yape', 'telefono', v)} placeholder="999999999" color="purple" />
          </div>

          {/* PLIN */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-blue-400 uppercase font-bold flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Plin
            </div>
            <CampoInput label="Titular" value={configLocal.plin?.nombre || ''} onChange={v => actualizarCampo('plin', 'nombre', v)} placeholder="Nombre del titular" color="blue" />
            <CampoInput label="Teléfono Plin" value={configLocal.plin?.telefono || ''} onChange={v => actualizarCampo('plin', 'telefono', v)} placeholder="999999999" color="blue" />
          </div>

          {/* BCP */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-sky-400 uppercase font-bold flex items-center gap-1">
              <Building2 className="w-3 h-3" /> BCP
            </div>
            <CampoInput label="Titular" value={configLocal.bcp?.titular || ''} onChange={v => actualizarCampo('bcp', 'titular', v)} placeholder="Nombre del titular" color="sky" />
            <CampoInput label="Número de cuenta" value={configLocal.bcp?.numero || ''} onChange={v => actualizarCampo('bcp', 'numero', v)} placeholder="999-99999999-9-99" color="sky" mono />
            <CampoInput label="CCI" value={configLocal.bcp?.cci || ''} onChange={v => actualizarCampo('bcp', 'cci', v)} placeholder="002-999-999999999999-99" color="sky" mono />
          </div>

          {/* BBVA */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-blue-400 uppercase font-bold flex items-center gap-1">
              <Building2 className="w-3 h-3" /> BBVA
            </div>
            <CampoInput label="Titular" value={configLocal.bbva?.titular || ''} onChange={v => actualizarCampo('bbva', 'titular', v)} placeholder="Nombre del titular" color="blue" />
            <CampoInput label="Número de cuenta" value={configLocal.bbva?.numero || ''} onChange={v => actualizarCampo('bbva', 'numero', v)} placeholder="0011-9999-9900000000" color="blue" mono />
            <CampoInput label="CCI" value={configLocal.bbva?.cci || ''} onChange={v => actualizarCampo('bbva', 'cci', v)} placeholder="011-999-000000000000-00" color="blue" mono />
          </div>

          {/* INTERBANK */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-green-400 uppercase font-bold flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Interbank
            </div>
            <CampoInput label="Titular" value={configLocal.interbank?.titular || ''} onChange={v => actualizarCampo('interbank', 'titular', v)} placeholder="Nombre del titular" color="green" />
            <CampoInput label="Número de cuenta" value={configLocal.interbank?.numero || ''} onChange={v => actualizarCampo('interbank', 'numero', v)} placeholder="999-999999999-99" color="green" mono />
            <CampoInput label="CCI" value={configLocal.interbank?.cci || ''} onChange={v => actualizarCampo('interbank', 'cci', v)} placeholder="003-000-999999999-99" color="green" mono />
          </div>

          {/* EQUIPO DE VENTAS (Fase 3.10 — los contactos que envía el bot con 🩷 Venta) */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-pink-400 uppercase font-bold flex items-center gap-1">
              <Heart className="w-3 h-3" /> Equipo de Ventas
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Estos contactos se envían al cliente con el botón 🩷 Venta (el bot los manda como tarjeta de contacto). Sin celular configurado, ese botón no podrá enviar.
            </p>
            <CampoInput label="Fabiana — nombre" value={configLocal.ventas?.fabiana?.nombre || ''} onChange={v => actualizarVentas('fabiana', 'nombre', v)} placeholder="Fabiana" color="pink" />
            <CampoInput label="Fabiana — celular" value={configLocal.ventas?.fabiana?.celular || ''} onChange={v => actualizarVentas('fabiana', 'celular', v)} placeholder="999999999" color="pink" mono />
            <CampoInput label="Karla — nombre" value={configLocal.ventas?.karla?.nombre || ''} onChange={v => actualizarVentas('karla', 'nombre', v)} placeholder="Karla" color="pink" />
            <CampoInput label="Karla — celular" value={configLocal.ventas?.karla?.celular || ''} onChange={v => actualizarVentas('karla', 'celular', v)} placeholder="999999999" color="pink" mono />
            <CampoInput label="Tocho — nombre" value={configLocal.ventas?.tocho?.nombre || ''} onChange={v => actualizarVentas('tocho', 'nombre', v)} placeholder="Tocho" color="pink" />
            <CampoInput label="Tocho — celular" value={configLocal.ventas?.tocho?.celular || ''} onChange={v => actualizarVentas('tocho', 'celular', v)} placeholder="999999999" color="pink" mono />
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-slate-900 border-t border-slate-700 -mx-4 px-4 py-3">
            <button onClick={onClose} disabled={guardando} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={guardando} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
              {guardando ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>) : (<><Save className="w-3.5 h-3.5" /> Guardar</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente auxiliar para inputs con colores
const CampoInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  color?: string;
  mono?: boolean;
}> = ({ label, value, onChange, placeholder, color = 'emerald', mono = false }) => {
  const colorMap: Record<string, string> = {
    emerald: 'focus:border-emerald-500',
    purple: 'focus:border-purple-500',
    blue: 'focus:border-blue-500',
    sky: 'focus:border-sky-500',
    green: 'focus:border-green-500',
    pink: 'focus:border-pink-500',
  };
  return (
    <div>
      <label className="text-[10px] text-slate-400 uppercase font-bold">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 ${colorMap[color] || colorMap.emerald} outline-none ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
};
