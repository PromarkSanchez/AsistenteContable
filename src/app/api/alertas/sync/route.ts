import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncAllSources, getSourcesStats } from '@/lib/alert-sources';
import { processUserAlerts } from '@/lib/notification-service';
import { runAllScrapers } from '@/lib/scraping/orchestrator';
import { checkPendingAlerts, notifyNewLicitaciones } from '@/lib/scraping/alert-scheduler';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos para scrapers (requiere Vercel Pro)

// Verifica autenticación para cron jobs
// Soporta: CRON_SECRET de Vercel o clave personalizada en SystemSettings
async function verifyCronAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const cronKey = authHeader?.replace('Bearer ', '');

  // 1. Verificar CRON_SECRET de Vercel (variable de entorno)
  const vercelCronSecret = process.env.CRON_SECRET;
  if (vercelCronSecret && cronKey === vercelCronSecret) {
    return true;
  }

  // 2. Verificar clave personalizada en SystemSettings
  if (cronKey) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'alert_cron_key' },
    });
    if (setting?.value === cronKey) {
      return true;
    }
  }

  return false;
}

// GET /api/alertas/sync - Ejecutar cron de Vercel o obtener stats
// Vercel Cron usa GET por defecto
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const isCronJob = await verifyCronAuth(request);

    // Si es un cron job de Vercel, ejecutar scrapers
    if (isCronJob) {
      // Obtener fuentes a ejecutar desde query params
      const { searchParams } = new URL(request.url);
      const sourcesParam = searchParams.get('sources');
      const sources = sourcesParam
        ? (sourcesParam.split(',') as ('seace' | 'osce' | 'sunat')[])
        : undefined; // undefined = todas las fuentes

      console.log(`[Cron] Iniciando scrapers: ${sources?.join(', ') || 'todas'}...`);

      const scrapingResult = await runAllScrapers({
        force: false,
        runPurge: !sources, // Solo purgar cuando se ejecutan todas
        sources,
      });

      // Verificar alertas basadas en fechas (licitaciones próximas a vencer)
      console.log('[Cron] Verificando alertas por fecha de vencimiento...');
      const alertsResult = await checkPendingAlerts();

      // Notificar licitaciones nuevas
      console.log('[Cron] Notificando licitaciones nuevas...');
      const newLicitacionesResult = await notifyNewLicitaciones();

      // Registrar la ejecución
      await prisma.systemSetting.upsert({
        where: { key: 'alert_cron_last_run' },
        update: { value: new Date().toISOString() },
        create: {
          key: 'alert_cron_last_run',
          value: new Date().toISOString(),
          category: 'ALERTS',
          description: 'Última ejecución del cron de alertas',
        },
      });

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        scraping: {
          success: scrapingResult.success,
          duration: scrapingResult.duration,
          alertsFound: scrapingResult.totalAlertsFound,
          alertsDistributed: scrapingResult.totalAlertsDistributed,
          errors: scrapingResult.errors,
        },
        // Alertas basadas en fechas de vencimiento
        scheduledAlerts: {
          licitacionesChecked: alertsResult.checked,
          alertsGenerated: alertsResult.alertsGenerated,
          emailsSent: alertsResult.emailsSent,
          errors: alertsResult.errors,
        },
        // Licitaciones nuevas notificadas
        newLicitaciones: {
          found: newLicitacionesResult.newFound,
          notified: newLicitacionesResult.notified,
          errors: newLicitacionesResult.errors,
        },
      });
    }

    // Si es un usuario admin, mostrar stats
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

    const stats = await getSourcesStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error en GET /api/alertas/sync:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/alertas/sync - Ejecutar sincronización de fuentes
// Puede ser llamado por:
// 1. Un cron job externo (con cron key)
// 2. Un admin manualmente
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación - puede ser cron key o usuario admin
    const userId = request.headers.get('x-user-id');
    const isCronJob = await verifyCronAuth(request);

    if (!isCronJob && !userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!isCronJob && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isSuperadmin: true },
      });

      if (!user?.isSuperadmin) {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const { action, sendNotifications, runScrapers, checkScheduled } = body;

    let result: Record<string, unknown> = {};

    // Ejecutar scrapers para obtener datos de SEACE, OSCE, SUNAT
    if (action === 'scrape' || runScrapers) {
      const scrapingResult = await runAllScrapers({ force: false, runPurge: true });
      result.scraping = {
        success: scrapingResult.success,
        duration: scrapingResult.duration,
        alertsFound: scrapingResult.totalAlertsFound,
        alertsDistributed: scrapingResult.totalAlertsDistributed,
        errors: scrapingResult.errors,
      };
    }

    // Verificar y enviar alertas basadas en fechas de vencimiento
    if (action === 'checkScheduled' || checkScheduled) {
      const alertsResult = await checkPendingAlerts();
      const newResult = await notifyNewLicitaciones();
      result.scheduledAlerts = {
        licitacionesChecked: alertsResult.checked,
        alertsGenerated: alertsResult.alertsGenerated,
        emailsSent: alertsResult.emailsSent,
        newLicitaciones: newResult.newFound,
        notified: newResult.notified,
        errors: [...alertsResult.errors, ...newResult.errors],
      };
    }

    // Sincronizar fuentes externas (APIs si están configuradas)
    if (action === 'sync' || (!action && !runScrapers)) {
      const syncResult = await syncAllSources();
      result.sync = syncResult;
    }

    // Enviar notificaciones por email a usuarios con alertas pendientes
    if (action === 'notify' || sendNotifications) {
      const usersWithAlerts = await prisma.alertConfig.findMany({
        where: {
          isActive: true,
          emailEnabled: true,
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
      });

      let totalNotified = 0;
      for (const config of usersWithAlerts) {
        const sent = await processUserAlerts(config.userId);
        totalNotified += sent;
      }

      result.notifications = {
        usersProcessed: usersWithAlerts.length,
        emailsSent: totalNotified,
      };
    }

    // Registrar la ejecución del cron
    await prisma.systemSetting.upsert({
      where: { key: 'alert_cron_last_run' },
      update: { value: new Date().toISOString() },
      create: {
        key: 'alert_cron_last_run',
        value: new Date().toISOString(),
        category: 'ALERTS',
        description: 'Última ejecución del cron de alertas',
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Error en sincronización de alertas:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
