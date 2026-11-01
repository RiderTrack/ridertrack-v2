// ═══════════════════════════════════════════════════════════
// 🎯 TEST FASE BD — v0.11.30
// 🔒 LAS PALANCAS DEL COMPROBANTE SE RECUERDAN + el bot respeta
// enviarMate/enviarCliente (la mitad bot se valida en la suite del
// bot v3.12; acá el contrato del lado APP).
// Corre con: node test-sync/test-fase-bd.mjs
// (puro — sin Firebase, sin React; solo contrato de fuente)
// ═══════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}
const leer = p => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log('🔒 FASE BD — contrato de fuente RutaView (palancas con memoria)\n');
const src = leer('../src/components/RutaView.tsx');

// ── 1) la memoria existe ──
check('1. helpers leerDestinosPago/guardarDestinosPago presentes',
  /const leerDestinosPago = /.test(src) && /const guardarDestinosPago = /.test(src));
check('2. clave localStorage por usuario (patrón plantillas MATE)',
  /pago_destinos_\$\{user\.uid\}/.test(src));
check('3. defaults FASE AY intactos por tipo (comprobante MATE·noCliente / entregado MATE·cliente)',
  /comprobante: \{ mate: true, cliente: false \}/.test(src) && /entregado: \{ mate: true, cliente: true \}/.test(src));

// ── 2) el envío GUARDA la elección ──
const idxGuardar = src.indexOf('guardarDestinosPago(pagoFotoTipo, aMate, pagoFotoAlCliente)');
check('4. al enviar se guarda la elección (intención cruda, no la efectiva)',
  idxGuardar > 0, 'no encontrado guardarDestinosPago(pagoFotoTipo, aMate, pagoFotoAlCliente)');
check('5. el guardado va ANTES del reset de tipo (pagoFotoTipo aún vigente)',
  idxGuardar > 0 && src.indexOf('setPagoFotoTipo(\'comprobante\');', idxGuardar - 1200) < idxGuardar);

// ── 3. el modal ya NO resetea las palancas a lo viejo ──
const zonaEnvio = src.slice(src.indexOf('if (!pagoFotoArchivo)'), src.indexOf('} catch (e: any) {', src.indexOf('if (!pagoFotoArchivo)')));
check('6. tras enviar NO se fuerza setPagoFotoAMate(true) (el reset que odiaba Rudy)',
  !/setPagoFotoAMate\(true\)/.test(zonaEnvio));
check('7. tras enviar NO se fuerza setPagoFotoAlCliente(false)',
  !/setPagoFotoAlCliente\(false\)/.test(zonaEnvio));

// ── 4. abrir el modal APLICA lo guardado ──
const zonaAbrir = src.slice(src.indexOf('setPagoFotoMetodo(\'yape\'); setPagoFotoTipo(\'comprobante\');'), src.indexOf('setPagoFotoModalId(c.id);'));
check('8. al abrir: lee destinos guardados del comprobante',
  /leerDestinosPago\('comprobante'\)/.test(zonaAbrir));
check('9. al abrir: MATE se aplica SOLO si hay memoria (sin memoria queda como siempre)',
  /if \(dBD\.guardado\) setPagoFotoAMate\(dBD\.mate\)/.test(zonaAbrir));
check('10. al abrir: cliente abre con lo guardado (o false si nunca elegiste)',
  /setPagoFotoAlCliente\(dBD\.cliente\)/.test(zonaAbrir));

// ── 5. cambiar de tipo aplica los destinos de ESE tipo ──
const nCambiar = (src.match(/alCambiarTipoFoto\('(?:comprobante|entregado|otro)'\)/g) || []).length;
check('11. los 3 botones de tipo usan alCambiarTipoFoto (sin resets hardcodeados)',
  nCambiar === 3, 'encontrados=' + nCambiar);
check('12. alCambiarTipoFoto aplica las DOS palancas cuando hay memoria',
  /if \(d\.guardado\) \{\s*\n\s*setPagoFotoAMate\(d\.mate\);\s*\n\s*setPagoFotoAlCliente\(d\.cliente\);/.test(src));

// ── 6. la acción sigue viajando con los flags (regresión FASE AY) ──
check('13. la acción lleva enviarMate: aMate',
  /enviarMate: aMate,/.test(src));
check('14. la acción lleva enviarCliente + mensajeCliente',
  /enviarCliente: aCliente,/.test(src) && /mensajeCliente: aCliente \? mensajeCliente : ''/.test(src));
check('15. bloqueo con los dos destinos apagados (regresión FASE AY)',
  /\(\!aMate && !aCliente\)/.test(src));
check('16. testids de las palancas intactos (regresión FASE AY)',
  /data-testid="toggle-foto-mate"/.test(src) && /data-testid="toggle-foto-cliente"/.test(src));

// ── 7. versión ──
const ajustes = leer('../src/drivertrack/components/AjustesView.tsx');
const pkg = leer('../package.json');
check('17. AjustesView dice v0.11.30', /DriverTrack v0\.11\.30/.test(ajustes));
check('18. package.json 0.11.30', /"version": "0\.11\.30"/.test(pkg));

console.log(`\n${ok} ✓ · ${fail} ✗`);
process.exit(fail ? 1 : 0);
