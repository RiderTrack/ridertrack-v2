// ═══════════════════════════════════════════════════════════
// 🏦 CONFIG CUENTAS MODAL - RiderTrack V2
// Modal para editar números de cuenta bancarios
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { X, Save, Building2, Smartphone, Phone, MapPin, Loader2 } from 'lucide-react';
import { ConfigCuentas, CONFIG_CUENTAS_DEFAULT } from '../services/firestore';
import { useConfig } from '../hooks/useConfig';

interface ConfigCuentasModalProps {
  onClose: () => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ConfigCuentasModal: React.FC<ConfigCuentasModalProps> = ({ onClose, onShowToast }) => {
  const { config, loading, guardando, guardar } = useConfig();
  const [configLocal, setConfigLocal] = useState<ConfigCuentas>(CONFIG_CUENTAS_DEFAULT);

  // Cargar config al montar
  useEffect(() => {
    if (config) {
      setConfigLocal(config);
    }
  }, [config]);

  // Actualizar campo
  const actualizarCampo = (seccion: keyof ConfigCuentas, campo: string, valor: string) => {
    setConfigLocal(prev => ({
      ...prev,
      [seccion]: {
        ...(prev[seccion] as any),
        [campo]: valor,
      },
    }));
  };

  // Guardar
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
        {/* Header */}
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
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Nombre empresa</label>
              <input
                type="text"
                value={configLocal.empresa?.nombre || ''}
                onChange={e => actualizarCampo('empresa', 'nombre', e.target.value)}
                placeholder="MATE"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Teléfono empresa</label>
              <input
                type="tel"
                value={configLocal.empresa?.telefono || ''}
                onChange={e => actualizarCampo('empresa', 'telefono', e.target.value)}
                placeholder="+51999999999"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Dirección empresa</label>
              <input
                type="text"
                value={configLocal.empresa?.direccion || ''}
                onChange={e => actualizarCampo('empresa', 'direccion', e.target.value)}
                placeholder="Lima, Perú"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* YAPE */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-purple-400 uppercase font-bold flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Yape
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Titular</label>
              <input
                type="text"
                value={configLocal.yape?.nombre || ''}
                onChange={e => actualizarCampo('yape', 'nombre', e.target.value)}
                placeholder="Nombre del titular"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Teléfono Yape</label>
              <input
                type="tel"
                value={configLocal.yape?.telefono || ''}
                onChange={e => actualizarCampo('yape', 'telefono', e.target.value)}
                placeholder="999999999"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-purple-500 outline-none"
              />
            </div>
          </div>

          {/* PLIN */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-blue-400 uppercase font-bold flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Plin
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Titular</label>
              <input
                type="text"
                value={configLocal.plin?.nombre || ''}
                onChange={e => actualizarCampo('plin', 'nombre', e.target.value)}
                placeholder="Nombre del titular"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Teléfono Plin</label>
              <input
                type="tel"
                value={configLocal.plin?.telefono || ''}
                onChange={e => actualizarCampo('plin', 'telefono', e.target.value)}
                placeholder="999999999"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* BCP */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-sky-400 uppercase font-bold flex items-center gap-1">
              <Building2 className="w-3 h-3" /> BCP
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Titular</label>
              <input
                type="text"
                value={configLocal.bcp?.titular || ''}
                onChange={e => actualizarCampo('bcp', 'titular', e.target.value)}
                placeholder="Nombre del titular"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Número de cuenta</label>
              <input
                type="text"
                value={configLocal.bcp?.numero || ''}
                onChange={e => actualizarCampo('bcp', 'numero', e.target.value)}
                placeholder="999-99999999-9-99"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-sky-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">CCI</label>
              <input
                type="text"
                value={configLocal.bcp?.cci || ''}
                onChange={e => actualizarCampo('bcp', 'cci', e.target.value)}
                placeholder="002-999-999999999999-99"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-sky-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* BBVA */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-blue-400 uppercase font-bold flex items-center gap-1">
              <Building2 className="w-3 h-3" /> BBVA
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Titular</label>
              <input
                type="text"
                value={configLocal.bbva?.titular || ''}
                onChange={e => actualizarCampo('bbva', 'titular', e.target.value)}
                placeholder="Nombre del titular"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Número de cuenta</label>
              <input
                type="text"
                value={configLocal.bbva?.numero || ''}
                onChange={e => actualizarCampo('bbva', 'numero', e.target.value)}
                placeholder="0011-9999-9900000000"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">CCI</label>
              <input
                type="text"
                value={configLocal.bbva?.cci || ''}
                onChange={e => actualizarCampo('bbva', 'cci', e.target.value)}
                placeholder="011-999-000000000000-00"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* INTERBANK */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] text-green-400 uppercase font-bold flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Interbank
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Titular</label>
              <input
                type="text"
                value={configLocal.interbank?.titular || ''}
                onChange={e => actualizarCampo('interbank', 'titular', e.target.value)}
                placeholder="Nombre del titular"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-green-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">Número de cuenta</label>
              <input
                type="text"
                value={configLocal.interbank?.numero || ''}
                onChange={e => actualizarCampo('interbank', 'numero', e.target.value)}
                placeholder="999-999999999-99"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-green-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold">CCI</label>
              <input
                type="text"
                value={configLocal.interbank?.cci || ''}
                onChange={e => actualizarCampo('interbank', 'cci', e.target.value)}
                placeholder="003-000-999999999-99"
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-green-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-slate-900 border-t border-slate-700 -mx-4 px-4 py-3">
            <button
              onClick={onClose}
              disabled={guardando}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {guardando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
