import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Contador Virtual - Sistema de Gestión Tributaria',
  description: 'Sistema de contabilidad y gestión tributaria para contribuyentes peruanos. Facturación electrónica, declaraciones PDT 621, y más.',
  keywords: ['contabilidad', 'tributaria', 'SUNAT', 'facturación electrónica', 'PDT 621', 'Perú'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
