'use client';

import { create } from 'zustand';

interface BrandingState {
  appName: string;
  appDescription: string;
  logoBase64: string | null;
  faviconBase64: string | null;
  isLoaded: boolean;
  setBranding: (branding: Partial<BrandingState>) => void;
  loadBranding: (force?: boolean) => Promise<void>;
}

export const useBrandingStore = create<BrandingState>()((set, get) => ({
  appName: 'Contador Virtual',
  appDescription: 'Sistema de Gestión Tributaria',
  logoBase64: null,
  faviconBase64: null,
  isLoaded: false,

  setBranding: (branding) => {
    set(branding);
  },

  loadBranding: async (force = false) => {
    if (get().isLoaded && !force) return;

    try {
      const response = await fetch('/api/branding');
      if (response.ok) {
        const data = await response.json();
        set({
          appName: data.appName || 'Contador Virtual',
          appDescription: data.appDescription || 'Sistema de Gestión Tributaria',
          logoBase64: data.logoBase64 || null,
          faviconBase64: data.faviconBase64 || null,
          isLoaded: true,
        });

        // Actualizar favicon dinámicamente
        if (data.faviconBase64) {
          updateFavicon(data.faviconBase64);
        }

        // Actualizar título de la página
        if (typeof document !== 'undefined') {
          const currentTitle = document.title;
          // Solo actualizar si el título contiene el nombre por defecto
          if (currentTitle.includes('Contador Virtual')) {
            document.title = currentTitle.replace('Contador Virtual', data.appName);
          }
        }
      }
    } catch (error) {
      console.error('Error loading branding:', error);
      set({ isLoaded: true });
    }
  },
}));

function updateFavicon(base64: string) {
  if (typeof document === 'undefined') return;

  // Buscar el link existente o crear uno nuevo
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.getElementsByTagName('head')[0].appendChild(link);
  }
  link.href = base64;
}

// Hook para inicializar el branding
export function useInitBranding() {
  const { loadBranding, isLoaded } = useBrandingStore();

  if (!isLoaded && typeof window !== 'undefined') {
    loadBranding();
  }
}
