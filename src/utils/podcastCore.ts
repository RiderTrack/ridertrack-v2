// ═══════════════════════════════════════════════════════════
// 🎙️ PODCAST DE LA JORNADA — CORE (Fase 3.42 · paso 6, el final)
// "Tu día, contado como un programa de radio": la app narra el
// resumen del día (y de la semana) con la MISMA voz de la
// navegación (TTS nativo del APK + fallback web).
//
// Núcleo PURO, sin Firebase ni React ni window (mismo patrón
// que odometroCore / mantenimientoCore / cajaCore / resumenCore)
// → se testea con Node directamente.
//
// La plata NO se recalcula: el guion de HOY se arma sobre un
// ResumenDia de resumenCore (la misma fuente del mensaje de
// WhatsApp de la F3.41) → el podcast NUNCA puede decir números
// distintos a los que llegan al grupo MATE.
//
// La semana se arma con los CIERRES de caja (F3.39) + los días
// del odómetro (F3.35) — datos que ya viven en Firestore.
//
// Reglas de oro del guion (para que la voz suene natural):
//   · Nada de "S/", "·", "—" ni markdown → palabras completas
//   · "con" para los centavos (estilo peruano: "245 con 50")
//   · Frases cortas, separadas por punto → el TTS respira
//   · Lo que no aplica no se dice (día sin yape → sin yape)
// ═══════════════════════════════════════════════════════════

import { CierreCaja, Gasto, categoriaInfo } from './cajaCore';
import { ResumenDia, fechaLargaLocal } from './resumenCore';

// ── Tipos ─────────────────────────────────────────────────

/** Un "capítulo" del episodio (se habla de corrido) */
export interface SegmentoPodcast {
  id: string;
  /** título corto para la lista de capítulos */
  titulo: string;
  /** emoji del capítulo (dependency-free para el core) */
  icono: string;
  /** el texto EXACTO que se dice en voz alta */
  texto: string;
}

export interface GuionPodcast {
  tipo: 'hoy' | 'semana';
  titulo: string;
  subtitulo: string;
  fechaISO: string;
  segmentos: SegmentoPodcast[];
  /** true si no hay nada que contar (UI muestra estado vacío) */
  vacio: boolean;
}

/** Mantenimiento simplificado para el capítulo "La moto" */
export interface ItemMantLite {
  nombre: string;
  /** negativo = ya se pasó */
  kmRestantes?: number | null;
  /** negativo = días de atraso */
  diasRestantes?: number | null;
}

export interface MotoLite {
  vencidos: ItemMantLite[];
  porVencer: ItemMantLite[];
  proximo: ItemMantLite | null;
}

/** km de un día (del odómetro, para la semana) */
export interface DiaKm {
  fecha: string; // YYYY-MM-DD
  m: number;     // metros calibrados
}

/** Agregados de la ventana de 7 días */
export interface ResumenSemana {
  /** días con cierre o con km ≥ 500 m */
  diasTrabajados: number;
  /** días con cierre (los que aportan plata exacta) */
  diasConCierre: number;
  entregas: number;
  neto: number;
  gastos: number;
  kmM: number;
  /** cierre con mayor neto de la semana */
  mejorDia: { fecha: string; neto: number } | null;
  /** neto de los 7 días PREVIOS (null = sin datos) */
  netoSemanaAnterior: number | null;
}

// ── Números para la VOZ (no es lo mismo que para la vista) ─

function num(v: number | string | undefined | null): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/** Soles hablados: 245 → "245 soles" · 245.5 → "245 con 50 soles" */
export function solesVoz(n: number): string {
  const v = Math.abs(num(n));
  let entero = Math.floor(v);
  let cent = Math.round((v - entero) * 100);
  if (cent >= 100) {
    entero += 1;
    cent = 0; // 245.999 → "246 soles", no "245 con 100"
  }
  if (entero === 0 && cent === 0) return 'cero soles';
  if (cent > 0) return `${entero} con ${cent} soles`;
  return `${entero} soles`;
}

/** Kilómetros hablados: 42400 → "42 kilómetros" · 8400 → "8,4 kilómetros" · 300 → "300 metros" */
export function kmVoz(metros: number): string {
  const m = Math.max(0, num(metros));
  const km = m / 1000;
  if (m < 950) {
    if (m < 50) return 'cero kilómetros';
    return `${Math.round(m / 10) * 10} metros`;
  }
  if (km < 10) {
    const fixed = km.toFixed(1);
    return fixed.endsWith('.0') ? `${Math.round(km)} kilómetros` : `${fixed.replace('.', ',')} kilómetros`;
  }
  return `${Math.round(km)} kilómetros`;
}

/** ms hablados: 3h12m → "3 horas y 12 minutos" · 48m → "48 minutos" */
export function duracionVoz(ms: number): string {
  const totalMin = Math.max(0, Math.round(num(ms) / 60000));
  if (totalMin <= 0) return 'cero minutos';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return m === 1 ? 'un minuto' : `${m} minutos`;
  const horas = h === 1 ? 'una hora' : `${h} horas`;
  if (m <= 0) return horas;
  return `${horas} y ${m === 1 ? 'un minuto' : `${m} minutos`}`;
}

/** 12.4 → "12 por ciento" */
export function porcientoVoz(p: number): string {
  return `${Math.round(num(p))} por ciento`;
}

// ── Semana: la ventana y sus agregados ────────────────────

function hoyISOLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** iso → iso desplazado n días (n negativo = hacia atrás) */
export function agregarDiasISO(iso: string, n: number): string {
  try {
    const [y, m, d] = (iso || '').split('-').map(Number);
    if (!y || !m || !d) return iso || '';
    const f = new Date(y, m - 1, d + n);
    if (isNaN(f.getTime())) return iso || '';
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  } catch {
    return iso || '';
  }
}

/** true si la fecha ISO está en [desde, hasta] */
function isoEntre(iso: string, desde: string, hasta: string): boolean {
  return !!iso && iso >= desde && iso <= hasta;
}

/**
 * Agrega la ventana de 7 días (hoy incluido, 6 hacia atrás):
 * entregas/neto/gastos desde los CIERRES guardados (exactos),
 * km desde los días del odómetro, "trabajado" = cierre o km.
 */
export function resumenSemana(
  cierres: CierreCaja[],
  diasKm: DiaKm[],
  fechaRef?: string
): ResumenSemana {
  const hoy = fechaRef || hoyISOLocal();
  const hasta = hoy;
  const desde = agregarDiasISO(hoy, -6);
  const prevHasta = agregarDiasISO(hoy, -7);
  const prevDesde = agregarDiasISO(hoy, -13);

  const delRango = (cierres || []).filter((c) => isoEntre(c.fecha, desde, hasta));
  const previos = (cierres || []).filter((c) => isoEntre(c.fecha, prevDesde, prevHasta));

  let entregas = 0;
  let neto = 0;
  let gastos = 0;
  let mejorDia: { fecha: string; neto: number } | null = null;
  for (const c of delRango) {
    entregas += Math.max(0, Math.round(num(c.entregas)));
    neto += num(c.netoDelDia);
    gastos += num(c.gastosEfectivo) + num(c.gastosDigital);
    // OJO: se compara el neto DEL DÍA (no el acumulado)
    const netoDia = num(c.netoDelDia);
    if (!mejorDia || netoDia > mejorDia.neto) mejorDia = { fecha: c.fecha, neto: netoDia };
  }

  let kmM = 0;
  for (const d of diasKm || []) {
    if (isoEntre(d.fecha, desde, hasta)) kmM += Math.max(0, num(d.m));
  }

  // días trabajados: con cierre o con movimiento real (≥ 500 m)
  const fechasKm = new Set(
    (diasKm || []).filter((d) => isoEntre(d.fecha, desde, hasta) && num(d.m) >= 500).map((d) => d.fecha)
  );
  const fechasCierre = new Set(delRango.map((c) => c.fecha));
  const todas = new Set([...fechasKm, ...fechasCierre]);

  return {
    diasTrabajados: todas.size,
    diasConCierre: delRango.length,
    entregas,
    neto,
    gastos,
    kmM,
    mejorDia,
    netoSemanaAnterior: previos.length > 0 ? previos.reduce((s, c) => s + num(c.netoDelDia), 0) : null,
  };
}

// ── Capítulos reutilizables ───────────────────────────────

function fraseMantenimiento(it: ItemMantLite, estado: 'vencido' | 'acerca'): string {
  const km = it.kmRestantes;
  const dias = it.diasRestantes;
  if (km != null && km !== 0) {
    const abs = Math.abs(km);
    const kmTxt = abs < 10 ? `${abs.toFixed(1).replace('.', ',')} kilómetros` : `${Math.round(abs)} kilómetros`;
    return estado === 'vencido'
      ? `${it.nombre} está vencido, le pasan ${kmTxt}`
      : `${it.nombre} está por vencer, le quedan ${kmTxt}`;
  }
  if (dias != null && dias !== 0) {
    const abs = Math.abs(Math.round(dias));
    const dTxt = abs === 1 ? 'un día' : `${abs} días`;
    return estado === 'vencido'
      ? `${it.nombre} está vencido, hace ${dTxt}`
      : `${it.nombre} está por vencer, le quedan ${dTxt}`;
  }
  return `${it.nombre} está ${estado}`;
}

function textoMoto(moto: MotoLite): string {
  const frases: string[] = [];
  for (const v of (moto.vencidos || []).slice(0, 3)) frases.push(fraseMantenimiento(v, 'vencido'));
  for (const a of (moto.porVencer || []).slice(0, 3)) frases.push(fraseMantenimiento(a, 'acerca'));
  if (frases.length === 0) {
    const proxE = moto.proximo;
    if (proxE) {
      const extra =
        proxE.kmRestantes != null && proxE.kmRestantes > 0
          ? `, en unos ${Math.max(1, Math.round(proxE.kmRestantes))} kilómetros`
          : proxE.diasRestantes != null && proxE.diasRestantes > 0
            ? `, en unos ${Math.max(1, Math.round(proxE.diasRestantes))} días`
            : '';
      return `La moto está al día. El próximo control es ${proxE.nombre}${extra}.`;
    }
    return 'La moto está al día, sin nada pendiente.';
  }
  const union = frases.length === 1 ? frases[0] : `${frases.slice(0, -1).join('. ')} y ${frases[frases.length - 1]}`;
  const mas = (moto.vencidos?.length || 0) + (moto.porVencer?.length || 0) > frases.length
    ? `, y hay ${moto.vencidos.length + moto.porVencer.length - frases.length} pendientes más`
    : '';
  return `Ojo con la moto: ${union}${mas}. Cuando puedas, pásale por el taller.`;
}

/** gastos agregados por categoría, top 3 en texto hablado */
function textoGastos(gastos: Gasto[], total: number, n: number, cuando: string): string {
  const porCat = new Map<string, number>();
  for (const g of gastos || []) {
    const cat = String(g?.categoria || 'otros');
    porCat.set(cat, (porCat.get(cat) || 0) + Math.abs(num(g.monto)));
  }
  const top = [...porCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length === 0) return `Gastaste ${solesVoz(total)} ${cuando}.`;
  const partes = top.map(([cat, monto]) => {
    const nombre = categoriaInfo(cat).nombre.toLowerCase();
    return `${solesVoz(monto)} de ${nombre}`;
  });
  const union = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
  const nTxt = n > 1 ? `, en ${n} gastos` : '';
  return `Gastaste ${solesVoz(total)} ${cuando}${nTxt}: ${union}.`;
}

// ── EPISODIO DE HOY ───────────────────────────────────────

/**
 * El capítulo de hoy, en radio. Usa el ResumenDia de resumenCore
 * (la MISMA data del mensaje de WhatsApp F3.41).
 */
export function armarGuionHoy(
  r: ResumenDia,
  cierre: CierreCaja | null,
  riderNombre?: string,
  moto?: MotoLite | null
): GuionPodcast {
  const quien = (riderNombre || '').trim() || 'el rider';
  const c = r.conteo;
  const caja = r.caja;
  const segs: SegmentoPodcast[] = [];

  const vacio = c.total <= 0 && r.kmHoyM <= 0 && caja.cobradoTotal <= 0 && caja.nGastos <= 0;

  // 📻 Intro
  segs.push({
    id: 'intro',
    titulo: 'Intro',
    icono: '📻',
    texto: `RiderTrack Podcast. El capítulo de hoy, ${fechaLargaLocal(r.fechaISO)}, con ${quien}. Vamos con el repaso de la jornada.`,
  });

  if (vacio) {
    segs.push({
      id: 'vacio',
      titulo: 'Sin datos',
      icono: '🤷',
      texto: 'Hoy todavía no hay nada que contar. Cuando muevas la ruta, el dinero o los kilómetros, vuelve a escucharlo.',
    });
    segs.push({
      id: 'outro',
      titulo: 'Cierre',
      icono: '🏁',
      texto: 'Ese fue el capítulo de hoy. Nos escuchamos más tarde.',
    });
    return { tipo: 'hoy', titulo: 'Tu día', subtitulo: fechaLargaLocal(r.fechaISO), fechaISO: r.fechaISO, segmentos: segs, vacio: true };
  }

  // 📦 La ruta
  const ruta: string[] = [];
  if (c.total > 0) {
    const partes: string[] = [];
    if (c.entregados > 0) partes.push(`${c.entregados} entregados`);
    if (c.fallidos > 0) partes.push(`${c.fallidos} fallidos`);
    if (c.pendientes > 0) partes.push(`${c.pendientes} pendientes`);
    const como = partes.length > 0 ? `: ${partes.join(', ')}` : '';
    ruta.push(`Atendiste ${c.total} clientes${como}.`);
  } else {
    ruta.push('Hoy no registraste clientes en la ruta.');
  }
  if (c.pendientes > 0 && c.porCobrar > 0) {
    ruta.push(`Te quedan ${solesVoz(c.porCobrar)} por cobrar.`);
  }
  if (r.rutaMs > 0) {
    const refri = r.refriSeg >= 60 ? `, más ${duracionVoz(r.refriSeg * 1000)} de refrigerio` : '';
    ruta.push(`Estuviste en ruta ${duracionVoz(r.rutaMs)}${refri}.`);
  } else if (r.refriSeg >= 60) {
    ruta.push(`Tomaste ${duracionVoz(r.refriSeg * 1000)} de refrigerio.`);
  }
  if (r.kmHoyM > 0) {
    ruta.push(`Y recorriste ${kmVoz(r.kmHoyM)}.`);
  }
  segs.push({ id: 'ruta', titulo: 'La ruta', icono: '📦', texto: ruta.join(' ') });

  // 💵 La plata
  const plata: string[] = [];
  if (caja.cobradoTotal > 0) {
    if (caja.efectivoCobrado > 0) plata.push(`En efectivo cobraste ${solesVoz(caja.efectivoCobrado)}.`);
    if (caja.digitalRider > 0) plata.push(`Por Yape, ${solesVoz(caja.digitalRider)}.`);
    if (caja.empresa > 0) plata.push(`Y de la empresa, ${solesVoz(caja.empresa)}.`);
    plata.push(`En total, ${solesVoz(caja.cobradoTotal)} cobrados hoy.`);
  } else {
    plata.push('Hoy no se cobró nada.');
  }
  segs.push({ id: 'plata', titulo: 'La plata', icono: '💵', texto: plata.join(' ') });

  // 💸 Los gastos
  if (caja.nGastos > 0) {
    const detalle: Gasto[] = (cierre && cierre.gastos?.length ? cierre.gastos : r.gastosDetalle) || [];
    const totalG = caja.gastosEfectivo + caja.gastosDigital;
    segs.push({
      id: 'gastos',
      titulo: 'Los gastos',
      icono: '💸',
      texto: textoGastos(detalle, totalG, caja.nGastos, 'en el día'),
    });
  }

  // 🧮 La caja
  const cajaTxt: string[] = [];
  if (cierre) {
    const fondo = num(cierre.fondoInicial);
    if (fondo > 0) cajaTxt.push(`Arrancaste con ${solesVoz(fondo)} de fondo.`);
    cajaTxt.push(`Esperabas ${solesVoz(num(cierre.esperado))} en caja.`);
    const dif = num(cierre.diferencia);
    if (Math.abs(dif) <= 0.01) {
      cajaTxt.push(`Contaste ${solesVoz(num(cierre.contado))}, y cuadra exacto. Bien ahí.`);
    } else if (dif > 0) {
      cajaTxt.push(`Contaste ${solesVoz(num(cierre.contado))}, y te sobran ${solesVoz(dif)}.`);
    } else {
      cajaTxt.push(`Contaste ${solesVoz(num(cierre.contado))}, y te faltan ${solesVoz(Math.abs(dif))}.`);
    }
    cajaTxt.push(`El neto del día, después de gastos, es ${solesVoz(num(cierre.netoDelDia))}.`);
  } else {
    const fondoCalc = caja.esperado - caja.efectivoCobrado + caja.gastosEfectivo;
    if (fondoCalc > 0) cajaTxt.push(`Arrancaste con ${solesVoz(fondoCalc)} de fondo.`);
    cajaTxt.push(`La caja sigue abierta, todavía sin cierre. Hasta ahora se espera ${solesVoz(caja.esperado)} en caja.`);
    if (caja.netoDelDia !== 0) {
      cajaTxt.push(`El neto va en ${solesVoz(caja.netoDelDia)}.`);
    }
  }
  segs.push({ id: 'caja', titulo: 'La caja', icono: '🧮', texto: cajaTxt.join(' ') });

  // 🏍️ La moto (solo si mandaron el resumen de mantenimiento)
  if (moto) {
    segs.push({ id: 'moto', titulo: 'La moto', icono: '🏍️', texto: textoMoto(moto) });
  }

  // 🏁 Outro
  segs.push({
    id: 'outro',
    titulo: 'Cierre',
    icono: '🏁',
    texto: `Ese fue el día, ${quien}. Buen viaje de vuelta a casa. Nos escuchamos mañana.`,
  });

  return {
    tipo: 'hoy',
    titulo: 'Tu día',
    subtitulo: fechaLargaLocal(r.fechaISO),
    fechaISO: r.fechaISO,
    segmentos: segs,
    vacio: false,
  };
}

// ── EPISODIO DE LA SEMANA ─────────────────────────────────

/** El resumen de los últimos 7 días (cierres + odómetro) */
export function armarGuionSemana(
  cierres: CierreCaja[],
  diasKm: DiaKm[],
  riderNombre?: string,
  fechaRef?: string
): GuionPodcast {
  const quien = (riderNombre || '').trim() || 'el rider';
  const hoy = fechaRef || hoyISOLocal();
  const s = resumenSemana(cierres, diasKm, hoy);
  const desde = agregarDiasISO(hoy, -6);
  const segs: SegmentoPodcast[] = [];

  const vacio = s.diasTrabajados <= 0;

  segs.push({
    id: 'intro',
    titulo: 'Intro',
    icono: '📻',
    texto: `RiderTrack Podcast. El resumen de la semana, del ${fechaLargaLocal(desde)} al ${fechaLargaLocal(hoy)}.`,
  });

  if (vacio) {
    segs.push({
      id: 'vacio',
      titulo: 'Sin datos',
      icono: '🤷',
      texto: 'Esta semana todavía no hay nada que contar. Sin rutas, sin caja y sin kilómetros.',
    });
    segs.push({
      id: 'outro',
      titulo: 'Cierre',
      icono: '🏁',
      texto: 'Nos escuchamos cuando haya jornada que contar.',
    });
    return { tipo: 'semana', titulo: 'Tu semana', subtitulo: `${fechaLargaLocal(desde)} → ${fechaLargaLocal(hoy)}`, fechaISO: hoy, segmentos: segs, vacio: true };
  }

  // 📦 El trabajo
  const trabajo: string[] = [];
  trabajo.push(`Trabajaste ${s.diasTrabajados === 1 ? 'un día' : `${s.diasTrabajados} días`} esta semana.`);
  if (s.diasConCierre > 0) {
    trabajo.push(`Cerraste caja ${s.diasConCierre === 1 ? 'un día' : `${s.diasConCierre} días`}, con ${s.entregas === 1 ? 'una entrega' : `${s.entregas} entregas`} en total.`);
    trabajo.push(`El neto acumulado es ${solesVoz(s.neto)}.`);
  } else {
    trabajo.push('Todavía no hay cajas cerradas esta semana, así que no tengo la plata exacta.');
  }
  if (s.kmM > 0) trabajo.push(`En la moto, ${kmVoz(s.kmM)} recorridos.`);
  segs.push({ id: 'trabajo', titulo: 'El trabajo', icono: '📦', texto: trabajo.join(' ') });

  // 🏆 El mejor día
  if (s.mejorDia) {
    segs.push({
      id: 'mejor',
      titulo: 'El mejor día',
      icono: '🏆',
      texto: `Tu mejor día fue el ${fechaLargaLocal(s.mejorDia.fecha)}, con ${solesVoz(s.mejorDia.neto)}.`,
    });
  }

  // 📈 La comparación
  if (s.netoSemanaAnterior != null && s.netoSemanaAnterior > 0) {
    const delta = ((s.neto - s.netoSemanaAnterior) / s.netoSemanaAnterior) * 100;
    let frase: string;
    if (Math.abs(delta) < 1) {
      frase = 'prácticamente igual a la anterior.';
    } else if (delta > 0) {
      frase = `${porcientoVoz(delta)} más que la semana anterior. ¡Bien ahí!`;
    } else {
      frase = `${porcientoVoz(Math.abs(delta))} menos que la semana anterior.`;
    }
    segs.push({
      id: 'comparacion',
      titulo: 'La comparación',
      icono: '📈',
      texto: `Comparada con los 7 días previos, esta semana hiciste ${frase}`,
    });
  }

  // 💸 Los gastos
  if (s.gastos > 0) {
    // detalle agregado: los cierres guardan sus gastos congelados
    const gastosSemana: Gasto[] = [];
    const desdeISO = desde;
    for (const c of (cierres || [])) {
      if (isoEntre(c.fecha, desdeISO, hoy) && c.gastos) {
        for (const g of c.gastos) gastosSemana.push(g);
      }
    }
    segs.push({
      id: 'gastos',
      titulo: 'Los gastos',
      icono: '💸',
      texto: textoGastos(gastosSemana, s.gastos, gastosSemana.length, 'en la semana'),
    });
  }

  // 🏁 Outro
  segs.push({
    id: 'outro',
    titulo: 'Cierre',
    icono: '🏁',
    texto: `Esa fue la semana, ${quien}. Descansa bien, que mañana hay más capítulo. Nos escuchamos.`,
  });

  return {
    tipo: 'semana',
    titulo: 'Tu semana',
    subtitulo: `${fechaLargaLocal(desde)} → ${fechaLargaLocal(hoy)}`,
    fechaISO: hoy,
    segmentos: segs,
    vacio: false,
  };
}

// ── Estimaciones y progreso (para el reproductor) ─────────

/** caracteres por segundo que habla un TTS en español a rate 1 */
export const CHARS_POR_SEG = 13.5;

/** duración estimada de un texto hablado (segundos) */
export function estimarSegundos(texto: string, rate = 1): number {
  const len = String(texto || '').replace(/\s+/g, ' ').trim().length;
  if (len <= 0) return 0;
  return Math.max(1, Math.round(len / (CHARS_POR_SEG * Math.max(0.5, num(rate)))));
}

/** duración total estimada del guion (segundos) */
export function duracionEstimadaSeg(guion: GuionPodcast, rate = 1): number {
  return (guion.segmentos || []).reduce((s, seg) => s + estimarSegundos(seg.texto, rate), 0);
}

/**
 * Progreso 0..1 del guion: segmentos completados + avance por
 * caracteres dentro del segmento actual (onRangeStart).
 */
export function progresoGuion(guion: GuionPodcast, segIdx: number, charIdx: number): number {
  const lens = (guion.segmentos || []).map((s) => Math.max(1, String(s.texto || '').length));
  const total = lens.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const i = Math.min(Math.max(0, segIdx), lens.length - 1);
  const dentro = Math.min(Math.max(0, charIdx), lens[i]) / lens[i];
  const previos = lens.slice(0, i).reduce((a, b) => a + b, 0);
  return Math.min(1, (previos + dentro * lens[i]) / total);
}

/**
 * Texto desde el INICIO de la frase que contiene charIdx —
 * para reanudar el TTS nativo donde iba (la pausa nativa mata
 * la oración en curso: se repite la frase, no el capítulo).
 * Devuelve '' si charIdx ya llegó al final.
 */
export function recorteDesdeFrase(texto: string, charIdx: number): string {
  const t = String(texto || '');
  if (!t) return '';
  const idx = Math.min(Math.max(0, charIdx), t.length);
  if (idx >= t.length - 1) return '';
  // busca el inicio de la oración actual (punto, !, ? o … antes de idx)
  let inicio = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const ch = t[i];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '…') {
      inicio = i + 1;
      break;
    }
  }
  // si a la oración actual solo le quedan 2-3 letras (ya se dijo
  // casi toda), salta a la siguiente oración completa
  let fin = t.length;
  for (let i = inicio; i < t.length; i++) {
    const ch = t[i];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '…') {
      fin = i + 1;
      break;
    }
  }
  const restante = t.slice(idx, fin).trim();
  if (restante.length <= 3 && fin < t.length) {
    // ya se dijo casi toda la oración → arranca en la siguiente
    inicio = fin;
  }
  return t.slice(inicio).trim();
}
