'use client';

import { useEffect } from 'react';
import { useBrandingStore } from '@/store/branding-store';

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { appName, appDescription, faviconBase64, loadBranding, isLoaded } = useBrandingStore();

  // Cargar branding al montar
  useEffect(() => {
    if (!isLoaded) {
      loadBranding();
    }
  }, [isLoaded, loadBranding]);

  // Actualizar título del documento
  useEffect(() => {
    if (isLoaded && typeof document !== 'undefined') {
      document.title = `${appName} - ${appDescription}`;
    }
  }, [isLoaded, appName, appDescription]);

  // Actualizar favicon
  useEffect(() => {
    if (isLoaded && faviconBase64 && typeof document !== 'undefined') {
      // Actualizar o crear el link del favicon
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.type = 'image/png';
      link.href = faviconBase64;
    }
  }, [isLoaded, faviconBase64]);

  return <>{children}</>;
}
