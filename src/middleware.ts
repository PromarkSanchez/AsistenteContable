import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken, extractTokenFromHeader } from '@/lib/jwt';

// Rutas públicas
const publicPaths = ['/login', '/register'];
const publicApiPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/branding',
  '/api/admin/alertas/scraper-logs', // El sessionId actúa como token de acceso
];

// Helper para eliminar cookie y redirigir a login
function redirectToLoginWithClearCookie(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  // Eliminar la cookie expirada/inválida
  response.cookies.set('contador-auth', '', {
    path: '/',
    expires: new Date(0),
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Log para debug
  console.log('Middleware - Path:', pathname);

  // Rutas públicas de páginas
  if (publicPaths.includes(pathname)) {
    // Si el usuario ya está autenticado, redirigir al dashboard
    const sessionCookie = request.cookies.get('contador-auth');
    if (sessionCookie?.value) {
      // Verificar que el token sea válido antes de redirigir
      const payload = await verifyAccessToken(sessionCookie.value);
      if (payload) {
        console.log('Middleware - Usuario autenticado intentando acceder a ruta pública, redirigiendo a dashboard');
        return NextResponse.redirect(new URL('/', request.url));
      }
      // Token inválido, permitir acceso a login y limpiar cookie
      console.log('Middleware - Token inválido, limpiando cookie');
      const response = NextResponse.next();
      response.cookies.set('contador-auth', '', {
        path: '/',
        expires: new Date(0),
      });
      return response;
    }
    console.log('Middleware - Ruta pública, permitiendo');
    return NextResponse.next();
  }

  // Rutas públicas de API
  if (publicApiPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Para rutas de API protegidas
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.sub);
    requestHeaders.set('x-user-email', payload.email);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Para páginas protegidas (dashboard, admin, etc.)
  const sessionCookie = request.cookies.get('contador-auth');
  console.log('Middleware - Cookie:', sessionCookie?.value ? 'EXISTE' : 'NO EXISTE');

  if (!sessionCookie?.value) {
    console.log('Middleware - No hay cookie, redirigiendo a login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verificar que el token de la cookie sea válido
  const payload = await verifyAccessToken(sessionCookie.value);
  if (!payload) {
    console.log('Middleware - Token expirado o inválido, redirigiendo a login');
    return redirectToLoginWithClearCookie(request);
  }

  console.log('Middleware - Token válido, permitiendo acceso');
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/comprobantes/:path*',
    '/declaraciones/:path*',
    '/facturador/:path*',
    '/importar/:path*',
    '/inventario/:path*',
    '/configuracion/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/api/:path*',
  ],
};
