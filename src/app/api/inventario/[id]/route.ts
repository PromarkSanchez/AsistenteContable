import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

// GET /api/inventario/[id] - Obtener detalle de un inventario
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

    const inventario = await prisma.inventario.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        items: {
          orderBy: { codigoBien: 'asc' },
        },
      },
    });

    if (!inventario) {
      return NextResponse.json(
        { error: 'Inventario no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(inventario);
  } catch (error) {
    console.error('Error obteniendo inventario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/inventario/[id] - Eliminar un inventario
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

    // Verificar que el inventario pertenece al usuario
    const inventario = await prisma.inventario.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!inventario) {
      return NextResponse.json(
        { error: 'Inventario no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar (los items se eliminan en cascada)
    await prisma.inventario.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Inventario eliminado' });
  } catch (error) {
    console.error('Error eliminando inventario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
