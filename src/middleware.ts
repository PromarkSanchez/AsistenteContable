import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken, extractTokenFromHeader } from '@/lib/jwt';

// Rutas públicas
const publicPaths = ['/login', '/register'];
const publicApiPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Log para debug
  console.log('Middleware - Path:', pathname);

  // Rutas públicas de páginas
  if (publicPaths.includes(pathname)) {
    // Si el usuario ya está autenticado, redirigir al dashboard
    const sessionCookie = request.cookies.get('contador-auth');
    if (sessionCookie?.value) {
      console.log('Middleware - Usuario autenticado intentando acceder a ruta pública, redirigiendo a dashboard');
      return NextResponse.redirect(new URL('/', request.url));
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
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.sub);
    requestHeaders.set('x-user-email', payload.email);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Para páginas protegidas (dashboard)
  const sessionCookie = request.cookies.get('contador-auth');
  console.log('Middleware - Cookie:', sessionCookie?.value ? 'EXISTE' : 'NO EXISTE');

  if (!sessionCookie?.value) {
    console.log('Middleware - Redirigiendo a login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  console.log('Middleware - Cookie válida, permitiendo acceso');
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
