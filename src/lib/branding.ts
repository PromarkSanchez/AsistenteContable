/**
 * Helper para obtener configuración de branding desde el backend
 */

import prisma from '@/lib/prisma';

export interface BrandingConfig {
  appName: string;
  appDescription: string;
  logoBase64: string | null;
  faviconBase64: string | null;
}

const DEFAULT_BRANDING: BrandingConfig = {
  appName: 'Gestión Empresarial',
  appDescription: 'Sistema de Gestión Tributaria',
  logoBase64: null,
  faviconBase64: null,
};

// Cache simple para evitar consultas repetidas
let brandingCache: BrandingConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene la configuración de branding desde la base de datos
 * Usa cache para evitar consultas repetidas
 */
export async function getBranding(): Promise<BrandingConfig> {
  // Verificar cache
  const now = Date.now();
  if (brandingCache && (now - cacheTimestamp) < CACHE_TTL) {
    return brandingCache;
  }

  try {
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'app_branding' },
    });

    if (!config) {
      brandingCache = DEFAULT_BRANDING;
      cacheTimestamp = now;
      return DEFAULT_BRANDING;
    }

    const configData = JSON.parse(config.value);

    brandingCache = {
      appName: configData.appName || DEFAULT_BRANDING.appName,
      appDescription: configData.appDescription || DEFAULT_BRANDING.appDescription,
      logoBase64: configData.logoBase64 || null,
      faviconBase64: configData.faviconBase64 || null,
    };
    cacheTimestamp = now;

    return brandingCache;
  } catch (error) {
    console.error('Error obteniendo branding:', error);
    return DEFAULT_BRANDING;
  }
}

/**
 * Obtiene solo el nombre de la aplicación
 */
export async function getAppName(): Promise<string> {
  const branding = await getBranding();
  return branding.appName;
}

/**
 * Invalida el cache de branding (llamar después de actualizar configuración)
 */
export function invalidateBrandingCache(): void {
  brandingCache = null;
  cacheTimestamp = 0;
}
