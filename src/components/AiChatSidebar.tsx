import { useState, useRef, useEffect } from 'react';
import type { AiMessage } from '../types';

interface AiChatSidebarProps {
  messages: AiMessage[];
  loading: boolean;
  error: string | null;
  onSend: (message: string) => Promise<void>;
  onClear: () => void;
  onClose: () => void;
}

export function AiChatSidebar({
  messages,
  loading,
  error,
  onSend,
  onClear,
  onClose,
}: AiChatSidebarProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const message = input.trim();
    setInput('');
    await onSend(message);
  };

  const greeting = '今日はどんなことしますか？';
  const avatarUrl = '/Gemini_Generated_Image_mw7yl5mw7yl5mw7y.png';

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <div className="p-2 border-b border-gray-100 flex items-center justify-end">
        <div className="flex gap-1">
          {messages.length > 0 && (
            <button
              onClick={onClear}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
              title="会話をクリア"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
            title="閉じる"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-end gap-2">
            <img src={avatarUrl} alt="秘書" className="w-10 h-10 rounded-full bg-slate-100 shadow-sm object-cover" />
            <div className="max-w-[75%] p-3 rounded-2xl rounded-bl-sm text-sm bg-white shadow-sm border border-pink-100 text-gray-700">
              <p>{greeting}</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-end gap-2'}`}
          >
            {msg.role === 'assistant' && (
              <img src={avatarUrl} alt="秘書" className="w-10 h-10 rounded-full bg-slate-100 shadow-sm object-cover" />
            )}
            <div
              className={`max-w-[75%] p-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white rounded-2xl rounded-br-sm shadow-sm'
                  : 'bg-white shadow-sm border border-pink-100 text-gray-700 rounded-2xl rounded-bl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2">
            <img src={avatarUrl} alt="秘書" className="w-10 h-10 rounded-full bg-slate-100 shadow-sm object-cover" />
            <div className="bg-white shadow-sm border border-pink-100 p-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="p-2 bg-red-50 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
