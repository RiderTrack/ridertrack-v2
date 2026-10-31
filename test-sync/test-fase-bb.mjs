// ═══════════════════════════════════════════════════════════
// 🎯 TEST FASE BB — v0.11.28
// 1) ✏️ Mensaje del cobro EDITABLE (inDrive: formulario + QR por viaje)
// 2) 🩷 Chicos de venta: mensaje editable + biblioteca + número visible
// Corre con: node test-sync/test-fase-bb.mjs
// (puro — sin Firebase, sin React; utils.ts se compila con esbuild)
// ═══════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const require2 = createRequire(import.meta.url);
require2('esbuild');

// ── compila utils.ts (DatosCobro + armarMensajeCobro) ──
const OUT_UTILS = new URL('./.tmp-bb-utils.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('../src/drivertrack/utils.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: OUT_UTILS,
  logLevel: 'silent',
});
const { armarMensajeCobro } = await import(OUT_UTILS);

// ── ventaMensajes.ts es 100% autocontenido → import directo ──
import {
  PRESETS_VENTA,
  MENSAJE_VENTA_DEF,
  resolverMensajeVenta,
  sanearBiblioteca,
  idMensajeVenta,
} from '../src/utils/ventaMensajes.ts';

let ok = 0, fail = 0;
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
}
const leer = p => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log('🎯 TEST FASE BB — v0.11.28\n');

// ═══════════════════════════════════════════════════════════
console.log('1) 💜 DatosCobro.mensajeEditado — la fórmula del ejecutarCobro');
{
  const config = {
    yape: { numero: '987654321', titular: 'Rudy', qrBase64: '' },
    plin: { numero: '', titular: '', qrBase64: '' },
  };
  const datos = { cliente: 'Carlos', monto: 16, direccion: 'Av. Prueba 123' };
  // ESTA es la fórmula literal que pusimos en ejecutarCobro (shell + caja)
  const textoDe = d => (d.mensajeEditado ?? '').trim() || armarMensajeCobro(d, config, 'yape');

  const auto = textoDe(datos);
  check('sin edición → mensaje automático de siempre', auto.includes('Hola Carlos') && auto.includes('987654321'), JSON.stringify(auto));

  const editado = textoDe({ ...datos, mensajeEditado: '  Hola Carlos, son S/ 16 — mi Yape personal 💜  ' });
  check('con edición → TU texto (recortado de bordes)', editado === 'Hola Carlos, son S/ 16 — mi Yape personal 💜', JSON.stringify(editado));

  const vacio = textoDe({ ...datos, mensajeEditado: '   ' });
  check('edición en blanco → cae al automático (no manda texto vacío)', vacio === auto);

  const indefinido = textoDe({ ...datos, mensajeEditado: undefined });
  check('edición undefined → automático', indefinido === auto);

  // el automático NO cambió (regresión de bloques)
  check('el automático sigue con el bloque Yape + efectivo', auto.includes('💜 Puedes pagarme por Yape') && auto.includes('efectivo'));
  check('el automático sigue con el monto y la dirección', auto.includes('*S/ 16.00*') && auto.includes('Av. Prueba 123'));
}

// ═══════════════════════════════════════════════════════════
console.log('\n2) ✏️ ViajeForm — la visualización quedó LIMPIA (FASE BC: la edición se fue al QR por billetera)');
{
  const src = leer('../src/drivertrack/components/ViajeForm.tsx');
  check('FASE BC: el ✏️ Editar del formulario YA NO ESTÁ (editaba un mensaje que el flujo real no usaba)', !src.includes('data-testid="boton-editar-mensaje"'));
  check('FASE BC: el textarea de edición del formulario YA NO ESTÁ', !src.includes('data-testid="input-mensaje-editado"'));
  check('FASE BC: el ↩️ Automático del formulario YA NO ESTÁ', !src.includes('data-testid="boton-auto-mensaje"'));
  check('la VISUALIZACIÓN sigue (preview-mensaje, se arma viva)', src.includes('data-testid="preview-mensaje"') && src.includes('<TextoWhatsApp texto={armarMensaje()} />'));
  check('nota honesta: te manda al QR del viaje para editar por billetera', src.includes('✏️ Mensaje del cobro'));
  check('cobrar() ya NO viaja con mensajeEditado (el mensaje lo resuelve el shell)', !src.includes('mensajeEditado: mensajeEditado'));
}

// ═══════════════════════════════════════════════════════════
console.log('\n3) 💜 QrViajeModal — mensaje por BILLETERA editable + guardable + librería (FASE BC)');
{
  const src = leer('../src/drivertrack/components/QrViajeModal.tsx');
  check('sección Mensaje del cobro por billetera (qr-viaje-mensaje)', src.includes('data-testid="qr-viaje-mensaje"'));
  check('el título dice QUÉ billetera estás editando', src.includes("Mensaje del cobro — {esYape ? '💜 Yape' : '🔷 Plin'}"));
  check('textarea del editor (qr-viaje-input-msg)', src.includes('data-testid="qr-viaje-input-msg"'));
  check('📚 librería de variantes por billetera (qr-viaje-libreria)', src.includes('data-testid="qr-viaje-libreria"'));
  check('presets de fábrica siempre visibles (PRESETS_QR[wallet])', src.includes('PRESETS_QR[wallet].map'));
  check('💾 guardar en la librería (qr-viaje-guardar-libreria)', src.includes('data-testid="qr-viaje-guardar-libreria"'));
  check('✓ Guardar como MI mensaje — persiste en la config (qr-viaje-guardar-siempre)', src.includes('data-testid="qr-viaje-guardar-siempre"'));
  check('guardar como mío escribe el campo de la billetera', /\{ mensajeQrYape: textoEditor \} : \{ mensajeQrPlin: textoEditor \}/.test(src));
  check('↩️ Volver al automático limpia TU plantilla', src.includes('data-testid="qr-viaje-auto-msg"') && src.includes("mensajeQrYape: ''"));
  check('cambiar de chip de billetera resetea el editor (cada una tiene SU mensaje)', /setWallet\(w\);[\s\S]*?setTexto\(null\)/.test(src));
  check('badge TUYO cuando tenés plantilla guardada', src.includes('TUYO'));
  check('badge EDITADO cuando retocaste', src.includes('EDITADO'));
  check('vista previa resuelta con los datos del viaje (qr-viaje-preview)', src.includes('data-testid="qr-viaje-preview"') && src.includes('Así le va a llegar'));
  check('al mandar: solo viaja mensajeEditado si RETOCASTE (si no, sale TU plantilla guardada)', /mensajeEditado: tocado \? resolverMensajeQr\(textoEditor, varsViaje\) : undefined/.test(src));
  check('las etiquetas se resuelven ANTES de viajar (el bot recibe texto final)', src.includes('resolverMensajeQr(textoEditor, varsViaje)'));
  check('el modal persiste por onGuardarConfig (lo aporta el shell)', src.includes('onGuardarConfig'));
}

// ═══════════════════════════════════════════════════════════
console.log('\n4) 🛡️ mensajeCobroFinal — UN resolutor para TODOS los caminos (FASE BC)');
{
  const shell = leer('../src/drivertrack/DriverTrackView.tsx');
  const caja = leer('../src/drivertrack/panels/PanelCajaDT.tsx');
  for (const [nombre, src] of [['DriverTrackView (shell)', shell], ['PanelCajaDT (caja)', caja]]) {
    check(
      `${nombre}: ejecutarCobro usa mensajeCobroFinal`,
      src.includes('const texto = mensajeCobroFinal(datos, config, metodo)'),
    );
  }
  const cajaView = leer('../src/drivertrack/components/CajaView.tsx');
  check('CajaView (fallback WhatsApp manual) también usa mensajeCobroFinal', cajaView.includes('mensajeCobroFinal(datos, config)'));
  check('el shell aporta onGuardarConfig a la lista (persistir TU mensaje)', shell.includes('onGuardarConfig={actualizarConfigDT}'));
  const elegir = leer('../src/drivertrack/components/ElegirMetodoCobroModal.tsx');
  check('¿Cómo le cobrás? muestra el mensaje que va a salir por opción', elegir.includes('data-testid="elegir-metodo-preview-yape"') && elegir.includes('data-testid="elegir-metodo-preview-plin"'));
}

// ═══════════════════════════════════════════════════════════
console.log('\n5) 🩷 ventaMensajes — presets, etiquetas y biblioteca');
{
  check('3 presets de fábrica (productos / devolución / dudas)', PRESETS_VENTA.length === 3);
  check('ids únicos en los presets', new Set(PRESETS_VENTA.map(p => p.id)).size === 3);
  check('el preset por defecto mejora el mensaje VIEJO del bot (con {cliente})',
    MENSAJE_VENTA_DEF === '💜 *{cliente}, ¿quieres más productos?*\nEscríbele a *{ventas_nombre}* por este mismo número — te atenderá rapidito 🙌',
    JSON.stringify(MENSAJE_VENTA_DEF));
  check('preset de devolución con el caso de Rudy (devolución/reclamo/número)',
    PRESETS_VENTA[1].texto.includes('devolución') && PRESETS_VENTA[1].texto.includes('{ventas_celular}'));

  const r = resolverMensajeVenta('Hola {cliente}, escribile a {ventas_nombre} al {ventas_celular} de {empresa}', {
    cliente: 'María',
    ventas_nombre: 'Fabiana',
    ventas_celular: '987654321',
    empresa: 'MATE',
  });
  check('resolverMensajeVenta cambia TODAS las etiquetas', r === 'Hola María, escribile a Fabiana al 987654321 de MATE', r);

  check('sin datos → no deja llaves crudas', !resolverMensajeVenta('x {cliente} {ventas_nombre} {ventas_celular} {empresa} y', {}).includes('{'));
  check('nombre de ventas vacío → "ventas" (no queda feo)', resolverMensajeVenta('a {ventas_nombre} b', {}).includes('a ventas b'));

  const saneada = sanearBiblioteca([
    { id: 'a', nombre: 'Devo', texto: 'texto a' },
    { id: 'a', nombre: 'DUP', texto: 'duplicado' },                 // id repetido → fuera
    null, 'basura', { id: '', nombre: 'sin id', texto: 'x' },        // basura → fuera
    { id: 'b', nombre: 'Rec', texto: '' },                            // sin texto → fuera
    { id: 'c', nombre: 'Dudas', texto: 'texto c' },
    ...Array.from({ length: 40 }, (_, i) => ({ id: 'z' + i, nombre: 'z' + i, texto: 't' })),
  ]);
  check('sanearBiblioteca: dedupe + basura fuera + tope 30', saneada.length === 30 && saneada[0].id === 'a' && saneada[1].id === 'c');
  check('sanearBiblioteca con cualquier cosa → [] sin reventar', sanearBiblioteca(undefined).length === 0 && sanearBiblioteca('x').length === 0);

  check('idMensajeVenta genera ids únicos', idMensajeVenta() !== idMensajeVenta());
}

// ═══════════════════════════════════════════════════════════
console.log('\n6) 🩷 VentaModal — contrato de fuente (el clic que SÍ llega)');
{
  const src = leer('../src/components/VentaModal.tsx');
  check('persona SIN número NO se manda (mata el clic fantasma)', src.includes('if (!p.celular)'));
  check('avisa dónde cargar el número (⚙️ Configuración → Equipo de ventas)', src.includes('Equipo de ventas'));
  check('cada persona muestra SU número (✓ …)', src.includes('✓ {numBonito}') || src.includes("✓ {numBonito.toString()}") || /✓ \{numBonito/.test(src));
  check('mensaje vacío no se manda', src.includes('Mensaje vacío') || src.includes('mensaje está vacío'));
  check('las etiquetas se resuelven con la persona ELEGIDA antes de enviar', /resolverMensajeVenta\(mensaje,\s*\{\s*cliente: clienteNombre,\s*ventas_nombre: p\.nombre/.test(src));
  check('biblioteca: guardar + borrar', src.includes('venta-abrir-guardar') && src.includes('venta-borrar-'));
  check('presets de fábrica siempre visibles', src.includes('PRESETS_VENTA.map'));
  check('vista previa "Así le va a llegar"', src.includes('Así le va a llegar'));
}

// ═══════════════════════════════════════════════════════════
console.log('\n7) 🔌 RutaView + acción al bot — TODO viaja pegado (lección AM/AN)');
{
  const src = leer('../src/components/RutaView.tsx');
  check('usa el VentaModal nuevo', src.includes('<VentaModal'));
  check('la acción lleva ventas_persona', src.includes('ventas_persona: persona.clave'));
  check('la acción lleva ventas_nombre (para la vCard)', src.includes('ventas_nombre: persona.nombre'));
  check('la acción lleva ventas_celular (para la vCard + guardián)', src.includes('ventas_celular: persona.celular'));
  check('la acción lleva el mensaje RESUELTO', src.includes('mensaje: texto,'));
  check('la biblioteca persiste en config_empresa (guardarConfig)', src.includes('ventasMensajes: list'));
  check('la biblioteca se lee saneada de la config', src.includes('sanearBiblioteca(config?.ventasMensajes)'));
}

// ═══════════════════════════════════════════════════════════
console.log('\n8) 🔢 versión y changelog');
{
  const pkg = leer('../package.json');
  check('package.json → 0.11.29', pkg.includes('"version": "0.11.29"'));
  const aj = leer('../src/drivertrack/components/AjustesView.tsx');
  check('AjustesView muestra v0.11.29 con el resumen de la fase', aj.includes('v0.11.29') && aj.includes('LOS MENSAJES DEL QR'));
  const fs2 = leer('../src/services/firestore.ts');
  check('ConfigCuentas tiene ventasMensajes', fs2.includes('ventasMensajes?: MensajeVenta[]'));
}

// ═══════════════════════════════════════════════════════════
console.log(`\n════════════════════════════════════════════`);
console.log(fail === 0 ? `✅ FASE BB: ${ok}/${ok + fail}` : `❌ FASE BB: ${fail} fallaron (de ${ok + fail})`);
process.exit(fail === 0 ? 0 : 1);
