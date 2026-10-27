// ═══════════════════════════════════════════════════════════
// 🎯 TEST recarga semanal + escáner v4 — FASE F
// 🪫 TEST recarga FLEXIBLE (calcularDuracion + diasRestantes) — FASE AS
// Corre con: node test-sync/test-recarga.mjs
// (puro — sin Firebase, sin React, igual que pagoPedidosCore)
// ═══════════════════════════════════════════════════════════
// recarga.ts importa '../types' sin extensión (estilo TS) → se
// compila con esbuild al vuelo (mismo patrón que test-pago-pedidos)
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild'); // verifica que existe
const OUT = new URL('./.tmp-recarga.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/drivertrack/services/recarga.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT,
  logLevel: 'silent',
});
const { calcularRecarga, comisionAcumulada, estadoSaldo, claveOrdenViaje, calcularDuracion, textoDias } = await import(OUT);

// escanerIA.ts es 100% autocontenido (sin imports) → import directo
import { sanearDatos } from '../src/drivertrack/services/escanerIA.ts';

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}

console.log('🎯 TEST recarga semanal + escáner v4 (FASE F)\n');

// ── 1. La calculadora: "quiero hacer 60 diarios" ───────────
console.log('1) calcularRecarga — la calculadora de Rudy');
{
  const c = calcularRecarga(60, 15, 7);
  check('60 diarios × 15% → comisión 9.00/día', c.comisionDia === 9, JSON.stringify(c));
  check('60 diarios × 15% × 7 → recarga 63.00', c.recargaSugerida === 63, JSON.stringify(c));
  check('bruto de la semana 420.00', c.brutoSemana === 420);
  check('bolsillo real 357.00', c.bolsilloReal === 357);

  const c2 = calcularRecarga(100, 10, 6);
  check('ánimo de 100 diarios × 10% × 6 → recarga 60.00', c2.recargaSugerida === 60, JSON.stringify(c2));
  check('100 diarios × 6 → bruto 600', c2.brutoSemana === 600);

  const c0 = calcularRecarga(0, 15, 7);
  check('meta 0 → todo 0', c0.recargaSugerida === 0 && c0.comisionDia === 0);

  const cClamp = calcularRecarga(60, 150, 7); // % imposible
  check('% mayor a 100 se recorta a 100', cClamp.comisionDia === 60);

  const cDias = calcularRecarga(60, 10, 0); // días raros
  check('días 0 cae en 7', cDias.recargaSugerida === 42, JSON.stringify(cDias));

  const cDec = calcularRecarga(55.5, 12.5, 5);
  check('decimales: 55.50 × 12.5% = 6.94/día', cDec.comisionDia === 6.94, String(cDec.comisionDia));
}

// ── 2. Comisión acumulada desde la recarga ────────────────
console.log('\n2) comisionAcumulada — cuánto consumiste de la recarga');
{
  const v = (fecha, hora, tarifa, origen = 'indrive') => ({
    id: `${fecha}-${hora}`, fecha, hora, origen,
    cliente: '', zona: '', direccion: '', celular: '',
    yapeNombre: '', yapeNumero: '', kmGPS: 0, duracionSeg: 0,
    tarifa, comisionPct: 0, comision: 0, neto: tarifa, notas: '',
  });
  const viajes = [
    v('2026-10-04', '10:00', 20),   // ANTES de la recarga (domingo)
    v('2026-10-05', '09:00', 10),   // justo el día, ANTES de la hora de la recarga
    v('2026-10-05', '16:00', 20),   // después de la recarga → cuenta
    v('2026-10-06', '08:30', 30),   // después → cuenta
    v('2026-10-06', '12:00', 40, 'rappi'), // NO es inDrive → no cuenta
  ];
  const desde = '2026-10-05 14:00';
  const usado = comisionAcumulada(viajes, 10, desde);
  check('solo los inDrive POSTERIORES a la recarga: (20+30)×10% = 5.00', usado === 5, String(usado));
  check('mismo día pero antes de la hora NO cuenta', comisionAcumulada([v('2026-10-05', '09:00', 100)], 10, desde) === 0);
  check('pct 0 → 0', comisionAcumulada(viajes, 0, desde) === 0);
  check('sin fecha de recarga → 0', comisionAcumulada(viajes, 10, '') === 0);
  check('viaje en el MISMO minuto de la recarga no cuenta (>)', comisionAcumulada([v('2026-10-05', '14:00', 100)], 10, desde) === 0);
  check('claveOrdenViaye paddea la hora', claveOrdenViaje({ fecha: '2026-10-05', hora: '9:5' }) === '2026-10-05 09:05');
}

// ── 3. El estado del saldo ────────────────────────────────
console.log('\n3) estadoSaldo — usaste X de Y, te queda Z');
{
  const rec = { activa: true, metaDiaria: 60, pct: 10, dias: 7, monto: 63, fecha: '2026-10-05 14:00' };
  check('sin monto → null', estadoSaldo([], { ...rec, monto: 0 }) === null);
  check('sin fecha → null', estadoSaldo([], { ...rec, fecha: '' }) === null);

  const viajes = [
    { id: '1', fecha: '2026-10-06', hora: '10:00', origen: 'indrive', tarifa: 300 },
  ];
  const s = estadoSaldo(viajes, rec);
  check('usado 30.00 de 63', s.usado === 30, String(s.usado));
  check('queda 33.00', s.saldo === 33, String(s.saldo));
  check('48% usado', Math.round(s.pctUsado * 100) === 48);
  check('no está casi agotada', s.casiAgotada === false);

  const s2 = estadoSaldo([{ ...viajes[0], tarifa: 600 }], rec); // 60 de 63
  check('60 de 63 → casi agotada (95%)', s2.casiAgotada === true);

  const s3 = estadoSaldo([{ ...viajes[0], tarifa: 800 }], rec); // 80 de 63 → saldo −17
  check('saldo negativo −17.00', s3.saldo === -17, String(s3.saldo));
}

// ── 3½. FASE AS: recarga FLEXIBLE ─────────────────────
console.log('\n3½) FASE AS — calcularDuracion: «hoy recargué 15, ¿cuánto me dura?»');
{
  const d = calcularDuracion(15, 60, 15); // comisión 9/día
  check('15 soles con 60×15% → comisión 9.00/día', d.comisionDia === 9, String(d.comisionDia));
  check('15 ÷ 9 = 1.7 días', d.dias === 1.7, String(d.dias));
  check('1.7 días → «~1 día y medio»', d.diasTexto === '~1 día y medio', d.diasTexto);
  check('estimable', d.estimable === true);

  const d2 = calcularDuracion(63, 60, 15); // la semana completa de siempre
  check('63 soles → 7 días justos', d2.dias === 7, String(d2.dias));
  check('7 días → «~7 días»', d2.diasTexto === '~7 días', d2.diasTexto);

  check('monto 0 → no estimable', calcularDuracion(0, 60, 15).estimable === false);
  check('sin meta → no estimable', calcularDuracion(15, 0, 15).estimable === false);
  check('sin % → no estimable', calcularDuracion(15, 60, 0).estimable === false);
  const d0 = calcularDuracion(15, 0, 15);
  check('no estimable → dias 0 y texto «—»', d0.dias === 0 && d0.diasTexto === '—');

  // % imposible se recorta: 60×100% = 60/día
  check('% 150 se recorta a 100: 30 con 60/día → 0.5 días', calcularDuracion(30, 60, 150).dias === 0.5);

  // textoDias: los bordes
  check('textoDias(2) → «~2 días»', textoDias(2) === '~2 días');
  check('textoDias(1.4) → «~1 día y medio»', textoDias(1.4) === '~1 día y medio');
  check('textoDias(1) → «~1 día»', textoDias(1) === '~1 día');
  check('textoDias(0.5) → «menos de 1 día»', textoDias(0.5) === 'menos de 1 día');
  check('textoDias(0) → «—»', textoDias(0) === '—');
  check('negativo → «—»', textoDias(-3) === '—');
}

// ── 3⅔. FASE AS: días restantes del saldo ───────────────
console.log('\n3⅔) estadoSaldo.diasRestantes — cuánto trabajo le queda al saldo');
{
  const rec = { activa: true, metaDiaria: 60, pct: 10, dias: 7, monto: 63, fecha: '2026-10-05 14:00' };
  const viajes = [
    { id: '1', fecha: '2026-10-06', hora: '10:00', origen: 'indrive', tarifa: 300 },
  ];
  const s = estadoSaldo(viajes, rec); // usado 30, saldo 33, comisión 6/día
  check('saldo 33 a 6/día → 5.5 días restantes', s.diasRestantes === 5.5, String(s.diasRestantes));
  const sSinRitmo = estadoSaldo(viajes, { ...rec, metaDiaria: 0 });
  check('sin meta → diasRestantes null (no estimable)', sSinRitmo.diasRestantes === null);
  const sAgotado = estadoSaldo([{ ...viajes[0], tarifa: 900 }], rec); // usado 90 > 63
  check('saldo agotado → diasRestantes 0', sAgotado.diasRestantes === 0, String(sAgotado.diasRestantes));
  check('regresión: campos viejos del bloque 3 intactos', s.usado === 30 && s.saldo === 33 && s.casiAgotada === false);
}

// ── 4. Escáner v4 (FASE I, ya en la app): A/B y observación ──
console.log('\n4) sanearDatos — A y B por separado + observación (FASE I)');
{
  const base = { cliente: '', direccionA: '', direccion: '', zona: '', referencia: '', observacion: '', telefono: '', yapeNombre: '', yapeNumero: '', tarifa: null };

  // a) el caso del usuario: la IA puso la MISMA dirección en A y B
  let d = sanearDatos({ ...base, direccionA: 'Av. Sucre 1235, Lince', direccion: 'av. sucre 1235, Lince' });
  check('misma dirección en A y B → se limpia la A', d.direccionA === '' && !!d.direccion);

  // b) la IA puso la única dirección en A (y B vacía) → se muda a B
  d = sanearDatos({ ...base, direccionA: 'C.2 Mz A Lt 4, Barrio Unión', direccion: '' });
  check('única dirección en A → pasa a B (la del formulario)', d.direccion === 'C.2 Mz A Lt 4, Barrio Unión' && d.direccionA === '');

  // c) A y B correctas y distintas → no se tocan
  d = sanearDatos({ ...base, direccionA: 'Av. Sucre 1235, Lince', direccion: 'C.2 Mz A Lt 4, VES' });
  check('A y B distintas quedan como vinieron', d.direccionA === 'Av. Sucre 1235, Lince' && d.direccion === 'C.2 Mz A Lt 4, VES');

  // d) la observación pasa prolija
  d = sanearDatos({ ...base, direccion: 'C.1 Barrio XV', observacion: 'voy a llevar una una bolsa, es un artefacto' });
  check('la observación se limpia de palabras repetidas', d.observacion === 'voy a llevar una bolsa, es un artefacto', JSON.stringify(d.observacion));

  // e) regresión de los fixes viejos: código de calle en cliente
  d = sanearDatos({ ...base, cliente: 'C.1', direccion: 'Barrio XV Popular' });
  check('regresión: "C.1" en cliente se muda a la dirección', d.cliente === '' && d.direccion === 'C.1 Barrio XV Popular');

  // f) regresión: nombre del yape rescata al cliente
  d = sanearDatos({ ...base, direccion: 'C.1 Barrio XV', yapeNombre: 'Mk', yapeNumero: '980 811 297' });
  check('regresión: cliente rescata del yape + número limpio', d.cliente === 'Mk' && d.yapeNumero === '980811297');
}

// ── 3¾. FASE AT: cancelados descuentan + ✏️ ajuste del contador ──
console.log('\n3¾) FASE AT — pedidos cancelados y sincronización manual');
{
  const rec = { activa: false, metaDiaria: 60, pct: 10, dias: 7, monto: 20, fecha: '2026-10-26 07:00' };
  const viajes = [
    { id: '1', fecha: '2026-10-26', hora: '10:00', origen: 'indrive', tarifa: 100 },
    // FASE AT: cancelados — inDrive igual cobra la comisión → descuentan igual
    { id: '2', fecha: '2026-10-26', hora: '11:00', origen: 'indrive', tarifa: 50, canceladoPor: 'cliente', comision: 0, neto: 0 },
    { id: '3', fecha: '2026-10-26', hora: '12:00', origen: 'indrive', tarifa: 40, canceladoPor: 'yo', comision: 0, neto: 0 },
    // un cancelado de OTRA plataforma no consume el saldo inDrive
    { id: '4', fecha: '2026-10-26', hora: '13:00', origen: 'rappi', tarifa: 30, canceladoPor: 'cliente' },
  ];
  const s = estadoSaldo(viajes, rec);
  check('cancelados descuentan igual: 100+50+40 al 10% → usado 19.00', s.usado === 19, JSON.stringify(s));
  check('el rappi cancelado NO consume el saldo inDrive', s.usado === 19 && s.saldo === 1, JSON.stringify(s));
  check('saldo con cancelados: 20 − 19 = 1.00', s.saldo === 1, String(s.saldo));
  check('sin ajuste: ajustado false y ajuste 0', s.ajustado === false && s.ajuste === 0);

  // ✏️ sincronización manual con el inDrive real
  const sAj = estadoSaldo(viajes, { ...rec, ajuste: -0.5 });
  check('ajuste −0.50 → saldo 0.50 (igualito al aplicativo)', sAj.saldo === 0.5, String(sAj.saldo));
  check('ajustado true con ajuste ≠ 0', sAj.ajustado === true && sAj.ajuste === -0.5);
  check('pctUsado sube con el ajuste: (20−0.5)/20 = 97.5%', sAj.pctUsado === 0.975, String(sAj.pctUsado));
  check('casiAgotada usa el saldo AJUSTADO (0.5 ≤ 3)', sAj.casiAgotada === true);

  // ajuste POSITIVO — el contador puede quedar por encima de la recarga
  const sPos = estadoSaldo(
    [{ id: '1', fecha: '2026-10-26', hora: '10:00', origen: 'indrive', tarifa: 40 }],
    { ...rec, ajuste: 30 },
  );
  check('ajuste +30 con consumido 4 → saldo 46', sPos.saldo === 46, String(sPos.saldo));
  check('pctUsado clamp a 0 cuando el saldo supera la recarga', sPos.pctUsado === 0, String(sPos.pctUsado));

  // regresión: sin ajuste el cálculo queda EXACTAMENTE como en FASE AS
  check('regresión: ajuste 0 → saldo = monto − usado', estadoSaldo(viajes, { ...rec, ajuste: 0 }).saldo === 1);
  check('regresión: sin el campo ajuste (recargas viejas) anda igual', estadoSaldo(viajes, { ...rec }).saldo === 1);

  // comisionAcumulada directa: los cancelados entran uno a uno
  check(
    'comisionAcumulada cuenta los 3 viajes indrive (incluye los 2 cancelados)',
    comisionAcumulada(viajes, 10, '2026-10-26 07:00') === 19,
  );
}

// ── resumen ───────────────────────────────────────────────
console.log(`\n═══ RESULTADO: ${ok} ✓ · ${fail} ✗ ═══`);
if (fail > 0) process.exit(1);
