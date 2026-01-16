import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { companyUpdateSchema } from '@/lib/validations';
import { ZodError } from 'zod';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id] - Obtener empresa por ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const company = await prisma.company.findFirst({
      where: {
        id,
        userId, // Solo empresas del usuario
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...company,
      hasCredentials: !!company.usuarioSol,
      hasCertificado: !!company.certificadoDigital,
      claveSolEncrypted: undefined,
      certificadoDigital: undefined,
      certificadoPasswordEncrypted: undefined,
    });
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/companies/[id] - Actualizar empresa
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar que la empresa pertenece al usuario
    const existingCompany = await prisma.company.findFirst({
      where: { id, userId },
    });

    if (!existingCompany) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = companyUpdateSchema.parse(body);

    // Actualizar empresa
    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(validatedData.razonSocial && { razonSocial: validatedData.razonSocial }),
        ...(validatedData.nombreComercial !== undefined && {
          nombreComercial: validatedData.nombreComercial,
        }),
        ...(validatedData.regimen && { regimen: validatedData.regimen }),
        ...(validatedData.tipoContribuyente !== undefined && {
          tipoContribuyente: validatedData.tipoContribuyente,
        }),
        ...(validatedData.direccionFiscal !== undefined && {
          direccionFiscal: validatedData.direccionFiscal,
        }),
        ...(validatedData.ubigeo !== undefined && { ubigeo: validatedData.ubigeo }),
        ...(validatedData.telefono !== undefined && { telefono: validatedData.telefono }),
        ...(validatedData.email !== undefined && { email: validatedData.email }),
        ...(validatedData.coeficienteRenta && {
          coeficienteRenta: validatedData.coeficienteRenta,
        }),
      },
    });

    return NextResponse.json({
      ...company,
      hasCredentials: !!company.usuarioSol,
      hasCertificado: !!company.certificadoDigital,
      claveSolEncrypted: undefined,
      certificadoDigital: undefined,
      certificadoPasswordEncrypted: undefined,
    });
  } catch (error) {
    console.error('Error al actualizar empresa:', error);

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

// DELETE /api/companies/[id] - Eliminar empresa
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar que la empresa pertenece al usuario
    const existingCompany = await prisma.company.findFirst({
      where: { id, userId },
    });

    if (!existingCompany) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar empresa (cascada eliminará comprobantes, declaraciones, etc.)
    await prisma.company.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error al eliminar empresa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
