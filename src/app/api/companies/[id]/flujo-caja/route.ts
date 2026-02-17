import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyAccess, isAccessError, READ_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/flujo-caja - Obtener proyección de flujo de caja
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;

    const access = await requireCompanyAccess(request, companyId, READ_ROLES);
    if (isAccessError(access)) return access;

    const { searchParams } = new URL(request.url);
    const meses = parseInt(searchParams.get('meses') || '3');

    // Calcular fechas
    const hoy = new Date();
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finProyeccion = new Date(hoy.getFullYear(), hoy.getMonth() + meses, 0);

    // Obtener comprobantes de los últimos 6 meses para calcular promedios
    const hace6Meses = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1);

    const comprobantes = await prisma.comprobante.findMany({
      where: {
        companyId,
        estado: 'ACTIVO',
        fechaEmision: {
          gte: hace6Meses,
        },
      },
      select: {
        tipo: true,
        total: true,
        igv: true,
        fechaEmision: true,
        periodo: true,
      },
    });

    // Agrupar por mes para calcular promedios
    const ventasPorMes: Record<string, number> = {};
    const comprasPorMes: Record<string, number> = {};

    for (const comp of comprobantes) {
      const periodo = comp.periodo;
      const total = Number(comp.total);

      if (comp.tipo === 'VENTA') {
        ventasPorMes[periodo] = (ventasPorMes[periodo] || 0) + total;
      } else {
        comprasPorMes[periodo] = (comprasPorMes[periodo] || 0) + total;
      }
    }

    // Calcular promedios mensuales
    const mesesConDatos = Object.keys(ventasPorMes).length || 1;
    const promedioVentasMensual = Object.values(ventasPorMes).reduce((a, b) => a + b, 0) / mesesConDatos;
    const promedioComprasMensual = Object.values(comprasPorMes).reduce((a, b) => a + b, 0) / mesesConDatos;

    // Calcular IGV promedio
    const igvVentasProm = promedioVentasMensual * 0.18 / 1.18; // Extraer IGV del total
    const igvComprasProm = promedioComprasMensual * 0.18 / 1.18;
    const igvAPagarProm = Math.max(0, igvVentasProm - igvComprasProm);

    // Generar proyección para los próximos meses
    const proyeccion: Array<{
      periodo: string;
      mes: string;
      ventasProyectadas: number;
      comprasProyectadas: number;
      igvAPagar: number;
      rentaEstimada: number;
      flujoNeto: number;
      flujoAcumulado: number;
    }> = [];

    let flujoAcumulado = 0;

    for (let i = 0; i < meses; i++) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
      const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const mes = `${monthNames[fecha.getMonth()]} ${fecha.getFullYear()}`;

      // Para el mes actual, usar datos reales si existen
      const ventasReales = ventasPorMes[periodo];
      const comprasReales = comprasPorMes[periodo];

      const ventasProyectadas = ventasReales !== undefined ? ventasReales : promedioVentasMensual;
      const comprasProyectadas = comprasReales !== undefined ? comprasReales : promedioComprasMensual;

      const igvVentas = ventasProyectadas * 0.18 / 1.18;
      const igvCompras = comprasProyectadas * 0.18 / 1.18;
      const igvAPagar = Math.max(0, igvVentas - igvCompras);

      // Pago a cuenta de renta (1.5% de ventas)
      const rentaEstimada = ventasProyectadas * 0.015;

      // Flujo neto = Ingresos - Egresos - Impuestos
      const flujoNeto = ventasProyectadas - comprasProyectadas - igvAPagar - rentaEstimada;
      flujoAcumulado += flujoNeto;

      proyeccion.push({
        periodo,
        mes,
        ventasProyectadas,
        comprasProyectadas,
        igvAPagar,
        rentaEstimada,
        flujoNeto,
        flujoAcumulado,
      });
    }

    // Calcular indicadores
    const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

    // Cuentas por cobrar (ventas del mes actual y anterior no pagadas - estimado)
    type ComprobanteItem = typeof comprobantes[number];
    const ventasUltimos2Meses = comprobantes
      .filter((c: ComprobanteItem) => c.tipo === 'VENTA' && c.fechaEmision >= new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))
      .reduce((sum: number, c: ComprobanteItem) => sum + Number(c.total), 0);

    // Cuentas por pagar (compras del mes actual y anterior - estimado)
    const comprasUltimos2Meses = comprobantes
      .filter((c: ComprobanteItem) => c.tipo === 'COMPRA' && c.fechaEmision >= new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))
      .reduce((sum: number, c: ComprobanteItem) => sum + Number(c.total), 0);

    // Ratio de cobertura
    const totalIngresosProyectados = proyeccion.reduce((sum, p) => sum + p.ventasProyectadas, 0);
    const totalEgresosProyectados = proyeccion.reduce((sum, p) => sum + p.comprasProyectadas + p.igvAPagar + p.rentaEstimada, 0);
    const ratioCobertura = totalEgresosProyectados > 0 ? totalIngresosProyectados / totalEgresosProyectados : 0;

    // Alertas de liquidez
    const alertas: Array<{ tipo: 'warning' | 'danger' | 'info'; mensaje: string }> = [];

    if (ratioCobertura < 1) {
      alertas.push({
        tipo: 'danger',
        mensaje: `Flujo negativo proyectado: Los egresos superan a los ingresos en ${((1 - ratioCobertura) * 100).toFixed(1)}%`,
      });
    }

    const mesConFlujoNegativo = proyeccion.find(p => p.flujoAcumulado < 0);
    if (mesConFlujoNegativo) {
      alertas.push({
        tipo: 'warning',
        mensaje: `Alerta: Flujo acumulado negativo a partir de ${mesConFlujoNegativo.mes}`,
      });
    }

    if (promedioVentasMensual === 0) {
      alertas.push({
        tipo: 'info',
        mensaje: 'Sin datos históricos suficientes. La proyección se basa en estimaciones.',
      });
    }

    // Resumen
    const resumen = {
      promedioVentasMensual,
      promedioComprasMensual,
      igvPromedioPagar: igvAPagarProm,
      rentaPromedioMensual: promedioVentasMensual * 0.015,
      flujoNetoPromedio: promedioVentasMensual - promedioComprasMensual - igvAPagarProm - (promedioVentasMensual * 0.015),
      cuentasPorCobrar: ventasUltimos2Meses * 0.3, // Estimado 30% pendiente
      cuentasPorPagar: comprasUltimos2Meses * 0.4, // Estimado 40% pendiente
      ratioCobertura,
      totalIngresosProyectados,
      totalEgresosProyectados,
    };

    return NextResponse.json({
      proyeccion,
      resumen,
      alertas,
      mesesProyectados: meses,
    });
  } catch (error) {
    console.error('Error calculando flujo de caja:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
