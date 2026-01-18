import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const SMTP_SETTINGS_KEYS = [
  'smtp_enabled',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_password',
  'smtp_from_email',
  'smtp_from_name',
  'smtp_secure',
];

// GET /api/admin/smtp - Obtener configuración SMTP
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

    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: SMTP_SETTINGS_KEYS },
        category: 'EMAIL',
      },
    });

    // Convertir a objeto y desencriptar password
    const config: Record<string, string | boolean | number> = {};
    for (const setting of settings) {
      if (setting.key === 'smtp_password' && setting.isEncrypted && setting.value) {
        // No devolver la contraseña real, solo indicar si está configurada
        config[setting.key] = setting.value ? '********' : '';
      } else if (setting.key === 'smtp_enabled' || setting.key === 'smtp_secure') {
        config[setting.key] = setting.value === 'true';
      } else if (setting.key === 'smtp_port') {
        config[setting.key] = parseInt(setting.value) || 587;
      } else {
        config[setting.key] = setting.value;
      }
    }

    // Valores por defecto si no existen
    return NextResponse.json({
      smtp_enabled: config.smtp_enabled ?? false,
      smtp_host: config.smtp_host ?? '',
      smtp_port: config.smtp_port ?? 587,
      smtp_user: config.smtp_user ?? '',
      smtp_password: config.smtp_password ?? '',
      smtp_from_email: config.smtp_from_email ?? '',
      smtp_from_name: config.smtp_from_name ?? '',
      smtp_secure: config.smtp_secure ?? true,
      hasPassword: !!(config.smtp_password && config.smtp_password !== ''),
    });
  } catch (error) {
    console.error('Error obteniendo config SMTP:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/admin/smtp - Actualizar configuración SMTP
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

    // Validar campos requeridos si se habilita SMTP
    if (body.smtp_enabled) {
      if (!body.smtp_host || !body.smtp_port || !body.smtp_from_email) {
        return NextResponse.json(
          { error: 'Host, puerto y email de origen son requeridos' },
          { status: 400 }
        );
      }
    }

    // Guardar cada configuración
    const settingsToSave = [
      { key: 'smtp_enabled', value: String(body.smtp_enabled ?? false), isEncrypted: false },
      { key: 'smtp_host', value: body.smtp_host || '', isEncrypted: false },
      { key: 'smtp_port', value: String(body.smtp_port || 587), isEncrypted: false },
      { key: 'smtp_user', value: body.smtp_user || '', isEncrypted: false },
      { key: 'smtp_from_email', value: body.smtp_from_email || '', isEncrypted: false },
      { key: 'smtp_from_name', value: body.smtp_from_name || '', isEncrypted: false },
      { key: 'smtp_secure', value: String(body.smtp_secure ?? true), isEncrypted: false },
    ];

    // Solo actualizar password si se proporciona uno nuevo (no es ******** ni vacío)
    if (body.smtp_password && body.smtp_password !== '********') {
      const encryptedPassword = encrypt(body.smtp_password);
      settingsToSave.push({
        key: 'smtp_password',
        value: encryptedPassword,
        isEncrypted: true,
      });
    }

    // Upsert cada setting
    for (const setting of settingsToSave) {
      await prisma.systemSetting.upsert({
        where: { key: setting.key },
        update: {
          value: setting.value,
          isEncrypted: setting.isEncrypted,
          updatedAt: new Date(),
        },
        create: {
          key: setting.key,
          value: setting.value,
          category: 'EMAIL',
          description: `Configuración SMTP: ${setting.key}`,
          isEncrypted: setting.isEncrypted,
          isActive: true,
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Configuración SMTP guardada' });
  } catch (error) {
    console.error('Error guardando config SMTP:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/admin/smtp - Probar conexión SMTP
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperadmin: true, email: true },
    });

    if (!user?.isSuperadmin) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const body = await request.json();
    const { testEmail, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, smtp_from_name } = body;

    // Si se envían datos del formulario, usarlos directamente (para probar sin guardar)
    let config: Record<string, string> = {};

    if (smtp_host && smtp_port) {
      // Usar datos del formulario
      config = {
        smtp_host,
        smtp_port: String(smtp_port),
        smtp_user: smtp_user || '',
        smtp_password: smtp_password || '',
        smtp_from_email: smtp_from_email || '',
        smtp_from_name: smtp_from_name || '',
      };

      // Si no se envió contraseña, intentar obtenerla de la BD
      if (!config.smtp_password) {
        const savedPassword = await prisma.systemSetting.findUnique({
          where: { key: 'smtp_password' },
        });
        if (savedPassword?.value && savedPassword.isEncrypted) {
          config.smtp_password = decrypt(savedPassword.value);
          console.log('Usando contraseña guardada de BD');
        }
      }

      console.log('Usando datos del formulario para prueba');
    } else {
      // Obtener configuración guardada
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: { in: SMTP_SETTINGS_KEYS },
          category: 'EMAIL',
        },
      });

      for (const setting of settings) {
        if (setting.key === 'smtp_password' && setting.isEncrypted && setting.value) {
          config[setting.key] = decrypt(setting.value);
        } else {
          config[setting.key] = setting.value;
        }
      }
      console.log('Usando datos guardados en BD');
    }

    if (!config.smtp_host || !config.smtp_port) {
      return NextResponse.json(
        { error: 'Configuración SMTP incompleta. Completa host y puerto.' },
        { status: 400 }
      );
    }

    if (!config.smtp_from_email) {
      return NextResponse.json(
        { error: 'Email de origen es requerido' },
        { status: 400 }
      );
    }

    // Importar nodemailer dinámicamente
    const nodemailer = await import('nodemailer');

    const port = parseInt(config.smtp_port);
    // secure = true solo para puerto 465, false para 587 (STARTTLS)
    const isSecure = port === 465;

    console.log('SMTP Config:', {
      host: config.smtp_host,
      port,
      secure: isSecure,
      user: config.smtp_user,
      from: config.smtp_from_email,
    });

    // Configuración de transporter con manejo de diferentes puertos
    const transporterConfig = {
      host: config.smtp_host,
      port: port,
      secure: isSecure, // true para 465, false para otros puertos (STARTTLS)
      auth: config.smtp_user ? {
        user: config.smtp_user,
        pass: config.smtp_password,
      } : undefined,
      tls: {
        rejectUnauthorized: false, // Permitir certificados autofirmados
        minVersion: 'TLSv1.2' as const,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      debug: true, // Habilitar debug para más información
      logger: true,
    };

    console.log('Creando transporter SMTP con config:', {
      host: config.smtp_host,
      port,
      secure: isSecure,
      user: config.smtp_user,
      hasPassword: !!config.smtp_password,
    });

    const transporter = nodemailer.createTransport(transporterConfig);

    // Verificar conexión con timeout extendido
    console.log('Verificando conexión SMTP...');

    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: El servidor no responde después de 20 segundos. Esto puede indicar que el puerto está bloqueado por firewall.')), 20000)
    );

    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('Conexión SMTP verificada exitosamente');

    // Enviar email de prueba si se proporciona
    if (testEmail) {
      const fromAddress = config.smtp_from_name
        ? `"${config.smtp_from_name}" <${config.smtp_from_email}>`
        : config.smtp_from_email;

      console.log('Enviando email de prueba:', {
        from: fromAddress,
        to: testEmail,
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: testEmail,
        subject: 'Prueba de configuración SMTP - ContadorVirtual',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">¡Configuración exitosa!</h2>
            <p>Este es un correo de prueba enviado desde ContadorVirtual.</p>
            <p>Si recibes este mensaje, la configuración SMTP está funcionando correctamente.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">
              Este es un mensaje automático, por favor no responder.
            </p>
          </div>
        `,
      });

      console.log('Email enviado:', info.messageId, info.response);

      return NextResponse.json({
        success: true,
        message: `Conexión exitosa. Email de prueba enviado a ${testEmail}`,
        messageId: info.messageId,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Conexión SMTP verificada correctamente'
    });
  } catch (error) {
    console.error('Error probando SMTP:', error);

    let errorMessage = 'Error desconocido';
    let suggestion = '';

    if (error instanceof Error) {
      errorMessage = error.message;

      // Sugerencias basadas en el tipo de error
      if (errorMessage.includes('Timeout') || errorMessage.includes('ETIMEDOUT')) {
        suggestion = 'El servidor SMTP no responde. Posibles causas: 1) El puerto 465 puede estar bloqueado por firewall - prueba con puerto 587. 2) El servidor no permite conexiones externas. 3) Verifica que el host sea correcto. Si estás en un hosting compartido o serverless, intenta usar servicios como Gmail (smtp.gmail.com:587) o SendGrid.';
      } else if (errorMessage.includes('ECONNREFUSED')) {
        suggestion = 'Conexión rechazada. El servidor está activo pero no acepta conexiones en este puerto. Prueba: 1) Puerto 587 en lugar de 465. 2) Verifica que el servidor permita conexiones SMTP externas.';
      } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
        suggestion = 'No se encontró el servidor. Verifica que el nombre del host sea correcto (ej: smtp.gmail.com, mail.tudominio.com).';
      } else if (errorMessage.includes('auth') || errorMessage.includes('535') || errorMessage.includes('Authentication') || errorMessage.includes('Invalid login')) {
        suggestion = 'Error de autenticación. Para Gmail: usa una "Contraseña de aplicación", no tu contraseña normal. Para otros servidores: verifica usuario y contraseña.';
      } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL') || errorMessage.includes('TLS') || errorMessage.includes('self signed')) {
        suggestion = 'Error de certificado SSL/TLS. El servidor puede tener un certificado autofirmado. Si es tu propio servidor, esto es normal y debería funcionar.';
      } else if (errorMessage.includes('ECONNRESET')) {
        suggestion = 'La conexión fue reiniciada por el servidor. Prueba con un puerto diferente (587 en lugar de 465 o viceversa).';
      }
    }

    return NextResponse.json(
      {
        error: `Error de conexión: ${errorMessage}`,
        suggestion,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
