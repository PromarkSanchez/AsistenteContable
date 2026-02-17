import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyAccess, isAccessError, READ_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/terceros - Listar terceros con estadísticas de operaciones
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;

    const access = await requireCompanyAccess(request, companyId, READ_ROLES);
    if (isAccessError(access)) return access;

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // 'cliente' | 'proveedor' | null (todos)
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Obtener terceros únicos de los comprobantes de la empresa
    const whereClause: Record<string, unknown> = {
      companyId,
      estado: 'ACTIVO',
    };

    if (tipo === 'cliente') {
      whereClause.tipo = 'VENTA';
    } else if (tipo === 'proveedor') {
      whereClause.tipo = 'COMPRA';
    }

    // Agrupar comprobantes por tercero
    const comprobantesGrouped = await prisma.comprobante.groupBy({
      by: ['terceroDoc', 'terceroTipoDoc', 'terceroNombre', 'tipo'],
      where: whereClause,
      _sum: {
        total: true,
        igv: true,
      },
      _count: true,
      _max: {
        fechaEmision: true,
      },
      _min: {
        fechaEmision: true,
      },
    });

    // Estructurar los datos por tercero
    const tercerosMap = new Map<string, {
      doc: string;
      tipoDoc: string;
      nombre: string;
      totalVentas: number;
      totalCompras: number;
      igvVentas: number;
      igvCompras: number;
      cantidadVentas: number;
      cantidadCompras: number;
      ultimaOperacion: Date | null;
      primeraOperacion: Date | null;
      tipoRelacion: 'cliente' | 'proveedor' | 'ambos';
    }>();

    for (const grupo of comprobantesGrouped) {
      if (!grupo.terceroDoc) continue;

      const key = grupo.terceroDoc;
      const existing = tercerosMap.get(key) || {
        doc: grupo.terceroDoc,
        tipoDoc: grupo.terceroTipoDoc || '6',
        nombre: grupo.terceroNombre || 'Sin nombre',
        totalVentas: 0,
        totalCompras: 0,
        igvVentas: 0,
        igvCompras: 0,
        cantidadVentas: 0,
        cantidadCompras: 0,
        ultimaOperacion: null,
        primeraOperacion: null,
        tipoRelacion: 'cliente' as const,
      };

      const total = grupo._sum.total ? Number(grupo._sum.total) : 0;
      const igv = grupo._sum.igv ? Number(grupo._sum.igv) : 0;

      if (grupo.tipo === 'VENTA') {
        existing.totalVentas += total;
        existing.igvVentas += igv;
        existing.cantidadVentas += grupo._count;
      } else {
        existing.totalCompras += total;
        existing.igvCompras += igv;
        existing.cantidadCompras += grupo._count;
      }

      // Actualizar fechas
      if (grupo._max.fechaEmision) {
        if (!existing.ultimaOperacion || grupo._max.fechaEmision > existing.ultimaOperacion) {
          existing.ultimaOperacion = grupo._max.fechaEmision;
        }
      }
      if (grupo._min.fechaEmision) {
        if (!existing.primeraOperacion || grupo._min.fechaEmision < existing.primeraOperacion) {
          existing.primeraOperacion = grupo._min.fechaEmision;
        }
      }

      // Determinar tipo de relación
      if (existing.totalVentas > 0 && existing.totalCompras > 0) {
        existing.tipoRelacion = 'ambos';
      } else if (existing.totalCompras > 0) {
        existing.tipoRelacion = 'proveedor';
      } else {
        existing.tipoRelacion = 'cliente';
      }

      tercerosMap.set(key, existing);
    }

    // Convertir a array y aplicar filtros
    let terceros = Array.from(tercerosMap.values());

    // Filtrar por búsqueda
    if (search) {
      const searchLower = search.toLowerCase();
      terceros = terceros.filter(t =>
        t.nombre.toLowerCase().includes(searchLower) ||
        t.doc.includes(search)
      );
    }

    // Filtrar por tipo si se especificó
    if (tipo === 'cliente') {
      terceros = terceros.filter(t => t.tipoRelacion === 'cliente' || t.tipoRelacion === 'ambos');
    } else if (tipo === 'proveedor') {
      terceros = terceros.filter(t => t.tipoRelacion === 'proveedor' || t.tipoRelacion === 'ambos');
    }

    // Ordenar por total de operaciones (descendente)
    terceros.sort((a, b) => {
      const totalA = a.totalVentas + a.totalCompras;
      const totalB = b.totalVentas + b.totalCompras;
      return totalB - totalA;
    });

    const total = terceros.length;

    // Aplicar paginación
    const paginatedTerceros = terceros.slice(skip, skip + limit);

    // Calcular estadísticas generales
    const stats = {
      totalTerceros: total,
      totalClientes: terceros.filter(t => t.tipoRelacion === 'cliente' || t.tipoRelacion === 'ambos').length,
      totalProveedores: terceros.filter(t => t.tipoRelacion === 'proveedor' || t.tipoRelacion === 'ambos').length,
      totalVentas: terceros.reduce((sum, t) => sum + t.totalVentas, 0),
      totalCompras: terceros.reduce((sum, t) => sum + t.totalCompras, 0),
    };

    // Obtener información adicional de terceros registrados
    const docs = paginatedTerceros.map(t => t.doc);
    const tercerosRegistrados = await prisma.tercero.findMany({
      where: { numeroDocumento: { in: docs } },
      select: {
        numeroDocumento: true,
        direccion: true,
        estado: true,
        condicion: true,
        esAgenteRetencion: true,
        esBuenContribuyente: true,
      },
    });

    const tercerosInfoMap = new Map(
      tercerosRegistrados.map((t: typeof tercerosRegistrados[number]) => [t.numeroDocumento, t])
    );

    // Enriquecer datos con información del registro
    const enrichedTerceros = paginatedTerceros.map(t => ({
      ...t,
      info: tercerosInfoMap.get(t.doc) || null,
    }));

    return NextResponse.json({
      data: enrichedTerceros,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    console.error('Error listando terceros:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
