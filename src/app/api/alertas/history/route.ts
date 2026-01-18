import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Función para verificar si el plan del usuario tiene acceso a alertas
async function checkAlertAccess(userId: string): Promise<{ allowed: boolean; plan: string; requiredPlans: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const userPlan = user?.plan || 'FREE';

  // Obtener configuración de planes permitidos para alertas
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'alert_allowed_plans' },
  });

  // Por defecto solo PRO tiene acceso si no hay configuración
  const allowedPlans = setting?.value ? setting.value.split(',').map(p => p.trim()) : ['PRO'];

  return {
    allowed: allowedPlans.includes(userPlan),
    plan: userPlan,
    requiredPlans: allowedPlans,
  };
}

// GET /api/alertas/history - Obtener historial de alertas
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar acceso según plan
    const access = await checkAlertAccess(userId);
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: `El sistema de alertas está disponible para planes: ${access.requiredPlans.join(', ')}`,
          requiresUpgrade: true,
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');
    const fuente = searchParams.get('fuente');
    const isRead = searchParams.get('isRead');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    // Obtener las configuraciones de alertas del usuario
    const userConfigs = await prisma.alertConfig.findMany({
      where: { userId },
      select: { id: true },
    });
    const configIds = userConfigs.map(c => c.id);

    // Filtrar historial
    const whereClause: Record<string, unknown> = {
      alertConfigId: configId ? configId : { in: configIds },
    };

    if (fuente) {
      whereClause.fuente = fuente;
    }
    if (isRead !== null && isRead !== undefined) {
      whereClause.isRead = isRead === 'true';
    }

    const [history, total] = await Promise.all([
      prisma.alertHistory.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.alertHistory.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: history,
      total,
      skip,
      limit,
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/alertas/history - Marcar alertas como leídas
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar acceso según plan
    const access = await checkAlertAccess(userId);
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: `El sistema de alertas está disponible para planes: ${access.requiredPlans.join(', ')}`,
          requiresUpgrade: true,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ids, markAllRead } = body;

    // Obtener las configuraciones de alertas del usuario
    const userConfigs = await prisma.alertConfig.findMany({
      where: { userId },
      select: { id: true },
    });
    const configIds = userConfigs.map(c => c.id);

    if (markAllRead) {
      // Marcar todas como leídas
      await prisma.alertHistory.updateMany({
        where: {
          alertConfigId: { in: configIds },
          isRead: false,
        },
        data: { isRead: true },
      });
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      // Marcar las seleccionadas como leídas
      await prisma.alertHistory.updateMany({
        where: {
          id: { in: ids },
          alertConfigId: { in: configIds },
        },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marcando alertas:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
