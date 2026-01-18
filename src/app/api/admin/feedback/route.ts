import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/feedback - Listar todo el feedback
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperadmin: true },
    });

    if (!user?.isSuperadmin) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    const whereClause = {
      ...(status && { status }),
      ...(type && { type }),
    };

    const [feedback, total] = await Promise.all([
      prisma.userFeedback.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.userFeedback.count({ where: whereClause }),
    ]);

    // Obtener usuarios por separado
    type FeedbackType = { id: string; userId: string; type: string; status: string; createdAt: Date };
    type UserSelect = { id: string; email: string; fullName: string | null };

    const userIds = [...new Set(feedback.map((f: FeedbackType) => f.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, fullName: true },
    });

    const usersMap = new Map(users.map((u: UserSelect) => [u.id, u]));

    const feedbackWithUsers = feedback.map((f: FeedbackType) => ({
      ...f,
      user: usersMap.get(f.userId) || { id: f.userId, email: 'Usuario eliminado', fullName: null },
    }));

    return NextResponse.json({
      data: feedbackWithUsers,
      total,
      skip,
      limit,
    });
  } catch (error) {
    console.error('Error obteniendo feedback:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/admin/feedback - Actualizar feedback (responder)
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperadmin: true },
    });

    if (!user?.isSuperadmin) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, adminResponse } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      const validStatuses = ['pending', 'reviewing', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
      }
      updateData.status = status;
    }

    if (adminResponse !== undefined) {
      updateData.adminResponse = adminResponse;
      updateData.respondedAt = new Date();
      updateData.respondedBy = userId;
    }

    const updated = await prisma.userFeedback.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error actualizando feedback:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
