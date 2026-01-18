import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/companies - Listar todas las empresas
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar que sea superadmin
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser?.isSuperadmin) {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const where = search
      ? {
          OR: [
            { ruc: { contains: search } },
            { razonSocial: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ruc: true,
          razonSocial: true,
          regimen: true,
          usuarioSol: true,
          claveSolEncrypted: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          _count: {
            select: {
              comprobantes: true,
              declaraciones: true,
            },
          },
        },
      }),
      prisma.company.count({ where }),
    ]);

    type CompanySelect = {
      id: string;
      ruc: string;
      razonSocial: string;
      regimen: string;
      usuarioSol: string | null;
      claveSolEncrypted: string | null;
      createdAt: Date;
      user: { id: string; email: string; fullName: string | null };
      _count: { comprobantes: number; declaraciones: number };
    };
    return NextResponse.json({
      data: companies.map((c: CompanySelect) => ({
        id: c.id,
        ruc: c.ruc,
        razonSocial: c.razonSocial,
        regimen: c.regimen,
        hasCredentials: !!(c.usuarioSol && c.claveSolEncrypted),
        createdAt: c.createdAt,
        user: c.user,
        comprobantesCount: c._count.comprobantes,
        declaracionesCount: c._count.declaraciones,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error listando empresas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
