/**
 * Rate Limiter - Protección contra abuso de API
 * Implementa rate limiting en memoria con persistencia opcional en DB
 */

interface RateLimitConfig {
  windowMs: number;      // Ventana de tiempo en ms
  maxRequests: number;   // Máximo de solicitudes por ventana
  blockDurationMs?: number; // Duración del bloqueo si se excede
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  isBlocked: boolean;
  blockedUntil?: number;
}

// Configuraciones por tipo de endpoint
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Autenticación - muy restrictivo
  'auth': {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 10,
    blockDurationMs: 30 * 60 * 1000, // 30 minutos de bloqueo
  },
  // API general
  'api': {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 100,
    blockDurationMs: 5 * 60 * 1000, // 5 minutos de bloqueo
  },
  // AI/Chat - más restrictivo por costo
  'ai': {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 20,
    blockDurationMs: 10 * 60 * 1000, // 10 minutos de bloqueo
  },
  // Importación de archivos
  'import': {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 30,
    blockDurationMs: 5 * 60 * 1000,
  },
  // Admin endpoints
  'admin': {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 60,
  },
};

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpiar entradas expiradas cada 5 minutos
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * Genera una clave única para el rate limit
   */
  private getKey(identifier: string, endpoint: string): string {
    return `${identifier}:${endpoint}`;
  }

  /**
   * Determina el tipo de rate limit basado en el endpoint
   */
  private getEndpointType(endpoint: string): string {
    if (endpoint.includes('/api/auth/')) return 'auth';
    if (endpoint.includes('/api/ai/')) return 'ai';
    if (endpoint.includes('/api/import') || endpoint.includes('/api/sire') || endpoint.includes('/api/qr')) return 'import';
    if (endpoint.includes('/api/admin/')) return 'admin';
    return 'api';
  }

  /**
   * Verifica si una solicitud está dentro del límite
   * @returns { allowed: boolean, remaining: number, resetIn: number }
   */
  check(
    identifier: string, // IP o userId
    endpoint: string,
    customConfig?: RateLimitConfig
  ): { allowed: boolean; remaining: number; resetIn: number; blocked: boolean } {
    const endpointType = this.getEndpointType(endpoint);
    const config = customConfig || RATE_LIMITS[endpointType] || RATE_LIMITS['api'];
    const key = this.getKey(identifier, endpointType);
    const now = Date.now();

    let entry = this.store.get(key);

    // Si está bloqueado, verificar si el bloqueo ha expirado
    if (entry?.isBlocked && entry.blockedUntil) {
      if (now < entry.blockedUntil) {
        return {
          allowed: false,
          remaining: 0,
          resetIn: Math.ceil((entry.blockedUntil - now) / 1000),
          blocked: true,
        };
      }
      // El bloqueo ha expirado, reiniciar
      entry = undefined;
    }

    // Si no hay entrada o la ventana ha expirado, crear nueva
    if (!entry || now - entry.windowStart >= config.windowMs) {
      entry = {
        count: 1,
        windowStart: now,
        isBlocked: false,
      };
      this.store.set(key, entry);
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetIn: Math.ceil(config.windowMs / 1000),
        blocked: false,
      };
    }

    // Incrementar contador
    entry.count++;
    this.store.set(key, entry);

    // Verificar límite
    if (entry.count > config.maxRequests) {
      // Bloquear si se excede el límite
      if (config.blockDurationMs) {
        entry.isBlocked = true;
        entry.blockedUntil = now + config.blockDurationMs;
        this.store.set(key, entry);
      }
      return {
        allowed: false,
        remaining: 0,
        resetIn: Math.ceil((entry.windowStart + config.windowMs - now) / 1000),
        blocked: entry.isBlocked,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetIn: Math.ceil((entry.windowStart + config.windowMs - now) / 1000),
      blocked: false,
    };
  }

  /**
   * Registra una solicitud (incrementa el contador)
   */
  hit(identifier: string, endpoint: string): void {
    this.check(identifier, endpoint);
  }

  /**
   * Obtiene el estado actual del rate limit para un identificador
   */
  getStatus(identifier: string, endpoint: string): {
    count: number;
    limit: number;
    remaining: number;
    windowMs: number;
    isBlocked: boolean;
  } {
    const endpointType = this.getEndpointType(endpoint);
    const config = RATE_LIMITS[endpointType] || RATE_LIMITS['api'];
    const key = this.getKey(identifier, endpointType);
    const entry = this.store.get(key);

    if (!entry) {
      return {
        count: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        windowMs: config.windowMs,
        isBlocked: false,
      };
    }

    return {
      count: entry.count,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - entry.count),
      windowMs: config.windowMs,
      isBlocked: entry.isBlocked,
    };
  }

  /**
   * Limpia entradas expiradas
   */
  private cleanup(): void {
    const now = Date.now();
    const maxWindow = Math.max(...Object.values(RATE_LIMITS).map(c => c.windowMs));

    for (const [key, entry] of this.store.entries()) {
      // Eliminar si la ventana ha expirado y no está bloqueado
      if (!entry.isBlocked && now - entry.windowStart > maxWindow) {
        this.store.delete(key);
        continue;
      }
      // Eliminar si el bloqueo ha expirado
      if (entry.isBlocked && entry.blockedUntil && now > entry.blockedUntil) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reinicia el rate limit para un identificador
   */
  reset(identifier: string, endpoint?: string): void {
    if (endpoint) {
      const endpointType = this.getEndpointType(endpoint);
      this.store.delete(this.getKey(identifier, endpointType));
    } else {
      // Eliminar todas las entradas para este identificador
      for (const key of this.store.keys()) {
        if (key.startsWith(`${identifier}:`)) {
          this.store.delete(key);
        }
      }
    }
  }

  /**
   * Obtiene estadísticas generales
   */
  getStats(): {
    totalEntries: number;
    blockedEntries: number;
    byType: Record<string, number>;
  } {
    const stats = {
      totalEntries: this.store.size,
      blockedEntries: 0,
      byType: {} as Record<string, number>,
    };

    for (const [key, entry] of this.store.entries()) {
      if (entry.isBlocked) stats.blockedEntries++;
      const type = key.split(':')[1] || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Destruye el limiter y limpia intervalos
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Instancia global del rate limiter
export const rateLimiter = new RateLimiter();

/**
 * Helper para obtener IP del cliente
 */
export function getClientIp(request: Request): string {
  // Intentar obtener IP real detrás de proxies
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback
  return '127.0.0.1';
}

/**
 * Middleware helper para verificar rate limit
 */
export function checkRateLimit(
  request: Request,
  userId?: string
): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  blocked: boolean;
  identifier: string;
} {
  const ip = getClientIp(request);
  const identifier = userId || ip;
  const endpoint = new URL(request.url).pathname;

  const result = rateLimiter.check(identifier, endpoint);
  return { ...result, identifier };
}
