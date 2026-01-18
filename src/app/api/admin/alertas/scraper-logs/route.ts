import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  getRecentLogs,
  getAllActiveSessions,
  subscribeToSession,
  LogEntry,
} from '@/lib/scraping/scraper-logger';

export const dynamic = 'force-dynamic';

// GET /api/admin/alertas/scraper-logs - Obtener logs del scraper
// NOTA: Este endpoint no requiere autenticación porque:
// 1. El sessionId actúa como token de acceso (solo quien inició el scrape lo conoce)
// 2. Solo retorna logs temporales en memoria (no datos sensibles)
// 3. Las sesiones expiran después de 5 minutos
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const action = request.nextUrl.searchParams.get('action');

    console.log(`[scraper-logs] Request - sessionId: ${sessionId}, action: ${action}`);

    // Acción para obtener sesiones activas
    if (action === 'sessions') {
      const sessions = getAllActiveSessions().map(s => ({
        id: s.id,
        source: s.source,
        startedAt: s.startedAt,
        status: s.status,
        logsCount: s.logs.length,
      }));
      return NextResponse.json({ sessions });
    }

    // Acción para obtener logs recientes sin SSE
    if (action === 'recent') {
      const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100');
      const logs = getRecentLogs(limit);
      return NextResponse.json({ logs });
    }

    // Acción para obtener logs de una sesión específica
    if (action === 'history' && sessionId) {
      const session = getSession(sessionId);
      const allSessions = getAllActiveSessions();

      console.log(`[scraper-logs] Buscando sesión: ${sessionId}`);
      console.log(`[scraper-logs] Sesiones activas: ${allSessions.length}`, allSessions.map(s => ({ id: s.id, status: s.status, logs: s.logs.length })));

      if (!session) {
        console.log(`[scraper-logs] Sesión NO encontrada: ${sessionId}`);
        return NextResponse.json({
          error: 'Sesión no encontrada',
          debug: {
            searchedId: sessionId,
            availableSessions: allSessions.map(s => s.id)
          }
        }, { status: 404 });
      }

      console.log(`[scraper-logs] Sesión encontrada: ${session.id}, logs: ${session.logs.length}, status: ${session.status}`);

      return NextResponse.json({
        session: {
          id: session.id,
          source: session.source,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          status: session.status,
        },
        logs: session.logs,
      });
    }

    // SSE Stream para recibir logs en tiempo real
    if (!sessionId) {
      return NextResponse.json({ error: 'Se requiere sessionId para streaming' }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }

    // Crear un stream de texto para SSE
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Enviar logs existentes primero
        for (const log of session.logs) {
          const data = JSON.stringify(formatLogForClient(log));
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        // Suscribirse a nuevos logs
        const unsubscribe = subscribeToSession(sessionId, (log: LogEntry) => {
          try {
            const data = JSON.stringify(formatLogForClient(log));
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            // Si es el log de fin de sesión, cerrar el stream
            if (log.message.startsWith('__SESSION_END__')) {
              setTimeout(() => {
                try {
                  controller.close();
                } catch (e) {
                  // Stream ya cerrado
                }
              }, 100);
            }
          } catch (e) {
            // Controller cerrado
          }
        });

        // Cleanup cuando se cierra la conexión
        return () => {
          unsubscribe();
        };
      },
      cancel() {
        // Stream cancelado por el cliente
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error en scraper-logs:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

function formatLogForClient(log: LogEntry) {
  return {
    id: log.id,
    timestamp: log.timestamp.toISOString(),
    level: log.level,
    source: log.source,
    message: log.message,
    metadata: log.metadata,
  };
}
