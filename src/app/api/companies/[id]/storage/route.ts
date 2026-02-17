import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyAccess, isAccessError, READ_ROLES } from '@/lib/company-access';

interface RouteParams {
  params: { id: string };
}

// GET /api/companies/[id]/storage - Obtener uso de almacenamiento
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = params;

    const access = await requireCompanyAccess(request, companyId, READ_ROLES);
    if (isAccessError(access)) return access;

    // Obtener datos de la empresa necesarios para el cálculo
    const companyData = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        logoBase64: true,
        certificadoDigital: true,
      },
    });

    if (!companyData) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Buscar o crear registro de almacenamiento
    let storageUsage = await prisma.storageUsage.findUnique({
      where: { companyId },
    });

    // Recalcular uso actual
    const logosSize = companyData.logoBase64 ? Buffer.byteLength(companyData.logoBase64, 'utf8') : 0;
    const certificatesSize = companyData.certificadoDigital
      ? Buffer.byteLength(companyData.certificadoDigital, 'utf8')
      : 0;

    // Calcular tamaño de XMLs firmados en comprobantes
    const xmlsAggregate = await prisma.comprobante.aggregate({
      where: {
        companyId,
        xmlFirmado: { not: null },
      },
      _count: { id: true },
    });

    // Estimación: promedio de 10KB por XML firmado
    const estimatedXmlSize = xmlsAggregate._count.id * 10000;

    // Calcular tamaño de CDRs
    const cdrsAggregate = await prisma.comprobante.aggregate({
      where: {
        companyId,
        cdrBase64: { not: null },
      },
      _count: { id: true },
    });

    // Estimación: promedio de 5KB por CDR
    const estimatedCdrSize = cdrsAggregate._count.id * 5000;

    const generatedFilesSize = BigInt(estimatedXmlSize + estimatedCdrSize);
    const totalUsed = BigInt(logosSize) + BigInt(certificatesSize) + generatedFilesSize;

    // Actualizar o crear registro
    if (storageUsage) {
      storageUsage = await prisma.storageUsage.update({
        where: { companyId },
        data: {
          logosSize: BigInt(logosSize),
          certificatesSize: BigInt(certificatesSize),
          generatedFilesSize,
          lastCalculated: new Date(),
        },
      });
    } else {
      storageUsage = await prisma.storageUsage.create({
        data: {
          companyId,
          logosSize: BigInt(logosSize),
          certificatesSize: BigInt(certificatesSize),
          generatedFilesSize,
          lastCalculated: new Date(),
        },
      });
    }

    // Convertir BigInt a number para JSON
    const maxStorage = Number(storageUsage.maxStorage);
    const used = Number(totalUsed);
    const percentage = Math.round((used / maxStorage) * 100);

    return NextResponse.json({
      usage: {
        logos: Number(storageUsage.logosSize),
        certificates: Number(storageUsage.certificatesSize),
        generatedFiles: Number(storageUsage.generatedFilesSize),
        total: used,
      },
      limit: maxStorage,
      percentage,
      remaining: maxStorage - used,
      formatted: {
        used: formatBytes(used),
        limit: formatBytes(maxStorage),
        remaining: formatBytes(maxStorage - used),
      },
      breakdown: {
        logos: formatBytes(Number(storageUsage.logosSize)),
        certificates: formatBytes(Number(storageUsage.certificatesSize)),
        generatedFiles: formatBytes(Number(storageUsage.generatedFilesSize)),
      },
      lastCalculated: storageUsage.lastCalculated,
    });
  } catch (error) {
    console.error('Error obteniendo uso de almacenamiento:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * Formatea bytes a formato legible (KB, MB, GB)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
