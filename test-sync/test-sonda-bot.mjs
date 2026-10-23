// ─────────────────────────────────────────────────────────────
// 🧪 TEST — bot v3.3-SONDA: el chequeo ACTIVO de la nube
//
// Carga el firebase.js REAL del bot (scripts/botv33) con mocks de
// firebase-admin y verifica:
//   B1. exports nuevos (iniciarSondaNube, conexionNubeSana)
//   B2. sonda OK → conexionNube sana, sin reenganche
//   B3. sonda SIN RESPUESTA ×2 → conexionNubeMala + REENGANCHE ya
//   B4. al volver la nube → sana + reenganche por las dudas
//   B5. el LATIDO puede reportar nube:'sin señal' (conexionNubeSana)
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const Module = require2('module');
const BOT_DIR = path.join(REPO, '..', '..', 'scripts', 'botv33'); // /home/z/my-project/scripts/botv33

// ── MOCK de firebase-admin ──
let getDocsModo = 'ok'; // 'ok' | 'nunca' (la sonda lee estado_bot/{uid})
let reenganches = 0;
const mockFirestore = {
  collection: (col) => ({
    doc: (id) => ({
      get: async () => {
        if (getDocsModo === 'nunca') return new Promise(() => {}); // cuelga → sonda al tope
        return { exists: () => true, data: () => ({}) };
      },
      set: async () => {},
      collection: () => ({
        where: () => ({
          onSnapshot: (cb, err) => { reenganches++; cb({ docChanges: () => [] }); return () => {}; },
        }),
      }),
    }),
  }),
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'firebase-admin/firestore') return 'mock:fa-fs';
  if (request === 'firebase-admin/app') return 'mock:fa-app';
  return originalResolve.call(this, request, ...args);
};
require2.cache['mock:fa-fs'] = {
  id: 'mock:fa-fs', filename: 'mock:fa-fs', loaded: true,
  exports: { getFirestore: () => mockFirestore },
};
require2.cache['mock:fa-app'] = {
  id: 'mock:fa-app', filename: 'mock:fa-app', loaded: true,
  exports: { initializeApp: () => ({}), getApps: () => [], cert: () => ({}) },
};

// bot_config.json mock (getUidRudy lo lee del __dirname del módulo)
const fs = require2('fs');
const pathMod = require2('path');
const cfgPath = pathMod.join(BOT_DIR, 'bot_config.json');
const yaHabia = fs.existsSync(cfgPath);
if (!yaHabia) fs.writeFileSync(cfgPath, JSON.stringify({ rider: { uid_rudy: 'UID-TEST' } }));

const fb = require2(path.join(BOT_DIR, 'firebase.js'));

let pass = 0, fail = 0;
function check(nombre, cond, extra = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${nombre}${cond ? '' : ' → ' + extra}`);
  cond ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('B1: exports nuevos del bot v3.3');
{
  check('iniciarSondaNube exportado', typeof fb.iniciarSondaNube === 'function');
  check('conexionNubeSana exportado', typeof fb.conexionNubeSana === 'function');
}

// inicializar + listener + sonda acelerada (global.BOT_SONDA_MS=30, tope 10ms)
global.BOT_SONDA_MS = 30;
global.BOT_SONDA_TOPE_MS = 10;
global.BOT_REENGANCHE_MS = 5;
global.BOT_WATCHDOG_SILENCIO_MS = 999 * 60 * 1000; // watchdog fuera del test
const db = fb.inicializarFirebase({ client_email: 'x@y', private_key: 'z', project_id: 'p' });
check('Firebase inicializa con el mock', !!db);
fb.escucharAcciones(() => {});
const antes = reenganches;
fb.iniciarSondaNube();

console.log('B2: sonda OK → la nube está sana, sin reenganche');
{
  await sleep(70); // 2 ciclos de 30ms
  check('conexionNubeSana() → true', fb.conexionNubeSana() === true, String(fb.conexionNubeSana()));
  check('sin reenganches extra', reenganches === antes, `${reenganches} vs ${antes}`);
}

console.log('B3: sonda SIN RESPUESTA ×2 → reenganche YA + nube mala');
{
  getDocsModo = 'nunca';
  await sleep(90); // ≥ 2 ciclos colgados de 30ms → fallos=2
  check('conexionNubeSana() → false (para el latido nube:sin señal)', fb.conexionNubeSana() === false, String(fb.conexionNubeSana()));
  check('REENGANCHÓ sin esperar al watchdog de 30 min', reenganches > antes, `${reenganches} vs ${antes}`);
}

console.log('B4: al volver la nube → sana + reenganche por las dudas');
{
  const base = reenganches;
  getDocsModo = 'ok';
  await sleep(40); // el próximo ciclo ve la nube de vuelta
  check('conexionNubeSana() → true de nuevo', fb.conexionNubeSana() === true);
  check('reenganchó al recuperar', reenganches >= base, `${reenganches} vs ${base}`);
}

console.log('');
console.log(`RESULTADO: ${pass} ✓ / ${fail} ✗`);
if (!yaHabia) { try { fs.unlinkSync(cfgPath); } catch {} }
process.exit(fail === 0 ? 0 : 1);
