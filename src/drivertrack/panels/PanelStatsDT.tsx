// ═══════════════════════════════════════════════════════════
// 📊 FASE C: Panel de STATS de inDrive — para el panel general
// ═══════════════════════════════════════════════════════════
// Las estadísticas de tus viajes libres (zonas, horas de oro,
// precio piso…) viven ahora DENTRO de "📊 Estadísticas" del
// panel general, al final de las stats del trabajo. Refrescan
// solas cuando la nube manda cambios (otro celular).
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { useTema } from '../../theme/useTema';
import { Viaje } from '../types';
import { cargarViajes } from '../storage';
import EstadisticasView from '../components/EstadisticasView';

export default function PanelStatsDT() {
  const [viajes, setViajes] = useState<Viaje[]>(() => cargarViajes());
  const { modoEfectivo } = useTema();
  const temaClaro = modoEfectivo === 'light';

  // refresco: cambios desde el shell / paneles / nube
  useEffect(() => {
    const alSync = () => setViajes(cargarViajes());
    window.addEventListener('dt:sync-remoto', alSync);
    return () => window.removeEventListener('dt:sync-remoto', alSync);
  }, []);

  return (
    <div className={`dt-app ${temaClaro ? 'light' : ''} w-full`} data-testid="panel-stats-dt">
      <EstadisticasView viajes={viajes} />
    </div>
  );
}
