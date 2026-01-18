/**
 * Sistema de alertas inteligentes basado en fechas
 * Compara fechas de licitaciones con la configuración de cada usuario
 * y envía notificaciones según los días de anticipación configurados
 */

import prisma from '@/lib/prisma';
import { sendAlertEmail as sendNotificationEmail } from '@/lib/notification-service';
import { getAppName } from '@/lib/branding';

interface PendingAlert {
  licitacionId: string;
  alertConfigId: string;
  nomenclatura: string;
  objetoContratacion: string;
  entidad: string;
  etapa: string;
  fechaVencimiento: Date;
  diasRestantes: number;
  userEmail: string;
  userName: string;
}

/**
 * Busca licitaciones con etapas próximas a vencer y genera alertas
 * según la configuración de cada usuario
 */
export async function checkPendingAlerts(): Promise<{
  checked: number;
  alertsGenerated: number;
  emailsSent: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let alertsGenerated = 0;
  let emailsSent = 0;

  try {
    // 1. Obtener todas las configuraciones de alerta activas tipo licitacion
    const alertConfigs = await prisma.alertConfig.findMany({
      where: {
        isActive: true,
        tipo: 'licitacion',
      },
    });

    console.log(`[AlertScheduler] Verificando ${alertConfigs.length} configuraciones de alerta`);

    // 2. Obtener usuarios para cada config
    const userIds = [...new Set(alertConfigs.map(c => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, fullName: true, plan: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // 3. Obtener licitaciones activas con etapas próximas a vencer
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar etapas que venzan en los próximos 30 días (máximo anticipación razonable)
    const maxDays = 30;
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxDays);

    const licitacionesConEtapas = await prisma.scrapedLicitacion.findMany({
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
        notificaciones: true,
      },
    });

    console.log(`[AlertScheduler] Encontradas ${licitacionesConEtapas.length} licitaciones con etapas próximas`);

    // 4. Para cada config de alerta, verificar qué licitaciones aplican
    const pendingAlerts: PendingAlert[] = [];

    for (const config of alertConfigs) {
      const user = userMap.get(config.userId);
      if (!user) continue;

      // Filtrar licitaciones según la configuración del usuario
      for (const licitacion of licitacionesConEtapas) {
        // Verificar filtros de región
        if (config.regiones.length > 0 && licitacion.region) {
          if (!config.regiones.includes(licitacion.region)) continue;
        }

        // Verificar filtros de entidad
        if (config.entidades.length > 0) {
          const entidadMatch = config.entidades.some(e =>
            licitacion.entidad.toLowerCase().includes(e.toLowerCase()) ||
            (licitacion.siglaEntidad && licitacion.siglaEntidad.toLowerCase().includes(e.toLowerCase()))
          );
          if (!entidadMatch) continue;
        }

        // Verificar filtros de monto
        if (config.montoMinimo && licitacion.valorReferencial) {
          if (Number(licitacion.valorReferencial) < Number(config.montoMinimo)) continue;
        }
        if (config.montoMaximo && licitacion.valorReferencial) {
          if (Number(licitacion.valorReferencial) > Number(config.montoMaximo)) continue;
        }

        // Verificar palabras clave en el objeto de contratación
        if (config.palabrasClave.length > 0) {
          const textoCompleto = `${licitacion.objetoContratacion} ${licitacion.nomenclatura}`.toLowerCase();
          const hayCoincidencia = config.palabrasClave.some(palabra =>
            textoCompleto.includes(palabra.toLowerCase())
          );
          if (!hayCoincidencia) continue;
        }

        // Verificar etapas que coincidan con los días de anticipación
        for (const etapa of licitacion.etapas) {
          if (!etapa.fechaFin) continue;

          const fechaVencimiento = new Date(etapa.fechaFin);
          fechaVencimiento.setHours(0, 0, 0, 0);

          const diasRestantes = Math.ceil((fechaVencimiento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          // diasAnticipacion ahora es un array: [7, 3, 1, 0] = avisar esos días específicos
          const diasArray = Array.isArray(config.diasAnticipacion)
            ? config.diasAnticipacion
            : [config.diasAnticipacion];

          // Solo alertar si hoy es uno de los días configurados
          if (diasArray.includes(diasRestantes) && diasRestantes >= 0) {
            // Verificar si ya se envió esta notificación para este día específico
            // Incluimos el día en el tipo de notificación para poder enviar múltiples alertas
            const tipoNotificacion = `vencimiento_${diasRestantes}d`;
            const yaNotificado = licitacion.notificaciones.some(n =>
              n.alertConfigId === config.id &&
              n.etapaNotificada === etapa.nombreEtapa &&
              n.tipoNotificacion === tipoNotificacion
            );

            if (!yaNotificado) {
              pendingAlerts.push({
                licitacionId: licitacion.id,
                alertConfigId: config.id,
                nomenclatura: licitacion.nomenclatura,
                objetoContratacion: licitacion.objetoContratacion,
                entidad: licitacion.entidad,
                etapa: etapa.nombreEtapa,
                fechaVencimiento,
                diasRestantes,
                userEmail: config.emailDestino || user.email,
                userName: user.fullName || user.email,
              });
            }
          }
        }
      }
    }

    console.log(`[AlertScheduler] ${pendingAlerts.length} alertas pendientes de enviar`);

    // 5. Agrupar alertas por usuario para enviar un solo email
    const alertsByUser = new Map<string, PendingAlert[]>();
    for (const alert of pendingAlerts) {
      const existing = alertsByUser.get(alert.userEmail) || [];
      existing.push(alert);
      alertsByUser.set(alert.userEmail, existing);
    }

    // 6. Enviar emails y registrar notificaciones
    for (const [email, alerts] of alertsByUser) {
      try {
        // Enviar email consolidado
        const emailSent = await sendAlertEmail(email, alerts);

        if (emailSent) {
          emailsSent++;

          // Registrar todas las notificaciones enviadas
          for (const alert of alerts) {
            // Usar tipoNotificacion con el día específico para poder enviar múltiples alertas
            const tipoNotificacion = `vencimiento_${alert.diasRestantes}d`;

            await prisma.licitacionNotificacion.create({
              data: {
                licitacionId: alert.licitacionId,
                alertConfigId: alert.alertConfigId,
                tipoNotificacion,
                etapaNotificada: alert.etapa,
              },
            });
            alertsGenerated++;

            // También crear entrada en AlertHistory para el usuario
            const tituloAlerta = alert.diasRestantes === 0
              ? `🚨 ${alert.nomenclatura} - ${alert.etapa} vence HOY`
              : alert.diasRestantes === 1
                ? `⚠️ ${alert.nomenclatura} - ${alert.etapa} vence MAÑANA`
                : `⏰ ${alert.nomenclatura} - ${alert.etapa} vence en ${alert.diasRestantes} días`;

            await prisma.alertHistory.create({
              data: {
                alertConfigId: alert.alertConfigId,
                titulo: tituloAlerta,
                contenido: `${alert.objetoContratacion}\n\nEntidad: ${alert.entidad}\nEtapa: ${alert.etapa}\nFecha: ${alert.fechaVencimiento.toLocaleDateString('es-PE')}`,
                fuente: 'SEACE',
                entidad: alert.entidad,
                isNotified: true,
                notifiedAt: new Date(),
              },
            });
          }
        }
      } catch (error) {
        console.error(`[AlertScheduler] Error enviando email a ${email}:`, error);
        errors.push(`Error enviando a ${email}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    return {
      checked: licitacionesConEtapas.length,
      alertsGenerated,
      emailsSent,
      errors,
    };

  } catch (error) {
    console.error('[AlertScheduler] Error general:', error);
    errors.push(error instanceof Error ? error.message : 'Error desconocido');
    return {
      checked: 0,
      alertsGenerated: 0,
      emailsSent: 0,
      errors,
    };
  }
}

/**
 * Envía email de alertas consolidado
 */
async function sendAlertEmail(email: string, alerts: PendingAlert[]): Promise<boolean> {
  if (alerts.length === 0) return false;

  const userName = alerts[0].userName;
  const appName = await getAppName();

  // Agrupar por urgencia
  const urgentes = alerts.filter(a => a.diasRestantes <= 1);
  const proximas = alerts.filter(a => a.diasRestantes > 1 && a.diasRestantes <= 3);
  const otras = alerts.filter(a => a.diasRestantes > 3);

  let htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a56db;">🔔 Alertas de Licitaciones</h2>
      <p>Hola ${userName},</p>
      <p>Tienes ${alerts.length} licitación(es) con fechas próximas a vencer:</p>
  `;

  if (urgentes.length > 0) {
    htmlContent += `
      <h3 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 5px;">
        🚨 URGENTE - Vencen hoy o mañana (${urgentes.length})
      </h3>
    `;
    for (const alert of urgentes) {
      htmlContent += formatAlertHtml(alert);
    }
  }

  if (proximas.length > 0) {
    htmlContent += `
      <h3 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 5px;">
        ⚠️ Próximas a vencer - 2-3 días (${proximas.length})
      </h3>
    `;
    for (const alert of proximas) {
      htmlContent += formatAlertHtml(alert);
    }
  }

  if (otras.length > 0) {
    htmlContent += `
      <h3 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 5px;">
        📅 Próximamente (${otras.length})
      </h3>
    `;
    for (const alert of otras) {
      htmlContent += formatAlertHtml(alert);
    }
  }

  htmlContent += `
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px;">
        Puedes configurar tus alertas y días de anticipación desde tu panel de usuario.
        <br>Este es un mensaje automático del Sistema de Alertas de ${appName}.
      </p>
    </div>
  `;

  try {
    // Usar sendNotificationEmail del notification-service
    // Enviamos la primera alerta como representativa del grupo
    const firstAlert = alerts[0];
    const success = await sendNotificationEmail({
      to: email,
      subject: `🔔 ${alerts.length} licitación(es) próximas a vencer`,
      title: `${alerts.length} licitaciones próximas a vencer`,
      content: htmlContent,
      fuente: 'SEACE',
      entidad: firstAlert.entidad,
    });
    return success;
  } catch (error) {
    console.error('[AlertScheduler] Error enviando email:', error);
    return false;
  }
}

function formatAlertHtml(alert: PendingAlert): string {
  const urgencyColor = alert.diasRestantes <= 1 ? '#dc2626' :
                       alert.diasRestantes <= 3 ? '#f59e0b' : '#2563eb';

  return `
    <div style="background: #f9fafb; border-left: 4px solid ${urgencyColor}; padding: 15px; margin: 10px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #111827;">
        ${alert.nomenclatura}
      </p>
      <p style="margin: 0 0 8px 0; color: #374151;">
        ${alert.objetoContratacion.substring(0, 200)}${alert.objetoContratacion.length > 200 ? '...' : ''}
      </p>
      <div style="display: flex; gap: 20px; color: #6b7280; font-size: 13px;">
        <span>🏢 ${alert.entidad}</span>
      </div>
      <div style="margin-top: 10px; padding: 8px; background: ${urgencyColor}15; border-radius: 4px;">
        <strong style="color: ${urgencyColor};">
          📌 ${alert.etapa}: ${alert.fechaVencimiento.toLocaleDateString('es-PE')}
          (${alert.diasRestantes === 0 ? 'HOY' : alert.diasRestantes === 1 ? 'MAÑANA' : `en ${alert.diasRestantes} días`})
        </strong>
      </div>
    </div>
  `;
}

/**
 * Busca licitaciones nuevas (recién scrapeadas) y notifica
 */
export async function notifyNewLicitaciones(): Promise<{
  newFound: number;
  notified: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let notified = 0;

  try {
    // Buscar licitaciones creadas en las últimas 24 horas que no hayan sido notificadas como "nueva"
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const nuevasLicitaciones = await prisma.scrapedLicitacion.findMany({
      where: {
        scrapedAt: { gte: yesterday },
        estado: 'ACTIVO',
        notificaciones: {
          none: {
            tipoNotificacion: 'nueva',
          },
        },
      },
      include: {
        etapas: true,
      },
    });

    console.log(`[AlertScheduler] ${nuevasLicitaciones.length} licitaciones nuevas para notificar`);

    if (nuevasLicitaciones.length === 0) {
      return { newFound: 0, notified: 0, errors: [] };
    }

    // Obtener configuraciones de alerta activas
    const alertConfigs = await prisma.alertConfig.findMany({
      where: {
        isActive: true,
        tipo: 'licitacion',
      },
    });

    // Obtener usuarios
    const userIds = [...new Set(alertConfigs.map(c => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, fullName: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // Notificar cada licitación nueva a los usuarios que coincidan
    for (const licitacion of nuevasLicitaciones) {
      for (const config of alertConfigs) {
        const user = userMap.get(config.userId);
        if (!user) continue;

        // Aplicar filtros (mismo código que arriba, simplificado)
        let matches = true;

        if (config.regiones.length > 0 && licitacion.region) {
          matches = config.regiones.includes(licitacion.region);
        }

        if (matches && config.entidades.length > 0) {
          matches = config.entidades.some(e =>
            licitacion.entidad.toLowerCase().includes(e.toLowerCase())
          );
        }

        if (matches && config.palabrasClave.length > 0) {
          const texto = `${licitacion.objetoContratacion} ${licitacion.nomenclatura}`.toLowerCase();
          matches = config.palabrasClave.some(p => texto.includes(p.toLowerCase()));
        }

        if (matches) {
          // Crear alerta en historial
          await prisma.alertHistory.create({
            data: {
              alertConfigId: config.id,
              titulo: `🆕 Nueva licitación: ${licitacion.nomenclatura}`,
              contenido: `${licitacion.objetoContratacion}\n\nEntidad: ${licitacion.entidad}`,
              fuente: licitacion.fuente,
              entidad: licitacion.entidad,
              region: licitacion.region,
              monto: licitacion.valorReferencial,
              urlOrigen: licitacion.urlOrigen,
              isRead: false,
              isNotified: false,
            },
          });

          // Registrar que se notificó
          await prisma.licitacionNotificacion.create({
            data: {
              licitacionId: licitacion.id,
              alertConfigId: config.id,
              tipoNotificacion: 'nueva',
              etapaNotificada: null,
            },
          });

          notified++;
        }
      }
    }

    return {
      newFound: nuevasLicitaciones.length,
      notified,
      errors,
    };

  } catch (error) {
    console.error('[AlertScheduler] Error notificando nuevas:', error);
    errors.push(error instanceof Error ? error.message : 'Error desconocido');
    return { newFound: 0, notified: 0, errors };
  }
}

export default {
  checkPendingAlerts,
  notifyNewLicitaciones,
};
