// ═══════════════════════════════════════════════════════════════
// 🩷 FASE BB: Chicos de Venta — contacto + MENSAJE EDITABLE +
//    BIBLIOTECA DE GUARDADOS propia
// ═══════════════════════════════════════════════════════════════
// Pedido de Rudy: "en la sección trabajo, chicos de venta, poder
// editar un mensaje — porque no tiene mensaje. Por ejemplo un
// cliente me pregunta por algún reclamo o alguna devolución, yo le
// envío el número... que tenga su propia biblioteca de guardados
// para cualquier cosita: devolución, reclamo, pedir otra cosa".
//
// Antes: 3 botones que mandaban SOLO la tarjeta de contacto, con
// un mensaje quemado en el bot (que ni siquiera llegaba — el bot
// v3.9 no tenía handler; se arregla en el bot v3.10-VENTAS).
//
// Ahora:
//   • el MENSAJE es editable acá mismo, con etiquetas
//     {cliente} {ventas_nombre} {ventas_celular} {empresa};
//   • BIBLIOTECA propia: presets de fábrica 💜📦❓ + los que Rudy
//     guarde (viven en config_empresa → aparecen en todos sus
//     celulares);
//   • cada chico muestra SU número al lado (si no lo cargó en
//     ⚙️ Configuración → Equipo de ventas, se ve ⚠️ y no se manda
//     — nada de clics que mueren en silencio);
//   • al elegir la persona, el bot manda la TARJETA de contacto
//     + el mensaje (todo viaja pegado en la acción).
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Save, Trash2, X } from 'lucide-react';
import {
  MensajeVenta,
  PersonaVenta,
  PRESETS_VENTA,
  MENSAJE_VENTA_DEF,
  resolverMensajeVenta,
  idMensajeVenta,
} from '../utils/ventaMensajes';

interface Props {
  /** nombre del cliente (para la etiqueta {cliente} y la vista previa) */
  clienteNombre: string;
  /** config_empresa.ventas — el equipo con sus números */
  ventas?: {
    fabiana?: { nombre: string; celular: string };
    karla?: { nombre: string; celular: string };
    tocho?: { nombre: string; celular: string };
  };
  /** la biblioteca guardada (ya saneada) */
  mensajesGuardados: MensajeVenta[];
  /** nombre de la empresa (para {empresa}) */
  empresa: string;
  /** persiste la biblioteca en config_empresa */
  onGuardarMensajes: (mensajes: MensajeVenta[]) => Promise<void> | void;
  /** manda la acción al bot — recibe la persona y el mensaje RESUELTO */
  onEnviar: (persona: PersonaVenta, mensaje: string) => Promise<void> | void;
  onCerrar: () => void;
  onToast?: (titulo: string, msg: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
}

const PERSONAS: { clave: PersonaVenta['clave']; etiqueta: string; emoji: string }[] = [
  { clave: 'fabiana', etiqueta: 'Ejecutiva de ventas', emoji: '👩' },
  { clave: 'karla', etiqueta: 'Ejecutiva de ventas', emoji: '👩' },
  { clave: 'tocho', etiqueta: 'Ejecutivo de ventas', emoji: '👨' },
];

export default function VentaModal({
  clienteNombre,
  ventas,
  mensajesGuardados,
  empresa,
  onGuardarMensajes,
  onEnviar,
  onCerrar,
  onToast,
}: Props) {
  // el mensaje actual (empieza con el de siempre del bot)
  const [mensaje, setMensaje] = useState(MENSAJE_VENTA_DEF);
  // qué mensaje de la biblioteca está cargado (para el resaltado)
  const [activoId, setActivoId] = useState<string>(PRESETS_VENTA[0].id);
  // guardar en la biblioteca: input de nombre + guardando
  const [guardando, setGuardando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');

  const equipo = ventas ?? {};
  const personas: PersonaVenta[] = PERSONAS.map(p => ({
    clave: p.clave,
    nombre: (equipo[p.clave]?.nombre ?? '').trim() || p.clave.charAt(0).toUpperCase() + p.clave.slice(1),
    celular: (equipo[p.clave]?.celular ?? '').replace(/\D/g, ''),
  }));

  /** vista previa con los datos de la PRIMERA persona con número
   *  (las etiquetas {ventas_*} se resuelven al mandar con la
   *  persona elegida — la preview es orientativa) */
  const previewDe = personas.find(p => p.celular) ?? personas[0];
  const preview = resolverMensajeVenta(mensaje, {
    cliente: clienteNombre,
    ventas_nombre: previewDe?.nombre ?? '',
    ventas_celular: previewDe?.celular ?? '',
    empresa,
  });

  function cargarMensaje(m: MensajeVenta) {
    setMensaje(m.texto);
    setActivoId(m.id);
  }

  async function guardarEnBiblioteca() {
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      onToast?.('🩷 Biblioteca', 'Ponle un nombre al mensaje (ej: "Devolución")', 'warning');
      return;
    }
    if (!mensaje.trim()) {
      onToast?.('🩷 Biblioteca', 'El mensaje está vacío', 'warning');
      return;
    }
    const nuevo: MensajeVenta = { id: idMensajeVenta(), nombre: nombre.slice(0, 40), texto: mensaje.slice(0, 1500) };
    try {
      await onGuardarMensajes([...mensajesGuardados, nuevo]);
      setActivoId(nuevo.id);
      setNuevoNombre('');
      setGuardando(false);
      onToast?.('🩷 Biblioteca', `Guardado "${nuevo.nombre}" — lo vas a ver siempre acá`, 'success');
    } catch {
      onToast?.('🩷 Biblioteca', 'No se pudo guardar — probá de nuevo', 'error');
    }
  }

  async function borrarDeBiblioteca(id: string) {
    try {
      await onGuardarMensajes(mensajesGuardados.filter(m => m.id !== id));
      if (activoId === id) setActivoId('');
      onToast?.('🩷 Biblioteca', 'Mensaje borrado', 'info');
    } catch {
      onToast?.('🩷 Biblioteca', 'No se pudo borrar — probá de nuevo', 'error');
    }
  }

  async function elegirPersona(p: PersonaVenta, etiqueta: string) {
    if (!p.celular) {
      onToast?.(
        '⚠️ Falta el número',
        `${p.nombre} no tiene celular cargado — ponlo en ⚙️ Configuración → Equipo de ventas`,
        'warning',
      );
      return;
    }
    if (!mensaje.trim()) {
      onToast?.('⚠️ Mensaje vacío', 'Escribí el mensaje que acompaña al contacto', 'warning');
      return;
    }
    // las etiquetas se resuelven con LA persona elegida (acá sí
    // sabemos quién va) — el texto viaja ya resuelto, pegado en la
    // acción (lección AM/AN: lo que viaja en la acción llega).
    const texto = resolverMensajeVenta(mensaje, {
      cliente: clienteNombre,
      ventas_nombre: p.nombre,
      ventas_celular: p.celular,
      empresa,
    });
    onToast?.('🩷 Venta', `Enviando el contacto de ${p.nombre} + tu mensaje…`, 'info');
    await onEnviar(p, texto);
    onCerrar();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onCerrar}
      data-testid="venta-modal"
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-sm max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-white">🩷 Chicos de Venta</h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-white" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          El bot le envía al cliente la <b>tarjeta de contacto</b> + <b>este mensaje</b> (editable)
        </p>

        {/* ── Biblioteca: presets de fábrica + guardados ── */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-pink-400/90 mb-1.5">
          📚 Biblioteca
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2" data-testid="venta-biblioteca">
          {PRESETS_VENTA.map(m => (
            <button
              key={m.id}
              onClick={() => cargarMensaje(m)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95 ${
                activoId === m.id
                  ? 'border-pink-400 bg-pink-500/30 text-pink-200'
                  : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              data-testid={`venta-preset-${m.id}`}
              title="Mensaje de fábrica (siempre disponible)"
            >
              {m.nombre}
            </button>
          ))}
          {mensajesGuardados.map(m => (
            <span
              key={m.id}
              className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all ${
                activoId === m.id
                  ? 'border-pink-400 bg-pink-500/30 text-pink-200'
                  : 'border-slate-500 bg-slate-700/60 text-slate-200'
              }`}
              data-testid={`venta-guardado-${m.id}`}
            >
              <button onClick={() => cargarMensaje(m)} className="max-w-[120px] truncate" title={m.texto}>
                💾 {m.nombre}
              </button>
              <button
                onClick={() => borrarDeBiblioteca(m.id)}
                className="text-slate-400 hover:text-red-400"
                aria-label={`Borrar ${m.nombre}`}
                data-testid={`venta-borrar-${m.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        {/* ── El mensaje editable ── */}
        <textarea
          value={mensaje}
          onChange={e => {
            setMensaje(e.target.value);
            setActivoId(''); // lo tocaste → ya no es ninguno de la biblioteca
          }}
          rows={5}
          className="w-full resize-none rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-xs leading-relaxed text-slate-100 placeholder-slate-500 outline-none focus:border-pink-400"
          data-testid="venta-input-mensaje"
        />
        <p className="mt-1 text-[9px] leading-snug text-slate-500">
          Etiquetas: <code className="text-pink-300">{'{cliente}'}</code>{' '}
          <code className="text-pink-300">{'{ventas_nombre}'}</code>{' '}
          <code className="text-pink-300">{'{ventas_celular}'}</code>{' '}
          <code className="text-pink-300">{'{empresa}'}</code> — se cambian solas al enviar
        </p>

        {/* Vista previa (como le llega) */}
        <div className="mt-2 rounded-xl bg-[#005C4B] px-3 py-2 text-[11px] leading-relaxed text-white siempre-blanco" data-testid="venta-preview">
          <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-200/80 mb-1">
            👀 Así le va a llegar
          </p>
          <p className="whitespace-pre-wrap">{preview}</p>
        </div>

        {/* Guardar en la biblioteca */}
        {guardando ? (
          <div className="mt-2 flex gap-1.5">
            <input
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              placeholder="Nombre (ej: Devolución)"
              className="flex-1 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 border border-slate-600 focus:border-pink-400 outline-none"
              data-testid="venta-input-nombre"
              autoFocus
            />
            <button
              onClick={guardarEnBiblioteca}
              className="px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-bold"
              data-testid="venta-guardar-ok"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setGuardando(false); setNuevoNombre(''); }}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-bold"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setGuardando(true)}
            className="mt-2 w-full rounded-xl border border-pink-500/30 bg-pink-500/10 py-2 text-[11px] font-bold text-pink-300 transition-all hover:bg-pink-500/20 active:scale-95"
            data-testid="venta-abrir-guardar"
          >
            💾 Guardar en la biblioteca (queda para siempre)
          </button>
        )}

        {/* ── Elegí quién atiende (con SU número a la vista) ── */}
        <p className="mt-3 mb-1.5 text-[10px] font-bold uppercase tracking-wide text-pink-400/90">
          👇 Elegí quién atiende
        </p>
        <div className="space-y-2">
          {personas.map((p, i) => {
            const meta = PERSONAS[i];
            const tieneNum = p.celular.length >= 9;
            const numBonito = p.celular.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
            return (
              <button
                key={p.clave}
                onClick={() => elegirPersona(p, meta.etiqueta)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-95 ${
                  tieneNum
                    ? 'bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/30 text-pink-400'
                    : 'bg-slate-800/60 border-slate-600/50 text-slate-400'
                }`}
                data-testid={`venta-persona-${p.clave}`}
              >
                <span className="text-lg">{meta.emoji}</span>
                <div className="text-left flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">{p.nombre}</span>
                    {tieneNum ? (
                      <span className="text-[10px] text-emerald-400 font-mono">✓ {numBonito}</span>
                    ) : (
                      <span className="text-[9px] text-amber-400">⚠️ sin número</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {meta.etiqueta}
                    {!tieneNum && ' — configuralo en ⚙️ Configuración'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-[9px] leading-snug text-slate-500">
          El número de cada uno se carga en <b>⚙️ Configuración → Equipo de ventas</b> — si un chico
          está ⚠️ sin número, el botón no manda nada (así nada muere en silencio).
        </p>
      </div>
    </div>
  );
}
