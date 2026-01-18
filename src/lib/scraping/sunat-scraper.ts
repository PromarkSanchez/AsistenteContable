/**
 * Scraper de SUNAT - Superintendencia Nacional de Aduanas y de Administración Tributaria
 * Portal: https://www.sunat.gob.pe/
 *
 * Nota: Este scraper obtiene información pública (noticias, comunicados, normativa)
 * No accede a información privada del contribuyente
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

const SUNAT_BASE_URL = 'https://www.sunat.gob.pe';
const SUNAT_NOTICIAS_URL = `${SUNAT_BASE_URL}/saludasunat/web/main/noticias`;
const SUNAT_LEGISLACION_URL = `${SUNAT_BASE_URL}/legislacion/`;
const SUNAT_ORIENTACION_URL = `${SUNAT_BASE_URL}/orientacionaduanera/`;

interface SunatNoticia {
  titulo: string;
  contenido: string;
  fecha: Date;
  url?: string;
  tipo: 'NOTICIA' | 'NORMA' | 'COMUNICADO' | 'RESOLUCION';
}

/**
 * Obtiene las noticias recientes de SUNAT
 */
async function fetchSunatNoticias(): Promise<SunatNoticia[]> {
  const noticias: SunatNoticia[] = [];

  try {
    // Página principal de SUNAT suele tener noticias
    const html = await fetchWithFallback(SUNAT_BASE_URL);
    const $ = cheerio.load(html);

    // Buscar noticias en diferentes secciones
    // La estructura del portal de SUNAT puede variar
    $('article, .noticia, .news-item, .content-item, div[class*="noticia"]').each((_, item) => {
      try {
        const titulo = $(item).find('h1, h2, h3, h4, .titulo, .title, a').first().text().trim();
        const contenido = $(item).find('p, .contenido, .body, .resumen').first().text().trim();
        const fechaText = $(item).find('.fecha, .date, time, span[class*="date"]').text().trim();
        const link = $(item).find('a').attr('href');

        if (titulo && titulo.length > 10) {
          const fecha = parseFecha(fechaText) || new Date();
          const url = link ? normalizeUrl(link) : undefined;

          noticias.push({
            titulo,
            contenido: contenido || titulo,
            fecha,
            url,
            tipo: 'NOTICIA',
          });
        }
      } catch (e) {
        // Ignorar items que no se pueden parsear
      }
    });

    // Buscar también en sección de últimas noticias/novedades
    $('.ultimas-noticias li, .novedades li, .lista-noticias li').each((_, item) => {
      try {
        const titulo = $(item).find('a').text().trim() || $(item).text().trim();
        const link = $(item).find('a').attr('href');

        if (titulo && titulo.length > 10) {
          noticias.push({
            titulo,
            contenido: titulo,
            fecha: new Date(),
            url: link ? normalizeUrl(link) : undefined,
            tipo: 'NOTICIA',
          });
        }
      } catch (e) {
        // Ignorar
      }
    });

  } catch (error) {
    console.error('[SUNAT Scraper] Error fetching noticias:', error);
  }

  return noticias;
}

/**
 * Obtiene las normas/resoluciones recientes
 */
async function fetchSunatNormas(): Promise<SunatNoticia[]> {
  const normas: SunatNoticia[] = [];

  try {
    // SUNAT tiene una sección de legislación
    const html = await fetchWithFallback(SUNAT_LEGISLACION_URL);
    const $ = cheerio.load(html);

    // Buscar resoluciones y normas
    $('table tr, .norma-item, .resolucion, li').each((_, item) => {
      try {
        const texto = $(item).text().trim();
        const link = $(item).find('a').attr('href');

        // Detectar si es una resolución o norma
        const esResolucion = /resoluci[oó]n|decreto|norma|ley/i.test(texto);

        if (esResolucion && texto.length > 20) {
          // Extraer número y título
          const match = texto.match(/(Resoluci[oó]n.*?\d+[-\/]\d+|Decreto.*?\d+[-\/]\d+|Norma.*?\d+[-\/]\d+)/i);
          const titulo = match ? match[1] : texto.substring(0, 100);
          const contenido = texto;

          // Intentar extraer fecha
          const fechaMatch = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          const fecha = fechaMatch
            ? new Date(parseInt(fechaMatch[3]), parseInt(fechaMatch[2]) - 1, parseInt(fechaMatch[1]))
            : new Date();

          normas.push({
            titulo,
            contenido,
            fecha,
            url: link ? normalizeUrl(link) : undefined,
            tipo: 'RESOLUCION',
          });
        }
      } catch (e) {
        // Ignorar
      }
    });

  } catch (error) {
    console.error('[SUNAT Scraper] Error fetching normas:', error);
  }

  return normas;
}

/**
 * Obtiene comunicados y avisos importantes
 */
async function fetchSunatComunicados(): Promise<SunatNoticia[]> {
  const comunicados: SunatNoticia[] = [];

  try {
    // Intentar obtener comunicados de la página principal o sección de prensa
    const urls = [
      SUNAT_BASE_URL,
      `${SUNAT_BASE_URL}/institucional/prensa/`,
    ];

    for (const url of urls) {
      try {
        const html = await fetchWithFallback(url);
        const $ = cheerio.load(html);

        // Buscar comunicados, avisos, alertas
        $('.comunicado, .aviso, .alerta, div[class*="comunicado"], div[class*="aviso"]').each((_, item) => {
          try {
            const titulo = $(item).find('h1, h2, h3, h4, .titulo, strong').first().text().trim();
            const contenido = $(item).find('p, .contenido').first().text().trim();
            const link = $(item).find('a').attr('href');

            if (titulo && titulo.length > 10) {
              comunicados.push({
                titulo,
                contenido: contenido || titulo,
                fecha: new Date(),
                url: link ? normalizeUrl(link) : undefined,
                tipo: 'COMUNICADO',
              });
            }
          } catch (e) {
            // Ignorar
          }
        });
      } catch (e) {
        // Continuar con la siguiente URL
      }
    }

  } catch (error) {
    console.error('[SUNAT Scraper] Error fetching comunicados:', error);
  }

  return comunicados;
}

/**
 * Normaliza una URL
 */
function normalizeUrl(url: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SUNAT_BASE_URL}${url}`;
  return `${SUNAT_BASE_URL}/${url}`;
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
 * Convierte noticias de SUNAT a formato de alerta
 */
function convertToAlerts(noticias: SunatNoticia[]): ExternalAlert[] {
  return noticias.map(noticia => ({
    titulo: noticia.titulo,
    contenido: noticia.contenido,
    fuente: 'SUNAT' as const,
    urlOrigen: noticia.url,
    fechaPublicacion: noticia.fecha,
    tipo: noticia.tipo === 'RESOLUCION' ? 'TRIBUTARIO' : 'NOTICIA',
  }));
}

/**
 * Elimina duplicados basándose en el título
 */
function removeDuplicates(noticias: SunatNoticia[]): SunatNoticia[] {
  const seen = new Set<string>();
  return noticias.filter(n => {
    const key = n.titulo.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Ejecuta el scraper de SUNAT
 */
export async function runSunatScraper(force = false): Promise<ScraperResult> {
  const startTime = Date.now();
  const config = await getScraperConfig('sunat');

  // Verificar si debe ejecutarse
  if (!force && !shouldRunScraper(config)) {
    return {
      source: 'SUNAT',
      success: true,
      alertsFound: 0,
      alertsDistributed: 0,
      duration: Date.now() - startTime,
    };
  }

  try {
    // Obtener información de diferentes secciones
    const [noticias, normas, comunicados] = await Promise.all([
      fetchSunatNoticias(),
      fetchSunatNormas(),
      fetchSunatComunicados(),
    ]);

    // Combinar y eliminar duplicados
    const allNoticias = removeDuplicates([...noticias, ...normas, ...comunicados]);

    // Convertir a alertas
    const alerts = convertToAlerts(allNoticias);

    // Procesar y distribuir
    const { distributed } = await processScrapedAlerts(alerts);

    const result: ScraperResult = {
      source: 'SUNAT',
      success: true,
      alertsFound: alerts.length,
      alertsDistributed: distributed,
      duration: Date.now() - startTime,
    };

    await logScraperRun(result);
    return result;

  } catch (error) {
    const result: ScraperResult = {
      source: 'SUNAT',
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

export default runSunatScraper;
