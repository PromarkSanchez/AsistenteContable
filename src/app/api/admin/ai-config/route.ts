import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { invalidateAIConfigCache, AVAILABLE_MODELS, AIProviderType } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';

const AI_SETTINGS_KEYS = [
  'ai_provider',
  'ai_model',
  'anthropic_api_key',
  'aws_region',
  'aws_access_key_id',
  'aws_secret_access_key',
  'openai_api_key',
  'openai_org_id',
  'ai_max_tokens',
  'ai_temperature',
  'ai_enabled_features',
];

// GET /api/admin/ai-config - Obtener configuración de IA
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
        key: { in: AI_SETTINGS_KEYS },
        category: 'AI',
      },
    });

    const config: Record<string, string | boolean | number | object> = {};

    for (const setting of settings) {
      // No devolver claves secretas, solo indicar si están configuradas
      const isSecretKey = setting.key.includes('api_key') ||
                          setting.key.includes('secret') ||
                          setting.key.includes('access_key');
      if (isSecretKey) {
        config[setting.key] = setting.value ? '********' : '';
        config[`has_${setting.key}`] = !!setting.value;
      } else if (setting.key === 'ai_enabled_features') {
        try {
          config[setting.key] = JSON.parse(setting.value);
        } catch {
          config[setting.key] = {};
        }
      } else if (setting.key === 'ai_max_tokens' || setting.key === 'ai_temperature') {
        config[setting.key] = parseFloat(setting.value) || (setting.key === 'ai_max_tokens' ? 2000 : 0.7);
      } else {
        config[setting.key] = setting.value;
      }
    }

    // Obtener estadísticas de uso de IA del mes actual
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const usageStats = await prisma.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: monthStart },
      },
      _count: true,
      _sum: {
        totalTokens: true,
        estimatedCost: true,
      },
    });

    // Valores por defecto
    return NextResponse.json({
      ai_provider: config.ai_provider || 'anthropic',
      ai_model: config.ai_model || 'claude-3-5-sonnet-20241022',
      ai_max_tokens: config.ai_max_tokens || 2000,
      ai_temperature: config.ai_temperature || 0.7,
      anthropic_api_key: config.anthropic_api_key || '',
      has_anthropic_api_key: config.has_anthropic_api_key || !!process.env.ANTHROPIC_API_KEY,
      aws_region: config.aws_region || 'us-east-1',
      aws_access_key_id: config.aws_access_key_id || '',
      has_aws_access_key_id: config.has_aws_access_key_id || !!process.env.AWS_ACCESS_KEY_ID,
      aws_secret_access_key: config.aws_secret_access_key || '',
      has_aws_secret_access_key: config.has_aws_secret_access_key || !!process.env.AWS_SECRET_ACCESS_KEY,
      openai_api_key: config.openai_api_key || '',
      has_openai_api_key: config.has_openai_api_key || !!process.env.OPENAI_API_KEY,
      openai_org_id: config.openai_org_id || '',
      ai_enabled_features: config.ai_enabled_features || {
        chatAssistant: true,
        autoClassification: false,
        smartSuggestions: false,
        ocrExtraction: false,
        anomalyDetection: false,
        financialSummary: false,
      },
      available_models: AVAILABLE_MODELS,
      usage: {
        totalRequests: usageStats._count || 0,
        totalTokens: usageStats._sum.totalTokens || 0,
        totalCost: Number(usageStats._sum.estimatedCost || 0),
      },
    });
  } catch (error) {
    console.error('Error obteniendo config AI:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/admin/ai-config - Actualizar configuración de IA
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

    // Validar proveedor
    const validProviders: AIProviderType[] = ['anthropic', 'bedrock', 'openai'];
    if (body.ai_provider && !validProviders.includes(body.ai_provider)) {
      return NextResponse.json({ error: 'Proveedor de IA inválido' }, { status: 400 });
    }

    // Configuraciones a guardar
    const settingsToSave: { key: string; value: string; isEncrypted: boolean }[] = [];

    // Proveedor y modelo
    if (body.ai_provider) {
      settingsToSave.push({ key: 'ai_provider', value: body.ai_provider, isEncrypted: false });
    }
    if (body.ai_model) {
      settingsToSave.push({ key: 'ai_model', value: body.ai_model, isEncrypted: false });
    }
    if (body.ai_max_tokens !== undefined) {
      settingsToSave.push({ key: 'ai_max_tokens', value: String(body.ai_max_tokens), isEncrypted: false });
    }
    if (body.ai_temperature !== undefined) {
      settingsToSave.push({ key: 'ai_temperature', value: String(body.ai_temperature), isEncrypted: false });
    }
    if (body.ai_enabled_features) {
      settingsToSave.push({
        key: 'ai_enabled_features',
        value: JSON.stringify(body.ai_enabled_features),
        isEncrypted: false,
      });
    }

    // Anthropic API key
    if (body.anthropic_api_key && body.anthropic_api_key !== '********') {
      settingsToSave.push({
        key: 'anthropic_api_key',
        value: encrypt(body.anthropic_api_key),
        isEncrypted: true,
      });
    }

    // AWS credentials
    if (body.aws_region) {
      settingsToSave.push({ key: 'aws_region', value: body.aws_region, isEncrypted: false });
    }
    if (body.aws_access_key_id && body.aws_access_key_id !== '********') {
      settingsToSave.push({
        key: 'aws_access_key_id',
        value: encrypt(body.aws_access_key_id),
        isEncrypted: true,
      });
    }
    if (body.aws_secret_access_key && body.aws_secret_access_key !== '********') {
      settingsToSave.push({
        key: 'aws_secret_access_key',
        value: encrypt(body.aws_secret_access_key),
        isEncrypted: true,
      });
    }

    // OpenAI credentials
    if (body.openai_api_key && body.openai_api_key !== '********') {
      settingsToSave.push({
        key: 'openai_api_key',
        value: encrypt(body.openai_api_key),
        isEncrypted: true,
      });
    }
    if (body.openai_org_id !== undefined) {
      settingsToSave.push({ key: 'openai_org_id', value: body.openai_org_id || '', isEncrypted: false });
    }

    // Guardar cada setting
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
          category: 'AI',
          description: `Configuración IA: ${setting.key}`,
          isEncrypted: setting.isEncrypted,
          isActive: true,
        },
      });
    }

    // Invalidar cache de configuración
    invalidateAIConfigCache();

    return NextResponse.json({ success: true, message: 'Configuración de IA guardada' });
  } catch (error) {
    console.error('Error guardando config AI:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/admin/ai-config - Probar configuración de IA
export async function POST(request: NextRequest) {
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
    const { provider, model, apiKey, awsRegion, awsAccessKeyId, awsSecretAccessKey, openaiApiKey } = body;

    const startTime = Date.now();

    // Prueba simple según el proveedor
    if (provider === 'anthropic') {
      const key = apiKey && apiKey !== '********' ? apiKey : await getStoredKey('anthropic_api_key');
      if (!key) {
        return NextResponse.json({ error: 'API key de Anthropic no configurada' }, { status: 400 });
      }

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: key });

      const response = await client.messages.create({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Di "Hola, prueba exitosa" en una línea.' }],
      });

      const responseTime = Date.now() - startTime;
      const textContent = response.content.find(c => c.type === 'text');

      return NextResponse.json({
        success: true,
        message: 'Conexión exitosa con Anthropic',
        response: textContent?.text || '',
        responseTimeMs: responseTime,
        tokens: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      });
    }

    if (provider === 'bedrock') {
      const accessKey = awsAccessKeyId && awsAccessKeyId !== '********'
        ? awsAccessKeyId
        : await getStoredKey('aws_access_key_id');
      const secretKey = awsSecretAccessKey && awsSecretAccessKey !== '********'
        ? awsSecretAccessKey
        : await getStoredKey('aws_secret_access_key');

      if (!accessKey || !secretKey) {
        return NextResponse.json({ error: 'Credenciales de AWS no configuradas' }, { status: 400 });
      }

      const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');

      const client = new BedrockRuntimeClient({
        region: awsRegion || 'us-east-1',
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
      });

      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Di "Hola, prueba exitosa" en una línea.' }],
      };

      const command = new InvokeModelCommand({
        modelId: model || 'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        message: 'Conexión exitosa con AWS Bedrock',
        response: responseBody.content?.[0]?.text || '',
        responseTimeMs: responseTime,
        tokens: {
          input: responseBody.usage?.input_tokens || 0,
          output: responseBody.usage?.output_tokens || 0,
        },
      });
    }

    if (provider === 'openai') {
      const key = openaiApiKey && openaiApiKey !== '********' ? openaiApiKey : await getStoredKey('openai_api_key');
      if (!key) {
        return NextResponse.json({ error: 'API key de OpenAI no configurada' }, { status: 400 });
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-3.5-turbo',
          max_tokens: 50,
          messages: [{ role: 'user', content: 'Di "Hola, prueba exitosa" en una línea.' }],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Error en OpenAI API');
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        message: 'Conexión exitosa con OpenAI',
        response: data.choices?.[0]?.message?.content || '',
        responseTimeMs: responseTime,
        tokens: {
          input: data.usage?.prompt_tokens || 0,
          output: data.usage?.completion_tokens || 0,
        },
      });
    }

    return NextResponse.json({ error: 'Proveedor no soportado' }, { status: 400 });
  } catch (error) {
    console.error('Error probando AI:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error de conexión',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// Helper para obtener clave guardada
async function getStoredKey(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  });

  if (!setting?.value) {
    // Intentar con variable de ambiente
    const envMap: Record<string, string | undefined> = {
      'anthropic_api_key': process.env.ANTHROPIC_API_KEY,
      'aws_access_key_id': process.env.AWS_ACCESS_KEY_ID,
      'aws_secret_access_key': process.env.AWS_SECRET_ACCESS_KEY,
      'openai_api_key': process.env.OPENAI_API_KEY,
    };
    return envMap[key] || null;
  }

  return setting.isEncrypted ? decrypt(setting.value) : setting.value;
}
