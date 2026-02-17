import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { createTokens, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN, parseTimeToSeconds } from '@/lib/jwt';
import { registerSchema } from '@/lib/validations';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar datos de entrada
    const validatedData = registerSchema.parse(body);

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'El email ya está registrado' },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email: validatedData.email.toLowerCase(),
        hashedPassword,
        fullName: validatedData.fullName || null,
        isActive: true,
        isVerified: false,
        isSuperadmin: false,
        plan: 'FREE',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        isVerified: true,
        isSuperadmin: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Crear tokens
    const tokens = await createTokens(user.id, user.email);

    // Crear respuesta con cookie
    const response = NextResponse.json(
      {
        user,
        ...tokens,
      },
      { status: 201 }
    );

    // Cookie de access token (httpOnly para seguridad)
    response.cookies.set('contador-auth', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: parseTimeToSeconds(JWT_EXPIRES_IN),
      path: '/',
    });

    // Cookie de refresh token (httpOnly, duración más larga)
    response.cookies.set('contador-refresh', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: parseTimeToSeconds(REFRESH_TOKEN_EXPIRES_IN),
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error en registro:', error);

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
