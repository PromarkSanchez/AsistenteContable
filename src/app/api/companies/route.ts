import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { companySchema } from '@/lib/validations';
import { encrypt } from '@/lib/encryption';
import { ZodError } from 'zod';
import { PLAN_LIMITS } from '@/lib/utils';

// GET /api/companies - Listar empresas del usuario (propias + compartidas)
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Buscar empresas donde el usuario es miembro (propias + compartidas)
    const companies = await prisma.company.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transformar para agregar flags y ocultar datos sensibles
    const companiesResponse = companies.map((company: typeof companies[number]) => {
      const { members, ...companyData } = company;
      return {
        ...companyData,
        myRole: members[0]?.role || null,
        hasCredentials: !!company.usuarioSol,
        hasCertificado: !!company.certificadoDigital,
        // No exponer datos sensibles
        claveSolEncrypted: undefined,
        certificadoDigital: undefined,
        certificadoPasswordEncrypted: undefined,
      };
    });

    return NextResponse.json(companiesResponse);
  } catch (error) {
    console.error('Error al listar empresas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/companies - Crear empresa
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validar datos de entrada
    const validatedData = companySchema.parse(body);

    // Obtener usuario para verificar límites del plan
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { companies: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Verificar límite de empresas según plan (solo empresas propias)
    const limit = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS] || 1;
    if (user._count.companies >= limit) {
      return NextResponse.json(
        {
          error: `Has alcanzado el límite de empresas para tu plan (${limit}). Actualiza tu plan para crear más empresas.`,
        },
        { status: 403 }
      );
    }

    // Verificar si el RUC ya existe
    const existingCompany = await prisma.company.findUnique({
      where: { ruc: validatedData.ruc },
    });

    if (existingCompany) {
      return NextResponse.json(
        { error: 'El RUC ya está registrado en el sistema' },
        { status: 400 }
      );
    }

    // Crear empresa y miembro OWNER en una transacción
    const company = await prisma.$transaction(async (tx: typeof prisma) => {
      const newCompany = await tx.company.create({
        data: {
          userId,
          ruc: validatedData.ruc,
          razonSocial: validatedData.razonSocial,
          nombreComercial: validatedData.nombreComercial || null,
          regimen: validatedData.regimen,
          tipoContribuyente: validatedData.tipoContribuyente || null,
          direccionFiscal: validatedData.direccionFiscal || null,
          ubigeo: validatedData.ubigeo || null,
          telefono: validatedData.telefono || null,
          email: validatedData.email || null,
          coeficienteRenta: validatedData.coeficienteRenta || '0.0150',
        },
      });

      // Crear miembro OWNER automáticamente
      await tx.companyMember.create({
        data: {
          companyId: newCompany.id,
          userId,
          role: 'OWNER',
        },
      });

      // Crear registro de storage
      await tx.storageUsage.create({
        data: {
          companyId: newCompany.id,
        },
      });

      return newCompany;
    });

    return NextResponse.json(
      {
        ...company,
        myRole: 'OWNER',
        hasCredentials: false,
        hasCertificado: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al crear empresa:', error);

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
