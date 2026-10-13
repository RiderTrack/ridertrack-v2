// ─────────────────────────────────────────────────────────────
// 🧪 TEST — 📝 PANEL DE OBSERVACIONES DE LA RUTA (FASE W)
//
// El núcleo puro utils/obsRuta.ts compilado con esbuild:
//   · clientesConObs: filtra obs reales (no espacios), orden de
//     ruta (num asc)
//   · armarTextoObservaciones: header + una línea por cliente
//     (#num. nombre (dist) — obs), caso vacío
//   · fechaBonitaObs: "13 oct"
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const OUT = path.join(REPO, 'test-sync', 'obsRuta.compilado.cjs');
await esbuild.build({
  entryPoints: [path.join(REPO, 'src/utils/obsRuta.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  logLevel: 'silent',
});
console.log('✓ obsRuta.ts real compilado');

const { clientesConObs, armarTextoObservaciones, fechaBonitaObs } = require2(OUT);
let pass = 0, fail = 0;
const ok = (nombre, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};

const mk = (id, num, nombre, dist, obs, st) => ({ id, num, nombre, dist, obs, st });

console.log('\n▶ filtrado y orden');
{
  const clientes = [
    mk(5, 5, 'Elena', 'Surco', '', 'pendiente'),
    mk(2, 2, 'María', 'San Miguel', '   ', 'pendiente'),       // espacios → no cuenta
    mk(3, 3, 'Jorge', '', 'dejar en recepción, no llamar', 'efectivo'),
    mk(1, 1, 'Ana', 'Miraflores', 'entregar después de las 5pm', 'pendiente'),
    mk(4, undefined, 'Sin num', 'Lince', 'llamar al llegar', 'pendiente'),
  ];
  const lista = clientesConObs(clientes);
  ok('3 con obs real (los espacios no cuentan)', lista.length === 3);
  ok('orden de ruta (num asc, sin num al final)', lista.map(c => c.id).join(',') === '1,3,4');
  ok('nada raro: lista vacía → vacía', clientesConObs([]).length === 0);
  ok('defensivo: null/undefined en la lista no explota', clientesConObs([null, undefined, mk(1, 1, 'A', '', 'x', '')]).length === 1);
}

console.log('\n▶ texto para copiar (WhatsApp)');
{
  const clientes = [
    mk(1, 1, 'Ana', 'Miraflores', 'entregar después de las 5pm', 'pendiente'),
    mk(7, 7, 'Jorge', '', 'dejar en recepción', 'efectivo'),
  ];
  const texto = armarTextoObservaciones(clientes, '13 oct');
  console.log('----'); console.log(texto); console.log('----');
  ok('header con fecha', texto.startsWith('📝 OBSERVACIONES DE RUTA — 13 oct'));
  ok('cuenta los clientes', texto.includes('2 clientes con observación'));
  ok('línea 1 con num, nombre, dist y obs', texto.includes('1. Ana (Miraflores) — entregar después de las 5pm'));
  ok('línea 2 sin dist (sin paréntesis vacío)', texto.includes('7. Jorge — dejar en recepción') && !texto.includes('Jorge ()'));
  const singular = armarTextoObservaciones([mk(1, 1, 'Ana', '', 'x', '')]);
  ok('singular: 1 cliente', singular.includes('1 cliente con observación'));
  const vacio = armarTextoObservaciones([]);
  ok('vacío: avisa que no hay nadie', vacio.includes('Nadie tiene observaciones'));
  ok('el texto respeta los saltos de línea de la obs', armarTextoObservaciones([mk(1, 1, 'A', '', 'línea 1\nlínea 2', '')]).includes('línea 1\nlínea 2'));
}

console.log('\n▶ fecha bonita');
{
  const d = new Date(2026, 9, 13); // 13 oct 2026
  ok('fechaBonitaObs → "13 oct"', fechaBonitaObs(d) === '13 oct');
  ok('fechaBonitaObs default → hoy no explota', /^\d{1,2} \w{3}$/.test(fechaBonitaObs()));
}

console.log(`\n═══ OBS-RUTA: ${pass} ✓ · ${fail} ✗ ═══`);
process.exit(fail > 0 ? 1 : 0);
