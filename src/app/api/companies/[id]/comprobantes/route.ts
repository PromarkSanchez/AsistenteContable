import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { comprobanteSchema } from '@/lib/validations';
import { ZodError } from 'zod';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/comprobantes - Listar comprobantes
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id: companyId } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar que la empresa pertenece al usuario
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Obtener query params
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const periodo = searchParams.get('periodo');
    const skip = parseInt(searchParams.get('skip') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Construir filtros
    const where: any = { companyId };
    if (tipo && ['VENTA', 'COMPRA'].includes(tipo)) {
      where.tipo = tipo;
    }
    if (periodo && /^\d{6}$/.test(periodo)) {
      where.periodo = periodo;
    }

    const [comprobantes, total] = await Promise.all([
      prisma.comprobante.findMany({
        where,
        orderBy: [
          { fechaEmision: 'desc' },
          { serie: 'asc' },
          { numero: 'asc' },
        ],
        skip,
        take: Math.min(limit, 100),
      }),
      prisma.comprobante.count({ where }),
    ]);

    // Convertir Decimal a number para el JSON
    const comprobantesResponse = comprobantes.map((c) => ({
      ...c,
      tipoCambio: c.tipoCambio ? Number(c.tipoCambio) : null,
      baseImponible: Number(c.baseImponible),
      igv: Number(c.igv),
      otrosTributos: Number(c.otrosTributos),
      total: Number(c.total),
    }));

    return NextResponse.json({
      data: comprobantesResponse,
      total,
      skip,
      limit,
    });
  } catch (error) {
    console.error('Error al listar comprobantes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/companies/[id]/comprobantes - Crear comprobante
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id: companyId } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar que la empresa pertenece al usuario
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = comprobanteSchema.parse(body);

    // Verificar duplicado
    const existingComprobante = await prisma.comprobante.findUnique({
      where: {
        companyId_tipoDocumento_serie_numero: {
          companyId,
          tipoDocumento: validatedData.tipoDocumento,
          serie: validatedData.serie,
          numero: validatedData.numero,
        },
      },
    });

    if (existingComprobante) {
      return NextResponse.json(
        { error: 'Ya existe un comprobante con esa serie y número' },
        { status: 400 }
      );
    }

    // Crear comprobante
    const comprobante = await prisma.comprobante.create({
      data: {
        companyId,
        tipo: validatedData.tipo,
        tipoDocumento: validatedData.tipoDocumento,
        serie: validatedData.serie,
        numero: validatedData.numero,
        fechaEmision: validatedData.fechaEmision,
        fechaVencimiento: validatedData.fechaVencimiento || null,
        tipoDocTercero: validatedData.tipoDocTercero,
        rucTercero: validatedData.rucTercero || null,
        razonSocialTercero: validatedData.razonSocialTercero || null,
        moneda: validatedData.moneda,
        tipoCambio: validatedData.tipoCambio || null,
        baseImponible: validatedData.baseImponible,
        igv: validatedData.igv,
        otrosTributos: validatedData.otrosTributos,
        total: validatedData.total,
        esGravada: validatedData.esGravada,
        esExportacion: validatedData.esExportacion,
        afectaIgv: validatedData.afectaIgv,
        periodo: validatedData.periodo,
        comprobanteRefTipo: validatedData.comprobanteRefTipo || null,
        comprobanteRefSerie: validatedData.comprobanteRefSerie || null,
        comprobanteRefNumero: validatedData.comprobanteRefNumero || null,
      },
    });

    return NextResponse.json(
      {
        ...comprobante,
        tipoCambio: comprobante.tipoCambio ? Number(comprobante.tipoCambio) : null,
        baseImponible: Number(comprobante.baseImponible),
        igv: Number(comprobante.igv),
        otrosTributos: Number(comprobante.otrosTributos),
        total: Number(comprobante.total),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al crear comprobante:', error);

    if (error instanceof ZodError) {
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
