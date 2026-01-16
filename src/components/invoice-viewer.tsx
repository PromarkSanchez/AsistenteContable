'use client';

import { useRef, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Loader2, Download } from 'lucide-react';
import type { Comprobante, Company } from '@/types';
import { TIPO_DOCUMENTO_NOMBRES, formatDate } from '@/lib/utils';
import { comprobantesApi } from '@/lib/api-client';
import QRCode from 'qrcode';

interface InvoiceViewerProps {
  comprobante: Comprobante;
  company: Company;
  onClose: () => void;
}

// Convertir número a letras
function numberToWords(num: number): string {
  const units = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (num === 0) return 'CERO';
  if (num === 100) return 'CIEN';

  let result = '';
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  if (intPart >= 1000) {
    const thousands = Math.floor(intPart / 1000);
    if (thousands === 1) {
      result += 'MIL ';
    } else {
      result += numberToWords(thousands) + ' MIL ';
    }
  }

  const remainder = intPart % 1000;
  if (remainder >= 100) {
    const h = Math.floor(remainder / 100);
    result += hundreds[h] + ' ';
  }

  const tensUnit = remainder % 100;
  if (tensUnit >= 10 && tensUnit < 20) {
    result += teens[tensUnit - 10];
  } else {
    const t = Math.floor(tensUnit / 10);
    const u = tensUnit % 10;
    if (t > 0) {
      result += tens[t];
      if (u > 0) {
        result += t === 2 ? 'I' + units[u] : ' Y ' + units[u];
      }
    } else if (u > 0) {
      result += units[u];
    }
  }

  result = result.trim();
  result += ` Y ${decPart.toString().padStart(2, '0')}/100 SOLES`;

  return result;
}

export function InvoiceViewer({ comprobante: initialComprobante, company, onClose }: InvoiceViewerProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [comprobante, setComprobante] = useState(initialComprobante);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Generar datos del QR según formato SUNAT
  const generarDatosQR = (comp: Comprobante): string => {
    const ruc = comp.rucEmisor || company.ruc;
    const tipoDoc = comp.tipoDocumento;
    const serie = comp.serie;
    const numero = comp.numero;
    const igv = Number(comp.igv).toFixed(2);
    const total = Number(comp.total).toFixed(2);
    // Formatear fecha como DD/MM/YYYY para SUNAT
    const fecha = formatDate(comp.fechaEmision).split('-').reverse().join('/');
    const tipoDocCliente = comp.tipoDocReceptor || comp.tipoDocTercero || '6';
    const numDocCliente = comp.numeroDocReceptor || comp.rucTercero || '';
    const hash = comp.hashResumen || '';

    return `${ruc}|${tipoDoc}|${serie}|${numero}|${igv}|${total}|${fecha}|${tipoDocCliente}|${numDocCliente}|${hash}`;
  };

  // Cargar comprobante completo con items
  useEffect(() => {
    const loadFullComprobante = async () => {
      if (!initialComprobante.items || initialComprobante.items.length === 0) {
        setLoading(true);
        try {
          const fullComprobante = await comprobantesApi.get(company.id, initialComprobante.id);
          setComprobante(fullComprobante);
        } catch (err) {
          console.error('Error cargando comprobante:', err);
        } finally {
          setLoading(false);
        }
      }
    };
    loadFullComprobante();
  }, [initialComprobante, company.id]);

  // Generar QR cuando el comprobante esté cargado
  useEffect(() => {
    const generateQR = async () => {
      try {
        const qrData = generarDatosQR(comprobante);
        const dataUrl = await QRCode.toDataURL(qrData, {
          width: 150,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#1a5276',
            light: '#ffffff'
          }
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('Error generando QR:', err);
      }
    };
    generateQR();
  }, [comprobante, company.ruc]);

  const tipoDoc = TIPO_DOCUMENTO_NOMBRES[comprobante.tipoDocumento] || 'COMPROBANTE';
  const tipoDocNombre = tipoDoc === 'FACTURA' ? 'FACTURA ELECTRÓNICA' :
                        tipoDoc === 'BOLETA' ? 'BOLETA DE VENTA ELECTRÓNICA' :
                        tipoDoc === 'NOTA_CREDITO' ? 'NOTA DE CRÉDITO ELECTRÓNICA' :
                        tipoDoc === 'NOTA_DEBITO' ? 'NOTA DE DÉBITO ELECTRÓNICA' :
                        'COMPROBANTE ELECTRÓNICO';

  // Usar formatDate que extrae la fecha sin conversión de timezone
  const fechaStr = formatDate(comprobante.fechaEmision);

  const monedaCode = comprobante.moneda || 'PEN';

  // Datos del emisor - usar los datos del XML si están disponibles
  const emisorRuc = comprobante.rucEmisor || company.ruc;
  const emisorRazonSocial = comprobante.razonSocialEmisor || company.razonSocial;
  const emisorDireccion = comprobante.direccionEmisor || company.direccionFiscal;

  // El logo viene de la configuración de la empresa
  const logoBase64 = company.logoBase64;

  // Datos del receptor/cliente
  const receptorTipoDoc = comprobante.tipoDocReceptor || comprobante.tipoDocTercero;
  const receptorNumeroDoc = comprobante.numeroDocReceptor || comprobante.rucTercero;
  const receptorRazonSocial = comprobante.razonSocialReceptor || comprobante.razonSocialTercero;

  // Función para comprimir imagen a tamaño óptimo para PDF
  const compressImageForPDF = async (base64: string, maxWidth = 400, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Redimensionar si es más grande que maxWidth
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64);
          return;
        }

        // IMPORTANTE: Pintar fondo blanco primero (PNG transparente -> JPEG necesita fondo)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Dibujar imagen sobre fondo blanco
        ctx.drawImage(img, 0, 0, width, height);
        // JPEG con calidad especificada
        const compressed = canvas.toDataURL('image/jpeg', quality);
        console.log(`Logo comprimido: ${(base64.length / 1024).toFixed(0)}KB -> ${(compressed.length / 1024).toFixed(0)}KB (${maxWidth}px, ${quality * 100}%)`);
        resolve(compressed);
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import('jspdf');
      // Crear PDF con compresión habilitada
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Configurar fuente
      doc.setFont('helvetica');

      // ============ MARCA DE AGUA (fondo) ============
      // Agregar logo como marca de agua con baja opacidad
      if (logoBase64) {
        try {
          // Comprimir logo para marca de agua: 200px, calidad 60%
          const watermarkLogo = await compressImageForPDF(logoBase64, 200, 0.6);

          // Crear estado gráfico con transparencia
          const gState = new (doc as any).GState({ opacity: 0.08 });
          doc.setGState(gState);

          // Centrar marca de agua en la página
          const wmWidth = 80; // mm
          const wmHeight = 60; // mm
          const wmX = (pageWidth - wmWidth) / 2;
          const wmY = (pageHeight - wmHeight) / 2;

          doc.addImage(watermarkLogo, 'JPEG', wmX, wmY, wmWidth, wmHeight);

          // Restaurar opacidad normal
          const normalState = new (doc as any).GState({ opacity: 1 });
          doc.setGState(normalState);
        } catch (e) {
          console.error('Error agregando marca de agua:', e);
        }
      }

      // ============ HEADER ============
      const headerHeight = 35;

      // Logo en header - buena calidad: 400px, calidad 85%
      if (logoBase64) {
        try {
          const compressedLogo = await compressImageForPDF(logoBase64, 400, 0.85);
          doc.addImage(compressedLogo, 'JPEG', margin, y, 25, 20);
        } catch (e) {
          console.error('Error agregando logo:', e);
        }
      }

      // Datos del emisor (al lado del logo)
      const emisorX = logoBase64 ? margin + 27 : margin;
      const emisorMaxWidth = 85;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      const razonSocialLines = doc.splitTextToSize(emisorRazonSocial, emisorMaxWidth);
      doc.text(razonSocialLines, emisorX, y + 6);

      const razonSocialHeight = razonSocialLines.length * 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`RUC: ${emisorRuc}`, emisorX, y + 6 + razonSocialHeight + 2);

      if (emisorDireccion) {
        const direccionLines = doc.splitTextToSize(emisorDireccion, emisorMaxWidth);
        doc.text(direccionLines, emisorX, y + 6 + razonSocialHeight + 8);
      }

      // Cuadro de documento (derecha)
      const boxWidth = 58;
      const boxHeight = 32;
      const boxX = pageWidth - margin - boxWidth;

      doc.setDrawColor(26, 82, 118);
      doc.setLineWidth(0.6);
      doc.rect(boxX, y, boxWidth, boxHeight);

      // Tipo de documento
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 82, 118);
      const tipoLines = doc.splitTextToSize(tipoDocNombre, boxWidth - 8);
      doc.text(tipoLines, boxX + boxWidth / 2, y + 8, { align: 'center' });

      // Número de documento
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text(`${comprobante.serie}-${comprobante.numero}`, boxX + boxWidth / 2, y + 18, { align: 'center' });

      // Fecha
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Fecha: ${fechaStr}`, boxX + boxWidth / 2, y + 26, { align: 'center' });

      y += headerHeight + 10;

      // ============ DATOS DEL CLIENTE ============
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('DATOS DEL CLIENTE', margin, y);

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 10;

      // RUC/DNI
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      const docLabel = receptorTipoDoc === '6' ? 'RUC:' : receptorTipoDoc === '1' ? 'DNI:' : 'Documento:';
      doc.setFont('helvetica', 'bold');
      doc.text(docLabel, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.text(receptorNumeroDoc || '-', margin + 30, y);
      y += 6;

      // Razón Social
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'bold');
      doc.text('Razón Social:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      const receptorLines = doc.splitTextToSize(receptorRazonSocial || '-', contentWidth - 35);
      doc.text(receptorLines, margin + 30, y);
      y += receptorLines.length * 5 + 8;

      // ============ DETALLE ============
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('DETALLE', margin, y);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 8;

      // Tabla de items
      const items = comprobante.items && comprobante.items.length > 0 ? comprobante.items : [{
        numeroLinea: 1,
        descripcion: comprobante.tipo === 'VENTA' ? 'Venta de bienes o servicios' : 'Compra de bienes o servicios',
        unidadMedida: 'NIU',
        cantidad: 1,
        precioUnitario: comprobante.baseImponible,
        valorVenta: comprobante.baseImponible,
      }];

      // Definir columnas proporcionales al ancho disponible (contentWidth = 170mm aprox)
      const tableWidth = contentWidth;
      const colN = 10;        // N°
      const colUM = 15;       // U.M.
      const colCant = 20;     // Cantidad
      const colPU = 25;       // Precio Unitario
      const colValor = 25;    // Valor
      const colDesc = tableWidth - colN - colUM - colCant - colPU - colValor; // El resto para descripción (~75)

      // Posiciones X de cada columna (inicio de cada columna)
      const xN = margin;
      const xDesc = xN + colN;
      const xUM = xDesc + colDesc;
      const xCant = xUM + colUM;
      const xPU = xCant + colCant;
      const xValor = xPU + colPU;
      const tableEnd = margin + tableWidth; // Fin de la tabla = pageWidth - margin

      // Encabezados de tabla (azul)
      doc.setFillColor(26, 82, 118);
      doc.rect(margin, y - 3, tableWidth, 8, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('N°', xN + 3, y + 2);
      doc.text('Descripción', xDesc + 2, y + 2);
      doc.text('U.M.', xUM + 2, y + 2);
      doc.text('Cant.', xCant + colCant / 2, y + 2, { align: 'center' });
      doc.text('P. Unit.', xPU + colPU / 2, y + 2, { align: 'center' });
      doc.text('Valor', xValor + colValor / 2, y + 2, { align: 'center' });
      y += 10;

      // Filas de items
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);

      for (const item of items) {
        const desc = String(item.descripcion || '');
        const descLines = doc.splitTextToSize(desc, colDesc - 4);
        const rowHeight = Math.max(6, descLines.length * 4 + 2);

        // Verificar si necesitamos nueva página
        if (y + rowHeight > pageHeight - 60) {
          doc.addPage();
          y = margin;
        }

        doc.setFontSize(8);
        doc.text(String(item.numeroLinea || 1), xN + 3, y);
        doc.text(descLines, xDesc + 2, y);
        doc.text(String(item.unidadMedida || 'NIU'), xUM + 2, y);
        doc.text(Number(item.cantidad).toFixed(2), xCant + colCant - 3, y, { align: 'right' });
        doc.text(Number(item.precioUnitario).toFixed(2), xPU + colPU - 3, y, { align: 'right' });
        doc.text(Number(item.valorVenta).toFixed(2), tableEnd - 3, y, { align: 'right' });

        y += rowHeight;
      }

      // Línea separadora después de items
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, tableEnd, y);
      y += 8;

      // ============ TOTALES ============
      // Alinear totales con las últimas 2 columnas de la tabla (P.Unit + Valor)
      const totalsLabelX = xPU;
      const totalsValueX = tableEnd - 3;
      const totalsWidth = colPU + colValor;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      // Op. Gravadas
      doc.setTextColor(60, 60, 60);
      doc.text(`Op. Gravadas (${monedaCode}):`, totalsLabelX, y);
      doc.setTextColor(30, 30, 30);
      doc.text(Number(comprobante.baseImponible).toFixed(2), totalsValueX, y, { align: 'right' });
      y += 6;

      // IGV
      doc.setTextColor(60, 60, 60);
      doc.text(`IGV 18% (${monedaCode}):`, totalsLabelX, y);
      doc.setTextColor(30, 30, 30);
      doc.text(Number(comprobante.igv).toFixed(2), totalsValueX, y, { align: 'right' });
      y += 8;

      // Total destacado - alineado con las columnas de la tabla
      doc.setFillColor(26, 82, 118);
      doc.rect(totalsLabelX - 2, y - 4, totalsWidth + 2, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`TOTAL (${monedaCode}):`, totalsLabelX, y + 2);
      doc.text(Number(comprobante.total).toFixed(2), totalsValueX, y + 2, { align: 'right' });
      y += 16;

      // ============ SON ============
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setFillColor(248, 248, 248);
      const sonText = `SON: ${numberToWords(Number(comprobante.total))}`;
      const sonLines = doc.splitTextToSize(sonText, contentWidth - 10);
      const sonHeight = sonLines.length * 4 + 6;
      doc.roundedRect(margin, y - 4, contentWidth, sonHeight, 2, 2, 'F');
      doc.text(sonLines, margin + 5, y + 1);
      y += sonHeight + 8;

      // ============ OBSERVACIONES ============
      if (comprobante.observaciones) {
        // Verificar espacio
        if (y > pageHeight - 50) {
          doc.addPage();
          y = margin;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(120, 80, 0);
        doc.text('Observaciones:', margin, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(80, 60, 0);
        doc.setFillColor(255, 251, 235);
        const obsLines = doc.splitTextToSize(comprobante.observaciones, contentWidth - 10);
        const obsHeight = obsLines.length * 4 + 6;
        doc.roundedRect(margin, y - 3, contentWidth, obsHeight, 2, 2, 'F');
        doc.text(obsLines, margin + 5, y + 2);
        y += obsHeight + 8;
      }

      // ============ QR Y HASH (compacto) ============
      // Generar QR para el PDF
      if (qrDataUrl) {
        try {
          doc.addImage(qrDataUrl, 'PNG', margin, y - 2, 22, 22);
        } catch (e) {
          console.error('Error agregando QR al PDF:', e);
        }
      }

      // Hash y URL al lado del QR
      const qrTextX = margin + 25;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(130, 130, 130);

      if (comprobante.hashResumen) {
        doc.text(`Hash: ${comprobante.hashResumen}`, qrTextX, y + 4);
      }
      doc.text('Consultar en: ', qrTextX, y + 10);
      doc.setTextColor(30, 64, 175);
      doc.textWithLink('e-consulta.sunat.gob.pe', qrTextX + 22, y + 10, { url: 'https://e-consulta.sunat.gob.pe/ol-ti-itconsvalicpe/ConsValiCpe.htm' });
      doc.setTextColor(130, 130, 130);

      y += 25;

      // ============ FOOTER ============
      // Verificar espacio
      if (y > pageHeight - 25) {
        doc.addPage();
        y = pageHeight - 20;
      } else {
        y = Math.max(y + 5, pageHeight - 25);
      }

      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text('Representación impresa del Comprobante de Pago Electrónico', pageWidth / 2, y, { align: 'center' });
      doc.text('Autorizado mediante Resolución de Superintendencia', pageWidth / 2, y + 4, { align: 'center' });

      // Diagnóstico: ver tamaño del PDF antes de guardar
      const pdfBlob = doc.output('blob');
      console.log(`=== DIAGNÓSTICO PDF ===`);
      console.log(`Tamaño del PDF: ${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Logo base64 tamaño: ${logoBase64 ? (logoBase64.length / 1024).toFixed(0) + 'KB' : 'Sin logo'}`);

      // Descargar
      doc.save(`${comprobante.serie}-${comprobante.numero}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-0">
        {/* Toolbar - mejorado para modo oscuro */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border-b border-slate-300 dark:border-slate-700 p-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Vista Previa del Comprobante
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={downloading || loading}
              className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Descargar PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <CardContent className="p-6 overflow-y-auto flex-1 bg-slate-200 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-slate-600 dark:text-slate-400">Cargando detalles...</span>
            </div>
          ) : (
            /* Contenido imprimible - siempre fondo blanco */
            <div ref={printRef} className="invoice-container bg-white text-gray-900 p-8 rounded-lg shadow-lg mx-auto" style={{ maxWidth: '800px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                {/* Left: Logo + Company Info (EMISOR) */}
                <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
                  {logoBase64 && (
                    <img
                      src={logoBase64}
                      alt={emisorRazonSocial}
                      style={{ maxHeight: '70px', maxWidth: '100px', objectFit: 'contain', marginRight: '15px' }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '3px', color: '#1f2937' }}>
                      {emisorRazonSocial}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>
                      RUC: {emisorRuc}
                    </div>
                    {emisorDireccion && (
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px', maxWidth: '300px' }}>
                        {emisorDireccion}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Invoice Box */}
                <div style={{
                  border: '2px solid #1a5276',
                  padding: '15px 20px',
                  textAlign: 'center',
                  minWidth: '200px',
                  borderRadius: '4px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1a5276', marginBottom: '8px' }}>
                    {tipoDocNombre}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#1f2937' }}>
                    {comprobante.serie}-{comprobante.numero}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>
                    Fecha de Emisión: {fechaStr}
                  </div>
                </div>
              </div>

              {/* Datos del Cliente/Receptor */}
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px', marginBottom: '10px' }}>
                DATOS DEL CLIENTE
              </div>
              <div style={{ display: 'flex', marginBottom: '4px', fontSize: '11px' }}>
                <div style={{ fontWeight: 'bold', width: '120px', color: '#6b7280' }}>
                  {receptorTipoDoc === '6' ? 'RUC:' : receptorTipoDoc === '1' ? 'DNI:' : 'Documento:'}
                </div>
                <div style={{ flex: 1, color: '#1f2937' }}>{receptorNumeroDoc || '-'}</div>
              </div>
              <div style={{ display: 'flex', marginBottom: '4px', fontSize: '11px' }}>
                <div style={{ fontWeight: 'bold', width: '120px', color: '#6b7280' }}>Razón Social:</div>
                <div style={{ flex: 1, color: '#1f2937' }}>{receptorRazonSocial || '-'}</div>
              </div>

              {/* Detail Section */}
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px', marginBottom: '10px', marginTop: '15px' }}>
                DETALLE
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#1a5276', border: '1px solid #1a5276', padding: '8px 6px', fontSize: '10px', fontWeight: 'bold', width: '30px', color: 'white' }}>N°</th>
                    <th style={{ background: '#1a5276', border: '1px solid #1a5276', padding: '8px 6px', fontSize: '10px', fontWeight: 'bold', textAlign: 'left', color: 'white' }}>Descripción</th>
                    <th style={{ background: '#1a5276', border: '1px solid #1a5276', padding: '8px 6px', fontSize: '10px', fontWeight: 'bold', width: '50px', color: 'white' }}>U.M.</th>
                    <th style={{ background: '#1a5276', border: '1px solid #1a5276', padding: '8px 6px', fontSize: '10px', fontWeight: 'bold', width: '60px', color: 'white' }}>Cant.</th>
                    <th style={{ background: '#1a5276', border: '1px solid #1a5276', padding: '8px 6px', fontSize: '10px', fontWeight: 'bold', width: '80px', color: 'white' }}>P. Unit.</th>
                    <th style={{ background: '#1a5276', border: '1px solid #1a5276', padding: '8px 6px', fontSize: '10px', fontWeight: 'bold', width: '80px', color: 'white' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {comprobante.items && comprobante.items.length > 0 ? (
                    comprobante.items.map((item, index) => (
                      <tr key={item.id || index}>
                        <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'top', color: '#1f2937' }}>
                          {item.numeroLinea || index + 1}
                        </td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'left', verticalAlign: 'top', color: '#1f2937' }}>
                          {item.descripcion}
                          {item.codigoProducto && (
                            <div style={{ fontSize: '9px', color: '#9ca3af' }}>Cód: {item.codigoProducto}</div>
                          )}
                        </td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'top', color: '#1f2937' }}>
                          {item.unidadMedida || 'NIU'}
                        </td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'top', color: '#1f2937' }}>
                          {Number(item.cantidad).toFixed(2)}
                        </td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'right', verticalAlign: 'top', color: '#1f2937' }}>
                          {Number(item.precioUnitario).toFixed(2)}
                        </td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'right', verticalAlign: 'top', color: '#1f2937' }}>
                          {Number(item.valorVenta).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'top', color: '#1f2937' }}>1</td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'left', verticalAlign: 'top', color: '#1f2937' }}>
                        {comprobante.tipo === 'VENTA' ? 'Venta de bienes o servicios' : 'Compra de bienes o servicios'}
                      </td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'top', color: '#1f2937' }}>NIU</td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'top', color: '#1f2937' }}>1.00</td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'right', verticalAlign: 'top', color: '#1f2937' }}>
                        {Number(comprobante.baseImponible).toFixed(2)}
                      </td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 6px', fontSize: '10px', textAlign: 'right', verticalAlign: 'top', color: '#1f2937' }}>
                        {Number(comprobante.baseImponible).toFixed(2)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <div style={{ width: '280px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px' }}>
                    <div style={{ textAlign: 'right', flex: 1, paddingRight: '20px', color: '#6b7280' }}>Op. Gravadas ({monedaCode}):</div>
                    <div style={{ width: '100px', textAlign: 'right', color: '#1f2937' }}>{Number(comprobante.baseImponible).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px' }}>
                    <div style={{ textAlign: 'right', flex: 1, paddingRight: '20px', color: '#6b7280' }}>IGV 18% ({monedaCode}):</div>
                    <div style={{ width: '100px', textAlign: 'right', color: '#1f2937' }}>{Number(comprobante.igv).toFixed(2)}</div>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    background: '#1a5276',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    padding: '8px 10px',
                    marginTop: '5px',
                    borderRadius: '4px'
                  }}>
                    <div style={{ textAlign: 'right', flex: 1, paddingRight: '20px' }}>TOTAL ({monedaCode}):</div>
                    <div style={{ width: '100px', textAlign: 'right' }}>{Number(comprobante.total).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* SON */}
              <div style={{ fontSize: '10px', marginBottom: '10px', padding: '10px', background: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                <strong style={{ fontStyle: 'italic', color: '#374151' }}>SON:</strong> <span style={{ color: '#1f2937' }}>{numberToWords(Number(comprobante.total))}</span>
              </div>

              {/* Observaciones */}
              {comprobante.observaciones && (
                <div style={{ fontSize: '10px', marginBottom: '10px', padding: '10px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#92400e' }}>Observaciones:</div>
                  <div style={{ whiteSpace: 'pre-wrap', color: '#78350f' }}>{comprobante.observaciones}</div>
                </div>
              )}

              {/* QR y Hash */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '10px'
              }}>
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="QR SUNAT"
                    style={{ width: '60px', height: '60px' }}
                  />
                )}
                <div style={{ fontSize: '8px', color: '#9ca3af' }}>
                  {comprobante.hashResumen && (
                    <div><strong>Hash:</strong> {comprobante.hashResumen}</div>
                  )}
                  <div style={{ marginTop: '2px' }}>
                    Consultar en: <a href="https://e-consulta.sunat.gob.pe/ol-ti-itconsvalicpe/ConsValiCpe.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1e40af', textDecoration: 'underline' }}>e-consulta.sunat.gob.pe</a>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center', fontSize: '9px', color: '#9ca3af', marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '15px' }}>
                <p>Representación impresa del Comprobante de Pago Electrónico</p>
                <p>Autorizado mediante Resolución de Superintendencia N° 000-2024/SUNAT</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
