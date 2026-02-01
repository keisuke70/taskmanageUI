import { useMemo, useState } from 'react';
import type { Task, TaskList } from '../types';
import { TaskItem } from './TaskItem';

interface TaskListColumnProps {
  list: TaskList;
  tasks: Task[];
  collapsed: boolean;
  expandedCount: number;
  onToggle: (id: string, completed: boolean, listId: string) => Promise<Task>;
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'notes' | 'due'>>, listId: string) => Promise<Task>;
  onDelete: (id: string, listId: string) => Promise<void>;
  onCollapse: () => void;
  onDeleteList: () => Promise<void>;
}

interface TaskGroup {
  label: string;
  tasks: Task[];
  className: string;
}

// Extract YYYY-MM-DD from ISO string or Date, ignoring timezone
function toDateString(dateInput: string | Date): string {
  if (typeof dateInput === 'string') {
    return dateInput.split('T')[0];
  }
  const y = dateInput.getFullYear();
  const m = String(dateInput.getMonth() + 1).padStart(2, '0');
  const d = String(dateInput.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isCompletedToday(task: Task): boolean {
  if (!task.completed) return false;
  return toDateString(task.completed) === toDateString(new Date());
}

function groupTasks(tasks: Task[]): TaskGroup[] {
  const now = new Date();
  const todayStr = toDateString(now);

  const weekEndDate = new Date(now);
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEndStr = toDateString(weekEndDate);

  const overdue: Task[] = [];
  const todayTasks: Task[] = [];
  const thisWeek: Task[] = [];
  const later: Task[] = [];
  const noDue: Task[] = [];
  const completedToday: Task[] = [];

  for (const task of tasks) {
    if (task.status === 'completed') {
      if (isCompletedToday(task)) {
        completedToday.push(task);
      }
      continue;
    }

    if (!task.due) {
      noDue.push(task);
      continue;
    }

    const dueDateStr = toDateString(task.due);

    if (dueDateStr < todayStr) {
      overdue.push(task);
    } else if (dueDateStr === todayStr) {
      todayTasks.push(task);
    } else if (dueDateStr <= weekEndStr) {
      thisWeek.push(task);
    } else {
      later.push(task);
    }
  }

  const groups: TaskGroup[] = [];

  if (overdue.length > 0) {
    groups.push({ label: '期限切れ', tasks: overdue, className: 'border-red-200 bg-red-50' });
  }
  if (todayTasks.length > 0) {
    groups.push({ label: '今日', tasks: todayTasks, className: 'border-sky-200 bg-sky-50' });
  }
  if (thisWeek.length > 0) {
    groups.push({ label: '今週', tasks: thisWeek, className: 'border-cyan-200 bg-cyan-50' });
  }
  if (later.length > 0) {
    groups.push({ label: 'それ以降', tasks: later, className: 'border-gray-200 bg-gray-50' });
  }
  if (noDue.length > 0) {
    groups.push({ label: '期限なし', tasks: noDue, className: 'border-gray-200 bg-white' });
  }
  if (completedToday.length > 0) {
    groups.push({ label: '今日完了', tasks: completedToday, className: 'border-slate-200 bg-slate-50' });
  }

  return groups;
}

function getMaxWidthClass(expandedCount: number): string {
  if (expandedCount === 1) return 'max-w-none';
  if (expandedCount === 2) return 'max-w-[600px]';
  return 'max-w-[400px]';
}

export function TaskListColumn({
  list,
  tasks,
  collapsed,
  expandedCount,
  onToggle,
  onUpdate,
  onDelete,
  onCollapse,
  onDeleteList,
}: TaskListColumnProps) {
  const groups = useMemo(() => groupTasks(tasks), [tasks]);
  const activeTaskCount = tasks.filter(t => t.status !== 'completed').length;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const maxWidthClass = getMaxWidthClass(expandedCount);

  const handleDeleteList = async () => {
    setDeleting(true);
    try {
      await onDeleteList();
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Collapsed state - show thin bar
  if (collapsed) {
    return (
      <div className="w-12 flex flex-col bg-white rounded-lg border border-gray-200">
        <button
          onClick={onCollapse}
          className="flex-1 flex flex-col items-center py-4 hover:bg-gray-50 transition-colors"
          title={`${list.title} を展開`}
        >
          {/* Expand icon */}
          <svg className="w-4 h-4 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {/* Vertical text */}
          <span className="writing-vertical text-sm font-medium text-gray-700" style={{ writingMode: 'vertical-rl' }}>
            {list.title}
          </span>
          {activeTaskCount > 0 && (
            <span className="mt-2 w-5 h-5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center justify-center">
              {activeTaskCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`min-w-[180px] ${maxWidthClass} flex-1 flex flex-col bg-white rounded-lg border border-gray-200`}>
      {/* List Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        {showDeleteConfirm ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">「{list.title}」を削除しますか？</p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteList}
                disabled={deleting}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-3 py-1.5 text-xs text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">{list.title}</h2>
              <p className="text-xs text-gray-500">{activeTaskCount} タスク</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="リストを削除"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={onCollapse}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                title="縮小"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Task Groups */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {groups.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            タスクがありません
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className={`border rounded-lg ${group.className}`}>
              <div className="px-3 py-2 border-b border-inherit">
                <h3 className="font-medium text-xs text-gray-600">
                  {group.label} <span className="text-gray-400">({group.tasks.length})</span>
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {group.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={(id, completed) => onToggle(id, completed, list.id)}
                    onUpdate={(id, updates) => onUpdate(id, updates, list.id)}
                    onDelete={(id) => onDelete(id, list.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
