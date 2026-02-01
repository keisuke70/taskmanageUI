import { useState } from 'react';
import type { Task, TaskList, TasksByList, ListCollapsed } from '../types';
import { TaskListColumn } from './TaskListColumn';

interface TaskPanelProps {
  visibleLists: TaskList[];
  tasksByList: TasksByList;
  listCollapsed: ListCollapsed;
  loading: boolean;
  error: string | null;
  onToggle: (id: string, completed: boolean, listId: string) => Promise<Task>;
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'notes' | 'due'>>, listId: string) => Promise<Task>;
  onDelete: (id: string, listId: string) => Promise<void>;
  onCollapse: (listId: string) => void;
  onCreateList: (title: string) => Promise<TaskList>;
  onDeleteList: (listId: string) => Promise<void>;
  onRefresh: () => void;
}

export function TaskPanel({
  visibleLists,
  tasksByList,
  listCollapsed,
  loading,
  error,
  onToggle,
  onUpdate,
  onDelete,
  onCollapse,
  onCreateList,
  onDeleteList,
  onRefresh,
}: TaskPanelProps) {
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateList = async () => {
    if (!newListTitle.trim() || creating) return;
    setCreating(true);
    try {
      await onCreateList(newListTitle.trim());
      setNewListTitle('');
      setShowNewListInput(false);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreateList();
    if (e.key === 'Escape') {
      setNewListTitle('');
      setShowNewListInput(false);
    }
  };

  if (loading && visibleLists.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={onRefresh}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const expandedCount = visibleLists.filter(list => !listCollapsed[list.id]).length;

  return (
    <div className="h-full flex gap-4 p-4 overflow-x-auto">
      {visibleLists.map((list) => (
        <TaskListColumn
          key={list.id}
          list={list}
          tasks={tasksByList[list.id] || []}
          collapsed={listCollapsed[list.id] || false}
          expandedCount={expandedCount}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onCollapse={() => onCollapse(list.id)}
          onDeleteList={() => onDeleteList(list.id)}
        />
      ))}

      {/* Add New List Button/Input */}
      <div className="flex-shrink-0">
        {showNewListInput ? (
          <div className="w-[300px] bg-white rounded-lg border border-gray-200 p-4">
            <input
              type="text"
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="新しいリスト名..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              disabled={creating}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleCreateList}
                disabled={!newListTitle.trim() || creating}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? '作成中...' : '作成'}
              </button>
              <button
                onClick={() => {
                  setNewListTitle('');
                  setShowNewListInput(false);
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNewListInput(true)}
            className="w-12 h-full min-h-[200px] flex flex-col items-center justify-center bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
            title="新しいリストを作成"
          >
            <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
