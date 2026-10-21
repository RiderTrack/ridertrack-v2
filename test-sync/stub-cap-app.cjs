// Stub de '@capacitor/app' para compilar services/redViva.ts en tests.
// Registra los listeners para que el test los dispare a mano.
const T = globalThis.__CAP_T__ || (globalThis.__CAP_T__ = { __handlers: {} });
T.__reset = function () { T.__handlers = {}; };

module.exports = {
  App: {
    addListener: (ev, cb) => {
      T.__handlers[ev] = cb;
      // devuelve un handle con remove() (patrón sync del plugin viejo)
      return { remove: () => { delete T.__handlers[ev]; } };
    },
  },
  AppState: {},
};
