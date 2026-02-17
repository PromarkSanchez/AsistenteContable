// Utilidades para clasificación y procesamiento de códigos de barras

import type { CodigoDetectado } from '@/types/image-rename';

/**
 * Clasifica un código de barras según su longitud
 * - 8 dígitos: código del año actual (ej: 25102474)
 * - 12 dígitos: código patrimonial (ej: 746505928974 o 74.65.0592.8974)
 * - otros: cualquier otro código
 */
export function clasificarCodigo(codigo: string): CodigoDetectado {
  // Limpiar espacios
  let limpio = codigo.trim().replace(/\s+/g, '');

  // Verificar si es código patrimonial con puntos (formato: XX.XX.XXXX.XXXX)
  const patrimonialConPuntos = /^\d{2}\.\d{2}\.\d{4}\.\d{4}$/.test(limpio);
  if (patrimonialConPuntos) {
    const sinPuntos = limpio.replace(/\./g, '');
    return { valor: sinPuntos, tipo: 'patrimonial', longitud: 12 };
  }

  // Quitar puntos para análisis
  const sinPuntos = limpio.replace(/\./g, '');

  // Código de 8 dígitos (año actual)
  if (sinPuntos.length === 8 && /^\d{8}$/.test(sinPuntos)) {
    return { valor: sinPuntos, tipo: 'anio', longitud: 8 };
  }

  // Código patrimonial de 12 dígitos
  if (sinPuntos.length === 12 && /^\d{12}$/.test(sinPuntos)) {
    return { valor: sinPuntos, tipo: 'patrimonial', longitud: 12 };
  }

  // Otros códigos numéricos
  if (/^\d+$/.test(sinPuntos)) {
    return { valor: sinPuntos, tipo: 'otro', longitud: sinPuntos.length };
  }

  // Otros códigos (mantener original)
  return { valor: limpio, tipo: 'otro', longitud: limpio.length };
}

/**
 * Genera el nombre de archivo basado en los códigos detectados
 * Formato: [códigos-8-dígitos]_[códigos-12-dígitos]_[otros].extensión
 * Los códigos se ordenan de MAYOR a MENOR (numéricamente) dentro de cada grupo
 * Separador entre grupos: guión bajo (_)
 * Separador entre códigos del mismo grupo: guión (-)
 */
export function generarNombreArchivo(
  codigos: CodigoDetectado[],
  extensionOriginal: string = 'jpg'
): string {
  // Separar códigos por tipo y ordenar numéricamente de mayor a menor
  const codigosAnio = codigos
    .filter(c => c.tipo === 'anio')
    .sort((a, b) => {
      const numA = parseInt(a.valor, 10) || 0;
      const numB = parseInt(b.valor, 10) || 0;
      return numB - numA; // Mayor primero
    });

  const codigosPatrimonial = codigos
    .filter(c => c.tipo === 'patrimonial')
    .sort((a, b) => {
      const numA = parseInt(a.valor, 10) || 0;
      const numB = parseInt(b.valor, 10) || 0;
      return numB - numA; // Mayor primero
    });

  const codigosOtros = codigos
    .filter(c => c.tipo === 'otro')
    .sort((a, b) => {
      const numA = parseInt(a.valor, 10) || 0;
      const numB = parseInt(b.valor, 10) || 0;
      return numB - numA; // Mayor primero
    });

  const partes: string[] = [];

  // Primero los códigos de 8 dígitos (año actual) - mayor primero
  if (codigosAnio.length > 0) {
    partes.push(codigosAnio.map(c => c.valor).join('-'));
  }

  // Luego los códigos patrimoniales de 12 dígitos
  if (codigosPatrimonial.length > 0) {
    partes.push(codigosPatrimonial.map(c => c.valor).join('-'));
  }

  // Finalmente otros códigos
  if (codigosOtros.length > 0) {
    partes.push(codigosOtros.map(c => c.valor).join('-'));
  }

  // Si no hay códigos, devolver nombre genérico
  if (partes.length === 0) {
    return `sin_codigo_${Date.now()}.${extensionOriginal}`;
  }

  // Limpiar la extensión
  const ext = extensionOriginal.toLowerCase().replace(/^\./, '');

  // Unir grupos con guión bajo
  return `${partes.join('_')}.${ext}`;
}

/**
 * Obtiene la extensión de un nombre de archivo
 */
export function getExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return 'jpg';
}

/**
 * Verifica si un archivo es una imagen válida
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type.toLowerCase());
}

/**
 * Verifica si un archivo es un ZIP
 */
export function isZipFile(file: File): boolean {
  return file.type === 'application/zip' ||
         file.type === 'application/x-zip-compressed' ||
         file.name.toLowerCase().endsWith('.zip');
}

/**
 * Genera un ID único
 */
export function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convierte un File a DataURL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convierte un DataURL a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Preprocesa una imagen para mejorar la detección de códigos de barras
 * Aplica escala de grises, aumento de contraste y umbralizado
 */
export function preprocessImageForBarcode(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('No se pudo crear contexto 2D'));
        return;
      }

      // Escalar si es muy pequeña
      let width = img.width;
      let height = img.height;
      const minDimension = Math.min(width, height);

      if (minDimension < 500) {
        const scale = 500 / minDimension;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Obtener datos de imagen
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Parámetros de contraste
      const contrast = 1.4;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      for (let i = 0; i < data.length; i += 4) {
        // Convertir a escala de grises
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Aplicar contraste
        let newValue = factor * (gray - 128) + 128;
        newValue = Math.max(0, Math.min(255, newValue));

        // Umbralizado suave para mejorar códigos de barras
        if (newValue < 128) {
          newValue = newValue * 0.4;
        } else {
          newValue = 128 + (newValue - 128) * 1.6;
        }

        newValue = Math.max(0, Math.min(255, newValue));
        data[i] = data[i + 1] = data[i + 2] = newValue;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png', 1.0));
    };

    img.onerror = () => reject(new Error('Error al cargar imagen'));
    img.src = dataUrl;
  });
}

/**
 * Divide una imagen en cuadrantes para escaneo múltiple
 */
export function divideImageIntoQuadrants(
  dataUrl: string,
  gridSize: number = 3
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const quadrants: string[] = [];
      const quadrantWidth = Math.floor(img.width / gridSize);
      const quadrantHeight = Math.floor(img.height / gridSize);

      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) continue;

          // Hacer el cuadrante un poco más grande para capturar códigos en los bordes
          const overlap = 20;
          const x = Math.max(0, col * quadrantWidth - overlap);
          const y = Math.max(0, row * quadrantHeight - overlap);
          const w = Math.min(quadrantWidth + overlap * 2, img.width - x);
          const h = Math.min(quadrantHeight + overlap * 2, img.height - y);

          canvas.width = w;
          canvas.height = h;

          ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
          quadrants.push(canvas.toDataURL('image/png'));
        }
      }

      resolve(quadrants);
    };

    img.onerror = () => reject(new Error('Error al dividir imagen'));
    img.src = dataUrl;
  });
}
