// Detector de códigos de barras usando Quagga2
// Versión simple y estable

import Quagga from '@ericblade/quagga2';

export interface BarcodeResult {
  rawValue: string;
  format: string;
  source?: 'barcode' | 'ocr';
}

// Detectar códigos de barras en un canvas usando Quagga2
async function detectWithQuagga(
  canvas: HTMLCanvasElement,
  patchSize: 'x-small' | 'small' | 'medium' | 'large' | 'x-large' = 'medium'
): Promise<BarcodeResult[]> {
  return new Promise((resolve) => {
    const results: BarcodeResult[] = [];
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    Quagga.decodeSingle(
      {
        src: dataUrl,
        numOfWorkers: 0,
        locate: true,
        inputStream: {
          size: Math.max(canvas.width, canvas.height),
        },
        decoder: {
          readers: [
            'code_128_reader',
            'code_39_reader',
            'ean_reader',
            'ean_8_reader',
            'i2of5_reader',
          ],
          multiple: false,
        },
        locator: {
          patchSize: patchSize,
          halfSample: false,
        },
      },
      (result) => {
        if (result && result.codeResult && result.codeResult.code) {
          results.push({
            rawValue: result.codeResult.code,
            format: result.codeResult.format || 'unknown',
            source: 'barcode',
          });
        }
        resolve(results);
      }
    );
  });
}

// Aplicar binarización (blanco y negro puro)
function applyBinarization(sourceCanvas: HTMLCanvasElement, threshold: number = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const binary = gray > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = binary;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Aplicar alto contraste
function applyHighContrast(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const contrast = 2.0;
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let newValue = factor * (gray - 128) + 128;
    newValue = Math.min(255, Math.max(0, newValue));
    data[i] = data[i + 1] = data[i + 2] = newValue;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Escalar imagen
function scaleImage(sourceCanvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  canvas.width = Math.round(sourceCanvas.width * scale);
  canvas.height = Math.round(sourceCanvas.height * scale);
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

  return canvas;
}

// Dividir imagen en regiones con overlap
function divideIntoRegions(
  sourceCanvas: HTMLCanvasElement,
  rows: number,
  cols: number
): HTMLCanvasElement[] {
  const regions: HTMLCanvasElement[] = [];
  const regionWidth = Math.floor(sourceCanvas.width / cols);
  const regionHeight = Math.floor(sourceCanvas.height / rows);
  const overlap = 50;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const x = Math.max(0, c * regionWidth - overlap);
      const y = Math.max(0, r * regionHeight - overlap);
      const w = Math.min(regionWidth + overlap * 2, sourceCanvas.width - x);
      const h = Math.min(regionHeight + overlap * 2, sourceCanvas.height - y);

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);

      regions.push(canvas);
    }
  }

  return regions;
}

// Detectar códigos de barras desde un dataURL
export async function detectBarcodesFromDataUrl(dataUrl: string): Promise<BarcodeResult[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve([]);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const allBarcodes: BarcodeResult[] = [];
        const seenValues = new Set<string>();

        const addBarcode = (bc: BarcodeResult) => {
          if (bc.rawValue && bc.rawValue.length > 0 && !seenValues.has(bc.rawValue)) {
            seenValues.add(bc.rawValue);
            allBarcodes.push(bc);
          }
        };

        const patchSizes: Array<'x-small' | 'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

        // Intento 1: Imagen original con diferentes patchSizes
        for (const ps of patchSizes) {
          (await detectWithQuagga(canvas, ps)).forEach(addBarcode);
        }

        // Intento 2: Imagen binarizada
        const binaryCanvas = applyBinarization(canvas, 140);
        for (const ps of patchSizes) {
          (await detectWithQuagga(binaryCanvas, ps)).forEach(addBarcode);
        }

        // Intento 3: Imagen con alto contraste
        const highContrastCanvas = applyHighContrast(canvas);
        for (const ps of patchSizes) {
          (await detectWithQuagga(highContrastCanvas, ps)).forEach(addBarcode);
        }

        // Intento 4: Imagen escalada 2x
        const scaled2x = scaleImage(canvas, 2);
        for (const ps of patchSizes) {
          (await detectWithQuagga(scaled2x, ps)).forEach(addBarcode);
        }

        // Intento 5: Regiones 2x2 con binarización
        const regions2x2 = divideIntoRegions(canvas, 2, 2);
        for (const region of regions2x2) {
          const binaryRegion = applyBinarization(region, 140);
          for (const ps of patchSizes) {
            (await detectWithQuagga(binaryRegion, ps)).forEach(addBarcode);
          }
        }

        // Intento 6: Regiones 3x3 con binarización
        const regions3x3 = divideIntoRegions(canvas, 3, 3);
        for (const region of regions3x3) {
          const binaryRegion = applyBinarization(region, 140);
          for (const ps of patchSizes) {
            (await detectWithQuagga(binaryRegion, ps)).forEach(addBarcode);
          }
        }

        // Intento 7: Regiones de imagen escalada
        const scaledRegions = divideIntoRegions(scaled2x, 3, 3);
        for (const region of scaledRegions) {
          const binaryRegion = applyBinarization(region, 140);
          (await detectWithQuagga(binaryRegion, 'medium')).forEach(addBarcode);
        }

        // Intento 8: Regiones 4x4
        const regions4x4 = divideIntoRegions(canvas, 4, 4);
        for (const region of regions4x4) {
          const binaryRegion = applyBinarization(region, 140);
          (await detectWithQuagga(binaryRegion, 'small')).forEach(addBarcode);
        }

        resolve(allBarcodes);
      } catch (error) {
        console.error('Error procesando imagen:', error);
        resolve([]);
      }
    };

    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}

// Verificar si el detector está disponible
export function isBarcodeDetectorSupported(): boolean {
  return true;
}

// Limpiar recursos (no se usa en esta versión pero mantenemos la interfaz)
export function cleanupDetector(): void {
  // No hay recursos que limpiar en esta versión
}
