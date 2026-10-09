// ═══════════════════════════════════════════════════════════
// 🎯 TEST recarga semanal + escáner v4 — FASE F
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
const { calcularRecarga, comisionAcumulada, estadoSaldo, claveOrdenViaje } = await import(OUT);

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

// ── resumen ───────────────────────────────────────────────
console.log(`\n═══ RESULTADO: ${ok} ✓ · ${fail} ✗ ═══`);
if (fail > 0) process.exit(1);
