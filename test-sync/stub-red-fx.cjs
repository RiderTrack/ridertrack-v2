// Stub de 'firebase/firestore' para el test de RED VIVA (FASE AK):
// disableNetwork/enableNetwork grabados y controlables.
const T = globalThis.__RED_T__ || (globalThis.__RED_T__ = {
  __orden: [],        // secuencia de llamadas: 'disable' | 'enable'
  disableDelayMs: 0,  // para probar el flag _ocupado
  disableFalla: false,
});
T.__reset = function () {
  T.__orden.length = 0;
  T.disableDelayMs = 0;
  T.disableFalla = false;
};

module.exports = {
  disableNetwork: async () => {
    if (T.disableDelayMs) await new Promise((r) => setTimeout(r, T.disableDelayMs));
    T.__orden.push('disable');
    if (T.disableFalla) throw new Error('network unavailable');
  },
  enableNetwork: async () => {
    T.__orden.push('enable');
  },
  doc: () => ({}),
  collection: () => ({}),
  onSnapshot: () => () => {},
  setDoc: async () => {},
  getDoc: async () => ({ exists: () => false }),
  query: (x) => x,
  where: () => null,
  orderBy: () => null,
  limit: () => null,
  serverTimestamp: () => ({}),
  getDocs: async () => ({ forEach: () => {} }),
  writeBatch: () => ({ set: () => {}, commit: async () => {} }),
  persistentLocalCache: () => ({}),
};
