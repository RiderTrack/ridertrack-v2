// ═══════════════════════════════════════════════════════════
// 💾 DESCARGA DE ARCHIVOS QUE SÍ FUNCIONA EN EL APK — Fix 2.18
//
// Reporte del usuario: "para descargar Excel para Circuit no
// funciona, tuve que abrir la versión 1". CAUSA: en el APK
// (Capacitor) el WebView NO tiene navigator.share NI descargas
// de <a download> — el botón Exportar a Circuit caía al
// a.click() que en el WebView no hace NADA (y encima mostraba
// el toast de "descargado"). La v1 lo resolvía con los plugins
// nativos (descargaDirecta de la v1); este helper la replica:
//
//   APK:  1) Filesystem → carpeta Documentos PÚBLICA del teléfono
//            (Environment.DIRECTORY_DOCUMENTS — la ve el explorador
//            de archivos y el importador de Circuit: Importar →
//            desde Excel; el plugin pide el permiso él solo).
//         2) Si falla → Cache + hoja de compartir nativa CON el
//            archivo adjunto (WhatsApp, Drive, guardar…).
//   WEB:  3) navigator.share con archivos → 4) descarga <a download>.
//
// `preferirCompartir: true` invierte el orden SOLO en el APK para
// cosas que se mandan más de lo que se guardan (fotos de entrega,
// QR): abre primero la hoja de compartir.
// ═══════════════════════════════════════════════════════════

export type ToastDescargaFn = (
  title: string,
  desc?: string,
  type?: 'success' | 'info' | 'warning' | 'error',
) => void;

/**
 * Resultado de descargarArchivo():
 *  - 'documentos' → APK: guardado en la carpeta Documentos pública
 *  - 'compartido' → APK/web: salió por la hoja de compartir
 *  - 'web'        → navegador: descargado con <a download>
 *  - 'cancelado'  → el usuario cerró la hoja de compartir (sin toast)
 *  - null         → falló todo (ya se mostró el toast de error)
 */
export type ResultadoDescarga = 'documentos' | 'compartido' | 'web' | 'cancelado' | null;

/** Blob → base64 puro (sin el prefijo data:) para Filesystem.writeFile */
function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result || '');
      resolve(r.includes(',') ? r.split(',')[1] : r);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Guarda el archivo en Cache y abre la hoja de compartir nativa
 * CON el archivo adjunto (Share.share({ files: [uri] })).
 * Devuelve 'ok' | 'cancelado' (el usuario cerró la hoja) | 'fallo'.
 */
async function compartirNativo(
  Filesystem: typeof import('@capacitor/filesystem').Filesystem,
  Directory: typeof import('@capacitor/filesystem').Directory,
  b64: string,
  nombre: string,
  texto?: string,
): Promise<'ok' | 'cancelado' | 'fallo'> {
  try {
    const res = await Filesystem.writeFile({
      path: nombre,
      data: b64,
      directory: Directory.Cache,
      recursive: true,
    });
    const { Share } = await import('@capacitor/share');
    await Share.share({
      title: nombre,
      text: texto,
      dialogTitle: `Guardar o enviar ${nombre}`,
      files: [res.uri],
    });
    return 'ok';
  } catch (e: unknown) {
    const msg = String((e as { message?: string })?.message || '');
    // El plugin nativo rechaza con "Share canceled" si el usuario cierra la hoja
    if (/cancel/i.test(msg) || (e as { name?: string })?.name === 'AbortError') return 'cancelado';
    return 'fallo';
  }
}

/**
 * Guarda (o comparte) un archivo funcionando igual en APK y web.
 * Los toasts de éxito y error los muestra este helper; el llamador
 * solo decide qué hacer con el resultado.
 *
 * @param blob            El archivo ya generado (XLSX, foto, JSON…)
 * @param nombre          Nombre de archivo con extensión ("Circuit_29-08-2026.xlsx")
 * @param onShowToast     Para los toasts (opcional)
 * @param tituloExito     Título del toast de éxito (ej: '🛵 Circuit listo')
 * @param extraExito      Texto extra del toast de éxito (ej: 'en Circuit: Importar → Excel')
 * @param preferirCompartir  APK: abrir primero la hoja de compartir (fotos, QR)
 */
export async function descargarArchivo(
  blob: Blob,
  nombre: string,
  onShowToast?: ToastDescargaFn,
  tituloExito = '✅ Archivo guardado',
  extraExito = '',
  preferirCompartir = false,
): Promise<ResultadoDescarga> {
  const extra = extraExito ? ` · ${extraExito}` : '';

  // ── Detectar si estamos en el APK (sin romper la web si @capacitor falla) ──
  let esApk = false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    esApk = Capacitor.isNativePlatform();
  } catch {
    esApk = false;
  }

  // ═══ 1. APK: plugins nativos (como la descargaDirecta de la v1) ═══
  if (esApk) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const b64 = await blobABase64(blob);

      // a) ¿Prefiere compartir? (fotos, QR) → hoja nativa primero
      if (preferirCompartir) {
        const r = await compartirNativo(Filesystem, Directory, b64, nombre);
        if (r === 'ok') {
          onShowToast?.(tituloExito, `${nombre} · compartido${extra}`, 'success');
          return 'compartido';
        }
        if (r === 'cancelado') return 'cancelado';
        // si falló → probar guardando en Documentos
      }

      // b) Guardar en la carpeta Documentos PÚBLICA (la ve el
      //    importador de Circuit y el explorador de archivos)
      try {
        await Filesystem.writeFile({
          path: nombre,
          data: b64,
          directory: Directory.Documents,
          recursive: true,
        });
        onShowToast?.(
          tituloExito,
          `${nombre} · guardado en la carpeta Documentos del teléfono${extra}`,
          'success',
        );
        return 'documentos';
      } catch {
        // c) Último recurso: Cache + hoja de compartir CON el archivo
        const r = await compartirNativo(Filesystem, Directory, b64, nombre);
        if (r === 'ok') {
          onShowToast?.(tituloExito, `${nombre} · compartido${extra}`, 'success');
          return 'compartido';
        }
        if (r === 'cancelado') return 'cancelado';
        throw new Error('No se pudo guardar ni compartir');
      }
    } catch (e: any) {
      console.error('❌ descargaArchivo (APK):', e);
      onShowToast?.('❌ No se pudo guardar', e?.message || nombre, 'error');
      return null;
    }
  }

  // ═══ 2. WEB: compartir nativo del navegador → descarga directa ═══
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  try {
    const file = new File([blob], nombre, { type: blob.type });
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: nombre });
        onShowToast?.(tituloExito, `${nombre} · compartido${extra}`, 'success');
        return 'compartido';
      } catch (e: unknown) {
        const esCancel = (e as { name?: string })?.name === 'AbortError';
        if (esCancel) return 'cancelado';
        // Otro error → descarga directa
      }
    }
  } catch {
    // Sin File/share disponible → descarga directa
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  onShowToast?.(tituloExito, `${nombre} · descargado${extra}`, 'success');
  return 'web';
}
