// ═══════════════════════════════════════════════════════════
// 📥 EXPORTAR EXCEL DE UNA RUTA DEL HISTORIAL — Fase 2.6
// Genera un .xlsx REAL (SheetJS ya viene en el proyecto para el
// importador) con las mismas secciones que el Excel de la v1:
//   💚 LO TUYO (cobros del día) → TOTAL LO TUYO
//   🏢 EMPRESA (transferencia/POS) → TOTAL EMPRESA
//   ⏳ FALLIDOS / SIN ATENDER → TOTAL
//   GRAN TOTAL + RESUMEN DEL DÍA
// Después lo comparte con el compartir nativo del celular
// (el usuario elige WhatsApp / Drive / etc.), y si no se puede,
// lo descarga directo.
// ═══════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import { RegistroHistorial } from '../services/firestore';
import { ETIQUETAS_ESTADO } from './realData';

export type ToastFn = (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

/** Métodos que pagan el rider (caja 💚 LO TUYO) */
const METODOS_RIDER = ['efectivo', 'yape-rudy', 'yape-efectivo', 'mixto', 'cambio'];
/** Métodos que paga la empresa (caja 🏢 EMPRESA) */
const METODOS_EMPRESA = ['pos', 'transferencia', 'yape-plin', 'pago-link', 'jose-smith', 'empresa'];

/** Monto que queda para el RIDER de un cliente (reglas de la v1) */
function montoRider(c: any): number {
  if (c.st === 'mixto') return parseFloat(String(c.mEf || 0));
  if (c.st === 'yape-efectivo') {
    return Math.max(0, parseFloat(String(c.mEf || 0)) + parseFloat(String(c.mYp || 0)) - parseFloat(String(c.mVt || 0)));
  }
  return parseFloat(String(c.cobrar || 0));
}

/** Monto que paga la EMPRESA de un cliente (reglas de la v1) */
function montoEmpresa(c: any): number {
  if (c.st === 'mixto') return parseFloat(String(c.mEmp || 0));
  return parseFloat(String(c.cobrar || 0));
}

/** Nombre de archivo, igual patrón que la v1: RutaDiaria_2026-08-28_20-30.xlsx */
function nombreArchivo(fecha: string): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `RutaDiaria_${fecha}_${hh}-${mm}.xlsx`;
}

/**
 * Genera y comparte el Excel de una ruta del historial.
 * Debe llamarse directo desde el tap del usuario (gesto) para que
 * el compartir nativo funcione.
 */
export async function exportarExcelRuta(
  r: RegistroHistorial,
  onShowToast?: ToastFn
): Promise<boolean> {
  const clientes: any[] = r.clientes || [];
  if (clientes.length === 0) {
    onShowToast?.('Sin clientes', 'Esta ruta no guardó el detalle de clientes para exportar', 'warning');
    return false;
  }

  try {
    // ── Armar la tabla (array de arrays) ──
    const aoa: (string | number)[][] = [];

    aoa.push([`RUTA DEL DÍA — ${r.fecha}`]);
    aoa.push([]);
    aoa.push(['N°', 'NOMBRE CLIENTE', 'DIRECCIÓN', 'DISTRITO', 'CELULAR', 'PRODUCTO', 'A COBRAR', 'FORMA DE PAGO', 'HORA', 'OBSERVACIONES', 'MOTIVO/REPORTE']);

    const filaCliente = (c: any, monto: number): (string | number)[] => [
      c.num ?? '',
      c.nombre || 'Cliente',
      c.dir || '',
      c.dist || '',
      c.cel || '',
      c.prod || '',
      monto,
      ETIQUETAS_ESTADO[c.st] || c.st || 'Pendiente',
      c.hora || '–',
      c.obs || c.nota || '',
      c.motivo || '',
    ];

    // 💚 LO TUYO
    const clTuyo = clientes.filter((c) => METODOS_RIDER.includes(c.st));
    let totTuyo = 0;
    aoa.push(['💚 LO TUYO — Cobros del día']);
    clTuyo.forEach((c) => {
      const m = montoRider(c);
      totTuyo += m;
      aoa.push(filaCliente(c, m));
    });
    if (clTuyo.length === 0) aoa.push(['Sin entregas']);
    aoa.push(['TOTAL LO TUYO', '', '', '', '', '', totTuyo]);
    aoa.push([]);

    // 🏢 EMPRESA
    const clEmpresa = clientes.filter((c) => METODOS_EMPRESA.includes(c.st) || (c.st === 'mixto' && parseFloat(String(c.mEmp || 0)) > 0));
    let totEmpresa = 0;
    aoa.push(['🏢 EMPRESA — Transferencia / POS']);
    clEmpresa.forEach((c) => {
      const m = montoEmpresa(c);
      totEmpresa += m;
      aoa.push(filaCliente(c, m));
    });
    if (clEmpresa.length === 0) aoa.push(['Sin entregas de empresa']);
    aoa.push(['TOTAL EMPRESA', '', '', '', '', '', totEmpresa]);
    aoa.push([]);

    // ⏳ FALLIDOS / SIN ATENDER
    const clOtros = clientes.filter((c) => !METODOS_RIDER.includes(c.st) && !METODOS_EMPRESA.includes(c.st));
    let totOtros = 0;
    if (clOtros.length > 0) {
      aoa.push(['⏳ FALLIDOS / SIN ATENDER — No entregados']);
      clOtros.forEach((c) => {
        const m = parseFloat(String(c.cobrar || 0));
        totOtros += m;
        aoa.push(filaCliente(c, m));
      });
      aoa.push(['TOTAL FALLIDOS', '', '', '', '', '', totOtros]);
      aoa.push([]);
    }

    // GRAN TOTAL
    aoa.push(['GRAN TOTAL DEL DÍA', '', '', '', '', '', totTuyo + totEmpresa]);
    aoa.push([]);

    // RESUMEN
    aoa.push(['📊 RESUMEN DEL DÍA']);
    aoa.push(['👥 Clientes totales', clientes.length]);
    aoa.push(['✅ Entregados', r.entregados || (clTuyo.length + clEmpresa.length)]);
    aoa.push(['⏳ Sin atender', r.pendientes || 0]);
    aoa.push(['❌ Fallidos', r.fallidos || 0]);
    aoa.push(['💚 Total lo tuyo', totTuyo]);
    aoa.push(['🏢 Total empresa', totEmpresa]);
    aoa.push(['💰 TOTAL COBRADO', totTuyo + totEmpresa]);

    // ── Generar el .xlsx ──
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 4 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 12 },
      { wch: 26 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 28 }, { wch: 24 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entregas');
    const salida = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const blob = new Blob([salida], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const nombre = nombreArchivo(r.fecha);

    // ── Compartir (cascada como shareQR.ts) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    const file = new File([blob], nombre, { type: blob.type });
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: nombre });
        onShowToast?.('📥 Excel listo', 'Elige WhatsApp o dónde guardarlo', 'success');
        return true;
      } catch (e: unknown) {
        const esCancel = (e as { name?: string })?.name === 'AbortError';
        if (esCancel) return false;
        // Otro error → descarga directa
      }
    }

    // Fallback: descarga directa
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    onShowToast?.('📥 Excel descargado', nombre, 'success');
    return true;
  } catch (e: any) {
    console.error('❌ Error exportando Excel:', e);
    onShowToast?.('Error al exportar', e?.message || 'No se pudo generar el Excel', 'error');
    return false;
  }
}
