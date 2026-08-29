// ═══════════════════════════════════════════════════════════
// 📤 COMPARTIR QR POR WHATSAPP — Fase 1.6
// Envía la imagen del QR (Yape 💜 / Plin 💚) directamente por
// WhatsApp usando el compartir nativo del celular.
// NO depende del bot de Baileys — es el respaldo manual para
// cuando el bot no tiene el comando (Plin) o Yape se cae.
//
// Cascada de métodos (el primero que funciona gana):
//   1. Compartir nativo con IMAGEN + texto → el usuario elige
//      WhatsApp y el chat del cliente (la imagen va como foto
//      y el texto queda como caption).
//   2. Compartir nativo solo texto.
//   3. Abrir wa.me con el mensaje de texto listo para enviar.
// ═══════════════════════════════════════════════════════════

export type ToastFn = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

export type ResultadoShare = 'imagen' | 'texto' | 'wame' | 'cancelado';

/** Convierte un dataURL base64 (image/jpeg) a File para el compartir nativo */
export function dataUrlAFile(dataUrl: string, filename: string): File | null {
  try {
    const coma = dataUrl.indexOf(',');
    if (coma < 0) return null;
    const meta = dataUrl.slice(0, coma);
    const b64 = dataUrl.slice(coma + 1);
    const mimeMatch = /data:([^;,]*)/.exec(meta);
    const mime = mimeMatch?.[1] || 'image/jpeg';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}

/**
 * Comparte un QR (imagen base64) + un mensaje de texto por WhatsApp.
 * Debe llamarse directo desde el tap del usuario (gesto) para que el
 * compartir nativo funcione.
 */
export async function compartirQRWhatsApp(opts: {
  /** QR comprimido en base64 (dataURL image/jpeg). Opcional. */
  dataUrl?: string;
  /** Mensaje / caption del envío */
  texto: string;
  /** Celular del cliente (para el fallback wa.me directo a su chat) */
  telefono?: string;
  onShowToast?: ToastFn;
}): Promise<ResultadoShare> {
  const { dataUrl, texto, telefono, onShowToast } = opts;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;

  // ── 0) APK (Capacitor): hoja de compartir NATIVA con la imagen —
  //    Fix 2.18: en el WebView del APK navigator.share NO existe, así
  //    que la imagen del QR nunca se adjuntaba y caía al wa.me sin
  //    QR. Se guarda en Cache y se comparte por el plugin nativo.
  if (dataUrl) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const coma = dataUrl.indexOf(',');
        const b64 = coma >= 0 ? dataUrl.slice(coma + 1) : dataUrl;
        const res = await Filesystem.writeFile({
          path: 'qr-pago.jpg',
          data: b64,
          directory: Directory.Cache,
          recursive: true,
        });
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: 'QR de pago',
          text: texto,
          dialogTitle: 'Enviar QR por WhatsApp',
          files: [res.uri],
        });
        onShowToast?.('📤 QR compartido', 'Elige WhatsApp y el chat del cliente para enviarlo', 'success');
        return 'imagen';
      }
    } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message || '');
      const esCancel = /cancel/i.test(msg) || (e as { name?: string })?.name === 'AbortError';
      if (esCancel) {
        onShowToast?.('Cancelado', 'No se envió nada', 'info');
        return 'cancelado';
      }
      // Otro error → seguir por la cascada de abajo
    }
  }

  // ── 1) Compartir nativo (web): IMAGEN + texto ──
  if (dataUrl) {
    const file = dataUrlAFile(dataUrl, 'qr-pago.jpg');
    if (file && nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], text: texto });
        onShowToast?.('📤 QR compartido', 'Elige WhatsApp y el chat del cliente para enviarlo', 'success');
        return 'imagen';
      } catch (e: unknown) {
        const esCancel = (e as { name?: string })?.name === 'AbortError';
        if (esCancel) {
          onShowToast?.('Cancelado', 'No se envió nada', 'info');
          return 'cancelado';
        }
        // Otro error → probamos el siguiente método
      }
    }
  }

  // ── 2) Compartir nativo: solo texto ──
  if (nav.share) {
    try {
      await nav.share({ text: texto });
      onShowToast?.('📤 Mensaje compartido', 'Elige WhatsApp y el chat del cliente', 'success');
      return 'texto';
    } catch (e: unknown) {
      const esCancel = (e as { name?: string })?.name === 'AbortError';
      if (esCancel) {
        onShowToast?.('Cancelado', 'No se envió nada', 'info');
        return 'cancelado';
      }
    }
  }

  // ── 3) Fallback final: wa.me directo al chat del cliente ──
  const cel = String(telefono || '').replace(/\D/g, '');
  const tel = cel.length === 9 ? `51${cel}` : cel;
  const url = tel
    ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
  if (dataUrl) {
    onShowToast?.(
      '💬 Mensaje abierto en WhatsApp',
      'La imagen del QR no se pudo adjuntar: puedes enviarla desde "Mis QR" → Ampliar (screenshot) o pedirla por el bot',
      'info'
    );
  } else {
    onShowToast?.('💬 Mensaje abierto', 'Revísalo antes de enviar', 'info');
  }
  return 'wame';
}
