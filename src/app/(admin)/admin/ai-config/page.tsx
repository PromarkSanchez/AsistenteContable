'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bot,
  Settings,
  Key,
  Cpu,
  MessageSquare,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Zap,
  Brain,
  Shield,
  FileSearch,
  TrendingUp,
  Camera,
  Cloud,
  PlayCircle,
  Loader2,
  DollarSign,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type AIProvider = 'anthropic' | 'bedrock' | 'openai';

interface AIConfig {
  ai_provider: AIProvider;
  ai_model: string;
  ai_max_tokens: number;
  ai_temperature: number;
  anthropic_api_key: string;
  has_anthropic_api_key: boolean;
  aws_region: string;
  aws_access_key_id: string;
  has_aws_access_key_id: boolean;
  aws_secret_access_key: string;
  has_aws_secret_access_key: boolean;
  openai_api_key: string;
  has_openai_api_key: boolean;
  openai_org_id: string;
  ai_enabled_features: {
    chatAssistant: boolean;
    autoClassification: boolean;
    smartSuggestions: boolean;
    ocrExtraction: boolean;
    anomalyDetection: boolean;
    financialSummary: boolean;
  };
  available_models: Record<AIProvider, { id: string; name: string; description: string }[]>;
  usage: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
  };
}

export default function AdminAIConfigPage() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; response?: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAwsSecret, setShowAwsSecret] = useState(false);

  // Campos editables
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('anthropic');
  const [selectedModel, setSelectedModel] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<AIConfig>('/api/admin/ai-config');
      setConfig(data);
      setSelectedProvider(data.ai_provider);
      setSelectedModel(data.ai_model);
      setAwsRegion(data.aws_region || 'us-east-1');
    } catch (err) {
      console.error('Error cargando configuración:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setTestResult(null);

      const payload: Record<string, unknown> = {
        ai_provider: selectedProvider,
        ai_model: selectedModel,
      };

      // Agregar credenciales según el proveedor
      if (selectedProvider === 'anthropic' && anthropicApiKey && anthropicApiKey !== '********') {
        payload.anthropic_api_key = anthropicApiKey;
      }
      if (selectedProvider === 'bedrock') {
        payload.aws_region = awsRegion;
        if (awsAccessKeyId && awsAccessKeyId !== '********') {
          payload.aws_access_key_id = awsAccessKeyId;
        }
        if (awsSecretAccessKey && awsSecretAccessKey !== '********') {
          payload.aws_secret_access_key = awsSecretAccessKey;
        }
      }
      if (selectedProvider === 'openai' && openaiApiKey && openaiApiKey !== '********') {
        payload.openai_api_key = openaiApiKey;
      }

      await apiClient.put('/api/admin/ai-config', payload);
      // Limpiar campos de credenciales después de guardar
      setAnthropicApiKey('');
      setAwsAccessKeyId('');
      setAwsSecretAccessKey('');
      setOpenaiApiKey('');
      // Recargar configuración
      await loadConfig();
      setTestResult({ success: true, message: 'Configuración guardada correctamente' });
    } catch (err) {
      console.error(err);
      setTestResult({ success: false, message: 'Error guardando configuración' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const payload: Record<string, unknown> = {
        provider: selectedProvider,
        model: selectedModel,
      };

      if (selectedProvider === 'anthropic') {
        payload.apiKey = anthropicApiKey || undefined;
      } else if (selectedProvider === 'bedrock') {
        payload.awsRegion = awsRegion;
        payload.awsAccessKeyId = awsAccessKeyId || undefined;
        payload.awsSecretAccessKey = awsSecretAccessKey || undefined;
      } else if (selectedProvider === 'openai') {
        payload.openaiApiKey = openaiApiKey || undefined;
      }

      const result = await apiClient.post<{ success: boolean; message: string; response?: string }>(
        '/api/admin/ai-config',
        payload
      );

      setTestResult({
        success: result.success,
        message: result.message,
        response: result.response,
      });
    } catch (err: unknown) {
      const error = err as { message?: string };
      setTestResult({
        success: false,
        message: error.message || 'Error de conexión',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleFeature = async (feature: keyof AIConfig['ai_enabled_features']) => {
    if (!config) return;
    const newValue = !config.ai_enabled_features[feature];

    try {
      await apiClient.put('/api/admin/ai-config', {
        ai_enabled_features: {
          ...config.ai_enabled_features,
          [feature]: newValue,
        },
      });

      setConfig({
        ...config,
        ai_enabled_features: {
          ...config.ai_enabled_features,
          [feature]: newValue,
        },
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const providers = [
    { id: 'anthropic' as const, name: 'Anthropic Claude', icon: Bot, description: 'API directa de Anthropic' },
    { id: 'bedrock' as const, name: 'AWS Bedrock', icon: Cloud, description: 'Claude en infraestructura AWS' },
    { id: 'openai' as const, name: 'OpenAI', icon: Brain, description: 'GPT-4 y GPT-3.5' },
  ];

  const awsRegions = [
    { id: 'us-east-1', name: 'US East (N. Virginia)' },
    { id: 'us-west-2', name: 'US West (Oregon)' },
    { id: 'eu-west-1', name: 'Europe (Ireland)' },
    { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
    { id: 'sa-east-1', name: 'South America (São Paulo)' },
  ];

  const features = [
    { key: 'chatAssistant' as const, name: 'Asistente de Chat', description: 'Consultas contables y tributarias', icon: MessageSquare, color: 'blue' },
    { key: 'autoClassification' as const, name: 'Clasificación Automática', description: 'Clasificar comprobantes automáticamente', icon: Zap, color: 'yellow' },
    { key: 'smartSuggestions' as const, name: 'Sugerencias Tributarias', description: 'Recomendaciones para optimizar impuestos', icon: Brain, color: 'purple' },
    { key: 'ocrExtraction' as const, name: 'Extracción OCR', description: 'Extraer datos de fotos de facturas', icon: Camera, color: 'green' },
    { key: 'anomalyDetection' as const, name: 'Detección de Anomalías', description: 'Alertar transacciones inusuales', icon: FileSearch, color: 'red' },
    { key: 'financialSummary' as const, name: 'Resumen Financiero', description: 'Reportes ejecutivos con análisis IA', icon: TrendingUp, color: 'indigo' },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string }> = {
      blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400' },
      yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: 'text-yellow-600 dark:text-yellow-400' },
      purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', icon: 'text-purple-600 dark:text-purple-400' },
      green: { bg: 'bg-green-100 dark:bg-green-900/30', icon: 'text-green-600 dark:text-green-400' },
      red: { bg: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-400' },
      indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', icon: 'text-indigo-600 dark:text-indigo-400' },
    };
    return colors[color] || colors.blue;
  };

  const currentModels = config.available_models[selectedProvider] || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Configuración de IA</h1>
          <p className="text-gray-600 dark:text-gray-400">Configura el proveedor de IA para el asistente contable</p>
        </div>
      </div>

      {/* Mensaje de resultado */}
      {testResult && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          testResult.success
            ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        }`}>
          {testResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <div>
            <p>{testResult.message}</p>
            {testResult.response && (
              <p className="text-sm mt-1 opacity-80">Respuesta: {testResult.response}</p>
            )}
          </div>
        </div>
      )}

      {/* Selección de Proveedor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Proveedor de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => {
                  setSelectedProvider(provider.id);
                  // Seleccionar primer modelo disponible del proveedor
                  const models = config.available_models[provider.id];
                  if (models && models.length > 0) {
                    setSelectedModel(models[0].id);
                  }
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedProvider === provider.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <provider.icon className={`w-6 h-6 ${selectedProvider === provider.id ? 'text-primary-600' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-900 dark:text-white">{provider.name}</span>
                  {selectedProvider === provider.id && <CheckCircle className="w-5 h-5 text-primary-600 ml-auto" />}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{provider.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Credenciales según proveedor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Credenciales de {providers.find(p => p.id === selectedProvider)?.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedProvider === 'anthropic' && (
            <>
              <div className="flex items-center gap-2 mb-4">
                {config.has_anthropic_api_key ? (
                  <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" /> API Key configurada
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <AlertCircle className="w-5 h-5" /> API Key no configurada
                  </span>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Anthropic API Key
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={config.has_anthropic_api_key ? '********' : 'sk-ant-api03-...'}
                    value={anthropicApiKey}
                    onChange={(e) => setAnthropicApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Obtén tu API key en <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">console.anthropic.com</a>
                </p>
              </div>
            </>
          )}

          {selectedProvider === 'bedrock' && (
            <>
              <div className="flex items-center gap-2 mb-4">
                {config.has_aws_access_key_id && config.has_aws_secret_access_key ? (
                  <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" /> Credenciales AWS configuradas
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <AlertCircle className="w-5 h-5" /> Credenciales AWS no configuradas
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    AWS Access Key ID
                  </label>
                  <Input
                    type="text"
                    placeholder={config.has_aws_access_key_id ? '********' : 'AKIA...'}
                    value={awsAccessKeyId}
                    onChange={(e) => setAwsAccessKeyId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    AWS Secret Access Key
                  </label>
                  <div className="relative">
                    <Input
                      type={showAwsSecret ? 'text' : 'password'}
                      placeholder={config.has_aws_secret_access_key ? '********' : 'Secret...'}
                      value={awsSecretAccessKey}
                      onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAwsSecret(!showAwsSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showAwsSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Región AWS
                </label>
                <select
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  value={awsRegion}
                  onChange={(e) => setAwsRegion(e.target.value)}
                >
                  {awsRegions.map(region => (
                    <option key={region.id} value={region.id}>{region.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                Necesitas un usuario IAM con permisos <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">bedrock:InvokeModel</code>.
                <a href="https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline ml-1">Ver documentación</a>
              </p>
            </>
          )}

          {selectedProvider === 'openai' && (
            <>
              <div className="flex items-center gap-2 mb-4">
                {config.has_openai_api_key ? (
                  <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" /> API Key configurada
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <AlertCircle className="w-5 h-5" /> API Key no configurada
                  </span>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  OpenAI API Key
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={config.has_openai_api_key ? '********' : 'sk-...'}
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Obtén tu API key en <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">platform.openai.com</a>
                </p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving} isLoading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Guardar Configuración
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing} isLoading={testing}>
              <PlayCircle className="w-4 h-4 mr-2" />
              Probar Conexión
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Selección de Modelo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            Modelo de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentModels.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedModel === model.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900 dark:text-white">{model.name}</p>
                  {selectedModel === model.id && <CheckCircle className="w-5 h-5 text-primary-600" />}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{model.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Funcionalidades de IA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Funcionalidades de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature) => {
              const colors = getColorClasses(feature.color);
              const enabled = config.ai_enabled_features[feature.key];
              return (
                <div
                  key={feature.key}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                    enabled
                      ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <feature.icon className={`w-5 h-5 ${colors.icon}`} />
                    </div>
                    <div>
                      <p className={`font-medium ${enabled ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                        {feature.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{feature.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleFeature(feature.key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                      enabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Uso y Estadísticas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Uso del Mes Actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <p className="text-sm text-blue-600 dark:text-blue-400">Total Solicitudes</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                {config.usage.totalRequests.toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <p className="text-sm text-purple-600 dark:text-purple-400">Tokens Utilizados</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-700 dark:text-purple-300">
                {config.usage.totalTokens.toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-600 dark:text-green-400">Costo Estimado</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
                ${config.usage.totalCost.toFixed(4)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advertencia de Seguridad */}
      <Card className="border-yellow-200 dark:border-yellow-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Nota de Seguridad</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Las credenciales se almacenan encriptadas. Para AWS, usa un usuario IAM con permisos mínimos y rota las credenciales periódicamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
