import { NextRequest, NextResponse } from 'next/server';
import { emitirComprobante, DatosEmision } from '@/services/facturacion/facturacion.service';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Schema de validación para emisión
const emisionSchema = z.object({
  companyId: z.string().uuid(),
  tipoDocumento: z.enum(['01', '03', '07', '08']),
  cliente: z.object({
    tipoDocumento: z.string().min(1).max(2),
    numeroDocumento: z.string().min(8).max(15),
    razonSocial: z.string().min(1).max(255),
    direccion: z.string().optional(),
  }),
  items: z.array(z.object({
    descripcion: z.string().min(1).max(500),
    cantidad: z.number().positive(),
    precioUnitario: z.number().nonnegative(),
    unidadMedida: z.string().optional(),
  })).min(1),
  moneda: z.string().default('PEN'),
  observaciones: z.string().optional(),
  usarBeta: z.boolean().default(true),
});

// POST /api/facturacion - Emitir comprobante electrónico
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validatedData = emisionSchema.parse(body);

    // Verificar que la empresa pertenece al usuario
    const company = await prisma.company.findFirst({
      where: { id: validatedData.companyId, userId: payload.sub },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada o no autorizada' },
        { status: 404 }
      );
    }

    // Emitir comprobante
    const resultado = await emitirComprobante(
      {
        companyId: validatedData.companyId,
        tipoDocumento: validatedData.tipoDocumento,
        cliente: validatedData.cliente,
        items: validatedData.items,
        moneda: validatedData.moneda,
        observaciones: validatedData.observaciones,
      },
      validatedData.usarBeta
    );

    if (!resultado.success) {
      return NextResponse.json(
        {
          error: resultado.error,
          respuestaSunat: resultado.respuestaSunat
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      comprobante: resultado.comprobante,
      respuestaSunat: resultado.respuestaSunat,
    }, { status: 201 });
  } catch (error) {
    console.error('Error en facturación:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET /api/facturacion - Listar comprobantes electrónicos emitidos
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const periodo = searchParams.get('periodo');
    const estadoSunat = searchParams.get('estadoSunat');
    const skip = parseInt(searchParams.get('skip') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Verificar acceso a la empresa
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: payload.sub },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Filtros
    const where: any = {
      companyId,
      tipo: 'VENTA',
      xmlFirmado: { not: null }, // Solo comprobantes electrónicos
    };

    if (periodo) where.periodo = periodo;
    if (estadoSunat) where.estadoSunat = estadoSunat;

    const [comprobantes, total] = await Promise.all([
      prisma.comprobante.findMany({
        where,
        orderBy: { fechaEmision: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          tipoDocumento: true,
          serie: true,
          numero: true,
          fechaEmision: true,
          rucTercero: true,
          razonSocialTercero: true,
          total: true,
          estadoSunat: true,
          codigoRespuestaSunat: true,
          mensajeRespuestaSunat: true,
          hashResumen: true,
        },
      }),
      prisma.comprobante.count({ where }),
    ]);

    return NextResponse.json({
      data: comprobantes.map((c: { total: unknown; [key: string]: unknown }) => ({
        ...c,
        total: Number(c.total),
      })),
      total,
      skip,
      limit,
    });
  } catch (error) {
    console.error('Error listando comprobantes electrónicos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
