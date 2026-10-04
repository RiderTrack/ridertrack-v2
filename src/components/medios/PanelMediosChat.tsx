// ═══════════════════════════════════════════════════════════
// 🎵 PanelMediosChat.tsx — FASE 5.1
// Apartado de configuración de "Medios por chat" (pestaña 🎵
// dentro del WhatsApp Personal): interruptor general, qué
// medios se controlan, quiénes pueden mandar comandos, estado
// en vivo y un probador local para no gastar WhatsApp.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Music, Radio as RadioIcon, Youtube, Podcast, Play, Copy, Loader2, Volume2, Send } from 'lucide-react';
import { useMedios } from './MediosProvider';
import {
  leerCfgMediosChat, guardarCfgMediosChat, suscribirCfgMediosChat,
  probarComandoMedios, ayudaMediosChat, type CfgMediosChat,
} from '../../utils/mediosChat';

const COMANDOS_RAPIDOS: { cmd: string; desc: string }[] = [
  { cmd: '!estado', desc: 'qué está sonando ahora' },
  { cmd: '!radios', desc: 'lista de las 14 emisoras' },
  { cmd: '!radio radiomar', desc: 'sintoniza por nombre' },
  { cmd: '!spotify', desc: 'toca/pausa tu música' },
  { cmd: '!spotify gym', desc: 'toca la playlist que digas' },
  { cmd: '!megusta', desc: 'tus me gusta de Spotify' },
  { cmd: '!podcasts', desc: 'los podcasts que seguís' },
  { cmd: '!podcast ciencia', desc: 'último episodio de ese podcast' },
  { cmd: '!yt https://youtu.be/…', desc: 'toca ese video' },
  { cmd: '!pausa', desc: 'pausa lo que suena' },
  { cmd: '!play', desc: 'sigue donde estaba' },
  { cmd: '!volumen 50', desc: 'volumen al 50%' },
];

/** tarjeta reutilizable de interruptor */
const FilaToggle: React.FC<{
  titulo: string;
  desc: string;
  icono: React.ReactNode;
  valor: boolean;
  onToggle: () => void;
}> = ({ titulo, desc, icono, valor, onToggle }) => (
  <button
    onClick={onToggle}
    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${
      valor ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-900/50 border-slate-700/60'
    }`}
  >
    <span className={valor ? 'text-emerald-300' : 'text-slate-500'}>{icono}</span>
    <span className="flex-1 min-w-0">
      <span className={`block text-sm font-bold ${valor ? 'text-white' : 'text-slate-400'}`}>{titulo}</span>
      <span className="block text-[11px] text-slate-400 truncate">{desc}</span>
    </span>
    <span className={`w-10 h-[22px] rounded-full border relative shrink-0 transition-colors ${
      valor ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-700 border-slate-600'
    }`}>
      <span className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-all ${valor ? 'left-[20px]' : 'left-[2px]'}`} />
    </span>
  </button>
);

export const PanelMediosChat: React.FC<{
  onShowToast?: (titulo: string, desc?: string, tipo?: 'success' | 'info' | 'warning' | 'error') => void;
}> = ({ onShowToast }) => {
  const medios = useMedios();
  const [cfg, setCfg] = useState<CfgMediosChat>(() => leerCfgMediosChat());
  const [permitidosTxt, setPermitidosTxt] = useState(() => leerCfgMediosChat().permitidos.join(', '));
  const [prueba, setPrueba] = useState('');
  const [pruebaResultado, setPruebaResultado] = useState('');
  const [probando, setProbando] = useState(false);

  useEffect(() => suscribirCfgMediosChat(() => setCfg(leerCfgMediosChat())), []);

  const guardar = (parcial: Partial<CfgMediosChat>) => {
    const nuevo = guardarCfgMediosChat(parcial);
    setCfg({ ...nuevo });
  };

  // estado en vivo (lo que suena ahora)
  const suena =
    medios.fuenteActiva === 'radio' && medios.radio.estacion
      ? `${medios.radio.estacion.emoji} ${medios.radio.estacion.name} · ${medios.radio.estacion.freq}${medios.radio.reproduciendo ? ' · sonando' : ' · pausada'}`
      : medios.fuenteActiva === 'spotify' && medios.spotify.track
        ? `🎵 ${medios.spotify.track.nombre} — ${medios.spotify.track.artista}${medios.spotify.track.reproduciendo ? ' · sonando' : ' · pausada'}`
        : medios.fuenteActiva === 'youtube' && medios.youtube.videoId
          ? `▶️ ${medios.youtube.titulo || 'video'}${medios.youtube.reproduciendo ? ' · sonando' : ' · pausado'}`
          : medios.fuenteActiva === 'podcast' && medios.podcast.episodio
            ? `🎙️ ${medios.podcast.episodio.podcastTitulo} — ${medios.podcast.episodio.titulo}${
                medios.podcast.fase === 'reproduciendo' ? ' · sonando' : ' · pausado'
              }`
            : null;

  const probar = async () => {
    const texto = prueba.trim();
    if (!texto || probando) return;
    setProbando(true);
    setPruebaResultado('');
    try {
      const res = await probarComandoMedios(texto);
      setPruebaResultado(res);
      onShowToast?.('🎵 Comando probado', res.split('\n')[0].slice(0, 70), 'success');
    } catch (e: unknown) {
      setPruebaResultado(`⚠️ ${(e as Error)?.message || 'falló el comando'}`);
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">

      {/* ══ interruptor general ══ */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
        <div className="flex items-center gap-2">
          <Music size={16} className="text-emerald-300" />
          <span className="text-sm font-black text-emerald-200">Medios por chat</span>
          <span className="ml-auto px-1.5 py-0.5 text-[9px] font-black rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">FASE 5.1</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
          Controlá la música de la app <b>desde cualquier chat</b> de tu WhatsApp personal: mandá
          <b> !radio</b>, <b>!spotify</b>, <b>!podcast</b> o <b>!yt &lt;link&gt;</b> y suena en el teléfono
          con RiderTrack. La confirmación la manda tu propio número (bot v1.3, sin tocar nada en Termux).
        </p>
        <button
          onClick={() => guardar({ activo: !cfg.activo })}
          className="w-full mt-3 flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className={`w-10 h-[22px] rounded-full border relative shrink-0 transition-colors ${cfg.activo ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-700 border-slate-600'}`}>
              <span className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-all ${cfg.activo ? 'left-[20px]' : 'left-[2px]'}`} />
            </span>
            <span className={`text-xs font-bold ${cfg.activo ? 'text-emerald-200' : 'text-slate-400'}`}>
              {cfg.activo ? 'Escuchando comandos' : 'Apagado'}
            </span>
          </span>
          <span className="text-[10px] text-slate-500">app abierta o en segundo plano</span>
        </button>
      </div>

      {/* ══ qué está sonando ══ */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-3.5">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-slate-300" />
          <span className="text-xs font-bold text-slate-300">Ahora en la app</span>
        </div>
        <div className={`mt-2 text-sm font-semibold ${suena ? 'text-white' : 'text-slate-500'}`}>
          {suena || '😴 Nada está sonando'}
        </div>
        {suena && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-500">
              controlalo por chat con !pausa · !play · !volumen
            </span>
          </div>
        )}
      </div>

      {/* ══ medios habilitados ══ */}
      <div>
        <div className="text-xs font-bold text-slate-300 mb-2">¿Qué medios se pueden controlar?</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <FilaToggle
            titulo="Radio"
            desc="!radio <nombre> · !radios"
            icono={<RadioIcon size={17} />}
            valor={cfg.radio}
            onToggle={() => guardar({ radio: !cfg.radio })}
          />
          <FilaToggle
            titulo="Spotify"
            desc="!spotify · !megusta · !siguiente"
            icono={<Music size={17} />}
            valor={cfg.spotify}
            onToggle={() => guardar({ spotify: !cfg.spotify })}
          />
          <FilaToggle
            titulo="Podcasts"
            desc="!podcast <nombre> · !podcasts"
            icono={<Podcast size={17} />}
            valor={cfg.podcast}
            onToggle={() => guardar({ podcast: !cfg.podcast })}
          />
          <FilaToggle
            titulo="YouTube"
            desc="!yt <link> · audio del video"
            icono={<Youtube size={17} />}
            valor={cfg.youtube}
            onToggle={() => guardar({ youtube: !cfg.youtube })}
          />
        </div>
      </div>

      {/* ══ respuestas y permisos ══ */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-3.5 space-y-3">
        <FilaToggle
          titulo="Confirmar por chat"
          desc="el bot contesta con tu número qué quedó sonando"
          icono={<Send size={17} />}
          valor={cfg.responder}
          onToggle={() => guardar({ responder: !cfg.responder })}
        />
        <div>
          <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Volume2 size={13} /> ¿Quiénes pueden mandar comandos?
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Dejalo vacío para que cualquiera de tus chats pueda. O anotá números (con coma) para restringirlo — ej: tu otro celular.
          </p>
          <div className="flex gap-2 mt-2">
            <input
              value={permitidosTxt}
              onChange={(e) => setPermitidosTxt(e.target.value)}
              placeholder="51987654321, 51981234567"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400"
            />
            <button
              onClick={() => {
                const lista = permitidosTxt
                  .split(/[,;\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 12);
                guardar({ permitidos: lista });
                onShowToast?.('🎵 Medios por chat', lista.length ? `Restringido a ${lista.length} número(s)` : 'Cualquier chat puede mandar comandos', 'info');
              }}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shrink-0"
            >
              Guardar
            </button>
          </div>
          {cfg.permitidos.length > 0 && (
            <div className="text-[10px] text-emerald-300 mt-1.5 font-mono truncate">
              {cfg.permitidos.join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* ══ probador local ══ */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5">
        <div className="flex items-center gap-2">
          <Loader2 size={14} className={`text-amber-300 ${probando ? 'animate-spin' : ''}`} />
          <span className="text-xs font-black text-amber-200">Probar sin gastar WhatsApp</span>
        </div>
        <div className="flex gap-2 mt-2">
          <input
            value={prueba}
            onChange={(e) => setPrueba(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void probar(); }}
            placeholder="!radio oxigeno  ·  pon musica  ·  !estado"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
          />
          <button
            onClick={() => void probar()}
            disabled={probando || !prueba.trim()}
            className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5"
          >
            {probando ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Probar
          </button>
        </div>
        {pruebaResultado && (
          <pre className="mt-2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60 text-[11px] text-slate-200 whitespace-pre-wrap font-sans leading-relaxed max-h-44 overflow-y-auto custom-scrollbar">
            {pruebaResultado}
          </pre>
        )}
        <div className="text-[10px] text-slate-500 mt-1.5">
          El comando se ejecuta AHORA en la app (verás el mini-reproductor reaccionar).
        </div>
      </div>

      {/* ══ lista de comandos ══ */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Copy size={13} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-300">Comandos (tocá uno para probarlo)</span>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 divide-y divide-slate-700/60">
          {COMANDOS_RAPIDOS.map((c) => (
            <button
              key={c.cmd}
              onClick={() => setPrueba(c.cmd)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-800/60 transition-colors"
            >
              <span className="text-[11px] font-mono font-bold text-emerald-300 shrink-0">{c.cmd}</span>
              <span className="text-[11px] text-slate-400 truncate">{c.desc}</span>
            </button>
          ))}
        </div>
        <details className="mt-2 rounded-2xl border border-slate-700 bg-slate-900/50 p-3">
          <summary className="text-[11px] font-bold text-slate-300 cursor-pointer">
            Ver la ayuda completa (la misma que manda !ayuda)
          </summary>
          <pre className="mt-2 text-[11px] text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
            {ayudaMediosChat()}
          </pre>
        </details>
      </div>

      {/* ══ nota de funcionamiento ══ */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-3">
        <div className="text-[10px] text-slate-500 leading-relaxed">
          Los comandos los escucha la <b>app RiderTrack</b> (mensajes que le llegan al celular 2) y los ejecuta
          en el teléfono: funciona con la app abierta o en segundo plano, mientras Android no la cierre. El
          bot-personal <b>v1.3 no se toca</b>: solo manda las confirmaciones como mensajes tuyos. Si algo no
          contesta, revisá que el chat personal esté conectado (QR arriba) y que tengas red.
        </div>
      </div>
    </div>
  );
};
