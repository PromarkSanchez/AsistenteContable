import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind de forma inteligente
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como moneda peruana
 */
export function formatCurrency(amount: number, currency: string = 'PEN'): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formatea una fecha en formato peruano (DD/MM/YYYY)
 * IMPORTANTE: Extrae la fecha directamente del string ISO sin conversión de timezone
 * para preservar la fecha original del documento (ej: factura)
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const dateStr = typeof date === 'string' ? date : date.toISOString();

  // Extraer solo la parte de la fecha (YYYY-MM-DD) sin conversión de timezone
  const datePart = dateStr.split('T')[0]; // "2026-01-14"

  if (datePart && datePart.includes('-')) {
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`; // Formato DD/MM/YYYY
  }

  // Fallback si el formato es diferente
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Formatea un período tributario (YYYYMM) a texto legible
 */
export function formatPeriodo(periodo: string): string {
  if (periodo.length !== 6) return periodo;
  const year = periodo.slice(0, 4);
  const month = periodo.slice(4, 6);
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

/**
 * Obtiene el período actual en formato YYYYMM
 */
export function getCurrentPeriodo(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

/**
 * Valida un RUC peruano
 */
export function validateRUC(ruc: string): boolean {
  if (!ruc || ruc.length !== 11) return false;
  if (!/^\d{11}$/.test(ruc)) return false;

  // Prefijos válidos: 10 (persona natural), 15 (sociedad no domiciliada),
  // 17 (no domiciliado), 20 (persona jurídica)
  const prefix = ruc.slice(0, 2);
  if (!['10', '15', '17', '20'].includes(prefix)) return false;

  return true;
}

/**
 * Valida un DNI peruano
 */
export function validateDNI(dni: string): boolean {
  if (!dni || dni.length !== 8) return false;
  return /^\d{8}$/.test(dni);
}

/**
 * Nombres de tipos de documento
 */
export const TIPO_DOCUMENTO_NOMBRES: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta de Venta',
  '07': 'Nota de Crédito',
  '08': 'Nota de Débito',
  '02': 'Recibo por Honorarios',
  '04': 'Liquidación de compra',
  '12': 'Ticket o cinta emitido por máquina registradora',
};

/**
 * Nombres de tipos de documento de identidad
 */
export const TIPO_DOC_IDENTIDAD_NOMBRES: Record<string, string> = {
  '0': 'No domiciliado',
  '1': 'DNI',
  '4': 'Carnet de Extranjería',
  '6': 'RUC',
  '7': 'Pasaporte',
  'A': 'Cédula Diplomática',
};

/**
 * Nombres de regímenes tributarios
 */
export const REGIMEN_NOMBRES: Record<string, string> = {
  NRUS: 'Nuevo RUS',
  RER: 'Régimen Especial de Renta',
  MYPE: 'Régimen MYPE Tributario',
  GENERAL: 'Régimen General',
};

/**
 * Límites de empresas por plan
 */
export const PLAN_LIMITS = {
  FREE: 1,
  BASIC: 3,
  PRO: 999,
};

/**
 * Genera un número de comprobante formateado
 */
export function formatNumeroComprobante(numero: number | string, length: number = 8): string {
  return String(numero).padStart(length, '0');
}

/**
 * Delay para testing y simulación
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calcula el tamaño de un string en bytes
 */
export function getStringSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * Formatea bytes a formato legible
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
