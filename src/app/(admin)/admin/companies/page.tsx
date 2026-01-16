'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  User,
  ExternalLink,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

interface Company {
  id: string;
  ruc: string;
  razonSocial: string;
  regimen: string;
  hasCredentials: boolean;
  createdAt: string;
  comprobantesCount: number;
  declaracionesCount: number;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const { accessToken } = useAuthStore();
  const limit = 15;

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
      });

      const response = await fetch(`/api/admin/companies?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) throw new Error('Error cargando empresas');

      const data = await response.json();
      setCompanies(data.data);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [page, accessToken]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadCompanies();
  };

  const handleDeleteCompany = async (companyId: string, razonSocial: string) => {
    if (!confirm(`¿Estás seguro de eliminar la empresa "${razonSocial}"? Esta acción eliminará todos sus comprobantes y declaraciones.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Error eliminando empresa');
        return;
      }

      await loadCompanies();
    } catch (err) {
      console.error(err);
      alert('Error eliminando empresa');
    }
  };

  const formatRegimen = (regimen: string) => {
    const regimenes: Record<string, string> = {
      'GENERAL': 'General',
      'MYPE': 'MYPE',
      'RER': 'RER',
      'RUS': 'RUS',
    };
    return regimenes[regimen] || regimen;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Gestión de Empresas</h1>
          <p className="text-gray-600 dark:text-gray-400">Administra las empresas registradas en el sistema</p>
        </div>
      </div>

      {/* Búsqueda */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Buscar por RUC o razón social..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit">Buscar</Button>
          </form>
        </CardContent>
      </Card>

      {/* Tabla de empresas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Lista de Empresas
            </span>
            <span className="text-sm font-normal text-gray-500">
              {total} empresa{total !== 1 ? 's' : ''}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : companies.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No se encontraron empresas</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800">
                      <th className="text-left p-3 font-medium">Empresa</th>
                      <th className="text-left p-3 font-medium">Propietario</th>
                      <th className="text-center p-3 font-medium">Régimen</th>
                      <th className="text-center p-3 font-medium">SUNAT</th>
                      <th className="text-center p-3 font-medium">Comprobantes</th>
                      <th className="text-left p-3 font-medium">Registro</th>
                      <th className="text-center p-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company) => (
                      <tr key={company.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {company.razonSocial}
                            </p>
                            <p className="text-xs text-gray-500">RUC: {company.ruc}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-gray-900 dark:text-white text-sm">
                                {company.user.fullName || 'Sin nombre'}
                              </p>
                              <p className="text-xs text-gray-500">{company.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {formatRegimen(company.regimen)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {company.hasCredentials ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              Configurado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              <XCircle className="w-3 h-3" />
                              Sin credenciales
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-400">
                              {company.comprobantesCount}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">
                          {new Date(company.createdAt).toLocaleDateString('es-PE')}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCompany(company.id, company.razonSocial)}
                              title="Eliminar empresa"
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
                  <div className="text-sm text-gray-500">
                    Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, total)} de {total}
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
    </div>
  );
}
