// ═══════════════════════════════════════════════════════════
// 🙏 MODO "GRACIAS POR TU COMPRA" — Fase 3.34
//
// Cómo la v1: al marcar un pago, el bot manda el "gracias por tu
// compra" (tarjeta con imagen + plantilla, o solo texto) — o nada,
// si prefieres mandarlo a mano (🎯 Control de mensajes).
//
// El modo se guarda en DOS lugares:
//   • localStorage → todas las vistas lo ven AL INSTANTE (Ruta y
//     Pedidos usan instancias separadas de useConfig; sin esto,
//     cambiar el modo en Ruta y pagar en Pedidos en la misma sesión
//     usaría el modo viejo).
//   • Firestore config_empresa → sobrevive reinstalaciones y
//     sincroniza entre rebuilds del APK.
// ═══════════════════════════════════════════════════════════

export type ModoGracias = 'auto_imagen' | 'auto_texto' | 'manual';

const LS_KEY = 'ridertrack_modo_gracias';

/**
 * Lee el modo vigente. Orden: localStorage (instantáneo, compartido
 * entre vistas) → config de Firestore → default 'auto_imagen'
 * (el comportamiento que tenía la v1 y el que pediste de vuelta).
 */
export function leerModoGracias(config?: { gracias?: { modo?: ModoGracias } } | null): ModoGracias {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === 'auto_imagen' || v === 'auto_texto' || v === 'manual') return v;
  } catch { /* localStorage bloqueado (modo privado) — seguir */ }
  return config?.gracias?.modo || 'auto_imagen';
}

/**
 * Guarda el modo en localStorage (visto al instante por todas las
 * vistas). La persistencia en Firestore la hace quien llama (guardarConfig),
 * porque ahí ya hay manejo de red muerta y caché offline.
 */
export function persistirModoGracias(modo: ModoGracias): void {
  try { localStorage.setItem(LS_KEY, modo); } catch { /* sin espacio / privado */ }
}
