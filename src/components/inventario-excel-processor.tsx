'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileSpreadsheet,
  Upload,
  Download,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Calendar,
  Building2,
  Eye,
  EyeOff,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useCompanyStore } from '@/store/company-store';

interface FileState {
  file: File | null;
  name: string;
}

interface CompanyInfo {
  id: string;
  razonSocial: string;
  ruc: string;
}

interface InventarioResumen {
  id: string;
  nombre: string;
  descripcion: string | null;
  fechaInventario: string;
  codigoEconomato: string;
  totalInventarioImporte: number;
  totalKardexImporte: number;
  totalSobrantesImporte: number;
  totalFaltantesImporte: number;
  totalItems: number;
  createdAt: string;
  company: CompanyInfo | null;
}

interface PreviewItem {
  codigoBien: string;
  descripcion: string;
  unidadMedida: string;
  inventarioUnidad: number;
  inventarioImporte: number;
  kardexUnidad: number;
  costoUnitario: number;
  kardexImporte: number;
  sobrantesUnidad: number;
  sobrantesImporte: number;
  faltantesUnidad: number;
  faltantesImporte: number;
}

export function InventarioExcelProcessor() {
  const [stockFile, setStockFile] = useState<FileState>({ file: null, name: '' });
  const [conteoFile, setConteoFile] = useState<FileState>({ file: null, name: '' });
  const [nombre, setNombre] = useState('');
  const [fechaInventario, setFechaInventario] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inventarios, setInventarios] = useState<InventarioResumen[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showExcelOptions, setShowExcelOptions] = useState<string | null>(null);
  const [showReportOptions, setShowReportOptions] = useState<string | null>(null);
  const [excelOptions, setExcelOptions] = useState({
    includeLogo: true,
  });
  const [reportOptions, setReportOptions] = useState({
    includeLogo: true,
    includeFirma: true,
    includeHuella: true,
  });
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewTotals, setPreviewTotals] = useState({
    inventario: 0,
    kardex: 0,
    sobrantes: 0,
    faltantes: 0,
  });

  const stockInputRef = useRef<HTMLInputElement>(null);
  const conteoInputRef = useRef<HTMLInputElement>(null);

  const { accessToken } = useAuthStore();
  const { companies, selectedCompany } = useCompanyStore();

  // Cargar inventarios al montar
  useEffect(() => {
    loadInventarios();
  }, [accessToken]);

  const loadInventarios = async () => {
    if (!accessToken) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/inventario/procesar', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInventarios(data);
      }
    } catch (err) {
      console.error('Error cargando inventarios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: React.Dispatch<React.SetStateAction<FileState>>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.xls', '.xlsx'];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (!validExtensions.includes(ext)) {
        setError('Solo se permiten archivos Excel (.xls, .xlsx)');
        return;
      }

      setFile({ file, name: file.name });
      setError(null);
      setShowPreview(false);
      setPreviewItems([]);
    }
  };

  const removeFile = (
    setFile: React.Dispatch<React.SetStateAction<FileState>>,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    setFile({ file: null, name: '' });
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setShowPreview(false);
    setPreviewItems([]);
  };

  // Generar vista previa
  const generatePreview = async () => {
    if (!stockFile.file || !conteoFile.file) {
      setError('Por favor selecciona ambos archivos');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Usar la librería xlsx del lado del cliente
      const XLSX = await import('xlsx');

      // Leer Stock Economato
      const stockBuffer = await stockFile.file.arrayBuffer();
      const stockWorkbook = XLSX.read(stockBuffer, { type: 'array' });
      const stockSheet = stockWorkbook.Sheets[stockWorkbook.SheetNames[0]];
      const stockData = XLSX.utils.sheet_to_json<Record<string, unknown>>(stockSheet);

      // Leer Conteo
      const conteoBuffer = await conteoFile.file.arrayBuffer();
      const conteoWorkbook = XLSX.read(conteoBuffer, { type: 'array' });
      const conteoSheet = conteoWorkbook.Sheets[conteoWorkbook.SheetNames[0]];
      const conteoData = XLSX.utils.sheet_to_json<Record<string, unknown>>(conteoSheet);

      // Crear mapa de conteo
      const conteoMap = new Map<string, number>();
      for (const item of conteoData) {
        const codigo = String(item['CODIGO'] || '').trim();
        if (codigo) {
          conteoMap.set(codigo, Number(item['CONTEO B']) || 0);
        }
      }

      // Procesar datos
      const items: PreviewItem[] = [];
      let totalInventario = 0;
      let totalKardex = 0;
      let totalSobrantes = 0;
      let totalFaltantes = 0;

      for (const stockItem of stockData) {
        const codigo = String(stockItem['codi_bser_cat'] || '').trim();
        if (!codigo) continue;

        const kardexUnidad = Number(stockItem['saldo_final']) || 0;
        const kardexImporte = Number(stockItem['valor_total']) || 0;
        const costoUnitario = kardexUnidad > 0 ? kardexImporte / kardexUnidad : 0;

        const inventarioUnidad = conteoMap.get(codigo) || 0;
        const inventarioImporte = inventarioUnidad * costoUnitario;

        const diferencia = inventarioUnidad - kardexUnidad;
        const sobrantesUnidad = diferencia > 0 ? diferencia : 0;
        const sobrantesImporte = sobrantesUnidad * costoUnitario;
        const faltantesUnidad = diferencia < 0 ? Math.abs(diferencia) : 0;
        const faltantesImporte = faltantesUnidad * costoUnitario;

        items.push({
          codigoBien: codigo,
          descripcion: String(stockItem['descripcion'] || ''),
          unidadMedida: String(stockItem['unidad_medida_desc'] || '').trim(),
          inventarioUnidad: Math.round(inventarioUnidad * 100) / 100,
          inventarioImporte: Math.round(inventarioImporte * 100) / 100,
          kardexUnidad: Math.round(kardexUnidad * 100) / 100,
          costoUnitario: Math.round(costoUnitario * 100) / 100,
          kardexImporte: Math.round(kardexImporte * 100) / 100,
          sobrantesUnidad: Math.round(sobrantesUnidad * 100) / 100,
          sobrantesImporte: Math.round(sobrantesImporte * 100) / 100,
          faltantesUnidad: Math.round(faltantesUnidad * 100) / 100,
          faltantesImporte: Math.round(faltantesImporte * 100) / 100,
        });

        totalInventario += inventarioImporte;
        totalKardex += kardexImporte;
        totalSobrantes += sobrantesImporte;
        totalFaltantes += faltantesImporte;
      }

      setPreviewItems(items);
      setPreviewTotals({
        inventario: Math.round(totalInventario * 100) / 100,
        kardex: Math.round(totalKardex * 100) / 100,
        sobrantes: Math.round(totalSobrantes * 100) / 100,
        faltantes: Math.round(totalFaltantes * 100) / 100,
      });
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar archivos');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (!stockFile.file || !conteoFile.file) {
      setError('Por favor selecciona ambos archivos');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('stockFile', stockFile.file);
      formData.append('conteoFile', conteoFile.file);
      formData.append('nombre', nombre || `Inventario ${new Date().toLocaleDateString('es-PE')}`);
      formData.append('fechaInventario', fechaInventario);
      if (selectedCompany) {
        formData.append('companyId', selectedCompany.id);
      }

      const response = await fetch('/api/inventario/procesar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar los archivos');
      }

      const result = await response.json();
      setSuccess(`Inventario "${result.inventario.nombre}" guardado con ${result.inventario.totalItems} items`);

      // Limpiar formulario
      removeFile(setStockFile, stockInputRef);
      removeFile(setConteoFile, conteoInputRef);
      setNombre('');
      setFechaInventario(new Date().toISOString().split('T')[0]);
      setShowPreview(false);
      setPreviewItems([]);

      // Recargar lista
      loadInventarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (id: string, options?: { includeLogo: boolean }) => {
    setDownloadingId(id);
    setShowExcelOptions(null);

    const params = new URLSearchParams();
    if (options) {
      params.set('includeLogo', options.includeLogo.toString());
    }

    try {
      const response = await fetch(`/api/inventario/${id}/excel?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al generar el Excel');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'ANEXO_2_INVENTARIO.xlsx';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este inventario?')) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/inventario/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al eliminar');
      }

      loadInventarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerateReport = async (id: string, options: typeof reportOptions) => {
    setGeneratingReportId(id);
    setShowReportOptions(null);
    try {
      const params = new URLSearchParams({
        includeLogo: String(options.includeLogo),
        includeFirma: String(options.includeFirma),
        includeHuella: String(options.includeHuella),
      });

      const response = await fetch(`/api/inventario/${id}/informe?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al generar informe');
      }

      // El API ahora devuelve HTML - abrir en nueva ventana
      const html = await response.text();
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
      } else {
        throw new Error('No se pudo abrir la ventana. Verifica que el navegador no esté bloqueando popups.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar informe');
    } finally {
      setGeneratingReportId(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-PE');
  };

  const FileUploadBox = ({
    title,
    description,
    file,
    setFile,
    inputRef,
  }: {
    title: string;
    description: string;
    file: FileState;
    setFile: React.Dispatch<React.SetStateAction<FileState>>;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <div className="flex-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{description}</p>

      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx"
        onChange={(e) => handleFileChange(e, setFile)}
        className="hidden"
      />

      {!file.file ? (
        <div
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            "hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20",
            "border-gray-300 dark:border-gray-600"
          )}
        >
          <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Haz clic para seleccionar</p>
          <p className="text-xs text-gray-400 mt-1">.xls o .xlsx</p>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-300 truncate max-w-[200px]">{file.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeFile(setFile, inputRef)}
              className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Formulario de carga */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Nuevo Inventario - ANEXO 2
          </CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sube los archivos de Stock Economato y Primer/Segundo Conteo para procesar el inventario
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <span className="text-green-700 dark:text-green-400">{success}</span>
            </div>
          )}

          {/* Campos del formulario */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre del Inventario
              </label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={`Inventario ${new Date().toLocaleDateString('es-PE')}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fecha de Inventario
              </label>
              <Input
                type="date"
                value={fechaInventario}
                onChange={(e) => setFechaInventario(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  Empresa (para logo)
                </div>
              </label>
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 text-sm">
                {selectedCompany ? (
                  <div>
                    <span className="font-medium">{selectedCompany.razonSocial}</span>
                    <span className="text-gray-500 ml-2">RUC: {selectedCompany.ruc}</span>
                  </div>
                ) : (
                  <span className="text-gray-500">Selecciona una empresa en el menú lateral</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-6 flex-col md:flex-row">
            <FileUploadBox
              title="Stock Economato"
              description="Archivo con datos del Kárdex"
              file={stockFile}
              setFile={setStockFile}
              inputRef={stockInputRef}
            />

            <FileUploadBox
              title="Primer y Segundo Conteo"
              description="Archivo con el inventario físico"
              file={conteoFile}
              setFile={setConteoFile}
              inputRef={conteoInputRef}
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={generatePreview}
              disabled={!stockFile.file || !conteoFile.file || isProcessing}
              className="flex-1"
            >
              {showPreview ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Ocultar Vista Previa
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Vista Previa
                </>
              )}
            </Button>
            <Button
              onClick={handleProcess}
              disabled={!stockFile.file || !conteoFile.file || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Procesar y Guardar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vista previa */}
      {showPreview && previewItems.length > 0 && (
        <Card>
          <CardHeader className="bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-700">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Eye className="h-5 w-5" />
              Vista Previa del Reporte ANEXO 2
            </CardTitle>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              {previewItems.length} items encontrados - Revisa antes de guardar
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {/* Encabezado del reporte */}
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h2 className="text-lg font-bold text-center text-blue-800 dark:text-blue-300">ANEXO "2"</h2>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                REPORTE DE RESULTADOS DEL INVENTARIO DE BIENES DE USO Y CONSUMO
              </p>
              {selectedCompany && (
                <div className="mt-3 text-sm">
                  <p><strong>Empresa:</strong> {selectedCompany.razonSocial}</p>
                  <p><strong>RUC:</strong> {selectedCompany.ruc}</p>
                </div>
              )}
              <div className="mt-2 text-sm">
                <p><strong>Nombre:</strong> {nombre || `Inventario ${new Date().toLocaleDateString('es-PE')}`}</p>
                <p><strong>Fecha:</strong> {formatDate(fechaInventario)}</p>
              </div>
            </div>

            {/* Tabla de datos */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-800 text-white">
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Descripción</th>
                    <th className="p-2 text-left">U.M.</th>
                    <th className="p-2 text-right" colSpan={2}>Inventario</th>
                    <th className="p-2 text-right" colSpan={3}>Kárdex</th>
                    <th className="p-2 text-right bg-green-700" colSpan={2}>Sobrantes</th>
                    <th className="p-2 text-right bg-red-700" colSpan={2}>Faltantes</th>
                  </tr>
                  <tr className="bg-blue-600 text-white text-[10px]">
                    <th className="p-1"></th>
                    <th className="p-1"></th>
                    <th className="p-1"></th>
                    <th className="p-1 text-right">Unid.</th>
                    <th className="p-1 text-right">Importe</th>
                    <th className="p-1 text-right">Unid.</th>
                    <th className="p-1 text-right">C.Unit.</th>
                    <th className="p-1 text-right">Importe</th>
                    <th className="p-1 text-right bg-green-600">Unid.</th>
                    <th className="p-1 text-right bg-green-600">Importe</th>
                    <th className="p-1 text-right bg-red-600">Unid.</th>
                    <th className="p-1 text-right bg-red-600">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.slice(0, 20).map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                      <td className="p-1 border-b dark:border-gray-700">{item.codigoBien}</td>
                      <td className="p-1 border-b dark:border-gray-700 max-w-[200px] truncate">{item.descripcion}</td>
                      <td className="p-1 border-b dark:border-gray-700">{item.unidadMedida}</td>
                      <td className="p-1 border-b dark:border-gray-700 text-right">{item.inventarioUnidad}</td>
                      <td className="p-1 border-b dark:border-gray-700 text-right">{item.inventarioImporte.toFixed(2)}</td>
                      <td className="p-1 border-b dark:border-gray-700 text-right">{item.kardexUnidad}</td>
                      <td className="p-1 border-b dark:border-gray-700 text-right">{item.costoUnitario.toFixed(2)}</td>
                      <td className="p-1 border-b dark:border-gray-700 text-right">{item.kardexImporte.toFixed(2)}</td>
                      <td className={cn("p-1 border-b dark:border-gray-700 text-right", item.sobrantesUnidad > 0 && "text-green-600 font-bold")}>
                        {item.sobrantesUnidad > 0 ? item.sobrantesUnidad : '-'}
                      </td>
                      <td className={cn("p-1 border-b dark:border-gray-700 text-right", item.sobrantesImporte > 0 && "text-green-600 font-bold")}>
                        {item.sobrantesImporte > 0 ? item.sobrantesImporte.toFixed(2) : '-'}
                      </td>
                      <td className={cn("p-1 border-b dark:border-gray-700 text-right", item.faltantesUnidad > 0 && "text-red-600 font-bold")}>
                        {item.faltantesUnidad > 0 ? item.faltantesUnidad : '-'}
                      </td>
                      <td className={cn("p-1 border-b dark:border-gray-700 text-right", item.faltantesImporte > 0 && "text-red-600 font-bold")}>
                        {item.faltantesImporte > 0 ? item.faltantesImporte.toFixed(2) : '-'}
                      </td>
                    </tr>
                  ))}
                  {previewItems.length > 20 && (
                    <tr className="bg-yellow-50 dark:bg-yellow-900/20">
                      <td colSpan={12} className="p-2 text-center text-yellow-700 dark:text-yellow-400">
                        ... y {previewItems.length - 20} items más
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-100 dark:bg-blue-900 font-bold">
                    <td colSpan={4} className="p-2 text-center">TOTALES</td>
                    <td className="p-2 text-right">{formatCurrency(previewTotals.inventario)}</td>
                    <td colSpan={2}></td>
                    <td className="p-2 text-right">{formatCurrency(previewTotals.kardex)}</td>
                    <td></td>
                    <td className="p-2 text-right text-green-700 dark:text-green-400">{formatCurrency(previewTotals.sobrantes)}</td>
                    <td></td>
                    <td className="p-2 text-right text-red-700 dark:text-red-400">{formatCurrency(previewTotals.faltantes)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de inventarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Inventarios Guardados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : inventarios.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No hay inventarios guardados
            </div>
          ) : (
            <div className="space-y-3">
              {inventarios.map((inv) => (
                <div
                  key={inv.id}
                  className="border rounded-lg p-4 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">{inv.nombre}</h4>
                        {inv.company && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                            {inv.company.razonSocial}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>Fecha: {formatDate(inv.fechaInventario)}</span>
                        <span>Items: {inv.totalItems}</span>
                        <span>Economato: {inv.codigoEconomato}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm">
                        <span className="text-blue-600 dark:text-blue-400">
                          Inventario: {formatCurrency(Number(inv.totalInventarioImporte))}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Kárdex: {formatCurrency(Number(inv.totalKardexImporte))}
                        </span>
                        {Number(inv.totalSobrantesImporte) > 0 && (
                          <span className="text-green-600 dark:text-green-400">
                            Sobrantes: {formatCurrency(Number(inv.totalSobrantesImporte))}
                          </span>
                        )}
                        {Number(inv.totalFaltantesImporte) > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            Faltantes: {formatCurrency(Number(inv.totalFaltantesImporte))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 relative">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowExcelOptions(showExcelOptions === inv.id ? null : inv.id)}
                        disabled={downloadingId === inv.id}
                      >
                        {downloadingId === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-1" />
                            Excel
                          </>
                        )}
                      </Button>

                      {/* Modal de opciones de Excel */}
                      {showExcelOptions === inv.id && (
                        <>
                          {/* Overlay para cerrar */}
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowExcelOptions(null)}
                          />
                          <div className="absolute left-0 right-auto sm:left-auto sm:right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 p-4 w-[280px] max-w-[calc(100vw-2rem)]">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Opciones de Excel</h4>

                          {!inv.company ? (
                            <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                              Este inventario no tiene empresa asociada. Las opciones de logo no aplicarán.
                            </p>
                          ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                              Empresa: {inv.company.razonSocial}
                            </p>
                          )}

                          <div className="space-y-3">
                            <label className={cn(
                              "flex items-center gap-2 cursor-pointer",
                              !inv.company && "opacity-50 pointer-events-none"
                            )}>
                              <input
                                type="checkbox"
                                checked={excelOptions.includeLogo}
                                onChange={(e) => setExcelOptions(prev => ({ ...prev, includeLogo: e.target.checked }))}
                                disabled={!inv.company}
                                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              <div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Incluir logo de empresa</span>
                                <p className="text-xs text-gray-400 dark:text-gray-500">En la esquina superior izquierda</p>
                              </div>
                            </label>
                          </div>

                          <div className="flex gap-2 mt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowExcelOptions(null)}
                              className="flex-1"
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDownload(inv.id, excelOptions)}
                              className="flex-1"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Descargar
                            </Button>
                          </div>
                        </div>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowReportOptions(showReportOptions === inv.id ? null : inv.id)}
                        disabled={generatingReportId === inv.id}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        {generatingReportId === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-1" />
                            Informe
                          </>
                        )}
                      </Button>

                      {/* Modal de opciones de Informe PDF */}
                      {showReportOptions === inv.id && (
                        <>
                          {/* Overlay para cerrar */}
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowReportOptions(null)}
                          />
                          <div className="absolute left-0 right-auto sm:left-auto sm:right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 p-4 w-[300px] max-w-[calc(100vw-2rem)]">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Opciones del Informe PDF</h4>

                            {!inv.company ? (
                              <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                                Este inventario no tiene empresa asociada. Las opciones de logo, firma y huella no aplicarán.
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                Empresa: {inv.company.razonSocial}
                              </p>
                            )}

                            <div className="space-y-3">
                              <label className={cn(
                                "flex items-center gap-2 cursor-pointer",
                                !inv.company && "opacity-50 pointer-events-none"
                              )}>
                                <input
                                  type="checkbox"
                                  checked={reportOptions.includeLogo}
                                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeLogo: e.target.checked }))}
                                  disabled={!inv.company}
                                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <div>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">Incluir logo de empresa</span>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">En el encabezado del informe</p>
                                </div>
                              </label>

                              <label className={cn(
                                "flex items-center gap-2 cursor-pointer",
                                !inv.company && "opacity-50 pointer-events-none"
                              )}>
                                <input
                                  type="checkbox"
                                  checked={reportOptions.includeFirma}
                                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeFirma: e.target.checked }))}
                                  disabled={!inv.company}
                                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <div>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">Incluir firma digital</span>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">Firma del responsable del inventario</p>
                                </div>
                              </label>

                              <label className={cn(
                                "flex items-center gap-2 cursor-pointer",
                                !inv.company && "opacity-50 pointer-events-none"
                              )}>
                                <input
                                  type="checkbox"
                                  checked={reportOptions.includeHuella}
                                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeHuella: e.target.checked }))}
                                  disabled={!inv.company}
                                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <div>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">Incluir huella digital</span>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">Huella del responsable del inventario</p>
                                </div>
                              </label>
                            </div>

                            <div className="flex gap-2 mt-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowReportOptions(null)}
                                className="flex-1"
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleGenerateReport(inv.id, reportOptions)}
                                className="flex-1"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Generar PDF
                              </Button>
                            </div>
                          </div>
                        </>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(inv.id)}
                        disabled={deletingId === inv.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {deletingId === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
