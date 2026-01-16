'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginSchema, type LoginInput } from '@/lib/validations';
import { authApi } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { useCompanyStore } from '@/store/company-store';
import { useBrandingStore } from '@/store/branding-store';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const login = useAuthStore((state) => state.login);
  const setCompanies = useCompanyStore((state) => state.setCompanies);
  const { appName, logoBase64, loadBranding, isLoaded } = useBrandingStore();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!isLoaded) {
      loadBranding();
    }
  }, [isLoaded, loadBranding]);

  // Cargar email guardado si existe
  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered-email');
    if (savedEmail) {
      setValue('email', savedEmail);
      setRememberMe(true);
    }
  }, [setValue]);

  const onSubmit = async (data: LoginInput) => {
    try {
      setError(null);

      // El servidor establece la cookie automáticamente
      const response = await authApi.login(data.email, data.password);

      // Guardar o eliminar email según "Recordar cuenta"
      if (rememberMe) {
        localStorage.setItem('remembered-email', data.email);
      } else {
        localStorage.removeItem('remembered-email');
      }

      // Guardar en store para uso del cliente
      login(response.user, response.accessToken, response.refreshToken);

      // Redirigir - la cookie ya está establecida por el servidor
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          {logoBase64 ? (
            <div className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-md border border-gray-100">
              <img src={logoBase64} alt={appName} className="w-full h-full object-contain p-1" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>
        <CardTitle className="text-2xl">{appName}</CardTitle>
        <p className="text-gray-500 mt-2">Ingresa a tu cuenta</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="tu@email.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="********"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Recordar cuenta
            </label>
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
          >
            Iniciar Sesión
          </Button>

          <p className="text-center text-sm text-gray-600">
            ¿No tienes cuenta?{' '}
            <Link
              href="/register"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Regístrate aquí
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
