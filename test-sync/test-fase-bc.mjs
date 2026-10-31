// ═══════════════════════════════════════════════════════════════
// 💜🔷📦 TEST FASE BC — v0.11.29
// 1) Mensajes del QR por BILLETERA (Yape/Plin): editables, guardables
//    para siempre y con librería — en el flujo que de verdad viaja.
// 2) CAJA: cuadre al jefe detallado (pedidos de 9 / de 12 / fallidos).
// Corre con: node test-sync/test-fase-bc.mjs
// (puro — sin Firebase, sin React; utils.ts se compila con esbuild)
// ═══════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild');

// ── compila utils.ts (mensajeCobroFinal + armarMensajeCobro) ──
const OUT_UTILS = new URL('./.tmp-bc-utils.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/drivertrack/utils.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT_UTILS,
  logLevel: 'silent',
});
const { mensajeCobroFinal, armarMensajeCobro } = await import(OUT_UTILS);

// ── mensajesQr.ts y cajaCore.ts son 100% autocontenidos → import directo ──
import {
  PLANTILLA_QR_DEF,
  PRESETS_QR,
  resolverMensajeQr,
  sanearLibreriaQr,
  idMensajeQr,
} from '../src/drivertrack/mensajesQr.ts';
import {
  aplicarPlantillaCuadre,
  PLANTILLA_CUADRE_DEFECTO,
  resumenCajaDia,
  VARIABLES_CUADRE,
} from '../src/utils/cajaCore.ts';

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}
const leer = p => readFileSync(new URL(p, import.meta.url), 'utf8');

const configBase = {
  yape: { numero: '987 654 321', titular: 'Rudy', qrBase64: '' },
  plin: { numero: '912 345 678', titular: 'Rudy Plin', qrBase64: '' },
};
const datosCarlos = { cliente: 'Carlos', monto: 16, direccion: 'Av. Prueba 123' };

console.log('💜🔷📦 TEST FASE BC — v0.11.29\n');

// ═══════════════════════════════════════════════════════════════
console.log('1) 💜 mensajesQr — plantillas de fábrica = el automático de siempre');
{
  check('hay plantilla de fábrica para Yape y para Plin', !!PLANTILLA_QR_DEF.yape && !!PLANTILLA_QR_DEF.plin);
  check('la de fábrica Yape dice EXACTAMENTE lo mismo que el automático (solo Yape)',
    resolverMensajeQr(PLANTILLA_QR_DEF.yape, {
      cliente: 'Carlos', monto: 16, direccion: 'Av. Prueba 123',
      numero: configBase.yape.numero, titular: configBase.yape.titular,
    }) === armarMensajeCobro(datosCarlos, configBase, 'yape'),
    JSON.stringify(resolverMensajeQr(PLANTILLA_QR_DEF.yape, {
      cliente: 'Carlos', monto: 16, direccion: 'Av. Prueba 123',
      numero: configBase.yape.numero, titular: configBase.yape.titular,
    })));
  check('la de fábrica Plin dice EXACTAMENTE lo mismo que el automático (solo Plin)',
    resolverMensajeQr(PLANTILLA_QR_DEF.plin, {
      cliente: 'Carlos', monto: 16, direccion: 'Av. Prueba 123',
      numero: configBase.plin.numero, titular: configBase.plin.titular,
    }) === armarMensajeCobro(datosCarlos, configBase, 'plin'));
  check('cada billetera tiene sus presets (De siempre + Corto)',
    PRESETS_QR.yape.length === 2 && PRESETS_QR.plin.length === 2);
  check('los presets de Yape hablan de Yape y los de Plin de Plin',
    PRESETS_QR.yape[0].texto.includes('Yape') && PRESETS_QR.plin[0].texto.includes('Plin'));
  check('ids únicos en todos los presets',
    new Set([...PRESETS_QR.yape, ...PRESETS_QR.plin].map(p => p.id)).size === 4);
}

// ═══════════════════════════════════════════════════════════════
console.log('\n2) 💜 resolverMensajeQr — las etiquetas se cambian solas');
{
  const r = resolverMensajeQr(
    'Hola {cliente}! Son *S/ {monto}* — mi Yape: {numero}{titular}\n{direccion}\n¡Gracias!',
    { cliente: 'María', monto: 12.5, direccion: 'Calle Falsa 123', numero: '987-654-321', titular: 'Rudy' },
  );
  check('todas las etiquetas reemplazadas (el número tal cual lo configuraste)',
    r === 'Hola María! Son *S/ 12.50* — mi Yape: 987-654-321 (Rudy)\n📍 Entrega en: Calle Falsa 123\n¡Gracias!', r);
  check('sin dirección → la fábrica queda IGUAL que el automático sin dirección (línea colapsada)',
    resolverMensajeQr(PLANTILLA_QR_DEF.yape, {
      cliente: 'Carlos', monto: 16, direccion: '',
      numero: configBase.yape.numero, titular: configBase.yape.titular,
    }) === armarMensajeCobro({ cliente: 'Carlos', monto: 16, direccion: '' }, configBase, 'yape'));
  check('sin titular → no quedan paréntesis vacíos',
    !resolverMensajeQr('x {numero}{titular} y', { numero: '111', titular: '' }).includes('()'));
  check('cliente vacío → "estimado cliente" (como el automático)',
    resolverMensajeQr('Hola {cliente}', {}).includes('estimado cliente'));
  check('monto con número-string ("16") también formatea',
    resolverMensajeQr('S/ {monto}', { monto: '16' }) === 'S/ 16.00');
  check('etiquetas desconocidas quedan literales', resolverMensajeQr('hola {mundo}', {}) === 'hola {mundo}');

  const saneada = sanearLibreriaQr([
    { id: 'a', nombre: 'Corto', texto: 'texto a' },
    { id: 'a', nombre: 'DUP', texto: 'duplicado' },
    null, 'basura', 42,
    { id: 'b', nombre: 'Sin texto', texto: '   ' },
    { id: 'c', nombre: 'Con algo', texto: 'texto c' },
    ...Array.from({ length: 40 }, (_, i) => ({ id: 'z' + i, nombre: 'z' + i, texto: 't' })),
  ]);
  check('sanearLibreriaQr: dedupe + basura fuera + tope 30', saneada.length === 30 && saneada[0].id === 'a' && saneada[1].id === 'c');
  check('sanearLibreriaQr con cualquier cosa → [] sin reventar',
    sanearLibreriaQr(undefined).length === 0 && sanearLibreriaQr('x').length === 0 && sanearLibreriaQr({}).length === 0);
  check('idMensajeQr genera ids únicos', idMensajeQr() !== idMensajeQr());
}

// ═══════════════════════════════════════════════════════════════
console.log('\n3) 🛡️ mensajeCobroFinal — la cadena que hace que TU mensaje LLEGUE');
{
  const conPlantillas = {
    ...configBase,
    mensajeQrYape: 'Hola {cliente}! Mi Yape fijo: {numero} — {monto}',
    mensajeQrPlin: 'Plin {numero}: {monto} para {cliente}',
  };

  // 1. la edición del momento gana
  const editado = mensajeCobroFinal({ ...datosCarlos, mensajeEditado: 'Texto retocado al vuelo' }, conPlantillas, 'yape');
  check('1º tu edición del momento viaja TAL CUAL', editado === 'Texto retocado al vuelo', editado);

  // 2. TU plantilla de la billetera (con etiquetas resueltas)
  const yape = mensajeCobroFinal(datosCarlos, conPlantillas, 'yape');
  check('2º TU plantilla de Yape viaja RESUELTA', yape === 'Hola Carlos! Mi Yape fijo: 987 654 321 — 16.00', yape);
  const plin = mensajeCobroFinal(datosCarlos, conPlantillas, 'plin');
  check('2º TU plantilla de PLIN viaja resuelta con el número de PLIN', plin === 'Plin 912 345 678: 16.00 para Carlos', plin);

  // 3. sin plantilla → el automático de siempre
  const auto = mensajeCobroFinal(datosCarlos, configBase, 'yape');
  check('3º sin plantilla guardada → el automático de siempre', auto === armarMensajeCobro(datosCarlos, configBase, 'yape'));
  const autoPlin = mensajeCobroFinal(datosCarlos, configBase, 'plin');
  check('3º ídem Plin', autoPlin === armarMensajeCobro(datosCarlos, configBase, 'plin'));

  // "ambos" no tiene plantilla (solo yape/plin) → automático
  const ambos = mensajeCobroFinal(datosCarlos, conPlantillas, undefined);
  check('"Ambos" sigue siendo el automático de siempre (sin plantilla)', ambos === armarMensajeCobro(datosCarlos, conPlantillas, undefined));

  // plantilla VACÍA (borraste con ↩️) → automático
  const borrada = mensajeCobroFinal(datosCarlos, { ...configBase, mensajeQrYape: '   ' }, 'yape');
  check('plantilla vacía (↩️ Automático) → vuelve al de siempre', borrada === armarMensajeCobro(datosCarlos, configBase, 'yape'));

  // edición VACÍA → cae a la plantilla/automático (no manda texto en blanco)
  const vacia = mensajeCobroFinal({ ...datosCarlos, mensajeEditado: '   ' }, conPlantillas, 'yape');
  check('edición en blanco → cae a TU plantilla (no manda vacío)', vacia === yape);
}

// ═══════════════════════════════════════════════════════════════
console.log('\n4) 📦 cajaCore — fallidos en el resumen y el cierre');
{
  const clientes = [
    { st: 'efectivo', cobrar: 20 },        // entregado
    { st: 'yape-rudy', cobrar: 15 },       // entregado
    { st: 'fallida' },                     // ❌
    { st: 'rechazado' },                   // ❌
    { st: 'reprogramar' },                 // ❌ (cuenta como fallido, como el header)
    { st: 'ausente' },                     // ❌
    { st: 'cancelado' },                   // ❌
    { st: 'no-contesta' },                 // ❌
    { st: 'pendiente' },                   // ni entregado ni fallido
    {},                                   // sin st → pendiente
  ];
  const r = resumenCajaDia(clientes, [], 0);
  check('los 6 estados fallidos cuentan (fallida, rechazado, reprogramar, ausente, cancelado, no-contesta)', r.fallidos === 6, String(r.fallidos));
  check('los entregados siguen contando igual', r.entregas === 2);
  check('los pendientes NO cuentan como fallidos', resumenCajaDia([{ st: 'pendiente' }, {}], [], 0).fallidos === 0);
  check('día limpio → 0 fallidos', resumenCajaDia([{ st: 'efectivo', cobrar: 10 }], [], 0).fallidos === 0);

  // el cierre congela los fallidos (contrato de fuente del services)
  const srv = leer('../src/services/caja.ts');
  check('cerrarCaja congela los fallidos en el cierre', srv.includes('fallidos: r.fallidos || 0'));
}

// ═══════════════════════════════════════════════════════════════
console.log('\n5) 📦 cajaCore — el cuadre detallado (pedidos de 9 / de 12 / fallidos)');
{
  const cierre = {
    fecha: '2026-10-31', at: Date.now(), fondoInicial: 0,
    entregas: 10, efectivoCobrado: 300, digitalRider: 100, empresa: 0,
    gastosEfectivo: 0, gastosDigital: 0, esperado: 300, contado: 300,
    diferencia: 0, netoDelDia: 400, gastos: [],
    fallidos: 2,
    pagoRuta: { activo: true, cantidadNormal: 8, cantidadLejos: 2, tarifaNormal: 9, tarifaLejos: 12, total: 96 },
  };
  const msg = aplicarPlantillaCuadre(PLANTILLA_CUADRE_DEFECTO, cierre, 'Rudy');
  console.log('--- mensaje al jefe ---');
  console.log(msg);
  console.log('-----------------------');
  check('la línea del detalle dice los de 9 y los de 12',
    msg.includes('📦 Pedidos: 8 de S/ 9 + 2 de S/ 12 (lejos) · 10 entregados · ❌ fallidos: 2'),
    msg.split('\n').find(l => l.includes('📦')));
  check('la plantilla default INCLUYE {detallePedidos} (justo después del cobrado)',
    /Cobrado del día: \{cobrado\}\*\n\{detallePedidos\}/.test(PLANTILLA_CUADRE_DEFECTO));
  check('VARIABLES_CUADRE tiene las 4 variables nuevas',
    ['detallePedidos', 'pedidos9', 'pedidos12', 'fallidos'].every(v => VARIABLES_CUADRE.some(x => x.clave === v)));

  // variables sueltas para armar la plantilla a mano
  const custom = aplicarPlantillaCuadre(
    'Pedidos de 9: {pedidos9} · de 12: {pedidos12} · fallidos: {fallidos}',
    cierre,
  );
  check('variables sueltas: {pedidos9} {pedidos12} {fallidos}',
    custom === 'Pedidos de 9: 8 · de 12: 2 · fallidos: 2', custom);

  // sin temporada (pagoRuta) → la línea solo dice entregados + fallidos
  const sinTemporada = aplicarPlantillaCuadre(
    '{detallePedidos}',
    { ...cierre, pagoRuta: undefined },
  );
  check('sin temporada → solo entregados y fallidos (no inventa 9/12)',
    sinTemporada === '📦 Pedidos: 10 entregados · ❌ fallidos: 2', sinTemporada);

  // día sin pedidos → la línea desaparece
  const vacio = aplicarPlantillaCuadre('{detallePedidos}', { ...cierre, entregas: 0, fallidos: 0, pagoRuta: undefined });
  check('día sin pedidos ni fallidos → la línea se colapsa', vacio === '');

  // cierres VIEJOS (sin el campo fallidos) → 0, sin romper
  const viejo = aplicarPlantillaCuadre('{fallidos}', { ...cierre, fallidos: undefined });
  check('cierres viejos sin fallidos → 0 (no rompe)', viejo === '0', viejo);

  // tarifas distintas a 9/12 → la línea dice LAS REALES
  const otrasTarifas = aplicarPlantillaCuadre(
    '{detallePedidos}',
    { ...cierre, pagoRuta: { activo: true, cantidadNormal: 3, cantidadLejos: 1, tarifaNormal: 10, tarifaLejos: 15, total: 45 } },
  );
  check('con otras tarifas → dice las reales (10/15), no 9/12 hardcodeado',
    otrasTarifas === '📦 Pedidos: 3 de S/ 10 + 1 de S/ 15 (lejos) · 10 entregados · ❌ fallidos: 2', otrasTarifas);
}

// ═══════════════════════════════════════════════════════════════
console.log('\n6) 🛡️ storage — la config nueva se sanea y viaja');
{
  const st = leer('../src/drivertrack/storage.ts');
  check('normalizarConfig sanea la librería (sanearLibreriaQr)', st.includes('sanearLibreriaQr'));
  check('normalizarConfig recorta los mensajes por billetera', st.includes("String(mqYapeCrudo ?? '')"));
  const sync = leer('../src/drivertrack/services/syncDT.ts');
  check('el sync de la config fusiona objetos anidados (la librería viaja al cel 2)', sync.includes('mergeConfigRemota'));
}

console.log(`\n════════════════════════════════════════════`);
console.log(fail === 0 ? `✅ FASE BC: ${ok}/${ok + fail}` : `❌ FASE BC: ${fail} fallaron (de ${ok + fail})`);
process.exit(fail === 0 ? 0 : 1);
