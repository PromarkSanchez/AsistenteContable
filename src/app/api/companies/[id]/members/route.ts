import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyAccess, isAccessError, MANAGE_ROLES } from '@/lib/company-access';
import { z } from 'zod';

const addMemberSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'VIEWER'], {
    errorMap: () => ({ message: 'Rol debe ser ADMIN, ACCOUNTANT o VIEWER' }),
  }),
});

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/members - Listar miembros
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;
    const access = await requireCompanyAccess(request, companyId, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    const members = await prisma.companyMember.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // OWNER primero
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error('Error al listar miembros:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/companies/[id]/members - Agregar miembro
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;
    const access = await requireCompanyAccess(request, companyId, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    const body = await request.json();
    const validatedData = addMemberSchema.parse(body);

    // Buscar usuario por email
    const targetUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
      select: { id: true, email: true, fullName: true, isActive: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'No se encontró un usuario con ese email. El usuario debe registrarse primero.' },
        { status: 404 }
      );
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { error: 'El usuario está desactivado' },
        { status: 400 }
      );
    }

    // Verificar si ya es miembro
    const existingMember = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'Este usuario ya es miembro de la empresa' },
        { status: 400 }
      );
    }

    // Solo OWNER puede asignar rol ADMIN
    if (validatedData.role === 'ADMIN' && access.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Solo el propietario puede asignar el rol de Administrador' },
        { status: 403 }
      );
    }

    // Crear membresía
    const member = await prisma.companyMember.create({
      data: {
        companyId,
        userId: targetUser.id,
        role: validatedData.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Error al agregar miembro:', error);

    if (error instanceof z.ZodError) {
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
