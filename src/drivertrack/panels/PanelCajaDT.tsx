// ═══════════════════════════════════════════════════════════
// 💰 FASE C: Panel de CAJA de inDrive — para el panel general
// ═══════════════════════════════════════════════════════════
// La Caja de DriverTrack (gastos en mano + neto del día) vive
// ahora DENTRO del "💰 Caja del día" del panel general, abajo de
// la caja del trabajo — bien separada y con su propio estilo.
// Lee/escribe el MISMO storage del shell (dt_*) y refresca sola
// cuando la nube manda cambios (otro celular).
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { useTema } from '../../theme/useTema';
import { ConfigDT, Gasto, Viaje } from '../types';
import { cargarConfig, cargarGastos, cargarViajes, guardarGastos, guardarViajes } from '../storage';
import { armarMensajeCobro, linkWhatsApp, normalizarCelular, vibrar } from '../utils';
import { encolarAccionDT, uidDisponible } from '../services/robotBot';
import { escucharImagenesDT, ImagenDT } from '../services/imagenesDT';
import CajaView from '../components/CajaView';
import YapePanel from '../components/YapePanel';
import { EstadoGPS, leerEstadoGPS } from '../services/gps';

interface Props {
  onToast?: (msg: string) => void;
}

export default function PanelCajaDT({ onToast }: Props) {
  const [viajes, setViajes] = useState<Viaje[]>(() => cargarViajes());
  const [gastos, setGastos] = useState<Gasto[]>(() => cargarGastos());
  const [config, setConfig] = useState<ConfigDT>(() => cargarConfig());
  const [toast, setToast] = useState('');
  const [cobrarAbierto, setCobrarAbierto] = useState(false);
  const [cobroEnCurso, setCobroEnCurso] = useState(false);
  const [estadoGPS, setEstadoGPS] = useState<EstadoGPS | null>(() => leerEstadoGPS());
  const [imagenesDT, setImagenesDT] = useState<Record<string, ImagenDT>>({});
  const { modoEfectivo } = useTema();
  const temaClaro = modoEfectivo === 'light';

  // refresco: cambios desde el shell / paneles / nube
  useEffect(() => {
    const alSync = () => {
      setViajes(cargarViajes());
      setGastos(cargarGastos());
      setConfig(cargarConfig());
    };
    window.addEventListener('dt:sync-remoto', alSync);
    return () => window.removeEventListener('dt:sync-remoto', alSync);
  }, []);

  // imágenes del robot (para el passthrough de la lista)
  useEffect(() => escucharImagenesDT(setImagenesDT), []);

  // GPS en curso (refresco liviano mientras el shell graba)
  useEffect(() => {
    const t = window.setInterval(() => setEstadoGPS(leerEstadoGPS()), 3000);
    return () => window.clearInterval(t);
  }, []);

  function mostrarToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
    onToast?.(msg);
  }

  function agregarGasto(g: Gasto) {
    setGastos(prev => {
      const nuevo = [...prev, g];
      guardarGastos(nuevo);
      return nuevo;
    });
    vibrar(80);
    mostrarToast('💸 Gasto anotado — ya descuenta del neto de hoy');
  }

  function eliminarGasto(id: string) {
    setGastos(prev => {
      const nuevo = prev.filter(g => g.id !== id);
      guardarGastos(nuevo);
      return nuevo;
    });
    mostrarToast('Gasto eliminado');
  }

  function eliminarViaje(id: string) {
    setViajes(prev => {
      const nuevo = prev.filter(v => v.id !== id);
      guardarViajes(nuevo);
      return nuevo;
    });
  }

  // 💜 cobro por el robot (mismo flujo del shell, acá independiente)
  async function mandarCobro(
    datos: { cliente: string; monto: number; direccion: string },
    celular: string,
  ): Promise<void> {
    const cel = normalizarCelular(celular);
    if (!cel) {
      mostrarToast('Poné el celular del cliente para mandarle el cobro');
      return;
    }
    const texto = armarMensajeCobro(datos, config);
    if (!config.robotActivo) {
      window.open(linkWhatsApp(cel, texto), '_blank');
      vibrar(60);
      return;
    }
    setCobroEnCurso(true);
    mostrarToast('🤖 Mandando el cobro por el robot…');
    const r = await encolarAccionDT({
      tipo: 'dt_cobro',
      telefono: cel,
      texto,
      imagenBase64: config.yape.qrBase64 || undefined,
      nombre: datos.cliente || undefined,
    });
    setCobroEnCurso(false);
    if (r.ok) {
      mostrarToast('✓ Cobro en camino — el cliente lo recibe ya 💜');
      vibrar(120);
      return;
    }
    mostrarToast('⚠️ ' + r.error + ' · abro WhatsApp…');
    window.open(linkWhatsApp(cel, texto), '_blank');
  }

  const hoy = viajes.filter(v => v.fecha === new Date().toISOString().slice(0, 10));
  const netoHoy = hoy.reduce((s, v) => s + v.neto, 0);

  return (
    <div className={`dt-app ${temaClaro ? 'light' : ''} w-full`} data-testid="panel-caja-dt">
      <CajaView
        viajes={viajes}
        config={config}
        gastos={gastos}
        onAgregarGasto={agregarGasto}
        onEliminarGasto={eliminarGasto}
        onEliminar={eliminarViaje}
        onCobrar={monto => {
          if (monto <= 0) return mostrarToast('Hoy no hay neto que cobrar todavía');
          setCobrarAbierto(true);
        }}
        onToast={mostrarToast}
        viajeGPSActivo={estadoGPS?.viajeId ?? null}
        onIniciarGPS={undefined} // la grabación se arranca desde la sección Viajes de inDrive
        onDetenerGPS={undefined}
        onMandarCobro={mandarCobro}
        cobroEnCurso={cobroEnCurso}
      />

      {cobrarAbierto && (
        <YapePanel
          billetera={config.yape}
          tipo="yape"
          montoInicial={netoHoy}
          onCerrar={() => setCobrarAbierto(false)}
          onToast={mostrarToast}
        />
      )}

      {toast && (
        <div className="dt-anim-pop fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
