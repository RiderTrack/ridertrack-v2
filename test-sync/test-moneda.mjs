// ─────────────────────────────────────────────────────────────
// 🧪 TEST — FASE Z (parte 1): 💰 parseMonedaPeru + montosConRespaldo
//
// Reporte literal de Rudy: "sí salió el monto el QR (ayer) pero
// hoy que volví a cargar los nuevos clientes solo aparece el QR
// y el nombre, no aparece el monto". El Excel/carga de cada día
// trae la plata en formatos distintos — "S/ 89.90", "89,90",
// columnas renombradas — y parseFloat() a secas devuelve NaN →
// monto 0 → "sin monto cargado".
//
// Este suite cubre el parseo PURO (sin DOM):
//   M1.  números ya parseados (XLSX/Firestore los manda así)
//   M2.  strings simples: "89.9", "89.90"
//   M3.  con símbolo: "S/ 89.90", "S/.89,90", "s/ 89"
//   M4.  coma decimal: "89,90" → 89.90
//   M5.  miles: "1,234.56" → 1234.56 y "1.234,56" → 1234.56
//   M6.  miles con espacio: "1 234.56" → 1234.56
//   M7.  basura/negativos/vacíos → 0 sin romper
//   M8.  montosConRespaldo: cobrar vacío → toma precio (y al revés)
//   M9.  montosConRespaldo: los dos vacíos → 0/0
//   M10. round-trip: los montos de la ruta REAL de hoy (89.9 /
//        44.9 / 69.9 / 116.82) parsean EXACTO.
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const OUT = path.join(REPO, 'test-sync', 'moneda.compilada.cjs');
await esbuild.build({
  entryPoints: [path.join(REPO, 'src/utils/moneda.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  logLevel: 'silent',
});
console.log('✓ utils/moneda.ts real compilado');

const requireLocal = createRequire(import.meta.url);
const { parseMonedaPeru, montosConRespaldo } = requireLocal(OUT);

let pass = 0, fail = 0;
const cerca = (a, b, tol = 0.001) => Math.abs(a - b) <= tol;
const check = (nombre, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};

// M1 — números ya parseados (así llegan de Firestore/XLSX)
check('M1a número puro 89.9', parseMonedaPeru(89.9) === 89.9);
check('M1b número 0 explícito', parseMonedaPeru(0) === 0);
check('M1c NaN → 0', parseMonedaPeru(NaN) === 0);

// M2 — strings simples
check('M2a "89.90"', parseMonedaPeru('89.90') === 89.9);
check('M2b " 89.9 " con espacios', parseMonedaPeru(' 89.9 ') === 89.9);

// M3 — con símbolo (el caso del Excel de la empresa)
check('M3a "S/ 89.90"', parseMonedaPeru('S/ 89.90') === 89.9);
check('M3b "S/.89,90"', cerca(parseMonedaPeru('S/.89,90'), 89.9));
check('M3c "s/ 89" minúscula', parseMonedaPeru('s/ 89') === 89);
check('M3d "S/89.90" pegado', parseMonedaPeru('S/89.90') === 89.9);

// M4 — coma decimal (formato que rompía parseFloat a secas)
check('M4a "89,90" → 89.90', cerca(parseMonedaPeru('89,90'), 89.9));
check('M4b "89,9" → 89.9', cerca(parseMonedaPeru('89,9'), 89.9));

// M5 — miles + decimales en ambos formatos
check('M5a "1,234.56" → 1234.56', cerca(parseMonedaPeru('1,234.56'), 1234.56));
check('M5b "1.234,56" → 1234.56', cerca(parseMonedaPeru('1.234,56'), 1234.56));

// M6 — espacio como separador de miles
check('M6 "1 234.56" → 1234.56', cerca(parseMonedaPeru('1 234.56'), 1234.56));

// M7 — basura no rompe
check('M7a "" → 0', parseMonedaPeru('') === 0);
check('M7b null → 0', parseMonedaPeru(null) === 0);
check('M7c undefined → 0', parseMonedaPeru(undefined) === 0);
check('M7d "abc" → 0', parseMonedaPeru('abc') === 0);
check('M7e "S/" solo → 0', parseMonedaPeru('S/') === 0);
check('M7f "-15" → -15 (devoluciones)', parseMonedaPeru('-15') === -15);

// M8 — el CORAZÓN del fix: respaldo entre columnas
{
  const r1 = montosConRespaldo('S/ 89.90', undefined);       // solo cobrar
  check('M8a cobrar "S/ 89.90" sin precio → 89.9', cerca(r1.cobrar, 89.9));
  const r2 = montosConRespaldo(undefined, '89,90');          // solo precio
  check('M8b sin cobrar, precio "89,90" → cobrar=89.9', cerca(r2.cobrar, 89.9), `dio ${r2.cobrar}`);
  check('M8c precio se mantiene 89.9', cerca(r2.precio, 89.9));
  const r3 = montosConRespaldo('', 0);                        // nada
  check('M8d los dos vacíos → 0/0', r3.cobrar === 0 && r3.precio === 0);
  const r4 = montosConRespaldo(0, 116.82);                    // cobrar 0, precio lleno
  check('M8e cobrar 0 + precio 116.82 → cobrar 116.82', cerca(r4.cobrar, 116.82), `dio ${r4.cobrar}`);
}

// M9 — redondeo raro no aparece
check('M9 sin decimales "100" → 100', parseMonedaPeru('100') === 100);

// M10 — los montos LITERALES de la ruta de hoy (15 oct)
{
  const hoy = [89.9, 44.9, 69.9, 116.82, 49.9, 64.9];
  const ok = hoy.every((m, i) => cerca(parseMonedaPeru(String(m)), m) && cerca(parseMonedaPeru(m), m));
  check('M10 montos de la ruta real parsean exacto (7 clientes)', ok);
  // y en el formato "S/ X.XX" que pega el Excel de la empresa
  const ok2 = hoy.every((m) => cerca(parseMonedaPeru(`S/ ${m.toFixed(2)}`), m));
  check('M10b mismos montos en "S/ X.XX" → exacto', ok2);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`MONEDA FASE Z: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);
