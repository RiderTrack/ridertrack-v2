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

// test-sync/stub-db.cjs
var require_stub_db = __commonJS({
  "test-sync/stub-db.cjs"(exports2) {
    exports2.db = { __stub: "db-ridertrack" };
  }
});

// test-sync/stub-firestore.cjs
var require_stub_firestore = __commonJS({
  "test-sync/stub-firestore.cjs"(exports2) {
    var T = globalThis.__SYNC_TEST__ ||= {
      snapActual: null,
      // { data: () => payload | undefined }
      setDocImpl: null,
      // async (data) => void — puede lanzar para simular fallo
      setDocCalls: [],
      // historial de lo que se intentó subir
      suscripciones: 0
    };
    exports2.doc = (db2, col, id) => ({ __ref: `${col}/${id}` });
    exports2.getDoc = async (ref) => {
      if (T.snapActual && typeof T.snapActual.data === "function") {
        const data = T.snapActual.data();
        if (data !== void 0) {
          return { exists: () => true, data: () => data, __ref: ref && ref.__ref };
        }
      }
      return { exists: () => false, data: () => void 0, __ref: ref && ref.__ref };
    };
    exports2.onSnapshot = (ref, cb, errCb) => {
      T.suscripciones++;
      T.ultimoCb = cb;
      setImmediate(() => cb(T.snapActual || { data: () => void 0, exists: () => false }));
      return () => {
        if (T.ultimoCb === cb) T.ultimoCb = null;
      };
    };
    exports2.setDoc = async (ref, data) => {
      T.setDocCalls.push(JSON.parse(JSON.stringify(data)));
      if (T.setDocImpl) return T.setDocImpl(data);
    };
  }
});

// src/services/yape.ts
var yape_exports = {};
__export(yape_exports, {
  EVENTO_YAPE_REMOTA: () => EVENTO_YAPE_REMOTA,
  agregarMovimiento: () => agregarMovimiento,
  arrancarYape: () => arrancarYape,
  eliminarMovimiento: () => eliminarMovimiento,
  fijarSaldo: () => fijarSaldo,
  hoyLocal: () => hoyLocal,
  recargarYape: () => recargarYape,
  snapshotYape: () => snapshotYape,
  suscribirYape: () => suscribirYape,
  tieneMovimientos: () => tieneMovimientos
});
module.exports = __toCommonJS(yape_exports);
var import_firebase = __toESM(require_stub_db(), 1);
var import_firestore = __toESM(require_stub_firestore(), 1);

// src/utils/odometroCore.ts
var FILTROS_ODOMETRO = {
  /** Distancia mínima entre puntos para contar (m) */
  MIN_METROS: 8,
  /** Velocidad máxima creíble en moto (km/h) — más = salto GPS */
  MAX_VELOCIDAD_KMH: 140,
  /** Velocidad mínima creíble moviéndose (km/h) — menos = deriva.
   *  F3.37: bajada de 2 → 1.2 para no perder tráfico pesado
   *  (avanzone a paso de persona = km reales, no deriva). */
  MIN_VELOCIDAD_KMH: 1.2,
  /** Hueco a partir del cual se intenta PUENTE en vez de descartar (ms) */
  GAP_MS: 8 * 60 * 1e3,
  /** F3.37: hueco máximo que un puente puede cubrir (ms) — 90 min */
  GAP_PUENTE_MS: 90 * 60 * 1e3,
  /** F3.37: velocidad MEDIA máxima para confiar en un puente (km/h) */
  MAX_MEDIA_KMH: 80,
  /** Precisión máxima aceptable (m) */
  MAX_ACCURACY: 50
};
function fechaLocal(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function hoyLocal() {
  return fechaLocal(Date.now());
}

// src/utils/cajaCore.ts
var PLANTILLA_CUADRE_DEFECTO = [
  "\u{1F4B0} *CUADRE DEL D\xCDA \u2014 {nombre}*",
  "\u{1F4C5} {fecha}",
  "",
  "\u{1F4B5} *Cobrado del d\xEDa: {cobrado}*",
  "{detallePedidos}",
  "{empresa}",
  "{gastos}",
  "{loTuyo}",
  "",
  "\u{1F932} *Te entrego en efectivo: {efectivo}*",
  "\u{1F4F2} *El resto te lo deposito por Yape: {yape}*",
  "{teDebe}",
  "",
  "\u{1F4C4} *Recibe en total: {total}*",
  "{nota}"
].join("\n");

// src/utils/yapeCore.ts
function efectoDe(m) {
  const monto = Number(m.monto) || 0;
  switch (m.tipo) {
    case "chape":
      return { personal: monto, empresa: 0 };
    case "gasto":
      return m.cuenta === "empresa" ? { personal: 0, empresa: -monto } : { personal: -monto, empresa: 0 };
    case "deposito":
      return { personal: -monto, empresa: monto };
    case "retiro":
      return { personal: monto, empresa: -monto };
    case "ajuste":
      return m.cuenta === "empresa" ? { personal: 0, empresa: monto } : { personal: monto, empresa: 0 };
  }
}
function saldosYape(movs) {
  let personal = 0;
  let empresa = 0;
  for (const m of movs || []) {
    const e = efectoDe(m);
    personal += e.personal;
    empresa += e.empresa;
  }
  return { personal, empresa };
}
var MAX_MOVS = 400;
var ID_BASE_PERSONAL = "ybase_p";
var ID_BASE_EMPRESA = "ybase_e";
function compactarMovs(movs) {
  const lista = [...movs || []].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (lista.length <= MAX_MOVS) return lista;
  const vivos = lista.slice(0, MAX_MOVS - 2);
  const viejos = lista.slice(MAX_MOVS - 2);
  let netoP = 0;
  let netoE = 0;
  for (const m of viejos) {
    const e = efectoDe(m);
    netoP += e.personal;
    netoE += e.empresa;
  }
  const fuera = [...vivos];
  if (Math.abs(netoP) >= 5e-3) {
    fuera.push({
      id: ID_BASE_PERSONAL,
      ts: 0,
      cuenta: "personal",
      tipo: "ajuste",
      monto: netoP,
      nota: "Saldo base (historial viejo compactado)"
    });
  }
  if (Math.abs(netoE) >= 5e-3) {
    fuera.push({
      id: ID_BASE_EMPRESA,
      ts: 0,
      cuenta: "empresa",
      tipo: "ajuste",
      monto: netoE,
      nota: "Saldo base (historial viejo compactado)"
    });
  }
  return fuera.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
var TIPOS_VALIDOS = ["chape", "gasto", "deposito", "retiro", "ajuste"];
function nuevoMovId() {
  return `y${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
function sanearMov(bruto) {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto;
  const id = String(o.id || "").trim();
  if (!id) return null;
  const tipo = TIPOS_VALIDOS.includes(String(o.tipo)) ? o.tipo : null;
  if (!tipo) return null;
  const monto = Number(o.monto);
  if (!Number.isFinite(monto)) return null;
  if (tipo !== "ajuste" && monto <= 0) return null;
  const cuenta = o.cuenta === "empresa" ? "empresa" : "personal";
  const ts = Number(o.ts);
  const fuera = {
    id,
    ts: Number.isFinite(ts) ? ts : Date.now(),
    cuenta,
    tipo,
    monto
  };
  const nota = String(o.nota || "").trim().slice(0, 80);
  if (nota) fuera.nota = nota;
  return fuera;
}
function normalizarMovs(bruto) {
  if (!Array.isArray(bruto)) return [];
  const mapa = /* @__PURE__ */ new Map();
  for (const crudo of bruto) {
    const m = sanearMov(crudo);
    if (!m) continue;
    const previo = mapa.get(m.id);
    if (!previo || (m.ts || 0) >= (previo.ts || 0)) mapa.set(m.id, m);
  }
  return Array.from(mapa.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
var BORRADO_YAPE_VACIO = { movs: [] };
function tombstoneMov(id) {
  return { id, ts: Date.now() };
}
function fusionarBorradosYape(a, b) {
  const mapa = /* @__PURE__ */ new Map();
  for (const t of [...a?.movs || [], ...b?.movs || []]) {
    if (!t?.id) continue;
    const previo = mapa.get(t.id);
    if (!previo || (t.ts || 0) >= (previo.ts || 0)) mapa.set(t.id, t);
  }
  return { movs: [...mapa.values()] };
}
function podarBorradosYape(b, dias) {
  const limite = Date.now() - dias * 24 * 60 * 60 * 1e3;
  return { movs: (b.movs || []).filter((t) => (t.ts || 0) >= limite) };
}
function filtrarBorradosYape(movs, b) {
  if (!b || !(b.movs || []).length) return movs;
  const fuera = new Map(b.movs.map((t) => [t.id, t.ts || 0]));
  return (movs || []).filter((m) => !m || (fuera.get(m.id) || 0) < (m.ts || 0));
}
function fusionarMovs(a, b) {
  const mapa = /* @__PURE__ */ new Map();
  for (const m of [...a || [], ...b || []]) {
    if (!m || !m.id) continue;
    const previo = mapa.get(m.id);
    if (!previo || (m.ts || 0) >= (previo.ts || 0)) mapa.set(m.id, m);
  }
  return Array.from(mapa.values()).sort((x, y) => (y.ts || 0) - (x.ts || 0));
}
var MAX_DIAS_BORRADO_YAPE = 60;

// src/services/yape.ts
var EVENTO = "rt-yape-cambio";
var EVENTO_YAPE_REMOTA = "rt-yape-remota";
var CLAVE_LOCAL = (uid) => `rt_yape_${uid}`;
var ESTADO_INICIAL = { movs: [] };
var estado = { ...ESTADO_INICIAL };
var uidActual = null;
var oyentes = /* @__PURE__ */ new Set();
var snapshotTick = 0;
var snapCache = null;
var snapTickCache = -1;
var desuscribirEscucha = null;
var atEscrito = 0;
function cargarLocal(uid) {
  try {
    const raw = localStorage.getItem(CLAVE_LOCAL(uid));
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") {
        return {
          movs: normalizarMovs(p.movs),
          ...p.borrados?.movs?.length ? { borrados: p.borrados } : {}
        };
      }
    }
  } catch {
  }
  return null;
}
function persistirLocal() {
  if (!uidActual) return;
  try {
    localStorage.setItem(CLAVE_LOCAL(uidActual), JSON.stringify(estado));
  } catch {
  }
}
function emitir() {
  snapshotTick++;
  window.dispatchEvent(new CustomEvent(EVENTO));
  oyentes.forEach((fn) => fn());
}
function normalizar(e) {
  const borrados = podarBorradosYape(e.borrados || BORRADO_YAPE_VACIO, MAX_DIAS_BORRADO_YAPE);
  const movs = compactarMovs(filtrarBorradosYape(normalizarMovs(e.movs), borrados));
  return { movs, ...borrados.movs.length ? { borrados } : {} };
}
function parsearRemoto(c) {
  if (!c || typeof c !== "object") return null;
  const o = c;
  const borrados = o.borrados;
  const movsBorrados = Array.isArray(borrados?.movs) ? borrados.movs.filter((t) => t && t.id) : [];
  return {
    movs: normalizarMovs(o.movs),
    ...movsBorrados.length ? { borrados: { movs: movsBorrados.slice(0, 200) } } : {}
  };
}
async function fusionarConNube(uid) {
  let remoto = null;
  try {
    const snap = await (0, import_firestore.getDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", uid));
    if (snap.exists()) {
      const c = snap.data()?.yape;
      remoto = parsearRemoto(c);
    }
  } catch {
  }
  if (!remoto) return estado;
  return normalizar({
    movs: fusionarMovs(estado.movs, remoto.movs),
    borrados: fusionarBorradosYape(estado.borrados, remoto.borrados)
  });
}
async function guardarRemoto(uid) {
  if (!uid || !import_firebase.db) return;
  try {
    const fusion = await fusionarConNube(uid);
    const at = Date.now();
    atEscrito = at;
    await (0, import_firestore.setDoc)(
      (0, import_firestore.doc)(import_firebase.db, "usuarios", uid),
      {
        yape: {
          movs: fusion.movs.slice(0, MAX_MOVS),
          // 🔄 FASE W: los tombstones viajan con el yape → el otro
          // celular sabe qué no tiene que resucitar al fusionar
          ...fusion.borrados?.movs.length ? { borrados: fusion.borrados } : {},
          at
        }
      },
      { merge: true }
    );
    if (JSON.stringify(fusion) !== JSON.stringify(estado)) {
      estado = fusion;
      persistirLocal();
      emitir();
    }
  } catch (e) {
    console.warn("\u26A0\uFE0F Yape: no se pudo guardar en Firestore (queda en el tel\xE9fono)", e);
  }
}
async function sincronizarRemoto(uid) {
  if (!uid || !import_firebase.db) return;
  try {
    const snap = await (0, import_firestore.getDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", uid));
    if (!snap.exists()) return;
    const c = snap.data()?.yape;
    const remoto = parsearRemoto(c);
    if (!remoto) return;
    aplicarRemoto(uid, remoto);
  } catch (e) {
    console.warn("\u26A0\uFE0F Yape: no se pudo sincronizar desde Firestore", e);
  }
}
function aplicarRemoto(uid, remoto) {
  const fusionado = normalizar({
    movs: fusionarMovs(estado.movs, remoto.movs),
    borrados: fusionarBorradosYape(estado.borrados, remoto.borrados)
  });
  if (JSON.stringify(fusionado) !== JSON.stringify(estado)) {
    estado = fusionado;
    persistirLocal();
    emitir();
    return true;
  }
  return false;
}
function suscribirRemoto(uid) {
  if (!import_firebase.db) return;
  desuscribirEscucha?.();
  try {
    desuscribirEscucha = (0, import_firestore.onSnapshot)(
      (0, import_firestore.doc)(import_firebase.db, "usuarios", uid),
      (snap) => {
        try {
          if (!snap.exists()) return;
          const c = snap.data()?.yape;
          const remoto = parsearRemoto(c);
          if (!remoto) return;
          const remotoAt = Number(c?.at) || 0;
          if (atEscrito > 0 && remotoAt === atEscrito) return;
          const cambio = aplicarRemoto(uid, remoto);
          if (cambio) {
            window.dispatchEvent(
              new CustomEvent(EVENTO_YAPE_REMOTA, { detail: { at: remotoAt } })
            );
          }
        } catch {
        }
      },
      (err) => {
        console.warn("\u26A0\uFE0F Yape: escucha en vivo ca\xEDda (reintenta sola)", err?.message || err);
      }
    );
  } catch {
  }
}
function arrancarYape(uid) {
  if (uidActual === uid) return () => void 0;
  desuscribirEscucha?.();
  desuscribirEscucha = null;
  atEscrito = 0;
  uidActual = uid;
  const local = cargarLocal(uid);
  estado = local ? normalizar(local) : { ...ESTADO_INICIAL };
  if (!local) persistirLocal();
  emitir();
  void sincronizarRemoto(uid);
  suscribirRemoto(uid);
  return () => void 0;
}
function snapshotYape() {
  if (!snapCache || snapTickCache !== snapshotTick) {
    snapCache = { movs: estado.movs };
    snapTickCache = snapshotTick;
  }
  return snapCache;
}
function suscribirYape(cb) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}
async function recargarYape(uid) {
  if (uidActual !== uid) arrancarYape(uid);
  await sincronizarRemoto(uid);
}
async function agregarMovimiento(uid, datos) {
  if (uidActual !== uid) arrancarYape(uid);
  uidActual = uidActual || uid;
  const monto = Number(datos.monto) || 0;
  if (datos.tipo !== "ajuste" && monto <= 0) throw new Error("El monto debe ser mayor a cero");
  if (datos.tipo === "ajuste" && Math.abs(monto) < 5e-3) throw new Error("Nada que ajustar");
  const mov = {
    id: nuevoMovId(),
    ts: Date.now(),
    cuenta: datos.cuenta === "empresa" ? "empresa" : "personal",
    tipo: datos.tipo,
    monto
  };
  const nota = (datos.nota || "").trim().slice(0, 80);
  if (nota) mov.nota = nota;
  estado = normalizar({ ...estado, movs: [mov, ...estado.movs] });
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
  return mov;
}
async function fijarSaldo(uid, cuenta, saldoReal) {
  if (uidActual !== uid) arrancarYape(uid);
  uidActual = uidActual || uid;
  const real = Number(saldoReal) || 0;
  const actual = saldosYape(estado.movs)[cuenta];
  const delta = Math.round((real - actual) * 100) / 100;
  if (Math.abs(delta) < 5e-3) return null;
  return agregarMovimiento(uid, {
    tipo: "ajuste",
    cuenta,
    monto: delta,
    nota: "cuadr\xE9 con la app de Yape"
  });
}
async function eliminarMovimiento(uid, id) {
  if (uidActual !== uid) arrancarYape(uid);
  uidActual = uidActual || uid;
  if (!estado.movs.some((m) => m.id === id)) return;
  estado = {
    ...estado,
    movs: estado.movs.filter((m) => m.id !== id),
    borrados: fusionarBorradosYape(estado.borrados, { movs: [tombstoneMov(id)] })
  };
  estado = normalizar(estado);
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
}
function tieneMovimientos(caja) {
  return (caja.movs || []).some((m) => m.ts > 0);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EVENTO_YAPE_REMOTA,
  agregarMovimiento,
  arrancarYape,
  eliminarMovimiento,
  fijarSaldo,
  hoyLocal,
  recargarYape,
  snapshotYape,
  suscribirYape,
  tieneMovimientos
});
