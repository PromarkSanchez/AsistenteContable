/**
 * Orquestador de Scrapers
 * Coordina la ejecución de todos los scrapers y la depuración de datos
 */

import { runSeaceScraper } from './seace-scraper';
import { runOsceScraper } from './osce-scraper';
import { runSunatScraper } from './sunat-scraper';
import { purgeOldAlerts, getScraperConfig, ScraperResult } from './index';

export interface OrchestratorResult {
  success: boolean;
  timestamp: Date;
  duration: number;
  scrapers: {
    seace: ScraperResult;
    osce: ScraperResult;
    sunat: ScraperResult;
  };
  purge?: {
    deleted: number;
  };
  totalAlertsFound: number;
  totalAlertsDistributed: number;
  errors: string[];
}

/**
 * Ejecuta todos los scrapers habilitados
 */
export async function runAllScrapers(options: {
  force?: boolean;
  runPurge?: boolean;
  sources?: ('seace' | 'osce' | 'sunat')[];
} = {}): Promise<OrchestratorResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const { force = false, runPurge = true, sources } = options;

  // Resultados por defecto (scraper no ejecutado)
  const defaultResult: ScraperResult = {
    source: '',
    success: true,
    alertsFound: 0,
    alertsDistributed: 0,
    duration: 0,
  };

  const results: OrchestratorResult = {
    success: true,
    timestamp: new Date(),
    duration: 0,
    scrapers: {
      seace: { ...defaultResult, source: 'SEACE' },
      osce: { ...defaultResult, source: 'OSCE' },
      sunat: { ...defaultResult, source: 'SUNAT' },
    },
    totalAlertsFound: 0,
    totalAlertsDistributed: 0,
    errors: [],
  };

  // Determinar qué scrapers ejecutar
  const scrapersToRun = sources || ['seace', 'osce', 'sunat'];

  // Ejecutar scrapers en paralelo
  const scraperPromises: Promise<void>[] = [];

  if (scrapersToRun.includes('seace')) {
    scraperPromises.push(
      (async () => {
        try {
          const config = await getScraperConfig('seace');
          if (config.enabled || force) {
            results.scrapers.seace = await runSeaceScraper(force);
            if (!results.scrapers.seace.success) {
              errors.push(`SEACE: ${results.scrapers.seace.error}`);
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`SEACE: ${msg}`);
          results.scrapers.seace = {
            source: 'SEACE',
            success: false,
            alertsFound: 0,
            alertsDistributed: 0,
            error: msg,
            duration: 0,
          };
        }
      })()
    );
  }

  if (scrapersToRun.includes('osce')) {
    scraperPromises.push(
      (async () => {
        try {
          const config = await getScraperConfig('osce');
          if (config.enabled || force) {
            results.scrapers.osce = await runOsceScraper(force);
            if (!results.scrapers.osce.success) {
              errors.push(`OSCE: ${results.scrapers.osce.error}`);
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`OSCE: ${msg}`);
          results.scrapers.osce = {
            source: 'OSCE',
            success: false,
            alertsFound: 0,
            alertsDistributed: 0,
            error: msg,
            duration: 0,
          };
        }
      })()
    );
  }

  if (scrapersToRun.includes('sunat')) {
    scraperPromises.push(
      (async () => {
        try {
          const config = await getScraperConfig('sunat');
          if (config.enabled || force) {
            results.scrapers.sunat = await runSunatScraper(force);
            if (!results.scrapers.sunat.success) {
              errors.push(`SUNAT: ${results.scrapers.sunat.error}`);
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`SUNAT: ${msg}`);
          results.scrapers.sunat = {
            source: 'SUNAT',
            success: false,
            alertsFound: 0,
            alertsDistributed: 0,
            error: msg,
            duration: 0,
          };
        }
      })()
    );
  }

  // Esperar a que todos los scrapers terminen
  await Promise.all(scraperPromises);

  // Ejecutar depuración si está habilitada
  if (runPurge) {
    try {
      results.purge = await purgeOldAlerts();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Purge: ${msg}`);
    }
  }

  // Calcular totales
  results.totalAlertsFound =
    results.scrapers.seace.alertsFound +
    results.scrapers.osce.alertsFound +
    results.scrapers.sunat.alertsFound;

  results.totalAlertsDistributed =
    results.scrapers.seace.alertsDistributed +
    results.scrapers.osce.alertsDistributed +
    results.scrapers.sunat.alertsDistributed;

  results.errors = errors;
  results.success = errors.length === 0;
  results.duration = Date.now() - startTime;

  console.log(`[Orchestrator] Completed in ${results.duration}ms - ` +
    `Found: ${results.totalAlertsFound}, Distributed: ${results.totalAlertsDistributed}, ` +
    `Errors: ${errors.length}`);

  return results;
}

/**
 * Obtiene el estado actual de todos los scrapers
 */
export async function getScrapersStatus(): Promise<{
  scrapers: Record<string, {
    enabled: boolean;
    frequency: string;
    retentionDays: number;
    lastRun?: Date;
    lastSuccess?: Date;
    lastError?: string;
  }>;
}> {
  const [seace, osce, sunat] = await Promise.all([
    getScraperConfig('seace'),
    getScraperConfig('osce'),
    getScraperConfig('sunat'),
  ]);

  return {
    scrapers: {
      seace,
      osce,
      sunat,
    },
  };
}

export default {
  runAllScrapers,
  getScrapersStatus,
};
