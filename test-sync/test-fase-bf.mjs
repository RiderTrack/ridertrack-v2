// ═══════════════════════════════════════════════════════════
// 💰 TEST FASE BF — v0.11.32: EL RECHAZADO EN PUERTA PAGA EL MEDIO
// Corre con: node test-sync/test-fase-bf.mjs
// (puro — sin Firebase, sin React, igual que cajaCore)
// Regla: st 'rechazado' (Rechazado en Puerta) paga la MITAD de su
// tarifa (S/4.50 normal, S/6.00 lejos). Los demás fallidos siguen
// en cero. El medio entra en el total, el cuadre y el MATE.
// ═══════════════════════════════════════════════════════════
import {
  PAGO_PEDIDOS_DEFAULT,
  calcularPagoPedidos,
  calcularLiquidacion,
} from '../src/utils/pagoPedidosCore.ts';
import {
  armarMensajeCuadreJefe,
  aplicarPlantillaCuadre,
  calcularCuadreEntrega,
  VARIABLES_CUADRE,
} from '../src/utils/cajaCore.ts';

// resumenCore importa './cajaCore' sin extensión (estilo TS) →
// se compila con esbuild al vuelo (mismo patrón que test-pago-pedidos)
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild');
const OUT = new URL('./.tmp-resumenCore-bf.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/utils/resumenCore.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT,
  logLevel: 'silent',
});
const { armarResumenDia, armarMensajeResumen } = await import(OUT);

import { readFileSync } from 'node:fs';
const leer = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}

console.log('💰 TEST FASE BF — el rechazado en puerta paga el MEDIO (v0.11.32)\n');

const cfg = { ...PAGO_PEDIDOS_DEFAULT, activo: true, tarifaNormal: 9, tarifaLejos: 12, distritosLejos: ['Chorrillos'] };

// ── 1. El MEDIO en el core ────────────────────────────────
console.log('1) calcularPagoPedidos: el medio del rechazado');
const r1 = calcularPagoPedidos([{ st: 'rechazado', dist: 'Surco' }], cfg);
check('pedido de 9 rechazado → S/4.50 (el ejemplo literal de Rudy)', r1.total === 4.5 && r1.montoRechazados === 4.5, `→ ${JSON.stringify(r1)}`);
check('cantidadRechazados = 1', r1.cantidadRechazados === 1);
check('el rechazado NO cuenta como entregado', r1.entregados === 0 && r1.cantidadNormal === 0 && r1.cantidadLejos === 0);
check('rechazado LEJOS por distrito → S/6.00', calcularPagoPedidos([{ st: 'rechazado', dist: 'Chorrillos' }], cfg).total === 6);
check('rechazado LEJOS por marca manual → S/6.00', calcularPagoPedidos([{ st: 'rechazado', dist: 'Surco', lejos: true }], cfg).total === 6);
check('marca manual false pisa la lista → medio del normal', calcularPagoPedidos([{ st: 'rechazado', dist: 'Chorrillos', lejos: false }], cfg).total === 4.5);
check('st en mayúsculas no matchea (los st del app son minúsculas)', calcularPagoPedidos([{ st: 'Rechazado' }], cfg).total === 0);

// ── 2. Día mixto (los números del E2E) ─────────────────────
console.log('2) día mixto: 2 normales + 1 lejos + 2 rechazados + 2 que no pagan');
const mix = [
  { id: 1, st: 'efectivo', dist: 'Surco', cobrar: 50 },
  { id: 2, st: 'efectivo', dist: 'Surco', cobrar: 50 },
  { id: 3, st: 'yape-rudy', dist: 'Chorrillos', cobrar: 50 },
  { id: 4, st: 'rechazado', dist: 'Surco', cobrar: 50 },
  { id: 5, st: 'rechazado', dist: 'Chorrillos', lejos: true, cobrar: 50 },
  { id: 6, st: 'ausente', dist: 'Surco', cobrar: 50 },
  { id: 7, st: 'pendiente', dist: 'Surco', cobrar: 50 },
];
const r2 = calcularPagoPedidos(mix, cfg);
check('total = 40.50 (18 + 12 + 10.50 de medios)', r2.total === 40.5, `→ ${JSON.stringify(r2)}`);
check('montoNormal 18 / montoLejos 12 / montoRechazados 10.50', r2.montoNormal === 18 && r2.montoLejos === 12 && r2.montoRechazados === 10.5);
check('entregados 3 · rechazados 2 · normales 2 · lejanos 1', r2.entregados === 3 && r2.cantidadRechazados === 2 && r2.cantidadNormal === 2 && r2.cantidadLejos === 1);
const l2 = calcularLiquidacion(100, r2);
check('liquidación: 100 efectivo − 40.50 → entregás 59.50', l2.aEntregar === 59.5 && l2.empresaTeDebe === 0, `→ ${JSON.stringify(l2)}`);
const l2b = calcularLiquidacion(20, r2);
check('liquidación corta: 20 − 40.50 → empresa te debe 20.50', l2b.empresaTeDebe === 20.5 && l2b.aEntregar === 0);

// ── 3. Los demás fallidos siguen en cero (regresión) ──────
console.log('3) los demás fallidos siguen SIN pagar');
const otros = ['fallida', 'ausente', 'no-contesta', 'cancelado', 'reprogramar']
  .map((st, i) => ({ id: i, st, dist: 'Surco' }));
const r3 = calcularPagoPedidos(otros, cfg);
check('fallida/ausente/no-contesta/cancelado/reprogramar → total 0', r3.total === 0 && r3.cantidadRechazados === 0, `→ ${JSON.stringify(r3)}`);
check('rechazado con temporada OFF → 0 (el medio solo existe en temporada)', calcularPagoPedidos([{ st: 'rechazado', dist: 'Surco' }], PAGO_PEDIDOS_DEFAULT).total === 0);

// ── 4. Tarifas custom y redondeo ──────────────────────────
console.log('4) tarifas custom + redondeo del medio');
const cfg10 = { ...cfg, tarifaNormal: 10, tarifaLejos: 15 };
check('tarifa 10 → medio 5', calcularPagoPedidos([{ st: 'rechazado', dist: 'Surco' }], cfg10).total === 5);
check('tarifa lejos 15 → medio 7.50', calcularPagoPedidos([{ st: 'rechazado', dist: 'Chorrillos' }], cfg10).total === 7.5);
const cfg95 = { ...cfg, tarifaNormal: 9.5, tarifaLejos: 12 };
check('tarifa 9.50 → medio 4.75 (redondeo a 2 decimales)', calcularPagoPedidos([{ st: 'rechazado', dist: 'Surco' }], cfg95).total === 4.75);
check('tarifa inválida (−5) cae al default 9 → medio 4.50', calcularPagoPedidos([{ st: 'rechazado', dist: 'Surco' }], { ...cfg, tarifaNormal: -5 }).total === 4.5);
check('3 rechazados de 9 → 13.50 exactos', calcularPagoPedidos([
  { st: 'rechazado', dist: 'Surco' }, { st: 'rechazado', dist: 'Surco' }, { st: 'rechazado', dist: 'Surco' },
], cfg).montoRechazados === 13.5);

// ── 5. Cuadre FASE Q/S: el medio entra en loTuyo ──────────
console.log('5) calcularCuadreEntrega con el medio (los números del E2E)');
const snap = { activo: true, cantidadNormal: 2, cantidadLejos: 1, cantidadRechazados: 2, montoRechazados: 10.5, tarifaNormal: 9, tarifaLejos: 12, total: 40.5 };
const q5 = calcularCuadreEntrega({ contado: 150, fondoInicial: 50, netoDelDia: 150, pagoRuta: snap });
check('loTuyo 40.50 (con medios adentro)', q5.loTuyo === 40.5, `→ ${JSON.stringify(q5)}`);
check('efectivo 100 (150 − fondo 50, paga salió toda del Yape)', q5.efectivo === 100 && q5.pagaDelEfectivo === 0);
check('yape 9.50 (150 − 40.50 − 100) — el medio te lo descontás antes', Math.abs(q5.yape - 9.5) < 0.005);
check('el jefe recibe 109.50', Math.abs(q5.total - 109.5) < 0.005 && q5.teDebe === 0);
check('pagoRuta número ≡ objeto (preview vs cierre)', (() => {
  const qn = calcularCuadreEntrega({ contado: 150, fondoInicial: 50, netoDelDia: 150, pagoRuta: 40.5 });
  return qn.efectivo === q5.efectivo && qn.yape === q5.yape && qn.loTuyo === q5.loTuyo;
})());
check('snapshot VIEJO sin cantidadRechazados → sigue igual (regresión)', (() => {
  const qv = calcularCuadreEntrega({ contado: 300, fondoInicial: 0, netoDelDia: 1182.37, pagoRuta: { activo: true, cantidadNormal: 8, cantidadLejos: 2, tarifaNormal: 9, tarifaLejos: 12, total: 96 } });
  return qv.loTuyo === 96 && qv.efectivo === 300 && Math.abs(qv.yape - 786.37) < 0.005;
})());

// ── 6. Mensaje al jefe con el MEDIO ───────────────────────
console.log('6) armarMensajeCuadreJefe: el detalle con el medio');
const cierreBF = {
  fecha: '2026-11-13', at: Date.now(), fondoInicial: 50, entregas: 3,
  efectivoCobrado: 100, digitalRider: 50, empresa: 0,
  gastosEfectivo: 0, gastosDigital: 0, esperado: 150,
  contado: 150, diferencia: 0, netoDelDia: 150, gastos: [], fallidos: 2,
  pagoRuta: snap,
};
const msgBF = armarMensajeCuadreJefe(cierreBF, 'Rudy');
check('detalle: 2 de S/ 9 + 1 de S/ 12 (lejos) + 2 rechazados al medio (S/ 10.50)',
  msgBF.includes('📦 Pedidos: 2 de S/ 9 + 1 de S/ 12 (lejos) + 2 rechazados al medio (S/ 10.50) · 3 entregados · ❌ fallidos: 2'),
  msgBF.split('\n').find((l) => l.includes('📦')));
check('la paga dice (5 pedidos): normales+lejos+medios', msgBF.includes('Mi paga de la ruta (5 pedidos): S/ 40.50 — ya descontada del Yape'), msgBF);
check('cuadre: efectivo 100 / yape 9.50 / total 109.50',
  msgBF.includes('Te entrego en efectivo: S/ 100.00') && msgBF.includes('por Yape: S/ 9.50') && msgBF.includes('Recibe en total: S/ 109.50'), msgBF);
check('singular: 1 rechazado (sin s)', (() => {
  const m1 = armarMensajeCuadreJefe({ ...cierreBF, pagoRuta: { ...snap, cantidadRechazados: 1, montoRechazados: 4.5 } });
  return m1.includes('1 rechazado al medio (S/ 4.50)');
})());
check('variable {medios} para plantillas propias', aplicarPlantillaCuadre('medios: {medios}', cierreBF) === 'medios: 2');
check('VARIABLES_CUADRE incluye medios', VARIABLES_CUADRE.map((v) => v.clave).includes('medios'));
check('todas las variables se reemplazan (con medios presente)', !aplicarPlantillaCuadre(
  VARIABLES_CUADRE.map((v) => `{${v.clave}}`).join('\n'), cierreBF, 'Rudy'
).includes('{'));
check('snapshot VIEJO sin rechazados → detalle SIN «al medio» (regresión FASE BC)', (() => {
  const mViejo = armarMensajeCuadreJefe({ ...cierreBF, entregas: 10, fallidos: 1, pagoRuta: { activo: true, cantidadNormal: 8, cantidadLejos: 2, tarifaNormal: 9, tarifaLejos: 12, total: 96 } });
  return mViejo.includes('📦 Pedidos: 8 de S/ 9 + 2 de S/ 12 (lejos) · 10 entregados · ❌ fallidos: 1') && !mViejo.includes('al medio');
})());

// ── 7. Mensaje del MATE (resumenCore) ──────────────────────
console.log('7) armarMensajeResumen: el MATE también lleva el medio');
const pp7 = calcularPagoPedidos(mix, cfg);
const res7 = armarResumenDia({ clientes: mix, gastos: [], fondo: 0, pagoPedidos: pp7 });
const msg7 = armarMensajeResumen(res7, null, 'Rudy');
check('línea 🛵 con el medio: 2 × S/ 9 + 1 × S/ 12 (lejos) + 2 al medio (S/ 10.50) = S/ 40.50',
  msg7.includes('🛵 *Por pedidos*: 2 × S/ 9 + 1 × S/ 12 (lejos) + 2 al medio (S/ 10.50) = S/ 40.50'),
  msg7.split('\n').find((l) => l.includes('Por pedidos')));
check('resumen.pagoPedidos.total 40.50', res7.pagoPedidos?.total === 40.5);

// ── 8. Contratos de fuente (los parches viven donde deben) ─
console.log('8) contratos de fuente');
{
  const core = leer('../src/utils/pagoPedidosCore.ts');
  check('pagoPedidosCore: la regla del medio (st rechazado) + montoRechazados',
    core.includes("st === 'rechazado'") && core.includes('montoRechazados'));
  const caja = leer('../src/utils/cajaCore.ts');
  check('cajaCore: PagoRutaCierre con campos opcionales + variable medios + detalle con medio',
    caja.includes('cantidadRechazados?: number') && caja.includes("'medios'") && caja.includes('al medio (S/'));
  const card = leer('../src/components/CajaCard.tsx');
  check('CajaCard: congela cantidadRechazados/montoRechazados en el cierre',
    card.includes('cantidadRechazados: pagoRutaCierre.cantidadRechazados') && card.includes('montoRechazados: pagoRutaCierre.montoRechazados'));
  check('CajaCard: la fila viva dice «+N al medio» y el cuadre cerrado cuenta los medios',
    card.includes('cantidadRechazados} al medio') && card.includes('cantidadRechazados || 0) || cierreHoy!.entregas'));
  const rv = leer('../src/components/RutaView.tsx');
  check('RutaView: el chip muestra el MEDIO en los rechazados',
    rv.includes('Rechazado en puerta: paga el MEDIO') && rv.includes('Rechazado · medio'));
  const rsv = leer('../src/components/ResumenView.tsx');
  check('ResumenView: desglose con rechazados al medio + etiqueta paga el medio',
    rsv.includes('rechazados al medio') && rsv.includes('paga el medio'));
  const rcore = leer('../src/utils/resumenCore.ts');
  check('resumenCore: la línea del MATE con el medio', rcore.includes('pp.montoRechazados.toFixed(2)'));
  const sv = leer('../src/components/SettingsView.tsx');
  check('SettingsView: la temporada explica el medio', sv.includes('si lo rechazan en puerta (el medio)'));
  const pp = leer('../src/components/order/PaymentPanel.tsx');
  check('PaymentPanel: el botón dice que paga el medio', pp.includes('Rechazado en Puerta (paga el medio)'));
  const pc = leer('../src/drivertrack/panels/PanelContabilidadDT.tsx');
  check('PanelContabilidad: el fallback literal tiene los campos nuevos',
    pc.includes('cantidadRechazados: 0, entregados: 0, montoNormal: 0, montoLejos: 0, montoRechazados: 0'));
  const fsx = leer('../src/services/firestore.ts');
  check('firestore: el comentario del snapshot del historial', fsx.includes('el desglose ahora incluye los rechazados al medio'));
  const aj = leer('../src/drivertrack/components/AjustesView.tsx');
  check('AjustesView: v0.11.32 + PAGA EL MEDIO', aj.includes('v0.11.32') && aj.includes('PAGA EL MEDIO'));
  const pkg = leer('../package.json');
  check('package.json 0.11.32', pkg.includes('"version": "0.11.32"'));
}

// ── resumen ──────────────────────────────────────────────
console.log(`\n📊 ${ok} ✓ · ${fail} ✗`);
if (fail > 0) {
  console.log('❌ FASE BF: hay tests fallando');
  process.exit(1);
}
console.log('✅ FASE BF: el rechazado en puerta paga el medio — OK');
