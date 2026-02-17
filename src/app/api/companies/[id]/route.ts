import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { companyUpdateSchema } from '@/lib/validations';
import { ZodError } from 'zod';
import { requireCompanyAccess, isAccessError, READ_ROLES, MANAGE_ROLES, OWNER_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id] - Obtener empresa por ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const access = await requireCompanyAccess(request, id, READ_ROLES);
    if (isAccessError(access)) return access;

    const company = access.company as any;

    return NextResponse.json({
      ...company,
      myRole: access.role,
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

// PUT /api/companies/[id] - Actualizar empresa (solo OWNER/ADMIN)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const access = await requireCompanyAccess(request, id, MANAGE_ROLES);
    if (isAccessError(access)) return access;

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
      myRole: access.role,
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

// DELETE /api/companies/[id] - Eliminar empresa (solo OWNER)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const access = await requireCompanyAccess(request, id, OWNER_ROLES);
    if (isAccessError(access)) return access;

    // Eliminar empresa (cascada eliminará comprobantes, declaraciones, miembros, etc.)
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
