import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendAlertEmail as sendNotificationEmail } from '@/lib/notification-service';
import { getAppName } from '@/lib/branding';

export const dynamic = 'force-dynamic';

interface TestAlertResult {
  success: boolean;
  message: string;
  details?: {
    configId: string;
    configName: string;
    licitacionesMatched: number;
    etapasMatched: number;
    wouldSendOn: string[];
    emailSent?: boolean;
  };
  error?: string;
}

// POST /api/alertas/test - Probar envío de alerta
export async function POST(request: NextRequest): Promise<NextResponse<TestAlertResult>> {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { alertConfigId, sendTestEmail } = body;

    if (!alertConfigId) {
      return NextResponse.json({ success: false, message: 'ID de configuración requerido' }, { status: 400 });
    }

    // Obtener configuración de alerta
    const config = await prisma.alertConfig.findFirst({
      where: { id: alertConfigId, userId },
    });

    if (!config) {
      return NextResponse.json({ success: false, message: 'Configuración no encontrada' }, { status: 404 });
    }

    // Obtener usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Usuario no encontrado' }, { status: 404 });
    }

    // Buscar licitaciones que coincidan con los filtros
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30);

    const licitaciones = await prisma.scrapedLicitacion.findMany({
      where: {
        estado: 'ACTIVO',
        etapas: {
          some: {
            fechaFin: {
              gte: today,
              lte: maxDate,
            },
          },
        },
      },
      include: {
        etapas: {
          where: {
            fechaFin: {
              gte: today,
              lte: maxDate,
            },
          },
          orderBy: { fechaFin: 'asc' },
        },
      },
    });

    // Filtrar según configuración
    let licitacionesMatched = 0;
    let etapasMatched = 0;
    const wouldSendOn: string[] = [];
    const alertDetails: Array<{
      nomenclatura: string;
      etapa: string;
      fechaVencimiento: Date;
      diasRestantes: number;
    }> = [];

    // diasAnticipacion ahora es un array
    const diasArray = Array.isArray(config.diasAnticipacion)
      ? config.diasAnticipacion
      : [config.diasAnticipacion];

    for (const licitacion of licitaciones) {
      // Verificar filtros
      if (config.regiones.length > 0 && licitacion.region) {
        if (!config.regiones.includes(licitacion.region)) continue;
      }

      if (config.entidades.length > 0) {
        const entidadMatch = config.entidades.some(e =>
          licitacion.entidad.toLowerCase().includes(e.toLowerCase()) ||
          (licitacion.siglaEntidad && licitacion.siglaEntidad.toLowerCase().includes(e.toLowerCase()))
        );
        if (!entidadMatch) continue;
      }

      if (config.montoMinimo && licitacion.valorReferencial) {
        if (Number(licitacion.valorReferencial) < Number(config.montoMinimo)) continue;
      }
      if (config.montoMaximo && licitacion.valorReferencial) {
        if (Number(licitacion.valorReferencial) > Number(config.montoMaximo)) continue;
      }

      if (config.palabrasClave.length > 0) {
        const texto = `${licitacion.objetoContratacion} ${licitacion.nomenclatura}`.toLowerCase();
        const match = config.palabrasClave.some(p => texto.includes(p.toLowerCase()));
        if (!match) continue;
      }

      licitacionesMatched++;

      // Verificar etapas
      for (const etapa of licitacion.etapas) {
        if (!etapa.fechaFin) continue;

        const fechaVencimiento = new Date(etapa.fechaFin);
        fechaVencimiento.setHours(0, 0, 0, 0);

        const diasRestantes = Math.ceil((fechaVencimiento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diasArray.includes(diasRestantes) && diasRestantes >= 0) {
          etapasMatched++;
          alertDetails.push({
            nomenclatura: licitacion.nomenclatura,
            etapa: etapa.nombreEtapa,
            fechaVencimiento,
            diasRestantes,
          });

          const fechaStr = fechaVencimiento.toLocaleDateString('es-PE');
          const dayStr = diasRestantes === 0 ? 'HOY' : diasRestantes === 1 ? 'MAÑANA' : `en ${diasRestantes} días`;
          wouldSendOn.push(`${etapa.nombreEtapa} (${fechaStr} - ${dayStr})`);
        }
      }
    }

    // Si se solicita enviar email de prueba
    let emailSent = false;
    if (sendTestEmail && alertDetails.length > 0) {
      const emailDestino = config.emailDestino || user.email;
      const userName = user.fullName || user.email;
      const appName = await getAppName();

      // Construir contenido de prueba
      let htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <strong>🧪 ESTO ES UN EMAIL DE PRUEBA</strong>
            <p style="margin: 5px 0 0 0; font-size: 14px;">Este email fue enviado para verificar que la configuración de alertas funciona correctamente.</p>
          </div>
          <h2 style="color: #1a56db;">🔔 Alertas de Licitaciones</h2>
          <p>Hola ${userName},</p>
          <p>Con tu configuración actual "<strong>${config.nombre}</strong>", recibirías alertas para:</p>
      `;

      for (const detail of alertDetails.slice(0, 5)) {
        const dayStr = detail.diasRestantes === 0 ? 'HOY' :
                       detail.diasRestantes === 1 ? 'MAÑANA' :
                       `en ${detail.diasRestantes} días`;

        htmlContent += `
          <div style="background: #f9fafb; border-left: 4px solid #2563eb; padding: 15px; margin: 10px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold;">${detail.nomenclatura}</p>
            <p style="margin: 5px 0 0 0; color: #6b7280;">
              📌 ${detail.etapa}: ${detail.fechaVencimiento.toLocaleDateString('es-PE')} (${dayStr})
            </p>
          </div>
        `;
      }

      if (alertDetails.length > 5) {
        htmlContent += `<p style="color: #6b7280;">...y ${alertDetails.length - 5} alertas más</p>`;
      }

      htmlContent += `
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            Configuración de días de anticipación: ${diasArray.map(d => d === 0 ? 'mismo día' : `${d} día(s)`).join(', ')}
            <br>Este es un mensaje de prueba del Sistema de Alertas de ${appName}.
          </p>
        </div>
      `;

      try {
        emailSent = await sendNotificationEmail({
          to: emailDestino,
          subject: `🧪 [PRUEBA] Alerta de licitaciones - ${config.nombre}`,
          title: `Prueba de alerta: ${config.nombre}`,
          content: htmlContent,
          fuente: 'SEACE',
          entidad: alertDetails[0]?.nomenclatura || 'Prueba',
        });
      } catch (error) {
        console.error('[AlertTest] Error enviando email:', error);
      }
    }

    return NextResponse.json({
      success: true,
      message: licitacionesMatched > 0
        ? `Se encontraron ${licitacionesMatched} licitaciones que coinciden con tus filtros`
        : 'No se encontraron licitaciones que coincidan con los filtros actuales',
      details: {
        configId: config.id,
        configName: config.nombre,
        licitacionesMatched,
        etapasMatched,
        wouldSendOn,
        emailSent,
      },
    });

  } catch (error) {
    console.error('[AlertTest] Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error interno',
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}
