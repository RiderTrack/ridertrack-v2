// ─────────────────────────────────────────────────────────────
// 🧪 TEST — v0.11.26 FASE AZ: EL GRACIAS YA NO SE ADELANTA +
//    LA SUBIDA NUNCA MÁS SE CUELGA
//
// Compila el services/firestore.ts REAL con esbuild + stubs (mismo
// patrón de test-fase-ay) y prueba:
//
//   Z1.  la subida va por la vía RESUMABLE (con .cancel) — ya no
//        uploadBytes a ciegas; happy path sube y devuelve URL
//   Z2.  red ZOMBI (la subida cuelga): el tope CANCELA de verdad el
//        intento trabado y REINTENTA una vez — si la 2ª sale, todo
//        bien (2 tareas, la 1ª cancelada)
//   Z3.  red zombi SIEMPRE: 2 intentos cancelados → error HONESTO
//        («se trabó») en segundos, NO 15 minutos colgado
//   Z4.  storage/unauthorized (definitivo) → NO reintenta (1 intento)
//   Z5.  error de red común → reintenta y la 2ª sale (2 intentos)
//   Z6.  encolarAccionBot ok → retorna 'servidor'
//   Z7.  encolarAccionBot con la red trabada (setDoc colgado) →
//        retorna 'local' (optimista, SIN reintentar — reintentar
//        duplicaría el mensaje) y NO revienta
//   Z8.  encolarAccionBot con permission-denied → REVIENTA (los
//        callers tienen try/catch con toast)
//   Z9.  contrato de fuente RutaView: las 2 llamadas del modal de
//        foto llevan sinGracias:true, el botón clásico de pago NO,
//        enviarAccionBot devuelve la fuente y el toast honesto existe
//   Z10. contrato de fuente useClientes: firma con opts.sinGracias y
//        la rama { dispara: false } (no marca graciasEnviado)
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const STUB_FS = path.join(REPO, 'test-sync', 'stub-config-fx.cjs');
const STUB_APP = path.join(REPO, 'test-sync', 'stub-firebase-app.cjs');
const STUB_STORAGE = path.join(REPO, 'test-sync', 'stub-storage-ay.cjs');
const STUB_XLSX = path.join(REPO, 'test-sync', 'stub-xlsx.cjs');
const OUT = path.join(REPO, 'test-sync', 'firestore-az-eb.cjs');

const stubPlugin = {
  name: 'stubs-fase-az',
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
console.log('✓ services/firestore.ts REAL compilado con stubs (fase AZ)');

// ── fakes DOM para la compresión (mismo molde del test AY) ──
const CANVAS = (globalThis.__CANVAS_AY__ ||= {
  imgW: 4000, imgH: 3000,
  toBlobModo: 'chico',
  ultimoW: 0, ultimoH: 0,
  toBlobLlamadas: 0,
});
const blobChico = new Blob([new Uint8Array(120 * 1024)], { type: 'image/jpeg' });

globalThis.URL.createObjectURL = () => 'blob:falso';
globalThis.URL.revokeObjectURL = () => {};
globalThis.Image = class {
  constructor() { this.width = CANVAS.imgW; this.height = CANVAS.imgH; }
  set src(_v) { setTimeout(() => this.onload(), 1); }
};
globalThis.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ drawImage: () => {} }),
    toBlob: function (cb) {
      CANVAS.toBlobLlamadas++;
      setTimeout(() => cb(CANVAS.toBlobModo === 'chico' ? blobChico : CANVAS.toBlobModo === 'null' ? null : blobChico), 1);
    },
  }),
};

const UP = globalThis.__UPLOAD_T__ || (globalThis.__UPLOAD_T__ = {
  uploadBytes: { modo: 'ok', fallos: 0, delayMs: 0, llamadas: 0 },
  getDownloadURL: { modo: 'ok', llamadas: 0 },
  __subidas: [],
});
const CFG = globalThis.__CFG_T__ || (globalThis.__CFG_T__ = {
  getDoc: { modo: 'ok', fallos: 0, data: {} },
  setDoc: { modo: 'ok', fallos: 0 },
  getDocFromCache: null,
});

const { subirFotoPago, encolarAccionBot, LIMITES_SUBIDA, LIMITES_ACCIONES } = require2(OUT);

let pass = 0, fail = 0;
function check(nombre, cond, extra = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${nombre}${cond ? '' : ' → ' + extra}`);
  cond ? pass++ : fail++;
}

const fotoCruda = new File([new Uint8Array(2 * 1024 * 1024)], 'comprobante.jpg', { type: 'image/jpeg' });

function resetUpload(modo = 'ok', fallos = 0) {
  UP.__subidas.length = 0;
  UP.uploadBytes = { modo, fallos, delayMs: 0, llamadas: 0 };
  UP.getDownloadURL = { modo: 'ok', llamadas: 0 };
  CANVAS.toBlobModo = 'chico';
}
function resetFs(setDocModo = 'ok') {
  CFG.getDoc = { modo: 'ok', fallos: 0, data: {} };
  CFG.setDoc = { modo: setDocModo, fallos: 0, llamadas: 0 };
}

// topes acelerados para el test (los de producción viven en LIMITES_*)
const TOPE_BASE_ORIG = LIMITES_SUBIDA.baseMs, MSPORKB_ORIG = LIMITES_SUBIDA.msPorKb,
  REINTENTO_ORIG = LIMITES_SUBIDA.reintentoMs, TOPE_ACCION_ORIG = LIMITES_ACCIONES.topeMs;
LIMITES_SUBIDA.baseMs = 40; LIMITES_SUBIDA.msPorKb = 0; LIMITES_SUBIDA.reintentoMs = 10;
LIMITES_ACCIONES.topeMs = 40;

const accionBase = {
  tipo: 'enviar_foto_grupo_mate', clienteId: 'cli-1', telefono: '51987654321',
  nombre: 'Cliente Test', prod: 'Producto', cobrar: 25, dir: 'Calle 1', dist: 'Cercado',
};

// ── Z1: happy path por la vía resumable ─────────────────────
resetUpload('ok');
let url = await subirFotoPago('uid-az', 'cli-1', fotoCruda);
check('Z1a la foto sube por uploadBytesResumable y devuelve la URL de pagos/{uid}',
  String(url).includes('firebasestorage.test') && String(url).includes(encodeURIComponent('pagos/uid-az/')), url);
check('Z1b UNA sola tarea en el happy path (sin reintentos innecesarios)',
  UP.__subidas.length === 1, `tareas: ${UP.__subidas.length}`);
check('Z1c sube el blob COMPRIMIDO (120KB, no los 2MB crudos)',
  UP.__subidas[0]?.file === blobChico, UP.__subidas[0] ? `${Math.round(UP.__subidas[0].file.size / 1024)}KB` : 'nada');

// ── Z2: red zombi → cancela + reintenta y la 2ª sale ────────
resetUpload('zombi-n', 1); // 1er intento cuelga, 2do sale
const t0 = Date.now();
let salio2 = false;
try {
  url = await subirFotoPago('uid-az', 'cli-2', fotoCruda);
  salio2 = String(url).includes('firebasestorage.test');
} catch { salio2 = false; }
check('Z2 red trabada en el 1er intento → CANCELA + reintenta y la 2ª sale',
  salio2 && UP.__subidas.length === 2,
  `salió: ${salio2} · tareas: ${UP.__subidas.length}`);
check('Z2b todo el ciclo en milisegundos, no minutos', Date.now() - t0 < 5000, `${Date.now() - t0}ms`);

// ── Z3: red zombi SIEMPRE → error honesto, 2 intentos ───────
resetUpload('nunca');
let errorZ3 = '';
try { await subirFotoPago('uid-az', 'cli-3', fotoCruda); }
catch (e) { errorZ3 = String(e.message || e); }
check('Z3a dos intentos trabados → 2 tareas creadas y NADA colgado',
  UP.__subidas.length === 2, `tareas: ${UP.__subidas.length}`);
check('Z3b error HONESTO con la palabra clave («trabó») para el toast',
  /trab/i.test(errorZ3), errorZ3);

// ── Z4: error definitivo NO se reintenta ────────────────────
resetUpload('permiso');
let errorZ4 = '';
try { await subirFotoPago('uid-az', 'cli-4', fotoCruda); }
catch (e) { errorZ4 = String(e.message || e); }
check('Z4 storage/unauthorized → 1 solo intento (definitivo, sin reintento)',
  UP.__subidas.length === 1 && /unauthorized/i.test(errorZ4),
  `tareas: ${UP.__subidas.length} · ${errorZ4}`);

// ── Z5: error de red común → reintenta y sale ───────────────
resetUpload('fallo-n', 1);
let salio5 = false;
try { url = await subirFotoPago('uid-az', 'cli-5', fotoCruda); salio5 = String(url).includes('firebasestorage.test'); }
catch { salio5 = false; }
check('Z5 error de red en el 1er intento → reintenta y la 2ª sale',
  salio5 && UP.__subidas.length === 2, `salió: ${salio5} · tareas: ${UP.__subidas.length}`);

// ── Z6: encolarAccionBot ok → 'servidor' ────────────────────
resetFs('ok');
let f6 = await encolarAccionBot('uid-az', { ...accionBase });
check('Z6 acción encolada normal → retorna \'servidor\'', f6 === 'servidor', `retornó: ${f6}`);

// ── Z7: encolarAccionBot colgado → 'local' optimista ────────
resetFs('nunca');
let f7 = 'no-definido', t7 = Date.now();
try { f7 = await encolarAccionBot('uid-az', { ...accionBase }); }
catch (e) { f7 = 'THREW:' + e.message; }
check('Z7a setDoc colgado → a los 40ms declara \'local\' (optimista, JAMÁS 15 min)',
  f7 === 'local' && Date.now() - t7 < 3000, `retornó: ${f7} en ${Date.now() - t7}ms`);
check('Z7b sin reintento (un solo setDoc — reintentar duplicaría el mensaje)',
  (CFG.setDoc.llamadas || 0) === 1, `setDocs: ${CFG.setDoc.llamadas}`);

// ── Z8: permission-denied → REVIENTA ────────────────────────
resetFs('permiso');
let revento8 = false;
try { await encolarAccionBot('uid-az', { ...accionBase }); }
catch { revento8 = true; }
check('Z8 permission-denied → el error REVIENTA (el caller lo toastea)', revento8);

// ── Z9: contrato de fuente RutaView ─────────────────────────
const rv = readFileSync(path.join(REPO, 'src/components/RutaView.tsx'), 'utf8');
check('Z9a modal foto tipo entregado → cambiarEstado con sinGracias:true',
  /cambiarEstado\(c\.id, 'efectivo', \{ sinGracias: true \}\)/.test(rv));
check('Z9b modal foto tipo comprobante → cambiarEstado con sinGracias:true',
  /cambiarEstado\(c\.id, estadoMap\[pagoFotoMetodo\] \|\| 'efectivo', \{ sinGracias: true \}\)/.test(rv));
check('Z9c el botón CLÁSICO de pago sigue SIN sinGracias (ahí el gracias SÍ sale)',
  /onClick=\{\(\) => \{\s*cambiarEstado\(c\.id, id\);\s*sonarPago\(\)/.test(rv.replace(/\n/g, ' ').replace(/\s+/g, ' ')));
check('Z9d enviarAccionBot devuelve la fuente (servidor|local)',
  /Promise<'servidor' \| 'local'>/.test(rv));
check('Z9e toast honesto cuando la acción quedó pendiente',
  /Quedó pendiente/.test(rv));
check('Z9f captura la fuente de la acción del modal',
  /const fuenteAccion = await enviarAccionBot/.test(rv));

// ── Z10: contrato de fuente useClientes ─────────────────────
const uc = readFileSync(path.join(REPO, 'src/hooks/useClientes.ts'), 'utf8');
check('Z10a cambiarEstado acepta opts.sinGracias',
  /opts\?: \{ sinGracias\?: boolean \}/.test(uc));
check('Z10b con sinGracias la decisión es { dispara: false } (no encola aviso NI marca graciasEnviado)',
  /opts\?\.sinGracias\s*\?\s*\{ dispara: false \}/.test(uc));
check('Z10c el disparo clásico (decidirGracias) sigue intacto para los botones de pago',
  /: decidirGracias\(/.test(uc));

// ── restaurar topes de producción por si otro test usa el módulo ──
LIMITES_SUBIDA.baseMs = TOPE_BASE_ORIG; LIMITES_SUBIDA.msPorKb = MSPORKB_ORIG;
LIMITES_SUBIDA.reintentoMs = REINTENTO_ORIG; LIMITES_ACCIONES.topeMs = TOPE_ACCION_ORIG;

console.log(`\n═══ FASE AZ (gracias no adelantado + subida blindada): ${pass} ✓ · ${fail} ✗ ═══`);
process.exit(fail > 0 ? 1 : 0);
