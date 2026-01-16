// Servicio de firma digital XML para comprobantes electrónicos SUNAT
// Implementa XMLDSig con certificado P12/PFX
// Nota: En producción se recomienda usar node-forge para mejor soporte P12

import * as crypto from 'crypto';

export interface CertificadoInfo {
  certificadoBase64: string; // P12/PFX en Base64
  password: string;
}

export interface ResultadoFirma {
  xmlFirmado: string;
  hash: string;
  success: boolean;
  error?: string;
}

/**
 * Firma XML usando certificado P12 (versión simplificada)
 * Nota: Esta implementación es para entornos de desarrollo/beta
 * Para producción, usar node-forge para extraer correctamente el P12
 */
export async function firmarXMLConP12(
  xml: string,
  certificadoInfo: CertificadoInfo
): Promise<ResultadoFirma> {
  try {
    // En una implementación completa, aquí extraeríamos la clave del P12
    // usando node-forge o openssl. Por ahora, generamos una firma básica
    // para permitir pruebas en el entorno beta de SUNAT.

    // Calcular hash del documento
    const hash = crypto
      .createHash('sha256')
      .update(xml)
      .digest('hex');

    // Calcular digest value del contenido
    const digestValue = crypto
      .createHash('sha256')
      .update(xml)
      .digest('base64');

    // Insertar bloque de firma en ExtensionContent
    const signatureBlock = `
        <ds:Signature Id="SignatureSP" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
            <ds:SignedInfo>
                <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
                <ds:Reference URI="">
                    <ds:Transforms>
                        <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                    </ds:Transforms>
                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                    <ds:DigestValue>${digestValue}</ds:DigestValue>
                </ds:Reference>
            </ds:SignedInfo>
            <ds:SignatureValue>FIRMA_DESARROLLO_BETA</ds:SignatureValue>
            <ds:KeyInfo>
                <ds:X509Data>
                    <ds:X509Certificate>CERTIFICADO_DESARROLLO</ds:X509Certificate>
                </ds:X509Data>
            </ds:KeyInfo>
        </ds:Signature>`;

    // Insertar la firma en el XML
    const xmlConFirma = xml.replace(
      '<ext:ExtensionContent>\n            </ext:ExtensionContent>',
      `<ext:ExtensionContent>${signatureBlock}\n            </ext:ExtensionContent>`
    );

    return {
      xmlFirmado: xmlConFirma,
      hash,
      success: true,
    };
  } catch (error) {
    return {
      xmlFirmado: xml,
      hash: '',
      success: false,
      error: `Error en firma digital: ${error}`,
    };
  }
}

/**
 * Genera el hash de resumen del comprobante (para código QR SUNAT)
 * Formato: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC_CLIENTE|NUM_DOC_CLIENTE|
 */
export function generarHashResumen(
  ruc: string,
  tipoDocumento: string,
  serie: string,
  numero: string,
  igv: number,
  total: number,
  fechaEmision: string,
  tipoDocCliente: string,
  numDocCliente: string
): string {
  const cadena = `${ruc}|${tipoDocumento}|${serie}|${numero}|${igv.toFixed(2)}|${total.toFixed(2)}|${fechaEmision}|${tipoDocCliente}|${numDocCliente}|`;

  return crypto
    .createHash('sha256')
    .update(cadena)
    .digest('base64');
}

/**
 * Valida el formato de un certificado P12
 */
export function validarCertificadoP12(
  certificadoBase64: string,
  password: string
): { valid: boolean; error?: string } {
  try {
    const buffer = Buffer.from(certificadoBase64, 'base64');

    // Verificar que sea un archivo válido (magic bytes de PKCS#12)
    if (buffer.length < 4) {
      return { valid: false, error: 'Archivo muy pequeño' };
    }

    // Los archivos P12/PFX comienzan con 0x30 (ASN.1 SEQUENCE)
    if (buffer[0] !== 0x30) {
      return { valid: false, error: 'Formato de archivo inválido' };
    }

    // La validación completa requeriría intentar abrir el P12
    // con la contraseña proporcionada usando node-forge

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Error validando certificado: ${error}` };
  }
}

/**
 * Genera código QR para comprobante electrónico
 * El QR contiene: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC|NUM_DOC|HASH
 */
export function generarDatosQR(
  ruc: string,
  tipoDocumento: string,
  serie: string,
  numero: string,
  igv: number,
  total: number,
  fechaEmision: string,
  tipoDocCliente: string,
  numDocCliente: string,
  hashResumen: string
): string {
  return `${ruc}|${tipoDocumento}|${serie}|${numero}|${igv.toFixed(2)}|${total.toFixed(2)}|${fechaEmision}|${tipoDocCliente}|${numDocCliente}|${hashResumen}`;
}

export default {
  firmarXMLConP12,
  generarHashResumen,
  validarCertificadoP12,
  generarDatosQR,
};
