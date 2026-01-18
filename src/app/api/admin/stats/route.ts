import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/stats - Obtener estadísticas del sistema
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar que sea superadmin
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.isSuperadmin) {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    // Obtener estadísticas
    const [
      totalUsers,
      activeUsers,
      totalCompanies,
      totalComprobantes,
      usersByPlan,
      recentUsers,
      comprobantesThisMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.company.count(),
      prisma.comprobante.count(),
      prisma.user.groupBy({
        by: ['plan'],
        _count: { id: true },
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          plan: true,
          createdAt: true,
          _count: { select: { companies: true } },
        },
      }),
      prisma.comprobante.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    // Formatear estadísticas por plan
    type PlanGroup = { plan: string; _count: { id: number } };
    const planStats = usersByPlan.reduce((acc: Record<string, number>, item: PlanGroup) => {
      acc[item.plan] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      totalUsers,
      activeUsers,
      totalCompanies,
      totalComprobantes,
      comprobantesThisMonth,
      usersByPlan: planStats,
      recentUsers: recentUsers.map((u: { id: string; email: string; fullName: string | null; plan: string; createdAt: Date; _count: { companies: number } }) => ({
        ...u,
        companiesCount: u._count.companies,
      })),
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
