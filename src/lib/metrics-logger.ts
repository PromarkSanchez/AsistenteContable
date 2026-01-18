/**
 * Metrics Logger - Sistema de métricas y logging de seguridad
 */

import prisma from '@/lib/prisma';

export interface AIUsageData {
  userId: string;
  companyId?: string;
  provider: string;
  model: string;
  promptType: string;
  inputTokens: number;
  outputTokens: number;
  responseTimeMs: number;
  isSuccess: boolean;
  errorMessage?: string;
}

export interface SecurityEventData {
  userId?: string;
  ipAddress: string;
  eventType: 'login_failed' | 'rate_limit' | 'suspicious_activity' | 'token_expired' | 'unauthorized_access' | 'sql_injection_attempt' | 'xss_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata?: Record<string, unknown>;
}

// Precios por token (en USD)
const TOKEN_PRICES: Record<string, { input: number; output: number }> = {
  'claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
  'claude-3-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'claude-3-opus': { input: 0.015 / 1000, output: 0.075 / 1000 },
  'claude-3-5-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
  'gpt-3.5-turbo': { input: 0.0005 / 1000, output: 0.0015 / 1000 },
  'default': { input: 0.001 / 1000, output: 0.002 / 1000 },
};

class MetricsLogger {
  /**
   * Registra uso de IA
   */
  async logAIUsage(data: AIUsageData): Promise<void> {
    try {
      const prices = TOKEN_PRICES[data.model] || TOKEN_PRICES['default'];
      const estimatedCost = (data.inputTokens * prices.input) + (data.outputTokens * prices.output);

      await prisma.aIUsageLog.create({
        data: {
          userId: data.userId,
          companyId: data.companyId,
          provider: data.provider,
          model: data.model,
          promptType: data.promptType,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          totalTokens: data.inputTokens + data.outputTokens,
          estimatedCost,
          responseTimeMs: data.responseTimeMs,
          isSuccess: data.isSuccess,
          errorMessage: data.errorMessage,
        },
      });
    } catch (error) {
      console.error('Error logging AI usage:', error);
    }
  }

  /**
   * Registra evento de seguridad
   */
  async logSecurityEvent(data: SecurityEventData): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          userId: data.userId,
          ipAddress: data.ipAddress,
          eventType: data.eventType,
          severity: data.severity,
          description: data.description,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
        },
      });
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Registra rate limit alcanzado
   */
  async logRateLimit(
    userId: string | undefined,
    ipAddress: string,
    endpoint: string,
    method: string,
    requestCount: number,
    isBlocked: boolean,
    userAgent?: string
  ): Promise<void> {
    try {
      await prisma.rateLimitLog.create({
        data: {
          userId,
          ipAddress,
          endpoint,
          method,
          requestCount,
          windowStart: new Date(),
          isBlocked,
          userAgent,
        },
      });

      // Si está bloqueado, registrar como evento de seguridad
      if (isBlocked) {
        await this.logSecurityEvent({
          userId,
          ipAddress,
          eventType: 'rate_limit',
          severity: 'medium',
          description: `Rate limit exceeded for ${endpoint}. Request count: ${requestCount}`,
          metadata: { endpoint, method, requestCount },
        });
      }
    } catch (error) {
      console.error('Error logging rate limit:', error);
    }
  }

  /**
   * Obtiene resumen de uso de IA
   */
  async getAIUsageSummary(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
    byModel: Record<string, { requests: number; tokens: number; cost: number }>;
    successRate: number;
    avgResponseTime: number;
  }> {
    const whereClause = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(userId && { userId }),
    };

    const logs = await prisma.aIUsageLog.findMany({
      where: whereClause,
    });

    const summary = {
      totalRequests: logs.length,
      totalTokens: 0,
      totalCost: 0,
      byProvider: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      byModel: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      successRate: 0,
      avgResponseTime: 0,
    };

    let successCount = 0;
    let totalResponseTime = 0;

    for (const log of logs) {
      summary.totalTokens += log.totalTokens;
      summary.totalCost += Number(log.estimatedCost);
      totalResponseTime += log.responseTimeMs;

      if (log.isSuccess) successCount++;

      // Por proveedor
      if (!summary.byProvider[log.provider]) {
        summary.byProvider[log.provider] = { requests: 0, tokens: 0, cost: 0 };
      }
      summary.byProvider[log.provider].requests++;
      summary.byProvider[log.provider].tokens += log.totalTokens;
      summary.byProvider[log.provider].cost += Number(log.estimatedCost);

      // Por modelo
      if (!summary.byModel[log.model]) {
        summary.byModel[log.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      summary.byModel[log.model].requests++;
      summary.byModel[log.model].tokens += log.totalTokens;
      summary.byModel[log.model].cost += Number(log.estimatedCost);
    }

    summary.successRate = logs.length > 0 ? (successCount / logs.length) * 100 : 100;
    summary.avgResponseTime = logs.length > 0 ? totalResponseTime / logs.length : 0;

    return summary;
  }

  /**
   * Obtiene eventos de seguridad recientes
   */
  async getSecurityEvents(
    limit: number = 50,
    severity?: string,
    eventType?: string
  ): Promise<Array<{
    id: string;
    userId: string | null;
    ipAddress: string;
    eventType: string;
    severity: string;
    description: string;
    isResolved: boolean;
    createdAt: Date;
  }>> {
    const whereClause = {
      ...(severity && { severity }),
      ...(eventType && { eventType }),
    };

    return prisma.securityEvent.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        ipAddress: true,
        eventType: true,
        severity: true,
        description: true,
        isResolved: true,
        createdAt: true,
      },
    });
  }

  /**
   * Obtiene estadísticas de rate limiting
   */
  async getRateLimitStats(hours: number = 24): Promise<{
    totalBlocked: number;
    totalRequests: number;
    topBlockedIPs: Array<{ ipAddress: string; count: number }>;
    topBlockedEndpoints: Array<{ endpoint: string; count: number }>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const logs = await prisma.rateLimitLog.findMany({
      where: {
        createdAt: { gte: since },
      },
    });

    const ipCounts: Record<string, number> = {};
    const endpointCounts: Record<string, number> = {};
    let totalBlocked = 0;

    for (const log of logs) {
      if (log.isBlocked) {
        totalBlocked++;
        ipCounts[log.ipAddress] = (ipCounts[log.ipAddress] || 0) + 1;
        endpointCounts[log.endpoint] = (endpointCounts[log.endpoint] || 0) + 1;
      }
    }

    const topBlockedIPs = Object.entries(ipCounts)
      .map(([ipAddress, count]) => ({ ipAddress, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topBlockedEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalBlocked,
      totalRequests: logs.length,
      topBlockedIPs,
      topBlockedEndpoints,
    };
  }

  /**
   * Obtiene KPIs del dashboard de admin
   */
  async getAdminDashboardKPIs(): Promise<{
    users: {
      total: number;
      active: number;
      newToday: number;
      newThisWeek: number;
    };
    companies: {
      total: number;
      active: number;
    };
    ai: {
      totalRequests: number;
      totalCost: number;
      todayRequests: number;
      todayCost: number;
    };
    security: {
      eventsToday: number;
      unresolvedEvents: number;
      blockedIPs: number;
    };
    feedback: {
      pending: number;
      avgRating: number;
    };
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Usuarios
    const [totalUsers, activeUsers, newToday, newThisWeek] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
    ]);

    // Empresas
    const [totalCompanies] = await Promise.all([
      prisma.company.count(),
    ]);

    // IA
    const [aiTotalMonth, aiToday] = await Promise.all([
      prisma.aIUsageLog.aggregate({
        where: { createdAt: { gte: monthStart } },
        _count: true,
        _sum: { estimatedCost: true },
      }),
      prisma.aIUsageLog.aggregate({
        where: { createdAt: { gte: todayStart } },
        _count: true,
        _sum: { estimatedCost: true },
      }),
    ]);

    // Seguridad
    const [eventsToday, unresolvedEvents, rateLimitToday] = await Promise.all([
      prisma.securityEvent.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.securityEvent.count({ where: { isResolved: false } }),
      prisma.rateLimitLog.count({
        where: { createdAt: { gte: todayStart }, isBlocked: true },
      }),
    ]);

    // Feedback
    const [pendingFeedback, feedbackStats] = await Promise.all([
      prisma.userFeedback.count({ where: { status: 'pending' } }),
      prisma.userFeedback.aggregate({
        where: { rating: { not: null } },
        _avg: { rating: true },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newToday,
        newThisWeek,
      },
      companies: {
        total: totalCompanies,
        active: totalCompanies, // Todas activas por ahora
      },
      ai: {
        totalRequests: aiTotalMonth._count,
        totalCost: Number(aiTotalMonth._sum.estimatedCost || 0),
        todayRequests: aiToday._count,
        todayCost: Number(aiToday._sum.estimatedCost || 0),
      },
      security: {
        eventsToday,
        unresolvedEvents,
        blockedIPs: rateLimitToday,
      },
      feedback: {
        pending: pendingFeedback,
        avgRating: feedbackStats._avg.rating || 0,
      },
    };
  }
}

// Instancia global
export const metricsLogger = new MetricsLogger();
