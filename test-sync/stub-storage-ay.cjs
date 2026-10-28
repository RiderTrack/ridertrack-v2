// Stub de 'firebase/storage' para el test de la FASE AY — graba cada
// uploadBytes en __UPLOAD_T__ (patrón stub-firebase-app) con los
// nombres que usa services/firestore.ts: `ref as storageRef`.
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
exports.getDownloadURL = async (ref) => {
  const c = UP.getDownloadURL;
  c.llamadas = (c.llamadas || 0) + 1;
  if (c.modo === 'nunca') return new Promise(() => {});
  return 'https://firebasestorage.test/o/' + encodeURIComponent(ref.__ruta) + '?token=stub';
};
