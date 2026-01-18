'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { ScraperConsole } from '@/components/admin/scraper-console';
import {
  Bell,
  Send,
  BarChart3,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Building2,
  FileText,
  MapPin,
  DollarSign,
  X,
  RefreshCw,
  Settings,
  Database,
  Key,
  Wifi,
  WifiOff,
  Play,
  Calendar,
  Trash2,
  Globe,
  Terminal,
} from 'lucide-react';

interface AlertStats {
  configs: {
    total: number;
    active: number;
    byTipo: Record<string, number>;
  };
  history: {
    total: number;
    today: number;
    week: number;
    unread: number;
  };
  users: {
    byPlan: Record<string, number>;
  };
}

interface AlertHistoryItem {
  id: string;
  alertConfigId: string;
  titulo: string;
  contenido: string;
  fuente: string;
  urlOrigen: string | null;
  region: string | null;
  entidad: string | null;
  monto: number | null;
  isRead: boolean;
  isNotified: boolean;
  createdAt: string;
  configName: string;
  userEmail: string;
}

interface SourceConfig {
  enabled: boolean;
  api_url: string;
  api_key_configured: boolean;
  last_sync: string;
}

interface FuentesConfig {
  sources: Record<string, SourceConfig>;
  cron: {
    keyConfigured: boolean;
    lastRun: string;
  };
  allowedPlans: string[];
}

interface ScraperConfig {
  enabled: boolean;
  frequency: string;
  retentionDays: number;
  lastRun?: string;
  lastSuccess?: string;
  lastError?: string;
}

interface LicitacionEtapa {
  id: string;
  nombreEtapa: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  esActual: boolean;
}

interface ScrapedLicitacion {
  id: string;
  nomenclatura: string;
  objetoContratacion: string;
  entidad: string;
  siglaEntidad: string | null;
  tipoSeleccion: string | null;
  region: string | null;
  valorReferencial: number | null;
  fuente: string;
  estado: string;
  fechaConvocatoria: string | null;
  fechaPresentacion: string | null;
  fechaBuenaPro: string | null;
  scrapedAt: string;
  updatedAt: string;
  etapas: LicitacionEtapa[];
}

interface LicitacionesResponse {
  data: ScrapedLicitacion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalLicitaciones: number;
    totalEtapas: number;
    byFuente: Record<string, number>;
  };
}

interface ScrapersStatus {
  scrapers: Record<string, ScraperConfig>;
  stats: Record<string, { total: number; today: number }>;
}

const tipoLabels: Record<string, { label: string; color: string }> = {
  licitacion: { label: 'Licitaciones', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  sunat: { label: 'SUNAT', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  vencimiento: { label: 'Vencimientos', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  custom: { label: 'Personalizada', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
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

export default function AdminAlertasPage() {
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fuentes config
  const [fuentesConfig, setFuentesConfig] = useState<FuentesConfig | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('seace');
  const [sourceForm, setSourceForm] = useState({
    enabled: false,
    api_url: '',
    api_key: '',
  });
  const [cronKey, setCronKey] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [allowedPlans, setAllowedPlans] = useState<string[]>(['PRO']);

  // Scrapers state
  const [scrapersStatus, setScrapersStatus] = useState<ScrapersStatus | null>(null);
  const [showScrapersModal, setShowScrapersModal] = useState(false);
  const [selectedScraper, setSelectedScraper] = useState<string>('seace');
  const [scraperForm, setScraperForm] = useState({
    enabled: false,
    frequency: 'daily',
    retentionDays: 30,
  });
  const [runningScraper, setRunningScraper] = useState(false);

  // Console state
  const [showConsole, setShowConsole] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // SEACE Login Config state
  const [showSeaceModal, setShowSeaceModal] = useState(false);
  const [seaceConfig, setSeaceConfig] = useState({
    usuario: '',
    clave: '',
    entidad: 'SUPERINTENDENCIA NACIONAL DE ADUANAS Y DE ADMINISTRACION TRIBUTARIA - SUNAT',
    siglaEntidad: 'SUNAT',
    anio: new Date().getFullYear().toString(),
    enabled: false,
  });
  const [testingSeace, setTestingSeace] = useState(false);
  const [seaceTestResult, setSeaceTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Licitaciones state
  const [licitaciones, setLicitaciones] = useState<ScrapedLicitacion[]>([]);
  const [licitacionesStats, setLicitacionesStats] = useState<{
    totalLicitaciones: number;
    totalEtapas: number;
    byFuente: Record<string, number>;
  } | null>(null);
  const [loadingLicitaciones, setLoadingLicitaciones] = useState(false);
  const [expandedLicitacion, setExpandedLicitacion] = useState<string | null>(null);

  // Form state for creating alert
  const [formData, setFormData] = useState({
    titulo: '',
    contenido: '',
    fuente: 'SISTEMA',
    tipo: 'licitacion',
    region: '',
    entidad: '',
    monto: '',
    urlOrigen: '',
  });

  useEffect(() => {
    loadData();
    loadFuentesConfig();
    loadScrapersStatus();
    loadSeaceConfig();
    loadLicitaciones();
  }, []);

  // Sincronizar el formulario del scraper cuando cambia el estado o el scraper seleccionado
  useEffect(() => {
    if (scrapersStatus?.scrapers[selectedScraper]) {
      const config = scrapersStatus.scrapers[selectedScraper];
      setScraperForm({
        enabled: config.enabled ?? false,
        frequency: config.frequency || 'daily',
        retentionDays: config.retentionDays || 30,
      });
    }
  }, [scrapersStatus, selectedScraper]);

  const loadLicitaciones = async () => {
    setLoadingLicitaciones(true);
    try {
      const data = await apiClient.get<LicitacionesResponse>('/api/admin/alertas/licitaciones');
      setLicitaciones(data.data);
      setLicitacionesStats(data.stats);
    } catch (error) {
      console.error('Error cargando licitaciones:', error);
    } finally {
      setLoadingLicitaciones(false);
    }
  };

  const loadSeaceConfig = async () => {
    try {
      const data = await apiClient.get<{ config: typeof seaceConfig }>('/api/admin/alertas/seace-test');
      if (data.config) {
        setSeaceConfig(data.config);
      }
    } catch (error) {
      console.error('Error cargando config SEACE:', error);
    }
  };

  const handleSaveSeaceConfig = async () => {
    setSavingConfig(true);
    try {
      await apiClient.put('/api/admin/alertas/seace-test', seaceConfig);
      setMessage({ type: 'success', text: 'Configuración SEACE guardada' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error guardando configuración SEACE' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestSeace = async () => {
    setTestingSeace(true);
    setSeaceTestResult(null);
    try {
      const result = await apiClient.post<{ success: boolean; message: string }>('/api/admin/alertas/seace-test', {});
      setSeaceTestResult(result);
      // Recargar licitaciones después del test
      await loadLicitaciones();
    } catch (error) {
      setSeaceTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error ejecutando prueba',
      });
    } finally {
      setTestingSeace(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, historyData] = await Promise.all([
        apiClient.get<AlertStats>('/api/admin/alertas?action=stats'),
        apiClient.get<{ data: AlertHistoryItem[] }>('/api/admin/alertas'),
      ]);
      setStats(statsData);
      setHistory(historyData.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFuentesConfig = async () => {
    try {
      const config = await apiClient.get<FuentesConfig>('/api/admin/alertas/fuentes');
      setFuentesConfig(config);
      if (config.allowedPlans) {
        setAllowedPlans(config.allowedPlans);
      }
    } catch (error) {
      console.error('Error cargando config de fuentes:', error);
    }
  };

  const handleSelectSource = (source: string) => {
    setSelectedSource(source);
    if (fuentesConfig?.sources[source]) {
      setSourceForm({
        enabled: fuentesConfig.sources[source].enabled,
        api_url: fuentesConfig.sources[source].api_url || '',
        api_key: '',
      });
    }
  };

  const handleSaveSourceConfig = async () => {
    setSavingConfig(true);
    try {
      await apiClient.put('/api/admin/alertas/fuentes', {
        source: selectedSource,
        ...sourceForm,
      });
      await loadFuentesConfig();
      setMessage({ type: 'success', text: `Configuración de ${selectedSource.toUpperCase()} guardada` });
      setSourceForm({ ...sourceForm, api_key: '' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error guardando configuración' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveCronKey = async () => {
    if (!cronKey.trim()) return;
    setSavingConfig(true);
    try {
      await apiClient.put('/api/admin/alertas/fuentes', { cron_key: cronKey });
      await loadFuentesConfig();
      setMessage({ type: 'success', text: 'Cron key guardada correctamente' });
      setCronKey('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Error guardando cron key' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTogglePlan = (plan: string) => {
    setAllowedPlans(prev => {
      if (prev.includes(plan)) {
        // No permitir quitar todos los planes
        if (prev.length === 1) return prev;
        return prev.filter(p => p !== plan);
      } else {
        return [...prev, plan];
      }
    });
  };

  const handleSaveAllowedPlans = async () => {
    setSavingConfig(true);
    try {
      await apiClient.put('/api/admin/alertas/fuentes', { allowed_plans: allowedPlans });
      await loadFuentesConfig();
      setMessage({ type: 'success', text: 'Planes permitidos actualizados' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error guardando configuración de planes' });
    } finally {
      setSavingConfig(false);
    }
  };

  // Scrapers functions
  const loadScrapersStatus = async () => {
    try {
      const status = await apiClient.get<ScrapersStatus>('/api/admin/alertas/scrapers');
      setScrapersStatus(status);
    } catch (error) {
      console.error('Error cargando scrapers:', error);
    }
  };

  const handleSelectScraper = (scraper: string) => {
    setSelectedScraper(scraper);
    // El useEffect se encargará de sincronizar el formulario
  };

  // Recargar estado al abrir el modal de scrapers
  const handleOpenScrapersModal = async () => {
    setShowScrapersModal(true);
    await loadScrapersStatus();
  };

  const handleSaveScraperConfig = async () => {
    setSavingConfig(true);
    setMessage(null);
    try {
      console.log('Guardando configuración:', { source: selectedScraper, ...scraperForm });
      await apiClient.put('/api/admin/alertas/scrapers', {
        source: selectedScraper,
        ...scraperForm,
      });
      await loadScrapersStatus();
      setMessage({ type: 'success', text: `Configuración de ${selectedScraper.toUpperCase()} guardada: enabled=${scraperForm.enabled}, frequency=${scraperForm.frequency}, retentionDays=${scraperForm.retentionDays}` });
    } catch (error) {
      console.error('Error guardando config:', error);
      setMessage({ type: 'error', text: 'Error guardando configuración' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunScrapers = async (sources?: string[], showLogs = true) => {
    setRunningScraper(true);
    setMessage(null);

    try {
      if (showLogs) {
        // Modo con logs: ejecutar en background y mostrar consola inmediatamente
        const result = await apiClient.post<{
          success: boolean;
          sessionId: string;
          backgroundMode: boolean;
          message: string;
        }>('/api/admin/alertas/scrapers', {
          sources,
          force: true,
          runPurge: true,
          backgroundMode: true,
        });

        // Mostrar la consola inmediatamente
        if (result.sessionId) {
          setCurrentSessionId(result.sessionId);
          setShowConsole(true);
        }

        // El scraper está corriendo en background, no mostramos mensaje aún
        // El mensaje se mostrará cuando la sesión termine
      } else {
        // Modo sin logs: esperar a que termine
        const result = await apiClient.post<{
          success: boolean;
          duration: number;
          totalAlertsFound: number;
          totalAlertsDistributed: number;
          errors: string[];
          sessionId: string;
        }>('/api/admin/alertas/scrapers', {
          sources,
          force: true,
          runPurge: true,
        });

        let msg = `Scraping completado en ${(result.duration / 1000).toFixed(1)}s. `;
        msg += `Alertas encontradas: ${result.totalAlertsFound}, distribuidas: ${result.totalAlertsDistributed}.`;

        if (result.errors && result.errors.length > 0) {
          msg += ` Errores: ${result.errors.join(', ')}`;
          setMessage({ type: 'error', text: msg });
        } else {
          setMessage({ type: 'success', text: msg });
        }

        await loadScrapersStatus();
        await loadData();
        await loadLicitaciones();
        setRunningScraper(false);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error ejecutando scrapers' });
      setRunningScraper(false);
    }
  };

  const handleConsoleClose = () => {
    setShowConsole(false);
  };

  const handleSessionEnd = async (success: boolean) => {
    // Actualizar estado cuando termina la sesión
    setRunningScraper(false);

    if (success) {
      setMessage({ type: 'success', text: 'Scraping completado exitosamente. Revisa la consola para más detalles.' });
    } else {
      setMessage({ type: 'error', text: 'Scraping completado con errores. Revisa la consola para más detalles.' });
    }

    // Recargar datos
    await loadScrapersStatus();
    await loadData();
    await loadLicitaciones();
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const result = await apiClient.post<{
        success: boolean;
        sync?: { total: { fetched: number; distributed: number } };
        notifications?: { emailsSent: number };
      }>('/api/alertas/sync', { action: 'sync', sendNotifications: true });

      const syncInfo = result.sync?.total;
      const notifInfo = result.notifications;

      let msg = 'Sincronización completada.';
      if (syncInfo) {
        msg += ` Alertas procesadas: ${syncInfo.fetched}, distribuidas: ${syncInfo.distributed}.`;
      }
      if (notifInfo) {
        msg += ` Emails enviados: ${notifInfo.emailsSent}.`;
      }

      setMessage({ type: 'success', text: msg });
      await loadData();
      await loadFuentesConfig();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error en sincronización' });
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!formData.titulo.trim() || !formData.contenido.trim()) {
      setMessage({ type: 'error', text: 'Título y contenido son requeridos' });
      return;
    }

    setSending(true);
    setMessage(null);
    try {
      const result = await apiClient.post<{ success: boolean; message: string; count: number }>(
        '/api/admin/alertas',
        {
          ...formData,
          monto: formData.monto ? parseFloat(formData.monto) : null,
        }
      );

      setMessage({ type: 'success', text: result.message });
      setShowCreateModal(false);
      setFormData({
        titulo: '',
        contenido: '',
        fuente: 'SISTEMA',
        tipo: 'licitacion',
        region: '',
        entidad: '',
        monto: '',
        urlOrigen: '',
      });
      await loadData();
    } catch (error: unknown) {
      const err = error as { message?: string };
      setMessage({ type: 'error', text: err.message || 'Error creando alerta' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
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
            Sistema de Alertas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gestión centralizada de alertas y notificaciones
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowSeaceModal(true)} className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20">
            <Key className="w-4 h-4 mr-2" />
            SEACE Login
          </Button>
          <Button variant="outline" onClick={handleOpenScrapersModal}>
            <Globe className="w-4 h-4 mr-2" />
            Web Scrapers
          </Button>
          <Button variant="outline" onClick={() => setShowConfigModal(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
          <Button variant="outline" onClick={() => handleRunScrapers()} disabled={runningScraper}>
            <RefreshCw className={`w-4 h-4 mr-2 ${runningScraper ? 'animate-spin' : ''}`} />
            {runningScraper ? 'Ejecutando...' : 'Ejecutar Scrapers'}
          </Button>
          {currentSessionId && (
            <Button variant="outline" onClick={() => setShowConsole(true)} className="bg-gray-800 text-green-400 hover:bg-gray-700 border-gray-600">
              <Terminal className="w-4 h-4 mr-2" />
              Ver Logs
            </Button>
          )}
          <Button onClick={() => setShowCreateModal(true)}>
            <Send className="w-4 h-4 mr-2" />
            Crear Alerta Manual
          </Button>
        </div>
      </div>

      {/* Mensaje */}
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.configs.active}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Alertas Activas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.history.today}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Alertas Hoy</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.history.unread}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sin Leer</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.configs.total}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Suscripciones</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats por tipo */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(tipoLabels).map(([tipo, { label, color }]) => (
                <div key={tipo} className={`p-4 rounded-lg ${color}`}>
                  <p className="text-2xl font-bold">{stats.configs.byTipo[tipo] || 0}</p>
                  <p className="text-sm opacity-80">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial de Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Historial de Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay alertas en el historial</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {history.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 border rounded-lg ${
                    alert.isRead
                      ? 'border-gray-100 dark:border-gray-800'
                      : 'border-primary-200 dark:border-primary-800 bg-primary-50/30 dark:bg-primary-900/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          fuenteColors[alert.fuente] || 'bg-gray-100 text-gray-700'
                        }`}>
                          {alert.fuente}
                        </span>
                        {!alert.isRead && (
                          <span className="px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded text-xs">
                            Nueva
                          </span>
                        )}
                        {alert.isNotified && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">
                            Notificado
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {alert.titulo}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {alert.contenido}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                        <span>Usuario: {alert.userEmail}</span>
                        <span>Config: {alert.configName}</span>
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
                        <span>{new Date(alert.createdAt).toLocaleString('es-PE')}</span>
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

      {/* Licitaciones Scrapeadas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Licitaciones Extraídas de SEACE
            </CardTitle>
            <div className="flex items-center gap-2">
              {licitacionesStats && (
                <span className="text-sm text-gray-500">
                  {licitacionesStats.totalLicitaciones} licitaciones, {licitacionesStats.totalEtapas} etapas
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={loadLicitaciones}
                disabled={loadingLicitaciones}
              >
                <RefreshCw className={`w-4 h-4 ${loadingLicitaciones ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLicitaciones ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : licitaciones.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay licitaciones extraídas</p>
              <p className="text-sm mt-1">Ejecuta el scraper de SEACE para obtener datos</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {licitaciones.map((lic) => (
                <div
                  key={lic.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Header de la licitación */}
                  <button
                    onClick={() => setExpandedLicitacion(expandedLicitacion === lic.id ? null : lic.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-medium">
                            {lic.fuente}
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
                          {lic.etapas.length > 0 && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs">
                              {lic.etapas.length} etapas
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {lic.nomenclatura}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {lic.objetoContratacion || 'Sin descripción'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {lic.entidad?.substring(0, 50) || 'Sin entidad'}
                          </span>
                          {lic.tipoSeleccion && (
                            <span>{lic.tipoSeleccion}</span>
                          )}
                          <span>
                            Actualizado: {new Date(lic.updatedAt).toLocaleDateString('es-PE')}
                          </span>
                        </div>
                      </div>
                      <div className="text-gray-400">
                        {expandedLicitacion === lic.id ? '▲' : '▼'}
                      </div>
                    </div>
                  </button>

                  {/* Detalle expandido con cronograma */}
                  {expandedLicitacion === lic.id && lic.etapas.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                      <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Cronograma
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                              <th className="pb-2 font-medium">Etapa</th>
                              <th className="pb-2 font-medium">Fecha Inicio</th>
                              <th className="pb-2 font-medium">Fecha Fin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lic.etapas.map((etapa) => {
                              const formatFecha = (fecha: string | null) => {
                                if (!fecha) return '-';
                                const d = new Date(fecha);
                                const tieneHora = d.getHours() !== 0 || d.getMinutes() !== 0;
                                return d.toLocaleString('es-PE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  ...(tieneHora && { hour: '2-digit', minute: '2-digit' })
                                });
                              };
                              return (
                                <tr key={etapa.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                                  <td className="py-2 text-gray-700 dark:text-gray-300">
                                    {etapa.nombreEtapa}
                                  </td>
                                  <td className="py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    {formatFecha(etapa.fechaInicio)}
                                  </td>
                                  <td className="py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    {formatFecha(etapa.fechaFin)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para crear alerta manual */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Crear Alerta Manual
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Esta alerta se enviará a todos los usuarios con configuraciones activas que coincidan con los filtros.
              </p>

              <div className="space-y-4">
                <Input
                  label="Título *"
                  placeholder="Título de la alerta"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contenido *
                  </label>
                  <textarea
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={4}
                    placeholder="Descripción detallada de la alerta..."
                    value={formData.contenido}
                    onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Fuente
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={formData.fuente}
                      onChange={(e) => setFormData({ ...formData, fuente: e.target.value })}
                    >
                      <option value="SISTEMA">Sistema</option>
                      <option value="SEACE">SEACE</option>
                      <option value="OSCE">OSCE</option>
                      <option value="SUNAT">SUNAT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tipo
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={formData.tipo}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    >
                      {Object.entries(tipoLabels).map(([tipo, { label }]) => (
                        <option key={tipo} value={tipo}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Región
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    >
                      <option value="">Sin especificar</option>
                      {regionesPeru.map((region) => (
                        <option key={region} value={region}>{region}</option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Monto (S/)"
                    type="number"
                    placeholder="0.00"
                    value={formData.monto}
                    onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                  />
                </div>

                <Input
                  label="Entidad"
                  placeholder="Nombre de la entidad"
                  value={formData.entidad}
                  onChange={(e) => setFormData({ ...formData, entidad: e.target.value })}
                />

                <Input
                  label="URL de origen"
                  type="url"
                  placeholder="https://..."
                  value={formData.urlOrigen}
                  onChange={(e) => setFormData({ ...formData, urlOrigen: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateAlert} disabled={sending} isLoading={sending}>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Alerta
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de configuración de fuentes */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Configuración de Fuentes de Datos
                </h2>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Estado de fuentes */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {['seace', 'osce', 'sunat'].map((source) => {
                  const config = fuentesConfig?.sources[source];
                  return (
                    <button
                      key={source}
                      onClick={() => handleSelectSource(source)}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        selectedSource === source
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {source.toUpperCase()}
                        </span>
                        {config?.enabled ? (
                          <Wifi className="w-4 h-4 text-green-500" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {config?.api_key_configured ? (
                          <span className="text-green-600 dark:text-green-400">API configurada</span>
                        ) : (
                          <span>Sin configurar</span>
                        )}
                      </div>
                      {config?.last_sync && (
                        <div className="text-xs text-gray-400 mt-1">
                          Último: {new Date(config.last_sync).toLocaleDateString('es-PE')}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Formulario de configuración de fuente seleccionada */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Configurar {selectedSource.toUpperCase()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="source-enabled"
                      checked={sourceForm.enabled}
                      onChange={(e) => setSourceForm({ ...sourceForm, enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="source-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Habilitar esta fuente
                    </label>
                  </div>

                  <Input
                    label="URL de la API"
                    placeholder="https://api.ejemplo.com/v1"
                    value={sourceForm.api_url}
                    onChange={(e) => setSourceForm({ ...sourceForm, api_url: e.target.value })}
                  />

                  <Input
                    label="API Key"
                    type="password"
                    placeholder={fuentesConfig?.sources[selectedSource]?.api_key_configured ? '••••••••••••' : 'Ingrese la API key'}
                    value={sourceForm.api_key}
                    onChange={(e) => setSourceForm({ ...sourceForm, api_key: e.target.value })}
                  />

                  <div className="flex justify-end">
                    <Button onClick={handleSaveSourceConfig} disabled={savingConfig} isLoading={savingConfig}>
                      Guardar Configuración
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Configuración del Cron Job */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Cron Job de Sincronización
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Configure una clave secreta para permitir que servicios externos ejecuten la sincronización automáticamente.
                    Llame a POST /api/alertas/sync con el header Authorization: Bearer [clave].
                  </p>

                  <div className="flex items-center gap-2">
                    {fuentesConfig?.cron.keyConfigured ? (
                      <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Clave configurada
                      </span>
                    ) : (
                      <span className="text-yellow-600 dark:text-yellow-400 text-sm flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        Sin clave configurada
                      </span>
                    )}
                    {fuentesConfig?.cron.lastRun && (
                      <span className="text-sm text-gray-400 ml-4">
                        Última ejecución: {new Date(fuentesConfig.cron.lastRun).toLocaleString('es-PE')}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Nueva clave secreta"
                      value={cronKey}
                      onChange={(e) => setCronKey(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleSaveCronKey} disabled={!cronKey.trim() || savingConfig}>
                      Guardar Clave
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Configuración de Planes con Acceso */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Planes con Acceso a Alertas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Seleccione qué planes tienen acceso al sistema de alertas. Los usuarios con planes no seleccionados no podrán acceder a esta funcionalidad.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    {['FREE', 'BASIC', 'PRO'].map((plan) => (
                      <button
                        key={plan}
                        onClick={() => handleTogglePlan(plan)}
                        className={`px-4 py-2 rounded-lg border-2 transition-colors font-medium ${
                          allowedPlans.includes(plan)
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {plan}
                        {allowedPlans.includes(plan) && (
                          <CheckCircle className="w-4 h-4 ml-2 inline" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveAllowedPlans} disabled={savingConfig} isLoading={savingConfig}>
                      Guardar Configuración de Planes
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={() => setShowConfigModal(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Web Scrapers */}
      {showScrapersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Web Scrapers - SEACE, OSCE, SUNAT
                </h2>
                <button
                  onClick={() => setShowScrapersModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Los web scrapers obtienen automáticamente información de los portales públicos de SEACE (licitaciones),
                OSCE (contrataciones) y SUNAT (noticias y normativa). Configura la frecuencia y retención de datos.
              </p>

              {/* Estado de scrapers */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {['seace', 'osce', 'sunat'].map((scraper) => {
                  const config = scrapersStatus?.scrapers[scraper];
                  const stats = scrapersStatus?.stats[scraper];
                  return (
                    <button
                      key={scraper}
                      onClick={() => handleSelectScraper(scraper)}
                      className={`p-4 rounded-lg border-2 transition-colors text-left ${
                        selectedScraper === scraper
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {scraper.toUpperCase()}
                        </span>
                        {config?.enabled ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">
                            Activo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded text-xs">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <div>Frecuencia: {config?.frequency || 'daily'}</div>
                        <div>Alertas hoy: {stats?.today || 0}</div>
                        <div>Total: {stats?.total || 0}</div>
                        {config?.lastRun && (
                          <div>Último: {new Date(config.lastRun).toLocaleString('es-PE')}</div>
                        )}
                      </div>
                      {config?.lastError && (
                        <div className="text-xs text-red-500 mt-2 truncate" title={config.lastError}>
                          Error: {config.lastError}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Formulario de configuración */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Configurar {selectedScraper.toUpperCase()}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowScrapersModal(false);
                        handleRunScrapers([selectedScraper], true);
                      }}
                      disabled={runningScraper}
                      className="bg-gray-800 text-green-400 hover:bg-gray-700 border-gray-600"
                    >
                      <Terminal className="w-4 h-4 mr-1" />
                      Ejecutar con Logs
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="scraper-enabled"
                      checked={scraperForm.enabled}
                      onChange={(e) => setScraperForm({ ...scraperForm, enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="scraper-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Habilitar scraping automático
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Frecuencia de ejecución
                      </label>
                      <select
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        value={scraperForm.frequency}
                        onChange={(e) => setScraperForm({ ...scraperForm, frequency: e.target.value })}
                      >
                        <option value="hourly">Cada hora</option>
                        <option value="daily">Diario</option>
                        <option value="weekly">Semanal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <Trash2 className="w-4 h-4 inline mr-1" />
                        Retención de datos (días)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={scraperForm.retentionDays}
                        onChange={(e) => setScraperForm({ ...scraperForm, retentionDays: parseInt(e.target.value) || 30 })}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-400">
                    Los datos más antiguos que el período de retención se eliminarán automáticamente cuando se lea la alerta.
                  </p>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveScraperConfig} disabled={savingConfig} isLoading={savingConfig}>
                      Guardar Configuración
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Información sobre las fuentes */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Información de las fuentes</h4>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li><strong>SEACE:</strong> Portal de licitaciones del Estado peruano (prodapp2.seace.gob.pe)</li>
                  <li><strong>OSCE:</strong> Organismo Supervisor de Contrataciones (portal.osce.gob.pe)</li>
                  <li><strong>SUNAT:</strong> Noticias, comunicados y normativa tributaria (sunat.gob.pe)</li>
                </ul>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">
                  Nota: El scraping depende de la estructura de los portales. Si hay cambios en las páginas, puede ser necesario actualizar los scrapers.
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={() => setShowScrapersModal(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuración SEACE Login */}
      {showSeaceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-500" />
                  Configuración SEACE con Login
                </h2>
                <button
                  onClick={() => setShowSeaceModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Aviso */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Importante:</strong> Esta configuración permite acceder al portal SEACE con credenciales para obtener información detallada de licitaciones (cronogramas, fichas, etc).
                </p>
              </div>

              {/* Formulario de credenciales */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Usuario SEACE
                    </label>
                    <Input
                      value={seaceConfig.usuario}
                      onChange={(e) => setSeaceConfig({ ...seaceConfig, usuario: e.target.value })}
                      placeholder="Ingrese usuario"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Clave SEACE
                    </label>
                    <Input
                      type="password"
                      value={seaceConfig.clave}
                      onChange={(e) => setSeaceConfig({ ...seaceConfig, clave: e.target.value })}
                      placeholder="Ingrese clave"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Entidad a buscar
                  </label>
                  <Input
                    value={seaceConfig.entidad}
                    onChange={(e) => setSeaceConfig({ ...seaceConfig, entidad: e.target.value })}
                    placeholder="Nombre completo de la entidad"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Sigla de la entidad
                    </label>
                    <Input
                      value={seaceConfig.siglaEntidad}
                      onChange={(e) => setSeaceConfig({ ...seaceConfig, siglaEntidad: e.target.value })}
                      placeholder="Ej: SUNAT"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Año de búsqueda
                    </label>
                    <Input
                      value={seaceConfig.anio}
                      onChange={(e) => setSeaceConfig({ ...seaceConfig, anio: e.target.value })}
                      placeholder="2025"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="seaceEnabled"
                    checked={seaceConfig.enabled}
                    onChange={(e) => setSeaceConfig({ ...seaceConfig, enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="seaceEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                    Habilitar scraping automático con login
                  </label>
                </div>
              </div>

              {/* Resultado del test */}
              {seaceTestResult && (
                <div className={`mt-4 p-4 rounded-lg ${
                  seaceTestResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {seaceTestResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className={`font-medium ${
                      seaceTestResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                    }`}>
                      {seaceTestResult.message}
                    </span>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={handleTestSeace}
                  disabled={testingSeace || !seaceConfig.usuario || !seaceConfig.clave}
                >
                  {testingSeace ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Probando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Probar Conexión
                    </>
                  )}
                </Button>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowSeaceModal(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveSeaceConfig}
                    disabled={savingConfig}
                  >
                    {savingConfig ? 'Guardando...' : 'Guardar Configuración'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scraper Console */}
      <ScraperConsole
        sessionId={currentSessionId}
        isOpen={showConsole}
        onClose={handleConsoleClose}
        onSessionEnd={handleSessionEnd}
      />
    </div>
  );
}
