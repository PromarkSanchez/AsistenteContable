/**
 * Sistema de logging en tiempo real para scrapers
 * Permite capturar logs y transmitirlos via SSE
 */

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ScraperSession {
  id: string;
  source: string;
  startedAt: Date;
  endedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  logs: LogEntry[];
  listeners: Set<(log: LogEntry) => void>;
}

// Usar globalThis para evitar problemas de múltiples instancias del módulo en Next.js
const globalForScraper = globalThis as unknown as {
  scraperSessions: Map<string, ScraperSession> | undefined;
  scraperRecentLogs: LogEntry[] | undefined;
};

// Store de sesiones activas (en memoria, persistente entre recargas de módulo)
const activeSessions = globalForScraper.scraperSessions ?? new Map<string, ScraperSession>();
globalForScraper.scraperSessions = activeSessions;

// Historial de logs recientes (últimos 1000 logs)
const recentLogs = globalForScraper.scraperRecentLogs ?? [];
globalForScraper.scraperRecentLogs = recentLogs;

const MAX_RECENT_LOGS = 1000;

/**
 * Genera un ID único para una sesión o log
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Inicia una nueva sesión de scraping
 */
export function startScraperSession(source: string): string {
  const sessionId = generateId();

  const session: ScraperSession = {
    id: sessionId,
    source,
    startedAt: new Date(),
    status: 'running',
    logs: [],
    listeners: new Set(),
  };

  activeSessions.set(sessionId, session);

  // Log inicial
  addLog(sessionId, 'info', source, `Iniciando sesión de scraping para ${source.toUpperCase()}`);

  return sessionId;
}

/**
 * Finaliza una sesión de scraping
 */
export function endScraperSession(sessionId: string, success: boolean): void {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  session.endedAt = new Date();
  session.status = success ? 'completed' : 'failed';

  const duration = (session.endedAt.getTime() - session.startedAt.getTime()) / 1000;

  addLog(
    sessionId,
    success ? 'success' : 'error',
    session.source,
    `Sesión ${success ? 'completada' : 'fallida'} en ${duration.toFixed(1)}s`
  );

  // Notificar a los listeners que la sesión terminó
  const endLog: LogEntry = {
    id: generateId(),
    timestamp: new Date(),
    level: 'info',
    source: 'SYSTEM',
    message: `__SESSION_END__:${success ? 'completed' : 'failed'}`,
  };

  session.listeners.forEach(listener => listener(endLog));

  // Limpiar listeners
  session.listeners.clear();

  // Mantener la sesión por 5 minutos para que se puedan ver los logs
  setTimeout(() => {
    activeSessions.delete(sessionId);
  }, 5 * 60 * 1000);
}

/**
 * Añade un log a una sesión específica
 */
export function addLog(
  sessionId: string,
  level: LogLevel,
  source: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  const log: LogEntry = {
    id: generateId(),
    timestamp: new Date(),
    level,
    source,
    message,
    metadata,
  };

  // Añadir a logs recientes globales
  recentLogs.push(log);
  if (recentLogs.length > MAX_RECENT_LOGS) {
    recentLogs.shift();
  }

  // Añadir a la sesión si existe
  const session = activeSessions.get(sessionId);
  if (session) {
    session.logs.push(log);

    // Notificar a todos los listeners
    session.listeners.forEach(listener => listener(log));
  }

  // También logear a consola para debugging del servidor
  const timestamp = log.timestamp.toISOString().split('T')[1].split('.')[0];
  const prefix = `[${timestamp}] [${source}]`;

  switch (level) {
    case 'error':
      console.error(prefix, message, metadata || '');
      break;
    case 'warning':
      console.warn(prefix, message, metadata || '');
      break;
    case 'debug':
      if (process.env.DEBUG) {
        console.log(prefix, message, metadata || '');
      }
      break;
    default:
      console.log(prefix, message, metadata || '');
  }
}

/**
 * Crea un logger vinculado a una sesión específica
 */
export function createSessionLogger(sessionId: string, defaultSource: string) {
  return {
    info: (message: string, metadata?: Record<string, unknown>) =>
      addLog(sessionId, 'info', defaultSource, message, metadata),
    success: (message: string, metadata?: Record<string, unknown>) =>
      addLog(sessionId, 'success', defaultSource, message, metadata),
    warning: (message: string, metadata?: Record<string, unknown>) =>
      addLog(sessionId, 'warning', defaultSource, message, metadata),
    error: (message: string, metadata?: Record<string, unknown>) =>
      addLog(sessionId, 'error', defaultSource, message, metadata),
    debug: (message: string, metadata?: Record<string, unknown>) =>
      addLog(sessionId, 'debug', defaultSource, message, metadata),
  };
}

/**
 * Suscribe un listener para recibir logs de una sesión en tiempo real
 */
export function subscribeToSession(
  sessionId: string,
  listener: (log: LogEntry) => void
): () => void {
  const session = activeSessions.get(sessionId);
  if (!session) {
    // Si no hay sesión activa, crear una para monitoreo
    return () => {};
  }

  session.listeners.add(listener);

  // Retornar función para desuscribirse
  return () => {
    session.listeners.delete(listener);
  };
}

/**
 * Obtiene la sesión activa más reciente (o una específica por fuente)
 */
export function getActiveSession(source?: string): ScraperSession | null {
  if (source) {
    for (const session of activeSessions.values()) {
      if (session.source.toLowerCase() === source.toLowerCase() && session.status === 'running') {
        return session;
      }
    }
  } else {
    // Retornar la sesión más reciente que esté corriendo
    let latest: ScraperSession | null = null;
    for (const session of activeSessions.values()) {
      if (session.status === 'running') {
        if (!latest || session.startedAt > latest.startedAt) {
          latest = session;
        }
      }
    }
    return latest;
  }
  return null;
}

/**
 * Obtiene una sesión por ID
 */
export function getSession(sessionId: string): ScraperSession | null {
  return activeSessions.get(sessionId) || null;
}

/**
 * Obtiene los logs recientes
 */
export function getRecentLogs(limit = 100): LogEntry[] {
  return recentLogs.slice(-limit);
}

/**
 * Obtiene todas las sesiones activas
 */
export function getAllActiveSessions(): ScraperSession[] {
  return Array.from(activeSessions.values());
}

// Export singleton para uso global
export const scraperLogger = {
  startSession: startScraperSession,
  endSession: endScraperSession,
  addLog,
  createLogger: createSessionLogger,
  subscribe: subscribeToSession,
  getActiveSession,
  getSession,
  getRecentLogs,
  getAllSessions: getAllActiveSessions,
};

export default scraperLogger;
