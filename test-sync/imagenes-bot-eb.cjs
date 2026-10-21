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

// test-sync/stub-config-fx.cjs
var require_stub_config_fx = __commonJS({
  "test-sync/stub-config-fx.cjs"(exports2, module2) {
    var T = globalThis.__CFG_T__ || (globalThis.__CFG_T__ = {
      getDoc: { modo: "ok", fallos: 0, data: {} },
      cache: { modo: "vacio", data: {} },
      setDoc: { modo: "ok", fallos: 0 }
    });
    T.__reset = function() {
      T.getDoc = { modo: "ok", fallos: 0, data: {} };
      T.cache = { modo: "vacio", data: {} };
      T.setDoc = { modo: "ok", fallos: 0 };
    };
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
      getDocFromCache: async () => {
        const c = T.cache || { modo: "vacio" };
        if ((c.modo || "vacio") === "ok") {
          return { exists: () => true, data: () => c.data };
        }
        throw new Error("unavailable: no entry in cache");
      },
      serverTimestamp: () => ({ __ts: "server" }),
      Timestamp: { now: () => ({ toDate: () => /* @__PURE__ */ new Date() }) },
      getDoc: async (ref) => {
        anotar(T.getDoc, "llamadas");
        const c = T.getDoc;
        if (c.modo === "ok") {
          return { exists: () => true, data: () => c.data, metadata: { fromCache: !!c.fromCache } };
        }
        if (c.modo === "vacio") {
          return { exists: () => false, data: () => void 0, metadata: { fromCache: false } };
        }
        if (c.modo === "fallo-n") {
          const hechas = c.llamadas || 1;
          if (hechas <= (c.fallos || 0)) throw new Error("network request failed");
          return { exists: () => true, data: () => c.data, metadata: { fromCache: !!c.fromCache } };
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

// src/services/imagenesBot.ts
var imagenesBot_exports = {};
__export(imagenesBot_exports, {
  LIMITES_IMAGEN_BOT: () => LIMITES_IMAGEN_BOT,
  TIPOS_IMAGEN_BOT: () => TIPOS_IMAGEN_BOT,
  escucharImagenesBot: () => escucharImagenesBot,
  restablecerImagenBot: () => restablecerImagenBot,
  subirImagenBot: () => subirImagenBot
});
module.exports = __toCommonJS(imagenesBot_exports);
var import_firebase = __toESM(require_stub_firebase_app(), 1);
var import_firestore = __toESM(require_stub_config_fx(), 1);
var TIPOS_IMAGEN_BOT = [
  {
    tipo: "inicio_ruta",
    etiqueta: "\u{1F680} Disparo \xB7 inicio de ruta",
    desc: "La imagen del broadcast: cuando disparas el inicio de ruta a los clientes seleccionados.",
    archivoOriginal: "inicio_ruta.jpg",
    plantillaVinculada: "iniciarRuta"
  },
  {
    tipo: "ridertrack",
    etiqueta: "\u{1F4E6} Entrega completada",
    desc: "El reporte con imagen que confirma la entrega al cliente.",
    archivoOriginal: "ridertrack_reportes.png",
    plantillaVinculada: "entregaCompletada"
  },
  {
    tipo: "mate",
    etiqueta: "\u{1F477} Grupo MATE \xB7 Reportes",
    desc: "La imagen que acompa\xF1a los REPORTES al grupo de trabajo (los mensajes normales del chat van sin imagen desde F3.59).",
    archivoOriginal: "mate_gracias.png",
    plantillaVinculada: "\u2014"
  },
  {
    tipo: "solicitar_ubicacion",
    etiqueta: "\u{1F4CD} Pedir ubicaci\xF3n",
    desc: "Cuando le pides al cliente que mande su ubicaci\xF3n.",
    archivoOriginal: "solicitar_ubicacion.jpg",
    plantillaVinculada: "solicitarUbicacion"
  },
  {
    tipo: "llegando_pronto",
    etiqueta: "\u23F0 Llegando pronto",
    desc: 'El aviso de "ya estoy llegando" con imagen.',
    archivoOriginal: "llegando_pronto.jpg",
    plantillaVinculada: "avisarLlegada"
  },
  {
    // ⚡ FASE 3.59 — pedido del usuario: la plantilla de "mi
    // posición en la ruta" iba en texto pelado. Ahora puede llevar
    // imagen: sube una acá y el robot la manda con el texto de la
    // plantilla "a qué hora llegas" (horaLlegada).
    tipo: "mi_posicion",
    etiqueta: "\u{1F9ED} Mi posici\xF3n en la ruta",
    desc: 'El mensaje que le dice al cliente en qu\xE9 punto de tu ruta est\xE1 hoy ("voy en el 3 de 8"). Sube una imagen y el bot la manda con el texto de la plantilla de la hora de llegada.',
    archivoOriginal: "mi_posicion.jpg",
    plantillaVinculada: "horaLlegada"
  }
];
var MAX_BYTES = 3 * 1024 * 1024;
var LIMITES_IMAGEN_BOT = {
  /** tope por intento de subida (antes: colgado infinito) */
  topeMs: 75e3,
  /** espera entre el intento fallido y el reintento */
  reintentoMs: 2e3,
  /** presupuesto de la foto comprimida (~300 KB de JPEG) */
  presupuestoBytes: 3e5
};
function conTope(p, ms, centinela) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(centinela)), ms);
    p.then(
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
async function comprimirImagenBot(file) {
  if (file.size <= LIMITES_IMAGEN_BOT.presupuestoBytes) return file;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagen inv\xE1lida"));
      img.onload = () => {
        let { width, height } = img;
        const escalones = [
          [1e3, 0.82],
          [900, 0.72],
          [800, 0.62],
          [700, 0.52]
        ];
        let ultima = "";
        for (const [lado, calidad] of escalones) {
          let w = width;
          let h = height;
          if (w > lado || h > lado) {
            if (w >= h) {
              h = Math.round(h * lado / w);
              w = lado;
            } else {
              w = Math.round(w * lado / h);
              h = lado;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("No se pudo comprimir (canvas)"));
            return;
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          ultima = canvas.toDataURL("image/jpeg", calidad);
          if (ultima.length <= LIMITES_IMAGEN_BOT.presupuestoBytes * 1.37) break;
        }
        resolve(ultima);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  if (!dataUrl) return file;
  const bin = atob(dataUrl.split(",")[1] || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const nombre = (file.name || "imagen.jpg").replace(/\.[^.]+$/, "") + ".jpg";
  return new File([bytes], nombre, { type: "image/jpeg" });
}
async function subirImagenBot(uid, tipo, fileOriginal) {
  if (!import_firebase.db) throw new Error("Firestore no inicializado");
  if (!import_firebase.storage) throw new Error("Storage no inicializado");
  if (!fileOriginal.type.startsWith("image/")) {
    throw new Error("El archivo tiene que ser una imagen (JPG, PNG o WebP)");
  }
  if (fileOriginal.size > MAX_BYTES) {
    throw new Error(
      `La imagen pesa ${(fileOriginal.size / 1024 / 1024).toFixed(1)} MB \u2014 m\xE1ximo 3 MB (WhatsApp la comprime igual)`
    );
  }
  const file = await comprimirImagenBot(fileOriginal);
  const ext = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp" ? (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") : "jpg";
  const mimetype = file.type || "image/jpeg";
  const timestamp = Date.now();
  const storagePath = `campanas/imagenes_bot/${uid}/${tipo}_${timestamp}.${ext}`;
  const intentar = async () => {
    const refImg = (0, import_firebase.storageRef)(import_firebase.storage, storagePath);
    await conTope(
      (0, import_firebase.uploadBytes)(refImg, file, {
        contentType: mimetype,
        customMetadata: {
          uid,
          tipo,
          fase: "AK"
        }
      }),
      LIMITES_IMAGEN_BOT.topeMs,
      "sin-conexion"
    );
    return await conTope((0, import_firebase.getDownloadURL)(refImg), LIMITES_IMAGEN_BOT.topeMs, "sin-conexion");
  };
  let url = "";
  try {
    url = await intentar();
  } catch (e1) {
    const msg = String(e1?.message || e1 || "");
    const esDefinitivo = /unauthorized|unauthenticated|quota|canceled|cancelled|retry-limit/i.test(msg);
    if (esDefinitivo) throw e1;
    await new Promise((r) => setTimeout(r, LIMITES_IMAGEN_BOT.reintentoMs));
    try {
      url = await intentar();
    } catch (e2) {
      throw new Error(
        `La subida no lleg\xF3 al servidor (${String(e2?.message || e2).slice(0, 60)}) \u2014 la se\xF1al anda floja. Ya est\xE1 comprimida (${Math.round(file.size / 1024)} KB): prob\xE1 otra vez con mejor se\xF1al`
      );
    }
  }
  await conTope(
    (0, import_firestore.setDoc)((0, import_firestore.doc)(import_firebase.db, "imagenes_bot", tipo), {
      url,
      storagePath,
      mimetype,
      nombre: file.name,
      pesoKb: Math.round(file.size / 1024),
      subidoPor: uid,
      actualizadoEn: (/* @__PURE__ */ new Date()).toISOString()
    }),
    LIMITES_IMAGEN_BOT.topeMs,
    "sin-conexion"
  ).catch((e) => {
    throw new Error(
      `La imagen subi\xF3 pero no pude avisarle al bot (${String(e?.message || e).slice(0, 60)}) \u2014 toc\xE1 Reintentar o volv\xE9 a subirla`
    );
  });
  console.log(
    `\u{1F5BC}\uFE0F Imagen del bot actualizada: ${tipo} \u2192 ${storagePath} (${Math.round(file.size / 1024)} KB${file.size < fileOriginal.size ? `, comprimida de ${Math.round(fileOriginal.size / 1024)} KB` : ""})`
  );
  return { url, pesoKb: Math.round(file.size / 1024), comprimida: file.size < fileOriginal.size };
}
function escucharImagenesBot(callback) {
  if (!import_firebase.db) {
    callback({});
    return () => void 0;
  }
  return (0, import_firestore.onSnapshot)(
    (0, import_firestore.collection)(import_firebase.db, "imagenes_bot"),
    (snap) => {
      const mapa = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data?.url) {
          mapa[d.id] = {
            tipo: d.id,
            url: String(data.url),
            storagePath: String(data.storagePath || ""),
            mimetype: String(data.mimetype || "image/jpeg"),
            nombre: String(data.nombre || ""),
            subidoPor: String(data.subidoPor || ""),
            actualizadoEn: String(data.actualizadoEn || "")
          };
        }
      });
      callback(mapa);
    },
    (e) => {
      console.warn("[imagenesBot] listener:", e.message);
      callback({});
    }
  );
}
async function restablecerImagenBot(tipo) {
  if (!import_firebase.db) throw new Error("Firestore no inicializado");
  await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(import_firebase.db, "imagenes_bot", tipo));
  console.log("\u21A9\uFE0F Imagen del bot restablecida a la local:", tipo);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LIMITES_IMAGEN_BOT,
  TIPOS_IMAGEN_BOT,
  escucharImagenesBot,
  restablecerImagenBot,
  subirImagenBot
});
