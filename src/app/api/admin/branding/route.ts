import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/branding - Obtener configuración de branding
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser?.isSuperadmin) {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    // Buscar configuración de branding
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'app_branding' },
    });

    if (!config) {
      // Devolver valores por defecto
      return NextResponse.json({
        appName: 'Contador Virtual',
        appDescription: 'Sistema de Gestión Tributaria',
        logoBase64: null,
        faviconBase64: null,
      });
    }

    const configData = JSON.parse(config.value);

    return NextResponse.json({
      appName: configData.appName || 'Contador Virtual',
      appDescription: configData.appDescription || 'Sistema de Gestión Tributaria',
      logoBase64: configData.logoBase64 || null,
      faviconBase64: configData.faviconBase64 || null,
    });
  } catch (error) {
    console.error('Error obteniendo configuración de branding:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/branding - Actualizar configuración de branding
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser?.isSuperadmin) {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { appName, appDescription, logoBase64, faviconBase64 } = body;

    // Validaciones
    if (appName && appName.length > 100) {
      return NextResponse.json(
        { error: 'El nombre de la app no puede exceder 100 caracteres' },
        { status: 400 }
      );
    }

    if (appDescription && appDescription.length > 255) {
      return NextResponse.json(
        { error: 'La descripción no puede exceder 255 caracteres' },
        { status: 400 }
      );
    }

    // Validar tamaño de imágenes (máximo 2MB cada una)
    const maxSize = 2 * 1024 * 1024; // 2MB en bytes
    if (logoBase64 && logoBase64.length > maxSize * 1.37) { // Base64 es ~37% más grande
      return NextResponse.json(
        { error: 'El logo no puede exceder 2MB' },
        { status: 400 }
      );
    }

    if (faviconBase64 && faviconBase64.length > maxSize * 1.37) {
      return NextResponse.json(
        { error: 'El favicon no puede exceder 2MB' },
        { status: 400 }
      );
    }

    // Obtener configuración actual
    let config = await prisma.systemSetting.findUnique({
      where: { key: 'app_branding' },
    });

    let configData: Record<string, unknown> = {};

    if (config) {
      configData = JSON.parse(config.value);
    }

    // Actualizar solo los campos proporcionados
    if (appName !== undefined) {
      configData.appName = appName.trim() || 'Contador Virtual';
    }

    if (appDescription !== undefined) {
      configData.appDescription = appDescription.trim() || 'Sistema de Gestión Tributaria';
    }

    if (logoBase64 !== undefined) {
      configData.logoBase64 = logoBase64 || null;
    }

    if (faviconBase64 !== undefined) {
      configData.faviconBase64 = faviconBase64 || null;
    }

    // Guardar configuración
    console.log('Guardando branding:', { appName: configData.appName, hasLogo: !!configData.logoBase64, hasFavicon: !!configData.faviconBase64 });

    const result = await prisma.systemSetting.upsert({
      where: { key: 'app_branding' },
      update: { value: JSON.stringify(configData) },
      create: {
        key: 'app_branding',
        value: JSON.stringify(configData),
        category: 'GENERAL',
        description: 'Configuración de branding de la aplicación (nombre, logo, favicon)',
      },
    });

    console.log('Branding guardado exitosamente:', result.id);

    return NextResponse.json({
      success: true,
      message: 'Configuración de branding actualizada'
    });
  } catch (error) {
    console.error('Error actualizando configuración de branding:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
