// ═══════════════════════════════════════════════════════════
// 🛣️ TEST rutaAB — FASE F (km A→B calculados solos)
// Corre con: node test-sync/test-ruta-ab.mjs
// (puro — Google y localStorage inyectados por los hooks de test.
// Se compila con esbuild porque rutaAB importa googleDirections
// sin extensión, estilo TS — mismo patrón que test-sync-dt.mjs)
// ═══════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild'); // verifica que existe
const OUT = new URL('./.tmp-rutaAB.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/drivertrack/services/rutaAB.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT,
  logLevel: 'silent',
});
const { calcularRutaAB, claveAB, estimarRectaAB, __rutaABTests } = await import(OUT);

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}

// ── Fakes inyectables ──────────────────────────────────────
// Storage en memoria (el servicio lo usa para el caché)
function crearStorage() {
  const datos = new Map();
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, v),
    _datos: datos,
  };
}

// Google fake: contador de llamadas + respuesta programable
let llamadasGoogle = 0;
let respuestaGoogle = null; // { distanciaKm, tiempoMin, puntos, pasos } | null
async function googleFake() {
  llamadasGoogle++;
  if (respuestaGoogle === null) return null;
  if (respuestaGoogle instanceof Error) throw respuestaGoogle;
  return respuestaGoogle;
}

const storage = crearStorage();
__rutaABTests.setStorage(storage);
__rutaABTests.setObtenerInstrucciones(googleFake);

// Pines reales de Lima: Campo de Marte → Plaza Mayor ≈ 5.3 km recta… no:
// usamos puntos con distancia conocida por haversine calculada en el test
const A = { lat: -12.046374, lng: -77.042793 }; // Lima centro
const B = { lat: -12.121945, lng: -77.029726 }; // Miraflores (malecón)

console.log('🛣️ TEST rutaAB (FASE F)\n');

// ── 1. Clave del caché ─────────────────────────────────────
console.log('1) claveAB');
check('formato lat,lng>lat,lng', claveAB(A, B) === '-12.04637,-77.04279>-12.12195,-77.02973');
check('redondea a 5 decimales', claveAB({ lat: -12.0463744999, lng: -77.042793 }, B) === claveAB(A, B));
check('A→B distinto de B→A', claveAB(A, B) !== claveAB(B, A));

// ── 2. Estimado de emergencia (recta × 1.35) ───────────────
console.log('2) estimarRectaAB (respaldo sin internet)');
const est = estimarRectaAB(A, B);
// haversine Lima centro → Miraflores ≈ 8.4 km recta → ×1.35 ≈ 11.3
check('km > recta (factor de calles)', est.km > 8 && est.km < 15, `km=${est.km}`);
check('fuente estimado', est.fuente === 'estimado');
check('sin geometría (recta)', est.puntos === null);
check('minutos a ritmo de moto (22 km/h)', est.min === Math.max(1, Math.round((est.km / 22) * 60)), `min=${est.min}`);
const estCorto = estimarRectaAB({ lat: -12.046, lng: -77.0428 }, { lat: -12.048, lng: -77.045 });
check('recorridos cortos mínimo 1 min', estCorto.min >= 1 && estCorto.km > 0);

// ── 3. Entradas inválidas ──────────────────────────────────
console.log('3) entradas inválidas');
check('sin A → null', (await calcularRutaAB(null, B)) === null);
check('sin B → null', (await calcularRutaAB(A, null)) === null);
check('A y B iguales → null', (await calcularRutaAB(A, { ...A })) === null);
check('NaN → null', (await calcularRutaAB({ lat: NaN, lng: -77 }, B)) === null);

// ── 4. Google contesta → km reales + geometría ─────────────
console.log('4) Google Directions contesta');
respuestaGoogle = {
  distanciaKm: 10.2,
  tiempoMin: 27,
  puntos: Array.from({ length: 50 }, (_, i) => ({ lat: A.lat + (i / 49) * (B.lat - A.lat), lng: A.lng })),
  pasos: [],
};
llamadasGoogle = 0;
const r1 = await calcularRutaAB(A, B);
check('km de Google', r1.km === 10.2 && r1.min === 27, JSON.stringify(r1));
check('fuente google', r1.fuente === 'google');
check('geometría para la línea del mapa', Array.isArray(r1.puntos) && r1.puntos.length === 50);

// ── 5. Caché: la misma pareja no se vuelve a pedir ─────────
console.log('5) caché (una sola llamada por pareja)');
const r2 = await calcularRutaAB(A, B);
check('mismo resultado desde el caché', r2.km === 10.2 && r2.fuente === 'google');
check('Google llamado UNA sola vez', llamadasGoogle === 1, `llamadas=${llamadasGoogle}`);
// pines con decimales extra → misma clave → caché igual
const r2b = await calcularRutaAB({ lat: A.lat + 0.0000001, lng: A.lng }, B);
check('redondeo de pines reusa el caché', llamadasGoogle === 1);

// ── 6. Google falla → respaldo de la recta ─────────────────
console.log('6) Google falla (sin internet) → recta ×1.35');
const C = { lat: -12.055, lng: -77.038 }; // San Isidro
respuestaGoogle = null;
const r3 = await calcularRutaAB(C, B);
check('cae a estimado', r3.fuente === 'estimado' && r3.km > 0);
check('sin geometría', r3.puntos === null);

// ── 7. El estimado se REINTENTA a los 30 min (TTL corto) ──
console.log('7) TTL: estimado 30 min / google 30 días');
// envejecer la entrada de C→B más de 30 min
const cacheBruto = JSON.parse(storage._datos.get('dt_ruta_ab_v1'));
const claveCB = claveAB(C, B);
cacheBruto[claveCB].ts = Date.now() - 31 * 60 * 1000;
storage._datos.set('dt_ruta_ab_v1', JSON.stringify(cacheBruto));
respuestaGoogle = { distanciaKm: 4.4, tiempoMin: 13, puntos: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], pasos: [] };
const r4 = await calcularRutaAB(C, B);
check('reintentó Google y refinó', r4.fuente === 'google' && r4.km === 4.4);
// la entrada de Google NO se re-pide aunque pasen 5 días
const cache2 = JSON.parse(storage._datos.get('dt_ruta_ab_v1'));
cache2[claveAB(A, B)].ts = Date.now() - 5 * 24 * 60 * 60 * 1000;
cache2[claveCB].ts = Date.now() - 5 * 24 * 60 * 60 * 1000;
storage._datos.set('dt_ruta_ab_v1', JSON.stringify(cache2));
llamadasGoogle = 0;
const r5 = await calcularRutaAB(A, B);
const r5b = await calcularRutaAB(C, B);
check('google en caché 5 días sigue vivo', r5.km === 10.2 && r5b.km === 4.4 && llamadasGoogle === 0);

// ── 8. Pedidos en simultáneo → UNA sola llamada ────────────
console.log('8) dedupe de pedidos concurrentes');
const D = { lat: -12.07, lng: -77.05 };
llamadasGoogle = 0;
respuestaGoogle = { distanciaKm: 7.7, tiempoMin: 21, puntos: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], pasos: [] };
const [p1, p2] = await Promise.all([calcularRutaAB(D, B), calcularRutaAB(D, B)]);
check('mismo resultado ambas promesas', p1.km === 7.7 && p2.km === 7.7);
check('una sola llamada a Google', llamadasGoogle === 1, `llamadas=${llamadasGoogle}`);

// ── 9. Google lanza excepción → nunca rompe, cae a la recta ─
console.log('9) excepción de Google → recta sin romper');
const E = { lat: -12.09, lng: -77.06 };
respuestaGoogle = new Error('boom de red');
const r6 = await calcularRutaAB(E, B);
check('respuesta estimada igual', r6.fuente === 'estimado' && r6.km > 0 && r6.min >= 1);

// ── 10. Campos nuevos del viaje viajan por JSON (sync) ─────
console.log('10) viaje con los campos nuevos sobrevive un JSON (sync)');
const viaje = {
  id: '123', kmEstimado: 10.2, minEstimados: 27, entregado: true, entregadoHora: '14:32',
};
const idaYVuelta = JSON.parse(JSON.stringify(viaje));
check('km/min/entregado/hora intactos',
  idaYVuelta.kmEstimado === 10.2 && idaYVuelta.minEstimados === 27 &&
  idaYVuelta.entregado === true && idaYVuelta.entregadoHora === '14:32');

__rutaABTests.restaurar();

console.log('\n════════════════════════════════════════════');
console.log(`RESULTADO: ${ok} ✓ / ${fail} ✗`);
if (fail > 0) { console.log('❌ HAY FALLOS'); process.exit(1); }
console.log('✅ TODO OK');
