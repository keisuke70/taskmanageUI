import { useEffect, useRef, useState, useCallback } from 'react';
import type { CalendarEvent, CalendarViewMode, Task } from '../types';

interface DragSelection {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  loading: boolean;
  error: string | null;
  mode: CalendarViewMode;
  baseDate: Date;
  collapsed: boolean;
  onModeChange: (mode: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCollapse: () => void;
  onDragSelect?: (startTime: Date, endTime: Date) => void;
  // External selection to keep visible when modal is open
  pendingSelection?: { startTime: Date; endTime: Date } | null;
  // Convert event to task
  onEventToTask?: (event: CalendarEvent) => void;
  // Update event time
  onEventUpdate?: (eventId: string, start: Date, end: Date) => Promise<void>;
}

function getWeekDays(baseDate: Date): Date[] {
  const days: Date[] = [];
  const start = new Date(baseDate);
  const dayOfWeek = start.getDay();
  start.setDate(start.getDate() - dayOfWeek);

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatTimeRange(start: CalendarEvent['start'], end: CalendarEvent['end']): string {
  if (start.date && !start.dateTime) {
    return 'All day';
  }
  if (start.dateTime) {
    const startTime = formatTime(start.dateTime);
    const endTime = end.dateTime ? formatTime(end.dateTime) : '';
    return endTime ? `${startTime} - ${endTime}` : startTime;
  }
  return '';
}

function formatTaskDue(due: string): string {
  const date = new Date(due);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  // If time is midnight (00:00), treat as no specific time
  if (hours === 0 && minutes === 0) {
    return 'Due today';
  }
  return `Due ${formatTime(due)}`;
}

const HOUR_HEIGHT = 60; // pixels per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getEventPosition(event: CalendarEvent): { top: number; height: number } | null {
  if (!event.start.dateTime) return null;

  const start = new Date(event.start.dateTime);
  const end = event.end.dateTime ? new Date(event.end.dateTime) : new Date(start.getTime() + 60 * 60 * 1000);

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const duration = Math.max(endMinutes - startMinutes, 30); // minimum 30min height

  return {
    top: (startMinutes / 60) * HOUR_HEIGHT,
    height: (duration / 60) * HOUR_HEIGHT,
  };
}

function getCurrentTimePosition(): number {
  const now = new Date();
  return ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function CalendarView({
  events,
  tasks,
  loading,
  error,
  mode,
  baseDate,
  collapsed,
  onModeChange,
  onPrev,
  onNext,
  onToday,
  onCollapse,
  onDragSelect,
  pendingSelection,
  onEventToTask,
  onEventUpdate,
}: CalendarViewProps) {
  const today = new Date();
  const days = mode === 'week' ? getWeekDays(baseDate) : [baseDate];
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Drag selection state (day mode only)
  const [isDragging, setIsDragging] = useState(false);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);

  // Event drag/resize state
  const [eventDrag, setEventDrag] = useState<{
    eventId: string;
    mode: 'move' | 'resize';
    originalStart: Date;
    originalEnd: Date;
    currentStart: Date;
    currentEnd: Date;
    updating?: boolean; // true when API call in progress
  } | null>(null);

  // Convert pendingSelection to pixel position for display
  const getPendingSelectionStyle = useCallback(() => {
    if (!pendingSelection) return null;
    const startMinutes = pendingSelection.startTime.getHours() * 60 + pendingSelection.startTime.getMinutes();
    const endMinutes = pendingSelection.endTime.getHours() * 60 + pendingSelection.endTime.getMinutes();
    return {
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
    };
  }, [pendingSelection]);

  const getTimeFromY = useCallback((clientY: number): { hour: number; minute: number } | null => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    // rect.top already accounts for scroll position, so we don't need to add scrollTop
    const y = clientY - rect.top;
    const totalMinutes = Math.max(0, Math.min(24 * 60 - 1, (y / HOUR_HEIGHT) * 60));
    // Snap to 15-minute intervals
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    return {
      hour: Math.floor(snappedMinutes / 60),
      minute: snappedMinutes % 60,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode !== 'day' || !onDragSelect) return;
    const time = getTimeFromY(e.clientY);
    if (!time) return;
    setIsDragging(true);
    setDragSelection({
      startHour: time.hour,
      startMinute: time.minute,
      endHour: time.hour,
      endMinute: time.minute + 30, // default 30 min
    });
  }, [mode, onDragSelect, getTimeFromY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || mode !== 'day') return;
    const time = getTimeFromY(e.clientY);
    if (!time || !dragSelection) return;
    setDragSelection((prev) => prev ? {
      ...prev,
      endHour: time.hour,
      endMinute: time.minute,
    } : null);
  }, [isDragging, mode, getTimeFromY, dragSelection]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragSelection || !onDragSelect) {
      setIsDragging(false);
      setDragSelection(null);
      return;
    }
    setIsDragging(false);

    // Calculate start and end times
    const startMinutes = dragSelection.startHour * 60 + dragSelection.startMinute;
    const endMinutes = dragSelection.endHour * 60 + dragSelection.endMinute;
    const [minMinutes, maxMinutes] = startMinutes <= endMinutes
      ? [startMinutes, endMinutes]
      : [endMinutes, startMinutes];

    // Ensure minimum 15 minute duration
    const finalEndMinutes = Math.max(minMinutes + 15, maxMinutes);

    const startTime = new Date(baseDate);
    startTime.setHours(Math.floor(minMinutes / 60), minMinutes % 60, 0, 0);

    const endTime = new Date(baseDate);
    endTime.setHours(Math.floor(finalEndMinutes / 60), finalEndMinutes % 60, 0, 0);

    setDragSelection(null);
    onDragSelect(startTime, endTime);
  }, [isDragging, dragSelection, onDragSelect, baseDate]);

  // Calculate drag selection display
  const getDragSelectionStyle = useCallback(() => {
    if (!dragSelection) return null;
    const startMinutes = dragSelection.startHour * 60 + dragSelection.startMinute;
    const endMinutes = dragSelection.endHour * 60 + dragSelection.endMinute;
    const [minMinutes, maxMinutes] = startMinutes <= endMinutes
      ? [startMinutes, endMinutes]
      : [endMinutes, startMinutes];
    const finalEndMinutes = Math.max(minMinutes + 15, maxMinutes);
    return {
      top: (minMinutes / 60) * HOUR_HEIGHT,
      height: ((finalEndMinutes - minMinutes) / 60) * HOUR_HEIGHT,
    };
  }, [dragSelection]);

  // Event drag/resize handlers
  const handleEventDragStart = useCallback((
    e: React.MouseEvent,
    event: CalendarEvent,
    dragMode: 'move' | 'resize'
  ) => {
    if (mode !== 'day' || !onEventUpdate) return;
    e.stopPropagation();
    e.preventDefault();

    const startDate = new Date(event.start.dateTime || event.start.date || '');
    const endDate = new Date(event.end.dateTime || event.end.date || '');

    setEventDrag({
      eventId: event.id,
      mode: dragMode,
      originalStart: startDate,
      originalEnd: endDate,
      currentStart: startDate,
      currentEnd: endDate,
    });
  }, [mode, onEventUpdate]);

  const handleEventDragMove = useCallback((e: React.MouseEvent) => {
    if (!eventDrag || eventDrag.updating) return;
    const time = getTimeFromY(e.clientY);
    if (!time) return;

    const clickMinutes = time.hour * 60 + time.minute;

    if (eventDrag.mode === 'move') {
      const duration = eventDrag.originalEnd.getTime() - eventDrag.originalStart.getTime();
      const newStart = new Date(baseDate);
      newStart.setHours(time.hour, time.minute, 0, 0);
      const newEnd = new Date(newStart.getTime() + duration);

      setEventDrag(prev => prev ? { ...prev, currentStart: newStart, currentEnd: newEnd } : null);
    } else {
      // Resize mode - change end time
      const startMinutes = eventDrag.originalStart.getHours() * 60 + eventDrag.originalStart.getMinutes();
      const newEndMinutes = Math.max(startMinutes + 15, clickMinutes); // minimum 15 min
      const newEnd = new Date(baseDate);
      newEnd.setHours(Math.floor(newEndMinutes / 60), newEndMinutes % 60, 0, 0);

      setEventDrag(prev => prev ? { ...prev, currentEnd: newEnd } : null);
    }
  }, [eventDrag, getTimeFromY, baseDate]);

  const handleEventDragEnd = useCallback(async () => {
    if (!eventDrag || eventDrag.updating || !onEventUpdate) {
      if (eventDrag && !eventDrag.updating) {
        setEventDrag(null);
      }
      return;
    }

    const { eventId, currentStart, currentEnd, originalStart, originalEnd } = eventDrag;

    // Only update if changed
    if (currentStart.getTime() !== originalStart.getTime() || currentEnd.getTime() !== originalEnd.getTime()) {
      // Mark as updating to stop following cursor
      setEventDrag(prev => prev ? { ...prev, updating: true } : null);
      await onEventUpdate(eventId, currentStart, currentEnd);
    }

    setEventDrag(null);
  }, [eventDrag, onEventUpdate]);

  // Get event position (use drag state if dragging)
  const getEventDisplayPosition = useCallback((event: CalendarEvent) => {
    if (eventDrag && eventDrag.eventId === event.id) {
      const startMinutes = eventDrag.currentStart.getHours() * 60 + eventDrag.currentStart.getMinutes();
      const endMinutes = eventDrag.currentEnd.getHours() * 60 + eventDrag.currentEnd.getMinutes();
      return {
        top: (startMinutes / 60) * HOUR_HEIGHT,
        height: ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
      };
    }
    return getEventPosition(event);
  }, [eventDrag]);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current && !loading && !collapsed) {
      const currentHour = new Date().getHours();
      const scrollTo = Math.max(0, (currentHour - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, [loading, collapsed]);

  // Collapsed state - show thin bar
  if (collapsed) {
    return (
      <div className="w-12 h-full flex flex-col bg-white border-l border-gray-200">
        <button
          onClick={onCollapse}
          className="flex-1 flex flex-col items-center py-4 hover:bg-gray-50 transition-colors"
          title="カレンダーを展開"
        >
          {/* Expand icon */}
          <svg className="w-4 h-4 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {/* Calendar icon */}
          <svg className="w-5 h-5 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {/* Vertical text */}
          <span className="text-sm font-medium text-gray-700" style={{ writingMode: 'vertical-rl' }}>
            カレンダー
          </span>
        </button>
      </div>
    );
  }

  const getEventsForDay = (day: Date) =>
    events.filter((e) => {
      const eventDate = new Date(e.start.dateTime || e.start.date || '');
      return isSameDay(eventDate, day);
    });

  const getAllDayEvents = (day: Date) =>
    getEventsForDay(day).filter((e) => e.start.date && !e.start.dateTime);

  const getTimedEvents = (day: Date) =>
    getEventsForDay(day).filter((e) => e.start.dateTime);

  const getTasksForDay = (day: Date) =>
    tasks.filter((t) => {
      if (!t.due || t.status === 'completed') return false;
      // Parse date string directly to avoid timezone issues
      const dueDateStr = t.due.split('T')[0];
      const [year, month, date] = dueDateStr.split('-').map(Number);
      return (
        day.getFullYear() === year &&
        day.getMonth() === month - 1 &&
        day.getDate() === date
      );
    });

  const formatHeader = () => {
    if (mode === 'day') {
      return baseDate.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      });
    }
    const weekDays = getWeekDays(baseDate);
    const start = weekDays[0];
    const end = weekDays[6];
    const startStr = start.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className={`border-b border-gray-200 ${mode === 'day' ? 'p-2' : 'p-4'}`}>
        {/* Top row: navigation and collapse */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              className="p-1 rounded hover:bg-gray-100"
              title="Previous"
            >
              <svg className={`${mode === 'day' ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={onToday}
              className={`${mode === 'day' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'} border border-gray-300 rounded hover:bg-gray-50`}
            >
              Today
            </button>
            <button
              onClick={onNext}
              className="p-1 rounded hover:bg-gray-100"
              title="Next"
            >
              <svg className={`${mode === 'day' ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {mode === 'week' && (
              <span className="ml-2 font-medium">{formatHeader()}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(['day', 'week'] as CalendarViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                className={`${mode === 'day' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'} rounded ${
                  mode === m ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
            <button
              onClick={onCollapse}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
              title="縮小"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          </div>
        </div>
        {/* Date display for day mode */}
        {mode === 'day' && (
          <div className="text-center mt-1">
            <span className="text-sm font-medium text-gray-900">{formatHeader()}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Loading calendar...
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {/* Day headers - sticky */}
          <div className="sticky top-0 z-30 flex border-b border-gray-200 bg-white">
            <div className="w-16 flex-shrink-0 border-r border-gray-200" />
            <div className={`flex-1 grid ${mode === 'week' ? 'grid-cols-7' : 'grid-cols-1'} divide-x divide-gray-200`}>
              {days.map((day) => {
                const isToday = isSameDay(day, today);
                return (
                  <div key={day.toISOString()} className={`p-2 text-center ${isToday ? 'bg-blue-50' : 'bg-white'}`}>
                    <div className="text-xs text-gray-500 uppercase">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-lg font-medium ${isToday ? 'text-blue-600' : ''}`}>
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All-day events & tasks section - sticky below header */}
          {days.some((day) => getAllDayEvents(day).length > 0 || getTasksForDay(day).length > 0) && (
            <div className="sticky top-[60px] z-30 flex border-b border-gray-200 bg-gray-50">
              <div className="w-16 flex-shrink-0 p-1 text-xs text-gray-500 text-right pr-2 border-r border-gray-200">
                All day
              </div>
              <div className={`flex-1 grid ${mode === 'week' ? 'grid-cols-7' : 'grid-cols-1'} divide-x divide-gray-200`}>
                {days.map((day) => {
                  const allDayEvents = getAllDayEvents(day);
                  const dayTasks = getTasksForDay(day);
                  return (
                    <div key={day.toISOString()} className="p-1 space-y-1 min-h-[32px]">
                      {allDayEvents.map((event) => (
                        <a
                          key={event.id}
                          href={event.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-1.5 py-0.5 bg-purple-100 text-purple-800 hover:bg-purple-200 rounded text-xs truncate"
                        >
                          {event.summary}
                        </a>
                      ))}
                      {dayTasks.map((task) => (
                        <div
                          key={task.id}
                          className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded text-xs truncate"
                        >
                          {task.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time grid */}
          <div className="flex" style={{ height: HOUR_HEIGHT * 24 }}>
            {/* Time labels */}
            <div className="w-16 flex-shrink-0 relative border-r border-gray-200">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-2 text-xs text-gray-500"
                  style={{ top: hour * HOUR_HEIGHT - 6 }}
                >
                  {hour === 0 ? '' : `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`}
                </div>
              ))}
            </div>

            {/* Day columns with events */}
            <div
              ref={gridRef}
              className={`flex-1 grid ${mode === 'week' ? 'grid-cols-7' : 'grid-cols-1'} divide-x divide-gray-200 ${mode === 'day' && onDragSelect && !eventDrag ? 'cursor-crosshair select-none' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={(e) => {
                handleMouseMove(e);
                handleEventDragMove(e);
              }}
              onMouseUp={() => {
                handleMouseUp();
                handleEventDragEnd();
              }}
              onMouseLeave={() => {
                handleMouseUp();
                handleEventDragEnd();
              }}
            >
              {days.map((day) => {
                const timedEvents = getTimedEvents(day);
                const isToday = isSameDay(day, today);
                const dragStyle = mode === 'day' ? getDragSelectionStyle() : null;
                const pendingStyle = mode === 'day' ? getPendingSelectionStyle() : null;
                // Show drag selection if dragging, otherwise show pending selection
                const selectionStyle = dragStyle || pendingStyle;
                const isActiveSelection = !!dragStyle;

                return (
                  <div key={day.toISOString()} className="relative">
                    {/* Hour grid lines */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute w-full border-t border-gray-100"
                        style={{ top: hour * HOUR_HEIGHT }}
                      />
                    ))}

                    {/* Selection overlay (drag or pending) */}
                    {selectionStyle && (
                      <div
                        className={`absolute left-0.5 right-0.5 rounded pointer-events-none z-15 border-2 ${
                          isActiveSelection
                            ? 'bg-blue-300/60 border-blue-500'
                            : 'bg-blue-200/50 border-blue-400'
                        }`}
                        style={{ top: selectionStyle.top, height: selectionStyle.height }}
                      >
                        {/* Time label inside selection */}
                        {selectionStyle.height >= 30 && (
                          <div className="px-2 py-1 text-xs font-medium text-blue-700">
                            {pendingSelection ? (
                              `${pendingSelection.startTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${pendingSelection.endTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
                            ) : dragSelection ? (
                              (() => {
                                const startMin = dragSelection.startHour * 60 + dragSelection.startMinute;
                                const endMin = dragSelection.endHour * 60 + dragSelection.endMinute;
                                const [minM, maxM] = startMin <= endMin ? [startMin, endMin] : [endMin, startMin];
                                const finalEndM = Math.max(minM + 15, maxM);
                                const formatT = (m: number) => `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
                                return `${formatT(minM)} - ${formatT(finalEndM)}`;
                              })()
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Current time indicator */}
                    {isToday && (
                      <div
                        className="absolute w-full flex items-center z-20"
                        style={{ top: getCurrentTimePosition() }}
                      >
                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                        <div className="flex-1 h-0.5 bg-red-500" />
                      </div>
                    )}

                    {/* Events */}
                    {timedEvents.map((event) => {
                      const pos = getEventDisplayPosition(event);
                      if (!pos) return null;
                      const isDraggingThis = eventDrag?.eventId === event.id;
                      return (
                        <div
                          key={event.id}
                          className={`absolute left-0.5 right-0.5 rounded p-1 overflow-hidden z-10 border-l-2 group ${
                            isDraggingThis
                              ? 'bg-blue-200 border-blue-600 opacity-80 shadow-lg'
                              : 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-500'
                          } ${mode === 'day' && onEventUpdate ? 'cursor-move' : ''}`}
                          style={{ top: pos.top, height: pos.height }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (mode === 'day' && onEventUpdate) {
                              handleEventDragStart(e, event, 'move');
                            }
                          }}
                        >
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                            onClick={(e) => {
                              // Prevent navigation when dragging
                              if (eventDrag) e.preventDefault();
                            }}
                          >
                            <div className="text-xs font-medium truncate pr-6">{event.summary}</div>
                            <div className="text-xs text-blue-600 truncate">
                              {formatTimeRange(event.start, event.end)}
                            </div>
                            {event.location && pos.height > 50 && (
                              <div className="text-xs text-blue-500 truncate">
                                📍 {event.location}
                              </div>
                            )}
                          </a>
                          {onEventToTask && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onEventToTask(event);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded hover:bg-orange-200 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="タスクに追加"
                            >
                              +Task
                            </button>
                          )}
                          {/* Resize handle */}
                          {mode === 'day' && onEventUpdate && (
                            <div
                              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-300/50"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleEventDragStart(e, event, 'resize');
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
