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
import { armarMensajeCobro, qrDelMetodo, alivianarQrBase64, linkWhatsApp, normalizarCelular, vibrar, MetodoCobro } from '../utils';
import { encolarAccionDT, escucharResultadoDT, uidDisponible } from '../services/robotBot';
import { escucharImagenesDT, ImagenDT } from '../services/imagenesDT';
import CajaView from '../components/CajaView';
import YapePanel from '../components/YapePanel';
// 🟣 FASE R: ¿cómo le cobrás? (solo Yape / solo Plin / ambos)
import ElegirMetodoCobroModal from '../components/ElegirMetodoCobroModal';
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

  // 🟣 FASE R: el cobro que espera la elección del método (Yape/Plin)
  const [cobroPendiente, setCobroPendiente] = useState<{
    datos: { cliente: string; monto: number; direccion: string };
    cel: string;
  } | null>(null);

  // 💜 cobro por el robot (mismo flujo del shell, acá independiente)
  // 🟣 FASE R: si tenés los DOS números (Yape y Plin) te pregunta cómo
  // cobrarle — el mensaje sale SOLO con el método que elijas y SU QR.
  function mandarCobro(
    datos: { cliente: string; monto: number; direccion: string },
    celular: string,
  ): void {
    const cel = normalizarCelular(celular);
    if (!cel) {
      mostrarToast('Poné el celular del cliente para mandarle el cobro');
      return;
    }
    const tieneYape = config.yape.numero.trim().length > 0;
    const tienePlin = config.plin.numero.trim().length > 0;
    if (tieneYape && tienePlin) {
      vibrar(40);
      setCobroPendiente({ datos, cel });
      return;
    }
    void ejecutarCobro(datos, cel, tieneYape ? 'yape' : tienePlin ? 'plin' : undefined);
  }

  /** 🟣 FASE R: el cobro de verdad (mismo flujo del shell) — escucha el
   *  resultado REAL del bot: si no pudo, te avisa el motivo y abre
   *  WhatsApp de respaldo. El QR viaja con presupuesto de peso. */
  async function ejecutarCobro(
    datos: { cliente: string; monto: number; direccion: string },
    cel: string,
    metodo?: MetodoCobro,
  ): Promise<void> {
    const texto = armarMensajeCobro(datos, config, metodo);
    if (!config.robotActivo) {
      window.open(linkWhatsApp(cel, texto), '_blank');
      vibrar(60);
      return;
    }
    let qrViaja = qrDelMetodo(config, metodo);
    if (qrViaja && qrViaja.length > 400_000) {
      const liviana = await alivianarQrBase64(qrViaja);
      if (liviana) qrViaja = liviana;
      else {
        qrViaja = '';
        mostrarToast('⚠️ Tu QR pesa demasiado — el cobro sale con los números escritos');
      }
    }
    if (qrViaja && qrViaja.length > 600_000) qrViaja = '';

    setCobroEnCurso(true);
    mostrarToast('🤖 Mandando el cobro por el robot…');
    const r = await encolarAccionDT({
      tipo: 'dt_cobro',
      telefono: cel,
      texto,
      imagenBase64: qrViaja || undefined,
      nombre: datos.cliente || undefined,
      metodo,
    });
    setCobroEnCurso(false);
    if (!r.ok) {
      mostrarToast('⚠️ ' + r.error + ' · abro WhatsApp…');
      window.open(linkWhatsApp(cel, texto), '_blank');
      return;
    }
    const ult = cel.slice(-4);
    mostrarToast(`✓ Cobro en camino (al …${ult}) — esperamos la confirmación del bot…`);
    vibrar(120);
    if (r.docId) {
      escucharResultadoDT(
        r.docId,
        res => {
          if (res.estado === 'enviado') {
            mostrarToast(
              res.nota
                ? `⚠️ Cobro entregado SIN QR (al …${ult}) — el robot no pudo con la imagen`
                : `✓ Cobro entregado 💜 (al …${ult})`,
            );
            vibrar(res.nota ? 60 : 120);
          } else if (res.estado === 'error') {
            mostrarToast(`⚠️ El robot no pudo: ${res.error || 'sin detalle'} · abro WhatsApp…`);
            vibrar(60);
            window.open(linkWhatsApp(cel, texto), '_blank');
          }
        },
        25000,
      );
    }
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

      {/* 🟣 FASE R: ¿cómo le cobrás? — solo Yape / solo Plin / ambos */}
      {cobroPendiente && (
        <ElegirMetodoCobroModal
          datos={cobroPendiente.datos}
          config={config}
          onCerrar={() => setCobroPendiente(null)}
          onElegir={metodo => {
            const pend = cobroPendiente;
            setCobroPendiente(null);
            if (pend) void ejecutarCobro(pend.datos, pend.cel, metodo);
          }}
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
