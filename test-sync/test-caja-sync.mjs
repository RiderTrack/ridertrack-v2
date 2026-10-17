// ─────────────────────────────────────────────────────────────
// 🧪 TEST — 💰 CAJA EN VIVO ENTRE CELULARES (FASE W)
//
// Compila el services/caja.ts REAL con esbuild (stubs de
// firebase) y ejercita el sync multi-celular:
//   S0. Tombstones puros (cajaCore): fusionar/filtrar/podar,
//       re-agregar y re-cerrar sobreviven.
//   S1. El cierre hecho en OTRO celular llega por el listener
//       → estado local lo tiene + evento rt-caja-remota.
//   S2. Anti-eco: nuestro propio write volviendo (mismo `at`)
//       NO se procesa (traía un gasto extra que se ignora).
//   S3. Merge-antes-de-escribir: la nube tiene el cierre de AYER
//       (hecho en el otro cel) → cerramos HOY acá → el write
//       sube los DOS cierres (antes: lo del otro se perdía).
//   S4. Fondo: el listener adopta el fondo remoto nuevo; y
//       fijarFondo acá gana (nuestro cambio es más nuevo).
//   S5. Reabrir (tombstone): el cierre de hoy se borra acá, el
//       write NO lo lleva y trae el tombstone; el snapshot viejo
//       de la nube NO lo resucita.
//   S6. Eliminar gasto (tombstone): idem S5 con gastos.
//   S7. Cambio de uid → re-suscripción (contador del stub).
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const STUB_FS = path.join(REPO, 'test-sync', 'stub-firestore.cjs');
const STUB_DB = path.join(REPO, 'test-sync', 'stub-db.cjs');
const OUT = path.join(REPO, 'test-sync', 'caja.compilado.cjs');
const OUT_CORE = path.join(REPO, 'test-sync', 'cajaCore.compilado.cjs');

// stub-plugin: firebase/firestore → stub, ./firebase → db stub
const stubPlugin = {
  name: 'stubs-caja',
  setup(build) {
    build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: STUB_FS }));
    build.onResolve({ filter: /^\.\/firebase$/ }, (a) => ({ path: STUB_DB }));
  },
};

await esbuild.build({
  entryPoints: [path.join(REPO, 'src/services/caja.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  plugins: [stubPlugin],
  logLevel: 'silent',
});
await esbuild.build({
  entryPoints: [path.join(REPO, 'src/utils/cajaCore.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT_CORE,
  logLevel: 'silent',
});
console.log('✓ caja.ts y cajaCore.ts reales compilados con stubs');

// ── globals de navegador ──
const lsMap = new Map();
globalThis.localStorage = {
  getItem: k => (lsMap.has(k) ? lsMap.get(k) : null),
  setItem: (k, v) => lsMap.set(k, String(v)),
  removeItem: k => lsMap.delete(k),
};
const eventos = [];
globalThis.CustomEvent = class {
  constructor(type, params) { this.type = type; this.detail = params?.detail; }
};
globalThis.window = {
  dispatchEvent: (e) => { eventos.push(e.type); return true; },
};

const requireLocal = createRequire(import.meta.url);
const caja = requireLocal(OUT);
const core = requireLocal(OUT_CORE);
const { arrancarCaja, snapshotCaja, cerrarCaja, reabrirCaja, agregarGasto, eliminarGasto, fijarFondo, EVENTO_CAJA_REMOTA } = caja;
const T = globalThis.__SYNC_TEST__;

const esperar = ms => new Promise(r => setTimeout(r, ms));
const esperarTick = () => esperar(30); // setImmediate + microtasks
let pass = 0, fail = 0;
const ok = (nombre, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};

const f = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const HOY = f(0), AYER = f(-1);

const resumenBase = {
  entregas: 3, efectivoCobrado: 100, digitalRider: 23.45, empresa: 0,
  cobradoTotal: 123.45, gastosEfectivo: 0, gastosDigital: 0, nGastos: 0,
  esperado: 100, netoDelDia: 123.45,
};
const cierreDe = (fecha, contado, at) => ({
  fecha, at, fondoInicial: 0, entregas: 3, efectivoCobrado: 100,
  digitalRider: 23.45, empresa: 0, gastosEfectivo: 0, gastosDigital: 0,
  esperado: 100, contado, diferencia: contado - 100, netoDelDia: 123.45,
  gastos: [],
});
const docCaja = (cajaObj) => ({ exists: () => true, data: () => ({ caja: cajaObj }) });

const eventosRemotos = () => eventos.filter(e => e === EVENTO_CAJA_REMOTA).length;
const resetTest = () => { T.snapActual = null; T.setDocCalls = []; T.setDocImpl = null; eventos.length = 0; };

// ══ S0. Tombstones puros (cajaCore) ══
console.log('\n▶ S0 — tombstones puros (cajaCore)');
{
  const { fusionarBorrados, filtrarBorrados, podarBorrados } = core;
  const ahora = Date.now();
  // filtrar: gasto y cierre borrados salen; re-agregado posterior sobrevive
  const g1 = { id: 'g1', ts: ahora - 5000, categoria: 'gasolina', concepto: '', monto: 10, pago: 'efectivo' };
  const g1nuevo = { ...g1, ts: ahora + 5000 };
  const c1 = cierreDe(HOY, 90, ahora - 5000);
  const c1nuevo = cierreDe(HOY, 95, ahora + 5000);
  const bor = { gastos: [{ id: 'g1', ts: ahora }], cierres: [{ fecha: HOY, ts: ahora }] };
  const r = filtrarBorrados([g1, g1nuevo, { ...g1, id: 'g2', ts: ahora - 100 }], [c1, c1nuevo], bor);
  ok('gasto borrado sale, re-agregado posterior sobrevive, sin tombstone no se toca',
    r.gastos.length === 2 && r.gastos.some(x => x.id === 'g1' && x.ts === ahora + 5000) && r.gastos.some(x => x.id === 'g2') && !r.gastos.some(x => x.id === 'g1' && x.ts === ahora - 5000));
  ok('cierre reabierto sale, re-cierre posterior sobrevive', r.cierres.length === 1 && r.cierres[0].contado === 95);
  // fusionarBorrados: dedupe por clave gana el más reciente
  const fb = fusionarBorrados(
    { gastos: [{ id: 'g1', ts: ahora - 100 }], cierres: [{ fecha: HOY, ts: ahora - 100 }] },
    { gastos: [{ id: 'g1', ts: ahora }], cierres: [{ fecha: HOY, ts: ahora }] }
  );
  ok('fusionarBorrados dedupea y gana el más reciente', fb.gastos.length === 1 && fb.gastos[0].ts === ahora && fb.cierres[0].ts === ahora);
  // podar: los viejos se van
  const pb = podarBorrados({ gastos: [{ id: 'gViejo', ts: ahora - 46 * 864e5 }, { id: 'g1', ts: ahora }], cierres: [] }, 45);
  ok('podarBorrados saca los de +45 días', pb.gastos.length === 1 && pb.gastos[0].id === 'g1');
  // sin tombstones → filtrar no toca nada
  const r2 = filtrarBorrados([g1], [c1], null);
  ok('sin tombstones no filtra nada', r2.gastos.length === 1 && r2.cierres.length === 1);
}

// ══ S1. Cierre hecho en el OTRO celular llega por el listener ══
console.log('\n▶ S1 — cierre del otro celular → listener → estado + evento');
{
  resetTest();
  arrancarCaja('u1');
  await esperarTick();
  const atRemoto = Date.now();
  T.ultimoCb(docCaja({ fondo: 0, gastos: [], cierres: [cierreDe(HOY, 777.5, atRemoto)], at: atRemoto }));
  const snap = snapshotCaja();
  ok('el cierre de HOY apareció en el estado local', snap.cierres.length === 1 && snap.cierres[0].fecha === HOY && snap.cierres[0].contado === 777.5);
  ok('evento rt-caja-remota disparado (para el toast)', eventosRemotos() === 1);
  ok('quedó guardado en localStorage (sobrevive al reload)', JSON.parse(lsMap.get('rt_caja_u1')).cierres.length === 1);
}

// ══ S2. Anti-eco: nuestro write volviendo no se procesa ══
console.log('\n▶ S2 — anti-eco (nuestro propio write se ignora)');
{
  resetTest();
  arrancarCaja('u2');
  await esperarTick();
  await cerrarCaja('u2', { contado: 100, resumen: resumenBase });
  ok('cerramos la caja de hoy (u2)', snapshotCaja().cierres.length === 1);
  const eco = T.setDocCalls[T.setDocCalls.length - 1].caja;
  ok('el write subió con at + cierre', eco.cierres.length === 1 && eco.at > 0);
  // eco con contenido DISTINTO (gasto fantasma) pero mismo at → debe ignorarse
  const ecoFantasma = { ...eco, gastos: [{ id: 'gFantasma', ts: Date.now(), categoria: 'otros', concepto: '', monto: 1, pago: 'efectivo' }] };
  T.ultimoCb(docCaja(ecoFantasma));
  ok('el eco (mismo at) NO procesa su contenido', snapshotCaja().gastos.length === 0);
  ok('el eco no disparó evento', eventosRemotos() === 0);
}

// ══ S3. Merge-antes-de-escribir: no se pisa el cierre del otro cel ══
console.log('\n▶ S3 — merge-antes-de-escribir (el cierre de ayer del otro cel sobrevive)');
{
  resetTest();
  arrancarCaja('u3');
  await esperarTick();
  // el otro celular cerró AYER (en la nube) mientras este estaba sin abrir
  T.snapActual = docCaja({ fondo: 0, gastos: [], cierres: [cierreDe(AYER, 555, Date.now() - 3600e3)], at: Date.now() - 3600e3 });
  await cerrarCaja('u3', { contado: 300, resumen: resumenBase });
  const subida = T.setDocCalls[0].caja;
  ok('el write sube DOS cierres (ayer del otro cel + hoy nuestro)', subida.cierres.length === 2);
  ok('incluye el de AYER (contado 555)', subida.cierres.some(c => c.fecha === AYER && c.contado === 555));
  ok('incluye el de HOY (contado 300)', subida.cierres.some(c => c.fecha === HOY && c.contado === 300));
  ok('el estado local también adoptó el de ayer', snapshotCaja().cierres.length === 2);
}

// ══ S4. Fondo: el listener adopta el remoto nuevo; el nuestro gana al cambiar ══
console.log('\n▶ S4 — fondo: remoto llega por listener, nuestro cambio prevalece al escribir');
{
  resetTest();
  arrancarCaja('u4');
  await esperarTick();
  T.ultimoCb(docCaja({ fondo: 50, gastos: [], cierres: [], at: Date.now() }));
  ok('fondo remoto 50 adoptado por el listener', snapshotCaja().fondo === 50);
  // la nube quedó con at viejo (el otro cel lo escribió hace un rato)
  T.snapActual = docCaja({ fondo: 50, gastos: [], cierres: [], at: Date.now() - 2000 });
  await fijarFondo('u4', 30);
  const subida = T.setDocCalls[0].caja;
  ok('fijarFondo acá (30) gana en el write', subida.fondo === 30);
}

// ══ S5. Reabrir: tombstone → no resucita ══
console.log('\n▶ S5 — reabrir caja (tombstone anti-resurrección)');
{
  resetTest();
  arrancarCaja('u5');
  await esperarTick();
  await cerrarCaja('u5', { contado: 400, resumen: resumenBase });
  ok('caja cerrada (hay cierre de hoy)', snapshotCaja().cierres.length === 1);
  // la nube (stub) sigue con el cierre — el reabrir igual tiene que ganar
  T.snapActual = docCaja({ fondo: 0, gastos: [], cierres: [cierreDe(HOY, 400, Date.now() - 1000)], at: Date.now() - 1000 });
  await reabrirCaja('u5');
  ok('reabrir: el cierre se borró localmente', snapshotCaja().cierres.length === 0);
  const subida = T.setDocCalls[T.setDocCalls.length - 1].caja;
  ok('el write de reabrir NO sube el cierre', subida.cierres.length === 0);
  ok('el write sube el tombstone (borrados.cierres)', Array.isArray(subida.borrados?.cierres) && subida.borrados.cierres.some(t => t.fecha === HOY));
  // el snapshot VIEJO de la nube (otro cel desactualizado) no lo resucita
  T.ultimoCb(docCaja({ fondo: 0, gastos: [], cierres: [cierreDe(HOY, 400, Date.now() - 1000)], at: Date.now() + 5000 }));
  ok('snapshot viejo con el cierre NO lo resucita', snapshotCaja().cierres.length === 0);
  // re-cerrar después del reabrir → el nuevo cierre SOBREVIVE al propio tombstone
  await cerrarCaja('u5', { contado: 401, resumen: resumenBase });
  ok('re-cerrar tras reabrir: el nuevo cierre sobrevive', snapshotCaja().cierres.length === 1 && snapshotCaja().cierres[0].contado === 401);
}

// ══ S6. Eliminar gasto: tombstone ══
console.log('\n▶ S6 — eliminar gasto (tombstone anti-resurrección)');
{
  resetTest();
  arrancarCaja('u6');
  await esperarTick();
  const g = await agregarGasto('u6', { categoria: 'gasolina', monto: 20 });
  ok('gasto agregado', snapshotCaja().gastos.length === 1);
  T.snapActual = docCaja({ fondo: 0, gastos: [g], cierres: [], at: Date.now() - 500 });
  await eliminarGasto('u6', g.id);
  ok('gasto eliminado localmente', snapshotCaja().gastos.length === 0);
  const subida = T.setDocCalls[T.setDocCalls.length - 1].caja;
  ok('el write NO sube el gasto', subida.gastos.length === 0);
  ok('el write sube el tombstone del gasto', Array.isArray(subida.borrados?.gastos) && subida.borrados.gastos.some(t => t.id === g.id));
  // la nube vieja lo trae de vuelta → no resucita
  T.ultimoCb(docCaja({ fondo: 0, gastos: [g], cierres: [], at: Date.now() + 9000 }));
  ok('snapshot viejo con el gasto NO lo resucita', snapshotCaja().gastos.length === 0);
}

// ══ S7. Cambio de uid re-suscribe ══
console.log('\n▶ S7 — cambio de uid → re-suscripción');
{
  resetTest();
  const antes = T.suscripciones;
  arrancarCaja('u7a');
  await esperarTick();
  const trasA = T.suscripciones;
  arrancarCaja('u7a'); // mismo uid → no re-suscribe
  ok('mismo uid no re-suscribe', T.suscripciones === trasA);
  arrancarCaja('u7b'); // uid nuevo → re-suscribe
  ok('uid nuevo re-suscribe el doc', T.suscripciones === trasA + 1);
  ok('el estado arrancó limpio para el uid nuevo', snapshotCaja().cierres.length === 0);
}

console.log(`\n═══ CAJA-SYNC: ${pass} ✓ · ${fail} ✗ ═══`);
process.exit(fail > 0 ? 1 : 0);
