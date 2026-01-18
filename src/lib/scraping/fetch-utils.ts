/**
 * Utilidades de fetch para scraping de sitios gubernamentales
 * Usa axios para mejor compatibilidad con SSL legacy
 */

import axios, { AxiosInstance } from 'axios';
import https from 'https';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Timeout para requests
const FETCH_TIMEOUT = 8000; // 8 segundos

// Cliente axios con SSL permisivo para sitios gubernamentales
const legacyClient: AxiosInstance = axios.create({
  timeout: FETCH_TIMEOUT,
  headers: {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    // Forzar TLS 1.2 y ciphers que no usan DHE
    secureProtocol: 'TLSv1_2_method',
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-SHA256',
      'ECDHE-RSA-AES256-SHA384',
      'AES128-GCM-SHA256',
      'AES256-GCM-SHA384',
      'AES128-SHA256',
      'AES256-SHA256',
      'HIGH',
      '!aNULL',
      '!eNULL',
      '!EXPORT',
      '!DES',
      '!RC4',
      '!MD5',
      '!PSK',
      '!SRP',
      '!CAMELLIA',
    ].join(':'),
  }),
  maxRedirects: 5,
  validateStatus: (status) => status < 500,
});

// Lista de dominios gubernamentales que requieren SSL legacy
const LEGACY_SSL_DOMAINS = [
  'seace.gob.pe',
  'osce.gob.pe',
  'sunat.gob.pe',
  'gob.pe',
];

/**
 * Verifica si un dominio requiere SSL legacy
 */
function requiresLegacySSL(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return LEGACY_SSL_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Fetch usando axios con configuración SSL permisiva
 */
export async function fetchLegacySite(url: string): Promise<string> {
  try {
    const response = await legacyClient.get(url);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.message);
    }
    throw error;
  }
}

/**
 * Fetch con timeout usando fetch nativo (para sitios modernos)
 */
export async function fetchModern(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch inteligente que usa el método apropiado según el dominio
 */
export async function fetchWithFallback(url: string): Promise<string> {
  // Para dominios gubernamentales, usar directamente axios con SSL permisivo
  if (requiresLegacySSL(url)) {
    console.log(`[Fetch] Usando axios SSL legacy para: ${new URL(url).hostname}`);
    return fetchLegacySite(url);
  }

  // Para otros sitios, intentar fetch moderno primero
  try {
    return await fetchModern(url);
  } catch (error) {
    console.log(`[Fetch] Fetch moderno falló, intentando axios para: ${url}`);
    return fetchLegacySite(url);
  }
}

export default {
  fetchLegacySite,
  fetchModern,
  fetchWithFallback,
};
