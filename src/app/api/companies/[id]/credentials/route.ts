import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractTokenFromHeader } from '@/lib/jwt';
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
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar que la empresa pertenece al usuario
    const company = await prisma.company.findFirst({
      where: {
        id: params.id,
        userId: payload.sub,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }

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
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const company = await prisma.company.findFirst({
      where: {
        id: params.id,
        userId: payload.sub,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }

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
