// ═══════════════════════════════════════════════════════════
// 🌗 DriverTrack — Tema claro/oscuro (F-ID2.3)
// La app nació oscura. El modo claro se logra remapeando las
// variables de color de Tailwind 4 bajo la clase html.light
// (ver index.css) — así no hay que tocar ni una clase por
// componente. La preferencia vive en el teléfono, como todo.
// ═══════════════════════════════════════════════════════════

export type Tema = 'claro' | 'oscuro';

const K_TEMA = 'dt_tema_v1';

export function cargarTema(): Tema {
  try {
    return localStorage.getItem(K_TEMA) === 'claro' ? 'claro' : 'oscuro';
  } catch {
    return 'oscuro';
  }
}

export function guardarTema(t: Tema): void {
  try {
    localStorage.setItem(K_TEMA, t);
  } catch {
    /* almacenamiento lleno/bloqueado: la app sigue andando */
  }
}

export function aplicarTema(t: Tema): void {
  document.documentElement.classList.toggle('light', t === 'claro');
  // El color de la barra del sistema/navegador acompaña el tema
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'claro' ? '#F1F5F9' : '#0F172A');
}
