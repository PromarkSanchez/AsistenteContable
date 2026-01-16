// Generador de XML UBL 2.1 para comprobantes electrónicos SUNAT
// Basado en las especificaciones de SUNAT para facturas y boletas

export interface DatosEmisor {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccion: string;
  ubigeo: string;
}

export interface DatosCliente {
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
  direccion?: string;
}

export interface ItemComprobante {
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  precioUnitario: number;
  valorVenta: number;
  igv: number;
  total: number;
}

export interface DatosComprobante {
  tipoDocumento: '01' | '03' | '07' | '08'; // 01=Factura, 03=Boleta, 07=NC, 08=ND
  serie: string;
  numero: string;
  fechaEmision: string; // YYYY-MM-DD
  horaEmision?: string; // HH:MM:SS
  moneda: string;
  emisor: DatosEmisor;
  cliente: DatosCliente;
  items: ItemComprobante[];
  totalGravado: number;
  totalIgv: number;
  totalVenta: number;
  observaciones?: string;
}

const TIPO_DOCUMENTO_SUNAT: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta de Venta',
  '07': 'Nota de Crédito',
  '08': 'Nota de Débito',
};

export function generarXMLUBL21(datos: DatosComprobante): string {
  const fechaEmision = datos.fechaEmision;
  const horaEmision = datos.horaEmision || '12:00:00';
  const numeroComprobante = `${datos.serie}-${datos.numero.padStart(8, '0')}`;

  // Determinar el nombre del documento raíz según el tipo
  let rootElement = 'Invoice';
  let namespacePrefix = '';
  if (datos.tipoDocumento === '07') {
    rootElement = 'CreditNote';
  } else if (datos.tipoDocumento === '08') {
    rootElement = 'DebitNote';
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<${rootElement} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${rootElement}-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    xmlns:ccts="urn:un:unece:uncefact:documentation:2"
    xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
    xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
    xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2"
    xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1"
    xmlns:udt="urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionContent>
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>

    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>2.0</cbc:CustomizationID>
    <cbc:ID>${numeroComprobante}</cbc:ID>
    <cbc:IssueDate>${fechaEmision}</cbc:IssueDate>
    <cbc:IssueTime>${horaEmision}</cbc:IssueTime>`;

  // Tipo de documento
  if (datos.tipoDocumento === '01' || datos.tipoDocumento === '03') {
    xml += `
    <cbc:InvoiceTypeCode listID="0101" listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${datos.tipoDocumento}</cbc:InvoiceTypeCode>`;
  }

  xml += `
    <cbc:Note languageLocaleID="1000"><![CDATA[${datos.observaciones || 'COMPROBANTE ELECTRONICO'}]]></cbc:Note>
    <cbc:DocumentCurrencyCode listID="ISO 4217 Alpha" listAgencyName="United Nations Economic Commission for Europe" listName="Currency">${datos.moneda}</cbc:DocumentCurrencyCode>

    <!-- DATOS DEL EMISOR -->
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="6" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${datos.emisor.ruc}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name><![CDATA[${datos.emisor.nombreComercial || datos.emisor.razonSocial}]]></cbc:Name>
            </cac:PartyName>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName><![CDATA[${datos.emisor.razonSocial}]]></cbc:RegistrationName>
                <cac:RegistrationAddress>
                    <cbc:ID schemeName="Ubigeos" schemeAgencyName="PE:INEI">${datos.emisor.ubigeo}</cbc:ID>
                    <cbc:AddressTypeCode listAgencyName="PE:SUNAT" listName="Establecimientos anexos">0000</cbc:AddressTypeCode>
                    <cbc:CityName>LIMA</cbc:CityName>
                    <cbc:CountrySubentity>LIMA</cbc:CountrySubentity>
                    <cbc:District>LIMA</cbc:District>
                    <cac:AddressLine>
                        <cbc:Line><![CDATA[${datos.emisor.direccion}]]></cbc:Line>
                    </cac:AddressLine>
                    <cac:Country>
                        <cbc:IdentificationCode listID="ISO 3166-1" listAgencyName="United Nations Economic Commission for Europe" listName="Country">PE</cbc:IdentificationCode>
                    </cac:Country>
                </cac:RegistrationAddress>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>

    <!-- DATOS DEL CLIENTE -->
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="${datos.cliente.tipoDocumento}" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${datos.cliente.numeroDocumento}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName><![CDATA[${datos.cliente.razonSocial}]]></cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>

    <!-- TOTALES TRIBUTARIOS -->
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${datos.moneda}">${datos.totalIgv.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${datos.moneda}">${datos.totalGravado.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${datos.moneda}">${datos.totalIgv.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID schemeID="UN/ECE 5305" schemeName="Tax Category Identifier" schemeAgencyName="United Nations Economic Commission for Europe">S</cbc:ID>
                <cac:TaxScheme>
                    <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">1000</cbc:ID>
                    <cbc:Name>IGV</cbc:Name>
                    <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>

    <!-- TOTALES DEL DOCUMENTO -->
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${datos.moneda}">${datos.totalGravado.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxInclusiveAmount currencyID="${datos.moneda}">${datos.totalVenta.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="${datos.moneda}">${datos.totalVenta.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>`;

  // Items
  datos.items.forEach((item, index) => {
    const lineNumber = index + 1;
    xml += `

    <!-- ITEM ${lineNumber} -->
    <cac:${datos.tipoDocumento === '01' || datos.tipoDocumento === '03' ? 'InvoiceLine' : 'CreditNoteLine'}>
        <cbc:ID>${lineNumber}</cbc:ID>
        <cbc:${datos.tipoDocumento === '01' || datos.tipoDocumento === '03' ? 'InvoicedQuantity' : 'CreditedQuantity'} unitCode="${item.unidadMedida}" unitCodeListID="UN/ECE rec 20" unitCodeListAgencyName="United Nations Economic Commission for Europe">${item.cantidad}</cbc:${datos.tipoDocumento === '01' || datos.tipoDocumento === '03' ? 'InvoicedQuantity' : 'CreditedQuantity'}>
        <cbc:LineExtensionAmount currencyID="${datos.moneda}">${item.valorVenta.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:PricingReference>
            <cac:AlternativeConditionPrice>
                <cbc:PriceAmount currencyID="${datos.moneda}">${(item.precioUnitario * 1.18).toFixed(2)}</cbc:PriceAmount>
                <cbc:PriceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Precio" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16">01</cbc:PriceTypeCode>
            </cac:AlternativeConditionPrice>
        </cac:PricingReference>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${datos.moneda}">${item.igv.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="${datos.moneda}">${item.valorVenta.toFixed(2)}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="${datos.moneda}">${item.igv.toFixed(2)}</cbc:TaxAmount>
                <cac:TaxCategory>
                    <cbc:ID schemeID="UN/ECE 5305" schemeName="Tax Category Identifier" schemeAgencyName="United Nations Economic Commission for Europe">S</cbc:ID>
                    <cbc:Percent>18</cbc:Percent>
                    <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">10</cbc:TaxExemptionReasonCode>
                    <cac:TaxScheme>
                        <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">1000</cbc:ID>
                        <cbc:Name>IGV</cbc:Name>
                        <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                    </cac:TaxScheme>
                </cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Description><![CDATA[${item.descripcion}]]></cbc:Description>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${datos.moneda}">${item.precioUnitario.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:${datos.tipoDocumento === '01' || datos.tipoDocumento === '03' ? 'InvoiceLine' : 'CreditNoteLine'}>`;
  });

  xml += `
</${rootElement}>`;

  return xml;
}

export default { generarXMLUBL21 };
