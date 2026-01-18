/**
 * Orquestador de Scrapers
 * Coordina la ejecución de todos los scrapers y la depuración de datos
 */

import { runSeaceScraper } from './seace-scraper';
import { runSeacePuppeteerScraper, isSeacePuppeteerEnabled } from './seace-puppeteer';
import { runOsceScraper } from './osce-scraper';
import { runSunatScraper } from './sunat-scraper';
import { purgeOldAlerts, getScraperConfig, ScraperResult } from './index';
import { scraperLogger, createSessionLogger } from './scraper-logger';

export interface OrchestratorResult {
  success: boolean;
  timestamp: Date;
  duration: number;
  sessionId: string; // ID de la sesión de logs
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

  // Determinar qué scrapers ejecutar
  const scrapersToRun = sources || ['seace', 'osce', 'sunat'];

  // Crear sesión de logging
  const sessionId = scraperLogger.startSession('Orchestrator');
  const log = createSessionLogger(sessionId, 'Orchestrator');

  log.info(`Iniciando orquestación de scrapers: ${scrapersToRun.map(s => s.toUpperCase()).join(', ')}`);
  log.info(`Modo forzado: ${force ? 'Sí' : 'No'}, Purgar datos: ${runPurge ? 'Sí' : 'No'}`);

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
    sessionId,
    scrapers: {
      seace: { ...defaultResult, source: 'SEACE' },
      osce: { ...defaultResult, source: 'OSCE' },
      sunat: { ...defaultResult, source: 'SUNAT' },
    },
    totalAlertsFound: 0,
    totalAlertsDistributed: 0,
    errors: [],
  };

  // Ejecutar scrapers en paralelo
  const scraperPromises: Promise<void>[] = [];

  if (scrapersToRun.includes('seace')) {
    scraperPromises.push(
      (async () => {
        try {
          const config = await getScraperConfig('seace');
          log.info(`SEACE configuración: habilitado=${config.enabled}`);

          if (config.enabled || force) {
            // Verificar si SEACE Puppeteer (con login) está habilitado
            const puppeteerEnabled = await isSeacePuppeteerEnabled();

            if (puppeteerEnabled) {
              log.info('Usando SEACE Puppeteer (con login)...');
              results.scrapers.seace = await runSeacePuppeteerScraper(force, sessionId);
            } else {
              log.info('Usando SEACE scraper básico (sin login)...');
              results.scrapers.seace = await runSeaceScraper(force);
            }

            if (results.scrapers.seace.success) {
              log.success(`SEACE completado: ${results.scrapers.seace.alertsFound} alertas encontradas, ${results.scrapers.seace.alertsDistributed} distribuidas`);
            } else {
              log.error(`SEACE falló: ${results.scrapers.seace.error}`);
              errors.push(`SEACE: ${results.scrapers.seace.error}`);
            }
          } else {
            log.warning('SEACE deshabilitado, saltando...');
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          log.error(`SEACE error: ${msg}`);
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
          log.info(`OSCE configuración: habilitado=${config.enabled}`);

          if (config.enabled || force) {
            log.info('Iniciando scraper OSCE...');
            results.scrapers.osce = await runOsceScraper(force);

            if (results.scrapers.osce.success) {
              log.success(`OSCE completado: ${results.scrapers.osce.alertsFound} alertas encontradas`);
            } else {
              log.error(`OSCE falló: ${results.scrapers.osce.error}`);
              errors.push(`OSCE: ${results.scrapers.osce.error}`);
            }
          } else {
            log.warning('OSCE deshabilitado, saltando...');
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          log.error(`OSCE error: ${msg}`);
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
          log.info(`SUNAT configuración: habilitado=${config.enabled}`);

          if (config.enabled || force) {
            log.info('Iniciando scraper SUNAT...');
            results.scrapers.sunat = await runSunatScraper(force);

            if (results.scrapers.sunat.success) {
              log.success(`SUNAT completado: ${results.scrapers.sunat.alertsFound} alertas encontradas`);
            } else {
              log.error(`SUNAT falló: ${results.scrapers.sunat.error}`);
              errors.push(`SUNAT: ${results.scrapers.sunat.error}`);
            }
          } else {
            log.warning('SUNAT deshabilitado, saltando...');
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          log.error(`SUNAT error: ${msg}`);
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
  log.info('Esperando finalización de todos los scrapers...');
  await Promise.all(scraperPromises);

  // Ejecutar depuración si está habilitada
  if (runPurge) {
    try {
      log.info('Ejecutando limpieza de datos antiguos...');
      results.purge = await purgeOldAlerts();
      log.success(`Limpieza completada: ${results.purge.deleted} registros eliminados`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Error en limpieza: ${msg}`);
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

  // Log final
  if (results.success) {
    log.success(`Orquestación completada exitosamente en ${(results.duration / 1000).toFixed(1)}s`);
    log.success(`Total: ${results.totalAlertsFound} alertas encontradas, ${results.totalAlertsDistributed} distribuidas`);
  } else {
    log.error(`Orquestación completada con errores en ${(results.duration / 1000).toFixed(1)}s`);
    log.error(`Errores: ${errors.join(', ')}`);
  }

  // Finalizar sesión de logging
  scraperLogger.endSession(sessionId, results.success);

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

/**
 * Ejecuta todos los scrapers con una sesión de logs existente
 * (Para ejecución en segundo plano donde la sesión ya fue creada)
 */
export async function runAllScrapersWithExistingSession(
  sessionId: string,
  options: {
    force?: boolean;
    runPurge?: boolean;
    sources?: ('seace' | 'osce' | 'sunat')[];
  } = {}
): Promise<OrchestratorResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const { force = false, runPurge = true, sources } = options;

  // Determinar qué scrapers ejecutar
  const scrapersToRun = sources || ['seace', 'osce', 'sunat'];

  // Usar la sesión existente
  const log = createSessionLogger(sessionId, 'Orchestrator');

  log.info(`Iniciando orquestación de scrapers: ${scrapersToRun.map(s => s.toUpperCase()).join(', ')}`);
  log.info(`Modo forzado: ${force ? 'Sí' : 'No'}, Purgar datos: ${runPurge ? 'Sí' : 'No'}`);

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
    sessionId,
    scrapers: {
      seace: { ...defaultResult, source: 'SEACE' },
      osce: { ...defaultResult, source: 'OSCE' },
      sunat: { ...defaultResult, source: 'SUNAT' },
    },
    totalAlertsFound: 0,
    totalAlertsDistributed: 0,
    errors: [],
  };

  // Ejecutar scrapers en paralelo
  const scraperPromises: Promise<void>[] = [];

  if (scrapersToRun.includes('seace')) {
    scraperPromises.push(
      (async () => {
        try {
          const config = await getScraperConfig('seace');
          log.info(`SEACE configuración: habilitado=${config.enabled}`);

          if (config.enabled || force) {
            const puppeteerEnabled = await isSeacePuppeteerEnabled();

            if (puppeteerEnabled) {
              log.info('Usando SEACE Puppeteer (con login)...');
              results.scrapers.seace = await runSeacePuppeteerScraper(force, sessionId);
            } else {
              log.info('Usando SEACE scraper básico (sin login)...');
              results.scrapers.seace = await runSeaceScraper(force);
            }

            if (results.scrapers.seace.success) {
              log.success(`SEACE completado: ${results.scrapers.seace.alertsFound} alertas encontradas, ${results.scrapers.seace.alertsDistributed} distribuidas`);
            } else {
              log.error(`SEACE falló: ${results.scrapers.seace.error}`);
              errors.push(`SEACE: ${results.scrapers.seace.error}`);
            }
          } else {
            log.warning('SEACE deshabilitado, saltando...');
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          log.error(`SEACE error: ${msg}`);
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
          log.info(`OSCE configuración: habilitado=${config.enabled}`);

          if (config.enabled || force) {
            log.info('Iniciando scraper OSCE...');
            results.scrapers.osce = await runOsceScraper(force);

            if (results.scrapers.osce.success) {
              log.success(`OSCE completado: ${results.scrapers.osce.alertsFound} alertas encontradas`);
            } else {
              log.error(`OSCE falló: ${results.scrapers.osce.error}`);
              errors.push(`OSCE: ${results.scrapers.osce.error}`);
            }
          } else {
            log.warning('OSCE deshabilitado, saltando...');
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          log.error(`OSCE error: ${msg}`);
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
          log.info(`SUNAT configuración: habilitado=${config.enabled}`);

          if (config.enabled || force) {
            log.info('Iniciando scraper SUNAT...');
            results.scrapers.sunat = await runSunatScraper(force);

            if (results.scrapers.sunat.success) {
              log.success(`SUNAT completado: ${results.scrapers.sunat.alertsFound} alertas encontradas`);
            } else {
              log.error(`SUNAT falló: ${results.scrapers.sunat.error}`);
              errors.push(`SUNAT: ${results.scrapers.sunat.error}`);
            }
          } else {
            log.warning('SUNAT deshabilitado, saltando...');
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          log.error(`SUNAT error: ${msg}`);
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
  log.info('Esperando finalización de todos los scrapers...');
  await Promise.all(scraperPromises);

  // Ejecutar depuración si está habilitada
  if (runPurge) {
    try {
      log.info('Ejecutando limpieza de datos antiguos...');
      results.purge = await purgeOldAlerts();
      log.success(`Limpieza completada: ${results.purge.deleted} registros eliminados`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Error en limpieza: ${msg}`);
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

  // Log final
  if (results.success) {
    log.success(`Orquestación completada exitosamente en ${(results.duration / 1000).toFixed(1)}s`);
    log.success(`Total: ${results.totalAlertsFound} alertas encontradas, ${results.totalAlertsDistributed} distribuidas`);
  } else {
    log.error(`Orquestación completada con errores en ${(results.duration / 1000).toFixed(1)}s`);
    log.error(`Errores: ${errors.join(', ')}`);
  }

  // Finalizar sesión de logging
  scraperLogger.endSession(sessionId, results.success);

  return results;
}

export default {
  runAllScrapers,
  runAllScrapersWithExistingSession,
  getScrapersStatus,
};
