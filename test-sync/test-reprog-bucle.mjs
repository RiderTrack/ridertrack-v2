// ─────────────────────────────────────────────────────────────
// 🧪 TEST — FASE AM: 🚨 EL PÉNDULO DE LA LISTITA, CORTADO DE RAÍZ
//
// EL BUG REAL (21/22-oct): Rudy volvió a la v0.11.1 porque Mi Ruta,
// Resumen del día, Seguimiento y Mi QR quedaban "cargando" en las
// versiones nuevas. La causa: el efecto de auto-cuidado de la listita
// (useClientes AD-2) tenía un PÉNDULO INFINITO con este dataset:
//
//   ultimaCerrada.noEntregados = [fallido X]
//   lista de HOY (Excel)       = [X otra vez]
//
//   ciclo 1: migración AGREGA a X      → purga lo SACA ("ya volvió
//            hoy") → persistirCola([]) → ESCRITURA a usuarios/{uid}
//   ciclo 2: el snapshot de la escritura dispara el efecto otra vez:
//            migración AGREGA a X (ultimaCerrada lo recuerda para
//            siempre) → purga lo SACA → ESCRITURA → … PARA SIEMPRE.
//
// Cientos de escrituras por minuto saturaban Firestore + el celular:
// Mi QR (doc de 300KB) nunca llegaba, las plantillas tardaban un
// siglo, el bot de Termux (¡en el MISMO teléfono!) se ahogaba. Con
// la caché persistente, el eco local hacía las cascadas SINCRONAS
// → React #185 en Resumen del día.
//
// Este suite prueba el motor PURO:
//   AM1. migrarFallidos(ultima, cola, hoyLista, hoy) NO agrega al
//        fallido que ya volvió en la lista de hoy (la purga lo
//        echaría de vuelta = péndulo)
//   AM2. tampoco agrega a NADIE si la última cerrada ya pasó de los
//        5 días (la purga los expiraría al instante)
//   AM3. el fallido que NO volvió hoy SÍ entra (una vez) — la
//        listita sigue funcionando como siempre
//   AM4. compatibilidad: llamado VIEJO (2 args) = comportamiento
//        de siempre (tests AE-2 intactos)
//   AM5. SIMULACIÓN DEL EFECTO: con el dataset del péndulo, la
//        lógica VIEJA escribe en TODOS los ciclos (documentación del
//        bug) y la NUEVA CONVERGE: 0 o 1 escrituras y se queda quieta
//   AM6. el péndulo también existía con EXPIRADOS: la versión vieja
//        los re-migraba para que la purga los expirara de vuelta;
//        la nueva no
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(REPO, 'package.json'));
const esbuild = require2('esbuild');

const OUT = path.join(REPO, 'test-sync', 'reprog-bucle.compilado.cjs');
await esbuild.build({
  entryPoints: [path.join(REPO, 'src/services/reprog.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: OUT,
  logLevel: 'silent',
});

const {
  migrarFallidos,
  purgarCola,
  estaEnLista,
  esFallido,
  sumaDiasISO,
  EXPIRA_DIAS,
} = require2(OUT);

let PASARON = 0;
const FALLAS = [];
function check(nombre, cond) {
  if (cond) { PASARON++; console.log('  ✅ ' + nombre); }
  else { FALLAS.push(nombre); console.log('  ❌ ' + nombre); }
}

// ── dataset helpers ──
const cli = (num, nombre, cel, st = 'fallida', dir = 'Av. Siempre Viva 123') => ({
  id: num, num, nombre, cel, dir, st, prod: 'Producto', cobrar: 45, precio: 45,
});
const HOY = '2026-10-22';

// La versión VIEJA de migrarFallidos (la de antes del fix) — para
// demostrar el péndulo en la simulación (AM5/AM6). Copia exacta de
// la lógica que vivió en producción del 17-oct al 22-oct.
function migrarFallidosVIEJO(ultima, cola) {
  if (!ultima || !(ultima.noEntregados || []).length) return cola || [];
  let refresco = false;
  const out = (cola || []).map((item) => {
    if (!item || !item.cliente) return item;
    const esDeListita = item.origen === 'fallido' || !(item.para || '');
    if (!esDeListita) return item;
    const falloOtraVez = (ultima.noEntregados || []).some(
      (c) => c && esFallido(c.st) && (c.cel === item.cliente.cel || c.nombre === item.cliente.nombre)
    );
    if (falloOtraVez && (ultima.fecha || '') > (item.desde || '')) {
      refresco = true;
      return { ...item, desde: ultima.fecha };
    }
    return item;
  });
  const yaEstan = (c) => out.some((e) => e && e.cliente && (e.cliente.cel === c.cel || e.cliente.nombre === c.nombre));
  const faltantes = (ultima.noEntregados || []).filter((c) => c && c.nombre && esFallido(c.st) && !yaEstan(c));
  if (!faltantes.length && !refresco) return cola || [];
  return [...out, ...faltantes.map((c) => ({ cliente: c, para: '', desde: ultima.fecha, creadoAt: new Date().toISOString(), origen: 'fallido' }))];
}

// Simula el efecto AD-2 de useClientes: cada ciclo = migrar + purgar
// + (si cambió) persistir → el snapshot entrega lo persistido y
// dispara el ciclo siguiente. Devuelve cuántas escrituras hizo.
function simularEfecto({ version, ultima, hoyLista, ciclos = 8, colaInicial = [] }) {
  let cola = colaInicial;
  let escrituras = 0;
  for (let i = 0; i < ciclos; i++) {
    const migrada = version === 'vieja'
      ? migrarFallidosVIEJO(ultima, cola)
      : migrarFallidos(ultima, cola, hoyLista, HOY);
    const { vivos } = purgarCola(migrada, HOY, hoyLista);
    if (migrada !== cola || vivos.length !== migrada.length) {
      escrituras++;
      cola = vivos; // el snapshot le devuelve exactamente lo escrito
    }
  }
  return escrituras;
}

console.log('══ AM1: el fallido que YA volvió hoy NO entra a la listita ══');
{
  const X = cli(1, 'Floresinda Solano', '993198927', 'ausente');
  const deNuevo = cli(1, 'Floresinda Solano', '993198927', 'pendiente');
  const ultima = { fecha: '2026-10-21', noEntregados: [X] };
  const migrada = migrarFallidos(ultima, [], [deNuevo], HOY);
  check('no lo agrega (misma referencia = cero escrituras)', migrada.length === 0);
  check('estaEnLista lo reconoce como vuelto hoy', estaEnLista(X, [deNuevo]) === true);
  // y con el llamado VIEJO (2 args) SÍ lo agregaba — el bug en vivo:
  const vieja = migrarFallidos(ultima, []);
  check('…y CONFIRMACIÓN del bug: sin pasarle la lista de hoy (llamado viejo) SÍ entraba (así nacía el péndulo)', vieja.length === 1);
}

console.log('══ AM2: última cerrada VENCIDA (más de ' + EXPIRA_DIAS + ' días) → no migra a nadie ══');
{
  const viejo = cli(2, 'Cliente Antiguo', '998887777', 'fallida');
  const fechaVencida = sumaDiasISO(HOY, -(EXPIRA_DIAS + 1));
  const ultima = { fecha: fechaVencida, noEntregados: [viejo] };
  const migrada = migrarFallidos(ultima, [], [], HOY);
  check('vencida → 0 migrados (la purga los expiraría al instante)', migrada.length === 0);
  // frontera: 5 días JUSTOS → aún entra (sigue siendo útil)
  const fechaBorde = sumaDiasISO(HOY, -EXPIRA_DIAS);
  const enBorde = migrarFallidos({ fecha: fechaBorde, noEntregados: [viejo] }, [], [], HOY);
  check(EXPIRA_DIAS + ' días justos → todavía entra (frontera intacta)', enBorde.length === 1);
}

console.log('══ AM3: el fallido que NO volvió hoy SÍ entra — la listita viva ══');
{
  const X = cli(3, 'Señora Rosa', '991112223', 'no-contesta');
  const otra = cli(4, 'Cliente de Ayer', '994445556', 'rechazado');
  const ultima = { fecha: '2026-10-21', noEntregados: [X, otra] };
  const hoyLista = [cli(10, 'Otro Cliente', '999999999', 'pendiente')];
  const migrada = migrarFallidos(ultima, [], hoyLista, HOY);
  check('agrega a los 2 fallidos que faltan', migrada.length === 2);
  const segunda = migrarFallidos(ultima, migrada, hoyLista, HOY);
  check('segunda pasada = misma referencia (no re-escribe)', segunda === migrada);
  const { vivos, resueltos, expirados } = purgarCola(migrada, HOY, hoyLista);
  check('la purga los deja vivir (ni resueltos ni expirados)', vivos.length === 2 && resueltos === 0 && expirados === 0);
}

console.log('══ AM4: compatibilidad — llamado viejo (2 args) igual que siempre ══');
{
  const X = cli(5, 'Fallido Normal', '997778889', 'fallida');
  const ultima = { fecha: '2026-10-21', noEntregados: [X] };
  const migrada = migrarFallidos(ultima, []);
  check('sin lista de hoy migra igual que en AE-2', migrada.length === 1 && migrada[0].origen === 'fallido');
  check('sin ultima = misma referencia', migrarFallidos(null, migrada) === migrada);
  check('entregados no entran', migrarFallidos({ fecha: '2026-10-21', noEntregados: [cli(6, 'Ya Pagó', '991234567', 'efectivo')] }, []).length === 0);
}

console.log('══ AM5: SIMULACIÓN DEL EFECTO — el dataset que rompió todo ══');
{
  const X = cli(7, 'Floresinda Solano Herrera', '993198927', 'ausente');
  const ultima = { fecha: '2026-10-21', noEntregados: [X] };
  const hoyLista = [cli(1, 'Floresinda Solano Herrera', '993198927', 'pendiente')];

  const escriturasViejas = simularEfecto({ version: 'vieja', ultima, hoyLista, ciclos: 8 });
  check('lógica VIEJA: escribía en los 8 ciclos (PÉNDULO INFINITO — 8/8)', escriturasViejas === 8);

  const escriturasNuevas = simularEfecto({ version: 'nueva', ultima, hoyLista, ciclos: 8 });
  check('lógica NUEVA: cero escrituras (converge al toque)', escriturasNuevas === 0);
}

console.log('══ AM6: el péndulo de los EXPIRADOS (también existía) ══');
{
  const viejo = cli(8, 'Cliente de la Semana Pasada', '992223334', 'fallida');
  const fechaVencida = sumaDiasISO(HOY, -(EXPIRA_DIAS + 3));
  const ultima = { fecha: fechaVencida, noEntregados: [viejo] };

  const escriturasViejas = simularEfecto({ version: 'vieja', ultima, hoyLista: [], ciclos: 8 });
  check('lógica VIEJA: el expirado también generaba péndulo (8/8 escrituras)', escriturasViejas === 8);

  const escriturasNuevas = simularEfecto({ version: 'nueva', ultima, hoyLista: [], ciclos: 8 });
  check('lógica NUEVA: cero escrituras (el vencido se queda afuera)', escriturasNuevas === 0);
}

console.log('══ AM7: caso mixto — uno volvió, uno no: SOLO entra el que faltaba ══');
{
  const volvio = cli(9, 'Juan Reprogramado', '995556667', 'cancelado');
  const falta = cli(10, 'María Ausente', '998881112', 'ausente');
  const ultima = { fecha: '2026-10-21', noEntregados: [volvio, falta] };
  const hoyLista = [cli(1, 'Juan Reprogramado', '995556667', 'pendiente')];
  const migrada = migrarFallidos(ultima, [], hoyLista, HOY);
  check('solo María entra (Juan ya está en la ruta de hoy)', migrada.length === 1 && migrada[0].cliente.nombre === 'María Ausente');
  const escrituras = simularEfecto({ version: 'nueva', ultima, hoyLista, ciclos: 8 });
  check('y el efecto converge en 1 escritura (la inicial) y se queda quieto', escrituras === 1);
}

console.log('');
console.log('══════════════════════════════════════════════════════');
if (FALLAS.length === 0) {
  console.log('✅ test-reprog-bucle: ' + PASARON + '/' + PASARON + ' — el péndulo quedó CORTADO');
  process.exit(0);
} else {
  console.log('❌ test-reprog-bucle: ' + FALLAS.length + ' fallas de ' + (PASARON + FALLAS.length));
  FALLAS.forEach((f) => console.log('   • ' + f));
  process.exit(1);
}
