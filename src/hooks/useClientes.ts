// ═══════════════════════════════════════════════════════════
// 📋 HOOK useClientes - RiderTrack V2
// Maneja la lista de clientes del día desde Firestore
// CON SINCRONIZACIÓN BIDIRECCIONAL CON RIDERTRACK MODULAR
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Cliente,
  guardarClientes,
  importarExcel,
  subscribeToRutaActiva,
  subscribeToClientesRegistrados,
  actualizarClienteEnRutaActiva,
  publicarClientesEnRutaActiva,
  finalizarRuta,
  limpiarRutaSinGuardar,
  subirFotoEntrega,
  encolarAccionBot,
  _botCel,
  guardarAutoBackupVivo,
  // 📅 FASE AD: cola de reprogramados + última ruta cerrada
  guardarReprogramados,
  // 🆕 AE-2: la ✕ toca cola+última en UNA escritura (sin re-migración)
  guardarColaYUltima,
  subscribeToReprogramados,
  leerUltimaRuta,
  guardarUltimaCerrada,
} from '../services/firestore';
// 📅 FASE AD: motor puro — la cola se guarda en usuarios/{uid}
// (mismo doc que la ruta) y las fechas viajan como parámetro.
import {
  type Reprogramado,
  type UltimaCerrada,
  autoColaAlCerrar,
  clienteParaRuta,
  coinciden,
  esEntregado,
  quitarDeCola,
  // 🆕 FASE AD-2: fallidos a la listita + auto-limpieza
  purgarCola,
  migrarFallidos,
  // 🆕 FASE AE-2: fecha Lima del historial (heal del respaldo)
  fechaLimaDe,
} from '../services/reprog';
import {
  batchGeocodificar,
  obtenerPosicionActual,
  recordarCoordenadasCliente,
  coordenadasRecordadas,
  Coordenadas,
} from '../services/geocoding';
import {
  optimizarOrden,
  distanciaRutaKm,
  LIMA_CENTRO,
  PuntoGeo,
  OpcionesRuta,
} from '../services/routeOptimizer';
import {
  optimizarConDirections,
  guardarRutaOptimizada,
  firmaRuta as firmaRutaGoogle,
} from '../services/googleDirections';
import { getGoogleApiKey } from '../services/googleMaps';
import { useAuth } from './useAuth';
import type { ConfigRuta } from '../services/firestore';
// 🙏 F3.44 → F3.46: "gracias por tu compra" automático
// (regla: CADA método de pago dispara, UNA vez por cliente)
import { ST_ENTREGADOS } from '../utils/cajaCore';
import {
  modoAvisoDe,
  claveAviso,
  registrarAvisoEnviado,
  avisoEnviadoHacePoco,
  decidirGracias,
} from '../utils/avisoEntrega';

/** Resultado detallado de la optimización (para mostrar en UI) */
export interface ResultadoOptimizarRuta {
  total: number;              // clientes totales
  conUbicacion: number;       // clientes ordenados por distancia real
  sinUbicacion: number;       // clientes sin dirección geocodificable
  geocodificadosAhora: number;// direcciones ubicadas en esta corrida
  desdeCache: number;         // direcciones que ya estaban en caché
  aproximados: number;        // ubicados solo a nivel de distrito (aprox)
  distanciaAntesKm: number;
  distanciaDespuesKm: number;
  ahorroPct: number;          // % de km ahorrados
  tiempoEstimadoMin: number;
  origen: 'inicio' | 'gps' | 'lima';  // desde dónde se partió
  conFin: boolean;            // si la ruta termina en una dirección fija
  /** Fase 2.0: cómo se optimizó */
  motor: 'google' | 'local';
}

interface ClienteGeo extends PuntoGeo {
  cliente: Cliente;
}

export function useClientes() {
  const { user, profile } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  // 📅 FASE AD: cola de reprogramados + snapshot de la última ruta
  // cerrada. Viven en usuarios/{uid} (tiempo real) con espejo local
  // para el arranque instantáneo/sin conexión.
  const [reprogramados, setReprogramados] = useState<Reprogramado[]>([]);
  const [ultimaCerrada, setUltimaCerrada] = useState<UltimaCerrada | null>(null);
  /** llegó ya el primer snapshot de Firestore (no pisar el espejo local antes) */
  const reprogSyncedRef = useRef(false);
  /** snapshot vivo de la última CERRADA — para el respaldo del historial */
  const ultimaCerradaRef = useRef<UltimaCerrada | null>(null);

  // Refs para guardar los datos de cada listener por separado
  const clientesRutaRef = useRef<Cliente[]>([]);
  const clientesRegistradosRef = useRef<Cliente[]>([]);
  // ¿Existe el doc ruta_activa? (Fase 2.6 fix): si EXISTE, es la
  // autoridad AUNQUE esté vacío (ruta cerrada → lista limpia, como
  // la v1 tras cerrar()). Solo si NO existe se muestra el respaldo
  // de clientes_registrados.
  const rutaExisteRef = useRef<boolean | null>(null);
  const actualizandoDesdeV2 = useRef(false);

  // 🔄 Combinar clientes de ambas fuentes
  const combinarClientes = useCallback(() => {
    // Rehidratar coordenadas desde el caché local (Fase 1.4):
    // si el Modular/bot reescribió ruta_activa sin lat/lng, las
    // coordenadas vuelven al instante (offline, sin re-geocodificar).
    const rehidratar = (lista: Cliente[]): Cliente[] =>
      lista.map((c) => {
        if (typeof c.lat === 'number' && typeof c.lng === 'number') {
          return c;
        }
        const recordadas = coordenadasRecordadas(c.id);
        if (recordadas) {
          return { ...c, lat: recordadas.lat, lng: recordadas.lng, latSrc: recordadas.src };
        }
        return c;
      });

    // 🧹 Fase 2.6 (fix cierre v1): si el doc ruta_activa EXISTE, su
    // lista manda — aunque esté VACÍA (ruta finalizada/limpia: hay
    // que empezar el día con la lista en blanco, como la v1).
    // El respaldo (clientes_registrados) solo se usa si el doc
    // ruta_activa no existe (cuenta nueva / nunca hubo ruta).
    if (rutaExisteRef.current === true) {
      setClientes(rehidratar(clientesRutaRef.current));
      setLoading(false);
      return;
    }
    // Doc inexistente o aún desconocido → respaldo si lo hay
    if (clientesRegistradosRef.current.length > 0) {
      setClientes(rehidratar(clientesRegistradosRef.current));
      setLoading(false);
      return;
    }
    setClientes(rehidratar(clientesRutaRef.current));
    setLoading(false);
  }, []);

  // 🔄 Escuchar AMBAS colecciones del Modular:
  // 1. ruta_activa (ruta del día actual)
  // 2. clientes_registrados (todos los clientes históricos)
  useEffect(() => {
    if (!user) {
      setClientes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Escuchar ruta_activa (clientes del día actual)
    const unsubRuta = subscribeToRutaActiva(
      (clientesModular, meta) => {
        clientesRutaRef.current = clientesModular;
        if (typeof meta?.existe === 'boolean') {
          rutaExisteRef.current = meta.existe;
        }
        if (!actualizandoDesdeV2.current) {
          combinarClientes();
        } else {
          actualizandoDesdeV2.current = false;
        }
      },
      () => setLoading(false)
    );

    // 2. Escuchar clientes_registrados (todos los clientes históricos)
    const unsubRegistrados = subscribeToClientesRegistrados(
      (clientesRegistrados) => {
        clientesRegistradosRef.current = clientesRegistrados;
        if (!actualizandoDesdeV2.current) {
          combinarClientes();
        }
      },
      () => setLoading(false)
    );

    return () => {
      unsubRuta();
      unsubRegistrados();
    };
  }, [user, combinarClientes]);

  // ═══ 📅 FASE AD: suscripción de la COLA + ÚLTIMA CERRADA ═══
  // Espejo local para pintar instantáneo al abrir; el snapshot de
  // Firestore es la verdad apenas llega (reprogSyncedRef evita que
  // un snapshot vacío inicial pise un espejo local recién escrito).
  // 📅 FASE AD: la clave del espejo local va dentro del efecto
  useEffect(() => {
    if (!user) {
      setReprogramados([]);
      setUltimaCerrada(null);
      reprogSyncedRef.current = false;
      ultimaCerradaRef.current = null;
      return;
    }
    // arranque desde el espejo local (offline / primer render) — SOLO la
    // cola (ultimaCerrada no se espeja: el snapshot/respaldo la traen
    // fresca siempre — propagarla la volvía eterna entre sesiones)
    try {
      const crudo = localStorage.getItem(`rt_reprog_${user.uid}`);
      if (crudo && !reprogSyncedRef.current) {
        const espejo = JSON.parse(crudo) as { cola?: Reprogramado[] };
        setReprogramados(espejo.cola || []);
      }
    } catch { /* espejo corrupto → ignora */ }

    const unsub = subscribeToReprogramados(
      user.uid,
      (cola, ultima) => {
        reprogSyncedRef.current = true;
        setReprogramados(cola);
        // el snapshot del doc SIEMPRE manda (bug del E2E: antes el
        // respaldo local se pisaba con null en cada escritura; ahora
        // el respaldo se MIGRA al doc apenas se lee → el snapshot lo
        // sostiene solo). Parpadeo posible solo la primera vez.
        setUltimaCerrada(ultima);
        ultimaCerradaRef.current = ultima;
        try {
          localStorage.setItem(`rt_reprog_${user.uid}`, JSON.stringify({ cola }));
        } catch { /* cuota llena → solo Firestore */ }
      },
      () => { /* sin permiso/ offline: queda el espejo local */ }
    );

    // Respaldo + MIGRACIÓN: rutas cerradas con versiones ANTERIORES a
    // la FASE AD no escribieron ultimaCerrada en el doc → se lee la
    // última del historial UNA vez, se muestra y se MIGRA al doc (el
    // snapshot posterior la sostiene; sin migrar, cada escritura del
    // doc la borraba de la pantalla — bug real encontrado en el E2E).
    // 🆕 AE-2 — HEAL: TAMBIÉN cuando el doc YA tiene una ultimaCerrada
    // VIEJA (más antigua que la última ruta del historial) se corrige:
    // el respaldo viejo ordenaba por UTC y podía quedar "una ruta
    // atrás" (Rudy: "registra del 15 y mi historial llega al 16") o
    // un cierre pudo escribir el historial y fallar la escritura del
    // doc (offline). Mismo costo: una lectura light al abrir la app.
    void (async () => {
      try {
        const reg = await leerUltimaRuta(user.uid);
        if (!reg || !(reg.clientes || []).length) return;
        const noEnt = reg.clientes.filter((c) => c && c.nombre && !esEntregado(c.st));
        if (noEnt.length === 0) return;
        // fecha Lima REAL del cierre (finalizadaAt miente por UTC:
        // 22:00 Lima = 03:00 UTC del día siguiente)
        const regFecha = fechaLimaDe(reg.finalizadaAt || reg.iniciadaAt) || reg.fecha || '';
        if (!regFecha) return;
        const docFecha = ultimaCerradaRef.current?.fecha || '';
        // solo si NO hay doc, o si el doc quedó VIEJO (una ruta atrás)
        if (ultimaCerradaRef.current && regFecha <= docFecha) return;
        const uc: UltimaCerrada = { fecha: regFecha, noEntregados: noEnt };
        ultimaCerradaRef.current = uc;
        setUltimaCerrada(uc);
        // 📅 migración: persistir para que el snapshot la sostenga
        void guardarUltimaCerrada(user.uid, uc);
      } catch { /* respaldo best-effort */ }
    })();

    return unsub;
    // CLAVE_REPROG intencional: solo re-suscribir al cambiar de usuario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /** Guarda la cola (estado + espejo local + Firestore merge) */
  /** Fecha de HOY en Lima (la misma regla de stats.hoyISO, sin import
   *  extra) — declarada ANTES de los efectos AD-2 que la usan */
  const hoyISOLocal = useCallback(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
    []
  );

  const persistirCola = useCallback(
    (nueva: Reprogramado[]) => {
      setReprogramados(nueva);
      reprogSyncedRef.current = true; // optimista: lo local manda hasta el snapshot
      if (user) {
        try {
          localStorage.setItem(`rt_reprog_${user.uid}`, JSON.stringify({ cola: nueva }));
        } catch { /* cuota */ }
        void guardarReprogramados(user.uid, nueva);
      }
    },
    [user]
  );

  // ═══ 🆕 FASE AD-2: AUTO-CUIDADO DE LA LISTITA — UN solo efecto
  // (migrar fallidos de la última cerrada → purgar resueltos y
  // expirados). Van JUNTOS y en ese orden para que la purga nunca
  // PISE lo que la migración acaba de escribir: ambos pasos leen
  // el MISMO estado del render y escriben UNA sola vez.
  //   · MIGRAR — Rudy (18 oct): "cuando pongo fallido porque no sé
  //     si lo van a reprogramar... los clientes fallidos también
  //     que estén en la listita": los fallidos de la última ruta
  //     cerrada (que solo recordaba el banner B) entran a la cola.
  //     Idempotente: devuelve la MISMA referencia si no hay nada.
  //   · 🧹 PURGAR — "se iba acumulando... darle un tiempo prudencial,
  //     no sé, tres cinco días... si no sale el programa el cliente
  //     se borra automáticamente": RESUELTOS (el cliente ya volvió
  //     en la lista de hoy — el Excel nuevo lo trajo) salen de la
  //     listita; EXPIRADOS (más de 5 días sin volver) se borran
  //     solos. Silencioso por diseño (como el respaldo vivo F3.53):
  //     la nota "se limpian solos a los 5 días" vive en el panel.
  useEffect(() => {
    if (!user) return;
    // espera el snapshot real (no pisar la nube con el espejo vacío)
    if (!reprogSyncedRef.current) return;
    if (reprogramados.length === 0 && !ultimaCerrada) return;
    try {
      // 1) fallidos de la última cerrada → listita
      const migrada = migrarFallidos(ultimaCerrada, reprogramados);
      // 2) resueltos y expirados → fuera
      const { vivos } = purgarCola(migrada, hoyISOLocal(), clientes);
      if (migrada !== reprogramados || vivos.length !== migrada.length) {
        persistirCola(vivos);
      }
    } catch { /* best-effort: nunca rompe la app */ }
  }, [user, reprogramados, ultimaCerrada, clientes, persistirCola, hoyISOLocal]);

  // Guardar clientes en ruta_activa Y en V2 (respaldo)
  const guardar = useCallback(async (nuevosClientes: Cliente[]) => {
    if (!user) return;
    actualizandoDesdeV2.current = true;
    setClientes(nuevosClientes);
    // Recordar coordenadas por cliente (caché local anti-borrado)
    for (const c of nuevosClientes) {
      if (typeof c.lat === 'number' && typeof c.lng === 'number') {
        recordarCoordenadasCliente(c.id, { lat: c.lat, lng: c.lng, src: c.latSrc || 'nominatim' });
      }
    }
    // Publicar en ruta_activa PRIMERO (fuente de verdad del Modular)
    await publicarClientesEnRutaActiva(user.uid, nuevosClientes);
    // Guardar en V2 como respaldo
    await guardarClientes(user.uid, nuevosClientes);
  }, [user]);

  // Agregar un cliente
  const agregarCliente = useCallback((cliente: Cliente) => {
    const nuevos = [...clientes, cliente];
    guardar(nuevos);
  }, [clientes, guardar]);

  // ═══ 📅 FASE AD: ACCIONES DE REPROGRAMADOS ═══
  // (van DESPUÉS de agregarCliente/guardar — las de agregar usan
  // agregarCliente, que está declarado arriba; antes de esto daba
  // error de "usada antes de declarar".)

  /** Agenda un pedido para una fecha (botón 🔄 o tilde del reporte MATE) */
  const agendarReprogramado = useCallback(
    (cliente: Cliente, para: string) => {
      if (!cliente || !cliente.nombre) return;
      const nuevo: Reprogramado = {
        cliente,
        para,
        desde: hoyISOLocal(),
        creadoAt: new Date().toISOString(),
      };
      // si ya estaba agendado para OTRA fecha, se re-agenda (fuera la vieja)
      const sinVieja = reprogramados.filter((e) => !coinciden(e.cliente, cliente));
      persistirCola([...sinVieja, nuevo]);
    },
    [reprogramados, persistirCola, hoyISOLocal]
  );

  /** Pasa un agendado de la cola a la ruta de HOY (botón ➕ del banner) */
  const agregarDeCola = useCallback(
    (item: Reprogramado) => {
      const num = clientes.reduce((m, c) => Math.max(m, c.num || 0), 0) + 1;
      agregarCliente(clienteParaRuta(item.cliente, num, item.desde));
      persistirCola(reprogramados.filter((e) => e !== item));
    },
    [clientes, reprogramados, persistirCola, agregarCliente]
  );

  /** Pasa un NO ENTREGADO de la última ruta cerrada a hoy (➕ del banner B) */
  const agregarNoEntregado = useCallback(
    (cliente: Cliente, desde: string) => {
      const num = clientes.reduce((m, c) => Math.max(m, c.num || 0), 0) + 1;
      agregarCliente(clienteParaRuta(cliente, num, desde));
      // si por las dudas estaba en la cola, fuera también (misma persona)
      persistirCola(quitarDeCola(reprogramados, cliente));
    },
    [clientes, reprogramados, persistirCola, agregarCliente]
  );

  /** Descarta un agendado de la cola (✕)
   * 🆕 AE-2 (Rudy, 18 oct: "aprieto la x y no acciona nada… el nombre
   * desaparece y vuelve a aparecer en el mismo lugar"): el fallido
   * también vive en ultimaCerrada.noEntregados y el efecto de
   * auto-cuidado lo RE-MIGRABA apenas salía de la cola. Ahora la ✕
   * lo saca de las DOS (cola + snapshot de la última cerrada) y
   * persiste en UNA escritura atómica — el efecto nunca ve el
   * estado a medias. Si el mismo cliente falla de nuevo en una
   * ruta FUTURA, vuelve a entrar (correcto: es un fallo nuevo). */
  const descartarDeCola = useCallback(
    (item: Reprogramado) => {
      const cola = reprogramados.filter((e) => e !== item);
      const ultima = ultimaCerradaRef.current;
      let nuevaUltima: UltimaCerrada | null = ultima;
      if (ultima && (ultima.noEntregados || []).length) {
        const quedan = (ultima.noEntregados || []).filter(
          (c) => !c || !coinciden(c, item.cliente)
        );
        if (quedan.length !== (ultima.noEntregados || []).length) {
          nuevaUltima = { ...ultima, noEntregados: quedan };
        }
      }
      // los dos estados cambian EN BATCH (React 18): el efecto de
      // auto-cuidado ve la cola Y la última cerrada ya actualizadas
      setReprogramados(cola);
      reprogSyncedRef.current = true; // optimista: lo local manda hasta el snapshot
      if (user) {
        try {
          localStorage.setItem(`rt_reprog_${user.uid}`, JSON.stringify({ cola }));
        } catch { /* cuota */ }
        if (nuevaUltima !== ultima) {
          setUltimaCerrada(nuevaUltima);
          ultimaCerradaRef.current = nuevaUltima;
          void guardarColaYUltima(user.uid, cola, nuevaUltima);
        } else {
          void guardarReprogramados(user.uid, cola);
        }
      }
    },
    [reprogramados, user]
  );

  // Actualizar un cliente
  // (Fase 2.4: si un valor del cambio es explícitamente `undefined`,
  //  el campo se ELIMINA del cliente — ej: borrar lat/lng cuando el
  //  usuario cambia la dirección y hay que re-ubicarla. Firestore
  //  rechaza valores undefined, así que jamás viajan.)
  const actualizarCliente = useCallback((id: string | number, cambios: Partial<Cliente>) => {
    const nuevos = clientes.map(c => {
      if (c.id !== id) return c;
      const mezclado: Record<string, unknown> = { ...c, ...cambios };
      for (const k of Object.keys(mezclado)) {
        if (mezclado[k] === undefined) delete mezclado[k];
      }
      return mezclado as unknown as Cliente;
    });
    guardar(nuevos);
  }, [clientes, guardar]);

  // ✅ Registro web (Fase 2.6 — como la v1): marcar/desmarcar VARIOS
  // clientes a la vez ("Marcar todos" / "Limpiar" del panel de
  // Verificación). Un solo guardar → un solo write a Firestore.
  const marcarVerificacion = useCallback(
    (ids: Set<string | number>, valor: boolean) => {
      const nuevos = clientes.map((c) => (ids.has(c.id) ? { ...c, webReg: valor } : c));
      guardar(nuevos);
    },
    [clientes, guardar]
  );

  // Eliminar un cliente
  const eliminarCliente = useCallback((id: string | number) => {
    const nuevos = clientes.filter(c => c.id !== id);
    guardar(nuevos);
  }, [clientes, guardar]);

  // Cambiar estado (pago) - sincroniza con ruta_activa en tiempo real
  const cambiarEstado = useCallback((id: string | number, estado: string) => {
    const hora = estado !== 'pendiente' ? new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';
    const previa = clientes.find((c) => c.id === id) || null;

    // ═══ 🙏 FASE 3.46 — "GRACIAS POR TU COMPRA" AUTOMÁTICO ═══
    // REGLA (la que pediste): CADA VEZ que marques un método de
    // pago, el robot manda el mensajito — UNA SOLA vez por cliente.
    // El 3.44 exigía la transición "no entregado → entregado": si el
    // cliente ya venía entregado (repetiste la prueba, corregiste el
    // método o la data venía vieja) el disparo NUNCA salía. Ahora lo
    // que evita repetidos es el campo `graciasEnviado` de su ficha
    // (persistente) + el guard de 5 min. Si se calla, la app te dice
    // POR QUÉ con un toast — nunca más silencio misterioso.
    const clave = previa ? claveAviso(previa.cel) : null;
    const decision = decidirGracias(
      previa ? { cel: previa.cel, aviso: previa.aviso, graciasEnviado: previa.graciasEnviado } : null,
      estado,
      ST_ENTREGADOS,
      clave ? avisoEnviadoHacePoco(clave) : false
    );

    const nuevos = clientes.map(c => {
      if (c.id === id) {
        // 📅 FASE AD: si quedó ENTREGADO, las marcas de reprogramado
        // se limpian (ya no viene “mañana”: se entregó HOY) — se
        // ELIMINAN las claves, nunca undefined (Firestore lo rechaza).
        const limpio: Record<string, unknown> = {
          ...c,
          st: estado,
          hora,
          // El flag viaja con el MISMO guardado del st → persiste en
          // ruta_activa y en la ficha (no se pierde al reiniciar)
          ...(decision.dispara ? { graciasEnviado: true } : {}),
        };
        if (esEntregado(estado)) {
          delete limpio.reprogramadoPara;
          delete limpio.reprog;
          delete limpio.reprogDesde;
        }
        return limpio as unknown as Cliente;
      }
      return c;
    });
    guardar(nuevos);
    // 📅 FASE AD: entregado HOY → su agendado en la cola ya no tiene
    // sentido (nunca va a “volver” mañana) → sale de la cola.
    if (esEntregado(estado) && previa && reprogramados.length > 0) {
      const depurada = quitarDeCola(reprogramados, previa);
      if (depurada.length !== reprogramados.length) persistirCola(depurada);
    }
    // También actualizar en ruta_activa (optimistic update para que el Modular lo vea al instante)
    if (user) {
      actualizarClienteEnRutaActiva(user.uid, id, {
        st: estado,
        hora,
        ...(decision.dispara ? { graciasEnviado: true } : {}),
      });
    }

    if (user && previa && decision.dispara) {
      const tel = _botCel(previa.cel || '');
      const modo = modoAvisoDe(previa.aviso);
      if (tel && clave) {
        registrarAvisoEnviado(clave);
        void encolarAccionBot(user.uid, {
          tipo: 'avisar_entrega',
          clienteId: previa.id,
          telefono: tel,
          nombre: previa.nombre || 'Cliente',
          prod: previa.prod || '',
          cobrar: parseFloat(String(previa.cobrar || 0)),
          dir: previa.dir || '',
          dist: previa.dist || '',
          st: estado,
          rider: {
            nombre: profile?.nombre || 'Rudy',
            telefono: profile?.email || '',
            empresa: 'MATE',
          },
          modo_entrega: modo,
          enviar_imagen: modo === 'auto_imagen',
        }).catch(() => { /* el bot está caído: la acción queda encolada */ });
        // Toast en pantalla — App.tsx escucha y lo muestra en cualquier vista
        try {
          window.dispatchEvent(new CustomEvent('rt-aviso-entrega', {
            detail: { nombre: previa.nombre || 'Cliente', modo },
          }));
        } catch { /* defensivo */ }
      }
    } else if (previa && decision.motivo && decision.motivo !== 'no-entregado') {
      // 🙏 F3.46 — el disparo se calló y hay un motivo EXPENSABLE:
      // modo manual / ya le llegó / sin celular / anti doble. Mejor
      // un toast informativo que un silencio que nadie entiende.
      try {
        window.dispatchEvent(new CustomEvent('rt-aviso-skip', {
          detail: { motivo: decision.motivo, nombre: previa.nombre || 'Cliente' },
        }));
      } catch { /* defensivo */ }
    }
  }, [clientes, guardar, user, profile, reprogramados, persistirCola]);

  // Importar desde Excel - sincroniza con ruta_activa automáticamente
  const importarDesdeExcel = useCallback(async (file: File): Promise<number> => {
    if (!user) return 0;
    setSincronizando(true);
    try {
      const nuevos = await importarExcel(file);
      const todos = [...clientes, ...nuevos];
      await guardar(todos);
      return nuevos.length;
    } finally {
      setSincronizando(false);
    }
  }, [clientes, guardar, user]);

  // 🔄 Sincronización manual (botón "Sync")
  // Recarga forzada desde ruta_activa (donde está el Modular)
  const sincronizarDesdeModular = useCallback(async () => {
    if (!user) return 0;
    setSincronizando(true);
    try {
      // El listener de ruta_activa ya está activo, así que los clientes
      // del Modular ya están en el estado. Solo necesitamos forzar una
      // re-publicación para asegurar consistencia.
      if (clientes.length > 0) {
        await publicarClientesEnRutaActiva(user.uid, clientes);
        await guardarClientes(user.uid, clientes);
      }
      return clientes.length;
    } finally {
      setSincronizando(false);
    }
  }, [user, clientes]);

  // 🏁 FINALIZAR Y GUARDAR RUTA (= cerrar() de la v1):
  // historial + backup nube + lista LIMPIA para mañana.
  // (Fase 2.6 fix: antes dejaba la lista sucia "para consulta" y el
  //  usuario arrastraba los pedidos del día anterior.)
  // ⚡ F3.48: devuelve si el backup de la nube se pudo guardar —
  // para avisarle al usuario en vez de fallar en silencio.
  const finalizarRutaActual = useCallback(async (): Promise<{ ok: boolean; backupNube: boolean }> => {
    if (!user || clientes.length === 0) return { ok: false, backupNube: false };
    setSincronizando(true);
    try {
      // ⏱ Duración de la ruta según el cronómetro (como la v1:
      // acumulado + tramo en curso si sigue corriendo)
      let tiempoRutaMs = 0;
      try {
        const raw = localStorage.getItem(`rt_crono_${user.uid}`);
        if (raw) {
          const crono = JSON.parse(raw) as { activo: boolean; inicio: number | null; acumulado: number };
          tiempoRutaMs =
            (crono.acumulado || 0) +
            (crono.activo && crono.inicio ? Date.now() - crono.inicio : 0);
        }
      } catch {}

      const res = await finalizarRuta(user.uid, clientes, tiempoRutaMs || undefined);

      // 📅 FASE AD: los pedidos marcados 🔄 Reprogramado pasan SOLOS
      // a la cola (para su fecha o mañana si no tenían) — así no se
      // pierden al limpiar la lista. El snapshot de no entregados de
      // la ruta lo escribe finalizarRuta en usuarios.ultimaCerrada.
      try {
        const colaNueva = autoColaAlCerrar(clientes, hoyISOLocal(), reprogramados);
        // 🆕 AE-2: MISMA referencia cuando no hay nada que tocar (el
        // dedupe ciego de antes escribía igual; el refresh de desde
        // NO cambia el largo — el chequeo por largo se lo saltaba)
        if (colaNueva !== reprogramados) persistirCola(colaNueva);
      } catch { /* best-effort: nunca bloquea el cierre */ }

      // 🧹 Lista limpia YA (el listener lo confirmará con el doc vacío)
      setClientes([]);
      clientesRutaRef.current = [];

      // ⏱ Reset del cronómetro (v1: resetCronometro() al cerrar)
      try { localStorage.removeItem(`rt_crono_${user.uid}`); } catch {}
      window.dispatchEvent(new CustomEvent('rt-ruta-finalizada'));

      return { ok: true, backupNube: res.backupNube };
    } finally {
      setSincronizando(false);
    }
  }, [user, clientes, reprogramados, persistirCola, hoyISOLocal]);

  // 💾 GUARDAR Y CERRAR RUTA — Fase 2.6 (fix): ahora idéntico a
  // finalizarRutaActual (cerrar() de la v1). Antes guardaba en
  // clientes_registrados PERO NO en el historial y no limpiaba.
  const guardarYCerrarRutaActual = useCallback(async () => {
    return finalizarRutaActual();
  }, [finalizarRutaActual]);

  // ⚡ F3.53 — RESPALDO VIVO EN LA NUBE (cada 15 min):
  // mientras haya ruta activa, guarda un ÚNICO doc por día con el
  // estado más reciente (backups_v2/{uid}_{fecha}_auto, merge — no
  // acumula docs). Solo escribe si algo CAMBIÓ desde el último
  // respaldo (hash de estados/montos) → 0 writes extra si no hay
  // movimiento. Si el celu se pierde a media ruta, ese doc es el que
  // te salva en ☁️ Backups (chip “auto · vivo”).
  // Silencioso por diseño: los fallos (permisos/red) solo van a
  // consola — el aviso real de permisos está en el toast del cierre.
  useEffect(() => {
    if (!user) return;
    let hashUltimo = '';
    const INTERVALO_MIN = 15;
    const tic = async () => {
      try {
        const lista = clientesRutaRef.current;
        if (!lista || lista.length === 0) return;
        const hash = lista
          .map((c) => `${c.id}:${c.st}:${c.cobrar}`)
          .join('|');
        if (hash === hashUltimo) return; // sin cambios → no escribir
        const ok = await guardarAutoBackupVivo(user.uid, lista);
        if (ok) hashUltimo = hash;
      } catch {
        /* nunca romper la app por un respaldo */
      }
    };
    const t = setInterval(tic, INTERVALO_MIN * 60 * 1000);
    return () => clearInterval(t);
  }, [user]);

  // 🗑️ LIMPIAR SIN GUARDAR: vacía ruta_activa y estado local
  const limpiarRuta = useCallback(async () => {
    if (!user) return;
    setSincronizando(true);
    try {
      await limpiarRutaSinGuardar(user.uid);
      setClientes([]);
      return true;
    } finally {
      setSincronizando(false);
    }
  }, [user]);

  // 🚀 OPTIMIZAR RUTA (Fase 1.4 — distancia REAL con inicio/fin)
  // 1. Geocodifica las direcciones que faltan (cascada v1→v4 con
  //    caché y rate limit — nunca inventa coordenadas)
  // 2. Guarda las coordenadas en Firestore + caché local por cliente
  //    (no se vuelve a geocodificar la misma dirección jamás)
  // 3. Ordena con vecino-más-cercano + 2-opt desde tu dirección de
  //    inicio configurada (o GPS si no hay, o centro de Lima)
  // 4. Si configuraste una dirección de fin, la ruta TERMINA ahí
  //    (última parada fija). "Volver al inicio" = ciclo cerrado.
  // 5. Los que no se pudieron ubicar van al final, agrupados
  //    por distrito (comportamiento honesto, sin mentir)
  const optimizarRuta = useCallback(async (
    onProgress?: (mensaje: string) => void,
    rutaConfig?: ConfigRuta | null
  ): Promise<ResultadoOptimizarRuta | null> => {
    if (clientes.length === 0) return null;
    setSincronizando(true);
    try {
      // ── Paso 1: separar los que ya tienen coordenadas guardadas
      let conCoords: ClienteGeo[] = [];
      let sinCoords: Cliente[] = [];
      for (const c of clientes) {
        if (
          typeof c.lat === 'number' && typeof c.lng === 'number' &&
          !isNaN(c.lat) && !isNaN(c.lng)
        ) {
          conCoords.push({ lat: c.lat, lng: c.lng, cliente: c });
        } else {
          sinCoords.push(c);
        }
      }

      // ── Paso 2: geocodificar los que faltan (cascada v1→v4)
      let geocodificadosAhora = 0;
      let desdeCache = 0;
      let aproximados = 0;
      if (sinCoords.length > 0) {
        const items = sinCoords.map((c) => ({
          item: c,
          dir: c.dir || '',
          dist: c.dist || '',
        }));
        const { resueltos, fallidos, desdeCache: nCache, aproximados: nAprox } = await batchGeocodificar<Cliente>(
          items,
          onProgress
        );
        desdeCache = nCache;
        aproximados = nAprox;
        geocodificadosAhora = resueltos.size;
        resueltos.forEach((coords: Coordenadas, c: Cliente) => {
          conCoords.push({ lat: coords.lat, lng: coords.lng, cliente: { ...c, lat: coords.lat, lng: coords.lng, latSrc: coords.src } });
        });
        sinCoords = fallidos;
      }

      // ── Paso 3: punto de partida — prioridad:
      //    dirección de inicio configurada → GPS → centro de Lima
      const inicioCfg = rutaConfig?.inicio;
      let origen: 'inicio' | 'gps' | 'lima' = 'lima';
      let inicio: PuntoGeo = LIMA_CENTRO;

      if (inicioCfg && typeof inicioCfg.lat === 'number' && typeof inicioCfg.lng === 'number') {
        inicio = { lat: inicioCfg.lat, lng: inicioCfg.lng };
        origen = 'inicio';
      } else {
        onProgress?.('Obteniendo tu posición GPS…');
        const gps = await obtenerPosicionActual(5000);
        if (gps) {
          inicio = gps;
          origen = 'gps';
        }
      }

      // Fin de ruta (opcional): la última parada queda FIJA ahí
      const finCfg = rutaConfig?.fin;
      const fin: PuntoGeo | null =
        finCfg && typeof finCfg.lat === 'number' && typeof finCfg.lng === 'number'
          ? { lat: finCfg.lat, lng: finCfg.lng }
          : null;
      const opciones: OpcionesRuta = {
        fin,
        cerrarCiclo: !fin && !!rutaConfig?.volverAlInicio,
      };

      // ── Paso 4: distancia ANTES (orden actual) vs optimizada
      onProgress?.('Calculando la mejor ruta…');
      const distanciaAntesKm = conCoords.length > 0
        ? distanciaRutaKm(conCoords, inicio, opciones)
        : 0;

      // ── Paso 4b (Fase 2.0): Google Directions — CALLES REALES
      // Google ordena las paradas midiendo por calles de verdad
      // (sentidos, óvalos, vías expresas de Lima) y devuelve km/min
      // REALES + la geometría de la ruta para el mapa.
      let ordenFinal: Array<{ lat: number; lng: number; cliente: Cliente }>;
      let distanciaDespuesKm: number;
      let tiempoEstimadoMin: number;
      let motor: 'google' | 'local' = 'local';

      const claveGoogle = getGoogleApiKey();
      let resultadoGoogle = null as Awaited<ReturnType<typeof optimizarConDirections<ClienteGeo>>> | null;
      if (claveGoogle && conCoords.length >= 2 && conCoords.length <= 23) {
        resultadoGoogle = await optimizarConDirections<ClienteGeo>(
          conCoords,
          inicio,
          { fin, cerrarCiclo: opciones.cerrarCiclo },
          onProgress
        );
      }

      if (resultadoGoogle) {
        ordenFinal = resultadoGoogle.orden;
        distanciaDespuesKm = resultadoGoogle.distanciaKm;
        tiempoEstimadoMin = resultadoGoogle.tiempoMin;
        motor = 'google';
        // Guardar la geometría para que el mapa la tenga lista
        if (resultadoGoogle.puntos.length > 1) {
          guardarRutaOptimizada({
            puntos: resultadoGoogle.puntos,
            distanciaKm: resultadoGoogle.distanciaKm,
            tiempoMin: resultadoGoogle.tiempoMin,
            firma: firmaRutaGoogle(
              inicio,
              resultadoGoogle.orden.map((c) => ({ lat: c.lat, lng: c.lng })),
              fin
            ),
            ts: Date.now(),
          });
        }
      } else {
        // Optimizador local (vecino más cercano + 2-opt) — respaldo
        if (claveGoogle && conCoords.length >= 2) {
          onProgress?.('Google no respondió — optimizando localmente…');
        }
        const optimizado = optimizarOrden<ClienteGeo>(conCoords, inicio, opciones);
        ordenFinal = optimizado.orden;
        distanciaDespuesKm = optimizado.distanciaKm;
        tiempoEstimadoMin = optimizado.tiempoMin;
      }

      // ── Paso 5: sin ubicación al final, agrupados por distrito
      const sinUbicacionOrdenados = [...sinCoords].sort((a, b) => {
        const distA = (a.dist || '').toLowerCase().trim();
        const distB = (b.dist || '').toLowerCase().trim();
        if (distA && !distB) return -1;
        if (!distA && distB) return 1;
        return distA.localeCompare(distB);
      });

      const listaFinal: Cliente[] = [
        ...ordenFinal.map((cg) => cg.cliente),
        ...sinUbicacionOrdenados,
      ].map((c, idx) => ({ ...c, num: idx + 1 }));

      // ── Paso 6: persistir (nuevo orden + coordenadas nuevas)
      await guardar(listaFinal);

      const conUbicacion = ordenFinal.length;
      const ahorro = distanciaAntesKm > 0 && distanciaDespuesKm > 0
        ? Math.max(0, Math.round((1 - distanciaDespuesKm / distanciaAntesKm) * 100))
        : 0;

      return {
        total: listaFinal.length,
        conUbicacion,
        sinUbicacion: sinCoords.length,
        geocodificadosAhora,
        desdeCache,
        aproximados,
        distanciaAntesKm,
        distanciaDespuesKm,
        ahorroPct: ahorro,
        tiempoEstimadoMin,
        origen,
        conFin: !!fin,
        motor,
      };
    } finally {
      setSincronizando(false);
    }
  }, [clientes, guardar]);

  // ⬆️⬇️ MOVER CLIENTE: cambia el orden de un cliente (arriba/abajo)
  const moverCliente = useCallback((id: string | number, direccion: 'arriba' | 'abajo') => {
    const idx = clientes.findIndex(c => c.id === id);
    if (idx === -1) return;

    const nuevoIdx = direccion === 'arriba' ? idx - 1 : idx + 1;
    if (nuevoIdx < 0 || nuevoIdx >= clientes.length) return;

    const nuevos = [...clientes];
    const temp = nuevos[idx];
    nuevos[idx] = nuevos[nuevoIdx];
    nuevos[nuevoIdx] = temp;

    // Reasignar números de orden
    const conNuevoOrden = nuevos.map((c, i) => ({ ...c, num: i + 1 }));
    guardar(conNuevoOrden);
  }, [clientes, guardar]);

  // ✏️ EDITAR NÚMERO DE ORDEN: cambia manualmente el número de un cliente
  // y reorganiza los demás clientes según corresponda
  const editarNumeroOrden = useCallback((id: string | number, nuevoNum: number) => {
    if (!nuevoNum || nuevoNum < 1) return;
    const idx = clientes.findIndex(c => c.id === id);
    if (idx === -1) return;

    const maxNum = clientes.length;
    const numFinal = Math.min(Math.max(nuevoNum, 1), maxNum);

    // Si el nuevo número es igual al actual, no hacer nada
    if (numFinal === idx + 1) return;

    // Crear nueva lista: remover el cliente y reinsertarlo en la nueva posición
    const nuevos = [...clientes];
    const [clienteMovido] = nuevos.splice(idx, 1);
    nuevos.splice(numFinal - 1, 0, clienteMovido);

    // Reasignar números de orden
    const conNuevoOrden = nuevos.map((c, i) => ({ ...c, num: i + 1 }));
    guardar(conNuevoOrden);
  }, [clientes, guardar]);

  // 📷 GUARDAR FOTO DE ENTREGA: sube a Storage (o base64 de respaldo)
  // y actualiza el cliente con la URL de la foto
  const guardarFotoEntrega = useCallback(async (
    clienteId: string | number,
    file: File | Blob,
    dataUrlFallback?: string
  ): Promise<string> => {
    if (!user) throw new Error('No hay sesión activa');
    setSincronizando(true);
    try {
      // 1. Subir foto (Storage con fallback base64 si falla)
      const fotoUrl = await subirFotoEntrega(user.uid, clienteId, file, dataUrlFallback);

      // 2. Actualizar el cliente con la URL de la foto
      const nuevos = clientes.map(c =>
        c.id === clienteId ? { ...c, fotoUrl } : c
      );
      await guardar(nuevos);

      // 3. También actualizar en ruta_activa (sincronización con Modular)
      await actualizarClienteEnRutaActiva(user.uid, clienteId, { fotoUrl } as any);

      return fotoUrl;
    } finally {
      setSincronizando(false);
    }
  }, [user, clientes, guardar]);

  // Estadísticas
  const stats = useMemo(() => {
    const total = clientes.length;
    const entregados = clientes.filter(c =>
      ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st)
    ).length;
    const pendientes = clientes.filter(c => c.st === 'pendiente' || !c.st).length;
    // 📅 FASE AD: 'reprogramar' ahora cuenta como NO entregado — antes
    // quedaba en un limbo (ni pendiente ni fallido) y el contador del
    // header no cuadraba con el total. Es verdad: hoy no se entregó.
    const fallidos = clientes.filter(c =>
      ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta', 'reprogramar'].includes(c.st)
    ).length;

    const cobrado = clientes
      .filter(c => ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa', 'cambio'].includes(c.st))
      .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

    const porCobrar = clientes
      .filter(c => c.st === 'pendiente' || !c.st)
      .reduce((sum, c) => sum + parseFloat(String(c.cobrar || 0)), 0);

    return { total, entregados, pendientes, fallidos, cobrado, porCobrar, totalDia: cobrado + porCobrar };
  }, [clientes]);

  return {
    clientes,
    loading,
    sincronizando,
    stats,
    guardar,
    agregarCliente,
    actualizarCliente,
    marcarVerificacion,
    eliminarCliente,
    cambiarEstado,
    importarDesdeExcel,
    sincronizarDesdeModular,
    finalizarRutaActual,
    guardarYCerrarRutaActual,
    limpiarRuta,
    optimizarRuta,
    moverCliente,
    editarNumeroOrden,
    guardarFotoEntrega,
    // 📅 FASE AD: reprogramados
    reprogramados,
    ultimaCerrada,
    agendarReprogramado,
    agregarDeCola,
    agregarNoEntregado,
    descartarDeCola,
  };
}
