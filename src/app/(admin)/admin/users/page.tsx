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
  X,
  Check,
  Building2,
  Bot,
  FileText,
  Zap,
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

// Definición de planes con sus características
const PLANS_INFO = {
  FREE: {
    name: 'FREE',
    color: 'gray',
    description: 'Plan gratuito básico',
    features: [
      { label: '1 empresa', icon: Building2 },
      { label: 'Sin asistente IA', icon: Bot, disabled: true },
      { label: '50 comprobantes/mes', icon: FileText },
    ],
    price: 'Gratis',
  },
  BASIC: {
    name: 'BASIC',
    color: 'blue',
    description: 'Para pequeños negocios',
    features: [
      { label: '3 empresas', icon: Building2 },
      { label: 'IA básica (50 consultas)', icon: Bot },
      { label: '500 comprobantes/mes', icon: FileText },
    ],
    price: 'S/ 29.90/mes',
  },
  PRO: {
    name: 'PRO',
    color: 'yellow',
    description: 'Acceso completo',
    features: [
      { label: 'Empresas ilimitadas', icon: Building2 },
      { label: 'IA avanzada ilimitada', icon: Bot },
      { label: 'Comprobantes ilimitados', icon: FileText },
      { label: 'Alertas y licitaciones', icon: Zap },
    ],
    price: 'S/ 79.90/mes',
  },
} as const;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [planModalUser, setPlanModalUser] = useState<User | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
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

  const openPlanModal = (user: User) => {
    setPlanModalUser(user);
    setSelectedPlan(user.plan);
  };

  const closePlanModal = () => {
    setPlanModalUser(null);
    setSelectedPlan('');
  };

  const handleChangePlan = async () => {
    if (!planModalUser || !selectedPlan || selectedPlan === planModalUser.plan) {
      closePlanModal();
      return;
    }

    await handleUpdateUser(planModalUser.id, { plan: selectedPlan } as any);
    closePlanModal();
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
                            onClick={() => openPlanModal(user)}
                            title="Clic para cambiar plan"
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${getPlanStyle(user.plan)}`}
                          >
                            {user.plan === 'PRO' && <Crown className="w-3 h-3" />}
                            {user.plan}
                            <Edit className="w-3 h-3 ml-1 opacity-50" />
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

      {/* Modal de Cambio de Plan */}
      {planModalUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Cambiar Plan de Usuario
                </h2>
                <p className="text-sm text-gray-500">
                  {planModalUser.fullName || planModalUser.email}
                </p>
              </div>
              <button
                onClick={closePlanModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plan actual */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Plan actual: <span className={`font-semibold ${
                  planModalUser.plan === 'PRO' ? 'text-yellow-600' :
                  planModalUser.plan === 'BASIC' ? 'text-blue-600' : 'text-gray-600'
                }`}>{planModalUser.plan}</span>
              </p>
            </div>

            {/* Opciones de planes */}
            <div className="p-4 grid gap-4 sm:grid-cols-3">
              {(Object.keys(PLANS_INFO) as Array<keyof typeof PLANS_INFO>).map((planKey) => {
                const plan = PLANS_INFO[planKey];
                const isSelected = selectedPlan === planKey;
                const isCurrent = planModalUser.plan === planKey;

                return (
                  <button
                    key={planKey}
                    onClick={() => setSelectedPlan(planKey)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? plan.color === 'yellow'
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                          : plan.color === 'blue'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-500 bg-gray-50 dark:bg-gray-700'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {/* Badge de plan actual */}
                    {isCurrent && (
                      <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                        Actual
                      </span>
                    )}

                    {/* Check de selección */}
                    {isSelected && (
                      <span className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                        plan.color === 'yellow' ? 'bg-yellow-500' :
                        plan.color === 'blue' ? 'bg-blue-500' : 'bg-gray-500'
                      }`}>
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}

                    {/* Nombre del plan */}
                    <div className="flex items-center gap-2 mb-2">
                      {planKey === 'PRO' && <Crown className="w-5 h-5 text-yellow-500" />}
                      <h3 className={`font-bold text-lg ${
                        plan.color === 'yellow' ? 'text-yellow-700 dark:text-yellow-400' :
                        plan.color === 'blue' ? 'text-blue-700 dark:text-blue-400' :
                        'text-gray-700 dark:text-gray-300'
                      }`}>
                        {plan.name}
                      </h3>
                    </div>

                    {/* Precio */}
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      {plan.price}
                    </p>

                    {/* Descripción */}
                    <p className="text-xs text-gray-500 mb-3">{plan.description}</p>

                    {/* Features */}
                    <ul className="space-y-1.5">
                      {plan.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className={`flex items-center gap-2 text-xs ${
                            'disabled' in feature && feature.disabled
                              ? 'text-gray-400 line-through'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <feature.icon className="w-3.5 h-3.5" />
                          {feature.label}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <Button variant="outline" onClick={closePlanModal}>
                Cancelar
              </Button>
              <Button
                onClick={handleChangePlan}
                disabled={saving || selectedPlan === planModalUser.plan}
                className={
                  selectedPlan === 'PRO'
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : selectedPlan === 'BASIC'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : ''
                }
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Guardando...
                  </span>
                ) : selectedPlan === planModalUser.plan ? (
                  'Sin cambios'
                ) : (
                  `Cambiar a ${selectedPlan}`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
