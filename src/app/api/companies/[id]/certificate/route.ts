import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, isAccessError, MANAGE_ROLES } from '@/lib/company-access';
import { prisma } from '@/lib/prisma';
import { encryptionService } from '@/lib/encryption';

const MAX_CERTIFICATE_SIZE = 50 * 1024; // 50KB máximo para certificados

// POST /api/companies/[id]/certificate - Subir certificado digital
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireCompanyAccess(request, params.id, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    const formData = await request.formData();
    const file = formData.get('certificate') as File | null;
    const password = formData.get('password') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Archivo de certificado requerido' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Contraseña del certificado requerida' },
        { status: 400 }
      );
    }

    // Validar extensión
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.pfx') && !fileName.endsWith('.p12')) {
      return NextResponse.json(
        { error: 'Solo se aceptan archivos .pfx o .p12' },
        { status: 400 }
      );
    }

    // Validar tamaño
    if (file.size > MAX_CERTIFICATE_SIZE) {
      return NextResponse.json(
        { error: 'El certificado no puede superar los 50KB' },
        { status: 400 }
      );
    }

    // Convertir a Base64 y encriptar
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const certificadoEncrypted = encryptionService.encrypt(base64);
    const passwordEncrypted = encryptionService.encrypt(password);

    // Actualizar almacenamiento
    let storageUsage = await prisma.storageUsage.findUnique({
      where: { companyId: params.id },
    });

    const oldCertificateSize = storageUsage?.certificatesSize || BigInt(0);
    const newCertificateSize = BigInt(file.size);

    if (storageUsage) {
      await prisma.storageUsage.update({
        where: { companyId: params.id },
        data: {
          certificatesSize: newCertificateSize,
        },
      });
    } else {
      await prisma.storageUsage.create({
        data: {
          companyId: params.id,
          certificatesSize: newCertificateSize,
        },
      });
    }

    // Guardar certificado en la empresa
    await prisma.company.update({
      where: { id: params.id },
      data: {
        certificadoDigital: certificadoEncrypted,
        certificadoPasswordEncrypted: passwordEncrypted,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Certificado subido correctamente',
      fileName: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error('Error al subir certificado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id]/certificate - Eliminar certificado digital
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireCompanyAccess(request, params.id, MANAGE_ROLES);
    if (isAccessError(access)) return access;

    // Actualizar almacenamiento
    await prisma.storageUsage.updateMany({
      where: { companyId: params.id },
      data: {
        certificatesSize: 0,
      },
    });

    // Eliminar certificado
    await prisma.company.update({
      where: { id: params.id },
      data: {
        certificadoDigital: null,
        certificadoPasswordEncrypted: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Certificado eliminado correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar certificado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
