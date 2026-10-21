// ═══════════════════════════════════════════════════════════
// 📷 FASE AG — Escáner de EXTRA de WhatsApp para Mi Ruta
//
// PEDIDO de Rudy (21 oct): «hay que darle esa función que tiene
// viaje sin driver también en la sección mi ruta… a veces por
// WhatsApp me mandan el nombre del cliente, la dirección… esto
// es un extra, no está en el Excel — salió al momento y me lo
// escribe el cliente: nombre, dirección, teléfono, etcétera.
// Que la cámara igualito que lo escanee, que lo ponga en orden
// y así agregarlo».
//
// Es el HERMANO del escáner de inDrive (escanerIA.ts), pero para
// la ruta del TRABAJO:
//   · inDrive: la foto de UN pedido → llena el formulario del
//     viaje (recojo A / entrega B / paradas / tarifa).
//   · Mi Ruta: la foto de un CHAT de WhatsApp → llena el
//     formulario de "Agregar Cliente Manual" (nombre, celular,
//     producto, monto, dirección, distrito, referencia) y dale
//     ✅ Agregar — el extra de la mañana queda en la ruta de
//     hoy con sus datos ordenaditos, sin tipear nada.
//
// El motor de IA es el MISMO ya validado en inDrive (Gemini
// gratis + Claude de respaldo, llamarIA de escanerIA.ts) — solo
// cambia el PROMPT y el saneo posterior, adaptados al mensaje
// de WhatsApp del trabajo. Las keys son las mismas que ya
// configuró en Ajustes (dt_config_v1) — se comparten entre las
// dos secciones, se configuran UNA vez.
// ═══════════════════════════════════════════════════════════

import {
  detectarProveedor,
  llamarIA,
  parsearJsonTexto,
  mensajeErrorOcr,
  __escanerTests,
  type CodigoErrorOcr,
} from '../drivertrack/services/escanerIA';
import { parseMonedaPeru } from '../utils/moneda';

export interface DatosClienteWA {
  cliente: string;
  direccion: string;
  distrito: string;
  referencia: string;
  telefono: string;
  producto: string;
  cobrar: number | null; // null si el mensaje no dice el monto
}

const PROMPT_RUTA = `Eres el escáner de pedidos de RiderTrack, la app de la ruta de reparto de una empresa de delivery en Lima, Perú.

Te mando la FOTO de un mensaje que le llegó al repartidor: casi siempre es un CHAT o CAPTURA de WhatsApp (a veces una nota o sticker), donde un cliente o alguien de ventas le pasa los datos de un pedido EXTRA — un pedido que salió al momento y NO viene en el Excel de la ruta. El mensaje puede venir desordenado, con emojis, con saludos ("hola", "buenas tardes"), con despedidas o con cualquier conversación alrededor.

Extrae SOLO los datos del pedido MÁS RECIENTE que tenga datos completos, con estas reglas:

- cliente: el NOMBRE DE PERSONA del cliente (quién recibe o pide el pedido). Ej: "María Fernanda López", "Kevin Rojas", "Sra. Rosa Quispe". Puede venir como "Cliente:", "Nombre:", "para:" o dentro de la frase. NUNCA pongas acá códigos de dirección ("C.1", "C-1", "Casa 2", "Mz B", "Lote 5", "#123"), barrios ni apodos de zonas. En los pueblos jóvenes las calles van con CÓDIGO ("C.1" es Calle 1, "Mz B Lt 5" es Manzana B Lote 5) — esos códigos son PARTE DE LA DIRECCIÓN, jamás nombres de personas. Si no hay ningún nombre de persona, devuelve "".
- direccion: la dirección de ENTREGA completa, tal cual: avenida/calle/jirón, número, urbanización/proyecto/barrio, manzana/lote o código ("C.1 Mz B Lt 5"), interior, departamento. Puede venir como "Dirección:", "dire:", "ubica:" o dentro de la frase. Si el mensaje también nombra el distrito al final ("…, San Miguel"), dejalo incluido en la dirección.
- distrito: el DISTRITO de la entrega si aparece (San Miguel, SMP, Callao, La Perla, Cercado, Bellavista…). SOLO el nombre, sin "Distrito de" ni "Distrito:".
- referencia: cómo RECONOCER el lugar si aparece ("frente a la bodega", "portón azul", "casa de 2 pisos", "al costado del grifo"). Es el punto de referencia DEL LUGAR — no la dirección ni lo que lleva.
- telefono: el celular del cliente si aparece. Suelen mandarlo con espacios, con +51 o con 51 adelante. Devolvelo SOLO DÍGITOS, SIN el 51 del país (9 dígitos): en "+51 988 111 222" el celular es "988111222".
- producto: QUÉ lleva el pedido si aparece ("una cocina", "2 cajas", "un colchón", "una bolsa de ropa"). Puede venir como "Producto:", "llevo", "envía".
- cobrar: el MONTO a cobrar SÍ Y SOLO SÍ aparece escrito explícitamente ("S/ 45.90", "S/.45,90", "89 soles", "pagará 120"). Solo el número ("45.90"). Si el mensaje no dice el monto, devuelve "" — NUNCA lo adivines.

REGLAS DE ORO:
1. Copia el texto EXACTO del mensaje. No corrijas ortografía. NO INVENTES NADA. Si un dato no aparece, devuelve "" (cadena vacía).
2. No repitas palabras pegadas (si el mensaje dice "Barrio 2 de Octubre", es "Barrio 2 de Octubre", no "Barrio Barrio 2 de Octubre").
3. El nombre de persona JAMAS es un código de dirección ni un barrio.
4. Ignora saludos, despedidas, "gracias", emojis y conversación vieja: SOLO los datos del pedido más reciente.
5. Responde SOLO el objeto JSON, con EXACTAMENTE estas claves: cliente, direccion, distrito, referencia, telefono, producto, cobrar.

EJEMPLO 1 (WhatsApp de ventas con todo) — la foto dice:
"Buenas tardes Rudy 😊
Te paso un extra para hoy porfa:
Cliente: María Fernanda López
Dirección: Av. Sucre 1234, San Miguel
Ref: frente al grifo Repsol
Cel: 988 111 222
Producto: una cocina
Monto: S/ 45.90
Gracias crack!"
La respuesta correcta es:
{"cliente":"María Fernanda López","direccion":"Av. Sucre 1234, San Miguel","distrito":"San Miguel","referencia":"frente al grifo Repsol","telefono":"988111222","producto":"una cocina","cobrar":"45.90"}

EJEMPLO 2 (mensaje desordenado del propio cliente) — la foto dice:
"holaa, me llamo Kevin Rojas
mi dire es C.3 Mz A Lt 12, Barrio 2 de Octubre, SMP
pagará al recibir, son 89 soles
telf 51 998 776 554"
La respuesta correcta es:
{"cliente":"Kevin Rojas","direccion":"C.3 Mz A Lt 12, Barrio 2 de Octubre, SMP","distrito":"SMP","referencia":"","telefono":"998776554","producto":"","cobrar":"89"}
Fíjate: "C.3 Mz A Lt 12" es la CALLE del pueblo joven, va completa en direccion; el "SMP" del final también es el distrito; "51 998 776 554" → el celular es 998776554 (sin el 51); "son 89 soles" → cobrar 89.

EJEMPLO 3 (solo lo mínimo) — la foto dice:
"extra: Sra. Rosa Quispe — Jr. Los Álamos 245, La Perla"
La respuesta correcta es:
{"cliente":"Rosa Quispe","direccion":"Jr. Los Álamos 245, La Perla","distrito":"La Perla","referencia":"","telefono":"","producto":"","cobrar":""}
Fíjate: sin monto → cobrar ""; sin celular → ""; la referencia y el producto no aparecen → "".`;

// Claude no tiene responseSchema: se le exige el JSON por el prompt
const PROMPT_CLAUDE_EXTRA = `

IMPORTANTE: Respondé ÚNICAMENTE con el objeto JSON, sin markdown, sin \`\`\` y sin explicaciones.`;

/** "Barrio Barrio XV" → "Barrio XV" (palabra pegada repetida). */
function palabrasSinRepetir(s: string): string {
  return s
    .replace(/\b(\S+)(\s+\1\b)+/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

type DatosClienteWACrudos = Omit<DatosClienteWA, 'cobrar'> & { cobrar?: unknown };

/**
 * 🧹 La red de seguridad post-scan (mismo espíritu que
 * sanearDatos de inDrive): el prompt enseña, pero por si el
 * modelo mete la pata igual, acá se autocorrige:
 *   · código de calle ("C.1") o trozo de dirección en "cliente"
 *     → se muda al INICIO de la dirección y el nombre queda ""
 *   · celular: solo dígitos, sin +51/51 del país, con las formas
 *     raras que manda WhatsApp normalizadas a 9 dígitos
 *   · distrito: sin etiquetas ("Distrito de…", "Distrito: …")
 *   · monto: parseo peruano real (parseMonedaPeru, FASE Z —
 *     "S/ 89,90" → 89.9), "" o basura → null (no se inventa plata)
 */
export function sanearClienteWA(crudo: DatosClienteWACrudos): DatosClienteWA {
  const d = {
    cliente: (crudo.cliente ?? '').trim(),
    direccion: (crudo.direccion ?? '').trim(),
    distrito: (crudo.distrito ?? '').trim(),
    referencia: (crudo.referencia ?? '').trim(),
    telefono: (crudo.telefono ?? '').trim(),
    producto: (crudo.producto ?? '').trim(),
  } as DatosClienteWACrudos;

  // 1. La IA puso un código de calle o un trozo de dirección en
  //    "cliente" → se muda al INICIO de la dirección
  if (
    d.cliente &&
    (__escanerTests.pareceCodigoDireccion(d.cliente) || __escanerTests.pareceTrozoDireccion(d.cliente))
  ) {
    d.direccion = d.direccion ? `${d.cliente} ${d.direccion}`.trim() : d.cliente;
    d.cliente = '';
  }

  // 2. Celular peruano prolijo: solo dígitos, sin el 51 del país
  let tel = (d.telefono ?? '').replace(/[^0-9]/g, '');
  if (tel.length === 11 && tel.startsWith('51')) tel = tel.slice(2);
  else if (tel.length > 9) tel = tel.slice(-9); // "51988111222" raro, spam de dígitos, etc.
  d.telefono = tel;

  // 3. Distrito: sin etiquetas que a veces se pegan
  d.distrito = d.distrito
    .replace(/^distrito\s*de\s+/i, '')
    .replace(/^distrito[:\s]+/i, '')
    .trim();

  // 4. Palabras pegadas repetidas y espacios dobles
  d.direccion = palabrasSinRepetir(d.direccion ?? '');
  d.distrito = palabrasSinRepetir(d.distrito ?? '');
  d.referencia = palabrasSinRepetir(d.referencia ?? '');
  d.producto = palabrasSinRepetir(d.producto ?? '');
  d.cliente = palabrasSinRepetir(d.cliente ?? '');

  // 5. Monto: solo si de verdad trae plata (FASE Z: parse peruano)
  const cobrarCrudo = crudo.cobrar;
  let cobrar: number | null = null;
  if (typeof cobrarCrudo === 'number' && Number.isFinite(cobrarCrudo) && cobrarCrudo > 0) {
    cobrar = cobrarCrudo;
  } else if (typeof cobrarCrudo === 'string' && cobrarCrudo.trim()) {
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
    cobrar,
  };
}

/** Error con el mismo contrato que el escáner de inDrive (código + mensaje humano + detalle técnico). */
class ErrorEscanerRuta extends Error {
  codigo: CodigoErrorOcr;
  detalle?: string;
  constructor(codigo: CodigoErrorOcr, detalle?: string) {
    super(mensajeErrorOcr(codigo));
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

const ERRORES_RESCATABLES: CodigoErrorOcr[] = [
  'creditos',
  'quota',
  'region',
  'api-bloqueada',
  'key-invalida',
];

/**
 * 📷 El corazón de FASE AG: foto base64 (JPEG dataURL) del chat
 * de WhatsApp → datos del cliente EXTRA ordenaditos, listos para
 * el formulario de "Agregar Cliente Manual".
 *
 * Misma estrategia de keys que el escáner de inDrive (F-ID2.5):
 * solo Gemini → esa; solo Claude → esa; las dos → primero la
 * GRATIS (Gemini) y si revienta con error de cuenta (sin
 * créditos, quota, región…) Claude al rescate.
 */
export async function escanearClienteWhatsApp(
  fotoBase64: string,
  geminiKey: string,
  claudeKey?: string,
): Promise<DatosClienteWA> {
  const gKey = (geminiKey ?? '').trim();
  const cKey = (claudeKey ?? '').trim();

  const hayG = !!detectarProveedor(gKey);
  const hayC = !!detectarProveedor(cKey);

  if (!hayG && !hayC) {
    if (gKey || cKey) throw new ErrorEscanerRuta('formato-key');
    throw new ErrorEscanerRuta('sin-key');
  }

  const intentos: { key: string; esClaude: boolean }[] = [];
  if (hayG) intentos.push({ key: gKey, esClaude: false });
  if (hayC) intentos.push({ key: cKey, esClaude: true });

  let falloPrimario: ErrorEscanerRuta | null = null;

  for (let i = 0; i < intentos.length; i++) {
    try {
      const { texto } = await llamarIA(intentos[i].key, {
        prompt: PROMPT_RUTA + (intentos[i].esClaude ? PROMPT_CLAUDE_EXTRA : ''),
        imagenB64: fotoBase64,
      });
      const d = parsearJsonTexto(texto);
      const datos = sanearClienteWA({
        cliente: d.cliente ?? '',
        direccion: d.direccion ?? '',
        distrito: d.distrito ?? '',
        referencia: d.referencia ?? '',
        telefono: d.telefono ?? '',
        producto: d.producto ?? '',
        cobrar: d.cobrar ?? '',
      });
      if (
        !datos.cliente &&
        !datos.direccion &&
        !datos.distrito &&
        !datos.referencia &&
        !datos.telefono &&
        !datos.producto &&
        datos.cobrar === null
      ) {
        // Nada legible para ESTA proveedora — que la otra le ponga los ojos
        throw new ErrorEscanerRuta('sin-datos');
      }
      return datos;
    } catch (e) {
      const err =
        e instanceof ErrorEscanerRuta
          ? e
          : new ErrorEscanerRuta(
              // errores de la propia llamarIA (formato-key, red, cuenta…) o basura
              ((): CodigoErrorOcr => {
                const codigo = (e as { codigo?: CodigoErrorOcr }).codigo;
                if (codigo && mensajeErrorOcr(codigo)) return codigo;
                return 'desconocido';
              })(),
              (e as Error).message?.slice(0, 140),
            );
      const quedaSiguiente = i < intentos.length - 1;
      if (quedaSiguiente && (ERRORES_RESCATABLES.includes(err.codigo) || err.codigo === 'sin-datos')) {
        if (!falloPrimario) falloPrimario = err;
        continue;
      }
      if (err.codigo === 'sin-datos' || err.codigo === 'red') throw err;
      throw falloPrimario ?? err;
    }
  }

  throw falloPrimario ?? new ErrorEscanerRuta('desconocido');
}

// ═══════════════════════════════════════════════════════════
// 🧪 hook de tests — expone las funciones PURAS del escáner
// para poder probarlas sin llamar a la IA (patrón __escanerTests).
// ═══════════════════════════════════════════════════════════
export const __escanerRutaTests = {
  sanearClienteWA,
  palabrasSinRepetir,
  PROMPT_RUTA,
};
