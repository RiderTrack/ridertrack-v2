// ═══════════════════════════════════════════════════════════
// 🏍️ drivertrack_bot.js — PARCHE DEL BOT para DriverTrack (FASE B)
// ═══════════════════════════════════════════════════════════
//
// ¿QUÉ HACE? El rudy-bot ya manda los mensajes del TRABAJO que
// salen de RiderTrack (acciones_bot). Este parche le suma los
// mensajes de INDRIVE que salen de la sección "inDrive (Libre)"
// de la MISMA app — misma idea, cola SEPARADA:
//
//   app (botón 🤖) → Firestore acciones_dt/{uid}/pendientes →
//   este parche → WhatsApp del cliente
//
// Botones que alimentan esta cola (la app arma el texto completo):
//   • 💜 dt_cobro     — cobro CON tu QR de Yape (imagen + monto)
//   • 🛣️ dt_aviso     — voy en camino / ya llegué / entregado
//   • 📍 dt_ubicacion — pedirle al cliente su ubicación
//   • 💬 dt_texto     — mensaje libre (futuro)
//   • 🧪 dt_prueba    — mensaje de prueba a vos mismo (Ajustes)
//
// ¿POR QUÉ OTRA COLECCIÓN Y NO acciones_bot? Porque index.js
// procesa TODO lo que cae en acciones_bot y lo marca processed
// (aunque no conozca el tipo) — las acciones inDrive se perderían
// marcadas sin enviarse. Con acciones_dt, este parche es el
// ÚNICO dueño de su cola. El flujo del trabajo queda INTACTO.
//
// SEGURIDAD (heredada gratis del index.js):
//   • El freno de pánico y el guardián de pagos envuelven
//     sock.sendMessage GLOBALMENTE → todo lo que manda este
//     parche pasa por los mismos candados.
//   • Nada automático hacia clientes: cada doc lo dispara Rudy
//     apretando un botón. Las respuestas automáticas siguen
//     desactivadas como siempre.
//
// 📥 INSTALACIÓN (2 pasos, igual que grupo_mate.js):
//   1. Copiá este archivo a la carpeta del bot (donde index.js)
//   2. Corré:  node instalar_drivertrack.js
//      (agrega las 2 líneas al index.js, respalda y verifica)
//      Después: pm2 restart rudy-bot
//
// En consola debe aparecer:
//   🏍️ [DT] Parche activo — escuchando acciones_dt (inDrive)
//
// ✅ CÓMO PROBARLO: en la app → inDrive → Ajustes → 🤖 Robot →
//    "Mandarme prueba" → te tiene que llegar el mensaje a TU
//    WhatsApp en 1-2 segundos.
// ═══════════════════════════════════════════════════════════

const { getFirestore } = require('firebase-admin/firestore');

let _sockRef = null;
let _listenerIniciado = false;
const _docsEnviados = new Set(); // anti-reenvío en reconexiones

const VERSION = 'drivertrack_bot.js v1.0 (FASE B)';
const UID_DEFECTO = 'K8wx9X5GGOfindI1RGtIIQN3UGr1';
const TIPOS_DT = ['dt_cobro', 'dt_aviso', 'dt_ubicacion', 'dt_texto', 'dt_prueba'];

function uidRudy() {
  try {
    const { getUidRudy } = require('./firebase');
    return getUidRudy() || UID_DEFECTO;
  } catch (e) {
    return UID_DEFECTO;
  }
}

/** Normaliza celular igual que la app: 9 dígitos → 51… */
function _cel(tel) {
  if (!tel) return null;
  const d = String(tel).replace(/[^0-9]/g, '');
  if (d.length === 9) return '51' + d;
  if ((d.length === 11 || d.length === 12) && d.startsWith('51')) return d;
  if (d.length === 13 && d.startsWith('0051')) return d.slice(2);
  return d.length >= 9 ? '51' + d.slice(-9) : null;
}

/**
 * JID de WhatsApp del cliente — Baileys 7 con LIDs activados no
 * acepta JIDs inventados: primero se resuelve contra el servidor
 * (resolverJid de campanas_bot.js, la Regla de Oro #21), y si
 * falla se cae al JID clásico @s.whatsapp.net como respaldo.
 */
async function resolverDestino(telefono) {
  const cel = _cel(telefono);
  if (!cel) return null;
  try {
    const { resolverJid } = require('./campanas_bot.js');
    const jid = await resolverJid(cel);
    if (jid) return jid;
  } catch (e) { /* sin campanas_bot o sin red → respaldo */ }
  return cel + '@s.whatsapp.net';
}

// ═══════════════════════════════════════════════════════════
// ⚙️ PROCESAR cada acción — la app ya arma el texto completo;
// el parche solo envía (texto, o imagen QR + el texto de caption)
// ═══════════════════════════════════════════════════════════
async function procesarAccionDT(docRef, datos) {
  const tipo = datos.tipo;
  try {
    if (!TIPOS_DT.includes(tipo)) return; // no es nuestro

    const jid = await resolverDestino(datos.telefono);
    if (!jid) throw new Error('El viaje no tiene celular válido');

    const texto = String(datos.texto || '').trim();
    if (!texto) throw new Error('La acción viene sin texto (versión vieja de la app?)');

    // 💜 dt_cobro puede venir con el QR de Yape (dataURL base64) —
    // se manda como IMAGEN con el texto de caption, igual que el
    // enviar_yape del trabajo. Los demás tipos van como texto.
    const conImagen = tipo === 'dt_cobro' && datos.imagenBase64;

    if (conImagen) {
      const buffer = Buffer.from(
        String(datos.imagenBase64).replace(/^data:image\/[a-z]+;base64,/, ''),
        'base64'
      );
      await _sockRef.sendMessage(jid, {
        image: buffer,
        caption: texto,
        mimetype: 'image/jpeg',
      });
    } else {
      await _sockRef.sendMessage(jid, { text: texto });
    }

    console.log('🏍️ [DT] ✅ ' + tipo + ' enviado a ' + (datos.nombre || datos.telefono));

    await docRef.update({
      resultado: 'enviado',
      enviadoAt: new Date().toISOString(),
      via: VERSION,
      processed: true,
      processedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('🏍️ [DT] ❌ No se pudo enviar (' + tipo + '):', e.message);
    try {
      await docRef.update({
        resultado: 'error',
        error: String(e.message || e).slice(0, 300),
        errorAt: new Date().toISOString(),
        via: VERSION,
        processed: true, // no reintentar en bucle; la app muestra el error
        processedAt: new Date().toISOString(),
      });
    } catch (e2) { /* nada */ }
  }
}

// ═══════════════════════════════════════════════════════════
// 🚀 ARRANQUE — se llama desde index.js (lo agrega el instalador):
//     const { iniciarDrivertrackBot } = require('./drivertrack_bot');
//     iniciarDrivertrackBot(sock);
// ═══════════════════════════════════════════════════════════
function iniciarDrivertrackBot(sock) {
  if (sock) _sockRef = sock; // siempre refrescar el socket (reconexiones)

  if (_listenerIniciado) return;
  _listenerIniciado = true;
  console.log('🏍️ [DT] Parche activo (' + VERSION + ')');
  console.log('🏍️ [DT] Escuchando acciones_dt: cobro 💜 · avisos 🛣️🏁✅ · ubicación 📍 · prueba 🧪');

  try {
    const db = getFirestore();
    const uid = uidRudy();

    db.collection('acciones_dt').doc(uid).collection('pendientes')
      .where('processed', '==', false)
      .onSnapshot((snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const doc = change.doc;
          const datos = doc.data() || {};
          if (!TIPOS_DT.includes(datos.tipo)) return;   // solo lo nuestro
          if (_docsEnviados.has(doc.id)) return;          // anti-reenvío
          if (datos.resultado) return;                    // ya lo envié antes
          // al arrancar no revivir mensajes viejos (>10 min)
          const creado = datos.createdAt ? Date.parse(datos.createdAt) : 0;
          if (creado && Date.now() - creado > 10 * 60 * 1000) {
            // marcar como vencido para que no quede pendiente para siempre
            doc.ref.update({ processed: true, resultado: 'vencido', via: VERSION }).catch(() => {});
            return;
          }

          _docsEnviados.add(doc.id);
          console.log('🏍️ [DT] Acción pendiente: ' + datos.tipo + ' → ' + (datos.nombre || datos.telefono));
          if (!_sockRef || !_sockRef.user) {
            console.error('🏍️ [DT] ⚠️ Sock sin conexión — la acción queda en cola hasta reconectar');
            _docsEnviados.delete(doc.id); // permitir reintento cuando reconecte
            return;
          }
          procesarAccionDT(doc.ref, datos).catch(() => {});
        });
      }, (e) => console.error('🏍️ [DT] Listener:', e.message));

  } catch (e) {
    console.error('🏍️ [DT] ❌ No se pudo iniciar:', e.message);
  }
}

module.exports = { iniciarDrivertrackBot };
