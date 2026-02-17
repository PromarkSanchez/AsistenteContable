import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calcularTributosDelPeriodo } from '@/services/calculadora-tributaria.service';
import { declaracionUpdateSchema } from '@/lib/validations';
import { ZodError } from 'zod';
import { requireCompanyAccess, isAccessError, READ_ROLES, WRITE_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string; declaracionId: string };
}

// GET /api/companies/[id]/declaraciones/[declaracionId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId, declaracionId } = params;

    const access = await requireCompanyAccess(request, companyId, READ_ROLES);
    if (isAccessError(access)) return access;

    const declaracion = await prisma.declaracionPDT621.findFirst({
      where: { id: declaracionId, companyId },
    });

    if (!declaracion) {
      return NextResponse.json(
        { error: 'Declaración no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...declaracion,
      ventasGravadas: Number(declaracion.ventasGravadas),
      ventasNoGravadas: Number(declaracion.ventasNoGravadas),
      exportaciones: Number(declaracion.exportaciones),
      descuentosVentas: Number(declaracion.descuentosVentas),
      otrasVentas: Number(declaracion.otrasVentas),
      comprasGravadasDestGravadas: Number(declaracion.comprasGravadasDestGravadas),
      comprasGravadasDestMixtas: Number(declaracion.comprasGravadasDestMixtas),
      comprasNoGravadas: Number(declaracion.comprasNoGravadas),
      descuentosCompras: Number(declaracion.descuentosCompras),
      importaciones: Number(declaracion.importaciones),
      debitoFiscal: Number(declaracion.debitoFiscal),
      creditoFiscal: Number(declaracion.creditoFiscal),
      saldoFavorAnterior: Number(declaracion.saldoFavorAnterior),
      retenciones: Number(declaracion.retenciones),
      percepciones: Number(declaracion.percepciones),
      igvAPagar: Number(declaracion.igvAPagar),
      saldoFavorPeriodo: Number(declaracion.saldoFavorPeriodo),
      ingresosNetos: Number(declaracion.ingresosNetos),
      coeficienteRenta: Number(declaracion.coeficienteRenta),
      pagoCuentaRenta: Number(declaracion.pagoCuentaRenta),
      saldoFavorRentaAnterior: Number(declaracion.saldoFavorRentaAnterior),
      totalDeuda: Number(declaracion.totalDeuda),
      intereses: Number(declaracion.intereses),
    });
  } catch (error) {
    console.error('Error al obtener declaración:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/companies/[id]/declaraciones/[declaracionId]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId, declaracionId } = params;

    const access = await requireCompanyAccess(request, companyId, WRITE_ROLES);
    if (isAccessError(access)) return access;

    const existingDeclaracion = await prisma.declaracionPDT621.findFirst({
      where: { id: declaracionId, companyId },
    });

    if (!existingDeclaracion) {
      return NextResponse.json(
        { error: 'Declaración no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = declaracionUpdateSchema.parse(body);

    // Recalcular con los nuevos valores
    const resultado = await calcularTributosDelPeriodo(
      companyId,
      existingDeclaracion.periodo,
      validatedData.saldoFavorAnterior ?? Number(existingDeclaracion.saldoFavorAnterior),
      validatedData.retenciones ?? Number(existingDeclaracion.retenciones),
      validatedData.percepciones ?? Number(existingDeclaracion.percepciones),
      validatedData.saldoFavorRentaAnterior ?? Number(existingDeclaracion.saldoFavorRentaAnterior)
    );

    // Actualizar declaración
    const declaracion = await prisma.declaracionPDT621.update({
      where: { id: declaracionId },
      data: {
        estado: 'CALCULADA',
        ventasGravadas: resultado.ventasGravadas,
        ventasNoGravadas: resultado.ventasNoGravadas,
        exportaciones: resultado.exportaciones,
        comprasGravadasDestGravadas: resultado.comprasGravadasDestGravadas,
        comprasGravadasDestMixtas: resultado.comprasGravadasDestMixtas,
        comprasNoGravadas: resultado.comprasNoGravadas,
        debitoFiscal: resultado.debitoFiscal,
        creditoFiscal: resultado.creditoFiscal,
        saldoFavorAnterior: resultado.saldoFavorAnterior,
        retenciones: resultado.retenciones,
        percepciones: resultado.percepciones,
        igvAPagar: resultado.igvAPagar,
        saldoFavorPeriodo: resultado.saldoFavorPeriodo,
        ingresosNetos: resultado.ingresosNetos,
        coeficienteRenta: resultado.coeficiente,
        pagoCuentaRenta: resultado.pagoCuentaRenta,
        saldoFavorRentaAnterior: resultado.saldoFavorRentaAnterior,
        totalDeuda: resultado.totalDeuda,
      },
    });

    return NextResponse.json({
      ...declaracion,
      ventasGravadas: Number(declaracion.ventasGravadas),
      debitoFiscal: Number(declaracion.debitoFiscal),
      creditoFiscal: Number(declaracion.creditoFiscal),
      igvAPagar: Number(declaracion.igvAPagar),
      totalDeuda: Number(declaracion.totalDeuda),
      resultado,
    });
  } catch (error) {
    console.error('Error al actualizar declaración:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id]/declaraciones/[declaracionId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId, declaracionId } = params;

    const access = await requireCompanyAccess(request, companyId, WRITE_ROLES);
    if (isAccessError(access)) return access;

    const declaracion = await prisma.declaracionPDT621.findFirst({
      where: { id: declaracionId, companyId },
    });

    if (!declaracion) {
      return NextResponse.json(
        { error: 'Declaración no encontrada' },
        { status: 404 }
      );
    }

    // No permitir eliminar declaraciones presentadas
    if (declaracion.estado === 'PRESENTADA') {
      return NextResponse.json(
        { error: 'No se puede eliminar una declaración ya presentada' },
        { status: 400 }
      );
    }

    await prisma.declaracionPDT621.delete({
      where: { id: declaracionId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error al eliminar declaración:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
