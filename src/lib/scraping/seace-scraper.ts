/**
 * Scraper de SEACE - Sistema Electrónico de Contrataciones del Estado
 * Portal: https://prodapp2.seace.gob.pe/
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

const SEACE_BASE_URL = 'https://prodapp2.seace.gob.pe';
const SEACE_SEARCH_URL = `${SEACE_BASE_URL}/seaborext/seacebus-seaborext-war/busquedaOrdenServicioCompraAction.do`;

interface SeaceConvocatoria {
  nomenclatura: string;
  objetoContratacion: string;
  entidad: string;
  valorReferencial: number;
  moneda: string;
  fechaPublicacion: Date;
  estado: string;
  region?: string;
  url?: string;
}

/**
 * Obtiene las convocatorias recientes del SEACE
 * Nota: Esta es una implementación base que puede necesitar ajustes
 * según la estructura actual del portal
 */
async function fetchSeaceConvocatorias(): Promise<SeaceConvocatoria[]> {
  const convocatorias: SeaceConvocatoria[] = [];

  try {
    // Intentar obtener la página principal de búsqueda
    // El portal de SEACE tiene una estructura compleja con formularios
    // Esta implementación intenta obtener datos de la página de resultados

    // URL de búsqueda pública de convocatorias
    const searchUrl = `${SEACE_BASE_URL}/seacebus-uiwd-pub/buscadorPublico/buscadorPublico.xhtml`;

    const html = await fetchWithFallback(searchUrl);
    const $ = cheerio.load(html);

    // Buscar tabla de resultados
    // La estructura puede variar, ajustar selectores según el HTML real
    $('table.ui-datatable tbody tr').each((_, row) => {
      try {
        const cells = $(row).find('td');
        if (cells.length >= 5) {
          const nomenclatura = $(cells[0]).text().trim();
          const objetoContratacion = $(cells[1]).text().trim();
          const entidad = $(cells[2]).text().trim();
          const valorText = $(cells[3]).text().trim();
          const fechaText = $(cells[4]).text().trim();

          // Parsear valor referencial
          const valorMatch = valorText.match(/[\d,.]+/);
          const valor = valorMatch ? parseFloat(valorMatch[0].replace(/,/g, '')) : 0;

          // Parsear fecha
          const fecha = parseFechaPeruana(fechaText);

          // Extraer región de la entidad si es posible
          const region = extractRegion(entidad);

          if (nomenclatura && objetoContratacion) {
            convocatorias.push({
              nomenclatura,
              objetoContratacion,
              entidad,
              valorReferencial: valor,
              moneda: 'PEN',
              fechaPublicacion: fecha || new Date(),
              estado: 'CONVOCADO',
              region,
              url: `${SEACE_BASE_URL}/seacebus-uiwd-pub/fichaSeleccion/fichaSeleccion.xhtml?nroConvocatoria=${encodeURIComponent(nomenclatura)}`,
            });
          }
        }
      } catch (e) {
        // Ignorar filas que no se pueden parsear
      }
    });

    // Si no se encontraron resultados en la tabla, intentar otro selector
    if (convocatorias.length === 0) {
      // Buscar en formato alternativo
      $('.resultado-item, .convocatoria-item').each((_, item) => {
        try {
          const titulo = $(item).find('.titulo, h3, h4').text().trim();
          const entidad = $(item).find('.entidad').text().trim();
          const monto = $(item).find('.monto, .valor').text().trim();

          if (titulo) {
            const valorMatch = monto.match(/[\d,.]+/);
            const valor = valorMatch ? parseFloat(valorMatch[0].replace(/,/g, '')) : 0;

            convocatorias.push({
              nomenclatura: titulo.substring(0, 50),
              objetoContratacion: titulo,
              entidad: entidad || 'No especificada',
              valorReferencial: valor,
              moneda: 'PEN',
              fechaPublicacion: new Date(),
              estado: 'CONVOCADO',
              region: extractRegion(entidad),
            });
          }
        } catch (e) {
          // Ignorar items que no se pueden parsear
        }
      });
    }

  } catch (error) {
    console.error('[SEACE Scraper] Error fetching convocatorias:', error);
    throw error;
  }

  return convocatorias;
}

/**
 * Parsea una fecha en formato peruano (dd/mm/yyyy)
 */
function parseFechaPeruana(fechaStr: string): Date | null {
  try {
    // Formatos comunes: dd/mm/yyyy, dd-mm-yyyy
    const match = fechaStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Intenta extraer la región del nombre de la entidad
 */
function extractRegion(entidad: string): string | undefined {
  const regiones = [
    'AMAZONAS', 'ANCASH', 'APURIMAC', 'AREQUIPA', 'AYACUCHO', 'CAJAMARCA',
    'CALLAO', 'CUSCO', 'HUANCAVELICA', 'HUANUCO', 'ICA', 'JUNIN', 'LA LIBERTAD',
    'LAMBAYEQUE', 'LIMA', 'LORETO', 'MADRE DE DIOS', 'MOQUEGUA', 'PASCO',
    'PIURA', 'PUNO', 'SAN MARTIN', 'TACNA', 'TUMBES', 'UCAYALI',
  ];

  const entidadUpper = entidad.toUpperCase();
  for (const region of regiones) {
    if (entidadUpper.includes(region)) {
      return region;
    }
  }

  return undefined;
}

/**
 * Convierte convocatorias de SEACE a formato de alerta
 */
function convertToAlerts(convocatorias: SeaceConvocatoria[]): ExternalAlert[] {
  return convocatorias.map(conv => ({
    titulo: conv.nomenclatura,
    contenido: `${conv.objetoContratacion}\n\nEntidad: ${conv.entidad}\nValor Referencial: S/ ${conv.valorReferencial.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
    fuente: 'SEACE' as const,
    urlOrigen: conv.url,
    fechaPublicacion: conv.fechaPublicacion,
    region: conv.region,
    entidad: conv.entidad,
    monto: conv.valorReferencial,
    tipo: 'LICITACION',
  }));
}

/**
 * Ejecuta el scraper de SEACE
 */
export async function runSeaceScraper(force = false): Promise<ScraperResult> {
  const startTime = Date.now();
  const config = await getScraperConfig('seace');

  // Verificar si debe ejecutarse
  if (!force && !shouldRunScraper(config)) {
    return {
      source: 'SEACE',
      success: true,
      alertsFound: 0,
      alertsDistributed: 0,
      duration: Date.now() - startTime,
    };
  }

  try {
    // Obtener convocatorias
    const convocatorias = await fetchSeaceConvocatorias();

    // Convertir a alertas
    const alerts = convertToAlerts(convocatorias);

    // Procesar y distribuir
    const { distributed } = await processScrapedAlerts(alerts);

    const result: ScraperResult = {
      source: 'SEACE',
      success: true,
      alertsFound: alerts.length,
      alertsDistributed: distributed,
      duration: Date.now() - startTime,
    };

    await logScraperRun(result);
    return result;

  } catch (error) {
    const result: ScraperResult = {
      source: 'SEACE',
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

export default runSeaceScraper;
