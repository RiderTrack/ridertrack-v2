// ═══════════════════════════════════════════════════════════
// ⚙️ DriverTrack — Ajustes: meta, comisiones, mis datos (robot)
// y backup. FASE A2: las billeteras personales ya NO se editan acá
// — viven en "Mi QR Yape/Plin" del menú (pestaña 🏍️ inDrive).
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { EvArchivo } from '../tipos';
import {
  ArrowRight,
  Bot,
  Camera,
  Check,
  ChevronDown,
  Compass,
  Database,
  ExternalLink,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { ConfigDT, Gasto, ORIGENES, TipoGasto } from '../types';
import { CONFIG_DEFECTO, cargarGastos, cargarViajes, fechaHoy, guardarConfig, guardarGastos, horaAhora } from '../storage';
// FASE K: 🎯 recarga semanal — calculadora + saldo consumido
import { calcularRecarga, estadoSaldo } from '../services/recarga';
import { probarKeyIA } from '../services/escanerIA';
import { AppNavegacion, EVENTO_NAV_CHANGED, getAppNavegacion, setAppNavegacion } from '../services/navegacion';
// FASE B: el robot va por Firestore (cola acciones_dt) — la prueba
// manda un mensaje REAL a tu WhatsApp
import { encolarAccionDT, uidDisponible, PLANTILLAS_DEF, ETIQUETAS_PLANTILLA, TipoPlantilla, resolverPlantilla } from '../services/robotBot';
// FASE B2: imágenes del robot — una por cada aviso, como en el trabajo
import {
  TIPOS_IMAGEN_DT,
  ImagenDT,
  escucharImagenesDT,
  subirImagenDT,
  quitarImagenDT,
} from '../services/imagenesDT';
import { auth } from '../../services/firebase';
import { armarMensajeFoto, MENSAJE_FOTO_DEF, normalizarCelular } from '../utils';
import type { Viaje } from '../types';

interface Props {
  config: ConfigDT;
  onGuardar: (c: ConfigDT) => void;
  onExportarBackup: () => void;
  onImportarBackup: (json: string) => void;
  onBorrarTodo: () => void;
  onToast: (msg: string) => void;
  /** FASE A2: salta a la vista "Mi QR Yape/Plin" del menú (ahí vive
   *  la pestaña 🏍️ inDrive con tus billeteras personales) */
  onIrAYape?: () => void;
}

function PanelBilleteraResumen({
  emoji,
  nombre,
  numero,
  tieneQr,
}: {
  emoji: string;
  nombre: string;
  numero: string;
  tieneQr: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2">
      <p className="text-xs font-bold text-slate-300">
        {emoji} {nombre}
      </p>
      <p className="text-[11px] text-slate-400">
        {numero || 'sin número'}{' '}
        <span className={tieneQr ? 'font-bold text-emerald-400' : 'text-slate-500'}>
          {tieneQr ? '· QR ✓' : '· sin QR'}
        </span>
      </p>
    </div>
  );
}

export default function AjustesView({
  config,
  onGuardar,
  onExportarBackup,
  onImportarBackup,
  onBorrarTodo,
  onToast,
  onIrAYape,
}: Props) {
  const [borrarConfirm, setBorrarConfirm] = useState(false);
  const [meta, setMeta] = useState(String(config.metaDiaria));
  const [comisiones, setComisiones] = useState({ ...config.comisiones });
  // FASE A2: tus datos para el robot (antes vivían en "Mi QR")
  const [miNombre, setMiNombre] = useState(config.miNombre);
  const [miCelular, setMiCelular] = useState(config.miCelular);
  const [geminiKey, setGeminiKey] = useState(config.geminiKey);
  const [claudeKey, setClaudeKey] = useState(config.claudeKey); // F-ID2.5: token de respaldo
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<{ ok: boolean; mensaje: string } | null>(null);
  // F-ID3.3: con qué app navegar a las entregas (Google/Waze/preguntar)
  const [navApp, setNavApp] = useState<AppNavegacion>(() => getAppNavegacion());
  // F-ID5: 🤖 robot WhatsApp — cobro automático
  // FASE B: el robot ahora escucha por Firestore (cola acciones_dt) —
  // no hay URL ni token; la prueba manda un mensaje REAL a tu WhatsApp
  const [robotActivo, setRobotActivo] = useState(config.robotActivo);
  const [robotEstado, setRobotEstado] = useState<'sin-probar' | 'probando' | 'online' | 'offline'>('sin-probar');
  const sesionActiva = uidDisponible() !== null;
  // FASE C: 💬 textos EDITABLES de los avisos del robot — arrancan
  // de lo que ya guardaste (o del original de fábrica) y se guardan
  // solos al editar, igual que todo en esta pantalla
  const [plantillas, setPlantillas] = useState<Record<string, string>>(() => ({
    camino: config.plantillas?.camino ?? PLANTILLAS_DEF.camino,
    llegando: config.plantillas?.llegando ?? PLANTILLAS_DEF.llegando,
    llegada: config.plantillas?.llegada ?? PLANTILLAS_DEF.llegada,
    entregado: config.plantillas?.entregado ?? PLANTILLAS_DEF.entregado,
    ubicacion: config.plantillas?.ubicacion ?? PLANTILLAS_DEF.ubicacion,
  }));
  // qué plantilla está abierta para editar (una a la vez, colapsables)
  const [plantillaAbierta, setPlantillaAbierta] = useState<string | null>(null);
  // FASE H: 📷 el mensaje que va CON la foto de la entrega — el
  // original vive acá (se puede retocar por foto en el momento)
  const [mensajeFoto, setMensajeFoto] = useState(config.mensajeFoto ?? '');

  // ═══ FASE K: 🎯 Recarga semanal (comisión prepagada) ═══
  // Estados planos para los inputs; la primera vez heredan la meta
  // del día y el % de inDrive que ya tenés configurados.
  const [recargaActiva, setRecargaActiva] = useState(config.recarga?.activa === true);
  const [recargaMeta, setRecargaMeta] = useState(
    String(config.recarga?.metaDiaria || config.metaDiaria || 0),
  );
  const [recargaPct, setRecargaPct] = useState(
    String(config.recarga?.pct || config.comisiones?.indrive || 0),
  );
  const [recargaDias, setRecargaDias] = useState(config.recarga?.dias || 7);
  const [recargaMonto, setRecargaMonto] = useState(config.recarga?.monto || 0);
  const [recargaFecha, setRecargaFecha] = useState(config.recarga?.fecha || '');
  // "Ya recargué": monto a mano + si anotarla como gasto de hoy
  const [confirmandoRecarga, setConfirmandoRecarga] = useState(false);
  const [montoRecargaTxt, setMontoRecargaTxt] = useState('');
  const [anotarGastoRecarga, setAnotarGastoRecarga] = useState(true);

  // Viajes para el SALDO consumido de la recarga (se refrescan si
  // cambia algo en la nube o volvés a entrar a Ajustes)
  const [viajesSaldo, setViajesSaldo] = useState<Viaje[]>(() => cargarViajes());
  useEffect(() => {
    const alSync = () => setViajesSaldo(cargarViajes());
    window.addEventListener('dt:sync-remoto', alSync);
    return () => window.removeEventListener('dt:sync-remoto', alSync);
  }, []);

  /** El objeto RecargaSemanal con lo que hay en pantalla ahora */
  function recargaActual(over?: { monto: number; fecha: string }) {
    return {
      activa: recargaActiva,
      metaDiaria: parseFloat(recargaMeta.replace(',', '.')) || 0,
      pct: parseFloat(recargaPct.replace(',', '.')) || 0,
      dias: Math.round(Number(recargaDias) || 7),
      monto: over ? over.monto : recargaMonto,
      fecha: over ? over.fecha : recargaFecha,
    };
  }

  // 🧪 FASE B: probás el robot de verdad — te manda un mensaje a TU
  // WhatsApp (miCelular). Si llega, todo el circuito funciona.
  async function probarRobot() {
    if (!sesionActiva) {
      setRobotEstado('offline');
      onToast('Abrí sesión con tu cuenta de RiderTrack para usar el robot');
      return;
    }
    const cel = normalizarCelular(config.miCelular);
    if (!cel) {
      onToast('Poné tu celular en 👤 Mis datos (acá en Ajustes) para probarte el robot');
      return;
    }
    setRobotEstado('probando');
    const r = await encolarAccionDT({
      tipo: 'dt_prueba',
      telefono: cel,
      texto: '🧪 *Prueba del robot inDrive* \u{1F916}\n\nSi te llegó este mensaje, el robot de DriverTrack está andando perfecto \u{2705}\n\n(no contestes, es una prueba)',
      nombre: 'Vos (prueba)',
    });
    setRobotEstado(r.ok ? 'online' : 'offline');
    if (r.ok) {
      onToast('🧪 Prueba encolada — mirá tu WhatsApp en 1-2 segundos');
    } else {
      onToast('⚠️ ' + r.error);
    }
  }

  // Al entrar a Ajustes con el robot activo → probar silenciosamente
  // (así el semáforo ya está fresco sin tocar nada)
  useEffect(() => {
    if (config.robotActivo) probarRobot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══ FASE B2: 🖼️ imágenes del robot (una por aviso) ═══
  // Suscripción en vivo: lo que subís acá (o desde otro celular)
  // se refleja al toque — el robot la baja de la nube al enviar
  const [imagenesRobot, setImagenesRobot] = useState<Record<string, ImagenDT>>({});
  const [subiendoImagen, setSubiendoImagen] = useState<string | null>(null);
  const inputsImagen = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => escucharImagenesDT(setImagenesRobot), []);

  async function cambiarImagenRobot(tipo: string, file: File | undefined) {
    if (!file) return;
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      onToast('Abrí sesión con tu cuenta de RiderTrack para subir imágenes');
      return;
    }
    setSubiendoImagen(tipo);
    try {
      await subirImagenDT(uid, tipo, file);
      onToast('🖼️ Imagen lista — el robot la usa en el próximo aviso');
    } catch (e) {
      onToast('⚠️ ' + (e as Error).message);
    } finally {
      setSubiendoImagen(null);
      const inp = inputsImagen.current[tipo];
      if (inp) inp.value = '';
    }
  }

  async function quitarImagenRobot(tipo: string, etiqueta: string) {
    if (!window.confirm(`¿Quitar la imagen de "${etiqueta}"? El aviso volverá a salir solo con texto.`)) return;
    try {
      await quitarImagenDT(tipo);
      onToast('Imagen quitada — el aviso va en texto nomás');
    } catch (e) {
      onToast('⚠️ ' + (e as Error).message);
    }
  }

  // Si la preferencia cambia desde el mini-selector (o desde otro
  // lado), el selector de acá se entera al toque
  useEffect(() => {
    const alCambiar = (e: Event) => setNavApp((e as CustomEvent<AppNavegacion>).detail);
    window.addEventListener(EVENTO_NAV_CHANGED, alCambiar);
    return () => window.removeEventListener(EVENTO_NAV_CHANGED, alCambiar);
  }, []);
  const inputBackup = useRef<HTMLInputElement>(null);

  // Arma el ConfigDT completo a partir de los estados locales.
  // ⚠️ Empieza desde ...config para conservar lo que NO se edita en
  // esta pantalla (F-ID3.3: miNombre/miCelular del QR 📱) — sin el
  // spread, cambiar la meta acá BORRARÍA tu QR guardado.
  function armarConfig(): ConfigDT {
    return {
      ...config,
      metaDiaria: parseFloat(meta) || 0,
      comisiones: {
        indrive: parseFloat(String(comisiones.indrive)) || 0,
        rappi: parseFloat(String(comisiones.rappi)) || 0,
        pedidosya: parseFloat(String(comisiones.pedidosya)) || 0,
        directo: parseFloat(String(comisiones.directo)) || 0,
      },
      // FASE A2: yape/plin viajan en ...config (se editan en la vista
      // "Mi QR Yape/Plin" → pestaña 🏍️ inDrive) — acá no se tocan.
      miNombre: miNombre.trim(),
      miCelular: miCelular.trim(),
      geminiKey: geminiKey.trim(),
      claudeKey: claudeKey.trim(),
      robotActivo,
      // FASE C: los textos editados de los avisos — solo se guardan
      // los que CAMBIARON respecto al original (backup limpio)
      plantillas: Object.fromEntries(
        (Object.keys(PLANTILLAS_DEF) as TipoPlantilla[])
          .filter(t => (plantillas[t] ?? '').trim() !== PLANTILLAS_DEF[t].trim())
          .map(t => [t, (plantillas[t] ?? '').trim()]),
      ),
      // FASE H: el mensaje de la foto — si quedó igual al original
      // se guarda vacío (usa el default de fábrica en cada envío)
      mensajeFoto: mensajeFoto.trim() === MENSAJE_FOTO_DEF.trim() ? '' : mensajeFoto.trim(),
      // FASE K: 🎯 recarga semanal (comisión prepagada)
      recarga: recargaActual(),
      // FASE B: la URL y el token del viejo puente localhost quedan
      // jubilados — se conservan los defaults en la config para que
      // los backups viejos sigan importando sin romper nada.
    };
  }

  // F-ID2.3: TODO se autoguarda al tocarlo (meta, % con decimales,
  // Yape/Plin, key). Antes los ajustes vivían en memoria hasta apretar
  // "Guardar ajustes" (al fondo de todo) → al cambiar de pestaña se
  // perdían (el bug del 10.89 → volvía a 10). Mismo fix que la key
  // en F-ID2.2, ahora para toda la pantalla.
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const c = armarConfig();
    guardarConfig(c);
    onGuardar(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, comisiones, miNombre, miCelular, geminiKey, claudeKey, robotActivo, plantillas, mensajeFoto, recargaActiva, recargaMeta, recargaPct, recargaDias, recargaMonto, recargaFecha]);

  // FASE K: ✅ "Ya recargué" — registra el monto+fecha y (opcional)
  // lo anota como gasto 📶 Recarga de HOY en la Caja (así el "En mano"
  // queda con la verdad: la comisión prepagada ya salió del bolsillo)
  function registrarRecarga() {
    const monto = parseFloat(montoRecargaTxt.replace(',', '.')) || 0;
    if (monto <= 0) {
      onToast('Poné cuánto recargaste 💡');
      return;
    }
    const fecha = `${fechaHoy()} ${horaAhora()}`;
    const m = +monto.toFixed(2);
    setRecargaMonto(m);
    setRecargaFecha(fecha);
    setConfirmandoRecarga(false);
    setMontoRecargaTxt('');

    // 1) la config se guarda YA con la recarga nueva (sin esperar al
    //    autoguardado) para que el resto de la app la vea al toque
    const c = { ...armarConfig(), recarga: recargaActual({ monto: m, fecha }) };
    guardarConfig(c);
    onGuardar(c);

    // 2) gasto 📶 Recarga en la Caja de hoy (opcional, default ON)
    if (anotarGastoRecarga) {
      const gasto: Gasto = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fecha: fechaHoy(),
        hora: horaAhora(),
        tipo: 'saldo' as TipoGasto,
        monto: m,
        nota: 'Recarga semanal inDrive (comisión prepagada)',
      };
      guardarGastos([...cargarGastos(), gasto]);
    }

    // 3) que la Caja y el header se enteren al toque (recargan del storage)
    window.dispatchEvent(new CustomEvent('dt:sync-remoto'));
    onToast(
      anotarGastoRecarga
        ? `✅ Recarga de S/ ${m.toFixed(2)} registrada (anotada en la Caja de hoy)`
        : `✅ Recarga de S/ ${m.toFixed(2)} registrada`,
    );
  }

  async function probarKey() {
    setProbando(true);
    setPrueba(null);
    const r = await probarKeyIA(geminiKey, claudeKey);
    setPrueba(r.ok ? { ok: true, mensaje: `${r.mensaje} · quedó guardada ✅` } : r);
    setProbando(false);
  }

  async function importar(e: EvArchivo) {
    const file = e.target.files?.[0];
    if (!file) return;
    const texto = await file.text();
    onImportarBackup(texto);
    // F-ID2.3: re-sincroniza los campos con lo importado (un backup viejo
    // puede no tener algún campo → se completa con los defaults)
    try {
      const data = JSON.parse(texto) as { config?: Partial<ConfigDT> };
      if (data.config) {
        setMeta(String(data.config.metaDiaria ?? CONFIG_DEFECTO.metaDiaria));
        setComisiones({ ...CONFIG_DEFECTO.comisiones, ...data.config.comisiones });
        setMiNombre(data.config.miNombre ?? '');
        setMiCelular(data.config.miCelular ?? '');
        setGeminiKey(data.config.geminiKey ?? '');
        setClaudeKey(data.config.claudeKey ?? '');
        setRobotActivo(data.config.robotActivo === true);
        // FASE K: la recarga también vuelve de un backup
        setRecargaActiva(data.config.recarga?.activa === true);
        setRecargaMeta(String(data.config.recarga?.metaDiaria || data.config.metaDiaria || 0));
        setRecargaPct(String(data.config.recarga?.pct || data.config.comisiones?.indrive || 0));
        setRecargaDias(data.config.recarga?.dias || 7);
        setRecargaMonto(data.config.recarga?.monto || 0);
        setRecargaFecha(data.config.recarga?.fecha || '');
        setMensajeFoto(data.config.mensajeFoto ?? '');
      }
    } catch {
      /* App ya muestra el toast de archivo inválido */
    }
  }

  return (
    <div className="space-y-4">
      {/* Meta diaria */}
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-xs font-bold text-amber-300">🎯 Meta del día (S/ netos)</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Cuando el neto del día llegue a este monto, la app celebra y te manda a casa 🏍️🏠
        </p>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={meta}
          onChange={e => setMeta(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-lg font-black text-amber-300 outline-none focus:border-amber-400"
          data-testid="input-meta"
        />
      </section>

      {/* ═══ FASE K: 🎯 Recarga semanal — comisión prepagada ═══ */}
      <section className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-4" data-testid="seccion-recarga">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
            🎯 Recarga semanal (comisión prepagada)
          </p>
          {/* Interruptor del modo prepagada */}
          <button
            onClick={() => setRecargaActiva(!recargaActiva)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              recargaActiva ? 'bg-violet-500' : 'bg-slate-700'
            }`}
            role="switch"
            aria-checked={recargaActiva}
            aria-label="Activar la comisión prepagada"
            data-testid="recarga-toggle"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                recargaActiva ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          Poné <b className="text-violet-300">cuánto querés hacerte por día</b> y la app te dice{' '}
          <b className="text-violet-300">cuánto recargar UNA vez para toda la semana</b>. Con el modo prendido, cada
          carrera de inDrive entra <b className="text-violet-300">COMPLETA</b> (ya no te descuenta el % por viaje — la
          comisión ya la pagaste con la recarga).
        </p>

        {/* Los 3 datos de la calculadora */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-violet-400/80">
              Quiero hacer al día (S/)
            </p>
            <input
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              value={recargaMeta}
              onChange={e => setRecargaMeta(e.target.value)}
              placeholder="60"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-base font-black text-violet-200 outline-none focus:border-violet-400"
              data-testid="recarga-meta"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-violet-400/80">
              % comisión inDrive
            </p>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max="100"
              value={recargaPct}
              onChange={e => setRecargaPct(e.target.value)}
              placeholder="15"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-base font-black text-violet-200 outline-none focus:border-violet-400"
              data-testid="recarga-pct"
            />
          </div>
        </div>

        {/* Días por semana */}
        <div className="mt-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-violet-400/80">Días por semana</p>
          <div className="flex gap-1.5">
            {[5, 6, 7].map(d => (
              <button
                key={d}
                onClick={() => setRecargaDias(d)}
                className={`flex-1 rounded-xl border py-2 text-sm font-black transition-all active:scale-[0.97] ${
                  recargaDias === d
                    ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
                data-testid={`recarga-dias-${d}`}
              >
                {d} días
              </button>
            ))}
          </div>
        </div>

        {/* EL RESULTADO — cuánto recargar */}
        {(() => {
          const calc = calcularRecarga(
            parseFloat(recargaMeta.replace(',', '.')) || 0,
            parseFloat(recargaPct.replace(',', '.')) || 0,
            recargaDias,
          );
          const hayDatos = calc.recargaSugerida > 0;
          return (
            <div
              className="mt-3 rounded-xl border border-violet-500/30 bg-slate-950/60 p-3 text-center"
              data-testid="recarga-resultado"
            >
              {hayDatos ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Recargá esto y tenés la semana cubierta
                  </p>
                  <p className="mt-0.5 text-3xl font-black text-violet-200" data-testid="recarga-sugerida">
                    S/ {calc.recargaSugerida.toFixed(2)}
                  </p>
                  <p className="mt-1 text-[10px] leading-snug text-slate-400">
                    Comisión S/ {calc.comisionDia.toFixed(2)} por día × {recargaDias} días · facturás{' '}
                    <b className="text-slate-300">S/ {calc.brutoSemana.toFixed(2)}</b> en la semana y en el bolsillo
                    quedan <b className="text-emerald-400">S/ {calc.bolsilloReal.toFixed(2)}</b>
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Poné tu meta diaria y tu % de comisión arriba 👆
                </p>
              )}
            </div>
          );
        })()}

        {/* Estado de la recarga registrada: cuánto llevás consumido */}
        {(() => {
          const saldo = estadoSaldo(viajesSaldo, recargaActual());
          if (!saldo) {
            return (
              <button
                onClick={() => {
                  const calc = calcularRecarga(
                    parseFloat(recargaMeta.replace(',', '.')) || 0,
                    parseFloat(recargaPct.replace(',', '.')) || 0,
                    recargaDias,
                  );
                  setMontoRecargaTxt(calc.recargaSugerida > 0 ? calc.recargaSugerida.toFixed(2) : '');
                  setConfirmandoRecarga(true);
                }}
                className="mt-2 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-xs font-black text-emerald-300 transition-all active:scale-[0.99] hover:bg-emerald-500/20"
                data-testid="recarga-ya-recargue"
              >
                ✅ Ya recargué (registrarla acá)
              </button>
            );
          }
          const pct = Math.round(saldo.pctUsado * 100);
          return (
            <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3" data-testid="recarga-saldo">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-slate-200">
                  Recargaste S/ {saldo.monto.toFixed(2)}
                  <span className="ml-1 font-medium text-slate-500">({recargaFecha})</span>
                </p>
                <p
                  className={`text-[11px] font-black ${
                    saldo.saldo < 0 || saldo.casiAgotada ? 'text-amber-300' : 'text-emerald-400'
                  }`}
                  data-testid="recarga-saldo-restante"
                >
                  queda S/ {saldo.saldo.toFixed(2)}
                </p>
              </div>
              {/* Barra de consumo */}
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    saldo.saldo < 0 ? 'bg-red-500' : saldo.casiAgotada ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">
                Tus viajes inDrive consumieron <b className="text-slate-300">S/ {saldo.usado.toFixed(2)}</b> de comisión
                ({pct}% de la recarga)
                {saldo.saldo < 0
                  ? ' — ⚠️ te pasaste: inDrive ya te está pidiendo recarga'
                  : saldo.casiAgotada
                    ? ' — ⚠️ queda poco: recargá de nuevo cuando llegue a 0'
                    : ''}
              </p>
              <button
                onClick={() => {
                  const calc = calcularRecarga(
                    parseFloat(recargaMeta.replace(',', '.')) || 0,
                    parseFloat(recargaPct.replace(',', '.')) || 0,
                    recargaDias,
                  );
                  setMontoRecargaTxt(calc.recargaSugerida > 0 ? calc.recargaSugerida.toFixed(2) : '');
                  setConfirmandoRecarga(true);
                }}
                className="mt-2 w-full rounded-xl border border-violet-500/40 bg-violet-500/10 py-2 text-[11px] font-black text-violet-300 transition-all active:scale-[0.99] hover:bg-violet-500/20"
                data-testid="recarga-nueva"
              >
                🔁 Nueva recarga
              </button>
            </div>
          );
        })()}

        {/* Confirmar la recarga: monto + anotar como gasto */}
        {confirmandoRecarga && (
          <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3" data-testid="recarga-confirmar">
            <p className="text-[11px] font-bold text-emerald-300">¿Cuánto recargaste?</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-black text-slate-400">S/</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={montoRecargaTxt}
                onChange={e => setMontoRecargaTxt(e.target.value)}
                placeholder="63.00"
                autoFocus
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-base font-black text-emerald-200 outline-none focus:border-emerald-400"
                data-testid="recarga-monto-input"
              />
            </div>
            <label className="mt-2 flex items-center gap-2 text-[10px] text-slate-300">
              <input
                type="checkbox"
                checked={anotarGastoRecarga}
                onChange={e => setAnotarGastoRecarga(e.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-500"
                data-testid="recarga-anotar-gasto"
              />
              Anotarla como gasto 📶 Recarga de HOY en la Caja (recomendado — así el "En mano" queda con la verdad)
            </label>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setConfirmandoRecarga(false)}
                className="flex-1 rounded-xl bg-slate-800 py-2 text-[11px] font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={registrarRecarga}
                className="flex-1 rounded-xl bg-emerald-600 py-2 text-[11px] font-black text-white transition-all active:scale-[0.98] hover:bg-emerald-500"
                data-testid="recarga-guardar"
              >
                ✅ Guardar recarga
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Escáner IA (F-ID2 → F-ID2.5) */}
      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
          <Bot size={14} /> Escáner de pedidos (IA)
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Tomale una foto o subí una captura del pedido y la IA llena el viaje sola: cliente, zona, tarifa, dirección y
          celular. Podés configurar <span className="font-bold text-emerald-400">Gemini</span> (gratis) y{' '}
          <span className="font-bold text-sky-400">Claude</span> — si Gemini falla (ej: sin créditos),{' '}
          <span className="font-bold">Claude lo rescata solo</span>.
        </p>

        <div className="mt-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400/80">🟢 Key de Gemini (gratis)</p>
          <input
            type="password"
            value={geminiKey}
            onChange={e => {
              setGeminiKey(e.target.value);
              setPrueba(null);
              // el autoguardado lo hace el useEffect de arriba
            }}
            placeholder="AIza… o AQ.…"
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 font-mono text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-400"
            data-testid="input-gemini-key"
          />
        </div>

        <div className="mt-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-sky-400/80">
            🔵 Token de Claude (respaldo automático — opcional)
          </p>
          <input
            type="password"
            value={claudeKey}
            onChange={e => {
              setClaudeKey(e.target.value);
              setPrueba(null);
            }}
            placeholder="sk-ant-… (console.anthropic.com)"
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 font-mono text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-sky-400"
            data-testid="input-claude-key"
          />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={probarKey}
            disabled={probando}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 py-2.5 text-xs font-bold text-emerald-300 disabled:opacity-60"
            data-testid="boton-probar-key"
          >
            {probando ? <Loader2 size={14} className="animate-spin" /> : null}
            {probando ? 'Probando…' : 'Probar keys'}
          </button>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 py-2.5 text-xs font-bold text-slate-200"
          >
            <ExternalLink size={14} /> Crear key gratis
          </a>
        </div>

        {prueba && (
          <p
            className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${
              prueba.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/10 text-red-400'
            }`}
            data-testid="resultado-probar"
          >
            {prueba.ok ? '✅ ' : '❌ '}
            {prueba.mensaje}
          </p>
        )}

        <div className="mt-2 space-y-1 rounded-lg bg-slate-900/60 p-2.5 text-[10px] leading-relaxed text-slate-500">
          <p>
            <span className="font-bold text-emerald-400">🟢 GEMINI (gratis, recomendada):</span> 1) Tocá “Crear key gratis” (
            <span className="font-mono">aistudio.google.com/apikey</span>) · 2) sesión Google → “Crear clave de API” · 3)
            copiala y pegala arriba. ¿Te dio una key que empieza con <span className="font-mono">AQ.</span>? Es el formato
            NUEVO de Google — también vale ✅
          </p>
          <p>
            <span className="font-bold text-sky-400">🔵 CLAUDE (respaldo):</span> tu token{' '}
            <span className="font-mono">sk-ant-…</span> de console.anthropic.com (el mismo de rudy-bot). Si Gemini se
            queda sin créditos, el escáner sigue andando con Claude sin que hagas nada.
          </p>
          <p>
            🔒 Las keys se guardan SOLAS al pegarlas y viven SOLO en tu teléfono. Probá con “Probar keys” y escaneá con 📷 o 🖼️ en Viajes.
          </p>
        </div>
      </section>

      {/* Comisiones por plataforma */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <p className="text-xs font-bold text-slate-300">✂️ Comisión default por plataforma (%)</p>
        <p className="mt-1 text-[11px] text-slate-400">Se precarga al elegir el origen — podés cambiarla en cada viaje.</p>
        <div className="mt-2 space-y-2">
          {ORIGENES.map(o => (
            <div key={o.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-300">
                {o.emoji} {o.nombre}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={comisiones[o.id]}
                onChange={e => setComisiones({ ...comisiones, [o.id]: e.target.value })}
                className="w-20 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-right text-sm font-bold text-amber-300 outline-none focus:border-amber-400"
                data-testid={`input-comision-${o.id}`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* FASE A2: 👤 Mis datos — los usa el robot (nombre en los avisos)
          y la prueba 🧪 (tu celular). Antes vivían en "Mi QR". */}
      <section className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
          <User size={14} /> Mis datos (robot)
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          Tu nombre sale en los avisos que manda el robot (🛣️ Voy en camino, 🏁 Ya llegué…). Tu celular
          es para la prueba 🧪 — el robot te manda el mensaje de prueba ahí.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            value={miNombre}
            onChange={e => setMiNombre(e.target.value)}
            placeholder="Tu nombre (ej. Rudy)"
            className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-sky-400"
            data-testid="input-mi-nombre"
          />
          <input
            value={miCelular}
            onChange={e => setMiCelular(e.target.value)}
            inputMode="tel"
            placeholder="Tu celular (WhatsApp)"
            className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-sky-400"
            data-testid="input-mi-celular"
          />
        </div>
      </section>

      {/* FASE A2: 💜 Billeteras de inDrive — resumen + salto a la vista
          del menú. La EDICIÓN vive en "Mi QR Yape/Plin" → pestaña 🏍️
          inDrive (mismo lugar que las del trabajo, sin duplicar). */}
      <section className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
        <p className="text-xs font-bold text-purple-300">💜 Billeteras de inDrive (cobros libres)</p>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          El Yape/Plin PERSONAL que sale en los cobros de tus viajes libres. Se configura junto con
          las del trabajo, en <b className="text-purple-300">Mi QR Yape/Plin</b> del menú — pestaña{' '}
          <b className="text-purple-300">🏍️ inDrive</b>.
        </p>
        <div className="mt-2 space-y-2">
          <PanelBilleteraResumen
            emoji="💜"
            nombre="Yape personal"
            numero={config.yape.numero}
            tieneQr={!!config.yape.qrBase64}
          />
          <PanelBilleteraResumen
            emoji="🔷"
            nombre="Plin personal"
            numero={config.plin.numero}
            tieneQr={!!config.plin.qrBase64}
          />
        </div>
        <button
          onClick={() => onIrAYape?.()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500/15 py-2.5 text-xs font-bold text-purple-300 active:scale-95"
          data-testid="boton-ir-yape"
        >
          Configurar en Mi QR Yape/Plin <ArrowRight size={14} />
        </button>
      </section>

      {/* F-ID3.3: 🧭 con qué app viajar a las entregas */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
          <Compass size={13} className="text-cyan-400" /> Navegación a la entrega
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          Con qué app se abre el botón <b className="text-cyan-300">🧭 Navegar</b> (en el formulario y en cada
          viaje de la lista). Con “Preguntar” te deja elegir cada vez.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-slate-700 bg-slate-950 p-1" data-testid="ajustes-nav-app">
          {(
            [
              { id: 'preguntar' as AppNavegacion, nombre: 'Preguntar' },
              { id: 'google' as AppNavegacion, nombre: 'Google' },
              { id: 'waze' as AppNavegacion, nombre: 'Waze' },
            ]
          ).map(op => (
            <button
              key={op.id}
              onClick={() => {
                setNavApp(op.id);
                setAppNavegacion(op.id);
              }}
              className={`rounded-lg px-2 py-2 text-[11px] font-bold transition-colors ${
                navApp === op.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
              data-testid={`ajustes-nav-${op.id}`}
            >
              {op.nombre}
            </button>
          ))}
        </div>
      </section>

      {/* F-ID5 + FASE B: 🤖 Robot WhatsApp — cobro y avisos automáticos */}
      <section className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4" data-testid="seccion-robot">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
            <Bot size={14} /> Robot WhatsApp (cobro + avisos)
          </p>
          {/* Interruptor */}
          <button
            onClick={() => {
              const nuevo = !robotActivo;
              setRobotActivo(nuevo);
            }}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              robotActivo ? 'bg-violet-500' : 'bg-slate-700'
            }`}
            role="switch"
            aria-checked={robotActivo}
            aria-label="Activar el robot de cobro"
            data-testid="robot-toggle"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                robotActivo ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          Con el robot prendido, los botones le mandan al cliente <b className="text-violet-300">solo</b>:{' '}
          <b className="text-violet-300">Cobrar</b> (con tu QR de Yape adentro 💜),{' '}
          <b className="text-violet-300">Voy en camino</b>, <b className="text-violet-300">Llegando en X min</b>,{' '}
          <b className="text-violet-300">Ya llegué</b>, <b className="text-violet-300">Entregado</b> y{' '}
          <b className="text-violet-300">Pedir ubicación</b> —
          sin abrir WhatsApp. Va por la nube (cola propia de inDrive): si el bot se reinicia, el mensaje
          sale apenas revive. Si algo falla, la app abre WhatsApp como siempre. Necesita el parche{' '}
          <span className="font-mono text-[10px]">drivertrack_bot.js</span> en tu rudy-bot (Termux).
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={probarRobot}
            disabled={robotEstado === 'probando'}
            className="flex items-center gap-1.5 rounded-xl bg-violet-500/15 px-3 py-2 text-[11px] font-bold text-violet-300 disabled:opacity-60"
            data-testid="robot-probar"
          >
            {robotEstado === 'probando' ? <Loader2 size={13} className="animate-spin" /> : null}
            {robotEstado === 'probando' ? 'Mandando…' : 'Mandarme prueba'}
          </button>
          {robotEstado !== 'probando' && (
            <p
              className={`text-[11px] font-semibold ${
                robotEstado === 'online'
                  ? 'text-emerald-400'
                  : robotEstado === 'offline'
                    ? 'text-red-400'
                    : 'text-slate-500'
              }`}
              data-testid="robot-estado"
            >
              {robotEstado === 'online'
                ? '🟢 Prueba enviada — mirá tu WhatsApp'
                : robotEstado === 'offline'
                  ? '🔴 No se pudo — ¿sesión abierta y bot corriendo?'
                  : '⚪ Sin probar'}
            </p>
          )}
        </div>

        {/* FASE B: la prueba es un mensaje REAL a tu WhatsApp — si llega,
            todo el circuito (app → Firestore → bot → tu celular) anda */}
        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
          <span className={sesionActiva ? 'text-emerald-400' : 'text-red-400'}>{sesionActiva ? '●' : '○'}</span>
          {sesionActiva ? 'Sesión de RiderTrack abierta ✓' : 'Sin sesión — el robot necesita tu cuenta'}
        </p>
      </section>


      {/* ═══ FASE C: 💬 Mensajes del robot — textos EDITABLES ═══ */}
      <section className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4" data-testid="seccion-plantillas">
        <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
          <MessageSquareText size={14} /> Mensajes del robot (editables)
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          Cambiale la redacción a cada aviso — <b className="text-indigo-300">se guarda solo</b> al escribir y el
          próximo mensaje ya sale con tu texto. Usá las etiquetas{' '}
          <code className="rounded bg-slate-900 px-1 text-[10px] text-indigo-300">{'{cliente}'}</code>{' '}
          <code className="rounded bg-slate-900 px-1 text-[10px] text-indigo-300">{'{direccion}'}</code>{' '}
          <code className="rounded bg-slate-900 px-1 text-[10px] text-indigo-300">{'{minutos}'}</code>{' '}
          <code className="rounded bg-slate-900 px-1 text-[10px] text-indigo-300">{'{miNombre}'}</code> y la app las
          reemplaza con los datos de cada viaje.
        </p>

        <div className="mt-3 space-y-2">
          {(Object.keys(PLANTILLAS_DEF) as TipoPlantilla[]).map(tipo => {
            const abierta = plantillaAbierta === tipo;
            const editada = (plantillas[tipo] ?? '').trim() !== PLANTILLAS_DEF[tipo].trim();
            return (
              <div
                key={tipo}
                className="rounded-xl border border-slate-700 bg-slate-950/60 p-2.5"
                data-testid={`plantilla-${tipo}`}
              >
                <button
                  onClick={() => setPlantillaAbierta(abierta ? null : tipo)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-black text-slate-200">
                    {ETIQUETAS_PLANTILLA[tipo]}
                    {editada && (
                      <span className="rounded border border-indigo-500/40 bg-indigo-500/15 px-1.5 py-px text-[8px] font-black text-indigo-300">
                        EDITADO
                      </span>
                    )}
                  </span>
                  <ChevronDown size={14} className={`shrink-0 text-slate-500 transition-transform ${abierta ? 'rotate-180' : ''}`} />
                </button>

                {abierta && (
                  <div className="mt-2">
                    <textarea
                      value={plantillas[tipo] ?? ''}
                      onChange={e => setPlantillas(prev => ({ ...prev, [tipo]: e.target.value }))}
                      rows={7}
                      className="w-full resize-none rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-xs leading-relaxed text-slate-200 outline-none focus:border-indigo-400"
                      data-testid={`plantilla-input-${tipo}`}
                    />
                    <div className="mt-1.5 rounded-xl bg-slate-900/80 px-3 py-2">
                      <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">
                        👀 Vista previa (con datos de ejemplo)
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
                        {resolverPlantilla(plantillas[tipo] ?? '', {
                          cliente: 'Carlos',
                          direccion: 'Av. Prueba 123',
                          minutos: 10,
                          miNombre: miNombre,
                        })}
                      </p>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-500">Los cambios se guardan solos ☁️ (y van a la nube)</p>
                      {editada && (
                        <button
                          onClick={() => setPlantillas(prev => ({ ...prev, [tipo]: PLANTILLAS_DEF[tipo] }))}
                          className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:bg-slate-700"
                          data-testid={`plantilla-reset-${tipo}`}
                        >
                          ↩️ Volver al original
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ FASE H: 📷 Foto de entrega — el MENSAJE que va con la foto ═══ */}
      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4" data-testid="seccion-foto-entrega">
        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
          <Camera size={14} /> Foto de entrega (mensaje)
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          Cuando un cliente te pide <b className="text-emerald-300">la foto para comprobar la entrega</b>, se la
          sacás desde el viaje (📞 Contacto → 📷 Foto de la entrega) y sale por WhatsApp con{' '}
          <b className="text-emerald-300">este mensaje</b> — <b>se guarda solo</b> al escribir. Podés retocarlo
          también en el momento, justo antes de mandar cada foto.
        </p>

        <div className="mt-3">
          <textarea
            value={mensajeFoto}
            onChange={e => setMensajeFoto(e.target.value)}
            rows={4}
            placeholder={MENSAJE_FOTO_DEF}
            className="w-full resize-none rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-xs leading-relaxed text-slate-200 outline-none focus:border-emerald-400"
            data-testid="foto-mensaje-input"
          />
          <div className="mt-1.5 rounded-xl bg-slate-900/80 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">
              👀 Así va a salir (con datos de ejemplo)
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
              {armarMensajeFoto(
                {
                  cliente: 'Carlos',
                  direccion: 'Av. Prueba 123',
                } as Viaje,
                { miNombre } as ConfigDT,
              )}
            </p>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500">
              Etiquetas: <code className="rounded bg-slate-900 px-1 text-[9px] text-emerald-300">{'{cliente}'}</code>{' '}
              <code className="rounded bg-slate-900 px-1 text-[9px] text-emerald-300">{'{direccion}'}</code>{' '}
              <code className="rounded bg-slate-900 px-1 text-[9px] text-emerald-300">{'{hora}'}</code>{' '}
              <code className="rounded bg-slate-900 px-1 text-[9px] text-emerald-300">{'{miNombre}'}</code>{' '}
              <code className="rounded bg-slate-900 px-1 text-[9px] text-emerald-300">{'{firma}'}</code> — y se
              guarda solo ☁️
            </p>
            {(mensajeFoto ?? '').trim() !== '' && (
              <button
                onClick={() => setMensajeFoto('')}
                className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:bg-slate-700"
                data-testid="foto-mensaje-reset"
              >
                ↩️ Volver al original
              </button>
            )}
          </div>
        </div>
      </section>

      {/* FASE B2: 🖼️ Imágenes del robot — como las del TRABAJO, pero
          para tus avisos de inDrive. Subís una imagen por aviso y el
          robot la manda CON el mensaje; si no hay imagen, va texto
          pelado. El cambio aplica al siguiente envío, sin reiniciar. */}
      <section className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-4" data-testid="seccion-imagenes-robot">
        <p className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-300">
          <ImagePlus size={14} /> Imágenes del robot (avisos con imagen)
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          Como en el trabajo: subís una imagen para cada aviso y el robot la manda{' '}
          <b className="text-fuchsia-300">junto con el mensaje</b> — "estoy llegando en 10 minutos" con una imagen
          bonita, "ya llegué", "entregado"… La cambiás acá y el siguiente mensaje ya sale con la nueva (sin
          reiniciar nada). Sin imagen, el aviso va en texto pelado. El <b className="text-fuchsia-300">Cobrar</b>{' '}
          siempre usa tu QR de Yape 💜 (se configura en Mi QR).
        </p>
        <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
          Máx. 3 MB · JPG, PNG o WebP · solo para tus viajes de inDrive (los del trabajo no se tocan)
        </p>

        <div className="mt-3 space-y-2">
          {TIPOS_IMAGEN_DT.map(def => {
            const actual = imagenesRobot[def.tipo];
            const cargando = subiendoImagen === def.tipo;
            return (
              <div
                key={def.tipo}
                className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-2.5"
                data-testid={`imagen-robot-${def.tipo}`}
              >
                {/* Vista previa */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900/60">
                  {actual?.url ? (
                    <img src={actual.url} alt={def.etiqueta} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="px-1 text-center">
                      <ImagePlus size={16} className="mx-auto mb-0.5 text-slate-600" />
                      <span className="block text-[8px] leading-tight text-slate-500">solo texto</span>
                    </div>
                  )}
                </div>

                {/* Info + acciones */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[11px] font-black text-slate-200">{def.etiqueta}</p>
                    {actual && (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-px text-[8px] font-black text-emerald-400">
                        CON IMAGEN
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                    {def.desc}{' '}
                    <span className="font-mono text-[9px] text-slate-600">({def.boton})</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <input
                      ref={el => {
                        inputsImagen.current[def.tipo] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={e => cambiarImagenRobot(def.tipo, e.target.files?.[0])}
                    />
                    <button
                      onClick={() => inputsImagen.current[def.tipo]?.click()}
                      disabled={cargando}
                      className="flex items-center gap-1 rounded-lg bg-fuchsia-500/15 px-2.5 py-1.5 text-[10px] font-bold text-fuchsia-300 disabled:opacity-60"
                    >
                      {cargando ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                      {cargando ? 'Subiendo…' : actual ? 'Cambiar' : 'Subir imagen'}
                    </button>
                    {actual && (
                      <button
                        onClick={() => quitarImagenRobot(def.tipo, def.etiqueta)}
                        className="flex items-center gap-1 rounded-lg bg-slate-700/60 px-2.5 py-1.5 text-[10px] font-bold text-slate-300"
                      >
                        <X size={11} /> Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!sesionActiva && (
          <p className="mt-2 text-[10px] font-semibold text-red-400">
            Necesitás sesión abierta de RiderTrack para subir las imágenes
          </p>
        )}
      </section>


      {/* Backup */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <p className="text-xs font-bold text-slate-300">🗄️ Respaldo de datos</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Tus viajes viven en este teléfono. Exportá un backup cada tanto y guardalo en Drive.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={onExportarBackup}
            className="flex items-center justify-center gap-2 rounded-xl bg-sky-500/15 py-2.5 text-xs font-bold text-sky-300"
          >
            <Database size={14} /> Exportar
          </button>
          <input ref={inputBackup} type="file" accept=".json,application/json" onChange={importar} className="hidden" />
          <button
            onClick={() => inputBackup.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 py-2.5 text-xs font-bold text-slate-200"
          >
            <Upload size={14} /> Importar
          </button>
        </div>
      </section>

      {/* Zona peligrosa */}
      <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
        <p className="text-xs font-bold text-red-400">⚠️ Zona peligrosa</p>
        {borrarConfirm ? (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                onBorrarTodo();
                setBorrarConfirm(false);
              }}
              className="flex-1 rounded-xl bg-red-500/20 py-2.5 text-xs font-bold text-red-400"
            >
              SÍ, BORRAR TODO
            </button>
            <button
              onClick={() => setBorrarConfirm(false)}
              className="flex-1 rounded-xl bg-slate-700 py-2.5 text-xs font-bold text-slate-300"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setBorrarConfirm(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 py-2.5 text-xs font-bold text-red-400"
          >
            <Trash2 size={14} /> Borrar viajes y gastos
          </button>
        )}
      </section>

      {/* Todo se guarda solo (F-ID2.3) */}
      <p
        className="flex items-center justify-center gap-1.5 pb-1 text-center text-[11px] font-semibold text-emerald-400"
        data-testid="nota-autoguardado"
      >
        <Check size={12} /> Todo se guarda solo — cambiá lo que quieras y salí tranquilo
      </p>

      <p className="pb-2 text-center text-[10px] text-slate-500">
        DriverTrack v0.10.2 (FASE L — 🔎 Seguimiento de ruta con LETRA GRANDE: la dirección de cada cliente se ve más grande (botón "Aa" en "Tu ruta de hoy" → Normal / Grande / Muy grande, se queda guardado) y 🚀 botón "Estoy yendo" en cada cliente del Seguimiento (igualito al de Mi Ruta): elegís si lo manda el robot solo o abre tu WhatsApp con el mensaje listo, y en un toque le avisás en cuántos minutos llegás · junto con la FASE K: 🎯 recarga semanal: poné cuánto querés hacerte por día y la app te dice cuánto recargar UNA vez para toda la semana (meta × % comisión × días); con el modo comisión prepagada prendido cada carrera inDrive entra COMPLETA — sin descuento del % — y la barra de saldo te dice cuánto queda de la recarga en los Viajes, la Caja y Ajustes · junto con la FASE J: 📷 foto de entrega AUTOMÁTICA: sacás la foto, apretás "🤖 Enviar solo" y el cliente la recibe solo, sin abrir WhatsApp — igual que el cobro con QR; la app escucha el resultado real del bot y te avisa: enviado ✓ / no pudo / bot apagado, en cuyo caso queda encolada y sale apenas encienda; el envío manual 📎 sigue de respaldo) · Lima, PE
      </p>
    </div>
  );
}
