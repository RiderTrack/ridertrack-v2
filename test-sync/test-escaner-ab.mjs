// ═══════════════════════════════════════════════════════════
// 📷 TEST escáner v4 — FASE I (A y B sin confundirse + 📦 observación)
// Corre con: node test-sync/test-escaner-ab.mjs
// Prueba las funciones PURAS del escáner (prompt + saneamiento)
// SIN llamar a la IA — mismo patrón que test-ruta-ab.mjs.
// ═══════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild'); // verifica que existe
const OUT = new URL('./.tmp-escanerAB.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/drivertrack/services/escanerIA.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT,
  logLevel: 'silent',
});
const { __escanerTests } = await import(OUT);
const { sanearDatos, parsearJsonTexto, normalizarDir, PROMPT } = __escanerTests;

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}

/** Fixture mínimo de respuesta de la IA */
function resp(parcial = {}) {
  return sanearDatos({
    cliente: '', direccionA: '', direccion: '', zona: '', referencia: '',
    observacion: '', telefono: '', yapeNombre: '', yapeNumero: '', tarifa: null,
    ...parcial,
  });
}

console.log('📷 TEST escáner v4 — FASE I (A/B sin confusión + observación)\n');

// ── 1. El PROMPT enseña las DOS direcciones y la observación ──
console.log('▶ 1. PROMPT v4 (lo que la IA va a leer)');
check('pide el campo direccionA (recojo)', PROMPT.includes('direccionA:'));
check('pide el campo observacion (qué lleva)', PROMPT.includes('observacion:'));
check('guía por ETIQUETAS ("Recoger en"/"Entregar en"), no por orden',
  PROMPT.includes('Recoger en') && PROMPT.includes('Entregar en'));
check('regla: UNA sola dirección → va en direccion, A queda vacía',
  PROMPT.includes('UNA SOLA dirección'));
check('regla: NUNCA copiar la misma dirección en los dos campos',
  PROMPT.includes('NUNCA copies la misma dirección'));
check('el ejemplo de inDrive con las dos direcciones está incluido',
  PROMPT.includes('EJEMPLO 2') && PROMPT.includes('Av. Sucre 1450'));
check('las claves del JSON incluyen direccionA, paradas y observacion',
  PROMPT.includes('cliente, direccionA, direccion, paradas, zona, referencia, observacion, telefono'));
check('distingue referencia (lugar) de observacion (qué lleva)',
  PROMPT.includes('cómo RECONOCER la casa') && PROMPT.includes('QUÉ lleva o envía'));

// ── 2. Saneamiento A/B: la IA duplicó la misma dirección ──
console.log('\n▶ 2. IA duplicó la MISMA dirección en A y B → la A se borra');
const dup = resp({
  direccionA: 'Av. Sucre 1450',
  direccion: 'av. sucre 1450', // misma dirección, distinta escritura
});
check('la A duplicada se borra (quedan solo la B)', dup.direccionA === '' && dup.direccion === 'av. sucre 1450');
const dup2 = resp({
  direccionA: 'C.1 Mz B Lt 5, Barrio XV',
  direccion: 'C.1 Mz B Lt 5 Barrio XV',
});
check('también con puntuación distinta (coma)', dup2.direccionA === '' && dup2.direccion.includes('Barrio XV'));
const okAB = resp({
  direccionA: 'Av. Sucre 1450',
  direccion: 'C.1 Mz B Lt 5, Barrio XV',
});
check('dos direcciones DISTINTAS se respetan tal cual',
  okAB.direccionA === 'Av. Sucre 1450' && okAB.direccion === 'C.1 Mz B Lt 5, Barrio XV');

// ── 3. Saneamiento A/B: la IA puso la entrega en A y dejó B vacía ──
console.log('\n▶ 3. IA llenó la A pero dejó la B vacía → se muda a la B');
const mudanza = resp({ direccionA: 'C.1 Barrio XV Popular de Intereses Social Proyecto' });
check('la única dirección termina en la B (entrega)',
  mudanza.direccion === 'C.1 Barrio XV Popular de Intereses Social Proyecto' && mudanza.direccionA === '');

// ── 4. Pedido clásico de UNA dirección (regresión F-ID2.6) ──
console.log('\n▶ 4. Pedido clásico de pueblo joven (regresión del caso real)');
const clasico = resp({
  cliente: 'C.1', // la IA volvió a confundir la calle con la persona
  direccion: 'Barrio Barrio XV Popular de Intereses Social Proyecto',
  yapeNombre: 'Mk', yapeNumero: '980811297 (yape)',
  tarifa: null,
});
check('"C.1" en cliente se muda al INICIO de la dirección',
  clasico.direccion === 'C.1 Barrio XV Popular de Intereses Social Proyecto');
check('el cliente se rescata del yape ("Mk")', clasico.cliente === 'Mk');
check('"Barrio Barrio" pegado → "Barrio"', !clasico.direccion.includes('Barrio Barrio'));
check('el número de yape queda en dígitos', clasico.yapeNumero === '980811297');
check('la A sigue vacía (no se inventa un recojo)', clasico.direccionA === '');

// ── 5. Observación ──
console.log('\n▶ 5. 📦 Observación (qué llevás)');
const obs = resp({
  direccionA: 'Av. Sucre 1450', direccion: 'C.1 Mz B Lt 5',
  observacion: 'Llevo una una bolsa con un artefacto', // palabra pegada repetida
});
check('la observación se limpia de palabras repetidas',
  obs.observacion === 'Llevo una bolsa con un artefacto');
check('la observación NO se pisa con la referencia', obs.referencia === '');

// ── 6. Parser robusto (regresión) ──
console.log('\n▶ 6. Parser de la respuesta de la IA');
const jsonLimpio = parsearJsonTexto('{"cliente":"Mk","direccionA":"","direccion":"C.1","observacion":"una bolsa"}');
check('JSON pelado se parsea', jsonLimpio.cliente === 'Mk' && jsonLimpio.observacion === 'una bolsa');
const jsonMarkdown = parsearJsonTexto('Claro, acá está:\n```json\n{"cliente":"Mk","direccion":"C.1"}\n```');
check('JSON envuelto en markdown/texto se rescata', jsonMarkdown.cliente === 'Mk');
let tiroBasura = null;
try { parsearJsonTexto('no hay json acá'); } catch (e) { tiroBasura = e; }
check('basura sin JSON → error (sin-datos)', tiroBasura !== null);

// ── 7. Normalización de direcciones (helper de la guarda) ──
console.log('\n▶ 7. normalizarDir (comparación A/B)');
check('"Av. Sucre 1450" == "av sucre 1450"',
  normalizarDir('Av. Sucre 1450') === normalizarDir('av sucre 1450'));
check('"C.1 Mz B Lt 5, Barrio XV" == "c1 mz b lt 5 barrio xv"',
  normalizarDir('C.1 Mz B Lt 5, Barrio XV') === normalizarDir('c1 mz b lt 5 barrio xv'));
check('"Av. Sucre 1450" != "Av. Sucre 1451" (número distinto)',
  normalizarDir('Av. Sucre 1450') !== normalizarDir('Av. Sucre 1451'));

// ── 8. Simulación completa: la respuesta del EJEMPLO 2 del prompt ──
console.log('\n▶ 8. Simulación end-to-end del saneamiento con la respuesta inDrive');
const respInDrive = parsearJsonTexto(
  '{"cliente":"","direccionA":"Av. Sucre 1450 — San Miguel","direccion":"C.1 Mz B Lt 5, Barrio XV","zona":"","referencia":"","observacion":"Llevo una bolsa con un artefacto pequeño","telefono":"","yapeNombre":"","yapeNumero":"","tarifa":""}',
);
const final = resp({
  cliente: respInDrive.cliente.trim(),
  direccionA: respInDrive.direccionA.trim(),
  direccion: respInDrive.direccion.trim(),
  zona: respInDrive.zona.trim(),
  referencia: respInDrive.referencia.trim(),
  observacion: respInDrive.observacion.trim(),
  telefono: respInDrive.telefono.trim(),
  yapeNombre: respInDrive.yapeNombre.trim(),
  yapeNumero: respInDrive.yapeNumero.trim(),
  tarifa: null,
});
check('recojo en A', final.direccionA === 'Av. Sucre 1450 — San Miguel');
check('entrega en B (con el código de pueblo joven)', final.direccion === 'C.1 Mz B Lt 5, Barrio XV');
check('observación íntegra (qué lleva el cliente)',
  final.observacion === 'Llevo una bolsa con un artefacto pequeño');

console.log(`\n${'═'.repeat(52)}`);
console.log(`RESULTADO: ${ok} ✓ · ${fail} ✗`);
if (fail > 0) { console.log('❌ HAY TESTS FALLIDOS'); process.exit(1); }
console.log('✅ Escáner v4 listo — A y B sin confusión + observación');
