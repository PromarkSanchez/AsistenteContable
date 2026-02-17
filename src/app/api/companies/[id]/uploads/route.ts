import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyAccess, isAccessError, READ_ROLES, MANAGE_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/uploads - Obtener historial de subidas
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;

    const access = await requireCompanyAccess(request, companyId, READ_ROLES);
    if (isAccessError(access)) return access;

    // Parámetros de paginación
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get('skip') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // PENDING, PROCESSING, COMPLETED, FAILED

    // Construir filtro
    const where: any = { companyId };
    if (status) {
      where.status = status;
    }

    // Obtener historial
    const [uploads, total] = await Promise.all([
      prisma.invoiceUploadHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoiceUploadHistory.count({ where }),
    ]);

    return NextResponse.json({
      data: uploads,
      total,
      skip,
      limit,
    });
  } catch (error) {
    console.error('Error obteniendo historial de uploads:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id]/uploads - Limpiar historial antiguo
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;

    const access = await requireCompanyAccess(request, companyId, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    // Obtener parámetro de días (default 30)
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Calcular fecha límite
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - days);

    // Eliminar registros antiguos
    const result = await prisma.invoiceUploadHistory.deleteMany({
      where: {
        companyId,
        createdAt: { lt: fechaLimite },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Se eliminaron ${result.count} registros con más de ${days} días de antigüedad`,
      deleted: result.count,
    });
  } catch (error) {
    console.error('Error limpiando historial:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
