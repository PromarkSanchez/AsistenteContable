'use client';

import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* Theme toggle en la esquina superior derecha */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 px-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Desarrollado por{' '}
          <a
            href="https://atiqtec.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            AtiqTec.com
          </a>
        </p>
      </footer>
    </div>
  );
}
