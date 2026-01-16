// Cliente SOAP para servicios web de SUNAT
// Soporta envío de facturas, boletas, notas de crédito/débito

import JSZip from 'jszip';
import { parseStringPromise, Builder } from 'xml2js';

// URLs de los servicios SUNAT
const SUNAT_URLS = {
  produccion: {
    facturas: 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
    guias: 'https://e-guiaremision.sunat.gob.pe/ol-ti-itemision-guia-gem/billService',
    consulta: 'https://e-factura.sunat.gob.pe/ol-it-wsconscpegem/billConsultService',
  },
  beta: {
    facturas: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    guias: 'https://e-beta.sunat.gob.pe/ol-ti-itemision-guia-gem-beta/billService',
    consulta: 'https://e-beta.sunat.gob.pe/ol-it-wsconscpegem-beta/billConsultService',
  },
};

export interface CredencialesSUNAT {
  ruc: string;
  usuarioSol: string;
  claveSol: string;
}

export interface RespuestaSUNAT {
  success: boolean;
  codigo?: string;
  mensaje?: string;
  hashCdr?: string;
  cdrBase64?: string; // CDR en Base64
  observaciones?: string[];
  errors?: string[];
}

/**
 * Crea el sobre SOAP para enviar a SUNAT
 */
function crearSoapEnvelope(
  nombreArchivo: string,
  contenidoZipBase64: string,
  credenciales: CredencialesSUNAT
): string {
  const wsseNs = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:wsse="${wsseNs}"
    xmlns:ser="http://service.sunat.gob.pe">
    <soap:Header>
        <wsse:Security>
            <wsse:UsernameToken>
                <wsse:Username>${credenciales.ruc}${credenciales.usuarioSol}</wsse:Username>
                <wsse:Password>${credenciales.claveSol}</wsse:Password>
            </wsse:UsernameToken>
        </wsse:Security>
    </soap:Header>
    <soap:Body>
        <ser:sendBill>
            <fileName>${nombreArchivo}</fileName>
            <contentFile>${contenidoZipBase64}</contentFile>
        </ser:sendBill>
    </soap:Body>
</soap:Envelope>`;
}

/**
 * Crea el sobre SOAP para consultar ticket
 */
function crearSoapEnvelopeTicket(
  ticket: string,
  credenciales: CredencialesSUNAT
): string {
  const wsseNs = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:wsse="${wsseNs}"
    xmlns:ser="http://service.sunat.gob.pe">
    <soap:Header>
        <wsse:Security>
            <wsse:UsernameToken>
                <wsse:Username>${credenciales.ruc}${credenciales.usuarioSol}</wsse:Username>
                <wsse:Password>${credenciales.claveSol}</wsse:Password>
            </wsse:UsernameToken>
        </wsse:Security>
    </soap:Header>
    <soap:Body>
        <ser:getStatus>
            <ticket>${ticket}</ser:getStatus>
        </ticket>
    </soap:Body>
</soap:Envelope>`;
}

/**
 * Crea el sobre SOAP para envío de resumen diario
 */
function crearSoapEnvelopeSummary(
  nombreArchivo: string,
  contenidoZipBase64: string,
  credenciales: CredencialesSUNAT
): string {
  const wsseNs = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:wsse="${wsseNs}"
    xmlns:ser="http://service.sunat.gob.pe">
    <soap:Header>
        <wsse:Security>
            <wsse:UsernameToken>
                <wsse:Username>${credenciales.ruc}${credenciales.usuarioSol}</wsse:Username>
                <wsse:Password>${credenciales.claveSol}</wsse:Password>
            </wsse:UsernameToken>
        </wsse:Security>
    </soap:Header>
    <soap:Body>
        <ser:sendSummary>
            <fileName>${nombreArchivo}</fileName>
            <contentFile>${contenidoZipBase64}</contentFile>
        </ser:sendSummary>
    </soap:Body>
</soap:Envelope>`;
}

/**
 * Comprime el XML en un archivo ZIP en memoria
 */
export async function comprimirXML(
  nombreArchivo: string,
  xmlContent: string
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(`${nombreArchivo}.xml`, xmlContent);

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return zipBuffer;
}

/**
 * Extrae el contenido del CDR (Constancia de Recepción)
 */
export async function extraerCDR(
  cdrBase64: string
): Promise<{ codigo: string; mensaje: string; observaciones: string[] }> {
  try {
    const zipBuffer = Buffer.from(cdrBase64, 'base64');
    const zip = await JSZip.loadAsync(zipBuffer);

    // Buscar el archivo XML dentro del ZIP
    const xmlFile = Object.keys(zip.files).find((name) => name.endsWith('.xml'));

    if (!xmlFile) {
      throw new Error('No se encontró archivo XML en el CDR');
    }

    const xmlContent = await zip.files[xmlFile].async('string');
    const parsed = await parseStringPromise(xmlContent, { explicitArray: false });

    // Extraer información del CDR
    const response = parsed['ar:ApplicationResponse'] || parsed.ApplicationResponse || {};
    const documentResponse = response['cac:DocumentResponse'] || {};
    const response2 = documentResponse['cac:Response'] || {};

    const codigo = response2['cbc:ResponseCode'] || '0';
    const mensaje = response2['cbc:Description'] || 'Sin descripción';

    // Extraer observaciones si las hay
    const observaciones: string[] = [];
    const notes = response['cbc:Note'];
    if (notes) {
      if (Array.isArray(notes)) {
        observaciones.push(...notes);
      } else {
        observaciones.push(notes);
      }
    }

    return { codigo, mensaje, observaciones };
  } catch (error) {
    return {
      codigo: 'ERROR',
      mensaje: `Error al procesar CDR: ${error}`,
      observaciones: [],
    };
  }
}

/**
 * Parsea la respuesta SOAP de SUNAT
 */
async function parsearRespuestaSUNAT(
  soapResponse: string
): Promise<RespuestaSUNAT> {
  try {
    const parsed = await parseStringPromise(soapResponse, { explicitArray: false });

    // Buscar el body de la respuesta
    const envelope = parsed['soap:Envelope'] || parsed['S:Envelope'] || parsed.Envelope;
    const body = envelope['soap:Body'] || envelope['S:Body'] || envelope.Body;

    // Verificar si hay fault (error)
    const fault = body['soap:Fault'] || body['S:Fault'] || body.Fault;
    if (fault) {
      return {
        success: false,
        codigo: fault.faultcode || 'ERROR',
        mensaje: fault.faultstring || 'Error desconocido de SUNAT',
        errors: [fault.detail?.message || fault.faultstring],
      };
    }

    // Respuesta exitosa
    const sendBillResponse = body['br:sendBillResponse'] || body.sendBillResponse || {};
    const applicationResponse = sendBillResponse.applicationResponse;

    if (applicationResponse) {
      const cdrInfo = await extraerCDR(applicationResponse);

      return {
        success: cdrInfo.codigo === '0' || cdrInfo.codigo.startsWith('0'),
        codigo: cdrInfo.codigo,
        mensaje: cdrInfo.mensaje,
        cdrBase64: applicationResponse,
        observaciones: cdrInfo.observaciones,
      };
    }

    return {
      success: true,
      codigo: '0',
      mensaje: 'Comprobante enviado correctamente',
    };
  } catch (error) {
    return {
      success: false,
      codigo: 'PARSE_ERROR',
      mensaje: `Error al procesar respuesta: ${error}`,
      errors: [`${error}`],
    };
  }
}

/**
 * Envía un comprobante a SUNAT
 */
export async function enviarComprobante(
  xmlFirmado: string,
  nombreArchivo: string, // Formato: RUC-TIPO-SERIE-NUMERO (ej: 20123456789-01-F001-00000001)
  credenciales: CredencialesSUNAT,
  usarBeta: boolean = true
): Promise<RespuestaSUNAT> {
  try {
    // Comprimir el XML
    const zipBuffer = await comprimirXML(nombreArchivo, xmlFirmado);
    const zipBase64 = zipBuffer.toString('base64');

    // Crear sobre SOAP
    const soapEnvelope = crearSoapEnvelope(
      `${nombreArchivo}.zip`,
      zipBase64,
      credenciales
    );

    // Determinar URL
    const urls = usarBeta ? SUNAT_URLS.beta : SUNAT_URLS.produccion;
    const url = urls.facturas;

    // Enviar a SUNAT
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'urn:sendBill',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      return {
        success: false,
        codigo: `HTTP_${response.status}`,
        mensaje: `Error HTTP: ${response.statusText}`,
        errors: [`HTTP ${response.status}: ${response.statusText}`],
      };
    }

    const soapResponse = await response.text();
    return await parsearRespuestaSUNAT(soapResponse);
  } catch (error) {
    return {
      success: false,
      codigo: 'NETWORK_ERROR',
      mensaje: `Error de conexión: ${error}`,
      errors: [`${error}`],
    };
  }
}

/**
 * Consulta el estado de un ticket (para resúmenes y bajas)
 */
export async function consultarTicket(
  ticket: string,
  credenciales: CredencialesSUNAT,
  usarBeta: boolean = true
): Promise<RespuestaSUNAT> {
  try {
    const soapEnvelope = crearSoapEnvelopeTicket(ticket, credenciales);

    const urls = usarBeta ? SUNAT_URLS.beta : SUNAT_URLS.produccion;
    const url = urls.facturas;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'urn:getStatus',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      return {
        success: false,
        codigo: `HTTP_${response.status}`,
        mensaje: `Error HTTP: ${response.statusText}`,
      };
    }

    const soapResponse = await response.text();
    return await parsearRespuestaSUNAT(soapResponse);
  } catch (error) {
    return {
      success: false,
      codigo: 'NETWORK_ERROR',
      mensaje: `Error de conexión: ${error}`,
    };
  }
}

/**
 * Envía un resumen diario de boletas
 */
export async function enviarResumenDiario(
  xmlFirmado: string,
  nombreArchivo: string, // Formato: RUC-RC-YYYYMMDD-NNNNN
  credenciales: CredencialesSUNAT,
  usarBeta: boolean = true
): Promise<RespuestaSUNAT & { ticket?: string }> {
  try {
    const zipBuffer = await comprimirXML(nombreArchivo, xmlFirmado);
    const zipBase64 = zipBuffer.toString('base64');

    const soapEnvelope = crearSoapEnvelopeSummary(
      `${nombreArchivo}.zip`,
      zipBase64,
      credenciales
    );

    const urls = usarBeta ? SUNAT_URLS.beta : SUNAT_URLS.produccion;
    const url = urls.facturas;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'urn:sendSummary',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      return {
        success: false,
        codigo: `HTTP_${response.status}`,
        mensaje: `Error HTTP: ${response.statusText}`,
      };
    }

    const soapResponse = await response.text();
    const parsed = await parseStringPromise(soapResponse, { explicitArray: false });

    const envelope = parsed['soap:Envelope'] || parsed['S:Envelope'];
    const body = envelope['soap:Body'] || envelope['S:Body'];
    const sendSummaryResponse = body['br:sendSummaryResponse'] || body.sendSummaryResponse;

    const ticket = sendSummaryResponse?.ticket;

    return {
      success: !!ticket,
      codigo: ticket ? '0' : 'ERROR',
      mensaje: ticket ? 'Resumen enviado, consultar ticket' : 'Error al enviar resumen',
      ticket,
    };
  } catch (error) {
    return {
      success: false,
      codigo: 'NETWORK_ERROR',
      mensaje: `Error de conexión: ${error}`,
    };
  }
}

export default {
  enviarComprobante,
  consultarTicket,
  enviarResumenDiario,
  comprimirXML,
  extraerCDR,
};
