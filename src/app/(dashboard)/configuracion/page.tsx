'use client';

import { useState, useRef } from 'react';
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
  ClipboardList,
  Fingerprint,
  PenTool,
} from 'lucide-react';

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
