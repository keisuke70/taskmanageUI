import { useState, useRef, useEffect } from 'react';

interface PendingTask {
  id: string;
  title: string;
  due?: string;
  notes?: string;
}

interface AiInputProps {
  pendingTasks: PendingTask[];
  loading: boolean;
  lastResponse: string | null;
  onSend: (message: string) => Promise<void>;
  onAddTask: (title: string, options?: { due?: string; notes?: string }) => Promise<void>;
  onRemovePendingTask: (id: string) => void;
  onClearPendingTasks: () => void;
}

export function AiInput({
  pendingTasks,
  loading,
  lastResponse,
  onSend,
  onAddTask,
  onRemovePendingTask,
  onClearPendingTasks,
}: AiInputProps) {
  const [input, setInput] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const message = input;
    setInput('');
    await onSend(message);
  };

  const handleAddTask = async (task: PendingTask) => {
    setAddingId(task.id);
    try {
      await onAddTask(task.title, { due: task.due, notes: task.notes });
      onRemovePendingTask(task.id);
    } finally {
      setAddingId(null);
    }
  };

  const handleAddAll = async () => {
    for (const task of pendingTasks) {
      await onAddTask(task.title, { due: task.due, notes: task.notes });
    }
    onClearPendingTasks();
  };

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="タスクを追加、予定を確認..."
              disabled={loading}
              className="w-full px-4 py-2.5 pr-10 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            送信
          </button>
        </div>
      </form>

      {/* Response & Pending Tasks */}
      {(lastResponse || pendingTasks.length > 0) && (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {lastResponse && (
            <p className="text-sm text-gray-600 mb-2">{lastResponse}</p>
          )}

          {pendingTasks.length > 0 && (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    {task.due && (
                      <p className="text-xs text-gray-500">期限: {task.due}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAddTask(task)}
                    disabled={addingId === task.id}
                    className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {addingId === task.id ? '...' : '+ 追加'}
                  </button>
                  <button
                    onClick={() => onRemovePendingTask(task.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {pendingTasks.length > 1 && (
                <button
                  onClick={handleAddAll}
                  className="w-full py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                >
                  すべて追加 ({pendingTasks.length}件)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
