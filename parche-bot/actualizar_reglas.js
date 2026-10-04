#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// 🔐 actualizar_reglas.js — publica la regla de acciones_dt (FASE B)
// ═══════════════════════════════════════════════════════════
// ¿POR QUÉ EXISTE ESTE SCRIPT? Las reglas de Firestore VIVAS (las
// de la consola de Firebase) no incluyen la colección nueva
// acciones_dt → la app no puede encolar los mensajes de inDrive
// (PERMISSION_DENIED). Verificado en prueba real.
//
// Este script usa el serviceAccount.json DEL PROPIO BOT (mismo
// proyecto ridertrack-93c8a) para:
//   1. BAJAR las reglas vivas actuales (API de Firebase Rules)
//   2. Insertar SOLO el bloque de acciones_dt (quirúrgico — no
//      toca absolutamente nada más de tus reglas)
//   3. Publicar la versión nueva
//   4. Verificar que quedó
//
// Corrélo UNA VEZ en Termux, en la carpeta del bot:
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

// ── El bloque a insertar (idéntico al firestore.rules del repo) ──
const BLOQUE_DT = `    // FASE B: acciones del robot para DriverTrack (inDrive) — cola
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

  // 3. ¿Ya está la colección? (idempotente)
  if (contenido.includes('acciones_dt')) {
    console.log('✅ Las reglas VIVAS ya tienen acciones_dt — nada que hacer.');
    return;
  }

  // 4. Inserción QUIRÚRGICA: antes del deny-all (match /{document=**}).
  //    Si no existe el deny-all, al final del archivo.
  let nuevo;
  const anclaDeny = contenido.search(/match\s*\/\{document=\*\*\}/);
  if (anclaDeny !== -1) {
    // subir hasta el inicio del comentario/línea que contiene el match
    const inicioLinea = contenido.lastIndexOf('\n', anclaDeny) + 1;
    nuevo = contenido.slice(0, inicioLinea) + BLOQUE_DT + '\n' + contenido.slice(inicioLinea);
  } else {
    nuevo = contenido.trimEnd() + '\n\n' + BLOQUE_DT;
  }
  console.log('🩹 Insertando el bloque acciones_dt (antes del deny-all)…');

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

  // 7. Verificación: bajar de nuevo y confirmar
  const verRes = await fetch(BASE + '/releases/cloud.firestore', { headers: HEADERS });
  const verRel = await verRes.json();
  const verRs = await fetch('https://firebaserules.googleapis.com/v1/' + verRel.rulesetName, { headers: HEADERS });
  const verRuleset = await verRs.json();
  const verificado = (verRuleset.source.files[0].content || '').includes('acciones_dt');
  if (!verificado) throw new Error('la verificación no encontró acciones_dt tras publicar');

  console.log('');
  console.log('✅ ¡LISTO! Las reglas vivas ahora permiten acciones_dt.');
  console.log('   La app ya puede encolar los mensajes de inDrive.');
  console.log('');
  console.log('PRUEBA (desde el teléfono): RiderTrack V2 → inDrive → Ajustes →');
  console.log('   🤖 Robot WhatsApp → "Mandarme prueba" → te llega a tu WhatsApp 📲');
}

main().catch((e) => {
  console.error('');
  console.error('❌ No pude actualizar las reglas: ' + e.message);
  console.error('');
  console.error('═══ PLAN B — A MANO (2 minutos) ═══');
  console.error('1. Abrí https://console.firebase.google.com → proyecto ' + (projectId || 'ridertrack-93c8a'));
  console.error('2. Firestore Database → Reglas');
  console.error('3. Buscá el bloque que dice:  match /acciones_bot/{userId} {');
  console.error('4. Justo DEBAJO de su llave de cierre }, pegá este bloque:');
  console.error('');
  console.error(BLOQUE_DT);
  console.error('5. Publicar (botón azul) — listo.');
  process.exit(1);
});
