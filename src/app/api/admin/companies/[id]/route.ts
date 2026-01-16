import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/admin/companies/[id] - Obtener empresa específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser?.isSuperadmin) {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            plan: true,
          },
        },
        _count: {
          select: {
            comprobantes: true,
            declaraciones: true,
          },
        },
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
      comprobantesCount: company._count.comprobantes,
      declaracionesCount: company._count.declaraciones,
    });
  } catch (error) {
    console.error('Error obteniendo empresa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/companies/[id] - Eliminar empresa
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser?.isSuperadmin) {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    // Verificar que la empresa existe
    const company = await prisma.company.findUnique({
      where: { id: params.id },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar empresa (cascada elimina comprobantes y declaraciones)
    await prisma.company.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Empresa eliminada' });
  } catch (error) {
    console.error('Error eliminando empresa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
