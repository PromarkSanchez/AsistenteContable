'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, Plus } from 'lucide-react';
import { useCompanyStore } from '@/store/company-store';
import Link from 'next/link';

export default function DeclaracionesPage() {
  const { selectedCompany } = useCompanyStore();

  if (!selectedCompany) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Selecciona una empresa para ver las declaraciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Declaraciones PDT 621</h1>
          <p className="text-gray-600">Gestiona tus declaraciones mensuales de IGV-Renta</p>
        </div>
        <Link href="/declaraciones/nueva">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Declaración
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Declaraciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Calculator className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay declaraciones registradas
            </h3>
            <p className="text-gray-500 mb-4">
              Crea tu primera declaración mensual PDT 621
            </p>
            <Link href="/declaraciones/nueva">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Crear Declaración
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
