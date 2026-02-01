import { useState } from 'react';
import type { Task } from '../types';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'notes' | 'due'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskItem({ task, onToggle, onUpdate, onDelete }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [loading, setLoading] = useState(false);

  const isCompleted = task.status === 'completed';

  const handleToggle = async () => {
    setLoading(true);
    try {
      await onToggle(task.id, isCompleted);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onUpdate(task.id, { title: title.trim() });
      setEditing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete(task.id);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setTitle(task.title);
      setEditing(false);
    }
  };

  const formatDue = (due?: string) => {
    if (!due) return null;
    // Extract YYYY-MM-DD from due date
    const dueDateStr = due.split('T')[0];

    // Get today as YYYY-MM-DD
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (dueDateStr < todayStr) {
      return { text: `期限: ${dueDateStr}`, className: 'text-red-600 bg-red-50' };
    }
    if (dueDateStr === todayStr) {
      return { text: '今日', className: 'text-blue-600 bg-blue-50' };
    }
    // Calculate tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    if (dueDateStr === tomorrowStr) {
      return { text: '明日', className: 'text-green-600 bg-green-50' };
    }
    return { text: dueDateStr, className: 'text-gray-500 bg-gray-50' };
  };

  const dueInfo = formatDue(task.due);

  return (
    <div
      className={`group flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-gray-50 ${
        loading ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <button
        onClick={handleToggle}
        className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          isCompleted
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        {isCompleted && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        ) : (
          <p
            className={`text-sm cursor-pointer ${
              isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'
            }`}
            onClick={() => setEditing(true)}
          >
            {task.title}
          </p>
        )}
        {task.notes && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{task.notes}</p>
        )}
        {dueInfo && (
          <span className={`inline-block text-xs px-2 py-0.5 rounded mt-1 ${dueInfo.className}`}>
            {dueInfo.text}
          </span>
        )}
      </div>

      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
        title="Delete task"
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
    </div>
  );
}
