'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calculator } from 'lucide-react';
import { useCompanyStore } from '@/store/company-store';
import Link from 'next/link';
import { getCurrentPeriodo, formatPeriodo } from '@/lib/utils';

export default function NuevaDeclaracionPage() {
  const { selectedCompany } = useCompanyStore();
  const currentPeriodo = getCurrentPeriodo();

  if (!selectedCompany) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Selecciona una empresa para crear una declaración</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/declaraciones">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nueva Declaración</h1>
          <p className="text-gray-600">Período: {formatPeriodo(currentPeriodo)}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Crear Declaración PDT 621
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              Esta funcionalidad estará disponible próximamente.
            </p>
            <p className="text-sm text-gray-400">
              Podrás calcular automáticamente el IGV y renta a pagar basándote en los
              comprobantes registrados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
