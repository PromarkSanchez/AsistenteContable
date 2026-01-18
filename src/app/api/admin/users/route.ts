import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/users - Listar todos los usuarios
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
            { email: { contains: search, mode: 'insensitive' as const } },
            { fullName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          plan: true,
          isActive: true,
          isSuperadmin: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              companies: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    type UserSelect = {
      id: string;
      email: string;
      fullName: string | null;
      plan: string;
      isActive: boolean;
      isSuperadmin: boolean;
      createdAt: Date;
      updatedAt: Date;
      _count: { companies: number };
    };
    return NextResponse.json({
      data: users.map((u: UserSelect) => ({
        ...u,
        companiesCount: u._count.companies,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error listando usuarios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
