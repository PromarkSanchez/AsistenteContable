'use client';

import FotocheckGenerator from '@/components/fotocheck-generator';

export default function FotochecksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Generador de Fotochecks
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Crea fotochecks personalizados de manera individual o masiva
        </p>
      </div>

      <FotocheckGenerator />
    </div>
  );
}
