'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Upload,
  Camera,
  FileArchive,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle,
  X,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Edit3,
  Scan,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Move,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImagenProcesada, CodigoDetectado } from '@/types/image-rename';
import {
  clasificarCodigo,
  generarNombreArchivo,
  getExtension,
  isValidImageFile,
  isZipFile,
  generateId,
  fileToDataUrl,
  dataUrlToBlob,
} from '@/lib/barcode-utils';
import {
  isBarcodeDetectorSupported,
  detectBarcodesFromDataUrl,
  cleanupDetector,
} from '@/lib/barcode-detector';

type Step = 'upload' | 'processing' | 'preview' | 'downloading';

export default function RenombrarImagenesPage() {
  const [step, setStep] = useState<Step>('upload');
  const [images, setImages] = useState<ImagenProcesada[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detectorSupported, setDetectorSupported] = useState<boolean | null>(null);

  // Estado del previsualizador
  const [previewImage, setPreviewImage] = useState<ImagenProcesada | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [previewDragStart, setPreviewDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Verificar soporte de BarcodeDetector al montar
  useEffect(() => {
    setDetectorSupported(isBarcodeDetectorSupported());
  }, []);

  // Cerrar previsualizador con ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!previewImage) return;
      if (e.key === 'Escape') {
        setPreviewImage(null);
        setPreviewZoom(1);
      } else if (e.key === 'ArrowLeft') {
        navigatePreview(-1);
      } else if (e.key === 'ArrowRight') {
        navigatePreview(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, images]);

  // Navegación en el previsualizador
  const navigatePreview = useCallback((direction: -1 | 1) => {
    if (!previewImage) return;
    const currentIndex = images.findIndex(img => img.id === previewImage.id);
    if (currentIndex === -1) return;
    const newIndex = (currentIndex + direction + images.length) % images.length;
    setPreviewImage(images[newIndex]);
    setPreviewZoom(1);
  }, [previewImage, images]);

  // Abrir previsualizador
  const openPreview = useCallback((img: ImagenProcesada) => {
    setPreviewImage(img);
    setPreviewZoom(1);
    setPreviewRotation(0);
    setPreviewPosition({ x: 0, y: 0 });
  }, []);

  // Cerrar previsualizador
  const closePreview = useCallback(() => {
    setPreviewImage(null);
    setPreviewZoom(1);
    setPreviewRotation(0);
    setPreviewPosition({ x: 0, y: 0 });
  }, []);

  // Rotar imagen
  const rotatePreview = useCallback((degrees: number) => {
    setPreviewRotation(prev => (prev + degrees + 360) % 360);
  }, []);

  // Resetear vista
  const resetPreviewView = useCallback(() => {
    setPreviewZoom(1);
    setPreviewRotation(0);
    setPreviewPosition({ x: 0, y: 0 });
  }, []);

  // Handlers para arrastrar imagen en preview
  const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
    if (previewZoom > 1) {
      setIsPreviewDragging(true);
      setPreviewDragStart({ x: e.clientX - previewPosition.x, y: e.clientY - previewPosition.y });
    }
  }, [previewZoom, previewPosition]);

  const handlePreviewMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPreviewDragging) {
      setPreviewPosition({
        x: e.clientX - previewDragStart.x,
        y: e.clientY - previewDragStart.y,
      });
    }
  }, [isPreviewDragging, previewDragStart]);

  const handlePreviewMouseUp = useCallback(() => {
    setIsPreviewDragging(false);
  }, []);

  // Escanear códigos de barras en una imagen usando API nativa
  const scanBarcodesInImage = useCallback(async (dataUrl: string): Promise<string[]> => {
    try {
      const barcodes = await detectBarcodesFromDataUrl(dataUrl);
      return barcodes.map(bc => bc.rawValue);
    } catch (err) {
      console.error('Error en escaneo:', err);
      return [];
    }
  }, []);

  // Procesar una imagen
  const processImage = useCallback(async (
    file: File,
    dataUrl: string
  ): Promise<ImagenProcesada> => {
    const id = generateId();
    const extension = getExtension(file.name);

    try {
      const codigosRaw = await scanBarcodesInImage(dataUrl);
      const codigosDetectados = codigosRaw.map(clasificarCodigo);

      if (codigosDetectados.length === 0) {
        return {
          id,
          originalName: file.name,
          originalFile: file,
          dataUrl,
          codigosDetectados: [],
          nombreSugerido: file.name,
          nombreFinal: file.name,
          status: 'no_codes',
          errorMessage: 'No se detectaron códigos de barras',
        };
      }

      const nombreSugerido = generarNombreArchivo(codigosDetectados, extension);

      return {
        id,
        originalName: file.name,
        originalFile: file,
        dataUrl,
        codigosDetectados,
        nombreSugerido,
        nombreFinal: nombreSugerido,
        status: 'done',
      };
    } catch (err) {
      return {
        id,
        originalName: file.name,
        originalFile: file,
        dataUrl,
        codigosDetectados: [],
        nombreSugerido: file.name,
        nombreFinal: file.name,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Error desconocido',
      };
    }
  }, [scanBarcodesInImage]);

  // Rotar imagen y reprocesar (para uso desde la lista)
  const rotateAndReprocess = useCallback(async (id: string, degrees: number) => {
    const image = images.find(img => img.id === id);
    if (!image) return;

    // Marcar como procesando
    setImages(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'processing' as const } : i
    ));

    // Crear canvas con la imagen rotada
    const img = new Image();
    img.src = image.dataUrl;

    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calcular dimensiones rotadas
    const radians = (degrees * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const newWidth = img.width * cos + img.height * sin;
    const newHeight = img.width * sin + img.height * cos;

    canvas.width = newWidth;
    canvas.height = newHeight;

    // Rotar y dibujar
    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(radians);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Reprocesar con la imagen rotada
    const processed = await processImage(image.originalFile, rotatedDataUrl);
    setImages(prev => prev.map(i =>
      i.id === id ? { ...processed, id, dataUrl: rotatedDataUrl } : i
    ));
  }, [images, processImage]);

  // Re-analizar imagen con rotación aplicada (desde el previsualizador)
  const reanalyzeWithRotation = useCallback(async () => {
    if (!previewImage) return;

    // Crear canvas con la imagen rotada
    const img = new Image();
    img.src = previewImage.dataUrl;

    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calcular dimensiones rotadas
    const radians = (previewRotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const newWidth = img.width * cos + img.height * sin;
    const newHeight = img.width * sin + img.height * cos;

    canvas.width = newWidth;
    canvas.height = newHeight;

    // Rotar y dibujar
    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(radians);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Actualizar imagen con el nuevo dataUrl y reprocesar
    setImages(prev => prev.map(i =>
      i.id === previewImage.id ? { ...i, status: 'processing' as const, dataUrl: rotatedDataUrl } : i
    ));

    // Cerrar preview
    closePreview();

    // Reprocesar
    const processed = await processImage(previewImage.originalFile, rotatedDataUrl);
    setImages(prev => prev.map(i =>
      i.id === previewImage.id ? { ...processed, id: previewImage.id, dataUrl: rotatedDataUrl } : i
    ));
  }, [previewImage, previewRotation, closePreview, processImage]);

  // Límites
  const MAX_IMAGES = 100;
  const MAX_TOTAL_SIZE_MB = 150;

  // Manejar archivos cargados
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imagesToProcess: { file: File; dataUrl: string }[] = [];
    let totalSize = 0;

    setError(null);
    setStep('processing');
    setIsProcessing(true);
    setProcessedCount(0);
    setTotalToProcess(0);

    try {
      // Fase 1: Extraer archivos (rápido)
      for (const file of fileArray) {
        if (isZipFile(file)) {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.entries(zip.files);

          for (const [filename, zipFile] of entries) {
            if (!zipFile.dir && /\.(jpg|jpeg|png|webp)$/i.test(filename)) {
              // Verificar límite de imágenes
              if (imagesToProcess.length >= MAX_IMAGES) {
                setError(`Límite alcanzado: máximo ${MAX_IMAGES} imágenes permitidas.`);
                break;
              }
              try {
                const blob = await zipFile.async('blob');
                totalSize += blob.size;
                // Verificar límite de tamaño
                if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
                  setError(`Límite alcanzado: máximo ${MAX_TOTAL_SIZE_MB}MB en total.`);
                  break;
                }
                const imageFile = new File([blob], filename, { type: 'image/jpeg' });
                const dataUrl = await fileToDataUrl(imageFile);
                imagesToProcess.push({ file: imageFile, dataUrl });
              } catch {
                console.error(`Error extrayendo ${filename}`);
              }
            }
          }
        } else if (isValidImageFile(file)) {
          // Verificar límite de imágenes
          if (imagesToProcess.length >= MAX_IMAGES) {
            setError(`Límite alcanzado: máximo ${MAX_IMAGES} imágenes permitidas.`);
            break;
          }
          totalSize += file.size;
          // Verificar límite de tamaño
          if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
            setError(`Límite alcanzado: máximo ${MAX_TOTAL_SIZE_MB}MB en total.`);
            break;
          }
          const dataUrl = await fileToDataUrl(file);
          imagesToProcess.push({ file, dataUrl });
        }
      }

      if (imagesToProcess.length === 0) {
        setError('No se encontraron imágenes válidas. Sube archivos JPG, PNG o un ZIP con imágenes.');
        setStep('upload');
        setIsProcessing(false);
        return;
      }

      setTotalToProcess(imagesToProcess.length);

      // Fase 2: Procesar imágenes en lotes paralelos (más rápido con batch más grande)
      const processedImages: ImagenProcesada[] = [];
      const batchSize = 5; // Aumentado para mayor paralelismo

      for (let i = 0; i < imagesToProcess.length; i += batchSize) {
        const batch = imagesToProcess.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(({ file, dataUrl }) => processImage(file, dataUrl))
        );
        processedImages.push(...results);
        setProcessedCount(processedImages.length);
      }

      setImages(processedImages);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar archivos');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  }, [processImage]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // Manejar cambio de input file
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  // Capturar foto con cámara
  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  // Actualizar nombre final de una imagen
  const updateNombreFinal = useCallback((id: string, nuevoNombre: string) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, nombreFinal: nuevoNombre } : img
    ));
    setEditingId(null);
  }, []);

  // Eliminar imagen de la lista
  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  // Reprocesar una imagen
  const reprocessImage = useCallback(async (id: string) => {
    const image = images.find(img => img.id === id);
    if (!image) return;

    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, status: 'processing' } : img
    ));

    const processed = await processImage(image.originalFile, image.dataUrl);
    setImages(prev => prev.map(img =>
      img.id === id ? { ...processed, id } : img
    ));
  }, [images, processImage]);

  // Generar y descargar ZIP
  const downloadZip = useCallback(async () => {
    setStep('downloading');

    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();

      for (const img of images) {
        let nombre = img.nombreFinal;

        // Evitar nombres duplicados
        if (usedNames.has(nombre)) {
          const ext = getExtension(nombre);
          const base = nombre.replace(`.${ext}`, '');
          let counter = 1;
          while (usedNames.has(`${base}_${counter}.${ext}`)) {
            counter++;
          }
          nombre = `${base}_${counter}.${ext}`;
        }
        usedNames.add(nombre);

        const blob = dataUrlToBlob(img.dataUrl);
        zip.file(nombre, blob);
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // Descargar
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `imagenes_renombradas_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStep('preview');
    } catch (err) {
      setError('Error al generar el archivo ZIP');
      setStep('preview');
    }
  }, [images]);

  // Reiniciar
  const reset = useCallback(() => {
    setImages([]);
    setStep('upload');
    setError(null);
    setProcessedCount(0);
    setTotalToProcess(0);
    setPreviewImage(null);
    setPreviewZoom(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      cleanupDetector();
    };
  }, []);

  // Estadísticas
  const stats = {
    total: images.length,
    conCodigos: images.filter(i => i.status === 'done').length,
    sinCodigos: images.filter(i => i.status === 'no_codes').length,
    errores: images.filter(i => i.status === 'error').length,
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Scan className="w-6 h-6 text-primary-600" />
            Renombrar Imágenes
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Detecta códigos de barras y renombra imágenes automáticamente
          </p>
        </div>
        {step !== 'upload' && (
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Nueva sesión
          </Button>
        )}
      </div>

      {/* Error global */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Advertencia de compatibilidad */}
      {detectorSupported === false && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Navegador no compatible</p>
            <p className="text-sm mt-1">
              Tu navegador no soporta la API de detección de códigos de barras.
              Para mejor compatibilidad, usa <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong> en su última versión.
            </p>
          </div>
        </div>
      )}

      {/* Paso 1: Carga de archivos */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Cargar Imágenes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Zona de drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                isDragging
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                Arrastra imágenes aquí o haz clic para seleccionar
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                JPG, PNG o archivo ZIP con imágenes
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.zip"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Botones alternativos */}
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                Tomar Foto
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileArchive className="w-4 h-4 mr-2" />
                Subir ZIP
              </Button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              className="hidden"
            />

            {/* Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                Formato de renombrado:
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">
                  [8-dígitos]_[12-dígitos]_[otros].jpg
                </code>
              </p>
              <ul className="text-sm text-blue-600 dark:text-blue-400 mt-3 space-y-1">
                <li>• <strong>8 dígitos:</strong> Código del año (mayor primero)</li>
                <li>• <strong>12 dígitos:</strong> Código patrimonial</li>
                <li>• Separador entre grupos: guión bajo (_)</li>
                <li>• Haz clic en la miniatura para ver la imagen completa</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                <p className="text-xs text-blue-500 dark:text-blue-400">
                  <strong>Límites:</strong> Máx. 100 imágenes o 150MB total.
                  Procesamiento 100% local, las imágenes no se suben al servidor.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Procesando */}
      {step === 'processing' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {totalToProcess === 0 ? 'Extrayendo archivos...' : 'Detectando códigos de barras...'}
            </p>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {totalToProcess > 0 ? `${processedCount} de ${totalToProcess} imágenes` : 'Preparando...'}
            </p>
            <div className="w-64 mx-auto mt-4 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: totalToProcess > 0 ? `${(processedCount / totalToProcess) * 100}%` : '10%' }}
              />
            </div>
            {totalToProcess > 0 && (
              <p className="text-xs text-gray-400 mt-3">
                {Math.round((processedCount / totalToProcess) * 100)}% completado
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Paso 3: Preview */}
      {step === 'preview' && images.length > 0 && (
        <>
          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                <p className="text-sm text-gray-500">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.conCodigos}</p>
                <p className="text-sm text-gray-500">Con códigos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.sinCodigos}</p>
                <p className="text-sm text-gray-500">Sin códigos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{stats.errores}</p>
                <p className="text-sm text-gray-500">Errores</p>
              </CardContent>
            </Card>
          </div>

          {/* Lista de imágenes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Imágenes Procesadas</CardTitle>
              <Button onClick={downloadZip} disabled={isProcessing}>
                <Download className="w-4 h-4 mr-2" />
                Descargar ZIP
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={cn(
                      'flex items-center gap-4 p-3 rounded-lg border',
                      img.status === 'done' && 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
                      img.status === 'no_codes' && 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20',
                      img.status === 'error' && 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',
                      img.status === 'processing' && 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                    )}
                  >
                    {/* Thumbnail - clickeable para previsualizar */}
                    <div
                      onClick={() => openPreview(img)}
                      className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer group relative"
                    >
                      <img
                        src={img.dataUrl}
                        alt={img.originalName}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        Original: {img.originalName}
                      </p>

                      {/* Códigos detectados */}
                      {img.codigosDetectados.length > 0 && (
                        <div className="flex flex-wrap gap-1 my-1">
                          {img.codigosDetectados.map((codigo, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                'px-2 py-0.5 text-xs rounded-full font-mono',
                                codigo.tipo === 'anio' && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
                                codigo.tipo === 'patrimonial' && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                                codigo.tipo === 'otro' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              )}
                            >
                              {codigo.valor}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Nombre final editable */}
                      {editingId === img.id ? (
                        <Input
                          defaultValue={img.nombreFinal}
                          onBlur={(e) => updateNombreFinal(img.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateNombreFinal(img.id, e.currentTarget.value);
                            }
                          }}
                          autoFocus
                          className="mt-1 text-sm"
                        />
                      ) : (
                        <p
                          className="font-medium text-gray-900 dark:text-white truncate cursor-pointer hover:text-primary-600 flex items-center gap-1"
                          onClick={() => setEditingId(img.id)}
                        >
                          {img.nombreFinal}
                          <Edit3 className="w-3 h-3 opacity-50" />
                        </p>
                      )}

                      {img.errorMessage && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {img.errorMessage}
                        </p>
                      )}
                    </div>

                    {/* Estado y acciones */}
                    <div className="flex items-center gap-1">
                      {img.status === 'done' && (
                        <CheckCircle className="w-5 h-5 text-green-500 mr-1" />
                      )}
                      {img.status === 'no_codes' && (
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mr-1" />
                      )}
                      {img.status === 'error' && (
                        <AlertTriangle className="w-5 h-5 text-red-500 mr-1" />
                      )}
                      {img.status === 'processing' && (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-1" />
                      )}

                      {/* Botones de rotación */}
                      <button
                        onClick={() => rotateAndReprocess(img.id, -90)}
                        className="p-1.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30"
                        title="Rotar 90° izquierda y re-escanear"
                        disabled={img.status === 'processing'}
                      >
                        <RotateCcw className="w-4 h-4 text-purple-500" />
                      </button>

                      <button
                        onClick={() => rotateAndReprocess(img.id, 90)}
                        className="p-1.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30"
                        title="Rotar 90° derecha y re-escanear"
                        disabled={img.status === 'processing'}
                      >
                        <RotateCw className="w-4 h-4 text-purple-500" />
                      </button>

                      <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

                      <button
                        onClick={() => openPreview(img)}
                        className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        title="Ver imagen completa"
                      >
                        <Maximize2 className="w-4 h-4 text-blue-500" />
                      </button>

                      <button
                        onClick={() => reprocessImage(img.id)}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Re-escanear códigos"
                        disabled={img.status === 'processing'}
                      >
                        <RefreshCw className="w-4 h-4 text-gray-500" />
                      </button>

                      <button
                        onClick={() => removeImage(img.id)}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Paso 4: Descargando */}
      {step === 'downloading' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              Generando archivo ZIP...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal de Previsualización */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={closePreview}
        >
          {/* Header del modal */}
          <div
            className="flex items-center justify-between p-4 bg-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{previewImage.nombreFinal}</p>
              <p className="text-gray-400 text-sm truncate">Original: {previewImage.originalName}</p>
            </div>
            <div className="flex items-center gap-1 ml-4">
              {/* Controles de rotación */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); rotatePreview(-90); }}
                className="text-white hover:bg-white/20"
                title="Rotar izquierda"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); rotatePreview(90); }}
                className="text-white hover:bg-white/20"
                title="Rotar derecha"
              >
                <RotateCw className="w-5 h-5" />
              </Button>

              <div className="w-px h-6 bg-white/30 mx-1" />

              {/* Controles de zoom */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setPreviewZoom(z => Math.max(0.25, z - 0.25)); }}
                className="text-white hover:bg-white/20"
                title="Alejar"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <span className="text-white text-sm w-14 text-center">{Math.round(previewZoom * 100)}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setPreviewZoom(z => Math.min(4, z + 0.25)); }}
                className="text-white hover:bg-white/20"
                title="Acercar"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>

              <div className="w-px h-6 bg-white/30 mx-1" />

              {/* Reset y cerrar */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); resetPreviewView(); }}
                className="text-white hover:bg-white/20"
                title="Resetear vista"
              >
                <Maximize2 className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={closePreview}
                className="text-white hover:bg-white/20"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Indicador de rotación */}
          {previewRotation !== 0 && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm z-10">
              Rotación: {previewRotation}°
            </div>
          )}

          {/* Contenedor de imagen */}
          <div
            className={cn(
              "flex-1 overflow-hidden flex items-center justify-center p-4",
              previewZoom > 1 && "cursor-grab",
              isPreviewDragging && "cursor-grabbing"
            )}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handlePreviewMouseDown}
            onMouseMove={handlePreviewMouseMove}
            onMouseUp={handlePreviewMouseUp}
            onMouseLeave={handlePreviewMouseUp}
          >
            <img
              src={previewImage.dataUrl}
              alt={previewImage.nombreFinal}
              className="max-w-none transition-transform duration-200 select-none"
              style={{
                transform: `translate(${previewPosition.x}px, ${previewPosition.y}px) scale(${previewZoom}) rotate(${previewRotation}deg)`,
              }}
              draggable={false}
            />
          </div>

          {/* Navegación */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); navigatePreview(-1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navigatePreview(1); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          {/* Info de códigos detectados y acciones */}
          <div
            className="p-4 bg-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-400 text-sm">Códigos detectados:</span>
                {previewImage.codigosDetectados.length > 0 ? (
                  previewImage.codigosDetectados.map((codigo, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'px-3 py-1 text-sm rounded-full font-mono',
                        codigo.tipo === 'anio' && 'bg-blue-600 text-white',
                        codigo.tipo === 'patrimonial' && 'bg-green-600 text-white',
                        codigo.tipo === 'otro' && 'bg-gray-600 text-white'
                      )}
                    >
                      {codigo.valor}
                      <span className="ml-2 opacity-70 text-xs">
                        ({codigo.tipo === 'anio' ? '8 díg.' : codigo.tipo === 'patrimonial' ? '12 díg.' : 'otro'})
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-yellow-400 text-sm">No se detectaron códigos</span>
                )}
              </div>

              {/* Botón re-analizar con rotación */}
              {previewRotation !== 0 && (
                <Button
                  onClick={(e) => { e.stopPropagation(); reanalyzeWithRotation(); }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Re-analizar con rotación ({previewRotation}°)
                </Button>
              )}
            </div>

            {/* Contador de posición e instrucciones */}
            <div className="flex items-center justify-between mt-3 text-gray-400 text-sm">
              <span>
                {images.findIndex(img => img.id === previewImage.id) + 1} de {images.length}
              </span>
              <span className="text-xs">
                {previewZoom > 1 ? 'Arrastra para mover' : 'Usa zoom para mover'} • Flechas ←→ para navegar • ESC para cerrar
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
