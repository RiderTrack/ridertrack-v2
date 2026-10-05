// ═══════════════════════════════════════════════════════════
// 📷 FASE H: FotoEntregaModal — FOTO DE ENTREGA de un viaje
// inDrive (pedido de Rudy: "a veces los clientes me piden foto de
// la entrega para comprobar que estás entregando").
//
// Cómo funciona:
//   📷 Tomar foto (cámara nativa del plugin @capacitor/camera)
//   🖼️ De la galería (por si ya le sacaste)
//   → ves la foto GRANDE + el MENSAJE que va con ella
//     (editable al vuelo; el original se configura en
//     Ajustes → 📷 Foto de entrega, con etiquetas {cliente}…)
//   → "Mandar por WhatsApp": hoja de compartir NATIVA con la FOTO
//     + el mensaje juntos (elegís WhatsApp → el chat → listo)
//   → "Solo guardar": queda como evidencia EN el viaje
//
// SIEMPRE queda la evidencia comprimida en el viaje (foto +
// hora) — y la foto original se guarda en la GALERÍA del
// teléfono (saveToGallery). La evidencia NO viaja a la nube
// (pesa), queda en el teléfono que la sacó (como la ruta GPS).
//
// Si el share nativo no está (web / falla), cae al plan B:
// abre el chat de WhatsApp con el mensaje listo y te avisa que
// la foto está en la galería para adjuntarla 📎.
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { Camera as CamIcon, CheckCircle2, Image as ImageIcon, Loader2, Send, X } from 'lucide-react';
import type { ConfigDT, Viaje } from '../types';
import { armarMensajeFoto } from '../utils';
import { vibrar } from '../utils';

interface Props {
  viaje: Viaje;
  config: ConfigDT;
  onCerrar: () => void;
  /** guarda la evidencia comprimida en el viaje (dataURL + hora) */
  onGuardar: (dataUrl: string) => void;
  onToast: (msg: string) => void;
}

/** Comprime una imagen desde su URL (webPath/blob/dataURL) a un
 *  dataURL liviano para guardar como evidencia en el viaje */
function comprimirDesdeSrc(src: string, MAX = 720, calidad = 0.62): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('No se pudo leer la foto'));
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas no disponible'));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', calidad));
    };
    img.src = src;
  });
}

/** El teléfono de la entrega (a quién se le manda la foto si
 *  hace falta el plan B del wa.me): el que RECIBE, o el que ENVÍA */
function telDelViaje(v: Viaje): string {
  return (v.celularRecibe ?? '').trim() || (v.celularEnvia ?? '').trim() || v.celular.trim();
}

export default function FotoEntregaModal({ viaje, config, onCerrar, onGuardar, onToast }: Props) {
  // el mensaje arranca RESUELTO con los datos de ESTE viaje (las
  // etiquetas {cliente}… ya reemplazadas) — se puede retocar acá
  // mismo antes de mandar
  const [mensaje, setMensaje] = useState(() => armarMensajeFoto(viaje, config));

  // la foto: webPath (para el <img>) + path de archivo (para el
  // share nativo). Si el viaje ya tenía evidencia, se ve al abrir.
  const [fotoSrc, setFotoSrc] = useState<string | null>(viaje.fotoEntrega ?? null);
  const [fotoPath, setFotoPath] = useState<string | null>(null); // solo la recién sacada
  const [sacando, setSacando] = useState(false);
  const [mandando, setMandando] = useState(false);
  const [guardada, setGuardada] = useState(Boolean(viaje.fotoEntrega));
  const [exito, setExito] = useState(false);

  // 📷 saca la foto con el plugin nativo (cámara o galería)
  async function sacar(source: 'camera' | 'photos') {
    setSacando(true);
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const foto = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        quality: 82,
        width: 1280,
        correctOrientation: true,
        // la cámara guarda SIEMPRE en la galería del teléfono →
        // la foto queda de respaldo aunque no la mandes
        saveToGallery: source === 'camera',
      });
      if (foto.webPath) setFotoSrc(foto.webPath);
      setFotoPath(foto.path ?? null);
      setGuardada(false);
      vibrar(60);
    } catch {
      // canceló el usuario o no hay permiso — no pasa nada
    } finally {
      setSacando(false);
    }
  }

  /** Guarda la evidencia (comprimida) en el viaje */
  async function guardarEvidencia(): Promise<boolean> {
    if (!fotoSrc) return false;
    if (guardada) return true; // ya estaba (la re-abrió para verla)
    try {
      const dataUrl = await comprimirDesdeSrc(fotoSrc);
      onGuardar(dataUrl);
      setGuardada(true);
      return true;
    } catch {
      onToast('No pude guardar la evidencia 😕 — igual podés mandarla');
      return false; // no frena el envío
    }
  }

  /** Manda la foto + mensaje. Plan A: hoja de compartir nativa
   *  (foto y texto JUNTOS — elegís WhatsApp y el chat). Plan B:
   *  wa.me con el mensaje y la foto queda en la galería. */
  async function mandar() {
    if (!fotoSrc || mandando) return;
    setMandando(true);
    try {
      // la evidencia queda SIEMPRE en el viaje (con su hora)
      await guardarEvidencia();

      let pathParaShare = fotoPath;
      // evidencia guardada (dataURL) o web sin path → se escribe a
      // un archivo del cache para que el share la pueda mandar
      if (!pathParaShare && fotoSrc.startsWith('data:')) {
        try {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const r = await Filesystem.writeFile({
            path: `foto-entrega-${viaje.id}.jpg`,
            data: fotoSrc.split(',')[1] ?? '',
            directory: Directory.Cache,
          });
          pathParaShare = r.uri;
        } catch {
          /* sigue al plan B */
        }
      }

      if (pathParaShare) {
        try {
          const { Share } = await import('@capacitor/share');
          await Share.share({
            title: 'Foto de la entrega',
            text: mensaje,
            files: [pathParaShare],
            dialogTitle: 'Mandar la foto',
          });
          vibrar(120);
          setExito(true);
          onToast('✓ Elegí WhatsApp y el chat del cliente 📷');
          setTimeout(onCerrar, 900);
          return;
        } catch {
          /* canceló o no soporta archivos → plan B */
        }
      }

      // PLAN B: chat abierto con el mensaje listo; la foto se
      // adjunta a mano (está en la galería si la sacaste con 📷)
      const tel = telDelViaje(viaje);
      if (tel) {
        const num = tel.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${num.length === 9 ? `51${num}` : num}?text=${encodeURIComponent(mensaje)}`, '_blank');
        onToast('📎 La foto está en tu galería — adjuntala en el chat');
      } else {
        onToast('📎 La foto está en tu galería (el viaje no tiene celular cargado)');
      }
      vibrar(120);
      setExito(true);
      setTimeout(onCerrar, 900);
    } finally {
      setMandando(false);
    }
  }

  // Enter no debe mandar el formulario accidentalmente etc. —
  // el textarea edita libre; nada más que hacer acá.
  useEffect(() => {
    // si el viaje cambia de evidencia por el sync mientras está
    // abierto (raro), no pisamos la foto que el usuario está viendo
    return () => undefined;
  }, []);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={() => !mandando && onCerrar()}
      data-testid="modal-foto"
    >
      <div
        className="dt-anim-pop max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* encabezado */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-black text-slate-100">
              <CamIcon size={16} className="text-emerald-300" /> Foto de la entrega
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-400" title={`${viaje.cliente} ${viaje.direccion}`}>
              {viaje.cliente || 'cliente'} · {viaje.direccion || viaje.zona || '—'}
            </p>
          </div>
          <button
            onClick={() => !mandando && onCerrar()}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
            data-testid="foto-cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* la foto: preview, o los dos botones para sacarla */}
        {fotoSrc ? (
          <div className="relative mt-3">
            <img
              src={fotoSrc}
              alt="Foto de la entrega"
              className="max-h-64 w-full rounded-xl border border-slate-700 object-contain"
              data-testid="foto-preview"
            />
            {exito && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-emerald-500/20">
                <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-900/90 p-3">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  <span className="text-sm font-bold text-white">¡Lista!</span>
                </div>
              </div>
            )}
            {guardada && !exito && (
              <span
                className="absolute left-2 top-2 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[9px] font-black uppercase text-slate-950"
                title={`Evidencia guardada a las ${viaje.fotoEntregaHora ?? ''}`}
              >
                ✓ evidencia {viaje.fotoEntregaHora}
              </span>
            )}
            {/* sacar otra / cambiar */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => sacar('camera')}
                disabled={sacando || mandando}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2 text-[11px] font-black text-emerald-300 transition-all active:scale-[0.97] hover:bg-emerald-500/20 disabled:opacity-50"
                data-testid="foto-otra"
              >
                <CamIcon size={14} /> Otra foto
              </button>
              <button
                onClick={() => sacar('photos')}
                disabled={sacando || mandando}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 py-2 text-[11px] font-black text-sky-300 transition-all active:scale-[0.97] hover:bg-sky-500/20 disabled:opacity-50"
                data-testid="foto-galeria"
              >
                <ImageIcon size={14} /> De la galería
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => sacar('camera')}
              disabled={sacando || mandando}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 p-4 text-emerald-400 transition-all active:scale-95 hover:bg-emerald-500/10 disabled:opacity-50"
              data-testid="foto-tomar"
            >
              {sacando ? <Loader2 size={24} className="animate-spin" /> : <CamIcon size={24} />}
              <span className="text-[11px] font-bold">📷 Tomar foto</span>
              <span className="text-[9px] text-slate-500">abre la cámara</span>
            </button>
            <button
              onClick={() => sacar('photos')}
              disabled={sacando || mandando}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-sky-500/30 bg-sky-500/5 p-4 text-sky-400 transition-all active:scale-95 hover:bg-sky-500/10 disabled:opacity-50"
              data-testid="foto-subir"
            >
              <ImageIcon size={24} />
              <span className="text-[11px] font-bold">🖼️ De la galería</span>
              <span className="text-[9px] text-slate-500">si ya le sacaste</span>
            </button>
          </div>
        )}

        {/* el mensaje que va CON la foto — editable al vuelo; el
            original se cambia en Ajustes → 📷 Foto de entrega */}
        <div className="mt-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            💬 El mensaje que va con la foto
          </p>
          <textarea
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-xs leading-relaxed text-slate-200 outline-none focus:border-emerald-400"
            data-testid="foto-mensaje"
          />
          <p className="mt-1 text-[10px] text-slate-500">
            Editalo acá para esta foto, o cambiá el original en <b className="text-slate-400">Ajustes → 📷 Foto de entrega</b>
          </p>
        </div>

        {/* botones de acción */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => !mandando && onCerrar()}
            disabled={mandando}
            className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-400 transition-all hover:bg-slate-700 disabled:opacity-50"
          >
            Cancelar
          </button>
          {fotoSrc ? (
            <>
              <button
                onClick={guardarEvidencia}
                disabled={mandando || guardada}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700 active:scale-95 disabled:opacity-50"
                title="Guarda la foto como evidencia de ESTE viaje (sin mandarla)"
                data-testid="foto-solo-guardar"
              >
                {guardada ? <CheckCircle2 size={14} className="text-emerald-400" /> : null}
                {guardada ? 'Guardada' : 'Solo guardar'}
              </button>
              <button
                onClick={mandar}
                disabled={mandando}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                data-testid="foto-mandar"
              >
                {mandando ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Mandando…
                  </>
                ) : (
                  <>
                    <Send size={14} /> Por WhatsApp
                  </>
                )}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
