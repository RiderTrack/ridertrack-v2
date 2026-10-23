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

// test-sync/stub-plantillas-fx.cjs
var require_stub_plantillas_fx = __commonJS({
  "test-sync/stub-plantillas-fx.cjs"(exports2) {
    var T = globalThis.__PLT_T__ ||= {
      getDocsSnap: { empty: true, docs: [], metadata: { fromCache: false } },
      listenerSnap: { docs: [], metadata: { fromCache: false } },
      addDocCalls: [],
      suscripciones: 0
    };
    var snapDe = (cfg) => ({
      empty: cfg.empty === true,
      metadata: cfg.metadata || { fromCache: false },
      forEach: (fn) => (cfg.docs || []).forEach((d) => fn({ id: d.id, data: () => d.data })),
      size: (cfg.docs || []).length
    });
    exports2.collection = (db2, col) => ({ __col: col });
    exports2.doc = (db2, col, id) => ({ __ref: `${col}/${id}` });
    exports2.query = (ref) => ref;
    exports2.where = () => null;
    exports2.orderBy = () => null;
    exports2.limit = () => null;
    exports2.QuerySnapshot = class {
    };
    exports2.DocumentData = class {
    };
    exports2.getDocs = async (ref) => snapDe(T.getDocsSnap);
    exports2.addDoc = async (ref, data) => {
      T.addDocCalls.push({ col: ref.__col, data });
      return { id: "nuevo-" + (T.addDocCalls.length + Math.floor(Math.random() * 1e3)) };
    };
    exports2.setDoc = async () => {
    };
    exports2.deleteDoc = async () => {
    };
    exports2.updateDoc = async () => {
    };
    exports2.getDoc = async () => ({ exists: () => false, data: () => void 0 });
    exports2.serverTimestamp = () => ({ __ts: "server" });
    exports2.onSnapshot = (ref, cb, errCb) => {
      T.suscripciones++;
      setImmediate(() => {
        try {
          cb(snapDe({ empty: (T.listenerSnap.docs || []).length === 0, docs: T.listenerSnap.docs, metadata: T.listenerSnap.metadata }));
        } catch (e) {
          if (errCb) errCb(e);
        }
      });
      return () => {
      };
    };
  }
});

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
    exports2.storageRef = (storage, ruta) => ({ __ruta: ruta });
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

// src/utils/botControl.ts
var botControl_exports = {};
__export(botControl_exports, {
  BLOQUES_CONDICIONALES: () => BLOQUES_CONDICIONALES,
  CATEGORIAS_PLANTILLA: () => CATEGORIAS_PLANTILLA,
  CATEGORIAS_SELECT: () => CATEGORIAS_SELECT,
  CONTROL_BOT_DEFAULT: () => CONTROL_BOT_DEFAULT,
  DATOS_PRUEBA: () => DATOS_PRUEBA,
  DATOS_RUTA_DEMO: () => DATOS_RUTA_DEMO,
  ETIQUETAS_REGISTRO: () => ETIQUETAS_REGISTRO,
  TELEFONO_PRUEBA_DEFAULT: () => TELEFONO_PRUEBA_DEFAULT,
  VARIABLES_PLANTILLA: () => VARIABLES_PLANTILLA,
  VARIABLES_RUTA: () => VARIABLES_RUTA,
  activarModoBucleBot: () => activarModoBucleBot,
  aplicarVariablesPreview: () => aplicarVariablesPreview,
  celBonito: () => celBonito,
  crearPlantillasPredefinidas: () => crearPlantillasPredefinidas,
  detenerModoBucleBot: () => detenerModoBucleBot,
  duplicarPlantilla: () => duplicarPlantilla,
  eliminarPlantilla: () => eliminarPlantilla,
  escapeHtmlTexto: () => escapeHtmlTexto,
  escucharControlBot: () => escucharControlBot,
  escucharPlantillas: () => escucharPlantillas,
  escucharPuente: () => escucharPuente,
  escucharRegistroHoy: () => escucharRegistroHoy,
  escucharSilenciados: () => escucharSilenciados,
  fechaLocalISO: () => fechaLocalISO,
  formatearWhatsAppHTML: () => formatearWhatsAppHTML,
  guardarControlBot: () => guardarControlBot,
  guardarPlantilla: () => guardarPlantilla,
  linkProbarPlantilla: () => linkProbarPlantilla,
  procesarBloquesPreview: () => procesarBloquesPreview,
  reactivarSilenciado: () => reactivarSilenciado,
  sincronizarBotUnaVez: () => sincronizarBotUnaVez
});
module.exports = __toCommonJS(botControl_exports);
var import_firestore = __toESM(require_stub_plantillas_fx(), 1);
var import_firebase = __toESM(require_stub_firebase_app(), 1);
var CATEGORIAS_PLANTILLA = [
  { id: "todas", label: "Todas", icono: "\u{1F4CB}" },
  { id: "saludos", label: "Saludos", icono: "\u{1F44B}" },
  { id: "pagos", label: "Pagos", icono: "\u{1F4B3}" },
  { id: "entrega", label: "Entrega", icono: "\u{1F69A}" },
  { id: "fallidos", label: "Fallidos", icono: "\u26A0\uFE0F" },
  { id: "personalizado", label: "Personal", icono: "\u2728" },
  { id: "ridertrack", label: "RiderTrack", icono: "\u{1F6F5}" }
];
var CATEGORIAS_SELECT = [
  { id: "saludos", label: "\u{1F44B} Saludos" },
  { id: "pagos", label: "\u{1F4B3} Pagos" },
  { id: "entrega", label: "\u{1F69A} Entrega" },
  { id: "fallidos", label: "\u26A0\uFE0F Fallidos" },
  { id: "personalizado", label: "\u2728 Personal" },
  { id: "ridertrack", label: "\u{1F6F5} RiderTrack" }
];
var VARIABLES_PLANTILLA = [
  "{nombre}",
  "{producto}",
  "{monto}",
  "{cobrar}",
  "{direccion}",
  "{distrito}",
  "{telefono}",
  "{minutos_llegada}",
  "{hora}",
  "{fecha}"
];
var VARIABLES_RUTA = [
  "{mi_posicion}",
  "{total_ruta}",
  "{faltan_antes}",
  "{entregados_hoy}",
  "{distrito_actual}",
  "{eta_aprox}",
  "{ruta_lista}"
];
var BLOQUES_CONDICIONALES = [
  "sin_eta",
  "sin_posicion",
  "sin_ruta",
  "sin_producto",
  "sin_cobrar",
  "sin_direccion",
  "sin_motivo"
];
var ETIQUETAS_REGISTRO = {
  respuesta_ia: { label: "IA", clase: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  eta_automatico: { label: "ETA", clase: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  handoff: { label: "HANDOFF", clase: "bg-red-500/15 text-red-300 border-red-500/30" },
  menu_ia_off: { label: "MEN\xDA", clase: "bg-slate-500/15 text-slate-300 border-slate-500/30" }
};
var CONTROL_BOT_DEFAULT = {
  bot_activo: true,
  ia_activa: true,
  horario_activo: false,
  hora_inicio: 7,
  hora_fin: 22,
  palabras_enojo_extra: []
};
function escucharControlBot(cb, onError) {
  if (!import_firebase.db) {
    cb(CONTROL_BOT_DEFAULT);
    return () => void 0;
  }
  return (0, import_firestore.onSnapshot)(
    (0, import_firestore.doc)(import_firebase.db, "sistema", "control_bot"),
    (snap) => {
      const d = snap.exists() ? snap.data() || {} : {};
      cb({
        bot_activo: d.bot_activo !== false,
        ia_activa: d.ia_activa !== false,
        horario_activo: d.horario_activo === true,
        hora_inicio: typeof d.hora_inicio === "number" ? d.hora_inicio : 7,
        hora_fin: typeof d.hora_fin === "number" ? d.hora_fin : 22,
        palabras_enojo_extra: Array.isArray(d.palabras_enojo_extra) ? d.palabras_enojo_extra : []
      });
    },
    (err) => onError && onError(err)
  );
}
async function guardarControlBot(cfg) {
  if (!import_firebase.db) throw new Error("Firestore no disponible");
  await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "sistema", "control_bot"), cfg, { merge: true });
}
function escucharSilenciados(cb, onError) {
  if (!import_firebase.db) {
    cb([]);
    return () => void 0;
  }
  return (0, import_firestore.onSnapshot)(
    (0, import_firestore.collection)(import_firebase.db, "bot_silenciado"),
    (snap) => {
      const lista = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        if (data.activo === false) return;
        lista.push({
          id: d.id,
          celular: String(data.celular || d.id),
          motivo: String(data.motivo || ""),
          detalle: String(data.detalle || ""),
          porEnojo: data.motivo === "enojo_detectado",
          creado_en: data.creado_en
        });
      });
      lista.sort((a, b) => String(b.creado_en || "").localeCompare(String(a.creado_en || "")));
      cb(lista);
    },
    (err) => onError && onError(err)
  );
}
async function reactivarSilenciado(docId) {
  if (!import_firebase.db) throw new Error("Firestore no disponible");
  await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(import_firebase.db, "bot_silenciado", docId));
}
function fechaLocalISO(f = /* @__PURE__ */ new Date()) {
  const y = f.getFullYear();
  const m = String(f.getMonth() + 1).padStart(2, "0");
  const d = String(f.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function escucharRegistroHoy(cb, onError) {
  if (!import_firebase.db) {
    cb([]);
    return () => void 0;
  }
  const q = (0, import_firestore.query)(
    (0, import_firestore.collection)(import_firebase.db, "registro_bot"),
    (0, import_firestore.where)("fecha", "==", fechaLocalISO()),
    (0, import_firestore.limit)(40)
  );
  return (0, import_firestore.onSnapshot)(
    q,
    (snap) => {
      const lista = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        lista.push({
          id: d.id,
          fecha: String(data.fecha || ""),
          ts: String(data.ts || ""),
          tipo: String(data.tipo || ""),
          nombre: String(data.nombre || "Cliente"),
          detalle: String(data.detalle || "")
        });
      });
      lista.sort((a, b) => b.ts.localeCompare(a.ts));
      cb(lista);
    },
    (err) => onError && onError(err)
  );
}
function escucharPlantillas(cb, onError) {
  if (!import_firebase.db) {
    cb([]);
    return () => void 0;
  }
  return (0, import_firestore.onSnapshot)(
    (0, import_firestore.collection)(import_firebase.db, "plantillas_mensajes"),
    (snap) => {
      const lista = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        lista.push({
          id: d.id,
          nombre: String(data.nombre || "Sin nombre"),
          categoria: String(data.categoria || "personalizado"),
          mensaje: String(data.mensaje || ""),
          clave: data.clave ? String(data.clave) : void 0,
          activa: data.activa === true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });
      lista.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      cb(lista, { fromCache: snap.metadata?.fromCache === true });
    },
    (err) => onError && onError(err)
  );
}
async function crearPlantillasPredefinidas() {
  if (!import_firebase.db) throw new Error("Firestore no disponible");
  const snap = await (0, import_firestore.getDocs)((0, import_firestore.collection)(import_firebase.db, "plantillas_mensajes"));
  if (!snap.empty) return 0;
  if (snap.metadata?.fromCache === true) {
    console.log("\u{1F331} Plantillas: vac\xEDo de CACH\xC9 fr\xEDa \u2014 no siembro, espero al servidor");
    return 0;
  }
  const predef = [
    {
      nombre: "Men\xFA Principal",
      categoria: "saludos",
      mensaje: "\u{1F31E} \xA1Hola, {nombre}! \u{1F44B}\n\nSoy el asistente de *Rudy Alen*, tu motorizado de *MATE* \u{1F69A}\n\n\xBFEn qu\xE9 te puedo ayudar hoy?\n\n1\uFE0F\u20E3 \xBFCu\xE1nto debo pagar?\n2\uFE0F\u20E3 \xBFA qu\xE9 hora llega mi pedido?\n3\uFE0F\u20E3 \xBFQu\xE9 me est\xE1n trayendo?\n4\uFE0F\u20E3 N\xFAmero de Yape / QR de pago\n5\uFE0F\u20E3 Cuentas bancarias\n6\uFE0F\u20E3 Ya realic\xE9 mi pago \u2705\n7\uFE0F\u20E3 Hablar con el motorizado \u{1F4DE}\n8\uFE0F\u20E3 No puedo recibir mi pedido hoy \u{1F4C5}\n9\uFE0F\u20E3 Problema con mi pedido \u26A0\uFE0F\n\n_Responde con el n\xFAmero de tu consulta_ \u{1F60A}"
    },
    {
      nombre: "Cu\xE1nto Pagar",
      categoria: "pagos",
      mensaje: "\u{1F4B0} El monto de tu pedido es:\n*S/ {monto}*\n\n\u{1F4E6} Producto:\n> *{producto}*\n\n\u{1F4F2} Puedes pagar por:\n\u2022 *Yape / Plin* \u{1F4F1}\n\u2022 *Efectivo* \u{1F4B5}\n\u2022 *Transferencia* \u{1F3E6}"
    },
    {
      nombre: "Aviso de Llegada",
      categoria: "entrega",
      mensaje: "\u{1F69A} Hola, *{nombre}* \u{1F44B}\n\nLe informo que estar\xE9 llegando en *15 minutos* \u23F1\uFE0F\n\n\u{1F4E6} Pedido: *{producto}*\n\u{1F4B0} Monto: *S/ {monto}*\n\n\u{1F4F2} Por favor mantenerse atento(a) al tel\xE9fono."
    },
    {
      nombre: "Entrega Completada",
      categoria: "entrega",
      mensaje: "\u2705 \xA1*{nombre}*, tu pedido fue entregado!\n\n\u{1F4E6} *{producto}*\n\u{1F4B0} Monto cobrado: *S/ {monto}*\n\n\xA1Muchas gracias por tu preferencia! \u{1F64C}"
    },
    {
      nombre: "No Se Entreg\xF3",
      categoria: "fallidos",
      mensaje: "\u{1F614} Hola, *{nombre}*\n\nHoy *no pudimos realizar tu entrega* en:\n\u{1F4CD} *{direccion}*, {distrito}\n\nPara *reprogramar* comun\xEDcate con *MATE*:\n\u{1F4DE} *956 203 893*"
    },
    {
      nombre: "Yape QR",
      categoria: "pagos",
      mensaje: "\u{1F4F1} N\xFAmero de *SOLO YAPE*:\n*980811297*\n\nA nombre de: `Lorenzo N. Tarazona T.`\n\n\u{1F4E6} Producto: *{producto}*\n\u{1F4B0} Monto: *S/ {monto}*\n\n\u{1F4F8} Env\xEDame la captura del pago para confirmar."
    }
  ];
  for (const p of predef) {
    await (0, import_firestore.addDoc)((0, import_firestore.collection)(import_firebase.db, "plantillas_mensajes"), {
      ...p,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  return predef.length;
}
async function guardarPlantilla(datos) {
  if (!import_firebase.db) throw new Error("Firestore no disponible");
  const { id, nombre, categoria, mensaje, clave } = datos;
  if (id) {
    await (0, import_firestore.setDoc)(
      (0, import_firestore.doc)(import_firebase.db, "plantillas_mensajes", id),
      {
        nombre,
        categoria,
        mensaje,
        clave,
        activa: clave ? true : false,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      { merge: true }
    );
  } else {
    await (0, import_firestore.addDoc)((0, import_firestore.collection)(import_firebase.db, "plantillas_mensajes"), {
      nombre,
      categoria,
      mensaje,
      clave,
      activa: clave ? true : false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
}
async function duplicarPlantilla(p) {
  if (!import_firebase.db) throw new Error("Firestore no disponible");
  await (0, import_firestore.addDoc)((0, import_firestore.collection)(import_firebase.db, "plantillas_mensajes"), {
    nombre: p.nombre + " (copia)",
    categoria: p.categoria,
    mensaje: p.mensaje,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function eliminarPlantilla(id) {
  if (!import_firebase.db) throw new Error("Firestore no disponible");
  await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(import_firebase.db, "plantillas_mensajes", id));
}
async function sincronizarBotUnaVez() {
  if (!import_firebase.db) throw new Error("Firestore no disponible");
  await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "sistema", "puente_control"), { accion: "once", ts: Date.now() }, { merge: true });
}
async function activarModoBucleBot() {
  if (!import_firebase.db) throw new Error("Firestore no disponible");
  const expira = Date.now() + 10 * 60 * 1e3;
  await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "sistema", "puente_control"), { accion: "loop", expiraEn: expira }, { merge: true });
}
async function detenerModoBucleBot() {
  if (!import_firebase.db) throw new Error("Firestore no disponible");
  await (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "sistema", "puente_control"), { accion: "off" }, { merge: true });
}
function escucharPuente(cb, onError) {
  if (!import_firebase.db) {
    cb({ accion: "", expiraEn: null, ts: null });
    return () => void 0;
  }
  return (0, import_firestore.onSnapshot)(
    (0, import_firestore.doc)(import_firebase.db, "sistema", "puente_control"),
    (snap) => {
      const d = snap.exists() ? snap.data() || {} : {};
      cb({
        accion: d.accion || "",
        expiraEn: typeof d.expiraEn === "number" ? d.expiraEn : null,
        ts: typeof d.ts === "number" ? d.ts : null
      });
    },
    (err) => onError && onError(err)
  );
}
var DATOS_PRUEBA = {
  nombre: "Luis Vega",
  producto: "Masajeador con Infrarrojo",
  monto: "89.90",
  cobrar: "89.90",
  direccion: "Mz Z Lote 22, Urb Pro",
  distrito: "San Mart\xEDn de Porres",
  telefono: "981 480 520",
  minutos_llegada: "15"
};
var DATOS_RUTA_DEMO = {
  mi_posicion: "17",
  total_ruta: "19",
  faltan_antes: "3",
  entregados_hoy: "13",
  distrito_actual: "Los Olivos",
  eta_aprox: "4:35 p. m.",
  ruta_lista: "1. San Isidro\n2. Magdalena del Mar\n3. Jes\xFAs Mar\xEDa\n4. Jes\xFAs Mar\xEDa\n5. Pueblo Libre\n6. Pueblo Libre\n7. Cercado de Lima\n8. San Miguel\n9. San Miguel\n10. La Perla\n11. Callao\n12. San Mart\xEDn de Porres\n13. San Mart\xEDn de Porres\n14. Los Olivos\n15. Los Olivos\n16. Independencia\n17. Comas \u2190 \u{1F4CD} *T\xDA EST\xC1S AQU\xCD*\n18. Los Olivos\n19. Los Olivos"
};
function procesarBloquesPreview(texto) {
  let t = texto;
  for (const b of BLOQUES_CONDICIONALES) {
    const re = new RegExp("\\{" + b + "\\}([\\s\\S]*?)\\{\\/" + b + "\\}", "g");
    t = t.replace(re, "$1");
  }
  return t;
}
function aplicarVariablesPreview(mensaje) {
  const ahora = /* @__PURE__ */ new Date();
  const datos = {
    ...DATOS_PRUEBA,
    hora: ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
    fecha: ahora.toLocaleDateString("es-PE"),
    ...DATOS_RUTA_DEMO
  };
  let t = procesarBloquesPreview(mensaje);
  for (const [k, v] of Object.entries(datos)) {
    t = t.split("{" + k + "}").join(v);
  }
  return t;
}
function escapeHtmlTexto(t) {
  return String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatearWhatsAppHTML(texto) {
  if (!texto) return "";
  let t = escapeHtmlTexto(texto);
  t = t.replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
  t = t.replace(/_([^_\n]+)_/g, "<i>$1</i>");
  t = t.replace(/~([^~\n]+)~/g, "<s>$1</s>");
  t = t.replace(/`([^`\n]+)`/g, '<code class="wa-code">$1</code>');
  t = t.replace(/\n/g, "<br>");
  return t;
}
var TELEFONO_PRUEBA_DEFAULT = "51907565569";
function linkProbarPlantilla(mensaje, telefono = TELEFONO_PRUEBA_DEFAULT) {
  return "https://wa.me/" + telefono.replace(/\D/g, "") + "?text=" + encodeURIComponent(aplicarVariablesPreview(mensaje));
}
function celBonito(cel) {
  const d = String(cel || "").replace(/\D/g, "");
  const t9 = d.length >= 11 && d.startsWith("51") ? d.slice(2, 11) : d.slice(-9);
  return t9.length === 9 ? `${t9.slice(0, 3)} ${t9.slice(3, 6)} ${t9.slice(6)}` : cel;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BLOQUES_CONDICIONALES,
  CATEGORIAS_PLANTILLA,
  CATEGORIAS_SELECT,
  CONTROL_BOT_DEFAULT,
  DATOS_PRUEBA,
  DATOS_RUTA_DEMO,
  ETIQUETAS_REGISTRO,
  TELEFONO_PRUEBA_DEFAULT,
  VARIABLES_PLANTILLA,
  VARIABLES_RUTA,
  activarModoBucleBot,
  aplicarVariablesPreview,
  celBonito,
  crearPlantillasPredefinidas,
  detenerModoBucleBot,
  duplicarPlantilla,
  eliminarPlantilla,
  escapeHtmlTexto,
  escucharControlBot,
  escucharPlantillas,
  escucharPuente,
  escucharRegistroHoy,
  escucharSilenciados,
  fechaLocalISO,
  formatearWhatsAppHTML,
  guardarControlBot,
  guardarPlantilla,
  linkProbarPlantilla,
  procesarBloquesPreview,
  reactivarSilenciado,
  sincronizarBotUnaVez
});
