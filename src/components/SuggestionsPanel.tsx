import { useState } from 'react';
import type { Suggestion } from '../types';

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  gmailSuggestions: Suggestion[];
  calendarSuggestions: Suggestion[];
  loading: boolean;
  error: string | null;
  lastAnalyzed: Date | null;
  onAnalyze: (source?: 'gmail' | 'calendar') => Promise<void>;
  onDismiss: (suggestion: Suggestion) => void;
  onAddTask: (title: string, options?: { due?: string; notes?: string }) => Promise<unknown>;
  onRemoveSuggestion: (suggestionId: string) => void;
}

function SuggestionCard({
  suggestion,
  onDismiss,
  onAdd,
}: {
  suggestion: Suggestion;
  onDismiss: () => void;
  onAdd: () => void;
}) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onAdd();
    } finally {
      setAdding(false);
    }
  };

  const sourceIcon = suggestion.source === 'gmail' ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
    </svg>
  );

  const sourceColor = suggestion.source === 'gmail'
    ? 'text-red-500 bg-red-50'
    : 'text-blue-500 bg-blue-50';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${sourceColor}`}>
          {sourceIcon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm">{suggestion.title}</p>
          {suggestion.due && (
            <p className="text-xs text-gray-500 mt-1">
              期限: {suggestion.due}
            </p>
          )}
          <div className="mt-2 text-xs text-gray-400">
            <p className="truncate">{suggestion.sourceTitle}</p>
            {suggestion.sourceFrom && (
              <p className="truncate">From: {suggestion.sourceFrom}</p>
            )}
          </div>
        </div>
      </div>

      {suggestion.sourceSnippet && (
        <p className="mt-3 text-xs text-gray-500 line-clamp-2 border-t border-gray-100 pt-2">
          {suggestion.sourceSnippet}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {adding ? '追加中...' : '+ タスクに追加'}
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          無視
        </button>
      </div>
    </div>
  );
}

export function SuggestionsPanel({
  gmailSuggestions,
  calendarSuggestions,
  loading,
  error,
  lastAnalyzed,
  onAnalyze,
  onDismiss,
  onAddTask,
  onRemoveSuggestion,
}: SuggestionsPanelProps) {
  const handleAdd = async (suggestion: Suggestion) => {
    await onAddTask(suggestion.title, {
      due: suggestion.due,
      notes: suggestion.notes || `Source: ${suggestion.sourceTitle}`,
    });
    onRemoveSuggestion(suggestion.id);
  };

  const totalCount = gmailSuggestions.length + calendarSuggestions.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI 提案</h2>
            {lastAnalyzed && (
              <p className="text-xs text-gray-500 mt-0.5">
                最終分析: {lastAnalyzed.toLocaleTimeString('ja-JP')}
              </p>
            )}
          </div>
          <button
            onClick={() => onAnalyze()}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                分析中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                分析する
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {totalCount === 0 && !loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-gray-500">
              {lastAnalyzed ? '新しい提案はありません' : '「分析する」をクリックしてメールとカレンダーからタスクを抽出'}
            </p>
          </div>
        )}

        {/* Gmail Suggestions */}
        {gmailSuggestions.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <span className="w-6 h-6 rounded bg-red-100 text-red-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
              </span>
              メールから ({gmailSuggestions.length})
            </h3>
            <div className="space-y-3">
              {gmailSuggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onDismiss={() => onDismiss(s)}
                  onAdd={() => handleAdd(s)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Calendar Suggestions */}
        {calendarSuggestions.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <span className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
                </svg>
              </span>
              カレンダーから ({calendarSuggestions.length})
            </h3>
            <div className="space-y-3">
              {calendarSuggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onDismiss={() => onDismiss(s)}
                  onAdd={() => handleAdd(s)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
