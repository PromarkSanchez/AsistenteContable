import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calcularTributosDelPeriodo } from '@/services/calculadora-tributaria.service';
import { declaracionIniciarSchema } from '@/lib/validations';
import { ZodError } from 'zod';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/declaraciones - Listar declaraciones
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

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    const declaraciones = await prisma.declaracionPDT621.findMany({
      where: { companyId },
      orderBy: { periodo: 'desc' },
    });

    // Convertir Decimal a number
    const declaracionesResponse = declaraciones.map((d) => ({
      ...d,
      ventasGravadas: Number(d.ventasGravadas),
      ventasNoGravadas: Number(d.ventasNoGravadas),
      exportaciones: Number(d.exportaciones),
      descuentosVentas: Number(d.descuentosVentas),
      otrasVentas: Number(d.otrasVentas),
      comprasGravadasDestGravadas: Number(d.comprasGravadasDestGravadas),
      comprasGravadasDestMixtas: Number(d.comprasGravadasDestMixtas),
      comprasNoGravadas: Number(d.comprasNoGravadas),
      descuentosCompras: Number(d.descuentosCompras),
      importaciones: Number(d.importaciones),
      debitoFiscal: Number(d.debitoFiscal),
      creditoFiscal: Number(d.creditoFiscal),
      saldoFavorAnterior: Number(d.saldoFavorAnterior),
      retenciones: Number(d.retenciones),
      percepciones: Number(d.percepciones),
      igvAPagar: Number(d.igvAPagar),
      saldoFavorPeriodo: Number(d.saldoFavorPeriodo),
      ingresosNetos: Number(d.ingresosNetos),
      coeficienteRenta: Number(d.coeficienteRenta),
      pagoCuentaRenta: Number(d.pagoCuentaRenta),
      saldoFavorRentaAnterior: Number(d.saldoFavorRentaAnterior),
      totalDeuda: Number(d.totalDeuda),
      intereses: Number(d.intereses),
    }));

    return NextResponse.json(declaracionesResponse);
  } catch (error) {
    console.error('Error al listar declaraciones:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/companies/[id]/declaraciones - Crear/iniciar declaración
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
    const validatedData = declaracionIniciarSchema.parse(body);

    // Verificar si ya existe
    const existing = await prisma.declaracionPDT621.findUnique({
      where: {
        companyId_periodo: {
          companyId,
          periodo: validatedData.periodo,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una declaración para este período', existing },
        { status: 400 }
      );
    }

    // Obtener saldo a favor del período anterior
    const periodoAnterior = getPeriodoAnterior(validatedData.periodo);
    const declaracionAnterior = await prisma.declaracionPDT621.findUnique({
      where: {
        companyId_periodo: {
          companyId,
          periodo: periodoAnterior,
        },
      },
    });

    const saldoFavorAnterior = declaracionAnterior
      ? Number(declaracionAnterior.saldoFavorPeriodo)
      : 0;
    const saldoFavorRentaAnterior = 0; // Por ahora simplificado

    // Calcular tributos
    const resultado = await calcularTributosDelPeriodo(
      companyId,
      validatedData.periodo,
      saldoFavorAnterior,
      0,
      0,
      saldoFavorRentaAnterior
    );

    // Crear declaración
    const declaracion = await prisma.declaracionPDT621.create({
      data: {
        companyId,
        periodo: validatedData.periodo,
        estado: 'CALCULADA',
        ventasGravadas: resultado.ventasGravadas,
        ventasNoGravadas: resultado.ventasNoGravadas,
        exportaciones: resultado.exportaciones,
        comprasGravadasDestGravadas: resultado.comprasGravadasDestGravadas,
        comprasGravadasDestMixtas: resultado.comprasGravadasDestMixtas,
        comprasNoGravadas: resultado.comprasNoGravadas,
        debitoFiscal: resultado.debitoFiscal,
        creditoFiscal: resultado.creditoFiscal,
        saldoFavorAnterior: resultado.saldoFavorAnterior,
        retenciones: resultado.retenciones,
        percepciones: resultado.percepciones,
        igvAPagar: resultado.igvAPagar,
        saldoFavorPeriodo: resultado.saldoFavorPeriodo,
        ingresosNetos: resultado.ingresosNetos,
        coeficienteRenta: resultado.coeficiente,
        pagoCuentaRenta: resultado.pagoCuentaRenta,
        saldoFavorRentaAnterior: resultado.saldoFavorRentaAnterior,
        totalDeuda: resultado.totalDeuda,
      },
    });

    return NextResponse.json(
      {
        ...declaracion,
        ventasGravadas: Number(declaracion.ventasGravadas),
        ventasNoGravadas: Number(declaracion.ventasNoGravadas),
        exportaciones: Number(declaracion.exportaciones),
        debitoFiscal: Number(declaracion.debitoFiscal),
        creditoFiscal: Number(declaracion.creditoFiscal),
        saldoFavorAnterior: Number(declaracion.saldoFavorAnterior),
        igvAPagar: Number(declaracion.igvAPagar),
        saldoFavorPeriodo: Number(declaracion.saldoFavorPeriodo),
        ingresosNetos: Number(declaracion.ingresosNetos),
        coeficienteRenta: Number(declaracion.coeficienteRenta),
        pagoCuentaRenta: Number(declaracion.pagoCuentaRenta),
        totalDeuda: Number(declaracion.totalDeuda),
        resultado,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al crear declaración:', error);

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

function getPeriodoAnterior(periodo: string): string {
  const year = parseInt(periodo.slice(0, 4));
  const month = parseInt(periodo.slice(4, 6));

  if (month === 1) {
    return `${year - 1}12`;
  }
  return `${year}${String(month - 1).padStart(2, '0')}`;
}
