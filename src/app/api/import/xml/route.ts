import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseInvoiceXML, extractXMLsFromZip, detectFileType } from '@/services/xml-parser.service';

// POST /api/import/xml - Importar archivo XML o ZIP
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
    // El tipo de operación ahora es opcional, se detecta automáticamente
    const tipoOperacionManual = formData.get('tipoOperacion') as string | null;

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

    // Leer archivo
    const buffer = await file.arrayBuffer();
    const fileType = detectFileType(buffer);

    let xmlContents: string[] = [];

    if (fileType === 'zip') {
      xmlContents = await extractXMLsFromZip(buffer);
    } else if (fileType === 'xml') {
      const text = new TextDecoder().decode(buffer);
      xmlContents = [text];
    } else {
      return NextResponse.json(
        { error: 'Tipo de archivo no soportado. Use archivos XML o ZIP.' },
        { status: 400 }
      );
    }

    if (xmlContents.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron archivos XML válidos' },
        { status: 400 }
      );
    }

    // Guardar historial de upload
    const uploadHistory = await prisma.invoiceUploadHistory.create({
      data: {
        companyId,
        fileName: file.name,
        fileType: fileType === 'zip' ? 'zip' : 'xml',
        fileSize: file.size,
        status: 'PROCESSING',
      },
    });

    // Procesar cada XML
    let imported = 0;
    let duplicated = 0;
    let errors = 0;
    let ventasDetectadas = 0;
    let comprasDetectadas = 0;
    const errorMessages: string[] = [];
    const comprobantesCreados: Array<{
      id: string;
      tipo: string;
      serie: string;
      numero: string;
      total: number;
      tercero: string;
    }> = [];

    for (const xmlContent of xmlContents) {
      try {
        const parsed = parseInvoiceXML(xmlContent);

        if (!parsed) {
          errors++;
          errorMessages.push('XML no válido o no reconocido');
          continue;
        }

        // DETECTAR AUTOMÁTICAMENTE VENTA O COMPRA
        // Si el RUC del emisor del XML coincide con el RUC de la empresa → es VENTA
        // Si no coincide → es COMPRA (la empresa recibió este comprobante)
        const esVenta = parsed.ruc === company.ruc;
        const tipoOperacion = tipoOperacionManual || (esVenta ? 'VENTA' : 'COMPRA');

        if (esVenta) {
          ventasDetectadas++;
        } else {
          comprasDetectadas++;
        }

        // Determinar quién es el "tercero" según el tipo de operación
        // Para VENTA: el tercero es el cliente (receptor del XML)
        // Para COMPRA: el tercero es el proveedor (emisor del XML)
        let terceroTipoDoc: string;
        let terceroNumeroDoc: string;
        let terceroRazonSocial: string;

        if (esVenta) {
          // Es una venta nuestra → tercero es el cliente
          terceroTipoDoc = parsed.tipoDocTercero;
          terceroNumeroDoc = parsed.numeroDocTercero;
          terceroRazonSocial = parsed.razonSocialTercero;
        } else {
          // Es una compra → tercero es el proveedor (emisor del XML)
          terceroTipoDoc = '6'; // RUC
          terceroNumeroDoc = parsed.ruc;
          terceroRazonSocial = parsed.razonSocialEmisor || 'Proveedor';
        }

        // Verificar duplicado
        const existing = await prisma.comprobante.findUnique({
          where: {
            companyId_tipoDocumento_serie_numero: {
              companyId,
              tipoDocumento: parsed.tipoDocumento,
              serie: parsed.serie,
              numero: parsed.numero,
            },
          },
        });

        if (existing) {
          duplicated++;
          continue;
        }

        // Determinar período
        const fechaEmision = new Date(parsed.fechaEmision);
        const periodo = `${fechaEmision.getFullYear()}${String(fechaEmision.getMonth() + 1).padStart(2, '0')}`;

        // Crear comprobante con items
        const nuevoComprobante = await prisma.comprobante.create({
          data: {
            companyId,
            tipo: tipoOperacion as any,
            tipoDocumento: parsed.tipoDocumento,
            serie: parsed.serie,
            numero: parsed.numero,
            fechaEmision: fechaEmision,
            fechaVencimiento: parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null,
            // Datos del EMISOR del XML (quien emitió el documento)
            rucEmisor: parsed.ruc,
            razonSocialEmisor: parsed.razonSocialEmisor,
            direccionEmisor: parsed.direccionEmisor || null,
            // Datos del RECEPTOR del XML (quien recibe el documento)
            tipoDocReceptor: parsed.tipoDocTercero,
            numeroDocReceptor: parsed.numeroDocTercero,
            razonSocialReceptor: parsed.razonSocialTercero,
            // Tercero (para cálculos tributarios de la empresa)
            tipoDocTercero: terceroTipoDoc,
            rucTercero: terceroNumeroDoc,
            razonSocialTercero: terceroRazonSocial,
            moneda: parsed.moneda,
            baseImponible: parsed.baseImponible,
            igv: parsed.igv,
            total: parsed.total,
            esGravada: parsed.igv > 0,
            afectaIgv: parsed.igv > 0,
            periodo,
            observaciones: parsed.observaciones || null,
            hashResumen: parsed.hashCpe || null,
            // Crear items del comprobante
            items: parsed.items && parsed.items.length > 0 ? {
              create: parsed.items.map((item, index) => ({
                numeroLinea: index + 1,
                cantidad: item.cantidad,
                unidadMedida: item.unidad,
                descripcion: item.descripcion,
                codigoProducto: item.codigoProducto || null,
                precioUnitario: item.precioUnitario,
                valorVenta: item.valorVenta,
                igv: item.igv,
                total: item.total,
              })),
            } : undefined,
          },
        });

        // Guardar info del comprobante creado
        comprobantesCreados.push({
          id: nuevoComprobante.id,
          tipo: tipoOperacion,
          serie: parsed.serie,
          numero: parsed.numero,
          total: parsed.total,
          tercero: terceroRazonSocial,
        });

        imported++;
      } catch (err) {
        console.error('Error procesando XML:', err);
        errors++;
        errorMessages.push(err instanceof Error ? err.message : 'Error desconocido');
      }
    }

    // Actualizar historial
    await prisma.invoiceUploadHistory.update({
      where: { id: uploadHistory.id },
      data: {
        status: errors === xmlContents.length ? 'FAILED' : 'COMPLETED',
        processedAt: new Date(),
        errorMessage: errorMessages.length > 0 ? errorMessages.slice(0, 3).join('; ') : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Importación completada',
      summary: {
        total: xmlContents.length,
        imported,
        duplicated,
        errors,
        fileType,
        ventasDetectadas,
        comprasDetectadas,
      },
      comprobantes: comprobantesCreados,
    });
  } catch (error) {
    console.error('Error importando XML/ZIP:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
