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
  FileText,
  Camera,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

interface AIConfig {
  provider: 'bedrock' | 'openai';
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  hasAwsCredentials: boolean;
  openaiApiKey: string;
  hasOpenaiKey: boolean;
  model: string;
  maxTokens: number;
  temperature: number;
  enabledFeatures: {
    chatAssistant: boolean;
    autoClassification: boolean;
    smartSuggestions: boolean;
    ocrExtraction: boolean;
    anomalyDetection: boolean;
    financialSummary: boolean;
  };
  usage: {
    totalRequests: number;
    totalTokens: number;
    lastUsed: string | null;
  };
}

export default function AdminAIConfigPage() {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'bedrock',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsRegion: 'us-east-1',
    hasAwsCredentials: false,
    openaiApiKey: '',
    hasOpenaiKey: false,
    model: 'claude-3-haiku',
    maxTokens: 2000,
    temperature: 0.7,
    enabledFeatures: {
      chatAssistant: true,
      autoClassification: false,
      smartSuggestions: false,
      ocrExtraction: false,
      anomalyDetection: false,
      financialSummary: false,
    },
    usage: {
      totalRequests: 0,
      totalTokens: 0,
      lastUsed: null,
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [awsCredentials, setAwsCredentials] = useState({
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
  });
  const { accessToken } = useAuthStore();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ai-config', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setAwsCredentials(prev => ({ ...prev, region: data.awsRegion || 'us-east-1' }));
      }
    } catch (err) {
      console.error('Error cargando configuración:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAwsCredentials = async () => {
    if (!awsCredentials.accessKeyId.trim() || !awsCredentials.secretAccessKey.trim()) {
      alert('Por favor ingresa las credenciales de AWS completas');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          provider: 'bedrock',
          awsAccessKeyId: awsCredentials.accessKeyId,
          awsSecretAccessKey: awsCredentials.secretAccessKey,
          awsRegion: awsCredentials.region,
        }),
      });

      if (response.ok) {
        setConfig((prev) => ({ ...prev, hasAwsCredentials: true, provider: 'bedrock' }));
        setAwsCredentials({ accessKeyId: '', secretAccessKey: '', region: awsCredentials.region });
        alert('Credenciales de AWS guardadas correctamente');
      } else {
        const error = await response.json();
        alert(error.error || 'Error guardando credenciales');
      }
    } catch (err) {
      console.error(err);
      alert('Error guardando credenciales');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeature = async (feature: keyof AIConfig['enabledFeatures']) => {
    const newValue = !config.enabledFeatures[feature];

    try {
      const response = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          enabledFeatures: {
            ...config.enabledFeatures,
            [feature]: newValue,
          },
        }),
      });

      if (response.ok) {
        setConfig((prev) => ({
          ...prev,
          enabledFeatures: {
            ...prev.enabledFeatures,
            [feature]: newValue,
          },
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateModel = async (model: string) => {
    try {
      const response = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ model }),
      });

      if (response.ok) {
        setConfig((prev) => ({ ...prev, model }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const bedrockModels = [
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      description: 'Más rápido y económico. Ideal para tareas simples.',
      speed: 'Rápido',
      cost: '$',
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Equilibrio entre rendimiento y costo. Recomendado.',
      speed: 'Medio',
      cost: '$$',
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      description: 'Más potente. Para tareas complejas de análisis.',
      speed: 'Lento',
      cost: '$$$',
    },
  ];

  const awsRegions = [
    { id: 'us-east-1', name: 'US East (N. Virginia)' },
    { id: 'us-west-2', name: 'US West (Oregon)' },
    { id: 'eu-west-1', name: 'Europe (Ireland)' },
    { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
  ];

  const features = [
    {
      key: 'chatAssistant' as const,
      name: 'Asistente de Chat',
      description: 'Chat con IA para consultas contables y tributarias',
      icon: MessageSquare,
      color: 'blue',
    },
    {
      key: 'autoClassification' as const,
      name: 'Clasificación Automática',
      description: 'Clasificar comprobantes de venta/compra automáticamente',
      icon: Zap,
      color: 'yellow',
    },
    {
      key: 'smartSuggestions' as const,
      name: 'Sugerencias Tributarias',
      description: 'Recomendaciones para optimizar IGV y Renta',
      icon: Brain,
      color: 'purple',
    },
    {
      key: 'ocrExtraction' as const,
      name: 'Extracción OCR',
      description: 'Extraer datos de fotos de facturas y boletas',
      icon: Camera,
      color: 'green',
    },
    {
      key: 'anomalyDetection' as const,
      name: 'Detección de Anomalías',
      description: 'Alertar transacciones inusuales o sospechosas',
      icon: FileSearch,
      color: 'red',
    },
    {
      key: 'financialSummary' as const,
      name: 'Resumen Financiero',
      description: 'Generar reportes ejecutivos con análisis de IA',
      icon: TrendingUp,
      color: 'indigo',
    },
  ];

  const getColorClasses = (color: string, enabled: boolean) => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Configuración de IA</h1>
          <p className="text-gray-600 dark:text-gray-400">AWS Bedrock con modelos Claude de Anthropic</p>
        </div>
      </div>

      {/* Credenciales AWS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Credenciales AWS Bedrock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            {config.hasAwsCredentials ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Credenciales configuradas</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Credenciales no configuradas</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Access Key ID
              </label>
              <Input
                type="text"
                placeholder="AKIA..."
                value={awsCredentials.accessKeyId}
                onChange={(e) => setAwsCredentials(prev => ({ ...prev, accessKeyId: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Secret Access Key
              </label>
              <div className="relative">
                <Input
                  type={showSecretKey ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  value={awsCredentials.secretAccessKey}
                  onChange={(e) => setAwsCredentials(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
              value={awsCredentials.region}
              onChange={(e) => setAwsCredentials(prev => ({ ...prev, region: e.target.value }))}
            >
              {awsRegions.map(region => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
          </div>

          <Button onClick={handleSaveAwsCredentials} disabled={saving} className="w-full sm:w-auto">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Credenciales'}
          </Button>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Las credenciales se almacenan encriptadas. Necesitas un usuario IAM con permisos para{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">bedrock:InvokeModel</code>.
            <a
              href="https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 ml-1"
            >
              Ver documentación
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Selección de Modelo Claude */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            Modelo Claude
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bedrockModels.map((model) => (
              <button
                key={model.id}
                onClick={() => handleUpdateModel(model.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  config.model === model.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900 dark:text-white">{model.name}</p>
                  {config.model === model.id && (
                    <CheckCircle className="w-5 h-5 text-primary-600" />
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{model.description}</p>
                <div className="flex items-center gap-4 text-xs">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                    {model.speed}
                  </span>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400">
                    {model.cost}
                  </span>
                </div>
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
              const colors = getColorClasses(feature.color, config.enabledFeatures[feature.key]);
              return (
                <div
                  key={feature.key}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                    config.enabledFeatures[feature.key]
                      ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <feature.icon className={`w-5 h-5 ${colors.icon}`} />
                    </div>
                    <div>
                      <p className={`font-medium ${config.enabledFeatures[feature.key] ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                        {feature.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{feature.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleFeature(feature.key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                      config.enabledFeatures[feature.key]
                        ? 'bg-primary-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.enabledFeatures[feature.key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
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
            Uso y Estadísticas
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
              <p className="text-sm text-green-600 dark:text-green-400">Último Uso</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-300">
                {config.usage.lastUsed
                  ? new Date(config.usage.lastUsed).toLocaleDateString('es-PE')
                  : 'Nunca'}
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
                Las credenciales de AWS se almacenan encriptadas. Usa un usuario IAM con permisos mínimos
                (solo bedrock:InvokeModel) y rota las credenciales periódicamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
