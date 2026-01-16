import { z } from 'zod';

// ==================== AUTENTICACIÓN ====================

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
  fullName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(255, 'El nombre es muy largo')
    .optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Token requerido'),
});

// ==================== EMPRESAS ====================

export const companySchema = z.object({
  ruc: z
    .string()
    .length(11, 'El RUC debe tener 11 dígitos')
    .regex(/^\d{11}$/, 'El RUC solo debe contener números')
    .refine(
      (ruc) => ['10', '15', '17', '20'].includes(ruc.slice(0, 2)),
      'RUC inválido: debe empezar con 10, 15, 17 o 20'
    ),
  razonSocial: z
    .string()
    .min(1, 'La razón social es requerida')
    .max(255, 'La razón social es muy larga'),
  nombreComercial: z.string().max(255).optional().nullable(),
  regimen: z.enum(['NRUS', 'RER', 'MYPE', 'GENERAL'], {
    errorMap: () => ({ message: 'Régimen inválido' }),
  }),
  tipoContribuyente: z.string().max(50).optional().nullable(),
  direccionFiscal: z.string().optional().nullable(),
  ubigeo: z.string().length(6).optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  coeficienteRenta: z.string().default('0.0150'),
});

export const companyUpdateSchema = companySchema.partial();

export const sunatCredentialsSchema = z.object({
  usuarioSol: z.string().min(1, 'Usuario SOL requerido'),
  claveSol: z.string().min(1, 'Clave SOL requerida'),
});

export const certificadoSchema = z.object({
  certificadoBase64: z.string().min(1, 'Certificado requerido'),
  password: z.string().min(1, 'Contraseña del certificado requerida'),
});

// ==================== COMPROBANTES ====================

export const comprobanteSchema = z.object({
  tipo: z.enum(['VENTA', 'COMPRA'], {
    errorMap: () => ({ message: 'Tipo debe ser VENTA o COMPRA' }),
  }),
  tipoDocumento: z
    .string()
    .length(2, 'Tipo de documento debe tener 2 caracteres'),
  serie: z
    .string()
    .length(4, 'Serie debe tener 4 caracteres'),
  numero: z
    .string()
    .max(8, 'Número no puede exceder 8 caracteres'),
  fechaEmision: z.coerce.date(),
  fechaVencimiento: z.coerce.date().optional().nullable(),
  tipoDocTercero: z.string().length(1).default('6'),
  rucTercero: z.string().max(15).optional().nullable(),
  razonSocialTercero: z.string().max(255).optional().nullable(),
  moneda: z.string().length(3).default('PEN'),
  tipoCambio: z.coerce.number().positive().optional().nullable(),
  baseImponible: z.coerce.number().min(0, 'Base imponible no puede ser negativa'),
  igv: z.coerce.number().min(0, 'IGV no puede ser negativo'),
  otrosTributos: z.coerce.number().min(0).default(0),
  total: z.coerce.number().positive('Total debe ser mayor a 0'),
  esGravada: z.boolean().default(true),
  esExportacion: z.boolean().default(false),
  afectaIgv: z.boolean().default(true),
  periodo: z
    .string()
    .length(6, 'Período debe tener formato YYYYMM')
    .regex(/^\d{6}$/, 'Período inválido'),
  comprobanteRefTipo: z.string().length(2).optional().nullable(),
  comprobanteRefSerie: z.string().length(4).optional().nullable(),
  comprobanteRefNumero: z.string().max(8).optional().nullable(),
});

export const comprobanteUpdateSchema = comprobanteSchema.partial();

// ==================== DECLARACIÓN PDT 621 ====================

export const declaracionIniciarSchema = z.object({
  periodo: z
    .string()
    .length(6, 'Período debe tener formato YYYYMM')
    .regex(/^\d{6}$/, 'Período inválido'),
});

export const declaracionUpdateSchema = z.object({
  saldoFavorAnterior: z.coerce.number().min(0).optional(),
  retenciones: z.coerce.number().min(0).optional(),
  percepciones: z.coerce.number().min(0).optional(),
  saldoFavorRentaAnterior: z.coerce.number().min(0).optional(),
});

// ==================== TERCEROS ====================

export const terceroSchema = z.object({
  tipoDocumento: z.string().length(1),
  numeroDocumento: z.string().min(8).max(20),
  razonSocial: z.string().min(1).max(500),
  direccion: z.string().optional().nullable(),
});

// ==================== FACTURACIÓN ====================

export const itemFacturaSchema = z.object({
  descripcion: z.string().min(1, 'Descripción requerida'),
  cantidad: z.coerce.number().positive('Cantidad debe ser mayor a 0'),
  precioUnitario: z.coerce.number().positive('Precio debe ser mayor a 0'),
  subtotal: z.coerce.number().min(0),
});

export const emitirComprobanteSchema = z.object({
  tipoDocumento: z.enum(['01', '03'], {
    errorMap: () => ({ message: 'Solo se puede emitir Factura (01) o Boleta (03)' }),
  }),
  serie: z.string().length(4),
  numero: z.string().max(8).optional(),
  fechaEmision: z.string(),
  tipoDocCliente: z.string().length(1),
  numDocCliente: z.string().min(8).max(15),
  razonSocialCliente: z.string().min(1),
  direccionCliente: z.string().optional(),
  items: z.array(itemFacturaSchema).min(1, 'Debe incluir al menos un item'),
  moneda: z.string().length(3).default('PEN'),
  observaciones: z.string().optional(),
  usarProduccion: z.boolean().default(false),
});

// ==================== QR SUNAT ====================

export const qrParseSchema = z.object({
  qrData: z.string().min(1, 'Datos del QR requeridos'),
});

export const qrImportarSchema = z.object({
  qrData: z.string().min(1, 'Datos del QR requeridos'),
  tipoOperacion: z.enum(['VENTA', 'COMPRA']),
});

// ==================== TIPOS DE VALIDACIÓN ====================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
export type SunatCredentialsInput = z.infer<typeof sunatCredentialsSchema>;
export type CertificadoInput = z.infer<typeof certificadoSchema>;
export type ComprobanteInput = z.infer<typeof comprobanteSchema>;
export type ComprobanteUpdateInput = z.infer<typeof comprobanteUpdateSchema>;
export type DeclaracionIniciarInput = z.infer<typeof declaracionIniciarSchema>;
export type DeclaracionUpdateInput = z.infer<typeof declaracionUpdateSchema>;
export type TerceroInput = z.infer<typeof terceroSchema>;
export type ItemFacturaInput = z.infer<typeof itemFacturaSchema>;
export type EmitirComprobanteInput = z.infer<typeof emitirComprobanteSchema>;
export type QRParseInput = z.infer<typeof qrParseSchema>;
export type QRImportarInput = z.infer<typeof qrImportarSchema>;
