import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/feedback - Crear nuevo feedback
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { type, rating, title, description, page } = body;

    // Validar campos requeridos
    if (!type || !description) {
      return NextResponse.json(
        { error: 'Tipo y descripción son requeridos' },
        { status: 400 }
      );
    }

    // Validar tipo
    const validTypes = ['bug', 'feature', 'improvement', 'satisfaction'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de feedback inválido' },
        { status: 400 }
      );
    }

    // Validar rating si es satisfaction
    if (type === 'satisfaction' && (rating === undefined || rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'Rating debe ser entre 1 y 5 para feedback de satisfacción' },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') || undefined;

    const feedback = await prisma.userFeedback.create({
      data: {
        userId,
        type,
        rating: type === 'satisfaction' ? rating : null,
        title: title || null,
        description,
        page: page || null,
        userAgent,
        status: 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Gracias por tu feedback',
      id: feedback.id,
    });
  } catch (error) {
    console.error('Error creando feedback:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// GET /api/feedback - Obtener feedback del usuario actual
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    const whereClause = {
      userId,
      ...(status && { status }),
    };

    const feedback = await prisma.userFeedback.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        rating: true,
        title: true,
        description: true,
        status: true,
        adminResponse: true,
        createdAt: true,
      },
    });

    return NextResponse.json(feedback);
  } catch (error) {
    console.error('Error obteniendo feedback:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
