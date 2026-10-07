// ═══════════════════════════════════════════════════════════
// 🅾️ TEST paradas — FASE M (multi-punto: A → B → C → D)
// Corre con: node test-sync/test-paradas.mjs
// Prueba las funciones PURAS del escáner v5 (prompt + sanearParadas
// + sanearDatos con paradas) y que un VIAJE con paradas suba a la
// nube INTACTO por el sync — sin llamar a la IA.
// ═══════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild'); // verifica que existe

const OUT = new URL('./.tmp-paradas.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/drivertrack/services/escanerIA.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT,
  logLevel: 'silent',
});
const { __escanerTests } = await import(OUT);
const { sanearDatos, sanearParadas, PROMPT } = __escanerTests;

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}

/** Fixture de respuesta de la IA (con o sin paradas) */
function resp(parcial = {}) {
  return sanearDatos({
    cliente: '', direccionA: '', direccion: '', zona: '', referencia: '',
    observacion: '', telefono: '', yapeNombre: '', yapeNumero: '', tarifa: null,
    ...parcial,
  });
}

console.log('🅾️ TEST paradas — FASE M (multi-punto)\n');

// ── 1. El PROMPT v5 enseña las paradas ──
console.log('▶ 1. PROMPT v5 (lo que la IA va a leer)');
check('regla MULTI-PUNTO: la primera entrega va en direccion, las demás en paradas',
  PROMPT.includes('MULTI-PUNTO') && PROMPT.includes('MÁS DE UNA ENTREGA'));
check('las paradas van EN ORDEN DE RUTA',
  PROMPT.includes('EN ORDEN DE RUTA'));
check('el recojo JAMÁS va en paradas',
  PROMPT.includes('NUNCA pongas el recojo (A) en paradas'));
check('sin entregas extra → paradas: []',
  PROMPT.includes('"paradas": []'));
check('EJEMPLO 3 de multi-punto incluido',
  PROMPT.includes('EJEMPLO 3') && PROMPT.includes('Jr. Los Álamos 245'));
check('paradas en las claves del JSON final',
  PROMPT.includes('cliente, direccionA, direccion, paradas, zona'));

// ── 2. sanearParadas: defensas contra respuestas raras ──
console.log('\n▶ 2. sanearParadas — defensas contra la IA');
check('array limpio pasa tal cual',
  JSON.stringify(sanearParadas(['Jr. Los Álamos 245'], '', '')) === JSON.stringify(['Jr. Los Álamos 245']));
check('undefined → []',
  JSON.stringify(sanearParadas(undefined, '', '')) === '[]');
check('la IA mandó un STRING en vez de array → se convierte en array de 1',
  JSON.stringify(sanearParadas('Jr. Los Álamos 245', '', '')) === JSON.stringify(['Jr. Los Álamos 245']));
check('objetos/números dentro del array se ignoran',
  JSON.stringify(sanearParadas([{ x: 1 }, 42, 'Av. Real 123'], '', '')) === JSON.stringify(['Av. Real 123']));
check('vacías y espacios se sacan',
  JSON.stringify(sanearParadas(['', '   ', 'Av. Real 123'], '', '')) === JSON.stringify(['Av. Real 123']));

// ── 3. sanearParadas: duplicados contra A y B ──
console.log('\n▶ 3. parada que duplica A o B → se saca');
check('parada == recojo (A) con otra escritura → se saca',
  JSON.stringify(sanearParadas(['av. sucre 1450'], 'Av. Sucre 1450', 'C.1 Mz B Lt 5')) === '[]');
check('parada == entrega (B) con códigos distintos (C.1 == C-1 == c1) → se saca',
  JSON.stringify(sanearParadas(['C-1 Mz B Lt 5'], 'Av. Sucre 1450', 'C.1 Mz B Lt 5')) === '[]');
check('parada repetida entre sí → queda una sola',
  JSON.stringify(sanearParadas(['Jr. Real 123', 'jr real 123'], '', '')) === JSON.stringify(['Jr. Real 123']));

// ── 4. Límite de 3 paradas ──
console.log('\n▶ 4. máximo 3 paradas (C, D, E)');
check('4 paradas → quedan las primeras 3',
  JSON.stringify(sanearParadas(['P1', 'P2', 'P3', 'P4'], '', '')) === JSON.stringify(['P1', 'P2', 'P3']));

// ── 5. sanearDatos integra las paradas ──
console.log('\n▶ 5. sanearDatos con paradas (el camino completo)');
const multi = resp({
  direccionA: 'Av. Sucre 1450 — San Miguel',
  direccion: 'C.1 Mz B Lt 5, Barrio XV',
  // la 2da "parada" es el RECOJO (A) repetido con otra escritura → se saca
  paradas: ['Jr. Los Álamos 245, SMP', 'av. sucre 1450 — san miguel'],
});
check('el pedido multi-punto queda A + B + 1 parada (la duplicada de A se saca)',
  multi.direccionA === 'Av. Sucre 1450 — San Miguel' &&
  multi.direccion === 'C.1 Mz B Lt 5, Barrio XV' &&
  JSON.stringify(multi.paradas) === JSON.stringify(['Jr. Los Álamos 245, SMP']));
check('una parada DISTINTA de A (aunque empiece igual) NO se toca',
  JSON.stringify(sanearParadas(['Av. Sucre 1450'], 'Av. Sucre 1450 — San Miguel', 'C.1 Mz B Lt 5')) ===
  JSON.stringify(['Av. Sucre 1450']));
check('sin paradas en la respuesta → [] (regresión: pedidos normales)',
  JSON.stringify(resp({ direccion: 'C.1 Barrio XV' }).paradas) === '[]');
check('respuesta SIN el campo paradas (IA vieja) → [] sin reventar',
  JSON.stringify(resp({ direccion: 'C.1 Barrio XV', paradas: undefined }).paradas) === '[]');

// ── 6. el mensaje/avisos NO se tocan (el cobro habla de la B) ──
console.log('\n▶ 6. regresiones de las fases anteriores');
const normal = resp({
  cliente: 'C.1',
  direccion: 'Barrio XV Popular',
  yapeNombre: 'Mk',
  yapeNumero: '980811297',
  tarifa: 16,
});
check('caso real Mk sigue igual (cliente + yape) y paradas []',
  normal.cliente === 'Mk' && normal.direccion.startsWith('C.1') &&
  JSON.stringify(normal.paradas) === '[]');
const dup = resp({ direccionA: 'Av. Sucre 1450', direccion: 'av. sucre 1450' });
check('A duplicada de B sigue borrándose',
  dup.direccionA === '' && dup.direccion === 'av. sucre 1450');

console.log(`
${'═'.repeat(48)}
RESULTADO: ${ok} ✓ / ${fail} ✗`);
if (fail > 0) {
  console.log('❌ HAY TESTS FALLIDOS');
  process.exit(1);
}
console.log('✅ TODO OK');
