import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Función para verificar si el plan del usuario tiene acceso a alertas
async function checkAlertAccess(userId: string): Promise<{ allowed: boolean; plan: string; requiredPlans: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const userPlan = user?.plan || 'FREE';

  // Obtener configuración de planes permitidos para alertas
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'alert_allowed_plans' },
  });

  // Por defecto solo PRO tiene acceso si no hay configuración
  const allowedPlans = setting?.value ? setting.value.split(',').map((p: string) => p.trim()) : ['PRO'];

  return {
    allowed: allowedPlans.includes(userPlan),
    plan: userPlan,
    requiredPlans: allowedPlans,
  };
}

// GET /api/alertas - Obtener alertas del usuario
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar acceso según plan
    const access = await checkAlertAccess(userId);
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: `El sistema de alertas está disponible para planes: ${access.requiredPlans.join(', ')}`,
          requiresUpgrade: true,
          currentPlan: access.plan,
          requiredPlans: access.requiredPlans,
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const tipo = searchParams.get('tipo');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Obtener configuraciones de alertas del usuario
    const alertConfigs = await prisma.alertConfig.findMany({
      where: {
        userId,
        ...(companyId && { companyId }),
        ...(tipo && { tipo }),
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Obtener historial de alertas recientes
    const configIds = alertConfigs.map((c: { id: string }) => c.id);
    const alertHistory = await prisma.alertHistory.findMany({
      where: {
        alertConfigId: { in: configIds },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Contar alertas no leídas
    const unreadCount = await prisma.alertHistory.count({
      where: {
        alertConfigId: { in: configIds },
        isRead: false,
      },
    });

    return NextResponse.json({
      configs: alertConfigs,
      history: alertHistory,
      unreadCount,
    });
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/alertas - Crear nueva configuración de alerta
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      companyId,
      tipo,
      nombre,
      descripcion,
      palabrasClave,
      regiones,
      montoMinimo,
      montoMaximo,
      entidades,
      emailEnabled,
      emailDestino,
      frecuencia,
      diasAnticipacion,
    } = body;

    // Validar tipo
    const tiposValidos = ['licitacion', 'sunat', 'vencimiento', 'custom'];
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de alerta inválido' }, { status: 400 });
    }

    // Validar nombre
    if (!nombre || nombre.trim().length < 3) {
      return NextResponse.json({ error: 'El nombre debe tener al menos 3 caracteres' }, { status: 400 });
    }

    // Verificar acceso según plan
    const access = await checkAlertAccess(userId);
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: `El sistema de alertas está disponible para planes: ${access.requiredPlans.join(', ')}`,
          requiresUpgrade: true,
          currentPlan: access.plan,
          requiredPlans: access.requiredPlans,
        },
        { status: 403 }
      );
    }

    // Verificar límites de alertas (hasta 999)
    const existingAlerts = await prisma.alertConfig.count({
      where: { userId, isActive: true },
    });

    const maxAlerts = 999;
    if (existingAlerts >= maxAlerts) {
      return NextResponse.json(
        { error: `Has alcanzado el límite máximo de ${maxAlerts} alertas` },
        { status: 400 }
      );
    }

    // Normalizar diasAnticipacion a array
    let diasArray: number[] = [3]; // Default
    if (Array.isArray(diasAnticipacion)) {
      diasArray = diasAnticipacion.map((d: number | string) => parseInt(String(d))).filter((d: number) => !isNaN(d) && d >= 0 && d <= 14);
    } else if (diasAnticipacion !== undefined && diasAnticipacion !== null) {
      const dia = parseInt(String(diasAnticipacion));
      if (!isNaN(dia) && dia >= 0 && dia <= 14) {
        diasArray = [dia];
      }
    }
    // Limitar a máximo 4 días seleccionados
    diasArray = diasArray.slice(0, 4).sort((a, b) => b - a);

    const alertConfig = await prisma.alertConfig.create({
      data: {
        userId,
        companyId: companyId || null,
        tipo,
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        palabrasClave: palabrasClave || [],
        regiones: regiones || [],
        montoMinimo: montoMinimo ? parseFloat(montoMinimo) : null,
        montoMaximo: montoMaximo ? parseFloat(montoMaximo) : null,
        entidades: entidades || [],
        emailEnabled: emailEnabled !== false,
        emailDestino: emailDestino || null,
        frecuencia: frecuencia || 'diaria',
        diasAnticipacion: diasArray,
        isActive: true,
      },
    });

    return NextResponse.json(alertConfig);
  } catch (error) {
    console.error('Error creando alerta:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/alertas - Actualizar configuración de alerta
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar acceso según plan
    const access = await checkAlertAccess(userId);
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: `El sistema de alertas está disponible para planes: ${access.requiredPlans.join(', ')}`,
          requiresUpgrade: true,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de alerta requerido' }, { status: 400 });
    }

    // Verificar que la alerta pertenece al usuario
    const existing = await prisma.alertConfig.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 });
    }

    // Preparar datos de actualización
    const data: Record<string, unknown> = {};

    if (updateData.nombre !== undefined) data.nombre = updateData.nombre.trim();
    if (updateData.descripcion !== undefined) data.descripcion = updateData.descripcion?.trim() || null;
    if (updateData.palabrasClave !== undefined) data.palabrasClave = updateData.palabrasClave;
    if (updateData.regiones !== undefined) data.regiones = updateData.regiones;
    if (updateData.montoMinimo !== undefined) data.montoMinimo = updateData.montoMinimo ? parseFloat(updateData.montoMinimo) : null;
    if (updateData.montoMaximo !== undefined) data.montoMaximo = updateData.montoMaximo ? parseFloat(updateData.montoMaximo) : null;
    if (updateData.entidades !== undefined) data.entidades = updateData.entidades;
    if (updateData.emailEnabled !== undefined) data.emailEnabled = updateData.emailEnabled;
    if (updateData.emailDestino !== undefined) data.emailDestino = updateData.emailDestino || null;
    if (updateData.frecuencia !== undefined) data.frecuencia = updateData.frecuencia;
    if (updateData.diasAnticipacion !== undefined) {
      // Normalizar diasAnticipacion a array
      let diasArray: number[] = [];
      if (Array.isArray(updateData.diasAnticipacion)) {
        diasArray = updateData.diasAnticipacion.map((d: number | string) => parseInt(String(d))).filter((d: number) => !isNaN(d) && d >= 0 && d <= 14);
      } else {
        const dia = parseInt(String(updateData.diasAnticipacion));
        if (!isNaN(dia) && dia >= 0 && dia <= 14) {
          diasArray = [dia];
        }
      }
      data.diasAnticipacion = diasArray.slice(0, 4).sort((a, b) => b - a);
    }
    if (updateData.isActive !== undefined) data.isActive = updateData.isActive;

    const updated = await prisma.alertConfig.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error actualizando alerta:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/alertas - Eliminar configuración de alerta
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar acceso según plan
    const access = await checkAlertAccess(userId);
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: `El sistema de alertas está disponible para planes: ${access.requiredPlans.join(', ')}`,
          requiresUpgrade: true,
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de alerta requerido' }, { status: 400 });
    }

    // Verificar que la alerta pertenece al usuario
    const existing = await prisma.alertConfig.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 });
    }

    // Eliminar historial asociado primero
    await prisma.alertHistory.deleteMany({
      where: { alertConfigId: id },
    });

    // Eliminar configuración
    await prisma.alertConfig.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando alerta:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
