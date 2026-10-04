// ═══════════════════════════════════════════════════════════
// 🛠️ DriverTrack — Utilidades (formato, vibración, imagen, compartir)
// ═══════════════════════════════════════════════════════════
import type { ConfigDT } from './types';

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
export function armarMensajeCobro(
  datos: { cliente: string; monto: number; direccion: string },
  config: ConfigDT,
): string {
  const nombre = datos.cliente.trim() || 'estimado cliente';
  const yape = config.yape.numero.trim();
  const plin = config.plin.numero.trim();
  const titularYape = config.yape.titular.trim();
  const titularPlin = config.plin.titular.trim();

  const lineas: string[] = [`Hola ${nombre}! 👋`, ''];

  // Bloque 1 — el pedido
  if (datos.monto > 0) {
    lineas.push(`🛵 Monto a pagar por tu pedido: *S/ ${datos.monto.toFixed(2)}*`);
  } else {
    lineas.push('🛵 Te escribo por la entrega de tu pedido');
  }
  if (datos.direccion.trim()) lineas.push(`📍 Entrega en: ${datos.direccion.trim()}`);
  lineas.push('');

  // Bloque 2 — cómo pagar (TU Yape guardado, no el del pedido)
  if (yape && plin) {
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

export function descargarArchivo(nombre: string, contenido: string, tipo = 'application/json'): void {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
