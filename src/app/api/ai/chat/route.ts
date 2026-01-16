import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

// Mapeo de modelos a IDs de AWS Bedrock
const MODEL_IDS: Record<string, string> = {
  'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0',
  'claude-3-sonnet': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'claude-3-opus': 'anthropic.claude-3-opus-20240229-v1:0',
};

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar usuario y plan
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Verificar acceso a IA (admin o plan BASIC/PRO)
    const hasAIAccess = user.isSuperadmin || user.plan === 'BASIC' || user.plan === 'PRO';
    if (!hasAIAccess) {
      return NextResponse.json(
        { error: 'Tu plan actual no incluye acceso al asistente de IA. Actualiza a BASIC o PRO para usar esta función.' },
        { status: 403 }
      );
    }

    // Obtener configuración de IA
    const aiConfig = await prisma.systemSetting.findUnique({
      where: { key: 'ai_config' },
    });

    if (!aiConfig) {
      return NextResponse.json(
        { error: 'La IA no está configurada. Contacta al administrador.' },
        { status: 500 }
      );
    }

    const config = JSON.parse(aiConfig.value);

    // Verificar que el chat esté habilitado
    if (!config.enabledFeatures?.chatAssistant) {
      return NextResponse.json(
        { error: 'El asistente de chat está deshabilitado temporalmente.' },
        { status: 503 }
      );
    }

    // Verificar credenciales AWS
    if (!config.hasAwsCredentials || !config.awsAccessKeyIdEncrypted || !config.awsSecretAccessKeyEncrypted) {
      return NextResponse.json(
        { error: 'Las credenciales de AWS no están configuradas. Contacta al administrador.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { message, context } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'El mensaje es requerido' },
        { status: 400 }
      );
    }

    // Desencriptar credenciales
    const awsAccessKeyId = decrypt(config.awsAccessKeyIdEncrypted);
    const awsSecretAccessKey = decrypt(config.awsSecretAccessKeyEncrypted);
    const awsRegion = config.awsRegion || 'us-east-1';
    const modelId = MODEL_IDS[config.model] || MODEL_IDS['claude-3-haiku'];

    // Construir el prompt del sistema
    const systemPrompt = `Eres un asistente experto en contabilidad y tributación peruana. Tu rol es ayudar a contadores y empresarios con:

- Consultas sobre IGV (Impuesto General a las Ventas) - 18% en Perú
- Impuesto a la Renta (categorías, tasas, deducciones)
- Régimenes tributarios (NRUS, RER, MYPE, General)
- Declaraciones PDT 621 y otros formularios SUNAT
- Clasificación de comprobantes de pago
- Facturación electrónica
- Cálculos tributarios

${context?.companyName ? `Contexto de la empresa:
- Razón Social: ${context.companyName}
- RUC: ${context.ruc || 'No especificado'}
- Régimen: ${context.regimen || 'No especificado'}` : ''}

Responde de manera clara, concisa y profesional. Si no estás seguro de algo, indícalo. Siempre recomienda consultar con un contador certificado para decisiones importantes.`;

    // Llamar a AWS Bedrock
    const bedrockResponse = await callBedrock({
      awsAccessKeyId,
      awsSecretAccessKey,
      awsRegion,
      modelId,
      systemPrompt,
      userMessage: message,
      maxTokens: config.maxTokens || 2000,
      temperature: config.temperature || 0.7,
    });

    // Actualizar estadísticas de uso
    await updateUsageStats(bedrockResponse.inputTokens + bedrockResponse.outputTokens);

    return NextResponse.json({
      response: bedrockResponse.content,
      model: config.model,
    });
  } catch (error) {
    console.error('Error en chat de IA:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al procesar tu consulta: ${errorMessage}` },
      { status: 500 }
    );
  }
}

interface BedrockParams {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  temperature: number;
}

async function callBedrock(params: BedrockParams) {
  const {
    awsAccessKeyId,
    awsSecretAccessKey,
    awsRegion,
    modelId,
    systemPrompt,
    userMessage,
    maxTokens,
    temperature,
  } = params;

  // Construir el cuerpo de la solicitud para Claude
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature: temperature,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  };

  const endpoint = `https://bedrock-runtime.${awsRegion}.amazonaws.com/model/${modelId}/invoke`;
  const body = JSON.stringify(requestBody);

  // Crear firma AWS Signature Version 4
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Amz-Date': amzDate,
    'Host': `bedrock-runtime.${awsRegion}.amazonaws.com`,
  };

  // Calcular hash del payload
  const payloadHash = await sha256(body);

  // Crear canonical request
  const canonicalUri = `/model/${modelId}/invoke`;
  const canonicalQuerystring = '';
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalHeaders = `content-type:application/json\nhost:bedrock-runtime.${awsRegion}.amazonaws.com\nx-amz-date:${amzDate}\n`;

  const canonicalRequest = [
    'POST',
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // Crear string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${awsRegion}/bedrock/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  // Calcular firma
  const signingKey = await getSignatureKey(awsSecretAccessKey, dateStamp, awsRegion, 'bedrock');
  const signature = await hmacHex(signingKey, stringToSign);

  // Crear authorization header
  const authorizationHeader = `${algorithm} Credential=${awsAccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  headers['Authorization'] = authorizationHeader;

  // Hacer la solicitud
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error de Bedrock:', response.status, errorText);
    throw new Error(`Error de AWS Bedrock: ${response.status}`);
  }

  const data = await response.json();

  return {
    content: data.content?.[0]?.text || 'No se recibió respuesta',
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

// Funciones de utilidad para AWS Signature V4
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function hmacHex(key: ArrayBuffer, message: string): Promise<string> {
  const result = await hmac(key, message);
  return Array.from(new Uint8Array(result))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmac(encoder.encode('AWS4' + key).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  return kSigning;
}

async function updateUsageStats(tokens: number) {
  try {
    const usageConfig = await prisma.systemSetting.findUnique({
      where: { key: 'ai_usage' },
    });

    const currentUsage = usageConfig
      ? JSON.parse(usageConfig.value)
      : { totalRequests: 0, totalTokens: 0, lastUsed: null };

    const newUsage = {
      totalRequests: currentUsage.totalRequests + 1,
      totalTokens: currentUsage.totalTokens + tokens,
      lastUsed: new Date().toISOString(),
    };

    await prisma.systemSetting.upsert({
      where: { key: 'ai_usage' },
      update: { value: JSON.stringify(newUsage) },
      create: {
        key: 'ai_usage',
        value: JSON.stringify(newUsage),
        category: 'AI',
        description: 'Estadísticas de uso de IA',
      },
    });
  } catch (error) {
    console.error('Error actualizando estadísticas:', error);
  }
}
