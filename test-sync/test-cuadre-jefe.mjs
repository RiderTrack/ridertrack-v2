// ═══════════════════════════════════════════════════════════
// 📲 TEST cuadre del jefe — FASE O + FASE P
// Corre con: node test-sync/test-cuadre-jefe.mjs
// (puro — sin Firebase, sin React, igual que cajaCore)
// ═══════════════════════════════════════════════════════════
import {
  armarMensajeCuadreJefe,
  aplicarPlantillaCuadre,
  calcularCuadreEntrega,
  normalizarCelJefe,
  normalizarPlantillasCuadre,
  PLANTILLA_CUADRE_DEFECTO,
  VARIABLES_CUADRE,
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

console.log('📲 TEST cuadre del jefe (FASE O + P)\n');

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

// ── 2. armarMensajeCuadreJefe: ejemplo literal (FASE P: LIMPIO) ──
console.log('2) armarMensajeCuadreJefe — día de Rudy (mensaje LIMPIO)');
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
check('fecha 9 oct', msg.includes('📅 9 oct'));
check('cobrado del día S/ 700.00', msg.includes('💵 *Cobrado del día: S/ 700.00*'));
check('FASE P: SIN "según la app"', !msg.includes('según la app'));
check('FASE P: SIN "sobran"', !msg.includes('sobran'));
check('FASE P: SIN "faltan"', !msg.includes('faltan'));
check('FASE P: SIN línea ℹ️', !msg.includes('ℹ️'));
check('te entrego en efectivo S/ 300.00', msg.includes('🤲 *Te entrego en efectivo: S/ 300.00*'));
check('el resto por yape S/ 400.00', msg.includes('📲 *El resto te lo deposito por Yape: S/ 400.00*'));
check('FASE P: recibe en total S/ 700.00', msg.includes('📄 *Recibe en total: S/ 700.00*'));
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
check('cuadre full: total 650', msgFull.includes('📄 *Recibe en total: S/ 650.00*'));
check('FASE P: full SIN ℹ️ aunque la diferencia sea −50', !msgFull.includes('ℹ️') && !msgFull.includes('la cubre el Yape'));

// le sobró efectivo: el mensaje NO lo menciona como problema
const sobraMsg = cierre({ efectivoCobrado: 400, digitalRider: 300, esperado: 400, contado: 450, diferencia: 50, netoDelDia: 700 });
const msgSobra = armarMensajeCuadreJefe(sobraMsg);
check('sobró → SIN "me quedó más efectivo"', !msgSobra.includes('me quedó más efectivo'));
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

// ── 5. FASE P: aplicarPlantillaCuadre ────────────────────
console.log('5) aplicarPlantillaCuadre (plantillas propias)');
// el caso que pidió Rudy: "la app calculó 150 pero me quedé con 270 — que
// diga que tengo 270, no los 150 que calculé"
const dia270 = cierre({ efectivoCobrado: 150, digitalRider: 850, contado: 270, netoDelDia: 1000, entregas: 12 });
const corta = aplicarPlantillaCuadre('Jefe: tengo {efectivo} en efectivo y te deposito {yape} por Yape. Total {total}.', dia270, 'Rudy');
check('plantilla corta: efectivo 270 (lo contado, NO los 150 de la app)', corta.includes('tengo S/ 270.00 en efectivo'));
check('plantilla corta: yape 730', corta.includes('S/ 730.00 por Yape'));
check('plantilla corta: total 1000', corta.includes('Total S/ 1000.00.'));
check('plantilla corta: sin rastro de 150.00', !corta.includes('150.00'));
// variables desconocidas quedan literal
check('variable desconocida queda literal', aplicarPlantillaCuadre('hola {foo} {efectivo}', dia270).includes('{foo}'));
check('variable desconocida: la conocida sí se reemplaza', aplicarPlantillaCuadra_ok(aplicarPlantillaCuadre('hola {foo} {efectivo}', dia270), dia270));
// líneas vacías se colapsan (gastos/nota/empresa vacíos)
const colapso = aplicarPlantillaCuadre('X\n{gastos}\n{nota}\n{empresa}\nY', dia270);
check('líneas de variables vacías se colapsan', colapso === 'X\n\nY', JSON.stringify(colapso));
// nombre por defecto Rider
check('sin nombre → Rider', aplicarPlantillaCuadre('de {nombre}', dia270).includes('de Rider'));
check('con nombre → el nombre', aplicarPlantillaCuadre('de {nombre}', dia270, 'Rudy').includes('de Rudy'));
// TODAS las variables de la UI se reemplazan en la plantilla default
const todas = aplicarPlantillaCuadre(
  VARIABLES_CUADRE.map((v) => `{${v.clave}}`).join('\n'),
  { ...dia270, empresa: 80, gastosEfectivo: 20, gastosDigital: 0, gastos: [{ id: 'g1', ts: 1, categoria: 'gasolina', concepto: '', monto: 20, pago: 'efectivo' }], nota: 'prueba' },
  'Rudy'
);
check('todas las variables de VARIABLES_CUADRE se reemplazan', !todas.includes('{'), todas);
// plantilla default = mensaje del jefe
check('default ≡ armarMensajeCuadreJefe', aplicarPlantillaCuadre(PLANTILLA_CUADRE_DEFECTO, cierreRudy, 'Rudy') === armarMensajeCuadreJefe(cierreRudy, 'Rudy'));
check('default no tiene "según la app"', !PLANTILLA_CUADRE_DEFECTO.includes('según la app'));

// ── 6. FASE P: normalizarPlantillasCuadre ────────────────
console.log('6) normalizarPlantillasCuadre (saneo de localStorage)');
check('null → []', normalizarPlantillasCuadre(null).length === 0);
check('JSON roto (string) → []', normalizarPlantillasCuadre('{"a":1}').length === 0);
check('filtra nulls y objetos sin nombre/texto', normalizarPlantillasCuadre([null, 5, { nombre: '', texto: 'x' }, { nombre: 'x', texto: '' }, { nombre: 'ok', texto: 'hola {total}' }]).length === 1);
const una = normalizarPlantillasCuadre([{ nombre: '  Corto  ', texto: 'tengo {efectivo}' }]);
check('recorta espacios del nombre', una[0]?.nombre === 'Corto');
const largas = normalizarPlantillasCuadre(
  Array.from({ length: 15 }, (_, i) => ({ nombre: `p${i}`, texto: 'x' }))
);
check('máximo 10 plantillas', largas.length === 10);
const conId = normalizarPlantillasCuadre([{ id: 'pl_fijo', nombre: 'A', texto: 'B', at: 123 }]);
check('conserva id y at', conId[0]?.id === 'pl_fijo' && conId[0]?.at === 123);
const sinId = normalizarPlantillasCuadre([{ nombre: 'A', texto: 'B' }]);
check('sin id → genera uno (pl…)', String(sinId[0]?.id || '').startsWith('pl'));

// ── 7. FASE Q: la caja descuenta lo de tu ruta (9/12) ────
console.log('7) FASE Q — descuento de tu paga en el cuadre');
// EL DÍA REAL DE RUDY (prueba FASE O): contado 300, fondo 0, neto 1182.37
// → ahora con 10 pedidos pagados (90.00 de paga): entrega 210 + yape 882.37
const diaQ = cierre({
  contado: 300, fondoInicial: 0, esperado: 125.72, diferencia: 174.28,
  efectivoCobrado: 125.72, digitalRider: 1056.65, netoDelDia: 1182.37,
  pagoRuta: { activo: true, cantidadNormal: 8, cantidadLejos: 2, tarifaNormal: 9, tarifaLejos: 12, total: 96 },
});
const qRudy = calcularCuadreEntrega(diaQ);
check('día de Rudy con paga 96: loTuyo 96', qRudy.loTuyo === 96, JSON.stringify(qRudy));
check('entrega 300−0−96 = 204 en efectivo', qRudy.efectivo === 204, JSON.stringify(qRudy));
check('yape 1182.37−96−204 = 882.37', Math.abs(qRudy.yape - 882.37) < 0.005, JSON.stringify(qRudy));
check('el jefe recibe 1086.37 (neto − tu paga)', Math.abs(qRudy.total - 1086.37) < 0.005, JSON.stringify(qRudy));
check('la empresa no le debe nada', qRudy.teDebe === 0);
// número (preview en vivo) y objeto (snapshot del cierre) → mismo resultado
const qNum = calcularCuadreEntrega({ contado: 300, fondoInicial: 0, netoDelDia: 1182.37, pagoRuta: 96 });
check('pagoRuta número ≡ objeto (preview vs cierre)', qNum.efectivo === qRudy.efectivo && qNum.yape === qRudy.yape && qNum.loTuyo === qRudy.loTuyo);
// CIERRE VIEJO (FASE O/P, sin pagoRuta) → SIN descuento, exacto como antes
const qViejo = calcularCuadreEntrega({ contado: 300, fondoInicial: 0, netoDelDia: 1182.37 });
check('cierre viejo sin pagoRuta: entrega 300 (regresión FASE O)', qViejo.efectivo === 300 && Math.abs(qViejo.yape - 882.37) < 0.005 && qViejo.loTuyo === 0);
// la paga sale PRIMERO de los billetes que tenés en la mano
const billetes = calcularCuadreEntrega({ contado: 100, fondoInicial: 0, netoDelDia: 100, pagoRuta: 90 });
check('paga 90 de 100 en billetes → entrega 10, yape 0', billetes.efectivo === 10 && billetes.yape === 0 && billetes.total === 10);
// fondo + paga juntos
const fondoPaga = calcularCuadreEntrega({ contado: 350, fondoInicial: 50, netoDelDia: 700, pagoRuta: 90 });
check('fondo 50 + paga 90: entrega 350−50−90 = 210', fondoPaga.efectivo === 210 && fondoPaga.yape === 400);
// paga cubierta por el yape digital (sin billetes en la mano)
const todoYape = calcularCuadreEntrega({ contado: 0, fondoInicial: 0, netoDelDia: 650, pagoRuta: 90 });
check('todo yape: entrega 0 efectivo + 560 yape', todoYape.efectivo === 0 && Math.abs(todoYape.yape - 560) < 0.005 && todoYape.teDebe === 0);
// paga MAYOR que toda la plata del día → la empresa te completa
const deuda = calcularCuadreEntrega({ contado: 50, fondoInicial: 0, netoDelDia: 50, pagoRuta: 90 });
check('paga 90 > día 50: te quedás todo y te deben 40', deuda.efectivo === 0 && deuda.yape === 0 && deuda.total === 0 && deuda.teDebe === 40);
// basura defensiva: null / texto / objeto sin total → 0 → sin descuento
check('pagoRuta null → sin descuento', calcularCuadreEntrega({ contado: 300, fondoInicial: 0, netoDelDia: 700, pagoRuta: null }).efectivo === 300);
check('pagoRuta texto → sin descuento', calcularCuadreEntrega({ contado: 300, fondoInicial: 0, netoDelDia: 700, pagoRuta: '90' }).efectivo === 300);
check('pagoRuta objeto roto → sin descuento', calcularCuadreEntrega({ contado: 300, fondoInicial: 0, netoDelDia: 700, pagoRuta: { activo: true } }).efectivo === 300);
check('pagoRuta negativo → sin descuento', calcularCuadreEntrega({ contado: 300, fondoInicial: 0, netoDelDia: 700, pagoRuta: -50 }).efectivo === 300);

// ── 8. FASE Q: el mensaje al jefe con el descuento ──────
console.log('8) FASE Q — mensaje al jefe con el descuento');
const msgQ = armarMensajeCuadreJefe(diaQ, 'Rudy');
check('mensaje con paga: línea "Mi paga de la ruta (10 pedidos): S/ 96.00 — ya descontada"', msgQ.includes('🛵 Mi paga de la ruta (10 pedidos): S/ 96.00 — ya descontada'), msgQ);
check('mensaje con paga: entrega 204.00', msgQ.includes('Te entrego en efectivo: S/ 204.00'), msgQ);
check('mensaje con paga: yape 882.37', msgQ.includes('por Yape: S/ 882.37'), msgQ);
check('mensaje con paga: recibe 1086.37', msgQ.includes('Recibe en total: S/ 1086.37'), msgQ);
check('mensaje sin deuda: no aparece "debiendo"', !msgQ.includes('debiendo'), msgQ);
// nPedidos sale del snapshot (8 normales + 2 lejanos), no de entregas
const soloNormal = armarMensajeCuadreJefe(cierre({ contado: 100, netoDelDia: 200, entregas: 99, pagoRuta: { activo: true, cantidadNormal: 3, cantidadLejos: 0, tarifaNormal: 9, tarifaLejos: 12, total: 27 } }));
check('cantidad de pedidos = normales+lejos del snapshot (3, no entregas 99)', soloNormal.includes('(3 pedidos): S/ 27.00'), soloNormal);
// con deuda → línea de la empresa
const msgDeuda = armarMensajeCuadreJefe(cierre({ contado: 50, netoDelDia: 50, entregas: 10, pagoRuta: { activo: true, cantidadNormal: 10, cantidadLejos: 0, tarifaNormal: 9, tarifaLejos: 12, total: 90 } }), 'Rudy');
check('mensaje con deuda: "La empresa me queda debiendo: S/ 40.00"', msgDeuda.includes('⚠️ La empresa me queda debiendo: S/ 40.00'), msgDeuda);
check('mensaje con deuda: entrega 0', msgDeuda.includes('Te entrego en efectivo: S/ 0.00'), msgDeuda);
// CIERRE VIEJO (sin pagoRuta): el mensaje default queda IGUAL que la FASE P
const msgViejo = armarMensajeCuadreJefe(cierreRudy, 'Rudy');
check('cierre viejo: sin línea de paga (regresión P)', !msgViejo.includes('Mi paga'), msgViejo);
check('cierre viejo: sin línea de deuda (regresión P)', !msgViejo.includes('debiendo'), msgViejo);
// variables nuevas en plantillas propias
const propietaria = aplicarPlantillaCuadre('ruta: {loTuyo} / entrega: {efectivo} / deben: {teDebe}', diaQ, 'Rudy');
check('plantilla propia con {loTuyo} → línea completa con S/ 96.00', propietaria.includes('ruta: 🛵') && propietaria.includes('S/ 96.00'), propietaria);
check('plantilla propia con {teDebe} vacío → línea limpia', propietaria.includes('deben:') && !propietaria.includes('deben: S/'), propietaria);
const VARIABLES_OK = VARIABLES_CUADRE.map((v) => v.clave);
check('VARIABLES_CUADRE incluye loTuyo y teDebe', VARIABLES_OK.includes('loTuyo') && VARIABLES_OK.includes('teDebe'));
// TODAS las variables siguen reemplazándose (ahora con pagoRuta presente)
const todasQ = aplicarPlantillaCuadre(
  VARIABLES_CUADRE.map((v) => `{${v.clave}}`).join('\n'),
  diaQ,
  'Rudy'
);
check('todas las variables se reemplazan con pagoRuta', !todasQ.includes('{'), todasQ);

// ── resumen ──────────────────────────────────────────────
console.log(`\n📊 ${ok} ✓ · ${fail} ✗`);
if (fail > 0) {
  console.log('❌ FASE Q: hay tests fallando');
  process.exit(1);
}
console.log('✅ FASE O + P + Q: cuadre del jefe OK');

// helper: la línea con {foo} también debe tener {efectivo} reemplazado
function aplicarPlantillaCuadra_ok(out, c) {
  const q = calcularCuadreEntrega(c);
  return out.includes(`S/ ${q.efectivo.toFixed(2)}`);
}
