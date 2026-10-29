// Stub de 'firebase/storage' para los tests de FASE AY + FASE AZ —
// graba cada subida en __UPLOAD_T__ (patrón stub-firebase-app) con los
// nombres que usa services/firestore.ts: `ref as storageRef`.
//
// 🧪 FASE AZ: subirFotoPago/subirFotoEntrega suben por
// uploadBytesResumable (vía con tope + cancel + reintento) — el stub
// expone una tarea con .on('state_changed', next, err, complete) y
// .cancel(), configurable por UP.uploadBytes.modo:
//   'ok'       → completa al toque
//   'nunca'    → cuelga para siempre (simula la red zombi) → el tope
//                del SDK REAL cancelaría; acá cancel() dispara el
//                err storage/canceled como hace Firebase de verdad
//   'fallo-n'  → los primeros N intentos fallan con error de red
//   'permiso'  → error definitivo storage/unauthorized (NO se reintenta)
// (uploadBytes queda para cualquier otro módulo que aún lo use.)
const UP = (globalThis.__UPLOAD_T__ ||= {
  uploadBytes: { modo: 'ok', fallos: 0, delayMs: 0, llamadas: 0 },
  getDownloadURL: { modo: 'ok', llamadas: 0 },
  __subidas: [],
});

exports.ref = (storage, ruta) => ({ __ruta: ruta });

exports.uploadBytes = async (ref, file, opts) => {
  UP.__subidas.push({ ruta: ref.__ruta, file, opts });
  const c = UP.uploadBytes;
  c.llamadas = (c.llamadas || 0) + 1;
  if (c.delayMs) await new Promise((r) => setTimeout(r, c.delayMs));
  if (c.modo === 'fallo-n' && c.llamadas <= (c.fallos || 0)) throw new Error('network request failed');
  if (c.modo === 'nunca') return new Promise(() => {});
  if (c.modo === 'permiso') throw new Error('storage/unauthorized');
  return { ref };
};

exports.uploadBytesResumable = (ref, file, opts) => {
  const c = UP.uploadBytes;
  const n = (c.llamadas = (c.llamadas || 0) + 1);
  UP.__subidas.push({ ruta: ref.__ruta, file, opts, intento: n });
  let listeners = null;
  let terminada = false; // completó o falló por sí sola
  let cancelada = false;
  const tarea = {
    cancel() {
      if (terminada || cancelada) return;
      cancelada = true;
      // Firebase dispara err storage/canceled al cancelar (async)
      if (listeners) setTimeout(() => listeners.err(Object.assign(new Error('canceled'), { code: 'storage/canceled' })), 1);
    },
    on(_evento, _next, err, complete) {
      listeners = { err, complete };
      setTimeout(() => {
        if (cancelada || terminada) return;
        if (c.modo === 'fallo-n' && n <= (c.fallos || 0)) {
          terminada = true;
          return err(new Error('network request failed'));
        }
        if (c.modo === 'zombi-n' && n <= (c.fallos || 0)) return; // cuelga (red zombi)
        if (c.modo === 'nunca') return; // cuelga para siempre (red zombi)
        if (c.modo === 'permiso') {
          terminada = true;
          return err(Object.assign(new Error('unauthorized'), { code: 'storage/unauthorized' }));
        }
        terminada = true;
        complete();
      }, c.delayMs || 1);
    },
  };
  return tarea;
};

exports.getDownloadURL = async (ref) => {
  const c = UP.getDownloadURL;
  c.llamadas = (c.llamadas || 0) + 1;
  if (c.modo === 'nunca') return new Promise(() => {});
  return 'https://firebasestorage.test/o/' + encodeURIComponent(ref.__ruta) + '?token=stub';
};
