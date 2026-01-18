import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encryptionService } from '@/lib/encryption';
import { runSeacePuppeteerScraper } from '@/lib/scraping/seace-puppeteer';
import { scraperLogger } from '@/lib/scraping/scraper-logger';

export const dynamic = 'force-dynamic';

// Tipo para el resultado de la query de empresas con SEACE
type SeaceCompany = {
  id: string;
  ruc: string;
  razonSocial: string;
  usuarioSeace: string | null;
  entidadSeace: string | null;
  siglaEntidadSeace: string | null;
  anioSeace: string | null;
  seaceEnabled: boolean;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
};

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

// GET /api/admin/alertas/seace-accounts - Listar empresas con SEACE configurado
export async function GET(request: NextRequest) {
  try {
    if (!(await verifySuperadmin(request))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Obtener todas las empresas que tienen credenciales SEACE configuradas
    const companies: SeaceCompany[] = await prisma.company.findMany({
      where: {
        usuarioSeace: { not: null },
        claveSeaceEncrypted: { not: null },
      },
      select: {
        id: true,
        ruc: true,
        razonSocial: true,
        usuarioSeace: true,
        entidadSeace: true,
        siglaEntidadSeace: true,
        anioSeace: true,
        seaceEnabled: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        razonSocial: 'asc',
      },
    });

    // Obtener estadísticas
    const stats = {
      total: companies.length,
      enabled: companies.filter(c => c.seaceEnabled).length,
      disabled: companies.filter(c => !c.seaceEnabled).length,
    };

    return NextResponse.json({
      accounts: companies.map(c => ({
        id: c.id,
        ruc: c.ruc,
        razonSocial: c.razonSocial,
        usuarioSeace: c.usuarioSeace,
        entidadSeace: c.entidadSeace,
        siglaEntidadSeace: c.siglaEntidadSeace,
        anioSeace: c.anioSeace,
        seaceEnabled: c.seaceEnabled,
        user: c.user,
      })),
      stats,
    });
  } catch (error) {
    console.error('Error listando cuentas SEACE:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/admin/alertas/seace-accounts - Actualizar estado de una cuenta (habilitar/deshabilitar para cron)
export async function PUT(request: NextRequest) {
  try {
    if (!(await verifySuperadmin(request))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { companyId, seaceEnabled } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { seaceEnabled },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error actualizando cuenta SEACE:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/admin/alertas/seace-accounts - Ejecutar scraping para una cuenta específica
export async function POST(request: NextRequest) {
  try {
    if (!(await verifySuperadmin(request))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

    // Obtener credenciales de la empresa
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        ruc: true,
        razonSocial: true,
        usuarioSeace: true,
        claveSeaceEncrypted: true,
        entidadSeace: true,
        siglaEntidadSeace: true,
        anioSeace: true,
      },
    });

    if (!company || !company.usuarioSeace || !company.claveSeaceEncrypted) {
      return NextResponse.json({
        error: 'Empresa no tiene credenciales SEACE configuradas'
      }, { status: 400 });
    }

    // Desencriptar la clave
    const claveSeace = encryptionService.decrypt(company.claveSeaceEncrypted);

    // Configurar credenciales para el scraper
    const seaceConfig = {
      usuario: company.usuarioSeace,
      clave: claveSeace,
      entidad: company.entidadSeace || '',
      siglaEntidad: company.siglaEntidadSeace || '',
      anio: company.anioSeace || new Date().getFullYear().toString(),
      enabled: true,
    };

    // Crear sesión de logs
    const sessionId = scraperLogger.startSession(`SEACE - ${company.razonSocial}`);
    console.log(`[SEACE] Sesión ${sessionId} - Ejecutando scraper para: ${company.razonSocial} (${company.ruc})`);

    // Ejecutar el scraper en background
    runSeacePuppeteerScraper(true, sessionId, seaceConfig)
      .then((result) => {
        console.log(`[SEACE] Sesión ${sessionId} completada: ${result.alertsFound} procedimientos`);
        scraperLogger.endSession(sessionId, result.success);
      })
      .catch((error) => {
        console.error(`[SEACE] Sesión ${sessionId} error:`, error);
        scraperLogger.endSession(sessionId, false);
      });

    // Retornar inmediatamente con el sessionId para que el frontend abra la consola
    return NextResponse.json({
      success: true,
      sessionId,
      backgroundMode: true,
      message: `Scraping iniciado para ${company.razonSocial}`,
      company: {
        id: company.id,
        ruc: company.ruc,
        razonSocial: company.razonSocial,
      },
    });
  } catch (error) {
    console.error('Error ejecutando scraping SEACE:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
