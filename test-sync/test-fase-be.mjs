// ═══════════════════════════════════════════════════════════
// 📅 TEST FASE BE — v0.11.31
// LA FECHA DE LA CAJA SE ELIGE: cerrar la caja de OTRO día (¿te
// olvidaste de cerrarla ayer?) + cambiarle la fecha a un cierre
// ya guardado. Corre con: node test-sync/test-fase-be.mjs
//   B0. normalizarFechaCierre (cajaCore puro): válida/futura/
//       basura/inexistente/muy vieja/límite 60 días
//   B1. cerrarCaja con fecha de AYER → se guarda con ESA fecha y
//       congela SOLO los gastos de ese día (no los de hoy)
//   B2. cerrarCaja sin fecha → HOY como toda la vida (regresión)
//   B3. re-cerrar un día reemplaza el cierre de ESE día
//   B4. cambiarFechaCierre HOY→AYER: mueve los números, tombstone
//       de la fecha vieja, at nuevo
//   B5. anti-resurrección: la nube con el cierre VIEJO no lo
//       trae de vuelta (tombstone)
//   B6. cambiarFechaCierre a una fecha ya ocupada → Error claro
//   B7. misma fecha → Error · fecha futura → cae a HOY → Error
//   B8. contrato de fuente CajaCard.tsx (UI: picker, banner,
//       botones, resumen del día elegido) y services/caja.ts
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
const OUT = path.join(REPO, 'test-sync', 'caja-be.compilado.cjs');
const OUT_CORE = path.join(REPO, 'test-sync', 'cajaCore-be.compilado.cjs');

const stubPlugin = {
  name: 'stubs-caja-be',
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

// ── globals de navegador (mismo patrón test-caja-sync) ──
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
const resetTest = () => { T.snapActual = null; T.setDocCalls = []; T.setDocImpl = null; eventos.length = 0; };
const gasto = (id, fecha, monto) => ({ id, ts: tsDe(fecha), categoria: 'gasolina', concepto: '', monto, pago: 'efectivo' });

// ══ B0. normalizarFechaCierre (cajaCore puro) ══
console.log('\n▶ B0 — normalizarFechaCierre (cajaCore)');
{
  const { normalizarFechaCierre, MAX_DIAS_ATRAS_CIERRE } = core;
  ok('límite de 60 días atrás', MAX_DIAS_ATRAS_CIERRE === 60);
  ok('fecha de ayer válida → se mantiene', normalizarFechaCierre(AYER, HOY) === AYER);
  ok('hoy → hoy', normalizarFechaCierre(HOY, HOY) === HOY);
  ok('mañana (futuro) → cae a hoy', normalizarFechaCierre(f(1), HOY) === HOY);
  ok('basura "" → hoy', normalizarFechaCierre('', HOY) === HOY);
  ok('basura "abc" → hoy', normalizarFechaCierre('abc', HOY) === HOY);
  ok('null → hoy', normalizarFechaCierre(null, HOY) === HOY);
  ok('número → hoy', normalizarFechaCierre(42, HOY) === HOY);
  ok('2026-02-31 (no existe) → hoy', normalizarFechaCierre('2026-02-31', '2026-03-05') === '2026-03-05');
  ok('2026-13-01 (mes imposible) → hoy', normalizarFechaCierre('2026-13-01', HOY) === HOY);
  ok('con espacios → recorta y valida', normalizarFechaCierre(` ${AYER} `, HOY) === AYER);
  ok('61 días atrás → hoy (muy viejo)', normalizarFechaCierre(f(-61), HOY) === HOY);
  ok('60 días atrás (límite) → se mantiene', normalizarFechaCierre(f(-60), HOY) === f(-60));
}

// ══ B1. cerrarCaja con fecha de AYER ══
console.log('\n▶ B1 — cerrar la caja de AYER (fecha elegida + gastos de ese día)');
{
  resetTest();
  arrancarCaja('be1');
  await esperarTick();
  // la nube trae un gasto de AYER y uno de HOY (ts reales de esos días)
  const gAyer = gasto('gAyer', AYER, 15);
  const gHoy = gasto('gHoy', HOY, 7);
  T.ultimoCb(docCaja({ fondo: 0, gastos: [gAyer, gHoy], cierres: [], at: Date.now() - 1000 }));
  ok('gastos de ayer y hoy en el estado', snapshotCaja().gastos.length === 2);

  const cierre = await cerrarCaja('be1', { contado: 250, resumen: resumenBase, fecha: AYER });
  ok('el cierre quedó fechado AYER', cierre.fecha === AYER);
  ok('congela SOLO el gasto de ayer (el de hoy no va)', cierre.gastos.length === 1 && cierre.gastos[0].id === 'gAyer');
  ok('estado local: 1 cierre, fecha de ayer', snapshotCaja().cierres.length === 1 && snapshotCaja().cierres[0].fecha === AYER);
  const subida = T.setDocCalls[T.setDocCalls.length - 1].caja;
  ok('el write sube el cierre fechado ayer', subida.cierres.some(c => c.fecha === AYER));
  ok('y sigue subiendo los 2 gastos del store', subida.gastos.length === 2);
}

// ══ B2. cerrarCaja SIN fecha → HOY como toda la vida ══
console.log('\n▶ B2 — sin fecha → HOY (regresión: cero cambios en el flujo de siempre)');
{
  resetTest();
  arrancarCaja('be2');
  await esperarTick();
  const gAyer = gasto('gAyer2', AYER, 15);
  const gHoy = gasto('gHoy2', HOY, 7);
  T.ultimoCb(docCaja({ fondo: 0, gastos: [gAyer, gHoy], cierres: [], at: Date.now() - 1000 }));
  const cierre = await cerrarCaja('be2', { contado: 100, resumen: resumenBase });
  ok('sin fecha → cierre de HOY', cierre.fecha === HOY);
  ok('congela los gastos de HOY (los de siempre)', cierre.gastos.length === 1 && cierre.gastos[0].id === 'gHoy2');
  // y los dos cierres (ayer de B1-escenario y hoy) conviven
  await cerrarCaja('be2', { contado: 300, resumen: resumenBase, fecha: AYER });
  ok('el cierre de ayer convive con el de hoy', snapshotCaja().cierres.length === 2 && snapshotCaja().cierres.some(c => c.fecha === AYER && c.contado === 300));
}

// ══ B3. re-cerrar un día reemplaza el cierre de ESE día ══
console.log('\n▶ B3 — re-cerrar un día reemplaza SU cierre (no toca los demás)');
{
  resetTest();
  arrancarCaja('be3');
  await esperarTick();
  await cerrarCaja('be3', { contado: 111, resumen: resumenBase, fecha: AYER });
  await cerrarCaja('be3', { contado: 222, resumen: resumenBase, fecha: HOY });
  const reCierre = await cerrarCaja('be3', { contado: 333, resumen: resumenBase, fecha: AYER });
  ok('re-cerrar ayer → nuevo contado', reCierre.contado === 333);
  const cierres = snapshotCaja().cierres;
  ok('un cierre por fecha (2 en total, no 3)', cierres.length === 2);
  ok('el de ayer quedó con el NUEVO conteo', cierres.some(c => c.fecha === AYER && c.contado === 333));
  ok('el de hoy NO se tocó', cierres.some(c => c.fecha === HOY && c.contado === 222));
}

// ══ B4. cambiarFechaCierre HOY → AYER ══
console.log('\n▶ B4 — cambiarFechaCierre: mover el cierre de hoy a ayer');
{
  resetTest();
  arrancarCaja('be4');
  await esperarTick();
  const original = await cerrarCaja('be4', { contado: 444, resumen: resumenBase }); // HOY
  const movido = await cambiarFechaCierre('be4', HOY, AYER);
  ok('la caja quedó fechada AYER', movido.fecha === AYER);
  ok('los NÚMEROS no se tocan (contado 444)', movido.contado === 444);
  ok('at nuevo (más nuevo que el original)', movido.at >= original.at);
  const cierres = snapshotCaja().cierres;
  ok('ya no existe el cierre de HOY', !cierres.some(c => c.fecha === HOY));
  ok('el cierre de AYER tiene el contado del movido', cierres.some(c => c.fecha === AYER && c.contado === 444));
  const subida = T.setDocCalls[T.setDocCalls.length - 1].caja;
  ok('el write sube el cierre re-fechado', subida.cierres.some(c => c.fecha === AYER && c.contado === 444));
  ok('el write sube el tombstone de la fecha vieja (HOY)',
    Array.isArray(subida.borrados?.cierres) && subida.borrados.cierres.some(t => t.fecha === HOY));
}

// ══ B5. anti-resurrección del cierre viejo ══
console.log('\n▶ B5 — la nube con el cierre VIEJO no lo resucita (tombstone)');
{
  resetTest();
  arrancarCaja('be5');
  await esperarTick();
  const atOriginal = Date.now() - 5000;
  const original = cierreDe(HOY, 555, atOriginal);
  T.ultimoCb(docCaja({ fondo: 0, gastos: [], cierres: [original], at: atOriginal + 1 }));
  ok('el cierre de hoy llegó del otro celular', snapshotCaja().cierres.length === 1);
  await cambiarFechaCierre('be5', HOY, AYER);
  ok('movido a ayer', snapshotCaja().cierres.some(c => c.fecha === AYER));
  // la nube VIEJA (otro cel que no sabe del cambio) manda el cierre de HOY otra vez
  T.ultimoCb(docCaja({ fondo: 0, gastos: [], cierres: [original, ...snapshotCaja().cierres], at: Date.now() + 100 }));
  const cierres = snapshotCaja().cierres;
  ok('el cierre de HOY NO resucita', !cierres.some(c => c.fecha === HOY));
  ok('el de AYER sigue ahí (1 solo cierre)', cierres.length === 1 && cierres[0].fecha === AYER);
}

// ══ B6. cambiarFechaCierre a una fecha ocupada → Error claro ══
console.log('\n▶ B6 — fecha destino ya ocupada → Error (no pisa en silencio)');
{
  resetTest();
  arrancarCaja('be6');
  await esperarTick();
  await cerrarCaja('be6', { contado: 100, resumen: resumenBase, fecha: AYER });
  await cerrarCaja('be6', { contado: 200, resumen: resumenBase }); // HOY
  let error = '';
  try { await cambiarFechaCierre('be6', HOY, AYER); } catch (e) { error = e.message; }
  ok('lanza Error al chocar con el cierre de AYER', error.includes('Ya cerraste la caja del ' + AYER));
  ok('nada cambió (2 cierres intactos)', snapshotCaja().cierres.length === 2);
}

// ══ B7. misma fecha / fecha futura ══
console.log('\n▶ B7 — misma fecha y fecha futura → Error');
{
  resetTest();
  arrancarCaja('be7');
  await esperarTick();
  await cerrarCaja('be7', { contado: 100, resumen: resumenBase }); // HOY
  let error = '';
  try { await cambiarFechaCierre('be7', HOY, HOY); } catch (e) { error = e.message; }
  ok('misma fecha → Error «distinta»', error.includes('distinta'));
  error = '';
  try { await cambiarFechaCierre('be7', HOY, f(3)); } catch (e) { error = e.message; }
  ok('fecha futura → normaliza a HOY → Error «distinta» (nunca un cierre futuro)', error.includes('distinta'));
  error = '';
  try { await cambiarFechaCierre('be7', AYER, HOY); } catch (e) { error = e.message; }
  ok('no existe la caja de origen → Error claro', error.includes('No encontré'));
}

// ══ B8. contrato de fuente (UI + servicio) ══
console.log('\n▶ B8 — contrato de fuente CajaCard.tsx / services/caja.ts / cajaCore.ts');
{
  const ui = readFileSync(path.join(REPO, 'src/components/CajaCard.tsx'), 'utf8');
  const sv = readFileSync(path.join(REPO, 'src/services/caja.ts'), 'utf8');

  ok('UI: selector de fecha en el cierre (input-fecha-cierre con min/max/hoy)',
    /data-testid="input-fecha-cierre"/.test(ui) && /min=\{fechaMinCierre\}/.test(ui) && /max=\{hoyStr\}/.test(ui));
  ok('UI: banner ámbar al elegir otro día', /data-testid="banner-otro-dia"/.test(ui));
  ok('UI: botón cerrar dinámico (hoy / el día elegido)', /data-testid="boton-cerrar-caja"/.test(ui) && /Cerrar caja del \$\{fechaCorta\(fechaCierre\)\}/.test(ui));
  ok('UI: el cierre viaja con la fecha elegida', /fecha: fechaCierre/.test(ui));
  ok('UI: el cierre usa el resumen del día elegido', /resumen: resumenCierre/.test(ui));
  ok('UI: la paga congelada es la del día elegido', /cantidadNormal: pagoRutaCierre\.cantidadNormal/.test(ui));
  ok('UI: cambiar fecha en la caja de HOY cerrada', /data-testid="boton-cambiar-fecha-hoy"/.test(ui));
  ok('UI: cambiar fecha en la vista de OTRO día', /data-testid="boton-cambiar-fecha-dia"/.test(ui));
  ok('UI: form de nueva fecha con límites', /data-testid="form-cambiar-fecha"/.test(ui) && /data-testid="input-fecha-nueva"/.test(ui));
  ok('UI: leerHistorial por fecha (cerradosDeFecha)', /async function cerradosDeFecha\(uid: string, fecha: string\)/.test(ui));
  ok('UI: rutas finalizadas ese día → clientes del cierre', /clientesOtroDia && clientesOtroDia\.length > 0 \? clientesOtroDia : clientes/.test(ui));
  ok('UI: los gastos del cierre son los del día elegido', /gastosDeFecha\(caja\.gastos, fechaCierre\)/.test(ui));

  ok('SV: cambiarFechaCierre exportado', /export async function cambiarFechaCierre/.test(sv));
  ok('SV: el cierre usa la fecha saneada', /normalizarFechaCierre\(datos\.fecha, hoyLocal\(\)\)/.test(sv));
  ok('SV: los gastos congelados son del día del cierre', /gastos: gastosDeFecha\(estado\.gastos, fechaCierre\)/.test(sv));
  ok('SV: el movido lleva tombstone de la fecha vieja', /tombstoneCierre\(vieja\)/.test(sv));
  ok('SV: no pisa una fecha ocupada (Error)', /Ya cerraste la caja del /.test(sv));
}

console.log(`\n═══ FASE BE: ${pass} ✓ · ${fail} ✗ ═══`);
process.exit(fail > 0 ? 1 : 0);
