import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getStringSize } from '@/lib/utils';

interface RouteParams {
  params: { id: string };
}

// POST /api/companies/[id]/logo - Subir logo
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const company = await prisma.company.findFirst({
      where: { id, userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

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

    // Actualizar empresa con el nuevo logo
    await prisma.company.update({
      where: { id },
      data: { logoBase64: base64 },
    });

    // Actualizar uso de almacenamiento
    const logoSize = getStringSize(base64);
    await prisma.storageUsage.upsert({
      where: { companyId: id },
      update: { logosSize: BigInt(logoSize), lastCalculated: new Date() },
      create: { companyId: id, logosSize: BigInt(logoSize) },
    });

    return NextResponse.json({
      message: 'Logo actualizado correctamente',
      logoUrl: base64,
    });
  } catch (error) {
    console.error('Error al subir logo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id]/logo - Eliminar logo
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
    const company = await prisma.company.findFirst({
      where: { id, userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar logo
    await prisma.company.update({
      where: { id },
      data: { logoBase64: null },
    });

    // Actualizar uso de almacenamiento
    await prisma.storageUsage.upsert({
      where: { companyId: id },
      update: { logosSize: BigInt(0), lastCalculated: new Date() },
      create: { companyId: id, logosSize: BigInt(0) },
    });

    return NextResponse.json({
      message: 'Logo eliminado correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar logo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
