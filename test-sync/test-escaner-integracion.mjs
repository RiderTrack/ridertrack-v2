// ═══════════════════════════════════════════════════════════
// 🔬 TEST de integración — escanearDireccion CON IA MOCKEADA
// (el eslabón que el E2E de browser no pudo cubrir por el mock
// de red): fetch stubbeado → llamarIA → parsearJsonTexto →
// sanearDatos → DatosEscaneados.paradas. Prueba el pipeline
// COMPLETO de la FASE M multi-punto sin gastar la key.
// Corre con: node test-sync/test-escaner-integracion.mjs
// ═══════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild');

const OUT = new URL('./.tmp-escanerInt.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/drivertrack/services/escanerIA.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT,
  logLevel: 'silent',
});
const mod = await import(OUT);
const { escanearDireccion } = mod;

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}

// ── el fetch de la IA, stubbeado: devuelve la respuesta de
//    "Gemini" con el pedido MULTI-PUNTO de Rosa ──
const RESPUESTA_IA = {
  candidates: [{
    content: {
      parts: [{
        text: JSON.stringify({
          cliente: 'Rosa',
          direccionA: 'Av. Sucre 1450 — San Miguel',
          direccion: 'C.1 Mz B Lt 5, Barrio XV',
          paradas: ['Jr. Los Álamos 245, SMP'],
          zona: 'SMP',
          referencia: '',
          observacion: 'una bolsa',
          telefono: '987333444',
          yapeNombre: '',
          yapeNumero: '',
          tarifa: '18',
        }),
      }],
    },
  }],
};

const fetchOriginal = globalThis.fetch;
let llamadasIA = 0;
globalThis.fetch = async () => {
  llamadasIA++;
  return {
    ok: true,
    status: 200,
    json: async () => RESPUESTA_IA,
    text: async () => JSON.stringify(RESPUESTA_IA),
  };
};

console.log('🔬 INTEGRACIÓN escanearDireccion — IA mockeada (multi-punto)\n');

// 1. El PNG de 20x20 (el mismo del E2E) viaja como dataURL
const fotoB64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAAAG0lEQVR4nGP4z8BANiJf56jmUc2jmkc1U0UzADHNjoAymaoJAAAAAElFTkSuQmCC';
const datos = await escanearDireccion(fotoB64, 'AIzaMOCK-FASE-M', undefined);

check('la IA fue llamada 1 vez (Gemini con la key AIza…)',
  llamadasIA === 1, `→ llamadas: ${llamadasIA}`);
check('cliente leído: Rosa', datos.cliente === 'Rosa');
check('recojo (A) leído: Av. Sucre 1450 — San Miguel',
  datos.direccionA === 'Av. Sucre 1450 — San Miguel');
check('entrega (B) leída: C.1 Mz B Lt 5, Barrio XV',
  datos.direccion === 'C.1 Mz B Lt 5, Barrio XV');
check('PARADA leída y saneada: ["Jr. Los Álamos 245, SMP"]',
  JSON.stringify(datos.paradas) === JSON.stringify(['Jr. Los Álamos 245, SMP']),
  `→ ${JSON.stringify(datos.paradas)}`);
check('teléfono leído: 987333444', datos.telefono === '987333444');
check('tarifa parseada a número: 18', datos.tarifa === 18);

// 2. La IA "vieja" que NO manda paradas → [] sin reventar (regresión)
const RESPUESTA_VIEJA = {
  candidates: [{
    content: { parts: [{ text: JSON.stringify({
      cliente: 'Mk', direccionA: '', direccion: 'C.1 Barrio XV',
      zona: '', referencia: '', observacion: '', telefono: '',
      yapeNombre: 'Mk', yapeNumero: '980811297', tarifa: '16',
    }) }] },
  }],
};
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => RESPUESTA_VIEJA, text: async () => JSON.stringify(RESPUESTA_VIEJA) });
const datosViejos = await escanearDireccion(fotoB64, 'AIzaMOCK-FASE-M', undefined);
check('IA sin paradas (versión vieja) → [] y el resto igual',
  JSON.stringify(datosViejos.paradas) === '[]' && datosViejos.cliente === 'Mk');

// 3. La IA manda paradas como STRING (no array) → se rescata
const RESPUESTA_STRING = {
  candidates: [{
    content: { parts: [{ text: JSON.stringify({
      cliente: 'Ana', direccionA: '', direccion: 'Av. Real 500',
      paradas: 'Jr. Falsa 123', zona: '', referencia: '', observacion: '',
      telefono: '', yapeNombre: '', yapeNumero: '', tarifa: '',
    }) }] },
  }],
};
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => RESPUESTA_STRING, text: async () => JSON.stringify(RESPUESTA_STRING) });
const datosString = await escanearDireccion(fotoB64, 'AIzaMOCK-FASE-M', undefined);
check('IA que mandó la parada como STRING → se convierte en array de 1',
  JSON.stringify(datosString.paradas) === JSON.stringify(['Jr. Falsa 123']),
  `→ ${JSON.stringify(datosString.paradas)}`);

globalThis.fetch = fetchOriginal;

console.log(`
${'═'.repeat(48)}
RESULTADO: ${ok} ✓ / ${fail} ✗`);
if (fail > 0) { console.log('❌ HAY TESTS FALLIDOS'); process.exit(1); }
console.log('✅ TODO OK — el pipeline IA → form con paradas anda');
