/**
 * Scraper de SEACE con Puppeteer
 * Requiere login y navegación compleja
 */

import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import prisma from '@/lib/prisma';

// Detectar si estamos en Vercel/AWS Lambda
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
import { processScrapedAlerts, ScraperResult, logScraperRun } from './index';
import type { ExternalAlert } from '@/lib/alert-sources';
import { createSessionLogger, addLog } from './scraper-logger';

// Logger global para el scraper (se configura al inicio de cada sesión)
let scraperLog: ReturnType<typeof createSessionLogger> | null = null;
let currentSessionId: string | null = null;

// Helper para logging (usa el logger de sesión si está disponible, sino console.log)
function log(level: 'info' | 'success' | 'warning' | 'error' | 'debug', message: string, ...args: unknown[]) {
  // Formatear el mensaje con argumentos adicionales si los hay
  const fullMessage = args.length > 0
    ? `${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`
    : message;

  // Limpiar espacios extra al inicio del mensaje
  const cleanMessage = fullMessage.replace(/^\s+/, '');

  if (scraperLog && currentSessionId) {
    scraperLog[level](cleanMessage);
  } else {
    const prefix = '[SEACE Puppeteer]';
    switch (level) {
      case 'error':
        console.error(prefix, cleanMessage);
        break;
      case 'warning':
        console.warn(prefix, cleanMessage);
        break;
      default:
        console.log(prefix, cleanMessage);
    }
  }
}

// Helper para esperas (reemplazo de waitForTimeout deprecado)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// URLs de SEACE
const SEACE_LOGIN_URL = 'https://prod1.seace.gob.pe/portal/';
const SEACE_SEARCH_URL = 'https://prod1.seace.gob.pe/SeaceWeb-PRO/jspx/sel/procesoseleccionficha/buscarProcedimientosSeleccion.iface';

// Configuración
interface SeaceConfig {
  usuario: string;
  clave: string;
  entidad: string;
  siglaEntidad: string;
  anio: string;
  enabled: boolean;
}

// Estructura de un procedimiento encontrado
interface SeaceProcedimiento {
  nomenclatura: string;
  objetoContratacion: string;
  entidad: string;
  tipoSeleccion: string;
  cronograma: {
    etapa: string;
    fechaInicio: string;
    fechaFin: string;
  }[];
  url?: string;
}

/**
 * Obtiene la configuración de SEACE desde la base de datos
 */
async function getSeaceConfig(): Promise<SeaceConfig> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: { startsWith: 'seace_' },
    },
  });

  const config: Record<string, string> = {};
  for (const setting of settings) {
    config[setting.key.replace('seace_', '')] = setting.value;
  }

  return {
    usuario: config.usuario || '',
    clave: config.clave || '',
    entidad: config.entidad || 'SUPERINTENDENCIA NACIONAL DE ADUANAS Y DE ADMINISTRACION TRIBUTARIA - SUNAT',
    siglaEntidad: config.sigla_entidad || 'SUNAT',
    anio: config.anio || new Date().getFullYear().toString(),
    enabled: config.enabled === 'true',
  };
}

/**
 * Verifica si SEACE Puppeteer está habilitado y tiene credenciales configuradas
 */
export async function isSeacePuppeteerEnabled(): Promise<boolean> {
  const config = await getSeaceConfig();
  return config.enabled && !!config.usuario && !!config.clave;
}

/**
 * Guarda la configuración de SEACE
 */
export async function saveSeaceConfig(config: Partial<SeaceConfig>): Promise<void> {
  const mappings: Record<string, string> = {
    usuario: 'seace_usuario',
    clave: 'seace_clave',
    entidad: 'seace_entidad',
    siglaEntidad: 'seace_sigla_entidad',
    anio: 'seace_anio',
    enabled: 'seace_enabled',
  };

  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined && mappings[key]) {
      // No guardar la clave si es la máscara o está vacía
      if (key === 'clave') {
        const strValue = String(value);
        // Ignorar si es la máscara (••••••••) o está vacía
        if (!strValue || strValue === '••••••••' || /^[•]+$/.test(strValue)) {
          continue;
        }
      }

      await prisma.systemSetting.upsert({
        where: { key: mappings[key] },
        update: { value: String(value) },
        create: {
          key: mappings[key],
          value: String(value),
          category: 'ALERTS',
          description: `Configuración SEACE: ${key}`,
        },
      });
    }
  }
}

/**
 * Busca el path de Chrome localmente (para desarrollo)
 */
function findLocalChromePath(): string | undefined {
  // 1. Variable de entorno
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  // 2. Rutas comunes en Windows
  if (process.platform === 'win32') {
    const fs = require('fs');
    const windowsPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
    ];

    for (const chromePath of windowsPaths) {
      if (chromePath && fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  }

  // 3. Rutas en macOS
  if (process.platform === 'darwin') {
    const fs = require('fs');
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];

    for (const chromePath of macPaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  }

  // 4. Rutas en Linux
  if (process.platform === 'linux') {
    const fs = require('fs');
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];

    for (const chromePath of linuxPaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  }

  return undefined;
}

/**
 * Inicia el navegador (compatible con Vercel y desarrollo local)
 */
async function launchBrowser(): Promise<Browser> {
  log('info', 'Iniciando navegador...');
  log('info', `Entorno: ${isServerless ? 'Serverless (Vercel)' : 'Local'}`);

  if (isServerless) {
    // En Vercel/AWS Lambda: usar @sparticuz/chromium
    log('info', 'Usando @sparticuz/chromium para entorno serverless');

    // Configurar chromium para serverless
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    const executablePath = await chromium.executablePath();
    log('info', `Chromium path: ${executablePath}`);

    const browser = await puppeteer.launch({
      executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
      args: [
        ...chromium.args,
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-first-run',
        '--no-zygote',
        '--deterministic-fetch',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
      ],
      defaultViewport: chromium.defaultViewport,
    });

    log('success', 'Navegador iniciado correctamente en Vercel');
    return browser;
  } else {
    // En desarrollo local: usar Chrome instalado
    const executablePath = findLocalChromePath();
    log('info', `Chrome path: ${executablePath}`);

    if (!executablePath) {
      throw new Error(
        'No se encontró Chrome instalado. Por favor instale Google Chrome o configure la variable de entorno CHROME_PATH.'
      );
    }

    return puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    });
  }
}

/**
 * Busca un elemento que contenga cierto texto
 */
async function findElementByText(page: Page, selector: string, text: string) {
  return page.evaluateHandle((sel, txt) => {
    const elements = document.querySelectorAll(sel);
    for (const el of elements) {
      if (el.textContent?.toLowerCase().includes(txt.toLowerCase())) {
        return el;
      }
    }
    return null;
  }, selector, text);
}

/**
 * Hace clic en un elemento que contenga cierto texto
 */
async function clickByText(page: Page, selector: string, text: string): Promise<boolean> {
  const clicked = await page.evaluate((sel, txt) => {
    const elements = document.querySelectorAll(sel);
    for (const el of elements) {
      if (el.textContent?.toLowerCase().includes(txt.toLowerCase())) {
        (el as HTMLElement).click();
        return true;
      }
    }
    return false;
  }, selector, text);
  return clicked;
}

/**
 * Extrae el cronograma de la página de Ficha de Selección
 */
async function extraerCronograma(page: Page): Promise<Array<{ etapa: string; fechaInicio: string; fechaFin: string }>> {
  try {
    // Primero, intentar hacer clic en la pestaña "Cronograma" si existe
    const cronogramaTabClicked = await page.evaluate(() => {
      // Buscar pestaña o link de Cronograma
      const elements = document.querySelectorAll('a, span, div, button, td');
      for (const el of elements) {
        const text = el.textContent?.toLowerCase().trim() || '';
        if (text === 'cronograma' || text.includes('cronograma')) {
          // Verificar que sea clickeable (no solo texto)
          const tagName = el.tagName.toLowerCase();
          if (tagName === 'a' || tagName === 'button' || el.getAttribute('onclick') || el.classList.contains('icePnlTb')) {
            (el as HTMLElement).click();
            return { clicked: true, text: el.textContent?.trim() };
          }
        }
      }
      return { clicked: false };
    });

    if (cronogramaTabClicked.clicked) {
      log('info', ' Clic en pestaña Cronograma');
      await delay(2000);
    }

    // Extraer datos del cronograma
    const cronograma = await page.evaluate(() => {
      const etapas: Array<{ etapa: string; fechaInicio: string; fechaFin: string }> = [];

      // Lista de nombres de etapas válidas conocidas
      const etapasValidas = [
        'convocatoria',
        'registro de participantes',
        'formulación de consultas',
        'formulacion de consultas',
        'absolución de consultas',
        'absolucion de consultas',
        'integración de las bases',
        'integracion de las bases',
        'presentación de propuestas',
        'presentacion de propuestas',
        'presentación de ofertas',
        'presentacion de ofertas',
        'calificación y evaluación',
        'calificacion y evaluacion',
        'evaluación de propuestas',
        'evaluacion de propuestas',
        'otorgamiento de la buena pro',
        'buena pro',
        'publicación de bases',
        'publicacion de bases',
        'apertura de sobres',
        'adjudicación',
        'adjudicacion',
        'fecha y hora de publicación',
        'fecha y hora de publicacion',
      ];

      // Patrones de texto que NO son etapas (direcciones, notas)
      const patronesInvalidos = [
        'en la oficina',
        'en el local',
        'sito en',
        'ubicado en',
        'el procedimiento de selección',
        'el procedimiento de seleccion',
        'se encuentra en la etapa',
        'av.',
        'avenida',
        'calle',
        'jr.',
        'jirón',
        'jiron',
        'pasaje',
        'n°',
        'n °',
        'nro',
        'numero',
        'número',
      ];

      // Función para limpiar y extraer texto de una celda (sin hijos anidados)
      const getCellText = (cell: Element): string => {
        // Si la celda tiene spans o divs internos, obtener el texto del elemento más interno
        const innerSpan = cell.querySelector('span');
        if (innerSpan) {
          return innerSpan.textContent?.trim() || '';
        }
        // Si no, obtener texto directo (solo del primer nodo de texto)
        const textNode = Array.from(cell.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (textNode) {
          return textNode.textContent?.trim() || '';
        }
        return cell.textContent?.trim() || '';
      };

      // Función para validar si un texto parece una fecha
      const esFecha = (texto: string): boolean => {
        if (!texto) return false;
        // Formato: dd/mm/yyyy o dd/mm/yyyy hh:mm:ss
        return /^\d{1,2}\/\d{1,2}\/\d{4}/.test(texto.trim());
      };

      // Función para limpiar fecha (extraer solo la parte de fecha válida)
      const limpiarFecha = (texto: string): string => {
        if (!texto) return '';
        // Buscar formato de fecha: dd/mm/yyyy [hh:mm:ss]
        const match = texto.match(/(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/);
        return match ? match[1] : '';
      };

      // Buscar tablas que contengan el cronograma
      const tables = document.querySelectorAll('table');
      let tablaCronograma: HTMLTableElement | null = null;

      // Identificar la tabla correcta de cronograma
      for (const table of tables) {
        const headerRow = table.querySelector('tr');
        if (!headerRow) continue;

        const headerCells = headerRow.querySelectorAll('th, td');
        let tieneEtapa = false;
        let tieneFechaInicio = false;
        let tieneFechaFin = false;

        headerCells.forEach(cell => {
          const texto = cell.textContent?.toLowerCase().trim() || '';
          if (texto === 'etapa') tieneEtapa = true;
          if (texto.includes('fecha inicio') || texto === 'inicio') tieneFechaInicio = true;
          if (texto.includes('fecha fin') || texto === 'fin') tieneFechaFin = true;
        });

        // La tabla de cronograma debe tener las 3 columnas
        if (tieneEtapa && tieneFechaInicio && tieneFechaFin) {
          tablaCronograma = table as HTMLTableElement;
          break;
        }
      }

      if (!tablaCronograma) {
        // Fallback: buscar tabla que tenga estructura de cronograma
        for (const table of tables) {
          const rows = table.querySelectorAll('tr');
          let conteoFilasConFechas = 0;

          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              const col2 = getCellText(cells[1]);
              const col3 = getCellText(cells[2]);
              if (esFecha(col2) || esFecha(col3)) {
                conteoFilasConFechas++;
              }
            }
          });

          if (conteoFilasConFechas >= 3) {
            tablaCronograma = table as HTMLTableElement;
            break;
          }
        }
      }

      if (!tablaCronograma) {
        return etapas;
      }

      // Procesar filas de la tabla de cronograma
      const rows = tablaCronograma.querySelectorAll('tbody tr, tr');

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return;

        // Extraer texto de cada celda de forma limpia
        const col0 = getCellText(cells[0]);
        const col1 = getCellText(cells[1]);
        const col2 = getCellText(cells[2]);

        // Determinar qué columna es qué
        let etapaNombre = '';
        let fechaInicio = '';
        let fechaFin = '';

        // Columna 0 suele ser el nombre de la etapa
        // Columnas 1 y 2 son las fechas
        if (esFecha(col1) || esFecha(col2)) {
          etapaNombre = col0;
          fechaInicio = limpiarFecha(col1);
          fechaFin = limpiarFecha(col2);
        } else {
          // A veces la estructura puede variar
          return;
        }

        const etapaLower = etapaNombre.toLowerCase().trim();

        // Validaciones para filtrar filas inválidas:

        // 1. Descartar si es header o está vacía
        if (!etapaNombre || etapaLower === 'etapa' || etapaLower.includes('fecha inicio') || etapaLower.includes('fecha fin')) {
          return;
        }

        // 2. Descartar si contiene patrones inválidos (direcciones, notas)
        const esInvalido = patronesInvalidos.some(p => etapaLower.includes(p));
        if (esInvalido) {
          return;
        }

        // 3. Descartar si parece una dirección (contiene paréntesis con ubicación)
        if (/\([A-ZÁÉÍÓÚA-Z\s\/]+\)/.test(etapaNombre) && etapaNombre.includes('/')) {
          return;
        }

        // 4. Descartar si empieza con guión o bullet (es una nota)
        if (etapaNombre.startsWith('-') || etapaNombre.startsWith('•') || etapaNombre.startsWith('*')) {
          return;
        }

        // 5. Descartar si es muy largo (> 80 chars)
        if (etapaNombre.length > 80) {
          return;
        }

        // 6. Descartar si no tiene ninguna fecha válida
        if (!fechaInicio && !fechaFin) {
          return;
        }

        // 7. Verificar que coincide con alguna etapa conocida
        const esEtapaConocida = etapasValidas.some(ev => etapaLower.includes(ev));
        if (!esEtapaConocida) {
          return;
        }

        // 8. Verificar que no sea un duplicado
        const yaExiste = etapas.some(e =>
          e.etapa.toLowerCase() === etapaLower &&
          e.fechaInicio === fechaInicio &&
          e.fechaFin === fechaFin
        );
        if (yaExiste) {
          return;
        }

        // Agregar etapa válida
        etapas.push({
          etapa: etapaNombre.substring(0, 100),
          fechaInicio: fechaInicio,
          fechaFin: fechaFin
        });
      });

      return etapas;
    });

    log('info', ' Cronograma encontrado:', cronograma.length, 'etapas');
    return cronograma;

  } catch (error) {
    log('error', ' Error extrayendo cronograma:', error);
    return [];
  }
}

/**
 * Hace login en SEACE
 * Flujo: 1) Usuario + Clave + "Acceder" -> 2) Checkbox términos + "Acepto"
 */
async function loginSeace(page: Page, config: SeaceConfig): Promise<boolean> {
  try {
    log('info', ' Navegando a login...');
    await page.goto(SEACE_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Esperar a que cargue el formulario
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });

    // ========== PASO 1: Ingresar credenciales ==========
    log('info', ' Ingresando credenciales...');

    // Buscar campos de usuario y clave
    const inputs = await page.$$('input[type="text"], input[type="password"]');
    if (inputs.length >= 2) {
      await inputs[0].type(config.usuario);
      await inputs[1].type(config.clave);
    } else {
      log('info', ' No se encontraron campos de usuario/clave');
      return false;
    }

    // Clic en "Acceder"
    log('info', ' Buscando botón Acceder...');

    const accederBtn = await page.$('input[value="Acceder"]');
    if (accederBtn) {
      log('info', ' Botón Acceder encontrado, clickeando...');
      await accederBtn.click();
    } else {
      log('info', ' No se encontró botón Acceder');
      return false;
    }

    // Esperar a que cargue la página de términos
    log('info', ' Esperando página de términos...');
    await delay(4000);

    // Verificar que llegamos a la página de términos (debe existir el checkbox)
    const checkboxExists = await page.$('[id="terminosCondiciones:idcheckBox"]');
    if (!checkboxExists) {
      log('info', ' No se encontró página de términos, verificando estado...');
      const pageText = await page.evaluate(() => document.body.innerText?.substring(0, 300) || '');
      log('info', ' Contenido página:', pageText);

      // Si dice "inválidos", el login falló
      if (pageText.toLowerCase().includes('inválid')) {
        log('info', ' ERROR: Credenciales inválidas');
        return false;
      }
    }

    // ========== PASO 2: Aceptar términos y condiciones ==========
    log('info', ' Aceptando términos...');

    // Buscar y marcar checkbox por ID específico de SEACE
    // ID: terminosCondiciones:idcheckBox (el : necesita escape en CSS)
    // Reintentar hasta 5 veces para asegurar que se marque
    let checkboxMarked = false;
    const maxCheckboxRetries = 5;

    for (let attempt = 1; attempt <= maxCheckboxRetries; attempt++) {
      log('info', ` Intento ${attempt}/${maxCheckboxRetries} para marcar checkbox...`);

      // Buscar SOLO el checkbox específico de términos (NO fallback a cualquier checkbox)
      const checkbox = await page.$('[id="terminosCondiciones:idcheckBox"]');

      if (!checkbox) {
        log('info', ' No se encontró checkbox de términos, esperando...');
        await delay(1000);
        continue;
      }

      // Verificar si ya está marcado
      let isChecked = await checkbox.evaluate((el) => (el as HTMLInputElement).checked);
      log('info', ` Checkbox encontrado, estado actual: ${isChecked ? 'MARCADO' : 'NO MARCADO'}`);

      if (!isChecked) {
        // Hacer clic para marcar (esto dispara ICEfaces correctamente)
        await checkbox.click();
        await delay(1000);

        // Verificar si se marcó después del clic
        isChecked = await checkbox.evaluate((el) => (el as HTMLInputElement).checked);
        log('info', ` Estado después del clic: ${isChecked ? 'MARCADO' : 'NO MARCADO'}`);
      }

      if (isChecked) {
        checkboxMarked = true;
        log('info', ' Checkbox marcado exitosamente');
        break;
      }

      await delay(500);
    }

    if (!checkboxMarked) {
      log('info', ' ERROR: No se pudo marcar el checkbox después de 5 intentos');
      return false;
    }

    // Clic en "Acepto" - buscar el botón con ID terminosCondiciones:idButtonAceptar
    let aceptoClicked = false;
    const maxAceptoRetries = 5;

    log('info', ' Buscando botón Acepto...');

    for (let attempt = 1; attempt <= maxAceptoRetries; attempt++) {
      log('info', ` Intento ${attempt}/${maxAceptoRetries} para botón Acepto...`);

      // Esperar a que el botón aparezca
      await delay(1500);

      // Buscar el botón por ID específico
      const aceptoBtn = await page.$('[id="terminosCondiciones:idButtonAceptar"]');

      if (aceptoBtn) {
        log('info', ' Botón Acepto encontrado');
        await aceptoBtn.click();
        aceptoClicked = true;
        log('info', ' Botón Acepto clickeado');
        break;
      }

      // Fallback: buscar por clase desocultar y value Acepto
      const desocultarBtn = await page.$('input.desocultar[value="Acepto"]:not([disabled])');
      if (desocultarBtn) {
        log('info', ' Botón Acepto encontrado por clase desocultar');
        await desocultarBtn.click();
        aceptoClicked = true;
        break;
      }

      log('info', ' Botón Acepto no encontrado aún...');
    }

    if (!aceptoClicked) {
      log('info', ' ERROR: No se encontró botón Acepto visible después de reintentos');
      return false;
    }

    // Esperar navegación después de aceptar
    log('info', ' Esperando navegación post-login...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
      log('info', ' Timeout en navegación, continuando...');
    });

    log('info', ' Login exitoso');
    return true;
  } catch (error) {
    log('error', ' Error en login:', error);
    return false;
  }
}

/**
 * Navega a "Mis procedimientos de selección" haciendo clic en el menú
 */
async function navegarAMisProcedimientos(page: Page): Promise<boolean> {
  try {
    log('info', ' Buscando menú "Mis procedimientos de selección"...');

    // Esperar un momento para que cargue el menú después del login
    await delay(2000);

    // Debug: mostrar todos los links disponibles
    const linksDebug = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      return Array.from(links).slice(0, 25).map(a => ({
        text: a.textContent?.trim().substring(0, 60),
        onclick: a.getAttribute('onclick')?.substring(0, 80)
      })).filter(l => l.text);
    });
    log('info', ' Links disponibles:', JSON.stringify(linksDebug, null, 2));

    // Buscar y hacer clic en el link del menú
    const menuClicked = await page.evaluate(() => {
      const links = document.querySelectorAll('a');

      for (const link of links) {
        const text = link.textContent?.toLowerCase().trim() || '';

        // Buscar de forma flexible: "mis procedimientos" (sin importar el resto)
        if (text.includes('mis procedimientos')) {
          (link as HTMLElement).click();
          return { clicked: true, text: link.textContent?.trim(), method: 'textMisProcedimientos' };
        }
      }

      // Buscar en divs dentro de links
      const divsInLinks = document.querySelectorAll('a div, a span');
      for (const el of divsInLinks) {
        const text = el.textContent?.toLowerCase().trim() || '';
        if (text.includes('mis procedimientos')) {
          const parentLink = el.closest('a') as HTMLElement;
          if (parentLink) {
            parentLink.click();
            return { clicked: true, text: el.textContent?.trim(), method: 'divMisProcedimientos' };
          }
        }
      }

      return { clicked: false };
    });

    if (menuClicked.clicked) {
      log('info', ' Clic en menú:', menuClicked.text);
    } else {
      log('info', ' No se encontró el menú, buscando por onclick...');

      // Intentar buscar por onclick que contenga la URL
      const clickedByOnclick = await page.evaluate(() => {
        const links = document.querySelectorAll('a[onclick*="consultarBandejaProcedimientosSeleccion"]');
        if (links.length > 0) {
          (links[0] as HTMLElement).click();
          return { clicked: true };
        }
        return { clicked: false };
      });

      if (!clickedByOnclick.clicked) {
        log('info', ' ERROR: No se pudo encontrar el menú');
        return false;
      }
    }

    // Esperar a que cargue la página
    log('info', ' Esperando carga de página...');
    await delay(4000);

    // Esperar el formulario de búsqueda
    await page.waitForSelector('select, input[value="Buscar"]', { timeout: 20000 });

    log('info', ' Página de Mis procedimientos cargada');
    log('info', ' URL actual:', page.url());

    await delay(1000);
    return true;
  } catch (error) {
    log('error', ' Error navegando a mis procedimientos:', error);
    return false;
  }
}

/**
 * Ejecuta la búsqueda de procedimientos en "Mis procedimientos de selección"
 */
async function buscarProcedimientos(page: Page, config: SeaceConfig): Promise<SeaceProcedimiento[]> {
  const procedimientos: SeaceProcedimiento[] = [];

  try {
    log('info', ' URL actual:', page.url());

    // Debug: mostrar todos los selects disponibles
    const selectsInfo = await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      return Array.from(selects).map(s => ({
        id: s.id,
        name: s.name,
        options: Array.from(s.options).slice(0, 10).map(o => ({ value: o.value, text: o.textContent?.trim() }))
      }));
    });
    log('info', ' Selects disponibles:', JSON.stringify(selectsInfo, null, 2));

    // ========== PASO 1: Seleccionar año de convocatoria ==========
    log('info', ' Seleccionando año de convocatoria:', config.anio);

    // Usar el select específico de año: frmConsultarBandejaProveedor:j_id248
    const anioSelected = await page.evaluate((year) => {
      // Buscar el select específico de año de convocatoria
      const selectId = 'frmConsultarBandejaProveedor:j_id248';
      let sel = document.getElementById(selectId) as HTMLSelectElement;

      // Si no lo encuentra por ID, buscar por clase iceSelOneMnu que tenga años
      if (!sel) {
        const selects = document.querySelectorAll('select.iceSelOneMnu');
        for (const s of selects) {
          const options = Array.from((s as HTMLSelectElement).options);
          const hasYears = options.some(opt => /^20\d{2}$/.test(opt.value));
          if (hasYears) {
            sel = s as HTMLSelectElement;
            break;
          }
        }
      }

      if (!sel) {
        return { found: false, error: 'No se encontró select de año' };
      }

      // Seleccionar el año
      const options = Array.from(sel.options);
      const targetOption = options.find(opt => opt.value === year);

      if (!targetOption) {
        return { found: false, error: `Año ${year} no encontrado en opciones` };
      }

      // Cambiar el valor
      sel.value = year;

      // Disparar eventos para ICEfaces
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.dispatchEvent(new Event('blur', { bubbles: true }));

      // También llamar a setFocus si existe (función de ICEfaces)
      if (typeof (window as any).setFocus === 'function') {
        (window as any).setFocus('');
      }

      return { found: true, selectId: sel.id, value: year };
    }, config.anio);

    if (anioSelected.found) {
      log('info', ' Año seleccionado en select:', anioSelected.selectId, '=', anioSelected.value);
    } else {
      log('info', ' ADVERTENCIA:', anioSelected.error);
    }

    await delay(2000);

    // ========== PASO 2: Hacer clic en botón Buscar ==========
    log('info', ' Buscando botón Buscar...');

    // Usar el botón específico: frmConsultarBandejaProveedor:idBuscar
    const buscarClicked = await page.evaluate(() => {
      // Buscar por ID específico
      const btnById = document.getElementById('frmConsultarBandejaProveedor:idBuscar') as HTMLElement;
      if (btnById) {
        btnById.click();
        return { clicked: true, method: 'id', id: btnById.id };
      }

      // Fallback: buscar por value="Buscar"
      const btnByValue = document.querySelector('input[value="Buscar"]') as HTMLElement;
      if (btnByValue) {
        btnByValue.click();
        return { clicked: true, method: 'value' };
      }

      return { clicked: false };
    });

    if (buscarClicked.clicked) {
      log('info', ' Botón Buscar clickeado via:', buscarClicked.method);
    } else {
      log('info', ' ERROR: No se encontró botón Buscar');
    }

    // Esperar a que carguen los resultados
    log('info', ' Esperando resultados...');
    await delay(5000);

    log('info', ' URL después de buscar:', page.url());

    // ========== PASO 3: Procesar tabla de resultados ==========
    log('info', ' Procesando resultados...');

    // Debug: mostrar estructura de tablas
    const tablasInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      return Array.from(tables).map((t, i) => {
        const rows = t.querySelectorAll('tr');
        const headerRow = rows[0];
        const headers = headerRow ? Array.from(headerRow.querySelectorAll('th, td')).map(c => c.textContent?.trim().substring(0, 30)) : [];
        return {
          index: i,
          id: t.id,
          className: t.className.substring(0, 50),
          rowCount: rows.length,
          headers: headers.slice(0, 8)
        };
      });
    });
    log('info', ' Tablas encontradas:', JSON.stringify(tablasInfo, null, 2));

    // Esperar específicamente la tabla de resultados
    try {
      await page.waitForSelector('[id="frmConsultarBandejaProveedor:dtBusqueda"], table.iceDatTbl', { timeout: 15000 });
      log('info', ' Tabla de resultados detectada');
    } catch (e) {
      log('info', ' Timeout esperando tabla de resultados');
    }

    // Extraer datos directamente de la tabla de resultados
    // Los datos están en spans con IDs específicos como:
    // frmConsultarBandejaProveedor:dtBusqueda:0:j_id322 (nomenclatura)
    // frmConsultarBandejaProveedor:dtBusqueda:0:j_id316 (entidad)
    // frmConsultarBandejaProveedor:dtBusqueda:0:j_id335 (descripción/objeto)
    const datosTabla = await page.evaluate(() => {
      const resultados: Array<{
        index: number;
        nomenclatura: string;
        entidad: string;
        objetoContratacion: string;
        tipoSeleccion: string;
        accionesId: string;
        accionesInfo: string[];
      }> = [];

      // Buscar la tabla de datos
      const dataTable = document.getElementById('frmConsultarBandejaProveedor:dtBusqueda') ||
                        document.querySelector('table.iceDatTbl');

      if (!dataTable) {
        return { error: 'No se encontró tabla de datos', resultados: [], tableId: null, debug: [] };
      }

      const debug: string[] = [];

      // Buscar todas las filas de datos (tr con class iceDatTblRow*)
      const rows = dataTable.querySelectorAll('tr.iceDatTblRow1, tr.iceDatTblRow2, tbody tr');
      debug.push(`Filas encontradas: ${rows.length}`);

      rows.forEach((row, idx) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return; // Saltar filas sin suficientes celdas

        // Extraer texto de cada celda
        let nomenclatura = '';
        let entidad = '';
        let objetoContratacion = '';
        let tipoSeleccion = '';
        let accionesId = '';
        const accionesInfo: string[] = [];

        // Debug: buscar TODOS los elementos clickeables en la fila
        const clickables = row.querySelectorAll('a, input[type="image"], input[type="button"], button');
        clickables.forEach(el => {
          const id = el.id || '';
          const title = el.getAttribute('title') || '';
          const onclick = el.getAttribute('onclick')?.substring(0, 50) || '';
          const text = el.textContent?.trim() || '';
          accionesInfo.push(`${el.tagName}[id=${id}, title=${title}, text=${text}]`);

          // Buscar botón de Acciones (puede ser link o input)
          if (title.toLowerCase().includes('accion') ||
              text.toLowerCase().includes('accion') ||
              id.toLowerCase().includes('accion')) {
            accionesId = id;
          }
        });

        // Si no encontró por "acciones", buscar el botón Ficha como fallback
        if (!accionesId) {
          const fichaBtn = row.querySelector('input[id*="idFicha"]');
          if (fichaBtn) {
            accionesId = fichaBtn.id;
          }
        }

        // Determinar el índice de la fila desde cualquier elemento con ID
        let rowIdx = idx;
        const anyElementWithId = row.querySelector('[id*="dtBusqueda:"]');
        if (anyElementWithId) {
          const match = anyElementWithId.id.match(/:dtBusqueda:(\d+):/);
          if (match) {
            rowIdx = parseInt(match[1]);
          }
        }

        // Extraer textos de las celdas
        const cellTexts: string[] = [];
        cells.forEach(cell => {
          const text = cell.textContent?.trim() || '';
          if (text.length > 0 && text.length < 500 && !text.includes('function') && !text.includes('javascript')) {
            cellTexts.push(text);
          }
        });

        debug.push(`Fila ${rowIdx}: ${cellTexts.length} celdas, acciones: ${accionesInfo.join(', ')}`);

        // Mapear por posición típica en SEACE
        if (cellTexts.length >= 3) {
          // La nomenclatura suele tener formato AS-SM-XX-YYYY o CP-SM-XX-YYYY
          for (const text of cellTexts) {
            if (/^[A-Z]{2,3}-[A-Z]{2,4}-\d+-\d{4}/.test(text)) {
              nomenclatura = text;
              break;
            }
          }

          // Si no encontró por patrón, usar posición
          if (!nomenclatura && cellTexts[1]) {
            nomenclatura = cellTexts[1];
          }

          // Entidad suele ser el texto más largo que contiene nombres de instituciones
          for (const text of cellTexts) {
            if (text.length > 20 && (text.includes('SUNAT') || text.includes('SUPERINTENDENCIA') || text.includes('MINISTERIO') || text.includes('GOBIERNO'))) {
              entidad = text;
              break;
            }
          }
          if (!entidad && cellTexts[2]) {
            entidad = cellTexts[2];
          }

          // Objeto de contratación suele ser una descripción larga
          for (const text of cellTexts) {
            if (text.length > 30 && text !== entidad && text !== nomenclatura && !text.includes('ADJUDICACI')) {
              objetoContratacion = text;
              break;
            }
          }
          if (!objetoContratacion && cellTexts.length > 4) {
            objetoContratacion = cellTexts[4];
          }

          // Tipo de selección
          for (const text of cellTexts) {
            if (text.includes('ADJUDICACI') || text.includes('SUBASTA') || text.includes('LICITACI') || text.includes('CONCURSO')) {
              tipoSeleccion = text;
              break;
            }
          }
        }

        if (nomenclatura || accionesId) {
          resultados.push({
            index: rowIdx,
            nomenclatura: nomenclatura.substring(0, 200),
            entidad: entidad.substring(0, 300),
            objetoContratacion: objetoContratacion.substring(0, 1000),
            tipoSeleccion: tipoSeleccion.substring(0, 200),
            accionesId,
            accionesInfo
          });
        }
      });

      return { error: null, resultados, tableId: dataTable.id, debug };
    });

    if (datosTabla.error) {
      log('info', ' ERROR:', datosTabla.error);
    } else {
      log('info', ' Tabla encontrada:', datosTabla.tableId);
      log('info', ' Resultados extraídos:', datosTabla.resultados.length);
      // Mostrar debug de botones de acciones encontrados
      if (datosTabla.debug) {
        log('info', ' Debug filas:', datosTabla.debug);
      }
    }

    log('info', ' Datos de tabla:', JSON.stringify(datosTabla.resultados, null, 2));

    // ========== PASO 4: Procesar cada resultado ==========
    const maxProcedimientos = Math.min(datosTabla.resultados.length, 10);

    for (let i = 0; i < maxProcedimientos; i++) {
      const datoFila = datosTabla.resultados[i];

      try {
        log('info', ` Procesando procedimiento ${i + 1}/${maxProcedimientos}...`);
        log('info', ` Nomenclatura: ${datoFila.nomenclatura}`);
        log('info', ` Botones disponibles: ${datoFila.accionesInfo?.join(', ') || 'ninguno'}`);
        log('info', ` ID de acción seleccionado: ${datoFila.accionesId || 'ninguno'}`);

        // Si ya tenemos datos básicos de la tabla, crear el procedimiento
        if (datoFila.nomenclatura) {
          // Intentar hacer clic en el botón de Acciones/Ficha para obtener cronograma
          let cronograma: SeaceProcedimiento['cronograma'] = [];

          if (datoFila.accionesId) {
            const accionClicked = await page.evaluate((accionId) => {
              const accionBtn = document.getElementById(accionId) as HTMLElement;
              if (accionBtn) {
                accionBtn.click();
                return { clicked: true, id: accionId };
              }
              return { clicked: false, id: accionId };
            }, datoFila.accionesId);

            if (accionClicked.clicked) {
              log('info', ` Clic en acción: ${datoFila.accionesId}`);
              await delay(4000);

              // Verificar URL actual
              const urlActual = page.url();
              log('info', ' URL después de clic:', urlActual);

              // Extraer cronograma
              cronograma = await extraerCronograma(page);
              log('info', ` Cronograma extraído: ${cronograma.length} etapas`);

              // Regresar a la lista
              const regresarClicked = await page.evaluate(() => {
                const btns = document.querySelectorAll('input[value="Regresar"], a, button');
                for (const btn of btns) {
                  const text = btn.textContent?.toLowerCase().trim() || '';
                  const value = (btn as HTMLInputElement).value?.toLowerCase() || '';
                  if (text.includes('regresar') || value.includes('regresar')) {
                    (btn as HTMLElement).click();
                    return { clicked: true };
                  }
                }
                return { clicked: false };
              });

              if (regresarClicked.clicked) {
                log('info', ' Regresando a la lista...');
                await delay(3000);
              } else {
                log('info', ' No se encontró botón Regresar, usando goBack');
                await page.goBack();
                await delay(3000);
              }
            } else {
              log('info', ` No se pudo hacer clic en: ${datoFila.accionesId}`);
            }
          } else {
            log('info', ' No se encontró botón de acciones para esta fila');
          }

          procedimientos.push({
            nomenclatura: datoFila.nomenclatura,
            objetoContratacion: datoFila.objetoContratacion,
            entidad: datoFila.entidad,
            tipoSeleccion: datoFila.tipoSeleccion,
            cronograma,
          });

          log('info', ` Procedimiento agregado: ${datoFila.nomenclatura}`);
        }

      } catch (err) {
        log('error', ` Error procesando procedimiento ${i + 1}:`, err);
        // Aunque falle el cronograma, agregar con los datos básicos
        if (datoFila.nomenclatura) {
          procedimientos.push({
            nomenclatura: datoFila.nomenclatura,
            objetoContratacion: datoFila.objetoContratacion,
            entidad: datoFila.entidad,
            tipoSeleccion: datoFila.tipoSeleccion,
            cronograma: [],
          });
        }
      }
    }

    log('info', ` Total procedimientos extraídos: ${procedimientos.length}`);
    return procedimientos;

  } catch (error) {
    log('error', ' Error en búsqueda de procedimientos:', error);
    return procedimientos;
  }
}
/**
 * Parsea una fecha en formato dd/mm/yyyy o dd/mm/yyyy hh:mm:ss
 */
function parseFecha(fechaStr: string): Date | null {
  if (!fechaStr) return null;

  // Limpiar el string
  const cleanDate = fechaStr.trim();

  // Formato dd/mm/yyyy [hh:mm:ss]
  const match1 = cleanDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (match1) {
    const [, day, month, year, hour, minute, second] = match1;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hour ? parseInt(hour) : 0,
      minute ? parseInt(minute) : 0,
      second ? parseInt(second) : 0
    );
    return date;
  }

  // Formato yyyy-mm-dd
  const match2 = cleanDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match2) {
    const [, year, month, day] = match2;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return null;
}

/**
 * Guarda los procedimientos scrapeados en la base de datos
 */
async function guardarProcedimientos(
  procedimientos: SeaceProcedimiento[],
  config: SeaceConfig
): Promise<{ saved: number; updated: number }> {
  let saved = 0;
  let updated = 0;

  for (const proc of procedimientos) {
    if (!proc.nomenclatura) continue;

    try {
      // Parsear fechas del cronograma
      let fechaConvocatoria: Date | null = null;
      let fechaPresentacion: Date | null = null;
      let fechaBuenaPro: Date | null = null;

      for (const etapa of proc.cronograma) {
        const nombreLower = etapa.etapa.toLowerCase();
        const fechaFin = parseFecha(etapa.fechaFin);

        if (nombreLower.includes('convocatoria')) {
          fechaConvocatoria = fechaFin;
        } else if (nombreLower.includes('presentación') || nombreLower.includes('propuesta')) {
          fechaPresentacion = fechaFin;
        } else if (nombreLower.includes('buena pro') || nombreLower.includes('otorgamiento')) {
          fechaBuenaPro = fechaFin;
        }
      }

      // Upsert de la licitación
      const licitacion = await prisma.scrapedLicitacion.upsert({
        where: { nomenclatura: proc.nomenclatura },
        update: {
          objetoContratacion: proc.objetoContratacion,
          entidad: proc.entidad || config.entidad,
          siglaEntidad: config.siglaEntidad,
          tipoSeleccion: proc.tipoSeleccion,
          fechaConvocatoria,
          fechaPresentacion,
          fechaBuenaPro,
          urlOrigen: proc.url,
          updatedAt: new Date(),
        },
        create: {
          nomenclatura: proc.nomenclatura,
          objetoContratacion: proc.objetoContratacion,
          entidad: proc.entidad || config.entidad,
          siglaEntidad: config.siglaEntidad,
          tipoSeleccion: proc.tipoSeleccion,
          fuente: 'SEACE',
          fechaConvocatoria,
          fechaPresentacion,
          fechaBuenaPro,
          urlOrigen: proc.url,
        },
      });

      // Eliminar etapas antiguas y crear las nuevas
      await prisma.licitacionEtapa.deleteMany({
        where: { licitacionId: licitacion.id },
      });

      // Crear etapas del cronograma (truncar nombreEtapa a 100 chars - límite del schema)
      for (const etapa of proc.cronograma) {
        const nombreEtapaTruncado = etapa.etapa ? etapa.etapa.substring(0, 100) : '';
        if (!nombreEtapaTruncado) continue; // Saltar etapas sin nombre

        await prisma.licitacionEtapa.create({
          data: {
            licitacionId: licitacion.id,
            nombreEtapa: nombreEtapaTruncado,
            fechaInicio: parseFecha(etapa.fechaInicio),
            fechaFin: parseFecha(etapa.fechaFin),
          },
        });
      }

      if (licitacion.scrapedAt.getTime() === licitacion.updatedAt.getTime()) {
        saved++;
      } else {
        updated++;
      }

    } catch (error) {
      log('error', ` Error guardando ${proc.nomenclatura}:`, error);
    }
  }

  log('info', ` Guardados: ${saved} nuevos, ${updated} actualizados`);
  return { saved, updated };
}

/**
 * Convierte procedimientos a alertas (legacy - para compatibilidad)
 */
function convertirAAlertas(procedimientos: SeaceProcedimiento[]): ExternalAlert[] {
  return procedimientos.map((proc) => {
    // Formatear cronograma
    const cronogramaText = proc.cronograma
      .map((c) => `${c.etapa}: ${c.fechaInicio} - ${c.fechaFin}`)
      .join('\n');

    return {
      titulo: proc.nomenclatura || 'Procedimiento SEACE',
      contenido: `${proc.objetoContratacion}\n\nEntidad: ${proc.entidad}\n\nCronograma:\n${cronogramaText}`,
      fuente: 'SEACE' as const,
      urlOrigen: proc.url,
      fechaPublicacion: new Date(),
      entidad: proc.entidad,
      tipo: 'LICITACION',
    };
  });
}

/**
 * Ejecuta el scraper de SEACE con Puppeteer
 */
export async function runSeacePuppeteerScraper(
  force = false,
  sessionId?: string,
  customConfig?: SeaceConfig
): Promise<ScraperResult> {
  const startTime = Date.now();
  let browser: Browser | null = null;

  // Configurar el logger para esta sesión
  if (sessionId) {
    currentSessionId = sessionId;
    scraperLog = createSessionLogger(sessionId, 'SEACE Puppeteer');
  }

  try {
    // Usar config personalizado si se proporciona, sino leer de DB
    const config = customConfig || await getSeaceConfig();

    if (!config.enabled && !force) {
      log('info', 'Scraper deshabilitado');
      return {
        source: 'SEACE',
        success: true,
        alertsFound: 0,
        alertsDistributed: 0,
        duration: Date.now() - startTime,
      };
    }

    if (!config.usuario || !config.clave) {
      log('error', 'Credenciales de SEACE no configuradas');
      throw new Error('Credenciales de SEACE no configuradas');
    }

    log('info', `Configuración cargada - Usuario: ${config.usuario}, Entidad: ${config.siglaEntidad}, Año: ${config.anio}`);

    // Iniciar navegador
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Configurar timeout
    page.setDefaultTimeout(30000);

    // Login
    const loginOk = await loginSeace(page, config);
    if (!loginOk) {
      throw new Error('Error en login de SEACE');
    }

    // Navegar a "Mis procedimientos de selección"
    const navOk = await navegarAMisProcedimientos(page);
    if (!navOk) {
      throw new Error('Error navegando a Mis procedimientos de selección');
    }

    // Buscar procedimientos (selecciona año y busca)
    const procedimientos = await buscarProcedimientos(page, config);

    // Guardar en nuevo modelo (ScrapedLicitacion con etapas)
    const { saved, updated } = await guardarProcedimientos(procedimientos, config);

    // También mantener compatibilidad con sistema antiguo de alertas
    const alerts = convertirAAlertas(procedimientos);
    const { distributed } = await processScrapedAlerts(alerts);

    const result: ScraperResult = {
      source: 'SEACE',
      success: true,
      alertsFound: procedimientos.length,
      alertsDistributed: distributed,
      duration: Date.now() - startTime,
      metadata: {
        newLicitaciones: saved,
        updatedLicitaciones: updated,
      },
    };

    await logScraperRun(result);
    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    log('error', `Error ejecutando scraper: ${errorMsg}`);

    const result: ScraperResult = {
      source: 'SEACE',
      success: false,
      alertsFound: 0,
      alertsDistributed: 0,
      error: errorMsg,
      duration: Date.now() - startTime,
    };

    await logScraperRun(result);
    return result;

  } finally {
    if (browser) {
      log('info', 'Cerrando navegador...');
      await browser.close();
    }
    // Limpiar el logger
    scraperLog = null;
    currentSessionId = null;
  }
}

/**
 * Función de prueba manual (para testing)
 */
export async function testSeaceScraper(): Promise<{
  success: boolean;
  message: string;
  config: Partial<SeaceConfig>;
  procedimientos?: SeaceProcedimiento[];
  error?: string;
}> {
  const config = await getSeaceConfig();

  if (!config.usuario || !config.clave) {
    return {
      success: false,
      message: 'Credenciales no configuradas',
      config: { ...config, clave: '***' },
      error: 'Configure usuario y clave de SEACE en el panel de admin',
    };
  }

  try {
    const result = await runSeacePuppeteerScraper(true);
    return {
      success: result.success,
      message: result.success
        ? `Encontrados ${result.alertsFound} procedimientos`
        : `Error: ${result.error}`,
      config: { ...config, clave: '***' },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error ejecutando scraper',
      config: { ...config, clave: '***' },
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export default {
  runSeacePuppeteerScraper,
  testSeaceScraper,
  saveSeaceConfig,
  getSeaceConfig,
};
