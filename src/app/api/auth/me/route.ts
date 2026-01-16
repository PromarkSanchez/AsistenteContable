import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // El middleware ya verificó el token y agregó el user_id a los headers
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Buscar usuario con sus empresas
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        companies: {
          select: {
            id: true,
            ruc: true,
            razonSocial: true,
            nombreComercial: true,
            regimen: true,
            tipoContribuyente: true,
            direccionFiscal: true,
            ubigeo: true,
            telefono: true,
            email: true,
            coeficienteRenta: true,
            logoBase64: true,
            serieFactura: true,
            serieBoleta: true,
            ultimoNumeroFactura: true,
            ultimoNumeroBoleta: true,
            usuarioSol: true,
            certificadoDigital: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Transformar empresas para agregar campos calculados
    const companiesWithFlags = user.companies.map((company) => ({
      ...company,
      hasCredentials: !!company.usuarioSol,
      hasCertificado: !!company.certificadoDigital,
      // No exponer datos sensibles
      claveSolEncrypted: undefined,
      certificadoDigital: undefined,
      certificadoPassword: undefined,
    }));

    return NextResponse.json({
      ...user,
      companies: companiesWithFlags,
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fullName, email } = body;

    // Verificar si el nuevo email ya existe (si se está cambiando)
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'El email ya está en uso' },
          { status: 400 }
        );
      }
    }

    // Actualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(email && { email: email.toLowerCase() }),
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

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
