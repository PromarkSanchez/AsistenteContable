'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Palette,
  Type,
  Image,
  Globe,
  Save,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useBrandingStore } from '@/store/branding-store';

interface BrandingConfig {
  appName: string;
  appDescription: string;
  logoBase64: string | null;
  faviconBase64: string | null;
}

export default function AdminBrandingPage() {
  const [config, setConfig] = useState<BrandingConfig>({
    appName: 'Gestión Empresarial',
    appDescription: 'Sistema de Gestión Tributaria',
    logoBase64: null,
    faviconBase64: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { accessToken } = useAuthStore();
  const { loadBranding } = useBrandingStore();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/branding', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Error cargando configuración:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/admin/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        // Forzar recarga del branding en toda la app
        await loadBranding(true);
        setMessage({ type: 'success', text: 'Configuración guardada correctamente. Los cambios ya están aplicados.' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Error guardando configuración' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error guardando configuración' });
    } finally {
      setSaving(false);
    }
  };

  const compressImage = async (file: File, maxWidth: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/png', 0.9);
            resolve(base64);
          } else {
            reject(new Error('No se pudo obtener el contexto del canvas'));
          }
        };
        img.onerror = () => reject(new Error('Error cargando imagen'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Solo se permiten archivos de imagen' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'El archivo no puede exceder 2MB' });
      return;
    }

    try {
      const base64 = await compressImage(file, 400);
      setConfig(prev => ({ ...prev, logoBase64: base64 }));
      setMessage(null);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error procesando imagen' });
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Solo se permiten archivos de imagen' });
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'El favicon no puede exceder 1MB' });
      return;
    }

    try {
      // Favicon se comprime a un tamaño más pequeño
      const base64 = await compressImage(file, 128);
      setConfig(prev => ({ ...prev, faviconBase64: base64 }));
      setMessage(null);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error procesando imagen' });
    }
  };

  const handleRemoveLogo = () => {
    setConfig(prev => ({ ...prev, logoBase64: null }));
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleRemoveFavicon = () => {
    setConfig(prev => ({ ...prev, faviconBase64: null }));
    if (faviconInputRef.current) faviconInputRef.current.value = '';
  };

  // Usar el logo como favicon (redimensionado a 32x32)
  const handleUseLogoAsFavicon = async () => {
    if (!config.logoBase64) {
      setMessage({ type: 'error', text: 'Primero debes subir un logo' });
      return;
    }

    try {
      const favicon = await compressImage(
        await fetch(config.logoBase64).then(r => r.blob()).then(b => new File([b], 'favicon.png', { type: 'image/png' })),
        32
      );
      setConfig(prev => ({ ...prev, faviconBase64: favicon }));
      setMessage({ type: 'success', text: 'Logo copiado como favicon. Recuerda guardar los cambios.' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error procesando imagen' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Personalización de Marca</h1>
          <p className="text-gray-600 dark:text-gray-400">Configura el nombre, logo y favicon de la aplicación</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>

      {/* Mensaje de estado */}
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
          {message.type === 'success' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              className="ml-auto"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Recargar
            </Button>
          )}
        </div>
      )}

      {/* Nombre de la App */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-5 h-5" />
            Nombre de la Aplicación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre
            </label>
            <Input
              type="text"
              placeholder="Gestión Empresarial"
              value={config.appName}
              onChange={(e) => setConfig(prev => ({ ...prev, appName: e.target.value }))}
              maxLength={100}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Este nombre aparecerá en la barra lateral y el título del navegador
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción corta
            </label>
            <Input
              type="text"
              placeholder="Sistema de Gestión Tributaria"
              value={config.appDescription}
              onChange={(e) => setConfig(prev => ({ ...prev, appDescription: e.target.value }))}
              maxLength={255}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Aparecerá en la metadata del sitio para SEO
            </p>
          </div>

          {/* Preview */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Vista previa del título:</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {config.appName || 'Gestión Empresarial'} - {config.appDescription || 'Sistema de Gestión Tributaria'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Logo de la App */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            Logo de la Aplicación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            El logo aparecerá en la barra lateral del dashboard. Recomendamos una imagen cuadrada de al menos 200x200 píxeles.
          </p>

          <div className="flex items-start gap-6">
            {/* Preview */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
                {config.logoBase64 ? (
                  <img
                    src={config.logoBase64}
                    alt="Logo preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <Image className="w-8 h-8 mx-auto text-gray-400" />
                    <p className="text-xs text-gray-400 mt-1">Sin logo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload controls */}
            <div className="flex-1 space-y-3">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {config.logoBase64 ? 'Cambiar Logo' : 'Subir Logo'}
                </Button>
                {config.logoBase64 && (
                  <Button
                    variant="outline"
                    onClick={handleRemoveLogo}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Formatos: PNG, JPG, SVG. Máximo 2MB.
              </p>
            </div>
          </div>

          {/* Preview en sidebar */}
          {config.logoBase64 && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-400 mb-3">Vista previa en sidebar:</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                  <img
                    src={config.logoBase64}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-semibold text-white">{config.appName || 'Gestión Empresarial'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Favicon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Icono del Navegador (Favicon)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            El favicon es el pequeño icono que aparece en la pestaña del navegador. Recomendamos una imagen cuadrada de 32x32 o 64x64 píxeles.
          </p>

          <div className="flex items-start gap-6">
            {/* Preview */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
                {config.faviconBase64 ? (
                  <img
                    src={config.faviconBase64}
                    alt="Favicon preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <Globe className="w-6 h-6 mx-auto text-gray-400" />
                    <p className="text-xs text-gray-400 mt-1">Sin icono</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload controls */}
            <div className="flex-1 space-y-3">
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/*"
                onChange={handleFaviconUpload}
                className="hidden"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => faviconInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {config.faviconBase64 ? 'Cambiar Favicon' : 'Subir Favicon'}
                </Button>
                {config.logoBase64 && (
                  <Button
                    variant="outline"
                    onClick={handleUseLogoAsFavicon}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Usar Logo como Favicon
                  </Button>
                )}
                {config.faviconBase64 && (
                  <Button
                    variant="outline"
                    onClick={handleRemoveFavicon}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Formatos: PNG, ICO. Máximo 1MB. También puedes usar el logo como favicon.
              </p>
            </div>
          </div>

          {/* Preview en pestaña */}
          {config.faviconBase64 && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Vista previa de pestaña:</p>
              <div className="flex items-center gap-2 bg-white dark:bg-gray-700 rounded px-3 py-2 w-fit">
                <img
                  src={config.faviconBase64}
                  alt="Favicon"
                  className="w-4 h-4 object-contain"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                  {config.appName || 'Gestión Empresarial'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">Nota sobre los cambios</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Los cambios en el nombre y logo se reflejarán inmediatamente después de guardar y recargar la página.
                El favicon puede tardar unos minutos en actualizarse debido al caché del navegador.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
