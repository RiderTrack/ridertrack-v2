// ═══════════════════════════════════════════════════════════
// 💾 BACKUPS VIEW — RiderTrack V2 (Fase 2.5)
// Guardar/ver/cargar backups de la ruta EN LA NUBE (Firestore),
// como el backup del Rider Modular v1 pero sin archivos:
//   - 💾 Guardar backup ahora (snapshot completo de la ruta)
//   - 👁️ Ver qué clientes tiene cada backup
//   - ⬆️ Cargar: restaura la ruta (pisa la actual)
//   - 🗑️ Eliminar backups viejos
// Colección: backups_v2
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CloudUpload,
  RefreshCw,
  Trash2,
  Upload,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
  Cloud,
  Users,
  Wallet,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useClientes } from '../hooks/useClientes';
import {
  BackupNube,
  guardarBackupNube,
  listarBackupsNube,
  eliminarBackupNube,
  cargarBackupNube,
  importarHistorialV1,
} from '../services/firestore';
import { ETIQUETAS_ESTADO } from '../utils/realData';

interface BackupsViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const ST_ENTREGADOS = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'];

export const BackupsView: React.FC<BackupsViewProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const { clientes, stats, loading: cargandoClientes } = useClientes();

  const [backups, setBackups] = useState<BackupNube[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [cargandoId, setCargandoId] = useState<string | null>(null);
  const [importandoV1, setImportandoV1] = useState(false);

  const cargar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const lista = await listarBackupsNube(user.uid);
      setBackups(lista);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarAhora = async () => {
    if (!user) return;
    if (clientes.length === 0) {
      onShowToast?.('Ruta vacía', 'No hay clientes para respaldar — importa tu Excel primero', 'warning');
      return;
    }
    setGuardando(true);
    try {
      await guardarBackupNube(user.uid, clientes);
      onShowToast?.('💾 Backup guardado', `${clientes.length} clientes respaldados en la nube`, 'success');
      await cargar();
    } catch (e: any) {
      onShowToast?.('Error', e?.message || 'No se pudo guardar el backup', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (b: BackupNube) => {
    if (!confirm(`¿Eliminar el backup del ${b.fecha} ${b.hora}?\n\n(${b.totalClientes} clientes · S/ ${b.cobradoTotal.toFixed(2)})\n\nNo se puede deshacer.`)) return;
    try {
      await eliminarBackupNube(b.id, user.uid); // ⚡ F3.48: borra en las dos rutas
      setBackups((prev) => prev.filter((x) => x.id !== b.id));
      onShowToast?.('🗑️ Backup eliminado', `Backup del ${b.fecha} ${b.hora} borrado`, 'info');
    } catch (e: any) {
      onShowToast?.('Error', e?.message || 'No se pudo eliminar', 'error');
    }
  };

  const cargarBackup = async (b: BackupNube) => {
    if (!user) return;
    const ok = confirm(
      `⚠️ ¿CARGAR el backup del ${b.fecha} ${b.hora}?\n\n` +
      `Se van a restaurar ${b.totalClientes} clientes (S/ ${b.cobradoTotal.toFixed(2)}).\n\n` +
      `⚠️ Tu ruta ACTUAL (${clientes.length} clientes) será REEMPLAZADA por la del backup.\n\n` +
      `Consejo: si quieres conservar la actual, guarda primero un backup de ahora.`
    );
    if (!ok) return;
    setCargandoId(b.id);
    try {
      const n = await cargarBackupNube(user.uid, b);
      onShowToast?.('⬆️ Backup cargado', `${n} clientes restaurados a tu ruta`, 'success');
    } catch (e: any) {
      onShowToast?.('Error', e?.message || 'No se pudo cargar el backup', 'error');
    } finally {
      setCargandoId(null);
    }
  };

  const totalRespaldo = useMemo(
    () => backups.reduce((s, b) => s + (b.totalClientes || 0), 0),
    [backups]
  );

  // ⚡ F3.53 — RECUPERAR HISTORIAL DE LA V1: importa TODAS las rutas
  // que la versión 1 guardó en la nube (usuarios/{uid}.hist + backups
  // .hist) al Historial de la v2 (docs v1_{id}, sin repetir). No toca
  // la ruta actual — es solo para el historial/estadísticas.
  const recuperarV1 = async () => {
    if (!user || importandoV1) return;
    if (!confirm(
      '📥 ¿Recuperar el historial de la versión 1?\n\n' +
      'Se buscan TODAS las rutas que la v1 guardó en la nube (con la\n' +
      'misma cuenta) y se agregan al Historial (☰ → Historial).\n\n' +
      '· Las que ya importaste NO se repiten\n' +
      '· Tu ruta ACTUAL no se toca\n' +
      '· Puedes correrlo cuando quieras'
    )) return;
    setImportandoV1(true);
    try {
      const res = await importarHistorialV1(user.uid);
      if (res.totalV1 === 0) {
        onShowToast?.('Sin historial v1', 'No se encontraron rutas de la versión 1 en la nube', 'info');
      } else if (res.importadas === 0) {
        onShowToast?.('Ya está al día', `Las ${res.totalV1} rutas de la v1 ya estaban importadas`, 'info');
      } else {
        onShowToast?.(
          '📥 Historial v1 recuperado',
          `${res.importadas} de ${res.totalV1} rutas agregadas (${res.fuente}) — míralas en ☰ → Historial`,
          'success'
        );
      }
    } catch (e: any) {
      onShowToast?.('Error', e?.message || 'No se pudo importar el historial v1', 'error');
    } finally {
      setImportandoV1(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-tight">Backups en la Nube</h1>
              <p className="text-[11px] text-slate-400">Respaldos automáticos y manuales — 🏁 cada cierre + 💾 vivo cada 15 min (F3.53)</p>
            </div>
          </div>
          <button
            onClick={cargar}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 transition-colors disabled:opacity-50"
            title="Refrescar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Estado de la ruta actual */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/50 text-center">
            <div className="text-[9px] text-slate-500 uppercase flex items-center justify-center gap-1">
              <Users className="w-2.5 h-2.5" /> Ruta ahora
            </div>
            <div className="text-sm font-black text-white">
              {cargandoClientes ? '…' : clientes.length}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="text-[9px] text-emerald-400/70 uppercase flex items-center justify-center gap-1">
              <Wallet className="w-2.5 h-2.5" /> S/ cobrado
            </div>
            <div className="text-sm font-black text-emerald-400">{stats.cobrado.toFixed(0)}</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
            <div className="text-[9px] text-blue-400/70 uppercase flex items-center justify-center gap-1">
              <Cloud className="w-2.5 h-2.5" /> En la nube
            </div>
            <div className="text-sm font-black text-blue-400">{backups.length}</div>
          </div>
        </div>

        {/* Guardar ahora */}
        <button
          onClick={guardarAhora}
          disabled={guardando}
          className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-600/25"
        >
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
          {guardando ? 'Guardando…' : '💾 GUARDAR BACKUP AHORA'}
        </button>

        {/* ⚡ F3.53 — Recuperar historial de la v1 */}
        <button
          onClick={recuperarV1}
          disabled={importandoV1}
          className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 transition-all active:scale-95 disabled:opacity-50"
        >
          {importandoV1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
          {importandoV1 ? 'Recuperando…' : '📥 RECUPERAR HISTORIAL DE LA VERSIÓN 1'}
        </button>
      </div>

      {/* Lista de backups */}
      {loading ? (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-8 text-center">
          <Loader2 className="w-8 h-8 text-slate-600 mx-auto mb-3 animate-spin" />
          <p className="text-xs text-slate-400">Cargando backups…</p>
        </div>
      ) : backups.length === 0 ? (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-8 text-center">
          <Cloud className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">Todavía no tienes backups en la nube</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Guarda el primero con el botón verde de arriba — tus clientes quedan a salvo aunque el celular se pierda o la ruta se borre.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((b) => {
            const abierto = expandido === b.id;
            return (
              <div key={b.id} className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
                {/* Cabecera */}
                <button
                  onClick={() => setExpandido(abierto ? null : b.id)}
                  className="w-full p-3 text-left hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">🗓️ {b.fecha}</span>
                        <span className="text-[11px] text-slate-400">{b.hora}</span>
                        {b.origen === 'v1' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[8px] font-bold">
                            v1
                          </span>
                        )}
                        {b.auto && (
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[8px] font-bold ${
                              b.tipo === 'auto-guardado'
                                ? 'bg-teal-500/15 border-teal-500/30 text-teal-400'
                                : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                            }`}
                          >
                            {b.tipo === 'auto-guardado' ? 'auto · vivo' : 'auto · cierre'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {b.totalClientes} clientes · {b.entregados} entregados
                        {b.pendientes > 0 ? ` · ${b.pendientes} pendientes` : ''}
                        {b.fallidos > 0 ? ` · ${b.fallidos} fallidos` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-black text-emerald-400">S/ {b.cobradoTotal.toFixed(2)}</span>
                      {abierto ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                </button>

                {/* Detalle */}
                {abierto && (
                  <div className="border-t border-slate-700/60 px-3 pb-3 pt-2 space-y-2">
                    {/* Clientes del backup */}
                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                      {(b.clientes || []).map((c, i) => {
                        const entregado = ST_ENTREGADOS.includes(c.st);
                        return (
                          <div
                            key={i}
                            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border-l-2 ${
                              entregado ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-amber-500 bg-amber-500/5'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-white truncate">{c.nombre || 'Cliente'}</span>
                                {c.hora && <span className="text-[9px] text-slate-500">{c.hora}</span>}
                              </div>
                              {c.dist && <div className="text-[9px] text-slate-500 truncate">{c.dist}</div>}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[11px] font-black text-slate-200">S/ {parseFloat(String(c.cobrar || 0)).toFixed(2)}</div>
                              <div className={`text-[9px] ${entregado ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {ETIQUETAS_ESTADO[c.st] || c.st || 'Pendiente'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Acciones */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => cargarBackup(b)}
                        disabled={cargandoId === b.id}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {cargandoId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        ⬆️ Cargar a mi ruta
                      </button>
                      <button
                        onClick={() => eliminar(b)}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-all active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ayuda */}
      <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <strong className="text-slate-200">Auto-guardado vivo (F3.53):</strong> cada 15 min, mientras
            tu ruta tiene movimiento, se sube un respaldo con lo último (chip «auto · vivo»). El 🏁 cierre
            de ruta también respalda solo (chip «auto · cierre»), y los de la <strong className="text-amber-400">v1</strong> se
            recuperan con el botón ámbar de arriba.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <strong className="text-slate-200">⬆️ Cargar</strong> reemplaza tu ruta actual por la del backup.
            Si quieres conservar la de ahora, guarda un backup ANTES de cargar uno viejo.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Cloud className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Los backups guardan TODO: clientes, estados de pago, coordenadas GPS y observaciones.
            En total tienes {totalRespaldo} clientes respaldados en {backups.length} backups.
          </p>
        </div>
      </div>
    </div>
  );
};
