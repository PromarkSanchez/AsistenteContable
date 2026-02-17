import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken, verifyRefreshToken, createTokens, extractTokenFromHeader, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN, parseTimeToSeconds } from '@/lib/jwt';

// Rutas públicas
const publicPaths = ['/login', '/register'];
const publicApiPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/branding',
  '/api/admin/alertas/scraper-logs',
];

// Opciones de cookies
function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

// Helper para limpiar cookies y redirigir a login
function redirectToLoginWithClearCookies(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.set('contador-auth', '', { ...cookieOptions(0) });
  response.cookies.set('contador-refresh', '', { ...cookieOptions(0) });
  return response;
}

// Helper para refrescar tokens usando el refresh token cookie
async function tryRefreshFromCookie(request: NextRequest): Promise<{ accessToken: string; refreshToken: string } | null> {
  const refreshCookie = request.cookies.get('contador-refresh');
  if (!refreshCookie?.value) return null;

  const payload = await verifyRefreshToken(refreshCookie.value);
  if (!payload) return null;

  // Crear nuevos tokens directamente (sin llamar al API para evitar loops)
  const tokens = await createTokens(payload.sub, payload.email);
  return tokens;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas de páginas
  if (publicPaths.includes(pathname)) {
    const sessionCookie = request.cookies.get('contador-auth');
    if (sessionCookie?.value) {
      const payload = await verifyAccessToken(sessionCookie.value);
      if (payload) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      // Token expirado, intentar refresh antes de mostrar login
      const tokens = await tryRefreshFromCookie(request);
      if (tokens) {
        const response = NextResponse.redirect(new URL('/', request.url));
        response.cookies.set('contador-auth', tokens.accessToken, cookieOptions(parseTimeToSeconds(JWT_EXPIRES_IN)));
        response.cookies.set('contador-refresh', tokens.refreshToken, cookieOptions(parseTimeToSeconds(REFRESH_TOKEN_EXPIRES_IN)));
        return response;
      }
      // Refresh también falló, limpiar cookies y mostrar login
      const response = NextResponse.next();
      response.cookies.set('contador-auth', '', cookieOptions(0));
      response.cookies.set('contador-refresh', '', cookieOptions(0));
      return response;
    }
    return NextResponse.next();
  }

  // Rutas públicas de API
  if (publicApiPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Para rutas de API protegidas
  if (pathname.startsWith('/api/')) {
    // Intentar Authorization header primero, luego cookie como fallback
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader);

    if (!token) {
      const sessionCookie = request.cookies.get('contador-auth');
      token = sessionCookie?.value || null;
    }

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let payload = await verifyAccessToken(token);

    // Si el token expiró, intentar refresh automático
    if (!payload) {
      const tokens = await tryRefreshFromCookie(request);
      if (tokens) {
        payload = await verifyAccessToken(tokens.accessToken);
        if (payload) {
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set('x-user-id', payload.sub);
          requestHeaders.set('x-user-email', payload.email);

          const response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          // Actualizar cookies con nuevos tokens
          response.cookies.set('contador-auth', tokens.accessToken, cookieOptions(parseTimeToSeconds(JWT_EXPIRES_IN)));
          response.cookies.set('contador-refresh', tokens.refreshToken, cookieOptions(parseTimeToSeconds(REFRESH_TOKEN_EXPIRES_IN)));
          return response;
        }
      }
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

  if (!sessionCookie?.value) {
    // No hay cookie de acceso, intentar refresh
    const tokens = await tryRefreshFromCookie(request);
    if (tokens) {
      const response = NextResponse.next();
      response.cookies.set('contador-auth', tokens.accessToken, cookieOptions(parseTimeToSeconds(JWT_EXPIRES_IN)));
      response.cookies.set('contador-refresh', tokens.refreshToken, cookieOptions(parseTimeToSeconds(REFRESH_TOKEN_EXPIRES_IN)));
      return response;
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verificar que el token de la cookie sea válido
  const payload = await verifyAccessToken(sessionCookie.value);
  if (!payload) {
    // Token expirado, intentar refresh automático
    const tokens = await tryRefreshFromCookie(request);
    if (tokens) {
      const response = NextResponse.next();
      response.cookies.set('contador-auth', tokens.accessToken, cookieOptions(parseTimeToSeconds(JWT_EXPIRES_IN)));
      response.cookies.set('contador-refresh', tokens.refreshToken, cookieOptions(parseTimeToSeconds(REFRESH_TOKEN_EXPIRES_IN)));
      return response;
    }
    return redirectToLoginWithClearCookies(request);
  }

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
    '/alertas/:path*',
    '/terceros/:path*',
    '/flujo-caja/:path*',
    '/fotochecks/:path*',
    '/renombrar-imagenes/:path*',
    '/reportes/:path*',
    '/libros/:path*',
    '/asistente/:path*',
    '/login',
    '/register',
    '/api/:path*',
  ],
};
