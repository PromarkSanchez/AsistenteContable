import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/admin/users/[id] - Obtener usuario específico
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

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        companies: {
          select: {
            id: true,
            ruc: true,
            razonSocial: true,
            createdAt: true,
            _count: {
              select: { comprobantes: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/users/[id] - Actualizar usuario
export async function PUT(
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

    const body = await request.json();
    const { plan, isActive, isSuperadmin, fullName } = body;

    // No permitir que el admin se quite sus propios privilegios
    if (params.id === userId && isSuperadmin === false) {
      return NextResponse.json(
        { error: 'No puedes quitarte tus propios privilegios de administrador' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(plan !== undefined && { plan }),
        ...(isActive !== undefined && { isActive }),
        ...(isSuperadmin !== undefined && { isSuperadmin }),
        ...(fullName !== undefined && { fullName }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        plan: true,
        isActive: true,
        isSuperadmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - Eliminar usuario
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

    // No permitir eliminar a sí mismo
    if (params.id === userId) {
      return NextResponse.json(
        { error: 'No puedes eliminarte a ti mismo' },
        { status: 400 }
      );
    }

    // Eliminar usuario (cascada elimina empresas y comprobantes)
    await prisma.user.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
