// Servicio de generación de PDF para comprobantes electrónicos
// Usa jsPDF para generar PDFs en el servidor

import { jsPDF } from 'jspdf';

export interface DatosComprobantePDF {
  // Datos de la empresa
  empresa: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    direccion: string;
    logoBase64?: string;
  };
  // Datos del comprobante
  tipoDocumento: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  // Datos del cliente
  cliente: {
    tipoDocumento: string;
    numeroDocumento: string;
    razonSocial: string;
    direccion?: string;
  };
  // Items
  items: Array<{
    descripcion: string;
    cantidad: number;
    unidadMedida: string;
    precioUnitario: number;
    valorVenta: number;
  }>;
  // Totales
  moneda: string;
  subtotal: number;
  igv: number;
  total: number;
  // QR y hash
  hashResumen?: string;
  datosQR?: string;
}

const TIPO_DOC_NOMBRES: Record<string, string> = {
  '01': 'FACTURA ELECTRÓNICA',
  '03': 'BOLETA DE VENTA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO ELECTRÓNICA',
  '08': 'NOTA DE DÉBITO ELECTRÓNICA',
};

const TIPO_DOC_CLIENTE: Record<string, string> = {
  '6': 'RUC',
  '1': 'DNI',
  '4': 'C.E.',
  '7': 'PASAPORTE',
  '0': 'DOC.',
};

/**
 * Genera un PDF del comprobante electrónico
 */
export function generarComprobantePDF(datos: DatosComprobantePDF): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  // === ENCABEZADO ===

  // Logo (si existe)
  if (datos.empresa.logoBase64) {
    try {
      // El logo viene como data:image/...;base64,...
      const logoData = datos.empresa.logoBase64;
      doc.addImage(logoData, 'PNG', margin, y, 30, 20);
    } catch (e) {
      // Si falla el logo, continuamos sin él
    }
  }

  // Datos de la empresa
  const empresaX = datos.empresa.logoBase64 ? margin + 35 : margin;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(datos.empresa.razonSocial, empresaX, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  y += 5;
  if (datos.empresa.nombreComercial) {
    doc.text(datos.empresa.nombreComercial, empresaX, y);
    y += 4;
  }
  doc.text(`RUC: ${datos.empresa.ruc}`, empresaX, y);
  y += 4;
  doc.text(datos.empresa.direccion, empresaX, y, { maxWidth: 70 });

  // Cuadro del tipo de documento
  const boxX = pageWidth - margin - 60;
  const boxY = 15;
  const boxWidth = 60;
  const boxHeight = 30;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(boxX, boxY, boxWidth, boxHeight);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const tipoDocNombre = TIPO_DOC_NOMBRES[datos.tipoDocumento] || 'COMPROBANTE';
  doc.text(tipoDocNombre, boxX + boxWidth / 2, boxY + 10, { align: 'center' });

  doc.setFontSize(11);
  const numeroCompleto = `${datos.serie}-${datos.numero.padStart(8, '0')}`;
  doc.text(numeroCompleto, boxX + boxWidth / 2, boxY + 20, { align: 'center' });

  y = 50;

  // Línea separadora
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // === DATOS DEL CLIENTE ===
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL CLIENTE', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  const tipoDocClienteNombre = TIPO_DOC_CLIENTE[datos.cliente.tipoDocumento] || 'DOC.';
  doc.text(`${tipoDocClienteNombre}: ${datos.cliente.numeroDocumento}`, margin, y);
  doc.text(`Fecha de Emisión: ${datos.fechaEmision}`, pageWidth - margin - 50, y);
  y += 5;
  doc.text(`Razón Social: ${datos.cliente.razonSocial}`, margin, y);
  y += 5;
  if (datos.cliente.direccion) {
    doc.text(`Dirección: ${datos.cliente.direccion}`, margin, y, { maxWidth: pageWidth - margin * 2 });
    y += 5;
  }
  doc.text(`Moneda: ${datos.moneda === 'PEN' ? 'SOLES' : datos.moneda}`, margin, y);

  y += 8;

  // === TABLA DE ITEMS ===
  const colWidths = {
    item: 10,
    descripcion: 75,
    cantidad: 20,
    um: 15,
    pUnit: 25,
    total: 25,
  };

  // Encabezados de tabla
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  let colX = margin + 2;
  doc.text('ITEM', colX, y + 5);
  colX += colWidths.item;
  doc.text('DESCRIPCIÓN', colX, y + 5);
  colX += colWidths.descripcion;
  doc.text('CANT.', colX, y + 5);
  colX += colWidths.cantidad;
  doc.text('U.M.', colX, y + 5);
  colX += colWidths.um;
  doc.text('P. UNIT.', colX, y + 5);
  colX += colWidths.pUnit;
  doc.text('TOTAL', colX, y + 5);

  y += 10;

  // Filas de items
  doc.setFont('helvetica', 'normal');
  datos.items.forEach((item, index) => {
    colX = margin + 2;
    doc.text(String(index + 1), colX, y + 4);
    colX += colWidths.item;
    doc.text(item.descripcion.substring(0, 50), colX, y + 4);
    colX += colWidths.descripcion;
    doc.text(item.cantidad.toString(), colX, y + 4);
    colX += colWidths.cantidad;
    doc.text(item.unidadMedida, colX, y + 4);
    colX += colWidths.um;
    doc.text(item.precioUnitario.toFixed(2), colX, y + 4);
    colX += colWidths.pUnit;
    doc.text(item.valorVenta.toFixed(2), colX, y + 4);

    y += 7;

    // Nueva página si es necesario
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  });

  // Línea bajo la tabla
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // === TOTALES ===
  const totalesX = pageWidth - margin - 60;
  doc.setFontSize(9);

  doc.setFont('helvetica', 'normal');
  doc.text('SUBTOTAL:', totalesX, y);
  doc.text(`S/ ${datos.subtotal.toFixed(2)}`, totalesX + 40, y, { align: 'right' });
  y += 5;

  doc.text('IGV (18%):', totalesX, y);
  doc.text(`S/ ${datos.igv.toFixed(2)}`, totalesX + 40, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', totalesX, y);
  doc.text(`S/ ${datos.total.toFixed(2)}`, totalesX + 40, y, { align: 'right' });

  y += 15;

  // === PIE DE PÁGINA ===
  // Hash de resumen
  if (datos.hashResumen) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Hash: ${datos.hashResumen}`, margin, y);
  }

  y += 10;

  // Mensaje de representación impresa
  doc.setFontSize(7);
  doc.text(
    'Representación impresa de la ' + (TIPO_DOC_NOMBRES[datos.tipoDocumento] || 'Comprobante'),
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 4;
  doc.text(
    'Autorizado mediante Resolución de Intendencia N° 034-005-0000854/SUNAT',
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  // Retornar como Buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

/**
 * Genera PDF en formato Base64
 */
export function generarComprobantePDFBase64(datos: DatosComprobantePDF): string {
  const buffer = generarComprobantePDF(datos);
  return buffer.toString('base64');
}

export default {
  generarComprobantePDF,
  generarComprobantePDFBase64,
};
