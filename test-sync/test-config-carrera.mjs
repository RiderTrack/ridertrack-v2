// ─────────────────────────────────────────────────────────────
// 🧪 TEST — v0.11.11 FASE AL: LA CARRERA CORTA DEL MI QR
//
// Compila el services/firestore.ts REAL con esbuild + stubs. Prueba:
//   C1. caché tibia + servidor MÁS NUEVO (actualizadoEn) → evento
//       'config-empresa:refrescada' con la config nueva + fuente
//       'servidor' (antes: la caché quedaba vieja PARA SIEMPRE)
//   C2. servidor IGUAL/VIEJO → NADA (no pisa, no molesta)
//   C3. el getDoc del fondo falla → silencio absoluto
//   C4. caché fría (getDocFromCache tira) → flujo de siempre: va al
//       servidor directo y NADA corre por detrás
//   C5. LIMITES_CONFIG.frescuraMs existe (documentado)
//   C6. actualizadoEn con formatos MIXTOS (Timestamp en caché vs ISO
//       en servidor) → la comparación funciona igual
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const STUB_FS = path.join(REPO, 'test-sync', 'stub-config-fx.cjs');
const STUB_APP = path.join(REPO, 'test-sync', 'stub-firebase-app.cjs');
const STUB_STORAGE = path.join(REPO, 'test-sync', 'stub-storage.cjs');
const STUB_XLSX = path.join(REPO, 'test-sync', 'stub-xlsx.cjs');
const OUT = path.join(REPO, 'test-sync', 'firestore-carrera-eb.cjs');

const stubPlugin = {
  name: 'stubs-config-carrera',
  setup(build) {
    build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: STUB_FS }));
    build.onResolve({ filter: /^\.\/firebase$/ }, () => ({ path: STUB_APP }));
    build.onResolve({ filter: /^firebase\/storage$/ }, () => ({ path: STUB_STORAGE }));
    build.onResolve({ filter: /^xlsx$/ }, () => ({ path: STUB_XLSX }));
  },
};

await esbuild.build({
  entryPoints: [path.join(REPO, 'src/services/firestore.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  plugins: [stubPlugin],
  logLevel: 'silent',
});
console.log('✓ services/firestore.ts REAL compilado con stubs (carrera corta)');

// window mock ANTES de usar el servicio (el refresco dispara el evento acá)
const eventos = [];
globalThis.window = {
  dispatchEvent: (e) => { eventos.push(e); },
  addEventListener: () => {},
  removeEventListener: () => {},
};

const requireLocal = createRequire(import.meta.url);
const fsMod = requireLocal(OUT);
const { cargarConfigCuentas, estadoCargaConfig, LIMITES_CONFIG } = fsMod;
const T = globalThis.__CFG_T__;

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log('  ✓ ' + n); };
const mal = (n, extra) => { fail++; console.log('  ✗ ' + n + (extra ? ' — ' + extra : '')); };
const seccion = (n) => console.log('\n── ' + n + ' ──');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarEventoDesde(cantAntes, topeMs = 600) {
  const t0 = Date.now();
  while (Date.now() - t0 < topeMs) {
    if (eventos.length > cantAntes) return eventos[eventos.length - 1];
    await esperar(15);
  }
  return null;
}

// ═══ C1: servidor MÁS NUEVO → evento con la config nueva ═══
seccion('C1 · caché tibia + servidor más nuevo → refresca solo');
eventos.length = 0;
T.getDocFromCache = { modo: 'ok', data: { yape: { numero: '111' }, actualizadoEn: '2026-10-20T10:00:00Z' } };
T.getDoc = { modo: 'ok', fallos: 0, data: { yape: { numero: '999999999' }, actualizadoEn: '2026-10-21T18:39:00Z' } };
try {
  const antes = eventos.length;
  const cfg = await cargarConfigCuentas('u1');
  if (cfg.yape.numero === '111') ok('devuelve la CACHÉ al instante (111)');
  else mal('debía devolver la caché primero', `numero=${cfg.yape.numero}`);
  const evt = await esperarEventoDesde(antes);
  if (evt && evt.type === 'config-empresa:refrescada' && evt.detail?.yape?.numero === '999999999') {
    ok('evento con la config NUEVA (999999999)');
    if (estadoCargaConfig.fuente === 'servidor') ok('estadoCargaConfig pasa a servidor');
    else mal('fuente no se actualizó', estadoCargaConfig.fuente);
  } else {
    mal('no llegó el evento de refresco', evt ? evt.type : 'ninguno');
  }
} catch (e) { mal('explotó', e.message); }

// ═══ C2: servidor IGUAL/VIEJO → NADA ═══
seccion('C2 · servidor igual/viejo → no pisa');
eventos.length = 0;
T.getDocFromCache = { modo: 'ok', data: { yape: { numero: '222' }, actualizadoEn: '2026-10-21T20:00:00Z' } };
T.getDoc = { modo: 'ok', fallos: 0, data: { yape: { numero: '333' }, actualizadoEn: '2026-10-21T18:00:00Z' } };
try {
  const antes = eventos.length;
  await cargarConfigCuentas('u1');
  const evt = await esperarEventoDesde(antes, 350);
  if (!evt) ok('ningún evento (la caché es más nueva — no se deja pisar)');
  else mal('no debía refrescar', evt.detail?.yape?.numero);
} catch (e) { mal('explotó', e.message); }

// ═══ C3: el getDoc del fondo FALLA → silencio ═══
seccion('C3 · red muerta en el refresco → silencio');
eventos.length = 0;
T.getDocFromCache = { modo: 'ok', data: { yape: { numero: '444' }, actualizadoEn: '2026-10-20T10:00:00Z' } };
T.getDoc = { modo: 'fallo-n', fallos: 999, data: {} };
try {
  const antes = eventos.length;
  const cfg = await cargarConfigCuentas('u1');
  const evt = await esperarEventoDesde(antes, 350);
  if (!evt && cfg.yape.numero === '444') ok('sin evento y la caché sigue sirviendo (444)');
  else mal('el fallo del fondo no fue silencioso', evt ? 'evento inesperado' : 'config rara');
} catch (e) { mal('explotó', e.message); }

// ═══ C4: caché FRÍA → flujo de siempre (servidor directo) ═══
seccion('C4 · caché fría → servidor directo, sin carrera');
eventos.length = 0;
T.getDocFromCache = null; // tira → como siempre
T.getDoc = { modo: 'ok', fallos: 0, data: { yape: { numero: '555' }, actualizadoEn: '2026-10-21T18:00:00Z' } };
try {
  const antes = eventos.length;
  const cfg = await cargarConfigCuentas('u1');
  const evt = await esperarEventoDesde(antes, 350);
  if (cfg.yape.numero === '555' && estadoCargaConfig.fuente === 'servidor' && !evt) {
    ok('caché fría: servidor directo (555), sin evento de fondo');
  } else {
    mal('flujo frío roto', `numero=${cfg.yape.numero} fuente=${estadoCargaConfig.fuente} evt=${!!evt}`);
  }
} catch (e) { mal('explotó', e.message); }

// ═══ C5: LIMITES_CONFIG.frescuraMs ═══
seccion('C5 · LIMITES_CONFIG documentado');
if (typeof LIMITES_CONFIG.frescuraMs === 'number' && LIMITES_CONFIG.frescuraMs === 8000) {
  ok('frescuraMs = 8000');
} else {
  mal('frescuraMs raro', String(LIMITES_CONFIG.frescuraMs));
}

// ═══ C6: formatos MIXTOS de actualizadoEn ═══
seccion('C6 · Timestamp (caché) vs ISO (servidor)');
eventos.length = 0;
T.getDocFromCache = { modo: 'ok', data: { yape: { numero: '666' }, actualizadoEn: { toDate: () => new Date('2026-10-20T10:00:00Z') } } };
T.getDoc = { modo: 'ok', fallos: 0, data: { yape: { numero: '777' }, actualizadoEn: '2026-10-21T19:00:00Z' } };
try {
  const antes = eventos.length;
  await cargarConfigCuentas('u1');
  const evt = await esperarEventoDesde(antes);
  if (evt && evt.detail?.yape?.numero === '777') ok('Timestamp viejo < ISO nuevo → refrescó (777)');
  else mal('formatos mixtos no compararon', evt ? 'detalle raro' : 'sin evento');
} catch (e) { mal('explotó', e.message); }

console.log('');
console.log(`RESULTADO: ${pass} ✓ / ${fail} ✗`);
process.exit(fail === 0 ? 0 : 1);
