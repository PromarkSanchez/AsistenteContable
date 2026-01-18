/**
 * AI Provider - Sistema de IA configurable
 * Soporta: Anthropic Claude directo, AWS Bedrock, OpenAI
 */

import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { metricsLogger } from '@/lib/metrics-logger';

export type AIProviderType = 'anthropic' | 'bedrock' | 'openai';

export interface AIProviderConfig {
  provider: AIProviderType;
  model: string;
  apiKey?: string;
  // AWS Bedrock specific
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  // OpenAI specific
  openaiApiKey?: string;
  openaiOrgId?: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
}

// Modelos disponibles por proveedor
export const AVAILABLE_MODELS: Record<AIProviderType, { id: string; name: string; description: string }[]> = {
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Mejor balance rendimiento/costo' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Más rápido y económico' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Más potente' },
  ],
  bedrock: [
    { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', name: 'Claude 3.5 Sonnet v2 (Bedrock)', description: 'Claude en AWS' },
    { id: 'anthropic.claude-3-sonnet-20240229-v1:0', name: 'Claude 3 Sonnet (Bedrock)', description: 'Balance rendimiento/costo' },
    { id: 'anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku (Bedrock)', description: 'Rápido y económico' },
  ],
  openai: [
    { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', description: 'Modelo más avanzado de OpenAI' },
    { id: 'gpt-4', name: 'GPT-4', description: 'Modelo estable' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Económico y rápido' },
  ],
};

// Cache de configuración para evitar consultas repetidas a BD
let cachedConfig: AIProviderConfig | null = null;
let configCacheTime: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minuto

/**
 * Obtiene la configuración de IA desde la base de datos
 */
async function getAIConfig(): Promise<AIProviderConfig> {
  const now = Date.now();
  if (cachedConfig && (now - configCacheTime) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  const settings = await prisma.systemSetting.findMany({
    where: {
      category: 'AI',
      isActive: true,
    },
  });

  const config: AIProviderConfig = {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
  };

  for (const setting of settings) {
    switch (setting.key) {
      case 'ai_provider':
        config.provider = setting.value as AIProviderType;
        break;
      case 'ai_model':
        config.model = setting.value;
        break;
      case 'anthropic_api_key':
        config.apiKey = setting.isEncrypted ? decrypt(setting.value) : setting.value;
        break;
      case 'aws_region':
        config.awsRegion = setting.value;
        break;
      case 'aws_access_key_id':
        config.awsAccessKeyId = setting.isEncrypted ? decrypt(setting.value) : setting.value;
        break;
      case 'aws_secret_access_key':
        config.awsSecretAccessKey = setting.isEncrypted ? decrypt(setting.value) : setting.value;
        break;
      case 'openai_api_key':
        config.openaiApiKey = setting.isEncrypted ? decrypt(setting.value) : setting.value;
        break;
      case 'openai_org_id':
        config.openaiOrgId = setting.value;
        break;
    }
  }

  // Usar API key de ambiente si no hay configurada en BD
  if (!config.apiKey && process.env.ANTHROPIC_API_KEY) {
    config.apiKey = process.env.ANTHROPIC_API_KEY;
  }
  if (!config.awsAccessKeyId && process.env.AWS_ACCESS_KEY_ID) {
    config.awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  }
  if (!config.awsSecretAccessKey && process.env.AWS_SECRET_ACCESS_KEY) {
    config.awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  }
  if (!config.awsRegion && process.env.AWS_REGION) {
    config.awsRegion = process.env.AWS_REGION;
  }
  if (!config.openaiApiKey && process.env.OPENAI_API_KEY) {
    config.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  cachedConfig = config;
  configCacheTime = now;

  return config;
}

/**
 * Invalida el cache de configuración
 */
export function invalidateAIConfigCache(): void {
  cachedConfig = null;
  configCacheTime = 0;
}

/**
 * Cliente de Anthropic directo
 */
async function callAnthropicDirect(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens: number = 4096
): Promise<AIResponse> {
  if (!config.apiKey) {
    throw new Error('API key de Anthropic no configurada');
  }

  const client = new Anthropic({
    apiKey: config.apiKey,
  });

  const response = await client.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textContent = response.content.find(c => c.type === 'text');

  return {
    content: textContent?.text || '',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: config.model,
    provider: 'anthropic',
  };
}

/**
 * Cliente de AWS Bedrock
 */
async function callAWSBedrock(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens: number = 4096
): Promise<AIResponse> {
  if (!config.awsAccessKeyId || !config.awsSecretAccessKey) {
    throw new Error('Credenciales de AWS no configuradas');
  }

  // Importar AWS SDK dinámicamente
  const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');

  const client = new BedrockRuntimeClient({
    region: config.awsRegion || 'us-east-1',
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  });

  // Formato para modelos Claude en Bedrock
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  };

  const command = new InvokeModelCommand({
    modelId: config.model,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  return {
    content: responseBody.content?.[0]?.text || '',
    inputTokens: responseBody.usage?.input_tokens || 0,
    outputTokens: responseBody.usage?.output_tokens || 0,
    model: config.model,
    provider: 'bedrock',
  };
}

/**
 * Cliente de OpenAI
 */
async function callOpenAI(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens: number = 4096
): Promise<AIResponse> {
  if (!config.openaiApiKey) {
    throw new Error('API key de OpenAI no configurada');
  }

  // Usar fetch directo para evitar dependencia adicional
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openaiApiKey}`,
      ...(config.openaiOrgId && { 'OpenAI-Organization': config.openaiOrgId }),
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error en OpenAI API');
  }

  const data = await response.json();

  return {
    content: data.choices?.[0]?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    model: config.model,
    provider: 'openai',
  };
}

/**
 * Función principal para llamar al proveedor de IA configurado
 */
export async function callAI(
  systemPrompt: string,
  messages: AIMessage[],
  options: {
    maxTokens?: number;
    userId?: string;
    companyId?: string;
    promptType?: string;
  } = {}
): Promise<AIResponse> {
  const config = await getAIConfig();
  const startTime = Date.now();
  let response: AIResponse | null = null;
  let isSuccess = true;
  let errorMessage: string | undefined;

  try {
    switch (config.provider) {
      case 'bedrock':
        response = await callAWSBedrock(config, systemPrompt, messages, options.maxTokens);
        break;
      case 'openai':
        response = await callOpenAI(config, systemPrompt, messages, options.maxTokens);
        break;
      case 'anthropic':
      default:
        response = await callAnthropicDirect(config, systemPrompt, messages, options.maxTokens);
        break;
    }

    // Registrar métricas en caso de éxito
    const responseTimeMs = Date.now() - startTime;
    if (options.userId) {
      await metricsLogger.logAIUsage({
        userId: options.userId,
        companyId: options.companyId,
        provider: config.provider,
        model: config.model,
        promptType: options.promptType || 'general',
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        responseTimeMs,
        isSuccess,
        errorMessage,
      });
    }

    return response;
  } catch (error) {
    isSuccess = false;
    errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    // Registrar métricas en caso de error
    const responseTimeMs = Date.now() - startTime;
    if (options.userId) {
      await metricsLogger.logAIUsage({
        userId: options.userId,
        companyId: options.companyId,
        provider: config.provider,
        model: config.model,
        promptType: options.promptType || 'general',
        inputTokens: 0,
        outputTokens: 0,
        responseTimeMs,
        isSuccess,
        errorMessage,
      });
    }

    throw error;
  }
}

/**
 * Obtiene la configuración actual de IA (sin secretos)
 */
export async function getAIProviderInfo(): Promise<{
  provider: AIProviderType;
  model: string;
  hasApiKey: boolean;
  hasAwsCredentials: boolean;
  hasOpenAIKey: boolean;
}> {
  const config = await getAIConfig();
  return {
    provider: config.provider,
    model: config.model,
    hasApiKey: !!config.apiKey,
    hasAwsCredentials: !!(config.awsAccessKeyId && config.awsSecretAccessKey),
    hasOpenAIKey: !!config.openaiApiKey,
  };
}

// Exportar también la función legacy para compatibilidad
export { getAIConfig };
