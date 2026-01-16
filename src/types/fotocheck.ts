// Tipos para el módulo de generación de fotochecks

export interface PersonaFotocheck {
  id: string;
  apellidos: string;
  nombres: string;
  dni: string;
  cargo: string;
  sede: string;
  fotoBase64: string;
  fotoNombre?: string;
}

export interface FotocheckConfig {
  // Dimensiones del canvas (basadas en plantilla)
  width: number;
  height: number;

  // Posición y tamaño de la foto
  fotoX: number;
  fotoY: number;
  fotoWidth: number;
  fotoHeight: number;
  fotoCircular: boolean;
  fotoBorderRadius: number; // Radio de esquinas (0 = sin redondeo)

  // Posición de Apellidos
  apellidosX: number;
  apellidosY: number;
  apellidosFontSize: number;
  apellidosColor: string;
  apellidosFont: string;
  apellidosBold: boolean;

  // Posición de Nombres
  nombresX: number;
  nombresY: number;
  nombresFontSize: number;
  nombresColor: string;
  nombresFont: string;
  nombresBold: boolean;

  // Posición de DNI
  dniX: number;
  dniY: number;
  dniFontSize: number;
  dniColor: string;
  dniFont: string;
  dniBold: boolean;

  // Posición de Cargo
  cargoX: number;
  cargoY: number;
  cargoFontSize: number;
  cargoColor: string;
  cargoFont: string;
  cargoBold: boolean;

  // Posición de Sede
  sedeX: number;
  sedeY: number;
  sedeFontSize: number;
  sedeColor: string;
  sedeFont: string;
  sedeBold: boolean;

  // Estilos generales
  fontFamily: string; // Fuente por defecto (fallback)
  textColor: string; // Color por defecto (fallback)
  textAlign: CanvasTextAlign;
}

export const DEFAULT_FOTOCHECK_CONFIG: FotocheckConfig = {
  width: 384,
  height: 611,

  // Foto centrada arriba
  fotoX: 108,
  fotoY: 95,
  fotoWidth: 168,
  fotoHeight: 198,
  fotoCircular: false,
  fotoBorderRadius: 14,

  // Textos centrados debajo de la foto
  apellidosX: 198,
  apellidosY: 327,
  apellidosFontSize: 24,
  apellidosColor: '#9fc360',
  apellidosFont: 'Arial',
  apellidosBold: true,

  nombresX: 209,
  nombresY: 381,
  nombresFontSize: 41,
  nombresColor: '#49a53c',
  nombresFont: 'Arial',
  nombresBold: true,

  dniX: 198,
  dniY: 431,
  dniFontSize: 28,
  dniColor: '#9bc15d',
  dniFont: 'Arial',
  dniBold: true,

  cargoX: 196,
  cargoY: 483,
  cargoFontSize: 36,
  cargoColor: '#274594',
  cargoFont: 'Lato Black',
  cargoBold: true,

  sedeX: 202,
  sedeY: 545,
  sedeFontSize: 24,
  sedeColor: '#3d4e8a',
  sedeFont: 'FuturaBT Bold',
  sedeBold: true,

  fontFamily: 'Arial',
  textColor: '#000000',
  textAlign: 'center',
};

export type FotocheckStep = 'plantilla' | 'configuracion' | 'datos' | 'preview';

export interface FotocheckState {
  step: FotocheckStep;
  plantillaBase64: string | null;
  config: FotocheckConfig;
  personas: PersonaFotocheck[];
  isProcessing: boolean;
  progress: number;
  error: string | null;
}
