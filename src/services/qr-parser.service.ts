// Servicio de parsing de QR SUNAT
// El QR de SUNAT tiene el formato: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC|DOC|HASH

export interface QRData {
  ruc: string;
  tipoDocumento: string;
  tipoNombre: string;
  serie: string;
  numero: string;
  igv: number;
  total: number;
  fecha: string;
  fechaISO: string;
  tipoDocCliente: string;
  numDocCliente: string;
  hash: string;
  baseImponible: number;
}

const TIPO_DOCUMENTO_NOMBRES: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta de Venta',
  '07': 'Nota de Crédito',
  '08': 'Nota de Débito',
};

export function parseQRSunat(qrData: string): QRData | null {
  try {
    // Limpiar el QR
    const cleaned = qrData.trim();

    // El QR tiene el formato: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC|DOC|HASH
    // También puede ser: RUC|TIPO|SERIE|NUMERO|MTO_IGV|MTO_TOTAL|FECHA_EMISION|TIPO_DOC|NUM_DOC
    const parts = cleaned.split('|');

    if (parts.length < 9) {
      console.error('QR inválido: menos de 9 partes');
      return null;
    }

    const [
      ruc,
      tipoDocumento,
      serie,
      numero,
      igvStr,
      totalStr,
      fecha,
      tipoDocCliente,
      numDocCliente,
      hash = '',
    ] = parts;

    // Validar RUC
    if (!ruc || ruc.length !== 11 || !/^\d{11}$/.test(ruc)) {
      console.error('RUC inválido en QR');
      return null;
    }

    // Validar tipo de documento
    if (!['01', '03', '07', '08'].includes(tipoDocumento)) {
      console.error('Tipo de documento inválido en QR:', tipoDocumento);
      return null;
    }

    // Parsear montos
    const igv = parseFloat(igvStr);
    const total = parseFloat(totalStr);

    if (isNaN(igv) || isNaN(total)) {
      console.error('Montos inválidos en QR');
      return null;
    }

    // Calcular base imponible (total - igv)
    const baseImponible = Math.round((total - igv) * 100) / 100;

    // Parsear fecha (formato DD/MM/YYYY o YYYY-MM-DD)
    let fechaISO: string;
    if (fecha.includes('/')) {
      const [day, month, year] = fecha.split('/');
      fechaISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (fecha.includes('-')) {
      fechaISO = fecha;
    } else {
      // Intentar formato YYYYMMDD
      if (fecha.length === 8) {
        fechaISO = `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
      } else {
        console.error('Formato de fecha inválido en QR');
        return null;
      }
    }

    return {
      ruc,
      tipoDocumento,
      tipoNombre: TIPO_DOCUMENTO_NOMBRES[tipoDocumento] || tipoDocumento,
      serie,
      numero,
      igv,
      total,
      fecha,
      fechaISO,
      tipoDocCliente,
      numDocCliente,
      hash,
      baseImponible,
    };
  } catch (error) {
    console.error('Error parseando QR SUNAT:', error);
    return null;
  }
}

export default { parseQRSunat };
