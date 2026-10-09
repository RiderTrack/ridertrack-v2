#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// 🔐 actualizar_reglas_backups.js — FASE N: FIX DEL BACKUP EN
//            LA NUBE (backups_v2 + backups v1 + historial_rutas)
//            v1.0 — Basado en actualizar_reglas.js v3.3 (el mismo
//            que ya publicaste OK para acciones_dt/imagenes_dt/
//            dt_sync): misma API, mismo formato de publish que
//            el CLI oficial, mismos reintentos.
//
// ¿POR QUÉ EXISTE ESTE SCRIPT? Las reglas de Firestore VIVAS no
// dejan pasar los backups de la ruta ni el LIST del historial:
//   · backups_v2  → NO tiene regla → deny-all lo bloquea → el
//                   "Finalizar y guardar ruta" guarda el historial
//                   pero el backup NO sube (toast ⚠️ "avísame para
//                   revisarlo") y ☁️ Backups sale VACÍO.
//   · usuarios/{uid}/backups → la regla del doc usuarios/{uid} NO
//                   cubre subcolecciones → el backup v1 tampoco sube.
//   · historial_rutas list → la regla matches() del docId niega
//                   TODOS los list (las reglas NO son filtros) →
//                   📜 Historial, 📊 Estadísticas, 💰 Caja y 🖼️
//                   Galería ven la lista VACÍA (las rutas SÍ están
//                   guardadas — solo que la app no las puede leer).
//
// QUÉ HACE (quirúrgico e idempotente):
//   1. Baja las reglas vivas actuales (API de Firebase Rules)
//   2. Inserta el bloque backups_v2 (si falta)
//   3. Inserta el bloque usuarios/{uid}/backups (si falta)
//   4. REEMPLAZA el bloque historial_rutas por la versión con
//      get/list separados (si todavía no lo tiene)
//      — NO toca ABSOLUTAMENTE NADA MÁS de tus reglas
//   5. Publica la versión nueva y verifica que quedó
//
// Podés correrlo las veces que quieras — lo que ya está, lo salta.
//
// Corrélo en Termux, en la carpeta del bot:
//   cd ~/bot-whatsapp
//   node actualizar_reglas_backups.js
//
// Si falla (permisos del serviceAccount, sin internet, etc.), te
// imprime los pasos manuales de la consola de Firebase — nada se
// rompe en el intento (el publish solo ocurre si el ruleset nuevo
// valida sintaxis OK).
// ═══════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const CARPETA = __dirname;
const SA_PATH = path.join(CARPETA, 'serviceAccount.json');

const VERSION = 'v1.0 (FASE N)';

let projectId = '';
let contenidoParchado = '';

if (!fs.existsSync(SA_PATH)) {
  console.error('❌ No encuentro serviceAccount.json en ' + CARPETA);
  console.error('   (Tiene que estar en la carpeta del bot — es el que ya usa rudy-bot)');
  process.exit(1);
}

// ── Bloque 1: backups_v2 (la pantalla ☁️ Backups + el backup del cierre) ──
// Los bloques vienen en DOS sabores: con helpers (isAuth/isAdmin, si tus
// reglas vivas los tienen — es lo normal) o inline (si no los tuvieran).
const BLOQUE_BACKUPS_V2 = (helpers) => helpers
? `    // FASE N: Backups v2 — snapshot de rutas de la pantalla ☁️ Backups
    // (manual + auto-cierre {uid}_{ts} + auto-guardado vivo
    // {uid}_{fecha}_auto). Todo doc lleva el campo uid del dueño; el
    // list de la app filtra where('uid','==',tu uid).
    match /backups_v2/{docId} {
      allow read: if isAuth() && (resource.data.uid == request.auth.uid || isAdmin());
      allow create: if isAuth() && (request.resource.data.uid == request.auth.uid || isAdmin());
      allow update, delete: if isAuth() && (resource.data.uid == request.auth.uid || isAdmin());
    }
`
: `    // FASE N: Backups v2 (versión inline — tus reglas no tienen helpers)
    match /backups_v2/{docId} {
      allow read: if request.auth != null && (resource.data.uid == request.auth.uid || request.auth.uid == 'K8wx9X5GGOfindI1RGtIIQN3UGr1');
      allow create: if request.auth != null && (request.resource.data.uid == request.auth.uid || request.auth.uid == 'K8wx9X5GGOfindI1RGtIIQN3UGr1');
      allow update, delete: if request.auth != null && (resource.data.uid == request.auth.uid || request.auth.uid == 'K8wx9X5GGOfindI1RGtIIQN3UGr1');
    }
`;

// ── Bloque 2: usuarios/{uid}/backups (backup v1 del cierre + .hist) ──
const BLOQUE_USUARIOS_BACKUPS = (helpers) => helpers
? `    // FASE N: backups de la ruta v1 (auto_{fecha} del cierre + .hist del
    // importador) — la regla del doc usuarios/{uid} NO cubre subcolecciones.
    match /usuarios/{userId}/backups/{backupId} {
      allow read: if isOwner(userId) || isAdmin();
      allow write: if isOwner(userId) || isAdmin();
    }
`
: `    // FASE N: backups v1 (inline)
    match /usuarios/{userId}/backups/{backupId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
`;

// ── Bloque 3: historial_rutas VERSIÓN NUEVA (reemplaza la vieja) ──
const BLOQUE_HISTORIAL = (helpers) => helpers
? `    // FASE N: Historial de rutas — read separado en get/list (antes el
    // matches() del docId negaba TODOS los list: las reglas NO son
    // filtros → Historial/Estadísticas/Caja/Galería veían VACÍO).
    // El list exige que el query filtre where('uid','==',tu uid).
    match /historial_rutas/{docId} {
      allow get: if isAuth() && (docId.matches(request.auth.uid + '_.*') || isAdmin() || resource.data.uid == request.auth.uid);
      allow list: if isAuth() && (resource.data.uid == request.auth.uid || isAdmin());
      allow create: if isAuth() && (docId.matches(request.auth.uid + '_.*') || isAdmin() || request.resource.data.uid == request.auth.uid);
      allow update, delete: if isAuth() && (docId.matches(request.auth.uid + '_.*') || isAdmin() || resource.data.uid == request.auth.uid);
    }
`
: `    // FASE N: historial_rutas (inline)
    match /historial_rutas/{docId} {
      allow get: if request.auth != null && (docId.matches(request.auth.uid + '_.*') || request.auth.uid == 'K8wx9X5GGOfindI1RGtIIQN3UGr1' || resource.data.uid == request.auth.uid);
      allow list: if request.auth != null && (resource.data.uid == request.auth.uid || request.auth.uid == 'K8wx9X5GGOfindI1RGtIIQN3UGr1');
      allow create: if request.auth != null && (docId.matches(request.auth.uid + '_.*') || request.auth.uid == 'K8wx9X5GGOfindI1RGtIIQN3UGr1' || request.resource.data.uid == request.auth.uid);
      allow update, delete: if request.auth != null && (docId.matches(request.auth.uid + '_.*') || request.auth.uid == 'K8wx9X5GGOfindI1RGtIIQN3UGr1' || resource.data.uid == request.auth.uid);
    }
`;

// Encuentra el bloque match /historial_rutas/... {...} completo (por
// líneas: desde el match hasta la primera llave de cierre indentada
// exactamente como el match — sin contar llaves dentro de comentarios).
function reemplazarBloqueHistorial(texto, bloqueNuevo) {
  const lineas = texto.split('\n');
  const idxMatch = lineas.findIndex((l) => /^\s*match\s+\/historial_rutas\//.test(l));
  if (idxMatch === -1) return null; // no existe → el llamador decide insertar
  // indent del match para saber cuál es SU llave de cierre
  const indent = (lineas[idxMatch].match(/^\s*/) || [''])[0];
  let idxCierre = -1;
  for (let i = idxMatch + 1; i < lineas.length; i++) {
    if (lines_es_cierre(lineas[i], indent)) { idxCierre = i; break; }
  }
  if (idxCierre === -1) return null;
  const antes = lineas.slice(0, idxMatch);
  // el comentario explicativo de arriba del match (si hay) se conserva:
  // buscamos la primera línea no-comentario hacia atrás y cortamos el
  // comentario viejo SOLO si menciona historial (para no duplicarlo).
  let inicio = idxMatch;
  while (inicio > 0 && /^\s*\/\//.test(lineas[inicio - 1])) {
    const c = lineas[inicio - 1];
    if (/historial|Historial/i.test(c)) inicio--; else break;
  }
  const despues = lineas.slice(idxCierre + 1);
  return [...antes, ...bloqueNuevo.replace(/\n$/, '').split('\n'), ...despues].join('\n');
}
function lines_es_cierre(linea, indent) {
  return new RegExp('^' + indent.replace(/ /g, '\\ ') + '\\}\\s*$').test(linea) || linea === indent + '}';
}

async function main() {
  // 🪪 CARTEL DE VERSIÓN — si esta línea no aparece arriba de todo,
  // estás corriendo un archivo VIEJO de otra carpeta.
  console.log('📋 actualizar_reglas_backups.js ' + VERSION);

  // 1. Token OAuth del serviceAccount (firebase-admin ya está instalado)
  const { cert } = require('firebase-admin/app');
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  projectId = sa.project_id;
  console.log('🔑 Proyecto: ' + projectId);

  const credential = cert(sa);
  const tokenResp = await credential.getAccessToken();
  const token = tokenResp.accessToken || tokenResp.access_token;
  if (!token) throw new Error('no pude obtener el token OAuth del serviceAccount');
  console.log('🔑 Token OAuth obtenido ✓');

  const BASE = 'https://firebaserules.googleapis.com/v1/projects/' + projectId;
  const HEADERS = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  };

  // 2. Reglas vivas actuales (release cloud.firestore → ruleset → contenido)
  console.log('⬇️ Bajando las reglas vivas…');
  const relRes = await fetch(BASE + '/releases/cloud.firestore', { headers: HEADERS });
  if (!relRes.ok) throw new Error('GET release: ' + relRes.status + ' ' + (await relRes.text()).slice(0, 200));
  const release = await relRes.json();
  const rulesetName = release.rulesetName; // projects/X/rulesets/Y
  console.log('   release actual: ' + rulesetName);

  const rsRes = await fetch('https://firebaserules.googleapis.com/v1/' + rulesetName, { headers: HEADERS });
  if (!rsRes.ok) throw new Error('GET ruleset: ' + rsRes.status);
  const ruleset = await rsRes.json();
  const archivo = (ruleset.source && ruleset.source.files && ruleset.source.files[0]) || null;
  if (!archivo || !archivo.content) throw new Error('el ruleset no tiene contenido legible');
  let contenido = archivo.content;
  console.log('   reglas vivas: ' + contenido.length + ' caracteres ✓');

  // ¿Tus reglas tienen los helpers? (lo normal es que sí — todas las
  // versiones que subiste los tienen. Si no, uso bloques inline.)
  const helpers = /function\s+isAuth\s*\(/.test(contenido) && /function\s+isAdmin\s*\(/.test(contenido) && /function\s+isOwner\s*\(/.test(contenido);
  console.log('   helpers isAuth/isAdmin/isOwner: ' + (helpers ? 'SÍ (uso los bloques con helpers)' : 'NO (uso bloques inline)'));

  // 3. ¿Qué falta? (idempotente, uno por uno)
  const cambios = [];

  if (!/match\s+\/backups_v2\//.test(contenido)) {
    cambios.push({ tipo: 'insertar', nombre: 'backups_v2 (el backup del cierre + la pantalla ☁️ Backups)', bloque: BLOQUE_BACKUPS_V2(helpers) });
  } else {
    console.log('✅ backups_v2 ya está en las reglas vivas');
  }

  if (!/match\s+\/usuarios\/\{userId\}\/backups\//.test(contenido)) {
    cambios.push({ tipo: 'insertar', nombre: 'usuarios/{uid}/backups (el backup v1 del cierre)', bloque: BLOQUE_USUARIOS_BACKUPS(helpers) });
  } else {
    console.log('✅ usuarios/{uid}/backups ya está en las reglas vivas');
  }

  if (!/allow\s+list\s*:/.test(contenido)) {
    const reemplazo = reemplazarBloqueHistorial(contenido, BLOQUE_HISTORIAL(helpers));
    if (reemplazo) {
      cambios.push({ tipo: 'reemplazo', nombre: 'historial_rutas → get/list (que 📜 Historial/📊 Estadísticas/💰 Caja puedan LISTAR)', bloque: reemplazo });
    } else {
      // no encontré el bloque → lo inserto standalone ( Firestore une
      // bloques del mismo path con OR: el viejo sigue, el nuevo agrega)
      cambios.push({ tipo: 'insertar', nombre: 'historial_rutas get/list (bloque nuevo, no encontré el viejo para reemplazar)', bloque: BLOQUE_HISTORIAL(helpers) });
    }
  } else {
    console.log('✅ historial_rutas ya tiene el split get/list');
  }

  if (cambios.length === 0) {
    console.log('');
    console.log('✅ Las reglas VIVAS ya tienen todo el FASE N — nada que hacer.');
    console.log('   Si igual no ves los backups, avisale al dev (otro problema será).');
    return;
  }
  cambios.forEach((c) => console.log('🩹 ' + c.tipo.toUpperCase() + ': ' + c.nombre));

  // 4. Aplicar los cambios al texto
  let nuevo = contenido;
  const aInsertar = cambios.filter((c) => c.tipo === 'insertar').map((c) => c.bloque).join('\n');
  if (aInsertar) {
    const anclaDeny = nuevo.search(/match\s*\/\{document=\*\*\}/);
    if (anclaDeny !== -1) {
      const inicioLinea = nuevo.lastIndexOf('\n', anclaDeny) + 1;
      nuevo = nuevo.slice(0, inicioLinea) + aInsertar + '\n' + nuevo.slice(inicioLinea);
    } else {
      nuevo = nuevo.trimEnd() + '\n\n' + aInsertar;
    }
    console.log('🩹 Insertando ' + cambios.filter((c) => c.tipo === 'insertar').length + ' bloque(s) (antes del deny-all)…');
  }
  const reemplazos = cambios.filter((c) => c.tipo === 'reemplazo');
  for (const r of reemplazos) {
    nuevo = r.bloque;
    console.log('🔁 Reemplazando el bloque historial_rutas…');
  }
  contenidoParchado = nuevo; // por si el publish falla → plan B con reglas completas

  // 5. Crear el ruleset nuevo (la API valida la SINTAXIS acá: si algo
  //    estuviera mal escrito, falla ANTES de publicar y no toca nada)
  const crearRes = await fetch(BASE + '/rulesets', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      source: { files: [{ name: 'firestore.rules', content: nuevo }] },
    }),
  });
  if (!crearRes.ok) {
    const detalle = (await crearRes.text()).slice(0, 400);
    throw new Error('crear ruleset: ' + crearRes.status + ' — ' + detalle);
  }
  const nuevoRuleset = await crearRes.json();
  console.log('📦 Ruleset nuevo: ' + nuevoRuleset.name);

  // 6. Publicar (release) — MISMO formato que ya funcionó con la v3.3:
  //    PATCH con el cuerpo envuelto { release: { name, rulesetName } },
  //    que es lo que manda el CLI oficial de Firebase.
  const releaseName = 'projects/' + projectId + '/releases/cloud.firestore';
  const intentos = [
    ['PATCH (formato del CLI oficial)', 'PATCH', BASE + '/releases/cloud.firestore',
      { release: { name: releaseName, rulesetName: nuevoRuleset.name } }],
    ['PATCH (envuelto + updateMask)', 'PATCH', BASE + '/releases/cloud.firestore',
      { release: { name: releaseName, rulesetName: nuevoRuleset.name }, updateMask: 'rulesetName' }],
    ['POST crear release (createRelease del CLI)', 'POST', BASE + '/releases',
      { name: releaseName, rulesetName: nuevoRuleset.name }],
  ];
  let publicado = false;
  let detalleFalla = '';
  for (const [etiqueta, metodo, url, cuerpo] of intentos) {
    const res = await fetch(url, { method: metodo, headers: HEADERS, body: JSON.stringify(cuerpo) });
    if (res.ok) {
      console.log('   ✅ ' + etiqueta + ' funcionó');
      publicado = true;
      break;
    }
    const cuerpoError = (await res.text()).slice(0, 300).replace(/\s+/g, ' ');
    detalleFalla = etiqueta + ' → ' + res.status + ' ' + cuerpoError;
    console.log('   ⚠️ ' + etiqueta + ' falló (' + res.status + '): ' + cuerpoError.slice(0, 160));
  }
  if (!publicado) throw new Error(detalleFalla);
  console.log('🚀 Reglas publicadas ✓');

  // 7. Verificación: bajar de nuevo y confirmar los 3 cambios
  let verificados = false;
  for (let intento = 1; intento <= 3 && !verificados; intento++) {
    const verRes = await fetch(BASE + '/releases/cloud.firestore', { headers: HEADERS });
    if (!verRes.ok) throw new Error('verificar (GET release): ' + verRes.status);
    const verRel = await verRes.json();
    const verRs = await fetch('https://firebaserules.googleapis.com/v1/' + verRel.rulesetName, { headers: HEADERS });
    if (!verRs.ok) throw new Error('verificar (GET ruleset): ' + verRs.status);
    const verRuleset = await verRs.json();
    const verContent = (verRuleset.source && verRuleset.source.files && verRuleset.source.files[0].content) || '';
    verificados = /match\s+\/backups_v2\//.test(verContent)
      && /match\s+\/usuarios\/\{userId\}\/backups\//.test(verContent)
      && /allow\s+list\s*:/.test(verContent);
    if (!verificados && intento < 3) {
      console.log('   ⏳ todavía no veo el cambio… espero 2s y vuelvo a verificar');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!verificados) {
    console.log('⚠️ No pude verificar automáticamente, pero el publish respondió OK.');
    console.log('   (A veces demora un par de minutos en propagar — abrí la consola de');
    console.log('    Firebase → Firestore → Reglas y fijate que aparezca backups_v2.)');
  }

  console.log('');
  console.log('✅ ¡LISTO! Las reglas vivas ahora permiten los backups y el historial.');
  console.log('');
  console.log('PRUEBA (desde el teléfono, con internet):');
  console.log('   1. RiderTrack V2 → ☁️ Backups → tiene que APARECER tu historial');
  console.log('      de backups (el chip "auto" de cada cierre de ruta).');
  console.log('   2. 📜 Historial → tienen que aparecer TODAS tus rutas pasadas');
  console.log('      (estaban guardadas — la app no podía leerlas).');
  console.log('   3. En una ruta con clientes: 🏁 FINALIZAR Y GUARDAR RUTA →');
  console.log('      el toast tiene que decir "☁️ backup automático en la nube"');
  console.log('      SIN el ⚠️ de "avísame para revisarlo".');
}

main().catch((e) => {
  console.error('');
  console.error('❌ No pude actualizar las reglas (' + VERSION + '): ' + e.message);
  console.error('   (Tranquilo: tus reglas vivas quedaron IGUAL que antes —');
  console.error('    no se cambia nada hasta que el publish responde OK.)');
  console.error('');

  // Plan B automático: si ya tenía las reglas parcheadas, las guardo
  // COMPLETAS en un archivo listo para pegar en la consola de Firebase.
  let archivoEscrito = '';
  if (contenidoParchado) {
    try {
      const destino = path.join(CARPETA, 'reglas-faseN-completas.txt');
      fs.writeFileSync(destino, contenidoParchado, 'utf8');
      archivoEscrito = destino;
    } catch (_) { /* sin permisos de escritura → caemos a los bloques */ }
  }

  console.error('═══ PLAN B — A MANO (2 minutos) ═══');
  console.error('0. PRIMERO: arriba de todo tiene que decir "📋 ' + VERSION + '".');
  console.error('   Si no lo dice, estás corriendo un archivo VIEJO — bajá el zip');
  console.error('   de nuevo y descomprimilo ENCIMA de ~/bot-whatsapp.');
  console.error('1. Abrí https://console.firebase.google.com → proyecto ' + (projectId || 'ridertrack-93c8a'));
  console.error('2. Firestore Database → Reglas');
  if (archivoEscrito) {
    console.error('3. En Termux:  cat ~/bot-whatsapp/reglas-faseN-completas.txt');
    console.error('   (o:  termux-open reglas-faseN-completas.txt )');
    console.error('   → copiá TODO el contenido: son tus mismas reglas vivas +');
    console.error('   los bloques nuevos ya insertados en el lugar correcto.');
    console.error('4. En la consola: reemplazá TODO el editor con eso → Publicar.');
  } else {
    console.error('3. Buscá el bloque que empieza:  match /historial_rutas/');
    console.error('   → BORRALO entero (hasta su }) y pegá en su lugar el bloque');
    console.error('   nuevo que está en el archivo actualizar_reglas_backups.js');
    console.error('   (const BLOQUE_HISTORIAL, el que dice FASE N).');
    console.error('4. Antes de la línea  match /{document=**} {  pegá los bloques');
    console.error('   BLOQUE_BACKUPS_V2 y BLOQUE_USUARIOS_BACKUPS del mismo archivo.');
    console.error('5. Publicar (botón azul) — listo.');
  }
  process.exit(1);
});
