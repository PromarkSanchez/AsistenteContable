import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { comprobanteUpdateSchema } from '@/lib/validations';
import { ZodError } from 'zod';

interface RouteParams {
  params: { id: string; comprobanteId: string };
}

// GET /api/companies/[id]/comprobantes/[comprobanteId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id: companyId, comprobanteId } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar que la empresa pertenece al usuario
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    const comprobante = await prisma.comprobante.findFirst({
      where: { id: comprobanteId, companyId },
      include: {
        items: {
          orderBy: { numeroLinea: 'asc' },
        },
      },
    });

    if (!comprobante) {
      return NextResponse.json(
        { error: 'Comprobante no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...comprobante,
      tipoCambio: comprobante.tipoCambio ? Number(comprobante.tipoCambio) : null,
      baseImponible: Number(comprobante.baseImponible),
      igv: Number(comprobante.igv),
      otrosTributos: Number(comprobante.otrosTributos),
      total: Number(comprobante.total),
      items: comprobante.items.map(item => ({
        ...item,
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precioUnitario),
        valorVenta: Number(item.valorVenta),
        descuento: Number(item.descuento),
        igv: Number(item.igv),
        isc: Number(item.isc),
        otrosTributos: Number(item.otrosTributos),
        total: Number(item.total),
      })),
    });
  } catch (error) {
    console.error('Error al obtener comprobante:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/companies/[id]/comprobantes/[comprobanteId]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id: companyId, comprobanteId } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    const existingComprobante = await prisma.comprobante.findFirst({
      where: { id: comprobanteId, companyId },
    });

    if (!existingComprobante) {
      return NextResponse.json(
        { error: 'Comprobante no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = comprobanteUpdateSchema.parse(body);

    // Si cambia serie/numero, verificar duplicado
    if (
      (validatedData.serie && validatedData.serie !== existingComprobante.serie) ||
      (validatedData.numero && validatedData.numero !== existingComprobante.numero)
    ) {
      const duplicate = await prisma.comprobante.findUnique({
        where: {
          companyId_tipoDocumento_serie_numero: {
            companyId,
            tipoDocumento: validatedData.tipoDocumento || existingComprobante.tipoDocumento,
            serie: validatedData.serie || existingComprobante.serie,
            numero: validatedData.numero || existingComprobante.numero,
          },
        },
      });

      if (duplicate && duplicate.id !== comprobanteId) {
        return NextResponse.json(
          { error: 'Ya existe un comprobante con esa serie y número' },
          { status: 400 }
        );
      }
    }

    const comprobante = await prisma.comprobante.update({
      where: { id: comprobanteId },
      data: {
        ...(validatedData.tipo && { tipo: validatedData.tipo }),
        ...(validatedData.tipoDocumento && { tipoDocumento: validatedData.tipoDocumento }),
        ...(validatedData.serie && { serie: validatedData.serie }),
        ...(validatedData.numero && { numero: validatedData.numero }),
        ...(validatedData.fechaEmision && { fechaEmision: validatedData.fechaEmision }),
        ...(validatedData.fechaVencimiento !== undefined && {
          fechaVencimiento: validatedData.fechaVencimiento,
        }),
        ...(validatedData.tipoDocTercero && { tipoDocTercero: validatedData.tipoDocTercero }),
        ...(validatedData.rucTercero !== undefined && { rucTercero: validatedData.rucTercero }),
        ...(validatedData.razonSocialTercero !== undefined && {
          razonSocialTercero: validatedData.razonSocialTercero,
        }),
        ...(validatedData.moneda && { moneda: validatedData.moneda }),
        ...(validatedData.tipoCambio !== undefined && { tipoCambio: validatedData.tipoCambio }),
        ...(validatedData.baseImponible !== undefined && {
          baseImponible: validatedData.baseImponible,
        }),
        ...(validatedData.igv !== undefined && { igv: validatedData.igv }),
        ...(validatedData.otrosTributos !== undefined && {
          otrosTributos: validatedData.otrosTributos,
        }),
        ...(validatedData.total !== undefined && { total: validatedData.total }),
        ...(validatedData.esGravada !== undefined && { esGravada: validatedData.esGravada }),
        ...(validatedData.esExportacion !== undefined && {
          esExportacion: validatedData.esExportacion,
        }),
        ...(validatedData.afectaIgv !== undefined && { afectaIgv: validatedData.afectaIgv }),
        ...(validatedData.periodo && { periodo: validatedData.periodo }),
        ...(validatedData.comprobanteRefTipo !== undefined && {
          comprobanteRefTipo: validatedData.comprobanteRefTipo,
        }),
        ...(validatedData.comprobanteRefSerie !== undefined && {
          comprobanteRefSerie: validatedData.comprobanteRefSerie,
        }),
        ...(validatedData.comprobanteRefNumero !== undefined && {
          comprobanteRefNumero: validatedData.comprobanteRefNumero,
        }),
      },
    });

    return NextResponse.json({
      ...comprobante,
      tipoCambio: comprobante.tipoCambio ? Number(comprobante.tipoCambio) : null,
      baseImponible: Number(comprobante.baseImponible),
      igv: Number(comprobante.igv),
      otrosTributos: Number(comprobante.otrosTributos),
      total: Number(comprobante.total),
    });
  } catch (error) {
    console.error('Error al actualizar comprobante:', error);

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

// DELETE /api/companies/[id]/comprobantes/[comprobanteId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id: companyId, comprobanteId } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    const comprobante = await prisma.comprobante.findFirst({
      where: { id: comprobanteId, companyId },
    });

    if (!comprobante) {
      return NextResponse.json(
        { error: 'Comprobante no encontrado' },
        { status: 404 }
      );
    }

    await prisma.comprobante.delete({
      where: { id: comprobanteId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error al eliminar comprobante:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
