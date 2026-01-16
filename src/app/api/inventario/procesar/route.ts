import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import prisma from '@/lib/prisma';

interface StockItem {
  almacen: number;
  almacen_desc: string;
  codi_bser_cat: string;
  descripcion: string;
  saldo_final: number;
  valor_total: number;
  unidad_medida_desc: string;
}

interface ConteoItem {
  CODIGO: string;
  DESCRIPCION: string;
  CANTIDAD: number;
  'UNID. MEDIDA': string;
  'CONTEO B': number;
}

function roundToDecimals(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

// POST /api/inventario/procesar - Procesar y guardar inventario
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const stockFile = formData.get('stockFile') as File | null;
    const conteoFile = formData.get('conteoFile') as File | null;
    const nombre = formData.get('nombre') as string || `Inventario ${new Date().toLocaleDateString('es-PE')}`;
    const descripcion = formData.get('descripcion') as string || null;
    const fechaInventario = formData.get('fechaInventario') as string || new Date().toISOString().split('T')[0];
    const companyId = formData.get('companyId') as string || null;

    if (!stockFile || !conteoFile) {
      return NextResponse.json(
        { error: 'Se requieren ambos archivos: Stock Economato y Primer/Segundo Conteo' },
        { status: 400 }
      );
    }

    // Leer archivo Stock Economato
    const stockBuffer = await stockFile.arrayBuffer();
    const stockWorkbook = XLSX.read(stockBuffer, { type: 'array' });
    const stockSheet = stockWorkbook.Sheets[stockWorkbook.SheetNames[0]];
    const stockData = XLSX.utils.sheet_to_json<StockItem>(stockSheet);

    // Leer archivo Primer y Segundo Conteo
    const conteoBuffer = await conteoFile.arrayBuffer();
    const conteoWorkbook = XLSX.read(conteoBuffer, { type: 'array' });
    const conteoSheet = conteoWorkbook.Sheets[conteoWorkbook.SheetNames[0]];
    const conteoData = XLSX.utils.sheet_to_json<ConteoItem>(conteoSheet);

    // Crear mapa de conteo por código
    const conteoMap = new Map<string, number>();
    for (const item of conteoData) {
      const codigo = item.CODIGO?.toString().trim();
      if (codigo) {
        conteoMap.set(codigo, item['CONTEO B'] || 0);
      }
    }

    // Procesar y cruzar datos
    const items: Array<{
      codigoBien: string;
      descripcion: string;
      unidadMedida: string;
      inventarioUnidad: number;
      inventarioImporte: number;
      kardexUnidad: number;
      costoUnitario: number;
      kardexImporte: number;
      sobrantesUnidad: number;
      sobrantesImporte: number;
      faltantesUnidad: number;
      faltantesImporte: number;
    }> = [];

    let codigoEconomato = '130';
    let almacenDesc = '';
    let totalInventarioImporte = 0;
    let totalKardexImporte = 0;
    let totalSobrantesImporte = 0;
    let totalFaltantesImporte = 0;

    for (const stockItem of stockData) {
      const codigo = stockItem.codi_bser_cat?.toString().trim();
      if (!codigo) continue;

      codigoEconomato = stockItem.almacen?.toString() || '130';
      almacenDesc = stockItem.almacen_desc?.toString().trim() || '';

      const kardexUnidad = stockItem.saldo_final || 0;
      const kardexImporte = stockItem.valor_total || 0;
      const costoUnitario = kardexUnidad > 0 ? kardexImporte / kardexUnidad : 0;

      // Obtener cantidad del inventario físico (conteo)
      const inventarioUnidad = conteoMap.get(codigo) || 0;
      const inventarioImporte = inventarioUnidad * costoUnitario;

      // Calcular diferencias
      const diferencia = inventarioUnidad - kardexUnidad;
      const sobrantesUnidad = diferencia > 0 ? diferencia : 0;
      const sobrantesImporte = sobrantesUnidad * costoUnitario;
      const faltantesUnidad = diferencia < 0 ? Math.abs(diferencia) : 0;
      const faltantesImporte = faltantesUnidad * costoUnitario;

      items.push({
        codigoBien: codigo,
        descripcion: stockItem.descripcion || '',
        unidadMedida: stockItem.unidad_medida_desc?.trim() || '',
        inventarioUnidad: roundToDecimals(inventarioUnidad, 4),
        inventarioImporte: roundToDecimals(inventarioImporte, 2),
        kardexUnidad: roundToDecimals(kardexUnidad, 4),
        costoUnitario: roundToDecimals(costoUnitario, 4),
        kardexImporte: roundToDecimals(kardexImporte, 2),
        sobrantesUnidad: roundToDecimals(sobrantesUnidad, 4),
        sobrantesImporte: roundToDecimals(sobrantesImporte, 2),
        faltantesUnidad: roundToDecimals(faltantesUnidad, 4),
        faltantesImporte: roundToDecimals(faltantesImporte, 2),
      });

      totalInventarioImporte += inventarioImporte;
      totalKardexImporte += kardexImporte;
      totalSobrantesImporte += sobrantesImporte;
      totalFaltantesImporte += faltantesImporte;
    }

    // Guardar en la base de datos
    const inventario = await prisma.inventario.create({
      data: {
        userId,
        companyId,
        nombre,
        descripcion,
        fechaInventario: new Date(fechaInventario),
        codigoEconomato,
        almacenDesc: almacenDesc || null,
        totalInventarioImporte: roundToDecimals(totalInventarioImporte, 2),
        totalKardexImporte: roundToDecimals(totalKardexImporte, 2),
        totalSobrantesImporte: roundToDecimals(totalSobrantesImporte, 2),
        totalFaltantesImporte: roundToDecimals(totalFaltantesImporte, 2),
        totalItems: items.length,
        items: {
          create: items,
        },
      },
      include: {
        items: true,
        company: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Inventario procesado y guardado correctamente',
      inventario: {
        id: inventario.id,
        nombre: inventario.nombre,
        fechaInventario: inventario.fechaInventario,
        totalItems: inventario.totalItems,
        totalInventarioImporte: inventario.totalInventarioImporte,
        totalKardexImporte: inventario.totalKardexImporte,
        totalSobrantesImporte: inventario.totalSobrantesImporte,
        totalFaltantesImporte: inventario.totalFaltantesImporte,
      },
    });
  } catch (error) {
    console.error('Error procesando inventario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar los archivos' },
      { status: 500 }
    );
  }
}

// GET /api/inventario/procesar - Listar inventarios
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const inventarios = await prisma.inventario.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        fechaInventario: true,
        codigoEconomato: true,
        totalInventarioImporte: true,
        totalKardexImporte: true,
        totalSobrantesImporte: true,
        totalFaltantesImporte: true,
        totalItems: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            razonSocial: true,
            ruc: true,
          },
        },
      },
    });

    return NextResponse.json(inventarios);
  } catch (error) {
    console.error('Error listando inventarios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
