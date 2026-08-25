// ═══════════════════════════════════════════════════════════
// 📱 PLATFORM HELPER - RiderTrack V2
// Detección centralizada de entorno nativo (APK) vs Web
//
// ⚠️ IMPORTANTE: La API correcta de Capacitor 6 es
//    Capacitor.isNativePlatform() — NO existe "Capacitor.isNative".
//    El bug anterior hacía que en el APK se usara signInWithPopup
//    dentro del WebView (Google lo bloquea → "Something went wrong").
// ═══════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';

/** true si corre dentro del APK (Android/iOS nativo via Capacitor) */
export function isAPK(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** true solo si es Android nativo */
export function isAndroidNative(): boolean {
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/** true si corre en navegador (dev o web) */
export function isWeb(): boolean {
  try {
    return Capacitor.getPlatform() === 'web';
  } catch {
    return true;
  }
}
