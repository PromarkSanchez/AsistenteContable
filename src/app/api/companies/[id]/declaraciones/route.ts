import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calcularTributosDelPeriodo } from '@/services/calculadora-tributaria.service';
import { requireCompanyAccess, isAccessError, READ_ROLES, WRITE_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/declaraciones
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;

    const access = await requireCompanyAccess(request, companyId, READ_ROLES);
    if (isAccessError(access)) return access;

    const declaraciones = await prisma.declaracionPDT621.findMany({
      where: { companyId },
      orderBy: { periodo: 'desc' },
    });

    return NextResponse.json(
      declaraciones.map((d: typeof declaraciones[number]) => ({
        ...d,
        ventasGravadas: Number(d.ventasGravadas),
        ventasNoGravadas: Number(d.ventasNoGravadas),
        exportaciones: Number(d.exportaciones),
        debitoFiscal: Number(d.debitoFiscal),
        creditoFiscal: Number(d.creditoFiscal),
        igvAPagar: Number(d.igvAPagar),
        saldoFavorPeriodo: Number(d.saldoFavorPeriodo),
        pagoCuentaRenta: Number(d.pagoCuentaRenta),
        totalDeuda: Number(d.totalDeuda),
      }))
    );
  } catch (error) {
    console.error('Error al obtener declaraciones:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/companies/[id]/declaraciones
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;

    const access = await requireCompanyAccess(request, companyId, WRITE_ROLES);
    if (isAccessError(access)) return access;

    const body = await request.json();
    const { periodo, saldoFavorAnterior = 0, retenciones = 0, percepciones = 0, saldoFavorRentaAnterior = 0 } = body;

    if (!periodo || !/^\d{6}$/.test(periodo)) {
      return NextResponse.json(
        { error: 'Periodo inválido. Formato esperado: YYYYMM' },
        { status: 400 }
      );
    }

    // Verificar si ya existe una declaración para este periodo
    const existente = await prisma.declaracionPDT621.findFirst({
      where: { companyId, periodo },
    });

    if (existente) {
      return NextResponse.json(
        { error: 'Ya existe una declaración para este periodo' },
        { status: 409 }
      );
    }

    // Calcular tributos
    const resultado = await calcularTributosDelPeriodo(
      companyId,
      periodo,
      saldoFavorAnterior,
      retenciones,
      percepciones,
      saldoFavorRentaAnterior
    );

    // Crear declaración
    const declaracion = await prisma.declaracionPDT621.create({
      data: {
        companyId,
        periodo,
        estado: 'CALCULADA',
        ventasGravadas: resultado.ventasGravadas,
        ventasNoGravadas: resultado.ventasNoGravadas,
        exportaciones: resultado.exportaciones,
        descuentosVentas: 0,
        otrasVentas: 0,
        comprasGravadasDestGravadas: resultado.comprasGravadasDestGravadas,
        comprasGravadasDestMixtas: resultado.comprasGravadasDestMixtas,
        comprasNoGravadas: resultado.comprasNoGravadas,
        descuentosCompras: 0,
        importaciones: 0,
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
        intereses: 0,
      },
    });

    return NextResponse.json({
      ...declaracion,
      ventasGravadas: Number(declaracion.ventasGravadas),
      debitoFiscal: Number(declaracion.debitoFiscal),
      creditoFiscal: Number(declaracion.creditoFiscal),
      igvAPagar: Number(declaracion.igvAPagar),
      totalDeuda: Number(declaracion.totalDeuda),
      resultado,
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear declaración:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
