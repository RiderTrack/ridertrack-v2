// ─────────────────────────────────────────────────────────────
// 🧪 TEST del blindaje del sync (syncDT.ts REAL, Firebase simulado)
//
// Compila el syncDT.ts verdadero con esbuild (stubs de firebase)
// y ejercita los 6 escenarios críticos del sync multi-celular:
//   1. 🛡️ Anti-borrado: cel 2 vacío subió primero → NO borra los
//      50 viajes del cel 1, y los vuelve a subir.
//   2. 🛡️ Anti eco: contenido idéntico que baja NO re-dispara subida
//      (sin ping-pong infinito entre dos cels abiertos).
//   3. 🛡️ Pendiente tras reinicio: cambio que no pudo subir (app
//      cerrada / sin internet) sube solo al reabrir la app.
//   4. Borrados viajan: en estado limpio, lo borrado en el otro cel
//      acá también se borra (comportamiento normal intacto).
//   5. 🛡️ Unión con cambios sin subir: agregaste X sin internet y el
//      otro cel subió Y → quedan X e Y (nada se pierde).
//   6. Cel nuevo recibe todo: instalado en un cel vacío baja los 50
//      viajes y NO sube nada raro; las keys de IA quedan locales.
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import { rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const STUB_FS = path.join(REPO, 'test-sync', 'stub-firestore.cjs');
const STUB_DB = path.join(REPO, 'test-sync', 'stub-db.cjs');
const OUT = path.join(REPO, 'test-sync', 'syncDT.compilado.cjs');

// ── 1. Compilar el syncDT REAL con los stubs ──
const stubPlugin = {
  name: 'stubs-sync',
  setup(build) {
    build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: STUB_FS }));
    build.onResolve({ filter: /\.\.\/\.\.\/services\/firebase$/ }, () => ({ path: STUB_DB }));
  },
};

await esbuild.build({
  entryPoints: [path.join(REPO, 'src/drivertrack/services/syncDT.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  plugins: [stubPlugin],
  logLevel: 'silent',
});
console.log('✓ syncDT.ts real compilado con stubs');

// ── 2. Globals de navegador antes de cargar el módulo ──
const lsMap = new Map();
globalThis.localStorage = {
  getItem: k => (lsMap.has(k) ? lsMap.get(k) : null),
  setItem: (k, v) => lsMap.set(k, String(v)),
  removeItem: k => lsMap.delete(k),
};
globalThis.window = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: t => clearTimeout(t),
  dispatchEvent: () => true,
};
globalThis.CustomEvent = class {
  constructor(type, params) { this.type = type; this.detail = params?.detail; }
};

const T = (globalThis.__SYNC_TEST__ ||= {});
T.setDocCalls = [];
T.snapActual = null;
T.setDocImpl = null;

const requireLocal = createRequire(import.meta.url);
const syncDT = requireLocal(OUT);
const { iniciarSyncDT } = syncDT;

// ── helpers ──
const esperar = ms => new Promise(r => setTimeout(r, ms));
const esperarPush = () => esperar(2900); // debounce 2.5s + margen
let pass = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}
const viajes = (ids, conRuta = false) => ids.map(id => ({
  id, fecha: '2026-10-05', tarifa: 10, comision: 1, neto: 9, origen: 'indrive',
  direccion: 'B', dirA: 'A', celularEnvia: '51x', celularRecibe: '51y',
  ...(conRuta ? { ruta: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }] } : {}),
}));
const lsViajes = () => JSON.parse(lsMap.get('dt_viajes_v1') || '[]');
const idsDe = arr => arr.map(v => v.id).sort().join(',');

async function reset(estadoInicial = {}) {
  iniciarSyncDT(null); // para timers y listener
  lsMap.clear();
  T.setDocCalls = [];
  T.snapActual = null;
  T.setDocImpl = null;
  for (const [k, v] of Object.entries(estadoInicial)) lsMap.set(k, typeof v === 'string' ? v : JSON.stringify(v));
}

// ═══════════ TEST 1: anti-borrado (cel 2 vacío subió primero) ═══════════
console.log('\n▶ TEST 1 — 🛡️ el cel 2 vacío NO borra los registros del cel 1');
await reset({
  dt_viajes_v1: viajes(['v1', 'v2', 'v3', 'v4', 'v5'], true).concat(
    viajes(['v6', 'v7', 'v8', 'v9', 'v10']).concat(viajes(['v11', 'v12', 'v13', 'v14', 'v15']))
  ), // 15 viajes locales SIN dt_sync_en (nunca sincronizó)
});
// el cel 2 ya subió su estado VACÍO a la nube
T.snapActual = { data: () => ({ viajes: [], gastos: [], actualizadoEn: 5000, dispositivo: 'cel2' }) };
iniciarSyncDT('rudy');
await esperarPush();
check('los 15 viajes locales SIGUEN en el teléfono', lsViajes().length === 15, `→ hay ${lsViajes().length}`);
check('la nube recibió los 15 (se re-suben solos)', T.setDocCalls.length === 1 && T.setDocCalls[0].viajes.length === 15,
  `→ pushes: ${T.setDocCalls.length}, viajes subidos: ${T.setDocCalls[0]?.viajes?.length}`);
check('quedó sincronizado (dt_sync_en escrito)', !!lsMap.get('dt_sync_en'));
check('sin pendientes tras subir', lsMap.get('dt_pendiente') !== '1');

// ═══════════ TEST 2: anti eco (no ping-pong) ═══════════
console.log('\n▶ TEST 2 — 🛡️ lo que baja de la nube NO se re-sube (anti ping-pong)');
await reset({
  dt_viajes_v1: viajes(['a', 'b', 'c'], true),
  dt_sync_en: '2000', // ya sincronizó antes, sin pendientes
});
T.snapActual = { data: () => ({ viajes: viajes(['a', 'b', 'c']), gastos: [], actualizadoEn: 3000, dispositivo: 'cel2' }) };
iniciarSyncDT('rudy');
await esperarPush();
check('aplicó lo de la nube (3 viajes)', lsViajes().length === 3);
check('NO re-subió nada (0 pushes)', T.setDocCalls.length === 0, `→ pushes: ${T.setDocCalls.length}`);
check('pendiente limpio', lsMap.get('dt_pendiente') !== '1');

// ═══════════ TEST 3: pendiente tras reinicio ═══════════
console.log('\n▶ TEST 3 — 🛡️ cambio que no subió (sin internet) sube al reabrir la app');
await reset({
  dt_viajes_v1: viajes(['x1']),
  dt_sync_en: '1000',
  dt_pendiente: '1', // quedó marcado cuando falló la subida
});
// la nube no tiene nada nuevo (mismo timestamp)
T.snapActual = { data: () => ({ viajes: viajes(['x1']), gastos: [], actualizadoEn: 1000, dispositivo: 'cel2' }) };
iniciarSyncDT('rudy');
await esperarPush();
check('subió el viaje pendiente solo', T.setDocCalls.length === 1 && T.setDocCalls[0].viajes[0]?.id === 'x1',
  `→ pushes: ${T.setDocCalls.length}`);
check('pendiente limpio tras subir', lsMap.get('dt_pendiente') !== '1');

// ═══════════ TEST 4: borrados viajan (estado limpio) ═══════════
console.log('\n▶ TEST 4 — lo borrado en el otro cel acá también se borra');
await reset({
  dt_viajes_v1: viajes(['a', 'b', 'c']),
  dt_sync_en: '2000',
});
// el otro cel borró 'c'
T.snapActual = { data: () => ({ viajes: viajes(['a', 'b']), gastos: [], actualizadoEn: 3000, dispositivo: 'cel2' }) };
iniciarSyncDT('rudy');
await esperarPush();
check("'c' se borró acá también", lsViajes().length === 2 && idsDe(lsViajes()) === 'a,b', `→ quedaron: ${idsDe(lsViajes())}`);
check('no re-subió nada', T.setDocCalls.length === 0);

// ═══════════ TEST 5: unión con cambios sin subir ═══════════
console.log('\n▶ TEST 5 — 🛡️ agregaste X sin internet y el otro cel subió Y → quedan X e Y');
await reset({
  dt_viajes_v1: viajes(['a', 'b', 'X']),
  dt_gastos_v1: [{ id: 'g1', fecha: '2026-10-05', hora: '10:00', tipo: 'gasolina', monto: 10, nota: '' }],
  dt_sync_en: '2000',
  dt_pendiente: '1', // X y g1 no llegaron a subir
});
// mientras tanto el otro cel subió 'Y' y el gasto g2
T.snapActual = {
  data: () => ({
    viajes: viajes(['a', 'b', 'Y']),
    gastos: [{ id: 'g2', fecha: '2026-10-05', hora: '11:00', tipo: 'comida', monto: 15, nota: '' }],
    actualizadoEn: 3000, dispositivo: 'cel2',
  }),
};
iniciarSyncDT('rudy');
await esperarPush();
check('quedaron los 4 viajes (a, b, X, Y)', lsViajes().length === 4 && idsDe(lsViajes()) === 'X,Y,a,b',
  `→ viajes: ${idsDe(lsViajes())}`);
check('quedaron los 2 gastos (g1 y g2)', JSON.parse(lsMap.get('dt_gastos_v1') || '[]').length === 2);
check('la unión se subió a la nube', T.setDocCalls.length === 1 && T.setDocCalls[0].viajes.length === 4,
  `→ pushes: ${T.setDocCalls.length}, subidos: ${T.setDocCalls[0]?.viajes?.length}`);

// ═══════════ TEST 6: cel nuevo recibe todo ═══════════
console.log('\n▶ TEST 6 — cel nuevo (vacío) baja todo y las keys de IA quedan locales');
await reset({
  dt_config_v1: { geminiKey: 'K-SECRETA', metaDiaria: 100 }, // clave de IA que NO debe viajar
});
T.snapActual = {
  data: () => ({
    viajes: viajes(['r1', 'r2', 'r3']),
    gastos: [],
    config: { metaDiaria: 150, miNombre: 'Rudy' }, // sin keys de IA
    actualizadoEn: 3000, dispositivo: 'cel1',
  }),
};
iniciarSyncDT('rudy');
await esperarPush();
check('bajaron los 3 viajes de la nube', lsViajes().length === 3);
check('config de la nube aplicada (metaDiaria 150, miNombre Rudy)', (() => {
  const c = JSON.parse(lsMap.get('dt_config_v1')); return c.metaDiaria === 150 && c.miNombre === 'Rudy';
})());
check('la key de IA quedó SOLO en el teléfono', JSON.parse(lsMap.get('dt_config_v1')).geminiKey === 'K-SECRETA');
check('no subió nada innecesario (0 pushes)', T.setDocCalls.length === 0, `→ pushes: ${T.setDocCalls.length}`);

// ═══════════ TEST 7: v0.9.3 config completa viaja + vacío no pisa lleno ═══════════
console.log('\n▶ TEST 7 — v0.9.3: clave de Claude y Yapes viajan; vacío de la nube no borra el lleno local');
await reset({
  dt_viajes_v1: viajes(['a', 'X']), // X no está en la nube → fuerza re-subida de la unión
  dt_config_v1: {
    geminiKey: 'GEMI', claudeKey: 'sk-ant-SECRETA', metaDiaria: 100,
    yape: { numero: '980811297', titular: 'Lorenzo', qrBase64: 'data:img/qr' },
    plin: { numero: '', titular: '', qrBase64: '' },
  },
});
// la nube manda metaDiaria NUEVA pero con clave VACÍA y yape a medias (un cel sin configurar)
T.snapActual = {
  data: () => ({
    viajes: viajes(['a']),
    gastos: [],
    config: { metaDiaria: 150, claudeKey: '', yape: { numero: '956203893', titular: '', qrBase64: '' } },
    actualizadoEn: 3000, dispositivo: 'cel2',
  }),
};
iniciarSyncDT('rudy');
await esperarPush();
const cfg = JSON.parse(lsMap.get('dt_config_v1'));
check('metaDiaria de la nube aplicada (número sí se propaga)', cfg.metaDiaria === 150);
check('clave de Claude NO borrada por el vacío de la nube', cfg.claudeKey === 'sk-ant-SECRETA');
check('geminiKey local conservada (la nube no la mandó)', cfg.geminiKey === 'GEMI');
check('yape.numero de la nube aplicado (lleno pisa lleno)', cfg.yape.numero === '956203893');
check('yape.titular local conservado (vacío no pisa lleno)', cfg.yape.titular === 'Lorenzo');
check('QR de Yape local conservado', cfg.yape.qrBase64 === 'data:img/qr');
check('la config COMPLETA sube a la nube (claudeKey en el push)', T.setDocCalls.length === 1 && T.setDocCalls[0].config.claudeKey === 'sk-ant-SECRETA' && T.setDocCalls[0].config.geminiKey === 'GEMI',
  `→ pushes: ${T.setDocCalls.length}`);

// ═══════════ resumen ═══════════
console.log(`\n══════════════════════════════════`);
console.log(`RESULTADO: ${pass} ✓ / ${fail} ✗`);
iniciarSyncDT(null);
rmSync(OUT, { force: true });
process.exit(fail ? 1 : 0);
