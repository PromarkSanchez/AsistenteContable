'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Search,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  Crown,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

interface User {
  id: string;
  email: string;
  fullName: string | null;
  plan: string;
  isActive: boolean;
  isSuperadmin: boolean;
  createdAt: string;
  updatedAt: string;
  companiesCount: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const { accessToken, user: currentUser } = useAuthStore();
  const limit = 15;

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
      });

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) throw new Error('Error cargando usuarios');

      const data = await response.json();
      setUsers(data.data);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, accessToken]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadUsers();
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Error actualizando usuario');
        return;
      }

      await loadUsers();
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert('Error actualizando usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario ${email}? Esta acción eliminará todas sus empresas y comprobantes.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Error eliminando usuario');
        return;
      }

      await loadUsers();
    } catch (err) {
      console.error(err);
      alert('Error eliminando usuario');
    }
  };

  const cyclePlan = (user: User) => {
    // Ciclar entre FREE -> BASIC -> PRO -> FREE
    const planCycle: Record<string, string> = {
      'FREE': 'BASIC',
      'BASIC': 'PRO',
      'PRO': 'FREE',
    };
    const newPlan = planCycle[user.plan] || 'FREE';
    handleUpdateUser(user.id, { plan: newPlan } as any);
  };

  const getPlanStyle = (plan: string) => {
    switch (plan) {
      case 'PRO':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'BASIC':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const toggleActive = (user: User) => {
    handleUpdateUser(user.id, { isActive: !user.isActive } as any);
  };

  const toggleAdmin = (user: User) => {
    if (user.id === currentUser?.id) {
      alert('No puedes quitarte tus propios privilegios de administrador');
      return;
    }
    handleUpdateUser(user.id, { isSuperadmin: !user.isSuperadmin } as any);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Gestión de Usuarios</h1>
          <p className="text-gray-600 dark:text-gray-400">Administra los usuarios del sistema</p>
        </div>
      </div>

      {/* Leyenda de Planes */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs font-medium">FREE</span>
              <span className="text-gray-600 dark:text-gray-400">1 empresa, sin IA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">BASIC</span>
              <span className="text-gray-600 dark:text-gray-400">3 empresas, IA básica</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-medium inline-flex items-center gap-1">
                <Crown className="w-3 h-3" /> PRO
              </span>
              <span className="text-gray-600 dark:text-gray-400">Ilimitado, todas las funciones IA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 text-xs font-medium inline-flex items-center gap-1">
                <Shield className="w-3 h-3" /> Admin
              </span>
              <span className="text-gray-600 dark:text-gray-400">Acceso total automático</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Búsqueda */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Buscar por email o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit">Buscar</Button>
          </form>
        </CardContent>
      </Card>

      {/* Tabla de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Lista de Usuarios
            </span>
            <span className="text-sm font-normal text-gray-500">
              {total} usuario{total !== 1 ? 's' : ''}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No se encontraron usuarios</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800">
                      <th className="text-left p-3 font-medium">Usuario</th>
                      <th className="text-left p-3 font-medium">Plan</th>
                      <th className="text-center p-3 font-medium">Empresas</th>
                      <th className="text-center p-3 font-medium">Estado</th>
                      <th className="text-center p-3 font-medium">Admin</th>
                      <th className="text-left p-3 font-medium">Registro</th>
                      <th className="text-center p-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {user.fullName || 'Sin nombre'}
                            </p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => cyclePlan(user)}
                            title="Clic para cambiar plan (FREE → BASIC → PRO)"
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${getPlanStyle(user.plan)}`}
                          >
                            {user.plan === 'PRO' && <Crown className="w-3 h-3" />}
                            {user.plan}
                          </button>
                        </td>
                        <td className="p-3 text-center text-gray-600 dark:text-gray-400">
                          {user.companiesCount}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => toggleActive(user)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                              user.isActive
                                ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {user.isActive ? (
                              <>
                                <UserCheck className="w-3 h-3" /> Activo
                              </>
                            ) : (
                              <>
                                <UserX className="w-3 h-3" /> Inactivo
                              </>
                            )}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => toggleAdmin(user)}
                            disabled={user.id === currentUser?.id}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                              user.isSuperadmin
                                ? 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                            } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {user.isSuperadmin ? (
                              <>
                                <Shield className="w-3 h-3" /> Admin
                              </>
                            ) : (
                              <>
                                <ShieldOff className="w-3 h-3" /> No
                              </>
                            )}
                          </button>
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString('es-PE')}
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            disabled={user.id === currentUser?.id}
                            title={user.id === currentUser?.id ? 'No puedes eliminarte a ti mismo' : 'Eliminar usuario'}
                          >
                            <Trash2 className={`w-4 h-4 ${user.id === currentUser?.id ? 'text-gray-300' : 'text-red-500'}`} />
                          </Button>
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
