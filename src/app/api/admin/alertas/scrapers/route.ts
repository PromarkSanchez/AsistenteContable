import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getScraperConfig, updateScraperConfig } from '@/lib/scraping';
import { runAllScrapers, getScrapersStatus } from '@/lib/scraping/orchestrator';

export const dynamic = 'force-dynamic';

// GET /api/admin/alertas/scrapers - Obtener estado de los scrapers
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

    const status = await getScrapersStatus();

    // Obtener estadísticas de alertas por fuente
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await Promise.all(
      ['SEACE', 'OSCE', 'SUNAT'].map(async (fuente) => {
        const [total, today_count] = await Promise.all([
          prisma.alertHistory.count({ where: { fuente } }),
          prisma.alertHistory.count({
            where: { fuente, createdAt: { gte: today } },
          }),
        ]);
        return { fuente, total, today: today_count };
      })
    );

    const statsMap: Record<string, { total: number; today: number }> = {};
    for (const s of stats) {
      statsMap[s.fuente.toLowerCase()] = { total: s.total, today: s.today };
    }

    return NextResponse.json({
      ...status,
      stats: statsMap,
    });
  } catch (error) {
    console.error('Error obteniendo estado de scrapers:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/admin/alertas/scrapers - Actualizar configuración de un scraper
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
    const { source, enabled, frequency, retentionDays } = body;

    if (!source || !['seace', 'osce', 'sunat'].includes(source.toLowerCase())) {
      return NextResponse.json({ error: 'Fuente inválida' }, { status: 400 });
    }

    const updates: {
      enabled?: boolean;
      frequency?: string;
      retentionDays?: number;
    } = {};

    if (enabled !== undefined) {
      updates.enabled = enabled;
    }

    if (frequency !== undefined) {
      if (!['hourly', 'daily', 'weekly'].includes(frequency)) {
        return NextResponse.json({ error: 'Frecuencia inválida' }, { status: 400 });
      }
      updates.frequency = frequency;
    }

    if (retentionDays !== undefined) {
      const days = parseInt(retentionDays);
      if (isNaN(days) || days < 1 || days > 365) {
        return NextResponse.json({ error: 'Días de retención debe ser entre 1 y 365' }, { status: 400 });
      }
      updates.retentionDays = days;
    }

    await updateScraperConfig(source.toLowerCase(), updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error actualizando scraper:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/admin/alertas/scrapers - Ejecutar scrapers manualmente
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

    const body = await request.json().catch(() => ({}));
    const { sources, force = true, runPurge = false } = body;

    // Validar fuentes si se especifican
    if (sources && Array.isArray(sources)) {
      const validSources = ['seace', 'osce', 'sunat'];
      for (const s of sources) {
        if (!validSources.includes(s.toLowerCase())) {
          return NextResponse.json({ error: `Fuente inválida: ${s}` }, { status: 400 });
        }
      }
    }

    // Ejecutar scrapers
    const result = await runAllScrapers({
      force,
      runPurge,
      sources: sources?.map((s: string) => s.toLowerCase() as 'seace' | 'osce' | 'sunat'),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error ejecutando scrapers:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
