// Stub de 'firebase/firestore' para la FASE X — envuelve al stub base
// (stub-firestore.cjs, mismo globalThis.__SYNC_TEST__) y le agrega las
// funciones que usa src/services/firestore.ts (collection, query,
// updateDoc, writeBatch, Timestamp…) para poder compilarlo ENTERO.
// La función onSnapshot distingue doc (ruta_activa) de collection
// (clientes_registrados): esta última emite T.registradosSnap con forEach.
const base = require('./stub-firestore.cjs');
const T = globalThis.__SYNC_TEST__;

const moduleExports = Object.assign({}, base, {
  // colecciones: query(...) devuelve el mismo ref (los operadores
  // orderBy/limit/where son no-ops para el test)
  collection: (db, col) => ({ __ref: `col:${col}`, __col: col }),
  query: (ref) => ref,
  orderBy: () => null,
  where: () => null,
  limit: () => null,

  // writes/reads extra — registran igual que setDoc
  updateDoc: async (ref, data) => { T.setDocCalls.push({ __update: JSON.parse(JSON.stringify(data)) }); },
  deleteDoc: async () => {},
  serverTimestamp: () => ({ __ts: 'server' }),
  getDocs: async () => ({ forEach: () => {} }),
  getDocFromCache: async () => ({ exists: () => false, data: () => undefined }),
  writeBatch: () => ({
    set: () => {},
    commit: async () => {},
  }),
  Timestamp: { now: () => ({ toDate: () => new Date() }) },

  // onSnapshot: doc → T.snapActual (base); collection → T.registradosSnap
  onSnapshot: (ref, cb, errCb) => {
    if (ref && ref.__col) {
      T.suscripciones++;
      T.ultimoCbCol = cb;
      setImmediate(() => cb(T.registradosSnap || { forEach: () => {} }));
      return () => { if (T.ultimoCbCol === cb) T.ultimoCbCol = null; };
    }
    return base.onSnapshot(ref, cb, errCb);
  },
});

module.exports = moduleExports;
