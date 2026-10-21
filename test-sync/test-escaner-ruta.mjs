// ─────────────────────────────────────────────────────────────
// 🧪 TEST — FASE AG: 📷 escáner de EXTRA de WhatsApp (Mi Ruta)
//
// Pedido literal de Rudy (21 oct): «hay que darle esa función que
// tiene viaje sin driver también en la sección mi ruta… por
// WhatsApp me mandan el nombre del cliente, la dirección… es un
// extra que salió al momento… que la cámara igualito que lo
// escanee y que lo ponga en orden y así agregarlo».
//
// Compila el services/escanerRuta.ts REAL con esbuild — junto con
// el escanerIA.ts y moneda.ts REALES (módulos puros, cero stubs
// de Firebase). fetch se stubbea global para simular Gemini y
// Claude sin gastar la cuota de nadie:
//   AG1.  PROMPT_RUTA: las 7 claves del JSON + reglas de WhatsApp
//         (51 del país, no inventar, código de calle ≠ persona).
//   AG2.  sanearClienteWA: celular "+51 998 776 554" → 998776554.
//   AG3.  sanearClienteWA: "C.1" como cliente se muda a la dirección.
//   AG4.  sanearClienteWA: "Distrito de San Miguel" → "San Miguel".
//   AG5.  sanearClienteWA: "S/ 89,90" → 89.9 (parse peruano FASE Z);
//         "" o basura → null (NO se inventa plata).
//   AG6.  escanearClienteWhatsApp: Gemini 200 → datos saneados.
//   AG7.  sin keys → el error humano de siempre ("Configurá tu key").
//   AG8.  key con formato raro → error de formato.
//   AG9.  Gemini sin créditos → Claude al rescate SOLO (rescate).
//   AG10. foto ilegible (todo vacío) → "No pude leer nada en la foto".
//   AG11. JSON envuelto en markdown → el parser lo rescata.
//   AG12. mensaje de ventas literal (EJEMPLO 1 del prompt) → los
//         7 campos EXACTOS en orden para el formulario.
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const OUT = path.join(REPO, 'test-sync', 'escaner-ruta.compilado.cjs');

// escanerRuta importa escanerIA (puro) + moneda (puro) — sin stubs
await esbuild.build({
  entryPoints: [path.join(REPO, 'src/services/escanerRuta.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  logLevel: 'silent',
});
console.log('✓ services/escanerRuta.ts REAL compilado (escanerIA + moneda reales)');

const mod = require2(OUT);
const { sanearClienteWA, escanearClienteWhatsApp, __escanerRutaTests } = mod;

let PASS = 0, FAIL = 0;
function ok(nombre) { PASS++; console.log('  ✓ ' + nombre); }
function bad(nombre, extra) { FAIL++; console.log('  ✗ ' + nombre + (extra ? ' → ' + extra : '')); }
function check(nombre, cond, extra) { cond ? ok(nombre) : bad(nombre, extra); }

// ── fetch stubbeable: cada llamada decide qué responder ──
let RESPUESTAS = []; // [{match: url => bool, status, body}]
const LLAMADAS = [];
globalThis.fetch = async (url, opts) => {
  LLAMADAS.push(String(url));
  const urlStr = String(url);
  for (const r of RESPUESTAS) {
    if (r.match(urlStr)) {
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.body,
      };
    }
  }
  return { ok: false, status: 500, json: async () => ({ error: { message: 'stub sin respuesta para ' + urlStr } }) };
};

const FOTO = 'data:image/jpeg;base64,AAAA';
const gemini200 = (texto) => ({
  match: (u) => u.includes('generativelanguage.googleapis.com'),
  status: 200,
  body: { candidates: [{ content: { parts: [{ text: texto }] } }] },
});
const claude200 = (texto) => ({
  match: (u) => u.includes('api.anthropic.com'),
  status: 200,
  body: { content: [{ type: 'text', text: texto }] },
});

// ═══ AG1: el prompt pide las 7 claves y enseña las reglas del trabajo ═══
{
  const P = __escanerRutaTests.PROMPT_RUTA;
  for (const clave of ['cliente', 'direccion', 'distrito', 'referencia', 'telefono', 'producto', 'cobrar']) {
    check(`AG1 prompt pide la clave "${clave}"`, P.includes('"' + clave + '"'), 'falta en el prompt');
  }
  check('AG1 prompt habla de WhatsApp', /whatsapp/i.test(P));
  check('AG1 prompt prohíbe inventar', /NO INVENTES/i.test(P));
  check('AG1 prompt enseña el 51 del país', P.includes('SIN el 51'));
  check('AG1 prompt: código de calle no es persona', P.includes('jamás nombres de personas') || P.includes('JAMAS nombres de personas'));
  check('AG1 prompt: sin monto devuelve vacío (no adivina)', /SÍ Y SOLO SÍ aparece escrito explícitamente|SI Y SOLO SI aparece escrito explícitamente/.test(P));
}

// ═══ AG2-AG5: sanearClienteWA (la red de seguridad post-scan) ═══
{
  const r1 = sanearClienteWA({ cliente: 'María López', direccion: 'Av. Sucre 1234, San Miguel', distrito: 'San Miguel', referencia: 'frente al grifo', telefono: '+51 988 111 222', producto: 'una cocina', cobrar: '45.90' });
  check('AG2 celular "+51 988 111 222" → 988111222', r1.telefono === '988111222', r1.telefono);
  check('AG2 monto "45.90" → 45.9', r1.cobrar === 45.9, String(r1.cobrar));

  const r2 = sanearClienteWA({ cliente: 'C.1', direccion: 'Barrio XV Popular', distrito: '', referencia: '', telefono: '51 998 776 554', producto: '', cobrar: '' });
  check('AG3 "C.1" como cliente se muda a la dirección', r2.cliente === '' && r2.direccion === 'C.1 Barrio XV Popular', JSON.stringify(r2));
  check('AG3 celular "51 998 776 554" → 998776554', r2.telefono === '998776554', r2.telefono);

  const r3 = sanearClienteWA({ cliente: 'Kevin', direccion: 'C.3 Mz A Lt 12, SMP', distrito: 'Distrito de San Miguel', referencia: '', telefono: '', producto: '', cobrar: 'S/ 89,90' });
  check('AG4 "Distrito de San Miguel" → "San Miguel"', r3.distrito === 'San Miguel', r3.distrito);
  check('AG5 "S/ 89,90" → 89.9 (coma decimal peruana)', r3.cobrar === 89.9, String(r3.cobrar));

  const r4 = sanearClienteWA({ cliente: 'Rosa', direccion: 'Jr. Los Álamos 245', distrito: 'La Perla', referencia: 'Barrio Barrio XV', telefono: '', producto: '', cobrar: '' });
  check('AG5 sin monto → null (no inventa plata)', r4.cobrar === null, String(r4.cobrar));
  check('AG5 "Barrio Barrio XV" → "Barrio XV" (palabras pegadas)', r4.referencia === 'Barrio XV', r4.referencia);

  const r5 = sanearClienteWA({ cliente: 'Ana', direccion: '', distrito: '', referencia: '', telefono: '51998776554', producto: '', cobrar: 'tres soles' });
  check('AG5 monto basura → null', r5.cobrar === null, String(r5.cobrar));
  check('AG5 celular 51998776554 (11 dígitos) → 998776554', r5.telefono === '998776554', r5.telefono);

  const r6 = sanearClienteWA({ cliente: 'Luis', direccion: 'Av. Universal', distrito: '', referencia: '', telefono: '12345678901234567', producto: '', cobrar: 0 });
  check('AG5 celular spam de dígitos → últimos 9', r6.telefono === '901234567', r6.telefono);
}

// ═══ AG6: Gemini 200 → datos saneados completos ═══
{
  RESPUESTAS = [gemini200('{"cliente":"María Fernanda López","direccion":"Av. Sucre 1234, San Miguel","distrito":"San Miguel","referencia":"frente al grifo Repsol","telefono":"988111222","producto":"una cocina","cobrar":"45.90"}')];
  LLAMADAS.length = 0;
  const d = await escanearClienteWhatsApp(FOTO, 'AIzaTEST123', '');
  check('AG6 escaneo Gemini → los 7 campos', d.cliente === 'María Fernanda López' && d.direccion === 'Av. Sucre 1234, San Miguel' && d.distrito === 'San Miguel' && d.referencia === 'frente al grifo Repsol' && d.telefono === '988111222' && d.producto === 'una cocina' && d.cobrar === 45.9, JSON.stringify(d));
  check('AG6 llamó a Gemini (una sola llamada)', LLAMADAS.length === 1 && LLAMADAS[0].includes('generativelanguage'), LLAMADAS.join(' | '));
}

// ═══ AG7: sin keys → el error humano de configurar ═══
{
  RESPUESTAS = [];
  let msg = '';
  try { await escanearClienteWhatsApp(FOTO, '', ''); } catch (e) { msg = e.message; }
  check('AG7 sin key → "Configurá tu key de IA en Ajustes"', msg.includes('Configurá tu key de IA'), msg);
}

// ═══ AG8: key con formato raro ═══
{
  let msg = '';
  try { await escanearClienteWhatsApp(FOTO, 'esto-no-es-una-key', ''); } catch (e) { msg = e.message; }
  check('AG8 key rara → "Eso no parece una key"', msg.includes('no parece una key'), msg);
}

// ═══ AG9: Gemini sin créditos → Claude al rescate ═══
{
  RESPUESTAS = [
    { match: (u) => u.includes('generativelanguage.googleapis.com'), status: 400, body: { error: { code: 400, message: 'Your prepayment credits are depleted. Billing required.' } } },
    claude200('{"cliente":"Kevin Rojas","direccion":"C.3 Mz A Lt 12, Barrio 2 de Octubre, SMP","distrito":"SMP","referencia":"","telefono":"998776554","producto":"","cobrar":"89"}'),
  ];
  LLAMADAS.length = 0;
  const d = await escanearClienteWhatsApp(FOTO, 'AIzaTEST123', 'sk-ant-TEST456');
  check('AG9 rescate Claude → Kevin Rojas con su celular peruano', d.cliente === 'Kevin Rojas' && d.telefono === '998776554' && d.cobrar === 89, JSON.stringify(d));
  check('AG9 probó Gemini primero y Claude después', LLAMADAS.length === 2 && LLAMADAS[0].includes('generativelanguage') && LLAMADAS[1].includes('api.anthropic'), LLAMADAS.join(' | '));
}

// ═══ AG10: foto ilegible (todo vacío) ═══
{
  RESPUESTAS = [gemini200('{"cliente":"","direccion":"","distrito":"","referencia":"","telefono":"","producto":"","cobrar":""}')];
  let msg = '';
  try { await escanearClienteWhatsApp(FOTO, 'AIzaTEST123', ''); } catch (e) { msg = e.message; }
  check('AG10 todo vacío → "No pude leer nada en la foto"', msg.includes('No pude leer nada'), msg);
}

// ═══ AG11: JSON envuelto en markdown → el parser lo rescata ═══
{
  RESPUESTAS = [gemini200('Acá van los datos:\n```json\n{"cliente":"Rosa Quispe","direccion":"Jr. Los Álamos 245, La Perla","distrito":"La Perla","referencia":"","telefono":"","producto":"","cobrar":""}\n```\nListo.')];
  const d = await escanearClienteWhatsApp(FOTO, 'AIzaTEST123', '');
  check('AG11 JSON con cháchara alrededor → rescatado igual', d.cliente === 'Rosa Quispe' && d.distrito === 'La Perla', JSON.stringify(d));
}

// ═══ AG12: el EJEMPLO 1 del prompt (mensaje de ventas) end-to-end ═══
{
  RESPUESTAS = [gemini200('{"cliente":"María Fernanda López","direccion":"Av. Sucre 1234, San Miguel","distrito":"San Miguel","referencia":"frente al grifo Repsol","telefono":"988111222","producto":"una cocina","cobrar":"45.90"}')];
  const d = await escanearClienteWhatsApp(FOTO, 'AIzaTEST123', '');
  // "que lo ponga en orden": cada dato listo para SU campo del formulario
  check('AG12 formulario en orden: nombre→Nombre, 988111222→Celular, una cocina→Producto, 45.9→Monto, Av. Sucre→Dirección, San Miguel→Distrito, grifo→Referencia',
    d.cliente === 'María Fernanda López' && d.telefono === '988111222' && d.producto === 'una cocina' && d.cobrar === 45.9 && d.direccion === 'Av. Sucre 1234, San Miguel' && d.distrito === 'San Miguel' && d.referencia === 'frente al grifo Repsol',
    JSON.stringify(d));
}

console.log(`\n═══ test-escaner-ruta: ${PASS} ✓ / ${FAIL} ✗ ═══`);
if (FAIL > 0) { console.log('❌ FASE AG con fallos'); process.exit(1); }
console.log('✅ FASE AG: escáner de WhatsApp OK');
