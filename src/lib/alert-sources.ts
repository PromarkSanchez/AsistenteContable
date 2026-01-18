/**
 * Servicio de Integración con Fuentes de Alertas
 * SEACE, OSCE, SUNAT, etc.
 */

import prisma from '@/lib/prisma';
import { matchesAlertConfig, createAlertHistoryEntry } from '@/lib/notification-service';

// Tipos de fuentes disponibles
export type AlertSource = 'SEACE' | 'OSCE' | 'SUNAT' | 'SISTEMA';

// Estructura de una alerta obtenida de fuentes externas
export interface ExternalAlert {
  titulo: string;
  contenido: string;
  fuente: AlertSource;
  urlOrigen?: string;
  fechaPublicacion: Date;
  region?: string;
  entidad?: string;
  monto?: number;
  tipo?: string; // LICITACION, CONTRATACION, TRIBUTARIO, etc.
  metadata?: Record<string, unknown>;
}

// Configuración de fuentes
interface SourceConfig {
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  lastSync?: Date;
}

/**
 * Obtiene la configuración de fuentes desde la base de datos
 */
async function getSourceConfig(source: AlertSource): Promise<SourceConfig> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        startsWith: `alert_source_${source.toLowerCase()}_`,
      },
    },
  });

  const config: Record<string, string> = {};
  for (const setting of settings) {
    const key = setting.key.replace(`alert_source_${source.toLowerCase()}_`, '');
    config[key] = setting.value;
  }

  return {
    enabled: config.enabled === 'true',
    apiUrl: config.api_url,
    apiKey: config.api_key,
    lastSync: config.last_sync ? new Date(config.last_sync) : undefined,
  };
}

/**
 * Actualiza la última sincronización de una fuente
 */
async function updateLastSync(source: AlertSource): Promise<void> {
  await prisma.systemSetting.upsert({
    where: {
      key: `alert_source_${source.toLowerCase()}_last_sync`,
    },
    update: {
      value: new Date().toISOString(),
    },
    create: {
      key: `alert_source_${source.toLowerCase()}_last_sync`,
      value: new Date().toISOString(),
      category: 'ALERTS',
      description: `Última sincronización de ${source}`,
    },
  });
}

/**
 * Obtiene licitaciones del SEACE (Sistema Electrónico de Contrataciones del Estado)
 * En producción, esto se conectaría a la API real del SEACE
 */
async function fetchSeaceAlerts(config: SourceConfig): Promise<ExternalAlert[]> {
  if (!config.enabled) {
    return [];
  }

  // En producción, aquí se haría la llamada a la API del SEACE
  // Por ahora, retornamos un array vacío para que el sistema esté preparado
  // cuando se configuren las credenciales

  if (config.apiUrl && config.apiKey) {
    try {
      // Ejemplo de cómo sería la integración real:
      // const response = await fetch(config.apiUrl, {
      //   headers: { 'Authorization': `Bearer ${config.apiKey}` }
      // });
      // const data = await response.json();
      // return data.map(item => transformSeaceToAlert(item));

      console.log('SEACE: API configurada, pero integración pendiente de implementar');
    } catch (error) {
      console.error('Error fetching SEACE alerts:', error);
    }
  }

  return [];
}

/**
 * Obtiene información del OSCE
 */
async function fetchOsceAlerts(config: SourceConfig): Promise<ExternalAlert[]> {
  if (!config.enabled) {
    return [];
  }

  // Similar a SEACE, se implementaría la integración real aquí
  if (config.apiUrl && config.apiKey) {
    try {
      console.log('OSCE: API configurada, pero integración pendiente de implementar');
    } catch (error) {
      console.error('Error fetching OSCE alerts:', error);
    }
  }

  return [];
}

/**
 * Obtiene notificaciones de SUNAT
 */
async function fetchSunatAlerts(config: SourceConfig): Promise<ExternalAlert[]> {
  if (!config.enabled) {
    return [];
  }

  // Integración con SUNAT
  if (config.apiUrl && config.apiKey) {
    try {
      console.log('SUNAT: API configurada, pero integración pendiente de implementar');
    } catch (error) {
      console.error('Error fetching SUNAT alerts:', error);
    }
  }

  return [];
}

/**
 * Procesa las alertas externas y las distribuye a los usuarios suscritos
 */
export async function processExternalAlerts(alerts: ExternalAlert[]): Promise<{
  processed: number;
  distributed: number;
}> {
  let distributed = 0;

  // Obtener todas las configuraciones de alertas activas
  const activeConfigs = await prisma.alertConfig.findMany({
    where: { isActive: true },
  });

  for (const alert of alerts) {
    // Buscar configuraciones que coincidan con esta alerta
    for (const config of activeConfigs) {
      // Filtrar por tipo si la configuración lo especifica
      if (alert.tipo && config.tipo !== alert.tipo) {
        continue;
      }

      // Verificar si coincide con los filtros de la configuración
      const matches = matchesAlertConfig(
        {
          palabrasClave: config.palabrasClave,
          regiones: config.regiones,
          montoMinimo: config.montoMinimo ? Number(config.montoMinimo) : null,
          montoMaximo: config.montoMaximo ? Number(config.montoMaximo) : null,
          entidades: config.entidades,
        },
        {
          titulo: alert.titulo,
          contenido: alert.contenido,
          region: alert.region,
          entidad: alert.entidad,
          monto: alert.monto,
        }
      );

      if (matches) {
        // Verificar si ya existe esta alerta para esta configuración (evitar duplicados)
        const existing = await prisma.alertHistory.findFirst({
          where: {
            alertConfigId: config.id,
            titulo: alert.titulo,
            fuente: alert.fuente,
            fechaPublicacion: alert.fechaPublicacion,
          },
        });

        if (!existing) {
          await createAlertHistoryEntry({
            alertConfigId: config.id,
            titulo: alert.titulo,
            contenido: alert.contenido,
            fuente: alert.fuente,
            urlOrigen: alert.urlOrigen,
            fechaPublicacion: alert.fechaPublicacion,
            region: alert.region,
            entidad: alert.entidad,
            monto: alert.monto,
          });
          distributed++;
        }
      }
    }
  }

  return {
    processed: alerts.length,
    distributed,
  };
}

/**
 * Sincroniza todas las fuentes de alertas configuradas
 */
export async function syncAllSources(): Promise<{
  sources: Record<AlertSource, { fetched: number; distributed: number }>;
  total: { fetched: number; distributed: number };
}> {
  const results: Record<AlertSource, { fetched: number; distributed: number }> = {
    SEACE: { fetched: 0, distributed: 0 },
    OSCE: { fetched: 0, distributed: 0 },
    SUNAT: { fetched: 0, distributed: 0 },
    SISTEMA: { fetched: 0, distributed: 0 },
  };

  const sources: { name: AlertSource; fetcher: (config: SourceConfig) => Promise<ExternalAlert[]> }[] = [
    { name: 'SEACE', fetcher: fetchSeaceAlerts },
    { name: 'OSCE', fetcher: fetchOsceAlerts },
    { name: 'SUNAT', fetcher: fetchSunatAlerts },
  ];

  for (const source of sources) {
    try {
      const config = await getSourceConfig(source.name);
      const alerts = await source.fetcher(config);

      if (alerts.length > 0) {
        const { processed, distributed } = await processExternalAlerts(alerts);
        results[source.name] = { fetched: processed, distributed };
        await updateLastSync(source.name);
      }
    } catch (error) {
      console.error(`Error syncing ${source.name}:`, error);
    }
  }

  const total = {
    fetched: Object.values(results).reduce((sum, r) => sum + r.fetched, 0),
    distributed: Object.values(results).reduce((sum, r) => sum + r.distributed, 0),
  };

  return { sources: results, total };
}

/**
 * Crea una alerta manual del sistema (para uso interno o admin)
 */
export async function createSystemAlert(alert: Omit<ExternalAlert, 'fuente'>): Promise<{
  success: boolean;
  distributed: number;
}> {
  const systemAlert: ExternalAlert = {
    ...alert,
    fuente: 'SISTEMA',
  };

  const { distributed } = await processExternalAlerts([systemAlert]);

  return {
    success: true,
    distributed,
  };
}

/**
 * Obtiene estadísticas de las fuentes de alertas
 */
export async function getSourcesStats(): Promise<{
  sources: Record<AlertSource, {
    enabled: boolean;
    lastSync?: Date;
    alertsToday: number;
    alertsTotal: number;
  }>;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sources: AlertSource[] = ['SEACE', 'OSCE', 'SUNAT', 'SISTEMA'];
  const stats: Record<AlertSource, {
    enabled: boolean;
    lastSync?: Date;
    alertsToday: number;
    alertsTotal: number;
  }> = {} as Record<AlertSource, {
    enabled: boolean;
    lastSync?: Date;
    alertsToday: number;
    alertsTotal: number;
  }>;

  for (const source of sources) {
    const config = await getSourceConfig(source);

    const [todayCount, totalCount] = await Promise.all([
      prisma.alertHistory.count({
        where: {
          fuente: source,
          createdAt: { gte: today },
        },
      }),
      prisma.alertHistory.count({
        where: { fuente: source },
      }),
    ]);

    stats[source] = {
      enabled: config.enabled,
      lastSync: config.lastSync,
      alertsToday: todayCount,
      alertsTotal: totalCount,
    };
  }

  return { sources: stats };
}

export default {
  syncAllSources,
  processExternalAlerts,
  createSystemAlert,
  getSourcesStats,
};
