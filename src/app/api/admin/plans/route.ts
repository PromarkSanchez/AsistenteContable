import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/plans - Obtener todos los planes con sus menús
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que es admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperadmin: true },
    });

    if (!user?.isSuperadmin) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // @ts-ignore - cacheStrategy para Prisma Accelerate
    const plans = await prisma.planConfig.findMany({
      include: {
        menuItems: {
          orderBy: { orden: 'asc' },
        },
      },
      orderBy: { plan: 'asc' },
      cacheStrategy: { ttl: 0 }, // Bypass cache
    });

    // Convertir BigInt a string para JSON
    const plansFormatted = plans.map(plan => ({
      ...plan,
      maxStorage: plan.maxStorage.toString(),
      precioMensual: Number(plan.precioMensual),
      precioAnual: Number(plan.precioAnual),
    }));

    return NextResponse.json(plansFormatted);
  } catch (error) {
    console.error('Error obteniendo planes:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/admin/plans - Actualizar configuración de un plan
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
    const { id, menuItems, ...planData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de plan requerido' }, { status: 400 });
    }

    // Convertir maxStorage a BigInt si viene como string
    if (planData.maxStorage) {
      planData.maxStorage = BigInt(planData.maxStorage);
    }

    // Actualizar plan
    const updatedPlan = await prisma.planConfig.update({
      where: { id },
      data: planData,
    });

    // Actualizar menús si se proporcionan
    if (menuItems && Array.isArray(menuItems)) {
      for (const menuItem of menuItems) {
        await prisma.planMenuItem.update({
          where: { id: menuItem.id },
          data: {
            isEnabled: menuItem.isEnabled,
            isVisible: menuItem.isVisible,
            label: menuItem.label,
            orden: menuItem.orden,
          },
        });
      }
    }

    return NextResponse.json({
      ...updatedPlan,
      maxStorage: updatedPlan.maxStorage.toString(),
      precioMensual: Number(updatedPlan.precioMensual),
      precioAnual: Number(updatedPlan.precioAnual),
    });
  } catch (error) {
    console.error('Error actualizando plan:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
