// ═══════════════════════════════════════════════════════════
// 📲 TEST cuadre del jefe — FASE O
// Corre con: node test-sync/test-cuadre-jefe.mjs
// (puro — sin Firebase, sin React, igual que cajaCore)
// ═══════════════════════════════════════════════════════════
import {
  armarMensajeCuadreJefe,
  calcularCuadreEntrega,
  normalizarCelJefe,
} from '../src/utils/cajaCore.ts';

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}

/** arma un CierreCaja con defaults neutros para los tests (JS puro — sin tipos) */
function cierre(e) {
  return {
    fecha: '2026-10-09',
    at: Date.now(),
    fondoInicial: 0,
    entregas: 10,
    efectivoCobrado: 0,
    digitalRider: 0,
    empresa: 0,
    gastosEfectivo: 0,
    gastosDigital: 0,
    esperado: 0,
    contado: 0,
    diferencia: 0,
    netoDelDia: 0,
    gastos: [],
    ...e,
  };
}

console.log('📲 TEST cuadre del jefe (FASE O)\n');

// ── 1. calcularCuadreEntrega ──────────────────────────────
console.log('1) calcularCuadreEntrega');
// EJEMPLO LITERAL DE RUDY: "hice 700; la app dice 400 efectivo + 300 yape;
// hoy tengo 300 en la mano → se lo doy en efectivo y el resto por yape"
const rudy = calcularCuadreEntrega({ contado: 300, fondoInicial: 0, netoDelDia: 700 });
check('ejemplo literal de Rudy: 300 efectivo', rudy.efectivo === 300, JSON.stringify(rudy));
check('ejemplo literal de Rudy: 400 por yape', rudy.yape === 400, JSON.stringify(rudy));
check('ejemplo literal de Rudy: total 700', rudy.total === 700, JSON.stringify(rudy));
// fondo se resta (es suyo, no se entrega)
const conFondo = calcularCuadreEntrega({ contado: 350, fondoInicial: 50, netoDelDia: 700 });
check('fondo se queda afuera: 350−50 → efectivo 300', conFondo.efectivo === 300);
check('con fondo: yape 400', conFondo.yape === 400);
// gastos ya descontados del neto (gasolina 50 en efectivo del día)
const gasolina = calcularCuadreEntrega({ contado: 350, fondoInicial: 0, netoDelDia: 650 });
check('gasto efectivo: neto 650 → 350 efectivo + 300 yape', gasolina.efectivo === 350 && gasolina.yape === 300);
// gasto pagado por yape: neto 650, contado 400 (todo el cobro en billetes)
const gasYape = calcularCuadreEntrega({ contado: 400, fondoInicial: 0, netoDelDia: 650 });
check('gasto yape: deposita solo 250 (lo que quedó en su yape)', gasYape.efectivo === 400 && gasYape.yape === 250);
// clamps
const sinFondo = calcularCuadreEntrega({ contado: 30, fondoInicial: 50, netoDelDia: 700 });
check('contado < fondo → efectivo 0', sinFondo.efectivo === 0);
check('contado < fondo → yape 700', sinFondo.yape === 700);
const sobro = calcularCuadreEntrega({ contado: 800, fondoInicial: 0, netoDelDia: 700 });
check('sobró: yape clamp 0', sobro.yape === 0 && sobro.efectivo === 800);
// decimales
const decimales = calcularCuadreEntrega({ contado: 300.5, fondoInicial: 20, netoDelDia: 700.25 });
check('decimales: 280.50 efectivo + 419.75 yape', Math.abs(decimales.efectivo - 280.5) < 1e-9 && Math.abs(decimales.yape - 419.75) < 1e-9);

// ── 2. armarMensajeCuadreJefe: ejemplo literal ────────────
console.log('2) armarMensajeCuadreJefe — día de Rudy');
// día de Rudy: 400 efectivo + 300 yape, contó 300 (le quedaron 100 menos: llegaron por yape)
const cierreRudy = cierre({
  efectivoCobrado: 400, digitalRider: 300, empresa: 0,
  gastos: [], gastosEfectivo: 0, gastosDigital: 0,
  fondoInicial: 0, esperado: 400, contado: 300, diferencia: -100, netoDelDia: 700,
});
const msg = armarMensajeCuadreJefe(cierreRudy, 'Rudy');
console.log('--- mensaje ---');
console.log(msg);
console.log('---------------');
check('título CUADRE DEL DÍA — Rudy', msg.includes('💰 *CUADRE DEL DÍA — Rudy*'));
check('cobrado del día S/ 700.00', msg.includes('💵 *Cobrado del día: S/ 700.00*'));
check('según la app: 400 efectivo + 300 yape', msg.includes('· según la app: S/ 400.00 en efectivo + S/ 300.00 en yape'));
check('te entrego en efectivo S/ 300.00', msg.includes('🤲 *Te entrego en efectivo: S/ 300.00*'));
check('el resto por yape S/ 400.00', msg.includes('📲 *El resto te lo deposito por Yape: S/ 400.00*'));
check('línea de diferencia la cubre el Yape', msg.includes('la diferencia la cubre el Yape'));
check('dif con signo −S/ 100.00', msg.includes('−S/ 100.00'));
check('sin empresa (0) → sin línea POS', !msg.includes('la empresa cobra directo'));
check('sin gastos → sin línea gastos', !msg.includes('gastos de la ruta'));
check('sin nota → sin línea 📝', !msg.includes('📝'));

// ── 3. mensaje condicionales ─────────────────────────────
console.log('3) mensaje: condicionales');
const full = cierre({
  efectivoCobrado: 400, digitalRider: 300, empresa: 80,
  gastos: [
    { id: 'g1', ts: 1, categoria: 'gasolina', concepto: '6 gal', monto: 40, pago: 'efectivo' },
    { id: 'g2', ts: 2, categoria: 'comida', concepto: 'menú', monto: 10, pago: 'yape' },
  ],
  gastosEfectivo: 40, gastosDigital: 10,
  fondoInicial: 50, esperado: 410, contado: 360, diferencia: -50,
  netoDelDia: 650, nota: 'el cliente 7 pagó con billetes mojados',
});
const msgFull = armarMensajeCuadreJefe(full, 'Rudy');
console.log('--- mensaje full ---');
console.log(msgFull);
console.log('-------------------');
check('línea empresa directo S/ 80.00', msgFull.includes('· la empresa cobra directo: S/ 80.00 (no pasa por mis manos)'));
check('línea gastos S/ 50.00 (2) — ya descontados', msgFull.includes('· gastos de la ruta: S/ 50.00 (2) — ya descontados'));
check('nota al final', msgFull.includes('📝 el cliente 7 pagó con billetes mojados'));
// cuadre con fondo 50 y neto 650: efectivo = 360−50 = 310; yape = 650−310 = 340
check('cuadre full: efectivo 310 (contado 360 − fondo 50)', msgFull.includes('🤲 *Te entrego en efectivo: S/ 310.00*'));
check('cuadre full: yape 340 (650 − 310)', msgFull.includes('📲 *El resto te lo deposito por Yape: S/ 340.00*'));

const cuadra = cierre({ efectivoCobrado: 400, digitalRider: 300, esperado: 400, contado: 400, diferencia: 0, netoDelDia: 700 });
const msgCuadra = armarMensajeCuadreJefe(cuadra);
check('cuadra exacto → SIN línea ℹ️', !msgCuadra.includes('ℹ️'));

const sobraMsg = cierre({ efectivoCobrado: 400, digitalRider: 300, esperado: 400, contado: 450, diferencia: 50, netoDelDia: 700 });
const msgSobra = armarMensajeCuadreJefe(sobraMsg);
check('sobró → línea +S/ con "más efectivo"', msgSobra.includes('ℹ️ Me quedó más efectivo que lo previsto (+S/ 50.00)'));
check('sobró → yape 250 (700 − 450)', msgSobra.includes('📲 *El resto te lo deposito por Yape: S/ 250.00*'));

// día vacío (0 clientes): todo en 0, no crashea
const vacio = cierre({ contado: 0, netoDelDia: 0 });
const msgVacio = armarMensajeCuadreJefe(vacio);
check('día vacío no crashea: cobrado S/ 0.00', msgVacio.includes('💵 *Cobrado del día: S/ 0.00*'));
check('día vacío: entrega S/ 0.00', msgVacio.includes('🤲 *Te entrego en efectivo: S/ 0.00*'));

// ── 4. normalizarCelJefe ─────────────────────────────────
console.log('4) normalizarCelJefe');
check('9 dígitos → 51 + 9', normalizarCelJefe('987654321') === '51987654321');
check('ya con 51 se respeta', normalizarCelJefe('51987654321') === '51987654321');
check('con espacios y guiones', normalizarCelJefe('987 654-321') === '51987654321');
check('+ 51 explícito', normalizarCelJefe('+51 987 654 321') === '51987654321');
check('vacío → vacío', normalizarCelJefe('') === '');
check('solo basura → vacío', normalizarCelJefe('---') === '');
check('8 dígitos se queda como está', normalizarCelJefe('98765432') === '98765432');

// ── resumen ──────────────────────────────────────────────
console.log(`\n📊 ${ok} ✓ · ${fail} ✗`);
if (fail > 0) {
  console.log('❌ FASE O: hay tests fallando');
  process.exit(1);
}
console.log('✅ FASE O: cuadre del jefe OK');
