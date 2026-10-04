// ═══════════════════════════════════════════════════════════
// 📱 DriverTrack — Mi QR para los clientes (F-ID3.3 + F-ID3.4)
// Cuando el cliente te pide el número o te va a PAGAR, en vez de
// dictarle nada le mostrás esta pantalla.
//
// Tres modos (toggle) — 💜 Yape por DEFECTO si ya subiste tu QR:
//   • 💜 Yape — TU QR de Yape (la captura de tu app), GRANDE y
//     en pantalla completa para que te pague escaneando. Es la
//     MISMA imagen que subís en Ajustes → Yape (una sola fuente).
//   • 💬 WhatsApp — QR generado local → tu chat directo
//   • 👤 Contacto — vCard que te guarda con nombre y número
//
// El QR de Yape se sube UNA vez (quedó guardado como tu número),
// se comprime en el teléfono (800px) y sobrevive recargas y
// backup. Patrón visual de RiderTrack v2 (WalletQRPanel/Yape).
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { EvArchivo } from '../tipos';
import QRCode from 'qrcode';
import { Check, Loader2, Pencil, Share2, UserRound, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { ConfigDT } from '../types';
import { comprimirImagen, normalizarCelular } from '../utils';

interface Props {
  config: ConfigDT;
  /** Guarda nombre + celular; si qrYape !== undefined también actualiza tu QR de Yape ('' = quitar) */
  onGuardar: (nombre: string, celular: string, qrYape?: string) => void;
  /** Sube/cambia/quita tu QR de Yape directo desde la vista (sin pasar por Editar) */
  onGuardarQrYape: (b64: string) => void;
  onCerrar: () => void;
  onToast?: (msg: string) => void;
}

type ModoQR = 'yape' | 'whatsapp' | 'contacto';

/** El contenido del QR GENERADO según el modo (Yape usa imagen subida, no se genera) */
export function contenidoQR(modo: ModoQR, nombre: string, celular: string): string {
  const num = normalizarCelular(celular);
  if (modo === 'contacto') {
    // vCard: al escanearlo el teléfono ofrece GUARDARTE con
    // nombre y número ("…con el nombre y todo" 📇)
    const nom = nombre.trim() || 'Conductor';
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${nom}`,
      `N:${nom};;;;`,
      `TEL;TYPE=CELL:+${num}`,
      'END:VCARD',
    ].join('\r\n');
  }
  return `https://wa.me/${num}`; // escanea → tu chat directo
}

/** ¿Canceló el usuario la hoja de compartir? (no es error) */
function fueCancelado(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? '');
  return /cancel|abort/i.test(msg) || (e as { name?: string })?.name === 'AbortError';
}

export default function MiQrModal({ config, onGuardar, onGuardarQrYape, onCerrar, onToast }: Props) {
  const guardado = config.miCelular.trim().length > 0;
  const [editando, setEditando] = useState(!guardado);
  // Prefill piola: si ya guardaste tu Yape (F-ID2.7), tu QR arranca
  // con ese nombre y ese número — cero tipeo extra
  const [nombre, setNombre] = useState(config.miNombre || config.yape.titular);
  const [celular, setCelular] = useState(config.miCelular || config.yape.numero);
  // 💜 Por defecto tu QR de Yape si ya lo subiste; si no, WhatsApp
  const [modo, setModo] = useState<ModoQR>(config.yape.qrBase64 ? 'yape' : 'whatsapp');
  const [qrUrl, setQrUrl] = useState('');
  const [generando, setGenerando] = useState(true);
  const [compartiendo, setCompartiendo] = useState(false);
  const [subiendoQr, setSubiendoQr] = useState(false);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  // Staging del QR de Yape SOLO en modo edición:
  // null = no lo tocaste · '' = quitar · 'data:…' = imagen nueva
  const [qrYapeNuevo, setQrYapeNuevo] = useState<string | null>(null);

  const inputFileVista = useRef<HTMLInputElement>(null);
  const inputFileEdit = useRef<HTMLInputElement>(null);

  const nombreFinal = config.miNombre.trim() || 'Tu nombre';
  const numFinal = normalizarCelular(config.miCelular);
  const celBonito = config.miCelular.trim() || '—';
  const numYape = config.yape.numero.trim();
  const qrYapeEfectivo = qrYapeNuevo !== null ? qrYapeNuevo : config.yape.qrBase64;

  // Regenerar el QR generado (WhatsApp/Contacto) cuando cambian modo o datos
  useEffect(() => {
    if (editando || !guardado || modo === 'yape') return; // Yape usa imagen subida
    let vivo = true;
    setGenerando(true);
    QRCode.toDataURL(contenidoQR(modo, config.miNombre, config.miCelular), {
      width: 560,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then(url => {
        if (vivo) {
          setQrUrl(url);
          setGenerando(false);
        }
      })
      .catch(() => {
        if (vivo) setGenerando(false);
      });
    return () => {
      vivo = false;
    };
  }, [modo, config.miNombre, config.miCelular, editando, guardado]);

  function guardar() {
    const cel = celular.trim();
    if (cel.replace(/\D/g, '').length < 8) {
      onToast?.('Escribí tu celular completo (9 dígitos en Perú) 📱');
      return;
    }
    // Una sola pasada: nombre + celular + (si tocaste el QR de Yape) la imagen
    onGuardar(nombre.trim(), cel, qrYapeNuevo !== null ? qrYapeNuevo : undefined);
    if (qrYapeNuevo) setModo('yape'); // subiste uno nuevo → mostralo ya
    setQrYapeNuevo(null);
    setEditando(false);
  }

  /** Subir/cambiar el QR de Yape desde la VISTA (sin pasar por Editar) */
  async function subirQrVista(e: EvArchivo) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoQr(true);
    try {
      const b64 = await comprimirImagen(file);
      onGuardarQrYape(b64);
    } catch {
      onToast?.('No se pudo leer la imagen 😕 probá con otra captura');
    } finally {
      setSubiendoQr(false);
      e.target.value = '';
    }
  }

  /** Preparar el QR de Yape en el EDITAR (se guarda con el botón Guardar) */
  async function subirQrEdicion(e: EvArchivo) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoQr(true);
    try {
      const b64 = await comprimirImagen(file);
      setQrYapeNuevo(b64);
    } catch {
      onToast?.('No se pudo leer la imagen 😕 probá con otra captura');
    } finally {
      setSubiendoQr(false);
      e.target.value = '';
    }
  }

  async function compartir() {
    // 💜 Yape: comparte la IMAGEN del QR (o el número como texto)
    if (modo === 'yape') {
      const texto = numYape
        ? `Págame por Yape 💜 ${numYape} — ${nombreFinal}`
        : `Págame por Yape 💜 — ${nombreFinal}`;
      setCompartiendo(true);
      try {
        // 1) Web/PWA: intentar compartir la IMAGEN del QR (Android Chrome)
        if (config.yape.qrBase64 && navigator.share) {
          try {
            const blob = await (await fetch(config.yape.qrBase64)).blob();
            const archivo = new File([blob], `QR-Yape-${nombreFinal}.jpg`, {
              type: 'image/jpeg',
            });
            const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
            if (nav.canShare?.({ files: [archivo] })) {
              await navigator.share({ files: [archivo], text: texto, title: 'Mi QR de Yape' });
              return;
            }
            await navigator.share({ text: texto });
            return;
          } catch (e) {
            if (fueCancelado(e)) return;
            // si falló el share de imagen, seguimos con las otras vías
          }
        }
        // 2) APK (Capacitor): hoja NATIVA de Android con el texto
        if (Capacitor.isNativePlatform()) {
          const { Share } = await import('@capacitor/share');
          await Share.share({ title: 'Mi QR de Yape', text: texto, dialogTitle: 'Compartir mi Yape' });
          return;
        }
        // 3) Último recurso: copiar el número
        try {
          await navigator.clipboard.writeText(numYape || texto);
          onToast?.(numYape ? `📋 Número de Yape copiado: ${numYape}` : '📋 Mensaje copiado');
        } catch {
          onToast?.(numYape ? `Mi Yape: ${numYape}` : texto);
        }
      } catch (e) {
        if (!fueCancelado(e)) onToast?.('No se pudo compartir 😕');
      } finally {
        setCompartiendo(false);
      }
      return;
    }
    // 💬 WhatsApp / 👤 Contacto: compartir tu contacto
    const link = `https://wa.me/${numFinal}`;
    const texto = `Hola! Soy ${nombreFinal} 🛵 — escribime por WhatsApp: ${link}`;
    setCompartiendo(true);
    try {
      // 1) APK (Capacitor): hoja de compartir NATIVA de Android
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: 'Mi WhatsApp', text: texto, dialogTitle: 'Compartir mi contacto' });
        return;
      }
      // 2) Web: compartir nativo del navegador
      if (navigator.share) {
        await navigator.share({ text: texto });
        return;
      }
      throw new Error('sin share');
    } catch (e: unknown) {
      if (fueCancelado(e)) return;
      // 3) Último recurso: copiar el link al portapapeles
      try {
        await navigator.clipboard.writeText(link);
        onToast?.('📋 Link copiado — pegalo donde quieras');
      } catch {
        onToast?.(`Tu WhatsApp: ${config.miCelular.trim()}`);
      }
    } finally {
      setCompartiendo(false);
    }
  }

  const celDigitos = celular.replace(/\D/g, '').length;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
      data-testid="mi-qr-modal"
    >
      <div
        className="dt-anim-pop flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-black text-slate-100">
            {editando ? '📱 Tus datos para el QR' : '📱 Mi QR'}
          </p>
          <button
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
            data-testid="qr-cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* ══ Setup / edición de datos ══ */}
        {editando ? (
          <div className="space-y-3 overflow-y-auto p-4">
            <p className="text-[11px] leading-relaxed text-slate-400">
              Se guardan <b className="text-slate-200">una sola vez</b> (como tu Yape 💜) y arman tu QR:{' '}
              el de <b className="text-violet-300">Yape</b> para que te paguen y el de{' '}
              <b className="text-emerald-400">WhatsApp</b> con tu nombre — le mostrás la pantalla al
              cliente y listo.
            </p>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Tu nombre (ej: Rudy)"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-400"
              data-testid="qr-input-nombre"
            />
            <input
              value={celular}
              onChange={e => setCelular(e.target.value)}
              inputMode="tel"
              placeholder="📱 Tu celular / WhatsApp (ej: 987 654 321)"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-400"
              data-testid="qr-input-celular"
            />

            {/* 💜 Tu QR de Yape (opcional al configurar) */}
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
              <p className="text-[11px] font-bold text-violet-300">💜 Tu QR de Yape (opcional)</p>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                El que te <b className="text-slate-300">PAGAN</b> escaneando — abrí tu app de Yape,
                capturá tu QR de cobro y subila.
              </p>
              <input
                ref={inputFileEdit}
                type="file"
                accept="image/*"
                onChange={subirQrEdicion}
                className="hidden"
                data-testid="qr-input-file-edit"
              />
              {qrYapeEfectivo ? (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={qrYapeEfectivo}
                    alt="Tu QR de Yape"
                    className="h-16 w-16 rounded-lg border border-slate-600 bg-white object-contain p-0.5"
                    data-testid="qr-edit-thumb"
                  />
                  <div className="flex flex-1 gap-2">
                    <button
                      onClick={() => inputFileEdit.current?.click()}
                      disabled={subiendoQr}
                      className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-slate-300 transition-all active:scale-[0.98] disabled:opacity-50"
                      data-testid="qr-edit-cambiar"
                    >
                      {subiendoQr ? '…' : '📷 Cambiar'}
                    </button>
                    <button
                      onClick={() => setQrYapeNuevo('')}
                      className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-slate-400 transition-all hover:text-red-400 active:scale-[0.98]"
                      data-testid="qr-edit-quitar"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => inputFileEdit.current?.click()}
                  disabled={subiendoQr}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-500 px-3 py-2 text-xs font-black text-white transition-all active:scale-[0.98] disabled:opacity-50"
                  data-testid="qr-edit-subir"
                >
                  {subiendoQr ? <Loader2 size={14} className="animate-spin" /> : '📷'} Subir mi QR de Yape
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {guardado && (
                <button
                  onClick={() => {
                    setQrYapeNuevo(null);
                    setEditando(false);
                  }}
                  className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-300 transition-all active:scale-[0.98]"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={guardar}
                disabled={celDigitos < 8}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-black text-slate-950 transition-all active:scale-[0.98] disabled:opacity-40"
                data-testid="qr-setup-guardar"
              >
                <Check size={14} /> Guardar mi QR
              </button>
            </div>
          </div>
        ) : (
          /* ══ La tarjeta QR ══ */
          <div className="flex-1 overflow-y-auto p-4">
            {/* Nombre + número */}
            <div className="text-center">
              <p className="text-lg font-black leading-tight text-slate-50" data-testid="qr-nombre">
                {nombreFinal}
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-400" data-testid="qr-celular">
                {celBonito}
              </p>
            </div>

            {/* 💜 MODO YAPE — tu QR de Yape (imagen subida, la misma de Ajustes) */}
            {modo === 'yape' &&
              (config.yape.qrBase64 ? (
                <>
                  <button
                    onClick={() => setPantallaCompleta(true)}
                    aria-label="Ver QR en pantalla completa"
                    className="mx-auto mt-3 block w-full rounded-2xl bg-white p-3 shadow-lg transition-transform active:scale-[0.99]"
                    data-testid="qr-yape-ampliar"
                  >
                    <img
                      src={config.yape.qrBase64}
                      alt={`QR de Yape de ${nombreFinal}`}
                      className="mx-auto max-h-[264px] w-auto max-w-full object-contain"
                      data-testid="qr-imagen-yape"
                    />
                  </button>
                  <p
                    className="mt-2 text-center text-[11px] font-bold text-violet-300"
                    data-testid="qr-yape-texto"
                  >
                    Escanea y págame por Yape 💜{numYape ? ` ${numYape}` : ''}
                  </p>
                  <div className="mt-1.5 flex justify-center gap-2">
                    <input
                      ref={inputFileVista}
                      type="file"
                      accept="image/*"
                      onChange={subirQrVista}
                      className="hidden"
                      data-testid="qr-input-file-yape"
                    />
                    <button
                      onClick={() => inputFileVista.current?.click()}
                      disabled={subiendoQr}
                      className="rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-all active:scale-[0.98] disabled:opacity-50"
                      data-testid="qr-cambiar-yape"
                    >
                      {subiendoQr ? '…' : '📷 Cambiar QR'}
                    </button>
                    <button
                      onClick={() => onGuardarQrYape('')}
                      className="rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-400 transition-all hover:text-red-400 active:scale-[0.98]"
                      data-testid="qr-quitar-yape"
                    >
                      Quitar
                    </button>
                  </div>
                </>
              ) : (
                <div
                  className="mt-3 rounded-2xl border border-dashed border-violet-400/40 bg-violet-500/10 p-4 text-center"
                  data-testid="qr-yape-vacio"
                >
                  <p className="text-xs font-black text-violet-200">Todavía no subiste tu QR de Yape</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                    Abrí tu app de Yape 💜, sacale una captura a tu QR de cobro y subila — queda
                    guardada para siempre (como tu número).
                  </p>
                  <input
                    ref={inputFileVista}
                    type="file"
                    accept="image/*"
                    onChange={subirQrVista}
                    className="hidden"
                    data-testid="qr-input-file-yape"
                  />
                  <button
                    onClick={() => inputFileVista.current?.click()}
                    disabled={subiendoQr}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-black text-white transition-all active:scale-[0.98] disabled:opacity-50"
                    data-testid="qr-subir-yape"
                  >
                    {subiendoQr ? <Loader2 size={14} className="animate-spin" /> : '📷'} Subir mi QR de Yape
                  </button>
                </div>
              ))}

            {/* 💬👤 QR GENERADO (WhatsApp / Contacto) */}
            {modo !== 'yape' && (
              <div className="mx-auto mt-3 flex w-fit items-center justify-center rounded-2xl bg-white p-3 shadow-lg">
                {generando ? (
                  <div className="flex h-[224px] w-[224px] items-center justify-center">
                    <Loader2 size={28} className="animate-spin text-slate-400" />
                  </div>
                ) : (
                  <img
                    src={qrUrl}
                    alt={`QR de WhatsApp de ${nombreFinal}`}
                    className="h-[224px] w-[224px]"
                    data-testid="qr-imagen"
                  />
                )}
              </div>
            )}

            {/* Modo del QR — 💜 Yape primero */}
            <div
              className="mx-auto mt-3 grid w-full max-w-[320px] grid-cols-3 gap-1 rounded-xl border border-slate-700 bg-slate-950 p-1"
              role="tablist"
            >
              <button
                onClick={() => setModo('yape')}
                className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  modo === 'yape' ? 'bg-[#7B2FBE] text-white' : 'text-slate-400'
                }`}
                data-testid="qr-modo-yape"
              >
                💜 Yape
              </button>
              <button
                onClick={() => setModo('whatsapp')}
                className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  modo === 'whatsapp' ? 'bg-[#25D366] text-slate-950' : 'text-slate-400'
                }`}
                data-testid="qr-modo-whatsapp"
              >
                💬 WhatsApp
              </button>
              <button
                onClick={() => setModo('contacto')}
                className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  modo === 'contacto' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'
                }`}
                data-testid="qr-modo-contacto"
              >
                👤 Contacto
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] leading-snug text-slate-500">
              {modo === 'yape'
                ? 'Mostrale esta pantalla al cliente y te paga escaneando tu QR de Yape 💜'
                : modo === 'whatsapp'
                  ? 'Al escanearlo le abre TU chat de WhatsApp directo 📲'
                  : 'Al escanearlo te guarda con tu nombre y número en sus contactos 📇'}
            </p>

            {/* Acciones */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={compartir}
                disabled={compartiendo}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 py-2.5 text-xs font-bold text-[#25D366] transition-all active:scale-[0.98] disabled:opacity-50"
                data-testid="boton-qr-compartir"
              >
                {compartiendo ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                Compartir
              </button>
              <button
                onClick={() => {
                  setNombre(config.miNombre || config.yape.titular);
                  setCelular(config.miCelular || config.yape.numero);
                  setQrYapeNuevo(null);
                  setEditando(true);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-300 transition-all active:scale-[0.98]"
                data-testid="boton-qr-editar"
              >
                <Pencil size={14} /> Editar
              </button>
            </div>

            {modo !== 'yape' && (
              <p className="mt-3 text-center text-[10px] leading-snug text-slate-500">
                Mostrale esta pantalla al cliente 📱 — te escanea y ya te tiene
                guardado <UserRound size={10} className="inline text-slate-600" />
              </p>
            )}
          </div>
        )}
      </div>

      {/* 💜 PANTALLA COMPLETA — el cliente escanea cómodo (fondo blanco).
          stopPropagation: al tocarla volvés al modal, NO se cierra todo */}
      {pantallaCompleta && config.yape.qrBase64 && (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-white p-5"
          onClick={e => {
            e.stopPropagation();
            setPantallaCompleta(false);
          }}
          data-testid="qr-yape-fullscreen"
        >
          <p className="text-lg font-black text-slate-900">{nombreFinal}</p>
          <img
            src={config.yape.qrBase64}
            alt={`QR de Yape de ${nombreFinal} — pantalla completa`}
            className="mt-2 max-h-[64vh] max-w-full object-contain"
            data-testid="qr-yape-fullscreen-img"
          />
          {numYape && (
            <p className="mt-3 text-xl font-black tracking-wide text-[#7B2FBE]" data-testid="qr-yape-fullscreen-num">
              {numYape}
            </p>
          )}
          <p className="mt-1 text-xs font-bold text-slate-500">Escanea y págame por Yape 💜</p>
          <p className="mt-4 text-[10px] text-slate-400">tocá en cualquier lado para cerrar</p>
        </div>
      )}
    </div>
  );
}
