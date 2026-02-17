import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyRefreshToken, createTokens, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN, parseTimeToSeconds } from '@/lib/jwt';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // Aceptar refresh token desde body O desde cookie
    let refreshTokenValue: string | null = null;

    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        const body = await request.json();
        refreshTokenValue = body.refreshToken || null;
      } catch {
        // Body vacío o inválido, intentar cookie
      }
    }

    // Fallback: leer refresh token desde cookie httpOnly
    if (!refreshTokenValue) {
      const refreshCookie = request.cookies.get('contador-refresh');
      refreshTokenValue = refreshCookie?.value || null;
    }

    if (!refreshTokenValue) {
      return NextResponse.json(
        { error: 'Token de refresco no proporcionado' },
        { status: 400 }
      );
    }

    // Verificar refresh token
    const payload = await verifyRefreshToken(refreshTokenValue);

    if (!payload) {
      return NextResponse.json(
        { error: 'Token de refresco inválido o expirado' },
        { status: 401 }
      );
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Usuario desactivado' },
        { status: 403 }
      );
    }

    // Crear nuevos tokens
    const tokens = await createTokens(user.id, user.email);

    const response = NextResponse.json(tokens);

    // Actualizar cookies httpOnly con nuevos tokens
    response.cookies.set('contador-auth', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: parseTimeToSeconds(JWT_EXPIRES_IN),
      path: '/',
    });

    response.cookies.set('contador-refresh', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: parseTimeToSeconds(REFRESH_TOKEN_EXPIRES_IN),
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error en refresh token:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
