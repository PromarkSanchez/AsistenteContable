import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { metricsLogger } from '@/lib/metrics-logger';
import { rateLimiter } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

// GET /api/admin/dashboard - Obtener KPIs y métricas del dashboard
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

    // Obtener KPIs
    const kpis = await metricsLogger.getAdminDashboardKPIs();

    // Obtener estadísticas de rate limit
    const rateLimitStats = rateLimiter.getStats();

    // Obtener eventos de seguridad recientes
    const recentSecurityEvents = await metricsLogger.getSecurityEvents(10);

    // Obtener uso de IA del último mes
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const aiUsageSummary = await metricsLogger.getAIUsageSummary(monthStart, now);

    // Obtener estadísticas de rate limiting de las últimas 24h
    const rateLimitDbStats = await metricsLogger.getRateLimitStats(24);

    // Obtener tendencias de usuarios (últimos 7 días)
    const userTrends = await getUserTrends();

    // Obtener feedback pendiente
    const pendingFeedback = await prisma.userFeedback.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        title: true,
        rating: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      kpis,
      rateLimitStats: {
        inMemory: rateLimitStats,
        database: rateLimitDbStats,
      },
      recentSecurityEvents,
      aiUsageSummary,
      userTrends,
      pendingFeedback,
    });
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function getUserTrends(): Promise<Array<{ date: string; users: number; companies: number }>> {
  const trends: Array<{ date: string; users: number; companies: number }> = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [users, companies] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
      }),
      prisma.company.count({
        where: {
          createdAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
      }),
    ]);

    trends.push({
      date: dayStart.toISOString().split('T')[0],
      users,
      companies,
    });
  }

  return trends;
}
