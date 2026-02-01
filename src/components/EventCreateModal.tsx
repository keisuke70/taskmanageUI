import { useState } from 'react';

interface EventCreateModalProps {
  startTime: Date;
  endTime: Date;
  onClose: () => void;
  onCreateEvent: (title: string, start: Date, end: Date) => Promise<void>;
}

function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
}

export function EventCreateModal({
  startTime,
  endTime,
  onClose,
  onCreateEvent,
}: EventCreateModalProps) {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateEvent = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onCreateEvent(title.trim(), startTime, endTime);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'イベント作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[360px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">新規イベント</h2>

        <div className="mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タイトルを入力"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleCreateEvent();
              }
            }}
          />
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">{formatDateDisplay(startTime)}</div>
          <div className="text-lg font-medium text-gray-900">
            {formatTimeDisplay(startTime)} - {formatTimeDisplay(endTime)}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={handleCreateEvent}
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '作成中...' : '追加'}
        </button>

        <button
          onClick={onClose}
          className="w-full mt-2 py-2 text-gray-500 hover:text-gray-700 text-sm"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
