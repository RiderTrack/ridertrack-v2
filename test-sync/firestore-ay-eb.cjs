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

// test-sync/stub-firebase-app.cjs
var require_stub_firebase_app = __commonJS({
  "test-sync/stub-firebase-app.cjs"(exports2) {
    exports2.db = { __stub: "db-ridertrack" };
    exports2.storage = { __stub: "storage-ridertrack" };
    var UP = globalThis.__UPLOAD_T__ ||= {
      uploadBytes: { modo: "ok", fallos: 0, delayMs: 0, llamadas: 0 },
      getDownloadURL: { modo: "ok", llamadas: 0 },
      __subidas: []
    };
    exports2.storageRef = (storage2, ruta) => ({ __ruta: ruta });
    exports2.uploadBytes = async (ref, file, opts) => {
      UP.__subidas.push({ ruta: ref.__ruta, file, opts });
      const c = UP.uploadBytes;
      c.llamadas = (c.llamadas || 0) + 1;
      if (c.delayMs) await new Promise((r) => setTimeout(r, c.delayMs));
      if (c.modo === "fallo-n" && c.llamadas <= (c.fallos || 0)) throw new Error("network request failed");
      if (c.modo === "nunca") return new Promise(() => {
      });
      if (c.modo === "permiso") throw new Error("storage/unauthorized");
      return { ref };
    };
    exports2.getDownloadURL = async (ref) => {
      const c = UP.getDownloadURL;
      c.llamadas = (c.llamadas || 0) + 1;
      if (c.modo === "nunca") return new Promise(() => {
      });
      return "https://firebasestorage.test/o/" + encodeURIComponent(ref.__ruta) + "?token=stub";
    };
  }
});

// test-sync/stub-config-fx.cjs
var require_stub_config_fx = __commonJS({
  "test-sync/stub-config-fx.cjs"(exports2, module2) {
    var T = globalThis.__CFG_T__ || (globalThis.__CFG_T__ = {
      getDoc: { modo: "ok", fallos: 0, data: {} },
      setDoc: { modo: "ok", fallos: 0 },
      // 🌤️ FASE AL: getDocFromCache configurable (default 'tira' = el
      // comportamiento de siempre, memoria sin caché → respetado por los
      // tests S1-S16 de la FASE AJ)
      getDocFromCache: null
    });
    function anotar(map, clave) {
      map[clave] = (map[clave] || 0) + 1;
    }
    var moduleExports = {
      // refs: doc(db, col, id) → ref marcado
      doc: (db2, col, id) => ({ __ref: `doc:${col}/${id}`, __col: col, __id: id }),
      collection: (db2, col) => ({ __col: col }),
      query: (ref) => ref,
      orderBy: () => null,
      where: () => null,
      limit: () => null,
      onSnapshot: () => () => {
      },
      getDocFromCache: async (ref) => {
        const c = T.getDocFromCache;
        if (!c || c.modo === "tira") throw new Error("persistencia no habilitada (memory cache)");
        if (c.modo === "ok") return { exists: () => true, data: () => c.data, metadata: { fromCache: true } };
        if (c.modo === "vacio") return { exists: () => false, metadata: { fromCache: true } };
        throw new Error("modo getDocFromCache desconocido: " + c.modo);
      },
      serverTimestamp: () => ({ __ts: "server" }),
      Timestamp: { now: () => ({ toDate: () => /* @__PURE__ */ new Date() }) },
      getDoc: async (ref) => {
        anotar(T.getDoc, "llamadas");
        const c = T.getDoc;
        if (c.modo === "ok") {
          return { exists: () => true, data: () => c.data };
        }
        if (c.modo === "vacio") {
          return { exists: () => false, data: () => void 0 };
        }
        if (c.modo === "fallo-n") {
          const hechas = c.llamadas || 1;
          if (hechas <= (c.fallos || 0)) throw new Error("network request failed");
          return { exists: () => true, data: () => c.data };
        }
        if (c.modo === "nunca") {
          return new Promise(() => {
          });
        }
        throw new Error("modo getDoc desconocido: " + c.modo);
      },
      setDoc: async (ref, data, opts) => {
        anotar(T.setDoc, "llamadas");
        const c = T.setDoc;
        if (c.modo === "ok") return;
        if (c.modo === "fallo-n") {
          const hechas = c.llamadas || 1;
          if (hechas <= (c.fallos || 0)) throw new Error("network request failed");
          return;
        }
        if (c.modo === "permiso") {
          throw new Error("permission-denied: Missing or insufficient permissions");
        }
        if (c.modo === "nunca") {
          return new Promise(() => {
          });
        }
        throw new Error("modo setDoc desconocido: " + c.modo);
      },
      updateDoc: async () => {
      },
      deleteDoc: async () => {
      },
      writeBatch: () => ({ set: () => {
      }, commit: async () => {
      } }),
      getDocs: async () => ({ forEach: () => {
      } }),
      addDoc: async () => ({})
    };
    module2.exports = moduleExports;
  }
});

// test-sync/stub-storage-ay.cjs
var require_stub_storage_ay = __commonJS({
  "test-sync/stub-storage-ay.cjs"(exports2) {
    var UP = globalThis.__UPLOAD_T__ ||= {
      uploadBytes: { modo: "ok", fallos: 0, delayMs: 0, llamadas: 0 },
      getDownloadURL: { modo: "ok", llamadas: 0 },
      __subidas: []
    };
    exports2.ref = (storage2, ruta) => ({ __ruta: ruta });
    exports2.uploadBytes = async (ref, file, opts) => {
      UP.__subidas.push({ ruta: ref.__ruta, file, opts });
      const c = UP.uploadBytes;
      c.llamadas = (c.llamadas || 0) + 1;
      if (c.delayMs) await new Promise((r) => setTimeout(r, c.delayMs));
      if (c.modo === "fallo-n" && c.llamadas <= (c.fallos || 0)) throw new Error("network request failed");
      if (c.modo === "nunca") return new Promise(() => {
      });
      if (c.modo === "permiso") throw new Error("storage/unauthorized");
      return { ref };
    };
    exports2.uploadBytesResumable = (ref, file, opts) => {
      const c = UP.uploadBytes;
      const n = c.llamadas = (c.llamadas || 0) + 1;
      UP.__subidas.push({ ruta: ref.__ruta, file, opts, intento: n });
      let listeners = null;
      let terminada = false;
      let cancelada = false;
      const tarea = {
        cancel() {
          if (terminada || cancelada) return;
          cancelada = true;
          if (listeners) setTimeout(() => listeners.err(Object.assign(new Error("canceled"), { code: "storage/canceled" })), 1);
        },
        on(_evento, _next, err, complete) {
          listeners = { err, complete };
          setTimeout(() => {
            if (cancelada || terminada) return;
            if (c.modo === "fallo-n" && n <= (c.fallos || 0)) {
              terminada = true;
              return err(new Error("network request failed"));
            }
            if (c.modo === "zombi-n" && n <= (c.fallos || 0)) return;
            if (c.modo === "nunca") return;
            if (c.modo === "permiso") {
              terminada = true;
              return err(Object.assign(new Error("unauthorized"), { code: "storage/unauthorized" }));
            }
            terminada = true;
            complete();
          }, c.delayMs || 1);
        }
      };
      return tarea;
    };
    exports2.getDownloadURL = async (ref) => {
      const c = UP.getDownloadURL;
      c.llamadas = (c.llamadas || 0) + 1;
      if (c.modo === "nunca") return new Promise(() => {
      });
      return "https://firebasestorage.test/o/" + encodeURIComponent(ref.__ruta) + "?token=stub";
    };
  }
});

// test-sync/stub-xlsx.cjs
var require_stub_xlsx = __commonJS({
  "test-sync/stub-xlsx.cjs"(exports2, module2) {
    module2.exports = {
      read: () => ({ SheetNames: [], Sheets: {} }),
      utils: {
        book_new: () => ({}),
        json_to_sheet: () => ({}),
        book_append_sheet: () => {
        }
      }
    };
  }
});

// src/services/firestore.ts
var firestore_exports = {};
__export(firestore_exports, {
  CONFIG_CUENTAS_DEFAULT: () => CONFIG_CUENTAS_DEFAULT,
  LIMITES_ACCIONES: () => LIMITES_ACCIONES,
  LIMITES_CONFIG: () => LIMITES_CONFIG,
  LIMITES_SUBIDA: () => LIMITES_SUBIDA,
  _botCel: () => _botCel,
  actualizarClienteEnRutaActiva: () => actualizarClienteEnRutaActiva,
  actualizarRutaActiva: () => actualizarRutaActiva,
  calcularEstadisticas: () => calcularEstadisticas,
  cambiarFechaHistorial: () => cambiarFechaHistorial,
  cargarBackupNube: () => cargarBackupNube,
  cargarConfigCuentas: () => cargarConfigCuentas,
  eliminarBackupNube: () => eliminarBackupNube,
  eliminarRutaHistorial: () => eliminarRutaHistorial,
  encolarAccionBot: () => encolarAccionBot,
  estadoCargaConfig: () => estadoCargaConfig,
  finalizarRuta: () => finalizarRuta,
  finalizarRutaActiva: () => finalizarRutaActiva,
  finalizarRutaActivaBot: () => finalizarRutaActivaBot,
  guardarAutoBackupVivo: () => guardarAutoBackupVivo,
  guardarAvatarRider: () => guardarAvatarRider,
  guardarBackupNube: () => guardarBackupNube,
  guardarClientes: () => guardarClientes,
  guardarColaYUltima: () => guardarColaYUltima,
  guardarConfigCuentas: () => guardarConfigCuentas,
  guardarReprogramados: () => guardarReprogramados,
  guardarUltimaCerrada: () => guardarUltimaCerrada,
  guardarYCerrarRuta: () => guardarYCerrarRuta,
  importarExcel: () => importarExcel,
  importarHistorialV1: () => importarHistorialV1,
  iniciarRutaConBot: () => iniciarRutaConBot,
  leerHistorial: () => leerHistorial,
  leerHistorialV1: () => leerHistorialV1,
  leerUltimaRuta: () => leerUltimaRuta,
  limpiarRutaSinGuardar: () => limpiarRutaSinGuardar,
  listarBackupsNube: () => listarBackupsNube,
  obtenerPlinDelBot: () => obtenerPlinDelBot,
  obtenerYapeDelBot: () => obtenerYapeDelBot,
  probarBot: () => probarBot,
  probarImagenBot: () => probarImagenBot,
  publicarClientesEnRutaActiva: () => publicarClientesEnRutaActiva,
  publicarPosicionRider: () => publicarPosicionRider,
  publicarRutaActiva: () => publicarRutaActiva,
  sincronizarPlinAlBot: () => sincronizarPlinAlBot,
  sincronizarYapeAlBot: () => sincronizarYapeAlBot,
  subirFotoEntrega: () => subirFotoEntrega,
  subirFotoPago: () => subirFotoPago,
  subscribeEstadoBot: () => subscribeEstadoBot,
  subscribeToClientes: () => subscribeToClientes,
  subscribeToClientesRegistrados: () => subscribeToClientesRegistrados,
  subscribeToReprogramados: () => subscribeToReprogramados,
  subscribeToRutaActiva: () => subscribeToRutaActiva,
  suscribirPosicionRider: () => suscribirPosicionRider
});
module.exports = __toCommonJS(firestore_exports);
var import_firebase = __toESM(require_stub_firebase_app(), 1);
var import_firestore = __toESM(require_stub_config_fx(), 1);
var import_storage = __toESM(require_stub_storage_ay(), 1);

// src/utils/stats.ts
var ST_ENTREGADOS = [
  "efectivo",
  "yape-rudy",
  "yape-efectivo",
  "mixto",
  "pos",
  "transferencia",
  "yape-plin",
  "pago-link",
  "jose-smith",
  "empresa",
  "cambio"
];
var ST_FALLIDOS = ["fallida", "rechazado", "cancelado", "ausente", "no-contesta"];
var ST_EMPRESA = ["empresa", "pos", "transferencia", "yape-plin", "pago-link", "jose-smith"];
var ST_RIDER = ["efectivo", "yape-rudy", "cambio"];
function desglosarCobros(clientes) {
  let entregados = 0, fallidos = 0;
  let totalRider = 0, totalEmpresa = 0;
  const porMetodo = {};
  for (const c of clientes || []) {
    const st = String(c?.st || "");
    if (ST_FALLIDOS.includes(st)) {
      fallidos++;
      continue;
    }
    if (!ST_ENTREGADOS.includes(st)) continue;
    entregados++;
    const cobrar = parseFloat(String(c.cobrar || 0));
    if (st === "mixto") {
      const mEf = parseFloat(String(c.mEf || 0));
      const mEmp = parseFloat(String(c.mEmp || 0));
      porMetodo["mixto"] = (porMetodo["mixto"] || 0) + mEf;
      totalRider += mEf;
      totalEmpresa += mEmp;
    } else if (st === "yape-efectivo") {
      const m = Math.max(0, parseFloat(String(c.mEf || 0)) + parseFloat(String(c.mYp || 0)) - parseFloat(String(c.mVt || 0)));
      porMetodo["yape-efectivo"] = (porMetodo["yape-efectivo"] || 0) + m;
      totalRider += m;
    } else if (ST_EMPRESA.includes(st)) {
      porMetodo[st] = (porMetodo[st] || 0) + cobrar;
      totalEmpresa += cobrar;
    } else if (ST_RIDER.includes(st)) {
      porMetodo[st] = (porMetodo[st] || 0) + cobrar;
      totalRider += cobrar;
    } else {
      porMetodo[st] = (porMetodo[st] || 0) + cobrar;
      totalEmpresa += cobrar;
    }
  }
  return {
    entregados,
    fallidos,
    totalRider,
    totalEmpresa,
    porMetodo,
    cobradoTotal: totalRider + totalEmpresa
  };
}
function conTotalesCorregidos(reg) {
  const cl = reg?.clientes;
  if (!Array.isArray(cl) || cl.length === 0) return reg;
  const d = desglosarCobros(cl);
  return {
    ...reg,
    totalRider: d.totalRider,
    totalEmpresa: d.totalEmpresa,
    porMetodo: d.porMetodo,
    cobradoTotal: d.cobradoTotal
  };
}
var _fmtLima = (() => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  } catch {
    return null;
  }
})();
function fechaLimaISO(d = /* @__PURE__ */ new Date()) {
  if (_fmtLima) {
    try {
      const s = _fmtLima.format(d);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    } catch {
    }
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hoyISO() {
  return fechaLimaISO(/* @__PURE__ */ new Date());
}

// src/services/reprog.ts
var ST_ENTREGADOS2 = [
  "efectivo",
  "yape-rudy",
  "yape-efectivo",
  "mixto",
  "pos",
  "transferencia",
  "yape-plin",
  "pago-link",
  "jose-smith",
  "empresa",
  "cambio"
];
function esEntregado(st) {
  return ST_ENTREGADOS2.includes((st || "").trim());
}
var normalizar = (v) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
function claveHistorial(reg) {
  const ts = reg.finalizadaAt || reg.iniciadaAt;
  if (ts) {
    try {
      const k = new Date(ts).toLocaleString("sv-SE", { timeZone: "America/Lima" });
      if (k) return k;
    } catch {
    }
  }
  return `${reg.fecha || ""} 00:00:00`;
}
function noEntregados(clientes) {
  return (clientes || []).filter((c) => {
    if (!normalizar(c.nombre)) return false;
    return !esEntregado(c.st);
  });
}

// src/utils/pagoPedidosCore.ts
var PAGO_PEDIDOS_DEFAULT = {
  activo: false,
  tarifaNormal: 9,
  tarifaLejos: 12,
  distritosLejos: []
};
var ST_ENTREGADOS3 = [
  "efectivo",
  "yape-rudy",
  "yape-efectivo",
  "mixto",
  "pos",
  "transferencia",
  "yape-plin",
  "pago-link",
  "jose-smith",
  "empresa",
  "cambio"
];
function normalizarDistrito(dist) {
  return String(dist || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").trim().replace(/\s+/g, " ");
}
function distritoEsLejos(dist, distritosLejos) {
  const objetivo = normalizarDistrito(dist);
  if (!objetivo) return false;
  return distritosLejos.some((d) => normalizarDistrito(d) === objetivo && normalizarDistrito(d) !== "");
}
function esLejos(cliente, config) {
  if (typeof cliente.lejos === "boolean") return cliente.lejos;
  return distritoEsLejos(cliente.dist || "", config.distritosLejos || []);
}
function calcularPagoPedidos(clientes, config) {
  const res = {
    cantidadNormal: 0,
    cantidadLejos: 0,
    entregados: 0,
    montoNormal: 0,
    montoLejos: 0,
    total: 0
  };
  if (!config.activo) return res;
  const tarifaNormal = numeroValido(config.tarifaNormal) ? config.tarifaNormal : PAGO_PEDIDOS_DEFAULT.tarifaNormal;
  const tarifaLejos = numeroValido(config.tarifaLejos) ? config.tarifaLejos : PAGO_PEDIDOS_DEFAULT.tarifaLejos;
  for (const c of clientes || []) {
    const st = String(c?.st || "pendiente");
    if (!ST_ENTREGADOS3.includes(st)) continue;
    res.entregados++;
    if (esLejos(c, config)) {
      res.cantidadLejos++;
      res.montoLejos += tarifaLejos;
    } else {
      res.cantidadNormal++;
      res.montoNormal += tarifaNormal;
    }
  }
  res.montoNormal = redondear(res.montoNormal);
  res.montoLejos = redondear(res.montoLejos);
  res.total = redondear(res.montoNormal + res.montoLejos);
  return res;
}
var LS_KEY = "rt_pago_pedidos";
function cargarConfigPagoPedidos() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...PAGO_PEDIDOS_DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      activo: parsed.activo === true,
      tarifaNormal: numeroValido(parsed.tarifaNormal) ? Number(parsed.tarifaNormal) : PAGO_PEDIDOS_DEFAULT.tarifaNormal,
      tarifaLejos: numeroValido(parsed.tarifaLejos) ? Number(parsed.tarifaLejos) : PAGO_PEDIDOS_DEFAULT.tarifaLejos,
      distritosLejos: Array.isArray(parsed.distritosLejos) ? parsed.distritosLejos.filter((d) => typeof d === "string" && d.trim()).map((d) => d.trim()) : []
    };
  } catch {
    return { ...PAGO_PEDIDOS_DEFAULT };
  }
}
function numeroValido(n) {
  return typeof n === "number" && isFinite(n) && n > 0;
}
function redondear(n) {
  return Math.round(n * 100) / 100;
}

// src/utils/moneda.ts
function parseMonedaPeru(valor) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }
  let s = String(valor ?? "").trim();
  if (!s) return 0;
  s = s.replace(/s\/\.?\s*/gi, "").replace(/soles?/gi, "").replace(/[$]/gi, "");
  s = s.replace(/\s+/g, "").replace(/'/g, "");
  if (!s || s === "-" || s === "." || s === ",") return 0;
  const tieneComa = s.includes(",");
  const tienePunto = s.includes(".");
  if (tieneComa && tienePunto) {
    const posComa = s.lastIndexOf(",");
    const posPunto = s.lastIndexOf(".");
    if (posPunto > posComa) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    }
  } else if (tieneComa) {
    const partes = s.split(",");
    s = partes.length > 2 ? partes.join("") : s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function montosConRespaldo(crudoCobrar, crudoPrecio) {
  const cobrar = parseMonedaPeru(crudoCobrar);
  const precio = parseMonedaPeru(crudoPrecio);
  return {
    cobrar: cobrar > 0 ? cobrar : precio,
    precio: precio > 0 ? precio : cobrar
  };
}

// src/services/firestore.ts
async function guardarClientes(userId, clientes) {
  if (!import_firebase.db || !userId) return;
  try {
    const userDocRef = (0, import_firestore.doc)(import_firebase.db, "usuarios", userId);
    await (0, import_firestore.setDoc)(userDocRef, {
      clientes,
      actualizadoEn: (0, import_firestore.serverTimestamp)()
    }, { merge: true });
    console.log("\u2705 Clientes guardados en Firestore:", clientes.length);
  } catch (e) {
    console.error("\u274C Error guardando clientes:", e);
  }
}
async function guardarReprogramados(userId, items) {
  if (!import_firebase.db || !userId) return;
  try {
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", userId), {
      reprogramados: items,
      reprogActualizadoEn: (0, import_firestore.serverTimestamp)()
    }, { merge: true });
    console.log("\u2705 Reprogramados guardados:", items.length);
  } catch (e) {
    console.error("\u274C Error guardando reprogramados:", e);
  }
}
async function guardarColaYUltima(userId, items, ultima) {
  if (!import_firebase.db || !userId) return;
  try {
    const body = {
      reprogramados: items,
      reprogActualizadoEn: (0, import_firestore.serverTimestamp)()
    };
    if (ultima) body.ultimaCerrada = ultima;
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", userId), body, { merge: true });
    console.log("\u2705 Cola + \xFAltima cerrada guardadas juntas:", items.length);
  } catch (e) {
    console.error("\u274C Error guardando cola+\xFAltima:", e);
  }
}
async function guardarUltimaCerrada(userId, ultima) {
  if (!import_firebase.db || !userId) return;
  try {
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", userId), { ultimaCerrada: ultima }, { merge: true });
  } catch (e) {
    console.error("\u274C Error guardando ultimaCerrada:", e);
  }
}
function subscribeToReprogramados(userId, onUpdate, onError) {
  if (!import_firebase.db || !userId) {
    onUpdate([], null);
    return () => {
    };
  }
  try {
    const userDocRef = (0, import_firestore.doc)(import_firebase.db, "usuarios", userId);
    return (0, import_firestore.onSnapshot)(
      userDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          onUpdate([], null);
          return;
        }
        const data = snapshot.data();
        const cola = Array.isArray(data.reprogramados) ? data.reprogramados : [];
        const uc = data.ultimaCerrada;
        const ultima = uc && typeof uc === "object" && Array.isArray(uc.noEntregados) ? uc : null;
        onUpdate(cola, ultima);
      },
      (err) => {
        console.warn("Error subscribe reprogramados:", err);
        onError?.(err);
        onUpdate([], null);
      }
    );
  } catch (e) {
    console.warn("Excepci\xF3n subscribe reprogramados:", e);
    onUpdate([], null);
    return () => {
    };
  }
}
async function leerUltimaRuta(userId) {
  if (!import_firebase.db || !userId) return null;
  try {
    const ref = (0, import_firestore.collection)(import_firebase.db, "historial_rutas");
    const q = (0, import_firestore.query)(ref, (0, import_firestore.where)("uid", "==", userId), (0, import_firestore.limit)(30));
    const snap = await (0, import_firestore.getDocs)(q);
    const registros = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data?.uid !== userId && !d.id.startsWith(`${userId}_`)) return;
      registros.push({
        id: d.id,
        uid: data.uid || userId,
        fecha: data.fecha || "",
        iniciadaAt: data.iniciadaAt,
        finalizadaAt: data.finalizadaAt,
        totalClientes: data.totalClientes || 0,
        entregados: data.entregados || 0,
        fallidos: data.fallidos || 0,
        pendientes: data.pendientes || 0,
        cobradoTotal: data.cobradoTotal || 0,
        clientes: data.clientes || []
      });
    });
    registros.sort((a, b) => claveHistorial(b).localeCompare(claveHistorial(a)));
    return registros[0] || null;
  } catch (e) {
    console.error("\u274C Error leyendo \xFAltima ruta:", e);
    return null;
  }
}
function subscribeToClientes(userId, onUpdate, onError) {
  if (!import_firebase.db || !userId) {
    console.warn("Firestore: no disponible o sin userId");
    onUpdate([]);
    return () => {
    };
  }
  try {
    const userDocRef = (0, import_firestore.doc)(import_firebase.db, "usuarios", userId);
    return (0, import_firestore.onSnapshot)(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.clientes && Array.isArray(data.clientes)) {
            onUpdate(data.clientes);
          } else {
            onUpdate([]);
          }
        } else {
          onUpdate([]);
        }
      },
      (err) => {
        console.warn("Error cargando clientes:", err);
        if (onError) onError(err);
        onUpdate([]);
      }
    );
  } catch (e) {
    console.warn("Excepci\xF3n:", e);
    onUpdate([]);
    return () => {
    };
  }
}
async function publicarRutaActiva(userId, clientes, riderConfig) {
  if (!import_firebase.db || !userId) return;
  const datos = {
    activa: true,
    iniciadaAt: (/* @__PURE__ */ new Date()).toISOString(),
    actualizadaAt: (/* @__PURE__ */ new Date()).toISOString(),
    rider: riderConfig,
    clientes: clientes.map((c, idx) => ({
      idx,
      id: c.id,
      nombre: c.nombre || "Cliente",
      cel: _botCel(c.cel || ""),
      cobrar: parseFloat(String(c.cobrar || 0)),
      precio: parseFloat(String(c.precio || 0)),
      prod: c.prod || "",
      dir: c.dir || "",
      dist: c.dist || "",
      st: c.st || "pendiente",
      nota: c.nota || "",
      obs: c.obs || "",
      hora: c.hora || ""
    })),
    clienteActualIdx: -1,
    totalClientes: clientes.length,
    pendientes: clientes.filter((c) => c.st === "pendiente" || !c.st).length
  };
  try {
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "ruta_activa", userId), datos, { merge: true });
    console.log("\u{1F680} Ruta activa publicada");
  } catch (e) {
    console.error("\u274C Error publicando ruta:", e);
  }
}
async function actualizarRutaActiva(userId, clientes) {
  if (!import_firebase.db || !userId) return;
  const update = {
    actualizadaAt: (/* @__PURE__ */ new Date()).toISOString(),
    clientes: clientes.map((c, idx) => ({
      idx,
      id: c.id,
      nombre: c.nombre || "Cliente",
      cel: _botCel(c.cel || ""),
      cobrar: parseFloat(String(c.cobrar || 0)),
      prod: c.prod || "",
      dir: c.dir || "",
      dist: c.dist || "",
      st: c.st || "pendiente"
    })),
    pendientes: clientes.filter((c) => c.st === "pendiente" || !c.st).length
  };
  try {
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "ruta_activa", userId), update, { merge: true });
  } catch (e) {
    console.warn("Error actualizando ruta:", e);
  }
}
async function finalizarRutaActiva(userId) {
  if (!import_firebase.db || !userId) return;
  try {
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "ruta_activa", userId), {
      activa: false,
      finalizadaAt: (/* @__PURE__ */ new Date()).toISOString(),
      actualizadaAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    console.log("\u2705 Ruta finalizada");
  } catch (e) {
    console.warn("Error finalizando ruta:", e);
  }
}
async function finalizarRuta(userId, clientes, tiempoRutaMs) {
  if (!import_firebase.db || !userId) return { backupNube: false };
  try {
    const total = clientes.length;
    const fechaHoy = hoyISO();
    const desglose = desglosarCobros(clientes);
    const entregados = desglose.entregados;
    const fallidos = desglose.fallidos;
    const porMetodo = desglose.porMetodo;
    const totalEmpresa = desglose.totalEmpresa;
    const totalRider = desglose.totalRider;
    const cobrado = desglose.cobradoTotal;
    const cfgPago = cargarConfigPagoPedidos();
    const pagoPedidos = cfgPago.activo ? {
      activo: true,
      tarifaNormal: cfgPago.tarifaNormal,
      tarifaLejos: cfgPago.tarifaLejos,
      distritosLejos: cfgPago.distritosLejos,
      ...calcularPagoPedidos(clientes, cfgPago)
    } : null;
    const clientesSnapshot = clientes.map((c) => ({
      id: c.id,
      num: c.num || null,
      nombre: c.nombre || "Cliente",
      cel: c.cel || "",
      prod: c.prod || "",
      cobrar: parseFloat(String(c.cobrar || 0)),
      mEf: parseFloat(String(c.mEf || 0)),
      mYp: parseFloat(String(c.mYp || 0)),
      mEmp: parseFloat(String(c.mEmp || 0)),
      mVt: parseFloat(String(c.mVt || 0)),
      dir: c.dir || "",
      dist: c.dist || "",
      st: c.st || "pendiente",
      hora: c.hora || "",
      obs: c.obs || "",
      nota: c.nota || "",
      // 📸 Fase 2.16: la foto de evidencia viaja al historial — así la
      // Galería de Entregas puede mostrar las fotos de rutas cerradas
      // (antes el snapshot la omitía y la foto quedaba huérfana en Storage)
      fotoUrl: c.fotoUrl,
      // ✅ el check de verificación con la empresa viaja al historial
      webReg: c.webReg === true,
      // 🛵 FASE D: la marca lejos viaja al historial (para re-ver el
      // desglose de 9/12 de rutas pasadas)
      ...typeof c.lejos === "boolean" ? { lejos: c.lejos } : {}
    }));
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "historial_rutas", `${userId}_${Date.now()}`), limpiarUndefined({
      uid: userId,
      fecha: fechaHoy,
      iniciadaAt: (/* @__PURE__ */ new Date()).toISOString(),
      finalizadaAt: (/* @__PURE__ */ new Date()).toISOString(),
      totalClientes: total,
      entregados,
      fallidos,
      pendientes: total - entregados - fallidos,
      cobradoTotal: cobrado,
      porMetodo,
      totalEmpresa,
      totalRider,
      // ⏱ duración de la ruta medida por el cronómetro (como la v1)
      tiempoRuta: tiempoRutaMs && tiempoRutaMs > 0 ? tiempoRutaMs : null,
      clientes: clientesSnapshot,
      // 🛵 FASE D (solo días con modo activo — el spread con null
      // no agrega el campo, los días OFF quedan idénticos a antes)
      ...pagoPedidos ? { pagoPedidos } : {}
    }));
    let backupNube = false;
    try {
      await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", userId, "backups", `auto_${fechaHoy}`), limpiarUndefined({
        cl: clientesSnapshot,
        registro: { fecha: fechaHoy, total, entregados, fallidos, cobradoTotal: cobrado, totalRider, totalEmpresa, porMetodo },
        fecha: fechaHoy,
        hora: (/* @__PURE__ */ new Date()).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
        clientes: total,
        auto: true,
        tipo: "cierre-ruta",
        creadoAt: (/* @__PURE__ */ new Date()).toISOString()
      }), { merge: true });
      backupNube = true;
      console.log("\u2601\uFE0F Backup autom\xE1tico de cierre guardado (auto_" + fechaHoy + ") \u2014 ruta v1");
    } catch (e) {
      console.warn("\u26A0\uFE0F Backup de cierre (ruta v1) fall\xF3 \u2014 el historial S\xCD se guard\xF3:", e.message);
    }
    try {
      await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "backups_v2", `${userId}_${Date.now()}`), limpiarUndefined({
        uid: userId,
        creadoAt: (/* @__PURE__ */ new Date()).toISOString(),
        fecha: fechaHoy,
        hora: (/* @__PURE__ */ new Date()).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
        totalClientes: total,
        entregados,
        fallidos,
        pendientes: total - entregados - fallidos,
        cobradoTotal: cobrado,
        totalRider,
        totalEmpresa,
        clientes: clientesSnapshot,
        auto: true,
        tipo: "cierre-ruta"
      }));
      backupNube = true;
      console.log("\u2601\uFE0F Backup autom\xE1tico de cierre guardado en backups_v2 (visible en \u2601\uFE0F Backups)");
    } catch (e) {
      console.warn("\u26A0\uFE0F Backup de cierre (backups_v2) fall\xF3 \u2014 el historial S\xCD se guard\xF3:", e.message);
    }
    try {
      const batch = (0, import_firestore.writeBatch)(import_firebase.db);
      let enBatch = 0;
      clientes.forEach((c) => {
        const tel = String(c.cel || "").replace(/\D/g, "");
        if (!tel) return;
        batch.set((0, import_firestore.doc)(import_firebase.db, "clientes_registrados", tel), {
          telefono: tel,
          nombre: c.nombre || "",
          prod: c.prod || "",
          cobrar: parseFloat(String(c.cobrar || 0)),
          dir: c.dir || "",
          dist: c.dist || "",
          st: c.st || "pendiente",
          ultimaVisita: (/* @__PURE__ */ new Date()).toISOString(),
          registradoAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true });
        enBatch++;
      });
      if (enBatch > 0) await batch.commit();
    } catch (e) {
      console.warn("\u26A0\uFE0F clientes_registrados fall\xF3 (no bloquea el cierre):", e.message);
    }
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "ruta_activa", UID_BOT_MODULAR), {
      clientes: [],
      totalClientes: 0,
      pendientes: 0,
      activa: false,
      finalizadaAt: (/* @__PURE__ */ new Date()).toISOString(),
      actualizadaAt: (/* @__PURE__ */ new Date()).toISOString(),
      resumen: { total, entregados, fallidos, cobradoTotal: cobrado }
    }, { merge: true });
    const noEntSnap = noEntregados(clientes).map((c) => ({
      id: c.id,
      num: c.num || null,
      nombre: c.nombre || "Cliente",
      cel: c.cel || "",
      prod: c.prod || "",
      precio: parseFloat(String(c.precio || 0)),
      cobrar: parseFloat(String(c.cobrar || 0)),
      dir: c.dir || "",
      dist: c.dist || "",
      obs: c.obs || "",
      st: c.st || "pendiente",
      hora: c.hora || "",
      nota: c.nota || "",
      ...typeof c.lat === "number" && typeof c.lng === "number" ? { lat: c.lat, lng: c.lng, ...c.latSrc ? { latSrc: c.latSrc } : {} } : {},
      ...typeof c.lejos === "boolean" ? { lejos: c.lejos } : {},
      ...c.reprogramadoPara ? { reprogramadoPara: c.reprogramadoPara } : {}
    }));
    try {
      await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", userId), {
        clientes: [],
        rutaLimpiadaAt: (/* @__PURE__ */ new Date()).toISOString(),
        ultimaCerrada: {
          fecha: fechaHoy,
          noEntregados: noEntSnap
        }
      }, { merge: true });
    } catch (e) {
      console.warn("\u26A0\uFE0F No se pudo limpiar usuarios/{uid}.clientes:", e.message);
    }
    console.log("\u{1F3C1} Ruta finalizada: historial + backup nube + lista limpia");
    return { backupNube };
  } catch (e) {
    console.error("\u274C Error finalizando ruta:", e);
    throw e;
  }
}
async function guardarYCerrarRuta(userId, clientes, tiempoRutaMs) {
  return finalizarRuta(userId, clientes, tiempoRutaMs);
}
async function limpiarRutaSinGuardar(userId) {
  if (!import_firebase.db || !userId) return;
  try {
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "ruta_activa", "K8wx9X5GGOfindI1RGtIIQN3UGr1"), {
      clientes: [],
      totalClientes: 0,
      pendientes: 0,
      activa: false,
      limpiadaAt: (/* @__PURE__ */ new Date()).toISOString(),
      actualizadaAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", userId), {
      clientes: [],
      limpiadaAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    console.log("\u{1F5D1}\uFE0F Ruta limpiada (sin guardar)");
  } catch (e) {
    console.error("\u274C Error limpiando ruta:", e);
    throw e;
  }
}
var UID_BOT_MODULAR = "K8wx9X5GGOfindI1RGtIIQN3UGr1";
function subscribeToRutaActiva(onUpdate, onError) {
  if (!import_firebase.db) {
    onUpdate([]);
    return () => {
    };
  }
  try {
    const rutaRef = (0, import_firestore.doc)(import_firebase.db, "ruta_activa", UID_BOT_MODULAR);
    return (0, import_firestore.onSnapshot)(
      rutaRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const clientesData = data.clientes || [];
          const clientes = clientesData.map((c, idx) => ({
            id: c.id || Date.now() + idx,
            num: c.num || idx + 1,
            nombre: c.nombre || "",
            cel: c.cel || "",
            prod: c.prod || "",
            precio: parseMonedaPeru(c.precio) || parseMonedaPeru(c.cobrar),
            cobrar: parseMonedaPeru(c.cobrar) || parseMonedaPeru(c.precio),
            dir: c.dir || "",
            dist: c.dist || "",
            obs: c.obs || "",
            st: c.st || "pendiente",
            mEf: c.mEf || 0,
            mYp: c.mYp || 0,
            mEmp: c.mEmp || 0,
            mVt: c.mVt || 0,
            mEM: c.mEM || "",
            hora: c.hora || "",
            nota: c.nota || "",
            fotoUrl: c.fotoUrl,
            respondioInicioRuta: c.respondioInicioRuta,
            // ✅ Registro web (verificación con la empresa — Fase 2.6)
            webReg: c.webReg === true,
            // 🛵 FASE X (fix S/12): la marca lejos VUELVE del doc del
            // bot — sin esto el snapshot la BORRABA en cada update y tu
            // paga contaba TODOS los pedidos como S/9 (2 de 12 + 4 de 9
            // → contaba 54 en vez de 60). El bot y el publish ya la
            // escribían: solo faltaba leerla de vuelta.
            ...typeof c.lejos === "boolean" ? { lejos: c.lejos } : {},
            // Coordenadas geocodificadas (Fase 1.3/1.4) — viajan con
            // el cliente para no volver a geocodificar nunca
            ...typeof c.lat === "number" && typeof c.lng === "number" ? { lat: c.lat, lng: c.lng } : {},
            ...c.latSrc ? { latSrc: c.latSrc } : {},
            // 📅 FASE AD: la marca de reprogramado VUELVE del doc del
            // bot (misma lección del lejos — sin leerla de vuelta, el
            // publish la borra al primer update).
            ...c.reprog === true ? { reprog: true } : {},
            ...c.reprogDesde ? { reprogDesde: c.reprogDesde } : {},
            ...c.reprogramadoPara ? { reprogramadoPara: c.reprogramadoPara } : {}
          }));
          console.log("\u{1F504} Clientes del Modular cargados:", clientes.length);
          onUpdate(clientes, { existe: true });
        } else {
          onUpdate([], { existe: false });
        }
      },
      (err) => {
        console.error("\u274C Error escuchando ruta_activa:", err);
        onError?.(err);
      }
    );
  } catch (e) {
    console.error("Error subscribeToRutaActiva:", e);
    onError?.(e);
    return () => {
    };
  }
}
function subscribeToClientesRegistrados(onUpdate, onError) {
  if (!import_firebase.db) {
    onUpdate([]);
    return () => {
    };
  }
  try {
    const q = (0, import_firestore.query)((0, import_firestore.collection)(import_firebase.db, "clientes_registrados"), (0, import_firestore.orderBy)("registradoAt", "desc"), (0, import_firestore.limit)(200));
    return (0, import_firestore.onSnapshot)(
      q,
      (snapshot) => {
        const clientes = [];
        snapshot.forEach((docSnap) => {
          const c = docSnap.data();
          clientes.push({
            id: c.telefono || docSnap.id,
            num: clientes.length + 1,
            nombre: c.nombre || "",
            cel: c.telefono || "",
            prod: c.prod || "",
            precio: parseFloat(String(c.cobrar || 0)),
            cobrar: parseFloat(String(c.cobrar || 0)),
            dir: c.dir || "",
            dist: c.dist || "",
            obs: "",
            st: c.st || "pendiente",
            mEf: 0,
            mYp: 0,
            mEmp: 0,
            mVt: 0,
            mEM: "",
            hora: "",
            nota: "",
            // 🛵 FASE X: idem subscribeToRutaActiva — si el respaldo
            // trae la marca lejos, se conserva
            ...typeof c.lejos === "boolean" ? { lejos: c.lejos } : {}
          });
        });
        console.log("\u{1F504} Clientes registrados del Modular cargados:", clientes.length);
        onUpdate(clientes);
      },
      (err) => {
        console.error("\u274C Error escuchando clientes_registrados:", err);
        onError?.(err);
      }
    );
  } catch (e) {
    console.error("Error subscribeToClientesRegistrados:", e);
    onError?.(e);
    return () => {
    };
  }
}
async function actualizarClienteEnRutaActiva(userId, clienteId, cambios) {
  if (!import_firebase.db) return;
  try {
    const rutaRef = (0, import_firestore.doc)(import_firebase.db, "ruta_activa", UID_BOT_MODULAR);
    const snap = await (0, import_firestore.getDoc)(rutaRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const clientes = data.clientes || [];
    const idx = clientes.findIndex((c) => String(c.id) === String(clienteId));
    if (idx >= 0) {
      clientes[idx] = {
        ...clientes[idx],
        ...cambios,
        st: cambios.st || clientes[idx].st,
        hora: cambios.hora || clientes[idx].hora
      };
      await (0, import_firestore.setDoc)(rutaRef, {
        clientes,
        actualizadaAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true });
      console.log("\u{1F504} Cliente actualizado en ruta_activa (sincronizado con Modular)");
    }
  } catch (e) {
    console.error("\u274C Error actualizando cliente en ruta_activa:", e);
  }
}
async function publicarClientesEnRutaActiva(userId, clientes) {
  if (!import_firebase.db) return;
  try {
    const rutaRef = (0, import_firestore.doc)(import_firebase.db, "ruta_activa", UID_BOT_MODULAR);
    const clientesFormateados = clientes.map((c, idx) => ({
      idx,
      id: c.id,
      num: c.num || idx + 1,
      nombre: c.nombre || "Cliente",
      cel: _botCel(c.cel || ""),
      cobrar: parseFloat(String(c.cobrar || 0)),
      precio: parseFloat(String(c.precio || 0)),
      prod: c.prod || "",
      dir: c.dir || "",
      dist: c.dist || "",
      st: c.st || "pendiente",
      nota: c.nota || "",
      obs: c.obs || "",
      hora: c.hora || "",
      ...c.webReg != null ? { webReg: !!c.webReg } : {},
      ...typeof c.lejos === "boolean" ? { lejos: c.lejos } : {},
      ...typeof c.lat === "number" && typeof c.lng === "number" ? { lat: c.lat, lng: c.lng } : {},
      ...c.latSrc ? { latSrc: c.latSrc } : {},
      // 📅 FASE AD: la marca de reprogramado viaja con el cliente —
      // sin esto el snapshot del bot la BORRABA en cada update y el
      // badge 🔁 desaparecía al instante (misma lección del lejos).
      ...c.reprog ? { reprog: true } : {},
      ...c.reprogDesde ? { reprogDesde: c.reprogDesde } : {},
      ...c.reprogramadoPara ? { reprogramadoPara: c.reprogramadoPara } : {}
    }));
    await (0, import_firestore.setDoc)(rutaRef, {
      activa: true,
      actualizadaAt: (/* @__PURE__ */ new Date()).toISOString(),
      clientes: clientesFormateados,
      totalClientes: clientes.length,
      pendientes: clientes.filter((c) => c.st === "pendiente" || !c.st).length
    }, { merge: true });
    console.log("\u{1F504} Clientes publicados en ruta_activa (sincronizados con Modular):", clientes.length);
  } catch (e) {
    console.error("\u274C Error publicando clientes en ruta_activa:", e);
  }
}
var CONFIG_CUENTAS_DEFAULT = {
  yape: { nombre: "Rudy Alen", telefono: "999999999", qrUrl: "" },
  bcp: { titular: "Rudy Alen", cci: "002-999-999999999999-99", numero: "999-99999999-9-99" },
  bbva: { titular: "Rudy Alen", cci: "011-999-000000000000-00", numero: "0011-9999-9900000000" },
  interbank: { titular: "Rudy Alen", cci: "003-000-999999999-99", numero: "999-999999999-99" },
  bcpEmpresa: { titular: "", cci: "", numero: "" },
  bbvaEmpresa: { titular: "", cci: "", numero: "" },
  interbankEmpresa: { titular: "", cci: "", numero: "" },
  plantillaCuenta: "",
  plin: { nombre: "Rudy Alen", telefono: "999999999", qrUrl: "" },
  qrEmpresa: { nombre: "", telefono: "", qrUrl: "" },
  empresa: { nombre: "MATE", telefono: "+51999999999", direccion: "Lima, Per\xFA" },
  ventas: {
    fabiana: { nombre: "Fabiana", celular: "" },
    karla: { nombre: "Karla", celular: "" },
    tocho: { nombre: "Tocho", celular: "" }
  },
  ventasMensajes: [],
  // 🩷 FASE BB: arranca vacía — los presets de fábrica viven en ventaMensajes.ts
  ruta: { inicio: null, fin: null, volverAlInicio: false },
  whatsappMeta: { phoneNumberId: "", token: "", numero: "", nombreVerificado: "" },
  apariencia: { logoBase64: "" }
};
function conTimeout(promesa, ms, mensaje = "sin-conexion") {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(mensaje)), ms);
    promesa.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}
var LIMITES_CONFIG = {
  /** tope por intento de red (el doc pesa ~300KB) */
  timeoutMs: 3e4,
  /** espera entre el 1er intento fallido y el reintento */
  reintentoMs: 2e3,
  /** 🌤️ FASE AL: tope del refresco en segundo plano tras leer de
   * la caché — si el servidor no contesta a tiempo, la caché gana
   * y no pasa nada (la próxima apertura vuelve a intentar). */
  frescuraMs: 8e3
};
var estadoCargaConfig = {
  fuente: "servidor",
  error: ""
};
async function conReintento(fn, msEntreReintentos, noReintentar) {
  try {
    return await fn();
  } catch (e1) {
    const msg = String(e1?.message || e1 || "");
    if (noReintentar.includes(msg)) throw e1;
    if (msg.includes("permission-denied") || msg.includes("PERMISSION_DENIED")) throw e1;
    await new Promise((r) => setTimeout(r, msEntreReintentos));
    return await fn();
  }
}
function fusionarConfig(data) {
  return {
    ...CONFIG_CUENTAS_DEFAULT,
    ...data,
    yape: { ...CONFIG_CUENTAS_DEFAULT.yape, ...data?.yape },
    bcp: { ...CONFIG_CUENTAS_DEFAULT.bcp, ...data?.bcp },
    bbva: { ...CONFIG_CUENTAS_DEFAULT.bbva, ...data?.bbva },
    interbank: { ...CONFIG_CUENTAS_DEFAULT.interbank, ...data?.interbank },
    bcpEmpresa: { ...CONFIG_CUENTAS_DEFAULT.bcpEmpresa, ...data?.bcpEmpresa },
    bbvaEmpresa: { ...CONFIG_CUENTAS_DEFAULT.bbvaEmpresa, ...data?.bbvaEmpresa },
    interbankEmpresa: { ...CONFIG_CUENTAS_DEFAULT.interbankEmpresa, ...data?.interbankEmpresa },
    plantillaCuenta: typeof data?.plantillaCuenta === "string" ? data.plantillaCuenta : "",
    plin: { ...CONFIG_CUENTAS_DEFAULT.plin, ...data?.plin },
    qrEmpresa: { ...CONFIG_CUENTAS_DEFAULT.qrEmpresa, ...data?.qrEmpresa },
    empresa: { ...CONFIG_CUENTAS_DEFAULT.empresa, ...data?.empresa },
    ventas: {
      fabiana: { ...CONFIG_CUENTAS_DEFAULT.ventas.fabiana, ...data?.ventas?.fabiana },
      karla: { ...CONFIG_CUENTAS_DEFAULT.ventas.karla, ...data?.ventas?.karla },
      tocho: { ...CONFIG_CUENTAS_DEFAULT.ventas.tocho, ...data?.ventas?.tocho }
    },
    ruta: { ...CONFIG_CUENTAS_DEFAULT.ruta, ...data?.ruta },
    whatsappMeta: { ...CONFIG_CUENTAS_DEFAULT.whatsappMeta, ...data?.whatsappMeta },
    apariencia: { ...CONFIG_CUENTAS_DEFAULT.apariencia, ...data?.apariencia }
  };
}
function tiempoDe(v) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (v instanceof Date) return v.getTime();
    const t = new Date(String(v)).getTime();
    return Number.isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}
function refrescarConfigEnSegundoPlano(ref, configCache) {
  try {
    (0, import_firestore.getDoc)(ref).then((snap) => {
      if (!snap || !snap.exists()) return;
      const nueva = fusionarConfig(snap.data());
      if (tiempoDe(nueva?.actualizadoEn) > tiempoDe(configCache?.actualizadoEn)) {
        estadoCargaConfig.fuente = "servidor";
        estadoCargaConfig.error = "";
        try {
          window.dispatchEvent(new CustomEvent("config-empresa:refrescada", { detail: nueva }));
        } catch {
        }
      }
    }).catch(() => {
    });
  } catch {
  }
}
async function cargarConfigCuentas(userId) {
  if (!import_firebase.db || !userId) return CONFIG_CUENTAS_DEFAULT;
  const ref = (0, import_firestore.doc)(import_firebase.db, "config_empresa", userId);
  try {
    const snapCache = await (0, import_firestore.getDocFromCache)(ref);
    if (snapCache.exists()) {
      estadoCargaConfig.fuente = "cache";
      const configCache = fusionarConfig(snapCache.data());
      refrescarConfigEnSegundoPlano(ref, configCache);
      return configCache;
    }
  } catch {
  }
  const leer = () => conTimeout((0, import_firestore.getDoc)(ref), LIMITES_CONFIG.timeoutMs, "sin-conexion");
  try {
    const snap = await conReintento(leer, LIMITES_CONFIG.reintentoMs, []);
    estadoCargaConfig.fuente = snap.exists() ? "servidor" : "vacio";
    estadoCargaConfig.error = "";
    if (snap.exists()) return fusionarConfig(snap.data());
    return CONFIG_CUENTAS_DEFAULT;
  } catch (e) {
    estadoCargaConfig.fuente = "error";
    estadoCargaConfig.error = String(e?.message || e);
    console.warn("\u26A0\uFE0F Config sin conexi\xF3n al servidor (usando defaults):", e?.message || e);
    return CONFIG_CUENTAS_DEFAULT;
  }
}
async function guardarConfigCuentas(userId, config) {
  if (!import_firebase.db || !userId) return "local";
  const ref = (0, import_firestore.doc)(import_firebase.db, "config_empresa", userId);
  const escribir = () => conTimeout(
    (0, import_firestore.setDoc)(ref, { ...config, actualizadoEn: (0, import_firestore.serverTimestamp)() }, { merge: true }),
    LIMITES_CONFIG.timeoutMs,
    "guardado-local"
  );
  try {
    await conReintento(escribir, LIMITES_CONFIG.reintentoMs, ["guardado-local"]);
    console.log("\u{1F3E6} Config de cuentas guardada");
    return "servidor";
  } catch (e) {
    if (e?.message === "guardado-local") {
      console.warn("\u{1F3E6} Config guardada LOCALMENTE \u2014 se sincronizar\xE1 al reconectar");
      return "local";
    }
    console.error("\u274C Error guardando config de cuentas:", e);
    throw e;
  }
}
async function sincronizarYapeAlBot(userId, yape) {
  if (!import_firebase.db || !userId) throw new Error("Firebase no disponible");
  const escribir = () => conTimeout(
    (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "ruta_activa", userId), {
      yape: {
        qrBase64: yape.qrBase64 || "",
        qrUrl: yape.qrUrl || "",
        numero: yape.numero || "",
        titular: yape.titular || "",
        cci: yape.cci || "",
        bancos: yape.bancos || ""
      },
      actualizadaAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true }),
    LIMITES_CONFIG.timeoutMs,
    "guardado-local"
  );
  try {
    await conReintento(escribir, LIMITES_CONFIG.reintentoMs, ["guardado-local"]);
    return "servidor";
  } catch (e) {
    if (e?.message === "guardado-local") {
      console.warn("\u{1F49C} Yape sincronizado LOCALMENTE \u2014 llegar\xE1 al bot al reconectar");
      return "local";
    }
    console.error("\u274C Error sincronizando Yape al bot:", e);
    throw e;
  }
}
async function obtenerYapeDelBot(userId) {
  if (!import_firebase.db || !userId) return null;
  const ref = (0, import_firestore.doc)(import_firebase.db, "ruta_activa", userId);
  const extraer = (data) => {
    if (!data?.yape) return null;
    const y = data.yape;
    return {
      qrBase64: y.qrBase64 || "",
      qrUrl: y.qrUrl || "",
      numero: y.numero || "",
      titular: y.titular || "",
      cci: y.cci || "",
      bancos: y.bancos || ""
    };
  };
  try {
    const snapCache = await (0, import_firestore.getDocFromCache)(ref);
    const yapeCache = extraer(snapCache.exists() ? snapCache.data() : null);
    if (yapeCache) return yapeCache;
  } catch {
  }
  try {
    const snap = await conTimeout((0, import_firestore.getDoc)(ref), LIMITES_CONFIG.timeoutMs);
    return extraer(snap.exists() ? snap.data() : null);
  } catch (e) {
    console.warn("\u26A0\uFE0F Yape del bot no disponible (sin conexi\xF3n):", e?.message || e);
    return null;
  }
}
async function sincronizarPlinAlBot(userId, plin) {
  if (!import_firebase.db || !userId) throw new Error("Firebase no disponible");
  const escribir = () => conTimeout(
    (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "ruta_activa", userId), {
      plin: {
        qrBase64: plin.qrBase64 || "",
        qrUrl: plin.qrUrl || "",
        numero: plin.numero || "",
        titular: plin.titular || ""
      },
      actualizadaAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true }),
    LIMITES_CONFIG.timeoutMs,
    "guardado-local"
  );
  try {
    await conReintento(escribir, LIMITES_CONFIG.reintentoMs, ["guardado-local"]);
    return "servidor";
  } catch (e) {
    if (e?.message === "guardado-local") {
      console.warn("\u{1F537} Plin sincronizado LOCALMENTE \u2014 llegar\xE1 al bot al reconectar");
      return "local";
    }
    console.error("\u274C Error sincronizando Plin al bot:", e);
    throw e;
  }
}
async function obtenerPlinDelBot(userId) {
  if (!import_firebase.db || !userId) return null;
  const ref = (0, import_firestore.doc)(import_firebase.db, "ruta_activa", userId);
  const extraer = (data) => {
    if (!data?.plin) return null;
    const p = data.plin;
    return {
      qrBase64: p.qrBase64 || "",
      qrUrl: p.qrUrl || "",
      numero: p.numero || "",
      titular: p.titular || ""
    };
  };
  try {
    const snapCache = await (0, import_firestore.getDocFromCache)(ref);
    const plinCache = extraer(snapCache.exists() ? snapCache.data() : null);
    if (plinCache) return plinCache;
  } catch {
  }
  try {
    const snap = await conTimeout((0, import_firestore.getDoc)(ref), LIMITES_CONFIG.timeoutMs);
    return extraer(snap.exists() ? snap.data() : null);
  } catch (e) {
    console.warn("\u26A0\uFE0F Plin del bot no disponible (sin conexi\xF3n):", e?.message || e);
    return null;
  }
}
async function iniciarRutaConBot(clientes, rider) {
  if (!import_firebase.db) throw new Error("Firebase no disponible");
  await conTimeout(
    (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "ruta_activa", UID_BOT_MODULAR), {
      activa: true,
      iniciadaAt: (/* @__PURE__ */ new Date()).toISOString(),
      actualizadaAt: (/* @__PURE__ */ new Date()).toISOString(),
      rider,
      clientes: clientes.map((c, idx) => ({
        idx,
        id: c.id,
        num: c.num || idx + 1,
        nombre: c.nombre || "Cliente",
        cel: _botCel(c.cel || ""),
        cobrar: parseFloat(String(c.cobrar || 0)),
        precio: parseFloat(String(c.precio || 0)),
        prod: c.prod || "",
        dir: c.dir || "",
        dist: c.dist || "",
        st: c.st || "pendiente",
        nota: c.nota || "",
        obs: c.obs || "",
        hora: c.hora || "",
        ...typeof c.lat === "number" && typeof c.lng === "number" ? { lat: c.lat, lng: c.lng } : {},
        ...c.latSrc ? { latSrc: c.latSrc } : {}
      })),
      clienteActualIdx: -1,
      totalClientes: clientes.length,
      pendientes: clientes.filter((c) => c.st === "pendiente" || !c.st).length
    }, { merge: true }),
    9e3,
    "guardado-local"
  ).catch((e) => {
    if (e?.message === "guardado-local") {
      console.warn("\u23F1 Ruta publicada LOCALMENTE \u2014 llegar\xE1 al bot al reconectar");
      return;
    }
    console.error("\u274C Error publicando ruta para el bot:", e);
    throw e;
  });
}
async function finalizarRutaActivaBot() {
  if (!import_firebase.db) return;
  try {
    await conTimeout(
      (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "ruta_activa", UID_BOT_MODULAR), {
        activa: false,
        finalizadaAt: (/* @__PURE__ */ new Date()).toISOString(),
        actualizadaAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true }),
      9e3,
      "guardado-local"
    );
    console.log("\u2705 Ruta marcada como finalizada para el bot");
  } catch (e) {
    if (e?.message === "guardado-local") {
      console.warn("\u23F1 Finalizaci\xF3n guardada LOCALMENTE \u2014 llegar\xE1 al bot al reconectar");
      return;
    }
    console.warn("Error finalizando ruta para el bot:", e);
  }
}
async function encolarAccionBot(userId, accion) {
  if (!import_firebase.db || !userId) return "local";
  const accionData = {
    ...accion,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    processed: false
  };
  try {
    const pendientesRef = (0, import_firestore.collection)(import_firebase.db, "acciones_bot", userId, "pendientes");
    const newDocRef = (0, import_firestore.doc)(pendientesRef);
    await conTimeout((0, import_firestore.setDoc)(newDocRef, accionData), LIMITES_ACCIONES.topeMs, "accion-local");
    console.log("\u{1F916} Acci\xF3n encolada:", accion.tipo);
    return "servidor";
  } catch (e) {
    if (String(e?.message || e) === "accion-local") {
      console.warn("\u23F3 Acci\xF3n " + accion.tipo + " qued\xF3 PENDIENTE (red trabada) \u2014 el SDK la sube al volver la se\xF1al");
      return "local";
    }
    console.error("\u274C Error encolando acci\xF3n:", e);
    throw e;
  }
}
function subscribeEstadoBot(userId, cb) {
  if (!import_firebase.db || !userId) return () => {
  };
  try {
    const unsub = (0, import_firestore.onSnapshot)(
      (0, import_firestore.doc)(import_firebase.db, "estado_bot", userId),
      (snap) => {
        if (!snap.exists()) {
          cb(null);
          return;
        }
        const d = snap.data();
        cb({
          vivo: d.vivo === true,
          lastSeen: typeof d.lastSeen === "string" ? d.lastSeen : "",
          version: typeof d.version === "string" ? d.version : "?",
          whatsapp: typeof d.whatsapp === "string" ? d.whatsapp : "?",
          listenerAcciones: typeof d.listenerAcciones === "string" ? d.listenerAcciones : "?",
          enCola: typeof d.enCola === "number" ? d.enCola : 0,
          procesando: typeof d.procesando === "string" ? d.procesando : "",
          // v0.11.8: ausentes en bots v3.0 → false (defaults sanos)
          dtParche: d.dtParche === true,
          calentamiento: d.calentamiento === true,
          // 🖼️ AM v0.11.12: diagnóstico de imágenes del bot (v3.4)
          mediaUltimoError: typeof d.mediaUltimoError === "string" ? d.mediaUltimoError : "",
          pruebaImagen: d.pruebaImagen && typeof d.pruebaImagen === "object" ? {
            resultado: String(d.pruebaImagen.resultado || ""),
            motivo: String(d.pruebaImagen.motivo || ""),
            cuando: String(d.pruebaImagen.cuando || "")
          } : null
        });
      },
      () => {
        cb(null);
      }
    );
    return unsub;
  } catch {
    return () => {
    };
  }
}
async function probarBot(userId) {
  await encolarAccionBot(userId, {
    tipo: "probar_bot",
    clienteId: "prueba",
    telefono: "",
    nombre: "Rudy"
  });
}
async function probarImagenBot(userId, imagenBase64, numero = "", titular = "") {
  await encolarAccionBot(userId, {
    tipo: "probar_imagen",
    clienteId: "prueba-imagen",
    telefono: "",
    nombre: "Rudy",
    imagenBase64,
    numero,
    titular
  });
}
function calcularEstadisticas(clientes) {
  const total = clientes.length;
  const entregados = clientes.filter((c) => ["efectivo", "yape-rudy", "yape-efectivo", "mixto", "pos", "transferencia", "yape-plin", "pago-link", "jose-smith", "empresa", "cambio"].includes(c.st)).length;
  const pendientes = clientes.filter((c) => c.st === "pendiente" || !c.st).length;
  const fallidos = clientes.filter((c) => ["fallida", "rechazado", "cancelado", "ausente", "no-contesta"].includes(c.st)).length;
  const cobrado = clientes.filter((c) => ["efectivo", "yape-rudy", "yape-efectivo", "mixto", "pos", "transferencia", "yape-plin", "pago-link", "jose-smith", "empresa", "cambio"].includes(c.st)).reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);
  const porCobrar = clientes.filter((c) => c.st === "pendiente" || !c.st).reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);
  return {
    total,
    entregados,
    pendientes,
    fallidos,
    cobrado,
    porCobrar,
    totalDia: cobrado + porCobrar
  };
}
function importarExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result);
        const modXLSX = await Promise.resolve().then(() => __toESM(require_stub_xlsx(), 1));
        const XLSX = modXLSX.default ?? modXLSX;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        let headerRow = 0;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const row = rows[i].map((c) => String(c).toUpperCase());
          if (row.some((c) => c.includes("NOMBRE") || c.includes("CLIENTE"))) {
            headerRow = i;
            break;
          }
        }
        const headers = rows[headerRow].map((h) => String(h).toLowerCase().trim());
        const findCol = (keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
        const cols = {
          num: findCol(["n\xB0", "num", "#"]),
          // 💰 FASE Z: alias ampliados — el Excel de la empresa
          // renombra columnas entre días ('MONTO', 'TOTAL', 'PAGAR'…)
          // y el monto quedaba en 0 → QR "sin monto cargado".
          precio: findCol(["precio", "costo", "valor", "unitario"]),
          cobrar: findCol(["cobrar", "monto", "total", "pagar", "deuda", "importe"]),
          nombre: findCol(["nombre", "cliente"]),
          dir: findCol(["direcci"]),
          dist: findCol(["distrito"]),
          cel: findCol(["celular", "tel"]),
          prod: findCol(["producto"]),
          obs: findCol(["observ", "obs"])
        };
        const clientes = [];
        let num = 1;
        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          const nombre = String(row[cols.nombre] || "").trim();
          if (!nombre || nombre.toUpperCase().includes("TOTAL") || nombre.toUpperCase().includes("VUELTO")) continue;
          const crudoPrecio = cols.precio >= 0 ? row[cols.precio] : void 0;
          const crudoCobrar = cols.cobrar >= 0 ? row[cols.cobrar] : void 0;
          const { cobrar: cobrarNum, precio: precioNum } = montosConRespaldo(crudoCobrar, crudoPrecio);
          const precio = precioNum;
          if (!nombre && precio === 0) continue;
          clientes.push({
            id: Date.now() + i,
            num: cols.num >= 0 ? parseInt(row[cols.num]) || num : num,
            precio,
            cobrar: cobrarNum,
            nombre,
            dir: String(row[cols.dir] || "").trim(),
            dist: String(row[cols.dist] || "").trim(),
            cel: String(row[cols.cel] || "").trim(),
            prod: String(row[cols.prod] || "").trim(),
            obs: String(row[cols.obs] || "").trim(),
            st: "pendiente",
            mEf: 0,
            mYp: 0,
            mEmp: 0,
            mVt: 0,
            mEM: "",
            hora: "",
            nota: ""
          });
          num++;
        }
        resolve(clientes);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error leyendo archivo"));
    reader.readAsArrayBuffer(file);
  });
}
function _botCel(cel) {
  if (!cel) return null;
  const d = String(cel).replace(/[^0-9]/g, "");
  if (d.length === 9) return "51" + d;
  if (d.length === 11 && d.startsWith("51")) return d;
  if (d.length === 12 && d.startsWith("51")) return d;
  if (d.length === 13 && d.startsWith("0051")) return d.slice(2);
  return d.length >= 9 ? "51" + d.slice(-9) : null;
}
function comprimirFotoParaStorage(file, maxDim = 1280, calidad = 0.72) {
  return new Promise((resolver) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round(h * maxDim / w);
              w = maxDim;
            } else {
              w = Math.round(w * maxDim / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (b) => {
              URL.revokeObjectURL(url);
              resolver(b && b.size > 0 && b.size <= file.size ? b : file);
            },
            "image/jpeg",
            calidad
          );
        } catch {
          URL.revokeObjectURL(url);
          resolver(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolver(file);
      };
      img.src = url;
    } catch {
      resolver(file);
    }
  });
}
function _topeSubidaMs(bytes) {
  const kb = Math.max(0, Math.round(bytes / 1024));
  return Math.min(LIMITES_SUBIDA.topeDuroMs, LIMITES_SUBIDA.baseMs + Math.round(kb * LIMITES_SUBIDA.msPorKb));
}
var LIMITES_SUBIDA = {
  /** tope base por intento (se le suma el peso) */
  baseMs: 6e4,
  /** margen por KB (300 KB → +36s) */
  msPorKb: 120,
  /** tope duro por intento */
  topeDuroMs: 18e4,
  /** espera entre el intento fallido y el reintento */
  reintentoMs: 1500
};
var LIMITES_ACCIONES = {
  /** tope del setDoc antes de declararlo "pendiente" */
  topeMs: 2e4
};
async function _subirConTope(refImg, archivo, metadata, intentos = 2) {
  let ultimoError = null;
  for (let i = 1; i <= intentos; i++) {
    const tarea = (0, import_storage.uploadBytesResumable)(refImg, archivo, metadata);
    const topeMs = _topeSubidaMs(archivo.size);
    try {
      await new Promise((resolver, rechazar) => {
        const t = setTimeout(() => {
          try {
            tarea.cancel();
          } catch {
          }
          rechazar(new Error(`\u23F1 La subida se trab\xF3 (red congelada) \u2014 cancelada a los ${Math.round(topeMs / 1e3)}s`));
        }, topeMs);
        tarea.on(
          "state_changed",
          void 0,
          (e) => {
            clearTimeout(t);
            rechazar(e);
          },
          () => {
            clearTimeout(t);
            resolver();
          }
        );
      });
      return;
    } catch (e) {
      ultimoError = e;
      if (e?.code === "storage/canceled" || String(e?.code || "").startsWith("storage/unauthorized") || e?.code === "storage/quota-exceeded") throw e;
      if (i < intentos) {
        console.warn(`\u{1F4E4} Subida intento ${i}/${intentos} fall\xF3 (${e?.message || e}) \u2014 reintentando con conexi\xF3n fresca...`);
        await new Promise((r) => setTimeout(r, LIMITES_SUBIDA.reintentoMs));
      }
    }
  }
  throw ultimoError instanceof Error ? new Error(ultimoError.message + " \u2014 prob\xE1 de nuevo; si sigue, cerr\xE1 y abr\xED la app") : new Error("La subida se trab\xF3 dos veces \u2014 prob\xE1 de nuevo");
}
async function subirFotoPago(uid, clienteId, file) {
  if (!import_firebase.storage) throw new Error("Storage no inicializado");
  const archivo = await comprimirFotoParaStorage(file);
  console.log("\u{1F5DC}\uFE0F Comprobante comprimido: " + Math.round(file.size / 1024) + " KB \u2192 " + Math.round(archivo.size / 1024) + " KB");
  const timestamp = Date.now();
  const safeId = String(clienteId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const ruta = `pagos/${uid}/${safeId}_${timestamp}.jpg`;
  const refImg = (0, import_storage.ref)(import_firebase.storage, ruta);
  await _subirConTope(refImg, archivo, {
    contentType: "image/jpeg",
    customMetadata: {
      clienteId: String(clienteId),
      uid,
      fecha: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  const url = await (0, import_storage.getDownloadURL)(refImg);
  console.log("\u2705 Foto subida a Storage:", ruta);
  return url;
}
async function subirFotoEntrega(uid, clienteId, file, dataUrlFallback) {
  const timestamp = Date.now();
  const safeId = String(clienteId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const archivo = await comprimirFotoParaStorage(file);
  if (import_firebase.storage) {
    try {
      const ruta = `entregas/${uid}/${safeId}_${timestamp}.jpg`;
      const refImg = (0, import_storage.ref)(import_firebase.storage, ruta);
      await _subirConTope(refImg, archivo, {
        contentType: "image/jpeg",
        customMetadata: {
          clienteId: String(clienteId),
          uid,
          fecha: (/* @__PURE__ */ new Date()).toISOString(),
          tipo: "entrega"
        }
      });
      const url = await (0, import_storage.getDownloadURL)(refImg);
      console.log("\u2705 Foto de entrega subida a Storage:", ruta);
      return url;
    } catch (e) {
      console.warn("\u26A0\uFE0F Storage no disponible, usando base64 en Firestore:", e);
    }
  }
  if (dataUrlFallback) {
    return dataUrlFallback;
  }
  throw new Error("No se pudo subir la foto (Storage y base64 no disponibles)");
}
async function guardarAvatarRider(userId, avatarId) {
  try {
    const ref = (0, import_firestore.doc)(import_firebase.db, "usuarios", userId);
    await (0, import_firestore.setDoc)(ref, { avatar: avatarId, avatarActualizadoAt: (0, import_firestore.serverTimestamp)() }, { merge: true });
  } catch (e) {
    console.error("\u274C Error guardando avatar del rider:", e);
    throw e;
  }
}
async function publicarPosicionRider(userId, pos) {
  try {
    const ref = (0, import_firestore.doc)(import_firebase.db, "ruta_activa", userId);
    await (0, import_firestore.setDoc)(ref, {
      posicion: {
        lat: pos.lat,
        lng: pos.lng,
        velocidadKmh: pos.velocidadKmh ?? 0,
        rumbo: pos.rumbo ?? null,
        timestamp: pos.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
        actualizadoAt: pos.actualizadoAt || (/* @__PURE__ */ new Date()).toISOString()
      }
    }, { merge: true });
  } catch (e) {
    console.warn("\u26A0\uFE0F No se pudo publicar posici\xF3n GPS:", e);
  }
}
function suscribirPosicionRider(userId, cb) {
  if (!import_firebase.db || !userId) {
    cb(null);
    return () => void 0;
  }
  try {
    const ref = (0, import_firestore.doc)(import_firebase.db, "ruta_activa", userId);
    return (0, import_firestore.onSnapshot)(
      ref,
      (snap) => {
        const data = snap.data();
        cb(data?.posicion ?? null);
      },
      () => cb(null)
    );
  } catch {
    cb(null);
    return () => void 0;
  }
}
async function leerHistorial(userId, max = 300) {
  if (!import_firebase.db || !userId) return [];
  try {
    const ref = (0, import_firestore.collection)(import_firebase.db, "historial_rutas");
    const q = (0, import_firestore.query)(ref, (0, import_firestore.where)("uid", "==", userId), (0, import_firestore.limit)(400));
    const snap = await (0, import_firestore.getDocs)(q);
    const registros = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data?.uid !== userId && !d.id.startsWith(`${userId}_`)) return;
      registros.push(conTotalesCorregidos({
        id: d.id,
        uid: data.uid || userId,
        fecha: data.fecha || d.id.replace(`${userId}_`, "").slice(0, 10),
        iniciadaAt: data.iniciadaAt,
        finalizadaAt: data.finalizadaAt,
        totalClientes: data.totalClientes || 0,
        entregados: data.entregados || 0,
        fallidos: data.fallidos || 0,
        pendientes: data.pendientes || 0,
        cobradoTotal: data.cobradoTotal || 0,
        porMetodo: data.porMetodo,
        totalEmpresa: data.totalEmpresa,
        totalRider: data.totalRider,
        clientes: data.clientes || [],
        origen: data.origen,
        v1Id: data.v1Id,
        km: data.km,
        tiempoRuta: data.tiempoRuta,
        // 💰 FASE AC (contabilidad): el desglose de pago por pedido
        // (S/9/S/12 del día) ya se guardaba desde la FASE D pero no
        // se leía — la Contabilidad lo necesita para sumar la plata
        // de la empresa por semana/mes. Campos viejos sin él → undefined.
        pagoPedidos: data.pagoPedidos
      }));
    });
    registros.sort((a, b) => {
      const ka = a.finalizadaAt || a.iniciadaAt || a.fecha || "";
      const kb = b.finalizadaAt || b.iniciadaAt || b.fecha || "";
      return kb.localeCompare(ka);
    });
    return registros.slice(0, max);
  } catch (e) {
    console.error("\u274C Error leyendo historial:", e);
    return [];
  }
}
async function eliminarRutaHistorial(userId, registroId) {
  if (!import_firebase.db) return;
  try {
    await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(import_firebase.db, "historial_rutas", registroId));
    console.log("\u{1F5D1}\uFE0F Ruta eliminada del historial");
  } catch (e) {
    console.error("\u274C Error eliminando ruta del historial:", e);
    throw e;
  }
}
async function cambiarFechaHistorial(registroId, nuevaFecha) {
  if (!import_firebase.db) throw new Error("Sin conexi\xF3n");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nuevaFecha)) throw new Error("Fecha inv\xE1lida (usa AAAA-MM-DD)");
  try {
    await (0, import_firestore.updateDoc)((0, import_firestore.doc)(import_firebase.db, "historial_rutas", registroId), { fecha: nuevaFecha });
    console.log("\u{1F4C5} Fecha de ruta actualizada:", registroId, "\u2192", nuevaFecha);
  } catch (e) {
    console.error("\u274C Error cambiando fecha del historial:", e);
    throw e;
  }
}
var MAPA_DG_V1 = {
  ef: "efectivo",
  yr: "yape-rudy",
  ye: "yape-efectivo",
  mT: "mixto",
  po: "pos",
  tr: "transferencia",
  yp: "yape-plin",
  pl: "pago-link",
  js: "jose-smith",
  em: "empresa"
};
async function leerHistorialV1(userId) {
  if (!import_firebase.db || !userId) return { entradas: [], fuente: "" };
  let mejor = [];
  let fuente = "";
  try {
    const snap = await (0, import_firestore.getDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", userId));
    if (snap.exists()) {
      const hist = snap.data()?.hist;
      if (Array.isArray(hist) && hist.length > mejor.length) {
        mejor = hist;
        fuente = "sincronizaci\xF3n autom\xE1tica";
      }
    }
  } catch (e) {
    console.warn("\u26A0\uFE0F No se pudo leer usuarios/{uid}.hist:", e.message);
  }
  try {
    const snap = await (0, import_firestore.getDocs)((0, import_firestore.query)((0, import_firestore.collection)(import_firebase.db, "usuarios", userId, "backups"), (0, import_firestore.limit)(40)));
    snap.forEach((d) => {
      const hist = d.data()?.hist;
      if (Array.isArray(hist) && hist.length > mejor.length) {
        mejor = hist;
        fuente = `backup ${d.id}`;
      }
    });
  } catch (e) {
    console.warn("\u26A0\uFE0F No se pudieron leer los backups v1:", e.message);
  }
  return { entradas: mejor, fuente };
}
function limpiarUndefined(valor) {
  if (Array.isArray(valor)) {
    return valor.filter((v) => v !== void 0).map((v) => limpiarUndefined(v));
  }
  if (valor && typeof valor === "object" && !(valor instanceof Date)) {
    const limpio = {};
    for (const [k, v] of Object.entries(valor)) {
      if (v === void 0) continue;
      limpio[k] = limpiarUndefined(v);
    }
    return limpio;
  }
  return valor;
}
function convertirRutaV1(h, userId) {
  const cl = Array.isArray(h.cl) ? h.cl : [];
  const id = Number(h.id) || 0;
  const fecha = h.fechaId || (id ? new Date(id).toISOString().slice(0, 10) : "");
  if (!id || !fecha) return null;
  const porMetodo = {};
  if (h.dg && Object.keys(h.dg).length > 0) {
    for (const [k, v] of Object.entries(h.dg)) {
      const st = MAPA_DG_V1[k];
      if (st && Number(v) > 0) porMetodo[st] = (porMetodo[st] || 0) + Number(v);
    }
  } else {
    const ST_ENT = ["efectivo", "yape-rudy", "yape-efectivo", "mixto", "pos", "transferencia", "yape-plin", "pago-link", "jose-smith", "empresa", "cambio"];
    for (const c of cl) {
      const k = c?.st;
      if (!k || !ST_ENT.includes(k)) continue;
      if (k === "mixto") {
        porMetodo["mixto"] = (porMetodo["mixto"] || 0) + parseFloat(String(c.mEf || 0));
      } else {
        porMetodo[k] = (porMetodo[k] || 0) + parseFloat(String(c.cobrar || 0));
      }
    }
  }
  const totalRider = Number(h.tT) || 0;
  const totalEmpresa = Number(h.tE) || 0;
  return {
    uid: userId,
    origen: "v1",
    v1Id: id,
    fecha,
    finalizadaAt: id ? new Date(id).toISOString() : "",
    totalClientes: Number(h.total) || cl.length,
    entregados: Number(h.ent) || 0,
    fallidos: Number(h.fal) || 0,
    pendientes: Number(h.pen) || 0,
    cobradoTotal: totalRider + totalEmpresa,
    porMetodo,
    totalEmpresa,
    totalRider,
    km: h.km || null,
    // ⚠️ FIX: antes era `|| undefined` y Firestore lo rechazaba con
    // "Unsupported field value: undefined (found in field tiempoRuta)"
    // al importar rutas de la v1 que nunca guardaron ese campo.
    // null SÍ es un valor válido para Firestore.
    tiempoRuta: h.tiempoRuta || null,
    clientes: cl.map((c, i) => ({
      id: c.id != null ? c.id : `v1c_${id}_${i}`,
      num: c.num != null ? c.num : i + 1,
      nombre: c.nombre || "Cliente",
      cel: c.cel || "",
      prod: c.prod || "",
      cobrar: parseFloat(String(c.cobrar || 0)),
      mEf: parseFloat(String(c.mEf || 0)),
      mYp: parseFloat(String(c.mYp || 0)),
      mEmp: parseFloat(String(c.mEmp || 0)),
      mVt: parseFloat(String(c.mVt || 0)),
      dir: c.dir || "",
      dist: c.dist || "",
      st: c.st || "pendiente",
      hora: c.hora || "",
      obs: c.obs || "",
      nota: c.nota || "",
      motivo: c.motivo || ""
    }))
  };
}
async function importarHistorialV1(userId) {
  if (!import_firebase.db || !userId) throw new Error("Sin conexi\xF3n");
  const { entradas, fuente } = await leerHistorialV1(userId);
  if (entradas.length === 0) return { importadas: 0, totalV1: 0, fuente };
  const yaImportadas = /* @__PURE__ */ new Set();
  try {
    const snap = await (0, import_firestore.getDocs)((0, import_firestore.query)((0, import_firestore.collection)(import_firebase.db, "historial_rutas"), (0, import_firestore.where)("uid", "==", userId), (0, import_firestore.limit)(400)));
    snap.forEach((d) => {
      const data = d.data();
      if (data?.uid !== userId && !d.id.startsWith(`${userId}_`)) return;
      if (data?.origen === "v1" && typeof data.v1Id === "number") yaImportadas.add(data.v1Id);
    });
  } catch (e) {
    console.warn("\u26A0\uFE0F No se pudo leer historial_rutas para deduplicar:", e.message);
  }
  const nuevas = [];
  for (const h of entradas) {
    if (yaImportadas.has(Number(h.id))) continue;
    const datos = convertirRutaV1(h, userId);
    if (datos) nuevas.push(datos);
  }
  let escritas = 0;
  for (let i = 0; i < nuevas.length; i += 400) {
    const lote = nuevas.slice(i, i + 400);
    const batch = (0, import_firestore.writeBatch)(import_firebase.db);
    for (const datos of lote) {
      batch.set((0, import_firestore.doc)(import_firebase.db, "historial_rutas", `v1_${datos.v1Id}`), limpiarUndefined(datos));
    }
    await batch.commit();
    escritas += lote.length;
  }
  console.log(`\u{1F4E5} Historial v1 importado: ${escritas} rutas nuevas de ${entradas.length} (fuente: ${fuente})`);
  return { importadas: escritas, totalV1: entradas.length, fuente };
}
async function guardarBackupNube(userId, clientes, opts) {
  if (!import_firebase.db || !userId) throw new Error("Sin conexi\xF3n");
  const ST_ENTREGADOS4 = ["efectivo", "yape-rudy", "yape-efectivo", "mixto", "pos", "transferencia", "yape-plin", "pago-link", "jose-smith", "empresa", "cambio"];
  const ST_FALLIDOS2 = ["fallida", "rechazado", "cancelado", "ausente", "no-contesta", "reprogramar"];
  const ahora = /* @__PURE__ */ new Date();
  const entregados = clientes.filter((c) => ST_ENTREGADOS4.includes(c.st)).length;
  const fallidos = clientes.filter((c) => ST_FALLIDOS2.includes(c.st)).length;
  const cobrado = clientes.filter((c) => ST_ENTREGADOS4.includes(c.st)).reduce((s, c) => s + parseFloat(String(c.cobrar || 0)), 0);
  const id = `${userId}_${ahora.getTime()}`;
  const backup = {
    uid: userId,
    creadoAt: ahora.toISOString(),
    fecha: hoyISO(),
    // ⚡ F3.48: fecha de Lima (antes UTC: después de 7pm quedaba con fecha de mañana)
    hora: ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
    totalClientes: clientes.length,
    entregados,
    pendientes: clientes.length - entregados - fallidos,
    fallidos,
    cobradoTotal: cobrado,
    clientes: JSON.parse(JSON.stringify(clientes)),
    auto: opts?.auto || false
  };
  await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "backups_v2", id), backup);
  console.log("\u{1F4BE} Backup guardado en la nube:", id);
  return id;
}
var ST_ENTREGADOS_NUBE = ["efectivo", "yape-rudy", "yape-efectivo", "mixto", "pos", "transferencia", "yape-plin", "pago-link", "jose-smith", "empresa", "cambio"];
async function listarBackupsNube(userId, max = 40) {
  if (!import_firebase.db || !userId) return [];
  const backups = [];
  try {
    const ref = (0, import_firestore.collection)(import_firebase.db, "backups_v2");
    const q = (0, import_firestore.query)(ref, (0, import_firestore.where)("uid", "==", userId), (0, import_firestore.limit)(200));
    const snap = await (0, import_firestore.getDocs)(q);
    snap.forEach((d) => {
      const data = d.data();
      backups.push({
        id: d.id,
        uid: data.uid || userId,
        creadoAt: data.creadoAt || "",
        fecha: data.fecha || "",
        hora: data.hora || "",
        totalClientes: data.totalClientes || 0,
        entregados: data.entregados || 0,
        pendientes: data.pendientes || 0,
        fallidos: data.fallidos || 0,
        cobradoTotal: data.cobradoTotal || 0,
        clientes: data.clientes || [],
        tipo: data.tipo || "",
        origen: "v2",
        auto: data.auto
      });
    });
  } catch (e) {
    console.error("\u274C Error listando backups_v2:", e);
  }
  try {
    const snapV1 = await (0, import_firestore.getDocs)((0, import_firestore.query)((0, import_firestore.collection)(import_firebase.db, "usuarios", userId, "backups"), (0, import_firestore.limit)(80)));
    snapV1.forEach((d) => {
      const data = d.data();
      const cl = Array.isArray(data.cl) ? data.cl : [];
      if (cl.length === 0) return;
      const reg = data.registro || {};
      const regFecha = data.registro?.fecha || data.fecha || d.id.replace("auto_", "");
      const total = cl.length;
      const dupe = backups.some(
        (b) => b.origen === "v2" && b.fecha === regFecha && b.hora === (data.hora || "") && b.totalClientes === total
      );
      if (dupe) return;
      backups.push({
        id: d.id,
        uid: userId,
        creadoAt: data.creadoAt || `${regFecha}T${data.hora || "00:00"}:00`,
        fecha: regFecha,
        hora: data.hora || "",
        totalClientes: total,
        entregados: Number(reg.entregados) || cl.filter((c) => ST_ENTREGADOS_NUBE.includes(c.st)).length,
        pendientes: Math.max(0, total - (Number(reg.entregados) || 0) - (Number(reg.fallidos) || 0)),
        fallidos: Number(reg.fallidos) || 0,
        cobradoTotal: Number(reg.cobradoTotal) || 0,
        clientes: cl,
        tipo: data.tipo || "cierre-ruta",
        origen: "v1",
        auto: data.auto || false
      });
    });
  } catch (e) {
    console.warn("\u26A0\uFE0F No se pudieron leer los backups v1 (permisos o vac\xEDo):", e.message);
  }
  backups.sort((a, b) => (b.creadoAt || "").localeCompare(a.creadoAt || ""));
  return backups.slice(0, max);
}
async function eliminarBackupNube(backupId, userId) {
  if (!import_firebase.db) return;
  try {
    await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(import_firebase.db, "backups_v2", backupId));
    if (userId) {
      try {
        await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", userId, "backups", backupId));
      } catch {
      }
    }
    console.log("\u{1F5D1}\uFE0F Backup eliminado");
  } catch (e) {
    console.error("\u274C Error eliminando backup:", e);
    throw e;
  }
}
async function cargarBackupNube(userId, backup) {
  if (!import_firebase.db || !userId) throw new Error("Sin conexi\xF3n");
  const clientes = backup.clientes || [];
  if (clientes.length === 0) throw new Error("El backup no tiene clientes");
  await publicarClientesEnRutaActiva(userId, clientes);
  await guardarClientes(userId, clientes);
  console.log("\u2B06\uFE0F Backup cargado:", backup.id, clientes.length, "clientes");
  return clientes.length;
}
async function guardarAutoBackupVivo(userId, clientes) {
  if (!import_firebase.db || !userId || clientes.length === 0) return false;
  try {
    const fecha = hoyISO();
    const entregados = clientes.filter((c) => ST_ENTREGADOS_NUBE.includes(c.st)).length;
    const cobrado = clientes.filter((c) => ST_ENTREGADOS_NUBE.includes(c.st)).reduce((s, c) => s + parseFloat(String(c.cobrar || 0)), 0);
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "backups_v2", `${userId}_${fecha}_auto`), limpiarUndefined({
      uid: userId,
      creadoAt: (/* @__PURE__ */ new Date()).toISOString(),
      fecha,
      hora: (/* @__PURE__ */ new Date()).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
      totalClientes: clientes.length,
      entregados,
      pendientes: clientes.length - entregados,
      fallidos: 0,
      cobradoTotal: cobrado,
      clientes: JSON.parse(JSON.stringify(clientes)),
      auto: true,
      tipo: "auto-guardado"
    }), { merge: true });
    return true;
  } catch (e) {
    console.warn("\u26A0\uFE0F Auto-guardado vivo fall\xF3 (no bloquea nada):", e.message);
    return false;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONFIG_CUENTAS_DEFAULT,
  LIMITES_ACCIONES,
  LIMITES_CONFIG,
  LIMITES_SUBIDA,
  _botCel,
  actualizarClienteEnRutaActiva,
  actualizarRutaActiva,
  calcularEstadisticas,
  cambiarFechaHistorial,
  cargarBackupNube,
  cargarConfigCuentas,
  eliminarBackupNube,
  eliminarRutaHistorial,
  encolarAccionBot,
  estadoCargaConfig,
  finalizarRuta,
  finalizarRutaActiva,
  finalizarRutaActivaBot,
  guardarAutoBackupVivo,
  guardarAvatarRider,
  guardarBackupNube,
  guardarClientes,
  guardarColaYUltima,
  guardarConfigCuentas,
  guardarReprogramados,
  guardarUltimaCerrada,
  guardarYCerrarRuta,
  importarExcel,
  importarHistorialV1,
  iniciarRutaConBot,
  leerHistorial,
  leerHistorialV1,
  leerUltimaRuta,
  limpiarRutaSinGuardar,
  listarBackupsNube,
  obtenerPlinDelBot,
  obtenerYapeDelBot,
  probarBot,
  probarImagenBot,
  publicarClientesEnRutaActiva,
  publicarPosicionRider,
  publicarRutaActiva,
  sincronizarPlinAlBot,
  sincronizarYapeAlBot,
  subirFotoEntrega,
  subirFotoPago,
  subscribeEstadoBot,
  subscribeToClientes,
  subscribeToClientesRegistrados,
  subscribeToReprogramados,
  subscribeToRutaActiva,
  suscribirPosicionRider
});
