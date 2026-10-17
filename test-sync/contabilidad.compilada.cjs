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

// src/drivertrack/services/contabilidad.ts
var contabilidad_exports = {};
__export(contabilidad_exports, {
  ETIQUETA_METODO: () => ETIQUETA_METODO,
  diasSemanaActual: () => diasSemanaActual,
  empresaPorDiaDesdeRegistros: () => empresaPorDiaDesdeRegistros,
  lunesDeISO: () => lunesDeISO,
  metaSemanal: () => metaSemanal,
  netoPorDia: () => netoPorDia,
  rangoSemanaDe: () => rangoSemanaDe,
  resumenEntre: () => resumenEntre,
  resumenMes: () => resumenMes,
  ritmoAlDia: () => ritmoAlDia,
  semanasContables: () => semanasContables
});
module.exports = __toCommonJS(contabilidad_exports);

// src/drivertrack/services/stats.ts
function sumarDias(fecha, dias) {
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(y, m - 1, d + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// src/drivertrack/services/contabilidad.ts
function lunesDeISO(f) {
  const [y, m, d] = f.split("-").map(Number);
  const dia = new Date(y, m - 1, d).getDay();
  const offset = (dia + 6) % 7;
  return sumarDias(f, -offset);
}
function rangoSemanaDe(f) {
  const lunes = lunesDeISO(f);
  return { desde: lunes, hasta: sumarDias(lunes, 6) };
}
function aISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function rangoMes(clave) {
  const [y, m] = clave.split("-").map(Number);
  return { desde: `${clave}-01`, hasta: aISO(new Date(y, m, 0)) };
}
function mesAnterior(clave) {
  const [y, m] = clave.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function empresaPorDiaDesdeRegistros(registros) {
  const m = /* @__PURE__ */ new Map();
  for (const r of registros) {
    const t = Number(r?.pagoPedidos?.total) || 0;
    if (t > 0 && r.fecha) m.set(r.fecha, (m.get(r.fecha) ?? 0) + t);
  }
  return m;
}
function resumenEntre(viajes, gastos, empresaPorDia, desde, hasta) {
  const vs = viajes.filter((v) => v.fecha >= desde && v.fecha <= hasta);
  const gs = gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta);
  const netoLibre = vs.reduce((s, v) => s + v.neto, 0);
  const porOrigen = /* @__PURE__ */ new Map();
  for (const v of vs) {
    const a = porOrigen.get(v.origen) ?? { n: 0, neto: 0 };
    a.n++;
    a.neto += v.neto;
    porOrigen.set(v.origen, a);
  }
  const gastosPorTipo = /* @__PURE__ */ new Map();
  for (const g of gs) gastosPorTipo.set(g.tipo, (gastosPorTipo.get(g.tipo) ?? 0) + g.monto);
  const totalGastos = gs.reduce((s, g) => s + g.monto, 0);
  let empresa = 0;
  let diasEmpresa = 0;
  for (const [f, monto] of empresaPorDia) {
    if (monto > 0 && f >= desde && f <= hasta) {
      empresa += monto;
      diasEmpresa++;
    }
  }
  return {
    n: vs.length,
    netoLibre,
    porOrigen: [...porOrigen.entries()].sort((a, b) => b[1].neto - a[1].neto).map(([origen, x]) => ({ origen, ...x })),
    empresa,
    diasEmpresa,
    total: netoLibre + empresa,
    gastos: totalGastos,
    gastosPorTipo: [...gastosPorTipo.entries()].sort((a, b) => b[1] - a[1]).map(([tipo, monto]) => ({ tipo, monto })),
    enMano: netoLibre + empresa - totalGastos
  };
}
function semanasContables(viajes, gastos, empresaPorDia, hoy, n = 6) {
  const out = [];
  let lunes = lunesDeISO(hoy);
  for (let i = 0; i < n; i++) {
    const hasta = i === 0 ? hoy : sumarDias(lunes, 6);
    out.push({
      desde: lunes,
      hasta,
      esActual: i === 0,
      ...resumenEntre(viajes, gastos, empresaPorDia, lunes, hasta)
    });
    lunes = sumarDias(lunes, -7);
  }
  return out;
}
function resumenMes(viajes, gastos, empresaPorDia, hoy) {
  const claveActual = hoy.slice(0, 7);
  const claveAnterior = mesAnterior(claveActual);
  const rA = rangoMes(claveActual);
  const rB = rangoMes(claveAnterior);
  const actual = resumenEntre(viajes, gastos, empresaPorDia, rA.desde, hoy < rA.hasta ? hoy : rA.hasta);
  const anterior = resumenEntre(viajes, gastos, empresaPorDia, rB.desde, rB.hasta);
  const diffPct = anterior.total > 0 ? (actual.total - anterior.total) / anterior.total * 100 : null;
  return { claveActual, claveAnterior, actual, anterior, diffPct };
}
function diasSemanaActual(hoy) {
  const lunes = lunesDeISO(hoy);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}
function netoPorDia(viajes, empresaPorDia, dias, hoy) {
  return dias.map((f) => {
    const netoLibre = viajes.filter((v) => v.fecha === f).reduce((s, v) => s + v.neto, 0);
    const empresa = empresaPorDia.get(f) ?? 0;
    return { fecha: f, netoLibre, empresa, total: netoLibre + empresa, futuro: f > hoy };
  });
}
function metaSemanal(metaDiaria) {
  return Math.max(0, metaDiaria) * 6;
}
function ritmoAlDia(metaDiaria, hoy) {
  const lunes = lunesDeISO(hoy);
  let dias = 0;
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(lunes, i);
    if (f > hoy) break;
    dias++;
  }
  return Math.max(0, metaDiaria) * Math.min(dias, 6);
}
var ETIQUETA_METODO = {
  indrive: "inDrive",
  rappi: "Rappi",
  pedidosya: "PedidosYa",
  directo: "Directo"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ETIQUETA_METODO,
  diasSemanaActual,
  empresaPorDiaDesdeRegistros,
  lunesDeISO,
  metaSemanal,
  netoPorDia,
  rangoSemanaDe,
  resumenEntre,
  resumenMes,
  ritmoAlDia,
  semanasContables
});
