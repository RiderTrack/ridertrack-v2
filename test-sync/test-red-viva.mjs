// ─────────────────────────────────────────────────────────────
// 🧪 TEST — v0.11.10 FASE AK: RED VIVA (la conexión zombi, nunca más)
//
// Compila el services/redViva.ts REAL con esbuild + stubs con control
// total de disableNetwork/enableNetwork y de los eventos del entorno
// (document.visibilitychange / Capacitor appStateChange / window online).
// Prueba:
//   V1. refrescarConexion → disable+enable en orden y devuelve true
//   V2. debounce: llamada inmediata siguiente IGNORADA (≤15s del ciclo)
//   V3. escondida ≥ escondidaMinimaMs → al volver visible REFRESCA
//   V4. escondida un segundo → al volver visible NO refresca (no molestar)
//   V5. window 'online' → REFRESCA (volvió la señal)
//   V6. Capacitor appStateChange isActive tras escondida → REFRESCA
//   V7. ciclo ocupado (disable lento) → otra llamada no se mete
//   V8. desinstalar() saca los ganchos (eventos posteriores no refrescan)
//   V9. LIMITES_RED_VIVA mutable (el test acelera y el código obedece)
//   V10. disableNetwork que revienta → devuelve false y no revienta
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const STUB_FS = path.join(REPO, 'test-sync', 'stub-red-fx.cjs');
const STUB_APP = path.join(REPO, 'test-sync', 'stub-firebase-app.cjs');
const STUB_CAPAPP = path.join(REPO, 'test-sync', 'stub-cap-app.cjs');
const STUB_CAPCORE = path.join(REPO, 'test-sync', 'stub-cap-core.cjs');
const OUT = path.join(REPO, 'test-sync', 'red-viva-eb.cjs');

await esbuild.build({
  entryPoints: [path.join(REPO, 'src/services/redViva.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  external: [],
  plugins: [{
    name: 'stubs-red-viva',
    setup(build) {
      build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: STUB_FS }));
      build.onResolve({ filter: /^\.\/firebase$/ }, () => ({ path: STUB_APP }));
      build.onResolve({ filter: /^@capacitor\/app$/ }, () => ({ path: STUB_CAPAPP }));
      build.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: STUB_CAPCORE }));
    },
  }],
  logLevel: 'silent',
});

// ── entorno DOM falso ANTES de cargar el módulo ──
// (los globals los crean los stubs al cargarse; los pre-creamos acá
//  con la MISMA forma para poder configurar antes del primer require)
const T = globalThis.__RED_T__ || (globalThis.__RED_T__ = {
  __orden: [], disableDelayMs: 0, disableFalla: false,
});
T.__orden.length = 0;
const CAP = globalThis.__CAP_T__ || (globalThis.__CAP_T__ = { __handlers: {} });
CAP.__handlers = {};

const escuchasDoc = {};
globalThis.document = {
  visibilityState: 'visible',
  addEventListener: (ev, fn) => { (escuchasDoc[ev] = escuchasDoc[ev] || []).push(fn); },
  removeEventListener: (ev, fn) => {
    escuchasDoc[ev] = (escuchasDoc[ev] || []).filter((f) => f !== fn);
  },
};
const escuchasWin = {};
globalThis.window = {
  addEventListener: (ev, fn) => { (escuchasWin[ev] = escuchasWin[ev] || []).push(fn); },
  removeEventListener: (ev, fn) => {
    escuchasWin[ev] = (escuchasWin[ev] || []).filter((f) => f !== fn);
  },
};

const { refrescarConexion, instalarRedViva, estuvoEscondidaSuficiente, LIMITES_RED_VIVA, _resetRedViva, registroRefrescos } = require2(OUT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
function check(nombre, cond, extra = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${nombre}${cond ? '' : ' → ' + extra}`);
  cond ? pass++ : fail++;
}

// 🧪 acelerar: ciclos de 40ms, escondida mínima 60ms
LIMITES_RED_VIVA.entreCiclosMs = 40;
LIMITES_RED_VIVA.escondidaMinimaMs = 60;

console.log('V1: refrescarConexion → disable+enable en orden');
{
  _resetRedViva();
  T.__orden.length = 0; T.disableDelayMs = 0; T.disableFalla = false;
  const ok = await refrescarConexion('test');
  check('devuelve true', ok === true, String(ok));
  check('secuencia disable→enable', T.__orden.join(',') === 'disable,enable', T.__orden.join(','));
  check('registro anotado con el motivo', registroRefrescos.length === 1 && registroRefrescos[0].motivo === 'test', JSON.stringify(registroRefrescos));
}

console.log('V2: debounce — la llamada inmediata siguiente se IGNORA');
{
  const ok2 = await refrescarConexion('apurado');
  check('ignorada (false)', ok2 === false, String(ok2));
  check('sigue 1 ciclo en el registro', registroRefrescos.length === 1, String(registroRefrescos.length));
  await sleep(50); // pasó el tope de 40ms → ya puede
  const ok3 = await refrescarConexion('después de esperar');
  check('pasado el tope → refresca', ok3 === true, String(ok3));
}

console.log('V3: escondida ≥ mínima → al volver visible REFRESCA');
{
  _resetRedViva();
  T.__orden.length = 0; T.disableDelayMs = 0; T.disableFalla = false;
  const desinstalar = instalarRedViva();
  // esconder (visibilitychange → hidden)
  globalThis.document.visibilityState = 'hidden';
  escuchasDoc['visibilitychange'].forEach((f) => f());
  await sleep(80); // ≥ escondidaMinimaMs
  globalThis.document.visibilityState = 'visible';
  escuchasDoc['visibilitychange'].forEach((f) => f());
  await sleep(10);
  check('refrescó al volver ("app reabierta")', T.__orden.length === 2 && registroRefrescos.some((r) => r.motivo === 'app reabierta'), JSON.stringify(registroRefrescos.map((r) => r.motivo)));
  desinstalar();
}

console.log('V4: escondida un segundo → NO refresca (no molestar)');
{
  _resetRedViva();
  T.__orden.length = 0; T.disableDelayMs = 0; T.disableFalla = false;
  const desinstalar = instalarRedViva();
  globalThis.document.visibilityState = 'hidden';
  escuchasDoc['visibilitychange'].forEach((f) => f());
  await sleep(5); // < escondidaMinimaMs
  globalThis.document.visibilityState = 'visible';
  escuchasDoc['visibilitychange'].forEach((f) => f());
  await sleep(10);
  check('NO gastó un ciclo', T.__orden.length === 0, JSON.stringify(T.__orden));
  desinstalar();
}

console.log('V5: window "online" → REFRESCA (volvió la señal)');
{
  _resetRedViva();
  T.__orden.length = 0; T.disableDelayMs = 0; T.disableFalla = false;
  const desinstalar = instalarRedViva();
  await sleep(45); // libre del debounce
  escuchasWin['online'].forEach((f) => f());
  await sleep(10);
  check('refrescó con "volvió la señal"', T.__orden.length === 2 && registroRefrescos.some((r) => r.motivo === 'volvió la señal'), JSON.stringify(registroRefrescos.map((r) => r.motivo)));
  desinstalar();
}

console.log('V6: Capacitor appStateChange isActive tras escondida → REFRESCA');
{
  _resetRedViva();
  T.__orden.length = 0; T.disableDelayMs = 0; T.disableFalla = false;
  const desinstalar = instalarRedViva();
  // esconder por el lado nativo
  CAP.__handlers['appStateChange']({ isActive: false });
  await sleep(80); // ≥ escondidaMinimaMs
  CAP.__handlers['appStateChange']({ isActive: true });
  await sleep(10);
  check('refrescó con "app activa (APK)"', T.__orden.length === 2 && registroRefrescos.some((r) => r.motivo === 'app activa (APK)'), JSON.stringify(registroRefrescos.map((r) => r.motivo)));
  desinstalar();
}

console.log('V7: ciclo ocupado (disable lento) → otra llamada no se mete');
{
  _resetRedViva();
  T.__orden.length = 0; T.disableDelayMs = 0; T.disableFalla = false;
  T.disableDelayMs = 60;
  const p = refrescarConexion('lento');
  await sleep(5); // el ciclo ya arrancó (ocupado)
  const ok2 = await refrescarConexion('intruso');
  check('intruso rechazado mientras hay un ciclo andando', ok2 === false, String(ok2));
  await p;
  T.disableDelayMs = 0;
  check('el ciclo lento terminó bien', T.__orden.join(',') === 'disable,enable', T.__orden.join(','));
}

console.log('V8: desinstalar() saca los ganchos');
{
  _resetRedViva();
  T.__orden.length = 0; T.disableDelayMs = 0; T.disableFalla = false;
  const desinstalar = instalarRedViva();
  desinstalar();
  await sleep(45); // libre del debounce
  escuchasWin['online'].forEach((f) => f());
  escuchasDoc['visibilitychange'].forEach((f) => f());
  await sleep(10);
  check('los eventos ya no refrescan', T.__orden.length === 0, JSON.stringify(T.__orden));
  check('sin handler de Capacitor vivo', !CAP.__handlers['appStateChange'], 'handler presente');
}

console.log('V9: estuvoEscondidaSuficiente — lógica pura');
{
  LIMITES_RED_VIVA.escondidaMinimaMs = 100;
  _resetRedViva();
  const desinstalar = instalarRedViva();
  globalThis.document.visibilityState = 'hidden';
  escuchasDoc['visibilitychange'].forEach((f) => f());
  check('recién escondida (~0ms) → false', estuvoEscondidaSuficiente() === false);
  await sleep(110);
  check('escondida 110ms+ → true', estuvoEscondidaSuficiente() === true);
  globalThis.document.visibilityState = 'visible';
  escuchasDoc['visibilitychange'].forEach((f) => f());
  check('al volver → ya no está escondida', estuvoEscondidaSuficiente() === false);
  await sleep(60); // dejar terminar el ciclo asincrónico de 'app reabierta' antes de seguir
  desinstalar();
  LIMITES_RED_VIVA.escondidaMinimaMs = 60;
}

console.log('V10: disableNetwork que revienta → false, sin excepción');
{
  _resetRedViva();
  T.__orden.length = 0; T.disableDelayMs = 0; T.disableFalla = false;
  T.disableFalla = true;
  await sleep(45); // libre del debounce
  const ok = await refrescarConexion('con-error');
  check('devuelve false sin reventar', ok === false, String(ok));
  check('nada de enable después del fallo', T.__orden.length === 1 && T.__orden[0] === 'disable', JSON.stringify(T.__orden));
  T.disableFalla = false;
}

console.log('V11: LIMITES_RED_VIVA — defaults de producción');
{
  LIMITES_RED_VIVA.entreCiclosMs = 15000;
  LIMITES_RED_VIVA.escondidaMinimaMs = 15000;
  check('debounce por defecto: 15000ms', LIMITES_RED_VIVA.entreCiclosMs === 15000, String(LIMITES_RED_VIVA.entreCiclosMs));
  check('escondida mínima por defecto: 15000ms', LIMITES_RED_VIVA.escondidaMinimaMs === 15000);
}

console.log('');
console.log(`RESULTADO: ${pass} ✓ / ${fail} ✗`);
process.exit(fail === 0 ? 0 : 1);
