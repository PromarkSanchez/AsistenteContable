import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyAccess, isAccessError, MANAGE_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string };
}

// POST /api/companies/[id]/huella - Subir huella digital
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

    // Actualizar empresa con la nueva huella
    await prisma.company.update({
      where: { id },
      data: { huellaDigitalBase64: base64 },
    });

    return NextResponse.json({
      message: 'Huella digital actualizada correctamente',
      huellaUrl: base64,
    });
  } catch (error) {
    console.error('Error al subir huella:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id]/huella - Eliminar huella digital
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    const access = await requireCompanyAccess(request, id, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    // Eliminar huella
    await prisma.company.update({
      where: { id },
      data: { huellaDigitalBase64: null },
    });

    return NextResponse.json({
      message: 'Huella digital eliminada correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar huella:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
