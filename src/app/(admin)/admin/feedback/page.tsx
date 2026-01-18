'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import {
  MessageSquare,
  Star,
  Bug,
  Lightbulb,
  ThumbsUp,
  CheckCircle,
  Clock,
  Eye,
  Send,
  Loader2,
} from 'lucide-react';

interface Feedback {
  id: string;
  type: string;
  rating: number | null;
  title: string | null;
  description: string;
  page: string | null;
  status: string;
  adminResponse: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  bug: Bug,
  feature: Lightbulb,
  improvement: ThumbsUp,
  satisfaction: Star,
};

const typeLabels: Record<string, string> = {
  bug: 'Reporte de Bug',
  feature: 'Sugerencia',
  improvement: 'Mejora',
  satisfaction: 'Satisfacción',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  reviewing: { label: 'En revisión', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  resolved: { label: 'Resuelto', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  closed: { label: 'Cerrado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
};

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('pending');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadFeedback();
  }, [filter]);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const data = await apiClient.get<{ data: Feedback[]; total: number }>(
        `/api/admin/feedback${params}`
      );
      setFeedback(data.data);
      setTotal(data.total);
    } catch (error) {
      console.error('Error cargando feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await apiClient.put('/api/admin/feedback', { id, status: newStatus });
      await loadFeedback();
      if (selectedFeedback?.id === id) {
        setSelectedFeedback({ ...selectedFeedback, status: newStatus });
      }
    } catch (error) {
      console.error('Error actualizando estado:', error);
    }
  };

  const handleSendResponse = async () => {
    if (!selectedFeedback || !response.trim()) return;

    setSaving(true);
    try {
      await apiClient.put('/api/admin/feedback', {
        id: selectedFeedback.id,
        adminResponse: response,
        status: 'resolved',
      });
      setResponse('');
      setSelectedFeedback(null);
      await loadFeedback();
    } catch (error) {
      console.error('Error enviando respuesta:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
      />
    ));
  };

  if (loading && feedback.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestión de Feedback
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {total} comentarios en total
          </p>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'reviewing', 'resolved', 'closed'].map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'Todos' : statusLabels[status]?.label || status}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lista de feedback */}
        <Card className="h-[600px] overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Comentarios
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto h-[calc(100%-80px)]">
            {feedback.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No hay feedback {filter !== 'all' ? `con estado "${statusLabels[filter]?.label}"` : ''}
              </p>
            ) : (
              <div className="space-y-3">
                {feedback.map((item) => {
                  const TypeIcon = typeIcons[item.type] || MessageSquare;
                  const statusInfo = statusLabels[item.status] || statusLabels.pending;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedFeedback?.id === item.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => setSelectedFeedback(item)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                            <TypeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {item.title || typeLabels[item.type] || 'Sin título'}
                              </p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {item.user.fullName || item.user.email}
                            </p>
                            {item.rating !== null && (
                              <div className="flex items-center gap-1 mt-1">
                                {renderStars(item.rating)}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {new Date(item.createdAt).toLocaleDateString('es-PE')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalle del feedback */}
        <Card className="h-[600px] overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Detalle
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto h-[calc(100%-80px)]">
            {selectedFeedback ? (
              <div className="space-y-4">
                {/* Info del feedback */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedFeedback.rating !== null && (
                      <div className="flex items-center gap-1">
                        {renderStars(selectedFeedback.rating)}
                      </div>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[selectedFeedback.status]?.color}`}>
                      {statusLabels[selectedFeedback.status]?.label}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {selectedFeedback.title || typeLabels[selectedFeedback.type]}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    De: {selectedFeedback.user.fullName || selectedFeedback.user.email}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(selectedFeedback.createdAt).toLocaleString('es-PE')}
                    {selectedFeedback.page && ` • Página: ${selectedFeedback.page}`}
                  </p>
                </div>

                {/* Descripción */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descripción
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap">
                    {selectedFeedback.description}
                  </p>
                </div>

                {/* Respuesta existente */}
                {selectedFeedback.adminResponse && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-1 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Respuesta enviada
                    </h4>
                    <p className="text-sm text-green-600 dark:text-green-400 whitespace-pre-wrap">
                      {selectedFeedback.adminResponse}
                    </p>
                  </div>
                )}

                {/* Cambiar estado */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cambiar estado
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(statusLabels).map(([status, info]) => (
                      <Button
                        key={status}
                        variant={selectedFeedback.status === status ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handleStatusChange(selectedFeedback.id, status)}
                        disabled={selectedFeedback.status === status}
                      >
                        {status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                        {status === 'reviewing' && <Eye className="w-3 h-3 mr-1" />}
                        {status === 'resolved' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {info.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Responder */}
                {!selectedFeedback.adminResponse && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Responder al usuario
                    </h4>
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
                      rows={4}
                    />
                    <Button
                      onClick={handleSendResponse}
                      disabled={!response.trim() || saving}
                      isLoading={saving}
                      className="mt-2"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Enviar respuesta
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                <p>Selecciona un comentario para ver los detalles</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
