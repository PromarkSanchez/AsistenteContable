import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/comprobantes/periodos - Listar períodos con comprobantes
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

    // Obtener períodos únicos con totales
    const periodos = await prisma.comprobante.groupBy({
      by: ['periodo', 'tipo'],
      where: {
        companyId,
        estado: 'ACTIVO',
      },
      _count: true,
      _sum: {
        total: true,
      },
      orderBy: {
        periodo: 'desc',
      },
    });

    // Agrupar por período
    const periodosMap = new Map<string, {
      periodo: string;
      total: number;
      ventas: number;
      compras: number;
    }>();

    for (const p of periodos) {
      const existing = periodosMap.get(p.periodo) || {
        periodo: p.periodo,
        total: 0,
        ventas: 0,
        compras: 0,
      };

      const totalSum = p._sum.total ? Number(p._sum.total) : 0;
      existing.total += p._count;

      if (p.tipo === 'VENTA') {
        existing.ventas += p._count;
      } else {
        existing.compras += p._count;
      }

      periodosMap.set(p.periodo, existing);
    }

    const result = Array.from(periodosMap.values()).sort(
      (a, b) => b.periodo.localeCompare(a.periodo)
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al listar períodos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
