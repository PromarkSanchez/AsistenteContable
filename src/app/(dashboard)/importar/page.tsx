'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileArchive,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { useCompanyStore } from '@/store/company-store';
import { importApi, comprobantesApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { InvoiceViewer } from '@/components/invoice-viewer';
import type { Comprobante } from '@/types';

interface ImportResult {
  success: boolean;
  message: string;
  summary: {
    total: number;
    imported: number;
    duplicated: number;
    errors: number;
    fileType: string;
    ventasDetectadas: number;
    comprasDetectadas: number;
  };
  comprobantes: Array<{
    id: string;
    tipo: string;
    serie: string;
    numero: string;
    total: number;
    tercero: string;
  }>;
}

export default function ImportarPage() {
  const { selectedCompany } = useCompanyStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedComprobante, setSelectedComprobante] = useState<Comprobante | null>(null);
  const [loadingComprobante, setLoadingComprobante] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = async (file: File) => {
    if (!selectedCompany) return;

    // Validar extensión
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'xml' && ext !== 'zip') {
      setError('Solo se aceptan archivos XML o ZIP');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImportResult(null);

    try {
      const response = await importApi.importXML(selectedCompany.id, file);
      setImportResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar archivo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileImport(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileImport(file);
    }
  }, [selectedCompany]);

  const viewComprobante = async (comprobanteId: string) => {
    if (!selectedCompany) return;

    setLoadingComprobante(comprobanteId);
    try {
      const comprobante = await comprobantesApi.get(selectedCompany.id, comprobanteId);
      setSelectedComprobante(comprobante);
    } catch (err) {
      setError('Error al cargar el comprobante');
    } finally {
      setLoadingComprobante(null);
    }
  };

  const resetImport = () => {
    setImportResult(null);
    setError(null);
  };

  if (!selectedCompany) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Selecciona una empresa para importar comprobantes
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Importar Comprobantes
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Sube archivos XML o ZIP de comprobantes electrónicos SUNAT
        </p>
      </div>

      {/* Mensajes de error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Área de importación */}
      {!importResult && (
        <Card>
          <CardContent className="p-8">
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
                isDragging
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                isLoading && 'pointer-events-none opacity-50'
              )}
              onClick={() => !isLoading && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,.zip"
                className="hidden"
                onChange={handleFileChange}
                disabled={isLoading}
              />

              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-16 h-16 text-primary-500 animate-spin" />
                  <div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      Procesando archivo...
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Detectando tipo de operación automáticamente
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileArchive className="w-10 h-10 text-primary-600 dark:text-primary-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Arrastra tu archivo aquí o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Acepta archivos XML individuales o ZIP con múltiples XMLs
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">.xml</span>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">.zip</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-4">
                    ✓ El tipo de operación (venta/compra) se detecta automáticamente
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado de la importación */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.summary.imported > 0 ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              Resultado de la Importación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {importResult.summary.total}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total XMLs</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {importResult.summary.imported}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Importados</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {importResult.summary.duplicated}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Duplicados</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
                  {importResult.summary.errors}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Errores</div>
              </div>
            </div>

            {/* Tipo detectado */}
            {(importResult.summary.ventasDetectadas > 0 || importResult.summary.comprasDetectadas > 0) && (
              <div className="flex items-center justify-center gap-6 py-3 border-t border-b dark:border-gray-700">
                {importResult.summary.ventasDetectadas > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">
                      {importResult.summary.ventasDetectadas} VENTA{importResult.summary.ventasDetectadas > 1 ? 'S' : ''}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">(emitidos por tu empresa)</span>
                  </div>
                )}
                {importResult.summary.comprasDetectadas > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded font-medium">
                      {importResult.summary.comprasDetectadas} COMPRA{importResult.summary.comprasDetectadas > 1 ? 'S' : ''}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">(recibidos de proveedores)</span>
                  </div>
                )}
              </div>
            )}

            {/* Lista de comprobantes importados */}
            {importResult.comprobantes && importResult.comprobantes.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                  Comprobantes importados:
                </h4>
                <div className="space-y-2">
                  {importResult.comprobantes.map((comp) => (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {comp.serie}-{comp.numero}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {comp.tercero}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded',
                          comp.tipo === 'VENTA'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                        )}>
                          {comp.tipo}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          S/ {comp.total.toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewComprobante(comp.id)}
                          disabled={loadingComprobante === comp.id}
                        >
                          {loadingComprobante === comp.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
              <Button variant="outline" onClick={resetImport}>
                <Upload className="w-4 h-4 mr-2" />
                Importar más
              </Button>
              <Button onClick={() => window.location.href = '/comprobantes'}>
                Ver todos los comprobantes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visor de comprobante */}
      {selectedComprobante && selectedCompany && (
        <InvoiceViewer
          comprobante={selectedComprobante}
          company={selectedCompany}
          onClose={() => setSelectedComprobante(null)}
        />
      )}
    </div>
  );
}
