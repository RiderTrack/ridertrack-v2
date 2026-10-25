// ═══════════════════════════════════════════════════════════
// 🤖 CENTRO DEL BOT — RiderTrack V2 (Fase 3.2)
// Mudanza de ClienteTrack v1 → Plantillas + Automatizaciones
//
//   💬 Plantillas      → editor de plantillas de WhatsApp con
//                        vista previa, variables, bloques y
//                        sincronización con el bot (puente).
//   🖼️ Imágenes bot    → FASE 3.55: subir/cambiar/restablecer la
//                        imagen de cada mensaje con foto que manda
//                        el bot (disparo, entrega, grupo MATE…).
//   ⚙️ Automatizaciones → interruptor maestro del bot, IA,
//                        horario, silenciados, palabras de enojo
//                        y el registro de lo que hizo solo hoy.
//
// La app SOLO escribe en Firestore; el robot de Baileys es el
// único que toca WhatsApp (igual que la v1). Cero riesgo extra.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Copy,
  Trash2,
  Save,
  Eye,
  RefreshCw,
  FlaskConical,
  Bot,
  MessageSquareText,
  SlidersHorizontal,
  Brain,
  Clock,
  VolumeX,
  Angry,
  History,
  Plus,
  Loader2,
  Zap,
  X,
  ImagePlus,
  RotateCcw,
  CheckCircle2,
  WifiOff,
  Shield,
  Play,
  Power,
  BatteryMedium,
  ScrollText,
  Archive,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  TIPOS_IMAGEN_BOT,
  ImagenBot,
  subirImagenBot,
  escucharImagenesBot,
  restablecerImagenBot,
} from '../services/imagenesBot';
import {
  CATEGORIAS_PLANTILLA,
  CATEGORIAS_SELECT,
  VARIABLES_PLANTILLA,
  VARIABLES_RUTA,
  BLOQUES_CONDICIONALES,
  ETIQUETAS_REGISTRO,
  CONTROL_BOT_DEFAULT,
  PlantillaMensaje,
  ControlBot,
  SilenciadoBot,
  RegistroBotItem,
  PuenteEstado,
  TELEFONO_PRUEBA_DEFAULT,
  escucharControlBot,
  guardarControlBot,
  escucharSilenciados,
  reactivarSilenciado,
  escucharRegistroHoy,
  escucharPlantillas,
  crearPlantillasPredefinidas,
  guardarPlantilla,
  duplicarPlantilla,
  eliminarPlantilla,
  sincronizarBotUnaVez,
  activarModoBucleBot,
  detenerModoBucleBot,
  escucharPuente,
  formatearWhatsAppHTML,
  aplicarVariablesPreview,
  linkProbarPlantilla,
  celBonito,
} from '../utils/botControl';
import {
  EstadoGuardian,
  ControlTermux,
  TermuxLogs,
  TermuxRespaldo,
  subscribeEstadoGuardian,
  subscribeControlTermux,
  subscribeTermuxLogs,
  subscribeTermuxRespaldo,
  enviarComandoTermux,
  haceRato,
  GUARDIAN_VIVO_MS,
} from '../services/guardianTermux';
import { subscribeEstadoBot, EstadoBot } from '../services/firestore';

interface BotControlViewProps {
  vistaInicial?: 'plantillas' | 'imagenes' | 'automatizaciones' | 'termux';
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

type ToastFn = NonNullable<BotControlViewProps['onShowToast']>;

// ─────────────────────────────────────────────────────────────
// SUBCOMPONENTES COMPARTIDOS
// ─────────────────────────────────────────────────────────────

/** Interruptor estilo switch (como la v1) */
const Switch: React.FC<{ on: boolean; onChange: () => void; color?: string }> = ({ on, onChange, color = 'bg-emerald-500' }) => (
  <button
    onClick={onChange}
    className={`w-12 h-7 rounded-full relative transition-colors flex-shrink-0 border ${
      on ? `${color} border-transparent` : 'bg-slate-600/70 border-slate-500/50'
    }`}
    aria-pressed={on}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
        on ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

/** Tarjeta contenedora estándar */
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 sm:p-5 ${className}`}>{children}</div>
);

/** Texto con formato WhatsApp renderizado (seguro: escapa HTML) */
const TextoWhatsApp: React.FC<{ texto: string; className?: string }> = ({ texto, className = '' }) => (
  <div
    className={`wa-preview ${className}`}
    dangerouslySetInnerHTML={{ __html: formatearWhatsAppHTML(texto) }}
  />
);

// ─────────────────────────────────────────────────────────────
// TAB 1 · PLANTILLAS
// ─────────────────────────────────────────────────────────────

interface EditorState {
  abierto: boolean;
  id: string | null;
  nombre: string;
  categoria: string;
  clave: string;
  mensaje: string;
}

const EDITOR_VACIO: EditorState = {
  abierto: false,
  id: null,
  nombre: '',
  categoria: 'personalizado',
  clave: '',
  mensaje: '',
};

const PlantillasTab: React.FC<{ onShowToast: ToastFn }> = ({ onShowToast }) => {
  const [plantillas, setPlantillas] = useState<PlantillaMensaje[]>([]);
  // 🩺 FASE AK (recuperada): estado honesto — antes el vacío mudo
  // decía «Sin plantillas» aunque fuera la red trabada
  const [estadoPlantillas, setEstadoPlantillas] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [noncePlantillas, setNoncePlantillas] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCat, setFiltroCat] = useState('todas');
  const [editor, setEditor] = useState<EditorState>(EDITOR_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [telPrueba, setTelPrueba] = useState(TELEFONO_PRUEBA_DEFAULT);

  // Puente de sincronización
  const [puente, setPuente] = useState<PuenteEstado>({ accion: '', expiraEn: null, ts: null });
  const [ahora, setAhora] = useState(Date.now());
  const [flashOnce, setFlashOnce] = useState(0);
  const creoPredefinidas = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Suscripciones ──
  useEffect(() => {
    let un1: () => void = () => undefined;
    un1 = escucharPlantillas(
      (lista, info) => {
        setPlantillas(lista);
        setEstadoPlantillas('listo');
        // v1: si la colección está vacía → crear las 6 base (el bot las conoce)
        // 🌱 FASE AL: SOLO cuando el SERVIDOR la confirma vacía — el primer
        // snapshot de la caché fría llega «vacío» aunque tengas 24 plantillas
        // reales, y sembrar ahí clonaba las base de fábrica (bug del 21-oct).
        if (lista.length === 0 && info?.fromCache !== true && !creoPredefinidas.current) {
          creoPredefinidas.current = true;
          crearPlantillasPredefinidas()
            .then((n) => {
              if (n > 0) onShowToast('Plantillas base creadas', `Se crearon ${n} plantillas iniciales`, 'info');
            })
            .catch((e) => onShowToast('Plantillas base', e.message, 'warning'));
        }
      },
      (e) => {
        setEstadoPlantillas('error');
        onShowToast('Plantillas', e.message, 'warning');
      }
    );
    const un2 = escucharPuente(
      (p) => setPuente(p),
      () => undefined
    );
    return () => {
      un1();
      un2();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noncePlantillas]);

  // ── Reloj del modo bucle (countdown) ──
  const bucleActivo = puente.accion === 'loop' && !!puente.expiraEn && puente.expiraEn > ahora;
  useEffect(() => {
    if (!bucleActivo) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [bucleActivo]);

  const segRestantes = bucleActivo && puente.expiraEn ? Math.max(0, Math.round((puente.expiraEn - ahora) / 1000)) : 0;
  const cuentaBucle = `${Math.floor(segRestantes / 60)}:${String(segRestantes % 60).padStart(2, '0')}`;

  // ── Acciones del puente ──
  const handleSincronizar = async () => {
    try {
      await sincronizarBotUnaVez();
      setFlashOnce(Date.now());
      onShowToast('Sincronizando con el bot…', 'El bot releerá las plantillas en segundos', 'info');
    } catch (e: any) {
      onShowToast('No se pudo sincronizar', e.message, 'error');
    }
  };

  const handleBucle = async () => {
    try {
      if (bucleActivo) {
        await detenerModoBucleBot();
        onShowToast('Modo bucle detenido', undefined, 'info');
        return;
      }
      const ok = window.confirm(
        '⚠️ MODO BUCLE\n\nEsto revisa las plantillas cada 15 segundos durante 10 minutos. Consume tus lecturas rápido — úsalo SOLO si vas a editar varias plantillas seguidas.\n\nSe apaga solo a los 10 minutos.\n\n¿Activar?'
      );
      if (!ok) return;
      await activarModoBucleBot();
      setAhora(Date.now());
      onShowToast('🚨 Modo bucle activado', '10 minutos · cada 15 segundos', 'warning');
    } catch (e: any) {
      onShowToast('Modo bucle', e.message, 'error');
    }
  };

  // ── Filtros y contadores ──
  const contadores = useMemo(() => {
    const c: Record<string, number> = { todas: plantillas.length };
    for (const p of plantillas) c[p.categoria] = (c[p.categoria] || 0) + 1;
    return c;
  }, [plantillas]);

  const visibles = useMemo(() => {
    const s = busqueda.toLowerCase().trim();
    return plantillas.filter((p) => {
      if (filtroCat !== 'todas' && p.categoria !== filtroCat) return false;
      if (s && !p.nombre.toLowerCase().includes(s) && !p.mensaje.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [plantillas, busqueda, filtroCat]);

  // ── Editor ──
  const abrirNueva = () => setEditor({ ...EDITOR_VACIO, abierto: true });
  const abrirEditar = (p: PlantillaMensaje) =>
    setEditor({
      abierto: true,
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria || 'personalizado',
      clave: p.clave || '',
      mensaje: p.mensaje,
    });
  const cerrarEditor = () => setEditor((e) => ({ ...e, abierto: false }));

  const insertarVariable = (v: string) => {
    const ta = textareaRef.current;
    setEditor((e) => {
      if (!ta) return { ...e, mensaje: e.mensaje + v };
      const start = ta.selectionStart ?? e.mensaje.length;
      const end = ta.selectionEnd ?? start;
      return { ...e, mensaje: e.mensaje.substring(0, start) + v + e.mensaje.substring(end) };
    });
    setTimeout(() => {
      if (ta) {
        ta.focus();
        const pos = (ta.selectionStart ?? 0) + v.length;
        ta.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleGuardar = async () => {
    if (!editor.nombre.trim()) {
      onShowToast('Falta el nombre', 'Ponle un nombre a la plantilla', 'warning');
      return;
    }
    if (!editor.mensaje.trim()) {
      onShowToast('Falta el mensaje', 'Escribe el contenido de la plantilla', 'warning');
      return;
    }
    setGuardando(true);
    try {
      await guardarPlantilla({
        id: editor.id || undefined,
        nombre: editor.nombre.trim(),
        categoria: editor.categoria,
        mensaje: editor.mensaje.trim(),
        clave: editor.clave.trim(),
      });
      onShowToast(
        editor.id ? 'Plantilla actualizada' : 'Plantilla creada',
        editor.clave.trim() ? 'Conectada al bot — sincroniza para que la lea' : undefined,
        'success'
      );
      cerrarEditor();
    } catch (e: any) {
      onShowToast('Error al guardar', e.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const handleDuplicar = async (p: PlantillaMensaje) => {
    try {
      await duplicarPlantilla(p);
      onShowToast('Plantilla duplicada', `${p.nombre} (copia)`, 'success');
    } catch (e: any) {
      onShowToast('Error al duplicar', e.message, 'error');
    }
  };

  const handleEliminar = async (p: PlantillaMensaje) => {
    if (!window.confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
    try {
      await eliminarPlantilla(p.id);
      onShowToast('Plantilla eliminada', p.nombre, 'info');
    } catch (e: any) {
      onShowToast('Error al eliminar', e.message, 'error');
    }
  };

  const handleProbar = () => {
    window.open(linkProbarPlantilla(editor.mensaje, telPrueba), '_blank');
  };

  const hacePocoOnce = Date.now() - flashOnce < 3000;

  return (
    <div className="space-y-4">
      {/* 🩺 FASE AK: honesto mientras baja / si falla — nunca más un
          «Sin plantillas» mudo cuando la red anda trabada */}
      {estadoPlantillas === 'cargando' && (
        <Card data-testid="plantillas-cargando">
          <div className="flex items-center gap-2.5 text-xs text-slate-400 mb-3">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Bajando tus plantillas de la nube…
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        </Card>
      )}
      {estadoPlantillas === 'error' && (
        <Card data-testid="plantillas-error" className="!border-amber-500/40 !bg-amber-500/10">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-200">No pude bajar tus plantillas</p>
              <p className="text-[11px] text-amber-300/70">La señal anda floja o el bot no contesta. Tus plantillas siguen a salvo en la nube.</p>
            </div>
            <button
              data-testid="plantillas-reintentar"
              onClick={() => { setEstadoPlantillas('cargando'); setNoncePlantillas((n) => n + 1); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 transition-colors flex-shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        </Card>
      )}
      {/* ── Barra de sincronización con el bot ── */}
      <Card className="!p-3.5">
        <div className="space-y-2.5">
          {/* Estado (línea completa, sin apretujarla con los botones) */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                bucleActivo ? 'bg-amber-400 animate-pulse' : hacePocoOnce ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <span className="text-xs text-slate-300 font-medium truncate">
              {bucleActivo
                ? `🚨 Bucle activo · se apaga en ${cuentaBucle}`
                : hacePocoOnce
                ? 'Enviado al bot ✓'
                : 'Listo para sincronizar'}
            </span>
          </div>
          {/* Acciones */}
          <div className="flex gap-2">
            <button
              onClick={handleSincronizar}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sincronizar
            </button>
            <button
              onClick={handleBucle}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                bucleActivo
                  ? 'bg-red-500/15 text-red-300 border-red-500/40 hover:bg-red-500/25'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> {bucleActivo ? 'Detener bucle' : 'Modo bucle'}
            </button>
          </div>
        </div>
      </Card>

      {/* ── Buscador + botón nueva ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar plantilla…"
            className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60"
          />
        </div>
        <button
          onClick={abrirNueva}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nueva</span>
        </button>
      </div>

      {/* ── Chips de categoría con contadores ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [-ms-overflow-style:none]">
        {CATEGORIAS_PLANTILLA.map((c) => {
          const activo = filtroCat === c.id;
          const n = contadores[c.id] || 0;
          return (
            <button
              key={c.id}
              onClick={() => setFiltroCat(c.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                activo
                  ? 'bg-white text-slate-900 border-white'
                  : 'bg-slate-800/70 text-slate-400 border-slate-700/60 hover:text-slate-200'
              }`}
            >
              {c.icono} {c.label}
              {n > 0 && <span className={`ml-1 ${activo ? 'text-slate-500' : 'text-slate-500'}`}>({n})</span>}
            </button>
          );
        })}
      </div>

      {/* ── Grid de plantillas ── */}
      {visibles.length === 0 ? (
        <Card className="text-center py-12">
          <MessageSquareText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-300">Sin plantillas</p>
          <p className="text-xs text-slate-500 mt-1">Toca "Nueva" para crear una</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibles.map((p) => {
            const iconoCat =
              CATEGORIAS_PLANTILLA.find((c) => c.id === p.categoria)?.icono || '📄';
            const conectada = !!p.clave;
            const activa = p.activa !== false;
            return (
              <div
                key={p.id}
                onClick={() => abrirEditar(p)}
                className="group relative bg-slate-800/60 border border-slate-700/60 hover:border-blue-500/50 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-900/20"
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 bg-slate-700/50 px-2 py-1 rounded-md">
                    {iconoCat} {p.categoria}
                  </span>
                  {conectada &&
                    (activa ? (
                      <span className="text-[10px] font-black uppercase tracking-wide text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded-md">
                        🤖 Conectada
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 bg-slate-700/50 px-2 py-1 rounded-md">
                        Pausada
                      </span>
                    ))}
                </div>

                <h3 className="text-sm font-black text-white mb-2 pr-14 truncate">{p.nombre}</h3>

                <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 rounded-xl p-3 border border-slate-700/40 max-h-32 overflow-hidden relative">
                  <TextoWhatsApp texto={aplicarVariablesPreview(p.mensaje).substring(0, 200) + (p.mensaje.length > 200 ? '…' : '')} />
                  {p.mensaje.length > 200 && (
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-slate-900 to-transparent" />
                  )}
                </div>

                {/* Acciones */}
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleDuplicar(p);
                    }}
                    title="Duplicar"
                    className="p-1.5 rounded-lg bg-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleEliminar(p);
                    }}
                    title="Eliminar"
                    className="p-1.5 rounded-lg bg-slate-700/60 text-slate-300 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ MODAL EDITOR ══ */}
      {editor.abierto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] bg-slate-800 border border-slate-700/80 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700/80 bg-slate-900/40">
              <div className="min-w-0">
                <h3 className="font-black text-base text-white truncate">
                  {editor.id ? 'Editar plantilla' : 'Nueva plantilla'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {editor.clave.trim()
                    ? `🤖 Clave "${editor.clave.trim()}" — el bot la usará`
                    : 'Sin clave → plantilla personal (solo tú)'}
                </p>
              </div>
              <button
                onClick={cerrarEditor}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {/* Nombre + categoría */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wide text-slate-400 mb-1.5">
                    Nombre
                  </label>
                  <input
                    value={editor.nombre}
                    onChange={(e) => setEditor((s) => ({ ...s, nombre: e.target.value }))}
                    placeholder="Ej: Aviso de llegada"
                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wide text-slate-400 mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={editor.categoria}
                    onChange={(e) => setEditor((s) => ({ ...s, categoria: e.target.value }))}
                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/60"
                  >
                    {CATEGORIAS_SELECT.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clave del bot */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wide text-slate-400 mb-1.5">
                  🤖 Clave del bot (opcional)
                </label>
                <input
                  value={editor.clave}
                  onChange={(e) => setEditor((s) => ({ ...s, clave: e.target.value }))}
                  placeholder="Ej: menu_principal — déjalo vacío si es personal"
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Si pones una clave que el bot conoce, él la usará en sus respuestas.
                </p>
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wide text-slate-400 mb-1.5">
                  Mensaje
                </label>
                <textarea
                  ref={textareaRef}
                  value={editor.mensaje}
                  onChange={(e) => setEditor((s) => ({ ...s, mensaje: e.target.value }))}
                  placeholder="Escribe tu mensaje aquí… Usa *negrita*, _cursiva_ y las variables de abajo."
                  rows={6}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 resize-y min-h-28"
                />
              </div>

              {/* Variables */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1.5">
                  📦 Datos del cliente <span className="text-slate-500 font-medium normal-case">— toca para insertar</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES_PLANTILLA.map((v) => (
                    <button
                      key={v}
                      onClick={() => insertarVariable(v)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1.5">
                  🛵 Ruta en vivo
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES_RUTA.map((v) => (
                    <button
                      key={v}
                      onClick={() => insertarVariable(v)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1.5">
                  🎭 Bloques opcionales <span className="text-slate-500 font-medium normal-case">— se ocultan solos si no hay dato</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BLOQUES_CONDICIONALES.map((b) => (
                    <button
                      key={b}
                      onClick={() => insertarVariable(`{${b}}\n\n{/${b}}`)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
                    >
                      {`{${b}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vista previa estilo WhatsApp */}
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1.5">
                  <Eye className="w-3.5 h-3.5" /> Vista previa
                </div>
                <div className="rounded-xl bg-[#0b141a] border border-slate-700/50 p-3">
                  <div className="max-w-[85%] bg-[#005c4b] text-slate-100 rounded-xl rounded-tl-sm px-3 py-2 text-[13px] leading-relaxed shadow inline-block max-h-56 overflow-y-auto custom-scrollbar">
                    {editor.mensaje.trim() ? (
                      <TextoWhatsApp texto={aplicarVariablesPreview(editor.mensaje)} />
                    ) : (
                      <span className="text-slate-500 italic">Escribe algo para ver la vista previa…</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Teléfono de prueba */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wide text-slate-400 mb-1.5">
                  🧪 Número de prueba
                </label>
                <input
                  value={telPrueba}
                  onChange={(e) => setTelPrueba(e.target.value)}
                  placeholder="51 + 9 dígitos"
                  inputMode="numeric"
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 font-mono"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700/80 bg-slate-900/40 flex items-center gap-2.5">
              <button
                onClick={cerrarEditor}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-700/60 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleProbar}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition-colors"
              >
                <FlaskConical className="w-4 h-4" /> Probar
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-60"
              >
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// TAB 2 · AUTOMATIZACIONES
// ─────────────────────────────────────────────────────────────

const AutomatizacionesTab: React.FC<{ onShowToast: ToastFn }> = ({ onShowToast }) => {
  const [cfg, setCfg] = useState<ControlBot>(CONTROL_BOT_DEFAULT);
  const [silenciados, setSilenciados] = useState<SilenciadoBot[]>([]);
  const [registro, setRegistro] = useState<RegistroBotItem[]>([]);
  const [nuevaPalabra, setNuevaPalabra] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const un1 = escucharControlBot(
      (c) => {
        setCfg(c);
        setCargando(false);
      },
      (e) => {
        setCargando(false);
        onShowToast('Automatizaciones', e.message, 'warning');
      }
    );
    const un2 = escucharSilenciados(
      (l) => setSilenciados(l),
      () => undefined
    );
    const un3 = escucharRegistroHoy(
      (l) => setRegistro(l),
      () => undefined
    );
    return () => {
      un1();
      un2();
      un3();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistir = async (nueva: ControlBot, mensaje: string) => {
    setCfg(nueva); // respuesta instantánea (el snapshot lo confirma)
    try {
      await guardarControlBot(nueva);
      onShowToast(mensaje, undefined, 'success');
    } catch (e: any) {
      onShowToast('No se pudo guardar', e.message, 'error');
    }
  };

  const toggleMaestro = () => {
    const nueva = { ...cfg, bot_activo: !cfg.bot_activo };
    persistir(
      nueva,
      nueva.bot_activo ? '🟢 Bot encendido' : '🔴 Bot apagado — tus botones siguen OK'
    );
  };

  const toggleIA = () => persistir({ ...cfg, ia_activa: !cfg.ia_activa }, cfg.ia_activa ? 'IA apagada — el bot mandará el menú' : 'IA encendida');

  const toggleHorario = () => persistir({ ...cfg, horario_activo: !cfg.horario_activo }, cfg.horario_activo ? 'Horario fuera' : 'Horario activo');

  const cambiarHoras = (campo: 'hora_inicio' | 'hora_fin', valor: string) => {
    const n = Math.max(0, Math.min(23, parseInt(valor, 10) || 0));
    persistir({ ...cfg, [campo]: n }, 'Horario guardado');
  };

  const agregarPalabra = () => {
    const p = nuevaPalabra.trim().toLowerCase();
    if (p.length < 3) {
      onShowToast('Muy corta', 'Mínimo 3 letras', 'warning');
      return;
    }
    if (cfg.palabras_enojo_extra.includes(p)) {
      onShowToast('Ya está agregada', p, 'info');
      return;
    }
    setNuevaPalabra('');
    persistir({ ...cfg, palabras_enojo_extra: [...cfg.palabras_enojo_extra, p] }, `Palabra "${p}" agregada`);
  };

  const quitarPalabra = (p: string) => {
    persistir(
      { ...cfg, palabras_enojo_extra: cfg.palabras_enojo_extra.filter((x) => x !== p) },
      `Palabra "${p}" quitada`
    );
  };

  const handleReactivar = async (s: SilenciadoBot) => {
    try {
      await reactivarSilenciado(s.id);
      onShowToast('🔊 Bot reactivado', celBonito(s.celular), 'success');
    } catch (e: any) {
      onShowToast('No se pudo reactivar', e.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Interruptor maestro ── */}
      <div
        className={`rounded-2xl border-2 p-5 text-center transition-colors ${
          cfg.bot_activo
            ? 'bg-emerald-500/[0.06] border-emerald-500/30'
            : 'bg-red-500/[0.07] border-red-500/50'
        }`}
      >
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Respuestas automáticas
        </div>
        <div className={`text-2xl font-black my-1.5 ${cfg.bot_activo ? 'text-emerald-400' : 'text-red-400'}`}>
          {cfg.bot_activo ? '🟢 ENCENDIDAS' : '🔴 APAGADAS'}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          {cfg.bot_activo ? (
            <>
              El bot responde solo a los clientes.
              <br />
              <b className="text-slate-300">Tus botones de RiderTrack siguen funcionando igual.</b>
            </>
          ) : (
            <>
              El bot <b className="text-slate-300">no responde nada</b> a los clientes.
              <br />
              <b className="text-slate-300">Tus botones de RiderTrack SIGUEN funcionando.</b>
            </>
          )}
        </p>
        <button
          onClick={toggleMaestro}
          disabled={cargando}
          className={`w-full py-3.5 rounded-xl font-black text-sm transition-colors disabled:opacity-60 ${
            cfg.bot_activo
              ? 'bg-red-500 hover:bg-red-400 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {cargando ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : cfg.bot_activo ? (
            '🔴 Apagar respuestas automáticas'
          ) : (
            '🟢 Encender respuestas automáticas'
          )}
        </button>
      </div>

      {/* ── Ajustes ── */}
      <Card>
        <h2 className="text-sm font-black text-white flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" /> Ajustes
        </h2>

        {/* IA */}
        <div className="flex items-center justify-between gap-3 py-3.5 border-b border-slate-700/60">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-purple-400" /> Respuestas con IA
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              Si la apagas, el bot manda el menú en vez de improvisar. Más predecible.
            </p>
          </div>
          <Switch on={cfg.ia_activa} onChange={toggleIA} color="bg-purple-500" />
        </div>

        {/* Horario */}
        <div className="flex items-center justify-between gap-3 py-3.5 border-b border-slate-700/60">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" /> Solo en horario
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              Fuera de este horario el bot no responde nada automático.
            </p>
          </div>
          <Switch on={cfg.horario_activo} onChange={toggleHorario} />
        </div>

        {cfg.horario_activo && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 py-3.5">
            <div className="text-sm font-bold text-white">Horario permitido</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={23}
                value={cfg.hora_inicio}
                onChange={(e) => cambiarHoras('hora_inicio', e.target.value)}
                className="w-14 bg-slate-900/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-blue-500/60"
              />
              <span className="text-xs text-slate-500">a</span>
              <input
                type="number"
                min={0}
                max={23}
                value={cfg.hora_fin}
                onChange={(e) => cambiarHoras('hora_fin', e.target.value)}
                className="w-14 bg-slate-900/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-blue-500/60"
              />
              <span className="text-xs text-slate-500">hrs</span>
            </div>
          </div>
        )}
      </Card>

      {/* ── Silenciados ── */}
      <Card>
        <h2 className="text-sm font-black text-white flex items-center gap-2 mb-1">
          <VolumeX className="w-4 h-4 text-red-400" /> Clientes silenciados
          {silenciados.length > 0 && (
            <span className="text-xs font-medium text-slate-500">({silenciados.length})</span>
          )}
        </h2>
        <p className="text-[11px] text-slate-500 mb-3 leading-snug">
          El bot no les responde. Se silencian solos si detecta enojo, o los silencias tú desde el chat.
        </p>
        {silenciados.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-5">✓ Ninguno silenciado</p>
        ) : (
          <div className="space-y-2">
            {silenciados.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 bg-slate-900/50 rounded-xl p-3 border border-slate-700/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white">{celBonito(s.celular)}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {s.porEnojo ? `😡 Enojo: ${s.detalle.slice(0, 40)}` : '🔇 Silenciado por ti'}
                  </div>
                </div>
                <button
                  onClick={() => handleReactivar(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition-colors flex-shrink-0"
                >
                  ▶️ Reactivar
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Palabras de enojo ── */}
      <Card>
        <h2 className="text-sm font-black text-white flex items-center gap-2 mb-1">
          <Angry className="w-4 h-4 text-amber-400" /> Palabras que callan al bot
        </h2>
        <p className="text-[11px] text-slate-500 mb-3 leading-snug">
          Si el cliente escribe alguna, el bot <b className="text-slate-400">se calla</b> y te avisa. Ya hay ~40
          por defecto (estafa, reclamo, devuelvan…). Agrega las que se te escapen.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            value={nuevaPalabra}
            onChange={(e) => setNuevaPalabra(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && agregarPalabra()}
            placeholder="Ej: no sirve"
            className="flex-1 min-w-0 bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60"
          />
          <button
            onClick={agregarPalabra}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors flex-shrink-0"
          >
            Agregar
          </button>
        </div>
        {cfg.palabras_enojo_extra.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            Sin palabras extra. Las ~40 por defecto siguen activas.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {cfg.palabras_enojo_extra.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-300 border border-red-500/30 rounded-lg px-2.5 py-1 text-xs font-bold"
              >
                {p}
                <button
                  onClick={() => quitarPalabra(p)}
                  className="text-red-400/60 hover:text-red-300 transition-colors"
                  title={`Quitar "${p}"`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* ── Registro de hoy ── */}
      <Card>
        <h2 className="text-sm font-black text-white flex items-center gap-2 mb-1">
          <History className="w-4 h-4 text-blue-400" /> Qué mandó el bot hoy
        </h2>
        <p className="text-[11px] text-slate-500 mb-3 leading-snug">
          Todo lo que el bot hizo <b className="text-slate-400">solo</b>, sin que tú lo dispararas.
        </p>
        {registro.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-5">El bot no ha hecho nada solo hoy</p>
        ) : (
          <div className="space-y-2">
            {registro.map((r) => {
              const et = ETIQUETAS_REGISTRO[r.tipo] || {
                label: r.tipo ? r.tipo.toUpperCase().slice(0, 10) : 'BOT',
                clase: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
              };
              let hora = '';
              try {
                hora = new Date(r.ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
              } catch {
                hora = '';
              }
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 bg-slate-900/50 rounded-xl p-3 border border-slate-700/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                      <span className="truncate">{r.nombre}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${et.clase}`}>
                        {et.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {hora} · {r.detalle.slice(0, 60)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// TAB · IMÁGENES DEL BOT (FASE 3.55)
// ─────────────────────────────────────────────────────────────

/**
 * Editor de la IMAGEN que acompaña cada mensaje del bot.
 * El bot tiene 5 mensajes con imagen; acá se sube una propia
 * (va a Storage) o se restablece la local del Termux.
 * El TEXTO se edita aparte, en la pestaña 💬 Plantillas.
 */
const ImagenesBotTab: React.FC<{ onShowToast: ToastFn }> = ({ onShowToast }) => {
  const { user } = useAuth();
  const [imagenes, setImagenes] = useState<Record<string, ImagenBot>>({});
  const [subiendo, setSubiendo] = useState<string | null>(null); // tipo en subida
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Suscripción en vivo: refleja al toque lo que suba/borre
  // el usuario (el bot tiene su propio listener en Termux).
  useEffect(() => {
    const un = escucharImagenesBot(setImagenes);
    return () => un();
  }, []);

  const handleArchivo = async (tipo: string, file: File | undefined) => {
    if (!file) return;
    if (!user?.uid) {
      onShowToast('Sin sesión', 'Vuelve a entrar e intenta otra vez', 'warning');
      return;
    }
    setSubiendo(tipo);
    try {
      // 🩺 FASE AK/AL: el servicio devuelve el peso REAL subido — el
      // toast te dice qué llegó al servidor (y si la comprimió al vuelo)
      const res = await subirImagenBot(user.uid, tipo, file);
      onShowToast(
        'Imagen actualizada',
        `Subieron ${res.pesoKb} KB${res.comprimida ? ' (comprimida al vuelo)' : ''} — el bot la usará en segundos, sin reiniciar nada`,
        'success'
      );
    } catch (e) {
      onShowToast('No se pudo subir', (e as Error).message, 'error');
    } finally {
      setSubiendo(null);
      // limpiar el input: poder re-subir la MISMA imagen luego
      const inp = inputRefs.current[tipo];
      if (inp) inp.value = '';
    }
  };

  const handleRestablecer = async (tipo: string, etiqueta: string) => {
    if (!window.confirm(`¿Volver a usar la imagen LOCAL del bot para "${etiqueta}"?`)) return;
    try {
      await restablecerImagenBot(tipo);
      onShowToast('Imagen restablecida', 'El bot usará su archivo local de siempre', 'info');
    } catch (e) {
      onShowToast('No se pudo restablecer', (e as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Encabezado explicativo ── */}
      <Card>
        <h2 className="text-sm font-black text-white flex items-center gap-2 mb-1">
          <ImagePlus className="w-4 h-4 text-emerald-400" /> Imágenes de los mensajes del bot
        </h2>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          El bot manda <b className="text-slate-300">5 mensajes con imagen</b>. Sube la tuya y la usará
          al instante (la baja de la nube al momento del envío). Si restableces o falla la descarga,
          usa <b className="text-slate-300">su imagen local de siempre</b> — nada se rompe. El{' '}
          <b className="text-slate-300">texto</b> de cada mensaje se edita en la pestaña 💬 Plantillas.
        </p>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          Máx. 3 MB · JPG, PNG o WebP · WhatsApp la comprime igual
        </div>
      </Card>

      {/* ── Una tarjeta por tipo de imagen ── */}
      {TIPOS_IMAGEN_BOT.map((def) => {
        const actual = imagenes[def.tipo];
        const cargando = subiendo === def.tipo;
        return (
          <Card key={def.tipo}>
            <div className="flex gap-3 sm:gap-4">
              {/* Vista previa */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900/60 flex items-center justify-center">
                {actual?.url ? (
                  <img
                    src={actual.url}
                    alt={def.etiqueta}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-center px-1">
                    <ImagePlus className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                    <span className="text-[9px] text-slate-500 leading-tight block">
                      imagen local
                      <br />
                      del bot
                    </span>
                  </div>
                )}
              </div>

              {/* Info + acciones */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-white">{def.etiqueta}</h3>
                  {actual && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      PERSONALIZADA
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{def.desc}</p>
                <div className="text-[10px] text-slate-600 mt-1 flex flex-wrap gap-x-3">
                  <span>
                    Original:{' '}
                    <span className="text-slate-500 font-mono">{def.archivoOriginal}</span>
                  </span>
                  <span>
                    Texto:{' '}
                    <span className="text-slate-500 font-mono">
                      {def.plantillaVinculada === '—' ? '(armado por el bot)' : def.plantillaVinculada}
                    </span>
                  </span>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  <input
                    ref={(el) => {
                      inputRefs.current[def.tipo] = el;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleArchivo(def.tipo, e.target.files?.[0])}
                  />
                  <button
                    onClick={() => inputRefs.current[def.tipo]?.click()}
                    disabled={cargando}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cargando ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-3.5 h-3.5" />
                    )}
                    {cargando ? 'Subiendo…' : actual ? 'Cambiar imagen' : 'Subir imagen'}
                  </button>
                  {actual && (
                    <button
                      onClick={() => handleRestablecer(def.tipo, def.etiqueta)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700/70 hover:bg-slate-600 text-slate-300 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restablecer
                    </button>
                  )}
                </div>

                {/* Cuándo se actualizó */}
                {actual?.actualizadoEn && (
                  <p className="text-[10px] text-slate-600 mt-1.5">
                    Actualizada{' '}
                    {(() => {
                      try {
                        return new Date(actual.actualizadoEn).toLocaleString('es-PE', {
                          timeZone: 'America/Lima',
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      } catch {
                        return actual.actualizadoEn;
                      }
                    })()}
                  </p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 🛡️ TAB 4 · TERMUX (FASE G1 v0.11.15) — el guardián
//
// Tres señales, en orden de confianza:
//   1. Guardián vivo → late cada 60s en sistema/termux_estado
//   2. Bot en PM2 → lo reporta el guardián (online/stopped, RAM, ↺)
//   3. Latido del bot → estado_bot/{uid} (la verdad del WhatsApp)
// Órdenes: sistema/termux_control → pm2 start/stop/restart rudy-bot
//   + 'logs' (📜) y 'respaldar' (📦) — FASE G2.
// 🌙 El guardián v1.2 reinicia el bot solo una vez por día (4:00).
// Si el guardián está muerto, los botones se apagan (nadie escucharía).
// ─────────────────────────────────────────────────────────────
const TermuxTab: React.FC<{ onShowToast: ToastFn }> = ({ onShowToast }) => {
  const { user } = useAuth();
  const [guardian, setGuardian] = useState<EstadoGuardian | null>(null);
  const [control, setControl] = useState<ControlTermux | null>(null);
  const [bot, setBot] = useState<EstadoBot | null>(null);
  const [logsDoc, setLogsDoc] = useState<TermuxLogs | null>(null);
  const [logsAbierto, setLogsAbierto] = useState(false);
  const [respaldoDoc, setRespaldoDoc] = useState<TermuxRespaldo | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const u1 = subscribeEstadoGuardian(setGuardian);
    const u2 = subscribeControlTermux(setControl);
    const u3 = subscribeTermuxLogs(setLogsDoc);
    const u4 = subscribeTermuxRespaldo(setRespaldoDoc);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeEstadoBot(user.uid, setBot);
  }, [user?.uid]);

  // reloj de 1s: los "hace Xs" viven
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const guardiaVivo = !!guardian && guardian.ts > 0 && ahora - guardian.ts < GUARDIAN_VIVO_MS;
  const botLate = !!bot && !!bot.lastSeen && ahora - Date.parse(bot.lastSeen) < 180_000;
  const botCorriendo = guardian?.botEstado === 'online';
  const botParado = guardian?.botEstado === 'stopped';

  const uptimeBonito = (min: number) => (min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`);

  const mandar = async (cmd: 'start' | 'stop' | 'restart' | 'logs' | 'respaldar', pregunta: string, tituloExito: string) => {
    if (!window.confirm(pregunta)) return;
    setEnviando(true);
    try {
      await enviarComandoTermux(cmd);
      onShowToast(tituloExito, 'El guardián la ejecuta en segundos', 'success');
    } catch (e: any) {
      onShowToast('No se pudo enviar la orden', e?.message || 'Firestore', 'error');
    } finally {
      setEnviando(false);
    }
  };

  // resultado de la última orden (feedback del guardián)
  const ultimaOrden = (() => {
    if (!control || !control.cmd || !control.ts) return null;
    if (control.ejecutadoEn < control.ts) return { pendiente: true, txt: `${control.cmd} · esperando al guardián…`, ok: false };
    const ok = control.resultado === 'ok';
    return { pendiente: false, txt: `${control.cmd} → ${control.detalle || (ok ? 'OK' : 'sin detalle')} (${haceRato(ahora - control.ejecutadoEn)})`, ok };
  })();

  const Punto: React.FC<{ on: boolean }> = ({ on }) => (
    <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${on ? 'bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70' : 'bg-red-500 shadow-[0_0_8px] shadow-red-500/60'}`} />
  );

  return (
    <div className="space-y-4">
      {/* ── Señal del guardián ── */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className={`w-5 h-5 shrink-0 ${guardiaVivo ? 'text-emerald-400' : 'text-red-400'}`} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Guardián {guardiaVivo ? 'vivo' : 'sin señal'}</p>
              <p className="text-[11px] text-slate-400">
                {guardiaVivo
                  ? `latió ${haceRato(ahora - guardian!.ts)} · ${guardian!.version}`
                  : 'no late hace más de 2 min — ¿corre en Termux?'}
              </p>
            </div>
          </div>
          {guardian?.bateria != null && (
            <span className="flex items-center gap-1 text-xs font-bold text-slate-300 shrink-0">
              <BatteryMedium className="w-4 h-4 text-lime-400" /> {guardian.bateria}%
            </span>
          )}
        </div>
        {!guardiaVivo && (
          <p className="mt-3 text-[11px] text-slate-400 bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 leading-relaxed">
            Para revivirlo, en Termux:{' '}
            <code className="text-emerald-300">pm2 restart guardian-termux</code> · para instalarlo:{' '}
            <code className="text-emerald-300">pm2 start guardian.js --name guardian-termux && pm2 save</code>
          </p>
        )}
      </Card>

      {/* ── El bot en PM2 + su latido real ── */}
      <Card>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">El bot de trabajo</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <Punto on={guardiaVivo ? botCorriendo : botLate} />
              Proceso en Termux {guardian ? `(${guardian.botEstado})` : ''}
            </span>
            {guardiaVivo && botCorriendo && (
              <span className="text-[11px] text-slate-400 text-right">
                {uptimeBonito(guardian!.botUptimeMin)} · ↺{guardian!.botReinicios} · {guardian!.botMemMb} MB
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <Punto on={botLate} />
              Latido de WhatsApp {bot ? `(${bot.version})` : '(sin señal)'}
            </span>
            {bot?.lastSeen ? (
              <span className="text-[11px] text-slate-400 text-right">
                {bot.whatsapp === 'conectado' ? '🟢 conectado' : '🔴 desconectado'} · {haceRato(ahora - Date.parse(bot.lastSeen))}
              </span>
            ) : null}
          </div>
        </div>
        {guardiaVivo && botParado && (
          <p className="mt-3 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
            ⏹️ El bot está APAGADO — los mensajes de clientes no responden. Enciendelo abajo.
          </p>
        )}
      </Card>

      {/* ── Control remoto ── */}
      <Card>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Control desde la app</p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <button
            disabled={!guardiaVivo || enviando}
            onClick={() => mandar('start', '¿Encender el bot de trabajo?', '▶️ Encendiendo…')}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-xl font-bold text-sm border transition-colors ${
              guardiaVivo && botParado
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white animate-pulse'
                : 'bg-slate-900/60 hover:bg-slate-700/60 border-slate-700/60 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <Play className="w-5 h-5" /> Encender
          </button>
          <button
            disabled={!guardiaVivo || enviando}
            onClick={() =>
              mandar(
                'stop',
                '¿APAGAR el bot de trabajo?\n\nDeja de responder a los clientes hasta que lo enciendas.\nTus botones de RiderTrack quedan en cola.',
                '⏹️ Apagando…'
              )
            }
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl font-bold text-sm border bg-slate-900/60 hover:bg-red-900/40 border-slate-700/60 text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Power className="w-5 h-5" /> Apagar
          </button>
          <button
            disabled={!guardiaVivo || enviando}
            onClick={() =>
              mandar(
                'restart',
                '¿Reiniciar el bot de trabajo?\n\nTarda unos segundos en volver a conectarse a WhatsApp.',
                '🔄 Reiniciando…'
              )
            }
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl font-bold text-sm border bg-slate-900/60 hover:bg-amber-900/40 border-slate-700/60 text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-5 h-5" /> Reiniciar
          </button>
        </div>
        {ultimaOrden && (
          <p
            className={`mt-3 text-[11px] rounded-xl p-2.5 border leading-relaxed ${
              ultimaOrden.pendiente
                ? 'text-slate-400 bg-slate-900/60 border-slate-700/60'
                : ultimaOrden.ok
                  ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                  : 'text-red-300 bg-red-500/10 border-red-500/30'
            }`}
          >
            {ultimaOrden.pendiente ? '⏳ Última orden: ' : 'Última orden: '}
            {ultimaOrden.txt}
          </p>
        )}
        <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
          El guardián jamás se apaga a sí mismo desde acá (el control nunca queda huérfano). Si ANDROID mata Termux, solo se revive abriendo Termux a mano.
        </p>
      </Card>

      {/* ── 🛠️ Herramientas (FASE G2) ── */}
      <Card>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Herramientas</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            disabled={!guardiaVivo || enviando}
            onClick={() => {
              mandar('logs', '¿Pedirle al guardián los últimos logs del bot?', '📜 Buscando logs…');
              setLogsAbierto(true);
            }}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl font-bold text-sm border bg-slate-900/60 hover:bg-sky-900/40 border-slate-700/60 text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ScrollText className="w-5 h-5" /> Ver logs
          </button>
          <button
            disabled={!guardiaVivo || enviando}
            onClick={() =>
              mandar(
                'respaldar',
                '¿Respaldar la configuración del bot?\n\nSe guarda en la nube + una copia local con fecha en Termux.',
                '📦 Respalando…'
              )
            }
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl font-bold text-sm border bg-slate-900/60 hover:bg-violet-900/40 border-slate-700/60 text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Archive className="w-5 h-5" /> Respaldar config
          </button>
        </div>
        <div className="mt-3 space-y-1.5 text-[11px] text-slate-400">
          {respaldoDoc ? (
            <p>
              📦 Último respaldo: <span className="text-slate-300 font-bold">{respaldoDoc.copiados.join(', ') || '—'}</span> ·{' '}
              {haceRato(Math.max(0, ahora - respaldoDoc.ts))}
            </p>
          ) : (
            <p>📦 Sin respaldos aún — el primero queda en la nube + copia local en Termux.</p>
          )}
          {guardian?.ultimoReinicioNocturno ? (
            <p>
              🌙 Reinicio nocturno {guardian.nocturnoHora ?? 4}:00 — último {haceRato(Math.max(0, ahora - Date.parse(guardian.ultimoReinicioNocturno)))}
            </p>
          ) : (
            <p>🌙 Reinicio nocturno: 4:00 — llega con el guardián v1.2 (el bot arranca fresco cada día).</p>
          )}
        </div>
      </Card>

      {/* ── 📜 Modal de logs (FASE G2) ── */}
      {logsAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLogsAbierto(false)}
        >
          <div
            className="w-full sm:max-w-2xl max-h-[85vh] overflow-hidden bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl dt-anim-pop flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 p-4 border-b border-slate-700/60">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-sky-400 shrink-0" /> Últimos logs del bot
                </p>
                <p className="text-[11px] text-slate-400">
                  {logsDoc ? `traídos ${haceRato(Math.max(0, ahora - logsDoc.ts))} · ${guardian?.version || ''}` : 'nunca pedidos'}
                </p>
              </div>
              <button onClick={() => setLogsAbierto(false)} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              {control?.cmd === 'logs' && control.ejecutadoEn < control.ts && (
                <p className="text-[11px] text-slate-400 bg-slate-900/60 border border-slate-700/60 rounded-xl p-2.5">
                  ⏳ Esperando al guardián…
                </p>
              )}
              {control?.cmd === 'logs' && control.ejecutadoEn >= control.ts && control.resultado === 'error' && (
                <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5">🔴 {control.detalle}</p>
              )}
              {logsDoc && (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Consola (últimas {logsDoc.out ? logsDoc.out.split('\n').length : 0} líneas)
                    </p>
                    <pre className="text-[10px] font-mono text-slate-300 bg-slate-950/80 border border-slate-700/60 rounded-xl p-3 max-h-56 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                      {logsDoc.out || '(vacío)'}
                    </pre>
                  </div>
                  {logsDoc.err && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">Errores</p>
                      <pre className="text-[10px] font-mono text-red-200 bg-slate-950/80 border border-red-500/30 rounded-xl p-3 max-h-40 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                        {logsDoc.err}
                      </pre>
                    </div>
                  )}
                  <button
                    onClick={() =>
                      navigator.clipboard?.writeText((logsDoc.out || '') + (logsDoc.err ? '\n--- ERRORES ---\n' + logsDoc.err : ''))
                    }
                    className="flex items-center gap-1.5 text-[11px] font-bold text-sky-300 hover:text-sky-200"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar todo
                  </button>
                </>
              )}
              <button
                disabled={!guardiaVivo || enviando}
                onClick={() => mandar('logs', '¿Refrescar los logs?', '📜 Buscando logs…')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs border border-sky-500/40 bg-sky-600/20 hover:bg-sky-600/30 text-sky-200 transition-colors disabled:opacity-40"
              >
                <RefreshCw className="w-4 h-4" /> Refrescar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// VISTA PRINCIPAL (tabs)
// ─────────────────────────────────────────────────────────────

export const BotControlView: React.FC<BotControlViewProps> = ({ vistaInicial = 'plantillas', onShowToast }) => {
  const [tab, setTab] = useState<'plantillas' | 'imagenes' | 'automatizaciones' | 'termux'>(vistaInicial);
  const toast: ToastFn =
    onShowToast ||
    ((title: string, desc?: string) => {
      // Fallback sin UI de toasts (p. ej. en smoke tests)
      // eslint-disable-next-line no-console
      console.log(`[BotControl] ${title}${desc ? ' — ' + desc : ''}`);
    });

  // Si navegas desde el menú a la otra pestaña, sincroniza
  useEffect(() => {
    setTab(vistaInicial);
  }, [vistaInicial]);

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-8">
      {/* Encabezado */}
      <div>
        <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-400" /> Centro del Bot
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Mudanza de ClienteTrack · el robot de Baileys es el único que toca WhatsApp
        </p>
      </div>

      {/* Tabs — ⚡ F3.59: arregladas para pantallas angostas.
          Antes "Automatizaciones" no cabía y la pestaña traspasaba
          el borde del panel. Ahora: etiqueta corta en móvil (Auto.),
          completa en pantallas grandes, y scroll horizontal de
          seguridad por si aun así no cabe. */}
      <div className="flex gap-1 sm:gap-1.5 p-1 bg-slate-800/70 rounded-xl border border-slate-700/60 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setTab('plantillas')}
          className={`flex-1 min-w-0 sm:flex-none sm:px-4 px-2 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
            tab === 'plantillas'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquareText className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Plantillas</span>
          <span className="sm:hidden">Plantillas</span>
        </button>
        <button
          onClick={() => setTab('imagenes')}
          className={`flex-1 min-w-0 sm:flex-none sm:px-4 px-2 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
            tab === 'imagenes'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ImagePlus className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Imágenes bot</span>
          <span className="sm:hidden">Imágenes</span>
        </button>
        <button
          onClick={() => setTab('automatizaciones')}
          className={`flex-1 min-w-0 sm:flex-none sm:px-4 px-2 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
            tab === 'automatizaciones'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Automatizaciones</span>
          <span className="sm:hidden">Auto.</span>
        </button>
        <button
          onClick={() => setTab('termux')}
          className={`flex-1 min-w-0 sm:flex-none sm:px-4 px-2 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
            tab === 'termux'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Termux</span>
          <span className="sm:hidden">Termux</span>
        </button>
      </div>

      {/* Contenido */}
      {tab === 'plantillas' ? (
        <PlantillasTab onShowToast={toast} />
      ) : tab === 'imagenes' ? (
        <ImagenesBotTab onShowToast={toast} />
      ) : tab === 'termux' ? (
        <TermuxTab onShowToast={toast} />
      ) : (
        <AutomatizacionesTab onShowToast={toast} />
      )}
    </div>
  );
};

export default BotControlView;
