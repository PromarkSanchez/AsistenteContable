import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyAccess, isAccessError, MANAGE_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string };
}

// POST /api/companies/[id]/firma - Subir firma digital
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    const access = await requireCompanyAccess(request, id, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'El archivo debe ser una imagen' },
        { status: 400 }
      );
    }

    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'El archivo no debe exceder 2MB' },
        { status: 400 }
      );
    }

    // Convertir a base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;

    // Actualizar empresa con la nueva firma
    await prisma.company.update({
      where: { id },
      data: { firmaDigitalBase64: base64 },
    });

    return NextResponse.json({
      message: 'Firma digital actualizada correctamente',
      firmaUrl: base64,
    });
  } catch (error) {
    console.error('Error al subir firma:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id]/firma - Eliminar firma digital
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    const access = await requireCompanyAccess(request, id, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    // Eliminar firma
    await prisma.company.update({
      where: { id },
      data: { firmaDigitalBase64: null },
    });

    return NextResponse.json({
      message: 'Firma digital eliminada correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar firma:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
