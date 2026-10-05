// ═══════════════════════════════════════════════════════════
// ➕ DriverTrack — Formulario de viaje rápido (F-ID1 → F-ID2.6)
// F-ID1: tarifa + % comisión → cálculo EN VIVO del neto.
// F-ID2: 📷 escanear la dirección con una foto → la IA llena
//        el formulario solo (cliente, zona, tarifa, dirección).
// F-ID2.4: 🖼️ botón GALERÍA — subir una captura de pantalla se
//        lee mucho mejor que fotografiar la pantalla con la cámara.
// F-ID2.5: escáner v2 — DIRECCIÓN y CELULAR con campos propios
//        (antes quedaban perdidos dentro de Notas) + botón 💬
//        WhatsApp que abre el chat del cliente con el mensaje de
//        cobro listo (estilo QR de RiderTrack v2).
// F-ID2.6: escáner v3 — el NOMBRE REAL del cliente (la IA ya no
//        confunde "C.1" — la calle — con la persona) + campos
//        💜 Yape del pedido (nombre y número: "Mk yape 980811297")
//        + si la foto no trae teléfono, el celular se llena con el
//        número del yape (en Perú el yape ES el celular del cliente).
// ═══════════════════════════════════════════════════════════
// F-ID2.7: 💜 TU Yape se guarda UNA vez (tarjeta en esta misma
//        pantalla) y sale solo en TODOS los mensajes de cobro — antes
//        el número propio se terminaba escribiendo a mano por cada
//        cliente y al apretar "Agregar viaje" desaparecía. Además:
//        📋 vista previa del mensaje SIEMPRE visible (en vivo, nunca
//        desaparece) y mensaje reorganizado en bloques.
// ═══════════════════════════════════════════════════════════
// F-ID3.2: 🧲 BORRADOR — todo lo escrito (o escaneado) sobrevive
//        cambios de pestaña, recargas y el asesino de memoria de
//        Android: antes al pasar a Mapa y volver, el formulario
//        aparecía VACÍO y se perdía la dirección escaneada.
//        📍 UBICAR POR COORDENADAS — botón junto a la dirección
//        que abre un mini-mapa (pin arrastrable / mi GPS / lat-lng
//        a mano, igual que RiderTrack v2).
//        📞 LLAMAR — botón junto a Cobrar que abre el marcador.
import { useEffect, useMemo, useRef, useState } from 'react';
import { EvArchivo } from '../tipos';
import { Bot, Camera, Check, Compass, ImageUp, Loader2, MapPin, MessageCircle, Navigation, Phone, X, Zap } from 'lucide-react';
import { ConfigDT, OrigenViaje, ORIGENES, Viaje } from '../types';
import { fechaHoy, horaAhora } from '../storage';
import { armarMensajeCobro, fmtSoles, linkLlamada, linkWhatsApp, normalizarCelular, vibrar } from '../utils';
import { escanearDireccion } from '../services/escanerIA';
import { abrirNavegacion, tieneDestino, DestinoNav } from '../services/navegacion';
import UbicarModal from './UbicarModal';
import NavegarMenu from './NavegarMenu';

// ── F-ID3.2: el BORRADOR del formulario (vive en localStorage) ──
interface BorradorViaje {
  origen: OrigenViaje;
  tarifa: string;
  comisionPct: string;
  cliente: string;
  zona: string;
  direccion: string;
  dirA: string;          // FASE C: dirección de recojo (A)
  celular: string;
  celularEnvia: string;  // FASE C: teléfono de quien envía
  celularRecibe: string; // FASE C: teléfono de quien recibe
  yapeNombre: string;
  yapeNumero: string;
  notas: string;
  coordenadas?: { lat: number; lng: number } | null;
  coordenadasA?: { lat: number; lng: number } | null; // FASE E: pin del recojo (A)
}

const K_BORRADOR = 'dt_borrador_v1';

function leerBorrador(): BorradorViaje | null {
  try {
    const raw = localStorage.getItem(K_BORRADOR);
    if (!raw) return null;
    const b = JSON.parse(raw) as Partial<BorradorViaje>;
    if (!b || typeof b !== 'object') return null;
    // vacío de verdad (solo defaults) → ni lo restauramos
    const algoEscrito =
      (b.tarifa ?? '').trim() || (b.cliente ?? '').trim() || (b.direccion ?? '').trim() ||
      (b.celular ?? '').trim() || (b.zona ?? '').trim() || (b.yapeNombre ?? '').trim() ||
      (b.yapeNumero ?? '').trim() || (b.notas ?? '').trim() || b.coordenadas || b.coordenadasA;
    if (!algoEscrito) return null;
    return {
      origen: (['indrive', 'rappi', 'pedidosya', 'directo'].includes(b.origen ?? '')
        ? b.origen
        : 'indrive') as OrigenViaje,
      tarifa: b.tarifa ?? '',
      comisionPct: b.comisionPct ?? '',
      cliente: b.cliente ?? '',
      zona: b.zona ?? '',
      direccion: b.direccion ?? '',
      dirA: b.dirA ?? '',
      // FASE C.2: ya no hay campo "celular del cliente" aparte — el
      // borrador viejo lo migra al de quien ENVÍA
      celular: b.celular ?? '',
      celularEnvia: b.celularEnvia ?? b.celular ?? '',
      celularRecibe: b.celularRecibe ?? '',
      yapeNombre: b.yapeNombre ?? '',
      yapeNumero: b.yapeNumero ?? '',
      notas: b.notas ?? '',
      coordenadas: b.coordenadas ?? null,
      coordenadasA: b.coordenadasA ?? null, // FASE E: pin del recojo (A)
    };
  } catch {
    return null;
  }
}

function guardarBorrador(b: BorradorViaje): void {
  try {
    localStorage.setItem(K_BORRADOR, JSON.stringify(b));
  } catch {
    /* sin espacio: seguirá sin borrador, no es crítico */
  }
}

function borrarBorrador(): void {
  try {
    localStorage.removeItem(K_BORRADOR);
  } catch {
    /* nada */
  }
}

interface Props {
  config: ConfigDT;
  onAgregar: (v: Viaje) => void;
  onGuardarMiYape: (numero: string, titular: string) => void; // F-ID2.7: tu Yape queda guardado 1 sola vez
  onNecesitaKey: () => void; // F-ID2: te manda a Ajustes si no hay key Gemini
  // F-ID5: cobro compartido — robot automático si está activo, si no WhatsApp
  onMandarCobro: (datos: { cliente: string; monto: number; direccion: string }, celular: string) => Promise<void> | void;
  cobroEnCurso?: boolean; // F-ID5: hay un cobro del robot en vuelo (spinner)
}

export default function ViajeForm({
  config,
  onAgregar,
  onGuardarMiYape,
  onNecesitaKey,
  onMandarCobro,
  cobroEnCurso = false,
}: Props) {
  // F-ID3.2: el formulario arranca desde el BORRADOR guardado (si
  // había algo escrito/escaneado, NO se pierde al cambiar de pestaña)
  const borradorInicial = useRef(leerBorrador()).current;
  const [origen, setOrigen] = useState<OrigenViaje>(borradorInicial?.origen ?? 'indrive');
  const [tarifa, setTarifa] = useState(borradorInicial?.tarifa ?? '');
  const [comisionPct, setComisionPct] = useState<string>(
    borradorInicial?.comisionPct ?? String(config.comisiones.indrive),
  );
  const [cliente, setCliente] = useState(borradorInicial?.cliente ?? '');
  const [zona, setZona] = useState(borradorInicial?.zona ?? '');
  const [direccion, setDireccion] = useState(borradorInicial?.direccion ?? ''); // F-ID2.5: campo propio (antes vivía en notas)
  const [dirA, setDirA] = useState(borradorInicial?.dirA ?? ''); // FASE C: dirección de RECOJO (A)
  // FASE C.2: SOLO DOS teléfonos — quien ENVÍA (el cliente principal,
  // a él le va el cobro) y quien RECIBE. El viejo "celular del cliente"
  // se migró al de quien envía (arriba, en leerBorrador).
  const [celularEnvia, setCelularEnvia] = useState(borradorInicial?.celularEnvia ?? ''); // FASE C: quién envía
  const [celularRecibe, setCelularRecibe] = useState(borradorInicial?.celularRecibe ?? ''); // FASE C: quién recibe
  const [yapeNombre, setYapeNombre] = useState(borradorInicial?.yapeNombre ?? ''); // F-ID2.6: "Mk" en "Mk yape 980811297"
  const [yapeNumero, setYapeNumero] = useState(borradorInicial?.yapeNumero ?? ''); // F-ID2.6: 980811297 — para saber quién pagó
  const [notas, setNotas] = useState(borradorInicial?.notas ?? '');
  const [error, setError] = useState('');
  // F-ID3.2: coordenadas de la entrega (pin en el mapa)
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(
    borradorInicial?.coordenadas ?? null,
  );
  const [ubicarAbierto, setUbicarAbierto] = useState(false);
  // FASE E: coordenadas del RECOJO (A) — mismo flujo que la entrega
  const [coordenadasA, setCoordenadasA] = useState<{ lat: number; lng: number } | null>(
    borradorInicial?.coordenadasA ?? null,
  );
  const [ubicarAAbierto, setUbicarAAbierto] = useState(false);
  // F-ID3.3: mini-selector Waze/Google (cuando la preferencia es 'preguntar')
  const [navAbierto, setNavAbierto] = useState(false);
  // FASE C: mini-selector para navegar al RECOJO (A) o a un recién agregado
  const [navObjetivo, setNavObjetivo] = useState<{ destino: DestinoNav; etiqueta: string } | null>(null);
  // FASE C.2: el "celular" principal del viaje = el que ENVÍA (y si solo
  // cargaste el que recibe, ese) — así el cobro y el robot siguen
  // andando con la data de siempre
  const celularPrincipal = celularEnvia.trim() || celularRecibe.trim();

  // ── F-ID2.7: TU Yape para cobrar (se guarda 1 vez, vive en config) ──
  const [miYapeNum, setMiYapeNum] = useState('');
  const [miYapeTitular, setMiYapeTitular] = useState('');
  const [editarMiYape, setEditarMiYape] = useState(false);

  // ── F-ID2: estado del escáner ──
  const [escaneando, setEscaneando] = useState(false);
  const [fotoB64, setFotoB64] = useState('');       // preview (NO se guarda en el viaje)
  const [fotoGrande, setFotoGrande] = useState(false);
  const [scanOk, setScanOk] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanDetalle, setScanDetalle] = useState('');   // F-ID2.4: pista técnica del error
  const [fuenteScan, setFuenteScan] = useState<'camara' | 'galeria' | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputGaleria = useRef<HTMLInputElement>(null);

  // Al cambiar de origen, precarga el % default de esa plataforma.
  // F-ID3.2: salvo la PRIMERA vez si vino borrador — el % del
  // borrador gana (sino siempre lo pisaría con el default).
  const saltearPrecarga = useRef(!!borradorInicial);
  useEffect(() => {
    if (saltearPrecarga.current) {
      saltearPrecarga.current = false;
      return;
    }
    setComisionPct(String(config.comisiones[origen] ?? 0));
  }, [origen, config.comisiones]);

  // F-ID3.2: 🧲 el borrador se guarda SOLO en cada cambio — así
  // cambiar de pestaña (o que Android mate la app) no pierde nada
  useEffect(() => {
    guardarBorrador({
      origen, tarifa, comisionPct, cliente, zona, direccion, dirA,
      celular: celularEnvia.trim() || celularRecibe.trim(), // FASE C.2: compat
      celularEnvia, celularRecibe, yapeNombre, yapeNumero, notas, coordenadas,
      coordenadasA, // FASE E: pin del recojo sobrevive cambios de pestaña
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen, tarifa, comisionPct, cliente, zona, direccion, dirA, celularEnvia, celularRecibe, yapeNombre, yapeNumero, notas, coordenadas, coordenadasA]);

  const { comision, neto } = useMemo(() => {
    const t = parseFloat(tarifa) || 0;
    const p = parseFloat(comisionPct) || 0;
    const c = +(t * (p / 100)).toFixed(2);
    return { comision: c, neto: +(t - c).toFixed(2) };
  }, [tarifa, comisionPct]);

  const puedeEnviar = parseFloat(tarifa) > 0;

  function limpiarEscaneo() {
    setFotoB64('');
    setFotoGrande(false);
    setScanOk(false);
    setScanError('');
    setScanDetalle('');
    if (inputFoto.current) inputFoto.current.value = '';
    if (inputGaleria.current) inputGaleria.current.value = '';
  }

  function abrirEscanner() {
    if (escaneando) return;
    if (!config.geminiKey.trim() && !config.claudeKey.trim()) {
      onNecesitaKey();
      return;
    }
    setScanError('');
    setScanDetalle('');
    setScanOk(false);
    setFuenteScan('camara');
    inputFoto.current?.click();
  }

  // F-ID2.4: subir una captura desde la galería — la IA las lee mucho
  // mejor que una foto a la pantalla (nítidas, sin reflejos ni moiré)
  function abrirGaleria() {
    if (escaneando) return;
    if (!config.geminiKey.trim() && !config.claudeKey.trim()) {
      onNecesitaKey();
      return;
    }
    setScanError('');
    setScanDetalle('');
    setScanOk(false);
    setFuenteScan('galeria');
    inputGaleria.current?.click();
  }

  async function alElegirFoto(e: EvArchivo) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-elegir la misma foto
    if (!file) return;

    setEscaneando(true);
    setScanError('');
    setScanDetalle('');
    setScanOk(false);
    try {
      const { comprimirImagenParaOCR } = await import('../utils');
      const b64 = await comprimirImagenParaOCR(file);
      setFotoB64(b64);
      // F-ID2.5: se pasan LAS DOS keys — si Gemini revienta con error
      // de cuenta (ej: sin créditos), Claude lo rescata solo
      const datos = await escanearDireccion(b64, config.geminiKey, config.claudeKey);

      // Auto-llenado: solo sobreescribe lo que la foto realmente trajo
      if (datos.cliente) setCliente(datos.cliente);
      if (datos.zona) setZona(datos.zona);
      if (datos.tarifa !== null) setTarifa(String(datos.tarifa));
      // F-ID2.5: dirección y celular a sus PROPIOS campos (antes
      // terminaban aplastados dentro de notas)
      if (datos.direccion) setDireccion(datos.direccion);
      // F-ID2.6: si la foto no trae teléfono pero sí yape, el celular
      // se llena con el número del yape — en Perú el yape ES el
      // celular del cliente (editable como todo el formulario)
      // F-ID2.5 + FASE C.2: el teléfono de la foto es el de QUIEN
      // ENVÍA (el cliente que mandó el pedido)
      if (datos.telefono) setCelularEnvia(datos.telefono);
      else if (datos.yapeNumero) setCelularEnvia(datos.yapeNumero);
      // F-ID2.6: el yape del pedido con sus DOS campos
      if (datos.yapeNombre) setYapeNombre(datos.yapeNombre);
      if (datos.yapeNumero) setYapeNumero(datos.yapeNumero);

      // La referencia y lo suelto sigue en notas (más corto ahora)
      const trozos: string[] = [];
      if (datos.referencia) trozos.push(`Ref: ${datos.referencia}`);
      if (trozos.length > 0) setNotas(trozos.join('\n'));

      setScanOk(true);
      vibrar(80);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Algo falló escaneando — probá de nuevo');
      setScanDetalle((err as Error & { detalle?: string }).detalle ?? '');
      // La foto queda de guía para escribir a mano
    } finally {
      setEscaneando(false);
    }
  }

  // F-ID2.5 → F-ID2.8: 💬 mensaje de cobro por WhatsApp — delega a la
  // función COMPARTIDA de utils: el botoncito 💬 de la lista de abajo
  // manda EXACTAMENTE este mismo mensaje (antes mandaba uno viejo
  // sin tu Yape). Bloques: saludo → pedido → cómo pagar (TU Yape) → gracias
  function armarMensaje(): string {
    return armarMensajeCobro(
      { cliente, monto: parseFloat(tarifa) || 0, direccion },
      config,
    );
  }

  // F-ID2.7: guarda TU Yape en el config — queda para todos los
  // clientes, ya no se escribe por pedido (y no se borra al agregar viaje)
  function guardarMiYape() {
    const digitos = miYapeNum.replace(/\D/g, '');
    if (digitos.length < 6) {
      setError('Poné tu número de Yape (9 dígitos)');
      return;
    }
    setError('');
    onGuardarMiYape(miYapeNum, miYapeTitular);
    setEditarMiYape(false);
    vibrar(60);
  }

  function abrirEditorMiYape() {
    setMiYapeNum(config.yape.numero);
    setMiYapeTitular(config.yape.titular);
    setEditarMiYape(true);
  }

  // F-ID5: 💬/🤖 Cobrar — delega en el flujo COMPARTIDO del shell:
  // con el robot activo, el bot manda el mensaje CON tu QR de Yape
  // solo; si no, abre WhatsApp como siempre (revisás y envía vos).
  function cobrar() {
    // FASE C.2: el cobro le va al que ENVÍA por defecto (y si solo
    // cargaste el que recibe, a él)
    if (!normalizarCelular(celularPrincipal)) {
      setError('Poné un celular (el que envía o el que recibe) para mandarle el cobro');
      return;
    }
    setError('');
    vibrar(60);
    onMandarCobro(
      { cliente, monto: parseFloat(tarifa) || 0, direccion },
      celularPrincipal,
    );
  }

  // F-ID3.2 + FASE C.2: 📞 llamada directa a quien ENVÍA o a quien
  // RECIBE — cada teléfono tiene su propio botoncito al lado
  function llamarA(quien: 'envia' | 'recibe') {
    const crudo = quien === 'envia' ? celularEnvia : celularRecibe;
    if (!normalizarCelular(crudo)) {
      setError(quien === 'envia' ? 'Poné el celular de quien envía' : 'Poné el celular de quien recibe');
      return;
    }
    setError('');
    window.open(linkLlamada(crudo), '_self');
  }

  // F-ID3.3: 🧭 abre Waze/Google Maps hacia la entrega. Si no hay
  // preferencia guardada ('preguntar'), muestra el mini-selector.
  // Escaneaste el pedido → Navegar → manejá (y grabá tus km 📍).
  function navegarAEntrega() {
    const destino = coordenadas ?? { direccion: direccion.trim() };
    if (!tieneDestino(destino)) return;
    if (!abrirNavegacion(destino)) setNavAbierto(true);
  }

  // FASE C → FASE E: 🧭 navegar al RECOJO (punto A) — con el pin
  // exacto si lo marcaste, o la dirección (texto) si no. Mismo
  // flujo que la entrega (app preferida o mini-selector).
  function navegarARecojo() {
    const destino = coordenadasA ?? { direccion: dirA.trim() };
    if (!tieneDestino(destino)) return;
    if (!abrirNavegacion(destino)) setNavObjetivo({ destino, etiqueta: dirA.trim() });
  }

  function enviar() {
    if (!puedeEnviar) {
      setError('Poné la tarifa del viaje');
      return;
    }
    setError('');
    const t = parseFloat(tarifa);
    const p = parseFloat(comisionPct) || 0;
    const c = +(t * (p / 100)).toFixed(2);
    const nuevo: Viaje = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fecha: fechaHoy(),
      hora: horaAhora(),
      origen,
      cliente: cliente.trim(),
      zona: zona.trim(),
      direccion: direccion.trim(),
      ...(dirA.trim() ? { dirA: dirA.trim() } : {}), // FASE C: recojo (A)
      // FASE C.2: el "celular" principal del viaje = el que ENVÍA
      // (o el que recibe si es el único) — cobro y robot andan igual
      celular: celularEnvia.trim() || celularRecibe.trim(),
      ...(celularEnvia.trim() ? { celularEnvia: celularEnvia.trim() } : {}),   // FASE C
      ...(celularRecibe.trim() ? { celularRecibe: celularRecibe.trim() } : {}), // FASE C
      yapeNombre: yapeNombre.trim(),
      yapeNumero: yapeNumero.trim(),
      kmGPS: 0,        // F-ID3: se llena al grabar el recorrido con el botón 📍
      duracionSeg: 0,  // F-ID3: ídem
      ...(coordenadas ? { coordenadas } : {}), // F-ID3.2: pin de la entrega (B)
      ...(coordenadasA ? { coordenadasA } : {}), // FASE E: pin del recojo (A)
      tarifa: t,
      comisionPct: p,
      comision: c,
      neto: +(t - c).toFixed(2),
      notas: notas.trim(),
    };
    onAgregar(nuevo);
    // FASE C.2: el formulario se limpia para el próximo viaje — el
    // agregado aparece ABAJO en la lista como tarjeta completa con
    // todos sus datos y botones (resaltado ✨NUEVO + scroll a él)
    setTarifa('');
    setCliente('');
    setZona('');
    setDireccion('');
    setDirA('');
    setCelularEnvia('');
    setCelularRecibe('');
    setYapeNombre('');
    setYapeNumero('');
    setNotas('');
    setCoordenadas(null);
    setCoordenadasA(null); // FASE E
    borrarBorrador(); // F-ID3.2: el viaje ya está guardado — el borrador se limpia
    limpiarEscaneo();
    vibrar(60);
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Zap size={16} className="text-amber-400" />
        <h2 className="text-sm font-bold text-slate-100">Viaje rápido</h2>
      </div>

      {/* ── F-ID2: escáner de dirección (estilo Circuit) ── */}
      <div className="mb-3 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-3">
        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={alElegirFoto}
          className="hidden"
          data-testid="input-escanear"
        />
        {/* F-ID2.4: input SIN capture → abre la galería / archivos */}
        <input
          ref={inputGaleria}
          type="file"
          accept="image/*"
          onChange={alElegirFoto}
          className="hidden"
          data-testid="input-galeria"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={abrirEscanner}
            disabled={escaneando}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-black transition-all active:scale-[0.98] ${
              escaneando && fuenteScan === 'camara'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
            data-testid="boton-escanear"
          >
            {escaneando && fuenteScan === 'camara' ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Leyendo…
              </>
            ) : (
              <>
                <Camera size={18} /> Cámara
              </>
            )}
          </button>
          <button
            onClick={abrirGaleria}
            disabled={escaneando}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-black transition-all active:scale-[0.98] ${
              escaneando && fuenteScan === 'galeria'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
            }`}
            data-testid="boton-galeria"
          >
            {escaneando && fuenteScan === 'galeria' ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Leyendo…
              </>
            ) : (
              <>
                <ImageUp size={18} /> Galería
              </>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-400">
          La IA llena el viaje sola — con una 🖼️ captura de pantalla funciona mejor que con foto a la pantalla
        </p>

        {/* Foto de guía + resultado */}
        {fotoB64 && (
          <div className="mt-2 flex items-start gap-2">
            <button
              onClick={() => setFotoGrande(g => !g)}
              className={`relative shrink-0 overflow-hidden rounded-lg border border-slate-600 ${fotoGrande ? 'w-full' : 'w-16'}`}
              aria-label="Ver foto"
            >
              <img
                src={fotoB64}
                alt="Foto del pedido"
                className={fotoGrande ? 'w-full object-contain' : 'h-16 w-16 object-cover'}
              />
            </button>
            {!fotoGrande && (
              <button
                onClick={limpiarEscaneo}
                className="rounded-lg p-1.5 text-slate-500 hover:text-red-400"
                aria-label="Quitar foto"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {scanOk && (
          <div
            className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300"
            data-testid="scan-ok"
          >
            <Check size={14} /> ¡Listo! Revisá los datos antes de guardar
          </div>
        )}
        {scanError && (
          <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400" data-testid="scan-error">
            {scanError}
            {scanDetalle && (
              <span
                className="mt-1 block break-words font-mono text-[10px] text-red-400/60"
                data-testid="scan-detalle"
              >
                [{scanDetalle}]
              </span>
            )}
            <span className="mt-1.5 block text-[11px] text-slate-400">
              💡 Tip: una captura de pantalla nítida (Galería) se lee mucho mejor que una foto a la pantalla
            </span>
          </div>
        )}
      </div>

      {/* Origen: chips de plataforma */}
      <div className="grid grid-cols-4 gap-2">
        {ORIGENES.map(o => (
          <button
            key={o.id}
            onClick={() => setOrigen(o.id)}
            className={`rounded-xl border px-1 py-2 text-xs font-semibold transition-all ${
              origen === o.id
                ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-600 bg-slate-900/50 text-slate-400 hover:border-slate-500'
            }`}
          >
            <span className="mr-1">{o.emoji}</span>
            {o.nombre}
          </button>
        ))}
      </div>

      {/* Tarifa + comisión */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-slate-400">Tarifa del viaje (S/)</label>
          <input
            type="number"
            inputMode="decimal"
            value={tarifa}
            onChange={e => setTarifa(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-xl font-bold text-emerald-300 placeholder-slate-600 outline-none focus:border-emerald-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-400">% comisión</label>
          <input
            type="number"
            inputMode="decimal"
            value={comisionPct}
            onChange={e => setComisionPct(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-xl font-bold text-amber-300 outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Cliente + zona */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          value={cliente}
          onChange={e => setCliente(e.target.value)}
          placeholder="Cliente (opcional)"
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400"
        />
        <input
          value={zona}
          onChange={e => setZona(e.target.value)}
          placeholder="Zona (opcional)"
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400"
        />
      </div>

      {/* FASE C → FASE E: dirección A — el RECOJO (de dónde salís a
          buscar el pedido). Ahora con el MISMO botón 📍 Ubicar que la
          entrega: mapa + buscador por dirección + GPS + copiar. */}
      <div className="mt-2 flex gap-2">
        <input
          value={dirA}
          onChange={e => setDirA(e.target.value)}
          placeholder="🅰️ Dirección de recojo (A) — opcional"
          className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400"
          data-testid="input-direccion-a"
        />
        <button
          onClick={() => setUbicarAAbierto(true)}
          className={`flex shrink-0 items-center gap-1 rounded-xl px-3 text-[11px] font-bold transition-all active:scale-[0.98] ${
            coordenadasA
              ? 'border border-amber-400 bg-amber-500/25 text-amber-200'
              : 'border border-slate-600 bg-slate-900 text-slate-300 hover:border-amber-500/60 hover:text-amber-300'
          }`}
          title="Marcar el recojo (A) en el mapa — por dirección o coordenadas"
          data-testid="boton-ubicar-a"
        >
          <MapPin size={15} /> {coordenadasA ? 'Listo' : 'Ubicar'}
        </button>
        {dirA.trim() && (
          <button
            onClick={navegarARecojo}
            className="flex shrink-0 items-center rounded-xl bg-amber-500/15 px-3 text-amber-300 transition-all active:scale-[0.98] hover:bg-amber-500/25"
            title="Navegar al recojo (A)"
            data-testid="boton-navegar-a"
          >
            <Compass size={16} />
          </button>
        )}
      </div>
      {coordenadasA && (
        <div
          className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300"
          data-testid="chip-coordenadas-a"
        >
          <span className="truncate font-mono">
            🅰️ {coordenadasA.lat.toFixed(5)}, {coordenadasA.lng.toFixed(5)}
          </span>
          <button
            onClick={() => setCoordenadasA(null)}
            className="shrink-0 rounded p-0.5 text-amber-400/70 hover:text-red-400"
            aria-label="Quitar coordenadas del recojo"
            data-testid="quitar-coordenadas-a"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* F-ID2.5: dirección de entrega (campo propio, se llena con el escaneo)
          F-ID3.2: + botón 📍 para marcar la entrega EN EL MAPA (por
          coordenadas — pin arrastrable / mi GPS / a mano)
          FASE C: es la dirección B (entrega) — la A (recojo) va arriba */}
      <div className="mt-2 flex gap-2">
        <input
          value={direccion}
          onChange={e => setDireccion(e.target.value)}
          placeholder="🅱️ Dirección de entrega (B) — se llena con el escaneo"
          className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400"
          data-testid="input-direccion"
        />
        <button
          onClick={() => setUbicarAbierto(true)}
          className={`flex shrink-0 items-center gap-1 rounded-xl px-3 text-[11px] font-bold transition-all active:scale-[0.98] ${
            coordenadas
              ? 'border border-sky-400 bg-sky-500/25 text-sky-200'
              : 'border border-slate-600 bg-slate-900 text-slate-300 hover:border-sky-500/60 hover:text-sky-300'
          }`}
          title="Marcar la entrega en el mapa (por coordenadas)"
          data-testid="boton-ubicar"
        >
          <MapPin size={15} /> {coordenadas ? 'Listo' : 'Ubicar'}
        </button>
      </div>
      {coordenadas && (
        <div
          className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-300"
          data-testid="chip-coordenadas"
        >
          <span className="truncate font-mono">
            📍 {coordenadas.lat.toFixed(5)}, {coordenadas.lng.toFixed(5)}
          </span>
          <button
            onClick={() => setCoordenadas(null)}
            className="shrink-0 rounded p-0.5 text-sky-400/70 hover:text-red-400"
            aria-label="Quitar coordenadas"
            data-testid="quitar-coordenadas"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* F-ID3.3: 🧭 viajar hasta la entrega con Waze o Google Maps —
          aparece cuando hay dirección (escaneada o escrita) o pin.
          Así la app no solo CUENTA los km: también te LLEVA. */}
      {(direccion.trim() || coordenadas) && (
        <button
          onClick={navegarAEntrega}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/15 px-3 py-2.5 text-xs font-black text-sky-300 transition-all active:scale-[0.98] hover:bg-sky-500/25"
          title="Abrir Waze o Google Maps hacia la entrega"
          data-testid="boton-navegar-form"
        >
          <Compass size={15} /> Navegar a la entrega
          <span className="text-[9px] font-medium text-sky-400/70">
            {coordenadas ? 'con el pin exacto 📍' : 'con la dirección 🧭'}
          </span>
        </button>
      )}

      {/* ── FASE C.2: DOS teléfonos — quien ENVÍA (A, el cliente
          principal: a él le va el cobro) y quien RECIBE (B). Cada
          uno con su botoncito 📞 al lado. ── */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex min-w-0 gap-1">
          <input
            value={celularEnvia}
            onChange={e => setCelularEnvia(e.target.value)}
            inputMode="tel"
            placeholder="📤 Cel. ENVÍA"
            className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400"
            data-testid="input-celular-envia"
          />
          <button
            onClick={() => llamarA('envia')}
            disabled={escaneando || !celularEnvia.trim()}
            className="flex shrink-0 items-center rounded-xl bg-sky-500/20 px-2.5 text-sky-300 transition-all active:scale-[0.98] disabled:opacity-40"
            title="Llamar a quien ENVÍA"
            aria-label="Llamar a quien envía"
            data-testid="boton-llamar-envia"
          >
            <Phone size={16} />
          </button>
        </div>
        <div className="flex min-w-0 gap-1">
          <input
            value={celularRecibe}
            onChange={e => setCelularRecibe(e.target.value)}
            inputMode="tel"
            placeholder="📥 Cel. RECIBE"
            className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400"
            data-testid="input-celular-recibe"
          />
          <button
            onClick={() => llamarA('recibe')}
            disabled={escaneando || !celularRecibe.trim()}
            className="flex shrink-0 items-center rounded-xl bg-sky-500/20 px-2.5 text-sky-300 transition-all active:scale-[0.98] disabled:opacity-40"
            title="Llamar a quien RECIBE"
            aria-label="Llamar a quien recibe"
            data-testid="boton-llamar-recibe"
          >
            <Phone size={16} />
          </button>
        </div>
      </div>

      {/* 💬/🤖 Cobrar — al que ENVÍA por defecto (si solo cargaste el
          que recibe, a él) — mismo flujo compartido de siempre */}
      <button
        onClick={cobrar}
        disabled={escaneando || cobroEnCurso || !celularPrincipal}
        className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all active:scale-[0.98] disabled:opacity-50 ${
          config.robotActivo ? 'bg-violet-500 text-white' : 'bg-[#25D366] text-slate-950'
        }`}
        data-testid="boton-whatsapp"
      >
        {cobroEnCurso ? (
          <Loader2 size={16} className="animate-spin" />
        ) : config.robotActivo ? (
          <Bot size={16} />
        ) : (
          <MessageCircle size={16} />
        )}
        {cobroEnCurso ? 'Mandando…' : config.robotActivo ? 'Cobrar con el robot 🤖' : 'Cobrar por WhatsApp'}
      </button>
      {celularPrincipal && (
        <p className="mt-1 text-[10px] text-slate-500" data-testid="nota-cobro">
          {config.robotActivo
            ? '🤖 El robot le manda el cobro al que ENVÍA, con tu QR de Yape adentro · en el menú 🤖 del viaje elegís a quién avisar'
            : '💬 Cobrar abre el WhatsApp del que envía con el mensaje listo · 📞 cada celular tiene su botón de llamada al lado'}
        </p>
      )}

      {/* ── F-ID2.7: TU Yape para cobrar — se guarda 1 vez, sale en TODOS los mensajes ── */}
      {!config.yape.numero.trim() || editarMiYape ? (
        <div className="mt-2 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3" data-testid="tarjeta-mi-yape">
          <p className="text-xs font-bold text-violet-300">💜 Tu Yape para cobrar</p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
            Guardalo <b className="text-violet-200">una sola vez</b> y sale solo en el mensaje de cobro de{' '}
            <b className="text-violet-200">todos</b> tus clientes — no lo volvés a escribir.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              value={miYapeNum}
              onChange={e => setMiYapeNum(e.target.value)}
              inputMode="tel"
              placeholder="Tu número (ej. 987 654 321)"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-400"
              data-testid="input-mi-yape-num"
            />
            <input
              value={miYapeTitular}
              onChange={e => setMiYapeTitular(e.target.value)}
              placeholder="Tu nombre (opcional)"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-400"
              data-testid="input-mi-yape-titular"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={guardarMiYape}
              className="flex-1 rounded-xl bg-violet-500 py-2.5 text-xs font-black text-white transition-all active:scale-[0.98]"
              data-testid="boton-guardar-mi-yape"
            >
              Guardar mi Yape 💜
            </button>
            {editarMiYape && (
              <button
                onClick={() => setEditarMiYape(false)}
                className="rounded-xl bg-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300"
                data-testid="boton-cancelar-mi-yape"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2"
          data-testid="mi-yape-guardado"
        >
          <p className="min-w-0 text-[11px] leading-snug text-violet-200">
            💜 Tu Yape: <b className="text-violet-100">{config.yape.numero}</b>
            {config.yape.titular.trim() && <> ({config.yape.titular.trim()})</>} — va en <b>todos</b> los cobros
          </p>
          <button
            onClick={abrirEditorMiYape}
            className="shrink-0 text-[10px] font-bold text-violet-300 underline decoration-dotted"
            data-testid="boton-cambiar-mi-yape"
          >
            cambiar
          </button>
        </div>
      )}

      {/* ── F-ID2.7: vista previa del mensaje — SIEMPRE visible, en vivo ── */}
      <div className="mt-2 rounded-xl border border-[#25D366]/25 bg-[#25D366]/5 p-3" data-testid="preview-mensaje">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/80">
          💬 Así le va a llegar a tu cliente
        </p>
        <div className="mt-1.5 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl rounded-tl-sm bg-[#005C4B] px-3 py-2 text-[12px] leading-relaxed text-white">
          <TextoWhatsApp texto={armarMensaje()} />
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Se arma solo con los datos del viaje — el botón Cobrar lo manda tal cual al WhatsApp del cliente
        </p>
      </div>

      {/* F-ID2.6: yape del PEDIDO — con el que pagó el CLIENTE (distinto del tuyo) */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          value={yapeNombre}
          onChange={e => setYapeNombre(e.target.value)}
          placeholder="💜 Yape del pedido: nombre"
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400"
          data-testid="input-yape-nombre"
        />
        <input
          value={yapeNumero}
          onChange={e => setYapeNumero(e.target.value)}
          inputMode="numeric"
          placeholder="💜 Yape del pedido: número"
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400"
          data-testid="input-yape-numero"
        />
      </div>
      {(yapeNombre.trim() || yapeNumero.trim()) && (
        <p className="mt-1 text-[10px] text-slate-500">
          💜 Con este yape PAGÓ tu cliente (se guarda con el viaje) — tu Yape para cobrar va más arriba, guardado
        </p>
      )}

      {/* Notas / referencia (se llena solo con el escaneo) */}
      <textarea
        value={notas}
        onChange={e => setNotas(e.target.value)}
        rows={2}
        placeholder="Referencia / notas (se llena con el escaneo)"
        className="mt-2 w-full resize-none rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400"
      />

      {/* Cálculo en vivo */}
      {puedeEnviar && (
        <div className="dt-anim-pop mt-3 rounded-xl bg-slate-900/80 p-3 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>La plataforma se queda ({comisionPct || 0}%)</span>
            <span className="text-red-400">−{fmtSoles(comision)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-700/60 pt-1.5 text-base font-bold">
            <span className="text-slate-200">TE QUEDA NETO</span>
            <span className="text-emerald-400">{fmtSoles(neto)}</span>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <button
        onClick={enviar}
        disabled={!puedeEnviar}
        className={`mt-3 w-full rounded-xl py-3 text-sm font-bold transition-all ${
          puedeEnviar
            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-[0.98]'
            : 'bg-slate-700 text-slate-500'
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <Check size={17} /> Aceptar viaje
        </span>
      </button>

      {/* F-ID3.2 → FASE E: modal de ubicación — el MISMO para el punto
          A (recojo) y el B (entrega), con buscador por dirección,
          copiar y GPS, igual que el panel de trabajo. Si elegiste una
          dirección del buscador y el campo está vacío, se llena solo. */}
      {ubicarAbierto && (
        <UbicarModal
          coordenadasIniciales={coordenadas}
          punto="B"
          direccionRegistrada={direccion}
          distrito={zona}
          onGuardar={(coords, nombre) => {
            setCoordenadas(coords);
            if (nombre && !direccion.trim()) setDireccion(nombre);
            setUbicarAbierto(false);
            vibrar(40);
          }}
          onCerrar={() => setUbicarAbierto(false)}
        />
      )}

      {/* FASE E: modal de ubicación del RECOJO (A) */}
      {ubicarAAbierto && (
        <UbicarModal
          coordenadasIniciales={coordenadasA}
          punto="A"
          direccionRegistrada={dirA}
          distrito={zona}
          onGuardar={(coords, nombre) => {
            setCoordenadasA(coords);
            if (nombre && !dirA.trim()) setDirA(nombre);
            setUbicarAAbierto(false);
            vibrar(40);
          }}
          onCerrar={() => setUbicarAAbierto(false)}
        />
      )}

      {/* F-ID3.3: mini-selector Waze / Google Maps (preferencia 'preguntar') */}
      {navAbierto && (
        <NavegarMenu
          destino={coordenadas ?? { direccion: direccion.trim() }}
          etiqueta={direccion.trim()}
          onCerrar={() => setNavAbierto(false)}
        />
      )}

      {/* FASE C: mini-selector para el RECOJO (A) */}
      {navObjetivo && (
        <NavegarMenu
          destino={navObjetivo.destino}
          etiqueta={navObjetivo.etiqueta}
          onCerrar={() => setNavObjetivo(null)}
        />
      )}
    </div>
  );
}

// F-ID2.7: pinta el mensaje tal como lo muestra WhatsApp dentro del
// chat — *texto* se ve en negrita (la vista previa manda los asteriscos
// tal cual y WhatsApp los convierte en negrita del otro lado)
function TextoWhatsApp({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*)/g);
  return (
    <>
      {partes.map((p, i) =>
        p.length > 2 && p.startsWith('*') && p.endsWith('*') ? (
          <b key={i}>{p.slice(1, -1)}</b>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
