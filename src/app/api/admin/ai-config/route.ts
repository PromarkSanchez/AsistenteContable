import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

// GET /api/admin/ai-config - Obtener configuración de IA
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

    // Buscar o crear configuración usando SystemSetting
    let config = await prisma.systemSetting.findUnique({
      where: { key: 'ai_config' },
    });

    if (!config) {
      // Crear configuración por defecto para AWS Bedrock
      config = await prisma.systemSetting.create({
        data: {
          key: 'ai_config',
          value: JSON.stringify({
            provider: 'bedrock',
            hasAwsCredentials: false,
            hasOpenaiKey: false,
            awsRegion: 'us-east-1',
            model: 'claude-3-haiku',
            maxTokens: 2000,
            temperature: 0.7,
            enabledFeatures: {
              chatAssistant: true,
              autoClassification: false,
              smartSuggestions: false,
              ocrExtraction: false,
              anomalyDetection: false,
              financialSummary: false,
            },
          }),
          category: 'AI',
          description: 'Configuración del asistente de IA con AWS Bedrock',
        },
      });
    }

    const configData = JSON.parse(config.value);

    // Obtener estadísticas de uso si existen
    const usageConfig = await prisma.systemSetting.findUnique({
      where: { key: 'ai_usage' },
    });

    const usage = usageConfig
      ? JSON.parse(usageConfig.value)
      : { totalRequests: 0, totalTokens: 0, lastUsed: null };

    return NextResponse.json({
      provider: configData.provider || 'bedrock',
      awsAccessKeyId: '', // Nunca devolver las credenciales reales
      awsSecretAccessKey: '',
      awsRegion: configData.awsRegion || 'us-east-1',
      hasAwsCredentials: configData.hasAwsCredentials || false,
      openaiApiKey: '',
      hasOpenaiKey: configData.hasOpenaiKey || false,
      model: configData.model || 'claude-3-haiku',
      maxTokens: configData.maxTokens || 2000,
      temperature: configData.temperature || 0.7,
      enabledFeatures: configData.enabledFeatures || {
        chatAssistant: true,
        autoClassification: false,
        smartSuggestions: false,
        ocrExtraction: false,
        anomalyDetection: false,
        financialSummary: false,
      },
      usage,
    });
  } catch (error) {
    console.error('Error obteniendo configuración de IA:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/ai-config - Actualizar configuración de IA
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
    const {
      provider,
      awsAccessKeyId,
      awsSecretAccessKey,
      awsRegion,
      openaiApiKey,
      model,
      maxTokens,
      temperature,
      enabledFeatures,
    } = body;

    // Obtener configuración actual usando SystemSetting
    let config = await prisma.systemSetting.findUnique({
      where: { key: 'ai_config' },
    });

    let configData: Record<string, unknown> = {};

    if (config) {
      configData = JSON.parse(config.value);
    }

    // Actualizar proveedor
    if (provider !== undefined) {
      configData.provider = provider;
    }

    // Actualizar credenciales AWS
    if (awsAccessKeyId !== undefined && awsSecretAccessKey !== undefined) {
      if (awsAccessKeyId.trim() && awsSecretAccessKey.trim()) {
        configData.awsAccessKeyIdEncrypted = encrypt(awsAccessKeyId);
        configData.awsSecretAccessKeyEncrypted = encrypt(awsSecretAccessKey);
        configData.hasAwsCredentials = true;
      } else {
        delete configData.awsAccessKeyIdEncrypted;
        delete configData.awsSecretAccessKeyEncrypted;
        configData.hasAwsCredentials = false;
      }
    }

    if (awsRegion !== undefined) {
      configData.awsRegion = awsRegion;
    }

    // Actualizar API Key de OpenAI (mantener compatibilidad)
    if (openaiApiKey !== undefined) {
      if (openaiApiKey.trim()) {
        configData.openaiApiKeyEncrypted = encrypt(openaiApiKey);
        configData.hasOpenaiKey = true;
      } else {
        delete configData.openaiApiKeyEncrypted;
        configData.hasOpenaiKey = false;
      }
    }

    if (model !== undefined) {
      configData.model = model;
    }

    if (maxTokens !== undefined) {
      configData.maxTokens = maxTokens;
    }

    if (temperature !== undefined) {
      configData.temperature = temperature;
    }

    if (enabledFeatures !== undefined) {
      configData.enabledFeatures = enabledFeatures;
    }

    // Guardar configuración usando upsert
    await prisma.systemSetting.upsert({
      where: { key: 'ai_config' },
      update: { value: JSON.stringify(configData) },
      create: {
        key: 'ai_config',
        value: JSON.stringify(configData),
        category: 'AI',
        description: 'Configuración del asistente de IA con AWS Bedrock',
      },
    });

    return NextResponse.json({ success: true, message: 'Configuración actualizada' });
  } catch (error) {
    console.error('Error actualizando configuración de IA:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
