import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseSIREFile, detectSIREFileType } from '@/services/sire-parser.service';

// POST /api/sire/import - Importar archivo SIRE
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
    const file = formData.get('file') as File | null;
    const companyId = formData.get('companyId') as string | null;
    const periodo = formData.get('periodo') as string | null;

    if (!file || !companyId) {
      return NextResponse.json(
        { error: 'Archivo y companyId requeridos' },
        { status: 400 }
      );
    }

    // Verificar empresa
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Leer contenido del archivo
    const content = await file.text();

    // Detectar tipo de archivo
    const fileType = detectSIREFileType(content);

    // Parsear archivo
    const parsedComprobantes = parseSIREFile(content, periodo || '');

    if (parsedComprobantes.length === 0) {
      return NextResponse.json(
        {
          error: 'No se encontraron comprobantes válidos en el archivo',
          fileType,
        },
        { status: 400 }
      );
    }

    // Guardar historial de upload
    const uploadHistory = await prisma.invoiceUploadHistory.create({
      data: {
        companyId,
        fileName: file.name,
        fileType: fileType === 'ventas' ? 'sire-ventas' : fileType === 'compras' ? 'sire-compras' : 'sire',
        fileSize: file.size,
        status: 'PROCESSING',
      },
    });

    // Importar comprobantes
    let imported = 0;
    let duplicated = 0;
    let errors = 0;

    for (const comp of parsedComprobantes) {
      try {
        // Verificar duplicado
        const existing = await prisma.comprobante.findUnique({
          where: {
            companyId_tipoDocumento_serie_numero: {
              companyId,
              tipoDocumento: comp.tipoDocumento,
              serie: comp.serie,
              numero: comp.numero,
            },
          },
        });

        if (existing) {
          duplicated++;
          continue;
        }

        // Crear comprobante
        await prisma.comprobante.create({
          data: {
            companyId,
            tipo: comp.tipoOperacion,
            tipoDocumento: comp.tipoDocumento,
            serie: comp.serie,
            numero: comp.numero,
            fechaEmision: new Date(comp.fechaEmision),
            fechaVencimiento: comp.fechaVencimiento ? new Date(comp.fechaVencimiento) : null,
            tipoDocTercero: comp.tipoDocTercero || '6',
            rucTercero: comp.rucTercero,
            razonSocialTercero: comp.razonSocialTercero,
            moneda: comp.moneda,
            tipoCambio: comp.tipoCambio,
            baseImponible: comp.baseImponible,
            igv: comp.igv,
            total: comp.total,
            esGravada: comp.igv > 0,
            afectaIgv: comp.igv > 0,
            periodo: comp.periodo,
          },
        });

        imported++;
      } catch (err) {
        console.error('Error importando comprobante:', err);
        errors++;
      }
    }

    // Actualizar historial de upload
    await prisma.invoiceUploadHistory.update({
      where: { id: uploadHistory.id },
      data: {
        status: errors === parsedComprobantes.length ? 'FAILED' : 'COMPLETED',
        processedAt: new Date(),
        errorMessage: errors > 0 ? `${errors} errores de importación` : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Importación completada`,
      summary: {
        total: parsedComprobantes.length,
        imported,
        duplicated,
        errors,
        fileType,
      },
    });
  } catch (error) {
    console.error('Error importando SIRE:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
