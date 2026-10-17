// ─────────────────────────────────────────────────────────────
// 🧪 TEST — FASE AD: 📅 REPROGRAMADOS (motor puro)
//
// Pedido literal de Rudy: "hay pedidos que no fueron entregados
// pero que los reprograman para el día siguiente… agregarlos para
// los pedidos de ese día que me toque en vez de estar bajando el
// Excel completo… ver en la lista los que fueron fallidos ayer
// y los reprogramaron para hoy".
//
// Este suite cubre el motor PURO (sin DOM ni Firebase):
//   R1.  sumaDiasISO: días, fronteras de mes/año, negativos
//   R2.  coinciden: mismo celular (fuerte) o nombre+dir
//        normalizados (mayúsculas/doble espacio no rompen)
//   R3.  esEntregado / noEntregados: reprogramar y fallidos
//        NO entregados; sin nombre no sirve para el cruce
//   R4.  dividirNoEntregados: volvieron (están en hoy) vs faltan
//   R5.  reincidentesDeHoy: ids de hoy que eran no entregados
//   R6.  dividirCola: paraHoy / futuro / yaEnLista
//   R7.  fusionarCola / quitarDeCola: dedupe y borrado por clave
//   R8.  autoColaAlCerrar: 🔄 pasa a su fecha (o mañana), no
//        duplica lo que ya estaba, otros estados no entran
//   R9.  clienteParaRuta: pendiente, sin hora, sin claves en
//        undefined (Firestore las rechaza), conserva lat/lng/
//        lejos, id nuevo rp-, marca reprog + reprogDesde
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const OUT = path.join(REPO, 'test-sync', 'reprog.compilado.cjs');
await esbuild.build({
  entryPoints: [path.join(REPO, 'src/services/reprog.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  logLevel: 'silent',
});

const R = require2(OUT);
const {
  sumaDiasISO, coinciden, esEntregado, noEntregados,
  dividirNoEntregados, reincidentesDeHoy, dividirCola,
  fusionarCola, quitarDeCola, autoColaAlCerrar, clienteParaRuta,
} = R;

let pass = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre}${extra ? ` — ${extra}` : ''}`); }
}

// factory mínima de Cliente
const cli = (id, nombre, st = 'pendiente', extra = {}) => ({
  id, num: 1, nombre, cel: '', prod: '', precio: 50, cobrar: 50,
  dir: '', dist: '', obs: '', st, mEf: 0, mYp: 0, mEmp: 0, mVt: 0,
  mEM: '', hora: '', nota: '', ...extra,
});

// ── R1: fechas ─────────────────────────────────────────────
check('R1a 2026-10-17 +1 → 2026-10-18', sumaDiasISO('2026-10-17', 1) === '2026-10-18');
check('R1b fin de mes 2026-10-31 +1 → 2026-11-01', sumaDiasISO('2026-10-31', 1) === '2026-11-01');
check('R1c fin de año 2026-12-31 +1 → 2027-01-01', sumaDiasISO('2026-12-31', 1) === '2027-01-01');
check('R1d febrero no bisiesto 2027-02-28 +1 → 2027-03-01', sumaDiasISO('2027-02-28', 1) === '2027-03-01');
check('R1e bisiesto 2028-02-28 +1 → 2028-02-29', sumaDiasISO('2028-02-28', 1) === '2028-02-29');
check('R1f -7 vuelve una semana (2026-10-17 → 2026-10-10)', sumaDiasISO('2026-10-17', -7) === '2026-10-10');
check('R1g +0 es él mismo', sumaDiasISO('2026-10-17', 0) === '2026-10-17');

// ── R2: claves de cruce ────────────────────────────────────
{
  const a = cli(1, 'Ana Torres', 'fallida', { cel: '987 654 321', dir: 'Av. Larco 123' });
  const b = cli(2, 'ANA   TORRES', 'pendiente', { cel: '51-987654321', dir: 'av larco 123' });
  check('R2a mismo celular (con ruido de formato) → coinciden', coinciden(a, b));
  const c2 = cli(3, 'Ana Torres', 'pendiente', { cel: '', dir: 'AV.  LARCO 123' });
  check('R2b sin celular pero mismo nombre+dir → coinciden', coinciden(a, c2));
  const d = cli(4, 'Ana Torres Gomez', 'pendiente', { cel: '', dir: 'Av. Larco 123' });
  check('R2c nombre DISTINTO + mismo dir → NO coinciden', !coinciden(a, d));
  const e = cli(5, 'Otro Cliente', 'pendiente', { cel: '987654321' });
  check('R2d mismo celular aunque otro nombre → coinciden (el cel manda)', coinciden(a, e));
  const f = cli(6, 'Ana Torres', 'pendiente', { cel: '', dir: 'Otra calle 999' });
  check('R2e mismo nombre, OTRA dir → NO coinciden', !coinciden(a, f));
  check('R2f celular corto (<8) no vale como clave (A y B no coinciden)', !coinciden(cli(9, 'A', 'pendiente', { cel: '1234567' }), cli(10, 'B', 'pendiente', { cel: '1234567', dir: '' })));
}

// ── R3: estados ────────────────────────────────────────────
check('R3a efectivo es entregado', esEntregado('efectivo'));
check('R3b yape-plin es entregado', esEntregado('yape-plin'));
check('R3c reprogramar NO es entregado', !esEntregado('reprogramar'));
check('R3d pendiente NO es entregado', !esEntregado('pendiente'));
{
  const lista = [
    cli(1, 'Pagó', 'efectivo'),
    cli(2, 'Falló', 'fallida'),
    cli(3, 'Reprog', 'reprogramar'),
    cli(4, 'Colgó', 'pendiente'),
    cli(5, '', 'fallida'), // sin nombre
  ];
  const ne = noEntregados(lista);
  check('R3e noEntregados: 3 (falló + reprog + colgó), sin el pagado ni el sin-nombre', ne.length === 3, `dio ${ne.length}`);
  check('R3f noEntregados no incluye al entregado', !ne.some(c => c.nombre === 'Pagó'));
}

// ── R4: dividir contra la lista de hoy ─────────────────────
{
  const ayer = [
    cli(1, 'Volvió Cel', 'fallida', { cel: '999888777', dir: 'Calle A 1' }),
    cli(2, 'Volvió Dir', 'ausente', { cel: '', dir: 'Calle B 2' }),
    cli(3, 'No Volvió', 'no-contesta', { cel: '111222333', dir: 'Calle C 3' }),
    cli(4, 'Pagó Ayer', 'efectivo', { cel: '444555666', dir: 'Calle D 4' }),
  ];
  const hoyLista = [
    cli(10, 'Volvió CEL', 'pendiente', { cel: '999-888-777', dir: 'Calle A 1' }),
    cli(11, 'volvió dir', 'pendiente', { cel: '', dir: 'calle b  2' }),
    cli(12, 'Cliente Nuevo', 'pendiente', { cel: '777666555', dir: 'Calle E 5' }),
  ];
  const noEnt = noEntregados(ayer);
  const { volvieron, faltan } = dividirNoEntregados(noEnt, hoyLista);
  check('R4a el que volvió por CEL queda en volvieron', volvieron.some(c => c.nombre === 'Volvió Cel'));
  check('R4b el que volvió por nombre+dir queda en volvieron', volvieron.some(c => c.nombre === 'Volvió Dir'));
  check('R4c volvieron = 2', volvieron.length === 2, `dio ${volvieron.length}`);
  check('R4d el que no volvió queda en faltan', faltan.length === 1 && faltan[0].nombre === 'No Volvió');
}

// ── R5: reincidentes de hoy (badge 🔁) ─────────────────────
{
  const ayer = [cli(1, 'Ana', 'fallida', { cel: '999888777' })];
  const hoyLista = [
    cli(10, 'Ana Torres', 'pendiente', { cel: '999888777' }),
    cli(11, 'Beto', 'pendiente', { cel: '123123123' }),
  ];
  const ids = reincidentesDeHoy(hoyLista, ayer);
  check('R5a Ana marca reincidente (id 10 en el set)', ids.has(10));
  check('R5b Beto NO marca reincidente', !ids.has(11));
}

// ── R6: dividir la cola ────────────────────────────────────
{
  const hoy = '2026-10-17';
  const cola = [
    { cliente: cli(1, 'Para Hoy', 'pendiente', { cel: '111111111' }), para: hoy, desde: '2026-10-16' },
    { cliente: cli(2, 'Atrasado', 'pendiente', { cel: '222222222' }), para: '2026-10-15', desde: '2026-10-14' },
    { cliente: cli(3, 'Futuro', 'pendiente', { cel: '333333333' }), para: '2026-10-20', desde: '2026-10-16' },
    { cliente: cli(4, 'Ya Vino', 'pendiente', { cel: '444444444' }), para: hoy, desde: '2026-10-16' },
  ];
  const hoyLista = [cli(40, 'Ya Vino', 'pendiente', { cel: '444444444' })];
  const { paraHoy, futuro, yaEnLista } = dividirCola(cola, hoy, hoyLista);
  check('R6a paraHoy incluye el de HOY y el ATRASADO (para <= hoy)', paraHoy.length === 2, `dio ${paraHoy.length}`);
  check('R6b futuro = 1 (para 2026-10-20)', futuro.length === 1 && futuro[0].cliente.nombre === 'Futuro');
  check('R6c yaEnLista = 1 (Ya Vino está en la ruta)', yaEnLista.length === 1 && yaEnLista[0].cliente.nombre === 'Ya Vino');
}

// ── R7: fusionar / quitar de la cola ───────────────────────
{
  const a = { cliente: cli(1, 'Ana', 'pendiente', { cel: '999888777' }), para: '2026-10-18', desde: '2026-10-17' };
  const dup = { cliente: cli(2, 'ANA', 'pendiente', { cel: '999-888-777' }), para: '2026-10-18', desde: '2026-10-17' };
  const otraFecha = { cliente: cli(1, 'Ana', 'pendiente', { cel: '999888777' }), para: '2026-10-20', desde: '2026-10-17' };
  const f1 = fusionarCola([a], [dup]);
  check('R7a fusionar no duplica al mismo cliente con la MISMA fecha', f1.length === 1, `dio ${f1.length}`);
  const f2 = fusionarCola([a], [otraFecha]);
  check('R7b fusionar con OTRA fecha sí lo agrega', f2.length === 2);
  const q = quitarDeCola([a, otraFecha], cli(9, 'Ana X', 'pendiente', { cel: '999 888 777' }));
  check('R7c quitarDeCola saca TODAS las entradas de ese cliente', q.length === 0, `dio ${q.length}`);
}

// ── R8: auto-cola al cerrar la ruta ────────────────────────
{
  const hoy = '2026-10-17'; // sábado
  const clientes = [
    cli(1, 'Con Fecha', 'reprogramar', { reprogramadoPara: '2026-10-20' }),
    cli(2, 'Sin Fecha', 'reprogramar'),
    cli(3, 'Pagó', 'efectivo'),
    cli(4, 'Falló', 'fallida'),
    cli(5, 'Colgó', 'pendiente'),
  ];
  const nueva = autoColaAlCerrar(clientes, hoy, []);
  check('R8a entran los 2 reprogramados (con fecha y sin fecha)', nueva.length === 2, `dio ${nueva.length}`);
  const conFecha = nueva.find(e => e.cliente.nombre === 'Con Fecha');
  const sinFecha = nueva.find(e => e.cliente.nombre === 'Sin Fecha');
  check('R8b Con Fecha respeta su 2026-10-20', conFecha && conFecha.para === '2026-10-20');
  check('R8c Sin Fecha cae para MAÑANA (10-18)', sinFecha && sinFecha.para === '2026-10-18');
  check('R8d el fallido y el pagado NO entran a la cola', !nueva.some(e => ['Falló', 'Pagó', 'Colgó'].includes(e.cliente.nombre)));
  // ya estaba en la cola → no duplica
  const otraVez = autoColaAlCerrar(clientes, hoy, nueva);
  check('R8e cerrar dos veces NO duplica la cola', otraVez.length === 2, `dio ${otraVez.length}`);
}

// ── R9: cliente listo para la ruta de hoy ──────────────────
{
  const original = cli(5, 'Vuelve', 'reprogramar', {
    reprogramadoPara: '2026-10-18',
    cel: '999888777',
    dir: 'Av. Siempreviva 742',
    lat: -12.1, lng: -77.03, latSrc: 'google', lejos: true,
    webReg: true, respondioInicioRuta: true, fotoUrl: 'https://foto',
  });
  const listo = clienteParaRuta(original, 7, '2026-10-16');
  check('R9a queda PENDIENTE', listo.st === 'pendiente');
  check('R9b sin hora', listo.hora === '');
  check('R9c montos de cobro en cero (se cobran al entregar)', listo.mEf === 0 && listo.mYp === 0 && listo.mEmp === 0 && listo.mVt === 0);
  check('R9d marca reprog (badge 🔁)', listo.reprog === true);
  check('R9e reprogDesde = fecha de la ruta original', listo.reprogDesde === '2026-10-16');
  check('R9f número siguiente (7)', listo.num === 7);
  check('R9g id nuevo con prefijo rp-', String(listo.id).startsWith('rp-'));
  check('R9h SIN reprogramadoPara (ya está EN la ruta)', !('reprogramadoPara' in listo));
  // ⚠️ Firestore rechaza undefined: las claves del runtime anterior
  // deben estar AUSENTES, no presentes con undefined
  check('R9i sin webReg', !('webReg' in listo));
  check('R9j sin fotoUrl', !('fotoUrl' in listo));
  check('R9k sin respondioInicioRuta', !('respondioInicioRuta' in listo));
  check('R9l conserva coordenadas (no re-geocodifica)', listo.lat === -12.1 && listo.lng === -77.03 && listo.latSrc === 'google');
  check('R9m conserva la marca lejos (S/9⇄S/12)', listo.lejos === true);
  check('R9n conserva datos del pedido', listo.nombre === 'Vuelve' && listo.dir === 'Av. Siempreviva 742' && listo.cel === '999888777');
  const listo2 = clienteParaRuta(original, 8, '2026-10-16');
  check('R9o ids distintos en cada pasada', listo.id !== listo2.id);
}

// ── resultado ──────────────────────────────────────────────
console.log(`\n═══ FASE AD (reprogramados): ${pass} ✓ / ${fail} ✗ ═══`);
process.exit(fail === 0 ? 0 : 1);
