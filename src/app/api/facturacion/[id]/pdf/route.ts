import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { generarComprobantePDF, DatosComprobantePDF } from '@/services/pdf/comprobante-pdf.service';

interface RouteParams {
  params: { id: string };
}

// GET /api/facturacion/[id]/pdf - Descargar PDF del comprobante
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
          select: {
            userId: true,
            ruc: true,
            razonSocial: true,
            nombreComercial: true,
            direccionFiscal: true,
            logoBase64: true,
          },
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

    // Construir datos para el PDF
    // Nota: En una implementación completa, tendríamos los items del comprobante
    // Por ahora, generamos un item único con el total
    const datosComprobante: DatosComprobantePDF = {
      empresa: {
        ruc: comprobante.company.ruc,
        razonSocial: comprobante.company.razonSocial,
        nombreComercial: comprobante.company.nombreComercial || undefined,
        direccion: comprobante.company.direccionFiscal || 'LIMA',
        logoBase64: comprobante.company.logoBase64 || undefined,
      },
      tipoDocumento: comprobante.tipoDocumento,
      serie: comprobante.serie,
      numero: comprobante.numero,
      fechaEmision: comprobante.fechaEmision.toISOString().split('T')[0],
      cliente: {
        tipoDocumento: comprobante.tipoDocTercero,
        numeroDocumento: comprobante.rucTercero || '',
        razonSocial: comprobante.razonSocialTercero || '',
        direccion: undefined,
      },
      items: [
        {
          descripcion: 'Producto/Servicio',
          cantidad: 1,
          unidadMedida: 'NIU',
          precioUnitario: Number(comprobante.baseImponible),
          valorVenta: Number(comprobante.baseImponible),
        },
      ],
      moneda: comprobante.moneda,
      subtotal: Number(comprobante.baseImponible),
      igv: Number(comprobante.igv),
      total: Number(comprobante.total),
      hashResumen: comprobante.hashResumen || undefined,
    };

    // Generar PDF
    const pdfBuffer = generarComprobantePDF(datosComprobante);
    const fileName = `${comprobante.company.ruc}-${comprobante.tipoDocumento}-${comprobante.serie}-${comprobante.numero}.pdf`;

    // Convertir Buffer a Uint8Array para NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error generando PDF:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
