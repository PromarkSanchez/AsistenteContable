import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyAccess, isAccessError, READ_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/comprobantes/resumen - Resumen de comprobantes por período
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;

    const access = await requireCompanyAccess(request, companyId, READ_ROLES);
    if (isAccessError(access)) return access;

    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo');

    if (!periodo || !/^\d{6}$/.test(periodo)) {
      return NextResponse.json(
        { error: 'Período requerido (formato YYYYMM)' },
        { status: 400 }
      );
    }

    // Obtener todos los comprobantes del período
    const comprobantes = await prisma.comprobante.findMany({
      where: {
        companyId,
        periodo,
        estado: 'ACTIVO',
      },
    });

    // Calcular resumen
    let totalVentas = 0;
    let totalCompras = 0;
    let ventasGravadas = 0;
    let ventasNoGravadas = 0;
    let exportaciones = 0;
    let igvVentas = 0;
    let comprasGravadas = 0;
    let comprasNoGravadas = 0;
    let igvCompras = 0;

    for (const comprobante of comprobantes) {
      const baseImponible = Number(comprobante.baseImponible);
      const igv = Number(comprobante.igv);
      const total = Number(comprobante.total);

      if (comprobante.tipo === 'VENTA') {
        totalVentas += total;
        igvVentas += igv;

        if (comprobante.esExportacion) {
          exportaciones += baseImponible;
        } else if (comprobante.esGravada) {
          ventasGravadas += baseImponible;
        } else {
          ventasNoGravadas += baseImponible;
        }
      } else {
        totalCompras += total;
        igvCompras += igv;

        if (comprobante.esGravada && comprobante.afectaIgv) {
          comprasGravadas += baseImponible;
        } else {
          comprasNoGravadas += baseImponible;
        }
      }
    }

    return NextResponse.json({
      periodo,
      totalVentas: Math.round(totalVentas * 100) / 100,
      totalCompras: Math.round(totalCompras * 100) / 100,
      ventasGravadas: Math.round(ventasGravadas * 100) / 100,
      ventasNoGravadas: Math.round(ventasNoGravadas * 100) / 100,
      exportaciones: Math.round(exportaciones * 100) / 100,
      igvVentas: Math.round(igvVentas * 100) / 100,
      comprasGravadas: Math.round(comprasGravadas * 100) / 100,
      comprasNoGravadas: Math.round(comprasNoGravadas * 100) / 100,
      igvCompras: Math.round(igvCompras * 100) / 100,
    });
  } catch (error) {
    console.error('Error al calcular resumen:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
