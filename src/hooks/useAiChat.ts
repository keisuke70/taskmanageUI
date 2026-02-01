import { useState, useCallback } from 'react';
import type { AiMessage } from '../types';
import * as api from '../api/client';

export function useAiChat(onTasksExecuted?: () => void) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const { response, executedTasks } = await api.sendAiMessage(content);
      const assistantMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // タスクが実行されたらリフレッシュ
      if (executedTasks && executedTasks.length > 0 && onTasksExecuted) {
        onTasksExecuted();
      }

      return { message: assistantMessage, executedTasks };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send message';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [onTasksExecuted]);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setError(null);
    await api.clearAiChat().catch(() => {});
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages,
  };
}
