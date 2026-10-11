// ═══════════════════════════════════════════════════════════
// 📜🤖 TEST FASE T — Historial de DriverTrack + avisos a AMBOS
// Corre con: node test-sync/test-historial-dt.mjs
// (puro — sin Firebase, sin React, igual que test-recarga)
// ═══════════════════════════════════════════════════════════
// historialDT.ts / destinosDT.ts importan con extensión .ts sin
// declarar (estilo TS) → se compilan con esbuild al vuelo
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild'); // verifica que existe

const OUT_H = new URL('./.tmp-historial.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/drivertrack/services/historialDT.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT_H,
  logLevel: 'silent',
});
const { diasHistorial, resumenPeriodo, etiquetaDia, moverDia } = await import(OUT_H);

const OUT_D = new URL('./.tmp-destinos.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/drivertrack/services/destinosDT.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT_D,
  logLevel: 'silent',
});
const { telefonosViaje, destinosDelAviso, destinoDelCobro } = await import(OUT_D);

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}

// helpers — un viaje mínimo como los que guarda la app
function viaje(fecha, tarifa, comision, origen = 'indrive', extra = {}) {
  return {
    id: `${fecha}-${Math.random().toString(36).slice(2, 7)}`,
    fecha,
    hora: '10:00',
    origen,
    cliente: 'Cliente',
    zona: 'Zona',
    direccion: 'Calle 1',
    celular: '987111222',
    yapeNombre: '',
    yapeNumero: '',
    kmGPS: 0,
    duracionSeg: 0,
    tarifa,
    comisionPct: 0,
    comision,
    neto: tarifa - comision,
    notas: '',
    ...extra,
  };
}
function gasto(fecha, monto) {
  return { id: `g-${fecha}-${monto}`, fecha, hora: '12:00', tipo: 'saldo', monto, nota: '' };
}

const HOY = '2025-10-12';       // domingo (fecha del caso de prueba)
const AYER = '2025-10-11';
const ANTEAYER = '2025-10-10';
const HACE_8 = '2025-10-04';

console.log('📜 TEST FASE T — Historial de DriverTrack + avisos a ambos\n');

// ── 1. diasHistorial — el renglón de cada día ──────────────
console.log('1) diasHistorial — cuánto hiciste cada día');
{
  const viajes = [
    viaje(HOY, 12, 0, 'indrive'),
    viaje(HOY, 9, 0, 'directo'),
    viaje(AYER, 15, 3, 'rappi'),
    viaje(ANTEAYER, 10, 1, 'indrive'),
  ];
  const gastos = [gasto(AYER, 5), gasto('2025-10-05', 20)]; // 10-05 = día SIN viajes
  const dias = diasHistorial(viajes, gastos);

  check('4 días con movimiento (hoy, ayer, anteayer + solo gastos)', dias.length === 4, JSON.stringify(dias.map(d => d.fecha)));
  check('del más nuevo al más viejo', dias[0].fecha === HOY && dias[1].fecha === AYER && dias[2].fecha === ANTEAYER && dias[3].fecha === '2025-10-05');

  const dHoy = dias[0];
  check('hoy: 2 viajes, bruto 21, neto 21', dHoy.n === 2 && dHoy.bruto === 21 && dHoy.neto === 21, JSON.stringify(dHoy));
  check('hoy: porOrigen cuenta inDrive 1 + directo 1', dHoy.porOrigen.indrive?.n === 1 && dHoy.porOrigen.directo?.n === 1);

  const dAyer = dias[1];
  check('ayer: neto 12 (15 − 3 de comisión)', dAyer.neto === 12, JSON.stringify(dAyer));
  check('ayer: gastos 5 → en mano 7', dAyer.gastos === 5 && dAyer.enMano === 7);
  check('día con gastos pero SIN viajes → soloGastos', dias[3].soloGastos === true && dias[3].n === 0 && dias[3].gastos === 20);

  check('sin nada → []', diasHistorial([], []).length === 0);
  check('viajes sin fecha no rompen (defensivo)', Array.isArray(diasHistorial([viaje('', 9, 0)], [])));
}

// ── 2. resumenPeriodo — 7 días / 30 días / todo ────────────
console.log('2) resumenPeriodo — los últimos 7, 30 y todo');
{
  // 8 días de historia: hace 8 días NO debe entrar en los 7
  const viajes = [
    viaje(HOY, 10, 0),
    viaje(AYER, 10, 0),
    viaje(ANTEAYER, 10, 0),
    viaje(HACE_8, 50, 0), // fuera de la ventana de 7 (10-12 − 6 = 10-06)
  ];
  const gastos = [gasto(HACE_8, 30), gasto(AYER, 4)];
  const dias = diasHistorial(viajes, gastos);

  const r7 = resumenPeriodo(dias, HOY, 7);
  check('7 días: solo los 3 viajes de la ventana (el de hace 8 días queda afuera)', r7.n === 3, JSON.stringify(r7));
  check('7 días: neto 30 (3 × 10)', r7.neto === 30);
  check('7 días: gastos 4 → en mano 26', r7.gastos === 4 && r7.enMano === 26);
  check('7 días: 3 días con viajes', r7.dias === 3);

  const rTodo = resumenPeriodo(dias, HOY, 'todo');
  check('todo: 4 viajes, neto 80', rTodo.n === 4 && rTodo.neto === 80, JSON.stringify(rTodo));
  check('todo: gastos 34 → en mano 46', rTodo.gastos === 34 && rTodo.enMano === 46);

  // ventana de 7 DÍAS EXACTOS: hoy − 6 = límite incluido
  const diasBorde = diasHistorial([viaje('2025-10-06', 9, 0), viaje('2025-10-05', 9, 0)], []);
  const rBorde = resumenPeriodo(diasBorde, HOY, 7);
  check('borde: 10-06 entra en los 7 días, 10-05 no', rBorde.n === 1, JSON.stringify(rBorde));

  // día solo-gastos no cuenta como día trabajado
  const diasGasto = diasHistorial([], [gasto(AYER, 10)]);
  const rG = resumenPeriodo(diasGasto, HOY, 7);
  check('día solo gastos: no cuenta como día con viajes', rG.dias === 0 && rG.n === 0 && rG.gastos === 10);
}

// ── 3. etiquetaDia + moverDia — Hoy · Ayer · Anteayer ──────
console.log('3) etiquetaDia + moverDia — las etiquetas del renglón');
{
  check('hoy → "Hoy"', etiquetaDia(HOY, HOY) === 'Hoy');
  check('ayer → "Ayer"', etiquetaDia(AYER, HOY) === 'Ayer');
  check('anteayer → "Anteayer"', etiquetaDia(ANTEAYER, HOY) === 'Anteayer');
  check('más viejo → fecha bonita "miércoles 8 oct"', etiquetaDia('2025-10-08', HOY) === 'miércoles 8 oct', etiquetaDia('2025-10-08', HOY));

  check('moverDia −1 sobre el 12 → 11', moverDia(HOY, -1) === AYER);
  check('moverDia −1 sobre el 1 de oct → 30 de set (fin de mes)', moverDia('2025-10-01', -1) === '2025-09-30');
  check('moverDia −1 sobre el 1 de ene → 31 de dic (fin de año)', moverDia('2025-01-01', -1) === '2024-12-31');
  check('moverDia +1 sobre el 31 de oct → 1 de nov', moverDia('2025-10-31', 1) === '2025-11-01');
}

// ── 4. destinosDT — los avisos a AMBOS ─────────────────────
console.log('4) destinosDT — el aviso le llega a los dos');
{
  const dosTels = { celular: '', celularEnvia: '987111222', celularRecibe: '987333444' };
  const unTel = { celular: '987111222', celularEnvia: '', celularRecibe: '' };
  const mismoNum = { celular: '987111222', celularEnvia: '987111222', celularRecibe: '987111222' };

  check('telefonosViaje: dos teléfonos distintos → dos', telefonosViaje(dosTels).dos === true);
  check('telefonosViaje: el celular viejo cuenta como quien envía', telefonosViaje({ celular: '987111222', celularRecibe: '987333444' }).envia === '987111222');
  check('telefonosViaje: un solo número → no hay chips', telefonosViaje(unTel).dos === false);
  check('telefonosViaje: mismo número 3 veces → no hay chips', telefonosViaje(mismoNum).dos === false);

  // el pedido literal de Rudy: "ya llegué" a AMBOS
  check('destinosDelAviso ambos → LOS DOS números (recibe primero, como la foto)', JSON.stringify(destinosDelAviso(dosTels, 'ambos')) === JSON.stringify(['987333444', '987111222']), JSON.stringify(destinosDelAviso(dosTels, 'ambos')));
  check('destinosDelAviso envia → solo el que envía', JSON.stringify(destinosDelAviso(dosTels, 'envia')) === JSON.stringify(['987111222']));
  check('destinosDelAviso recibe → solo el que recibe', JSON.stringify(destinosDelAviso(dosTels, 'recibe')) === JSON.stringify(['987333444']));
  check('un solo teléfono + ambos → ese solo (no se duplica)', destinosDelAviso(unTel, 'ambos').length === 1);
  check('mismo número en ambos campos + ambos → 1 único (Set)', destinosDelAviso(mismoNum, 'ambos').length === 1);
  check('elección envía pero no hay → cae al que recibe (defensivo)', JSON.stringify(destinosDelAviso(unTel, 'envia')) === JSON.stringify(['987111222']));
  check('sin ningún teléfono → []', destinosDelAviso({ celular: '', celularEnvia: '', celularRecibe: '' }, 'ambos').length === 0);

  // el cobro SIEMPRE a uno solo (FASE M intacta)
  check('destinoDelCobro con ambos → quien RECIBE (default FASE M)', destinoDelCobro(dosTels, 'ambos') === '987333444');
  check('destinoDelCobro elegiste envía → quien envía', destinoDelCobro(dosTels, 'envia') === '987111222');
  check('destinoDelCobro elegiste recibe → quien recibe', destinoDelCobro(dosTels, 'recibe') === '987333444');
  check('destinoDelCobro sin quien recibe → cae al que envía', destinoDelCobro(unTel, 'ambos') === '987111222');
}

console.log(`\n📜 Resultado FASE T: ${ok} ✓ · ${fail} ✗`);
if (fail > 0) process.exit(1);
