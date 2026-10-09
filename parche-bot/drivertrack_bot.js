// ═══════════════════════════════════════════════════════════════
// 🏍️ drivertrack_bot.js — PARCHE DEL BOT para DriverTrack (FASE B)
// ═══════════════════════════════════════════════════════════════
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
//   • 💜 dt_cobro          — cobro CON tu QR (Yape o Plin, según elijas
//                          en la app — FASE R) — imagen + monto
//   • 🛣️ dt_aviso          — voy en camino / ⏱️ llegando en X min /
//                          ya llegué / entregado — FASE B2: puede ir
//                          CON IMAGEN (la app manda la URL de la
//                          imagen que subiste en Ajustes → 🖼️ y acá
//                          se baja de la nube al momento del envío)
//   • 📍 dt_ubicacion      — pedirle al cliente su ubicación (también
//                          puede llevar imagen, FASE B2)
//   • 📷 dt_foto_entrega   — FASE J: la FOTO de la entrega 📦 — el
//                          cliente la recibe SOLO, sin abrir
//                          WhatsApp (igual que el cobro con QR).
//                          La foto viaja como imagenBase64 en el
//                          propio doc (comprimida ~60-150 KB) y el
//                          texto editable va de caption. Si la foto
//                          no llega, se marca ERROR (nunca sale un
//                          texto pelado que confunda al cliente).
//   • 💬 dt_texto          — mensaje libre (futuro)
//   • 🧪 dt_prueba         — mensaje de prueba a vos mismo (Ajustes)
//
// FASE B2 (imágenes): la app pone `imagenUrl` en la acción (una
// URL de Firebase Storage). El parche la baja con fetch y manda
// IMAGEN + texto de caption — igual que los avisos con imagen del
// trabajo. Si la bajada falla (sin internet a Storage, URL
// vencida…), manda SOLO el texto — el mensaje nunca se pierde.
//
// ═══════════════════════════════════════════════════════════════
// 🟣 v1.3 · FASE R (09/10/2026) — DOS ARREGLOS DE ORO:
//
// 1) GUARDIÁN DE PAGOS + TUS NÚMEROS PERSONALES. Bug real: Rudy
//    separó sus QRs (inDrive cobra con su Yape/Plin PERSONAL, un
//    número distinto al del trabajo) y el guardián de pagos BLOQUEABA
//    cada cobro en silencio (lista blanca = solo el número del
//    trabajo). Ahora este parche lee TUS números personales de la
//    nube (dt_sync → config.yape/plin.numero — los que configurás en
//    "Mi QR Yape/Plin → 🏍️ inDrive") y los registra en el guardián
//    con permitirNumeroCobro(). El bot los refresca solo cada 3 min
//    (o al toque antes de cada cobro) — si cambiás de número en la
//    app, el bot lo admite en segundos.
//
// 2) NADA MÁS DE "ENVIADO" FALSO. Si un envío queda bloqueado por
//    el guardián o el freno de pánico (o WhatsApp no confirma), la
//    acción se marca ERROR con el motivo — la app te lo muestra y te
//    abre WhatsApp de respaldo. Antes el bot marcaba "enviado"
//    aunque NO hubiera salido nada. Y si el QR no puede salir por un
//    problema de la IMAGEN, el cobro se reintenta UNA vez en texto
//    solo (el mensaje ya tiene el monto y tus números) — el doc queda
//    "enviado" con nota "sin QR" para que la app te avise.
// ═══════════════════════════════════════════════════════════════
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
//   1. Copiá ESTE archivo + guardiaPagos.js (v2) a la carpeta del
//      bot (donde index.js)
//   2. Corré:  node instalar_drivertrack.js
//      (agrega las 2 líneas al index.js, respalda y verifica)
//      Después: pm2 restart rudy-bot
//
// En consola debe aparecer:
//   🏍️ [DT] Parche activo (drivertrack_bot.js v1.3 …)
//   🏍️ [DT] 💜🔷 Números personales permitidos en el guardián: …
//
// ✅ CÓMO PROBARLO: en la app → inDrive → Ajustes → 🤖 Robot →
//    "Mandarme prueba" Y "Prueba con QR 💜" → te tienen que llegar
//    los DOS a tu WhatsApp en 1-2 segundos.
// ═══════════════════════════════════════════════════════════════

const { getFirestore } = require('firebase-admin/firestore');

let _sockRef = null;
let _listenerIniciado = false;
const _docsEnviados = new Set(); // anti-reenvío en reconexiones

const VERSION = 'drivertrack_bot.js v1.3 (FASE R — cobro Yape/Plin + guardián con tus números personales)';
const UID_DEFECTO = 'K8wx9X5GGOfindI1RGtIIQN3UGr1';
const TIPOS_DT = ['dt_cobro', 'dt_aviso', 'dt_ubicacion', 'dt_texto', 'dt_foto_entrega', 'dt_prueba'];

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

/**
 * 🖼️ FASE B2: baja la imagen de la nube (Firebase Storage) con un
 * tiempo límite — si tarda o falla, se devuelve null y el mensaje
 * sale en texto pelado (nunca se traba ni se pierde).
 */
async function bajarImagen(url) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 10000); // máx 10s
  try {
    const resp = await fetch(String(url), { signal: controlador.signal });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (!buf.length) throw new Error('imagen vacía');
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🟣 FASE R: registrar los números PERSONALES de Yape/Plin de Rudy
// en el guardián de pagos (lista blanca). Se leen de
// dt_sync/{uid}.config — los MISMOS números que la app usa para
// armar los cobros de inDrive ("Mi QR Yape/Plin → 🏍️ inDrive").
// Sin esto, el guardián (lista blanca = solo el número del trabajo)
// BLOQUEA cada cobro personal en silencio — el bug de la FASE R.
// ═══════════════════════════════════════════════════════════════
let _numerosLeidosEn = 0;
const _REFRESCO_PERSONALES_MS = 3 * 60 * 1000; // relee cada 3 min

async function refrescarNumerosPersonales(forzar) {
  const ahora = Date.now();
  if (!forzar && _numerosLeidosEn && ahora - _numerosLeidosEn < _REFRESCO_PERSONALES_MS) return;
  _numerosLeidosEn = ahora; // marcar YA: si falla la lectura, no reintentar en CADA acción
  try {
    let permitir = null;
    try {
      permitir = require('./guardiaPagos').permitirNumeroCobro;
    } catch (e) {
      console.warn('🏍️ [DT] ⚠️ guardiaPagos.js sin permitirNumeroCobro — ¿copiaste la v2 del zip?');
      return;
    }
    const db = getFirestore();
    const snap = await db.collection('dt_sync').doc(uidRudy()).get();
    const cfg = (snap.data() || {}).config || {};
    const numeros = [
      cfg.yape && cfg.yape.numero,
      cfg.plin && cfg.plin.numero,
    ];
    const nuevos = [];
    for (const n of numeros) {
      const d = String(n || '').replace(/[^0-9]/g, '').replace(/^51/, '');
      if (d.length === 9 && permitir(d)) nuevos.push(d);
    }
    if (nuevos.length) {
      console.log('🏍️ [DT] 💜🔷 Números personales permitidos en el guardián: ' + nuevos.join(' · '));
    } else {
      console.log('🏍️ [DT] (FASE R) Sin números personales configurados todavía — si un cobro se bloquea, configurá tu Yape/Plin en "Mi QR Yape/Plin → 🏍️ inDrive"');
    }
  } catch (e) {
    console.warn('🏍️ [DT] (FASE R) No pude leer tus números personales de la nube: ' + e.message);
  }
}

/** Envía y EXIGE confirmación — si el bot lo bloqueó (guardián/freno)
 *  o WhatsApp no confirmó, lanza error para que la app lo sepa. */
async function enviarConfirmado(jid, contenido) {
  const res = await _sockRef.sendMessage(jid, contenido);
  if (!res || !res.key) {
    throw new Error('el bot bloqueó el envío (guardián de pagos / freno de pánico) o WhatsApp no confirmó — revisá los números de Yape/Plin que configuraste');
  }
  return res;
}

// ═══════════════════════════════════════════════════════════════
// ⚙️ PROCESAR cada acción — la app ya arma el texto completo;
// el parche envía (texto, o imagen + el texto de caption):
//   • dt_cobro con imagenBase64 → tu QR pegado al mensaje (FASE R:
//     el de Yape 💜 o el de Plin 🔷, según lo que elijas en la app)
//   • dt_foto_entrega con imagenBase64 (FASE J) → la FOTO de la
//     entrega pegada al mensaje — sin la foto la acción FALLA
//     (mandar solo el texto confundiría al cliente)
//   • dt_aviso/dt_ubicacion con imagenUrl (FASE B2) → la imagen
//     que subiste en Ajustes → 🖼️, bajada de la nube al vuelo
//   • si la imagen del aviso falla → texto nomás (nunca se pierde)
//   • 🟣 FASE R: si el QR del cobro no puede salir por la IMAGEN,
//     se reintenta UNA vez en texto solo (monto + números ya van en
//     el mensaje) y el doc queda 'enviado' con nota 'sin QR'
// ═══════════════════════════════════════════════════════════════
async function procesarAccionDT(docRef, datos) {
  const tipo = datos.tipo;
  try {
    if (!TIPOS_DT.includes(tipo)) return; // no es nuestro

    // 🟣 FASE R: antes de un cobro/foto, refrescar los números
    // personales (el guardián los necesita ANTES del envío)
    if (tipo === 'dt_cobro' || tipo === 'dt_foto_entrega') {
      await refrescarNumerosPersonales(false);
    }

    const jid = await resolverDestino(datos.telefono);
    if (!jid) throw new Error('El viaje no tiene celular válido');

    const texto = String(datos.texto || '').trim();
    if (!texto) throw new Error('La acción viene sin texto (versión vieja de la app?)');

    // 📷 FASE J: la foto de entrega viaja igual que el QR del cobro
    // (base64 dentro del doc) — PERO es obligatoria: si no llegó,
    // la acción se marca con error para que la app lo muestre.
    if (tipo === 'dt_foto_entrega' && !datos.imagenBase64) {
      throw new Error('La foto no llegó en la acción (actualizá la app)');
    }

    // 💜 dt_cobro puede venir con el QR (dataURL base64) — se manda
    // como IMAGEN con el texto de caption, igual que el enviar_yape
    // del trabajo. FASE R: puede ser el QR de Yape o el de Plin.
    let buffer = null;
    if ((tipo === 'dt_cobro' || tipo === 'dt_foto_entrega') && datos.imagenBase64) {
      buffer = Buffer.from(
        String(datos.imagenBase64).replace(/^data:image\/[a-z]+;base64,/, ''),
        'base64'
      );
    } else if (datos.imagenUrl) {
      // 🖼️ FASE B2: aviso con imagen (la que subiste en Ajustes) —
      // se baja de la nube; si falla, texto pelado y a otra cosa
      try {
        buffer = await bajarImagen(datos.imagenUrl);
        console.log('🏍️ [DT] 🖼️ Imagen del aviso bajada (' + Math.round(buffer.length / 1024) + ' KB)');
      } catch (e) {
        console.warn('🏍️ [DT] ⚠️ La imagen del aviso no bajó (' + e.message + ') — mando solo el texto');
        buffer = null;
      }
    }

    if (buffer) {
      try {
        await enviarConfirmado(jid, {
          image: buffer,
          caption: texto,
          mimetype: 'image/jpeg',
        });
      } catch (e) {
        // 🟣 FASE R: si la IMAGEN no pudo salir en un COBRO, el
        // mensaje NO se pierde — reintenta UNA vez en texto solo
        // (el monto y los números ya están en el texto). La foto de
        // entrega NO reintenta: un texto pelado confundiría.
        if (tipo !== 'dt_cobro') throw e;
        console.warn('🏍️ [DT] ⚠️ El QR no pudo salir (' + e.message + ') — reintento el cobro en texto solo');
        await enviarConfirmado(jid, { text: texto });
        console.log('🏍️ [DT] ✅ dt_cobro enviado SIN QR (texto con monto y números)');
        await docRef.update({
          resultado: 'enviado',
          nota: 'sin QR (' + String(e.message || e).slice(0, 120) + ')',
          enviadoAt: new Date().toISOString(),
          via: VERSION,
          processed: true,
          processedAt: new Date().toISOString(),
        });
        return;
      }
    } else {
      await enviarConfirmado(jid, { text: texto });
    }

    console.log(
      '🏍️ [DT] ✅ ' + tipo + (buffer ? ' (con imagen)' : '') + ' enviado a ' + (datos.nombre || datos.telefono) +
      (datos.minutos ? ' — llegando en ' + datos.minutos + ' min' : '') +
      (datos.metodo ? ' (' + datos.metodo + ')' : '')
    );

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

// ═══════════════════════════════════════════════════════════════
// 🚀 ARRANQUE — se llama desde index.js (lo agrega el instalador):
//     const { iniciarDrivertrackBot } = require('./drivertrack_bot');
//     iniciarDrivertrackBot(sock);
// ═══════════════════════════════════════════════════════════════
function iniciarDrivertrackBot(sock) {
  if (sock) _sockRef = sock; // siempre refrescar el socket (reconexiones)

  if (_listenerIniciado) return;
  _listenerIniciado = true;
  console.log('🏍️ [DT] Parche activo (' + VERSION + ')');
  console.log('🏍️ [DT] Escuchando acciones_dt: cobro 💜🔷 (Yape/Plin, con su QR) · avisos 🛣️⏱️🏁✅ (con imagen 🖼️ si la subiste) · ubicación 📍 · foto de entrega 📷 · prueba 🧪');

  // 🟣 FASE R: registrar los números personales de inDrive en el
  // guardián de pagos — al arrancar y cada 3 min (si cambiás de
  // número en la app, el bot lo admite solo)
  refrescarNumerosPersonales(true).catch(() => {});
  const _timerPersonales = setInterval(() => {
    refrescarNumerosPersonales(false).catch(() => {});
  }, _REFRESCO_PERSONALES_MS);
  if (typeof _timerPersonales.unref === 'function') _timerPersonales.unref(); // no frenar la salida (tests)

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
