// ═══════════════════════════════════════════════════════════════
// 🏦 CUENTAS DE BANCO — FASE AV (v0.11.21)
//
// El texto bonito del mensaje de cuentas (mismo estilo que el QR
// de Yape: negritas, nombre del cliente, monto, emojis) lo arma LA
// APP con la config que YA tiene en memoria y lo manda PEGADO en
// la acción cuentas_banco — el bot v3.9-CUENTAS solo lo retransmite.
// Cero lecturas a Firestore pesado (lección AM/AN: lo que viaja en
// la acción llega, aunque la red del Termux esté floja).
//
// La plantilla es EDITABLE en el panel (Configuración → Cuentas
// Bancarias). Etiquetas disponibles:
//   {nombre}   → nombre del cliente
//   {producto} → su producto (o «—» si no tiene)
//   {monto}    → lo que debe pagar (o «a coordinar» si es 0)
//   {bancos}   → los datos del banco elegido (NO la borres)
// ═══════════════════════════════════════════════════════════════
import type { ConfigCuentas } from '../services/firestore';

export const PLANTILLA_CUENTA_DEFAULT = `🏦 *DATOS DE PAGO — TRANSFERENCIA BANCARIA*

🌞 Buenas, *{nombre}* 👋

📦 Producto:
> *{producto}*

💰 Monto a pagar:
*S/ {monto}*

{bancos}

⚠️ *Importante:*
> Verifique que el titular sea el correcto antes de transferir.

📸 Enviarme la \`captura de pantalla\` del pago para confirmar la entrega 🙌

🙌 ¡Muchas gracias! 🎉`;

/** Los 3 bancos que soporta el modal de Mi Ruta */
export const BANCOS_CUENTA = [
  { id: 'bcp', nombre: 'BCP', icono: '🔵' },
  { id: 'bbva', nombre: 'BBVA', icono: '🔷' },
  { id: 'interbank', nombre: 'Interbank', icono: '🟢' },
] as const;

export type BancoId = typeof BANCOS_CUENTA[number]['id'] | 'todas';
export type CategoriaCuenta = 'mia' | 'empresa';

interface CuentaBanco {
  titular?: string;
  cci?: string;
  numero?: string;
}

export interface DatosClienteCuenta {
  nombre?: string;
  producto?: string;
  monto?: number | string;
}

/** La config de un banco según la categoría (mía = bcp, empresa = bcpEmpresa) */
export function cuentaDeCategoria(
  config: ConfigCuentas | null | undefined,
  banco: 'bcp' | 'bbva' | 'interbank',
  categoria: CategoriaCuenta,
): CuentaBanco {
  const clave = (categoria === 'empresa' ? banco + 'Empresa' : banco) as keyof ConfigCuentas;
  return ((config?.[clave] as CuentaBanco | undefined) || {});
}

/** Bloque de UN banco con sus datos ('' si no tiene número) */
function bloqueBanco(cuenta: CuentaBanco, nombre: string, icono: string): string {
  if (!String(cuenta?.numero || '').trim()) return '';
  const lin: string[] = [`${icono} *${nombre}* (Soles)`];
  const titular = String(cuenta.titular || '').trim();
  if (titular) lin.push(`Titular: *${titular}*`);
  lin.push('Cuenta: `' + String(cuenta.numero).trim() + '`');
  const cci = String(cuenta.cci || '').trim();
  if (cci) lin.push('CCI: `' + cci + '`');
  return lin.join('\n');
}

/**
 * El mensaje completo de cuentas — lo arma la app con la config
 * en memoria. banco='todas' mete todos los bancos configurados
 * de la categoría elegida.
 */
export function construirTextoCuenta(
  config: ConfigCuentas | null | undefined,
  cliente: DatosClienteCuenta,
  banco: BancoId,
  categoria: CategoriaCuenta = 'mia',
): string {
  const plantilla = String(config?.plantillaCuenta || '').trim() || PLANTILLA_CUENTA_DEFAULT;

  const ids: Array<'bcp' | 'bbva' | 'interbank'> =
    banco === 'todas' ? ['bcp', 'bbva', 'interbank'] : [banco];
  const bloques: string[] = [];
  for (const id of ids) {
    const def = BANCOS_CUENTA.find(b => b.id === id)!;
    const bl = bloqueBanco(cuentaDeCategoria(config, id, categoria), def.nombre, def.icono);
    if (bl) bloques.push(bl);
  }

  const producto = String(cliente?.producto || '').trim() || '—';
  const montoNum = parseFloat(String(cliente?.monto || 0));
  const monto = montoNum > 0 ? montoNum.toFixed(2) : 'a coordinar';
  const nombre = String(cliente?.nombre || '').trim() || 'Cliente';

  let texto = plantilla
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{producto\}/g, producto)
    .replace(/\{monto\}/g, monto)
    .replace(/\{bancos\}/g, bloques.join('\n\n'));

  // plantillas editadas a las apuradas pueden dejar saltos triples
  texto = texto.replace(/\n{3,}/g, '\n\n').trim();
  return texto;
}

/**
 * Los NÚMEROS de las cuentas elegidas (solo dígitos) para que la
 * acción los lleve PEGADOS: el bot los habilita en el guardián de
 * pagos antes de mandar (si no, el guardián bloquearía el mensaje
 * por hablar de pagos con números que no son el Yape de Lorenzo).
 */
export function construirCuentasAccion(
  config: ConfigCuentas | null | undefined,
  banco: BancoId,
  categoria: CategoriaCuenta = 'mia',
): string[] {
  const ids: Array<'bcp' | 'bbva' | 'interbank'> =
    banco === 'todas' ? ['bcp', 'bbva', 'interbank'] : [banco];
  const out: string[] = [];
  for (const id of ids) {
    const c = cuentaDeCategoria(config, id, categoria);
    for (const v of [c.numero, c.cci]) {
      const d = String(v || '').replace(/\D/g, '');
      if (d.length >= 6) out.push(d);
    }
  }
  return out;
}

/** ¿La categoría tiene al menos UN banco configurado? (para deshabilitar botones) */
export function hayCuentasCategoria(
  config: ConfigCuentas | null | undefined,
  categoria: CategoriaCuenta,
): boolean {
  return BANCOS_CUENTA.some(b => !!String(cuentaDeCategoria(config, b.id, categoria).numero || '').trim());
}
