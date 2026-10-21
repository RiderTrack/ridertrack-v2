// ─────────────────────────────────────────────────────────────
// 🧪 TEST — v0.11.7: 🩺 subscribeEstadoBot + probarBot
//
// El bot v3-blindado escribe estado_bot/{uid} cada 60s. La app LEE
// ese doc en Configuración → "Bot de WhatsApp (RudyBot)" para
// mostrar 🟢 vivo / 🔴 caído. Este test compila el
// services/firestore.ts REAL con esbuild + stubs (patrón FASE Z)
// y prueba:
//   S1. Latido completo → mapeo EXACTO a EstadoBot (7 campos).
//   S2. Doc inexistente → null (la UI muestra "Sin señal").
//   S3. Doc con campos faltantes → defaults sanos ('?', 0, '').
//   S4. Unsubscribe → devuelve la función de limpieza y no revienta.
//   S5. probarBot → encola {tipo: 'probar_bot', processed: false,
//       telefono: ''} en acciones_bot/{uid}/pendientes (el bot v3
//       le manda la prueba al número de avisos de Rudy).
//   S6. Sin uid → no se suscribe y no revienta (devuelve no-op).
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
const OUT = path.join(REPO, 'test-sync', 'firestore-eb.cjs');

const stubPlugin = {
  name: 'stubs-estado-bot',
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
console.log('✓ services/firestore.ts REAL compilado con stubs (estado bot)');

const lsMap = new Map();
globalThis.localStorage = {
  getItem: k => (lsMap.has(k) ? lsMap.get(k) : null),
  setItem: (k, v) => lsMap.set(k, String(v)),
  removeItem: k => lsMap.delete(k),
};

const requireLocal = createRequire(import.meta.url);
const fsMod = requireLocal(OUT);
const { subscribeEstadoBot, probarBot } = fsMod;
const T = globalThis.__SYNC_TEST__;

const esperarTick = () => new Promise(r => setTimeout(r, 30));
let pass = 0, fail = 0;
const check = (nombre, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};

console.log('═══ TEST ESTADO BOT (v0.11.7) ═══');

// ── S1: latido COMPLETO → mapeo exacto ──
console.log('S1: latido completo → mapeo EXACTO');
{
  T.snapActual = {
    exists: () => true,
    data: () => ({
      vivo: true,
      lastSeen: '2026-10-21T15:00:00.000Z',
      version: 'v3-blindado',
      whatsapp: 'conectado',
      listenerAcciones: 'vivo',
      enCola: 4,
      procesando: 'enviar_yape',
    }),
  };
  let recibido = undefined;
  const unsub = subscribeEstadoBot('uid-rudy', (e) => { recibido = e; });
  await esperarTick();
  check('llega el estado del bot', !!recibido, JSON.stringify(recibido));
  check('vivo: true', recibido && recibido.vivo === true);
  check('lastSeen ISO exacto', recibido && recibido.lastSeen === '2026-10-21T15:00:00.000Z');
  check('version v3-blindado', recibido && recibido.version === 'v3-blindado');
  check('whatsapp conectado', recibido && recibido.whatsapp === 'conectado');
  check('listenerAcciones vivo', recibido && recibido.listenerAcciones === 'vivo');
  check('enCola: 4 (number)', recibido && recibido.enCola === 4);
  check('procesando: enviar_yape', recibido && recibido.procesando === 'enviar_yape');
  check('unsub es función', typeof unsub === 'function');
  unsub();
}

// ── S2: doc inexistente → null ──
console.log('S2: doc inexistente → null (UI: "Sin señal")');
{
  T.snapActual = null; // el stub emite exists:false por defecto
  let recibido = 'nunca';
  subscribeEstadoBot('uid-rudy', (e) => { recibido = e; });
  await esperarTick();
  check('devuelve null cuando el doc no existe', recibido === null, JSON.stringify(recibido));
}

// ── S3: campos faltantes → defaults sanos ──
console.log('S3: campos faltantes → defaults sanos');
{
  T.snapActual = {
    exists: () => true,
    data: () => ({ vivo: true, lastSeen: '2026-10-21T15:05:00.000Z' }),
  };
  let recibido = undefined;
  subscribeEstadoBot('uid-rudy', (e) => { recibido = e; });
  await esperarTick();
  check('mapea aunque falten campos', !!recibido);
  check("version default '?'", recibido && recibido.version === '?');
  check("whatsapp default '?'", recibido && recibido.whatsapp === '?');
  check('enCola default 0 (number)', recibido && recibido.enCola === 0);
  check("procesando default ''", recibido && recibido.procesando === '');
}

// ── S4: vivos los tipos ──
console.log('S4: tipos del latido');
{
  T.snapActual = {
    exists: () => true,
    data: () => ({ vivo: false, lastSeen: '2026-10-21T14:00:00.000Z', version: 123, enCola: '7' }),
  };
  let recibido = undefined;
  subscribeEstadoBot('uid-rudy', (e) => { recibido = e; });
  await esperarTick();
  check('vivo: false se respeta', recibido && recibido.vivo === false);
  check("version número → '?' (string saneado)", recibido && recibido.version === '?');
  check("enCola string '7' → 0 (número saneado)", recibido && recibido.enCola === 0);
}

// ── S5: probarBot → acción probar_bot en la cola ──
console.log('S5: probarBot encola la acción correcta');
{
  T.setDocCalls.length = 0;
  T.setDocImpl = null;
  await probarBot('uid-rudy');
  const llamada = T.setDocCalls[0];
  check('escribió un doc en la cola', T.setDocCalls.length === 1, String(T.setDocCalls.length));
  check("tipo: 'probar_bot'", llamada && llamada.tipo === 'probar_bot', JSON.stringify(llamada));
  check('processed: false', llamada && llamada.processed === false);
  check("telefono: '' (el bot v3 usa el número de avisos)", llamada && llamada.telefono === '');
  check('createdAt ISO presente', llamada && typeof llamada.createdAt === 'string');
}

// ── S6: sin uid → no-op sin reventar ──
console.log('S6: sin uid → no-op');
{
  const susAntes = T.suscripciones;
  const unsub = subscribeEstadoBot('', () => {});
  check('no se suscribe con uid vacío', T.suscripciones === susAntes);
  check('y devuelve una función (no-op)', typeof unsub === 'function');
}

console.log(`═══ RESUMEN: ${pass} ✓ / ${fail} ✗ ═══`);
process.exit(fail === 0 ? 0 : 1);
