import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { testSeaceScraper, saveSeaceConfig } from '@/lib/scraping/seace-puppeteer';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutos para el scraping

// Verificar que sea superadmin
async function verifySuperadmin(request: NextRequest): Promise<boolean> {
  const userId = request.headers.get('x-user-id');
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperadmin: true },
  });

  return user?.isSuperadmin === true;
}

// GET /api/admin/alertas/seace-test - Obtener configuración actual
export async function GET(request: NextRequest) {
  try {
    if (!(await verifySuperadmin(request))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Obtener configuración
    const settings = await prisma.systemSetting.findMany({
      where: { key: { startsWith: 'seace_' } },
    });

    const config: Record<string, string> = {};
    for (const setting of settings) {
      const key = setting.key.replace('seace_', '');
      // No devolver la clave en texto plano
      config[key] = key === 'clave' ? (setting.value ? '••••••••' : '') : setting.value;
    }

    return NextResponse.json({
      config: {
        usuario: config.usuario || '',
        clave: config.clave || '',
        entidad: config.entidad || 'SUPERINTENDENCIA NACIONAL DE ADUANAS Y DE ADMINISTRACION TRIBUTARIA - SUNAT',
        siglaEntidad: config.sigla_entidad || 'SUNAT',
        anio: config.anio || new Date().getFullYear().toString(),
        enabled: config.enabled === 'true',
      },
    });
  } catch (error) {
    console.error('Error obteniendo config SEACE:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/admin/alertas/seace-test - Actualizar configuración
export async function PUT(request: NextRequest) {
  try {
    if (!(await verifySuperadmin(request))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { usuario, clave, entidad, siglaEntidad, anio, enabled } = body;

    await saveSeaceConfig({
      usuario,
      clave,
      entidad,
      siglaEntidad,
      anio,
      enabled,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error guardando config SEACE:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/admin/alertas/seace-test - Ejecutar prueba manual
export async function POST(request: NextRequest) {
  try {
    if (!(await verifySuperadmin(request))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    console.log('[SEACE Test] Iniciando prueba manual...');

    const result = await testSeaceScraper();

    console.log('[SEACE Test] Resultado:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en prueba SEACE:', error);
    return NextResponse.json({
      success: false,
      message: 'Error ejecutando prueba',
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}
