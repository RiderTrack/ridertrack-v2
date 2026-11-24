// ═══════════════════════════════════════════════════════════
// 💜 TEST FASE BG — v0.11.34
// 1) MI YAPE: los dos Yapes (personal + empresa) — saldos,
//    chapes, depósitos, gastos, fijar-saldo, sync vivo.
// 2) REABRIR la caja de DÍAS PASADOS (ayer, anteayer…).
// Corre con: node test-sync/test-fase-bg.mjs
//   G0. yapeCore puro: efectos/saldos/resumen del día,
//       compactación (el saldo nunca se rompe), saneo
//       defensivo, fusión y tombstones
//   G1. servicio: anotar → persiste local + sube el campo
//       `yape` del doc usuarios/{uid} (sin reglas nuevas)
//   G2. 🔄 FASE W: la nube del otro celular se funde; lo
//       borrado NO resucita (tombstone)
//   G3. ⚙️ fijarSaldo: el saldo queda clavado al número real
//   G4. 🔓 reabrirCaja de AYER (el fix FASE BG): borra SOLO el
//       cierre de ese día + tombstone + anti-resurrección +
//       regresión (sin fecha → HOY, fecha inexistente → no-op)
//   G5. contrato de fuente: YapeCard/Sidebar/caja.ts/CajaCard
//       + versiones 0.11.34
// ═══════════════════════════════════════════════════════════
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'node:fs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const STUB_FS = path.join(REPO, 'test-sync', 'stub-firestore.cjs');
const STUB_DB = path.join(REPO, 'test-sync', 'stub-db.cjs');
const OUT_YAPE = path.join(REPO, 'test-sync', 'yape-bg.compilado.cjs');
const OUT_CORE = path.join(REPO, 'test-sync', 'yapeCore-bg.compilado.cjs');
const OUT_CAJA = path.join(REPO, 'test-sync', 'caja-bg.compilado.cjs');

const stubPlugin = {
  name: 'stubs-fase-bg',
  setup(build) {
    build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: STUB_FS }));
    build.onResolve({ filter: /^\.\/firebase$/ }, (a) => ({ path: STUB_DB }));
  },
};

await esbuild.build({
  entryPoints: [path.join(REPO, 'src/services/yape.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT_YAPE,
  plugins: [stubPlugin],
  logLevel: 'silent',
});
await esbuild.build({
  entryPoints: [path.join(REPO, 'src/utils/yapeCore.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT_CORE,
  logLevel: 'silent',
});
await esbuild.build({
  entryPoints: [path.join(REPO, 'src/services/caja.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT_CAJA,
  plugins: [stubPlugin],
  logLevel: 'silent',
});
console.log('✓ yape.ts, yapeCore.ts y caja.ts reales compilados con stubs');

// ── globals de navegador (mismo patrón test-fase-be) ──
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
const yape = requireLocal(OUT_YAPE);
const core = requireLocal(OUT_CORE);
const caja = requireLocal(OUT_CAJA);
const { arrancarYape, snapshotYape, agregarMovimiento, eliminarMovimiento, fijarSaldo } = yape;
const { arrancarCaja, snapshotCaja, cerrarCaja, reabrirCaja, cambiarFechaCierre } = caja;
const T = globalThis.__SYNC_TEST__;

const esperar = ms => new Promise(r => setTimeout(r, ms));
const esperarTick = () => esperar(30);
let pass = 0, fail = 0;
const ok = (nombre, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};

const f = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const HOY = f(0), AYER = f(-1);
const tsDe = iso => new Date(`${iso}T12:00:00`).getTime();
const mov = (id, tipo, cuenta, monto, dias = 0, tsExtra = 0) => ({
  id, tipo, cuenta, monto, ts: tsDe(f(-dias)) + tsExtra,
});
const docYape = (yapeObj) => ({ exists: () => true, data: () => ({ yape: yapeObj }) });
const docCaja = (cajaObj) => ({ exists: () => true, data: () => ({ caja: cajaObj }) });
const resetTest = () => { T.snapActual = null; T.setDocCalls = []; T.setDocImpl = null; eventos.length = 0; };

// ══ G0. yapeCore puro ══
console.log('\n▶ G0 — yapeCore puro (efectos, saldos, compactación, saneo, tombstones)');
{
  const {
    efectoDe, saldosYape, resumenYape, movsDeFecha, compactarMovs, MAX_MOVS,
    normalizarMovs, fusionarMovs, filtrarBorradosYape, fusionarBorradosYape,
    podarBorradosYape, tombstoneMov, nuevoMovId, infoTipoYape,
    ID_BASE_PERSONAL, ID_BASE_EMPRESA,
  } = core;

  ok('chape: +monto al personal', efectoDe(mov('a', 'chape', 'personal', 15)).personal === 15 && efectoDe(mov('a', 'chape', 'personal', 15)).empresa === 0);
  ok('gasto personal: −monto', efectoDe(mov('a', 'gasto', 'personal', 20)).personal === -20);
  ok('gasto empresa: −monto en la empresa', efectoDe(mov('a', 'gasto', 'empresa', 20)).empresa === -20);
  const dep = efectoDe(mov('a', 'deposito', 'personal', 45));
  ok('deposito: −personal / +empresa', dep.personal === -45 && dep.empresa === 45);
  const ret = efectoDe(mov('a', 'retiro', 'empresa', 10));
  ok('retiro: +personal / −empresa', ret.personal === 10 && ret.empresa === -10);
  const aj = efectoDe(mov('a', 'ajuste', 'personal', -7.5));
  ok('ajuste negativo se respeta', aj.personal === -7.5);
  ok('ajuste empresa va a la empresa', efectoDe(mov('a', 'ajuste', 'empresa', 30)).empresa === 30);

  // saldos: 2 chapes (15+20) − gasto 5 − deposito 30 + retiro 10 = 10
  const escenario = [
    mov('c1', 'chape', 'personal', 15), mov('c2', 'chape', 'personal', 20),
    mov('g1', 'gasto', 'personal', 5), mov('d1', 'deposito', 'personal', 30),
    mov('r1', 'retiro', 'empresa', 10),
  ];
  const saldos = saldosYape(escenario);
  ok('saldo personal = 10 (15+20−5−30+10)', Math.abs(saldos.personal - 10) < 0.001);
  ok('saldo empresa = 20 (+30 −10)', Math.abs(saldos.empresa - 20) < 0.001);
  ok('saldos con lista vacía → 0/0', saldosYape([]).personal === 0 && saldosYape([]).empresa === 0);

  // resumen del día: los de HOY cuentan, los de ayer no (pero sí el saldo)
  const conAyer = [...escenario, { ...mov('c3', 'chape', 'personal', 8), ts: tsDe(AYER) }];
  const r = resumenYape(conAyer, HOY);
  ok('hoy: 2 chapes = S/ 35', r.hoyNChapes === 2 && Math.abs(r.hoyChapes - 35) < 0.001);
  ok('hoy: depositado 30, retirado 10', r.hoyDepositado === 30 && r.hoyRetirado === 10);
  ok('hoy: gasto personal 5, empresa 0', r.hoyGastoPersonal === 5 && r.hoyGastoEmpresa === 0);
  ok('hoy: 5 movimientos (el de ayer NO)', r.hoyN === 5);
  ok('saldo global incluye el chape de ayer (18)', Math.abs(r.saldoPersonal - 18) < 0.001);
  ok('movsDeFecha devuelve solo los de HOY', movsDeFecha(conAyer, HOY).length === 5);

  // compactación: el saldo JAMÁS se rompe
  const muchos = [];
  for (let i = 0; i < MAX_MOVS + 25; i++) muchos.push(mov(`m${i}`, i % 2 ? 'chape' : 'deposito', 'personal', 2, 1, i * 1000));
  const antes = saldosYape(muchos);
  const compactados = compactarMovs(muchos);
  const despues = saldosYape(compactados);
  ok(`compactación: ${muchos.length} → ${compactados.length} (≤ MAX_MOVS)`, compactados.length <= MAX_MOVS);
  ok('compactación: el saldo queda EXACTO (personal)', Math.abs(antes.personal - despues.personal) < 0.001);
  ok('compactación: el saldo queda EXACTO (empresa)', Math.abs(antes.empresa - despues.empresa) < 0.001);
  ok('compactación: crea las bases con nota explicativa',
    compactados.some(m => m.id === ID_BASE_PERSONAL && m.tipo === 'ajuste') &&
    compactados.some(m => m.id === ID_BASE_EMPRESA && m.tipo === 'ajuste'));
  ok('compactación: bajo el tope no toca nada', compactarMovs(escenario).length === escenario.length);

  // doble compactación (bases viejas incluidas en la nueva)
  const doble = [...compactados, ...muchos.slice(0, 30).map((m, i) => ({ ...m, id: `x${i}` }))];
  const saldosDobleAntes = saldosYape(doble);
  const reCompactados = compactarMovs(doble);
  const saldosDobleDespues = saldosYape(reCompactados);
  ok('re-compactación: el saldo sigue exacto',
    Math.abs(saldosDobleAntes.personal - saldosDobleDespues.personal) < 0.001 &&
    Math.abs(saldosDobleAntes.empresa - saldosDobleDespues.empresa) < 0.001);

  // saneo defensivo
  ok('basura (null/números/strings) → fuera', normalizarMovs([null, 42, 'hola', {}]).length === 0);
  ok('sin id → fuera', normalizarMovs([{ tipo: 'chape', cuenta: 'personal', monto: 5, ts: 1 }]).length === 0);
  ok('tipo inválido → fuera', normalizarMovs([{ id: 'a', tipo: 'robo', cuenta: 'personal', monto: 5, ts: 1 }]).length === 0);
  ok('monto 0 en un gasto → fuera (basura)', normalizarMovs([{ id: 'a', tipo: 'gasto', cuenta: 'personal', monto: 0, ts: 1 }]).length === 0);
  ok('monto negativo en un chape → fuera', normalizarMovs([{ id: 'a', tipo: 'chape', cuenta: 'personal', monto: -5, ts: 1 }]).length === 0);
  ok('ajuste negativo se QUEDA (es válido)', normalizarMovs([{ id: 'a', tipo: 'ajuste', cuenta: 'personal', monto: -5, ts: 1 }]).length === 1);
  ok('NaN monto → fuera', normalizarMovs([{ id: 'a', tipo: 'gasto', cuenta: 'personal', monto: 'x', ts: 1 }]).length === 0);
  ok('cuenta rara → cae a personal', normalizarMovs([{ id: 'a', tipo: 'gasto', cuenta: 'otra', monto: 5, ts: 1 }])[0].cuenta === 'personal');
  ok('nota larga se recorta a 80', normalizarMovs([{ id: 'a', tipo: 'chape', cuenta: 'personal', monto: 5, ts: 1, nota: 'x'.repeat(200) }])[0].nota.length === 80);
  ok('dedupe por id (gana ts mayor)', normalizarMovs([
    { id: 'a', tipo: 'chape', cuenta: 'personal', monto: 5, ts: 100 },
    { id: 'a', tipo: 'chape', cuenta: 'personal', monto: 9, ts: 200 },
  ])[0].monto === 9);

  // fusión y tombstones
  ok('fusionarMovs une sin duplicar', fusionarMovs(escenario, [...escenario]).length === escenario.length);
  const conBorrado = filtrarBorradosYape(escenario, { movs: [{ id: 'c1', ts: Date.now() }] });
  ok('tombstone saca el movimiento borrado', !conBorrado.some(m => m.id === 'c1'));
  const tOld = { id: 'c2', ts: tsDe(HOY) - 999999 };
  ok('tombstone VIEJO no borra un mov más nuevo', filtrarBorradosYape(escenario, { movs: [tOld] }).some(m => m.id === 'c2'));
  ok('fusionarBorradosYape gana el más reciente',
    fusionarBorradosYape({ movs: [{ id: 'a', ts: 1 }] }, { movs: [{ id: 'a', ts: 5 }] }).movs[0].ts === 5);
  ok('podarBorradosYape tira los viejos',
    podarBorradosYape({ movs: [{ id: 'a', ts: Date.now() - 90 * 86400000 }, { id: 'b', ts: Date.now() }] }, 60).movs.length === 1);
  ok('nuevoMovId tiene prefijo y', nuevoMovId().startsWith('y'));
  ok('infoTipoYape: los 5 tipos con icono', ['chape', 'gasto', 'deposito', 'retiro', 'ajuste'].every(t => infoTipoYape(t).icono));
}

// ══ G1. servicio: anotar → local + nube ══
console.log('\n▶ G1 — anotar un chape: persiste en el teléfono y sube usuarios/{uid}.yape');
{
  resetTest();
  arrancarYape('bg1');
  await esperarTick();

  const creado = await agregarMovimiento('bg1', { tipo: 'chape', monto: 15, nota: 'carrera de San Juan' });
  ok('devuelve el movimiento con id y', creado.id.startsWith('y'));
  ok('queda en el estado (snapshot)', snapshotYape().movs.length === 1 && snapshotYape().movs[0].monto === 15);
  ok('cuenta personal por defecto', snapshotYape().movs[0].cuenta === 'personal');

  const subida = T.setDocCalls[T.setDocCalls.length - 1].yape;
  ok('el write sube el campo `yape` (doc usuarios/{uid})', !!subida && subida.movs.length === 1);
  ok('la subida lleva `at` (anti-eco)', typeof subida.at === 'number' && subida.at > 0);

  const local = JSON.parse(lsMap.get('rt_yape_bg1'));
  ok('persistió en localStorage rt_yape_{uid}', local && local.movs.length === 1);

  let error = '';
  try { await agregarMovimiento('bg1', { tipo: 'gasto', monto: 0 }); } catch (e) { error = e.message; }
  ok('monto 0 → Error claro', error.includes('mayor a cero'));

  const dep = await agregarMovimiento('bg1', { tipo: 'deposito', monto: 30 });
  ok('deposito anotado', dep.tipo === 'deposito');
  const { saldosYape } = core;
  const saldos = saldosYape(snapshotYape().movs);
  ok('chape 15 + deposito 30 → personal −15, empresa +30',
    Math.abs(saldos.personal + 15) < 0.001 && Math.abs(saldos.empresa - 30) < 0.001);
}

// ══ G2. 🔄 FASE W: sync en vivo + anti-resurrección ══
console.log('\n▶ G2 — el otro celular anota / borra y se funde (nada resucita)');
{
  resetTest();
  arrancarYape('bg2');
  await esperarTick();

  const ajeno = mov('yajeno', 'chape', 'personal', 8);
  T.ultimoCb(docYape({ movs: [ajeno], at: Date.now() - 500 }));
  ok('el chape del otro celular llegó (fusión)', snapshotYape().movs.some(m => m.id === 'yajeno'));

  await agregarMovimiento('bg2', { tipo: 'gasto', monto: 3, nota: 'gaseosa' });
  ok('conviven el ajeno y el propio', snapshotYape().movs.length === 2);

  await eliminarMovimiento('bg2', 'yajeno');
  ok('el movimiento borrado desaparece', !snapshotYape().movs.some(m => m.id === 'yajeno'));
  const subida = T.setDocCalls[T.setDocCalls.length - 1].yape;
  ok('la subida lleva el tombstone (borrados.movs)',
    Array.isArray(subida.borrados?.movs) && subida.borrados.movs.some(t => t.id === 'yajeno'));

  // la nube VIEJA (otro cel que no sabe de la borrada) lo manda otra vez
  T.ultimoCb(docYape({ movs: [ajeno, ...snapshotYape().movs], at: Date.now() + 100 }));
  ok('el borrado NO resucita', !snapshotYape().movs.some(m => m.id === 'yajeno'));
  ok('el propio sigue ahí', snapshotYape().movs.some(m => m.nota === 'gaseosa'));

  // el eco del propio write se ignora (anti-eco)
  const atEscrito = subida.at;
  eventos.length = 0; // el evento remoto legítimo de arriba ya pasó
  T.ultimoCb(docYape({ movs: snapshotYape().movs, at: atEscrito }));
  ok('anti-eco: el propio write no dispara evento remoto', !eventos.includes('rt-yape-remota'));
}

// ══ G3. ⚙️ fijarSaldo ══
console.log('\n▶ G3 — fijar saldo: cuadra con la app de Yape');
{
  resetTest();
  arrancarYape('bg3');
  await esperarTick();
  await agregarMovimiento('bg3', { tipo: 'chape', monto: 15 });

  const aj = await fijarSaldo('bg3', 'personal', 150);
  ok('crea el ajuste +135', aj && Math.abs(aj.monto - 135) < 0.001);
  const { saldosYape } = core;
  ok('el saldo quedó CLAVADO en 150', Math.abs(saldosYape(snapshotYape().movs).personal - 150) < 0.001);

  const nada = await fijarSaldo('bg3', 'personal', 150);
  ok('ya cuadra → null (sin basura)', nada === null);

  const aj2 = await fijarSaldo('bg3', 'personal', 100);
  ok('bajar el saldo → ajuste −50', aj2 && Math.abs(aj2.monto + 50) < 0.001);
  ok('el saldo quedó en 100', Math.abs(saldosYape(snapshotYape().movs).personal - 100) < 0.001);

  await fijarSaldo('bg3', 'empresa', 200);
  ok('la empresa también se fija', Math.abs(saldosYape(snapshotYape().movs).empresa - 200) < 0.001);
}

// ══ G4. 🔓 reabrir la caja de OTRO día (el fix FASE BG) ══
console.log('\n▶ G4 — reabrir la caja de AYER (antes: solo la de HOY)');
{
  const resumenBase = {
    entregas: 3, efectivoCobrado: 100, digitalRider: 0, empresa: 0,
    cobradoTotal: 100, gastosEfectivo: 0, gastosDigital: 0, nGastos: 0,
    esperado: 100, netoDelDia: 100,
  };
  resetTest();
  arrancarCaja('bg-c1');
  await esperarTick();

  await cerrarCaja('bg-c1', { contado: 100, resumen: resumenBase, fecha: AYER });
  await cerrarCaja('bg-c1', { contado: 200, resumen: resumenBase }); // HOY
  ok('2 cierres guardados (ayer + hoy)', snapshotCaja().cierres.length === 2);

  await reabrirCaja('bg-c1', AYER);
  const cierres = snapshotCaja().cierres;
  ok('el cierre de AYER se borró', !cierres.some(c => c.fecha === AYER));
  ok('el de HOY NO se tocó', cierres.some(c => c.fecha === HOY && c.contado === 200));

  const subida = T.setDocCalls[T.setDocCalls.length - 1].caja;
  ok('la subida lleva el tombstone de AYER',
    Array.isArray(subida.borrados?.cierres) && subida.borrados.cierres.some(t => t.fecha === AYER));

  // la nube VIEJA manda el cierre de ayer otra vez → no resucita
  const cierreAyerViejo = { fecha: AYER, at: Date.now() - 60000, contado: 100, entregas: 3, fondoInicial: 0, efectivoCobrado: 100, digitalRider: 0, empresa: 0, gastosEfectivo: 0, gastosDigital: 0, esperado: 100, diferencia: 0, netoDelDia: 100, gastos: [] };
  T.ultimoCb(docCaja({ fondo: 0, gastos: [], cierres: [cierreAyerViejo, ...snapshotCaja().cierres], at: Date.now() + 100 }));
  ok('el cierre de AYER NO resucita', !snapshotCaja().cierres.some(c => c.fecha === AYER));
  ok('el de HOY sigue (1 cierre)', snapshotCaja().cierres.length === 1 && snapshotCaja().cierres[0].fecha === HOY);

  // re-cerrar AYER después del reabrir (el flujo completo de Rudy)
  const reCierre = await cerrarCaja('bg-c1', { contado: 111, resumen: resumenBase, fecha: AYER });
  ok('re-cerrar ayer funciona (contado corregido 111)', reCierre.contado === 111 && reCierre.fecha === AYER);

  // regresión: sin fecha → HOY como toda la vida
  await reabrirCaja('bg-c1');
  ok('sin fecha → reabre HOY (regresión exacta)', !snapshotCaja().cierres.some(c => c.fecha === HOY));
  ok('el de AYER sigue ahí', snapshotCaja().cierres.some(c => c.fecha === AYER && c.contado === 111));

  // fecha sin cierre → no-op (no rompe nada, no borra nada)
  const antes = snapshotCaja().cierres.length;
  await reabrirCaja('bg-c1', '2020-01-01');
  ok('fecha sin cierre → no-op (nada se borra)', snapshotCaja().cierres.length === antes);
}

// ══ G4b. 💜 FASE BG: la nota vacía NO viaja como undefined ══
console.log('\n▶ G4b — la nota vacía no viaja como `undefined` (bug viejo: Firestore rechazaba el write entero)');
{
  const resumenBase = {
    entregas: 3, efectivoCobrado: 100, digitalRider: 0, empresa: 0,
    cobradoTotal: 100, gastosEfectivo: 0, gastosDigital: 0, nGastos: 0,
    esperado: 100, netoDelDia: 100,
  };
  resetTest();
  arrancarCaja('bg-c2');
  await esperarTick();

  const sinNota = await cerrarCaja('bg-c2', { contado: 100, resumen: resumenBase });
  ok('cierre SIN nota → el campo `nota` NO existe (nada de undefined)',
    !('nota' in sinNota) && !('nota' in snapshotCaja().cierres[0]));
  const subida = T.setDocCalls[T.setDocCalls.length - 1].caja;
  ok('y el cierre viaja en el write (a la nube llega entero)',
    subida.cierres.length === 1 && subida.cierres[0].contado === 100);

  const conNota = await cerrarCaja('bg-c2', { contado: 200, resumen: resumenBase, nota: '  faltó 2 por el vuelto  ' });
  ok('cierre CON nota → viaja recortada y presente', conNota.nota === 'faltó 2 por el vuelto');

  await reabrirCaja('bg-c2');
  const reC = await cerrarCaja('bg-c2', { contado: 300, resumen: resumenBase });
  ok('re-cerrar sin nota → tampoco viaja undefined', !('nota' in reC));
  const movido = await cambiarFechaCierre('bg-c2', HOY, AYER);
  ok('mover un cierre sin nota → sigue sin nota (write válido)', !('nota' in movido));
}

// ══ G5. contrato de fuente ══
console.log('\n▶ G5 — contrato de fuente (YapeCard / Sidebar / caja.ts / CajaCard / versiones)');
{
  const ui = readFileSync(path.join(REPO, 'src/components/YapeCard.tsx'), 'utf8');
  const sb = readFileSync(path.join(REPO, 'src/components/Sidebar.tsx'), 'utf8');
  const svCaja = readFileSync(path.join(REPO, 'src/services/caja.ts'), 'utf8');
  const svYape = readFileSync(path.join(REPO, 'src/services/yape.ts'), 'utf8');
  const uiCaja = readFileSync(path.join(REPO, 'src/components/CajaCard.tsx'), 'utf8');
  const pkg = readFileSync(path.join(REPO, 'package.json'), 'utf8');
  const aj = readFileSync(path.join(REPO, 'src/drivertrack/components/AjustesView.tsx'), 'utf8');

  ok('YapeCard: los dos saldos con testid',
    /data-testid=\{`yape-saldo-\$\{cuenta\}`\}/.test(ui) && ui.includes('Tu Yape (personal)') && ui.includes('Yape de la empresa'));
  ok('YapeCard: chips de los 4 tipos',
    ui.includes('data-testid="yape-chip-chape"') && ui.includes('data-testid="yape-chip-gasto"') &&
    ui.includes('data-testid="yape-chip-deposito"') && ui.includes('data-testid="yape-chip-retiro"'));
  ok('YapeCard: form de monto/nota + botón anotar',
    ui.includes('data-testid="yape-form-monto"') && ui.includes('data-testid="yape-boton-anotar"'));
  ok('YapeCard: gasto con selector de cuenta',
    ui.includes('data-testid="yape-gasto-cuenta-personal"') && ui.includes('data-testid="yape-gasto-cuenta-empresa"'));
  ok('YapeCard: fijar saldo en las dos cuentas',
    ui.includes('data-testid={`yape-boton-fijar-${cuenta}`}') && ui.includes('fijarSaldo'));
  ok('YapeCard: usa el servicio real (agregar/eliminar/fijar)',
    ui.includes('agregarMovimiento') && ui.includes('eliminarMovimiento') && ui.includes('fijarSaldo'));
  ok('YapeCard: escucha el evento remoto FASE W', ui.includes('EVENTO_YAPE_REMOTA'));
  ok('YapeCard: el hoy sale de fechaLocalDe (misma fuente que los movs)', ui.includes('fechaLocalDe(Date.now())'));

  ok('Sidebar: importa el botón y el gestor', sb.includes("import { YapeMenuBoton, YapeCard } from './YapeCard'"));
  ok('Sidebar: botón MI YAPE en la Jornada (junto a la Caja)', /<CajaMenuBoton[^/]*\/>\s*{\/\* 💜 FASE BG[\s\S]*?<YapeMenuBoton/.test(sb));
  ok('Sidebar: abre el gestor del yape', sb.includes("abrirGestion('yape')"));
  ok('Sidebar: modal 💜 Mi Yape con la card', sb.includes('title="💜 Mi Yape"') && sb.includes('<YapeCard uid={uid}'));

  ok('SV caja: reabrirCaja con fecha opcional', /reabrirCaja\(uid: string, fecha\?: string\)/.test(svCaja));
  ok('SV caja: el día se valida contra los cierres que existen', /cierreDeFecha\(estado\.cierres, dia\)/.test(svCaja));
  ok('CajaCard: botón REABRIR en la vista de otro día', uiCaja.includes('data-testid="boton-reabrir-dia"'));
  ok('CajaCard: reabrirDia pasa la fecha del cierre', uiCaja.includes('reabrirCaja(uid, cierre.fecha)'));
  ok('CajaCard: tras reabrir, el form queda listo con ese día', uiCaja.includes('setFechaCierre(cierre.fecha)'));

  ok('SV yape: escribe el campo yape del doc usuarios/{uid} (sin reglas nuevas)',
    svYape.includes('doc(db, \'usuarios\', uid)') && /yape: \{/.test(svYape));
  ok('SV yape: localStorage rt_yape_{uid}', svYape.includes('`rt_yape_${uid}`'));
  ok('SV yape: escucha en vivo (FASE W)', svYape.includes('onSnapshot'));
  ok('SV yape: fijarSaldo exportado', /export async function fijarSaldo/.test(svYape));

  ok('package.json → 0.11.34', pkg.includes('"version": "0.11.34"'));
  // 💜 FASE BH: la versión siguió avanzando (0.11.34) — el texto de BG
  // vive en el historial del repo; el guardian apunta a la actual
  ok('AjustesView muestra v0.11.34 con MI YAPE', aj.includes('v0.11.34') && aj.includes('MI YAPE'));
}

console.log(`\n═══ FASE BG: ${pass} ✓ · ${fail} ✗ ═══`);
process.exit(fail > 0 ? 1 : 0);
