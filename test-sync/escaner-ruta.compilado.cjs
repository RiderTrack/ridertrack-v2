var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/services/escanerRuta.ts
var escanerRuta_exports = {};
__export(escanerRuta_exports, {
  __escanerRutaTests: () => __escanerRutaTests,
  escanearClienteWhatsApp: () => escanearClienteWhatsApp,
  sanearClienteWA: () => sanearClienteWA
});
module.exports = __toCommonJS(escanerRuta_exports);

// src/drivertrack/services/escanerIA.ts
function mensajeErrorOcr(c) {
  switch (c) {
    case "sin-key":
      return "Configur\xE1 tu key de IA en Ajustes (Gemini gratis, 1 minuto)";
    case "formato-key":
      return 'Eso no parece una key \u2014 Gemini empieza con "AIza" o "AQ." \xB7 Claude con "sk-ant-"';
    case "key-invalida":
      return "La key no es v\xE1lida \u2014 copiala de nuevo desde AI Studio o Anthropic";
    case "api-bloqueada":
      return "Esa key no tiene la IA habilitada. Para Gemini, creala directo en aistudio.google.com/apikey";
    case "region":
      return "Gemini no est\xE1 disponible desde tu regi\xF3n o red actual \u2014 prob\xE1 con otra conexi\xF3n o us\xE1 una key de Claude";
    case "quota":
      return "La key lleg\xF3 a su l\xEDmite del momento \u2014 reintent\xE1 en un rato";
    case "creditos":
      return "Tu key de Gemini se qued\xF3 SIN CR\xC9DITOS \u{1F4B3} \u2014 crea una nueva gratis en aistudio.google.com/apikey o recarg\xE1 en ai.studio \u2192 Billing. Si configuraste tu token de Claude, el esc\xE1ner ya lo us\xF3 de respaldo";
    case "red":
      return "Sin internet o conexi\xF3n lenta \u2014 revis\xE1 tu se\xF1al";
    case "sin-datos":
      return "No pude leer nada en la foto \u{1F914} \u2014 prob\xE1 con una captura n\xEDtida desde \u{1F5BC}\uFE0F Galer\xEDa, o escrib\xED a mano con la foto de gu\xEDa";
    default:
      return "Algo fall\xF3 escaneando \u2014 prob\xE1 de nuevo o escrib\xED a mano";
  }
}
function detectarProveedor(apiKey) {
  const k = apiKey.trim();
  if (k.startsWith("AIza") || k.startsWith("AQ.")) return "gemini";
  if (k.startsWith("sk-ant-")) return "claude";
  return null;
}
var MODELOS_GEMINI = ["gemini-flash-latest", "gemini-3.6-flash", "gemini-3.5-flash"];
var MODELOS_CLAUDE = ["claude-haiku-4-5-20251001", "claude-3-5-haiku-20241022"];
var URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
var URL_CLAUDE = "https://api.anthropic.com/v1/messages";
var TIMEOUT_CON_IMAGEN = 45e3;
var TIMEOUT_SIN_IMAGEN = 2e4;
var PROMPT = `Eres el esc\xE1ner de pedidos de DriverTrack, una app de delivery motorizado en Lima, Per\xFA.

Te mando la FOTO de un pedido. Puede ser: una captura de pantalla de inDrive, Rappi o PedidosYa; un chat de WhatsApp; una nota o sticker escrito a mano; o el sticker del paquete. MUCHOS pedidos son de pueblos j\xF3venes y proyectos de vivienda: las calles van con C\xD3DIGO \u2014 "C.1" es Calle 1, "C.2" es Calle 2, y "Mz B Lt 5" es Manzana B Lote 5. Esos c\xF3digos son PARTE DE LA DIRECCI\xD3N, jam\xE1s nombres de personas.

Extrae los datos del ENV\xCDO con estas reglas:

DIRECCIONES \u2014 OJO, SON DOS CAMPOS DISTINTOS (A y B), NO LOS CONFUNDAS:
- direccionA: la direcci\xF3n de RECOJO (punto A) \u2014 d\xF3nde agarr\xE1s el paquete. En inDrive aparece bajo "Recoger en", "Direcci\xF3n de recogida", "Origen", "Punto de partida" o la marca \u{1F170}\uFE0F; en Rappi/PedidosYa suele ser la direcci\xF3n de la TIENDA o RESTAURANTE. Gu\xEDate por la ETIQUETA que acompa\xF1a la direcci\xF3n, NO por el orden en la pantalla.
- direccion: la direcci\xF3n de ENTREGA (punto B, el DESTINO FINAL) \u2014 d\xF3nde dej\xE1s el paquete. En inDrive aparece bajo "Entregar en", "Direcci\xF3n de destino", "Destino", "Punto de entrega" o la marca \u{1F171}\uFE0F. Incluye urbanizaci\xF3n/barrio/etapa/manzana/lote o c\xF3digo ("C.1", "Mz C Lt 5"), interior, departamento. NUNCA metas nombres de personas ac\xE1.
REGLAS DE ORO DE LAS DIRECCIONES:
1. Si la foto muestra UNA SOLA direcci\xF3n \u2192 esa es la ENTREGA: va en "direccion" y "direccionA" queda "".
2. Si muestra DOS direcciones \u2192 identific\xE1 cu\xE1l es el RECOJO por su etiqueta ("Recoger en", tienda, origen) y cu\xE1l la ENTREGA ("Entregar en", "Destino", el cliente). Si el pedido es de delivery, la ENTREGA es la del CLIENTE que recibe (la que va con el nombre del destinatario o la referencia de su casa).
3. NUNCA copies la misma direcci\xF3n en los dos campos. Si no pod\xE9s distinguir cu\xE1l es el recojo, dej\xE1 "direccionA" en "" y pon\xE9 la de entrega en "direccion".
4. En los pueblos j\xF3venes, el pedido del cliente (la entrega B) suele llevar c\xF3digos tipo "C.1 Mz B Lt 5"; el recojo (A) suele ser una tienda, local o direcci\xF3n de avenida.
5. MULTI-PUNTO (FASE M): si el pedido tiene M\xC1S DE UNA ENTREGA ("Entregar en" aparece 2+ veces, o hay "paradas", "parada 2", "punto de entrega" extra), la PRIMERA entrega va en "direccion" (B) y las dem\xE1s van en "paradas" EN ORDEN DE RUTA (C, D, E). "paradas" es un ARRAY de strings []. Si no hay entregas extra, devolve "paradas": []. NUNCA pongas el recojo (A) en paradas.

- cliente: el NOMBRE DE PERSONA del cliente (qui\xE9n recibe o pide). Ej: "Mk", "Mar\xEDa Fern\xE1ndez", "Kevin Rojas". NUNCA pongas ac\xE1 c\xF3digos de direcci\xF3n ("C.1", "C-1", "Casa 2", "Mz B", "Lote 5", "#123", "Cliente 3") ni barrios/zonas. OJO: si el \xFAnico nombre de persona aparece junto al yape (ej: "Mk yape 987654321"), ese ES el cliente. Si la foto no tiene ning\xFAn nombre de persona, devuelve "".
- zona: el distrito o zona DE LA ENTREGA (ej: San Miguel, La Perla, Cercado, SMP). Solo el nombre, sin "Distrito de".
- referencia: el punto de referencia del LUGAR DE ENTREGA si aparece (ej: "frente a la bodega", "port\xF3n azul") \u2014 c\xF3mo RECONOCER la casa, no qu\xE9 llev\xE1s.
- observacion: los COMENTARIOS u observaciones del pedido \u2014 QU\xC9 lleva o env\xEDa el cliente (ej: "una bolsa", "un artefacto", "una silla de oficina", "documento") o c\xF3mo manejarlo (ej: "es fr\xE1gil", "tocar el timbre", "dejar en recepci\xF3n"). En inDrive est\xE1 en la secci\xF3n "Comentarios" o "Observaciones". Copiala tal cual. NO es la referencia del lugar ni la direcci\xF3n. Si no aparece, "".
- telefono: el celular del cliente si aparece (d\xEDgitos y espacios). B\xDASCALO BIEN: suele estar como "tel\xE9fono", "celular", "contacto" o en el propio chat. Es MUY importante para el cobro.
- yapeNombre: si aparece la palabra "yape" o "plin", el NOMBRE que la acompa\xF1a (ej: en "Mk yape 987654321" es "Mk"). Si no aparece, "".
- yapeNumero: el n\xFAmero de la cuenta yape/plin que aparece en la foto, SOLO d\xEDgitos (ej: "987654321"). Si no aparece, "".
- tarifa: el precio/tarifa del viaje S\xCD Y SOLO S\xCD aparece escrito expl\xEDcitamente (ej: "S/ 8.50", "8 soles", "16"). Solo el n\xFAmero ("8.50"). Si no aparece, "".

EJEMPLO 1 (pedido de pueblo joven, UNA sola direcci\xF3n) \u2014 la foto dice:
C.1
Barrio XV Popular de Intereses Social Proyecto
Mk yape 980811297
16
La respuesta correcta es:
{"cliente":"Mk","direccionA":"","direccion":"C.1 Barrio XV Popular de Intereses Social Proyecto","paradas":[],"zona":"","referencia":"","observacion":"","telefono":"","yapeNombre":"Mk","yapeNumero":"980811297","tarifa":"16"}
F\xEDjate: "C.1" es la CALLE \u2192 va al INICIO de la direccion; "Mk" es la PERSONA \u2192 va en cliente (y en yapeNombre). Sin entregas extra \u2192 "paradas": [].

EJEMPLO 2 (captura de inDrive con las DOS direcciones + comentario) \u2014 la foto dice:
Recoger en
Av. Sucre 1450 \u2014 San Miguel
Entregar en
C.1 Mz B Lt 5, Barrio XV
Comentarios: Llevo una bolsa con un artefacto peque\xF1o
La respuesta correcta es:
{"cliente":"","direccionA":"Av. Sucre 1450 \u2014 San Miguel","direccion":"C.1 Mz B Lt 5, Barrio XV","paradas":[],"zona":"","referencia":"","observacion":"Llevo una bolsa con un artefacto peque\xF1o","telefono":"","yapeNombre":"","yapeNumero":"","tarifa":""}
F\xEDjate: el recojo va en direccionA (etiqueta "Recoger en"), la entrega en direccion (etiqueta "Entregar en"), y el comentario de QU\xC9 se lleva va en observacion.

EJEMPLO 3 (MULTI-PUNTO \u2014 un solo pedido con varias entregas) \u2014 la foto dice:
Recoger en
Av. Sucre 1450 \u2014 San Miguel
Entregar en
C.1 Mz B Lt 5, Barrio XV
Entregar en
Jr. Los \xC1lamos 245, SMP
La respuesta correcta es:
{"cliente":"","direccionA":"Av. Sucre 1450 \u2014 San Miguel","direccion":"C.1 Mz B Lt 5, Barrio XV","paradas":["Jr. Los \xC1lamos 245, SMP"],"zona":"","referencia":"","observacion":"","telefono":"","yapeNombre":"","yapeNumero":"","tarifa":""}
F\xEDjate: la PRIMERA entrega va en "direccion" (B), la SEGUNDA va en "paradas" (C) \u2014 el recojo JAM\xC1S va en paradas.

REGLAS DE ORO:
- Copia el texto EXACTO de la foto. No corrijas ortograf\xEDa. NO INVENTES NADA. No repitas palabras pegadas (si la foto dice "Barrio XV", es "Barrio XV", no "Barrio Barrio XV").
- Si un dato no aparece en la foto, devuelve "" (cadena vac\xEDa), y "paradas" como [] si no hay entregas extra.
- Responde SOLO el JSON, con EXACTAMENTE estas claves: cliente, direccionA, direccion, paradas, zona, referencia, observacion, telefono, yapeNombre, yapeNumero, tarifa.`;
var PROMPT_CLAUDE_EXTRA = `

IMPORTANTE: Respond\xE9 \xDANICAMENTE con el objeto JSON, sin markdown, sin \`\`\` y sin explicaciones.`;
function base64Limpio(b64) {
  const i = b64.indexOf(",");
  return i >= 0 && b64.startsWith("data:") ? b64.slice(i + 1) : b64;
}
var ErrorOcr = class extends Error {
  // F-ID2.4: pista técnica — proveedor · modelo · mensaje de la API
  constructor(codigo, detalle) {
    super(mensajeErrorOcr(codigo));
    this.codigo = codigo;
    this.detalle = detalle;
  }
};
async function fetchConTimeout(url, headers, body, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}
async function llamarGemini(apiKey, body, ms) {
  let ultimoError = new ErrorOcr("desconocido");
  const probados = [];
  for (const modelo of MODELOS_GEMINI) {
    try {
      const res = await fetchConTimeout(
        `${URL_GEMINI}/${modelo}:generateContent`,
        { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
        ms
      );
      const data = await res.json().catch(() => ({}));
      probados.push(modelo);
      if (res.status === 200) {
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const texto = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
        const rescate = texto || parts.map((p) => p.text ?? "").join("");
        if (!rescate) {
          ultimoError = new ErrorOcr("sin-datos", `gemini \xB7 ${modelo} \xB7 respondi\xF3 vac\xEDo`);
          continue;
        }
        return { texto: rescate, modelo };
      }
      const msg = (data.error?.message ?? "").toLowerCase();
      const crudo = (data.error?.message ?? "").slice(0, 140);
      if (res.status === 400 && msg.includes("location is not supported"))
        throw new ErrorOcr("region", `gemini \xB7 ${modelo} \xB7 ${crudo}`);
      if ((res.status === 400 || res.status === 402 || res.status === 403) && (msg.includes("prepayment") || msg.includes("credits are depleted") || msg.includes("billing")))
        throw new ErrorOcr("creditos", `gemini \xB7 ${modelo} \xB7 ${crudo}`);
      if (res.status === 404 || res.status === 400 && (msg.includes("not found") || msg.includes("not supported"))) {
        ultimoError = new ErrorOcr("desconocido", `gemini \xB7 ${modelo} \xB7 ${crudo}`);
        continue;
      }
      if (res.status === 400 && (msg.includes("api key") || msg.includes("api_key")))
        throw new ErrorOcr("key-invalida", `gemini \xB7 ${modelo} \xB7 ${crudo}`);
      if (res.status === 403) throw new ErrorOcr("api-bloqueada", `gemini \xB7 ${modelo} \xB7 ${crudo}`);
      if (res.status === 429) throw new ErrorOcr("quota", `gemini \xB7 ${modelo} \xB7 ${crudo}`);
      ultimoError = new ErrorOcr("desconocido", `gemini \xB7 ${modelo} \xB7 ${crudo}`);
      continue;
    } catch (e) {
      if (e instanceof ErrorOcr) throw e;
      throw new ErrorOcr("red", "la conexi\xF3n se cort\xF3 mandando la foto (\xBFse\xF1al muy lenta?)");
    }
  }
  if (!ultimoError.detalle) ultimoError.detalle = `probados: ${probados.join(", ")}`;
  throw ultimoError;
}
async function llamarClaude(apiKey, body, ms) {
  let ultimoError = new ErrorOcr("desconocido");
  const probados = [];
  for (const modelo of MODELOS_CLAUDE) {
    try {
      const res = await fetchConTimeout(
        URL_CLAUDE,
        {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          // Permite llamar a Anthropic directo desde la app (sin servidor propio)
          "anthropic-dangerous-direct-browser-access": "true"
        },
        { ...body, model: modelo },
        ms
      );
      const data = await res.json().catch(() => ({}));
      probados.push(modelo);
      if (res.status === 200) {
        const texto = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
        if (!texto) {
          ultimoError = new ErrorOcr("sin-datos", `claude \xB7 ${modelo} \xB7 respondi\xF3 vac\xEDo`);
          continue;
        }
        return { texto, modelo };
      }
      const msg = (data.error?.message ?? "").toLowerCase();
      const crudo = (data.error?.message ?? "").slice(0, 140);
      if (res.status === 404 || res.status === 400 && msg.includes("model")) {
        ultimoError = new ErrorOcr("desconocido", `claude \xB7 ${modelo} \xB7 ${crudo}`);
        continue;
      }
      if (res.status === 401) throw new ErrorOcr("key-invalida", `claude \xB7 ${modelo} \xB7 ${crudo}`);
      if (res.status === 429) throw new ErrorOcr("quota", `claude \xB7 ${modelo} \xB7 ${crudo}`);
      if (res.status === 403) throw new ErrorOcr("api-bloqueada", `claude \xB7 ${modelo} \xB7 ${crudo}`);
      ultimoError = new ErrorOcr("desconocido", `claude \xB7 ${modelo} \xB7 ${crudo}`);
      continue;
    } catch (e) {
      if (e instanceof ErrorOcr) throw e;
      throw new ErrorOcr("red", "la conexi\xF3n se cort\xF3 mandando la foto (\xBFse\xF1al muy lenta?)");
    }
  }
  if (!ultimoError.detalle) ultimoError.detalle = `probados: ${probados.join(", ")}`;
  throw ultimoError;
}
async function llamarIA(apiKey, p) {
  const proveedor = detectarProveedor(apiKey);
  if (!proveedor) throw new ErrorOcr("formato-key");
  if (proveedor === "gemini") {
    const parts = [{ text: p.prompt }];
    if (p.imagenB64) {
      parts.push({ inline_data: { mime_type: "image/jpeg", data: base64Limpio(p.imagenB64) } });
    }
    const body2 = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0,
        // F-ID2.4: SIN responseSchema — con los modelos 3.x "pensantes", el
        // modo estructurado a veces responde VACÍO o rechaza el payload.
        // responseMimeType + prompt estricto + parser robusto alcanzan.
        // (Y sin maxOutputTokens tampoco: bug F-ID2.2 del ping mudo)
        ...p.imagenB64 ? { responseMimeType: "application/json" } : {}
      }
    };
    const r2 = await llamarGemini(apiKey, body2, p.imagenB64 ? TIMEOUT_CON_IMAGEN : TIMEOUT_SIN_IMAGEN);
    return { ...r2, proveedor };
  }
  const content = [{ type: "text", text: p.prompt + PROMPT_CLAUDE_EXTRA }];
  if (p.imagenB64) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: base64Limpio(p.imagenB64) }
    });
  }
  const body = {
    max_tokens: p.imagenB64 ? 1024 : 16,
    temperature: 0,
    messages: [{ role: "user", content }]
  };
  const r = await llamarClaude(apiKey, body, p.imagenB64 ? TIMEOUT_CON_IMAGEN : TIMEOUT_SIN_IMAGEN);
  return { ...r, proveedor };
}
function parsearJsonTexto(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    const m = texto.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new ErrorOcr("sin-datos");
  }
}
function pareceCodigoDireccion(s) {
  const t = s.trim();
  if (!t || !/\d/.test(t)) return false;
  return /^(#?\d{1,4}|(c|calle|casa|clte|cliente|lt|lote|mz|manzana|psj|pasaje|urb|etapa|sector|bloque|int|dpto|km)[\s.:-]*#?\d{0,4}[a-z]?(\s+(mz|lt|lote|manzana|etapa)\s*[a-z]?\d{0,4})*)$/i.test(t);
}
function pareceTrozoDireccion(s) {
  const t = s.trim().toLowerCase();
  if (!t) return false;
  const claves = [
    "barrio",
    "avenida",
    "av",
    "av.",
    "jiron",
    "jir\xF3n",
    "jr",
    "jr.",
    "calle",
    "urbanizacion",
    "urbanizaci\xF3n",
    "urb",
    "urb.",
    "mz",
    "manzana",
    "lote",
    "lt",
    "etapa",
    "proyecto",
    "pueblo",
    "asociacion",
    "asociaci\xF3n",
    "aa.hh",
    "sector",
    "pasaje",
    "psj",
    "carretera",
    "malecon",
    "malec\xF3n",
    "interes",
    "inter\xE9s"
  ];
  let hits = 0;
  for (const k of claves) {
    if (new RegExp(`(^|\\s)${k.replace(".", "\\.")}(s|$)`, "i").test(t)) hits++;
  }
  return hits >= 2 || hits >= 1 && t.split(/\s+/).length >= 4;
}
function sinPalabrasRepetidas(s) {
  return s.replace(/\b(\S+)(\s+\1\b)+/gi, "$1").replace(/\s{2,}/g, " ").trim();
}
function normalizarDir(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s{2,}/g, " ").trim();
}
function sanearDatos(d) {
  const limpio = { ...d };
  const paradasLimpias = sanearParadas(limpio.paradas, limpio.direccionA, limpio.direccion);
  if (limpio.cliente && (pareceCodigoDireccion(limpio.cliente) || pareceTrozoDireccion(limpio.cliente))) {
    limpio.direccion = limpio.direccion ? `${limpio.cliente} ${limpio.direccion}`.trim() : limpio.cliente;
    limpio.cliente = "";
  }
  if (!limpio.cliente && limpio.yapeNombre) limpio.cliente = limpio.yapeNombre;
  limpio.direccion = sinPalabrasRepetidas(limpio.direccion);
  limpio.direccionA = sinPalabrasRepetidas(limpio.direccionA);
  limpio.zona = sinPalabrasRepetidas(limpio.zona);
  limpio.yapeNumero = limpio.yapeNumero.replace(/[^0-9]/g, "");
  if (limpio.direccionA && limpio.direccion && normalizarDir(limpio.direccionA) === normalizarDir(limpio.direccion)) {
    limpio.direccionA = "";
  }
  if (!limpio.direccion && limpio.direccionA) {
    limpio.direccion = limpio.direccionA;
    limpio.direccionA = "";
  }
  limpio.observacion = sinPalabrasRepetidas(limpio.observacion);
  const saneado = limpio;
  saneado.paradas = paradasLimpias;
  return saneado;
}
function sanearParadas(crudo, dirA, dirB) {
  let lista = [];
  if (Array.isArray(crudo)) lista = crudo;
  else if (typeof crudo === "string" && crudo.trim()) lista = [crudo];
  const normA = normalizarDir(dirA);
  const normB = normalizarDir(dirB);
  const vistas = /* @__PURE__ */ new Set();
  const limpias = [];
  for (const p of lista) {
    if (typeof p !== "string") continue;
    const parada = sinPalabrasRepetidas(p).trim();
    if (!parada) continue;
    const n = normalizarDir(parada);
    if (!n) continue;
    if (normA && n === normA) continue;
    if (normB && n === normB) continue;
    if (vistas.has(n)) continue;
    vistas.add(n);
    limpias.push(parada);
    if (limpias.length >= 3) break;
  }
  return limpias;
}
var __escanerTests = {
  sanearDatos,
  sanearParadas,
  parsearJsonTexto,
  pareceCodigoDireccion,
  pareceTrozoDireccion,
  normalizarDir,
  PROMPT
};

// src/utils/moneda.ts
function parseMonedaPeru(valor) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }
  let s = String(valor ?? "").trim();
  if (!s) return 0;
  s = s.replace(/s\/\.?\s*/gi, "").replace(/soles?/gi, "").replace(/[$]/gi, "");
  s = s.replace(/\s+/g, "").replace(/'/g, "");
  if (!s || s === "-" || s === "." || s === ",") return 0;
  const tieneComa = s.includes(",");
  const tienePunto = s.includes(".");
  if (tieneComa && tienePunto) {
    const posComa = s.lastIndexOf(",");
    const posPunto = s.lastIndexOf(".");
    if (posPunto > posComa) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    }
  } else if (tieneComa) {
    const partes = s.split(",");
    s = partes.length > 2 ? partes.join("") : s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// src/services/escanerRuta.ts
var PROMPT_RUTA = `Eres el esc\xE1ner de pedidos de RiderTrack, la app de la ruta de reparto de una empresa de delivery en Lima, Per\xFA.

Te mando la FOTO de un mensaje que le lleg\xF3 al repartidor: casi siempre es un CHAT o CAPTURA de WhatsApp (a veces una nota o sticker), donde un cliente o alguien de ventas le pasa los datos de un pedido EXTRA \u2014 un pedido que sali\xF3 al momento y NO viene en el Excel de la ruta. El mensaje puede venir desordenado, con emojis, con saludos ("hola", "buenas tardes"), con despedidas o con cualquier conversaci\xF3n alrededor.

Extrae SOLO los datos del pedido M\xC1S RECIENTE que tenga datos completos, con estas reglas:

- cliente: el NOMBRE DE PERSONA del cliente (qui\xE9n recibe o pide el pedido). Ej: "Mar\xEDa Fernanda L\xF3pez", "Kevin Rojas", "Sra. Rosa Quispe". Puede venir como "Cliente:", "Nombre:", "para:" o dentro de la frase. NUNCA pongas ac\xE1 c\xF3digos de direcci\xF3n ("C.1", "C-1", "Casa 2", "Mz B", "Lote 5", "#123"), barrios ni apodos de zonas. En los pueblos j\xF3venes las calles van con C\xD3DIGO ("C.1" es Calle 1, "Mz B Lt 5" es Manzana B Lote 5) \u2014 esos c\xF3digos son PARTE DE LA DIRECCI\xD3N, jam\xE1s nombres de personas. Si no hay ning\xFAn nombre de persona, devuelve "".
- direccion: la direcci\xF3n de ENTREGA completa, tal cual: avenida/calle/jir\xF3n, n\xFAmero, urbanizaci\xF3n/proyecto/barrio, manzana/lote o c\xF3digo ("C.1 Mz B Lt 5"), interior, departamento. Puede venir como "Direcci\xF3n:", "dire:", "ubica:" o dentro de la frase. Si el mensaje tambi\xE9n nombra el distrito al final ("\u2026, San Miguel"), dejalo incluido en la direcci\xF3n.
- distrito: el DISTRITO de la entrega si aparece (San Miguel, SMP, Callao, La Perla, Cercado, Bellavista\u2026). SOLO el nombre, sin "Distrito de" ni "Distrito:".
- referencia: c\xF3mo RECONOCER el lugar si aparece ("frente a la bodega", "port\xF3n azul", "casa de 2 pisos", "al costado del grifo"). Es el punto de referencia DEL LUGAR \u2014 no la direcci\xF3n ni lo que lleva.
- telefono: el celular del cliente si aparece. Suelen mandarlo con espacios, con +51 o con 51 adelante. Devolvelo SOLO D\xCDGITOS, SIN el 51 del pa\xEDs (9 d\xEDgitos): en "+51 988 111 222" el celular es "988111222".
- producto: QU\xC9 lleva el pedido si aparece ("una cocina", "2 cajas", "un colch\xF3n", "una bolsa de ropa"). Puede venir como "Producto:", "llevo", "env\xEDa".
- cobrar: el MONTO a cobrar S\xCD Y SOLO S\xCD aparece escrito expl\xEDcitamente ("S/ 45.90", "S/.45,90", "89 soles", "pagar\xE1 120"). Solo el n\xFAmero ("45.90"). Si el mensaje no dice el monto, devuelve "" \u2014 NUNCA lo adivines.

REGLAS DE ORO:
1. Copia el texto EXACTO del mensaje. No corrijas ortograf\xEDa. NO INVENTES NADA. Si un dato no aparece, devuelve "" (cadena vac\xEDa).
2. No repitas palabras pegadas (si el mensaje dice "Barrio 2 de Octubre", es "Barrio 2 de Octubre", no "Barrio Barrio 2 de Octubre").
3. El nombre de persona JAMAS es un c\xF3digo de direcci\xF3n ni un barrio.
4. Ignora saludos, despedidas, "gracias", emojis y conversaci\xF3n vieja: SOLO los datos del pedido m\xE1s reciente.
5. Responde SOLO el objeto JSON, con EXACTAMENTE estas claves: cliente, direccion, distrito, referencia, telefono, producto, cobrar.

EJEMPLO 1 (WhatsApp de ventas con todo) \u2014 la foto dice:
"Buenas tardes Rudy \u{1F60A}
Te paso un extra para hoy porfa:
Cliente: Mar\xEDa Fernanda L\xF3pez
Direcci\xF3n: Av. Sucre 1234, San Miguel
Ref: frente al grifo Repsol
Cel: 988 111 222
Producto: una cocina
Monto: S/ 45.90
Gracias crack!"
La respuesta correcta es:
{"cliente":"Mar\xEDa Fernanda L\xF3pez","direccion":"Av. Sucre 1234, San Miguel","distrito":"San Miguel","referencia":"frente al grifo Repsol","telefono":"988111222","producto":"una cocina","cobrar":"45.90"}

EJEMPLO 2 (mensaje desordenado del propio cliente) \u2014 la foto dice:
"holaa, me llamo Kevin Rojas
mi dire es C.3 Mz A Lt 12, Barrio 2 de Octubre, SMP
pagar\xE1 al recibir, son 89 soles
telf 51 998 776 554"
La respuesta correcta es:
{"cliente":"Kevin Rojas","direccion":"C.3 Mz A Lt 12, Barrio 2 de Octubre, SMP","distrito":"SMP","referencia":"","telefono":"998776554","producto":"","cobrar":"89"}
F\xEDjate: "C.3 Mz A Lt 12" es la CALLE del pueblo joven, va completa en direccion; el "SMP" del final tambi\xE9n es el distrito; "51 998 776 554" \u2192 el celular es 998776554 (sin el 51); "son 89 soles" \u2192 cobrar 89.

EJEMPLO 3 (solo lo m\xEDnimo) \u2014 la foto dice:
"extra: Sra. Rosa Quispe \u2014 Jr. Los \xC1lamos 245, La Perla"
La respuesta correcta es:
{"cliente":"Rosa Quispe","direccion":"Jr. Los \xC1lamos 245, La Perla","distrito":"La Perla","referencia":"","telefono":"","producto":"","cobrar":""}
F\xEDjate: sin monto \u2192 cobrar ""; sin celular \u2192 ""; la referencia y el producto no aparecen \u2192 "".`;
var PROMPT_CLAUDE_EXTRA2 = `

IMPORTANTE: Respond\xE9 \xDANICAMENTE con el objeto JSON, sin markdown, sin \`\`\` y sin explicaciones.`;
function palabrasSinRepetir(s) {
  return s.replace(/\b(\S+)(\s+\1\b)+/gi, "$1").replace(/\s{2,}/g, " ").trim();
}
function sanearClienteWA(crudo) {
  const d = {
    cliente: (crudo.cliente ?? "").trim(),
    direccion: (crudo.direccion ?? "").trim(),
    distrito: (crudo.distrito ?? "").trim(),
    referencia: (crudo.referencia ?? "").trim(),
    telefono: (crudo.telefono ?? "").trim(),
    producto: (crudo.producto ?? "").trim()
  };
  if (d.cliente && (__escanerTests.pareceCodigoDireccion(d.cliente) || __escanerTests.pareceTrozoDireccion(d.cliente))) {
    d.direccion = d.direccion ? `${d.cliente} ${d.direccion}`.trim() : d.cliente;
    d.cliente = "";
  }
  let tel = (d.telefono ?? "").replace(/[^0-9]/g, "");
  if (tel.length === 11 && tel.startsWith("51")) tel = tel.slice(2);
  else if (tel.length > 9) tel = tel.slice(-9);
  d.telefono = tel;
  d.distrito = d.distrito.replace(/^distrito\s*de\s+/i, "").replace(/^distrito[:\s]+/i, "").trim();
  d.direccion = palabrasSinRepetir(d.direccion ?? "");
  d.distrito = palabrasSinRepetir(d.distrito ?? "");
  d.referencia = palabrasSinRepetir(d.referencia ?? "");
  d.producto = palabrasSinRepetir(d.producto ?? "");
  d.cliente = palabrasSinRepetir(d.cliente ?? "");
  const cobrarCrudo = crudo.cobrar;
  let cobrar = null;
  if (typeof cobrarCrudo === "number" && Number.isFinite(cobrarCrudo) && cobrarCrudo > 0) {
    cobrar = cobrarCrudo;
  } else if (typeof cobrarCrudo === "string" && cobrarCrudo.trim()) {
    const n = parseMonedaPeru(cobrarCrudo);
    cobrar = n > 0 ? n : null;
  }
  return {
    cliente: d.cliente,
    direccion: d.direccion,
    distrito: d.distrito,
    referencia: d.referencia,
    telefono: d.telefono,
    producto: d.producto,
    cobrar
  };
}
var ErrorEscanerRuta = class extends Error {
  constructor(codigo, detalle) {
    super(mensajeErrorOcr(codigo));
    this.codigo = codigo;
    this.detalle = detalle;
  }
};
var ERRORES_RESCATABLES = [
  "creditos",
  "quota",
  "region",
  "api-bloqueada",
  "key-invalida"
];
async function escanearClienteWhatsApp(fotoBase64, geminiKey, claudeKey) {
  const gKey = (geminiKey ?? "").trim();
  const cKey = (claudeKey ?? "").trim();
  const hayG = !!detectarProveedor(gKey);
  const hayC = !!detectarProveedor(cKey);
  if (!hayG && !hayC) {
    if (gKey || cKey) throw new ErrorEscanerRuta("formato-key");
    throw new ErrorEscanerRuta("sin-key");
  }
  const intentos = [];
  if (hayG) intentos.push({ key: gKey, esClaude: false });
  if (hayC) intentos.push({ key: cKey, esClaude: true });
  let falloPrimario = null;
  for (let i = 0; i < intentos.length; i++) {
    try {
      const { texto } = await llamarIA(intentos[i].key, {
        prompt: PROMPT_RUTA + (intentos[i].esClaude ? PROMPT_CLAUDE_EXTRA2 : ""),
        imagenB64: fotoBase64
      });
      const d = parsearJsonTexto(texto);
      const datos = sanearClienteWA({
        cliente: d.cliente ?? "",
        direccion: d.direccion ?? "",
        distrito: d.distrito ?? "",
        referencia: d.referencia ?? "",
        telefono: d.telefono ?? "",
        producto: d.producto ?? "",
        cobrar: d.cobrar ?? ""
      });
      if (!datos.cliente && !datos.direccion && !datos.distrito && !datos.referencia && !datos.telefono && !datos.producto && datos.cobrar === null) {
        throw new ErrorEscanerRuta("sin-datos");
      }
      return datos;
    } catch (e) {
      const err = e instanceof ErrorEscanerRuta ? e : new ErrorEscanerRuta(
        // errores de la propia llamarIA (formato-key, red, cuenta…) o basura
        (() => {
          const codigo = e.codigo;
          if (codigo && mensajeErrorOcr(codigo)) return codigo;
          return "desconocido";
        })(),
        e.message?.slice(0, 140)
      );
      const quedaSiguiente = i < intentos.length - 1;
      if (quedaSiguiente && (ERRORES_RESCATABLES.includes(err.codigo) || err.codigo === "sin-datos")) {
        if (!falloPrimario) falloPrimario = err;
        continue;
      }
      if (err.codigo === "sin-datos" || err.codigo === "red") throw err;
      throw falloPrimario ?? err;
    }
  }
  throw falloPrimario ?? new ErrorEscanerRuta("desconocido");
}
var __escanerRutaTests = {
  sanearClienteWA,
  palabrasSinRepetir,
  PROMPT_RUTA
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  __escanerRutaTests,
  escanearClienteWhatsApp,
  sanearClienteWA
});
