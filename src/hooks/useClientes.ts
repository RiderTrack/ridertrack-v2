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
} from '../services/firestore';
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
        return {
          ...c,
          st: estado,
          hora,
          // El flag viaja con el MISMO guardado del st → persiste en
          // ruta_activa y en la ficha (no se pierde al reiniciar)
          ...(decision.dispara ? { graciasEnviado: true } : {}),
        };
      }
      return c;
    });
    guardar(nuevos);
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
  }, [clientes, guardar, user, profile]);

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
  }, [user, clientes]);

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
    const fallidos = clientes.filter(c =>
      ['fallida', 'rechazado', 'cancelado', 'ausente', 'no-contesta'].includes(c.st)
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
  };
}
