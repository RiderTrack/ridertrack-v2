// ─────────────────────────────────────────────────────────────
// 🧪 TEST — v0.11.24 FASE AY: COMPROBANTES AL VUELO + DESTINO ÚNICO
//
// Compila el services/firestore.ts REAL con esbuild + stubs (mismo
// patrón de test-config-honesta) y prueba:
//
//   F1. foto PESADA (2 MB) → subirFotoPago COMPRIME antes de subir:
//       uploadBytes recibe el blob chico (toBlob), NO la cruda
//   F2. el canvas re-dimensiona: 4000x3000 → máx 1280 px de lado
//   F3. toBlob devuelve null (compresión caída) → sube la ORIGINAL
//       (el flujo NUNCA se rompe, solo vuelve a ser lento)
//   F4. imagen rota (img.onerror) → sube la ORIGINAL igual
//   F5. blob comprimido MÁS PESADO que la original → usa la original
//   F6. subirFotoEntrega (evidencias) TAMBIÉN comprime
//   F7. la URL que devuelve apunta a la ruta pagos/{uid}/…
//   F8. contrato de fuente RutaView.tsx: la acción lleva enviarMate,
//       el botón se bloquea con los dos destinos apagados y las dos
//       palancas existen (toggle-foto-mate / toggle-foto-cliente)
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
const STUB_STORAGE = path.join(REPO, "test-sync", "stub-storage-ay.cjs");
const STUB_XLSX = path.join(REPO, 'test-sync', 'stub-xlsx.cjs');
const OUT = path.join(REPO, 'test-sync', 'firestore-ay-eb.cjs');

const stubPlugin = {
  name: 'stubs-fase-ay',
  setup(build) {
    build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: STUB_FS }));
    build.onResolve({ filter: /^\.\/firebase$/ }, () => ({ path: STUB_APP }));
    // firebase/storage → stub GRABADOR propio (registra cada uploadBytes
    // en __UPLOAD_T__ con el file REAL que viajó, con el nombre `ref`
    // que usa firestore.ts)
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
console.log('✓ services/firestore.ts REAL compilado con stubs (fase AY)');

// ── fakes DOM para la compresión ─────────────────────────────
// El canvas es configurable: dimensiones que "ve" la imagen y qué
// devuelve toBlob (blob chico / null / blob inflado).
const CANVAS = (globalThis.__CANVAS_AY__ ||= {
  imgW: 4000, imgH: 3000,           // lo que "pesa" la imagen original
  toBlobModo: 'chico',              // 'chico' | 'null' | 'inflado'
  ultimoW: 0, ultimoH: 0,           // dimensiones del canvas recibidas
  toBlobLlamadas: 0,
});
const blobChico = new Blob([new Uint8Array(120 * 1024)], { type: 'image/jpeg' }); // 120 KB
const blobInflado = new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/jpeg' }); // 3 MB

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
    toBlob: function (cb, mime, calidad) {
      CANVAS.toBlobLlamadas++;
      CANVAS.ultimoW = this.width;
      CANVAS.ultimoH = this.height;
      CANVAS.ultimoMime = mime;
      CANVAS.ultimoCalidad = calidad;
      const b = CANVAS.toBlobModo === 'chico' ? blobChico
        : CANVAS.toBlobModo === 'inflado' ? blobInflado
        : null;
      setTimeout(() => cb(b), 1);
    },
  }),
};

// pre-creamos el controlador ANTES de que el stub lo tome (patrón AK)
const UP = globalThis.__UPLOAD_T__ || (globalThis.__UPLOAD_T__ = {
  uploadBytes: { modo: 'ok', fallos: 0, delayMs: 0, llamadas: 0 },
  getDownloadURL: { modo: 'ok', llamadas: 0 },
  __subidas: [],
});
const { subirFotoPago, subirFotoEntrega } = require2(OUT);

let pass = 0, fail = 0;
function check(nombre, cond, extra = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${nombre}${cond ? '' : ' → ' + extra}`);
  cond ? pass++ : fail++;
}

function reset(toBlobModo = 'chico') {
  UP.__subidas.length = 0;
  UP.uploadBytes = { modo: 'ok', fallos: 0, delayMs: 0, llamadas: 0 };
  UP.getDownloadURL = { modo: 'ok', llamadas: 0 };
  CANVAS.toBlobModo = toBlobModo;
  CANVAS.toBlobLlamadas = 0;
  CANVAS.ultimoW = 0; CANVAS.ultimoH = 0;
}

const fotoCruda = new File([new Uint8Array(2 * 1024 * 1024)], 'comprobante.jpg', { type: 'image/jpeg' }); // 2 MB

// ── F1: la pesada se comprime antes de subir ────────────────
reset('chico');
let url = await subirFotoPago('uid-ay', 'cli-1', fotoCruda);
check('F1a subirFotoPago con foto de 2MB sube el blob COMPRIMIDO (120KB, no los 2MB)',
  UP.__subidas.length === 1 && UP.__subidas[0].file === blobChico,
  UP.__subidas.length === 1 ? `subió ${UP.__subidas[0].file.size / 1024}KB` : 'no subió nada');
check('F1b sube con contentType image/jpeg', UP.__subidas[0]?.opts?.contentType === 'image/jpeg');

// ── F2: re-dimensiona a máx 1280 ────────────────────────────
check('F2 canvas re-dimensiona 4000x3000 → 1280x960 (máx 1280 px de lado)',
  CANVAS.ultimoW === 1280 && CANVAS.ultimoH === 960, `${CANVAS.ultimoW}x${CANVAS.ultimoH}`);
check('F2b codifica JPEG con calidad 0.72', CANVAS.ultimoMime === 'image/jpeg' && Math.abs(CANVAS.ultimoCalidad - 0.72) < 0.001);

// ── F3: toBlob null → sube la ORIGINAL (nunca se rompe) ─────
reset('null');
url = await subirFotoPago('uid-ay', 'cli-2', fotoCruda);
check('F3 compresión caída (toBlob null) → sube la ORIGINAL sin romperse',
  UP.__subidas.length === 1 && UP.__subidas[0].file === fotoCruda);

// ── F4: imagen rota → sube la original ──────────────────────
reset('chico');
const ImageRota = globalThis.Image;
globalThis.Image = class { set src(_v) { setTimeout(() => this.onerror(), 1); } };
url = await subirFotoPago('uid-ay', 'cli-3', fotoCruda);
check('F4 imagen ilegible (onerror) → sube la ORIGINAL',
  UP.__subidas.length === 1 && UP.__subidas[0].file === fotoCruda);
globalThis.Image = ImageRota;

// ── F5: comprimida más pesada → gana la original ────────────
reset('inflado');
url = await subirFotoPago('uid-ay', 'cli-4', fotoCruda);
check('F5 blob comprimido MÁS pesado que la original (3MB vs 2MB) → usa la original',
  UP.__subidas.length === 1 && UP.__subidas[0].file === fotoCruda);

// ── F6: subirFotoEntrega también comprime ───────────────────
reset('chico');
await subirFotoEntrega('uid-ay', 'cli-5', fotoCruda, 'data:image/jpeg;base64,AAAA');
check('F6 subirFotoEntrega TAMBIÉN comprime antes de subir (blob chico)',
  UP.__subidas.length === 1 && UP.__subidas[0].file === blobChico);

// ── F7: la URL apunta a la ruta correcta ────────────────────
reset('chico');
url = await subirFotoPago('uid-ay', 'cli-6', fotoCruda);
check('F7 la URL devuelta apunta a pagos/{uid}/… (Storage de verdad)',
  String(url).includes('firebasestorage.test') && String(url).includes(encodeURIComponent('pagos/uid-ay/')),
  url);

// ── F8: contrato de fuente del modal (destino único) ────────
const fuente = readFileSync(path.join(REPO, 'src/components/RutaView.tsx'), 'utf8');
check('F8a la acción viaja con enviarMate (el bot v3.11 lo respeta)',
  /enviarMate:\s*aMate/.test(fuente));
check('F8b el botón se bloquea con los DOS destinos apagados',
  /disabled=\{pagoFotoSubiendo \|\| !pagoFotoArchivo \|\| \(!aMate && !aCliente\)\}/.test(fuente));
check('F8c palanca MATE con data-testid toggle-foto-mate',
  /data-testid="toggle-foto-mate"/.test(fuente));
check('F8d palanca Cliente sigue con data-testid toggle-foto-cliente',
  /data-testid="toggle-foto-cliente"/.test(fuente));
check('F8e aviso cuando no hay destino prendido',
  /Prendé al menos un destino/.test(fuente));

console.log(`\n═══ FASE AY (comprobantes al vuelo + destino único): ${pass} ✓ · ${fail} ✗ ═══`);
process.exit(fail > 0 ? 1 : 0);
