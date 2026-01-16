'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare,
  Send,
  X,
  Bot,
  User,
  Loader2,
  Minimize2,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useCompanyStore } from '@/store/company-store';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIChat({ isOpen, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de contabilidad con IA. Puedo ayudarte con:\n\n• Consultas sobre IGV y Renta\n• Clasificación de comprobantes\n• Cálculos tributarios\n• Dudas sobre SUNAT\n\n¿En qué puedo ayudarte hoy?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { accessToken } = useAuthStore();
  const { selectedCompany } = useCompanyStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          companyId: selectedCompany?.id,
          context: {
            companyName: selectedCompany?.razonSocial,
            ruc: selectedCompany?.ruc,
            regimen: selectedCompany?.regimen,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al procesar tu consulta');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error
          ? `Lo siento, hubo un error: ${error.message}`
          : 'Lo siento, hubo un error al procesar tu consulta. Por favor intenta de nuevo.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 left-4 sm:left-auto z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ${
        isMinimized ? 'sm:w-72 h-14' : 'sm:w-96 h-[500px] max-h-[calc(100vh-2rem)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-600 to-primary-700 rounded-t-xl">
        <div className="flex items-center gap-2 text-white">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Asistente IA</h3>
            {!isMinimized && (
              <p className="text-xs text-white/70">Powered by Claude</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user'
                      ? 'bg-primary-100 dark:bg-primary-900/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  ) : (
                    <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Pensando...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-gray-200 dark:border-gray-700"
          >
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu consulta..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

// Botón flotante para abrir el chat
export function AIChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-40 w-14 h-14 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 group"
      title="Abrir Asistente IA"
    >
      <MessageSquare className="w-6 h-6" />
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
    </button>
  );
}
