// ═══════════════════════════════════════════════════════════
// ⚙️ FASE C: Panel de AJUSTES de inDrive — para el panel general
// ═══════════════════════════════════════════════════════════
// Los Ajustes de DriverTrack ya no viven en la sección inDrive
// (que quedó solo en VIAJES): se muestran DENTRO de la
// Configuración del panel general, bajo un título "🏍️ inDrive".
// Este panel es dueño de SU estado (lee el mismo storage que el
// shell) y todo lo que guardás sube solo a la nube (syncDT).
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { useTema } from '../../theme/useTema';
import { ConfigDT, Gasto, Viaje } from '../types';
import { cargarConfig, cargarGastos, cargarViajes, fechaHoy, guardarConfig, normalizarConfig, guardarViajes, guardarGastos } from '../storage';
import { descargarArchivo } from '../utils';
import AjustesView from '../components/AjustesView';
import { estadoSyncDT, forzarSyncDT, suscribirEstadoSyncDT } from '../services/syncDT';

interface Props {
  onToast?: (msg: string) => void;
  /** salta a "Mi QR Yape/Plin" del menú (billeteras personales inDrive) */
  onIrAYape?: () => void;
}

export default function PanelAjustesDT({ onToast, onIrAYape }: Props) {
  const [config, setConfig] = useState<ConfigDT>(() => cargarConfig());
  const { modoEfectivo } = useTema();
  const temaClaro = modoEfectivo === 'light';
  const [estadoSync, setEstadoSync] = useState(estadoSyncDT());
  useEffect(() => suscribirEstadoSyncDT(setEstadoSync), []);

  // ☁️ si la nube manda datos nuevos (otro cel), se recarga la config
  useEffect(() => {
    const alSync = () => setConfig(cargarConfig());
    window.addEventListener('dt:sync-remoto', alSync);
    return () => window.removeEventListener('dt:sync-remoto', alSync);
  }, []);

  function guardar(c: ConfigDT) {
    guardarConfig(c);
    setConfig(c);
  }

  // ── Backup JSON (mismo formato de siempre: {version, viajes, gastos, config}) ──
  function exportarBackup() {
    const viajes = cargarViajes();
    const gastos = cargarGastos();
    descargarArchivo(
      `drivertrack-backup-${fechaHoy()}.json`,
      JSON.stringify({ version: 2, fechaExport: new Date().toISOString(), viajes, gastos, config }, null, 2),
    );
    onToast?.('Backup de inDrive exportado 💾');
  }

  function importarBackup(texto: string) {
    try {
      const data = JSON.parse(texto) as { viajes?: Viaje[]; gastos?: Gasto[]; config?: Partial<ConfigDT> };
      // merge por id: lo importado pisa, lo local que no vino queda
      if (Array.isArray(data.viajes)) {
        const locales = cargarViajes();
        const ids = new Set(data.viajes.map(v => v.id));
        guardarViajes([...locales.filter(v => !ids.has(v.id)), ...data.viajes]);
      }
      if (Array.isArray(data.gastos)) {
        const locales = cargarGastos();
        const ids = new Set(data.gastos.map(g => g.id));
        guardarGastos([...locales.filter(g => !ids.has(g.id)), ...data.gastos]);
      }
      if (data.config) {
        const c = normalizarConfig({ ...cargarConfig(), ...data.config } as Partial<ConfigDT>);
        guardar(c);
      }
      // refresca todas las vistas (shell + paneles) y sube a la nube
      window.dispatchEvent(new CustomEvent('dt:sync-remoto'));
      forzarSyncDT();
      onToast?.('Backup de inDrive restaurado ✅');
    } catch {
      onToast?.('Archivo inválido ❌');
    }
  }

  function borrarTodo() {
    guardarViajes([]);
    guardarGastos([]);
    window.dispatchEvent(new CustomEvent('dt:sync-remoto'));
    forzarSyncDT();
    onToast?.('Se borraron todos los viajes y gastos de inDrive');
  }

  const textoSync =
    estadoSync === 'sincronizado'
      ? '☁️ Sincronizado — se ve igual en cualquier cel con tu cuenta'
      : estadoSync === 'pendiente'
        ? '☁️ Subiendo tus cambios a la nube…'
        : estadoSync === 'error'
          ? '⚠️ No pude sincronizar (todo está a salvo en este teléfono). Casi siempre falta habilitar la nube: paso 3 del LEEME — node actualizar_reglas.js en Termux'
          : '📱 Iniciá sesión con tu cuenta de RiderTrack para ver todo en cualquier cel';

  return (
    <div className={`dt-app ${temaClaro ? 'light' : ''} w-full`}>
      {/* estado del sync en la nube */}
      <div
        className={`mb-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
          estadoSync === 'sincronizado'
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : estadoSync === 'error'
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-slate-700 bg-slate-800/40'
        }`}
        data-testid="dt-sync-estado"
      >
        <p className="min-w-0 text-[11px] font-semibold leading-snug text-slate-300">{textoSync}</p>
        {estadoSync !== 'sin-sesion' && (
          <button
            onClick={() => forzarSyncDT()}
            className="shrink-0 rounded-lg bg-slate-700 px-2.5 py-1.5 text-[10px] font-black text-slate-200 transition-colors hover:bg-slate-600"
            data-testid="dt-sync-forzar"
          >
            Sincronizar ya
          </button>
        )}
      </div>

      <AjustesView
        config={config}
        onGuardar={guardar}
        onIrAYape={onIrAYape}
        onExportarBackup={exportarBackup}
        onImportarBackup={importarBackup}
        onBorrarTodo={borrarTodo}
        onToast={(msg: string) => onToast?.(msg)}
      />
    </div>
  );
}
