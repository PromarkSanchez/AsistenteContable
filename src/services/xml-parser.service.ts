import { XMLParser } from 'fast-xml-parser';

export interface ParsedInvoiceXML {
  ruc: string;
  razonSocialEmisor: string;  // Razón social del emisor
  direccionEmisor?: string;   // Dirección del emisor
  tipoDocumento: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  moneda: string;
  tipoDocTercero: string;
  numeroDocTercero: string;
  razonSocialTercero: string;
  direccionTercero?: string;
  baseImponible: number;
  igv: number;
  total: number;
  // Campos adicionales
  observaciones?: string;     // Notas/observaciones del documento
  hashCpe?: string;           // Hash de la firma digital
  items: Array<{
    cantidad: number;
    unidad: string;
    descripcion: string;
    codigoProducto?: string;
    precioUnitario: number;
    valorVenta: number;
    igv: number;
    total: number;
  }>;
}

const TIPO_DOC_MAP: Record<string, string> = {
  '01': 'FACTURA',
  '03': 'BOLETA',
  '07': 'NOTA_CREDITO',
  '08': 'NOTA_DEBITO',
};

/**
 * Parsea un XML de comprobante electrónico SUNAT (UBL 2.1)
 */
export function parseInvoiceXML(xmlContent: string): ParsedInvoiceXML | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: true,
    });

    const parsed = parser.parse(xmlContent);

    // El documento puede ser Invoice, CreditNote o DebitNote
    const doc = parsed.Invoice || parsed.CreditNote || parsed.DebitNote;
    if (!doc) {
      console.error('Tipo de documento no reconocido');
      return null;
    }

    // Determinar tipo de documento
    let tipoDocumento = '01'; // Default factura
    if (parsed.CreditNote) tipoDocumento = '07';
    else if (parsed.DebitNote) tipoDocumento = '08';
    else if (doc.InvoiceTypeCode) {
      const code = typeof doc.InvoiceTypeCode === 'object'
        ? doc.InvoiceTypeCode['#text']
        : doc.InvoiceTypeCode;
      // Asegurar que sea string y padear con 0 si es necesario
      tipoDocumento = String(code || '01').padStart(2, '0');
    }

    // Extraer ID (serie-numero)
    const id = String(doc.ID || '');
    const idParts = id.split('-');
    const serie = String(idParts[0] || '');
    const numero = String(idParts[1] || '');

    // Extraer RUC y razón social del emisor
    const supplier = doc.AccountingSupplierParty?.Party;
    const ruc = String(supplier?.PartyIdentification?.ID?.['#text'] ||
                supplier?.PartyIdentification?.ID || '');
    const razonSocialEmisor = String(supplier?.PartyLegalEntity?.RegistrationName ||
                              supplier?.PartyName?.Name || '');

    // Dirección del emisor
    const supplierAddress = supplier?.PartyLegalEntity?.RegistrationAddress ||
                           supplier?.PostalAddress;
    const direccionEmisor = supplierAddress?.AddressLine?.Line
      ? String(supplierAddress.AddressLine.Line)
      : supplierAddress?.StreetName
        ? String(supplierAddress.StreetName)
        : undefined;

    // Extraer observaciones/notas
    const notes = doc.Note;
    let observaciones: string | undefined;
    if (notes) {
      if (Array.isArray(notes)) {
        observaciones = notes.map((n: any) => String(n?.['#text'] || n || '')).filter(Boolean).join('\n');
      } else {
        observaciones = String(notes?.['#text'] || notes || '');
      }
    }

    // Extraer Hash CPE de la firma digital
    let hashCpe: string | undefined;
    try {
      const extensions = doc.UBLExtensions?.UBLExtension;
      if (extensions) {
        const extArray = Array.isArray(extensions) ? extensions : [extensions];
        for (const ext of extArray) {
          const signature = ext?.ExtensionContent?.Signature;
          if (signature) {
            const signedInfo = signature?.SignedInfo;
            const reference = signedInfo?.Reference;
            if (reference) {
              const refArray = Array.isArray(reference) ? reference : [reference];
              for (const ref of refArray) {
                const uri = ref?.['@_URI'] || '';
                // El hash del documento principal tiene URI vacío o con #
                if (uri === '' || uri.startsWith('#')) {
                  hashCpe = String(ref?.DigestValue || '');
                  break;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignorar errores al extraer hash
    }

    // Extraer datos del receptor
    const customer = doc.AccountingCustomerParty?.Party;
    const customerIdNode = customer?.PartyIdentification?.ID;
    const tipoDocTercero = String(customerIdNode?.['@_schemeID'] || '6');
    const numeroDocTercero = String(customerIdNode?.['#text'] || customerIdNode || '');
    const razonSocialTercero = String(customer?.PartyLegalEntity?.RegistrationName ||
                               customer?.PartyName?.Name || '');

    // Extraer fechas
    const fechaEmision = String(doc.IssueDate || '');
    const fechaVencimiento = doc.DueDate || doc.PaymentTerms?.PaymentDueDate
      ? String(doc.DueDate || doc.PaymentTerms?.PaymentDueDate)
      : undefined;

    // Extraer moneda
    const moneda = String(doc.DocumentCurrencyCode?.['#text'] ||
                   doc.DocumentCurrencyCode || 'PEN');

    // Extraer totales
    const legalMonetaryTotal = doc.LegalMonetaryTotal || {};
    const total = parseFloat(legalMonetaryTotal.PayableAmount?.['#text'] ||
                            legalMonetaryTotal.PayableAmount || 0);

    // Extraer IGV
    const taxTotals = Array.isArray(doc.TaxTotal) ? doc.TaxTotal : [doc.TaxTotal];
    let igv = 0;
    let baseImponible = 0;

    for (const taxTotal of taxTotals) {
      if (!taxTotal) continue;
      const taxAmount = parseFloat(taxTotal.TaxAmount?.['#text'] || taxTotal.TaxAmount || 0);
      const taxSubtotal = taxTotal.TaxSubtotal;

      if (taxSubtotal) {
        const taxScheme = taxSubtotal.TaxCategory?.TaxScheme;
        const taxId = taxScheme?.ID?.['#text'] || taxScheme?.ID || '';

        // 1000 = IGV, 2000 = ISC, 9999 = Otros
        if (taxId === '1000' || taxScheme?.Name === 'IGV') {
          igv = taxAmount;
          baseImponible = parseFloat(taxSubtotal.TaxableAmount?.['#text'] ||
                                     taxSubtotal.TaxableAmount || 0);
        }
      }
    }

    // Si no encontramos base imponible, calcularla
    if (baseImponible === 0 && total > 0) {
      baseImponible = total - igv;
    }

    // Extraer items
    const invoiceLines = doc.InvoiceLine || doc.CreditNoteLine || doc.DebitNoteLine || [];
    const linesArray = Array.isArray(invoiceLines) ? invoiceLines : [invoiceLines];

    const items = linesArray.map((line: any) => {
      const cantidad = parseFloat(line.InvoicedQuantity?.['#text'] ||
                                  line.CreditedQuantity?.['#text'] ||
                                  line.DebitedQuantity?.['#text'] ||
                                  line.InvoicedQuantity || 1);
      const unidad = String(line.InvoicedQuantity?.['@_unitCode'] ||
                     line.CreditedQuantity?.['@_unitCode'] ||
                     line.DebitedQuantity?.['@_unitCode'] || 'NIU');
      const descripcion = String(line.Item?.Description || '');

      // Código de producto (puede estar en diferentes lugares)
      const codigoProducto = String(
        line.Item?.SellersItemIdentification?.ID?.['#text'] ||
        line.Item?.SellersItemIdentification?.ID ||
        line.Item?.StandardItemIdentification?.ID?.['#text'] ||
        line.Item?.StandardItemIdentification?.ID ||
        ''
      ) || undefined;

      const precioUnitario = parseFloat(line.Price?.PriceAmount?.['#text'] ||
                                        line.Price?.PriceAmount || 0);
      const valorVenta = parseFloat(line.LineExtensionAmount?.['#text'] ||
                                    line.LineExtensionAmount || 0);

      // IGV del item
      const lineTaxTotal = line.TaxTotal;
      const itemIgv = parseFloat(lineTaxTotal?.TaxAmount?.['#text'] ||
                                 lineTaxTotal?.TaxAmount || 0);

      return {
        cantidad,
        unidad,
        descripcion,
        codigoProducto,
        precioUnitario,
        valorVenta,
        igv: itemIgv,
        total: valorVenta + itemIgv,
      };
    }).filter((item: any) => item.descripcion);

    return {
      ruc,
      razonSocialEmisor,
      direccionEmisor,
      tipoDocumento,
      serie: serie || '',
      numero: numero || '',
      fechaEmision,
      fechaVencimiento,
      moneda,
      tipoDocTercero,
      numeroDocTercero,
      razonSocialTercero,
      baseImponible,
      igv,
      total,
      observaciones,
      hashCpe,
      items,
    };
  } catch (error) {
    console.error('Error parseando XML:', error);
    return null;
  }
}

/**
 * Extrae XMLs de un archivo ZIP
 */
export async function extractXMLsFromZip(zipBuffer: ArrayBuffer): Promise<string[]> {
  // Importar JSZip dinámicamente
  const JSZip = (await import('jszip')).default;

  const zip = await JSZip.loadAsync(zipBuffer);
  const xmlContents: string[] = [];

  for (const [filename, file] of Object.entries(zip.files)) {
    if (filename.toLowerCase().endsWith('.xml') && !file.dir) {
      try {
        const content = await file.async('string');
        // Verificar que es un XML de factura válido
        if (content.includes('Invoice') || content.includes('CreditNote') || content.includes('DebitNote')) {
          xmlContents.push(content);
        }
      } catch (err) {
        console.error(`Error leyendo ${filename}:`, err);
      }
    }
  }

  return xmlContents;
}

/**
 * Detecta si el contenido es un ZIP o XML
 */
export function detectFileType(buffer: ArrayBuffer): 'zip' | 'xml' | 'unknown' {
  const arr = new Uint8Array(buffer);

  // ZIP magic number: PK (0x50 0x4B)
  if (arr[0] === 0x50 && arr[1] === 0x4B) {
    return 'zip';
  }

  // XML typically starts with <?xml or <
  const text = new TextDecoder().decode(arr.slice(0, 100));
  if (text.trim().startsWith('<?xml') || text.trim().startsWith('<')) {
    return 'xml';
  }

  return 'unknown';
}
