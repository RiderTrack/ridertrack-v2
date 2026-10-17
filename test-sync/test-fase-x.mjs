// ─────────────────────────────────────────────────────────────
// 🧪 TEST — FASE X: 🛵 los pedidos de S/12 (lejos) cuentan como
// S/9 — la marca `lejos` se PERDÍA en el mapeo de
// subscribeToRutaActiva al leer el doc del bot.
//
// Reporte literal de Rudy: "no está multiplicando cuando son
// pedidos de 12… he tenido dos pedidos de 12 y ahora tengo cuatro
// de nueve y está contando los seis pedidos por nueve".
//
// CAUSA: publicar/finalizar ya ESCRIBÍAN lejos en el doc, pero el
// mapeo Modular→V2 del listener la DESCARTABA → cada snapshot del
// bot (cambios de estado, el doble write de cambiarEstado, etc.)
// devolvía la lista SIN lejos → header "Ganado hoy", CajaCard
// "Tu paga (N pedidos)" y el cierre contaban TODO a S/9.
//
// Compila el services/firestore.ts REAL con esbuild (stubs de
// firebase) + pagoPedidosCore para las cuentas:
//   S1. Caso literal: 2 lejos + 4 normales → 60 (antes 54).
//   S2. Round-trip: publish escribe lejos → el doc vuelve →
//       el mapping lo conserva.
//   S3. Anti-borrado: el BOT reescribe el doc (cambia un st) →
//       la re-emisión NO borra las marcas.
//   S4. lejos:false explícito se conserva (no resucita).
//   S5. Auto por distrito (sin marca) → cuenta 12.
//   S6. finalizarRuta congela cantidadLejos=2 en el historial.
//   S7. clientes_registrados (respaldo) conserva lejos.
//   S8. Sin marca → el campo queda ausente (undefined).
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const STUB_FS = path.join(REPO, 'test-sync', 'stub-firestore-fx.cjs');
const STUB_APP = path.join(REPO, 'test-sync', 'stub-firebase-app.cjs');
const STUB_STORAGE = path.join(REPO, 'test-sync', 'stub-storage.cjs');
const STUB_XLSX = path.join(REPO, 'test-sync', 'stub-xlsx.cjs');
const OUT = path.join(REPO, 'test-sync', 'firestore.compilado.cjs');
const OUT_CORE = path.join(REPO, 'test-sync', 'pagoCore.compilado.cjs');

// stub-plugin: firestore.ts → stubs, pagoPedidosCore va limpio
const stubPlugin = {
  name: 'stubs-fase-x',
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
await esbuild.build({
  entryPoints: [path.join(REPO, 'src/utils/pagoPedidosCore.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT_CORE,
  logLevel: 'silent',
});
console.log('✓ firestore.ts y pagoPedidosCore.ts reales compilados con stubs');

// ── globals de navegador (cargarConfigPagoPedidos usa localStorage) ──
const lsMap = new Map();
globalThis.localStorage = {
  getItem: k => (lsMap.has(k) ? lsMap.get(k) : null),
  setItem: (k, v) => lsMap.set(k, String(v)),
  removeItem: k => lsMap.delete(k),
};

const requireLocal = createRequire(import.meta.url);
const fsMod = requireLocal(OUT);
const core = requireLocal(OUT_CORE);
const { subscribeToRutaActiva, subscribeToClientesRegistrados, publicarClientesEnRutaActiva, finalizarRuta } = fsMod;
const { calcularPagoPedidos, esLejos } = core;
const T = globalThis.__SYNC_TEST__;

const esperar = ms => new Promise(r => setTimeout(r, ms));
const esperarTick = () => esperar(30);
let pass = 0, fail = 0;
const check = (nombre, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};

// ── helpers ──
const docDeRuta = clientes => ({ exists: () => true, data: () => ({ clientes, activa: true }) });
const cfgActiva = { distritosLejos: [] };
const CFG = { activo: true, tarifaNormal: 9, tarifaLejos: 12, distritosLejos: [] };

// Cliente en el formato del doc del bot (el que escribe el bot Modular)
const clienteBot = (id, extra = {}) => ({
  id: `c${id}`, num: id, nombre: `Cliente ${id}`, cel: `98700${id}`,
  cobrar: 25, precio: 25, prod: 'PAQUETE', dir: 'Calle 123',
  dist: 'Surco', st: 'efectivo', hora: '10:00', ...extra,
});

// La ruta literal de Rudy: 6 entregados, 2 con la marca S/12 y 4 normales
const rutaDeRudy = [
  clienteBot(1, { lejos: true, dist: 'Chorrillos' }),
  clienteBot(2, { lejos: true, dist: 'Carabayllo' }),
  clienteBot(3), clienteBot(4), clienteBot(5), clienteBot(6),
];

// ═══ S1 — el caso literal: 2×12 + 4×9 = 60 (el bug contaba 54) ═══
console.log('\nS1 — caso literal de Rudy (2 de 12 + 4 de 9)');
T.snapActual = docDeRuta(rutaDeRudy);
let emitidos = [];
subscribeToRutaActiva(cs => { emitidos = cs; });
await esperarTick();
check('la ruta llega con los 6 clientes', emitidos.length === 6, `llegaron ${emitidos.length}`);
check('la marca lejos SOBREVIVE al mapeo (2 clientes)', emitidos.filter(c => c.lejos === true).length === 2, `→ ${emitidos.filter(c => c.lejos === true).length}`);
const pago1 = calcularPagoPedidos(emitidos, CFG);
check('cantidadLejos = 2', pago1.cantidadLejos === 2, `→ ${pago1.cantidadLejos}`);
check('cantidadNormal = 4', pago1.cantidadNormal === 4, `→ ${pago1.cantidadNormal}`);
check('TOTAL = S/ 60 (2×12 + 4×9) — antes contaba 54', pago1.total === 60, `→ ${pago1.total}`);
check('entregados = 6', pago1.entregados === 6, `→ ${pago1.entregados}`);

// ═══ S2 — round-trip: publish escribe lejos → el doc vuelve → se conserva ═══
console.log('\nS2 — round-trip publish → snapshot');
T.setDocCalls = [];
const paraPublicar = [
  { id: 'c1', num: 1, nombre: 'Marta', cel: '987111222', cobrar: 25, precio: 25, prod: 'CAJA', dir: 'Av 1', dist: 'Surco', st: 'pendiente', lejos: true },
  { id: 'c2', num: 2, nombre: 'Luis', cel: '987333444', cobrar: 30, precio: 30, prod: 'CAJA', dir: 'Av 2', dist: 'Surco', st: 'pendiente' },
];
await publicarClientesEnRutaActiva('uid-x', paraPublicar);
const publicado = T.setDocCalls.at(-1);
check('publish escribe lejos:true en el doc del bot', publicado.clientes[0].lejos === true);
check('publish no inventa lejos donde no hay', !('lejos' in publicado.clientes[1]));
// el doc publicado VUELVE por el listener (mismo formato)
T.snapActual = docDeRuta(publicado.clientes);
T.ultimoCb(T.snapActual);
await esperarTick();
check('el doc publicado vuelve con la marca intacta', emitidos.filter(c => c.lejos === true).length >= 1 && emitidos.find(c => c.id === 'c1').lejos === true);

// ═══ S3 — anti-borrado: el BOT reescribe el doc (cambia un st) ═══
console.log('\nS3 — el bot toca el doc (update de st) y NO borra las marcas');
T.snapActual = docDeRuta(rutaDeRudy);
T.ultimoCb(T.snapActual);
await esperarTick();
check('re-emisión inicial: 2 lejos', emitidos.filter(c => c.lejos === true).length === 2);
// el bot marca el c3 como entregado y reescribe TODO el doc
const docDelBot = rutaDeRudy.map(c => ({ ...c, st: 'efectivo' }));
T.snapActual = docDeRuta(docDelBot);
T.ultimoCb(T.snapActual);
await esperarTick();
check('tras la reescritura del bot las 2 marcas siguen', emitidos.filter(c => c.lejos === true).length === 2, `→ ${emitidos.filter(c => c.lejos === true).length}`);
const pago3 = calcularPagoPedidos(emitidos, CFG);
check('la paga sigue en S/ 60 después del write del bot', pago3.total === 60, `→ ${pago3.total}`);

// ═══ S4 — lejos:false explícito se conserva (no resucita) ═══
console.log('\nS4 — lejos:false explícito');
T.snapActual = docDeRuta([clienteBot(1, { lejos: false, dist: 'Chorrillos' }), clienteBot(2)]);
T.ultimoCb(T.snapActual);
await esperarTick();
check('el mapeo conserva lejos:false', emitidos[0].lejos === false);
check('con la lista lejana configurada, el false PISA (S/9)', !esLejos(emitidos[0], { ...CFG, distritosLejos: ['Chorrillos'] }));

// ═══ S5 — auto por distrito desde el doc del bot ═══
console.log('\nS5 — auto por distrito (sin marca)');
const cfgLista = { ...CFG, distritosLejos: ['Chorrillos'] };
T.snapActual = docDeRuta([clienteBot(1, { dist: 'Chorrillos' }), clienteBot(2, { dist: 'Surco' })]);
T.ultimoCb(T.snapActual);
await esperarTick();
const pago5 = calcularPagoPedidos(emitidos, cfgLista);
check('Chorrillos sin marca → 12', pago5.cantidadLejos === 1 && pago5.montoLejos === 12, `→ ${pago5.cantidadLejos}/${pago5.montoLejos}`);
check('Surco → 9', pago5.cantidadNormal === 1 && pago5.montoNormal === 9);
check('total 21', pago5.total === 21, `→ ${pago5.total}`);

// ═══ S6 — finalizarRuta congela el desglose con los lejanos ═══
console.log('\nS6 — el cierre de ruta congela cantidadLejos en el historial');
lsMap.set('rt_pago_pedidos', JSON.stringify(CFG));
T.setDocCalls = [];
// clientes con el formato V2 (con mEf/mYp para el desglose)
const clientesV2 = rutaDeRudy.map((c, i) => ({
  ...c, mEf: 25, mYp: 0, mEmp: 0, mVt: 0, obs: '', nota: '', webReg: false,
}));
await finalizarRuta('uid-x', clientesV2);
const historial = T.setDocCalls[0];
check('historial_rutas se escribió', !!historial && Array.isArray(historial.clientes));
check('pagoPedidos congelado: cantidadLejos = 2', historial.pagoPedidos && historial.pagoPedidos.cantidadLejos === 2, `→ ${historial.pagoPedidos && historial.pagoPedidos.cantidadLejos}`);
check('pagoPedidos congelado: total = 60', historial.pagoPedidos && historial.pagoPedidos.total === 60, `→ ${historial.pagoPedidos && historial.pagoPedidos.total}`);
check('el snapshot de clientes conserva lejos en el historial', historial.clientes.filter(c => c.lejos === true).length === 2);
check('la ruta quedó limpia para mañana', T.setDocCalls.some(c => Array.isArray(c.clientes) && c.clientes.length === 0 && c.activa === false));

// ═══ S7 — clientes_registrados (respaldo) conserva lejos ═══
console.log('\nS7 — respaldo clientes_registrados conserva lejos');
T.registradosSnap = {
  forEach: fn => fn({ id: '999888777', data: () => ({ telefono: '999888777', nombre: 'Ana', cobrar: 20, dist: 'Surco', st: 'efectivo', lejos: true }) }),
};
let respaldo = [];
subscribeToClientesRegistrados(cs => { respaldo = cs; });
await esperarTick();
check('el respaldo conserva lejos:true', respaldo.length === 1 && respaldo[0].lejos === true);

// ═══ S8 — sin marca → el campo queda ausente ═══
console.log('\nS8 — sin marca → campo ausente (undefined)');
T.snapActual = docDeRuta([clienteBot(1)]);
T.ultimoCb(T.snapActual);
await esperarTick();
check('cliente sin lejos → .lejos undefined', emitidos.length === 1 && emitidos[0].lejos === undefined);

// ═══ resumen ═══
console.log('\n════════════════════════════════════════════');
console.log(`RESULTADO: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) { console.log('❌ HAY FALLAS'); process.exit(1); }
console.log('✅ TODO OK');
