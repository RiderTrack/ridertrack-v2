// Stub de 'firebase/firestore' para probar el syncDT REAL sin Firebase.
// Los comportamientos se controlan desde globalThis.__SYNC_TEST__.
const T = (globalThis.__SYNC_TEST__ ||= {
  snapActual: null, // { data: () => payload | undefined }
  setDocImpl: null, // async (data) => void — puede lanzar para simular fallo
  setDocCalls: [], // historial de lo que se intentó subir
  suscripciones: 0,
});

exports.doc = (db, col, id) => ({ __ref: `${col}/${id}` });

// 🔄 FASE W: getDoc para el merge-antes-de-escribir de la caja
// (devuelve T.snapActual como doc existente, o doc vacío)
exports.getDoc = async (ref) => {
  if (T.snapActual && typeof T.snapActual.data === 'function') {
    const data = T.snapActual.data();
    if (data !== undefined) {
      return { exists: () => true, data: () => data, __ref: ref && ref.__ref };
    }
  }
  return { exists: () => false, data: () => undefined, __ref: ref && ref.__ref };
};

exports.onSnapshot = (ref, cb, errCb) => {
  T.suscripciones++;
  T.ultimoCb = cb;
  // como Firestore real: dispara apenas se suscribe con el estado actual
  setImmediate(() => cb(T.snapActual || { data: () => undefined, exists: () => false }));
  return () => {
    if (T.ultimoCb === cb) T.ultimoCb = null;
  };
};

exports.setDoc = async (ref, data) => {
  T.setDocCalls.push(JSON.parse(JSON.stringify(data)));
  if (T.setDocImpl) return T.setDocImpl(data);
};
