'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Terminal, Download, Trash2, CheckCircle, AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
}

interface ScraperConsoleProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSessionEnd?: (success: boolean) => void;
}

// Separate type for internal session status tracking
type SessionStatus = 'running' | 'completed' | 'failed';

const levelStyles: Record<string, { bg: string; text: string; icon: typeof Info }> = {
  info: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Info },
  success: { bg: 'bg-green-500/10', text: 'text-green-400', icon: CheckCircle },
  warning: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: AlertTriangle },
  error: { bg: 'bg-red-500/10', text: 'text-red-400', icon: AlertCircle },
  debug: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: Bug },
};

const sourceColors: Record<string, string> = {
  'Orchestrator': 'text-purple-400',
  'SEACE Puppeteer': 'text-blue-400',
  'SEACE': 'text-blue-400',
  'OSCE': 'text-orange-400',
  'SUNAT': 'text-red-400',
  'SYSTEM': 'text-gray-400',
};

export function ScraperConsole({ sessionId, isOpen, onClose, onSessionEnd }: ScraperConsoleProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('running');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Use ref for callback to avoid re-triggering the effect when parent re-renders
  const onSessionEndRef = useRef(onSessionEnd);
  onSessionEndRef.current = onSessionEnd;

  // Track if session has ended to prevent calling callback multiple times
  const hasEndedRef = useRef(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Use polling instead of SSE for better compatibility
  useEffect(() => {
    if (!sessionId || !isOpen) {
      return;
    }

    // Clear previous logs and reset state
    setLogs([]);
    setSessionStatus('running');
    setIsConnected(true);
    hasEndedRef.current = false;

    let lastLogId = '';
    let pollCount = 0;
    const maxPolls = 300; // 5 minutos máximo (300 * 1000ms)
    let isPollingActive = true;

    const pollLogs = async (): Promise<boolean> => {
      // Early exit if polling was stopped or session already ended
      if (!isPollingActive || hasEndedRef.current) {
        console.log('[Console] Polling skipped - already stopped');
        return false;
      }

      try {
        const url = `/api/admin/alertas/scraper-logs?sessionId=${sessionId}&action=history`;

        const response = await fetch(url, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[Console] Error fetching logs:', response.status, errorData);
          return isPollingActive; // Continuar intentando solo si sigue activo
        }

        const data = await response.json();
        console.log('[Console] Response:', { sessionStatus: data.session?.status, logsCount: data.logs?.length });

        if (data.logs && Array.isArray(data.logs)) {
          // Filtrar logs nuevos
          const newLogs = data.logs.filter((log: LogEntry) => {
            if (!lastLogId) return true;
            return log.id > lastLogId;
          });

          if (newLogs.length > 0) {
            setLogs(prev => {
              const existingIds = new Set(prev.map(l => l.id));
              const uniqueNew = newLogs.filter((l: LogEntry) => !existingIds.has(l.id));
              return [...prev, ...uniqueNew];
            });
            lastLogId = data.logs[data.logs.length - 1]?.id || lastLogId;
          }
        }

        // Verificar si la sesión terminó
        if (data.session && !hasEndedRef.current) {
          if (data.session.status === 'completed') {
            console.log('[Console] Session completed, stopping polling');
            hasEndedRef.current = true;
            isPollingActive = false;
            setSessionStatus('completed');
            setIsConnected(false);
            // Call the callback via ref to avoid triggering re-render loop
            onSessionEndRef.current?.(true);
            return false; // Detener polling
          } else if (data.session.status === 'failed') {
            console.log('[Console] Session failed, stopping polling');
            hasEndedRef.current = true;
            isPollingActive = false;
            setSessionStatus('failed');
            setIsConnected(false);
            onSessionEndRef.current?.(false);
            return false; // Detener polling
          }
        }

        return isPollingActive; // Continuar polling solo si sigue activo
      } catch (error) {
        console.error('Error polling logs:', error);
        return isPollingActive; // Continuar intentando solo si sigue activo
      }
    };

    // Hacer polling cada segundo
    const intervalId = setInterval(async () => {
      if (!isPollingActive) {
        clearInterval(intervalId);
        return;
      }

      pollCount++;
      if (pollCount > maxPolls) {
        console.log('[Console] Max polls reached, stopping');
        isPollingActive = false;
        clearInterval(intervalId);
        setIsConnected(false);
        return;
      }

      const shouldContinue = await pollLogs();
      if (!shouldContinue) {
        console.log('[Console] Polling stopped by pollLogs');
        clearInterval(intervalId);
      }
    }, 1000);

    // Poll inmediatamente al inicio
    pollLogs();

    return () => {
      console.log('[Console] Cleanup - stopping polling');
      isPollingActive = false;
      clearInterval(intervalId);
    };
  }, [sessionId, isOpen]); // Removed onSessionEnd from dependencies!

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleDownloadLogs = () => {
    const content = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString('es-PE');
      return `[${time}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`;
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scraper-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 rounded-t-xl border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-green-400" />
            <h3 className="font-mono font-semibold text-white">Scraper Console</h3>
            <div className="flex items-center gap-2">
              {sessionStatus === 'running' && isConnected && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  En vivo
                </span>
              )}
              {sessionStatus === 'running' && !isConnected && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full" />
                  Reconectando...
                </span>
              )}
              {sessionStatus === 'completed' && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  Completado
                </span>
              )}
              {sessionStatus === 'failed' && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                  <AlertCircle className="w-3 h-3" />
                  Error
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownloadLogs}
              className="text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearLogs}
              className="text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Log content */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-gray-900 space-y-1">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <div className="text-center">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Esperando logs...</p>
              </div>
            </div>
          ) : (
            logs.map((log) => {
              const style = levelStyles[log.level] || levelStyles.info;
              const Icon = style.icon;
              const sourceColor = sourceColors[log.source] || 'text-gray-400';
              const time = new Date(log.timestamp).toLocaleTimeString('es-PE', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 px-2 py-1 rounded ${style.bg} group hover:bg-opacity-20`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.text}`} />
                  <span className="text-gray-500 flex-shrink-0">{time}</span>
                  <span className={`flex-shrink-0 ${sourceColor}`}>[{log.source}]</span>
                  <span className="text-gray-200 break-words">{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-800 rounded-b-xl border-t border-gray-700 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {logs.length} líneas de log
          </span>
          <span className="text-xs text-gray-500">
            Session: {sessionId?.substring(0, 12)}...
          </span>
        </div>
      </div>
    </div>
  );
}

export default ScraperConsole;
