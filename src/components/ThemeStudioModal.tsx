// ═══════════════════════════════════════════════════════════
// 🎨 ESTUDIO DE TEMAS — RiderTrack V2 · F3.51
// Componente: ThemeStudioModal — la UI del estudio
// ═══════════════════════════════════════════════════════════
// Un solo lugar para personalizar TODO el look de la app:
// presets de un toque, modo claro/oscuro/auto, color de acento,
// tipografía, tamaño de letra, fondo y redondeo. Los cambios se
// aplican EN VIVO (sin botón "aplicar") y se guardan solos.
// El motor vive en src/theme/ (modular: esta UI no sabe nada
// de rutas, pagos ni Firestore — solo tema).
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Check, RotateCcw, Sun, Moon, Smartphone, Type, Sparkles } from 'lucide-react';
import { Modal } from './ui';
import { useTema } from '../theme/useTema';
import {
  ACENTOS,
  FONDOS,
  FUENTES,
  PRESETS,
  RADIOS,
  type PresetTema,
} from '../theme/catalogo';
import {
  ESCALA_MAX,
  ESCALA_MIN,
  ESCALA_PASO,
  type ConfigTema,
} from '../theme/tipos';

interface ThemeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning') => void;
}

/** Etiqueta de sección (mismo look en todo el estudio). */
const TituloSeccion: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2 pt-2">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
      {children}
    </span>
    <span className="flex-1 h-px bg-slate-700/60" />
  </div>
);

export const ThemeStudioModal: React.FC<ThemeStudioModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const { config, modoEfectivo, actualizarConfig, aplicarPreset, restaurarFabrica, sistemaPrefiereClaro } =
    useTema();

  // ¿Qué preset está activo? (ignora la escala: si cambiaste solo el
  // tamaño de letra, el look del preset sigue siendo el activo)
  const presetActivo = PRESETS.find(
    (p) =>
      p.config.modo === config.modo &&
      p.config.acento === config.acento &&
      p.config.fuente === config.fuente &&
      p.config.fondo === config.fondo &&
      p.config.radio === config.radio
  )?.id;

  const aplicar = (preset: PresetTema) => {
    aplicarPreset(preset);
    onShowToast?.(`Tema ${preset.nombre} activado`, preset.descripcion, 'success');
  };

  const restaurar = () => {
    restaurarFabrica();
    onShowToast?.('Tema de fábrica restaurado', 'Look original de RiderTrack V2', 'info');
  };

  const opcionesModo: { id: ConfigTema['modo']; nombre: string; icono: React.ReactNode; sub?: string }[] = [
    { id: 'dark', nombre: 'Oscuro', icono: <Moon className="w-4 h-4" /> },
    { id: 'light', nombre: 'Claro', icono: <Sun className="w-4 h-4" /> },
    {
      id: 'auto',
      nombre: 'Auto',
      icono: <Smartphone className="w-4 h-4" />,
      sub: sistemaPrefiereClaro ? '→ claro ahora' : '→ oscuro ahora',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🎨 Estudio de Temas"
      subtitle="Personaliza el look · se aplica y se guarda al instante"
      maxWidth="2xl"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <span className="text-[9px] font-mono font-bold text-slate-500 tracking-wider">
            ESTUDIO · F3.51
          </span>
          <button
            onClick={restaurar}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-slate-300 bg-slate-700/50 border border-slate-600/60 hover:bg-slate-600/50 hover:text-white transition-colors"
            title="Volver al look original de fábrica"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar fábrica
          </button>
        </div>
      }
    >
      {/* ═══ 1) PRESETS — looks completos de un toque ═══ */}
      <TituloSeccion>
        <Sparkles className="w-3 h-3 text-blue-400" /> Temas listos
      </TituloSeccion>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PRESETS.map((p) => {
          const activo = presetActivo === p.id;
          const claro = p.config.modo === 'light';
          return (
            <button
              key={p.id}
              onClick={() => aplicar(p)}
              className={`relative flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-200 hover:scale-[1.02] ${
                activo
                  ? 'border-blue-500/70 ring-2 ring-blue-500/40 bg-blue-500/10'
                  : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
              }`}
              title={p.descripcion}
            >
              <div className="flex items-center gap-1.5 w-full">
                <span className="text-base leading-none">{p.emoji}</span>
                <span className="text-xs font-bold text-white truncate flex-1">{p.nombre}</span>
                {activo && <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
              </div>
              {/* miniatura: franja con el look (fondo + acento) */}
              <div
                className={`w-full h-8 rounded-lg flex items-center px-1.5 gap-1 border ${
                  claro ? 'bg-slate-200 border-slate-400/50' : 'bg-slate-800 border-slate-600/50'
                } ${p.config.fondo === 'degradado' ? 'bg-gradient-to-br from-transparent to-black/25' : ''}`}
              >
                <span
                  className="w-4 h-4 rounded-md flex-shrink-0"
                  style={{ background: ACENTOS.find((a) => a.id === p.config.acento)?.muestra }}
                />
                <span className={`flex-1 h-2 rounded-full ${claro ? 'bg-slate-400/70' : 'bg-slate-600/70'}`} />
                <span className={`h-2 w-3 rounded-full ${claro ? 'bg-slate-500/60' : 'bg-slate-500/40'}`} />
              </div>
              <span className="text-[9px] leading-tight text-slate-400 line-clamp-2">
                {p.descripcion}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══ 2) MODO — oscuro / claro / auto ═══ */}
      <TituloSeccion>
        <Sun className="w-3 h-3 text-blue-400" /> Modo
      </TituloSeccion>
      <div className="grid grid-cols-3 gap-2">
        {opcionesModo.map((m) => {
          const activo = config.modo === m.id;
          return (
            <button
              key={m.id}
              onClick={() => actualizarConfig({ modo: m.id })}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all duration-200 ${
                activo
                  ? 'border-blue-500/70 ring-2 ring-blue-500/40 bg-blue-500/15 text-white'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className={activo ? 'text-blue-400' : 'text-slate-400'}>{m.icono}</span>
              <span className="text-xs font-bold">{m.nombre}</span>
              {m.sub && <span className="text-[9px] text-slate-500 font-medium">{m.sub}</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Modo <b>Auto</b>: la app sigue al teléfono — si activas el ahorro de batería / tema claro
        del sistema, RiderTrack cambia sola. Ahora mismo está en{' '}
        <b>{modoEfectivo === 'light' ? 'claro' : 'oscuro'}</b>.
      </p>

      {/* ═══ 3) ACENTO — color principal ═══ */}
      <TituloSeccion>
        <Sparkles className="w-3 h-3 text-blue-400" /> Color de acento
      </TituloSeccion>
      <div className="flex flex-wrap gap-2.5">
        {ACENTOS.map((a) => {
          const activo = config.acento === a.id;
          return (
            <button
              key={a.id}
              onClick={() => actualizarConfig({ acento: a.id })}
              className={`flex flex-col items-center gap-1.5 p-1.5 rounded-xl border transition-all duration-200 hover:scale-105 ${
                activo
                  ? 'border-slate-500 bg-slate-700/40'
                  : 'border-transparent hover:border-slate-700'
              }`}
              title={`Acento ${a.nombre}`}
            >
              <span
                className="relative w-9 h-9 rounded-full border-2 flex items-center justify-center shadow-inner"
                style={{
                  background: a.muestra,
                  borderColor: activo ? '#ffffff' : 'rgba(148,163,184,0.35)',
                }}
              >
                {activo && <Check className="w-4 h-4 text-white drop-shadow" strokeWidth={3.5} />}
              </span>
              <span className="text-[9px] font-bold text-slate-300">{a.nombre}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        El acento pinta botones, enlaces, badges, focos de input y el brillo del fondo — toda la
        app de una sola vez.
      </p>

      {/* ═══ 4) TIPOGRAFÍA + TAMAÑO DE LETRA ═══ */}
      <TituloSeccion>
        <Type className="w-3 h-3 text-blue-400" /> Tipografía y tamaño de letra
      </TituloSeccion>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {FUENTES.map((f) => {
          const activo = config.fuente === f.id;
          return (
            <button
              key={f.id}
              onClick={() => actualizarConfig({ fuente: f.id })}
              style={{ fontFamily: f.stack }}
              className={`relative flex flex-col items-start gap-0.5 p-3 rounded-xl border text-left transition-all duration-200 hover:scale-[1.01] ${
                activo
                  ? 'border-blue-500/70 ring-2 ring-blue-500/40 bg-blue-500/10'
                  : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
              }`}
              title={f.descripcion}
            >
              {activo && (
                <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-blue-400" />
              )}
              <span className="text-base font-bold text-white leading-none">Aa</span>
              <span className="text-xs font-bold text-slate-200 mt-1">{f.nombre}</span>
              <span className="text-[9px] text-slate-500 leading-tight">{f.descripcion}</span>
            </button>
          );
        })}
      </div>

      {/* Tamaño de letra — slider en vivo */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">Tamaño de letra</span>
          <span className="text-sm font-black text-blue-400 tabular-nums">
            {Math.round(config.escala * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={ESCALA_MIN}
          max={ESCALA_MAX}
          step={ESCALA_PASO}
          value={config.escala}
          onChange={(e) => actualizarConfig({ escala: parseFloat(e.target.value) })}
          className="w-full h-2 rounded-full bg-slate-700 accent-blue-500 cursor-pointer"
          aria-label="Escala de letra"
        />
        <div className="flex justify-between text-[9px] font-bold text-slate-500">
          <span>A · 85%</span>
          <span>100% (original)</span>
          <span>125% · A</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-snug" style={{ lineHeight: 1.4 }}>
          <b>Muestra:</b> El pedido #12 de S/ 45.50 va en camino 🛵 — mueve el control y mira cómo
          crece todo (incluida esta ventana).
        </p>
        <p className="text-[9px] text-slate-500 leading-relaxed">
          Ideal si el teléfono va en el manubrio y necesitas leer de lejos. 100% = el diseño con
          el que nació la app.
        </p>
      </div>

      {/* ═══ 5) FONDO — textura detrás de las tarjetas ═══ */}
      <TituloSeccion>
        <Sparkles className="w-3 h-3 text-blue-400" /> Fondo
      </TituloSeccion>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FONDOS.map((f) => {
          const activo = config.fondo === f.id;
          return (
            <button
              key={f.id}
              onClick={() => actualizarConfig({ fondo: f.id })}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all duration-200 hover:scale-[1.02] ${
                activo
                  ? 'border-blue-500/70 ring-2 ring-blue-500/40 bg-blue-500/10'
                  : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
              }`}
              title={f.descripcion}
            >
              <span className={`w-full h-10 rounded-lg border border-slate-600/50 ${f.mini}`} />
              <span className="text-xs font-bold text-slate-200">{f.nombre}</span>
              <span className="text-[9px] text-slate-500 leading-tight text-center line-clamp-2">
                {f.descripcion}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══ 6) REDONDEO — esquinas ═══ */}
      <TituloSeccion>
        <Sparkles className="w-3 h-3 text-blue-400" /> Redondeo de bordes
      </TituloSeccion>
      <div className="grid grid-cols-3 gap-2">
        {RADIOS.map((r) => {
          const activo = config.radio === r.id;
          const radioMuestra = r.id === 'sutil' ? '4px' : r.id === 'estandar' ? '10px' : '18px';
          return (
            <button
              key={r.id}
              onClick={() => actualizarConfig({ radio: r.id })}
              className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all duration-200 ${
                activo
                  ? 'border-blue-500/70 ring-2 ring-blue-500/40 bg-blue-500/10'
                  : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
              }`}
            >
              <span
                className={`w-9 h-6 border-2 ${activo ? 'border-blue-400' : 'border-slate-500'}`}
                style={{ borderRadius: radioMuestra }}
              />
              <span className="text-xs font-bold text-slate-200">{r.nombre}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ 7) VISTA PREVIA — mini app con el tema actual ═══ */}
      <TituloSeccion>Vista previa en vivo</TituloSeccion>
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-700/60 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 siempre-blanco flex items-center justify-center font-black text-sm shadow-md shadow-blue-500/25">
              RT
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold text-white">RiderTrack</span>
              <span className="text-[9px] text-slate-500">Despacho & Telemetría</span>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            F3.51
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-white">Pedido #12 · Los Olivos</span>
            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-400">
              Entregado
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">S/ 45.50 · Yape Rudy · hace 4 min</p>
          <div className="flex gap-2 mt-2.5">
            <button className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-colors">
              Ver detalle
            </button>
            <button className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600 transition-colors">
              WhatsApp
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 text-center">
          Así se ve tu app ahora mismo: acento, fuente, redondeo y modo trabajando juntos.
        </p>
      </div>
    </Modal>
  );
};
