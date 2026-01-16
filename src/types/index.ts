// ==================== TIPOS BASE DE LA APLICACIÓN ====================

// Planes de usuario
export type Plan = 'FREE' | 'BASIC' | 'PRO';

// Regímenes tributarios
export type Regimen = 'NRUS' | 'RER' | 'MYPE' | 'GENERAL';

// Tipos de operación
export type TipoOperacion = 'VENTA' | 'COMPRA';

// Estados de comprobante
export type EstadoComprobante = 'ACTIVO' | 'ANULADO' | 'EMITIDO';

// Estados de declaración
export type EstadoDeclaracion = 'BORRADOR' | 'CALCULADA' | 'GENERADA' | 'PRESENTADA';

// Estados de upload
export type UploadStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// ==================== USUARIO ====================

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  isVerified: boolean;
  isSuperadmin: boolean;
  plan: Plan;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithCompanies extends User {
  companies: Company[];
}

// ==================== EMPRESA ====================

export interface Company {
  id: string;
  userId: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  regimen: Regimen;
  tipoContribuyente: string | null;
  direccionFiscal: string | null;
  ubigeo: string | null;
  telefono: string | null;
  email: string | null;
  coeficienteRenta: string;
  logoBase64: string | null;
  firmaDigitalBase64: string | null;
  huellaDigitalBase64: string | null;
  serieFactura: string;
  serieBoleta: string;
  ultimoNumeroFactura: number;
  ultimoNumeroBoleta: number;
  usuarioSol: string | null;
  hasCredentials: boolean;
  hasCertificado: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyWithUser extends Company {
  user: User;
}

// ==================== COMPROBANTE ====================

export interface ComprobanteItem {
  id: string;
  comprobanteId: string;
  numeroLinea: number;
  cantidad: number;
  unidadMedida: string;
  descripcion: string;
  codigoProducto: string | null;
  precioUnitario: number;
  valorVenta: number;
  descuento: number;
  igv: number;
  isc: number;
  otrosTributos: number;
  total: number;
  tipoAfectacionIgv: string | null;
}

export interface Comprobante {
  id: string;
  companyId: string;
  tipo: TipoOperacion;
  tipoDocumento: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  // Datos del emisor del XML
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  direccionEmisor: string | null;
  // Datos del receptor del XML
  tipoDocReceptor: string | null;
  numeroDocReceptor: string | null;
  razonSocialReceptor: string | null;
  // Tercero (legado)
  tipoDocTercero: string;
  rucTercero: string | null;
  razonSocialTercero: string | null;
  moneda: string;
  tipoCambio: number | null;
  baseImponible: number;
  igv: number;
  otrosTributos: number;
  total: number;
  esGravada: boolean;
  esExportacion: boolean;
  afectaIgv: boolean;
  periodo: string;
  estado: EstadoComprobante;
  // Facturación electrónica
  xmlFirmado: string | null;
  hashResumen: string | null;
  estadoSunat: string | null;
  codigoRespuestaSunat: string | null;
  mensajeRespuestaSunat: string | null;
  // Observaciones
  observaciones: string | null;
  // Referencias
  comprobanteRefTipo: string | null;
  comprobanteRefSerie: string | null;
  comprobanteRefNumero: string | null;
  // Items
  items?: ComprobanteItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ResumenComprobantes {
  periodo: string;
  totalVentas: number;
  totalCompras: number;
  ventasGravadas: number;
  ventasNoGravadas: number;
  exportaciones: number;
  igvVentas: number;
  comprasGravadas: number;
  comprasNoGravadas: number;
  igvCompras: number;
}

export interface PeriodoResumen {
  periodo: string;
  total: number;
  ventas: number;
  compras: number;
}

// ==================== DECLARACIÓN PDT 621 ====================

export interface DeclaracionPDT621 {
  id: string;
  companyId: string;
  periodo: string;
  estado: EstadoDeclaracion;
  ventasGravadas: number;
  ventasNoGravadas: number;
  exportaciones: number;
  descuentosVentas: number;
  otrasVentas: number;
  comprasGravadasDestGravadas: number;
  comprasGravadasDestMixtas: number;
  comprasNoGravadas: number;
  descuentosCompras: number;
  importaciones: number;
  debitoFiscal: number;
  creditoFiscal: number;
  saldoFavorAnterior: number;
  retenciones: number;
  percepciones: number;
  igvAPagar: number;
  saldoFavorPeriodo: number;
  ingresosNetos: number;
  coeficienteRenta: number;
  pagoCuentaRenta: number;
  saldoFavorRentaAnterior: number;
  totalDeuda: number;
  intereses: number;
  archivoGenerado: string | null;
  nombreArchivo: string | null;
  fechaVencimiento: string | null;
  fechaPresentacion: string | null;
  numeroOrden: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResultadoCalculo {
  baseImponibleVentas: number;
  debitoFiscal: number;
  totalComprasGravadas: number;
  creditoFiscal: number;
  igvResultante: number;
  igvAPagar: number;
  saldoFavorPeriodo: number;
  ingresosNetos: number;
  coeficiente: number;
  pagoCuentaRenta: number;
  totalDeuda: number;
  explicacion: string;
}

// ==================== TERCEROS ====================

export interface Tercero {
  id: string;
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccion: string | null;
  ubigeo: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  estado: string | null;
  condicion: string | null;
  esAgenteRetencion: boolean;
  esBuenContribuyente: boolean;
  fuente: string;
  createdAt: string;
  updatedAt: string;
}

export interface TerceroResponse {
  success: boolean;
  source: string;
  data: Tercero | null;
  error?: string;
}

// ==================== FACTURACIÓN ====================

export interface ItemFactura {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface FacturaEmitida {
  success: boolean;
  mensaje: string;
  codigoSunat: string | null;
  cdrBase64: string | null;
  comprobanteId: string | null;
  xmlEnviado: string | null;
  debugResponse: string | null;
}

// ==================== QR SUNAT ====================

export interface QRParsed {
  ruc: string;
  tipoDocumento: string;
  tipoNombre: string;
  serie: string;
  numero: string;
  igv: number;
  total: number;
  fecha: string;
  baseImponible: number;
}

// ==================== UPLOAD HISTORY ====================

export interface InvoiceUploadHistory {
  id: string;
  companyId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: UploadStatus;
  processedAt: string | null;
  errorMessage: string | null;
  tipoDocumento: string | null;
  serie: string | null;
  numero: string | null;
  createdAt: string;
}

// ==================== STORAGE ====================

export interface StorageUsage {
  id: string;
  companyId: string;
  logosSize: number;
  certificatesSize: number;
  generatedFilesSize: number;
  maxStorage: number;
  lastCalculated: string;
  usedPercentage: number;
  remainingBytes: number;
}

// ==================== AUTH ====================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

// ==================== API RESPONSES ====================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== CHAT ====================

export interface ChatMessage {
  mensaje: string;
  companyId?: string;
  contexto?: string;
}

export interface ChatResponse {
  respuesta: string;
  sugerencias: string[];
}

// ==================== ADMIN ====================

export interface AdminDashboard {
  totalUsers: number;
  totalCompanies: number;
  totalComprobantes: number;
  totalDeclaraciones: number;
  companiesByRegimen: Record<string, number>;
  declaracionesPendientes: number;
  aiProvider: string;
  aiConfigured: boolean;
}

export interface AdminUser extends User {
  totalCompanies: number;
}

export interface AdminCompany extends Company {
  userEmail: string;
  totalComprobantes: number;
  totalDeclaraciones: number;
}
