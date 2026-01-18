'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  Crown,
  Building2,
  Bot,
  FileText,
  Zap,
  Loader2,
  Save,
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

// Track pending changes per user
interface PendingChanges {
  [userId: string]: {
    plan?: string;
    isActive?: boolean;
    isSuperadmin?: boolean;
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({});
  const [savingUsers, setSavingUsers] = useState<Set<string>>(new Set());
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
      setPendingChanges({}); // Clear pending changes on reload
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

  // Track a change for a user
  const trackChange = (userId: string, field: string, value: unknown) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    setPendingChanges(prev => {
      const userChanges = prev[userId] || {};
      const originalValue = user[field as keyof User];

      // If the value is back to original, remove the change
      if (value === originalValue) {
        const newChanges = { ...userChanges };
        delete newChanges[field as keyof typeof newChanges];
        if (Object.keys(newChanges).length === 0) {
          const restChanges = { ...prev };
          delete restChanges[userId];
          return restChanges;
        }
        return { ...prev, [userId]: newChanges };
      }

      return {
        ...prev,
        [userId]: { ...userChanges, [field]: value }
      };
    });
  };

  // Get the current value (pending or original)
  const getValue = (user: User, field: keyof User) => {
    const pending = pendingChanges[user.id];
    if (pending && field in pending) {
      return pending[field as keyof typeof pending];
    }
    return user[field];
  };

  // Check if user has pending changes
  const hasPendingChanges = (userId: string) => {
    return !!pendingChanges[userId] && Object.keys(pendingChanges[userId]).length > 0;
  };

  // Save changes for a specific user
  const saveUserChanges = async (userId: string) => {
    const changes = pendingChanges[userId];
    if (!changes || Object.keys(changes).length === 0) return;

    setSavingUsers(prev => new Set(prev).add(userId));

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(changes),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Error actualizando usuario');
        return;
      }

      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          return { ...u, ...changes };
        }
        return u;
      }));

      // Clear pending changes for this user
      setPendingChanges(prev => {
        const { [userId]: _, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      console.error(err);
      alert('Error actualizando usuario');
    } finally {
      setSavingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  // Save all pending changes
  const saveAllChanges = async () => {
    const userIds = Object.keys(pendingChanges);
    for (const userId of userIds) {
      await saveUserChanges(userId);
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

  const getPlanStyle = (plan: string, isChanged: boolean) => {
    const baseStyle = isChanged ? 'ring-2 ring-offset-1 ' : '';
    switch (plan) {
      case 'PRO':
        return baseStyle + 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 ring-yellow-500';
      case 'BASIC':
        return baseStyle + 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 ring-blue-500';
      default:
        return baseStyle + 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 ring-gray-500';
    }
  };

  const totalPendingChanges = Object.keys(pendingChanges).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Gestión de Usuarios</h1>
          <p className="text-gray-600 dark:text-gray-400">Administra los usuarios del sistema</p>
        </div>
        {totalPendingChanges > 0 && (
          <Button onClick={saveAllChanges} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Guardar {totalPendingChanges} cambio{totalPendingChanges > 1 ? 's' : ''}
          </Button>
        )}
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
              <span className="text-gray-600 dark:text-gray-400">Ilimitado, todas las funciones</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 text-xs font-medium inline-flex items-center gap-1">
                <Shield className="w-3 h-3" /> Admin
              </span>
              <span className="text-gray-600 dark:text-gray-400">Acceso total</span>
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
                    {users.map((user) => {
                      const currentPlan = getValue(user, 'plan') as string;
                      const currentIsActive = getValue(user, 'isActive') as boolean;
                      const currentIsSuperadmin = getValue(user, 'isSuperadmin') as boolean;
                      const hasChanges = hasPendingChanges(user.id);
                      const isSaving = savingUsers.has(user.id);
                      const isPlanChanged = pendingChanges[user.id]?.plan !== undefined;
                      const isActiveChanged = pendingChanges[user.id]?.isActive !== undefined;
                      const isAdminChanged = pendingChanges[user.id]?.isSuperadmin !== undefined;

                      return (
                        <tr
                          key={user.id}
                          className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                            hasChanges ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                          }`}
                        >
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {user.fullName || 'Sin nombre'}
                              </p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <select
                              value={currentPlan}
                              onChange={(e) => trackChange(user.id, 'plan', e.target.value)}
                              className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer border-0 appearance-none ${getPlanStyle(currentPlan, isPlanChanged)}`}
                              style={{ backgroundImage: 'none' }}
                            >
                              <option value="FREE">FREE</option>
                              <option value="BASIC">BASIC</option>
                              <option value="PRO">PRO</option>
                            </select>
                          </td>
                          <td className="p-3 text-center text-gray-600 dark:text-gray-400">
                            {user.companiesCount}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => trackChange(user.id, 'isActive', !currentIsActive)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                isActiveChanged ? 'ring-2 ring-offset-1 ' : ''
                              }${
                                currentIsActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 ring-green-500'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 ring-red-500'
                              }`}
                            >
                              {currentIsActive ? (
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
                              onClick={() => {
                                if (user.id === currentUser?.id) {
                                  alert('No puedes quitarte tus propios privilegios de administrador');
                                  return;
                                }
                                trackChange(user.id, 'isSuperadmin', !currentIsSuperadmin);
                              }}
                              disabled={user.id === currentUser?.id}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                isAdminChanged ? 'ring-2 ring-offset-1 ' : ''
                              }${
                                currentIsSuperadmin
                                  ? 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 ring-purple-500'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 ring-gray-500'
                              } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {currentIsSuperadmin ? (
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
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              {hasChanges && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => saveUserChanges(user.id)}
                                  disabled={isSaving}
                                  title="Guardar cambios"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Save className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id, user.email)}
                                disabled={user.id === currentUser?.id}
                                title={user.id === currentUser?.id ? 'No puedes eliminarte a ti mismo' : 'Eliminar usuario'}
                              >
                                <Trash2 className={`w-4 h-4 ${user.id === currentUser?.id ? 'text-gray-300' : 'text-red-500'}`} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

      {/* Indicador flotante de cambios pendientes */}
      {totalPendingChanges > 0 && (
        <div className="fixed bottom-4 right-4 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <span className="text-sm font-medium">
            {totalPendingChanges} usuario{totalPendingChanges > 1 ? 's' : ''} con cambios sin guardar
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={saveAllChanges}
            className="bg-white text-amber-600 hover:bg-amber-50"
          >
            <Save className="w-4 h-4 mr-1" />
            Guardar todo
          </Button>
        </div>
      )}
    </div>
  );
}
