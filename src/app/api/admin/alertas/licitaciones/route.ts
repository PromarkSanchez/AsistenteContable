import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Verificar que sea superadmin
async function verifySuperadmin(request: NextRequest): Promise<boolean> {
  const userId = request.headers.get('x-user-id');
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperadmin: true },
  });

  return user?.isSuperadmin === true;
}

// GET /api/admin/alertas/licitaciones - Obtener licitaciones scrapeadas
export async function GET(request: NextRequest) {
  try {
    if (!(await verifySuperadmin(request))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const fuente = searchParams.get('fuente');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Construir filtros
    const where: Record<string, unknown> = {};
    if (fuente) {
      where.fuente = fuente;
    }
    if (search) {
      where.OR = [
        { nomenclatura: { contains: search, mode: 'insensitive' } },
        { objetoContratacion: { contains: search, mode: 'insensitive' } },
        { entidad: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Obtener licitaciones con etapas
    const [licitaciones, total] = await Promise.all([
      prisma.scrapedLicitacion.findMany({
        where,
        include: {
          etapas: {
            orderBy: { fechaInicio: 'asc' },
          },
        },
        orderBy: { scrapedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.scrapedLicitacion.count({ where }),
    ]);

    // Obtener estadísticas
    const stats = await prisma.scrapedLicitacion.groupBy({
      by: ['fuente'],
      _count: { id: true },
    });

    const totalEtapas = await prisma.licitacionEtapa.count();

    return NextResponse.json({
      data: licitaciones,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalLicitaciones: total,
        totalEtapas,
        byFuente: stats.reduce((acc: Record<string, number>, s: { fuente: string; _count: { id: number } }) => {
          acc[s.fuente] = s._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    console.error('Error obteniendo licitaciones:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/admin/alertas/licitaciones - Eliminar licitación
export async function DELETE(request: NextRequest) {
  try {
    if (!(await verifySuperadmin(request))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, deleteAll } = body;

    if (deleteAll) {
      // Eliminar todas las licitaciones (y sus etapas por cascade)
      const result = await prisma.scrapedLicitacion.deleteMany();
      return NextResponse.json({
        success: true,
        message: `${result.count} licitaciones eliminadas`,
      });
    }

    if (id) {
      // Eliminar una licitación específica
      await prisma.scrapedLicitacion.delete({
        where: { id },
      });
      return NextResponse.json({
        success: true,
        message: 'Licitación eliminada',
      });
    }

    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  } catch (error) {
    console.error('Error eliminando licitación:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
