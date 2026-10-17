// ─────────────────────────────────────────────────────────────
// 🧪 TEST — FASE Z (parte 2): 💰 el monto SOBREVIVE a la carga
//
// Reporte literal de Rudy (15 oct): "sí salió el monto el QR
// (ayer) pero hoy que volví a cargar los nuevos clientes solo
// aparece el QR y el nombre, no aparece el monto". Mismo linaje
// que la FASE X (el mapeo Modular→V2 descartaba `lejos`): esta
// vez la cadena del MONTO tiene un solo punto de rotura — el
// mapeo leía cobrar SIN respaldo en precio, y cualquier carga
// que dejara cobrar vacío (columna renombrada, string "S/ 89,90",
// doc viejo) terminaba en "sin monto cargado".
//
// Compila el services/firestore.ts REAL con esbuild (stubs):
//   Z1. doc con SOLO precio → cobrar llega = precio (EL FIX).
//   Z2. doc normal (cobrar+precio) → llega EXACTO igual (regresión).
//   Z3. cobrar como STRING "S/ 89,90" → parseado a 89.9.
//   Z4. cobrar 0 + precio 116.82 → cobrar 116.82 (día real).
//   Z5. round-trip: publish → doc → listener conserva AMBOS montos.
//   Z6. los montos literales de la ruta del 15 oct sobreviven.
//   Z7. clientes_registrados (respaldo histórico) sin tocar.
//   Z8. escribir de vuelta NO inventa montos (publish fiel).
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
const OUT = path.join(REPO, 'test-sync', 'firestore-fz.cjs');

const stubPlugin = {
  name: 'stubs-fase-z',
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
console.log('✓ services/firestore.ts REAL compilado con stubs (FASE Z)');

const lsMap = new Map();
globalThis.localStorage = {
  getItem: k => (lsMap.has(k) ? lsMap.get(k) : null),
  setItem: (k, v) => lsMap.set(k, String(v)),
  removeItem: k => lsMap.delete(k),
};

const requireLocal = createRequire(import.meta.url);
const fsMod = requireLocal(OUT);
const { subscribeToRutaActiva, subscribeToClientesRegistrados, publicarClientesEnRutaActiva } = fsMod;
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
const cerca = (a, b, tol = 0.001) => Math.abs(a - b) <= tol;

// Cliente en el formato del doc del bot/Modular
const clienteBot = (id, extra = {}) => ({
  id: `c${id}`, num: id, nombre: `Cliente ${id}`, cel: `98700${id}`,
  prod: 'PAQUETE', dir: 'Calle 123', dist: 'Surco',
  st: 'pendiente', hora: '', ...extra,
});

let emitidos = [];
subscribeToRutaActiva(cs => { emitidos = cs; });

// ═══ Z1 — EL FIX: doc con SOLO precio (columna cobrar renombrada/perdida) ═══
console.log('\nZ1 — doc del bot con SOLO precio → el monto NO se pierde');
T.snapActual = docDeRuta([
  clienteBot(1, { precio: 89.9 }),            // sin cobrar
  clienteBot(2, { precio: '44.90' }),         // sin cobrar, string
]);
T.ultimoCb(T.snapActual);
await esperarTick();
check('llegan los 2 clientes', emitidos.length === 2);
check('cobrar = precio 89.9 (antes llegaba 0 → "sin monto cargado")', cerca(emitidos[0].cobrar, 89.9), `→ ${emitidos[0].cobrar}`);
check('cobrar = precio "44.90" parseado', cerca(emitidos[1].cobrar, 44.9), `→ ${emitidos[1].cobrar}`);
check('precio también queda lleno (89.9)', cerca(emitidos[0].precio, 89.9));

// ═══ Z2 — regresión: doc normal llega EXACTO ═══
console.log('\nZ2 — doc normal (cobrar+precio) → sin cambios');
T.snapActual = docDeRuta([clienteBot(1, { cobrar: 89.9, precio: 89.9 })]);
T.ultimoCb(T.snapActual);
await esperarTick();
check('cobrar 89.9 exacto', cerca(emitidos[0].cobrar, 89.9));
check('precio 89.9 exacto', cerca(emitidos[0].precio, 89.9));

// ═══ Z3 — cobrar como STRING al estilo Excel de la empresa ═══
console.log('\nZ3 — cobrar string "S/ 89,90" → 89.9');
T.snapActual = docDeRuta([clienteBot(1, { cobrar: 'S/ 89,90', precio: 'S/ 89,90' })]);
T.ultimoCb(T.snapActual);
await esperarTick();
check('string peruano parseado a 89.9', cerca(emitidos[0].cobrar, 89.9), `→ ${emitidos[0].cobrar}`);
check('precio string también saneado', cerca(emitidos[0].precio, 89.9));

// ═══ Z4 — el día LITERAL: cobrar 0 + precio lleno ═══
console.log('\nZ4 — cobrar 0 + precio 116.82 (cliente David David del 15 oct)');
T.snapActual = docDeRuta([clienteBot(1, { cobrar: 0, precio: 116.82 })]);
T.ultimoCb(T.snapActual);
await esperarTick();
check('cobrar rescata 116.82 del precio', cerca(emitidos[0].cobrar, 116.82), `→ ${emitidos[0].cobrar}`);

// ═══ Z5 — round-trip: publish → doc → listener conserva AMBOS ═══
console.log('\nZ5 — round-trip publish → doc → listener');
T.setDocCalls = [];
const paraPublicar = [
  { id: 'c1', num: 1, nombre: 'Marta', cel: '987111222', cobrar: 89.9, precio: 89.9, prod: 'CAJA', dir: 'Av 1', dist: 'Surco', st: 'pendiente' },
  { id: 'c2', num: 2, nombre: 'Luis', cel: '987333444', cobrar: 0, precio: 44.9, prod: 'CAJA', dir: 'Av 2', dist: 'Surco', st: 'pendiente' },
];
await publicarClientesEnRutaActiva('uid-x', paraPublicar);
const publicado = T.setDocCalls.at(-1);
check('publish escribe cobrar 89.9 (fiel)', cerca(publicado.clientes[0].cobrar, 89.9));
check('publish escribe precio 89.9 (fiel)', cerca(publicado.clientes[0].precio, 89.9));
// el doc publicado VUELVE por el listener
T.snapActual = docDeRuta(publicado.clientes);
T.ultimoCb(T.snapActual);
await esperarTick();
check('vuelve con cobrar 89.9', cerca(emitidos[0].cobrar, 89.9));
check('el que tenía cobrar 0 rescata su precio al volver (44.9)', cerca(emitidos[1].cobrar, 44.9), `→ ${emitidos[1].cobrar}`);

// ═══ Z6 — la ruta LITERAL del 15 oct (7 clientes con sus montos) ═══
console.log('\nZ6 — montos de la ruta real del 15 oct');
const rutaHoy = [
  { id: 1792063170908, num: 1, nombre: 'DELCY SANTILLAN', cel: '51981458461', cobrar: 89.9, precio: 89.9, prod: 'Masajeador', dir: 'CALLE GENERAL VIDAL 139', dist: 'Miraflores', st: 'pendiente' },
  { id: 1792063170913, num: 2, nombre: 'Jessica Licas', cel: '51962225760', cobrar: 44.9, precio: 44.9, prod: 'Almohada', dir: 'Rosendo Vidaurre 641', dist: 'Barranco', st: 'pendiente' },
  { id: 1792063170912, num: 3, nombre: 'Gonzales soledad', cel: '51992758354', cobrar: 69.9, precio: 69.9, prod: 'NeckSupport', dir: 'Pasaje Santiago 2250', dist: 'Jesús María', st: 'pendiente' },
];
T.snapActual = docDeRuta(rutaHoy);
T.ultimoCb(T.snapActual);
await esperarTick();
const okMontos = rutaHoy.every((c, i) => cerca(emitidos[i].cobrar, c.cobrar));
check('los 3 primeros montos llegan EXACTO (89.9/44.9/69.9)', okMontos);
const total = emitidos.reduce((s, c) => s + c.cobrar, 0);
check('total de los 3 = S/ 204.70', cerca(total, 204.7), `→ ${total}`);

// ═══ Z7 — clientes_registrados (respaldo) sin romperse ═══
console.log('\nZ7 — respaldo histórico (clientes_registrados)');
let registrados = [];
subscribeToClientesRegistrados(cs => { registrados = cs; });
T.registradosSnap = {
  forEach: (cb) => {
    cb({ id: 'tel1', data: () => ({ telefono: '987111222', nombre: 'Viejo Uno', cobrar: 33.3, prod: 'X', dir: 'D', dist: 'Surco', st: 'pendiente' }) });
    cb({ id: 'tel2', data: () => ({ telefono: '987333444', nombre: 'Vieja Dos', prod: 'Y', dir: 'D', dist: 'Surco', st: 'pendiente' }) });
  },
};
T.ultimoCbCol && T.ultimoCbCol(T.registradosSnap);
await esperarTick();
check('registrados con cobrar llegan bien', registrados.length >= 1 && cerca(registrados[0].cobrar ?? registrados.find(r => r.nombre === 'Viejo Uno').cobrar, 33.3));
const sinCobrar = registrados.find(r => r.nombre === 'Vieja Dos');
check('registrado SIN cobrar → 0 (no inventa plata)', sinCobrar && sinCobrar.cobrar === 0);

// ═══ Z8 — publish NO inventa montos (fiel al estado de la app) ═══
console.log('\nZ8 — publish fiel: no toca lo que la app no tiene');
T.setDocCalls = [];
await publicarClientesEnRutaActiva('uid-x', [
  { id: 'c1', num: 1, nombre: 'Cero', cel: '987000000', cobrar: 0, precio: 0, prod: '', dir: '', dist: '', st: 'pendiente' },
]);
const p2 = T.setDocCalls.at(-1);
check('cliente sin plata se publica 0/0 (sin inventar)', p2.clientes[0].cobrar === 0 && p2.clientes[0].precio === 0);

console.log(`\n${'─'.repeat(50)}`);
console.log(`FASE Z (listener/round-trip): ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);
