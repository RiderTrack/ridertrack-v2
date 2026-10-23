#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// 🔐 actualizar_reglas.js — v5 (FASE AL · v0.11.11)
//
// ¿QUÉ ARREGLA? Las reglas de Firestore VIVAS están denegando 5
// colecciones que la app SÍ usa (el deny-all se come todo lo que
// no tiene bloque propio):
//   · imagenes_bot        → subir/cambiar la imagen de los avisos del
//                           bot moría con «Missing or insufficient
//                           permissions» y la pestaña 🖼️ Imágenes del
//                           Control Bot salía VACÍA.
//   · catalogo_productos  → la sección 🛍️ Catálogo salía vacía.
//   · configuracion       → config de la tienda del Catálogo.
//   · presencia_watch / presencia_chat → el «en línea…» del chat.
// Además trae los bloques de siempre por si faltaran (estado_bot,
// acciones_dt, imagenes_dt, dt_sync — no toca lo que ya está).
//
// Sigue siendo QUIRÚRGICO e IDEMPOTENTE: baja las reglas vivas,
// agrega SOLO los bloques que falten, publica y verifica. Si ya
// está todo, no toca nada. Corrélo las veces que quieras.
//
// En Termux, en la carpeta del bot:
//   cd ~/bot-whatsapp
//   node actualizar_reglas_v5.js
// ═══════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const CARPETA = __dirname;
const SA_PATH = path.join(CARPETA, 'serviceAccount.json');

let projectId = '';
let contenidoParchado = '';

if (!fs.existsSync(SA_PATH)) {
  console.error('❌ No encuentro serviceAccount.json en ' + CARPETA);
  console.error('   (Tiene que estar en la carpeta del bot — es el que ya usa rudy-bot)');
  process.exit(1);
}

// ── Bloques NUEVOS v5 (los 5 que faltan) ──
const BLOQUE_IMAGENES_BOT = `    // 🖼️ FASE AL (v0.11.11): imágenes de los mensajes del bot — la app
    // sube la foto a Storage (campanas/imagenes_bot/...) y registra la
    // URL acá (doc id = tipo de aviso); el bot la baja con firebase-admin
    // (las reglas NO lo frenan). Sin este bloque el upload moría con
    // «Missing or insufficient permissions» y la pestaña salía VACÍA.
    match /imagenes_bot/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
`;

const BLOQUE_CATALOGO = `    // 🛒 FASE AL (v0.11.11): catálogo de productos (sección Catálogo)
    match /catalogo_productos/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
`;

const BLOQUE_CONFIG_TIENDA = `    // 🏪 FASE AL (v0.11.11): configuración de la tienda del Catálogo
    match /configuracion/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
`;

const BLOQUE_PRESENCIA_WATCH = `    // 👀 FASE AL (v0.11.11): presencia del chat — la app escribe
    // presence_watch/{uidBot} y lee presencia_chat/{tel}
    match /presencia_watch/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
`;

const BLOQUE_PRESENCIA_CHAT = `    match /presencia_chat/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
`;

// ── Bloques de siempre (v4/FASE N) — se saltan solos si ya están ──
const BLOQUE_ESTADO_BOT = `    // 🩺 bot v3+: latido del bot (🟢/🔴 en Configuración)
    match /estado_bot/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
`;

const BLOQUE_ACCIONES_DT = `    // FASE B: acciones del robot de inDrive — cola separada
    match /acciones_dt/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;

      match /pendientes/{pendId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
    }
`;

const BLOQUE_IMAGENES_DT = `    // FASE B2: imágenes de los avisos de inDrive
    match /imagenes_dt/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
`;

const BLOQUE_DT_SYNC = `    // FASE C: sync de los datos de inDrive entre cels
    match /dt_sync/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
`;

// [marca, bloque, nombre] — la marca es la RUTA del match: usar
// solo el nombre de la colección daba falsos positivos con
// comentarios viejos de las reglas (ej.: «acciones_bot /
// imagenes_bot quedan intactas» en la línea 163 de las vivas).
const BLOQUES = [
  ['match /imagenes_bot/', BLOQUE_IMAGENES_BOT, 'imagenes_bot (subir/ver imágenes del bot) 🖼️'],
  ['match /catalogo_productos/', BLOQUE_CATALOGO, 'catalogo_productos (sección Catálogo) 🛒'],
  ['match /configuracion/', BLOQUE_CONFIG_TIENDA, 'configuracion (tienda del Catálogo) 🏪'],
  ['match /presencia_watch/', BLOQUE_PRESENCIA_WATCH, 'presencia_watch (chat «en línea») 👀'],
  ['match /presencia_chat/', BLOQUE_PRESENCIA_CHAT, 'presencia_chat (chat «en línea») 👀'],
  ['match /estado_bot/', BLOQUE_ESTADO_BOT, 'estado_bot (latido del bot) 🩺'],
  ['match /acciones_dt/', BLOQUE_ACCIONES_DT, 'acciones_dt (mensajes del robot de inDrive)'],
  ['match /imagenes_dt/', BLOQUE_IMAGENES_DT, 'imagenes_dt (imágenes de los avisos)'],
  ['match /dt_sync/', BLOQUE_DT_SYNC, 'dt_sync (sync de datos entre cels)'],
];

const VERSION = 'v5 (FASE AL — imágenes del bot + catálogo + presencia)';

async function main() {
  console.log('📋 actualizar_reglas_v5.js ' + VERSION);

  // 1. Token OAuth del serviceAccount
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

  // 2. Reglas vivas actuales
  console.log('⬇️ Bajando las reglas vivas…');
  const relRes = await fetch(BASE + '/releases/cloud.firestore', { headers: HEADERS });
  if (!relRes.ok) throw new Error('GET release: ' + relRes.status + ' ' + (await relRes.text()).slice(0, 200));
  const release = await relRes.json();
  const rulesetName = release.rulesetName;
  console.log('   release actual: ' + rulesetName);

  const rsRes = await fetch('https://firebaserules.googleapis.com/v1/' + rulesetName, { headers: HEADERS });
  if (!rsRes.ok) throw new Error('GET ruleset: ' + rsRes.status);
  const ruleset = await rsRes.json();
  const archivo = (ruleset.source && ruleset.source.files && ruleset.source.files[0]) || null;
  if (!archivo || !archivo.content) throw new Error('el ruleset no tiene contenido legible');
  let contenido = archivo.content;
  console.log('   reglas vivas: ' + contenido.length + ' caracteres ✓');

  // 3. ¿Qué bloques faltan?
  const faltantes = BLOQUES.filter(([marca]) => !contenido.includes(marca));
  if (faltantes.length === 0) {
    console.log('✅ Las reglas VIVAS ya tienen todo — nada que hacer.');
    console.log('   Las imágenes del bot y el Catálogo ya están permitidos.');
    return;
  }
  faltantes.forEach(([, , nombre]) => console.log('🩹 Falta: ' + nombre));

  // 4. Inserción quirúrgica antes del deny-all
  let nuevo = contenido;
  const insercion = faltantes.map(([, bloque]) => bloque).join('\n');
  const anclaDeny = nuevo.search(/match\s*\/\{document=\*\*\}/);
  if (anclaDeny !== -1) {
    const inicioLinea = nuevo.lastIndexOf('\n', anclaDeny) + 1;
    nuevo = nuevo.slice(0, inicioLinea) + insercion + '\n' + nuevo.slice(inicioLinea);
  } else {
    // sin deny-all: insertar antes de la última llave de cierre
    const idx = nuevo.lastIndexOf('}');
    const idx2 = nuevo.lastIndexOf('}', idx - 1);
    nuevo = nuevo.slice(0, idx2) + insercion + '\n' + nuevo.slice(idx2);
  }
  console.log('🩹 Insertando ' + faltantes.length + ' bloque(s)…');
  contenidoParchado = nuevo;

  // 5. Crear el ruleset nuevo (valida la sintaxis)
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

  // 6. Publicar (cadena de reintentos — formato del CLI oficial)
  const releaseName = 'projects/' + projectId + '/releases/cloud.firestore';
  const intentos = [
    [
      'PATCH (formato del CLI oficial)',
      'PATCH',
      BASE + '/releases/cloud.firestore',
      { release: { name: releaseName, rulesetName: nuevoRuleset.name } },
    ],
    [
      'PATCH (envuelto + updateMask)',
      'PATCH',
      BASE + '/releases/cloud.firestore',
      {
        release: { name: releaseName, rulesetName: nuevoRuleset.name },
        updateMask: 'rulesetName',
      },
    ],
    [
      'POST crear release (createRelease del CLI)',
      'POST',
      BASE + '/releases',
      { name: releaseName, rulesetName: nuevoRuleset.name },
    ],
  ];
  let publicado = false;
  let detalleFalla = '';
  for (const [etiqueta, metodo, url, cuerpo] of intentos) {
    const res = await fetch(url, {
      method: metodo,
      headers: HEADERS,
      body: JSON.stringify(cuerpo),
    });
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

  // 7. Verificación (hasta 3 intentos)
  let verificados = false;
  for (let intento = 1; intento <= 3 && !verificados; intento++) {
    const verRes = await fetch(BASE + '/releases/cloud.firestore', { headers: HEADERS });
    if (!verRes.ok) throw new Error('verificar (GET release): ' + verRes.status);
    const verRel = await verRes.json();
    const verRs = await fetch('https://firebaserules.googleapis.com/v1/' + verRel.rulesetName, { headers: HEADERS });
    if (!verRs.ok) throw new Error('verificar (GET ruleset): ' + verRs.status);
    const verRuleset = await verRs.json();
    const verContent = (verRuleset.source && verRuleset.source.files && verRuleset.source.files[0].content) || '';
    verificados = BLOQUES.every(([marca]) => verContent.includes(marca));
    if (!verificados && intento < 3) {
      console.log('   ⏳ todavía no veo el cambio… espero 2s y vuelvo a verificar');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!verificados) {
    console.log('⚠️ No pude verificar automáticamente, pero el publish respondió OK.');
    console.log('   (A veces demora un par de minutos en propagar.)');
  }

  console.log('');
  console.log('✅ ¡LISTO! Las reglas vivas ya permiten:');
  console.log('   🖼️ Subir y ver las imágenes del bot (Control Bot → Imágenes)');
  console.log('   🛒 El Catálogo y la config de la tienda');
  console.log('   👀 La presencia del chat');
  console.log('');
  console.log('   Si tenías la app abierta, cerrala y abrila de nuevo.');
}

main().catch((e) => {
  console.error('');
  console.error('❌ No pude actualizar las reglas (' + VERSION + '): ' + e.message);
  console.error('   (Tranquilo: tus reglas vivas quedaron IGUAL que antes —');
  console.error('    no se cambia nada hasta que el publish responde OK.)');
  console.error('');

  let archivoEscrito = '';
  if (contenidoParchado) {
    try {
      const destino = path.join(CARPETA, 'reglas-nuevas-completas.txt');
      fs.writeFileSync(destino, contenidoParchado, 'utf8');
      archivoEscrito = destino;
    } catch (_) {}
  }

  console.error('═══ PLAN B — A MANO (2 minutos) ═══');
  console.error('0. PRIMERO: arriba de todo tiene que decir "📋 actualizar_reglas_v5.js ' + VERSION + '".');
  console.error('   Si no lo dice, estás corriendo un archivo VIEJO.');
  console.error('1. Abrí https://console.firebase.google.com → proyecto ' + (projectId || 'ridertrack-93c8a'));
  console.error('2. Firestore Database → Reglas');
  if (archivoEscrito) {
    console.error('3. En Termux:  cat ~/bot-whatsapp/reglas-nuevas-completas.txt');
    console.error('   → copiá TODO el contenido y reemplazá el editor con eso → Publicar.');
  } else {
    console.error('3. Justo ANTES de la línea  match /{document=**} {  pegá los bloques');
    console.error('   de imagenes_bot, catalogo_productos, configuracion, presencia_watch');
    console.error('   y presencia_chat (read/write: request.auth != null) → Publicar.');
  }
  process.exit(1);
});
