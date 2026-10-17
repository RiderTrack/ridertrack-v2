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
//   R8.  autoColaAlCerrar: 🔄 pasa a su fecha (o mañana) y los
//        FALLIDOS pasan a esperando (AD-2), no duplica lo que
//        ya estaba, otros estados no entran
//   R9.  clienteParaRuta: pendiente, sin hora, sin claves en
//        undefined (Firestore las rechaza), conserva lat/lng/
//        lejos, id nuevo rp-, marca reprog + reprogDesde
//   R10. esFallido (AD-2): los 5 estados fallidos;
//        reprogramar/pendiente NO
//   R12. dividirCola esperando (AD-2): fallido sin fecha;
//        el que volvió → yaEnLista
//   R13. purgarCola (AD-2): resueltos (ya en la ruta de hoy) y
//        expirados (>5 días); agendado futuro no expira antes
//        de su fecha; 5 días justos sobrevive
//   R14. migrarFallidos (AD-2): solo fallidos de la última
//        cerrada, sin duplicar, misma referencia si no hay nada
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
  esFallido, purgarCola, migrarFallidos, EXPIRA_DIAS,
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
    cli(6, 'Rechazó', 'rechazado'),
  ];
  const nueva = autoColaAlCerrar(clientes, hoy, []);
  check('R8a entran los 2 reprogramados + los 2 fallidos', nueva.length === 4, `dio ${nueva.length}`);
  const conFecha = nueva.find(e => e.cliente.nombre === 'Con Fecha');
  const sinFecha = nueva.find(e => e.cliente.nombre === 'Sin Fecha');
  check('R8b Con Fecha respeta su 2026-10-20', conFecha && conFecha.para === '2026-10-20');
  check('R8c Sin Fecha cae para MAÑANA (10-18)', sinFecha && sinFecha.para === '2026-10-18');
  check('R8d el fallido entra con origen fallido', nueva.find(e => e.cliente.nombre === 'Falló')?.origen === 'fallido');
  check('R8e el fallido entra SIN fecha (esperando)', nueva.find(e => e.cliente.nombre === 'Falló')?.para === '');
  check('R8f el rechazado también entra (es fallido)', nueva.find(e => e.cliente.nombre === 'Rechazó')?.origen === 'fallido');
  check('R8g el pagado y el colgado NO entran a la cola', !nueva.some(e => ['Pagó', 'Colgó'].includes(e.cliente.nombre)));
  // ya estaba en la cola → no duplica
  const otraVez = autoColaAlCerrar(clientes, hoy, nueva);
  check('R8h cerrar dos veces NO duplica la cola', otraVez.length === 4, `dio ${otraVez.length}`);
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

// ── R10: esFallido (AD-2) ─────────────────────────────
check('R10a fallida es fallido', esFallido('fallida'));
check('R10b rechazado es fallido', esFallido('rechazado'));
check('R10c cancelado es fallido', esFallido('cancelado'));
check('R10d ausente es fallido', esFallido('ausente'));
check('R10e no-contesta es fallido', esFallido('no-contesta'));
check('R10f reprogramar NO es fallido (va con fecha)', !esFallido('reprogramar'));
check('R10g pendiente NO es fallido', !esFallido('pendiente'));
check('R10h efectivo NO es fallido', !esFallido('efectivo'));
check('R10i undefined/espacios no rompen (trim)', !esFallido(undefined) && esFallido(' fallida '));
check('R10j EXPIRA_DIAS = 5 (Rudy: "tres cinco días")', EXPIRA_DIAS === 5);

// ── R12: dividirCola — bucket esperando (AD-2) ─────────
{
  const hoy = '2026-10-18';
  const cola = [
    { cliente: cli(1, 'Espera', 'fallida', { cel: '111111111' }), para: '', desde: '2026-10-17', origen: 'fallido' },
    { cliente: cli(2, 'Espera En Ruta', 'fallida', { cel: '222222222' }), para: '', desde: '2026-10-17', origen: 'fallido' },
    { cliente: cli(3, 'Hoy', 'pendiente', { cel: '333333333' }), para: hoy, desde: '2026-10-16' },
  ];
  const hoyLista = [cli(30, 'ESPERA EN RUTA', 'pendiente', { cel: '222222222' })];
  const { paraHoy, esperando, futuro, yaEnLista } = dividirCola(cola, hoy, hoyLista);
  check('R12a el fallido sin fecha cae en esperando', esperando.length === 1 && esperando[0].cliente.nombre === 'Espera', `esperando=${esperando.length}`);
  check('R12b el fallido que volvió cae en yaEnLista', yaEnLista.length === 1 && yaEnLista[0].cliente.nombre === 'Espera En Ruta');
  check('R12c el agendado sigue en paraHoy', paraHoy.length === 1 && paraHoy[0].cliente.nombre === 'Hoy');
  check('R12d futuro queda vacío', futuro.length === 0);
  // item legacy SIN origen pero con para '' también cae en esperando
  const cola2 = [{ cliente: cli(4, 'Legacy', 'fallida', { cel: '444444444' }), para: '', desde: '2026-10-16' }];
  const d2 = dividirCola(cola2, hoy, []);
  check('R12e item con para vacía (legacy) cae en esperando', d2.esperando.length === 1);
}

// ── R13: purgarCola — auto-limpieza (AD-2) ────────────
{
  const hoy = '2026-10-18';
  const cola = [
    // vivo: para hoy
    { cliente: cli(1, 'Para Hoy', 'pendiente', { cel: '111111111' }), para: hoy, desde: '2026-10-17' },
    // vivo: fallido con 5 días JUSTOS (13 + 5 = 18 → hoy NO lo mata)
    { cliente: cli(2, 'Fallido Justo', 'fallida', { cel: '222222222' }), para: '', desde: '2026-10-13', origen: 'fallido' },
    // muerto: fallido con 6 días (12 + 5 = 17 < 18)
    { cliente: cli(3, 'Fallido Viejo', 'fallida', { cel: '333333333' }), para: '', desde: '2026-10-12', origen: 'fallido' },
    // muerto: agendado viejo (base = desde 12)
    { cliente: cli(4, 'Agend Viejo', 'pendiente', { cel: '444444444' }), para: '2026-10-11', desde: '2026-10-12' },
    // vivo: agendado para dentro de una semana — NO expira antes de su fecha
    { cliente: cli(5, 'Futuro Lejano', 'pendiente', { cel: '555555555' }), para: '2026-10-25', desde: '2026-10-17' },
    // resuelto: ya está en la lista de hoy
    { cliente: cli(6, 'Volvió', 'fallida', { cel: '999888777' }), para: '', desde: '2026-10-17', origen: 'fallido' },
  ];
  const hoyLista = [cli(60, 'VOLVIÓ', 'pendiente', { cel: '999-888-777' })];
  const { vivos, expirados, resueltos } = purgarCola(cola, hoy, hoyLista);
  check('R13a quedan 3 vivos (para hoy + 5 días justos + futuro)', vivos.length === 3, `dio ${vivos.length}`);
  check('R13b 2 expirados (fallido y agendado de hace 6 días)', expirados === 2, `dio ${expirados}`);
  check('R13c 1 resuelto (el que volvió en la lista de hoy)', resueltos === 1, `dio ${resueltos}`);
  check('R13d los vivos son los correctos', ['Para Hoy', 'Fallido Justo', 'Futuro Lejano'].every(n => vivos.some(v => v.cliente.nombre === n)));
  check('R13e el agendado para el futuro NO expira antes de su fecha', vivos.some(v => v.cliente.nombre === 'Futuro Lejano'));
  const p2 = purgarCola(vivos, hoy, hoyLista);
  check('R13f re-purgar no toca nada (idempotente)', p2.vivos.length === 3 && p2.expirados === 0 && p2.resueltos === 0);
}

// ── R14: migrarFallidos — ultima cerrada → listita (AD-2) ─
{
  const cola = [{ cliente: cli(1, 'Ya Adentro', 'pendiente', { cel: '111111111' }), para: '2026-10-20', desde: '2026-10-17' }];
  const ultima = {
    fecha: '2026-10-17',
    noEntregados: [
      cli(2, 'Falla Uno', 'fallida', { cel: '222222222' }),
      cli(3, 'Falla Dos', 'ausente', { cel: '333333333' }),
      cli(4, 'Pagó', 'efectivo', { cel: '444444444' }),
      cli(5, 'Colgó', 'pendiente', { cel: '555555555' }),
      cli(6, 'YA ADENTRO', 'pendiente', { cel: '111-111-111' }), // coincide con la cola
    ],
  };
  const nueva = migrarFallidos(ultima, cola);
  check('R14a migra SOLO los 2 fallidos', nueva.length === 3, `dio ${nueva.length}`);
  const f1 = nueva.find(e => e.cliente.nombre === 'Falla Uno');
  check('R14b Falla Uno entra SIN fecha (esperando)', !!f1 && f1.para === '');
  check('R14c Falla Uno entra con origen fallido', !!f1 && f1.origen === 'fallido');
  check('R14d desde = fecha de la ruta cerrada', !!f1 && f1.desde === '2026-10-17');
  check('R14e el pagado y el colgado NO migran', !nueva.some(e => ['Pagó', 'Colgó'].includes(e.cliente.nombre)));
  check('R14f el que ya estaba en la cola NO se duplica', nueva.filter(e => String(e.cliente.cel || '').replace(/\D/g, '') === '111111111').length === 1);
  const misma = migrarFallidos(ultima, nueva);
  check('R14g re-migrar no agrega nada', misma.length === 3, `dio ${misma.length}`);
  check('R14h sin ultima devuelve la MISMA referencia (no dispara escrituras)', migrarFallidos(null, cola) === cola);
  check('R14i sin fallidos que falten → misma referencia', migrarFallidos({ fecha: '2026-10-17', noEntregados: [cli(9, 'Solo Pagó', 'efectivo')] }, cola) === cola);
  check('R14j ultima sin noEntregados → misma referencia', migrarFallidos({ fecha: '2026-10-17', noEntregados: [] }, cola) === cola);
}

// ── resultado ──────────────────────────────────────────────
console.log(`\n═══ FASE AD-2 (reprogramados + fallidos + auto-limpieza): ${pass} ✓ / ${fail} ✗ ═══`);
process.exit(fail === 0 ? 0 : 1);
