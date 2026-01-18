import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/alertas - Estadísticas y gestión de alertas
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

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'stats') {
      // Obtener estadísticas generales
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      const [
        totalConfigs,
        activeConfigs,
        totalHistory,
        todayHistory,
        weekHistory,
        unreadHistory,
        configsByTipo,
        usersByPlan,
      ] = await Promise.all([
        prisma.alertConfig.count(),
        prisma.alertConfig.count({ where: { isActive: true } }),
        prisma.alertHistory.count(),
        prisma.alertHistory.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.alertHistory.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.alertHistory.count({ where: { isRead: false } }),
        prisma.alertConfig.groupBy({
          by: ['tipo'],
          _count: true,
        }),
        prisma.user.groupBy({
          by: ['plan'],
          _count: true,
        }),
      ]);

      // Transformar datos
      const tipoStats: Record<string, number> = {};
      for (const t of configsByTipo) {
        tipoStats[t.tipo] = t._count;
      }

      const planStats: Record<string, number> = {};
      for (const p of usersByPlan) {
        planStats[p.plan] = p._count;
      }

      return NextResponse.json({
        configs: {
          total: totalConfigs,
          active: activeConfigs,
          byTipo: tipoStats,
        },
        history: {
          total: totalHistory,
          today: todayHistory,
          week: weekHistory,
          unread: unreadHistory,
        },
        users: {
          byPlan: planStats,
        },
      });
    }

    // Listar historial reciente con info de usuario
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    const fuente = searchParams.get('fuente');

    const whereClause: Record<string, unknown> = {};
    if (fuente) {
      whereClause.fuente = fuente;
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

    // Obtener configuraciones para mostrar info del usuario
    const configIds = [...new Set(history.map(h => h.alertConfigId))];
    const configs = await prisma.alertConfig.findMany({
      where: { id: { in: configIds } },
      select: { id: true, userId: true, nombre: true },
    });

    const userIds = [...new Set(configs.map(c => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, fullName: true },
    });

    const configsMap = new Map(configs.map(c => [c.id, c]));
    const usersMap = new Map(users.map(u => [u.id, u]));

    const historyWithUser = history.map(h => {
      const config = configsMap.get(h.alertConfigId);
      const user = config ? usersMap.get(config.userId) : null;
      return {
        ...h,
        configName: config?.nombre || 'Desconocido',
        userEmail: user?.email || 'Desconocido',
      };
    });

    return NextResponse.json({
      data: historyWithUser,
      total,
      skip,
      limit,
    });
  } catch (error) {
    console.error('Error obteniendo alertas admin:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/admin/alertas - Crear alerta manual para todos los usuarios
export async function POST(request: NextRequest) {
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
    const { titulo, contenido, fuente, tipo, region, entidad, monto, urlOrigen } = body;

    if (!titulo || !contenido || !fuente) {
      return NextResponse.json(
        { error: 'Título, contenido y fuente son requeridos' },
        { status: 400 }
      );
    }

    // Obtener todas las configuraciones activas que coincidan con el tipo
    const whereClause: Record<string, unknown> = {
      isActive: true,
    };
    if (tipo) {
      whereClause.tipo = tipo;
    }

    const configs = await prisma.alertConfig.findMany({
      where: whereClause,
    });

    // Crear entrada de historial para cada configuración que coincida
    let createdCount = 0;
    for (const config of configs) {
      // Verificar si coincide con los filtros
      const matchesPalabrasClave = config.palabrasClave.length === 0 ||
        config.palabrasClave.some(p =>
          titulo.toLowerCase().includes(p.toLowerCase()) ||
          contenido.toLowerCase().includes(p.toLowerCase())
        );

      const matchesRegion = config.regiones.length === 0 ||
        (region && config.regiones.includes(region.toUpperCase()));

      const matchesMonto = (config.montoMinimo === null || (monto && monto >= Number(config.montoMinimo))) &&
        (config.montoMaximo === null || (monto && monto <= Number(config.montoMaximo)));

      if (matchesPalabrasClave && matchesRegion && matchesMonto) {
        await prisma.alertHistory.create({
          data: {
            alertConfigId: config.id,
            titulo,
            contenido,
            fuente,
            urlOrigen: urlOrigen || null,
            fechaPublicacion: new Date(),
            region: region || null,
            entidad: entidad || null,
            monto: monto || null,
            isRead: false,
            isNotified: false,
          },
        });
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Alerta creada para ${createdCount} configuraciones`,
      count: createdCount,
    });
  } catch (error) {
    console.error('Error creando alerta:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
