'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Plus,
  Upload,
  QrCode,
  Search,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  ChevronDown,
  FileUp,
  PenLine,
} from 'lucide-react';
import { InvoiceViewer } from '@/components/invoice-viewer';
import { QrScanner } from '@/components/qr-scanner';
import { useCompanyStore } from '@/store/company-store';
import { comprobantesApi } from '@/lib/api-client';
import { formatCurrency, formatPeriodo, getCurrentPeriodo, formatDate, TIPO_DOCUMENTO_NOMBRES } from '@/lib/utils';
import Link from 'next/link';
import type { Comprobante, PeriodoResumen } from '@/types';

export default function ComprobantesPage() {
  const { selectedCompany } = useCompanyStore();
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(getCurrentPeriodo());
  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | 'VENTA' | 'COMPRA'>('TODOS');
  const [fechaCarga, setFechaCarga] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [viewingComprobante, setViewingComprobante] = useState<Comprobante | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showNuevoMenu, setShowNuevoMenu] = useState(false);
  const limit = 20;

  useEffect(() => {
    if (selectedCompany) {
      loadPeriodos();
      loadComprobantes();
    }
  }, [selectedCompany, periodoSeleccionado, tipoFiltro, page]);

  const loadPeriodos = async () => {
    if (!selectedCompany) return;
    try {
      const data = await comprobantesApi.getPeriodos(selectedCompany.id);
      setPeriodos(data);
    } catch (err) {
      console.error('Error cargando períodos:', err);
    }
  };

  const loadComprobantes = async () => {
    if (!selectedCompany) return;
    try {
      setLoading(true);
      setError(null);
      const response = await comprobantesApi.list(selectedCompany.id, {
        periodo: periodoSeleccionado,
        tipo: tipoFiltro === 'TODOS' ? undefined : tipoFiltro,
        skip: page * limit,
        limit,
      });
      setComprobantes(response.data);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar comprobantes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (comprobanteId: string) => {
    if (!selectedCompany) return;
    if (!confirm('¿Está seguro de eliminar este comprobante?')) return;

    try {
      await comprobantesApi.delete(selectedCompany.id, comprobanteId);
      loadComprobantes();
      loadPeriodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const filteredComprobantes = comprobantes.filter((c) => {
    // Filtro por fecha de carga
    if (fechaCarga) {
      const cargaDate = c.createdAt?.split('T')[0]; // "2026-01-15"
      if (cargaDate !== fechaCarga) return false;
    }

    // Filtro por búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        c.serie.toLowerCase().includes(search) ||
        c.numero.toLowerCase().includes(search) ||
        c.razonSocialTercero?.toLowerCase().includes(search) ||
        c.rucTercero?.includes(search)
      );
    }

    return true;
  });

  if (!selectedCompany) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Selecciona una empresa para ver los comprobantes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Comprobantes</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona tus ventas y compras</p>
        </div>
        <div className="flex gap-2">
          {/* Dropdown Nuevo */}
          <div className="relative">
            <Button
              onClick={() => setShowNuevoMenu(!showNuevoMenu)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo
              <ChevronDown className={`w-4 h-4 transition-transform ${showNuevoMenu ? 'rotate-180' : ''}`} />
            </Button>

            {showNuevoMenu && (
              <>
                {/* Overlay para cerrar el menú */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowNuevoMenu(false)}
                />
                {/* Menú dropdown - en móvil alinea a la izquierda, en desktop a la derecha */}
                <div className="absolute left-0 right-auto sm:left-auto sm:right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-1">
                  <button
                    onClick={() => {
                      setShowQrScanner(true);
                      setShowNuevoMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200"
                  >
                    <QrCode className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-medium">Escanear QR</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Desde factura física</div>
                    </div>
                  </button>
                  <Link
                    href="/importar"
                    onClick={() => setShowNuevoMenu(false)}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200"
                  >
                    <FileUp className="w-4 h-4 text-green-600" />
                    <div>
                      <div className="font-medium">Importar XML/ZIP</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Desde archivo SUNAT</div>
                    </div>
                  </Link>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                  <button
                    onClick={() => {
                      alert('Próximamente: Registro manual de comprobantes');
                      setShowNuevoMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200"
                  >
                    <PenLine className="w-4 h-4 text-purple-600" />
                    <div>
                      <div className="font-medium">Registro Manual</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Ingresar datos a mano</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Período</label>
              <select
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={periodoSeleccionado}
                onChange={(e) => {
                  setPeriodoSeleccionado(e.target.value);
                  setPage(0);
                }}
              >
                <option value={getCurrentPeriodo()}>
                  {formatPeriodo(getCurrentPeriodo())} (actual)
                </option>
                {periodos
                  .filter((p) => p.periodo !== getCurrentPeriodo())
                  .map((p) => (
                    <option key={p.periodo} value={p.periodo}>
                      {formatPeriodo(p.periodo)} ({p.total} comprobantes)
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
              <select
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={tipoFiltro}
                onChange={(e) => {
                  setTipoFiltro(e.target.value as typeof tipoFiltro);
                  setPage(0);
                }}
              >
                <option value="TODOS">Todos</option>
                <option value="VENTA">Ventas</option>
                <option value="COMPRA">Compras</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Carga</label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  className="flex-1"
                  value={fechaCarga}
                  onChange={(e) => setFechaCarga(e.target.value)}
                />
                {fechaCarga && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFechaCarga('')}
                    className="px-2"
                    title="Limpiar filtro"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Serie, número, RUC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de comprobantes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lista de Comprobantes</span>
            <span className="text-sm font-normal text-gray-500">
              {total} comprobante{total !== 1 ? 's' : ''}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="spinner mx-auto mb-4" />
              <p className="text-gray-500">Cargando comprobantes...</p>
            </div>
          ) : filteredComprobantes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay comprobantes
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchTerm
                  ? 'No se encontraron resultados para tu búsqueda'
                  : 'Comienza agregando tu primer comprobante'}
              </p>
              {!searchTerm && (
                <Link href="/comprobantes/nuevo">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Comprobante
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Tabla */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-700">
                      <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Tipo</th>
                      <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Serie-Número</th>
                      <th className="text-left p-3 font-medium text-gray-900 dark:text-white">F. Emisión</th>
                      <th className="text-left p-3 font-medium text-gray-900 dark:text-white">F. Carga</th>
                      <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Tercero</th>
                      <th className="text-right p-3 font-medium text-gray-900 dark:text-white">Base Imp.</th>
                      <th className="text-right p-3 font-medium text-gray-900 dark:text-white">IGV</th>
                      <th className="text-right p-3 font-medium text-gray-900 dark:text-white">Total</th>
                      <th className="text-center p-3 font-medium text-gray-900 dark:text-white">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComprobantes.map((c) => (
                      <tr key={c.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              c.tipo === 'VENTA'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}
                          >
                            {c.tipo}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-gray-900 dark:text-white">{c.serie}-{c.numero}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {TIPO_DOCUMENTO_NOMBRES[c.tipoDocumento] || c.tipoDocumento}
                          </div>
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">
                          {formatDate(c.fechaEmision)}
                        </td>
                        <td className="p-3 text-gray-500 dark:text-gray-500 text-xs">
                          {formatDate(c.createdAt)}
                        </td>
                        <td className="p-3">
                          <div className="text-gray-900 dark:text-white truncate max-w-[200px]">
                            {c.razonSocialTercero || '-'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{c.rucTercero || '-'}</div>
                        </td>
                        <td className="p-3 text-right font-mono text-gray-900 dark:text-white">
                          {formatCurrency(c.baseImponible)}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">
                          {formatCurrency(c.igv)}
                        </td>
                        <td className="p-3 text-right font-mono font-medium text-gray-900 dark:text-white">
                          {formatCurrency(c.total)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingComprobante(c)}
                              title="Ver comprobante y descargar PDF"
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(c.id)}
                              title="Eliminar comprobante"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {total > limit && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, total)} de{' '}
                    {total}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={(page + 1) * limit >= total}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoice Viewer Modal */}
      {viewingComprobante && selectedCompany && (
        <InvoiceViewer
          comprobante={viewingComprobante}
          company={selectedCompany}
          onClose={() => setViewingComprobante(null)}
        />
      )}

      {/* QR Scanner Modal */}
      {showQrScanner && selectedCompany && (
        <QrScanner
          company={selectedCompany}
          onClose={() => setShowQrScanner(false)}
          onSuccess={() => {
            loadComprobantes();
            loadPeriodos();
          }}
        />
      )}
    </div>
  );
}
