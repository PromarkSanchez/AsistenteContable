'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Acciones
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: !!accessToken }),

      login: (user, accessToken, refreshToken) => {
        // Cookie de sesión (sin max-age expira al cerrar el navegador)
        document.cookie = `contador-auth=${accessToken}; path=/; SameSite=Lax`;
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        // Eliminar cookie
        document.cookie = 'contador-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
        // Limpiar sessionStorage de empresa para evitar mezcla de datos entre cuentas
        sessionStorage.removeItem('contador-company');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (isLoading) => set({ isLoading }),

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },
    }),
    {
      name: 'contador-auth',
      // Usar sessionStorage para que la sesión se elimine al cerrar el navegador
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // No hacer nada especial - el middleware maneja la autenticación
      },
    }
  )
);

// Hook para verificar autenticación
export function useIsAuthenticated() {
  return useAuthStore((state) => state.isAuthenticated);
}

// Hook para obtener el usuario actual
export function useCurrentUser() {
  return useAuthStore((state) => state.user);
}

// Hook para verificar si es admin
export function useIsAdmin() {
  return useAuthStore((state) => state.user?.isSuperadmin ?? false);
}
