'use client';

import { useEffect, useRef, useState } from 'react';
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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // Si hay cámara trasera, usarla; si no, usar la última (suele ser trasera en muchos dispositivos)
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

  const startScanner = async () => {
    setError(null);

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

      // Configuración para el escáner
      const config = {
        fps: 10,
        qrbox: 250,
      };

      setIsScanning(true);

      // Detectar si es móvil
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // En móviles, siempre usar facingMode: "environment" (cámara trasera)
      // Es más confiable que usar IDs de cámaras
      if (isMobile) {
        console.log('Dispositivo móvil detectado, usando cámara trasera');
        await scannerRef.current.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          onScanFailure
        );
      } else {
        // En desktop, usar la cámara seleccionada o la primera disponible
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

        console.log('Iniciando cámara:', cameraId);
        await scannerRef.current.start(
          cameraId,
          config,
          onScanSuccess,
          onScanFailure
        );
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

  // Procesar imagen de archivo
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

      // Crear nueva instancia específica para escanear archivo
      const html5QrCode = new Html5Qrcode('qr-reader-file');

      const result = await html5QrCode.scanFile(file, true);
      console.log('QR leído de imagen:', result);

      // Limpiar instancia
      await html5QrCode.clear();

      await processQRData(result);
    } catch (err: any) {
      console.error('Error procesando imagen:', err);

      // Mostrar el error específico
      if (err.toString().includes('No QR code found')) {
        setError('No se encontró ningún código QR en la imagen.');
      } else if (err.toString().includes('No MultiFormat Readers')) {
        setError('No se pudo decodificar la imagen. Intenta con una imagen más clara.');
      } else {
        setError(`Error: ${err.message || err}. Intenta con una imagen más clara del QR.`);
      }
    } finally {
      setProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const stopScanner = async () => {
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
          // No mostrar error, solo no mostrar la razón social
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
    // No hacer nada en errores de escaneo (es normal mientras busca)
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
  };

  // Detectar automáticamente si es venta o compra
  const detectTipoOperacion = (): 'VENTA' | 'COMPRA' | null => {
    if (!scannedData) return null;
    // Si el RUC del QR coincide con la empresa, es VENTA (emitimos nosotros)
    // Si no coincide, es COMPRA (nos lo emitieron a nosotros)
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
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Div oculto para procesar imágenes */}
              <div id="qr-reader-file" style={{ display: 'none' }} />

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

              <div
                id="qr-reader"
                className="w-full bg-gray-900 rounded-lg overflow-hidden"
                style={{ minHeight: '300px' }}
              />

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
                    o si tu cámara no funciona
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
                {processingImage ? 'Procesando...' : 'Subir imagen del QR'}
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
                Apunta la cámara al código QR, sube una imagen, o pega el texto directamente
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
