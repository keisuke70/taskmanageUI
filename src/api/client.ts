import type { Task, TaskList, CalendarEvent, Suggestion } from '../types';

const API_BASE = 'http://localhost:3001/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Request failed');
  }
  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

// Task Lists
export async function getTaskLists(): Promise<TaskList[]> {
  return request('/tasks/lists');
}

export async function createTaskList(title: string): Promise<TaskList> {
  return request('/tasks/lists', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function deleteTaskList(listId: string): Promise<void> {
  await request(`/tasks/lists/${listId}`, { method: 'DELETE' });
}

// Tasks
export async function getTasks(listId?: string): Promise<Task[]> {
  const query = listId ? `?listId=${encodeURIComponent(listId)}` : '';
  return request(`/tasks${query}`);
}

export async function createTask(
  title: string,
  options?: { notes?: string; due?: string; listId?: string }
): Promise<Task> {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, ...options }),
  });
}

export async function updateTask(
  taskId: string,
  updates: Partial<Pick<Task, 'title' | 'notes' | 'due' | 'status'>>,
  listId?: string
): Promise<Task> {
  return request(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...updates, listId }),
  });
}

export async function completeTask(taskId: string, listId?: string): Promise<Task> {
  return updateTask(taskId, { status: 'completed' }, listId);
}

export async function uncompleteTask(taskId: string, listId?: string): Promise<Task> {
  return updateTask(taskId, { status: 'needsAction' }, listId);
}

export async function deleteTask(taskId: string, listId?: string): Promise<void> {
  const query = listId ? `?listId=${encodeURIComponent(listId)}` : '';
  await request(`/tasks/${taskId}${query}`, { method: 'DELETE' });
}

// Calendar
export async function getCalendarEvents(
  startDate?: string,
  endDate?: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (startDate) params.set('start', startDate);
  if (endDate) params.set('end', endDate);
  const query = params.toString() ? `?${params}` : '';
  return request(`/calendar${query}`);
}

export async function createCalendarEvent(
  title: string,
  start: string,
  end: string,
  calendarId?: string
): Promise<CalendarEvent> {
  return request('/calendar', {
    method: 'POST',
    body: JSON.stringify({ title, start, end, calendarId }),
  });
}

export async function updateCalendarEvent(
  eventId: string,
  updates: { start?: string; end?: string; summary?: string },
  calendarId?: string
): Promise<CalendarEvent> {
  return request(`/calendar/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...updates, calendarId }),
  });
}

// AI Chat
export type TaskAction = 'add' | 'update' | 'delete' | 'complete' | 'uncomplete';

export interface ExtractedTask {
  id: string;
  title: string;
  due?: string;
  notes?: string;
  action: TaskAction;
  existingTaskId?: string;  // 既存タスクのID（更新/削除/完了時）
  existingListId?: string;  // 既存タスクのリストID
}

export interface ExecutedTask {
  task: ExtractedTask;
  success: boolean;
  error?: string;
}

export interface AiChatResponse {
  response: string;
  executedTasks?: ExecutedTask[];
}

let sessionId = `session-${Date.now()}`;

function getLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function sendAiMessage(message: string): Promise<AiChatResponse> {
  return request('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      sessionId,
      localDate: getLocalDateString(),  // ブラウザのローカル日付を送信
    }),
  });
}

export async function clearAiChat(): Promise<void> {
  await request('/ai/clear', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
  sessionId = `session-${Date.now()}`;
}

// Suggestions
export interface SuggestionsResponse {
  success: boolean;
  suggestions: Suggestion[];
  gmail?: Suggestion[];
  calendar?: Suggestion[];
}

export async function analyzeSuggestions(
  source?: 'gmail' | 'calendar'
): Promise<SuggestionsResponse> {
  return request('/suggestions/analyze', {
    method: 'POST',
    body: JSON.stringify({
      source,
      localDate: getLocalDateString(),
    }),
  });
}
