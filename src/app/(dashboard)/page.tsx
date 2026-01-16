'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useCompanyStore } from '@/store/company-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, getCurrentPeriodo, formatPeriodo, REGIMEN_NOMBRES } from '@/lib/utils';
import {
  Building2,
  FileText,
  Calculator,
  TrendingUp,
  Plus,
  ArrowRight,
} from 'lucide-react';

export default function DashboardPage() {
  const { selectedCompany, companies } = useCompanyStore();
  const { user } = useAuthStore();

  // Si no hay empresa, mostrar mensaje para crear una
  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mb-6">
          <Building2 className="w-10 h-10 text-primary-600" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          ¡Bienvenido a Contador Virtual!
        </h2>
        <p className="text-gray-600 mb-6 max-w-md">
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

  const currentPeriodo = getCurrentPeriodo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
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
                  className="w-16 h-16 rounded-lg object-contain bg-gray-50"
                />
              ) : (
                <div className="w-16 h-16 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-primary-600" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedCompany.razonSocial}
                </h2>
                <p className="text-gray-500">RUC: {selectedCompany.ruc}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                    {REGIMEN_NOMBRES[selectedCompany.regimen] || selectedCompany.regimen}
                  </span>
                  {selectedCompany.hasCredentials && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
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

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Ventas del Mes</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Compras del Mes</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">IGV por Pagar</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Calculator className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Comprobantes</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">0</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
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
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Gestionar Comprobantes</h3>
                  <p className="text-sm text-gray-500">Registra ventas y compras</p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link href="/declaraciones">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Declaraciones PDT 621</h3>
                  <p className="text-sm text-gray-500">Calcula y genera declaraciones</p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link href="/facturador">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Facturación Electrónica</h3>
                  <p className="text-sm text-gray-500">Emite facturas y boletas</p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Info banner */}
      <Card className="bg-gradient-to-r from-primary-600 to-primary-700 border-0">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-white">
            <div>
              <h3 className="text-lg font-semibold">Sistema en Desarrollo</h3>
              <p className="text-primary-100 text-sm mt-1">
                Estamos migrando el sistema. Algunas funciones se habilitarán progresivamente.
              </p>
            </div>
            <Button variant="secondary" className="bg-white text-primary-700 hover:bg-primary-50">
              Ver Progreso
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
