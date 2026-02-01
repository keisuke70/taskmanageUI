import { useState, useCallback, useEffect, useRef } from 'react';
import type { Suggestion } from '../types';
import { analyzeSuggestions } from '../api/client';

const DISMISSED_KEY = 'ai-tasks-dismissed-suggestions';
const LAST_ANALYZED_KEY = 'ai-tasks-last-analyzed-date';

function getDismissedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveDismissedIds(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getLastAnalyzedDate(): string | null {
  return localStorage.getItem(LAST_ANALYZED_KEY);
}

function saveLastAnalyzedDate() {
  localStorage.setItem(LAST_ANALYZED_KEY, getTodayString());
}

export function useSuggestions(isActive = false) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [gmailSuggestions, setGmailSuggestions] = useState<Suggestion[]>([]);
  const [calendarSuggestions, setCalendarSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);
  const hasAutoAnalyzed = useRef(false);

  const filterDismissed = useCallback((items: Suggestion[]): Suggestion[] => {
    const dismissed = getDismissedIds();
    return items.filter((s) => !dismissed.has(s.sourceId));
  }, []);

  const analyze = useCallback(async (source?: 'gmail' | 'calendar') => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeSuggestions(source);

      if (result.success) {
        const filtered = filterDismissed(result.suggestions);
        setSuggestions(filtered);

        if (result.gmail) {
          setGmailSuggestions(filterDismissed(result.gmail));
        }
        if (result.calendar) {
          setCalendarSuggestions(filterDismissed(result.calendar));
        }

        setLastAnalyzed(new Date());
        saveLastAnalyzedDate();
      } else {
        throw new Error('Analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze');
    } finally {
      setLoading(false);
    }
  }, [filterDismissed]);

  // Auto-analyze once per day when tab becomes active
  useEffect(() => {
    if (!isActive || hasAutoAnalyzed.current || loading) return;

    const lastDate = getLastAnalyzedDate();
    const today = getTodayString();

    if (lastDate !== today) {
      hasAutoAnalyzed.current = true;
      analyze();
    }
  }, [isActive, loading, analyze]);

  const dismiss = useCallback((suggestion: Suggestion) => {
    // Save to localStorage to prevent re-showing
    const dismissed = getDismissedIds();
    dismissed.add(suggestion.sourceId);
    saveDismissedIds(dismissed);

    // Remove from state
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    setGmailSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    setCalendarSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  }, []);

  const removeSuggestion = useCallback((suggestionId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    setGmailSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    setCalendarSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
  }, []);

  const clearDismissed = useCallback(() => {
    localStorage.removeItem(DISMISSED_KEY);
  }, []);

  const count = suggestions.length;

  return {
    suggestions,
    gmailSuggestions,
    calendarSuggestions,
    loading,
    error,
    lastAnalyzed,
    count,
    analyze,
    dismiss,
    removeSuggestion,
    clearDismissed,
  };
}
