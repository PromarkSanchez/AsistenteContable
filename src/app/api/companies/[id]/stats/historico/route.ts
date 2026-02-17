import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyAccess, isAccessError, READ_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/stats/historico - Obtener estadísticas históricas para gráficos
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;

    const access = await requireCompanyAccess(request, companyId, READ_ROLES);
    if (isAccessError(access)) return access;

    const { searchParams } = new URL(request.url);
    const meses = parseInt(searchParams.get('meses') || '6');

    // Calcular los últimos N períodos
    const periodos: string[] = [];
    const now = new Date();
    for (let i = 0; i < meses; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodo = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      periodos.push(periodo);
    }

    // Obtener datos de comprobantes agrupados por período y tipo
    const comprobantes = await prisma.comprobante.groupBy({
      by: ['periodo', 'tipo'],
      where: {
        companyId,
        estado: 'ACTIVO',
        periodo: { in: periodos },
      },
      _sum: {
        total: true,
        baseImponible: true,
        igv: true,
      },
      _count: true,
    });

    // Estructurar datos para gráficos
    const dataMap = new Map<string, {
      periodo: string;
      mes: string;
      ventas: number;
      compras: number;
      igvVentas: number;
      igvCompras: number;
      igvNeto: number;
      cantidadVentas: number;
      cantidadCompras: number;
    }>();

    // Inicializar todos los períodos con ceros
    for (const periodo of periodos) {
      const [year, month] = periodo.split('-');
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const mesNombre = `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;

      dataMap.set(periodo, {
        periodo,
        mes: mesNombre,
        ventas: 0,
        compras: 0,
        igvVentas: 0,
        igvCompras: 0,
        igvNeto: 0,
        cantidadVentas: 0,
        cantidadCompras: 0,
      });
    }

    // Llenar con datos reales
    for (const c of comprobantes) {
      const data = dataMap.get(c.periodo);
      if (data) {
        const total = c._sum.total ? Number(c._sum.total) : 0;
        const igv = c._sum.igv ? Number(c._sum.igv) : 0;

        if (c.tipo === 'VENTA') {
          data.ventas = total;
          data.igvVentas = igv;
          data.cantidadVentas = c._count;
        } else {
          data.compras = total;
          data.igvCompras = igv;
          data.cantidadCompras = c._count;
        }
        data.igvNeto = data.igvVentas - data.igvCompras;
      }
    }

    // Convertir a array y ordenar cronológicamente
    const historico = Array.from(dataMap.values())
      .sort((a, b) => a.periodo.localeCompare(b.periodo));

    // Calcular totales y promedios
    const totales = historico.reduce(
      (acc, item) => ({
        ventas: acc.ventas + item.ventas,
        compras: acc.compras + item.compras,
        igvVentas: acc.igvVentas + item.igvVentas,
        igvCompras: acc.igvCompras + item.igvCompras,
        comprobantes: acc.comprobantes + item.cantidadVentas + item.cantidadCompras,
      }),
      { ventas: 0, compras: 0, igvVentas: 0, igvCompras: 0, comprobantes: 0 }
    );

    const promedios = {
      ventasMensual: totales.ventas / meses,
      comprasMensual: totales.compras / meses,
      igvMensual: (totales.igvVentas - totales.igvCompras) / meses,
      margenBruto: totales.ventas > 0 ? ((totales.ventas - totales.compras) / totales.ventas) * 100 : 0,
    };

    // Calcular tendencia (comparar último mes vs promedio)
    const ultimoMes = historico[historico.length - 1];
    const tendencia = {
      ventas: ultimoMes && promedios.ventasMensual > 0
        ? ((ultimoMes.ventas - promedios.ventasMensual) / promedios.ventasMensual) * 100
        : 0,
      compras: ultimoMes && promedios.comprasMensual > 0
        ? ((ultimoMes.compras - promedios.comprasMensual) / promedios.comprasMensual) * 100
        : 0,
    };

    return NextResponse.json({
      historico,
      totales,
      promedios,
      tendencia,
      periodos: meses,
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas históricas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
