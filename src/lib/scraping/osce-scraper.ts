/**
 * Scraper de OSCE - Organismo Supervisor de las Contrataciones del Estado
 * Portal: https://portal.osce.gob.pe/
 */

import * as cheerio from 'cheerio';
import {
  getScraperConfig,
  logScraperRun,
  shouldRunScraper,
  processScrapedAlerts,
  ScraperResult,
  ExternalAlert,
} from './index';
import { fetchWithFallback } from './fetch-utils';

const OSCE_BASE_URL = 'https://portal.osce.gob.pe';
const OSCE_NOTICIAS_URL = `${OSCE_BASE_URL}/osce/content/noticias`;
const OSCE_COMUNICADOS_URL = `${OSCE_BASE_URL}/osce/content/comunicados`;

interface OsceNoticia {
  titulo: string;
  resumen: string;
  fecha: Date;
  url?: string;
  categoria?: string;
}

/**
 * Obtiene las noticias recientes de OSCE
 */
async function fetchOsceNoticias(): Promise<OsceNoticia[]> {
  const noticias: OsceNoticia[] = [];

  try {
    const html = await fetchWithFallback(OSCE_NOTICIAS_URL);
    const $ = cheerio.load(html);

    // Buscar noticias en la página
    // Selectores basados en estructura típica de portales gubernamentales
    $('.noticia-item, .news-item, article, .views-row').each((_, item) => {
      try {
        const titulo = $(item).find('h2, h3, .titulo, .title, a').first().text().trim();
        const resumen = $(item).find('p, .resumen, .summary, .body').first().text().trim();
        const fechaText = $(item).find('.fecha, .date, time, .field-date').text().trim();
        const link = $(item).find('a').attr('href');

        if (titulo && titulo.length > 10) {
          const fecha = parseFecha(fechaText) || new Date();
          const url = link ? (link.startsWith('http') ? link : `${OSCE_BASE_URL}${link}`) : undefined;

          noticias.push({
            titulo,
            resumen: resumen || titulo,
            fecha,
            url,
            categoria: 'NOTICIA',
          });
        }
      } catch (e) {
        // Ignorar items que no se pueden parsear
      }
    });

    // Si no se encontraron noticias, intentar con estructura alternativa
    if (noticias.length === 0) {
      $('div[class*="noticia"], div[class*="news"]').each((_, item) => {
        try {
          const titulo = $(item).find('a, h2, h3, h4').first().text().trim();
          const resumen = $(item).text().replace(titulo, '').trim().substring(0, 300);

          if (titulo && titulo.length > 10) {
            noticias.push({
              titulo,
              resumen: resumen || titulo,
              fecha: new Date(),
              categoria: 'NOTICIA',
            });
          }
        } catch (e) {
          // Ignorar
        }
      });
    }

  } catch (error) {
    console.error('[OSCE Scraper] Error fetching noticias:', error);
    // No lanzar el error, intentar comunicados
  }

  return noticias;
}

/**
 * Obtiene los comunicados de OSCE
 */
async function fetchOsceComunicados(): Promise<OsceNoticia[]> {
  const comunicados: OsceNoticia[] = [];

  try {
    const html = await fetchWithFallback(OSCE_COMUNICADOS_URL);
    const $ = cheerio.load(html);

    // Buscar comunicados
    $('.comunicado-item, .views-row, article, .node').each((_, item) => {
      try {
        const titulo = $(item).find('h2, h3, .titulo, .title, a').first().text().trim();
        const resumen = $(item).find('p, .resumen, .body').first().text().trim();
        const fechaText = $(item).find('.fecha, .date, time').text().trim();
        const link = $(item).find('a').attr('href');

        if (titulo && titulo.length > 10) {
          const fecha = parseFecha(fechaText) || new Date();
          const url = link ? (link.startsWith('http') ? link : `${OSCE_BASE_URL}${link}`) : undefined;

          comunicados.push({
            titulo,
            resumen: resumen || titulo,
            fecha,
            url,
            categoria: 'COMUNICADO',
          });
        }
      } catch (e) {
        // Ignorar
      }
    });

  } catch (error) {
    console.error('[OSCE Scraper] Error fetching comunicados:', error);
  }

  return comunicados;
}

/**
 * Parsea diferentes formatos de fecha
 */
function parseFecha(fechaStr: string): Date | null {
  try {
    // Formato: dd/mm/yyyy o dd-mm-yyyy
    const match1 = fechaStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match1) {
      const [, day, month, year] = match1;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Formato: "dd de mes de yyyy"
    const meses: Record<string, number> = {
      'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
      'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
    };
    const match2 = fechaStr.toLowerCase().match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
    if (match2) {
      const [, day, mes, year] = match2;
      const month = meses[mes];
      if (month !== undefined) {
        return new Date(parseInt(year), month, parseInt(day));
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Convierte noticias de OSCE a formato de alerta
 */
function convertToAlerts(noticias: OsceNoticia[]): ExternalAlert[] {
  return noticias.map(noticia => ({
    titulo: noticia.titulo,
    contenido: noticia.resumen,
    fuente: 'OSCE' as const,
    urlOrigen: noticia.url,
    fechaPublicacion: noticia.fecha,
    tipo: noticia.categoria === 'COMUNICADO' ? 'COMUNICADO' : 'NOTICIA',
  }));
}

/**
 * Ejecuta el scraper de OSCE
 */
export async function runOsceScraper(force = false): Promise<ScraperResult> {
  const startTime = Date.now();
  const config = await getScraperConfig('osce');

  // Verificar si debe ejecutarse
  if (!force && !shouldRunScraper(config)) {
    return {
      source: 'OSCE',
      success: true,
      alertsFound: 0,
      alertsDistributed: 0,
      duration: Date.now() - startTime,
    };
  }

  try {
    // Obtener noticias y comunicados
    const [noticias, comunicados] = await Promise.all([
      fetchOsceNoticias(),
      fetchOsceComunicados(),
    ]);

    const allNoticias = [...noticias, ...comunicados];

    // Convertir a alertas
    const alerts = convertToAlerts(allNoticias);

    // Procesar y distribuir
    const { distributed } = await processScrapedAlerts(alerts);

    const result: ScraperResult = {
      source: 'OSCE',
      success: true,
      alertsFound: alerts.length,
      alertsDistributed: distributed,
      duration: Date.now() - startTime,
    };

    await logScraperRun(result);
    return result;

  } catch (error) {
    const result: ScraperResult = {
      source: 'OSCE',
      success: false,
      alertsFound: 0,
      alertsDistributed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };

    await logScraperRun(result);
    return result;
  }
}

export default runOsceScraper;
