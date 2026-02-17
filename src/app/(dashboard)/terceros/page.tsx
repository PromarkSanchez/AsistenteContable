'use client';

import { useEffect, useState } from 'react';
import { useCompanyStore } from '@/store/company-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import {
  Users,
  Search,
  Building2,
  UserCheck,
  Truck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Shield,
  Star,
  Filter,
} from 'lucide-react';

interface TerceroData {
  doc: string;
  tipoDoc: string;
  nombre: string;
  totalVentas: number;
  totalCompras: number;
  igvVentas: number;
  igvCompras: number;
  cantidadVentas: number;
  cantidadCompras: number;
  ultimaOperacion: string | null;
  primeraOperacion: string | null;
  tipoRelacion: 'cliente' | 'proveedor' | 'ambos';
  info: {
    direccion: string | null;
    estado: string | null;
    condicion: string | null;
    esAgenteRetencion: boolean;
    esBuenContribuyente: boolean;
  } | null;
}

interface TercerosResponse {
  data: TerceroData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalTerceros: number;
    totalClientes: number;
    totalProveedores: number;
    totalVentas: number;
    totalCompras: number;
  };
}

export default function TercerosPage() {
  const { selectedCompany } = useCompanyStore();
  const [terceros, setTerceros] = useState<TerceroData[]>([]);
  const [stats, setStats] = useState<TercerosResponse['stats'] | null>(null);
  const [pagination, setPagination] = useState<TercerosResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'cliente' | 'proveedor'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);

  const [selectedTercero, setSelectedTercero] = useState<TerceroData | null>(null);

  useEffect(() => {
    if (!selectedCompany) return;

    const loadTerceros = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (filtroTipo !== 'todos') params.set('tipo', filtroTipo);
        if (busqueda) params.set('search', busqueda);
        params.set('page', page.toString());
        params.set('limit', '15');

        const result = await apiClient.get<TercerosResponse>(
          `/api/companies/${selectedCompany.id}/terceros?${params.toString()}`
        );

        setTerceros(result.data);
        setStats(result.stats);
        setPagination(result.pagination);
      } catch (err) {
        console.error('Error cargando terceros:', err);
        setError('Error al cargar los terceros');
      } finally {
        setLoading(false);
      }
    };

    loadTerceros();
  }, [selectedCompany, filtroTipo, busqueda, page]);

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Selecciona una empresa
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Necesitas seleccionar una empresa para ver los terceros
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary-600" />
            Clientes y Proveedores
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestiona tus relaciones comerciales
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Terceros</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalTerceros}</p>
                </div>
                <Users className="w-8 h-8 text-primary-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Clientes</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.totalClientes}</p>
                </div>
                <UserCheck className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Proveedores</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalProveedores}</p>
                </div>
                <Truck className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Volumen Total</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(stats.totalVentas + stats.totalCompras)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre o RUC/DNI..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filtroTipo === 'todos' ? 'primary' : 'outline'}
                onClick={() => { setFiltroTipo('todos'); setPage(1); }}
                size="sm"
              >
                <Filter className="w-4 h-4 mr-1" />
                Todos
              </Button>
              <Button
                variant={filtroTipo === 'cliente' ? 'primary' : 'outline'}
                onClick={() => { setFiltroTipo('cliente'); setPage(1); }}
                size="sm"
              >
                <UserCheck className="w-4 h-4 mr-1" />
                Clientes
              </Button>
              <Button
                variant={filtroTipo === 'proveedor' ? 'primary' : 'outline'}
                onClick={() => { setFiltroTipo('proveedor'); setPage(1); }}
                size="sm"
              >
                <Truck className="w-4 h-4 mr-1" />
                Proveedores
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      )}

      {/* Lista de Terceros */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="lg:col-span-2 space-y-3">
            {terceros.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">No se encontraron terceros</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Registra comprobantes para ver clientes y proveedores
                  </p>
                </CardContent>
              </Card>
            ) : (
              terceros.map((tercero) => (
                <Card
                  key={tercero.doc}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTercero?.doc === tercero.doc ? 'ring-2 ring-primary-500' : ''
                  }`}
                  onClick={() => setSelectedTercero(tercero)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            tercero.tipoRelacion === 'cliente'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : tercero.tipoRelacion === 'proveedor'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          }`}>
                            {tercero.tipoRelacion === 'cliente' ? 'Cliente' : tercero.tipoRelacion === 'proveedor' ? 'Proveedor' : 'Ambos'}
                          </span>
                          {tercero.info?.esAgenteRetencion && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              <Shield className="w-3 h-3" />
                              Ag. Ret.
                            </span>
                          )}
                          {tercero.info?.esBuenContribuyente && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <Star className="w-3 h-3" />
                              Buen Contrib.
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {tercero.nombre}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {tercero.tipoDoc === '6' ? 'RUC' : tercero.tipoDoc === '1' ? 'DNI' : 'Doc'}: {tercero.doc}
                        </p>
                      </div>
                      <div className="text-right">
                        {tercero.totalVentas > 0 && (
                          <p className="text-sm">
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {formatCurrency(tercero.totalVentas)}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">ventas</span>
                          </p>
                        )}
                        {tercero.totalCompras > 0 && (
                          <p className="text-sm">
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              {formatCurrency(tercero.totalCompras)}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">compras</span>
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {tercero.cantidadVentas + tercero.cantidadCompras} operaciones
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Paginación */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Panel de Detalle */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Detalle del Tercero</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedTercero ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {selectedTercero.nombre}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        {selectedTercero.tipoDoc === '6' ? 'RUC' : 'DNI'}: {selectedTercero.doc}
                      </p>
                    </div>

                    {selectedTercero.info?.direccion && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Dirección</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {selectedTercero.info.direccion}
                        </p>
                      </div>
                    )}

                    {selectedTercero.info && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <p className="text-xs text-gray-500">Estado</p>
                          <p className={`text-sm font-medium ${
                            selectedTercero.info.estado === 'ACTIVO' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {selectedTercero.info.estado || 'N/D'}
                          </p>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <p className="text-xs text-gray-500">Condición</p>
                          <p className={`text-sm font-medium ${
                            selectedTercero.info.condicion === 'HABIDO' ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {selectedTercero.info.condicion || 'N/D'}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4 space-y-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Resumen de Operaciones</h4>

                      {selectedTercero.totalVentas > 0 && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">Ventas</span>
                          </div>
                          <p className="text-xl font-bold text-green-700 dark:text-green-300">
                            {formatCurrency(selectedTercero.totalVentas)}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            {selectedTercero.cantidadVentas} comprobantes | IGV: {formatCurrency(selectedTercero.igvVentas)}
                          </p>
                        </div>
                      )}

                      {selectedTercero.totalCompras > 0 && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Compras</span>
                          </div>
                          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                            {formatCurrency(selectedTercero.totalCompras)}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            {selectedTercero.cantidadCompras} comprobantes | IGV: {formatCurrency(selectedTercero.igvCompras)}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <p className="text-gray-500">Primera Op.</p>
                          <p className="font-medium text-gray-700 dark:text-gray-300">
                            {selectedTercero.primeraOperacion
                              ? new Date(selectedTercero.primeraOperacion).toLocaleDateString('es-PE')
                              : 'N/D'}
                          </p>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <p className="text-gray-500">Última Op.</p>
                          <p className="font-medium text-gray-700 dark:text-gray-300">
                            {selectedTercero.ultimaOperacion
                              ? new Date(selectedTercero.ultimaOperacion).toLocaleDateString('es-PE')
                              : 'N/D'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Selecciona un tercero para ver el detalle</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
