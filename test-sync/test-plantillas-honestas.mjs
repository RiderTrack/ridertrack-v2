// ─────────────────────────────────────────────────────────────
// 🧪 TEST — v0.11.11 FASE AL: EL SEMBRADO DE PLANTILLAS YA NO MIENTE
//
// Compila el utils/botControl.ts REAL con esbuild + stubs con
// control de metadata.fromCache (la señal nueva de la caché
// persistente). Prueba:
//   P1. getDocs VACÍO + fromCache=true (caché fría) → NO SIEMBRA
//       (el bug del 21-oct: clonaba las 6 base al lado de las tuyas)
//   P2. getDocs VACÍO + fromCache=false (SERVIDOR confirma) → siembra
//       las 6 base EXACTAS
//   P3. getDocs con plantillas → NO toca nada (comportamiento de v1)
//   P4. escucharPlantillas pasa info.fromCache=true al callback con
//       snapshot vacío de caché → la vista sabe que NO debe sembrar
//   P5. escucharPlantillas mapea los docs y pasa fromCache=false
//   P6. la 6 base sembradas son las de SIEMPRE (nombres exactos)
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const STUB_FS = path.join(REPO, 'test-sync', 'stub-plantillas-fx.cjs');
const STUB_APP = path.join(REPO, 'test-sync', 'stub-firebase-app.cjs');
const OUT = path.join(REPO, 'test-sync', 'botControl-eb.cjs');

const stubPlugin = {
  name: 'stubs-plantillas',
  setup(build) {
    build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: STUB_FS }));
    build.onResolve({ filter: /^\.\.\/services\/firebase$/ }, () => ({ path: STUB_APP }));
    build.onResolve({ filter: /^\.\./, namespace: 'file' }, (args) => ({ path: path.join(REPO, 'src/services', path.basename(args.path)) }));
  },
};

await esbuild.build({
  entryPoints: [path.join(REPO, 'src/utils/botControl.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  plugins: [stubPlugin],
  logLevel: 'silent',
});
console.log('✓ utils/botControl.ts REAL compilado con stubs (plantillas honestas)');

const requireLocal = createRequire(import.meta.url);
const bc = requireLocal(OUT);
const T = globalThis.__PLT_T__;

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log('  ✓ ' + n); };
const mal = (n, extra) => { fail++; console.log('  ✗ ' + n + (extra ? ' — ' + extra : '')); };
const seccion = (n) => console.log('\n── ' + n + ' ──');

// ═══ P1: vacío DESDE LA CACHÉ FRÍA → NO siembra (el bug del 21-oct) ═══
seccion('P1 · caché fría dice «vacío» → NO siembra');
T.addDocCalls.length = 0;
T.getDocsSnap = { empty: true, docs: [], metadata: { fromCache: true } };
try {
  const n = await bc.crearPlantillasPredefinidas();
  if (n === 0 && T.addDocCalls.length === 0) ok('caché fría vacía → 0 creadas, 0 addDoc (antes: 6 clones)');
  else mal('debió no sembrar', `n=${n} addDoc=${T.addDocCalls.length}`);
} catch (e) { mal('explotó', e.message); }

// ═══ P2: vacío CONFIRMADO POR EL SERVIDOR → siembra las 6 ═══
seccion('P2 · servidor confirma vacío → siembra las 6 base');
T.addDocCalls.length = 0;
T.getDocsSnap = { empty: true, docs: [], metadata: { fromCache: false } };
try {
  const n = await bc.crearPlantillasPredefinidas();
  if (n === 6 && T.addDocCalls.length === 6) ok('servidor vacío → 6 creadas (primera vez de verdad)');
  else mal('debió sembrar 6', `n=${n} addDoc=${T.addDocCalls.length}`);
} catch (e) { mal('explotó', e.message); }

// ═══ P3: ya hay plantillas → NO toca nada ═══
seccion('P3 · ya hay plantillas → no toca nada (regresión v1)');
T.addDocCalls.length = 0;
T.getDocsSnap = { empty: false, docs: [{ id: 'a1', data: { nombre: 'Menú Principal', mensaje: 'x' } }], metadata: { fromCache: false } };
try {
  const n = await bc.crearPlantillasPredefinidas();
  if (n === 0 && T.addDocCalls.length === 0) ok('con datos → 0 creadas');
  else mal('no debió sembrar', `n=${n}`);
} catch (e) { mal('explotó', e.message); }

// ═══ P4: el listener AVISA fromCache=true en el snapshot vacío ═══
seccion('P4 · escucharPlantillas expone info.fromCache (vacío de caché)');
T.listenerSnap = { docs: [], metadata: { fromCache: true } };
try {
  const vista = await new Promise((resolve) => {
    let termino = false;
    bc.escucharPlantillas((lista, info) => { if (!termino) { termino = true; resolve({ lista, info }); } });
  });
  if (vista.lista.length === 0 && vista.info?.fromCache === true) {
    ok('callback recibe lista vacía + fromCache:true → la vista NO siembra');
  } else {
    mal('info.fromCache no llegó bien', JSON.stringify(vista.info));
  }
} catch (e) { mal('explotó', e.message); }

// ═══ P5: el listener mapea plantillas con fromCache=false ═══
seccion('P5 · escucharPlantillas mapea los docs reales');
T.listenerSnap = {
  docs: [
    { id: 'p1', data: { nombre: 'Entrega Completada', categoria: 'entrega', mensaje: 'chau {nombre}', clave: 'entregaCompletada' } },
    { id: 'p2', data: { nombre: 'Yape QR', categoria: 'pagos', mensaje: 'paga', updatedAt: '2026-07-24T01:20:11' } },
  ],
  metadata: { fromCache: false },
};
try {
  const vista = await new Promise((resolve) => {
    let termino = false;
    bc.escucharPlantillas((lista, info) => { if (!termino) { termino = true; resolve({ lista, info }); } });
  });
  const okLista = vista.lista.length === 2
    && vista.lista[0].nombre === 'Entrega Completada' // sin createdAt → orden estable de siempre
    && vista.lista[0].clave === 'entregaCompletada'
    && vista.lista[1].nombre === 'Yape QR'
    && vista.info?.fromCache === false;
  if (okLista) ok('2 plantillas mapeadas y ordenadas + fromCache:false');
  else mal('mapeo raro', JSON.stringify(vista).slice(0, 120));
} catch (e) { mal('explotó', e.message); }

// ═══ P6: los nombres de las 6 base son los de SIEMPRE ═══
seccion('P6 · las 6 sembradas son las de la v1 (nombres exactos)');
const ESPERADAS = ['Menú Principal', 'Cuánto Pagar', 'Aviso de Llegada', 'Entrega Completada', 'No Se Entregó', 'Yape QR'];
T.addDocCalls.length = 0;
T.getDocsSnap = { empty: true, docs: [], metadata: { fromCache: false } };
try {
  await bc.crearPlantillasPredefinidas();
  const nombres = T.addDocCalls.map((c) => c.data.nombre).sort();
  const esperadas = [...ESPERADAS].sort();
  const iguales = nombres.length === 6 && nombres.every((n, i) => n === esperadas[i]);
  if (iguales) ok('las 6 de siempre, ni una más');
  else mal('nombres distintos', JSON.stringify(nombres));
} catch (e) { mal('explotó', e.message); }

console.log('');
console.log(`RESULTADO: ${pass} ✓ / ${fail} ✗`);
process.exit(fail === 0 ? 0 : 1);
