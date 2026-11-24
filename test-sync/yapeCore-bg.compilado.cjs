var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/yapeCore.ts
var yapeCore_exports = {};
__export(yapeCore_exports, {
  BORRADO_YAPE_VACIO: () => BORRADO_YAPE_VACIO,
  ID_BASE_EMPRESA: () => ID_BASE_EMPRESA,
  ID_BASE_PERSONAL: () => ID_BASE_PERSONAL,
  MAX_DIAS_BORRADO_YAPE: () => MAX_DIAS_BORRADO_YAPE,
  MAX_MOVS: () => MAX_MOVS,
  compactarMovs: () => compactarMovs,
  efectoDe: () => efectoDe,
  filtrarBorradosYape: () => filtrarBorradosYape,
  fusionarBorradosYape: () => fusionarBorradosYape,
  fusionarMovs: () => fusionarMovs,
  infoTipoYape: () => infoTipoYape,
  movsDeFecha: () => movsDeFecha,
  normalizarMovs: () => normalizarMovs,
  nuevoMovId: () => nuevoMovId,
  podarBorradosYape: () => podarBorradosYape,
  resumenYape: () => resumenYape,
  saldosYape: () => saldosYape,
  tombstoneMov: () => tombstoneMov
});
module.exports = __toCommonJS(yapeCore_exports);

// src/utils/cajaCore.ts
function fechaLocalDe(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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
function movsDeFecha(movs, fechaISO) {
  return (movs || []).filter((m) => fechaLocalDe(m.ts || 0) === fechaISO);
}
function resumenYape(movs, hoyISO) {
  const saldos = saldosYape(movs);
  let hoyChapes = 0;
  let hoyNChapes = 0;
  let hoyDepositado = 0;
  let hoyRetirado = 0;
  let hoyGastoPersonal = 0;
  let hoyGastoEmpresa = 0;
  let hoyN = 0;
  for (const m of movsDeFecha(movs, hoyISO)) {
    hoyN++;
    const monto = Math.abs(Number(m.monto) || 0);
    if (m.tipo === "chape") {
      hoyChapes += monto;
      hoyNChapes++;
    } else if (m.tipo === "deposito") hoyDepositado += monto;
    else if (m.tipo === "retiro") hoyRetirado += monto;
    else if (m.tipo === "gasto") {
      if (m.cuenta === "empresa") hoyGastoEmpresa += monto;
      else hoyGastoPersonal += monto;
    }
  }
  return {
    saldoPersonal: saldos.personal,
    saldoEmpresa: saldos.empresa,
    hoyChapes,
    hoyNChapes,
    hoyDepositado,
    hoyRetirado,
    hoyGastoPersonal,
    hoyGastoEmpresa,
    hoyN
  };
}
function infoTipoYape(tipo) {
  switch (tipo) {
    case "chape":
      return { icono: "\u{1F49C}", nombre: "Te chapearon" };
    case "gasto":
      return { icono: "\u{1F4B8}", nombre: "Gasto" };
    case "deposito":
      return { icono: "\u{1F3E6}", nombre: "Depositaste a la empresa" };
    case "retiro":
      return { icono: "\u{1F4B5}", nombre: "Retiraste de la empresa" };
    case "ajuste":
      return { icono: "\u2699\uFE0F", nombre: "Ajuste (cuadre)" };
  }
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BORRADO_YAPE_VACIO,
  ID_BASE_EMPRESA,
  ID_BASE_PERSONAL,
  MAX_DIAS_BORRADO_YAPE,
  MAX_MOVS,
  compactarMovs,
  efectoDe,
  filtrarBorradosYape,
  fusionarBorradosYape,
  fusionarMovs,
  infoTipoYape,
  movsDeFecha,
  normalizarMovs,
  nuevoMovId,
  podarBorradosYape,
  resumenYape,
  saldosYape,
  tombstoneMov
});
