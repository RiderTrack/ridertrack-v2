var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// test-sync/stub-cap-app.cjs
var require_stub_cap_app = __commonJS({
  "test-sync/stub-cap-app.cjs"(exports2, module2) {
    var T = globalThis.__CAP_T__ || (globalThis.__CAP_T__ = { __handlers: {} });
    T.__reset = function() {
      T.__handlers = {};
    };
    module2.exports = {
      App: {
        addListener: (ev, cb) => {
          T.__handlers[ev] = cb;
          return { remove: () => {
            delete T.__handlers[ev];
          } };
        }
      },
      AppState: {}
    };
  }
});

// test-sync/stub-red-fx.cjs
var require_stub_red_fx = __commonJS({
  "test-sync/stub-red-fx.cjs"(exports2, module2) {
    var T = globalThis.__RED_T__ || (globalThis.__RED_T__ = {
      __orden: [],
      // secuencia de llamadas: 'disable' | 'enable'
      disableDelayMs: 0,
      // para probar el flag _ocupado
      disableFalla: false
    });
    T.__reset = function() {
      T.__orden.length = 0;
      T.disableDelayMs = 0;
      T.disableFalla = false;
    };
    module2.exports = {
      disableNetwork: async () => {
        if (T.disableDelayMs) await new Promise((r) => setTimeout(r, T.disableDelayMs));
        T.__orden.push("disable");
        if (T.disableFalla) throw new Error("network unavailable");
      },
      enableNetwork: async () => {
        T.__orden.push("enable");
      },
      doc: () => ({}),
      collection: () => ({}),
      onSnapshot: () => () => {
      },
      setDoc: async () => {
      },
      getDoc: async () => ({ exists: () => false }),
      query: (x) => x,
      where: () => null,
      orderBy: () => null,
      limit: () => null,
      serverTimestamp: () => ({}),
      getDocs: async () => ({ forEach: () => {
      } }),
      writeBatch: () => ({ set: () => {
      }, commit: async () => {
      } }),
      persistentLocalCache: () => ({})
    };
  }
});

// test-sync/stub-firebase-app.cjs
var require_stub_firebase_app = __commonJS({
  "test-sync/stub-firebase-app.cjs"(exports2) {
    var T = globalThis.__UPLOAD_T__ || (globalThis.__UPLOAD_T__ = {
      uploadBytes: { modo: "ok", fallos: 0, delayMs: 0 },
      getDownloadURL: { modo: "ok" },
      __subidas: []
      // qué FILES se mandaron a uploadBytes
    });
    T.__reset = function() {
      T.uploadBytes = { modo: "ok", fallos: 0, delayMs: 0 };
      T.getDownloadURL = { modo: "ok" };
      T.__subidas.length = 0;
    };
    exports2.db = { __stub: "db-ridertrack" };
    exports2.storage = { __stub: "storage-ridertrack" };
    exports2.storageRef = (st, ruta) => ({ __ruta: ruta });
    exports2.uploadBytes = async (ref, file, opts) => {
      T.__subidas.push({ ruta: ref.__ruta, file, opts });
      const c = T.uploadBytes;
      if (c.delayMs) await new Promise((r) => setTimeout(r, c.delayMs));
      if (c.modo === "ok") return {};
      if (c.modo === "fallo-n") {
        c.llamadas = (c.llamadas || 0) + 1;
        if (c.llamadas <= (c.fallos || 0)) throw new Error("network request failed (storage)");
        return {};
      }
      if (c.modo === "nunca") {
        c.llamadas = (c.llamadas || 0) + 1;
        return new Promise(() => {
        });
      }
      if (c.modo === "permiso") {
        c.llamadas = (c.llamadas || 0) + 1;
        throw new Error("storage/unauthorized");
      }
      throw new Error("modo uploadBytes desconocido: " + c.modo);
    };
    exports2.getDownloadURL = async (ref) => {
      const c = T.getDownloadURL;
      if (c.modo === "nunca") return new Promise(() => {
      });
      if (c.modo === "fallo-n") {
        c.llamadas = (c.llamadas || 0) + 1;
        if (c.llamadas <= (c.fallos || 0)) throw new Error("network request failed (url)");
      }
      return "https://firebasestorage.test/v0/b/ridertest/o/" + encodeURIComponent(ref.__ruta || "x") + "?token=TOKEN-LARGO";
    };
  }
});

// src/services/redViva.ts
var redViva_exports = {};
__export(redViva_exports, {
  LIMITES_RED_VIVA: () => LIMITES_RED_VIVA,
  _resetRedViva: () => _resetRedViva,
  estuvoEscondidaSuficiente: () => estuvoEscondidaSuficiente,
  instalarRedViva: () => instalarRedViva,
  refrescarConexion: () => refrescarConexion,
  registroRefrescos: () => registroRefrescos
});
module.exports = __toCommonJS(redViva_exports);
var import_app = __toESM(require_stub_cap_app(), 1);
var import_firestore = __toESM(require_stub_red_fx(), 1);
var import_firebase = __toESM(require_stub_firebase_app(), 1);
var LIMITES_RED_VIVA = {
  /** debounce: no refrescar más seguido que esto */
  entreCiclosMs: 15e3,
  /** cuánto tiempo escondida cuenta como «volvió del fondo» */
  escondidaMinimaMs: 15e3
};
var _ultimoCiclo = 0;
var _ocupado = false;
var _escondidaDesde = 0;
var _instalado = false;
var registroRefrescos = [];
async function refrescarConexion(motivo) {
  if (!import_firebase.db) return false;
  const ahora = Date.now();
  if (_ocupado) return false;
  if (ahora - _ultimoCiclo < LIMITES_RED_VIVA.entreCiclosMs) return false;
  _ultimoCiclo = ahora;
  _ocupado = true;
  try {
    await (0, import_firestore.disableNetwork)(import_firebase.db);
    await (0, import_firestore.enableNetwork)(import_firebase.db);
    registroRefrescos.push({ motivo, en: ahora });
    if (registroRefrescos.length > 20) registroRefrescos.shift();
    console.log(`\u{1FA7A} [red] Conexi\xF3n refrescada (${motivo}) \u2014 lo pendiente sale en segundos`);
    return true;
  } catch (e) {
    console.warn("\u{1FA7A} [red] No pude refrescar la conexi\xF3n:", e);
    return false;
  } finally {
    _ocupado = false;
  }
}
function estuvoEscondidaSuficiente(ahora = Date.now()) {
  return !!_escondidaDesde && ahora - _escondidaDesde >= LIMITES_RED_VIVA.escondidaMinimaMs;
}
function _resetRedViva() {
  _ultimoCiclo = 0;
  _ocupado = false;
  _escondidaDesde = 0;
  registroRefrescos.length = 0;
}
function instalarRedViva() {
  if (!import_firebase.db || _instalado) return () => void 0;
  _instalado = true;
  const limpiadores = [];
  const onVisibilidad = () => {
    if (document.visibilityState === "visible") {
      if (estuvoEscondidaSuficiente()) void refrescarConexion("app reabierta");
      _escondidaDesde = 0;
    } else {
      _escondidaDesde = Date.now();
    }
  };
  document.addEventListener("visibilitychange", onVisibilidad);
  limpiadores.push(() => document.removeEventListener("visibilitychange", onVisibilidad));
  try {
    const escucha = import_app.App.addListener("appStateChange", (estado) => {
      if (estado.isActive) {
        if (estuvoEscondidaSuficiente()) void refrescarConexion("app activa (APK)");
        _escondidaDesde = 0;
      } else {
        _escondidaDesde = Date.now();
      }
    });
    if (escucha && typeof escucha?.then === "function") {
      escucha.then((h) => h && limpiadores.push(() => h.remove())).catch(() => void 0);
    } else {
      limpiadores.push(() => {
        try {
          escucha?.remove?.();
        } catch {
        }
      });
    }
  } catch {
  }
  const onOnline = () => void refrescarConexion("volvi\xF3 la se\xF1al");
  window.addEventListener("online", onOnline);
  limpiadores.push(() => window.removeEventListener("online", onOnline));
  console.log("\u{1FA7A} [red] Red viva instalada \u2014 al reabrir la app, la conexi\xF3n se refresca sola");
  return () => {
    _instalado = false;
    limpiadores.forEach((quitar) => {
      try {
        quitar();
      } catch {
      }
    });
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LIMITES_RED_VIVA,
  _resetRedViva,
  estuvoEscondidaSuficiente,
  instalarRedViva,
  refrescarConexion,
  registroRefrescos
});
