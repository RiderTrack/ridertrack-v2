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

// src/utils/cajaCore.ts
var cajaCore_exports = {};
__export(cajaCore_exports, {
  BORRADO_VACIO: () => BORRADO_VACIO,
  CATEGORIAS_GASTO: () => CATEGORIAS_GASTO,
  MAX_CIERRES: () => MAX_CIERRES,
  MAX_DIAS_ATRAS_CIERRE: () => MAX_DIAS_ATRAS_CIERRE,
  MAX_DIAS_GASTO: () => MAX_DIAS_GASTO,
  MAX_PLANTILLAS_CUADRE: () => MAX_PLANTILLAS_CUADRE,
  PLANTILLA_CUADRE_DEFECTO: () => PLANTILLA_CUADRE_DEFECTO,
  ST_ENTREGADOS: () => ST_ENTREGADOS,
  VARIABLES_CUADRE: () => VARIABLES_CUADRE,
  aplicarPlantillaCuadre: () => aplicarPlantillaCuadre,
  armarMensajeCierre: () => armarMensajeCierre,
  armarMensajeCuadreJefe: () => armarMensajeCuadreJefe,
  calcularCuadreEntrega: () => calcularCuadreEntrega,
  calcularDiferencia: () => calcularDiferencia,
  categoriaInfo: () => categoriaInfo,
  cierreDeFecha: () => cierreDeFecha,
  etiquetaDiferencia: () => etiquetaDiferencia,
  fechaCorta: () => fechaCorta,
  fechaLocalDe: () => fechaLocalDe,
  filtrarBorrados: () => filtrarBorrados,
  formatearSoles: () => formatearSoles,
  fusionarBorrados: () => fusionarBorrados,
  fusionarCierres: () => fusionarCierres,
  fusionarGastos: () => fusionarGastos,
  gastosDeFecha: () => gastosDeFecha,
  horaCorta: () => horaCorta,
  normalizarCelJefe: () => normalizarCelJefe,
  normalizarFechaCierre: () => normalizarFechaCierre,
  normalizarPlantillasCuadre: () => normalizarPlantillasCuadre,
  nuevoGastoId: () => nuevoGastoId,
  nuevoPlantillaId: () => nuevoPlantillaId,
  podarBorrados: () => podarBorrados,
  resumenCajaDia: () => resumenCajaDia,
  tombstoneCierre: () => tombstoneCierre,
  tombstoneGasto: () => tombstoneGasto
});
module.exports = __toCommonJS(cajaCore_exports);
var ST_FALLIDOS_CAJA = ["fallida", "rechazado", "cancelado", "ausente", "no-contesta", "reprogramar"];
var CATEGORIAS_GASTO = [
  { id: "gasolina", icono: "\u26FD", nombre: "Gasolina" },
  { id: "aceite", icono: "\u{1F6E2}\uFE0F", nombre: "Aceite" },
  { id: "reparacion", icono: "\u{1F527}", nombre: "Reparaci\xF3n" },
  { id: "comida", icono: "\u{1F37D}\uFE0F", nombre: "Comida" },
  { id: "peaje", icono: "\u{1F6C3}", nombre: "Peaje" },
  { id: "pasaje", icono: "\u{1F68F}", nombre: "Pasaje" },
  { id: "otros", icono: "\u{1F4E6}", nombre: "Otros" }
];
var CATEGORIA_FALLBACK = { id: "otros", icono: "\u{1F4E6}", nombre: "Otros" };
function categoriaInfo(id) {
  return CATEGORIAS_GASTO.find((c) => c.id === id) || CATEGORIA_FALLBACK;
}
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
var ST_EMPRESA = ["empresa", "pos", "transferencia", "pago-link", "jose-smith", "yape-plin"];
function num(v) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}
function resumenCajaDia(clientes, gastos, fondo) {
  let entregas = 0;
  let efectivoCobrado = 0;
  let digitalRider = 0;
  let empresa = 0;
  let fallidos = 0;
  for (const c of clientes || []) {
    const st = c.st || "";
    if (!ST_ENTREGADOS.includes(st)) {
      if (ST_FALLIDOS_CAJA.includes(st)) fallidos++;
      continue;
    }
    entregas++;
    const cobrar = num(c.cobrar);
    const mEf = num(c.mEf);
    const mYp = num(c.mYp);
    const mVt = num(c.mVt);
    switch (st) {
      case "efectivo":
      case "cambio":
        efectivoCobrado += cobrar;
        break;
      case "yape-rudy":
        digitalRider += cobrar;
        break;
      case "yape-efectivo":
        efectivoCobrado += mEf - mVt;
        digitalRider += mYp;
        break;
      case "mixto":
        efectivoCobrado += mEf;
        empresa += num(c.mEmp);
        break;
      default:
        if (ST_EMPRESA.includes(st)) {
          empresa += cobrar;
        } else {
          empresa += cobrar;
        }
    }
  }
  let gastosEfectivo = 0;
  let gastosDigital = 0;
  for (const g of gastos || []) {
    const monto = Math.abs(num(g.monto));
    if (g.pago === "yape") gastosDigital += monto;
    else gastosEfectivo += monto;
  }
  const cobradoTotal = efectivoCobrado + digitalRider + empresa;
  const fondoNum = num(fondo);
  const esperado = fondoNum + efectivoCobrado - gastosEfectivo;
  const netoDelDia = efectivoCobrado + digitalRider - gastosEfectivo - gastosDigital;
  return {
    entregas,
    efectivoCobrado,
    digitalRider,
    empresa,
    cobradoTotal,
    gastosEfectivo,
    gastosDigital,
    nGastos: (gastos || []).length,
    esperado,
    netoDelDia,
    fallidos
  };
}
function calcularDiferencia(esperado, contado) {
  return contado - esperado;
}
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
function formatearSoles(n) {
  const v = Number.isFinite(n) ? n : 0;
  const signo = v < 0 ? "\u2212 " : "";
  return `${signo}S/ ${Math.abs(v).toFixed(2)}`;
}
function etiquetaDiferencia(dif) {
  const e = 0.01;
  if (Math.abs(dif) <= e) return { texto: "\u2713 cuadra exacto", clase: "ok" };
  if (dif > 0) return { texto: `sobran ${formatearSoles(dif)}`, clase: "sobra" };
  return { texto: `faltan ${formatearSoles(Math.abs(dif))}`, clase: "falta" };
}
function horaCorta(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fechaCorta(iso) {
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MESES[(m || 1) - 1]}`;
}
function armarMensajeCierre(cierre, riderNombre) {
  const L = [];
  const quien = riderNombre?.trim() || "Rider";
  L.push(`\u{1F4B0} *CIERRE DE CAJA \u2014 ${quien}*`);
  L.push(`\u{1F4C5} ${cierre.fecha}`);
  L.push("");
  L.push(`\u{1F4E6} Entregas: ${cierre.entregas}`);
  L.push(`\u{1F4B5} Efectivo cobrado: S/ ${cierre.efectivoCobrado.toFixed(2)}`);
  if (cierre.digitalRider > 0) {
    L.push(`\u{1F4F1} Yape digital: S/ ${cierre.digitalRider.toFixed(2)}`);
  }
  if (cierre.empresa > 0) {
    L.push(`\u{1F3EA} Empresa: S/ ${cierre.empresa.toFixed(2)}`);
  }
  L.push(`\u{1F9FE} Total d\xEDa: S/ ${(cierre.efectivoCobrado + cierre.digitalRider + cierre.empresa).toFixed(2)}`);
  L.push("");
  if (cierre.gastos.length > 0) {
    L.push("\u{1F4B8} *Gastos:*");
    for (const g of cierre.gastos) {
      const cat = categoriaInfo(g.categoria);
      const det = g.concepto ? ` \u2014 ${g.concepto}` : "";
      L.push(`  ${cat.icono} ${cat.nombre}: S/ ${Math.abs(g.monto).toFixed(2)}${det}`);
    }
    L.push("");
  }
  L.push(`\u{1F511} Fondo inicial: S/ ${cierre.fondoInicial.toFixed(2)}`);
  L.push(`\u{1F9EE} Esperado en caja: S/ ${cierre.esperado.toFixed(2)}`);
  L.push(`\u{1F932} Contado: S/ ${cierre.contado.toFixed(2)}`);
  const dif = cierre.diferencia;
  if (Math.abs(dif) <= 0.01) {
    L.push("\u2705 Caja cuadra exacto");
  } else if (dif > 0) {
    L.push(`\u26A0\uFE0F Sobran S/ ${dif.toFixed(2)}`);
  } else {
    L.push(`\u{1F534} Faltan S/ ${Math.abs(dif).toFixed(2)}`);
  }
  L.push("");
  L.push(`\u{1F3F7}\uFE0F Neto del d\xEDa (\u2212 gastos): S/ ${cierre.netoDelDia.toFixed(2)}`);
  if (cierre.nota?.trim()) {
    L.push("");
    L.push(`\u{1F4DD} ${cierre.nota.trim()}`);
  }
  return L.join("\n");
}
function pagoRutaTotal(v) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  if (v && typeof v === "object") {
    const n = Number(v.total);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}
function calcularCuadreEntrega(e) {
  const loTuyo = pagoRutaTotal(e.pagoRuta);
  const efectivoSinFondo = e.contado - e.fondoInicial;
  const yapeDisponible = Math.max(0, e.netoDelDia - Math.max(0, efectivoSinFondo));
  const pagaDelYape = Math.min(loTuyo, yapeDisponible);
  const pagaDelEfectivo = Math.max(0, loTuyo - yapeDisponible);
  const efectivo = Math.max(0, efectivoSinFondo - pagaDelEfectivo);
  const totalJefe = Math.max(0, e.netoDelDia - loTuyo);
  const yape = Math.max(0, totalJefe - efectivo);
  const teDebe = Math.max(0, loTuyo - e.netoDelDia);
  return { loTuyo, pagaDelYape, pagaDelEfectivo, teDebe, efectivo, yape, total: efectivo + yape };
}
function armarMensajeCuadreJefe(cierre, riderNombre) {
  return aplicarPlantillaCuadre(PLANTILLA_CUADRE_DEFECTO, cierre, riderNombre);
}
function normalizarCelJefe(texto) {
  const d = (texto || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 9) return "51" + d;
  return d;
}
function nuevoPlantillaId() {
  return `pl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
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
var VARIABLES_CUADRE = [
  { clave: "nombre", ej: "Rudy" },
  { clave: "fecha", ej: "8 oct" },
  { clave: "entregas", ej: "12" },
  { clave: "cobrado", ej: "S/ 1182.37" },
  { clave: "efectivo", ej: "S/ 300.00" },
  { clave: "yape", ej: "S/ 882.37" },
  { clave: "total", ej: "S/ 1182.37" },
  { clave: "loTuyo", ej: "\u{1F6F5} Mi paga de la ruta (10 pedidos): S/ 90.00 \u2014 ya descontada del Yape (vac\xEDo si no hay)" },
  { clave: "teDebe", ej: "\u26A0\uFE0F La empresa me queda debiendo: S/ 40.00 (vac\xEDo si no hay)" },
  { clave: "gastos", ej: "\xB7 gastos de la ruta: S/ 20.00 (2) \u2014 ya descontados (vac\xEDo si no hay)" },
  { clave: "empresa", ej: "\xB7 la empresa cobra directo: S/ 80.00 (vac\xEDo si no hay)" },
  { clave: "nota", ej: "\u{1F4DD} tu nota del cierre (vac\xEDo si no hay)" },
  // 💜 FASE BC: el detalle de pedidos que pidió Rudy — “cuántos
  // pedidos son de 9, cuántos de 12, cuántos fallidos”
  { clave: "detallePedidos", ej: "\u{1F4E6} Pedidos: 8 de S/ 9 + 2 de S/ 12 (lejos) \xB7 10 entregados \xB7 \u274C fallidos: 1 (vac\xEDo si no hubo)" },
  { clave: "pedidos9", ej: "8 (los de tarifa normal)" },
  { clave: "pedidos12", ej: "2 (los de distrito lejano)" },
  { clave: "fallidos", ej: "1 (fallida, rechazado, cancelado, ausente, no-contesta o reprogramar)" }
];
function aplicarPlantillaCuadre(texto, cierre, riderNombre) {
  const q = calcularCuadreEntrega(cierre);
  const mon = (n) => `S/ ${Math.max(0, n).toFixed(2)}`;
  const gastos = cierre.gastosEfectivo + cierre.gastosDigital;
  const pr = cierre.pagoRuta;
  const nPedidos = (pr?.cantidadNormal || 0) + (pr?.cantidadLejos || 0);
  const mapa = {
    nombre: riderNombre?.trim() || "Rider",
    fecha: fechaCorta(cierre.fecha),
    entregas: String(cierre.entregas),
    cobrado: mon(cierre.efectivoCobrado + cierre.digitalRider + cierre.empresa),
    efectivo: mon(q.efectivo),
    yape: mon(q.yape),
    total: mon(q.total),
    // 💜 FASE BC: el detalle de pedidos que pidió Rudy — “que sea un
    // poco más detallado: cuántos pedidos son de 9, cuántos de 12,
    // cuántos fallidos”. pedidos9/pedidos12 salen del snapshot de la
    // temporada (pagoRuta); fallidos, del cierre. Sin temporada → la
    // línea solo dice entregados + fallidos.
    pedidos9: String(pr?.cantidadNormal ?? 0),
    pedidos12: String(pr?.cantidadLejos ?? 0),
    fallidos: String(cierre.fallidos ?? 0),
    detallePedidos: (() => {
      const fall = cierre.fallidos ?? 0;
      const entregados = cierre.entregas ?? 0;
      if (entregados <= 0 && fall <= 0) return "";
      if (pr && (pr.cantidadNormal > 0 || pr.cantidadLejos > 0)) {
        const partes = [`${pr.cantidadNormal} de S/ ${pr.tarifaNormal.toFixed(0)}`];
        if (pr.cantidadLejos > 0) partes.push(`${pr.cantidadLejos} de S/ ${pr.tarifaLejos.toFixed(0)} (lejos)`);
        return `\u{1F4E6} Pedidos: ${partes.join(" + ")} \xB7 ${entregados} entregados \xB7 \u274C fallidos: ${fall}`;
      }
      return `\u{1F4E6} Pedidos: ${entregados} entregados \xB7 \u274C fallidos: ${fall}`;
    })(),
    // 🛵 FASE S: la línea de tu paga ahora dice DE DÓNDE la restaste —
    // del Yape (lo normal), del efectivo (día sin digital) o mezcla
    loTuyo: (() => {
      if (q.loTuyo <= 0) return "";
      const base = `\u{1F6F5} Mi paga de la ruta (${nPedidos || cierre.entregas} pedidos): ${mon(q.loTuyo)} \u2014 ya descontada`;
      if (q.pagaDelEfectivo <= 0) return `${base} del Yape`;
      if (q.pagaDelYape <= 0) return `${base} del efectivo`;
      return `${base} (${mon(q.pagaDelYape)} del Yape + ${mon(q.pagaDelEfectivo)} del efectivo)`;
    })(),
    teDebe: q.teDebe > 0 ? `\u26A0\uFE0F La empresa me queda debiendo: ${mon(q.teDebe)}` : "",
    gastos: gastos > 0 ? `\xB7 gastos de la ruta: ${mon(gastos)} (${cierre.gastos.length}) \u2014 ya descontados` : "",
    empresa: cierre.empresa > 0 ? `\xB7 la empresa cobra directo: ${mon(cierre.empresa)} (no pasa por mis manos)` : "",
    nota: cierre.nota?.trim() ? `\u{1F4DD} ${cierre.nota.trim()}` : ""
  };
  const reemplazo = (texto || "").replace(/\{(\w+)\}/g, (m, k) => k in mapa ? mapa[k] : m);
  return reemplazo.split("\n").map((l) => l.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
var MAX_PLANTILLAS_CUADRE = 10;
function normalizarPlantillasCuadre(bruto) {
  if (!Array.isArray(bruto)) return [];
  const fuera = [];
  for (const p of bruto) {
    if (!p || typeof p !== "object") continue;
    const nombre = String(p.nombre || "").trim().slice(0, 40);
    const texto = String(p.texto || "").slice(0, 4e3);
    if (!nombre || !texto.trim()) continue;
    const id = String(p.id || "") || nuevoPlantillaId();
    const at = Number(p.at) || Date.now();
    fuera.push({ id, nombre, texto, at });
  }
  return fuera.slice(0, MAX_PLANTILLAS_CUADRE);
}
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BORRADO_VACIO,
  CATEGORIAS_GASTO,
  MAX_CIERRES,
  MAX_DIAS_ATRAS_CIERRE,
  MAX_DIAS_GASTO,
  MAX_PLANTILLAS_CUADRE,
  PLANTILLA_CUADRE_DEFECTO,
  ST_ENTREGADOS,
  VARIABLES_CUADRE,
  aplicarPlantillaCuadre,
  armarMensajeCierre,
  armarMensajeCuadreJefe,
  calcularCuadreEntrega,
  calcularDiferencia,
  categoriaInfo,
  cierreDeFecha,
  etiquetaDiferencia,
  fechaCorta,
  fechaLocalDe,
  filtrarBorrados,
  formatearSoles,
  fusionarBorrados,
  fusionarCierres,
  fusionarGastos,
  gastosDeFecha,
  horaCorta,
  normalizarCelJefe,
  normalizarFechaCierre,
  normalizarPlantillasCuadre,
  nuevoGastoId,
  nuevoPlantillaId,
  podarBorrados,
  resumenCajaDia,
  tombstoneCierre,
  tombstoneGasto
});
