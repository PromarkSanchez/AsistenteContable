import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { createTokens } from '@/lib/jwt';
import { loginSchema } from '@/lib/validations';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar datos de entrada
    const validatedData = loginSchema.parse(body);

    // Buscar usuario por email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(
      validatedData.password,
      user.hashedPassword
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Usuario desactivado. Contacte al administrador.' },
        { status: 403 }
      );
    }

    // Crear tokens
    const tokens = await createTokens(user.id, user.email);

    // Retornar usuario sin la contraseña
    const userResponse = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      isVerified: user.isVerified,
      isSuperadmin: user.isSuperadmin,
      plan: user.plan,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Crear respuesta con cookie
    const response = NextResponse.json({
      user: userResponse,
      ...tokens,
    });

    // Establecer cookie desde el servidor
    response.cookies.set('contador-auth', tokens.accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 días
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error en login:', error);

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
