'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Building2,
  FileText,
  TrendingUp,
  Bot,
  Crown,
  UserCheck,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalCompanies: number;
  totalComprobantes: number;
  comprobantesThisMonth: number;
  usersByPlan: Record<string, number>;
  recentUsers: Array<{
    id: string;
    email: string;
    fullName: string | null;
    plan: string;
    createdAt: string;
    companiesCount: number;
  }>;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/admin/stats', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Error cargando estadísticas');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [accessToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Panel de Administración</h1>
        <p className="text-gray-600 dark:text-gray-400">Gestiona usuarios, empresas y configuraciones del sistema</p>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Usuarios</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats?.totalUsers || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {stats?.activeUsers || 0} activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Empresas</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats?.totalCompanies || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Comprobantes</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats?.totalComprobantes || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {stats?.comprobantesThisMonth || 0} este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Planes PRO</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats?.usersByPlan?.PRO || 0}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <Crown className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {stats?.usersByPlan?.FREE || 0} en plan FREE
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/users">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Gestión de Usuarios</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ver, editar y administrar usuarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/companies">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Gestión de Empresas</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Administrar empresas registradas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/ai-config">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Configuración IA</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Configurar asistente de IA</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Usuarios recientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Usuarios Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentUsers && stats.recentUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Usuario</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Plan</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Empresas</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Fecha Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentUsers.map((user) => (
                    <tr key={user.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{user.fullName || 'Sin nombre'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.plan === 'PRO'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {user.plan}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">{user.companiesCount}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString('es-PE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay usuarios registrados</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
