// Servicio de cálculos tributarios para IGV mensual y Renta

import prisma from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface ResultadoCalculo {
  // Ventas
  baseImponibleVentas: number;
  ventasGravadas: number;
  ventasNoGravadas: number;
  exportaciones: number;
  debitoFiscal: number;

  // Compras
  totalComprasGravadas: number;
  comprasGravadasDestGravadas: number;
  comprasGravadasDestMixtas: number;
  comprasNoGravadas: number;
  creditoFiscal: number;

  // IGV
  igvResultante: number;
  saldoFavorAnterior: number;
  retenciones: number;
  percepciones: number;
  igvAPagar: number;
  saldoFavorPeriodo: number;

  // Renta
  ingresosNetos: number;
  coeficiente: number;
  pagoCuentaRenta: number;
  saldoFavorRentaAnterior: number;

  // Totales
  totalDeuda: number;

  // Explicación
  explicacion: string;
}

const IGV_RATE = 0.18;

export async function calcularTributosDelPeriodo(
  companyId: string,
  periodo: string,
  saldoFavorAnterior: number = 0,
  retenciones: number = 0,
  percepciones: number = 0,
  saldoFavorRentaAnterior: number = 0,
  coeficienteRenta?: number
): Promise<ResultadoCalculo> {
  // Obtener empresa para el coeficiente
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new Error('Empresa no encontrada');
  }

  const coeficiente = coeficienteRenta ?? parseFloat(company.coeficienteRenta);

  // Obtener comprobantes del período
  const comprobantes = await prisma.comprobante.findMany({
    where: {
      companyId,
      periodo,
      estado: 'ACTIVO',
    },
  });

  // Separar ventas y compras
  type ComprobanteType = { tipo: string; [key: string]: unknown };
  const ventas = comprobantes.filter((c: ComprobanteType) => c.tipo === 'VENTA');
  const compras = comprobantes.filter((c: ComprobanteType) => c.tipo === 'COMPRA');

  // ===== CÁLCULO DE VENTAS =====
  let ventasGravadas = 0;
  let ventasNoGravadas = 0;
  let exportaciones = 0;
  let debitoFiscal = 0;

  for (const venta of ventas) {
    const baseImponible = Number(venta.baseImponible);
    const igv = Number(venta.igv);

    if (venta.esExportacion) {
      exportaciones += baseImponible;
    } else if (venta.esGravada) {
      ventasGravadas += baseImponible;
      debitoFiscal += igv;
    } else {
      ventasNoGravadas += baseImponible;
    }
  }

  const baseImponibleVentas = ventasGravadas + ventasNoGravadas + exportaciones;

  // ===== CÁLCULO DE COMPRAS =====
  let comprasGravadasDestGravadas = 0;
  let comprasGravadasDestMixtas = 0;
  let comprasNoGravadas = 0;
  let creditoFiscal = 0;

  for (const compra of compras) {
    const baseImponible = Number(compra.baseImponible);
    const igv = Number(compra.igv);

    if (compra.esGravada && compra.afectaIgv) {
      // Simplificación: todas las compras gravadas van a destino gravado
      comprasGravadasDestGravadas += baseImponible;
      creditoFiscal += igv;
    } else if (compra.esGravada) {
      comprasGravadasDestMixtas += baseImponible;
    } else {
      comprasNoGravadas += baseImponible;
    }
  }

  const totalComprasGravadas = comprasGravadasDestGravadas + comprasGravadasDestMixtas;

  // ===== CÁLCULO DE IGV =====
  const igvResultante = debitoFiscal - creditoFiscal;

  let igvAPagar = 0;
  let saldoFavorPeriodo = 0;

  if (igvResultante > 0) {
    // Hay IGV a pagar
    let igvDespuesSaldo = igvResultante - saldoFavorAnterior;

    if (igvDespuesSaldo > 0) {
      // Aplicar retenciones y percepciones
      igvAPagar = Math.max(0, igvDespuesSaldo - retenciones - percepciones);
    } else {
      // Saldo a favor
      saldoFavorPeriodo = Math.abs(igvDespuesSaldo);
    }
  } else {
    // Crédito fiscal mayor que débito
    saldoFavorPeriodo = saldoFavorAnterior + Math.abs(igvResultante);
  }

  // ===== CÁLCULO DE RENTA =====
  const ingresosNetos = baseImponibleVentas;
  const pagoCuentaRentaCalculado = Math.round(ingresosNetos * coeficiente * 100) / 100;

  let pagoCuentaRenta = pagoCuentaRentaCalculado;
  if (saldoFavorRentaAnterior > 0) {
    pagoCuentaRenta = Math.max(0, pagoCuentaRentaCalculado - saldoFavorRentaAnterior);
  }

  // ===== TOTAL DEUDA =====
  const totalDeuda = igvAPagar + pagoCuentaRenta;

  // ===== EXPLICACIÓN =====
  let explicacion = `**Resumen del período ${periodo}**\n\n`;

  explicacion += `**VENTAS:**\n`;
  explicacion += `- Gravadas: S/ ${ventasGravadas.toFixed(2)}\n`;
  explicacion += `- No gravadas: S/ ${ventasNoGravadas.toFixed(2)}\n`;
  explicacion += `- Exportaciones: S/ ${exportaciones.toFixed(2)}\n`;
  explicacion += `- Débito fiscal (IGV ventas): S/ ${debitoFiscal.toFixed(2)}\n\n`;

  explicacion += `**COMPRAS:**\n`;
  explicacion += `- Gravadas: S/ ${totalComprasGravadas.toFixed(2)}\n`;
  explicacion += `- Crédito fiscal (IGV compras): S/ ${creditoFiscal.toFixed(2)}\n\n`;

  explicacion += `**IGV:**\n`;
  explicacion += `- Débito - Crédito = S/ ${igvResultante.toFixed(2)}\n`;
  if (saldoFavorAnterior > 0) {
    explicacion += `- Saldo a favor anterior: S/ ${saldoFavorAnterior.toFixed(2)}\n`;
  }
  if (igvAPagar > 0) {
    explicacion += `- **IGV A PAGAR: S/ ${igvAPagar.toFixed(2)}**\n\n`;
  } else {
    explicacion += `- Saldo a favor para siguiente período: S/ ${saldoFavorPeriodo.toFixed(2)}\n\n`;
  }

  explicacion += `**RENTA:**\n`;
  explicacion += `- Ingresos netos: S/ ${ingresosNetos.toFixed(2)}\n`;
  explicacion += `- Coeficiente: ${(coeficiente * 100).toFixed(2)}%\n`;
  explicacion += `- **Pago a cuenta: S/ ${pagoCuentaRenta.toFixed(2)}**\n\n`;

  explicacion += `**TOTAL A PAGAR: S/ ${totalDeuda.toFixed(2)}**`;

  return {
    baseImponibleVentas: round(baseImponibleVentas),
    ventasGravadas: round(ventasGravadas),
    ventasNoGravadas: round(ventasNoGravadas),
    exportaciones: round(exportaciones),
    debitoFiscal: round(debitoFiscal),
    totalComprasGravadas: round(totalComprasGravadas),
    comprasGravadasDestGravadas: round(comprasGravadasDestGravadas),
    comprasGravadasDestMixtas: round(comprasGravadasDestMixtas),
    comprasNoGravadas: round(comprasNoGravadas),
    creditoFiscal: round(creditoFiscal),
    igvResultante: round(igvResultante),
    saldoFavorAnterior: round(saldoFavorAnterior),
    retenciones: round(retenciones),
    percepciones: round(percepciones),
    igvAPagar: round(igvAPagar),
    saldoFavorPeriodo: round(saldoFavorPeriodo),
    ingresosNetos: round(ingresosNetos),
    coeficiente,
    pagoCuentaRenta: round(pagoCuentaRenta),
    saldoFavorRentaAnterior: round(saldoFavorRentaAnterior),
    totalDeuda: round(totalDeuda),
    explicacion,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export default { calcularTributosDelPeriodo };
