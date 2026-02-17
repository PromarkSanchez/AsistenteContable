import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, isAccessError, MANAGE_ROLES } from '@/lib/company-access';
import { prisma } from '@/lib/prisma';
import { encryptionService } from '@/lib/encryption';
import { z } from 'zod';

const credentialsSchema = z.object({
  usuarioSol: z.string().min(1, 'Usuario SOL requerido'),
  claveSol: z.string().min(1, 'Clave SOL requerida'),
});

// PUT /api/companies/[id]/credentials - Actualizar credenciales SUNAT
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireCompanyAccess(request, params.id, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    const body = await request.json();
    const validation = credentialsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { usuarioSol, claveSol } = validation.data;

    // Encriptar la clave SOL antes de guardar
    const claveSolEncrypted = encryptionService.encrypt(claveSol);

    await prisma.company.update({
      where: { id: params.id },
      data: {
        usuarioSol,
        claveSolEncrypted,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Credenciales actualizadas correctamente',
    });
  } catch (error) {
    console.error('Error al actualizar credenciales:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id]/credentials - Eliminar credenciales SUNAT
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireCompanyAccess(request, params.id, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    await prisma.company.update({
      where: { id: params.id },
      data: {
        usuarioSol: null,
        claveSolEncrypted: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Credenciales eliminadas correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar credenciales:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
