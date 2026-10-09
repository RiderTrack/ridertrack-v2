// ═══════════════════════════════════════════════════════════
// 🛠️ DriverTrack — Utilidades (formato, vibración, imagen, compartir)
// ═══════════════════════════════════════════════════════════
import type { ConfigDT, Viaje } from './types';

export function fmtSoles(n: number): string {
  return 'S/ ' + n.toFixed(2);
}

// Vibración: Haptics nativo (APK) con fallback a navigator.vibrate (web)
export async function vibrar(ms = 400): Promise<void> {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Heavy });
    return;
  } catch {
    /* sin Capacitor: fallback web */
  }
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate(ms);
    }
  } catch {
    /* nada */
  }
}

// Comprime una imagen a JPEG base64 (mismo approach de RiderTrack YapeQRView):
// máx 800px de lado, calidad 0.8 — liviana para localStorage
export function comprimirImagen(file: File): Promise<string> {
  return comprimirImagenConLimite(file, 800, 0.8);
}
// F-ID2: para el ESCANEO OCR usamos más resolución — el texto de una
// dirección (a veces a mano, a veces chiquito en una captura) necesita
// píxeles para que Gemini lo lea bien. 1400px / calidad 0.85 ≈ 300-500 KB.
export function comprimirImagenParaOCR(file: File): Promise<string> {
  return comprimirImagenConLimite(file, 1400, 0.85);
}

// ═══ FASE R: 💜🔷 QR de PAGO con PRESUPUESTO de peso ═══
// Un QR no necesita foto-calidad: con 800px y calidad media sobra para
// que el cliente lo escanee. El presupuesto garantiza que el QR viaje
// LIVIANO siempre — en la acción del robot (acciones_dt, límite 1 MB
// por doc) y en el sync de la nube (dt_sync) — venga de la captura que
// venga. Si un escalón no alcanza, baja al siguiente hasta entrar.
const PRESUPUESTO_QR_BASE64 = 160 * 1024; // ~160 KB de base64 ≈ 120 KB de JPEG

/** FASE R: comprime un QR de cobro con techo de peso (para que el
 * cobro por el robot nunca falle por una imagen pesada). */
export async function comprimirQrPago(file: File): Promise<string> {
  const escalones: Array<[number, number]> = [
    [800, 0.78],
    [700, 0.72],
    [600, 0.66],
    [520, 0.6],
  ];
  let ultima = '';
  for (const [lado, calidad] of escalones) {
    ultima = await comprimirImagenConLimite(file, lado, calidad);
    if (ultima.length <= PRESUPUESTO_QR_BASE64) return ultima;
  }
  return ultima; // la más liviana que se pudo — el guard de mandarCobro decide
}

/** FASE R: re-comprime un QR YA GUARDADO (dataURL) para que entre en
 * el presupuesto — sana los QRs pesados que quedaron de versiones
 * viejas sin que tengas que subirlos de nuevo. Devuelve '' si no pudo. */
export async function alivianarQrBase64(
  qr: string,
  presupuesto = PRESUPUESTO_QR_BASE64,
): Promise<string> {
  if (!qr || qr.length <= presupuesto) return qr;
  try {
    const img = await cargarImagenEl(qr);
    const lado = Math.max(img.width, img.height);
    for (const paso of [1, 0.85, 0.72, 0.6, 0.5]) {
      const objetivo = Math.min(800, Math.round(lado * paso));
      if (objetivo < 240) break;
      const dataUrl = reCodificarJpeg(img, objetivo, 0.72);
      if (dataUrl.length <= presupuesto) return dataUrl;
    }
    return reCodificarJpeg(img, 420, 0.62); // última: chiquita y legible
  } catch {
    return '';
  }
}

function cargarImagenEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('imagen inválida'));
    img.src = src;
  });
}

function reCodificarJpeg(img: HTMLImageElement, ladoMax: number, calidad: number): string {
  let { width, height } = img;
  if (width > ladoMax || height > ladoMax) {
    if (width >= height) {
      height = Math.round((height * ladoMax) / width);
      width = ladoMax;
    } else {
      width = Math.round((width * ladoMax) / height);
      height = ladoMax;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', calidad);
}

// FASE R: saneo UNA vez por carga de la app — si un QR guardado pesa
// más de 220 KB (versiones viejas o capturas densas), se aliviana solo
// y se guarda. Así el sync y los cobros viajan livianos sin tocar nada.
const LIMITE_QR_PESADO = 220 * 1024;
let _qrSaneados = false;

/** FASE R: alivia los QRs pesados de la config (una vez por carga).
 * Devuelve la config nueva si cambió algo, o null si no hubo cambios. */
export async function sanearQrPesados(config: ConfigDT): Promise<ConfigDT | null> {
  if (_qrSaneados) return null;
  _qrSaneados = true;
  let cambio = false;
  const c: ConfigDT = { ...config, yape: { ...config.yape }, plin: { ...config.plin } };
  for (const k of ['yape', 'plin'] as const) {
    const qr = c[k].qrBase64;
    if (qr && qr.length > LIMITE_QR_PESADO) {
      const liviana = await alivianarQrBase64(qr);
      if (liviana && liviana.length < qr.length) {
        c[k] = { ...c[k], qrBase64: liviana };
        cambio = true;
      }
    }
  }
  return cambio ? c : null;
}

function comprimirImagenConLimite(file: File, MAX: number, calidad: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagen inválida'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas no disponible'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Compartir texto: share nativo si existe, si no copia al portapapeles
export async function compartirTexto(titulo: string, texto: string): Promise<'share' | 'clipboard' | 'none'> {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: titulo, text: texto });
      return 'share';
    }
  } catch {
    /* el usuario canceló */
  }
  try {
    await navigator.clipboard.writeText(texto);
    return 'clipboard';
  } catch {
    return 'none';
  }
}

export function linkWhatsApp(numero: string, texto: string): string {
  const limpio = numero.replace(/[^0-9]/g, '');
  return `https://wa.me/${limpio}?text=${encodeURIComponent(texto)}`;
}

// F-ID2.8: 💬 mensaje de cobro por WhatsApp — UNA sola función COMPARTIDA
// para los DOS botones: el "Cobrar" del formulario de arriba y el
// botoncito 💬 de la lista de abajo. Antes la lista tenía una copia vieja
// (solo saludo + monto) y el cliente recibía mensajes distintos según
// qué botón apretabas. Ahora es EXACTAMENTE el mismo mensaje ordenado
// por bloques: saludo → pedido (monto + entrega) → cómo pagar (TU
// Yape/Plin guardados) → gracias.
//
// 🟣 FASE R: `metodo` separa los mensajes, como pidió Rudy ("que uno
// sea solo el mensaje Yape y el otro solo mensaje Plin"):
//   • 'yape'  → el mensaje habla SOLO de tu Yape (+ efectivo)
//   • 'plin'  → SOLO de tu Plin (+ efectivo)
//   • undefined → los dos juntos (el mensaje de siempre, "Ambos")
export type MetodoCobro = 'yape' | 'plin';

export function armarMensajeCobro(
  datos: { cliente: string; monto: number; direccion: string },
  config: ConfigDT,
  metodo?: MetodoCobro,
): string {
  const nombre = datos.cliente.trim() || 'estimado cliente';
  const yape = config.yape.numero.trim();
  const plin = config.plin.numero.trim();
  const titularYape = config.yape.titular.trim();
  const titularPlin = config.plin.titular.trim();
  // Defensivo: si pediste un método que no tiene número guardado, se
  // cae al comportamiento de siempre (lo que haya configurado)
  const solo = metodo === 'yape' && !yape ? undefined : metodo === 'plin' && !plin ? undefined : metodo;

  const lineas: string[] = [`Hola ${nombre}! 👋`, ''];

  // Bloque 1 — el pedido
  if (datos.monto > 0) {
    lineas.push(`🛵 Monto a pagar por tu pedido: *S/ ${datos.monto.toFixed(2)}*`);
  } else {
    lineas.push('🛵 Te escribo por la entrega de tu pedido');
  }
  if (datos.direccion.trim()) lineas.push(`📍 Entrega en: ${datos.direccion.trim()}`);
  lineas.push('');

  // Bloque 2 — cómo pagar (TU Yape/Plin guardados, no el del pedido)
  if (solo === 'yape') {
    lineas.push('💜 Puedes pagarme por Yape:');
    lineas.push(`📱 *${yape}*${titularYape ? ` (${titularYape})` : ''}`);
    lineas.push('💵 O en efectivo al recibir');
  } else if (solo === 'plin') {
    lineas.push('🔷 Puedes pagarme por Plin:');
    lineas.push(`📱 *${plin}*${titularPlin ? ` (${titularPlin})` : ''}`);
    lineas.push('💵 O en efectivo al recibir');
  } else if (yape && plin) {
    lineas.push('💜 Puedes pagarme por Yape:');
    lineas.push(`📱 *${yape}*${titularYape ? ` (${titularYape})` : ''}`);
    lineas.push(`🔷 O por Plin: *${plin}*${titularPlin ? ` (${titularPlin})` : ''}`);
    lineas.push('💵 O en efectivo al recibir');
  } else if (yape) {
    lineas.push('💜 Puedes pagarme por Yape:');
    lineas.push(`📱 *${yape}*${titularYape ? ` (${titularYape})` : ''}`);
    lineas.push('💵 O en efectivo al recibir');
  } else if (plin) {
    lineas.push('🔷 Puedes pagarme por Plin:');
    lineas.push(`📱 *${plin}*${titularPlin ? ` (${titularPlin})` : ''}`);
    lineas.push('💵 O en efectivo al recibir');
  } else {
    lineas.push('💸 Pago en efectivo al recibir');
  }

  lineas.push('', '¡Gracias! 💚');
  return lineas.join('\n');
}

/** 🟣 FASE R: el QR que viaja con el cobro según el método elegido —
 * Yape manda SU QR, Plin el SUYO, "ambos" prefiere el de Yape. */
export function qrDelMetodo(config: ConfigDT, metodo?: MetodoCobro): string {
  if (metodo === 'plin') return config.plin.qrBase64 || '';
  if (metodo === 'yape') return config.yape.qrBase64 || '';
  return config.yape.qrBase64 || config.plin.qrBase64 || '';
}

// F-ID2.5: celular peruano → formato wa.me. "987 654 321" o
// "+51 987 654 321" → "51987654321". Si ya viene con código de otro
// país (más de 11 dígitos) se respeta tal cual.
export function normalizarCelular(crudo: string): string {
  const digitos = (crudo ?? '').replace(/[^0-9]/g, '');
  if (digitos.length === 9) return `51${digitos}`;       // 987654321 → 51987654321
  if (digitos.length === 11 && digitos.startsWith('51')) return digitos; // ya estaba bien
  if (digitos.length === 12 && digitos.startsWith('519')) return digitos.slice(0, 11); // 51987654321X raro
  return digitos; // otro formato: se manda tal cual (wa.me decidirá)
}

// F-ID3.2: 📞 llamada directa — arma el link tel: con el +51.
// En el APK abre el marcador del teléfono con el número listo;
// en la web abre la app de llamadas del sistema (Skype/etc).
export function linkLlamada(celular: string): string {
  const num = normalizarCelular(celular);
  if (!num) return '';
  return num.startsWith('+') ? `tel:${num}` : `tel:+${num}`;
}

// ═══ FASE H: 📷 mensaje que va CON la foto de la entrega ═══
// El ORIGINAL se edita en Ajustes → 📷 Foto de entrega (config.
// mensajeFoto); si está vacío se usa MENSAJE_FOTO_DEF. Etiquetas
// soportadas: {cliente} {direccion} {hora} {miNombre} {firma}.
// {firma} → " — Tu Nombre" (con guión) o '' si no configuraste
// nombre — así el mensaje default nunca queda pegado feo.
export const MENSAJE_FOTO_DEF =
  'Hola {cliente} 👋 le mando la foto de su entrega ✅ ¡Gracias por su confianza!{firma}';

function reemplazar(t: string, de: string, a: string): string {
  return t.split(de).join(a); // split/join: seguro en cualquier target de TS
}

/** Resuelve las etiquetas del mensaje de la foto con los datos del viaje */
export function armarMensajeFoto(viaje: Viaje, config: ConfigDT): string {
  const base = (config.mensajeFoto ?? '').trim() || MENSAJE_FOTO_DEF;
  const miNombre = config.miNombre.trim();
  let out = base;
  out = reemplazar(out, '{cliente}', viaje.cliente.trim() || 'estimado cliente');
  out = reemplazar(out, '{direccion}', viaje.direccion.trim());
  out = reemplazar(out, '{hora}', horaAhoraLinda());
  out = reemplazar(out, '{miNombre}', miNombre);
  out = reemplazar(out, '{firma}', miNombre ? ` — ${miNombre}` : '');
  return out;
}

/** HH:MM actual — utils no importa storage (dependencia circular) */
function horaAhoraLinda(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function descargarArchivo(nombre: string, contenido: string, tipo = 'application/json'): void {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
