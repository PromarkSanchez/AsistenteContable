/**
 * Servicio de Notificaciones - Envío de alertas por email
 */

import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { getAppName } from '@/lib/branding';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

interface AlertNotification {
  to: string;
  subject: string;
  title: string;
  content: string;
  fuente: string;
  url?: string;
  monto?: number;
  region?: string;
  entidad?: string;
}

/**
 * Obtiene la configuración SMTP desde la base de datos
 */
async function getSmtpConfig(): Promise<EmailConfig | null> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          'smtp_enabled',
          'smtp_host',
          'smtp_port',
          'smtp_user',
          'smtp_password',
          'smtp_from_email',
          'smtp_from_name',
        ],
      },
      category: 'EMAIL',
    },
  });

  const config: Record<string, string> = {};
  for (const setting of settings) {
    if (setting.key === 'smtp_password' && setting.isEncrypted && setting.value) {
      config[setting.key] = decrypt(setting.value);
    } else {
      config[setting.key] = setting.value;
    }
  }

  // Verificar si SMTP está habilitado
  if (config.smtp_enabled !== 'true') {
    console.log('SMTP no está habilitado');
    return null;
  }

  if (!config.smtp_host || !config.smtp_port || !config.smtp_from_email) {
    console.log('Configuración SMTP incompleta');
    return null;
  }

  // Obtener nombre de la app para el fromName por defecto
  const defaultFromName = await getAppName();

  return {
    host: config.smtp_host,
    port: parseInt(config.smtp_port),
    user: config.smtp_user || '',
    password: config.smtp_password || '',
    fromEmail: config.smtp_from_email,
    fromName: config.smtp_from_name || defaultFromName,
  };
}

/**
 * Envía un email de alerta
 */
export async function sendAlertEmail(notification: AlertNotification): Promise<boolean> {
  try {
    const smtpConfig = await getSmtpConfig();
    if (!smtpConfig) {
      console.log('No hay configuración SMTP válida');
      return false;
    }

    const nodemailer = await import('nodemailer');

    const isSecure = smtpConfig.port === 465;

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: isSecure,
      auth: smtpConfig.user
        ? {
            user: smtpConfig.user,
            pass: smtpConfig.password,
          }
        : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });

    const fromAddress = smtpConfig.fromName
      ? `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`
      : smtpConfig.fromEmail;

    // Obtener nombre de la app
    const appName = await getAppName();

    // Generar HTML del email
    const html = generateAlertEmailHtml(notification, appName);

    await transporter.sendMail({
      from: fromAddress,
      to: notification.to,
      subject: notification.subject,
      html,
    });

    console.log(`Email de alerta enviado a ${notification.to}`);
    return true;
  } catch (error) {
    console.error('Error enviando email de alerta:', error);
    return false;
  }
}

/**
 * Genera el HTML para el email de alerta
 */
function generateAlertEmailHtml(notification: AlertNotification, appName: string): string {
  const fuenteColors: Record<string, string> = {
    SEACE: '#2563eb',
    OSCE: '#7c3aed',
    SUNAT: '#dc2626',
    SISTEMA: '#059669',
  };

  const fuenteColor = fuenteColors[notification.fuente] || '#6b7280';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${notification.subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background-color: #1e40af; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${appName}</h1>
          <p style="color: #93c5fd; margin: 5px 0 0;">Sistema de Alertas</p>
        </div>

        <!-- Content -->
        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Badge de fuente -->
          <div style="margin-bottom: 20px;">
            <span style="background-color: ${fuenteColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
              ${notification.fuente}
            </span>
          </div>

          <!-- Título -->
          <h2 style="color: #111827; margin: 0 0 15px; font-size: 20px;">
            ${notification.title}
          </h2>

          <!-- Contenido -->
          <div style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
            ${notification.content}
          </div>

          <!-- Detalles adicionales -->
          ${
            notification.monto || notification.region || notification.entidad
              ? `
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #374151; margin: 0 0 10px; font-size: 14px;">Detalles:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px;">
              ${notification.entidad ? `<li>Entidad: <strong>${notification.entidad}</strong></li>` : ''}
              ${notification.region ? `<li>Región: <strong>${notification.region}</strong></li>` : ''}
              ${notification.monto ? `<li>Monto: <strong>S/ ${notification.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong></li>` : ''}
            </ul>
          </div>
          `
              : ''
          }

          <!-- Botón de acción -->
          ${
            notification.url
              ? `
          <div style="text-align: center; margin: 25px 0;">
            <a href="${notification.url}" target="_blank" style="background-color: #2563eb; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
              Ver más detalles
            </a>
          </div>
          `
              : ''
          }

          <!-- Separador -->
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

          <!-- Footer -->
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            Este es un mensaje automático del sistema de alertas de ${appName}.<br>
            Para modificar tus preferencias de alertas, accede a tu cuenta.
          </p>
        </div>

        <!-- Links adicionales -->
        <div style="text-align: center; padding: 20px;">
          <a href="#" style="color: #6b7280; font-size: 12px; text-decoration: none; margin: 0 10px;">Configurar alertas</a>
          <a href="#" style="color: #6b7280; font-size: 12px; text-decoration: none; margin: 0 10px;">Cancelar suscripción</a>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Procesa y envía alertas pendientes para un usuario
 */
export async function processUserAlerts(userId: string): Promise<number> {
  try {
    // Obtener alertas pendientes de notificar
    const alertConfigs = await prisma.alertConfig.findMany({
      where: {
        userId,
        isActive: true,
        emailEnabled: true,
      },
    });

    if (alertConfigs.length === 0) {
      return 0;
    }

    const configIds = alertConfigs.map((c: { id: string }) => c.id);

    // Obtener historial no notificado
    const pendingAlerts = await prisma.alertHistory.findMany({
      where: {
        alertConfigId: { in: configIds },
        isNotified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pendingAlerts.length === 0) {
      return 0;
    }

    // Obtener información del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return 0;
    }

    let sentCount = 0;

    // Enviar notificaciones
    for (const alert of pendingAlerts) {
      const config = alertConfigs.find((c: { id: string; emailDestino?: string | null }) => c.id === alert.alertConfigId);
      const emailDestino = config?.emailDestino || user.email;

      const success = await sendAlertEmail({
        to: emailDestino,
        subject: `[${alert.fuente}] ${alert.titulo}`,
        title: alert.titulo,
        content: alert.contenido,
        fuente: alert.fuente,
        url: alert.urlOrigen || undefined,
        monto: alert.monto ? Number(alert.monto) : undefined,
        region: alert.region || undefined,
        entidad: alert.entidad || undefined,
      });

      if (success) {
        await prisma.alertHistory.update({
          where: { id: alert.id },
          data: {
            isNotified: true,
            notifiedAt: new Date(),
          },
        });
        sentCount++;
      }
    }

    return sentCount;
  } catch (error) {
    console.error('Error procesando alertas:', error);
    return 0;
  }
}

/**
 * Crea una nueva entrada en el historial de alertas
 */
export async function createAlertHistoryEntry(data: {
  alertConfigId: string;
  titulo: string;
  contenido: string;
  fuente: string;
  urlOrigen?: string;
  fechaPublicacion?: Date;
  region?: string;
  entidad?: string;
  monto?: number;
}): Promise<string> {
  const entry = await prisma.alertHistory.create({
    data: {
      alertConfigId: data.alertConfigId,
      titulo: data.titulo,
      contenido: data.contenido,
      fuente: data.fuente,
      urlOrigen: data.urlOrigen,
      fechaPublicacion: data.fechaPublicacion,
      region: data.region,
      entidad: data.entidad,
      monto: data.monto,
      isRead: false,
      isNotified: false,
    },
  });

  return entry.id;
}

/**
 * Verifica si una alerta coincide con los filtros de una configuración
 */
export function matchesAlertConfig(
  config: {
    palabrasClave: string[];
    regiones: string[];
    montoMinimo: number | null;
    montoMaximo: number | null;
    entidades: string[];
  },
  alert: {
    titulo: string;
    contenido: string;
    region?: string;
    entidad?: string;
    monto?: number;
  }
): boolean {
  // Verificar palabras clave
  if (config.palabrasClave.length > 0) {
    const texto = `${alert.titulo} ${alert.contenido}`.toLowerCase();
    const matchesPalabraClave = config.palabrasClave.some(palabra =>
      texto.includes(palabra.toLowerCase())
    );
    if (!matchesPalabraClave) {
      return false;
    }
  }

  // Verificar región
  if (config.regiones.length > 0 && alert.region) {
    if (!config.regiones.includes(alert.region.toUpperCase())) {
      return false;
    }
  }

  // Verificar entidad
  if (config.entidades.length > 0 && alert.entidad) {
    const matchesEntidad = config.entidades.some(e =>
      alert.entidad?.toLowerCase().includes(e.toLowerCase())
    );
    if (!matchesEntidad) {
      return false;
    }
  }

  // Verificar monto
  if (alert.monto !== undefined) {
    if (config.montoMinimo !== null && alert.monto < config.montoMinimo) {
      return false;
    }
    if (config.montoMaximo !== null && alert.monto > config.montoMaximo) {
      return false;
    }
  }

  return true;
}

export default {
  sendAlertEmail,
  processUserAlerts,
  createAlertHistoryEntry,
  matchesAlertConfig,
};
