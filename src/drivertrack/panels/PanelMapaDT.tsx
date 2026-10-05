// ═══════════════════════════════════════════════════════════
// 🗺️ FASE C: Panel de MAPA de inDrive — para el panel general
// ═══════════════════════════════════════════════════════════
// El mapa de tus viajes libres (trazados GPS, pins de entrega)
// vive ahora DENTRO del "Mapa de Entregas" del panel general,
// con un toggle Trabajo / 🏍️ Libre. Se monta SOLO cuando lo
// elegís (un Leaflet a la vez) y refresca solo con la nube.
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { useTema } from '../../theme/useTema';
import { Viaje } from '../types';
import { cargarViajes } from '../storage';
import { EstadoGPS, leerEstadoGPS } from '../services/gps';
import MapView from '../components/MapView';

export default function PanelMapaDT() {
  const [viajes, setViajes] = useState<Viaje[]>(() => cargarViajes());
  const [estadoGPS, setEstadoGPS] = useState<EstadoGPS | null>(() => leerEstadoGPS());
  const { modoEfectivo } = useTema();
  const temaClaro = modoEfectivo === 'light';

  // refresco: cambios desde el shell / paneles / nube
  useEffect(() => {
    const alSync = () => setViajes(cargarViajes());
    window.addEventListener('dt:sync-remoto', alSync);
    return () => window.removeEventListener('dt:sync-remoto', alSync);
  }, []);

  // GPS en curso (refresco liviano mientras el shell graba)
  useEffect(() => {
    const t = window.setInterval(() => setEstadoGPS(leerEstadoGPS()), 3000);
    return () => window.clearInterval(t);
  }, []);

  // Leaflet necesita recalibrar tamaño al montarse dentro del panel
  useEffect(() => {
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={`dt-app ${temaClaro ? 'light' : ''} w-full`} data-testid="panel-mapa-dt">
      <MapView viajes={viajes} estadoGPS={estadoGPS} />
    </div>
  );
}
