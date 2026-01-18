'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import {
  Bell,
  Plus,
  Settings,
  Trash2,
  Mail,
  MapPin,
  DollarSign,
  Search,
  Filter,
  CheckCircle,
  Clock,
  ExternalLink,
  AlertCircle,
  Building2,
  FileText,
  Loader2,
  X,
  Crown,
  Lock,
  Send,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';

interface AlertConfig {
  id: string;
  tipo: string;
  nombre: string;
  descripcion: string | null;
  palabrasClave: string[];
  regiones: string[];
  montoMinimo: number | null;
  montoMaximo: number | null;
  entidades: string[];
  emailEnabled: boolean;
  emailDestino: string | null;
  frecuencia: string;
  diasAnticipacion: number[]; // Array de días: [7, 3, 1, 0] = avisar 7, 3, 1 días antes y el mismo día
  isActive: boolean;
  createdAt: string;
}

interface LicitacionEtapa {
  id: string;
  nombreEtapa: string;
  fechaInicio: string | null;
  fechaFin: string | null;
}

interface Licitacion {
  id: string;
  nomenclatura: string;
  objetoContratacion: string;
  entidad: string;
  siglaEntidad: string | null;
  estado: string;
  etapas: LicitacionEtapa[];
}

interface AlertHistory {
  id: string;
  alertConfigId: string;
  titulo: string;
  contenido: string;
  fuente: string;
  urlOrigen: string | null;
  fechaPublicacion: string | null;
  region: string | null;
  entidad: string | null;
  monto: number | null;
  isRead: boolean;
  isNotified: boolean;
  createdAt: string;
}

const tipoLabels: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  licitacion: { label: 'Licitaciones', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Building2 },
  sunat: { label: 'SUNAT', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: FileText },
  vencimiento: { label: 'Vencimientos', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  custom: { label: 'Personalizada', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Bell },
};

const fuenteColors: Record<string, string> = {
  SEACE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  OSCE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SUNAT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  SISTEMA: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const regionesPeru = [
  'AMAZONAS', 'ANCASH', 'APURIMAC', 'AREQUIPA', 'AYACUCHO', 'CAJAMARCA',
  'CALLAO', 'CUSCO', 'HUANCAVELICA', 'HUANUCO', 'ICA', 'JUNIN', 'LA LIBERTAD',
  'LAMBAYEQUE', 'LIMA', 'LORETO', 'MADRE DE DIOS', 'MOQUEGUA', 'PASCO',
  'PIURA', 'PUNO', 'SAN MARTIN', 'TACNA', 'TUMBES', 'UCAYALI',
];

export default function AlertasPage() {
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AlertConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [requiresUpgrade, setRequiresUpgrade] = useState(false);
  const [requiredPlans, setRequiredPlans] = useState<string[]>([]);
  const [licitaciones, setLicitaciones] = useState<Licitacion[]>([]);
  const [loadingLicitaciones, setLoadingLicitaciones] = useState(false);
  const [showLicitaciones, setShowLicitaciones] = useState(false);
  const [selectedLicitacion, setSelectedLicitacion] = useState<Licitacion | null>(null);
  const [testingConfigId, setTestingConfigId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: unknown } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    tipo: 'licitacion',
    nombre: '',
    descripcion: '',
    palabrasClave: '',
    regiones: [] as string[],
    entidades: '',
    montoMinimo: '',
    montoMaximo: '',
    emailEnabled: true,
    emailDestino: '',
    frecuencia: 'diaria',
    diasAnticipacion: [3] as number[], // Array de días de anticipación
  });

  useEffect(() => {
    loadData();
    loadLicitaciones();
  }, []);

  const loadLicitaciones = async () => {
    setLoadingLicitaciones(true);
    try {
      const data = await apiClient.get<{ data: Licitacion[] }>('/api/alertas/licitaciones');
      setLicitaciones(data.data || []);
    } catch (error) {
      console.error('Error cargando licitaciones:', error);
    } finally {
      setLoadingLicitaciones(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{
        configs: AlertConfig[];
        history: AlertHistory[];
        unreadCount: number;
      }>('/api/alertas');
      setConfigs(data.configs);
      setHistory(data.history);
      setUnreadCount(data.unreadCount);
      setRequiresUpgrade(false);
    } catch (error: unknown) {
      const err = error as { status?: number; requiresUpgrade?: boolean; requiredPlans?: string[] };
      if (err.requiresUpgrade) {
        setRequiresUpgrade(true);
        setRequiredPlans(err.requiredPlans || ['PRO']);
      } else {
        console.error('Error cargando alertas:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      alert('El nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        palabrasClave: formData.palabrasClave.split(',').map(p => p.trim()).filter(Boolean),
        entidades: formData.entidades.split(',').map(p => p.trim()).filter(Boolean),
        montoMinimo: formData.montoMinimo || null,
        montoMaximo: formData.montoMaximo || null,
        emailDestino: formData.emailDestino || null,
        diasAnticipacion: formData.diasAnticipacion,
      };

      if (editingConfig) {
        await apiClient.put('/api/alertas', { id: editingConfig.id, ...payload });
      } else {
        await apiClient.post('/api/alertas', payload);
      }

      setShowModal(false);
      setEditingConfig(null);
      resetForm();
      await loadData();
    } catch (error: unknown) {
      const err = error as { message?: string };
      alert(err.message || 'Error guardando alerta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta configuración de alerta?')) return;

    try {
      await apiClient.delete(`/api/alertas?id=${id}`);
      await loadData();
    } catch (error) {
      console.error('Error eliminando:', error);
    }
  };

  const handleToggleActive = async (config: AlertConfig) => {
    try {
      await apiClient.put('/api/alertas', { id: config.id, isActive: !config.isActive });
      await loadData();
    } catch (error) {
      console.error('Error actualizando:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.put('/api/alertas/history', { markAllRead: true });
      setHistory(prev => prev.map(h => ({ ...h, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEdit = (config: AlertConfig) => {
    setEditingConfig(config);
    setSelectedLicitacion(null);
    setFormData({
      tipo: config.tipo,
      nombre: config.nombre,
      descripcion: config.descripcion || '',
      palabrasClave: config.palabrasClave.join(', '),
      regiones: config.regiones,
      entidades: config.entidades?.join(', ') || '',
      montoMinimo: config.montoMinimo?.toString() || '',
      montoMaximo: config.montoMaximo?.toString() || '',
      emailEnabled: config.emailEnabled,
      emailDestino: config.emailDestino || '',
      frecuencia: config.frecuencia,
      diasAnticipacion: Array.isArray(config.diasAnticipacion) ? config.diasAnticipacion : [config.diasAnticipacion || 3],
    });
    setShowModal(true);
  };

  // Función para configurar alerta desde una licitación
  const handleConfigureFromLicitacion = (lic: Licitacion) => {
    setSelectedLicitacion(lic);
    setEditingConfig(null);
    setFormData({
      tipo: 'licitacion',
      nombre: `Alerta: ${lic.nomenclatura}`,
      descripcion: lic.objetoContratacion?.substring(0, 200) || '',
      palabrasClave: '',
      regiones: [],
      entidades: lic.siglaEntidad || lic.entidad.substring(0, 50),
      montoMinimo: '',
      montoMaximo: '',
      emailEnabled: true,
      emailDestino: '',
      frecuencia: 'diaria',
      diasAnticipacion: [3, 1, 0], // Por defecto: 3 días, 1 día y mismo día
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setSelectedLicitacion(null);
    setFormData({
      tipo: 'licitacion',
      nombre: '',
      descripcion: '',
      palabrasClave: '',
      regiones: [],
      entidades: '',
      montoMinimo: '',
      montoMaximo: '',
      emailEnabled: true,
      emailDestino: '',
      frecuencia: 'diaria',
      diasAnticipacion: [3],
    });
  };

  // Toggle día de anticipación
  const toggleDiaAnticipacion = (dia: number) => {
    const current = formData.diasAnticipacion;
    if (current.includes(dia)) {
      // Quitar (pero mantener al menos uno)
      if (current.length > 1) {
        setFormData({ ...formData, diasAnticipacion: current.filter(d => d !== dia) });
      }
    } else {
      // Agregar (máximo 4)
      if (current.length < 4) {
        setFormData({ ...formData, diasAnticipacion: [...current, dia].sort((a, b) => b - a) });
      }
    }
  };

  // Probar envío de alerta
  const handleTestAlert = async (configId: string, sendEmail = false) => {
    setTestingConfigId(configId);
    setTestResult(null);
    try {
      const result = await apiClient.post<{ success: boolean; message: string; details?: unknown }>('/api/alertas/test', {
        alertConfigId: configId,
        sendTestEmail: sendEmail,
      });
      setTestResult(result);
      if (sendEmail && result.details && (result.details as { emailSent?: boolean }).emailSent) {
        alert('Email de prueba enviado correctamente');
      }
    } catch (error) {
      console.error('Error probando alerta:', error);
      setTestResult({ success: false, message: 'Error al probar la alerta' });
    } finally {
      setTestingConfigId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (requiresUpgrade) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-6 h-6" />
              Sistema de Alertas
            </h1>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-6">
            <Lock className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
            Funcionalidad Premium
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
            El sistema de alertas está disponible para planes: <strong>{requiredPlans.join(', ')}</strong>.
            Actualiza tu plan para recibir notificaciones de licitaciones, SUNAT y vencimientos importantes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/configuracion">
              <Button className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Actualizar Plan
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline">
                Volver al Dashboard
              </Button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">Licitaciones</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Alertas de SEACE y OSCE con filtros personalizados
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">SUNAT</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Notificaciones tributarias y cambios normativos
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">Vencimientos</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Recordatorios de fechas límite importantes
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Mis Alertas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Configura alertas para licitaciones, vencimientos y noticias de SUNAT
          </p>
        </div>
        <div className="flex gap-3">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Marcar todas leídas ({unreadCount})
            </Button>
          )}
          <Button onClick={() => { resetForm(); setEditingConfig(null); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Alerta
          </Button>
        </div>
      </div>

      {/* Resumen de configuraciones */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(tipoLabels).map(([tipo, { label, color, icon: Icon }]) => {
          const count = configs.filter(c => c.tipo === tipo && c.isActive).length;
          return (
            <Card key={tipo}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Configuraciones de alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Mis Suscripciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {configs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No tienes alertas configuradas</p>
                <Button className="mt-4" onClick={() => { resetForm(); setShowModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear primera alerta
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {configs.map((config) => {
                  const tipo = tipoLabels[config.tipo] || tipoLabels.custom;
                  const Icon = tipo.icon;
                  return (
                    <div
                      key={config.id}
                      className={`p-4 border rounded-lg ${
                        config.isActive
                          ? 'border-gray-200 dark:border-gray-700'
                          : 'border-gray-100 dark:border-gray-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg ${tipo.color} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{config.nombre}</p>
                            {config.descripcion && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{config.descripcion}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {config.palabrasClave.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <Search className="w-3 h-3" />
                                  {config.palabrasClave.slice(0, 3).join(', ')}
                                  {config.palabrasClave.length > 3 && '...'}
                                </span>
                              )}
                              {config.regiones.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <MapPin className="w-3 h-3" />
                                  {config.regiones.length} regiones
                                </span>
                              )}
                              {config.emailEnabled && (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                  <Mail className="w-3 h-3" />
                                  Email {config.frecuencia}
                                </span>
                              )}
                              {config.diasAnticipacion && config.diasAnticipacion.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                                  <Clock className="w-3 h-3" />
                                  {(Array.isArray(config.diasAnticipacion) ? config.diasAnticipacion : [config.diasAnticipacion])
                                    .map(d => d === 0 ? 'mismo día' : `${d}d`)
                                    .join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleTestAlert(config.id, false)}
                            disabled={testingConfigId === config.id}
                            className="p-2 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                            title="Verificar alerta"
                          >
                            {testingConfigId === config.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PlayCircle className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleTestAlert(config.id, true)}
                            disabled={testingConfigId === config.id}
                            className="p-2 text-gray-400 hover:text-green-600 disabled:opacity-50"
                            title="Enviar email de prueba"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(config)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              config.isActive ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              config.isActive ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                          <button
                            onClick={() => handleEdit(config)}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(config.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historial de alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Alertas Recientes
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs rounded-full">
                  {unreadCount} nuevas
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay alertas recientes</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {history.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 border rounded-lg ${
                      alert.isRead
                        ? 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50'
                        : 'border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            fuenteColors[alert.fuente] || 'bg-gray-100 text-gray-700'
                          }`}>
                            {alert.fuente}
                          </span>
                          {!alert.isRead && (
                            <span className="w-2 h-2 bg-primary-500 rounded-full" />
                          )}
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {alert.titulo}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {alert.contenido}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          {alert.region && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {alert.region}
                            </span>
                          )}
                          {alert.monto && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              S/ {Number(alert.monto).toLocaleString('es-PE')}
                            </span>
                          )}
                          <span>
                            {new Date(alert.createdAt).toLocaleDateString('es-PE')}
                          </span>
                        </div>
                      </div>
                      {alert.urlOrigen && (
                        <a
                          href={alert.urlOrigen}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-primary-600 flex-shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Licitaciones Disponibles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Licitaciones Disponibles
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLicitaciones(!showLicitaciones)}
            >
              {showLicitaciones ? 'Ocultar' : 'Ver licitaciones'}
            </Button>
          </div>
        </CardHeader>
        {showLicitaciones && (
          <CardContent>
            {loadingLicitaciones ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
              </div>
            ) : licitaciones.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay licitaciones disponibles</p>
                <p className="text-sm mt-1">Las licitaciones se actualizan automáticamente cada día</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {licitaciones.map((lic) => (
                  <div
                    key={lic.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-medium">
                            SEACE
                          </span>
                          {lic.siglaEntidad && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded text-xs">
                              {lic.siglaEntidad}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            lic.estado === 'ACTIVO'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {lic.estado}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {lic.nomenclatura}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {lic.objetoContratacion || 'Sin descripción'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {lic.entidad}
                        </p>
                        {/* Cronograma */}
                        {lic.etapas.length > 0 && (
                          <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
                              Cronograma ({lic.etapas.length} etapas):
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left py-1 pr-2">Etapa</th>
                                    <th className="text-right py-1 px-1 whitespace-nowrap">Fecha Inicio</th>
                                    <th className="text-right py-1 pl-1 whitespace-nowrap">Fecha Fin</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lic.etapas.map((etapa) => (
                                    <tr key={etapa.id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                                      <td className="py-1 pr-2 text-gray-700 dark:text-gray-300">{etapa.nombreEtapa}</td>
                                      <td className="py-1 px-1 text-right text-gray-500 whitespace-nowrap">
                                        {etapa.fechaInicio
                                          ? new Date(etapa.fechaInicio).toLocaleString('es-PE', {
                                              day: '2-digit',
                                              month: '2-digit',
                                              year: 'numeric',
                                              ...(new Date(etapa.fechaInicio).getHours() !== 0 && {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })
                                            })
                                          : '-'}
                                      </td>
                                      <td className="py-1 pl-1 text-right text-gray-500 whitespace-nowrap">
                                        {etapa.fechaFin
                                          ? new Date(etapa.fechaFin).toLocaleString('es-PE', {
                                              day: '2-digit',
                                              month: '2-digit',
                                              year: 'numeric',
                                              ...(new Date(etapa.fechaFin).getHours() !== 0 && {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })
                                            })
                                          : '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {/* Botón para configurar alerta */}
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <Button
                            size="sm"
                            onClick={() => handleConfigureFromLicitacion(lic)}
                            className="w-full"
                          >
                            <Bell className="w-4 h-4 mr-2" />
                            Configurar Alerta para esta Licitación
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Modal para crear/editar alerta */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingConfig ? 'Editar Alerta' : 'Nueva Alerta'}
                </h2>
                <button
                  onClick={() => { setShowModal(false); setEditingConfig(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Tipo de alerta */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de alerta
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(tipoLabels).map(([tipo, { label, icon: Icon }]) => (
                      <button
                        key={tipo}
                        onClick={() => setFormData({ ...formData, tipo })}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          formData.tipo === tipo
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-sm">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nombre */}
                <Input
                  label="Nombre de la alerta *"
                  placeholder="Ej: Licitaciones de equipos médicos"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                />

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descripción
                  </label>
                  <textarea
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={2}
                    placeholder="Descripción opcional..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  />
                </div>

                {/* Palabras clave */}
                <Input
                  label="Palabras clave"
                  placeholder="Ej: suministros, inventario, equipos (separadas por coma)"
                  value={formData.palabrasClave}
                  onChange={(e) => setFormData({ ...formData, palabrasClave: e.target.value })}
                  helperText="Recibirás alertas que contengan estas palabras"
                />

                {/* Regiones */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Regiones
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg max-h-32 overflow-y-auto">
                    {regionesPeru.map((region) => (
                      <button
                        key={region}
                        onClick={() => {
                          const newRegiones = formData.regiones.includes(region)
                            ? formData.regiones.filter(r => r !== region)
                            : [...formData.regiones, region];
                          setFormData({ ...formData, regiones: newRegiones });
                        }}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          formData.regiones.includes(region)
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {region}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.regiones.length > 0
                      ? `${formData.regiones.length} regiones seleccionadas`
                      : 'Todas las regiones si no seleccionas ninguna'}
                  </p>
                </div>

                {/* Entidades (para licitaciones) */}
                {formData.tipo === 'licitacion' && (
                  <Input
                    label="Entidades"
                    placeholder="Ej: SUNAT, OSCE, MEF (separadas por coma)"
                    value={formData.entidades}
                    onChange={(e) => setFormData({ ...formData, entidades: e.target.value })}
                    helperText="Solo recibirás alertas de estas entidades (vacío = todas)"
                  />
                )}

                {/* Rango de montos */}
                {(formData.tipo === 'licitacion') && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Monto mínimo (S/)"
                      type="number"
                      placeholder="0"
                      value={formData.montoMinimo}
                      onChange={(e) => setFormData({ ...formData, montoMinimo: e.target.value })}
                    />
                    <Input
                      label="Monto máximo (S/)"
                      type="number"
                      placeholder="Sin límite"
                      value={formData.montoMaximo}
                      onChange={(e) => setFormData({ ...formData, montoMaximo: e.target.value })}
                    />
                  </div>
                )}

                {/* Días de anticipación (para licitaciones) */}
                {formData.tipo === 'licitacion' && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Clock className="w-4 h-4 inline mr-2" />
                      ¿Qué días antes quieres recibir alertas? (máximo 4)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[14, 7, 5, 3, 2, 1, 0].map((dias) => {
                        const isSelected = formData.diasAnticipacion.includes(dias);
                        const canSelect = isSelected || formData.diasAnticipacion.length < 4;
                        return (
                          <button
                            key={dias}
                            type="button"
                            onClick={() => toggleDiaAnticipacion(dias)}
                            disabled={!canSelect && !isSelected}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-yellow-500 text-white'
                                : canSelect
                                  ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 cursor-not-allowed'
                            }`}
                          >
                            {dias === 0 ? 'Mismo día' : dias === 1 ? '1 día' : `${dias} días`}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {formData.diasAnticipacion.length === 0
                        ? 'Selecciona al menos un día'
                        : `Recibirás alertas: ${formData.diasAnticipacion
                            .sort((a, b) => b - a)
                            .map(d => d === 0 ? 'el mismo día' : d === 1 ? '1 día antes' : `${d} días antes`)
                            .join(', ')}`
                      }
                    </p>
                  </div>
                )}

                {/* Notificaciones por email */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">Notificaciones por email</span>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, emailEnabled: !formData.emailEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.emailEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {formData.emailEnabled && (
                    <div className="space-y-3">
                      <Input
                        label="Email de destino"
                        type="email"
                        placeholder="tu@email.com (vacío = email de tu cuenta)"
                        value={formData.emailDestino}
                        onChange={(e) => setFormData({ ...formData, emailDestino: e.target.value })}
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Frecuencia
                        </label>
                        <select
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          value={formData.frecuencia}
                          onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value })}
                        >
                          <option value="inmediata">Inmediata (cada alerta)</option>
                          <option value="diaria">Resumen diario</option>
                          <option value="semanal">Resumen semanal</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => { setShowModal(false); setEditingConfig(null); }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} isLoading={saving}>
                  {editingConfig ? 'Guardar Cambios' : 'Crear Alerta'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
