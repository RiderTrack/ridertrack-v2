// ═══════════════════════════════════════════════════════════
// 🔗 LINK DE SEGUIMIENTO PARA CLIENTES (Fase 2.15)
//
// El rider comparte un link por WhatsApp y su cliente ve EN VIVO
// dónde va la moto y a qué hora le toca (estilo Circuit).
//
// Arquitectura:
//   - La página pública vive en GitHub Pages:
//       https://ridetrack.github.io/ridertrack-v2/
//     (sirve docs/index.html — no requiere build, se abre sola)
//   - La página lee Firestore con FIREBASE ANONYMOUS AUTH
//     (ya habilitado en el proyecto — verificado 29-ago-2026)
//     y escucha ruta_activa/{uid} que la app YA publica:
//       · posicion (lat/lng/vel/rumbo — cada 10 s desde GPS)
//       · clientes[] con lat/lng + st (estados en vivo)
//       · rider {nombre, telefono, empresa}
//   - El link lleva ?r={uid}&c={clienteId}: la página muestra
//     SOLO la entrega de ese cliente (las demás no se pintan).
// ═══════════════════════════════════════════════════════════

/** URL pública de la página de seguimiento (GitHub Pages → docs/) */
export const PAGINA_SEGUIMIENTO = 'https://ridetrack.github.io/ridertrack-v2/';

/**
 * Construye el link de seguimiento para la entrega de un cliente.
 * @param uid      uid del rider (dueño de ruta_activa/{uid})
 * @param clienteId id del cliente dentro de la ruta
 */
export function construirLinkSeguimiento(
  uid: string | undefined,
  clienteId: string | number
): string {
  if (!uid) return '';
  return `${PAGINA_SEGUIMIENTO}?r=${encodeURIComponent(uid)}&c=${encodeURIComponent(
    String(clienteId)
  )}`;
}

/** Mensajito que acompaña al link al compartirlo */
export function mensajeSeguimiento(nombreCliente: string, empresa: string): string {
  const saludo = nombreCliente ? `Hola ${nombreCliente}` : 'Hola';
  const de = empresa ? ` de ${empresa}` : '';
  return `${saludo}! 🛵 Sigue tu entrega en vivo${de} — verás dónde va el motorizado y tu hora aproximada:`;
}

/** Resultado del intento de compartir */
export type ResultadoCompartir = 'compartido' | 'copiado' | 'error';

/**
 * Comparte el link: usa el menú nativo de Android (Web Share API)
 * y si no está disponible lo copia al portapapeles.
 */
export async function compartirLink(link: string, texto: string): Promise<ResultadoCompartir> {
  // 1) Menú nativo de compartir (APK → comparte directo a WhatsApp)
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: 'Tu entrega en vivo', text: texto, url: link });
      return 'compartido';
    }
  } catch (e: any) {
    // Si el usuario cancela el menú nativo no es error real
    if (e && e.name === 'AbortError') return 'compartido';
    // Otros errores → seguimos con el portapapeles
  }

  // 2) Portapapeles
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${texto} ${link}`);
      return 'copiado';
    }
  } catch {
    // sigue el fallback
  }

  // 3) Fallback execCommand (WebViews viejos)
  try {
    const ta = document.createElement('textarea');
    ta.value = `${texto} ${link}`;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return 'copiado';
  } catch {
    // nada
  }

  return 'error';
}
