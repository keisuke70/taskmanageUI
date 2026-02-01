import { useState, useEffect, useCallback } from 'react';
import type { CalendarEvent, CalendarViewMode } from '../types';
import * as api from '../api/client';

function getDateRange(mode: CalendarViewMode, baseDate: Date) {
  const start = new Date(baseDate);
  const end = new Date(baseDate);

  if (mode === 'day') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export function useCalendar(mode: CalendarViewMode = 'week') {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseDate, setBaseDate] = useState(new Date());

  const fetchEvents = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const { start, end } = getDateRange(mode, baseDate);
      const data = await api.getCalendarEvents(start.toISOString(), end.toISOString());
      setEvents(data);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to fetch events');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [mode, baseDate]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Polling every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEvents(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const goToToday = useCallback(() => {
    setBaseDate(new Date());
  }, []);

  const goNext = useCallback(() => {
    setBaseDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + (mode === 'day' ? 1 : 7));
      return next;
    });
  }, [mode]);

  const goPrev = useCallback(() => {
    setBaseDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - (mode === 'day' ? 1 : 7));
      return next;
    });
  }, [mode]);

  return {
    events,
    loading,
    error,
    baseDate,
    refresh: fetchEvents,
    goToToday,
    goNext,
    goPrev,
    setBaseDate,
  };
}
