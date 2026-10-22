// Stub de 'firebase/firestore' para el test de PLANTILLAS HONESTAS
// (FASE AL). Control total de getDocs/addDoc/onSnapshot con la
// señal metadata.fromCache que la caché persistente le agrega a los
// snapshots. Configuración por globalThis.__PLT_T__:
//   getDocsSnap:  { empty: bool, docs: [{id, data}], metadata: {fromCache} }
//   listenerSnap: { docs: [{id, data}], metadata: {fromCache} }
//   addDocCalls:  historial de addDoc (lo llena el stub)
const T = (globalThis.__PLT_T__ ||= {
  getDocsSnap: { empty: true, docs: [], metadata: { fromCache: false } },
  listenerSnap: { docs: [], metadata: { fromCache: false } },
  addDocCalls: [],
  suscripciones: 0,
});

const snapDe = (cfg) => ({
  empty: cfg.empty === true,
  metadata: cfg.metadata || { fromCache: false },
  forEach: (fn) => (cfg.docs || []).forEach((d) => fn({ id: d.id, data: () => d.data })),
  size: (cfg.docs || []).length,
});

exports.collection = (db, col) => ({ __col: col });
exports.doc = (db, col, id) => ({ __ref: `${col}/${id}` });
exports.query = (ref) => ref;
exports.where = () => null;
exports.orderBy = () => null;
exports.limit = () => null;
exports.QuerySnapshot = class {};
exports.DocumentData = class {};

exports.getDocs = async (ref) => snapDe(T.getDocsSnap);

exports.addDoc = async (ref, data) => {
  T.addDocCalls.push({ col: ref.__col, data });
  return { id: 'nuevo-' + (T.addDocCalls.length + Math.floor(Math.random() * 1000)) };
};

exports.setDoc = async () => {};
exports.deleteDoc = async () => {};
exports.updateDoc = async () => {};
exports.getDoc = async () => ({ exists: () => false, data: () => undefined });
exports.serverTimestamp = () => ({ __ts: 'server' });

exports.onSnapshot = (ref, cb, errCb) => {
  T.suscripciones++;
  setImmediate(() => {
    try {
      cb(snapDe({ empty: (T.listenerSnap.docs || []).length === 0, docs: T.listenerSnap.docs, metadata: T.listenerSnap.metadata }));
    } catch (e) {
      if (errCb) errCb(e);
    }
  });
  return () => {};
};
