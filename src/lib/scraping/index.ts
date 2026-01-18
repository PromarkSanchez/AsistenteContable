/**
 * Módulo de Web Scraping para Alertas
 * SEACE, OSCE, SUNAT
 */

import prisma from '@/lib/prisma';
import { processExternalAlerts, ExternalAlert } from '@/lib/alert-sources';

export interface ScraperConfig {
  enabled: boolean;
  frequency: string; // 'hourly', 'daily', 'weekly'
  retentionDays: number;
  lastRun?: Date;
  lastSuccess?: Date;
  lastError?: string;
}

export interface ScraperResult {
  source: string;
  success: boolean;
  alertsFound: number;
  alertsDistributed: number;
  error?: string;
  duration: number;
}

/**
 * Obtiene la configuración de un scraper
 */
export async function getScraperConfig(source: string): Promise<ScraperConfig> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: { startsWith: `scraper_${source.toLowerCase()}_` },
    },
  });

  const config: Record<string, string> = {};
  for (const setting of settings) {
    const key = setting.key.replace(`scraper_${source.toLowerCase()}_`, '');
    config[key] = setting.value;
  }

  return {
    enabled: config.enabled === 'true',
    frequency: config.frequency || 'daily',
    retentionDays: parseInt(config.retention_days || '30'),
    lastRun: config.last_run ? new Date(config.last_run) : undefined,
    lastSuccess: config.last_success ? new Date(config.last_success) : undefined,
    lastError: config.last_error || undefined,
  };
}

/**
 * Actualiza la configuración de un scraper
 */
export async function updateScraperConfig(
  source: string,
  updates: Partial<ScraperConfig>
): Promise<void> {
  const prefix = `scraper_${source.toLowerCase()}_`;

  const settings: { key: string; value: string; description: string }[] = [];

  if (updates.enabled !== undefined) {
    settings.push({
      key: `${prefix}enabled`,
      value: updates.enabled.toString(),
      description: `Scraper ${source} habilitado`,
    });
  }

  if (updates.frequency !== undefined) {
    settings.push({
      key: `${prefix}frequency`,
      value: updates.frequency,
      description: `Frecuencia de scraping ${source}`,
    });
  }

  if (updates.retentionDays !== undefined) {
    settings.push({
      key: `${prefix}retention_days`,
      value: updates.retentionDays.toString(),
      description: `Días de retención de datos ${source}`,
    });
  }

  if (updates.lastRun !== undefined) {
    settings.push({
      key: `${prefix}last_run`,
      value: updates.lastRun.toISOString(),
      description: `Última ejecución ${source}`,
    });
  }

  if (updates.lastSuccess !== undefined) {
    settings.push({
      key: `${prefix}last_success`,
      value: updates.lastSuccess.toISOString(),
      description: `Último éxito ${source}`,
    });
  }

  if (updates.lastError !== undefined) {
    settings.push({
      key: `${prefix}last_error`,
      value: updates.lastError,
      description: `Último error ${source}`,
    });
  }

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: {
        key: setting.key,
        value: setting.value,
        category: 'ALERTS',
        description: setting.description,
      },
    });
  }
}

/**
 * Registra el resultado de una ejecución de scraping
 */
export async function logScraperRun(result: ScraperResult): Promise<void> {
  const now = new Date();

  await updateScraperConfig(result.source, {
    lastRun: now,
    ...(result.success ? { lastSuccess: now, lastError: '' } : { lastError: result.error }),
  });

  // Log para debugging
  console.log(`[Scraper ${result.source}] ${result.success ? 'SUCCESS' : 'FAILED'} - ` +
    `Found: ${result.alertsFound}, Distributed: ${result.alertsDistributed}, ` +
    `Duration: ${result.duration}ms${result.error ? `, Error: ${result.error}` : ''}`);
}

/**
 * Ejecuta la depuración de datos antiguos
 */
export async function purgeOldAlerts(): Promise<{ deleted: number }> {
  const sources = ['seace', 'osce', 'sunat'];
  let totalDeleted = 0;

  for (const source of sources) {
    const config = await getScraperConfig(source);
    if (config.retentionDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

      const result = await prisma.alertHistory.deleteMany({
        where: {
          fuente: source.toUpperCase(),
          createdAt: { lt: cutoffDate },
          isRead: true, // Solo eliminar las ya leídas
        },
      });

      totalDeleted += result.count;
    }
  }

  console.log(`[Purge] Deleted ${totalDeleted} old alerts`);
  return { deleted: totalDeleted };
}

/**
 * Verifica si un scraper debe ejecutarse según su frecuencia
 */
export function shouldRunScraper(config: ScraperConfig): boolean {
  if (!config.enabled) return false;
  if (!config.lastRun) return true;

  const now = new Date();
  const lastRun = new Date(config.lastRun);
  const diffHours = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

  switch (config.frequency) {
    case 'hourly':
      return diffHours >= 1;
    case 'daily':
      return diffHours >= 24;
    case 'weekly':
      return diffHours >= 168;
    default:
      return diffHours >= 24;
  }
}

/**
 * Procesa las alertas obtenidas y las distribuye
 */
export async function processScrapedAlerts(
  alerts: ExternalAlert[]
): Promise<{ distributed: number }> {
  if (alerts.length === 0) {
    return { distributed: 0 };
  }

  const result = await processExternalAlerts(alerts);
  return { distributed: result.distributed };
}

export type { ExternalAlert };
