'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { useBrandingStore } from '@/store/branding-store';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  Shield,
  Users,
  Building2,
  Bot,
  ArrowLeft,
  LayoutDashboard,
  Palette,
  LogOut,
  Settings2,
  Bell,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

const adminMenuItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/companies', label: 'Empresas', icon: Building2 },
  { href: '/admin/plans', label: 'Planes', icon: Settings2 },
  { href: '/admin/branding', label: 'Personalización', icon: Palette },
  { href: '/admin/ai-config', label: 'Configuración IA', icon: Bot },
  { href: '/admin/smtp', label: 'Correo SMTP', icon: Mail },
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/admin/alertas', label: 'Alertas', icon: Bell },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();
  const { appName, loadBranding, isLoaded: brandingLoaded } = useBrandingStore();

  const handleLogout = async () => {
    // Limpiar cookies httpOnly via el servidor
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continuar con logout local aunque falle
    }
    logout();
    window.location.href = '/login';
  };

  useEffect(() => {
    if (!brandingLoaded) {
      loadBranding();
    }
  }, [brandingLoaded, loadBranding]);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (!user?.isSuperadmin) {
        router.push('/');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.isSuperadmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-red-600 dark:bg-red-800 text-white">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="w-6 h-6" />
              <span className="font-semibold text-lg">Panel de Administración</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-red-100 hidden sm:block">
                {user?.email}
              </span>
              <ThemeToggle />
              <Link
                href="/"
                className="flex items-center gap-2 text-sm hover:text-red-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Volver al Dashboard</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm hover:text-red-200 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            {adminMenuItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href) && item.href !== '/admin';

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 container mx-auto p-4 lg:p-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-4 px-6">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
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
  );
}
