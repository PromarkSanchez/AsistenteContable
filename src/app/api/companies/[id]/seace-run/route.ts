import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractTokenFromHeader } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { encryptionService } from '@/lib/encryption';
import { runSeacePuppeteerScraper } from '@/lib/scraping/seace-puppeteer';
import { scraperLogger } from '@/lib/scraping/scraper-logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutos para el scraping

// POST /api/companies/[id]/seace-run - Ejecutar scraping SEACE para esta empresa
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar que la empresa pertenece al usuario
    const company = await prisma.company.findFirst({
      where: {
        id: params.id,
        userId: payload.sub,
      },
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

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }

    if (!company.usuarioSeace || !company.claveSeaceEncrypted) {
      return NextResponse.json({
        error: 'Configura tus credenciales SEACE primero'
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
    console.log(`[SEACE User] Sesión ${sessionId} - Ejecutando scraper para: ${company.razonSocial} (${company.ruc})`);

    // Ejecutar el scraper en background
    runSeacePuppeteerScraper(true, sessionId, seaceConfig)
      .then((result) => {
        console.log(`[SEACE User] Sesión ${sessionId} completada: ${result.alertsFound} procedimientos`);
        scraperLogger.endSession(sessionId, result.success);
      })
      .catch((error) => {
        console.error(`[SEACE User] Sesión ${sessionId} error:`, error);
        scraperLogger.endSession(sessionId, false);
      });

    // Retornar inmediatamente con el sessionId
    return NextResponse.json({
      success: true,
      sessionId,
      backgroundMode: true,
      message: `Scraping iniciado para ${company.razonSocial}`,
    });
  } catch (error) {
    console.error('Error ejecutando scraping SEACE:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
