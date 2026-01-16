import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

// GET /api/facturacion/[id]/xml - Descargar XML del comprobante
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const comprobante = await prisma.comprobante.findUnique({
      where: { id: params.id },
      include: {
        company: {
          select: { userId: true, ruc: true },
        },
      },
    });

    if (!comprobante) {
      return NextResponse.json(
        { error: 'Comprobante no encontrado' },
        { status: 404 }
      );
    }

    // Verificar acceso
    if (comprobante.company.userId !== payload.sub) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    if (!comprobante.xmlFirmado) {
      return NextResponse.json(
        { error: 'El comprobante no tiene XML' },
        { status: 404 }
      );
    }

    // Decodificar XML de Base64
    const xmlContent = Buffer.from(comprobante.xmlFirmado, 'base64').toString('utf-8');
    const fileName = `${comprobante.company.ruc}-${comprobante.tipoDocumento}-${comprobante.serie}-${comprobante.numero}.xml`;

    return new NextResponse(xmlContent, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error descargando XML:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
