// ═══════════════════════════════════════════════════════════
// 🛵 TEST pagoPedidosCore — FASE D
// Corre con: node test-sync/test-pago-pedidos.mjs
// (puro — sin Firebase, sin React, igual que cajaCore)
// ═══════════════════════════════════════════════════════════
import {
  PAGO_PEDIDOS_DEFAULT,
  normalizarDistrito,
  distritoEsLejos,
  esLejos,
  calcularPagoPedidos,
  calcularLiquidacion,
} from '../src/utils/pagoPedidosCore.ts';

// resumenCore importa './cajaCore' sin extensión (estilo TS) →
// se compila con esbuild al vuelo (mismo patrón que test-sync-dt)
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild'); // verifica que existe
const OUT = new URL('./.tmp-resumenCore.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/utils/resumenCore.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT,
  logLevel: 'silent',
});
const { armarResumenDia, armarMensajeResumen } = await import(OUT);

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}

console.log('🛵 TEST pagoPedidosCore (FASE D)\n');

// ── 1. Normalización de distritos ─────────────────────────
console.log('1) normalizarDistrito / distritoEsLejos');
check('minúsculas y espacios', normalizarDistrito('  Chorrillos ') === 'chorrillos');
check('sin tildes', normalizarDistrito('Cieneguilla') === 'cieneguilla');
check('puntuación fuera', distritoEsLejos('Chorrillos,', ['chorrillos']));
check('mayúsculas indistintas', distritoEsLejos('CARABAYLLO', ['Carabayllo']));
check('tildes indistintas', distritoEsLejos('Ate', ['Até']));
check('distrito vacío nunca es lejos', !distritoEsLejos('', ['chorrillos']));
check('distrito vacío en la lista no matchea', !distritoEsLejos('Surco', ['', ' ']));
check('distinto no matchea', !distritoEsLejos('Surco', ['chorrillos']));

// ── 2. esLejos: prioridad manual > lista > normal ─────────
console.log('2) esLejos (prioridades)');
const cfg = { ...PAGO_PEDIDOS_DEFAULT, activo: true, distritosLejos: ['Chorrillos'] };
check('manual true manda', esLejos({ dist: 'Surco', lejos: true }, cfg) === true);
check('manual false pisa la lista', esLejos({ dist: 'Chorrillos', lejos: false }, cfg) === false);
check('sin manual → lista', esLejos({ dist: 'chorrillos ' }, cfg) === true);
check('sin manual ni lista → normal', esLejos({ dist: 'Surco' }, cfg) === false);
check('sin distrito → normal', esLejos({}, cfg) === false);

// ── 3. Cálculo: solo ENTREGADOS pagan ─────────────────────
console.log('3) calcularPagoPedidos');
const dia = [
  { id: 1, st: 'efectivo', dist: 'Surco' },        // entregado normal (9)
  { id: 2, st: 'efectivo', dist: 'Chorrillos' },   // entregado lejos (12)
  { id: 3, st: 'yape-rudy', dist: 'Surco', lejos: true }, // entregado lejos manual (12)
  { id: 4, st: 'pendiente', dist: 'Surco' },       // NO paga
  { id: 5, st: 'fallida', dist: 'Chorrillos' },    // NO paga
  { id: 6, st: 'ausente', dist: 'Surco' },         // NO paga
  { id: 7, st: 'empresa', dist: 'Surco' },         // entregado normal (9)
  { id: 8, st: 'pos', dist: 'Surco' },             // entregado normal (9)
];
const r1 = calcularPagoPedidos(dia, cfg);
check('entregados = 5', r1.entregados === 5, `→ ${r1.entregados}`);
check('normales = 3', r1.cantidadNormal === 3, `→ ${r1.cantidadNormal}`);
check('lejanos = 2', r1.cantidadLejos === 2, `→ ${r1.cantidadLejos}`);
check('montoNormal = 27', r1.montoNormal === 27, `→ ${r1.montoNormal}`);
check('montoLejos = 24', r1.montoLejos === 24, `→ ${r1.montoLejos}`);
check('total = 51', r1.total === 51, `→ ${r1.total}`);

// ejemplo literal de Rudy: 10 pedidos de 9 = 90
const diez = Array.from({ length: 10 }, (_, i) => ({ id: i, st: 'efectivo', dist: 'Surco' }));
check('10 pedidos × 9 = 90 (ejemplo de Rudy)', calcularPagoPedidos(diez, cfg).total === 90);

// ── 4. Modo OFF = cero absoluto ───────────────────────────
console.log('4) temporada OFF');
const rOff = calcularPagoPedidos(dia, PAGO_PEDIDOS_DEFAULT);
check('activo=false → total 0', rOff.total === 0);
check('activo=false → entregados 0', rOff.entregados === 0);

// ── 5. Tarifas custom ─────────────────────────────────────
console.log('5) tarifas editables');
const cfgCustom = { ...cfg, tarifaNormal: 10, tarifaLejos: 15 };
const rCustom = calcularPagoPedidos(dia, cfgCustom);
check('10 normales → 3×10=30', rCustom.montoNormal === 30);
check('lejos custom 15 → 2×15=30', rCustom.montoLejos === 30);
check('tarifa inválida cae al default 9', calcularPagoPedidos(dia, { ...cfg, tarifaNormal: -5 }).montoNormal === 27);
check('tarifa NaN cae al default', calcularPagoPedidos(dia, { ...cfg, tarifaLejos: NaN }).montoLejos === 24);

// ── 6. Liquidación ────────────────────────────────────────
console.log('6) calcularLiquidacion');
const l1 = calcularLiquidacion(200, r1); // 200 efectivo − 51 pedidos
check('a entregar = 149', l1.aEntregar === 149, `→ ${l1.aEntregar}`);
check('empresa no te debe', l1.empresaTeDebe === 0);
const l2 = calcularLiquidacion(40, r1); // 40 − 51 → negativo
check('empresa te debe 11', l2.empresaTeDebe === 11, `→ ${l2.empresaTeDebe}`);
check('a entregar 0 cuando es negativo', l2.aEntregar === 0);
const l3 = calcularLiquidacion(51, r1);
check('justo exacto → a entregar 0', l3.aEntregar === 0 && l3.empresaTeDebe === 0);

// ── 7. Bordes ─────────────────────────────────────────────
console.log('7) bordes');
check('lista sin clientes', calcularPagoPedidos([], cfg).total === 0);
check('clientes undefined-safe', calcularPagoPedidos(undefined, cfg).total === 0);
check('st raro no paga', calcularPagoPedidos([{ st: 'no-existe' }], cfg).entregados === 0);
check('st vacío no paga', calcularPagoPedidos([{ st: '' }], cfg).entregados === 0);
check('lista lejana vacía → todo normal', calcularPagoPedidos(dia, { ...cfg, distritosLejos: [] }).cantidadLejos === 1, `(solo el manual lejos queda)`);

console.log(`\n${'═'.repeat(44)}`);
console.log('8) mensaje del MATE (resumenCore)');

// día con 8 normales + 2 lejanos, 10 efectivo de S/50 c/u = 500 en caja
const diaMATE = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: i + 1, st: 'efectivo', dist: 'Surco', cobrar: 50 })),
  { id: 9, st: 'efectivo', dist: 'Chorrillos', cobrar: 50 },
  { id: 10, st: 'efectivo', dist: 'Carabayllo', cobrar: 50, lejos: true },
  { id: 11, st: 'fallida', dist: 'Surco', cobrar: 50 }, // no paga
];
const ppMATE = calcularPagoPedidos(diaMATE, cfg);
const res = armarResumenDia({ clientes: diaMATE, gastos: [], fondo: 0, pagoPedidos: ppMATE });
const msg = armarMensajeResumen(res, null, 'Rudy');
check('resumen lleva pagoPedidos', res.pagoPedidos?.total === 96, `→ ${res.pagoPedidos?.total}`);
check('mensaje tiene línea 🛵 Por pedidos', msg.includes('🛵 *Por pedidos*'), msg.split('\n').find(l => l.includes('Pedidos')));
check('desglose 8 × S/ 9', msg.includes('8 × S/ 9'));
check('desglose lejos 2 × S/ 12', msg.includes('2 × S/ 12 (lejos)'));
check('total 96.00 en el mensaje', msg.includes('96.00'));
check('liquidación: entregás 404 (500 − 96)', msg.includes('Entregás a la empresa: S/ 404.00'), msg.split('\n').find(l => l.includes('Entregás')));
check('efectivo 500 en el mensaje', msg.includes('Efectivo: S/ 500.00'));

// sin temporada → el mensaje queda IGUAL que antes (sin línea 🛵)
const resOff = armarResumenDia({ clientes: diaMATE, gastos: [], fondo: 0, pagoPedidos: null });
const msgOff = armarMensajeResumen(resOff, null, 'Rudy');
check('modo OFF → mensaje sin línea 🛵', !msgOff.includes('Por pedidos'));
check('modo OFF → sin campo pagoPedidos', resOff.pagoPedidos === null);

// día chico: 1 pedido de S/5 cobrado, te pagan S/9 → empresa te debe 4
const diaDebe = [{ st: 'efectivo', dist: 'Surco', cobrar: 5 }];
const ppDebe = calcularPagoPedidos(diaDebe, cfg);
const resDebe = armarResumenDia({ clientes: diaDebe, gastos: [], fondo: 0, pagoPedidos: ppDebe });
const msgDebe = armarMensajeResumen(resDebe, null, 'Rudy');
check('empresa te debe (9 − 5 = 4)', msgDebe.includes('La empresa te debe: S/ 4.00'), msgDebe.split('\n').find(l => l.includes('debe')));
check('y 30 − 9 = 21 da a entregar', (() => {
  const dia21 = [{ st: 'efectivo', dist: 'Surco', cobrar: 30 }];
  const r = armarMensajeResumen(armarResumenDia({ clientes: dia21, gastos: [], fondo: 0, pagoPedidos: calcularPagoPedidos(dia21, cfg) }), null, 'Rudy');
  return r.includes('Entregás a la empresa: S/ 21.00');
})());

console.log(`\n${'═'.repeat(44)}`);
console.log(`RESULTADO: ${ok} ✓ / ${fail} ✗`);
if (fail > 0) { console.log('❌ HAY FALLOS'); process.exit(1); }
console.log('✅ TODO OK');
