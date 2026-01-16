// Servicio de parsing de archivos SIRE (Sistema Integrado de Registros Electrónicos)
// SIRE permite descargar registros de ventas y compras en formato TXT

export interface SIREComprobante {
  periodo: string;
  tipoOperacion: 'VENTA' | 'COMPRA';
  tipoDocumento: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  tipoDocTercero: string;
  rucTercero: string;
  razonSocialTercero: string;
  baseImponible: number;
  igv: number;
  total: number;
  moneda: string;
  tipoCambio: number | null;
}

// Parser para Registro de Ventas SIRE (formato PLE 14.1)
export function parseRegistroVentas(content: string, periodo: string): SIREComprobante[] {
  const comprobantes: SIREComprobante[] = [];
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const fields = line.split('|');
      if (fields.length < 35) continue;

      // Campos del Registro de Ventas PLE 14.1
      // 1: Periodo, 4: Fecha Emision, 5: Fecha Venc, 6: Tipo Doc, 7: Serie, 8: Numero
      // 9: Tipo Doc Cliente, 10: Num Doc Cliente, 11: Razon Social
      // 12-26: Montos, 27: Moneda, 28: Tipo Cambio

      const tipoDocumento = fields[5]?.trim();
      const serie = fields[6]?.trim();
      const numero = fields[7]?.trim();
      const fechaEmision = formatFechaSIRE(fields[3]?.trim());
      const fechaVencimiento = fields[4]?.trim() ? formatFechaSIRE(fields[4].trim()) : null;
      const tipoDocTercero = fields[8]?.trim();
      const rucTercero = fields[9]?.trim();
      const razonSocialTercero = fields[10]?.trim();

      // Montos
      const baseImponible = parseFloat(fields[11] || '0') + parseFloat(fields[12] || '0') + parseFloat(fields[13] || '0');
      const igv = parseFloat(fields[14] || '0');
      const total = parseFloat(fields[23] || '0') || (baseImponible + igv);

      const moneda = fields[26]?.trim() || 'PEN';
      const tipoCambio = moneda !== 'PEN' ? parseFloat(fields[27] || '0') || null : null;

      if (!tipoDocumento || !serie || !numero || !fechaEmision) continue;

      comprobantes.push({
        periodo,
        tipoOperacion: 'VENTA',
        tipoDocumento,
        serie,
        numero,
        fechaEmision,
        fechaVencimiento,
        tipoDocTercero,
        rucTercero,
        razonSocialTercero,
        baseImponible: Math.abs(baseImponible),
        igv: Math.abs(igv),
        total: Math.abs(total),
        moneda,
        tipoCambio,
      });
    } catch (error) {
      console.error('Error parseando línea SIRE ventas:', error);
      continue;
    }
  }

  return comprobantes;
}

// Parser para Registro de Compras SIRE (formato PLE 8.1)
export function parseRegistroCompras(content: string, periodo: string): SIREComprobante[] {
  const comprobantes: SIREComprobante[] = [];
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const fields = line.split('|');
      if (fields.length < 42) continue;

      // Campos del Registro de Compras PLE 8.1
      const tipoDocumento = fields[5]?.trim();
      const serie = fields[6]?.trim() + (fields[7]?.trim() || '');
      const numero = fields[9]?.trim();
      const fechaEmision = formatFechaSIRE(fields[3]?.trim());
      const fechaVencimiento = fields[4]?.trim() ? formatFechaSIRE(fields[4].trim()) : null;
      const tipoDocTercero = fields[10]?.trim();
      const rucTercero = fields[11]?.trim();
      const razonSocialTercero = fields[12]?.trim();

      // Montos
      const baseImponible = parseFloat(fields[13] || '0') + parseFloat(fields[14] || '0');
      const igv = parseFloat(fields[15] || '0') + parseFloat(fields[16] || '0');
      const total = parseFloat(fields[25] || '0') || (baseImponible + igv);

      const moneda = fields[28]?.trim() || 'PEN';
      const tipoCambio = moneda !== 'PEN' ? parseFloat(fields[29] || '0') || null : null;

      if (!tipoDocumento || !serie || !numero || !fechaEmision) continue;

      comprobantes.push({
        periodo,
        tipoOperacion: 'COMPRA',
        tipoDocumento,
        serie: serie.substring(0, 4),
        numero,
        fechaEmision,
        fechaVencimiento,
        tipoDocTercero,
        rucTercero,
        razonSocialTercero,
        baseImponible: Math.abs(baseImponible),
        igv: Math.abs(igv),
        total: Math.abs(total),
        moneda,
        tipoCambio,
      });
    } catch (error) {
      console.error('Error parseando línea SIRE compras:', error);
      continue;
    }
  }

  return comprobantes;
}

// Función para formatear fecha SIRE (DD/MM/YYYY) a ISO (YYYY-MM-DD)
function formatFechaSIRE(fecha: string): string {
  if (!fecha) return '';

  // Si ya está en formato ISO
  if (fecha.includes('-')) {
    return fecha;
  }

  // Formato DD/MM/YYYY
  if (fecha.includes('/')) {
    const [day, month, year] = fecha.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Formato DDMMYYYY
  if (fecha.length === 8 && /^\d{8}$/.test(fecha)) {
    return `${fecha.slice(4, 8)}-${fecha.slice(2, 4)}-${fecha.slice(0, 2)}`;
  }

  return fecha;
}

// Detectar tipo de archivo SIRE
export function detectSIREFileType(content: string): 'ventas' | 'compras' | 'unknown' {
  const firstLine = content.split('\n')[0] || '';
  const fields = firstLine.split('|');

  // El primer campo suele indicar el tipo de libro
  // LE + RUC + Periodo + 140100 = Ventas
  // LE + RUC + Periodo + 080100 = Compras
  if (fields[0]) {
    const identifier = fields[0];
    if (identifier.includes('140100') || identifier.includes('1401')) {
      return 'ventas';
    }
    if (identifier.includes('080100') || identifier.includes('0801')) {
      return 'compras';
    }
  }

  // Detectar por número de campos
  if (fields.length >= 35 && fields.length < 42) {
    return 'ventas';
  }
  if (fields.length >= 42) {
    return 'compras';
  }

  return 'unknown';
}

// Función principal para parsear archivo SIRE
export function parseSIREFile(content: string, periodo: string): SIREComprobante[] {
  const fileType = detectSIREFileType(content);

  switch (fileType) {
    case 'ventas':
      return parseRegistroVentas(content, periodo);
    case 'compras':
      return parseRegistroCompras(content, periodo);
    default:
      // Intentar ambos parsers y combinar resultados
      const ventas = parseRegistroVentas(content, periodo);
      const compras = parseRegistroCompras(content, periodo);
      return [...ventas, ...compras];
  }
}

export default { parseRegistroVentas, parseRegistroCompras, parseSIREFile, detectSIREFileType };
