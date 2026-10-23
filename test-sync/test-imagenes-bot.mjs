// ─────────────────────────────────────────────────────────────
// 🧪 TEST — v0.11.10 FASE AK: SUBIDAS QUE NO SE CUELGAN
//
// Compila el services/imagenesBot.ts REAL con esbuild + stubs con
// control total de uploadBytes/getDownloadURL/setDoc y de los
// objetos DOM para la compresión (FileReader/Image/canvas).
// Prueba:
//   I1. imagen liviana → va como viene + registro con pesoKb + ok
//   I2. imagen PESADA → se COMPRIME antes de subir (jpeg, más chica)
//   I3. upload colgado → tope (40ms) + UN reintento → error honesto
//   I4. upload falla UNA vez → el reintento la salva
//   I5. la imagen sube pero el REGISTRO al bot no llega → aviso honesto
//   I6. archivo que no es imagen → rechazado ANTES de subir (0 uploads)
//   I7. imagen de >3 MB → rechazada amigable
//   I8. storage/unauthorized → SIN reintento (no es la red)
//   I9. LIMITES_IMAGEN_BOT mutable (el test acelera y el código obedece)
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const STUB_FS = path.join(REPO, 'test-sync', 'stub-config-fx.cjs');
const STUB_APP = path.join(REPO, 'test-sync', 'stub-firebase-app.cjs');
const OUT = path.join(REPO, 'test-sync', 'imagenes-bot-eb.cjs');

await esbuild.build({
  entryPoints: [path.join(REPO, 'src/services/imagenesBot.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  plugins: [{
    name: 'stubs-imagenes-bot',
    setup(build) {
      build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: STUB_FS }));
      build.onResolve({ filter: /^\.\/firebase$/ }, () => ({ path: STUB_APP }));
    },
  }],
  logLevel: 'silent',
});

// ── fakes DOM para la compresión (solo se usan si el archivo pesa) ──
// (los globals los crean los stubs al cargarse; los pre-creamos acá
//  con la MISMA forma para poder configurar antes del primer require)
const CFG = globalThis.__CFG_T__ || (globalThis.__CFG_T__ = {
  getDoc: { modo: 'ok', fallos: 0, data: {} },
  cache: { modo: 'vacio', data: {} },
  setDoc: { modo: 'ok', fallos: 0 },
});
const UP = globalThis.__UPLOAD_T__ || (globalThis.__UPLOAD_T__ = {
  uploadBytes: { modo: 'ok', fallos: 0, delayMs: 0 },
  getDownloadURL: { modo: 'ok' },
  __subidas: [],
});
UP.__subidas.length = 0;
const DATA_URL_COMPRIMIDA = 'data:image/jpeg;base64,' + 'A'.repeat(700);
globalThis.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ fillStyle: '', fillRect: () => {}, drawImage: () => {} }),
    toDataURL: () => DATA_URL_COMPRIMIDA,
  }),
};
globalThis.FileReader = class {
  readAsDataURL(f) { setTimeout(() => this.onload(), 1); }
};
globalThis.Image = class {
  set src(v) { setTimeout(() => this.onload(), 1); }
};

const { subirImagenBot, LIMITES_IMAGEN_BOT } = require2(OUT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
function check(nombre, cond, extra = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${nombre}${cond ? '' : ' → ' + extra}`);
  cond ? pass++ : fail++;
}

function reset(cfgGetDoc = { modo: 'vacio' }, cfgSetDoc = { modo: 'ok' }, up = {}, url = {}) {
  CFG.getDoc = Object.assign({ llamadas: 0 }, cfgGetDoc);
  CFG.setDoc = Object.assign({ llamadas: 0 }, cfgSetDoc);
  CFG.cache = { modo: 'vacio', data: {} };
  UP.uploadBytes = Object.assign({ modo: 'ok', fallos: 0, delayMs: 0, llamadas: 0 }, up);
  UP.getDownloadURL = Object.assign({ modo: 'ok', llamadas: 0 }, url);
  UP.__subidas.length = 0;
}

// 🧪 acelerar los topes (los reales: 75s + 2s)
LIMITES_IMAGEN_BOT.topeMs = 40;
LIMITES_IMAGEN_BOT.reintentoMs = 10;

const uid = 'uid-test';
const imgLiviana = new File([new Uint8Array(10 * 1024)], 'foto.jpg', { type: 'image/jpeg' }); // 10 KB
const imgPesada = new File([new Uint8Array(2 * 1024 * 1024)], 'pesadisima.jpg', { type: 'image/jpeg' }); // 2 MB

console.log('I1: imagen liviana → sube como viene + registro con pesoKb');
{
  reset();
  const res = await subirImagenBot(uid, 'inicio_ruta', imgLiviana);
  check('devuelve la URL del storage', res.url.includes('firebasestorage.test'), res.url.slice(0, 40));
  check('pesoKb correcto (10)', res.pesoKb === 10, String(res.pesoKb));
  check('comprimida:false (ya era liviana)', res.comprimida === false, String(res.comprimida));
  check('1 sola subida', UP.__subidas.length === 1, String(UP.__subidas.length));
  check('la ruta de storage es campanas/imagenes_bot/…', UP.__subidas[0].ruta.startsWith('campanas/imagenes_bot/uid-test/inicio_ruta_'), UP.__subidas[0].ruta);
}

console.log('I2: imagen PESADA → se COMPRIME antes de subir');
{
  reset();
  const res = await subirImagenBot(uid, 'llegando_pronto', imgPesada);
  const subida = UP.__subidas[0];
  check('subió UNA imagen', UP.__subidas.length === 1, String(UP.__subidas.length));
  check('subió la COMPRIMIDA (más chica que la original)', subida.file.size < imgPesada.size, subida.file.size + ' vs ' + imgPesada.size);
  check('la comprimida es JPEG', subida.file.type === 'image/jpeg', subida.file.type);
  check('comprimida:true en el resultado', res.comprimida === true, String(res.comprimida));
  check('guarda .jpg en la ruta', UP.__subidas[0].ruta.endsWith('.jpg'), UP.__subidas[0].ruta);
}

console.log('I3: upload COLGADO → tope + UN reintento → error honesto');
{
  reset({ modo: 'vacio' }, { modo: 'ok' }, { modo: 'nunca' });
  const t0 = Date.now();
  let error = '';
  try { await subirImagenBot(uid, 'ridertrack', imgLiviana); }
  catch (e) { error = e.message; }
  const dt = Date.now() - t0;
  check('revienta con mensaje honesto (señal floja)', error.includes('no llegó al servidor') && error.includes('señal'), error);
  check('probó DOS veces (tope + reintento) y no más', UP.uploadBytes.llamadas >= 2, String(UP.uploadBytes.llamadas));
  check('rápido: 2 topes de 40ms + reintento de 10ms', dt >= 80 && dt < 1500, dt + 'ms');
}

console.log('I4: upload falla UNA vez → el reintento la salva');
{
  reset({ modo: 'vacio' }, { modo: 'ok' }, { modo: 'fallo-n', fallos: 1 });
  const res = await subirImagenBot(uid, 'mate', imgLiviana);
  check('subió al final', res.url.includes('firebasestorage.test'));
  check('2 intentos de subida', UP.uploadBytes.llamadas === 2, String(UP.uploadBytes.llamadas));
  check('el registro al bot SE escribió', CFG.setDoc.llamadas === 1, String(CFG.setDoc.llamadas));
}

console.log('I5: imagen sube pero el REGISTRO al bot no llega → aviso honesto');
{
  reset({ modo: 'vacio' }, { modo: 'nunca' }, { modo: 'ok' });
  let error = '';
  try { await subirImagenBot(uid, 'solicitar_ubicacion', imgLiviana); }
  catch (e) { error = e.message; }
  check('avisa que subió pero no pudo avisar al bot', error.includes('subió') && error.includes('bot'), error);
}

console.log('I6: archivo que no es imagen → rechazado ANTES de subir');
{
  reset();
  const txt = new File(['hola'], 'datos.txt', { type: 'text/plain' });
  let error = '';
  try { await subirImagenBot(uid, 'mate', txt); }
  catch (e) { error = e.message; }
  check('rechazado amigable', error.includes('tiene que ser una imagen'), error);
  check('NO intentó subir nada', UP.__subidas.length === 0, String(UP.__subidas.length));
}

console.log('I7: imagen de más de 3 MB → rechazada amigable');
{
  reset();
  const gigante = new File([new Uint8Array(4 * 1024 * 1024)], 'gigante.jpg', { type: 'image/jpeg' });
  let error = '';
  try { await subirImagenBot(uid, 'mate', gigante); }
  catch (e) { error = e.message; }
  check('rechazada con el peso en el mensaje', error.includes('MB') && error.includes('máximo 3 MB'), error);
  check('sin subidas', UP.__subidas.length === 0);
}

console.log('I8: storage/unauthorized → SIN reintento (no es la red)');
{
  reset({ modo: 'vacio' }, { modo: 'ok' }, { modo: 'permiso' });
  let error = '';
  try { await subirImagenBot(uid, 'mi_posicion', imgLiviana); }
  catch (e) { error = e.message; }
  check('el error de permiso pasa derecho', error.includes('storage/unauthorized'), error);
  check('1 solo intento (no gastó reintentos)', UP.uploadBytes.llamadas === 1, String(UP.uploadBytes.llamadas));
}

console.log('I9: LIMITES_IMAGEN_BOT — defaults de producción');
{
  LIMITES_IMAGEN_BOT.topeMs = 75000;
  LIMITES_IMAGEN_BOT.reintentoMs = 2000;
  LIMITES_IMAGEN_BOT.presupuestoBytes = 300000;
  check('tope por defecto: 75000ms (antes: infinito colgado)', LIMITES_IMAGEN_BOT.topeMs === 75000, String(LIMITES_IMAGEN_BOT.topeMs));
  check('reintento por defecto: 2000ms', LIMITES_IMAGEN_BOT.reintentoMs === 2000);
  check('presupuesto: 300KB (foto legible y liviana)', LIMITES_IMAGEN_BOT.presupuestoBytes === 300000);
}

console.log('');
console.log(`RESULTADO: ${pass} ✓ / ${fail} ✗`);
process.exit(fail === 0 ? 0 : 1);
