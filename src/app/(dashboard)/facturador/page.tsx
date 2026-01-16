'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, AlertCircle } from 'lucide-react';
import { useCompanyStore } from '@/store/company-store';

export default function FacturadorPage() {
  const { selectedCompany } = useCompanyStore();

  if (!selectedCompany) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Selecciona una empresa para emitir comprobantes</p>
      </div>
    );
  }

  const hasCredentials = selectedCompany.hasCredentials;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Facturador Electrónico</h1>
          <p className="text-gray-600">Emite facturas y boletas electrónicas</p>
        </div>
      </div>

      {!hasCredentials && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800">
                  Configura tus credenciales SUNAT
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Para emitir comprobantes electrónicos, primero configura tu Usuario y
                  Clave SOL en la sección de Configuración.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Emitir Comprobante
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">
              Módulo de facturación electrónica en desarrollo.
            </p>
            <p className="text-sm text-gray-400">
              Próximamente podrás emitir facturas y boletas electrónicas directamente a
              SUNAT.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
