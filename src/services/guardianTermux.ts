// ═══════════════════════════════════════════════════════════
// 🛡️ GUARDIÁN DE TERMUX — capa de datos (FASE G1 · v0.11.15)
//
// El guardián es un proceso APARTE que corre en Termux junto al
// bot (pm2 start guardian.js --name guardian-termux). Habla con
// la app por Firestore, igual que el bot:
//
//   sistema/termux_estado  (guardián → app)  latido cada 60s:
//      ¿está vivo?, cómo está el bot en PM2 (corriendo/apagado,
//      RAM, reinicios), batería del teléfono.
//   sistema/termux_control (app → guardián)  órdenes:
//      encender / apagar / reiniciar al rudy-bot. El guardián
//      escribe el resultado de vuelta en el MISMO doc.
//
// Reglas Firestore: sistema/{docId} ya existe (read: isAuth ·
// write: isAdmin) — CERO cambios de reglas. La app escribe solo
// termux_control; el estado solo lo escribe el guardián.
// ═══════════════════════════════════════════════════════════

import { doc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

/** Latido del guardián (sistema/termux_estado — lo escribe el guardián) */
export interface EstadoGuardian {
  /** ms del último latido (Date.now() del guardián) */
  ts: number;
  /** ISO del último latido */
  latido: string;
  /** versión del guardián (ej: 'v1.0-g1') */
  version: string;
  /** estado del bot en PM2: online | stopped | launching | no-existe | error-pm2 */
  botEstado: string;
  /** minutos desde el último arranque del bot */
  botUptimeMin: number;
  /** cuántas veces reinició el bot (PM2) */
  botReinicios: number;
  /** RAM del bot en MB */
  botMemMb: number;
  /** CPU del bot (%) */
  botCpu: number;
  /** batería del teléfono (null si no hay Termux:API) */
  bateria: number | null;
  /** desde cuándo corre el guardián (ISO) */
  guardianDesde: string;
}

/** Doc de órdenes (sistema/termux_control — app escribe, guardián responde) */
export interface ControlTermux {
  /** '' inicial | start | stop | restart */
  cmd: string;
  /** ms cuando la app mandó la orden (anti-replay del guardián) */
  ts: number;
  /** quién la mandó (app / pruebas) */
  de: string;
  /** '' pendiente | ok | error — lo escribe el guardián */
  resultado: string;
  /** detalle legible (ej: 'reiniciado', 'ya estaba apagado') */
  detalle: string;
  /** ms cuando el guardián la ejecutó */
  ejecutadoEn: number;
}

/** ¿El guardián está vivo? (latido hace menos de 2.5 min) */
export const GUARDIAN_VIVO_MS = 150_000;

/** Escucha en vivo el latido del guardián. cb(null) = nunca latió. */
export function subscribeEstadoGuardian(cb: (estado: EstadoGuardian | null) => void): Unsubscribe {
  if (!db) return () => undefined;
  return onSnapshot(
    doc(db, 'sistema', 'termux_estado'),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      cb({
        ts: typeof d.ts === 'number' ? d.ts : 0,
        latido: typeof d.latido === 'string' ? d.latido : '',
        version: typeof d.version === 'string' ? d.version : '?',
        botEstado: typeof d.botEstado === 'string' ? d.botEstado : '?',
        botUptimeMin: typeof d.botUptimeMin === 'number' ? d.botUptimeMin : 0,
        botReinicios: typeof d.botReinicios === 'number' ? d.botReinicios : 0,
        botMemMb: typeof d.botMemMb === 'number' ? d.botMemMb : 0,
        botCpu: typeof d.botCpu === 'number' ? d.botCpu : 0,
        bateria: typeof d.bateria === 'number' ? d.bateria : null,
        guardianDesde: typeof d.guardianDesde === 'string' ? d.guardianDesde : '',
      });
    },
    () => cb(null)
  );
}

/** Escucha las órdenes + sus resultados (feedback del guardián). */
export function subscribeControlTermux(cb: (control: ControlTermux | null) => void): Unsubscribe {
  if (!db) return () => undefined;
  return onSnapshot(
    doc(db, 'sistema', 'termux_control'),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      cb({
        cmd: typeof d.cmd === 'string' ? d.cmd : '',
        ts: typeof d.ts === 'number' ? d.ts : 0,
        de: typeof d.de === 'string' ? d.de : '',
        resultado: typeof d.resultado === 'string' ? d.resultado : '',
        detalle: typeof d.detalle === 'string' ? d.detalle : '',
        ejecutadoEn: typeof d.ejecutadoEn === 'number' ? d.ejecutadoEn : 0,
      });
    },
    () => cb(null)
  );
}

/**
 * Manda una orden al guardián. Solo 'start' | 'stop' | 'restart' —
 * el guardián ignora cualquier otra cosa (y las viejas de +5 min).
 */
export async function enviarComandoTermux(cmd: 'start' | 'stop' | 'restart'): Promise<void> {
  if (!db) throw new Error('Firestore no disponible');
  await setDoc(
    doc(db, 'sistema', 'termux_control'),
    { cmd, ts: Date.now(), de: 'app', resultado: '', detalle: '', ejecutadoEn: 0 },
    { merge: true }
  );
}

/** "hace 12s" / "hace 3m" / "hace 2h 5m" — para los carteles en vivo */
export function haceRato(ms: number): string {
  if (ms < 0) return 'ahora';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `hace ${h}h ${rm}m` : `hace ${h}h`;
}
