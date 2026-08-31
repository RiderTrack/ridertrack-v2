// ═══════════════════════════════════════════════════════════
// 👤 AVATARES — Fase 2.13
// Galería con los DISEÑOS PROPIOS del equipo: 32 ilustraciones
// en 4 categorías (🏍️ Rider, 💻 Tecnología, 🐾 Animales, 🎮 Gaming)
// + los 12 clásicos SVG como pestaña extra. El rider elige el
// suyo desde el menú hamburguesa y aparece en el header, el
// sidebar y el GPS del motorizado.
// ═══════════════════════════════════════════════════════════

import React from 'react';

// ── Ilustraciones propias (WebP 192×192, ~18 KB c/u, se
//    empaquetan dentro del APK — funcionan sin internet) ──
import av001 from '../assets/avatares/001_rider_urbano.webp';
import av002 from '../assets/avatares/002_rider_deportivo.webp';
import av003 from '../assets/avatares/003_rider_nocturno.webp';
import av004 from '../assets/avatares/004_rider_mecanico.webp';
import av005 from '../assets/avatares/005_rider_ninja.webp';
import av006 from '../assets/avatares/006_rider_cyber.webp';
import av007 from '../assets/avatares/007_rider_aventurero.webp';
import av008 from '../assets/avatares/008_rider_legendario.webp';
import av009 from '../assets/avatares/009_programador.webp';
import av010 from '../assets/avatares/010_programadora.webp';
import av011 from '../assets/avatares/011_robot_ia.webp';
import av012 from '../assets/avatares/012_cyborg.webp';
import av013 from '../assets/avatares/013_cientifico.webp';
import av014 from '../assets/avatares/014_ingeniero.webp';
import av015 from '../assets/avatares/015_ia.webp';
import av016 from '../assets/avatares/016_hacker_cyber.webp';
import av017 from '../assets/avatares/017_lobo.webp';
import av018 from '../assets/avatares/018_zorro.webp';
import av019 from '../assets/avatares/019_leon.webp';
import av020 from '../assets/avatares/020_tigre.webp';
import av021 from '../assets/avatares/021_aguila.webp';
import av022 from '../assets/avatares/022_panda.webp';
import av023 from '../assets/avatares/023_oso.webp';
import av024 from '../assets/avatares/024_gato.webp';
import av025 from '../assets/avatares/025_gamer.webp';
import av026 from '../assets/avatares/026_ninja.webp';
import av027 from '../assets/avatares/027_guerrero.webp';
import av028 from '../assets/avatares/028_mecha.webp';
import av029 from '../assets/avatares/029_alien.webp';
import av030 from '../assets/avatares/030_hechicero.webp';
import av031 from '../assets/avatares/031_piloto.webp';
import av032 from '../assets/avatares/032_heroe.webp';

export type CategoriaAvatar = 'rider' | 'tecnologia' | 'animales' | 'gaming' | 'clasicos';

export interface CategoriaDef {
  id: CategoriaAvatar;
  nombre: string;
  emoji: string;
  /** degradado de fondo de las tarjetas (solo avatares con imagen) */
  fondo: string;
}

export const CATEGORIAS: CategoriaDef[] = [
  { id: 'rider', nombre: 'Rider', emoji: '🏍️', fondo: 'from-blue-500 to-blue-900' },
  { id: 'tecnologia', nombre: 'Tecnología', emoji: '💻', fondo: 'from-cyan-400 to-slate-900' },
  { id: 'animales', nombre: 'Animales', emoji: '🐾', fondo: 'from-amber-400 to-amber-900' },
  { id: 'gaming', nombre: 'Gaming', emoji: '🎮', fondo: 'from-purple-400 to-purple-900' },
  { id: 'clasicos', nombre: 'Clásicos', emoji: '⭐', fondo: 'from-slate-600 to-slate-900' },
];

export interface AvatarDef {
  id: string;
  nombre: string;
  emoji: string;
  categoria: CategoriaAvatar;
  /** ilustración WebP (diseños propios — Fase 2.13) */
  img?: string;
  /** SVG interno (sin <svg> wrapper) — viewBox 0 0 100 100 (clásicos) */
  svg?: string;
}

export const AVATARES: AvatarDef[] = [
  // ── 🏍️ RIDER (diseños propios) ──
  { id: '001_rider_urbano', nombre: 'Rider Urbano', emoji: '🛵', categoria: 'rider', img: av001 },
  { id: '002_rider_deportivo', nombre: 'Rider Deportivo', emoji: '🏁', categoria: 'rider', img: av002 },
  { id: '003_rider_nocturno', nombre: 'Rider Nocturno', emoji: '🌙', categoria: 'rider', img: av003 },
  { id: '004_rider_mecanico', nombre: 'Rider Mecánico', emoji: '🔧', categoria: 'rider', img: av004 },
  { id: '005_rider_ninja', nombre: 'Rider Ninja', emoji: '🥷', categoria: 'rider', img: av005 },
  { id: '006_rider_cyber', nombre: 'Rider Cyber', emoji: '🤖', categoria: 'rider', img: av006 },
  { id: '007_rider_aventurero', nombre: 'Rider Aventurero', emoji: '🧭', categoria: 'rider', img: av007 },
  { id: '008_rider_legendario', nombre: 'Rider Legendario', emoji: '👑', categoria: 'rider', img: av008 },
  // ── 💻 TECNOLOGÍA (diseños propios) ──
  { id: '009_programador', nombre: 'Programador', emoji: '💻', categoria: 'tecnologia', img: av009 },
  { id: '010_programadora', nombre: 'Programadora', emoji: '👩‍💻', categoria: 'tecnologia', img: av010 },
  { id: '011_robot_ia', nombre: 'Robot IA', emoji: '🤖', categoria: 'tecnologia', img: av011 },
  { id: '012_cyborg', nombre: 'Cyborg', emoji: '🦾', categoria: 'tecnologia', img: av012 },
  { id: '013_cientifico', nombre: 'Científico', emoji: '🔬', categoria: 'tecnologia', img: av013 },
  { id: '014_ingeniero', nombre: 'Ingeniero', emoji: '⚙️', categoria: 'tecnologia', img: av014 },
  { id: '015_ia', nombre: 'IA', emoji: '🧠', categoria: 'tecnologia', img: av015 },
  { id: '016_hacker_cyber', nombre: 'Hacker Cyber', emoji: '👾', categoria: 'tecnologia', img: av016 },
  // ── 🐾 ANIMALES (diseños propios) ──
  { id: '017_lobo', nombre: 'Lobo', emoji: '🐺', categoria: 'animales', img: av017 },
  { id: '018_zorro', nombre: 'Zorro', emoji: '🦊', categoria: 'animales', img: av018 },
  { id: '019_leon', nombre: 'León', emoji: '🦁', categoria: 'animales', img: av019 },
  { id: '020_tigre', nombre: 'Tigre', emoji: '🐯', categoria: 'animales', img: av020 },
  { id: '021_aguila', nombre: 'Águila', emoji: '🦅', categoria: 'animales', img: av021 },
  { id: '022_panda', nombre: 'Panda', emoji: '🐼', categoria: 'animales', img: av022 },
  { id: '023_oso', nombre: 'Oso', emoji: '🐻', categoria: 'animales', img: av023 },
  { id: '024_gato', nombre: 'Gato', emoji: '🐱', categoria: 'animales', img: av024 },
  // ── 🎮 GAMING (diseños propios) ──
  { id: '025_gamer', nombre: 'Gamer', emoji: '🎮', categoria: 'gaming', img: av025 },
  { id: '026_ninja', nombre: 'Ninja', emoji: '🥷', categoria: 'gaming', img: av026 },
  { id: '027_guerrero', nombre: 'Guerrero', emoji: '⚔️', categoria: 'gaming', img: av027 },
  { id: '028_mecha', nombre: 'Mecha', emoji: '🦾', categoria: 'gaming', img: av028 },
  { id: '029_alien', nombre: 'Alien', emoji: '👽', categoria: 'gaming', img: av029 },
  { id: '030_hechicero', nombre: 'Hechicero', emoji: '🧙', categoria: 'gaming', img: av030 },
  { id: '031_piloto', nombre: 'Piloto', emoji: '🚀', categoria: 'gaming', img: av031 },
  { id: '032_heroe', nombre: 'Héroe', emoji: '🦸', categoria: 'gaming', img: av032 },

  // ── ⭐ CLÁSICOS (SVG de la Fase 1.5 — pestaña extra) ──
  {
    id: 'rider',
    nombre: 'Rider Pro',
    emoji: '🏍️',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-rider-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e3a8a"/>
        </linearGradient>
        <linearGradient id="av-rider-casco" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#cbd5e1"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="0" fill="url(#av-rider-bg)"/>
      <circle cx="18" cy="20" r="14" fill="#fff" opacity="0.10"/>
      <circle cx="85" cy="80" r="20" fill="#fff" opacity="0.08"/>
      <path d="M8 78 Q50 60 92 78 L92 100 L8 100 Z" fill="#0f2547" opacity="0.55"/>
      <ellipse cx="50" cy="58" rx="26" ry="24" fill="#f2b98c"/>
      <path d="M24 52 a26 24 0 0 1 52 0 l0 -2 a26 22 0 0 0 -52 0 Z" fill="#e8a97c"/>
      <path d="M22 50 Q50 18 78 50 L78 44 Q50 12 22 44 Z" fill="url(#av-rider-casco)"/>
      <path d="M22 46 Q50 16 78 46 L78 40 Q50 10 22 40 Z" fill="#3b82f6"/>
      <rect x="22" y="44" width="56" height="7" rx="3.5" fill="#e2e8f0"/>
      <circle cx="40" cy="60" r="3.4" fill="#1e293b"/>
      <circle cx="60" cy="60" r="3.4" fill="#1e293b"/>
      <circle cx="41.2" cy="58.8" r="1.1" fill="#fff"/>
      <circle cx="61.2" cy="58.8" r="1.1" fill="#fff"/>
      <path d="M42 70 Q50 76 58 70" stroke="#8a5a3b" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <ellipse cx="31" cy="66" rx="4" ry="2.6" fill="#f0a582" opacity="0.55"/>
      <ellipse cx="69" cy="66" rx="4" ry="2.6" fill="#f0a582" opacity="0.55"/>
    `,
  },
  {
    id: 'chica',
    nombre: 'Rider Chic',
    emoji: '👩‍🏍️',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-chica-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f472b6"/><stop offset="1" stop-color="#9d174d"/>
        </linearGradient>
        <linearGradient id="av-chica-casco" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fdf2f8"/><stop offset="1" stop-color="#f9a8d4"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-chica-bg)"/>
      <circle cx="82" cy="18" r="16" fill="#fff" opacity="0.12"/>
      <circle cx="15" cy="85" r="18" fill="#fff" opacity="0.08"/>
      <path d="M10 80 Q50 64 90 80 L90 100 L10 100 Z" fill="#831843" opacity="0.5"/>
      <path d="M64 38 q16 10 12 34 q-2 8 -8 10 q4 -22 -8 -38 Z" fill="#4a2c2c"/>
      <ellipse cx="50" cy="58" rx="25" ry="23" fill="#f7c9a3"/>
      <path d="M25 52 a25 23 0 0 1 50 0 l0 -3 a25 21 0 0 0 -50 0 Z" fill="#f0b489"/>
      <path d="M23 50 Q50 18 77 50 L77 43 Q50 11 23 43 Z" fill="url(#av-chica-casco)"/>
      <path d="M23 46 Q50 16 77 46 L77 40 Q50 10 23 40 Z" fill="#ec4899"/>
      <rect x="23" y="44" width="54" height="7" rx="3.5" fill="#fce7f3"/>
      <circle cx="40" cy="60" r="3.2" fill="#3b2417"/>
      <circle cx="60" cy="60" r="3.2" fill="#3b2417"/>
      <circle cx="41.1" cy="59" r="1" fill="#fff"/>
      <circle cx="61.1" cy="59" r="1" fill="#fff"/>
      <path d="M30 55 q4 -3 8 -1" stroke="#5b3a29" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M62 54 q4 -2 8 1" stroke="#5b3a29" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M43 70 Q50 75 57 70" stroke="#c2506b" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="31" cy="66" rx="4" ry="2.4" fill="#f2a98b" opacity="0.6"/>
      <ellipse cx="69" cy="66" rx="4" ry="2.4" fill="#f2a98b" opacity="0.6"/>
    `,
  },
  {
    id: 'ninja',
    nombre: 'Ninja',
    emoji: '🥷',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-ninja-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#312e81"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-ninja-bg)"/>
      <circle cx="80" cy="22" r="15" fill="#fff" opacity="0.10"/>
      <path d="M6 82 Q50 68 94 82 L94 100 L6 100 Z" fill="#1e1b4b" opacity="0.6"/>
      <ellipse cx="50" cy="57" rx="26" ry="25" fill="#eab308"/>
      <path d="M24 52 a26 25 0 0 1 52 0 l0 10 a26 25 0 0 1 -52 0 Z" fill="#27272a"/>
      <path d="M24 50 Q50 20 76 50 L76 34 Q64 22 50 22 Q36 22 24 34 Z" fill="#18181b"/>
      <rect x="22" y="47" width="56" height="8" rx="4" fill="#ef4444"/>
      <path d="M74 45 l10 -6 l-2 8 l8 2 l-10 5 Z" fill="#ef4444"/>
      <ellipse cx="50" cy="60" rx="21" ry="12" fill="#fbbf24"/>
      <circle cx="41" cy="59" r="3.6" fill="#1c1917"/>
      <circle cx="59" cy="59" r="3.6" fill="#1c1917"/>
      <circle cx="42.3" cy="57.7" r="1.2" fill="#fff"/>
      <circle cx="60.3" cy="57.7" r="1.2" fill="#fff"/>
      <path d="M42 69 Q50 74 58 69" stroke="#78350f" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    `,
  },
  {
    id: 'robot',
    nombre: 'Robot',
    emoji: '🤖',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-robot-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#0f766e"/>
        </linearGradient>
        <linearGradient id="av-robot-cabeza" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#94a3b8"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-robot-bg)"/>
      <circle cx="20" cy="80" r="16" fill="#fff" opacity="0.10"/>
      <circle cx="84" cy="18" r="10" fill="#fff" opacity="0.14"/>
      <line x1="50" y1="18" x2="50" y2="26" stroke="#94a3b8" stroke-width="3"/>
      <circle cx="50" cy="15" r="4.5" fill="#fbbf24"/>
      <circle cx="50" cy="15" r="8" fill="#fbbf24" opacity="0.3"/>
      <rect x="24" y="26" width="52" height="46" rx="12" fill="url(#av-robot-cabeza)"/>
      <rect x="30" y="34" width="40" height="22" rx="9" fill="#0f172a"/>
      <circle cx="40" cy="45" r="5" fill="#22d3ee"/>
      <circle cx="60" cy="45" r="5" fill="#22d3ee"/>
      <circle cx="40" cy="45" r="2" fill="#fff"/>
      <circle cx="60" cy="45" r="2" fill="#fff"/>
      <path d="M38 66 Q50 74 62 66" stroke="#0f172a" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <rect x="35" y="63" width="6" height="4" rx="1.5" fill="#0f172a"/>
      <rect x="59" y="63" width="6" height="4" rx="1.5" fill="#0f172a"/>
      <rect x="20" y="40" width="6" height="12" rx="3" fill="#94a3b8"/>
      <rect x="74" y="40" width="6" height="12" rx="3" fill="#94a3b8"/>
      <path d="M12 84 Q50 72 88 84 L88 100 L12 100 Z" fill="#115e59" opacity="0.55"/>
    `,
  },
  {
    id: 'gato',
    nombre: 'Michi',
    emoji: '🐱',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-gato-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#c2410c"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-gato-bg)"/>
      <circle cx="18" cy="22" r="13" fill="#fff" opacity="0.12"/>
      <circle cx="85" cy="82" r="18" fill="#fff" opacity="0.08"/>
      <path d="M8 84 Q50 70 92 84 L92 100 L8 100 Z" fill="#7c2d12" opacity="0.5"/>
      <path d="M30 34 L27 12 L46 24 Z" fill="#f59e0b"/>
      <path d="M70 34 L73 12 L54 24 Z" fill="#f59e0b"/>
      <path d="M32 32 L30.5 17 L43 25.5 Z" fill="#fb923c"/>
      <path d="M68 32 L69.5 17 L57 25.5 Z" fill="#fb923c"/>
      <ellipse cx="50" cy="56" rx="27" ry="25" fill="#fed7aa"/>
      <path d="M24 50 a27 25 0 0 1 52 0 l0 -4 a27 23 0 0 0 -52 0 Z" fill="#fdba74"/>
      <path d="M50 30 q3 6 0 10 q-3 -4 0 -10" fill="#fb923c"/>
      <path d="M46 48 q4 -3.5 8 0 q-4 3.5 -8 0" fill="#f87171"/>
      <circle cx="39" cy="54" r="3.8" fill="#1c1917"/>
      <circle cx="61" cy="54" r="3.8" fill="#1c1917"/>
      <path d="M35.5 51.5 q3.5 -2.5 7 -0.5" stroke="#7c2d12" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M57.5 51 q3.5 -2 7 0.5" stroke="#7c2d12" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M42 65 Q50 71 58 65" stroke="#9a3412" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <line x1="26" y1="60" x2="38" y2="62" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="26" y1="66" x2="38" y2="65" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="74" y1="60" x2="62" y2="62" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="74" y1="66" x2="62" y2="65" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
    `,
  },
  {
    id: 'panda',
    nombre: 'Panda',
    emoji: '🐼',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-panda-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#065f46"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-panda-bg)"/>
      <circle cx="82" cy="20" r="14" fill="#fff" opacity="0.12"/>
      <circle cx="16" cy="84" r="16" fill="#fff" opacity="0.08"/>
      <path d="M10 84 Q50 72 90 84 L90 100 L10 100 Z" fill="#064e3b" opacity="0.55"/>
      <circle cx="30" cy="30" r="12" fill="#1f2937"/>
      <circle cx="70" cy="30" r="12" fill="#1f2937"/>
      <circle cx="30" cy="30" r="6" fill="#374151"/>
      <circle cx="70" cy="30" r="6" fill="#374151"/>
      <ellipse cx="50" cy="57" rx="27" ry="25" fill="#f9fafb"/>
      <ellipse cx="38" cy="54" rx="8.5" ry="9.5" fill="#1f2937" transform="rotate(-14 38 54)"/>
      <ellipse cx="62" cy="54" rx="8.5" ry="9.5" fill="#1f2937" transform="rotate(14 62 54)"/>
      <circle cx="38" cy="54" r="3.4" fill="#fff"/>
      <circle cx="62" cy="54" r="3.4" fill="#fff"/>
      <circle cx="39" cy="54" r="1.8" fill="#111827"/>
      <circle cx="61" cy="54" r="1.8" fill="#111827"/>
      <ellipse cx="50" cy="63" rx="4.5" ry="3.2" fill="#1f2937"/>
      <path d="M50 66 L50 69" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
      <path d="M41 72 Q50 78 59 72" stroke="#1f2937" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    `,
  },
  {
    id: 'zorro',
    nombre: 'Zorro',
    emoji: '🦊',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-zorro-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#9a3412"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-zorro-bg)"/>
      <circle cx="18" cy="20" r="13" fill="#fff" opacity="0.12"/>
      <circle cx="86" cy="80" r="18" fill="#fff" opacity="0.08"/>
      <path d="M8 84 Q50 70 92 84 L92 100 L8 100 Z" fill="#7c2d12" opacity="0.5"/>
      <path d="M28 36 L24 10 L48 24 Z" fill="#c2410c"/>
      <path d="M72 36 L76 10 L52 24 Z" fill="#c2410c"/>
      <path d="M30 33 L27.5 17 L43 24.5 Z" fill="#431407"/>
      <path d="M70 33 L72.5 17 L57 24.5 Z" fill="#431407"/>
      <ellipse cx="50" cy="56" rx="26" ry="24" fill="#f97316"/>
      <ellipse cx="50" cy="64" rx="17" ry="14" fill="#fff7ed"/>
      <path d="M24 50 a26 24 0 0 1 52 0 l0 -4 a26 22 0 0 0 -52 0 Z" fill="#ea580c"/>
      <ellipse cx="50" cy="49" rx="7" ry="5" fill="#1c1917"/>
      <path d="M46.5 49 L43 47 M53.5 49 L57 47" stroke="#1c1917" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M36 55 q5 -3 9 -0.5" stroke="#431407" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M55 54.5 q4 -2.5 9 0.5" stroke="#431407" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M44 68 Q50 73 56 68" stroke="#7c2d12" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    `,
  },
  {
    id: 'astronauta',
    nombre: 'Astro',
    emoji: '👨‍🚀',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-astro-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1e40af"/><stop offset="1" stop-color="#0f172a"/>
        </linearGradient>
        <radialGradient id="av-astro-visor" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stop-color="#bae6fd"/><stop offset="0.55" stop-color="#38bdf8"/><stop offset="1" stop-color="#0369a1"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-astro-bg)"/>
      <circle cx="22" cy="18" r="1.6" fill="#fff"/><circle cx="34" cy="30" r="1.1" fill="#fff" opacity="0.8"/>
      <circle cx="78" cy="16" r="1.4" fill="#fff"/><circle cx="84" cy="38" r="1" fill="#fff" opacity="0.7"/>
      <circle cx="14" cy="52" r="1.2" fill="#fff" opacity="0.8"/><circle cx="88" cy="66" r="1.5" fill="#fff"/>
      <circle cx="50" cy="24" r="2" fill="#fde047"/>
      <path d="M10 86 Q50 74 90 86 L90 100 L10 100 Z" fill="#172554" opacity="0.7"/>
      <circle cx="50" cy="54" r="30" fill="#e2e8f0"/>
      <circle cx="50" cy="54" r="30" fill="none" stroke="#94a3b8" stroke-width="2.5"/>
      <ellipse cx="50" cy="55" rx="21" ry="19" fill="url(#av-astro-visor)"/>
      <path d="M33 47 a21 19 0 0 1 34 0 q-8 -8 -17 -8 q-9 0 -17 8 Z" fill="#fff" opacity="0.35"/>
      <circle cx="42" cy="55" r="3.2" fill="#0c4a6e"/>
      <circle cx="58" cy="55" r="3.2" fill="#0c4a6e"/>
      <circle cx="43" cy="54" r="1.1" fill="#fff"/>
      <circle cx="59" cy="54" r="1.1" fill="#fff"/>
      <path d="M43 65 Q50 70 57 65" stroke="#0c4a6e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <rect x="42" y="82" width="16" height="6" rx="3" fill="#f59e0b"/>
    `,
  },
  {
    id: 'vikingo',
    nombre: 'Vikingo',
    emoji: '🧔',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-vik-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#64748b"/><stop offset="1" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-vik-bg)"/>
      <circle cx="80" cy="24" r="14" fill="#fff" opacity="0.10"/>
      <path d="M8 84 Q50 70 92 84 L92 100 L8 100 Z" fill="#0f172a" opacity="0.6"/>
      <path d="M20 40 Q6 30 10 14 Q26 20 28 34 Z" fill="#e7e5e4"/>
      <path d="M80 40 Q94 30 90 14 Q74 20 72 34 Z" fill="#e7e5e4"/>
      <path d="M22 38 Q12 30 14 19 Q25 24 26 33 Z" fill="#d6d3d1"/>
      <path d="M78 38 Q88 30 86 19 Q75 24 74 33 Z" fill="#d6d3d1"/>
      <ellipse cx="50" cy="56" rx="26" ry="25" fill="#f2c19a"/>
      <path d="M24 46 Q50 24 76 46 L76 36 Q50 16 24 36 Z" fill="#a8a29e"/>
      <path d="M24 44 Q50 22 76 44 L76 38 Q50 18 24 38 Z" fill="#78716c"/>
      <rect x="24" y="41" width="52" height="6" rx="3" fill="#57534e"/>
      <circle cx="40" cy="56" r="3.2" fill="#1c1917"/>
      <circle cx="60" cy="56" r="3.2" fill="#1c1917"/>
      <path d="M36 52 q4 -3 8 -1" stroke="#5b3a29" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M56 51 q4 -2 8 1" stroke="#5b3a29" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M28 62 Q30 90 50 90 Q70 90 72 62 Q66 84 50 74 Q34 84 28 62 Z" fill="#92400e"/>
      <path d="M40 63 Q50 68 60 63 L58 68 Q50 72 42 68 Z" fill="#78350f"/>
      <path d="M44 66 L46 70 M56 66 L54 70" stroke="#78350f" stroke-width="1.4" stroke-linecap="round"/>
    `,
  },
  {
    id: 'dj',
    nombre: 'DJ',
    emoji: '🎧',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-dj-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e879f9"/><stop offset="1" stop-color="#6b21a8"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-dj-bg)"/>
      <circle cx="18" cy="82" r="16" fill="#fff" opacity="0.10"/>
      <circle cx="84" cy="20" r="12" fill="#fff" opacity="0.12"/>
      <path d="M8 84 Q50 72 92 84 L92 100 L8 100 Z" fill="#581c87" opacity="0.55"/>
      <path d="M20 52 a30 26 0 0 1 60 0 l0 -6 a30 24 0 0 0 -60 0 Z" fill="#18181b"/>
      <path d="M26 50 a24 20 0 0 1 48 0 l0 -4 a24 18 0 0 0 -48 0 Z" fill="#a21caf"/>
      <path d="M62 30 q10 2 12 12 q-8 -4 -12 -2 Z" fill="#18181b"/>
      <ellipse cx="50" cy="58" rx="25" ry="23" fill="#f2c19a"/>
      <path d="M25 52 a25 23 0 0 1 50 0 l0 -3 a25 21 0 0 0 -50 0 Z" fill="#e8a97c"/>
      <rect x="30" y="50" width="40" height="11" rx="5.5" fill="#18181b"/>
      <rect x="33" y="52.5" width="34" height="6" rx="3" fill="#e879f9" opacity="0.85"/>
      <path d="M33 52.5 l34 6 l0 -6 Z" fill="#f0abfc" opacity="0.6"/>
      <path d="M42 70 Q50 75 58 70" stroke="#8a5a3b" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M18 50 a30 26 0 0 1 13 -20 l3 5 a25 21 0 0 0 -11 16 Z" fill="#f59e0b"/>
      <path d="M82 50 a30 26 0 0 0 -13 -20 l-3 5 a25 21 0 0 1 11 16 Z" fill="#f59e0b"/>
      <circle cx="19" cy="54" r="7.5" fill="#18181b"/>
      <circle cx="81" cy="54" r="7.5" fill="#18181b"/>
      <circle cx="19" cy="54" r="3.5" fill="#f59e0b"/>
      <circle cx="81" cy="54" r="3.5" fill="#f59e0b"/>
    `,
  },
  {
    id: 'chef',
    nombre: 'Chef',
    emoji: '👨‍🍳',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-chef-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f87171"/><stop offset="1" stop-color="#991b1b"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-chef-bg)"/>
      <circle cx="80" cy="24" r="14" fill="#fff" opacity="0.10"/>
      <path d="M8 86 Q50 74 92 86 L92 100 L8 100 Z" fill="#7f1d1d" opacity="0.55"/>
      <ellipse cx="50" cy="58" rx="25" ry="23" fill="#f2c19a"/>
      <path d="M25 52 a25 23 0 0 1 50 0 l0 -3 a25 21 0 0 0 -50 0 Z" fill="#e8a97c"/>
      <path d="M30 30 a10 10 0 0 1 20 0 a10 10 0 0 1 10 -6 a9 9 0 0 1 10 9 l0 12 l-40 0 l0 -12 a9 9 0 0 1 0 -13 Z" fill="#fff"/>
      <ellipse cx="50" cy="42" rx="21" ry="5" fill="#e7e5e4"/>
      <circle cx="40" cy="58" r="3.2" fill="#1c1917"/>
      <circle cx="60" cy="58" r="3.2" fill="#1c1917"/>
      <path d="M36 54 q4 -3 8 -1" stroke="#5b3a29" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M56 53 q4 -2 8 1" stroke="#5b3a29" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M34 68 Q38 74 42 68 Q46 74 50 68 Q54 74 58 68 Q62 74 66 68" stroke="#78350f" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M43 78 Q50 83 57 78" stroke="#8a5a3b" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M62 50 l14 10 l-4 3 l-12 -11 Z" fill="#e7e5e4"/>
    `,
  },
  {
    id: 'heroe',
    nombre: 'Héroe',
    emoji: '🦸',
    categoria: 'clasicos',
    svg: `
      <defs>
        <linearGradient id="av-heroe-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#b91c1c"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#av-heroe-bg)"/>
      <circle cx="18" cy="20" r="13" fill="#fff" opacity="0.12"/>
      <circle cx="85" cy="80" r="18" fill="#fff" opacity="0.08"/>
      <path d="M6 80 L14 68 L18 76 L26 62 L34 78 L42 66 L50 80 L58 66 L66 78 L74 62 L82 76 L86 68 L94 80 L94 100 L6 100 Z" fill="#7f1d1d" opacity="0.5"/>
      <ellipse cx="50" cy="57" rx="25" ry="24" fill="#f2c19a"/>
      <path d="M25 50 Q28 22 50 22 Q72 22 75 50 L75 38 Q66 24 50 24 Q34 24 25 38 Z" fill="#1c1917"/>
      <path d="M46 24 q4 -8 8 -1 q-4 3 -8 1" fill="#1c1917"/>
      <path d="M28 44 Q38 34 47 41 L47 52 Q37 50 28 44 Z" fill="#b91c1c"/>
      <path d="M72 44 Q62 34 53 41 L53 52 Q63 50 72 44 Z" fill="#b91c1c"/>
      <circle cx="38" cy="46" r="3" fill="#1c1917"/>
      <circle cx="62" cy="46" r="3" fill="#1c1917"/>
      <path d="M36 43 q3 -2.5 6 -1" stroke="#450a0a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M58 42 q3 -1.5 6 1" stroke="#450a0a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M40 68 Q50 74 60 68" stroke="#8a5a3b" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M44 68 L46 71 M56 68 L54 71" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
    `,
  },
];

/** avatar por defecto: el primer diseño propio */
export const AVATAR_DEFAULT = '001_rider_urbano';

export function avatarPorId(id?: string): AvatarDef {
  return AVATARES.find((a) => a.id === id) || AVATARES[0];
}

/** categoría de un avatar por id (para abrir el picker en la pestaña correcta) */
export function categoriaDeAvatar(id?: string): CategoriaAvatar {
  return avatarPorId(id).categoria;
}

/** degradado de fondo de la categoría (para tarjetas con imagen) */
export function fondoDeCategoria(cat: CategoriaAvatar): string {
  return CATEGORIAS.find((c) => c.id === cat)?.fondo || 'from-slate-600 to-slate-900';
}

/** ¿es uno de los avatares de la galería? (si no, es una foto/URL externa) */
export function esAvatarValido(id?: string | null): boolean {
  return !!id && AVATARES.some((a) => a.id === id);
}

interface AvatarSvgProps {
  id?: string;
  className?: string;
  /** anillo de color alrededor (ej: 'ring-2 ring-blue-500/50') */
  anillo?: string;
}

/**
 * Renderiza el avatar: ilustración WebP (diseños propios) o SVG
 * clásico. Si el id no existe, cae al primer diseño propio.
 */
export const AvatarSvg: React.FC<AvatarSvgProps> = ({ id, className = 'w-10 h-10', anillo }) => {
  const av = avatarPorId(id);
  if (av.img) {
    return (
      <div
        className={`${className} rounded-2xl overflow-hidden shrink-0 bg-gradient-to-br ${fondoDeCategoria(
          av.categoria
        )} ${anillo || ''}`}
      >
        <img
          src={av.img}
          alt={av.nombre}
          title={av.nombre}
          draggable={false}
          className="w-full h-full object-contain block select-none"
        />
      </div>
    );
  }
  return (
    <div className={`${className} rounded-2xl overflow-hidden shrink-0 bg-slate-800 ${anillo || ''}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full block" role="img" aria-label="Avatar">
        <g dangerouslySetInnerHTML={{ __html: av.svg || '' }} />
      </svg>
    </div>
  );
};
