// ═════════════════════════════════════════════════════════════
// 💜🔷 TEST armarMensajeCobro con MÉTODO — FASE R
// Corre con: node test-sync/test-cobro-metodos.mjs
// (puro — sin Firebase, sin React; utils.ts se compila con esbuild
// porque mezcla código de browser que acá no se ejecuta)
// ═════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild');
const OUT = new URL('./.tmp-utilsDT.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/drivertrack/utils.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT,
  logLevel: 'silent',
});
const { armarMensajeCobro, qrDelMetodo } = await import(OUT);

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}

console.log('💜🔷 TEST armarMensajeCobro con método (FASE R)\n');

// La config con las DOS billeteras (el caso de Rudy hoy)
const config = {
  yape: { numero: '987 111 222', titular: 'Rudy', qrBase64: 'data:image/jpeg;base64,AAAA' },
  plin: { numero: '987 333 444', titular: 'Rudy P', qrBase64: 'data:image/jpeg;base64,BBBB' },
};
const datos = { cliente: 'María', monto: 12.5, direccion: 'Av. Prueba 123' };

// ── 1. SOLO YAPE ──────────────────────────────────────────
console.log('1) método "yape" — el mensaje habla ÚNICAMENTE de Yape');
const msgYape = armarMensajeCobro(datos, config, 'yape');
check('saluda a la cliente', msgYape.includes('Hola María!'));
check('el monto va con formato S/', msgYape.includes('*S/ 12.50*'));
check('la dirección va', msgYape.includes('Av. Prueba 123'));
check('menciona el número de Yape', msgYape.includes('987 111 222'));
check('NOMBRE de Plin NO aparece (pedido literal de Rudy)', !msgYape.toLowerCase().includes('plin'));
check('número de Plin NO aparece', !msgYape.includes('987 333 444'));
check('el titular de Yape va', msgYape.includes('(Rudy)'));
check('efectivo como alternativa', msgYape.includes('efectivo'));
check(
  'mensaje literal exacto',
  msgYape === [
    'Hola María! 👋',
    '',
    '🛵 Monto a pagar por tu pedido: *S/ 12.50*',
    '📍 Entrega en: Av. Prueba 123',
    '',
    '💜 Puedes pagarme por Yape:',
    '📱 *987 111 222* (Rudy)',
    '💵 O en efectivo al recibir',
    '',
    '¡Gracias! 💚',
  ].join('\n'),
  '\n    ┌─ recibido:\n' + msgYape.split('\n').map(l => '    │ ' + l).join('\n'),
);

// ── 2. SOLO PLIN ──────────────────────────────────────────
console.log('2) método "plin" — el mensaje habla ÚNICAMENTE de Plin');
const msgPlin = armarMensajeCobro(datos, config, 'plin');
check('menciona el número de Plin', msgPlin.includes('987 333 444'));
check('NOMBRE de Yape NO aparece', !msgPlin.toLowerCase().includes('yape'));
check('número de Yape NO aparece', !msgPlin.includes('987 111 222'));
check('el titular de Plin va', msgPlin.includes('(Rudy P)'));
check('efectivo como alternativa', msgPlin.includes('efectivo'));
check('arranza con el bloque de Plin', msgPlin.includes('🔷 Puedes pagarme por Plin:'));

// ── 3. AMBOS (sin método) — regresión del mensaje de siempre ──
console.log('3) sin método — los DOS en un mensaje (como siempre)');
const msgAmbos = armarMensajeCobro(datos, config);
check('menciona Yape', msgAmbos.includes('987 111 222'));
check('menciona Plin', msgAmbos.includes('987 333 444'));
check('dice "O por Plin"', msgAmbos.includes('O por Plin'));
check('efectivo como alternativa', msgAmbos.includes('efectivo'));
check('undefined explícito = mismo mensaje', armarMensajeCobro(datos, config, undefined) === msgAmbos);

// ── 4. Defensivo: método sin número → cae a lo que haya ────
console.log('4) defensivo — método pedido sin número configurado');
const soloYapeCfg = { yape: config.yape, plin: { numero: '', titular: '', qrBase64: '' } };
const msgFall = armarMensajeCobro(datos, soloYapeCfg, 'plin');
check('plin sin número → cae al mensaje de Yape', msgFall.includes('987 111 222') && !msgFall.toLowerCase().includes('plin'));
const msgYapeOk = armarMensajeCobro(datos, soloYapeCfg, 'yape');
check('yape con número → mensaje de Yape normal', msgYapeOk.includes('987 111 222'));

// ── 5. Casos borde del mensaje ────────────────────────────
console.log('5) casos borde');
const sinMonto = armarMensajeCobro({ cliente: '', monto: 0, direccion: '' }, config, 'yape');
check('monto 0 → "Te escribo por la entrega"', sinMonto.includes('Te escribo por la entrega'));
check('cliente vacío → "estimado cliente"', sinMonto.includes('Hola estimado cliente!'));
check('sin dirección → sin línea de entrega', !sinMonto.includes('Entrega en:'));
const ninguno = armarMensajeCobro(datos, { yape: { numero: '', titular: '', qrBase64: '' }, plin: { numero: '', titular: '', qrBase64: '' } });
check('sin billeteras → solo efectivo', ninguno.includes('Pago en efectivo al recibir'));
const sinTitular = armarMensajeCobro(datos, {
  yape: { numero: '987 111 222', titular: '', qrBase64: '' },
  plin: { numero: '987 333 444', titular: '', qrBase64: '' },
}, 'yape');
check('titular vacío → sin paréntesis colgado', !sinTitular.includes('()') && sinTitular.includes('📱 *987 111 222*'));

// ── 6. qrDelMetodo — el QR correcto con cada método ───────
console.log('6) qrDelMetodo — cada método viaja con SU QR');
check('método yape → el QR de Yape', qrDelMetodo(config, 'yape') === 'data:image/jpeg;base64,AAAA');
check('método plin → el QR de Plin', qrDelMetodo(config, 'plin') === 'data:image/jpeg;base64,BBBB');
check('ambos → prefiere el de Yape', qrDelMetodo(config, undefined) === 'data:image/jpeg;base64,AAAA');
check('yape sin QR → cae al de Plin', qrDelMetodo({ ...config, yape: { ...config.yape, qrBase64: '' } }) === 'data:image/jpeg;base64,BBBB');
check('sin QRs → vacío (viaja texto solo)', qrDelMetodo({ yape: { numero: '', titular: '', qrBase64: '' }, plin: { numero: '', titular: '', qrBase64: '' } }, 'yape') === '');

console.log('');
console.log('════════════════════════════════════════');
if (fail === 0) console.log(`✅ TODOS LOS TESTS PASARON (${ok}/${ok + fail})`);
else {
  console.log(`❌ ${fail} tests fallaron (${ok} pasaron)`);
  process.exit(1);
}
console.log('════════════════════════════════════════');
