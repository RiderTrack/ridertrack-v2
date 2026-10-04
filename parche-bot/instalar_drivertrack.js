#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// 📦 instalar_drivertrack.js — instalador del parche FASE B
// ═══════════════════════════════════════════════════════════
// Corrélo UNA vez en Termux, en la carpeta del bot:
//
//   cd ~/bot-whatsapp
//   node instalar_drivertrack.js
//   pm2 restart rudy-bot
//   pm2 logs rudy-bot --lines 20
//      → debe decir "🏍️ [DT] Parche activo (drivertrack_bot.js v1.0…)"
//
// Qué hace:
//   1. Verifica que drivertrack_bot.js esté en la carpeta
//   2. Respalda index.js → index.js.bak-drivertrack
//   3. Agrega 2 líneas (require + arranque) con ANCLAS EXACTAS
//      sobre el index.js real (método probado de los parches
//      anteriores: si el ancla no aparece, AVISA y no toca nada)
//   4. Verifica la sintaxis con node --check ANTES de guardar
//   5. Si algo falla → restaura el respaldo solo
//
// Es IDEMPOTENTE: si ya está instalado, lo detecta y no duplica.
// Es REVERSIBLE: cp index.js.bak-drivertrack index.js y listo.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CARPETA = __dirname;
const INDEX = path.join(CARPETA, 'index.js');
const PARCHE = path.join(CARPETA, 'drivertrack_bot.js');
const RESPALDO = path.join(CARPETA, 'index.js.bak-drivertrack');

// ── 1. El parche tiene que estar al lado ──
if (!fs.existsSync(PARCHE)) {
  console.error('❌ No encuentro drivertrack_bot.js en ' + CARPETA);
  console.error('   Copialo a la MISMA carpeta donde está index.js y volvé a correr este script.');
  process.exit(1);
}
if (!fs.existsSync(INDEX)) {
  console.error('❌ No encuentro index.js en ' + CARPETA + ' — ¿estás en ~/bot-whatsapp?');
  process.exit(1);
}

let src = fs.readFileSync(INDEX, 'utf8');

// ── 2. ¿Ya está instalado? (idempotente) ──
if (src.includes("require('./drivertrack_bot')") || src.includes('require("./drivertrack_bot")')) {
  console.log('✅ El parche DriverTrack YA está instalado en index.js — nada que hacer.');
  console.log('   Si algo no funciona: pm2 logs rudy-bot --lines 30');
  process.exit(0);
}

// ── 3. Respaldo ──
fs.writeFileSync(RESPALDO, src);
console.log('💾 Respaldo: index.js.bak-drivertrack');

// ── 4. ANCLA A: el require (después del require de acciones_extra) ──
const ANCLA_REQ = 'const { iniciarListenerAccionesExtra } = require("./acciones_extra");';
let insertadoReq = false;
if (src.includes(ANCLA_REQ)) {
  src = src.replace(
    ANCLA_REQ,
    ANCLA_REQ + '\n// FASE B: 🏍️ acciones de inDrive (sección DriverTrack de la app)\nconst { iniciarDrivertrackBot } = require("./drivertrack_bot");'
  );
  insertadoReq = true;
} else {
  // respaldo: después del require de grupo_mate
  const ANCLA_REQ2 = 'const { iniciarListenerGrupoMate } = require("./grupo_mate");';
  if (src.includes(ANCLA_REQ2)) {
    src = src.replace(
      ANCLA_REQ2,
      ANCLA_REQ2 + '\n// FASE B: 🏍️ acciones de inDrive (sección DriverTrack de la app)\nconst { iniciarDrivertrackBot } = require("./drivertrack_bot");'
    );
    insertadoReq = true;
  }
}
if (!insertadoReq) {
  console.error('❌ No encontré el ancla del require (acciones_extra / grupo_mate).');
  console.error('   No toqué nada. Mandale este error al asistente para un ancla nueva.');
  process.exit(1);
}
console.log('🪝 Require agregado (después de acciones_extra)');

// ── 5. ANCLA B: el arranque (en la cadena de iniciarListener…(sock)) ──
const ANCLA_BOOT = 'iniciarListenerAccionesExtra(sock);';
let insertadoBoot = false;
if (src.includes(ANCLA_BOOT)) {
  src = src.replace(ANCLA_BOOT, ANCLA_BOOT + ' iniciarDrivertrackBot(sock);');
  insertadoBoot = true;
} else {
  // respaldo: después del arranque del grupo
  const ANCLA_BOOT2 = 'iniciarListenerGrupoMate(sock);';
  if (src.includes(ANCLA_BOOT2)) {
    src = src.replace(ANCLA_BOOT2, ANCLA_BOOT2 + ' iniciarDrivertrackBot(sock);');
    insertadoBoot = true;
  }
}
if (!insertadoBoot) {
  console.error('❌ No encontré el ancla de arranque (iniciarListenerAccionesExtra(sock)).');
  console.error('   Restauro el respaldo y no toqué nada.');
  fs.writeFileSync(INDEX, fs.readFileSync(RESPALDO));
  process.exit(1);
}
console.log('🪝 Arranque agregado (en la cadena de listeners del sock)');

// ── 6. Verificar sintaxis ANTES de guardar ──
fs.writeFileSync(INDEX, src);
try {
  execSync('node --check ' + JSON.stringify(INDEX), { stdio: 'pipe' });
  console.log('🧪 Sintaxis verificada (node --check) ✓');
} catch (e) {
  console.error('❌ node --check falló — restauro el respaldo:');
  console.error(String(e.stderr || e.message).slice(0, 500));
  fs.writeFileSync(INDEX, fs.readFileSync(RESPALDO));
  process.exit(1);
}

// ── 7. Listo ──
console.log('');
console.log('✅ ¡Parche DriverTrack (FASE B) instalado!');
console.log('');
console.log('⚠️  FALTA UN PASO (las reglas de Firestore):');
console.log('   Las reglas vivas de tu Firebase no conocen la colección');
console.log('   acciones_dt → la app no podría encolar los mensajes.');
console.log('   Corré también:');
console.log('');
console.log('   node actualizar_reglas.js');
console.log('');
console.log('(usa el serviceAccount del bot, agrega SOLO el bloque de');
console.log(' acciones_dt y verifica — si no puede, te da los pasos');
console.log(' manuales para la consola de Firebase)');
console.log('');
console.log('Después reiniciá el bot:');
console.log('   pm2 restart rudy-bot');
console.log('   pm2 logs rudy-bot --lines 20');
console.log('');
console.log('Tenés que ver: 🏍️ [DT] Parche activo — escuchando acciones_dt (inDrive)');
console.log('');
console.log('PRUEBA REAL (desde el teléfono):');
console.log('   RiderTrack V2 → inDrive (Libre) → Ajustes → 🤖 Robot →');
console.log('   "Mandarme prueba" → te llega el mensaje a tu WhatsApp 📲');
console.log('');
console.log('Para desinstalar: cp index.js.bak-drivertrack index.js && pm2 restart rudy-bot');
