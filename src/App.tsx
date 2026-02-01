import { useState } from 'react';
import type { CalendarViewMode } from './types';
import { useMultiListTasks } from './hooks/useMultiListTasks';
import { useCalendar } from './hooks/useCalendar';
import { useAiChat } from './hooks/useAiChat';
import { useSuggestions } from './hooks/useSuggestions';
import { TaskPanel } from './components/TaskPanel';
import { CalendarView } from './components/CalendarView';
import { AiChatSidebar } from './components/AiChatSidebar';
import { EventCreateModal } from './components/EventCreateModal';
import * as api from './api/client';

function App() {
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>('day');
  const [chatOpen, setChatOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const [eventCreateModal, setEventCreateModal] = useState<{ startTime: Date; endTime: Date } | null>(null);

  const {
    tasksByList,
    listCollapsed,
    visibleLists,
    allTasks,
    loading: tasksLoading,
    error: tasksError,
    toggleListCollapsed,
    createList,
    deleteList,
    addTask,
    toggleComplete,
    updateTask,
    removeTask,
    refresh: refreshTasks,
  } = useMultiListTasks();

  const {
    events,
    loading: calendarLoading,
    error: calendarError,
    baseDate,
    goToToday,
    goNext,
    goPrev,
    refresh: refreshCalendar,
  } = useCalendar(calendarMode);

  const {
    messages,
    loading: aiLoading,
    error: aiError,
    sendMessage,
    clearMessages,
  } = useAiChat(refreshTasks);  // タスク実行後に自動リフレッシュ

  const {
    suggestions,
    loading: suggestionsLoading,
    analyze,
    dismiss,
    removeSuggestion,
  } = useSuggestions(false);

  const handleChatOpen = () => {
    setChatOpen(true);
  };

  const handleSuggestionsClick = async () => {
    setShowSuggestions(true);
    await analyze();
  };

  const handleAddFromSuggestion = async (s: typeof suggestions[0]) => {
    await addTask(s.title, { due: s.due, notes: s.notes });
    removeSuggestion(s.id);
  };

  const handleDragSelect = (startTime: Date, endTime: Date) => {
    setEventCreateModal({ startTime, endTime });
  };

  const handleCreateCalendarEvent = async (title: string, start: Date, end: Date) => {
    await api.createCalendarEvent(title, start.toISOString(), end.toISOString());
    await refreshCalendar();
  };

  const handleEventToTask = async (event: { summary: string; start: { dateTime?: string; date?: string } }) => {
    // Convert to local date string (YYYY-MM-DD) to avoid timezone issues
    let due: string | undefined;
    if (event.start.dateTime) {
      const date = new Date(event.start.dateTime);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      due = `${year}-${month}-${day}`;
    } else if (event.start.date) {
      due = event.start.date;
    }
    await addTask(event.summary, { due });
  };

  const handleEventUpdate = async (eventId: string, start: Date, end: Date) => {
    await api.updateCalendarEvent(eventId, {
      start: start.toISOString(),
      end: end.toISOString(),
    });
    // Silent refresh - don't show loading state
    await refreshCalendar(true);
  };

  return (
    <div className="h-screen flex bg-gray-100 relative">
      {/* Left: Tasks */}
      <div className="flex-1 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <TaskPanel
            visibleLists={visibleLists}
            tasksByList={tasksByList}
            listCollapsed={listCollapsed}
            loading={tasksLoading}
            error={tasksError}
            onToggle={toggleComplete}
            onUpdate={updateTask}
            onDelete={removeTask}
            onCollapse={toggleListCollapsed}
            onCreateList={createList}
            onDeleteList={deleteList}
            onRefresh={refreshTasks}
          />
        </div>
      </div>

      {/* Right: Calendar */}
      <div className={`${calendarCollapsed ? 'w-12' : calendarMode === 'day' ? 'w-[360px]' : 'w-2/5'} bg-white overflow-hidden transition-all`}>
        <CalendarView
          events={events}
          tasks={allTasks}
          loading={calendarLoading}
          error={calendarError}
          mode={calendarMode}
          baseDate={baseDate}
          collapsed={calendarCollapsed}
          onModeChange={setCalendarMode}
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToToday}
          onCollapse={() => setCalendarCollapsed(!calendarCollapsed)}
          onDragSelect={handleDragSelect}
          pendingSelection={eventCreateModal}
          onEventToTask={handleEventToTask}
          onEventUpdate={handleEventUpdate}
        />
      </div>

      {/* Bottom Action Buttons */}
      {!chatOpen && (
        <>
          {/* Suggestions Button - Left */}
          <div className="absolute bottom-6 left-6 z-10 group">
            <button
              onClick={handleSuggestionsClick}
              disabled={suggestionsLoading}
              className="px-4 py-2.5 bg-white text-purple-700 rounded-full shadow-lg font-medium hover:bg-purple-50 border border-purple-200 disabled:opacity-50 flex items-center gap-2"
            >
              {suggestionsLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  分析中...
                </>
              ) : (
                <>提案</>
              )}
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full left-0 mb-2 w-56 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                GmailとGoogleカレンダーを分析して、タスク候補を提案します
                <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-800" />
              </div>
            </div>
          </div>

          {/* Add Task Button - Center */}
          <button
            onClick={handleChatOpen}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 bg-blue-600 text-white rounded-full shadow-lg font-medium hover:bg-blue-700 transition-all flex items-center gap-2 z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            タスク追加
          </button>
        </>
      )}

      {/* Chat Modal/Overlay */}
      {chatOpen && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <AiChatSidebar
              messages={messages}
              loading={aiLoading}
              error={aiError}
              onSend={async (msg) => { await sendMessage(msg); }}
              onClear={clearMessages}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Suggestions Modal */}
      {showSuggestions && !suggestionsLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-end justify-start p-6 z-50" onClick={() => setShowSuggestions(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[380px] max-h-[70vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-lg text-gray-900">AI提案</h2>
              <button onClick={() => setShowSuggestions(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {suggestions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">新しい提案はありません</p>
              ) : (
                suggestions.map((s) => (
                  <div key={s.id} className="bg-gray-50 rounded-xl p-4">
                    <p className="font-medium text-gray-900">{s.title}</p>
                    {s.due && <p className="text-sm text-gray-500 mt-1">期限: {s.due}</p>}
                    <p className="text-xs text-gray-400 mt-1 truncate">{s.sourceTitle}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleAddFromSuggestion(s)}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                      >
                        + 追加
                      </button>
                      <button
                        onClick={() => dismiss(s)}
                        className="px-4 py-2 text-sm text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300"
                      >
                        無視
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => analyze()}
                disabled={suggestionsLoading}
                className="w-full py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
              >
                再分析
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Create Modal */}
      {eventCreateModal && (
        <EventCreateModal
          startTime={eventCreateModal.startTime}
          endTime={eventCreateModal.endTime}
          onClose={() => setEventCreateModal(null)}
          onCreateEvent={handleCreateCalendarEvent}
        />
      )}
    </div>
  );
}

export default App;
