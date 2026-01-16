'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { useCompanyStore } from '@/store/company-store';
import { useBrandingStore } from '@/store/branding-store';
import { companiesApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Calculator,
  Upload,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronDown,
  Shield,
  Package,
  BadgeCheck,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/comprobantes', label: 'Comprobantes', icon: FileText },
  { href: '/declaraciones', label: 'Declaraciones', icon: Calculator },
  { href: '/facturador', label: 'Facturador', icon: FileText },
  { href: '/importar', label: 'Importar', icon: Upload },
  { href: '/inventario', label: 'Inventario', icon: Package },
  { href: '/fotochecks', label: 'Fotochecks', icon: BadgeCheck },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

const adminItems = [
  { href: '/admin', label: 'Panel Admin', icon: Shield },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuthStore();
  const { selectedCompany, companies, setSelectedCompany, setCompanies } = useCompanyStore();
  const { appName, logoBase64, loadBranding, isLoaded: brandingLoaded } = useBrandingStore();

  // Cargar branding al montar
  useEffect(() => {
    if (!brandingLoaded) {
      loadBranding();
    }
  }, [brandingLoaded, loadBranding]);

  // Cargar empresas del API al montar o cuando cambie la autenticación
  useEffect(() => {
    const loadCompanies = async () => {
      if (isAuthenticated) {
        try {
          const data = await companiesApi.list();
          setCompanies(data);
        } catch (err) {
          console.error('Error cargando empresas:', err);
        }
      }
    };

    // Solo cargar si está autenticado y no hay empresas cargadas
    if (isAuthenticated && companies.length === 0) {
      loadCompanies();
    }
  }, [isAuthenticated, companies.length, setCompanies]);

  const handleLogout = () => {
    // Eliminar cookie
    document.cookie = 'contador-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    // Limpiar localStorage
    localStorage.removeItem('contador-auth');
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <Link href="/" className="flex items-center space-x-2">
            {logoBase64 ? (
              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                <img src={logoBase64} alt={appName} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 text-white" />
              </div>
            )}
            <span className="font-semibold text-gray-900 dark:text-white">{appName}</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5 dark:text-gray-300" />
          </button>
        </div>

        {/* Company selector */}
        {companies.length > 0 && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <button
                onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-2 truncate">
                  {selectedCompany?.logoBase64 ? (
                    <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0 bg-white">
                      <img src={selectedCompany.logoBase64} alt="" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <Building2 className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {selectedCompany?.razonSocial || 'Seleccionar empresa'}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0',
                    companyDropdownOpen && 'rotate-180'
                  )}
                />
              </button>
              {companyDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-10 max-h-60 overflow-y-auto">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => {
                        setSelectedCompany(company);
                        setCompanyDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-600 dark:text-white flex items-center gap-3',
                        selectedCompany?.id === company.id && 'bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      )}
                    >
                      {company.logoBase64 ? (
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-white border border-gray-200 dark:border-gray-600">
                          <img src={company.logoBase64} alt="" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{company.razonSocial}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{company.ruc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Admin section */}
          {user?.isSuperadmin && (
            <>
              <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                <span className="px-3 text-xs font-semibold text-gray-400 uppercase">
                  Administración
                </span>
              </div>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    pathname.startsWith(item.href)
                      ? 'bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 truncate">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-200">
                  {user?.fullName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="truncate">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.fullName || user?.email || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.plan || 'FREE'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Menu className="w-5 h-5 dark:text-gray-300" />
          </button>

          <div className="flex-1 lg:hidden text-center">
            <span className="font-semibold text-gray-900 dark:text-white">{appName}</span>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedCompany ? selectedCompany.razonSocial : 'Bienvenido'}
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-4 px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
            <p>© {new Date().getFullYear()} {appName}. Todos los derechos reservados.</p>
            <p>
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
          </div>
        </footer>
      </div>
    </div>
  );
}
