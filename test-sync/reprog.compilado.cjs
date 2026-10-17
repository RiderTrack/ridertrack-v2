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

// src/services/reprog.ts
var reprog_exports = {};
__export(reprog_exports, {
  EXPIRA_DIAS: () => EXPIRA_DIAS,
  autoColaAlCerrar: () => autoColaAlCerrar,
  clienteParaRuta: () => clienteParaRuta,
  coinciden: () => coinciden,
  dividirCola: () => dividirCola,
  dividirNoEntregados: () => dividirNoEntregados,
  esEntregado: () => esEntregado,
  esFallido: () => esFallido,
  estaEnLista: () => estaEnLista,
  fusionarCola: () => fusionarCola,
  migrarFallidos: () => migrarFallidos,
  noEntregados: () => noEntregados,
  purgarCola: () => purgarCola,
  quitarDeCola: () => quitarDeCola,
  reincidentesDeHoy: () => reincidentesDeHoy,
  sumaDiasISO: () => sumaDiasISO
});
module.exports = __toCommonJS(reprog_exports);
var EXPIRA_DIAS = 5;
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
function esEntregado(st) {
  return ST_ENTREGADOS.includes((st || "").trim());
}
var ST_FALLIDOS = ["fallida", "rechazado", "cancelado", "ausente", "no-contesta"];
function esFallido(st) {
  return ST_FALLIDOS.includes((st || "").trim());
}
function sumaDiasISO(iso, n) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + n);
  const dos = (x) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${dos(dt.getMonth() + 1)}-${dos(dt.getDate())}`;
}
var normalizar = (v) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
var celKey = (c) => {
  const digitos = String(c.cel ?? "").replace(/\D/g, "");
  const cel = digitos.length === 11 && digitos.startsWith("51") ? digitos.slice(2) : digitos;
  return cel.length >= 8 ? `cel:${cel}` : "";
};
var nombreDirKey = (c) => {
  const n = normalizar(c.nombre);
  const d = normalizar(c.dir);
  if (n && d) return `nd:${n}|${d}`;
  if (n) return `n:${n}`;
  return "";
};
function coinciden(a, b) {
  const ka = celKey(a), kb = celKey(b);
  if (ka && ka === kb) return true;
  const na = nombreDirKey(a), nb = nombreDirKey(b);
  return !!(na && na === nb);
}
function estaEnLista(c, lista) {
  return lista.some((h) => coinciden(c, h));
}
function noEntregados(clientes) {
  return (clientes || []).filter((c) => {
    if (!normalizar(c.nombre)) return false;
    return !esEntregado(c.st);
  });
}
function dividirNoEntregados(noEnt, hoyLista) {
  const volvieron = [];
  const faltan = [];
  for (const c of noEnt || []) {
    if (estaEnLista(c, hoyLista)) volvieron.push(c);
    else faltan.push(c);
  }
  return { volvieron, faltan };
}
function reincidentesDeHoy(hoyLista, noEnt) {
  const ids = /* @__PURE__ */ new Set();
  for (const h of hoyLista || []) {
    if ((noEnt || []).some((c) => coinciden(h, c))) ids.add(h.id);
  }
  return ids;
}
function dividirCola(cola, hoy, hoyLista) {
  const paraHoy = [];
  const esperando = [];
  const futuro = [];
  const yaEnLista = [];
  for (const item of cola || []) {
    if (!item || !item.cliente || !normalizar(item.cliente.nombre)) continue;
    if (estaEnLista(item.cliente, hoyLista)) yaEnLista.push(item);
    else if (item.origen === "fallido" || !(item.para || "")) esperando.push(item);
    else if ((item.para || "") <= hoy) paraHoy.push(item);
    else futuro.push(item);
  }
  return { paraHoy, esperando, futuro, yaEnLista };
}
function fusionarCola(actual, agregar) {
  const out = [...actual || []];
  for (const nuevo of agregar || []) {
    const dup = out.some(
      (e) => e.para === nuevo.para && coinciden(e.cliente, nuevo.cliente)
    );
    if (!dup) out.push(nuevo);
  }
  return out;
}
function quitarDeCola(cola, cliente) {
  return (cola || []).filter((e) => !coinciden(e.cliente, cliente));
}
function autoColaAlCerrar(clientes, hoy, colaActual) {
  const nuevos = [];
  for (const c of clientes || []) {
    if (!normalizar(c.nombre)) continue;
    const st = (c.st || "").trim();
    if (st === "reprogramar") {
      nuevos.push({
        cliente: c,
        para: c.reprogramadoPara || sumaDiasISO(hoy, 1),
        desde: hoy,
        creadoAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else if (esFallido(st)) {
      nuevos.push({
        cliente: c,
        para: "",
        desde: hoy,
        creadoAt: (/* @__PURE__ */ new Date()).toISOString(),
        origen: "fallido"
      });
    }
  }
  return fusionarCola(colaActual, nuevos);
}
function purgarCola(cola, hoy, hoyLista) {
  let expirados = 0;
  let resueltos = 0;
  const vivos = (cola || []).filter((item) => {
    if (!item || !item.cliente) return false;
    if (estaEnLista(item.cliente, hoyLista)) {
      resueltos++;
      return false;
    }
    const desde = item.desde || "";
    const para = item.para || "";
    const base = desde > para ? desde : para;
    if (base && hoy > sumaDiasISO(base, EXPIRA_DIAS)) {
      expirados++;
      return false;
    }
    return true;
  });
  return { vivos, expirados, resueltos };
}
function migrarFallidos(ultima, cola) {
  if (!ultima || !(ultima.noEntregados || []).length) return cola || [];
  const yaEstan = (c) => (cola || []).some((e) => e && e.cliente && coinciden(e.cliente, c));
  const faltantes = (ultima.noEntregados || []).filter(
    (c) => c && normalizar(c.nombre) && esFallido(c.st) && !yaEstan(c)
  );
  if (!faltantes.length) return cola || [];
  return fusionarCola(
    cola || [],
    faltantes.map((c) => ({
      cliente: c,
      para: "",
      desde: ultima.fecha,
      creadoAt: (/* @__PURE__ */ new Date()).toISOString(),
      origen: "fallido"
    }))
  );
}
function clienteParaRuta(c, num, desde) {
  const {
    webReg,
    respondioInicioRuta,
    fotoUrl,
    reprogramadoPara,
    graciasEnviado,
    ...rest
  } = c;
  return {
    ...rest,
    id: `rp-${Date.now()}-${num}`,
    num,
    st: "pendiente",
    hora: "",
    mEf: 0,
    mYp: 0,
    mEmp: 0,
    mVt: 0,
    mEM: "",
    // 📅 FASE AD: marca para el badge 🔁 "reprogramado" en la tarjeta
    reprog: true,
    // fecha de donde viene (para mostrar "fallido ayer" con su fecha)
    reprogDesde: desde
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EXPIRA_DIAS,
  autoColaAlCerrar,
  clienteParaRuta,
  coinciden,
  dividirCola,
  dividirNoEntregados,
  esEntregado,
  esFallido,
  estaEnLista,
  fusionarCola,
  migrarFallidos,
  noEntregados,
  purgarCola,
  quitarDeCola,
  reincidentesDeHoy,
  sumaDiasISO
});
