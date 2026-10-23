// ─────────────────────────────────────────────────────────────
// 🧪 TEST — v0.11.9 FASE AJ: LA CONFIG YA NO MIENTE
//
// Compila el services/firestore.ts REAL con esbuild + stubs con
// control total de getDoc/setDoc (fallos, timeouts, permission).
// Prueba:
//   S1.  carga OK → datos del doc + estadoCargaConfig 'servidor'
//   S2.  getDoc falla UNA vez (bache de red) → REINTENTO y llega
//   S3.  getDoc SIEMPRE falla → defaults + estado 'error' (la UI avisa)
//   S4.  getDoc nunca responde → TIMEOUTS respetan LIMITES_CONFIG
//        (80ms en el test) + reintento → 'error' (no espera 9s viejos)
//   S5.  doc inexistente → defaults + estado 'vacio' (legítimo)
//   S6.  guardar OK → 'servidor' (1 solo setDoc)
//   S7.  guardar falla UNA vez → REINTENTA y llega ('servidor', 2 calls)
//   S8.  guardar nunca responde → 'local' optimista y SIN reintento
//        (el SDK ya lo encoló — reintentarlo lo duplicaría)
//   S9.  guardar permission-denied → REVIENTA sin reintentar (2× no tiene sentido)
//   S10. sincronizarYapeAlBot OK → 'servidor'; colgado → 'local' sin reintento
//   S11. sincronizarPlinAlBot OK → 'servidor'
//   S12. LIMITES_CONFIG mutable (el test lo acelera y el código lo obedece)
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
const OUT = path.join(REPO, 'test-sync', 'firestore-cfg-eb.cjs');

const stubPlugin = {
  name: 'stubs-config-honesta',
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
console.log('✓ services/firestore.ts REAL compilado con stubs (config honesta)');

const requireLocal = createRequire(import.meta.url);
const fsMod = requireLocal(OUT);
const {
  cargarConfigCuentas,
  guardarConfigCuentas,
  sincronizarYapeAlBot,
  sincronizarPlinAlBot,
  estadoCargaConfig,
  LIMITES_CONFIG,
  CONFIG_CUENTAS_DEFAULT,
} = fsMod;

const T = globalThis.__CFG_T__;
let pass = 0, fail = 0;
const check = (nombre, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};
const reset = (getDoc, setDoc) => {
  T.getDoc = Object.assign({ llamadas: 0 }, getDoc);
  T.setDoc = Object.assign({ llamadas: 0 }, setDoc);
  estadoCargaConfig.fuente = 'servidor';
  estadoCargaConfig.error = '';
};

// S12: acelerar los timeouts del módulo REAL (prueba de paso que es mutable)
const TIMEOUT_ORIGINAL = LIMITES_CONFIG.timeoutMs;
LIMITES_CONFIG.timeoutMs = 80;
LIMITES_CONFIG.reintentoMs = 30;
console.log('═══ TEST CONFIG HONESTA (v0.11.9) — timeouts acelerados a 80ms ═══');

console.log('S1: carga OK → datos + estado servidor');
{
  reset({ modo: 'ok', data: { yape: { nombre: 'Lorenzo', telefono: '980811297', qrBase64: 'data:image/jpeg;base64,AAA', qrUrl: '' } } });
  const cfg = await cargarConfigCuentas('uid-1');
  check('devuelve los datos del doc', cfg.yape.telefono === '980811297', JSON.stringify(cfg.yape));
  check('qrBase64 presente', cfg.yape.qrBase64 === 'data:image/jpeg;base64,AAA');
  check("estado 'servidor'", estadoCargaConfig.fuente === 'servidor', estadoCargaConfig.fuente);
  check('defaults sanos en lo que falta', cfg.plin.telefono === CONFIG_CUENTAS_DEFAULT.plin.telefono);
}

console.log('S2: bache de red en la LECTURA → reintenta y llega');
{
  reset({ modo: 'fallo-n', fallos: 1, data: { yape: { nombre: 'R', telefono: '999', qrBase64: '', qrUrl: '' } } });
  const t0 = Date.now();
  const cfg = await cargarConfigCuentas('uid-1');
  const dt = Date.now() - t0;
  check('el reintento rescató la lectura', cfg.yape.telefono === '999', JSON.stringify(cfg.yape));
  check('getDoc llamado 2 veces (reintento)', T.getDoc.llamadas === 2, String(T.getDoc.llamadas));
  check('esperó el reintentoMs (>=30ms)', dt >= 25, String(dt));
  check("estado 'servidor' tras el rescate", estadoCargaConfig.fuente === 'servidor');
}

console.log('S3: red muerta total en LECTURA → defaults + estado ERROR (la UI avisa)');
{
  reset({ modo: 'fallo-n', fallos: 99 });
  const cfg = await cargarConfigCuentas('uid-1');
  check('devuelve defaults (no se cuelga)', cfg === CONFIG_CUENTAS_DEFAULT);
  check("estado 'error' → la UI muestra el aviso", estadoCargaConfig.fuente === 'error', estadoCargaConfig.fuente);
  check('deja el error anotado', estadoCargaConfig.error.length > 0, estadoCargaConfig.error);
}

console.log('S4: servidor que no responde → timeout de LIMITES (80ms) + reintento');
{
  reset({ modo: 'nunca' });
  const t0 = Date.now();
  const cfg = await cargarConfigCuentas('uid-1');
  const dt = Date.now() - t0;
  check('defaults de emergencia', cfg === CONFIG_CUENTAS_DEFAULT);
  check('2 intentos (timeout + reintento)', T.getDoc.llamadas === 2, String(T.getDoc.llamadas));
  check('duró ~2×80+30ms, NO los 9s viejos', dt >= 150 && dt < 2000, String(dt) + 'ms');
  check("estado 'error'", estadoCargaConfig.fuente === 'error');
}

console.log('S5: doc inexistente → defaults LEGÍTIMOS (vacio ≠ error)');
{
  reset({ modo: 'vacio' });
  const cfg = await cargarConfigCuentas('uid-1');
  check('defaults', cfg === CONFIG_CUENTAS_DEFAULT);
  check("estado 'vacio' (no es un error de red)", estadoCargaConfig.fuente === 'vacio', estadoCargaConfig.fuente);
}

console.log('S6: guardar OK → servidor, 1 solo write');
{
  reset({ modo: 'ok' }, { modo: 'ok' });
  const como = await guardarConfigCuentas('uid-1', CONFIG_CUENTAS_DEFAULT);
  check("devuelve 'servidor'", como === 'servidor', String(como));
  check('1 solo setDoc', T.setDoc.llamadas === 1, String(T.setDoc.llamadas));
}

console.log('S7: guardar con bache → reintenta y llega');
{
  reset({ modo: 'ok' }, { modo: 'fallo-n', fallos: 1 });
  const como = await guardarConfigCuentas('uid-1', CONFIG_CUENTAS_DEFAULT);
  check("rescatado: 'servidor'", como === 'servidor', String(como));
  check('2 setDoc (reintento)', T.setDoc.llamadas === 2, String(T.setDoc.llamadas));
}

console.log('S8: guardar colgado → LOCAL optimista y SIN reintento (no duplicar)');
{
  reset({ modo: 'ok' }, { modo: 'nunca' });
  const t0 = Date.now();
  const como = await guardarConfigCuentas('uid-1', CONFIG_CUENTAS_DEFAULT);
  const dt = Date.now() - t0;
  check("devuelve 'local' (optimista, la UI avisa)", como === 'local', String(como));
  check('SIN reintento: 1 solo setDoc encolado', T.setDoc.llamadas === 1, String(T.setDoc.llamadas));
  check('duró el timeout (80ms), no más', dt >= 70 && dt < 1000, String(dt) + 'ms');
}

console.log('S9: permission-denied al guardar → REVIENTA sin reintentar');
{
  reset({ modo: 'ok' }, { modo: 'permiso' });
  let reventó = false;
  try { await guardarConfigCuentas('uid-1', CONFIG_CUENTAS_DEFAULT); }
  catch (e) { reventó = true; }
  check('lanza el error (reglas/pesos de verdad)', reventó);
  check('no gastó reintentos inútiles', T.setDoc.llamadas === 1, String(T.setDoc.llamadas));
}

console.log('S10: sincronizarYapeAlBot — ok y colgado');
{
  reset({ modo: 'ok' }, { modo: 'ok' });
  const como = await sincronizarYapeAlBot('uid-1', { qrBase64: 'data:image/jpeg;base64,AA', numero: '980811297', titular: 'Lorenzo.Tar' });
  check("sync yape OK → 'servidor'", como === 'servidor', String(como));
  reset({ modo: 'ok' }, { modo: 'nunca' });
  const como2 = await sincronizarYapeAlBot('uid-1', { qrBase64: '', numero: '1', titular: 'x' });
  check("sync yape colgado → 'local' optimista", como2 === 'local', String(como2));
  check('sin duplicar el write', T.setDoc.llamadas === 1, String(T.setDoc.llamadas));
}

console.log('S11: sincronizarPlinAlBot — ok');
{
  reset({ modo: 'ok' }, { modo: 'ok' });
  const como = await sincronizarPlinAlBot('uid-1', { qrBase64: 'data:image/jpeg;base64,AA', numero: '980811297', titular: 'Lourdes' });
  check("sync plin OK → 'servidor'", como === 'servidor', String(como));
}

console.log('S12: LIMITES_CONFIG — restaurar y verificar default 30s');
{
  LIMITES_CONFIG.timeoutMs = TIMEOUT_ORIGINAL;
  LIMITES_CONFIG.reintentoMs = 2000;
  check('timeout por defecto: 30000ms (doc de ~300KB)', LIMITES_CONFIG.timeoutMs === 30000, String(LIMITES_CONFIG.timeoutMs));
  check('reintento por defecto: 2000ms', LIMITES_CONFIG.reintentoMs === 2000);
}

console.log('');
console.log(`RESULTADO: ${pass} ✓ / ${fail} ✗`);
process.exit(fail === 0 ? 0 : 1);
