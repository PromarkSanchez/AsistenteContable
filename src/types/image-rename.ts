// Tipos para la funcionalidad de renombrar imágenes con códigos de barras

export interface ImageFile {
  id: string;
  name: string;
  file: File;
  dataUrl: string;
}

export interface CodigoDetectado {
  valor: string;
  tipo: 'anio' | 'patrimonial' | 'otro';
  longitud: number;
}

export interface ImagenProcesada {
  id: string;
  originalName: string;
  originalFile: File;
  dataUrl: string;
  codigosDetectados: CodigoDetectado[];
  nombreSugerido: string;
  nombreFinal: string;
  status: 'pending' | 'processing' | 'done' | 'error' | 'no_codes';
  errorMessage?: string;
}

export interface RenombrarState {
  step: 'upload' | 'processing' | 'preview' | 'downloading' | 'complete';
  images: ImagenProcesada[];
  totalImages: number;
  processedCount: number;
  errorCount: number;
  isProcessing: boolean;
  globalError: string | null;
}

export interface BarcodeConfig {
  enableQuadrantScan: boolean;
  quadrantSize: number; // 3 = 3x3, 4 = 4x4
  enableImageEnhancement: boolean;
  scanTimeout: number; // ms
}

export const DEFAULT_BARCODE_CONFIG: BarcodeConfig = {
  enableQuadrantScan: true,
  quadrantSize: 3,
  enableImageEnhancement: true,
  scanTimeout: 5000,
};
