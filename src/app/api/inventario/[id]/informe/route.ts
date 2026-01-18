import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

// GET /api/inventario/[id]/informe - Generar Informe HTML para imprimir como PDF
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id } = params;

    // Obtener opciones de la URL
    const { searchParams } = new URL(request.url);
    const includeLogo = searchParams.get('includeLogo') !== 'false';
    const includeFirma = searchParams.get('includeFirma') !== 'false';
    const includeHuella = searchParams.get('includeHuella') !== 'false';

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

    // Funciones auxiliares
    const formatCurrency = (value: number): string => {
      return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
      }).format(value);
    };

    const formatNumber = (value: number): string => {
      return new Intl.NumberFormat('es-PE').format(value);
    };

    const formatDate = (date: Date | string): string => {
      return new Date(date).toLocaleDateString('es-PE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    // Tipo para items del inventario
    type InventarioItem = {
      codigoBien: string;
      descripcion: string;
      unidadMedida: string;
      inventarioUnidad: unknown;
      inventarioImporte: unknown;
      kardexUnidad: unknown;
      costoUnitario: unknown;
      kardexImporte: unknown;
      sobrantesUnidad: unknown;
      sobrantesImporte: unknown;
      faltantesUnidad: unknown;
      faltantesImporte: unknown;
    };

    // Calcular estadísticas
    const totalItems = inventario.items.length;
    const itemsConSobrantes = inventario.items.filter((i: InventarioItem) => Number(i.sobrantesUnidad) > 0).length;
    const itemsConFaltantes = inventario.items.filter((i: InventarioItem) => Number(i.faltantesUnidad) > 0).length;
    const itemsSinDiferencia = totalItems - itemsConSobrantes - itemsConFaltantes;
    const sobrantes = inventario.items.filter((i: InventarioItem) => Number(i.sobrantesUnidad) > 0);
    const faltantes = inventario.items.filter((i: InventarioItem) => Number(i.faltantesUnidad) > 0);

    // Generar HTML
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe de Inventario - ${inventario.nombre}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #333;
    }

    /* Página vertical (portrait) */
    .page-portrait {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      margin: 0 auto;
      background: white;
      page-break-after: always;
    }

    /* Página horizontal (landscape) */
    .page-landscape {
      width: 297mm;
      min-height: 210mm;
      padding: 10mm;
      margin: 0 auto;
      background: white;
      page-break-after: always;
    }

    .page-landscape:last-child,
    .page-portrait:last-child {
      page-break-after: auto;
    }

    /* Estilos para impresión */
    @media print {
      body {
        margin: 0;
        padding: 0;
      }

      .page-portrait {
        width: 100%;
        min-height: auto;
        padding: 10mm;
        margin: 0;
        page-break-after: always;
      }

      .page-landscape {
        width: 100%;
        min-height: auto;
        padding: 8mm;
        margin: 0;
        page-break-after: always;
      }

      @page {
        size: A4;
        margin: 0;
      }

      .landscape-section {
        page: landscape;
      }

      @page landscape {
        size: A4 landscape;
      }

      .no-print {
        display: none !important;
      }
    }

    /* Carátula */
    .caratula {
      text-align: center;
      padding-top: 60mm;
    }

    .caratula h1 {
      font-size: 28px;
      color: #1f4e79;
      margin-bottom: 10px;
    }

    .caratula h2 {
      font-size: 18px;
      color: #1f4e79;
      margin-bottom: 5px;
    }

    .caratula .linea {
      border-top: 2px solid #1f4e79;
      width: 60%;
      margin: 20px auto;
    }

    .caratula .empresa {
      font-size: 20px;
      font-weight: bold;
      margin: 20px 0 5px;
    }

    .caratula .ruc {
      font-size: 14px;
      color: #666;
    }

    .caratula .detalle {
      margin-top: 30px;
      font-size: 14px;
    }

    .caratula .detalle p {
      margin: 8px 0;
    }

    /* Títulos de sección */
    .section-title {
      font-size: 16px;
      color: #1f4e79;
      text-align: center;
      margin-bottom: 15px;
      font-weight: bold;
    }

    .subsection-title {
      font-size: 12px;
      color: #1f4e79;
      margin: 10px 0 5px;
      font-weight: bold;
    }

    /* Tablas */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 9px;
    }

    th {
      background-color: #1f4e79;
      color: white;
      padding: 6px 4px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #1f4e79;
    }

    td {
      padding: 4px;
      border: 1px solid #ddd;
    }

    tr:nth-child(even) {
      background-color: #f5f5f5;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    /* Tabla de resumen */
    .tabla-resumen {
      width: 60%;
      margin: 0 auto;
      font-size: 11px;
    }

    .tabla-resumen th {
      text-align: center;
    }

    /* Tabla ANEXO 2 */
    .tabla-anexo {
      font-size: 8px;
    }

    .tabla-anexo th,
    .tabla-anexo td {
      padding: 3px 2px;
    }

    .tabla-anexo .col-codigo { width: 8%; }
    .tabla-anexo .col-descripcion { width: 25%; }
    .tabla-anexo .col-um { width: 4%; }
    .tabla-anexo .col-numero { width: 6%; }
    .tabla-anexo .col-importe { width: 8%; }

    /* Colores para sobrantes y faltantes */
    .sobrante {
      color: #228b22;
      font-weight: bold;
    }

    .faltante {
      color: #c00000;
      font-weight: bold;
    }

    /* Tabla sobrantes */
    .tabla-sobrantes th {
      background-color: #228b22;
    }

    .tabla-sobrantes .total-row {
      background-color: #228b22;
      color: white;
      font-weight: bold;
    }

    /* Tabla faltantes */
    .tabla-faltantes th {
      background-color: #c00000;
    }

    .tabla-faltantes .total-row {
      background-color: #c00000;
      color: white;
      font-weight: bold;
    }

    /* Gráficos */
    .grafico-container {
      margin: 20px auto;
      width: 80%;
    }

    .barra-container {
      margin: 10px 0;
      display: flex;
      align-items: center;
    }

    .barra {
      height: 25px;
      border-radius: 3px;
      margin-right: 10px;
    }

    .barra-verde {
      background-color: #228b22;
    }

    .barra-roja {
      background-color: #c00000;
    }

    .barra-azul {
      background-color: #4682b4;
    }

    /* Firmas */
    .firmas-container {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
    }

    .firma-box {
      width: 30%;
      text-align: center;
    }

    .firma-box .recuadro {
      border: 1px solid #999;
      height: 60px;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .firma-box .recuadro img {
      max-height: 50px;
      max-width: 90%;
    }

    .firma-box .label {
      font-size: 10px;
      font-weight: bold;
    }

    .firma-box .sublabel {
      font-size: 9px;
      color: #666;
    }

    /* Info columns */
    .info-columns {
      display: flex;
      justify-content: space-between;
      margin: 15px 0;
    }

    .info-column {
      width: 48%;
    }

    .info-column ul {
      list-style: none;
      padding-left: 10px;
    }

    .info-column li {
      margin: 3px 0;
      font-size: 10px;
    }

    .info-column li::before {
      content: "• ";
      color: #1f4e79;
    }

    /* Botón de impresión (solo en pantalla) */
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1f4e79;
      color: white;
      border: none;
      padding: 15px 30px;
      font-size: 16px;
      cursor: pointer;
      border-radius: 5px;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }

    .print-button:hover {
      background: #163a5c;
    }

    .print-instructions {
      position: fixed;
      top: 80px;
      right: 20px;
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 5px;
      max-width: 300px;
      font-size: 12px;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <!-- Botón de impresión -->
  <button class="print-button no-print" onclick="window.print()">
    📄 Guardar como PDF
  </button>
  <div class="print-instructions no-print">
    <strong>Instrucciones:</strong><br>
    1. Clic en "Guardar como PDF"<br>
    2. En destino seleccionar "Guardar como PDF"<br>
    3. Desmarcar "Encabezados y pies de página"<br>
    4. Clic en Guardar
  </div>

  <!-- PÁGINA 1: CARÁTULA -->
  <div class="page-portrait">
    <div class="caratula">
      <h1>INFORME FINAL</h1>
      <h2>INVENTARIO FÍSICO DE BIENES</h2>
      <h2>DE USO Y CONSUMO</h2>

      <div class="linea"></div>

      ${inventario.company ? `
        <div class="empresa">${inventario.company.razonSocial}</div>
        <div class="ruc">RUC: ${inventario.company.ruc}</div>
      ` : ''}

      <div class="linea"></div>

      <div class="detalle">
        <p><strong>Inventario:</strong> ${inventario.nombre}</p>
        <p><strong>Código Economato:</strong> ${inventario.codigoEconomato}</p>
        <p><strong>Fecha del Inventario:</strong> ${formatDate(inventario.fechaInventario)}</p>
      </div>
    </div>
  </div>

  <!-- PÁGINA 2: RESUMEN EJECUTIVO -->
  <div class="page-landscape landscape-section">
    <h2 class="section-title">RESUMEN EJECUTIVO</h2>

    <div class="info-columns">
      <div class="info-column">
        <h3 class="subsection-title">PARTICIPANTES</h3>
        <ul>
          <li>Contador Virtual - Sistema de Inventarios</li>
          <li>Equipo de Conteo Físico</li>
          <li>Almacén / Economato</li>
        </ul>
      </div>
      <div class="info-column">
        <h3 class="subsection-title">METODOLOGÍA</h3>
        <ul>
          <li>Conteo físico de bienes en economato</li>
          <li>Comparación con datos del Kárdex</li>
          <li>Identificación de diferencias</li>
          <li>Clasificación sobrantes/faltantes</li>
        </ul>
      </div>
    </div>

    <table class="tabla-resumen">
      <thead>
        <tr>
          <th>Concepto</th>
          <th class="text-right">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Total Ítems Inventariados</td>
          <td class="text-right">${formatNumber(totalItems)}</td>
        </tr>
        <tr>
          <td>Total Inventario Físico</td>
          <td class="text-right">${formatCurrency(Number(inventario.totalInventarioImporte))}</td>
        </tr>
        <tr>
          <td>Total Kárdex (Sistema)</td>
          <td class="text-right">${formatCurrency(Number(inventario.totalKardexImporte))}</td>
        </tr>
        <tr>
          <td>Diferencia Sobrantes</td>
          <td class="text-right sobrante">${formatCurrency(Number(inventario.totalSobrantesImporte))}</td>
        </tr>
        <tr>
          <td>Diferencia Faltantes</td>
          <td class="text-right faltante">${formatCurrency(Number(inventario.totalFaltantesImporte))}</td>
        </tr>
        <tr>
          <td><strong>Diferencia Neta</strong></td>
          <td class="text-right"><strong>${formatCurrency(Number(inventario.totalSobrantesImporte) - Number(inventario.totalFaltantesImporte))}</strong></td>
        </tr>
      </tbody>
    </table>

    <h3 class="subsection-title" style="text-align: center; margin-top: 20px;">Distribución de Diferencias</h3>
    <div class="grafico-container">
      <div class="barra-container">
        <div class="barra barra-verde" style="width: ${totalItems > 0 ? (itemsConSobrantes / totalItems) * 100 : 0}%;"></div>
        <span>Sobrantes: ${itemsConSobrantes} (${totalItems > 0 ? ((itemsConSobrantes / totalItems) * 100).toFixed(1) : 0}%)</span>
      </div>
      <div class="barra-container">
        <div class="barra barra-roja" style="width: ${totalItems > 0 ? (itemsConFaltantes / totalItems) * 100 : 0}%;"></div>
        <span>Faltantes: ${itemsConFaltantes} (${totalItems > 0 ? ((itemsConFaltantes / totalItems) * 100).toFixed(1) : 0}%)</span>
      </div>
      <div class="barra-container">
        <div class="barra barra-azul" style="width: ${totalItems > 0 ? (itemsSinDiferencia / totalItems) * 100 : 0}%;"></div>
        <span>Sin diferencia: ${itemsSinDiferencia} (${totalItems > 0 ? ((itemsSinDiferencia / totalItems) * 100).toFixed(1) : 0}%)</span>
      </div>
    </div>
  </div>

  <!-- PÁGINA 3+: ANEXO 2 - TABLA DE RESULTADOS -->
  <div class="page-landscape landscape-section">
    <h2 class="section-title">ANEXO "2" - REPORTE DE RESULTADOS DEL INVENTARIO</h2>
    <p style="margin-bottom: 10px;">
      ${inventario.company ? `<strong>Empresa:</strong> ${inventario.company.razonSocial} | <strong>RUC:</strong> ${inventario.company.ruc} | ` : ''}
      <strong>Fecha:</strong> ${formatDate(inventario.fechaInventario)} | <strong>Economato:</strong> ${inventario.codigoEconomato}
    </p>

    <table class="tabla-anexo">
      <thead>
        <tr>
          <th class="col-codigo">Código</th>
          <th class="col-descripcion">Descripción del Bien</th>
          <th class="col-um">UM</th>
          <th class="col-numero text-right">Inv.U</th>
          <th class="col-importe text-right">Inv.Importe</th>
          <th class="col-numero text-right">Kard.U</th>
          <th class="col-importe text-right">C.Unit</th>
          <th class="col-importe text-right">Kard.Imp</th>
          <th class="col-numero text-right">Sob.U</th>
          <th class="col-importe text-right">Sob.Imp</th>
          <th class="col-numero text-right">Falt.U</th>
          <th class="col-importe text-right">Falt.Imp</th>
        </tr>
      </thead>
      <tbody>
        ${inventario.items.map((item: InventarioItem) => `
          <tr>
            <td>${item.codigoBien}</td>
            <td>${item.descripcion}</td>
            <td class="text-center">${item.unidadMedida}</td>
            <td class="text-right">${formatNumber(Number(item.inventarioUnidad))}</td>
            <td class="text-right">${formatNumber(Number(item.inventarioImporte))}</td>
            <td class="text-right">${formatNumber(Number(item.kardexUnidad))}</td>
            <td class="text-right">${formatNumber(Number(item.costoUnitario))}</td>
            <td class="text-right">${formatNumber(Number(item.kardexImporte))}</td>
            <td class="text-right ${Number(item.sobrantesUnidad) > 0 ? 'sobrante' : ''}">${formatNumber(Number(item.sobrantesUnidad))}</td>
            <td class="text-right ${Number(item.sobrantesUnidad) > 0 ? 'sobrante' : ''}">${formatNumber(Number(item.sobrantesImporte))}</td>
            <td class="text-right ${Number(item.faltantesUnidad) > 0 ? 'faltante' : ''}">${formatNumber(Number(item.faltantesUnidad))}</td>
            <td class="text-right ${Number(item.faltantesUnidad) > 0 ? 'faltante' : ''}">${formatNumber(Number(item.faltantesImporte))}</td>
          </tr>
        `).join('')}
        <tr style="background-color: #1f4e79; color: white; font-weight: bold;">
          <td colspan="4">TOTALES</td>
          <td class="text-right">${formatCurrency(Number(inventario.totalInventarioImporte))}</td>
          <td colspan="2"></td>
          <td class="text-right">${formatCurrency(Number(inventario.totalKardexImporte))}</td>
          <td></td>
          <td class="text-right" style="color: #90ee90;">${formatCurrency(Number(inventario.totalSobrantesImporte))}</td>
          <td></td>
          <td class="text-right" style="color: #ffb6c1;">${formatCurrency(Number(inventario.totalFaltantesImporte))}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${sobrantes.length > 0 ? `
  <!-- PÁGINA: REPORTE DE SOBRANTES -->
  <div class="page-landscape landscape-section">
    <h2 class="section-title" style="color: #228b22;">REPORTE DE SOBRANTES</h2>

    <table class="tabla-sobrantes">
      <thead>
        <tr>
          <th style="width: 15%;">Código</th>
          <th style="width: 55%;">Descripción del Bien</th>
          <th style="width: 15%;" class="text-right">Unidades</th>
          <th style="width: 15%;" class="text-right">Importe S/</th>
        </tr>
      </thead>
      <tbody>
        ${sobrantes.map((item: InventarioItem) => `
          <tr>
            <td>${item.codigoBien}</td>
            <td>${item.descripcion}</td>
            <td class="text-right">${formatNumber(Number(item.sobrantesUnidad))}</td>
            <td class="text-right">${formatCurrency(Number(item.sobrantesImporte))}</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="2"><strong>TOTAL SOBRANTES</strong></td>
          <td class="text-right"><strong>${formatNumber(sobrantes.reduce((sum: number, i: InventarioItem) => sum + Number(i.sobrantesUnidad), 0))}</strong></td>
          <td class="text-right"><strong>${formatCurrency(Number(inventario.totalSobrantesImporte))}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  ${faltantes.length > 0 ? `
  <!-- PÁGINA: REPORTE DE FALTANTES -->
  <div class="page-landscape landscape-section">
    <h2 class="section-title" style="color: #c00000;">REPORTE DE FALTANTES</h2>

    <table class="tabla-faltantes">
      <thead>
        <tr>
          <th style="width: 15%;">Código</th>
          <th style="width: 55%;">Descripción del Bien</th>
          <th style="width: 15%;" class="text-right">Unidades</th>
          <th style="width: 15%;" class="text-right">Importe S/</th>
        </tr>
      </thead>
      <tbody>
        ${faltantes.map((item: InventarioItem) => `
          <tr>
            <td>${item.codigoBien}</td>
            <td>${item.descripcion}</td>
            <td class="text-right">${formatNumber(Number(item.faltantesUnidad))}</td>
            <td class="text-right">${formatCurrency(Number(item.faltantesImporte))}</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="2"><strong>TOTAL FALTANTES</strong></td>
          <td class="text-right"><strong>${formatNumber(faltantes.reduce((sum: number, i: InventarioItem) => sum + Number(i.faltantesUnidad), 0))}</strong></td>
          <td class="text-right"><strong>${formatCurrency(Number(inventario.totalFaltantesImporte))}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- PÁGINA FINAL: ACTA DE CONFORMIDAD -->
  <div class="page-portrait">
    <h2 class="section-title">ACTA DE CONFORMIDAD</h2>

    <p style="text-align: justify; margin: 20px 0; line-height: 1.6;">
      Por medio de la presente, se deja constancia de la conformidad con los resultados del inventario
      físico de bienes de uso y consumo realizado en fecha <strong>${formatDate(inventario.fechaInventario)}</strong>,
      correspondiente al almacén/economato con código <strong>${inventario.codigoEconomato}</strong>.
    </p>

    <h3 class="subsection-title">Resumen de Resultados:</h3>
    <ul style="margin: 15px 0 30px 20px;">
      <li>Total de ítems inventariados: <strong>${formatNumber(totalItems)}</strong></li>
      <li>Valor total inventario físico: <strong>${formatCurrency(Number(inventario.totalInventarioImporte))}</strong></li>
      <li>Valor total según Kárdex: <strong>${formatCurrency(Number(inventario.totalKardexImporte))}</strong></li>
      <li>Total sobrantes: <strong style="color: #228b22;">${formatCurrency(Number(inventario.totalSobrantesImporte))}</strong></li>
      <li>Total faltantes: <strong style="color: #c00000;">${formatCurrency(Number(inventario.totalFaltantesImporte))}</strong></li>
    </ul>

    <div class="firmas-container">
      <div class="firma-box">
        <div class="recuadro">
          ${includeFirma && inventario.company?.firmaDigitalBase64 ? `<img src="${inventario.company.firmaDigitalBase64}" alt="Firma">` : ''}
        </div>
        <div class="label">Responsable de Almacén</div>
        <div class="sublabel">Firma y Sello</div>
      </div>

      <div class="firma-box">
        <div class="recuadro"></div>
        <div class="label">Contador / Supervisor</div>
        <div class="sublabel">Firma y Sello</div>
      </div>

      <div class="firma-box">
        <div class="recuadro">
          ${includeHuella && inventario.company?.huellaDigitalBase64 ? `<img src="${inventario.company.huellaDigitalBase64}" alt="Huella">` : ''}
        </div>
        <div class="label">Huella Digital</div>
        <div class="sublabel">Responsable</div>
      </div>
    </div>

    <p style="margin-top: 40px;">
      <strong>Lugar y Fecha:</strong> _________________________, ${formatDate(new Date())}
    </p>
  </div>

</body>
</html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generando informe:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: String(error) },
      { status: 500 }
    );
  }
}
