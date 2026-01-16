import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { reenviarComprobante } from '@/services/facturacion/facturacion.service';

interface RouteParams {
  params: { id: string };
}

// GET /api/facturacion/[id] - Obtener detalle de comprobante
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
          select: { userId: true, ruc: true, razonSocial: true },
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

    return NextResponse.json({
      id: comprobante.id,
      tipoDocumento: comprobante.tipoDocumento,
      serie: comprobante.serie,
      numero: comprobante.numero,
      fechaEmision: comprobante.fechaEmision,
      cliente: {
        tipoDocumento: comprobante.tipoDocTercero,
        numeroDocumento: comprobante.rucTercero,
        razonSocial: comprobante.razonSocialTercero,
      },
      moneda: comprobante.moneda,
      baseImponible: Number(comprobante.baseImponible),
      igv: Number(comprobante.igv),
      total: Number(comprobante.total),
      estadoSunat: comprobante.estadoSunat,
      codigoRespuestaSunat: comprobante.codigoRespuestaSunat,
      mensajeRespuestaSunat: comprobante.mensajeRespuestaSunat,
      hashResumen: comprobante.hashResumen,
      tieneXml: !!comprobante.xmlFirmado,
      tieneCdr: !!comprobante.cdrBase64,
      empresa: {
        ruc: comprobante.company.ruc,
        razonSocial: comprobante.company.razonSocial,
      },
    });
  } catch (error) {
    console.error('Error obteniendo comprobante:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/facturacion/[id] - Reenviar comprobante a SUNAT
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Verificar acceso
    const comprobante = await prisma.comprobante.findUnique({
      where: { id: params.id },
      include: { company: { select: { userId: true } } },
    });

    if (!comprobante) {
      return NextResponse.json(
        { error: 'Comprobante no encontrado' },
        { status: 404 }
      );
    }

    if (comprobante.company.userId !== payload.sub) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    // Verificar que tiene XML
    if (!comprobante.xmlFirmado) {
      return NextResponse.json(
        { error: 'Comprobante sin XML firmado' },
        { status: 400 }
      );
    }

    // Obtener parámetros
    const body = await request.json().catch(() => ({}));
    const usarBeta = body.usarBeta ?? true;

    // Reenviar a SUNAT
    const resultado = await reenviarComprobante(params.id, usarBeta);

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Error reenviando comprobante:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
