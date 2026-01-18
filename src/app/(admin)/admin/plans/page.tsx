'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Crown,
  Sparkles,
  User,
  Save,
  Loader2,
  Check,
  X,
  Building2,
  FileText,
  Bot,
  Receipt,
  BarChart3,
  BookOpen,
  Bell,
  Code,
  HeartHandshake,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Menu,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

interface MenuItem {
  id: string;
  menuKey: string;
  label: string;
  icon: string | null;
  path: string;
  orden: number;
  isEnabled: boolean;
  isVisible: boolean;
}

interface PlanConfig {
  id: string;
  plan: 'FREE' | 'BASIC' | 'PRO';
  nombre: string;
  descripcion: string | null;
  precioMensual: number;
  precioAnual: number;
  maxEmpresas: number;
  maxComprobantes: number;
  maxStorage: string;
  maxUsuarios: number;
  iaEnabled: boolean;
  iaMaxConsultas: number;
  iaModelo: string | null;
  facturacionEnabled: boolean;
  reportesAvanzados: boolean;
  librosElectronicos: boolean;
  alertasEnabled: boolean;
  apiAccess: boolean;
  soportePrioritario: boolean;
  isActive: boolean;
  menuItems: MenuItem[];
}

const PLAN_ICONS = {
  FREE: User,
  BASIC: Sparkles,
  PRO: Crown,
};

const PLAN_COLORS = {
  FREE: 'border-gray-300 bg-gray-50 dark:bg-gray-800',
  BASIC: 'border-blue-300 bg-blue-50 dark:bg-blue-900/20',
  PRO: 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20',
};

const formatBytes = (bytes: string) => {
  const num = BigInt(bytes);
  if (num < BigInt(1024)) return `${num} B`;
  if (num < BigInt(1024 * 1024)) return `${Number(num) / 1024} KB`;
  if (num < BigInt(1024 * 1024 * 1024)) return `${Number(num) / (1024 * 1024)} MB`;
  return `${Number(num) / (1024 * 1024 * 1024)} GB`;
};

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    loadPlans();
  }, [accessToken]);

  const loadPlans = async () => {
    try {
      const response = await fetch('/api/admin/plans', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error('Error cargando planes');

      const data = await response.json();
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (plan: PlanConfig) => {
    setSaving(plan.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(plan),
      });

      if (!response.ok) throw new Error('Error guardando plan');

      setSuccess(`Plan ${plan.nombre} actualizado correctamente`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(null);
    }
  };

  const updatePlanField = (planId: string, field: string, value: any) => {
    setPlans(prev =>
      prev.map(p =>
        p.id === planId ? { ...p, [field]: value } : p
      )
    );
  };

  const updateMenuItem = (planId: string, menuId: string, field: string, value: any) => {
    setPlans(prev =>
      prev.map(p =>
        p.id === planId
          ? {
              ...p,
              menuItems: p.menuItems.map(m =>
                m.id === menuId ? { ...m, [field]: value } : m
              ),
            }
          : p
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Configuración de Planes
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configura los límites, funcionalidades y menús para cada plan
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = PLAN_ICONS[plan.plan];
          const isExpanded = expandedPlan === plan.id;

          return (
            <Card
              key={plan.id}
              className={`border-2 ${PLAN_COLORS[plan.plan]} transition-all`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <span>{plan.nombre}</span>
                  </div>
                  <span className="text-xs font-normal bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    {plan.plan}
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Precios */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Precio Mensual</label>
                    <div className="flex items-center">
                      <span className="text-sm mr-1">S/</span>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-700"
                        value={plan.precioMensual}
                        onChange={(e) => updatePlanField(plan.id, 'precioMensual', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Precio Anual</label>
                    <div className="flex items-center">
                      <span className="text-sm mr-1">S/</span>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-700"
                        value={plan.precioAnual}
                        onChange={(e) => updatePlanField(plan.id, 'precioAnual', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>

                {/* Límites */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <Building2 className="w-4 h-4" /> Límites
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <label className="text-xs text-gray-500">Empresas</label>
                      <input
                        type="number"
                        className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-700"
                        value={plan.maxEmpresas}
                        onChange={(e) => updatePlanField(plan.id, 'maxEmpresas', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Comprobantes/mes</label>
                      <input
                        type="number"
                        className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-700"
                        value={plan.maxComprobantes}
                        onChange={(e) => updatePlanField(plan.id, 'maxComprobantes', parseInt(e.target.value) || 0)}
                        placeholder="0 = ilimitado"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Usuarios/empresa</label>
                      <input
                        type="number"
                        className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-700"
                        value={plan.maxUsuarios}
                        onChange={(e) => updatePlanField(plan.id, 'maxUsuarios', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Almacenamiento</label>
                      <div className="text-sm text-gray-700 dark:text-gray-300 py-1">
                        {formatBytes(plan.maxStorage)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Features toggles */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Funcionalidades</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'iaEnabled', label: 'IA', icon: Bot },
                      { key: 'facturacionEnabled', label: 'Facturación', icon: Receipt },
                      { key: 'reportesAvanzados', label: 'Reportes', icon: BarChart3 },
                      { key: 'librosElectronicos', label: 'Libros', icon: BookOpen },
                      { key: 'alertasEnabled', label: 'Alertas', icon: Bell },
                      { key: 'apiAccess', label: 'API', icon: Code },
                    ].map(({ key, label, icon: FeatureIcon }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={(plan as any)[key]}
                          onChange={(e) => updatePlanField(plan.id, key, e.target.checked)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <FeatureIcon className="w-3 h-3" />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* IA Config */}
                {plan.iaEnabled && (
                  <div className="space-y-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <Bot className="w-4 h-4" /> Configuración IA
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <label className="text-xs text-gray-500">Consultas/mes</label>
                        <input
                          type="number"
                          className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-700"
                          value={plan.iaMaxConsultas}
                          onChange={(e) => updatePlanField(plan.id, 'iaMaxConsultas', parseInt(e.target.value) || 0)}
                          placeholder="0 = ilimitado"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Modelo</label>
                        <select
                          className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-700"
                          value={plan.iaModelo || ''}
                          onChange={(e) => updatePlanField(plan.id, 'iaModelo', e.target.value || null)}
                        >
                          <option value="">Seleccionar</option>
                          <option value="claude-3-haiku">Claude 3 Haiku</option>
                          <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                          <option value="claude-3-opus">Claude 3 Opus</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Menús expandibles */}
                <div className="border-t dark:border-gray-700 pt-2">
                  <button
                    onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                    className="flex items-center justify-between w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <span className="flex items-center gap-1">
                      <Menu className="w-4 h-4" />
                      Menús habilitados ({plan.menuItems.filter(m => m.isEnabled).length})
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                      {plan.menuItems.map((menu) => (
                        <label
                          key={menu.id}
                          className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={menu.isEnabled}
                              onChange={(e) => updateMenuItem(plan.id, menu.id, 'isEnabled', e.target.checked)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span>{menu.label}</span>
                          </div>
                          <span className="text-xs text-gray-400">{menu.path}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botón guardar */}
                <Button
                  className="w-full"
                  onClick={() => handleSavePlan(plan)}
                  disabled={saving === plan.id}
                >
                  {saving === plan.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar Cambios
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
