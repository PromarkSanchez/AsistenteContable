import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/ai-providers - Obtener todos los proveedores de IA
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperadmin: true },
    });

    if (!user?.isSuperadmin) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const providers = await prisma.aIProviderConfig.findMany({
      orderBy: { displayName: 'asc' },
    });

    // Convertir Decimal y verificar si las credenciales están configuradas en env
    const providersFormatted = providers.map(provider => ({
      ...provider,
      costoPorInputToken: Number(provider.costoPorInputToken),
      costoPorOutputToken: Number(provider.costoPorOutputToken),
      hasCredentials: provider.credentialsKey ? !!process.env[provider.credentialsKey] : false,
    }));

    return NextResponse.json(providersFormatted);
  } catch (error) {
    console.error('Error obteniendo proveedores IA:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/admin/ai-providers - Actualizar configuración de proveedor
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperadmin: true },
    });

    if (!user?.isSuperadmin) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...providerData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de proveedor requerido' }, { status: 400 });
    }

    // Si se está activando como default, desactivar los demás
    if (providerData.isDefault) {
      await prisma.aIProviderConfig.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.aIProviderConfig.update({
      where: { id },
      data: providerData,
    });

    return NextResponse.json({
      ...updated,
      costoPorInputToken: Number(updated.costoPorInputToken),
      costoPorOutputToken: Number(updated.costoPorOutputToken),
    });
  } catch (error) {
    console.error('Error actualizando proveedor IA:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
