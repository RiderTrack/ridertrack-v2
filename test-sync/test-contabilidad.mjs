// ─────────────────────────────────────────────────────────────
// 🧪 TEST — FASE AC: 💰 Contabilidad (motor puro)
//
// Pedido literal de Rudy: "quisiera saber cuánto estoy ganando
// por día… por inDrive como pago por pedido de mi empresa…
// mi meta es 150… de lunes a sábado… poder separar para la
// gasolina para la comida… comparar cuánto gané esta semana
// y la otra".
//
// Este suite cubre el motor PURO (sin DOM ni Firebase):
//   C1.  lunesDeISO: sábado/lunes/domingo caen en SU semana
//   C2.  diasSemanaActual: 7 días consecutivos desde el lunes
//   C3.  empresaPorDia: varias rutas el MISMO día se suman;
//        jornal (sin pagoPedidos) no suma; total 0 no cuenta
//   C4.  resumenEntre: neto libre + empresa + gastos → en mano,
//        desgloses ordenados, filtros de rango exactos
//   C5.  semanasContables: 6 semanas, la actual primero y solo
//        hasta HOY (un viaje 'mañana' no se cuenta), las pasadas
//        completas lun→dom (un viaje DOMINGO sí cuenta)
//   C6.  resumenMes: el mes actual solo hasta hoy; el anterior
//        completo; diffPct correcto; frontera de mes
//   C7.  netoPorDia: totales por día + marcas de futuro
//   C8.  metaSemanal/ritmoAlDia: meta × 6; al lunes × 1, al
//        sábado × 6, al domingo × 6 (descanso), meta 0 → 0
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const OUT = path.join(REPO, 'test-sync', 'contabilidad.compilada.cjs');
await esbuild.build({
  entryPoints: [path.join(REPO, 'src/drivertrack/services/contabilidad.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  logLevel: 'silent',
});

const C = require2(OUT);
const {
  lunesDeISO, rangoSemanaDe, diasSemanaActual,
  empresaPorDiaDesdeRegistros, resumenEntre,
  semanasContables, resumenMes, netoPorDia,
  metaSemanal, ritmoAlDia,
} = C;

let pass = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre}${extra ? ` — ${extra}` : ''}`); }
}
const cerca = (a, b) => Math.abs(a - b) < 0.001;

// factories mínimas (solo los campos que usa el motor)
const viaje = (fecha, neto, origen = 'indrive') => ({ id: 'v' + Math.random(), fecha, hora: '09:00', origen, tarifa: neto, comision: 0, neto });
const gasto = (fecha, tipo, monto) => ({ id: 'g' + Math.random(), fecha, hora: '12:00', tipo, monto, nota: '' });

// ── C1: lunes de cada semana ──────────────────────────────
check('C1a sábado 2026-10-17 → lunes 2026-10-12', lunesDeISO('2026-10-17') === '2026-10-12');
check('C1b lunes 2026-10-12 → él mismo', lunesDeISO('2026-10-12') === '2026-10-12');
check('C1c domingo 2026-10-18 → lunes de SU semana (10-12)', lunesDeISO('2026-10-18') === '2026-10-12');
check('C1d miércoles 2026-10-14 → lunes 2026-10-12', lunesDeISO('2026-10-14') === '2026-10-12');
check('C1e domingo 2026-10-11 → lunes de la ANTERIOR (10-05)', lunesDeISO('2026-10-11') === '2026-10-05');

// ── C2: días de la semana actual ──────────────────────────
{
  const dias = diasSemanaActual('2026-10-17');
  check('C2a son 7 días', dias.length === 7);
  check('C2b empiezan el lunes 10-12', dias[0] === '2026-10-12');
  check('C2c terminan el domingo 10-18', dias[6] === '2026-10-18');
  check('C2d consecutivos', dias.every((d, i) => i === 0 || d > dias[i - 1]));
}

// ── C3: empresa por día desde el historial ────────────────
{
  const regs = [
    { fecha: '2026-10-15', pagoPedidos: { total: 45 } },   // día normal
    { fecha: '2026-10-15', pagoPedidos: { total: 12 } },   // 2ª vuelta el MISMO día
    { fecha: '2026-10-16', pagoPedidos: { total: 0 } },    // ruta sin pedidos → 0
    { fecha: '2026-10-14' },                                // jornal (sin pagoPedidos)
    { fecha: '2026-10-13', pagoPedidos: { total: undefined } },
    { pagoPedidos: { total: 99 } },                        // sin fecha → ignorado
  ];
  const m = empresaPorDiaDesdeRegistros(regs);
  check('C3a dos rutas el mismo día se SUMAN (45+12=57)', m.get('2026-10-15') === 57, `dio ${m.get('2026-10-15')}`);
  check('C3b total 0 no se registra', !m.has('2026-10-16'));
  check('C3c jornal (sin pagoPedidos) no suma', !m.has('2026-10-14'));
  check('C3d total undefined no se registra', !m.has('2026-10-13'));
  check('C3e sin fecha → ignorado', m.size === 1);
}

// ── C4: resumen de un rango ───────────────────────────────
{
  const hoy = '2026-10-15'; // jueves
  const viajes = [
    viaje('2026-10-15', 36, 'indrive'),
    viaje('2026-10-15', 50, 'directo'),
    viaje('2026-10-12', 24, 'indrive'),
    viaje('2026-10-16', 999, 'indrive'),  // fuera (después de hoy… rango cerrado hasta hoy)
  ];
  const gastos = [
    gasto('2026-10-15', 'gasolina', 20),
    gasto('2026-10-15', 'comida', 15),
    gasto('2026-10-11', 'gasolina', 40),  // fuera del rango (otra semana)
  ];
  const empresa = new Map([['2026-10-15', 45], ['2026-10-12', 20]]);
  const r = resumenEntre(viajes, gastos, empresa, '2026-10-12', hoy);

  check('C4a netoLibre = 36+50+24 = 110', cerca(r.netoLibre, 110), `dio ${r.netoLibre}`);
  check('C4b empresa = 45+20 = 65', cerca(r.empresa, 65), `dio ${r.empresa}`);
  check('C4c total = 175', cerca(r.total, 175), `dio ${r.total}`);
  check('C4d gastos = 35 (solo del rango)', cerca(r.gastos, 35), `dio ${r.gastos}`);
  check('C4e enMano = 175-35 = 140', cerca(r.enMano, 140), `dio ${r.enMano}`);
  check('C4f n = 3 viajes', r.n === 3);
  check('C4g diasEmpresa = 2', r.diasEmpresa === 2);
  check('C4h porOrigen mayor primero (directo 50 > indrive 60? no: indrive 60)', r.porOrigen[0].origen === 'indrive' && cerca(r.porOrigen[0].neto, 60), JSON.stringify(r.porOrigen));
  check('C4i porOrigen incluye directo 50', r.porOrigen.some(o => o.origen === 'directo' && cerca(o.neto, 50)));
  check('C4j gastosPorTipo: gasolina 20 + comida 15', cerca(r.gastosPorTipo.find(g => g.tipo === 'gasolina')?.monto ?? -1, 20) && cerca(r.gastosPorTipo.find(g => g.tipo === 'comida')?.monto ?? -1, 15));
  check('C4k el viaje del 16 (fuera del rango) no cuenta', !cerca(r.netoLibre, 110 + 999));
}

// ── C5: semanas contables ─────────────────────────────────
{
  const hoy = '2026-10-15'; // jueves de la semana 12–18 oct
  const viajes = [
    viaje('2026-10-15', 36),   // hoy
    viaje('2026-10-12', 24),   // lunes de esta semana
    viaje('2026-10-18', 30),   // DOMINGO de esta semana → FUTURO → no cuenta
    viaje('2026-10-11', 30),   // domingo de la semana ANTERIOR → SÍ cuenta (pasada completa)
    viaje('2026-10-05', 40),   // LUNES de la semana anterior (misma semana que el 10-11)
    viaje('2026-09-30', 25),   // semana -2 (28 sep – 4 oct)
  ];
  const empresa = new Map([['2026-10-15', 45], ['2026-10-08', 60]]);
  const semanas = semanasContables(viajes, [gasto('2026-10-08', 'gasolina', 10)], empresa, hoy, 6);

  check('C5a son 6 semanas', semanas.length === 6);
  check('C5b la actual va primero y marcada', semanas[0].esActual === true && semanas.slice(1).every(s => !s.esActual));
  check('C5c actual: desde lunes 10-12, hasta HOY 10-15', semanas[0].desde === '2026-10-12' && semanas[0].hasta === '2026-10-15');
  check('C5d actual: netoLibre = 36+24 (el domingo futuro NO cuenta)', cerca(semanas[0].netoLibre, 60), `dio ${semanas[0].netoLibre}`);
  check('C5e actual: total = 60+45 = 105', cerca(semanas[0].total, 105), `dio ${semanas[0].total}`);
  check('C5f 2ª semana: hasta el DOMINGO 10-11 completo', semanas[1].hasta === '2026-10-11');
  check('C5g 2ª semana: domingo 10-11 (30) + lunes 10-05 (40) = 70', cerca(semanas[1].netoLibre, 70), `dio ${semanas[1].netoLibre}`);
  check('C5h 2ª semana: empresa 60 y gasto 10 → total 130, enMano 120', cerca(semanas[1].total, 130) && cerca(semanas[1].enMano, 120), `total ${semanas[1].total} enMano ${semanas[1].enMano}`);
  check('C5i cada semana empieza LUNES y saltan de a 7', semanas.every((s, i) => i === 0 || s.desde < semanas[i - 1].desde));
  check('C5j 3ª semana (28 sep–4 oct): neto 25', cerca(semanas[2].netoLibre, 25), `dio ${semanas[2].netoLibre}`);
  check('C5k las semanas vacías vienen en 0', semanas[3].total === 0 && semanas[4].total === 0);
  // rangos exactos de las pasadas
  const s2 = rangoSemanaDe('2026-10-08');
  check('C5l rangoSemanaDe(jueves 10-08) = 10-05..10-11', s2.desde === '2026-10-05' && s2.hasta === '2026-10-11');
}

// ── C6: mes calendario ────────────────────────────────────
{
  const hoy = '2026-10-15';
  const viajes = [
    viaje('2026-10-01', 30),   // 1º de octubre
    viaje('2026-10-15', 36),   // hoy
    viaje('2026-10-30', 99),   // futuro del MISMO mes → no cuenta
    viaje('2026-09-30', 20),   // último de setiembre
    viaje('2026-09-01', 10),   // 1º de setiembre
  ];
  const empresa = new Map([['2026-10-15', 45]]);
  const mes = resumenMes(viajes, [], empresa, hoy);

  check('C6a claveActual 2026-10, claveAnterior 2026-09', mes.claveActual === '2026-10' && mes.claveAnterior === '2026-09');
  check('C6b actual: 30+36 = 66 (el 30-oct futuro no)', cerca(mes.actual.netoLibre, 66), `dio ${mes.actual.netoLibre}`);
  check('C6c actual: total = 66+45 = 111', cerca(mes.actual.total, 111), `dio ${mes.actual.total}`);
  check('C6d anterior: 20+10 = 30 COMPLETO', cerca(mes.anterior.netoLibre, 30), `dio ${mes.anterior.netoLibre}`);
  check('C6e diffPct = (111-30)/30 = 270%', cerca(mes.diffPct, 270), `dio ${mes.diffPct}`);
  // frontera: hoy 1º de octubre
  const mesFrontera = resumenMes([viaje('2026-10-01', 30)], [], new Map(), '2026-10-01');
  check('C6f frontera: hoy 1º del mes cuenta SOLO ese día', cerca(mesFrontera.actual.total, 30), `dio ${mesFrontera.actual.total}`);
  const mesVacio = resumenMes([], [], new Map(), '2026-10-15');
  check('C6g sin datos el mes anterior → diffPct null', mesVacio.diffPct === null);
}

// ── C7: barritas día por día ──────────────────────────────
{
  const hoy = '2026-10-15';
  const dias = diasSemanaActual(hoy);
  const viajes = [viaje('2026-10-15', 36), viaje('2026-10-13', 24)];
  const empresa = new Map([['2026-10-15', 45], ['2026-10-16', 50]]);
  const barras = netoPorDia(viajes, empresa, dias, hoy);

  check('C7a 7 barras', barras.length === 7);
  const iHoy = dias.indexOf(hoy);
  check('C7b hoy: libre 36 + empresa 45 = 81', cerca(barras[iHoy].total, 81), `dio ${barras[iHoy].total}`);
  check('C7c martes 13: 24', cerca(barras[1].total, 24));
  check('C7d sábado 17 y domingo 18 marcados futuro', barras[5].futuro && barras[6].futuro);
  check('C7e días pasados no son futuro', !barras[0].futuro && !barras[iHoy].futuro);
  check('C7f lunes 12 vacío = 0', barras[0].total === 0);
}

// ── C8: meta semanal y ritmo ──────────────────────────────
check('C8a metaSemanal(150) = 900 (6 días)', metaSemanal(150) === 900);
check('C8b meta 0 → 0 (sin meta)', metaSemanal(0) === 0);
{
  // 2026-10-12 es LUNES
  check('C8c al LUNES el ritmo es meta×1', ritmoAlDia(150, '2026-10-12') === 150, `dio ${ritmoAlDia(150, '2026-10-12')}`);
  check('C8d al MIÉRCOLES (10-14) ritmo meta×3', ritmoAlDia(150, '2026-10-14') === 450, `dio ${ritmoAlDia(150, '2026-10-14')}`);
  check('C8e al SÁBADO (10-17) ritmo meta×6', ritmoAlDia(150, '2026-10-17') === 900, `dio ${ritmoAlDia(150, '2026-10-17')}`);
  check('C8f al DOMINGO (10-18) sigue meta×6 (descanso)', ritmoAlDia(150, '2026-10-18') === 900, `dio ${ritmoAlDia(150, '2026-10-18')}`);
  check('C8g meta 0 → ritmo 0', ritmoAlDia(0, '2026-10-17') === 0);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`CONTABILIDAD FASE AC: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);
