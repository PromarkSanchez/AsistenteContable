import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

// GET /api/facturacion/[id]/cdr - Descargar CDR del comprobante
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

    if (!comprobante.cdrBase64) {
      return NextResponse.json(
        { error: 'El comprobante no tiene CDR (Constancia de Recepción)' },
        { status: 404 }
      );
    }

    // Decodificar CDR de Base64 (es un ZIP)
    const cdrBuffer = Buffer.from(comprobante.cdrBase64, 'base64');
    const fileName = `R-${comprobante.company.ruc}-${comprobante.tipoDocumento}-${comprobante.serie}-${comprobante.numero}.zip`;

    return new NextResponse(cdrBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error descargando CDR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
