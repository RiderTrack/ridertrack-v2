// Stub de '@capacitor/core' para tests (no nativo por defecto).
const T = globalThis.__CAP_T__ || (globalThis.__CAP_T__ = {});
module.exports = {
  Capacitor: {
    isNativePlatform: () => !!(T && T.nativo),
  },
};
