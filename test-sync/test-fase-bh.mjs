// ═══════════════════════════════════════════════════════════
// 💜 TEST FASE BH — v0.11.34
// 1) «me yapearon» (adiós «chapearon») — el typo de la pantalla.
// 2) El DEPÓSITO a la empresa se DESCUENTA del Yape de la
//    empresa (la plata de los clientes es de ellos). Los
//    depósitos viejos (v0.11.33) conservan su efecto antiguo
//    → el saldo de lo ya anotado NO se rompe al actualizar.
// 3) El chape lleva ORIGEN: 🚗 inDriver / 🏢 tu trabajo /
//    🛍 cliente → Yape de la empresa. El panel de HOY muestra
//    el desglose.
// 4) Números BLANCOS y grandes (al sol se ven).
// Corre con: node test-sync/test-fase-bh.mjs
//   G0. yapeCore puro: efectos nuevos (chape empresa /
//       deposito empresa), back-compat del deposito viejo,
//       origen en el saneo, split del resumen, saldos y
//       compactación con depósitos mixtos
//   G1. servicio: el chape con origen se guarda tal cual y
//       sube a usuarios/{uid}.yape; el deposito NUEVO nace
//       con cuenta=empresa
//   G2. fusión en vivo: el yape con origen del otro celular
//       entra ENTERO (origen incluido)
//   G3. contrato de fuente: «yapearon» en pantalla y ni un
//       «chapearon», selectores de cuenta/origen, saldo
//       text-3xl BLANCO, colores -400
//   G4. versiones 0.11.34
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
const OUT_YAPE = path.join(REPO, 'test-sync', 'yape-bh.compilado.cjs');
const OUT_CORE = path.join(REPO, 'test-sync', 'yapeCore-bh.compilado.cjs');

const stubPlugin = {
  name: 'stubs-fase-bh',
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
console.log('✓ yape.ts y yapeCore.ts reales compilados con stubs');

// ── globals de navegador (mismo patrón test-fase-bg) ──
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
const { arrancarYape, snapshotYape, agregarMovimiento, eliminarMovimiento } = yape;
const T = globalThis.__SYNC_TEST__;

const esperarTick = () => new Promise(r => setTimeout(r, 30));
let pass = 0, fail = 0;
const ok = (nombre, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};

const f = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const HOY = f(0), AYER = f(-1);
const tsDe = iso => new Date(`${iso}T12:00:00`).getTime();
const mov = (id, tipo, cuenta, monto, dias = 0, extra = {}) => ({
  id, tipo, cuenta, monto, ts: tsDe(f(-dias)), ...extra,
});
const docYape = (yapeObj) => ({ exists: () => true, data: () => ({ yape: yapeObj }) });
const resetTest = () => { T.snapActual = null; T.setDocCalls = []; T.setDocImpl = null; eventos.length = 0; };

// ══ G0. yapeCore puro ══
console.log('\n▶ G0 — yapeCore: deposito del Yape empresa, chape con origen, back-compat');
{
  const { efectoDe, saldosYape, resumenYape, normalizarMovs, compactarMovs, MAX_MOVS, infoTipoYape } = core;

  // 💜 el typo: en pantalla dice «te yapearon»
  ok('infoTipoYape: dice «Te yapearon» (adiós chapearon)', infoTipoYape('chape').nombre === 'Te yapearon');

  // chape a la empresa (un cliente pagó productos)
  const cli = efectoDe(mov('a', 'chape', 'empresa', 50));
  ok('chape empresa (cliente): +50 SOLO a la empresa', cli.empresa === 50 && cli.personal === 0);
  ok('chape personal: +monto SOLO al personal (regresión)',
    efectoDe(mov('a', 'chape', 'personal', 15)).personal === 15 && efectoDe(mov('a', 'chape', 'personal', 15)).empresa === 0);

  // 🏦 el depósito NUEVO: se descuenta del Yape de la empresa
  const depNuevo = efectoDe(mov('d2', 'deposito', 'empresa', 45));
  ok('deposito NUEVO (cuenta=empresa): −45 SOLO en la empresa', depNuevo.empresa === -45 && depNuevo.personal === 0);

  // back-compat: los depósitos VIEJOS (v0.11.33, cuenta=personal)
  const depViejo = efectoDe(mov('d1', 'deposito', 'personal', 30));
  ok('deposito VIEJO (cuenta=personal): −tuyas / +empresa (el saldo de lo ya anotado no se rompe)',
    depViejo.personal === -30 && depViejo.empresa === 30);

  // retiro y gasto: regresión (no cambiaron)
  ok('retiro: +personal / −empresa (regresión)',
    (() => { const r = efectoDe(mov('r', 'retiro', 'empresa', 10)); return r.personal === 10 && r.empresa === -10; })());
  ok('gasto empresa: −empresa (regresión)', efectoDe(mov('g', 'gasto', 'empresa', 20)).empresa === -20);

  // 🛍 escenario del reporte: 2 clientes pagan 25+50 al Yape de
  // la empresa, al final de la ruta deposita los 75 → empresa 0
  const ruta = [
    mov('c1', 'chape', 'empresa', 25), mov('c2', 'chape', 'empresa', 50),
    mov('d1', 'deposito', 'empresa', 75),
  ];
  const sRuta = saldosYape(ruta);
  ok('ruta del día: 75 de clientes − 75 depositados = empresa en 0, personal intacto',
    Math.abs(sRuta.empresa) < 0.001 && Math.abs(sRuta.personal) < 0.001);

  // resumen del día: split por origen
  const hoy = [
    mov('i1', 'chape', 'personal', 15, 0, { origen: 'indriver' }),
    mov('i2', 'chape', 'personal', 9, 0, { origen: 'indriver' }),
    mov('e1', 'chape', 'personal', 40, 0, { origen: 'empresa' }),
    mov('k1', 'chape', 'empresa', 25, 0),
    mov('d1', 'deposito', 'empresa', 25, 0),
    mov('g1', 'gasto', 'personal', 5, 0),
    mov('i3', 'chape', 'personal', 8, 1), // ayer: NO cuenta
  ];
  const r = resumenYape(hoy, HOY);
  ok('hoy: total yapes 89 (4)', Math.abs(r.hoyChapes - 89) < 0.001 && r.hoyNChapes === 4);
  ok('hoy: de inDriver 24 (2)', Math.abs(r.hoyChapesIndriver - 24) < 0.001 && r.hoyNChapesIndriver === 2);
  ok('hoy: de tu trabajo 40 (1)', Math.abs(r.hoyChapesTrabajo - 40) < 0.001 && r.hoyNChapesTrabajo === 1);
  ok('hoy: clientes 25 (1)', Math.abs(r.hoyChapesClientes - 25) < 0.001 && r.hoyNChapesClientes === 1);
  ok('hoy: depositado 25, gastado 5', Math.abs(r.hoyDepositado - 25) < 0.001 && Math.abs(r.hoyGastoPersonal - 5) < 0.001);
  ok('chape sin origen (viejo) cae en inDriver', resumenYape([mov('v', 'chape', 'personal', 7)], HOY).hoyChapesIndriver === 7);

  // saldos del escenario completo (i3 es de AYER → también suma al saldo)
  const s = saldosYape(hoy);
  // personal: 15+9+40+8(ayer) − 5 = 67 · empresa: 25 − 25 = 0
  ok('saldo personal = 67 (yapes de hoy+ayer − gasto)', Math.abs(s.personal - 67) < 0.001);
  ok('saldo empresa = 0 (cliente 25 − deposito 25)', Math.abs(s.empresa) < 0.001);

  // saneo: el origen viaja SOLO en chapes personales
  const san = normalizarMovs([
    mov('a', 'chape', 'personal', 5, 0, { origen: 'indriver' }),
    mov('b', 'chape', 'personal', 5, 0, { origen: 'basura' }),
    mov('c', 'chape', 'empresa', 5, 0, { origen: 'indriver' }),
    mov('d', 'gasto', 'personal', 5, 0, { origen: 'indriver' }),
  ]);
  const porId = Object.fromEntries(san.map(m => [m.id, m]));
  ok('origen válido se conserva', porId.a.origen === 'indriver');
  ok('origen basura se CAE (no se inventa)', porId.b.origen === undefined);
  ok('origen en chape de empresa se cae', porId.c.origen === undefined);
  ok('origen en gasto se cae', porId.d.origen === undefined);
  ok('movimiento sin origen sigue siendo válido (chape viejo)', san.length === 4);

  // compactación con depósitos mixtos: el saldo queda EXACTO
  const muchos = [];
  for (let i = 0; i < MAX_MOVS + 25; i++) {
    muchos.push(mov(`m${i}`, i % 3 === 0 ? 'deposito' : 'chape', i % 2 ? 'empresa' : 'personal', 2, 1, { origen: i % 5 === 0 ? 'indriver' : undefined }));
  }
  const antes = saldosYape(muchos);
  const compactados = compactarMovs(muchos);
  const despues = saldosYape(compactados);
  ok('compactación con depósitos mixtos: saldo EXACTO (personal)',
    Math.abs(antes.personal - despues.personal) < 0.001);
  ok('compactación con depósitos mixtos: saldo EXACTO (empresa)',
    Math.abs(antes.empresa - despues.empresa) < 0.001);
}

// ══ G1. servicio: el chape con origen se guarda y sube ══
console.log('\n▶ G1 — anotar con origen/cuenta: local + usuarios/{uid}.yape');
{
  resetTest();
  arrancarYape('bh1');
  await esperarTick();

  const y1 = await agregarMovimiento('bh1', { tipo: 'chape', monto: 15, origen: 'indriver', nota: 'carrera del centro' });
  ok('chape inDriver: nace con origen', y1.origen === 'indriver' && y1.cuenta === 'personal');

  const y2 = await agregarMovimiento('bh1', { tipo: 'chape', monto: 40, origen: 'empresa' });
  ok('chape trabajo: origen empresa', y2.origen === 'empresa');

  const y3 = await agregarMovimiento('bh1', { tipo: 'chape', monto: 25, cuenta: 'empresa' });
  ok('chape cliente: cuenta empresa y SIN origen', y3.cuenta === 'empresa' && y3.origen === undefined);

  const y4 = await agregarMovimiento('bh1', { tipo: 'chape', monto: 10, cuenta: 'empresa', origen: 'indriver' });
  ok('origen forzado en chape empresa → el servicio lo IGNORA', y4.cuenta === 'empresa' && y4.origen === undefined);

  // el UI (único llamador) siempre pasa cuenta='empresa' para el
  // depósito nuevo — G3 lo verifica en el fuente de YapeCard
  const d1 = await agregarMovimiento('bh1', { tipo: 'deposito', monto: 25, cuenta: 'empresa' });
  ok('deposito NUEVO: nace con cuenta=empresa (se descuenta de ahí)', d1.cuenta === 'empresa');

  const g1 = await agregarMovimiento('bh1', { tipo: 'gasto', monto: 5, cuenta: 'empresa' });
  ok('gasto empresa: igual que antes', g1.cuenta === 'empresa' && g1.tipo === 'gasto');

  const { saldosYape, resumenYape } = core;
  const movs = snapshotYape().movs;
  const s = saldosYape(movs);
  // personal: 15+40 = 55 · empresa: 25+10−25−5 = 5
  ok('saldos: personal 55 · empresa 5', Math.abs(s.personal - 55) < 0.001 && Math.abs(s.empresa - 5) < 0.001);
  const r = resumenYape(movs, HOY);
  ok('resumen HOY: inDriver 15+10? NO — el cliente no es indriver → 15 · trabajo 40 · clientes 35',
    Math.abs(r.hoyChapesIndriver - 15) < 0.001 && Math.abs(r.hoyChapesTrabajo - 40) < 0.001 && Math.abs(r.hoyChapesClientes - 35) < 0.001);

  const subida = T.setDocCalls[T.setDocCalls.length - 1].yape;
  ok('la subida lleva los movimientos con origen (nada se pierde en la nube)',
    subida.movs.some(m => m.origen === 'indriver') && subida.movs.some(m => m.origen === 'empresa') &&
    subida.movs.some(m => m.cuenta === 'empresa' && m.tipo === 'deposito'));

  const local = JSON.parse(lsMap.get('rt_yape_bh1'));
  ok('localStorage persiste el origen tal cual', local.movs.some(m => m.origen === 'indriver'));

  // recarga desde local: el origen SOBREVIVE el saneo
  arrancarYape('bh1-recarga'); // otro uid para forzar reset
  const localBH = lsMap.get('rt_yape_bh1');
  T.snapActual = null;
  const p = JSON.parse(localBH);
  const saneados = core.normalizarMovs(p.movs);
  ok('tras recargar, el origen sigue ahí', saneados.some(m => m.origen === 'indriver'));
}

// ══ G2. fusión en vivo: el yape con origen del otro celular ══
console.log('\n▶ G2 — el otro celular anota un chape con origen → entra ENTERO');
{
  resetTest();
  arrancarYape('bh2');
  await esperarTick();

  const ajeno = mov('yajeno', 'chape', 'personal', 12, 0, { origen: 'indriver' });
  T.ultimoCb(docYape({ movs: [ajeno], at: Date.now() - 500 }));
  const traído = snapshotYape().movs.find(m => m.id === 'yajeno');
  ok('llegó con su origen', traído?.origen === 'indriver');
  ok('el resumen lo cuenta como inDriver', resumenYapeSafe(ajeno));
  function resumenYapeSafe(uno) {
    const r = core.resumenYape(snapshotYape().movs, HOY);
    return Math.abs(r.hoyChapesIndriver - 12) < 0.001;
  }

  // depósito NUEVO desde el otro celular
  const depAjeno = mov('depajeno', 'deposito', 'empresa', 20);
  T.ultimoCb(docYape({ movs: [traído, depAjeno], at: Date.now() + 100 }));
  const s = core.saldosYape(snapshotYape().movs);
  ok('el deposito del otro cel descuenta de la empresa (y no toca la personal)',
    Math.abs(s.empresa + 20) < 0.001 && Math.abs(s.personal - 12) < 0.001);

  // borrar y no resucitar (regresión del tombstone)
  await eliminarMovimiento('bh2', 'yajeno');
  ok('borrado normal (regresión)', !snapshotYape().movs.some(m => m.id === 'yajeno'));
}

// ══ G3. contrato de fuente: «yapearon» en pantalla ══
console.log('\n▶ G3 — contrato de fuente (typo, selectores, colores, versión)');
{
  const ui = readFileSync(path.join(REPO, 'src/components/YapeCard.tsx'), 'utf8');
  const sb = readFileSync(path.join(REPO, 'src/components/Sidebar.tsx'), 'utf8');
  const svYape = readFileSync(path.join(REPO, 'src/services/yape.ts'), 'utf8');
  const coreSrc = readFileSync(path.join(REPO, 'src/utils/yapeCore.ts'), 'utf8');
  const pkg = readFileSync(path.join(REPO, 'package.json'), 'utf8');
  const aj = readFileSync(path.join(REPO, 'src/drivertrack/components/AjustesView.tsx'), 'utf8');

  // 1) el typo: se dice «yapearon», ni un «chapearon» en pantalla
  ok('YapeCard: dice «Me yapearon» y «Te yapearon»', ui.includes('Me yapearon') && ui.includes('Te yapearon'));
  ok('YapeCard: NI UN «chapearon» visible', !/chapearon/i.test(ui));
  ok('yapeCore: infoTipoYape dice «Te yapearon»', coreSrc.includes("nombre: 'Te yapearon'"));
  ok('Sidebar: el subtítulo dice «yapes» (no «chapes»)', sb.includes('saldo, yapes, depósitos y gastos') && !sb.includes('chapes del día'));

  // 2) el origen: botoncitos de cuenta y origen
  ok('YapeCard: selector de cuenta del chape (personal/empresa-clientes)',
    ui.includes('data-testid="yape-chape-cuenta-personal"') && ui.includes('data-testid="yape-chape-cuenta-empresa"'));
  ok('YapeCard: selector de origen (inDriver/mi trabajo)',
    ui.includes('data-testid="yape-chape-origen-indriver"') && ui.includes('data-testid="yape-chape-origen-empresa"'));
  ok('YapeCard: el panel de HOY muestra el split', ui.includes('hoyChapesIndriver') && ui.includes('hoyChapesTrabajo') && ui.includes('hoyChapesClientes'));
  ok('YapeCard: filaSub para el desglose', ui.includes('filaSub'));

  // 3) el deposito se descuenta del Yape de la empresa
  ok('YapeCard: el deposito nace SIEMPRE con cuenta=empresa',
    /tipo === 'deposito' \? 'empresa'/.test(ui));
  ok('YapeCard: la pista del deposito lo explica', ui.includes('Se descuenta del'));
  ok('yapeCore: el efecto del deposito empresa es −empresa',
    coreSrc.includes('return m.cuenta === \'empresa\'\n        ? { personal: 0, empresa: -monto }'));
  ok('yapeCore: back-compat del deposito viejo (personal)',
    coreSrc.includes(': { personal: -monto, empresa: monto };'));

  // 4) colores: saldo BLANCO y GRANDE, valores -400
  ok('YapeCard: el saldo es text-3xl BLANCO (se ve al sol)',
    /text-3xl font-black tabular-nums mt-1 text-white/.test(ui));
  ok('YapeCard: los montos van en -400 (no pastel -300)',
    ui.includes('text-emerald-400') && ui.includes('text-red-400') && ui.includes('text-amber-400') && ui.includes('text-sky-400'));
  ok('YapeCard: sin pastel -300 en los montos', !/text-(emerald|red|amber|sky)-300/.test(ui));

  // 5) servicio: el origen viaja y se valida
  ok('SV yape: DatosMovimiento.origen existe', svYape.includes('origen?: OrigenYape'));
  ok('SV yape: el origen solo viaja en chapes personales', svYape.includes("datos.tipo === 'chape' && mov.cuenta === 'personal'"));
  ok('yapeCore: OrigenYape exportado', coreSrc.includes("export type OrigenYape = 'indriver' | 'empresa'"));

  // 6) versión
  ok('package.json → 0.11.34', pkg.includes('"version": "0.11.34"'));
  ok('AjustesView muestra v0.11.34 (FASE BH)', aj.includes('v0.11.34') && aj.includes('yapearon'));
  ok('AjustesView explica el fix del typo (adiós a la palabra vieja)', aj.includes('ya no dice') && aj.includes('te yapearon'));
}

console.log(`\n═══ FASE BH: ${pass} ✓ · ${fail} ✗ ═══`);
process.exit(fail > 0 ? 1 : 0);
