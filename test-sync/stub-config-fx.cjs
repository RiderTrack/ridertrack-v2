// Stub de 'firebase/firestore' para el test de CONFIG HONESTA (FASE AJ).
// Da control TOTAL de getDoc/setDoc: se puede elegir si fallan, cuántas
// veces, con qué delay y si nunca resuelven (para el timeout).
// Configuración por globalThis.__CFG_T__:
//   getDoc:  { modo: 'ok'|'vacio'|'fallo-n'|'nunca', fallos: n, data: {...} }
//   setDoc:  { modo: 'ok'|'fallo-n'|'nunca'|'permiso', fallos: n }
const T = globalThis.__CFG_T__ || (globalThis.__CFG_T__ = {
  getDoc: { modo: 'ok', fallos: 0, data: {} },
  setDoc: { modo: 'ok', fallos: 0 },
});

function anotar(map, clave) {
  map[clave] = (map[clave] || 0) + 1;
}

const moduleExports = {
  // refs: doc(db, col, id) → ref marcado
  doc: (db, col, id) => ({ __ref: `doc:${col}/${id}`, __col: col, __id: id }),
  collection: (db, col) => ({ __col: col }),
  query: (ref) => ref,
  orderBy: () => null,
  where: () => null,
  limit: () => null,
  onSnapshot: () => () => {},
  getDocFromCache: async () => { throw new Error('persistencia no habilitada (memory cache)'); },
  serverTimestamp: () => ({ __ts: 'server' }),
  Timestamp: { now: () => ({ toDate: () => new Date() }) },

  getDoc: async (ref) => {
    anotar(T.getDoc, 'llamadas');
    const c = T.getDoc;
    if (c.modo === 'ok') {
      return { exists: () => true, data: () => c.data };
    }
    if (c.modo === 'vacio') {
      return { exists: () => false, data: () => undefined };
    }
    if (c.modo === 'fallo-n') {
      const hechas = c.llamadas || 1;
      if (hechas <= (c.fallos || 0)) throw new Error('network request failed');
      return { exists: () => true, data: () => c.data };
    }
    if (c.modo === 'nunca') {
      return new Promise(() => {}); // nunca resuelve → dispara el conTimeout
    }
    throw new Error('modo getDoc desconocido: ' + c.modo);
  },

  setDoc: async (ref, data, opts) => {
    anotar(T.setDoc, 'llamadas');
    const c = T.setDoc;
    if (c.modo === 'ok') return;
    if (c.modo === 'fallo-n') {
      const hechas = c.llamadas || 1;
      if (hechas <= (c.fallos || 0)) throw new Error('network request failed');
      return;
    }
    if (c.modo === 'permiso') {
      throw new Error('permission-denied: Missing or insufficient permissions');
    }
    if (c.modo === 'nunca') {
      return new Promise(() => {}); // nunca resuelve → conTimeout 'guardado-local'
    }
    throw new Error('modo setDoc desconocido: ' + c.modo);
  },

  updateDoc: async () => {},
  deleteDoc: async () => {},
  writeBatch: () => ({ set: () => {}, commit: async () => {} }),
  getDocs: async () => ({ forEach: () => {} }),
  addDoc: async () => ({}),
};

module.exports = moduleExports;
