import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyAccess, isAccessError, MANAGE_ROLES, OWNER_ROLES } from '@/lib/company-access';
import { z } from 'zod';

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'VIEWER'], {
    errorMap: () => ({ message: 'Rol debe ser ADMIN, ACCOUNTANT o VIEWER' }),
  }),
});

interface RouteParams {
  params: { id: string; memberId: string };
}

// PATCH /api/companies/[id]/members/[memberId] - Cambiar rol de miembro
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId, memberId } = params;
    const access = await requireCompanyAccess(request, companyId, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    // Buscar el miembro a modificar
    const targetMember = await prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Miembro no encontrado' },
        { status: 404 }
      );
    }

    // No se puede cambiar el rol del OWNER
    if (targetMember.role === 'OWNER') {
      return NextResponse.json(
        { error: 'No se puede cambiar el rol del propietario' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateRoleSchema.parse(body);

    // Solo OWNER puede asignar/quitar rol ADMIN
    if (validatedData.role === 'ADMIN' && access.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Solo el propietario puede asignar el rol de Administrador' },
        { status: 403 }
      );
    }

    // Si el miembro actual es ADMIN y quien cambia no es OWNER, no puede modificarlo
    if (targetMember.role === 'ADMIN' && access.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Solo el propietario puede modificar administradores' },
        { status: 403 }
      );
    }

    const updatedMember = await prisma.companyMember.update({
      where: { id: memberId },
      data: { role: validatedData.role },
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

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error('Error al actualizar miembro:', error);

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

// DELETE /api/companies/[id]/members/[memberId] - Eliminar miembro
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId, memberId } = params;
    const access = await requireCompanyAccess(request, companyId, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    // Buscar el miembro a eliminar
    const targetMember = await prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Miembro no encontrado' },
        { status: 404 }
      );
    }

    // No se puede eliminar al OWNER
    if (targetMember.role === 'OWNER') {
      return NextResponse.json(
        { error: 'No se puede eliminar al propietario de la empresa' },
        { status: 403 }
      );
    }

    // Solo OWNER puede eliminar ADMIN
    if (targetMember.role === 'ADMIN' && access.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Solo el propietario puede eliminar administradores' },
        { status: 403 }
      );
    }

    await prisma.companyMember.delete({
      where: { id: memberId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error al eliminar miembro:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
