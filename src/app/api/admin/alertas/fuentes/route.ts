import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

type AlertSource = 'seace' | 'osce' | 'sunat';

const SOURCES: AlertSource[] = ['seace', 'osce', 'sunat'];

// GET /api/admin/alertas/fuentes - Obtener configuración de fuentes
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

    // Obtener configuración de cada fuente
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          startsWith: 'alert_source_',
        },
      },
    });

    const config: Record<string, Record<string, string | boolean>> = {};

    for (const source of SOURCES) {
      config[source] = {
        enabled: false,
        api_url: '',
        api_key_configured: false,
        last_sync: '',
      };
    }

    for (const setting of settings) {
      for (const source of SOURCES) {
        const prefix = `alert_source_${source}_`;
        if (setting.key.startsWith(prefix)) {
          const key = setting.key.replace(prefix, '');

          if (key === 'api_key') {
            // No mostrar la API key completa
            config[source].api_key_configured = !!setting.value;
          } else if (key === 'enabled') {
            config[source].enabled = setting.value === 'true';
          } else {
            config[source][key] = setting.value;
          }
        }
      }
    }

    // Obtener cron key status y última ejecución
    const cronSettings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['alert_cron_key', 'alert_cron_last_run', 'alert_allowed_plans'],
        },
      },
    });

    const cronConfig = {
      keyConfigured: false,
      lastRun: '',
    };

    let allowedPlans = ['PRO']; // Por defecto PRO

    for (const setting of cronSettings) {
      if (setting.key === 'alert_cron_key') {
        cronConfig.keyConfigured = !!setting.value;
      } else if (setting.key === 'alert_cron_last_run') {
        cronConfig.lastRun = setting.value;
      } else if (setting.key === 'alert_allowed_plans') {
        allowedPlans = setting.value ? setting.value.split(',').map(p => p.trim()) : ['PRO'];
      }
    }

    return NextResponse.json({
      sources: config,
      cron: cronConfig,
      allowedPlans,
    });
  } catch (error) {
    console.error('Error obteniendo config de fuentes:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/admin/alertas/fuentes - Actualizar configuración de una fuente
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
    const { source, enabled, api_url, api_key, cron_key } = body;

    // Actualizar configuración de fuente
    if (source && SOURCES.includes(source)) {
      const updates: { key: string; value: string; description: string; isEncrypted?: boolean }[] = [];

      if (enabled !== undefined) {
        updates.push({
          key: `alert_source_${source}_enabled`,
          value: enabled.toString(),
          description: `${source.toUpperCase()} habilitado`,
        });
      }

      if (api_url !== undefined) {
        updates.push({
          key: `alert_source_${source}_api_url`,
          value: api_url,
          description: `URL de API de ${source.toUpperCase()}`,
        });
      }

      if (api_key !== undefined && api_key !== '') {
        updates.push({
          key: `alert_source_${source}_api_key`,
          value: encrypt(api_key),
          description: `API Key de ${source.toUpperCase()}`,
          isEncrypted: true,
        });
      }

      for (const update of updates) {
        await prisma.systemSetting.upsert({
          where: { key: update.key },
          update: {
            value: update.value,
            isEncrypted: update.isEncrypted || false,
          },
          create: {
            key: update.key,
            value: update.value,
            category: 'ALERTS',
            description: update.description,
            isEncrypted: update.isEncrypted || false,
          },
        });
      }
    }

    // Actualizar cron key
    if (cron_key !== undefined && cron_key !== '') {
      await prisma.systemSetting.upsert({
        where: { key: 'alert_cron_key' },
        update: {
          value: encrypt(cron_key),
          isEncrypted: true,
        },
        create: {
          key: 'alert_cron_key',
          value: encrypt(cron_key),
          category: 'ALERTS',
          description: 'Clave de autenticación para cron job de alertas',
          isEncrypted: true,
        },
      });
    }

    // Actualizar planes permitidos
    if (body.allowed_plans !== undefined) {
      const plansValue = Array.isArray(body.allowed_plans)
        ? body.allowed_plans.join(',')
        : body.allowed_plans;

      await prisma.systemSetting.upsert({
        where: { key: 'alert_allowed_plans' },
        update: {
          value: plansValue,
        },
        create: {
          key: 'alert_allowed_plans',
          value: plansValue,
          category: 'ALERTS',
          description: 'Planes con acceso al sistema de alertas',
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error actualizando config de fuentes:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
