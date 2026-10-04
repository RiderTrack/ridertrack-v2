#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// 🔐 actualizar_reglas.js — publica las reglas de inDrive
//            (acciones_dt + imagenes_dt · FASE B y B2)
// ═══════════════════════════════════════════════════════════
// ¿POR QUÉ EXISTE ESTE SCRIPT? Las reglas de Firestore VIVAS (las
// de la consola de Firebase) no incluyen las colecciones nuevas
// de inDrive → la app recibe PERMISSION_DENIED:
//   · acciones_dt  → la cola de mensajes del robot (FASE B)
//   · imagenes_dt  → las imágenes de los avisos (FASE B2)
//
// Este script usa el serviceAccount.json DEL PROPIO BOT (mismo
// proyecto ridertrack-93c8a) para:
//   1. BAJAR las reglas vivas actuales (API de Firebase Rules)
//   2. Insertar SOLO los bloques que falten (quirúrgico — no
//      toca absolutamente nada más de tus reglas)
//   3. Publicar la versión nueva
//   4. Verificar que quedó
//
// Es IDEMPOTENTE: podés correrlo las veces que quieras — si un
// bloque ya está, lo salta; si falta, lo agrega.
//
// Corrélo en Termux, en la carpeta del bot:
//   cd ~/bot-whatsapp
//   node actualizar_reglas.js
//
// Si falla (permisos del serviceAccount, sin internet, etc.),
// te imprime los pasos manuales de la consola de Firebase —
// nada se rompe en el intento.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const CARPETA = __dirname;
const SA_PATH = path.join(CARPETA, 'serviceAccount.json');

if (!fs.existsSync(SA_PATH)) {
  console.error('❌ No encuentro serviceAccount.json en ' + CARPETA);
  console.error('   (Tiene que estar en la carpeta del bot — es el que ya usa rudy-bot)');
  process.exit(1);
}

// ── Bloque 1: cola de acciones del robot (FASE B) ──
const BLOQUE_ACCIONES = `    // FASE B: acciones del robot para DriverTrack (inDrive) — cola
    // separada de acciones_bot; las lee el parche drivertrack_bot.js
    match /acciones_dt/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;

      match /pendientes/{pendId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
    }
`;

// ── Bloque 2: imágenes de los avisos (FASE B2) ──
// Doc id = tipo de aviso (camino / llegando / llegada / entregado /
// ubicacion) — cualquier rider logueado puede subir la suya; el bot
// lee con firebase-admin (pasa por encima de las reglas).
const BLOQUE_IMAGENES = `    // FASE B2: imágenes de los avisos de inDrive — la app sube la
    // imagen a Storage (campanas/imagenes_dt/…) y registra la URL acá;
    // el bot la baja con fetch al momento del envío
    match /imagenes_dt/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
`;

// ── Bloque 3: sync de datos de inDrive entre celulares (FASE C) ──
// UN doc por rider (dt_sync/{uid}) con viajes + gastos + ajustes:
// lo que guardás en un cel se ve en cualquiera con la misma cuenta.
const BLOQUE_SYNC = `    // FASE C: sync de los datos de inDrive (viajes, gastos,
    // ajustes) — UN doc por rider con todo su data para verlo en
    // cualquier cel con la misma cuenta. Solo el dueño entra.
    match /dt_sync/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
`;

// [marca, bloque, nombre] — se insertan solo los que falten
const BLOQUES = [
  ['acciones_dt', BLOQUE_ACCIONES, 'acciones_dt (mensajes del robot)'],
  ['imagenes_dt', BLOQUE_IMAGENES, 'imagenes_dt (imágenes de los avisos)'],
  ['dt_sync', BLOQUE_SYNC, 'dt_sync (sync de datos entre cels)'],
];

async function main() {
  // 1. Token OAuth del serviceAccount (firebase-admin ya está instalado)
  const { cert } = require('firebase-admin/app');
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  const projectId = sa.project_id;
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

  // 3. ¿Qué bloques faltan? (idempotente, uno por uno)
  const faltantes = BLOQUES.filter(([marca]) => !contenido.includes(marca));
  if (faltantes.length === 0) {
    console.log('✅ Las reglas VIVAS ya tienen todo (acciones_dt + imagenes_dt) — nada que hacer.');
    return;
  }
  faltantes.forEach(([, , nombre]) => console.log('🩹 Falta: ' + nombre));

  // 4. Inserción QUIRÚRGICA: antes del deny-all (match /{document=**}).
  //    Si no existe el deny-all, al final del archivo.
  let nuevo = contenido;
  const insercion = faltantes.map(([, bloque]) => bloque).join('\n');
  const anclaDeny = nuevo.search(/match\s*\/\{document=\*\*\}/);
  if (anclaDeny !== -1) {
    // subir hasta el inicio del comentario/línea que contiene el match
    const inicioLinea = nuevo.lastIndexOf('\n', anclaDeny) + 1;
    nuevo = nuevo.slice(0, inicioLinea) + insercion + '\n' + nuevo.slice(inicioLinea);
  } else {
    nuevo = nuevo.trimEnd() + '\n\n' + insercion;
  }
  console.log('🩹 Insertando ' + faltantes.length + ' bloque(s) (antes del deny-all)…');

  // 5. Crear el ruleset nuevo
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

  // 6. Publicar (release)
  const pubRes = await fetch(BASE + '/releases/cloud.firestore', {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ rulesetName: nuevoRuleset.name }),
  });
  if (!pubRes.ok) {
    const detalle = (await pubRes.text()).slice(0, 400);
    throw new Error('publicar release: ' + pubRes.status + ' — ' + detalle);
  }
  console.log('🚀 Reglas publicadas ✓');

  // 7. Verificación: bajar de nuevo y confirmar cada bloque
  const verRes = await fetch(BASE + '/releases/cloud.firestore', { headers: HEADERS });
  const verRel = await verRes.json();
  const verRs = await fetch('https://firebaserules.googleapis.com/v1/' + verRel.rulesetName, { headers: HEADERS });
  const verRuleset = await verRs.json();
  const verContent = verRuleset.source.files[0].content || '';
  const faltanTodavia = BLOQUES.filter(([marca]) => !verContent.includes(marca));
  if (faltanTodavia.length) throw new Error('la verificación no encontró: ' + faltanTodavia.map(b => b[0]).join(', '));

  console.log('');
  console.log('✅ ¡LISTO! Las reglas vivas ahora permiten los bloques de inDrive.');
  console.log('   La app ya puede encolar los mensajes, subir las imágenes y');
  console.log('   sincronizar tus viajes/gastos/ajustes entre celulares (dt_sync).');
  console.log('');
  console.log('PRUEBA (desde el teléfono): RiderTrack V2 → inDrive → Ajustes →');
  console.log('   🤖 Robot WhatsApp → "Mandarme prueba" → te llega a tu WhatsApp 📲');
  console.log('   🖼️ Imágenes del robot → subí una imagen y mandale un aviso a');
  console.log('   alguien de prueba — tiene que llegar CON la imagen.');
}

main().catch((e) => {
  console.error('');
  console.error('❌ No pude actualizar las reglas: ' + e.message);
  console.error('');
  console.error('═══ PLAN B — A MANO (2 minutos) ═══');
  console.error('1. Abrí https://console.firebase.google.com → proyecto ' + (projectId || 'ridertrack-93c8a'));
  console.error('2. Firestore Database → Reglas');
  console.error('3. Buscá el bloque que dice:  match /acciones_bot/{userId} {');
  console.error('4. Justo DEBAJO de su llave de cierre }, pegá estos bloques:');
  console.error('');
  BLOQUES.forEach(([, bloque]) => console.error(bloque));
  console.error('5. Publicar (botón azul) — listo.');
  process.exit(1);
});
