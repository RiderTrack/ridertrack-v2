// Stub de './firebase' (el app: db + storage) para compilar
// src/services/firestore.ts y services/imagenesBot.ts en los tests.
// 🩺 FASE AK/AL: también stubea storageRef/uploadBytes/getDownloadURL,
// controlados por globalThis.__UPLOAD_T__ (los tests de imágenes):
//   uploadBytes:    { modo: 'ok'|'fallo-n'|'nunca'|'permiso', fallos, delayMs }
//   getDownloadURL: { modo: 'ok'|'nunca' }
exports.db = { __stub: 'db-ridertrack' };
exports.storage = { __stub: 'storage-ridertrack' };

const UP = (globalThis.__UPLOAD_T__ ||= {
  uploadBytes: { modo: 'ok', fallos: 0, delayMs: 0, llamadas: 0 },
  getDownloadURL: { modo: 'ok', llamadas: 0 },
  __subidas: [],
});

exports.storageRef = (storage, ruta) => ({ __ruta: ruta });
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
