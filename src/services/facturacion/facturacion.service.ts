// Servicio principal de facturación electrónica SUNAT
// Orquesta generación XML, firma digital y envío a SUNAT

import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { generarXMLUBL21, DatosComprobante, ItemComprobante } from './xml-generator.service';
import { firmarXMLConP12, generarHashResumen } from './xml-signer.service';
import { enviarComprobante, RespuestaSUNAT } from './soap-client.service';

export interface DatosEmision {
  companyId: string;
  tipoDocumento: '01' | '03' | '07' | '08'; // Factura, Boleta, NC, ND
  cliente: {
    tipoDocumento: string; // 6=RUC, 1=DNI, etc.
    numeroDocumento: string;
    razonSocial: string;
    direccion?: string;
  };
  items: Array<{
    descripcion: string;
    cantidad: number;
    precioUnitario: number; // Sin IGV
    unidadMedida?: string;
  }>;
  moneda?: string;
  observaciones?: string;
  // Para notas de crédito/débito
  documentoRelacionado?: {
    tipoDocumento: string;
    serie: string;
    numero: string;
    motivoNota?: string;
  };
}

export interface ResultadoEmision {
  success: boolean;
  comprobante?: {
    id: string;
    serie: string;
    numero: string;
    total: number;
    xmlBase64?: string;
    pdfBase64?: string;
    hashResumen: string;
  };
  respuestaSunat?: RespuestaSUNAT;
  error?: string;
}

const IGV_RATE = 0.18;

/**
 * Obtiene el siguiente número de comprobante
 */
async function obtenerSiguienteNumero(
  companyId: string,
  tipoDocumento: string,
  serie: string
): Promise<string> {
  // Buscar el último comprobante de esta serie
  const ultimo = await prisma.comprobante.findFirst({
    where: {
      companyId,
      tipoDocumento,
      serie,
    },
    orderBy: {
      numero: 'desc',
    },
  });

  if (!ultimo) {
    return '00000001';
  }

  const siguienteNum = parseInt(ultimo.numero) + 1;
  return siguienteNum.toString().padStart(8, '0');
}

/**
 * Calcula los totales de los items
 */
function calcularTotales(items: DatosEmision['items']): {
  itemsCalculados: ItemComprobante[];
  totalGravado: number;
  totalIgv: number;
  totalVenta: number;
} {
  let totalGravado = 0;
  let totalIgv = 0;

  const itemsCalculados = items.map((item) => {
    const valorVenta = item.cantidad * item.precioUnitario;
    const igv = valorVenta * IGV_RATE;
    const total = valorVenta + igv;

    totalGravado += valorVenta;
    totalIgv += igv;

    return {
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      unidadMedida: item.unidadMedida || 'NIU', // Unidad por defecto
      valorVenta: Math.round(valorVenta * 100) / 100,
      igv: Math.round(igv * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  });

  return {
    itemsCalculados,
    totalGravado: Math.round(totalGravado * 100) / 100,
    totalIgv: Math.round(totalIgv * 100) / 100,
    totalVenta: Math.round((totalGravado + totalIgv) * 100) / 100,
  };
}

/**
 * Emite un comprobante electrónico
 */
export async function emitirComprobante(
  datos: DatosEmision,
  usarBeta: boolean = true
): Promise<ResultadoEmision> {
  try {
    // 1. Obtener empresa y verificar credenciales
    const company = await prisma.company.findUnique({
      where: { id: datos.companyId },
    });

    if (!company) {
      return { success: false, error: 'Empresa no encontrada' };
    }

    if (!company.certificadoDigital || !company.certificadoPasswordEncrypted) {
      return {
        success: false,
        error: 'La empresa no tiene certificado digital configurado',
      };
    }

    if (!company.usuarioSol || !company.claveSolEncrypted) {
      return {
        success: false,
        error: 'La empresa no tiene credenciales SOL configuradas',
      };
    }

    // 2. Determinar serie según tipo de documento
    let serie: string;
    if (datos.tipoDocumento === '01' || datos.tipoDocumento === '07' || datos.tipoDocumento === '08') {
      serie = company.serieFactura || 'F001';
    } else {
      serie = company.serieBoleta || 'B001';
    }

    // 3. Obtener siguiente número
    const numero = await obtenerSiguienteNumero(
      datos.companyId,
      datos.tipoDocumento,
      serie
    );

    // 4. Calcular totales
    const { itemsCalculados, totalGravado, totalIgv, totalVenta } = calcularTotales(
      datos.items
    );

    // 5. Preparar datos para XML
    const fechaEmision = new Date().toISOString().split('T')[0];
    const horaEmision = new Date().toTimeString().split(' ')[0];

    const datosComprobante: DatosComprobante = {
      tipoDocumento: datos.tipoDocumento,
      serie,
      numero,
      fechaEmision,
      horaEmision,
      moneda: datos.moneda || 'PEN',
      emisor: {
        ruc: company.ruc,
        razonSocial: company.razonSocial,
        nombreComercial: company.nombreComercial || undefined,
        direccion: company.direccionFiscal || 'LIMA',
        ubigeo: '150101', // Lima por defecto
      },
      cliente: {
        tipoDocumento: datos.cliente.tipoDocumento,
        numeroDocumento: datos.cliente.numeroDocumento,
        razonSocial: datos.cliente.razonSocial,
        direccion: datos.cliente.direccion,
      },
      items: itemsCalculados,
      totalGravado,
      totalIgv,
      totalVenta,
      observaciones: datos.observaciones,
    };

    // 6. Generar XML
    const xml = generarXMLUBL21(datosComprobante);

    // 7. Firmar XML
    const certificadoDecrypted = decrypt(company.certificadoDigital);
    const passwordDecrypted = decrypt(company.certificadoPasswordEncrypted);

    const resultadoFirma = await firmarXMLConP12(xml, {
      certificadoBase64: certificadoDecrypted,
      password: passwordDecrypted,
    });

    if (!resultadoFirma.success) {
      return {
        success: false,
        error: `Error al firmar: ${resultadoFirma.error}`,
      };
    }

    // 8. Generar hash de resumen (para QR)
    const hashResumen = generarHashResumen(
      company.ruc,
      datos.tipoDocumento,
      serie,
      numero,
      totalIgv,
      totalVenta,
      fechaEmision,
      datos.cliente.tipoDocumento,
      datos.cliente.numeroDocumento
    );

    // 9. Enviar a SUNAT
    const nombreArchivo = `${company.ruc}-${datos.tipoDocumento}-${serie}-${numero}`;
    const claveSol = decrypt(company.claveSolEncrypted);

    const respuestaSunat = await enviarComprobante(
      resultadoFirma.xmlFirmado,
      nombreArchivo,
      {
        ruc: company.ruc,
        usuarioSol: company.usuarioSol,
        claveSol,
      },
      usarBeta
    );

    // 10. Determinar el período actual
    const periodo = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // 11. Guardar comprobante en BD
    const comprobanteCreado = await prisma.comprobante.create({
      data: {
        companyId: datos.companyId,
        tipo: 'VENTA',
        tipoDocumento: datos.tipoDocumento,
        serie,
        numero,
        fechaEmision: new Date(),
        tipoDocTercero: datos.cliente.tipoDocumento,
        rucTercero: datos.cliente.numeroDocumento,
        razonSocialTercero: datos.cliente.razonSocial,
        moneda: datos.moneda || 'PEN',
        baseImponible: totalGravado,
        igv: totalIgv,
        total: totalVenta,
        esGravada: true,
        afectaIgv: true,
        periodo,
        estado: respuestaSunat.success ? 'ACTIVO' : 'PENDIENTE',
        xmlFirmado: Buffer.from(resultadoFirma.xmlFirmado).toString('base64'),
        hashResumen,
        cdrBase64: respuestaSunat.cdrBase64,
        estadoSunat: respuestaSunat.success ? 'ACEPTADO' : 'RECHAZADO',
        codigoRespuestaSunat: respuestaSunat.codigo,
        mensajeRespuestaSunat: respuestaSunat.mensaje,
      },
    });

    return {
      success: respuestaSunat.success,
      comprobante: {
        id: comprobanteCreado.id,
        serie,
        numero,
        total: totalVenta,
        xmlBase64: Buffer.from(resultadoFirma.xmlFirmado).toString('base64'),
        hashResumen,
      },
      respuestaSunat,
      error: respuestaSunat.success ? undefined : respuestaSunat.mensaje,
    };
  } catch (error) {
    console.error('Error emitiendo comprobante:', error);
    return {
      success: false,
      error: `Error interno: ${error}`,
    };
  }
}

/**
 * Consulta el estado de un comprobante en SUNAT
 */
export async function consultarEstadoComprobante(
  comprobanteId: string
): Promise<{ estado: string; mensaje: string }> {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id: comprobanteId },
  });

  if (!comprobante) {
    return { estado: 'NO_ENCONTRADO', mensaje: 'Comprobante no encontrado' };
  }

  return {
    estado: comprobante.estadoSunat || 'PENDIENTE',
    mensaje: comprobante.mensajeRespuestaSunat || 'Sin mensaje',
  };
}

/**
 * Reenvía un comprobante rechazado a SUNAT
 */
export async function reenviarComprobante(
  comprobanteId: string,
  usarBeta: boolean = true
): Promise<ResultadoEmision> {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id: comprobanteId },
    include: { company: true },
  });

  if (!comprobante) {
    return { success: false, error: 'Comprobante no encontrado' };
  }

  if (!comprobante.xmlFirmado) {
    return { success: false, error: 'Comprobante sin XML firmado' };
  }

  const company = comprobante.company;

  if (!company.usuarioSol || !company.claveSolEncrypted) {
    return { success: false, error: 'Credenciales SOL no configuradas' };
  }

  const nombreArchivo = `${company.ruc}-${comprobante.tipoDocumento}-${comprobante.serie}-${comprobante.numero}`;
  const claveSol = decrypt(company.claveSolEncrypted);
  const xmlFirmado = Buffer.from(comprobante.xmlFirmado, 'base64').toString('utf-8');

  const respuestaSunat = await enviarComprobante(
    xmlFirmado,
    nombreArchivo,
    {
      ruc: company.ruc,
      usuarioSol: company.usuarioSol,
      claveSol,
    },
    usarBeta
  );

  // Actualizar estado
  await prisma.comprobante.update({
    where: { id: comprobanteId },
    data: {
      estado: respuestaSunat.success ? 'ACTIVO' : 'PENDIENTE',
      estadoSunat: respuestaSunat.success ? 'ACEPTADO' : 'RECHAZADO',
      codigoRespuestaSunat: respuestaSunat.codigo,
      mensajeRespuestaSunat: respuestaSunat.mensaje,
      cdrBase64: respuestaSunat.cdrBase64,
    },
  });

  return {
    success: respuestaSunat.success,
    comprobante: {
      id: comprobanteId,
      serie: comprobante.serie,
      numero: comprobante.numero,
      total: Number(comprobante.total),
      hashResumen: comprobante.hashResumen || '',
    },
    respuestaSunat,
    error: respuestaSunat.success ? undefined : respuestaSunat.mensaje,
  };
}

export default {
  emitirComprobante,
  consultarEstadoComprobante,
  reenviarComprobante,
};
