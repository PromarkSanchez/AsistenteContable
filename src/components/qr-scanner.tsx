'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  X,
  Camera,
  CameraOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  ImagePlus,
  ZoomIn,
  ZoomOut,
  Focus,
  Flashlight,
} from 'lucide-react';
import type { Company } from '@/types';
import { importApi, tercerosApi } from '@/lib/api-client';

interface QRData {
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

interface QrScannerProps {
  company: Company;
  onClose: () => void;
  onSuccess?: (comprobante: any) => void;
}

interface CameraDevice {
  id: string;
  label: string;
}

export function QrScanner({ company, onClose, onSuccess }: QrScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<QRData | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedComprobante, setImportedComprobante] = useState<any>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [razonSocialEmisor, setRazonSocialEmisor] = useState<string | null>(null);
  const [loadingRazonSocial, setLoadingRazonSocial] = useState(false);

  // Nuevos estados para mejoras
  const [zoomLevel, setZoomLevel] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scanMode, setScanMode] = useState<'normal' | 'small'>('normal');
  const [scanAttempts, setScanAttempts] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Cargar cámaras disponibles al montar
  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Preferir cámara trasera (back/rear/environment)
        const backCamera = devices.find(d => {
          const label = d.label.toLowerCase();
          return label.includes('back') ||
                 label.includes('rear') ||
                 label.includes('trasera') ||
                 label.includes('environment') ||
                 label.includes('facing back');
        });
        setSelectedCamera(backCamera?.id || devices[devices.length - 1].id);
      }
    }).catch(err => {
      console.error('Error obteniendo cámaras:', err);
    });
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Configurar zoom y torch cuando el video track esté disponible
  const setupAdvancedFeatures = useCallback(async (track: MediaStreamTrack) => {
    videoTrackRef.current = track;

    try {
      const capabilities = track.getCapabilities() as any;

      // Configurar zoom
      if (capabilities.zoom) {
        setMaxZoom(capabilities.zoom.max || 1);
        // Empezar con zoom 1.5x para QR pequeños
        const initialZoom = Math.min(1.5, capabilities.zoom.max || 1);
        setZoomLevel(initialZoom);
        await track.applyConstraints({ advanced: [{ zoom: initialZoom } as any] });
      }

      // Verificar soporte de linterna
      if (capabilities.torch) {
        setTorchSupported(true);
      }

      // Configurar enfoque continuo para mejor detección
      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as any]
        });
      }

    } catch (e) {
      console.log('Características avanzadas no soportadas:', e);
    }
  }, []);

  // Cambiar zoom
  const handleZoomChange = async (newZoom: number) => {
    if (!videoTrackRef.current) return;

    try {
      const clampedZoom = Math.max(1, Math.min(newZoom, maxZoom));
      await videoTrackRef.current.applyConstraints({
        advanced: [{ zoom: clampedZoom } as any]
      });
      setZoomLevel(clampedZoom);
    } catch (e) {
      console.error('Error cambiando zoom:', e);
    }
  };

  // Toggle linterna
  const toggleTorch = async () => {
    if (!videoTrackRef.current || !torchSupported) return;

    try {
      const newTorchState = !torchOn;
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: newTorchState } as any]
      });
      setTorchOn(newTorchState);
    } catch (e) {
      console.error('Error cambiando linterna:', e);
    }
  };

  // Forzar reenfoque
  const forceRefocus = async () => {
    if (!videoTrackRef.current) return;

    try {
      // Cambiar a manual y luego a continuo para forzar reenfoque
      await videoTrackRef.current.applyConstraints({
        advanced: [{ focusMode: 'manual' } as any]
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      await videoTrackRef.current.applyConstraints({
        advanced: [{ focusMode: 'continuous' } as any]
      });
    } catch (e) {
      console.log('Reenfoque no soportado');
    }
  };

  const startScanner = async () => {
    setError(null);
    setScanAttempts(0);

    try {
      // Limpiar instancia anterior si existe
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (e) {
          // Ignorar
        }
        scannerRef.current = null;
      }

      // Crear nueva instancia
      scannerRef.current = new Html5Qrcode('qr-reader');

      // Configuración MEJORADA para QR pequeños
      const config = {
        fps: 15, // Mayor FPS para mejor detección
        qrbox: scanMode === 'small' ? { width: 200, height: 200 } : { width: 280, height: 280 },
        aspectRatio: 1.0,
        disableFlip: false,
        // Experimental: mejoras de detección
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Usar API nativa si está disponible
        }
      };

      setIsScanning(true);

      // Detectar si es móvil
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // Configuración de video MEJORADA para máxima calidad
      const videoConstraints: MediaTrackConstraints = {
        facingMode: isMobile ? 'environment' : undefined,
        deviceId: !isMobile && selectedCamera ? { exact: selectedCamera } : undefined,
        // Solicitar máxima resolución para capturar QR pequeños
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        // Configuraciones avanzadas
        ...(isMobile ? {
          // En móvil, solicitar características específicas
        } : {})
      };

      if (isMobile) {
        console.log('Dispositivo móvil - usando cámara trasera con alta resolución');

        // Primero obtener el stream para configurar zoom/torch
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          });

          const track = stream.getVideoTracks()[0];
          if (track) {
            await setupAdvancedFeatures(track);
          }

          // Detener este stream, el escáner creará el suyo
          stream.getTracks().forEach(t => t.stop());
        } catch (e) {
          console.log('No se pudo preconfigurar características avanzadas');
        }

        await scannerRef.current.start(
          { facingMode: 'environment' },
          config,
          onScanSuccess,
          onScanFailure
        );

        // Obtener el track actual del escáner para zoom/torch
        setTimeout(async () => {
          try {
            const videoElement = document.querySelector('#qr-reader video') as HTMLVideoElement;
            if (videoElement && videoElement.srcObject) {
              const stream = videoElement.srcObject as MediaStream;
              const track = stream.getVideoTracks()[0];
              if (track) {
                await setupAdvancedFeatures(track);
              }
            }
          } catch (e) {
            console.log('No se pudo acceder al track de video');
          }
        }, 500);

      } else {
        // Desktop
        let cameraId = selectedCamera;

        if (!cameraId) {
          const devices = await Html5Qrcode.getCameras();
          if (!devices || devices.length === 0) {
            throw new Error('No se encontraron cámaras');
          }
          setCameras(devices);
          cameraId = devices[0].id;
          setSelectedCamera(cameraId);
        }

        console.log('Iniciando cámara desktop:', cameraId);
        await scannerRef.current.start(
          cameraId,
          config,
          onScanSuccess,
          onScanFailure
        );

        // Configurar features avanzadas en desktop también
        setTimeout(async () => {
          try {
            const videoElement = document.querySelector('#qr-reader video') as HTMLVideoElement;
            if (videoElement && videoElement.srcObject) {
              const stream = videoElement.srcObject as MediaStream;
              const track = stream.getVideoTracks()[0];
              if (track) {
                await setupAdvancedFeatures(track);
              }
            }
          } catch (e) {
            console.log('No se pudo acceder al track de video');
          }
        }, 500);
      }

    } catch (err: any) {
      console.error('Error iniciando scanner:', err);
      setIsScanning(false);

      if (err.toString().includes('NotAllowedError')) {
        setError('Permiso de cámara denegado. Por favor, permite el acceso a la cámara.');
      } else if (err.toString().includes('NotFoundError')) {
        setError('No se encontró una cámara en este dispositivo.');
      } else {
        setError('Error al iniciar la cámara: ' + (err.message || err));
      }
    }
  };

  // Procesar imagen de archivo con MEJORAS para QR pequeños
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setProcessingImage(true);

    try {
      // Detener escaneo si está activo
      if (isScanning) {
        await stopScanner();
      }

      // Preprocesar imagen para mejorar detección
      const processedFile = await preprocessImage(file);

      // Crear nueva instancia específica para escanear archivo
      const html5QrCode = new Html5Qrcode('qr-reader-file');

      // Intentar con configuración normal
      try {
        const result = await html5QrCode.scanFile(processedFile, true);
        console.log('QR leído de imagen:', result);
        await html5QrCode.clear();
        await processQRData(result);
        return;
      } catch (firstErr) {
        console.log('Primer intento fallido, intentando con imagen mejorada...');
      }

      // Si falla, intentar con imagen original
      try {
        const result = await html5QrCode.scanFile(file, true);
        console.log('QR leído de imagen original:', result);
        await html5QrCode.clear();
        await processQRData(result);
        return;
      } catch (secondErr) {
        console.log('Segundo intento fallido');
        await html5QrCode.clear();
        throw secondErr;
      }

    } catch (err: any) {
      console.error('Error procesando imagen:', err);

      if (err.toString().includes('No QR code found')) {
        setError('No se encontró ningún código QR. Intenta: 1) Acercar más la imagen, 2) Mejor iluminación, 3) Imagen más nítida');
      } else if (err.toString().includes('No MultiFormat Readers')) {
        setError('No se pudo decodificar. Intenta tomar la foto más de cerca al QR.');
      } else {
        setError(`Error: ${err.message || err}. Prueba con una foto más cercana del QR.`);
      }
    } finally {
      setProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Preprocesar imagen para mejorar detección de QR pequeños
  const preprocessImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Escalar imagen si es muy grande o muy pequeña
        let width = img.width;
        let height = img.height;

        // Si la imagen es pequeña, escalarla para mejor detección
        const minDimension = Math.min(width, height);
        if (minDimension < 500) {
          const scale = 500 / minDimension;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        // Si es muy grande, reducirla para procesamiento más rápido
        const maxDimension = 2000;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;

        if (!ctx) {
          resolve(file);
          return;
        }

        // Dibujar imagen
        ctx.drawImage(img, 0, 0, width, height);

        // Aplicar mejoras para QR
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Aumentar contraste para QR pequeños
        const contrast = 1.3; // Factor de contraste
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

        for (let i = 0; i < data.length; i += 4) {
          // Convertir a escala de grises
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

          // Aplicar contraste
          let newValue = factor * (gray - 128) + 128;
          newValue = Math.max(0, Math.min(255, newValue));

          // Umbralización suave para QR
          if (newValue < 128) {
            newValue = newValue * 0.5; // Oscurecer los oscuros
          } else {
            newValue = 128 + (newValue - 128) * 1.5; // Aclarar los claros
          }
          newValue = Math.max(0, Math.min(255, newValue));

          data[i] = newValue;     // R
          data[i + 1] = newValue; // G
          data[i + 2] = newValue; // B
        }

        ctx.putImageData(imageData, 0, 0);

        // Convertir canvas a File
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/png' }));
          } else {
            resolve(file);
          }
        }, 'image/png', 1.0);
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const stopScanner = async () => {
    // Limpiar referencias de video
    videoTrackRef.current = null;
    setTorchOn(false);
    setZoomLevel(1);

    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error deteniendo scanner:', err);
      }
    }
    setIsScanning(false);
  };

  // Función común para procesar datos del QR
  const processQRData = async (decodedText: string) => {
    try {
      const data = await importApi.parseQR(decodedText);

      if (data.success && data.data) {
        const qrData = data.data as QRData;
        setScannedData(qrData);

        // Buscar razón social del emisor automáticamente
        setLoadingRazonSocial(true);
        setRazonSocialEmisor(null);
        try {
          const terceroData = await tercerosApi.consultarRUC(qrData.ruc);
          if (terceroData.success && terceroData.data) {
            setRazonSocialEmisor(terceroData.data.razonSocial);
          }
        } catch (terceroErr) {
          console.error('No se pudo obtener razón social:', terceroErr);
        } finally {
          setLoadingRazonSocial(false);
        }
      } else {
        setError('No se pudo interpretar el código QR');
      }
    } catch (err: any) {
      setError(err.message || 'Error procesando el código QR');
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    // Detener el escaneo
    await stopScanner();
    await processQRData(decodedText);
  };

  const onScanFailure = (errorMessage: string) => {
    // Incrementar contador de intentos para UI feedback
    setScanAttempts(prev => prev + 1);
  };

  // Procesar entrada manual
  const handleManualSubmit = async () => {
    if (!manualInput.trim()) {
      setError('Ingresa el contenido del QR');
      return;
    }
    setError(null);
    setProcessingImage(true);
    try {
      await processQRData(manualInput.trim());
    } finally {
      setProcessingImage(false);
    }
  };

  const handleImport = async (tipoOperacion: 'VENTA' | 'COMPRA') => {
    if (!scannedData) return;

    setImporting(true);
    setError(null);

    try {
      const qrString = `${scannedData.ruc}|${scannedData.tipoDocumento}|${scannedData.serie}|${scannedData.numero}|${scannedData.igv}|${scannedData.total}|${scannedData.fecha}|${scannedData.tipoDocCliente}|${scannedData.numDocCliente}|${scannedData.hash}`;

      const data = await importApi.importQR(company.id, qrString, tipoOperacion);

      if (data.success) {
        setImportSuccess(true);
        setImportedComprobante(data.comprobante);
        if (onSuccess) {
          onSuccess(data.comprobante);
        }
      } else {
        setError('Error al importar el comprobante');
      }
    } catch (err: any) {
      setError(err.message || 'Error al importar el comprobante');
    } finally {
      setImporting(false);
    }
  };

  const resetScanner = () => {
    setScannedData(null);
    setError(null);
    setImportSuccess(false);
    setImportedComprobante(null);
    setRazonSocialEmisor(null);
    setScanAttempts(0);
  };

  // Detectar automáticamente si es venta o compra
  const detectTipoOperacion = (): 'VENTA' | 'COMPRA' | null => {
    if (!scannedData) return null;
    return scannedData.ruc === company.ruc ? 'VENTA' : 'COMPRA';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Escanear QR SUNAT
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Estado de éxito */}
          {importSuccess && importedComprobante && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Comprobante Importado
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {scannedData?.tipoNombre} {importedComprobante.serie}-{importedComprobante.numero}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                  S/ {Number(importedComprobante.total).toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={resetScanner}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Escanear otro
                </Button>
                <Button onClick={onClose}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}

          {/* Datos escaneados - seleccionar tipo */}
          {scannedData && !importSuccess && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Tipo:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{scannedData.tipoNombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Número:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{scannedData.serie}-{scannedData.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">RUC Emisor:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{scannedData.ruc}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Emisor:</span>
                  <span className="font-medium text-gray-900 dark:text-white text-right max-w-[200px] truncate">
                    {loadingRazonSocial ? (
                      <span className="text-gray-400 italic">Buscando...</span>
                    ) : razonSocialEmisor ? (
                      razonSocialEmisor
                    ) : (
                      <span className="text-gray-400">No encontrado</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Fecha:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{scannedData.fecha}</span>
                </div>
                <div className="flex justify-between border-t dark:border-gray-700 pt-2 mt-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Base Imponible:</span>
                  <span className="font-medium text-gray-900 dark:text-white">S/ {scannedData.baseImponible.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">IGV:</span>
                  <span className="font-medium text-gray-900 dark:text-white">S/ {scannedData.igv.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-gray-700 dark:text-gray-300">Total:</span>
                  <span className="text-gray-900 dark:text-white">S/ {scannedData.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Detección automática */}
              {detectTipoOperacion() && (
                <div className={`p-3 rounded-lg text-sm ${
                  detectTipoOperacion() === 'VENTA'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                }`}>
                  {detectTipoOperacion() === 'VENTA'
                    ? '✓ Detectado como VENTA (tu empresa emitió este comprobante)'
                    : '✓ Detectado como COMPRA (recibiste este comprobante)'}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Importar como:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={detectTipoOperacion() === 'COMPRA' ? 'primary' : 'outline'}
                    onClick={() => handleImport('COMPRA')}
                    disabled={importing}
                    className="flex-1"
                  >
                    {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    COMPRA
                  </Button>
                  <Button
                    variant={detectTipoOperacion() === 'VENTA' ? 'primary' : 'outline'}
                    onClick={() => handleImport('VENTA')}
                    disabled={importing}
                    className="flex-1"
                  >
                    {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    VENTA
                  </Button>
                </div>
              </div>

              <Button variant="ghost" className="w-full" onClick={resetScanner}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Escanear otro código
              </Button>
            </div>
          )}

          {/* Área del escáner */}
          {!scannedData && !importSuccess && (
            <>
              {/* Input oculto para subir imagen */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Div oculto para procesar imágenes */}
              <div id="qr-reader-file" style={{ display: 'none' }} />

              {/* Modo de escaneo para QR pequeños */}
              <div className="flex gap-2">
                <Button
                  variant={scanMode === 'normal' ? 'primary' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setScanMode('normal')}
                  disabled={isScanning}
                >
                  QR Normal
                </Button>
                <Button
                  variant={scanMode === 'small' ? 'primary' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setScanMode('small')}
                  disabled={isScanning}
                >
                  QR Pequeño (Ticket)
                </Button>
              </div>

              {/* Selector de cámara */}
              {cameras.length > 1 && !isScanning && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Seleccionar cámara:
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                  >
                    {cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `Cámara ${cameras.indexOf(cam) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative">
                <div
                  id="qr-reader"
                  className="w-full bg-gray-900 rounded-lg overflow-hidden"
                  style={{ minHeight: '300px' }}
                />

                {/* Controles de cámara cuando está escaneando */}
                {isScanning && (
                  <div className="absolute bottom-2 left-2 right-2 flex justify-center gap-2">
                    {/* Zoom controls */}
                    {maxZoom > 1 && (
                      <div className="flex items-center gap-1 bg-black/60 rounded-lg px-2 py-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-white hover:bg-white/20"
                          onClick={() => handleZoomChange(zoomLevel - 0.5)}
                          disabled={zoomLevel <= 1}
                        >
                          <ZoomOut className="w-4 h-4" />
                        </Button>
                        <span className="text-white text-xs min-w-[40px] text-center">
                          {zoomLevel.toFixed(1)}x
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-white hover:bg-white/20"
                          onClick={() => handleZoomChange(zoomLevel + 0.5)}
                          disabled={zoomLevel >= maxZoom}
                        >
                          <ZoomIn className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {/* Torch button */}
                    {torchSupported && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${torchOn ? 'text-yellow-400' : 'text-white'} bg-black/60 hover:bg-black/80`}
                        onClick={toggleTorch}
                      >
                        <Flashlight className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Focus button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-white bg-black/60 hover:bg-black/80"
                      onClick={forceRefocus}
                    >
                      <Focus className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Indicador de intentos */}
                {isScanning && scanAttempts > 30 && (
                  <div className="absolute top-2 left-2 right-2">
                    <div className="bg-yellow-500/90 text-yellow-900 text-xs px-3 py-2 rounded-lg text-center">
                      💡 Acerca más la cámara al QR o usa el zoom (+)
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                {!isScanning ? (
                  <Button className="flex-1" onClick={startScanner} disabled={processingImage}>
                    <Camera className="w-4 h-4 mr-2" />
                    Iniciar Cámara
                  </Button>
                ) : (
                  <Button className="flex-1" variant="danger" onClick={stopScanner}>
                    <CameraOff className="w-4 h-4 mr-2" />
                    Detener Cámara
                  </Button>
                )}
              </div>

              {/* Opción alternativa: subir imagen */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    o toma una foto del QR
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={processingImage || isScanning}
              >
                {processingImage ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4 mr-2" />
                )}
                {processingImage ? 'Procesando...' : 'Tomar/Subir foto del QR'}
              </Button>

              {/* Opción de ingresar texto manualmente */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowManualInput(!showManualInput)}
                disabled={isScanning}
              >
                {showManualInput ? 'Ocultar entrada manual' : '¿Tu celular puede copiar el texto del QR? Pégalo aquí'}
              </Button>

              {showManualInput && (
                <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    El QR de SUNAT tiene formato: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPODOC|NUMDOC|HASH
                  </p>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    rows={2}
                    placeholder="Ejemplo: 20123456789|01|F001|00000123|18.00|118.00|10/01/2024|6|20987654321|abc123"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleManualSubmit}
                    disabled={processingImage || !manualInput.trim()}
                  >
                    {processingImage ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Procesar
                  </Button>
                </div>
              )}

              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                📌 Para QR pequeños: usa "QR Pequeño", acerca la cámara, y usa el zoom (+)
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
