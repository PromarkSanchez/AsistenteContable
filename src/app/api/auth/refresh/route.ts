import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyRefreshToken, createTokens } from '@/lib/jwt';
import { refreshTokenSchema } from '@/lib/validations';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar datos de entrada
    const validatedData = refreshTokenSchema.parse(body);

    // Verificar refresh token
    const payload = await verifyRefreshToken(validatedData.refreshToken);

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

    return NextResponse.json(tokens);
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
