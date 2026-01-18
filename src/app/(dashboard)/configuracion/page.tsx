'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { companySchema, type CompanyInput } from '@/lib/validations';
import { companiesApi } from '@/lib/api-client';
import { useCompanyStore } from '@/store/company-store';
import { REGIMEN_NOMBRES } from '@/lib/utils';
import {
  Building2,
  Key,
  FileKey,
  Plus,
  Save,
  Trash2,
  Upload,
  CheckCircle,
  AlertCircle,
  Fingerprint,
  PenTool,
  Globe,
  Loader2,
  Play,
  Terminal,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  Bug,
} from 'lucide-react';

// Log entry type for SEACE console
interface SeaceLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
}

const credentialsSchema = z.object({
  usuarioSol: z.string().min(1, 'Usuario SOL requerido'),
  claveSol: z.string().min(1, 'Clave SOL requerida'),
});

type CredentialsInput = z.infer<typeof credentialsSchema>;

export default function ConfiguracionPage() {
  const { selectedCompany, companies, addCompany, updateCompany } = useCompanyStore();
  const [activeTab, setActiveTab] = useState<'general' | 'sunat' | 'facturacion' | 'inventario'>('general');
  const [isCreating, setIsCreating] = useState(!selectedCompany);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const certInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const firmaInputRef = useRef<HTMLInputElement>(null);
  const huellaInputRef = useRef<HTMLInputElement>(null);
  const [pendingLogo, setPendingLogo] = useState<{ file: File; preview: string } | null>(null);
  const [isUploadingFirma, setIsUploadingFirma] = useState(false);
  const [isUploadingHuella, setIsUploadingHuella] = useState(false);

  // SEACE config state
  const [seaceConfig, setSeaceConfig] = useState({
    usuarioSeace: '',
    claveSeace: '',
    entidadSeace: '',
    siglaEntidadSeace: '',
    anioSeace: new Date().getFullYear().toString(),
    seaceEnabled: false,
  });
  const [hasSeaceCredentials, setHasSeaceCredentials] = useState(false);
  const [isSavingSeace, setIsSavingSeace] = useState(false);
  const [wantsToChangeSeaceClave, setWantsToChangeSeaceClave] = useState(false);
  const [loadingSeaceConfig, setLoadingSeaceConfig] = useState(false);
  const [runningSeaceScraper, setRunningSeaceScraper] = useState(false);
  const [seaceSessionId, setSeaceSessionId] = useState<string | null>(null);
  const [showSeaceLogs, setShowSeaceLogs] = useState(false);
  const [seaceLogs, setSeaceLogs] = useState<SeaceLogEntry[]>([]);
  const [seaceSessionStatus, setSeaceSessionStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const seaceLogsEndRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: selectedCompany
      ? {
          ruc: selectedCompany.ruc,
          razonSocial: selectedCompany.razonSocial,
          nombreComercial: selectedCompany.nombreComercial || '',
          regimen: selectedCompany.regimen,
          tipoContribuyente: selectedCompany.tipoContribuyente || '',
          direccionFiscal: selectedCompany.direccionFiscal || '',
          ubigeo: selectedCompany.ubigeo || '',
          telefono: selectedCompany.telefono || '',
          email: selectedCompany.email || '',
          coeficienteRenta: selectedCompany.coeficienteRenta || '0.0150',
        }
      : undefined,
  });

  const {
    register: registerCredentials,
    handleSubmit: handleSubmitCredentials,
    formState: { errors: credErrors },
  } = useForm<CredentialsInput>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      usuarioSol: selectedCompany?.usuarioSol || '',
      claveSol: '',
    },
  });

  const onSubmit = async (data: CompanyInput) => {
    try {
      setError(null);
      setSuccess(null);

      if (isCreating || !selectedCompany) {
        const newCompany = await companiesApi.create(data);

        // Si hay un logo pendiente, subirlo después de crear la empresa
        if (pendingLogo) {
          try {
            const logoResponse = await companiesApi.uploadLogo(newCompany.id, pendingLogo.file);
            newCompany.logoBase64 = logoResponse.logoUrl;
          } catch (logoErr) {
            console.error('Error al subir logo:', logoErr);
            // No fallar la creación si el logo falla
          }
          setPendingLogo(null);
          if (logoInputRef.current) logoInputRef.current.value = '';
        }

        addCompany(newCompany);
        setIsCreating(false);
        setSuccess('Empresa creada correctamente');
        reset(data);
      } else {
        const updatedCompany = await companiesApi.update(selectedCompany.id, data);
        updateCompany(selectedCompany.id, updatedCompany);
        setSuccess('Empresa actualizada correctamente');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  // Función para comprimir imagen antes de subir (reduce tamaño del PDF)
  const compressImage = async (file: File, maxWidth = 300, quality = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Calcular dimensiones manteniendo proporción
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        // Crear canvas para redimensionar
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo crear contexto de canvas'));
          return;
        }

        // IMPORTANTE: Pintar fondo blanco primero (PNG transparente -> JPEG necesita fondo)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Dibujar imagen redimensionada sobre el fondo blanco
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a Blob con compresión JPEG
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Error al comprimir imagen'));
              return;
            }
            // Crear nuevo File con el blob comprimido
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Error al cargar imagen'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño original (5MB máximo antes de comprimir)
    if (file.size > 5 * 1024 * 1024) {
      setError('El logo no debe exceder 5MB');
      return;
    }

    try {
      // Comprimir imagen antes de subir (máx 600px de ancho, calidad 92%)
      const compressedFile = await compressImage(file, 600, 0.92);
      console.log(`Logo comprimido: ${(file.size / 1024).toFixed(0)}KB -> ${(compressedFile.size / 1024).toFixed(0)}KB`);

      // Si estamos creando, guardar en estado temporal
      if (isCreating || !selectedCompany) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPendingLogo({
            file: compressedFile,
            preview: reader.result as string,
          });
        };
        reader.readAsDataURL(compressedFile);
        return;
      }

      // Si estamos editando, subir inmediatamente
      setError(null);
      const response = await companiesApi.uploadLogo(selectedCompany.id, compressedFile);
      updateCompany(selectedCompany.id, { logoBase64: response.logoUrl });
      setSuccess('Logo actualizado correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir logo');
    }
  };

  const handleRemovePendingLogo = () => {
    setPendingLogo(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const onSubmitCredentials = async (data: CredentialsInput) => {
    if (!selectedCompany) return;

    try {
      setIsSavingCredentials(true);
      setError(null);
      setSuccess(null);

      await companiesApi.updateCredentials(selectedCompany.id, data);
      updateCompany(selectedCompany.id, { usuarioSol: data.usuarioSol, hasCredentials: true });
      setSuccess('Credenciales guardadas correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar credenciales');
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const handleDeleteCredentials = async () => {
    if (!selectedCompany) return;

    if (!confirm('¿Está seguro de eliminar las credenciales SUNAT?')) return;

    try {
      setError(null);
      await companiesApi.deleteCredentials(selectedCompany.id);
      updateCompany(selectedCompany.id, { usuarioSol: null, hasCredentials: false });
      setSuccess('Credenciales eliminadas correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar credenciales');
    }
  };

  // SEACE functions
  const loadSeaceConfig = async () => {
    if (!selectedCompany) return;

    try {
      setLoadingSeaceConfig(true);
      const data = await companiesApi.getSeaceConfig(selectedCompany.id);
      if (data.config) {
        setSeaceConfig({
          usuarioSeace: data.config.usuarioSeace || '',
          claveSeace: '',
          entidadSeace: data.config.entidadSeace || '',
          siglaEntidadSeace: data.config.siglaEntidadSeace || '',
          anioSeace: data.config.anioSeace || new Date().getFullYear().toString(),
          seaceEnabled: data.config.seaceEnabled,
        });
        setHasSeaceCredentials(data.config.hasClaveSeace);
        setWantsToChangeSeaceClave(false);
      }
    } catch (err) {
      console.error('Error cargando config SEACE:', err);
    } finally {
      setLoadingSeaceConfig(false);
    }
  };

  const handleSaveSeaceConfig = async () => {
    if (!selectedCompany) return;

    try {
      setIsSavingSeace(true);
      setError(null);

      // Enviar clave si: es primera vez (!hasSeaceCredentials) O si quiere cambiarla (wantsToChangeSeaceClave)
      const shouldSendClave = (!hasSeaceCredentials || wantsToChangeSeaceClave) && seaceConfig.claveSeace;

      const configToSave = {
        usuarioSeace: seaceConfig.usuarioSeace,
        entidadSeace: seaceConfig.entidadSeace,
        siglaEntidadSeace: seaceConfig.siglaEntidadSeace,
        anioSeace: seaceConfig.anioSeace,
        seaceEnabled: seaceConfig.seaceEnabled,
        ...(shouldSendClave ? { claveSeace: seaceConfig.claveSeace } : {}),
      };

      await companiesApi.updateSeaceCredentials(selectedCompany.id, configToSave);

      if (shouldSendClave) {
        setHasSeaceCredentials(true);
      }
      setWantsToChangeSeaceClave(false);
      setSeaceConfig(prev => ({ ...prev, claveSeace: '' }));
      setSuccess('Configuración SEACE guardada correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar configuración SEACE');
    } finally {
      setIsSavingSeace(false);
    }
  };

  const handleRunSeaceScraper = async () => {
    if (!selectedCompany) return;

    try {
      setRunningSeaceScraper(true);
      setError(null);
      setSeaceLogs([]);
      setSeaceSessionStatus('running');

      const result = await companiesApi.runSeaceScraper(selectedCompany.id);

      if (result.success && result.sessionId) {
        setSeaceSessionId(result.sessionId);
        setShowSeaceLogs(true);
      } else {
        setError(result.message || 'Error al ejecutar el scraper');
        setSeaceSessionStatus('failed');
        setRunningSeaceScraper(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al ejecutar el scraper SEACE');
      setSeaceSessionStatus('failed');
      setRunningSeaceScraper(false);
    }
  };

  // Polling de logs para SEACE
  useEffect(() => {
    if (!seaceSessionId || !showSeaceLogs || seaceSessionStatus !== 'running') {
      return;
    }

    let isPollingActive = true;
    let lastLogId = '';
    let pollCount = 0;
    const maxPolls = 300; // 5 minutos máximo

    const pollLogs = async (): Promise<boolean> => {
      if (!isPollingActive) return false;

      try {
        const response = await fetch(`/api/admin/alertas/scraper-logs?sessionId=${seaceSessionId}&action=history`, {
          credentials: 'include',
        });

        if (!response.ok) return isPollingActive;

        const data = await response.json();

        if (data.logs && Array.isArray(data.logs)) {
          const newLogs = data.logs.filter((log: SeaceLogEntry) => {
            if (!lastLogId) return true;
            return log.id > lastLogId;
          });

          if (newLogs.length > 0) {
            setSeaceLogs(prev => {
              const existingIds = new Set(prev.map(l => l.id));
              const uniqueNew = newLogs.filter((l: SeaceLogEntry) => !existingIds.has(l.id));
              return [...prev, ...uniqueNew];
            });
            lastLogId = data.logs[data.logs.length - 1]?.id || lastLogId;
          }
        }

        // Verificar si la sesión terminó
        if (data.session) {
          if (data.session.status === 'completed') {
            setSeaceSessionStatus('completed');
            setRunningSeaceScraper(false);
            return false;
          } else if (data.session.status === 'failed') {
            setSeaceSessionStatus('failed');
            setRunningSeaceScraper(false);
            return false;
          }
        }

        return isPollingActive;
      } catch (error) {
        console.error('Error polling logs:', error);
        return isPollingActive;
      }
    };

    const intervalId = setInterval(async () => {
      if (!isPollingActive) return;

      pollCount++;
      if (pollCount > maxPolls) {
        isPollingActive = false;
        setSeaceSessionStatus('failed');
        setRunningSeaceScraper(false);
        return;
      }

      const shouldContinue = await pollLogs();
      if (!shouldContinue) {
        isPollingActive = false;
      }
    }, 1000);

    // Poll inmediatamente al inicio
    pollLogs();

    return () => {
      isPollingActive = false;
      clearInterval(intervalId);
    };
  }, [seaceSessionId, showSeaceLogs, seaceSessionStatus]);

  // Auto-scroll logs
  useEffect(() => {
    if (seaceLogsEndRef.current) {
      seaceLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [seaceLogs]);

  const handleDeleteSeaceCredentials = async () => {
    if (!selectedCompany) return;

    if (!confirm('¿Está seguro de eliminar las credenciales SEACE?')) return;

    try {
      setError(null);
      await companiesApi.deleteSeaceCredentials(selectedCompany.id);
      setHasSeaceCredentials(false);
      setSeaceConfig({
        usuarioSeace: '',
        claveSeace: '',
        entidadSeace: '',
        siglaEntidadSeace: '',
        anioSeace: new Date().getFullYear().toString(),
        seaceEnabled: false,
      });
      setSuccess('Credenciales SEACE eliminadas correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar credenciales SEACE');
    }
  };

  // Cargar config SEACE cuando se selecciona la pestaña SUNAT
  useEffect(() => {
    if (activeTab === 'sunat' && selectedCompany) {
      loadSeaceConfig();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedCompany?.id]);

  const handleCertificateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompany) return;

    if (!certPassword) {
      setError('Ingrese la contraseña del certificado');
      return;
    }

    try {
      setIsUploadingCert(true);
      setError(null);
      setSuccess(null);

      await companiesApi.uploadCertificate(selectedCompany.id, file, certPassword);
      updateCompany(selectedCompany.id, { hasCertificado: true });
      setSuccess('Certificado subido correctamente');
      setCertPassword('');
      if (certInputRef.current) certInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir certificado');
    } finally {
      setIsUploadingCert(false);
    }
  };

  const handleDeleteCertificate = async () => {
    if (!selectedCompany) return;

    if (!confirm('¿Está seguro de eliminar el certificado digital?')) return;

    try {
      setError(null);
      await companiesApi.deleteCertificate(selectedCompany.id);
      updateCompany(selectedCompany.id, { hasCertificado: false });
      setSuccess('Certificado eliminado correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar certificado');
    }
  };

  const handleFirmaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompany) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('La firma no debe exceder 2MB');
      return;
    }

    try {
      setIsUploadingFirma(true);
      setError(null);

      // Comprimir imagen
      const compressedFile = await compressImage(file, 400, 0.9);

      // Subir al servidor
      const response = await companiesApi.uploadFirma(selectedCompany.id, compressedFile);
      updateCompany(selectedCompany.id, { firmaDigitalBase64: response.firmaUrl });
      setSuccess('Firma digital actualizada correctamente');
      if (firmaInputRef.current) firmaInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir firma');
    } finally {
      setIsUploadingFirma(false);
    }
  };

  const handleDeleteFirma = async () => {
    if (!selectedCompany) return;

    if (!confirm('¿Está seguro de eliminar la firma digital?')) return;

    try {
      setError(null);
      await companiesApi.deleteFirma(selectedCompany.id);
      updateCompany(selectedCompany.id, { firmaDigitalBase64: null });
      setSuccess('Firma eliminada correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar firma');
    }
  };

  const handleHuellaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompany) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('La huella no debe exceder 2MB');
      return;
    }

    try {
      setIsUploadingHuella(true);
      setError(null);

      // Comprimir imagen
      const compressedFile = await compressImage(file, 200, 0.9);

      // Subir al servidor
      const response = await companiesApi.uploadHuella(selectedCompany.id, compressedFile);
      updateCompany(selectedCompany.id, { huellaDigitalBase64: response.huellaUrl });
      setSuccess('Huella digital actualizada correctamente');
      if (huellaInputRef.current) huellaInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir huella');
    } finally {
      setIsUploadingHuella(false);
    }
  };

  const handleDeleteHuella = async () => {
    if (!selectedCompany) return;

    if (!confirm('¿Está seguro de eliminar la huella digital?')) return;

    try {
      setError(null);
      await companiesApi.deleteHuella(selectedCompany.id);
      updateCompany(selectedCompany.id, { huellaDigitalBase64: null });
      setSuccess('Huella eliminada correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar huella');
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'sunat', label: 'SUNAT', icon: Key },
    { id: 'facturacion', label: 'Facturación', icon: FileKey },
    { id: 'inventario', label: 'Firmas y Sellos', icon: PenTool },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isCreating ? 'Crear nueva empresa' : 'Gestiona tu empresa'}
          </p>
        </div>
        {!isCreating && companies.length > 0 && (
          <Button variant="outline" onClick={() => setIsCreating(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Empresa
          </Button>
        )}
      </div>

      {/* Mensajes */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Tabs */}
      {!isCreating && selectedCompany && (
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Contenido General */}
      {(isCreating || activeTab === 'general') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {isCreating ? 'Nueva Empresa' : 'Datos de la Empresa'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Logo */}
              <div className="flex items-center gap-4">
                {/* Mostrar logo existente o pendiente */}
                {(isCreating && pendingLogo) ? (
                  <img
                    src={pendingLogo.preview}
                    alt="Logo preview"
                    className="w-20 h-20 rounded-lg object-contain bg-gray-50 dark:bg-gray-700 border dark:border-gray-600"
                  />
                ) : (!isCreating && selectedCompany?.logoBase64) ? (
                  <img
                    src={selectedCompany.logoBase64}
                    alt="Logo"
                    className="w-20 h-20 rounded-lg object-contain bg-gray-50 dark:bg-gray-700 border dark:border-gray-600"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border dark:border-gray-600">
                    <Building2 className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center justify-center font-medium rounded-lg px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <Upload className="w-4 h-4 mr-2" />
                      {pendingLogo || selectedCompany?.logoBase64 ? 'Cambiar Logo' : 'Subir Logo'}
                    </label>
                    {isCreating && pendingLogo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemovePendingLogo}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG hasta 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="RUC"
                  placeholder="20123456789"
                  error={errors.ruc?.message}
                  disabled={!isCreating && !!selectedCompany}
                  {...register('ruc')}
                />
                <Input
                  label="Razón Social"
                  placeholder="MI EMPRESA S.A.C."
                  error={errors.razonSocial?.message}
                  {...register('razonSocial')}
                />
                <Input
                  label="Nombre Comercial"
                  placeholder="Mi Empresa"
                  error={errors.nombreComercial?.message}
                  {...register('nombreComercial')}
                />
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Régimen Tributario
                  </label>
                  <select
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    {...register('regimen')}
                  >
                    {Object.entries(REGIMEN_NOMBRES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {errors.regimen && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.regimen.message}</p>
                  )}
                </div>
                <Input
                  label="Dirección Fiscal"
                  placeholder="Av. Principal 123, Lima"
                  error={errors.direccionFiscal?.message}
                  {...register('direccionFiscal')}
                />
                <Input
                  label="Ubigeo"
                  placeholder="150101"
                  error={errors.ubigeo?.message}
                  {...register('ubigeo')}
                />
                <Input
                  label="Teléfono"
                  placeholder="01 234 5678"
                  error={errors.telefono?.message}
                  {...register('telefono')}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="empresa@email.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label="Coeficiente de Renta"
                  placeholder="0.0150"
                  error={errors.coeficienteRenta?.message}
                  {...register('coeficienteRenta')}
                />
              </div>

              <div className="flex justify-end gap-2">
                {isCreating && selectedCompany && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreating(false);
                      reset();
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                <Button type="submit" isLoading={isSubmitting}>
                  <Save className="w-4 h-4 mr-2" />
                  {isCreating ? 'Crear Empresa' : 'Guardar Cambios'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab SUNAT */}
      {!isCreating && selectedCompany && activeTab === 'sunat' && (
        <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Credenciales SUNAT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitCredentials(onSubmitCredentials)} className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configura tus credenciales de Clave SOL para habilitar la facturación
                electrónica y consultas a SUNAT.
              </p>

              {selectedCompany.hasCredentials && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Credenciales configuradas (Usuario: {selectedCompany.usuarioSol})
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Usuario SOL"
                  placeholder="USUARIO123"
                  error={credErrors.usuarioSol?.message}
                  {...registerCredentials('usuarioSol')}
                />
                <Input
                  label="Clave SOL"
                  type="password"
                  placeholder="********"
                  error={credErrors.claveSol?.message}
                  {...registerCredentials('claveSol')}
                />
              </div>
              <div className="flex justify-end gap-2">
                {selectedCompany.hasCredentials && (
                  <Button type="button" variant="danger" onClick={handleDeleteCredentials}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar Credenciales
                  </Button>
                )}
                <Button type="submit" isLoading={isSavingCredentials}>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Credenciales
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Card SEACE - al lado de SUNAT */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Credenciales SEACE
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSeaceConfig ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Configura tus credenciales del portal SEACE para recibir alertas de licitaciones y procedimientos de selección.
                </p>

                {hasSeaceCredentials && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Credenciales SEACE configuradas (Usuario: {seaceConfig.usuarioSeace})
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Usuario SEACE"
                    placeholder="Ingrese usuario"
                    value={seaceConfig.usuarioSeace}
                    onChange={(e) => setSeaceConfig({ ...seaceConfig, usuarioSeace: e.target.value })}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Clave SEACE
                    </label>
                    {hasSeaceCredentials && !wantsToChangeSeaceClave ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-700 dark:text-green-300">Clave configurada</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWantsToChangeSeaceClave(true)}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                          Cambiar clave
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          type="password"
                          value={seaceConfig.claveSeace}
                          onChange={(e) => setSeaceConfig({ ...seaceConfig, claveSeace: e.target.value })}
                          placeholder={hasSeaceCredentials ? "Ingrese nueva clave" : "Ingrese clave"}
                        />
                        {hasSeaceCredentials && wantsToChangeSeaceClave && (
                          <button
                            type="button"
                            onClick={() => {
                              setWantsToChangeSeaceClave(false);
                              setSeaceConfig(prev => ({ ...prev, claveSeace: '' }));
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 underline"
                          >
                            Cancelar cambio de clave
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Input
                  label="Entidad a buscar"
                  placeholder="SUPERINTENDENCIA NACIONAL DE ADUANAS Y DE ADMINISTRACION TRIBUTARIA - SUNAT"
                  value={seaceConfig.entidadSeace}
                  onChange={(e) => setSeaceConfig({ ...seaceConfig, entidadSeace: e.target.value })}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Sigla de la entidad"
                    placeholder="Ej: SUNAT"
                    value={seaceConfig.siglaEntidadSeace}
                    onChange={(e) => setSeaceConfig({ ...seaceConfig, siglaEntidadSeace: e.target.value })}
                  />
                  <Input
                    label="Año de búsqueda"
                    placeholder="2025"
                    value={seaceConfig.anioSeace}
                    onChange={(e) => setSeaceConfig({ ...seaceConfig, anioSeace: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="seaceEnabled"
                    checked={seaceConfig.seaceEnabled}
                    onChange={(e) => setSeaceConfig({ ...seaceConfig, seaceEnabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="seaceEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                    Habilitar alertas de licitaciones SEACE
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {hasSeaceCredentials && (
                    <>
                      <Button type="button" variant="danger" onClick={handleDeleteSeaceCredentials}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRunSeaceScraper}
                        disabled={runningSeaceScraper}
                      >
                        {runningSeaceScraper ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Ejecutando...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Ejecutar
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  <Button onClick={handleSaveSeaceConfig} isLoading={isSavingSeace}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Configuración SEACE
                  </Button>
                </div>

                {/* Inline Console Logs */}
                {showSeaceLogs && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Consola de ejecución
                        </span>
                        {seaceSessionStatus === 'running' && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-600 dark:text-green-400 rounded text-xs font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            En vivo
                          </span>
                        )}
                        {seaceSessionStatus === 'completed' && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-600 dark:text-green-400 rounded text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Completado
                          </span>
                        )}
                        {seaceSessionStatus === 'failed' && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 text-red-600 dark:text-red-400 rounded text-xs font-medium">
                            <AlertCircle className="w-3 h-3" />
                            Error
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSeaceLogs(!showSeaceLogs)}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {showSeaceLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="bg-gray-900 rounded-lg overflow-hidden">
                      <div className="max-h-64 overflow-y-auto p-3 font-mono text-xs space-y-1">
                        {seaceLogs.length === 0 ? (
                          <div className="flex items-center justify-center py-8 text-gray-500">
                            <div className="text-center">
                              <Terminal className="w-6 h-6 mx-auto mb-2 opacity-50" />
                              <p>Esperando logs...</p>
                            </div>
                          </div>
                        ) : (
                          seaceLogs.map((log) => {
                            const levelStyles: Record<string, { text: string; icon: typeof Info }> = {
                              info: { text: 'text-blue-400', icon: Info },
                              success: { text: 'text-green-400', icon: CheckCircle },
                              warning: { text: 'text-yellow-400', icon: AlertTriangle },
                              error: { text: 'text-red-400', icon: AlertCircle },
                              debug: { text: 'text-gray-400', icon: Bug },
                            };
                            const style = levelStyles[log.level] || levelStyles.info;
                            const Icon = style.icon;
                            const time = new Date(log.timestamp).toLocaleTimeString('es-PE', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            });

                            return (
                              <div
                                key={log.id}
                                className="flex items-start gap-2 px-2 py-1 rounded hover:bg-gray-800"
                              >
                                <Icon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${style.text}`} />
                                <span className="text-gray-500 flex-shrink-0">{time}</span>
                                <span className="text-blue-400 flex-shrink-0">[{log.source}]</span>
                                <span className="text-gray-200 break-words">{log.message}</span>
                              </div>
                            );
                          })
                        )}
                        <div ref={seaceLogsEndRef} />
                      </div>
                      <div className="px-3 py-2 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {seaceLogs.length} líneas
                        </span>
                        {seaceSessionStatus !== 'running' && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSeaceLogs(false);
                              setSeaceLogs([]);
                              setSeaceSessionId(null);
                              setSeaceSessionStatus('idle');
                            }}
                            className="text-xs text-gray-400 hover:text-white"
                          >
                            Cerrar consola
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </>
      )}

      {/* Tab Facturación */}
      {!isCreating && selectedCompany && activeTab === 'facturacion' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileKey className="w-5 h-5" />
              Configuración de Facturación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Serie de Facturas
                  </label>
                  <p className="text-lg font-semibold dark:text-white">{selectedCompany.serieFactura || 'F001'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Último número: {selectedCompany.ultimoNumeroFactura || 0}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Serie de Boletas
                  </label>
                  <p className="text-lg font-semibold dark:text-white">{selectedCompany.serieBoleta || 'B001'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Último número: {selectedCompany.ultimoNumeroBoleta || 0}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Certificado Digital</h4>

                {selectedCompany.hasCertificado ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Certificado digital configurado
                    </div>
                    <Button variant="danger" onClick={handleDeleteCertificate}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar Certificado
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Sube tu certificado digital (.pfx o .p12) para habilitar la firma
                      electrónica de comprobantes.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Contraseña del certificado"
                        type="password"
                        placeholder="********"
                        value={certPassword}
                        onChange={(e) => setCertPassword(e.target.value)}
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Archivo del certificado
                        </label>
                        <label className="cursor-pointer inline-flex items-center justify-center font-medium rounded-lg px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full">
                          <input
                            ref={certInputRef}
                            type="file"
                            accept=".pfx,.p12"
                            className="hidden"
                            onChange={handleCertificateUpload}
                            disabled={isUploadingCert}
                          />
                          {isUploadingCert ? (
                            'Subiendo...'
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Seleccionar archivo
                            </>
                          )}
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Solo archivos .pfx o .p12</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Firmas y Sellos */}
      {!isCreating && selectedCompany && activeTab === 'inventario' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="w-5 h-5" />
              Firmas y Sellos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configura la firma digital y huella digital que aparecerán en los informes y documentos generados.
                Estas imágenes se usarán para visar cada hoja de los informes.
              </p>

              {/* Firma Digital */}
              <div className="pt-4 border-t dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Firma Digital
                </h4>

                <div className="flex items-start gap-4">
                  {selectedCompany.firmaDigitalBase64 ? (
                    <img
                      src={selectedCompany.firmaDigitalBase64}
                      alt="Firma"
                      className="w-32 h-20 rounded-lg object-contain bg-gray-50 dark:bg-gray-700 border dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-32 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border dark:border-gray-600">
                      <PenTool className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Sube una imagen de la firma (PNG, JPG) que se incluirá en los informes de inventario.
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center justify-center font-medium rounded-lg px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <input
                          ref={firmaInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFirmaUpload}
                          disabled={isUploadingFirma}
                        />
                        {isUploadingFirma ? (
                          'Subiendo...'
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            {selectedCompany.firmaDigitalBase64 ? 'Cambiar Firma' : 'Subir Firma'}
                          </>
                        )}
                      </label>
                      {selectedCompany.firmaDigitalBase64 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleDeleteFirma}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG hasta 2MB - Fondo transparente recomendado</p>
                  </div>
                </div>
              </div>

              {/* Huella Digital */}
              <div className="pt-4 border-t dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Fingerprint className="w-4 h-4" />
                  Huella Digital
                </h4>

                <div className="flex items-start gap-4">
                  {selectedCompany.huellaDigitalBase64 ? (
                    <img
                      src={selectedCompany.huellaDigitalBase64}
                      alt="Huella"
                      className="w-20 h-24 rounded-lg object-contain bg-gray-50 dark:bg-gray-700 border dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-20 h-24 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border dark:border-gray-600">
                      <Fingerprint className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Sube una imagen de la huella digital (PNG, JPG) que se incluirá en los informes de inventario.
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center justify-center font-medium rounded-lg px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <input
                          ref={huellaInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleHuellaUpload}
                          disabled={isUploadingHuella}
                        />
                        {isUploadingHuella ? (
                          'Subiendo...'
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            {selectedCompany.huellaDigitalBase64 ? 'Cambiar Huella' : 'Subir Huella'}
                          </>
                        )}
                      </label>
                      {selectedCompany.huellaDigitalBase64 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleDeleteHuella}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG hasta 2MB</p>
                  </div>
                </div>
              </div>

              {/* Info adicional */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Nota:</strong> La firma y huella digital configuradas aquí se utilizarán en los informes PDF
                  de inventario cuando se seleccionen las opciones correspondientes al generar el informe.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
