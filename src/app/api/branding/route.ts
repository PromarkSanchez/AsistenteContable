import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/branding - Obtener configuración de branding (público)
export async function GET() {
  try {
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'app_branding' },
    });

    if (!config) {
      return NextResponse.json({
        appName: 'Contador Virtual',
        appDescription: 'Sistema de Gestión Tributaria',
        logoBase64: null,
        faviconBase64: null,
      });
    }

    const configData = JSON.parse(config.value);

    return NextResponse.json({
      appName: configData.appName || 'Contador Virtual',
      appDescription: configData.appDescription || 'Sistema de Gestión Tributaria',
      logoBase64: configData.logoBase64 || null,
      faviconBase64: configData.faviconBase64 || null,
    });
  } catch (error) {
    console.error('Error obteniendo configuración de branding:', error);
    // En caso de error, devolver valores por defecto
    return NextResponse.json({
      appName: 'Contador Virtual',
      appDescription: 'Sistema de Gestión Tributaria',
      logoBase64: null,
      faviconBase64: null,
    });
  }
}
