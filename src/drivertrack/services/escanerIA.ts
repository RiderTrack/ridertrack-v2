// ═══════════════════════════════════════════════════════════
// 📷 DriverTrack — Escáner de dirección con IA (F-ID2 → F-ID2.6)
// Foto del pedido → la IA lee cliente, dirección, zona,
// referencia, teléfono, tarifa y yape → el formulario se llena solo.
//
// F-ID2.6 — escáner v3, NOMBRE REAL + YAPE (caso real del usuario):
//   · La IA puso "C.1" como cliente — pero C.1 es la CALLE 1 del
//     barrio (código de pueblo joven/proyecto de vivienda) → el
//     WhatsApp salió "Hola C.1!" 😅 y el nombre real nunca llegó.
//   · El pedido traía "Mk yape 980811297" y la IA lo IGNORABA.
//     Ahora: yapeNombre + yapeNumero con campos propios, y si el
//     único nombre de persona aparece junto al yape, ESE es el
//     cliente ("Mk" en el caso real).
//   · Saneamiento POST-scan en código (no solo el prompt): si la IA
//     vuelve a poner un código o trozo de dirección en "cliente",
//     se mueve a la dirección y el cliente se rescata del yape.
//     Y "Barrio Barrio XV" (palabra pegada repetida) → "Barrio XV".
//   · Si la foto no trae teléfono pero sí yape, el celular se
//     llena con el número del yape (en Perú el yape ES el celular
//     del cliente) — editable, como todo el formulario.
//
// F-ID2.5 — DOBLE key con RESPALDO automático:
//   · Se pueden configurar AMBAS keys (Gemini + Claude).
//     El escáner usa la que esté, y si Gemini falla con un error
//     "de la cuenta" (sin créditos, quota, región…) cae SOLO a
//     Claude y escanea igual. Sin volver al manuscrito.
//   · Errores traducidos al español CLARO — el caso real: Gemini
//     respondía "Your prepayment credits are depleted…" y el
//     usuario veía un mamarracho en inglés que no entendía.
//   · El prompt pide EXPLÍCITAMENTE el teléfono — necesaria para
//     el botón de cobro por WhatsApp (F-ID2.5).
//
// F-ID2.4 — escáner a prueba de balas:
//   · Sin responseSchema (los 3.x pensantes + schema a veces
//     responden VACÍO o rechazan el payload) — basta el prompt
//     + responseMimeType + parser robusto
//   · Un modelo que responde vacío ya NO aborta la cadena:
//     se prueba el siguiente
//   · Si el JSON quedó atrapado en los "pensamientos" (thoughts),
//     se rescata de ahí
//   · Timeout 45s con foto (red lenta) / 20s sin foto
//   · Errores con DETALLE técnico (proveedor + modelo + mensaje
//     de la API) para saber QUÉ pasó en el teléfono real
//
// F-ID2.1 — DOS proveedores, se detectan solos por la key:
//   · Gemini → "AIza…" (clásica) o "AQ.…" (formato NUEVO que
//     entrega AI Studio hoy) — gratis en aistudio.google.com
//   · Claude → "sk-ant-…" (Anthropic, de pago) — la misma API
//     que usa rudy-bot
//
// OJO modelos (set 2026): Google retiró gemini-2.0-flash y
// gemini-2.5-flash para cuentas nuevas → usamos la generación
// 3.x con cadena de respaldo. Auth por header x-goog-api-key
// (funciona con AMBOS formatos de key).
// La key vive SOLO en el teléfono (localStorage). Local-first.
// ═══════════════════════════════════════════════════════════

export interface DatosEscaneados {
  cliente: string;
  direccion: string;
  zona: string;
  referencia: string;
  telefono: string;
  yapeNombre: string; // F-ID2.6: "Mk" en "Mk yape 980811297"
  yapeNumero: string; // F-ID2.6: "980811297" — solo dígitos
  tarifa: number | null; // null si la foto no muestra precio
}

export type CodigoErrorOcr =
  | 'sin-key'
  | 'formato-key'
  | 'key-invalida'
  | 'api-bloqueada'
  | 'region'
  | 'quota'
  | 'creditos'
  | 'red'
  | 'sin-datos'
  | 'desconocido';

export function mensajeErrorOcr(c: CodigoErrorOcr): string {
  switch (c) {
    case 'sin-key':
      return 'Configurá tu key de IA en Ajustes (Gemini gratis, 1 minuto)';
    case 'formato-key':
      return 'Eso no parece una key — Gemini empieza con "AIza" o "AQ." · Claude con "sk-ant-"';
    case 'key-invalida':
      return 'La key no es válida — copiala de nuevo desde AI Studio o Anthropic';
    case 'api-bloqueada':
      return 'Esa key no tiene la IA habilitada. Para Gemini, creala directo en aistudio.google.com/apikey';
    case 'region':
      return 'Gemini no está disponible desde tu región o red actual — probá con otra conexión o usá una key de Claude';
    case 'quota':
      return 'La key llegó a su límite del momento — reintentá en un rato';
    case 'creditos':
      return 'Tu key de Gemini se quedó SIN CRÉDITOS 💳 — crea una nueva gratis en aistudio.google.com/apikey o recargá en ai.studio → Billing. Si configuraste tu token de Claude, el escáner ya lo usó de respaldo';
    case 'red':
      return 'Sin internet o conexión lenta — revisá tu señal';
    case 'sin-datos':
      return 'No pude leer nada en la foto 🤔 — probá con una captura nítida desde 🖼️ Galería, o escribí a mano con la foto de guía';
    default:
      return 'Algo falló escaneando — probá de nuevo o escribí a mano';
  }
}

export type ProveedorIA = 'gemini' | 'claude';

/** Detecta el proveedor por el prefijo de la key. Null = no parece una key. */
export function detectarProveedor(apiKey: string): ProveedorIA | null {
  const k = apiKey.trim();
  if (k.startsWith('AIza') || k.startsWith('AQ.')) return 'gemini';
  if (k.startsWith('sk-ant-')) return 'claude';
  return null;
}

const MODELOS_GEMINI = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash'];
const MODELOS_CLAUDE = ['claude-haiku-4-5-20251001', 'claude-3-5-haiku-20241022'];
const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const URL_CLAUDE = 'https://api.anthropic.com/v1/messages';
// F-ID2.4: con foto el upload puede ser ~500 KB — en red lenta
// necesita aire. Sin foto (ping de Probar key) basta algo corto.
const TIMEOUT_CON_IMAGEN = 45000;
const TIMEOUT_SIN_IMAGEN = 20000;

const PROMPT = `Eres el escáner de pedidos de DriverTrack, una app de delivery motorizado en Lima, Perú.

Te mando la FOTO de un pedido. Puede ser: una captura de pantalla de inDrive, Rappi o PedidosYa; un chat de WhatsApp; una nota o sticker escrito a mano; o el sticker del paquete. MUCHOS pedidos son de pueblos jóvenes y proyectos de vivienda: las calles van con CÓDIGO — "C.1" es Calle 1, "C.2" es Calle 2, y "Mz B Lt 5" es Manzana B Lote 5. Esos códigos son PARTE DE LA DIRECCIÓN, jamás nombres de personas.

Extrae los datos del ENVÍO con estas reglas:
- cliente: el NOMBRE DE PERSONA del cliente (quién recibe o pide). Ej: "Mk", "María Fernández", "Kevin Rojas". NUNCA pongas acá códigos de dirección ("C.1", "C-1", "Casa 2", "Mz B", "Lote 5", "#123", "Cliente 3") ni barrios/zonas. OJO: si el único nombre de persona aparece junto al yape (ej: "Mk yape 987654321"), ese ES el cliente. Si la foto no tiene ningún nombre de persona, devuelve "".
- direccion: la dirección de ENTREGA COMPLETA tal cual está escrita: avenida/calle/jirón con su número O CÓDIGO ("C.1", "Mz C Lt 5"), urbanización/barrio/proyecto/etapa, interior, departamento, manzana, lote. Si hay varias direcciones, la de entrega final. NUNCA metas nombres de personas acá.
- zona: el distrito o zona (ej: San Miguel, La Perla, Cercado, SMP). Solo el nombre, sin "Distrito de".
- referencia: el punto de referencia si aparece (ej: "frente a la bodega", "portón azul").
- telefono: el celular del cliente si aparece (dígitos y espacios). BÚSCALO BIEN: suele estar como "teléfono", "celular", "contacto" o en el propio chat. Es MUY importante para el cobro.
- yapeNombre: si aparece la palabra "yape" o "plin", el NOMBRE que la acompaña (ej: en "Mk yape 987654321" es "Mk"). Si no aparece, "".
- yapeNumero: el número de la cuenta yape/plin que aparece en la foto, SOLO dígitos (ej: "987654321"). Si no aparece, "".
- tarifa: el precio/tarifa del viaje SÍ Y SOLO SÍ aparece escrito explícitamente (ej: "S/ 8.50", "8 soles", "16"). Solo el número ("8.50"). Si no aparece, "".

EJEMPLO REAL — la foto dice:
C.1
Barrio XV Popular de Intereses Social Proyecto
Mk yape 980811297
16
La respuesta correcta es:
{"cliente":"Mk","direccion":"C.1 Barrio XV Popular de Intereses Social Proyecto","zona":"","referencia":"","telefono":"","yapeNombre":"Mk","yapeNumero":"980811297","tarifa":"16"}
Fíjate: "C.1" es la CALLE → va al INICIO de la direccion; "Mk" es la PERSONA → va en cliente (y en yapeNombre).

REGLAS DE ORO:
- Copia el texto EXACTO de la foto. No corrijas ortografía. NO INVENTES NADA. No repitas palabras pegadas (si la foto dice "Barrio XV", es "Barrio XV", no "Barrio Barrio XV").
- Si un dato no aparece en la foto, devuelve "" (cadena vacía).
- Responde SOLO el JSON, con EXACTAMENTE estas claves: cliente, direccion, zona, referencia, telefono, yapeNombre, yapeNumero, tarifa.`;

// Claude no tiene responseSchema: se le exige el JSON por el prompt
const PROMPT_CLAUDE_EXTRA = `

IMPORTANTE: Respondé ÚNICAMENTE con el objeto JSON, sin markdown, sin \`\`\` y sin explicaciones.`;

// F-ID2.4: se SACÓ el responseSchema de los escaneos. Con los modelos
// 3.x "pensantes", el modo estructurado a veces devuelve vacío o
// rechaza el payload según la cuenta. El prompt ya exige el JSON y
// parsearJsonTexto() lo extrae aunque venga con texto alrededor.

/** "data:image/jpeg;base64,XXXX" → "XXXX" (las APIs quieren el base64 pelado). */
function base64Limpio(b64: string): string {
  const i = b64.indexOf(',');
  return i >= 0 && b64.startsWith('data:') ? b64.slice(i + 1) : b64;
}

class ErrorOcr extends Error {
  codigo: CodigoErrorOcr;
  detalle?: string; // F-ID2.4: pista técnica — proveedor · modelo · mensaje de la API
  constructor(codigo: CodigoErrorOcr, detalle?: string) {
    super(mensajeErrorOcr(codigo));
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

interface RespuestaGemini {
  // F-ID2.2: los modelos 3.x devuelven sus "pensamientos" como parts
  // marcadas thought:true — hay que saber ignorarlas
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  error?: { code?: number; message?: string };
}

interface RespuestaClaude {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
}

async function fetchConTimeout(url: string, headers: Record<string, string>, body: unknown, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Llama a Gemini probando la cadena de modelos. Auth por HEADER (validado con keys AQ. y AIza). */
async function llamarGemini(
  apiKey: string,
  body: Record<string, unknown>,
  ms: number,
): Promise<{ texto: string; modelo: string }> {
  let ultimoError: ErrorOcr = new ErrorOcr('desconocido');
  const probados: string[] = [];

  for (const modelo of MODELOS_GEMINI) {
    try {
      const res = await fetchConTimeout(
        `${URL_GEMINI}/${modelo}:generateContent`,
        { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        ms,
      );
      const data = (await res.json().catch(() => ({}))) as RespuestaGemini;
      probados.push(modelo);

      if (res.status === 200) {
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        // F-ID2.2: se filtran los "pensamientos" (thought:true) — antes
        // se pegaban junto a la respuesta y rompían el JSON
        const texto = parts.filter(p => !p.thought).map(p => p.text ?? '').join('');
        // F-ID2.4: si el modelo se "pensó" toda la respuesta, el JSON puede
        // haber quedado dentro de los thoughts → último recurso: unir TODO
        const rescate = texto || parts.map(p => p.text ?? '').join('');
        if (!rescate) {
          // F-ID2.4: antes un 200 vacío ABORTABA la cadena completa con
          // "sin-datos" sin probar los otros modelos. Ahora: soft-fail.
          ultimoError = new ErrorOcr('sin-datos', `gemini · ${modelo} · respondió vacío`);
          continue;
        }
        return { texto: rescate, modelo };
      }

      const msg = (data.error?.message ?? '').toLowerCase();
      const crudo = (data.error?.message ?? '').slice(0, 140);

      // Región/red bloqueada para Gemini (no depende del modelo → no seguir probando)
      if (res.status === 400 && msg.includes('location is not supported'))
        throw new ErrorOcr('region', `gemini · ${modelo} · ${crudo}`);

      // F-ID2.5: créditos prepago agotados (el error REAL que le salió al
      // usuario en su teléfono: "Your prepayment credits are depleted…")
      if (
        (res.status === 400 || res.status === 402 || res.status === 403) &&
        (msg.includes('prepayment') || msg.includes('credits are depleted') || msg.includes('billing'))
      )
        throw new ErrorOcr('creditos', `gemini · ${modelo} · ${crudo}`);

      // Modelo retirado o inexistente en esta cuenta → probar el siguiente de la cadena
      if (res.status === 404 || (res.status === 400 && (msg.includes('not found') || msg.includes('not supported')))) {
        ultimoError = new ErrorOcr('desconocido', `gemini · ${modelo} · ${crudo}`);
        continue;
      }
      if (res.status === 400 && (msg.includes('api key') || msg.includes('api_key')))
        throw new ErrorOcr('key-invalida', `gemini · ${modelo} · ${crudo}`);
      if (res.status === 403) throw new ErrorOcr('api-bloqueada', `gemini · ${modelo} · ${crudo}`);
      if (res.status === 429) throw new ErrorOcr('quota', `gemini · ${modelo} · ${crudo}`);
      // Otro error rarito: antes abortaba TODO — ahora prueba el siguiente modelo
      ultimoError = new ErrorOcr('desconocido', `gemini · ${modelo} · ${crudo}`);
      continue;
    } catch (e) {
      if (e instanceof ErrorOcr) throw e;
      // F-ID2.4: si la red se cortó (timeout/abort/DNS), los OTROS modelos
      // también van a fallar con la misma red → no perder 45s por modelo
      throw new ErrorOcr('red', 'la conexión se cortó mandando la foto (¿señal muy lenta?)');
    }
  }
  if (!ultimoError.detalle) ultimoError.detalle = `probados: ${probados.join(', ')}`;
  throw ultimoError;
}

/** Llama a Claude (Anthropic Messages API) — la misma que usa rudy-bot. */
async function llamarClaude(
  apiKey: string,
  body: Record<string, unknown>,
  ms: number,
): Promise<{ texto: string; modelo: string }> {
  let ultimoError: ErrorOcr = new ErrorOcr('desconocido');
  const probados: string[] = [];

  for (const modelo of MODELOS_CLAUDE) {
    try {
      const res = await fetchConTimeout(
        URL_CLAUDE,
        {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          // Permite llamar a Anthropic directo desde la app (sin servidor propio)
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        { ...body, model: modelo },
        ms,
      );
      const data = (await res.json().catch(() => ({}))) as RespuestaClaude;
      probados.push(modelo);

      if (res.status === 200) {
        const texto = (data.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('');
        if (!texto) {
          // F-ID2.4: 200 vacío → soft-fail, probar el siguiente modelo
          ultimoError = new ErrorOcr('sin-datos', `claude · ${modelo} · respondió vacío`);
          continue;
        }
        return { texto, modelo };
      }

      const msg = (data.error?.message ?? '').toLowerCase();
      const crudo = (data.error?.message ?? '').slice(0, 140);

      // Modelo no disponible en esta cuenta → probar el siguiente
      if (res.status === 404 || (res.status === 400 && msg.includes('model'))) {
        ultimoError = new ErrorOcr('desconocido', `claude · ${modelo} · ${crudo}`);
        continue;
      }
      if (res.status === 401) throw new ErrorOcr('key-invalida', `claude · ${modelo} · ${crudo}`);
      if (res.status === 429) throw new ErrorOcr('quota', `claude · ${modelo} · ${crudo}`);
      if (res.status === 403) throw new ErrorOcr('api-bloqueada', `claude · ${modelo} · ${crudo}`);
      ultimoError = new ErrorOcr('desconocido', `claude · ${modelo} · ${crudo}`);
      continue;
    } catch (e) {
      if (e instanceof ErrorOcr) throw e;
      throw new ErrorOcr('red', 'la conexión se cortó mandando la foto (¿señal muy lenta?)');
    }
  }
  if (!ultimoError.detalle) ultimoError.detalle = `probados: ${probados.join(', ')}`;
  throw ultimoError;
}

interface PeticionIA {
  prompt: string;
  imagenB64?: string; // si viene → es un escaneo con foto
}

interface ResultadoIA {
  texto: string;
  modelo: string;
  proveedor: ProveedorIA;
}

/** Enruta a Gemini o Claude según el prefijo de la key. */
async function llamarIA(apiKey: string, p: PeticionIA): Promise<ResultadoIA> {
  const proveedor = detectarProveedor(apiKey);
  if (!proveedor) throw new ErrorOcr('formato-key');
  if (proveedor === 'gemini') {
    const parts: unknown[] = [{ text: p.prompt }];
    if (p.imagenB64) {
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Limpio(p.imagenB64) } });
    }
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0,
        // F-ID2.4: SIN responseSchema — con los modelos 3.x "pensantes", el
        // modo estructurado a veces responde VACÍO o rechaza el payload.
        // responseMimeType + prompt estricto + parser robusto alcanzan.
        // (Y sin maxOutputTokens tampoco: bug F-ID2.2 del ping mudo)
        ...(p.imagenB64 ? { responseMimeType: 'application/json' } : {}),
      },
    };
    const r = await llamarGemini(apiKey, body, p.imagenB64 ? TIMEOUT_CON_IMAGEN : TIMEOUT_SIN_IMAGEN);
    return { ...r, proveedor };
  }

  // Claude
  const content: unknown[] = [{ type: 'text', text: p.prompt + PROMPT_CLAUDE_EXTRA }];
  if (p.imagenB64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64Limpio(p.imagenB64) },
    });
  }
  const body = {
    max_tokens: p.imagenB64 ? 1024 : 16,
    temperature: 0,
    messages: [{ role: 'user', content }],
  };
  const r = await llamarClaude(apiKey, body, p.imagenB64 ? TIMEOUT_CON_IMAGEN : TIMEOUT_SIN_IMAGEN);
  return { ...r, proveedor };
}

/** Extrae el JSON de la respuesta (por si viene envuelto en texto/markdown). */
function parsearJsonTexto(texto: string): Record<string, string> {
  try {
    return JSON.parse(texto) as Record<string, string>;
  } catch {
    const m = texto.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as Record<string, string>;
    throw new ErrorOcr('sin-datos');
  }
}

function parsearTarifa(crudo: string | undefined): number | null {
  if (!crudo) return null;
  const n = parseFloat(crudo.replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── F-ID2.6: SANEAMIENTO post-scan ──
// El caso real: la IA puso "C.1" (la CALLE 1 del barrio) como
// cliente y duplicó "Barrio Barrio". El prompt ahora lo enseña,
// pero por si el modelo mete la pata igual, acá se autocorrige.

/** ¿Esto parece un CÓDIGO de dirección y no un nombre de persona?
 *  "C.1", "C-1", "Casa 2", "Lote 5", "Mz B 12", "Cliente 3", "#12" */
function pareceCodigoDireccion(s: string): boolean {
  const t = s.trim();
  if (!t || !/\d/.test(t)) return false; // sin números → no es código
  return /^(#?\d{1,4}|(c|calle|casa|clte|cliente|lt|lote|mz|manzana|psj|pasaje|urb|etapa|sector|bloque|int|dpto|km)[\s.:-]*#?\d{0,4}[a-z]?(\s+(mz|lt|lote|manzana|etapa)\s*[a-z]?\d{0,4})*)$/i.test(t);
}

/** ¿Esto parece un TROZO DE DIRECCIÓN y no un nombre de persona?
 *  "Barrio XV Popular de Intereses Social Proyecto", "Av. La Marina 2450" */
function pareceTrozoDireccion(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t) return false;
  // palabras típicas de dirección, completas (que "av" no pegue con "David")
  const claves = [
    'barrio', 'avenida', 'av', 'av.', 'jiron', 'jirón', 'jr', 'jr.', 'calle',
    'urbanizacion', 'urbanización', 'urb', 'urb.', 'mz', 'manzana', 'lote', 'lt',
    'etapa', 'proyecto', 'pueblo', 'asociacion', 'asociación', 'aa.hh',
    'sector', 'pasaje', 'psj', 'carretera', 'malecon', 'malecón', 'interes', 'interés',
  ];
  let hits = 0;
  for (const k of claves) {
    if (new RegExp(`(^|\\s)${k.replace('.', '\\.')}(\s|$)`, 'i').test(t)) hits++;
  }
  return hits >= 2 || (hits >= 1 && t.split(/\s+/).length >= 4);
}

/** "Barrio Barrio XV Popular" → "Barrio XV Popular" (palabra pegada repetida). */
function sinPalabrasRepetidas(s: string): string {
  return s.replace(/\b(\S+)(\s+\1\b)+/gi, '$1').replace(/\s{2,}/g, ' ').trim();
}

/** La red de seguridad completa: corrige cliente/dirección confundidos. */
function sanearDatos(d: DatosEscaneados): DatosEscaneados {
  // 1. La IA puso un código de calle ("C.1") o un trozo de dirección
  //    en "cliente" → se muda a la dirección (al INICIO, como en el
  //    ejemplo real: "C.1 Barrio XV Popular …")
  if (d.cliente && (pareceCodigoDireccion(d.cliente) || pareceTrozoDireccion(d.cliente))) {
    d.direccion = d.direccion ? `${d.cliente} ${d.direccion}`.trim() : d.cliente;
    d.cliente = '';
  }
  // 2. Quedó sin nombre pero el pedido trae nombre de yape → ese es
  //    el cliente ("Mk yape 980811297" → cliente "Mk")
  if (!d.cliente && d.yapeNombre) d.cliente = d.yapeNombre;
  // 3. Palabras pegadas repetidas en dirección/zona
  d.direccion = sinPalabrasRepetidas(d.direccion);
  d.zona = sinPalabrasRepetidas(d.zona);
  // 4. El número de yape queda limpio: solo dígitos
  d.yapeNumero = d.yapeNumero.replace(/[^0-9]/g, '');
  return d;
}

/** F-ID2.5: errores de CUENTA — con estos, la key está muerta HOY
 *  y reintentar no ayuda… pero la OTRA proveedora puede salvar el escaneo. */
const ERRORES_RESCATABLES: CodigoErrorOcr[] = [
  'creditos',
  'quota',
  'region',
  'api-bloqueada',
  'key-invalida',
];

function esErrorDeCuenta(c: CodigoErrorOcr): boolean {
  return ERRORES_RESCATABLES.includes(c);
}

/**
 * 📷 El corazón de F-ID2: foto base64 (JPEG dataURL) → datos del viaje.
 * F-ID2.5: acepta DOS keys (Gemini y Claude). Estrategia:
 *   1. Si SOLO hay una → esa (comportamiento de siempre).
 *   2. Si hay DOS → primero la GRATIS (Gemini); si revienta con un
 *      error de cuenta (sin créditos, quota, región…) → Claude al
 *      rescate, y el resultado llega como si nada (con aviso sutil).
 */
export async function escanearDireccion(
  fotoBase64: string,
  geminiKey: string,
  claudeKey?: string,
): Promise<DatosEscaneados> {
  const gKey = (geminiKey ?? '').trim();
  const cKey = (claudeKey ?? '').trim();

  const hayG = !!detectarProveedor(gKey);
  const hayC = !!detectarProveedor(cKey);

  if (!hayG && !hayC) {
    if (gKey || cKey) throw new ErrorOcr('formato-key');
    throw new ErrorOcr('sin-key');
  }

  // Con las dos: primero Gemini (gratis), Claude de respaldo.
  // Con una: esa. Sin Gemini: Claude directo.
  const intentos: string[] = [];
  if (hayG) intentos.push(gKey);
  if (hayC) intentos.push(cKey);

  let falloPrimario: ErrorOcr | null = null;

  for (let i = 0; i < intentos.length; i++) {
    try {
      const { texto } = await llamarIA(intentos[i], { prompt: PROMPT, imagenB64: fotoBase64 });
      const d = parsearJsonTexto(texto);
      const datos: DatosEscaneados = sanearDatos({
        cliente: (d.cliente ?? '').trim(),
        direccion: (d.direccion ?? '').trim(),
        zona: (d.zona ?? '').trim(),
        referencia: (d.referencia ?? '').trim(),
        telefono: (d.telefono ?? '').trim(),
        yapeNombre: (d.yapeNombre ?? '').trim(),
        yapeNumero: (d.yapeNumero ?? '').trim(),
        tarifa: parsearTarifa(d.tarifa),
      });
      if (
        !datos.cliente &&
        !datos.direccion &&
        !datos.zona &&
        !datos.referencia &&
        !datos.telefono &&
        !datos.yapeNombre &&
        !datos.yapeNumero &&
        datos.tarifa === null
      ) {
        // La foto no tenía nada legible para ESTA proveedora — que la
        // otra le ponga los ojos si queda alguna por probar
        throw new ErrorOcr('sin-datos');
      }
      return datos;
    } catch (e) {
      const err = e instanceof ErrorOcr ? e : new ErrorOcr('desconocido');
      const quedaSiguiente = i < intentos.length - 1;
      // Error de la CUENTA (créditos, quota…) o foto ilegible, y hay
      // otra proveedora por probar → el escaneo NO muere acá
      if (quedaSiguiente && (esErrorDeCuenta(err.codigo) || err.codigo === 'sin-datos')) {
        if (!falloPrimario) falloPrimario = err;
        continue;
      }
      // Se acabaron los intentos (o el error no es rescatable). Qué
      // mostrar: si el ÚLTIMO intento dice "foto ilegible" o "sin
      // red", eso es lo que pasó hace 2 segundos → más útil. Si no,
      // el fallo de la key PRINCIPAL es lo que el usuario puede
      // arreglar (ej: Gemini sin créditos → arreglable gratis).
      if (err.codigo === 'sin-datos' || err.codigo === 'red') throw err;
      throw falloPrimario ?? err;
    }
  }

  // Las dos keys fallaron con error de cuenta → el primero (el de la
  // key principal) es el que el usuario puede arreglar
  throw falloPrimario ?? new ErrorOcr('desconocido');
}

/**
 * Botón "Probar key" de Ajustes: mini llamada real → dice si funciona,
 * qué proveedor detectó y con qué modelo respondió. Auto-diagnóstico.
 * F-ID2.5: prueba TODAS las keys configuradas, una por una.
 */
export async function probarKeyIA(
  geminiKey: string,
  claudeKey?: string,
): Promise<{ ok: boolean; mensaje: string }> {
  const resultados: string[] = [];
  let algunaOk = false;

  const keys: { key: string; nombre: string }[] = [];
  const g = (geminiKey ?? '').trim();
  const c = (claudeKey ?? '').trim();
  if (g) keys.push({ key: g, nombre: detectarProveedor(g) === 'gemini' ? 'Gemini' : '¿Gemini?' });
  if (c) keys.push({ key: c, nombre: detectarProveedor(c) === 'claude' ? 'Claude' : '¿Claude?' });

  if (keys.length === 0) return { ok: false, mensaje: 'Pegá alguna key primero' };

  for (const { key, nombre } of keys) {
    const proveedor = detectarProveedor(key);
    if (!proveedor) {
      resultados.push(`❌ ${nombre}: formato raro — Gemini empieza con "AIza" o "AQ." · Claude con "sk-ant-"`);
      continue;
    }
    try {
      const { modelo } = await llamarIA(key, { prompt: 'Responde solo: ok' });
      resultados.push(`✅ ${nombre} OK (${modelo})`);
      algunaOk = true;
    } catch (e) {
      const codigo: CodigoErrorOcr = e instanceof ErrorOcr ? e.codigo : 'desconocido';
      if (codigo === 'quota' || codigo === 'sin-datos') {
        resultados.push(`✅ ${nombre} OK (ahora con límite de momento, en un rato va normal)`);
        algunaOk = true;
      } else {
        resultados.push(`❌ ${nombre}: ${mensajeErrorOcr(codigo)}`);
      }
    }
  }

  return { ok: algunaOk, mensaje: resultados.join(' · ') };
}
