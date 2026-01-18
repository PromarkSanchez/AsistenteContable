'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCompanyStore } from '@/store/company-store';
import { useBrandingStore } from '@/store/branding-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { comprobantesApi } from '@/lib/api-client';
import { formatCurrency, getCurrentPeriodo, formatPeriodo, REGIMEN_NOMBRES } from '@/lib/utils';
import type { ResumenComprobantes } from '@/types';
import {
  Building2,
  FileText,
  Calculator,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Receipt,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// Función para calcular fecha de vencimiento PDT según último dígito del RUC
function getVencimientoPDT(ruc: string, periodo: string): Date {
  const ultimoDigito = parseInt(ruc.slice(-1));
  const [year, month] = periodo.split('-').map(Number);

  // Mes siguiente al período
  let vencimientoMes = month + 1;
  let vencimientoYear = year;
  if (vencimientoMes > 12) {
    vencimientoMes = 1;
    vencimientoYear++;
  }

  // Cronograma SUNAT según último dígito del RUC
  const cronograma: Record<number, number> = {
    0: 12, 1: 13, 2: 14, 3: 15, 4: 16,
    5: 17, 6: 18, 7: 19, 8: 20, 9: 21,
  };

  const dia = cronograma[ultimoDigito] || 15;
  return new Date(vencimientoYear, vencimientoMes - 1, dia);
}

// Función para calcular días hasta vencimiento
function getDiasParaVencimiento(fecha: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = fecha.getTime() - hoy.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const { selectedCompany } = useCompanyStore();
  const { appName } = useBrandingStore();

  const [resumen, setResumen] = useState<ResumenComprobantes | null>(null);
  const [totalComprobantes, setTotalComprobantes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentPeriodo = getCurrentPeriodo();

  // Cargar datos del resumen
  useEffect(() => {
    if (!selectedCompany) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Cargar resumen del período actual
        const [resumenData, comprobantesData] = await Promise.all([
          comprobantesApi.getResumen(selectedCompany.id, currentPeriodo),
          comprobantesApi.list(selectedCompany.id, { periodo: currentPeriodo, limit: 1 }),
        ]);

        setResumen(resumenData);
        setTotalComprobantes(comprobantesData.total);
      } catch (err) {
        console.error('Error cargando datos del dashboard:', err);
        setError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedCompany, currentPeriodo]);

  // Si no hay empresa, mostrar mensaje para crear una
  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-6">
          <Building2 className="w-10 h-10 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
          ¡Bienvenido a {appName}!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          Para comenzar, necesitas registrar tu primera empresa. Esto te permitirá
          gestionar comprobantes, declaraciones y facturación electrónica.
        </p>
        <Link href="/configuracion">
          <Button size="lg">
            <Plus className="w-5 h-5 mr-2" />
            Crear Mi Primera Empresa
          </Button>
        </Link>
      </div>
    );
  }

  // Calcular IGV a pagar
  const igvDebito = resumen?.igvVentas || 0;
  const igvCredito = resumen?.igvCompras || 0;
  const igvAPagar = Math.max(0, igvDebito - igvCredito);
  const saldoAFavor = igvCredito > igvDebito ? igvCredito - igvDebito : 0;

  // Calcular vencimientos
  const vencimientoPDT = getVencimientoPDT(selectedCompany.ruc, currentPeriodo);
  const diasParaVencimiento = getDiasParaVencimiento(vencimientoPDT);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Período actual: {formatPeriodo(currentPeriodo)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/comprobantes">
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Ver Comprobantes
            </Button>
          </Link>
          <Link href="/declaraciones/nueva">
            <Button>
              <Calculator className="w-4 h-4 mr-2" />
              Nueva Declaración
            </Button>
          </Link>
        </div>
      </div>

      {/* Company info card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              {selectedCompany.logoBase64 ? (
                <img
                  src={selectedCompany.logoBase64}
                  alt="Logo"
                  className="w-16 h-16 rounded-lg object-contain bg-gray-50 dark:bg-gray-700"
                />
              ) : (
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedCompany.razonSocial}
                </h2>
                <p className="text-gray-500 dark:text-gray-400">RUC: {selectedCompany.ruc}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400">
                    {REGIMEN_NOMBRES[selectedCompany.regimen] || selectedCompany.regimen}
                  </span>
                  {selectedCompany.hasCredentials && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      SUNAT Configurado
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Link href="/configuracion">
              <Button variant="ghost" size="sm">
                Configurar
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stats grid - Datos reales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ventas del Mes</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {formatCurrency(resumen?.totalVentas || 0)}
                    </p>
                    {resumen && resumen.totalVentas > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center">
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                        Gravadas: {formatCurrency(resumen.ventasGravadas)}
                      </p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Compras del Mes</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {formatCurrency(resumen?.totalCompras || 0)}
                    </p>
                    {resumen && resumen.totalCompras > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center">
                        <ArrowDownRight className="w-3 h-3 mr-1" />
                        Gravadas: {formatCurrency(resumen.comprasGravadas)}
                      </p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">IGV por Pagar</p>
                    <p className={`text-lg sm:text-2xl font-bold mt-1 ${
                      igvAPagar > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`}>
                      {formatCurrency(igvAPagar)}
                    </p>
                    {saldoAFavor > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Saldo a favor: {formatCurrency(saldoAFavor)}
                      </p>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    igvAPagar > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'
                  }`}>
                    <Wallet className={`w-6 h-6 ${
                      igvAPagar > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Comprobantes</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalComprobantes}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Este período
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Panel de Cálculo IGV + Vencimientos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Panel de Cálculo IGV */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Cálculo IGV - PDT 621
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Débito Fiscal */}
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">DÉBITO FISCAL (IGV Ventas)</span>
                      <span className="text-lg font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(igvDebito)}
                      </span>
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Base Gravada:</span>
                        <span>{formatCurrency(resumen?.ventasGravadas || 0)}</span>
                      </div>
                      {(resumen?.ventasNoGravadas || 0) > 0 && (
                        <div className="flex justify-between">
                          <span>No Gravadas:</span>
                          <span>{formatCurrency(resumen?.ventasNoGravadas || 0)}</span>
                        </div>
                      )}
                      {(resumen?.exportaciones || 0) > 0 && (
                        <div className="flex justify-between">
                          <span>Exportaciones:</span>
                          <span>{formatCurrency(resumen?.exportaciones || 0)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Crédito Fiscal */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-400">CRÉDITO FISCAL (IGV Compras)</span>
                      <span className="text-lg font-bold text-blue-700 dark:text-blue-400">
                        -{formatCurrency(igvCredito)}
                      </span>
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Base Gravada:</span>
                        <span>{formatCurrency(resumen?.comprasGravadas || 0)}</span>
                      </div>
                      {(resumen?.comprasNoGravadas || 0) > 0 && (
                        <div className="flex justify-between">
                          <span>No Gravadas:</span>
                          <span>{formatCurrency(resumen?.comprasNoGravadas || 0)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resultado */}
                  <div className={`p-4 rounded-lg border-2 ${
                    igvAPagar > 0
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                      : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm font-bold ${
                        igvAPagar > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                      }`}>
                        {igvAPagar > 0 ? 'IGV A PAGAR' : 'SALDO A FAVOR'}
                      </span>
                      <span className={`text-xl font-bold ${
                        igvAPagar > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                      }`}>
                        {formatCurrency(igvAPagar > 0 ? igvAPagar : saldoAFavor)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Fórmula: Débito Fiscal - Crédito Fiscal = {formatCurrency(igvDebito)} - {formatCurrency(igvCredito)}
                    </p>
                  </div>

                  <Link href="/declaraciones/nueva">
                    <Button className="w-full">
                      <Calculator className="w-4 h-4 mr-2" />
                      Generar Declaración PDT 621
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Calendario de Vencimientos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Próximos Vencimientos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* PDT 621 */}
                  <div className={`p-4 rounded-lg border ${
                    diasParaVencimiento <= 3
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : diasParaVencimiento <= 7
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {diasParaVencimiento <= 3 ? (
                          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                        ) : diasParaVencimiento <= 7 ? (
                          <Clock className="w-5 h-5 text-yellow-500 mt-0.5" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">PDT 621 - IGV Renta</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Período: {formatPeriodo(currentPeriodo)}
                          </p>
                          {igvAPagar > 0 && (
                            <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-1">
                              A pagar: {formatCurrency(igvAPagar)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-white">
                          {vencimientoPDT.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                        <p className={`text-xs font-medium ${
                          diasParaVencimiento <= 3
                            ? 'text-red-600 dark:text-red-400'
                            : diasParaVencimiento <= 7
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-green-600 dark:text-green-400'
                        }`}>
                          {diasParaVencimiento < 0
                            ? `Vencido hace ${Math.abs(diasParaVencimiento)} días`
                            : diasParaVencimiento === 0
                              ? '¡Vence hoy!'
                              : `En ${diasParaVencimiento} días`
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Libros Electrónicos */}
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Libros Electrónicos</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Registro de Ventas y Compras
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Según cronograma SUNAT
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pago a cuenta Renta */}
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <PiggyBank className="w-5 h-5 text-purple-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Pago a Cuenta Renta</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Coeficiente: {selectedCompany.coeficienteRenta || '1.50%'}
                          </p>
                          {resumen && (
                            <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mt-1">
                              Estimado: {formatCurrency((resumen.totalVentas || 0) * 0.015)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Junto con PDT 621
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      <strong>RUC {selectedCompany.ruc}:</strong> Tu último dígito es <strong>{selectedCompany.ruc.slice(-1)}</strong>,
                      por lo que tus vencimientos son el día <strong>{vencimientoPDT.getDate()}</strong> de cada mes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <Link href="/comprobantes">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Gestionar Comprobantes</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Registra ventas y compras</p>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <Link href="/declaraciones">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <Calculator className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Declaraciones PDT 621</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Calcula y genera declaraciones</p>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <Link href="/facturador">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Facturación Electrónica</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Emite facturas y boletas</p>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
