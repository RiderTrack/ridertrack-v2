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

// src/services/caja.ts
var caja_exports = {};
__export(caja_exports, {
  EVENTO_CAJA_REMOTA: () => EVENTO_CAJA_REMOTA,
  agregarGasto: () => agregarGasto,
  arrancarCaja: () => arrancarCaja,
  cambiarFechaCierre: () => cambiarFechaCierre,
  cerrarCaja: () => cerrarCaja,
  cierreDeHoy: () => cierreDeHoy,
  eliminarGasto: () => eliminarGasto,
  fijarFondo: () => fijarFondo,
  gastosDeHoy: () => gastosDeHoy,
  reabrirCaja: () => reabrirCaja,
  recargarCaja: () => recargarCaja,
  snapshotCaja: () => snapshotCaja,
  suscribirCaja: () => suscribirCaja
});
module.exports = __toCommonJS(caja_exports);
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
function fechaLocalDe(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function gastosDeFecha(gastos, fechaISO) {
  return (gastos || []).filter((g) => fechaLocalDe(g.ts) === fechaISO);
}
function cierreDeFecha(cierres, fechaISO) {
  const delDia = (cierres || []).filter((c) => c.fecha === fechaISO);
  if (delDia.length === 0) return null;
  return delDia.reduce((a, b) => b.at > a.at ? b : a);
}
var MAX_DIAS_ATRAS_CIERRE = 60;
function normalizarFechaCierre(bruto, hoy) {
  const t = typeof bruto === "string" ? bruto.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return hoy;
  const [yS, mS, dS] = t.split("-");
  const y = Number(yS);
  const mes = Number(mS);
  const d = Number(dS);
  const dt = new Date(y, mes - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mes - 1 || dt.getDate() !== d) return hoy;
  if (t > hoy) return hoy;
  if (t < hoy) {
    const limite = /* @__PURE__ */ new Date(`${hoy}T00:00:00`);
    limite.setDate(limite.getDate() - MAX_DIAS_ATRAS_CIERRE);
    const p = (n) => String(n).padStart(2, "0");
    const limiteISO = `${limite.getFullYear()}-${p(limite.getMonth() + 1)}-${p(limite.getDate())}`;
    if (t < limiteISO) return hoy;
  }
  return t;
}
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
function nuevoGastoId() {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
var BORRADO_VACIO = { gastos: [], cierres: [] };
function tombstoneGasto(id) {
  return { id, ts: Date.now() };
}
function tombstoneCierre(fecha) {
  return { fecha, ts: Date.now() };
}
function fusionarBorrados(a, b) {
  const gastos = /* @__PURE__ */ new Map();
  for (const t of [...a?.gastos || [], ...b?.gastos || []]) {
    if (!t?.id) continue;
    const previo = gastos.get(t.id);
    if (!previo || (t.ts || 0) >= (previo.ts || 0)) gastos.set(t.id, t);
  }
  const cierres = /* @__PURE__ */ new Map();
  for (const t of [...a?.cierres || [], ...b?.cierres || []]) {
    if (!t?.fecha) continue;
    const previo = cierres.get(t.fecha);
    if (!previo || (t.ts || 0) >= (previo.ts || 0)) cierres.set(t.fecha, t);
  }
  return { gastos: [...gastos.values()], cierres: [...cierres.values()] };
}
function podarBorrados(b, dias) {
  const limite = Date.now() - dias * 24 * 60 * 60 * 1e3;
  const vivos = (t) => (t.ts || 0) >= limite;
  return { gastos: b.gastos.filter(vivos), cierres: b.cierres.filter(vivos) };
}
function filtrarBorrados(gastos, cierres, b) {
  if (!b || !b.gastos.length && !b.cierres.length) return { gastos, cierres };
  const gastosFuera = new Map(b.gastos.map((t) => [t.id, t.ts || 0]));
  const cierresFuera = new Map(b.cierres.map((t) => [t.fecha, t.ts || 0]));
  return {
    gastos: gastos.filter((g) => !g || (gastosFuera.get(g.id) || 0) < (g.ts || 0)),
    cierres: cierres.filter((c) => !c || (cierresFuera.get(c.fecha) || 0) <= (c.at || 0))
  };
}
function fusionarGastos(a, b) {
  const mapa = /* @__PURE__ */ new Map();
  for (const g of [...a || [], ...b || []]) {
    if (!g || !g.id) continue;
    const previo = mapa.get(g.id);
    if (!previo || (g.ts || 0) >= (previo.ts || 0)) mapa.set(g.id, g);
  }
  return Array.from(mapa.values()).sort((x, y) => (y.ts || 0) - (x.ts || 0));
}
function fusionarCierres(a, b) {
  const mapa = /* @__PURE__ */ new Map();
  for (const c of [...a || [], ...b || []]) {
    if (!c || !c.fecha) continue;
    const previo = mapa.get(c.fecha);
    if (!previo || (c.at || 0) >= (previo.at || 0)) mapa.set(c.fecha, c);
  }
  return Array.from(mapa.values()).sort((x, y) => (y.at || 0) - (x.at || 0));
}
var MAX_CIERRES = 90;
var MAX_DIAS_GASTO = 45;

// src/services/caja.ts
var EVENTO = "rt-caja-cambio";
var EVENTO_CAJA_REMOTA = "rt-caja-remota";
var CLAVE_LOCAL = (uid) => `rt_caja_${uid}`;
var ESTADO_INICIAL = { fondo: 0, gastos: [], cierres: [] };
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
          fondo: Number(p.fondo) || 0,
          gastos: Array.isArray(p.gastos) ? p.gastos : [],
          cierres: Array.isArray(p.cierres) ? p.cierres : [],
          ...p.borrados ? { borrados: p.borrados } : {}
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
function podarGastos(gastos, cierres) {
  const limite = Date.now() - MAX_DIAS_GASTO * 24 * 60 * 60 * 1e3;
  const fechasConCierre = new Set(cierres.map((c) => c.fecha));
  return gastos.filter((g) => {
    if ((g.ts || 0) >= limite) return true;
    return fechasConCierre.has(fechaLocalDe(g.ts || 0));
  });
}
function normalizar(e) {
  const borrados = podarBorrados(e.borrados || BORRADO_VACIO, MAX_DIAS_GASTO);
  const vivos = filtrarBorrados(fusionarGastos(e.gastos, []), fusionarCierres(e.cierres, []), borrados);
  const gastos = podarGastos(vivos.gastos, vivos.cierres);
  const cierres = vivos.cierres.slice(0, MAX_CIERRES);
  return { fondo: Number(e.fondo) || 0, gastos, cierres, ...borrados.gastos.length || borrados.cierres.length ? { borrados } : {} };
}
function parsearRemoto(c) {
  if (!c || typeof c !== "object") return null;
  const o = c;
  const borradosBruto = o.borrados;
  const gastosBorrados = Array.isArray(borradosBruto?.gastos) ? borradosBruto.gastos.filter((t) => t && t.id) : [];
  const cierresBorrados = Array.isArray(borradosBruto?.cierres) ? borradosBruto.cierres.filter((t) => t && t.fecha) : [];
  return {
    fondo: Number(o.fondo) || 0,
    gastos: Array.isArray(o.gastos) ? o.gastos : [],
    cierres: Array.isArray(o.cierres) ? o.cierres : [],
    ...gastosBorrados.length || cierresBorrados.length ? { borrados: { gastos: gastosBorrados.slice(0, 150), cierres: cierresBorrados.slice(0, 150) } } : {}
  };
}
async function fusionarConNube(uid) {
  let remoto = null;
  let remotoAt = 0;
  try {
    const snap = await (0, import_firestore.getDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", uid));
    if (snap.exists()) {
      const c = snap.data()?.caja;
      remoto = parsearRemoto(c);
      remotoAt = Number(c?.at) || 0;
    }
  } catch {
  }
  if (!remoto) return estado;
  return normalizar({
    // el fondo manda el más nuevo: el remoto solo si lo cambió
    // OTRO teléfono después de nuestro último guardado local
    fondo: remotoAt > ultimoGuardoLocal(uid) ? remoto.fondo : estado.fondo,
    gastos: fusionarGastos(estado.gastos, remoto.gastos),
    cierres: fusionarCierres(estado.cierres, remoto.cierres),
    borrados: fusionarBorrados(estado.borrados, remoto.borrados)
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
        caja: {
          fondo: fusion.fondo,
          gastos: fusion.gastos.slice(0, 200),
          cierres: fusion.cierres.slice(0, MAX_CIERRES),
          // 🔄 FASE W: los tombstones viajan con la caja → el otro
          // celular sabe qué no tiene que resucitar al fusionar
          ...fusion.borrados && (fusion.borrados.gastos.length || fusion.borrados.cierres.length) ? { borrados: fusion.borrados } : {},
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
    console.warn("\u26A0\uFE0F Caja: no se pudo guardar en Firestore (queda en el tel\xE9fono)", e);
  }
}
async function sincronizarRemoto(uid) {
  if (!uid || !import_firebase.db) return;
  try {
    const snap = await (0, import_firestore.getDoc)((0, import_firestore.doc)(import_firebase.db, "usuarios", uid));
    if (!snap.exists()) return;
    const c = snap.data()?.caja;
    const remoto = parsearRemoto(c);
    if (!remoto) return;
    aplicarRemoto(uid, remoto, Number(c?.at) || 0);
  } catch (e) {
    console.warn("\u26A0\uFE0F Caja: no se pudo sincronizar desde Firestore", e);
  }
}
function aplicarRemoto(uid, remoto, remotoAt) {
  const fusionado = normalizar({
    // el fondo manda el remoto (lo último que guardó cualquier
    // teléfono) solo si es más nuevo que nuestro último cambio
    // local; si el local nunca guardó, 0 no pisa nada
    fondo: remotoAt >= ultimoGuardoLocal(uid) ? remoto.fondo : estado.fondo,
    gastos: fusionarGastos(estado.gastos, remoto.gastos),
    cierres: fusionarCierres(estado.cierres, remoto.cierres),
    borrados: fusionarBorrados(estado.borrados, remoto.borrados)
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
          const c = snap.data()?.caja;
          const remoto = parsearRemoto(c);
          if (!remoto) return;
          const remotoAt = Number(c?.at) || 0;
          if (atEscrito > 0 && remotoAt === atEscrito) return;
          const cambio = aplicarRemoto(uid, remoto, remotoAt);
          if (cambio) {
            window.dispatchEvent(
              new CustomEvent(EVENTO_CAJA_REMOTA, { detail: { at: remotoAt } })
            );
          }
        } catch {
        }
      },
      (err) => {
        console.warn("\u26A0\uFE0F Caja: escucha en vivo ca\xEDda (reintenta sola)", err?.message || err);
      }
    );
  } catch {
  }
}
var CLAVE_GUARDO = (uid) => `rt_caja_guardo_${uid}`;
function ultimoGuardoLocal(uid) {
  try {
    return Number(localStorage.getItem(CLAVE_GUARDO(uid))) || 0;
  } catch {
    return 0;
  }
}
function marcarGuardoLocal(uid) {
  try {
    localStorage.setItem(CLAVE_GUARDO(uid), String(Date.now()));
  } catch {
  }
}
function arrancarCaja(uid) {
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
function snapshotCaja() {
  if (!snapCache || snapTickCache !== snapshotTick) {
    snapCache = { fondo: estado.fondo, gastos: estado.gastos, cierres: estado.cierres };
    snapTickCache = snapshotTick;
  }
  return snapCache;
}
function suscribirCaja(cb) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}
async function recargarCaja(uid) {
  if (uidActual !== uid) arrancarCaja(uid);
  await sincronizarRemoto(uid);
}
async function fijarFondo(uid, monto) {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;
  const limpio = Math.max(0, Number(monto) || 0);
  if (limpio === estado.fondo) return;
  estado = { ...estado, fondo: limpio };
  persistirLocal();
  marcarGuardoLocal(uid);
  emitir();
  await guardarRemoto(uid);
}
async function agregarGasto(uid, datos) {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;
  const monto = Math.abs(Number(datos.monto) || 0);
  if (monto <= 0) throw new Error("El monto debe ser mayor a cero");
  const gasto = {
    id: nuevoGastoId(),
    ts: Date.now(),
    categoria: datos.categoria || "otros",
    concepto: (datos.concepto || "").trim().slice(0, 60),
    monto,
    pago: datos.pago === "yape" ? "yape" : "efectivo"
  };
  estado = { ...estado, gastos: [gasto, ...estado.gastos] };
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
  return gasto;
}
async function eliminarGasto(uid, id) {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;
  if (!estado.gastos.some((g) => g.id === id)) return;
  estado = {
    ...estado,
    gastos: estado.gastos.filter((g) => g.id !== id),
    borrados: fusionarBorrados(estado.borrados, { gastos: [tombstoneGasto(id)], cierres: [] })
  };
  estado = normalizar(estado);
  persistirLocal();
  emitir();
  await guardarRemoto(uid);
}
function gastosDeHoy(caja) {
  return gastosDeFecha(caja.gastos, hoyLocal());
}
async function cerrarCaja(uid, datos) {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;
  const r = datos.resumen;
  const contado = Math.max(0, Number(datos.contado) || 0);
  const fechaCierre = normalizarFechaCierre(datos.fecha, hoyLocal());
  const cierre = {
    fecha: fechaCierre,
    at: Date.now(),
    fondoInicial: estado.fondo,
    entregas: r.entregas,
    efectivoCobrado: r.efectivoCobrado,
    digitalRider: r.digitalRider,
    empresa: r.empresa,
    gastosEfectivo: r.gastosEfectivo,
    gastosDigital: r.gastosDigital,
    esperado: r.esperado,
    contado,
    diferencia: contado - r.esperado,
    netoDelDia: r.netoDelDia,
    // 📅 FASE BE: se congelan los gastos DEL DÍA del cierre (no
    // los de hoy) — el gasto anotado el 2-nov pertenece a la caja
    // del 2-nov, la cierres cuando la cierres
    gastos: gastosDeFecha(estado.gastos, fechaCierre),
    nota: (datos.nota || "").trim().slice(0, 200) || void 0,
    // 💜 FASE BC: los pedidos FALLIDOS del día viajan congelados en el
    // cierre → el cuadre al jefe los muestra ({fallidos} / {detallePedidos})
    fallidos: r.fallidos || 0,
    // 🛵 FASE Q: la paga del día viaja DENTRO del cierre (a la
    // nube por el mismo doc usuarios/{uid}.caja — sin reglas nuevas)
    ...datos.pagoRuta ? { pagoRuta: datos.pagoRuta } : {}
  };
  const cierres = [cierre, ...estado.cierres.filter((c) => c.fecha !== cierre.fecha)].slice(0, MAX_CIERRES);
  estado = normalizar({ ...estado, cierres });
  persistirLocal();
  marcarGuardoLocal(uid);
  emitir();
  await guardarRemoto(uid);
  return cierre;
}
function cierreDeHoy(caja) {
  return cierreDeFecha(caja.cierres, hoyLocal());
}
async function reabrirCaja(uid) {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;
  const hoy = hoyLocal();
  const cierreViejo = cierreDeFecha(estado.cierres, hoy);
  if (!cierreViejo) return;
  estado = {
    ...estado,
    cierres: estado.cierres.filter((c) => c.fecha !== hoy),
    borrados: fusionarBorrados(estado.borrados, { gastos: [], cierres: [tombstoneCierre(hoy)] })
  };
  estado = normalizar(estado);
  persistirLocal();
  marcarGuardoLocal(uid);
  emitir();
  await guardarRemoto(uid);
}
async function cambiarFechaCierre(uid, fechaVieja, fechaNueva) {
  if (uidActual !== uid) arrancarCaja(uid);
  uidActual = uidActual || uid;
  const hoy = hoyLocal();
  const vieja = normalizarFechaCierre(fechaVieja, hoy);
  const nueva = normalizarFechaCierre(fechaNueva, hoy);
  const cierreViejo = cierreDeFecha(estado.cierres, vieja);
  if (!cierreViejo) throw new Error("No encontr\xE9 una caja cerrada con esa fecha");
  if (nueva === vieja) throw new Error("Eleg\xED una fecha distinta a la que tiene");
  if (cierreDeFecha(estado.cierres, nueva)) {
    throw new Error(`Ya cerraste la caja del ${nueva} \u2014 borr\xE1 esa primero (reabrila) si quer\xE9s mover esta ah\xED`);
  }
  const at = Date.now();
  const movido = { ...cierreViejo, fecha: nueva, at };
  estado = normalizar({
    ...estado,
    cierres: [movido, ...estado.cierres.filter((c) => c.fecha !== vieja && c.fecha !== nueva)],
    // el cierre con la fecha vieja queda "borrado" para la nube
    borrados: fusionarBorrados(estado.borrados, { gastos: [], cierres: [tombstoneCierre(vieja)] })
  });
  persistirLocal();
  marcarGuardoLocal(uid);
  emitir();
  await guardarRemoto(uid);
  return movido;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EVENTO_CAJA_REMOTA,
  agregarGasto,
  arrancarCaja,
  cambiarFechaCierre,
  cerrarCaja,
  cierreDeHoy,
  eliminarGasto,
  fijarFondo,
  gastosDeHoy,
  reabrirCaja,
  recargarCaja,
  snapshotCaja,
  suscribirCaja
});
