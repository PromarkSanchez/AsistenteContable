'use client';

import { InventarioExcelProcessor } from '@/components/inventario-excel-processor';

export default function InventarioPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Inventario
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Herramientas para el control y gestión de inventarios
        </p>
      </div>

      <InventarioExcelProcessor />
    </div>
  );
}
