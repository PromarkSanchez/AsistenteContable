import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, isAccessError, MANAGE_ROLES } from '@/lib/company-access';
import { prisma } from '@/lib/prisma';
import { encryptionService } from '@/lib/encryption';
import { z } from 'zod';

const seaceCredentialsSchema = z.object({
  usuarioSeace: z.string().min(1, 'Usuario SEACE requerido'),
  claveSeace: z.string().min(1, 'Clave SEACE requerida'),
  entidadSeace: z.string().min(1, 'Entidad requerida'),
  siglaEntidadSeace: z.string().min(1, 'Sigla de entidad requerida'),
  anioSeace: z.string().length(4, 'Año debe tener 4 dígitos'),
  seaceEnabled: z.boolean().optional().default(true),
});

const seaceUpdateSchema = z.object({
  usuarioSeace: z.string().optional(),
  claveSeace: z.string().optional(),
  entidadSeace: z.string().optional(),
  siglaEntidadSeace: z.string().optional(),
  anioSeace: z.string().optional(),
  seaceEnabled: z.boolean().optional(),
});

// GET /api/companies/[id]/seace-credentials - Obtener configuración SEACE
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireCompanyAccess(request, params.id, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: {
        usuarioSeace: true,
        claveSeaceEncrypted: true,
        entidadSeace: true,
        siglaEntidadSeace: true,
        anioSeace: true,
        seaceEnabled: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      config: {
        usuarioSeace: company.usuarioSeace || '',
        hasClaveSeace: !!company.claveSeaceEncrypted,
        entidadSeace: company.entidadSeace || '',
        siglaEntidadSeace: company.siglaEntidadSeace || '',
        anioSeace: company.anioSeace || new Date().getFullYear().toString(),
        seaceEnabled: company.seaceEnabled,
      },
    });
  } catch (error) {
    console.error('Error al obtener config SEACE:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/companies/[id]/seace-credentials - Actualizar credenciales SEACE
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireCompanyAccess(request, params.id, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    const body = await request.json();
    const validation = seaceUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { usuarioSeace, claveSeace, entidadSeace, siglaEntidadSeace, anioSeace, seaceEnabled } = validation.data;

    // Construir objeto de actualización
    const updateData: Record<string, string | boolean | null> = {};

    if (usuarioSeace !== undefined) {
      updateData.usuarioSeace = usuarioSeace;
    }

    // Solo actualizar clave si se proporciona una nueva
    if (claveSeace && claveSeace.trim()) {
      updateData.claveSeaceEncrypted = encryptionService.encrypt(claveSeace);
    }

    if (entidadSeace !== undefined) {
      updateData.entidadSeace = entidadSeace;
    }

    if (siglaEntidadSeace !== undefined) {
      updateData.siglaEntidadSeace = siglaEntidadSeace;
    }

    if (anioSeace !== undefined) {
      updateData.anioSeace = anioSeace;
    }

    if (seaceEnabled !== undefined) {
      updateData.seaceEnabled = seaceEnabled;
    }

    await prisma.company.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Configuración SEACE actualizada correctamente',
    });
  } catch (error) {
    console.error('Error al actualizar credenciales SEACE:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id]/seace-credentials - Eliminar credenciales SEACE
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
        usuarioSeace: null,
        claveSeaceEncrypted: null,
        entidadSeace: null,
        siglaEntidadSeace: null,
        anioSeace: null,
        seaceEnabled: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Credenciales SEACE eliminadas correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar credenciales SEACE:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
