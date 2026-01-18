'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import {
  Mail,
  Server,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface SmtpConfig {
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_secure: boolean;
  hasPassword: boolean;
}

export default function SmtpConfigPage() {
  const [config, setConfig] = useState<SmtpConfig>({
    smtp_enabled: false,
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: '',
    smtp_secure: true,
    hasPassword: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await apiClient.get<SmtpConfig>('/api/admin/smtp');
      setConfig(data);
    } catch (error) {
      console.error('Error cargando config SMTP:', error);
      setMessage({ type: 'error', text: 'Error al cargar la configuración' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await apiClient.put('/api/admin/smtp', config);
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
      // Recargar para actualizar hasPassword
      await loadConfig();
    } catch (error) {
      console.error('Error guardando config:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Ingresa un email para la prueba' });
      return;
    }
    if (!config.smtp_host || !config.smtp_port || !config.smtp_from_email) {
      setMessage({ type: 'error', text: 'Completa host, puerto y email de origen primero' });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      // Enviar datos del formulario para probar sin necesidad de guardar primero
      const result = await apiClient.post<{ success: boolean; message: string; messageId?: string }>('/api/admin/smtp', {
        testEmail,
        smtp_host: config.smtp_host,
        smtp_port: config.smtp_port,
        smtp_user: config.smtp_user,
        smtp_password: config.smtp_password === '********' ? '' : config.smtp_password, // No enviar si es placeholder
        smtp_from_email: config.smtp_from_email,
        smtp_from_name: config.smtp_from_name,
      });
      setMessage({ type: 'success', text: result.message });
    } catch (error: unknown) {
      console.error('Error probando SMTP:', error);
      // Intentar extraer mensaje y sugerencia del error
      let errorText = 'Error de conexión';
      if (error instanceof Error) {
        errorText = error.message;
      }
      // Si el error tiene sugerencia (viene del API)
      const apiError = error as { suggestion?: string };
      if (apiError.suggestion) {
        errorText += `. ${apiError.suggestion}`;
      }
      setMessage({ type: 'error', text: errorText });
    } finally {
      setTesting(false);
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Configuración SMTP
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Configura el servidor de correo para enviar alertas y notificaciones
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuración del servidor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Servidor SMTP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Habilitar/Deshabilitar */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                {config.smtp_enabled ? (
                  <ToggleRight className="w-6 h-6 text-green-600" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-gray-400" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Envío de correos
                  </p>
                  <p className="text-sm text-gray-500">
                    {config.smtp_enabled ? 'Habilitado' : 'Deshabilitado'}
                  </p>
                </div>
              </div>
              <Button
                variant={config.smtp_enabled ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setConfig({ ...config, smtp_enabled: !config.smtp_enabled })}
              >
                {config.smtp_enabled ? 'Desactivar' : 'Activar'}
              </Button>
            </div>

            <Input
              label="Host del servidor"
              placeholder="smtp.gmail.com"
              value={config.smtp_host}
              onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
            />

            <Input
              label="Puerto"
              type="number"
              placeholder="587"
              value={config.smtp_port}
              onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value) || 587 })}
              helperText="587 = STARTTLS, 465 = SSL/TLS directo"
            />

            <Input
              label="Usuario"
              placeholder="tu@email.com"
              value={config.smtp_user}
              onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
            />

            <Input
              label="Contraseña"
              type="password"
              placeholder={config.hasPassword ? '********' : 'Contraseña de aplicación'}
              value={config.smtp_password}
              onChange={(e) => setConfig({ ...config, smtp_password: e.target.value })}
            />
            {config.hasPassword && (
              <p className="text-xs text-gray-500 -mt-2">
                Deja en blanco para mantener la contraseña actual
              </p>
            )}
          </CardContent>
        </Card>

        {/* Configuración del remitente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Remitente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Email de origen"
              type="email"
              placeholder="noreply@tuempresa.com"
              value={config.smtp_from_email}
              onChange={(e) => setConfig({ ...config, smtp_from_email: e.target.value })}
            />

            <Input
              label="Nombre del remitente"
              placeholder="ContadorVirtual"
              value={config.smtp_from_name}
              onChange={(e) => setConfig({ ...config, smtp_from_name: e.target.value })}
            />

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                Configuración para Gmail
              </h4>
              <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                <li><strong>Host:</strong> smtp.gmail.com</li>
                <li><strong>Puerto:</strong> 587 (recomendado)</li>
                <li><strong>Usuario:</strong> tu email completo de Gmail</li>
                <li><strong>Contraseña:</strong> Contraseña de aplicación (NO tu contraseña normal)</li>
                <li><strong>Email origen:</strong> el mismo email de Gmail</li>
              </ul>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
                Importante: Debes crear una "Contraseña de aplicación" en tu cuenta de Google.
                Tu contraseña normal NO funcionará.
              </p>
              <a
                href="https://support.google.com/accounts/answer/185833"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 dark:text-blue-300 underline mt-2 inline-block"
              >
                Cómo crear una contraseña de aplicación
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Probar conexión */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Probar Configuración
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  label="Email de prueba"
                  type="email"
                  placeholder="test@email.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing || !config.smtp_host}
                  isLoading={testing}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar prueba
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} isLoading={saving} size="lg">
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
}
