import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/alertas/licitaciones - Obtener licitaciones para usuarios
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que el usuario tenga acceso al sistema de alertas
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, isSuperadmin: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Verificar planes permitidos
    const allowedPlansSetting = await prisma.systemSetting.findUnique({
      where: { key: 'alert_allowed_plans' },
    });
    const allowedPlans = allowedPlansSetting?.value?.split(',').map(p => p.trim()) || ['PRO'];

    if (!user.isSuperadmin && !allowedPlans.includes(user.plan)) {
      return NextResponse.json({
        error: 'Plan no permitido',
        requiresUpgrade: true,
        requiredPlans: allowedPlans,
      }, { status: 403 });
    }

    // Obtener licitaciones activas con sus etapas
    const licitaciones = await prisma.scrapedLicitacion.findMany({
      where: {
        estado: 'ACTIVO',
      },
      include: {
        etapas: {
          orderBy: { fechaFin: 'asc' },
        },
      },
      orderBy: { scrapedAt: 'desc' },
      take: 50, // Limitar a 50 para usuarios
    });

    return NextResponse.json({
      data: licitaciones,
      total: licitaciones.length,
    });
  } catch (error) {
    console.error('Error obteniendo licitaciones:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
