import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

// GET /api/inventario/[id]/excel - Generar y descargar Excel ANEXO 2 con formato
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id } = params;

    // Obtener opciones de logo de la URL
    const { searchParams } = new URL(request.url);
    const includeLogo = searchParams.get('includeLogo') !== 'false';

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener inventario con items y empresa
    const inventario = await prisma.inventario.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        items: {
          orderBy: { codigoBien: 'asc' },
        },
        company: true,
      },
    });

    if (!inventario) {
      return NextResponse.json(
        { error: 'Inventario no encontrado' },
        { status: 404 }
      );
    }

    // Crear workbook con exceljs
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Contador Virtual';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('ANEXO 2', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { key: 'codigoEconomato', width: 35 },
      { key: 'codigoBien', width: 18 },
      { key: 'descripcion', width: 45 },
      { key: 'unidadMedida', width: 12 },
      { key: 'invUnidad', width: 10 },
      { key: 'invImporte', width: 12 },
      { key: 'kardexUnidad', width: 10 },
      { key: 'costoUnitario', width: 12 },
      { key: 'kardexImporte', width: 12 },
      { key: 'sobrUnidad', width: 10 },
      { key: 'sobrImporte', width: 12 },
      { key: 'faltUnidad', width: 10 },
      { key: 'faltImporte', width: 12 },
    ];

    let currentRow = 1;

    // Si hay logo de empresa y se debe incluir
    if (includeLogo && inventario.company?.logoBase64) {
      try {
        const logoData = inventario.company.logoBase64;
        const imageId = workbook.addImage({
          base64: logoData,
          extension: 'png',
        });

        // Logo en esquina superior izquierda
        worksheet.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 200, height: 100 },
        });
        currentRow = 7; // Espacio para el logo
      } catch (e) {
        console.error('Error agregando logo:', e);
      }
    }

    // Título ANEXO "2"
    worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = 'ANEXO "2"';
    titleCell.font = { bold: true, size: 16, color: { argb: '1F4E79' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 25;
    currentRow += 2;

    // Subtítulo
    worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
    const subtitleCell = worksheet.getCell(`A${currentRow}`);
    subtitleCell.value = 'REPORTE DE RESULTADOS DEL INVENTARIO DE BIENES DE USO Y CONSUMO';
    subtitleCell.font = { bold: true, size: 12 };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 2;

    // Información del inventario
    if (inventario.company) {
      worksheet.getCell(`A${currentRow}`).value = `Empresa: ${inventario.company.razonSocial}`;
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = `RUC: ${inventario.company.ruc}`;
      currentRow++;
    }

    worksheet.getCell(`A${currentRow}`).value = `Nombre: ${inventario.nombre}`;
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = `Fecha de Inventario: ${new Date(inventario.fechaInventario).toLocaleDateString('es-PE')}`;
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = `Código de Economato: ${inventario.codigoEconomato}`;
    currentRow += 2;

    // Cabecera principal - 3 filas de encabezado
    const headerRow1 = currentRow;

    // Columnas fijas (A-D) - combinadas en las 3 filas
    worksheet.mergeCells(`A${headerRow1}:A${headerRow1 + 2}`);
    worksheet.mergeCells(`B${headerRow1}:B${headerRow1 + 2}`);
    worksheet.mergeCells(`C${headerRow1}:C${headerRow1 + 2}`);
    worksheet.mergeCells(`D${headerRow1}:D${headerRow1 + 2}`);

    // INVENTARIO (E-F) - combinado en filas 1-2, centrado sobre Unidad e Importe
    worksheet.mergeCells(`E${headerRow1}:F${headerRow1 + 1}`);

    // KÁRDEX (G-I) - combinado en filas 1-2, centrado sobre Unidad, Costo Unit. e Importe
    worksheet.mergeCells(`G${headerRow1}:I${headerRow1 + 1}`);

    // DIFERENCIAS (J-M) - solo fila 1
    worksheet.mergeCells(`J${headerRow1}:M${headerRow1}`);

    // Sobrantes y Faltantes - fila 2
    worksheet.mergeCells(`J${headerRow1 + 1}:K${headerRow1 + 1}`);
    worksheet.mergeCells(`L${headerRow1 + 1}:M${headerRow1 + 1}`);

    // Estilos de cabecera
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFF' }, size: 10 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E79' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } },
      },
    };

    const subHeaderStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFF' }, size: 9 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E75B6' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } },
      },
    };

    // Fila 1 de cabecera - títulos principales
    worksheet.getCell(`A${headerRow1}`).value = 'Economato';
    worksheet.getCell(`B${headerRow1}`).value = 'Código de Bien';
    worksheet.getCell(`C${headerRow1}`).value = 'Descripción del Bien';
    worksheet.getCell(`D${headerRow1}`).value = 'Unid. Medida';
    worksheet.getCell(`E${headerRow1}`).value = 'INVENTARIO';
    worksheet.getCell(`G${headerRow1}`).value = 'KÁRDEX';
    worksheet.getCell(`J${headerRow1}`).value = 'DIFERENCIAS';

    // Aplicar estilos a las celdas de cabecera principal
    ['A', 'B', 'C', 'D', 'E', 'G', 'J'].forEach(col => {
      const cell = worksheet.getCell(`${col}${headerRow1}`);
      Object.assign(cell, headerStyle);
    });

    // Aplicar estilos a columnas F, H, I en fila 1 (parte de celdas combinadas)
    ['F', 'H', 'I', 'K', 'L', 'M'].forEach(col => {
      const cell = worksheet.getCell(`${col}${headerRow1}`);
      Object.assign(cell, headerStyle);
    });

    // Aplicar estilos a fila 2 para INVENTARIO y KÁRDEX (celdas combinadas)
    ['E', 'F', 'G', 'H', 'I'].forEach(col => {
      const cell = worksheet.getCell(`${col}${headerRow1 + 1}`);
      Object.assign(cell, headerStyle);
    });

    // Fila 2 de cabecera (Sobrantes/Faltantes)
    worksheet.getCell(`J${headerRow1 + 1}`).value = 'Sobrantes';
    worksheet.getCell(`J${headerRow1 + 1}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '70AD47' } };
    worksheet.getCell(`L${headerRow1 + 1}`).value = 'Faltantes';
    worksheet.getCell(`L${headerRow1 + 1}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C00000' } };

    ['J', 'L'].forEach(col => {
      const cell = worksheet.getCell(`${col}${headerRow1 + 1}`);
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } },
      };
    });

    // Fila 3 de cabecera (Unidad/Importe)
    worksheet.getCell(`E${headerRow1 + 2}`).value = 'Unidad';
    worksheet.getCell(`F${headerRow1 + 2}`).value = 'Importe';
    worksheet.getCell(`G${headerRow1 + 2}`).value = 'Unidad';
    worksheet.getCell(`H${headerRow1 + 2}`).value = 'Costo Unit.';
    worksheet.getCell(`I${headerRow1 + 2}`).value = 'Importe';
    worksheet.getCell(`J${headerRow1 + 2}`).value = 'Unidad';
    worksheet.getCell(`K${headerRow1 + 2}`).value = 'Importe';
    worksheet.getCell(`L${headerRow1 + 2}`).value = 'Unidad';
    worksheet.getCell(`M${headerRow1 + 2}`).value = 'Importe';

    ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].forEach(col => {
      Object.assign(worksheet.getCell(`${col}${headerRow1 + 2}`), subHeaderStyle);
    });

    // Altura de filas de cabecera
    worksheet.getRow(headerRow1).height = 22;
    worksheet.getRow(headerRow1 + 1).height = 20;
    worksheet.getRow(headerRow1 + 2).height = 20;

    currentRow = headerRow1 + 3;

    // Estilos para datos
    const dataStyle: Partial<ExcelJS.Style> = {
      border: {
        top: { style: 'thin', color: { argb: 'D0D0D0' } },
        left: { style: 'thin', color: { argb: 'D0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'D0D0D0' } },
        right: { style: 'thin', color: { argb: 'D0D0D0' } },
      },
      font: { size: 9 },
    };

    const currencyFormat = '#,##0.00';
    const numberFormat = '#,##0';

    // Agregar datos
    for (let i = 0; i < inventario.items.length; i++) {
      const item = inventario.items[i];
      const row = worksheet.getRow(currentRow);

      // Alternar colores de fila
      const bgColor = i % 2 === 0 ? 'FFFFFF' : 'F2F2F2';

      row.getCell(1).value = inventario.almacenDesc
        ? `${inventario.codigoEconomato} - ${inventario.almacenDesc}`
        : inventario.codigoEconomato;
      row.getCell(2).value = item.codigoBien;
      row.getCell(3).value = item.descripcion;
      row.getCell(4).value = item.unidadMedida;
      row.getCell(5).value = Number(item.inventarioUnidad);
      row.getCell(6).value = Number(item.inventarioImporte);
      row.getCell(7).value = Number(item.kardexUnidad);
      row.getCell(8).value = Number(item.costoUnitario);
      row.getCell(9).value = Number(item.kardexImporte);
      row.getCell(10).value = Number(item.sobrantesUnidad);
      row.getCell(11).value = Number(item.sobrantesImporte);
      row.getCell(12).value = Number(item.faltantesUnidad);
      row.getCell(13).value = Number(item.faltantesImporte);

      // Aplicar estilos a cada celda
      for (let col = 1; col <= 13; col++) {
        const cell = row.getCell(col);
        Object.assign(cell, dataStyle);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

        // Formato de números
        if ([5, 7, 10, 12].includes(col)) {
          cell.numFmt = numberFormat;
          cell.alignment = { horizontal: 'right' };
        } else if ([6, 8, 9, 11, 13].includes(col)) {
          cell.numFmt = currencyFormat;
          cell.alignment = { horizontal: 'right' };
        }

        // Color para sobrantes (verde)
        if (col === 10 || col === 11) {
          if (Number(item.sobrantesUnidad) > 0) {
            cell.font = { size: 9, color: { argb: '006400' }, bold: true };
          }
        }

        // Color para faltantes (rojo)
        if (col === 12 || col === 13) {
          if (Number(item.faltantesUnidad) > 0) {
            cell.font = { size: 9, color: { argb: 'C00000' }, bold: true };
          }
        }
      }

      currentRow++;
    }

    // Fila de totales
    currentRow++;
    const totalsRow = worksheet.getRow(currentRow);
    const totalsStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 10 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9E1F2' } },
      border: {
        top: { style: 'medium', color: { argb: '1F4E79' } },
        left: { style: 'thin', color: { argb: '1F4E79' } },
        bottom: { style: 'medium', color: { argb: '1F4E79' } },
        right: { style: 'thin', color: { argb: '1F4E79' } },
      },
    };

    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    totalsRow.getCell(1).value = 'TOTALES';
    totalsRow.getCell(6).value = Number(inventario.totalInventarioImporte);
    totalsRow.getCell(9).value = Number(inventario.totalKardexImporte);
    totalsRow.getCell(11).value = Number(inventario.totalSobrantesImporte);
    totalsRow.getCell(13).value = Number(inventario.totalFaltantesImporte);

    for (let col = 1; col <= 13; col++) {
      const cell = totalsRow.getCell(col);
      Object.assign(cell, totalsStyle);
      if ([6, 9, 11, 13].includes(col)) {
        cell.numFmt = currencyFormat;
        cell.alignment = { horizontal: 'right' };
      }
      if (col === 1) {
        cell.alignment = { horizontal: 'center' };
      }
    }

    // Color especial para total sobrantes (verde)
    if (Number(inventario.totalSobrantesImporte) > 0) {
      totalsRow.getCell(11).font = { bold: true, size: 10, color: { argb: '006400' } };
    }

    // Color especial para total faltantes (rojo)
    if (Number(inventario.totalFaltantesImporte) > 0) {
      totalsRow.getCell(13).font = { bold: true, size: 10, color: { argb: 'C00000' } };
    }

    totalsRow.height = 22;

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Crear nombre del archivo
    const fecha = new Date(inventario.fechaInventario).toISOString().split('T')[0];
    const nombreArchivo = `ANEXO_2_${fecha}_${inventario.codigoEconomato}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      },
    });
  } catch (error) {
    console.error('Error generando Excel:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: String(error) },
      { status: 500 }
    );
  }
}
