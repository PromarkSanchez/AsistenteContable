'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Building2,
  FileText,
  Bot,
  Crown,
  UserCheck,
  Settings2,
  Bell,
  Shield,
  AlertTriangle,
  DollarSign,
  MessageSquare,
  Star,
  TrendingUp,
  Activity,
  Lock,
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';

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

interface DashboardData {
  kpis: {
    users: { total: number; active: number; newToday: number; newThisWeek: number };
    companies: { total: number; active: number };
    ai: { totalRequests: number; totalCost: number; todayRequests: number; todayCost: number };
    security: { eventsToday: number; unresolvedEvents: number; blockedIPs: number };
    feedback: { pending: number; avgRating: number };
  };
  recentSecurityEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    description: string;
    createdAt: string;
  }>;
  aiUsageSummary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    successRate: number;
    avgResponseTime: number;
  };
  userTrends: Array<{ date: string; users: number; companies: number }>;
  pendingFeedback: Array<{
    id: string;
    type: string;
    title: string | null;
    rating: number | null;
    createdAt: string;
  }>;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar stats básicos y dashboard KPIs en paralelo
        const [statsResponse, dashboardResponse] = await Promise.all([
          fetch('/api/admin/stats', {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          apiClient.get<DashboardData>('/api/admin/dashboard'),
        ]);

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }

        setDashboard(dashboardResponse);
      } catch (err) {
        console.error('Error cargando dashboard:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    loadData();
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

  const kpis = dashboard?.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Panel de Administración</h1>
        <p className="text-gray-600 dark:text-gray-400">Gestiona usuarios, empresas y monitorea el sistema</p>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Usuarios</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpis?.users.total || stats?.totalUsers || 0}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs">
              <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
              <span className="text-green-600 dark:text-green-400">+{kpis?.users.newThisWeek || 0} esta semana</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Empresas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpis?.companies.total || stats?.totalCompanies || 0}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Solicitudes IA</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpis?.ai.totalRequests || 0}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {kpis?.ai.todayRequests || 0} hoy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Costo IA (Mes)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">${(kpis?.ai.totalCost || 0).toFixed(2)}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              ${(kpis?.ai.todayCost || 0).toFixed(4)} hoy
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seguridad y Feedback */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Eventos de Seguridad</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis?.security.eventsToday || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {kpis?.security.unresolvedEvents || 0} sin resolver
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">IPs Bloqueadas (24h)</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis?.security.blockedIPs || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Por rate limit
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <Lock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Feedback Pendiente</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis?.feedback.pending || 0}</p>
                <div className="flex items-center mt-1">
                  <Star className="w-3 h-3 text-yellow-500 mr-1" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {(kpis?.feedback.avgRating || 0).toFixed(1)} promedio
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Uso de IA detallado */}
      {dashboard?.aiUsageSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Métricas de IA (Este Mes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard.aiUsageSummary.totalRequests}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Solicitudes</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(dashboard.aiUsageSummary.totalTokens / 1000).toFixed(1)}K</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tokens</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">${dashboard.aiUsageSummary.totalCost.toFixed(2)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Costo Total</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{dashboard.aiUsageSummary.successRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tasa de éxito</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard.aiUsageSummary.avgResponseTime.toFixed(0)}ms</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tiempo promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/admin/users">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Usuarios</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Gestionar cuentas</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/companies">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Empresas</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ver empresas</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/plans">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <Crown className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Planes</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Configurar límites</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/ai-config">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">IA Config</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Proveedores IA</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/smtp">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Correo SMTP</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Configurar email</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/branding">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Branding</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Personalizar</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/alerts">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Alertas</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Notificaciones</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/feedback">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Feedback</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{kpis?.feedback.pending || 0} pendientes</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Eventos de seguridad recientes */}
      {dashboard?.recentSecurityEvents && dashboard.recentSecurityEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Eventos de Seguridad Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard.recentSecurityEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      event.severity === 'critical' ? 'bg-red-500' :
                      event.severity === 'high' ? 'bg-orange-500' :
                      event.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{event.eventType}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{event.description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(event.createdAt).toLocaleTimeString('es-PE')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Fecha</th>
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
                            : user.plan === 'BASIC'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
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
