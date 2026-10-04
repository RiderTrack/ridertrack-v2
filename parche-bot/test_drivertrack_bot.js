// ═══════════════════════════════════════════════════════════
// 🧪 test_drivertrack_bot.js — prueba del parche con MOCKS
// Simula firebase-admin + campanas_bot + sock de Baileys y
// verifica que el handler procese bien las acciones dt_*.
// Correr: node test_drivertrack_bot.js
// ═══════════════════════════════════════════════════════════
const path = require('path');
const assert = require('assert');

// ── MOCK de firebase-admin/firestore ──
const updates = []; // qué se escribió en los docs
const docsPendientes = [];
let snapshotCallback = null;

class MockDocRef {
  constructor(id) { this.id = id; }
  async update(data) { updates.push({ id: this.id, ...data }); }
}
class MockDocSnap {
  constructor(id, data) { this.id = id; this._data = data; }
  get data() { return () => this._data; }
  get ref() { return new MockDocRef(this.id); }
}

const mockFirestore = {
  collection: () => ({
    doc: () => ({
      collection: () => ({
        where: () => ({
          onSnapshot: (cb) => {
            snapshotCallback = cb;
            return () => {};
          },
        }),
      }),
    }),
  }),
};

// ── MOCK de campanas_bot.js (resolverJid) ──
let resolverJidFails = false;
const mockCampanas = {
  resolverJid: async (cel) => {
    if (resolverJidFails) throw new Error('sin red');
    return cel === '51987654321' ? '51987654321@s.whatsapp.net' : cel + '@s.whatsapp.net';
  },
};

// ── MOCK del sock de Baileys ──
const mensajesEnviados = [];
const mockSock = {
  user: { id: 'bot' },
  sendMessage: async (jid, content) => {
    mensajesEnviados.push({ jid, content });
    return { key: { id: 'msg-' + mensajesEnviados.length } };
  },
};

// ── MOCK de fetch (FASE B2: bajar la imagen del aviso de la nube) ──
// URL con "ok" → baja una imagen falsa; URL con "fail" → rechaza
const fetchCalls = [];
global.fetch = async (url) => {
  fetchCalls.push(String(url));
  if (String(url).includes('fail')) throw new Error('sin conexión a Storage');
  if (String(url).includes('404')) {
    return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
  }
  return { ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer };
};

// ── Inyectar los mocks en el cache de require ──
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'firebase-admin/firestore') return 'mock:firebase-admin/firestore';
  if (request === './firebase') return 'mock:firebase';
  if (request === './campanas_bot.js') return 'mock:campanas';
  return originalResolve.call(this, request, ...args);
};
require.cache['mock:firebase-admin/firestore'] = { id: 'mock:firebase-admin/firestore', filename: 'mock:firebase-admin/firestore', loaded: true, exports: { getFirestore: () => mockFirestore } };
require.cache['mock:firebase'] = { id: 'mock:firebase', filename: 'mock:firebase', loaded: true, exports: { getUidRudy: () => 'UID-TEST' } };
require.cache['mock:campanas'] = { id: 'mock:campanas', filename: 'mock:campanas', loaded: true, exports: mockCampanas };

// ── Cargar el parche real ──
const { iniciarDrivertrackBot } = require(path.join(__dirname, 'drivertrack_bot.js'));

// ── Helper: simular que llega un doc nuevo ──
function simularDoc(id, datos) {
  assert(snapshotCallback, 'el listener no arrancó');
  snapshotCallback({
    docChanges: () => [{ type: 'added', doc: new MockDocSnap(id, datos) }],
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('🧪 Test 1: arranque del parche');
  iniciarDrivertrackBot(mockSock);
  console.log('   ✓ parche iniciado sin crashear');

  console.log('🧪 Test 2: dt_aviso (texto solo) — voy en camino');
  simularDoc('doc-aviso', {
    tipo: 'dt_aviso',
    telefono: '51987654321',
    texto: '📍 ¡Voy en camino! 🛵',
    nombre: 'Cliente Test',
    createdAt: new Date().toISOString(),
  });
  await sleep(200);
  assert(mensajesEnviados.length === 1, 'debía mandar 1 mensaje');
  assert(mensajesEnviados[0].jid === '51987654321@s.whatsapp.net', 'JID resuelto mal');
  assert(mensajesEnviados[0].content.text.includes('Voy en camino'), 'texto incorrecto');
  console.log('   ✓ enviado al JID correcto con el texto correcto');

  console.log('🧪 Test 3: dt_cobro CON imagen QR');
  const qrMini = 'data:image/jpeg;base64,' + Buffer.from('jpeg-falso-qr').toString('base64');
  simularDoc('doc-cobro', {
    tipo: 'dt_cobro',
    telefono: '987654321', // 9 dígitos → normaliza a 51…
    texto: '💜 Cobro S/ 12.50',
    imagenBase64: qrMini,
    createdAt: new Date().toISOString(),
  });
  await sleep(200);
  assert(mensajesEnviados.length === 2, 'debía mandar el 2do mensaje');
  const cobro = mensajesEnviados[1];
  assert(cobro.jid === '51987654321@s.whatsapp.net', 'normalización 9→51 falló: ' + cobro.jid);
  assert(cobro.content.image && cobro.content.caption.includes('12.50'), 'imagen+caption mal');
  assert(Buffer.isBuffer(cobro.content.image), 'la imagen debe ser Buffer');
  console.log('   ✓ imagen QR como Buffer + caption con el monto');

  console.log('🧪 Test 4: docs marcados processed con resultado');
  assert(updates.length >= 2, 'debía actualizar los 2 docs');
  assert(updates.some(u => u.id === 'doc-aviso' && u.resultado === 'enviado' && u.processed === true), 'doc-aviso mal marcado');
  assert(updates.some(u => u.id === 'doc-cobro' && u.resultado === 'enviado'), 'doc-cobro mal marcado');
  console.log('   ✓ ambos docs: resultado=enviado, processed=true');

  console.log('🧪 Test 5: anti-reenvío (el mismo doc NO se reenvía)');
  simularDoc('doc-aviso', { tipo: 'dt_aviso', telefono: '51987654321', texto: 'x', createdAt: new Date().toISOString() });
  await sleep(150);
  assert(mensajesEnviados.length === 2, 'reenvió el doc (bug anti-reenvío)');
  console.log('   ✓ no se reenvía');

  console.log('🧪 Test 6: doc VIEJO (>10 min) → vencido, no se envía');
  const viejo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  simularDoc('doc-viejo', { tipo: 'dt_aviso', telefono: '51987654321', texto: 'viejo', createdAt: viejo });
  await sleep(150);
  assert(mensajesEnviados.length === 2, 'envió el doc viejo');
  assert(updates.some(u => u.id === 'doc-viejo' && u.resultado === 'vencido'), 'doc viejo mal marcado');
  console.log('   ✓ marcado vencido sin enviar');

  console.log('🧪 Test 7: tipo ajeno (acciones del trabajo) → ignorado');
  simularDoc('doc-trabajo', { tipo: 'enviar_yape', telefono: '51987654321', texto: 'x', createdAt: new Date().toISOString() });
  await sleep(150);
  assert(mensajesEnviados.length === 2, 'procesó un tipo del trabajo (bug)');
  console.log('   ✓ tipos de acciones_bot ignorados');

  console.log('🧪 Test 8: celular inválido → error registrado, no crashea');
  simularDoc('doc-malo', { tipo: 'dt_aviso', telefono: '123', texto: 'x', createdAt: new Date().toISOString() });
  await sleep(150);
  assert(mensajesEnviados.length === 2, 'intentó enviar con celular inválido');
  assert(updates.some(u => u.id === 'doc-malo' && u.resultado === 'error'), 'doc-malo mal marcado');
  console.log('   ✓ error registrado en el doc sin crashear');

  console.log('🧪 Test 9: resolverJid cae → respaldo @s.whatsapp.net');
  resolverJidFails = true;
  simularDoc('doc-respaldo', { tipo: 'dt_prueba', telefono: '51912345678', texto: 'prueba', createdAt: new Date().toISOString() });
  await sleep(200);
  resolverJidFails = false;
  assert(mensajesEnviados.length === 3, 'no envió con el respaldo');
  assert(mensajesEnviados[2].jid === '51912345678@s.whatsapp.net', 'respaldo JID mal');
  console.log('   ✓ respaldo clásico cuando resolverJid falla');

  console.log('🧪 Test 10 (B2): dt_aviso con imagenUrl → IMAGEN bajada + caption');
  simularDoc('doc-imagen', {
    tipo: 'dt_aviso',
    telefono: '51987654321',
    texto: '⏱️ ¡Estoy llegando en 10 minutos! 🛵',
    imagenUrl: 'https://storage.ok/imagenes_dt/llegando_123.jpg',
    minutos: 10,
    createdAt: new Date().toISOString(),
  });
  await sleep(250);
  assert(mensajesEnviados.length === 4, 'no mandó el aviso con imagen');
  const conImg = mensajesEnviados[3];
  assert(conImg.content.image && Buffer.isBuffer(conImg.content.image), 'la imagen no llegó como Buffer');
  assert(conImg.content.caption.includes('10 minutos'), 'caption sin los minutos');
  assert(fetchCalls.some(u => u.includes('storage.ok')), 'no llamó a fetch con la URL');
  assert(updates.some(u => u.id === 'doc-imagen' && u.resultado === 'enviado'), 'doc-imagen mal marcado');
  console.log('   ✓ imagen bajada de la nube + caption con minutos + enviado');

  console.log('🧪 Test 11 (B2): imagenUrl ROTA → cae a texto pelado (no se pierde)');
  simularDoc('doc-img-fail', {
    tipo: 'dt_aviso',
    telefono: '51987654321',
    texto: '🏁 ¡Ya llegué! 🛵',
    imagenUrl: 'https://storage.fail/imagenes_dt/llegada_456.jpg',
    createdAt: new Date().toISOString(),
  });
  await sleep(250);
  assert(mensajesEnviados.length === 5, 'no mandó el aviso de respaldo');
  const textoSolo = mensajesEnviados[4];
  assert(!textoSolo.content.image && textoSolo.content.text.includes('llegué'), 'no cayó a texto');
  assert(updates.some(u => u.id === 'doc-img-fail' && u.resultado === 'enviado'), 'doc-img-fail debía marcar enviado igual');
  console.log('   ✓ la imagen falló y el mensaje salió igual (texto)');

  console.log('🧪 Test 12 (B2): dt_ubicacion con imagenUrl también manda imagen');
  simularDoc('doc-ubi-img', {
    tipo: 'dt_ubicacion',
    telefono: '51987654321',
    texto: '📍 ¿Me ayudás con tu ubicación exacta?',
    imagenUrl: 'https://storage.ok/imagenes_dt/ubicacion_789.jpg',
    createdAt: new Date().toISOString(),
  });
  await sleep(250);
  assert(mensajesEnviados.length === 6, 'no mandó el pedido de ubicación');
  assert(mensajesEnviados[5].content.image, 'la ubicación debía llevar imagen');
  assert(mensajesEnviados[5].content.caption.includes('ubicación'), 'caption de ubicación mal');
  console.log('   ✓ pedir ubicación también sale con imagen');


  console.log('');
  console.log('════════════════════════════════════════');
  console.log('✅ TODOS LOS TESTS DEL PARCHE PASARON (12/12)');
  console.log('════════════════════════════════════════');
})().catch((e) => {
  console.error('❌ FALLO:', e.message);
  process.exit(1);
});
