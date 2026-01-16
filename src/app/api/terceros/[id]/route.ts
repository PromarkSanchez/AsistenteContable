import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { terceroSchema } from '@/lib/validations';
import { ZodError } from 'zod';

interface RouteParams {
  params: { id: string };
}

// GET /api/terceros/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const tercero = await prisma.tercero.findUnique({
      where: { id: params.id },
    });

    if (!tercero) {
      return NextResponse.json(
        { error: 'Tercero no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(tercero);
  } catch (error) {
    console.error('Error al obtener tercero:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/terceros/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const existing = await prisma.tercero.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Tercero no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = terceroSchema.partial().parse(body);

    const tercero = await prisma.tercero.update({
      where: { id: params.id },
      data: {
        ...(validatedData.razonSocial && { razonSocial: validatedData.razonSocial }),
        ...(validatedData.direccion !== undefined && { direccion: validatedData.direccion }),
      },
    });

    return NextResponse.json(tercero);
  } catch (error) {
    console.error('Error al actualizar tercero:', error);

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

// DELETE /api/terceros/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const existing = await prisma.tercero.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Tercero no encontrado' },
        { status: 404 }
      );
    }

    await prisma.tercero.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error al eliminar tercero:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
