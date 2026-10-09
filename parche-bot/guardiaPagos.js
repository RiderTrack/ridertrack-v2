// guardiaPagos.js — LA ÚLTIMA LÍNEA DE DEFENSA (v2 · FASE R)
//
// ═══════════════════════════════════════════════════════════════
// POR QUÉ EXISTE (13/07/2026):
//
// Derick preguntó "a qué número pago". La IA improvisó, le dijo que el
// pago iba "directo a MATE" y le dio el 956203893. Derick yapeó S/65 ahí.
// Esa plata NO llegó a Rudy.
//
// Y hay un escenario PEOR que casi pasó: si la IA hubiera dado el
// 907565569 (el número del bot), la plata se habría PERDIDO PARA SIEMPRE
// — esa cuenta está a nombre de Rudy y está bloqueada por deuda; no puede
// acceder a ella. Por eso cobra con el Yape de su tío Lorenzo.
//
// REGLAS (definidas por Rudy):
//   💰 980811297 (Lorenzo)  -> el ÚNICO número que puede recibir pagos del TRABAJO
//   📞 956203893 (MATE)     -> solo para coordinar/reclamos, NUNCA cobrar
//                              (Rudy maneja el dinero; si el cliente le
//                               paga a MATE, se le rompe el cuadre)
//   🚫 907565569 (bot)      -> PROHIBIDO. Cuenta inaccesible = plata perdida
//
// Este módulo revisa CADA mensaje ANTES de salir. Si detecta un número
// de teléfono en contexto de pago que NO esté permitido, BLOQUEA el
// envío y avisa a Rudy.
//
// No confía en la IA. No confía en las plantillas. No confía ni en mí.
// Bloquea por NÚMERO, no por intención.
//
// ═══════════════════════════════════════════════════════════════
// v2 · FASE R (09/10/2026) — LA LISTA BLANCA SE PUEDE EXTENDER:
//
// BUG REAL que motivó el cambio: Rudy separó sus QRs — para sus viajes
// LIBRES de inDrive cobra con su Yape/Plin PERSONAL (un número distinto
// del de Lorenzo). El guardián bloqueaba CADA cobro de inDrive en
// silencio (la prueba del robot sí salía porque no habla de pagos).
//
// Ahora drivertrack_bot.js registra los números PERSONALES de Rudy
// (los que la app guarda en dt_sync → config.yape.numero / plin.numero,
// configurados por el PROPIO Rudy en "Mi QR Yape/Plin → 🏍️ inDrive")
// con permitirNumeroCobro(). El guardián sigue siendo lista blanca
// ESTRICTA para el trabajo (solo Lorenzo) + los números que el propio
// Rudy configuró en su app. Números inventados por IA o plantillas
// rotas: siguen BLOQUEADOS igual que antes.
// ═══════════════════════════════════════════════════════════════

// El único número del TRABAJO que puede recibir plata
const YAPE_VALIDO = '980811297'

// Números que NUNCA deben salir en contexto de pago
const NUMEROS_PROHIBIDOS_EN_PAGO = [
  '907565569',   // el del bot — cuenta bloqueada, plata perdida
  '956203893',   // MATE — Rudy maneja el dinero, no ellos
  '919582554'    // el personal de Rudy — no es para cobrar
]

// 🟣 FASE R: números PERMITIDOS para cobrar = Lorenzo (trabajo) +
// los personales de inDrive que la app de Rudy registre
const _NUMEROS_PERMITIDOS = new Set([YAPE_VALIDO])

/**
 * 🟣 FASE R: registra un número personal como válido para cobros.
 * Lo llama drivertrack_bot.js con los números que Rudy configuró en
 * su app (Yape/Plin personal de inDrive). Solo acepta celulares
 * peruanos de 9 dígitos (con o sin 51 adelante, con o sin espacios).
 */
function permitirNumeroCobro(n) {
  const d = String(n || '').replace(/[^0-9]/g, '').replace(/^51/, '')
  if (d.length !== 9) return false
  _NUMEROS_PERMITIDOS.add(d)
  return true
}

/** 🟣 FASE R: para ver qué está permitido (logs/tests) */
function numerosPermitidos() {
  return Array.from(_NUMEROS_PERMITIDOS)
}

// RAÍCES (no palabras completas) que indican que se habla de PAGAR.
// Usar raíces cubre todas las conjugaciones de una:
//   'pag'      -> pago, paga, pagar, pagué, pagas, pagando...
//   'transfer' -> transferencia, transferir, transfiere, transfieres...
//   'deposit'  -> deposito, depositar, deposita, depositas...
// (Antes tenía palabras completas y se escapaban "deposita" y "transfiere".)
const CONTEXTO_PAGO = [
  'yape', 'yapea', 'yapear', 'yapeo', 'plin',
  'pag',            // pago, pagar, paga, pagué...
  'transf',         // transferencia, transferir, TRANSFIERE (ojo: 'transfiere' NO contiene 'transfer')
  'deposit',        // deposito, depositar, deposita...
  'abon',           // abono, abonar, abona...
  'cobr',           // cobro, cobrar, cobra...
  'cuenta', 'bcp', 'bbva', 'interbank', 'scotiabank',
  'cci', 'a nombre de', 'titular', 'envia', 'envía', 'manda al', 'mándale'
]

function normalizar(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Saca todos los números de teléfono del texto (con o sin espacios/guiones)
function extraerNumeros(texto) {
  const t = String(texto || '')
  const encontrados = []

  // Método robusto: quitar TODOS los separadores del texto y buscar los
  // números prohibidos como subcadena. Así da igual si vienen como
  // "907565569", "907 565 569", "907-565-569", "907.565.569" o "51907565569".
  //
  // (El regex con \b fallaba con guiones: "907-565-569" lo partía en 3.)
  const soloDigitos = t.replace(/[\s\-.()]/g, '')
  const re = /\d{9,12}/g
  let m
  while ((m = re.exec(soloDigitos)) !== null) {
    encontrados.push(m[0].replace(/^51/, ''))
  }
  return encontrados
}

// ═══════════════════════════════════════════════════════════════
// revisarMensajeSaliente
//
// Devuelve:
//   { seguro: true }                        -> se puede mandar
//   { seguro: false, motivo, numero }       -> BLOQUEAR y avisar a Rudy
// ═══════════════════════════════════════════════════════════════
function revisarMensajeSaliente(texto) {
  if (!texto || typeof texto !== 'string') return { seguro: true }

  const t = normalizar(texto)

  // ¿El mensaje habla de pagos?
  const hablaDePago = CONTEXTO_PAGO.some(p => t.includes(p))
  if (!hablaDePago) return { seguro: true }   // no toca plata -> pasa

  // Habla de pago. ¿Qué números menciona?
  const numeros = extraerNumeros(texto)
  if (numeros.length === 0) return { seguro: true }   // sin números -> pasa

  // Lista BLANCA (desde 15/07): en contexto de pago, CUALQUIER número
  // que no esté permitido se bloquea — conocido o no. Protege contra
  // errores que todavía no hemos visto. (FASE R: la lista ahora también
  // tiene los números PERSONALES de inDrive que la app de Rudy registró.)
  for (const n of numeros) {
    const nLimpio = n.replace(/^51/, '')

    // ¿Es algún número permitido (Lorenzo o los personales de Rudy)? -> pasa
    let permitido = false
    for (const ok of _NUMEROS_PERMITIDOS) {
      if (nLimpio === ok || nLimpio.indexOf(ok) !== -1) {
        permitido = true
        break
      }
    }
    if (permitido) continue

    // Cualquier OTRO número en contexto de pago -> bloqueado
    let motivoEspecifico = '⚠️ No es un número permitido para cobrar'
    for (const prohibido of NUMEROS_PROHIBIDOS_EN_PAGO) {
      if (nLimpio === prohibido || nLimpio.indexOf(prohibido) !== -1) {
        motivoEspecifico = prohibido === '907565569'
          ? '⚠️ Es el número del BOT — cuenta bloqueada, la plata se PIERDE'
          : (prohibido === '956203893'
              ? '⚠️ Es el de MATE — el dinero no llegaría a ti'
              : '⚠️ No es un número para cobrar')
        break
      }
    }

    return {
      seguro: false,
      motivo: 'NUMERO_INCORRECTO_EN_CONTEXTO_DE_PAGO',
      numero: nLimpio,
      detalle: motivoEspecifico + ' (permitidos: ' + Array.from(_NUMEROS_PERMITIDOS).join(' · ') + ')'
    }
  }

  return { seguro: true }
}

module.exports = {
  revisarMensajeSaliente,
  extraerNumeros,
  permitirNumeroCobro,
  numerosPermitidos,
  YAPE_VALIDO,
  NUMEROS_PROHIBIDOS_EN_PAGO
}
